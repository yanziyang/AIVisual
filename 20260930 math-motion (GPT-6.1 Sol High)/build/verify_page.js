const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'form-follows-formula.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 1) throw new Error('Expected one inline playback script');
new Function(scripts[0][1]);
for (const id of ['reel', 'prompt', 'implementation', 'source', 'embedded-video']) {
  if (!html.includes(`id="${id}"`)) throw new Error(`Missing ${id}`);
}
if (/(?:src|href)="https?:\/\//.test(html)) throw new Error('External asset reference');
console.log('PASS: inline JavaScript syntax, embedded video, prompt, implementation, source, and no external assets.');
