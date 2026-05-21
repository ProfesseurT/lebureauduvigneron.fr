(function () {
  var tablist = document.querySelector('[role="tablist"]');
  if (!tablist) return;

  var tabs   = Array.from(tablist.querySelectorAll('[role="tab"]'));
  var panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));

  function activate(index) {
    tabs.forEach(function (tab, i) {
      var isActive = i === index;
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.classList.toggle('tiroir-tab--active', isActive);
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
      if (e.key === 'ArrowRight') {
        next = (index + 1) % tabs.length;
        activate(next);
        tabs[next].focus();
        e.preventDefault();
      } else if (e.key === 'ArrowLeft') {
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
      }
    });
  });

  activate(0);
})();
