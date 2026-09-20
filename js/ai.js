const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

export class GeminiTutor {
  constructor({ getApiKey, cooldownMs = 8000 } = {}) {
    this.getApiKey = getApiKey;
    this.cooldownMs = cooldownMs;
    this.lastCallAt = 0;
    this.history = [];
  }

  clearHistory() {
    this.history = [];
  }

  async ask(ctx) {
    const apiKey = (this.getApiKey?.() || '').trim();
    if (!apiKey) throw new Error('Nincs megadva Gemini API-kulcs.');

    const elapsed = Date.now() - this.lastCallAt;
    if (elapsed < this.cooldownMs) {
      const wait = Math.ceil((this.cooldownMs - elapsed) / 1000);
      throw new Error(`Várj még ${wait} másodpercet az újabb AI-kérés előtt.`);
    }
    this.lastCallAt = Date.now();

    const system = `Te egy Python programozási oktató vagy. Informatikai rendszer- és alkalmazás-üzemeltető technikus tanulót készítesz fel a vizsgára.
A cél, hogy a tanuló a feladatszöveget önállóan bontsa fel, felismerje a szükséges Python-elemeket, megírja, lefuttassa és kijavítsa a programot.

SZABÁLYOK:
- Magyarul, tömören és érthetően válaszolj.
- A tanulási sorrendet az alkalmazás adja. Ne ugorj előre.
- Új fogalomnál mondd el: mi ez, mire jó, hogyan írjuk, majd mutass rövid példát.
- Hibánál fokozatosan segíts: 1) kérdés/rávezetés, 2) fogalom, 3) pszeudokód/részlet, 4) részleges kód, 5) csak engedély esetén teljes megoldás.
- Ne állítsd, hogy a feladat teljesítve van; ezt az automatikus tesztek döntik el.
- Ha a kód jó irányba megy, először nevezd meg konkrétan, mi jó benne.
- Ne kérj vagy kezelj személyes adatot, API-kulcsot.

AKTUÁLIS LECKE: ${ctx.lessonTitle}
CÉL: ${ctx.objective}
LECKE MAGYARÁZATA: ${ctx.explanationText}
AKTUÁLIS FELADAT: ${ctx.taskText}
SIKERTELEN ELLENŐRZÉSEK: ${ctx.attempts}
TELJES MEGOLDÁS ENGEDÉLYEZETT: ${ctx.solutionAllowed ? 'IGEN' : 'NEM'}
SEGÍTSÉGI SZINT: ${ctx.helpLevel || 1}/5
${ctx.expectedExamples?.length ? `ELVÁRT PÉLDÁK: ${JSON.stringify(ctx.expectedExamples)}` : ''}
${ctx.diagnostic ? `LEGUTÓBBI TESZT/HIBA: ${ctx.diagnostic}` : ''}`;

    const codeBlock = `A tanuló kérdése:\n${ctx.question}\n\nA tanuló jelenlegi kódja:\n\`\`\`python\n${ctx.code || ''}\n\`\`\``;
    const contents = [
      ...this.history.slice(-6),
      { role: 'user', parts: [{ text: codeBlock }] }
    ];

    let lastError = null;
    for (const model of MODELS) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
          },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents,
            generationConfig: {
              maxOutputTokens: 1000,
              thinkingConfig: { thinkingLevel: 'minimal' }
            }
          })
        });
        const data = await response.json();
        if (!response.ok) {
          lastError = new Error(data?.error?.message || `Gemini API hiba (${response.status})`);
          if (response.status === 404) continue;
          throw lastError;
        }
        const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim();
        if (!text) throw new Error('A Gemini nem adott szöveges választ.');
        this.history.push(
          { role: 'user', parts: [{ text: codeBlock }] },
          { role: 'model', parts: [{ text }] }
        );
        return { text, model };
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('Nem sikerült elérni a Gemini modellt.');
  }
}
