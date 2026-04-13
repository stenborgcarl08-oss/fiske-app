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

    /* Stäng vid klick på bakgrund */
    document.getElementById('step-form-overlay').addEventListener('click', function (e) {
      if (e.target === this) closeForm();
    });

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
      .catch(function () { /* Väder ej tillgängligt */ });
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
