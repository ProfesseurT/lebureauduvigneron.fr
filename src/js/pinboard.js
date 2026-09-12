(function () {
  var board = document.querySelector('[data-pinboard]');
  if (!board) return;

  /* LE TROISIEME ETAT S'APPELAIT `digital`, ET IL MONTRAIT VITISOFT. Renomme
     `bureau` le 12/09/2026, en meme temps que sa couche : ce n'est pas un
     changement de mot, c'est un changement de destination. Le raisonnement est en
     tete de src/_includes/components/demo-pinboard.njk.

     LES TEXTES SUIVENT, et « passer au numerique » est celui qui devait partir en
     premier : le vigneron ne cherche pas a passer au numerique, il y est deja, il
     a un tableur et un logiciel. Ce qu'il cherche, c'est que tout soit au meme
     endroit et qu'on lui dise quoi faire aujourd'hui. L'etape 03 ne promet donc
     plus un support, elle promet un lieu. */
  var STATES   = ['chaos', 'organized', 'bureau'];
  var CAPTIONS = {
    chaos:      "Le bureau d'un vigneron, un mardi de fin de mois.",
    organized:  "Rangé, c'est déjà mieux. Mais rien ne te dit par quoi commencer.",
    bureau:     "Les mêmes papiers, dans ton bureau. Chacun devient un geste."
  };
  var HINTS = {
    chaos:      'Cliquez sur le tableau pour ranger',
    organized:  'Cliquez pour ouvrir le bureau',
    bureau:     'Cliquez pour recommencer'
  };
  var STEP_LABELS = { chaos: '01', organized: '02', bureau: '03' };
  var BADGES = {
    chaos:     'État : chaos administratif · 23:47',
    organized: 'État : organisé · 09:42',
    bureau:    ''
  };

  var cards    = board.querySelectorAll('[data-card]');
  var layerPaper   = board.querySelector('[data-pinboard-pinboard]');
  var layerDigital = board.querySelector('[data-pinboard-bureau]');
  var badge    = board.querySelector('[data-pinboard-state-badge]');
  var stepEl   = document.querySelector('[data-pinboard-step]');
  var capEl    = document.querySelector('[data-pinboard-caption]');
  var hintEl   = document.querySelector('[data-pinboard-hint]');

  function applyPositions(state) {
    cards.forEach(function (c) {
      var pos = (state === 'chaos') ? c.dataset.chaos : c.dataset.org;
      var parts = pos.split(',').map(Number);
      c.style.left      = parts[0] + '%';
      c.style.top       = parts[1] + '%';
      c.style.transform = 'rotate(' + parts[2] + 'deg)';
    });
  }

  function setState(next) {
    board.dataset.state = next;

    /* Force reflow avant crossfade pour que la transition parte proprement */
    void layerPaper.offsetHeight;
    void layerDigital.offsetHeight;

    var isDigital = (next === 'bureau');

    layerPaper.style.opacity      = isDigital ? '0'      : '1';
    layerPaper.style.transform    = isDigital ? 'scale(0.97)' : 'scale(1)';
    layerPaper.style.pointerEvents= isDigital ? 'none'   : 'auto';

    layerDigital.style.opacity      = isDigital ? '1'      : '0';
    layerDigital.style.transform    = isDigital ? 'scale(1)' : 'scale(1.04)';
    layerDigital.style.pointerEvents= isDigital ? 'auto'  : 'none';
    layerDigital.setAttribute('aria-hidden', isDigital ? 'false' : 'true');

    if (next !== 'bureau') applyPositions(next);

    if (stepEl) stepEl.textContent = 'Démonstration · étape ' + STEP_LABELS[next] + ' / 03';
    if (capEl)  capEl.textContent  = CAPTIONS[next];
    if (hintEl) hintEl.textContent = HINTS[next];

    if (badge) {
      badge.textContent    = BADGES[next];
      badge.style.opacity  = isDigital ? '0' : '1';
    }
  }

  function next() {
    var cur = board.dataset.state || 'chaos';
    var idx = STATES.indexOf(cur);
    setState(STATES[(idx + 1) % STATES.length]);
  }

  board.addEventListener('click', next);
  board.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      next();
    }
  });

  /* Init : poser les positions chaos immédiatement sans transition */
  applyPositions('chaos');

  /* Activer les transitions CSS après 1 frame (évite l'animation au chargement) */
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      board.classList.add('ready');
    });
  });
})();
