// Bettél - a 3D watch built from the workshop's own product photography.
// Dial, bezel and caseback are textured with circular crops of the real photos; the case side is a
// polar unwrap of the real Kiaat bezel; straps use the real leather. explode(p) is a pure function of p.
import * as THREE from 'three';
import { RoomEnvironment } from '../../vendor/RoomEnvironment.js';

export function webglAvailable() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}

const IMG = new URL('../img/x/', import.meta.url).href;
const loader = new THREE.TextureLoader();
const texCache = {};
function tex(name, { repeat = null, color = true } = {}) {
  const key = name + (repeat ? repeat.join() : '');
  if (texCache[key]) return texCache[key];
  const t = loader.load(IMG + name);
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return (texCache[key] = t);
}

const DIAL_R = 0.86;
const THICK = 0.39;                     // 8.5 mm on a 44 mm case (radius 1 = 22 mm)
const DIALS = { walnut: 'tex-front.webp', beech: 'tex-front-beech.webp', carbon: 'tex-front-carbon.webp', auto: 'tex-front-auto.webp' };
const METALS = { silver: 0xd9dadc, gold: 0xd8b26a };

function photoMat(map) {
  return new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: 0xffffff, emissiveIntensity: 0.62, color: 0x9a9a9a, roughness: 0.62, metalness: 0, transparent: true, alphaTest: 0.02 });
}

// a planar-UV disc / ring cut from the same square photo crop (photo radius = 1)
function discGeo(r, inner = 0) {
  const g = inner > 0 ? new THREE.RingGeometry(inner, r, 160, 1) : new THREE.CircleGeometry(r, 160);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * 0.5 + 0.5, p.getY(i) * 0.5 + 0.5);
  return g;
}

// a strap that leaves the lug and bends back round the wrist
function strapGeo(width, len, thick, bendR, dir) {
  const g = new THREE.BoxGeometry(width, len, thick, 2, 48, 1);
  g.translate(0, len / 2, 0);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const s = p.getY(i), zt = p.getZ(i), a = s / bendR;
    p.setY(i, dir * (bendR + zt) * Math.sin(a));
    p.setZ(i, -bendR * (1 - Math.cos(a)) + zt * Math.cos(a));
  }
  g.computeVertexNormals();
  return g;
}

const LEATHER = { brown: ['#432a1c', '#2a1a10'], black: ['#2b2826', '#161413'], tan: ['#94622f', '#6a4421'] };
const leatherCache = {};
function leatherTexture(c) {
  if (leatherCache[c]) return leatherCache[c];
  const [base, edge] = LEATHER[c] || LEATHER.brown;
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 1024;
  const x = cv.getContext('2d');
  x.fillStyle = base; x.fillRect(0, 0, 256, 1024);
  const img = x.getImageData(0, 0, 256, 1024), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const px = (i / 4) % 256, n = (Math.random() - 0.5) * 26;
    const e = Math.min(px, 255 - px) < 14 ? -28 * (1 - Math.min(px, 255 - px) / 14) : 0;
    d[i] += n + e; d[i + 1] += n * 0.9 + e; d[i + 2] += n * 0.8 + e;
  }
  x.putImageData(img, 0, 0);
  x.strokeStyle = edge; x.globalAlpha = 0.5; x.lineWidth = 3; x.setLineDash([10, 8]);
  for (const sx of [24, 232]) { x.beginPath(); x.moveTo(sx, 0); x.lineTo(sx, 1024); x.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, 2);
  return (leatherCache[c] = t);
}

function movementTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const x = c.getContext('2d'); const C = 512;
  const g = x.createRadialGradient(C, C, 40, C, C, 512);
  g.addColorStop(0, '#b9b6b0'); g.addColorStop(1, '#6f6c68');
  x.fillStyle = g; x.beginPath(); x.arc(C, C, 510, 0, Math.PI * 2); x.fill();
  // côtes de Genève stripes
  x.save(); x.beginPath(); x.arc(C, C, 500, 0, Math.PI * 2); x.clip();
  for (let i = -12; i < 12; i++) { x.fillStyle = i % 2 ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.05)'; x.fillRect(C + i * 44, 0, 44, 1024); }
  x.restore();
  const gear = (gx, gy, r, teeth, col) => {
    x.save(); x.translate(gx, gy);
    x.fillStyle = col; x.beginPath();
    for (let i = 0; i < teeth * 2; i++) { const a = (i / (teeth * 2)) * Math.PI * 2, rr = i % 2 ? r : r * 0.94; x.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    x.closePath(); x.fill();
    x.globalCompositeOperation = 'destination-out';
    x.beginPath(); x.arc(0, 0, r * 0.82, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = 'source-over';
    x.strokeStyle = col; x.lineWidth = r * 0.09;
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + 0.3; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * r * 0.84, Math.sin(a) * r * 0.84); x.stroke(); }
    x.fillStyle = col; x.beginPath(); x.arc(0, 0, r * 0.2, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.arc(0, 0, r * 0.07, 0, Math.PI * 2); x.fill();
    x.restore();
  };
  gear(C - 110, C + 150, 165, 90, '#b8954d');
  gear(C + 175, C + 70, 120, 66, '#c7a35a');
  gear(C + 60, C - 190, 95, 54, '#b08c45');
  gear(C - 240, C - 110, 70, 40, '#c7a35a');
  // bridges
  x.fillStyle = 'rgba(150,147,141,.96)'; x.strokeStyle = 'rgba(60,55,50,.45)'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(C - 420, C - 230); x.quadraticCurveTo(C - 80, C - 420, C + 330, C - 300); x.lineTo(C + 360, C - 200); x.quadraticCurveTo(C - 60, C - 300, C - 380, C - 130); x.closePath(); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(C + 300, C + 320); x.quadraticCurveTo(C + 420, C + 120, C + 400, C - 40); x.lineTo(C + 470, C - 30); x.quadraticCurveTo(C + 480, C + 200, C + 350, C + 380); x.closePath(); x.fill(); x.stroke();
  for (const [a, r] of [[0.4, 430], [2.3, 420], [4.1, 440], [5.3, 300]]) {
    const px = C + Math.cos(a) * r, py = C + Math.sin(a) * r;
    x.fillStyle = '#c9c6c0'; x.beginPath(); x.arc(px, py, 22, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#9b1028'; x.beginPath(); x.arc(px, py, 10, 0, Math.PI * 2); x.fill();
  }
  x.strokeStyle = 'rgba(40,30,20,.45)'; x.lineWidth = 6;
  x.beginPath(); x.arc(C, C, 485, 0, Math.PI * 2); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

export class WatchStudio {
  constructor(host, { dial = 'walnut', strap = 'brown', metal = 'silver', dpr = 2 } = {}) {
    this.host = host;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(devicePixelRatio || 1, dpr));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    host.appendChild(r.domElement);
    r.domElement.setAttribute('aria-hidden', 'true');

    this.scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    this.camera.position.set(0, 0, 9);
    const key = new THREE.DirectionalLight(0xfff1dc, 1.6); key.position.set(3, 4, 6); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffe0b0, 0.8); rim.position.set(-5, -2, -3); this.scene.add(rim);

    this.root = new THREE.Group(); this.scene.add(this.root);
    this.watch = new THREE.Group(); this.root.add(this.watch);
    this.parts = {};
    this.build(dial, strap, metal);

    this.explodeP = 0; this.yaw = 0; this.pitch = 0; this.roll = 0;
    this.tYaw = 0; this.tPitch = 0; this.pointer = { x: 0, y: 0 }; this.idle = true; this.scale = 1;
    this.visible = true; this.t0 = performance.now();
    this.resize();
    new ResizeObserver(() => this.resize()).observe(host);
    new IntersectionObserver(es => { this.visible = es[0].isIntersecting; if (this.visible) this.loop(); }).observe(host);
    this.loop();
  }

  build(dial, strap, metal) {
    const W = this.watch, P = this.parts;
    const steel = (this.metalMat = new THREE.MeshStandardMaterial({ color: METALS[metal], metalness: 1, roughness: 0.22 }));

    const sideTex = tex('tex-side.webp', { repeat: [2, 1] });
    P.case = new THREE.Group();
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, THICK, 160, 1, true), new THREE.MeshStandardMaterial({ map: sideTex, roughness: 0.55, color: 0xd8cfc4, side: THREE.DoubleSide }));
    wall.rotation.x = Math.PI / 2; P.case.add(wall);
    const innerWall = new THREE.Mesh(new THREE.CylinderGeometry(DIAL_R + 0.005, DIAL_R + 0.005, THICK * 0.9, 120, 1, true), new THREE.MeshStandardMaterial({ map: sideTex, side: THREE.BackSide, roughness: 0.7, color: 0x8a6a50 }));
    innerWall.rotation.x = Math.PI / 2; P.case.add(innerWall);
    P.crown = new THREE.Group();
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.14, 24), steel);
    crown.rotation.z = Math.PI / 2; crown.position.x = 1.06; P.crown.add(crown);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 12), steel);
    stem.rotation.z = Math.PI / 2; stem.position.x = 0.98; P.crown.add(stem);
    W.add(P.case, P.crown);

    this.frontMat = photoMat(tex(DIALS[dial]));
    P.bezel = new THREE.Mesh(discGeo(1, DIAL_R), this.frontMat); P.bezel.position.z = THICK / 2 + 0.001;
    P.dial = new THREE.Mesh(discGeo(DIAL_R), this.frontMat); P.dial.position.z = THICK / 2 - 0.05;
    P.crystal = new THREE.Mesh(new THREE.CircleGeometry(DIAL_R + 0.01, 96), new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.16, clearcoat: 1, envMapIntensity: 1.6, depthWrite: false }));
    P.crystal.position.z = THICK / 2 - 0.01;
    P.movement = new THREE.Mesh(new THREE.CircleGeometry(0.78, 96), new THREE.MeshStandardMaterial({ map: movementTexture(), metalness: 0.55, roughness: 0.35 }));
    P.movement.position.z = -0.02;
    const backMap = tex('tex-back.webp');
    P.back = new THREE.Mesh(discGeo(1), photoMat(backMap));
    P.back.rotation.y = Math.PI; P.back.position.z = -THICK / 2 - 0.001;
    W.add(P.bezel, P.dial, P.crystal, P.movement, P.back);

    // lug wires + straps
    P.strapMat = new THREE.MeshStandardMaterial({ map: leatherTexture(strap), roughness: 0.8, side: THREE.DoubleSide });
    P.straps = [];
    for (const dir of [1, -1]) {
      const g = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.12, 12), steel);
      bar.rotation.z = Math.PI / 2; bar.position.set(0, dir * 1.03, -0.02); g.add(bar);
      for (const sx of [-0.56, 0.56]) {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.3, 10), steel);
        arm.position.set(sx, dir * 0.9, -0.02); g.add(arm);
      }
      const s = new THREE.Mesh(strapGeo(1.0, 3.0, 0.09, 1.7, dir), P.strapMat);
      s.position.set(0, dir * 1.06, -0.02); g.add(s);
      P.straps.push(g); W.add(g);
    }
  }

  setDial(d) { if (DIALS[d]) { this.frontMat.map = this.frontMat.emissiveMap = tex(DIALS[d]); this.frontMat.needsUpdate = true; } }
  setStrap(c) { this.parts.strapMat.map = leatherTexture(c); this.parts.strapMat.needsUpdate = true; }
  setMetal(m) { if (METALS[m]) this.metalMat.color.setHex(METALS[m]); }

  // p = 0 assembled ... 1 fully exploded
  explode(p) {
    this.explodeP = p;
    const P = this.parts, e = t => t * t * (3 - 2 * t);
    const k = e(Math.min(1, Math.max(0, p)));
    P.crystal.position.z = THICK / 2 - 0.01 + k * 2.6;
    P.bezel.position.z = THICK / 2 + 0.001 + k * 1.9;
    P.dial.position.z = THICK / 2 - 0.05 + k * 1.15;
    P.movement.position.z = -0.02 + k * 0.35;
    P.back.position.z = -THICK / 2 - 0.001 - k * 1.25;
    P.crown.position.x = k * 0.9;
    P.straps[0].position.set(0, k * 0.9, -k * 0.6);
    P.straps[1].position.set(0, -k * 0.9, -k * 0.6);
    P.crystal.material.opacity = 0.16 + k * 0.12;
  }

  resize() {
    const w = this.host.clientWidth || 1, h = this.host.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // keep the whole watch (with straps) framed whatever the aspect
    const need = 3.4 / this.scale;
    const fovV = THREE.MathUtils.degToRad(this.camera.fov);
    const distH = need / Math.tan(fovV / 2);
    const distW = (need * 0.62) / (Math.tan(fovV / 2) * this.camera.aspect);
    this.camera.position.z = Math.max(distH, distW);
    this.camera.updateProjectionMatrix();
    this.render();
  }

  render() { this.renderer.render(this.scene, this.camera); }

  loop() {
    if (this._raf) return;
    const tick = () => {
      this._raf = null;
      if (!this.visible) return;
      const t = (performance.now() - this.t0) / 1000;
      const idleYaw = this.idle ? Math.sin(t * 0.45) * 0.32 : 0;
      const idlePitch = this.idle ? Math.sin(t * 0.33) * 0.06 : 0;
      const ty = this.tYaw + idleYaw + this.pointer.x * 0.35, tp = this.tPitch + idlePitch + this.pointer.y * 0.22;
      this.yaw += (ty - this.yaw) * 0.08; this.pitch += (tp - this.pitch) * 0.08;
      this.root.rotation.set(this.pitch, this.yaw, this.roll);
      this.root.position.y = this.idle ? Math.sin(t * 0.8) * 0.04 : 0;
      this.render();
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  // one still frame, for reduced motion
  still() { this.idle = false; this.root.rotation.set(this.tPitch, this.tYaw, this.roll); this.render(); }
}
