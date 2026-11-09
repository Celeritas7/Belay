const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const http=require('http');
const {chromium}=require(require.resolve('playwright',{paths:[process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES||process.cwd()]}));
const root=path.resolve(__dirname,'..');
const ref={LV:['None','Aware','Basic','Working','Strong','Expert'],TIER:['','Entry','Mid','Senior','Lead','Manager'],COUNTRIES:[['JP','Japan',36000,24,14600,2.1]],STARTER_SKILLS:[['Test skill','Design',2]],STARTER_WANT:['Test skill'],STARTER_JOBS:[['Test job',2,100,{"Test skill":2}]],RANKS:[[0,'Apprentice'],[1000,'Engineer']],PERSONA:'Test coach',PROMPTS:{daily:'Test prompt'},BUCKETS:{},settings:{gross:5500000,fx:157,weeklyGoal:300}};
const blank=()=>({skills:[],jobs:[],work:[],log:[],settings:{},cOver:{},cAI:{},coach:{}});
test('cloud persistence, migration, conflicts, recovery, views and logout',async()=>{
 const server=http.createServer((req,res)=>{const file=path.join(root,req.url==='/'?'index.html':req.url.split('?')[0]);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(file));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;try{browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});}catch(e){server.close();throw e;}
 let record=null, fail=false;const errors=[];
 const context=await browser.newContext({viewport:{width:390,height:844}});
 await context.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:fs.readFileSync(process.env.BELAY_SDK||'/tmp/belay-sdk.js','utf8')}));
 await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:''}));
 await context.route('https://wylxvmkcrexwfpjpbhyy.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url());let data={};let status=200;
  if(url.pathname.endsWith('/belay_reference'))data={data:ref};
  else if(url.pathname.endsWith('/belay_state'))data=record?[record]:[];
  else if(url.pathname.endsWith('/belay_save_state')){
    const body=req.postDataJSON();
    if(fail){status=503;data={message:'Simulated connection failure'};}
    else if(body.p_version!==(record?.version||0)){status=400;data={message:'BELAY_CONFLICT: Newer data exists',code:'P0001'};}
    else {record={data:body.p_data,version:(record?.version||0)+1};data={version:record.version};}
  }else if(url.pathname.endsWith('/belay_cost_summary'))data=[{m:'2026-10',c:'Restaurant',s:10000,n:5}];
  else if(url.pathname.endsWith('/logout'))data={};
  else if(url.pathname.endsWith('/user'))data={id:'test-user',email:'test@example.invalid'};
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const base=`http://127.0.0.1:${server.address().port}/`;
 try{
  await page.goto(base);await page.getByRole('heading',{name:'Sign in to Belay'}).waitFor();
  await page.evaluate(()=>localStorage.setItem('belay-auth',JSON.stringify({access_token:'fake-test-token',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user:{id:'test-user',email:'test@example.invalid'}})));
  await page.reload();await page.getByRole('button',{name:'Load example starter set'}).waitFor();
  await page.getByRole('button',{name:'Load example starter set'}).click();
  await page.waitForFunction(()=>document.getElementById('saveState').textContent==='Saved to cloud ✓');
  assert.equal(record.data.skills[0].name,'Test skill');
  await page.reload();await page.getByRole('button',{name:'◆ Skills'}).click();
  await page.getByRole('button',{name:'+30m'}).click();await page.waitForFunction(()=>document.getElementById('saveState').textContent==='Saved to cloud ✓');assert.equal(record.data.log[0].m,30);
  for(const name of ['✦ Coach','▲ Jobs','☰ Work','◎ Countries','⌂ Climb'])await page.getByRole('button',{name,exact:true}).click();
  // A database edit must not be overwritten by this stale browser.
  record.version++;record.data.external='from database';
  await page.getByRole('button',{name:'◆ Skills'}).click();await page.getByRole('button',{name:'+30m'}).click();await page.getByText('Changes are not saved',{exact:true}).waitFor();assert.equal(record.data.log.length,1);assert.equal(record.data.external,'from database');
  page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Load cloud version'}).click();await page.getByRole('button',{name:'+30m'}).waitFor();
  fail=true;await page.getByRole('button',{name:'+30m'}).click();await page.getByText('Changes are not saved',{exact:true}).waitFor();fail=false;await page.getByRole('button',{name:'Retry save'}).click();await page.waitForFunction(()=>document.getElementById('saveState').textContent==='Saved to cloud ✓');assert.equal(record.data.log.length,2);
  // Migration is opt-in and removes the device copy only after server acknowledgement.
  const legacy={...blank(),skills:[{id:'legacy',name:'Migrated skill',cat:'CAD',level:3}]};
  await page.evaluate(data=>localStorage.setItem('careerClimb',JSON.stringify(data)),legacy);await page.reload();await page.getByRole('button',{name:'Move device data to cloud'}).click();await page.waitForFunction(()=>localStorage.getItem('careerClimb')===null);assert.equal(record.data.skills[0].name,'Migrated skill');
  await page.getByRole('button',{name:'◎ Countries'}).click();await page.getByRole('button',{name:'Connect Cost'}).click();await page.waitForFunction(()=>document.getElementById('saveState').textContent==='Saved to cloud ✓');assert.equal(record.data.cost.rows[0].s,10000);
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('heading',{name:'Sign in to Belay'}).waitFor();assert.equal(await page.locator('#rank').innerText(),'');assert.deepEqual(errors,[]);
  assert.equal(await page.evaluate(()=>localStorage.getItem('careerClimb')),null);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
