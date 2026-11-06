/* coord logger · sw.js — 標籤版 v17.0 */
/* 改版時請同步修改 VERSION，否則舊快取不會被清掉 */
const VERSION = "coordlog-v17.0-tag";
const STATIC_CACHE = VERSION + "-static";
const FONT_CACHE = VERSION + "-fonts";
const PAGE_CACHE = VERSION + "-pages";

const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

/* ---------- 安裝：清掉舊版本快取，再跳過等待 ---------- */
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.indexOf("coordlog-") === 0 && k.indexOf(VERSION) !== 0)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.skipWaiting())
  );
});

/* ---------- 啟用：清殘留 + 接管所有分頁 ---------- */
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.indexOf("coordlog-") === 0 && k.indexOf(VERSION) !== 0)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ---------- fetch 攔截 ---------- */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }

  /* 1. 導覽（HTML）：network-first — 線上永遠拿到最新版 */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(PAGE_CACHE)
              .then((c) => c.put(req, copy))
              .catch(() => {});
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((hit) =>
            hit ||
            caches.match("/index.html").then((h) => h) ||
            Response.error()
          )
        )
    );
    return;
  }

  /* 2. Google Fonts：cache-first（字體幾乎不變，離線也要有） */
  if (FONT_HOSTS.indexOf(url.hostname) >= 0) {
    e.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(FONT_CACHE)
              .then((c) => c.put(req, copy))
              .catch(() => {});
          }
          return res;
        }).catch(() => Response.error());
      })
    );
    return;
  }

  /* 3. 同源靜態（sw.js、圖示等）：stale-while-revalidate */
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const refresh = fetch(req)
          .then((res) => {
            if (res && res.status === 200) {
              const copy = res.clone();
              caches.open(STATIC_CACHE)
                .then((c) => c.put(req, copy))
                .catch(() => {});
            }
            return res;
          })
          .catch(() => hit);
        return hit || refresh;
      })
    );
    return;
  }

  /* 4. 其他跨域（Nominatim 反查地址等）：不快取，直接放行 */
  /* 不呼叫 respondWith = 瀏覽器原始行為 */
});