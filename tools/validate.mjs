import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { lessons } from '../js/lessons.js';

const here = dirname(fileURLToPath(import.meta.url));
const bridge = resolve(here, 'validator_bridge.py');

function pythonCommand() {
  for (const cmd of ['python', 'python3', 'py']) {
    const r = spawnSync(cmd, ['--version'], { encoding: 'utf8' });
    if (!r.error && r.status === 0) return cmd;
  }
  throw new Error('Python nem található a PATH-ban.');
}
const PY = pythonCommand();

const payloadCases = [];
const labels = [];
for (const lesson of lessons) {
  for (let i = 0; i < lesson.tasks.length; i++) {
    const task = lesson.tasks[i];
    payloadCases.push({ task, code: task.solution || '' });
    labels.push({ name:`mintamegoldás ${lesson.id}.${i + 1}`, expected:true });
  }
}

const regressions = [
  ['3.1 hardcode ne menjen át', lessons[2].tasks[0], 'input(); print("Bence")', false],
  ['7.1 hardcode ne menjen át', lessons[6].tasks[0], 'input(); input(); print("A SRV01 szerver RAM-ja 16 GB.")', false],
  ['8.1 mindig igaz feltétel ne menjen át', lessons[7].tasks[0], 'cpu=float(input());\nif cpu >= 0:\n    print("KRITIKUS")', false],
  ['8.2 if True ne menjen át', lessons[7].tasks[1], 'int(input());\nif True:\n    print("Nagyobb 10-nél")', false],
  ['9.1 rossz határérték ne menjen át', lessons[8].tasks[0], 'cpu=float(input());\nif cpu > 90:\n print("KRITIKUS")\nelif cpu > 70:\n print("FIGYELMEZTETÉS")\nelse:\n print("OK")', false],
  ['10.1 csak RAM ne menjen át', lessons[9].tasks[0], 'cpu=float(input()); ram=float(input());\nif ram>=90:\n print("KRITIKUS")\nelse:\n print("NEM KRITIKUS")', false],
  ['10.3 felső határ hiba ne menjen át', lessons[9].tasks[2], 'p=int(input());\nif 1024 <= p <= 49150:\n print("regisztrált/tartomány")\nelse:\n print("más")', false],
  ['10.3 láncolt összehasonlítás menjen át', lessons[9].tasks[2], 'p=int(input());\nif 1024 <= p <= 49151:\n print("regisztrált/tartomány")\nelse:\n print("más")', true],
  ['12.3 += megoldás menjen át', lessons[11].tasks[2], 'szerverek=[]\nszerverek += [input()]\nszerverek += [input()]\nprint(len(szerverek))', true],
  ['16.1 main-guard menjen át', lessons[15].tasks[0], 'def osszeg(a,b):\n    return a+b\nif __name__ == "__main__":\n    print(input())', true],
  ['16.2 egy returnnel menjen át', lessons[15].tasks[1], 'def cpu_statusz(cpu):\n    if cpu >= 90:\n        status = "KRITIKUS"\n    elif cpu >= 70:\n        status = "FIGYELMEZTETÉS"\n    else:\n        status = "OK"\n    return status', true],
  ['sandbox: os import tiltva', lessons[0].tasks[0], 'import os\nprint("Szia, Python!")', false],
  ['sandbox: sys import tiltva', lessons[0].tasks[0], 'import sys\nprint("Szia, Python!")', false],
  ['sandbox: dunder attribútum tiltva', lessons[0].tasks[0], 'print((1).__class__)', false],
  ['sandbox: eval tiltva', lessons[0].tasks[0], 'print(eval("\\\"Szia, Python!\\\""))', false],
  ['sandbox: math modul engedélyezett', lessons[0].tasks[0], 'import math\nprint("Szia, Python!")', true]
];
for (const [name, task, code, expected] of regressions) {
  payloadCases.push({ task, code });
  labels.push({ name, expected });
}

const r = spawnSync(PY, [bridge], { input: JSON.stringify({ cases: payloadCases }), encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
if (r.error || r.status !== 0) {
  console.error(r.stderr || r.error?.message || 'validator bridge hiba');
  process.exit(1);
}
const results = JSON.parse(r.stdout);
let failures = 0;
results.forEach((actual, i) => {
  const { name, expected } = labels[i];
  if (actual !== expected) {
    console.error(`FAIL: ${name} (várt=${expected}, kapott=${actual})`);
    failures++;
  }
});
if (failures) {
  console.error(`\n${failures} regressziós hiba.`);
  process.exit(1);
}
console.log(`OK: 48 mintamegoldás + ${regressions.length} regressziós eset.`);
