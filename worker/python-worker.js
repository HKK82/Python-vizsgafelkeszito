const PYODIDE_BASE = 'https://cdn.jsdelivr.net/pyodide/v0.27.8/full/';
let pyodide = null;
let runnerLoaded = false;

async function boot() {
  importScripts(PYODIDE_BASE + 'pyodide.js');
  pyodide = await loadPyodide({ indexURL: PYODIDE_BASE });
  const runnerSource = await (await fetch('./runner.py', { cache: 'no-store' })).text();
  await pyodide.runPythonAsync(runnerSource);
  runnerLoaded = true;
  self.postMessage({ type: 'ready' });
}

boot().catch(err => {
  self.postMessage({ type: 'bootError', error: String(err?.message || err) });
});

self.onmessage = async (event) => {
  const { requestId, payload } = event.data || {};
  if (!requestId) return;
  if (!runnerLoaded || !pyodide) {
    self.postMessage({ requestId, ok: false, error: 'A Python környezet még nem áll készen.' });
    return;
  }
  try {
    pyodide.globals.set('__payload_json', JSON.stringify(payload || {}));
    const jsonResult = await pyodide.runPythonAsync('handle_request(__payload_json)');
    self.postMessage({ requestId, ok: true, result: JSON.parse(jsonResult) });
  } catch (err) {
    self.postMessage({ requestId, ok: false, error: String(err?.message || err) });
  }
};