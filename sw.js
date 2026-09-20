/* Static assets only; user progress is never cached or uploaded. */
const CACHE='bank-quiz-ef2ee0d7f41d';
const FILES=["./","./index.html","./styles.css","./core.js","./app.js","./data.js","./icon.svg","./manifest.webmanifest","./ATTRIBUTION.html"];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('bank-quiz-')&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;const url=new URL(e.request.url);if(!url.pathname.startsWith(new URL('./',self.location.href).pathname))return;e.respondWith(caches.open(CACHE).then(async c=>{const cached=await c.match(e.request,{ignoreSearch:true});return cached||fetch(e.request);}));});
