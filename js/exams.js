import { checkpointExams } from './checkpoint-exams.js';

export const exams = [
  ...checkpointExams,
  {
    id: 'alapok',
    title: 'Részvizsga 1 – Python alapok',
    description: 'print, input, típuskonverzió, műveletek, %, //, f-string',
    durationMinutes: 20,
    tasks: [
      {
        title: '1. feladat – Összegzés', points: 6,
        text: 'Kérj be két egész számot, majd írd ki az összegüket.', starter: '',
        checks: [
          { label:'Két input() használata', points:1, type:'call', name:'input', min:2 },
          { label:'int() típuskonverzió', points:1, type:'call', name:'int', min:2 },
          { label:'Összeadás', points:1, type:'op', name:'Add', min:1 }
        ],
        tests: [
          { inputs:['12','8'], expectedLines:['20'], points:1.5 },
          { inputs:['-3','10'], expectedLines:['7'], points:1.5 }
        ]
      },
      {
        title: '2. feladat – Párosság', points: 7,
        text: 'Kérj be egy egész számot. Írd ki pontosan azt, hogy PÁROS, ha páros, különben azt, hogy PÁRATLAN.', starter: '',
        checks: [
          { label:'if feltétel', points:1, type:'node', name:'If', min:1 },
          { label:'Maradékos osztás (%)', points:1.5, type:'op', name:'Mod', min:1 }
        ],
        tests: [
          { inputs:['12'], expectedLines:['PÁROS'], points:2.25 },
          { inputs:['7'], expectedLines:['PÁRATLAN'], points:2.25 }
        ]
      },
      {
        title: '3. feladat – Szerveradat', points: 7,
        text: 'Kérd be a szerver nevét és RAM-méretét egész számként. Írd ki f-stringgel pontosan: A SRV01 szerver RAM-ja 16 GB. A rejtett tesztek más adatokat is használnak.', starter: '',
        checks: [
          { label:'f-string', points:2, type:'node', name:'JoinedStr', min:1 },
          { label:'int() a RAM-hoz', points:1, type:'call', name:'int', min:1 }
        ],
        tests: [
          { inputs:['SRV01','16'], expectedLines:['A SRV01 szerver RAM-ja 16 GB.'], points:2 },
          { inputs:['WEB02','32'], expectedLines:['A WEB02 szerver RAM-ja 32 GB.'], points:2 }
        ]
      }
    ]
  },
  {
    id: 'vezerles',
    title: 'Részvizsga 2 – Vezérlés és adatszerkezetek',
    description: 'if/elif/else, and/or, lista, for, range, while',
    durationMinutes: 25,
    tasks: [
      {
        title:'1. feladat – CPU-státusz', points:10,
        text:'Kérd be a CPU-terhelést egész számként. 90-től KRITIKUS, 70-től FIGYELMEZTETÉS, egyébként OK legyen a kimenet.', starter:'',
        checks:[
          {label:'if használata',points:1,type:'node',name:'If',min:1},
          {label:'Legalább két összehasonlítás',points:1,type:'comparisons',min:2}
        ],
        tests:[
          {inputs:['95'],expectedLines:['KRITIKUS'],points:2.5},
          {inputs:['75'],expectedLines:['FIGYELMEZTETÉS'],points:2.5},
          {inputs:['40'],expectedLines:['OK'],points:2.5},
          {inputs:['90'],expectedLines:['KRITIKUS'],points:.5}
        ]
      },
      {
        title:'2. feladat – Lista bejárása', points:10,
        text:'Hozd létre az [12, 7, 20, 5] listát, és for ciklussal számold meg, hány eleme nagyobb 10-nél. Csak a darabszámot írd ki.', starter:'',
        checks:[
          {label:'lista',points:1,type:'node',name:'List',min:1},
          {label:'for ciklus',points:2,type:'node',name:'For',min:1},
          {label:'if feltétel',points:1,type:'node',name:'If',min:1}
        ],
        tests:[{inputs:[],expectedLines:['2'],points:6}]
      },
      {
        title:'3. feladat – range és feltétel', points:10,
        text:'For ciklussal járd be az 1-től 10-ig terjedő egész számokat, add össze a párosakat, és csak az összeget írd ki.', starter:'',
        checks:[
          {label:'for ciklus',points:1.5,type:'node',name:'For',min:1},
          {label:'range()',points:1.5,type:'call',name:'range',min:1},
          {label:'maradékos osztás',points:1.5,type:'op',name:'Mod',min:1},
          {label:'összeadás',points:1.5,type:'op',name:'Add',min:1}
        ],
        tests:[{inputs:[],expectedLines:['30'],points:4}]
      }
    ]
  },
  {
    id:'fuggvenyek',
    title:'Részvizsga 3 – Függvények',
    description:'def, paraméter, return, függvény + döntés',
    durationMinutes:25,
    tasks:[
      {
        title:'1. feladat – osszeg()', points:10,
        text:'Írj osszeg(a, b) függvényt, amely visszaadja a két paraméter összegét. Nem kell meghívnod vagy kiírnod.', starter:'def osszeg(a, b):\n    ',
        checks:[
          {label:'osszeg(a,b) függvény',points:2,type:'function',name:'osszeg',minArgs:2},
          {label:'return',points:2,type:'node',name:'Return',min:1}
        ],
        functionTests:[
          {functionName:'osszeg',args:[12,8],expected:20,points:2},
          {functionName:'osszeg',args:[-3,10],expected:7,points:2},
          {functionName:'osszeg',args:[0,0],expected:0,points:2}
        ]
      },
      {
        title:'2. feladat – cpu_statusz()', points:20,
        text:'Írj cpu_statusz(cpu) függvényt. 90-től KRITIKUS, 70-től FIGYELMEZTETÉS, egyébként OK értéket adjon vissza.', starter:'def cpu_statusz(cpu):\n    ',
        checks:[
          {label:'cpu_statusz(cpu) függvény',points:3,type:'function',name:'cpu_statusz',minArgs:1},
          {label:'if/elif logika',points:3,type:'node',name:'If',min:1},
          {label:'return használata',points:3,type:'node',name:'Return',min:1}
        ],
        functionTests:[
          {functionName:'cpu_statusz',args:[95],expected:'KRITIKUS',points:3},
          {functionName:'cpu_statusz',args:[75],expected:'FIGYELMEZTETÉS',points:3},
          {functionName:'cpu_statusz',args:[20],expected:'OK',points:3},
          {functionName:'cpu_statusz',args:[90],expected:'KRITIKUS',points:1},
          {functionName:'cpu_statusz',args:[70],expected:'FIGYELMEZTETÉS',points:1}
        ]
      }
    ]
  },
  {
    id:'agazati-8-14-18',
    requiredCheckpoint:'checkpoint-8',
    title:'Vizsgaszimuláció – 8 + 14 + 18 pont',
    description:'Három egymásra épülő, összesen 40 pontos Python-feladat. Csak a fájlkezelés és objektumkezelés megtanulása után nyílik meg. Nincs AI, tipp vagy mintamegoldás; részpont jár a részben helyes kódért.',
    durationMinutes:45,
    examMode:true,
    tasks:[
      {
        title:'1. feladat – Működő gépek', points:8,
        text:'Kérd be az összes gép és a hibás gépek számát egész számként. Írd ki egyetlen sorban a működő gépek számát.', starter:'',
        checks:[
          {label:'Két int() típuskonverzió',points:1,type:'call',name:'int',min:2},
          {label:'Kivonás használata',points:1,type:'op',name:'Sub',min:1}
        ],
        tests:[
          {inputs:['30','4'],expectedLines:['26'],points:3},
          {inputs:['12','0'],expectedLines:['12'],points:3}
        ]
      },
      {
        title:'2. feladat – kritikus_db()', points:14,
        text:'Írj kritikus_db(ertekek) függvényt. A paraméter egy számlista. A függvény adja vissza, hány érték legalább 90. Ne kérj be adatot és ne írj ki semmit.', starter:'def kritikus_db(ertekek):\n    ',
        checks:[
          {label:'kritikus_db() függvény',points:2,type:'function',name:'kritikus_db',minArgs:1},
          {label:'for ciklus',points:2,type:'node',name:'For',min:1},
          {label:'if feltétel',points:2,type:'node',name:'If',min:1}
        ],
        functionTests:[
          {functionName:'kritikus_db',args:[[95,70,91,20]],expected:2,points:3},
          {functionName:'kritikus_db',args:[[90,89,100,90]],expected:3,points:3},
          {functionName:'kritikus_db',args:[[]],expected:0,points:2}
        ]
      },
      {
        title:'3. feladat – Szerverfájl és objektumok', points:18,
        text:'A szerverek.txt minden sora név;terhelés formájú. Készíts Szerver osztályt név és terhelés attribútummal, olvasd be a fájlt objektumokba, majd írd a legalább 90%-os szerverek nevét soronként a kritikus.txt fájlba. Végül írd ki a kritikus szerverek darabszámát.', starter:'',
        checks:[
          {label:'Szerver osztály',points:2,type:'node',name:'ClassDef',min:1},
          {label:'__init__ metódus',points:2,type:'function',name:'__init__',minArgs:3},
          {label:'Fájlmegnyitás open()',points:2,type:'call',name:'open',min:1},
          {label:'for ciklus',points:2,type:'node',name:'For',min:1}
        ],
        fileTests:[
          {
            files:{'szerverek.txt':'SRV01;95\nWEB02;72\nDB03;91\n'},
            readFiles:['kritikus.txt'],
            expectedFiles:{'kritikus.txt':'SRV01\nDB03\n'},
            expectedLines:['2'],
            points:5
          },
          {
            files:{'szerverek.txt':'A;20\nB;90\nC;89\nD;100\n'},
            readFiles:['kritikus.txt'],
            expectedFiles:{'kritikus.txt':'B\nD\n'},
            expectedLines:['2'],
            points:5
          }
        ]
      }
    ]
  },
  {
    id:'halado-vizsgaelemek',
    requiredCheckpoint:'checkpoint-8',
    title:'Részvizsga 4 – Modulok, fájlok és objektumok',
    description:'A technikusi Python-feladatokhoz fontos haladó elemek külön gyakorlása. A 17–28. leckék és a hozzájuk tartozó kisvizsgák teljesítése után nyílik meg.',
    durationMinutes:30,
    tasks:[
      {
        title:'1. feladat – math modul', points:8,
        text:'Importáld a math modult. Kérj be egy sugarat floatként, és írd ki a kör területét két tizedesre kerekítve. A képlet: pi * r ** 2.', starter:'',
        checks:[
          {label:'import használata',points:2,type:'node',name:'Import',min:1},
          {label:'float() használata',points:1,type:'call',name:'float',min:1}
        ],
        tests:[
          {inputs:['2'],expectedLines:['12.57'],points:2.5},
          {inputs:['1'],expectedLines:['3.14'],points:2.5}
        ]
      },
      {
        title:'2. feladat – fájlbeolvasás', points:10,
        text:'A szamok.txt fájl egész számokat tartalmaz soronként. Olvasd be őket, számold ki az összegüket, és írd ki csak az összeget.', starter:'',
        checks:[
          {label:'open() használata',points:2,type:'call',name:'open',min:1},
          {label:'for ciklus',points:2,type:'node',name:'For',min:1}
        ],
        fileTests:[
          {files:{'szamok.txt':'10\n20\n5\n'},readFiles:[],expectedFiles:{},expectedLines:['35'],points:3},
          {files:{'szamok.txt':'-2\n7\n'},readFiles:[],expectedFiles:{},expectedLines:['5'],points:3}
        ]
      },
      {
        title:'3. feladat – saját osztály', points:12,
        text:'Készíts Gep osztályt nev és ram attribútummal. Az __init__(self, nev, ram) állítsa be ezeket. Hozz létre egy Gep("PC01", 16) példányt, majd írd ki két külön sorba a nevét és RAM-ját.', starter:'',
        checks:[
          {label:'Gep osztály',points:3,type:'node',name:'ClassDef',min:1},
          {label:'__init__ metódus',points:3,type:'function',name:'__init__',minArgs:3}
        ],
        tests:[{inputs:[],expectedLines:['PC01','16'],points:6}]
      }
    ]
  }
];
