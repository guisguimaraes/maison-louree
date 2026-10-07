import * as THREE from 'three';

/* ------------------------------------------------------------------
   Fundo: foto real de uma sala de luxo à noite (Pexels, licença livre),
   recortada e levemente desfocada, num plano atrás da bancada.
   O plano desce abaixo do chão (escondido por ele) para que a parte
   iluminada da sala — painéis, janelas, espelho — fique à altura dos
   frascos.
------------------------------------------------------------------- */

export const ROOM = { w: 3.4, h: 1.91, z: -1.05, cy: -0.5 };

export function makeRoom() {
  const tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}img/sala.webp`);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
