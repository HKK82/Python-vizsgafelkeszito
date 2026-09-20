export const exams = [
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
  }
];
