// CDP capture harness for the VELARIS configurator.
// Usage: node capture.mjs <url> <out.png> [--js "expr"] [--wait ms] [--w 1600] [--h 900] [--raw]
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const args = process.argv.slice(2);
const url = args[0];
const out = args[1];
function opt(name, def) {
  const i = args.indexOf("--" + name);
  return i >= 0 ? args[i + 1] : def;
}
const jsExpr = opt("js", "");
const waitMs = parseInt(opt("wait", "900"), 10);
const W = parseInt(opt("w", "1600"), 10);
const H = parseInt(opt("h", "900"), 10);
const PORT = 9223 + Math.floor(Math.random() * 400);

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const profile = mkdtempSync(join(tmpdir(), "velaris-cdp-"));

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
  "--user-data-dir=" + profile,
  "--remote-debugging-port=" + PORT,
  "--window-size=" + W + "," + H,
  "--hide-scrollbars",
  "about:blank",
], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(path) {
  const r = await fetch(`http://127.0.0.1:${PORT}${path}`);
  return r.json();
}

let idSeq = 0;
function send(ws, method, params = {}, sessionId) {
  const id = ++idSeq;
  return new Promise((resolve, reject) => {
    const onMsg = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id === id) {
        ws.removeEventListener("message", onMsg);
        msg.error ? reject(new Error(method + ": " + msg.error.message)) : resolve(msg.result);
      }
    };
    ws.addEventListener("message", onMsg);
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

const logs = [];
try {
  let version = null;
  for (let i = 0; i < 60; i++) {
    try { version = await getJson("/json/version"); break; } catch { await sleep(250); }
  }
  if (!version) throw new Error("chrome did not start");
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: "PUT" })).json();

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(msg.params.type)) {
      logs.push(msg.params.type.toUpperCase() + ": " + msg.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
    }
    if (msg.method === "Runtime.exceptionThrown") {
      logs.push("EXCEPTION: " + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    }
    if (msg.method === "Log.entryAdded") {
      logs.push("LOG[" + msg.params.entry.level + "]: " + msg.params.entry.text + " " + (msg.params.entry.url || ""));
    }
  });

  await send(ws, "Page.enable");
  await send(ws, "Runtime.enable");
  await send(ws, "Log.enable");
  await send(ws, "Page.navigate", { url });

  let ready = false;
  const noReady = args.includes("--noready");
  for (let i = 0; i < (noReady ? 1 : 240); i++) {
    await sleep(noReady ? 4000 : 250);
    try {
      const r = await send(ws, "Runtime.evaluate", { expression: "!!window.__velaris_ready", returnByValue: true });
      if (r.result && r.result.value) { ready = true; break; }
    } catch { /* navigating */ }
  }

  if (jsExpr) {
    const r = await send(ws, "Runtime.evaluate", { expression: jsExpr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) logs.push("JSEXPR: " + (r.exceptionDetails.exception?.description || r.exceptionDetails.text));
    else console.log("JSRESULT=" + JSON.stringify(r.result ? r.result.value : null));
  }

  await sleep(waitMs);

  const errs = await send(ws, "Runtime.evaluate", {
    expression: "JSON.stringify((window.__velaris && window.__velaris.errors) || [])",
    returnByValue: true,
  });

  const shot = await send(ws, "Page.captureScreenshot", { format: "png" });
  writeFileSync(out, Buffer.from(shot.data, "base64"));
  console.log("READY=" + ready);
  console.log("PAGE_ERRORS=" + (errs.result ? errs.result.value : "[]"));
  if (logs.length) console.log("CONSOLE:\n" + logs.slice(0, 20).join("\n"));
  console.log("SAVED " + out);
  ws.close();
} catch (e) {
  console.log("CAPTURE FAIL: " + e.message);
  process.exitCode = 1;
} finally {
  chrome.kill();
}
