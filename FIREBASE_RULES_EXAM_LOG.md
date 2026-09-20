# Firebase Rules kiegészítés – vizsgapróbálkozások

A vizsganapló a következő útvonalra ír:

`classes/$classCode/students/$uid/examAttempts/$attemptId`

A tanulói Python-kód és a Gemini API-kulcs **nem** kerül ide. Csak a vizsga metaadatai: azonosító/cím, típus, pontszám, százalék, időtartam, feladatonkénti részpontok és beadási idő.

Ha a jelenlegi `students/$uid` szabályban `"$other": { ".validate": false }` van, az alábbi **`examAttempts` blokkot a `$other` elé** kell beilleszteni:

```json
"examAttempts": {
  "$attemptId": {
    ".write": "auth != null && auth.uid == $uid && root.child('classes').child($classCode).child('meta').child('open').val() == true",
    ".validate": "newData.hasChildren(['examId','examTitle','examKind','score','maxScore','pct','durationSeconds','taskScores','submittedAt'])",

    "examId": { ".validate": "newData.isString()" },
    "examTitle": { ".validate": "newData.isString()" },
    "examKind": { ".validate": "newData.isString()" },

    "score": { ".validate": "newData.isNumber() && newData.val() >= 0" },
    "maxScore": { ".validate": "newData.isNumber() && newData.val() >= 0" },
    "pct": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 100" },
    "durationSeconds": { ".validate": "newData.isNumber() && newData.val() >= 0 && newData.val() <= 21600" },

    "taskScores": { ".validate": "newData.isString()" },
    "submittedAt": { ".validate": "newData.isNumber()" },
    "passed": { ".validate": "newData.isBoolean()" },

    "$other": { ".validate": false }
  }
}
```

A tanári oldal a már meglévő, tanárra korlátozott osztály-olvasási jogosultságon keresztül látja ezeket az adatokat.

Fontos: az `examAttempts` írás csak **nyitott óránál** engedélyezett. Lezárt órához a tanuló nem tud utólag vizsgaeredményt hozzáírni.
