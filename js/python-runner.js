export class PythonRunner {
  constructor({ timeoutMs = 5000, workerUrl = './worker/python-worker.js' } = {}) {
    this.timeoutMs = timeoutMs;
    this.workerUrl = workerUrl;
    this.worker = null;
    this.readyPromise = null;
    this.pending = new Map();
    this.seq = 0;
    this.onStatus = null;
  }

  async start() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = new Promise((resolve, reject) => {
      this.onStatus?.('loading');
      const worker = new Worker(this.workerUrl);
      this.worker = worker;

      const bootTimer = setTimeout(() => {
        this._hardReset();
        this.readyPromise = null;
        reject(new Error('A Python környezet nem töltődött be időben.'));
      }, 30000);

      worker.onmessage = (event) => {
        const data = event.data || {};
        if (data.type === 'ready') {
          clearTimeout(bootTimer);
          this.onStatus?.('ready');
          resolve();
          return;
        }
        if (data.type === 'bootError') {
          clearTimeout(bootTimer);
          this.onStatus?.('error');
          this.readyPromise = null;
          reject(new Error(data.error || 'Python betöltési hiba.'));
          return;
        }
        if (data.requestId && this.pending.has(data.requestId)) {
          const entry = this.pending.get(data.requestId);
          clearTimeout(entry.timer);
          this.pending.delete(data.requestId);
          if (data.ok) entry.resolve(data.result);
          else entry.reject(new Error(data.error || 'Python worker hiba.'));
        }
      };

      worker.onerror = (err) => {
        clearTimeout(bootTimer);
        this.onStatus?.('error');
        const error = new Error(err.message || 'Python worker hiba.');
        for (const [, entry] of this.pending) {
          clearTimeout(entry.timer);
          entry.reject(error);
        }
        this.pending.clear();
        this.readyPromise = null;
        reject(error);
      };
    });
    return this.readyPromise;
  }

  async restart() {
    this._hardReset();
    this.readyPromise = null;
    return this.start();
  }

  _hardReset() {
    if (this.worker) {
      try { this.worker.terminate(); } catch {}
    }
    this.worker = null;
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error('A Python környezet újraindult.'));
    }
    this.pending.clear();
  }

  async request(payload, timeoutMs = this.timeoutMs) {
    await this.start();
    const requestId = `req_${Date.now()}_${++this.seq}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(async () => {
        this.pending.delete(requestId);
        this.onStatus?.('timeout');
        this._hardReset();
        this.readyPromise = null;
        reject(Object.assign(new Error('TIMEOUT'), { code: 'TIMEOUT' }));
        try { await this.start(); } catch {}
      }, timeoutMs);
      this.pending.set(requestId, { resolve, reject, timer });
      this.worker.postMessage({ requestId, payload });
    });
  }

  analyze(code) {
    return this.request({ action: 'analyze', code });
  }

  execute(code, inputs = []) {
    return this.request({ action: 'execute', code, inputs });
  }

  executeWithFiles(code, inputs = [], files = {}, readFiles = []) {
    return this.request({ action: 'executeWithFiles', code, inputs, files, readFiles });
  }

  functionTest(code, functionName, args = []) {
    return this.request({ action: 'functionTest', code, functionName, args });
  }
}