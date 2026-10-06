// Coroa de louros da marca: dois ramos que sobem a partir da base,
// com folhas em pares alternados. Coordenadas num quadro de 200 × 200.

const CX = 100, CY = 98, R = 74, A0 = 104, A1 = 232;

// ponto e tangente do ramo; side = 1 é o ramo esquerdo, -1 o direito
function onArc(deg, side) {
  const a = deg * Math.PI / 180;
  return {
    x: CX + side * Math.cos(a) * R,
    y: CY + Math.sin(a) * R,
    tx: -side * Math.sin(a),
    ty: Math.cos(a),
  };
}

function branch(side) {
  const leaves = [];
  const n = 9;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.6) / n;
    const p = onArc(A0 + (A1 - A0) * t, side);
    const base = Math.atan2(p.ty, p.tx);
    const len = 23 - t * 9;
    for (const s of [-1, 1]) {
      leaves.push({ x: p.x, y: p.y, a: base + s * 0.62, len, wid: len * 0.34 });
    }
  }
  const e = onArc(A1, side);
  leaves.push({ x: e.x, y: e.y, a: Math.atan2(e.ty, e.tx), len: 15, wid: 5 });
  const stem = [];
  for (let i = 0; i <= 40; i++) {
    const p = onArc(A0 + (A1 - A0) * (i / 40), side);
    stem.push([p.x, p.y]);
  }
  return { leaves, stem };
}

export function laurelShapes() {
  const out = { leaves: [], stems: [] };
  for (const side of [1, -1]) {
    const b = branch(side);
    out.leaves.push(...b.leaves);
    out.stems.push(b.stem);
  }
  return out;
}

function leafPoints(l) {
  const dx = Math.cos(l.a), dy = Math.sin(l.a);
  const nx = -dy, ny = dx;
  const tip = [l.x + dx * l.len, l.y + dy * l.len];
  const mid = [l.x + dx * l.len * 0.48, l.y + dy * l.len * 0.48];
  return {
    base: [l.x, l.y], tip,
    c1: [mid[0] + nx * l.wid, mid[1] + ny * l.wid],
    c2: [mid[0] - nx * l.wid, mid[1] - ny * l.wid],
  };
}

export function laurelSVG() {
  const { leaves, stems } = laurelShapes();
  const f = (p) => `${p[0].toFixed(2)} ${p[1].toFixed(2)}`;
  let s = '';
  for (const st of stems) {
    s += `<path d="M${st.map(f).join(' L')}" fill="none" stroke="currentColor" stroke-width="1.1"/>`;
  }
  for (const l of leaves) {
    const p = leafPoints(l);
    s += `<path d="M${f(p.base)} Q${f(p.c1)} ${f(p.tip)} Q${f(p.c2)} ${f(p.base)}Z"/>`;
  }
  return s;
}

export function drawLaurel(ctx, x, y, size) {
  const k = size / 200;
  const { leaves, stems } = laurelShapes();
  ctx.save();
  ctx.translate(x - 100 * k, y - 100 * k);
  ctx.scale(k, k);
  ctx.lineWidth = 1.3;
  for (const st of stems) {
    ctx.beginPath();
    st.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
    ctx.stroke();
  }
  for (const l of leaves) {
    const p = leafPoints(l);
    ctx.beginPath();
    ctx.moveTo(...p.base);
    ctx.quadraticCurveTo(...p.c1, ...p.tip);
    ctx.quadraticCurveTo(...p.c2, ...p.base);
    ctx.fill();
  }
  ctx.restore();
}
