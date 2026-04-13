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
