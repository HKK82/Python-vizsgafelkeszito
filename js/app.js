import { lessons, totalTasks, flattenTasks } from './lessons.js';
import { ProgressStore, getStoredApiKey, storeApiKey, clearApiKey, isApiKeyRemembered } from './storage.js';
import { PythonRunner } from './python-runner.js';
import { GeminiTutor } from './ai.js';
import { ActivityTracker } from './activity.js';
import { cloudConfigured } from './firebase-service.js';

const items = flattenTasks();
const store = new ProgressStore();
store.setTaskOrder(items.map(x => x.key));

const runner = new PythonRunner({ timeoutMs: 5000 });
const tutor = new GeminiTutor({ getApiKey: () => aiEnabled ? getStoredApiKey() : '', cooldownMs: 8000 });

const $ = id => document.getElementById(id);
let currentIndex = 0;
let busy = false;
let pythonReady = false;
let lastDiagnostic = '';
let draftTimer = null;
let aiEnabled = false;
let lastAiAnswer = '';
const CLASS_CODE_KEY = 'python_exam_trainer_class_code_v3';

const tracker = new ActivityTracker({
  getProgressSnapshot: () => {
    const item = currentItem();
    return {
      currentLessonId: item?.lesson?.id || 0,
      currentLessonTitle: item?.lesson?.title || '',
      currentTaskNumber: (item?.taskIndex ?? 0) + 1,
      currentTaskKey: item?.key || '',
      completedTasks: store.completedCount(),
      totalTasks,
      progressPct: progressPercent(),
      frontier: store.getFrontier(totalTasks),
      currentAttempts: store.getAttempts(item?.key || '')
    };
  }
});

function htmlToText(html) {
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}

function currentItem() {
  return items[currentIndex];
}

function setBusy(value, label = '') {
  busy = value;
  const disabled = value || !pythonReady;
  $('runBtn').disabled = disabled;
  $('checkBtn').disabled = disabled;
  $('nextBtn').disabled = value;
  $('checkBtn').textContent = value ? (label || 'Ellenőrzés…') : '✓ Ellenőrzés';
}

function updatePythonStatus(state) {
  if (state === 'loading') {
    pythonReady = false;
    $('runtimeStatus').textContent = 'Python betöltése…';
    $('runtimeStatus').className = 'runtime loading';
  } else if (state === 'ready') {
    pythonReady = true;
    $('runtimeStatus').textContent = 'Python kész ✓';
    $('runtimeStatus').className = 'runtime ready';
  } else if (state === 'timeout') {
    pythonReady = false;
    $('runtimeStatus').textContent = 'Python újraindítása…';
    $('runtimeStatus').className = 'runtime loading';
  } else {
    pythonReady = false;
    $('runtimeStatus').textContent = 'Python hiba';
    $('runtimeStatus').className = 'runtime error';
  }
  setBusy(busy);
}
runner.onStatus = updatePythonStatus;

function addTeacherMessage(text, kind = 'bot') {
  const div = document.createElement('div');
  div.className = `msg ${kind}`;
  div.textContent = text;
  $('messages').appendChild(div);
  div.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return div;
}

function showFeedback(kind, html) {
  const box = $('feedback');
  box.className = `feedback ${kind}`;
  box.innerHTML = html;
}

function clearFeedback() {
  $('feedback').className = 'feedback hidden';
  $('feedback').innerHTML = '';
}

function progressPercent() {
  if (!totalTasks) return 0;
  return Math.max(0, Math.min(100, Math.round((store.completedCount() / totalTasks) * 100)));
}

function lessonTaskIndices(lessonIndex) {
  return items.map((x, i) => x.lessonIndex === lessonIndex ? i : -1).filter(i => i >= 0);
}

function isLessonDone(lessonIndex) {
  return lessonTaskIndices(lessonIndex).every(i => store.isCompleted(items[i].key));
}

function isLessonUnlocked(lessonIndex) {
  const indices = lessonTaskIndices(lessonIndex);
  const frontier = store.getFrontier(totalTasks);
  return indices.some(i => i <= frontier || store.isCompleted(items[i].key));
}

function updateCloudStatus(status = {}) {
  const el = $('cloudStatus');
  if (!el) return;
  if (!cloudConfigured()) {
    el.textContent = 'Óra: Firebase nincs beállítva';
    el.className = 'runtime loading';
    return;
  }
  if (status.connected) {
    el.textContent = `Óra: ${status.code} ✓`;
    el.className = 'runtime ready';
  } else if (status.error) {
    el.textContent = `Óra: ${status.error}`;
    el.className = 'runtime error';
  } else {
    el.textContent = 'Óra: helyi mód';
    el.className = 'runtime';
  }
}
tracker.onStatus = updateCloudStatus;

function renderSidebar() {
  $('studentLabel').textContent = store.getCurrentStudentName() || 'Tanuló';
  $('progressBar').style.width = `${progressPercent()}%`;
  $('progressText').textContent = `${store.completedCount()} / ${totalTasks} feladat kész`;
  const list = $('lessonList');
  list.innerHTML = '';
  lessons.forEach((lesson, lessonIndex) => {
    const done = isLessonDone(lessonIndex);
    const unlocked = isLessonUnlocked(lessonIndex);
    const active = currentItem()?.lessonIndex === lessonIndex;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `lessonRow ${done ? 'done' : ''} ${active ? 'active' : ''} ${!unlocked ? 'locked' : ''}`;
    row.disabled = !unlocked;
    row.innerHTML = `<span class="lessonNum">${done ? '✓' : lesson.id}</span><span>${escapeHtml(lesson.title)}</span>`;
    row.onclick = () => {
      if (!unlocked) return;
      const indices = lessonTaskIndices(lessonIndex);
      const firstIncomplete = indices.find(i => !store.isCompleted(items[i].key) && i <= store.getFrontier(totalTasks));
      navigateTo(firstIncomplete ?? indices[0]);
    };
    list.appendChild(row);
  });
}

function renderTask() {
  const { lesson, task, key, taskIndex } = currentItem();
  renderSidebar();
  $('lessonBadge').textContent = `${lesson.id}. lecke`;
  $('lessonTitle').textContent = lesson.title;
  $('lessonObjective').textContent = lesson.objective;
  $('lessonExplain').innerHTML = lesson.explain;
  $('taskCounter').textContent = `Feladat ${taskIndex + 1}/${lesson.tasks.length}`;
  $('taskText').innerHTML = task.text;
  $('codeEditor').value = store.getDraft(key, task.starter || '');
  $('stdinBox').value = '';
  $('output').textContent = pythonReady ? 'Futtatásra kész.' : 'A Python környezet betöltése folyamatban…';
  $('inputEcho').textContent = '';
  $('inputEchoWrap').classList.add('hidden');
  clearFeedback();
  lastDiagnostic = '';

  const attempts = store.getAttempts(key);
  $('attemptText').textContent = attempts ? `${attempts} sikertelen ellenőrzés` : 'Még nincs sikertelen ellenőrzés';
  $('solutionBtn').disabled = attempts < 3;
  $('solutionBtn').title = attempts < 3 ? '3 sikertelen próbálkozás után válik elérhetővé.' : 'Mintamegoldás megtekintése';
  $('solutionPanel').classList.add('hidden');
  $('solutionCode').textContent = task.solution || '';

  const completed = store.isCompleted(key);
  $('completedBadge').classList.toggle('hidden', !completed);
  $('nextBtn').classList.toggle('hidden', !completed);
  $('nextBtn').textContent = currentIndex >= items.length - 1 ? 'Alapmodul kész ✓' : 'Következő feladat →';
  $('prevBtn').disabled = currentIndex === 0;

  $('messages').innerHTML = '';
  addTeacherMessage(`Most a(z) „${lesson.title}” témán dolgozunk. Először olvasd el, mi az új eszköz és mire használjuk, majd oldd meg a feladatot. A továbbhaladást a programtesztek döntik el.`);
  store.setLastViewed(currentIndex);
  tracker.record('activity');
  tracker.flush().catch(() => {});
  setBusy(false);
}

function navigateTo(index) {
  const frontier = store.getFrontier(totalTasks);
  const safeIndex = Math.max(0, Math.min(index, items.length - 1));
  if (safeIndex > frontier && !store.isCompleted(items[safeIndex].key)) return;
  currentIndex = safeIndex;
  tracker.record('activity');
  renderTask();
}

function nextTask() {
  if (currentIndex >= items.length - 1) {
    showFeedback('ok', '<strong>🎉 Az alapozó modul elkészült.</strong><br>A következő modulban jönnek az algoritmusok, fájlkezelés, osztályok és vizsgaszimulációk.');
    return;
  }
  navigateTo(currentIndex + 1);
}

function previousTask() {
  if (currentIndex > 0) navigateTo(currentIndex - 1);
}

function checkRequirement(summary, requirement) {
  const min = requirement.min ?? 1;
  if (requirement.type === 'node') return (summary.nodes?.[requirement.name] || 0) >= min;
  if (requirement.type === 'call') return (summary.calls?.[requirement.name] || 0) >= min;
  if (requirement.type === 'op') return (summary.ops?.[requirement.name] || 0) >= min;
  if (requirement.type === 'rangeCondition') {
    const compareCount = Object.entries(summary.ops || {})
      .filter(([name]) => ['Lt','LtE','Gt','GtE','Eq','NotEq'].includes(name))
      .reduce((sum, [, count]) => sum + Number(count || 0), 0);
    return (summary.ops?.And || 0) >= 1 || compareCount >= 2;
  }
  if (requirement.type === 'listAdd') {
    return (summary.calls?.append || 0) >= min || (summary.ops?.Add || 0) >= min;
  }
  if (requirement.type === 'function') {
    const argc = summary.functions?.[requirement.name];
    return Number.isInteger(argc) && argc >= (requirement.minArgs ?? 0);
  }
  return true;
}

function requirementLabel(req) {
  if (req.type === 'call') return `${req.name}()`;
  if (req.type === 'function') return `${req.name}(...) függvény`;
  if (req.type === 'rangeCondition') return 'kétoldali tartományfeltétel';
  if (req.type === 'listAdd') return 'lista bővítése';
  const map = {
    Assign: 'értékadás/változó', If: 'if feltétel', List: 'lista', Subscript: 'listaindexelés',
    JoinedStr: 'f-string', For: 'for ciklus', While: 'while ciklus', Return: 'return',
    Add: 'összeadás (+)', Sub: 'kivonás (-)', Mult: 'szorzás (*)', Div: 'osztás (/)',
    Mod: 'maradékos osztás (%)', FloorDiv: 'egész osztás (//)', And: 'and', Or: 'or'
  };
  return map[req.name] || req.name;
}

function equalLines(actual, expected) {
  if (actual.length !== expected.length) return false;
  return actual.every((line, i) => line === String(expected[i]));
}

function formatError(error) {
  if (!error) return 'Ismeretlen Python-hiba.';
  const lineInfo = error.line ? ` a(z) ${error.line}. sorban` : '';
  const source = error.text ? `\nÉrintett sor: ${error.text}` : '';
  const friendly = {
    SyntaxError: 'Szintaktikai hiba: a Python nem tudja értelmezni a kód egyik részét.',
    IndentationError: 'Behúzási hiba: ellenőrizd a blokk elején és belsejében a szóközöket.',
    NameError: 'Névhiba: olyan változóra vagy névre hivatkozol, amely még nincs létrehozva.',
    ValueError: 'Értékhiba: az adat formátuma nem megfelelő az átalakításhoz vagy művelethez.',
    TypeError: 'Típushiba: egymással nem összeillő adattípusokat használsz egy műveletben.',
    EOFError: 'Elfogyott a megadott bemenet. Valószínűleg több input() fut, mint ahány tesztadat rendelkezésre áll.',
    MissingFunction: 'A kért függvény nem található vagy nem hívható.'
  };
  return `${friendly[error.type] || error.type}${lineInfo}\n${error.message || ''}${source}`.trim();
}

function formatTestDiagnostic(inputs, expectedLines, actualLines) {
  const inputText = inputs.length ? inputs.join(' | ') : '(nincs bemenet)';
  const expected = expectedLines.length ? expectedLines.join('\n') : '(nincs kimenet)';
  const actual = actualLines.length ? actualLines.join('\n') : '(nincs kimenet)';
  return `Bemenet: ${inputText}\nVárt kimenet:\n${expected}\nKapott kimenet:\n${actual}`;
}

async function runManual() {
  if (busy || !pythonReady) return;
  tracker.record('runCount');
  const code = $('codeEditor').value;
  const inputs = $('stdinBox').value === '' ? [] : $('stdinBox').value.split(/\r?\n/);
  setBusy(true, 'Futtatás…');
  $('output').textContent = 'Fut…';
  try {
    const result = await runner.execute(code, inputs);
    if (inputs.length) {
      $('inputEchoWrap').classList.remove('hidden');
      $('inputEcho').textContent = result.inputsUsed?.join('\n') || inputs.join('\n');
    } else {
      $('inputEchoWrap').classList.add('hidden');
    }
    if (!result.ok) {
      $('output').textContent = result.stdoutLines?.join('\n') || '(nincs kimenet)';
      showFeedback('bad', `<strong>A program hibával leállt.</strong><pre>${escapeHtml(formatError(result.error))}</pre>`);
    } else {
      $('output').textContent = result.stdoutLines?.join('\n') || '(nincs kimenet)';
      showFeedback('info', 'A kézi futtatás befejeződött. Ha késznek gondolod, kattints az <strong>Ellenőrzés</strong> gombra.');
    }
  } catch (err) {
    handleRunnerException(err);
  } finally {
    setBusy(false);
  }
}

function failedAttempt(message, diagnostic = '') {
  const { key } = currentItem();
  const attempts = store.incrementAttempt(key);
  $('attemptText').textContent = `${attempts} sikertelen ellenőrzés`;
  $('solutionBtn').disabled = attempts < 3;
  lastDiagnostic = diagnostic || message;
  showFeedback('bad', message);
  tracker.flush().catch(() => {});
}

async function checkTask() {
  if (busy || !pythonReady) return;
  tracker.record('checkCount');
  const { task, key } = currentItem();
  const code = $('codeEditor').value;
  store.saveDraft(key, code);
  if (!code.trim()) {
    showFeedback('bad', 'Még nincs kód. Írj egy megoldást, majd ellenőrizd.');
    return;
  }

  setBusy(true, 'Ellenőrzés…');
  try {
    const analysis = await runner.analyze(code);
    if (!analysis.ok) {
      failedAttempt(`<strong>A kód szintaktikailag még nem futtatható.</strong><pre>${escapeHtml(formatError(analysis.error))}</pre>`, formatError(analysis.error));
      return;
    }
    const missing = (task.checks || []).filter(req => !checkRequirement(analysis.summary, req));
    if (missing.length) {
      const labels = missing.map(requirementLabel).join(', ');
      failedAttempt(`<strong>A feladat működésén túl ezt az eszközt is gyakoroljuk:</strong> ${escapeHtml(labels)}.<br>A kódodban ezt még nem találom megfelelően.`, `Hiányzó tanult elem: ${labels}`);
      return;
    }

    for (const test of task.tests || []) {
      const result = await runner.execute(code, test.inputs || []);
      if (!result.ok) {
        const diagnostic = formatError(result.error);
        failedAttempt(`<strong>A program hibával leállt.</strong><pre>${escapeHtml(diagnostic)}</pre>`, diagnostic);
        return;
      }
      if (!equalLines(result.stdoutLines || [], test.expectedLines || [])) {
        const diagnostic = formatTestDiagnostic(test.inputs || [], test.expectedLines || [], result.stdoutLines || []);
        failedAttempt(`<strong>A program lefutott, de a kimenet nem egyezik a feladattal.</strong><pre>${escapeHtml(diagnostic)}</pre>`, diagnostic);
        return;
      }
    }

    for (const test of task.functionTests || []) {
      const result = await runner.functionTest(code, test.functionName, test.args || []);
      if (!result.ok) {
        const diagnostic = formatError(result.error);
        failedAttempt(`<strong>A függvényteszt hibát talált.</strong><pre>${escapeHtml(diagnostic)}</pre>`, diagnostic);
        return;
      }
      if (JSON.stringify(result.actual) !== JSON.stringify(test.expected)) {
        const diagnostic = `Függvény: ${test.functionName}(${(test.args || []).join(', ')})\nVárt visszatérési érték: ${JSON.stringify(test.expected)}\nKapott érték: ${JSON.stringify(result.actual)}`;
        failedAttempt(`<strong>A függvény visszatérési értéke még nem jó.</strong><pre>${escapeHtml(diagnostic)}</pre>`, diagnostic);
        return;
      }
    }

    store.markCompleted(key, currentIndex, totalTasks);
    tracker.record('successfulChecks');
    store.resetAttempt(key);
    lastDiagnostic = '';
    $('attemptText').textContent = 'Sikeres ✓';
    $('completedBadge').classList.remove('hidden');
    $('nextBtn').classList.remove('hidden');
    renderSidebar();
    const usedSolution = store.hasViewedSolution(key);
    showFeedback('ok', `<strong>✓ Helyes megoldás.</strong><br>${usedSolution ? 'A mintát már láttad, ezért a következő feladatnál próbáld teljesen önállóan.' : 'Működő kóddal bizonyítottad, hogy ezt a lépést érted.'}`);
    addTeacherMessage(usedSolution ? 'Sikerült. A következő feladat hasonló gondolkodást kér, de próbáld a mintamegoldás nélkül felépíteni.' : 'Nagyon jó. Nem csak azt mondtad, hogy érted: a programtesztek szerint működik a megoldásod. Mehetünk tovább.');
    tracker.flush().catch(() => {});
  } catch (err) {
    handleRunnerException(err);
  } finally {
    setBusy(false);
  }
}

function handleRunnerException(err) {
  if (err?.code === 'TIMEOUT' || err?.message === 'TIMEOUT') {
    const message = 'A program 5 másodpercnél tovább futott. Ez gyakran végtelen ciklust jelent. Ellenőrizd, hogy a while ciklusban változik-e a feltételhez tartozó változó. A Python környezetet automatikusan újraindítjuk.';
    lastDiagnostic = message;
    showFeedback('bad', `<strong>Időtúllépés.</strong><br>${escapeHtml(message)}`);
    addTeacherMessage('Valószínűleg végtelen ciklusba került a program. Nézd meg a while feltételét és azt, hogy a cikluson belül tényleg változik-e a vezérlő változó.');
  } else {
    showFeedback('bad', `<strong>Technikai hiba:</strong> ${escapeHtml(err?.message || String(err))}`);
  }
}

function localHint() {
  const { task, key } = currentItem();
  const attempts = store.getAttempts(key);
  const hints = task.hints || [];
  const index = Math.min(Math.max(attempts - 1, 0), hints.length - 1);
  const hint = hints[index] || 'Bontsd fel a feladatot: milyen adat kell, mit kell vele csinálni, és mit kell kiírni?';
  tracker.record('localHints');
  addTeacherMessage(`💡 ${htmlToText(hint)}`);
  tracker.flush().catch(() => {});
}

function showSolution() {
  const { task, key } = currentItem();
  const attempts = store.getAttempts(key);
  if (attempts < 3) return;
  store.markSolutionViewed(key);
  $('solutionCode').textContent = task.solution || 'Ehhez a feladathoz még nincs rögzített mintamegoldás.';
  $('solutionPanel').classList.remove('hidden');
  addTeacherMessage('Megmutatom a mintamegoldást. Ne másold le gondolkodás nélkül: nézd meg soronként, melyik rész mit old meg. Utána ugyanennek a gondolatnak egy új változata következik.');
}

function saveDraftSoon() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    const { key } = currentItem();
    store.saveDraft(key, $('codeEditor').value);
  }, 250);
}

function setupEditorBehavior() {
  const editor = $('codeEditor');
  editor.addEventListener('input', () => { tracker.record('activity'); saveDraftSoon(); });
  editor.addEventListener('keydown', event => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      editor.setRangeText('    ', start, end, 'end');
      saveDraftSoon();
      return;
    }
    if (event.key === 'Enter') {
      const start = editor.selectionStart;
      const before = editor.value.slice(0, start);
      const line = before.split('\n').pop() || '';
      const indent = (line.match(/^\s*/) || [''])[0];
      const extra = line.trimEnd().endsWith(':') ? '    ' : '';
      if (indent || extra) {
        event.preventDefault();
        editor.setRangeText(`\n${indent}${extra}`, start, editor.selectionEnd, 'end');
        saveDraftSoon();
      }
    }
  });
}

async function askAi(question, activityType = 'aiQuestions') {
  const key = aiEnabled ? getStoredApiKey() : '';
  if (!key) {
    addTeacherMessage('Az AI-segítséghez add meg a saját Gemini API-kulcsodat a 🔑 API-kulcs gombbal. A helyi Python-futtatás és ellenőrzés AI nélkül is működik.');
    return;
  }
  const { lesson, task, key: taskKey } = currentItem();
  tracker.record(activityType);
  const placeholder = addTeacherMessage('Gondolkodom…');
  try {
    const result = await tutor.ask({
      question,
      lessonTitle: lesson.title,
      objective: lesson.objective,
      explanationText: htmlToText(lesson.explain),
      attempts: store.getAttempts(taskKey),
      solutionAllowed: store.getAttempts(taskKey) >= 3,
      taskText: htmlToText(task.text),
      expectedExamples: (task.tests || []).slice(0, 2).map(t => ({ inputs: t.inputs || [], expectedLines: t.expectedLines || [] })),
      helpLevel: Math.min(5, Math.max(1, store.getAttempts(taskKey) + 1)),
      code: $('codeEditor').value,
      diagnostic: lastDiagnostic
    });
    placeholder.textContent = result.text;
    lastAiAnswer = result.text;
    $('saveAiNoteBtn').disabled = false;
    $('aiModelStatus').textContent = `AI: ${result.model}`;
    tracker.flush().catch(() => {});
  } catch (err) {
    placeholder.textContent = `AI-hiba: ${err?.message || err}. A Python-futtató és a feladatellenőrző ettől még működik.`;
  }
}

function openSetup({ newStudent = false } = {}) {
  if (newStudent) {
    tracker.leave().catch(() => {});
    clearApiKey();
    store.clearCurrentSelection();
    $('studentName').value = '';
    $('apiKeyInput').value = '';
    $('rememberKey').checked = false;
    $('classCodeInput').value = sessionStorage.getItem(CLASS_CODE_KEY) || '';
  } else {
    $('studentName').value = store.getCurrentStudentName() || '';
    $('apiKeyInput').value = getStoredApiKey();
    $('rememberKey').checked = isApiKeyRemembered();
    $('classCodeInput').value = sessionStorage.getItem(CLASS_CODE_KEY) || '';
  }
  const profiles = store.listProfiles();
  $('profileList').innerHTML = profiles.length
    ? profiles.map(p => `<button type="button" class="profileChip" data-name="${escapeHtml(p.displayName)}">${escapeHtml(p.displayName)}</button>`).join('')
    : '<span class="tiny">Még nincs mentett tanulói profil ezen a böngészőn.</span>';
  $('profileList').querySelectorAll('[data-name]').forEach(btn => {
    btn.onclick = () => { $('studentName').value = btn.dataset.name; };
  });
  $('setupOverlay').classList.remove('hidden');
}

async function begin(useAi) {
  const name = $('studentName').value.trim();
  if (!name) {
    alert('Adj meg egy nevet vagy azonosítót.');
    return;
  }
  store.setCurrentStudent(name);
  aiEnabled = !!useAi;
  if (useAi) {
    const key = $('apiKeyInput').value.trim();
    if (!key) {
      alert('Adj meg API-kulcsot, vagy válaszd az AI nélküli indítást.');
      return;
    }
    storeApiKey(key, $('rememberKey').checked);
  }

  const classCode = $('classCodeInput').value.trim().toUpperCase();
  if (classCode) {
    sessionStorage.setItem(CLASS_CODE_KEY, classCode);
    updateCloudStatus({ error: 'kapcsolódás…' });
    try {
      const joined = await tracker.join(classCode, name);
      if (!joined.connected) updateCloudStatus({ error: joined.reason || 'nem kapcsolódott' });
    } catch (err) {
      updateCloudStatus({ error: 'sikertelen' });
      const proceed = confirm(`Nem sikerült csatlakozni az órához: ${err?.message || err}\n\nFolytatod helyi módban?`);
      if (!proceed) return;
    }
  } else {
    sessionStorage.removeItem(CLASS_CODE_KEY);
    updateCloudStatus();
  }

  $('setupOverlay').classList.add('hidden');
  tutor.clearHistory();
  lastAiAnswer = '';
  $('saveAiNoteBtn').disabled = true;
  const frontier = store.getFrontier(totalTasks);
  const last = store.getLastViewed();
  currentIndex = Math.min(last, frontier >= totalTasks ? totalTasks - 1 : frontier);
  renderTask();
  tracker.flush().catch(() => {});
}

function exportProgress() {
  const data = store.exportCurrent();
  if (!data) return;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (data.profile.displayName || 'tanulo').replace(/[^a-zA-Z0-9áéíóöőúüűÁÉÍÓÖŐÚÜŰ_-]+/g, '_');
  a.download = `python-haladas-${safeName}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importProgress(file) {
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    const profile = store.importProfile(payload);
    $('setupOverlay').classList.add('hidden');
    currentIndex = Math.min(profile.lastViewed || 0, store.getFrontier(totalTasks));
    renderTask();
    addTeacherMessage('A mentett haladást sikeresen betöltöttük.');
  } catch (err) {
    alert(`Nem sikerült betölteni a haladást: ${err?.message || err}`);
  }
}

function bootUi() {
  setupEditorBehavior();
  $('runBtn').onclick = runManual;
  $('checkBtn').onclick = checkTask;
  $('hintBtn').onclick = localHint;
  $('solutionBtn').onclick = showSolution;
  $('nextBtn').onclick = nextTask;
  $('prevBtn').onclick = previousTask;
  $('aiExplainBtn').onclick = () => askAi('Magyarázd el másképp az aktuális új Python-fogalmat, nagyon egyszerű példával. Az aktuális feladat kész megoldását ne add meg, ha még nem engedélyezett.', 'aiQuestions');
  $('aiHintBtn').onclick = () => askAi('Adj egy rövid, célzott rávezető tippet az aktuális feladathoz. Ne ugorj előre a tananyagban.', 'aiHints');
  $('sendBtn').onclick = () => {
    const q = $('chatInput').value.trim();
    if (!q) return;
    $('chatInput').value = '';
    addTeacherMessage(q, 'user');
    askAi(q, 'aiQuestions');
  };
  $('saveAiNoteBtn').onclick = () => {
    if (!lastAiAnswer) return;
    const { lesson } = currentItem();
    store.appendSavedExplanation(lesson.id, lastAiAnswer);
    addTeacherMessage('📝 Az utolsó AI-magyarázatot elmentettem a Jegyzet oldalra.');
  };
  $('clearChatBtn').onclick = () => {
    tutor.clearHistory();
    lastAiAnswer = '';
    $('saveAiNoteBtn').disabled = true;
    $('messages').innerHTML = '';
    addTeacherMessage('Az AI-beszélgetést töröltük. A feladatod és a haladásod megmaradt.');
  };
  $('apiBtn').onclick = () => openSetup();
  $('newStudentBtn').onclick = () => openSetup({ newStudent: true });
  $('startBtn').onclick = () => begin(true);
  $('startNoAiBtn').onclick = () => begin(false);
  $('clearKeyBtn').onclick = () => {
    clearApiKey();
    $('apiKeyInput').value = '';
    $('rememberKey').checked = false;
    alert('Az alkalmazás által tárolt API-kulcsot töröltük erről a böngészőről.');
  };
  $('resetProgressBtn').onclick = () => {
    if (!store.getCurrentProfile()) return;
    if (confirm('Biztosan törlöd az aktuális tanuló teljes helyi haladását és piszkozatait?')) {
      store.resetCurrentProgress();
      currentIndex = 0;
      renderTask();
    }
  };
  $('exportBtn').onclick = exportProgress;
  $('importBtn').onclick = () => $('importFile').click();
  $('importFile').onchange = e => {
    const file = e.target.files?.[0];
    if (file) importProgress(file);
    e.target.value = '';
  };
}

async function boot() {
  bootUi();
  updateCloudStatus();
  updatePythonStatus('loading');
  openSetup();
  try {
    await runner.start();
    updatePythonStatus('ready');
  } catch (err) {
    updatePythonStatus('error');
    showFeedback('bad', `Nem sikerült betölteni a Python környezetet: ${escapeHtml(err?.message || err)}`);
  }
}

boot();
