import {
  cloudConfigured,
  signInTeacherWithGoogle,
  signOutFirebase,
  createClassSession,
  closeClassSession,
  reopenClassSession,
  makeClassCode,
  normalizeClassCode,
  getClassMeta,
  subscribeStudents,
  subscribeClassMeta,
  rememberTeacherClassSession,
  listTeacherClassSessions
} from './firebase-service.js';

const $ = id => document.getElementById(id);
let user = null;
let currentCode = '';
let students = {};
let meta = null;
let unsubStudents = null;
let unsubMeta = null;

const TEACHER_TEST_AUTH_KEY = 'python_teacher_test_authorized_until_v1';
const TEACHER_TEST_TTL_MS = 2 * 60 * 60 * 1000;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
}
function mins(sec) { return Math.round((Number(sec) || 0) / 60); }
function relative(ts) {
  if (!ts) return '–';
  const d = Math.max(0, Date.now() - Number(ts));
  if (d < 60000) return `${Math.round(d / 1000)} mp`;
  if (d < 3600000) return `${Math.round(d / 60000)} p`;
  return `${Math.round(d / 3600000)} ó`;
}
function displayStatus(s) {
  if (s.status === 'offline') return ['offline', 'offline'];
  if (s.status === 'background') return ['background', 'háttér'];
  const age = Date.now() - (Number(s.lastActionAt) || 0);
  if (age <= 90000) return ['active', 'dolgozik'];
  return ['idle', 'inaktív'];
}

// Ugyanaz az azonosító több böngészőfülön külön anonim Firebase UID-t kaphat.
// A tanári táblában azonosító szerint egyetlen sorba vonjuk őket.
function mergedStudents() {
  const groups = new Map();
  for (const s of Object.values(students || {})) {
    const label = String(s.name || 'Tanuló').trim() || 'Tanuló';
    const key = label.toLocaleLowerCase('hu-HU');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }

  return [...groups.values()].map(group => {
    const latest = [...group].sort((a, b) => (Number(b.lastActionAt) || Number(b.lastSeen) || 0) - (Number(a.lastActionAt) || Number(a.lastSeen) || 0))[0] || {};
    const sum = key => group.reduce((acc, x) => acc + (Number(x[key]) || 0), 0);
    const max = key => group.reduce((acc, x) => Math.max(acc, Number(x[key]) || 0), 0);
    return {
      ...latest,
      name: latest.name || group[0]?.name || 'Tanuló',
      activeSeconds: sum('activeSeconds'),
      idleSeconds: sum('idleSeconds'),
      hiddenSeconds: sum('hiddenSeconds'),
      runCount: sum('runCount'),
      checkCount: sum('checkCount'),
      successfulChecks: sum('successfulChecks'),
      localHints: sum('localHints'),
      aiHints: sum('aiHints'),
      aiQuestions: sum('aiQuestions'),
      completedTasks: max('completedTasks'),
      totalTasks: max('totalTasks'),
      progressPct: Math.min(100, max('progressPct')),
      frontier: max('frontier'),
      currentAttempts: Number(latest.currentAttempts) || 0,
      examAttempts: group.flatMap(x => Object.entries(x.examAttempts || {}).map(([attemptId, a]) => ({
        attemptId,
        ...(a || {})
      }))),
      connections: group.length
    };
  });
}

function flattenedExamAttempts() {
  const rows = [];
  for (const student of mergedStudents()) {
    for (const a of student.examAttempts || []) {
      rows.push({
        studentName: student.name || 'Tanuló',
        ...a
      });
    }
  }

  // Próbálkozásszám tanuló + vizsga szerint, időrendben.
  const ordered = [...rows].sort((a, b) => (Number(a.submittedAt) || 0) - (Number(b.submittedAt) || 0));
  const counts = new Map();
  for (const row of ordered) {
    const key = `${String(row.studentName).toLocaleLowerCase('hu-HU')}|${row.examId || row.examTitle || 'vizsga'}`;
    const n = (counts.get(key) || 0) + 1;
    counts.set(key, n);
    row.attemptNo = n;
  }
  return ordered.sort((a, b) => (Number(b.submittedAt) || 0) - (Number(a.submittedAt) || 0));
}

function examKindText(kind) {
  if (kind === 'kisvizsga') return 'Kisvizsga';
  if (kind === 'vizsgaszimulacio') return 'Vizsgaszimuláció';
  return 'Részvizsga';
}

function durationText(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function renderExamAttempts() {
  const el = $('examAttemptRows');
  if (!el) return;
  const rows = flattenedExamAttempts();
  el.innerHTML = rows.length ? rows.map(a => {
    const pct = Math.max(0, Math.min(100, Number(a.pct) || 0));
    const state = typeof a.passed === 'boolean'
      ? (a.passed ? '<span class="examLogPass">teljesítve</span>' : '<span class="examLogFail">nem teljesült</span>')
      : '<span class="muted">pontozva</span>';
    const taskInfo = a.taskScores ? `<div class="tiny">Feladatok: ${esc(String(a.taskScores).replace(/\|/g, ' • '))}</div>` : '';
    return `<tr>
      <td><strong>${esc(a.studentName)}</strong></td>
      <td>${examKindText(a.examKind)}</td>
      <td>${esc(a.examTitle || a.examId || 'Vizsga')}${taskInfo}</td>
      <td>#${Number(a.attemptNo) || 1}</td>
      <td><strong>${Number(a.score) || 0}/${Number(a.maxScore) || 0}</strong><div class="tiny">${pct}%</div></td>
      <td>${state}</td>
      <td>${durationText(a.durationSeconds)}</td>
      <td>${a.submittedAt ? new Date(Number(a.submittedAt)).toLocaleString('hu-HU') : '–'}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="8" class="muted">Ehhez az órához még nincs naplózott vizsgapróbálkozás.</td></tr>';
  if ($('examAttemptCount')) $('examAttemptCount').textContent = `${rows.length} próbálkozás`;
}

function renderStats() {
  const a = mergedStudents();
  const active = a.filter(s => displayStatus(s)[0] === 'active').length;
  const avg = a.length ? Math.round(a.reduce((x, s) => x + (Number(s.progressPct) || 0), 0) / a.length) : 0;
  const activeMin = a.reduce((x, s) => x + mins(s.activeSeconds), 0);
  const hidden = a.reduce((x, s) => x + mins(s.hiddenSeconds), 0);
  const examCount = flattenedExamAttempts().length;
  $('stats').innerHTML = `
    <div class="statTile"><span class="tiny">Tanulók</span><strong>${a.length}</strong></div>
    <div class="statTile"><span class="tiny">Most aktív</span><strong>${active}</strong></div>
    <div class="statTile"><span class="tiny">Átlagos haladás</span><strong>${avg}%</strong></div>
    <div class="statTile"><span class="tiny">Összes aktív perc</span><strong>${activeMin}</strong></div>
    <div class="statTile"><span class="tiny">Háttérben perc</span><strong>${hidden}</strong></div>
    <div class="statTile"><span class="tiny">Vizsgapróbálkozások</span><strong>${examCount}</strong></div>`;
}

function renderRows() {
  const rows = mergedStudents().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'hu'));
  $('studentRows').innerHTML = rows.length ? rows.map(s => {
    const [cls, label] = displayStatus(s);
    const tip = (Number(s.localHints) || 0) + (Number(s.aiHints) || 0) + (Number(s.aiQuestions) || 0);
    const connections = s.connections > 1 ? `<div class="tiny">${s.connections} kapcsolat összevonva</div>` : '';
    return `<tr>
      <td><strong>${esc(s.name || 'Tanuló')}</strong>${connections}</td>
      <td><span class="statusDot status-${cls}"></span>${label}</td>
      <td>${esc(s.currentLessonTitle || '–')}<div class="tiny">${s.currentTaskNumber ? `${s.currentTaskNumber}. feladat` : ''}</div></td>
      <td>${Number(s.currentAttempts) || 0}</td>
      <td>${Number(s.completedTasks) || 0}/${Number(s.totalTasks) || 0}<div class="tiny">${Math.min(100, Number(s.progressPct) || 0)}%</div></td>
      <td>${mins(s.activeSeconds)} p</td>
      <td>${mins(s.idleSeconds)} p</td>
      <td>${mins(s.hiddenSeconds)} p</td>
      <td>${Number(s.runCount) || 0}</td>
      <td>${Number(s.checkCount) || 0}</td>
      <td>${Number(s.successfulChecks) || 0}</td>
      <td>${tip}</td>
      <td>${relative(s.lastActionAt)}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="13" class="muted">Még senki nem csatlakozott ehhez az órához.</td></tr>';
  $('lastUpdate').textContent = `Frissítve: ${new Date().toLocaleTimeString('hu-HU')}`;
  renderStats();
  renderExamAttempts();
}

function renderMeta() {
  if (!meta) return;
  $('sessionCard').classList.remove('hidden');
  $('classCodeBig').textContent = currentCode;
  $('sessionTitle').textContent = `${meta.title || 'Python óra'} • ${meta.open ? 'nyitva' : 'lezárva'}`;
  $('toggleClassBtn').textContent = meta.open ? 'Óra lezárása' : 'Óra újranyitása';
  $('toggleClassBtn').className = meta.open ? 'danger' : 'success';
}

async function refreshTeacherHistory() {
  const select = $('teacherHistory');
  const info = $('teacherHistoryInfo');
  if (!select) return;
  try {
    const sessions = await listTeacherClassSessions();
    if (!sessions.length) {
      select.innerHTML = '<option value="">Még nincs felhőben mentett óraelőzmény</option>';
      select.disabled = true;
      $('openHistoryBtn').disabled = true;
      if (info) info.textContent = 'A böngésző törlése után is megmaradó lista az újonnan megnyitott/indított órákkal épül fel.';
      return;
    }
    select.disabled = false;
    $('openHistoryBtn').disabled = false;
    select.innerHTML = sessions.map(s => {
      const when = s.createdAt ? new Date(Number(s.createdAt)).toLocaleString('hu-HU') : '';
      return `<option value="${esc(s.code)}">${esc(s.code)} – ${esc(s.title || 'Python óra')} – ${s.open ? 'nyitva' : 'lezárva'}${when ? ' – ' + when : ''}</option>`;
    }).join('');
    if (info) info.textContent = `${sessions.length} korábbi óra a Firebase-ben.`;
  } catch (err) {
    select.innerHTML = '<option value="">Óraelőzmény nem olvasható</option>';
    select.disabled = true;
    $('openHistoryBtn').disabled = true;
    if (info) info.textContent = 'A felhős óraelőzményhez még publikálni kell a teacherClasses Firebase-szabályt.';
  }
}

async function watch(code) {
  currentCode = normalizeClassCode(code);
  if (!currentCode) return;
  localStorage.setItem('python_teacher_last_class_v3', currentCode);
  if (unsubStudents) unsubStudents();
  if (unsubMeta) unsubMeta();
  meta = await getClassMeta(currentCode);
  if (!meta) throw new Error('Nincs ilyen órakód.');
  renderMeta();
  try {
    await rememberTeacherClassSession(currentCode, meta);
    await refreshTeacherHistory();
  } catch (err) {
    console.warn('Az óra megnyílt, de az óraelőzmény-index nem frissült:', err);
  }
  unsubStudents = await subscribeStudents(currentCode, data => { students = data || {}; renderRows(); });
  unsubMeta = await subscribeClassMeta(currentCode, data => { meta = data; renderMeta(); });
  $('classCode').value = currentCode;
}

async function login() {
  try {
    user = await signInTeacherWithGoogle();
    $('loginInfo').textContent = 'Google-belépés sikeres. A hozzáférést a Firebase biztonsági szabályai ellenőrzik.';
    $('loginCard').classList.add('hidden');
    $('dashboard').classList.remove('hidden');
    $('firebaseState').textContent = 'Firebase kész ✓';
    $('firebaseState').className = 'runtime ready';
    await refreshTeacherHistory();
    const last = localStorage.getItem('python_teacher_last_class_v3');
    if (last) { try { await watch(last); } catch {} }
  } catch (e) {
    const original = e?.customData?.originalError || e?.customData?.persistenceError || '';
    const extra = original ? ` | Részlet: ${String(original)}` : '';
    $('loginInfo').textContent = `Belépési hiba: ${e?.code || 'ismeretlen'} – ${e?.message || e}${extra}`;
    console.error('Teacher login failed:', e);
  }
}

async function create() {
  if (!user) return;
  const title = $('classTitle').value.trim() || 'Python gyakorlás';
  let code = makeClassCode();
  for (let i = 0; i < 4; i++) {
    if (!(await getClassMeta(code))) break;
    code = makeClassCode();
  }
  await createClassSession({ code, title });
  await watch(code);
  await refreshTeacherHistory();
}

function csvSafe(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportCsv() {
  const header = ['Azonosító','Állapot','Lecke','Feladat','Sikertelen próbák','Haladás %','Aktív perc','Inaktív perc','Háttér perc','Futtatás','Ellenőrzés','Sikeres','Helyi tipp','AI tipp','AI kérdés','Utolsó aktivitás'];
  const lines = [header, ...mergedStudents().map(s => [
    s.name, displayStatus(s)[1], s.currentLessonTitle, s.currentTaskNumber, s.currentAttempts,
    Math.min(100, Number(s.progressPct) || 0), mins(s.activeSeconds), mins(s.idleSeconds), mins(s.hiddenSeconds),
    s.runCount, s.checkCount, s.successfulChecks, s.localHints, s.aiHints, s.aiQuestions,
    new Date(Number(s.lastActionAt) || 0).toLocaleString('hu-HU')
  ])];
  const csv = '\uFEFF' + lines.map(r => r.map(csvSafe).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `python-ora-${currentCode || 'export'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportExamCsv() {
  const header = ['Azonosító','Típus','Vizsga','Próbálkozás','Pont','Max pont','Eredmény %','Állapot','Időtartam mp','Feladatonként','Beadás'];
  const lines = [header, ...flattenedExamAttempts().map(a => [
    a.studentName,
    examKindText(a.examKind),
    a.examTitle || a.examId,
    a.attemptNo,
    a.score,
    a.maxScore,
    a.pct,
    typeof a.passed === 'boolean' ? (a.passed ? 'teljesítve' : 'nem teljesült') : 'pontozva',
    a.durationSeconds,
    String(a.taskScores || '').replace(/\|/g, ' | '),
    a.submittedAt ? new Date(Number(a.submittedAt)).toLocaleString('hu-HU') : ''
  ])];
  const csv = '\uFEFF' + lines.map(r => r.map(csvSafe).join(';')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `python-vizsganaplo-${currentCode || 'export'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

$('loginBtn').onclick = login;
$('createClassBtn').onclick = () => create().catch(e => alert(e.message));
$('openClassBtn').onclick = () => watch($('classCode').value).catch(e => alert(e.message));
$('openHistoryBtn').onclick = () => {
  const code = $('teacherHistory').value;
  if (code) watch(code).catch(e => alert(e.message));
};
$('copyCodeBtn').onclick = () => { if (currentCode) navigator.clipboard.writeText(currentCode); };
$('toggleClassBtn').onclick = async () => {
  if (!currentCode || !meta) return;
  if (meta.open) await closeClassSession(currentCode);
  else await reopenClassSession(currentCode);
};
$('csvBtn').onclick = exportCsv;
$('examCsvBtn').onclick = exportExamCsv;
$('lessonTestBtn').onclick = () => {
  if (!user) return;
  localStorage.setItem(TEACHER_TEST_AUTH_KEY, String(Date.now() + TEACHER_TEST_TTL_MS));
  location.href = './?test=1';
};
$('logoutBtn').onclick = async () => {
  localStorage.removeItem(TEACHER_TEST_AUTH_KEY);
  await signOutFirebase();
  location.reload();
};

if (!cloudConfigured()) {
  $('firebaseState').textContent = 'Firebase nincs beállítva';
  $('firebaseState').className = 'runtime error';
  $('loginInfo').textContent = 'A Firebase-konfiguráció hiányzik.';
  $('loginBtn').disabled = true;
} else {
  $('firebaseState').textContent = 'Firebase beállítva';
  $('firebaseState').className = 'runtime ready';
  $('loginInfo').textContent = 'Belépés után a szerveroldali Firebase-szabályok döntik el a tanári hozzáférést.';
}

setInterval(() => { if (currentCode) renderRows(); }, 15000);
