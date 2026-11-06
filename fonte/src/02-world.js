/* ============================================================
   Mundo: terreno procedural, rio, trilhas, regiões, colisão
   ============================================================ */
const WORLD = 4096, CELL = 8, FW = WORLD / CELL, CHUNK = 512, NCH = WORLD / CHUNK;
const LOC = {
  village: { x: 2048, y: 2048 },
  onca: { x: 2010, y: 640 },
  arara: { x: 3420, y: 1840 },
  jabuti: { x: 700, y: 2140 },
  arena: { x: 2048, y: 3430 },
};
const VILLAGE_R = 300, ARENA_R = 470, RING_IN = 560, RING_OUT = 700;
const PONDS = [
  { x: 2330, y: 2330, r: 78 }, { x: 3570, y: 1470, r: 150 }, { x: 1640, y: 930, r: 105 },
  { x: 3330, y: 2720, r: 120 }, { x: 900, y: 2900, r: 92 }, { x: 1150, y: 1250, r: 72 },
];
const PATHS = [
  [[2048, 2048], [2010, 1760], [2085, 1450], [1990, 1150], [2050, 900], [2010, 700]],
  [[2048, 2048], [1760, 2090], [1450, 2010], [1120, 2170], [780, 2140]],
  [[2048, 2048], [2350, 2075], [2600, 2045], [2900, 2048], [3080, 2010], [3260, 1935], [3400, 1870]],
  [[2048, 2048], [2075, 2350], [2000, 2620], [2048, 2850], [2048, 3030]],
  [[2048, 2048], [2230, 2220], [2280, 2280]],
];
const SEGS = [];
for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) SEGS.push([p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]]);

function riverX(y) { return 2900 + 150 * Math.sin(y / 540 + 0.6) + 55 * Math.sin(y / 170 + 1.3); }
function riverHalf(y) { return 62 + 18 * Math.sin(y / 310 + 2); }
const BRIDGE = { x: riverX(2048), y: 2048, hw: 104, hh: 30 };
function onBridge(x, y) { return Math.abs(x - BRIDGE.x) < BRIDGE.hw && Math.abs(y - BRIDGE.y) < BRIDGE.hh; }

function waterDepthAt(x, y) {
  const wx = x + 14 * Noise.n2(x / 90, y / 90);
  let d = riverHalf(y) - Math.abs(wx - riverX(y));
  for (const p of PONDS) {
    const dx = x - p.x, dy = y - p.y;
    if (Math.abs(dx) > p.r * 1.4 + 40 || Math.abs(dy) > p.r * 1.4 + 40) continue;
    const r = p.r * (1 + 0.16 * Noise.n2(x / 70 + p.x * 0.01, y / 70));
    d = Math.max(d, r - Math.hypot(dx, dy));
  }
  return d;
}

function pathDist(x, y) {
  let best = 1e9;
  for (let i = 0; i < SEGS.length; i++) {
    const s = SEGS[i];
    const vx = s[2] - s[0], vy = s[3] - s[1];
    const l2 = vx * vx + vy * vy;
    let t = ((x - s[0]) * vx + (y - s[1]) * vy) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = x - (s[0] + vx * t), dy = y - (s[1] + vy * t);
    const d = dx * dx + dy * dy; if (d < best) best = d;
  }
  return Math.sqrt(best);
}
function pathDistNoisy(x, y) {
  return pathDist(x + 22 * Noise.n2(x / 95, y / 95), y + 22 * Noise.n2(x / 95 + 40, y / 95));
}

function regionW(x, y) {
  const north = smooth(1500, 1050, y);
  const west = smooth(1380, 1020, x);
  const east = smooth(-40, 90, x - riverX(y) - riverHalf(y));
  const da = Math.hypot(x - LOC.arena.x, y - LOC.arena.y);
  const ash = smooth(1050, 700, da);
  const dv = Math.hypot(x - LOC.village.x, y - LOC.village.y);
  const village = smooth(VILLAGE_R + 50, VILLAGE_R - 90, dv + 40 * Noise.n2(x / 80, y / 80));
  return { north, west, east, ash, village };
}

function inArenaGap(x, y) { return (y - LOC.arena.y) < 0 && Math.abs(x - LOC.arena.x) < 100; }
function arenaRing(x, y) {
  const r = Math.hypot(x - LOC.arena.x, y - LOC.arena.y);
  return r > RING_IN && r < RING_OUT;
}

const C = {
  G1: [46, 94, 52], G2: [80, 130, 58], G3: [104, 146, 64], DF: [24, 62, 47], EAST: [44, 106, 80],
  ASH1: [70, 60, 55], ASH2: [40, 33, 33], VD1: [140, 106, 72], VD2: [116, 86, 58],
  DIRT1: [130, 100, 66], DIRT2: [104, 78, 52], ASHPATH: [92, 76, 66], STONE: [110, 112, 100],
  SAND1: [186, 166, 118], SAND2: [158, 140, 98], WSH: [48, 132, 128], WDEEP: [14, 52, 74], EDGE: [9, 22, 17],
};

// kinds: 0 grama, 1 trilha, 2 areia, 3 água rasa, 4 pedra, 5 cinza, 6 terreiro, 7 água funda
const F = {
  kind: new Uint8Array(FW * FW), solid: new Uint8Array(FW * FW), wdep: new Float32Array(FW * FW),
  ruin: new Uint8Array(FW * FW), canvas: null, img: null, mini: null,
};

function genCell(x, y, out) {
  const R = regionW(x, y);
  const n1 = Noise.fbm(x / 420, y / 420, 3), n2 = Noise.fbm(x / 90 + 31, y / 90 - 17, 3), n3 = Noise.n2(x / 22, y / 22);
  let c = mixc(C.G1, C.G2, clamp(0.5 + n1 * 1.1, 0, 1));
  c = mixc(c, C.G3, clamp(n2 * 1.4, 0, 1) * 0.5);
  c = mixc(c, C.DF, R.north * 0.82);
  c = mixc(c, C.EAST, R.east * 0.5);
  let kind = 0, ruin = 0;
  if (R.ash > 0) {
    const an = Noise.fbm(x / 120, y / 120, 3);
    const ac = mixc(C.ASH1, C.ASH2, clamp(0.5 + an * 1.4, 0, 1));
    c = mixc(c, ac, R.ash);
    const da = Math.hypot(x - LOC.arena.x, y - LOC.arena.y);
    if (da < ARENA_R + 20) {
      // padrão de queimado concêntrico na arena
      const ring = Math.sin(da / 38 + an * 3) * 0.5 + 0.5;
      c = mixc(c, [30, 22, 22], ring * 0.25 + smooth(ARENA_R, 80, da) * 0.2);
    }
    if (R.ash > 0.5) kind = 5;
  }
  if (R.west > 0) {
    const dj = Math.hypot(x - LOC.jabuti.x, y - LOC.jabuti.y);
    const rv = R.west * smooth(560, 330, dj + 130 * Noise.fbm(x / 150, y / 150, 2));
    if (rv > 0.5) { ruin = 1; kind = 4; c = mixc(c, C.STONE, 0.55); }
  }
  if (R.village > 0) { c = mixc(c, mixc(C.VD1, C.VD2, 0.5 + n2 * 0.6), R.village * 0.92); if (R.village > 0.5) kind = 6; }
  const pd = pathDistNoisy(x, y);
  const pw = smooth(31, 15, pd);
  if (pw > 0) {
    c = mixc(c, R.ash > 0.4 ? C.ASHPATH : mixc(C.DIRT1, C.DIRT2, 0.5 + n3 * 0.5), pw * 0.92);
    if (pw > 0.5) { kind = 1; ruin = 0; }
  }
  const wd = waterDepthAt(x, y);
  if (wd > -30 && wd <= 0) {
    const s = smooth(-30, -5, wd);
    c = mixc(c, mixc(C.SAND1, C.SAND2, 0.5 + n3 * 0.5), s * 0.9);
    if (s > 0.55) kind = 2;
  }
  if (wd > 0) {
    c = mixc(C.WSH, C.WDEEP, smooth(0, 55, wd));
    c = mixc(c, [c[0] + 18, c[1] + 26, c[2] + 18], clamp(0.5 + n2, 0, 1) * 0.3);
    kind = wd > 26 ? 7 : 3; ruin = 0;
  }
  const ed = Math.min(x, y, WORLD - x, WORLD - y);
  c = mixc(c, C.EDGE, smooth(330, 60, ed) * 0.85);
  out.c = c; out.kind = kind; out.wd = wd; out.ruin = ruin;
  let solid = 0;
  if (wd > 3 && !onBridge(x, y)) solid = 1;
  if (ed < 150) solid = 1;
  if (arenaRing(x, y) && !inArenaGap(x, y)) solid = 1;
  out.solid = solid;
}

function generateField(onProgress) {
  return new Promise(resolve => {
    const W2 = FW + 2;
    const img = new ImageData(W2, W2);
    const d = img.data;
    const out = {};
    let row = 0;
    function step() {
      const t0 = performance.now();
      while (row < FW && performance.now() - t0 < 24) {
        const y = (row + 0.5) * CELL;
        for (let i = 0; i < FW; i++) {
          const x = (i + 0.5) * CELL;
          genCell(x, y, out);
          const k = row * FW + i;
          F.kind[k] = out.kind; F.solid[k] = out.solid; F.wdep[k] = out.wd; F.ruin[k] = out.ruin;
          const p = ((row + 1) * W2 + (i + 1)) * 4;
          d[p] = out.c[0]; d[p + 1] = out.c[1]; d[p + 2] = out.c[2]; d[p + 3] = 255;
        }
        row++;
      }
      onProgress(row / FW);
      if (row < FW) { requestAnimationFrame(step); return; }
      // borda replicada (evita costura no upscale)
      for (let i = 0; i < W2; i++) {
        for (const [a, b] of [[[i, 0], [clamp(i, 1, FW), 1]], [[i, W2 - 1], [clamp(i, 1, FW), FW]], [[0, i], [1, clamp(i, 1, FW)]], [[W2 - 1, i], [FW, clamp(i, 1, FW)]]]) {
          const pa = (a[1] * W2 + a[0]) * 4, pb = (b[1] * W2 + b[0]) * 4;
          d[pa] = d[pb]; d[pa + 1] = d[pb + 1]; d[pa + 2] = d[pb + 2]; d[pa + 3] = 255;
        }
      }
      F.img = img;
      F.canvas = makeCanvas(W2, W2);
      F.canvas.getContext('2d').putImageData(img, 0, 0);
      resolve();
    }
    step();
  });
}

const cellIdx = (x, y) => ((y / CELL) | 0) * FW + ((x / CELL) | 0);
function kindAt(x, y) { if (x < 0 || y < 0 || x >= WORLD || y >= WORLD) return 0; return F.kind[cellIdx(x, y)]; }
function wdepAt(x, y) { if (x < 0 || y < 0 || x >= WORLD || y >= WORLD) return -99; return F.wdep[cellIdx(x, y)]; }

function gateClosed() { return !G.flags.gateOpen || (G.boss && G.boss.alive && G.flags.bossStarted); }
function isSolid(x, y) {
  if (x < 0 || y < 0 || x >= WORLD || y >= WORLD) return true;
  if (F.solid[cellIdx(x, y)]) return true;
  if (inArenaGap(x, y) && gateClosed()) {
    const r = Math.hypot(x - LOC.arena.x, y - LOC.arena.y);
    if (r > RING_IN - 30 && r < RING_OUT) return true;
  }
  return false;
}

/* ---------- Props (vegetação, ruínas, aldeia) ---------- */
const PROPS = [];              // todos
const PROP_CHUNKS = [];        // por chunk
const GROUND_DECOR = [];       // itens desenhados no chão (vitória-régia, ponte, anéis de pedra)
const COLL_N = 32, COLL_S = WORLD / COLL_N;
const COLL = [];
for (let i = 0; i < NCH * NCH; i++) PROP_CHUNKS.push([]);
for (let i = 0; i < COLL_N * COLL_N; i++) COLL.push([]);

function addProp(type, x, y, variant, extra) {
  const p = Object.assign({ type, x, y, v: variant | 0, fade: 1, r: 0, seed: Math.random() * 100 }, extra || {});
  const def = PROP_DEFS[type];
  if (def) { p.r = def.r ? def.r(p) : 0; }
  PROPS.push(p);
  const cx = clamp((x / CHUNK) | 0, 0, NCH - 1), cy = clamp((y / CHUNK) | 0, 0, NCH - 1);
  PROP_CHUNKS[cy * NCH + cx].push(p);
  if (p.r > 0) {
    const gx = clamp((x / COLL_S) | 0, 0, COLL_N - 1), gy = clamp((y / COLL_S) | 0, 0, COLL_N - 1);
    COLL[gy * COLL_N + gx].push(p);
  }
  return p;
}

function weightedPick(rng, table) {
  let tot = 0; for (const k in table) tot += table[k];
  let r = rng() * tot;
  for (const k in table) { r -= table[k]; if (r <= 0) return k; }
  return Object.keys(table)[0];
}

function generateProps() {
  const rng = mulberry32(2024);
  const step = 44;
  const avoid = [LOC.onca, LOC.arara, LOC.jabuti, { x: 2112, y: 1330 }, { x: 2668, y: 2098 }];
  for (let gy = 0; gy < WORLD / step; gy++) {
    for (let gx = 0; gx < WORLD / step; gx++) {
      const x = gx * step + rng() * step, y = gy * step + rng() * step;
      const ed = Math.min(x, y, WORLD - x, WORLD - y);
      const wd = waterDepthAt(x, y);
      const R = regionW(x, y);
      // vitória-régia e juncos na água
      if (wd > 8) {
        if (wd > 14 && wd < 90 && rng() < 0.16 && !onBridge(x, y) && Math.abs(y - BRIDGE.y) > 70) {
          GROUND_DECOR.push({ type: 'lily', x, y, v: (rng() * 4) | 0, s: 0.7 + rng() * 0.6, rot: rng() * TAU, flower: rng() < 0.22 });
        }
        continue;
      }
      if (wd > -22) { if (wd > -16 && rng() < 0.35 && !onBridge(x, y)) addProp('reeds', x, y, (rng() * 3) | 0); continue; }
      const da = Math.hypot(x - LOC.arena.x, y - LOC.arena.y);
      if (da < RING_OUT + 40) continue; // arena tratada à parte
      if (ed < 300) { if (rng() < 0.9) addProp(rng() < 0.5 ? 'treeDark' : 'treeRound', x, y, (rng() * 6) | 0, { big: 1.15 }); continue; }
      const pd = pathDist(x, y);
      if (pd < 44) continue;
      if (Math.hypot(x - LOC.village.x, y - LOC.village.y) < VILLAGE_R + 30) continue;
      let near = false; for (const a of avoid) if (Math.hypot(x - a.x, y - a.y) < 190) near = true;
      if (near) continue;
      if (Math.hypot(x - BRIDGE.x, y - BRIDGE.y) < 150) continue;
      let p = 0.3 + R.north * 0.22 + R.east * 0.1 - R.ash * 0.1;
      if (rng() > p) continue;
      let table;
      const ruinsHere = R.west > 0.3 && F.ruin[cellIdx(x, y)];
      if (R.ash > 0.45) table = { deadTree: 34, stump: 18, charRock: 24, bush: 6, fern: 4 };
      else if (ruinsHere) table = { pillar: 14, wall: 10, statue: 3, rock: 16, treeRound: 12, bush: 14, fern: 14, heliconia: 4 };
      else if (R.north > 0.5) table = { treeDark: 32, fern: 20, mushroom: 13, bush: 9, treeRound: 9, giantLeaf: 9, kapok: 3, rock: 4, ipe: 1.2 };
      else if (R.east > 0.5) table = { palm: 30, fern: 16, treeRound: 14, heliconia: 11, bush: 10, giantLeaf: 7, mushroom: 2, ipe: 1.5 };
      else if (R.west > 0.5) table = { treeRound: 22, rock: 12, bush: 16, fern: 14, palm: 8, giantLeaf: 6, heliconia: 5, pillar: 3, ipe: 1.5 };
      else table = { treeRound: 30, palm: 17, bush: 16, fern: 14, heliconia: 8, giantLeaf: 8, rock: 5, kapok: 1.6, ipe: 2.2 };
      const type = weightedPick(rng, table);
      addProp(type, x, y, (rng() * 8) | 0);
    }
  }
  // Arena: anel de árvores mortas e pedras
  const A = LOC.arena;
  for (let ring = 0; ring < 3; ring++) {
    const rr = RING_IN + 30 + ring * 50;
    const n = Math.floor(TAU * rr / 46);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + ring * 0.3 + rng() * 0.05;
      const x = A.x + Math.cos(a) * (rr + rng() * 16), y = A.y + Math.sin(a) * (rr + rng() * 16);
      if (inArenaGap(x, y)) continue;
      addProp(rng() < 0.55 ? 'deadTree' : 'charRock', x, y, (rng() * 6) | 0);
    }
  }
  for (let i = 0; i < 9; i++) {
    const a = rng() * TAU, r = 120 + rng() * 300;
    addProp(rng() < 0.5 ? 'stump' : 'charRock', A.x + Math.cos(a) * r, A.y + Math.sin(a) * r, (rng() * 6) | 0);
  }
  // Aldeia
  const V = LOC.village;
  addProp('maloca', V.x - 175, V.y - 115, 0);
  addProp('maloca', V.x + 185, V.y - 120, 1);
  addProp('maloca', V.x - 160, V.y + 165, 1);
  addProp('maloca', V.x + 150, V.y + 175, 0);
  addProp('log', V.x - 48, V.y + 34, 0, { rot: 0.4 });
  addProp('log', V.x + 52, V.y + 30, 0, { rot: -0.5 });
  addProp('log', V.x + 4, V.y - 58, 0, { rot: 0 });
  addProp('rack', V.x + 95, V.y - 20, 0);
  addProp('totemPole', V.x - 95, V.y - 20, 0);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) addProp('crop', V.x + 40 + i * 22, V.y + 230 + j * 22 + (i % 2) * 4, (i + j) % 3);
  GROUND_DECOR.push({ type: 'firering', x: V.x, y: V.y + 6 });
  GROUND_DECOR.push({ type: 'bridge', x: BRIDGE.x, y: BRIDGE.y });
  GROUND_DECOR.push({ type: 'canoe', x: BRIDGE.x - 120, y: BRIDGE.y + 70, rot: 0.3 });
  for (const t of [LOC.onca, LOC.arara, LOC.jabuti]) GROUND_DECOR.push({ type: 'totemring', x: t.x, y: t.y + 4 });
  // árvores marcantes em volta do totem da onça
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55;
    addProp('kapok', LOC.onca.x + Math.cos(a) * 270, LOC.onca.y + Math.sin(a) * 230 - 30, i);
  }
  for (const p of PONDS) {
    // mais vitórias-régias nos lagos
    for (let i = 0; i < Math.floor(p.r / 14); i++) {
      const a = rng() * TAU, r = rng() * p.r * 0.8;
      const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
      if (waterDepthAt(x, y) > 16) GROUND_DECOR.push({ type: 'lily', x, y, v: (rng() * 4) | 0, s: 0.8 + rng() * 0.7, rot: rng() * TAU, flower: rng() < 0.3 });
    }
  }
  for (const pc of PROP_CHUNKS) pc.sort((a, b) => a.y - b.y);
}

/* colisão de círculo contra props */
function propCollide(e) {
  const gx0 = clamp(((e.x - 80) / COLL_S) | 0, 0, COLL_N - 1), gx1 = clamp(((e.x + 80) / COLL_S) | 0, 0, COLL_N - 1);
  const gy0 = clamp(((e.y - 80) / COLL_S) | 0, 0, COLL_N - 1), gy1 = clamp(((e.y + 80) / COLL_S) | 0, 0, COLL_N - 1);
  for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
    const arr = COLL[gy * COLL_N + gx];
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      const dx = e.x - p.x, dy = e.y - p.y, rr = e.r + p.r;
      const d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2), push = rr - d;
        e.x += (dx / d) * push; e.y += (dy / d) * push;
        if (e.onBump) e.onBump(p);
      }
    }
  }
}

function moveEntity(e, dx, dy) {
  const r = e.r * 0.8;
  const nx = e.x + dx;
  if (!isSolid(nx + Math.sign(dx) * r, e.y) && !isSolid(nx + Math.sign(dx) * r, e.y - r * 0.6) && !isSolid(nx + Math.sign(dx) * r, e.y + r * 0.6)) e.x = nx;
  else if (e.onWall) e.onWall();
  const ny = e.y + dy;
  if (!isSolid(e.x, ny + Math.sign(dy) * r) && !isSolid(e.x - r * 0.6, ny + Math.sign(dy) * r) && !isSolid(e.x + r * 0.6, ny + Math.sign(dy) * r)) e.y = ny;
  else if (e.onWall) e.onWall();
  if (!e.flying) propCollide(e);
}
