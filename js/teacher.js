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
  subscribeClassMeta
} from './firebase-service.js';

const $ = id => document.getElementById(id);
let user = null;
let currentCode = '';
let students = {};
let meta = null;
let unsubStudents = null;
let unsubMeta = null;

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
      connections: group.length
    };
  });
}

function renderStats() {
  const a = mergedStudents();
  const active = a.filter(s => displayStatus(s)[0] === 'active').length;
  const avg = a.length ? Math.round(a.reduce((x, s) => x + (Number(s.progressPct) || 0), 0) / a.length) : 0;
  const activeMin = a.reduce((x, s) => x + mins(s.activeSeconds), 0);
  const hidden = a.reduce((x, s) => x + mins(s.hiddenSeconds), 0);
  $('stats').innerHTML = `
    <div class="statTile"><span class="tiny">Tanulók</span><strong>${a.length}</strong></div>
    <div class="statTile"><span class="tiny">Most aktív</span><strong>${active}</strong></div>
    <div class="statTile"><span class="tiny">Átlagos haladás</span><strong>${avg}%</strong></div>
    <div class="statTile"><span class="tiny">Összes aktív perc</span><strong>${activeMin}</strong></div>
    <div class="statTile"><span class="tiny">Háttérben perc</span><strong>${hidden}</strong></div>`;
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
}

function renderMeta() {
  if (!meta) return;
  $('sessionCard').classList.remove('hidden');
  $('classCodeBig').textContent = currentCode;
  $('sessionTitle').textContent = `${meta.title || 'Python óra'} • ${meta.open ? 'nyitva' : 'lezárva'}`;
  $('toggleClassBtn').textContent = meta.open ? 'Óra lezárása' : 'Óra újranyitása';
  $('toggleClassBtn').className = meta.open ? 'danger' : 'success';
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

$('loginBtn').onclick = login;
$('createClassBtn').onclick = () => create().catch(e => alert(e.message));
$('openClassBtn').onclick = () => watch($('classCode').value).catch(e => alert(e.message));
$('copyCodeBtn').onclick = () => { if (currentCode) navigator.clipboard.writeText(currentCode); };
$('toggleClassBtn').onclick = async () => {
  if (!currentCode || !meta) return;
  if (meta.open) await closeClassSession(currentCode);
  else await reopenClassSession(currentCode);
};
$('csvBtn').onclick = exportCsv;
$('logoutBtn').onclick = async () => { await signOutFirebase(); location.reload(); };

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
