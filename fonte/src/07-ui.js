/* ============================================================
   Interface: entrada, HUD, diálogos, loja, bênçãos, minimapa
   ============================================================ */
const $ = id => document.getElementById(id);

const Input = {
  keys: {}, stick: { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false }, gp: { x: 0, y: 0 }, gpA: false,
  mouseDown: false, mx: 0, my: 0, touchAtk: false,
  move() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.a || k.arrowleft) x -= 1; if (k.d || k.arrowright) x += 1;
    if (k.w || k.arrowup) y -= 1; if (k.s || k.arrowdown) y += 1;
    let m = Math.hypot(x, y);
    if (m > 0) { x /= m; y /= m; m = 1; }
    if (this.stick.active) {
      const sm = Math.hypot(this.stick.x, this.stick.y);
      if (sm > 0.14) { x = this.stick.x / sm; y = this.stick.y / sm; m = Math.min(1, (sm - 0.14) / 0.6 + 0.35); }
    }
    const gm = Math.hypot(this.gp.x, this.gp.y);
    if (gm > 0.2) { x = this.gp.x / gm; y = this.gp.y / gm; m = Math.min(1, gm); }
    return { x: x * m, y: y * m, mag: m };
  },
  attackHeld() { return !!(this.keys.j || this.keys[' '] || this.mouseDown || this.touchAtk || this.gpA); },
  mouseAim() {
    const wx = G.cam.x + (this.mx * RS - W / 2) / S, wy = G.cam.y + (this.my * RS - H / 2) / S;
    return Math.atan2(wy - (P.y - 12), wx - P.x);
  },
};

function setState(s) {
  G.state = s;
  const playing = s === 'play';
  $('hud').hidden = !(playing || s === 'dialog' || s === 'shop' || s === 'levelup' || s === 'pause');
  $('pad').hidden = !playing;
  $('touch').hidden = !(playing && IS_TOUCH);
  if (!playing) { Input.stick.active = false; $('stick').hidden = true; Input.touchAtk = false; Input.mouseDown = false; }
}

/* ---------- teclado ---------- */
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k) && e.target === document.body) e.preventDefault();
  const was = Input.keys[k];
  Input.keys[k] = true;
  if (was || e.repeat) return;
  if (G.state === 'play') {
    if (k === 'j' || k === ' ') playerAttack();
    else if (k === 'k' || k === 'shift') playerDash();
    else if (k === '1' || k === 'u') useSkill('onca');
    else if (k === '2' || k === 'i') useSkill('arara');
    else if (k === '3' || k === 'o') useSkill('jabuti');
    else if (k === 'q' || k === 'h') usePotion();
    else if (k === 'e' || k === 'enter') doInteract();
    else if (k === 'escape' || k === 'p') pauseGame();
  } else if (G.state === 'dialog') {
    if (Dialog.choices && Dialog.typed >= Dialog.full.length && ['1', '2', '3'].includes(k)) Dialog.choose(+k - 1);
    else if ([' ', 'enter', 'e', 'j'].includes(k)) Dialog.advance();
  } else if (G.state === 'levelup') { if (['1', '2', '3'].includes(k)) chooseCard(+k - 1); }
  else if (G.state === 'pause') { if (k === 'escape' || k === 'p') resumeGame(); }
  else if (G.state === 'story') { if ([' ', 'enter', 'e', 'j'].includes(k)) Story.next(); }
  else if (G.state === 'shop') { if (k === 'escape') closeShop(); }
});
window.addEventListener('keyup', e => { Input.keys[e.key.toLowerCase()] = false; });
window.addEventListener('blur', () => { Input.keys = {}; Input.mouseDown = false; if (G.state === 'play') pauseGame(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (G.state === 'play') pauseGame(); AudioSys.suspend(); saveGame(); }
  else AudioSys.resume();
});

/* ---------- mouse ---------- */
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType !== 'mouse') return;
  Input.mx = e.clientX; Input.my = e.clientY;
  if (G.state === 'play') {
    if (e.button === 0) { Input.mouseDown = true; playerAttack(Input.mouseAim()); }
    else if (e.button === 2) { if (Input.move().mag < 0.2) P.face = Input.mouseAim(); playerDash(); }
  } else if (G.state === 'dialog') Dialog.advance();
});
window.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') { Input.mx = e.clientX; Input.my = e.clientY; } });
window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse' && e.button === 0) Input.mouseDown = false; });
canvas.addEventListener('contextmenu', e => e.preventDefault());

/* ---------- toque ---------- */
function markTouch() { if (!document.body.classList.contains('touch')) document.body.classList.add('touch'); }
if (IS_TOUCH) markTouch();
window.addEventListener('touchstart', markTouch, { passive: true, once: true });
const stickZone = $('stickZone'), stickEl = $('stick'), knob = $('stickKnob');
stickZone.addEventListener('pointerdown', e => {
  if (Input.stick.active) return;
  e.preventDefault();
  stickZone.setPointerCapture(e.pointerId);
  Object.assign(Input.stick, { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: 0, y: 0, active: true });
  stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px'; stickEl.hidden = false;
  knob.style.transform = 'translate(0px,0px)';
});
stickZone.addEventListener('pointermove', e => {
  const s = Input.stick;
  if (!s.active || e.pointerId !== s.id) return;
  let dx = e.clientX - s.ox, dy = e.clientY - s.oy;
  const d = Math.hypot(dx, dy), max = 50;
  if (d > max) {
    // a base acompanha o dedo quando ele passa do limite
    s.ox += dx / d * (d - max); s.oy += dy / d * (d - max);
    dx = e.clientX - s.ox; dy = e.clientY - s.oy;
    stickEl.style.left = s.ox + 'px'; stickEl.style.top = s.oy + 'px';
  }
  s.x = dx / max; s.y = dy / max;
  knob.style.transform = `translate(${dx}px,${dy}px)`;
});
function stickEnd(e) { const s = Input.stick; if (e.pointerId !== s.id) return; s.active = false; s.x = s.y = 0; stickEl.hidden = true; }
stickZone.addEventListener('pointerup', stickEnd); stickZone.addEventListener('pointercancel', stickEnd);

function bindBtn(id, down, up) {
  const el = $(id);
  el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('on'); AudioSys.init(); down(e); });
  const end = e => { el.classList.remove('on'); if (up) up(e); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('pointerleave', end);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
bindBtn('bAtk', () => { Input.touchAtk = true; if (G.state === 'play') playerAttack(); }, () => { Input.touchAtk = false; });
bindBtn('bDash', () => { if (G.state === 'play') playerDash(); });
bindBtn('bS1', () => { if (G.state === 'play') useSkill('onca'); });
bindBtn('bS2', () => { if (G.state === 'play') useSkill('arara'); });
bindBtn('bS3', () => { if (G.state === 'play') useSkill('jabuti'); });
bindBtn('bPot', () => { if (G.state === 'play') usePotion(); });
bindBtn('bAct', () => { if (G.state === 'play') doInteract(); });
$('btnPause').addEventListener('click', () => { AudioSys.sfx('ui'); pauseGame(); });

/* ---------- controle de videogame ---------- */
let gpPrev = [];
function pollGamepad() {
  const pads = navigator.getGamepads ? navigator.getGamepads() : null;
  let gp = null;
  if (pads) for (const p of pads) if (p) { gp = p; break; }
  if (!gp) { Input.gp.x = Input.gp.y = 0; Input.gpA = false; return; }
  const b = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
  const pr = i => b(i) && !gpPrev[i];
  let ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
  if (b(14)) ax = -1; if (b(15)) ax = 1; if (b(12)) ay = -1; if (b(13)) ay = 1;
  Input.gp.x = Math.abs(ax) > 0.18 ? ax : 0; Input.gp.y = Math.abs(ay) > 0.18 ? ay : 0;
  if (G.state === 'play') {
    if (pr(0)) { if (!(G.interact && G.combat < 0.2 && doInteract())) playerAttack(); }
    Input.gpA = b(0);
    if (pr(1)) playerDash(); if (pr(2)) useSkill('onca'); if (pr(3)) useSkill('arara'); if (pr(5)) useSkill('jabuti');
    if (pr(4)) usePotion(); if (pr(9)) pauseGame();
  } else {
    Input.gpA = false;
    if (G.state === 'dialog') { if (pr(0)) Dialog.advance(); }
    else if (G.state === 'levelup') { if (pr(2)) chooseCard(0); if (pr(3)) chooseCard(1); if (pr(1)) chooseCard(2); }
    else if (G.state === 'pause') { if (pr(9) || pr(1)) resumeGame(); }
    else if (G.state === 'story') { if (pr(0)) Story.next(); }
    else if (G.state === 'shop') { if (pr(1)) closeShop(); }
    else if (G.state === 'gameover') { if (pr(0)) respawn(); }
    else if (G.state === 'title' && !$('menu').hidden) { if (pr(0) || pr(9)) (hasSave() ? continueGame() : newGame()); }
  }
  gpPrev = gp.buttons.map(x => x.pressed);
}

/* ---------- avisos ---------- */
let bannerTimer = 0;
function banner(t, s, big) {
  const b = $('banner');
  $('bannerT').textContent = t; $('bannerS').textContent = s || '';
  b.classList.remove('show', 'big'); void b.offsetWidth;
  b.classList.add('show'); if (big) b.classList.add('big');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show', 'big'), 3500);
}
function toast(msg, secs) {
  const box = $('toasts');
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 450); }, (secs || 3.2) * 1000);
}
function bossBar(on) { $('bossbar').hidden = !on; }

/* ---------- HUD ---------- */
const hc = {};
function setW(id, frac) { const v = Math.round(clamp(frac, 0, 1) * 1000) / 10; if (hc[id] !== v) { hc[id] = v; $(id).style.width = v + '%'; } }
function setT(id, txt) { txt = String(txt); if (hc[id + 't'] !== txt) { hc[id + 't'] = txt; $(id).textContent = txt; } }
function setHidden(id, h) { if (hc[id + 'h'] !== h) { hc[id + 'h'] = h; $(id).hidden = h; } }
function setCls(id, cls, on) { const k = id + cls; if (hc[k] !== on) { hc[k] = on; $(id).classList.toggle(cls, on); } }
function setCd(id, f) { const v = Math.round(clamp(f, 0, 1) * 50) / 50; if (hc[id + 'cd'] !== v) { hc[id + 'cd'] = v; $(id).style.setProperty('--cd', v); } }

function questText() {
  if (!G.flags.metJaci) return 'Fale com a Vó Jaci perto da fogueira';
  const ev = G.totems.find(t => t.state === 'event');
  if (ev) return `${ev.name}: resista às ondas (${Math.max(1, ev.wave)}/3)`;
  const n = awakeCount();
  if (n < 3) {
    const left = G.totems.filter(t => t.state !== 'awake').map(t => t.id === 'onca' ? 'Onça ao norte' : t.id === 'arara' ? 'Arara a leste' : 'Jabuti a oeste');
    return `Desperte os totens (${n}/3): ${left.join(', ')}`;
  }
  if (!G.flags.bossDone) return 'Enfrente o Boitatá na Clareira Queimada, ao sul';
  return 'A mata respira de novo. Explore à vontade';
}

function updateHUD() {
  setW('hHp', P.hp / P.hpMax); setW('hHpG', P.hp / P.hpMax);
  setT('hHpT', `${Math.max(0, Math.ceil(P.hp))} / ${P.hpMax}`);
  setW('hEn', P.en / P.enMax); setW('hXp', P.xp / xpNeed(P.lvl));
  setT('hLvl', P.lvl); setT('hSeeds', P.seeds); setT('hPots', P.potions); setT('potN', P.potions);
  setT('questText', questText());
  const sk = [['bS1', 'onca'], ['bS2', 'arara'], ['bS3', 'jabuti']];
  for (const [id, s] of sk) {
    setHidden(id, !P.skills[s]);
    if (P.skills[s]) { setCd(id, P.skillCd[s] / SKILLS[s].cd); setCls(id, 'low', P.en < SKILLS[s].cost); }
  }
  setCd('bDash', Math.max(0, P.dashCd) / P.st.dashCd);
  setCls('bPot', 'low', P.potions <= 0);
  const it = G.interact;
  setHidden('bAct', !it || G.state !== 'play');
  if (it) setT('bActT', it.kind === 'npc' ? 'Conversar' : 'Purificar');
  const B = G.boss;
  if (B && G.flags.bossStarted && B.alive) { setW('bossF', B.hp / B.hpMax); setW('bossG', B.hp / B.hpMax); }
}

/* ---------- minimapa ---------- */
const mm = $('minimap'), mctx = mm.getContext('2d');
const fogC = makeCanvas(64, 64), fogX = fogC.getContext('2d');
let fogImg = null, mmT = 0;
function initFog() {
  fogImg = fogX.createImageData(64, 64);
  for (let i = 0; i < 64 * 64; i++) { fogImg.data[i * 4 + 3] = G.explored[i] ? 0 : 215; fogImg.data[i * 4] = 4; fogImg.data[i * 4 + 1] = 12; fogImg.data[i * 4 + 2] = 9; }
  fogX.putImageData(fogImg, 0, 0);
}
function explore() {
  const R = 430, cs = 64;
  let changed = false;
  const x0 = clamp(((P.x - R) / cs) | 0, 0, 63), x1 = clamp(((P.x + R) / cs) | 0, 0, 63);
  const y0 = clamp(((P.y - R) / cs) | 0, 0, 63), y1 = clamp(((P.y + R) / cs) | 0, 0, 63);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * 64 + x;
    if (G.explored[i]) continue;
    if (dist((x + 0.5) * cs, (y + 0.5) * cs, P.x, P.y) < R) { G.explored[i] = 1; fogImg.data[i * 4 + 3] = 0; changed = true; }
  }
  if (changed) fogX.putImageData(fogImg, 0, 0);
}
function drawMinimap(dt) {
  mmT -= dt; if (mmT > 0) return; mmT = 0.12;
  const s = mm.width, view = 1900, px = view / CELL;
  mctx.setTransform(1, 0, 0, 1, 0, 0);
  mctx.fillStyle = '#081510'; mctx.fillRect(0, 0, s, s);
  mctx.imageSmoothingEnabled = true;
  const sx = P.x / CELL + 1 - px / 2, sy = P.y / CELL + 1 - px / 2;
  mctx.drawImage(F.canvas, sx, sy, px, px, 0, 0, s, s);
  mctx.fillStyle = 'rgba(6,16,12,0.25)'; mctx.fillRect(0, 0, s, s);
  const fpx = view / 64;
  mctx.drawImage(fogC, P.x / 64 - fpx / 2, P.y / 64 - fpx / 2, fpx, fpx, 0, 0, s, s);
  const k = s / view, cx = s / 2, cy = s / 2, rad = s / 2 - 7;
  const mark = (x, y, col, r, shape) => {
    let dx = (x - P.x) * k, dy = (y - P.y) * k;
    const d = Math.hypot(dx, dy);
    let edge = false;
    if (d > rad) { dx = dx / d * rad; dy = dy / d * rad; edge = true; }
    mctx.fillStyle = col; mctx.strokeStyle = 'rgba(0,0,0,0.75)'; mctx.lineWidth = 2;
    mctx.beginPath();
    if (shape === 'diamond') { const rr = edge ? r * 0.8 : r; mctx.moveTo(cx + dx, cy + dy - rr); mctx.lineTo(cx + dx + rr, cy + dy); mctx.lineTo(cx + dx, cy + dy + rr); mctx.lineTo(cx + dx - rr, cy + dy); mctx.closePath(); }
    else mctx.arc(cx + dx, cy + dy, edge ? r * 0.75 : r, 0, TAU);
    mctx.stroke(); mctx.fill();
  };
  const pulse = 0.7 + 0.3 * Math.sin(G.real * 4);
  mark(LOC.village.x, LOC.village.y, '#ffd27a', 4.5);
  for (const t of G.totems) mark(t.x, t.y, t.state === 'awake' ? rgb(GCOL[t.col]) : `rgba(190,110,255,${pulse})`, 5, 'diamond');
  if (G.flags.gateOpen) mark(LOC.arena.x, LOC.arena.y, G.flags.bossDone ? '#7fd8ff' : `rgba(255,90,40,${pulse})`, 6, 'diamond');
  for (const n of G.npcs) mark(n.x, n.y, '#f3ead7', 2.5);
  for (const e of G.enemies) if (!e.dead && e.aggro) { const dx = (e.x - P.x) * k, dy = (e.y - P.y) * k; if (Math.hypot(dx, dy) < rad) { mctx.fillStyle = '#c25cff'; mctx.fillRect(cx + dx - 1.5, cy + dy - 1.5, 3, 3); } }
  mctx.save(); mctx.translate(cx, cy); mctx.rotate(P.face + Math.PI / 2);
  mctx.fillStyle = '#41e0cf'; mctx.strokeStyle = '#04120d'; mctx.lineWidth = 2;
  mctx.beginPath(); mctx.moveTo(0, -7); mctx.lineTo(5, 5); mctx.lineTo(0, 2.5); mctx.lineTo(-5, 5); mctx.closePath(); mctx.stroke(); mctx.fill();
  mctx.restore();
}

/* ---------- diálogos ---------- */
const Dialog = {
  lines: [], i: 0, typed: 0, full: '', onEnd: null, choices: null,
  open(lines, onEnd) {
    this.lines = lines; this.i = 0; this.onEnd = onEnd || null;
    setState('dialog'); $('dialog').hidden = false; AudioSys.sfx('open');
    this.show();
  },
  show() {
    const L = this.lines[this.i];
    this.full = L.text; this.typed = 0;
    $('dlgName').textContent = L.who; $('dlgText').textContent = '';
    drawPortrait(L.p);
    $('dlgChoices').innerHTML = '';
    this.choices = L.choices || null;
    $('dlgNext').hidden = !!this.choices;
  },
  tick(dt) {
    if (this.typed >= this.full.length) return;
    const prev = Math.floor(this.typed);
    this.typed = Math.min(this.full.length, this.typed + dt * 55);
    const n = Math.floor(this.typed);
    if (n !== prev) { $('dlgText').textContent = this.full.slice(0, n); if (n % 4 === 0) AudioSys.sfx('talk'); }
    if (this.typed >= this.full.length) this.renderChoices();
  },
  renderChoices() {
    if (!this.choices) return;
    const box = $('dlgChoices'); box.innerHTML = '';
    this.choices.forEach((c, idx) => {
      const b = document.createElement('button');
      b.className = 'btn' + (idx === 0 ? ' primary' : '');
      b.textContent = c.label;
      b.addEventListener('click', ev => { ev.stopPropagation(); this.choose(idx); });
      box.appendChild(b);
    });
  },
  choose(idx) {
    const c = this.choices && this.choices[idx];
    if (!c) return;
    AudioSys.sfx('ui');
    this.close(); c.fn();
  },
  advance() {
    if (this.typed < this.full.length) { this.typed = this.full.length; $('dlgText').textContent = this.full; this.renderChoices(); return; }
    if (this.choices) return;
    this.i++;
    if (this.i >= this.lines.length) { const cb = this.onEnd; this.close(); if (cb) cb(); }
    else this.show();
  },
  close() { $('dialog').hidden = true; if (G.state === 'dialog') setState('play'); },
};
$('dialog').addEventListener('click', () => Dialog.advance());

function drawPortrait(id) {
  const c = $('portrait'), g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 128, 128);
  const s = 3.3;
  if (id === 'boita') {
    g.fillStyle = rgrad(g, 64, 64, 4, 64, [[0, '#fff6d0'], [0.4, '#7fd8ff'], [1, 'rgba(42,95,216,0)']]);
    g.fillRect(0, 0, 128, 128);
    for (const sx of [44, 84]) { g.fillStyle = '#fff'; ellipse(g, sx, 62, 12, 9); g.fill(); g.fillStyle = '#ffd27a'; ellipse(g, sx + 2, 62, 6, 7); g.fill(); }
    return;
  }
  g.setTransform(s, 0, 0, s, 64, 64 + 26 * s);
  if (id === 'kaua') drawHero(g, 0, 0, Object.assign({ face: Math.PI / 2, walkT: 0, moving: false, t: 0, atkAnim: 0, atkAngle: 0, swingDir: 1, scarf: [], spin: 0 }, HERO_LOOK));
  else drawNPC(g, { id, x: 0, y: 0, scarf: [] });
}

/* ---------- conversas ---------- */
function jaciHint() {
  const n = awakeCount();
  if (n === 0) return 'A Onça dorme ao norte. Siga a trilha que sai da fogueira e não pare de andar quando escurecer. Precisa de algo para a viagem?';
  if (n < 3) return `${n === 1 ? 'Um totem já canta' : 'Dois totens já cantam'}. Eu ouço daqui. Faltam ${3 - n}. Quer trocar Sementes de Luz?`;
  if (!G.flags.bossDone) return 'A barreira caiu. O Boitatá espera na Clareira Queimada, ao sul. Ele não é mau, menino. Está doente de névoa. Leve cuias.';
  return 'A mata canta de novo. Você pode descansar aqui sempre que quiser.';
}
function talkTo(n) {
  if (n.id === 'jaci') {
    if (!G.flags.metJaci) {
      Dialog.open([
        { who: 'Vó Jaci', p: 'jaci', text: 'Kauã, até que enfim acordou. Sente o cheiro de fumaça no vento? O Boitatá está queimando a mata.' },
        { who: 'Vó Jaci', p: 'jaci', text: 'A Névoa Roxa fez os três Totens dormirem. A Onça ao norte, na Mata Profunda. A Arara a leste, depois do igarapé. O Jabuti a oeste, nas Ruínas de Pedra.' },
        { who: 'Vó Jaci', p: 'jaci', text: 'Desperte os três e eles te emprestam a força dos antigos. Só assim a barreira de fogo ao sul vai se abrir.' },
        { who: 'Vó Jaci', p: 'jaci', text: 'Leve estas cuias de ervas e me traga Sementes de Luz, que eu preparo mais. Perto da fogueira você sempre se recupera. Vai com cuidado.' },
      ], () => { G.flags.metJaci = true; P.potions = P.potionsMax; toast('Você recebeu cuias de ervas'); saveGame(); });
    } else {
      Dialog.open([{ who: 'Vó Jaci', p: 'jaci', text: jaciHint(), choices: [{ label: 'Trocar sementes', fn: openShop }, { label: 'Até logo', fn: () => { } }] }]);
    }
  } else if (n.id === 'curu') {
    if (!G.flags.metCuru) {
      Dialog.open([
        { who: 'Curupira', p: 'curu', text: 'Hehe. Seguiu minhas pegadas? Elas apontam para trás, sabia? Quem segue o Curupira se perde.' },
        { who: 'Curupira', p: 'curu', text: 'Mas você cheira a fogueira da Vó Jaci. Eu deixo passar. O Totem da Onça fica no fim desta trilha, entre as samaúmas gigantes.' },
        { who: 'Curupira', p: 'curu', text: 'Toma, achei estas sementes por aí. E cuidado com o Casco-Bruto: quando ele bufa, saia da frente. Se ele bater numa árvore, fica tonto.' },
      ], () => { G.flags.metCuru = true; P.seeds += 30; toast('+30 Sementes de Luz'); AudioSys.sfx('potionGet'); saveGame(); });
    } else {
      Dialog.open([{ who: 'Curupira', p: 'curu', text: pick(['Os cogumelos daqui brilham quando a lua sobe. Bonito, né? Eu que acendo.', 'Esquivar é como eu ando: rápido e para o lado que ninguém espera.', 'Os morcegos-sombra rodeiam antes de mergulhar. Espere o mergulho e corte.', 'De noite aparecem mais bichos tortos. Mas também aparecem mais vaga-lumes.']) }]);
    }
  } else if (n.id === 'rai') {
    if (!G.flags.metRai) {
      Dialog.open([
        { who: 'Seu Raimundo', p: 'rai', text: 'Opa, Kauã. Esse igarapé sempre foi manso, mas agora os sapos brilham roxo e cospem lodo. Nem tucunaré quer morder a isca.' },
        { who: 'Seu Raimundo', p: 'rai', text: 'A Arara mora do outro lado da ponte, perto do lago das vitórias-régias grandes. Os sapos pulam longe, então chegue perto antes de bater.' },
      ], () => { G.flags.metRai = true; saveGame(); });
    } else {
      Dialog.open([{ who: 'Seu Raimundo', p: 'rai', text: pick(['Na cheia, o rio sobe até a porta da maloca. A gente aprendeu a construir alto.', 'Vitória-régia aguenta até criança pequena em cima, sabia? Mas não tenta não.', 'Quando o tempo fecha e trovoa, os bichos tortos ficam quietos um pouco. Aproveita.', 'Peguei um pirarucu deste tamanho uma vez. Ninguém acredita.']) }]);
    }
  }
}
function findInteract() {
  if (!P.alive) return null;
  let best = null, bd = 1e9;
  for (const n of G.npcs) { const d = dist(P.x, P.y, n.x, n.y); if (d < 66 && d < bd) { best = { kind: 'npc', o: n }; bd = d; } }
  for (const t of G.totems) { if (t.state !== 'corrupt') continue; const d = dist(P.x, P.y, t.x, t.y); if (d < 92 && d < bd) { best = { kind: 'totem', o: t }; bd = d; } }
  return best;
}
function doInteract() {
  const it = G.interact;
  if (!it) return false;
  if (it.kind === 'npc') talkTo(it.o); else startTotem(it.o);
  return true;
}

/* ---------- loja ---------- */
const SHOP_ITEMS = [
  { id: 'cuia', name: 'Cuia de Ervas', desc: 'Cura 45% da vida. Você carrega até 3.', icon: 'i-cuia', price: () => 25, can: () => P.potions < P.potionsMax, buy: () => { P.potions++; } },
  { id: 'blade', name: 'Afiar a Lâmina de Jaci', desc: '+4 de dano em todos os golpes.', icon: 'i-sword', price: () => 40 + G.shop.blade * 35, can: () => G.shop.blade < 8, buy: () => { G.shop.blade++; } },
  { id: 'necklace', name: 'Colar de Sementes', desc: '+20 de vida máxima, para sempre.', icon: 'i-heart', price: () => 35 + G.shop.necklace * 30, can: () => G.shop.necklace < 8, buy: () => { G.shop.necklace++; P.hpMax += 20; P.hp += 20; } },
];
function openShop() { setState('shop'); renderShop(); $('shop').hidden = false; AudioSys.sfx('open'); }
function closeShop() { $('shop').hidden = true; setState('play'); saveGame(); }
function renderShop() {
  $('shopSeeds').textContent = P.seeds;
  const box = $('shopList'); box.innerHTML = '';
  for (const it of SHOP_ITEMS) {
    const pr = it.price(), ok = it.can() && P.seeds >= pr;
    const row = document.createElement('div'); row.className = 'item';
    const lvl = it.id === 'blade' ? ` · nível ${G.shop.blade}` : it.id === 'necklace' ? ` · nível ${G.shop.necklace}` : ` · ${P.potions}/${P.potionsMax}`;
    row.innerHTML = `<div class="ic"><svg><use href="#${it.icon}"/></svg></div><div><h4>${it.name}</h4><p>${it.desc}${lvl}</p></div>`;
    const b = document.createElement('button'); b.className = 'btn' + (ok ? ' primary' : '');
    b.innerHTML = `<svg><use href="#i-seed"/></svg>${pr}`;
    b.disabled = !ok;
    b.setAttribute('aria-label', `Comprar ${it.name} por ${pr} sementes`);
    b.addEventListener('click', () => {
      if (!it.can() || P.seeds < it.price()) { AudioSys.sfx('deny'); return; }
      P.seeds -= it.price(); it.buy(); AudioSys.sfx('potionGet'); renderShop();
    });
    row.appendChild(b); box.appendChild(row);
  }
}
$('shopClose').addEventListener('click', () => { AudioSys.sfx('ui'); closeShop(); });

/* ---------- bênçãos ---------- */
let currentCards = [];
function openLevelUp() {
  G.pendingLevels = Math.max(0, G.pendingLevels - 1);
  const pool = BLESSINGS.filter(b => (P.blessings[b.id] || 0) < b.max && (!b.req || b.req()));
  for (let i = pool.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pool[i], pool[j]] = [pool[j], pool[i]]; }
  currentCards = pool.slice(0, 3);
  if (!currentCards.length) { P.hpMax += 10; P.hp = P.hpMax; return; }
  setState('levelup');
  $('lvN').textContent = 'Nível ' + P.lvl;
  const box = $('cards'); box.innerHTML = '';
  currentCards.forEach((b, i) => {
    const el = document.createElement('button'); el.className = 'card';
    const have = P.blessings[b.id] || 0;
    el.innerHTML = `<div class="ic"><svg><use href="#i-${b.icon}"/></svg></div><small>${have ? 'Nível ' + (have + 1) + ' de ' + b.max : 'Nova'}</small><h3>${b.name}</h3><p>${b.desc}</p><kbd>${i + 1}</kbd>`;
    el.addEventListener('click', () => chooseCard(i));
    box.appendChild(el);
  });
  $('levelup').hidden = false;
  setTimeout(() => { const f = box.querySelector('.card'); if (f && !IS_TOUCH) f.focus({ preventScroll: true }); }, 50);
}
function chooseCard(i) {
  const b = currentCards[i];
  if (!b || G.state !== 'levelup') return;
  b.apply(); P.blessings[b.id] = (P.blessings[b.id] || 0) + 1;
  $('levelup').hidden = true; AudioSys.sfx('ui');
  setState('play');
  toast(b.name + ' recebida');
  saveGame();
  if (G.pendingLevels > 0) G.levelT = 0.8;
}

/* ---------- pausa ---------- */
function fmtTime(s) { s = Math.floor(s); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}`; }
function statsHTML() {
  return `<div><b>${P.lvl}</b><span>Nível</span></div><div><b>${G.stats.kills}</b><span>Purificados</span></div><div><b>${awakeCount()}/3</b><span>Totens</span></div><div><b>${fmtTime(G.stats.time)}</b><span>Tempo</span></div>`;
}
const QNAMES = ['leves', 'equilibrados', 'caprichados'];
function qualLabel() { return 'Gráficos: ' + (G.autoQ ? 'automático (' + QNAMES[G.quality] + ')' : QNAMES[G.quality]); }
function pauseGame() {
  if (G.state !== 'play') return;
  setState('pause');
  $('pStats').innerHTML = statsHTML();
  $('pMusic').textContent = 'Música: ' + (AudioSys.musicOn ? 'ligada' : 'desligada');
  $('pSfx').textContent = 'Efeitos: ' + (AudioSys.sfxOn ? 'ligados' : 'desligados');
  $('pQual').textContent = qualLabel();
  $('pause').hidden = false;
  saveGame();
}
function resumeGame() { $('pause').hidden = true; setState('play'); AudioSys.sfx('ui'); }
$('pResume').addEventListener('click', resumeGame);
$('pMusic').addEventListener('click', () => { const on = AudioSys.toggleMusic(); $('pMusic').textContent = 'Música: ' + (on ? 'ligada' : 'desligada'); });
$('pSfx').addEventListener('click', () => { const on = AudioSys.toggleSfx(); $('pSfx').textContent = 'Efeitos: ' + (on ? 'ligados' : 'desligados'); });
$('pQual').addEventListener('click', () => {
  if (G.autoQ) { G.autoQ = false; G.quality = 2; } else if (G.quality > 0) G.quality--; else { G.autoQ = true; G.quality = IS_TOUCH ? 1 : 2; }
  store.set('kaa-q', G.autoQ ? 'auto' : String(G.quality));
  resize(); $('pQual').textContent = qualLabel(); AudioSys.sfx('ui');
});
$('pHow').addEventListener('click', () => { $('howto').hidden = false; howFrom = 'pause'; });
$('pQuit').addEventListener('click', () => { saveGame(); $('pause').hidden = true; toTitle(); });
let howFrom = 'title';
$('howClose').addEventListener('click', () => { $('howto').hidden = true; AudioSys.sfx('ui'); });

/* ---------- história ---------- */
const STORY_TXT = [
  'Há muitas luas, o Boitatá, a grande serpente de fogo, vigiava a mata. Quem queimava a floresta encontrava os olhos dele no escuro.',
  'Então veio a Névoa Roxa, trazida pela ganância. Ela adoeceu o guardião e fez os três Totens ancestrais adormecerem.',
  'Você é Kauã, aprendiz da Vó Jaci. Nesta tarde a floresta acordou você por um motivo.',
];
const Story = {
  i: 0,
  start() { this.i = 0; setState('story'); $('story').hidden = false; this.render(); },
  render() { $('storyN').textContent = ['I', 'II', 'III'][this.i]; $('storyT').textContent = STORY_TXT[this.i]; const el = $('storyT'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = 'toast .6s ease'; },
  next() {
    AudioSys.sfx('ui');
    this.i++;
    if (this.i >= STORY_TXT.length) {
      $('story').hidden = true; setState('play');
      if (IS_TOUCH && innerHeight > innerWidth) { $('rotate').hidden = false; setTimeout(() => { $('rotate').hidden = true; }, 5000); }
    } else this.render();
  },
};
$('story').addEventListener('click', () => Story.next());
