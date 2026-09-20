import { cloudConfigured, joinClassAsStudent, updateStudentPresence, markStudentOffline } from './firebase-service.js';

export class ActivityTracker {
  constructor({ getProgressSnapshot, flushEveryMs = 20000, idleAfterMs = 90000 } = {}) {
    this.getProgressSnapshot = getProgressSnapshot;
    this.flushEveryMs = flushEveryMs;
    this.idleAfterMs = idleAfterMs;
    this.classCode = '';
    this.uid = '';
    this.studentName = '';
    this.meta = null;
    this.lastActionAt = Date.now();
    this.lastTickAt = Date.now();
    this.activeSeconds = 0;
    this.idleSeconds = 0;
    this.hiddenSeconds = 0;
    this.counters = { runCount: 0, checkCount: 0, successfulChecks: 0, localHints: 0, aiHints: 0, aiQuestions: 0 };
    this.startedAtIso = '';
    this.timer = null;
    this.flushTimer = null;
    this.onStatus = null;
    this._boundVisibility = () => this.record('visibility');
    this._boundFocus = () => this.record('focus');
    this._boundPageHide = () => { this.flush().catch(() => {}); };
  }

  async join(code, studentName) {
    if (!code) return { connected: false, reason: 'Nincs órakód.' };
    if (!cloudConfigured()) return { connected: false, reason: 'A Firebase még nincs beállítva.' };
    this.stopTimers();
    const joined = await joinClassAsStudent(code, studentName);
    this.classCode = joined.code;
    this.uid = joined.uid;
    this.studentName = studentName;
    this.meta = joined.meta;

    // Oldalváltás/újratöltés után ne írjuk felül nullákkal az addigi órai adatokat.
    const old = joined.existing || {};
    this.activeSeconds = Number(old.activeSeconds) || 0;
    this.idleSeconds = Number(old.idleSeconds) || 0;
    this.hiddenSeconds = Number(old.hiddenSeconds) || 0;
    for (const key of Object.keys(this.counters)) this.counters[key] = Number(old[key]) || 0;

    this.startedAtIso = new Date().toISOString();
    this.lastActionAt = Date.now();
    this.lastTickAt = Date.now();
    this.startTimers();
    await this.flush('online');
    this.onStatus?.({ connected: true, code: this.classCode, title: this.meta?.title || '' });
    return { connected: true, code: this.classCode, meta: this.meta };
  }

  startTimers() {
    this.stopTimers();
    document.addEventListener('visibilitychange', this._boundVisibility);
    window.addEventListener('focus', this._boundFocus);
    window.addEventListener('pagehide', this._boundPageHide);
    this.timer = setInterval(() => this.tick(), 1000);
    this.flushTimer = setInterval(() => this.flush().catch(() => {}), this.flushEveryMs);
  }

  stopTimers() {
    if (this.timer) clearInterval(this.timer);
    if (this.flushTimer) clearInterval(this.flushTimer);
    this.timer = null;
    this.flushTimer = null;
    document.removeEventListener('visibilitychange', this._boundVisibility);
    window.removeEventListener('focus', this._boundFocus);
    window.removeEventListener('pagehide', this._boundPageHide);
  }

  tick() {
    const now = Date.now();
    const dt = Math.max(0, Math.min(2, (now - this.lastTickAt) / 1000));
    this.lastTickAt = now;
    if (document.hidden) this.hiddenSeconds += dt;
    else if (now - this.lastActionAt <= this.idleAfterMs) this.activeSeconds += dt;
    else this.idleSeconds += dt;
  }

  record(type = 'activity') {
    this.lastActionAt = Date.now();
    if (type in this.counters) this.counters[type] += 1;
  }

  getStatus() {
    if (document.hidden) return 'background';
    return Date.now() - this.lastActionAt <= this.idleAfterMs ? 'active' : 'idle';
  }

  async flush(forcedStatus = '') {
    if (!this.classCode || !this.uid) return;
    const progress = this.getProgressSnapshot?.() || {};
    await updateStudentPresence(this.classCode, this.uid, {
      name: this.studentName,
      status: forcedStatus || this.getStatus(),
      lastActionAt: this.lastActionAt,
      activeSeconds: Math.round(this.activeSeconds),
      idleSeconds: Math.round(this.idleSeconds),
      hiddenSeconds: Math.round(this.hiddenSeconds),
      ...this.counters,
      ...progress
    });
  }

  async leave() {
    try {
      await this.flush('offline');
      await markStudentOffline(this.classCode, this.uid);
    } catch {}
    this.stopTimers();
    this.classCode = '';
    this.uid = '';
  }
}
