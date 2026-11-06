/* ============================================================
   Estado do jogo, jogador, inimigos, combate, totens, Boitatá
   ============================================================ */
const G = {
  state: 'loading', t: 0, real: 0, started: false, hitstop: 0, timeScale: 1, slowT: 0,
  enemies: [], projs: [], parts: [], texts: [], pickups: [], hazards: [], slashes: [], afterimages: [],
  npcs: [], totems: [], boss: null,
  tod: 0.66, amb: [255, 230, 200], dark: 0,
  weather: { rain: 0, target: 0, t: 90, flash: 0, bolt: 0 },
  quality: 2, autoQ: true, spawnT: 2, stats: { kills: 0, time: 0, deaths: 0 },
  flags: { metJaci: false, metCuru: false, metRai: false, gateOpen: false, bossDone: false, bossStarted: false, gateAnnounced: false },
  explored: new Uint8Array(64 * 64), shop: { blade: 0, necklace: 0 },
  cam: { x: 2048, y: 2048, shake: 0 }, interact: null, pendingLevels: 0, levelT: 0, hurtFlash: 0, combat: 0,
  saveT: 0, exploreT: 0,
};

const P = {};
function resetPlayer() {
  Object.assign(P, {
    x: 2048, y: 2125, vx: 0, vy: 0, r: 11, face: Math.PI / 2, alive: true,
    hp: 100, hpMax: 100, en: 100, enMax: 100, lvl: 1, xp: 0, seeds: 0, potions: 2, potionsMax: 3,
    atkCd: 0, combo: 0, comboT: 0, atkAnim: 0, atkAngle: 0, swingDir: 1,
    dashCd: 0, dashT: 0, dashDir: 0, inv: 0, hurtT: 0, shield: 0, shieldT: 0, walkT: 0,
    skills: { onca: false, arara: false, jabuti: false }, skillCd: { onca: 0, arara: 0, jabuti: 0 },
    st: { dmg: 16, dmgMul: 1, crit: 0.08, atkSpeed: 1, range: 50, speed: 150, dashCd: 0.7, lifesteal: 0, regen: 0, enRegen: 9, magnet: 70, burn: 0, armor: 0, feathers: 3, clawMul: 1 },
    blessings: {}, scarf: [], deadT: 0, spinT: 0,
  });
  for (let i = 0; i < 7; i++) P.scarf.push({ x: P.x, y: P.y - 18, px: P.x, py: P.y - 18 });
}

const xpNeed = l => Math.round(40 + 28 * (l - 1) + 6 * (l - 1) * (l - 1));
const bladeDmg = () => (P.st.dmg + G.shop.blade * 4) * P.st.dmgMul;

const BLESSINGS = [
  { id: 'forca', name: 'Força da Sucuri', desc: '+18% de dano com a lâmina.', icon: 'sword', max: 5, apply: () => { P.st.dmgMul += 0.18; } },
  { id: 'vida', name: 'Coração de Castanheira', desc: '+25 de vida máxima e cura completa.', icon: 'heart', max: 6, apply: () => { P.hpMax += 25; P.hp = P.hpMax; } },
  { id: 'agil', name: 'Pés de Guará', desc: '+10% de velocidade de movimento.', icon: 'wind', max: 3, apply: () => { P.st.speed *= 1.1; } },
  { id: 'ritmo', name: 'Ritmo do Tambor', desc: 'Ataques 14% mais rápidos.', icon: 'drum', max: 4, apply: () => { P.st.atkSpeed *= 1.14; } },
  { id: 'critico', name: 'Olho de Gavião', desc: '+8% de chance de golpe crítico.', icon: 'eye', max: 4, apply: () => { P.st.crit += 0.08; } },
  { id: 'alcance', name: 'Lâmina Longa', desc: '+15% de alcance dos golpes.', icon: 'arc', max: 3, apply: () => { P.st.range *= 1.15; } },
  { id: 'seiva', name: 'Seiva Viva', desc: 'Recupera 4% do dano causado como vida.', icon: 'drop', max: 3, apply: () => { P.st.lifesteal += 0.04; } },
  { id: 'brasa', name: 'Lâmina de Brasa', desc: 'Golpes queimam o inimigo por 3 segundos.', icon: 'flame', max: 3, apply: () => { P.st.burn += 1; } },
  { id: 'ima', name: 'Raiz-Ímã', desc: 'Atrai Sementes de Luz de bem mais longe.', icon: 'magnet', max: 2, apply: () => { P.st.magnet *= 1.8; } },
  { id: 'folego', name: 'Fôlego do Boto', desc: '+25 de energia máxima e recarga mais rápida.', icon: 'bolt', max: 3, apply: () => { P.enMax += 25; P.en = P.enMax; P.st.enRegen *= 1.25; } },
  { id: 'esquiva', name: 'Salto do Macaco', desc: 'A esquiva recarrega 25% mais rápido.', icon: 'dash', max: 3, apply: () => { P.st.dashCd *= 0.75; } },
  { id: 'regen', name: 'Chá de Jambu', desc: 'Regenera 1 de vida por segundo.', icon: 'leaf', max: 3, apply: () => { P.st.regen += 1; } },
  { id: 'casca', name: 'Casca de Jatobá', desc: 'Recebe 10% menos dano.', icon: 'shield', max: 3, apply: () => { P.st.armor += 0.1; } },
  { id: 'penas', name: 'Revoada', desc: 'Penas da Arara dispara 2 penas a mais.', icon: 'feather', max: 2, req: () => P.skills.arara, apply: () => { P.st.feathers += 2; } },
  { id: 'garra', name: 'Fúria da Onça', desc: 'Garra da Onça: +35% de dano e de raio.', icon: 'claw', max: 2, req: () => P.skills.onca, apply: () => { P.st.clawMul += 0.35; } },
];

/* ---------- partículas ---------- */
function particle(o) {
  const cap = [260, 520, 820][G.quality];
  if (G.parts.length >= cap && !o.force) return null;
  const p = Object.assign({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 2, life: 1, size: 3, grow: 0, type: 'dot', col: '#fff', glow: false, rot: 0, vr: 0, a: 1 }, o);
  p.max = p.life;
  G.parts.push(p);
  return p;
}
function burst(x, y, n, o) {
  for (let i = 0; i < n; i++) {
    const a = (o.ang !== undefined ? o.ang + (Math.random() - 0.5) * (o.spread || TAU) : Math.random() * TAU);
    const s = rand(o.smin || 40, o.smax || 160);
    particle(Object.assign({}, o, { x: x + rand(-2, 2), y: y + rand(-2, 2), vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(o.lmin || 0.3, o.lmax || 0.7) }));
  }
}
function dmgText(x, y, txt, col, big) {
  G.texts.push({ x: x + rand(-6, 6), y, vy: -46, txt: String(txt), col, life: 0.9, max: 0.9, big: !!big });
}
function whenPlay(fn, delay) {
  setTimeout(function tryRun() { if (G.state === 'play') fn(); else if (G.started) setTimeout(tryRun, 300); }, delay || 0);
}
function shake(n) { if (!REDUCED_MOTION) G.cam.shake = Math.max(G.cam.shake, n); }

/* ---------- jogador ---------- */
function nearestEnemy(x, y, maxD) {
  let best = null, bd = maxD;
  for (const e of G.enemies) { if (e.dead || e.spawnT > 0) continue; const d = dist(x, y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
  if (G.boss && G.boss.vulnerable) {
    for (const s of G.boss.segs) { const d = dist(x, y, s.x, s.y) - s.r; if (d < bd) { bd = d; best = s; } }
  }
  return best;
}

function playerAttack(aim) {
  if (P.atkCd > 0 || P.dashT > 0 || !P.alive) return false;
  P.combo = P.comboT > 0 ? (P.combo + 1) % 3 : 0;
  const heavy = P.combo === 2;
  let ang = aim !== undefined && aim !== null ? aim : P.face;
  if (aim === undefined || aim === null) {
    const tgt = nearestEnemy(P.x, P.y, 160);
    if (tgt) {
      const a = Math.atan2(tgt.y - (tgt.hh ? tgt.hh * 0.3 : 0) - P.y, tgt.x - P.x);
      const mv = Input.move();
      if (mv.mag < 0.25 || Math.abs(angDiff(Math.atan2(mv.y, mv.x), a)) < 1.25) ang = a;
    }
  }
  P.face = ang; P.atkAngle = ang; P.atkAnim = 0.22; P.swingDir = -P.swingDir;
  P.atkCd = (heavy ? 0.46 : 0.28) / P.st.atkSpeed;
  P.comboT = P.atkCd + 0.38;
  const lunge = heavy ? 250 : 130;
  P.vx += Math.cos(ang) * lunge; P.vy += Math.sin(ang) * lunge;
  const range = P.st.range * (heavy ? 1.28 : 1), arc = heavy ? 2.9 : 2.15;
  G.slashes.push({ x: P.x, y: P.y - 12, ang, range, arc, t: 0, dur: heavy ? 0.24 : 0.18, dir: P.swingDir, heavy, col: P.st.burn > 0 ? 'fire' : 'cyan' });
  const dmg = bladeDmg() * (heavy ? 1.7 : 1);
  const hits = hitArc(P.x, P.y - 10, ang, range, arc, dmg, { kb: heavy ? 330 : 170, heavy, melee: true });
  AudioSys.sfx(heavy ? 'swingHeavy' : 'swing');
  return hits;
}

function hitArc(x, y, ang, range, arc, dmg, o) {
  let hits = 0;
  for (const e of G.enemies) {
    if (e.dead || e.spawnT > 0) continue;
    const ey = e.y - e.hh * 0.6 - (e.z || 0) * 0.5;
    const d = dist(x, y, e.x, ey);
    if (d > range + e.r) continue;
    const a = Math.atan2(ey - y, e.x - x);
    if (d > e.r + 10 && Math.abs(angDiff(ang, a)) > arc / 2) continue;
    damageEnemy(e, dmg, a, o); hits++;
  }
  const B = G.boss;
  if (B && B.vulnerable) {
    let best = 0;
    for (const s of B.segs) {
      const d = dist(x, y, s.x, s.y - 8);
      if (d > range + s.r) continue;
      const a = Math.atan2(s.y - 8 - y, s.x - x);
      if (d > s.r + 10 && Math.abs(angDiff(ang, a)) > arc / 2) continue;
      best = Math.max(best, s.i === 0 ? 1.5 : 0.75);
    }
    if (best > 0) { damageBoss(dmg * best, o, ang); hits++; }
  }
  if (hits && o.melee) { P.en = Math.min(P.enMax, P.en + 3 * hits); }
  return hits;
}

function rollDmg(dmg) {
  const crit = Math.random() < P.st.crit;
  return { v: Math.max(1, Math.round(dmg * (crit ? 1.8 : 1) * (0.9 + Math.random() * 0.2))), crit };
}

function damageEnemy(e, dmg, ang, o) {
  const r = o.fixed ? { v: Math.round(dmg), crit: false } : rollDmg(dmg);
  e.hp -= r.v; e.flash = 0.13;
  const kb = (o.kb || 120) * e.kbRes;
  e.kbx = Math.cos(ang) * kb; e.kby = Math.sin(ang) * kb;
  if (e.type !== 'bruto' || o.heavy) e.stun = Math.max(e.stun, o.heavy ? 0.38 : 0.2);
  if (o.melee && P.st.burn > 0) { e.burn = 3; e.burnDmg = 3 * P.st.burn; }
  if (P.st.lifesteal > 0) P.hp = Math.min(P.hpMax, P.hp + r.v * P.st.lifesteal);
  e.aggro = true;
  dmgText(e.x, e.y - e.hh - 18 - (e.z || 0), r.v, r.crit ? '#ffd27a' : '#ffffff', r.crit);
  burst(e.x, e.y - e.hh * 0.6 - (e.z || 0), r.crit ? 12 : 7, { type: 'spark', glow: true, col: r.crit ? 'gold' : 'cyan', ang, spread: 1.6, smin: 120, smax: 320, lmin: 0.12, lmax: 0.3, drag: 6 });
  particle({ x: e.x, y: e.y - e.hh * 0.6, type: 'smoke', sp: 'p', size: 10, grow: 30, life: 0.5, vx: Math.cos(ang) * 30, vy: Math.sin(ang) * 30 - 10 });
  G.hitstop = Math.max(G.hitstop, r.crit ? 0.075 : 0.045);
  shake(r.crit ? 5 : 3);
  AudioSys.sfx(r.crit ? 'crit' : 'hit');
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  if (e.dead) return;
  e.dead = true;
  G.stats.kills++;
  const y = e.y - e.hh * 0.6 - (e.z || 0);
  for (let i = 0; i < 9; i++) particle({ x: e.x + rand(-8, 8), y: y + rand(-8, 8), type: 'smoke', sp: 'p', size: rand(8, 16), grow: 40, life: rand(0.5, 0.9), vx: rand(-40, 40), vy: rand(-50, 10) });
  for (let i = 0; i < 10; i++) particle({ x: e.x + rand(-10, 10), y: y + rand(-6, 6), type: 'mote', glow: true, col: Math.random() < 0.5 ? 'cyan' : 'gold', size: rand(2, 4), life: rand(0.9, 1.6), vx: rand(-20, 20), vy: rand(-70, -30), drag: 0.6 });
  particle({ x: e.x, y, type: 'ring', glow: true, col: 'teal', size: 6, size2: 46, life: 0.35 });
  const def = ET[e.type];
  const n = randi(def.seeds[0], def.seeds[1]);
  for (let i = 0; i < n; i++) dropPickup('seed', e.x, e.y, 1);
  if (Math.random() < 0.035 + (P.hp < P.hpMax * 0.35 ? 0.05 : 0)) dropPickup('potion', e.x, e.y, 1);
  gainXp(Math.round(def.xp * (1 + (e.diff || 0))));
  AudioSys.sfx('die');
}

function dropPickup(type, x, y, val) {
  const a = Math.random() * TAU, s = rand(30, 110);
  G.pickups.push({ type, x, y, z: 6, vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rand(90, 170), val, t: 0, pull: false });
}

function gainXp(n) {
  P.xp += n;
  while (P.xp >= xpNeed(P.lvl)) { P.xp -= xpNeed(P.lvl); P.lvl++; G.pendingLevels++; G.levelT = 0.45; }
}

function hurtPlayer(dmg, sx, sy) {
  if (P.inv > 0 || P.dashT > 0 || !P.alive || G.state !== 'play') return false;
  dmg *= (1 - Math.min(0.6, P.st.armor));
  if (P.shield > 0) {
    const a = Math.min(P.shield, dmg); P.shield -= a; dmg -= a;
    burst(P.x, P.y - 14, 8, { type: 'spark', glow: true, col: 'green', smin: 80, smax: 200, lmin: 0.15, lmax: 0.3 });
    AudioSys.sfx('shieldHit');
    if (dmg <= 0.5) { P.inv = 0.25; return false; }
  }
  dmg = Math.max(1, Math.round(dmg));
  P.hp -= dmg; P.inv = 0.75; P.hurtT = 0.3;
  if (sx !== undefined) { const a = Math.atan2(P.y - sy, P.x - sx); P.vx += Math.cos(a) * 260; P.vy += Math.sin(a) * 260; }
  dmgText(P.x, P.y - 40, dmg, '#ff6b5a', false);
  burst(P.x, P.y - 16, 10, { type: 'spark', glow: true, col: 'red', smin: 80, smax: 220, lmin: 0.15, lmax: 0.35 });
  shake(8); G.hitstop = Math.max(G.hitstop, 0.06); G.hurtFlash = 1;
  AudioSys.sfx('hurt');
  if (navigator.vibrate && IS_TOUCH) { try { navigator.vibrate(40); } catch (e) { /* */ } }
  if (P.hp <= 0) playerDie();
  return true;
}

function playerDie() {
  P.hp = 0; P.alive = false; P.deadT = 0;
  G.slowT = 1.4; G.stats.deaths++;
  for (let i = 0; i < 20; i++) particle({ x: P.x + rand(-10, 10), y: P.y - 16 + rand(-10, 10), type: 'mote', glow: true, col: 'teal', size: rand(2, 4), life: rand(1, 2), vx: rand(-30, 30), vy: rand(-80, -30), drag: 0.5, force: true });
  AudioSys.sfx('death');
}

function playerDash() {
  if (P.dashCd > 0 || P.dashT > 0 || !P.alive) return;
  const mv = Input.move();
  P.dashDir = mv.mag > 0.2 ? Math.atan2(mv.y, mv.x) : P.face;
  P.dashT = 0.19; P.dashCd = P.st.dashCd; P.inv = Math.max(P.inv, 0.24);
  burst(P.x, P.y - 4, 8, { type: 'leaf', col: '#7fc35a', smin: 40, smax: 120, lmin: 0.4, lmax: 0.8, g: 200, vz: 60 });
  AudioSys.sfx('dash');
}

function usePotion() {
  if (P.potions <= 0 || P.hp >= P.hpMax || !P.alive) { AudioSys.sfx('deny'); return; }
  P.potions--; const heal = Math.round(P.hpMax * 0.45);
  P.hp = Math.min(P.hpMax, P.hp + heal);
  dmgText(P.x, P.y - 44, '+' + heal, '#7dffb0', true);
  for (let i = 0; i < 16; i++) particle({ x: P.x + rand(-14, 14), y: P.y - rand(0, 30), type: 'mote', glow: true, col: 'green', size: rand(2, 4), life: rand(0.6, 1.1), vy: rand(-80, -30), drag: 1 });
  AudioSys.sfx('potion');
}

const SKILLS = {
  onca: { name: 'Garra da Onça', cost: 30, cd: 4 },
  arara: { name: 'Penas da Arara', cost: 18, cd: 1.1 },
  jabuti: { name: 'Casco do Jabuti', cost: 40, cd: 12 },
};
function useSkill(id) {
  if (!P.alive || !P.skills[id]) return;
  const S = SKILLS[id];
  if (P.skillCd[id] > 0 || P.en < S.cost) { AudioSys.sfx('deny'); return; }
  P.en -= S.cost; P.skillCd[id] = S.cd;
  if (id === 'onca') {
    const R = 98 * (0.85 + 0.15 * P.st.clawMul);
    P.spinT = 0.38; P.inv = Math.max(P.inv, 0.3);
    G.slashes.push({ x: P.x, y: P.y - 12, ang: P.face, range: R, arc: TAU, t: 0, dur: 0.38, dir: 1, heavy: true, col: 'gold', spin: true });
    hitArc(P.x, P.y - 10, P.face, R, TAU, bladeDmg() * 2.3 * P.st.clawMul, { kb: 420, heavy: true });
    particle({ x: P.x, y: P.y - 8, type: 'ring', glow: true, col: 'gold', size: 20, size2: R + 20, life: 0.4 });
    shake(7); AudioSys.sfx('claw');
  } else if (id === 'arara') {
    const n = P.st.feathers, base = P.face;
    const tgt = nearestEnemy(P.x, P.y, 420);
    const aim = tgt ? Math.atan2(tgt.y - P.y - 6, tgt.x - P.x) : base;
    P.face = aim;
    const cols = ['red', 'gold', 'blue'];
    for (let i = 0; i < n; i++) {
      const a = aim + (i - (n - 1) / 2) * 0.2;
      G.projs.push({ type: 'feather', owner: 'p', x: P.x + Math.cos(a) * 14, y: P.y - 16 + Math.sin(a) * 14, vx: Math.cos(a) * 470, vy: Math.sin(a) * 470, r: 7, dmg: bladeDmg() * 1.05, life: 1.1, home: 4.5, col: cols[i % 3], ang: a });
    }
    AudioSys.sfx('feather');
  } else if (id === 'jabuti') {
    P.shield = 60 + P.hpMax * 0.2; P.shieldT = 6;
    P.hp = Math.min(P.hpMax, P.hp + 15);
    dmgText(P.x, P.y - 44, '+15', '#7dffb0', false);
    particle({ x: P.x, y: P.y - 14, type: 'ring', glow: true, col: 'green', size: 10, size2: 60, life: 0.45 });
    AudioSys.sfx('shell');
  }
}

function updatePlayer(dt) {
  P.hurtT = Math.max(0, P.hurtT - dt);
  if (!P.alive) { P.deadT += dt; P.vx *= 0.9; P.vy *= 0.9; return; }
  P.atkCd -= dt; P.comboT -= dt; P.atkAnim = Math.max(0, P.atkAnim - dt); P.dashCd -= dt; P.inv -= dt; P.spinT = Math.max(0, P.spinT - dt);
  for (const k in P.skillCd) P.skillCd[k] = Math.max(0, P.skillCd[k] - dt);
  if (P.shieldT > 0) { P.shieldT -= dt; if (P.shieldT <= 0) P.shield = 0; }
  const mv = Input.move();
  if (P.dashT > 0) {
    P.dashT -= dt;
    P.vx = Math.cos(P.dashDir) * 560; P.vy = Math.sin(P.dashDir) * 560;
    if (Math.random() < 0.7) G.afterimages.push({ x: P.x, y: P.y, face: P.face, life: 0.22, max: 0.22 });
  } else {
    const spd = P.st.speed * (P.atkAnim > 0 ? 0.5 : 1) * (P.spinT > 0 ? 0.7 : 1);
    const tx = mv.x * spd, ty = mv.y * spd;
    const k = 1 - Math.exp(-dt * 13);
    P.vx += (tx - P.vx) * k; P.vy += (ty - P.vy) * k;
    if (mv.mag > 0.15 && P.atkAnim <= 0) P.face = Math.atan2(mv.y, mv.x);
  }
  moveEntity(P, P.vx * dt, P.vy * dt);
  for (const b of G.npcs.concat(G.totems)) {
    const dx = P.x - b.x, dy = P.y - b.y, rr = P.r + (b.cr || 12), d = Math.hypot(dx, dy);
    if (d < rr && d > 0.01) { P.x = b.x + dx / d * rr; P.y = b.y + dy / d * rr; }
  }
  const sp = Math.hypot(P.vx, P.vy);
  P.walkT += dt * sp / 26;
  if (sp > 60 && Math.random() < dt * 6 && P.dashT <= 0) {
    const k = kindAt(P.x, P.y);
    const col = k === 1 || k === 6 ? 'rgba(150,120,80,0.5)' : k === 5 ? 'rgba(90,80,80,0.5)' : k === 2 ? 'rgba(200,180,130,0.5)' : null;
    if (col) particle({ x: P.x + rand(-4, 4), y: P.y, type: 'smoke', sp: 'd', tint: col, size: 4, grow: 14, life: 0.45, vx: -P.vx * 0.1, vy: -6 });
  }
  P.en = Math.min(P.enMax, P.en + P.st.enRegen * dt);
  if (P.st.regen) P.hp = Math.min(P.hpMax, P.hp + P.st.regen * dt);
  if (dist(P.x, P.y, LOC.village.x, LOC.village.y) < VILLAGE_R && G.combat < 0.1) P.hp = Math.min(P.hpMax, P.hp + 5 * dt);
  // cachecol (verlet)
  const nx = P.x - Math.cos(P.face) * 3, ny = P.y - 19;
  const sc = P.scarf;
  sc[0].x = nx; sc[0].y = ny;
  const wind = Math.sin(G.t * 2.1) * 8;
  for (let i = 1; i < sc.length; i++) {
    const s = sc[i];
    const vx = (s.x - s.px) * 0.86, vy = (s.y - s.py) * 0.86;
    s.px = s.x; s.py = s.y;
    s.x += vx + (wind * 0.02); s.y += vy + 0.22;
  }
  for (let it = 0; it < 2; it++) for (let i = 1; i < sc.length; i++) {
    const a = sc[i - 1], b = sc[i];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, L = 4.2;
    b.x = a.x + dx / d * L; b.y = a.y + dy / d * L;
  }
}

/* ---------- inimigos ---------- */
const ET = {
  espinho: { name: 'Espinhudo', hp: 42, dmg: 10, spd: 74, r: 13, hh: 12, xp: 8, seeds: [1, 3], kbRes: 1 },
  morcego: { name: 'Morcego-Sombra', hp: 26, dmg: 8, spd: 150, r: 11, hh: 8, xp: 10, seeds: [1, 3], kbRes: 1.2, flying: true },
  sapo: { name: 'Sapo-Lodo', hp: 46, dmg: 11, spd: 90, r: 13, hh: 10, xp: 12, seeds: [2, 4], kbRes: 0.9 },
  bruto: { name: 'Casco-Bruto', hp: 175, dmg: 22, spd: 52, r: 22, hh: 22, xp: 34, seeds: [6, 10], kbRes: 0.25 },
  fatuo: { name: 'Fogo-Fátuo', hp: 36, dmg: 13, spd: 80, r: 12, hh: 10, xp: 14, seeds: [2, 4], kbRes: 1, flying: true },
};

function spawnEnemy(type, x, y, opts) {
  const def = ET[type];
  const R = regionW(x, y);
  const diff = 0.25 * R.north + 0.2 * R.west + 0.22 * R.east + 0.45 * R.ash + ((opts && opts.diff) || 0);
  const k = 1 + 0.13 * (P.lvl - 1) + diff;
  const e = Object.assign({
    type, x, y, vx: 0, vy: 0, r: def.r, hh: def.hh, hp: def.hp * k, hpMax: def.hp * k, dmg: def.dmg * (1 + 0.07 * (P.lvl - 1) + diff * 0.6),
    spd: def.spd, kbRes: def.kbRes, flying: !!def.flying, z: def.flying ? 18 : 0, st: 'idle', timer: 0, t: Math.random() * 10,
    flash: 0, stun: 0, kbx: 0, kby: 0, aggro: false, burn: 0, burnTick: 0.5, burnDmg: 0, hitCd: 0, face: 0, diff,
    wa: 0, wt: 0, wm: false, oa: Math.random() * TAU, dirSign: Math.random() < 0.5 ? -1 : 1, atkT: rand(1, 2.5), shootT: rand(1, 2.5), hopT: 0, blinkT: rand(3, 6),
    chargeCd: 1, slamCd: 0, spawnT: 0.6,
  }, opts || {});
  G.enemies.push(e);
  particle({ x, y: y - 6, type: 'ring', glow: true, col: 'purple', size: 4, size2: 34, life: 0.5 });
  for (let i = 0; i < 5; i++) particle({ x: x + rand(-8, 8), y: y - rand(0, 14), type: 'smoke', sp: 'p', size: rand(8, 14), grow: 26, life: rand(0.5, 0.8), vy: rand(-30, -10) });
  return e;
}

function enemyMoveToward(e, tx, ty, spd, dt) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
  e.face = Math.atan2(dy, dx);
  moveEntity(e, dx / d * spd * dt, dy / d * spd * dt);
}
function contact(e, dmg, extra) {
  if (e.hitCd > 0) return;
  const d = dist(e.x, e.y, P.x, P.y);
  if (d < e.r + P.r + (extra || 0)) { if (hurtPlayer(dmg, e.x, e.y)) e.hitCd = 0.6; }
}

const AI = {
  espinho(e, dt, dx, dy, d) {
    switch (e.st) {
      case 'idle': case 'chase': {
        e.st = 'chase';
        const hop = 0.55 + 0.45 * Math.abs(Math.sin(e.t * 7));
        enemyMoveToward(e, P.x, P.y, e.spd * hop, dt);
        if (d < 72) { e.st = 'wind'; e.timer = 0.42; }
        break;
      }
      case 'wind': e.timer -= dt; e.face = Math.atan2(dy, dx); if (e.timer <= 0) { e.st = 'lunge'; e.timer = 0.26; e.la = Math.atan2(dy, dx); AudioSys.sfx('lunge'); } break;
      case 'lunge':
        e.timer -= dt; moveEntity(e, Math.cos(e.la) * 330 * dt, Math.sin(e.la) * 330 * dt); contact(e, e.dmg);
        if (e.timer <= 0) { e.st = 'rest'; e.timer = 0.7; }
        break;
      case 'rest': e.timer -= dt; if (e.timer <= 0) e.st = 'chase'; break;
    }
  },
  morcego(e, dt, dx, dy, d) {
    e.z = 20 + Math.sin(e.t * 6) * 4;
    switch (e.st) {
      case 'idle': case 'orbit': {
        e.st = 'orbit';
        e.oa += dt * 1.5 * e.dirSign;
        const tx = P.x + Math.cos(e.oa) * 135, ty = P.y + Math.sin(e.oa) * 110;
        enemyMoveToward(e, tx, ty, e.spd, dt);
        e.atkT -= dt;
        if (e.atkT <= 0 && d < 280) { e.st = 'swind'; e.timer = 0.38; }
        break;
      }
      case 'swind': e.timer -= dt; if (e.timer <= 0) { e.st = 'swoop'; e.timer = 0.5; e.la = Math.atan2(dy, dx); AudioSys.sfx('bat'); } break;
      case 'swoop':
        e.timer -= dt; e.z = Math.max(6, e.z - 60 * dt);
        moveEntity(e, Math.cos(e.la) * 360 * dt, Math.sin(e.la) * 360 * dt); contact(e, e.dmg, 4);
        if (e.timer <= 0) { e.st = 'orbit'; e.atkT = rand(1.6, 3); }
        break;
    }
  },
  sapo(e, dt, dx, dy, d) {
    e.hopV = (e.hopV || 0) * Math.exp(-dt * 5);
    switch (e.st) {
      case 'idle': case 'keep': {
        e.st = 'keep';
        e.hopT -= dt;
        if (e.hopT <= 0) {
          e.hopT = rand(0.7, 1.2);
          let a = Math.atan2(dy, dx);
          if (d < 150) a += Math.PI; else if (d < 240) a += (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
          e.hopA = a; e.hopV = 240; e.jumpT = 0.35;
        }
        if (e.hopV > 5) moveEntity(e, Math.cos(e.hopA) * e.hopV * dt, Math.sin(e.hopA) * e.hopV * dt);
        e.jumpT = Math.max(0, (e.jumpT || 0) - dt);
        e.face = Math.atan2(dy, dx);
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 400) { e.st = 'spit'; e.timer = 0.55; }
        break;
      }
      case 'spit':
        e.timer -= dt; e.face = Math.atan2(dy, dx);
        if (e.timer <= 0) {
          const a = Math.atan2(P.y - 8 - (e.y - 10), P.x - e.x);
          G.projs.push({ type: 'goo', owner: 'e', x: e.x + Math.cos(a) * 12, y: e.y - 10, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, r: 7, dmg: e.dmg, life: 1.8 });
          AudioSys.sfx('goo');
          e.shootT = rand(2, 3); e.st = 'keep';
        }
        break;
    }
  },
  bruto(e, dt, dx, dy, d) {
    e.chargeCd -= dt; e.slamCd -= dt;
    switch (e.st) {
      case 'idle': case 'chase':
        e.st = 'chase';
        enemyMoveToward(e, P.x, P.y, e.spd, dt);
        if (d < 78 && e.slamCd <= 0) { e.st = 'swind'; e.timer = 0.65; }
        else if (d < 280 && d > 100 && e.chargeCd <= 0) { e.st = 'cwind'; e.timer = 0.85; }
        break;
      case 'cwind':
        e.timer -= dt; e.la = Math.atan2(dy, dx); e.face = e.la;
        if (Math.random() < 0.3) particle({ x: e.x + rand(-14, 14), y: e.y, type: 'smoke', sp: 'd', tint: 'rgba(120,100,80,0.5)', size: 6, grow: 20, life: 0.5, vy: -10 });
        if (e.timer <= 0) { e.st = 'charge'; e.timer = 0.8; AudioSys.sfx('roar'); }
        break;
      case 'charge':
        e.timer -= dt;
        e.hitWall = false;
        e.onWall = () => { e.hitWall = true; };
        e.onBump = p => { if (p.r > 7) e.hitWall = true; };
        moveEntity(e, Math.cos(e.la) * 410 * dt, Math.sin(e.la) * 410 * dt);
        e.onWall = null; e.onBump = null;
        contact(e, e.dmg, 6);
        if (Math.random() < 0.6) particle({ x: e.x, y: e.y, type: 'smoke', sp: 'd', tint: 'rgba(120,100,80,0.5)', size: 8, grow: 24, life: 0.5 });
        if (e.hitWall) { e.st = 'stunned'; e.timer = 1.3; shake(6); AudioSys.sfx('thud'); burst(e.x, e.y - 20, 10, { type: 'leaf', col: '#6a8a3a', g: 250, vz: 80, smin: 40, smax: 140, lmin: 0.5, lmax: 1 }); }
        else if (e.timer <= 0) { e.st = 'chase'; e.chargeCd = rand(3, 4.5); }
        break;
      case 'stunned': e.timer -= dt; if (e.timer <= 0) { e.st = 'chase'; e.chargeCd = rand(3, 4); } break;
      case 'swind': e.timer -= dt; if (e.timer <= 0) {
        e.st = 'rest'; e.timer = 0.7; e.slamCd = 2.4;
        particle({ x: e.x, y: e.y, type: 'ring', col: 'rgba(200,170,120,0.8)', size: 10, size2: 90, life: 0.4 });
        burst(e.x, e.y, 14, { type: 'smoke', sp: 'd', tint: 'rgba(130,110,90,0.5)', size: 8, grow: 30, smin: 60, smax: 160, lmin: 0.4, lmax: 0.7 });
        shake(7); AudioSys.sfx('thud');
        if (d < 90) hurtPlayer(e.dmg, e.x, e.y);
      } break;
      case 'rest': e.timer -= dt; if (e.timer <= 0) e.st = 'chase'; break;
    }
  },
  fatuo(e, dt, dx, dy, d) {
    e.z = 20 + Math.sin(e.t * 3) * 5;
    if (Math.random() < dt * 14) particle({ x: e.x + rand(-4, 4), y: e.y - e.z - 6, type: 'ember', glow: true, col: 'fire', size: rand(1.5, 3), life: rand(0.4, 0.8), vx: rand(-15, 15), vy: rand(-50, -20) });
    switch (e.st) {
      case 'idle': case 'float': {
        e.st = 'float';
        const want = d < 170 ? -1 : d > 260 ? 1 : 0;
        const a = Math.atan2(dy, dx) + Math.sin(e.t * 1.3) * 0.9;
        moveEntity(e, Math.cos(a) * e.spd * want * dt + Math.cos(a + Math.PI / 2) * 30 * dt, Math.sin(a) * e.spd * want * dt + Math.sin(a + Math.PI / 2) * 30 * dt);
        e.shootT -= dt; e.blinkT -= dt;
        if (e.blinkT <= 0 && d < 500) {
          e.blinkT = rand(4, 7);
          for (let i = 0; i < 6; i++) particle({ x: e.x, y: e.y - e.z, type: 'smoke', sp: 'p', size: 10, grow: 20, life: 0.5, vx: rand(-30, 30), vy: rand(-30, 30) });
          for (let k = 0; k < 8; k++) {
            const a2 = Math.random() * TAU, r = rand(170, 250);
            const nx = P.x + Math.cos(a2) * r, ny = P.y + Math.sin(a2) * r;
            if (!isSolid(nx, ny)) { e.x = nx; e.y = ny; break; }
          }
          AudioSys.sfx('blink');
        }
        if (e.shootT <= 0 && d < 420) { e.st = 'cast'; e.timer = 0.5; }
        break;
      }
      case 'cast':
        e.timer -= dt;
        if (e.timer <= 0) {
          const a = Math.atan2(P.y - 10 - (e.y - e.z), P.x - e.x);
          G.projs.push({ type: 'fire', owner: 'e', x: e.x, y: e.y - e.z, vx: Math.cos(a) * 215, vy: Math.sin(a) * 215, r: 8, dmg: e.dmg, life: 2.4, home: 0.9, homeT: 1.1 });
          AudioSys.sfx('fireball');
          e.shootT = rand(1.8, 2.6); e.st = 'float';
        }
        break;
    }
  },
};

function updateEnemies(dt) {
  const list = G.enemies;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (e.dead) continue;
    e.t += dt; e.flash = Math.max(0, e.flash - dt); e.hitCd -= dt;
    if (e.spawnT > 0) { e.spawnT -= dt; continue; }
    if (e.burn > 0) {
      e.burn -= dt; e.burnTick -= dt;
      if (Math.random() < dt * 10) particle({ x: e.x + rand(-6, 6), y: e.y - e.hh - (e.z || 0), type: 'ember', glow: true, col: 'fire', size: 2, life: 0.5, vy: rand(-60, -30) });
      if (e.burnTick <= 0) { e.burnTick = 0.5; e.hp -= e.burnDmg; dmgText(e.x, e.y - e.hh - 16, Math.round(e.burnDmg), '#ff9a4a'); if (e.hp <= 0) { killEnemy(e); continue; } }
    }
    if (Math.abs(e.kbx) + Math.abs(e.kby) > 4) {
      moveEntity(e, e.kbx * dt, e.kby * dt);
      e.kbx *= Math.exp(-dt * 9); e.kby *= Math.exp(-dt * 9);
    } else { e.kbx = e.kby = 0; }
    if (e.stun > 0) { e.stun -= dt; if (e.st === 'wind' || e.st === 'swind' || e.st === 'spit' || e.st === 'cast' || e.st === 'lunge') e.st = 'idle'; continue; }
    const dx = P.x - e.x, dy = P.y - e.y, d = Math.hypot(dx, dy);
    if (!e.aggro) {
      if (d < 380 && P.alive) e.aggro = true;
      else {
        e.wt -= dt;
        if (e.wt <= 0) { e.wa = Math.random() * TAU; e.wt = rand(1, 3); e.wm = Math.random() < 0.55; }
        if (e.wm) moveEntity(e, Math.cos(e.wa) * 30 * dt, Math.sin(e.wa) * 30 * dt);
        if (e.flying) e.z = 20 + Math.sin(e.t * 5) * 4;
        continue;
      }
    }
    if (!P.alive) { e.aggro = false; continue; }
    AI[e.type](e, dt, dx, dy, d);
    if (dist(e.x, e.y, LOC.village.x, LOC.village.y) < VILLAGE_R - 40 && !e.totem) {
      // a aldeia repele a corrupção
      const a = Math.atan2(e.y - LOC.village.y, e.x - LOC.village.x);
      moveEntity(e, Math.cos(a) * 120 * dt, Math.sin(a) * 120 * dt);
    }
    if (Math.random() < dt * 1.2) particle({ x: e.x + rand(-6, 6), y: e.y - e.hh - (e.z || 0), type: 'smoke', sp: 'p', size: 5, grow: 14, life: 0.8, vy: -20 });
  }
  // separação
  for (let i = 0; i < list.length; i++) {
    const a = list[i]; if (a.dead) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j]; if (b.dead) continue;
      const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r;
      if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
      const d = Math.hypot(dx, dy);
      if (d < rr && d > 0.01) { const p = (rr - d) * 0.5; a.x -= dx / d * p; a.y -= dy / d * p; b.x += dx / d * p; b.y += dy / d * p; }
    }
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (e.dead || (!e.totem && !e.bossMinion && dist(e.x, e.y, P.x, P.y) > 1600)) list.splice(i, 1);
  }
}

/* ---------- projéteis, perigos, coletáveis ---------- */
function updateProjs(dt) {
  for (let i = G.projs.length - 1; i >= 0; i--) {
    const p = G.projs[i];
    p.life -= dt;
    if (p.home && (p.homeT === undefined || p.homeT > 0)) {
      if (p.homeT !== undefined) p.homeT -= dt;
      let tx, ty;
      if (p.owner === 'e') { tx = P.x; ty = P.y - 12; }
      else { const t = nearestEnemy(p.x, p.y, 320); if (t) { tx = t.x; ty = t.y - (t.hh || 8) * 0.6 - (t.z || 0); } }
      if (tx !== undefined) {
        const a = Math.atan2(p.vy, p.vx), want = Math.atan2(ty - p.y, tx - p.x);
        const na = a + clamp(angDiff(a, want), -p.home * dt, p.home * dt);
        const s = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(na) * s; p.vy = Math.sin(na) * s;
      }
    }
    p.x += p.vx * dt; p.y += p.vy * dt;
    let dead = p.life <= 0;
    if (p.type === 'fire' || p.type === 'bossfire') {
      if (Math.random() < 0.6) particle({ x: p.x + rand(-3, 3), y: p.y + rand(-3, 3), type: 'ember', glow: true, col: 'fire', size: rand(1.5, 3), life: 0.35, vx: -p.vx * 0.1, vy: -p.vy * 0.1 - 20 });
    } else if (p.type === 'feather') {
      if (Math.random() < 0.8) particle({ x: p.x, y: p.y, type: 'mote', glow: true, col: p.col, size: 2, life: 0.3, vx: 0, vy: 0, drag: 4 });
    } else if (p.type === 'goo') {
      if (Math.random() < 0.3) particle({ x: p.x, y: p.y, type: 'dot', col: '#7a3fb0', size: 2, life: 0.4 });
    }
    if (p.type !== 'bossfire' && isSolid(p.x, p.y + 10) && kindAt(p.x, p.y + 10) !== 3 && kindAt(p.x, p.y + 10) !== 7) dead = true;
    if (!dead && p.owner === 'e') {
      if (dist(p.x, p.y, P.x, P.y - 12) < p.r + P.r) { hurtPlayer(p.dmg, p.x, p.y); dead = true; }
    } else if (!dead && p.owner === 'p') {
      for (const e of G.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        if (dist(p.x, p.y, e.x, e.y - e.hh * 0.6 - (e.z || 0)) < p.r + e.r) { damageEnemy(e, p.dmg, Math.atan2(p.vy, p.vx), { kb: 120 }); dead = true; break; }
      }
      if (!dead && G.boss && G.boss.vulnerable) {
        for (const s of G.boss.segs) if (dist(p.x, p.y, s.x, s.y - 8) < p.r + s.r) { damageBoss(p.dmg * (s.i === 0 ? 1.4 : 0.8), {}, Math.atan2(p.vy, p.vx)); dead = true; break; }
      }
    }
    if (dead) {
      const col = p.type === 'goo' ? 'purple' : p.type === 'feather' ? p.col : 'fire';
      burst(p.x, p.y, 6, { type: 'spark', glow: true, col, smin: 50, smax: 150, lmin: 0.12, lmax: 0.28 });
      G.projs.splice(i, 1);
    }
  }
  for (let i = G.hazards.length - 1; i >= 0; i--) {
    const h = G.hazards[i];
    h.life -= dt;
    if (h.type === 'flame') {
      h.tick -= dt;
      if (Math.random() < dt * 12) particle({ x: h.x + rand(-h.r, h.r) * 0.6, y: h.y + rand(-h.r, h.r) * 0.4, type: 'flame', glow: true, col: 'fire', size: rand(5, 9), life: rand(0.3, 0.6), vy: rand(-50, -20) });
      if (h.tick <= 0 && dist(h.x, h.y, P.x, P.y) < h.r + 6) { h.tick = 0.5; hurtPlayer(h.dmg, h.x, h.y); }
    } else if (h.type === 'meteor' && !h.hit && h.life <= 0.0) {
      h.hit = true;
      burst(h.x, h.y - 10, 18, { type: 'spark', glow: true, col: 'fire', smin: 80, smax: 260, lmin: 0.2, lmax: 0.5 });
      particle({ x: h.x, y: h.y, type: 'ring', glow: true, col: 'fire', size: 10, size2: h.r + 20, life: 0.35 });
      for (let k = 0; k < 6; k++) particle({ x: h.x + rand(-20, 20), y: h.y + rand(-10, 10), type: 'smoke', sp: 'g', size: 14, grow: 40, life: 0.8, vy: -30 });
      shake(6); AudioSys.sfx('boom');
      if (dist(h.x, h.y, P.x, P.y) < h.r + P.r) hurtPlayer(h.dmg, h.x, h.y);
      G.hazards.push({ type: 'flame', x: h.x, y: h.y, r: 30, life: 2.2, tick: 0.3, dmg: 6 });
    }
    if (h.life <= (h.type === 'meteor' ? -0.05 : 0)) G.hazards.splice(i, 1);
  }
  for (let i = G.pickups.length - 1; i >= 0; i--) {
    const k = G.pickups[i];
    k.t += dt;
    const d = dist(k.x, k.y, P.x, P.y);
    if (k.t > 0.35 && P.alive && d < P.st.magnet) k.pull = true;
    if (k.pull) {
      const s = 420 + k.t * 200;
      k.x += (P.x - k.x) / (d || 1) * s * dt; k.y += (P.y - 8 - k.y) / (d || 1) * s * dt; k.z = lerp(k.z, 8, dt * 8);
      if (d < 16) {
        if (k.type === 'seed') { P.seeds += k.val; AudioSys.sfx('seed'); }
        else if (k.type === 'potion') {
          if (P.potions < P.potionsMax) { P.potions++; AudioSys.sfx('potionGet'); toast('Cuia de Ervas recolhida'); }
          else { P.seeds += 10; AudioSys.sfx('seed'); }
        }
        particle({ x: P.x, y: P.y - 14, type: 'ring', glow: true, col: k.type === 'seed' ? 'gold' : 'green', size: 3, size2: 18, life: 0.25 });
        G.pickups.splice(i, 1); continue;
      }
    } else {
      k.vz -= 520 * dt; k.z += k.vz * dt;
      if (k.z < 0) { k.z = 0; k.vz = -k.vz * 0.45; k.vx *= 0.6; k.vy *= 0.6; }
      k.x += k.vx * dt; k.y += k.vy * dt; k.vx *= Math.exp(-dt * 2); k.vy *= Math.exp(-dt * 2);
    }
    if (k.t > 40) G.pickups.splice(i, 1);
  }
}

function updateParticles(dt) {
  const arr = G.parts;
  for (let i = arr.length - 1; i >= 0; i--) {
    const p = arr[i];
    p.life -= dt;
    if (p.life <= 0) { arr[i] = arr[arr.length - 1]; arr.pop(); continue; }
    const dr = Math.exp(-p.drag * dt);
    p.vx *= dr; p.vy *= dr;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.g) { p.vz -= p.g * dt; p.z += p.vz * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.3; p.vx *= 0.5; p.vy *= 0.5; } }
    p.size += p.grow * dt; p.rot += p.vr * dt;
  }
  for (let i = G.texts.length - 1; i >= 0; i--) { const t = G.texts[i]; t.life -= dt; t.y += t.vy * dt; t.vy *= Math.exp(-dt * 3); if (t.life <= 0) G.texts.splice(i, 1); }
  for (let i = G.slashes.length - 1; i >= 0; i--) { const s = G.slashes[i]; s.t += dt; s.x = P.x; s.y = P.y - 12; if (s.t > s.dur) G.slashes.splice(i, 1); }
  for (let i = G.afterimages.length - 1; i >= 0; i--) { const a = G.afterimages[i]; a.life -= dt; if (a.life <= 0) G.afterimages.splice(i, 1); }
}

/* ---------- geração de inimigos ---------- */
function updateSpawner(dt) {
  G.spawnT -= dt;
  if (G.spawnT > 0) return;
  G.spawnT = 1.3;
  if (G.flags.bossStarted && G.boss && G.boss.alive) return;
  if (G.totems.some(t => t.state === 'event')) return;
  const cap = Math.round(5 + G.dark * 5 + (P.lvl > 4 ? 2 : 0));
  let n = 0;
  for (const e of G.enemies) if (!e.totem && !e.dead && dist(e.x, e.y, P.x, P.y) < 1100) n++;
  if (n >= cap) return;
  for (let k = 0; k < 10; k++) {
    const a = Math.random() * TAU, r = rand(480, 720);
    const x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r;
    if (x < 200 || y < 200 || x > WORLD - 200 || y > WORLD - 200) continue;
    if (isSolid(x, y) || wdepAt(x, y) > -10) continue;
    if (dist(x, y, LOC.village.x, LOC.village.y) < VILLAGE_R + 220) continue;
    if (dist(x, y, LOC.arena.x, LOC.arena.y) < RING_OUT + 40) continue;
    const R = regionW(x, y);
    const night = G.dark > 0.45;
    let tbl;
    if (R.ash > 0.5) tbl = { fatuo: 4, espinho: 2, bruto: 1.4 };
    else if (R.north > 0.5) tbl = { espinho: 4, morcego: night ? 4 : 2, bruto: 1.2, fatuo: night ? 1.2 : 0.2 };
    else if (R.east > 0.5) tbl = { sapo: 5, morcego: night ? 3 : 1.5, espinho: 2, bruto: 0.6 };
    else if (R.west > 0.5) tbl = { espinho: 3, bruto: 1.5, sapo: 2, morcego: night ? 3 : 1.5, fatuo: night ? 1 : 0 };
    else tbl = { espinho: 5, morcego: night ? 3 : 1.2, sapo: 1, bruto: P.lvl > 3 ? 0.5 : 0, fatuo: night && P.lvl > 2 ? 0.6 : 0 };
    const type = weightedPick(Math.random, tbl);
    const group = type === 'espinho' ? randi(1, 3) : type === 'morcego' ? randi(1, 2) : 1;
    const hunt = Math.random() < (night ? 0.55 : 0.35);
    for (let g = 0; g < group; g++) spawnEnemy(type, x + rand(-30, 30), y + rand(-30, 30), { aggro: hunt });
    break;
  }
}

/* ---------- totens ---------- */
const TOTEM_WAVES = {
  onca: [{ espinho: 4 }, { espinho: 3, morcego: 2 }, { espinho: 3, morcego: 2, bruto: 1 }],
  arara: [{ sapo: 3, morcego: 1 }, { sapo: 3, morcego: 3 }, { sapo: 3, morcego: 2, bruto: 1 }],
  jabuti: [{ espinho: 3, sapo: 2 }, { bruto: 1, espinho: 3, morcego: 2 }, { bruto: 2, sapo: 2, fatuo: 1 }],
};
function initTotems() {
  G.totems = [
    { id: 'onca', name: 'Totem da Onça', x: LOC.onca.x, y: LOC.onca.y, col: 'gold', state: 'corrupt', wave: 0, waveT: 0, cr: 18, glowT: 0 },
    { id: 'arara', name: 'Totem da Arara', x: LOC.arara.x, y: LOC.arara.y, col: 'red', state: 'corrupt', wave: 0, waveT: 0, cr: 18, glowT: 0 },
    { id: 'jabuti', name: 'Totem do Jabuti', x: LOC.jabuti.x, y: LOC.jabuti.y, col: 'green', state: 'corrupt', wave: 0, waveT: 0, cr: 18, glowT: 0 },
  ];
}
const awakeCount = () => G.totems.filter(t => t.state === 'awake').length;

function startTotem(t) {
  t.state = 'event'; t.wave = 0; t.waveT = 1.2;
  banner(t.name, 'Proteja o totem até a névoa se dissipar');
  AudioSys.sfx('totemStart');
  for (const e of G.enemies) if (!e.totem && dist(e.x, e.y, t.x, t.y) < 700) e.dead = true;
}
function updateTotems(dt) {
  for (const t of G.totems) {
    t.glowT += dt;
    if (t.state !== 'event') continue;
    if (dist(P.x, P.y, t.x, t.y) > 950 || !P.alive) {
      t.state = 'corrupt';
      for (const e of G.enemies) if (e.totem === t) e.dead = true;
      if (P.alive) toast('A purificação foi interrompida. Volte ao totem.');
      continue;
    }
    const alive = G.enemies.some(e => e.totem === t && !e.dead);
    if (!alive) {
      t.waveT -= dt;
      if (t.waveT <= 0) {
        if (t.wave >= 3) { awakenTotem(t); continue; }
        const comp = TOTEM_WAVES[t.id][t.wave];
        for (const type in comp) for (let i = 0; i < comp[type]; i++) {
          for (let k = 0; k < 12; k++) {
            const a = Math.random() * TAU, r = rand(250, 340);
            const x = t.x + Math.cos(a) * r, y = t.y + Math.sin(a) * r;
            if (isSolid(x, y) || wdepAt(x, y) > -8) continue;
            spawnEnemy(type, x, y, { totem: t, aggro: true, spawnT: 0.6 + Math.random() * 0.6 });
            break;
          }
        }
        t.wave++; t.waveT = 2;
        toast(`Onda ${t.wave} de 3`);
        AudioSys.sfx('wave');
      }
    }
  }
}
function awakenTotem(t) {
  t.state = 'awake';
  P.skills[t.id] = true;
  P.hp = P.hpMax; P.en = P.enMax;
  const col = t.col;
  for (let i = 0; i < 3; i++) particle({ x: t.x, y: t.y - 40, type: 'ring', glow: true, col, size: 10, size2: 140 + i * 60, life: 0.6 + i * 0.2, force: true });
  for (let i = 0; i < 50; i++) particle({ x: t.x + rand(-40, 40), y: t.y - rand(0, 80), type: 'mote', glow: true, col: Math.random() < 0.5 ? col : 'white', size: rand(2, 5), life: rand(1, 2.4), vx: rand(-40, 40), vy: rand(-120, -30), drag: 0.6, force: true });
  shake(10); G.hitstop = 0.12;
  AudioSys.sfx('awaken');
  const S = SKILLS[t.id];
  banner(t.name + ' desperto', 'Nova habilidade: ' + S.name);
  whenPlay(() => {
    const tips = {
      onca: 'Garra da Onça: um giro feroz que atinge tudo ao redor. Custa 30 de energia.',
      arara: 'Penas da Arara: penas teleguiadas que buscam inimigos à distância. Custa 18 de energia.',
      jabuti: 'Casco do Jabuti: um escudo que absorve dano por 6 segundos e cura um pouco. Custa 40 de energia.',
    };
    toast(tips[t.id], 6);
  }, 2600);
  if (awakeCount() === 3 && !G.flags.gateOpen) {
    G.flags.gateOpen = true;
    whenPlay(() => banner('A barreira de fogo se desfez', 'Desça até a Clareira Queimada, ao sul da aldeia'), 4200);
  }
  saveGame();
}

/* ---------- Boitatá ---------- */
function makeBoss() {
  const segs = [];
  const N = 28;
  for (let i = 0; i < N; i++) segs.push({ i, x: LOC.arena.x, y: LOC.arena.y + 40 + i * 3, r: i === 0 ? 30 : lerp(26, 8, Math.pow(i / (N - 1), 0.8)) });
  return { alive: true, hp: 2600, hpMax: 2600, segs, ang: -Math.PI / 2, spd: 150, st: 'dormant', timer: 0, phase: 1, vulnerable: false, flash: 0, emerge: 0, t: 0, contactCd: 0, orbit: 0, trailT: 0, pur: 0, ring2: 0 };
}
function startBoss() {
  const B = G.boss;
  G.flags.bossStarted = true;
  B.st = 'intro'; B.timer = 3.2; B.emerge = 0;
  B.segs.forEach((s, i) => { s.x = LOC.arena.x + Math.cos(i * 0.3) * 30; s.y = LOC.arena.y + Math.sin(i * 0.3) * 30; });
  shake(14); AudioSys.sfx('roar'); AudioSys.setMood('boss');
  setTimeout(() => AudioSys.sfx('bossRoar'), 900);
  bossBar(true);
  banner('Boitatá', 'A serpente de fogo, guardião corrompido', true);
  for (const e of G.enemies) if (dist(e.x, e.y, LOC.arena.x, LOC.arena.y) < RING_OUT) e.dead = true;
}
function damageBoss(dmg, o, ang) {
  const B = G.boss;
  const r = rollDmg(dmg);
  B.hp -= r.v; B.flash = 0.1;
  const h = B.segs[0];
  dmgText(h.x + rand(-20, 20), h.y - 50, r.v, r.crit ? '#ffd27a' : '#ffffff', r.crit || r.v > 60);
  burst(h.x, h.y - 10, 6, { type: 'spark', glow: true, col: 'gold', ang, spread: 1.8, smin: 100, smax: 260, lmin: 0.12, lmax: 0.3 });
  G.hitstop = Math.max(G.hitstop, r.crit ? 0.05 : 0.03); shake(r.crit ? 4 : 2);
  AudioSys.sfx(r.crit ? 'crit' : 'bossHit');
  if (P.st.lifesteal > 0) P.hp = Math.min(P.hpMax, P.hp + r.v * P.st.lifesteal);
  if (B.phase === 1 && B.hp < B.hpMax * 0.5) {
    B.phase = 2; B.spd *= 1.3;
    banner('O Boitatá se enfurece!', 'O chão começa a queimar');
    AudioSys.sfx('bossRoar'); shake(12);
  }
  if (B.hp <= 0) {
    B.hp = 0; B.st = 'dying'; B.timer = 3.4; B.vulnerable = false;
    G.slowT = 1.6; shake(16);
    for (const e of G.enemies) if (e.bossMinion) e.dead = true;
    G.projs = G.projs.filter(p => p.owner === 'p');
    G.hazards = [];
    AudioSys.sfx('bossDie');
  }
}
function bossChoose(B) {
  const minions = G.enemies.filter(e => e.bossMinion && !e.dead).length;
  const tbl = { charge: 3, breath: 3, ring: 2.5, summon: minions < 2 ? 1.2 : 0, meteor: B.phase === 2 ? 2.5 : 0 };
  const a = weightedPick(Math.random, tbl);
  if (a === 'charge') { B.st = 'cwind'; B.timer = B.phase === 2 ? 0.6 : 0.8; }
  else if (a === 'breath') { B.st = 'breath'; B.timer = 1.8; B.fireT = 0; AudioSys.sfx('breath'); }
  else if (a === 'ring') { B.st = 'rwind'; B.timer = 0.65; }
  else if (a === 'summon') { B.st = 'summon'; B.timer = 0.7; }
  else { B.st = 'meteor'; B.timer = 0.6; }
}
function updateBoss(dt) {
  const B = G.boss;
  if (!B) return;
  B.t += dt; B.flash = Math.max(0, B.flash - dt); B.contactCd -= dt;
  const H = B.segs[0], A = LOC.arena;
  if (B.st === 'dormant') {
    if (G.flags.gateOpen && !G.flags.bossDone && P.alive && dist(P.x, P.y, A.x, A.y) < ARENA_R - 60) startBoss();
    return;
  }
  if (B.st === 'purified') {
    B.pur += dt;
    B.ang += dt * 1.4;
    H.x = A.x + Math.cos(B.ang) * 150; H.y = A.y - 80 + Math.sin(B.ang) * 70 - Math.min(80, B.pur * 20);
  } else if (B.st === 'dying') {
    B.timer -= dt;
    H.x += Math.sin(B.t * 30) * 2; H.y += Math.cos(B.t * 27) * 2;
    if (Math.random() < 0.5) {
      const s = pick(B.segs);
      burst(s.x, s.y - 10, 5, { type: 'spark', glow: true, col: Math.random() < 0.5 ? 'fire' : 'cyan', smin: 60, smax: 200, lmin: 0.2, lmax: 0.5 });
      particle({ x: s.x, y: s.y - 10, type: 'smoke', sp: 'p', size: 14, grow: 40, life: 0.8, vy: -40 });
    }
    if (B.timer <= 0) {
      B.st = 'purified'; B.pur = 0; B.alive = false; G.flags.bossDone = true;
      for (let i = 0; i < 4; i++) particle({ x: H.x, y: H.y - 20, type: 'ring', glow: true, col: i % 2 ? 'cyan' : 'gold', size: 20, size2: 260 + i * 80, life: 0.8 + i * 0.2, force: true });
      for (let i = 0; i < 80; i++) particle({ x: A.x + rand(-300, 300), y: A.y + rand(-200, 200), type: 'mote', glow: true, col: pick(['cyan', 'gold', 'white']), size: rand(2, 5), life: rand(1.5, 3), vy: rand(-90, -30), drag: 0.4, force: true });
      G.weather.flash = 1;
      bossBar(false);
      AudioSys.setMood('victory'); AudioSys.sfx('awaken');
      gainXp(500);
      whenPlay(() => bossEnding(), 2600);
    }
    followSegs(B);
    return;
  } else {
    if (B.st === 'intro') {
      B.timer -= dt; B.emerge = Math.min(1, B.emerge + dt * 0.5);
      B.ang += dt * 1.6;
      H.x = A.x + Math.cos(B.ang) * 120; H.y = A.y + Math.sin(B.ang) * 80;
      if (Math.random() < 0.6) burst(A.x + rand(-100, 100), A.y + rand(-60, 60), 2, { type: 'ember', glow: true, col: 'fire', smin: 20, smax: 60, lmin: 0.5, lmax: 1 });
      if (B.timer <= 0) { B.st = 'roam'; B.timer = 1.5; B.vulnerable = true; }
    } else {
      const toP = Math.atan2(P.y - H.y, P.x - H.x);
      let speed = B.spd, turn = B.phase === 2 ? 3 : 2.3, target = null;
      switch (B.st) {
        case 'roam': {
          B.orbit += dt * 0.9;
          target = { x: P.x + Math.cos(B.orbit) * 230, y: P.y + Math.sin(B.orbit) * 170 };
          B.timer -= dt;
          if (B.timer <= 0) bossChoose(B);
          break;
        }
        case 'cwind':
          speed = 40; turn = 5; target = P;
          B.timer -= dt;
          if (Math.random() < 0.5) particle({ x: H.x + rand(-14, 14), y: H.y - 10, type: 'ember', glow: true, col: 'fire', size: 3, life: 0.4, vy: -60 });
          if (B.timer <= 0) { B.st = 'charge'; B.timer = 1.0; B.ang = toP; AudioSys.sfx('roar'); }
          break;
        case 'charge':
          speed = B.phase === 2 ? 640 : 560; turn = 0.6; target = P;
          B.timer -= dt; if (B.timer <= 0) { B.st = 'roam'; B.timer = rand(1, 1.8); }
          break;
        case 'breath': {
          speed = 50; turn = 1.3; target = P;
          B.timer -= dt; B.fireT -= dt;
          if (B.fireT <= 0) {
            B.fireT = 0.065;
            const a = B.ang + rand(-0.28, 0.28);
            G.projs.push({ type: 'bossfire', owner: 'e', x: H.x + Math.cos(B.ang) * 26, y: H.y - 14 + Math.sin(B.ang) * 26, vx: Math.cos(a) * 310, vy: Math.sin(a) * 310, r: 9, dmg: 9, life: 0.95 });
          }
          if (B.timer <= 0) { B.st = 'roam'; B.timer = rand(1, 1.6); }
          break;
        }
        case 'rwind':
          speed = 30; turn = 1; target = P; B.timer -= dt;
          if (B.timer <= 0) {
            const n = B.phase === 2 ? 26 : 18;
            for (let i = 0; i < n; i++) { const a = i / n * TAU; G.projs.push({ type: 'bossfire', owner: 'e', x: H.x, y: H.y - 14, vx: Math.cos(a) * 175, vy: Math.sin(a) * 175, r: 10, dmg: 12, life: 3 }); }
            particle({ x: H.x, y: H.y - 14, type: 'ring', glow: true, col: 'fire', size: 20, size2: 120, life: 0.4 });
            AudioSys.sfx('boom'); shake(6);
            if (B.phase === 2 && !B.ring2) { B.ring2 = 1; B.st = 'rwind'; B.timer = 0.5; }
            else { B.ring2 = 0; B.st = 'roam'; B.timer = rand(1.2, 2); }
          }
          break;
        case 'summon':
          speed = 40; target = P; B.timer -= dt;
          if (B.timer <= 0) {
            for (let i = 0; i < 2; i++) {
              const a = Math.random() * TAU;
              const x = A.x + Math.cos(a) * rand(150, 300), y = A.y + Math.sin(a) * rand(100, 250);
              spawnEnemy('fatuo', x, y, { bossMinion: true, aggro: true, diff: 0.3 });
            }
            AudioSys.sfx('blink');
            B.st = 'roam'; B.timer = rand(1.2, 2);
          }
          break;
        case 'meteor':
          speed = 60; target = P; B.timer -= dt;
          if (B.timer <= 0) {
            for (let i = 0; i < 6; i++) {
              const a = Math.random() * TAU, r = i === 0 ? 0 : rand(40, 180);
              const x = clamp(P.x + Math.cos(a) * r, A.x - ARENA_R + 40, A.x + ARENA_R - 40), y = clamp(P.y + Math.sin(a) * r, A.y - ARENA_R + 40, A.y + ARENA_R - 40);
              G.hazards.push({ type: 'meteor', x, y, r: 56, life: 1.0 + i * 0.12, max: 1.0 + i * 0.12, dmg: 18 });
            }
            AudioSys.sfx('breath');
            B.st = 'roam'; B.timer = rand(1.6, 2.4);
          }
          break;
      }
      if (target) {
        const want = Math.atan2(target.y - H.y, target.x - H.x);
        B.ang += clamp(angDiff(B.ang, want), -turn * dt, turn * dt);
      }
      const dc = dist(H.x, H.y, A.x, A.y);
      if (dc > ARENA_R - 40) {
        const back = Math.atan2(A.y - H.y, A.x - H.x);
        B.ang += clamp(angDiff(B.ang, back), -4 * dt, 4 * dt);
        if (B.st === 'charge') { B.st = 'roam'; B.timer = 1; shake(5); }
      }
      B.ang += Math.sin(B.t * 3) * 0.6 * dt;
      H.x += Math.cos(B.ang) * speed * dt; H.y += Math.sin(B.ang) * speed * dt;
      if (B.phase === 2) {
        B.trailT -= dt;
        if (B.trailT <= 0) { B.trailT = 0.28; const s = B.segs[randi(4, B.segs.length - 1)]; G.hazards.push({ type: 'flame', x: s.x, y: s.y, r: 26, life: 3, tick: 0.2, dmg: 7 }); }
      }
      // contato
      if (B.contactCd <= 0 && B.vulnerable) {
        for (const s of B.segs) {
          if (dist(s.x, s.y, P.x, P.y) < s.r * 0.85 + P.r) {
            if (hurtPlayer(s.i === 0 ? (B.st === 'charge' ? 24 : 16) : 10, s.x, s.y)) B.contactCd = 0.7;
            break;
          }
        }
      }
    }
    // fagulhas do corpo
    const n = G.quality === 0 ? 1 : 3;
    for (let i = 0; i < n; i++) {
      const s = B.segs[randi(0, B.segs.length - 1)];
      particle({ x: s.x + rand(-s.r, s.r) * 0.7, y: s.y - 10 + rand(-s.r, s.r) * 0.4, type: 'ember', glow: true, col: B.phase === 2 && Math.random() < 0.3 ? 'magenta' : 'fire', size: rand(2, 4), life: rand(0.4, 0.9), vx: rand(-20, 20), vy: rand(-90, -40) });
    }
    if (Math.random() < 0.25) { const s = pick(B.segs); particle({ x: s.x, y: s.y - 16, type: 'smoke', sp: 'p', size: 10, grow: 30, life: 0.9, vy: -30 }); }
  }
  followSegs(B);
}
function followSegs(B) {
  for (let i = 1; i < B.segs.length; i++) {
    const a = B.segs[i - 1], b = B.segs[i];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1;
    const sp = (a.r + b.r) * 0.5;
    if (d > sp) { b.x = a.x + dx / d * sp; b.y = a.y + dy / d * sp; }
  }
}
