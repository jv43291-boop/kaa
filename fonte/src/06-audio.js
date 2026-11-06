/* ============================================================
   Áudio procedural: trilha generativa, ambiente e efeitos
   ============================================================ */
const AudioSys = (() => {
  let ac = null, master, musicBus, sfxBus, ambBus, reverb, noiseBuf;
  let musicOn = store.get('kaa-music') !== '0', sfxOn = store.get('kaa-sfx') !== '0';
  let mood = 'title', pendingMood = null, nextT = 0, step = 0, tempo = 84;
  let wind, windF, crick, crickG, rainG, birdT = 0, combatLvl = 0, percG;
  const last = {};
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function makeImpulse(sec) {
    const len = Math.floor(ac.sampleRate * sec), buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return buf;
  }

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { ac = new AC(); } catch (e) { ac = null; return; }
    master = ac.createGain(); master.gain.value = 0.85;
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ac.destination);
    reverb = ac.createConvolver(); reverb.buffer = makeImpulse(2.8);
    const rg = ac.createGain(); rg.gain.value = 0.42; reverb.connect(rg); rg.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = musicOn ? 0.5 : 0; musicBus.connect(master);
    const ms = ac.createGain(); ms.gain.value = 0.55; musicBus.connect(ms); ms.connect(reverb);
    percG = ac.createGain(); percG.gain.value = 0; percG.connect(musicBus);
    sfxBus = ac.createGain(); sfxBus.gain.value = sfxOn ? 0.75 : 0; sfxBus.connect(master);
    const ss = ac.createGain(); ss.gain.value = 0.16; sfxBus.connect(ss); ss.connect(reverb);
    ambBus = ac.createGain(); ambBus.gain.value = sfxOn ? 0.55 : 0; ambBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    // vento
    wind = ac.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
    windF = ac.createBiquadFilter(); windF.type = 'lowpass'; windF.frequency.value = 380;
    const wg = ac.createGain(); wg.gain.value = 0.05;
    wind.connect(windF); windF.connect(wg); wg.connect(ambBus); wind.start();
    // grilos
    crick = ac.createOscillator(); crick.type = 'sine'; crick.frequency.value = 4300;
    const am = ac.createOscillator(); am.type = 'square'; am.frequency.value = 26;
    const amg = ac.createGain(); amg.gain.value = 0.5;
    const cg = ac.createGain(); cg.gain.value = 0.5;
    am.connect(amg); amg.connect(cg.gain);
    crickG = ac.createGain(); crickG.gain.value = 0;
    const slow = ac.createOscillator(); slow.frequency.value = 0.7; const slg = ac.createGain(); slg.gain.value = 0.5;
    slow.connect(slg); slg.connect(crickG.gain);
    crick.connect(cg); cg.connect(crickG); crickG.connect(ambBus);
    crick.start(); am.start(); slow.start();
    // chuva
    const rs = ac.createBufferSource(); rs.buffer = noiseBuf; rs.loop = true;
    const rf = ac.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 2400; rf.Q.value = 0.4;
    rainG = ac.createGain(); rainG.gain.value = 0;
    rs.connect(rf); rf.connect(rainG); rainG.connect(ambBus); rs.start();
    nextT = ac.currentTime + 0.1;
  }

  function env(g, t, a, peak, d, sus, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * sus), t + a + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + rel);
  }
  function tone(type, f0, f1, dur, vol, t, dest, delay) {
    t = (t || ac.currentTime) + (delay || 0);
    const o = ac.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, ftype, f0, f1, q, t, dest, delay) {
    t = (t || ac.currentTime) + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(f0, t);
    if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    f.Q.value = q || 1;
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || sfxBus);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }

  /* ----- instrumentos ----- */
  function pad(notes, t, dur, vol, cutoff) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 1.4);
    g.gain.setValueAtTime(vol, t + dur - 0.6); g.gain.linearRampToValueAtTime(0.0001, t + dur + 1.6);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.7;
    f.frequency.setValueAtTime(cutoff * 0.6, t); f.frequency.linearRampToValueAtTime(cutoff * 1.4, t + dur * 0.5); f.frequency.linearRampToValueAtTime(cutoff * 0.7, t + dur + 1.5);
    f.connect(g); g.connect(musicBus);
    for (const n of notes) for (const det of [-8, 8]) {
      const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = det;
      const og = ac.createGain(); og.gain.value = 0.32 / notes.length;
      o.connect(og); og.connect(f); o.start(t); o.stop(t + dur + 1.8);
    }
  }
  function pluck(n, t, vol, decay) {
    const o = ac.createOscillator(); o.type = 'sine'; o.frequency.value = mtof(n);
    const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = mtof(n) * 4.07;
    const g = ac.createGain(), g2 = ac.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + (decay || 1.3));
    g2.gain.setValueAtTime(vol * 0.4, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    let out = musicBus;
    if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = Math.random() * 1.2 - 0.6; p.connect(musicBus); out = p; }
    o.connect(g); o2.connect(g2); g.connect(out); g2.connect(out);
    o.start(t); o2.start(t); o.stop(t + (decay || 1.3) + 0.1); o2.stop(t + 0.25);
  }
  function bass(n, t, dur, vol, type) {
    const o = ac.createOscillator(); o.type = type || 'sine'; o.frequency.value = mtof(n);
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = type === 'sawtooth' ? 420 : 900;
    const g = ac.createGain(); env(g, t, 0.01, vol, 0.2, 0.5, dur);
    o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.4);
  }
  function drum(t, vol, f0, dest) {
    const o = ac.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0 || 130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.22);
    const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    o.connect(g); g.connect(dest || percG); o.start(t); o.stop(t + 0.5);
    noise(0.06, vol * 0.4, 'lowpass', 900, 300, 1, t, dest || percG);
  }
  function shaker(t, vol, dest) { noise(0.05, vol, 'bandpass', 6500, null, 1.2, t, dest || percG); }

  const CHORDS = {
    explore: [[50, 57, 60, 64, 65], [46, 53, 57, 60, 62], [53, 57, 60, 64], [48, 55, 57, 62, 64]],
    night: [[50, 57, 62, 65], [55, 58, 62, 65], [46, 53, 58, 62], [48, 55, 60, 63]],
    boss: [[50, 53, 57], [51, 55, 58], [48, 51, 55], [50, 53, 57]],
    victory: [[50, 57, 61, 64, 66], [55, 59, 62, 66], [52, 59, 62, 64], [57, 61, 64, 69]],
    title: [[50, 57, 60, 64, 65], [46, 53, 57, 60, 62], [41, 53, 57, 60, 64], [48, 55, 57, 62, 64]],
  };
  const SCALES = { explore: [62, 65, 67, 69, 72, 74, 77, 79, 81], night: [62, 65, 67, 69, 72, 74, 77], boss: [62, 63, 65, 67, 69, 70, 74, 75], victory: [62, 64, 66, 69, 71, 74, 76, 78, 81], title: [62, 65, 67, 69, 72, 74, 77, 79] };
  let motif = [];

  function playStep(s, t) {
    const m = mood;
    const bar = Math.floor(s / 16), b16 = s % 16;
    if (b16 === 0 && bar % 2 === 0 && pendingMood) { mood = pendingMood; pendingMood = null; tempo = mood === 'boss' ? 128 : mood === 'night' ? 76 : mood === 'victory' ? 92 : 84; }
    const ch = CHORDS[m][(Math.floor(bar / 2)) % 4];
    const sc = SCALES[m];
    const spb = 60 / tempo;
    if (b16 === 0 && bar % 2 === 0) {
      pad(ch, t, spb * 8, m === 'boss' ? 0.16 : 0.13, m === 'night' ? 700 : m === 'boss' ? 1100 : 950);
      motif = [];
      for (let i = 0; i < 4; i++) motif.push(sc[(Math.random() * sc.length) | 0]);
    }
    if (m === 'boss') {
      if (b16 % 2 === 0) { const pat = [0, 0, 12, 0, 1, 0, -2, 0]; bass(ch[0] - 12 + pat[(b16 / 2) % 8], t, spb * 0.45, 0.22, 'sawtooth'); }
      if ([0, 3, 6, 8, 10, 12, 14].includes(b16)) drum(t, b16 === 0 || b16 === 8 ? 0.9 : 0.55, 110, musicBus);
      if (b16 % 2 === 1) shaker(t, 0.06, musicBus);
      if (b16 % 4 === 2 && Math.random() < 0.7) pluck(motif[(b16 / 4) | 0] + (bar % 4 === 3 ? 12 : 0), t, 0.09, 0.5);
      return;
    }
    if (b16 === 0) bass(ch[0] - 12, t, spb * 3, m === 'night' ? 0.16 : 0.13);
    if (b16 === 8 && Math.random() < 0.5) bass(ch[0] - 12 + (Math.random() < 0.5 ? 7 : 0), t, spb * 2, 0.08);
    const pr = m === 'night' ? 0.18 : m === 'victory' ? 0.5 : 0.3;
    if (b16 % 2 === 0 && Math.random() < pr) {
      const n = Math.random() < 0.55 ? motif[(b16 / 4) | 0] : sc[(Math.random() * sc.length) | 0];
      pluck(n, t, m === 'victory' ? 0.1 : 0.075, m === 'night' ? 2.2 : 1.3);
      if (Math.random() < 0.18) pluck(n + 12, t + spb * 0.25, 0.04, 1);
    }
    // percussão de combate
    if ([0, 6, 8, 11].includes(b16)) drum(t, 0.5);
    if (b16 % 2 === 0) shaker(t, b16 % 4 === 0 ? 0.06 : 0.03);
  }

  function update(dt, ctx2) {
    if (!ac) return;
    const target = clamp(ctx2.combat, 0, 1);
    combatLvl = lerp(combatLvl, target, 1 - Math.exp(-dt * 1.5));
    percG.gain.setTargetAtTime(combatLvl * 0.9, ac.currentTime, 0.3);
    crickG.gain.setTargetAtTime(clamp((ctx2.dark - 0.35) * 0.06, 0, 0.03), ac.currentTime, 1);
    rainG.gain.setTargetAtTime(ctx2.rain * 0.22, ac.currentTime, 0.8);
    windF.frequency.setTargetAtTime(300 + Math.sin(ac.currentTime * 0.2) * 120 + ctx2.rain * 300, ac.currentTime, 0.5);
    birdT -= dt;
    if (birdT <= 0 && sfxOn) {
      birdT = rand(2.5, 6);
      if (ctx2.dark < 0.4 && ctx2.rain < 0.3) {
        const t = ac.currentTime, f = rand(1800, 3200), n = randi(2, 5);
        for (let i = 0; i < n; i++) tone('sine', f, f * rand(1.2, 1.6), 0.09, 0.025, t + i * 0.12, ambBus);
      } else if (ctx2.dark > 0.6 && Math.random() < 0.4) {
        const t = ac.currentTime;
        tone('sine', 420, 380, 0.25, 0.03, t, ambBus); tone('sine', 420, 360, 0.3, 0.03, t + 0.35, ambBus);
      }
    }
    const spb = 60 / tempo, s16 = spb / 4;
    if (nextT < ac.currentTime - 0.5) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.18) { playStep(step, nextT); nextT += s16; step = (step + 1) % 256; }
  }

  const SFX = {
    swing() { noise(0.14, 0.32, 'bandpass', 900, 3200, 1.4); tone('triangle', 520, 300, 0.08, 0.05); },
    swingHeavy() { noise(0.22, 0.42, 'bandpass', 600, 2600, 1.2); tone('triangle', 300, 140, 0.15, 0.08); },
    hit() { noise(0.08, 0.5, 'lowpass', 2400, 400, 1); tone('square', 220, 90, 0.08, 0.08); },
    crit() { noise(0.1, 0.6, 'lowpass', 3200, 500, 1); tone('square', 330, 110, 0.12, 0.1); tone('sine', 1320, 1760, 0.12, 0.06); },
    bossHit() { noise(0.1, 0.45, 'lowpass', 1800, 300, 1); tone('sine', 160, 70, 0.12, 0.12); },
    die() { noise(0.35, 0.3, 'bandpass', 1200, 200, 2); tone('sine', 660, 990, 0.25, 0.05, 0, null, 0.08); tone('sine', 990, 1320, 0.3, 0.04, 0, null, 0.16); },
    hurt() { tone('sawtooth', 180, 70, 0.22, 0.14); noise(0.18, 0.35, 'lowpass', 1200, 200, 1); },
    death() { tone('sine', 440, 110, 1.4, 0.15); tone('sine', 330, 82, 1.6, 0.1); },
    dash() { noise(0.2, 0.3, 'highpass', 800, 3000, 0.7); },
    seed() { const f = 1500 + Math.random() * 400; tone('sine', f, f * 1.5, 0.12, 0.05); },
    potion() { for (let i = 0; i < 4; i++) tone('sine', 520 * Math.pow(1.26, i), 0, 0.3, 0.07, 0, null, i * 0.06); noise(0.3, 0.1, 'bandpass', 1500, 800, 2); },
    potionGet() { tone('sine', 880, 1320, 0.2, 0.07); tone('sine', 1320, 1760, 0.25, 0.05, 0, null, 0.08); },
    levelUp() { [62, 66, 69, 74, 78, 81].forEach((n, i) => tone('triangle', mtof(n), 0, 0.5, 0.08, 0, null, i * 0.07)); },
    claw() { noise(0.35, 0.5, 'bandpass', 500, 2400, 1); tone('sawtooth', 120, 60, 0.3, 0.12); },
    feather() { for (let i = 0; i < 3; i++) tone('sine', 1400 + i * 300, 2400, 0.1, 0.04, 0, null, i * 0.03); noise(0.12, 0.15, 'highpass', 2000, 5000, 0.8); },
    shell() { tone('sine', 220, 330, 0.4, 0.12); tone('sine', 330, 495, 0.5, 0.07, 0, null, 0.1); },
    shieldHit() { tone('triangle', 880, 660, 0.12, 0.08); },
    totemStart() { tone('sawtooth', 110, 55, 1.2, 0.08); noise(1.2, 0.15, 'lowpass', 400, 100, 1); },
    wave() { tone('sine', 220, 220, 0.4, 0.1); tone('sine', 330, 330, 0.4, 0.06, 0, null, 0.15); },
    awaken() { [50, 57, 62, 66, 69, 74].forEach((n, i) => tone('sine', mtof(n), 0, 2.2, 0.08, 0, null, i * 0.09)); noise(1.5, 0.15, 'highpass', 3000, 8000, 0.5); },
    lunge() { noise(0.12, 0.15, 'bandpass', 700, 1500, 2); },
    bat() { tone('square', 1800, 900, 0.08, 0.03); },
    goo() { tone('sine', 300, 90, 0.18, 0.1); noise(0.12, 0.12, 'lowpass', 900, 200, 3); },
    fireball() { noise(0.4, 0.22, 'bandpass', 600, 1800, 1); },
    blink() { tone('sine', 900, 200, 0.25, 0.06); },
    roar() { tone('sawtooth', 90, 50, 0.6, 0.12); noise(0.6, 0.25, 'lowpass', 700, 150, 1); },
    bossRoar() { tone('sawtooth', 70, 40, 1.6, 0.18); tone('sawtooth', 105, 52, 1.6, 0.1); noise(1.6, 0.35, 'lowpass', 900, 120, 1); },
    breath() { noise(1.7, 0.3, 'bandpass', 800, 400, 0.8); },
    boom() { tone('sine', 120, 35, 0.6, 0.3); noise(0.6, 0.4, 'lowpass', 1500, 100, 1); },
    thud() { tone('sine', 90, 40, 0.3, 0.25); noise(0.2, 0.3, 'lowpass', 600, 100, 1); },
    bossDie() { tone('sawtooth', 120, 30, 3, 0.15); noise(3, 0.3, 'lowpass', 2000, 80, 1); },
    thunder() { noise(2.6, 0.5, 'lowpass', 500, 60, 0.8); tone('sine', 50, 30, 2, 0.2); },
    deny() { tone('square', 200, 160, 0.08, 0.04); },
    ui() { tone('sine', 880, 1100, 0.07, 0.05); },
    open() { tone('sine', 520, 780, 0.15, 0.06); tone('sine', 780, 1040, 0.15, 0.04, 0, null, 0.06); },
    talk() { tone('triangle', 600 + Math.random() * 200, 0, 0.04, 0.025); },
  };

  return {
    init,
    get ready() { return !!ac; },
    sfx(name) {
      if (!ac || !sfxOn || !SFX[name]) return;
      const now = ac.currentTime;
      if (last[name] && now - last[name] < 0.035) return;
      last[name] = now;
      try { SFX[name](); } catch (e) { /* */ }
    },
    setMood(m) { if (m !== mood) pendingMood = m; if (!ac) mood = m; },
    get mood() { return pendingMood || mood; },
    update,
    get musicOn() { return musicOn; }, get sfxOn() { return sfxOn; },
    toggleMusic() { musicOn = !musicOn; store.set('kaa-music', musicOn ? '1' : '0'); if (ac) musicBus.gain.setTargetAtTime(musicOn ? 0.5 : 0, ac.currentTime, 0.1); return musicOn; },
    toggleSfx() { sfxOn = !sfxOn; store.set('kaa-sfx', sfxOn ? '1' : '0'); if (ac) { sfxBus.gain.setTargetAtTime(sfxOn ? 0.75 : 0, ac.currentTime, 0.1); ambBus.gain.setTargetAtTime(sfxOn ? 0.55 : 0, ac.currentTime, 0.1); } return sfxOn; },
    suspend() { if (ac && ac.state === 'running') ac.suspend(); },
    resume() { if (ac && ac.state === 'suspended') ac.resume(); },
  };
})();
