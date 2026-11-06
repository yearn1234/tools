/* coord logger service worker — 快取外殼，離線可用 */
const CACHE="coordlog-v16";
const ASSETS=["./","./index.html"];

self.addEventListener("install",function(e){
  e.waitUntil(
    caches.open(CACHE).then(function(c){return c.addAll(ASSETS);}).catch(function(){})
      .then(function(){return self.skipWaiting();})
  );
});
self.addEventListener("activate",function(e){
  e.waitUntil(
    caches.keys().then(function(ks){
      return Promise.all(ks.filter(function(k){return k!==CACHE;})
                           .map(function(k){return caches.delete(k);}));
    }).then(function(){return self.clients.claim();})
  );
});
self.addEventListener("fetch",function(e){
  if(e.request.method!=="GET")return;
  var url;
  try{url=new URL(e.request.url);}catch(err){return;}
  if(url.origin!==location.origin)return;        // 不碰跨來源（如查地址的 API）

  e.respondWith(
    caches.match(e.request).then(function(hit){
      if(hit)return hit;
      return fetch(e.request).then(function(res){
        if(res&&res.ok){
          var copy=res.clone();
          caches.open(CACHE).then(function(c){return c.put(e.request,copy);}).catch(function(){});
        }
        return res;
      }).catch(function(){
        return caches.match("./index.html");      // 離線時回退到頁面外殼
      });
    })
  );
});