// Optional real browser check using native Node APIs and an installed Chrome.
// Called by smoke_local.py with test fixture paths; installs no dependencies.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const required = ['CHROME_BIN', 'BROWSER_PORT', 'SMOKE_PDF_PATH', 'SMOKE_JD_PATH', 'API_PROXY_TARGET'];
for (const key of required) if (!process.env[key]) throw new Error(`${key} is required`);
const profile = await mkdtemp(join(tmpdir(), 'resumelens-chrome-'));
const origin = `http://127.0.0.1:${process.env.BROWSER_PORT}`;
let chrome, vite, socket;
const pending = new Map();
const listeners = new Map();
let nextId = 0;
async function until(action, label, timeout = 20000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try { const result = await action(); if (result) return result; } catch { /* wait for startup */ }
    await delay(100);
  }
  throw new Error(`Timed out: ${label}`);
}
function cdp(method, params = {}) {
  return new Promise((resolveCall, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolveCall, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
function event(method, predicate = () => true) {
  return new Promise((resolveEvent, reject) => {
    const timer = setTimeout(() => { listeners.get(method)?.delete(handler); reject(new Error(`Event timeout: ${method}`)); }, 20000);
    const handler = (params) => { if (predicate(params)) { clearTimeout(timer); listeners.get(method).delete(handler); resolveEvent(params); } };
    if (!listeners.has(method)) listeners.set(method, new Set());
    listeners.get(method).add(handler);
  });
}
async function chooseFile(path) {
  const doc = await cdp('DOM.getDocument');
  const input = await cdp('DOM.querySelector', { nodeId: doc.root.nodeId, selector: 'input[type=file]' });
  await cdp('DOM.setFileInputFiles', { nodeId: input.nodeId, files: [path] });
  await delay(100);
}
async function enterDescription(text) {
  await evaluate(`(() => { const input = document.querySelector('#job-description'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, ${JSON.stringify(text)}); input.dispatchEvent(new Event('input', {bubbles:true})); })()`);
  await delay(100);
}
async function submitSuccess(expectedCount) {
  const response = event('Network.responseReceived', (params) => params.response.url.endsWith('/api/analyze'));
  await evaluate(`document.querySelector('button[type=submit]').click()`);
  if ((await response).response.status !== 200) throw new Error('Analysis request did not succeed');
  await until(() => evaluate(`Boolean(document.querySelector('#analysis')) && !document.querySelector('button[type=submit]').disabled`), 'analysis rendering');
  const count = await evaluate(`document.querySelectorAll('.requirement-row').length`);
  if (count !== expectedCount) throw new Error(`Expected ${expectedCount} requirement rows, got ${count}`);
}
async function evaluate(expression) {
  const reply = await cdp('Runtime.evaluate', { expression, returnByValue: true });
  if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.text);
  return reply.result?.value;
}
try {
  vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', process.env.BROWSER_PORT, '--strictPort'], { cwd: resolve('client'), env: process.env, stdio: 'ignore' });
  await until(async () => (await fetch(origin)).ok, 'Vite startup');
  chrome = spawn(process.env.CHROME_BIN, ['--headless', '--disable-gpu', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  chrome.on('error', (error) => { console.error(error.message); });
  const debugPort = await until(async () => (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0], 'Chrome startup');
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const target = targets.find((item) => item.type === 'page');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolveOpen, reject) => { socket.addEventListener('open', resolveOpen, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method) for (const listener of listeners.get(message.method) || []) listener(message.params);
    const call = pending.get(message.id);
    if (call) { clearTimeout(call.timer); pending.delete(message.id); if (message.error) call.reject(new Error(message.error.message)); else call.resolveCall(message.result); }
  });
  await cdp('Page.enable');
  await cdp('Page.bringToFront');
  await cdp('Emulation.setFocusEmulationEnabled', { enabled: true });
  await cdp('Network.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: origin });
  await until(() => evaluate(`Boolean(document.querySelector('#job-description'))`), 'React mount');
  await chooseFile(process.env.SMOKE_PDF_PATH);
  const jd = await readFile(process.env.SMOKE_JD_PATH, 'utf8');
  await enterDescription(jd);
  // Hold the actual request briefly to verify the real loading/disabled state.
  await cdp('Fetch.enable', { patterns: [{ urlPattern: '*/api/analyze' }] });
  const paused = event('Fetch.requestPaused');
  const initialResponse = event('Network.responseReceived', (p) => p.response.url.endsWith('/api/analyze'));
  await evaluate(`document.querySelector('button[type=submit]').click()`);
  const request = await paused;
  if (!(await evaluate(`document.querySelector('button[type=submit]').disabled && Boolean(document.querySelector('[role=status]'))`))) throw new Error('Loading feedback missing');
  await cdp('Fetch.continueRequest', { requestId: request.requestId });
  await cdp('Fetch.disable');
  if ((await initialResponse).response.status !== 200) throw new Error('Initial browser analysis failed');
  await until(() => evaluate(`Boolean(document.querySelector('#analysis'))`), 'initial results');
  const expected = JSON.parse(process.env.SMOKE_EXPECTED_KINDS);
  const state = await evaluate(`({ groups: document.querySelectorAll('.requirement-group').length, expanded: document.querySelectorAll('.requirement-group[open]').length, keyword: document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow'), fallback: document.querySelector('.fallback-panel') !== null, kinds: Object.fromEntries(['explicit','contextual','uncertain','not_evidenced'].map(k => [k, document.querySelectorAll('[data-evidence-kind="'+k+'"]').length])), counts: [...document.querySelectorAll('.overview-card strong')].map(e => Number(e.textContent)), categories: [...new Set([...document.querySelectorAll('.requirement-row')].map(e => e.dataset.category))].sort() })`);
  if (state.groups !== Object.values(expected).filter(Boolean).length || state.expanded !== 0 || state.keyword !== '75' || state.fallback || JSON.stringify(state.kinds) !== JSON.stringify(expected) || JSON.stringify(state.counts) !== JSON.stringify([5, ...Object.values(expected)]) || JSON.stringify(state.categories) !== JSON.stringify(['education','experience','other','technical'])) throw new Error(`Unexpected dashboard: ${JSON.stringify(state)}`);
  // Keyboard operation must reveal the native disclosure.
  await evaluate(`document.querySelector('.requirement-group > summary').scrollIntoView(); document.querySelector('.requirement-group > summary').focus()`);
  await cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await until(() => evaluate(`document.querySelector('.requirement-group').open`), 'keyboard expansion', 3000);
  await evaluate(`document.querySelector('.evidence-details > summary').click(); document.querySelector('.technical-details > summary').click()`);
  if (!(await evaluate(`document.querySelector('.evidence-details').open && document.querySelector('.technical-details').open && document.querySelector('.evidence-details').innerText.includes('C/C++')`))) throw new Error('Evidence/similarity expansion failed');
  // Replacement input must invalidate old results without a page reload.
  await chooseFile(process.env.SMOKE_REPLACEMENT_PATH);
  const replacementJD = '# Systems Software Engineer\nTeam: Core Platform\n## Required Qualifications\n- Knowledge of Python OR Perl.\n- B.Tech Computer Science eligibility.';
  await enterDescription(replacementJD);
  if (await evaluate(`Boolean(document.querySelector('#analysis'))`)) throw new Error('Stale results survived replacement inputs');
  await submitSuccess(2);
  if (!(await evaluate(`document.querySelector('[data-summary-label="Direct mentions"] strong').textContent === '2' && !document.querySelector('.improvements').innerText.toLowerCase().includes('perl') && ![...document.querySelectorAll('.skill-chip.missing')].some(e => e.textContent === 'perl')`))) throw new Error('False alternative/education gap after reanalysis');
  // A real network failure preserves the replacement inputs and supports retry.
  await cdp('Fetch.enable', { patterns: [{ urlPattern: '*/api/analyze' }] });
  const failed = event('Fetch.requestPaused');
  await evaluate(`document.querySelector('button[type=submit]').click()`);
  await cdp('Fetch.failRequest', { requestId: (await failed).requestId, errorReason: 'Failed' });
  await cdp('Fetch.disable');
  await until(() => evaluate(`Boolean(document.querySelector('[role=alert]'))`), 'network error state');
  if (!(await evaluate(`document.querySelector('#job-description').value === ${JSON.stringify(replacementJD)} && document.querySelector('button[type=submit]').textContent.includes('Retry analysis') && document.querySelector('.has-file').innerText.includes('replacement-resume.pdf')`))) throw new Error('Retry inputs not preserved');
  await submitSuccess(2);
  // Exercise the actual server's PDF parsing failure, then replace and retry.
  await chooseFile(process.env.SMOKE_BAD_PDF_PATH);
  const badResponse = event('Network.responseReceived', (p) => p.response.url.endsWith('/api/analyze'));
  await evaluate(`document.querySelector('button[type=submit]').click()`);
  if ((await badResponse).response.status !== 422) throw new Error('Malformed PDF was not rejected');
  await until(() => evaluate(`Boolean(document.querySelector('[role=alert]'))`), 'PDF error state');
  await chooseFile(process.env.SMOKE_REPLACEMENT_PATH);
  await submitSuccess(2);
  const directory = process.env.SMOKE_SCREENSHOT_DIR;
  if (directory) await mkdir(directory, { recursive: true });
  for (const [name, width, height] of [['desktop', 1440, 1100], ['mobile', 390, 844]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await delay(100);
    if (name === 'mobile') await submitSuccess(2);
    if (await evaluate('document.documentElement.scrollWidth > innerWidth')) throw new Error(`Horizontal overflow: ${name}`);
    if (directory) {
      const { cssContentSize } = await cdp('Page.getLayoutMetrics');
      const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: cssContentSize.height, scale: 1 } });
      await writeFile(join(directory, `${name}.png`), Buffer.from(shot.data, 'base64'));
    }
  }
  console.log(JSON.stringify({ browser: 'passed', ...state, checks: ['upload', 'JD entry', 'loading', 'keyboard expansion', 'evidence/similarity', 'summary counts', 'replacement resume/JD', 'network failure/retry', 'malformed PDF/retry', 'mobile reanalysis'], responsive: ['1440px', '390px'], screenshots: directory || null }));
} finally {
  if (socket) socket.close();
  for (const call of pending.values()) clearTimeout(call.timer);
  for (const child of [chrome, vite]) {
    if (!child || child.exitCode !== null) continue;
    child.kill('SIGTERM');
    await Promise.race([new Promise((resolveExit) => child.once('exit', resolveExit)), delay(3000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  await rm(profile, { recursive: true, force: true });
}
