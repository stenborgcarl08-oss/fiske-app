/* ===========================
   Router
   — Hanterar flikbyte mellan
     vyer i bottomnavigationen.
     Dispatchar 'view-changed'
     event vid byte.
   =========================== */
window.FiskeApp = window.FiskeApp || {};

window.FiskeApp.router = (function () {
  'use strict';

  var tabs = null;
  var views = null;
  var currentView = 'home';

  function init() {
    tabs = document.querySelectorAll('.nav-tab');
    views = document.querySelectorAll('.view');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        navigate(this.dataset.view);
      });
    });

    /* Lyssna på navigate-event från andra moduler */
    document.addEventListener('navigate', function (e) {
      navigate(e.detail);
    });
  }

  function navigate(viewName) {
    if (viewName === currentView) return;

    tabs.forEach(function (t) { t.classList.remove('active'); });
    views.forEach(function (v) { v.classList.remove('active'); });

    var targetTab = document.querySelector('.nav-tab[data-view="' + viewName + '"]');
    var targetView = document.getElementById('view-' + viewName);

    if (targetTab) targetTab.classList.add('active');
    if (targetView) targetView.classList.add('active');

    currentView = viewName;

    document.dispatchEvent(new CustomEvent('view-changed', {
      detail: viewName
    }));
  }

  function getCurrentView() {
    return currentView;
  }

  return {
    init: init,
    navigate: navigate,
    getCurrentView: getCurrentView
  };
})();
