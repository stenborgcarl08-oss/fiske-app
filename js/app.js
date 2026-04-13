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
