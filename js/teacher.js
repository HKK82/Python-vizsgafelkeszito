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

function withTimeout(promise, ms, label = 'Művelet') {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: időtúllépés`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
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


function clampPct(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
}

function ratioPct(a, b) {
  const den = Number(b) || 0;
  return den > 0 ? clampPct((Number(a) || 0) / den * 100) : 0;
}

function reportStudentKey(student) {
  return String(student?.name || 'Tanuló').trim().toLocaleLowerCase('hu-HU');
}

function anonymizedStudentLabel(student, index = 0) {
  return `Tanuló ${index + 1}`;
}

function latestAttemptsByExam(student) {
  const byExam = new Map();
  const sorted = [...(student.examAttempts || [])]
    .sort((a, b) => (Number(a.submittedAt) || 0) - (Number(b.submittedAt) || 0));
  for (const attempt of sorted) {
    const key = String(attempt.examId || attempt.examTitle || 'vizsga');
    byExam.set(key, attempt);
  }
  return [...byExam.values()].sort((a, b) =>
    String(a.examTitle || a.examId || '').localeCompare(String(b.examTitle || b.examId || ''), 'hu')
  );
}

function bestAttemptsByExam(student) {
  const byExam = new Map();
  for (const attempt of student.examAttempts || []) {
    const key = String(attempt.examId || attempt.examTitle || 'vizsga');
    const prev = byExam.get(key);
    if (!prev || (Number(attempt.pct) || 0) > (Number(prev.pct) || 0)) byExam.set(key, attempt);
  }
  return [...byExam.values()];
}

function learningObservation(student) {
  const checks = Number(student.checkCount) || 0;
  const successes = Number(student.successfulChecks) || 0;
  const hints = (Number(student.localHints) || 0) + (Number(student.aiHints) || 0) + (Number(student.aiQuestions) || 0);
  const checkSuccess = ratioPct(successes, checks);
  const helpPerSuccess = successes > 0 ? hints / successes : hints;
  const totalObserved = (Number(student.activeSeconds) || 0) + (Number(student.idleSeconds) || 0) + (Number(student.hiddenSeconds) || 0);
  const activeShare = totalObserved > 0 ? ratioPct(student.activeSeconds, totalObserved) : 0;

  const parts = [];
  if (checks >= 3) {
    if (checkSuccess >= 75) parts.push('Az ellenőrzések nagy része sikeres volt; az aktuális órán viszonylag stabil önálló feladatmegoldás látszik.');
    else if (checkSuccess >= 45) parts.push('Az ellenőrzések között több javítási kör is megjelent; a tanuló próbálkozással jut el a helyes megoldásokhoz.');
    else parts.push('Az ellenőrzésekhez sok javítási kör társult; az adott témákban több célzott gyakorlás indokolt.');
  } else {
    parts.push('Még kevés ellenőrzési adat áll rendelkezésre ahhoz, hogy az önállóságról erős következtetést lehessen levonni.');
  }

  if (hints === 0 && successes > 0) parts.push('A rögzített sikeres feladatokhoz nem használt helyi vagy AI-segítséget.');
  else if (successes > 0 && helpPerSuccess <= 0.5) parts.push('A segítség használata mérsékelt volt a sikeres megoldások számához képest.');
  else if (hints > 0) parts.push('Többször használt helyi vagy AI-segítséget; érdemes figyelni, mely témáknál jelenik meg rendszeresen ez az igény.');

  if (totalObserved >= 300) {
    if (activeShare >= 70) parts.push('A megfigyelt idő nagyobb részében aktív munkavégzés történt.');
    else if (activeShare >= 45) parts.push('Az aktív munkavégzés mellett számottevő inaktív vagy háttérben töltött idő is megjelent.');
    else parts.push('A megfigyelt idő jelentős részében nem aktív munkavégzés látszott; ezt érdemes az órai körülményekkel együtt értelmezni.');
  }
  return parts;
}

function examStrengthsAndFocus(student) {
  const latest = latestAttemptsByExam(student);
  if (!latest.length) return {
    strengths: ['Még nincs elegendő vizsgaadat konkrét tématerületi erősség megnevezéséhez.'],
    focus: ['A további kisvizsgák eredményei alapján lesz pontosabban meghatározható a fejlesztési irány.']
  };

  const scored = latest
    .map(a => ({ title: a.examTitle || a.examId || 'Vizsga', pct: clampPct(a.pct) }))
    .sort((a, b) => b.pct - a.pct);
  const strengths = scored.filter(x => x.pct >= 80).slice(0, 3)
    .map(x => `${x.title}: ${x.pct}% – stabilabb teljesítmény.`);
  const focus = [...scored].sort((a, b) => a.pct - b.pct).filter(x => x.pct < 80).slice(0, 3)
    .map(x => `${x.title}: ${x.pct}% – további gyakorlás javasolt.`);

  return {
    strengths: strengths.length ? strengths : ['A vizsgaeredmények alapján még nincs 80% feletti, egyértelműen stabil tématerület.'],
    focus: focus.length ? focus : ['A jelenlegi vizsgaeredmények alapján nincs 80% alatti kiemelt fejlesztendő vizsgaterület.']
  };
}

function reportExamRows(student) {
  const latest = latestAttemptsByExam(student);
  if (!latest.length) return '<tr><td colspan="5" class="muted">Még nincs naplózott vizsgaeredmény.</td></tr>';
  return latest.map(a => {
    const attemptsForExam = (student.examAttempts || []).filter(x =>
      String(x.examId || x.examTitle || 'vizsga') === String(a.examId || a.examTitle || 'vizsga')
    ).length;
    const best = bestAttemptsByExam(student).find(x =>
      String(x.examId || x.examTitle || 'vizsga') === String(a.examId || a.examTitle || 'vizsga')
    );
    return `<tr>
      <td>${esc(a.examTitle || a.examId || 'Vizsga')}</td>
      <td>${examKindText(a.examKind)}</td>
      <td>${clampPct(a.pct)}%</td>
      <td>${best ? clampPct(best.pct) + '%' : '–'}</td>
      <td>${attemptsForExam}</td>
    </tr>`;
  }).join('');
}

function buildStudentReportHtml(student, anonymize = false) {
  const all = mergedStudents().sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'hu'));
  const index = Math.max(0, all.findIndex(s => reportStudentKey(s) === reportStudentKey(student)));
  const label = anonymize ? anonymizedStudentLabel(student, index) : (student.name || 'Tanuló');
  const progress = clampPct(student.progressPct);
  const attempts = student.examAttempts || [];
  const latest = latestAttemptsByExam(student);
  const avgExam = latest.length
    ? Math.round(latest.reduce((sum, a) => sum + clampPct(a.pct), 0) / latest.length)
    : null;
  const successfulExamCount = latest.filter(a => typeof a.passed === 'boolean' ? a.passed : clampPct(a.pct) >= 80).length;
  const helpCount = (Number(student.localHints) || 0) + (Number(student.aiHints) || 0) + (Number(student.aiQuestions) || 0);
  const observation = learningObservation(student);
  const sf = examStrengthsAndFocus(student);

  return `
    <article class="reportSheet">
      <div class="reportHeader">
        <div>
          <div class="reportKicker">PEDAGÓGIAI TANULÓI RIPORT</div>
          <h1>${esc(label)}</h1>
          <div class="muted">${esc(meta?.title || 'Python óra')} • ${esc(currentCode || '')} • ${new Date().toLocaleDateString('hu-HU')}</div>
        </div>
        <div class="reportBadge">aktuális óra</div>
      </div>

      <div class="reportSummaryGrid">
        <div><span>Haladás</span><strong>${Number(student.completedTasks) || 0}/${Number(student.totalTasks) || 0}</strong><small>${progress}%</small></div>
        <div><span>Aktív idő</span><strong>${mins(student.activeSeconds)} perc</strong><small>megfigyelt órai aktivitás</small></div>
        <div><span>Sikeres ellenőrzés</span><strong>${Number(student.successfulChecks) || 0}</strong><small>${Number(student.checkCount) || 0} ellenőrzésből</small></div>
        <div><span>Segítséghasználat</span><strong>${helpCount}</strong><small>helyi tipp + AI</small></div>
        <div><span>Vizsgák átlaga</span><strong>${avgExam === null ? '–' : avgExam + '%'}</strong><small>${latest.length} külön vizsga</small></div>
        <div><span>Teljesített vizsgák</span><strong>${successfulExamCount}</strong><small>${attempts.length} összes próbálkozás</small></div>
      </div>

      <section class="reportSection">
        <h2>Jelenlegi helyzet</h2>
        <p>A tanuló jelenleg a(z) <strong>${esc(student.currentLessonTitle || '–')}</strong> témánál tart${student.currentTaskNumber ? `, a ${Number(student.currentTaskNumber)}. feladaton` : ''}. A rögzített haladás ${progress}%.</p>
      </section>

      <section class="reportSection">
        <h2>Megfigyelhető tanulási minta</h2>
        <ul>${observation.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      </section>

      <div class="reportTwoCol">
        <section class="reportSection">
          <h2>Erősségek</h2>
          <ul>${sf.strengths.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        </section>
        <section class="reportSection">
          <h2>Fejlesztendő / következő fókusz</h2>
          <ul>${sf.focus.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        </section>
      </div>

      <section class="reportSection">
        <h2>Vizsgaeredmények</h2>
        <table class="reportTable">
          <thead><tr><th>Vizsga</th><th>Típus</th><th>Legutóbbi</th><th>Legjobb</th><th>Próbák</th></tr></thead>
          <tbody>${reportExamRows(student)}</tbody>
        </table>
      </section>

      <section class="reportSection reportNote">
        <h2>Értelmezési megjegyzés</h2>
        <p>Ez a riport az aktuális órához rögzített haladási, aktivitási és vizsga-metaadatokból készült. Nem diagnosztikai eszköz, és nem következtet egészségi, pszichológiai vagy gyógypedagógiai állapotra. Az inaktív/háttéridőt mindig az órai körülményekkel együtt kell értelmezni.</p>
      </section>
    </article>`;
}

function latestPerStudentExam() {
  const map = new Map();
  for (const student of mergedStudents()) {
    for (const attempt of student.examAttempts || []) {
      const examKey = String(attempt.examId || attempt.examTitle || 'vizsga');
      const key = `${reportStudentKey(student)}|${examKey}`;
      const prev = map.get(key);
      if (!prev || (Number(attempt.submittedAt) || 0) > (Number(prev.attempt.submittedAt) || 0)) {
        map.set(key, { student, attempt });
      }
    }
  }
  return [...map.values()];
}

function buildGroupReportHtml(anonymize = false) {
  const group = mergedStudents().sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'hu'));
  const avgProgress = group.length ? Math.round(group.reduce((s,x) => s + clampPct(x.progressPct), 0) / group.length) : 0;
  const totalActive = group.reduce((s,x) => s + mins(x.activeSeconds), 0);
  const totalChecks = group.reduce((s,x) => s + (Number(x.checkCount) || 0), 0);
  const totalSuccess = group.reduce((s,x) => s + (Number(x.successfulChecks) || 0), 0);
  const latestPairs = latestPerStudentExam();

  const examGroups = new Map();
  for (const { student, attempt } of latestPairs) {
    const key = String(attempt.examId || attempt.examTitle || 'vizsga');
    if (!examGroups.has(key)) examGroups.set(key, []);
    examGroups.get(key).push({ student, attempt });
  }
  const examRows = [...examGroups.values()].map(rows => {
    const title = rows[0]?.attempt?.examTitle || rows[0]?.attempt?.examId || 'Vizsga';
    const avg = Math.round(rows.reduce((s,r) => s + clampPct(r.attempt.pct), 0) / rows.length);
    const passed = rows.filter(r => typeof r.attempt.passed === 'boolean' ? r.attempt.passed : clampPct(r.attempt.pct) >= 80).length;
    return { title, avg, attempted: rows.length, passed };
  }).sort((a,b) => a.avg - b.avg);

  const support = examRows.filter(x => x.avg < 75).slice(0,4);
  const strong = [...examRows].sort((a,b) => b.avg - a.avg).filter(x => x.avg >= 80).slice(0,4);
  const studentRows = group.map((s,i) => {
    const label = anonymize ? anonymizedStudentLabel(s,i) : (s.name || 'Tanuló');
    const latest = latestAttemptsByExam(s);
    const avg = latest.length ? Math.round(latest.reduce((sum,a)=>sum+clampPct(a.pct),0)/latest.length) : null;
    const help = (Number(s.localHints)||0)+(Number(s.aiHints)||0)+(Number(s.aiQuestions)||0);
    return `<tr>
      <td>${esc(label)}</td>
      <td>${clampPct(s.progressPct)}%</td>
      <td>${mins(s.activeSeconds)} p</td>
      <td>${Number(s.successfulChecks)||0}/${Number(s.checkCount)||0}</td>
      <td>${help}</td>
      <td>${avg === null ? '–' : avg + '%'}</td>
    </tr>`;
  }).join('');

  return `
    <article class="reportSheet">
      <div class="reportHeader">
        <div>
          <div class="reportKicker">CSOPORTSZINTŰ PEDAGÓGIAI RIPORT</div>
          <h1>${esc(meta?.title || 'Python óra')}</h1>
          <div class="muted">${esc(currentCode || '')} • ${new Date().toLocaleDateString('hu-HU')}</div>
        </div>
        <div class="reportBadge">${group.length} tanuló</div>
      </div>

      <div class="reportSummaryGrid">
        <div><span>Tanulók</span><strong>${group.length}</strong><small>aktuális órában</small></div>
        <div><span>Átlagos haladás</span><strong>${avgProgress}%</strong><small>teljes tananyaghoz képest</small></div>
        <div><span>Összes aktív idő</span><strong>${totalActive} perc</strong><small>csoportszinten</small></div>
        <div><span>Sikeres ellenőrzések</span><strong>${totalSuccess}</strong><small>${totalChecks} ellenőrzésből</small></div>
      </div>

      <div class="reportTwoCol">
        <section class="reportSection">
          <h2>Csoportszintű erősségek</h2>
          <ul>${(strong.length ? strong.map(x => `${x.title}: ${x.avg}% csoportátlag (${x.attempted} tanuló).`) : ['Még nincs elegendő vizsgaadat 80% feletti közös erősség azonosításához.']).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        </section>
        <section class="reportSection">
          <h2>Közös fejlesztési fókusz</h2>
          <ul>${(support.length ? support.map(x => `${x.title}: ${x.avg}% csoportátlag; ${x.passed}/${x.attempted} tanuló teljesítette a küszöböt.`) : ['A jelenlegi vizsgaadatok alapján nincs 75% alatti kiemelt közös vizsgaterület.']).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        </section>
      </div>

      <section class="reportSection">
        <h2>Tanulói áttekintés</h2>
        <table class="reportTable">
          <thead><tr><th>Azonosító</th><th>Haladás</th><th>Aktív idő</th><th>Siker/ellenőrzés</th><th>Segítség</th><th>Vizsgaátlag</th></tr></thead>
          <tbody>${studentRows || '<tr><td colspan="6" class="muted">Még nincs tanulói adat.</td></tr>'}</tbody>
        </table>
      </section>

      <section class="reportSection reportNote">
        <h2>Értelmezési megjegyzés</h2>
        <p>A csoport riport az aktuális órához rögzített adatok összesítése. Nem diagnosztikai értékelés. Az eredmények elsősorban arra alkalmasak, hogy látható legyen, mely tananyagrészeknél érdemes közösen visszagyakorolni, és mely tanulóknál szükséges több egyéni támogatás.</p>
      </section>
    </article>`;
}

function refreshReportStudentOptions() {
  const select = $('reportStudentSelect');
  if (!select) return;
  const previous = select.value;
  const rows = mergedStudents().sort((a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'hu'));
  select.innerHTML = '<option value="">Válassz tanulót…</option>' + rows.map(s =>
    `<option value="${esc(reportStudentKey(s))}">${esc(s.name || 'Tanuló')}</option>`
  ).join('');
  if (rows.some(s => reportStudentKey(s) === previous)) select.value = previous;
}

function showStudentReport() {
  const key = $('reportStudentSelect')?.value || '';
  if (!key) {
    alert('Válassz tanulót az egyéni riporthoz.');
    return;
  }
  const student = mergedStudents().find(s => reportStudentKey(s) === key);
  if (!student) return;
  $('reportPrintArea').innerHTML = buildStudentReportHtml(student, !!$('reportAnonymize')?.checked);
  $('printReportBtn').disabled = false;
  $('reportPrintArea').scrollIntoView({ behavior:'smooth', block:'start' });
}

function showGroupReport() {
  $('reportPrintArea').innerHTML = buildGroupReportHtml(!!$('reportAnonymize')?.checked);
  $('printReportBtn').disabled = false;
  $('reportPrintArea').scrollIntoView({ behavior:'smooth', block:'start' });
}

function printCurrentReport() {
  if ($('printReportBtn')?.disabled) return;
  document.body.classList.add('printingReport');
  window.print();
  setTimeout(() => document.body.classList.remove('printingReport'), 300);
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
  refreshReportStudentOptions();
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
  const openBtn = $('openHistoryBtn');
  if (!select) return;

  select.disabled = true;
  openBtn.disabled = true;
  select.innerHTML = '<option value="">Felhős óraelőzmények betöltése…</option>';
  if (info) info.textContent = 'Kapcsolódás a Firebase óraelőzményhez…';

  try {
    const sessions = await withTimeout(listTeacherClassSessions(), 7000, 'Óraelőzmény betöltése');

    // Az aktuálisan megnyitott órát mindig tegyük bele helyi tartalékként,
    // még akkor is, ha az index épp most jött létre.
    const merged = [...sessions];
    if (currentCode && meta && !merged.some(s => s.code === currentCode)) {
      merged.unshift({
        code: currentCode,
        title: meta.title || 'Python óra',
        open: !!meta.open,
        createdAt: Number(meta.createdAt) || 0,
        updatedAt: Number(meta.updatedAt) || Date.now()
      });
    }

    if (!merged.length) {
      select.innerHTML = '<option value="">Még nincs felhőben mentett óraelőzmény</option>';
      if (info) info.textContent = 'Az újonnan indított vagy kézzel megnyitott órák ezután bekerülnek ide. A régi órákat egyszer az órakódjukkal kell megnyitni.';
      return;
    }

    select.disabled = false;
    openBtn.disabled = false;
    select.innerHTML = merged.map(s => {
      const when = s.createdAt ? new Date(Number(s.createdAt)).toLocaleString('hu-HU') : '';
      return `<option value="${esc(s.code)}">${esc(s.code)} – ${esc(s.title || 'Python óra')} – ${s.open ? 'nyitva' : 'lezárva'}${when ? ' – ' + when : ''}</option>`;
    }).join('');
    if (currentCode) select.value = currentCode;
    if (info) info.textContent = `${merged.length} óra elérhető. A lista Firebase-ben marad meg, nem a böngésző sütijeiben.`;
  } catch (err) {
    const fallback = currentCode && meta
      ? [{ code: currentCode, title: meta.title || 'Python óra', open: !!meta.open }]
      : [];

    if (fallback.length) {
      select.disabled = false;
      openBtn.disabled = false;
      select.innerHTML = fallback.map(s =>
        `<option value="${esc(s.code)}">${esc(s.code)} – ${esc(s.title)} – ${s.open ? 'nyitva' : 'lezárva'} (aktuális)</option>`
      ).join('');
    } else {
      select.innerHTML = '<option value="">Felhős óraelőzmény nem érhető el</option>';
    }

    if (info) {
      info.innerHTML = '<strong>Az óraelőzmény-index még nincs engedélyezve a Firebase Rules-ban.</strong> ' +
        'A már ismert órakódokat továbbra is meg tudod nyitni a „Meglévő órakód” mezővel. ' +
        'A teacherClasses szabály publikálása után a lista tartósan működik cookie-törlés után is.';
    }
    console.warn('Óraelőzmény betöltési hiba:', err);
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
  unsubMeta = await subscribeClassMeta(currentCode, data => {
    meta = data;
    renderMeta();
  });
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
$('studentReportBtn').onclick = showStudentReport;
$('groupReportBtn').onclick = showGroupReport;
$('printReportBtn').onclick = printCurrentReport;
window.addEventListener('afterprint', () => document.body.classList.remove('printingReport'));
$('lessonTestBtn').onclick = () => {
  if (!user) return;
  localStorage.setItem(TEACHER_TEST_AUTH_KEY, String(Date.now() + TEACHER_TEST_TTL_MS));
  location.href = './?test=1';
};
$('examTestBtn').onclick = () => {
  if (!user) return;
  localStorage.setItem(TEACHER_TEST_AUTH_KEY, String(Date.now() + TEACHER_TEST_TTL_MS));
  location.href = './exams.html?teachertest=1';
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
