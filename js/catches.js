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
