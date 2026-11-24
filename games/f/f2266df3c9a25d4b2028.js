/* KJT Kids Corner extras \u2014 Site Core 5.0.7
   Memory Verse Garden, Who Am I?, Prayer Garden. Nothing is sent anywhere;
   the garden reads the Adventure Trail progress saved on this device. */
(function () {
  /* 5.6.0: tell Kids Corner achievements about prayers, riddles and verses. */
  function ach(t, k) { try { window.dispatchEvent(new CustomEvent('kjt-achieve', { detail: { type: t, key: k } })); } catch (e) {} }

  'use strict';

  /* ---------- shared helpers ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function readJSON(id) { var n = document.getElementById(id); if (!n) return null; try { return JSON.parse(n.textContent); } catch (e) { return null; } }
  /* Read-aloud uses the offline voice module (voice.js). */
  var V = window.KJTVoice || null;
  var canSpeak = !!(V && V.supported);
  function stopSpeaking() { if (V) V.stop(); }
  function speak(text) { if (V) V.speak(text); }
  function esc(w) { return String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  /* ---------- Memory Verse Garden ---------- */
  (function garden() {
    var root = document.querySelector('[data-kjt-garden]');
    var data = readJSON('kjt-trail-data');
    if (!root || !data || !data.trails) return;
    var FLOWERS = ['\ud83c\udf37', '\ud83c\udf3b', '\ud83c\udf3c', '\ud83c\udf38', '\ud83c\udf3a', '\ud83e\udebb', '\ud83d\udc90'];
    var stops = [];
    data.trails.forEach(function (t) { t.stops.forEach(function (s) { if (s.verse) stops.push(s); }); });
    if (!stops.length) return;
    var selected = null;

    function progress() { try { return JSON.parse(localStorage.getItem('kjt_trail_v1')) || {}; } catch (e) { return {}; } }

    function render() {
      var p = progress(), grown = 0;
      root.innerHTML = '';
      var beds = el('div', { class: 'kk-beds' });
      stops.forEach(function (s, i) {
        var done = p[s.slug] && p[s.slug].grow;
        if (done) {
          grown++;
          beds.appendChild(el('button', { class: 'kk-plot', type: 'button', 'aria-pressed': selected === s ? 'true' : 'false',
            onclick: function () { selected = s; render(); var c = root.querySelector('.kk-card'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } },
            [el('span', { class: 'kk-plot__flower', text: FLOWERS[i % FLOWERS.length], 'aria-hidden': 'true' }), s.verseRef || s.title]));
        } else {
          beds.appendChild(el('div', { class: 'kk-plot kk-plot--seed' }, [
            el('span', { class: 'kk-plot__flower', text: '\ud83c\udf31', 'aria-hidden': 'true' }),
            el('span', { text: s.icon + ' ' + s.title })
          ]));
        }
      });
      root.appendChild(el('p', { class: 'kk-count', text: grown ? grown + ' of ' + stops.length + ' flowers growing' : 'Your garden is waiting. Finish a trail stop to plant your first flower!' }));
      if (grown) root.appendChild(el('p', { class: 'kt-note', text: 'Tap a flower to practise its verse.' }));
      root.appendChild(beds);
      var card = el('div');
      if (selected && p[selected.slug] && p[selected.slug].grow) card = practise(selected);
      root.appendChild(card);
    }

    function practise(s) {
      var verse = el('blockquote', { class: 'kt-verse' });
      function show(hidden) {
        verse.innerHTML = '';
        var re = s.missing ? new RegExp('\\b(' + esc(s.missing) + ')\\b', 'i') : null, m = re && s.verse.match(re);
        if (hidden && m) {
          verse.appendChild(document.createTextNode(s.verse.slice(0, m.index)));
          verse.appendChild(el('button', { class: 'kk-blank', type: 'button', text: '?', 'aria-label': 'Show the hidden word',
            onclick: function (e) { e.target.replaceWith(el('strong', { text: m[0] })); } }));
          verse.appendChild(document.createTextNode(s.verse.slice(m.index + m[0].length)));
        } else verse.appendChild(document.createTextNode(s.verse));
        if (s.verseRef) verse.appendChild(el('cite', { text: s.verseRef }));
      }
      show(false);
      var cardEl = el('div', { class: 'kk-card' }, [
        el('p', { class: 'kt-step-label', text: s.icon + ' ' + s.title }),
        verse,
        el('div', { class: 'kt-row' }, [
          canSpeak ? el('button', { class: 'kt-btn', type: 'button', 'data-kjt-voice': '', text: '\ud83d\udd0a Say it with me', onclick: function () { ach('verse', s.slug); speak(s.verse + ' ' + (s.verseRef || '')); } }) : null,
          el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83d\ude48 Hide a word', onclick: function () { show(true); ach('verse', s.slug); } }),
          el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83d\udc40 Show it all', onclick: function () { show(false); } })
        ])
      ]);
      if (V) V.apply(cardEl);
      return cardEl;
    }

    render();
    window.addEventListener('kjt-trail-progress', render);
    window.addEventListener('storage', function (e) { if (e.key === 'kjt_trail_v1') render(); });
  })();

  /* ---------- Who Am I? (5.9.0: three levels) ----------
     Easy: well-known people, 3 names to choose from, clues on request.
     Medium: the same people, 5 names to choose from, start with one clue.
     Hard: lesser-known people, the hardest clue first, no names to choose
     from: type the answer (3 tries). */
  (function whoAmI() {
    var root = document.querySelector('[data-kjt-whoami]');
    var all = readJSON('kjt-whoami-data');
    if (!root || !all || !all.length) return;
    var LKEY = 'kjt_whoami_level', level = 'easy';
    try { level = localStorage.getItem(LKEY) || 'easy'; } catch (e) {}
    var pools = { easy: all.filter(function (r) { return r.level !== 'hard' && r.wrong1; }), hard: all.filter(function (r) { return r.level === 'hard'; }) };
    pools.medium = pools.easy;
    if (!pools[level] || !pools[level].length) level = 'easy';
    var order, idx, solved;
    /* 7.9.0: names typed in any of the page languages (letters of every script count) */
    function norm(x) { x = String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/^(saint|sainte|st\.?|the|san|santa|le|la|el|القديسة?|संत|圣)\s*/, ''); try { return x.replace(/[^\p{L}\p{N}]/gu, ''); } catch (e) { return x.replace(/[^a-z]/g, ''); } }
    function T(x) { return window.KJT_LANG ? window.KJT_LANG.t(x) : x; }
    function start(lv) { level = lv; try { localStorage.setItem(LKEY, lv); } catch (e) {} order = shuffle(pools[lv]); idx = 0; solved = 0; render(); }

    function render() {
      var r = order[idx], shown = 1, done = false, tries = 0;
      root.innerHTML = '';
      var levels = el('div', { class: 'kk-levels', role: 'group', 'aria-label': 'Level' });
      [['easy', '\ud83c\udf31 Easy'], ['medium', '\ud83c\udf3f Medium'], ['hard', '\ud83c\udf33 Hard']].forEach(function (l) {
        if (!pools[l[0]].length) return;
        levels.appendChild(el('button', { class: 'kk-level' + (l[0] === level ? ' on' : ''), type: 'button', text: l[1], 'aria-pressed': l[0] === level ? 'true' : 'false', onclick: function () { if (l[0] !== level) start(l[0]); } }));
      });
      var clues = el('ol', { class: 'kk-clues' });
      var fb = el('p', { class: 'kt-feedback', 'aria-live': 'polite' });
      var more = el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83d\udca1 Another clue', onclick: function () { if (shown < r.clues.length) { shown++; paint(); } } });
      var opts = el('div', { class: 'kt-options' });
      var next = el('div', { class: 'kt-row' });
      var list = level === 'hard' ? r.clues.slice() : r.clues;
      function paint() {
        clues.innerHTML = '';
        list.slice(0, shown).forEach(function (c) { clues.appendChild(el('li', { text: c })); });
        more.disabled = shown >= list.length || done; more.hidden = done;
        if (shown >= list.length) more.textContent = 'That was the last clue';
      }
      function win(label) {
        done = true; solved++; ach('riddle'); if (level === 'hard') ach('riddle-hard'); else if (level === 'medium') ach('riddle-medium');
        shown = list.length; paint();
        fb.className = 'kt-feedback'; fb.textContent = '\u2b50 ' + (label || 'Yes!') + ' I am ' + r.answer + '!';
        nextButton();
      }
      function nextButton() {
        next.appendChild(el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: idx < order.length - 1 ? 'Next riddle \u2192' : 'Play again \ud83d\udd04', onclick: function () {
          idx = idx < order.length - 1 ? idx + 1 : 0; if (idx === 0) { order = shuffle(pools[level]); solved = 0; } render();
        } }));
      }
      if (level === 'hard') {
        /* type the answer: no names to choose from */
        var input = el('input', { type: 'text', class: 'kk-answer', autocomplete: 'off', autocapitalize: 'words', spellcheck: 'false', placeholder: 'Type the name\u2026', 'aria-label': 'Who am I? Type the name' });
        var go = el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: 'Guess' });
        var check = function () {
          if (done) return; var g = norm(input.value); if (!g) return;
          var ok = [r.answer, T(r.answer)].concat(r.accept || []).some(function (a) { return norm(a) === g; });
          if (ok) { input.disabled = true; go.disabled = true; win('Brilliant!'); return; }
          tries++; input.value = '';
          if (tries >= 3) { done = true; input.disabled = true; go.disabled = true; shown = list.length; paint(); fb.className = 'kt-feedback try'; fb.textContent = 'I am ' + r.answer + '. That was a hard one! Try the next riddle.'; nextButton(); return; }
          fb.className = 'kt-feedback try'; fb.textContent = 'Not quite. ' + (3 - tries) + (3 - tries === 1 ? ' try left.' : ' tries left.') + (shown < list.length ? ' Want another clue?' : '');
          input.focus();
        };
        go.addEventListener('click', check); input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); check(); } });
        opts.appendChild(el('div', { class: 'kk-answer-row' }, [input, go]));
      } else {
        var choices = [r.answer, r.wrong1, r.wrong2].filter(Boolean);
        if (level === 'medium') {
          /* two more names from other riddles */
          var others = shuffle(pools.easy.map(function (x) { return x.answer; }).filter(function (n) { return choices.indexOf(n) < 0; }));
          choices = choices.concat(others.slice(0, 2));
        }
        shuffle(choices).forEach(function (name) {
          var b = el('button', { class: 'kt-opt', type: 'button', text: name, onclick: function () {
            if (done) return;
            if (name === r.answer) { b.classList.add('right'); b.textContent = '\u2713 ' + name; opts.querySelectorAll('button').forEach(function (x) { x.disabled = true; }); win(); }
            else { b.classList.add('gentle'); b.disabled = true; fb.className = 'kt-feedback try'; fb.textContent = shown < list.length ? 'Good try! Want another clue?' : 'Good try! Have another go.'; }
          } });
          opts.appendChild(b);
        });
      }
      paint();
      root.appendChild(el('div', { class: 'kk-riddle' }, [
        levels,
        el('p', { class: 'kk-riddle__count', text: { easy: 'Easy', medium: 'Medium', hard: 'Hard' }[level] + ' \u00b7 Riddle ' + (idx + 1) + ' of ' + order.length + (solved ? ' \u00b7 ' + solved + ' solved' : '') }),
        clues,
        el('div', { class: 'kt-row', style: 'margin:0 0 1rem' }, [more]),
        opts, fb, next
      ]));
    }
    start(level);
  })();

  /* ---------- Prayer Garden ---------- */
  (function prayerGarden() {
    var root = document.querySelector('[data-kjt-prayer]');
    if (!root) return;
    var buttons = root.querySelectorAll('.kk-feel');
    var cards = root.querySelectorAll('[data-prayer-card]');

    /* 5.3.0: a card may hold several prayers; show one at random. */
    function variants(card) { return Array.prototype.slice.call(card.querySelectorAll('.kk-prayer__text')); }
    function choose(card, avoid) {
      var v = variants(card), cur = v.filter(function (p) { return !p.hidden; })[0], opts = v.filter(function (p) { return p !== (avoid ? cur : null); });
      var next = opts[Math.floor(Math.random() * opts.length)] || cur;
      v.forEach(function (p) { p.hidden = p !== next; });
    }
    cards.forEach(function (card) {
      var text = { get textContent() { var v = variants(card).filter(function (p) { return !p.hidden; })[0]; return v ? v.textContent : ''; } };
      var amen = el('p', { class: 'kt-feedback', 'aria-live': 'polite' });
      card.appendChild(el('div', { class: 'kt-row' }, [
        canSpeak ? el('button', { class: 'kt-btn', type: 'button', 'data-kjt-voice': '', text: '\ud83d\udd0a Pray it with me', onclick: function () { speak(text.textContent); } }) : null,
        el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '\ud83d\ude4f Amen', onclick: function () { stopSpeaking(); amen.textContent = 'Amen! Jesus hears you and loves you. \ud83d\udc9b'; ach('prayer'); } })
      ]));
      card.appendChild(amen);
      if (variants(card).length > 1) card.querySelector('.kt-row').appendChild(el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83d\udd04 Another prayer', onclick: function () { stopSpeaking(); amen.textContent = ''; choose(card, true); } }));
      if (V) V.apply(card);
    });

    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-prayer'), open = b.getAttribute('aria-expanded') === 'true';
        stopSpeaking();
        buttons.forEach(function (x) { x.setAttribute('aria-expanded', 'false'); });
        cards.forEach(function (c) {
          c.hidden = open || c.getAttribute('data-prayer-card') !== id;
          var fb = c.querySelector('.kt-feedback'); if (fb) fb.textContent = '';
        });
        if (!open) {
          b.setAttribute('aria-expanded', 'true');
          var card = root.querySelector('[data-prayer-card="' + id + '"]');
          if (card) choose(card, false);
          if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    });
  })();

  /* ---------- Superbook language picker (5.0.8) ---------- */
  (function superbook() {
    var picker = document.querySelector('[data-kjt-superbook]');
    var sections = document.querySelectorAll('[data-kjt-superbook-lang]');
    if (!picker || sections.length < 2) return;
    var buttons = picker.querySelectorAll('.kk-lang');
    var KEY = 'kjt_superbook_lang';
    function exists(id) { return !!document.querySelector('[data-kjt-superbook-lang="' + id + '"]'); }

    function select(id) {
      sections.forEach(function (s) {
        var hide = s.getAttribute('data-kjt-superbook-lang') !== id;
        if (hide && !s.classList.contains('kk-sb-hidden')) {
          /* Close any video still playing in the language being hidden. */
          s.querySelectorAll('.kjt-inline-video-close').forEach(function (b) { b.click(); });
        }
        s.classList.toggle('kk-sb-hidden', hide);
      });
      buttons.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-lang') === id ? 'true' : 'false'); });
      try { localStorage.setItem(KEY, id); } catch (e) {}
    }

    buttons.forEach(function (b) { b.addEventListener('click', function () { select(b.getAttribute('data-lang')); }); });

    function fromHash() {
      var id = location.hash.replace(/^#/, '');
      if (id && exists(id)) {
        select(id);
        var s = document.getElementById(id); if (s) s.scrollIntoView({ block: 'start' });
        return true;
      }
      return false;
    }
    window.addEventListener('hashchange', fromHash);

    if (!fromHash()) {
      var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
      /* 7.9.0: the page language comes first (Kids Corner in French opens the French Superbook) */
      var pl = { ar: 'arabic', zh: 'mandarin', fr: 'french', es: 'spanish', hi: 'hindi', tl: 'tagalog', ru: 'russian' }[(window.KJT_LANG || {}).lang];
      if (pl && exists(pl)) saved = pl;
      select(saved && exists(saved) ? saved : (exists('english') ? 'english' : sections[0].getAttribute('data-kjt-superbook-lang')));
    }
  })();
})();
