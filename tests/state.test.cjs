const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ref={LV:['None','Aware','Basic','Working','Strong','Expert'],TIER:['','Entry','Mid','Senior','Lead','Manager'],COUNTRIES:[['JP','Japan',36000,24,14600,2.1]],STARTER_SKILLS:[['Test skill','Design',2]],STARTER_WANT:['Test skill'],STARTER_JOBS:[['Test job',2,100,{'Test skill':2}]],RANKS:[[0,'Apprentice'],[1000,'Engineer']],PERSONA:'Test coach',PROMPTS:{daily:'Test prompt'},BUCKETS:{},settings:{gross:5500000,fx:157,weeklyGoal:300}};
function setup(store=new Map(),costEntries=[]){
 const els={},listeners={},storageObjects=new Map();let record=null,fail=false,authCallback;
 const element=id=>els[id]??=( {innerHTML:'',textContent:'',value:'',style:{},dataset:{},setAttribute(){},removeAttribute(){},classList:{add(){},remove(){},contains(){return false}},addEventListener(){},insertAdjacentHTML(){},click(){},querySelector(){return element('button')}});
 const doc={getElementById:element,addEventListener(n,f){listeners[n]=f},querySelector:element,activeElement:{tagName:'BODY'},createElement:element};
 const client={auth:{onAuthStateChange(f){authCallback=f},async getSession(){return {data:{session:null}}},async signOut(){authCallback('SIGNED_OUT',null);return {}}},from(table){if(table==='cost_management_expenses'){let dates=[],owner='';return {select(){return this},eq(field,value){if(field==='user_id')owner=value;return this},in(field,values){if(field==='date')dates=values;return this},async limit(n){return {data:costEntries.filter(r=>r.user_id===owner&&dates.includes(r.date)).slice(0,n),error:fail?{message:'Simulated Cost access failure'}:null}}};}return {select(){return this},eq(){return this},async single(){return {data:{data:ref}}},async maybeSingle(){return {data:record?structuredClone(record):null}}}},async rpc(name,args){
  if(name==='belay_cost_summary')return {data:[{m:'2026-10',c:'Restaurant',s:10000,n:5}]};
  await new Promise(r=>setTimeout(r,5));if(fail)return {error:{message:'Simulated offline'}};
  if(args.p_version!==(record?.version||0))return {error:{message:'BELAY_CONFLICT: newer data'}};
  record={data:structuredClone(args.p_data),version:(record?.version||0)+1};return {data:{version:record.version}};
 }};
 client.storage={from(bucket){assert.equal(bucket,'belay_salary_slips');return {
  async upload(key,file,opts){if(fail)return {error:{message:'Upload unavailable'}};storageObjects.set(key,{file,opts});return {data:{path:key}}},
  async download(key){return storageObjects.has(key)?{data:storageObjects.get(key).file}:{error:{message:'File missing'}}},
  async remove(keys){for(const key of keys)storageObjects.delete(key);return {data:keys}}
 }}};
 const context=vm.createContext({document:doc,window:{supabase:{createClient(){return client}},addEventListener(){}},localStorage:{getItem(k){return store.get(k)||null},setItem(k,v){store.set(k,v)},removeItem(k){store.delete(k)}},console,Intl,URL,Blob,crypto:require('node:crypto').webcrypto,structuredClone,setTimeout,clearTimeout,confirm:()=>true,navigator:{clipboard:{writeText:async()=>{}}},scrollTo(){},location:{origin:'https://example.invalid',pathname:'/',href:'https://example.invalid/',protocol:'https:'}});
 vm.runInContext(fs.readFileSync(path.join(root,'cloud.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace('boot();',''),context);
 const run=s=>vm.runInContext(s,context);
 return {click(dataset){listeners.click({target:{closest:()=>({dataset})},stopPropagation(){}})},run,ready:run('boot()'),els,store,storageObjects,record:()=>record,setRecord(r){record=r},fail(v){fail=v}};
}
test('database persistence, all views, cost, revision conflicts and recovery',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user',email:'test@example.invalid'}})");
 assert.match(t.els.app.innerHTML,/Build your career map/);
 t.run("S.skills=[{id:'s',name:'Test skill',level:2,cat:'Design'}];save()");await t.run('flushSave()');assert.equal(t.record().data.skills.length,1);
 t.run('S=blank()');await t.run('loadCloud()');assert.equal(t.run('S.skills[0].name'),'Test skill');
 for(const tab of ['home','coach','skills','jobs','work','world','more','settings']){t.run(`tab='${tab}';render()`);assert.ok(t.els.app.innerHTML.length>0);}
 await t.run('syncCost()');await t.run('flushSave()');assert.equal(t.record().data.cost.rows[0].s,10000);
 t.record().version++;t.record().data.external='from SQL';t.run("S.log.push({s:'Test skill',d:'2026-11-09',m:30});save()");assert.equal(await t.run('flushSave()'),false);assert.equal(t.record().data.log.length,0);assert.match(t.els.syncNotice.innerHTML,/Another device/);
 t.run("cloud.dirty=false;cloud.conflict=false");await t.run('loadCloud()');assert.equal(t.run('S.external'),'from SQL');
 t.fail(true);t.run("S.log.push({s:'Test skill',d:'2026-11-09',m:30});save()");assert.equal(await t.run('flushSave()'),false);assert.equal(t.run('cloud.dirty'),true);t.fail(false);assert.equal(await t.run('flushSave()'),true);assert.equal(t.record().data.log.length,1);
 await t.run('sessionChanged(null)');assert.equal(t.run('S.skills.length'),0);assert.equal(t.els.rank.innerHTML,'');assert.match(t.els.app.innerHTML,/Sign in to Belay/);
});
test('opt-in local migration keeps source on failure and removes it on success',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");const raw=t.run("JSON.stringify({...blank(),skills:[{id:'s',name:'Old skill',level:3}]})");t.store.set('careerClimb',raw);t.run('cloud.legacy=true');
 t.fail(true);await t.run('migrateLocal()');assert.equal(t.store.get('careerClimb'),raw);t.fail(false);await t.run('flushSave()');await t.run('migrateLocal()');assert.equal(t.store.has('careerClimb'),false);assert.equal(t.record().data.skills[0].name,'Old skill');
});
test('queued edits are serialized; malformed imports rejected',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");t.run('save()');const pending=t.run('flushSave()');t.run("S.skills.push({id:'s',name:'Later edit',level:1});save()");await pending;assert.equal(t.record().data.skills[0].name,'Later edit');assert.equal(t.record().version,2);assert.equal(t.run('cloud.dirty'),false);
 assert.throws(()=>t.run('normalize({skills:null})'),/skills/);
 assert.throws(()=>t.run("normalize({...blank(),jobs:[{title:'Bad',tier:9,salary:3,req:{}}]})"),/job/);
});

test('target job, skill filters, exact levels and relocated account controls',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user',email:'test@example.invalid'}})");
 t.run(`S.skills=[{id:'cad',name:'CAD',level:3,want:false},{id:'controls',name:'Controls',level:1,want:true}];S.jobs=[{id:'robotics',title:'Robotics engineer',tier:3,salary:6000000,req:{CAD:3,Controls:4}}];tab='jobs';render()`);
 t.els.targetJob.onchange({target:{value:'robotics'}});await t.run('flushSave()');
 assert.equal(t.record().data.settings.targetJobId,'robotics');
 t.run("tab='home';render()");assert.match(t.els.app.innerHTML,/<h2>Controls<\/h2>/);assert.match(t.els.app.innerHTML,/63%/);assert.equal((t.els.nav.innerHTML.match(/data-tab=/g)||[]).length,4);
 t.run("tab='skills'");t.click({act:'skillFilter',k:'wanted'});assert.match(t.els.app.innerHTML,/<h2>Controls<\/h2>/);assert.doesNotMatch(t.els.app.innerHTML,/<h2>CAD<\/h2>/);
 t.click({act:'setLv',id:'controls',v:'1'});assert.equal(t.run('S.skills[1].level'),1);
 t.click({act:'setLv',id:'controls',v:'0'});assert.equal(t.run('S.skills[1].level'),0);
 t.click({act:'practice',s:'Controls'});t.click({act:'skillFilter',k:'stale'});assert.match(t.els.app.innerHTML,/No skills in this filter/);await t.run('flushSave()');
 t.run("tab='settings';render()");assert.match(t.els.app.innerHTML,/id="signOut"/);assert.doesNotMatch(t.els.account.innerHTML,/id="signOut"/);assert.match(t.els.account.innerHTML,/data-tab="settings"/);
 await t.els.signOut.onclick();await new Promise(r=>setTimeout(r,10));assert.equal(t.run('cloud.ready'),false);
});
test('country shortlist persists, excludes duplicates and compares monthly yen',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");
 t.run(`COUNTRIES=[['JP','Japan',36000,24,14600,2.1],['XX','Test country',48000,20,12000,2]];tab='world';render()`);
 assert.equal((t.els.app.innerHTML.match(/class="card country-card/g)||[]).length,1);
 t.els.compareCountry0.onchange({target:{value:'XX'}});await t.run('flushSave()');assert.equal(t.record().data.settings.compareCountries[0],'XX');
 assert.equal((t.els.app.innerHTML.match(/class="card country-card/g)||[]).length,2);
 const expected=t.run("(()=>{const {rows,fx}=countryRows();return yen(rows.find(r=>r.c==='XX').vs/12*fx)})()");assert.ok(t.els.app.innerHTML.includes(expected+' / month vs Japan'));
 t.click({act:'sortC',k:'name'});assert.match(t.els.app.innerHTML,/id="countryTable" open/);
 t.run("S.settings.compareCountries=['XX','XX'];render()");assert.equal(t.run("selectedCountries().join(',')"),'XX,');
 t.run("S.settings.compareCountries=['JP','removed'];render()");assert.equal(t.run("selectedCountries().join(',')"),',');
 t.run("S.settings.compareCountries={invalid:true};render()");assert.equal(t.run('selectedCountries().length'),2);
});

test('custom practice rejects invalid minutes before persisting',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");
 t.run("S.skills=[{id:'s',name:'Test skill',level:1}]");
 t.click({act:'practiceCustom',s:'Test skill'});
 for(const bad of [-10,0,1.5,1441]){
  t.run(`document.getElementById('f_m').value='${bad}'`);t.els.fx_save.onclick();
  assert.equal(t.run('S.log.length'),0);
 }
 t.run("document.getElementById('f_m').value='45'");t.els.fx_save.onclick();await t.run('flushSave()');
 assert.equal(t.record().data.log[0].m,45);
});

test('date keys and streak use local calendar dates',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");
 assert.equal(t.run('dateKey(new Date(2026,10,20,0,30))'),'2026-11-20');
 t.run("S.log=[{s:'Test skill',d:today(),m:30}]");
 assert.equal(t.run('streak()'),1);
});

test('career milestones and skill evidence survive cloud reload',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");
 t.run("S.jobs=[{id:'job',title:'Robotics engineer',tier:3,salary:6000000,req:{CAD:3}}];S.settings.targetJobId='job';S.skills=[{id:'cad',name:'CAD',cat:'Engineering',level:2}];S.work=[{id:'w',title:'Designed test fixture',skills:['CAD'],date:'2026-11-10'}]");
 t.click({act:'addMilestone'});
 t.run("document.getElementById('f_title').value='Complete CAD project';document.getElementById('f_due').value='2026-12-15';document.getElementById('f_jobId').value='job'");
 t.els.fx_save.onclick();await t.run('flushSave()');
 assert.equal(t.record().data.milestones[0].jobId,'job');
 t.run("tab='skills';render()");assert.match(t.els.app.innerHTML,/Evidence: Designed test fixture/);
 t.run("tab='milestones';render()");assert.match(t.els.app.innerHTML,/Complete CAD project/);
 t.click({act:'toggleMilestone',id:t.record().data.milestones[0].id});await t.run('flushSave()');
 assert.equal(t.record().data.milestones[0].done,true);
 t.run('S=blank()');await t.run('loadCloud()');
 assert.equal(t.run('S.milestones[0].done'),true);
 assert.throws(()=>t.run("normalize({...blank(),milestones:[{title:'Broken',done:'yes'}]})"),/milestone/);
});

test('coach builds a job-gap-driven 4-week roadmap and counts logged practice',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");
 t.run("S.skills=[{id:'cad',name:'CAD',level:1,want:true},{id:'python',name:'Python',level:2,want:true}];S.jobs=[{id:'robotics',title:'Robotics engineer',tier:3,salary:7000000,req:{CAD:4,Python:3}}];S.settings.targetJobId='robotics';tab='coach';render()");
 t.click({act:'buildRoadmap'});
 assert.equal(t.run('S.coach.practiceRoadmap.weeks.length'),4);
 assert.equal(t.run('S.coach.practiceRoadmap.weeks[0].skill'),'CAD');
 assert.match(t.els.app.innerHTML,/Week 1: CAD/);
 t.click({act:'practice',s:'CAD'});
 assert.equal(t.run('roadmapProgress(S.coach.practiceRoadmap,0).done'),30);
 await t.run('flushSave()');t.run('S=blank()');await t.run('loadCloud()');
 assert.equal(t.run('S.coach.practiceRoadmap.weeks[0].minutes'),120);
 assert.equal(t.run('roadmapProgress(S.coach.practiceRoadmap,0).done'),30);
 assert.throws(()=>t.run("normalize({...blank(),coach:{practiceRoadmap:{created:'bad',targetJobId:'',weeks:[]}}})"),/roadmap/);
});

test('job applications persist posting details, skill fit and application status',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");
 t.run("S.skills=[{id:'cad',name:'CAD',level:2,want:true}];tab='applications';render()");
 t.click({act:'addApplication'});
 t.run("document.getElementById('f_title').value='Design engineer';document.getElementById('f_company').value='Example Motors';document.getElementById('f_location').value='Saitama';document.getElementById('f_url').value='https://example.com/jobs/12';document.getElementById('f_salary').value='6500000';document.getElementById('f_req').value='CAD: 4';document.getElementById('f_status').value='Applied';document.getElementById('f_appliedDate').value='2026-11-19';document.getElementById('f_notes').value='Prepare portfolio'");
 t.els.fx_save.onclick();await t.run('flushSave()');
 assert.equal(t.record().data.applications[0].status,'Applied');
 assert.equal(t.record().data.applications[0].salary,6500000);
 assert.match(t.els.app.innerHTML,/50% skill fit/);
 assert.match(t.els.app.innerHTML,/Open job posting/);
 t.run('S=blank()');await t.run('loadCloud()');
 assert.equal(t.run('S.applications[0].company'),'Example Motors');
 assert.throws(()=>t.run("normalize({...blank(),applications:[{title:'Bad',status:'Unknown'}]})"),/application/);
});

test('country comparison evidence persists, labels source age, and rejects unsafe links',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");
 t.run("S.cOver.JP={g:36000,t:24,l:14600,i:2.1,source:'https://example.org/figures',asOf:today(),notes:'Tokyo estimate'};tab='world';render()");
 assert.match(t.els.app.innerHTML,/Source recorded · check figures/);
 assert.match(t.els.app.innerHTML,/https:\/\/example.org\/figures/);
 await t.run('save();flushSave()');t.run('S=blank()');await t.run('loadCloud()');
 assert.equal(t.run('S.cOver.JP.notes'),'Tokyo estimate');
 t.run("S.cOver.JP.asOf='2020-01-01';render()");assert.match(t.els.app.innerHTML,/Over 1 year old/);
 assert.throws(()=>t.run("normalize({...blank(),cOver:{JP:{g:36000,t:24,l:14600,i:2,source:'javascript:alert(1)'}}})"),/country assumptions/);
 assert.throws(()=>t.run("normalize({...blank(),cAI:{US:{g:-1,t:15,l:15000,i:2}}})"),/country assumptions/);
});

test('offline edits stay unsaved until reconnection, with explicit recovery warning',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");
 t.run("navigator.onLine=false;S.log.push({d:today(),s:'Test skill',m:35});save()");
 assert.equal(await t.run('flushSave()'),false);
 assert.equal(t.record(),null);
 assert.match(t.els.connectionState.textContent,/only in this open tab/);
 assert.match(t.els.syncNotice.innerHTML,/Download my changes/);
 t.run('navigator.onLine=true');assert.equal(await t.run('flushSave()'),true);
 assert.equal(t.record().data.log[0].m,35);
 assert.equal(t.run('cloud.dirty'),false);
});

test('long form has labeled dialog, scrollable body and fixed save controls',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");
 t.run("S.jobs=[{id:'job',title:'Design engineer',tier:3,salary:6000000,req:{}}]");
 t.click({act:'addApplication'});
 assert.match(t.els.sheet.innerHTML,/class="form-fields"/);
 assert.match(t.els.sheet.innerHTML,/class="form-actions row sp"/);
 assert.match(t.els.sheet.innerHTML,/id="formTitle"/);
});

test('opt-in offline queue survives restart and syncs without duplicate practice',async()=>{
 const storage=new Map();const t=setup(storage);await t.ready;await t.run("sessionChanged({user:{id:'person-a',email:'a@example.invalid'}})");
 t.run("S.skills=[{id:'cad',name:'CAD',cat:'Design',level:2}];tab='settings';render()");
 t.click({act:'enableOfflinePractice'});
 assert.equal(t.run('readOfflineProfile().owner'),'person-a');
 t.run("navigator.onLine=false;logPractice('CAD',30)");
 assert.equal(t.run('pendingPracticeCount(\'person-a\')'),1);
 assert.equal(await t.run('flushSave()'),false);
 const restart=setup(storage);restart.run('navigator.onLine=false');await restart.ready;restart.run('renderGate()');
 assert.match(restart.els.app.innerHTML,/Practice offline/);
 restart.run("document.getElementById('offlineSkill').value='CAD';document.getElementById('offlineMinutes').value='25'");
 restart.els.saveOfflinePractice.onclick();
 assert.equal(restart.run("pendingPracticeCount('person-a')"),2);
 const online=setup(storage);await online.ready;await online.run("sessionChanged({user:{id:'person-a',email:'a@example.invalid'}})");
 assert.equal(online.run('S.log.length'),2);
 await online.run('flushSave()');
 assert.equal(online.record().data.log.length,2);
 assert.equal(online.run("pendingPracticeCount('person-a')"),0);
 // A crash after a server save but before local cleanup must not replay an existing ID.
 online.run("queuePractice('person-a',{...S.log[0]})");
 await online.run('loadCloud()');
 assert.equal(online.run('S.log.length'),2);
 assert.equal(online.run("pendingPracticeCount('person-a')"),0);
});

test('device queue is account scoped and protects entries from another account',async()=>{
 const storage=new Map(),t=setup(storage);await t.ready;await t.run("sessionChanged({user:{id:'person-a',email:'a@example.invalid'}})");
 t.run("S.skills=[{id:'skill',name:'CAD',level:3}]");t.click({act:'enableOfflinePractice'});
 t.run("navigator.onLine=false;logPractice('CAD',45)");
 const other=setup(storage);await other.ready;await other.run("sessionChanged({user:{id:'person-b',email:'b@example.invalid'}})");
 assert.equal(other.run('S.log.length'),0);
 assert.equal(other.run("pendingPracticeCount('person-a')"),1);
 other.click({act:'enableOfflinePractice'});
 assert.equal(other.run('readOfflineProfile().owner'),'person-a');
 assert.equal(other.run('S.log.length'),0);
});

test('version conflict never drops queued practice; recovery rebases on newer cloud state',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'person-a',email:'a@example.invalid'}})");
 t.click({act:'enableOfflinePractice'});
 t.run("navigator.onLine=false;logPractice('Test skill',40)");
 assert.equal(t.run("pendingPracticeCount('person-a')"),1);
 t.setRecord({version:1,data:JSON.parse(t.run("JSON.stringify({...blank(),settings:{...blank().settings,weeklyGoal:420}})"))});
 t.run('navigator.onLine=true');assert.equal(await t.run('flushSave()'),false);
 assert.equal(t.run('cloud.conflict'),true);
 assert.equal(t.run("pendingPracticeCount('person-a')"),1);
 assert.match(t.els.syncNotice.innerHTML,/Recover device practice from latest cloud data/);
 await t.els.rebasePractice.onclick();
 // Recovery loads latest state and schedules a new versioned save.
 await new Promise(r=>setTimeout(r,20));await t.run('flushSave()');
 assert.equal(t.record().data.settings.weeklyGoal,420);
 assert.equal(t.record().data.log.length,1);
 assert.equal(t.record().data.log[0].m,40);
 assert.equal(t.run("pendingPracticeCount('person-a')"),0);
});

test('offline readiness requires current shell files and active service worker',async()=>{
 const t=setup();await t.ready;
 t.run("window.caches={};caches={keys:async()=>['belay-shell-v8'],open:async()=>({match:async()=>({ok:true})})};navigator.serviceWorker={getRegistration:async()=>({active:{}})}");
 let status=await t.run('offlineShellReport()');assert.equal(status.ready,true);assert.equal(status.files.length,7);
 t.run("caches.open=async()=>({match:async url=>url.href.includes('cloud.js')?null:{ok:true}})");
 status=await t.run('offlineShellReport()');assert.equal(status.ready,false);
 assert.equal(status.files.filter(f=>!f.cached).length,1);
 t.run("caches.open=async()=>({match:async()=>({ok:true})});navigator.serviceWorker.getRegistration=async()=>null");
 status=await t.run('offlineShellReport()');assert.equal(status.ready,false);
 assert.match(t.run('offlineShellCard()'),/Download readiness report/);
 const worker=fs.readFileSync(path.join(root,'sw.js'),'utf8');
 assert.match(worker,/belay-shell-v8/);assert.match(worker,/cloud\.js\?v=10/);
});

test('offline shell download retries missing files without removing cached files',async()=>{
 const t=setup();await t.ready;
 t.run("window.caches={};var storedShell=new Map();caches={keys:async()=>['belay-shell-v8'],open:async()=>({match:async url=>storedShell.get(String(url))||null,put:async (url,response)=>storedShell.set(String(url),response)})};navigator.serviceWorker={register:async()=>({}),getRegistration:async()=>({active:{}})};fetch=async url=>({ok:true,url})");
 await t.run('prepareOfflineShell()');
 assert.equal(t.run('storedShell.size'),7);
 assert.equal((await t.run('offlineShellReport()')).ready,true);
 t.run("storedShell.delete(new URL('./cloud.js?v=10',location.href).href)");
 assert.equal((await t.run('offlineShellReport()')).ready,false);
 await t.run('prepareOfflineShell()');
 assert.equal((await t.run('offlineShellReport()')).ready,true);
 assert.equal(t.run('storedShell.size'),7);
});

test('salary history metadata saves, validates and reloads without affecting old accounts',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");
 assert.equal(t.run('S.salaryHistory.length'),0);
 t.run("tab='salary';render()");assert.match(t.els.app.innerHTML,/No salary history yet/);
 t.click({act:'addSalary'});
 t.run("document.getElementById('f_month').value='2026-10';document.getElementById('f_employer').value='Example Engineering';document.getElementById('f_currency').value='JPY';document.getElementById('f_gross').value='520000';document.getElementById('f_net').value='390000';document.getElementById('f_notes').value='Monthly base pay'");
 t.els.fx_save.onclick();await t.run('flushSave()');
 assert.equal(t.record().data.salaryHistory[0].month,'2026-10');
 assert.equal(t.record().data.salaryHistory[0].net,390000);
 assert.match(t.els.app.innerHTML,/JPY 520,000/);
 t.run('S=blank()');await t.run('loadCloud()');assert.equal(t.run('S.salaryHistory.length'),1);
 assert.throws(()=>t.run("normalize({...blank(),salaryHistory:[{month:'2026-13'}]})"),/salary history/);
 assert.throws(()=>t.run("normalize({...blank(),salaryHistory:[{id:'s',month:'2026-10',employer:'x',currency:'JPY',gross:1,net:1,notes:'',updated:'2026-11-19',filePath:'../../other.pdf',fileName:'a',fileType:'application/pdf',fileSize:100}]})"),/salary history/);
});

test('private payslip upload follows saved salary record and supports explicit removal',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");
 t.run("S.salaryHistory=[{id:'slip1',month:'2026-10',employer:'Example Engineering',currency:'JPY',gross:520000,net:390000,notes:'',updated:today()}];save()");
 await t.run('flushSave()');t.run("tab='salary';render()");
 t.run("document.getElementById('salaryFile_slip1').files=[{name:'october.pdf',type:'application/pdf',size:1234}]");
 await t.run("uploadSalaryFile('slip1')");
 assert.equal(t.storageObjects.size,1);
 assert.equal(t.record().data.salaryHistory[0].fileName,'october.pdf');
 assert.match(t.record().data.salaryHistory[0].filePath,/^test-user\/[\w-]+\.pdf$/);
 assert.equal(t.storageObjects.values().next().value.opts.upsert,false);
 assert.throws(()=>t.run("salaryFileInfo({name:'bad.exe',type:'application/octet-stream',size:100})"),/Only PDF/);
 assert.throws(()=>t.run("salaryFileInfo({name:'too-big.pdf',type:'application/pdf',size:11000000})"),/10 MB/);
 await t.run("removeSalaryFile('slip1')");
 assert.equal(t.storageObjects.size,0);
 assert.equal(t.run('S.salaryHistory[0].filePath'),undefined);
});

test('subscriptions save, reload, sort renewals, and keep currency totals separate',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");
 assert.equal(t.run('S.subscriptions.length'),0);
 t.run("tab='subscriptions';render()");assert.match(t.els.app.innerHTML,/No subscriptions yet/);
 t.click({act:'addSubscription'});
 t.run("document.getElementById('f_name').value='CAD training';document.getElementById('f_provider').value='Learning platform';document.getElementById('f_category').value='Learning';document.getElementById('f_currency').value='JPY';document.getElementById('f_amount').value='12000';document.getElementById('f_interval').value='Yearly';document.getElementById('f_nextRenewal').value='2026-12-01';document.getElementById('f_autoRenew').value='1';document.getElementById('f_status').value='Active';document.getElementById('f_notes').value='Review before renewal'");
 t.els.fx_save.onclick();await t.run('flushSave()');
 assert.equal(t.record().data.subscriptions[0].amount,12000);
 assert.equal(t.record().data.subscriptions[0].autoRenew,true);
 assert.match(t.els.app.innerHTML,/JPY 1,000/);
 t.run("S.subscriptions.push({id:'usd',name:'Software',provider:'Vendor',category:'Software',currency:'USD',amount:30,interval:'Monthly',nextRenewal:'2026-12-10',autoRenew:false,status:'Active',notes:'',updated:today()});save();render()");
 assert.match(t.els.app.innerHTML,/USD 30/);
 assert.doesNotMatch(t.els.app.innerHTML,/JPY 1,030/);
 t.run("S.subscriptions[0].status='Cancelled';save();render()");
 assert.doesNotMatch(t.els.app.innerHTML,/<span class="tag">JPY 1,000 \/ month<\/span>/);
 await t.run('flushSave()');t.run('S=blank()');await t.run('loadCloud()');assert.equal(t.run('S.subscriptions.length'),2);
 t.click({act:'editSubscription',id:'usd'});t.run("document.getElementById('f_amount').value='45'");t.els.fx_save.onclick();await t.run('flushSave()');assert.equal(t.record().data.subscriptions.find(s=>s.id==='usd').amount,45);
 assert.throws(()=>t.run("normalize({...blank(),subscriptions:[{name:'Invalid',amount:-1}]})"),/subscription/);
 assert.throws(()=>t.run("normalize({...blank(),subscriptions:[{id:'s',name:'X',provider:'P',category:'Software',currency:'JPY',amount:10,interval:'Monthly',nextRenewal:'2026-02-30',autoRenew:true,status:'Active',notes:'',updated:today()}]})"),/subscription/);
});

test('career investments separate planned and paid expenses, link milestones and reload',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");
 assert.equal(t.run('S.careerExpenses.length'),0);
 t.run("S.milestones=[{id:'cert',title:'Pass CAD certification',done:false,notes:''}];tab='careerExpenses';render()");
 assert.match(t.els.app.innerHTML,/No career expenses recorded/);
 t.click({act:'addCareerExpense'});
 t.run("document.getElementById('f_title').value='CAD certification exam';document.getElementById('f_provider').value='Test institute';document.getElementById('f_category').value='Certification / exam';document.getElementById('f_date').value='2026-12-01';document.getElementById('f_status').value='Planned';document.getElementById('f_currency').value='JPY';document.getElementById('f_amount').value='18000';document.getElementById('f_milestoneId').value='cert';document.getElementById('f_notes').value='Registration planned'");
 t.els.fx_save.onclick();await t.run('flushSave()');
 assert.equal(t.record().data.careerExpenses[0].milestoneId,'cert');
 assert.match(t.els.app.innerHTML,/Planned JPY 18,000/);
 assert.match(t.els.app.innerHTML,/Milestone: Pass CAD certification/);
 t.run("S.careerExpenses.push({id:'book',title:'Training book',provider:'Shop',category:'Books / materials',date:'2026-11-15',status:'Paid',currency:'USD',amount:20,milestoneId:'',notes:'',updated:today()});save();render()");
 assert.match(t.els.app.innerHTML,/Paid USD 20/);
 assert.doesNotMatch(t.els.app.innerHTML,/Paid JPY 18,000/);
 t.click({act:'editCareerExpense',id:'book'});t.run("document.getElementById('f_amount').value='25'");t.els.fx_save.onclick();await t.run('flushSave()');
 assert.equal(t.record().data.careerExpenses.find(r=>r.id==='book').amount,25);
 t.run('S=blank()');await t.run('loadCloud()');assert.equal(t.run('S.careerExpenses.length'),2);
 assert.throws(()=>t.run("normalize({...blank(),careerExpenses:[{title:'Invalid',amount:-1}]})"),/career expense/);
 assert.throws(()=>t.run("normalize({...blank(),careerExpenses:[{id:'x',title:'Invalid date',provider:'X',category:'Other',date:'2026-02-30',status:'Paid',currency:'JPY',amount:1,milestoneId:'',notes:'',updated:today()}]})"),/career expense/);
});

test('salary analytics group by employer and currency, sum same-month slips and show net change',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");
 t.run("S.salaryHistory=[{id:'a',month:'2026-01',employer:'Example',currency:'JPY',gross:500000,net:400000,notes:'',updated:today()},{id:'b',month:'2026-02',employer:'Example',currency:'JPY',gross:550000,net:430000,notes:'',updated:today()},{id:'bonus',month:'2026-02',employer:'Example',currency:'JPY',gross:100000,net:70000,notes:'Bonus',updated:today()},{id:'usd',month:'2026-02',employer:'Example',currency:'USD',gross:500,net:450,notes:'',updated:today()},{id:'other',month:'2026-01',employer:'Other employer',currency:'JPY',gross:1000,net:800,notes:'',updated:today()}];tab='salary';render()");
 const groups=t.run('salarySeries()');assert.equal(groups.length,3);
 assert.equal(t.run("salarySeries().find(x=>x.employer==='Example'&&x.currency==='JPY').points[1].net"),500000);
 assert.match(t.els.app.innerHTML,/Net change 2026-01 → 2026-02/);
 assert.match(t.els.app.innerHTML,/JPY 100,000/);
 assert.match(t.els.app.innerHTML,/\+25\.0%/);
 assert.match(t.els.app.innerHTML,/Gross JPY 650,000 · Net JPY 500,000/);
 assert.doesNotMatch(t.els.app.innerHTML,/JPY 100,450/);
});

test('renewal attention distinguishes near dates from overdue without claiming a charge',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");
 t.run("(()=>{const date=n=>{const d=new Date(today()+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};S.subscriptions=[{id:'due',name:'Due soon',provider:'P',category:'Learning',currency:'JPY',amount:1000,interval:'Monthly',nextRenewal:date(5),autoRenew:true,status:'Active',notes:'',updated:today()},{id:'over',name:'Past date',provider:'P',category:'Learning',currency:'JPY',amount:2000,interval:'Monthly',nextRenewal:date(-2),autoRenew:false,status:'Active',notes:'',updated:today()},{id:'later',name:'Later',provider:'P',category:'Learning',currency:'JPY',amount:3000,interval:'Monthly',nextRenewal:date(31),autoRenew:true,status:'Active',notes:'',updated:today()},{id:'cancel',name:'Cancelled',provider:'P',category:'Learning',currency:'JPY',amount:3000,interval:'Monthly',nextRenewal:date(2),autoRenew:true,status:'Cancelled',notes:'',updated:today()}]})()");
 assert.equal(t.run('renewalAttention().length'),2);
 t.run("tab='more';render()");assert.match(t.els.app.innerHTML,/2 subscriptions due within 30 days/);
 t.run("tab='subscriptions';render()");assert.match(t.els.app.innerHTML,/Soon · 5 days/);
 assert.match(t.els.app.innerHTML,/Past recorded date · verify/);
 assert.match(t.els.app.innerHTML,/Dates are recorded expectations, not confirmation of payment/);
 assert.match(t.els.app.innerHTML,/data-act="editSubscription" data-id="due"/);
});

test('career Cost comparison is read-only, account-scoped, exact, and not persisted',async()=>{
 const entries=[
  {id:10,user_id:'test-user',date:'2026-11-12',amount:18000,region:'JPY',category:'Education',shop:'Exam board',expense_type:'normal'},
  {id:11,user_id:'test-user',date:'2026-11-12',amount:18000,region:'USD',category:'Other',shop:'Other',expense_type:'normal'},
  {id:12,user_id:'another-user',date:'2026-11-12',amount:18000,region:'JPY',category:'Private',shop:'Another user',expense_type:'normal'},
  {id:13,user_id:'test-user',date:'2026-11-13',amount:18000,region:'JPY',category:'Other',shop:'Wrong date',expense_type:'normal'}
 ];
 const t=setup(new Map(),entries);await t.ready;await t.run("sessionChanged({user:{id:'test-user'}})");
 t.run("S.careerExpenses=[{id:'career1',title:'Certification',provider:'Exam board',category:'Certification / exam',date:'2026-11-12',status:'Paid',currency:'JPY',amount:18000,milestoneId:'',notes:'',updated:today()},{id:'career2',title:'Future course',provider:'Provider',category:'Course / training',date:'2026-11-12',status:'Planned',currency:'JPY',amount:18000,milestoneId:'',notes:'',updated:today()}];save();tab='careerExpenses';render()");
 await t.run('flushSave()');
 await t.run('checkCareerCostMatches()');
 assert.equal(t.run('costCandidates(S.careerExpenses[0]).length'),1);
 assert.equal(t.run('costCandidates(S.careerExpenses[1]).length'),0);
 assert.match(t.els.app.innerHTML,/Possible Cost match/);
 assert.match(t.els.app.innerHTML,/Cost #10 · Exam board/);
 assert.doesNotMatch(t.els.app.innerHTML,/Another user|Wrong date/);
 assert.equal(t.record().data.careerExpenses[0].costExpenseId,undefined);
 assert.equal(t.record().data.costMatchRows,undefined);
 assert.equal(t.run('S.costMatchRows'),undefined);
 t.fail(true);await t.run('checkCareerCostMatches()');assert.match(t.els.app.innerHTML,/Cost lookup unavailable/);
 assert.doesNotMatch(t.els.app.innerHTML,/Possible Cost match/);
 t.fail(false);await t.run('checkCareerCostMatches()');
 await t.run("sessionChanged({user:{id:'other-user'}})");
 assert.equal(t.run('costCandidates({date:"2026-11-12",amount:18000,currency:"JPY",status:"Paid"}).length'),0);
});
