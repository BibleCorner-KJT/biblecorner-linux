/* KJT Bible Adventure Trail \u2014 Site Core 5.0.5
   Stops come from WordPress (Adventure Trail in the dashboard).
   Progress is stored only on this device (localStorage "kjt_trail_v1"). */
(function () {
  'use strict';

  var root = document.querySelector('[data-kjt-trail]');
  var dataEl = document.getElementById('kjt-trail-data');
  if (!root || !dataEl) return;

  var data;
  try { data = JSON.parse(dataEl.textContent); } catch (e) { return; }
  var trails = (data && data.trails) || [];
  if (!trails.length) return;

  var section = document.getElementById('adventure-trail') || root;
  var STORE = 'kjt_trail_v1';
  var STEPS = [
    { id: 'discover', label: 'Discover', icon: '\ud83d\udd0d' },
    { id: 'read',     label: 'Read',     icon: '\ud83d\udcd6' },
    { id: 'listen',   label: 'Listen',   icon: '\ud83c\udfa7' },
    { id: 'learn',    label: 'Learn',    icon: '\u2753' },
    { id: 'play',     label: 'Play',     icon: '\ud83e\udde9' },
    { id: 'grow',     label: 'Grow',     icon: '\ud83c\udf31' }
  ];
  var PRAISE = ['\u2b50 Great job!', '\u2b50 Well done!', '\u2b50 That\'s right!', '\u2b50 Wonderful!'];
  var EXTRA_WORDS = ['light', 'love', 'hope', 'joy', 'peace', 'bread', 'star', 'lamb'];

  /* ---------- helpers ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
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
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  /* ---------- progress (this device only) ---------- */
  function load() { try { return JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) { return {}; } }
  function save(p) {
    try { localStorage.setItem(STORE, JSON.stringify(p)); } catch (e) {}
    /* Lets other Kids Corner sections (Memory Verse Garden) update. */
    try { window.dispatchEvent(new CustomEvent('kjt-trail-progress')); } catch (e) {}
  }
  var progress = load();
  function mark(slug, part) {
    progress[slug] = progress[slug] || {};
    if (!progress[slug][part]) { progress[slug][part] = 1; save(progress); }
  }

  /* ---------- stop lookups ---------- */
  var allStops = [];
  trails.forEach(function (t) { t.stops.forEach(function (s) { s.trailKey = t.key; allStops.push(s); }); });
  function find(slug) { for (var i = 0; i < allStops.length; i++) if (allStops[i].slug === slug) return allStops[i]; return null; }
  /* 7.9.0: the memory-verse game works in the page language too (verse and word come from the word list) */
  function L(x) { return (window.KJT_LANG && x) ? window.KJT_LANG.t(x) : x; }
  function findWord(verse, word) {
    if (!verse || !word) return null;
    if (/^[A-Za-z\u00C0-\u024F'’-]+$/.test(word)) {
      var m = verse.match(new RegExp('(^|[^A-Za-z\u00C0-\u024F])(' + esc(word) + ')(?![A-Za-z\u00C0-\u024F])', 'i'));
      return m ? { index: m.index + m[1].length, text: m[2] } : null;
    }
    var i = verse.indexOf(word); return i < 0 ? null : { index: i, text: word };
  }
  function hasPlay(s) { return (s.steps && s.steps.length > 1) || !!findWord(L(s.verse), L(s.missing)) || !!findWord(s.verse, s.missing); }
  function esc(w) { return String(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function parts(s) { var p = []; if (s.quiz && s.quiz.length) p.push('learn'); if (hasPlay(s)) p.push('play'); p.push('grow'); return p; }
  function earned(s) { var g = progress[s.slug] || {}; return parts(s).filter(function (p) { return g[p]; }).length; }
  function finished(s) { return !!(progress[s.slug] && progress[s.slug].grow); }
  function nextStop(s) {
    var i = allStops.indexOf(s);
    for (var k = i + 1; k < allStops.length; k++) if (!finished(allStops[k])) return allStops[k];
    return allStops[i + 1] || null;
  }
  function starsEl(s) {
    var n = parts(s).length, got = earned(s), wrap = el('span', { class: 'kt-stars', 'aria-label': got + ' of ' + n + ' stars' });
    for (var i = 0; i < n; i++) wrap.appendChild(el('span', { class: i < got ? '' : 'off', text: '\u2b50', 'aria-hidden': 'true' }));
    return wrap;
  }

  /* ---------- speech ("Read it to me"): offline voice via KJTVoice (voice.js) ---------- */
  var V = window.KJTVoice || null;
  var canSpeak = !!(V && V.supported);
  function stopSpeaking() { if (V) V.stop(); }
  function speak(text) { if (V) V.speak(text); }
  function plain(html) { var d = document.createElement('div'); d.innerHTML = html || ''; return d.textContent.replace(/\s+/g, ' ').trim(); }

  /* ---------- map view ---------- */
  function renderMap() {
    stopSpeaking();
    root.innerHTML = '';
    var total = 0, got = 0;
    allStops.forEach(function (s) { total += parts(s).length; got += earned(s); });

    var actions = el('div', { class: 'kt-passport__actions' });
    trails.forEach(function (t) {
      if (t.stops.every(finished)) actions.appendChild(el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '\ud83c\udfc5 Certificate: ' + t.name.replace(/^\S+\s/, ''), onclick: function () { certificate(t); } }));
    });
    if (got > 0) actions.appendChild(el('button', { class: 'kt-link', type: 'button', text: 'Start again (grown-ups)', onclick: function () {
      if (window.confirm('Clear all stars on this device and start the trail again?')) { progress = {}; save(progress); renderMap(); }
    } }));

    root.appendChild(el('div', { class: 'kt-passport' }, [
      el('div', null, [
        el('p', { class: 'kt-passport__title', text: '\ud83d\udcdc My Faith Journey Passport' }),
        el('p', { class: 'kt-passport__count', text: got + ' of ' + total + ' stars collected' })
      ]),
      actions
    ]));

    var suggested = null;
    for (var i = 0; i < allStops.length; i++) if (!finished(allStops[i])) { suggested = allStops[i]; break; }

    trails.forEach(function (t) {
      var list = el('ol', { class: 'kt-path' });
      t.stops.forEach(function (s, idx) {
        var body = el('span', { class: 'kt-stop__body' }, [el('span', { class: 'kt-stop__title', text: s.title }), starsEl(s)]);
        if (s === suggested) body.appendChild(el('span', { class: 'kt-stop__next', text: '\u2192 Next stop' }));
        list.appendChild(el('li', null, [el('button', { class: 'kt-stop', type: 'button', onclick: function () { go(s.slug); } }, [
          el('span', { class: 'kt-stop__num', text: String(idx + 1), 'aria-hidden': 'true' }),
          el('span', { class: 'kt-stop__icon', text: s.icon, 'aria-hidden': 'true' }),
          body
        ])]));
      });
      root.appendChild(el('div', { class: 'kt-trail' }, [el('h3', { class: 'kt-trail__name', text: t.name }), list]));
    });
  }

  /* ---------- stop view ---------- */
  function renderStop(s, stepId) {
    stopSpeaking();
    var steps = STEPS.filter(function (st) {
      if (st.id === 'learn') return s.quiz && s.quiz.length;
      if (st.id === 'play') return hasPlay(s);
      return true;
    });
    var idx = 0;
    steps.forEach(function (st, i) { if (st.id === stepId) idx = i; });

    root.innerHTML = '';
    var tabs = el('div', { class: 'kt-tabs', role: 'tablist', 'aria-label': 'Adventure steps' });
    var panel = el('div', { class: 'kt-panel', role: 'tabpanel', tabindex: '-1' });
    var view = el('div', { class: 'kt-view' }, [
      el('div', { class: 'kt-view__head' }, [
        el('span', { class: 'kt-view__icon', text: s.icon, 'aria-hidden': 'true' }),
        el('h3', { class: 'kt-view__title', text: s.title }),
        starsEl(s),
        el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83d\uddfa Trail map', onclick: function () { go(''); } })
      ]),
      tabs, panel
    ]);
    root.appendChild(view);

    function show(i) {
      stopSpeaking();
      idx = i;
      tabs.innerHTML = '';
      var g = progress[s.slug] || {};
      steps.forEach(function (st, j) {
        tabs.appendChild(el('button', {
          class: 'kt-tab' + (g[st.id] ? ' done' : ''), type: 'button', role: 'tab',
          'aria-selected': j === i ? 'true' : 'false', onclick: function () { show(j); }
        }, [el('span', { text: st.icon, 'aria-hidden': 'true' }), st.label]));
      });
      panel.innerHTML = '';
      panel.appendChild(el('p', { class: 'kt-step-label', text: 'Step ' + (i + 1) + ' of ' + steps.length + ' \u00b7 ' + steps[i].label }));
      BUILD[steps[i].id](s, panel, function () { refreshStars(); });
      var nav = el('div', { class: 'kt-nav' }, [
        i > 0 ? el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\u2190 Back', onclick: function () { show(i - 1); } }) : el('span'),
        i < steps.length - 1 ? el('button', { class: 'kt-btn', type: 'button', text: 'Next: ' + steps[i + 1].label + ' \u2192', onclick: function () { show(i + 1); } }) : el('span')
      ]);
      panel.appendChild(nav);
      panel.focus({ preventScroll: true });
    }
    function refreshStars() {
      var head = view.querySelector('.kt-view__head .kt-stars');
      if (head) head.parentNode.replaceChild(starsEl(s), head);
      tabs.querySelectorAll('.kt-tab').forEach(function (b, j) { if ((progress[s.slug] || {})[steps[j].id]) b.classList.add('done'); });
    }
    show(idx);
  }

  var BUILD = {
    discover: function (s, p) {
      p.appendChild(el('h4', { class: 'kt-h', text: 'Discover' }));
      p.appendChild(s.image ? el('img', { class: 'kt-hero-img', src: s.image, alt: '' }) : el('div', { class: 'kt-hero-icon', text: s.icon, 'aria-hidden': 'true' }));
      p.appendChild(el('p', { class: 'kt-big', text: s.discover }));
    },
    read: function (s, p) {
      p.appendChild(el('h4', { class: 'kt-h', text: 'Read the story' }));
      p.appendChild(el('div', { class: 'kt-story', html: s.story }));
      if (s.bibleUrl) p.appendChild(el('div', { class: 'kt-row' }, [
        el('a', { class: 'kt-btn kt-btn--yellow', href: s.bibleUrl, text: '\ud83d\udcd6 Read ' + (s.refLabel || 'it') + ' in the Bible' })
      ]));
    },
    listen: function (s, p) {
      p.appendChild(el('h4', { class: 'kt-h', text: 'Listen to the story' }));
      if (s.audio) p.appendChild(el('audio', { controls: '', preload: 'none', src: s.audio }));
      if (canSpeak) {
        p.appendChild(el('p', { class: 'kt-note', 'data-kjt-voice': '', text: s.audio ? 'Or let your device read it to you:' : 'Press play and your device will read the story to you.' }));
        p.appendChild(el('div', { class: 'kt-row', 'data-kjt-voice': '' }, [
          el('button', { class: 'kt-btn', type: 'button', text: '\u25b6 Read it to me', onclick: function () { speak(s.title + '. ' + s.discover + ' ' + plain(s.story)); } }),
          el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\u25a0 Stop', onclick: stopSpeaking })
        ]));
      }
      if (!s.audio) p.appendChild(el('p', { class: 'kt-big', 'data-kjt-voice-none': '', text: 'Ask a grown-up to read the story aloud with you. \ud83d\udc9b' }));
      if (V) V.apply(p);
    },
    learn: function (s, p, changed) {
      p.appendChild(el('h4', { class: 'kt-h', text: 'Quiz time!' }));
      var left = s.quiz.length;
      s.quiz.forEach(function (q, qi) {
        var fb = el('p', { class: 'kt-feedback', 'aria-live': 'polite' });
        var opts = el('div', { class: 'kt-options' });
        shuffle(['a', 'b', 'c']).forEach(function (k) { /* 5.3.0: answers in a new order each time */
          if (!q[k]) return;
          var b = el('button', { class: 'kt-opt', type: 'button', text: q[k], onclick: function () {
            if (k === q.correct) {
              b.classList.add('right'); b.textContent = '\u2713 ' + q[k];
              opts.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
              fb.className = 'kt-feedback'; fb.textContent = pick(PRAISE);
              if (--left === 0) { mark(s.slug, 'learn'); changed(); p.insertBefore(el('p', { class: 'kt-box', text: '\ud83c\udf89 You answered every question! You earned a star.' }), p.querySelector('.kt-nav')); }
            } else {
              b.classList.add('gentle'); b.disabled = true;
              fb.className = 'kt-feedback try'; fb.textContent = 'Good try! Have another go.';
            }
          } });
          opts.appendChild(b);
        });
        p.appendChild(el('div', { class: 'kt-q' }, [el('p', { class: 'kt-q__text', text: (qi + 1) + '. ' + q.q }), opts, fb]));
      });
    },
    play: function (s, p, changed) {
      p.appendChild(el('h4', { class: 'kt-h', text: 'Play' }));
      var games = 0, done = 0;
      function won() { if (++done === games) { mark(s.slug, 'play'); changed(); } }

      if (s.steps && s.steps.length > 1) {
        games++;
        var order = shuffle(s.steps), tries = 0;
        while (order.join('|') === s.steps.join('|') && tries++ < 10) order = shuffle(s.steps);
        var chosen = el('ol', { class: 'kt-chosen' }), pool = el('ul', { class: 'kt-order' });
        var fb = el('p', { class: 'kt-feedback', 'aria-live': 'polite' }), next = 0;
        order.forEach(function (text) {
          var b = el('button', { class: 'kt-opt', type: 'button', text: text, onclick: function () {
            if (text === s.steps[next]) {
              next++; chosen.appendChild(el('li', { text: text })); b.parentNode.remove();
              fb.className = 'kt-feedback'; fb.textContent = next === s.steps.length ? '\ud83c\udf89 You put the story in order!' : '\u2b50 Yes! What happened next?';
              if (next === s.steps.length) won();
            } else {
              b.classList.remove('kt-shake'); void b.offsetWidth; b.classList.add('kt-shake');
              fb.className = 'kt-feedback try'; fb.textContent = 'Not quite. What happened next?';
            }
          } });
          pool.appendChild(el('li', null, [b]));
        });
        p.appendChild(el('div', { class: 'kt-box' }, [
          el('h4', { text: '\ud83d\udd22 Put the story in order' }),
          el('p', { class: 'kt-note', text: 'Tap what happened first, then what happened next.' }),
          el('div', { style: 'margin-top:1rem' }, [chosen, pool, fb])
        ]));
      }

      var vText = L(s.verse), vWord = L(s.missing), m = findWord(vText, vWord);
      if (!m) { vText = s.verse; vWord = s.missing; m = findWord(vText, vWord); }
      if (m) {
        games++;
        var before = vText.slice(0, m.index), after = vText.slice(m.index + m.text.length);
        m = [m.text];
        var blank = el('span', { class: 'kt-blank', text: '?' });
        var others = [];
        allStops.forEach(function (o) { if (o.missing && o.missing.toLowerCase() !== s.missing.toLowerCase()) others.push(vText === s.verse ? o.missing : L(o.missing)); });
        EXTRA_WORDS.forEach(function (w) { if (w !== s.missing.toLowerCase()) others.push(vText === s.verse ? w : L(w)); });
        var seen = {}, choices = [m[0]];
        shuffle(others).forEach(function (w) { var k = w.toLowerCase(); if (choices.length < 3 && !seen[k] && k !== m[0].toLowerCase()) { seen[k] = 1; choices.push(w); } });
        var fb2 = el('p', { class: 'kt-feedback', 'aria-live': 'polite' }), opts = el('div', { class: 'kt-options' });
        shuffle(choices).forEach(function (w) {
          var b = el('button', { class: 'kt-opt', type: 'button', text: w, onclick: function () {
            if (w === m[0]) {
              blank.textContent = m[0]; b.classList.add('right');
              opts.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
              fb2.className = 'kt-feedback'; fb2.textContent = '\u2b50 You remembered the verse!'; won();
            } else { b.classList.add('gentle'); b.disabled = true; fb2.className = 'kt-feedback try'; fb2.textContent = 'Good try! Which word fits?'; }
          } });
          opts.appendChild(b);
        });
        p.appendChild(el('div', { class: 'kt-box' }, [
          el('h4', { text: '\ud83e\udde0 Finish the memory verse' }),
          el('blockquote', { class: 'kt-verse', 'data-kjt-notr': '' }, [before, blank, after, s.verseRef ? el('cite', { text: L(s.verseRef) }) : null]),
          opts, fb2
        ]));
      }
    },
    grow: function (s, p, changed) {
      p.appendChild(el('h4', { class: 'kt-h', text: 'Grow' }));
      if (s.verse) p.appendChild(el('blockquote', { class: 'kt-verse' }, [s.verse, s.verseRef ? el('cite', { text: s.verseRef }) : null]));
      if (s.lesson) p.appendChild(el('div', { class: 'kt-box' }, [el('h4', { text: '\ud83c\udf31 Today I learned' }), el('p', { text: s.lesson })]));
      if (s.prayer) p.appendChild(el('div', { class: 'kt-box' }, [el('h4', { text: '\ud83d\ude4f Let\'s pray' }), el('p', { text: s.prayer })]));
      var end = el('div', { class: 'kt-celebrate' });
      function celebrate() {
        end.innerHTML = '';
        var nx = nextStop(s);
        end.appendChild(el('p', { class: 'kt-celebrate__stars', text: '\u2b50 \ud83c\udf31 \u2b50', 'aria-hidden': 'true' }));
        end.appendChild(el('p', { class: 'kt-big', text: 'You finished "' + s.title + '"! Well done.' }));
        end.appendChild(el('div', { class: 'kt-row', style: 'justify-content:center' }, [
          nx ? el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: 'Next stop: ' + nx.icon + ' ' + nx.title + ' \u2192', onclick: function () { go(nx.slug); } }) : null,
          el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83d\uddfa Back to the trail map', onclick: function () { go(''); } })
        ]));
      }
      if (finished(s)) celebrate();
      else end.appendChild(el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '\u2705 I finished this stop!', onclick: function () { mark(s.slug, 'grow'); changed(); celebrate(); } }));
      p.appendChild(end);
    }
  };

  /* ---------- certificate (name is never stored) ---------- */
  function certificate(t) {
    var name = window.prompt('Whose name should go on the certificate?', '') || '';
    var old = document.querySelector('.kjt-cert-print'); if (old) old.remove();
    var cert = el('div', { class: 'kjt-cert-print' }, [
      el('p', { text: 'Knowing Jesus Today \u00b7 Kids Corner' }),
      el('h1', { text: '\ud83c\udfc5 Certificate of Adventure' }),
      el('p', { text: 'This is to celebrate that' }),
      el('div', { class: 'name', text: name.trim() || '________________' }),
      el('p', { text: 'has completed the ' + t.name.replace(/^\S+\s/, '') + ' on the Bible Adventure Trail:' }),
      el('p', { class: 'stops', text: t.stops.map(function (s) { return s.icon + ' ' + s.title; }).join('  \u00b7  ') }),
      el('p', { text: 'Learn it. Live it. Share it.' }),
      el('p', { text: new Date().toLocaleDateString() })
    ]);
    document.body.appendChild(cert);
    document.body.classList.add('kjt-printing-cert');
    var done = function () { document.body.classList.remove('kjt-printing-cert'); cert.remove(); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(function () { if (document.body.classList.contains('kjt-printing-cert') && !window.matchMedia('print').matches) done(); }, 1500);
  }

  /* ---------- routing (#adventure/<stop>) ---------- */
  function go(slug) {
    var target = slug ? '#adventure/' + slug : '#adventure-trail';
    if (location.hash === target) route(); else location.hash = target;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function route() {
    var m = location.hash.match(/^#adventure\/([\w-]+)/);
    var s = m ? find(m[1]) : null;
    if (s) renderStop(s, 'discover'); else if (root.querySelector('.kt-view') || !root.querySelector('.kt-passport')) renderMap();
  }
  window.addEventListener('hashchange', route);
  route();
  if (/^#adventure\//.test(location.hash)) setTimeout(function () { section.scrollIntoView({ block: 'start' }); }, 50);
})();
