/* ============================================================
   Laço principal, salvamento, fluxo de telas, instalação
   ============================================================ */
const SAVE_KEY = 'kaa-save-v1';
let hotSave = null;
const hasSave = () => !!(store.get(SAVE_KEY) || hotSave);

function initNPCs() {
  G.npcs = [
    { id: 'jaci', name: 'Vó Jaci', x: 1988, y: 2012, cr: 12, scarf: [] },
    { id: 'curu', name: 'Curupira', x: 2112, y: 1330, cr: 10, scarf: [] },
    { id: 'rai', name: 'Seu Raimundo', x: 2668, y: 2098, cr: 12, scarf: [] },
  ];
}

function resetWorldState() {
  G.enemies = []; G.projs = []; G.parts = []; G.texts = []; G.pickups = []; G.hazards = []; G.slashes = []; G.afterimages = [];
  G.flags = { metJaci: false, metCuru: false, metRai: false, gateOpen: false, bossDone: false, bossStarted: false, gateAnnounced: false };
  G.shop = { blade: 0, necklace: 0 };
  G.stats = { kills: 0, time: 0, deaths: 0 };
  G.explored = new Uint8Array(64 * 64);
  G.tod = 0.62; G.weather = { rain: 0, target: 0, t: 120, flash: 0, bolt: 6 };
  G.pendingLevels = 0; G.levelT = 0; G.hitstop = 0; G.slowT = 0; G.combat = 0;
  resetPlayer(); initTotems(); initNPCs(); G.boss = makeBoss();
  bossBar(false);
}

function serialize() {
  return {
    v: 1,
    P: { x: P.x, y: P.y, hp: P.hp, hpMax: P.hpMax, en: P.en, enMax: P.enMax, lvl: P.lvl, xp: P.xp, seeds: P.seeds, potions: P.potions, skills: P.skills, st: P.st, blessings: P.blessings },
    shop: G.shop, flags: Object.assign({}, G.flags, { bossStarted: false }), totems: G.totems.map(t => (t.state === 'awake' ? 1 : 0)),
    tod: G.tod, stats: G.stats, explored: Array.from(G.explored).join(''),
  };
}
function saveGame() {
  if (!G.started) return;
  try { const s = JSON.stringify(serialize()); store.set(SAVE_KEY, s); hotSave = s; } catch (e) { /* */ }
}
function loadSave() {
  const raw = store.get(SAVE_KEY) || hotSave;
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    resetWorldState();
    Object.assign(P, { x: d.P.x, y: d.P.y, hp: d.P.hp, hpMax: d.P.hpMax, en: d.P.en, enMax: d.P.enMax, lvl: d.P.lvl, xp: d.P.xp, seeds: d.P.seeds, potions: d.P.potions });
    Object.assign(P.skills, d.P.skills); Object.assign(P.st, d.P.st); P.blessings = d.P.blessings || {};
    if (isSolid(P.x, P.y) || P.hp <= 0) { P.x = 2048; P.y = 2125; P.hp = Math.max(P.hp, P.hpMax * 0.5); }
    P.hp = Math.max(1, P.hp);
    for (const s of P.scarf) { s.x = s.px = P.x; s.y = s.py = P.y - 18; }
    G.shop = Object.assign({ blade: 0, necklace: 0 }, d.shop);
    G.flags = Object.assign(G.flags, d.flags, { bossStarted: false });
    d.totems.forEach((a, i) => { if (a) G.totems[i].state = 'awake'; });
    G.tod = d.tod || 0.62; G.stats = Object.assign(G.stats, d.stats);
    if (d.explored) for (let i = 0; i < 4096; i++) G.explored[i] = d.explored.charCodeAt(i) === 49 ? 1 : 0;
    if (G.flags.bossDone) { G.boss.st = 'purified'; G.boss.alive = false; G.boss.pur = 20; }
    return true;
  } catch (e) { return false; }
}

function startPlaying() {
  G.started = true;
  initFog();
  G.cam.x = P.x; G.cam.y = P.y;
  $('title').hidden = true;
  AudioSys.setMood('explore');
  tryFullscreen();
}
function newGame() {
  AudioSys.init(); AudioSys.sfx('open');
  resetWorldState();
  startPlaying();
  saveGame();
  Story.start();
}
function continueGame() {
  AudioSys.init(); AudioSys.sfx('open');
  if (!loadSave()) { newGame(); return; }
  startPlaying();
  setState('play');
  toast('Bem-vindo de volta, Kauã');
}
function toTitle() {
  G.started = false;
  for (const id of ['pause', 'shop', 'levelup', 'gameover', 'victory', 'story', 'howto']) $(id).hidden = true;
  $('dialog').hidden = true;
  setState('title');
  $('title').hidden = false;
  $('mCont').hidden = !hasSave();
  AudioSys.setMood('title');
  resetWorldState();
  G.tod = 0.79;
}
function respawn() {
  $('gameover').hidden = true;
  P.alive = true; P.hp = P.hpMax; P.en = P.enMax; P.x = 2048; P.y = 2125; P.vx = P.vy = 0; P.inv = 1.5; P.deadT = 0;
  P.seeds = Math.floor(P.seeds * 0.7);
  for (const s of P.scarf) { s.x = s.px = P.x; s.y = s.py = P.y - 18; }
  G.enemies = []; G.projs = []; G.hazards = []; G.pickups = [];
  for (const t of G.totems) if (t.state === 'event') t.state = 'corrupt';
  if (G.flags.bossStarted && !G.flags.bossDone) { G.boss = makeBoss(); G.flags.bossStarted = false; bossBar(false); }
  G.cam.x = P.x; G.cam.y = P.y;
  setState('play'); AudioSys.setMood('explore');
  saveGame();
}
function showVictory() {
  setState('victory');
  $('vStats').innerHTML = statsHTML() + `<div><b>${G.stats.deaths}</b><span>Quedas</span></div>`;
  $('victory').hidden = false;
  saveGame();
}
function bossEnding() {
  Dialog.open([
    { who: 'Boitatá', p: 'boita', text: 'Pequeno guardião. A névoa queimava por dentro dos meus olhos. Agora enxergo a mata outra vez.' },
    { who: 'Boitatá', p: 'boita', text: 'Volto a vigiar a floresta. Quem quiser queimá-la vai encontrar meu fogo. Quem a proteger vai encontrar minha luz.' },
  ], () => showVictory());
}
$('goRetry').addEventListener('click', () => { AudioSys.sfx('ui'); respawn(); });
$('vCont').addEventListener('click', () => { $('victory').hidden = true; setState('play'); AudioSys.setMood('explore'); });
$('vMenu').addEventListener('click', () => { saveGame(); toTitle(); });
$('mNew').addEventListener('click', newGame);
$('mCont').addEventListener('click', continueGame);
$('mHow').addEventListener('click', () => { AudioSys.sfx('ui'); $('howto').hidden = false; });

function tryFullscreen() {
  if (!IS_TOUCH || IS_STANDALONE) return;
  try {
    const el = document.documentElement;
    const p = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
    if (p && p.then) p.then(() => { try { const o = screen.orientation; if (o && o.lock) o.lock('landscape').catch(() => { }); } catch (e) { /* */ } }).catch(() => { });
  } catch (e) { /* */ }
  try { if (navigator.wakeLock) navigator.wakeLock.request('screen').catch(() => { }); } catch (e) { /* */ }
}

/* ---------- instalação (PWA) ---------- */
let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); deferredPrompt = e;
  if (IS_PWA_BUILD) { $('mInstall').hidden = false; $('instGo').hidden = false; }
});
if (IS_PWA_BUILD && !IS_STANDALONE && IS_IOS) $('mInstall').hidden = false;
$('mInstall').addEventListener('click', () => { AudioSys.sfx('ui'); $('install').hidden = false; });
$('instClose').addEventListener('click', () => { $('install').hidden = true; });
$('instGo').addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  try { await deferredPrompt.userChoice; } catch (e) { /* */ }
  deferredPrompt = null; $('instGo').hidden = true; $('mInstall').hidden = true; $('install').hidden = true;
});
window.addEventListener('appinstalled', () => { $('mInstall').hidden = true; toast('Kaá instalado. Procure o ícone na tela inicial.'); });

/* ---------- atualização ---------- */
function update(dt) {
  G.t += dt; G.stats.time += dt;
  G.tod = (G.tod + dt / 480) % 1;
  const w = G.weather;
  w.t -= dt;
  if (w.t <= 0) { w.t = rand(80, 160); w.target = (Math.random() < 0.32 && !G.flags.bossStarted) ? rand(0.6, 1) : 0; }
  if (G.flags.bossStarted) w.target = 0;
  w.rain += (w.target - w.rain) * (1 - Math.exp(-dt * 0.2));
  if (w.rain > 0.6) { w.bolt -= dt; if (w.bolt <= 0) { w.bolt = rand(7, 18); w.flash = 0.85; setTimeout(() => AudioSys.sfx('thunder'), 500 + Math.random() * 900); } }
  w.flash = Math.max(0, w.flash - dt * 2.2);

  updatePlayer(dt);
  if (P.alive && Input.attackHeld() && P.atkCd <= 0) playerAttack(Input.mouseDown ? Input.mouseAim() : undefined);
  updateEnemies(dt);
  updateProjs(dt);
  updateTotems(dt);
  updateBoss(dt);
  updateSpawner(dt);
  G.interact = findInteract();
  let n = 0;
  for (const e of G.enemies) if (!e.dead && e.aggro && dist(e.x, e.y, P.x, P.y) < 450) n++;
  G.combat = (G.flags.bossStarted && G.boss && G.boss.alive) ? 1 : Math.min(1, n / 3);
  if (!(G.flags.bossStarted && G.boss && (G.boss.alive || G.boss.st === 'purified'))) AudioSys.setMood(G.dark > 0.55 ? 'night' : 'explore');
  // folhas caindo
  if (G.quality > 0 && Math.random() < dt * 1.2 && G.weather.rain < 0.5) {
    const R = regionW(P.x, P.y);
    if (R.ash < 0.4 && R.village < 0.5) particle({ x: G.cam.x + rand(-400, 400), y: G.cam.y + rand(-250, 200), z: rand(60, 120), vz: 0, g: 18, vx: rand(10, 30), vy: rand(-5, 5), type: 'leaf', col: pick(['#6fae4c', '#a8c75a', '#c9a24a', '#4f8a3a']), life: 5, drag: 0.2, vr: rand(-2, 2) });
  }
  if (G.pendingLevels > 0 && P.alive) {
    G.levelT -= dt;
    if (G.levelT <= 0) {
      for (let i = 0; i < 28; i++) particle({ x: P.x + rand(-16, 16), y: P.y - rand(0, 34), type: 'mote', glow: true, col: pick(['gold', 'white', 'teal']), size: rand(2, 4), life: rand(0.7, 1.4), vy: rand(-140, -60), drag: 1.2, force: true });
      particle({ x: P.x, y: P.y - 10, type: 'ring', glow: true, col: 'gold', size: 8, size2: 90, life: 0.5, force: true });
      P.hp = Math.min(P.hpMax, P.hp + P.hpMax * 0.3);
      AudioSys.sfx('levelUp');
      openLevelUp();
    }
  }
  // barreira de fogo na entrada da Clareira Queimada
  const gx = LOC.arena.x, gy = LOC.arena.y - (RING_IN + RING_OUT) / 2;
  if (gateClosed() && !G.flags.bossDone && dist(P.x, P.y, gx, gy) < 900) {
    const col = G.flags.bossStarted ? 'fire' : 'magenta';
    const n = G.quality === 0 ? 2 : 4;
    for (let i = 0; i < n; i++) particle({ x: gx + rand(-100, 100), y: gy + rand(-70, 70), type: 'flame', glow: true, col: Math.random() < 0.3 ? 'fire' : col, size: rand(7, 14), life: rand(0.4, 0.8), vy: rand(-70, -30), vx: rand(-8, 8), drag: 0.5 });
    if (!G.flags.bossStarted && P.alive && dist(P.x, P.y, gx, gy + 70) < 120 && G.t > (G.gateMsgT || 0)) {
      G.gateMsgT = G.t + 12;
      toast(G.flags.gateOpen ? 'O fogo se apaga…' : 'Uma barreira de fogo roxo fecha a clareira. Desperte os três totens para abri-la.', 5);
    }
  }
  G.exploreT -= dt;
  if (G.exploreT <= 0) { G.exploreT = 0.4; explore(); }
  G.saveT += dt;
  if (G.saveT > 30) { G.saveT = 0; saveGame(); }
  if (!P.alive && P.deadT > 1.8 && G.state === 'play') { setState('gameover'); $('gameover').hidden = false; AudioSys.setMood('night'); }
}

function updateCamera(dt) {
  const c = G.cam;
  let tx, ty;
  if (G.state === 'title' || G.state === 'loading') {
    const vw = W / S;
    tx = LOC.village.x + 40 - vw * (innerWidth > innerHeight ? 0.17 : 0) + Math.cos(G.real * 0.05) * 40;
    ty = LOC.village.y + 20 + Math.sin(G.real * 0.07) * 30 + (innerWidth > innerHeight ? 0 : 60);
    c.x += (tx - c.x) * (1 - Math.exp(-dt * 0.8)); c.y += (ty - c.y) * (1 - Math.exp(-dt * 0.8));
  } else {
    tx = P.x + P.vx * 0.22; ty = P.y - 14 + P.vy * 0.22;
    const B = G.boss;
    if (B && G.flags.bossStarted && B.st !== 'dormant' && B.st !== 'purified') { tx = lerp(tx, B.segs[0].x, 0.25); ty = lerp(ty, B.segs[0].y, 0.25); }
    if (B && B.st === 'purified' && B.pur < 6 && dist(P.x, P.y, LOC.arena.x, LOC.arena.y) < 800) { tx = lerp(tx, B.segs[0].x, 0.4); ty = lerp(ty, B.segs[0].y - 60, 0.4); }
    c.x += (tx - c.x) * (1 - Math.exp(-dt * 5)); c.y += (ty - c.y) * (1 - Math.exp(-dt * 5));
  }
  c.shake = Math.max(0, c.shake - dt * 28);
}

/* ---------- desempenho ---------- */
let perfAcc = 0, perfN = 0, perfT = 0, upgraded = false;
function perfTrack(dt) {
  if (G.state !== 'play' || !G.autoQ) return;
  perfAcc += dt; perfN++; perfT += dt;
  if (perfT < 3) return;
  const avg = perfAcc / perfN;
  perfAcc = 0; perfN = 0; perfT = 0;
  if (avg > 0.028 && G.quality > 0) { G.quality--; resize(); }
  else if (avg < 0.0135 && G.quality < 2 && !upgraded) { upgraded = true; G.quality++; resize(); }
}

/* ---------- laço ---------- */
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - lastT) / 1000; lastT = now;
  if (!(dt > 0)) dt = 0.001; if (dt > 0.1) dt = 0.1;
  G.real += dt;
  perfTrack(dt);
  pollGamepad();
  if (G.state === 'play') {
    let gdt = dt;
    if (G.slowT > 0) { G.slowT -= dt; gdt *= 0.35; }
    if (G.hitstop > 0) { G.hitstop -= dt; gdt = 0; }
    if (gdt > 0) update(gdt);
    updateParticles(dt * (G.slowT > 0 ? 0.35 : 1));
  } else if (G.state === 'title' || G.state === 'story') {
    G.tod = G.state === 'title' ? 0.79 : G.tod;
    updateParticles(dt);
    if (F.canvas && Math.random() < dt * 8) particle({ x: LOC.village.x + rand(-10, 10), y: LOC.village.y - 6, type: 'ember', glow: true, col: 'fire', size: rand(1.5, 3), life: rand(0.8, 1.6), vx: rand(-12, 12), vy: rand(-70, -35), drag: 0.6 });
  } else if (G.state === 'dialog') {
    Dialog.tick(dt);
    updateParticles(dt);
  }
  if (G.state === 'play' && Math.random() < dt * 7) particle({ x: LOC.village.x + rand(-10, 10), y: LOC.village.y - 6, type: 'ember', glow: true, col: 'fire', size: rand(1.5, 3), life: rand(0.8, 1.6), vx: rand(-12, 12), vy: rand(-70, -35), drag: 0.6 });
  G.hurtFlash = Math.max(0, G.hurtFlash - dt * 2.4);
  updateCamera(dt);
  if (F.canvas) {
    computeAmbient();
    render(dt);
  }
  if (!$('hud').hidden) { updateHUD(); if (F.canvas && fogImg) drawMinimap(dt); }
  AudioSys.update(dt, { combat: G.state === 'play' ? G.combat : 0, dark: G.dark, rain: G.weather.rain });
}

/* ---------- inicialização ---------- */
function setLoad(p) { $('loadBar').style.width = Math.round(p * 100) + '%'; }
async function boot(data) {
  if (data && data.save) hotSave = data.save;
  const q = store.get('kaa-q');
  if (q && q !== 'auto') { G.autoQ = false; G.quality = clamp(+q, 0, 2); } else G.quality = IS_TOUCH ? 1 : 2;
  resetWorldState();
  G.tod = 0.79;
  resize();
  window.addEventListener('resize', resize);
  SPR = clamp(Math.round(S * 4) / 4, 1.25, 2);
  initFx();
  $('title').hidden = false;
  G.state = 'loading';
  requestAnimationFrame(frame);
  await new Promise(r => setTimeout(r, 30));
  $('loadTxt').textContent = 'Desenhando o terreno…';
  await generateField(p => setLoad(p * 0.55));
  $('loadTxt').textContent = 'Plantando a floresta…';
  await buildSprites(p => setLoad(0.55 + p * 0.3));
  generateProps();
  for (const p of PROPS) if (p.type === 'ipe') GROUND_DECOR.push({ type: 'petals', x: p.x, y: p.y, v: p.v });
  initWaterPts();
  setLoad(0.9);
  $('loadTxt').textContent = 'Acendendo a fogueira…';
  await new Promise(r => requestAnimationFrame(r));
  for (const [cx, cy] of [[3, 3], [4, 3], [3, 4], [4, 4]]) getChunk(cx, cy, true);
  setLoad(1);
  $('loadWrap').hidden = true; $('menu').hidden = false;
  $('mCont').hidden = !hasSave();
  setState('title');
  G.cam.x = LOC.village.x; G.cam.y = LOC.village.y;
  window.__kaa = { G, P, LOC, tp(x, y) { P.x = x; P.y = y; G.cam.x = x; G.cam.y = y; }, spawnEnemy, startBoss, awakenTotem, gainXp };
}

const hot = window.claude && window.claude.hot;
if (hot && hot.snapshot) hot.snapshot(() => ({ save: G.started ? JSON.stringify(serialize()) : hotSave }));
const bootFn = data => { boot(data || {}); };
if (hot && hot.ready) hot.ready(bootFn); else bootFn((hot && hot.data) || {});
