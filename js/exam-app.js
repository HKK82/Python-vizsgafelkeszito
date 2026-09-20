import { exams } from './exams.js';
import { flattenTasks, totalTasks } from './lessons.js';
import { ProgressStore } from './storage.js';
import { PythonRunner } from './python-runner.js';
import { ActivityTracker } from './activity.js';

const $ = id => document.getElementById(id);
const store = new ProgressStore();
const baseItems = flattenTasks();
store.setTaskOrder(baseItems.map(x => x.key));
const runner = new PythonRunner({ timeoutMs: 5000 });
let ready = false;
const CLASS_CODE_KEY = 'python_exam_trainer_class_code_v3';

function progressPct() {
  if (!totalTasks) return 0;
  return Math.max(0, Math.min(100, Math.round(store.completedCount() / totalTasks * 100)));
}

const tracker = new ActivityTracker({
  getProgressSnapshot: () => ({
    currentLessonTitle: 'Részvizsga',
    currentTaskKey: 'exam',
    currentTaskNumber: 0,
    completedTasks: store.completedCount(),
    totalTasks,
    progressPct: progressPct(),
    frontier: store.getFrontier(totalTasks),
    currentAttempts: 0
  })
});

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
}

function comparisonCount(summary) {
  return Object.entries(summary.ops || {})
    .filter(([name]) => ['Lt','LtE','Gt','GtE','Eq','NotEq'].includes(name))
    .reduce((sum, [, count]) => sum + Number(count || 0), 0);
}

function checkReq(summary, r) {
  const min = r.min ?? 1;
  if (r.type === 'node') return (summary.nodes?.[r.name] || 0) >= min;
  if (r.type === 'call') return (summary.calls?.[r.name] || 0) >= min;
  if (r.type === 'op') return (summary.ops?.[r.name] || 0) >= min;
  if (r.type === 'comparisons') return comparisonCount(summary) >= min;
  if (r.type === 'function') {
    const a = summary.functions?.[r.name];
    return Number.isInteger(a) && a >= (r.minArgs ?? 0);
  }
  return true;
}

function equalLines(a, b) {
  return a.length === b.length && a.every((x, i) => x === String(b[i]));
}

function formatError(e) {
  if (!e) return 'Ismeretlen hiba';
  return `${e.type || 'Hiba'}${e.line ? ` (${e.line}. sor)` : ''}: ${e.message || ''}`;
}

function activeSession(examId) {
  const s = store.getExamSession(examId);
  return s && Number(s.endAt) > 0 && !s.submitted ? s : null;
}

function render() {
  const p = store.getCurrentProfile();
  $('examList').innerHTML = exams.map(ex => {
    const last = store.getExamResults(ex.id).slice(-1)[0];
    const active = activeSession(ex.id);
    return `<section class="card examCard" data-exam="${ex.id}">
      <div class="teacherHero"><div><h2>${esc(ex.title)}</h2><p class="muted">${esc(ex.description)}</p></div>
      <div><span class="badge">${ex.durationMinutes} perc</span>${last ? `<div class="tiny">Legutóbb: ${last.score}/${last.maxScore} pont</div>` : ''}</div></div>
      <button class="primary" data-start="${ex.id}" ${!p ? 'disabled' : ''}>${active ? 'Részvizsga folytatása' : 'Részvizsga indítása'}</button>
      <div class="examBody hidden" data-body="${ex.id}"></div>
    </section>`;
  }).join('');
  document.querySelectorAll('[data-start]').forEach(b => b.onclick = () => startExam(b.dataset.start));
}

function setupExamEditor(textarea, examId, taskIndex) {
  textarea.addEventListener('input', () => {
    store.saveExamDraft(examId, taskIndex, textarea.value);
    tracker.record('activity');
  });
  textarea.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.setRangeText('    ', start, end, 'end');
    store.saveExamDraft(examId, taskIndex, textarea.value);
  });
}

function startExam(id) {
  const ex = exams.find(x => x.id === id);
  const body = document.querySelector(`[data-body="${id}"]`);
  if (!ex || !body) return;
  body.classList.remove('hidden');

  let session = activeSession(id);
  if (!session) {
    const startedAt = Date.now();
    session = { startedAt, endAt: startedAt + ex.durationMinutes * 60000, submitted: false };
    store.saveExamSession(id, session);
  }
  body.dataset.started = String(session.startedAt);
  body.dataset.end = String(session.endAt);

  body.innerHTML = `<div class="teacherHero"><strong>Hátralévő idő: <span data-time="${id}"></span></strong><button class="success" data-submit="${id}">Beadás és pontozás</button></div>` +
    ex.tasks.map((t, i) => `<div class="examTask"><h3>${t.title} <span class="badge">${t.points} pont</span></h3><p>${t.text}</p><textarea data-code="${id}-${i}" spellcheck="false" autocapitalize="off" autocorrect="off">${esc(store.getExamDraft(id, i, t.starter || ''))}</textarea><div class="feedback hidden" data-result="${id}-${i}"></div></div>`).join('');

  document.querySelector(`[data-submit="${id}"]`).onclick = () => submitExam(ex);
  ex.tasks.forEach((_, i) => setupExamEditor(body.querySelector(`[data-code="${id}-${i}"]`), id, i));
  tracker.record('activity');

  const tick = () => {
    if (body.classList.contains('submitted')) return;
    const left = Math.max(0, Number(body.dataset.end) - Date.now());
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    const el = document.querySelector(`[data-time="${id}"]`);
    if (el) el.textContent = `${m}:${String(s).padStart(2, '0')}`;
    if (left <= 0) submitExam(ex);
    else setTimeout(tick, 1000);
  };
  tick();
}

async function scoreTask(task, code) {
  let score = 0;
  const details = [];
  const analysis = await runner.analyze(code);
  if (!analysis.ok) return { score: 0, details: [`A kód nem elemezhető: ${formatError(analysis.error)}`] };

  for (const r of task.checks || []) {
    if (checkReq(analysis.summary, r)) {
      score += r.points;
      details.push(`✓ ${r.label}: +${r.points}`);
    } else details.push(`✗ ${r.label}: 0/${r.points}`);
  }
  for (const t of task.tests || []) {
    const res = await runner.execute(code, t.inputs || []);
    if (res.ok && equalLines(res.stdoutLines || [], t.expectedLines || [])) {
      score += t.points;
      details.push(`✓ Rejtett futási teszt: +${t.points}`);
    } else details.push(`✗ Rejtett futási teszt: 0/${t.points}`);
  }
  for (const t of task.functionTests || []) {
    const res = await runner.functionTest(code, t.functionName, t.args || []);
    if (res.ok && JSON.stringify(res.actual) === JSON.stringify(t.expected)) {
      score += t.points;
      details.push(`✓ Függvényteszt ${t.functionName}(${(t.args || []).join(', ')}): +${t.points}`);
    } else details.push(`✗ Függvényteszt ${t.functionName}(...): 0/${t.points}`);
  }
  return { score: Math.min(task.points, score), details };
}

async function submitExam(ex) {
  if (!ready) return;
  const body = document.querySelector(`[data-body="${ex.id}"]`);
  if (body.classList.contains('submitted')) return;
  body.classList.add('submitted');
  const button = body.querySelector('[data-submit]');
  button.disabled = true;
  button.textContent = 'Pontozás…';

  let total = 0;
  const taskResults = [];
  for (let i = 0; i < ex.tasks.length; i++) {
    const code = body.querySelector(`[data-code="${ex.id}-${i}"]`).value;
    store.saveExamDraft(ex.id, i, code);
    const r = await scoreTask(ex.tasks[i], code);
    total += r.score;
    taskResults.push({ score: r.score, maxScore: ex.tasks[i].points });
    const box = body.querySelector(`[data-result="${ex.id}-${i}"]`);
    box.className = 'feedback ' + (r.score === ex.tasks[i].points ? 'ok' : 'info');
    box.innerHTML = `<strong>${r.score}/${ex.tasks[i].points} pont</strong><pre>${esc(r.details.join('\n'))}</pre>`;
    body.querySelector(`[data-code="${ex.id}-${i}"]`).disabled = true;
  }

  const max = ex.tasks.reduce((a, t) => a + t.points, 0);
  store.saveExamResult(ex.id, {
    score: total,
    maxScore: max,
    taskResults,
    durationSeconds: Math.max(0, Math.round((Date.now() - Number(body.dataset.started)) / 1000))
  });
  store.clearExamSession(ex.id);
  store.clearExamDrafts(ex.id);
  button.textContent = `Eredmény: ${total}/${max} pont`;
  tracker.record('successfulChecks');
  tracker.flush().catch(() => {});
  renderAfterSubmit(ex.id, total, max);
}

function renderAfterSubmit(id, total, max) {
  const card = document.querySelector(`[data-exam="${id}"]`);
  const h = document.createElement('div');
  h.className = 'feedback ok';
  h.innerHTML = `<strong>Részvizsga eredménye: ${total}/${max} pont (${Math.round(total / max * 100)}%)</strong><br>Az eredmény a Haladás oldalon is megjelenik.`;
  card.appendChild(h);
}

async function boot() {
  render();
  runner.onStatus = s => {
    ready = s === 'ready';
    $('runtimeStatus').textContent = ready ? 'Python kész ✓' : s === 'loading' ? 'Python betöltése…' : 'Python újraindítása…';
    $('runtimeStatus').className = 'runtime ' + (ready ? 'ready' : 'loading');
  };
  await runner.start();

  const p = store.getCurrentProfile();
  const code = sessionStorage.getItem(CLASS_CODE_KEY) || '';
  if (p && code) {
    try { await tracker.join(code, p.displayName); tracker.flush().catch(() => {}); } catch {}
  }

  const active = exams.find(ex => activeSession(ex.id));
  if (active) startExam(active.id);
}

boot().catch(e => {
  $('runtimeStatus').textContent = 'Python hiba';
  console.error(e);
});
