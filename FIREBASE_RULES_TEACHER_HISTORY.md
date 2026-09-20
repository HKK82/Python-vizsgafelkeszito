# Firebase Rules kiegészítés – tanári óraelőzmények

A tanári oldal most a böngésző helyi tárhelye helyett Firebase-ben is vezet egy óraindexet:

`teacherClasses/$teacherUid/$classCode`

Így a böngésző sütijeinek/helyi adatainak törlése után is vissza lehet találni a korábbi órákhoz.

A Realtime Database Rules gyökerében, a `classes` mellé add hozzá:

```json
"teacherClasses": {
  "$teacherUid": {
    ".read": "auth != null && auth.uid == $teacherUid",
    "$classCode": {
      ".write": "auth != null && auth.uid == $teacherUid",
      ".validate": "newData.hasChildren(['code','title','open','createdAt','updatedAt'])",

      "code": { ".validate": "newData.isString()" },
      "title": { ".validate": "newData.isString()" },
      "open": { ".validate": "newData.isBoolean()" },
      "createdAt": { ".validate": "newData.isNumber()" },
      "updatedAt": { ".validate": "newData.isNumber()" },

      "$other": { ".validate": false }
    }
  }
}
```

Ez az index nem tartalmaz tanulói kódot, API-kulcsot vagy részletes aktivitási adatot. Csak az órakód, cím, nyitott/lezárt állapot és időbélyegek kerülnek bele.

Megjegyzés: a régebbi órák akkor kerülnek be ebbe az indexbe, amikor egyszer újra megnyitod őket a tanári oldalon a meglévő órakódjuk alapján.
