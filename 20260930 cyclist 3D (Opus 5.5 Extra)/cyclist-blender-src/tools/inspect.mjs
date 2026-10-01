import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(process.argv[2]);
const r = doc.getRoot();
console.log('skins', r.listSkins().map(s => s.getName() + ':' + s.listJoints().length));
for (const n of r.listNodes()) {
  const m = n.getMesh(), s = n.getSkin();
  if (m || s || Object.keys(n.getExtras()).length) console.log(n.getName(), m ? 'mesh:' + m.listPrimitives().length : '', s ? 'SKIN' : '', JSON.stringify(n.getExtras()).slice(0, 80));
}
for (const a of r.listAnimations()) console.log('anim', a.getName(), a.listChannels().length, 'channels', a.listSamplers()[0].getInput().getCount(), 'keys(first)');
