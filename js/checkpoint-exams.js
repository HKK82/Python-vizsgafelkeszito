export const checkpointExams = [
  {
    id:'checkpoint-1',
    checkpoint:true,
    checkpointId:'checkpoint-1',
    title:'Kisvizsga 1 – Kiírás, változók, input()',
    description:'Az 1–3. lecke önálló ellenőrzése. Nincs puska, AI-tipp vagy mintamegoldás.',
    durationMinutes:12,
    passPct:80,
    minTaskPct:60,
    tasks:[
      {
        title:'1. feladat – Bekért név', points:10, lessonIds:[1,2,3],
        text:'Kérj be egy nevet input()-tal, mentsd a nev változóba, majd írd ki pontosan a bekért nevet.', starter:'',
        checks:[
          {label:'input() használata',points:2,type:'call',name:'input',min:1},
          {label:'változó létrehozása',points:2,type:'node',name:'Assign',min:1}
        ],
        tests:[
          {inputs:['Kata'],expectedLines:['Kata'],points:3},
          {inputs:['Milan'],expectedLines:['Milan'],points:3}
        ],
        solution:'nev = input("Név: ")\nprint(nev)'
      },
      {
        title:'2. feladat – Két szöveges adat', points:10, lessonIds:[2,3],
        text:'Kérj be egymás után egy gépnevet és egy operációs rendszer nevét, majd írd ki őket két külön sorba.', starter:'',
        checks:[
          {label:'két input()',points:2,type:'call',name:'input',min:2},
          {label:'két print()',points:2,type:'call',name:'print',min:2}
        ],
        tests:[
          {inputs:['PC21','Linux'],expectedLines:['PC21','Linux'],points:3},
          {inputs:['LAP5','Windows'],expectedLines:['LAP5','Windows'],points:3}
        ],
        solution:'gep = input("Gép: ")\nos = input("OS: ")\nprint(gep)\nprint(os)'
      },
      {
        title:'3. feladat – Változó kiírása', points:10, lessonIds:[1,2],
        text:'Hozz létre eszkoz nevű változót "RTR01" értékkel, majd a változót írd ki.', starter:'',
        checks:[
          {label:'értékadás',points:3,type:'node',name:'Assign',min:1},
          {label:'print()',points:2,type:'call',name:'print',min:1}
        ],
        tests:[{inputs:[],expectedLines:['RTR01'],points:5}],
        solution:'eszkoz = "RTR01"\nprint(eszkoz)'
      }
    ]
  },
  {
    id:'checkpoint-2',
    checkpoint:true,
    checkpointId:'checkpoint-2',
    title:'Kisvizsga 2 – Számok és alapműveletek',
    description:'A 4–6. lecke önálló ellenőrzése. int/float, + - * /, %, //.',
    durationMinutes:15,
    passPct:80,
    minTaskPct:60,
    tasks:[
      {
        title:'1. feladat – Típusátalakítás', points:10, lessonIds:[4],
        text:'Kérj be egy egész számot és egy tizedes számot. Az elsőt int(), a másodikat float() segítségével alakítsd át, majd írd ki őket két külön sorba.', starter:'',
        checks:[
          {label:'int()',points:2,type:'call',name:'int',min:1},
          {label:'float()',points:2,type:'call',name:'float',min:1}
        ],
        tests:[
          {inputs:['0012','7.50'],expectedLines:['12','7.5'],points:3},
          {inputs:['-03','0.25'],expectedLines:['-3','0.25'],points:3}
        ],
        solution:'a = int(input("Egész: "))\nb = float(input("Tizedes: "))\nprint(a)\nprint(b)'
      },
      {
        title:'2. feladat – Szabad tárhely', points:10, lessonIds:[5],
        text:'Kérd be a teljes és a foglalt tárhelyet egész számként, majd írd ki a különbségüket.', starter:'',
        checks:[
          {label:'két int()',points:2,type:'call',name:'int',min:2},
          {label:'kivonás',points:2,type:'op',name:'Sub',min:1}
        ],
        tests:[
          {inputs:['100','72'],expectedLines:['28'],points:3},
          {inputs:['500','123'],expectedLines:['377'],points:3}
        ],
        solution:'teljes = int(input("Teljes: "))\nfoglalt = int(input("Foglalt: "))\nprint(teljes - foglalt)'
      },
      {
        title:'3. feladat – Perc és maradék másodperc', points:10, lessonIds:[6],
        text:'Kérj be egy másodpercértéket egész számként. Írd ki két külön sorban a teljes percek számát és a maradék másodperceket.', starter:'',
        checks:[
          {label:'egész osztás //',points:2,type:'op',name:'FloorDiv',min:1},
          {label:'maradékos osztás %',points:2,type:'op',name:'Mod',min:1}
        ],
        tests:[
          {inputs:['125'],expectedLines:['2','5'],points:3},
          {inputs:['61'],expectedLines:['1','1'],points:3}
        ],
        solution:'mp = int(input("Másodperc: "))\nprint(mp // 60)\nprint(mp % 60)'
      }
    ]
  },
  {
    id:'checkpoint-3',
    checkpoint:true,
    checkpointId:'checkpoint-3',
    title:'Kisvizsga 3 – Szövegformázás és döntések',
    description:'A 7–10. lecke önálló ellenőrzése. f-string, if/elif/else, and/or.',
    durationMinutes:18,
    passPct:80,
    minTaskPct:60,
    tasks:[
      {
        title:'1. feladat – f-string', points:10, lessonIds:[7],
        text:'Kérd be a felhasználó nevét és életkorát, majd f-stringgel írd ki: Anna 20 éves. A tesztek más adatokat is használnak.', starter:'',
        checks:[
          {label:'f-string',points:4,type:'node',name:'JoinedStr',min:1}
        ],
        tests:[
          {inputs:['Anna','20'],expectedLines:['Anna 20 éves.'],points:3},
          {inputs:['Bence','17'],expectedLines:['Bence 17 éves.'],points:3}
        ],
        solution:'nev = input("Név: ")\nkor = int(input("Kor: "))\nprint(f"{nev} {kor} éves.")'
      },
      {
        title:'2. feladat – Három CPU-állapot', points:10, lessonIds:[8,9],
        text:'Kérd be a CPU-terhelést egész számként. 90-től KRITIKUS, 70-től FIGYELMEZTETÉS, különben OK legyen a kimenet.', starter:'',
        checks:[
          {label:'if feltétel',points:2,type:'node',name:'If',min:1},
          {label:'legalább két összehasonlítás',points:2,type:'comparisons',min:2}
        ],
        tests:[
          {inputs:['95'],expectedLines:['KRITIKUS'],points:2},
          {inputs:['70'],expectedLines:['FIGYELMEZTETÉS'],points:2},
          {inputs:['40'],expectedLines:['OK'],points:2}
        ],
        solution:'cpu = int(input("CPU: "))\nif cpu >= 90:\n    print("KRITIKUS")\nelif cpu >= 70:\n    print("FIGYELMEZTETÉS")\nelse:\n    print("OK")'
      },
      {
        title:'3. feladat – Összetett feltétel', points:10, lessonIds:[10],
        text:'Kérd be a CPU és RAM terhelést egész számként. Ha mindkettő legalább 90, írd ki KRITIKUS, különben OK.', starter:'',
        checks:[
          {label:'and használata',points:3,type:'op',name:'And',min:1}
        ],
        tests:[
          {inputs:['95','91'],expectedLines:['KRITIKUS'],points:3.5},
          {inputs:['95','50'],expectedLines:['OK'],points:3.5}
        ],
        solution:'cpu = int(input("CPU: "))\nram = int(input("RAM: "))\nif cpu >= 90 and ram >= 90:\n    print("KRITIKUS")\nelse:\n    print("OK")'
      }
    ]
  },
  {
    id:'checkpoint-4',
    checkpoint:true,
    checkpointId:'checkpoint-4',
    title:'Kisvizsga 4 – Listák és for ciklus',
    description:'A 11–13. lecke önálló ellenőrzése. lista, indexelés, len(), append(), for.',
    durationMinutes:15,
    passPct:80,
    minTaskPct:60,
    tasks:[
      {
        title:'1. feladat – Listaindexelés', points:10, lessonIds:[11],
        text:'Készíts [10, 20, 30, 40] listát, majd írd ki a második és a negyedik elemet két külön sorba.', starter:'',
        checks:[
          {label:'lista',points:2,type:'node',name:'List',min:1},
          {label:'indexelés',points:2,type:'node',name:'Subscript',min:2}
        ],
        tests:[{inputs:[],expectedLines:['20','40'],points:6}],
        solution:'szamok = [10, 20, 30, 40]\nprint(szamok[1])\nprint(szamok[3])'
      },
      {
        title:'2. feladat – Lista bővítése', points:10, lessonIds:[12],
        text:'Indulj üres listából. Kérj be két szervernevet, add őket a listához append()-del, majd írd ki a lista hosszát.', starter:'szerverek = []\n',
        checks:[
          {label:'append()',points:2,type:'call',name:'append',min:2},
          {label:'len()',points:2,type:'call',name:'len',min:1}
        ],
        tests:[
          {inputs:['A','B'],expectedLines:['2'],points:3},
          {inputs:['SRV01','WEB02'],expectedLines:['2'],points:3}
        ],
        solution:'szerverek = []\nszerverek.append(input("1: "))\nszerverek.append(input("2: "))\nprint(len(szerverek))'
      },
      {
        title:'3. feladat – Lista bejárása', points:10, lessonIds:[13],
        text:'For ciklussal járd be a [3, 8, 2] listát, és írd ki minden szám kétszeresét külön sorba.', starter:'szamok = [3, 8, 2]\n',
        checks:[
          {label:'for ciklus',points:3,type:'node',name:'For',min:1},
          {label:'szorzás',points:1,type:'op',name:'Mult',min:1}
        ],
        tests:[{inputs:[],expectedLines:['6','16','4'],points:6}],
        solution:'szamok = [3, 8, 2]\nfor szam in szamok:\n    print(szam * 2)'
      }
    ]
  },
  {
    id:'checkpoint-5',
    checkpoint:true,
    checkpointId:'checkpoint-5',
    title:'Kisvizsga 5 – range, while, függvények',
    description:'A 14–16. lecke önálló ellenőrzése. range + if, while és saját függvény.',
    durationMinutes:18,
    passPct:80,
    minTaskPct:60,
    tasks:[
      {
        title:'1. feladat – range és if', points:10, lessonIds:[14],
        text:'For ciklussal járd be 1-től 8-ig a számokat, és csak a párosakat írd ki.', starter:'',
        checks:[
          {label:'range()',points:2,type:'call',name:'range',min:1},
          {label:'if',points:2,type:'node',name:'If',min:1},
          {label:'%',points:1,type:'op',name:'Mod',min:1}
        ],
        tests:[{inputs:[],expectedLines:['2','4','6','8'],points:5}],
        solution:'for i in range(1, 9):\n    if i % 2 == 0:\n        print(i)'
      },
      {
        title:'2. feladat – while', points:10, lessonIds:[15],
        text:'Kérj be egy kezdő egész számot, majd while ciklussal írd ki attól 1-ig visszafelé.', starter:'',
        checks:[
          {label:'while ciklus',points:3,type:'node',name:'While',min:1},
          {label:'int()',points:1,type:'call',name:'int',min:1}
        ],
        tests:[
          {inputs:['4'],expectedLines:['4','3','2','1'],points:3},
          {inputs:['2'],expectedLines:['2','1'],points:3}
        ],
        solution:'szam = int(input("Kezdő: "))\nwhile szam >= 1:\n    print(szam)\n    szam -= 1'
      },
      {
        title:'3. feladat – paros()', points:10, lessonIds:[16],
        text:'Írj paros(szam) függvényt, amely True értéket ad vissza páros számnál és False értéket páratlannál.', starter:'def paros(szam):\n    ',
        checks:[
          {label:'paros() függvény',points:2,type:'function',name:'paros',minArgs:1},
          {label:'return',points:2,type:'node',name:'Return',min:1},
          {label:'%',points:1,type:'op',name:'Mod',min:1}
        ],
        functionTests:[
          {functionName:'paros',args:[12],expected:true,points:2},
          {functionName:'paros',args:[7],expected:false,points:2},
          {functionName:'paros',args:[0],expected:true,points:1}
        ],
        solution:'def paros(szam):\n    return szam % 2 == 0'
      }
    ]
  }
];
