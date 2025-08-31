
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
  const id = slugify(name)+ '-' + Math.random().toString(36).slice(2,6);
  const packs = listPacks();
  if (packs.some(p=>p.id===id || p.name===name)) throw new Error('الاسم موجود مسبقًا');
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
  const item = { id, pack: q.pack || activePack(), category:q.category||'غير مصنفة', level:Number(q.level||100), q:String(q.q??'').trim(), a:String(q.a??'').trim(), img:q.img||null };
  const arr = listQuestions(); arr.push(item); store.set(QUESTIONS_KEY, arr); return item;
}
export function updateQuestion(id, partial){
  const arr = listQuestions(); const i = arr.findIndex(x=>x.id===id); if(i<0) return;
  arr[i] = { ...arr[i], ...partial, level:Number(partial.level ?? arr[i].level) }; store.set(QUESTIONS_KEY, arr);
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

export async function importAllFromFile(file, mode='merge'){
  const text = await file.text();
  const data = JSON.parse(text);
  const converted = normalizeImport(data); // auto-detect v6.5 or flat
  if (mode==='replace'){
    store.replaceAll({
      settings: converted.settings || store.get(SETTINGS_KEY,{}),
      packs: converted.packs || [{id:'default',name:'الافتراضية'}],
      activePack: converted.activePack || (converted.packs?.[0]?.id ?? 'default'),
      questions: converted.questions || []
    });
  } else {
    // merge
    const packs = listPacks();
    (converted.packs||[]).forEach(p=>{ if(!packs.some(x=>x.id===p.id)) packs.push(p); });
    store.set(PACKS_KEY, packs);
    const qs = listQuestions();
    (converted.questions||[]).forEach(q=>{ if(!qs.some(x=>x.id===q.id)) qs.push(q); });
    store.set(QUESTIONS_KEY, qs);
    if (converted.activePack) setActivePack(converted.activePack);
    if (converted.settings) store.set(SETTINGS_KEY, {...store.get(SETTINGS_KEY,{}), ...converted.settings});
  }
}

// ---- Import normalizer ----
function normalizeImport(data){
  // Flat schema detection
  if (Array.isArray(data?.packs) || Array.isArray(data?.questions)){
    return {
      settings: data.settings ?? null,
      packs: data.packs ?? [],
      activePack: data.activePack ?? null,
      questions: (data.questions ?? []).map(forceQuestionShape)
    };
  }
  // v6.5 detection: packs is an object(categories -> array of pack-objects)
  if (data && data.packs && !Array.isArray(data.packs) && typeof data.packs === 'object'){
    return convertV65(data);
  }
  // unknown -> try to coerce
  return { settings:null, packs:[], activePack:null, questions:[] };
}

function convertV65(data){
  const packsOut = [];
  const qsOut = [];
  let firstPackId = null;

  const categories = Object.keys(data.packs||{});
  categories.forEach(cat=>{
    const arr = Array.isArray(data.packs[cat]) ? data.packs[cat] : [];
    arr.forEach((packObj, idx)=>{
      // create pack id/name
      const pid = slugify(cat) + '-' + String(idx+1).padStart(2,'0');
      const pname = `${cat} – ${idx+1}`;
      if (!packsOut.some(p=>p.id===pid)) packsOut.push({id:pid, name:pname});
      if (!firstPackId) firstPackId = pid;
      // iterate levels (numeric keys)
      Object.keys(packObj||{}).forEach(k=>{
        const lvl = parseInt(k, 10);
        if (isNaN(lvl)) return;
        const bucket = packObj[k];
        const entries = Array.isArray(bucket) ? bucket : [bucket];
        entries.forEach((entry)=>{
          const qn = normalizeV65Entry(entry);
          if (!qn) return;
          qsOut.push({
            id: 'q_'+Math.random().toString(36).slice(2),
            pack: pid,
            category: cat,
            level: lvl,
            q: String(qn.q||'').trim(),
            a: String(qn.a||'').trim(),
            img: qn.img || null
          });
        });
      });
    });
  });

  return {
    settings: data.settings ?? null,
    packs: packsOut,
    activePack: data.activePack ?? firstPackId ?? null,
    questions: qsOut
  };
}

function normalizeV65Entry(entry){
  if (entry == null) return null;
  if (typeof entry === 'string'){
    // Try split "Q | A"
    const parts = entry.split('|');
    if (parts.length >= 2){
      return { q: parts[0].trim(), a: parts.slice(1).join('|').trim(), img: null };
    }
    return { q: entry.trim(), a: '', img: null };
  }
  if (Array.isArray(entry)){
    const q = entry[0] ?? '';
    const a = entry[1] ?? '';
    const img = entry[2] ?? null;
    return { q, a, img };
  }
  if (typeof entry === 'object'){
    const q = entry.q ?? entry.question ?? entry.text ?? '';
    const a = entry.a ?? entry.answer ?? '';
    const img = entry.img ?? entry.image ?? entry.photo ?? null;
    return { q, a, img };
  }
  return null;
}

function forceQuestionShape(q){
  return {
    id: q.id ?? ('q_'+Math.random().toString(36).slice(2)),
    pack: q.pack ?? 'default',
    category: q.category ?? 'غير مصنفة',
    level: Number(q.level ?? 100),
    q: String(q.q ?? q.question ?? '').trim(),
    a: String(q.a ?? q.answer ?? '').trim(),
    img: q.img ?? q.image ?? null
  };
}

function slugify(s){
  return String(s).toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/(^-|-$)/g,'');
}
