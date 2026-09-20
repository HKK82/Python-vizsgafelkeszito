import { exams } from './exams.js';
import { flattenTasks, totalTasks } from './lessons.js';
import { ProgressStore, getStoredApiKey } from './storage.js';
import { PythonRunner } from './python-runner.js';
import { ActivityTracker } from './activity.js';
import { checkpointById } from './checkpoints.js';
import { logStudentExamAttempt } from './firebase-service.js';
import { GeminiTutor } from './ai.js';

const $ = id => document.getElementById(id);
const store = new ProgressStore();
const baseItems = flattenTasks();
store.setTaskOrder(baseItems.map(x => x.key));
const runner = new PythonRunner({ timeoutMs: 5000 });
const reviewTutor = new GeminiTutor({ getApiKey: () => getStoredApiKey(), cooldownMs: 6000 });
const reviewContexts = new Map();
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

function commonExamDiagnostics(code, task, analysis) {
  const messages = [];
  const text = String(code || '');

  if (/^\s*input\s*=/m.test(text)) {
    messages.push('Az <code>input</code> a Python beépített bekérő függvényének neve. Ne használd változónévként. Helyette például <code>szam1 = ...</code> jellegű változónevet használj.');
  }

  if (/\b(?:int|float)\s*\(\s*["'][^"'\n]*[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű][^"'\n]*["']\s*\)/.test(text)) {
    messages.push('Az <code>int()</code>/<code>float()</code> itt egy feliratot próbál számmá alakítani. Bekérésnél a helyes gondolat: előbb <code>input(...)</code>, majd annak eredményét alakítjuk számmá.');
  }

  const requiredInputs = Math.max(0, ...(task.checks || [])
    .filter(r => r.type === 'call' && r.name === 'input')
    .map(r => Number(r.min || 1)));
  const actualInputs = Number(analysis?.summary?.calls?.input || 0);
  if (requiredInputs && actualInputs < requiredInputs) {
    messages.push(`A feladat legalább ${requiredInputs} darab <code>input()</code> hívást kér, a kódban most ${actualInputs} található.`);
  }

  const requiredPrints = Math.max(0, ...(task.checks || [])
    .filter(r => r.type === 'call' && r.name === 'print')
    .map(r => Number(r.min || 1)));
  const actualPrints = Number(analysis?.summary?.calls?.print || 0);
  if (requiredPrints && actualPrints < requiredPrints) {
    messages.push(`A feladat legalább ${requiredPrints} darab <code>print()</code> hívást kér, a kódban most ${actualPrints} található.`);
  }

  return messages;
}

function renderDiagnosticList(messages) {
  if (!messages?.length) return '';
  return `<div class="examDiagnosis"><strong>🔎 Mi a gond?</strong><ul>${messages.map(m => `<li>${m}</li>`).join('')}</ul></div>`;
}

async function explainExamTaskWithAi(examId, taskIndex, button) {
  const ctx = reviewContexts.get(`${examId}:${taskIndex}`);
  if (!ctx) return;
  if (!getStoredApiKey()) {
    alert('Az AI-magyarázathoz előbb add meg a Gemini API-kulcsodat a Tanulás oldalon.');
    return;
  }

  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'AI gondolkodik…';
  const target = document.querySelector(`[data-ai-answer="${examId}-${taskIndex}"]`);
  try {
    const result = await reviewTutor.ask({
      question: 'A vizsga már lezárult. Magyarázd el nagyon egyszerűen, konkrétan és lépésenként, mi volt a hibám ebben a feladatban. Ne csak a hibanevet mondd meg: mondd el, mit jelent és mi legyen a következő javítási lépés. A teljes kész megoldást ne írd le.',
      lessonTitle: 'Vizsga utáni hibajavítás',
      objective: 'A tanuló értse meg a hibát és önállóan tudja kijavítani.',
      explanationText: '',
      attempts: 1,
      solutionAllowed: false,
      taskText: ctx.task.text,
      expectedExamples: [],
      helpLevel: 3,
      code: ctx.code,
      diagnostic: ctx.diagnostics.join('\n')
    });
    target.className = 'examAiAnswer';
    target.textContent = result.text;
    const lessonId = ctx.task.lessonIds?.[0];
    if (lessonId) store.appendSavedExplanation(lessonId, `Vizsga utáni AI-magyarázat – ${ctx.task.title}:\n${result.text}`);
  } catch (err) {
    target.className = 'examAiAnswer bad';
    target.textContent = `AI-hiba: ${err?.message || err}`;
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function examKindLabel(ex) {
  if (ex.checkpoint) return 'kisvizsga';
  if (ex.examMode) return 'vizsgaszimulacio';
  return 'reszvizsga';
}

async function logExamSubmission(ex, result) {
  if (!tracker.classCode || !tracker.uid) return;
  try {
    await logStudentExamAttempt(tracker.classCode, tracker.uid, {
      examId: ex.id,
      examTitle: ex.title,
      examKind: examKindLabel(ex),
      ...result
    });
  } catch (err) {
    // A vizsga pontozását soha ne törje el egy naplózási/RULES hiba.
    console.warn('A vizsgapróbálkozás Firebase-naplózása nem sikerült:', err);
  }
}

function activeSession(examId) {
  const s = store.getExamSession(examId);
  return s && Number(s.endAt) > 0 && !s.submitted ? s : null;
}

function checkpointReadiness(ex) {
  if (!ex.checkpoint) return { allowed: true, reason: '' };
  const cp = checkpointById(ex.checkpointId || ex.id);
  if (!cp) return { allowed: true, reason: '' };

  // Első próbán a blokk minden leckéjének önálló (3/3) feladata legyen kész.
  const baseKeys = cp.lessonIds.map(id => `${id}.3`);
  const missingBase = baseKeys.filter(key => !store.isCompleted(key));
  const state = store.getCheckpoint(cp.id);
  const reviewKeys = state?.reviewTaskKeys || [];
  const missingReview = reviewKeys.filter(key => !store.isCompleted(key));

  if (missingReview.length) {
    return {
      allowed: false,
      reason: `Előbb teljesítsd a célzott újragyakorlást: ${missingReview.join(', ')}. Mindegyikből 2 egymást követő önálló siker kell.`
    };
  }
  if (!state?.passed && missingBase.length) {
    return {
      allowed: false,
      reason: `A kisvizsga előtt fejezd be a blokk önálló feladatait: ${missingBase.join(', ')}.`
    };
  }
  return { allowed: true, reason: '' };
}

function checkpointStateLabel(ex) {
  if (!ex.checkpoint) return '';
  const state = store.getCheckpoint(ex.checkpointId || ex.id);
  if (state?.passed) return '<span class="badge done">✓ TELJESÍTVE</span>';
  if (state?.reviewTaskKeys?.length) return '<span class="badge">↻ ÚJRAGYAKORLÁS</span>';
  return '<span class="examModeTag">KISVIZSGA</span>';
}

function reviewLessonIdsFromResults(ex, taskResults) {
  const threshold = Number(ex.minTaskPct ?? 60) / 100;
  let weakIndexes = taskResults
    .map((r, i) => ({ i, ratio: r.maxScore ? r.score / r.maxScore : 0 }))
    .filter(x => x.ratio < threshold)
    .map(x => x.i);

  if (!weakIndexes.length) {
    const minRatio = Math.min(...taskResults.map(r => r.maxScore ? r.score / r.maxScore : 0));
    weakIndexes = taskResults
      .map((r, i) => ({ i, ratio: r.maxScore ? r.score / r.maxScore : 0 }))
      .filter(x => x.ratio === minRatio)
      .map(x => x.i);
  }

  return [...new Set(weakIndexes.flatMap(i => ex.tasks[i]?.lessonIds || []))];
}

function render() {
  const p = store.getCurrentProfile();
  $('examList').innerHTML = exams.map(ex => {
    const last = store.getExamResults(ex.id).slice(-1)[0];
    const active = activeSession(ex.id);
    const readiness = checkpointReadiness(ex);
    const disabled = !p || !readiness.allowed;
    const startLabel = active
      ? (ex.checkpoint ? 'Kisvizsga folytatása' : 'Részvizsga folytatása')
      : (ex.checkpoint ? 'Kisvizsga indítása' : 'Részvizsga indítása');
    return `<section class="card examCard" data-exam="${ex.id}">
      <div class="teacherHero"><div><h2>${esc(ex.title)}</h2><p class="muted">${esc(ex.description)}</p></div>
      <div><span class="badge">${ex.durationMinutes} perc</span>${checkpointStateLabel(ex)}${ex.examMode ? '<span class="examModeTag">VIZSGASZIMULÁCIÓ</span>' : ''}${last ? `<div class="tiny">Legutóbb: ${last.score}/${last.maxScore} pont</div>` : ''}</div></div>
      ${readiness.reason ? `<div class="feedback info"><strong>Most még nem indítható.</strong><br>${esc(readiness.reason)}</div>` : ''}
      <button class="primary" data-start="${ex.id}" ${disabled ? 'disabled' : ''}>${startLabel}</button>
      <div class="examBody hidden" data-body="${ex.id}"></div>
    </section>`;
  }).join('');
  document.querySelectorAll('[data-start]').forEach(b => b.onclick = () => {
    if (!b.disabled) startExam(b.dataset.start);
  });
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
  const readiness = checkpointReadiness(ex);
  if (!readiness.allowed) {
    body.classList.remove('hidden');
    body.innerHTML = `<div class="feedback info"><strong>Célzott gyakorlás szükséges.</strong><br>${esc(readiness.reason)}<br><br><a class="buttonLike" href="./index.html">Vissza a Tanuláshoz</a></div>`;
    return;
  }
  body.classList.remove('hidden');
  body.classList.remove('submitted');

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
  const diagnostics = [];
  const analysis = await runner.analyze(code);
  if (!analysis.ok) {
    const msg = `A kód nem elemezhető: ${formatError(analysis.error)}`;
    return { score: 0, details: [msg], diagnostics: [msg] };
  }

  diagnostics.push(...commonExamDiagnostics(code, task, analysis));

  for (const r of task.checks || []) {
    if (checkReq(analysis.summary, r)) {
      score += r.points;
      details.push(`✓ ${r.label}: +${r.points}`);
    } else {
      details.push(`✗ ${r.label}: 0/${r.points}`);
      diagnostics.push(`Hiányzik vagy nem megfelelő: ${r.label}.`);
    }
  }

  let firstRuntimeDiagnosticAdded = false;
  for (const t of task.tests || []) {
    const res = await runner.execute(code, t.inputs || []);
    if (res.ok && equalLines(res.stdoutLines || [], t.expectedLines || [])) {
      score += t.points;
      details.push(`✓ Rejtett futási teszt: +${t.points}`);
    } else {
      details.push(`✗ Rejtett futási teszt: 0/${t.points}`);
      if (!firstRuntimeDiagnosticAdded) {
        if (!res.ok) {
          diagnostics.push(`Futtatás közben hiba történt: ${formatError(res.error)}`);
        } else {
          const actual = (res.stdoutLines || []).join(' | ') || '(nincs kimenet)';
          const expected = (t.expectedLines || []).join(' | ') || '(nincs kimenet)';
          diagnostics.push(`A program lefutott, de a kimenet nem jó. Várt: ${expected}. Kapott: ${actual}.`);
        }
        firstRuntimeDiagnosticAdded = true;
      }
    }
  }

  for (const t of task.fileTests || []) {
    const readFiles = t.readFiles || Object.keys(t.expectedFiles || {});
    const res = await runner.executeWithFiles(code, t.inputs || [], t.files || {}, readFiles);
    const stdoutOk = res.ok && equalLines(res.stdoutLines || [], t.expectedLines || []);
    const filesOk = Object.entries(t.expectedFiles || {}).every(([name, expected]) => {
      const actual = res.files?.[name];
      return String(actual ?? '').replace(/\r\n/g, '\n') === String(expected).replace(/\r\n/g, '\n');
    });
    if (stdoutOk && filesOk) {
      score += t.points;
      details.push(`✓ Fájlteszt: +${t.points}`);
    } else {
      details.push(`✗ Fájlteszt: 0/${t.points}`);
      if (!res.ok) diagnostics.push(`A fájlos futtatás hibával leállt: ${formatError(res.error)}`);
      else diagnostics.push('A létrehozott fájl vagy a kiírt eredmény tartalma nem egyezik a feladattal.');
    }
  }

  for (const t of task.functionTests || []) {
    const res = await runner.functionTest(code, t.functionName, t.args || []);
    if (res.ok && JSON.stringify(res.actual) === JSON.stringify(t.expected)) {
      score += t.points;
      details.push(`✓ Függvényteszt ${t.functionName}(${(t.args || []).join(', ')}): +${t.points}`);
    } else {
      details.push(`✗ Függvényteszt ${t.functionName}(...): 0/${t.points}`);
      if (!res.ok) diagnostics.push(`A(z) ${t.functionName}() függvény futtatási hibát adott: ${formatError(res.error)}`);
      else diagnostics.push(`A(z) ${t.functionName}() visszatérési értéke nem megfelelő.`);
    }
  }

  return {
    score: Math.min(task.points, score),
    details,
    diagnostics: [...new Set(diagnostics)]
  };
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
    taskResults.push({ score: r.score, maxScore: ex.tasks[i].points, diagnostics: r.diagnostics || [] });
    const box = body.querySelector(`[data-result="${ex.id}-${i}"]`);
    const failed = r.score < ex.tasks[i].points;
    box.className = 'feedback ' + (failed ? 'info' : 'ok');
    reviewContexts.set(`${ex.id}:${i}`, {
      task: ex.tasks[i],
      code,
      diagnostics: r.diagnostics || []
    });
    const aiButton = failed
      ? `<button type="button" class="secondary examAiBtn" data-ai-review="${ex.id}-${i}">🤖 AI: magyarázd el, mi volt a gond</button><div class="hidden" data-ai-answer="${ex.id}-${i}"></div>`
      : '';
    box.innerHTML = `<strong>${r.score}/${ex.tasks[i].points} pont</strong><pre>${esc(r.details.join('\n'))}</pre>${renderDiagnosticList(r.diagnostics || [])}${aiButton}`;
    body.querySelector(`[data-code="${ex.id}-${i}"]`).disabled = true;
    const aiBtn = box.querySelector('[data-ai-review]');
    if (aiBtn) aiBtn.onclick = () => explainExamTaskWithAi(ex.id, i, aiBtn);
  }

  const max = ex.tasks.reduce((a, t) => a + t.points, 0);
  const durationSeconds = Math.max(0, Math.round((Date.now() - Number(body.dataset.started)) / 1000));
  const pct = max ? Math.round(total / max * 100) : 0;
  const minTaskPct = Number(ex.minTaskPct ?? 0);
  const allTasksStrongEnough = !ex.checkpoint || taskResults.every(r =>
    r.maxScore > 0 && (r.score / r.maxScore * 100) >= minTaskPct
  );
  const checkpointPassed = !!ex.checkpoint && pct >= Number(ex.passPct ?? 80) && allTasksStrongEnough;

  store.saveExamResult(ex.id, {
    score: total,
    maxScore: max,
    taskResults,
    durationSeconds,
    passed: ex.checkpoint ? checkpointPassed : undefined
  });

  if (ex.checkpoint) {
    if (checkpointPassed) {
      store.saveCheckpointOutcome(ex.checkpointId || ex.id, {
        passed: true,
        score: total,
        maxScore: max,
        pct,
        reviewTaskKeys: [],
        passedAt: new Date().toISOString()
      });
    } else {
      const weakLessonIds = reviewLessonIdsFromResults(ex, taskResults);
      const reviewTaskKeys = weakLessonIds.map(id => `${id}.3`);
      store.requireCheckpointReview(ex.checkpointId || ex.id, reviewTaskKeys);
      store.saveCheckpointOutcome(ex.checkpointId || ex.id, {
        passed: false,
        score: total,
        maxScore: max,
        pct,
        weakLessonIds,
        reviewTaskKeys
      });
    }
  }
  await logExamSubmission(ex, {
    score: total,
    maxScore: max,
    pct,
    passed: ex.checkpoint ? checkpointPassed : undefined,
    durationSeconds,
    taskResults
  });

  store.clearExamSession(ex.id);
  store.clearExamDrafts(ex.id);
  button.textContent = `Eredmény: ${total}/${max} pont`;
  tracker.record('successfulChecks');
  tracker.flush().catch(() => {});
  renderAfterSubmit(ex, total, max, taskResults);
}

function renderAfterSubmit(ex, total, max, taskResults) {
  const card = document.querySelector(`[data-exam="${ex.id}"]`);
  const h = document.createElement('div');
  const pct = max ? Math.round(total / max * 100) : 0;

  if (!ex.checkpoint) {
    h.className = 'feedback ok';
    h.innerHTML = `<strong>Részvizsga eredménye: ${total}/${max} pont (${pct}%)</strong><br>Az eredmény a Haladás oldalon is megjelenik.`;
    card.appendChild(h);
    return;
  }

  const state = store.getCheckpoint(ex.checkpointId || ex.id);
  if (state?.passed) {
    h.className = 'feedback ok';
    h.innerHTML = `<strong>✓ Kisvizsga teljesítve: ${total}/${max} pont (${pct}%).</strong><br>Megnyílt a következő tananyagi blokk.<br><br><a class="buttonLike" href="./index.html">Folytatás a következő leckével →</a>`;
  } else {
    const weak = state?.weakLessonIds || [];
    const keys = state?.reviewTaskKeys || [];
    h.className = 'feedback bad';
    h.innerHTML = `<strong>A kisvizsga még nem teljesült: ${total}/${max} pont (${pct}%).</strong><br>
      A továbblépéshez legalább ${ex.passPct || 80}% kell, és minden feladatból legalább ${ex.minTaskPct || 60}%.<br>
      Célzottan újra kell gyakorolnod: <strong>${weak.length ? weak.map(x => x + '. lecke').join(', ') : 'a leggyengébb területet'}</strong>.<br>
      Az érintett 3/3 önálló feladat(ok)nál <strong>2 egymást követő siker</strong> szükséges. Ezután új kisvizsga következik.<br>
      <span class="tiny">Újranyitott feladatok: ${esc(keys.join(', '))}</span><br><br>
      <a class="buttonLike" href="./index.html">Vissza a célzott gyakorláshoz →</a>`;
  }
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
  if (active) {
    startExam(active.id);
    return;
  }

  const requested = new URLSearchParams(location.search).get('checkpoint');
  if (requested) {
    const ex = exams.find(x => x.id === requested && x.checkpoint);
    const card = ex ? document.querySelector(`[data-exam="${ex.id}"]`) : null;
    card?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    if (ex && checkpointReadiness(ex).allowed) startExam(ex.id);
  }
}

boot().catch(e => {
  $('runtimeStatus').textContent = 'Python hiba';
  console.error(e);
});
