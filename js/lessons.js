export const lessons = [
  {
    id: 1,
    title: 'print() – az első kimenet',
    objective: 'Tudj szöveget és értéket kiírni a képernyőre.',
    explain: `
      <p>A <code>print()</code> utasítással adatot írunk ki a képernyőre. Ha szöveget írsz ki, a szöveget idézőjelek közé kell tenni.</p>
      <pre><code>print("Szia!")</code></pre>
      <p>A Python a programot felülről lefelé hajtja végre. Több <code>print()</code> több kimeneti sort ad.</p>`,
    tasks: [
      {
        text: 'Írj programot, amely pontosan ezt írja ki: <code>Szia, Python!</code>',
        starter: '',
        checks: [{ type: 'call', name: 'print', min: 1 }],
        tests: [{ inputs: [], expectedLines: ['Szia, Python!'] }],
        hints: ['A parancs neve <code>print</code>.', 'A szöveget tedd idézőjelek közé.'],
        solution: 'print("Szia, Python!")'
      },
      {
        text: 'Írj két külön sort. Az első legyen <code>Szerver indul.</code>, a második <code>Ellenőrzés kész.</code>',
        starter: '',
        checks: [{ type: 'call', name: 'print', min: 2 }],
        tests: [{ inputs: [], expectedLines: ['Szerver indul.', 'Ellenőrzés kész.'] }],
        hints: ['Két külön <code>print()</code> utasításra van szükség.', 'A sorok sorrendje is számít.'],
        solution: 'print("Szerver indul.")\nprint("Ellenőrzés kész.")'
      },
      {
        text: 'Kevert gyakorlás: írj ki három külön sorba egy szervernevet, egy IP-címet és azt, hogy <code>OK</code>. Pontosan ezt várjuk: <code>SRV01</code>, <code>192.168.1.10</code>, <code>OK</code>.',
        starter: '',
        checks: [{ type: 'call', name: 'print', min: 3 }],
        tests: [{ inputs: [], expectedLines: ['SRV01', '192.168.1.10', 'OK'] }],
        hints: ['Három külön kiírás kell.', 'Minden szöveg idézőjelben legyen.'],
        solution: 'print("SRV01")\nprint("192.168.1.10")\nprint("OK")'
      }
    ]
  },
  {
    id: 2,
    title: 'Változók – adat eltárolása',
    objective: 'Tudj nevet adni adatoknak és később felhasználni őket.',
    explain: `
      <p>A változó egy névvel ellátott tároló. Az <code>=</code> értékadást jelent.</p>
      <pre><code>szerver = "SRV01"
print(szerver)</code></pre>
      <p>Szöveges értéket idézőjelek közé teszünk, számot nem.</p>`,
    tasks: [
      {
        text: 'Hozz létre <code>szerver</code> nevű változót <code>"SRV01"</code> értékkel, majd írd ki.',
        starter: 'szerver = \n',
        checks: [{ type: 'node', name: 'Assign', min: 1 }, { type: 'call', name: 'print', min: 1 }],
        tests: [{ inputs: [], expectedLines: ['SRV01'] }],
        hints: ['A változó értéke szöveg, ezért idézőjel kell.', 'A második sorban a változó nevét írd a <code>print()</code> zárójelébe.'],
        solution: 'szerver = "SRV01"\nprint(szerver)'
      },
      {
        text: 'Hozz létre egy <code>ram</code> nevű változót, és adj neki <strong>egyetlen számértéket: <code>16</code></strong>. Ezután írd ki a <code>ram</code> változó értékét. Nem 16 darab számot kell megadni.',
        starter: 'ram = \n',
        checks: [{ type: 'node', name: 'Assign', min: 1 }, { type: 'call', name: 'print', min: 1 }],
        tests: [{ inputs: [], expectedLines: ['16'] }],
        hints: ['A 16 szám, ezért nem kell idézőjel.', 'Az értékadás után írd ki a <code>ram</code> változót.'],
        solution: 'ram = 16\nprint(ram)'
      },
      {
        text: 'Kevert gyakorlás: legyen <code>gep = "PC12"</code> és <code>cpu = 35</code>. Írd ki őket két külön sorba.',
        starter: '',
        checks: [{ type: 'node', name: 'Assign', min: 2 }, { type: 'call', name: 'print', min: 2 }],
        tests: [{ inputs: [], expectedLines: ['PC12', '35'] }],
        hints: ['Két változóra lesz szükség.', 'A szöveg idézőjeles, a szám nem.'],
        solution: 'gep = "PC12"\ncpu = 35\nprint(gep)\nprint(cpu)'
      }
    ]
  },
  {
    id: 3,
    title: 'input() – adatbekérés',
    objective: 'Tudj adatot kérni a felhasználótól és változóba menteni.',
    explain: `
      <p>Az <code>input()</code> a felhasználótól kér be adatot. Az eredményt általában változóba mentjük.</p>
      <pre><code>nev = input("Neved: ")
print(nev)</code></pre>
      <p>Az <code>input()</code> eredménye mindig szöveg, vagyis <code>str</code>, amíg át nem alakítod.</p>`,
    tasks: [
      {
        text: 'A program kérjen be <strong>egy darab nevet</strong> <code>input()</code>-tal, mentse a <code>nev</code> változóba, majd írja ki. Az automatikus ellenőrzés próbaként például a <code>Bence</code> nevet adja majd a programnak.',
        starter: 'nev = input("Neved: ")\n',
        checks: [{ type: 'call', name: 'input', min: 1 }, { type: 'call', name: 'print', min: 1 }],
        tests: [{ inputs: ['Bence'], expectedLines: ['Bence'] }, { inputs: ['Anna'], expectedLines: ['Anna'] }],
        hints: ['Az <code>input()</code> eredménye már a <code>nev</code> változóban van.', 'A következő sorban írd ki a <code>nev</code> változót.'],
        solution: 'nev = input("Neved: ")\nprint(nev)'
      },
      {
        text: 'A program kérjen be <strong>egy darab szervernevet</strong> <code>input()</code>-tal, mentse a <code>szerver</code> változóba, majd írja ki. Az automatikus ellenőrzés több különböző névvel is kipróbálja.',
        starter: '',
        checks: [{ type: 'call', name: 'input', min: 1 }, { type: 'call', name: 'print', min: 1 }],
        tests: [{ inputs: ['SRV02'], expectedLines: ['SRV02'] }, { inputs: ['DB01'], expectedLines: ['DB01'] }],
        hints: ['Először mentsd el az <code>input()</code> eredményét.', 'Utána <code>print()</code>-tel írd ki.'],
        solution: 'szerver = input("Szerver neve: ")\nprint(szerver)'
      },
      {
        text: 'Kevert gyakorlás: kérd be egymás után a gép nevét és az operációs rendszer nevét, majd írd ki őket két külön sorba. Teszt: <code>PC7</code>, <code>Linux</code>.',
        starter: '',
        checks: [{ type: 'call', name: 'input', min: 2 }, { type: 'call', name: 'print', min: 2 }],
        tests: [{ inputs: ['PC7', 'Linux'], expectedLines: ['PC7', 'Linux'] }, { inputs: ['LAPTOP9', 'Windows'], expectedLines: ['LAPTOP9', 'Windows'] }],
        hints: ['Két külön <code>input()</code> kell.', 'A beolvasás sorrendje egyezzen a feladattal.'],
        solution: 'gep = input("Gép: ")\nos = input("Operációs rendszer: ")\nprint(gep)\nprint(os)'
      }
    ]
  },
  {
    id: 4,
    title: 'int(), float() – szövegből szám',
    objective: 'Tudd a bekért szöveget egész vagy tizedes számmá alakítani.',
    explain: `
      <p>Az <code>input()</code> szöveget ad. Ha számolni szeretnél, alakítsd át.</p>
      <pre><code>db = int(input("Darab: "))
cpu = float(input("CPU: "))</code></pre>
      <p><code>int()</code> egész számhoz, <code>float()</code> tizedes számhoz használható.</p>`,
    tasks: [
      {
        text: 'Kérj be egy egész számot <code>input()</code>-tal, alakítsd át <code>int()</code>-tel, mentsd változóba, majd írd ki. Itt még <strong>nem számolunk</strong>, csak a típusátalakítást gyakoroljuk.',
        starter: '',
        checks: [{ type: 'call', name: 'input', min: 1 }, { type: 'call', name: 'int', min: 1 }, { type: 'call', name: 'print', min: 1 }],
        tests: [{ inputs: ['0016'], expectedLines: ['16'] }, { inputs: ['-02'], expectedLines: ['-2'] }],
        hints: ['Először kérd be az adatot <code>input()</code>-tal.', 'Az <code>int(...)</code> alakítja a szöveget egész számmá. Utána csak írd ki a változót.'],
        solution: 'szam = int(input("Egész szám: "))\nprint(szam)'
      },
      {
        text: 'Kérj be egy tizedes számot, alakítsd át <code>float()</code>-tal, mentsd változóba, majd írd ki. Itt még <strong>nem végzünk műveletet</strong> a számmal.',
        starter: '',
        checks: [{ type: 'call', name: 'input', min: 1 }, { type: 'call', name: 'float', min: 1 }, { type: 'call', name: 'print', min: 1 }],
        tests: [{ inputs: ['72.50'], expectedLines: ['72.5'] }, { inputs: ['000.25'], expectedLines: ['0.25'] }],
        hints: ['Tizedes számhoz <code>float()</code> kell.', 'A <code>float(input(...))</code> közvetlenül is használható.'],
        solution: 'ertek = float(input("Tizedes szám: "))\nprint(ertek)'
      },
      {
        text: 'Önálló gyakorlás: kérj be először egy egész számot, majd egy tizedes számot. Az elsőt alakítsd <code>int()</code>-tel, a másodikat <code>float()</code>-tal, majd írd ki őket két külön sorba. <strong>Most még ne adj össze, ne vonj ki, ne szorozz és ne ossz.</strong>',
        starter: '',
        checks: [
          { type: 'call', name: 'input', min: 2 },
          { type: 'call', name: 'int', min: 1 },
          { type: 'call', name: 'float', min: 1 },
          { type: 'call', name: 'print', min: 2 }
        ],
        tests: [
          { inputs: ['0016', '72.50'], expectedLines: ['16', '72.5'] },
          { inputs: ['0003', '0.25'], expectedLines: ['3', '0.25'] }
        ],
        hints: ['Az első bemenethez <code>int()</code>, a másodikhoz <code>float()</code> kell.', 'Két külön változót írj ki két külön <code>print()</code>-tel.'],
        solution: 'egesz = int(input("Egész szám: "))\ntizedes = float(input("Tizedes szám: "))\nprint(egesz)\nprint(tizedes)'
      }
    ]
  },
  {
    id: 5,
    title: 'Alapműveletek – +, -, *, /',
    objective: 'Tudj alapvető számításokat változókkal elvégezni.',
    explain: `
      <p>A legfontosabb aritmetikai műveletek: <code>+</code> összeadás, <code>-</code> kivonás, <code>*</code> szorzás, <code>/</code> osztás.</p>
      <pre><code>teljes = 100
foglalt = 72
szabad = teljes - foglalt
print(szabad)</code></pre>`,
    tasks: [
      {
        text: 'Kérd be a teljes és a foglalt tárhelyet egész számként, majd írd ki a szabad tárhelyet. Teszt: 100, 72 → 28.',
        starter: '',
        checks: [{ type: 'op', name: 'Sub', min: 1 }, { type: 'call', name: 'int', min: 2 }],
        tests: [{ inputs: ['100', '72'], expectedLines: ['28'] }, { inputs: ['500', '123'], expectedLines: ['377'] }],
        hints: ['A szabad tárhely: teljes mínusz foglalt.', 'Ne fixen 28-at írj ki; a bemenetből számold.'],
        solution: 'teljes = int(input("Teljes: "))\nfoglalt = int(input("Foglalt: "))\nprint(teljes - foglalt)'
      },
      {
        text: 'Kérj be egy darabszámot és egy egységárat egész számként, majd írd ki a teljes árat. Teszt: 4, 1500 → 6000.',
        starter: '',
        checks: [{ type: 'op', name: 'Mult', min: 1 }],
        tests: [{ inputs: ['4', '1500'], expectedLines: ['6000'] }, { inputs: ['3', '799'], expectedLines: ['2397'] }],
        hints: ['A teljes ár = darabszám × egységár.', 'A szorzás jele Pythonban <code>*</code>.'],
        solution: 'db = int(input("Darab: "))\nar = int(input("Egységár: "))\nprint(db * ar)'
      },
      {
        text: 'Kevert gyakorlás: kérd be a teljes tárhelyet és a foglalt tárhelyet, majd írd ki a foglaltság százalékát. Teszt: 200, 50 → 25.0.',
        starter: '',
        checks: [{ type: 'op', name: 'Div', min: 1 }, { type: 'op', name: 'Mult', min: 1 }],
        tests: [{ inputs: ['200', '50'], expectedLines: ['25.0'] }, { inputs: ['80', '20'], expectedLines: ['25.0'] }],
        hints: ['Foglaltság % = foglalt / teljes * 100.', 'Ehhez használhatsz <code>float()</code>-ot.'],
        solution: 'teljes = float(input("Teljes: "))\nfoglalt = float(input("Foglalt: "))\nprint(foglalt / teljes * 100)'
      }
    ]
  },
  {
    id: 6,
    title: '% és // – maradék és egész osztás',
    objective: 'Tudd felismerni az oszthatóságot és használni az egész osztást.',
    explain: `
      <p>A <code>%</code> a maradékos osztás maradékát adja. Például <code>10 % 3</code> eredménye 1.</p>
      <p>A <code>//</code> egész osztást végez: <code>10 // 3</code> eredménye 3.</p>
      <pre><code>szam = 12
print(szam % 2)   # 0, tehát páros</code></pre>`,
    tasks: [
      {
        text: 'Kérj be egy egész számot, és írd ki a 2-vel való osztás maradékát. Teszt: 11 → 1.',
        starter: '',
        checks: [{ type: 'op', name: 'Mod', min: 1 }],
        tests: [{ inputs: ['11'], expectedLines: ['1'] }, { inputs: ['20'], expectedLines: ['0'] }],
        hints: ['A maradékos osztás jele <code>%</code>.', 'A bekért értéket alakítsd egésszé.'],
        solution: 'szam = int(input("Szám: "))\nprint(szam % 2)'
      },
      {
        text: 'Kérj be egy egész számot, és írd ki, hány teljes tízes van benne. Teszt: 47 → 4.',
        starter: '',
        checks: [{ type: 'op', name: 'FloorDiv', min: 1 }],
        tests: [{ inputs: ['47'], expectedLines: ['4'] }, { inputs: ['99'], expectedLines: ['9'] }],
        hints: ['Egész osztáshoz <code>//</code> kell.', 'A tízesek számához 10-zel ossz egész módon.'],
        solution: 'szam = int(input("Szám: "))\nprint(szam // 10)'
      },
      {
        text: 'Kevert gyakorlás: kérj be egy másodpercértéket, majd két külön sorban írd ki, hány teljes perc és hány maradék másodperc. Teszt: 125 → 2 és 5.',
        starter: '',
        checks: [{ type: 'op', name: 'FloorDiv', min: 1 }, { type: 'op', name: 'Mod', min: 1 }],
        tests: [
          { inputs: ['125'], expectedLines: ['2', '5'] },
          { inputs: ['61'], expectedLines: ['1', '1'] }
        ],
        hints: ['A teljes percekhez 60-nal való egész osztás kell.', 'A maradék másodperchez 60-nal való maradékos osztás kell.'],
        solution: 'mp = int(input("Másodperc: "))\nprint(mp // 60)\nprint(mp % 60)'
      }
    ]
  },
  {
    id: 7,
    title: 'f-string – változó a szövegben',
    objective: 'Tudj változókat olvasható mondatokba illeszteni.',
    explain: `
      <p>Az f-stringgel változók értékét közvetlenül beillesztheted a szövegbe. Az idézőjel elé <code>f</code> kerül, a változó pedig kapcsos zárójelbe.</p>
      <pre><code>szerver = "SRV01"
ram = 16
print(f"A {szerver} szerver RAM-ja {ram} GB.")</code></pre>`,
    tasks: [
      {
        text: 'Kérd be a szerver nevét és RAM-ját, majd pontosan ezt a formátumot írd ki: <code>A SRV01 szerver RAM-ja 16 GB.</code> Teszt: SRV01, 16.',
        starter: '',
        checks: [{ type: 'node', name: 'JoinedStr', min: 1 }],
        tests: [{ inputs: ['SRV01', '16'], expectedLines: ['A SRV01 szerver RAM-ja 16 GB.'] }, { inputs: ['WEB02', '32'], expectedLines: ['A WEB02 szerver RAM-ja 32 GB.'] }],
        hints: ['Az idézőjel elé írj <code>f</code>-et.', 'A változókat kapcsos zárójelbe tedd.'],
        solution: 'szerver = input("Szerver: ")\nram = int(input("RAM: "))\nprint(f"A {szerver} szerver RAM-ja {ram} GB.")'
      },
      {
        text: 'Kérd be a nevet és életkort, majd írd ki: <code>Anna 20 éves.</code> Teszt: Anna, 20.',
        starter: '',
        checks: [{ type: 'node', name: 'JoinedStr', min: 1 }],
        tests: [{ inputs: ['Anna', '20'], expectedLines: ['Anna 20 éves.'] }, { inputs: ['Bence', '17'], expectedLines: ['Bence 17 éves.'] }],
        hints: ['Használj f-stringet.', 'A mondat végén legyen pont.'],
        solution: 'nev = input("Név: ")\nkor = int(input("Kor: "))\nprint(f"{nev} {kor} éves.")'
      },
      {
        text: 'Kevert gyakorlás: kérd be a teljes és foglalt tárhelyet, számold ki a szabad helyet, majd írd ki: <code>Szabad tárhely: 28 GB</code>. Teszt: 100, 72.',
        starter: '',
        checks: [{ type: 'node', name: 'JoinedStr', min: 1 }, { type: 'op', name: 'Sub', min: 1 }],
        tests: [{ inputs: ['100', '72'], expectedLines: ['Szabad tárhely: 28 GB'] }, { inputs: ['500', '123'], expectedLines: ['Szabad tárhely: 377 GB'] }],
        hints: ['Előbb számold ki a különbséget.', 'Az eredményt f-stringgel illeszd a szövegbe.'],
        solution: 'teljes = int(input("Teljes: "))\nfoglalt = int(input("Foglalt: "))\nszabad = teljes - foglalt\nprint(f"Szabad tárhely: {szabad} GB")'
      }
    ]
  },
  {
    id: 8,
    title: 'if – döntés a programban',
    objective: 'Tudj egy feltételt megvizsgálni és annak megfelelően cselekedni.',
    explain: `
      <p>Az <code>if</code> csak akkor hajtja végre a behúzott kódot, ha a feltétel igaz.</p>
      <pre><code>cpu = float(input("CPU: "))
if cpu &gt;= 90:
    print("KRITIKUS")</code></pre>
      <p>Az <code>if</code> sorának végén kettőspont van. A hozzá tartozó kódot négy szóközzel beljebb írjuk.</p>`,
    tasks: [
      {
        text: 'Kérd be a CPU-terhelést. Ha legalább 90, írd ki: <code>KRITIKUS</code>.',
        starter: '',
        checks: [{ type: 'node', name: 'If', min: 1 }, { type: 'call', name: 'float', min: 1 }],
        tests: [{ inputs: ['95'], expectedLines: ['KRITIKUS'] }, { inputs: ['90'], expectedLines: ['KRITIKUS'] }, { inputs: ['89'], expectedLines: [] }],
        hints: ['A feltétel azt jelenti: CPU legalább 90.', 'Az <code>if</code> utáni sor legyen behúzva.'],
        solution: 'cpu = float(input("CPU: "))\nif cpu >= 90:\n    print("KRITIKUS")'
      },
      {
        text: 'Kérj be egy egész számot. Ha nagyobb 10-nél, írd ki: <code>Nagyobb 10-nél</code>.',
        starter: '',
        checks: [{ type: 'node', name: 'If', min: 1 }, { type: 'call', name: 'int', min: 1 }],
        tests: [{ inputs: ['15'], expectedLines: ['Nagyobb 10-nél'] }, { inputs: ['11'], expectedLines: ['Nagyobb 10-nél'] }, { inputs: ['10'], expectedLines: [] }],
        hints: ['A feltétel: a szám nagyobb 10-nél.', 'A <code>print()</code> az <code>if</code> belsejében legyen.'],
        solution: 'szam = int(input("Szám: "))\nif szam > 10:\n    print("Nagyobb 10-nél")'
      },
      {
        text: 'Kevert gyakorlás: kérd be a szabad tárhelyet. Ha 20 GB-nál kevesebb, írd ki: <code>Kevés tárhely</code>.',
        starter: '',
        checks: [{ type: 'node', name: 'If', min: 1 }],
        tests: [{ inputs: ['12'], expectedLines: ['Kevés tárhely'] }, { inputs: ['1'], expectedLines: ['Kevés tárhely'] }, { inputs: ['20'], expectedLines: [] }],
        hints: ['Most a <code>&lt;</code> összehasonlítás kell.', 'A kiírás csak igaz feltételnél fusson.'],
        solution: 'szabad = float(input("Szabad tárhely: "))\nif szabad < 20:\n    print("Kevés tárhely")'
      }
    ]
  },
  {
    id: 9,
    title: 'if / elif / else – több lehetséges eset',
    objective: 'Tudj több, egymást kizáró esetet kezelni.',
    explain: `
      <p>Ha több esetet kell kezelni, használhatsz <code>if</code>, <code>elif</code> és <code>else</code> ágakat.</p>
      <pre><code>if cpu &gt;= 90:
    print("KRITIKUS")
elif cpu &gt;= 70:
    print("FIGYELMEZTETÉS")
else:
    print("OK")</code></pre>
      <p>A sorrend számít: általában a legszigorúbb feltétellel kezdesz.</p>`,
    tasks: [
      {
        text: 'CPU-státusz: 90-től <code>KRITIKUS</code>, 70-től <code>FIGYELMEZTETÉS</code>, egyébként <code>OK</code>.',
        starter: 'cpu = float(input("CPU (%): "))\n',
        checks: [{ type: 'node', name: 'If', min: 1 }],
        tests: [
          { inputs: ['95'], expectedLines: ['KRITIKUS'] },
          { inputs: ['75'], expectedLines: ['FIGYELMEZTETÉS'] },
          { inputs: ['40'], expectedLines: ['OK'] },
          { inputs: ['90'], expectedLines: ['KRITIKUS'] },
          { inputs: ['70'], expectedLines: ['FIGYELMEZTETÉS'] },
          { inputs: ['89'], expectedLines: ['FIGYELMEZTETÉS'] },
          { inputs: ['69'], expectedLines: ['OK'] }
        ],
        hints: ['A 90-es határt vizsgáld előbb.', 'A második esethez <code>elif</code>, a maradékhoz <code>else</code> kell.'],
        solution: 'cpu = float(input("CPU (%): "))\nif cpu >= 90:\n    print("KRITIKUS")\nelif cpu >= 70:\n    print("FIGYELMEZTETÉS")\nelse:\n    print("OK")'
      },
      {
        text: 'Kérj be egy egész számot. Pozitívnál <code>pozitív</code>, nullánál <code>nulla</code>, negatívnál <code>negatív</code> legyen a kimenet.',
        starter: '',
        checks: [{ type: 'node', name: 'If', min: 1 }],
        tests: [
          { inputs: ['4'], expectedLines: ['pozitív'] },
          { inputs: ['0'], expectedLines: ['nulla'] },
          { inputs: ['-3'], expectedLines: ['negatív'] }
        ],
        hints: ['Három eset van.', 'A nullát külön <code>elif</code> ággal kezelheted.'],
        solution: 'szam = int(input("Szám: "))\nif szam > 0:\n    print("pozitív")\nelif szam == 0:\n    print("nulla")\nelse:\n    print("negatív")'
      },
      {
        text: 'Kevert gyakorlás: kérd be a RAM-terhelést. 85-től <code>MAGAS</code>, 60-tól <code>KÖZEPES</code>, különben <code>ALACSONY</code>.',
        starter: '',
        checks: [{ type: 'node', name: 'If', min: 1 }],
        tests: [
          { inputs: ['90'], expectedLines: ['MAGAS'] },
          { inputs: ['60'], expectedLines: ['KÖZEPES'] },
          { inputs: ['25'], expectedLines: ['ALACSONY'] }
        ],
        hints: ['A nagyobb határértékkel kezdd.', 'Minden bemenetnek pontosan egy ágba kell esnie.'],
        solution: 'ram = float(input("RAM: "))\nif ram >= 85:\n    print("MAGAS")\nelif ram >= 60:\n    print("KÖZEPES")\nelse:\n    print("ALACSONY")'
      }
    ]
  },
  {
    id: 10,
    title: 'and / or – összetett feltételek',
    objective: 'Tudj egyszerre több feltételt összekapcsolni.',
    explain: `
      <p>Az <code>and</code> akkor igaz, ha mindkét feltétel igaz. Az <code>or</code> akkor igaz, ha legalább az egyik igaz.</p>
      <pre><code>if cpu &gt;= 90 and ram &gt;= 90:
    print("KRITIKUS")</code></pre>`,
    tasks: [
      {
        text: 'Kérd be a CPU és RAM terhelést. Ha mindkettő legalább 90, írd ki: <code>KRITIKUS</code>, különben <code>NEM KRITIKUS</code>.',
        starter: '',
        checks: [{ type: 'op', name: 'And', min: 1 }, { type: 'node', name: 'If', min: 1 }],
        tests: [
          { inputs: ['95', '91'], expectedLines: ['KRITIKUS'] },
          { inputs: ['95', '50'], expectedLines: ['NEM KRITIKUS'] },
          { inputs: ['50', '95'], expectedLines: ['NEM KRITIKUS'] },
          { inputs: ['90', '90'], expectedLines: ['KRITIKUS'] },
          { inputs: ['89', '90'], expectedLines: ['NEM KRITIKUS'] }
        ],
        hints: ['Mindkét feltételnek teljesülnie kell.', 'Ehhez az <code>and</code> operátor kell.'],
        solution: 'cpu = float(input("CPU: "))\nram = float(input("RAM: "))\nif cpu >= 90 and ram >= 90:\n    print("KRITIKUS")\nelse:\n    print("NEM KRITIKUS")'
      },
      {
        text: 'Kérd be a CPU és RAM terhelést. Ha bármelyik legalább 90, írd ki: <code>Riasztás</code>, különben <code>OK</code>.',
        starter: '',
        checks: [{ type: 'op', name: 'Or', min: 1 }, { type: 'node', name: 'If', min: 1 }],
        tests: [
          { inputs: ['92', '40'], expectedLines: ['Riasztás'] },
          { inputs: ['40', '95'], expectedLines: ['Riasztás'] },
          { inputs: ['40', '50'], expectedLines: ['OK'] },
          { inputs: ['90', '40'], expectedLines: ['Riasztás'] },
          { inputs: ['40', '90'], expectedLines: ['Riasztás'] },
          { inputs: ['89', '89'], expectedLines: ['OK'] }
        ],
        hints: ['Elég, ha az egyik feltétel igaz.', 'Ehhez az <code>or</code> operátor kell.'],
        solution: 'cpu = float(input("CPU: "))\nram = float(input("RAM: "))\nif cpu >= 90 or ram >= 90:\n    print("Riasztás")\nelse:\n    print("OK")'
      },
      {
        text: 'Kevert gyakorlás: kérj be egy portszámot. Ha 1024 és 49151 közé esik, a határokat is beleértve, írd ki: <code>regisztrált/tartomány</code>, különben <code>más</code>.',
        starter: '',
        checks: [{ type: 'rangeCondition', min: 1 }],
        tests: [
          { inputs: ['1024'], expectedLines: ['regisztrált/tartomány'] },
          { inputs: ['3000'], expectedLines: ['regisztrált/tartomány'] },
          { inputs: ['49151'], expectedLines: ['regisztrált/tartomány'] },
          { inputs: ['1023'], expectedLines: ['más'] },
          { inputs: ['49152'], expectedLines: ['más'] },
          { inputs: ['60000'], expectedLines: ['más'] }
        ],
        hints: ['Két határfeltételt kell összekötni.', 'A feltétel lehet: alsó határ <= port és port <= felső határ.'],
        solution: 'port = int(input("Port: "))\nif port >= 1024 and port <= 49151:\n    print("regisztrált/tartomány")\nelse:\n    print("más")'
      }
    ]
  },
  {
    id: 11,
    title: 'Listák és indexelés',
    objective: 'Tudj több értéket listában tárolni és elemeket index alapján elérni.',
    explain: `
      <p>A lista több értéket tárol sorrendben.</p>
      <pre><code>szerverek = ["SRV01", "SRV02", "SRV03"]
print(szerverek[0])
print(szerverek[-1])</code></pre>
      <p>Az első elem indexe 0. A <code>-1</code> az utolsó elemet jelenti.</p>`,
    tasks: [
      {
        text: 'Hozd létre az <code>["SRV01", "SRV02", "SRV03"]</code> listát és írd ki az első elemét.',
        starter: '',
        checks: [{ type: 'node', name: 'List', min: 1 }, { type: 'node', name: 'Subscript', min: 1 }],
        tests: [{ inputs: [], expectedLines: ['SRV01'] }],
        hints: ['Az első elem indexe 0.', 'Az elem elérése: <code>lista[0]</code>.'],
        solution: 'szerverek = ["SRV01", "SRV02", "SRV03"]\nprint(szerverek[0])'
      },
      {
        text: 'Ugyanebből a listából írd ki az utolsó elemet <code>-1</code> indexszel.',
        starter: 'szerverek = ["SRV01", "SRV02", "SRV03"]\n',
        checks: [{ type: 'node', name: 'Subscript', min: 1 }],
        tests: [{ inputs: [], expectedLines: ['SRV03'] }],
        hints: ['Az utolsó elem röviden <code>lista[-1]</code>.', 'Ne írd ki fixen az értéket.'],
        solution: 'szerverek = ["SRV01", "SRV02", "SRV03"]\nprint(szerverek[-1])'
      },
      {
        text: 'Kevert gyakorlás: készíts <code>[10, 20, 30, 40]</code> listát, majd írd ki a második és a negyedik elemet két külön sorba.',
        starter: '',
        checks: [{ type: 'node', name: 'List', min: 1 }, { type: 'node', name: 'Subscript', min: 2 }],
        tests: [{ inputs: [], expectedLines: ['20', '40'] }],
        hints: ['A második elem indexe 1.', 'A negyedik elem indexe 3.'],
        solution: 'szamok = [10, 20, 30, 40]\nprint(szamok[1])\nprint(szamok[3])'
      }
    ]
  },
  {
    id: 12,
    title: 'len() és append() – lista kezelése',
    objective: 'Tudd megszámolni a lista elemeit és új elemet hozzáadni.',
    explain: `
      <p>A <code>len(lista)</code> megadja, hány elem van a listában. Az <code>append()</code> új elemet tesz a lista végére.</p>
      <pre><code>szerverek = ["SRV01", "SRV02"]
szerverek.append("SRV03")
print(len(szerverek))</code></pre>`,
    tasks: [
      {
        text: 'Készíts <code>["PC1", "PC2", "PC3"]</code> listát és írd ki az elemszámát <code>len()</code>-nel.',
        starter: '',
        checks: [{ type: 'call', name: 'len', min: 1 }],
        tests: [{ inputs: [], expectedLines: ['3'] }],
        hints: ['Az elemszámhoz <code>len(lista)</code> kell.', 'A <code>len()</code> eredményét írd ki.'],
        solution: 'gepek = ["PC1", "PC2", "PC3"]\nprint(len(gepek))'
      },
      {
        text: 'Indulj a <code>["SRV01", "SRV02"]</code> listából. Adj hozzá <code>SRV03</code>-at <code>append()</code>-del, majd írd ki az egész listát.',
        starter: 'szerverek = ["SRV01", "SRV02"]\n',
        checks: [{ type: 'call', name: 'append', min: 1 }],
        tests: [{ inputs: [], expectedLines: ["['SRV01', 'SRV02', 'SRV03']"] }],
        hints: ['A lista végére a <code>lista.append(érték)</code> tesz új elemet.', 'Utána írd ki magát a listát.'],
        solution: 'szerverek = ["SRV01", "SRV02"]\nszerverek.append("SRV03")\nprint(szerverek)'
      },
      {
        text: 'Kevert gyakorlás: kérj be két szervernevet, tedd őket egy kezdetben üres listába <code>append()</code>-del, majd írd ki a lista hosszát.',
        starter: 'szerverek = []\n',
        checks: [{ type: 'listAdd', min: 1 }, { type: 'call', name: 'len', min: 1 }],
        tests: [{ inputs: ['A', 'B'], expectedLines: ['2'] }, { inputs: ['SRV01', 'WEB02'], expectedLines: ['2'] }],
        hints: ['Kétszer kérj be adatot és kétszer hívd az <code>append()</code>-et.', 'A végén <code>len(szerverek)</code> adja az elemszámot.'],
        solution: 'szerverek = []\nszerverek.append(input("1. szerver: "))\nszerverek.append(input("2. szerver: "))\nprint(len(szerverek))'
      }
    ]
  },
  {
    id: 13,
    title: 'for ciklus – lista bejárása',
    objective: 'Tudj listaelemeket egyenként feldolgozni.',
    explain: `
      <p>A <code>for</code> ciklussal végighaladunk egy sorozat elemein.</p>
      <pre><code>szerverek = ["SRV01", "SRV02", "SRV03"]
for szerver in szerverek:
    print(szerver)</code></pre>
      <p>Minden körben a ciklusváltozó a lista következő elemét kapja.</p>`,
    tasks: [
      {
        text: 'For ciklussal járd be az <code>["SRV01", "SRV02", "SRV03"]</code> listát és írd ki minden elemét külön sorba.',
        starter: 'szerverek = ["SRV01", "SRV02", "SRV03"]\n',
        checks: [{ type: 'node', name: 'For', min: 1 }],
        tests: [{ inputs: [], expectedLines: ['SRV01', 'SRV02', 'SRV03'] }],
        hints: ['A ciklus alakja: <code>for elem in lista:</code>.', 'A ciklus törzse legyen behúzva.'],
        solution: 'szerverek = ["SRV01", "SRV02", "SRV03"]\nfor szerver in szerverek:\n    print(szerver)'
      },
      {
        text: 'Járd be for ciklussal a <code>[10, 20, 30]</code> listát és írd ki minden szám kétszeresét.',
        starter: 'szamok = [10, 20, 30]\n',
        checks: [{ type: 'node', name: 'For', min: 1 }, { type: 'op', name: 'Mult', min: 1 }],
        tests: [{ inputs: [], expectedLines: ['20', '40', '60'] }],
        hints: ['A ciklusváltozó minden körben egy szám.', 'A kétszereshez szorozd 2-vel.'],
        solution: 'szamok = [10, 20, 30]\nfor szam in szamok:\n    print(szam * 2)'
      },
      {
        text: 'Kevert gyakorlás: járd be a <code>["SRV01", "SRV02"]</code> listát és f-stringgel írd ki: <code>Szerver: SRV01</code>, majd <code>Szerver: SRV02</code>.',
        starter: 'szerverek = ["SRV01", "SRV02"]\n',
        checks: [{ type: 'node', name: 'For', min: 1 }, { type: 'node', name: 'JoinedStr', min: 1 }],
        tests: [{ inputs: [], expectedLines: ['Szerver: SRV01', 'Szerver: SRV02'] }],
        hints: ['A ciklusváltozó az aktuális szervernevet tartalmazza.', 'A kiíráshoz használd a korábban tanult f-stringet.'],
        solution: 'szerverek = ["SRV01", "SRV02"]\nfor szerver in szerverek:\n    print(f"Szerver: {szerver}")'
      }
    ]
  },
  {
    id: 14,
    title: 'range() és for + if',
    objective: 'Tudj számsorozatot bejárni és cikluson belül feltételt vizsgálni.',
    explain: `
      <p>A <code>range()</code> egész számok sorozatát adja a ciklusnak. A felső határ nem része a sorozatnak.</p>
      <pre><code>for i in range(1, 6):
    if i % 2 == 0:
        print(i)</code></pre>`,
    tasks: [
      {
        text: 'For ciklussal és <code>range()</code>-dzsel írd ki az 1, 2, 3, 4, 5 számokat.',
        starter: '',
        checks: [{ type: 'call', name: 'range', min: 1 }, { type: 'node', name: 'For', min: 1 }],
        tests: [{ inputs: [], expectedLines: ['1', '2', '3', '4', '5'] }],
        hints: ['Az 1-től 5-ig tartó sorozathoz a felső határ 6.', 'Használj <code>range(1, 6)</code>-ot.'],
        solution: 'for i in range(1, 6):\n    print(i)'
      },
      {
        text: 'Írd ki 1-től 10-ig csak a páros számokat. Használj <code>for</code>, <code>range()</code>, <code>if</code> és <code>%</code> elemeket.',
        starter: '',
        checks: [{ type: 'node', name: 'For', min: 1 }, { type: 'node', name: 'If', min: 1 }, { type: 'op', name: 'Mod', min: 1 }],
        tests: [{ inputs: [], expectedLines: ['2', '4', '6', '8', '10'] }],
        hints: ['Minden számnál vizsgáld meg a 2-vel való osztás maradékát.', 'Páros, ha a maradék 0.'],
        solution: 'for i in range(1, 11):\n    if i % 2 == 0:\n        print(i)'
      },
      {
        text: 'Kevert gyakorlás: járd be a <code>[20, 95, 70, 99]</code> CPU-listát és csak a legalább 90-es értékeket írd ki.',
        starter: 'cpu_ertekek = [20, 95, 70, 99]\n',
        checks: [{ type: 'node', name: 'For', min: 1 }, { type: 'node', name: 'If', min: 1 }],
        tests: [{ inputs: [], expectedLines: ['95', '99'] }],
        hints: ['A cikluson belül kell az <code>if</code>.', 'A feltétel: az aktuális CPU legalább 90.'],
        solution: 'cpu_ertekek = [20, 95, 70, 99]\nfor cpu in cpu_ertekek:\n    if cpu >= 90:\n        print(cpu)'
      }
    ]
  },
  {
    id: 15,
    title: 'while és += – ismétlés feltételig',
    objective: 'Tudj feltétel alapján ismételni és a ciklusváltozót módosítani.',
    explain: `
      <p>A <code>while</code> addig ismétel, amíg a feltétele igaz.</p>
      <pre><code>i = 1
while i &lt;= 3:
    print(i)
    i += 1</code></pre>
      <p>Az <code>i += 1</code> ugyanazt jelenti, mint az <code>i = i + 1</code>. Fontos, hogy a ciklusban változzon a feltételhez kapcsolódó érték, különben végtelen ciklus lehet.</p>`,
    tasks: [
      {
        text: 'While ciklussal írd ki az 1, 2, 3 számokat.',
        starter: 'i = 1\n',
        checks: [{ type: 'node', name: 'While', min: 1 }],
        tests: [{ inputs: [], expectedLines: ['1', '2', '3'] }],
        hints: ['A feltétel lehet <code>i &lt;= 3</code>.', 'Minden kör végén növeld az <code>i</code> értékét.'],
        solution: 'i = 1\nwhile i <= 3:\n    print(i)\n    i += 1'
      },
      {
        text: 'While ciklussal készíts visszaszámlálást: 3, 2, 1.',
        starter: 'szam = 3\n',
        checks: [{ type: 'node', name: 'While', min: 1 }],
        tests: [{ inputs: [], expectedLines: ['3', '2', '1'] }],
        hints: ['Most csökkenteni kell a változót.', 'A rövid alak: <code>szam -= 1</code>.'],
        solution: 'szam = 3\nwhile szam >= 1:\n    print(szam)\n    szam -= 1'
      },
      {
        text: 'Kevert gyakorlás: kérj be egy kezdő egész számot, és while ciklussal írd ki attól 1-ig visszafelé. Rejtett teszt: 4 → 4,3,2,1 és 2 → 2,1.',
        starter: '',
        checks: [{ type: 'node', name: 'While', min: 1 }, { type: 'call', name: 'int', min: 1 }],
        tests: [
          { inputs: ['4'], expectedLines: ['4', '3', '2', '1'] },
          { inputs: ['2'], expectedLines: ['2', '1'] }
        ],
        hints: ['A kezdőérték most az <code>input()</code>-ból jön.', 'Minden körben csökkentsd 1-gyel.'],
        solution: 'szam = int(input("Kezdőszám: "))\nwhile szam >= 1:\n    print(szam)\n    szam -= 1'
      }
    ]
  },
  {
    id: 16,
    title: 'Függvények – def, paraméter, return',
    objective: 'Tudj saját függvényt írni paraméterrel és visszatérési értékkel.',
    explain: `
      <p>A függvény egy névvel ellátott, újra felhasználható kódrészlet. A paraméter bemenet, a <code>return</code> pedig visszaad egy eredményt.</p>
      <pre><code>def osszeg(a, b):
    return a + b

print(osszeg(12, 8))</code></pre>
      <p>Vizsgán fontos, hogy önállóan tudj függvényt definiálni, meghívni, paramétereket és visszatérési értéket használni.</p>`,
    tasks: [
      {
        text: 'Írj <code>osszeg(a, b)</code> függvényt, amely visszaadja a két paraméter összegét. A tesztelő több különböző paraméterrel fogja meghívni.',
        starter: 'def osszeg(a, b):\n    \n',
        checks: [{ type: 'function', name: 'osszeg', minArgs: 2 }, { type: 'node', name: 'Return', min: 1 }],
        functionTests: [
          { functionName: 'osszeg', args: [12, 8], expected: 20 },
          { functionName: 'osszeg', args: [-4, 10], expected: 6 },
          { functionName: 'osszeg', args: [0, 0], expected: 0 }
        ],
        hints: ['A függvény fejlécében legyen két paraméter.', 'A függvény belsejében <code>return a + b</code> jellegű visszatérés kell.'],
        solution: 'def osszeg(a, b):\n    return a + b'
      },
      {
        text: 'Írj <code>cpu_statusz(cpu)</code> függvényt. 90-től adjon vissza <code>KRITIKUS</code>, 70-től <code>FIGYELMEZTETÉS</code>, különben <code>OK</code>.',
        starter: 'def cpu_statusz(cpu):\n    \n',
        checks: [{ type: 'function', name: 'cpu_statusz', minArgs: 1 }, { type: 'node', name: 'If', min: 1 }, { type: 'node', name: 'Return', min: 1 }],
        functionTests: [
          { functionName: 'cpu_statusz', args: [95], expected: 'KRITIKUS' },
          { functionName: 'cpu_statusz', args: [75], expected: 'FIGYELMEZTETÉS' },
          { functionName: 'cpu_statusz', args: [20], expected: 'OK' },
          { functionName: 'cpu_statusz', args: [90], expected: 'KRITIKUS' },
          { functionName: 'cpu_statusz', args: [70], expected: 'FIGYELMEZTETÉS' },
          { functionName: 'cpu_statusz', args: [89], expected: 'FIGYELMEZTETÉS' },
          { functionName: 'cpu_statusz', args: [69], expected: 'OK' }
        ],
        hints: ['A függvényen belül ugyanúgy használhatsz <code>if / elif / else</code>-t.', 'Minden ágban <code>return</code>-nel adj vissza szöveget.'],
        solution: 'def cpu_statusz(cpu):\n    if cpu >= 90:\n        return "KRITIKUS"\n    elif cpu >= 70:\n        return "FIGYELMEZTETÉS"\n    else:\n        return "OK"'
      },
      {
        text: 'Kevert gyakorlás: írj <code>paros(szam)</code> függvényt, amely <code>True</code>-t ad vissza páros számnál és <code>False</code>-t páratlannál.',
        starter: 'def paros(szam):\n    \n',
        checks: [{ type: 'function', name: 'paros', minArgs: 1 }, { type: 'op', name: 'Mod', min: 1 }, { type: 'node', name: 'Return', min: 1 }],
        functionTests: [
          { functionName: 'paros', args: [12], expected: true },
          { functionName: 'paros', args: [7], expected: false },
          { functionName: 'paros', args: [0], expected: true }
        ],
        hints: ['A párosság feltétele: a 2-vel való osztás maradéka 0.', 'A feltétel eredményét akár közvetlenül is visszaadhatod.'],
        solution: 'def paros(szam):\n    return szam % 2 == 0'
      }
    ]
  }
];

export const totalTasks = lessons.reduce((sum, lesson) => sum + lesson.tasks.length, 0);

export function flattenTasks() {
  const result = [];
  lessons.forEach((lesson, lessonIndex) => {
    lesson.tasks.forEach((task, taskIndex) => {
      result.push({ lesson, task, lessonIndex, taskIndex, key: `${lesson.id}.${taskIndex + 1}` });
    });
  });
  return result;
}
