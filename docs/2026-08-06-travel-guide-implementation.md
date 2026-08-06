# 여행 가이드북 (travel-guide) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-file mobile PWA travel guidebook (`index.html`) for the 2026-08-17~08-27 골드코스트·브리즈번 trip, with 일정(itinerary)/장소(places)/체크리스트(checklist) tabs, localStorage persistence, Google Maps deep links, and JSON backup — modeled directly on `projects/snackpt/`.

**Architecture:** One `index.html` (HTML+CSS+JS inline, no build step, no external libraries), `manifest.json` + `sw.js` for PWA install/offline caching, `localStorage` for all data. State lives in a single in-memory `DB` object that's re-saved on every mutation and fully re-rendered per view on every state change (no partial DOM patching — same pattern as snackpt).

**Tech Stack:** Vanilla HTML/CSS/JS, localStorage, Service Worker (Cache API), Web App Manifest. No npm, no bundler, no framework.

**Testing strategy:** `projects/snackpt/` (the reference project) has zero automated tests — verification there is manual, in-browser. This plan follows that established convention, but makes it *rigorous and repeatable* by using the Playwright MCP tools (available in this environment) to drive a real browser against a local static server and assert exact DOM/localStorage state after every change, instead of asking a human to eyeball it. Every task's verification step gives the exact tool calls and exact expected values — nothing is "check that it looks right."

Before any task's verification steps, load the Playwright tools once per session:
```
ToolSearch: query="select:mcp__playwright__browser_navigate,mcp__playwright__browser_evaluate,mcp__playwright__browser_click,mcp__playwright__browser_type,mcp__playwright__browser_select_option,mcp__playwright__browser_file_upload,mcp__playwright__browser_handle_dialog,mcp__playwright__browser_snapshot,mcp__playwright__browser_console_messages,mcp__playwright__browser_press_key"
```

Every task's verification also needs a static server running (file:// breaks `fetch`, `localStorage` origin, and service worker registration). Start it idempotently at the top of each task's verify step:
```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8791/ || true
# if the above is not 200, start the server:
cd /Users/joyunsung/Desktop/AI/projects/travel-guide && python3 -m http.server 8791 > /tmp/travelguide-server.log 2>&1 &
sleep 1
```
Then `browser_navigate` to `http://127.0.0.1:8791/`.

**Repo state:** `/Users/joyunsung/Desktop/AI/projects/travel-guide/` is already a git repo (created during brainstorming) with one commit containing `docs/2026-08-06-travel-guide-design.md`. Every task below ends with a commit into this same repo.

**Not in this plan (do not do autonomously):** creating the GitHub remote repo and pushing / enabling GitHub Pages. That's a "visible to others" action — do it together with the user interactively after all tasks below are done and verified locally. Task 9 prepares the README with the deploy steps but does not run `git push` or `gh repo create`.

---

### Task 1: Project skeleton — HTML shell, full CSS, PWA files

**Files:**
- Create: `/Users/joyunsung/Desktop/AI/projects/travel-guide/index.html`
- Create: `/Users/joyunsung/Desktop/AI/projects/travel-guide/manifest.json`
- Create: `/Users/joyunsung/Desktop/AI/projects/travel-guide/sw.js`
- Create: `/Users/joyunsung/Desktop/AI/projects/travel-guide/.gitignore`

- [ ] **Step 1: Create `.gitignore`**

```
.DS_Store
```

- [ ] **Step 2: Create `manifest.json`**

```json
{
  "name": "여행 가이드북",
  "short_name": "여행가이드",
  "description": "골드코스트·브리즈번 여행 가이드북 — 일정·장소·체크리스트",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "background_color": "#0c1220",
  "theme_color": "#0c1220",
  "icons": [
    { "src": "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%230c1220'/%3E%3Ctext x='50' y='68' font-size='58' text-anchor='middle'%3E%F0%9F%A7%B3%3C/text%3E%3C/svg%3E", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }
  ]
}
```

- [ ] **Step 3: Create `sw.js`**

```js
/* 여행 가이드북 서비스 워커 — 오프라인에서도 앱이 열리게 한다.
   네트워크 우선, 실패하면 캐시. snackpt/sw.js와 동일한 전략. */
const CACHE = "travelguide-v1.0";

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
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
```

- [ ] **Step 4: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0c1220">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="여행가이드">
<title>여행 가이드북 — 골드코스트·브리즈번</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E%F0%9F%A7%B3%3C/text%3E%3C/svg%3E">
<link rel="manifest" href="manifest.json">
<style>
:root{
  --bg:#0c1220; --bg2:#111a2e; --card:#141d33; --card2:#1a2540;
  --line:#22304f; --line2:#2c3c60;
  --tx:#eaf0fb; --tx2:#9aabc9; --tx3:#67789e;
  --acc:#14b8a6; --acc2:#38bdf8; --acc-soft:rgba(20,184,166,.16);
  --ok:#3ecf8e; --warn:#ffc043; --danger:#ff6b6b;
  --r:16px; --r2:12px;
  --safe-b:env(safe-area-inset-bottom,0px);
  --safe-t:env(safe-area-inset-top,0px);
}
html[data-theme="light"]{
  --bg:#f5f7fb; --bg2:#eceff6; --card:#ffffff; --card2:#f3f5fa;
  --line:#e1e5ef; --line2:#d0d6e4;
  --tx:#161c2c; --tx2:#5b6784; --tx3:#8993ac;
  --acc:#0d9488; --acc2:#0284c7; --acc-soft:rgba(13,148,136,.10);
  --ok:#12a06a; --warn:#b57900; --danger:#d9483f;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;padding:0}
body{
  background:var(--bg); color:var(--tx);
  font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Noto Sans KR",system-ui,"Malgun Gothic",sans-serif;
  font-size:15px; line-height:1.55; -webkit-font-smoothing:antialiased;
  overscroll-behavior-y:none;
}
button,input,textarea,select{font:inherit;color:inherit}
button{cursor:pointer;border:0;background:none}
a{color:var(--acc);text-decoration:none}

#app{max-width:560px;margin:0 auto;min-height:100vh;padding-bottom:calc(78px + var(--safe-b))}
.topbar{position:sticky;top:0;z-index:40;padding:calc(12px + var(--safe-t)) 16px 8px;
  background:linear-gradient(180deg,var(--bg) 74%,transparent);
  backdrop-filter:saturate(180%) blur(12px);-webkit-backdrop-filter:saturate(180%) blur(12px);}
.brand{display:flex;align-items:center;gap:9px}
.brand h1{margin:0;font-size:19px;font-weight:800;letter-spacing:-.4px}
.brand .em{font-size:20px}
.brand .tagline{font-size:11px;color:var(--tx3);font-weight:600;margin-left:1px}

.view{padding:4px 16px 24px;animation:fade .2s ease}
@keyframes fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.hidden{display:none !important}

.iconbtn{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;
  background:var(--card);border:1px solid var(--line);color:var(--tx2);font-size:16px}
.iconbtn:active{transform:scale(.94)}
.iconbtn:disabled{opacity:.35}

.chiprow{display:flex;gap:7px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:none}
.chiprow::-webkit-scrollbar{display:none}
.chip{flex:none;padding:7px 12px;border-radius:999px;background:var(--card);
  border:1px solid var(--line);font-size:13px;font-weight:700;color:var(--tx2)}
.chip.on{background:var(--acc);border-color:transparent;color:#fff}
.chip:active{transform:scale(.95)}

.dayNav{display:flex;align-items:center;justify-content:center;gap:14px;margin:2px 0 14px}
.dayNav .dayTtl{font-size:16.5px;font-weight:800;letter-spacing:-.3px;min-width:110px;text-align:center}

.infocard{display:flex;gap:10px;align-items:flex-start;background:var(--card);
  border:1px solid var(--line);border-radius:var(--r);padding:13px;margin-bottom:9px}
.infocard .ic{font-size:19px;flex:none}
.infocard .body b{font-size:14.5px;font-weight:700;display:block}
.infocard .detail{font-size:12.5px;color:var(--tx2);margin-top:2px}

.warnbox{background:rgba(255,192,67,.14);border:1px solid rgba(255,192,67,.35);color:var(--warn);
  border-radius:var(--r2);padding:11px 13px;font-size:13px;line-height:1.6;margin-bottom:12px}

.card{background:var(--card);border:1px solid var(--line);border-radius:var(--r);
  padding:13px;margin-bottom:10px}
.chead{display:flex;align-items:center;gap:8px;margin-bottom:6px}
.chead .ic{font-size:16px;flex:none}
.chead b{font-size:14.5px;font-weight:700;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chead .cnum{font-size:11px;color:var(--tx3);flex:none}
.memoline{font-size:13px;color:var(--tx2);line-height:1.6}

.addhead{display:flex;align-items:center;gap:10px;margin:2px 0 12px}
.addhead .ttl{font-size:16px;font-weight:800;letter-spacing:-.3px}

.empty{text-align:center;padding:48px 20px;color:var(--tx3)}
.empty .bigem{font-size:40px;display:block;margin-bottom:10px;opacity:.85}
.empty p{margin:5px 0;font-size:13px;line-height:1.7}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;
  padding:11px 16px;border-radius:12px;font-size:14px;font-weight:700;
  background:var(--card2);border:1px solid var(--line);color:var(--tx)}
.btn:active{transform:scale(.97)}
.btn.primary{background:linear-gradient(96deg,var(--acc),var(--acc2));color:#fff;border-color:transparent}
.btn.ghost{background:transparent}
.btn.danger{color:var(--danger)}
.btn.full{display:flex;width:100%}
.btn.sm{padding:8px 12px;font-size:12.5px;border-radius:10px}
.btnrow{display:flex;gap:8px}
.btnrow>*{flex:1}

label.fl{display:block;font-size:12px;font-weight:700;color:var(--tx3);margin:14px 0 6px;letter-spacing:.2px}
.inp,textarea.inp{width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;
  padding:11px 12px;font-size:15px;outline:none;transition:border-color .15s}
.inp:focus,textarea.inp:focus{border-color:var(--acc)}
textarea.inp{resize:vertical;line-height:1.6;font-size:14px}

.checkrow{display:flex;align-items:center;gap:10px;background:var(--card);border:1px solid var(--line);
  border-radius:var(--r2);padding:10px 12px;margin-bottom:7px}
.checkrow .checkbox{width:22px;height:22px;border-radius:7px;border:1.5px solid var(--line2);
  flex:none;display:grid;place-items:center;color:#fff;font-size:13px;font-weight:800}
.checkrow .checkbox.on{background:var(--acc);border-color:var(--acc)}
.checkrow .label{flex:1;font-size:14px;min-width:0}
.checkrow .label.done{color:var(--tx3);text-decoration:line-through}
.checkrow .delx{flex:none;color:var(--tx3);font-size:17px;padding:2px 4px}

.addtip{display:flex;gap:7px;margin-bottom:14px}
.addtip input{flex:1;background:var(--card2);border:1px solid var(--line);border-radius:10px;
  padding:10px 12px;font-size:13.5px;outline:none;min-width:0}
.addtip input:focus{border-color:var(--acc)}
.addtip button{flex:none;padding:0 14px;border-radius:10px;background:var(--acc-soft);color:var(--acc);font-weight:800;font-size:13px}

.setblk{background:var(--card);border:1px solid var(--line);border-radius:var(--r);padding:15px;margin:14px 0}
.setblk h4{margin:0 0 4px;font-size:14px;font-weight:800}
.setblk p{margin:0 0 10px;font-size:12.5px;color:var(--tx2);line-height:1.6}

.sheet{position:fixed;inset:0;z-index:80;background:var(--bg);overflow-y:auto;
  -webkit-overflow-scrolling:touch;animation:slideup .24s cubic-bezier(.2,.8,.2,1)}
@keyframes slideup{from{transform:translateY(100%)}to{transform:none}}
.sheetbar{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:10px;
  padding:calc(10px + var(--safe-t)) 16px 10px;background:var(--bg);border-bottom:1px solid var(--line)}
.sheetbar .ttl{font-size:16px;font-weight:800}
.sheetbody{max-width:560px;margin:0 auto;padding:16px 16px calc(40px + var(--safe-b))}

.tabbar{position:fixed;left:0;right:0;bottom:0;z-index:60;display:flex;max-width:560px;margin:0 auto;
  padding:7px 8px calc(7px + var(--safe-b));
  background:color-mix(in srgb,var(--bg) 88%,transparent);
  backdrop-filter:saturate(180%) blur(16px);-webkit-backdrop-filter:saturate(180%) blur(16px);
  border-top:1px solid var(--line)}
.tab{flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 0;
  border-radius:11px;color:var(--tx3);font-size:10.5px;font-weight:700}
.tab .ic{font-size:19px;line-height:1.15;filter:grayscale(1);opacity:.62}
.tab.on{color:var(--acc)}
.tab.on .ic{filter:none;opacity:1}

#toast{position:fixed;left:50%;bottom:calc(92px + var(--safe-b));transform:translateX(-50%) translateY(10px);
  background:var(--tx);color:var(--bg);padding:10px 16px;border-radius:999px;font-size:13px;font-weight:700;
  z-index:200;opacity:0;pointer-events:none;transition:.24s;white-space:nowrap;max-width:90vw;
  overflow:hidden;text-overflow:ellipsis}
#toast.on{opacity:1;transform:translateX(-50%)}
</style>
</head>
<body>

<div id="app">
  <div class="topbar">
    <div class="brand">
      <span class="em">🧳</span>
      <h1>여행 가이드북</h1>
      <span class="tagline">골드코스트·브리즈번 2026</span>
    </div>
  </div>

  <div class="view" id="v-itin"><div id="itinBody"></div></div>
  <div class="view hidden" id="v-places"><div id="placesBody"></div></div>
  <div class="view hidden" id="v-check"><div id="checkBody"></div></div>
</div>

<div class="tabbar">
  <button class="tab on" data-v="itin"><span class="ic">📅</span>일정</button>
  <button class="tab" data-v="places"><span class="ic">📍</span>장소</button>
  <button class="tab" data-v="check"><span class="ic">🎒</span>체크리스트</button>
</div>

<div id="sheetHost"></div>
<div id="toast"></div>

<script>
"use strict";
/* SCRIPT:STORAGE */

/* SCRIPT:INIT */
</script>
</body>
</html>
```

- [ ] **Step 5: Verify the skeleton loads with no JS errors**

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8791/ || true
cd /Users/joyunsung/Desktop/AI/projects/travel-guide && python3 -m http.server 8791 > /tmp/travelguide-server.log 2>&1 &
sleep 1
```

Then use Playwright MCP:
- `browser_navigate` to `http://127.0.0.1:8791/`
- `browser_console_messages` — expected: no `error` type entries
- `browser_evaluate`: `() => document.title` — expected: `"여행 가이드북 — 골드코스트·브리즈번"`
- `browser_evaluate`: `() => [...document.querySelectorAll('.tab')].map(t=>t.textContent.trim())` — expected: `["📅일정","📍장소","🎒체크리스트"]`
- `browser_evaluate`: `() => getComputedStyle(document.body).backgroundColor` — expected: `"rgb(12, 18, 32)"` (confirms `#0c1220` dark theme applied via CSS, even before JS sets `data-theme`)

- [ ] **Step 6: Commit**

```bash
cd /Users/joyunsung/Desktop/AI/projects/travel-guide
git add index.html manifest.json sw.js .gitignore
git commit -m "Add app skeleton: HTML shell, full CSS, PWA manifest/service worker"
```

---

### Task 2: Storage layer, tab navigation, theme, service worker registration

**Files:**
- Modify: `index.html` (replace the two `/* SCRIPT:... */` comment anchors from Task 1)

- [ ] **Step 1: Replace `/* SCRIPT:STORAGE */`**

Find this exact line in `index.html`:
```
/* SCRIPT:STORAGE */
```
Replace it with:
```js
const KEY = "travelguide.v1", THEME_KEY = "travelguide.theme";
const APP_VERSION = "1.0";
const APP_BUILT = "2026-08-06";
const DEFAULT_CHECKLIST = ["여권","항공권/전자티켓 캡처","호주 유심/이심","해외결제 카드","돼지코 어댑터(호주 표준)","보조배터리","상비약","선크림","우산/우비","수영복"];
const DOW = ["일","월","화","수","목","금","토"];

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function uid(p){ return (p||"x")+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function toast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=> t.classList.remove("on"), 2200);
}

function load(){
  try{
    const r = JSON.parse(localStorage.getItem(KEY) || "null");
    if(r && typeof r === "object") return r;
  }catch(e){}
  return {};
}
function migrate(db){
  db.version = 1;
  db.dayMemos = db.dayMemos || {};
  db.places = Array.isArray(db.places) ? db.places : [];
  db.checklist = Array.isArray(db.checklist) ? db.checklist
    : DEFAULT_CHECKLIST.map(label=>({id:uid("ck"), label, checked:false}));
  return db;
}
function save(){
  try{ localStorage.setItem(KEY, JSON.stringify(DB)); }
  catch(e){ toast("저장 실패 — 저장 공간이 부족할 수 있어요"); }
}
let DB = migrate(load());
save();

function renderItin(){
  $("#itinBody").innerHTML = '<div class="empty"><span class="bigem">📅</span><p>일정 준비 중</p></div>';
}
function renderPlaces(){
  $("#placesBody").innerHTML = '<div class="empty"><span class="bigem">📍</span><p>장소 목록 준비 중</p></div>';
}
function renderCheck(){
  $("#checkBody").innerHTML = '<div class="empty"><span class="bigem">🎒</span><p>체크리스트 준비 중</p></div>';
}
```

- [ ] **Step 2: Replace `/* SCRIPT:INIT */`**

Find this exact line in `index.html`:
```
/* SCRIPT:INIT */
```
Replace it with:
```js
function go(v){
  $$(".view").forEach(el=> el.classList.add("hidden"));
  $("#v-"+v).classList.remove("hidden");
  $$(".tab").forEach(t=> t.classList.toggle("on", t.dataset.v===v));
  if(v==="itin") renderItin();
  if(v==="places") renderPlaces();
  if(v==="check") renderCheck();
}
$$(".tab").forEach(t=> t.onclick = ()=>{ go(t.dataset.v); window.scrollTo({top:0,behavior:"smooth"}); });

function applyTheme(t){
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name=theme-color]').content = t==="light" ? "#f7f8fb" : "#0c1220";
  localStorage.setItem(THEME_KEY, t);
}
applyTheme(localStorage.getItem(THEME_KEY) || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));

if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  });
}

renderItin();
```

- [ ] **Step 3: Verify tab switching and storage seeding**

Restart the static server (kill any process on 8791 first, then start fresh so it picks up the new file):
```bash
lsof -ti:8791 | xargs -r kill
cd /Users/joyunsung/Desktop/AI/projects/travel-guide && python3 -m http.server 8791 > /tmp/travelguide-server.log 2>&1 &
sleep 1
```
Playwright:
- `browser_navigate` to `http://127.0.0.1:8791/`
- `browser_console_messages` — expected: no `error` entries
- `browser_evaluate`: `() => document.querySelector('#itinBody').textContent` — expected: `"일정 준비 중"`
- `browser_click` on the "📍장소" tab button
- `browser_evaluate`: `() => ({ itinHidden: document.querySelector('#v-itin').classList.contains('hidden'), placesHidden: document.querySelector('#v-places').classList.contains('hidden'), placesText: document.querySelector('#placesBody').textContent })` — expected: `{ itinHidden: true, placesHidden: false, placesText: "장소 목록 준비 중" }`
- `browser_evaluate`: `() => { const db = JSON.parse(localStorage.getItem('travelguide.v1')); return { checklistLen: db.checklist.length, firstLabel: db.checklist[0].label, places: db.places.length, theme: document.documentElement.dataset.theme }; }` — expected: `{ checklistLen: 10, firstLabel: "여권", places: 0, theme: "dark" }` (or `"light"` if the test machine's OS is set to light mode — either is correct, just confirm it's not `undefined`)

- [ ] **Step 4: Commit**

```bash
cd /Users/joyunsung/Desktop/AI/projects/travel-guide
git add index.html
git commit -m "Add storage layer, tab navigation, theme, and service worker registration"
```

---

### Task 3: Itinerary tab (day navigation, confirmed info, memo)

**Files:**
- Modify: `index.html` (replace the `renderItin` stub added in Task 2)

- [ ] **Step 1: Replace the `renderItin` stub**

Find this exact block (added in Task 2):
```js
function renderItin(){
  $("#itinBody").innerHTML = '<div class="empty"><span class="bigem">📅</span><p>일정 준비 중</p></div>';
}
```
Replace it with:
```js
const TRIP_START = "2026-08-17";
const TRIP_END = "2026-08-27";
function dateRange(startISO, endISO){
  const out = [];
  let d = new Date(startISO+"T00:00:00");
  const end = new Date(endISO+"T00:00:00");
  while(d <= end){
    out.push(d.toISOString().slice(0,10));
    d.setDate(d.getDate()+1);
  }
  return out;
}
const DAYS = dateRange(TRIP_START, TRIP_END);

const TRIP_INFO = {
  "2026-08-17": { info: [
    {icon:"✈️", title:"KE407 인천 출발", detail:"20:05 인천국제공항(T2) 출발"}
  ]},
  "2026-08-18": { info: [
    {icon:"✈️", title:"KE407 브리즈번 도착", detail:"06:45 브리즈번공항(터미널 I) 도착 (+1일)"},
    {icon:"🏨", title:"Rhapsody Resort 체크인", detail:"14:00 · 3440 Surfers Paradise Boulevarde, Gold Coast QLD 4218"}
  ]},
  "2026-08-19": { info: [ {icon:"🏨", title:"Rhapsody Resort 숙박 중", detail:"골드코스트"} ]},
  "2026-08-20": { info: [ {icon:"🏨", title:"Rhapsody Resort 숙박 중", detail:"골드코스트"} ]},
  "2026-08-21": { info: [ {icon:"🏨", title:"Rhapsody Resort 숙박 중", detail:"골드코스트"} ]},
  "2026-08-22": { info: [ {icon:"🏨", title:"Rhapsody Resort 숙박 중", detail:"골드코스트"} ]},
  "2026-08-23": { info: [
    {icon:"🏨", title:"Rhapsody Resort 체크아웃", detail:"10:00"},
    {icon:"🏨", title:"Meriton Suites Herschel St 체크인", detail:"15:00 · 43 Herschel Street, Brisbane QLD 4000"}
  ]},
  "2026-08-24": { info: [ {icon:"🏨", title:"Meriton Suites Herschel St 숙박 중", detail:"브리즈번"} ]},
  "2026-08-25": { info: [ {icon:"🏨", title:"Meriton Suites Herschel St 숙박 중", detail:"브리즈번"} ]},
  "2026-08-26": { info: [ {icon:"🏨", title:"Meriton Suites Herschel St 숙박 중", detail:"브리즈번"} ]},
  "2026-08-27": { info: [
    {icon:"🏨", title:"Meriton Suites 체크아웃", detail:"10:00"},
    {icon:"✈️", title:"KE408 브리즈번 출발", detail:"08:40 브리즈번공항(터미널 I) 출발"},
    {icon:"✈️", title:"KE408 인천 도착", detail:"17:35 인천국제공항(T2) 도착"}
  ], warning: "체크아웃(10:00)이 출발(08:40)보다 늦어요 — 전날 미리 짐을 싸두거나 새벽에 체크아웃하세요." }
};

let dayIdx = 0;
function renderItin(){
  const date = DAYS[dayIdx];
  const t = TRIP_INFO[date] || {info:[]};
  const dow = DOW[new Date(date+"T00:00:00").getDay()];
  const infoHtml = t.info.map(x=>`
    <div class="infocard">
      <span class="ic">${x.icon}</span>
      <div class="body"><b>${esc(x.title)}</b><div class="detail">${esc(x.detail)}</div></div>
    </div>`).join("");
  const warnHtml = t.warning ? `<div class="warnbox">⚠️ ${esc(t.warning)}</div>` : "";
  const memo = DB.dayMemos[date] || "";
  $("#itinBody").innerHTML = `
    <div class="dayNav">
      <button class="iconbtn" id="dayPrev" ${dayIdx===0?"disabled":""}>‹</button>
      <span class="dayTtl">${date.slice(5).replace("-",".")} (${dow})</span>
      <button class="iconbtn" id="dayNext" ${dayIdx===DAYS.length-1?"disabled":""}>›</button>
    </div>
    ${infoHtml || `<div class="empty"><span class="bigem">📅</span><p>이 날은 확정된 일정이 없어요</p></div>`}
    ${warnHtml}
    <label class="fl">오늘의 메모</label>
    <textarea class="inp" id="dayMemo" rows="4" placeholder="오늘 뭐 할지 자유롭게 적어보세요">${esc(memo)}</textarea>
  `;
  $("#dayPrev").onclick = ()=>{ if(dayIdx>0){ dayIdx--; renderItin(); } };
  $("#dayNext").onclick = ()=>{ if(dayIdx<DAYS.length-1){ dayIdx++; renderItin(); } };
  $("#dayMemo").oninput = e=>{ DB.dayMemos[date] = e.target.value; save(); };
}
```

- [ ] **Step 2: Verify date range and first-day rendering**

```bash
lsof -ti:8791 | xargs -r kill
cd /Users/joyunsung/Desktop/AI/projects/travel-guide && python3 -m http.server 8791 > /tmp/travelguide-server.log 2>&1 &
sleep 1
```
Playwright:
- `browser_navigate` to `http://127.0.0.1:8791/`
- `browser_evaluate`: `() => ({ len: DAYS.length, first: DAYS[0], last: DAYS[DAYS.length-1] })` — expected: `{ len: 11, first: "2026-08-17", last: "2026-08-27" }`
- `browser_evaluate`: `() => document.querySelector('.dayTtl').textContent` — expected: `"08.17 (월)"`
- `browser_evaluate`: `() => document.querySelectorAll('.infocard .body b')[0].textContent` — expected: `"KE407 인천 출발"`
- `browser_evaluate`: `() => document.getElementById('dayPrev').disabled` — expected: `true`

- [ ] **Step 3: Verify navigating to the last day shows the checkout/departure conflict warning, and memo persists**

- `browser_click` on `#dayNext` 10 times (or use `browser_evaluate`: `() => { for(let i=0;i<10;i++) document.getElementById('dayNext').click(); }`)
- `browser_evaluate`: `() => document.querySelector('.dayTtl').textContent` — expected: `"08.27 (목)"`
- `browser_evaluate`: `() => document.querySelector('.warnbox').textContent` — expected to contain `"체크아웃(10:00)이 출발(08:40)보다 늦어요"`
- `browser_type` into `#dayMemo`: `"공항 가기 전에 짐 다 싸두기"`
- `browser_evaluate`: `() => JSON.parse(localStorage.getItem('travelguide.v1')).dayMemos['2026-08-27']` — expected: `"공항 가기 전에 짐 다 싸두기"`
- `browser_navigate` to `http://127.0.0.1:8791/` again (reload)
- `browser_evaluate`: `() => { for(let i=0;i<10;i++) document.getElementById('dayNext').click(); return document.getElementById('dayMemo').value; }` — expected: `"공항 가기 전에 짐 다 싸두기"` (confirms the memo survived a reload)

- [ ] **Step 4: Commit**

```bash
cd /Users/joyunsung/Desktop/AI/projects/travel-guide
git add index.html
git commit -m "Implement itinerary tab: day navigation, confirmed info cards, per-day memo"
```

---

### Task 4: Places tab (list, category/city filters, Google Maps deep link)

**Files:**
- Modify: `index.html` (replace the `renderPlaces` stub added in Task 2)

- [ ] **Step 1: Replace the `renderPlaces` stub**

Find this exact block (added in Task 2):
```js
function renderPlaces(){
  $("#placesBody").innerHTML = '<div class="empty"><span class="bigem">📍</span><p>장소 목록 준비 중</p></div>';
}
```
Replace it with:
```js
const CATEGORIES = [
  {k:"food",  n:"맛집/카페", ic:"🍜"},
  {k:"sight", n:"관광지",   ic:"🏖"},
  {k:"shop",  n:"쇼핑",     ic:"🛍"},
  {k:"move",  n:"교통/이동", ic:"🚌"},
  {k:"etc",   n:"기타",     ic:"📌"},
];
const CAT_MAP = Object.fromEntries(CATEGORIES.map(c=>[c.k,c]));
const CITIES = ["골드코스트","브리즈번","기타"];

function buildMapsUrl(p){
  const q = p.address ? `${p.name} ${p.address}` : p.name;
  return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
}

let placeCat = "all", placeCity = "all";

function renderPlaces(){
  const catChips = [{k:"all",n:"전체",ic:"✨"}, ...CATEGORIES].map(c=>
    `<button class="chip ${placeCat===c.k?"on":""}" data-cat="${c.k}">${c.ic} ${c.n}</button>`
  ).join("");
  const cityChips = ["all",...CITIES].map(c=>
    `<button class="chip ${placeCity===c?"on":""}" data-city="${c}">${c==="all"?"모든 도시":c}</button>`
  ).join("");
  const list = DB.places.filter(p=>
    (placeCat==="all"||p.category===placeCat) && (placeCity==="all"||p.city===placeCity)
  );
  const cardsHtml = list.length ? list.map(p=>`
    <div class="card" data-id="${p.id}">
      <div class="chead">
        <span class="ic">${CAT_MAP[p.category]?CAT_MAP[p.category].ic:"📌"}</span>
        <b>${esc(p.name)}</b>
        <span class="cnum">${esc(p.city)}</span>
      </div>
      ${p.memo ? `<div class="memoline">${esc(p.memo)}</div>` : ""}
      <div class="btnrow" style="margin-top:9px">
        <a class="btn sm" href="${buildMapsUrl(p)}" target="_blank" rel="noopener">🗺 구글맵에서 보기</a>
        <button class="btn sm ghost editBtn">✏️ 수정</button>
      </div>
    </div>
  `).join("") : `<div class="empty"><span class="bigem">📍</span><p>아직 저장한 장소가 없어요</p><p>오른쪽 위 ＋ 버튼으로 추가해보세요</p></div>`;

  $("#placesBody").innerHTML = `
    <div class="addhead">
      <span class="ttl">장소</span>
      <button class="iconbtn" id="addPlaceBtn" title="추가" style="margin-left:auto">➕</button>
    </div>
    <div class="chiprow">${catChips}</div>
    <div class="chiprow">${cityChips}</div>
    ${cardsHtml}
  `;
  $$("#placesBody [data-cat]").forEach(b=> b.onclick = ()=>{ placeCat=b.dataset.cat; renderPlaces(); });
  $$("#placesBody [data-city]").forEach(b=> b.onclick = ()=>{ placeCity=b.dataset.city; renderPlaces(); });
  $("#addPlaceBtn").onclick = ()=> openPlaceSheet(null);
  $$("#placesBody .card").forEach(el=> el.querySelector(".editBtn").onclick = ()=> openPlaceSheet(el.dataset.id));
}
```

- [ ] **Step 2: Verify empty state, and filtering with seeded data**

```bash
lsof -ti:8791 | xargs -r kill
cd /Users/joyunsung/Desktop/AI/projects/travel-guide && python3 -m http.server 8791 > /tmp/travelguide-server.log 2>&1 &
sleep 1
```
Playwright:
- `browser_navigate` to `http://127.0.0.1:8791/`
- `browser_click` on the "📍장소" tab
- `browser_evaluate`: `() => document.querySelector('#placesBody').textContent` — expected to contain `"아직 저장한 장소가 없어요"` (note: `openPlaceSheet` doesn't exist yet — this step must NOT click the ➕ button, only read text)
- `browser_evaluate` to seed a place directly and re-render (bypassing the not-yet-built form, to test list rendering in isolation):
  ```js
  () => {
    DB.places.push({id:"pl_test1", name:"Kim's Kitchen", city:"골드코스트", category:"food", address:"Surfers Paradise Blvd", memo:"불고기버거 맛있음", createdAt:Date.now()});
    save(); renderPlaces();
    return document.querySelectorAll('#placesBody .card').length;
  }
  ```
  expected: `1`
- `browser_evaluate`: `() => document.querySelector('#placesBody .card a.btn').getAttribute('href')` — expected: `"https://www.google.com/maps/search/?api=1&query=Kim's%20Kitchen%20Surfers%20Paradise%20Blvd"` (Playwright/Node's `encodeURIComponent` keeps `'` and `,` unescaped — confirm the string matches exactly what `encodeURIComponent("Kim's Kitchen Surfers Paradise Blvd")` produces; if it differs, use the browser's own computed value as ground truth, not this note)
- `browser_click` on the "🛍 쇼핑" category chip
- `browser_evaluate`: `() => document.querySelectorAll('#placesBody .card').length` — expected: `0` (the seeded place is category `food`, filtered out)
- `browser_click` on the "✨ 전체" category chip to reset

- [ ] **Step 3: Commit**

```bash
cd /Users/joyunsung/Desktop/AI/projects/travel-guide
git add index.html
git commit -m "Implement places tab: category/city filters, cards, Google Maps deep link"
```

---

### Task 5: Add/edit place sheet

**Files:**
- Modify: `index.html` (append after `renderPlaces`, added in Task 4)

- [ ] **Step 1: Append the sheet functions**

Find this exact tail (the last two lines added in Task 4):
```js
  $("#addPlaceBtn").onclick = ()=> openPlaceSheet(null);
  $$("#placesBody .card").forEach(el=> el.querySelector(".editBtn").onclick = ()=> openPlaceSheet(el.dataset.id));
}
```
Replace it with the same text plus the new functions appended after:
```js
  $("#addPlaceBtn").onclick = ()=> openPlaceSheet(null);
  $$("#placesBody .card").forEach(el=> el.querySelector(".editBtn").onclick = ()=> openPlaceSheet(el.dataset.id));
}

function openPlaceSheet(id){
  const editing = DB.places.find(p=>p.id===id) || null;
  $("#sheetHost").innerHTML = `
    <div class="sheet">
      <div class="sheetbar">
        <button class="iconbtn" id="sheetClose">✕</button>
        <span class="ttl">${editing?"장소 수정":"장소 추가"}</span>
      </div>
      <div class="sheetbody">
        <label class="fl">이름</label>
        <input class="inp" id="pfName" value="${editing?esc(editing.name):""}" placeholder="예: Kim's Kitchen">
        <label class="fl">도시</label>
        <select class="inp" id="pfCity">
          ${CITIES.map(c=>`<option value="${c}" ${editing&&editing.city===c?"selected":""}>${c}</option>`).join("")}
        </select>
        <label class="fl">카테고리</label>
        <select class="inp" id="pfCat">
          ${CATEGORIES.map(c=>`<option value="${c.k}" ${editing&&editing.category===c.k?"selected":""}>${c.ic} ${c.n}</option>`).join("")}
        </select>
        <label class="fl">주소 (선택, 구글맵 검색 정확도용)</label>
        <input class="inp" id="pfAddr" value="${editing?esc(editing.address||""):""}" placeholder="예: Surfers Paradise Blvd">
        <label class="fl">메모</label>
        <textarea class="inp" id="pfMemo" rows="3" placeholder="추천 메뉴, 팁 등">${editing?esc(editing.memo||""):""}</textarea>
        <div class="btnrow" style="margin-top:16px">
          <button class="btn primary full" id="pfSave">저장</button>
        </div>
        ${editing?'<button class="btn danger full" id="pfDel" style="margin-top:8px">삭제</button>':""}
      </div>
    </div>
  `;
  $("#sheetClose").onclick = closeSheet;
  $("#pfSave").onclick = ()=>{
    const name = $("#pfName").value.trim();
    if(!name){ toast("이름을 입력해주세요"); return; }
    const data = {
      name,
      city: $("#pfCity").value,
      category: $("#pfCat").value,
      address: $("#pfAddr").value.trim(),
      memo: $("#pfMemo").value.trim(),
    };
    if(editing){
      Object.assign(editing, data);
    } else {
      DB.places.push({ id: uid("pl"), createdAt: Date.now(), ...data });
    }
    save(); closeSheet(); renderPlaces();
    toast(editing?"수정했어요":"저장했어요");
  };
  if(editing){
    $("#pfDel").onclick = ()=>{
      if(!confirm("이 장소를 삭제할까요?")) return;
      DB.places = DB.places.filter(p=>p.id!==editing.id);
      save(); closeSheet(); renderPlaces();
      toast("삭제했어요");
    };
  }
}
function closeSheet(){ $("#sheetHost").innerHTML = ""; }
```

- [ ] **Step 2: Verify adding a place through the UI**

```bash
lsof -ti:8791 | xargs -r kill
cd /Users/joyunsung/Desktop/AI/projects/travel-guide && python3 -m http.server 8791 > /tmp/travelguide-server.log 2>&1 &
sleep 1
```
Playwright:
- `browser_navigate` to `http://127.0.0.1:8791/`
- `browser_click` on "📍장소" tab
- `browser_click` on `#addPlaceBtn`
- `browser_type` into `#pfName`: `"Q1 전망대"`
- `browser_select_option` on `#pfCity`: `"골드코스트"`
- `browser_select_option` on `#pfCat`: `"sight"`
- `browser_type` into `#pfMemo`: `"노을 시간대 추천"`
- `browser_click` on `#pfSave`
- `browser_evaluate`: `() => ({ len: document.querySelectorAll('#placesBody .card').length, db: JSON.parse(localStorage.getItem('travelguide.v1')).places.length })` — expected: `{ len: 1, db: 1 }`
- `browser_evaluate`: `() => document.querySelector('#placesBody .card .chead b').textContent` — expected: `"Q1 전망대"`

- [ ] **Step 3: Verify editing and deleting**

- `browser_click` on the `.editBtn` inside the place card
- `browser_evaluate`: `() => document.getElementById('pfName').value` — expected: `"Q1 전망대"` (form pre-filled)
- `browser_click` on `#pfDel`
- `browser_handle_dialog` — accept the `confirm()` dialog (this triggers when `#pfDel`'s click handler calls `confirm(...)`; Playwright auto-handles dialogs only if a handler is registered before the click — register the dialog handler to accept BEFORE clicking `#pfDel`)
- `browser_evaluate`: `() => JSON.parse(localStorage.getItem('travelguide.v1')).places.length` — expected: `0`

- [ ] **Step 4: Commit**

```bash
cd /Users/joyunsung/Desktop/AI/projects/travel-guide
git add index.html
git commit -m "Add place add/edit/delete sheet"
```

---

### Task 6: Checklist tab

**Files:**
- Modify: `index.html` (replace the `renderCheck` stub added in Task 2)

- [ ] **Step 1: Replace the `renderCheck` stub**

Find this exact block (added in Task 2):
```js
function renderCheck(){
  $("#checkBody").innerHTML = '<div class="empty"><span class="bigem">🎒</span><p>체크리스트 준비 중</p></div>';
}
```
Replace it with:
```js
function renderCheck(){
  const rows = DB.checklist.map(it=>`
    <div class="checkrow" data-id="${it.id}">
      <button class="checkbox ${it.checked?"on":""}">${it.checked?"✓":""}</button>
      <span class="label ${it.checked?"done":""}">${esc(it.label)}</span>
      <button class="delx">×</button>
    </div>
  `).join("");
  $("#checkBody").innerHTML = `
    <div class="addtip">
      <input id="ckNew" placeholder="새 준비물 입력 후 Enter">
      <button id="ckAddBtn">추가</button>
    </div>
    ${rows || `<div class="empty"><span class="bigem">🎒</span><p>준비물이 없어요</p></div>`}
  `;
  $$("#checkBody .checkrow").forEach(row=>{
    const id = row.dataset.id;
    row.querySelector(".checkbox").onclick = ()=> toggleCheck(id);
    row.querySelector(".delx").onclick = ()=> delCheckItem(id);
  });
  const addFn = ()=>{
    const v = $("#ckNew").value.trim();
    if(!v) return;
    addCheckItem(v);
    $("#ckNew").value = "";
  };
  $("#ckAddBtn").onclick = addFn;
  $("#ckNew").onkeydown = e=>{ if(e.key==="Enter") addFn(); };
}
function toggleCheck(id){
  const it = DB.checklist.find(x=>x.id===id);
  if(!it) return;
  it.checked = !it.checked; save(); renderCheck();
}
function addCheckItem(label){
  DB.checklist.push({id:uid("ck"), label, checked:false}); save(); renderCheck();
}
function delCheckItem(id){
  DB.checklist = DB.checklist.filter(x=>x.id!==id); save(); renderCheck();
}
```

- [ ] **Step 2: Verify default items render, toggle persists, add/delete work**

```bash
lsof -ti:8791 | xargs -r kill
cd /Users/joyunsung/Desktop/AI/projects/travel-guide && python3 -m http.server 8791 > /tmp/travelguide-server.log 2>&1 &
sleep 1
```
Playwright:
- `browser_navigate` to `http://127.0.0.1:8791/`
- `browser_click` on "🎒체크리스트" tab
- `browser_evaluate`: `() => document.querySelectorAll('#checkBody .checkrow').length` — expected: `10`
- `browser_evaluate`: `() => document.querySelectorAll('#checkBody .checkrow .label')[0].textContent` — expected: `"여권"`
- `browser_click` on the first `.checkbox`
- `browser_evaluate`: `() => JSON.parse(localStorage.getItem('travelguide.v1')).checklist[0].checked` — expected: `true`
- `browser_type` into `#ckNew`: `"멀미약"`, then press Enter (use `browser_type` with `submit: true` or follow with a separate Enter keypress via `browser_press_key`)
- `browser_evaluate`: `() => document.querySelectorAll('#checkBody .checkrow').length` — expected: `11`
- `browser_click` on the `.delx` of the last row (the one just added)
- `browser_evaluate`: `() => document.querySelectorAll('#checkBody .checkrow').length` — expected: `10`

- [ ] **Step 3: Commit**

```bash
cd /Users/joyunsung/Desktop/AI/projects/travel-guide
git add index.html
git commit -m "Implement checklist tab: default items, toggle, add, delete"
```

---

### Task 7: Backup export/import and theme toggle

Design doc section 5 left this ambiguous ("설정 화면 또는 체크리스트 하단에"). Resolved here: since the app has no dedicated 설정 tab (only 일정/장소/체크리스트, approved in the mockup), backup export/import and the theme toggle live at the bottom of the 체크리스트 tab.

**Files:**
- Modify: `index.html` (extend `renderCheck`'s template and wiring, added in Task 6; add pure helper functions near `DEFAULT_CHECKLIST`, added in Task 2)

- [ ] **Step 1: Add `todayISO`, `backupJSON`, `mergeImport` helpers**

Find this exact line (from Task 2):
```js
const DEFAULT_CHECKLIST = ["여권","항공권/전자티켓 캡처","호주 유심/이심","해외결제 카드","돼지코 어댑터(호주 표준)","보조배터리","상비약","선크림","우산/우비","수영복"];
```
Replace it with the same line plus new functions after:
```js
const DEFAULT_CHECKLIST = ["여권","항공권/전자티켓 캡처","호주 유심/이심","해외결제 카드","돼지코 어댑터(호주 표준)","보조배터리","상비약","선크림","우산/우비","수영복"];

function todayISO(){ return new Date().toISOString().slice(0,10); }
function backupJSON(){ return JSON.stringify(DB, null, 2); }
function mergeImport(inc){
  if(!inc || typeof inc !== "object") throw new Error("invalid backup");
  let added = 0;
  const haveIds = new Set(DB.places.map(p=>p.id));
  (inc.places||[]).forEach(p=>{
    if(p && p.id && !haveIds.has(p.id)){ DB.places.push(p); haveIds.add(p.id); added++; }
  });
  const haveCk = new Set(DB.checklist.map(c=>c.id));
  (inc.checklist||[]).forEach(c=>{
    if(c && c.id && !haveCk.has(c.id)){ DB.checklist.push(c); haveCk.add(c.id); }
  });
  Object.keys(inc.dayMemos||{}).forEach(d=>{
    if(!(d in DB.dayMemos)) DB.dayMemos[d] = inc.dayMemos[d];
  });
  return added;
}
```

- [ ] **Step 2: Extend `renderCheck`'s template with the settings block**

Find this exact block (from Task 6):
```js
  $("#checkBody").innerHTML = `
    <div class="addtip">
      <input id="ckNew" placeholder="새 준비물 입력 후 Enter">
      <button id="ckAddBtn">추가</button>
    </div>
    ${rows || `<div class="empty"><span class="bigem">🎒</span><p>준비물이 없어요</p></div>`}
  `;
```
Replace it with:
```js
  $("#checkBody").innerHTML = `
    <div class="addtip">
      <input id="ckNew" placeholder="새 준비물 입력 후 Enter">
      <button id="ckAddBtn">추가</button>
    </div>
    ${rows || `<div class="empty"><span class="bigem">🎒</span><p>준비물이 없어요</p></div>`}
    <div class="setblk">
      <h4>화면 테마</h4>
      <button class="btn full" id="themeBtn">◐ 테마 전환</button>
    </div>
    <div class="setblk">
      <h4>백업</h4>
      <p>장소·체크리스트·메모를 JSON 파일로 저장하거나 불러옵니다.</p>
      <div class="btnrow">
        <button class="btn" id="expBtn">⬇︎ 내보내기</button>
        <button class="btn" id="impBtn">⬆︎ 불러오기</button>
      </div>
      <input type="file" id="impFile" accept="application/json,.json" class="hidden">
    </div>
    <div class="setblk">
      <h4>홈 화면에 추가</h4>
      <p>폰 브라우저에서 이 주소를 열고 <b>공유 → 홈 화면에 추가</b>하면 앱처럼 쓸 수 있어요.</p>
    </div>
  `;
```

- [ ] **Step 3: Wire the new buttons**

Find this exact line (from Task 6):
```js
  $("#ckNew").onkeydown = e=>{ if(e.key==="Enter") addFn(); };
```
Replace it with the same line plus new wiring after:
```js
  $("#ckNew").onkeydown = e=>{ if(e.key==="Enter") addFn(); };
  $("#themeBtn").onclick = ()=> applyTheme(document.documentElement.dataset.theme==="light"?"dark":"light");
  $("#expBtn").onclick = ()=>{
    const blob = new Blob([backupJSON()], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `travelguide-backup_${todayISO()}.json`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 4000);
    toast("백업 파일을 내려받았어요");
  };
  $("#impBtn").onclick = ()=> $("#impFile").click();
  $("#impFile").onchange = ev=>{
    const file = ev.target.files[0];
    if(!file) return;
    const fr = new FileReader();
    fr.onload = ()=>{
      try{
        const inc = JSON.parse(fr.result);
        const added = mergeImport(inc);
        save(); renderCheck(); renderPlaces();
        toast(added ? `${added}개 장소를 합쳤어요` : "새로 추가할 내용이 없었어요");
      }catch(e){ toast("읽을 수 없는 백업 파일이에요"); }
      ev.target.value = "";
    };
    fr.readAsText(file);
  };
```

- [ ] **Step 4: Verify theme toggle and `backupJSON`/`mergeImport` directly**

```bash
lsof -ti:8791 | xargs -r kill
cd /Users/joyunsung/Desktop/AI/projects/travel-guide && python3 -m http.server 8791 > /tmp/travelguide-server.log 2>&1 &
sleep 1
```
Playwright:
- `browser_navigate` to `http://127.0.0.1:8791/`
- `browser_click` on "🎒체크리스트" tab
- `browser_evaluate`: `() => document.documentElement.dataset.theme` — note current value (either `dark` or `light`)
- `browser_click` on `#themeBtn`
- `browser_evaluate`: `() => ({ theme: document.documentElement.dataset.theme, stored: localStorage.getItem('travelguide.theme') })` — expected: `theme` flipped from the noted value, and `stored` equals the same new value
- `browser_evaluate`: `() => { const j = JSON.parse(backupJSON()); return { hasPlaces: Array.isArray(j.places), hasChecklist: Array.isArray(j.checklist) }; }` — expected: `{ hasPlaces: true, hasChecklist: true }`
- `browser_evaluate` to test `mergeImport` merge/dedupe logic directly:
  ```js
  () => {
    const before = DB.places.length;
    const added = mergeImport({ places: [{id:"pl_import1", name:"야시장", city:"브리즈번", category:"food", address:"", memo:"", createdAt:1}], checklist: [], dayMemos: {} });
    return { added, after: DB.places.length, before };
  }
  ```
  expected: `{ added: 1, after: before+1, before: <whatever it was> }`

- [ ] **Step 5: Verify export download and import file upload through the real UI**

- `browser_click` on `#expBtn`
- Confirm no console error was logged (`browser_console_messages`)
- Write a sample backup file for the import test:
  Use the Write tool to create `/private/tmp/claude-501/-Users-joyunsung-Desktop-AI/92f636b6-9fa7-4188-86c4-38d9072330ba/scratchpad/sample-backup.json`:
  ```json
  { "places": [{"id":"pl_upload1","name":"수산시장","city":"브리즈번","category":"food","address":"","memo":"","createdAt":1}], "checklist": [], "dayMemos": {} }
  ```
- `browser_click` on `#impBtn` (opens the hidden file input)
- `browser_file_upload` with the file path above, targeting `#impFile`
- `browser_evaluate`: `() => DB.places.some(p=>p.id==="pl_upload1")` — expected: `true`

- [ ] **Step 6: Commit**

```bash
cd /Users/joyunsung/Desktop/AI/projects/travel-guide
git add index.html
git commit -m "Add JSON backup export/import and theme toggle to checklist tab"
```

---

### Task 8: PWA install and offline verification

**Files:** none created/modified — this task verifies Task 1's `manifest.json`/`sw.js` actually work end-to-end now that the full app exists.

- [ ] **Step 1: Verify manifest and service worker registration**

```bash
lsof -ti:8791 | xargs -r kill
cd /Users/joyunsung/Desktop/AI/projects/travel-guide && python3 -m http.server 8791 > /tmp/travelguide-server.log 2>&1 &
sleep 1
```
Playwright:
- `browser_navigate` to `http://127.0.0.1:8791/`
- `browser_evaluate` (async): `async () => (await fetch('manifest.json')).status` — expected: `200`
- `browser_evaluate` (async, wait for registration): `async () => { const reg = await navigator.serviceWorker.ready; return !!reg.active; }` — expected: `true`
- `browser_evaluate` (async): `async () => { const keys = await caches.keys(); return keys; }` — expected: array containing `"travelguide-v1.0"`
- `browser_evaluate` (async): `async () => { const c = await caches.open('travelguide-v1.0'); const keys = await c.keys(); return keys.map(r=>new URL(r.url).pathname); }` — expected to include `/` (or `/index.html`) and `/manifest.json`

- [ ] **Step 2: Verify the app still renders after going offline (cache fallback)**

- Use `browser_navigate` to reload `http://127.0.0.1:8791/` once more to make sure the service worker has cached the latest version
- Stop the static server: `lsof -ti:8791 | xargs -r kill`
- `browser_navigate` to `http://127.0.0.1:8791/` again (server is down)
- `browser_evaluate`: `() => document.querySelector('.tab.on').textContent` — expected: `"📅일정"` (page still rendered from cache despite the server being offline)
- Restart the server for any later work: `cd /Users/joyunsung/Desktop/AI/projects/travel-guide && python3 -m http.server 8791 > /tmp/travelguide-server.log 2>&1 &`

- [ ] **Step 3: No commit needed** (verification-only task, no file changes)

---

### Task 9: README and CLAUDE.md project listing

**Files:**
- Create: `/Users/joyunsung/Desktop/AI/projects/travel-guide/README.md`
- Modify: `/Users/joyunsung/Desktop/AI/CLAUDE.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# 🧳 여행 가이드북 — 골드코스트·브리즈번 2026

2026-08-17~08-27 골드코스트·브리즈번 여행용 개인 모바일 가이드북. 파일 하나(`index.html`)로 끝나는 정적 웹앱. 서버·로그인 없음.

**➡️ https://cys0072000-cpu.github.io/travel-guide/** (배포 후 활성화됨)

## 쓰는 법

1. 위 주소를 연다 (폰이면 홈 화면에 추가해두고 아이콘으로)
2. **📅 일정** 탭에서 좌우 화살표로 날짜를 넘기며 그날 확정된 항공편·숙소 정보를 확인, 아래 메모칸에 그날 할 일을 자유롭게 적는다
3. **📍 장소** 탭에서 ➕로 맛집·관광지·쇼핑·교통·기타 장소를 추가하고, 카드의 **🗺 구글맵에서 보기**로 바로 길찾기
4. **🎒 체크리스트** 탭에서 준비물을 체크하고, 필요하면 추가/삭제. 탭 아래쪽에 테마 전환과 JSON 백업 내보내기/불러오기가 있다

## 3개 탭

| 탭 | 하는 일 |
|---|---|
| 📅 일정 | 8/17~8/27 날짜별 확정 항공편·숙소 체크인/아웃 정보 + 자유 메모 |
| 📍 장소 | 카테고리(맛집/관광지/쇼핑/교통/기타)·도시별로 장소를 쌓아두고, 구글맵 딥링크로 바로 이동 |
| 🎒 체크리스트 | 준비물 체크, 테마 전환, JSON 백업 내보내기/불러오기 |

## 데이터

모든 데이터(장소, 메모, 체크리스트)는 브라우저의 `localStorage`에 저장된다. 폰과 PC는 서로 다른 저장소이므로, 옮길 땐 체크리스트 탭 하단의 **⬇︎ 내보내기**로 JSON 백업을 받고 다른 기기에서 **⬆︎ 불러오기**로 합친다.

## 배포 (아직 안 함)

1. GitHub에 `travel-guide` 리포지토리 생성
2. `git remote add origin <repo-url>` 후 `git push -u origin main`
3. 저장소 Settings → Pages → main 브랜치 루트에서 배포
4. 폰 사파리·크롬에서 `cys0072000-cpu.github.io/travel-guide` 열고 **공유 → 홈 화면에 추가**
```

- [ ] **Step 2: Update `/Users/joyunsung/Desktop/AI/CLAUDE.md`**

In the 폴더 구조 tree, find this line:
```
│   ├── snsproject/            # 취향 기반 독서 SNS 사업 기획 — 개인
```
Replace it with:
```
│   ├── snsproject/            # 취향 기반 독서 SNS 사업 기획 — 개인
│   ├── travel-guide/          # 골드코스트·브리즈번 여행 가이드북 (일정·장소·체크리스트) — 개인
```

In the "프로젝트별 안내 (개인)" section, find this line:
```
### `projects/rentry/`
```
And insert a new subsection immediately before it:
```
### `projects/travel-guide/`
2026-08-17~08-27 골드코스트·브리즈번 여행용 개인 모바일 가이드북. 스낵PT와 동일한 패턴(`index.html` 단일 파일, localStorage, PWA)으로 만든 3탭(일정/장소/체크리스트) 앱. **자체 git repo 보유** — 배포 URL은 `projects/travel-guide/README.md` 참고 (아직 GitHub Pages 배포 전).

### `projects/rentry/`
```

- [ ] **Step 3: Verify README and CLAUDE.md changes**

```bash
grep -n "travel-guide" /Users/joyunsung/Desktop/AI/CLAUDE.md
```
Expected: two matches (the tree entry and the new subsection heading).

```bash
head -5 /Users/joyunsung/Desktop/AI/projects/travel-guide/README.md
```
Expected: starts with `# 🧳 여행 가이드북 — 골드코스트·브리즈번 2026`

- [ ] **Step 4: Commit (travel-guide repo only — root AI folder is not a git repo, so the CLAUDE.md edit has nothing to commit into)**

```bash
cd /Users/joyunsung/Desktop/AI/projects/travel-guide
git add README.md
git commit -m "Add README"
```

---

## After all tasks: what's left before this ships

- **Not done yet, needs the user live:** create the GitHub repo (`gh repo create travel-guide --public` or via github.com), `git remote add origin ...`, `git push -u origin main`, enable GitHub Pages. Confirm the target GitHub account/visibility with the user before running any of this — do not do it unattended.
- **Known open item from the design doc:** the 8/27 checkout (10:00) vs. departure (08:40) conflict is surfaced as a warning banner in the app (Task 3) — no further code action needed, it's informational by design.
