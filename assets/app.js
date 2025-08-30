// Shared keys + helpers
export const SETTINGS_KEY = "sj:settings";
export const QUESTIONS_KEY = "sj:questions";
export const PACKS_KEY = "sj:packs";
export const ACTIVE_PACK_KEY = "sj:activePack";

export const store = {
  get(key, fallback){ try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
};

// Ensure defaults exist
(function initDefaults(){
  if(!store.get(SETTINGS_KEY, null)) store.set(SETTINGS_KEY, { players:2, roundTime:60, difficulty:'normal' });
  if(!store.get(PACKS_KEY, null))    store.set(PACKS_KEY, [{ id:'default', name:'Default' }]);
  if(!store.get(ACTIVE_PACK_KEY, null)) store.set(ACTIVE_PACK_KEY, 'default');
  if(!store.get(QUESTIONS_KEY, null)) store.set(QUESTIONS_KEY, []);
})();

// Nav highlight
export function activateTab(href){
  document.querySelectorAll('.tab').forEach(t=>{
    const isActive = t.getAttribute('href') === href;
    t.classList.toggle('active', isActive);
  });
}
