# Python Vizsgafelkészítő v5

Böngészőben futó, vizsgafókuszú Python tanulórendszer informatikai rendszer- és alkalmazás-üzemeltető technikus tanulóknak.

## Fő elemek

- 16 alapozó lecke, 48 automatikusan ellenőrzött feladattal;
- Python futtatás külön Web Workerben, 5 másodperces időkorláttal;
- AST-alapú szerkezeti ellenőrzés és több rejtett futási teszt, külön határértékekkel;
- saját Gemini API-kulccsal működő AI oktató;
- AI csak magyaráz és rávezet, a továbbjutásról a tesztek döntenek;
- feladatonként mentett kódpiszkozat;
- visszanézhető tananyag és saját jegyzet;
- AI-magyarázat mentése a saját jegyzetbe;
- részvizsgák automatikus részpontozással;
- teljes 8 + 14 + 18 pontos, 40 pontos vizsgaszimuláció;
- külön modul-, fájlkezelési és objektumorientált gyakorlóvizsga;
- feladatonkénti „Ezt jegyezd meg” mikro-tippek és siker utáni megerősítés;
- órakódos használatnál külön „Kilépés az órából” funkció;
- részvizsga-piszkozat és lejárati idő mentése, így egy frissítés nem nullázza a munkát;
- követelménymátrix és haladás oldal;
- opcionális, órakódos órai aktivitáskövetés.

## Adatminimalizálás

Órai használatnál ne teljes nevet, hanem tanári azonosítót vagy becenevet használjatok.

A Firebase-be csak órai aktivitási és haladási metaadat kerülhet. Nem kerül fel:

- Gemini API-kulcs;
- tanulói Python-kód;
- AI-beszélgetés tartalma;
- billentyűleütés;
- képernyőkép;
- böngészési előzmény.

A követett órai metaadatok: aktív/inaktív/háttér/offline állapot, aktuális lecke és feladat, sikertelen próbálkozások száma, haladás, futtatások, ellenőrzések és tippek számlálói.

## GitHub Pages

A repository gyökere statikus webhelyként publikálható GitHub Pages-en (`main` / `(root)`). A kezdőoldal az `index.html`.

## Tananyag további bővítése

A következő modulok:

1. vizsgaalgoritmusok;
2. szöveg- és fájlkezelés;
3. saját modulok;
4. osztályok és objektumok;
5. saját modul és összetettebb fájlkezelési feladatok;
6. JSON és REST API;
7. PyCharm/DevNet hálózatprogramozási labor.

A kliensben lévő tesztek gyakorlásra és formatív értékelésre készültek. Hivatalos vizsgajegy megállapítására önmagukban nem használhatók.
