# Python Vizsgafelkészítő v3

Böngészőben futó, vizsgafókuszú Python tanulórendszer informatikai rendszer- és alkalmazás-üzemeltető technikus tanulóknak.

## A v3 fő elemei

- 16 alapozó lecke, 48 automatikusan ellenőrzött feladattal;
- Python futtatás külön Web Workerben, 5 másodperces időkorláttal;
- AST-alapú szerkezeti ellenőrzés + rejtett futási tesztek;
- saját Gemini API-kulccsal működő AI oktató;
- AI csak magyaráz és rávezet, a továbbjutásról a tesztek döntenek;
- feladatonként mentett kódpiszkozat;
- visszanézhető tananyag és saját jegyzet;
- AI-magyarázat mentése a saját jegyzetbe;
- 3 részvizsga automatikus részpontozással;
- követelménymátrix és haladás oldal;
- Firebase Realtime Database alapú élő tanári dashboard;
- órai aktivitás: aktív/inaktív/háttér/offline, futtatás, ellenőrzés, tippek, haladás;
- CSV export a tanári dashboardról.

## Adatminimalizálás

A Firebase-be csak órai aktivitási és haladási metaadat kerül. Nem kerül fel:

- Gemini API-kulcs;
- tanulói Python-kód;
- AI-beszélgetés tartalma;
- billentyűleütés;
- képernyőkép vagy böngészési előzmény.

## Firebase

A Firebase projekt be van kötve a `python-vizsgafelkeszito` projekthez. A részletes beállítások a `FIREBASE_SETUP.md` fájlban vannak.

A program Firebase nélkül is működik helyi tanulóprogramként. A jelenlegi kiadásban az órakód és a tanári élő dashboard a Firebase Realtime Database-re van kötve.

## GitHub Pages

A teljes mappa tartalmát a repository gyökerébe kell tenni, majd GitHub → Settings → Pages → Deploy from a branch → `main` / `(root)`.

Tanulói oldal: `index.html`

Tanári dashboard: `teacher.html`

## Tananyag további bővítése

A következő modulok:

1. vizsgaalgoritmusok;
2. szöveg- és fájlkezelés;
3. saját modulok;
4. osztályok és objektumok;
5. teljes 8 + 14 + 18 pontos alapvizsga-szimuláció;
6. JSON és REST API;
7. PyCharm/DevNet hálózatprogramozási labor.

A kliensben lévő tesztek gyakorlásra és formatív értékelésre készültek. Hivatalos vizsgajegy megállapítására önmagukban nem használhatók.
