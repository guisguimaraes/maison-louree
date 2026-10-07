import * as THREE from 'three';

/* ------------------------------------------------------------------
   Fundo: sala de luxo à noite, fora de foco (como numa foto de produto
   com a lente aberta). Parede de mármore escuro com fita de LED quente,
   aparador baixo com velas, nichos com prateleiras iluminadas e cortina.
   Pintado em canvas e desfocado; vai num plano atrás da bancada.
   Escala: W metros de largura × H metros de altura, base no chão.
------------------------------------------------------------------- */

export const ROOM = { w: 3.6, h: 1.6, z: -1.6, floor: -0.14 };

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export function makeRoom() {
  const PX = 1600 / ROOM.w;            // pixels por metro
  const Wp = 1600, Hp = Math.round(ROOM.h * PX);
  const X = (m) => (m + ROOM.w / 2) * PX;          // x em metros (0 = centro)
  const Y = (m) => Hp - (m - ROOM.floor) * PX;     // altura em metros
  const r = rng(11);

  const c = document.createElement('canvas');
  c.width = Wp; c.height = Hp;
  const g = c.getContext('2d');

  // parede de fundo: quase preta, um pouco mais quente no centro
  const bg = g.createRadialGradient(X(0.1), Y(0.35), 40, X(0.1), Y(0.35), Wp * 0.7);
  bg.addColorStop(0, '#2a221c');
  bg.addColorStop(1, '#0d0b0a');
  g.fillStyle = bg;
  g.fillRect(0, 0, Wp, Hp);

  // painel de mármore escuro com veios claros
  const px0 = X(-0.55), px1 = X(0.95), py0 = Y(1.6), py1 = Y(0.1);
  const pg = g.createLinearGradient(0, py0, 0, py1);
  pg.addColorStop(0, '#1a1614');
  pg.addColorStop(1, '#2b2420');
  g.fillStyle = pg;
  g.fillRect(px0, py0, px1 - px0, py1 - py0);
  g.save();
  g.beginPath(); g.rect(px0, py0, px1 - px0, py1 - py0); g.clip();
  for (let i = 0; i < 26; i++) {
    g.strokeStyle = `rgba(${200 + r() * 40},${180 + r() * 30},${150 + r() * 30},${0.05 + r() * 0.1})`;
    g.lineWidth = 0.6 + r() * 2.2;
    g.beginPath();
    let x = px0 + r() * (px1 - px0), y = py0 + r() * (py1 - py0) * 0.3;
    g.moveTo(x, y);
    for (let k = 0; k < 8; k++) {
      const nx = x + (r() - 0.35) * 160, ny = y + 30 + r() * 90;
      g.quadraticCurveTo(x + (r() - 0.5) * 120, (y + ny) / 2, nx, ny);
      x = nx; y = ny;
    }
    g.stroke();
  }
  g.restore();
  // luz rasante de cima sobre o mármore
  const wash = g.createLinearGradient(0, py0, 0, py0 + 260);
  wash.addColorStop(0, 'rgba(255,190,110,.32)');
  wash.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = wash;
  g.fillRect(px0, py0, px1 - px0, 260);

  // aparador baixo com fita de LED embaixo e em cima
  const cy0 = Y(0.16), cy1 = Y(ROOM.floor + 0.04);
  g.fillStyle = '#0f0d0c';
  g.fillRect(X(-0.95), cy0, X(1.25) - X(-0.95), cy1 - cy0);
  const led = (x0, x1, y, a = 1) => {
    const lg = g.createLinearGradient(0, y - 30, 0, y + 30);
    lg.addColorStop(0, 'rgba(255,170,80,0)');
    lg.addColorStop(0.5, `rgba(255,196,120,${0.95 * a})`);
    lg.addColorStop(1, 'rgba(255,170,80,0)');
    g.fillStyle = lg;
    g.fillRect(x0, y - 30, x1 - x0, 60);
    g.fillStyle = `rgba(255,236,200,${a})`;
    g.fillRect(x0, y - 2, x1 - x0, 4);
  };
  led(X(-0.95), X(1.25), cy1 + 6, 0.8);
  led(X(-0.55), X(0.95), py1 - 4, 0.65);
  // velas sobre o aparador
  for (const [mx, h] of [[0.62, 0.09], [0.7, 0.06], [0.78, 0.12]]) {
    g.fillStyle = '#e9dcc4';
    g.fillRect(X(mx) - 7, cy0 - h * PX, 14, h * PX);
    const fl = g.createRadialGradient(X(mx), cy0 - h * PX - 10, 0, X(mx), cy0 - h * PX - 10, 46);
    fl.addColorStop(0, 'rgba(255,220,150,1)');
    fl.addColorStop(0.25, 'rgba(255,170,70,.55)');
    fl.addColorStop(1, 'rgba(255,140,40,0)');
    g.fillStyle = fl;
    g.fillRect(X(mx) - 50, cy0 - h * PX - 60, 100, 100);
  }
  // vaso com galhos secos
  g.fillStyle = '#16120f';
  g.beginPath(); g.ellipse(X(-0.3), cy0 - 34, 30, 40, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(205,180,140,.5)';
  for (let i = 0; i < 9; i++) {
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(X(-0.3), cy0 - 60);
    g.quadraticCurveTo(X(-0.3) + (r() - 0.5) * 80, cy0 - 150, X(-0.3) + (r() - 0.5) * 160, cy0 - 190 - r() * 90);
    g.stroke();
  }

  // nicho com prateleiras iluminadas e objetos
  const nx0 = X(-1.62), nx1 = X(-0.78);
  g.fillStyle = '#120f0d';
  g.fillRect(nx0, Y(1.6), nx1 - nx0, Y(0.16) - Y(1.6));
  for (const sh of [0.34, 0.6, 0.86, 1.12, 1.38]) {
    const sy = Y(sh);
    // luz de cima de cada prateleira
    const sl = g.createLinearGradient(0, sy - 120, 0, sy);
    sl.addColorStop(0, 'rgba(255,186,110,.42)');
    sl.addColorStop(1, 'rgba(255,186,110,.06)');
    g.fillStyle = sl;
    g.fillRect(nx0, sy - 120, nx1 - nx0, 120);
    led(nx0, nx1, sy - 124, 0.6);
    g.fillStyle = '#2a211a';
    g.fillRect(nx0, sy, nx1 - nx0, 10);
    // objetos: frascos, vasos e livros
    let x = nx0 + 20;
    while (x < nx1 - 50) {
      const kind = r();
      const w = 22 + r() * 40, h = 40 + r() * 70;
      const col = `rgb(${40 + r() * 70},${32 + r() * 50},${24 + r() * 30})`;
      g.fillStyle = col;
      if (kind < 0.35) { g.fillRect(x, sy - h, w * 0.7, h); g.fillRect(x + w * 0.2, sy - h - 14, w * 0.3, 14); }
      else if (kind < 0.7) { g.beginPath(); g.ellipse(x + w / 2, sy - h * 0.45, w / 2, h * 0.45, 0, 0, Math.PI * 2); g.fill(); }
      else { for (let b = 0; b < 4; b++) g.fillRect(x + b * 9, sy - h * 0.7, 8, h * 0.7); }
      // brilho de cima no objeto
      g.fillStyle = 'rgba(255,214,160,.25)';
      g.fillRect(x, sy - h, w * 0.6, 4);
      x += w + 18 + r() * 30;
    }
  }
  led(nx1 - 3, nx1 + 3, Y(0.9), 0); // borda do nicho
  g.fillStyle = 'rgba(255,190,120,.35)';
  g.fillRect(nx1 - 2, Y(1.6), 4, Y(0.16) - Y(1.6));

  // cortina à direita (pregas verticais)
  const kx0 = X(1.3), kx1 = X(1.8);
  for (let x = kx0; x < kx1; x += 6) {
    const f = Math.sin((x - kx0) * 0.06) * 0.5 + Math.sin((x - kx0) * 0.017 + 1) * 0.5;
    const v = 18 + f * 12;
    g.fillStyle = `rgb(${v + 8},${v + 4},${v})`;
    g.fillRect(x, 0, 6, Hp);
  }

  // desfoque de lente + vinheta
  const out = document.createElement('canvas');
  out.width = Wp; out.height = Hp;
  const o = out.getContext('2d');
  o.filter = 'blur(9px)';
  o.drawImage(c, 0, 0);
  o.filter = 'none';
  const v = o.createRadialGradient(Wp / 2, Hp * 0.75, Hp * 0.2, Wp / 2, Hp * 0.7, Wp * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.65)');
  o.fillStyle = v;
  o.fillRect(0, 0, Wp, Hp);

  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
