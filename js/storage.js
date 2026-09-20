const STATE_KEY = 'python_exam_trainer_state_v2';
const API_KEY_SESSION = 'python_exam_trainer_api_session_v2';
const API_KEY_LOCAL = 'python_exam_trainer_api_local_v2';

const memoryFallback = {};

function safeGet(storage, key) {
  try { return storage.getItem(key); } catch { return memoryFallback[key] ?? null; }
}
function safeSet(storage, key, value) {
  try { storage.setItem(key, value); return true; } catch { memoryFallback[key] = value; return false; }
}
function safeRemove(storage, key) {
  try { storage.removeItem(key); } catch { delete memoryFallback[key]; }
}

function defaultState() {
  return { version: 2, currentStudentKey: '', profiles: {} };
}

function normalizeStudentKey(name) {
  return (name || 'tanulo').trim().toLocaleLowerCase('hu-HU').replace(/\s+/g, ' ');
}

function normalizeProfile(profile) {
  profile.frontier ||= 0;
  profile.completed ||= {};
  profile.attempts ||= {};
  profile.drafts ||= {};
  profile.viewedSolutions ||= {};
  profile.personalNotes ||= {};
  profile.savedExplanations ||= {};
  profile.examResults ||= {};
  profile.examDrafts ||= {};
  profile.examSessions ||= {};
  profile.lastViewed ||= 0;
  profile.updatedAt ||= new Date().toISOString();
  return profile;
}

export class ProgressStore {
  constructor() {
    this.state = this.loadState();
  }

  loadState() {
    try {
      const raw = safeGet(localStorage, STATE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || parsed.version !== 2) return defaultState();
      parsed.profiles ||= {};
      for (const profile of Object.values(parsed.profiles)) normalizeProfile(profile);
      return parsed;
    } catch {
      return defaultState();
    }
  }

  persist() {
    return safeSet(localStorage, STATE_KEY, JSON.stringify(this.state));
  }

  ensureProfile(displayName) {
    const key = normalizeStudentKey(displayName);
    if (!this.state.profiles[key]) {
      this.state.profiles[key] = {
        displayName: displayName.trim() || 'Tanuló',
        frontier: 0,
        completed: {},
        attempts: {},
        drafts: {},
        viewedSolutions: {},
        personalNotes: {},
        savedExplanations: {},
        examResults: {},
        examDrafts: {},
        examSessions: {},
        lastViewed: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    } else {
      normalizeProfile(this.state.profiles[key]);
      this.state.profiles[key].displayName = displayName.trim() || this.state.profiles[key].displayName;
    }
    this.state.currentStudentKey = key;
    this.persist();
    return this.state.profiles[key];
  }

  getCurrentProfile() {
    const key = this.state.currentStudentKey;
    return key ? this.state.profiles[key] || null : null;
  }

  getCurrentStudentName() {
    return this.getCurrentProfile()?.displayName || '';
  }

  setCurrentStudent(displayName) {
    return this.ensureProfile(displayName);
  }

  saveDraft(taskKey, code) {
    const p = this.getCurrentProfile();
    if (!p) return;
    p.drafts[taskKey] = code;
    p.updatedAt = new Date().toISOString();
    this.persist();
  }

  getDraft(taskKey, fallback = '') {
    const p = this.getCurrentProfile();
    return p?.drafts?.[taskKey] ?? fallback;
  }

  incrementAttempt(taskKey) {
    const p = this.getCurrentProfile();
    if (!p) return 0;
    p.attempts[taskKey] = (p.attempts[taskKey] || 0) + 1;
    p.updatedAt = new Date().toISOString();
    this.persist();
    return p.attempts[taskKey];
  }

  resetAttempt(taskKey) {
    const p = this.getCurrentProfile();
    if (!p) return;
    p.attempts[taskKey] = 0;
    this.persist();
  }

  getAttempts(taskKey) {
    return this.getCurrentProfile()?.attempts?.[taskKey] || 0;
  }

  markSolutionViewed(taskKey) {
    const p = this.getCurrentProfile();
    if (!p) return;
    p.viewedSolutions[taskKey] = true;
    p.updatedAt = new Date().toISOString();
    this.persist();
  }

  hasViewedSolution(taskKey) {
    return !!this.getCurrentProfile()?.viewedSolutions?.[taskKey];
  }

  markCompleted(taskKey, taskIndexGlobal, totalTasks) {
    const p = this.getCurrentProfile();
    if (!p) return;
    p.completed[taskKey] = true;
    if (taskIndexGlobal >= p.frontier && p.frontier < totalTasks) {
      while (p.frontier < totalTasks) {
        const nextKey = this._taskKeyAtGlobalIndex(p.frontier);
        if (!nextKey || !p.completed[nextKey]) break;
        p.frontier += 1;
      }
    }
    p.updatedAt = new Date().toISOString();
    this.persist();
  }

  // Az app induláskor beállítja ezt a listát, így a storage nem függ a tananyagmodultól.
  setTaskOrder(taskKeys) {
    this.taskOrder = [...taskKeys];
  }

  _taskKeyAtGlobalIndex(index) {
    return this.taskOrder?.[index] || null;
  }

  isCompleted(taskKey) {
    return !!this.getCurrentProfile()?.completed?.[taskKey];
  }

  completedCount() {
    const p = this.getCurrentProfile();
    if (!p) return 0;
    if (Array.isArray(this.taskOrder) && this.taskOrder.length) {
      return this.taskOrder.reduce((sum, key) => sum + (p.completed?.[key] ? 1 : 0), 0);
    }
    return Object.values(p.completed || {}).filter(Boolean).length;
  }

  setLastViewed(globalIndex) {
    const p = this.getCurrentProfile();
    if (!p) return;
    p.lastViewed = globalIndex;
    this.persist();
  }

  getLastViewed() {
    return this.getCurrentProfile()?.lastViewed || 0;
  }

  getFrontier(totalTasks) {
    return Math.min(this.getCurrentProfile()?.frontier || 0, totalTasks);
  }

  resetCurrentProgress() {
    const key = this.state.currentStudentKey;
    const current = this.getCurrentProfile();
    if (!key || !current) return;
    const name = current.displayName;
    this.state.profiles[key] = {
      displayName: name,
      frontier: 0,
      completed: {},
      attempts: {},
      drafts: {},
      viewedSolutions: {},
      personalNotes: {},
      savedExplanations: {},
      examResults: {},
      examDrafts: {},
      examSessions: {},
      lastViewed: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.persist();
  }

  setPersonalNote(lessonId, text) {
    const p = this.getCurrentProfile();
    if (!p) return;
    normalizeProfile(p);
    p.personalNotes[String(lessonId)] = String(text || '');
    p.updatedAt = new Date().toISOString();
    this.persist();
  }

  getPersonalNote(lessonId) {
    const p = this.getCurrentProfile();
    if (!p) return '';
    normalizeProfile(p);
    return p.personalNotes[String(lessonId)] || '';
  }

  appendSavedExplanation(lessonId, text) {
    const p = this.getCurrentProfile();
    if (!p || !String(text || '').trim()) return;
    normalizeProfile(p);
    const key = String(lessonId);
    p.savedExplanations[key] ||= [];
    const cleanText = String(text).trim();
    const last = p.savedExplanations[key][p.savedExplanations[key].length - 1];
    if (!last || last.text !== cleanText) {
      p.savedExplanations[key].push({ text: cleanText, savedAt: new Date().toISOString() });
    }
    if (p.savedExplanations[key].length > 20) p.savedExplanations[key] = p.savedExplanations[key].slice(-20);
    p.updatedAt = new Date().toISOString();
    this.persist();
  }

  getSavedExplanations(lessonId) {
    const p = this.getCurrentProfile();
    if (!p) return [];
    normalizeProfile(p);
    return p.savedExplanations[String(lessonId)] || [];
  }


  saveExamDraft(examId, taskIndex, code) {
    const p = this.getCurrentProfile();
    if (!p) return;
    normalizeProfile(p);
    p.examDrafts[String(examId)] ||= {};
    p.examDrafts[String(examId)][String(taskIndex)] = String(code ?? '');
    p.updatedAt = new Date().toISOString();
    this.persist();
  }

  getExamDraft(examId, taskIndex, fallback = '') {
    const p = this.getCurrentProfile();
    if (!p) return fallback;
    normalizeProfile(p);
    return p.examDrafts?.[String(examId)]?.[String(taskIndex)] ?? fallback;
  }

  clearExamDrafts(examId) {
    const p = this.getCurrentProfile();
    if (!p) return;
    normalizeProfile(p);
    delete p.examDrafts[String(examId)];
    this.persist();
  }

  saveExamSession(examId, session) {
    const p = this.getCurrentProfile();
    if (!p) return;
    normalizeProfile(p);
    p.examSessions[String(examId)] = { ...session };
    p.updatedAt = new Date().toISOString();
    this.persist();
  }

  getExamSession(examId) {
    const p = this.getCurrentProfile();
    if (!p) return null;
    normalizeProfile(p);
    return p.examSessions[String(examId)] || null;
  }

  clearExamSession(examId) {
    const p = this.getCurrentProfile();
    if (!p) return;
    normalizeProfile(p);
    delete p.examSessions[String(examId)];
    this.persist();
  }

  saveExamResult(examId, result) {
    const p = this.getCurrentProfile();
    if (!p) return;
    normalizeProfile(p);
    p.examResults[String(examId)] ||= [];
    p.examResults[String(examId)].push({ ...result, savedAt: new Date().toISOString() });
    if (p.examResults[String(examId)].length > 10) p.examResults[String(examId)] = p.examResults[String(examId)].slice(-10);
    p.updatedAt = new Date().toISOString();
    this.persist();
  }

  getExamResults(examId) {
    const p = this.getCurrentProfile();
    if (!p) return [];
    normalizeProfile(p);
    return p.examResults[String(examId)] || [];
  }

  getProfileSnapshot() {
    const p = this.getCurrentProfile();
    return p ? JSON.parse(JSON.stringify(normalizeProfile(p))) : null;
  }

  exportCurrent() {
    const p = this.getCurrentProfile();
    if (!p) return null;
    return {
      format: 'python-vizsgafelkeszito-progress-v2',
      exportedAt: new Date().toISOString(),
      profile: JSON.parse(JSON.stringify(p))
    };
  }

  importProfile(payload) {
    if (!payload || payload.format !== 'python-vizsgafelkeszito-progress-v2' || !payload.profile?.displayName) {
      throw new Error('Nem megfelelő haladásfájl.');
    }
    const profile = payload.profile;
    normalizeProfile(profile);
    profile.updatedAt = new Date().toISOString();
    const key = normalizeStudentKey(profile.displayName);
    this.state.profiles[key] = profile;
    this.state.currentStudentKey = key;
    this.persist();
    return profile;
  }

  listProfiles() {
    return Object.values(this.state.profiles).map(p => ({ displayName: p.displayName, updatedAt: p.updatedAt }));
  }

  clearCurrentSelection() {
    this.state.currentStudentKey = '';
    this.persist();
  }
}

export function getStoredApiKey() {
  return safeGet(sessionStorage, API_KEY_SESSION) || safeGet(localStorage, API_KEY_LOCAL) || '';
}

export function storeApiKey(key, remember) {
  if (remember) {
    safeSet(localStorage, API_KEY_LOCAL, key);
    safeRemove(sessionStorage, API_KEY_SESSION);
  } else {
    safeSet(sessionStorage, API_KEY_SESSION, key);
    safeRemove(localStorage, API_KEY_LOCAL);
  }
}

export function clearApiKey() {
  safeRemove(sessionStorage, API_KEY_SESSION);
  safeRemove(localStorage, API_KEY_LOCAL);
}

export function isApiKeyRemembered() {
  return !!safeGet(localStorage, API_KEY_LOCAL);
}
