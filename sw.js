const CACHE='retailinsight-field-r05-s05-v2';
const ASSETS=['./','login.html','field.html','assets/css/field-workspace.css','assets/js/config.js','assets/js/api.js','assets/js/ui-alerts.js','assets/js/date-th.js','assets/js/local-draft-db.js','assets/js/field-workspace.js'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)))});
self.addEventListener('activate',e=>{e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))]))});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r}).catch(()=>caches.match(e.request)))});
