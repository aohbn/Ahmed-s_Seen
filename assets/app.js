
export const SETTINGS_KEY   = "sj:settings";
export const QUESTIONS_KEY  = "sj:questions";
export const PACKS_KEY      = "sj:packs";
export const SELECTED_CATS_KEY = "sj:selectedCats";
export const SELECTED_PACKS_KEY = "sj:selectedPacks";
export const TEAM_NAMES_KEY = "sj:teamNames";
export const SCORE_KEY      = "sj:scores";

export const store = {
  get(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); },
  clearAll(){ [PACKS_KEY, QUESTIONS_KEY, SELECTED_CATS_KEY, SELECTED_PACKS_KEY, SCORE_KEY].forEach(k=>localStorage.removeItem(k)); }
};

function defaultScores(){
  return { A:0, B:0, turn:'A', used:{ A:{ two:false, double:false, plus20:false, steal:false }, B:{ two:false, double:false, plus20:false, steal:false } } };
}

(function initDefaults(){
  if(!store.get(SETTINGS_KEY,null)) store.set(SETTINGS_KEY, { roundTime:60, stealTime:10 });
  if(!store.get(PACKS_KEY,null))    store.set(PACKS_KEY, []);
  if(!store.get(QUESTIONS_KEY,null)) store.set(QUESTIONS_KEY, []);
  if(!store.get(SELECTED_CATS_KEY,null)) store.set(SELECTED_CATS_KEY, []);
  if(!store.get(SELECTED_PACKS_KEY,null)) store.set(SELECTED_PACKS_KEY, {});
  if(!store.get(TEAM_NAMES_KEY,null)) store.set(TEAM_NAMES_KEY, { teamA:'الفريق 1', teamB:'الفريق 2' });
  if(!store.get(SCORE_KEY,null))       store.set(SCORE_KEY, defaultScores());
})();

// ---------- Packs & Questions ----------
export function listPacks(){ return store.get(PACKS_KEY,[]); }
export function listQuestions(){ return store.get(QUESTIONS_KEY,[]); }
export function packsByCategory(cat){ return listPacks().filter(p=>(p.category||'غير مصنفة')===cat); }
export function listCategories(){
  const fromPacks = Array.from(new Set(listPacks().map(p=>p.category||'غير مصنفة')));
  if(fromPacks.length) return fromPacks;
  return Array.from(new Set(listQuestions().map(q=>q.category||'غير مصنفة')));
}
export function addPack(name, category){
  const id = slugify(name)+'-'+Math.random().toString(36).slice(2,6);
  const packs = listPacks(); packs.push({ id, name, category: category||'غير مصنفة' }); store.set(PACKS_KEY, packs);
  return id;
}
export function addQuestion(q){
  const id = 'q_'+Date.now()+'_'+Math.floor(Math.random()*1e6);
  const item = { id, pack:q.pack||'default', category:q.category||'غير مصنفة', level:Number(q.level||100), q:String(q.q??'').trim(), a:String(q.a??'').trim(), img:q.img||null };
  const arr = listQuestions(); arr.push(item); store.set(QUESTIONS_KEY, arr); return item;
}

// ---------- Game state ----------
export function getTeamNames(){ return store.get(TEAM_NAMES_KEY, { teamA:'الفريق 1', teamB:'الفريق 2' }); }
export function setTeamNames(n){ store.set(TEAM_NAMES_KEY, { teamA:n.teamA||'الفريق 1', teamB:n.teamB||'الفريق 2' }); }
export function getScores(){
  const s = store.get(SCORE_KEY, null) || defaultScores();
  if(!s.used) s.used={ A:{ two:false, double:false, plus20:false, steal:false }, B:{ two:false, double:false, plus20:false, steal:false } };
  if(!s.turn) s.turn='A';
  if(typeof s.A!=='number') s.A=0; if(typeof s.B!=='number') s.B=0;
  return s;
}
export function setScores(s){ store.set(SCORE_KEY, s); }

export function setSelectedCategories(cats){ store.set(SELECTED_CATS_KEY, cats||[]); }
export function getSelectedCategories(){ return store.get(SELECTED_CATS_KEY, []); }
export function setSelectedPacks(map){ store.set(SELECTED_PACKS_KEY, map||{}); }
export function getSelectedPacks(){ return store.get(SELECTED_PACKS_KEY, {}); }

// ---------- Import/Export ----------
export function exportAll(){
  const payload = { settings: store.get(SETTINGS_KEY,{}), packs: listPacks(), questions: listQuestions() };
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'seen-jeem-export.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1200);
}
export async function importAllFromFile(file, mode='merge'){
  const text = await file.text(); return importAllFromText(text, mode);
}
export function importAllFromText(text, mode='merge'){
  const data = JSON.parse(text);
  let packs=[], questions=[];
  if(Array.isArray(data?.questions) && Array.isArray(data?.packs)){ packs=data.packs; questions=data.questions; }
  else if(data && data.packs && typeof data.packs==='object'){ // v6.5-style schema
    Object.keys(data.packs).forEach(cat=>{
      const list = data.packs[cat]||[];
      list.forEach((pack,i)=>{
        const pid = slugify(cat)+'-'+String(i+1).padStart(2,'0'); const pname = `${cat} – ${i+1}`;
        packs.push({id:pid,name:pname,category:cat});
        Object.entries(pack).forEach(([lvl,bucket])=>{
          const lvlN = parseInt(lvl,10); if(isNaN(lvlN)) return;
          (Array.isArray(bucket)?bucket:[bucket]).forEach(item=>{
            const obj = parseQ(item);
            questions.push({ id:'q_'+Math.random().toString(36).slice(2), pack:pid, category:cat, level:lvlN, q:obj.q, a:obj.a, img:obj.img||null });
          });
        });
      });
    });
  } else if(Array.isArray(data)){ questions=data.map(parseQ); }
  if(mode==='replace'){ store.set(PACKS_KEY, packs); store.set(QUESTIONS_KEY, questions); }
  else { store.set(PACKS_KEY, mergeUnique(listPacks(), packs, 'id')); store.set(QUESTIONS_KEY, mergeUnique(listQuestions(), questions, 'id')); }
  return true;
}

function parseQ(e){
  if(typeof e==='string'){ const parts=e.split('|'); return { q:parts[0]||'', a:parts.slice(1).join('|')||'' }; }
  if(Array.isArray(e)){ return { q:String(e[0]||''), a:String(e[1]||''), img:e[2]||null }; }
  if(typeof e==='object'){ return { q: pick(e,'q','Q','question','text','prompt','title','body','name')||'', a: pick(e,'a','A','answer','ans','solution')||'', img: e.img||e.image||e.imageUrl||e.imgUrl||null }; }
  return { q:'', a:'' };
}
function pick(o, ...keys){ for(const k of keys){ if(o[k]!=null) return o[k]; } return null; }
function mergeUnique(a,b,key){ const out=[...a]; b.forEach(x=>{ if(!out.some(y=>y[key]===x[key])) out.push(x); }); return out; }
function slugify(s){ return String(s).toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g,'-').replace(/(^-|-$)/g,''); }
