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
