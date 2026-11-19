// Static app shell only: never cache Supabase auth, API responses or user records.
const SHELL='belay-shell-v5';
const FILES=['./','./index.html','./cloud.js?v=7','./ui.css?v=3','./manifest.webmanifest','./icons/belay-192.png','./icons/belay-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('belay-shell-')&&k!==SHELL).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(req.method!=='GET'||url.origin!==self.location.origin)return;
  const staticPath=/\/(?:index\.html|cloud\.js|ui\.css|manifest\.webmanifest|icons\/belay-(?:192|512)\.png)$/;
  if(req.mode!=='navigate'&&!staticPath.test(url.pathname))return;
  event.respondWith(fetch(req).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(SHELL).then(cache=>cache.put(req,copy)));}
    return response;
  }).catch(async()=>{
    const cached=await caches.match(req);
    return cached||(req.mode==='navigate'?await caches.match('./index.html'):Response.error());
  }));
});
