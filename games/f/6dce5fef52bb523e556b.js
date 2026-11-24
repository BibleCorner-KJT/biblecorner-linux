/* KJT Kids Corner - Bible Games (Site Core 5.5.0)
   A menu of games in four groups (Action, Thinking & Puzzles, Family, Explore),
   with a Daily Challenge, personal bests and a trophy shelf (bronze = Easy,
   silver = Medium, gold = Hard). Everything runs in the browser; scores and
   trophies are kept on this device only.
   Games live in: this file (Word Seek, Spot the Difference, Picture Puzzle),
   games-action.js, games-think.js, games-family.js, games-explore.js.
   Each registers itself with window.KJTGames.register({...}).
   Site Core 7.0.0: those four files load when Bible Games comes near the screen. */
(function () {
  'use strict';
  /* 7.9.12: two places draw games: Bible Games ([data-kjt-games]) and Little Lambs, the early learning games ([data-kjt-early]).
     One game plays at a time; root is the place of the game being played. */
  var ROOT_MAIN = document.querySelector('[data-kjt-games]'), ROOT_EARLY = document.querySelector('[data-kjt-early]'), root = ROOT_MAIN || ROOT_EARLY;
  /* 7.9.20: Little Lambs (action) live in Kids Corner, every other game on the Fun & Games page */
  function rootOf(g) { return g && g.cat === 'action' ? ROOT_EARLY : ROOT_MAIN; }
  var dataEl = document.getElementById('kjt-games-data');
  var DATA = {}; try { DATA = JSON.parse(dataEl ? dataEl.textContent : '{}'); } catch (e) {}
  var THEMES = DATA.words || [], IMAGES = DATA.images || [], EXTRA = DATA.extra || {};
  var REG = [];
  /* 7.9.0: Kids Corner in another language - the letter games use that language's own words
     (assets/kids-games/lang/<lang>.json); letters are counted as the reader sees them (graphemes). */
  var PL = (window.KJT_LANG || {}).lang || 'en', LW = null;
  if (PL !== 'en' && DATA.langBase) fetch(DATA.langBase + PL + '.json', { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { LW = j; }).catch(function () {});
  var SEG = null; try { if (window.Intl && Intl.Segmenter) SEG = new Intl.Segmenter(undefined, { granularity: 'grapheme' }); } catch (e) {}
  function G(s) { s = String(s || ''); if (SEG) return Array.from(SEG.segment(s), function (x) { return x.segment; }); try { return s.match(/\P{M}\p{M}*/gu) || []; } catch (e) { return s.split(''); } }
  function T(s) { return (PL !== 'en' && window.KJT_LANG) ? window.KJT_LANG.t(s) : s; }
  var FILL = { en: 'ABCDEFGHIJKLMNOPRSTUVWY', tl: 'ABDEGHIKLMNOPRSTUWY', ru: 'АБВГДЕИКЛМНОПРСТУЯ', el: 'ΑΒΓΔΕΗΙΚΛΜΝΟΠΡΣΤΥΩ', fr: 'ABCDEFGHIJLMNOPRSTUVE', es: 'ABCDEFGHIJLMNOPRSTUVYZ', ar: 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي', zh: '主神爱光人天王山水火日月心生羊石', hi: 'कखगचजतदनपबमयरलवसह' };

  /* ---------- helpers shared by every game (the "kit") ---------- */
  var seed = 0;
  function mulberry() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  function rand() { return seed ? mulberry() : Math.random(); }
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v;
      else if (k === 'style') n.style.cssText = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function rnd(a, b) { return a + rand() * (b - a); }
  function ri(a, b) { return Math.floor(rnd(a, b + 1)); }
  function pick(a) { return a[Math.floor(rand() * a.length)]; }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem('kjt_games_' + k)); localStorage.setItem('kjt_games_' + k, JSON.stringify(v)); if (/^mp_/.test(k) && window.KJTGamesSync) KJTGamesSync(); } catch (e) { return null; } }
  function sound(n) { if (window.KJTSound) window.KJTSound.play(n); }
  var PRAISE = ['Wonderful!', 'Well done!', 'Brilliant!', 'Great job!', 'Super!', 'Amazing!', 'Glory to God!'];
  function celebrate(box, text, again, extra) {
    var c = el('div', { class: 'kg-done', role: 'status' }, [
      el('p', { class: 'kg-done__stars', text: '\u2b50 \ud83c\udf89 \u2b50', 'aria-hidden': 'true' }),
      el('p', { class: 'kg-done__text' }, [el('span', { text: pick(PRAISE) }), ' ', el('span', { text: text })]),
      extra || null,
      el('div', { class: 'kt-row', style: 'justify-content:center' }, [
        el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: 'Play again \u2192', onclick: again || function () { start(); } }),
        el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83c\udfae All games', onclick: function () { showMenu(); } })
      ])
    ]);
    box.appendChild(c);
    c.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  function note(box, text, cls) { var n = box.querySelector('.kg-note'); if (!n) { n = el('p', { class: 'kg-note', 'aria-live': 'polite' }); box.appendChild(n); } n.className = 'kg-note ' + (cls || ''); n.textContent = text; }
  function nextImages(filter) {
    var list = IMAGES.filter(filter || function () { return true; });
    var recent = store('recentimg') || [];
    function rank(x) { var i = recent.indexOf(x.src); return i < 0 ? -1 : 1000 - i; }
    return shuffle(list).sort(function (a, b) { return rank(a) - rank(b); });
  }
  function rememberImage(src) { var r = (store('recentimg') || []).filter(function (x) { return x !== src; }); r.unshift(src); store('recentimg', r.slice(0, Math.max(3, Math.floor(IMAGES.length / 2)))); }
  function loadImage(src) { return new Promise(function (res, rej) { var i = new Image(); i.decoding = 'async'; i.onload = function () { res(i); }; i.onerror = rej; i.src = src; }); }
  /* Trophies: bronze (Easy), silver (Medium), gold (Hard); the best one is kept. */
  var MEDAL = { easy: 1, medium: 2, hard: 3, ultra: 3 }, MEDAL_ICON = ['', '\ud83e\udd49', '\ud83e\udd48', '\ud83e\udd47'];
  function award(id, level) {
    var t = store('trophies') || {}, m = MEDAL[level] || 1, isNew = (t[id] || 0) < m;
    if (isNew) { t[id] = m; store('trophies', t); }
    try { window.dispatchEvent(new CustomEvent('kjt-achieve', { detail: { type: 'trophy' } })); } catch (e) {}
    if (daily && daily.id === id && daily.level === level) { var d = store('daily') || {}; d[daily.key] = 1; store('daily', d); }
    return isNew;
  }
  /* Personal bests per game and level ('high' = bigger is better, 'low' = smaller). */
  function best(id, level, score, dir) {
    var b = store('best') || {}, k = id + ':' + level, old = b[k], better = old === undefined || old === null || (dir === 'low' ? score < old : score > old);
    if (better) { b[k] = score; store('best', b); }
    return { best: better ? score : old, isNew: better && old !== undefined && old !== null, first: old === undefined || old === null };
  }
  function bestOf(id, level) { var b = store('best') || {}; return b[id + ':' + level]; }
  var cleanups = [];
  function onLeave(fn) { cleanups.push(fn); }
  function leave() { if (window.KJTVoice) window.KJTVoice.stop(); cleanups.splice(0).forEach(function (f) { try { f(); } catch (e) {} }); }
  /* Questions: the game bank, plus the Adventure Trail quizzes and Who Am I? riddles already on the page. */
  var QCACHE = null;
  function questions() {
    if (QCACHE) return QCACHE;
    var out = (EXTRA.questions || []).map(function (q) { return { cat: q.cat, lvl: q.lvl, q: q.q, a: q.a.slice() }; });
    try { JSON.parse(document.getElementById('kjt-trail-data').textContent).trails.forEach(function (t) { t.stops.forEach(function (s) { (s.quiz || []).forEach(function (q) { var r = q[q.correct]; var w = ['a', 'b', 'c'].filter(function (k) { return k !== q.correct && q[k]; }).map(function (k) { return q[k]; }); if (r && w.length) out.push({ cat: t.key === 'saints' ? 'church' : t.key === 'jesus' ? 'nt' : 'ot', lvl: 1, q: q.q, a: [r].concat(w) }); }); }); }); } catch (e) {}
    try { JSON.parse(document.getElementById('kjt-whoami-data').textContent).forEach(function (r) { if (r.answer && r.wrong1 && r.wrong2) out.push({ cat: /^Saint/.test(r.answer) ? 'church' : 'mixed', lvl: 2, q: 'Who am I? ' + r.clues.join(' '), a: [r.answer, r.wrong1, r.wrong2] }); }); } catch (e) {}
    return (QCACHE = out);
  }
  /* ---------- 7.20.0: play with a friend by a game code (chess and Word Builder) ----------
     One player starts a game and gets a code (or a link to send); the friend types the code or opens the link.
     The two phones read a small file on the site every few seconds while waiting; nothing else is kept. */
  var MP = window.KJT_MP || null;
  function mpPost(data) {
    var fd = new URLSearchParams(); fd.set('action', 'kjt_mp');
    Object.keys(data).forEach(function (k) { fd.set(k, typeof data[k] === 'object' ? JSON.stringify(data[k]) : String(data[k])); });
    return fetch(MP.a, { method: 'POST', body: fd, credentials: 'omit', cache: 'no-store' }).then(function (r) {
      return r.json().catch(function () { return { success: false, data: { why: 'net' } }; }).then(function (j) {
        if (!j || !j.success) { var e = new Error((j && j.data && j.data.why) || 'net'); e.why = e.message; e.data = j && j.data && j.data.data; throw e; }
        return j.data;
      });
    });
  }
  var net = {
    ok: function () { return !!MP; },
    saved: function (game) { var x = store('mp_' + game); return x && x.code ? x : null; },
    /* 7.25.0: leaving a game keeps your place in it, so you can come back (after a crash, or later): "Continue the online
       game". It is let go only when the game is over on the site (24 hours without a move) or moved to another device. */
    forget: function (game) { var x = store('mp_' + game); if (x && x.code) { x.left = 1; store('mp_' + game, x); } },
    drop: function (game) { store('mp_' + game, null); },
    create: function (game, state, seats) { return mpPost({ op: 'new', game: game, state: state, seats: seats || 2, name: myName() }).then(function (s) { store('mp_' + game, s); return s; }); },
    /* 7.25.0: a code of 8 is a move code: this device takes over the player's place from the other device */
    join: function (game, code) { return mpPost({ op: 'join', code: code, game: game, name: myName() }).then(function (s) { if (s.game !== game) { var e = new Error('other'); e.why = 'other'; e.game = s.game; throw e; } store('mp_' + game, { code: s.code, key: s.key, seat: s.seat, v: s.v, game: s.game, id: s.id || '' }); return s; }); },
    get: function (s) { return fetch(MP.f + s.code + '.json?n=' + Date.now(), { cache: 'no-store', credentials: 'omit' }).then(function (r) { if (r.status === 404) return mpPost({ op: 'get', code: s.code }); if (!r.ok) throw new Error('net'); return r.json(); })
      /* 7.25.0: 24 hours without a move: the game is over (the site removes it) */
      .then(function (d) { if (d && d.t && Date.now() / 1000 - d.t > 86400) return mpPost({ op: 'get', code: s.code }); return d; })
      .catch(function (e) { if (e && e.why === 'gone' && s.game) { var x = store('mp_' + s.game); if (x && x.code === s.code) net.drop(s.game); } throw e; }); },
    /* 7.21.0: change the shared game with fn(state) (both players at once: tried again on the latest) */
    update: function (s, fn, tries) {
      tries = tries || 0;
      return net.get(s).then(function (d) { s.v = d.v; return net.put(s, fn(d.state)).then(function () { return d; }); }).catch(function (e) { if (e && e.why === 'late' && tries < 5) return net.update(s, fn, tries + 1); throw e; });
    },
    put: function (s, state) { return mpPost({ op: 'put', code: s.code, key: s.key, seat: s.seat, v: s.v, state: state }).then(function (r) { s.v = r.v; store('mp_' + s.game, s); return r.v; }); },
    /* calls back with the game's file whenever it changes; slows down when the page is hidden */
    watch: function (s, cb) {
      var stopped = false, timer = null, fails = 0;
      function tick() {
        timer = null; if (stopped) return;
        if (document.hidden) { timer = setTimeout(tick, 6000); return; }
        net.get(s).then(function (d) { fails = 0; if (stopped) return;
          /* 7.25.0: this player's place was taken over on another device */
          if (d && d.ids && s.id && d.ids[s.seat] && d.ids[s.seat] !== s.id) { stop(); net.drop(s.game); movedAway(); cb(null); return; }
          if (d) { s.last = d; if (mbar && mbar.names) mbar.names(d); }
          if (d && d.v > s.v) { s.v = d.v; store('mp_' + s.game, s); cb(d); } else if (d && d.seats) cb(d, true);
          if (d) friendName(here, s, d); })
          .catch(function (e) { fails++; if (e && e.why === 'gone') { stopped = true; cb(null); } })
          .then(function () { if (!stopped) timer = setTimeout(tick, fails ? Math.min(15000, 2500 * (fails + 1)) : 2500); });
      }
      function vis() { if (!document.hidden && !stopped && timer) { clearTimeout(timer); tick(); } }
      document.addEventListener('visibilitychange', vis); tick();
      var here = stage, mbar = moveBar(s);
      if (s.left) { delete s.left; store('mp_' + s.game, s); }
      function movedAway() { if (here && document.body.contains(here)) here.insertBefore(el('p', { class: 'kg-net__moved', text: '📲 ' + T('This game now goes on on your other device.') }), here.firstChild); }
      var stop = function () { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', vis); if (mbar) mbar.remove(); };
      cur = s; onLeave(stop); onLeave(function () { if (cur === s) cur = null; }); return stop;
    },
    link: function (game, code) { return location.origin + '/fun-and-games/?kg_join=' + code + '#play-' + game; },
    /* a game code asked for in the address (?kg_join=CODE), used once */
    pending: function (game) {
      try { var u = new URL(location.href), c = (u.searchParams.get('kg_join') || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); if (!c || !new RegExp('#play-' + game + '$').test(location.hash)) return ''; u.searchParams.delete('kg_join'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); return c; } catch (e) { return ''; }
    },
    why: function (e) {
      var w = e && e.why;
      if (w === 'move') return T('This move code is not valid any more. Make a new one on your other device.');
      if (w === 'key') return T('This game now goes on on your other device.');
      if (w === 'rude') return T('Please choose a kind name.');
      return T(w === 'full' ? 'This game is already full.' : w === 'gone' || w === 'code' ? 'No game has this code. Check the code, or start a new game.' : w === 'other' ? 'This code is for a different game.' : w === 'busy' ? 'Too many new games just now. Try again in a little while.' : 'There is no internet connection. Playing with a friend online needs the internet on both phones.');
    },
    /* the code, big, with Copy and Share */
    card: function (game, code, waiting) {
      var link = net.link(game, code), msg = el('p', { class: 'kg-net__msg', 'aria-live': 'polite' });
      var box = el('div', { class: 'kg-net' }, [
        el('p', { class: 'kg-net__t', text: T('Your game code') }),
        el('p', { class: 'kg-net__code', text: code.replace(/(...)(...)/, '$1 $2') }),
        el('p', { class: 'kg-net__how', text: T('Your friend opens this game, chooses "Play with a friend", and types the code. Or send them the link.') }),
        el('div', { class: 'kt-row', style: 'justify-content:center' }, [
          navigator.share ? el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '📤 ' + T('Send the link'), onclick: function () { navigator.share({ title: T('Play with me'), text: T('Play with me! Game code:') + ' ' + code, url: link }).catch(function () {}); } }) : null,
          el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '📋 ' + T('Copy the link'), onclick: function () { var done = function () { msg.textContent = T('Copied.'); }; if (navigator.clipboard) navigator.clipboard.writeText(link).then(done, function () { msg.textContent = link; }); else msg.textContent = link; } })
        ]),
        msg
      ]);
      if (waiting) box.appendChild(el('p', { class: 'kg-net__wait' }, [el('span', { class: 'kgm-spin', 'aria-hidden': 'true' }), el('span', { text: T('Waiting for your friend to join…') })]));
      return box;
    },
    /* the "Play with a friend" choices: start a game, or join one with a code */
    chooser: function (game, onNew, onJoin, code0) {
      var msg = el('p', { class: 'kg-net__msg', 'aria-live': 'polite' });
      var inp = el('input', { class: 'kg-net__in', type: 'text', inputmode: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: '9', placeholder: 'ABC 123', 'aria-label': T('Game code') });
      if (code0) inp.value = code0;
      var busy = false;
      /* 7.25.0: opened from a "your turn" notice: go straight on with the saved game */
      if (autoResume === game) { autoResume = ''; setTimeout(function () { var p = box.parentNode, c = p && [].filter.call(p.querySelectorAll('button'), function (b) { return /^\u21bb/.test((b.textContent || '').trim()); })[0]; if (c) c.click(); }, 30); }
      function run(p) { if (busy) return; if (!navigator.onLine) { msg.textContent = net.why({}); return; } store('myname', nm.value.trim().slice(0, 16)); askNotes(); busy = true; msg.textContent = T('One moment…'); p().catch(function (e) { msg.textContent = net.why(e); }).then(function () { busy = false; }); }
      var nm = el('input', { class: 'kg-net__name', type: 'text', maxlength: '16', autocomplete: 'nickname', placeholder: T('Your name (optional)'), 'aria-label': T('Your name (optional)') });
      nm.value = myName(); nm.addEventListener('change', function () { store('myname', nm.value.trim().slice(0, 16)); });
      var box = el('div', { class: 'kg-net kg-net--choose' }, [
        el('p', { class: 'kg-net__t', text: '🌐 ' + T('Play with a friend online') }),
        el('label', { class: 'kg-net__namel' }, [el('span', { text: '🙂 ' + T('Your name') }), nm]),
        el('p', { class: 'kg-net__how', text: T('On two phones, near or far. Both need the internet. No account is needed.') }),
        el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '➕ ' + T('Start a new game'), onclick: function () { run(onNew); } })]),
        el('p', { class: 'kg-net__or', text: T('or join your friend’s game:') }),
        el('div', { class: 'kg-net__join' }, [inp, el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: T('Join'), onclick: function () { var c = inp.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); if (c.length !== 6 && c.length !== 8) { msg.textContent = T('The code has 6 letters and numbers.'); return; } run(function () { return onJoin(c); }); } })]),
        el('p', { class: 'kg-net__small', text: '📲 ' + T('Playing on another device? Make a move code there ("Continue on another device") and type it here.') }),
        msg
      ]);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') box.querySelector('.kg-net__join button').click(); });
      return box;
    },
    /* your turn: a sound and a little buzz (7.25.0: and a notice when the page is not in view) */
    nudge: function () { sound('bell'); try { if (navigator.vibrate) navigator.vibrate(120); } catch (e) {} turnNote(); }
  };
  /* ---------- 7.25.0: "Your turn" notices, and moving a game to another device ----------
     The game being played online (cur); a notice when it becomes your turn while the page is hidden (the browser's own
     notices, or the Bible Corner app's). The app also checks the games by itself while it is closed (KJTNative.games). */
  var cur = null, autoResume = '';
  /* 7.25.0: the name you choose for online games (kept on this device; the site refuses unkind names) */
  function myName() { var n = store('myname'); return typeof n === 'string' ? n : ''; }
  function nameOf(d, seat) { return (d && d.names && d.names[seat]) || ''; }
  /* in a game for two, where it says "Your friend", the friend's name */
  function friendName(box, s, d) {
    if (!box || !d || !d.seats || d.seats.length !== 2) return; var nm = nameOf(d, 1 - s.seat); if (!nm) return;
    var want = [T('Your friend'), 'Your friend'], w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) { var t = n.nodeValue.trim(); if (t && want.indexOf(t) >= 0 && !(n.parentNode && n.parentNode.closest && n.parentNode.closest('.kg-move'))) n.nodeValue = n.nodeValue.replace(t, nm); }
  }
  function gameName(id) { var g = find(id); return g ? (g.icon ? g.icon + ' ' : '') + g.name : T('Games'); }
  function askNotes() {
    try { if (window.KJTNative) return; if (window.Notification && Notification.permission === 'default') Notification.requestPermission().catch(function () {}); } catch (e) {}
  }
  var titleWas = '';
  function turnNote() {
    if (!cur || (!document.hidden && document.hasFocus && document.hasFocus())) return;
    var by = cur.last && typeof cur.last.by === 'number' && cur.last.by !== cur.seat ? nameOf(cur.last, cur.last.by) : '';
    var t = gameName(cur.game), x = (by ? by + ' · ' : '') + T('It is your turn.'), u = location.origin + '/fun-and-games/?kg_resume=1#play-' + cur.game;
    try {
      if (window.KJTNative && KJTNative.gameNote) KJTNative.gameNote(t, x, u);
      else if (window.Notification && Notification.permission === 'granted') { var n = new Notification(t, { body: x, tag: 'kjt-game-' + cur.code, renotify: true, icon: (document.querySelector('link[rel~="icon"]') || {}).href }); n.onclick = function () { try { window.focus(); } catch (e) {} n.close(); }; }
    } catch (e) {}
    if (document.hidden) { if (!titleWas) titleWas = document.title; document.title = '🔔 ' + x + ' · ' + t; }
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden && titleWas) { document.title = titleWas; titleWas = ''; } });
  /* the app keeps the list of games going on, and looks at them itself every few minutes while it is closed */
  window.KJTGamesSync = function () {
    clearTimeout(window.KJTGamesSync.t); window.KJTGamesSync.t = setTimeout(function () {
      if (!window.KJTNative || !KJTNative.games || !MP) return;
      var out = [];
      try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (!/^kjt_games_mp_/.test(k)) continue; var s = JSON.parse(localStorage.getItem(k)); if (!s || !s.code || s.left) continue;
        out.push({ c: s.code, s: s.seat, v: s.v || 0, i: s.id || '', n: gameName(s.game), f: location.origin + MP.f + s.code + '.json', u: location.origin + '/fun-and-games/?kg_resume=1#play-' + s.game }); } } catch (e) {}
      try { KJTNative.games(JSON.stringify(out)); } catch (e) {}
    }, 50);
  };
  /* "Continue on another device": a move code for this place in the game (30 minutes, used once) */
  function moveBar(s) {
    if (!stage || !s || !s.key || stage.querySelector('.kg-move')) return null;
    var box = el('div', { class: 'kg-move' }), msg = el('div', { class: 'kg-move__out', 'aria-live': 'polite' });
    /* the players' names, and yours to change */
    var who = el('p', { class: 'kg-move__who' }), ren = el('div', { class: 'kg-move__ren', hidden: 'hidden' });
    var rin = el('input', { class: 'kg-net__name', type: 'text', maxlength: '16', placeholder: T('Your name'), 'aria-label': T('Your name') }), rmsg = el('span', { class: 'kg-net__msg' });
    ren.appendChild(rin); ren.appendChild(el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: T('Save'), onclick: function () {
      var v = rin.value.trim().slice(0, 16); rmsg.textContent = T('One moment…');
      mpPost({ op: 'name', code: s.code, seat: s.seat, key: s.key, name: v }).then(function (r) { store('myname', v); ren.hidden = true; rmsg.textContent = ''; if (s.last) { s.last.names = r.names; box.names(s.last); } }, function (e) { rmsg.textContent = net.why(e); });
    } })); ren.appendChild(rmsg);
    box.names = function (d) {
      who.innerHTML = ''; if (!d || !d.seats) return;
      who.appendChild(el('span', { text: '👥 ' }));
      d.seats.forEach(function (on, i) { if (!on) return; var nm = nameOf(d, i) || (i === s.seat ? T('You') : T('Player') + ' ' + (i + 1));
        who.appendChild(el('span', { class: 'kg-move__p' + (i === s.seat ? ' me' : ''), text: nm + (i === s.seat && nameOf(d, i) ? ' (' + T('you') + ')' : '') })); });
      who.appendChild(el('button', { class: 'kg-move__edit', type: 'button', title: T('Your name'), 'aria-label': T('Your name'), text: '✏️', onclick: function () { ren.hidden = !ren.hidden; rin.value = nameOf(d, s.seat) || myName(); if (!ren.hidden) rin.focus(); } }));
    };
    box.appendChild(who); box.appendChild(ren);
    var b = el('button', { class: 'kt-btn kt-btn--ghost kg-move__b', type: 'button', text: '📲 ' + T('Continue on another device'), onclick: function () {
      if (b.disabled) return; b.disabled = true; msg.textContent = T('One moment…');
      mpPost({ op: 'pass', code: s.code, seat: s.seat, key: s.key }).then(function (r) {
        var link = location.origin + '/fun-and-games/?kg_join=' + r.move + '#play-' + s.game; msg.innerHTML = '';
        msg.appendChild(el('p', { class: 'kg-net__t', text: T('Your move code') }));
        msg.appendChild(el('p', { class: 'kg-net__code', text: r.move.replace(/(....)(....)/, '$1 $2') }));
        msg.appendChild(el('p', { class: 'kg-net__how', text: T('On the other device (phone, computer, at home or at work), open this game, choose to play with a friend online, and type this code where you join a game. Or open the link there. Your place in the game moves there; this device stops playing it. The code works once, for 30 minutes.') }));
        msg.appendChild(el('div', { class: 'kt-row', style: 'justify-content:center' }, [
          navigator.share ? el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '📤 ' + T('Send the link'), onclick: function () { navigator.share({ title: gameName(s.game), text: T('Your move code') + ': ' + r.move, url: link }).catch(function () {}); } }) : null,
          el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '📋 ' + T('Copy the link'), onclick: function () { if (navigator.clipboard) navigator.clipboard.writeText(link).then(function () { b.textContent = '✓ ' + T('Copied.'); }, function () {}); } })
        ]));
      }, function (e) { msg.textContent = net.why(e); }).then(function () { b.disabled = false; });
    } });
    box.appendChild(b); box.appendChild(msg); stage.appendChild(box); return box;
  }
  var KIT = { net: net, el: el, rnd: rnd, ri: ri, pick: pick, shuffle: shuffle, store: store, sound: sound, celebrate: celebrate, note: note, rand: rand,
    nextImages: nextImages, rememberImage: rememberImage, loadImage: loadImage, award: award, best: best, bestOf: bestOf, onLeave: onLeave, questions: questions,
    words: THEMES, images: IMAGES, pics: DATA.pics || [], data: EXTRA, G: G, T: T, lang: PL, lw: function () { return LW; }, start: function () { start(); }, menu: function () { showMenu(); } };
  window.KJTGames = { register: function (g) { REG.push(g); }, kit: KIT };

  /* ---------- the menu, the Daily Challenge and the trophy shelf ---------- */
  /* 7.24.0: a drawn icon for every game (64×64, its own coloured tile) that shows what the game is: the board, the grid,
     the cards… The race games (the same board for two, timed) carry a stopwatch. */
  var ART = (function () {
    var P = '#3E093F', GOLD = '#F3C548', CREAM = '#FFF7DA', W = '#fff';
    function tile(bg, body, bg2) { return '<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="14" fill="' + bg + '"/>' + (bg2 ? '<path d="M0 40 C18 34 40 48 64 38 V50 a14 14 0 0 1 -14 14 H14 A14 14 0 0 1 0 50Z" fill="' + bg2 + '" opacity=".55"/>' : '') + body + '</svg>'; }
    /* a stopwatch in the corner: the "race" games (the same board for two, timed) */
    var WATCH = '<g transform="translate(44 44)"><circle r="13" fill="' + W + '" stroke="' + P + '" stroke-width="3"/><rect x="-3" y="-19" width="6" height="5" rx="1.5" fill="' + P + '"/><path d="M0 0 V-8 M0 0 L6 4" stroke="#C0392B" stroke-width="3" stroke-linecap="round"/><circle r="2" fill="' + P + '"/></g>';
    function race(svg) { return svg.replace('</svg>', WATCH + '</svg>'); }
    function txt(x, y, t, size, fill, weight) { return '<text x="' + x + '" y="' + y + '" font-family="Georgia,serif" font-weight="' + (weight || 800) + '" font-size="' + size + '" text-anchor="middle" fill="' + fill + '">' + t + '</text>'; }
    function letters(x0, y0, step, rows, size, fill) { var s = ''; rows.forEach(function (r, i) { r.split('').forEach(function (ch, j) { s += txt(x0 + j * step, y0 + i * step, ch, size, fill); }); }); return s; }

    var A = {};
    /* ---- word games ---- */
    A.seek = tile('#5DC1B9', '<rect x="7" y="7" width="40" height="40" rx="6" fill="' + CREAM + '" stroke="' + P + '" stroke-width="2.5"/>'
      + '<rect x="9" y="12.5" width="36" height="9" rx="4.5" fill="' + GOLD + '"/>'
      + letters(14, 20, 9, ['JOYS', 'KAEP', 'LIFE', 'MNOR'], 8.5, P)
      + '<circle cx="45" cy="45" r="9" fill="rgba(255,255,255,.55)" stroke="' + P + '" stroke-width="3.5"/><path d="M51.5 51.5 L58 58" stroke="' + P + '" stroke-width="5" stroke-linecap="round"/>');
    A.seekrace = race(A.seek);
    A.hunt = tile('#2E86C1', (function () { var s = '', L = 'GRACEHOPE'; for (var i = 0; i < 9; i++) { var x = 8 + (i % 3) * 17, y = 8 + Math.floor(i / 3) * 17; s += '<rect x="' + x + '" y="' + y + '" width="14" height="14" rx="3.5" fill="' + (i === 0 || i === 1 || i === 4 ? GOLD : CREAM) + '" stroke="' + P + '" stroke-width="1.8"/>' + txt(x + 7, y + 11, L[i], 10, P); } return s; })()
      + '<path d="M15 15 L32 15 L32 32" fill="none" stroke="#C0392B" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/><circle cx="32" cy="32" r="3" fill="#C0392B"/>');
    A.crossword = tile('#7A5BB5', (function () {
      var s = '<rect x="6" y="6" width="44" height="44" rx="4" fill="' + P + '"/>', g = ['.C...', 'CROSS', '.O..H', '.S..E', '.SHEEP'.slice(0, 5)];
      g = ['.C...', 'CROSS', '.O..E', '.S..E', '.SEED'];
      for (var r = 0; r < 5; r++) for (var c = 0; c < 5; c++) { var ch = g[r][c]; if (ch === '.') continue; var x = 7 + c * 8.6, y = 7 + r * 8.6; s += '<rect x="' + x + '" y="' + y + '" width="7.8" height="7.8" fill="' + W + '"/>' + txt(x + 3.9, y + 6.6, ch, 6.5, P); }
      return s; })()
      + '<g transform="rotate(40 48 44)"><rect x="42" y="22" width="9" height="30" rx="2" fill="' + GOLD + '" stroke="' + P + '" stroke-width="2"/><path d="M42 52 L46.5 61 L51 52Z" fill="#F6D9B0" stroke="' + P + '" stroke-width="2" stroke-linejoin="round"/><rect x="42" y="19" width="9" height="5" rx="1.5" fill="#F08AA8" stroke="' + P + '" stroke-width="2"/></g>');
    A.xwrace = race(A.crossword);
    A.words = tile('#0B7778', '<rect x="5" y="40" width="54" height="10" rx="3" fill="#8B5A2B" stroke="' + P + '" stroke-width="2"/>'
      + [['W', 4, 8], ['O', 1, 21], ['R', 1, 34], ['D', 2, 47]].map(function (t, i) { var x = 5 + i * 13.5, y = i % 2 ? 22 : 24; return '<rect x="' + x + '" y="' + y + '" width="12" height="15" rx="2.5" fill="#FFE8A8" stroke="' + P + '" stroke-width="2"/>' + txt(x + 6, y + 11, t[0], 10, P) + '<text x="' + (x + 10) + '" y="' + (y + 13.5) + '" font-family="system-ui,sans-serif" font-size="4.5" font-weight="700" text-anchor="end" fill="' + P + '">' + t[1] + '</text>'; }).join('')
      + '<path d="M10 14 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z" fill="' + GOLD + '"/>');
    /* ---- number & picture puzzles ---- */
    A.sudoku = tile(P, (function () {
      var s = '<rect x="7" y="7" width="50" height="50" rx="4" fill="' + W + '"/>', d = { 0: '5', 2: '3', 4: '7', 10: '6', 12: '1', 14: '9', 19: '9', 20: '8', 24: '6', 27: '8', 31: '6', 35: '3', 40: '4', 44: '1', 45: '7', 49: '2', 53: '6', 60: '2', 62: '8', 66: '4', 68: '1', 70: '9', 76: '8', 78: '7', 80: '9' };
      for (var i = 1; i < 9; i++) { var p = 7 + i * 50 / 9, th = i % 3 ? .6 : 2; s += '<path d="M' + p + ' 7 V57 M7 ' + p + ' H57" stroke="' + P + '" stroke-width="' + th + '"/>'; }
      Object.keys(d).forEach(function (k) { var r = Math.floor(k / 9), c = k % 9; s += txt(7 + (c + .5) * 50 / 9, 7 + (r + .5) * 50 / 9 + 2.2, d[k], 5.4, (k == 40 || k == 20) ? '#C0392B' : P, 700); });
      s += '<rect x="7" y="7" width="50" height="50" rx="4" fill="none" stroke="' + GOLD + '" stroke-width="2.5"/>';
      return s; })());
    A.sudokurace = race(A.sudoku);
    A.puzzle = tile('#2E9E6B', '<rect x="8" y="10" width="44" height="40" rx="3" fill="#BFE6FF"/><circle cx="40" cy="20" r="5" fill="' + GOLD + '"/><path d="M8 40 L22 26 L32 36 L40 30 L52 42 V50 H8Z" fill="#4FA35B"/><path d="M8 50 V44 C20 40 38 46 52 42 V50Z" fill="#2E7D3E"/>'
      + '<path d="M30 30 H40 a4 4 0 1 1 8 0 H52 V50 H30Z" fill="#2E9E6B" stroke="' + W + '" stroke-width="1.5" stroke-dasharray="2 2"/>'
      + '<g transform="translate(36 34) rotate(14)"><path d="M0 0 H10 a4 4 0 1 1 8 0 H22 V20 H0Z" fill="#4FA35B" stroke="' + P + '" stroke-width="2" stroke-linejoin="round"/><path d="M0 12 C8 9 14 14 22 11 V20 H0Z" fill="#2E7D3E"/></g>');
    A.diff = tile('#FF9F4A', ['<g>', '<g transform="translate(31 0)">'].map(function (g, i) { return g + '<rect x="4" y="12" width="26" height="34" rx="3" fill="#BFE6FF" stroke="' + P + '" stroke-width="2"/><path d="M4 36 L13 27 L19 33 L24 29 L30 35 V46 H4Z" fill="#4FA35B"/><rect x="6" y="40" width="22" height="4" fill="#2E7D3E"/>' + (i ? '' : '<circle cx="23" cy="19" r="3.5" fill="' + GOLD + '"/>') + '<path d="M9 18 c2-2 4-2 6 0" stroke="' + P + '" stroke-width="1.5" fill="none"/></g>'; }).join('')
      + '<circle cx="54" cy="19" r="6.5" fill="none" stroke="#C0392B" stroke-width="2.8"/>' + txt(32, 58, '≠', 10, P));
    A.memory = tile('#7A5BB5', [0, 1, 2, 3, 4, 5].map(function (i) { var x = 7 + (i % 3) * 17.5, y = 9 + Math.floor(i / 3) * 24, up = i === 0 || i === 4; return '<rect x="' + x + '" y="' + y + '" width="15" height="21" rx="3" fill="' + (up ? W : '#3E093F') + '" stroke="' + (up ? GOLD : '#B59BE0') + '" stroke-width="2"/>' + (up ? '<path transform="translate(' + (x + 7.5) + ' ' + (y + 11) + ')" d="M-5 1 C-1 1 1 -1 2 -4 C3 -6 5 -6 6 -5 L7 -4 L6 -3 C6 2 3 5 -2 5 L-4 7 L-4 5 C-6 4 -6 2 -5 1Z" fill="#5DA9E9"/>' : '<path d="M' + (x + 7.5) + ' ' + (y + 6) + ' v9 M' + (x + 4.5) + ' ' + (y + 9) + ' h6" stroke="' + GOLD + '" stroke-width="1.6" stroke-linecap="round"/>'); }).join('')
      + '<path d="M22 22 C28 14 38 14 42 30" stroke="' + GOLD + '" stroke-width="2" fill="none" stroke-dasharray="2 2.5"/>');
    A.solitaire = tile('#0E5E4A', '<g transform="rotate(-14 22 34)"><rect x="8" y="12" width="22" height="31" rx="3" fill="#25458F" stroke="' + W + '" stroke-width="1.8"/><path d="M19 18 v19 M14 23 h10" stroke="' + GOLD + '" stroke-width="2.4" stroke-linecap="round"/></g>'
      + '<rect x="24" y="10" width="22" height="31" rx="3" fill="' + W + '" stroke="' + P + '" stroke-width="1.8"/>' + txt(29, 19, 'A', 7, '#C0392B') + '<path d="M35 30 c-4-3-6-5-6-7 a3 3 0 0 1 6 -1 a3 3 0 0 1 6 1 c0 2-2 4-6 7z" fill="#C0392B"/>'
      + '<g transform="translate(36 36)"><rect x="0" y="0" width="20" height="23" rx="3" fill="#EAD9B5"/><rect x="0" y="0" width="20" height="20" rx="3" fill="' + CREAM + '" stroke="' + P + '" stroke-width="1.8"/><path d="M5 6 c3 3 7 3 10 0 M10 6 v9" stroke="#2E9E6B" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="6" cy="14" r="2" fill="#C0392B"/><circle cx="14" cy="14" r="2" fill="#2E86C1"/></g>');
    /* ---- Bible knowledge ---- */
    A.whoami = tile('#2E86C1', '<circle cx="28" cy="24" r="11" fill="' + CREAM + '"/><path d="M8 56 C8 40 18 36 28 36 C38 36 48 40 48 56Z" fill="' + CREAM + '"/><path d="M17 22 C17 12 39 12 39 22 L39 18 C34 10 22 10 17 18Z" fill="#8B5A2B"/>'
      + '<circle cx="47" cy="17" r="11" fill="' + GOLD + '" stroke="' + P + '" stroke-width="2.5"/>' + txt(47, 22.5, '?', 15, P, 900));
    A.whoami2 = tile('#E08A1E', '<g><circle cx="16" cy="28" r="8" fill="' + CREAM + '"/><path d="M3 56 C3 44 9 39 16 39 C23 39 29 44 29 56Z" fill="' + CREAM + '"/></g><g><circle cx="48" cy="28" r="8" fill="' + W + '"/><path d="M35 56 C35 44 41 39 48 39 C55 39 61 44 61 56Z" fill="' + W + '"/></g>'
      + '<path d="M10 8 h16 a4 4 0 0 1 4 4 v6 a4 4 0 0 1 -4 4 h-8 l-5 4 v-4 h-3 a4 4 0 0 1 -4 -4 v-6 a4 4 0 0 1 4 -4z" fill="' + W + '" stroke="' + P + '" stroke-width="2"/>' + txt(18, 19.5, '?', 11, P, 900)
      + '<path d="M38 8 h16 a4 4 0 0 1 4 4 v6 a4 4 0 0 1 -4 4 h-3 v4 l-5 -4 h-8 a4 4 0 0 1 -4 -4 v-6 a4 4 0 0 1 4 -4z" fill="' + GOLD + '" stroke="' + P + '" stroke-width="2"/>' + txt(46, 19.5, '!', 11, P, 900));
    A.verse = tile('#E08A1E', '<path d="M10 8 H48 a6 6 0 0 1 0 12 H50 V52 a6 6 0 0 1 -6 6 H16 a6 6 0 0 1 0 -12 H14 V14 a6 6 0 0 0 -4 -6Z" fill="' + CREAM + '" stroke="' + P + '" stroke-width="2.2" stroke-linejoin="round"/>'
      + '<g font-family="system-ui,sans-serif" font-weight="800" font-size="6.5" fill="' + P + '"><rect x="18" y="22" width="12" height="9" rx="2" fill="' + GOLD + '"/><text x="24" y="28.6" text-anchor="middle">God</text><rect x="32" y="22" width="12" height="9" rx="2" fill="' + GOLD + '"/><text x="38" y="28.6" text-anchor="middle">is</text>'
      + '<rect x="18" y="35" width="16" height="9" rx="2" fill="#fff" stroke="' + P + '" stroke-width="1.2" stroke-dasharray="2 1.5"/><rect x="25" y="47" width="14" height="9" rx="2" fill="#5DC1B9" transform="rotate(-8 32 51)"/><text x="32" y="53.5" text-anchor="middle" transform="rotate(-8 32 51)">love</text></g>'
      + '<path d="M40 50 C44 46 42 42 36 41" stroke="#C0392B" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M36 41 l3 -2 -0.5 3.5z" fill="#C0392B"/>');
    A.verserace = race(A.verse);
    A.timeline = tile('#5DC1B9', '<path d="M6 36 H56" stroke="' + P + '" stroke-width="3" stroke-linecap="round"/><path d="M56 36 l-6 -4 v8z" fill="' + P + '"/>'
      + '<circle cx="12" cy="36" r="4" fill="' + GOLD + '" stroke="' + P + '" stroke-width="2"/><circle cx="26" cy="36" r="4" fill="' + GOLD + '" stroke="' + P + '" stroke-width="2"/><circle cx="40" cy="36" r="4" fill="' + GOLD + '" stroke="' + P + '" stroke-width="2"/>'
      + '<g transform="translate(12 20)"><circle r="6" fill="' + GOLD + '"/><path d="M0 -10 v3 M0 7 v3 M-10 0 h3 M7 0 h3 M-7 -7 l2 2 M5 5 l2 2 M-7 7 l2 -2 M5 -5 l2 -2" stroke="' + GOLD + '" stroke-width="1.8" stroke-linecap="round"/></g>'
      + '<g transform="translate(26 50)"><path d="M-8 -4 H8 L5 3 H-5Z" fill="#8B5A2B" stroke="' + P + '" stroke-width="1.5"/><rect x="-4" y="-9" width="8" height="5" fill="#C9944F" stroke="' + P + '" stroke-width="1.5"/></g>'
      + '<g transform="translate(40 20)"><path d="M0 -9 V9 M-6 -3 H6" stroke="' + W + '" stroke-width="3.5" stroke-linecap="round"/><path d="M0 -9 V9 M-6 -3 H6" stroke="' + P + '" stroke-width="1.6" stroke-linecap="round"/></g>'
      + '<g transform="translate(52 50)"><path d="M-7 1 C-2 1 0 -1 1 -4 C2 -6 4 -6 5 -5 L6 -4 L5 -3 C5 2 2 5 -3 5 L-5 7 L-5 5 C-7 4 -7 2 -7 1Z" fill="' + W + '" stroke="' + P + '" stroke-width="1.3"/></g>');
    A.books = tile('#C0392B', '<rect x="4" y="46" width="56" height="5" rx="1.5" fill="#8B5A2B"/>'
      + [['#7A5BB5', 7, 8, 18], ['#2E86C1', 16, 7, 22], ['#2E9E6B', 24, 9, 16], ['' + GOLD, 34, 8, 24], ['#FF9F4A', 43, 7, 20], ['#5DC1B9', 51, 7, 17]].map(function (b) { return '<rect x="' + b[1] + '" y="' + (46 - b[3] - 6) + '" width="' + b[2] + '" height="' + (b[3] + 6) + '" rx="1.5" fill="' + b[0] + '" stroke="' + P + '" stroke-width="1.6"/><path d="M' + (b[1] + 1.5) + ' ' + (46 - b[3] - 1) + ' h' + (b[2] - 3) + '" stroke="' + W + '" stroke-width="1.3" opacity=".8"/>'; }).join('')
      + '<rect x="6" y="6" width="20" height="13" rx="3" fill="' + CREAM + '" stroke="' + P + '" stroke-width="1.8"/>' + txt(16, 15.5, 'OT', 8, P) + '<rect x="38" y="6" width="20" height="13" rx="3" fill="' + CREAM + '" stroke="' + P + '" stroke-width="1.8"/>' + txt(48, 15.5, 'NT', 8, P)
      + '<path d="M28 12.5 h8" stroke="' + W + '" stroke-width="2.4" stroke-linecap="round"/>');
    A.duel = tile('#C0392B', '<path d="M5 9 h22 a5 5 0 0 1 5 5 v10 a5 5 0 0 1 -5 5 h-12 l-6 6 v-6 h-4 a5 5 0 0 1 -5 -5 v-10 a5 5 0 0 1 5 -5z" fill="' + W + '" stroke="' + P + '" stroke-width="2"/>' + txt(16, 25, '?', 14, P, 900)
      + '<path d="M59 29 h-22 a5 5 0 0 0 -5 5 v10 a5 5 0 0 0 5 5 h12 l6 6 v-6 h4 a5 5 0 0 0 5 -5 v-10 a5 5 0 0 0 -5 -5z" fill="' + GOLD + '" stroke="' + P + '" stroke-width="2"/>' + txt(47, 45, '!', 14, P, 900)
      + '<circle cx="47" cy="15" r="9" fill="' + P + '"/>' + txt(47, 19, 'VS', 8, GOLD, 900));
    A.icons = tile(P, '<rect x="9" y="7" width="34" height="44" rx="3" fill="#B8862E" stroke="' + GOLD + '" stroke-width="2"/><rect x="12" y="10" width="28" height="38" rx="2" fill="#E9C46A"/>'
      + '<circle cx="26" cy="23" r="10" fill="' + GOLD + '" stroke="#B8862E" stroke-width="1.5"/><circle cx="26" cy="24" r="6" fill="#E8B98E"/><path d="M20 22 c1 -5 11 -5 12 0 c-2 -2 -10 -2 -12 0z" fill="#5A3A1F"/><path d="M14 48 C14 36 19 32 26 32 C33 32 38 36 38 48Z" fill="#8E2438"/><path d="M26 32 V48 M21 38 H31" stroke="' + GOLD + '" stroke-width="1.6"/>'
      + '<circle cx="45" cy="44" r="9" fill="rgba(255,255,255,.4)" stroke="' + W + '" stroke-width="3.5"/><path d="M51.5 50.5 L58 57" stroke="' + W + '" stroke-width="5" stroke-linecap="round"/>');
    A.paul = tile('#2E86C1', '<path d="M0 46 C10 40 14 46 22 42 C28 39 26 30 36 30 C44 30 46 22 54 20 L64 18 V50 a14 14 0 0 1 -14 14 H14 A14 14 0 0 1 0 50Z" fill="#E9D3A1"/><path d="M0 14 a14 14 0 0 1 14 -14 H30 C26 6 20 8 14 12 C8 16 4 14 0 18Z" fill="#E9D3A1"/>'
      + '<path d="M50 24 C40 18 30 20 22 26 C14 32 12 22 8 18" fill="none" stroke="#C0392B" stroke-width="2.2" stroke-dasharray="3 2.5" stroke-linecap="round"/><circle cx="50" cy="24" r="3" fill="#C0392B"/>'
      + '<g transform="translate(26 30)"><path d="M-9 0 H9 L6 5 H-6Z" fill="#8B5A2B" stroke="' + P + '" stroke-width="1.5"/><path d="M0 0 V-13" stroke="' + P + '" stroke-width="1.5"/><path d="M1 -12 L9 -2 H1Z" fill="' + W + '" stroke="' + P + '" stroke-width="1.2"/></g>'
      + '<path d="M44 50 c3-2 6-2 9 0 M38 56 c3-2 6-2 9 0" stroke="#2E86C1" stroke-width="1.6" fill="none" stroke-linecap="round"/>' + '<path d="M8 6 l2 5" stroke="none"/>');
    /* ---- board games ---- */
    A.chess = tile('#F3C548', (function () { var s = '<rect x="5" y="33" width="54" height="26" rx="4" fill="#BFE6FF"/>'; for (var r = 0; r < 3; r++) for (var c = 0; c < 6; c++) if ((r + c) % 2) s += '<rect x="' + (5 + c * 9) + '" y="' + (33 + r * 8.67) + '" width="9" height="8.67" fill="#2E86C1"/>'; return s; })()
      + '<path d="M18 52 H46 L43 44 H21Z" fill="' + P + '"/><path d="M23 44 C23 35 28 31 29 26 L20 30 L16 25 L26 12 L29 8 L32 12 C41 12 46 20 45 29 C44 37 41 41 41 44Z" fill="' + W + '" stroke="' + P + '" stroke-width="3" stroke-linejoin="round"/><circle cx="31" cy="20" r="2.5" fill="' + P + '"/><path d="M34 8 V1 M30.5 4.5 H37.5" stroke="#C0392B" stroke-width="2.6" stroke-linecap="round"/>');
    A.checkers = tile('#8B5A2B', (function () { var s = '<rect x="6" y="6" width="52" height="52" rx="4" fill="#F6E3B4"/>'; for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) if ((r + c) % 2) s += '<rect x="' + (6 + c * 13) + '" y="' + (6 + r * 13) + '" width="13" height="13" fill="#5A3A1F"/>'; return s; })()
      + '<g stroke="' + P + '" stroke-width="1.6"><circle cx="25.5" cy="12.5" r="5" fill="#C0392B"/><circle cx="51.5" cy="12.5" r="5" fill="#C0392B"/><circle cx="12.5" cy="51.5" r="5" fill="#222"/><circle cx="38.5" cy="38.5" r="5" fill="#222"/><circle cx="25.5" cy="38.5" r="5.5" fill="#C0392B"/></g>'
      + '<path d="M21 39 l1.5 -4 2 2.5 1 -3.5 1 3.5 2 -2.5 1.5 4z" fill="' + GOLD + '"/>');
    A.tavli = tile('#8B5A2B', '<rect x="5" y="5" width="54" height="54" rx="5" fill="#E9C99A" stroke="' + P + '" stroke-width="2"/><path d="M31 5 V59" stroke="' + P + '" stroke-width="2.5"/>'
      + [0, 1, 2, 3, 4, 5, 6, 7].map(function (i) { var x = (i < 4 ? 7 : 34) + (i % 4) * 6, col = i % 2 ? '#C0392B' : '#2E86C1'; return '<path d="M' + x + ' 6 L' + (x + 6) + ' 6 L' + (x + 3) + ' 26Z" fill="' + col + '"/><path d="M' + x + ' 58 L' + (x + 6) + ' 58 L' + (x + 3) + ' 38Z" fill="' + (i % 2 ? '#2E86C1' : '#C0392B') + '"/>'; }).join('')
      + '<circle cx="10" cy="54" r="3" fill="' + W + '" stroke="' + P + '"/><circle cx="10" cy="48" r="3" fill="' + W + '" stroke="' + P + '"/><circle cx="49" cy="10" r="3" fill="#222" stroke="' + P + '"/>'
      + '<g transform="rotate(-12 22 32)"><rect x="14" y="25" width="15" height="15" rx="3" fill="' + W + '" stroke="' + P + '" stroke-width="1.8"/><circle cx="18" cy="29" r="1.6" fill="' + P + '"/><circle cx="25" cy="36" r="1.6" fill="' + P + '"/><circle cx="21.5" cy="32.5" r="1.6" fill="' + P + '"/></g>'
      + '<g transform="rotate(14 44 32)"><rect x="37" y="25" width="15" height="15" rx="3" fill="' + W + '" stroke="' + P + '" stroke-width="1.8"/><circle cx="41" cy="29" r="1.6" fill="' + P + '"/><circle cx="48" cy="36" r="1.6" fill="' + P + '"/><circle cx="48" cy="29" r="1.6" fill="' + P + '"/><circle cx="41" cy="36" r="1.6" fill="' + P + '"/></g>');
    A.morris = tile('#5A3A1F', '<g fill="none" stroke="' + GOLD + '" stroke-width="2.2"><rect x="8" y="8" width="48" height="48"/><rect x="17" y="17" width="30" height="30"/><rect x="26" y="26" width="12" height="12"/><path d="M32 8 V26 M32 38 V56 M8 32 H26 M38 32 H56"/></g>'
      + [[8, 8, 1], [32, 8, 1], [56, 8, 1], [17, 32, 0], [47, 47, 0], [38, 32, 0], [26, 38, 1]].map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4.6" fill="' + (p[2] ? W : '#222') + '" stroke="' + (p[2] ? P : GOLD) + '" stroke-width="1.6"/>'; }).join('')
      + '<path d="M8 8 H56" stroke="#C0392B" stroke-width="1.6" opacity=".0"/>');
    A.mancala = tile('#2E9E6B', '<rect x="4" y="16" width="56" height="32" rx="16" fill="#A86B32" stroke="' + P + '" stroke-width="2"/>'
      + '<ellipse cx="11" cy="32" rx="4.5" ry="11" fill="#6E4220"/><ellipse cx="53" cy="32" rx="4.5" ry="11" fill="#6E4220"/>'
      + [0, 1, 2, 3].map(function (i) { var x = 21 + i * 7.4; return '<circle cx="' + x + '" cy="25" r="3.4" fill="#6E4220"/><circle cx="' + x + '" cy="39" r="3.4" fill="#6E4220"/>'; }).join('')
      + '<g fill="' + GOLD + '"><circle cx="20" cy="24.5" r="1.2"/><circle cx="22" cy="26" r="1.2"/><circle cx="28.6" cy="38.5" r="1.2"/><circle cx="43.6" cy="25" r="1.2"/><circle cx="51.5" cy="29" r="1.3"/><circle cx="54" cy="33" r="1.3"/><circle cx="52" cy="36.5" r="1.3"/><circle cx="36" cy="40" r="1.2"/></g>'
      + '<g fill="#E8C07A" stroke="' + P + '" stroke-width="1"><ellipse cx="32" cy="9" rx="3" ry="2.2"/><ellipse cx="25" cy="6" rx="3" ry="2.2"/><ellipse cx="39" cy="6" rx="3" ry="2.2"/></g>');
    A.c4 = tile('#2E86C1', '<rect x="6" y="10" width="52" height="44" rx="5" fill="#1F5F99" stroke="' + P + '" stroke-width="2"/>'
      + (function () { var s = '', b = ['....', '...F', '..FB', 'BFBB']; for (var r = 0; r < 4; r++) for (var c = 0; c < 4; c++) { var x = 14 + c * 12, y = 18 + r * 10.5, v = b[r][c]; s += '<circle cx="' + x + '" cy="' + y + '" r="4.6" fill="' + (v === 'F' ? GOLD : v === 'B' ? '#C0392B' : '#BFE6FF') + '"/>'; if (v === 'F') s += '<path d="M' + (x - 3) + ' ' + y + ' c2 -2.5 4 -2.5 6 0 c-2 2.5 -4 2.5 -6 0z M' + (x + 3) + ' ' + y + ' l1.5 -1.5 v3z" fill="' + P + '"/>'; } return s; })()
      + '<path d="M14 49.5 L50 18" stroke="' + W + '" stroke-width="2" stroke-dasharray="3 3" opacity=".9"/>' + '<path d="M2 54 H62" stroke="' + P + '" stroke-width="3" stroke-linecap="round"/>');
    A.ttt = tile('#5DC1B9', '<g stroke="' + P + '" stroke-width="3" stroke-linecap="round"><path d="M25 8 V56 M41 8 V56 M8 25 H56 M8 41 H56"/></g>'
      + '<g fill="none" stroke="#1F5F99" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 16.5 C14 11 20 11 22 16.5 C20 22 14 22 10 16.5Z M22 16.5 L24 13.5 M22 16.5 L24 19.5"/><path d="M42 48.5 C46 43 52 43 54 48.5 C52 54 46 54 42 48.5Z M54 48.5 L56 45.5 M54 48.5 L56 51.5"/></g>'
      + '<g fill="' + W + '" stroke="' + P + '" stroke-width="1.2"><path d="M27 37 C31 37 33 35 34 32 C35 30 37 30 38 31 L39 32 L38 33 C38 38 35 40 30 40 L28 42 L28 40 C26 39 26 38 27 37Z"/><path d="M43 21 C47 21 49 19 50 16 C51 14 53 14 54 15 L55 16 L54 17 C54 22 51 24 46 24 L44 26 L44 24 C42 23 42 22 43 21Z"/></g>');
    A.journey = tile('#E08A1E', (function () { var s = ''; for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) s += '<rect x="' + (6 + c * 13) + '" y="' + (26 + r * 11) + '" width="12" height="10" rx="2" fill="' + ((r + c) % 2 ? CREAM : '#FFE08A') + '" stroke="' + P + '" stroke-width="1"/>'; return s; })()
      + '<g transform="translate(16 30) rotate(-20)"><path d="M0 0 V24 M7 0 V24" stroke="#8B5A2B" stroke-width="2.2"/><path d="M0 4 H7 M0 10 H7 M0 16 H7 M0 22 H7" stroke="#8B5A2B" stroke-width="1.8"/></g>'
      + '<path d="M38 30 C48 32 36 40 46 44 C54 47 46 54 54 56" fill="none" stroke="#2E9E6B" stroke-width="3.4" stroke-linecap="round"/><circle cx="38" cy="30" r="2.6" fill="#2E9E6B"/>'
      + '<g transform="translate(32 4)"><path d="M-14 10 L0 2 L14 10Z" fill="' + GOLD + '" stroke="' + P + '" stroke-width="1.6" stroke-linejoin="round"/><rect x="-12" y="10" width="24" height="2.4" fill="' + W + '" stroke="' + P + '" stroke-width="1"/><path d="M-9 13 V21 M-3 13 V21 M3 13 V21 M9 13 V21" stroke="' + W + '" stroke-width="2.6"/><rect x="-13" y="21" width="26" height="2.6" fill="' + W + '" stroke="' + P + '" stroke-width="1"/></g>');
    /* ---- Little Lambs ---- */
    A.manna = tile('#2E86C1', '<path d="M0 48 C16 42 46 46 64 42 V50 a14 14 0 0 1 -14 14 H14 A14 14 0 0 1 0 50Z" fill="#E9C99A"/>'
      + '<g fill="' + W + '" stroke="#C9A06A" stroke-width="1"><ellipse cx="14" cy="12" rx="5" ry="3.4"/><ellipse cx="34" cy="8" rx="5" ry="3.4"/><ellipse cx="50" cy="16" rx="5" ry="3.4"/><ellipse cx="24" cy="24" rx="5" ry="3.4"/><ellipse cx="44" cy="28" rx="5" ry="3.4"/></g>'
      + '<path d="M18 40 H46 L42 56 H22Z" fill="#B8762F" stroke="' + P + '" stroke-width="2" stroke-linejoin="round"/><path d="M20 46 H44 M21 51 H43" stroke="#8B5A2B" stroke-width="1.6"/><path d="M18 40 C18 32 46 32 46 40" fill="none" stroke="' + P + '" stroke-width="2"/>'
      + '<g fill="' + W + '"><ellipse cx="27" cy="38" rx="4" ry="2.6"/><ellipse cx="35" cy="37" rx="4" ry="2.6"/></g>');
    A.jonah = tile('#1F5F99', '<path d="M0 36 C8 30 16 42 24 36 C32 30 40 42 48 36 C54 32 60 34 64 36 V50 a14 14 0 0 1 -14 14 H14 A14 14 0 0 1 0 50Z" fill="#2E86C1"/>'
      + '<g transform="translate(22 30)"><path d="M-14 0 H14 L9 9 H-9Z" fill="#8B5A2B" stroke="' + P + '" stroke-width="1.8"/><path d="M0 0 V-22" stroke="' + P + '" stroke-width="2"/><path d="M1 -21 L14 -4 H1Z" fill="' + W + '" stroke="' + P + '" stroke-width="1.4"/><path d="M-1 -18 L-11 -4 H-1Z" fill="' + CREAM + '" stroke="' + P + '" stroke-width="1.4"/></g>'
      + '<path d="M44 52 C44 44 50 42 54 46 L58 40 L60 48 L54 50 C52 54 46 56 44 52Z" fill="#5A7FA6" stroke="' + P + '" stroke-width="1.6"/>'
      + '<path d="M0 44 C8 38 16 50 24 44 C32 38 40 50 48 44 C54 40 60 42 64 44" fill="none" stroke="#BFE6FF" stroke-width="2" stroke-linecap="round"/><path d="M40 8 l-4 8 h5 l-4 9" stroke="' + GOLD + '" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>');
    A.twobytwo = tile('#5DC1B9', '<path d="M4 38 H60 L52 52 H12Z" fill="#8B5A2B" stroke="' + P + '" stroke-width="2" stroke-linejoin="round"/><rect x="18" y="26" width="28" height="12" fill="#B8762F" stroke="' + P + '" stroke-width="2"/><path d="M14 26 L32 16 L50 26Z" fill="#C0392B" stroke="' + P + '" stroke-width="2" stroke-linejoin="round"/><rect x="28" y="29" width="8" height="9" rx="1" fill="#5A3A1F"/>'
      + '<path d="M8 38 C20 36 44 36 56 38" stroke="#6E4220" stroke-width="1.4" fill="none"/>'
      + '<g fill="' + GOLD + '" stroke="' + P + '" stroke-width="1.3"><path d="M6 37 V26 l3 -4 h3 l-1 3 h-2 V37Z"/><path d="M13 37 V28 l3 -4 h3 l-1 3 h-2 V37Z"/></g>'
      + '<g fill="#A0A0A0" stroke="' + P + '" stroke-width="1.3"><ellipse cx="51" cy="34" rx="5" ry="3.5"/><ellipse cx="58" cy="34" rx="4" ry="3"/></g>'
      + '<path d="M0 54 C16 50 48 58 64 52 V50 a14 14 0 0 1 -14 14 H14 A14 14 0 0 1 0 50Z" fill="#2E86C1"/>' + '<path d="M44 8 a10 10 0 0 1 16 6" stroke="#FF9F4A" stroke-width="2.4" fill="none"/><path d="M42 11 a13 13 0 0 1 20 7" stroke="' + GOLD + '" stroke-width="2.4" fill="none"/><path d="M40 14 a16 16 0 0 1 24 8" stroke="#2E9E6B" stroke-width="2.4" fill="none"/>');
    return A;
  })();
  /* 7.20.2: games for more than one player say so on their card (👥), and those you can play with a friend online too (🌐) */
  /* 7.24.1: every game that more than one can play says so from 1 (you can always play alone: against the computer, or by yourself) */
  var MULTI = { chess: ['1–2 players', 1], words: ['1–4 players', 1], ttt: ['1–2 players', 1], duel: ['1–2 players', 1], journey: ['1–4 players', 1], c4: ['1–2 players', 1], checkers: ['1–2 players', 1], mancala: ['1–2 players', 1], morris: ['1–2 players', 1], hunt: ['1–2 players', 1], tavli: ['1–2 players', 1],
    whoami: ['1–2 players', 1], verse: ['1–2 players', 1], seek: ['1–2 players', 1], sudoku: ['1–2 players', 1], crossword: ['1–2 players', 1] };
  /* 7.24.1: one game, not two: a game played alone and its version for friends (the same board for both, timed; or Who Am I? for two)
     are one card; inside, "Alone" or "With a friend". The friends' version keeps its own id (its online games and links). */
  var RACE = { sudoku: 'sudokurace', crossword: 'xwrace', seek: 'seekrace', verse: 'verserace', whoami: 'whoami2' };
  function soloOf(id) { return Object.keys(RACE).filter(function (k) { return RACE[k] === id; })[0] || ''; }
  function multiBadge(id) {
    var m = MULTI[id]; if (!m) return null;
    var b = el('span', { class: 'kg-card__multi' }, [el('span', { class: 'kg-card__multi-i', 'aria-hidden': 'true', text: '👥' }), el('span', { text: T(m[0]) })]);
    if (m[1]) b.appendChild(el('span', { class: 'kg-card__multi-o' }, [el('span', { 'aria-hidden': 'true', text: '🌐 ' }), el('span', { text: T('online') })]));
    return b;
  }
  function iconEl(g) { var s = el('span', { class: 'kg-card__icon' + (ART[g.id] ? ' kg-card__icon--art' : ''), 'aria-hidden': 'true' }); if (ART[g.id]) s.innerHTML = ART[g.id]; else s.textContent = g.icon; return s; }
  var CATS = [['action', '\ud83d\udc11', 'Little Lambs: early learning', 'Gentle, simple games made for little ones (about ages 3 to 7).'], ['think', '\ud83e\udde0', 'Thinking & Puzzles'], ['family', '\ud83c\udfb2', 'Family & Board Games'], ['explore', '\ud83d\uddfa\ufe0f', 'Explore']];
  /* 7.24.0: the games in groups of like games, each next to its race for two */
  var GROUPS = [['word', '🔤', 'Word Games', ['crossword', 'seek', 'hunt', 'words']],
    ['puzzle', '🧩', 'Puzzles & Numbers', ['sudoku', 'puzzle', 'diff', 'memory', 'solitaire']],
    ['bible', '📖', 'Bible Knowledge', ['whoami', 'verse', 'timeline', 'books', 'duel']],
    ['board', '♟️', 'Board Games', ['chess', 'checkers', 'tavli', 'morris', 'mancala', 'c4', 'ttt', 'journey']],
    ['explore', '🗺️', 'Explore', ['paul', 'icons']]];
  var GROUP_OF = { think: 'puzzle', family: 'board', explore: 'explore' };
  function groupGames(key) {
    var gr = GROUPS.filter(function (x) { return x[0] === key; })[0], listed = {}; GROUPS.forEach(function (x) { x[3].forEach(function (id) { listed[id] = 1; }); });
    var out = gr[3].map(find).filter(Boolean);
    REG.forEach(function (g) { if (!listed[g.id] && !soloOf(g.id) && GROUP_OF[g.cat] === key) out.push(g); });
    return out;
  }
  var LEVELS = [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard']];
  /* 7.9.16: a game can have its own levels (Sudoku adds Ultra Hard) and can be for one language only (Word Builder: English) */
  function levelsOf(g) { return (g && g.levels) || LEVELS; }
  function shown(g) { return !g.langs || g.langs.indexOf(PL) >= 0; }
  var state = { game: null, level: store('level') || 'easy' }, daily = null, stage = null, token = 0;
  function dayNumber() { var d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000); }
  function dailyPick() {
    var list = REG.filter(function (g) { return g.daily && shown(g) && rootOf(g) === ROOT_MAIN; }); if (!list.length) return null;
    var n = dayNumber(), g = list[(n * 7 + 3) % list.length];
    return { id: g.id, level: LEVELS[n % 3][0], key: String(n), seed: (n * 2654435761) % 4294967296 || 7 };
  }
  function streak() { var d = store('daily') || {}, n = dayNumber(), c = 0; if (!d[n]) n--; while (d[n]) { c++; n--; } return c; }
  function find(id) { for (var i = 0; i < REG.length; i++) if (REG[i].id === id) return REG[i]; return null; }
  function showMenu() {
    leave(); seed = 0; daily = null; state.game = null; stage = null;
    if (ROOT_EARLY && ROOT_MAIN) { drawMenu(ROOT_EARLY, true); drawMenu(ROOT_MAIN, false); }
    else drawMenu(root, root === ROOT_EARLY);
  }
  function drawMenu(root, early) {
    root.innerHTML = '';
    if (early) return drawEarly(root);
    var t = store('trophies') || {}, counts = [0, 0, 0, 0];
    REG.forEach(function (g) { if (rootOf(g) === root) counts[t[g.id] || 0]++; });
    var dp = dailyPick(), done = dp && (store('daily') || {})[dp.key], dg = dp && find(dp.id), st = streak();
    if (dg) root.appendChild(el('button', { class: 'kg-daily' + (done ? ' done' : ''), type: 'button', onclick: function () { open(dg.id, dp.level, dp); } }, [
      el('span', { class: 'kg-daily__icon', text: done ? '\u2705' : '\ud83d\udcc5', 'aria-hidden': 'true' }),
      el('span', { class: 'kg-daily__text' }, [el('small', { text: 'Daily Challenge' + (st ? ' \u00b7 \ud83d\udd25 ' + st + '-day streak' : '') }),
        el('strong', { text: dg.icon + ' ' + dg.name + ' \u00b7 ' + LEVELS.filter(function (l) { return l[0] === dp.level; })[0][1] }),
        el('span', { text: done ? 'Done for today! Come back tomorrow for a new one.' : 'The same challenge for everyone today. Can you do it?' })]),
      el('span', { class: 'kg-daily__go', text: '\u2192', 'aria-hidden': 'true' })
    ]));
    root.appendChild(el('p', { class: 'kg-shelf' }, [el('strong', { text: '\ud83c\udfc6 My trophies: ' }), '\ud83e\udd47 ' + counts[3] + '   \ud83e\udd48 ' + counts[2] + '   \ud83e\udd49 ' + counts[1], el('small', { text: '   Easy = bronze, Medium = silver, Hard = gold' })]));
    GROUPS.forEach(function (c) {
      var games = groupGames(c[0]).filter(function (g) { return shown(g) && rootOf(g) === root; }); if (!games.length) return;
      var grid = el('div', { class: 'kg-menu' });
      games.forEach(function (g) {
        var m = t[g.id] || 0;
        grid.appendChild(el('button', { class: 'kg-card', type: 'button', onclick: function () { open(g.id); } }, [
          iconEl(g),
          el('span', { class: 'kg-card__name', text: g.name }),
          el('span', { class: 'kg-card__blurb', text: g.blurb }),
          m ? el('span', { class: 'kg-card__medal', text: MEDAL_ICON[m], title: 'Best trophy' }) : null,
          multiBadge(g.id)
        ]));
      });
      root.appendChild(el('div', { class: 'kg-group kg-group--' + c[0] }, [el('h4', { class: 'kg-group__title', text: c[1] + ' ' + c[2] }), grid]));
    });
  }
  /* the Little Lambs menu: big, friendly cards, no trophies talk */
  function drawEarly(root) {
    var t = store('trophies') || {}, grid = el('div', { class: 'kg-menu kg-menu--early' });
    REG.filter(function (g) { return rootOf(g) === root; }).forEach(function (g) {
      var m = t[g.id] || 0;
      grid.appendChild(el('button', { class: 'kg-card kg-card--early', type: 'button', onclick: function () { open(g.id); } }, [
        iconEl(g),
        el('span', { class: 'kg-card__name', text: g.name }),
        el('span', { class: 'kg-card__blurb', text: g.blurb }),
        m ? el('span', { class: 'kg-card__medal', text: MEDAL_ICON[m], title: 'Best trophy' }) : null
      ]));
    });
    if (!grid.children.length) { root.appendChild(el('p', { class: 'kt-note', text: 'Loading the games…' })); return; }
    root.appendChild(el('p', { class: 'kg-early-note', text: 'Tap a picture to play. A grown-up can choose Easy, Medium or Hard.' }));
    root.appendChild(grid);
  }
  function open(id, level, dailySpec) {
    var g = find(id); if (!g) return showMenu();
    var solo0 = soloOf(id); if (solo0 && find(solo0)) g = find(solo0); /* the friends' version opens inside its game */
    var was = root; leave(); root = rootOf(g);
    if (was && was !== root && ROOT_MAIN && ROOT_EARLY) drawMenu(was, was === ROOT_EARLY);
    state.game = id; daily = dailySpec || null;
    if (level) state.level = level;
    root.innerHTML = '';
    var levels = el('div', { class: 'kg-levels', role: 'group', 'aria-label': 'Difficulty' });
    function drawLevels() {
      levels.innerHTML = '';
      if (g.noLevels) return;
      var GL = levelsOf(g); if (!GL.some(function (l) { return l[0] === state.level; })) state.level = GL[Math.min(GL.length - 1, ['easy', 'medium', 'hard', 'ultra'].indexOf(state.level))] ? GL[Math.min(GL.length - 1, Math.max(0, ['easy', 'medium', 'hard', 'ultra'].indexOf(state.level)))][0] : GL[0][0];
      GL.forEach(function (l) {
        levels.appendChild(el('button', { class: 'kg-level', type: 'button', 'aria-pressed': l[0] === state.level ? 'true' : 'false', text: l[1], disabled: daily ? 'disabled' : null,
          onclick: function () { state.level = l[0]; store('level', l[0]); drawLevels(); start(); } }));
      });
    }
    drawLevels();
    root.appendChild(el('div', { class: 'kg-head' }, [
      el('button', { class: 'kt-btn kt-btn--ghost kg-back', type: 'button', text: root === ROOT_EARLY && ROOT_MAIN ? '\ud83d\udc11 All Little Lambs games' : '\ud83c\udfae All games', onclick: showMenu }),
      el('h4', { class: 'kg-title', text: g.icon + ' ' + g.name + (daily ? '  \u00b7  \ud83d\udcc5 Daily Challenge' : '') })
    ]));
    /* 7.24.1: Alone or With a friend, in the same game */
    var duoG = !daily && find(RACE[g.id] || ''), who = null;
    if (duoG && shown(duoG)) {
      who = el('div', { class: 'kg-who', role: 'group', 'aria-label': 'Who is playing?' });
      [[g.id, '👤 Alone'], [duoG.id, '👥 With a friend']].forEach(function (x) {
        who.appendChild(el('button', { class: 'kg-who__b', type: 'button', 'aria-pressed': state.game === x[0] ? 'true' : 'false', text: x[1], onclick: function () { if (state.game === x[0]) return; state.game = x[0]; [].forEach.call(who.children, function (b, k) { b.setAttribute('aria-pressed', k === (x[0] === g.id ? 0 : 1) ? 'true' : 'false'); }); drawLevels(); start(); } }));
      });
    }
    root.appendChild(el('div', { class: 'kg-bar' }, [who, levels, el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83d\udd04 New game', onclick: function () { start(); } })]));
    stage = el('div', { class: 'kg-stage' });
    root.appendChild(stage);
    start();
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function start() {
    var g = find(state.game); if (!g || !stage) return;
    leave(); token++; var my = token, st = stage;
    seed = daily ? daily.seed : 0;
    st.innerHTML = '';
    var alive = function () { return my === token && document.body.contains(st); };
    try { Promise.resolve(g.run(st, state.level, alive, KIT)).catch(function () { note(st, 'Something went wrong loading this game. Press New game to try again.', 'try'); }); }
    catch (e) { note(st, 'Something went wrong loading this game. Press New game to try again.', 'try'); }
  }

  /* =================================================================
     1. WORD SEEK
     ================================================================= */
  function wordSeek(box, level) {
    var cfg = { easy: { n: 8, count: 6, dirs: [[0, 1], [1, 0]] },
                medium: { n: 10, count: 8, dirs: [[0, 1], [1, 0], [1, 1], [-1, 1]] },
                hard: { n: 12, count: 11, dirs: [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]] } }[level];
    var recentW = store('recentwords') || [], recentT = store('recentthemes') || [];
    var THM = (LW && LW.themes && LW.themes.length) ? LW.themes : THEMES;
    var themes = shuffle(THM).sort(function (a, b) { return recentT.indexOf(a.theme) - recentT.indexOf(b.theme); });
    var grid, placed, theme;
    for (var t = 0; t < themes.length; t++) {
      theme = themes[t];
      var words = shuffle(theme.words.filter(function (w) { var n = G(w).length; return n <= cfg.n && n >= (PL === 'zh' ? 2 : 3); }))
        .sort(function (a, b) { return (recentW.indexOf(a) >= 0) - (recentW.indexOf(b) >= 0); });
      if (words.length < Math.min(4, cfg.count)) continue;
      grid = []; for (var r = 0; r < cfg.n; r++) grid.push(new Array(cfg.n).fill(''));
      placed = [];
      for (var w = 0; w < words.length && placed.length < cfg.count; w++) {
        var cells = place(words[w]);
        if (cells) placed.push({ word: words[w], cells: cells, found: false });
      }
      if (placed.length >= Math.min(4, cfg.count)) break;
    }
    function place(word) {
      if (placed.some(function (p) { return p.word === word || p.word.indexOf(word) >= 0 || word.indexOf(p.word) >= 0; })) return null;
      var g = G(word);
      for (var tries = 0; tries < 250; tries++) {
        var d = pick(cfg.dirs), r0 = ri(0, cfg.n - 1), c0 = ri(0, cfg.n - 1), cells = [], ok = true;
        for (var i = 0; i < g.length; i++) {
          var r = r0 + d[0] * i, c = c0 + d[1] * i;
          if (r < 0 || c < 0 || r >= cfg.n || c >= cfg.n || (grid[r][c] && grid[r][c] !== g[i])) { ok = false; break; }
          cells.push([r, c]);
        }
        if (!ok) continue;
        cells.forEach(function (rc, i) { grid[rc[0]][rc[1]] = g[i]; });
        return cells;
      }
      return null;
    }
    /* Fill with letters from the hidden words so the puzzle is not too easy. */
    var pool = G(placed.map(function (p) { return p.word; }).join('') + (FILL[PL] || FILL.en));
    grid.forEach(function (row) { for (var c = 0; c < row.length; c++) if (!row[c]) row[c] = pool[ri(0, pool.length - 1)]; });
    store('recentwords', placed.map(function (p) { return p.word; }).concat(recentW).slice(0, 60));
    store('recentthemes', [theme.theme].concat(recentT.filter(function (x) { return x !== theme.theme; })).slice(0, 12));

    var board = el('div', { class: 'kg-seek', style: '--n:' + cfg.n, role: 'grid', 'aria-label': 'Letter grid' });
    var cellsEl = [];
    grid.forEach(function (row, r) { row.forEach(function (ch, c) {
      var b = el('div', { class: 'kg-cell', 'data-r': r, 'data-c': c, role: 'gridcell', text: ch });
      board.appendChild(b); cellsEl.push(b);
    }); });
    var list = el('ul', { class: 'kg-words' });
    placed.sort(function (a, b) { return a.word < b.word ? -1 : 1; }).forEach(function (p) { p.li = el('li', { text: p.word }); list.appendChild(p.li); });
    box.appendChild(el('p', { class: 'kg-theme', text: 'Theme: ' + theme.theme }));
    box.appendChild(el('div', { class: 'kg-seek-wrap' }, [board, el('div', { class: 'kg-side' }, [
      el('p', { class: 'kt-note', text: level === 'hard' ? 'Words can go in any direction, even backwards!' : level === 'medium' ? 'Words go across, down and diagonally.' : 'Words go across and down.' }),
      list,
      el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83d\udca1 Hint', onclick: hint }),
      el('p', { class: 'kt-note', text: 'Drag across a word, or tap its first and last letter.' })
    ])]));
    var colours = ['#F3C548', '#8BD18F', '#9AD0F5', '#F7A8C8', '#FFB27A', '#C9B6F2', '#7FD6C9', '#FFD37A', '#B7E07F', '#F4A6A6', '#A7C7FF', '#E7B8FF'];
    function cellAt(x, y) { var t = document.elementFromPoint(x, y); return t && t.classList && t.classList.contains('kg-cell') && board.contains(t) ? t : null; }
    function rc(e) { return [+e.getAttribute('data-r'), +e.getAttribute('data-c')]; }
    function line(a, b) {
      var dr = b[0] - a[0], dc = b[1] - a[1], len = Math.max(Math.abs(dr), Math.abs(dc));
      if (len === 0) return [a];
      if (!(dr === 0 || dc === 0 || Math.abs(dr) === Math.abs(dc))) return null;
      var sr = dr / len, sc = dc / len, out = [];
      for (var i = 0; i <= len; i++) out.push([a[0] + sr * i, a[1] + sc * i]);
      return out;
    }
    function paint(cells, cls, on) { cellsEl.forEach(function (e) { e.classList.remove(cls); }); if (on && cells) cells.forEach(function (p) { cellsEl[p[0] * cfg.n + p[1]].classList.add(cls); }); }
    function check(cells) {
      if (!cells || cells.length < 2) return false;
      var key = cells.map(function (p) { return p.join(','); }).join('|'), rev = cells.slice().reverse().map(function (p) { return p.join(','); }).join('|');
      for (var i = 0; i < placed.length; i++) {
        var p = placed[i]; if (p.found) continue;
        var k = p.cells.map(function (q) { return q.join(','); }).join('|');
        if (k === key || k === rev) {
          p.found = true; p.li.classList.add('found');
          var col = colours[placed.indexOf(p) % colours.length];
          p.cells.forEach(function (q) { var e = cellsEl[q[0] * cfg.n + q[1]]; e.classList.add('got'); e.style.background = col; });
          note(box, '\u2b50 ' + p.word + '!');
          if (placed.every(function (x) { return x.found; })) { award('seek', level); celebrate(box, 'You found all ' + placed.length + ' words!', start); }
          return true;
        }
      }
      return false;
    }
    var from = null, pending = null, moved = false;
    board.addEventListener('pointerdown', function (e) {
      var c = cellAt(e.clientX, e.clientY); if (!c) return;
      e.preventDefault(); board.setPointerCapture && board.setPointerCapture(e.pointerId);
      from = rc(c); moved = false; paint([from], 'sel', true);
    });
    board.addEventListener('pointermove', function (e) {
      if (!from) return; var c = cellAt(e.clientX, e.clientY); if (!c) return;
      var to = rc(c); if (to[0] !== from[0] || to[1] !== from[1]) moved = true;
      paint(line(from, to), 'sel', true);
    });
    board.addEventListener('pointerup', function (e) {
      if (!from) return; var c = cellAt(e.clientX, e.clientY), to = c ? rc(c) : from;
      if (!moved && (to[0] === from[0] && to[1] === from[1])) {
        if (pending && (pending[0] !== to[0] || pending[1] !== to[1])) { var l = line(pending, to); if (!check(l)) note(box, 'Not a word yet. Try again!', 'try'); pending = null; paint(null, 'sel'); paint(null, 'first'); }
        else { pending = to; paint([to], 'first', true); paint(null, 'sel'); }
      } else { if (!check(line(from, to))) note(box, 'Not a word yet. Try again!', 'try'); pending = null; paint(null, 'first'); paint(null, 'sel'); }
      from = null;
    });
    function hint() {
      var p = placed.filter(function (x) { return !x.found; })[0]; if (!p) return;
      var e = cellsEl[p.cells[0][0] * cfg.n + p.cells[0][1]]; e.classList.add('hint'); setTimeout(function () { e.classList.remove('hint'); }, 1600);
      note(box, 'Look for ' + p.word + '. It starts at the flashing letter.');
    }
  }

  /* =================================================================
     3. SPOT THE DIFFERENCE (holy icons are never altered)
     ================================================================= */
  async function spotDiff(box, level, alive) {
    var cfg = { easy: { K: 5, rf: 0.07, hints: 3 }, medium: { K: 7, rf: 0.056, hints: 2 }, hard: { K: 9, rf: 0.046, hints: 1 } }[level];
    note(box, 'Preparing the pictures\u2026');
    /* Real photos, paintings and drawings (not the simple menu pictures); holy icons are never altered. */
    var pool = nextImages(function (x) { return !x.sacred && x.src.indexOf('/kids-extras/cards/') < 0; });
    if (!pool.length) pool = nextImages(function (x) { return !x.sacred; });
    var img = null, item = null, built = null;
    for (var i = 0; i < pool.length && !built; i++) {
      try { img = await loadImage(pool[i].src); } catch (e) { continue; }
      if (!alive()) return;
      item = pool[i]; built = build(img);
    }
    if (!built) { note(box, 'No picture has enough detail for this level. Try an easier level or another game.', 'try'); return; }
    rememberImage(item.src);
    var A = built.A, B = built.B, W = built.W, H = built.H, spots = built.spots, side = built.side;
    function build(img) {
    var boxW = box.clientWidth || 800, side = boxW >= 700, W = Math.min(side ? Math.floor((boxW - 20) / 2) : boxW, side ? 540 : 640);
    var H = Math.round(W * img.naturalHeight / img.naturalWidth); if (H > 460) { H = 460; W = Math.round(H * img.naturalWidth / img.naturalHeight); }
    var A = el('canvas', { width: W, height: H }), B = el('canvas', { width: W, height: H });
    var ga = A.getContext('2d', { willReadFrequently: true }), gb = B.getContext('2d', { willReadFrequently: true });
    ga.fillStyle = '#fff'; ga.fillRect(0, 0, W, H); ga.drawImage(img, 0, 0, W, H);
    var base; try { base = ga.getImageData(0, 0, W, H); } catch (e) { note(box, 'This picture cannot be used. Press New game.', 'try'); return; }
    gb.putImageData(base, 0, 0);
    var D = base.data, R = Math.max(10, Math.round(Math.min(W, H) * cfg.rf));
    function stats(cx, cy, r) { var n = 0, s = 0, s2 = 0, sat = 0; for (var y = cy - r; y <= cy + r; y += 2) for (var x = cx - r; x <= cx + r; x += 2) { if (x < 0 || y < 0 || x >= W || y >= H) continue; var i = (y * W + x) * 4, l = (D[i] * 3 + D[i + 1] * 6 + D[i + 2]) / 10, mx = Math.max(D[i], D[i + 1], D[i + 2]), mn = Math.min(D[i], D[i + 1], D[i + 2]); n++; s += l; s2 += l * l; sat += mx ? (mx - mn) / mx : 0; } var mean = s / n; return { v: Math.sqrt(Math.max(0, s2 / n - mean * mean)), sat: sat / n, mean: mean }; }
    function patch(g, x, y) { return g.getImageData(x - R, y - R, R * 2, R * 2); }
    function meanDiff(a, b) { var t = 0; for (var z = 0; z < a.length; z += 4) t += Math.abs(a[z] - b[z]) + Math.abs(a[z + 1] - b[z + 1]) + Math.abs(a[z + 2] - b[z + 2]); return t / (a.length / 4); }
    /* Edit a round area with a soft 1-2px edge. */
    function region(s, fn) { var im = gb.getImageData(s.x - R, s.y - R, R * 2, R * 2), d = im.data, n = R * 2; for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) { var k = 1 - Math.hypot(x - R + 0.5, y - R + 0.5) / R; if (k <= 0) continue; fn(d, (y * n + x) * 4, Math.min(1, k * 4), x, y, n); } gb.putImageData(im, s.x - R, s.y - R); }
    function mix(d, i, rgb, a) { d[i] += (rgb[0] - d[i]) * a; d[i + 1] += (rgb[1] - d[i + 1]) * a; d[i + 2] += (rgb[2] - d[i + 2]) * a; }
    function ink(d, i) { var mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]), sat = mx ? (mx - mn) / mx : 0, lum = (d[i] * 3 + d[i + 1] * 6 + d[i + 2]) / 10; return Math.max(Math.min(1, Math.max(0, sat - 0.15) * 3), Math.min(1, Math.max(0, 225 - lum) / 70)); }
    function hueRotate(rgb, deg) { var c = Math.cos(deg * Math.PI / 180), s2 = Math.sin(deg * Math.PI / 180), r = rgb[0], g = rgb[1], b = rgb[2];
      return [r * (0.213 + c * 0.787 - s2 * 0.213) + g * (0.715 - c * 0.715 - s2 * 0.715) + b * (0.072 - c * 0.072 + s2 * 0.928),
              r * (0.213 - c * 0.213 + s2 * 0.143) + g * (0.715 + c * 0.285 + s2 * 0.140) + b * (0.072 - c * 0.072 - s2 * 0.283),
              r * (0.213 - c * 0.213 - s2 * 0.787) + g * (0.715 - c * 0.715 + s2 * 0.715) + b * (0.072 + c * 0.928 + s2 * 0.072)].map(function (v) { return Math.max(0, Math.min(255, v)); }); }
    function source(ox, oy) { return ga.getImageData(ox - R, oy - R, R * 2, R * 2).data; }
    /* Share of pixels on a detail edge: high for textured areas, low for a single smooth outline. */
    function texture(cx, cy) { var n = 0, e = 0; for (var y = cy - R + 1; y < cy + R - 1; y += 1) for (var x = cx - R + 1; x < cx + R - 1; x += 1) { if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > R * R) continue; var i = (y * W + x) * 4, l = D[i] + D[i + 1] + D[i + 2], gx = Math.abs(l - (D[i + 4] + D[i + 5] + D[i + 6])), gy = Math.abs(l - (D[i + W * 4] + D[i + W * 4 + 1] + D[i + W * 4 + 2])); n++; if (gx + gy > 70) e++; } return n ? e / n : 0; }
    /* A natural same-coloured shape around (cx,cy), e.g. a sleeve, a stone, a window. */
    function segment(cx, cy) {
      var lim = R * 2.4, i0 = (cy * W + cx) * 4, c = [D[i0], D[i0 + 1], D[i0 + 2]], seen = new Uint8Array(W * H), q = [cy * W + cx], out = [], atLimit = 0; seen[q[0]] = 1;
      while (q.length && out.length < 12000) { var p = q.pop(), x = p % W, y = (p / W) | 0; out.push(p);
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { var X = x + o[0], Y = y + o[1]; if (X < 0 || Y < 0 || X >= W || Y >= H) return; var j = Y * W + X; if (seen[j]) return; seen[j] = 1; var k = j * 4; if (Math.abs(D[k] - c[0]) + Math.abs(D[k + 1] - c[1]) + Math.abs(D[k + 2] - c[2]) > 60) return; if (Math.hypot(X - cx, Y - cy) > lim) { atLimit++; return; } q.push(j); }); }
      return { px: out, open: atLimit > out.length * 0.08 || atLimit > 60, lum: (c[0] * 3 + c[1] * 6 + c[2]) / 10, sat: Math.max(c[0], c[1], c[2]) ? (Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2])) / Math.max(c[0], c[1], c[2]) : 0 };
    }
    function paintSegment(sg, fn) { var im = gb.getImageData(0, 0, W, H), d = im.data; sg.px.forEach(function (p) { var k = p * 4, v = fn([d[k], d[k + 1], d[k + 2]]); d[k] = v[0]; d[k + 1] = v[1]; d[k + 2] = v[2]; }); gb.putImageData(im, 0, 0); }
    function inside(x, y) { return x >= R + 1 && y >= R + 1 && x < W - R - 1 && y < H - R - 1; }
    var EDITS = {
      colour: function (s) { var sg = segment(s.x, s.y); if (sg.open || sg.px.length < R * R * 0.5 || sg.sat < 0.2) return false; var deg = pick([-1, 1]) * rnd(80, 150); paintSegment(sg, function (c) { return hueRotate(c, deg); }); s.seg = sg; return true; },
      light: function (s) { var sg = segment(s.x, s.y); if (sg.open || sg.px.length < R * R * 0.5 || sg.lum > 235 || sg.lum < 25) return false; var f = sg.lum > 120 ? rnd(0.5, 0.65) : rnd(1.5, 1.9); paintSegment(sg, function (c) { return c.map(function (v) { return Math.min(255, v * f); }); }); s.seg = sg; return true; },
      mirror: function (s) { if (s.tx < 0.12) return false; var src = source(s.x, s.y); region(s, function (d, i, a, x, y, n) { var j = (y * n + (n - 1 - x)) * 4; mix(d, i, [src[j], src[j + 1], src[j + 2]], a); }); return true; },
      nudge: function (s) { if (s.tx < 0.12) return false; var ang = rnd(0, 6.283), dist = R * rnd(0.35, 0.5), ox = Math.round(s.x + Math.cos(ang) * dist), oy = Math.round(s.y + Math.sin(ang) * dist); if (!inside(ox, oy)) return false; var src = source(ox, oy); region(s, function (d, i, a, x, y, n) { var j = (y * n + x) * 4; mix(d, i, [src[j], src[j + 1], src[j + 2]], a); }); return true; },
      remove: function (s) { if (s.tx < 0.1) return false; /* fill with the most similar-looking neighbouring area, so the detail disappears */
        var best = null, bs = 1e9;
        [[2.2, 0], [-2.2, 0], [0, 2.2], [0, -2.2], [1.6, 1.6], [-1.6, 1.6], [1.6, -1.6], [-1.6, -1.6]].forEach(function (o) { var ox = Math.round(s.x + o[0] * R), oy = Math.round(s.y + o[1] * R); if (!inside(ox, oy)) return; var st = stats(ox, oy, R); if (st.v < bs && Math.abs(st.mean - s.st.mean) < 90) { bs = st.v; best = [ox, oy]; } });
        if (!best || bs > s.st.v * 0.8) return false; var src = source(best[0], best[1]); region(s, function (d, i, a, x, y, n) { var j = (y * n + x) * 4; mix(d, i, [src[j], src[j + 1], src[j + 2]], a); }); return true; },
      clone: function (s) { if (s.tx < 0.12) return false; for (var t = 0; t < 40; t++) { var ox = ri(R + 1, W - R - 2), oy = ri(R + 1, H - R - 2); if (Math.hypot(ox - s.x, oy - s.y) < R * 3) continue; if (stats(ox, oy, R).v < 18) continue; var src = source(ox, oy); region(s, function (d, i, a, x, y, n) { var j = (y * n + x) * 4; mix(d, i, [src[j], src[j + 1], src[j + 2]], a); }); return true; } return false; }
    };
    /* Detailed places first, spread out, not on the very edge. */
    var cands = [];
    for (var c0 = 0; c0 < 220; c0++) { var px = ri(R + 2, W - R - 3), py = ri(R + 2, H - R - 3); cands.push({ x: px, y: py, st: stats(px, py, R) }); }
    cands.sort(function (a, b) { return b.st.v - a.st.v; });
    /* Pictures that are mostly flat colour (e.g. silhouettes) can't hide differences fairly. */
    var detailed = 0; for (var cc = 0; cc < cands.length; cc += 3) if (texture(cands[cc].x, cands[cc].y) >= 0.12) detailed++;
    if (detailed / Math.ceil(cands.length / 3) < 0.3) return null;
    var spots = [], order = shuffle(['nudge', 'remove', 'mirror', 'colour', 'clone', 'light', 'nudge', 'remove', 'mirror', 'colour']), oi = 0;
    for (var ci = 0; ci < cands.length && spots.length < cfg.K; ci++) {
      var c = cands[ci];
      if (c.st.v < 9 || spots.some(function (s) { return Math.hypot(s.x - c.x, s.y - c.y) < R * 2.8; })) continue;
      var s = { x: c.x, y: c.y, r: R, st: c.st, tx: texture(c.x, c.y), found: false }, snapshot = gb.getImageData(0, 0, W, H), ok = false;
      for (var tries = 0; tries < 6 && !ok; tries++) {
        var kind = order[oi++ % order.length];
        if (!EDITS[kind](s)) continue;
        var diff = meanDiff(patch(gb, s.x, s.y).data, patch(ga, s.x, s.y).data);
        if (diff >= (s.seg ? 10 : 16)) ok = true; else { gb.putImageData(snapshot, 0, 0); s.seg = null; } /* too faint: undo and try another kind */
      }
      if (ok) {
        if (s.seg) { var sx = 0, sy = 0; s.seg.px.forEach(function (p) { sx += p % W; sy += (p / W) | 0; }); s.x = Math.round(sx / s.seg.px.length); s.y = Math.round(sy / s.seg.px.length); s.seg = null; }
        spots.push(s);
      }
    }
    if (spots.length < cfg.K - 1) return null; /* not enough natural places: use another picture */
    return { A: A, B: B, W: W, H: H, spots: spots, side: side };
    }
    var K = spots.length, found = 0, misses = 0, hintsLeft = cfg.hints, t0 = Date.now(), timer = null;
    var wrap = el('div', { class: 'kg-diff' + (side ? ' side' : '') });
    [['Picture 1', A], ['Picture 2', B]].forEach(function (p) {
      var frame = el('div', { class: 'kg-diff__frame', style: 'width:' + W + 'px;height:' + H + 'px' }, [p[1]]);
      p[1].style.cssText = 'width:' + W + 'px;height:' + H + 'px';
      frame.addEventListener('pointerdown', function (e) { tap(e, frame); });
      wrap.appendChild(el('figure', { class: 'kg-diff__fig' }, [frame, el('figcaption', { text: p[0] })]));
    });
    box.innerHTML = '';
    var counter = el('p', { class: 'kg-theme' });
    var hintBtn = el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', onclick: hint });
    function clock() { var sec = Math.floor((Date.now() - t0) / 1000); return Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2); }
    function show() { counter.textContent = 'Found ' + found + ' of ' + K + '  \u00b7  \u23f1 ' + clock() + '  \u00b7  Misses: ' + misses; hintBtn.textContent = '\ud83d\udca1 Hint (' + hintsLeft + ' left)'; hintBtn.disabled = !hintsLeft; }
    show(); timer = setInterval(function () { if (!document.body.contains(counter)) return clearInterval(timer); show(); }, 1000);
    box.appendChild(counter);
    box.appendChild(el('p', { class: 'kt-note', text: 'Look closely: things may be moved, missing, mirrored, copied, or a different colour or brightness.' }));
    box.appendChild(wrap);
    box.appendChild(el('div', { class: 'kt-row' }, [hintBtn]));
    function ring(frame, s, cls) { var r = el('span', { class: cls, style: 'left:' + (s.x - s.r * 1.2) + 'px;top:' + (s.y - s.r * 1.2) + 'px;width:' + s.r * 2.4 + 'px;height:' + s.r * 2.4 + 'px' }); frame.appendChild(r); return r; }
    function hint() {
      if (!hintsLeft) return; var s = spots.filter(function (x) { return !x.found; })[0]; if (!s) return;
      hintsLeft--; show();
      wrap.querySelectorAll('.kg-diff__frame').forEach(function (f) { var h = ring(f, s, 'kg-ring kg-ring--hint'); setTimeout(function () { h.remove(); }, 1500); });
    }
    function tap(e, frame) {
      if (found === K) return;
      var r = frame.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
      var s = spots.filter(function (q) { return !q.found && Math.hypot(q.x - x, q.y - y) < q.r * 1.25; })[0];
      if (s) {
        s.found = true; found++;
        wrap.querySelectorAll('.kg-diff__frame').forEach(function (f) { ring(f, s, 'kg-ring'); });
        show();
        if (found === K) { clearInterval(timer); award('diff', level); celebrate(box, 'You spotted all ' + K + ' differences in ' + clock() + (misses ? ' with ' + misses + ' miss' + (misses === 1 ? '' : 'es') : ' without a single miss') + '!', start); }
      } else {
        misses++; show();
        var m = el('span', { class: 'kg-miss', text: '\u2715', style: 'left:' + (x - 10) + 'px;top:' + (y - 12) + 'px' }); frame.appendChild(m); setTimeout(function () { m.remove(); }, 700);
      }
    }
  }

  /* =================================================================
     4. PICTURE PUZZLE (tap two tiles to swap them, or drag)
     ================================================================= */
  async function picturePuzzle(box, level, alive) {
    var n = { easy: 3, medium: 4, hard: 5 }[level];
    var list = nextImages(), img = null, item = null;
    for (var i = 0; i < list.length && !img; i++) { try { img = await loadImage(list[i].src); item = list[i]; } catch (e) { img = null; } }
    if (!img || !alive()) return;
    rememberImage(item.src);
    var aspect = img.naturalWidth / img.naturalHeight, W = Math.min(box.clientWidth || 520, 520), H = Math.round(W / aspect);
    if (H > 480) { H = 480; W = Math.round(H * aspect); }
    var order = shuffle(Array.from({ length: n * n }, function (_, k) { return k; }));
    while (order.filter(function (v, k) { return v === k; }).length > Math.floor(n * n / 3)) order = shuffle(order);
    var boardEl = el('div', { class: 'kg-puzzle', style: 'width:' + W + 'px;height:' + H + 'px;--n:' + n });
    var tiles = [], sel = null, moves = 0, peek = null;
    function drawTiles() {
      boardEl.innerHTML = ''; tiles = [];
      order.forEach(function (piece, pos) {
        var t = el('button', { class: 'kg-tile' + (piece === pos && level === 'easy' ? ' ok' : '') + (sel === pos ? ' sel' : ''), type: 'button', 'data-pos': pos, 'aria-label': 'Tile ' + (pos + 1),
          style: 'background-image:url("' + item.src.replace(/"/g, '%22') + '");background-size:' + n * 100 + '% ' + n * 100 + '%;background-position:' + (n > 1 ? (piece % n) * 100 / (n - 1) : 0) + '% ' + (n > 1 ? Math.floor(piece / n) * 100 / (n - 1) : 0) + '%' });
        tiles.push(t); boardEl.appendChild(t);
      });
    }
    function swap(a, b) {
      var t = order[a]; order[a] = order[b]; order[b] = t; moves++; sel = null; drawTiles();
      counter.textContent = 'Moves: ' + moves;
      if (order.every(function (v, k) { return v === k; })) { boardEl.classList.add('solved'); award('puzzle', level); celebrate(box, 'Solved in ' + moves + ' moves! This picture is from the ' + item.page + ' page.', start); }
    }
    var downPos = null;
    boardEl.addEventListener('pointerdown', function (e) { var t = e.target.closest('.kg-tile'); if (!t || boardEl.classList.contains('solved')) return; downPos = +t.getAttribute('data-pos'); });
    boardEl.addEventListener('pointerup', function (e) {
      if (downPos === null) return; var t = document.elementFromPoint(e.clientX, e.clientY); t = t && t.closest ? t.closest('.kg-tile') : null;
      var up = t ? +t.getAttribute('data-pos') : downPos;
      if (up !== downPos) swap(downPos, up);
      else if (sel === null) { sel = up; drawTiles(); }
      else if (sel === up) { sel = null; drawTiles(); }
      else swap(sel, up);
      downPos = null;
    });
    var counter = el('p', { class: 'kg-theme', text: 'Moves: 0' });
    box.innerHTML = '';
    box.appendChild(el('p', { class: 'kt-note', text: 'Tap two pieces to swap them (or drag one onto another) until the picture is whole.' }));
    box.appendChild(counter);
    box.appendChild(el('div', { class: 'kg-puzzle-wrap' }, [boardEl]));
    box.appendChild(el('div', { class: 'kt-row' }, [el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83d\udc40 Peek at the picture', onclick: function () {
      if (peek) return; peek = el('img', { class: 'kg-peek', src: item.src, alt: '' }); boardEl.appendChild(peek); setTimeout(function () { peek.remove(); peek = null; }, 2000);
    } })]));
    drawTiles();
  }


  /* ---------- built-in games ---------- */
  REG.push({ id: 'seek', cat: 'think', icon: '\ud83d\udd24', name: 'Word Seek', blurb: 'Find hidden Bible words in the grid', daily: true, run: function (box, level) { return wordSeek(box, level); } });
  REG.push({ id: 'diff', cat: 'think', icon: '\ud83d\udd0d', name: 'Spot the Difference', blurb: 'Find what has changed between two pictures', daily: true, run: spotDiff });
  REG.push({ id: 'puzzle', cat: 'think', icon: '\ud83e\udde9', name: 'Picture Puzzle', blurb: 'Put the picture back together', daily: true, run: picturePuzzle });
  /* 7.9.2: Who Am I? is one of the Bible Games: its riddles open here, inside the games */
  if (document.querySelector('[data-kjt-whoami]')) REG.push({ id: 'whoami', cat: 'think', icon: '\u2753', name: 'Who Am I?', blurb: 'Read the clues and guess the Bible person', noLevels: true, run: function (box) {
    var app = document.querySelector('[data-kjt-whoami]'); if (!app) return;
    var mark = document.createComment('who-am-i'); app.parentNode.insertBefore(mark, app); box.appendChild(app);
    onLeave(function () { if (mark.parentNode) { mark.parentNode.insertBefore(app, mark); mark.remove(); } });
  } });

  /* 7.15.2: an address ending in #play-<game> (from the Site Map) opens that game */
  var asked = '';
  function fromHash() {
    var m = /^#play-([a-z0-9]+)$/.exec(location.hash || ''); if (!m || m[1] === asked || !find(m[1])) return;
    asked = m[1]; open(m[1]);
    var r = rootOf(find(m[1])); if (r && r.scrollIntoView) setTimeout(function () { r.scrollIntoView({ block: 'start' }); }, 60);
  }
  function boot() {
    /* 7.20.0: a friend's game link opened by the Bible Corner app: show it inside the app, not as a web page */
    try { var rs = /[?&]kg_resume=1/.test(location.search), rm = /^#play-([a-z0-9]+)$/.exec(location.hash); if (rs && rm) { autoResume = rm[1]; var uu = new URL(location.href); uu.searchParams.delete('kg_resume'); history.replaceState(history.state, '', uu.pathname + uu.search + uu.hash); } } catch (e) {}
    try { var jm = /[?&]kg_join=([A-Za-z0-9]{6}(?:[A-Za-z0-9]{2})?)(?![A-Za-z0-9])/.exec(location.search), gm = /^#play-([a-z]+)$/.exec(location.hash); if (jm && gm && window.top === window && /^android-app:\/\/today\.knowingjesus\.biblecorner/.test(document.referrer)) { location.replace(location.origin + '/read/?kjt_app=1&kg_join=' + jm[1] + '&kg_game=' + gm[1]); return; } } catch (e) {}
    /* 7.25.0: tell the app which online games are going on (it looks at them while closed) */
    if (window.KJTNative) KJTGamesSync(); else window.addEventListener('kjt-native', function () { KJTGamesSync(); });
    if (!root) return;
    showMenu();
    fromHash(); window.addEventListener('hashchange', function () { asked = ''; fromHash(); });
    /* Site Core 7.0.0: the other game files arrive a moment later; show them in the menu when they do. */
    window.addEventListener('kjt-games-parts', function () { if (!state.game) showMenu(); fromHash(); });
    /* In the activity hub the games are prepared while hidden; redraw the current game the first time it is shown at a different size. */
    var lastW = 0;
    window.addEventListener('kjt-activity-shown', function (e) {
      if (e.detail !== 'games' && e.detail !== 'early') return;
      if (state.game && stage && stage.clientWidth && Math.abs(stage.clientWidth - lastW) > 40) start();
      lastW = stage ? stage.clientWidth : 0;
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);
})();
