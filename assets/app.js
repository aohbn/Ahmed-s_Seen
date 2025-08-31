
// === Keys ===
export const SETTINGS_KEY = "sj:settings";
export const QUESTIONS_KEY = "sj:questions"; // [{id,pack,category,level,q,a,img?}]
export const PACKS_KEY = "sj:packs";         // [{id,name}]
export const ACTIVE_PACK_KEY = "sj:activePack";
export const SELECTED_CATS_KEY = "sj:selectedCats";
export const TEAM_NAMES_KEY = "sj:teamNames";

// === Storage helpers ===
export const store = {
  get(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); },
  replaceAll(payload){
    const {settings, packs, activePack, questions} = payload;
    if (settings) this.set(SETTINGS_KEY, settings);
    if (packs) this.set(PACKS_KEY, packs);
    if (activePack) this.set(ACTIVE_PACK_KEY, activePack);
    if (questions) this.set(QUESTIONS_KEY, questions);
  }
};

// === Defaults ===
(function initDefaults(){
  if(!store.get(SETTINGS_KEY,null)) store.set(SETTINGS_KEY, { players:2, roundTime:60, difficulty:'normal' });
  if(!store.get(PACKS_KEY,null))    store.set(PACKS_KEY, [{ id:'default', name:'الافتراضية'}]);
  if(!store.get(ACTIVE_PACK_KEY,null)) store.set(ACTIVE_PACK_KEY, 'default');
  if(!store.get(QUESTIONS_KEY,null)) store.set(QUESTIONS_KEY, []);
  if(!store.get(SELECTED_CATS_KEY,null)) store.set(SELECTED_CATS_KEY, []);
  if(!store.get(TEAM_NAMES_KEY,null)) store.set(TEAM_NAMES_KEY, { teamA:'الفريق 1', teamB:'الفريق 2' });
})();

// === Nav highlight ===
export function activateTab(href){
  document.querySelectorAll('.tab').forEach(t=>{
    const isActive = t.getAttribute('href') === href;
    t.classList.toggle('active', isActive);
  });
}

// === Packs API ===
export function listPacks(){ return store.get(PACKS_KEY,[]); }
export function activePack(){ return store.get(ACTIVE_PACK_KEY,'default'); }
export function setActivePack(id){ store.set(ACTIVE_PACK_KEY, id); }
export function addPack(name){
  const id = name.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g,'-').replace(/(^-|-$)/g,'') || ('pack-'+Date.now());
  const packs = listPacks();
  if (packs.some(p=>p.id===id)) throw new Error('الاسم موجود مسبقًا');
  packs.push({id,name}); store.set(PACKS_KEY,packs);
  return id;
}
export function deletePack(id){
  if (id==='default') throw new Error('لا يمكن حذف الحزمة الافتراضية');
  const packs = listPacks().filter(p=>p.id!==id);
  store.set(PACKS_KEY, packs);
  const qs = listQuestions().filter(q=>q.pack!==id);
  store.set(QUESTIONS_KEY, qs);
  if (activePack()===id) setActivePack('default');
}

// === Questions API ===
export function listQuestions(){ return store.get(QUESTIONS_KEY,[]); }
export function listQuestionsByPack(pid){ return listQuestions().filter(q=>q.pack===pid); }
export function addQuestion(q){
  const id = 'q_'+Date.now()+'_'+Math.floor(Math.random()*1e6);
  const item = { id, pack: q.pack || activePack(), category:q.category||'غير مصنفة', level:q.level||100, q:q.q?.trim()||'', a:q.a?.trim()||'', img:q.img||null };
  const arr = listQuestions(); arr.push(item); store.set(QUESTIONS_KEY, arr); return item;
}
export function updateQuestion(id, partial){
  const arr = listQuestions(); const i = arr.findIndex(x=>x.id===id); if(i<0) return;
  arr[i] = { ...arr[i], ...partial }; store.set(QUESTIONS_KEY, arr);
}
export function deleteQuestion(id){ store.set(QUESTIONS_KEY, listQuestions().filter(q=>q.id!==id)); }

export function distinctCategories(pid){
  const set = new Set(listQuestionsByPack(pid).map(x=>x.category).filter(Boolean));
  return [...set];
}

// === Teams & selected categories ===
export function setSelectedCategories(cats){ store.set(SELECTED_CATS_KEY, cats||[]); }
export function getSelectedCategories(){ return store.get(SELECTED_CATS_KEY, []); }
export function setTeamNames(names){ store.set(TEAM_NAMES_KEY, { teamA: names.teamA||'الفريق 1', teamB: names.teamB||'الفريق 2' }); }
export function getTeamNames(){ return store.get(TEAM_NAMES_KEY, { teamA:'الفريق 1', teamB:'الفريق 2' }); }

// === Import/Export ===
export function exportAll(){
  const payload = {
    settings: store.get(SETTINGS_KEY,{}),
    packs: listPacks(),
    activePack: activePack(),
    questions: listQuestions()
  };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'seen-jeem-export.json'; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href), 2500);
}
export function importAllFromFile(file, mode='merge'){
  // mode: 'merge' | 'replace'
  return new Promise((resolve,reject)=>{
    const fr = new FileReader();
    fr.onload = ()=>{
      try {
        const data = JSON.parse(fr.result);
        if (mode==='replace'){
          store.replaceAll({
            settings: data.settings || store.get(SETTINGS_KEY,{}),
            packs: data.packs || [{id:'default',name:'الافتراضية'}],
            activePack: data.activePack || 'default',
            questions: data.questions || []
          });
        } else {
          // merge
          const packs = listPacks();
          (data.packs||[]).forEach(p=>{ if(!packs.some(x=>x.id===p.id)) packs.push(p); });
          store.set(PACKS_KEY, packs);
          const qs = listQuestions();
          (data.questions||[]).forEach(q=>{ if(!qs.some(x=>x.id===q.id)) qs.push(q); });
          store.set(QUESTIONS_KEY, qs);
          if (data.activePack) setActivePack(data.activePack);
          if (data.settings) store.set(SETTINGS_KEY, {...store.get(SETTINGS_KEY,{}), ...data.settings});
        }
        resolve(true);
      } catch(e){ reject(e); }
    };
    fr.onerror = ()=>reject(fr.error);
    fr.readAsText(file);
  });
}

// === Utils ===
export function fileToDataURL(file){ return new Promise((res,rej)=>{ const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.onerror=()=>rej(fr.error); fr.readAsDataURL(file); }); }
