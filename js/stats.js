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
