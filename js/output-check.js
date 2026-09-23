// Kimenet-ellenőrzés oktatási célra.
// A programozási/logikai eredmény a döntő. Kisebb szöveges eltérés,
// elütés, ékezet-, írásjel- vagy felirat-hiba figyelmeztetés lehet,
// de önmagában ne akadályozza a továbbhaladást.

function trimBlankEdges(lines = []) {
  const out = (lines || []).map(x => String(x ?? ''));
  while (out.length && !out[0].trim()) out.shift();
  while (out.length && !out[out.length - 1].trim()) out.pop();
  return out;
}

function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('hu-HU')
    .replace(/[^a-z0-9%+\-.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function numericTokens(value) {
  return (String(value ?? '').match(/[-+]?\d+(?:[.,]\d+)?/g) || [])
    .map(x => Number(x.replace(',', '.')));
}

function sameNumbers(a, b) {
  const aa = numericTokens(a);
  const bb = numericTokens(b);
  if (aa.length !== bb.length) return false;
  return aa.every((x, i) => Number.isFinite(x) && Number.isFinite(bb[i]) && Math.abs(x - bb[i]) < 1e-9);
}

function normalizedInputTokens(inputs = [], expected = '') {
  const e = normalizeText(expected);
  return (inputs || [])
    .map(x => normalizeText(x))
    .filter(x => x && !/^[-+]?\d+(?:[.,]\d+)?$/.test(x))
    .filter(x => e.includes(x));
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  const curr = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    for (let j = 0; j <= b.length; j += 1) prev[j] = curr[j];
  }
  return prev[b.length];
}

function similarity(a, b) {
  const aa = normalizeText(a);
  const bb = normalizeText(b);
  const maxLen = Math.max(aa.length, bb.length);
  if (!maxLen) return 1;
  return 1 - levenshtein(aa, bb) / maxLen;
}

function compareLine(actual, expected, inputs = []) {
  const aRaw = String(actual ?? '');
  const eRaw = String(expected ?? '');
  if (aRaw === eRaw) return { ok: true, warning: false };

  const a = normalizeText(aRaw);
  const e = normalizeText(eRaw);
  if (a === e) {
    return { ok: true, warning: true, reason: 'Csak formázási/ékezet- vagy írásjel-eltérés.' };
  }

  // A számítási eredményeket továbbra is szigorúan ellenőrizzük.
  if (!sameNumbers(aRaw, eRaw)) {
    return { ok: false, warning: false, reason: 'A számérték(ek) nem egyeznek.' };
  }

  // Ha a várt kimenet visszaír egy szöveges bemenetet (pl. nevet),
  // annak ténylegesen meg kell jelennie a kimenetben.
  const requiredInputs = normalizedInputTokens(inputs, eRaw);
  if (requiredInputs.some(token => !a.includes(token))) {
    return { ok: false, warning: false, reason: 'A bemenetből származó lényegi szöveg hiányzik vagy eltér.' };
  }

  const hasSemanticValue = numericTokens(eRaw).length > 0 || requiredInputs.length > 0;
  if (hasSemanticValue) {
    return {
      ok: true,
      warning: true,
      reason: 'A lényegi érték helyes, de a kiírt magyarázó szöveg eltér a mintától.'
    };
  }

  // Tisztán szöveges logikai eredménynél (pl. KRITIKUS / OK) csak
  // valódi elírást engedünk át; teljesen más szó továbbra is hibának számít.
  const sim = similarity(aRaw, eRaw);
  const maxLen = Math.max(a.length, e.length);
  const closeEnough = maxLen <= 4
    ? levenshtein(a, e) <= 1
    : sim >= 0.68;

  if (closeEnough) {
    return {
      ok: true,
      warning: true,
      reason: 'A szövegben valószínű elírás van, de a kimenet tartalmilag felismerhető.'
    };
  }

  return { ok: false, warning: false, reason: 'A szöveges eredmény tartalmilag is eltér.' };
}

export function compareOutput(actualLines = [], expectedLines = [], inputs = []) {
  const actual = trimBlankEdges(actualLines);
  const expected = trimBlankEdges(expectedLines);

  if (actual.length !== expected.length) {
    return {
      ok: false,
      warning: false,
      reason: `A kimeneti sorok száma eltér (várt: ${expected.length}, kapott: ${actual.length}).`,
      warnings: []
    };
  }

  const warnings = [];
  for (let i = 0; i < expected.length; i += 1) {
    const cmp = compareLine(actual[i], expected[i], inputs);
    if (!cmp.ok) {
      return {
        ok: false,
        warning: false,
        reason: `${i + 1}. sor: ${cmp.reason}`,
        warnings
      };
    }
    if (cmp.warning) {
      warnings.push({
        line: i + 1,
        expected: String(expected[i]),
        actual: String(actual[i]),
        reason: cmp.reason
      });
    }
  }

  return { ok: true, warning: warnings.length > 0, warnings };
}

export function formatOutputWarnings(warnings = []) {
  return warnings.map(w =>
    `${w.line}. sor – várt: "${w.expected}", kapott: "${w.actual}"`
  );
}
