const CACHE_NAME = 'pomodoro-v2';
const PRECACHE = [
  './index.html',
  './style.css',
  './js/storage.js',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const keys = await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',e=>{
  e.respondWith((async()=>{
    const cached = await caches.match(e.request);
    if(cached) return cached;
    try{
      const resp = await fetch(e.request);
      if(!resp||resp.status!==200||resp.type!=='basic') return resp;
      const cache = await caches.open(CACHE_NAME);
      cache.put(e.request,resp.clone());
      return resp;
    }catch{
      return caches.match('./index.html');
    }
  })());
});
