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
