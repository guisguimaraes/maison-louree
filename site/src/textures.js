import * as THREE from 'three';
import { drawLaurel } from './laurel.js';

/* ------------------------------------------------------------------
   Rótulos: refeitos no mesmo layout do rótulo original do modelo,
   com Cormorant/Manrope e o dourado como foil metálico de verdade
   (mapa de metal/rugosidade separado: o dourado brilha ao girar).
------------------------------------------------------------------- */

const LABELS = {
  rose: { bg: '#5f1c37', bg2: '#74284a', name: 'Rose Dorée', nameColor: '#eab0bf' },
  noir: { bg: '#211a22', bg2: '#2c2330', name: 'Lourée Noir', nameColor: '#ead2a2' },
};

function grain(ctx, w, h, amount) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

// desenha o layout; `paint(kind)` define a tinta de cada elemento
function layout(ctx, key, paint) {
  const c = ctx;
  const W = 1024;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';

  paint('foil');
  drawLaurel(c, W / 2, 248, 270);
  c.font = '500 150px "Cormorant Garamond"';
  c.letterSpacing = '0px';
  c.fillText('L', W / 2, 302);

  c.font = '500 74px "Cormorant Garamond"';
  c.letterSpacing = '13px';
  c.fillText('MAISON LOURÉE', W / 2 + 6, 498);

  c.font = '400 23px "Manrope"';
  c.letterSpacing = '13px';
  c.fillText('PARFUMS', W / 2 + 6, 562);

  c.font = 'italic 400 36px "Cormorant Garamond"';
  c.letterSpacing = '4px';
  c.fillText('L’art de se souvenir', W / 2, 684);

  c.fillRect(250, 758, 524, 2);
  c.save();
  c.translate(W / 2, 759);
  c.rotate(Math.PI / 4);
  c.fillRect(-6, -6, 12, 12);
  c.restore();

  paint('name');
  c.font = '400 62px "Manrope"';
  c.letterSpacing = '1px';
  c.fillText(LABELS[key].name, W / 2, 850);

  paint('foil');
  c.font = '500 28px "Cormorant Garamond"';
  c.letterSpacing = '10px';
  c.fillText('EAU DE PARFUM', W / 2 + 5, 926);
}

export function makeLabel(key, anisotropy) {
  const L = LABELS[key];
  const W = 1024;

  // cor
  const cv = document.createElement('canvas');
  cv.width = cv.height = W;
  const c = cv.getContext('2d');
  const g = c.createRadialGradient(W * 0.45, W * 0.35, 40, W / 2, W / 2, W * 0.75);
  g.addColorStop(0, L.bg2);
  g.addColorStop(1, L.bg);
  c.fillStyle = g;
  c.fillRect(0, 0, W, W);
  grain(c, W, W, 10);
  const foil = c.createLinearGradient(0, 120, 0, 940);
  foil.addColorStop(0, '#f0d79f');
  foil.addColorStop(0.5, '#cfa863');
  foil.addColorStop(1, '#e5c787');
  layout(c, key, (kind) => { c.fillStyle = kind === 'foil' ? foil : L.nameColor; c.strokeStyle = foil; });

  // metal (B) e rugosidade (G), como no glTF
  const mv = document.createElement('canvas');
  mv.width = mv.height = W;
  const m = mv.getContext('2d');
  m.fillStyle = 'rgb(0,190,0)';
  m.fillRect(0, 0, W, W);
  layout(m, key, (kind) => {
    const col = kind === 'foil' ? 'rgb(0,70,255)' : 'rgb(0,150,0)';
    m.fillStyle = col; m.strokeStyle = col;
  });

  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.flipY = false;
  map.anisotropy = anisotropy;
  const mr = new THREE.CanvasTexture(mv);
  mr.flipY = false;
  mr.anisotropy = anisotropy;
  return { map, mr };
}

/* ------------------------------------------------------------------
   Mármore branco (Carrara): ruído fractal + veios finos acinzentados.
------------------------------------------------------------------- */

function makeNoise(seed) {
  const p = new Uint8Array(512);
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const val = new Float32Array(256).map(() => rnd());
  const fade = (t) => t * t * (3 - 2 * t);
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const a = val[p[p[X] + Y]], b = val[p[p[X + 1] + Y]];
    const c = val[p[p[X] + Y + 1]], d = val[p[p[X + 1] + Y + 1]];
    const u = fade(xf), v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  return function fbm(x, y, oct = 5) {
    let f = 0, amp = 0.5, fr = 1;
    for (let i = 0; i < oct; i++) { f += amp * noise(x * fr, y * fr); fr *= 2.03; amp *= 0.5; }
    return f;
  };
}

export function makeMarble(anisotropy) {
  const W = 1024;
  const fbm = makeNoise(7);
  const cv = document.createElement('canvas');
  cv.width = cv.height = W;
  const c = cv.getContext('2d');
  const img = c.createImageData(W, W);
  const rv = document.createElement('canvas');
  rv.width = rv.height = W;
  const r = rv.getContext('2d');
  const rimg = r.createImageData(W, W);
  const d = img.data, rd = rimg.data;

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W, v = y / W;
      const n = fbm(u * 3, v * 3);
      const w = fbm(u * 1.7 + 5.2, v * 1.7 + 1.3, 4);
      const cloud = fbm(u * 7 + 11, v * 7 + 3, 4);
      const s1 = 1 - Math.abs(Math.sin((u * 2.1 + v * 0.9 + n * 2.6) * Math.PI * 1.25));
      const s2 = 1 - Math.abs(Math.sin((u * 0.8 - v * 2.3 + w * 3.4) * Math.PI * 2.2));
      const vein = Math.pow(s1, 22) * (0.25 + n * 0.5) + Math.pow(s2, 50) * 0.22 + Math.pow(s1, 5) * 0.05;
      const shade = (cloud - 0.5) * 9;
      const i = (y * W + x) * 4;
      d[i] = 226 + shade - vein * 62;
      d[i + 1] = 223 + shade - vein * 60;
      d[i + 2] = 218 + shade - vein * 52;
      d[i + 3] = 255;
      rd[i] = 0;
      rd[i + 1] = 58 + vein * 70 + cloud * 20;
      rd[i + 2] = 0;
      rd[i + 3] = 255;
    }
  }
  c.putImageData(img, 0, 0);
  r.putImageData(rimg, 0, 0);
  // suaviza os veios (mármore polido, não rachadura)
  c.filter = 'blur(1.6px)';
  c.drawImage(cv, 0, 0);
  c.filter = 'none';
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = anisotropy;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  const rough = new THREE.CanvasTexture(rv);
  rough.wrapS = rough.wrapT = THREE.RepeatWrapping;
  return { map, rough };
}

/* ------------------------------------------------------------------
   Sombras de folhas de palmeira (máscara da luz principal).
   Cada folha é desenhada uma vez, já desfocada; a cada quadro só
   giramos esses "carimbos" para as folhas balançarem (leve na GPU).
------------------------------------------------------------------- */

const FRONDS = [
  { x: -0.1, y: 0.3, a: 0.12, len: 0.9, ph: 0.0 },
  { x: 1.1, y: 0.18, a: 2.75, len: 0.75, ph: 1.7 },
  { x: 0.55, y: -0.12, a: 1.75, len: 0.6, ph: 3.1 },
  { x: 1.12, y: 0.95, a: 3.75, len: 0.62, ph: 4.4 },
  { x: -0.12, y: 1.05, a: -0.45, len: 0.55, ph: 2.3 },
];

// desenha uma folha com a base em (0,0) apontando para +x
function drawFrond(c, L, seed) {
  const bend = 0.32;
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const k = i / 24;
    const ang = bend * k * k;
    const prev = pts[i - 1] || [0, 0];
    pts.push(i ? [prev[0] + Math.cos(ang) * L / 24, prev[1] + Math.sin(ang) * L / 24] : [0, 0]);
  }
  c.lineWidth = L * 0.008;
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.stroke();
  // folíolos: compridos, finos e separados (a luz passa entre eles)
  for (let i = 2; i < 24; i += 1.4) {
    const k = i / 24;
    const [x, y] = pts[Math.floor(i)];
    const ang = bend * k * k;
    const ll = L * (0.32 - k * 0.18);
    const jitter = Math.sin(i * 12.9898 + seed * 78.233) * 0.07;
    for (const s of [-1, 1]) {
      const la = ang + s * (0.95 - k * 0.2) + jitter + 0.18;
      const droop = s * 0.18;
      const tx = x + Math.cos(la + droop) * ll, ty = y + Math.sin(la + droop) * ll;
      const wd = ll * 0.045;
      const mx = x + Math.cos(la) * ll * 0.5, my = y + Math.sin(la) * ll * 0.5;
      const nx = -Math.sin(la) * wd, ny = Math.cos(la) * wd;
      c.beginPath();
      c.moveTo(x, y);
      c.quadraticCurveTo(mx + nx, my + ny, tx, ty);
      c.quadraticCurveTo(mx - nx, my - ny, x, y);
      c.fill();
    }
  }
}

export class LeafGobo {
  constructor(size = 512) {
    this.size = size;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    // canvas na CPU: enviar para a GPU sem precisar copiar de volta (muito mais leve)
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = THREE.LinearFilter;
    this.sprites = FRONDS.map((f, i) => {
      const L = f.len * size;
      const cv = document.createElement('canvas');
      const pad = L * 0.45;
      cv.width = Math.ceil(L + pad * 2);
      cv.height = Math.ceil(L * 1.3);
      const c = cv.getContext('2d', { willReadFrequently: true });
      c.filter = `blur(${size * 0.006}px)`;
      c.fillStyle = c.strokeStyle = 'rgb(20,12,4)';
      c.translate(pad, cv.height * 0.42);
      drawFrond(c, L, i);
      return { cv, ox: pad, oy: cv.height * 0.42 };
    });
    this.draw(0, 1);
  }

  // t: tempo; open: 0 = luz fechada (escuro), 1 = luz aberta
  draw(t, open = 1, drift = 0) {
    const { ctx: c, size: S } = this;
    c.fillStyle = '#fff3df';
    c.fillRect(0, 0, S, S);
    FRONDS.forEach((f, i) => {
      const sp = this.sprites[i];
      const sway = Math.sin(t * 0.55 + f.ph) * 0.045 + Math.sin(t * 1.3 + f.ph * 2) * 0.012;
      const breath = 1 + Math.sin(t * 0.8 + f.ph) * 0.012;
      c.save();
      c.translate((f.x + drift) * S, f.y * S);
      c.rotate(f.a + sway);
      c.scale(breath, 1);
      c.drawImage(sp.cv, -sp.ox, -sp.oy);
      c.restore();
    });

    // abertura da luz: uma faixa que varre da esquerda para a direita
    if (open < 1) {
      const edge = -0.3 + open * 1.6;
      const g = c.createLinearGradient(0, 0, S, S * 0.3);
      g.addColorStop(Math.max(0, Math.min(1, edge - 0.3)), 'rgba(0,0,0,0)');
      g.addColorStop(Math.max(0, Math.min(1, edge)), 'rgba(0,0,0,1)');
      c.fillStyle = g;
      c.fillRect(0, 0, S, S);
    }
    this.texture.needsUpdate = true;
  }
}
