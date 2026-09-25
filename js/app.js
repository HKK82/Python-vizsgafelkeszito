import { lessons, totalTasks, flattenTasks } from './lessons.js';
import { ProgressStore, getStoredApiKey, storeApiKey, clearApiKey, isApiKeyRemembered } from './storage.js';
import { PythonRunner } from './python-runner.js';
import { GeminiTutor } from './ai.js';
import { ActivityTracker } from './activity.js?v=20260923-sessionfix1';
import { cloudConfigured } from './firebase-service.js';
import { checkpointAfterLesson, checkpointRequiredBeforeLesson } from './checkpoints.js';
import { compareOutput, formatOutputWarnings } from './output-check.js?v=20260923-outputtol1';

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
const TEACHER_TEST_AUTH_KEY = 'python_teacher_test_authorized_until_v1';
const TEST_PROFILE_NAME = '🧪 Oktatói teszt';
const testRequested = new URLSearchParams(location.search).get('test') === '1';
const testAuthorizedUntil = Number(localStorage.getItem(TEACHER_TEST_AUTH_KEY) || 0);
const TEST_MODE = testRequested && testAuthorizedUntil > Date.now();
const RESUME_AFTER_EXAM = new URLSearchParams(location.search).get('resume') === '1';

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

function continuationIndex() {
  const frontier = store.repairFrontier(totalTasks);
  if (frontier >= totalTasks) return Math.max(0, totalTasks - 1);
  return Math.max(0, frontier);
}

function continuationLabel(index = continuationIndex()) {
  const item = items[Math.max(0, Math.min(index, items.length - 1))];
  if (!item) return '';
  return `${item.lesson.id}. lecke – ${item.taskIndex + 1}/${item.lesson.tasks.length}. feladat`;
}

function microCoachText(lessonId) {
  const tips = {
    1: '<strong>Jegyezd meg:</strong> ha konkrét szöveget írsz ki, idézőjel kell: <code>print("Szia")</code>.',
    2: '<strong>Nagyon fontos:</strong> a szöveg és a változó nem ugyanaz. <code>print("ram")</code> a „ram” szót írja ki, <code>print(ram)</code> pedig a <code>ram</code> változó értékét. A <code>ram = 16</code> azt jelenti, hogy a változó egyetlen számértéke 16 — nem 16 darab számot kell beírni.',
    3: '<strong>Jegyezd meg:</strong> egy <code>input()</code> egy bemeneti értéket kér. Az eredménye szöveg, amit általában változóba mentesz. A <strong>Futtatás</strong> gombnál te adod meg a saját próba-bemenetedet.',
    4: '<strong>Jegyezd meg:</strong> <code>input()</code> → szöveg. Számoláshoz alakítsd át: <code>int(...)</code> vagy <code>float(...)</code>.',
    5: '<strong>Előbb gondold ki a képletet:</strong> melyik értékből mit kell kivonni, összeadni, szorozni vagy osztani. Csak utána írd Pythonban.',
    6: '<strong>Különbség:</strong> <code>%</code> a maradékot adja, <code>//</code> pedig az egész hányadost.',
    7: '<strong>f-string:</strong> az idézőjel elé <code>f</code> kerül, a változó neve pedig kapcsos zárójelbe: <code>f"{nev}"</code>.',
    8: '<strong>if:</strong> a feltétel végén kettőspont van, a hozzá tartozó utasítás pedig beljebb kezdődik.',
    9: '<strong>Sorrend számít:</strong> <code>if</code> → <code>elif</code> → <code>else</code>. A szigorúbb határt vizsgáld előbb.',
    10: '<strong>Összetett feltétel:</strong> <code>and</code> esetén minden részfeltételnek igaznak kell lennie; <code>or</code> esetén elég egynek.',
    11: '<strong>Listaindex:</strong> az első elem indexe 0, nem 1. Például <code>lista[0]</code> az első elem.',
    12: '<strong>Lista:</strong> <code>len(lista)</code> megszámolja az elemeket, <code>lista.append(x)</code> új elemet tesz a végére.',
    13: '<strong>for:</strong> minden körben a lista következő elemét kapod meg. Ne kézzel írd ki ugyanazt többször.',
    14: '<strong>range:</strong> a felső határ nem része a tartománynak: <code>range(1, 6)</code> → 1,2,3,4,5.',
    15: '<strong>while:</strong> legyen olyan utasítás a ciklusban, amitől egyszer hamissá válik a feltétel, különben végtelen ciklus lesz.',
    16: '<strong>Függvény:</strong> a paraméter bemenet a függvénynek, a <code>return</code> pedig visszaadja az eredményt. A <code>print()</code> és a <code>return</code> nem ugyanaz.',
    17: '<strong>Összegzés:</strong> indulj 0-ról, és a ciklusban mindig add hozzá az aktuális elemet.',
    18: '<strong>Megszámlálás:</strong> a számláló csak akkor nő, ha az aktuális elem megfelel a feltételnek.',
    19: '<strong>Minimum/maximum:</strong> biztonságos kezdés a lista első eleme, majd ciklusban hasonlíts.',
    20: '<strong>Keresés/eldöntés:</strong> egy logikai változóval megjegyezheted, találtál-e megfelelő elemet.',
    21: '<strong>Modul:</strong> először importálod, utána ponttal éred el az eszközeit, például <code>math.sqrt()</code>.',
    22: '<strong>Fájlolvasás:</strong> <code>with open(..., "r")</code> után a fájlt soronként bejárhatod.',
    23: '<strong>split():</strong> egy szöveges sort elválasztójel mentén listává bont.',
    24: '<strong>Fájlírás:</strong> <code>"w"</code> módban írsz, a <code>write()</code> pedig nem tesz magától sortörést.',
    25: '<strong>Osztály:</strong> az osztály tervrajz, az objektum pedig ebből létrehozott példány.',
    26: '<strong>__init__ és self:</strong> a konstruktor az objektum létrehozásakor tölti fel a példány saját adatait.',
    27: '<strong>Objektumlista:</strong> objektumokat ugyanúgy listába tehetsz és ciklussal bejárhatsz.',
    28: '<strong>Komplex feladat:</strong> bontsd öt részre: beolvasás → feldolgozás → objektumlista → szűrés → fájlba írás.',
    29: '<strong>Csomag:</strong> több összetartozó modult rendez közös névtérbe. Importálhatsz egész csomagot vagy közvetlenül egy nevet belőle.',
    30: '<strong>Hibajavítás:</strong> ne írd újra automatikusan az egész programot. Előbb keresd meg, pontosan melyik sor vagy feltétel okozza az eltérést.'
  };
  return tips[lessonId] || '<strong>Tanulási szabály:</strong> először értsd meg, milyen adatod van, mit kell vele csinálni, és mi legyen az eredmény.';
}

function syntaxCheatText(lessonId) {
  const cheats = {
    1: '<code>print("szöveg")</code><br><code>print(változó)</code>',
    2: '<code>nev = "Anna"</code><br><code>ram = 16</code><br><code>print(ram)</code>',
    3: '<code>valtozo = input("Kérdés a felhasználónak: ")</code><br><code>print(valtozo)</code>',
    4: '<code>kor = int(input("Kor: "))</code><br><code>ar = float(input("Ár: "))</code>',
    5: '<code>a + b</code> &nbsp; <code>a - b</code> &nbsp; <code>a * b</code> &nbsp; <code>a / b</code>',
    6: '<code>a % b</code> → maradék<br><code>a // b</code> → egész hányados',
    7: '<code>print(f"Név: {nev}")</code>',
    8: '<code>if feltétel:</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>utasítás</code>',
    9: '<code>if feltétel1:</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>...</code><br><code>elif feltétel2:</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>...</code><br><code>else:</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>...</code>',
    10: '<code>if a and b:</code><br><code>if a or b:</code>',
    11: '<code>lista = [10, 20, 30]</code><br><code>lista[0]</code>',
    12: '<code>len(lista)</code><br><code>lista.append(uj_elem)</code>',
    13: '<code>for elem in lista:</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>print(elem)</code>',
    14: '<code>for i in range(1, 6):</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>print(i)</code>',
    15: '<code>while feltétel:</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>...</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>változás</code>',
    16: '<code>def nev(parameter):</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>return eredmeny</code>',
    17: '<code>osszeg = 0</code><br><code>for x in lista:</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>osszeg += x</code>',
    18: '<code>db = 0</code><br><code>if feltetel:</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>db += 1</code>',
    19: '<code>legnagyobb = lista[0]</code><br><code>if x &gt; legnagyobb:</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>legnagyobb = x</code>',
    20: '<code>talalt = False</code><br><code>if feltetel:</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>talalt = True</code>',
    21: '<code>import math</code><br><code>math.sqrt(25)</code><br><code>math.pi</code>',
    22: '<code>with open("adatok.txt", "r", encoding="utf-8") as fajl:</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>for sor in fajl:</code>',
    23: '<code>adatok = sor.strip().split(";")</code><br><code>nev = adatok[0]</code>',
    24: '<code>with open("eredmeny.txt", "w", encoding="utf-8") as fajl:</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>fajl.write(szoveg + "\\n")</code>',
    25: '<code>class Gep:</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>tipus = "PC"</code>',
    26: '<code>def __init__(self, nev):</code><br>&nbsp;&nbsp;&nbsp;&nbsp;<code>self.nev = nev</code>',
    27: '<code>lista.append(Gep(...))</code><br><code>for gep in lista:</code>',
    28: '<code>split()</code> + <code>osztály</code> + <code>append()</code> + <code>write()</code>',
    29: '<code>import html</code><br><code>from html import escape</code><br><code>from html import escape as vedett</code>',
    30: '<code>olvasd el → futtasd → azonosítsd a hibát → csak a szükséges részt javítsd</code>'
  };
  return cheats[lessonId] || '';
}

function practiceStage(taskIndex) {
  if (taskIndex === 0) {
    return {
      number: '1/3',
      title: 'Tanulás – nézd meg a mintát',
      text: 'Most még látsz egy hasonló példát és a szintaxis mintáját, de nem az aktuális feladat kész megoldását. A cél, hogy megértsd a szerkezetet, majd te alkalmazd.',
      showExplanation: true,
      showMicroTip: true,
      showCheat: true,
      independent: false
    };
  }
  if (taskIndex === 1) {
    return {
      number: '2/3',
      title: 'Gyakorlás puskával',
      text: 'Most már te oldod meg a feladatot, de a szükséges szintaxis még itt van segítségnek.',
      showExplanation: false,
      showMicroTip: true,
      showCheat: true,
      independent: false
    };
  }
  return {
    number: '3/3',
    title: 'Önálló próba – puska nélkül',
    text: 'Most nincs szintaxis-puska és nincs mintamegoldás. Addig próbálkozol, amíg az automatikus ellenőrzés sikeres nem lesz. Ha hibázol, az AI elmagyarázhatja, miért nem jó, de nem adja oda a kész megoldást.',
    showExplanation: false,
    showMicroTip: false,
    showCheat: false,
    independent: true
  };
}

function renderPracticeStage(lesson, taskIndex) {
  const stage = practiceStage(taskIndex);
  $('practiceStageBadge').textContent = stage.number;
  $('practiceStageTitle').textContent = stage.title;
  $('practiceStageText').textContent = stage.text;
  $('syntaxCheat').innerHTML = stage.showCheat
    ? `<div class="syntaxCheatTitle">📌 Szintaxis-puska</div>${syntaxCheatText(lesson.id)}`
    : '';
  $('syntaxCheat').classList.toggle('hidden', !stage.showCheat);
  $('lessonExplain').classList.toggle('hidden', !stage.showExplanation);
  $('microTip').classList.toggle('hidden', !stage.showMicroTip);
  $('aiExplainBtn').classList.toggle('hidden', stage.independent);
  $('hintBtn').classList.toggle('hidden', stage.independent);
  $('aiHintBtn').classList.toggle('hidden', stage.independent);
  $('solutionBtn').classList.toggle('hidden', stage.independent);
  if (stage.independent) $('solutionPanel').classList.add('hidden');
}

function successCoachText(lessonId) {
  const compact = {
    1: 'Szép. A konkrét szöveg idézőjelben van.',
    2: 'Jó. Figyeld továbbra is: idézőjelben szöveg van, idézőjel nélkül pedig a változó nevére hivatkozol.',
    3: 'Jó. A bekért adatot változóban használtad tovább.',
    4: 'Jó. Felismerted, mikor kell a szöveget számmá alakítani.',
    7: 'Jó. Az f-stringben a változó kapcsos zárójelben szerepel.',
    8: 'Jó. A feltétel és a behúzott blokk együtt működik.',
    16: 'Jó. A függvény eredményét returnnel adtad vissza.'
  };
  return compact[lessonId] || 'Jó megoldás. Nézd meg, melyik tanult Python-eszköz végezte el a feladat lényegi részét.';
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

function checkpointAllowsLesson(lessonId) {
  if (TEST_MODE) return true;
  const required = checkpointRequiredBeforeLesson(lessonId);
  return !required || store.isCheckpointPassed(required.id);
}

function isLessonUnlocked(lessonIndex) {
  if (TEST_MODE) return true;
  const indices = lessonTaskIndices(lessonIndex);
  const frontier = store.getFrontier(totalTasks);
  const done = isLessonDone(lessonIndex);
  const baseUnlocked = indices.some(i => i <= frontier || store.isCompleted(items[i].key));
  return done || (baseUnlocked && checkpointAllowsLesson(lessons[lessonIndex].id));
}

function isLastTaskOfLesson(item = currentItem()) {
  return !!item && item.taskIndex === item.lesson.tasks.length - 1;
}

function pendingCheckpointAfterCurrentLesson() {
  const item = currentItem();
  if (!item || !isLastTaskOfLesson(item)) return null;
  const cp = checkpointAfterLesson(item.lesson.id);
  return cp && !store.isCheckpointPassed(cp.id) ? cp : null;
}

function goToCheckpoint(cp) {
  if (!cp) return;
  const current = currentItem();
  if (current && $('codeEditor')) store.saveDraft(current.key, $('codeEditor').value);
  window.location.href = `./exams.html?checkpoint=${encodeURIComponent(cp.id)}`;
}

function firstLessonIndex(lessonIndex) {
  return lessonTaskIndices(lessonIndex)[0] ?? 0;
}

function lessonChoiceTarget(lessonIndex) {
  const indices = lessonTaskIndices(lessonIndex);
  if (TEST_MODE) return indices[0] ?? 0;
  const frontier = store.getFrontier(totalTasks);
  const firstIncomplete = indices.find(i => !store.isCompleted(items[i].key) && i <= frontier);
  return firstIncomplete ?? indices[0] ?? 0;
}

function renderAdminTestPanel() {
  const panel = $('adminTestPanel');
  if (!panel) return;
  panel.classList.toggle('hidden', !TEST_MODE);
  if (!TEST_MODE) return;

  const lessonSelect = $('testLessonSelect');
  const taskSelect = $('testTaskSelect');
  const active = currentItem();
  const activeLessonIndex = active?.lessonIndex ?? 0;

  lessonSelect.innerHTML = lessons.map((lesson, i) =>
    `<option value="${i}" ${i === activeLessonIndex ? 'selected' : ''}>${lesson.id}. ${escapeHtml(lesson.title)}</option>`
  ).join('');

  const refreshTasks = (lessonIndex, selectedTaskIndex = 0) => {
    const lesson = lessons[lessonIndex];
    const labels = ['1/3 – Tanulás mintával', '2/3 – Gyakorlás puskával', '3/3 – Önálló próba'];
    taskSelect.innerHTML = lesson.tasks.map((task, i) =>
      `<option value="${i}" ${i === selectedTaskIndex ? 'selected' : ''}>${labels[i] || `${i + 1}. feladat`}</option>`
    ).join('');
  };

  refreshTasks(activeLessonIndex, active?.taskIndex ?? 0);
  lessonSelect.onchange = () => refreshTasks(Number(lessonSelect.value), 0);
}

function testTargetIndex(lessonIndex, taskIndex) {
  return items.findIndex(x => x.lessonIndex === lessonIndex && x.taskIndex === taskIndex);
}

function jumpToTestSelection() {
  if (!TEST_MODE) return;
  const lessonIndex = Number($('testLessonSelect').value);
  const taskIndex = Number($('testTaskSelect').value);
  const target = testTargetIndex(lessonIndex, taskIndex);
  if (target >= 0) {
    const current = currentItem();
    if (current && $('codeEditor')) store.saveDraft(current.key, $('codeEditor').value);
    currentIndex = target;
    renderTask();
  }
}

function renderLessonNavigator() {
  const select = $('lessonSelect');
  if (!select) return;
  const activeLessonIndex = currentItem()?.lessonIndex ?? 0;
  select.innerHTML = '<option>Leckék betöltése…</option>';
  select.innerHTML = '';
  lessons.forEach((lesson, lessonIndex) => {
    const done = isLessonDone(lessonIndex);
    const unlocked = isLessonUnlocked(lessonIndex);
    const option = document.createElement('option');
    option.value = String(lessonIndex);
    option.disabled = !unlocked;
    const marker = !unlocked ? '🔒' : done ? '✓' : lessonIndex === activeLessonIndex ? '●' : '○';
    option.textContent = `${marker} ${lesson.id}. ${lesson.title}`;
    option.selected = lessonIndex === activeLessonIndex;
    select.appendChild(option);
  });
  $('lessonStartBtn').disabled = currentIndex === firstLessonIndex(activeLessonIndex);
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
    $('leaveClassBtn')?.classList.remove('hidden');
  } else if (status.error) {
    el.textContent = `Óra: ${status.error}`;
    el.className = 'runtime error';
    $('leaveClassBtn')?.classList.add('hidden');
  } else {
    el.textContent = 'Óra: helyi mód';
    el.className = 'runtime';
    $('leaveClassBtn')?.classList.add('hidden');
  }
}
tracker.onStatus = updateCloudStatus;

function renderSidebar() {
  $('studentLabel').textContent = TEST_MODE ? '🧪 Oktatói teszt' : (store.getCurrentStudentName() || 'Tanuló');
  $('progressBar').style.width = TEST_MODE ? '100%' : `${progressPercent()}%`;
  $('progressText').textContent = TEST_MODE ? 'Teszt mód – tanulói haladástól elkülönítve' : `${store.completedCount()} / ${totalTasks} feladat kész`;
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
      navigateTo(lessonChoiceTarget(lessonIndex));
    };
    list.appendChild(row);
  });
}

function renderTask() {
  const { lesson, task, key, taskIndex } = currentItem();
  renderSidebar();
  renderLessonNavigator();
  renderAdminTestPanel();
  $('lessonBadge').textContent = `${lesson.id}. lecke`;
  $('lessonTitle').textContent = lesson.title;
  $('lessonObjective').textContent = lesson.objective;
  $('lessonExplain').innerHTML = lesson.explain;
  $('microTip').innerHTML = `🧠 ${microCoachText(lesson.id)}`;
  renderPracticeStage(lesson, taskIndex);
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
  const independentStage = practiceStage(taskIndex).independent;
  $('solutionBtn').disabled = independentStage || attempts < 3;
  $('solutionBtn').title = independentStage
    ? 'Az önálló próbán nincs mintamegoldás: sikeres ellenőrzésig gyakorolsz.'
    : (attempts < 3 ? '3 sikertelen próbálkozás után válik elérhetővé.' : 'Mintamegoldás megtekintése');
  $('solutionPanel').classList.add('hidden');
  $('solutionCode').textContent = task.solution || '';

  const completed = store.isCompleted(key);
  const reviewTask = practiceStage(taskIndex).independent && store.isReviewTask(key);
  if (reviewTask) {
    const streak = store.getMasteryStreak(key);
    $('practiceStageBadge').textContent = 'ÚJRAGYAKORLÁS';
    $('practiceStageTitle').textContent = 'Célzott gyakorlás – puska nélkül';
    $('practiceStageText').textContent = `Ezt a készséget a kisvizsga még bizonytalannak mutatta. Két egymást követő önálló siker kell. Jelenlegi sorozat: ${streak}/2.`;
  }

  $('completedBadge').classList.toggle('hidden', !completed);
  $('nextBtn').classList.toggle('hidden', !completed);
  const pendingCheckpoint = TEST_MODE ? null : pendingCheckpointAfterCurrentLesson();
  const repairedFrontier = store.repairFrontier(totalTasks);
  const hasEarlierGap = completed && repairedFrontier < currentIndex;
  $('nextBtn').textContent = hasEarlierGap
    ? 'Hiányzó feladathoz →'
    : (pendingCheckpoint
      ? 'Kisvizsga következik →'
      : (currentIndex >= items.length - 1 ? 'Alapmodul kész ✓' : 'Következő feladat →'));
  $('prevBtn').disabled = currentIndex === 0;

  $('messages').innerHTML = '';
  const stage = practiceStage(taskIndex);
  addTeacherMessage(`Most a(z) „${lesson.title}” témán dolgozunk. ${stage.title}. A továbbhaladást a programtesztek döntik el.`);
  if (!stage.independent) addTeacherMessage(`🧠 Ezt jegyezd meg: ${htmlToText(microCoachText(lesson.id))}`);
  else addTeacherMessage('🎯 Most önálló próba következik: nincs puska. Ha hibázol, megmondom, miért nem jó és merre indulj tovább, de a kész megoldást nem adom oda.');
  store.setLastViewed(currentIndex);
  tracker.record('activity');
  tracker.flush().catch(() => {});
  setBusy(false);
}

function navigateTo(index) {
  const safeIndex = Math.max(0, Math.min(index, items.length - 1));
  const target = items[safeIndex];

  if (TEST_MODE) {
    const current = currentItem();
    if (current && $('codeEditor')) store.saveDraft(current.key, $('codeEditor').value);
    currentIndex = safeIndex;
    renderTask();
    return;
  }

  const frontier = store.repairFrontier(totalTasks);
  if (safeIndex > frontier && !store.isCompleted(target.key)) {
    const missingIndex = Math.min(frontier, items.length - 1);
    const missing = items[missingIndex];
    const current = currentItem();
    if (current && $('codeEditor')) store.saveDraft(current.key, $('codeEditor').value);
    currentIndex = missingIndex;
    tracker.record('activity');
    renderTask();
    showFeedback(
      'info',
      `<strong>Előbb van egy befejezetlen feladat.</strong><br>
      A rendszer visszavitt ide: <strong>${escapeHtml(missing.lesson.title)} – ${missing.taskIndex + 1}. feladat</strong>.
      Ezt teljesítsd, utána megnyílik a továbblépés.`
    );
    return;
  }

  if (!store.isCompleted(target.key) && !checkpointAllowsLesson(target.lesson.id)) {
    showFeedback('info', '<strong>A következő tananyagi blokk még zárva van.</strong><br>Előbb a kötelező kisvizsgát kell teljesíteni.');
    return;
  }

  const current = currentItem();
  if (current && $('codeEditor')) store.saveDraft(current.key, $('codeEditor').value);
  currentIndex = safeIndex;
  tracker.record('activity');
  renderTask();
}

function nextTask() {
  if (TEST_MODE) {
    if (currentIndex < items.length - 1) navigateTo(currentIndex + 1);
    return;
  }
  const cp = pendingCheckpointAfterCurrentLesson();
  if (cp) {
    goToCheckpoint(cp);
    return;
  }
  if (currentIndex >= items.length - 1) {
    showFeedback('ok', '<strong>🎉 A teljes Python tanulási modul elkészült.</strong><br>Az alapok, algoritmusok, fájlkezelés és objektumkezelés is teljesítve van.');
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
    JoinedStr: 'f-string', For: 'for ciklus', While: 'while ciklus', Return: 'return', Import: 'import', ImportFrom: 'from ... import ...', ClassDef: 'class/osztály', With: 'with blokk',
    Add: 'összeadás (+)', Sub: 'kivonás (-)', Mult: 'szorzás (*)', Div: 'osztás (/)',
    Mod: 'maradékos osztás (%)', FloorDiv: 'egész osztás (//)', And: 'and', Or: 'or'
  };
  return map[req.name] || req.name;
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
  const task = currentItem()?.task;
  let inputs = $('stdinBox').value === '' ? [] : $('stdinBox').value.split(/\r?\n/);
  let askedInteractively = false;

  // A Futtatás valódi gyakorlás: ha input() van a kódban és nincs előre
  // megadott kézi bemenet, a tanulótól kérjük be a próbaérték(ek)et.
  // Az automatikus tesztadatok (pl. Bence/Anna) csak az Ellenőrzésnél maradnak rejtve.
  if (!inputs.length && /\binput\s*\(/.test(code)) {
    const matches = [...code.matchAll(/\binput\s*\(\s*(?:["']([^"']*)["'])?\s*\)/g)];
    const count = Math.max(1, matches.length);
    const collected = [];
    for (let i = 0; i < count; i += 1) {
      const promptText = (matches[i]?.[1] || '').trim();
      const label = promptText || `${i + 1}. bemeneti érték`;
      const value = window.prompt(
        `A program most input()-tal adatot kér.\n\n${label}\n\nÍrd be a saját próbaértékedet:`
      );
      if (value === null) {
        showFeedback('info', 'A futtatást megszakítottad. Nem adtam automatikus tesztadatot a programnak.');
        return;
      }
      collected.push(value);
    }
    inputs = collected;
    askedInteractively = true;
  }

  setBusy(true, 'Futtatás…');
  $('output').textContent = 'Fut…';
  try {
    const fileSample = task?.fileTests?.[0];
    const result = fileSample
      ? await runner.executeWithFiles(code, inputs, fileSample.files || {}, fileSample.readFiles || Object.keys(fileSample.expectedFiles || {}))
      : await runner.execute(code, inputs);
    if (inputs.length) {
      $('inputEchoWrap').classList.remove('hidden');
      $('inputEcho').textContent = result.inputsUsed?.join('\n') || inputs.join('\n');
    } else {
      $('inputEchoWrap').classList.add('hidden');
    }
    if (!result.ok) {
      const diagnostic = formatError(result.error);
      lastDiagnostic = diagnostic;
      $('output').textContent = result.stdoutLines?.join('\n') || '(nincs kimenet)';
      showFeedback('bad', `<strong>A program hibával leállt.</strong><pre>${escapeHtml(diagnostic)}</pre>`);
      autoExplainFailure('kézi futtatás', diagnostic);
    } else {
      $('output').textContent = result.stdoutLines?.join('\n') || '(nincs kimenet)';
      const inputNote = askedInteractively
        ? '<br><span class="tiny">A Futtatásnál a saját próbaadatoddal futott a program. Az Ellenőrzés külön rejtett tesztadatokkal is kipróbálja.</span>'
        : '';
      const fileNote = fileSample && result.files
        ? '<br><span class="tiny">Létrehozott/ellenőrzött fájlok: ' + escapeHtml(Object.entries(result.files).map(([name, content]) => name + ': ' + JSON.stringify(content)).join(' | ')) + '</span>'
        : '';
      showFeedback('info', `A kézi futtatás befejeződött. Ha késznek gondolod, kattints az <strong>Ellenőrzés</strong> gombra.${inputNote}${fileNote}`);
    }
  } catch (err) {
    handleRunnerException(err);
  } finally {
    setBusy(false);
  }
}

let lastAutoAiAt = 0;

function autoExplainFailure(source, diagnostic) {
  const key = aiEnabled ? getStoredApiKey() : '';
  if (!key) return;
  const now = Date.now();
  if (now - lastAutoAiAt < 5000) return;
  lastAutoAiAt = now;
  askAi(
    `A(z) ${source} nem sikerült. Magyarázd el nagyon egyszerűen és konkrétan, miért nem jó a jelenlegi kód. Először nevezd meg a hibát, utána mondd el a legkisebb javítási irányt. Ha ez a 3/3 önálló próba, semmilyen körülmények között ne add meg a teljes kész megoldást vagy a teljes helyes kódot.`,
    'aiHints',
    { automatic: true }
  );
}

function failedAttempt(message, diagnostic = '') {
  const { key, taskIndex } = currentItem();
  const attempts = store.incrementAttempt(key);
  if (practiceStage(taskIndex).independent && store.isReviewTask(key)) {
    store.resetMasteryStreak(key);
  }
  $('attemptText').textContent = `${attempts} sikertelen ellenőrzés`;
  $('solutionBtn').disabled = attempts < 3;
  lastDiagnostic = diagnostic || message;
  showFeedback('bad', message);
  tracker.flush().catch(() => {});
  autoExplainFailure('automatikus ellenőrzés', lastDiagnostic);
}

async function checkTask() {
  if (busy || !pythonReady) return;
  tracker.record('checkCount');
  const { task, key, taskIndex } = currentItem();
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

    const outputWarnings = [];

    for (const test of task.tests || []) {
      const result = await runner.execute(code, test.inputs || []);
      if (!result.ok) {
        const diagnostic = formatError(result.error);
        failedAttempt(`<strong>A program hibával leállt.</strong><pre>${escapeHtml(diagnostic)}</pre>`, diagnostic);
        return;
      }
      const outputCheck = compareOutput(result.stdoutLines || [], test.expectedLines || [], test.inputs || []);
      if (!outputCheck.ok) {
        const diagnostic = formatTestDiagnostic(test.inputs || [], test.expectedLines || [], result.stdoutLines || []);
        failedAttempt(`<strong>A program lefutott, de a lényegi kimenet még nem megfelelő.</strong><br>${escapeHtml(outputCheck.reason || '')}<pre>${escapeHtml(diagnostic)}</pre>`, diagnostic);
        return;
      }
      if (outputCheck.warning) outputWarnings.push(...formatOutputWarnings(outputCheck.warnings));
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

    for (const test of task.fileTests || []) {
      const readFiles = test.readFiles || Object.keys(test.expectedFiles || {});
      const result = await runner.executeWithFiles(code, test.inputs || [], test.files || {}, readFiles);
      if (!result.ok) {
        const diagnostic = formatError(result.error);
        failedAttempt(`<strong>A fájlos teszt futás közben hibát talált.</strong><pre>${escapeHtml(diagnostic)}</pre>`, diagnostic);
        return;
      }
      const outputCheck = compareOutput(result.stdoutLines || [], test.expectedLines || [], test.inputs || []);
      if (!outputCheck.ok) {
        const diagnostic = formatTestDiagnostic(test.inputs || [], test.expectedLines || [], result.stdoutLines || []);
        failedAttempt(`<strong>A fájlos feladat lényegi képernyőkimenete még nem jó.</strong><br>${escapeHtml(outputCheck.reason || '')}<pre>${escapeHtml(diagnostic)}</pre>`, diagnostic);
        return;
      }
      if (outputCheck.warning) outputWarnings.push(...formatOutputWarnings(outputCheck.warnings));
      for (const [name, expected] of Object.entries(test.expectedFiles || {})) {
        const actual = String(result.files?.[name] ?? '').replace(/\r\n/g, '\n');
        const wanted = String(expected).replace(/\r\n/g, '\n');
        if (actual !== wanted) {
          const diagnostic = `Fájl: ${name}\nVárt tartalom:\n${wanted || '(üres fájl)'}\nKapott tartalom:\n${actual || '(nincs/üres)'}`;
          failedAttempt(`<strong>A létrehozott fájl tartalma még nem megfelelő.</strong><pre>${escapeHtml(diagnostic)}</pre>`, diagnostic);
          return;
        }
      }
    }

    const masteryReview = practiceStage(taskIndex).independent && store.isReviewTask(key);
    if (masteryReview) {
      const streak = store.recordMasterySuccess(key);
      tracker.record('successfulChecks');
      store.resetAttempt(key);
      lastDiagnostic = '';
      if (streak < 2) {
        $('attemptText').textContent = '1/2 önálló siker ✓';
        $('output').textContent = '✓ Első önálló siker.';
        $('codeEditor').value = '';
        store.saveDraft(key, '');
        showFeedback('ok', '<strong>✓ Első önálló siker megvan.</strong><br>Most oldd meg még egyszer nulláról, puska nélkül. Csak két egymást követő siker után számít stabilnak a tudás.');
        addTeacherMessage('🎯 Ez már jó volt. Most még egyszer, teljesen nulláról. Ha a következő is sikerül, mehetsz vissza a kisvizsgára.');
        renderSidebar();
        tracker.flush().catch(() => {});
        return;
      }
    }

    store.markCompleted(key, currentIndex, totalTasks);
    if (!masteryReview) tracker.record('successfulChecks');
    store.resetAttempt(key);
    lastDiagnostic = '';
    $('attemptText').textContent = 'Sikeres ✓';
    $('output').textContent = '✓ Az automatikus ellenőrzés sikeres.';
    $('inputEchoWrap').classList.add('hidden');
    $('completedBadge').classList.remove('hidden');
    $('nextBtn').classList.remove('hidden');
    renderSidebar();
    const usedSolution = store.hasViewedSolution(key);
    const textWarningHtml = outputWarnings.length
      ? `<div class="feedback info" style="margin-top:10px"><strong>⚠ Szöveges eltérés – továbbléphetsz.</strong><br>A programozási/logikai rész helyes. A kiírt feliratban van eltérés, ezért ezt csak jelzem, nem számít sikertelen próbának.<pre>${escapeHtml(outputWarnings.join('\n'))}</pre></div>`
      : '';
    showFeedback('ok', (masteryReview
      ? '<strong>✓ 2/2 egymást követő önálló siker.</strong><br>Ez a készség most újra stabil. Ha minden kijelölt gyenge területet teljesítettél, a kisvizsga újrapróbálható.'
      : `<strong>✓ Helyes programozási megoldás.</strong><br>${usedSolution ? 'A mintát már láttad, ezért a következő feladatnál próbáld teljesen önállóan.' : 'A programlogika és a lényegi eredmények helyesek.'}`) + textWarningHtml);
    addTeacherMessage(usedSolution ? 'Sikerült. A következő feladat hasonló gondolkodást kér, de próbáld a mintamegoldás nélkül felépíteni.' : 'Nagyon jó. Nem csak azt mondtad, hogy érted: a programtesztek szerint működik a megoldásod. Mehetünk tovább.');
    addTeacherMessage(`✅ ${successCoachText(currentItem().lesson.id)}`);
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
    autoExplainFailure('futtatás', message);
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
  const { task, key, taskIndex } = currentItem();
  if (practiceStage(taskIndex).independent) return;
  const attempts = store.getAttempts(key);
  if (attempts < 3) return;
  store.markSolutionViewed(key);
  $('solutionCode').textContent = task.solution || 'Ehhez a feladathoz még nincs rögzített mintamegoldás.';
  $('solutionPanel').classList.remove('hidden');
  addTeacherMessage('Megmutatom a mintamegoldást. Ne másold le gondolkodás nélkül: nézd meg soronként, melyik rész mit old meg. Utána ugyanennek a gondolatnak egy új változata következik.');
}

function saveDraftSoon() {
  clearTimeout(draftTimer);
  const { key } = currentItem();
  const code = $('codeEditor').value;
  draftTimer = setTimeout(() => {
    store.saveDraft(key, code);
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

async function askAi(question, activityType = 'aiQuestions', { automatic = false } = {}) {
  const key = aiEnabled ? getStoredApiKey() : '';
  if (!key) {
    addTeacherMessage('Az AI-segítséghez add meg a saját Gemini API-kulcsodat a 🔑 API-kulcs gombbal. A helyi Python-futtatás és ellenőrzés AI nélkül is működik.');
    return;
  }
  const { lesson, task, key: taskKey } = currentItem();
  tracker.record(activityType);
  const placeholder = addTeacherMessage(automatic ? '🤖 Megnézem, miért nem jó…' : 'Gondolkodom…');
  try {
    const result = await tutor.ask({
      question,
      lessonTitle: lesson.title,
      objective: lesson.objective,
      explanationText: htmlToText(lesson.explain),
      attempts: store.getAttempts(taskKey),
      solutionAllowed: store.getAttempts(taskKey) >= 3 && !practiceStage(currentItem().taskIndex).independent,
      taskText: htmlToText(task.text),
      expectedExamples: (task.tests || []).slice(0, 2).map(t => ({ inputs: t.inputs || [], expectedLines: t.expectedLines || [] })),
      helpLevel: Math.min(5, Math.max(1, store.getAttempts(taskKey) + 1)),
      code: $('codeEditor').value,
      diagnostic: lastDiagnostic
    });
    placeholder.textContent = result.text;
    lastAiAnswer = result.text;
    store.appendSavedExplanation(lesson.id, result.text);
    $('saveAiNoteBtn').disabled = true;
    $('saveAiNoteBtn').textContent = '📝 AI-magyarázat automatikusan mentve a jegyzetbe';
    $('aiModelStatus').textContent = `AI: ${result.model}`;
    tracker.flush().catch(() => {});
  } catch (err) {
    const msg = String(err?.message || err);
    placeholder.textContent = msg.startsWith('Várj még')
      ? 'Az AI néhány másodperc múlva újra kérdezhető. A helyi hibamagyarázat addig is megmarad.'
      : `AI-hiba: ${msg}. A Python-futtató és a feladatellenőrző ettől még működik.`;
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
  $('saveAiNoteBtn').textContent = '📝 AI-magyarázatok automatikusan mentve a jegyzetbe';
  const hadPreviousProgress = store.completedCount() > 0;
  currentIndex = continuationIndex();

  // Régebbi profilnál se lehessen egy újonnan bevezetett kisvizsgát átugrani.
  const currentLessonId = items[currentIndex]?.lesson?.id || 1;
  const blocking = checkpointRequiredBeforeLesson(currentLessonId);
  if (blocking && !store.isCheckpointPassed(blocking.id)) {
    const indices = items.map((x, i) => x.lesson.id === blocking.afterLesson ? i : -1).filter(i => i >= 0);
    if (indices.length) currentIndex = indices[indices.length - 1];
  }
  renderTask();
  if (hadPreviousProgress) {
    addTeacherMessage(`↪ Folytatás a korábbi haladásból: ${continuationLabel(currentIndex)}. Az új órakód csak az aktuális órai követést indítja újra; a kész feladataid és kisvizsgáid megmaradtak.`);
  }
  tracker.flush().catch(() => {});
}

async function resumeAfterExam() {
  const p = store.getCurrentProfile();
  if (!p) {
    openSetup();
    return false;
  }

  aiEnabled = !!getStoredApiKey();
  const classCode = sessionStorage.getItem(CLASS_CODE_KEY) || '';

  if (classCode) {
    updateCloudStatus({ error: 'kapcsolódás…' });
    try {
      const joined = await tracker.join(classCode, p.displayName);
      if (!joined.connected) updateCloudStatus({ error: joined.reason || 'nem kapcsolódott' });
    } catch (err) {
      // A vizsga utáni visszatérés akkor se akadjon el, ha a felhős kapcsolat
      // pillanatnyilag nem épül fel. A helyi haladásból folytatjuk, az órához
      // később az API/profil panelből újra lehet kapcsolódni.
      console.warn('Vizsga utáni automatikus óra-visszakapcsolódás sikertelen:', err);
      updateCloudStatus({ error: 'helyi mód – újracsatlakozás szükséges' });
    }
  } else {
    updateCloudStatus();
  }

  $('setupOverlay').classList.add('hidden');
  tutor.clearHistory();
  lastAiAnswer = '';
  $('saveAiNoteBtn').disabled = true;
  $('saveAiNoteBtn').textContent = '📝 AI-magyarázatok automatikusan mentve a jegyzetbe';

  currentIndex = continuationIndex();

  const currentLessonId = items[currentIndex]?.lesson?.id || 1;
  const blocking = checkpointRequiredBeforeLesson(currentLessonId);
  if (blocking && !store.isCheckpointPassed(blocking.id)) {
    const indices = items.map((x, i) => x.lesson.id === blocking.afterLesson ? i : -1).filter(i => i >= 0);
    if (indices.length) currentIndex = indices[indices.length - 1];
  }

  renderTask();
  tracker.flush().catch(() => {});

  // A resume paraméter csak a vizsga utáni egyszeri visszatérésre szolgál.
  try { history.replaceState({}, '', './index.html'); } catch {}
  return true;
}

async function leaveClass() {
  const code = sessionStorage.getItem(CLASS_CODE_KEY) || '';
  if (!code && !tracker.classCode) return;
  if (!confirm('Biztosan kilépsz az aktuális órából? A saját haladásod, jegyzeteid és API-kulcsod megmaradnak.')) return;
  await tracker.leave();
  sessionStorage.removeItem(CLASS_CODE_KEY);
  $('classCodeInput').value = '';
  updateCloudStatus();
  openSetup();
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
    currentIndex = continuationIndex();
    renderTask();
    addTeacherMessage(`A mentett haladást sikeresen betöltöttük. Folytatás innen: ${continuationLabel(currentIndex)}.`);
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
  $('lessonStartBtn').onclick = () => {
    const lessonIndex = currentItem()?.lessonIndex ?? 0;
    navigateTo(firstLessonIndex(lessonIndex));
  };
  $('testJumpBtn').onclick = jumpToTestSelection;
  $('testResetTaskBtn').onclick = () => {
    if (!TEST_MODE) return;
    const item = currentItem();
    store.resetTask(item.key);
    $('codeEditor').value = item.task.starter || '';
    renderTask();
    showFeedback('info', '<strong>Az aktuális tesztfeladat helyi állapota törölve.</strong><br>Újra tiszta lappal próbálhatod.');
  };

  $('lessonSelect').onchange = event => {
    const lessonIndex = Number(event.target.value);
    if (!Number.isInteger(lessonIndex) || !isLessonUnlocked(lessonIndex)) {
      renderLessonNavigator();
      return;
    }
    navigateTo(lessonChoiceTarget(lessonIndex));
  };
  $('aiExplainBtn').onclick = () => askAi('Magyarázd el másképp az aktuális új Python-fogalmat, nagyon egyszerű példával. Az aktuális feladat kész megoldását ne add meg, ha még nem engedélyezett.', 'aiQuestions');
  $('aiHintBtn').onclick = () => askAi('Adj egy rövid, célzott rávezető tippet az aktuális feladathoz. Ne ugorj előre a tananyagban.', 'aiHints');
  $('sendBtn').onclick = () => {
    const q = $('chatInput').value.trim();
    if (!q) return;
    $('chatInput').value = '';
    addTeacherMessage(q, 'user');
    askAi(q, 'aiQuestions');
  };
  $('saveAiNoteBtn').onclick = () => {};
  $('clearChatBtn').onclick = () => {
    tutor.clearHistory();
    lastAiAnswer = '';
    $('saveAiNoteBtn').disabled = true;
    $('messages').innerHTML = '';
    addTeacherMessage('Az AI-beszélgetést töröltük. A feladatod és a haladásod megmaradt.');
  };
  $('leaveClassBtn').onclick = () => leaveClass().catch(err => alert(err?.message || err));
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

  if (TEST_MODE) {
    sessionStorage.removeItem(CLASS_CODE_KEY);
    store.setCurrentStudent(TEST_PROFILE_NAME);
    const p = store.getCurrentProfile();
    if (p) {
      p.isTestProfile = true;
      store.persist();
    }
    aiEnabled = !!getStoredApiKey();
    $('setupOverlay').classList.add('hidden');
    currentIndex = 0;
  } else {
    if (testRequested && !TEST_MODE) {
      alert('A lecketeszt módot a tanári oldalról kell megnyitni Google-belépés után.');
    }
    if (RESUME_AFTER_EXAM && store.getCurrentProfile()) $('setupOverlay').classList.add('hidden');
    else openSetup();
  }

  try {
    await runner.start();
    updatePythonStatus('ready');
    if (TEST_MODE) renderTask();
    else if (RESUME_AFTER_EXAM && store.getCurrentProfile()) await resumeAfterExam();
  } catch (err) {
    updatePythonStatus('error');
    showFeedback('bad', `Nem sikerült betölteni a Python környezetet: ${escapeHtml(err?.message || err)}`);
  }
}

boot();
