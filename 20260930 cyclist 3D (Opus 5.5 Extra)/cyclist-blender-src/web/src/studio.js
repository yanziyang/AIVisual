// Studio: a light cyclorama with a slowly turning platform, three-point light, room reflections.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const BG_VS = /* glsl */`
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 0.0)).xyz);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const BG_FS = /* glsl */`
uniform vec3 top, mid, low;
varying vec3 vDir;
void main() {
  float h = normalize(vDir).y;
  vec3 c = mix(mid, top, smoothstep(0.0, 0.8, h));
  c = mix(c, low, smoothstep(0.02, -0.3, h));
  gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

const FLOOR_FS = /* glsl */`
uniform vec3 floorCol, edgeCol;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  vec3 c = mix(floorCol, edgeCol, smoothstep(0.05, 0.95, r));
  gl_FragColor = vec4(c, 1.0);
}`;

export class Studio {
  constructor(renderer) {
    this.group = new THREE.Group();
    this.group.name = 'Studio';
    const pm = new THREE.PMREMGenerator(renderer);
    this.env = pm.fromScene(new RoomEnvironment(), 0.03).texture;
    this.bgMat = new THREE.ShaderMaterial({
      vertexShader: BG_VS, fragmentShader: BG_FS, side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#c9ced6') }, mid: { value: new THREE.Color('#eef0f3') }, low: { value: new THREE.Color('#e4e6ea') } },
    });
    const bg = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 16), this.bgMat);
    bg.frustumCulled = false;
    bg.renderOrder = -10;
    this.group.add(bg);
    this.bg = bg;
    // floor: lit matte plane that fades into the backdrop colour
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 96).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#e6e8ec', roughness: 0.95 }));
    floor.receiveShadow = true;
    this.group.add(floor);
    // turntable platform
    this.table = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.47, 0.04, 96),
      new THREE.MeshPhysicalMaterial({ color: '#2a2d33', roughness: 0.35, metalness: 0.2, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
    plate.position.y = 0.02;
    plate.receiveShadow = true;
    plate.castShadow = true;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.46, 0.006, 8, 160).rotateX(Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: '#e8552d', emissive: '#e8552d', emissiveIntensity: 0.6, roughness: 0.4 }));
    rim.position.y = 0.041;
    // rollers under the wheels (the rider pedals on a roller trainer)
    const rollerMat = new THREE.MeshStandardMaterial({ color: '#9aa1aa', metalness: 1, roughness: 0.25 });
    this.rollers = [];
    // the rear wheel sits between two drums, the front on one (heights put both axles level)
    for (const [x, y] of [[-0.402 - 0.11, 0.095], [-0.402 + 0.11, 0.095], [0.584, 0.079]]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.42, 32).rotateX(Math.PI / 2), rollerMat);
      r.position.set(x, y, 0);
      r.castShadow = true;
      this.rollers.push(r);
    }
    const frameMat = new THREE.MeshStandardMaterial({ color: '#30343b', roughness: 0.5, metalness: 0.4 });
    for (const z of [-0.23, 0.23]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.03, 0.04), frameMat);
      rail.position.set(0.0, 0.055, z);
      rail.castShadow = true;
      this.table.add(rail);
    }
    this.table.add(plate, rim, ...this.rollers);
    this.group.add(this.table);
    // lights
    this.key = new THREE.DirectionalLight('#fff6ec', 2.6);
    this.key.position.set(2.5, 4.5, 3.2);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    const sc = this.key.shadow.camera;
    sc.left = -2.2; sc.right = 2.2; sc.top = 2.4; sc.bottom = -1.2; sc.near = 0.5; sc.far = 14;
    this.key.shadow.bias = -0.0003;
    this.key.shadow.normalBias = 0.015;
    this.key.shadow.radius = 4;
    const fill = new THREE.DirectionalLight('#dfe8ff', 0.7);
    fill.position.set(-3, 2, -2.5);
    const rimL = new THREE.DirectionalLight('#ffffff', 1.4);
    rimL.position.set(-2.5, 3, 3.5);
    this.group.add(this.key, this.key.target, fill, rimL);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#c9c4bb', 0.35);
    this.group.add(this.hemi);
    this.spin = 0;
  }

  apply(scene, renderer) {
    scene.environment = this.env;
    scene.environmentIntensity = 0.8;
    scene.fog = new THREE.Fog('#e6e8ec', 12, 38);
    renderer.toneMappingExposure = 1.0;
  }

  update(dt, speed, turn = true) {
    if (turn) this.spin += dt * 0.12;
    this.table.rotation.y = this.spin;
    for (const r of this.rollers) r.rotation.z -= speed * dt / 0.055;
  }
}
