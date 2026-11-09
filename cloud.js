/* The browser holds working data in memory. Only the auth session persists locally. */
const cloud={client:null,user:null,ready:false,version:0,dirty:false,saving:null,error:'',conflict:false,epoch:0,change:0,timer:null,loading:false,legacy:null};
function setSave(text){document.getElementById('saveState').textContent=text;}
function normalize(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected a Belay data object.');
  const d=JSON.parse(JSON.stringify(value));
  for(const key of ['skills','jobs','work','log'])if(!Array.isArray(d[key]))throw Error('Missing or invalid '+key+' array.');
  for(const key of ['settings','cOver','cAI','coach'])if(d[key]!=null&&(typeof d[key]!=='object'||Array.isArray(d[key])))throw Error('Invalid '+key+'.');
  const finite=(x)=>typeof x==='number'&&Number.isFinite(x);
  const requirements=r=>r&&typeof r==='object'&&!Array.isArray(r)&&Object.entries(r).every(([n,l])=>n&&finite(l)&&l>=1&&l<=5);
  if(d.skills.some(s=>!s||typeof s.name!=='string'||!s.name.trim()||!finite(s.level)||s.level<0||s.level>5))throw Error('Invalid skill name or level.');
  if(d.jobs.some(j=>!j||typeof j.title!=='string'||!requirements(j.req)||!finite(j.salary)||j.salary<0||!finite(j.tier)||j.tier<1||j.tier>5))throw Error('Invalid job profile.');
  if(d.work.some(w=>!w||typeof w.title!=='string'||(w.skills&&!Array.isArray(w.skills))))throw Error('Invalid work record.');
  if(d.log.some(l=>!l||typeof l.s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(l.d)||!finite(l.m)||l.m<0))throw Error('Invalid practice record.');
  // Keep attribute IDs safe, including older imported records with missing IDs.
  for(const key of ['skills','jobs','work']){const seen=new Set();for(const row of d[key]){if(typeof row.id!=='string'||!/^[\w-]+$/.test(row.id)||seen.has(row.id))row.id=crypto.randomUUID();seen.add(row.id);}}
  const b=blank();
  return {...b,...d,settings:{...b.settings,...d.settings},cOver:d.cOver||{},cAI:d.cAI||{},coach:d.coach||{}};
}
function applyReference(data){
  for(const k of ['LV','TIER','COUNTRIES','STARTER_SKILLS','STARTER_WANT','STARTER_JOBS','RANKS'])if(!Array.isArray(data[k])||!data[k].length)throw Error('Reference data is missing '+k+'.');
  if(!data.COUNTRIES.some(c=>c[0]==='JP'))throw Error('Japan reference data is required.');
  ({LV,TIER,COUNTRIES,STARTER_SKILLS,STARTER_WANT,STARTER_JOBS,RANKS,PERSONA,PROMPTS,BUCKETS}=data);
  DEFAULT_SETTINGS=data.settings||{};
}
function notice(){
  const el=document.getElementById('syncNotice');
  el.innerHTML=cloud.error?`<div class="card" style="border-color:var(--bad)"><b>Changes are not saved</b><p>${esc(cloud.error)}</p><button id="retryCloud">Retry save</button> <button id="exportCloud">Download my changes</button> <button id="reloadCloud">Load cloud version</button></div>`:'';
  if(cloud.error){document.getElementById('retryCloud').onclick=()=>flushSave();document.getElementById('exportCloud').onclick=downloadState;document.getElementById('reloadCloud').onclick=()=>{if(!cloud.dirty||confirm('Discard unsaved changes and load the cloud version? Download your changes first if needed.')){cloud.dirty=false;cloud.conflict=false;cloud.error='';loadCloud();}};}
  if(cloud.ready){
    document.getElementById('account').innerHTML=`<button class="ghost sm" data-tab="settings">Settings${cloud.legacy?' · Device records found':''}</button>`;
    bindAccountControls();
  }
}
function bindAccountControls(){
  const refresh=document.getElementById('refreshCloud'),signOut=document.getElementById('signOut'),migrate=document.getElementById('migrateLocal');
  if(refresh)refresh.onclick=()=>{if(cloud.dirty){cloud.error='Save or download your pending changes before refreshing.';notice();}else loadCloud();};
  if(signOut)signOut.onclick=async()=>{await flushSave();if(cloud.dirty){cloud.error='Save or download your pending changes before signing out.';notice();return;}const {error}=await cloud.client.auth.signOut();if(error){cloud.error=error.message;notice();}};
  if(migrate&&cloud.legacy)migrate.onclick=migrateLocal;
}
function downloadState(){
  const url=URL.createObjectURL(new Blob([JSON.stringify(S,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='belay-backup-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function save(){
  if(!cloud.ready)return;
  cloud.dirty=true;cloud.change++;setSave('Unsaved changes…');clearTimeout(cloud.timer);cloud.timer=setTimeout(flushSave,500);
}
async function flushSave(){
  clearTimeout(cloud.timer);
  if(cloud.saving)return cloud.saving;
  if(!cloud.ready||!cloud.dirty||cloud.conflict)return false;
  const epoch=cloud.epoch,owner=cloud.user.id;
  cloud.saving=(async()=>{
    while(cloud.dirty&&cloud.ready&&cloud.epoch===epoch){
      const change=cloud.change;
      try{
        const payload=normalize(S);setSave('Saving to cloud…');
        const {data,error}=await cloud.client.rpc('belay_save_state',{p_data:payload,p_version:cloud.version});
        if(error)throw error;
        if(cloud.epoch!==epoch||cloud.user?.id!==owner)return false;
        cloud.version=data.version;cloud.dirty=cloud.change!==change;cloud.error='';notice();
        if(!cloud.dirty)setSave('Saved to cloud ✓');
      }catch(e){
        if(cloud.epoch!==epoch)return false;
        cloud.conflict=String(e.message).includes('BELAY_CONFLICT');
        cloud.error=cloud.conflict?'Another device or database edit changed your records. Download your changes, then load the cloud version before editing again.':(e.message||'Connection failed. Keep this page open and retry.');
        setSave('Not saved');notice();return false;
      }
    }
    return !cloud.dirty;
  })();
  try{return await cloud.saving;}finally{cloud.saving=null;}
}
async function migrateLocal(){
  if(cloud.dirty||cloud.saving){toast('Save pending changes first.');return;}
  if(!confirm('Move the old data from this browser into your signed-in account? This replaces the current cloud records. Export those first if needed.'))return;
  try{
    const raw=localStorage.getItem('careerClimb');
    const next=normalize(JSON.parse(raw));S=next;save();render();
    if(await flushSave()){
      // Remove only the exact migrated copy, after a successful server acknowledgement.
      if(localStorage.getItem('careerClimb')===raw)localStorage.removeItem('careerClimb');
      cloud.legacy=null;notice();if(tab==='settings')render();toast('Device data moved to your cloud account.');
    }
  }catch(e){cloud.error=e.message;notice();}
}
function renderGate(message){
  document.getElementById('rank').innerHTML='';document.getElementById('nav').innerHTML='';document.getElementById('account').innerHTML='';document.getElementById('syncNotice').innerHTML='';
  if(cloud.user){document.getElementById('app').innerHTML=`<div class="card"><h2>${cloud.loading?'Loading your records…':'Could not load your records'}</h2><p>${esc(message||cloud.error||'Connecting to your cloud account.')}</p>${cloud.loading?'':'<button id="retryLoad">Try again</button><button id="gateSignOut">Sign out</button>'}</div>`;if(!cloud.loading){document.getElementById('retryLoad').onclick=loadCloud;document.getElementById('gateSignOut').onclick=()=>cloud.client.auth.signOut();}return;}
  document.getElementById('app').innerHTML=`<div class="card"><h2>Sign in to Belay</h2><p>Your skills, jobs, practice and plans are stored in your cloud account. Use the same account as your other apps.</p><button class="pri" id="googleLogin">Continue with Google</button><form id="loginForm"><label for="loginEmail">Email</label><input id="loginEmail" type="email" autocomplete="username" required><label for="loginPassword">Password (if you use email sign-in)</label><input id="loginPassword" type="password" autocomplete="current-password" required><button style="margin-top:12px" type="submit">Sign in with email</button></form><p id="authMessage" role="status">${esc(message||cloud.error||'')}</p><p class="muted">Existing device data is kept until you sign in and choose to move it.</p></div>`;
  document.getElementById('googleLogin').onclick=async()=>{try{const {error}=await cloud.client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});if(error)throw error;}catch(e){document.getElementById('authMessage').textContent=e.message;}};
  document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{const {error}=await cloud.client.auth.signInWithPassword({email:document.getElementById('loginEmail').value.trim(),password:document.getElementById('loginPassword').value});if(error)throw error;}catch(err){document.getElementById('authMessage').textContent=err.message;}finally{button.disabled=false;}};
  if(!cloud.client){document.getElementById('googleLogin').disabled=true;document.querySelector('#loginForm button').disabled=true;}
}
async function loadCloud(){
  if(cloud.loading||!cloud.user||cloud.dirty||cloud.saving)return;
  const epoch=cloud.epoch;cloud.loading=true;cloud.ready=false;renderGate();setSave('Loading…');
  try{
    const [ref,row]=await Promise.all([cloud.client.from('belay_reference').select('data').eq('id','default').single(),cloud.client.from('belay_state').select('data,version').eq('user_id',cloud.user.id).maybeSingle()]);
    if(epoch!==cloud.epoch)return;
    if(ref.error)throw ref.error;if(row.error)throw row.error;
    applyReference(ref.data.data);S=row.data?normalize(row.data.data):blank();cloud.version=row.data?.version||0;
    cloud.ready=true;cloud.error='';cloud.conflict=false;render();notice();setSave(row.data?'Loaded from cloud ✓':'Cloud connected · no records yet');
  }catch(e){if(epoch===cloud.epoch){cloud.error=e.message;setSave('Load failed');}}
  finally{cloud.loading=false;if(!cloud.ready)renderGate();}
}
async function sessionChanged(session){
  const user=session?.user||null;
  if(user?.id===cloud.user?.id)return;
  // Session/account changes never reuse data from the previous account.
  clearTimeout(cloud.timer);cloud.epoch++;cloud.user=user;cloud.ready=false;cloud.version=0;cloud.dirty=false;cloud.conflict=false;cloud.error='';cloud.loading=false;S=blank();
  document.getElementById('modal').classList.remove('on');
  if(user)await loadCloud();else{setSave('Signed out');renderGate();}
}
async function boot(){
  try{cloud.legacy=localStorage.getItem('careerClimb');}catch(e){}
  if(!window.supabase){cloud.error='The sign-in library could not load. Check your connection and reload.';renderGate();return;}
  cloud.client=window.supabase.createClient('https://wylxvmkcrexwfpjpbhyy.supabase.co','sb_publishable_e3pDOuxIdstaC7s0a680kQ_R10TrAyv',{auth:{storageKey:'belay-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  renderGate();
  cloud.client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>sessionChanged(session),0);});
  const {data,error}=await cloud.client.auth.getSession();
  if(error){cloud.error=error.message;renderGate();}else await sessionChanged(data.session);
}
window.addEventListener('beforeunload',e=>{if(cloud.dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('online',()=>{if(cloud.dirty)flushSave();});
// Refresh when returning to the tab, but never interrupt a form or unsaved work.
window.addEventListener('focus',()=>{if(cloud.ready&&!cloud.dirty&&!cloud.saving&&!document.getElementById('modal').classList.contains('on')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))loadCloud();});
