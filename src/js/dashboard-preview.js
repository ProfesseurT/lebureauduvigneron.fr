(function () {
  var mock = document.querySelector('.dashboard-mock');
  if (!mock) return;

  var tablist = mock.querySelector('[role="tablist"]');
  if (!tablist) return;

  var tabs   = Array.from(tablist.querySelectorAll('[role="tab"]'));
  var panels = Array.from(mock.querySelectorAll('[role="tabpanel"]'));

  function activate(index) {
    tabs.forEach(function (tab, i) {
      tab.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
    panels.forEach(function (panel, i) {
      panel.hidden = i !== index;
    });
  }

  tabs.forEach(function (tab, index) {
    tab.addEventListener('click', function () {
      activate(index);
    });

    tab.addEventListener('keydown', function (e) {
      var next;
      if (e.key === 'ArrowDown') {
        next = (index + 1) % tabs.length;
        activate(next);
        tabs[next].focus();
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        next = (index - 1 + tabs.length) % tabs.length;
        activate(next);
        tabs[next].focus();
        e.preventDefault();
      } else if (e.key === 'Home') {
        activate(0);
        tabs[0].focus();
        e.preventDefault();
      } else if (e.key === 'End') {
        activate(tabs.length - 1);
        tabs[tabs.length - 1].focus();
        e.preventDefault();
      } else if (e.key === 'Enter' || e.key === ' ') {
        activate(index);
        e.preventDefault();
      }
    });
  });

  /* Prenom hook — localStorage 'bureau_prenom' ou param URL ?prenom= */
  (function () {
    var prenom = '';
    try { prenom = localStorage.getItem('bureau_prenom') || ''; } catch (e) {}
    if (!prenom) {
      var match = window.location.search.match(/[?&]prenom=([^&]+)/);
      if (match) prenom = decodeURIComponent(match[1]);
    }
    if (prenom) {
      mock.querySelectorAll('[data-user-name], [data-user-greeting]').forEach(function (el) {
        el.textContent = prenom;
      });
    }
  })();

  activate(0);
})();
