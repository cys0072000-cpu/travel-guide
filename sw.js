/* 여행 가이드북 서비스 워커 — 오프라인에서도 앱이 열리게 한다.
   네트워크 우선, 실패하면 캐시. snackpt/sw.js와 동일한 전략. */
const CACHE = "travelguide-v1.7";

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-32.png",
  "./icons/icon-16.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function cacheKeyFor(request, url) {
  const isDoc = request.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/travel-guide/");
  return isDoc ? new Request(new URL("./", self.registration.scope).toString()) : request;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  const key = cacheKeyFor(req, url);

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(key, copy));
        return res;
      })
      .catch(() =>
        caches.match(key).then((hit) => hit || caches.match("./index.html"))
      )
  );
});
