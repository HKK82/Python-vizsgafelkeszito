import { lessons, flattenTasks, totalTasks } from './lessons.js';
import { ProgressStore } from './storage.js';

const store = new ProgressStore();
const items = flattenTasks();
store.setTaskOrder(items.map(x => x.key));
const $ = id => document.getElementById(id);

function stripHtml(html) {
  const d = document.createElement('div'); d.innerHTML = html; return d.textContent || '';
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));}
function lessonIndices(li){return items.map((x,i)=>x.lessonIndex===li?i:-1).filter(i=>i>=0);}
function unlocked(li){const f=store.getFrontier(totalTasks);return lessonIndices(li).some(i=>i<=f||store.isCompleted(items[i].key));}
function doneCount(li){return lessonIndices(li).filter(i=>store.isCompleted(items[i].key)).length;}

function render(){
  const profile=store.getCurrentProfile();
  if(!profile){
    $('profileText').innerHTML='Nincs kiválasztott tanulói profil. <a href="./index.html">Indítsd el előbb a tanulást.</a>';
    $('notesList').innerHTML=''; return;
  }
  $('profileText').textContent=`${profile.displayName} • ${store.completedCount()} / ${totalTasks} feladat teljesítve`;
  const wrap=$('notesList'); wrap.innerHTML='';
  lessons.forEach((lesson,li)=>{
    if(!unlocked(li)) return;
    const card=document.createElement('section'); card.className='card noteLesson';
    const saved=store.getSavedExplanations(lesson.id);
    card.innerHTML=`<div class="teacherHero"><div><span class="badge">${lesson.id}. lecke</span><h2>${esc(lesson.title)}</h2></div><span class="tiny">${doneCount(li)}/${lesson.tasks.length} feladat kész</span></div>
      <p class="objective">${esc(lesson.objective)}</p>
      <div class="explain">${lesson.explain}</div>
      <h3>Saját jegyzetem</h3><textarea data-note="${lesson.id}" placeholder="Írd le a saját szavaiddal, mire kell figyelned ennél a témánál…">${esc(store.getPersonalNote(lesson.id))}</textarea>
      <div class="buttonRow"><button class="secondary" data-save="${lesson.id}">Jegyzet mentése</button></div>
      <div data-ai="${lesson.id}">${saved.length?`<h3>Elmentett AI-magyarázatok</h3>${saved.map(x=>`<div class="noteSaved">${esc(x.text)}<div class="tiny">${new Date(x.savedAt).toLocaleString('hu-HU')}</div></div>`).join('')}`:'<p class="tiny">Még nincs elmentett AI-magyarázat ehhez a leckéhez.</p>'}</div>`;
    wrap.appendChild(card);
  });
  wrap.querySelectorAll('[data-save]').forEach(btn=>btn.onclick=()=>{
    const id=btn.dataset.save; const ta=wrap.querySelector(`[data-note="${id}"]`); store.setPersonalNote(id,ta.value); btn.textContent='Mentve ✓'; setTimeout(()=>btn.textContent='Jegyzet mentése',1000);
  });
}

function exportMarkdown(){
  const p=store.getCurrentProfile(); if(!p)return;
  const parts=[`# ${p.displayName} – Python jegyzet`,``,`Teljesített feladatok: ${store.completedCount()} / ${totalTasks}`,``];
  lessons.forEach((lesson,li)=>{
    if(!unlocked(li))return;
    parts.push(`## ${lesson.id}. ${lesson.title}`,``,lesson.objective,``,stripHtml(lesson.explain).replace(/\s+/g,' ').trim(),``);
    const own=store.getPersonalNote(lesson.id); if(own)parts.push(`### Saját jegyzet`,``,own,``);
    const saved=store.getSavedExplanations(lesson.id); if(saved.length){parts.push(`### Elmentett AI-magyarázatok`,``);saved.forEach(x=>parts.push(x.text,``));}
  });
  const blob=new Blob([parts.join('\n')],{type:'text/markdown;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`python-jegyzet-${p.displayName.replace(/\W+/g,'_')}.md`;a.click();URL.revokeObjectURL(url);
}

$('exportMdBtn').onclick=exportMarkdown;$('printBtn').onclick=()=>window.print();render();