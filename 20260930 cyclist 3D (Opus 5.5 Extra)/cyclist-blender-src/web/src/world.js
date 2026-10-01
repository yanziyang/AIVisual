// Ride world: endless winding valley road streamed in chunks, sky dome with clouds,
// sun + hemisphere light, PMREM reflections from the sky, trees, posts and far ridges.
import * as THREE from 'three';
import { fbm, vnoise, hash2, mulberry32, clamp, lerp, smoothstep } from './noise.js';

const CHUNK = 64;            // metres of road per chunk
const AHEAD = 7, BEHIND = 2; // chunks kept around the rider
const ROAD_HALF = 3.3;       // two lanes
export const LANE = 1.55;    // rider's line, right of the centre line

// ---------------------------------------------------------------- road centre line (x = parameter)
export function roadZ(x) {
  return 22 * Math.sin(x / 150) + 9 * Math.sin(x / 61 + 1.3) + 2.2 * Math.sin(x / 27 + 0.4);
}
export function roadZd(x) {
  return 22 / 150 * Math.cos(x / 150) + 9 / 61 * Math.cos(x / 61 + 1.3) + 2.2 / 27 * Math.cos(x / 27 + 0.4);
}
export function roadZdd(x) {
  return -22 / 22500 * Math.sin(x / 150) - 9 / 3721 * Math.sin(x / 61 + 1.3) - 2.2 / 729 * Math.sin(x / 27 + 0.4);
}
export function roadY(x) {
  return 14 * Math.sin(x / 520 + 0.6) + 6 * Math.sin(x / 233 + 2.1) + 2.0 * Math.sin(x / 97 + 0.7);
}
export function roadYd(x) {
  return 14 / 520 * Math.cos(x / 520 + 0.6) + 6 / 233 * Math.cos(x / 233 + 2.1) + 2.0 / 97 * Math.cos(x / 97 + 0.7);
}

/** Frame on the rider's line at parameter x: position, unit forward/right/up, slope, curvature. */
export function laneFrame(x, lane = LANE, out = {}) {
  const zd = roadZd(x), yd = roadYd(x);
  const right = new THREE.Vector3(-zd, 0, 1).normalize();
  const pos = new THREE.Vector3(x, roadY(x), roadZ(x)).addScaledVector(right, lane);
  const fwd = new THREE.Vector3(1, yd, zd).normalize();
  out.pos = pos;
  out.fwd = fwd;
  out.right = right;
  out.slope = yd;
  out.curv = roadZdd(x) / Math.pow(1 + zd * zd, 1.5);       // signed (+ = bending right)
  out.ds = Math.sqrt(1 + zd * zd + yd * yd);                 // arc length per unit x
  return out;
}

export function terrainHeight(x, z) {
  const zc = roadZ(x);
  const d = Math.abs(z - zc);
  const base = roadY(x);
  const hills = (fbm(x * 0.0042 + 11.3, z * 0.0042 - 3.1, 5) - 0.32) * 120;
  const ridge = Math.pow(fbm(x * 0.0019 - 7.7, z * 0.0019 + 5.5, 3), 2) * 160;
  const rise = smoothstep(9, 160, d);
  const ditch = -0.55 * Math.exp(-Math.pow((d - 6.2) / 1.4, 2));
  const near = -0.08 + ditch + (d > 4 ? (d - 4) * 0.02 : 0);
  return base + near + rise * (Math.max(hills, -4) + ridge * smoothstep(60, 260, d) + d * 0.06);
}

// ---------------------------------------------------------------- canvas textures
function canvasTex(w, h, draw, repeat = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function speckle(g, w, h, base, n, spread, seed) {
  const r = mulberry32(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = (r() - 0.5) * spread;
    const l = 50 + v;
    g.fillStyle = `hsla(${30 + r() * 20},${6 + r() * 6}%,${l}%,${0.10 + r() * 0.18})`;
    const s = 0.6 + r() * 1.8;
    g.fillRect(r() * w, r() * h, s, s);
  }
}

function roadTexture() {
  return canvasTex(256, 1024, (g, w, h) => {
    speckle(g, w, h, '#4e4b48', 26000, 70, 3);
    // tyre-polished wheel tracks
    for (const cx of [0.27, 0.40, 0.60, 0.73]) {
      const grd = g.createLinearGradient(cx * w - 14, 0, cx * w + 14, 0);
      grd.addColorStop(0, 'rgba(30,30,32,0)');
      grd.addColorStop(0.5, 'rgba(30,30,32,0.20)');
      grd.addColorStop(1, 'rgba(30,30,32,0)');
      g.fillStyle = grd;
      g.fillRect(cx * w - 14, 0, 28, h);
    }
    // a few hairline cracks
    const r = mulberry32(9);
    g.strokeStyle = 'rgba(15,15,16,0.22)';
    g.lineWidth = 1.2;
    for (let i = 0; i < 10; i++) {
      g.beginPath();
      let x = r() * w, y = r() * h;
      g.moveTo(x, y);
      for (let k = 0; k < 8; k++) { x += (r() - 0.5) * 20; y += r() * 18; g.lineTo(x, y); }
      g.stroke();
    }
    // edge lines (solid) and centre dashes (3 m dash / 9 m gap over a 12 m tile)
    g.fillStyle = '#e9e7df';
    const lw = w * (0.12 / 6.6);
    g.fillRect(w * (0.25 / 6.6), 0, lw, h);
    g.fillRect(w - w * (0.25 / 6.6) - lw, 0, lw, h);
    g.fillRect(w / 2 - lw / 2, 0, lw, h * 0.25);
  });
}

function grassTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    const r = mulberry32(5);
    g.fillStyle = '#e8e8e2';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70000; i++) {
      const v = 150 + r() * 105;
      g.fillStyle = `rgba(${v},${Math.min(255, v + 12)},${v - 25},${0.25 + r() * 0.35})`;
      const x = r() * w, y = r() * h;
      g.fillRect(x, y, 1 + r() * 1.4, 2 + r() * 5);
    }
  });
}

function cloudsTexture() {
  // tileable fbm cloud density, sampled in the sky shader
  const N = 256;
  return canvasTex(N, N, (g) => {
    const img = g.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      let s = 0, a = 0.5, f = 4, n = 0;
      for (let o = 0; o < 5; o++) {
        // periodic value noise: wrap the lattice
        const P = f;
        const fx = x / N * P, fy = y / N * P;
        const xi = Math.floor(fx), yi = Math.floor(fy);
        const u = fx - xi, v = fy - yi;
        const h = (i, j) => hash2(((i % P) + P) % P + o * 101, ((j % P) + P) % P + o * 37);
        const uu = u * u * (3 - 2 * u), vv = v * v * (3 - 2 * v);
        const val = h(xi, yi) * (1 - uu) * (1 - vv) + h(xi + 1, yi) * uu * (1 - vv) + h(xi, yi + 1) * (1 - uu) * vv + h(xi + 1, yi + 1) * uu * vv;
        s += val * a; n += a; a *= 0.52; f *= 2;
      }
      const c = Math.round(255 * s / n);
      const i4 = (y * N + x) * 4;
      img.data[i4] = img.data[i4 + 1] = img.data[i4 + 2] = c;
      img.data[i4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
}

// ---------------------------------------------------------------- sky
const SKY_VS = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FS = /* glsl */`
uniform vec3 sunDir, zenith, horizon, ground, sunColor, cloudLit, cloudShade;
uniform float cloudCover, time, sunSize, haze;
uniform sampler2D clouds;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(horizon, zenith, pow(clamp(h, 0.0, 1.0), 0.42));
  col = mix(col, ground, smoothstep(0.0, -0.08, h));
  float mu = max(dot(d, sunDir), 0.0);
  col += sunColor * (pow(mu, 8.0) * 0.18 + pow(mu, 64.0) * 0.35) * (0.6 + haze);
  col += sunColor * smoothstep(1.0 - sunSize, 1.0 - sunSize * 0.6, mu) * 14.0;
  // horizon haze band
  col = mix(col, horizon * 1.04, exp(-abs(h) * 22.0) * 0.5);
  if (h > 0.0) {
    vec2 uv = d.xz / (h + 0.08) * 0.11 + vec2(time * 0.0016, time * 0.0009);
    float n = texture2D(clouds, uv).r * 0.65 + texture2D(clouds, uv * 2.7 + 0.31).r * 0.35;
    float c = smoothstep(1.0 - cloudCover, 1.0 - cloudCover + 0.32, n);
    c *= smoothstep(0.0, 0.18, h);
    vec3 cc = mix(cloudShade, cloudLit, clamp(0.35 + pow(mu, 3.0) * 0.8 + (n - 0.5), 0.0, 1.0));
    cc += sunColor * pow(mu, 12.0) * 0.6 * (1.0 - c);
    col = mix(col, cc, c * 0.92);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export const TIMES = {
  morning: {
    label: 'Morning', sunEl: 13, sunAz: 115, exposure: 0.95,
    zenith: '#5d86c4', horizon: '#c9d8e6', ground: '#6b7a6a', sun: '#ffe2c0', sunI: 2.6,
    hemiSky: '#bcd2ef', hemiGround: '#5f6b4c', hemiI: 0.55, fog: '#c3d2df', fogNear: 90, fogFar: 1500,
    cloud: 0.42, cloudLit: '#fff4e8', cloudShade: '#9aa7b8', haze: 0.6, env: 0.9,
  },
  midday: {
    label: 'Midday', sunEl: 58, sunAz: 200, exposure: 0.82,
    zenith: '#2f6fd0', horizon: '#b6cfe9', ground: '#6f7b62', sun: '#fff7ea', sunI: 3.4,
    hemiSky: '#a9c8f0', hemiGround: '#6a7350', hemiI: 0.6, fog: '#bcd1e6', fogNear: 160, fogFar: 2200,
    cloud: 0.38, cloudLit: '#ffffff', cloudShade: '#a8b4c4', haze: 0.3, env: 1.0,
  },
  golden: {
    label: 'Golden hour', sunEl: 9, sunAz: 235, exposure: 1.08,
    zenith: '#3565b8', horizon: '#ffbf7f', ground: '#7a6a52', sun: '#ffaa5c', sunI: 3.6,
    hemiSky: '#c2bdb8', hemiGround: '#6b5a3c', hemiI: 0.7, fog: '#f0cfa4', fogNear: 110, fogFar: 1500,
    cloud: 0.44, cloudLit: '#ffd9a8', cloudShade: '#8a7f98', haze: 1.0, env: 0.78,
  },
  overcast: {
    label: 'Overcast', sunEl: 40, sunAz: 160, exposure: 1.18,
    zenith: '#9aa4b0', horizon: '#d2d7dd', ground: '#737a6f', sun: '#f4f4f2', sunI: 1.1,
    hemiSky: '#dfe5ec', hemiGround: '#6f7566', hemiI: 1.45, fog: '#c9ced4', fogNear: 50, fogFar: 1000,
    cloud: 0.88, cloudLit: '#eef0f3', cloudShade: '#9aa1aa', haze: 0.2, env: 0.9,
  },
};

// ---------------------------------------------------------------- trees (built in JS, instanced)
function treeGeometries() {
  // spruce: trunk + seven drooping, jittered tiers
  const conifer = [];
  const trunk = new THREE.CylinderGeometry(0.10, 0.24, 3.0, 7);
  trunk.translate(0, 1.5, 0);
  colorize(trunk, '#4a3626');
  conifer.push(trunk);
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const r = 2.25 * (1 - t) + 0.45, h = 2.6 - t * 1.0, y = 1.3 + t * 6.6;
    const c = new THREE.ConeGeometry(r, h, 11, 3);
    const p = c.attributes.position;
    for (let k = 0; k < p.count; k++) {               // droop the tier edges
      const rr = Math.hypot(p.getX(k), p.getZ(k)) / r;
      p.setY(k, p.getY(k) - rr * rr * 0.35);
    }
    jitter(c, 0.22, 13 + i * 3.1);
    c.translate(0, y + h / 2 - 0.3, 0);
    colorize(c, '#22402a', '#3f6a3c');
    conifer.push(c);
  }
  // broadleaf: forked trunk + a lumpy canopy of overlapping blobs
  const broad = [];
  const t2 = new THREE.CylinderGeometry(0.13, 0.28, 3.4, 7);
  t2.translate(0, 1.7, 0);
  colorize(t2, '#54402e');
  broad.push(t2);
  for (const [ax, az] of [[0.5, 0.2], [-0.4, -0.3]]) {
    const b = new THREE.CylinderGeometry(0.06, 0.12, 2.0, 5);
    b.translate(0, 1.0, 0);
    b.rotateZ(ax); b.rotateX(az);
    b.translate(0, 3.0, 0);
    colorize(b, '#54402e');
    broad.push(b);
  }
  const blobs = [[0, 5.0, 0, 2.1], [1.4, 4.4, 0.7, 1.5], [-1.3, 4.6, -0.6, 1.6], [0.3, 6.3, -0.4, 1.4],
    [-0.6, 5.5, 1.2, 1.3], [0.9, 5.7, -1.1, 1.3], [-0.2, 3.9, -1.2, 1.2]];
  blobs.forEach(([x, y, z, r], i) => {
    const s = new THREE.IcosahedronGeometry(r, 3);
    jitter(s, 0.32, x * 7 + y + i);
    s.translate(x, y, z);
    colorize(s, i % 2 ? '#3d6a2c' : '#4a7432', i % 3 ? '#7fa04a' : '#6c9140');
    broad.push(s);
  });
  return [merge(conifer), merge(broad)];
}

function jitter(geo, amt, seed) {
  const p = geo.attributes.position;
  const r = mulberry32(Math.floor(seed * 1000) + 1);
  const map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
    if (!map.has(k)) map.set(k, [(r() - 0.5) * amt, (r() - 0.5) * amt, (r() - 0.5) * amt]);
    const o = map.get(k);
    p.setXYZ(i, p.getX(i) + o[0], p.getY(i) + o[1], p.getZ(i) + o[2]);
  }
  geo.computeVertexNormals();
}

function colorize(geo, a, b = a) {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  let ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < p.count; i++) { ymin = Math.min(ymin, p.getY(i)); ymax = Math.max(ymax, p.getY(i)); }
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) - ymin) / Math.max(1e-6, ymax - ymin);
    c.copy(ca).lerp(cb, t * 0.8 + 0.2 * hash2(i, 3));
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

function merge(list) {
  let n = 0;
  for (const g of list) n += (g.index ? g.index.count : g.attributes.position.count);
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
  let o = 0;
  for (let g of list) {
    if (g.index) g = g.toNonIndexed();
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeBoundingSphere();
  return geo;
}

// ---------------------------------------------------------------- world
export class RideWorld {
  constructor(renderer, quality = 'med') {
    this.renderer = renderer;
    this.quality = quality;
    this.group = new THREE.Group();
    this.group.name = 'RideWorld';
    this.chunks = new Map();
    this.origin = 0;                       // floating origin (x offset subtracted from everything)
    this.time = 0;
    this.pmrem = new THREE.PMREMGenerator(renderer);

    this.roadMat = new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.92, metalness: 0.0, envMapIntensity: 0.55 });
    this.roadMat.map.repeat.set(1, 1);
    const grass = grassTexture();
    this.terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: grass, roughness: 0.97 });
    this.treeMats = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88 })];
    this.treeGeos = treeGeometries();
    this.postGeo = (() => {
      const g = new THREE.BoxGeometry(0.11, 1.0, 0.11);
      g.translate(0, 0.5, 0);
      colorize(g, '#f2f2ee');
      const band = new THREE.BoxGeometry(0.115, 0.18, 0.115);
      band.translate(0, 0.78, 0);
      colorize(band, '#202020');
      return merge([g, band]);
    })();
    this.postMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });

    // sky dome
    this.cloudTex = cloudsTexture();
    this.cloudTex.colorSpace = THREE.NoColorSpace;
    this.skyMat = new THREE.ShaderMaterial({
      vertexShader: SKY_VS, fragmentShader: SKY_FS, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        sunDir: { value: new THREE.Vector3(0, 1, 0) }, zenith: { value: new THREE.Color() },
        horizon: { value: new THREE.Color() }, ground: { value: new THREE.Color() },
        sunColor: { value: new THREE.Color() }, cloudLit: { value: new THREE.Color() },
        cloudShade: { value: new THREE.Color() }, cloudCover: { value: 0.4 }, time: { value: 0 },
        sunSize: { value: 0.00012 }, haze: { value: 0.5 }, clouds: { value: this.cloudTex },
      },
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.group.add(this.sky);

    // lights
    this.sun = new THREE.DirectionalLight(0xffffff, 3);
    this.sun.castShadow = true;
    const sm = quality === 'high' ? 2048 : quality === 'low' ? 1024 : 2048;
    this.sun.shadow.mapSize.set(sm, sm);
    const sc = this.sun.shadow.camera;
    sc.left = -4.5; sc.right = 4.5; sc.top = 4.5; sc.bottom = -4.5; sc.near = 1; sc.far = 80;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.group.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445533, 0.6);
    this.group.add(this.hemi);

    this.ridges = this.makeRidges();
    this.group.add(this.ridges);
  }

  makeRidges() {
    // a ring of far mountains around the camera, faded by fog
    const seg = 160, rows = 3;
    const pos = [], col = [], idx = [];
    for (let r = 0; r < rows; r++) {
      const R = 1500 + r * 700;
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const n = fbm(Math.cos(a) * 3 + r * 10, Math.sin(a) * 3 + r * 4, 5);
        const h = 60 + Math.pow(n, 1.6) * (260 + r * 180);
        pos.push(Math.cos(a) * R, -30, Math.sin(a) * R, Math.cos(a) * R, h, Math.sin(a) * R);
        const c = new THREE.Color(r === 0 ? '#5d6f62' : r === 1 ? '#6f7f86' : '#8996a3');
        col.push(c.r, c.g, c.b, c.r * 1.08, c.g * 1.08, c.b * 1.1);
      }
    }
    for (let r = 0; r < rows; r++) {
      const o = r * (seg + 1) * 2;
      for (let i = 0; i < seg; i++) {
        const a = o + i * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    m.frustumCulled = false;
    m.renderOrder = -5;
    return m;
  }

  setTime(key, scene) {
    const T = TIMES[key];
    this.timeKey = key;
    const el = THREE.MathUtils.degToRad(T.sunEl), az = THREE.MathUtils.degToRad(T.sunAz);
    this.sunDir = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
    const u = this.skyMat.uniforms;
    u.sunDir.value.copy(this.sunDir);
    u.zenith.value.set(T.zenith);
    u.horizon.value.set(T.horizon);
    u.ground.value.set(T.ground);
    u.sunColor.value.set(T.sun);
    u.cloudLit.value.set(T.cloudLit);
    u.cloudShade.value.set(T.cloudShade);
    u.cloudCover.value = T.cloud;
    u.haze.value = T.haze;
    this.sun.color.set(T.sun);
    this.sun.intensity = T.sunI;
    this.hemi.color.set(T.hemiSky);
    this.hemi.groundColor.set(T.hemiGround);
    this.hemi.intensity = T.hemiI;
    scene.fog = new THREE.Fog(T.fog, T.fogNear, T.fogFar);
    this.renderer.toneMappingExposure = T.exposure;
    this.envIntensity = T.env;
    // reflections: render the sky (without clouds moving) into a PMREM
    const envScene = new THREE.Scene();
    const skyCopy = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), this.skyMat);
    envScene.add(skyCopy);
    const groundDisk = new THREE.Mesh(new THREE.CircleGeometry(90, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(T.hemiGround).multiplyScalar(0.8) }));
    groundDisk.position.y = -2;
    envScene.add(groundDisk);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(envScene, 0.02);
    scene.environment = this.envRT.texture;
    scene.environmentIntensity = T.env;
  }

  // ------------------------------------------------------------ chunks
  buildChunk(ci) {
    const x0 = ci * CHUNK;
    const g = new THREE.Group();
    g.name = 'chunk' + ci;
    // --- terrain: rows follow the road, columns spread out non-uniformly
    const offs = [];
    const far = this.quality === 'low' ? 420 : 620;
    let o = 0;
    const list = [0];
    while (o < far) {
      o += o < 8 ? 1.6 : o < 30 ? 3 : o < 90 ? 7 : o < 200 ? 16 : 34;
      list.push(o);
    }
    for (let i = list.length - 1; i > 0; i--) offs.push(-list[i]);
    for (const v of list) offs.push(v);
    const rows = CHUNK / 2 + 1;
    const cols = offs.length;
    const pos = new Float32Array(rows * cols * 3), col = new Float32Array(rows * cols * 3), uv = new Float32Array(rows * cols * 2);
    const c = new THREE.Color(), c2 = new THREE.Color();
    const grassA = new THREE.Color('#4f7a2e'), grassB = new THREE.Color('#86a046'), dry = new THREE.Color('#b0a565'),
      gravel = new THREE.Color('#9a907c'), rock = new THREE.Color('#8f897c'), meadow = new THREE.Color('#9db35a');
    for (let r = 0; r < rows; r++) {
      const x = x0 + r * 2;
      const zc = roadZ(x);
      for (let k = 0; k < cols; k++) {
        const z = zc + offs[k];
        const y = terrainHeight(x, z);
        const i = r * cols + k;
        pos[i * 3] = x - this.origin; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
        uv[i * 2] = x / 6; uv[i * 2 + 1] = z / 6;
        const d = Math.abs(offs[k]);
        const n = fbm(x * 0.03, z * 0.03, 3);
        c.copy(grassA).lerp(grassB, n);
        c.lerp(meadow, smoothstep(0.5, 0.75, fbm(x * 0.015 - 9, z * 0.015 + 2, 3)) * 0.5);
        c.lerp(dry, smoothstep(0.55, 0.8, fbm(x * 0.006 + 3, z * 0.006, 3)) * 0.6);
        const hgt = y - roadY(x);
        c.lerp(rock, smoothstep(40, 110, hgt) * 0.55);
        c2.copy(gravel);
        c.lerp(c2, 1 - smoothstep(3.5, 5.0, d));
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
      }
    }
    const idx = [];
    for (let r = 0; r < rows - 1; r++) for (let k = 0; k < cols - 1; k++) {
      const a = r * cols + k, b = a + 1, cc = a + cols, d = cc + 1;
      idx.push(a, b, cc, b, d, cc);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    tg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    tg.setIndex(idx);
    tg.computeVertexNormals();
    const terrain = new THREE.Mesh(tg, this.terrainMat);
    terrain.receiveShadow = true;
    g.add(terrain);
    // --- road ribbon
    const segs = CHUNK / 2;
    const rp = new Float32Array((segs + 1) * 2 * 3), ruv = new Float32Array((segs + 1) * 2 * 2), ri = [];
    for (let s = 0; s <= segs; s++) {
      const x = x0 + s * 2;
      const zd = roadZd(x);
      const rn = new THREE.Vector3(-zd, 0, 1).normalize();
      const y = roadY(x);
      for (let e = 0; e < 2; e++) {
        const side = e === 0 ? -1 : 1;
        const p = new THREE.Vector3(x - this.origin, y + 0.02 - Math.abs(side) * 0.03, roadZ(x)).addScaledVector(rn, side * ROAD_HALF);
        rp.set([p.x, p.y, p.z], (s * 2 + e) * 3);
        ruv.set([e, x / 12], (s * 2 + e) * 2);
      }
      if (s < segs) {
        const a = s * 2;
        ri.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    rg.setAttribute('uv', new THREE.BufferAttribute(ruv, 2));
    rg.setIndex(ri);
    rg.computeVertexNormals();
    const road = new THREE.Mesh(rg, this.roadMat);
    road.receiveShadow = true;
    g.add(road);
    // --- trees
    const rnd = mulberry32(ci * 7919 + 13);
    const nTrees = this.quality === 'low' ? 40 : this.quality === 'high' ? 140 : 90;
    const mats = [[], []];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < nTrees * 3 && mats[0].length + mats[1].length < nTrees; i++) {
      const x = x0 + rnd() * CHUNK;
      const side = rnd() < 0.5 ? -1 : 1;
      const dist = 11 + Math.pow(rnd(), 1.6) * 260;
      const z = roadZ(x) + side * dist;
      const forest = fbm(x * 0.012 + 4, z * 0.012 - 9, 3);
      if (forest < 0.45 && rnd() > 0.15) continue;
      const y = terrainHeight(x, z);
      if (y - roadY(x) > 120) continue;
      const type = (fbm(x * 0.01, z * 0.01 + 50, 2) + rnd() * 0.3) > 0.62 ? 1 : 0;
      const s = 0.7 + rnd() * 0.9;
      p.set(x - this.origin, y - 0.2, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
      sc.set(s * (0.85 + rnd() * 0.3), s * (0.9 + rnd() * 0.35), s * (0.85 + rnd() * 0.3));
      m.compose(p, q, sc);
      mats[type].push(m.clone());
    }
    for (let t = 0; t < 2; t++) {
      if (!mats[t].length) continue;
      const im = new THREE.InstancedMesh(this.treeGeos[t], this.treeMats[t], mats[t].length);
      const tint = new THREE.Color();
      mats[t].forEach((mm, i) => {
        im.setMatrixAt(i, mm);
        const v = 0.82 + rnd() * 0.3;
        tint.setRGB(v * (0.95 + rnd() * 0.1), v, v * (0.9 + rnd() * 0.12));
        im.setColorAt(i, tint);
      });
      im.castShadow = true;
      im.computeBoundingSphere();
      g.add(im);
    }
    // --- delineator posts every 25 m on both sides
    const posts = [];
    for (let k = 0; k < CHUNK / 25 + 1; k++) {
      const x = Math.ceil(x0 / 25) * 25 + k * 25;
      if (x >= x0 + CHUNK) break;
      const zd = roadZd(x);
      const rn = new THREE.Vector3(-zd, 0, 1).normalize();
      for (const side of [-1, 1]) {
        const pp = new THREE.Vector3(x, 0, roadZ(x)).addScaledVector(rn, side * (ROAD_HALF + 1.1));
        pp.y = terrainHeight(pp.x, pp.z) - 0.05;
        pp.x -= this.origin;
        m.compose(pp, q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan(zd)), sc.set(1, 1, 1));
        posts.push(m.clone());
      }
    }
    if (posts.length) {
      const im = new THREE.InstancedMesh(this.postGeo, this.postMat, posts.length);
      posts.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.castShadow = true;
      g.add(im);
    }
    g.userData.ci = ci;
    return g;
  }

  /** Stream chunks around absolute x; returns true if the origin moved (caller shifts objects). */
  update(xAbs, dt, camera) {
    this.time += dt;
    this.skyMat.uniforms.time.value = this.time;
    let shifted = 0;
    if (xAbs - this.origin > 1024) {
      shifted = 1024;
      this.origin += 1024;
      for (const ch of this.chunks.values()) ch.position.x -= 1024;
    }
    const ci = Math.floor(xAbs / CHUNK);
    for (let k = ci - BEHIND; k <= ci + AHEAD; k++) {
      if (!this.chunks.has(k)) {
        const ch = this.buildChunk(k);
        // chunk geometry was built with the origin at build time; keep it aligned
        ch.userData.origin = this.origin;
        this.chunks.set(k, ch);
        this.group.add(ch);
        break;      // at most one new chunk per frame
      }
    }
    for (const [k, ch] of this.chunks) {
      if (k < ci - BEHIND || k > ci + AHEAD + 1) {
        this.group.remove(ch);
        ch.traverse((o) => { if (o.geometry && o.geometry !== this.treeGeos[0] && o.geometry !== this.treeGeos[1] && o.geometry !== this.postGeo) o.geometry.dispose(); });
        this.chunks.delete(k);
      }
    }
    if (camera) {
      this.sky.position.copy(camera.position);
      this.ridges.position.set(camera.position.x, 0, camera.position.z);
    }
    return shifted;
  }

  prime(xAbs) {
    const ci = Math.floor(xAbs / CHUNK);
    for (let k = ci - BEHIND; k <= ci + AHEAD; k++) {
      if (!this.chunks.has(k)) {
        const ch = this.buildChunk(k);
        this.chunks.set(k, ch);
        this.group.add(ch);
      }
    }
  }

  placeSun(target) {
    this.sun.position.copy(target).addScaledVector(this.sunDir, 40);
    this.sun.target.position.copy(target);
    this.sun.target.updateMatrixWorld();
  }
}
