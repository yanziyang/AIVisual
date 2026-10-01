import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const base = 'https://cdn.jsdelivr.net/npm/three@0.169.0/';
const files = {
  'build/three.module.min.js': 'three.module.js',
  'examples/jsm/controls/OrbitControls.js': 'controls/OrbitControls.js',
  'examples/jsm/loaders/GLTFLoader.js': 'loaders/GLTFLoader.js',
  'examples/jsm/utils/BufferGeometryUtils.js': 'utils/BufferGeometryUtils.js',
  'examples/jsm/environments/RoomEnvironment.js': 'environments/RoomEnvironment.js',
  'LICENSE': 'LICENSE'
};
await Promise.all(Object.entries(files).map(async ([source, target]) => {
  const response = await fetch(base + source);
  if (!response.ok) throw Error(`${source}: ${response.status}`);
  const destination = path.join(root, 'dist', 'vendor', target);
  await fs.mkdir(path.dirname(destination), {recursive:true});
  await fs.writeFile(destination, new Uint8Array(await response.arrayBuffer()));
  console.log(`Saved ${target}`);
}));
