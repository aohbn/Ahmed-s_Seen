
export const SETTINGS_KEY = "sj:settings";
export const QUESTIONS_KEY = "sj:questions";
export const PACKS_KEY = "sj:packs";
export const SELECTED_CATS_KEY = "sj:selectedCats";
export const TEAM_NAMES_KEY = "sj:teamNames";

export const store = {
  get(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); },
};

(function initDefaults(){
  if(!store.get(SETTINGS_KEY,null)) store.set(SETTINGS_KEY, { players:2, roundTime:60, difficulty:'normal' });
  if(!store.get(PACKS_KEY,null))    store.set(PACKS_KEY, []);
  if(!store.get(QUESTIONS_KEY,null)) store.set(QUESTIONS_KEY, []);
  if(!store.get(SELECTED_CATS_KEY,null)) store.set(SELECTED_CATS_KEY, []);
  if(!store.get(TEAM_NAMES_KEY,null)) store.set(TEAM_NAMES_KEY, { teamA:'الفريق 1', teamB:'الفريق 2' });
})();

// ---------- Packs & Questions ----------
export function listPacks(){ return store.get(PACKS_KEY,[]); }
export function listQuestions(){ return store.get(QUESTIONS_KEY,[]); }

export function addPack(name, category){
  const id = slugify(name)+ '-' + Math.random().toString(36).slice(2,6);
  const packs = listPacks(); if (packs.some(p=>p.name===name && p.category===category)) throw new Error('الاسم موجود في هذه الفئة');
  packs.push({id,name,category: category||'غير مصنفة'}); store.set(PACKS_KEY,packs); return id;
}
export function deletePack(id){
  const packs = listPacks().filter(p=>p.id!==id); store.set(PACKS_KEY, packs);
  const qs = listQuestions().filter(q=>q.pack!==id); store.set(QUESTIONS_KEY, qs);
}

export function addQuestion(q){
  const id = 'q_'+Date.now()+'_'+Math.floor(Math.random()*1e6);
  const item = { id, pack:q.pack||'default', category:q.category||'غير مصنفة', level:Number(q.level||100), q:String(q.q??'').trim(), a:String(q.a??'').trim(), img:q.img||null };
  const arr = listQuestions(); arr.push(item); store.set(QUESTIONS_KEY, arr); return item;
}

// ---------- Helpers ----------
export function setSelectedCategories(cats){ store.set(SELECTED_CATS_KEY, cats||[]); }
export function getSelectedCategories(){ return store.get(SELECTED_CATS_KEY, []); }
export function setTeamNames(names){ store.set(TEAM_NAMES_KEY, { teamA: names.teamA||'الفريق 1', teamB: names.teamB||'الفريق 2' }); }
export function getTeamNames(){ return store.get(TEAM_NAMES_KEY, { teamA:'الفريق 1', teamB:'الفريق 2' }); }

// ---------- Import/Export (flat + v6.5) ----------
export function exportAll(){
  const payload = { settings: store.get(SETTINGS_KEY,{}), packs: listPacks(), questions: listQuestions() };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'seen-jeem-export.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1500);
}

export async function importAllFromFile(file, mode='merge'){
  const text = await file.text(); return importAllFromText(text, mode);
}
export function importAllFromText(text, mode='merge'){
  const data = JSON.parse(text);
  const conv = normalize(data); // {packs, questions}
  // infer category for packs without category: majority category of their questions
  const groupedByPack = conv.questions.reduce((m,q)=>{ (m[q.pack] ||= []).push(q); return m; }, {});
  conv.packs.forEach(p=>{
    if(!p.category){
      const arr = groupedByPack[p.id] || [];
      const counts = {}; arr.forEach(x=> counts[x.category] = (counts[x.category]||0)+1 );
      p.category = Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0] || 'غير مصنفة';
    }
  });

  if(mode==='replace'){
    store.set(PACKS_KEY, conv.packs);
    store.set(QUESTIONS_KEY, conv.questions);
  } else {
    const packs = listPacks(); conv.packs.forEach(p=>{ if(!packs.some(x=>x.id===p.id)) packs.push(p); }); store.set(PACKS_KEY,packs);
    const qs = listQuestions(); conv.questions.forEach(q=>{ if(!qs.some(x=>x.id===q.id)) qs.push(q); }); store.set(QUESTIONS_KEY, qs);
  }

  // auto-pick first 6 categories for quick start
  const cats = Array.from(new Set(conv.questions.map(q=>q.category))).slice(0,6);
  if (cats.length) setSelectedCategories(cats);
  return true;
}

function normalize(d){
  if (Array.isArray(d?.questions) && Array.isArray(d?.packs)) {
    // ensure packs have category if provided
    return { packs:d.packs.map(p=>({id:p.id, name:p.name, category:p.category||p.cat||null})), questions:d.questions.map(forceQ) };
  }
  if (d && d.packs && typeof d.packs==='object' && !Array.isArray(d.packs)){
    return convertV65(d);
  }
  if (Array.isArray(d)) { return { packs:[], questions:d.map(forceQ) }; }
  return { packs:[], questions:[] };
}
function convertV65(data){
  const packsOut=[]; const qsOut=[];
  Object.keys(data.packs||{}).forEach(cat=>{
    const list = Array.isArray(data.packs[cat]) ? data.packs[cat] : [];
    list.forEach((pack,i)=>{
      const pid = slugify(cat)+'-'+String(i+1).padStart(2,'0'); const pname = `${cat} – ${i+1}`;
      if(!packsOut.some(p=>p.id===pid)) packsOut.push({id:pid,name:pname,category:cat});
      Object.keys(pack||{}).forEach(k=>{
        const lvl = parseInt(k,10); if(isNaN(lvl)) return;
        const bucket = pack[k]; const arr = Array.isArray(bucket)?bucket:[bucket];
        arr.forEach(entry=>{
          const qn = normEntry(entry); if(!qn) return;
          qsOut.push({ id:'q_'+Math.random().toString(36).slice(2), pack:pid, category:cat, level:lvl, q:String(qn.q||'').trim(), a:String(qn.a||'').trim(), img:qn.img||null });
        });
      });
    });
  });
  return { packs:packsOut, questions:qsOut };
}
function normEntry(e){
  if (e==null) return null;
  if (typeof e==='string'){ const parts=e.split('|'); return parts.length>=2?{q:parts[0],a:parts.slice(1).join('|')}:{q:e,a:''}; }
  if (Array.isArray(e)){ return { q:e[0]||'', a:e[1]||'', img:e[2]||null }; }
  if (typeof e==='object'){ return { q:e.q??e.question??'', a:e.a??e.answer??'', img:e.img??e.image??null }; }
  return null;
}
function forceQ(q){ return { id:q.id??('q_'+Math.random().toString(36).slice(2)), pack:q.pack??'default', category:q.category??'غير مصنفة', level:Number(q.level??100), q:String(q.q??'').trim(), a:String(q.a??'').trim(), img:q.img??null }; }
function slugify(s){ return String(s).toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g,'-').replace(/(^-|-$)/g,''); }
