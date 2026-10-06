// Renderer, studio environment, lights, floor and post-processing.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export const BG = 0x090d12;

// A small HDR "photo studio" used only to light the metal: soft boxes and strip lights.
function makeStudio(renderer) {
  const sc = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(30, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} ',
      fragmentShader: `varying vec3 vP; void main(){
        float h = normalize(vP).y;
        vec3 top = vec3(0.34,0.38,0.45), mid = vec3(0.13,0.15,0.18), bot = vec3(0.035,0.04,0.045);
        vec3 c = mix(mid, top, smoothstep(0.0, 0.9, h));
        c = mix(c, bot, smoothstep(0.0, -0.5, h));
        gl_FragColor = vec4(c, 1.0);}`,
    }),
  );
  sc.add(dome);
  const panel = (w, h, pos, intensity, col = 0xffffff) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); sc.add(m); return m;
  };
  panel(16, 2.6, [0, 11, 6], 6.0);              // long overhead strip (runs along the engine)
  panel(16, 1.6, [0, 10, -6], 5.0, 0xcfe0ff);   // cool back strip
  panel(14, 5.5, [-9, 5, 11], 3.6, 0xfff1e0);   // warm key softbox
  panel(10, 3.5, [11, 4, 8], 2.2, 0xdbe8ff);    // cool fill
  panel(20, 1.2, [0, 1, 13], 3.4);              // low front strip, gives long highlights on casings
  panel(20, 0.9, [0, -3.5, 10], 1.1, 0xffd6b0); // warm bounce from the floor side
  panel(6, 6, [-12, 1, -3], 1.8, 0xb8d4ff);
  const pm = new THREE.PMREMGenerator(renderer);
  const tex = pm.fromScene(sc, 0.025).texture;
  pm.dispose();
  return tex;
}

function radialTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.45, '#bbb'); gr.addColorStop(0.8, '#222'); gr.addColorStop(1, '#000');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.debug.checkShaderErrors = new URLSearchParams(location.search).has('debug');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  scene.environment = makeStudio(renderer);
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 80);

  // key light with shadows: comes from front-left-above so it pours through the cutaway opening
  const key = new THREE.DirectionalLight(0xfff3e4, 1.9);
  const centre = new THREE.Vector3(3.2, 0, 0);
  key.position.copy(centre).add(new THREE.Vector3(-4.5, 7.5, 9.5));
  key.target.position.copy(centre);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera; sc.left = -4.4; sc.right = 4.4; sc.top = 3.4; sc.bottom = -3.4; sc.near = 4; sc.far = 24;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.006; key.shadow.radius = 2.2;
  scene.add(key, key.target);
  // cool rim from behind-right
  const rim = new THREE.DirectionalLight(0x9cc4ff, 1.1);
  rim.position.set(9, 4, -9); scene.add(rim);
  // soft fill from the front-right
  const fill = new THREE.DirectionalLight(0xdfe9ff, 0.35);
  fill.position.set(8, 1, 10); scene.add(fill);

  const hemi = new THREE.HemisphereLight(0xdde7ff, 0x1a1e25, 0.45);
  scene.add(hemi);

  // warm glow inside the combustor (intensity driven by throttle)
  const flameLight = new THREE.PointLight(0xff8a3a, 0, 1.25, 2);
  scene.add(flameLight);

  // floor: faint disc that fades out, receives the engine's shadow
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(16, 64),
    new THREE.MeshStandardMaterial({ color: 0x0f141a, roughness: 0.6, metalness: 0.15, transparent: true, alphaMap: radialTexture(), envMapIntensity: 0.25 }),
  );
  floor.rotation.x = -Math.PI / 2; floor.position.set(3.2, -1.95, 0); floor.receiveShadow = true;
  scene.add(floor);

  // post
  const size = new THREE.Vector2(); renderer.getSize(size);
  const rt = new THREE.WebGLRenderTarget(2, 2, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  const renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(2, 2), 0.24, 0.5, 1.6);
  const out = new OutputPass();
  composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(out);

  const stage = { renderer, scene, camera, key, rim, fill, flameLight, floor, composer, bloom, renderPass, quality: 2, bloomOn: true };
  stage.resize = (w, h, pr) => {
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(pr);
    composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  // keep the engine centred in the free area between the top bar and the dock
  stage.setFree = (free, W, H) => {
    const sx = free.x + free.w / 2 - W / 2, sy = free.y + free.h / 2 - H / 2;
    camera.setViewOffset(W, H, -sx, -sy, W, H);
  };
  stage.render = () => { if (stage.bloomOn) composer.render(); else renderer.render(scene, camera); };
  return stage;
}
