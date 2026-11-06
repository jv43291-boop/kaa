/* ============================================================
   Renderização: chão em chunks, personagens, luz, atmosfera
   ============================================================ */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
let W = 0, H = 0, RS = 1, ZOOM = 1, S = 1, GS = 1.5;
const LIGHT_DIV = 4;
const lightC = makeCanvas(16, 16), lctx = lightC.getContext('2d');
let LW = 16, LH = 16, VIGNETTE = null, BEAM = null;
const chunkCache = new Map();
const WATER_PTS = [];
let chunkBudget = 2;

function resize() {
  const cssW = window.innerWidth, cssH = window.innerHeight;
  const dpr = window.devicePixelRatio || 1;
  RS = Math.min(dpr, [1, 1.5, 2][G.quality]);
  canvas.width = Math.max(2, Math.round(cssW * RS)); canvas.height = Math.max(2, Math.round(cssH * RS));
  W = canvas.width; H = canvas.height;
  ZOOM = clamp(Math.sqrt((cssW * cssH) / (700 * 420)), 0.72, 1.7);
  S = ZOOM * RS;
  const ng = clamp(Math.round(S * 4) / 4, 1, 2);
  if (ng !== GS) { GS = ng; chunkCache.clear(); }
  LW = Math.ceil(W / LIGHT_DIV); LH = Math.ceil(H / LIGHT_DIV);
  lightC.width = LW; lightC.height = LH;
  VIGNETTE = makeCanvas(Math.ceil(W / 4), Math.ceil(H / 4));
  const vg = VIGNETTE.getContext('2d');
  const gr = vg.createRadialGradient(VIGNETTE.width / 2, VIGNETTE.height / 2, Math.min(VIGNETTE.width, VIGNETTE.height) * 0.35, VIGNETTE.width / 2, VIGNETTE.height / 2, Math.hypot(VIGNETTE.width, VIGNETTE.height) * 0.56);
  gr.addColorStop(0, 'rgba(4,10,8,0)'); gr.addColorStop(1, 'rgba(4,10,8,0.62)');
  vg.fillStyle = gr; vg.fillRect(0, 0, VIGNETTE.width, VIGNETTE.height);
  if (!BEAM) {
    BEAM = makeCanvas(64, 256); const bg = BEAM.getContext('2d');
    const lg = bg.createLinearGradient(0, 0, 64, 0);
    lg.addColorStop(0, 'rgba(255,240,200,0)'); lg.addColorStop(0.5, 'rgba(255,240,200,1)'); lg.addColorStop(1, 'rgba(255,240,200,0)');
    bg.fillStyle = lg; bg.fillRect(0, 0, 64, 256);
    bg.globalCompositeOperation = 'destination-in';
    const vg2 = bg.createLinearGradient(0, 0, 0, 256); vg2.addColorStop(0, 'rgba(0,0,0,1)'); vg2.addColorStop(1, 'rgba(0,0,0,0)');
    bg.fillStyle = vg2; bg.fillRect(0, 0, 64, 256);
  }
}

function initWaterPts() {
  const rng = mulberry32(99);
  for (let cy = 0; cy < NCH; cy++) for (let cx = 0; cx < NCH; cx++) {
    const arr = [];
    for (let gy = 0; gy < 24; gy++) for (let gx = 0; gx < 24; gx++) {
      const x = cx * CHUNK + (gx + rng()) * (CHUNK / 24), y = cy * CHUNK + (gy + rng()) * (CHUNK / 24);
      const d = wdepAt(x, y);
      if (d > 7 && !onBridge(x, y)) arr.push({ x, y, ph: rng() * TAU, l: 4 + rng() * 9, d });
    }
    WATER_PTS.push(arr);
  }
}

function groundRGB(x, y) {
  const i = clamp((x / CELL) | 0, 0, FW - 1) + 1, j = clamp((y / CELL) | 0, 0, FW - 1) + 1;
  const p = (j * (FW + 2) + i) * 4, d = F.img.data;
  return [d[p], d[p + 1], d[p + 2]];
}

function renderChunk(cx, cy) {
  const c = makeCanvas(CHUNK * GS, CHUNK * GS), g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  const px = CHUNK / CELL;
  g.drawImage(F.canvas, cx * px, cy * px, px + 2, px + 2, -CELL * GS, -CELL * GS, (px + 2) * CELL * GS, (px + 2) * CELL * GS);
  g.setTransform(GS, 0, 0, GS, -cx * CHUNK * GS, -cy * CHUNK * GS);
  const x0 = cx * CHUNK, y0 = cy * CHUNK;
  const rng = mulberry32(cx * 1013 + cy * 7919 + 5);
  // piso de pedra das ruínas
  for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 16; tx++) {
    const wx = x0 + tx * 32 + 16, wy = y0 + ty * 32 + 16;
    if (kindAt(wx, wy) !== 4) continue;
    if (rng() < 0.12) continue;
    const base = mixc([132, 134, 120], [92, 94, 84], rng());
    g.fillStyle = rgb(base, 0.75);
    const jx = (rng() - 0.5) * 2, jy = (rng() - 0.5) * 2;
    g.beginPath(); g.roundRect ? g.roundRect(wx - 15 + jx, wy - 15 + jy, 30, 30, 3) : g.rect(wx - 15 + jx, wy - 15 + jy, 30, 30); g.fill();
    g.strokeStyle = 'rgba(30,32,26,0.35)'; g.lineWidth = 1; g.stroke();
    if (rng() < 0.35) { g.strokeStyle = 'rgba(30,30,25,0.45)'; g.beginPath(); g.moveTo(wx - 10, wy - 6); g.lineTo(wx - 2, wy); g.lineTo(wx + 4, wy - 3); g.lineTo(wx + 11, wy + 7); g.stroke(); }
    if (rng() < 0.5) { for (let k = 0; k < 6; k++) { g.fillStyle = rng() < 0.5 ? 'rgba(110,160,70,0.7)' : 'rgba(70,120,50,0.7)'; circle(g, wx - 15 + rng() * 30, wy + (rng() < 0.5 ? -15 : 15) + (rng() - 0.5) * 5, 1.5 + rng() * 2.5); g.fill(); } }
  }
  // detalhes
  const N = 1700;
  for (let i = 0; i < N; i++) {
    const x = x0 + rng() * CHUNK, y = y0 + rng() * CHUNK;
    const k = kindAt(x, y);
    const base = groundRGB(x, y);
    if (k === 0) {
      const r = rng();
      if (r < 0.035) {
        const fc = pick(['#ffd84a', '#ffffff', '#ff8ab8', '#9ad0ff', '#ff6a3a']);
        for (let f = 0; f < 5; f++) { g.fillStyle = fc; const a = f / 5 * TAU; circle(g, x + Math.cos(a) * 1.6, y + Math.sin(a) * 1.6, 1.1); g.fill(); }
        g.fillStyle = '#5a3a10'; circle(g, x, y, 0.8); g.fill();
      } else if (r < 0.1 && y < 1400) {
        g.fillStyle = rgb(mixc([110, 80, 40], base, 0.4), 0.7); ellipse(g, x, y, 3, 1.6, rng() * TAU); g.fill();
      } else {
        const blades = 3 + ((rng() * 3) | 0);
        for (let b = 0; b < blades; b++) {
          const dx = (rng() - 0.5) * 6, h = 4 + rng() * 6, lean = (rng() - 0.5) * 5;
          g.strokeStyle = rgb(shade(base, rng() < 0.6 ? 1.3 + rng() * 0.25 : 0.72), 0.85);
          g.lineWidth = 1.1;
          g.beginPath(); g.moveTo(x + dx, y); g.quadraticCurveTo(x + dx + lean * 0.3, y - h * 0.6, x + dx + lean, y - h); g.stroke();
        }
      }
    } else if (k === 1 || k === 6) {
      if (rng() < 0.4) {
        const r = 1 + rng() * 2.4;
        g.fillStyle = rgb(shade(base, 0.7)); ellipse(g, x + 0.6, y + 0.6, r, r * 0.7); g.fill();
        g.fillStyle = rgb(shade(base, 1.25)); ellipse(g, x, y, r, r * 0.7); g.fill();
      } else { g.fillStyle = rgb(shade(base, rng() < 0.5 ? 0.85 : 1.12), 0.6); circle(g, x, y, 0.8 + rng()); g.fill(); }
    } else if (k === 2) {
      g.fillStyle = rgb(shade(base, rng() < 0.5 ? 0.9 : 1.1), 0.6); circle(g, x, y, 0.6 + rng() * 0.8); g.fill();
    } else if (k === 5) {
      const r = rng();
      if (r < 0.25) { g.strokeStyle = 'rgba(20,14,12,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (rng() - 0.5) * 14, y + (rng() - 0.5) * 8); g.lineTo(x + (rng() - 0.5) * 20, y + (rng() - 0.5) * 12); g.stroke(); }
      else if (r < 0.32) { g.fillStyle = 'rgba(200,70,30,0.8)'; circle(g, x, y, 0.9 + rng()); g.fill(); }
      else { g.fillStyle = rgb(shade(base, rng() < 0.5 ? 0.7 : 1.3), 0.5); circle(g, x, y, 0.8 + rng() * 1.2); g.fill(); }
    } else if (k === 4) {
      if (rng() < 0.3) { g.fillStyle = 'rgba(90,140,60,0.6)'; circle(g, x, y, 1 + rng() * 1.5); g.fill(); }
    }
  }
  // espuma das margens
  for (let i = 0; i < 2600; i++) {
    const x = x0 + rng() * CHUNK, y = y0 + rng() * CHUNK;
    const d = wdepAt(x, y);
    if (d > -3 && d < 4) { g.fillStyle = `rgba(220,245,235,${0.18 + rng() * 0.2})`; ellipse(g, x, y, 2 + rng() * 3, 1 + rng(), rng() * TAU); g.fill(); }
    else if (d >= 4 && d < 16 && rng() < 0.2) { g.fillStyle = 'rgba(160,220,210,0.12)'; ellipse(g, x, y, 4, 1.5, 0); g.fill(); }
  }
  for (const d of GROUND_DECOR) {
    const R = decorRadius(d);
    if (d.x + R < x0 || d.x - R > x0 + CHUNK || d.y + R < y0 || d.y - R > y0 + CHUNK) continue;
    drawDecor(g, d);
  }
  // granulação pictórica
  for (let i = 0; i < 700; i++) { g.fillStyle = rng() < 0.5 ? 'rgba(255,255,230,0.05)' : 'rgba(0,0,0,0.07)'; g.fillRect(x0 + rng() * CHUNK, y0 + rng() * CHUNK, 1.5, 1.5); }
  return c;
}

const chunkMax = () => (GS > 1.6 ? 16 : 20);
function getChunk(cx, cy, force) {
  const key = cy * NCH + cx;
  let e = chunkCache.get(key);
  if (e) { e.used = G.real; return e.c; }
  if (!force && chunkBudget <= 0) return null;
  chunkBudget--;
  const c = renderChunk(cx, cy);
  chunkCache.set(key, { c, used: G.real });
  const max = chunkMax();
  if (chunkCache.size > max) {
    let oldK = -1, oldT = 1e18;
    for (const [k, v] of chunkCache) if (v.used < oldT && k !== key) { oldT = v.used; oldK = k; }
    if (oldK >= 0) chunkCache.delete(oldK);
  }
  return c;
}

function drawGround(vx, vy, vw, vh) {
  const c0 = clamp(Math.floor(vx / CHUNK), 0, NCH - 1), c1 = clamp(Math.floor((vx + vw) / CHUNK), 0, NCH - 1);
  const r0 = clamp(Math.floor(vy / CHUNK), 0, NCH - 1), r1 = clamp(Math.floor((vy + vh) / CHUNK), 0, NCH - 1);
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    const c = getChunk(cx, cy);
    if (c) ctx.drawImage(c, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
    else {
      const px = CHUNK / CELL;
      ctx.drawImage(F.canvas, cx * px + 1, cy * px + 1, px, px, cx * CHUNK, cy * CHUNK, CHUNK, CHUNK);
    }
  }
  // pré-carrega um chunk vizinho quando sobra tempo no quadro
  if (chunkBudget > 0 && G.state !== 'loading' && chunkCache.size < chunkMax() - 2) {
    outer: for (let cy = Math.max(0, r0 - 1); cy <= Math.min(NCH - 1, r1 + 1); cy++) for (let cx = Math.max(0, c0 - 1); cx <= Math.min(NCH - 1, c1 + 1); cx++) {
      if (!chunkCache.has(cy * NCH + cx)) { getChunk(cx, cy); break outer; }
    }
  }
  // brilho da água
  ctx.globalCompositeOperation = 'lighter';
  const t = G.real;
  const night = G.dark;
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    const arr = WATER_PTS[cy * NCH + cx];
    if (!arr) continue;
    for (let i = 0; i < arr.length; i++) {
      const w = arr[i];
      if (w.x < vx - 20 || w.x > vx + vw + 20 || w.y < vy - 20 || w.y > vy + vh + 20) continue;
      const s = Math.sin(t * 1.6 + w.ph);
      if (s < 0.3) continue;
      const a = (s - 0.3) * 0.4 * (night > 0.5 ? 0.6 : 1);
      ctx.fillStyle = night > 0.5 ? `rgba(150,190,255,${a})` : `rgba(210,250,240,${a})`;
      const ox = Math.sin(t * 0.7 + w.ph) * 3, oy = (t * 6 + w.ph * 10) % 8;
      ctx.fillRect(w.x + ox - w.l / 2, w.y + oy, w.l, 1.2);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/* ---------- personagens ---------- */
function drawScarf(c, sc, col) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (let i = 0; i < sc.length - 1; i++) {
    c.strokeStyle = i % 2 ? col[1] : col[0];
    c.lineWidth = 5.2 - i * 0.6;
    c.beginPath(); c.moveTo(sc[i].x, sc[i].y); c.lineTo(sc[i + 1].x, sc[i + 1].y); c.stroke();
  }
}

function drawBlade(c, hx, hy, a, len, glow) {
  c.save(); c.translate(hx, hy); c.rotate(a);
  c.fillStyle = '#4a2f1c'; c.fillRect(-4, -1.6, 6, 3.2);
  c.fillStyle = '#c9a24a'; c.fillRect(1.5, -3, 2, 6);
  const g = c.createLinearGradient(0, -3, 0, 3);
  g.addColorStop(0, '#e9fbff'); g.addColorStop(0.5, glow ? '#8ff6ec' : '#a9c8cc'); g.addColorStop(1, '#4f7d84');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(3.5, -2.2); c.quadraticCurveTo(len * 0.6, -4.2, len, -1.2); c.lineTo(len - 2, 1.2); c.quadraticCurveTo(len * 0.5, 2.6, 3.5, 2.2); c.closePath(); c.fill();
  c.restore();
}

function heroDir(fa) {
  const fx = Math.cos(fa), fy = Math.sin(fa);
  return Math.abs(fx) > Math.abs(fy) * 1.05 ? (fx > 0 ? 1 : 3) : (fy > 0 ? 0 : 2);
}

function drawHead(c, x, hy, dir, o) {
  // pele
  c.fillStyle = rgrad(c, x, hy, 1, 9.5, [[0, o.skin1], [1, o.skin2]], -2.5, -3);
  circle(c, x, hy, 8.6); c.fill();
  c.fillStyle = o.hair;
  if (dir === 2) {
    circle(c, x, hy - 0.5, 9); c.fill();
    if (o.longHair) { c.beginPath(); c.moveTo(x - 8, hy); c.quadraticCurveTo(x - 9, hy + 16, x - 4, hy + 20); c.lineTo(x + 4, hy + 20); c.quadraticCurveTo(x + 9, hy + 16, x + 8, hy); c.fill(); }
  } else if (dir === 0) {
    c.beginPath(); c.arc(x, hy - 0.5, 9.2, Math.PI * 0.98, Math.PI * 2.02);
    for (let k = 0; k <= 6; k++) c.lineTo(x + 8.6 - k * 2.9, hy - 1.2 + (k % 2) * 1.6);
    c.closePath(); c.fill();
    if (o.longHair) { c.fillRect(x - 9.2, hy - 1, 2.6, 13); c.fillRect(x + 6.6, hy - 1, 2.6, 13); }
    if (o.eyesClosed) {
      c.strokeStyle = '#1b120c'; c.lineWidth = 1;
      c.beginPath(); c.arc(x - 3.3, hy + 1.6, 1.6, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      c.beginPath(); c.arc(x + 3.3, hy + 1.6, 1.6, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
    } else {
      c.fillStyle = '#140d09'; ellipse(c, x - 3.2, hy + 1.6, 1.3, 1.8); c.fill(); ellipse(c, x + 3.2, hy + 1.6, 1.3, 1.8); c.fill();
      c.fillStyle = '#fff'; circle(c, x - 2.8, hy + 1, 0.5); c.fill(); circle(c, x + 3.6, hy + 1, 0.5); c.fill();
    }
    c.strokeStyle = o.paint; c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(x - 6.5, hy + 4); c.lineTo(x - 4, hy + 4.4); c.moveTo(x + 4, hy + 4.4); c.lineTo(x + 6.5, hy + 4); c.stroke();
  } else {
    const s = dir === 1 ? 1 : -1;
    c.beginPath(); c.arc(x, hy - 0.5, 9.2, s > 0 ? Math.PI * 0.55 : Math.PI * 1.45, s > 0 ? Math.PI * 1.95 : Math.PI * 1.05 + TAU, s < 0);
    c.lineTo(x + s * 3, hy - 3); c.closePath(); c.fill();
    if (o.longHair) { c.beginPath(); c.moveTo(x - s * 6, hy - 2); c.quadraticCurveTo(x - s * 12, hy + 10, x - s * 8, hy + 18); c.lineTo(x - s * 3, hy + 14); c.closePath(); c.fill(); }
    if (o.eyesClosed) { c.strokeStyle = '#1b120c'; c.lineWidth = 1; c.beginPath(); c.arc(x + s * 4, hy + 1.6, 1.5, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
    else { c.fillStyle = '#140d09'; ellipse(c, x + s * 4.2, hy + 1.4, 1.2, 1.8); c.fill(); c.fillStyle = '#fff'; circle(c, x + s * 4.5, hy + 0.8, 0.5); c.fill(); }
    c.strokeStyle = o.paint; c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(x + s * 2.5, hy + 4.6); c.lineTo(x + s * 5.5, hy + 4.2); c.stroke();
  }
}

function drawHero(c, x, y, o) {
  const dir = heroDir(o.face);
  const bob = o.moving ? Math.abs(Math.sin(o.walkT * 2.2)) * 2 : Math.sin(o.t * 2.2) * 0.6;
  const step = o.moving ? Math.sin(o.walkT * 2.2) : 0;
  const by = y - bob;
  // lâmina
  let ba, hx, hy2, len = 25, bladeBehind;
  if (o.spin > 0) { ba = o.t * 28; }
  else if (o.atkAnim > 0) { const p = 1 - o.atkAnim / 0.22; ba = o.atkAngle + o.swingDir * lerp(-1.4, 1.4, easeOut(clamp(p * 1.3, 0, 1))); }
  else { const s = dir === 3 ? -1 : 1; ba = dir === 2 ? -Math.PI / 2 - 0.4 : Math.PI / 2 - s * 0.55; len = 21; }
  hx = x + Math.cos(ba) * 9; hy2 = by - 13 + Math.sin(ba) * 6;
  bladeBehind = Math.sin(ba) < -0.25 || (dir === 2 && o.atkAnim <= 0);
  if (dir !== 2) drawScarf(c, o.scarf, ['#2fd3c1', '#23a99a']);
  if (bladeBehind && !o.noBlade) drawBlade(c, hx, hy2, ba, len, o.atkAnim > 0 || o.spin > 0);
  // pernas
  c.fillStyle = '#2a1b14';
  if (dir === 0 || dir === 2) { ellipse(c, x - 4, y - 3 + step * 1.6, 3.1, 3.8); c.fill(); ellipse(c, x + 4, y - 3 - step * 1.6, 3.1, 3.8); c.fill(); }
  else { ellipse(c, x + step * 4.2, y - 3, 3.8, 3.2); c.fill(); ellipse(c, x - step * 4.2, y - 3, 3.8, 3.2); c.fill(); }
  // corpo
  c.fillStyle = rgrad(c, x, by - 13, 1, 11, [[0, o.body1], [1, o.body2]], -3, -4);
  ellipse(c, x, by - 13, 8.6, 9.6); c.fill();
  c.strokeStyle = o.band1; c.lineWidth = 1.3;
  c.beginPath(); for (let k = 0; k <= 7; k++) c.lineTo(x - 7.5 + k * 2.15, by - 9 + (k % 2 ? -2 : 0)); c.stroke();
  c.strokeStyle = o.band2; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x - 7.8, by - 6.6); c.lineTo(x + 7.8, by - 6.6); c.stroke();
  // braços
  c.fillStyle = o.skin2;
  const sw = o.moving ? step * 3 : 0;
  if (dir === 0 || dir === 2) { circle(c, x - 9, by - 13 + sw, 2.8); c.fill(); circle(c, x + 9, by - 13 - sw, 2.8); c.fill(); }
  else { circle(c, x - (dir === 1 ? 2 : -2) + sw, by - 12, 2.8); c.fill(); }
  if (o.cape) { c.fillStyle = o.cape; c.beginPath(); c.moveTo(x - 9, by - 18); c.quadraticCurveTo(x, by - 4, x + 9, by - 18); c.lineTo(x + 8, by - 21); c.lineTo(x - 8, by - 21); c.fill(); }
  const hyy = by - 27;
  drawHead(c, x, hyy, dir, o);
  // faixa + pena
  c.strokeStyle = o.band; c.lineWidth = 2;
  c.beginPath(); c.arc(x, hyy - 1, 8.8, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
  if (o.feather) {
    const fx = dir === 1 ? x - 6 : dir === 3 ? x + 6 : x + 4, fy = hyy - 7;
    c.save(); c.translate(fx, fy); c.rotate(dir === 1 ? -0.5 : dir === 3 ? 0.5 : 0.25);
    c.fillStyle = '#e8352f'; ellipse(c, 0, -7, 2.4, 7.5); c.fill();
    c.fillStyle = '#2f7fd8'; ellipse(c, 0, -12, 1.8, 3); c.fill();
    c.restore();
  }
  if (dir === 2) drawScarf(c, o.scarf, ['#2fd3c1', '#23a99a']);
  if (!bladeBehind && !o.noBlade) drawBlade(c, hx, hy2, ba, len, o.atkAnim > 0 || o.spin > 0);
}

const HERO_LOOK = { skin1: '#d6996a', skin2: '#a96d44', hair: '#17110d', paint: '#d8342a', body1: '#d9692f', body2: '#7e2f17', band1: '#f3e2bf', band2: '#1d120c', band: '#d33a2a', feather: true };

function drawPlayer(c) {
  if (!P.alive && P.deadT > 1.0) return;
  const blink = P.inv > 0 && P.dashT <= 0 && Math.floor(G.real * 20) % 2 === 0;
  c.globalAlpha = (blink ? 0.45 : 1) * (P.alive ? 1 : clamp(1 - P.deadT, 0, 1));
  drawHero(c, P.x, P.y, Object.assign({ face: P.face, walkT: P.walkT, moving: Math.hypot(P.vx, P.vy) > 25, t: G.real, atkAnim: P.atkAnim, atkAngle: P.atkAngle, swingDir: P.swingDir, scarf: P.scarf, spin: P.spinT }, HERO_LOOK));
  c.globalAlpha = 1;
}

/* NPCs */
const NPC_LOOK = {
  jaci: { skin1: '#c48a5c', skin2: '#93603c', hair: '#e6e1d8', paint: '#c9312a', body1: '#5b4a86', body2: '#2c2246', band1: '#f1e9d6', band2: '#c9312a', band: '#c9312a', longHair: true, eyesClosed: true, cape: '#c9a24a' },
  rai: { skin1: '#d7a275', skin2: '#a5734c', hair: '#2a1d14', paint: 'rgba(0,0,0,0)', body1: '#4f86c4', body2: '#264a78', band1: 'rgba(0,0,0,0)', band2: '#2a1d14', band: 'rgba(0,0,0,0)' },
  curu: { skin1: '#9fb06a', skin2: '#6a7a3e', hair: '#d8381e', paint: '#2a1a0a', body1: '#4f8a3a', body2: '#22461c', band1: '#a7d36a', band2: '#22461c', band: 'rgba(0,0,0,0)' },
};
function drawNPC(c, n, scale) {
  const L = NPC_LOOK[n.id];
  const x = n.x, y = n.y;
  const face = Math.atan2(P.y - n.y, P.x - n.x);
  const near = dist(P.x, P.y, n.x, n.y) < 160;
  const o = Object.assign({ face: near ? face : Math.PI / 2, walkT: 0, moving: false, t: G.real + n.x, atkAnim: 0, atkAngle: 0, swingDir: 1, scarf: n.scarf, spin: 0, noBlade: true }, L);
  if (n.id === 'jaci') {
    // cajado
    c.strokeStyle = '#5a3b22'; c.lineWidth = 2.4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x + 12, y); c.lineTo(x + 14, y - 44); c.stroke();
    c.fillStyle = '#e8352f'; ellipse(c, x + 15, y - 47, 2, 5, 0.3); c.fill();
    c.fillStyle = '#ffd23f'; ellipse(c, x + 12, y - 46, 1.6, 4.4, -0.3); c.fill();
  }
  if (n.id === 'rai') {
    c.strokeStyle = '#6b4c2a'; c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(x + 6, y - 14); c.lineTo(x + 46, y - 46); c.stroke();
    c.strokeStyle = 'rgba(230,230,220,0.6)'; c.lineWidth = 0.6;
    const bob = Math.sin(G.real * 2) * 1.5;
    c.beginPath(); c.moveTo(x + 46, y - 46); c.quadraticCurveTo(x + 64, y - 20, x + 74, y + 6 + bob); c.stroke();
    c.fillStyle = '#e8352f'; circle(c, x + 74, y + 6 + bob, 2); c.fill();
  }
  if (n.id === 'curu') {
    // pés virados para trás
    c.fillStyle = '#6a7a3e';
    ellipse(c, x - 4, y - 1, 3, 4.5); c.fill(); ellipse(c, x + 4, y - 1, 3, 4.5); c.fill();
    c.fillStyle = '#4a5a2a'; for (const s of [-4, 4]) for (let k = -1; k <= 1; k++) { circle(c, x + s + k * 1.5, y - 5, 0.9); c.fill(); }
  }
  drawHero(c, x, y, o);
  if (n.id === 'rai') {
    const hy = y - 27 - Math.sin(G.real * 2.2) * 0.6;
    c.fillStyle = '#d9b867'; ellipse(c, x, hy - 3, 16, 6); c.fill();
    c.fillStyle = '#c29a48'; ellipse(c, x, hy - 7, 9, 6); c.fill();
    c.fillStyle = '#7a3a22'; c.fillRect(x - 9, hy - 6, 18, 2);
  }
  if (n.id === 'curu') {
    const hy = y - 27;
    for (let k = 0; k < 7; k++) {
      const a = -Math.PI / 2 + (k - 3) * 0.32, fl = 9 + Math.sin(G.real * 9 + k) * 3;
      c.fillStyle = k % 2 ? '#ff7a2a' : '#e8351e';
      c.beginPath(); c.moveTo(x + Math.cos(a - 0.3) * 7, hy - 2 + Math.sin(a - 0.3) * 7); c.lineTo(x + Math.cos(a) * (8 + fl), hy - 2 + Math.sin(a) * (8 + fl)); c.lineTo(x + Math.cos(a + 0.3) * 7, hy - 2 + Math.sin(a + 0.3) * 7); c.fill();
    }
  }
}

/* inimigos */
function drawEnemy(c, e) {
  const fl = e.flash > 0;
  const spawnK = e.spawnT > 0 ? 1 - e.spawnT / 0.6 : 1;
  if (spawnK < 1) c.globalAlpha = clamp(spawnK, 0, 1);
  const x = e.x, y = e.y - (e.z || 0);
  const F1 = (a) => (fl ? '#ffffff' : a);
  const fx = Math.cos(e.face), fy = Math.sin(e.face);
  if (e.type === 'espinho') {
    const hop = e.st === 'chase' ? Math.abs(Math.sin(e.t * 7)) * 5 : 0;
    const wob = e.st === 'wind' ? Math.sin(e.t * 70) * 1.6 : 0;
    const sq = e.st === 'wind' ? 0.82 : e.st === 'lunge' ? 1.12 : 1;
    const bx = x + wob, by = y - 12 - hop;
    for (let i = 0; i < 9; i++) {
      const a = i / 9 * TAU + Math.sin(e.t * 2) * 0.1;
      c.fillStyle = F1(i % 2 ? '#2a1236' : '#3b1a4c');
      c.beginPath(); c.moveTo(bx + Math.cos(a - 0.28) * 10, by + Math.sin(a - 0.28) * 9 * sq); c.lineTo(bx + Math.cos(a) * 19, by + Math.sin(a) * 17 * sq); c.lineTo(bx + Math.cos(a + 0.28) * 10, by + Math.sin(a + 0.28) * 9 * sq); c.fill();
      c.fillStyle = F1('#c25cff'); circle(c, bx + Math.cos(a) * 18, by + Math.sin(a) * 16 * sq, 1.2); c.fill();
    }
    c.fillStyle = fl ? '#fff' : rgrad(c, bx, by, 1, 13, [[0, '#6e3592'], [1, '#1c0b28']], -3, -4);
    ellipse(c, bx, by, 12 / Math.sqrt(sq), 11 * sq); c.fill();
    c.fillStyle = F1('#7fae3a');
    ellipse(c, bx - 3, by - 11 * sq - 2, 2.4, 5, -0.5); c.fill(); ellipse(c, bx + 3, by - 11 * sq - 2, 2.4, 5, 0.5); c.fill();
    c.fillStyle = F1('#ff4fd8');
    ellipse(c, bx - 4 + fx * 3, by - 1 + fy * 2, 2.2, e.st === 'wind' ? 1 : 2.6); c.fill();
    ellipse(c, bx + 4 + fx * 3, by - 1 + fy * 2, 2.2, e.st === 'wind' ? 1 : 2.6); c.fill();
  } else if (e.type === 'morcego') {
    const f = Math.sin(e.t * (e.st === 'swoop' ? 30 : 20));
    for (const s of [-1, 1]) {
      c.fillStyle = F1('#1d1029');
      c.beginPath(); c.moveTo(x + s * 3, y - 2); c.lineTo(x + s * 24, y - 10 - f * 9); c.lineTo(x + s * 19, y + 2 + f * 2); c.lineTo(x + s * 13, y - 1); c.lineTo(x + s * 9, y + 5); c.closePath(); c.fill();
      c.strokeStyle = F1('#4a2a66'); c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(x + s * 3, y - 2); c.lineTo(x + s * 19, y + 2 + f * 2); c.stroke();
    }
    c.fillStyle = F1('#2a1838'); circle(c, x, y, 6.5); c.fill();
    c.fillStyle = F1('#2a1838');
    c.beginPath(); c.moveTo(x - 5, y - 4); c.lineTo(x - 3, y - 11); c.lineTo(x - 1, y - 5); c.fill();
    c.beginPath(); c.moveTo(x + 5, y - 4); c.lineTo(x + 3, y - 11); c.lineTo(x + 1, y - 5); c.fill();
    c.fillStyle = F1('#d38bff'); circle(c, x - 2.4, y - 0.5, 1.4); c.fill(); circle(c, x + 2.4, y - 0.5, 1.4); c.fill();
  } else if (e.type === 'sapo') {
    const jump = (e.jumpT || 0) > 0 ? Math.sin((e.jumpT / 0.35) * Math.PI) * 8 : 0;
    const by = y - 9 - jump;
    c.fillStyle = F1('#24331a');
    ellipse(c, x - 9, by + 5, 5, 3.4, -0.4); c.fill(); ellipse(c, x + 9, by + 5, 5, 3.4, 0.4); c.fill();
    c.fillStyle = fl ? '#fff' : rgrad(c, x, by, 1, 14, [[0, '#5e7f36'], [1, '#1d2c14']], -3, -4);
    ellipse(c, x, by, 13, 10); c.fill();
    c.fillStyle = F1('#b65bff');
    for (let i = 0; i < 6; i++) { const a = i * 1.1 + 0.4; circle(c, x + Math.cos(a) * 7, by + Math.sin(a) * 5 - 1, 1.3 + (i % 2)); c.fill(); }
    if (e.st === 'spit') { const k = 1 - e.timer / 0.55; c.fillStyle = F1('#e07ad8'); circle(c, x + fx * 8, by + 5 + fy * 4, 3 + k * 5); c.fill(); }
    for (const s of [-1, 1]) {
      const ex = x + s * 5.5 + fx * 4, ey = by - 7 + fy * 3;
      c.fillStyle = F1('#e8d34a'); circle(c, ex, ey, 3.6); c.fill();
      c.fillStyle = '#120a06'; ellipse(c, ex + fx, ey + fy, 0.8, 2.6); c.fill();
    }
  } else if (e.type === 'bruto') {
    const wob = (e.st === 'cwind' || e.st === 'swind') ? Math.sin(e.t * 60) * 2 : 0;
    const walk = e.st === 'chase' ? Math.sin(e.t * 6) : 0;
    const bx = x + wob, by = y - 22;
    c.fillStyle = F1('#3a2a1c');
    ellipse(c, x - 8, y - 4 + walk * 2, 6, 5); c.fill(); ellipse(c, x + 8, y - 4 - walk * 2, 6, 5); c.fill();
    for (const s of [-1, 1]) {
      c.fillStyle = F1(s < 0 ? '#4a3626' : '#3a2a1c');
      c.save(); c.translate(bx + s * 19, by + 2); c.rotate(s * 0.3 + walk * 0.3 * s + (e.st === 'swind' ? -s * 0.8 : 0));
      c.fillRect(-5, -4, 10, 22); c.restore();
    }
    const g = fl ? '#fff' : c.createLinearGradient(bx - 18, 0, bx + 18, 0);
    if (!fl) { g.addColorStop(0, '#2e2016'); g.addColorStop(0.4, '#6b5038'); g.addColorStop(1, '#241810'); }
    c.fillStyle = g;
    c.beginPath(); c.roundRect ? c.roundRect(bx - 18, by - 22, 36, 42, 10) : c.rect(bx - 18, by - 22, 36, 42); c.fill();
    c.strokeStyle = 'rgba(20,10,5,0.5)'; c.lineWidth = 1;
    for (let k = -12; k <= 12; k += 6) { c.beginPath(); c.moveTo(bx + k, by - 18); c.lineTo(bx + k + 1, by + 16); c.stroke(); }
    c.fillStyle = F1('#4e8a3a');
    for (let k = 0; k < 5; k++) { circle(c, bx - 14 + k * 7, by - 21 + (k % 2) * 2, 5); c.fill(); }
    c.strokeStyle = `rgba(185,90,255,${0.5 + Math.sin(e.t * 4) * 0.3})`; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(bx - 12, by + 14); c.lineTo(bx - 6, by + 6); c.lineTo(bx - 9, by - 2); c.lineTo(bx - 3, by - 8); c.stroke();
    c.beginPath(); c.moveTo(bx + 13, by + 12); c.lineTo(bx + 7, by + 4); c.lineTo(bx + 10, by - 4); c.stroke();
    c.fillStyle = '#120804';
    c.beginPath(); c.moveTo(bx - 11, by - 6); c.lineTo(bx + 11, by - 6); c.lineTo(bx + 6, by + 2); c.lineTo(bx - 6, by + 2); c.closePath(); c.fill();
    const hot = e.st === 'cwind' || e.st === 'charge' || e.st === 'swind';
    c.fillStyle = hot ? '#ff4a2a' : '#ffb02e';
    ellipse(c, bx - 5 + fx * 2, by - 3, 2.6, hot ? 1.6 : 2.2); c.fill(); ellipse(c, bx + 5 + fx * 2, by - 3, 2.6, hot ? 1.6 : 2.2); c.fill();
    if (e.st === 'stunned') {
      for (let k = 0; k < 3; k++) { const a = G.real * 5 + k * TAU / 3; c.fillStyle = '#ffe36a'; circle(c, bx + Math.cos(a) * 14, by - 30 + Math.sin(a) * 4, 2); c.fill(); }
    }
  } else if (e.type === 'fatuo') {
    const by = y - 6;
    const fl2 = Math.sin(e.t * 17) * 2;
    c.fillStyle = fl ? '#fff' : rgrad(c, x, by, 1, 14, [[0, '#fff7d0'], [0.45, '#ffb347'], [1, 'rgba(255,90,31,0.2)']], 0, 3);
    c.beginPath(); c.moveTo(x, by - 22 - fl2);
    c.quadraticCurveTo(x + 13, by - 4, x + 9, by + 5);
    c.quadraticCurveTo(x, by + 12, x - 9, by + 5);
    c.quadraticCurveTo(x - 13, by - 4, x, by - 22 - fl2); c.fill();
    c.fillStyle = '#3a1406'; ellipse(c, x - 3 + fx * 2, by + 1, 1.3, 2.2); c.fill(); ellipse(c, x + 3 + fx * 2, by + 1, 1.3, 2.2); c.fill();
  }
  // barra de vida curta
  if (e.hp < e.hpMax && !e.dead) {
    const w = Math.max(20, e.r * 2), yy = y - e.hh * 2 - 16 - (e.type === 'bruto' ? 6 : 0);
    c.fillStyle = 'rgba(10,6,14,0.7)'; c.fillRect(x - w / 2 - 1, yy - 1, w + 2, 4);
    c.fillStyle = '#c25cff'; c.fillRect(x - w / 2, yy, w * clamp(e.hp / e.hpMax, 0, 1), 2);
  }
  c.globalAlpha = 1;
}

/* totens */
function drawTotem(c, t) {
  const awake = t.state === 'awake';
  const x = t.x, y = t.y;
  const pulse = 0.5 + Math.sin(t.glowT * 3) * 0.5;
  const wood1 = awake ? '#8a5a32' : '#4d3f3a', wood2 = awake ? '#3e2512' : '#231b1c';
  const g = c.createLinearGradient(x - 11, 0, x + 11, 0); g.addColorStop(0, wood2); g.addColorStop(0.45, wood1); g.addColorStop(1, wood2);
  c.fillStyle = g; c.fillRect(x - 10, y - 70, 20, 70);
  const pc = awake ? (t.id === 'onca' ? ['#e7a93a', '#1d140f', '#f3e2bf'] : t.id === 'arara' ? ['#e8352f', '#2f7fd8', '#ffd23f'] : ['#5fae4c', '#e7c46a', '#24472a']) : ['#5a4b55', '#2b2228', '#6c5d68'];
  for (let i = 0; i < 3; i++) {
    const yy = y - 66 + i * 22;
    c.fillStyle = pc[i % 3]; c.fillRect(x - 10, yy, 20, 3);
    c.fillStyle = pc[(i + 1) % 3];
    c.beginPath(); for (let k = 0; k < 5; k++) { c.lineTo(x - 10 + k * 5, yy + 8 + (k % 2 ? 4 : 0)); } c.lineTo(x + 10, yy + 8); c.lineTo(x + 10, yy + 6); for (let k = 4; k >= 0; k--) c.lineTo(x - 10 + k * 5, yy + 6 + (k % 2 ? 4 : 0)); c.fill();
    c.fillStyle = pc[(i + 2) % 3]; c.fillRect(x - 6, yy + 13, 3, 3); c.fillRect(x + 3, yy + 13, 3, 3);
  }
  const hy = y - 84;
  if (t.id === 'onca') {
    c.fillStyle = awake ? '#e7a93a' : '#6b5d60';
    circle(c, x - 11, hy - 10, 5); c.fill(); circle(c, x + 11, hy - 10, 5); c.fill();
    c.fillStyle = awake ? rgrad(c, x, hy, 2, 18, [[0, '#f6c463'], [1, '#b8741e']], -4, -5) : '#5e5156';
    ellipse(c, x, hy, 16, 14); c.fill();
    c.fillStyle = '#1d140f';
    for (const [dx, dy] of [[-9, -5], [8, -6], [-11, 4], [11, 3], [0, -10]]) { circle(c, x + dx, hy + dy, 1.8); c.fill(); }
    c.fillStyle = awake ? '#f3e2bf' : '#8a8088'; ellipse(c, x, hy + 7, 7, 5); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.moveTo(x - 4, hy + 8); c.lineTo(x - 2.5, hy + 13); c.lineTo(x - 1, hy + 8); c.moveTo(x + 4, hy + 8); c.lineTo(x + 2.5, hy + 13); c.lineTo(x + 1, hy + 8); c.fill();
    c.fillStyle = '#2a1a10'; ellipse(c, x, hy + 3, 3, 2); c.fill();
  } else if (t.id === 'arara') {
    for (let k = 0; k < 5; k++) { c.fillStyle = awake ? ['#2f7fd8', '#ffd23f', '#e8352f', '#ffd23f', '#2f7fd8'][k] : '#5a4b55'; c.save(); c.translate(x, hy - 8); c.rotate((k - 2) * 0.32); ellipse(c, 0, -12, 3, 11); c.fill(); c.restore(); }
    c.fillStyle = awake ? rgrad(c, x, hy, 2, 16, [[0, '#ff5a44'], [1, '#b81e1a']], -4, -5) : '#5e5156';
    ellipse(c, x, hy, 13, 14); c.fill();
    c.fillStyle = awake ? '#f6f0e4' : '#8a8088'; ellipse(c, x - 5, hy - 1, 5, 6); c.fill(); ellipse(c, x + 5, hy - 1, 5, 6); c.fill();
    c.fillStyle = awake ? '#3a3a3a' : '#2a2228';
    c.beginPath(); c.moveTo(x - 5, hy + 3); c.quadraticCurveTo(x, hy - 1, x + 5, hy + 3); c.quadraticCurveTo(x + 4, hy + 14, x, hy + 17); c.quadraticCurveTo(x - 2, hy + 10, x - 5, hy + 3); c.fill();
  } else {
    c.fillStyle = awake ? '#8a6a3a' : '#5e5156'; ellipse(c, x, hy + 10, 7, 6); c.fill();
    c.fillStyle = awake ? rgrad(c, x, hy - 4, 2, 22, [[0, '#7fae4a'], [1, '#3a5a22']], -5, -6) : '#4e4248';
    c.beginPath(); c.ellipse(x, hy + 2, 20, 16, 0, Math.PI, TAU); c.closePath(); c.fill();
    c.strokeStyle = awake ? '#e7c46a' : '#2b2228'; c.lineWidth = 1.2;
    for (let k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(x + k * 9 - 4, hy - 4); c.lineTo(x + k * 9, hy - 8); c.lineTo(x + k * 9 + 4, hy - 4); c.lineTo(x + k * 9, hy); c.closePath(); c.stroke(); }
    c.fillStyle = awake ? '#8a6a3a' : '#5e5156'; c.fillRect(x - 20, hy + 1, 40, 3);
  }
  // olhos
  c.fillStyle = awake ? (t.col === 'gold' ? '#fff3b0' : t.col === 'red' ? '#fff' : '#eaffb0') : `rgba(200,110,255,${0.6 + pulse * 0.4})`;
  circle(c, x - 4.5, hy - 2, 1.8); c.fill(); circle(c, x + 4.5, hy - 2, 1.8); c.fill();
  if (!awake) {
    c.strokeStyle = `rgba(170,80,255,${0.45 + pulse * 0.4})`; c.lineWidth = 1.3;
    c.beginPath(); c.moveTo(x - 8, y - 4); c.lineTo(x - 3, y - 22); c.lineTo(x - 7, y - 36); c.lineTo(x - 1, y - 52); c.lineTo(x - 4, y - 70); c.stroke();
    c.beginPath(); c.moveTo(x + 8, y - 8); c.lineTo(x + 4, y - 30); c.lineTo(x + 8, y - 46); c.stroke();
    c.strokeStyle = '#2b4a2a'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x - 11, y - 2); c.bezierCurveTo(x + 14, y - 18, x - 16, y - 34, x + 11, y - 50); c.stroke();
  }
}

/* Boitatá */
function drawBoss(c, B) {
  const pur = B.st === 'purified';
  const k = B.st === 'intro' ? B.emerge : 1;
  const pal = pur ? ['#f2fbff', '#7fd8ff', '#2a5fd8'] : B.phase === 2 ? ['#fff0c0', '#ff6a3a', '#9a1846'] : ['#fff3b8', '#ff9a3a', '#c2321a'];
  const fl = B.flash > 0;
  for (let i = B.segs.length - 1; i >= 0; i--) {
    const s = B.segs[i];
    const r = s.r * k * (pur ? 0.7 : 1);
    if (r < 1) continue;
    const yy = s.y - 10 - (pur ? 60 : 0) + Math.sin(B.t * 4 + i * 0.5) * 2;
    c.fillStyle = fl ? '#ffffff' : rgrad(c, s.x, yy, r * 0.1, r, [[0, pal[0]], [0.55, pal[1]], [1, pal[2]]], -r * 0.2, -r * 0.35);
    circle(c, s.x, yy, r); c.fill();
    if (i > 0 && !pur) {
      c.strokeStyle = 'rgba(90,10,10,0.35)'; c.lineWidth = 1.2;
      c.beginPath(); c.arc(s.x, yy + r * 0.2, r * 0.7, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    }
    const fh = r * (0.7 + Math.sin(B.t * 11 + i) * 0.25);
    c.fillStyle = fl ? '#fff' : pal[0];
    c.globalAlpha = 0.85;
    c.beginPath(); c.moveTo(s.x - r * 0.4, yy - r * 0.5); c.quadraticCurveTo(s.x, yy - r * 0.6 - fh * 1.4, s.x + r * 0.15, yy - r * 0.6 - fh); c.quadraticCurveTo(s.x + r * 0.2, yy - r * 0.5, s.x + r * 0.4, yy - r * 0.5); c.fill();
    c.globalAlpha = 1;
  }
  // cabeça
  const H = B.segs[0];
  const r = H.r * k * (pur ? 0.7 : 1);
  if (r > 2) {
    const yy = H.y - 10 - (pur ? 60 : 0);
    const a = B.ang;
    c.save(); c.translate(H.x, yy); c.rotate(a);
    c.fillStyle = fl ? '#fff' : rgrad(c, r * 0.4, 0, 2, r * 1.3, [[0, pal[0]], [0.6, pal[1]], [1, pal[2]]], -r * 0.2, -r * 0.3);
    c.beginPath(); c.ellipse(r * 0.45, 0, r * 1.15, r * 0.82, 0, 0, TAU); c.fill();
    c.fillStyle = pur ? '#1a3a7a' : '#4a0a0a';
    c.beginPath(); c.moveTo(r * 1.4, -r * 0.18); c.lineTo(r * 0.7, 0); c.lineTo(r * 1.4, r * 0.18); c.fill();
    for (const s of [-1, 1]) {
      c.fillStyle = '#ffffff'; ellipse(c, r * 0.55, s * r * 0.42, r * 0.36, r * 0.27); c.fill();
      c.fillStyle = pur ? '#ffd27a' : (B.phase === 2 ? '#ff2fb0' : '#38d8ff'); ellipse(c, r * 0.62, s * r * 0.42, r * 0.17, r * 0.2); c.fill();
      c.fillStyle = pal[0];
      c.beginPath(); c.moveTo(-r * 0.2, s * r * 0.5); c.quadraticCurveTo(-r * 0.9, s * r * 1.3, -r * 1.3, s * r * 1.05); c.quadraticCurveTo(-r * 0.6, s * r * 0.8, -r * 0.1, s * r * 0.35); c.fill();
    }
    c.restore();
  }
}

/* coletáveis e projéteis (parte opaca) */
function drawPickup(c, k) {
  const y = k.y - k.z - 4 + Math.sin(k.t * 4) * 1.5;
  if (k.type === 'seed') {
    c.fillStyle = rgrad(c, k.x, y, 0.5, 4.5, [[0, '#fffbe0'], [0.5, '#ffd27a'], [1, '#c98a1e']]);
    ellipse(c, k.x, y, 3.2, 4.4, 0.4); c.fill();
  } else {
    c.fillStyle = '#6b4526'; ellipse(c, k.x, y + 2, 7, 4); c.fill();
    c.fillStyle = '#4fe08a'; ellipse(c, k.x, y, 5.5, 2.5); c.fill();
  }
}
function drawProj(c, p) {
  if (p.type === 'goo') {
    c.fillStyle = '#7a3fb0'; circle(c, p.x, p.y, 6); c.fill();
    c.fillStyle = '#c47aff'; circle(c, p.x - 1.5, p.y - 1.5, 2.4); c.fill();
  } else if (p.type === 'feather') {
    const a = Math.atan2(p.vy, p.vx);
    c.save(); c.translate(p.x, p.y); c.rotate(a);
    c.fillStyle = p.col === 'red' ? '#ff4a3a' : p.col === 'gold' ? '#ffd23f' : '#3f8fff';
    ellipse(c, 0, 0, 9, 2.6); c.fill();
    c.fillStyle = '#fff'; c.fillRect(-9, -0.4, 12, 0.8);
    c.restore();
  } else if (p.type === 'fire' || p.type === 'bossfire') {
    c.fillStyle = '#fff3c0'; circle(c, p.x, p.y, p.r * 0.55); c.fill();
  }
}

/* ---------- luz ---------- */
const AMB_KEYS = [[0, [60, 70, 122]], [0.2, [66, 74, 128]], [0.255, [200, 146, 156]], [0.32, [250, 236, 222]], [0.5, [255, 252, 246]], [0.66, [255, 228, 190]], [0.735, [236, 156, 126]], [0.79, [108, 90, 146]], [0.84, [62, 70, 124]], [1, [60, 70, 122]]];
function ambientAt(tod) {
  for (let i = 0; i < AMB_KEYS.length - 1; i++) {
    const a = AMB_KEYS[i], b = AMB_KEYS[i + 1];
    if (tod >= a[0] && tod <= b[0]) return mixc(a[1], b[1], smooth(0, 1, (tod - a[0]) / (b[0] - a[0])));
  }
  return AMB_KEYS[0][1];
}
function computeAmbient() {
  let a = ambientAt(G.tod);
  const R = regionW(G.cam.x, G.cam.y);
  a = mixc(a, shade(a, 0.8), R.north * 0.8);
  a = mixc(a, [a[0], a[1] * 0.8, a[2] * 0.72], R.ash * 0.6);
  a = mixc(a, shade(a, 0.75), G.weather.rain * 0.8);
  if (G.boss && G.flags.bossStarted && G.boss.st !== 'purified' && dist(G.cam.x, G.cam.y, LOC.arena.x, LOC.arena.y) < 900) a = mixc(a, [120, 50, 60], 0.55);
  if (G.boss && G.boss.st === 'purified') a = mixc(a, [255, 240, 220], clamp(G.boss.pur / 4, 0, 0.7));
  G.amb = a;
  G.dark = 1 - (a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11) / 255;
}

const LIGHTS = [], GLOWS = [];
function addLight(x, y, r, col, a) { LIGHTS.push(x, y, r, col, a); }
function addGlow(x, y, r, col, a) { GLOWS.push(x, y, r, col, a); }

let flies = [];
function updateFlies(dt, vx, vy, vw, vh) {
  const n = [12, 26, 42][G.quality];
  while (flies.length < n) flies.push({ x: vx + Math.random() * vw, y: vy + Math.random() * vh, ph: Math.random() * TAU, a: Math.random() * TAU, sp: rand(10, 26) });
  if (flies.length > n) flies.length = n;
  for (const f of flies) {
    f.a += (Noise.n2(f.x * 0.01, G.real * 0.3 + f.ph) * 3) * dt;
    f.x += Math.cos(f.a) * f.sp * dt; f.y += Math.sin(f.a) * f.sp * dt;
    if (f.x < vx - 120 || f.x > vx + vw + 120 || f.y < vy - 120 || f.y > vy + vh + 120 || wdepAt(f.x, f.y) > 40) {
      f.x = vx + Math.random() * vw; f.y = vy + Math.random() * vh;
    }
  }
}

function gatherLights(vx, vy, vw, vh, visProps) {
  LIGHTS.length = 0; GLOWS.length = 0;
  const dk = G.dark, t = G.real;
  // jogador
  addLight(P.x, P.y - 16, 215, 'warm', 0.3 + dk * 0.7);
  if (P.shield > 0) { addLight(P.x, P.y - 14, 60, 'green', 0.5); }
  // fogueira da aldeia
  const fx = LOC.village.x, fy = LOC.village.y;
  if (fx > vx - 400 && fx < vx + vw + 400 && fy > vy - 400 && fy < vy + vh + 400) {
    const fl = 0.85 + Math.sin(t * 13) * 0.07 + Math.sin(t * 7.3) * 0.08;
    addLight(fx, fy, 330 * fl, 'fire', 0.5 + dk * 0.5);
    addLight(fx, fy, 120, 'gold', 0.6);
    addGlow(fx, fy - 8, 46 * fl, 'fire', 0.7);
    addGlow(fx, fy - 12, 22, 'gold', 0.9);
  }
  if (gateClosed() && !G.flags.bossDone) {
    const gx = LOC.arena.x, gy = LOC.arena.y - (RING_IN + RING_OUT) / 2;
    if (gx > vx - 300 && gx < vx + vw + 300 && gy > vy - 300 && gy < vy + vh + 300) {
      const col = G.flags.bossStarted ? 'fire' : 'magenta';
      for (let i = -1; i <= 1; i++) addLight(gx + i * 80, gy, 170, col, 0.55 + dk * 0.4);
    }
  }
  for (const n of G.npcs) if (n.id === 'curu') { addLight(n.x, n.y - 32, 70, 'fire', 0.3 + dk * 0.5); addGlow(n.x, n.y - 34, 16, 'fire', 0.5); }
  for (const tt of G.totems) {
    if (tt.x < vx - 300 || tt.x > vx + vw + 300 || tt.y < vy - 300 || tt.y > vy + vh + 300) continue;
    const pulse = 0.7 + Math.sin(tt.glowT * 3) * 0.3;
    if (tt.state === 'awake') { addLight(tt.x, tt.y - 50, 260, tt.col, 0.5 + dk * 0.5); addGlow(tt.x, tt.y - 84, 34, tt.col, 0.6 * pulse); }
    else { addLight(tt.x, tt.y - 50, 180, 'purple', (0.35 + dk * 0.5) * pulse); addGlow(tt.x, tt.y - 84, 26, 'purple', 0.5 * pulse); }
  }
  for (const p of visProps) {
    const s = spriteOf(p);
    if (!s || !s.glows || !s.glows.length) continue;
    if (p.type === 'mushroom') {
      if (dk < 0.25) continue;
      addLight(p.x, p.y - 8, 70, 'cyan', dk * 0.7);
      for (const g of s.glows) addGlow(p.x + g.dx, p.y + g.dy, g.r * 3.2, 'cyan', dk * (0.5 + Math.sin(t * 2 + p.seed) * 0.2));
    } else {
      for (const g of s.glows) addGlow(p.x + g.dx, p.y + g.dy, 10, 'ember', 0.4 + Math.sin(t * 4 + p.seed + g.dy) * 0.3);
      addLight(p.x, p.y - 20, 50, 'ember', 0.25 + dk * 0.3);
    }
  }
  for (const e of G.enemies) {
    if (e.dead) continue;
    const ey = e.y - (e.z || 0);
    if (e.type === 'fatuo') { addLight(e.x, ey - 6, 130, 'fire', 0.55 + dk * 0.4); addGlow(e.x, ey - 8, 30, 'fire', 0.75); addGlow(e.x, ey - 6, 12, 'gold', 0.8); }
    else if (e.type === 'espinho') { addGlow(e.x, ey - 13, 9, 'magenta', 0.45 + dk * 0.4); }
    else if (e.type === 'morcego') { addGlow(e.x, ey, 8, 'purple', 0.4 + dk * 0.5); }
    else if (e.type === 'sapo') { addGlow(e.x, ey - 9, 14, 'purple', 0.2 + dk * 0.4); }
    else if (e.type === 'bruto') { addGlow(e.x, ey - 25, 12, (e.st === 'cwind' || e.st === 'charge') ? 'red' : 'gold', 0.4 + dk * 0.5); addLight(e.x, ey - 22, 60, 'purple', dk * 0.4); }
  }
  for (const p of G.projs) {
    if (p.type === 'fire' || p.type === 'bossfire') { addLight(p.x, p.y, 80, 'fire', 0.5 + dk * 0.4); addGlow(p.x, p.y, p.r * 3, 'fire', 0.9); addGlow(p.x, p.y, p.r * 1.3, 'gold', 0.8); }
    else if (p.type === 'feather') { addLight(p.x, p.y, 50, p.col, 0.4); addGlow(p.x, p.y, 16, p.col, 0.6); }
    else if (p.type === 'goo') { addGlow(p.x, p.y, 16, 'purple', 0.5); }
  }
  for (const h of G.hazards) {
    if (h.type === 'flame') { addLight(h.x, h.y - 10, 90, 'fire', 0.4 + dk * 0.3); addGlow(h.x, h.y - 6, h.r * 1.5, 'fire', 0.35 * clamp(h.life, 0, 1)); }
  }
  const B = G.boss;
  if (B && B.st !== 'dormant') {
    const pur = B.st === 'purified';
    const col = pur ? 'cyan' : (B.phase === 2 ? 'magenta' : 'fire');
    const k = B.st === 'intro' ? B.emerge : 1;
    for (let i = 0; i < B.segs.length; i += 2) {
      const s = B.segs[i];
      addLight(s.x, s.y - (pur ? 70 : 10), s.r * 6 * k, pur ? 'cyan' : 'fire', 0.5 + dk * 0.3);
    }
    for (const s of B.segs) addGlow(s.x, s.y - 10 - (pur ? 60 : 0), s.r * 2.3 * k, col, 0.42);
    const H = B.segs[0];
    addGlow(H.x, H.y - 10 - (pur ? 60 : 0), 70 * k, pur ? 'gold' : 'fire', 0.5);
  }
  // fireflies
  const fk = clamp((dk - 0.2) * 1.6, 0, 1) + regionW(G.cam.x, G.cam.y).north * 0.25;
  if (fk > 0.02) for (const f of flies) {
    const b = (0.5 + 0.5 * Math.sin(t * 2.6 + f.ph)) * fk;
    if (b < 0.05) continue;
    addGlow(f.x, f.y, 9, 'firefly', b);
    addLight(f.x, f.y, 34, 'firefly', b * 0.5);
  }
  // golpes
  for (const s of G.slashes) addLight(s.x + Math.cos(s.ang) * 20, s.y + Math.sin(s.ang) * 20, 110, s.col === 'fire' ? 'fire' : s.col === 'gold' ? 'gold' : 'cyan', 0.5 * (1 - s.t / s.dur));
  for (const p of G.parts) if (p.glow && (p.type === 'flame') && Math.random() < 0.5) addLight(p.x, p.y, 40, 'fire', 0.3);
}

function renderLighting(camx, camy) {
  const a = G.amb;
  lctx.globalCompositeOperation = 'source-over';
  lctx.fillStyle = rgb(a); lctx.fillRect(0, 0, LW, LH);
  if (G.weather.flash > 0) { lctx.fillStyle = `rgba(230,235,255,${G.weather.flash})`; lctx.fillRect(0, 0, LW, LH); }
  lctx.globalCompositeOperation = 'lighter';
  const ls = S / LIGHT_DIV;
  for (let i = 0; i < LIGHTS.length; i += 5) {
    const x = (LIGHTS[i] - camx) * ls + LW / 2, y = (LIGHTS[i + 1] - camy) * ls + LH / 2, r = LIGHTS[i + 2] * ls;
    if (x + r < 0 || y + r < 0 || x - r > LW || y - r > LH) continue;
    lctx.globalAlpha = clamp(LIGHTS[i + 4], 0, 1);
    lctx.drawImage(GLOW[LIGHTS[i + 3]] || GLOW.warm, x - r, y - r, r * 2, r * 2);
  }
  lctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(lightC, 0, 0, LW, LH, 0, 0, LW * LIGHT_DIV, LH * LIGHT_DIV);
  ctx.globalCompositeOperation = 'source-over';
}

/* ---------- partículas ---------- */
function drawParticles(c, glowPass) {
  for (const p of G.parts) {
    if (!!p.glow !== glowPass) continue;
    const k = p.life / p.max;
    const y = p.y - (p.z || 0);
    if (p.type === 'smoke') {
      const spr = p.sp === 'p' ? SMOKE_P : SMOKE_SPR;
      c.globalAlpha = k * (p.sp === 'p' ? 0.6 : 0.5);
      if (p.sp === 'd' || p.sp === 'g') {
        c.fillStyle = p.tint || 'rgba(60,55,55,0.5)';
        circle(c, p.x, y, p.size * 0.5); c.fill();
      } else c.drawImage(spr, p.x - p.size, y - p.size, p.size * 2, p.size * 2);
    } else if (p.type === 'leaf') {
      c.globalAlpha = Math.min(1, k * 2);
      c.fillStyle = p.col;
      ellipse(c, p.x, y, 2.6, 1.3, p.rot + G.real * 6); c.fill();
    } else if (p.type === 'dot') {
      c.globalAlpha = k; c.fillStyle = p.col; circle(c, p.x, y, p.size * k + 0.3); c.fill();
    } else if (p.type === 'spark') {
      const spr = GLOW[p.col] || GLOW.white;
      c.globalAlpha = k;
      c.strokeStyle = rgb(GCOL[p.col] || [255, 255, 255]);
      c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(p.x, y); c.lineTo(p.x - p.vx * 0.035, y - p.vy * 0.035); c.stroke();
      c.drawImage(spr, p.x - 4, y - 4, 8, 8);
    } else if (p.type === 'ember' || p.type === 'mote' || p.type === 'flame') {
      const spr = GLOW[p.col] || GLOW.fire;
      const fl = p.type === 'ember' ? 0.6 + Math.random() * 0.4 : 1;
      c.globalAlpha = (p.type === 'mote' ? Math.min(1, k * 1.6) : k) * fl;
      const s = p.type === 'flame' ? p.size * (0.5 + k) : p.size * 2.4;
      const sway = p.type === 'mote' ? Math.sin(G.real * 3 + p.max * 10) * 4 : 0;
      c.drawImage(spr, p.x + sway - s, y - s, s * 2, s * 2);
    } else if (p.type === 'ring') {
      const r = lerp(p.size2 || 40, p.size, k);
      c.globalAlpha = k;
      c.strokeStyle = GCOL[p.col] ? rgb(GCOL[p.col]) : p.col;
      c.lineWidth = 2 + 4 * k;
      ellipse(c, p.x, y, r, r * 0.62); c.stroke();
    }
  }
  c.globalAlpha = 1;
}

function drawSlashes(c) {
  for (const s of G.slashes) {
    const k = s.t / s.dur;
    const col = s.col === 'fire' ? [255, 150, 60] : s.col === 'gold' ? [255, 215, 120] : [140, 255, 240];
    if (s.spin) {
      const a0 = s.t * 26;
      for (let i = 0; i < 3; i++) {
        c.strokeStyle = rgb(col, (1 - k) * (0.7 - i * 0.2));
        c.lineWidth = 7 - i * 2;
        c.beginPath(); c.ellipse(s.x, s.y + 4, s.range * (0.7 + k * 0.3), s.range * 0.6 * (0.7 + k * 0.3), 0, a0 + i * 0.4, a0 + i * 0.4 + 4.2); c.stroke();
      }
      continue;
    }
    const sweep = easeOut(clamp(k * 1.6, 0, 1));
    const a0 = s.ang - s.dir * s.arc / 2;
    const aEnd = a0 + s.dir * s.arc * sweep;
    const aStart = s.dir > 0 ? Math.max(a0, aEnd - 1.8) : Math.min(a0, aEnd + 1.8);
    const fade = 1 - clamp((k - 0.4) / 0.6, 0, 1);
    const rIn = s.range * 0.35, rOut = s.range * (s.heavy ? 1.05 : 1);
    const steps = 14;
    c.beginPath();
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, aa = lerp(aStart, aEnd, t), rr = lerp(rOut * 0.85, rOut, t);
      const px = s.x + Math.cos(aa) * rr, py = s.y + Math.sin(aa) * rr * 0.8;
      if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
    }
    for (let i = steps; i >= 0; i--) {
      const t = i / steps, aa = lerp(aStart, aEnd, t);
      const rr = lerp(rOut * 0.8, rIn + (rOut - rIn) * 0.55, t * t);
      c.lineTo(s.x + Math.cos(aa) * rr, s.y + Math.sin(aa) * rr * 0.8);
    }
    c.closePath();
    c.fillStyle = rgb(col, 0.55 * fade);
    c.fill();
    c.strokeStyle = rgb([255, 255, 255], 0.8 * fade); c.lineWidth = 1.2; c.stroke();
  }
}

/* ---------- atmosfera ---------- */
let rainDrops = [];
function drawRain(dt) {
  const r = G.weather.rain;
  if (r < 0.02) return;
  const n = Math.floor([60, 120, 180][G.quality] * r);
  while (rainDrops.length < n) rainDrops.push({ x: Math.random() * W, y: Math.random() * H, s: rand(0.7, 1.2) });
  rainDrops.length = Math.min(rainDrops.length, n);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = `rgba(190,210,230,${0.35 * r})`; ctx.lineWidth = 1 * RS;
  ctx.beginPath();
  for (const d of rainDrops) {
    d.x += -180 * RS * dt * d.s; d.y += 900 * RS * dt * d.s;
    if (d.y > H || d.x < 0) {
      if (Math.random() < 0.3) G.splashes.push({ x: d.x, y: d.y - rand(0, H * 0.4), t: 0 });
      d.x = Math.random() * W * 1.2; d.y = -10;
    }
    ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 5 * RS, d.y - 22 * RS * d.s);
  }
  ctx.stroke();
  ctx.strokeStyle = `rgba(200,220,240,${0.3 * r})`;
  for (let i = G.splashes.length - 1; i >= 0; i--) {
    const s = G.splashes[i]; s.t += dt;
    if (s.t > 0.3) { G.splashes.splice(i, 1); continue; }
    ctx.beginPath(); ctx.ellipse(s.x, s.y, s.t * 30 * RS, s.t * 12 * RS, 0, 0, TAU); ctx.stroke();
  }
}
G.splashes = [];

function drawAtmosphere(dt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const R = regionW(G.cam.x, G.cam.y);
  // raios de sol
  const day = 1 - G.dark;
  if (G.quality > 0 && day > 0.4 && G.weather.rain < 0.3) {
    ctx.globalCompositeOperation = 'lighter';
    const k = (day - 0.4) * (0.1 + R.north * 0.12 + 0.03);
    for (let i = 0; i < 4; i++) {
      const x = ((i * 0.31 + 0.1) * W + Math.sin(G.real * 0.1 + i) * 40 * RS - (G.cam.x * S * 0.15) % (W * 0.3));
      ctx.save(); ctx.translate(x, -20 * RS); ctx.rotate(0.45);
      ctx.globalAlpha = k * (0.6 + 0.4 * Math.sin(G.real * 0.4 + i * 2));
      ctx.drawImage(BEAM, -60 * RS, 0, 120 * RS * (1 + i % 2), H * 1.4);
      ctx.restore();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // névoa
  const fog = clamp(G.dark * 0.5 + R.north * 0.25 + G.weather.rain * 0.2 + R.ash * 0.2, 0, 0.6);
  if (fog > 0.05 && G.quality > 0) {
    const col = R.ash > 0.5 ? 'rgba(120,80,90,1)' : G.dark > 0.5 ? 'rgba(140,160,200,1)' : 'rgba(220,230,220,1)';
    void col;
    for (let i = 0; i < 5; i++) {
      const s = (420 + i * 90) * RS;
      const x = ((i * 397 - G.cam.x * S * 0.4 + G.real * 12 * RS * (i % 2 ? 1 : -1)) % (W + s * 2) + (W + s * 2)) % (W + s * 2) - s;
      const y = ((i * 211 - G.cam.y * S * 0.4) % (H + s) + (H + s)) % (H + s) - s / 2;
      ctx.globalAlpha = fog * 0.16;
      ctx.drawImage(SMOKE_SPR, x - s, y - s * 0.5, s * 2, s);
    }
    ctx.globalAlpha = 1;
  }
  drawRain(dt);
  ctx.drawImage(VIGNETTE, 0, 0, W, H);
  if (G.hurtFlash > 0.01) {
    ctx.globalAlpha = G.hurtFlash * 0.7;
    ctx.fillStyle = 'rgba(160,20,20,0.35)'; ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (P.alive && P.hp < P.hpMax * 0.25 && G.state === 'play') {
    const k = (0.5 + 0.5 * Math.sin(G.real * 5)) * 0.35;
    const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.55);
    gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(1, `rgba(150,10,10,${k})`);
    ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  }
}

/* ---------- quadro ---------- */
const DRAW = [], FADERS = [];
function render(dt) {
  chunkBudget = G.state === 'loading' ? 0 : (IS_TOUCH ? 1 : 2);
  const cam = G.cam;
  const shx = (Math.random() * 2 - 1) * cam.shake, shy = (Math.random() * 2 - 1) * cam.shake;
  const camx = cam.x + shx, camy = cam.y + shy;
  const vw = W / S, vh = H / S, vx = camx - vw / 2, vy = camy - vh / 2;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#07140f'; ctx.fillRect(0, 0, W, H);
  if (!F.canvas) return;
  ctx.setTransform(S, 0, 0, S, -camx * S + W / 2, -camy * S + H / 2);
  ctx.imageSmoothingEnabled = true;
  drawGround(vx, vy, vw, vh);
  // perigos no chão
  for (const h of G.hazards) {
    if (h.type === 'meteor') {
      const k = clamp(1 - h.life / h.max, 0, 1);
      ctx.strokeStyle = `rgba(255,90,40,${0.4 + k * 0.5})`; ctx.lineWidth = 2;
      ellipse(ctx, h.x, h.y, h.r, h.r * 0.6); ctx.stroke();
      ctx.fillStyle = `rgba(255,80,30,${0.12 + k * 0.25})`;
      ellipse(ctx, h.x, h.y, h.r * k, h.r * 0.6 * k); ctx.fill();
    } else if (h.type === 'flame') {
      ctx.fillStyle = `rgba(30,10,5,${0.35 * clamp(h.life, 0, 1)})`;
      ellipse(ctx, h.x, h.y, h.r, h.r * 0.6); ctx.fill();
    }
  }
  // aviso de investida do Boitatá
  const B = G.boss;
  if (B && B.st === 'cwind') {
    const H0 = B.segs[0];
    ctx.save(); ctx.translate(H0.x, H0.y); ctx.rotate(B.ang);
    const g = ctx.createLinearGradient(0, 0, 520, 0); g.addColorStop(0, 'rgba(255,80,30,0.35)'); g.addColorStop(1, 'rgba(255,80,30,0)');
    ctx.fillStyle = g; ctx.fillRect(0, -26, 520, 52); ctx.restore();
  }
  // props visíveis
  const visProps = [];
  const c0 = clamp(Math.floor((vx - 160) / CHUNK), 0, NCH - 1), c1 = clamp(Math.floor((vx + vw + 160) / CHUNK), 0, NCH - 1);
  const r0 = clamp(Math.floor((vy - 60) / CHUNK), 0, NCH - 1), r1 = clamp(Math.floor((vy + vh + 300) / CHUNK), 0, NCH - 1);
  for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
    const arr = PROP_CHUNKS[cy * NCH + cx];
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      if (p.x < vx - 160 || p.x > vx + vw + 160 || p.y < vy - 40 || p.y > vy + vh + 290) continue;
      visProps.push(p);
    }
  }
  // sombras
  const shA = lerp(0.95, 0.55, G.dark);
  ctx.globalAlpha = shA;
  for (const p of visProps) {
    const s = spriteOf(p); if (!s) continue;
    const R = s.shadowR || 12;
    ctx.drawImage(SHADOW_SPR, p.x - R * 0.95 + R * 0.22, p.y - R * 0.42, R * 1.9, R * 0.9);
  }
  ctx.globalAlpha = 1;
  const shadowFor = (x, y, r, a) => { ctx.globalAlpha = a; ctx.drawImage(SHADOW_SPR, x - r, y - r * 0.45, r * 2, r * 0.9); };
  shadowFor(P.x, P.y, 13, P.alive ? 0.8 : 0.4);
  for (const e of G.enemies) if (!e.dead) shadowFor(e.x, e.y, e.r * (e.flying ? 0.8 : 1.15), e.flying ? 0.45 : 0.75);
  for (const n of G.npcs) shadowFor(n.x, n.y, 13, 0.8);
  for (const t of G.totems) shadowFor(t.x + 6, t.y, 22, 0.8);
  for (const k of G.pickups) shadowFor(k.x, k.y, 5, 0.5);
  if (B && B.st !== 'dormant' && B.st !== 'purified') for (const s of B.segs) shadowFor(s.x, s.y + 4, s.r * 1.1, 0.5);
  ctx.globalAlpha = 1;
  // ordenação por profundidade
  DRAW.length = 0;
  for (const p of visProps) DRAW.push(p.y, 0, p);
  DRAW.push(P.y, 1, P);
  for (const e of G.enemies) if (!e.dead && e.x > vx - 60 && e.x < vx + vw + 60 && e.y > vy - 40 && e.y < vy + vh + 80) DRAW.push(e.y, 2, e);
  for (const n of G.npcs) DRAW.push(n.y, 3, n);
  for (const t of G.totems) DRAW.push(t.y, 4, t);
  if (B && B.st !== 'dormant') DRAW.push(B.st === 'purified' ? 1e9 : -1e9, 5, B);
  for (const k of G.pickups) DRAW.push(k.y, 6, k);
  for (const p of G.projs) DRAW.push(p.y + 12, 7, p);
  for (const a of G.afterimages) DRAW.push(a.y - 0.1, 8, a);
  FADERS.length = 0;
  for (const e of G.enemies) if (!e.dead && e.aggro && Math.abs(e.x - P.x) < vw && Math.abs(e.y - P.y) < vh) FADERS.push(e.x, e.y - (e.z || 0));
  for (const n of G.npcs) if (Math.abs(n.x - P.x) < vw && Math.abs(n.y - P.y) < vh) FADERS.push(n.x, n.y);
  const idx = [];
  for (let i = 0; i < DRAW.length; i += 3) idx.push(i);
  idx.sort((a, b) => DRAW[a] - DRAW[b]);
  const fadeK = 1 - Math.exp(-dt * 8);
  for (const i of idx) {
    const kind = DRAW[i + 1], o = DRAW[i + 2];
    switch (kind) {
      case 0: {
        const s = spriteOf(o); if (!s) break;
        if (s.canopy) {
          const under = (x, y) => { const dx = (x - o.x) / s.canopy.rx, dy = ((y - 16) - (o.y + s.canopy.cy)) / s.canopy.ry; return y < o.y + 4 && dx * dx + dy * dy < 1; };
          let hide = under(P.x, P.y);
          if (!hide) for (let k = 0; k < FADERS.length; k += 2) if (under(FADERS[k], FADERS[k + 1])) { hide = true; break; }
          const target = hide ? 0.32 : 1;
          o.fade += (target - o.fade) * fadeK;
        }
        ctx.globalAlpha = o.fade;
        if (o.type === 'log' || o.rot) {
          ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot || 0); ctx.drawImage(s.c, -s.ax, -s.ay, s.w, s.h); ctx.restore();
        } else if (s.canopy && o.type !== 'maloca') {
          const sway = Math.sin(G.real * 1.2 + o.seed) * 0.012 + Math.sin(G.real * 0.5) * 0.006 + G.weather.rain * Math.sin(G.real * 3 + o.seed) * 0.012;
          ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(sway); ctx.drawImage(s.c, -s.ax, -s.ay, s.w, s.h); ctx.restore();
        } else ctx.drawImage(s.c, o.x - s.ax, o.y - s.ay, s.w, s.h);
        ctx.globalAlpha = 1;
        break;
      }
      case 1: drawPlayer(ctx); break;
      case 2: drawEnemy(ctx, o); break;
      case 3: drawNPC(ctx, o); break;
      case 4: drawTotem(ctx, o); break;
      case 5: drawBoss(ctx, o); break;
      case 6: drawPickup(ctx, o); break;
      case 7: drawProj(ctx, o); break;
      case 8: {
        ctx.globalAlpha = (o.life / o.max) * 0.35;
        ctx.fillStyle = '#41e0cf';
        ellipse(ctx, o.x, o.y - 14, 9, 14); ctx.fill();
        circle(ctx, o.x, o.y - 28, 8); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
    }
  }
  drawParticles(ctx, false);
  // luz
  updateFlies(dt, vx, vy, vw, vh);
  gatherLights(vx, vy, vw, vh, visProps);
  renderLighting(camx, camy);
  // brilho aditivo
  ctx.setTransform(S, 0, 0, S, -camx * S + W / 2, -camy * S + H / 2);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < GLOWS.length; i += 5) {
    const r = GLOWS[i + 2];
    ctx.globalAlpha = clamp(GLOWS[i + 4], 0, 1);
    ctx.drawImage(GLOW[GLOWS[i + 3]] || GLOW.warm, GLOWS[i] - r, GLOWS[i + 1] - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
  drawSlashes(ctx);
  drawParticles(ctx, true);
  if (B && G.flags.bossStarted && B.alive && P.alive) {
    ctx.strokeStyle = `rgba(65,224,207,${0.45 + 0.2 * Math.sin(G.real * 6)})`; ctx.lineWidth = 1.6;
    ellipse(ctx, P.x, P.y, 17, 8); ctx.stroke();
  }
  if (P.shield > 0) {
    const k = clamp(P.shieldT / 6, 0, 1);
    ctx.strokeStyle = `rgba(140,255,170,${0.35 + 0.25 * Math.sin(G.real * 8)})`; ctx.lineWidth = 1.4;
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU + G.real;
      ctx.beginPath(); ctx.moveTo(P.x + Math.cos(a) * 22, P.y - 16 + Math.sin(a) * 22); ctx.lineTo(P.x + Math.cos(a + TAU / 6) * 22, P.y - 16 + Math.sin(a + TAU / 6) * 22); ctx.stroke();
    }
    ctx.globalAlpha = 0.25 + 0.2 * k; ctx.drawImage(GLOW.green, P.x - 30, P.y - 46, 60, 60); ctx.globalAlpha = 1;
  }
  // feixe dos totens despertos
  for (const t of G.totems) if (t.state === 'awake' && t.x > vx - 100 && t.x < vx + vw + 100) {
    const col = GCOL[t.col];
    const g = ctx.createLinearGradient(0, t.y - 400, 0, t.y - 60);
    g.addColorStop(0, rgb(col, 0)); g.addColorStop(1, rgb(col, 0.22 + 0.08 * Math.sin(t.glowT * 2)));
    ctx.fillStyle = g; ctx.fillRect(t.x - 10, t.y - 400, 20, 340);
  }
  ctx.globalCompositeOperation = 'source-over';
  drawAtmosphere(dt);
  // textos de dano e indicações
  ctx.setTransform(S, 0, 0, S, -camx * S + W / 2, -camy * S + H / 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of G.texts) {
    const k = t.life / t.max;
    const sc = t.big ? 1 + (1 - k) * 0.1 + (k > 0.85 ? (k - 0.85) * 3 : 0) : 1;
    ctx.globalAlpha = Math.min(1, k * 2.5);
    ctx.font = `700 ${Math.round((t.big ? 17 : 13) * sc)}px Signika, "Trebuchet MS", sans-serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(12,8,6,0.85)'; ctx.strokeText(t.txt, t.x, t.y);
    ctx.fillStyle = t.col; ctx.fillText(t.txt, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  if (G.state === 'play') drawPrompts();
}

function drawPrompts() {
  const it = G.interact;
  for (const n of G.npcs) {
    const fresh = (n.id === 'jaci' && !G.flags.metJaci) || (n.id === 'curu' && !G.flags.metCuru) || (n.id === 'rai' && !G.flags.metRai);
    if (fresh && !(it && it.o === n)) {
      const y = n.y - 58 + Math.sin(G.real * 4) * 3;
      ctx.fillStyle = '#ffd27a'; ctx.strokeStyle = 'rgba(10,8,4,0.8)'; ctx.lineWidth = 3;
      ctx.font = '700 18px Macondo, Georgia, serif';
      ctx.strokeText('!', n.x, y); ctx.fillText('!', n.x, y);
    }
  }
  if (!it) return;
  const o = it.o;
  const label = it.kind === 'npc' ? 'Conversar' : 'Purificar';
  const y = o.y - (it.kind === 'totem' ? 118 : 62);
  ctx.font = '600 11px Signika, "Trebuchet MS", sans-serif';
  const txt = (IS_TOUCH ? '' : 'E · ') + label;
  const w = ctx.measureText(txt).width + 16;
  ctx.fillStyle = 'rgba(8,20,15,0.82)';
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(o.x - w / 2, y - 10, w, 20, 10) : ctx.rect(o.x - w / 2, y - 10, w, 20); ctx.fill();
  ctx.strokeStyle = 'rgba(255,210,122,0.7)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#ffd27a'; ctx.fillText(txt, o.x, y + 0.5);
}
