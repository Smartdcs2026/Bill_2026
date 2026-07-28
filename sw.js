const CACHE='retailinsight-field-v10a';
const ASSETS=['./','login.html','field.html','manifest.json','assets/css/field-workspace.css','assets/css/login-retailinsight.css','assets/js/config.js','assets/js/api.js','assets/js/ui-alerts.js','assets/js/date-th.js','assets/js/local-draft-db.js','assets/js/field-workspace.js','assets/js/login.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.pathname.includes('/api/'))return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match('field.html'))))});
