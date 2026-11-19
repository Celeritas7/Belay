/* The browser holds working data in memory. Only the auth session persists locally. */
const cloud={client:null,user:null,ready:false,version:0,dirty:false,saving:null,error:'',conflict:false,epoch:0,change:0,timer:null,loading:false,legacy:null};
function setSave(text){document.getElementById('saveState').textContent=text;}
const OFFLINE_SHELL='belay-shell-v3',OFFLINE_FILES=['./','./index.html','./cloud.js?v=5','./ui.css?v=3','./manifest.webmanifest','./icons/belay-192.png','./icons/belay-512.png'];
let shellBusy=false;
async function offlineShellReport(){
  const report={generatedAt:new Date().toISOString(),online:navigator.onLine!==false,serviceWorkerSupported:'serviceWorker' in navigator,cacheSupported:'caches' in window,files:[],ready:false};
  if(!report.cacheSupported)return report;
  const keys=await caches.keys(),present=keys.includes(OFFLINE_SHELL);
  const cache=present?await caches.open(OFFLINE_SHELL):null;
  for(const file of OFFLINE_FILES){const hit=cache?await cache.match(new URL(file,location.href)):null;report.files.push({file,cached:!!hit});}
  if(report.serviceWorkerSupported){const registration=await navigator.serviceWorker.getRegistration('./');report.serviceWorkerActive=!!registration?.active;}
  report.ready=report.files.every(f=>f.cached)&&report.serviceWorkerActive===true;
  return report;
}
function displayOfflineShell(report,message=''){
  const el=document.getElementById('offlineShellStatus');if(!el)return;
  if(report.error){el.textContent=report.error;return;}
  const count=report.files.filter(f=>f.cached).length;
  el.textContent=(report.ready?'Ready for offline practice entry':report.cacheSupported?'App files not fully ready':'Offline caching unavailable')+` · ${count}/${OFFLINE_FILES.length} files cached`+(message?' · '+message:'')+'. Full account data still requires internet.';
}
async function checkOfflineShell(){
  const el=document.getElementById('offlineShellStatus');if(el)el.textContent='Checking cached app files…';
  try{const report=await offlineShellReport();displayOfflineShell(report);return report;}catch(e){displayOfflineShell({error:'Could not check app files: '+e.message});return null;}
}
async function prepareOfflineShell(){
  if(shellBusy)return;
  if(navigator.onLine===false){toast('Reconnect to download the app files.');return;}
  if(!('caches' in window)||!('serviceWorker' in navigator)){toast('Offline app files are not supported in this browser.');return;}
  shellBusy=true;
  const button=document.getElementById('prepareOfflineShell');if(button)button.disabled=true;
  try{
    await navigator.serviceWorker.register('./sw.js');
    const cache=await caches.open(OFFLINE_SHELL);let completed=0;
    for(const file of OFFLINE_FILES){
      const url=new URL(file,location.href),response=await fetch(url.href,{cache:'reload'});
      if(!response.ok)throw Error('Could not download '+file+' (HTTP '+response.status+').');
      await cache.put(url.href,response);completed++;
      const el=document.getElementById('offlineShellStatus');if(el)el.textContent=`Saving app files: ${completed}/${OFFLINE_FILES.length}. Existing cached files are preserved.`;
    }
    const report=await offlineShellReport();displayOfflineShell(report,report.ready?'You can test airplane mode now':'Reopen while online once to activate the app shell');
  }catch(e){const report=await offlineShellReport().catch(()=>null);displayOfflineShell(report||{error:e.message},'Download interrupted: '+e.message+'. Retry to keep completed files.');}
  finally{shellBusy=false;const button=document.getElementById('prepareOfflineShell');if(button)button.disabled=false;}
}
async function downloadOfflineDiagnostics(){
  try{
    const shell=await offlineShellReport();
    const profile=readOfflineProfile(),owner=cloud.user?.id||profile?.owner;
    const report={...shell,installedMode:window.matchMedia?.('(display-mode: standalone)').matches||!!navigator.standalone,offlinePracticeEnabled:!!profile&&profile.owner===owner,pendingPractice:pendingPracticeCount(owner),cloudLoaded:cloud.ready,accountDataOffline:false};
    const url=URL.createObjectURL(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download='belay-offline-readiness-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(e){toast('Could not generate the readiness report: '+e.message);}
}
const OFFLINE_PROFILE='belay-offline-practice-profile-v1',OUTBOX_PREFIX='belay-offline-practice-v1:';
function readOfflineProfile(){
  try{const p=JSON.parse(localStorage.getItem(OFFLINE_PROFILE)||'null');return p&&typeof p.owner==='string'&&/^[\w-]+$/.test(p.owner)&&Array.isArray(p.skills)&&p.skills.every(s=>typeof s==='string'&&s.trim())?p:null;}catch(e){return null;}
}
function readPracticeQueue(owner){
  if(!owner||!/^[\w-]+$/.test(owner))throw Error('Invalid offline account.');
  const raw=localStorage.getItem(OUTBOX_PREFIX+owner);
  if(!raw)return [];
  const data=JSON.parse(raw);
  if(!Array.isArray(data)||data.some(l=>!l||typeof l.id!=='string'||!/^[\w-]+$/.test(l.id)||typeof l.s!=='string'||!l.s.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(l.d)||!Number.isInteger(l.m)||l.m<1||l.m>1440))throw Error('Offline practice queue is invalid. Export the stored data before changing it.');
  return data;
}
function queuePractice(owner,entry){
  const items=readPracticeQueue(owner);
  items.push(entry);
  localStorage.setItem(OUTBOX_PREFIX+owner,JSON.stringify(items)); // Write before updating in-memory state.
}
function pendingPracticeCount(owner){try{return owner?readPracticeQueue(owner).length:0}catch(e){return -1}}
function appendPendingPractice(owner){
  if(!owner||owner!==cloud.user?.id)return 0;
  const entries=readPracticeQueue(owner),have=new Set(S.log.map(l=>l.id).filter(Boolean));
  let added=0;for(const entry of entries)if(!have.has(entry.id)){S.log.push({...entry});have.add(entry.id);added++}
  return added;
}
function clearSavedPractice(owner,payload){
  if(!owner)return;
  const saved=new Set(payload.log.map(l=>l.id).filter(Boolean));
  if(!saved.size)return;
  const existing=readPracticeQueue(owner);
  const remaining=existing.filter(l=>!saved.has(l.id));
  if(remaining.length!==existing.length)localStorage.setItem(OUTBOX_PREFIX+owner,JSON.stringify(remaining));
}
function recordPractice(s,m){
  if(!Number.isInteger(m)||m<1||m>1440||typeof s!=='string'||!s.trim()||!cloud.ready||!cloud.user)return false;
  const owner=cloud.user.id,entry={id:crypto.randomUUID(),d:today(),s,m};
  const profile=readOfflineProfile();
  if(profile?.owner===owner){
    try{queuePractice(owner,entry)}catch(e){toast('Could not save practice on this device. Storage may be full.');cloud.error=e.message;notice();return false;}
  }
  S.log.push(entry);save();return true;
}
function enableOfflinePractice(){
  if(!cloud.ready||!cloud.user)return;
  try{
    const previous=readOfflineProfile();if(previous&&previous.owner!==cloud.user.id&&pendingPracticeCount(previous.owner)!==0){toast('The previous account has pending device practice. Sign into that account and sync first.');return;}
    const profile={owner:cloud.user.id,email:cloud.user.email||'',skills:[...new Set(S.skills.map(s=>s.name).filter(Boolean))],updated:today()};
    localStorage.setItem(OFFLINE_PROFILE,JSON.stringify(profile));render();notice();toast('Offline practice enabled for this device.');
  }catch(e){toast('Device storage is unavailable; offline practice was not enabled.');}
}
function disableOfflinePractice(){
  if(!cloud.user)return;
  const count=pendingPracticeCount(cloud.user.id);
  if(count!==0){toast('Sync pending practice before disabling offline mode.');return;}
  try{localStorage.removeItem(OFFLINE_PROFILE);render();notice();}catch(e){toast('Could not update device storage.');}
}
function renderOfflinePracticeGate(){
  const profile=readOfflineProfile();if(!profile||navigator.onLine!==false||cloud.user&&cloud.user.id!==profile.owner)return false;
  let queue=[];try{queue=readPracticeQueue(profile.owner)}catch(e){document.getElementById('app').innerHTML=`<section class="card"><h2>Offline practice needs attention</h2><p>${esc(e.message)}</p><p>Reconnect to review your device data. Existing queued entries have not been removed.</p></section>`;return true;}
  const options=profile.skills.map(s=>`<option value="${esc(s)}">${esc(s)}</option>`).join('');
  document.getElementById('app').innerHTML=`<section class="card"><h2>Practice offline</h2><p class="muted">For ${esc(profile.email||'your last enabled account')} on this device. Entries stay on this device until you sign into the same account and sync. This screen does not load cloud records.</p><p><b>${queue.length} pending practice ${queue.length===1?'entry':'entries'}</b></p><label for="offlineSkill">Skill</label><select id="offlineSkill">${options}</select><label for="offlineMinutes">Minutes (1–1440)</label><input id="offlineMinutes" type="number" min="1" max="1440" step="1" value="30"><button class="pri" id="saveOfflinePractice" ${options?'':'disabled'} style="margin-top:12px">Save practice on device</button><p class="muted">Keep your browser data. When online, reload Belay and sign into this account to synchronize.</p></section>`;
  document.getElementById('saveOfflinePractice').onclick=()=>{
    const m=Number(document.getElementById('offlineMinutes').value),s=document.getElementById('offlineSkill').value;
    if(!Number.isInteger(m)||m<1||m>1440||!profile.skills.includes(s)){toast('Choose a skill and 1–1440 whole minutes.');return;}
    try{queuePractice(profile.owner,{id:crypto.randomUUID(),d:today(),s,m});renderOfflinePracticeGate();toast('Practice kept on this device.');showConnection();}catch(e){toast('Device storage is unavailable. Practice was not recorded.');}
  };
  return true;
}
function showConnection(){
  const el=document.getElementById('connectionState');if(!el)return;
  const offline=navigator.onLine===false;
  el.className=offline?'offline':'';
  const owner=cloud.user?.id||readOfflineProfile()?.owner,count=pendingPracticeCount(owner),queued=count>0?` · ${count} device practice pending`:count<0?' · device queue needs attention':'';
  el.textContent=offline?(cloud.dirty?'Offline · other unsaved changes are only in this open tab':'Offline · account data needs internet'):(cloud.dirty?'Online · changes awaiting cloud save':'Online · cloud sync available');el.textContent+=queued;
}
function normalize(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Expected a Belay data object.');
  const d=JSON.parse(JSON.stringify(value));
  for(const key of ['skills','jobs','work','log'])if(!Array.isArray(d[key]))throw Error('Missing or invalid '+key+' array.');
  if(d.milestones!=null&&!Array.isArray(d.milestones))throw Error('Invalid milestones array.');
  if(d.applications!=null&&!Array.isArray(d.applications))throw Error('Invalid applications array.');
  for(const key of ['settings','cOver','cAI','coach'])if(d[key]!=null&&(typeof d[key]!=='object'||Array.isArray(d[key])))throw Error('Invalid '+key+'.');
  const finite=(x)=>typeof x==='number'&&Number.isFinite(x);
  const requirements=r=>r&&typeof r==='object'&&!Array.isArray(r)&&Object.entries(r).every(([n,l])=>n&&finite(l)&&l>=1&&l<=5);
  const countryInput=v=>v&&typeof v==='object'&&!Array.isArray(v)&&['g','t','l','i'].every(k=>finite(v[k]))&&v.g>0&&v.l>0&&v.t>=0&&v.t<=100&&v.i>-100&&
    (v.source==null||typeof v.source==='string'&&(v.source===''||/^https:\/\/[^\s]+$/i.test(v.source)))&&
    (v.asOf==null||typeof v.asOf==='string'&&(v.asOf===''||/^\d{4}-\d{2}-\d{2}$/.test(v.asOf)&&!Number.isNaN(Date.parse(v.asOf+'T00:00:00Z'))))&&
    (v.notes==null||typeof v.notes==='string');
  for(const key of ['cOver','cAI'])if(Object.entries(d[key]||{}).some(([code,v])=>!/^[A-Z]{2}$/.test(code)||!countryInput(v)))throw Error('Invalid country assumptions in '+key+'.');
  if(d.skills.some(s=>!s||typeof s.name!=='string'||!s.name.trim()||!finite(s.level)||s.level<0||s.level>5))throw Error('Invalid skill name or level.');
  if(d.jobs.some(j=>!j||typeof j.title!=='string'||!requirements(j.req)||!finite(j.salary)||j.salary<0||!finite(j.tier)||j.tier<1||j.tier>5))throw Error('Invalid job profile.');
  if(d.work.some(w=>!w||typeof w.title!=='string'||(w.skills&&!Array.isArray(w.skills))))throw Error('Invalid work record.');
  if(d.log.some(l=>!l||typeof l.s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(l.d)||!finite(l.m)||l.m<0))throw Error('Invalid practice record.');
  if((d.milestones||[]).some(m=>!m||typeof m.title!=='string'||!m.title.trim()||typeof m.done!=='boolean'||(m.jobId!=null&&typeof m.jobId!=='string')||(m.due&&!/^\d{4}-\d{2}-\d{2}$/.test(m.due))||(m.notes!=null&&typeof m.notes!=='string')))throw Error('Invalid career milestone.');
  if((d.applications||[]).some(a=>!a||typeof a.title!=='string'||!a.title.trim()||!['Saved','Applied','Interview','Offer','Rejected','Withdrawn'].includes(a.status)||typeof a.company!=='string'||typeof a.location!=='string'||typeof a.url!=='string'||(a.url&&!/^https?:\/\//i.test(a.url))||(a.salary!=null&&(!finite(a.salary)||a.salary<0))||!requirements(a.req)||(a.appliedDate&&!/^\d{4}-\d{2}-\d{2}$/.test(a.appliedDate))||typeof a.notes!=='string'||typeof a.updated!=='string'))throw Error('Invalid job application.');
  if(d.coach?.practiceRoadmap){
    const p=d.coach.practiceRoadmap;
    if(!/^\d{4}-\d{2}-\d{2}$/.test(p.created||'')||!Number.isFinite(new Date(p.created+'T00:00:00').getTime())||typeof p.targetJobId!=='string'||!Array.isArray(p.weeks)||p.weeks.length!==4||p.weeks.some(w=>!w||typeof w.skill!=='string'||!w.skill.trim()||!Number.isInteger(w.minutes)||w.minutes<1||w.minutes>1440))throw Error('Invalid coaching roadmap.');
  }
  // Keep attribute IDs safe, including older imported records with missing IDs.
  for(const key of ['skills','jobs','work','milestones','applications']){const seen=new Set();for(const row of d[key]||[]){if(typeof row.id!=='string'||!/^[\w-]+$/.test(row.id)||seen.has(row.id))row.id=crypto.randomUUID();seen.add(row.id);}}
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
  showConnection();
  const el=document.getElementById('syncNotice');
  el.innerHTML=cloud.error?`<div class="card" style="border-color:var(--bad)"><b>Changes are not saved</b><p>${esc(cloud.error)}</p><button id="retryCloud">Retry save</button> <button id="exportCloud">Download my changes</button> <button id="reloadCloud">Load cloud version</button>${cloud.conflict&&pendingPracticeCount(cloud.user?.id)>0?' <button id="rebasePractice">Recover device practice from latest cloud data</button>':''}</div>`:'';
  if(cloud.error){document.getElementById('retryCloud').onclick=()=>flushSave();document.getElementById('exportCloud').onclick=downloadState;document.getElementById('reloadCloud').onclick=()=>{if(!cloud.dirty||confirm('Discard unsaved changes and load the cloud version? Download your changes first if needed.')){cloud.dirty=false;cloud.conflict=false;cloud.error='';loadCloud();}};}
  const rebase=document.getElementById('rebasePractice');if(rebase)rebase.onclick=()=>{if(!confirm('Load the latest cloud data and reapply only queued practice? Other unsaved edits will be discarded. Download your changes first if needed.'))return;cloud.dirty=false;cloud.conflict=false;cloud.error='';loadCloud();};
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
  cloud.dirty=true;cloud.change++;setSave('Unsaved changes…');showConnection();clearTimeout(cloud.timer);if(navigator.onLine!==false)cloud.timer=setTimeout(flushSave,500);
}
async function flushSave(){
  clearTimeout(cloud.timer);
  if(cloud.saving)return cloud.saving;
  if(!cloud.ready||!cloud.dirty||cloud.conflict)return false;
  if(navigator.onLine===false){cloud.error='Offline. Changes are in this open tab only. Download your changes, reconnect, then retry the save.';setSave('Offline · not saved');notice();return false;}
  const epoch=cloud.epoch,owner=cloud.user.id;
  cloud.saving=(async()=>{
    while(cloud.dirty&&cloud.ready&&cloud.epoch===epoch){
      const change=cloud.change;
      try{
        const payload=normalize(S);setSave('Saving to cloud…');
        const {data,error}=await cloud.client.rpc('belay_save_state',{p_data:payload,p_version:cloud.version});
        if(error)throw error;
        if(cloud.epoch!==epoch||cloud.user?.id!==owner)return false;
        cloud.version=data.version;cloud.dirty=cloud.change!==change;cloud.error='';
        try{clearSavedPractice(owner,payload)}catch(e){cloud.error='Cloud saved, but could not clean up the device practice queue. It will be checked again next time.';}
        notice();
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
  if(renderOfflinePracticeGate())return;
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
    let merged=0,queueIssue='';try{clearSavedPractice(cloud.user.id,S);merged=appendPendingPractice(cloud.user.id)}catch(e){queueIssue='Device practice queue needs attention: '+e.message;}
    cloud.ready=true;cloud.error=queueIssue;cloud.conflict=false;render();notice();setSave(merged?`${merged} device practice entries awaiting sync`:row.data?'Loaded from cloud ✓':'Cloud connected · no records yet');
    if(merged)save();
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
  showConnection();
  try{cloud.legacy=localStorage.getItem('careerClimb');}catch(e){}
  if(!window.supabase){cloud.error='The sign-in library could not load. Check your connection and reload.';renderGate();return;}
  cloud.client=window.supabase.createClient('https://wylxvmkcrexwfpjpbhyy.supabase.co','sb_publishable_e3pDOuxIdstaC7s0a680kQ_R10TrAyv',{auth:{storageKey:'belay-auth',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  renderGate();
  cloud.client.auth.onAuthStateChange((_event,session)=>{setTimeout(()=>sessionChanged(session),0);});
  const {data,error}=await cloud.client.auth.getSession();
  if(error){cloud.error=error.message;renderGate();}else await sessionChanged(data.session);
}
window.addEventListener('beforeunload',e=>{if(cloud.dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('offline',()=>{showConnection();if(cloud.dirty){cloud.error='Offline. Changes are in this open tab only. Download your changes before closing.';notice();}});
window.addEventListener('online',()=>{showConnection();if(cloud.dirty)flushSave();else if(cloud.user&&!cloud.ready&&!cloud.loading)loadCloud();else if(!cloud.client)renderGate('Back online. Reload to sign in and synchronize device practice.');});
if('serviceWorker' in navigator&&location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
// Refresh when returning to the tab, but never interrupt a form or unsaved work.
window.addEventListener('focus',()=>{if(cloud.ready&&!cloud.dirty&&!cloud.saving&&!document.getElementById('modal').classList.contains('on')&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))loadCloud();});
