# FiskeApp UI-uppgradering — Implementationsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uppgradera FiskeApp med dashboard-hem, steg-för-steg loggning, utökad statistik, IndexedDB-lagring och modulstruktur.

**Architecture:** Vanilla JS PWA utan bundler. Varje modul är en IIFE som registrerar sig på `window.FiskeApp`. Filer laddas som `<script>`-taggar i beroendeordning. IndexedDB ersätter localStorage. Custom events på `document` för lösa kopplingar mellan moduler.

**Tech Stack:** HTML5, CSS3, Vanilla JS, Leaflet 1.9.4, MarkerCluster, IndexedDB, Open-Meteo API

**Spec:** `docs/superpowers/specs/2026-04-13-ui-uppgradering-design.md`

---

## Filöversikt

| Åtgärd | Fil | Ansvar |
|--------|-----|--------|
| Skapa | `js/utils.js` | Delade hjälpfunktioner: formatDate, toDatetimeLocal, haversine, esc, uid, timeAgo |
| Skapa | `js/db.js` | IndexedDB CRUD + migrering från localStorage + backup-påminnelse |
| Skapa | `js/router.js` | Flikbyte, aktiv-markering, custom event `view-changed` |
| Skapa | `js/home.js` | Dashboard-vy: header, snabbknappar, nyckeltal, senaste fångster, mini-karta |
| Skapa | `js/map.js` | Leaflet-karta, markörer, klick/långtryck-interaktion, positionsknapp |
| Skapa | `js/catch-form.js` | Steg-för-steg formulär (4 steg), autocomplete, väder, foto |
| Skapa | `js/catches.js` | Fångstlista med filter, fångstdetalj-modal, ta-bort-fångst |
| Skapa | `js/stats.js` | Statistik: sammanfattning, drag-analys, plats-analys, tidsfilter, export |
| Skapa | `js/spots.js` | Platslista, platsformulär, ta-bort-plats |
| Skriv om | `js/app.js` | Orkestrator: importerar moduler, startar appen, registrerar SW |
| Ändra | `index.html` | Ny HTML-struktur: dashboard-vy, steg-formulär, 5 flikar, script-taggar |
| Ändra | `css/style.css` | Nya sektioner: dashboard, steg-formulär, toast, expanderbara rader |
| Ändra | `sw.js` | Uppdatera CACHE_NAME och APP_SHELL med nya JS-filer |

---

### Task 1: utils.js — Delade hjälpfunktioner

Extrahera alla rena hjälpfunktioner från nuvarande `app.js` till en egen modul. Detta är grunden som alla andra moduler beror på.

**Files:**
- Create: `js/utils.js`

- [ ] **Step 1: Skapa `js/utils.js`**

```js
/* ===========================
   Delade hjälpfunktioner
   — Används av alla moduler
   =========================== */
window.FiskeApp = window.FiskeApp || {};

window.FiskeApp.utils = (function () {
  'use strict';

  /* Generera unikt ID baserat på tid och slump */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* Formatera ISO-datum till läsbar svensk sträng */
  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('sv-SE') + ' ' +
      d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  }

  /* Formatera Date-objekt till datetime-local-värde */
  function toDatetimeLocal(d) {
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  /* Haversine — avstånd i meter mellan två koordinater */
  function haversine(lat1, lng1, lat2, lng2) {
    var R = 6371000;
    var toRad = Math.PI / 180;
    var dLat = (lat2 - lat1) * toRad;
    var dLng = (lng2 - lng1) * toRad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /* Escape HTML för att undvika XSS */
  function esc(str) {
    if (!str) return '';
    var el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  /* Relativ tid — "igår", "3 dagar sedan" etc. */
  function timeAgo(iso) {
    var now = Date.now();
    var then = new Date(iso).getTime();
    var diffMs = now - then;
    var diffMin = Math.floor(diffMs / 60000);
    var diffH = Math.floor(diffMs / 3600000);
    var diffD = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'just nu';
    if (diffMin < 60) return diffMin + ' min sedan';
    if (diffH < 24) return diffH + ' h sedan';
    if (diffD === 1) return 'igår';
    if (diffD < 30) return diffD + ' dagar sedan';
    var diffM = Math.floor(diffD / 30);
    if (diffM === 1) return '1 månad sedan';
    return diffM + ' månader sedan';
  }

  /* Avstånd i meter för att koppla fångst till namngiven plats */
  var SPOT_RADIUS = 300;

  /* Hitta närmaste namngivna plats inom radien */
  function nearestSpot(lat, lng, spots) {
    var best = null;
    var bestDist = Infinity;
    spots.forEach(function (s) {
      var d = haversine(lat, lng, s.lat, s.lng);
      if (d < SPOT_RADIUS && d < bestDist) {
        bestDist = d;
        best = s;
      }
    });
    return best;
  }

  /* Hälsningsfras baserad på tid på dygnet */
  function greeting() {
    var h = new Date().getHours();
    if (h < 5) return 'God natt';
    if (h < 10) return 'God morgon';
    if (h < 17) return 'God eftermiddag';
    return 'God kväll';
  }

  return {
    uid: uid,
    formatDate: formatDate,
    toDatetimeLocal: toDatetimeLocal,
    haversine: haversine,
    esc: esc,
    timeAgo: timeAgo,
    nearestSpot: nearestSpot,
    greeting: greeting,
    SPOT_RADIUS: SPOT_RADIUS
  };
})();
```

- [ ] **Step 2: Verifiera att filen är korrekt**

Öppna `js/utils.js` i editorn och kontrollera att alla funktioner finns: `uid`, `formatDate`, `toDatetimeLocal`, `haversine`, `esc`, `timeAgo`, `nearestSpot`, `greeting`. Kontrollera att IIFE:n returnerar alla funktioner.

- [ ] **Step 3: Commit**

```bash
git add js/utils.js
git commit -m "feat: extrahera delade hjälpfunktioner till utils.js

Flyttar uid, formatDate, toDatetimeLocal, haversine, esc
och lägger till timeAgo, nearestSpot, greeting.
Alla registreras på window.FiskeApp.utils."
```

---

### Task 2: db.js — IndexedDB-lagring med migrering

Ersätt localStorage med IndexedDB. Inkluderar migrering av befintlig data och backup-påminnelse.

**Files:**
- Create: `js/db.js`

- [ ] **Step 1: Skapa `js/db.js`**

```js
/* ===========================
   Datalagring (IndexedDB)
   — Ersätter localStorage med
     IndexedDB för pålitligare
     lagring av fångster och
     platser. Migrerar befintlig
     data vid första start.
   =========================== */
window.FiskeApp = window.FiskeApp || {};

window.FiskeApp.db = (function () {
  'use strict';

  var DB_NAME = 'fiskeapp';
  var DB_VERSION = 1;
  var db = null;

  /* Räknare för backup-påminnelse */
  var saveCount = 0;
  var BACKUP_INTERVAL = 10;

  /* Öppna/skapa databasen */
  function open() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (e) {
        var database = e.target.result;
        if (!database.objectStoreNames.contains('catches')) {
          database.createObjectStore('catches', { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains('spots')) {
          database.createObjectStore('spots', { keyPath: 'id' });
        }
      };

      request.onsuccess = function (e) {
        db = e.target.result;
        resolve(db);
      };

      request.onerror = function (e) {
        reject(e.target.error);
      };
    });
  }

  /* Generisk hämta-alla från en store */
  function getAll(storeName) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, 'readonly');
      var store = tx.objectStore(storeName);
      var request = store.getAll();
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  /* Generisk spara (put = skapa eller uppdatera) */
  function put(storeName, item) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, 'readwrite');
      var store = tx.objectStore(storeName);
      var request = store.put(item);
      request.onsuccess = function () { resolve(); };
      request.onerror = function () { reject(request.error); };
    });
  }

  /* Generisk ta bort */
  function remove(storeName, id) {
    return new Promise(function (resolve, reject) {
      var tx = db.transaction(storeName, 'readwrite');
      var store = tx.objectStore(storeName);
      var request = store.delete(id);
      request.onsuccess = function () { resolve(); };
      request.onerror = function () { reject(request.error); };
    });
  }

  /* --- Publikt API --- */

  function getAllCatches() {
    return getAll('catches').then(function (catches) {
      /* Sortera med senaste först */
      return catches.sort(function (a, b) {
        return new Date(b.datetime) - new Date(a.datetime);
      });
    });
  }

  function saveCatch(entry) {
    return put('catches', entry).then(function () {
      saveCount++;
      if (saveCount % BACKUP_INTERVAL === 0) {
        showBackupReminder();
      }
    });
  }

  function deleteCatch(id) {
    return remove('catches', id);
  }

  function getAllSpots() {
    return getAll('spots');
  }

  function saveSpot(entry) {
    return put('spots', entry);
  }

  function updateSpot(entry) {
    return put('spots', entry);
  }

  function deleteSpot(id) {
    return remove('spots', id);
  }

  function exportAll() {
    return Promise.all([getAllCatches(), getAllSpots()]).then(function (results) {
      return { catches: results[0], spots: results[1] };
    });
  }

  /* Migrera data från localStorage till IndexedDB */
  function migrateFromLocalStorage() {
    var CATCH_KEY = 'fiskeapp_catches';
    var SPOT_KEY = 'fiskeapp_spots';

    var catchData = null;
    var spotData = null;

    try { catchData = JSON.parse(localStorage.getItem(CATCH_KEY)); } catch (e) { /* ignorera */ }
    try { spotData = JSON.parse(localStorage.getItem(SPOT_KEY)); } catch (e) { /* ignorera */ }

    if (!catchData && !spotData) return Promise.resolve(false);

    var promises = [];

    if (catchData && catchData.length > 0) {
      catchData.forEach(function (c) {
        promises.push(put('catches', c));
      });
    }

    if (spotData && spotData.length > 0) {
      spotData.forEach(function (s) {
        promises.push(put('spots', s));
      });
    }

    return Promise.all(promises).then(function () {
      localStorage.removeItem(CATCH_KEY);
      localStorage.removeItem(SPOT_KEY);
      showToast('Data migrerad till ny lagring');
      return true;
    });
  }

  /* Toast-notis (enkel implementation) */
  function showToast(message) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    /* Visa med animation */
    requestAnimationFrame(function () {
      toast.classList.add('visible');
    });

    setTimeout(function () {
      toast.classList.remove('visible');
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  /* Backup-påminnelse */
  function showBackupReminder() {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'toast toast-action';
    toast.innerHTML = 'Dags att exportera en backup? ' +
      '<button class="toast-btn" id="toast-backup-btn">Exportera</button>';
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('visible');
    });

    document.getElementById('toast-backup-btn').addEventListener('click', function () {
      /* Navigera till statistikvyn där exportknappen finns */
      document.dispatchEvent(new CustomEvent('navigate', { detail: 'stats' }));
      toast.classList.remove('visible');
      setTimeout(function () { toast.remove(); }, 300);
    });

    setTimeout(function () {
      toast.classList.remove('visible');
      setTimeout(function () { toast.remove(); }, 300);
    }, 6000);
  }

  /* Init: öppna DB och migrera om det behövs */
  function init() {
    return open().then(function () {
      return migrateFromLocalStorage();
    });
  }

  return {
    init: init,
    getAllCatches: getAllCatches,
    saveCatch: saveCatch,
    deleteCatch: deleteCatch,
    getAllSpots: getAllSpots,
    saveSpot: saveSpot,
    updateSpot: updateSpot,
    deleteSpot: deleteSpot,
    exportAll: exportAll,
    showToast: showToast
  };
})();
```

- [ ] **Step 2: Verifiera**

Kontrollera att alla publika funktioner finns i return-blocket: `init`, `getAllCatches`, `saveCatch`, `deleteCatch`, `getAllSpots`, `saveSpot`, `updateSpot`, `deleteSpot`, `exportAll`, `showToast`.

- [ ] **Step 3: Commit**

```bash
git add js/db.js
git commit -m "feat: lägg till IndexedDB-lagring med migrering

Ersätter localStorage med IndexedDB för pålitligare lagring.
Migrerar automatiskt befintlig data vid första start.
Backup-påminnelse efter var 10:e sparad fångst."
```

---

### Task 3: router.js — Navigation mellan vyer

Hanterar flikbyte i bottomnav. Dispatchar `view-changed` event.

**Files:**
- Create: `js/router.js`

- [ ] **Step 1: Skapa `js/router.js`**

```js
/* ===========================
   Router
   — Hanterar flikbyte mellan
     vyer i bottomnavigationen.
     Dispatchar 'view-changed'
     event vid byte.
   =========================== */
window.FiskeApp = window.FiskeApp || {};

window.FiskeApp.router = (function () {
  'use strict';

  var tabs = null;
  var views = null;
  var currentView = 'home';

  function init() {
    tabs = document.querySelectorAll('.nav-tab');
    views = document.querySelectorAll('.view');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        navigate(this.dataset.view);
      });
    });

    /* Lyssna på navigate-event från andra moduler */
    document.addEventListener('navigate', function (e) {
      navigate(e.detail);
    });
  }

  function navigate(viewName) {
    if (viewName === currentView) return;

    tabs.forEach(function (t) { t.classList.remove('active'); });
    views.forEach(function (v) { v.classList.remove('active'); });

    var targetTab = document.querySelector('.nav-tab[data-view="' + viewName + '"]');
    var targetView = document.getElementById('view-' + viewName);

    if (targetTab) targetTab.classList.add('active');
    if (targetView) targetView.classList.add('active');

    currentView = viewName;

    document.dispatchEvent(new CustomEvent('view-changed', {
      detail: viewName
    }));
  }

  function getCurrentView() {
    return currentView;
  }

  return {
    init: init,
    navigate: navigate,
    getCurrentView: getCurrentView
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/router.js
git commit -m "feat: lägg till router för fliknavigering

Hanterar flikbyte i bottomnav med 5 flikar.
Dispatchar view-changed event vid byte.
Lyssnar på navigate-event från andra moduler."
```

---

### Task 4: map.js — Kartvyn

Extrahera all kartlogik från `app.js`. Enda ändringen: klick öppnar nya steg-formuläret via event.

**Files:**
- Create: `js/map.js`

- [ ] **Step 1: Skapa `js/map.js`**

```js
/* ===========================
   Kartvy
   — Leaflet-karta med satellit,
     kluster, klick/långtryck-
     interaktion och positions-
     knapp. Dispatchar events
     för att öppna formulär.
   =========================== */
window.FiskeApp = window.FiskeApp || {};

window.FiskeApp.map = (function () {
  'use strict';

  var utils = null;
  var map = null;
  var catchCluster = null;
  var spotLayer = null;

  var MAP_CENTER = [60.2, 20.0];
  var MAP_ZOOM = 11;

  function init() {
    utils = window.FiskeApp.utils;

    map = L.map('map', {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      zoomControl: false
    });

    /* Esri World Imagery — gratis satellitplattor */
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: '&copy; Esri', maxZoom: 19 }
    ).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    /* Klusterlager för fångstmarkörer */
    catchCluster = L.markerClusterGroup({
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: function (cluster) {
        var count = cluster.getChildCount();
        return L.divIcon({
          html: '<div class="cluster-icon">' + count + '</div>',
          className: 'catch-cluster',
          iconSize: L.point(40, 40)
        });
      }
    });
    map.addLayer(catchCluster);

    /* Separat lager för namngivna platser */
    spotLayer = L.layerGroup().addTo(map);

    initInteraction();
    showHint();
  }

  /* Kartinteraktion — klick och långtryck */
  function initInteraction() {
    var longPressTimer = null;
    var longPressTriggered = false;
    var touchStartPos = null;
    var container = map.getContainer();

    /* Enkelt klick — öppna fångstformulär */
    map.on('click', function (e) {
      if (longPressTriggered) {
        longPressTriggered = false;
        return;
      }
      document.dispatchEvent(new CustomEvent('open-catch-form', {
        detail: { lat: e.latlng.lat, lng: e.latlng.lng }
      }));
    });

    /* Långtryck på mobil */
    container.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      longPressTimer = setTimeout(function () {
        longPressTriggered = true;
        var rect = container.getBoundingClientRect();
        var point = map.containerPointToLatLng(
          L.point(touchStartPos.x - rect.left, touchStartPos.y - rect.top)
        );
        document.dispatchEvent(new CustomEvent('open-spot-form', {
          detail: { lat: point.lat, lng: point.lng }
        }));
      }, 700);
    }, { passive: true });

    container.addEventListener('touchmove', function (e) {
      if (longPressTimer && touchStartPos) {
        var dx = e.touches[0].clientX - touchStartPos.x;
        var dy = e.touches[0].clientY - touchStartPos.y;
        if (Math.sqrt(dx * dx + dy * dy) > 10) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
    }, { passive: true });

    container.addEventListener('touchend', function () {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    });

    /* Högerklick på dator */
    map.on('contextmenu', function (e) {
      longPressTriggered = true;
      document.dispatchEvent(new CustomEvent('open-spot-form', {
        detail: { lat: e.latlng.lat, lng: e.latlng.lng }
      }));
    });

    /* Positioneringsknapp */
    document.getElementById('locate-btn').addEventListener('click', function () {
      map.locate({ setView: true, maxZoom: 15 });
    });
  }

  /* Visa hjälptext vid första besöket */
  function showHint() {
    if (!localStorage.getItem('fiskeapp_hint_shown')) {
      var hint = document.getElementById('map-hint');
      hint.classList.add('visible');
      setTimeout(function () { hint.classList.remove('visible'); }, 4000);
      localStorage.setItem('fiskeapp_hint_shown', '1');
    }
  }

  /* Ladda markörer från data */
  function loadMarkers(catches, spots) {
    catchCluster.clearLayers();
    spotLayer.clearLayers();

    catches.forEach(function (c) { addCatchMarker(c); });
    spots.forEach(function (s) { addSpotMarker(s); });
  }

  function addCatchMarker(c) {
    var icon = L.divIcon({
      html: '<div class="catch-marker">&#128031;</div>',
      className: '',
      iconSize: L.point(28, 28),
      iconAnchor: L.point(14, 14)
    });

    var marker = L.marker([c.lat, c.lng], { icon: icon });

    var popupHtml =
      '<div class="popup-title">' + utils.esc(c.species) + '</div>' +
      '<div class="popup-detail">' + utils.formatDate(c.datetime) + '</div>' +
      (c.length ? '<div class="popup-detail">' + c.length + ' cm</div>' : '') +
      (c.weight ? '<div class="popup-detail">' + c.weight + ' kg</div>' : '') +
      '<button class="popup-btn" onclick="document.dispatchEvent(new CustomEvent(\'show-catch-detail\',{detail:\'' + c.id + '\'}))">Visa detaljer</button>';

    marker.bindPopup(popupHtml);
    catchCluster.addLayer(marker);
  }

  function addSpotMarker(s) {
    var icon = L.divIcon({
      html: '<div class="spot-marker"><span>&#9733;</span></div>',
      className: '',
      iconSize: L.point(32, 32),
      iconAnchor: L.point(16, 32)
    });

    var marker = L.marker([s.lat, s.lng], { icon: icon });

    var popupHtml =
      '<div class="popup-title">' + utils.esc(s.name) + '</div>' +
      (s.note ? '<div class="popup-detail">' + utils.esc(s.note) + '</div>' : '') +
      '<button class="popup-btn" onclick="document.dispatchEvent(new CustomEvent(\'edit-spot\',{detail:\'' + s.id + '\'}))">Redigera</button>';

    marker.bindPopup(popupHtml);
    spotLayer.addLayer(marker);
  }

  /* Uppdatera kartans storlek (vid flikbyte) */
  function invalidateSize() {
    if (map) map.invalidateSize();
  }

  function closePopup() {
    if (map) map.closePopup();
  }

  /* Skapa en mini-karta för dashboard */
  function createMiniMap(containerId, catches) {
    var miniMap = L.map(containerId, {
      center: MAP_CENTER,
      zoom: MAP_ZOOM - 1,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      attributionControl: false
    });

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19 }
    ).addTo(miniMap);

    /* Visa de 5 senaste fångsterna */
    var recent = catches.slice(0, 5);
    var bounds = [];

    recent.forEach(function (c) {
      var icon = L.divIcon({
        html: '<div class="catch-marker" style="width:16px;height:16px;font-size:10px;">&#128031;</div>',
        className: '',
        iconSize: L.point(16, 16),
        iconAnchor: L.point(8, 8)
      });
      L.marker([c.lat, c.lng], { icon: icon }).addTo(miniMap);
      bounds.push([c.lat, c.lng]);
    });

    if (bounds.length > 0) {
      miniMap.fitBounds(bounds, { padding: [20, 20], maxZoom: 13 });
    }

    return miniMap;
  }

  return {
    init: init,
    loadMarkers: loadMarkers,
    invalidateSize: invalidateSize,
    closePopup: closePopup,
    createMiniMap: createMiniMap
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/map.js
git commit -m "feat: extrahera kartlogik till map.js

Leaflet-karta, markörer, klick/långtryck, positionsknapp.
Dispatchar events istället för direktanrop till formulär.
Inkluderar createMiniMap för dashboard."
```

---

### Task 5: catch-form.js — Steg-för-steg loggning

Nytt formulär med 4 steg: Art → Bete → Datum → Valfritt.

**Files:**
- Create: `js/catch-form.js`

- [ ] **Step 1: Skapa `js/catch-form.js`**

```js
/* ===========================
   Steg-för-steg loggning
   — Fullskärmsmodal med ett
     fält per steg för snabb
     fångstloggning vid vattnet.
   =========================== */
window.FiskeApp = window.FiskeApp || {};

window.FiskeApp.catchForm = (function () {
  'use strict';

  var utils = null;
  var db = null;

  var currentStep = 1;
  var totalSteps = 4;
  var formData = {};

  function init() {
    utils = window.FiskeApp.utils;
    db = window.FiskeApp.db;

    /* Lyssna på öppna-event från karta och dashboard */
    document.addEventListener('open-catch-form', function (e) {
      openForm(e.detail);
    });

    /* Navigeringsknappar */
    document.getElementById('step-next-1').addEventListener('click', function () {
      var val = document.getElementById('step-species').value.trim();
      if (!val) return;
      formData.species = val;
      goToStep(2);
    });

    document.getElementById('step-next-2').addEventListener('click', function () {
      var val = document.getElementById('step-lure').value.trim();
      if (!val) return;
      formData.lure = val;
      goToStep(3);
    });

    document.getElementById('step-next-3').addEventListener('click', function () {
      formData.datetime = document.getElementById('step-datetime').value;
      goToStep(4);
    });

    /* Tillbaka-knappar */
    document.getElementById('step-back-2').addEventListener('click', function () { goToStep(1); });
    document.getElementById('step-back-3').addEventListener('click', function () { goToStep(2); });
    document.getElementById('step-back-4').addEventListener('click', function () { goToStep(3); });

    /* Stäng-knapp */
    document.getElementById('step-form-close').addEventListener('click', closeForm);

    /* Foto-förhandsvisning */
    document.getElementById('step-photo').addEventListener('change', function () {
      var file = this.files[0];
      if (file) {
        var reader = new FileReader();
        reader.onload = function (e) {
          var preview = document.getElementById('step-photo-preview');
          preview.src = e.target.result;
          preview.classList.add('has-photo');
        };
        reader.readAsDataURL(file);
      }
    });

    /* Spara-knapp */
    document.getElementById('step-save').addEventListener('click', saveEntry);
  }

  function openForm(coords) {
    formData = {
      lat: coords.lat,
      lng: coords.lng
    };

    /* Återställ alla fält */
    document.getElementById('step-species').value = '';
    document.getElementById('step-lure').value = '';
    document.getElementById('step-datetime').value = utils.toDatetimeLocal(new Date());
    document.getElementById('step-length').value = '';
    document.getElementById('step-weight').value = '';
    document.getElementById('step-note').value = '';
    document.getElementById('step-photo').value = '';
    var preview = document.getElementById('step-photo-preview');
    preview.src = '';
    preview.classList.remove('has-photo');

    /* Uppdatera autocomplete-listor */
    updateAutocomplete();

    /* Hämta väder i bakgrunden */
    fetchWeather(coords.lat, coords.lng);

    /* Visa steg 1 */
    goToStep(1);
    document.getElementById('step-form-overlay').classList.add('open');
  }

  function closeForm() {
    document.getElementById('step-form-overlay').classList.remove('open');
  }

  function goToStep(step) {
    currentStep = step;

    /* Dölj alla steg, visa rätt */
    for (var i = 1; i <= totalSteps; i++) {
      var el = document.getElementById('step-' + i);
      el.style.display = (i === step) ? 'block' : 'none';
    }

    /* Uppdatera progressprickar */
    var dots = document.querySelectorAll('.step-dot');
    dots.forEach(function (dot, idx) {
      dot.classList.toggle('active', idx < step);
      dot.classList.toggle('current', idx === step - 1);
    });

    /* Auto-fokusera textfält */
    if (step === 1) document.getElementById('step-species').focus();
    if (step === 2) document.getElementById('step-lure').focus();
  }

  function updateAutocomplete() {
    db.getAllCatches().then(function (catches) {
      /* Unika arter */
      var speciesSet = {};
      var lureSet = {};
      catches.forEach(function (c) {
        if (c.species) speciesSet[c.species.toLowerCase()] = c.species;
        if (c.lure) lureSet[c.lure.toLowerCase()] = c.lure;
      });

      var speciesList = document.getElementById('species-suggestions');
      speciesList.innerHTML = '';
      Object.values(speciesSet).forEach(function (s) {
        speciesList.innerHTML += '<option value="' + utils.esc(s) + '">';
      });

      var lureList = document.getElementById('lure-suggestions');
      lureList.innerHTML = '';
      /* Standardförslag */
      ['jerk', 'jigg', 'pig shad', 'wobbler', 'drop shot'].forEach(function (l) {
        if (!lureSet[l]) lureSet[l] = l;
      });
      Object.values(lureSet).forEach(function (l) {
        lureList.innerHTML += '<option value="' + utils.esc(l) + '">';
      });
    });
  }

  function fetchWeather(lat, lng) {
    var url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + lat.toFixed(4) +
      '&longitude=' + lng.toFixed(4) +
      '&current=temperature_2m,wind_speed_10m,surface_pressure';

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.current) {
          formData.temp = data.current.temperature_2m;
          formData.wind = data.current.wind_speed_10m;
          formData.pressure = Math.round(data.current.surface_pressure);
        }
      })
      .catch(function () { /* Väder ej tillgängligt — ignorera */ });
  }

  function processPhoto(file) {
    return new Promise(function (resolve) {
      if (!file) { resolve(null); return; }
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var MAX = 800;
          var w = img.width;
          var h = img.height;
          if (w > MAX) {
            h = Math.round(h * MAX / w);
            w = MAX;
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function saveEntry() {
    var photoFile = document.getElementById('step-photo').files[0];

    processPhoto(photoFile).then(function (photoData) {
      var entry = {
        id: utils.uid(),
        species: formData.species,
        lure: formData.lure,
        length: parseFloat(document.getElementById('step-length').value) || null,
        weight: parseFloat(document.getElementById('step-weight').value) || null,
        datetime: formData.datetime,
        note: document.getElementById('step-note').value.trim(),
        lat: formData.lat,
        lng: formData.lng,
        temp: formData.temp || null,
        wind: formData.wind || null,
        pressure: formData.pressure || null,
        photo: photoData
      };

      return db.saveCatch(entry);
    }).then(function () {
      closeForm();
      document.dispatchEvent(new CustomEvent('catch-saved'));
    });
  }

  return {
    init: init
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/catch-form.js
git commit -m "feat: lägg till steg-för-steg loggningsformulär

4 steg: Art → Bete → Datum → Valfritt (längd/vikt/foto/anteckning).
Autocomplete baserat på tidigare fångster.
Väder hämtas automatiskt i bakgrunden."
```

---

### Task 6: catches.js — Fångstlista och detaljer

Extrahera fångstlistan, filter och detaljmodal från `app.js`.

**Files:**
- Create: `js/catches.js`

- [ ] **Step 1: Skapa `js/catches.js`**

```js
/* ===========================
   Fångstlista
   — Visar alla fångster med
     filter och detaljmodal.
   =========================== */
window.FiskeApp = window.FiskeApp || {};

window.FiskeApp.catches = (function () {
  'use strict';

  var utils = null;
  var db = null;
  var catches = [];
  var spots = [];

  function init() {
    utils = window.FiskeApp.utils;
    db = window.FiskeApp.db;

    /* Lyssna på filterändringar */
    ['filter-species', 'filter-month', 'filter-spot'].forEach(function (id) {
      document.getElementById(id).addEventListener('change', render);
    });

    /* Lyssna på visa-detalj-event */
    document.addEventListener('show-catch-detail', function (e) {
      showDetail(e.detail);
    });

    /* Stäng detaljmodal */
    document.querySelector('[data-close="detail-modal"]').addEventListener('click', function () {
      document.getElementById('detail-modal').classList.remove('open');
    });

    document.getElementById('detail-modal').addEventListener('click', function (e) {
      if (e.target === this) this.classList.remove('open');
    });
  }

  function refresh(catchData, spotData) {
    catches = catchData;
    spots = spotData;
    updateFilters();
    render();
  }

  function updateFilters() {
    var speciesSet = {};
    var monthSet = {};
    catches.forEach(function (c) {
      speciesSet[c.species.toLowerCase()] = c.species;
      var m = new Date(c.datetime).getMonth() + 1;
      monthSet[m] = true;
    });

    var monthNames = ['', 'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
      'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];

    var speciesSelect = document.getElementById('filter-species');
    var currentSpecies = speciesSelect.value;
    speciesSelect.innerHTML = '<option value="">Alla arter</option>';
    Object.keys(speciesSet).sort().forEach(function (key) {
      speciesSelect.innerHTML += '<option value="' + utils.esc(key) + '">' + utils.esc(speciesSet[key]) + '</option>';
    });
    speciesSelect.value = currentSpecies;

    var monthSelect = document.getElementById('filter-month');
    var currentMonth = monthSelect.value;
    monthSelect.innerHTML = '<option value="">Alla månader</option>';
    Object.keys(monthSet).sort(function (a, b) { return a - b; }).forEach(function (m) {
      monthSelect.innerHTML += '<option value="' + m + '">' + monthNames[m] + '</option>';
    });
    monthSelect.value = currentMonth;

    var spotSelect = document.getElementById('filter-spot');
    var currentSpot = spotSelect.value;
    spotSelect.innerHTML = '<option value="">Alla platser</option>';
    spots.forEach(function (s) {
      spotSelect.innerHTML += '<option value="' + s.id + '">' + utils.esc(s.name) + '</option>';
    });
    spotSelect.value = currentSpot;
  }

  function render() {
    var container = document.getElementById('catch-list');
    var species = document.getElementById('filter-species').value;
    var month = document.getElementById('filter-month').value;
    var spotFilter = document.getElementById('filter-spot').value;

    var filtered = catches.filter(function (c) {
      if (species && c.species.toLowerCase() !== species.toLowerCase()) return false;
      if (month) {
        var m = new Date(c.datetime).getMonth() + 1;
        if (m !== parseInt(month)) return false;
      }
      if (spotFilter) {
        var s = utils.nearestSpot(c.lat, c.lng, spots);
        if (!s || s.id !== spotFilter) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
        '<div class="empty-icon">&#128031;</div>' +
        '<p>Inga fångster ännu</p>' +
        '<p>Tryck på kartan för att logga din första fångst!</p>' +
        '</div>';
      return;
    }

    container.innerHTML = filtered.map(function (c) {
      var spot = utils.nearestSpot(c.lat, c.lng, spots);
      var locName = spot ? utils.esc(spot.name) : '';
      return '<div class="card" onclick="document.dispatchEvent(new CustomEvent(\'show-catch-detail\',{detail:\'' + c.id + '\'}))">' +
        '<div class="card-top">' +
        '<span class="card-species">' + utils.esc(c.species) + '</span>' +
        '<span class="card-date">' + utils.formatDate(c.datetime) + '</span>' +
        '</div>' +
        '<div class="card-details">' +
        (c.lure ? '<span class="card-tag">' + utils.esc(c.lure) + '</span>' : '') +
        (c.length ? '<span>' + c.length + ' cm</span>' : '') +
        (c.weight ? '<span>' + c.weight + ' kg</span>' : '') +
        (locName ? '<span>' + locName + '</span>' : '') +
        '</div>' +
        (c.photo ? '<img class="card-photo" src="' + c.photo + '" alt="Fångstfoto" loading="lazy">' : '') +
        '</div>';
    }).join('');
  }

  function showDetail(id) {
    var c = catches.find(function (item) { return item.id === id; });
    if (!c) return;

    window.FiskeApp.map.closePopup();

    document.getElementById('detail-title').textContent = c.species;

    var spot = utils.nearestSpot(c.lat, c.lng, spots);
    var locationStr = spot ? utils.esc(spot.name) : (c.lat.toFixed(4) + ', ' + c.lng.toFixed(4));

    var html = '<div class="detail-section">' +
      '<h3>Fångst</h3>' +
      '<div class="detail-row"><span class="detail-label">Art</span><span>' + utils.esc(c.species) + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">Datum</span><span>' + utils.formatDate(c.datetime) + '</span></div>' +
      (c.lure ? '<div class="detail-row"><span class="detail-label">Bete</span><span>' + utils.esc(c.lure) + '</span></div>' : '') +
      (c.length ? '<div class="detail-row"><span class="detail-label">Längd</span><span>' + c.length + ' cm</span></div>' : '') +
      (c.weight ? '<div class="detail-row"><span class="detail-label">Vikt</span><span>' + c.weight + ' kg</span></div>' : '') +
      '<div class="detail-row"><span class="detail-label">Plats</span><span>' + locationStr + '</span></div>' +
      '</div>';

    if (c.temp || c.wind || c.pressure) {
      html += '<div class="detail-section">' +
        '<h3>Väder</h3>' +
        (c.temp ? '<div class="detail-row"><span class="detail-label">Temperatur</span><span>' + c.temp + ' °C</span></div>' : '') +
        (c.wind ? '<div class="detail-row"><span class="detail-label">Vind</span><span>' + c.wind + ' m/s</span></div>' : '') +
        (c.pressure ? '<div class="detail-row"><span class="detail-label">Lufttryck</span><span>' + c.pressure + ' hPa</span></div>' : '') +
        '</div>';
    }

    if (c.note) {
      html += '<div class="detail-section">' +
        '<h3>Anteckning</h3>' +
        '<p>' + utils.esc(c.note) + '</p>' +
        '</div>';
    }

    if (c.photo) {
      html += '<div class="detail-section">' +
        '<h3>Foto</h3>' +
        '<img class="detail-photo" src="' + c.photo + '" alt="Fångstfoto">' +
        '</div>';
    }

    html += '<button class="btn btn-danger" id="delete-catch-btn">Ta bort fångst</button>';

    document.getElementById('detail-body').innerHTML = html;
    document.getElementById('detail-modal').classList.add('open');

    /* Ta-bort-knapp */
    document.getElementById('delete-catch-btn').addEventListener('click', function () {
      if (confirm('Vill du ta bort denna fångst?')) {
        db.deleteCatch(c.id).then(function () {
          document.getElementById('detail-modal').classList.remove('open');
          document.dispatchEvent(new CustomEvent('catch-saved'));
        });
      }
    });
  }

  return {
    init: init,
    refresh: refresh
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/catches.js
git commit -m "feat: extrahera fångstlista och detaljer till catches.js

Fångstlista med filter, detaljmodal, ta-bort-funktion.
Använder events för kommunikation med andra moduler."
```

---

### Task 7: spots.js — Platser

Extrahera platslista och platsformulär.

**Files:**
- Create: `js/spots.js`

- [ ] **Step 1: Skapa `js/spots.js`**

```js
/* ===========================
   Platser
   — Lista och formulär för
     namngivna fiskeplatser.
   =========================== */
window.FiskeApp = window.FiskeApp || {};

window.FiskeApp.spots = (function () {
  'use strict';

  var utils = null;
  var db = null;
  var spots = [];
  var catches = [];

  function init() {
    utils = window.FiskeApp.utils;
    db = window.FiskeApp.db;

    /* Lyssna på öppna-plats-event från karta och dashboard */
    document.addEventListener('open-spot-form', function (e) {
      openForm(e.detail, null);
    });

    document.addEventListener('edit-spot', function (e) {
      var spot = spots.find(function (s) { return s.id === e.detail; });
      if (spot) {
        window.FiskeApp.map.closePopup();
        openForm(null, spot);
      }
    });

    /* Formulär */
    document.getElementById('spot-form').addEventListener('submit', function (e) {
      e.preventDefault();
      saveSpot();
    });

    document.getElementById('spot-delete-btn').addEventListener('click', function () {
      var id = document.getElementById('spot-id').value;
      if (id && confirm('Vill du ta bort denna plats?')) {
        db.deleteSpot(id).then(function () {
          closeModal();
          document.dispatchEvent(new CustomEvent('catch-saved'));
        });
      }
    });

    /* Stäng modal */
    document.querySelector('[data-close="spot-modal"]').addEventListener('click', closeModal);
    document.getElementById('spot-modal').addEventListener('click', function (e) {
      if (e.target === this) closeModal();
    });
  }

  function refresh(catchData, spotData) {
    catches = catchData;
    spots = spotData;
    render();
  }

  function render() {
    var container = document.getElementById('spot-list');

    if (spots.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
        '<div class="empty-icon">&#128205;</div>' +
        '<p>Inga sparade platser</p>' +
        '<p>Långtryck på kartan för att spara en plats!</p>' +
        '</div>';
      return;
    }

    container.innerHTML = spots.map(function (s) {
      var catchCount = catches.filter(function (c) {
        return utils.haversine(c.lat, c.lng, s.lat, s.lng) < utils.SPOT_RADIUS;
      }).length;

      return '<div class="card" onclick="document.dispatchEvent(new CustomEvent(\'edit-spot\',{detail:\'' + s.id + '\'}))">' +
        '<div class="spot-card">' +
        '<div class="spot-icon">&#9733;</div>' +
        '<div class="spot-info">' +
        '<div class="spot-name">' + utils.esc(s.name) + '</div>' +
        '<div class="spot-coords">' + s.lat.toFixed(4) + ', ' + s.lng.toFixed(4) +
        ' · ' + catchCount + ' fångster</div>' +
        (s.note ? '<div class="spot-note">' + utils.esc(s.note) + '</div>' : '') +
        '</div></div></div>';
    }).join('');
  }

  function openForm(coords, existingSpot) {
    var form = document.getElementById('spot-form');
    form.reset();

    var deleteBtn = document.getElementById('spot-delete-btn');
    var title = document.getElementById('spot-modal-title');

    if (existingSpot) {
      title.textContent = 'Redigera plats';
      document.getElementById('spot-name').value = existingSpot.name;
      document.getElementById('spot-note').value = existingSpot.note || '';
      document.getElementById('spot-lat').value = existingSpot.lat;
      document.getElementById('spot-lng').value = existingSpot.lng;
      document.getElementById('spot-id').value = existingSpot.id;
      deleteBtn.style.display = 'block';
    } else {
      title.textContent = 'Spara plats';
      document.getElementById('spot-lat').value = coords.lat;
      document.getElementById('spot-lng').value = coords.lng;
      document.getElementById('spot-id').value = '';
      deleteBtn.style.display = 'none';
    }

    document.getElementById('spot-modal').classList.add('open');
  }

  function saveSpot() {
    var id = document.getElementById('spot-id').value;

    if (id) {
      var spot = spots.find(function (s) { return s.id === id; });
      if (spot) {
        spot.name = document.getElementById('spot-name').value.trim();
        spot.note = document.getElementById('spot-note').value.trim();
        db.updateSpot(spot).then(function () {
          closeModal();
          document.dispatchEvent(new CustomEvent('catch-saved'));
        });
      }
    } else {
      var newSpot = {
        id: utils.uid(),
        name: document.getElementById('spot-name').value.trim(),
        note: document.getElementById('spot-note').value.trim(),
        lat: parseFloat(document.getElementById('spot-lat').value),
        lng: parseFloat(document.getElementById('spot-lng').value)
      };
      db.saveSpot(newSpot).then(function () {
        closeModal();
        document.dispatchEvent(new CustomEvent('catch-saved'));
      });
    }
  }

  function closeModal() {
    document.getElementById('spot-modal').classList.remove('open');
  }

  return {
    init: init,
    refresh: refresh
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/spots.js
git commit -m "feat: extrahera platslista och formulär till spots.js

Platslista, skapa/redigera/ta bort platser.
Lyssnar på events från karta och andra moduler."
```

---

### Task 8: stats.js — Utökad statistik

Ny statistikvy med drag-analys, plats-analys och tidsfilter.

**Files:**
- Create: `js/stats.js`

- [ ] **Step 1: Skapa `js/stats.js`**

```js
/* ===========================
   Statistik
   — Sammanfattning, drag-analys
     och plats-analys med
     expanderbara rader och
     tidsfilter.
   =========================== */
window.FiskeApp = window.FiskeApp || {};

window.FiskeApp.stats = (function () {
  'use strict';

  var utils = null;
  var db = null;
  var allCatches = [];
  var spots = [];

  function init() {
    utils = window.FiskeApp.utils;
    db = window.FiskeApp.db;

    document.getElementById('filter-period').addEventListener('change', render);

    document.getElementById('export-btn').addEventListener('click', function () {
      db.exportAll().then(function (data) {
        var exportData = {
          exported: new Date().toISOString(),
          catches: data.catches,
          spots: data.spots
        };
        var blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'fiskeapp-export-' + new Date().toISOString().slice(0, 10) + '.json';
        a.click();
        URL.revokeObjectURL(url);
      });
    });
  }

  function refresh(catchData, spotData) {
    allCatches = catchData;
    spots = spotData;
    render();
  }

  /* Filtrera fångster baserat på tidsperiod */
  function getFilteredCatches() {
    var period = document.getElementById('filter-period').value;
    if (!period) return allCatches;

    var now = new Date();
    var cutoff;

    if (period === 'month') {
      cutoff = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === '3months') {
      cutoff = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    } else if (period === 'year') {
      cutoff = new Date(now.getFullYear(), 0, 1);
    }

    return allCatches.filter(function (c) {
      return new Date(c.datetime) >= cutoff;
    });
  }

  function render() {
    var catches = getFilteredCatches();
    renderSummary(catches);
    renderLureAnalysis(catches);
    renderSpotAnalysis(catches);
  }

  /* Sammanfattningskort */
  function renderSummary(catches) {
    var total = catches.length;

    var speciesCount = {};
    var lureCount = {};
    var spotCount = {};

    catches.forEach(function (c) {
      speciesCount[c.species.toLowerCase()] = (speciesCount[c.species.toLowerCase()] || 0) + 1;
      if (c.lure) {
        lureCount[c.lure.toLowerCase()] = (lureCount[c.lure.toLowerCase()] || 0) + 1;
      }
      var s = utils.nearestSpot(c.lat, c.lng, spots);
      if (s) {
        spotCount[s.name] = (spotCount[s.name] || 0) + 1;
      }
    });

    var topSpecies = topEntry(speciesCount);
    var topLure = topEntry(lureCount);
    var topSpot = topEntry(spotCount);

    document.getElementById('stats-summary').innerHTML =
      '<div class="stat-card">' +
      '<div class="stat-value">' + total + '</div>' +
      '<div class="stat-label">Totala fångster</div>' +
      '</div>' +
      '<div class="stat-card">' +
      '<div class="stat-value">' + (topSpecies ? utils.esc(topSpecies[0]) : '—') + '</div>' +
      '<div class="stat-label">Vanligaste art' + (topSpecies ? ' (' + topSpecies[1] + ')' : '') + '</div>' +
      '</div>' +
      '<div class="stat-card">' +
      '<div class="stat-value">' + (topLure ? utils.esc(topLure[0]) : '—') + '</div>' +
      '<div class="stat-label">Bästa drag' + (topLure ? ' (' + topLure[1] + ')' : '') + '</div>' +
      '</div>' +
      '<div class="stat-card">' +
      '<div class="stat-value">' + (topSpot ? utils.esc(topSpot[0]) : '—') + '</div>' +
      '<div class="stat-label">Bästa plats' + (topSpot ? ' (' + topSpot[1] + ')' : '') + '</div>' +
      '</div>';
  }

  /* Drag-analys med expanderbara rader */
  function renderLureAnalysis(catches) {
    var container = document.getElementById('stats-lure');

    /* Gruppera per bete */
    var lures = {};
    catches.forEach(function (c) {
      if (!c.lure) return;
      var key = c.lure.toLowerCase();
      if (!lures[key]) {
        lures[key] = { name: c.lure, catches: [], totalLength: 0, lengthCount: 0 };
      }
      lures[key].catches.push(c);
      if (c.length) {
        lures[key].totalLength += c.length;
        lures[key].lengthCount++;
      }
    });

    var sorted = Object.values(lures).sort(function (a, b) {
      return b.catches.length - a.catches.length;
    });

    if (sorted.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><p>Ingen drag-data ännu</p></div>';
      return;
    }

    container.innerHTML = '<h3 class="stats-section-title">Drag-analys</h3>' +
      sorted.map(function (lure) {
        var avgLength = lure.lengthCount > 0 ? Math.round(lure.totalLength / lure.lengthCount) : null;

        /* Arter per drag */
        var speciesBreakdown = {};
        lure.catches.forEach(function (c) {
          var sp = c.species.toLowerCase();
          if (!speciesBreakdown[sp]) {
            speciesBreakdown[sp] = { name: c.species, count: 0, totalLength: 0, lengthCount: 0 };
          }
          speciesBreakdown[sp].count++;
          if (c.length) {
            speciesBreakdown[sp].totalLength += c.length;
            speciesBreakdown[sp].lengthCount++;
          }
        });

        var speciesList = Object.values(speciesBreakdown).sort(function (a, b) {
          return b.count - a.count;
        });

        var detailHtml = speciesList.map(function (sp) {
          var spAvg = sp.lengthCount > 0 ? Math.round(sp.totalLength / sp.lengthCount) : null;
          return '<div class="expand-row">' +
            '<span class="expand-label">' + utils.esc(sp.name) + '</span>' +
            '<span>' + sp.count + ' st' + (spAvg ? ' · snitt ' + spAvg + 'cm' : '') + '</span>' +
            '</div>';
        }).join('');

        return '<div class="expandable-card">' +
          '<div class="expandable-header" onclick="this.parentElement.classList.toggle(\'expanded\')">' +
          '<span class="expandable-title">' + utils.esc(lure.name) + '</span>' +
          '<div class="expandable-meta">' +
          '<span>' + lure.catches.length + ' fångster' + (avgLength ? ' · snitt ' + avgLength + 'cm' : '') + '</span>' +
          '<span class="expand-arrow">▶</span>' +
          '</div>' +
          '</div>' +
          '<div class="expandable-body">' + detailHtml + '</div>' +
          '</div>';
      }).join('');
  }

  /* Plats-analys med expanderbara rader */
  function renderSpotAnalysis(catches) {
    var container = document.getElementById('stats-spots');

    /* Gruppera per plats */
    var spotData = {};
    catches.forEach(function (c) {
      var s = utils.nearestSpot(c.lat, c.lng, spots);
      if (!s) return;
      if (!spotData[s.id]) {
        spotData[s.id] = { name: s.name, catches: [] };
      }
      spotData[s.id].catches.push(c);
    });

    var sorted = Object.values(spotData).sort(function (a, b) {
      return b.catches.length - a.catches.length;
    });

    if (sorted.length === 0) {
      container.innerHTML =
        '<div class="empty-state"><p>Ingen plats-data ännu. Spara platser på kartan!</p></div>';
      return;
    }

    var monthNames = ['', 'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
      'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];

    container.innerHTML = '<h3 class="stats-section-title">Plats-analys</h3>' +
      sorted.map(function (spotInfo) {
        /* Vanligaste art */
        var speciesCount = {};
        var lureCount = {};
        var monthCount = {};

        spotInfo.catches.forEach(function (c) {
          var sp = c.species.toLowerCase();
          speciesCount[sp] = { name: c.species, count: (speciesCount[sp] ? speciesCount[sp].count : 0) + 1 };

          if (c.lure) {
            var lr = c.lure.toLowerCase();
            lureCount[lr] = { name: c.lure, count: (lureCount[lr] ? lureCount[lr].count : 0) + 1 };
          }

          var m = new Date(c.datetime).getMonth() + 1;
          monthCount[m] = (monthCount[m] || 0) + 1;
        });

        var topSp = topEntry(objToCountMap(speciesCount));
        var topLr = topEntry(objToCountMap(lureCount));
        var topMonth = topEntry(monthCount);

        var detailHtml =
          (topSp ? '<div class="expand-row"><span class="expand-label">Vanligaste art</span><span>' + utils.esc(topSp[0]) + ' (' + topSp[1] + ')</span></div>' : '') +
          (topLr ? '<div class="expand-row"><span class="expand-label">Bästa drag</span><span>' + utils.esc(topLr[0]) + ' (' + topLr[1] + ')</span></div>' : '') +
          (topMonth ? '<div class="expand-row"><span class="expand-label">Bästa månad</span><span>' + monthNames[parseInt(topMonth[0])] + ' (' + topMonth[1] + ')</span></div>' : '');

        return '<div class="expandable-card">' +
          '<div class="expandable-header" onclick="this.parentElement.classList.toggle(\'expanded\')">' +
          '<span class="expandable-title">' + utils.esc(spotInfo.name) + '</span>' +
          '<div class="expandable-meta">' +
          '<span>' + spotInfo.catches.length + ' fångster</span>' +
          '<span class="expand-arrow">▶</span>' +
          '</div>' +
          '</div>' +
          '<div class="expandable-body">' + detailHtml + '</div>' +
          '</div>';
      }).join('');
  }

  /* Hjälpfunktion: konvertera {key: {name, count}} till {name: count} */
  function objToCountMap(obj) {
    var result = {};
    Object.values(obj).forEach(function (v) {
      result[v.name] = v.count;
    });
    return result;
  }

  function topEntry(obj) {
    var entries = Object.entries(obj);
    if (entries.length === 0) return null;
    entries.sort(function (a, b) { return b[1] - a[1]; });
    return entries[0];
  }

  return {
    init: init,
    refresh: refresh
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/stats.js
git commit -m "feat: utökad statistik med drag- och plats-analys

Sammanfattningskort, drag-analys (grupperad per bete med
arter och snitt-storlek), plats-analys (bästa art/drag/månad
per plats). Tidsfilter och export."
```

---

### Task 9: home.js — Dashboard

Ny startsida med översikt, snabbknappar, senaste fångster och mini-karta.

**Files:**
- Create: `js/home.js`

- [ ] **Step 1: Skapa `js/home.js`**

```js
/* ===========================
   Dashboard (Hem-vy)
   — Startsida med översikt,
     snabbknappar, senaste
     fångster och mini-karta.
   =========================== */
window.FiskeApp = window.FiskeApp || {};

window.FiskeApp.home = (function () {
  'use strict';

  var utils = null;
  var db = null;
  var miniMap = null;

  function init() {
    utils = window.FiskeApp.utils;
    db = window.FiskeApp.db;

    /* Snabbknappar */
    document.getElementById('home-log-catch').addEventListener('click', function () {
      /* Använd GPS-position */
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(function (pos) {
          document.dispatchEvent(new CustomEvent('open-catch-form', {
            detail: { lat: pos.coords.latitude, lng: pos.coords.longitude }
          }));
        }, function () {
          /* Fallback: öppna med kartcentrum */
          document.dispatchEvent(new CustomEvent('open-catch-form', {
            detail: { lat: 60.2, lng: 20.0 }
          }));
        });
      }
    });

    document.getElementById('home-save-spot').addEventListener('click', function () {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(function (pos) {
          document.dispatchEvent(new CustomEvent('open-spot-form', {
            detail: { lat: pos.coords.latitude, lng: pos.coords.longitude }
          }));
        }, function () {
          document.dispatchEvent(new CustomEvent('open-spot-form', {
            detail: { lat: 60.2, lng: 20.0 }
          }));
        });
      }
    });

    document.getElementById('home-open-map').addEventListener('click', function () {
      document.dispatchEvent(new CustomEvent('navigate', { detail: 'map' }));
    });

    /* Hämta väder för headern */
    fetchWeatherForHeader();
  }

  function refresh(catches, spots) {
    renderGreeting();
    renderSummary(catches, spots);
    renderRecentCatches(catches, spots);
    renderMiniMap(catches);
  }

  function renderGreeting() {
    document.getElementById('home-greeting').textContent = utils.greeting();
  }

  function fetchWeatherForHeader() {
    if (!('geolocation' in navigator)) return;
    navigator.geolocation.getCurrentPosition(function (pos) {
      var url = 'https://api.open-meteo.com/v1/forecast' +
        '?latitude=' + pos.coords.latitude.toFixed(4) +
        '&longitude=' + pos.coords.longitude.toFixed(4) +
        '&current=temperature_2m,wind_speed_10m';

      fetch(url)
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.current) {
            document.getElementById('home-weather').innerHTML =
              '<span>' + data.current.temperature_2m + '°C</span>' +
              '<span>' + data.current.wind_speed_10m + ' m/s</span>';
          }
        })
        .catch(function () { /* ignorera */ });
    }, function () { /* GPS ej tillgänglig */ });
  }

  function renderSummary(catches, spots) {
    /* Bästa drag */
    var lureCount = {};
    catches.forEach(function (c) {
      if (c.lure) {
        var key = c.lure.toLowerCase();
        lureCount[key] = { name: c.lure, count: (lureCount[key] ? lureCount[key].count : 0) + 1 };
      }
    });
    var bestLure = '—';
    var bestCount = 0;
    Object.values(lureCount).forEach(function (l) {
      if (l.count > bestCount) {
        bestCount = l.count;
        bestLure = l.name;
      }
    });

    document.getElementById('home-catch-count').textContent = catches.length;
    document.getElementById('home-spot-count').textContent = spots.length;
    document.getElementById('home-best-lure').textContent = bestLure;
  }

  function renderRecentCatches(catches, spots) {
    var container = document.getElementById('home-recent');
    var recent = catches.slice(0, 5);

    if (recent.length === 0) {
      container.innerHTML =
        '<div class="empty-state" style="padding:20px;">' +
        '<p>Inga fångster ännu</p>' +
        '</div>';
      return;
    }

    container.innerHTML = recent.map(function (c) {
      return '<div class="home-catch-item" onclick="document.dispatchEvent(new CustomEvent(\'show-catch-detail\',{detail:\'' + c.id + '\'}))">' +
        '<div class="home-catch-info">' +
        '<span class="home-catch-species">' + utils.esc(c.species) + '</span>' +
        '<span class="home-catch-meta">' +
        (c.length ? c.length + ' cm · ' : '') +
        utils.esc(c.lure || '') +
        '</span>' +
        '</div>' +
        '<span class="home-catch-time">' + utils.timeAgo(c.datetime) + '</span>' +
        '</div>';
    }).join('');
  }

  function renderMiniMap(catches) {
    var container = document.getElementById('home-minimap');

    /* Rensa eventuell befintlig mini-karta */
    if (miniMap) {
      miniMap.remove();
      miniMap = null;
    }

    if (catches.length === 0) {
      container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:13px;">Karta visas när du har fångster</div>';
      return;
    }

    container.innerHTML = '';
    miniMap = window.FiskeApp.map.createMiniMap('home-minimap', catches);

    /* Klick navigerar till kartan */
    container.addEventListener('click', function () {
      document.dispatchEvent(new CustomEvent('navigate', { detail: 'map' }));
    });
  }

  return {
    init: init,
    refresh: refresh
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/home.js
git commit -m "feat: lägg till dashboard-vy (hem-sida)

Startsida med hälsning, väder, snabbknappar,
sammanfattning, senaste fångster och mini-karta."
```

---

### Task 10: app.js — Orkestrator

Skriv om `app.js` till en tunn orkestrator som initierar moduler och kopplar ihop events.

**Files:**
- Rewrite: `js/app.js`

- [ ] **Step 1: Skriv om `js/app.js`**

```js
/* ===========================
   FiskeApp — Orkestrator
   — Initierar alla moduler,
     kopplar ihop events och
     registrerar service worker.
   =========================== */
(function () {
  'use strict';

  var db = window.FiskeApp.db;
  var router = window.FiskeApp.router;
  var home = window.FiskeApp.home;
  var map = window.FiskeApp.map;
  var catchForm = window.FiskeApp.catchForm;
  var catches = window.FiskeApp.catches;
  var stats = window.FiskeApp.stats;
  var spots = window.FiskeApp.spots;

  /* Hämta all data och uppdatera alla vyer */
  function refreshAll() {
    Promise.all([db.getAllCatches(), db.getAllSpots()]).then(function (results) {
      var catchData = results[0];
      var spotData = results[1];

      home.refresh(catchData, spotData);
      map.loadMarkers(catchData, spotData);
      catches.refresh(catchData, spotData);
      stats.refresh(catchData, spotData);
      spots.refresh(catchData, spotData);
    });
  }

  /* Lyssna på data-ändringar */
  document.addEventListener('catch-saved', refreshAll);

  /* Uppdatera kartans storlek vid flikbyte */
  document.addEventListener('view-changed', function (e) {
    if (e.detail === 'map') {
      map.invalidateSize();
    }
  });

  /* Registrera service worker */
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js');
    }
  }

  /* Starta appen */
  function init() {
    registerSW();

    db.init().then(function () {
      router.init();
      map.init();
      catchForm.init();
      catches.init();
      stats.init();
      spots.init();
      home.init();

      refreshAll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

- [ ] **Step 2: Commit**

```bash
git add js/app.js
git commit -m "refactor: skriv om app.js till tunn orkestrator

Initierar alla moduler i rätt ordning.
Kopplar ihop catch-saved event med refreshAll.
Hanterar view-changed för kartuppdatering."
```

---

### Task 11: index.html — Ny HTML-struktur

Uppdatera HTML med dashboard-vy, steg-formulär, 5 flikar och alla script-taggar.

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Uppdatera `index.html`**

Ersätt hela innehållet i `index.html` med:

```html
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#00b4d8">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="description" content="Logga dina fångster, spara fiskeplatser och se statistik.">
  <title>FiskeApp</title>

  <!-- Manifest för PWA-installation -->
  <link rel="manifest" href="manifest.json">
  <link rel="icon" href="images/icon.svg" type="image/svg+xml">
  <link rel="apple-touch-icon" href="images/icon.svg">

  <!-- Leaflet -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css">
  <link rel="stylesheet" href="https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css">

  <link rel="stylesheet" href="css/style.css">
</head>
<body>

<div id="app">

  <!-- ========== Dashboard (Hem) ========== -->
  <div id="view-home" class="view active">
    <div class="home-header">
      <div class="home-header-left">
        <span id="home-greeting" class="home-greeting">God eftermiddag</span>
        <span class="home-title">FiskeApp</span>
      </div>
      <div id="home-weather" class="home-weather">
        <span>—</span>
      </div>
    </div>

    <!-- Snabbknappar -->
    <div class="home-actions">
      <button id="home-log-catch" class="home-action-btn home-action-primary">
        <span class="home-action-icon">&#128031;</span>
        <span>Logga fångst</span>
      </button>
      <button id="home-save-spot" class="home-action-btn">
        <span class="home-action-icon">&#128205;</span>
        <span>Spara plats</span>
      </button>
      <button id="home-open-map" class="home-action-btn">
        <span class="home-action-icon">&#128506;</span>
        <span>Visa karta</span>
      </button>
    </div>

    <!-- Sammanfattning -->
    <div class="home-summary">
      <div class="home-stat">
        <span id="home-catch-count" class="home-stat-value">0</span>
        <span class="home-stat-label">Fångster</span>
      </div>
      <div class="home-stat">
        <span id="home-spot-count" class="home-stat-value">0</span>
        <span class="home-stat-label">Platser</span>
      </div>
      <div class="home-stat">
        <span id="home-best-lure" class="home-stat-value home-stat-text">—</span>
        <span class="home-stat-label">Bästa drag</span>
      </div>
    </div>

    <!-- Senaste fångster -->
    <div class="home-section">
      <h2 class="home-section-title">Senaste fångster</h2>
      <div id="home-recent"></div>
    </div>

    <!-- Mini-karta -->
    <div class="home-section">
      <div id="home-minimap" class="home-minimap"></div>
    </div>
  </div>

  <!-- ========== Kartvy ========== -->
  <div id="view-map" class="view">
    <div id="map"></div>
    <div id="map-hint" class="map-hint">Tryck = ny fångst · Långtryck = ny plats</div>
    <button id="locate-btn" aria-label="Min position">&#9678;</button>
  </div>

  <!-- ========== Statistik ========== -->
  <div id="view-stats" class="view">
    <div class="list-header">
      <h1>Statistik</h1>
      <div class="filters">
        <select id="filter-period">
          <option value="">Alla tider</option>
          <option value="month">Denna månad</option>
          <option value="3months">Senaste 3 mån</option>
          <option value="year">I år</option>
        </select>
      </div>
    </div>
    <div class="list-content">
      <div id="stats-summary" class="stats-grid"></div>
      <div id="stats-lure"></div>
      <div id="stats-spots"></div>
      <div class="export-section">
        <button id="export-btn" class="btn btn-secondary">Exportera data (JSON)</button>
      </div>
    </div>
  </div>

  <!-- ========== Fångstlista ========== -->
  <div id="view-catches" class="view">
    <div class="list-header">
      <h1>Fångster</h1>
      <div class="filters">
        <select id="filter-species"><option value="">Alla arter</option></select>
        <select id="filter-month"><option value="">Alla månader</option></select>
        <select id="filter-spot"><option value="">Alla platser</option></select>
      </div>
    </div>
    <div id="catch-list" class="list-content"></div>
  </div>

  <!-- ========== Sparade platser ========== -->
  <div id="view-spots" class="view">
    <div class="list-header">
      <h1>Platser</h1>
    </div>
    <div id="spot-list" class="list-content"></div>
  </div>

</div>

<!-- ========== Bottomnavigation ========== -->
<nav id="bottom-nav">
  <button class="nav-tab active" data-view="home">
    <span class="nav-icon">&#127968;</span>
    Hem
  </button>
  <button class="nav-tab" data-view="map">
    <span class="nav-icon">&#127758;</span>
    Karta
  </button>
  <button class="nav-tab" data-view="stats">
    <span class="nav-icon">&#128202;</span>
    Statistik
  </button>
  <button class="nav-tab" data-view="catches">
    <span class="nav-icon">&#128031;</span>
    Fångster
  </button>
  <button class="nav-tab" data-view="spots">
    <span class="nav-icon">&#128205;</span>
    Platser
  </button>
</nav>

<!-- ========== Steg-för-steg fångstformulär ========== -->
<div id="step-form-overlay" class="modal-overlay">
  <div class="modal step-form-modal">
    <div class="modal-header">
      <button id="step-form-close" class="modal-close">&times;</button>
      <h2>Logga fångst</h2>
      <div class="step-progress">
        <span class="step-dot current active"></span>
        <span class="step-dot"></span>
        <span class="step-dot"></span>
        <span class="step-dot"></span>
      </div>
    </div>
    <div class="modal-body">

      <!-- Steg 1: Art -->
      <div id="step-1" class="step-content">
        <div class="step-field">
          <label for="step-species">Vilken art?</label>
          <input type="text" id="step-species" list="species-suggestions" placeholder="t.ex. gädda, abborre" autocomplete="off">
          <datalist id="species-suggestions"></datalist>
        </div>
        <button id="step-next-1" class="btn btn-primary">Nästa →</button>
      </div>

      <!-- Steg 2: Bete -->
      <div id="step-2" class="step-content" style="display:none;">
        <button id="step-back-2" class="step-back">← Tillbaka</button>
        <div class="step-field">
          <label for="step-lure">Vilket bete / metod?</label>
          <input type="text" id="step-lure" list="lure-suggestions" placeholder="t.ex. jigg, wobbler" autocomplete="off">
          <datalist id="lure-suggestions"></datalist>
        </div>
        <button id="step-next-2" class="btn btn-primary">Nästa →</button>
      </div>

      <!-- Steg 3: Datum & tid -->
      <div id="step-3" class="step-content" style="display:none;">
        <button id="step-back-3" class="step-back">← Tillbaka</button>
        <div class="step-field">
          <label for="step-datetime">Datum & tid</label>
          <input type="datetime-local" id="step-datetime">
        </div>
        <button id="step-next-3" class="btn btn-primary">Nästa →</button>
      </div>

      <!-- Steg 4: Valfritt -->
      <div id="step-4" class="step-content" style="display:none;">
        <button id="step-back-4" class="step-back">← Tillbaka</button>
        <div class="step-field">
          <label for="step-length">Längd (cm)</label>
          <input type="number" id="step-length" min="0" step="1" placeholder="Valfritt">
        </div>
        <div class="step-field">
          <label for="step-weight">Vikt (kg)</label>
          <input type="number" id="step-weight" min="0" step="0.1" placeholder="Valfritt">
        </div>
        <div class="step-field">
          <label>Foto</label>
          <div class="photo-upload">
            <label for="step-photo">&#128247; Välj bild</label>
            <input type="file" id="step-photo" accept="image/*" capture="environment">
            <img id="step-photo-preview" class="photo-preview" alt="Förhandsgranskning">
          </div>
        </div>
        <div class="step-field">
          <label for="step-note">Anteckning</label>
          <textarea id="step-note" rows="2" placeholder="Valfri anteckning..."></textarea>
        </div>
        <button id="step-save" class="btn btn-primary">Spara fångst</button>
      </div>

    </div>
  </div>
</div>

<!-- ========== Modal: Ny/Redigera plats ========== -->
<div id="spot-modal" class="modal-overlay">
  <div class="modal">
    <div class="modal-header">
      <h2 id="spot-modal-title">Spara plats</h2>
      <button class="modal-close" data-close="spot-modal">&times;</button>
    </div>
    <div class="modal-body">
      <form id="spot-form">
        <div class="form-group">
          <label for="spot-name">Namn *</label>
          <input type="text" id="spot-name" required placeholder="t.ex. Vassviken norra">
        </div>
        <div class="form-group">
          <label for="spot-note">Anteckning</label>
          <textarea id="spot-note" rows="3" placeholder="t.ex. fiska parallellt med vasslinjen"></textarea>
        </div>
        <input type="hidden" id="spot-lat">
        <input type="hidden" id="spot-lng">
        <input type="hidden" id="spot-id">
        <button type="submit" class="btn btn-primary">Spara plats</button>
        <button type="button" id="spot-delete-btn" class="btn btn-danger" style="display:none;">Ta bort plats</button>
      </form>
    </div>
  </div>
</div>

<!-- ========== Modal: Fångstdetaljer ========== -->
<div id="detail-modal" class="modal-overlay">
  <div class="modal">
    <div class="modal-header">
      <h2 id="detail-title">Detaljer</h2>
      <button class="modal-close" data-close="detail-modal">&times;</button>
    </div>
    <div id="detail-body" class="modal-body"></div>
  </div>
</div>

<!-- Leaflet JS -->
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"></script>

<!-- Applikationsmoduler (ordningen är viktig) -->
<script src="js/utils.js"></script>
<script src="js/db.js"></script>
<script src="js/router.js"></script>
<script src="js/home.js"></script>
<script src="js/map.js"></script>
<script src="js/catch-form.js"></script>
<script src="js/catches.js"></script>
<script src="js/stats.js"></script>
<script src="js/spots.js"></script>
<script src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: uppdatera HTML med dashboard, steg-formulär och 5 flikar

Ny dashboard-vy som startsida, steg-för-steg fångstformulär,
5 flikar i bottomnav (Hem, Karta, Statistik, Fångster, Platser).
Alla moduler laddas som separata script-taggar."
```

---

### Task 12: style.css — Nya stilar

Lägg till CSS för dashboard, steg-formulär, expanderbara rader och toast.

**Files:**
- Modify: `css/style.css`

- [ ] **Step 1: Lägg till nya CSS-sektioner i slutet av `style.css`**

Lägg till följande efter den sista befintliga sektionen (före `@media`-blocket):

```css
/* ===========================
   Dashboard (Hem-vy)
   — Startsida med översikt
     och snabba genvägar
   =========================== */

.home-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--bg-card);
}

.home-header-left {
  display: flex;
  flex-direction: column;
}

.home-greeting {
  font-size: 12px;
  color: var(--text-muted);
}

.home-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--accent);
}

.home-weather {
  display: flex;
  gap: 10px;
  font-size: 12px;
  color: var(--text-muted);
}

.home-actions {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
}

.home-action-btn {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 8px;
  background: var(--bg-input);
  border: none;
  border-radius: var(--radius);
  color: var(--text-muted);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
}

.home-action-primary {
  background: var(--accent);
  color: #fff;
}

.home-action-icon {
  font-size: 22px;
}

.home-summary {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
}

.home-stat {
  flex: 1;
  background: var(--bg-card);
  padding: 12px;
  border-radius: var(--radius);
  text-align: center;
}

.home-stat-value {
  display: block;
  font-size: 22px;
  font-weight: 700;
  color: var(--accent);
}

.home-stat-text {
  font-size: 13px;
}

.home-stat-label {
  display: block;
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
}

.home-section {
  padding: 0 16px 12px;
}

.home-section-title {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.home-catch-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--bg-card);
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 6px;
  cursor: pointer;
}

.home-catch-item:active {
  background: var(--bg-input);
}

.home-catch-info {
  display: flex;
  flex-direction: column;
}

.home-catch-species {
  font-weight: 600;
  font-size: 14px;
}

.home-catch-meta {
  font-size: 11px;
  color: var(--text-muted);
}

.home-catch-time {
  font-size: 11px;
  color: var(--text-muted);
}

.home-minimap {
  height: 120px;
  border-radius: var(--radius);
  overflow: hidden;
  cursor: pointer;
  background: var(--bg-card);
}

/* ===========================
   Steg-formulär
   — Fullskärmsmodal med ett
     fält per steg
   =========================== */

.step-form-modal {
  max-height: 100vh;
  height: 100%;
  border-radius: 0;
}

.step-progress {
  display: flex;
  gap: 6px;
  margin-left: auto;
}

.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--bg-input);
}

.step-dot.active {
  background: var(--accent-dim);
}

.step-dot.current {
  background: var(--accent);
}

.step-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-top: 16px;
}

.step-field label {
  display: block;
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
}

.step-field input,
.step-field textarea {
  width: 100%;
  padding: 14px 16px;
  background: var(--bg-input);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 16px;
  font-family: inherit;
  outline: none;
}

.step-field input:focus,
.step-field textarea:focus {
  border-color: var(--accent);
}

.step-back {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  align-self: flex-start;
  font-family: inherit;
}

/* ===========================
   Expanderbara kort
   — Används i statistikvyn
     för drag- och platsanalys
   =========================== */

.stats-section-title {
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 16px 0 8px;
}

.expandable-card {
  background: var(--bg-card);
  border-radius: var(--radius);
  margin-bottom: 6px;
  overflow: hidden;
}

.expandable-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  cursor: pointer;
}

.expandable-header:active {
  background: var(--bg-input);
}

.expandable-title {
  font-weight: 600;
  font-size: 14px;
}

.expandable-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.expand-arrow {
  font-size: 10px;
  transition: transform 0.2s;
}

.expandable-card.expanded .expand-arrow {
  transform: rotate(90deg);
}

.expandable-body {
  display: none;
  padding: 0 14px 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.expandable-card.expanded .expandable-body {
  display: block;
}

.expand-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 13px;
}

.expand-label {
  color: var(--text-muted);
}

/* ===========================
   Toast-notiser
   — Meddelanden som visas
     tillfälligt längst ner
   =========================== */

.toast {
  position: fixed;
  bottom: calc(var(--nav-height) + var(--safe-bottom) + 16px);
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: var(--bg-card);
  color: var(--text);
  padding: 12px 20px;
  border-radius: 8px;
  font-size: 14px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
  z-index: 3000;
  opacity: 0;
  transition: opacity 0.3s, transform 0.3s;
  white-space: nowrap;
}

.toast.visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.toast-action {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toast-btn {
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}
```

- [ ] **Step 2: Flytta `@media`-blocket så det ligger sist**

Se till att `@media (min-width: 600px)`-blocket fortfarande ligger allra sist i filen.

- [ ] **Step 3: Commit**

```bash
git add css/style.css
git commit -m "feat: lägg till CSS för dashboard, steg-formulär, expanderbara kort och toast

Dashboard-header, snabbknappar, sammanfattning, senaste fångster,
mini-karta. Steg-formulär med progress-prickar. Expanderbara
statistikkort. Toast-notiser för migrering och backup."
```

---

### Task 13: sw.js — Uppdatera service worker

Uppdatera cache-namn och lägg till nya filer.

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Uppdatera `sw.js`**

Ändra `CACHE_NAME` och `APP_SHELL`:

```js
const CACHE_NAME = 'fiskeapp-v2';

const APP_SHELL = [
  './',
  './index.html',
  './css/style.css',
  './js/utils.js',
  './js/db.js',
  './js/router.js',
  './js/home.js',
  './js/map.js',
  './js/catch-form.js',
  './js/catches.js',
  './js/stats.js',
  './js/spots.js',
  './js/app.js',
  './manifest.json',
  './images/icon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css',
  'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js'
];
```

Resten av `sw.js` (install, activate, fetch) förblir oförändrat.

- [ ] **Step 2: Commit**

```bash
git add sw.js
git commit -m "feat: uppdatera service worker med nya JS-moduler

Bumpar CACHE_NAME till v2 och lägger till alla nya
JS-filer i APP_SHELL för offline-stöd."
```

---

### Task 14: Manuell test och slutverifiering

Testa att hela appen fungerar.

- [ ] **Step 1: Starta en lokal server**

```bash
npx serve . -l 3000
```

Öppna http://localhost:3000 i webbläsaren.

- [ ] **Step 2: Verifiera dashboard**

- Dashboard visas som startsida
- Hälsningsfras visas (God morgon/eftermiddag/kväll)
- Tre snabbknappar syns
- Nyckeltal visar 0 fångster, 0 platser
- "Inga fångster ännu" visas i senaste-sektionen

- [ ] **Step 3: Verifiera loggningsflöde**

- Klicka "Logga fångst" på dashboard
- Steg 1: Skriv art → Nästa
- Steg 2: Skriv bete → Nästa
- Steg 3: Datum förifyllt → Nästa
- Steg 4: Hoppa över valfria fält → Spara
- Fångsten syns i dashboard och på kartan

- [ ] **Step 4: Verifiera karta**

- Byt till kartfliken
- Klicka på kartan → steg-formulär öppnas
- Långtryck → platsformulär öppnas
- Positionsknappen fungerar

- [ ] **Step 5: Verifiera statistik**

- Byt till statistikfliken
- Sammanfattningskort visar data
- Drag-analys: expandera en rad
- Plats-analys: expandera en rad
- Tidsfilter fungerar

- [ ] **Step 6: Verifiera localStorage-migrering**

Öppna DevTools → Application → IndexedDB → fiskeapp
Kontrollera att catches och spots finns som object stores.

- [ ] **Step 7: Slutlig commit**

```bash
git add -A
git commit -m "chore: slutverifiering av UI-uppgradering

Alla vyer, loggningsflöde, statistik och IndexedDB-lagring
fungerar som förväntat."
```

---

### Task 15: Pusha till GitHub

- [ ] **Step 1: Pusha alla ändringar**

```bash
git push origin master
```
