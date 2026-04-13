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
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(function (pos) {
          document.dispatchEvent(new CustomEvent('open-catch-form', {
            detail: { lat: pos.coords.latitude, lng: pos.coords.longitude }
          }));
        }, function () {
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

    container.addEventListener('click', function () {
      document.dispatchEvent(new CustomEvent('navigate', { detail: 'map' }));
    });
  }

  return {
    init: init,
    refresh: refresh
  };
})();
