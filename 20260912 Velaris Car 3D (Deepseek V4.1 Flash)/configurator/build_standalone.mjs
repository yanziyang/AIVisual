import { readFile, writeFile } from "node:fs/promises";
import { dirname, extname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";

const sourceDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(sourceDir, "..");
const outputPath = join(projectRoot, "velaris-configurator.html");
const entryModule = "js/app.js";
const threeModule = "assets/vendor/three.module.js";
const importPattern = /^\s*import\b[\s\S]*?\bfrom\s*(["'])([^"']+)\1\s*;?/gm;
const moduleSources = new Map();
const visiting = new Set();
const visited = new Set();
const moduleOrder = [];

function resolveImport(fromPath, specifier) {
  if (specifier === "three") return threeModule;
  if (!specifier.startsWith(".")) {
    throw new Error(`Unsupported external import ${JSON.stringify(specifier)} in ${fromPath}`);
  }
  const target = posix.normalize(posix.join(posix.dirname(fromPath), specifier));
  if (target.startsWith("../") || target === "..") {
    throw new Error(`Import leaves the configurator folder: ${fromPath} -> ${specifier}`);
  }
  return target;
}

async function collectModule(modulePath) {
  if (visited.has(modulePath)) return;
  if (visiting.has(modulePath)) throw new Error(`Circular module import found at ${modulePath}`);
  visiting.add(modulePath);
  const source = await readFile(join(sourceDir, ...modulePath.split("/")), "utf8");
  moduleSources.set(modulePath, source);
  for (const match of source.matchAll(importPattern)) {
    await collectModule(resolveImport(modulePath, match[2]));
  }
  visiting.delete(modulePath);
  visited.add(modulePath);
  moduleOrder.push(modulePath);
}

function gzipBase64(input) {
  return gzipSync(input, { level: 9 }).toString("base64");
}

function escapeScriptJson(text) {
  return text.replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

await collectModule(entryModule);

const placeholderUrls = new Map();
const runtimeImportPattern = /^(\s*import\b[\s\S]*?\bfrom\s*)(["'])([^"']+)\2\s*;?/gm;
for (const modulePath of moduleOrder) {
  const source = moduleSources.get(modulePath);
  if (/\bimport\s*\(/.test(source)) throw new Error(`Dynamic imports are not supported in the standalone bundle: ${modulePath}`);
  let rewrittenCount = 0;
  source.replace(runtimeImportPattern, (statement, prefix, quote, specifier) => {
    const dependency = resolveImport(modulePath, specifier);
    if (!placeholderUrls.has(dependency)) throw new Error(`Import order is invalid: ${modulePath} needs ${dependency} first.`);
    rewrittenCount += 1;
    return prefix + JSON.stringify(placeholderUrls.get(dependency));
  });
  const declaredCount = Array.from(source.matchAll(importPattern)).length;
  if (rewrittenCount !== declaredCount) throw new Error(`Not all imports can be embedded in ${modulePath}.`);
  placeholderUrls.set(modulePath, `blob:standalone-build-check/${placeholderUrls.size}`);
}

let html = await readFile(join(sourceDir, "index.html"), "utf8");
const css = await readFile(join(sourceDir, "css", "style.css"), "utf8");
const icon = (await readFile(join(sourceDir, "assets", "images", "favicon.svg"))).toString("base64");
const glb = await readFile(join(sourceDir, "assets", "models", "velaris_supercar.glb"));
if (glb.toString("ascii", 0, 4) !== "glTF") throw new Error("The embedded car model is not a GLB file.");

const modulePayload = Buffer.from(JSON.stringify({
  order: moduleOrder,
  sources: Object.fromEntries(moduleSources),
}), "utf8");
const moduleBase64 = gzipBase64(modulePayload);
const modelBase64 = gzipBase64(glb);
if (!gunzipSync(Buffer.from(moduleBase64, "base64")).equals(modulePayload)) throw new Error("Embedded module archive failed its round-trip check.");
if (!gunzipSync(Buffer.from(modelBase64, "base64")).equals(glb)) throw new Error("Embedded model archive failed its round-trip check.");

const runtime = String.raw`<script>
(async function () {
  "use strict";
  const status = window.__aiVisualSetRenderingStatus;
  function decodeBase64(id) {
    const node = document.getElementById(id);
    if (!node) throw new Error("Embedded data block is missing: " + id);
    const binary = atob(node.textContent.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  async function gunzip(id) {
    if (typeof DecompressionStream !== "function") {
      throw new Error("This browser does not support the compressed standalone assets. Open the page in a current version of Chrome.");
    }
    const compressed = new Blob([decodeBase64(id)]);
    const stream = compressed.stream().pipeThrough(new DecompressionStream("gzip"));
    return new Response(stream).arrayBuffer();
  }
  function resolveImport(fromPath, specifier) {
    if (specifier === "three") return "assets/vendor/three.module.js";
    const pieces = (fromPath.slice(0, fromPath.lastIndexOf("/") + 1) + specifier).split("/");
    const resolved = [];
    for (const piece of pieces) {
      if (!piece || piece === ".") continue;
      if (piece === "..") resolved.pop();
      else resolved.push(piece);
    }
    return resolved.join("/");
  }
  try {
    const [moduleBuffer, modelBuffer] = await Promise.all([
      gunzip("velaris-module-data"),
      gunzip("velaris-model-data"),
    ]);
    const payload = JSON.parse(new TextDecoder().decode(moduleBuffer));
    window.__VELARIS_MODEL_BUFFER__ = modelBuffer;
    const urls = new Map();
    const importPattern = /^(\s*import\b[\s\S]*?\bfrom\s*)(["'])([^"']+)\2\s*;?/gm;
    for (const modulePath of payload.order) {
      const source = payload.sources[modulePath].replace(importPattern, (statement, prefix, quote, specifier) => {
        const dependency = resolveImport(modulePath, specifier);
        const dependencyUrl = urls.get(dependency);
        if (!dependencyUrl) throw new Error("Could not resolve " + specifier + " imported by " + modulePath);
        return prefix + JSON.stringify(dependencyUrl);
      });
      urls.set(modulePath, URL.createObjectURL(new Blob([source], { type: "text/javascript" })));
    }
    await import(urls.get("js/app.js"));
    for (const url of urls.values()) URL.revokeObjectURL(url);
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    if (typeof status === "function") {
      status("unavailable", "3D startup failed · standalone assets could not load", message);
    } else {
      const badge = document.getElementById("aiVisualRenderingStatus");
      if (badge) { badge.textContent = "3D startup failed"; badge.title = message; }
    }
    console.error("Velaris standalone startup failed:", error);
  }
})();
</script>`;

html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/i, "");
html = html.replace(
  /<link rel="icon" href="assets\/images\/favicon\.svg" type="image\/svg\+xml">/i,
  `<link rel="icon" href="data:image/svg+xml;base64,${icon}" type="image/svg+xml">`,
);
html = html.replace(/<link rel="stylesheet" href="css\/style\.css">/i, `<style>\n${css}\n</style>`);
html = html.replace(
  /  if \(window\.location\.protocol === "file:"\) \{[\s\S]*?\n  \}\n\n  HTMLCanvasElement\.prototype\.getContext/,
  "  HTMLCanvasElement.prototype.getContext",
);
html = html.replace(
  /<script type="module" src="js\/app\.js"><\/script>/i,
  `<script id="velaris-module-data" type="application/octet-stream">${moduleBase64}</script>\n<script id="velaris-model-data" type="application/octet-stream">${modelBase64}</script>\n${runtime}`,
);

if (html.includes("Local server required") || html.includes("src=\"js/app.js\"") || html.includes("href=\"css/style.css\"")) {
  throw new Error("The generated standalone page still contains external app requirements.");
}
if (/<base\b/i.test(html)) throw new Error("The standalone page must not depend on a project-relative base URL.");
const externalReferences = Array.from(html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi), (match) => match[1])
  .filter((reference) => !/^(?:data:|https?:|#)/i.test(reference));
if (externalReferences.length) throw new Error(`The standalone page still references local files: ${externalReferences.join(", ")}`);
if (!html.includes("id=\"velaris-module-data\"") || !html.includes("id=\"velaris-model-data\"")) {
  throw new Error("The standalone payload insertion point was not found in the source HTML.");
}
if (extname(outputPath).toLowerCase() !== ".html") throw new Error("Unexpected standalone output path.");

await writeFile(outputPath, html, "utf8");
console.log(`Built ${outputPath}`);
console.log(`${moduleOrder.length} local JavaScript modules and the ${glb.length.toLocaleString()}-byte GLB are embedded.`);
console.log(`Standalone HTML size: ${(Buffer.byteLength(html) / (1024 * 1024)).toFixed(2)} MiB.`);
