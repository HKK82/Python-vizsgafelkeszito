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
