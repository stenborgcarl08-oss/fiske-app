/* =============================================================
   FiskeApp — Huvudskript
   Hanterar karta, fångster, platser, statistik och datalagring.
   All data sparas i localStorage för att fungera offline.
   ============================================================= */
(function () {
  'use strict';

  /* ===========================
     Konstanter
     =========================== */
  var CATCH_KEY = 'fiskeapp_catches';
  var SPOT_KEY = 'fiskeapp_spots';
  var MAP_CENTER = [60.2, 20.0];
  var MAP_ZOOM = 11;
  /* Avstånd i meter för att koppla en fångst till en namngiven plats */
  var SPOT_RADIUS = 300;

  /* ===========================
     Applikationstillstånd
     — Centralt objekt med all
       data och kartreferenser
     =========================== */
  var state = {
    catches: load(CATCH_KEY),
    spots: load(SPOT_KEY),
    map: null,
    catchCluster: null,
    spotLayer: null
  };

  /* ===========================
     Datahantering (localStorage)
     =========================== */
  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)) || []; }
    catch (e) { return []; }
  }

  function save(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ===========================
     Hjälpfunktioner
     =========================== */

  /* Formatera datum till läsbar svensk sträng */
  function formatDate(iso) {
    var d = new Date(iso);
    return d.toLocaleDateString('sv-SE') + ' ' + d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  }

  /* Formatera datetime-local-värde från Date-objekt */
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

  /* Hitta närmaste namngivna plats inom radien */
  function nearestSpot(lat, lng) {
    var best = null;
    var bestDist = Infinity;
    state.spots.forEach(function (s) {
      var d = haversine(lat, lng, s.lat, s.lng);
      if (d < SPOT_RADIUS && d < bestDist) {
        bestDist = d;
        best = s;
      }
    });
    return best;
  }

  /* Escape HTML för att undvika XSS */
  function esc(str) {
    if (!str) return '';
    var el = document.createElement('span');
    el.textContent = str;
    return el.innerHTML;
  }

  /* ===========================
     Kartinitiering
     — Skapar Leaflet-kartan med
       satellitbild och kluster
     =========================== */
  function initMap() {
    state.map = L.map('map', {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      zoomControl: false
    });

    /* Esri World Imagery — gratis satellitplattor utan API-nyckel */
    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: '&copy; Esri', maxZoom: 19 }
    ).addTo(state.map);

    L.control.zoom({ position: 'topright' }).addTo(state.map);

    /* Klusterlager för fångstmarkörer */
    state.catchCluster = L.markerClusterGroup({
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
    state.map.addLayer(state.catchCluster);

    /* Separat lager för namngivna platser */
    state.spotLayer = L.layerGroup().addTo(state.map);

    initMapInteraction();
    loadMarkers();

    /* Visa hjälptext kort vid första besöket */
    if (!localStorage.getItem('fiskeapp_hint_shown')) {
      var hint = document.getElementById('map-hint');
      hint.classList.add('visible');
      setTimeout(function () { hint.classList.remove('visible'); }, 4000);
      localStorage.setItem('fiskeapp_hint_shown', '1');
    }
  }

  /* ===========================
     Kartinteraktion
     — Klick = ny fångst
       Långtryck = ny plats
     =========================== */
  function initMapInteraction() {
    var longPressTimer = null;
    var longPressTriggered = false;
    var touchStartPos = null;
    var container = state.map.getContainer();

    /* Enkelt klick — öppna fångstformulär */
    state.map.on('click', function (e) {
      if (longPressTriggered) {
        longPressTriggered = false;
        return;
      }
      openCatchForm(e.latlng);
    });

    /* Långtryck på mobil — öppna platsformulär */
    container.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      longPressTimer = setTimeout(function () {
        longPressTriggered = true;
        var rect = container.getBoundingClientRect();
        var point = state.map.containerPointToLatLng(
          L.point(touchStartPos.x - rect.left, touchStartPos.y - rect.top)
        );
        openSpotForm(point);
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

    /* Högerklick på dator — öppna platsformulär */
    state.map.on('contextmenu', function (e) {
      longPressTriggered = true;
      openSpotForm(e.latlng);
    });

    /* Positioneringsknapp */
    document.getElementById('locate-btn').addEventListener('click', function () {
      state.map.locate({ setView: true, maxZoom: 15 });
    });
  }

  /* ===========================
     Ladda markörer från data
     — Skapar kartmarkörer för
       alla sparade fångster
       och platser
     =========================== */
  function loadMarkers() {
    state.catchCluster.clearLayers();
    state.spotLayer.clearLayers();

    state.catches.forEach(function (c) {
      addCatchMarker(c);
    });

    state.spots.forEach(function (s) {
      addSpotMarker(s);
    });
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
      '<div class="popup-title">' + esc(c.species) + '</div>' +
      '<div class="popup-detail">' + formatDate(c.datetime) + '</div>' +
      (c.length ? '<div class="popup-detail">' + c.length + ' cm</div>' : '') +
      (c.weight ? '<div class="popup-detail">' + c.weight + ' kg</div>' : '') +
      '<button class="popup-btn" onclick="window._showCatchDetail(\'' + c.id + '\')">Visa detaljer</button>';

    marker.bindPopup(popupHtml);
    state.catchCluster.addLayer(marker);
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
      '<div class="popup-title">' + esc(s.name) + '</div>' +
      (s.note ? '<div class="popup-detail">' + esc(s.note) + '</div>' : '') +
      '<button class="popup-btn" onclick="window._editSpot(\'' + s.id + '\')">Redigera</button>';

    marker.bindPopup(popupHtml);
    state.spotLayer.addLayer(marker);
  }

  /* ===========================
     Väderdata (Open-Meteo)
     — Hämtar temperatur, vind
       och lufttryck baserat på
       klickade koordinater
     =========================== */
  function fetchWeather(lat, lng, callback) {
    var url = 'https://api.open-meteo.com/v1/forecast' +
      '?latitude=' + lat.toFixed(4) +
      '&longitude=' + lng.toFixed(4) +
      '&current=temperature_2m,wind_speed_10m,surface_pressure';

    fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.current) {
          callback({
            temp: data.current.temperature_2m,
            wind: data.current.wind_speed_10m,
            pressure: Math.round(data.current.surface_pressure)
          });
        } else {
          callback(null);
        }
      })
      .catch(function () { callback(null); });
  }

  /* ===========================
     Fångstformulär
     — Öppnar modalen och fyller
       i datum, koordinater och
       hämtar väder automatiskt
     =========================== */
  function openCatchForm(latlng) {
    var form = document.getElementById('catch-form');
    form.reset();

    document.getElementById('catch-lat').value = latlng.lat;
    document.getElementById('catch-lng').value = latlng.lng;
    document.getElementById('catch-datetime').value = toDatetimeLocal(new Date());

    /* Återställ fotoförhandsvisning */
    var preview = document.getElementById('photo-preview');
    preview.src = '';
    preview.classList.remove('has-photo');

    /* Hämta väder */
    var weatherEl = document.getElementById('weather-info');
    weatherEl.innerHTML = '<span class="weather-chip">Hämtar väder...</span>';
    document.getElementById('catch-temp').value = '';
    document.getElementById('catch-wind').value = '';
    document.getElementById('catch-pressure').value = '';

    fetchWeather(latlng.lat, latlng.lng, function (w) {
      if (w) {
        weatherEl.innerHTML =
          '<span class="weather-chip"><strong>' + w.temp + '</strong> °C</span>' +
          '<span class="weather-chip"><strong>' + w.wind + '</strong> m/s</span>' +
          '<span class="weather-chip"><strong>' + w.pressure + '</strong> hPa</span>';
        document.getElementById('catch-temp').value = w.temp;
        document.getElementById('catch-wind').value = w.wind;
        document.getElementById('catch-pressure').value = w.pressure;
      } else {
        weatherEl.innerHTML = '<span class="weather-chip">Ej tillgängligt</span>';
      }
    });

    openModal('catch-modal');
  }

  /* ===========================
     Fotohantering
     — Läser in bilden, skalar
       ner den och sparar som
       base64 för att spara plats
     =========================== */
  function processPhoto(file, callback) {
    if (!file) { callback(null); return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      var img = new Image();
      img.onload = function () {
        /* Skala ner till max 800px bredd */
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
        callback(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  /* Förhandsvisning av valt foto */
  document.getElementById('catch-photo').addEventListener('change', function () {
    var file = this.files[0];
    if (file) {
      var reader = new FileReader();
      reader.onload = function (e) {
        var preview = document.getElementById('photo-preview');
        preview.src = e.target.result;
        preview.classList.add('has-photo');
      };
      reader.readAsDataURL(file);
    }
  });

  /* ===========================
     Spara fångst
     =========================== */
  document.getElementById('catch-form').addEventListener('submit', function (e) {
    e.preventDefault();

    var photoFile = document.getElementById('catch-photo').files[0];

    processPhoto(photoFile, function (photoData) {
      var entry = {
        id: uid(),
        species: document.getElementById('catch-species').value.trim(),
        lure: document.getElementById('catch-lure').value.trim(),
        length: parseFloat(document.getElementById('catch-length').value) || null,
        weight: parseFloat(document.getElementById('catch-weight').value) || null,
        datetime: document.getElementById('catch-datetime').value,
        note: document.getElementById('catch-note').value.trim(),
        lat: parseFloat(document.getElementById('catch-lat').value),
        lng: parseFloat(document.getElementById('catch-lng').value),
        temp: document.getElementById('catch-temp').value || null,
        wind: document.getElementById('catch-wind').value || null,
        pressure: document.getElementById('catch-pressure').value || null,
        photo: photoData
      };

      state.catches.unshift(entry);
      save(CATCH_KEY, state.catches);
      addCatchMarker(entry);
      closeModal('catch-modal');
      refreshViews();
    });
  });

  /* ===========================
     Platsformulär
     — Skapa ny eller redigera
       befintlig namngiven plats
     =========================== */
  function openSpotForm(latlng, existingSpot) {
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
      document.getElementById('spot-lat').value = latlng.lat;
      document.getElementById('spot-lng').value = latlng.lng;
      document.getElementById('spot-id').value = '';
      deleteBtn.style.display = 'none';
    }

    openModal('spot-modal');
  }

  /* Spara plats */
  document.getElementById('spot-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var id = document.getElementById('spot-id').value;

    if (id) {
      /* Uppdatera befintlig plats */
      var spot = state.spots.find(function (s) { return s.id === id; });
      if (spot) {
        spot.name = document.getElementById('spot-name').value.trim();
        spot.note = document.getElementById('spot-note').value.trim();
      }
    } else {
      /* Ny plats */
      state.spots.push({
        id: uid(),
        name: document.getElementById('spot-name').value.trim(),
        note: document.getElementById('spot-note').value.trim(),
        lat: parseFloat(document.getElementById('spot-lat').value),
        lng: parseFloat(document.getElementById('spot-lng').value)
      });
    }

    save(SPOT_KEY, state.spots);
    loadMarkers();
    closeModal('spot-modal');
    refreshViews();
  });

  /* Ta bort plats */
  document.getElementById('spot-delete-btn').addEventListener('click', function () {
    var id = document.getElementById('spot-id').value;
    if (id && confirm('Vill du ta bort denna plats?')) {
      state.spots = state.spots.filter(function (s) { return s.id !== id; });
      save(SPOT_KEY, state.spots);
      loadMarkers();
      closeModal('spot-modal');
      refreshViews();
    }
  });

  /* Globala funktioner för popup-knappar */
  window._editSpot = function (id) {
    var spot = state.spots.find(function (s) { return s.id === id; });
    if (spot) {
      state.map.closePopup();
      openSpotForm(null, spot);
    }
  };

  /* ===========================
     Fångstdetaljer
     — Visar alla fält för en
       enskild fångst i en modal
     =========================== */
  window._showCatchDetail = function (id) {
    var c = state.catches.find(function (item) { return item.id === id; });
    if (!c) return;

    state.map.closePopup();

    document.getElementById('detail-title').textContent = c.species;

    var spot = nearestSpot(c.lat, c.lng);
    var locationStr = spot ? esc(spot.name) : (c.lat.toFixed(4) + ', ' + c.lng.toFixed(4));

    var html = '<div class="detail-section">' +
      '<h3>Fångst</h3>' +
      '<div class="detail-row"><span class="detail-label">Art</span><span>' + esc(c.species) + '</span></div>' +
      '<div class="detail-row"><span class="detail-label">Datum</span><span>' + formatDate(c.datetime) + '</span></div>' +
      (c.lure ? '<div class="detail-row"><span class="detail-label">Bete</span><span>' + esc(c.lure) + '</span></div>' : '') +
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
        '<p>' + esc(c.note) + '</p>' +
        '</div>';
    }

    if (c.photo) {
      html += '<div class="detail-section">' +
        '<h3>Foto</h3>' +
        '<img class="detail-photo" src="' + c.photo + '" alt="Fångstfoto">' +
        '</div>';
    }

    html += '<button class="btn btn-danger" onclick="window._deleteCatch(\'' + c.id + '\')">Ta bort fångst</button>';

    document.getElementById('detail-body').innerHTML = html;
    openModal('detail-modal');
  };

  /* Ta bort fångst */
  window._deleteCatch = function (id) {
    if (confirm('Vill du ta bort denna fångst?')) {
      state.catches = state.catches.filter(function (c) { return c.id !== id; });
      save(CATCH_KEY, state.catches);
      loadMarkers();
      closeModal('detail-modal');
      refreshViews();
    }
  };

  /* ===========================
     Fångstlista (Fångster-vy)
     — Visar alla fångster med
       filter för art, månad
       och plats
     =========================== */
  function renderCatchList() {
    var container = document.getElementById('catch-list');
    var species = document.getElementById('filter-species').value;
    var month = document.getElementById('filter-month').value;
    var spotFilter = document.getElementById('filter-spot').value;

    var filtered = state.catches.filter(function (c) {
      if (species && c.species.toLowerCase() !== species.toLowerCase()) return false;
      if (month) {
        var m = new Date(c.datetime).getMonth() + 1;
        if (m !== parseInt(month)) return false;
      }
      if (spotFilter) {
        var s = nearestSpot(c.lat, c.lng);
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
      var spot = nearestSpot(c.lat, c.lng);
      var locName = spot ? esc(spot.name) : '';
      return '<div class="card" onclick="window._showCatchDetail(\'' + c.id + '\')">' +
        '<div class="card-top">' +
        '<span class="card-species">' + esc(c.species) + '</span>' +
        '<span class="card-date">' + formatDate(c.datetime) + '</span>' +
        '</div>' +
        '<div class="card-details">' +
        (c.lure ? '<span class="card-tag">' + esc(c.lure) + '</span>' : '') +
        (c.length ? '<span>' + c.length + ' cm</span>' : '') +
        (c.weight ? '<span>' + c.weight + ' kg</span>' : '') +
        (locName ? '<span>' + locName + '</span>' : '') +
        '</div>' +
        (c.photo ? '<img class="card-photo" src="' + c.photo + '" alt="Fångstfoto" loading="lazy">' : '') +
        '</div>';
    }).join('');
  }

  /* Populera filterdropdowns baserat på befintlig data */
  function updateFilters() {
    var speciesSet = {};
    var monthSet = {};
    state.catches.forEach(function (c) {
      speciesSet[c.species.toLowerCase()] = c.species;
      var m = new Date(c.datetime).getMonth() + 1;
      monthSet[m] = true;
    });

    var monthNames = ['', 'Januari', 'Februari', 'Mars', 'April', 'Maj', 'Juni',
      'Juli', 'Augusti', 'September', 'Oktober', 'November', 'December'];

    /* Art */
    var speciesSelect = document.getElementById('filter-species');
    var currentSpecies = speciesSelect.value;
    speciesSelect.innerHTML = '<option value="">Alla arter</option>';
    Object.keys(speciesSet).sort().forEach(function (key) {
      speciesSelect.innerHTML += '<option value="' + esc(key) + '">' + esc(speciesSet[key]) + '</option>';
    });
    speciesSelect.value = currentSpecies;

    /* Månad */
    var monthSelect = document.getElementById('filter-month');
    var currentMonth = monthSelect.value;
    monthSelect.innerHTML = '<option value="">Alla månader</option>';
    Object.keys(monthSet).sort(function (a, b) { return a - b; }).forEach(function (m) {
      monthSelect.innerHTML += '<option value="' + m + '">' + monthNames[m] + '</option>';
    });
    monthSelect.value = currentMonth;

    /* Plats */
    var spotSelect = document.getElementById('filter-spot');
    var currentSpot = spotSelect.value;
    spotSelect.innerHTML = '<option value="">Alla platser</option>';
    state.spots.forEach(function (s) {
      spotSelect.innerHTML += '<option value="' + s.id + '">' + esc(s.name) + '</option>';
    });
    spotSelect.value = currentSpot;
  }

  /* Lyssna på filterändringar */
  ['filter-species', 'filter-month', 'filter-spot'].forEach(function (id) {
    document.getElementById(id).addEventListener('change', renderCatchList);
  });

  /* ===========================
     Statistik
     — Sammanställer data om
       fångster per art, plats
       och bete
     =========================== */
  function renderStats() {
    var total = state.catches.length;

    /* Räkna per art */
    var speciesCount = {};
    var lureCount = {};
    var spotCount = {};

    state.catches.forEach(function (c) {
      var sp = c.species.toLowerCase();
      speciesCount[sp] = (speciesCount[sp] || 0) + 1;

      if (c.lure) {
        var l = c.lure.toLowerCase();
        lureCount[l] = (lureCount[l] || 0) + 1;
      }

      var s = nearestSpot(c.lat, c.lng);
      if (s) {
        spotCount[s.name] = (spotCount[s.name] || 0) + 1;
      }
    });

    /* Hitta toppar */
    var topSpecies = topEntry(speciesCount);
    var topLure = topEntry(lureCount);
    var topSpot = topEntry(spotCount);

    var summaryEl = document.getElementById('stats-summary');
    summaryEl.innerHTML =
      '<div class="stat-card">' +
      '<div class="stat-value">' + total + '</div>' +
      '<div class="stat-label">Totala fångster</div>' +
      '</div>' +
      '<div class="stat-card">' +
      '<div class="stat-value">' + (topSpecies ? esc(topSpecies[0]) : '—') + '</div>' +
      '<div class="stat-label">Vanligaste art' + (topSpecies ? ' (' + topSpecies[1] + ')' : '') + '</div>' +
      '</div>' +
      '<div class="stat-card">' +
      '<div class="stat-value">' + (topLure ? esc(topLure[0]) : '—') + '</div>' +
      '<div class="stat-label">Populäraste bete' + (topLure ? ' (' + topLure[1] + ')' : '') + '</div>' +
      '</div>' +
      '<div class="stat-card">' +
      '<div class="stat-value">' + (topSpot ? esc(topSpot[0]) : '—') + '</div>' +
      '<div class="stat-label">Bästa plats' + (topSpot ? ' (' + topSpot[1] + ')' : '') + '</div>' +
      '</div>';

    /* Lista arter med antal */
    var speciesEl = document.getElementById('stats-species');
    var sorted = Object.entries(speciesCount).sort(function (a, b) { return b[1] - a[1]; });

    if (sorted.length === 0) {
      speciesEl.innerHTML =
        '<div class="empty-state">' +
        '<div class="empty-icon">&#128202;</div>' +
        '<p>Ingen statistik ännu</p>' +
        '</div>';
    } else {
      speciesEl.innerHTML = '<h3 style="margin-bottom:12px;font-size:14px;color:var(--text-muted);">Fångster per art</h3>' +
        sorted.map(function (entry) {
          return '<div class="card">' +
            '<div class="card-top">' +
            '<span class="card-species">' + esc(entry[0]) + '</span>' +
            '<span class="card-date">' + entry[1] + ' st</span>' +
            '</div></div>';
        }).join('');
    }
  }

  /* Returnerar [nyckel, antal] för den vanligaste posten */
  function topEntry(obj) {
    var entries = Object.entries(obj);
    if (entries.length === 0) return null;
    entries.sort(function (a, b) { return b[1] - a[1]; });
    return entries[0];
  }

  /* ===========================
     Platslista (Platser-vy)
     =========================== */
  function renderSpotList() {
    var container = document.getElementById('spot-list');

    if (state.spots.length === 0) {
      container.innerHTML =
        '<div class="empty-state">' +
        '<div class="empty-icon">&#128205;</div>' +
        '<p>Inga sparade platser</p>' +
        '<p>Långtryck på kartan för att spara en plats!</p>' +
        '</div>';
      return;
    }

    container.innerHTML = state.spots.map(function (s) {
      /* Räkna fångster nära denna plats */
      var catchCount = state.catches.filter(function (c) {
        return haversine(c.lat, c.lng, s.lat, s.lng) < SPOT_RADIUS;
      }).length;

      return '<div class="card" onclick="window._editSpot(\'' + s.id + '\')">' +
        '<div class="spot-card">' +
        '<div class="spot-icon">&#9733;</div>' +
        '<div class="spot-info">' +
        '<div class="spot-name">' + esc(s.name) + '</div>' +
        '<div class="spot-coords">' + s.lat.toFixed(4) + ', ' + s.lng.toFixed(4) +
        ' · ' + catchCount + ' fångster</div>' +
        (s.note ? '<div class="spot-note">' + esc(s.note) + '</div>' : '') +
        '</div></div></div>';
    }).join('');
  }

  /* ===========================
     Exportera data
     — Skapar en JSON-fil med
       all data som användaren
       kan ladda ner
     =========================== */
  document.getElementById('export-btn').addEventListener('click', function () {
    var data = {
      exported: new Date().toISOString(),
      catches: state.catches,
      spots: state.spots
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'fiskeapp-export-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  /* ===========================
     Navigation
     — Hanterar flikbyte i
       bottomnavigeringen
     =========================== */
  function initNav() {
    var tabs = document.querySelectorAll('.nav-tab');
    var views = document.querySelectorAll('.view');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        var target = this.dataset.view;

        tabs.forEach(function (t) { t.classList.remove('active'); });
        views.forEach(function (v) { v.classList.remove('active'); });

        this.classList.add('active');
        document.getElementById('view-' + target).classList.add('active');

        /* Uppdatera kartans storlek vid byte tillbaka till kartvyn */
        if (target === 'map') {
          state.map.invalidateSize();
        }
      });
    });
  }

  /* ===========================
     Modaler
     — Öppna och stäng modaler
     =========================== */
  function openModal(id) {
    document.getElementById(id).classList.add('open');
  }

  function closeModal(id) {
    document.getElementById(id).classList.remove('open');
  }

  /* Stäng modal vid klick på bakgrund eller stängknapp */
  document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        overlay.classList.remove('open');
      }
    });
  });

  document.querySelectorAll('.modal-close').forEach(function (btn) {
    btn.addEventListener('click', function () {
      closeModal(this.dataset.close);
    });
  });

  /* ===========================
     Uppdatera alla vyer
     =========================== */
  function refreshViews() {
    updateFilters();
    renderCatchList();
    renderStats();
    renderSpotList();
  }

  /* ===========================
     Service Worker-registrering
     =========================== */
  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js');
    }
  }

  /* ===========================
     Starta appen
     =========================== */
  function init() {
    registerSW();
    initMap();
    initNav();
    refreshViews();
  }

  /* Kör init när DOM:en är redo */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
