import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

const SDK = '12.19.0';
let modsPromise = null;
let state = null;
let optionalPresenceFieldsSupported = true;

async function loadModules() {
  if (!modsPromise) {
    modsPromise = Promise.all([
      import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${SDK}/firebase-database.js`)
    ]).then(([app, auth, db]) => ({ ...app, ...auth, ...db }));
  }
  return modsPromise;
}

async function init() {
  if (!isFirebaseConfigured()) return null;
  if (state) return state;
  const f = await loadModules();
  const app = f.initializeApp(firebaseConfig);
  const auth = f.initializeAuth(app, {
    persistence: [
      f.indexedDBLocalPersistence,
      f.browserLocalPersistence,
      f.browserSessionPersistence
    ],
    popupRedirectResolver: f.browserPopupRedirectResolver
  });
  const db = f.getDatabase(app);
  state = { f, app, auth, db };
  return state;
}

export function cloudConfigured() {
  return isFirebaseConfigured();
}

export async function signInStudentAnonymously() {
  const s = await init();
  if (!s) throw new Error('A Firebase még nincs beállítva.');
  await s.f.setPersistence(s.auth, s.f.browserSessionPersistence);
  if (s.auth.currentUser && s.auth.currentUser.isAnonymous) return s.auth.currentUser;
  if (s.auth.currentUser && !s.auth.currentUser.isAnonymous) await s.f.signOut(s.auth);
  const cred = await s.f.signInAnonymously(s.auth);
  return cred.user;
}

export async function signInTeacherWithGoogle() {
  const s = await init();
  if (!s) throw new Error('A Firebase még nincs beállítva.');
  const provider = new s.f.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await s.f.signInWithPopup(
    s.auth,
    provider,
    s.f.browserPopupRedirectResolver
  );
  return result.user;
}

export async function signOutFirebase() {
  const s = await init();
  if (s?.auth.currentUser) await s.f.signOut(s.auth);
}

export async function getCurrentFirebaseUser() {
  const s = await init();
  return s?.auth.currentUser || null;
}

function cleanCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12);
}

export function normalizeClassCode(code) {
  return cleanCode(code);
}

export function makeClassCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  const bytes = new Uint32Array(5);
  crypto.getRandomValues(bytes);
  for (const n of bytes) suffix += alphabet[n % alphabet.length];
  return `PY-${suffix}`;
}

export async function getClassMeta(code) {
  const s = await init();
  if (!s) throw new Error('A Firebase még nincs beállítva.');
  const classCode = cleanCode(code);
  const snap = await s.f.get(s.f.ref(s.db, `classes/${classCode}/meta`));
  return snap.exists() ? snap.val() : null;
}

export async function createClassSession({ code, title }) {
  const s = await init();
  if (!s) throw new Error('A Firebase még nincs beállítva.');
  if (!s.auth.currentUser || s.auth.currentUser.isAnonymous) throw new Error('Tanári Google-belépés szükséges.');
  const classCode = cleanCode(code);
  await s.f.set(s.f.ref(s.db, `classes/${classCode}/meta`), {
    title: String(title || 'Python óra').slice(0, 120),
    code: classCode,
    open: true,
    teacherUid: s.auth.currentUser.uid,
    createdAt: s.f.serverTimestamp(),
    updatedAt: s.f.serverTimestamp()
  });
  try { await rememberTeacherClassSession(classCode); } catch (err) { console.warn('Óraelőzmény-index nem frissült:', err); }
  return classCode;
}

export async function closeClassSession(code) {
  const s = await init();
  if (!s) throw new Error('A Firebase még nincs beállítva.');
  const classCode = cleanCode(code);
  await s.f.update(s.f.ref(s.db, `classes/${classCode}/meta`), {
    open: false,
    closedAt: s.f.serverTimestamp(),
    updatedAt: s.f.serverTimestamp()
  });
  try { await rememberTeacherClassSession(classCode); } catch (err) { console.warn('Óraelőzmény-index nem frissült:', err); }
}

export async function reopenClassSession(code) {
  const s = await init();
  if (!s) throw new Error('A Firebase még nincs beállítva.');
  const classCode = cleanCode(code);
  await s.f.update(s.f.ref(s.db, `classes/${classCode}/meta`), {
    open: true,
    closedAt: null,
    updatedAt: s.f.serverTimestamp()
  });
  try { await rememberTeacherClassSession(classCode); } catch (err) { console.warn('Óraelőzmény-index nem frissült:', err); }
}

export async function joinClassAsStudent(code, name) {
  const s = await init();
  if (!s) throw new Error('A Firebase még nincs beállítva.');
  const classCode = cleanCode(code);
  const user = await signInStudentAnonymously();
  const meta = await getClassMeta(classCode);
  if (!meta) throw new Error('Nincs ilyen órakód.');
  if (!meta.open) throw new Error('Ez az óra már le van zárva.');

  const studentRef = s.f.ref(s.db, `classes/${classCode}/students/${user.uid}`);
  const oldSnap = await s.f.get(studentRef);
  const existing = oldSnap.exists() ? oldSnap.val() : null;
  const patch = {
    name: String(name || 'Tanuló').slice(0, 60),
    uid: user.uid,
    status: 'online',
    lastSeen: s.f.serverTimestamp()
  };
  if (!existing?.joinedAt) patch.joinedAt = s.f.serverTimestamp();
  await s.f.update(studentRef, patch);

  const statusRef = s.f.ref(s.db, `classes/${classCode}/students/${user.uid}/status`);
  await s.f.onDisconnect(statusRef).set('offline');
  const seenRef = s.f.ref(s.db, `classes/${classCode}/students/${user.uid}/lastSeen`);
  await s.f.onDisconnect(seenRef).set(s.f.serverTimestamp());
  return { code: classCode, uid: user.uid, meta, ref: studentRef, existing };
}

export async function updateStudentPresence(code, uid, patch) {
  const s = await init();
  if (!s) return;
  const classCode = cleanCode(code);
  const ref = s.f.ref(s.db, `classes/${classCode}/students/${uid}`);
  const payload = { ...patch, lastSeen: s.f.serverTimestamp() };
  if (!optionalPresenceFieldsSupported) delete payload.currentAttempts;
  try {
    await s.f.update(ref, payload);
  } catch (err) {
    // Régebbi Firebase Rules esetén a currentAttempts még nincs engedélyezve.
    // Ilyenkor a teljes órai követés ne álljon le: egyszer visszaesünk a régi sémára.
    if (optionalPresenceFieldsSupported && Object.prototype.hasOwnProperty.call(payload, 'currentAttempts')) {
      optionalPresenceFieldsSupported = false;
      delete payload.currentAttempts;
      await s.f.update(ref, payload);
      return;
    }
    throw err;
  }
}

export async function markStudentOffline(code, uid) {
  const s = await init();
  if (!s) return;
  const classCode = cleanCode(code);
  await s.f.update(s.f.ref(s.db, `classes/${classCode}/students/${uid}`), {
    status: 'offline',
    lastSeen: s.f.serverTimestamp()
  });
}

export async function subscribeStudents(code, callback) {
  const s = await init();
  if (!s) throw new Error('A Firebase még nincs beállítva.');
  const classCode = cleanCode(code);
  const r = s.f.ref(s.db, `classes/${classCode}/students`);
  return s.f.onValue(r, snap => callback(snap.val() || {}));
}

export async function subscribeClassMeta(code, callback) {
  const s = await init();
  if (!s) throw new Error('A Firebase még nincs beállítva.');
  const classCode = cleanCode(code);
  const r = s.f.ref(s.db, `classes/${classCode}/meta`);
  return s.f.onValue(r, snap => callback(snap.val() || null));
}


export async function logStudentExamAttempt(code, uid, attempt) {
  const s = await init();
  if (!s || !code || !uid) return null;
  const classCode = cleanCode(code);
  const attemptsRef = s.f.ref(s.db, `classes/${classCode}/students/${uid}/examAttempts`);
  const newRef = s.f.push(attemptsRef);

  const taskScores = Array.isArray(attempt?.taskResults)
    ? attempt.taskResults
        .map((r, i) => `${i + 1}:${Number(r?.score) || 0}/${Number(r?.maxScore) || 0}`)
        .join('|')
        .slice(0, 240)
    : '';

  const payload = {
    examId: String(attempt?.examId || '').slice(0, 80),
    examTitle: String(attempt?.examTitle || 'Vizsga').slice(0, 160),
    examKind: String(attempt?.examKind || 'reszvizsga').slice(0, 40),
    score: Number(attempt?.score) || 0,
    maxScore: Math.max(0, Number(attempt?.maxScore) || 0),
    pct: Math.max(0, Math.min(100, Number(attempt?.pct) || 0)),
    durationSeconds: Math.max(0, Math.min(21600, Number(attempt?.durationSeconds) || 0)),
    taskScores,
    submittedAt: s.f.serverTimestamp()
  };
  if (typeof attempt?.passed === 'boolean') payload.passed = attempt.passed;

  await s.f.set(newRef, payload);
  return newRef.key;
}


async function teacherClassIndexRef(s, uid, code = '') {
  const suffix = code ? `/${cleanCode(code)}` : '';
  return s.f.ref(s.db, `teacherClasses/${uid}${suffix}`);
}

export async function rememberTeacherClassSession(code, meta = null) {
  const s = await init();
  if (!s) return false;
  const user = s.auth.currentUser;
  if (!user || user.isAnonymous) return false;

  const classCode = cleanCode(code);
  const classMeta = meta || await getClassMeta(classCode);
  if (!classMeta || classMeta.teacherUid !== user.uid) return false;

  const r = await teacherClassIndexRef(s, user.uid, classCode);
  await s.f.update(r, {
    code: classCode,
    title: String(classMeta.title || 'Python óra').slice(0, 120),
    open: !!classMeta.open,
    createdAt: Number(classMeta.createdAt) || s.f.serverTimestamp(),
    updatedAt: s.f.serverTimestamp()
  });
  return true;
}

export async function listTeacherClassSessions() {
  const s = await init();
  if (!s) return [];
  const user = s.auth.currentUser;
  if (!user || user.isAnonymous) return [];

  const r = await teacherClassIndexRef(s, user.uid);
  const snap = await s.f.get(r);
  const raw = snap.exists() ? snap.val() : {};
  return Object.values(raw || {})
    .filter(x => x && x.code)
    .sort((a, b) => (Number(b.updatedAt) || Number(b.createdAt) || 0) - (Number(a.updatedAt) || Number(a.createdAt) || 0));
}
