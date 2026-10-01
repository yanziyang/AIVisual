// Bundles js/*.js + template.html + embedded fonts into dist/reel.html (single self-contained file)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const b64 = p => fs.readFileSync(path.join(root, p)).toString('base64');

const VERSION = process.env.REEL_VERSION || 'v1.0';
const FP = 'node_modules/@fontsource';
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const GREEK = 'U+0370-0377,U+037A-037F,U+0384-038A,U+038C,U+038E-03A1,U+03A3-03FF';
const fonts = [];
const add = (family, weight, style, range, file) => fonts.push({ family, weight, style, range, b64: b64(file) });
// Inter Tight (variable weight 100-900)
add('Inter Tight', '100 900', 'normal', LATIN, 'node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2');
add('Inter Tight', '100 900', 'normal', GREEK, 'node_modules/@fontsource-variable/inter-tight/files/inter-tight-greek-wght-normal.woff2');
// JetBrains Mono
for (const w of [400, 500, 700]) {
  add('JetBrains Mono', String(w), 'normal', LATIN, `${FP}/jetbrains-mono/files/jetbrains-mono-latin-${w}-normal.woff2`);
  add('JetBrains Mono', String(w), 'normal', GREEK, `${FP}/jetbrains-mono/files/jetbrains-mono-greek-${w}-normal.woff2`);
}
// STIX Two Text (maths)
for (const [w, st] of [[400, 'normal'], [400, 'italic'], [700, 'normal'], [700, 'italic']]) {
  add('STIX Two Text', String(w), st, LATIN, `${FP}/stix-two-text/files/stix-two-text-latin-${w}-${st}.woff2`);
  add('STIX Two Text', String(w), st, GREEK, `${FP}/stix-two-text/files/stix-two-text-greek-${w}-${st}.woff2`);
}

const order = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).sort();
let code = order.map(f => `/* ---- ${f} ---- */\n` + read('js/' + f)).join('\n\n');
code = `const FONT_DATA = ${JSON.stringify(fonts)};\nconst REEL_VERSION = ${JSON.stringify(VERSION)};\n` + code;

let html = read('template.html');
html = html.replace('/*__CODE__*/', () => code).replace(/__VERSION__/g, VERSION);
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'reel.html');
fs.writeFileSync(out, html);
console.log('built', out, (html.length / 1024).toFixed(0) + ' KB', 'from', order.length, 'modules');
