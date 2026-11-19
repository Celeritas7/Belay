const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ref={LV:['None','Aware','Basic','Working','Strong','Expert'],TIER:['','Entry','Mid','Senior','Lead','Manager'],COUNTRIES:[['JP','Japan',36000,24,14600,2.1]],STARTER_SKILLS:[['Test skill','Design',2]],STARTER_WANT:['Test skill'],STARTER_JOBS:[['Test job',2,100,{'Test skill':2}]],RANKS:[[0,'Apprentice'],[1000,'Engineer']],PERSONA:'Test coach',PROMPTS:{daily:'Test prompt'},BUCKETS:{},settings:{gross:5500000,fx:157,weeklyGoal:300}};
function setup(){
 const els={},store=new Map(),listeners={};let record=null,fail=false,authCallback;
 const element=id=>els[id]??=( {innerHTML:'',textContent:'',value:'',style:{},dataset:{},setAttribute(){},removeAttribute(){},classList:{add(){},remove(){},contains(){return false}},addEventListener(){},insertAdjacentHTML(){},click(){},querySelector(){return element('button')}});
 const doc={getElementById:element,addEventListener(n,f){listeners[n]=f},querySelector:element,activeElement:{tagName:'BODY'},createElement:element};
 const client={auth:{onAuthStateChange(f){authCallback=f},async getSession(){return {data:{session:null}}},async signOut(){authCallback('SIGNED_OUT',null);return {}}},from(table){return {select(){return this},eq(){return this},async single(){return {data:{data:ref}}},async maybeSingle(){return {data:record?structuredClone(record):null}}}},async rpc(name,args){
  if(name==='belay_cost_summary')return {data:[{m:'2026-10',c:'Restaurant',s:10000,n:5}]};
  await new Promise(r=>setTimeout(r,5));if(fail)return {error:{message:'Simulated offline'}};
  if(args.p_version!==(record?.version||0))return {error:{message:'BELAY_CONFLICT: newer data'}};
  record={data:structuredClone(args.p_data),version:(record?.version||0)+1};return {data:{version:record.version}};
 }};
 const context=vm.createContext({document:doc,window:{supabase:{createClient(){return client}},addEventListener(){}},localStorage:{getItem(k){return store.get(k)||null},setItem(k,v){store.set(k,v)},removeItem(k){store.delete(k)}},console,Intl,URL,Blob,crypto:require('node:crypto').webcrypto,structuredClone,setTimeout,clearTimeout,confirm:()=>true,navigator:{clipboard:{writeText:async()=>{}}},scrollTo(){},location:{origin:'https://example.invalid',pathname:'/'}});
 vm.runInContext(fs.readFileSync(path.join(root,'cloud.js'),'utf8'),context);
 vm.runInContext(fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1].replace('boot();',''),context);
 const run=s=>vm.runInContext(s,context);
 return {click(dataset){listeners.click({target:{closest:()=>({dataset})},stopPropagation(){}})},run,ready:run('boot()'),els,store,record:()=>record,setRecord(r){record=r},fail(v){fail=v}};
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
