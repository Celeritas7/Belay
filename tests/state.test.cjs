const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const ref={LV:['None','Aware','Basic','Working','Strong','Expert'],TIER:['','Entry','Mid','Senior','Lead','Manager'],COUNTRIES:[['JP','Japan',36000,24,14600,2.1]],STARTER_SKILLS:[['Test skill','Design',2]],STARTER_WANT:['Test skill'],STARTER_JOBS:[['Test job',2,100,{'Test skill':2}]],RANKS:[[0,'Apprentice'],[1000,'Engineer']],PERSONA:'Test coach',PROMPTS:{daily:'Test prompt'},BUCKETS:{},settings:{gross:5500000,fx:157,weeklyGoal:300}};
function setup(){
 const els={},store=new Map(),listeners={};let record=null,fail=false,authCallback;
 const element=id=>els[id]??=( {innerHTML:'',textContent:'',value:'',style:{},dataset:{},classList:{add(){},remove(){},contains(){return false}},addEventListener(){},insertAdjacentHTML(){},click(){},querySelector(){return element('button')}});
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
 return {run,ready:run('boot()'),els,store,record:()=>record,setRecord(r){record=r},fail(v){fail=v}};
}
test('database persistence, all views, cost, revision conflicts and recovery',async()=>{
 const t=setup();await t.ready;await t.run("sessionChanged({user:{id:'test-user',email:'test@example.invalid'}})");
 assert.match(t.els.app.innerHTML,/Start your career map/);
 t.run("S.skills=[{id:'s',name:'Test skill',level:2,cat:'Design'}];save()");await t.run('flushSave()');assert.equal(t.record().data.skills.length,1);
 t.run('S=blank()');await t.run('loadCloud()');assert.equal(t.run('S.skills[0].name'),'Test skill');
 for(const tab of ['home','coach','skills','jobs','work','world']){t.run(`tab='${tab}';render()`);assert.ok(t.els.app.innerHTML.length>0);}
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
