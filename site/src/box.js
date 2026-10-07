import * as THREE from 'three';
import { drawLaurel } from './laurel.js';

/* ------------------------------------------------------------------
   Caixa da Maison Lourée em duas partes, como a embalagem real:
   base aberta com forro dourado acolchoado + tampa em pé atrás,
   papel texturizado (preto no Lourée Noir, vinho no Rose Dorée)
   com logo e filete em foil dourado.
   Origem da caixa: centro do fundo. Comprimento ao longo de z.
------------------------------------------------------------------- */

const PAPER = {
  noir: { base: '#141316', light: '#1d1b20' },
  rose: { base: '#3e0c1a', light: '#4f1424' },
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function grain(ctx, w, h, amount) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function foilGradient(c, h) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#f2d9a2');
  g.addColorStop(0.45, '#c99f5a');
  g.addColorStop(1, '#e9cb8c');
  return g;
}

// impressão da tampa (cor + metal/rugosidade no padrão glTF)
function lidPrint(key, aspect, anisotropy) {
  const W = 1024, H = Math.round(W * aspect);
  const P = PAPER[key];
  const draw = (c, paint) => {
    // filete duplo, como na caixa real
    paint();
    c.fillRect(46, 46, W - 92, 3); c.fillRect(46, H - 49, W - 92, 3);
    c.fillRect(46, 46, 3, H - 92); c.fillRect(W - 49, 46, 3, H - 92);
    c.textAlign = 'center';
    const cy = H * 0.44;
    drawLaurel(c, W / 2, cy - 110, 250);
    c.font = '500 140px "Cormorant Garamond"';
    c.fillText('L', W / 2, cy - 58);
    c.font = '500 70px "Cormorant Garamond"';
    c.letterSpacing = '12px';
    c.fillText('MAISON LOURÉE', W / 2 + 6, cy + 120);
    c.font = '400 22px "Manrope"';
    c.letterSpacing = '12px';
    c.fillText('PARFUMS', W / 2 + 6, cy + 180);
    c.font = 'italic 400 34px "Cormorant Garamond"';
    c.letterSpacing = '4px';
    c.fillText('L’art de se souvenir', W / 2, cy + 280);
    c.letterSpacing = '0px';
  };
  const [cv, c] = canvas(W, H);
  const g = c.createRadialGradient(W * 0.4, H * 0.3, 30, W / 2, H / 2, H * 0.8);
  g.addColorStop(0, P.light);
  g.addColorStop(1, P.base);
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  grain(c, W, H, 9);
  const foil = foilGradient(c, H);
  draw(c, () => { c.fillStyle = foil; });

  const [mv, m] = canvas(W, H);
  m.fillStyle = 'rgb(0,200,0)'; // papel: fosco, sem metal
  m.fillRect(0, 0, W, H);
  draw(m, () => { m.fillStyle = 'rgb(0,72,255)'; });

  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = anisotropy;
  const mr = new THREE.CanvasTexture(mv);
  mr.anisotropy = anisotropy;
  return { map, mr };
}

// papel liso com grão para as laterais
function paperTexture(key) {
  const [cv, c] = canvas(256, 256);
  c.fillStyle = PAPER[key].base;
  c.fillRect(0, 0, 256, 256);
  grain(c, 256, 256, 8);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// cetim dourado: costuras em losango com pespontos e fios em diagonal
let liningCache = null;
function liningTextures(anisotropy) {
  if (liningCache) return liningCache;
  const S = 512, cells = 4; // 4 losangos por repetição
  const [cv, c] = canvas(S, S);
  const g = c.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, '#d8b46a'); g.addColorStop(0.5, '#e8c985'); g.addColorStop(1, '#d1aa5e');
  c.fillStyle = g;
  c.fillRect(0, 0, S, S);
  // trama do cetim
  c.globalAlpha = 0.09;
  c.strokeStyle = '#7a5520';
  for (let i = -S; i < S * 2; i += 3) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + S * 0.35, S); c.stroke(); }
  c.globalAlpha = 1;
  // costuras e pespontos (no espaço da textura a grade é reta; o UV a gira em losango)
  const step = S / cells;
  for (let i = 0; i <= cells; i++) {
    const k = i * step;
    c.setLineDash([]);
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(90,58,18,.6)';
    c.beginPath(); c.moveTo(k, 0); c.lineTo(k, S); c.moveTo(0, k); c.lineTo(S, k); c.stroke();
    c.setLineDash([6, 5]);
    c.lineWidth = 1.4;
    c.strokeStyle = 'rgba(255,238,196,.6)';
    c.beginPath(); c.moveTo(k + 5, 0); c.lineTo(k + 5, S); c.moveTo(0, k + 5); c.lineTo(S, k + 5); c.stroke();
  }
  c.setLineDash([]);
  grain(c, S, S, 10);
  const map = new THREE.CanvasTexture(cv);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = anisotropy;
  liningCache = { map };
  return liningCache;
}

// altura do acolchoado (0..1) num ponto do forro; mesma grade das costuras da textura
function quilt(x, z, cell) {
  const u = (x + z) / cell, v = (x - z) / cell;
  const fu = u - Math.floor(u), fv = v - Math.floor(v);
  return Math.pow(Math.sin(Math.PI * fu) * Math.sin(Math.PI * fv), 0.55);
}

export class GiftBox {
  /* size: tamanho do frasco (x largura, y altura, z espessura) */
  constructor(key, size, anisotropy, envMap) {
    this.key = key;
    const W = size.x + 0.026;          // largura interna
    const L = size.y + 0.03;           // comprimento interno
    const D = size.z * 0.95 + 0.006;   // profundidade
    const T = 0.0022;                  // espessura do papelão
    this.W = W; this.L = L; this.D = D;
    this.cushion = D * 0.42;           // altura do topo do forro
    const group = (this.group = new THREE.Group());

    const paperMap = paperTexture(key);
    const paper = new THREE.MeshStandardMaterial({ map: paperMap, roughness: 0.78, metalness: 0, envMap, envMapIntensity: 0.6 });
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      group.add(m);
      return m;
    };

    // base: fundo + 4 paredes
    const OW = W + T * 2, OL = L + T * 2;
    add(new THREE.BoxGeometry(OW, T, OL), paper, 0, T / 2, 0);
    add(new THREE.BoxGeometry(OW, D, T), paper, 0, D / 2, OL / 2 - T / 2);
    add(new THREE.BoxGeometry(OW, D, T), paper, 0, D / 2, -OL / 2 + T / 2);
    add(new THREE.BoxGeometry(T, D, L), paper, OW / 2 - T / 2, D / 2, 0);
    add(new THREE.BoxGeometry(T, D, L), paper, -OW / 2 + T / 2, D / 2, 0);
    // filete dourado na borda da frente
    const foilMat = new THREE.MeshStandardMaterial({ color: '#d6b06a', metalness: 1, roughness: 0.3, envMap, envMapIntensity: 0.9 });
    add(new THREE.BoxGeometry(OW * 0.86, 0.0008, 0.0004), foilMat, 0, D * 0.5, OL / 2 + 0.0002);

    // forro acolchoado: malha com relevo real que pega luz
    const lining = liningTextures(anisotropy);
    const cell = 0.022;
    const lgeo = new THREE.PlaneGeometry(W, L, 96, Math.round(96 * L / W));
    lgeo.rotateX(-Math.PI / 2);
    const p = lgeo.attributes.position, uv = lgeo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      // as bordas descem até a parede, como tecido preso
      const edge = Math.min(1, (W / 2 - Math.abs(x)) / 0.008, (L / 2 - Math.abs(z)) / 0.008);
      p.setY(i, (quilt(x, z, cell) * 0.0042 - 0.002) * Math.max(0, edge));
      uv.setXY(i, (x + z) / (cell * 4), (x - z) / (cell * 4));
    }
    lgeo.computeVertexNormals();
    const liningMat = new THREE.MeshPhysicalMaterial({
      map: lining.map, color: '#b39468', metalness: 0.6, roughness: 0.42, envMap, envMapIntensity: 0.55,
      sheen: 0.5, sheenColor: new THREE.Color('#e8c58a'), sheenRoughness: 0.4,
    });
    this.liningMat = liningMat;
    const cushion = add(lgeo, liningMat, 0, this.cushion, 0);
    cushion.castShadow = false;
    // forro nas paredes internas
    const wallLining = new THREE.MeshStandardMaterial({ map: lining.map, color: '#9c8058', metalness: 0.55, roughness: 0.5, envMap, envMapIntensity: 0.5 });
    const wl = D - this.cushion;
    const mk = (w, h) => { const g = new THREE.PlaneGeometry(w, h); return g; };
    const front = add(mk(W, wl), wallLining, 0, this.cushion + wl / 2, L / 2 - 0.0002); front.rotation.y = Math.PI;
    add(mk(W, wl), wallLining, 0, this.cushion + wl / 2, -L / 2 + 0.0002);
    const r = add(mk(L, wl), wallLining, W / 2 - 0.0002, this.cushion + wl / 2, 0); r.rotation.y = -Math.PI / 2;
    const l = add(mk(L, wl), wallLining, -W / 2 + 0.0002, this.cushion + wl / 2, 0); l.rotation.y = Math.PI / 2;

    // tampa: placa + aba, em pé atrás da base e levemente inclinada para trás
    const LW = OW + 0.003, LL = OL + 0.003, rim = 0.012;
    const print = lidPrint(key, LL / LW, anisotropy);
    const printMat = new THREE.MeshStandardMaterial({
      map: print.map, metalnessMap: print.mr, roughnessMap: print.mr, metalness: 1, roughness: 1,
      envMap, envMapIntensity: 0.85,
    });
    const lid = (this.lid = new THREE.Group());
    const plate = new THREE.Mesh(new THREE.BoxGeometry(LW, T, LL), [paper, paper, printMat, paper, paper, paper]);
    plate.castShadow = plate.receiveShadow = true;
    lid.add(plate);
    const lidSide = (w, d, x, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, rim, d), paper);
      m.position.set(x, -rim / 2, z);
      m.castShadow = true;
      lid.add(m);
    };
    lidSide(LW, T, 0, LL / 2 - T / 2);
    lidSide(LW, T, 0, -LL / 2 + T / 2);
    lidSide(T, LL, LW / 2 - T / 2, 0);
    lidSide(T, LL, -LW / 2 + T / 2, 0);
    // a face impressa (topo, +y) vira para a frente: gira em x
    const lean = 14 * Math.PI / 180;
    lid.rotation.x = Math.PI / 2 - lean;
    // apoiada no chão logo atrás da base
    lid.position.set(0, Math.cos(lean) * LL / 2 + 0.0005, -OL / 2 - rim - Math.sin(lean) * LL / 2 - 0.002);
    group.add(lid);

    this.bounds = new THREE.Box3().setFromObject(group);
  }

  // onde o frasco deita: centro do forro (coordenadas da caixa)
  restPoint(size) {
    return new THREE.Vector3(0, this.cushion + size.z / 2 - 0.0012, size.y / 2);
  }
}
