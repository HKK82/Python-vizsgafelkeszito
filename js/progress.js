import { lessons, flattenTasks, totalTasks } from './lessons.js';
import { ProgressStore } from './storage.js';
const store=new ProgressStore();const items=flattenTasks();store.setTaskOrder(items.map(x=>x.key));const $=id=>document.getElementById(id);
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function idsForLessons(ids){return items.filter(x=>ids.includes(x.lesson.id)).map(x=>x.key)}
function pct(keys){if(!keys.length)return 0;return Math.round(keys.filter(k=>store.isCompleted(k)).length/keys.length*100)}
function bar(name,detail,p,status=''){return `<div class="requirementRow"><div><strong>${esc(name)}</strong><div class="tiny">${esc(detail)}</div></div><div class="miniProgress"><div style="width:${p}%"></div></div><div>${status||p+'%'}</div></div>`}
const profile=store.getCurrentProfile();
if(!profile){$('summary').innerHTML='Nincs kiválasztott profil. <a href="./index.html">Indítsd el a tanulást.</a>';}
else{
 const completed=store.completedCount(), overall=Math.round(completed/totalTasks*100);$('summary').textContent=`${profile.displayName} • ${completed}/${totalTasks} feladat • ${overall}%`;$('bigProgress').style.width=`${overall}%`;
 $('lessonProgress').innerHTML=lessons.map(l=>{const keys=idsForLessons([l.id]);return bar(`${l.id}. ${l.title}`,l.objective,pct(keys));}).join('');
 const req=[
  ['Aritmetikai, relációs és logikai kifejezések','KKK-alap: műveletek, %, //, if, and/or',idsForLessons([4,5,6,8,9,10])],
  ['Adatszerkezetek és ciklusok','lista, indexelés, len/append, for/range/while',idsForLessons([11,12,13,14,15])],
  ['Saját függvény paraméterrel és returnnel','KKK alapvizsga-követelmény',idsForLessons([16])],
  ['Egyszerű algoritmusok','Összegzés, megszámlálás, minimum/maximum, keresés','planned'],
  ['Modulok','import és saját modul','planned'],
  ['Szöveges fájl be/ki','UTF-8 beolvasás, tárolás, fájlba írás','planned'],
  ['Saját osztály és példányosítás','class, __init__, self, objektumlista','planned'],
  ['JSON és REST API','technikusi szint','planned'],
  ['Programozott hálózatkonfiguráció','PyCharm / labor / DevNet','planned']
 ];
 $('requirements').innerHTML=req.map(([n,d,k])=>k==='planned'?bar(n,d,0,'tervezett'):bar(n,d,pct(k))).join('');
 const examIds=['alapok','vezerles','fuggvenyek'];
 $('examResults').innerHTML=examIds.map(id=>{const r=store.getExamResults(id);if(!r.length)return `<p><strong>${id}</strong>: még nincs eredmény.</p>`;const last=r[r.length-1];return `<p><strong>${id}</strong>: legutóbb ${last.score}/${last.maxScore} pont (${Math.round(last.score/last.maxScore*100)}%) – ${new Date(last.savedAt).toLocaleString('hu-HU')}</p>`}).join('');
}