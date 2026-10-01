// Compress the Blender export for embedding: dedup, prune (keeping the chain-path empty),
// resample the baked loops, then meshopt (reorder + quantize + EXT_meshopt_compression).
//   node tools/optimize.mjs [in.glb] [out.glb]
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, meshopt, weld } from '@gltf-transform/functions';
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer';
import fs from 'node:fs';

const src = process.argv[2] || 'out/cyclist.glb';
const dst = process.argv[3] || 'out/cyclist.opt.glb';
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(src);
const root = doc.getRoot();
const before = fs.statSync(src).size;
await doc.transform(
  dedup(),
  prune({ keepLeaves: true, keepExtras: true, keepAttributes: true }),
  resample({ tolerance: 2e-5 }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await io.write(dst, doc);
const after = fs.statSync(dst).size;
console.log(`${src} ${(before / 1024).toFixed(0)} KB -> ${dst} ${(after / 1024).toFixed(0)} KB`);
console.log('nodes', root.listNodes().length, 'meshes', root.listMeshes().length,
  'materials', root.listMaterials().length, 'animations', root.listAnimations().map(a => a.getName()).join(','));
