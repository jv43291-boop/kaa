/* ============================================================
   Sprites procedurais: vegetação, ruínas, aldeia, efeitos
   ============================================================ */
let SPR = 2;           // pixels por unidade nos sprites
const SPRITES = {};    // tipo -> [variantes]
const PAL = {
  jungle: ['#123826', '#285f35', '#468f41', '#93cc63'],
  dark: ['#0b2622', '#184a3e', '#2c6957', '#62a684'],
  kapok: ['#173f2b', '#33713c', '#5f9f47', '#b1de76'],
  ipeY: ['#5f4a0e', '#b98f1c', '#ecc534', '#fff1a0'],
  ipeP: ['#341843', '#6f3586', '#a95fbe', '#efb6f0'],
  palm: ['#1d4a2a', '#2f7a38', '#58a548', '#a6dc72'],
};

function mkSprite(w, h, ax, ay, fn) {
  const c = makeCanvas(w * SPR, h * SPR);
  const ctx = c.getContext('2d');
  ctx.scale(SPR, SPR); ctx.translate(ax, ay);
  const info = fn(ctx) || {};
  return Object.assign({ c, ax, ay, w, h }, info);
}

function blob(ctx, x, y, r, light, dark) {
  ctx.fillStyle = rgrad(ctx, x, y, r * 0.05, r, [[0, light], [1, dark]], -r * 0.35, -r * 0.4);
  circle(ctx, x, y, r); ctx.fill();
}

function drawCanopy(ctx, cx, cy, R, pal, rng, flat) {
  flat = flat || 1;
  for (let i = 0; i < 18; i++) {
    const a = rng() * TAU, d = Math.sqrt(rng()) * R * 0.6, r = R * (0.3 + rng() * 0.2);
    blob(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.78 * flat + R * 0.1, r, pal[1], pal[0]);
  }
  for (let i = 0; i < 15; i++) {
    const a = rng() * TAU, d = Math.sqrt(rng()) * R * 0.5, r = R * (0.2 + rng() * 0.15);
    blob(ctx, cx + Math.cos(a) * d - R * 0.05, cy + Math.sin(a) * d * 0.72 * flat - R * 0.07, r, pal[2], pal[1]);
  }
  for (let i = 0; i < 10; i++) {
    const a = -2.3 + (rng() - 0.5) * 1.7, d = rng() * R * 0.5, r = R * (0.1 + rng() * 0.12);
    blob(ctx, cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.75 * flat - R * 0.1, r, pal[3], pal[2]);
  }
  // textura de folhas
  for (let i = 0; i < 90; i++) {
    const a = rng() * TAU, d = Math.sqrt(rng()) * R * 0.85;
    const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d * 0.75 * flat;
    const up = (x - cx) * -0.6 + (y - cy) * -0.8 > 0;
    ctx.fillStyle = up ? pal[3] : pal[0];
    ctx.globalAlpha = up ? 0.55 : 0.4;
    ellipse(ctx, x, y, 2.6, 1.3, rng() * TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function trunkShape(ctx, tw, th, c1, c2) {
  const g = ctx.createLinearGradient(-tw * 1.4, 0, tw * 1.4, 0);
  g.addColorStop(0, c2); g.addColorStop(0.42, c1); g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(-tw * 1.45, 2);
  ctx.quadraticCurveTo(-tw * 0.85, -th * 0.4, -tw * 0.65, -th);
  ctx.lineTo(tw * 0.65, -th);
  ctx.quadraticCurveTo(tw * 0.85, -th * 0.4, tw * 1.45, 2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,5,0.35)'; ctx.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); const x = -tw * 0.6 + i * tw * 0.4; ctx.moveTo(x, -2); ctx.lineTo(x * 0.7, -th * 0.9); ctx.stroke(); }
}

function makeTree(rng, pal, R, th, opts) {
  opts = opts || {};
  const w = R * 2.7, h = R * 2.3 + th + 16;
  return mkSprite(w, h, w / 2, h - 10, ctx => {
    const tw = 5 + R * 0.08;
    // raízes
    ctx.strokeStyle = '#3d2818'; ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (0.05 + i * 0.22) + rng() * 0.1;
      ctx.lineWidth = 2.6 - i * 0.2;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * tw * 0.5, -3);
      ctx.quadraticCurveTo(Math.cos(a) * tw * 1.6, 0, Math.cos(a) * tw * 2.6, Math.sin(a) * 4 + 2); ctx.stroke();
    }
    trunkShape(ctx, tw, th + R * 0.5, '#6b4a30', '#2b1a10');
    if (opts.vines) {
      ctx.strokeStyle = '#2f6a3e'; ctx.lineWidth = 1.3;
      for (let i = 0; i < 5; i++) {
        const x = (rng() - 0.5) * R * 1.4, y0 = -th - R * 0.6 + rng() * R * 0.4;
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.quadraticCurveTo(x + 6, y0 + 22, x - 2, y0 + 30 + rng() * 26); ctx.stroke();
      }
    }
    const cy = -th - R * 0.75;
    drawCanopy(ctx, 0, cy, R, pal, rng, opts.flat || 1);
    if (opts.vines && rng() < 0.5) {
      // bromélias
      for (let i = 0; i < 2; i++) {
        const x = (rng() - 0.5) * R, y = cy + (rng() - 0.2) * R * 0.5;
        ctx.fillStyle = '#d2416b'; ellipse(ctx, x, y, 3, 2, 0); ctx.fill();
        ctx.fillStyle = '#ffd36b'; circle(ctx, x, y - 1, 1); ctx.fill();
      }
    }
    return { canopy: { cy, rx: R * 1.02, ry: R * 0.85 * (opts.flat || 1) }, shadowR: R, th };
  });
}

function makeKapok(rng, R) {
  const th = 80;
  const w = R * 2.7, h = R * 2.0 + th + 30;
  return mkSprite(w, h, w / 2, h - 18, ctx => {
    // sapopemas (raízes tabulares)
    for (let i = 0; i < 5; i++) {
      const a = Math.PI * (-0.05 + i * 0.27) + (rng() - 0.5) * 0.15;
      const ex = Math.cos(a) * 46, ey = Math.sin(a) * 14 + 6;
      ctx.fillStyle = i % 2 ? '#5d4430' : '#4a3424';
      ctx.beginPath(); ctx.moveTo(-6, -40); ctx.quadraticCurveTo(ex * 0.4, -14, ex, ey); ctx.lineTo(ex * 0.7 + 4, ey - 2); ctx.quadraticCurveTo(ex * 0.25 + 6, -18, 6, -40); ctx.fill();
    }
    trunkShape(ctx, 15, th + 30, '#8a7258', '#3a2a1c');
    const cy = -th - R * 0.6;
    drawCanopy(ctx, 0, cy + R * 0.18, R * 0.85, PAL.kapok, rng, 0.62);
    drawCanopy(ctx, R * 0.05, cy - R * 0.1, R * 0.7, PAL.kapok, rng, 0.6);
    return { canopy: { cy, rx: R, ry: R * 0.62 }, shadowR: R * 1.05, th };
  });
}

function makePalm(rng) {
  const th = 58 + rng() * 26, lean = (rng() - 0.5) * 16;
  const w = 120, h = th + 70;
  return mkSprite(w, h, w / 2, h - 8, ctx => {
    // tronco anelado
    ctx.strokeStyle = '#6e5a42'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(lean * 0.2, -th * 0.5, lean, -th); ctx.stroke();
    ctx.strokeStyle = 'rgba(30,20,10,0.5)'; ctx.lineWidth = 1;
    for (let i = 1; i < 9; i++) {
      const t = i / 9, x = lean * t * t, y = -th * t;
      ctx.beginPath(); ctx.moveTo(x - 2.6, y); ctx.lineTo(x + 2.6, y); ctx.stroke();
    }
    const cx = lean, cy = -th;
    // cachos de açaí
    for (let i = 0; i < 2; i++) {
      const ox = (i ? 6 : -7), oy = 8;
      for (let k = 0; k < 14; k++) {
        ctx.fillStyle = k % 3 ? '#3b1640' : '#5a2463';
        circle(ctx, cx + ox + (rng() - 0.5) * 7, cy + oy + rng() * 10, 1.5); ctx.fill();
      }
    }
    const n = 9 + ((rng() * 3) | 0);
    const fr = [];
    for (let i = 0; i < n; i++) fr.push(i / n * TAU + rng() * 0.3);
    fr.sort((a, b) => Math.sin(a) - Math.sin(b));
    for (const a of fr) {
      const L = 34 + rng() * 14, dx = Math.cos(a), dy = Math.sin(a) * 0.6;
      const ex = cx + dx * L, ey = cy + dy * L + 12, mx = cx + dx * L * 0.5, my = cy + dy * L * 0.5 - 8;
      const back = Math.sin(a) < 0;
      ctx.strokeStyle = back ? PAL.palm[1] : PAL.palm[2]; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
      for (let k = 1; k < 12; k++) {
        const t = k / 12;
        const px = (1 - t) * (1 - t) * cx + 2 * (1 - t) * t * mx + t * t * ex;
        const py = (1 - t) * (1 - t) * cy + 2 * (1 - t) * t * my + t * t * ey;
        const nx = -dy, ny = dx, ll = 9 * (1 - t * 0.6);
        ctx.strokeStyle = back ? PAL.palm[0] : (k % 2 ? PAL.palm[2] : PAL.palm[3]);
        ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + nx * ll + dx * 3, py + ny * ll + 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - nx * ll + dx * 3, py - ny * ll + 5); ctx.stroke();
      }
    }
    return { canopy: { cy: cy + 4, rx: 44, ry: 30 }, shadowR: 40, th };
  });
}

function makeBush(rng, berries) {
  const R = 14 + rng() * 6;
  return mkSprite(70, 54, 35, 44, ctx => {
    for (let i = 0; i < 7; i++) {
      const a = rng() * TAU, d = rng() * R * 0.7;
      blob(ctx, Math.cos(a) * d, -R * 0.8 + Math.sin(a) * d * 0.6, R * (0.45 + rng() * 0.3), PAL.jungle[2], PAL.jungle[0]);
    }
    for (let i = 0; i < 5; i++) blob(ctx, (rng() - 0.6) * R, -R * 1.05 + rng() * 6, R * 0.25, PAL.jungle[3], PAL.jungle[2]);
    if (berries) for (let i = 0; i < 9; i++) { ctx.fillStyle = rng() < 0.5 ? '#e0473a' : '#ff8a4a'; circle(ctx, (rng() - 0.5) * R * 1.5, -R * 0.8 + (rng() - 0.5) * R, 1.6); ctx.fill(); }
    return { shadowR: R * 0.9 };
  });
}

function makeFern(rng) {
  return mkSprite(70, 46, 35, 36, ctx => {
    const n = 8 + ((rng() * 4) | 0);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rng() * 0.3, L = 17 + rng() * 9;
      const dx = Math.cos(a), dy = Math.sin(a) * 0.55;
      const ex = dx * L, ey = dy * L - 6, mx = dx * L * 0.5, my = dy * L * 0.5 - 12;
      const back = dy < 0;
      ctx.strokeStyle = back ? '#2b6a36' : '#5fae4c'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -2); ctx.quadraticCurveTo(mx, my, ex, ey); ctx.stroke();
      for (let k = 1; k < 9; k++) {
        const t = k / 9, px = 2 * (1 - t) * t * mx + t * t * ex, py = (1 - t) * (1 - t) * -2 + 2 * (1 - t) * t * my + t * t * ey;
        const ll = 5 * (1 - t * 0.7);
        ctx.strokeStyle = back ? '#225a2e' : (k % 2 ? '#79c45a' : '#4f9a42');
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - dy * ll + 1, py + dx * ll * 0.6 + 2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + dy * ll + 1, py - dx * ll * 0.6 + 2); ctx.stroke();
      }
    }
    return { shadowR: 18 };
  });
}

function makeHeliconia(rng) {
  return mkSprite(60, 76, 30, 68, ctx => {
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i - 1.5) * 0.45 + (rng() - 0.5) * 0.2;
      const L = 30 + rng() * 12;
      ctx.save(); ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = rgrad(ctx, 0, -L / 2, 1, L * 0.6, [[0, '#5cab4a'], [1, '#22562c']]);
      ellipse(ctx, 0, -L / 2, 6, L / 2, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(200,255,170,0.35)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -L); ctx.stroke();
      ctx.restore();
    }
    // brácteas zigue-zague (bico-de-papagaio)
    for (let s = 0; s < 2; s++) {
      const x0 = s ? 7 : -5, top = -52 - rng() * 8;
      ctx.strokeStyle = '#3f7a34'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x0, -6); ctx.lineTo(x0, top); ctx.stroke();
      for (let k = 0; k < 5; k++) {
        const y = top + k * 6, dir = k % 2 ? 1 : -1;
        ctx.fillStyle = '#e8352f';
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + dir * 9, y - 2); ctx.lineTo(x0, y + 4); ctx.fill();
        ctx.fillStyle = '#ffd23f';
        ctx.beginPath(); ctx.moveTo(x0 + dir * 9, y - 2); ctx.lineTo(x0 + dir * 6, y - 2.4); ctx.lineTo(x0 + dir * 6.6, y + 0.4); ctx.fill();
      }
    }
    return { shadowR: 14 };
  });
}

function makeGiantLeaf(rng) {
  return mkSprite(84, 70, 42, 60, ctx => {
    const n = 4 + ((rng() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.62 + (rng() - 0.5) * 0.2;
      const L = 26 + rng() * 8;
      const ex = Math.cos(a) * L * 0.9, ey = Math.sin(a) * L * 0.8 - 6;
      ctx.strokeStyle = '#3e7a3a'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(ex * 0.3, ey * 0.6, ex, ey); ctx.stroke();
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a + Math.PI / 2);
      const s = 13 + rng() * 4;
      ctx.fillStyle = rgrad(ctx, 0, -s, 1, s * 1.5, [[0, '#4fa04a'], [1, '#174a26']]);
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-s * 1.2, -s * 0.2, -s * 0.9, -s * 1.6, 0, -s * 2);
      ctx.bezierCurveTo(s * 0.9, -s * 1.6, s * 1.2, -s * 0.2, 0, 0); ctx.fill();
      ctx.strokeStyle = 'rgba(190,240,160,0.4)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -s * 1.9); ctx.stroke();
      for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(0, -s * k * 0.45); ctx.lineTo(-s * 0.6, -s * k * 0.45 - s * 0.3); ctx.moveTo(0, -s * k * 0.45); ctx.lineTo(s * 0.6, -s * k * 0.45 - s * 0.3); ctx.stroke(); }
      ctx.restore();
    }
    return { shadowR: 22 };
  });
}

function makeMushroom(rng) {
  const glows = [];
  const s = mkSprite(50, 40, 25, 32, ctx => {
    const n = 3 + ((rng() * 4) | 0);
    const ms = [];
    for (let i = 0; i < n; i++) ms.push({ x: (rng() - 0.5) * 26, y: (rng() - 0.5) * 10, h: 5 + rng() * 9, r: 3 + rng() * 4 });
    ms.sort((a, b) => a.y - b.y);
    for (const m of ms) {
      ctx.fillStyle = '#d9e6dc'; ctx.fillRect(m.x - 1.1, m.y - m.h, 2.2, m.h);
      ctx.fillStyle = rgrad(ctx, m.x, m.y - m.h, 0.5, m.r, [[0, '#d6fff5'], [0.6, '#6fe3d0'], [1, '#2a8f86']], -1, -1);
      ellipse(ctx, m.x, m.y - m.h, m.r, m.r * 0.62, 0); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; circle(ctx, m.x - m.r * 0.3, m.y - m.h - 1, 0.7); ctx.fill();
      glows.push({ dx: m.x, dy: m.y - m.h, r: m.r });
    }
    return { shadowR: 12 };
  });
  s.glows = glows;
  return s;
}

function makeRock(rng, charred) {
  const R = 11 + rng() * 9;
  const glows = [];
  const s = mkSprite(R * 3, R * 2.6, R * 1.5, R * 1.9, ctx => {
    const pts = [];
    const n = 9;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; const r = R * (0.75 + rng() * 0.35); pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.7 - R * 0.55]); }
    ctx.fillStyle = charred ? rgrad(ctx, 0, -R * 0.6, 1, R * 1.3, [[0, '#5b5552'], [1, '#1d1919']], -R * 0.4, -R * 0.4)
      : rgrad(ctx, 0, -R * 0.6, 1, R * 1.3, [[0, '#a7a99c'], [1, '#4b4e47']], -R * 0.4, -R * 0.4);
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-R * 0.3, -R * 0.9); ctx.lineTo(-R * 0.05, -R * 0.5); ctx.lineTo(R * 0.25, -R * 0.55); ctx.stroke();
    if (charred) {
      ctx.strokeStyle = '#ff7a2a'; ctx.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        const x = (rng() - 0.5) * R, y = -R * 0.5 + (rng() - 0.5) * R * 0.4;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 2); ctx.lineTo(x + 7, y - 1); ctx.stroke();
        glows.push({ dx: x + 3, dy: y, r: 5 });
      }
    } else {
      for (let i = 0; i < 6; i++) blob(ctx, (rng() - 0.5) * R, -R * 0.95 + rng() * R * 0.3, R * (0.15 + rng() * 0.12), '#7fb75a', '#3c6e32');
    }
    return { shadowR: R };
  });
  s.glows = glows; s.R = R;
  return s;
}

function makePillar(rng) {
  const h = 52 + rng() * 22;
  return mkSprite(46, h + 30, 23, h + 20, ctx => {
    const g = ctx.createLinearGradient(-11, 0, 11, 0);
    g.addColorStop(0, '#5b5d55'); g.addColorStop(0.35, '#a8a99c'); g.addColorStop(1, '#45463f');
    ctx.fillStyle = g; ctx.fillRect(-11, -h, 22, h);
    ctx.fillStyle = '#7d7f73'; ellipse(ctx, 0, 0, 13, 5, 0); ctx.fill();
    ctx.fillStyle = g; ctx.fillRect(-13, -6, 26, 6);
    // topo quebrado
    ctx.fillStyle = '#8d8e82';
    ctx.beginPath(); ctx.moveTo(-11, -h); ctx.lineTo(-6, -h - 6 - rng() * 5); ctx.lineTo(0, -h - 2); ctx.lineTo(5, -h - 8 - rng() * 6); ctx.lineTo(11, -h - 1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(30,30,25,0.5)'; ctx.lineWidth = 1;
    for (let y = -h + 12; y < -8; y += 14) { ctx.beginPath(); ctx.moveTo(-11, y); ctx.lineTo(11, y); ctx.stroke(); }
    // entalhes geométricos
    ctx.strokeStyle = 'rgba(40,40,30,0.55)';
    ctx.beginPath(); ctx.moveTo(-6, -h * 0.55); ctx.lineTo(0, -h * 0.62); ctx.lineTo(6, -h * 0.55); ctx.lineTo(0, -h * 0.48); ctx.closePath(); ctx.stroke();
    for (let i = 0; i < 5; i++) blob(ctx, (rng() - 0.5) * 18, -rng() * h, 3 + rng() * 3, '#7fb75a', '#3c6e32');
    ctx.strokeStyle = '#3c7a3e'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-9, -h + 4); ctx.bezierCurveTo(4, -h * 0.7, -10, -h * 0.4, 6, -4); ctx.stroke();
    return { shadowR: 14 };
  });
}

function makeWall(rng) {
  return mkSprite(80, 64, 40, 50, ctx => {
    const w = 58, h = 30 + rng() * 10;
    ctx.fillStyle = '#5a5c53'; ctx.fillRect(-w / 2, -h, w, h);
    for (let row = 0; row * 9 < h; row++) {
      const off = row % 2 ? 7 : 0;
      for (let x = -w / 2 - off; x < w / 2; x += 14) {
        if (rng() < 0.08) continue;
        ctx.fillStyle = rgb(mixc([140, 142, 128], [96, 98, 88], rng()));
        ctx.fillRect(Math.max(x, -w / 2) + 0.6, -h + row * 9 + 0.6, Math.min(13, w / 2 - x) - 1.2, 8);
      }
    }
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.moveTo(-w / 2, -h - 2);
    for (let x = -w / 2; x <= w / 2; x += 6) ctx.lineTo(x, -h + rng() * 12 * (Math.abs(x) < w / 3 ? 1 : 0.3));
    ctx.lineTo(w / 2, -h - 2); ctx.closePath(); ctx.fillStyle = '#000'; ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 8; i++) blob(ctx, (rng() - 0.5) * w, -h * 0.7 + rng() * h * 0.6, 2.5 + rng() * 3, '#7fb75a', '#3c6e32');
    return { shadowR: 26 };
  });
}

function makeStatue(rng) {
  return mkSprite(60, 70, 30, 60, ctx => {
    ctx.fillStyle = rgrad(ctx, 0, -26, 2, 30, [[0, '#a5a698'], [1, '#4a4c44']], -8, -10);
    ctx.beginPath(); ctx.moveTo(-17, 0); ctx.lineTo(-19, -34); ctx.quadraticCurveTo(-18, -50, 0, -51); ctx.quadraticCurveTo(18, -50, 19, -34); ctx.lineTo(17, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(25,25,20,0.65)';
    ctx.fillRect(-11, -36, 8, 4); ctx.fillRect(3, -36, 8, 4);
    ctx.fillRect(-2, -30, 4, 9);
    ctx.fillRect(-9, -16, 18, 3);
    ctx.strokeStyle = 'rgba(25,25,20,0.5)'; ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-15, -8 - i * 3); ctx.lineTo(-12, -6 - i * 3); ctx.stroke(); ctx.beginPath(); ctx.moveTo(15, -8 - i * 3); ctx.lineTo(12, -6 - i * 3); ctx.stroke(); }
    for (let i = 0; i < 7; i++) blob(ctx, (rng() - 0.5) * 30, -50 + rng() * 14, 3 + rng() * 3, '#86c060', '#3c6e32');
    return { shadowR: 20 };
  });
}

function makeDeadTree(rng) {
  const glows = [];
  const th = 46 + rng() * 26;
  const s = mkSprite(90, th + 40, 45, th + 30, ctx => {
    ctx.lineCap = 'round';
    trunkShape(ctx, 5, th, '#3a2c26', '#120c0a');
    function branch(x, y, a, len, w, d) {
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      ctx.strokeStyle = '#1f1612'; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
      if (d > 0) { branch(ex, ey, a - 0.4 - rng() * 0.3, len * 0.65, w * 0.6, d - 1); branch(ex, ey, a + 0.4 + rng() * 0.3, len * 0.6, w * 0.6, d - 1); }
    }
    branch(0, -th, -Math.PI / 2 + (rng() - 0.5) * 0.4, 18, 3.6, 2);
    branch(0, -th * 0.7, -Math.PI / 2 - 0.9, 14, 2.6, 1);
    branch(0, -th * 0.6, -Math.PI / 2 + 0.9, 13, 2.4, 1);
    ctx.strokeStyle = '#ff6a1f'; ctx.lineWidth = 0.9;
    for (let i = 0; i < 3; i++) {
      const y = -6 - rng() * th * 0.6;
      ctx.beginPath(); ctx.moveTo(-2, y); ctx.lineTo(0, y - 4); ctx.lineTo(2, y - 2); ctx.stroke();
      glows.push({ dx: 0, dy: y - 2, r: 4 });
    }
    return { shadowR: 18 };
  });
  s.glows = glows;
  return s;
}

function makeStump(rng) {
  return mkSprite(44, 40, 22, 30, ctx => {
    const g = ctx.createLinearGradient(-12, 0, 12, 0); g.addColorStop(0, '#2a1d16'); g.addColorStop(0.4, '#5a4434'); g.addColorStop(1, '#1d140f');
    ctx.fillStyle = g; ctx.fillRect(-12, -14, 24, 14);
    ellipse(ctx, 0, 0, 12, 4); ctx.fill();
    ctx.fillStyle = '#7a5e44'; ellipse(ctx, 0, -14, 12, 4.5); ctx.fill();
    ctx.strokeStyle = '#4a3627'; ctx.lineWidth = 0.7;
    for (let r = 3; r < 12; r += 3) { ellipse(ctx, 0, -14, r, r * 0.38); ctx.stroke(); }
    ctx.fillStyle = 'rgba(15,10,8,0.6)'; ellipse(ctx, 3, -14, 5, 2, 0.3); ctx.fill();
    return { shadowR: 13 };
  });
}

function makeReeds(rng) {
  return mkSprite(40, 50, 20, 42, ctx => {
    for (let i = 0; i < 9; i++) {
      const x = (rng() - 0.5) * 18, h = 20 + rng() * 18, b = (rng() - 0.5) * 8;
      ctx.strokeStyle = i % 2 ? '#5d8f3e' : '#7aa84a'; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + b * 0.3, -h * 0.5, x + b, -h); ctx.stroke();
      if (i % 3 === 0) { ctx.fillStyle = '#6b4226'; ellipse(ctx, x + b * 0.9, -h + 3, 1.6, 4, b * 0.03); ctx.fill(); }
    }
    return { shadowR: 10 };
  });
}

function makeMaloca(rng, v) {
  return mkSprite(170, 160, 85, 120, ctx => {
    // parede baixa
    ctx.fillStyle = '#6d5236'; ellipse(ctx, 0, 0, 72, 38); ctx.fill();
    // telhado de palha em colmeia
    const g = ctx.createLinearGradient(-70, -110, 60, 0);
    g.addColorStop(0, '#e6c27a'); g.addColorStop(0.5, '#b8904a'); g.addColorStop(1, '#6e5228');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-74, -2);
    ctx.bezierCurveTo(-76, -70, -30, -112, 0, -112);
    ctx.bezierCurveTo(30, -112, 76, -70, 74, -2);
    ctx.ellipse(0, -2, 74, 34, 0, 0, Math.PI); ctx.closePath(); ctx.fill();
    // fios de palha
    ctx.strokeStyle = 'rgba(80,55,20,0.45)'; ctx.lineWidth = 0.8;
    for (let i = 0; i <= 40; i++) {
      const a = Math.PI * (i / 40);
      const bx = Math.cos(a) * 74, by = Math.sin(a) * 34 - 2;
      ctx.beginPath(); ctx.moveTo(0, -110); ctx.quadraticCurveTo(bx * 0.95, -60 + by * 0.2, bx, by); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,230,160,0.35)';
    for (let i = 0; i < 26; i++) {
      const a = Math.PI * (0.15 + rng() * 0.5);
      const bx = Math.cos(a) * 70, by = Math.sin(a) * 30;
      ctx.beginPath(); ctx.moveTo(bx * 0.3, -95 + rng() * 20); ctx.lineTo(bx * 0.9, by - 8 - rng() * 30); ctx.stroke();
    }
    // faixas trançadas
    ctx.strokeStyle = 'rgba(90,50,20,0.6)'; ctx.lineWidth = 2;
    for (const k of [0.35, 0.65]) { ctx.beginPath(); ctx.ellipse(0, -2 - 110 * (1 - k) * 0.85 + 6, 74 * Math.sqrt(k) * 0.98, 34 * Math.sqrt(k), 0, 0.05, Math.PI - 0.05); ctx.stroke(); }
    // porta
    ctx.fillStyle = '#1c120a';
    ctx.beginPath(); ctx.moveTo(-13 + v * 10, 32); ctx.lineTo(-13 + v * 10, 6); ctx.quadraticCurveTo(0 + v * 10, -14, 13 + v * 10, 6); ctx.lineTo(13 + v * 10, 32); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,170,80,0.25)'; ctx.fillRect(-9 + v * 10, 16, 18, 14);
    // topo
    ctx.fillStyle = '#5a3e1c'; ellipse(ctx, 0, -110, 8, 4); ctx.fill();
    return { canopy: { cy: -60, rx: 76, ry: 56 }, shadowR: 80 };
  });
}

function makeLog() {
  return mkSprite(60, 24, 30, 14, ctx => {
    const g = ctx.createLinearGradient(0, -7, 0, 7); g.addColorStop(0, '#8a6644'); g.addColorStop(1, '#3d2a1a');
    ctx.fillStyle = g; ctx.fillRect(-22, -7, 44, 13);
    ctx.fillStyle = '#b8936a'; ellipse(ctx, 22, -0.5, 4, 6.5); ctx.fill();
    ctx.strokeStyle = '#6e4e32'; ellipse(ctx, 22, -0.5, 2, 3.5); ctx.stroke();
    return { shadowR: 20 };
  });
}

function makeRack() {
  return mkSprite(70, 60, 35, 50, ctx => {
    ctx.strokeStyle = '#4b331f'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-24, 0); ctx.lineTo(-22, -38); ctx.moveTo(24, 0); ctx.lineTo(22, -38); ctx.moveTo(-26, -36); ctx.lineTo(26, -36); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const x = -15 + i * 10;
      ctx.strokeStyle = '#2a1d12'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x, -36); ctx.lineTo(x, -30); ctx.stroke();
      ctx.fillStyle = i % 2 ? '#b5a27a' : '#9c8a66';
      ctx.beginPath(); ctx.ellipse(x, -22, 3, 8, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x, -14); ctx.lineTo(x - 3, -10); ctx.lineTo(x + 3, -10); ctx.fill();
    }
    return { shadowR: 18 };
  });
}

function makeTotemPole() {
  return mkSprite(50, 110, 25, 100, ctx => {
    ctx.fillStyle = '#6a4a2c'; ctx.fillRect(-8, -78, 16, 78);
    const cols = ['#c9452e', '#f1e3c4', '#1c1612'];
    for (let i = 0; i < 3; i++) {
      const y = -72 + i * 24;
      ctx.fillStyle = '#7c5735'; ctx.fillRect(-10, y, 20, 20);
      ctx.fillStyle = cols[i % 3]; ctx.fillRect(-7, y + 5, 5, 3); ctx.fillRect(2, y + 5, 5, 3);
      ctx.fillStyle = cols[(i + 1) % 3]; ctx.fillRect(-4, y + 12, 8, 3);
      ctx.strokeStyle = cols[(i + 2) % 3]; ctx.lineWidth = 1;
      ctx.beginPath(); for (let x = -10; x < 10; x += 4) { ctx.lineTo(x, y + 1); ctx.lineTo(x + 2, y + 3); } ctx.stroke();
    }
    const fc = ['#e8352f', '#ffd23f', '#2f7fd8', '#e8352f', '#ffd23f'];
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.translate(0, -78); ctx.rotate((i - 2) * 0.32);
      ctx.fillStyle = fc[i]; ellipse(ctx, 0, -12, 2.6, 11); ctx.fill(); ctx.restore();
    }
    return { shadowR: 12 };
  });
}

function makeCrop(rng) {
  return mkSprite(30, 32, 15, 26, ctx => {
    ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -12); ctx.stroke();
    for (let k = 0; k < 2; k++) for (let i = 0; i < 6; i++) {
      const a = -Math.PI / 2 + (i - 2.5) * 0.45;
      ctx.fillStyle = k ? '#6fbf54' : '#3f8a3a';
      ctx.save(); ctx.translate(k * 3 - 1, -12 + k * 4); ctx.rotate(a + Math.PI / 2); ellipse(ctx, 0, -6, 1.6, 6); ctx.fill(); ctx.restore();
    }
    return { shadowR: 7 };
  });
}

const PROP_DEFS = {
  treeRound: { n: 6, r: p => 10 * (p.big || 1), make: (i, rng) => makeTree(rng, PAL.jungle, 42 + rng() * 18, 22 + rng() * 14) },
  treeDark: { n: 5, r: p => 11 * (p.big || 1), make: (i, rng) => makeTree(rng, PAL.dark, 48 + rng() * 20, 26 + rng() * 14, { vines: true }) },
  ipe: { n: 2, r: () => 10, make: (i, rng) => makeTree(rng, i ? PAL.ipeP : PAL.ipeY, 46 + rng() * 10, 30) },
  kapok: { n: 3, r: () => 22, make: (i, rng) => makeKapok(rng, 98 + rng() * 22) },
  palm: { n: 5, r: () => 6, make: (i, rng) => makePalm(rng) },
  bush: { n: 5, r: () => 0, make: (i, rng) => makeBush(rng, i % 3 === 0) },
  fern: { n: 4, r: () => 0, make: (i, rng) => makeFern(rng) },
  heliconia: { n: 3, r: () => 0, make: (i, rng) => makeHeliconia(rng) },
  giantLeaf: { n: 3, r: () => 0, make: (i, rng) => makeGiantLeaf(rng) },
  mushroom: { n: 4, r: () => 0, make: (i, rng) => makeMushroom(rng) },
  rock: { n: 5, r: p => SPRITES.rock ? SPRITES.rock[p.v % 5].R * 0.8 : 12, make: (i, rng) => makeRock(rng, false) },
  charRock: { n: 4, r: p => SPRITES.charRock ? SPRITES.charRock[p.v % 4].R * 0.8 : 12, make: (i, rng) => makeRock(rng, true) },
  pillar: { n: 3, r: () => 12, make: (i, rng) => makePillar(rng) },
  wall: { n: 3, r: () => 20, make: (i, rng) => makeWall(rng) },
  statue: { n: 2, r: () => 17, make: (i, rng) => makeStatue(rng) },
  deadTree: { n: 5, r: () => 8, make: (i, rng) => makeDeadTree(rng) },
  stump: { n: 3, r: () => 11, make: (i, rng) => makeStump(rng) },
  reeds: { n: 3, r: () => 0, make: (i, rng) => makeReeds(rng) },
  maloca: { n: 2, r: () => 62, make: (i, rng) => makeMaloca(rng, i) },
  log: { n: 1, r: () => 0, make: () => makeLog() },
  rack: { n: 1, r: () => 5, make: () => makeRack() },
  totemPole: { n: 1, r: () => 9, make: () => makeTotemPole() },
  crop: { n: 3, r: () => 0, make: (i, rng) => makeCrop(rng) },
};

function spriteOf(p) { const arr = SPRITES[p.type]; return arr ? arr[p.v % arr.length] : null; }

async function buildSprites(onProgress) {
  const keys = Object.keys(PROP_DEFS);
  let done = 0;
  for (const k of keys) {
    const def = PROP_DEFS[k];
    const rng = mulberry32(k.length * 977 + k.charCodeAt(0) * 31);
    SPRITES[k] = [];
    for (let i = 0; i < def.n; i++) SPRITES[k].push(def.make(i, rng));
    done++;
    onProgress(done / keys.length);
    await new Promise(r => setTimeout(r, 0));
  }
}

/* ---------- sprites de luz e fumaça ---------- */
const GLOW = {};
function glowSprite(key, col) {
  if (GLOW[key]) return GLOW[key];
  const S = 64, c = makeCanvas(S, S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, rgb(col, 1)); gr.addColorStop(0.22, rgb(col, 0.6)); gr.addColorStop(0.55, rgb(col, 0.16)); gr.addColorStop(1, rgb(col, 0));
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  GLOW[key] = c; return c;
}
const GCOL = {
  warm: [255, 214, 150], fire: [255, 140, 50], gold: [255, 210, 110], cyan: [110, 240, 230], teal: [65, 224, 207],
  purple: [170, 90, 255], magenta: [255, 80, 210], white: [255, 255, 255], green: [150, 255, 160], red: [255, 70, 50],
  blue: [110, 170, 255], firefly: [210, 255, 120], ember: [255, 110, 30], moon: [170, 200, 255],
};
function initGlows() { for (const k in GCOL) glowSprite(k, GCOL[k]); }
let SHADOW_SPR = null, SMOKE_SPR = null, SMOKE_P = null;
function initFx() {
  initGlows();
  SHADOW_SPR = makeCanvas(64, 64);
  let g = SHADOW_SPR.getContext('2d');
  let gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.32)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  SMOKE_SPR = makeCanvas(64, 64); g = SMOKE_SPR.getContext('2d');
  gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(200,200,200,0.7)'); gr.addColorStop(0.6, 'rgba(160,160,170,0.25)'); gr.addColorStop(1, 'rgba(140,140,150,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  SMOKE_P = makeCanvas(64, 64); g = SMOKE_P.getContext('2d');
  gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(90,30,140,0.75)'); gr.addColorStop(0.6, 'rgba(60,20,100,0.3)'); gr.addColorStop(1, 'rgba(40,10,70,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
}

/* ---------- decoração de chão (assada nos chunks) ---------- */
function drawDecor(ctx, d) {
  const rng = mulberry32(((d.x * 7) | 0) + ((d.y * 13) | 0));
  ctx.save(); ctx.translate(d.x, d.y);
  if (d.type === 'lily') {
    const R = 15 * d.s + 6;
    ctx.fillStyle = 'rgba(0,30,30,0.35)'; ellipse(ctx, 3, 3, R, R * 0.9); ctx.fill();
    ctx.fillStyle = rgrad(ctx, 0, 0, 1, R, [[0, '#5ea84a'], [0.85, '#2f7a34'], [1, '#235f2a']], -R * 0.3, -R * 0.3);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, d.rot + 0.12, d.rot + TAU - 0.12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a65a3c'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(0, 0, R - 1, d.rot + 0.16, d.rot + TAU - 0.16); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,255,170,0.25)'; ctx.lineWidth = 0.7;
    for (let i = 0; i < 12; i++) { const a = d.rot + 0.3 + i / 12 * (TAU - 0.6); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * R * 0.92, Math.sin(a) * R * 0.92); ctx.stroke(); }
    if (d.flower) {
      for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; ctx.fillStyle = i % 2 ? '#fff4f8' : '#f6b8d2'; ellipse(ctx, R * 0.35 + Math.cos(a) * 3.6, -R * 0.2 + Math.sin(a) * 3.6, 3.4, 1.8, a); ctx.fill(); }
      ctx.fillStyle = '#ffe07a'; circle(ctx, R * 0.35, -R * 0.2, 2); ctx.fill();
    }
  } else if (d.type === 'bridge') {
    const hw = BRIDGE.hw + 8, hh = 26;
    ctx.fillStyle = 'rgba(0,15,20,0.45)'; ctx.fillRect(-hw, hh - 2, hw * 2, 14);
    for (let x = -hw; x < hw; x += 9) {
      ctx.fillStyle = rgb(mixc([140, 100, 60], [100, 70, 42], rng()));
      ctx.fillRect(x + 0.5, -hh + rng() * 2, 8, hh * 2 - rng() * 3);
    }
    ctx.fillStyle = '#4a321e'; ctx.fillRect(-hw, -hh - 3, hw * 2, 4); ctx.fillRect(-hw, hh - 1, hw * 2, 4);
    for (let x = -hw; x <= hw; x += 34) { ctx.fillStyle = '#3a2616'; ctx.fillRect(x - 2.5, -hh - 6, 5, 7); ctx.fillRect(x - 2.5, hh - 3, 5, 9); }
  } else if (d.type === 'canoe') {
    ctx.rotate(d.rot);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ellipse(ctx, 3, 4, 44, 11); ctx.fill();
    ctx.fillStyle = '#6b4526'; ctx.beginPath(); ctx.moveTo(-46, 0); ctx.quadraticCurveTo(0, -16, 46, 0); ctx.quadraticCurveTo(0, 16, -46, 0); ctx.fill();
    ctx.fillStyle = '#3a2412'; ctx.beginPath(); ctx.moveTo(-38, 0); ctx.quadraticCurveTo(0, -10, 38, 0); ctx.quadraticCurveTo(0, 10, -38, 0); ctx.fill();
    ctx.strokeStyle = '#8a6440'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-10, -8); ctx.lineTo(24, 10); ctx.stroke();
  } else if (d.type === 'firering') {
    ctx.fillStyle = 'rgba(20,12,8,0.75)'; ellipse(ctx, 0, 0, 24, 15); ctx.fill();
    for (let i = 0; i < 10; i++) {
      const a = i / 10 * TAU;
      blob(ctx, Math.cos(a) * 25, Math.sin(a) * 16, 5 + rng() * 2, '#9a978c', '#45433d');
    }
  } else if (d.type === 'totemring') {
    ctx.fillStyle = rgrad(ctx, 0, 0, 4, 64, [[0, '#8f8e80'], [1, '#5c5b52']]);
    ellipse(ctx, 0, 0, 62, 38); ctx.fill();
    ctx.strokeStyle = 'rgba(40,38,30,0.6)'; ctx.lineWidth = 1.4;
    ellipse(ctx, 0, 0, 48, 29); ctx.stroke();
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 30, Math.sin(a) * 18); ctx.lineTo(Math.cos(a) * 44, Math.sin(a) * 26); ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      blob(ctx, Math.cos(a) * 74, Math.sin(a) * 46, 7, '#a6a698', '#4c4c44');
    }
  } else if (d.type === 'petals') {
    for (let i = 0; i < 40; i++) {
      const a = rng() * TAU, r = Math.sqrt(rng()) * 60;
      ctx.fillStyle = d.v % 2 ? (i % 2 ? '#b569c6' : '#e2a3ee') : (i % 2 ? '#f0cf3a' : '#ffe680');
      ctx.globalAlpha = 0.85;
      ellipse(ctx, Math.cos(a) * r + 10, Math.sin(a) * r * 0.6, 2, 1.2, rng() * TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function decorRadius(d) {
  return d.type === 'bridge' ? 140 : d.type === 'totemring' ? 90 : d.type === 'petals' ? 80 : d.type === 'canoe' ? 60 : 50;
}
