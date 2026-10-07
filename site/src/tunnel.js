import * as THREE from 'three';

const DEG = Math.PI / 180;

/* Túnel de pontos de luz que leva até os frascos.
   Anéis de pontos ao longo de um eixo que termina no par de frascos:
   perto da câmera, rosé e vinho; no fundo, dourado e quase branco. */
export class Tunnel {
  constructor(center, az, el, { radius = 0.16, start = 0.45, end = 7, step = 0.085, perRing = 64 } = {}) {
    const axis = new THREE.Vector3(
      Math.sin(az * DEG) * Math.cos(el * DEG),
      Math.sin(el * DEG),
      Math.cos(az * DEG) * Math.cos(el * DEG),
    );
    const u = new THREE.Vector3(0, 1, 0).cross(axis).normalize();
    const v = axis.clone().cross(u).normalize();

    const rings = Math.floor((end - start) / step);
    const n = rings * perRing;
    const aS = new Float32Array(n), aTheta = new Float32Array(n), aSeed = new Float32Array(n);
    let k = 0;
    for (let i = 0; i < rings; i++) {
      const s = start + i * step;
      const twist = i * 0.21; // cada anel um pouco girado: forma a espiral
      for (let j = 0; j < perRing; j++, k++) {
        aS[k] = s;
        aTheta[k] = (j / perRing) * Math.PI * 2 + twist;
        aSeed[k] = Math.random();
      }
    }
    const geo = new THREE.BufferGeometry();
    // posição real é calculada no shader; esta só serve para o recorte de visão
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    geo.setAttribute('aS', new THREE.BufferAttribute(aS, 1));
    geo.setAttribute('aTheta', new THREE.BufferAttribute(aTheta, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(aSeed, 1));

    this.uniforms = {
      uC: { value: center.clone() }, uAxis: { value: axis }, uU: { value: u }, uV: { value: v },
      uR: { value: radius }, uTime: { value: 0 }, uSpin: { value: 0 },
      uPx: { value: 800 }, uAspect: { value: 1 }, uSize: { value: 0.011 },
      uStretch: { value: 1 }, uFade: { value: 0 }, uDpr: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      vertexShader: /* glsl */`
        attribute float aS; attribute float aTheta; attribute float aSeed;
        uniform vec3 uC, uAxis, uU, uV;
        uniform float uR, uTime, uSpin, uPx, uAspect, uSize, uStretch, uFade, uDpr;
        varying vec3 vCol; varying float vA; varying float vAng; varying float vStretch;
        void main(){
          float th = aTheta + uSpin * (1.0 + aS * 0.04) + sin(aS * 1.3 - uTime * 0.5) * 0.06;
          float r = uR * (1.0 + 0.05 * sin(aS * 2.2 + uTime * 0.35));
          vec3 ring = uC + uAxis * aS;
          vec3 pos = ring + (uU * cos(th) + uV * sin(th)) * r;
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          float depth = -mv.z;

          // direção radial na tela (o rastro do movimento segue o raio)
          vec4 cc = projectionMatrix * modelViewMatrix * vec4(ring, 1.0);
          vec2 d = gl_Position.xy / gl_Position.w - cc.xy / cc.w;
          d.x *= uAspect;
          vAng = atan(d.y, d.x);

          float st = 1.0 + (uStretch - 1.0) * smoothstep(3.0, 0.4, depth);
          vStretch = st;
          gl_PointSize = clamp(uSize * uPx * uDpr / depth * mix(1.0, st, 0.7), 0.0, 46.0 * uDpr);

          // fundo: champanhe quase branco > dourado > rosé > vinho (perto da câmera)
          vec3 white = vec3(1.0, 0.94, 0.80);
          vec3 gold  = vec3(0.98, 0.72, 0.38);
          vec3 rose  = vec3(0.92, 0.40, 0.42);
          vec3 wine  = vec3(0.62, 0.14, 0.26);
          float s = aS + (aSeed - 0.5) * 0.5;
          vec3 c = mix(white, gold, smoothstep(0.5, 1.6, s));
          c = mix(c, rose, smoothstep(1.4, 3.2, s));
          c = mix(c, wine, smoothstep(3.6, 6.0, s));
          vCol = c;

          float wave = 0.72 + 0.28 * sin(aS * 4.0 - uTime * 1.6 + aSeed * 0.8);
          float twinkle = 0.85 + 0.15 * sin(uTime * (1.5 + aSeed * 2.0) + aSeed * 30.0);
          float nearFade = smoothstep(0.05, 0.4, depth);
          float farFade = 1.0 - smoothstep(5.5, 7.5, depth);
          vA = uFade * wave * twinkle * nearFade * farFade * mix(1.25, 0.8, smoothstep(0.5, 4.0, aS));
        }`,
      fragmentShader: /* glsl */`
        varying vec3 vCol; varying float vA; varying float vAng; varying float vStretch;
        void main(){
          vec2 p = gl_PointCoord - 0.5;
          p.y = -p.y;
          float c = cos(vAng), s = sin(vAng);
          vec2 q = vec2(c * p.x + s * p.y, -s * p.x + c * p.y); // x = radial, y = tangente
          float rx = 0.46, ry = 0.46 / vStretch;
          float d = length(vec2(q.x / rx, q.y / ry));
          float a = smoothstep(1.0, 0.35, d);
          a *= a;
          if (a < 0.01) discard;
          gl_FragColor = vec4(vCol * a * vA * 2.4, 1.0);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 20;
    this.axis = axis;
  }

  resize(h, fovDeg, aspect, dpr) {
    this.uniforms.uPx.value = h / (2 * Math.tan((fovDeg / 2) * DEG));
    this.uniforms.uAspect.value = aspect;
    this.uniforms.uDpr.value = dpr;
  }
}
