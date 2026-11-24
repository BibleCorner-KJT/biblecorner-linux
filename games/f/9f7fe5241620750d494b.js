/* KJT Kids Corner · Solitaire (Site Core 7.9.33)
   One game, two ways to play (the choice is remembered on this device):
     🀄 Bible Tiles   tile solitaire (Mahjong style) with Bible pictures: fish, dove, lamb, the
                      four Gospel creatures and more. Easy, Medium and Hard layouts. Every deal can
                      be finished (it is built backwards from a finished game), and Shuffle keeps it so.
     🃏 Bible Cards   card solitaire (Klondike) with Bible suits: Crosses and Fish (blue),
                      Doves and Stars (red); A is Alpha, then 2 to 10, the Shepherd, the Prophet, the King.
                      Easy: turn one card, and the deal is checked so it can be won.
                      Medium: turn three. Hard: turn three, three times through the pile.
   Calm music made on the device (the same as the other calm games). Nothing is sent anywhere:
   best times and trophies stay on the device. */
(function () {
  'use strict';
  function boot() {
    if (!window.KJTGames || !window.KJTGames.kit || !window.KJTCalm) return setTimeout(boot, 120);
    var K = window.KJTGames.kit, el = K.el, C = window.KJTCalm, T = K.T || function (s) { return s; };
    var REDUCED = false; try { REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

    /* ============================ BIBLE TILES ============================ */
    var TILES = [['☦️', 'Orthodox cross'], ['🐟', 'Fish'], ['🕊️', 'Dove'], ['🐑', 'Lamb'], ['🍞', 'Bread'], ['🍇', 'Grapes'], ['🪔', 'Oil lamp'], ['🕯️', 'Candle'],
      ['🌈', 'Rainbow'], ['⭐', 'Star'], ['👑', 'Crown'], ['🌿', 'Olive branch'], ['🌾', 'Wheat'], ['🦁', 'Lion'], ['🦅', 'Eagle'], ['🐂', 'Ox'], ['👼', 'Angel'],
      ['📜', 'Scroll'], ['📖', 'Gospel book'], ['🗝️', 'Keys'], ['🐚', 'Shell'], ['⛪', 'Church'], ['🔔', 'Bell'], ['🌴', 'Palm'], ['🌼', 'Flower'], ['🏺', 'Water jar'],
      ['💧', 'Water'], ['🔥', 'Fire'], ['☀️', 'Sun'], ['🌙', 'Moon'], ['⛰️', 'Mountain'], ['🌳', 'Tree'], ['🐋', 'Great fish'], ['🐪', 'Camel'], ['🍯', 'Honey'],
      ['⚓', 'Anchor'], ['🧺', 'Basket'], ['🐦', 'Sparrow']];
    /* layers from the bottom: [tiles across, tiles down]; each layer sits half a tile in from the one below */
    var LAYERS = { easy: [[6, 4], [5, 3], [4, 2], [1, 1]], medium: [[8, 5], [7, 4], [6, 3], [3, 2]], hard: [[10, 6], [9, 5], [8, 4], [5, 3], [2, 2]] };

    function tileGame(area, level, alive, say, setInfo) {
      var LV = LAYERS[level] ? level : 'easy', L = LAYERS[LV], W = L[0][0] * 2, H = L[0][1] * 2, NL = L.length, P = [];
      L.forEach(function (d, z) { var ox = (W - d[0] * 2) / 2, oy = (H - d[1] * 2) / 2; for (var j = 0; j < d[1]; j++) for (var i = 0; i < d[0]; i++) P.push({ x: ox + i * 2, y: oy + j * 2, z: z }); });
      var N = P.length, above = [], lefts = [], rights = [];
      for (var i = 0; i < N; i++) {
        above.push([]); lefts.push([]); rights.push([]);
        for (var j = 0; j < N; j++) {
          if (i === j) continue;
          var dx = P[j].x - P[i].x, dy = P[j].y - P[i].y;
          if (P[j].z === P[i].z + 1 && Math.abs(dx) < 2 && Math.abs(dy) < 2) above[i].push(j);
          if (P[j].z === P[i].z && Math.abs(dy) < 2) { if (dx === -2) lefts[i].push(j); if (dx === 2) rights[i].push(j); }
        }
      }
      var on = [], kind = [], sel = -1, hist = [], hints = 0, shuffles = 0, t0 = 0, done = false, timers = [];
      function freeIn(i, has) {
        for (var k = 0; k < above[i].length; k++) if (has[above[i][k]]) return false;
        var l = lefts[i].some(function (x) { return has[x]; }), r = rights[i].some(function (x) { return has[x]; });
        return !(l && r);
      }
      /* Built backwards: take away two free tiles at a time from the full layout; those two become a pair.
         Taking the pairs away in the opposite order always finishes the game. */
      function solvableDeal(idx, kinds) {
        for (var t = 0; t < 400; t++) {
          var has = []; idx.forEach(function (x) { has[x] = true; });
          var left = idx.length, order = [];
          while (left) {
            var fr = idx.filter(function (x) { return has[x] && freeIn(x, has); });
            if (fr.length < 2) break;
            fr = K.shuffle(fr); has[fr[0]] = has[fr[1]] = false; left -= 2; order.push(fr[0], fr[1]);
          }
          if (!left) { var ks = K.shuffle(kinds), out = {}; for (var p = 0; p < ks.length; p++) { out[order[2 * p]] = ks[p]; out[order[2 * p + 1]] = ks[p]; } return out; }
        }
        return null;
      }
      var all = []; for (i = 0; i < N; i++) all.push(i);
      var pairs = N / 2, pool = K.shuffle(TILES.map(function (x, k) { return k; })), kinds = [];
      /* four of each picture (two pairs), as in a real set: more than one pair is open at a time */
      var nk = Math.min(pool.length, Math.ceil(pairs / 2));
      for (i = 0; i < pairs; i++) kinds.push(pool[i % nk]);
      var dealt = solvableDeal(all, kinds);
      for (i = 0; i < N; i++) { on[i] = true; kind[i] = dealt[i]; }

      var wrap = el('div', { class: 'ksol-mjwrap' }), board = el('div', { class: 'ksol-mj', role: 'group', 'aria-label': 'Tile board' });
      wrap.appendChild(board); area.appendChild(wrap);
      var els = [];
      all.forEach(function (i) {
        var b = el('button', { class: 'ksol-t', type: 'button' }, [el('span', { class: 'ksol-t__e', 'aria-hidden': 'true' })]);
        b.addEventListener('click', function () { tap(i); });
        els.push(b); board.appendChild(b);
      });
      function freeNow(i) { return on[i] && freeIn(i, on); }
      function openPairs() {
        var by = {}, n = 0, first = null;
        for (var i = 0; i < N; i++) if (freeNow(i)) (by[kind[i]] = by[kind[i]] || []).push(i);
        Object.keys(by).forEach(function (k) { var c = by[k].length; if (c > 1) { n += Math.floor(c / 2); if (!first) first = [by[k][0], by[k][1]]; } });
        return { n: n, first: first };
      }
      function left() { var n = 0; for (var i = 0; i < N; i++) if (on[i]) n++; return n; }
      var geo = { u: 20 };
      function layout() {
        var bw = Math.max(240, wrap.clientWidth || area.clientWidth || 320), cap = LV === 'hard' ? 32 : LV === 'medium' ? 34 : 38;
        var d0 = 0.24, u = Math.max(14, Math.min(cap, Math.floor((bw - 6) / (W + NL * d0 + 0.6)))), hu = Math.round(u * 1.24), d = Math.max(2, Math.round(u * d0)), side = Math.max(2, Math.round(u * 0.2));
        geo = { u: u, hu: hu, d: d, side: side };
        board.style.width = (W * u + NL * d + side + 2) + 'px'; board.style.height = (H * hu + NL * d + side + 2) + 'px';
        for (var i = 0; i < N; i++) {
          var p = P[i], s = els[i].style;
          s.left = (p.x * u + (NL - 1 - p.z) * d) + 'px'; s.top = (p.y * hu + (NL - 1 - p.z) * d) + 'px';
          s.width = (2 * u - side - 1) + 'px'; s.height = (2 * hu - side - 1) + 'px';
          s.fontSize = Math.round(u * 1.12) + 'px'; s.borderRadius = Math.round(u * 0.24) + 'px';
          s.zIndex = p.z * 100 + p.y * 2 + (p.x > W / 2 ? 0 : 1);
          s.boxShadow = Math.round(side / 2) + 'px ' + Math.round(side / 2) + 'px 0 #d9bf86,' + side + 'px ' + side + 'px 0 #9a7536,' + (side + 1) + 'px ' + (side + 2) + 'px ' + (side + 4) + 'px rgba(40,20,0,.38)';
        }
      }
      function paint() {
        var help = LV !== 'hard';
        for (var i = 0; i < N; i++) {
          var b = els[i], f = freeNow(i), t = TILES[kind[i]];
          b.firstChild.textContent = t[0];
          b.className = 'ksol-t' + (on[i] ? '' : ' out') + (i === sel ? ' sel' : '') + (on[i] && !f && help ? ' blk' : '');
          b.setAttribute('aria-label', T(t[1]) + (on[i] && !f ? ' · ' + T('blocked') : ''));
          b.disabled = !on[i]; b.tabIndex = on[i] && f ? 0 : -1;
        }
        var op = openPairs();
        setInfo([['🀄', 'Tiles left', left()], LV === 'easy' ? ['👀', 'Pairs you can take', op.n] : null]);
        return op;
      }
      function later(fn, ms) { timers.push(setTimeout(function () { if (alive()) fn(); }, ms)); }
      function tap(i) {
        if (done || !on[i]) return;
        if (!t0) t0 = Date.now();
        if (!freeNow(i)) { nope(els[i]); say('That tile is not free yet. A free tile has nothing on top and an open side, left or right.', 'try'); return; }
        if (sel === i) { sel = -1; paint(); say(''); return; }
        if (sel >= 0 && kind[sel] === kind[i]) {
          var a = sel; sel = -1; on[a] = on[i] = false; hist.push({ a: a, b: i }); K.sound('tilematch');
          var op = paint();
          if (!left()) return win();
          if (!op.n) say('No pairs can be taken now. Press Shuffle to mix the tiles.', 'try'), shuffleBtn.classList.add('ksol-pulse');
          else say('');
          return;
        }
        if (sel >= 0) say('Those two are not the same. Find a matching pair.', 'try'); else say('');
        sel = i; paint();
      }
      function nope(b) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); }
      function hint() {
        if (done) return;
        var op = openPairs();
        if (!op.first) { say('No pairs can be taken now. Press Shuffle to mix the tiles.', 'try'); shuffleBtn.classList.add('ksol-pulse'); return; }
        hints++; sel = -1; paint();
        op.first.forEach(function (i) { els[i].classList.add('hint'); });
        later(function () { op.first.forEach(function (i) { els[i].classList.remove('hint'); }); }, 2200);
        say('These two make a pair.', 'good');
      }
      function shuffle() {
        if (done) return;
        var idx = all.filter(function (i) { return on[i]; }), count = {}, ks = [];
        idx.forEach(function (i) { count[kind[i]] = (count[kind[i]] || 0) + 1; });
        Object.keys(count).forEach(function (k) { for (var n = 0; n < count[k] / 2; n++) ks.push(+k); });
        var d = solvableDeal(idx, ks);
        if (!d) { say('These tiles cannot all be matched any more. Press Undo, or start a new game.', 'try'); return; }
        hist.push({ old: kind.slice() }); idx.forEach(function (i) { kind[i] = d[i]; });
        shuffles++; sel = -1; shuffleBtn.classList.remove('ksol-pulse'); K.sound('shuffle');
        if (!REDUCED) { board.classList.remove('ksol-mix'); void board.offsetWidth; board.classList.add('ksol-mix'); }
        paint(); say('The tiles are mixed. Every one of them can still be matched.', 'good');
      }
      function undo() {
        if (done || !hist.length) return;
        var h = hist.pop(); if (h.old) kind = h.old; else { on[h.a] = on[h.b] = true; }
        sel = -1; shuffleBtn.classList.remove('ksol-pulse'); paint(); say('');
      }
      function win() {
        done = true; var secs = (Date.now() - t0) / 1000;
        var b = K.best('solitaire-tiles', LV, Math.round(secs), 'low'), isNew = K.award('solitaire', LV);
        K.sound('success');
        say('');
        return { secs: secs, best: b, trophy: isNew, hints: hints, verse: ['“He maketh me to lie down in green pastures: he leadeth me beside the still waters.”', 'Psalm 23:2'] };
      }
      var shuffleBtn = el('button', { class: 'kgm-tool', type: 'button' }, [el('span', { text: '🔀 ', 'aria-hidden': 'true' }), el('span', { text: 'Shuffle' })]);
      shuffleBtn.addEventListener('click', shuffle);
      var onResize = function () { layout(); };
      window.addEventListener('resize', onResize);
      layout(); paint();
      return {
        tools: [['💡', 'Hint', hint], ['↩️', 'Undo', undo], shuffleBtn],
        help: ['Find two tiles that are the same and tap them both. A tile can be taken only when nothing is on top of it and its left or right side is open.'],
        stop: function () { window.removeEventListener('resize', onResize); timers.forEach(clearTimeout); },
        started: function () { return t0; },
        winHook: function (fn) { var w = win; win = function () { var r = w(); fn(r); return r; }; }
      };
    }

    /* ============================ BIBLE CARDS ============================ */
    var SVG = {
      cross: '<svg viewBox="0 0 40 40" aria-hidden="true"><path fill="currentColor" d="M18 2h4v36h-4z M14 6.5h12v3H14z M8 12h24v4.2H8z M11.5 24 28.5 28.2v3.4L11.5 27.4z"/></svg>',
      fish: '<svg viewBox="0 0 40 40" aria-hidden="true"><path fill="currentColor" d="M2.5 20C9 9.5 23 8.5 30.5 18L38 10.5 36 20l2 9.5-7.5-7.5C23 31.5 9 30.5 2.5 20z"/><circle cx="10" cy="18.2" r="1.8" fill="#fffaf0"/></svg>',
      dove: '<svg viewBox="0 0 100 80" aria-hidden="true"><path fill="currentColor" d="M10 52 C28 50 40 44 48 34 C52 20 62 12 74 12 C82 12 88 18 90 22 L98 24 L90 28 C88 44 74 58 54 60 L40 72 L42 60 C30 60 18 58 10 52 Z"/><path fill="currentColor" opacity=".7" d="M46 36 C40 20 24 10 6 10 C14 22 26 32 44 40 Z"/><circle cx="78" cy="20" r="3" fill="#fffaf0"/></svg>',
      star: (function () { var p = []; for (var k = 0; k < 16; k++) { var a = Math.PI * k / 8 - Math.PI / 2, r = k % 2 ? 7.6 : 18.5; p.push((20 + r * Math.cos(a)).toFixed(1) + ',' + (20 + r * Math.sin(a)).toFixed(1)); } return '<svg viewBox="0 0 40 40" aria-hidden="true"><polygon fill="currentColor" points="' + p.join(' ') + '"/></svg>'; })()
    };
    var SUITS = [['cross', 'Crosses', 0], ['fish', 'Fish', 0], ['dove', 'Doves', 1], ['star', 'Stars', 1]];
    var FACES = { 11: ['🐑', 'Shepherd'], 12: ['📜', 'Prophet'], 13: ['👑', 'King'] };
    function suitOf(id) { return Math.floor(id / 13); }
    function rankOf(id) { return id % 13 + 1; }
    function redOf(id) { return SUITS[suitOf(id)][2]; }
    function rankText(r) { return r === 1 ? 'Α' : FACES[r] ? FACES[r][0] : String(r); }
    function rankName(r) { return r === 1 ? T('Alpha') : FACES[r] ? T(FACES[r][1]) : String(r); }
    function fitsOn(id, top) { return top === undefined ? rankOf(id) === 13 : (rankOf(top) === rankOf(id) + 1 && redOf(top) !== redOf(id)); }

    /* Easy deals are checked by a small solver first. With one card turned at a time and no limit on
       going through the pile, any card in the pile can be reached, so the solver treats the pile as a set. */
    function solvable(tab, downs, talon, limit) {
      var seen = {}, nodes = 0;
      function key(cols, dn, f, tal) { return cols.map(function (c, i) { return dn[i] + ':' + c.join(','); }).sort().join('|') + '/' + f.join(',') + '/' + tal.slice().sort(function (a, b) { return a - b; }).join(','); }
      function fix(cols, dn, c) { if (dn[c] >= cols[c].length && cols[c].length) dn[c] = cols[c].length - 1; if (!cols[c].length) dn[c] = 0; }
      function rec(cols, dn, f, tal, depth) {
        if (f[0] + f[1] + f[2] + f[3] === 52) return true;
        if (++nodes > limit || depth > 400) return false;
        var k = key(cols, dn, f, tal); if (seen[k]) return false; seen[k] = 1;
        var c, d, id, moves = [];
        for (c = 0; c < 7; c++) if (cols[c].length) { id = cols[c][cols[c].length - 1]; if (rankOf(id) === f[suitOf(id)] + 1) moves.push(['cf', c]); }
        tal.forEach(function (x) { if (rankOf(x) === f[suitOf(x)] + 1) moves.push(['tf', x]); });
        for (c = 0; c < 7; c++) {
          var len = cols[c].length; if (len <= dn[c]) continue;
          for (var s = dn[c]; s < len; s++) {
            id = cols[c][s];
            var reveals = s === dn[c] && s > 0, frees = s === 0, helps = s > dn[c] && rankOf(cols[c][s - 1]) === f[suitOf(cols[c][s - 1])] + 1;
            if (!reveals && !helps && !frees) continue;
            var emptied = false;
            for (d = 0; d < 7; d++) if (d !== c) {
              var top = cols[d][cols[d].length - 1];
              if (!cols[d].length) { if (frees || emptied) continue; emptied = true; }
              if (fitsOn(id, top)) moves.push(['cc', c, d, s]);
            }
          }
        }
        tal.forEach(function (x) { var em = false; for (var d = 0; d < 7; d++) { if (!cols[d].length) { if (em) continue; em = true; } if (fitsOn(x, cols[d][cols[d].length - 1])) moves.push(['tc', x, d]); } });
        for (var m = 0; m < moves.length; m++) {
          var mv = moves[m], nc = cols.map(function (x) { return x.slice(); }), nd = dn.slice(), nf = f.slice(), nt = tal;
          if (mv[0] === 'cf') { id = nc[mv[1]].pop(); nf[suitOf(id)]++; fix(nc, nd, mv[1]); }
          else if (mv[0] === 'tf') { nt = tal.filter(function (x) { return x !== mv[1]; }); nf[suitOf(mv[1])]++; }
          else if (mv[0] === 'cc') { var run = nc[mv[1]].splice(mv[3]); nc[mv[2]] = nc[mv[2]].concat(run); fix(nc, nd, mv[1]); }
          else { nt = tal.filter(function (x) { return x !== mv[1]; }); nc[mv[2]].push(mv[1]); }
          if (rec(nc, nd, nf, nt, depth + 1)) return true;
          if (nodes > limit) return false;
        }
        return false;
      }
      return rec(tab.map(function (x) { return x.slice(); }), downs.slice(), [0, 0, 0, 0], talon.slice(), 0);
    }
    function dealCards(checked) {
      var tries = 0, t0 = Date.now(), last = null;
      while (true) {
        var deck = []; for (var i = 0; i < 52; i++) deck.push(i); deck = K.shuffle(deck);
        var t = [[], [], [], [], [], [], []], up = [];
        for (var c = 0; c < 7; c++) for (var r = 0; r <= c; r++) t[c].push(deck.pop());
        t.forEach(function (col) { up[col[col.length - 1]] = true; });
        last = { stock: deck, waste: [], f: [[], [], [], []], t: t, up: up, passes: 1, moves: 0 };
        tries++;
        if (!checked) return last;
        if (solvable(t, [0, 1, 2, 3, 4, 5, 6], deck, 12000)) { last.checked = true; return last; }
        if (tries >= 30 || Date.now() - t0 > 1500) return last;
      }
    }

    function cardGame(area, level, alive, say, setInfo) {
      var LV = { easy: 1, medium: 1, hard: 1 }[level] ? level : 'easy', DRAW = LV === 'easy' ? 1 : 3, PASSES = LV === 'hard' ? 3 : Infinity;
      var st = dealCards(LV === 'easy'), hist = [], t0 = 0, done = false, busy = false, timers = [], hints = 0, lastTap = null, ver = 0;
      var board = el('div', { class: 'ksol-cards', role: 'group', 'aria-label': 'Card table' }); area.appendChild(board);
      var slots = { s: slot('s'), f: [0, 1, 2, 3].map(function (s) { return slot('f', s); }), t: [0, 1, 2, 3, 4, 5, 6].map(function (c) { return slot('t', c); }) };
      function slot(kindOf, n) {
        var b = el('button', { class: 'ksol-slot ksol-slot--' + kindOf, type: 'button' });
        if (kindOf === 'f') { b.innerHTML = SVG[SUITS[n][0]]; b.classList.add(SUITS[n][2] ? 'red' : 'dark'); b.setAttribute('aria-label', T(SUITS[n][1]) + ': ' + T('Alpha')); }
        if (kindOf === 't') { b.appendChild(el('span', { text: '👑', 'aria-hidden': 'true' })); b.setAttribute('aria-label', T('Empty column: only a King can go here')); }
        if (kindOf === 's') b.setAttribute('aria-label', T('Turn over a card'));
        b.addEventListener('click', function () { slotTap(kindOf, n); });
        board.appendChild(b); return b;
      }
      var cards = [];
      for (var id = 0; id < 52; id++) cards.push(makeCard(id));
      function makeCard(id) {
        var r = rankOf(id), su = SUITS[suitOf(id)], corner = function (cls) { return el('span', { class: 'ksc__c' + (cls || '') }, [el('b', { text: rankText(r) }), el('i', { html: SVG[su[0]] })]); };
        var mid = r > 10 ? el('span', { class: 'ksc__m ksc__m--face' }, [el('span', { class: 'ksc__fe', text: FACES[r][0] }), el('i', { class: 'ksc__fs', html: SVG[su[0]] })])
          : el('span', { class: 'ksc__m' + (r === 1 ? ' ksc__m--a' : ''), html: SVG[su[0]] });
        var b = el('button', { class: 'ksc ' + (su[2] ? 'red' : 'dark'), type: 'button', 'data-id': id }, [
          el('span', { class: 'ksc__f' }, [corner(), mid, corner(' ksc__c--b')]), el('span', { class: 'ksc__b', 'aria-hidden': 'true' })]);
        b.addEventListener('pointerdown', function (e) { down(e, id); });
        b.addEventListener('click', function (e) { if (e.detail === 0) cardTap(id); });
        board.appendChild(b); return b;
      }
      /* where a card is */
      function where(id) {
        var i = st.stock.indexOf(id); if (i >= 0) return { p: 's', i: i };
        i = st.waste.indexOf(id); if (i >= 0) return { p: 'w', i: i };
        for (var s = 0; s < 4; s++) { i = st.f[s].indexOf(id); if (i >= 0) return { p: 'f', n: s, i: i }; }
        for (var c = 0; c < 7; c++) { i = st.t[c].indexOf(id); if (i >= 0) return { p: 't', n: c, i: i }; }
        return null;
      }
      var G = {};
      function geom() {
        var bw = Math.max(260, board.clientWidth || 320), g = Math.max(4, Math.round(bw * 0.014)), cw = Math.min(104, Math.floor((bw - 8 * g) / 7)), ch = Math.round(cw * 1.4);
        G = { g: g, cw: cw, ch: ch, x: function (c) { return g + c * (cw + g); }, top: g, ty: g * 2 + ch, dn: Math.max(6, Math.round(ch * 0.11)), upd: Math.max(14, Math.round(ch * 0.27)), fan: Math.round(cw * 0.24) };
        board.style.setProperty('--cw', cw + 'px'); board.style.setProperty('--ch', ch + 'px');
      }
      function place(b, x, y, z) { b.style.transform = 'translate(' + x + 'px,' + y + 'px)'; b.style.zIndex = z; b._x = x; b._y = y; }
      function paint() {
        geom();
        place(slots.s, G.x(0), G.top, 1);
        slots.s.className = 'ksol-slot ksol-slot--s' + (st.stock.length ? '' : (canRecycle() ? ' again' : ' none'));
        slots.s.textContent = st.stock.length ? '' : (canRecycle() ? '↻' : '');
        slots.s.setAttribute('aria-label', T(st.stock.length ? 'Turn over a card' : canRecycle() ? 'Turn the pile over again' : 'The pile is used up'));
        for (var s = 0; s < 4; s++) place(slots.f[s], G.x(3 + s), G.top, 1);
        for (var c = 0; c < 7; c++) place(slots.t[c], G.x(c), G.ty, 1);
        var bottom = G.ty + G.ch;
        st.stock.forEach(function (id, i) { show(id, G.x(0), G.top, 10 + i, false, i === st.stock.length - 1, 'Turn over a card'); });
        var wl = st.waste.length;
        st.waste.forEach(function (id, i) { var k = DRAW > 1 ? Math.max(0, i - Math.max(0, wl - 3)) : 0; show(id, G.x(1) + k * G.fan, G.top, 10 + i, true, i === wl - 1); });
        for (s = 0; s < 4; s++) st.f[s].forEach(function (id, i) { show(id, G.x(3 + s), G.top, 10 + i, true, i === st.f[s].length - 1); });
        for (c = 0; c < 7; c++) {
          var col = st.t[c], y = G.ty;
          col.forEach(function (id, i) { show(id, G.x(c), y, 10 + i, !!st.up[id], st.up[id]); if (i < col.length - 1) y += st.up[id] ? G.upd : G.dn; });
          bottom = Math.max(bottom, y + G.ch);
        }
        board.style.height = (bottom + G.g * 2 + G.upd) + 'px';
        var info = [['🃏', 'Moves', st.moves]];
        if (PASSES !== Infinity) info.push(['↻', 'Pile turns left', Math.max(0, PASSES - st.passes)]);
        setInfo(info);
        ver++;
      }
      function show(id, x, y, z, up, live, label) {
        var b = cards[id];
        b.classList.toggle('up', !!up);
        b.classList.toggle('dn', !up);
        b.tabIndex = live ? 0 : -1;
        b.setAttribute('aria-label', up ? rankName(rankOf(id)) + ' · ' + T(SUITS[suitOf(id)][1]) : T(label || 'Face-down card'));
        place(b, x, y, z);
      }
      function canRecycle() { return st.waste.length > 0 && st.passes < PASSES; }
      function snap() { hist.push(JSON.stringify(st)); if (hist.length > 400) hist.shift(); }
      function startClock() { if (!t0) t0 = Date.now(); }
      function later(fn, ms) { timers.push(setTimeout(function () { if (alive()) fn(); }, ms)); }
      function flipTops() {
        var flipped = false;
        st.t.forEach(function (col) { var top = col[col.length - 1]; if (top !== undefined && !st.up[top]) { st.up[top] = true; flipped = true; } });
        if (flipped) later(function () { K.sound('cardflip'); }, 160);
      }
      function draw() {
        if (done || busy) return;
        startClock();
        if (st.stock.length) {
          snap(); for (var k = 0; k < DRAW && st.stock.length; k++) { var id = st.stock.pop(); st.up[id] = true; st.waste.push(id); }
          st.moves++; K.sound('cardflip'); say(''); paint(); after(); return;
        }
        if (canRecycle()) { snap(); st.stock = st.waste.reverse(); st.waste = []; st.stock.forEach(function (id) { st.up[id] = false; }); st.passes++; st.moves++; K.sound('shuffle'); paint(); return; }
        say(PASSES !== Infinity ? 'You have been through the pile three times. Use the cards on the table.' : 'The pile is empty.', 'try');
      }
      function slotTap(kindOf, n) {
        if (kindOf === 's') return draw();
      }
      /* the cards that move with this one, or null if it cannot be picked up */
      function grab(id) {
        var w = where(id); if (!w || !st.up[id]) return null;
        if (w.p === 'w') return w.i === st.waste.length - 1 ? { w: w, ids: [id] } : null;
        if (w.p === 'f') return w.i === st.f[w.n].length - 1 ? { w: w, ids: [id] } : null;
        if (w.p === 't') return { w: w, ids: st.t[w.n].slice(w.i) };
        return null;
      }
      function canGo(g, dest) {
        var id = g.ids[0];
        if (dest.p === 'f') { if (g.ids.length !== 1 || suitOf(id) !== dest.n) return false; return rankOf(id) === st.f[dest.n].length + 1; }
        if (dest.p === 't') { if (g.w.p === 't' && g.w.n === dest.n) return false; var col = st.t[dest.n]; return fitsOn(id, col[col.length - 1]); }
        return false;
      }
      function dests(g) {
        var out = [], id = g.ids[0];
        if (canGo(g, { p: 'f', n: suitOf(id) })) out.push({ p: 'f', n: suitOf(id) });
        var empties = [];
        for (var c = 0; c < 7; c++) if (canGo(g, { p: 't', n: c })) (st.t[c].length ? out : empties).push({ p: 't', n: c });
        /* a King already at the bottom of a column is not moved to another empty column */
        if (!(g.w.p === 't' && g.w.i === 0)) out = out.concat(empties.slice(0, 1));
        return out;
      }
      function move(g, dest, quiet) {
        if (!quiet) snap(); startClock(); /* the cards that go up by themselves belong to the move before */
        var src = g.w.p === 'w' ? st.waste : g.w.p === 'f' ? st.f[g.w.n] : st.t[g.w.n];
        src.splice(src.length - g.ids.length, g.ids.length);
        var to = dest.p === 'f' ? st.f[dest.n] : st.t[dest.n];
        g.ids.forEach(function (x) { to.push(x); });
        st.moves++; flipTops();
        if (!quiet) K.sound('card');
        say(''); paint(); after();
      }
      function cardTap(id) {
        if (done || busy) return;
        var w = where(id);
        if (w && w.p === 's') return draw();
        var g = grab(id);
        if (!g) { nope(cards[id]); return; }
        var ds = dests(g);
        if (!ds.length) { nope(cards[id]); say('That card cannot move yet.', 'try'); return; }
        var k = 0;
        if (lastTap && lastTap.id === id && lastTap.ver === ver && ds.length > 1) k = (lastTap.k + 1) % ds.length;
        move(g, ds[k]);
        if (ds.length > 1) lastTap = { id: id, k: k, ver: ver }; else lastTap = null;
      }
      function nope(b) { b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); }
      /* dragging */
      var drag = null;
      function down(e, id) {
        if (done || busy || (e.button !== undefined && e.button !== 0)) return;
        var w = where(id);
        if (w && w.p === 's') { e.preventDefault(); drag = { stock: true, id: id, x0: e.clientX, y0: e.clientY }; listen(); return; }
        var g = grab(id); if (!g) { drag = { none: true, id: id, x0: e.clientX, y0: e.clientY }; listen(); return; }
        drag = { g: g, id: id, x0: e.clientX, y0: e.clientY, moved: false };
        listen();
      }
      function listen() { document.addEventListener('pointermove', onMove, { passive: false }); document.addEventListener('pointerup', onUp); document.addEventListener('pointercancel', onCancel); }
      function unlisten() { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp); document.removeEventListener('pointercancel', onCancel); }
      function onMove(e) {
        if (!drag || !drag.g) return;
        var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
        if (!drag.moved) {
          if (Math.abs(dx) + Math.abs(dy) < 8) return;
          drag.moved = true; startClock();
          drag.ids = drag.g.ids; drag.ids.forEach(function (x, i) { var b = cards[x]; b.classList.add('drag'); b._bx = b._x; b._by = b._y; b.style.zIndex = 900 + i; });
        }
        e.preventDefault();
        drag.ids.forEach(function (x) { var b = cards[x]; b.style.transform = 'translate(' + (b._bx + dx) + 'px,' + (b._by + dy) + 'px)'; });
        var t = target(e); drag.over = t;
        board.querySelectorAll('.ksol-over').forEach(function (n) { n.classList.remove('ksol-over'); });
        if (t && canGo(drag.g, t)) overEl(t).classList.add('ksol-over');
      }
      function overEl(t) { if (t.p === 'f') { var f = st.f[t.n]; return f.length ? cards[f[f.length - 1]] : slots.f[t.n]; } var col = st.t[t.n]; return col.length ? cards[col[col.length - 1]] : slots.t[t.n]; }
      function target(e) {
        var r = board.getBoundingClientRect(), b0 = cards[drag.ids[0]], x = b0._bx + (e.clientX - drag.x0) + G.cw / 2, y = b0._by + (e.clientY - drag.y0) + G.ch / 3;
        var c = Math.floor((x - G.g / 2) / (G.cw + G.g)); if (c < 0 || c > 6) return null;
        if (y < G.ty - G.g / 2) return c >= 3 ? { p: 'f', n: c - 3 } : null;
        return { p: 't', n: c };
      }
      function onUp(e) {
        var d = drag; drag = null; unlisten();
        board.querySelectorAll('.ksol-over').forEach(function (n) { n.classList.remove('ksol-over'); });
        if (!d) return;
        if (d.stock) { if (Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) < 12) draw(); return; }
        if (d.none) { if (Math.abs(e.clientX - d.x0) + Math.abs(e.clientY - d.y0) < 12) nope(cards[d.id]); return; }
        if (!d.moved) { cardTap(d.id); return; }
        d.ids.forEach(function (x) { cards[x].classList.remove('drag'); });
        var t = d.over;
        if (t && canGo(d.g, t)) { lastTap = null; move(d.g, t); }
        else paint();
      }
      function onCancel() { var d = drag; drag = null; unlisten(); if (d && d.ids) { d.ids.forEach(function (x) { cards[x].classList.remove('drag'); }); paint(); } }
      /* after every move: Alphas (and on Easy every card that is safe) go up by themselves; then the finish */
      function safe(id) {
        var r = rankOf(id); if (r <= 2) return true;
        if (LV !== 'easy') return false;
        var red = redOf(id), ok = true;
        for (var s = 0; s < 4; s++) if (SUITS[s][2] !== red && st.f[s].length < r - 1) ok = false;
        return ok;
      }
      function autoOne(any) {
        var c, id, cand = [];
        if (st.waste.length) cand.push(st.waste[st.waste.length - 1]);
        for (c = 0; c < 7; c++) if (st.t[c].length) cand.push(st.t[c][st.t[c].length - 1]);
        for (var k = 0; k < cand.length; k++) {
          id = cand[k]; if (!st.up[id]) continue;
          if (rankOf(id) === st.f[suitOf(id)].length + 1 && (any || (rankOf(id) === 1) || safe(id))) return id;
        }
        return null;
      }
      function after() {
        if (st.f.every(function (f) { return f.length === 13; })) return win();
        var id = autoOne(false);
        if (id !== null) { busy = true; later(function () { busy = false; var g = grab(id); if (g) { move(g, { p: 'f', n: suitOf(id) }, true); K.sound('card'); } }, REDUCED ? 60 : 260); return; }
        if (!st.stock.length && !st.waste.length && st.t.every(function (col) { return col.every(function (x) { return st.up[x]; }); })) {
          say('All the cards are face up. They are going home!', 'good'); busy = true;
          (function step() { var x = autoOne(true); if (x === null) { busy = false; return after(); } var g = grab(x); busy = true; if (g) { snapless(g, { p: 'f', n: suitOf(x) }); } later(step, REDUCED ? 40 : 120); })();
        }
      }
      function snapless(g, dest) {
        var src = g.w.p === 'w' ? st.waste : st.t[g.w.n]; src.splice(src.length - 1, 1); st.f[dest.n].push(g.ids[0]); st.moves++; K.sound('card'); paint();
        if (st.f.every(function (f) { return f.length === 13; })) { busy = false; win(); }
      }
      function hintMove() {
        var c, g, ds, i;
        var tops = []; if (st.waste.length) tops.push(st.waste[st.waste.length - 1]);
        for (c = 0; c < 7; c++) if (st.t[c].length) tops.push(st.t[c][st.t[c].length - 1]);
        for (i = 0; i < tops.length; i++) { g = grab(tops[i]); if (g && canGo(g, { p: 'f', n: suitOf(tops[i]) })) return { ids: g.ids, to: { p: 'f', n: suitOf(tops[i]) } }; }
        for (c = 0; c < 7; c++) {
          var col = st.t[c], first = -1; for (i = 0; i < col.length; i++) if (st.up[col[i]]) { first = i; break; }
          if (first < 0) continue;
          g = grab(col[first]); ds = dests(g).filter(function (d) { return d.p === 't' && (first > 0 || st.t[d.n].length); });
          if (ds.length) return { ids: g.ids, to: ds[0] };
        }
        if (st.waste.length) { g = grab(st.waste[st.waste.length - 1]); ds = dests(g).filter(function (d) { return d.p === 't'; }); if (ds.length) return { ids: g.ids, to: ds[0] }; }
        if (st.stock.length || canRecycle()) return { stock: true };
        return null;
      }
      function hint() {
        if (done || busy) return;
        var h = hintMove(); hints++;
        board.querySelectorAll('.hint').forEach(function (n) { n.classList.remove('hint', 'ksol-from'); });
        if (!h) { say('No more moves. Press Undo to try another way, or start a new game.', 'try'); return; }
        var lit = [];
        if (h.stock) { lit.push(st.stock.length ? cards[st.stock[st.stock.length - 1]] : slots.s); say(st.stock.length ? 'Turn over a card from the pile.' : 'Turn the pile over again.', 'good'); }
        else { h.ids.forEach(function (x) { lit.push(cards[x]); }); lit.push(overEl(h.to)); say('Try moving this card.', 'good'); }
        lit.forEach(function (n, i) { n.classList.add('hint'); if (!i) n.classList.add('ksol-from'); });
        later(function () { lit.forEach(function (n) { n.classList.remove('hint', 'ksol-from'); }); }, 2200);
      }
      function undo() {
        if (done || busy || !hist.length) return;
        st = JSON.parse(hist.pop()); lastTap = null; paint(); say('');
      }
      var winFn = null;
      function win() {
        if (done) return; done = true; busy = false;
        var secs = (Date.now() - (t0 || Date.now())) / 1000;
        var b = K.best('solitaire-cards', LV, Math.round(secs), 'low'), isNew = K.award('solitaire', LV);
        K.sound('success'); say('');
        if (!REDUCED) board.classList.add('ksol-won');
        var r = { secs: secs, best: b, trophy: isNew, hints: hints, moves: st.moves, verse: ['“I am Alpha and Omega, the beginning and the end, the first and the last.”', 'Revelation 22:13'] };
        if (winFn) later(function () { winFn(r); }, REDUCED ? 100 : 900);
      }
      var onResize = function () { if (!drag) paint(); };
      window.addEventListener('resize', onResize);
      paint(); later(after, 400);
      return {
        tools: [['💡', 'Hint', hint], ['↩️', 'Undo', undo]],
        help: [LV === 'easy' ? 'Easy: turn over one card at a time. This deal can be won.' : LV === 'medium' ? 'Medium: turn over three cards at a time.' : 'Hard: turn over three cards at a time, and go through the pile only three times.',
          'Build each suit at the top, from Alpha (Α) up to the King. In the columns, put cards in order going down, changing colour each time: blue, red, blue… Only a King can go in an empty column. Tap a card to move it, or drag it.'],
        key: true,
        stop: function () { window.removeEventListener('resize', onResize); unlisten(); timers.forEach(clearTimeout); },
        started: function () { return t0; },
        winHook: function (fn) { winFn = fn; }
      };
    }

    /* ============================ THE GAME ============================ */
    function solitaire(box, level, alive) {
      var inner = C.frame(box, 'solitaire', 'solitaire', ['church', 'valley', 'fields', 'prayer', 'victory']);
      var mode = K.store('sol_mode') === 'cards' ? 'cards' : 'tiles', cur = null, tick = null;
      var modes = el('div', { class: 'kgm-modes ksol-modes', role: 'group', 'aria-label': 'Choose your solitaire' });
      function modeBtn(v, icon, txt, sub) {
        var b = el('button', { class: 'ksol-mode', type: 'button', 'aria-pressed': mode === v ? 'true' : 'false' }, [el('span', { class: 'ksol-mode__i', text: icon, 'aria-hidden': 'true' }), el('span', { class: 'ksol-mode__t' }, [el('strong', { text: txt }), el('small', { text: sub })])]);
        b.addEventListener('click', function () { if (mode === v) return; mode = v; K.store('sol_mode', v); drawModes(); run(); });
        return b;
      }
      function drawModes() { modes.innerHTML = ''; modes.appendChild(modeBtn('tiles', '🀄', 'Bible Tiles', 'Match the pairs (Mahjong)')); modes.appendChild(modeBtn('cards', '🃏', 'Bible Cards', 'Card solitaire')); }
      drawModes(); inner.appendChild(modes);
      var bar = el('div', { class: 'ksol-bar' }), info = el('div', { class: 'kgm-tally ksol-info' }), clock = el('span', { class: 'kgm-score ksol-clock' }), tools = el('div', { class: 'kgm-tools' });
      bar.appendChild(info); bar.appendChild(tools); inner.appendChild(bar);
      var status = el('p', { class: 'kgm-msg', 'aria-live': 'polite' }); inner.appendChild(status);
      var area = el('div', { class: 'ksol-area' }); inner.appendChild(area);
      var helpBox = el('div', { class: 'ksol-help' }); inner.appendChild(helpBox);
      function say(t, cls) { status.textContent = t || ''; status.className = 'kgm-msg' + (cls ? ' ' + cls : ''); }
      function setInfo(list) {
        info.innerHTML = '';
        list.forEach(function (x) { if (x) info.appendChild(el('span', { class: 'kgm-score' }, [el('span', { text: x[0] + ' ', 'aria-hidden': 'true' }), el('span', { text: x[1] }), el('span', { text: ': ' }), el('strong', { text: String(x[2]) })])); });
        info.appendChild(clock);
      }
      function run() {
        if (cur) cur.stop(); clearInterval(tick);
        area.innerHTML = ''; tools.innerHTML = ''; helpBox.innerHTML = ''; say('');
        inner.querySelectorAll('.kg-done,.ksol-result').forEach(function (n) { n.remove(); });
        area.className = 'ksol-area ksol-area--' + mode;
        cur = (mode === 'cards' ? cardGame : tileGame)(area, level, function () { return alive() && cur === me; }, say, setInfo);
        var me = cur;
        cur.tools.forEach(function (t) {
          if (t.nodeType) { tools.appendChild(t); return; }
          var b = el('button', { class: 'kgm-tool', type: 'button' }, [el('span', { text: t[0] + ' ', 'aria-hidden': 'true' }), el('span', { text: t[1] })]);
          b.addEventListener('click', t[2]); tools.appendChild(b);
        });
        cur.help.forEach(function (h) { helpBox.appendChild(el('p', { class: 'kgm-small', text: h })); });
        if (cur.key) {
          var key = el('p', { class: 'kgm-small ksol-key' });
          [['Α', 'Alpha'], ['2 … 10', ''], ['🐑', 'Shepherd'], ['📜', 'Prophet'], ['👑', 'King']].forEach(function (k, i) {
            if (i) key.appendChild(el('span', { class: 'ksol-key__s', text: '→', 'aria-hidden': 'true' }));
            key.appendChild(el('span', { class: 'ksol-key__k' }, [el('b', { text: k[0] }), k[1] ? el('span', { text: k[1] }) : null]));
          });
          helpBox.insertBefore(key, helpBox.firstChild);
          var suits = el('p', { class: 'kgm-small ksol-suits' });
          SUITS.forEach(function (s) { suits.appendChild(el('span', { class: 'ksol-suit ' + (s[2] ? 'red' : 'dark') }, [el('i', { html: SVG[s[0]] }), el('span', { text: s[1] })])); });
          helpBox.insertBefore(suits, key.nextSibling);
        }
        clock.textContent = '⏱ 0:00';
        tick = setInterval(function () { if (!alive()) return clearInterval(tick); var s0 = cur.started(); clock.textContent = '⏱ ' + C.fmtTime(s0 ? (Date.now() - s0) / 1000 : 0); }, 1000);
        cur.winHook(function (r) {
          clearInterval(tick); clock.textContent = '⏱ ' + C.fmtTime(r.secs);
          var extra = el('div', { class: 'kgm-result ksol-result' }, [
            el('p', {}, [el('span', { text: 'Time' }), el('span', { text: ': ' }), el('strong', { text: C.fmtTime(r.secs) }), r.best.isNew ? el('span', { text: '  🌟 ' }) : null, r.best.isNew ? el('span', { text: 'New best time!' }) : null]),
            r.moves ? el('p', {}, [el('span', { text: 'Moves' }), el('span', { text: ': ' + r.moves })]) : null,
            r.hints ? el('p', {}, [el('span', { text: 'Hints used' }), el('span', { text: ': ' + r.hints })]) : null,
            r.trophy ? el('p', { text: 'You earned a new trophy!' }) : null,
            el('p', { class: 'kgm-verse', text: r.verse[0] }),
            el('p', { class: 'kgm-ref', text: r.verse[1] })
          ]);
          K.celebrate(inner, mode === 'cards' ? 'Every card is home!' : 'You cleared all the tiles!', function () { run(); }, extra);
        });
      }
      K.onLeave(function () { if (cur) cur.stop(); clearInterval(tick); cur = null; });
      run();
    }

    window.KJTGames.register({ id: 'solitaire', cat: 'think', icon: '🃏', name: 'Solitaire', blurb: 'Bible Tiles (Mahjong) or Bible Cards: you choose', daily: false, run: solitaire });
  }
  boot();
})();
