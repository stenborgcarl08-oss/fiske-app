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

  /* Toast-notis */
  function showToast(message) {
    var existing = document.querySelector('.toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

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
