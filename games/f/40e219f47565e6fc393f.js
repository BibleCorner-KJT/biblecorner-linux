/* KJT Kids Corner · Calm games (Site Core 7.9.16)
   Three quiet board games for Bible Games, each on a painting from the site:
     🔢 Sudoku       Easy, Medium, Hard and Ultra Hard. Every puzzle is new and has one solution;
                     the level is checked by the ways of thinking it needs (Ultra Hard needs more than
                     the usual tricks). Notes, hints, undo, a timer and best times.
     🐟 Fish & Dove  noughts and crosses with an ichthys fish and a dove: against the computer
                     (Easy, Medium, Hard: Hard never loses) or two players on one device.
     🔤 Word Builder (English pages only) a word-tile game against the computer on a 13×13 board.
                     The dictionary (assets/kids-games/wordbuilder-words.txt, from SCOWL, see
                     wordbuilder-words-COPYRIGHT.txt) has British and American spellings; rude words are
                     left out. It is loaded only when Word Builder is opened.
   Calm music for all three is played by the browser itself (Web Audio: soft chords and bells,
   nothing downloaded), with a music button; the choice is remembered on this device.
   Nothing is sent anywhere: best times and trophies stay on the device. */
(function () {
  'use strict';
  var ME = document.currentScript && document.currentScript.src || '';
  var BASE = ME.replace(/games-calm\.js.*$/, '');
  /* 7.11.0: the pictures may be in KJT Site Pictures */
  var PICS_AT = window.KJT_PICS && window.KJT_PICS.assets;
  var PB = PICS_AT ? PICS_AT + 'kids-games/' : BASE;
  var PICS = {
    fields: { src: PB + '../kids-adventure/img/bg-fields.webp', name: 'Green pastures' },
    valley: { src: PB + '../kids-adventure/img/bg-valley.webp', name: 'Still waters' },
    prayer: { src: PB + '../heroes/hero-prayer.webp', name: 'Morning prayer' },
    church: { src: PB + '../heroes/hero-how-are-you-today.webp', name: 'The church on the hill' },
    victory: { src: PB + '../kids-adventure/img/bg-victory.webp', name: 'Evening light' }
  };

  /* ===================== calm music (made on the device) ===================== */
  var Music = (function () {
    var KEY = 'kjt_games_music', ctx = null, master = null, bus = null, wet = null, timer = null, piece = null, bar = 0, wantOn = false;
    function stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
    function on() { var s = stored(); if (s) return s === 'on'; try { return localStorage.getItem('kjt_kids_sound') !== 'off'; } catch (e) { return true; } }
    function setOn(v) { try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (e) {} }
    function init() {
      if (ctx) { if (ctx.state === 'suspended') try { ctx.resume(); } catch (e) {} return ctx; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
      master = ctx.createGain(); master.gain.value = 0.0001; master.connect(ctx.destination);
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400; lp.Q.value = 0.3; lp.connect(master);
      bus = ctx.createGain(); bus.gain.value = 0.55; bus.connect(lp);
      /* a long, soft church-like echo (a made-up room, no files) */
      try {
        var len = Math.floor(ctx.sampleRate * 5), imp = ctx.createBuffer(2, len, ctx.sampleRate);
        for (var c = 0; c < 2; c++) { var d = imp.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
        var conv = ctx.createConvolver(); conv.buffer = imp; wet = ctx.createGain(); wet.gain.value = 0.45; wet.connect(conv); conv.connect(lp);
      } catch (e) { wet = null; }
      return ctx;
    }
    function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
    function voice(f, t, dur, vol, type, detune) {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = type || 'sine'; o.frequency.value = f; if (detune) o.detune.value = detune;
      var a = Math.min(3.5, dur * 0.4);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.setValueAtTime(vol, t + dur - Math.min(3, dur * 0.4)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bus); if (wet) g.connect(wet); o.start(t); o.stop(t + dur + 0.05);
    }
    function bell(f, t, vol) {
      [[1, 1], [2.01, 0.28], [3.02, 0.1]].forEach(function (p) {
        var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f * p[0];
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * p[1], t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2 / p[0]);
        o.connect(g); g.connect(bus); if (wet) g.connect(wet); o.start(t); o.stop(t + 4.5);
      });
    }
    /* three gentle pieces: chords (MIDI notes), the notes the bells may play, seconds per chord */
    var PIECES = {
      sudoku: { len: 9, chords: [[38, 50, 57, 62, 66], [35, 47, 54, 59, 62], [31, 43, 50, 55, 59], [33, 45, 52, 57, 61], [38, 50, 57, 62, 64], [31, 43, 55, 59, 62]], bells: [74, 76, 78, 81, 83, 86, 88] },
      words: { len: 10, chords: [[41, 53, 60, 65, 69], [38, 50, 57, 62, 65], [34, 46, 53, 58, 62], [36, 48, 55, 60, 64], [41, 53, 57, 60, 67], [34, 46, 58, 62, 65]], bells: [72, 74, 77, 79, 81, 84, 86] },
      ttt: { len: 7, chords: [[43, 55, 62, 67, 71], [40, 52, 59, 64, 67], [36, 48, 55, 60, 64], [38, 50, 57, 62, 66]], bells: [74, 79, 81, 83, 86, 88, 91] },
      /* 7.9.33: Solitaire, slow and warm (A-flat) */
      solitaire: { len: 11, chords: [[44, 56, 63, 68, 72], [41, 53, 60, 65, 68], [37, 49, 56, 61, 65], [39, 51, 58, 63, 67], [44, 56, 60, 63, 70], [37, 49, 61, 65, 68], [39, 51, 55, 63, 70], [44, 56, 63, 67, 72]], bells: [75, 77, 80, 82, 84, 87, 89] }
    };
    function tick() {
      if (!ctx || !piece) return;
      var P = PIECES[piece], t = ctx.currentTime + 0.08, ch = P.chords[bar % P.chords.length], dur = P.len + 3.5;
      voice(hz(ch[0]), t, dur, 0.06, 'sine');
      for (var i = 1; i < ch.length; i++) { voice(hz(ch[i]), t, dur, 0.022, 'triangle', -5); voice(hz(ch[i]), t + 0.15, dur, 0.018, 'sine', 6); }
      var n = 1 + Math.floor(Math.random() * 3);
      for (var k = 0; k < n; k++) bell(hz(P.bells[Math.floor(Math.random() * P.bells.length)]), t + 0.6 + Math.random() * (P.len - 1.5), 0.05 + Math.random() * 0.03);
      bar++;
    }
    function start(name) {
      piece = name; wantOn = true;
      if (!on()) return;
      if (!init()) return;
      clearInterval(timer); bar = Math.floor(Math.random() * 4);
      master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), ctx.currentTime); master.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 2.5);
      tick(); timer = setInterval(tick, PIECES[name].len * 1000);
    }
    function stop() {
      wantOn = false; clearInterval(timer); timer = null;
      if (ctx && master) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), ctx.currentTime); master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2); }
    }
    document.addEventListener('visibilitychange', function () {
      if (!ctx) return;
      if (document.hidden) { try { ctx.suspend(); } catch (e) {} } else if (wantOn && on()) { try { ctx.resume(); } catch (e) {} }
    });
    function button(el) {
      var b = el('button', { class: 'kgm-music', type: 'button' });
      function paint() { var o = on(); b.textContent = ''; b.appendChild(el('span', { text: o ? '🎵' : '🔇', 'aria-hidden': 'true' })); b.appendChild(el('span', { class: 'kgm-music__t', text: o ? 'Music on' : 'Music off' })); b.setAttribute('aria-pressed', o ? 'true' : 'false'); b.setAttribute('aria-label', o ? 'Turn the music off' : 'Turn the music on'); }
      b.addEventListener('click', function () { var o = !on(); setOn(o); if (o) start(piece || 'sudoku'); else { clearInterval(timer); timer = null; if (ctx && master) { master.gain.cancelScheduledValues(ctx.currentTime); master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), ctx.currentTime); master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.6); } } paint(); });
      paint(); return b;
    }
    return { start: start, stop: stop, button: button };
  })();

  function boot() {
    if (!window.KJTGames || !window.KJTGames.kit) return setTimeout(boot, 120);
    var K = window.KJTGames.kit, el = K.el, T = K.T || function (s) { return s; };

    /* The frame every calm game sits in: the painting, a soft veil, the music and picture buttons. */
    function frame(box, id, music, pics) {
      /* 7.9.40: the game's own paintings first, then every picture of the website */
      var ALLP = pics.map(function (k) { return { key: k, src: PICS[k].src, name: PICS[k].name }; });
      (K.pics || []).forEach(function (p) { if (p.kind === 'photo' && p.w >= 700 && !ALLP.some(function (q) { return q.src === p.src; })) ALLP.push({ key: p.src, src: p.src, name: p.name }); });
      function find(k) { for (var i = 0; i < ALLP.length; i++) if (ALLP[i].key === k) return ALLP[i]; return null; }
      var pick = K.store('pic_' + id); if (!pick || !find(pick)) pick = ALLP[0].key;
      var wrap = el('div', { class: 'kgm kgm--' + id });
      var bg = el('div', { class: 'kgm__bg', 'aria-hidden': 'true' });
      function paint() { bg.style.backgroundImage = 'url("' + find(pick).src + '")'; }
      paint();
      var tools = el('div', { class: 'kgm__tools' });
      var picBtn = el('button', { class: 'kgm-pic', type: 'button', title: 'Change the picture' }, [el('span', { text: '🖼️', 'aria-hidden': 'true' }), el('span', { class: 'kgm-music__t', text: 'Picture' })]);
      picBtn.setAttribute('aria-label', 'Change the picture');
      picBtn.setAttribute('aria-haspopup', 'dialog');
      var chooser = null;
      function closeChooser() { if (chooser) { chooser.remove(); chooser = null; picBtn.focus(); } }
      picBtn.addEventListener('click', function () {
        if (chooser) { closeChooser(); return; }
        var g = el('div', { class: 'kgm-bgs__g' });
        ALLP.forEach(function (p) {
          var b = el('button', { class: 'kgm-bgs__i' + (p.key === pick ? ' is-on' : ''), type: 'button', title: p.name }, [el('img', { src: p.src, alt: '', loading: 'lazy', decoding: 'async' })]);
          b.setAttribute('aria-label', p.name); b.setAttribute('aria-pressed', p.key === pick ? 'true' : 'false');
          b.addEventListener('click', function () { pick = p.key; K.store('pic_' + id, pick); paint(); closeChooser(); });
          g.appendChild(b);
        });
        chooser = el('div', { class: 'kgm-bgs', role: 'dialog', 'aria-label': 'Choose a picture' }, [
          el('div', { class: 'kgm-bgs__h' }, [el('strong', { text: 'Choose a picture' }), el('button', { class: 'kgm-pic', type: 'button', text: '✕', onclick: closeChooser })]), g]);
        chooser.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeChooser(); });
        wrap.appendChild(chooser);
        var on = chooser.querySelector('.is-on') || chooser.querySelector('.kgm-bgs__i'); if (on) on.focus();
      });
      tools.appendChild(Music.button(el)); tools.appendChild(picBtn);
      var inner = el('div', { class: 'kgm__in' });
      wrap.appendChild(bg); wrap.appendChild(el('div', { class: 'kgm__veil', 'aria-hidden': 'true' })); wrap.appendChild(tools); wrap.appendChild(inner);
      box.appendChild(wrap);
      Music.start(music); K.onLeave(function () { Music.stop(); });
      return inner;
    }
    function fmtTime(s) { s = Math.max(0, Math.round(s)); var m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r; }
    /* 7.9.33: Solitaire (games-solitaire.js) uses the same frame and music */
    window.KJTCalm = { frame: frame, music: Music, fmtTime: fmtTime };

    /* =============================== SUDOKU =============================== */
    var ALL = 0x3FE; /* bits 1..9 */
    function bitCount(x) { var c = 0; while (x) { x &= x - 1; c++; } return c; }
    function boxOf(i) { return Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3); }
    var PEERS = []; (function () { for (var i = 0; i < 81; i++) { var r = Math.floor(i / 9), c = i % 9, b = boxOf(i), p = []; for (var j = 0; j < 81; j++) if (j !== i && (Math.floor(j / 9) === r || j % 9 === c || boxOf(j) === b)) p.push(j); PEERS.push(p); } })();
    var UNITS = []; (function () { for (var k = 0; k < 9; k++) { var r = [], c = [], b = []; for (var j = 0; j < 9; j++) { r.push(k * 9 + j); c.push(j * 9 + k); b.push((Math.floor(k / 3) * 3 + Math.floor(j / 3)) * 9 + (k % 3) * 3 + j % 3); } UNITS.push(r, c, b); } })();
    /* how many solutions (stops at limit) */
    function countSolutions(g, limit) {
      var a = g.slice(), rows = [0, 0, 0, 0, 0, 0, 0, 0, 0], cols = rows.slice(), boxes = rows.slice(), n = 0;
      for (var i = 0; i < 81; i++) if (a[i]) { var bit = 1 << a[i], r = Math.floor(i / 9), c = i % 9, b = boxOf(i); if ((rows[r] | cols[c] | boxes[b]) & bit) return 0; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit; }
      function rec() {
        var best = -1, bm = 0, bc = 10;
        for (var i = 0; i < 81; i++) if (!a[i]) { var m = ALL & ~(rows[Math.floor(i / 9)] | cols[i % 9] | boxes[boxOf(i)]), cnt = bitCount(m); if (cnt < bc) { bc = cnt; best = i; bm = m; if (cnt < 2) break; } }
        if (best < 0) { n++; return n >= limit; }
        if (!bm) return false;
        var r = Math.floor(best / 9), c = best % 9, b = boxOf(best);
        for (var d = 1; d <= 9; d++) if (bm & (1 << d)) { var bit = 1 << d; a[best] = d; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit; if (rec()) return true; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit; a[best] = 0; }
        return false;
      }
      rec(); return n;
    }
    function fullGrid() {
      var a = new Array(81).fill(0), rows = new Array(9).fill(0), cols = rows.slice(), boxes = rows.slice();
      function rec(i) {
        if (i === 81) return true;
        var r = Math.floor(i / 9), c = i % 9, b = boxOf(i), m = ALL & ~(rows[r] | cols[c] | boxes[b]), ds = K.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        for (var k = 0; k < 9; k++) { var d = ds[k], bit = 1 << d; if (!(m & bit)) continue; a[i] = d; rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit; if (rec(i + 1)) return true; rows[r] &= ~bit; cols[c] &= ~bit; boxes[b] &= ~bit; a[i] = 0; }
        return false;
      }
      rec(0); return a;
    }
    /* A person's way of solving: 1 = naked singles, 2 = hidden singles, 3 = pairs and pointing; 4 = needs more. */
    function rate(g) {
      var a = g.slice(), cand = new Array(81), level = 0;
      for (var i = 0; i < 81; i++) cand[i] = a[i] ? 0 : ALL;
      function place(i, d) { a[i] = d; cand[i] = 0; PEERS[i].forEach(function (p) { cand[p] &= ~(1 << d); }); }
      for (i = 0; i < 81; i++) if (a[i]) PEERS[i].forEach(function (p) { cand[p] &= ~(1 << a[i]); });
      function nakedSingle() { for (var i = 0; i < 81; i++) if (!a[i] && bitCount(cand[i]) === 1) { place(i, Math.log2(cand[i])); return true; } return false; }
      function hiddenSingle() {
        for (var u = 0; u < 27; u++) for (var d = 1; d <= 9; d++) { var bit = 1 << d, at = -1, n = 0; for (var k = 0; k < 9; k++) { var i = UNITS[u][k]; if (a[i] === d) { n = -9; break; } if (cand[i] & bit) { n++; at = i; } } if (n === 1) { place(at, d); return true; } }
        return false;
      }
      function pairsAndPointing() {
        var changed = false;
        /* naked pairs */
        for (var u = 0; u < 27; u++) { var U = UNITS[u]; for (var x = 0; x < 9; x++) { var i = U[x]; if (a[i] || bitCount(cand[i]) !== 2) continue; for (var y = x + 1; y < 9; y++) { var j = U[y]; if (cand[j] !== cand[i]) continue; for (var z = 0; z < 9; z++) { var k = U[z]; if (k !== i && k !== j && !a[k] && (cand[k] & cand[i])) { cand[k] &= ~cand[i]; changed = true; } } } } }
        /* pointing (a digit in a box only on one row or column) and claiming */
        for (var b = 0; b < 9; b++) { var B = UNITS[b * 3 + 2]; for (var d = 1; d <= 9; d++) { var bit = 1 << d, rs = {}, cs = {}, cnt = 0; B.forEach(function (i) { if (!a[i] && (cand[i] & bit)) { rs[Math.floor(i / 9)] = 1; cs[i % 9] = 1; cnt++; } }); if (cnt < 2) continue;
          var rk = Object.keys(rs), ck = Object.keys(cs);
          if (rk.length === 1) { var r = +rk[0]; for (var c = 0; c < 9; c++) { var p = r * 9 + c; if (boxOf(p) !== b && !a[p] && (cand[p] & bit)) { cand[p] &= ~bit; changed = true; } } }
          if (ck.length === 1) { var cc = +ck[0]; for (var rr = 0; rr < 9; rr++) { var q = rr * 9 + cc; if (boxOf(q) !== b && !a[q] && (cand[q] & bit)) { cand[q] &= ~bit; changed = true; } } } } }
        for (var line = 0; line < 18; line++) { var L = UNITS[line < 9 ? line * 3 : (line - 9) * 3 + 1]; for (d = 1; d <= 9; d++) { bit = 1 << d; var bs = {}, n = 0; L.forEach(function (i) { if (!a[i] && (cand[i] & bit)) { bs[boxOf(i)] = 1; n++; } }); var bk = Object.keys(bs); if (n < 2 || bk.length !== 1) continue; var BB = UNITS[(+bk[0]) * 3 + 2]; BB.forEach(function (i) { if (L.indexOf(i) < 0 && !a[i] && (cand[i] & bit)) { cand[i] &= ~bit; changed = true; } }); } }
        /* hidden pairs: two digits that fit only the same two cells of a unit */
        for (u = 0; u < 27; u++) { U = UNITS[u]; var where = {}; for (d = 1; d <= 9; d++) { bit = 1 << d; var w = []; U.forEach(function (i) { if (!a[i] && (cand[i] & bit)) w.push(i); }); if (w.length === 2) where[d] = w.join(','); }
          var ds = Object.keys(where); for (var p1 = 0; p1 < ds.length; p1++) for (var p2 = p1 + 1; p2 < ds.length; p2++) if (where[ds[p1]] === where[ds[p2]]) { var keep = (1 << +ds[p1]) | (1 << +ds[p2]); where[ds[p1]].split(',').forEach(function (i) { if (cand[+i] & ~keep) { cand[+i] &= keep; changed = true; } }); } }
        /* X-wing on rows and on columns */
        for (d = 1; d <= 9; d++) { bit = 1 << d; for (var dirn = 0; dirn < 2; dirn++) { var spots = []; for (var L1 = 0; L1 < 9; L1++) { var at2 = []; for (var x2 = 0; x2 < 9; x2++) { var i2 = dirn ? x2 * 9 + L1 : L1 * 9 + x2; if (!a[i2] && (cand[i2] & bit)) at2.push(x2); } spots.push(at2.length === 2 ? at2.join(',') : ''); }
          for (var l1 = 0; l1 < 9; l1++) for (var l2 = l1 + 1; l2 < 9; l2++) if (spots[l1] && spots[l1] === spots[l2]) spots[l1].split(',').forEach(function (xs) { var xx = +xs; for (var o = 0; o < 9; o++) if (o !== l1 && o !== l2) { var j2 = dirn ? xx * 9 + o : o * 9 + xx; if (!a[j2] && (cand[j2] & bit)) { cand[j2] &= ~bit; changed = true; } } }); } }
        return changed;
      }
      for (var guard = 0; guard < 400; guard++) {
        if (a.indexOf(0) < 0) return Math.max(level, 1);
        if (nakedSingle()) { level = Math.max(level, 1); continue; }
        if (hiddenSingle()) { level = Math.max(level, 2); continue; }
        if (pairsAndPointing()) { level = Math.max(level, 3); continue; }
        return 4;
      }
      return 4;
    }
    var SDK = { easy: { clues: 40, max: 2 }, medium: { clues: 32, max: 2 }, hard: { clues: 0, want: 3 }, ultra: { clues: 0, want: 4 } };
    function makePuzzle(level) {
      var sol = fullGrid(), g = sol.slice(), spec = SDK[level] || SDK.easy, order = K.shuffle(Array.apply(null, { length: 41 }).map(function (x, i) { return i; }));
      var clues = 81;
      for (var k = 0; k < order.length; k++) {
        var i = order[k], j = 80 - i; if (spec.clues && clues <= spec.clues) break;
        var a = g[i], b = g[j]; g[i] = 0; g[j] = 0;
        if (countSolutions(g, 2) !== 1) { g[i] = a; g[j] = b; continue; }
        clues -= (i === j ? 1 : 2);
      }
      return { grid: g, sol: sol, rating: rate(g), clues: clues };
    }
    /* builds a puzzle of the right level in small steps, so the page never freezes */
    function findPuzzle(level, alive, done) {
      var spec = SDK[level] || SDK.easy, tries = 0, best = null, t0 = Date.now();
      (function step() {
        if (!alive()) return;
        var p = makePuzzle(level); tries++;
        var ok = spec.want ? p.rating === spec.want : p.rating <= spec.max;
        if (!best || (spec.want && Math.abs(p.rating - spec.want) < Math.abs(best.rating - spec.want))) best = p;
        if (ok || tries > 400 || Date.now() - t0 > 9000) return done(ok ? p : best);
        setTimeout(step, 0);
      })();
    }
    function sudoku(box, level, alive) {
      var inner = frame(box, 'sudoku', 'sudoku', ['fields', 'valley', 'prayer', 'victory']);
      var wait = el('p', { class: 'kgm-wait', role: 'status' }, [el('span', { class: 'kgm-spin', 'aria-hidden': 'true' }), el('span', { text: level === 'ultra' ? 'Preparing an Ultra Hard puzzle… this can take a few seconds.' : 'Preparing your puzzle…' })]);
      inner.appendChild(wait);
      setTimeout(function () { findPuzzle(level, alive, function (p) { if (!alive()) return; wait.remove(); playSudoku(inner, p, level, alive); }); }, 60);
    }
    /* 7.24.0: the board, used by Sudoku and by Sudoku Race (race: { done(result) }: no trophies, a hint adds 30 seconds) */
    function playSudoku(inner, P, level, alive, race) {
      {
        var val = P.grid.slice(), given = P.grid.map(function (v) { return !!v; }), notes = new Array(81).fill(0), sel = given.indexOf(false), noteMode = false, hints = 0, mistakes = 0, history = [], t0 = Date.now(), done = false, pen = 0;
        var head = el('div', { class: 'kgm-head' });
        var clock = el('strong', { class: 'kgm-time', text: '0:00' });
        head.appendChild(el('span', { class: 'kgm-stat' }, [el('span', { text: '⏱️ ', 'aria-hidden': 'true' }), clock]));
        var bestT = K.bestOf('sudoku', level);
        if (race) head.appendChild(el('span', { class: 'kgm-stat', text: T('A hint adds 30 seconds') }));
        else head.appendChild(el('span', { class: 'kgm-stat' }, [el('span', { text: 'Best time' }), el('span', { text: ': ' }), el('strong', { text: bestT ? fmtTime(bestT) : '–' })]));
        inner.appendChild(head);
        var board = el('div', { class: 'kgm-sdk', role: 'grid', 'aria-label': 'Sudoku board', tabindex: '0' });
        var cells = [];
        for (var i = 0; i < 81; i++) (function (i) {
          var r = Math.floor(i / 9), c = i % 9;
          var b = el('button', { class: 'kgm-cell' + (given[i] ? ' given' : '') + (c % 3 === 2 && c < 8 ? ' rb' : '') + (r % 3 === 2 && r < 8 ? ' bb' : ''), type: 'button', role: 'gridcell', tabindex: '-1' });
          b.addEventListener('click', function () { sel = i; paint(); board.focus({ preventScroll: true }); });
          cells.push(b); board.appendChild(b);
        })(i);
        inner.appendChild(board);
        var pad = el('div', { class: 'kgm-pad' });
        var digitBtns = [];
        for (var d = 1; d <= 9; d++) (function (d) { var b = el('button', { class: 'kgm-key', type: 'button', text: String(d) }); b.addEventListener('click', function () { input(d); }); digitBtns.push(b); pad.appendChild(b); })(d);
        inner.appendChild(pad);
        var noteBtn = el('button', { class: 'kgm-tool', type: 'button', 'aria-pressed': 'false' }, [el('span', { text: '✏️ ', 'aria-hidden': 'true' }), el('span', { text: 'Notes' })]);
        noteBtn.addEventListener('click', function () { noteMode = !noteMode; noteBtn.setAttribute('aria-pressed', noteMode ? 'true' : 'false'); });
        var tools = el('div', { class: 'kgm-tools' }, [
          noteBtn,
          el('button', { class: 'kgm-tool', type: 'button', onclick: function () { erase(); } }, [el('span', { text: '⌫ ', 'aria-hidden': 'true' }), el('span', { text: 'Erase' })]),
          el('button', { class: 'kgm-tool', type: 'button', onclick: function () { undo(); } }, [el('span', { text: '↶ ', 'aria-hidden': 'true' }), el('span', { text: 'Undo' })]),
          el('button', { class: 'kgm-tool', type: 'button', onclick: function () { hint(); } }, [el('span', { text: '💡 ', 'aria-hidden': 'true' }), el('span', { text: 'Hint' })])
        ]);
        inner.appendChild(tools);
        var msg = el('p', { class: 'kgm-msg', 'aria-live': 'polite' }); inner.appendChild(msg);
        function peersOf(i) { return PEERS[i]; }
        function paint() {
          var sv = sel >= 0 ? val[sel] : 0, counts = new Array(10).fill(0);
          for (var i = 0; i < 81; i++) if (val[i] && val[i] === P.sol[i]) counts[val[i]]++;
          for (i = 0; i < 81; i++) {
            var b = cells[i], v = val[i];
            b.classList.toggle('sel', i === sel);
            /* 7.9.30: the row, column and box of the chosen square light up on Easy only; harder levels leave it to you */
            b.classList.toggle('peer', level === 'easy' && sel >= 0 && i !== sel && peersOf(sel).indexOf(i) >= 0);
            b.classList.toggle('same', !!sv && v === sv && i !== sel);
            b.classList.toggle('wrong', !given[i] && !!v && v !== P.sol[i]);
            b.textContent = '';
            if (v) b.appendChild(el('span', { class: 'kgm-v', text: String(v) }));
            else if (notes[i]) { var n = el('span', { class: 'kgm-notes' }); for (var d = 1; d <= 9; d++) n.appendChild(el('i', { text: notes[i] & (1 << d) ? String(d) : '' })); b.appendChild(n); }
            var r = Math.floor(i / 9) + 1, c = i % 9 + 1;
            b.setAttribute('aria-label', 'Row ' + r + ', column ' + c + ': ' + (v ? v : 'empty'));
          }
          digitBtns.forEach(function (b, k) { b.classList.toggle('used', counts[k + 1] >= 9); });
        }
        function snapshot() { history.push({ val: val.slice(), notes: notes.slice() }); if (history.length > 200) history.shift(); }
        function input(d) {
          if (done || sel < 0 || given[sel]) return;
          snapshot();
          if (noteMode) { if (!val[sel]) notes[sel] ^= (1 << d); K.sound('tap'); }
          else {
            val[sel] = val[sel] === d ? 0 : d; notes[sel] = 0;
            if (val[sel]) { peersOf(sel).forEach(function (p) { notes[p] &= ~(1 << d); }); if (d !== P.sol[sel]) { mistakes++; K.sound('miss'); } else K.sound('good'); }
          }
          paint(); check();
        }
        function erase() { if (done || sel < 0 || given[sel]) return; snapshot(); val[sel] = 0; notes[sel] = 0; paint(); }
        function undo() { if (done || !history.length) return; var h = history.pop(); val = h.val; notes = h.notes; paint(); }
        function hint() {
          if (done) return;
          var target = (sel >= 0 && !given[sel] && val[sel] !== P.sol[sel]) ? sel : -1;
          if (target < 0) { for (var i = 0; i < 81; i++) if (val[i] !== P.sol[i]) { target = i; break; } }
          if (target < 0) return;
          snapshot(); val[target] = P.sol[target]; notes[target] = 0; sel = target; hints++; if (race) pen += 30;
          msg.textContent = ''; msg.appendChild(el('span', { text: '💡 ' })); msg.appendChild(el('span', { text: race ? T('Here is one number to help you.') + ' +30 s' : 'Here is one number to help you.' }));
          paint(); check();
        }
        function check() {
          for (var i = 0; i < 81; i++) if (val[i] !== P.sol[i]) return;
          done = true; clearInterval(tick); var secs = (Date.now() - t0) / 1000;
          K.sound('success');
          if (race) { race.done({ ms: Math.round((secs + pen) * 1000), hints: hints, mistakes: mistakes }); return; }
          var b = K.best('sudoku', level, Math.round(secs), 'low');
          var isNew = K.award('sudoku', level);
          var extra = el('div', { class: 'kgm-result' }, [
            el('p', {}, [el('span', { text: 'Time' }), el('span', { text: ': ' }), el('strong', { text: fmtTime(secs) }), b.isNew ? el('span', { text: '  🌟 ' }) : null, b.isNew ? el('span', { text: 'New best time!' }) : null]),
            hints ? el('p', {}, [el('span', { text: 'Hints used' }), el('span', { text: ': ' + hints })]) : null,
            isNew ? el('p', { text: 'You earned a new trophy!' }) : null,
            el('p', { class: 'kgm-verse', text: '“Be still, and know that I am God.”' }),
            el('p', { class: 'kgm-ref', text: 'Psalm 46:10' })
          ]);
          K.celebrate(inner, 'You solved the puzzle!', null, extra);
        }
        var tick = setInterval(function () { if (!alive()) return clearInterval(tick); if (!done) clock.textContent = fmtTime((Date.now() - t0) / 1000 + pen); }, 1000);
        K.onLeave(function () { clearInterval(tick); });
        board.addEventListener('keydown', function (e) {
          var k = e.key;
          if (/^[1-9]$/.test(k)) { e.preventDefault(); input(+k); return; }
          if (k === 'Backspace' || k === 'Delete' || k === '0') { e.preventDefault(); erase(); return; }
          if (k === 'n' || k === 'N') { e.preventDefault(); noteBtn.click(); return; }
          var mv = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[k];
          if (mv) { e.preventDefault(); if (getComputedStyle(board).direction === 'rtl' && (k === 'ArrowLeft' || k === 'ArrowRight')) mv = -mv; var n = (sel < 0 ? 0 : sel) + mv; if (n >= 0 && n < 81 && !(Math.abs(mv) === 1 && Math.floor(n / 9) !== Math.floor((sel < 0 ? 0 : sel) / 9))) { sel = n; paint(); } }
        });
        paint();
      }
    }

    /* ============================ FISH & DOVE ============================ */
    var FISH = '<svg viewBox="0 0 100 60" aria-hidden="true"><path d="M8 30 C30 2 64 2 84 30 C64 58 30 58 8 30 Z M84 30 L98 14 M84 30 L98 46" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><circle cx="66" cy="26" r="4" fill="currentColor"/></svg>';
    var DOVE = '<svg viewBox="0 0 100 80" aria-hidden="true"><path d="M10 52 C28 50 40 44 48 34 C52 20 62 12 74 12 C82 12 88 18 90 22 L98 24 L90 28 C88 44 74 58 54 60 L40 72 L42 60 C30 60 18 58 10 52 Z" fill="currentColor"/><path d="M46 36 C40 20 24 10 6 10 C14 22 26 32 44 40 Z" fill="currentColor" opacity=".75"/><circle cx="78" cy="20" r="3" fill="#2a1c10"/></svg>';
    var LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
    function winner(b) { for (var k = 0; k < 8; k++) { var L = LINES[k]; if (b[L[0]] && b[L[0]] === b[L[1]] && b[L[1]] === b[L[2]]) return { who: b[L[0]], line: L }; } return b.indexOf(0) < 0 ? { who: 'draw' } : null; }
    function minimax(b, me, turn, depth) {
      var w = winner(b); if (w) return w.who === 'draw' ? 0 : (w.who === me ? 10 - depth : depth - 10);
      var other = turn === 1 ? 2 : 1, best = turn === me ? -99 : 99;
      for (var i = 0; i < 9; i++) if (!b[i]) { b[i] = turn; var s = minimax(b, me, other, depth + 1); b[i] = 0; best = turn === me ? Math.max(best, s) : Math.min(best, s); }
      return best;
    }
    function aiMove(b, me, level) {
      var free = []; for (var i = 0; i < 9; i++) if (!b[i]) free.push(i);
      var you = me === 1 ? 2 : 1;
      function finds(p) { for (var k = 0; k < free.length; k++) { var x = free[k]; b[x] = p; var w = winner(b); b[x] = 0; if (w && w.who === p) return x; } return -1; }
      if (level === 'easy') { if (K.rand() < 0.5) { var w1 = finds(me); if (w1 >= 0) return w1; } if (K.rand() < 0.3) { var bl = finds(you); if (bl >= 0) return bl; } return K.pick(free); }
      if (level === 'medium' && K.rand() < 0.3) { var w2 = finds(me); if (w2 >= 0) return w2; var b2 = finds(you); if (b2 >= 0) return b2; return K.pick(free); }
      var best = -99, moves = [];
      free.forEach(function (x) { b[x] = me; var s = minimax(b, me, you, 1); b[x] = 0; if (s > best) { best = s; moves = [x]; } else if (s === best) moves.push(x); });
      return K.pick(moves);
    }
    function fishDove(box, level, alive) {
      var inner = frame(box, 'ttt', 'ttt', ['valley', 'fields', 'victory', 'prayer']);
      var two = !!K.store('ttt_two'), mine = K.store('ttt_piece') === 2 ? 2 : 1, score = { me: 0, draw: 0, them: 0 }, starter = 1, b, turn, over;
      var modes = el('div', { class: 'kgm-modes', role: 'group', 'aria-label': 'Players' });
      function modeBtn(v, txt, icon) { var x = el('button', { class: 'kgm-tool', type: 'button', 'aria-pressed': two === v ? 'true' : 'false' }, [el('span', { text: icon + ' ', 'aria-hidden': 'true' }), el('span', { text: txt })]); x.addEventListener('click', function () { two = v; K.store('ttt_two', v); score = { me: 0, draw: 0, them: 0 }; drawModes(); newRound(); }); return x; }
      function pieceBtn() { var x = el('button', { class: 'kgm-tool', type: 'button' }, [el('span', { class: 'kgm-mini', html: mine === 1 ? FISH : DOVE }), el('span', { text: mine === 1 ? 'I am the fish' : 'I am the dove' })]); x.addEventListener('click', function () { mine = mine === 1 ? 2 : 1; K.store('ttt_piece', mine); drawModes(); newRound(); }); return x; }
      /* 7.21.0: with a friend online, by a game code */
      var net = null, friendIn = true, netBox = el('div', { class: 'kgm-ttt-net' }), joinCode = K.net ? K.net.pending('ttt') : '';
      function drawModes() { modes.innerHTML = ''; if (net) { modes.hidden = true; return; } modes.hidden = false; modes.appendChild(modeBtn(false, 'Against the computer', '💻')); modes.appendChild(modeBtn(true, 'Two players', '👫')); if (!two) modes.appendChild(pieceBtn());
        if (K.net && K.net.ok()) { var nb = el('button', { class: 'kgm-tool', type: 'button' }, [el('span', { text: '🌐 ', 'aria-hidden': 'true' }), el('span', { text: T('With a friend online') })]); nb.addEventListener('click', showNet); modes.appendChild(nb); } }
      function showNet() {
        netBox.innerHTML = '';
        netBox.appendChild(K.net.chooser('ttt', function () { b = [0, 0, 0, 0, 0, 0, 0, 0, 0]; over = false; turn = 1; starter = 2; score = { me: 0, draw: 0, them: 0 }; var st = dump(); return K.net.create('ttt', st).then(function (x) { startNet(x, { seats: [1, 0], state: st }); }); },
          function (c) { return K.net.join('ttt', c).then(function (x) { startNet(x, x.data); }); }, joinCode));
        if (joinCode) { var jb = netBox.querySelector('.kg-net__join button'); joinCode = ''; if (jb) setTimeout(function () { jb.click(); }, 50); }
      }
      function dump() { return { b: b, turn: turn, starter: starter, over: over, score: score }; }
      function load(st) { if (!st || !st.b) return; b = st.b.slice(); turn = st.turn; starter = st.starter; over = !!st.over; score = st.score || score; }
      function send() { K.net.put(net.s, dump()).catch(function (e) { if (e && e.why === 'late' && e.data) { net.s.v = e.data.v; load(e.data.state); paint(); drawTally(); prompt(); } }); }
      function startNet(sess, d) {
        net = { s: sess }; two = true; mine = sess.seat === 0 ? 1 : 2; friendIn = !!(d.seats && d.seats[1]); load(d.state); drawModes(); netInfo();
        again.hidden = !over; paint(); drawTally(); prompt();
        K.net.watch(sess, function (dd, unchanged) {
          if (!alive() || !dd) return;
          var was = friendIn; friendIn = !!(dd.seats && dd.seats[1]); if (was !== friendIn) { netInfo(); prompt(); }
          if (unchanged) return;
          var wasMine = turn === mine; load(dd.state); var w = winner(b);
          again.hidden = !over; paint(w && w.line); drawTally();
          if (over && w) say(w.who === 'draw' ? ['🤝 ', 'A draw! Well played.'] : w.who === mine ? ['🎉 ', 'You win!'] : ['🙂 ', T('Your friend wins this time. Well played!')]);
          else { prompt(); if (!wasMine && turn === mine) K.net.nudge(); }
        });
      }
      function netInfo() { netBox.innerHTML = ''; if (!friendIn && net.s.seat === 0) netBox.appendChild(K.net.card('ttt', net.s.code, true)); else netBox.appendChild(el('p', { class: 'kg-net__small', text: T('Online game') + ' · ' + net.s.code.replace(/(...)(...)/, '$1 $2') + ' · ' + (mine === 1 ? T('You are the fish') : T('You are the dove')) })); }
      drawModes(); inner.appendChild(modes); inner.appendChild(netBox);
      var tally = el('div', { class: 'kgm-tally' }); inner.appendChild(tally);
      var status = el('p', { class: 'kgm-msg kgm-msg--big', 'aria-live': 'polite' }); inner.appendChild(status);
      var grid = el('div', { class: 'kgm-ttt', role: 'grid', 'aria-label': 'Fish and Dove board' }); inner.appendChild(grid);
      var cells = [];
      for (var i = 0; i < 9; i++) (function (i) { var c = el('button', { class: 'kgm-tcell', type: 'button', 'aria-label': 'Square ' + (i + 1) }); c.addEventListener('click', function () { tap(i); }); cells.push(c); grid.appendChild(c); })(i);
      var again = el('button', { class: 'kt-btn kt-btn--yellow kgm-again', type: 'button', hidden: 'hidden' }, [el('span', { text: 'Play again' })]);
      again.addEventListener('click', function () { newRound(); if (net) send(); }); inner.appendChild(again);
      function name(p) { return p === 1 ? 'Fish' : 'Dove'; }
      function drawTally() {
        tally.innerHTML = '';
        var L = two ? [['🐟', 'Fish', score.me], ['🤝', 'Draws', score.draw], ['🕊️', 'Dove', score.them]] : [['🙂', 'You', score.me], ['🤝', 'Draws', score.draw], ['💻', 'Computer', score.them]];
        L.forEach(function (x) { tally.appendChild(el('span', { class: 'kgm-score' }, [el('span', { text: x[0] + ' ', 'aria-hidden': 'true' }), el('span', { text: x[1] }), el('strong', { text: ' ' + x[2] })])); });
      }
      function say(parts) { status.textContent = ''; parts.forEach(function (p) { status.appendChild(typeof p === 'string' ? el('span', { text: p }) : p); }); }
      function paint(line) {
        for (var i = 0; i < 9; i++) { var c = cells[i]; c.innerHTML = b[i] ? (b[i] === 1 ? FISH : DOVE) : ''; c.className = 'kgm-tcell' + (b[i] ? ' p' + b[i] : '') + (line && line.indexOf(i) >= 0 ? ' win' : ''); c.disabled = !!b[i] || over; c.setAttribute('aria-label', 'Square ' + (i + 1) + (b[i] ? ': ' + name(b[i]) : '')); }
      }
      function prompt() {
        if (net) { say(!friendIn ? [T('Waiting for your friend to join…')] : turn === mine ? [el('span', { class: 'kgm-mini', html: mine === 1 ? FISH : DOVE }), T('Your turn')] : [T('Waiting for your friend’s move…')]); return; }
        if (two) say([el('span', { class: 'kgm-mini', html: turn === 1 ? FISH : DOVE }), turn === 1 ? 'Fish, your turn' : 'Dove, your turn']);
        else say(turn === mine ? ['Your turn'] : ['The computer is thinking…']);
      }
      function newRound() {
        b = [0, 0, 0, 0, 0, 0, 0, 0, 0]; over = false; turn = starter; starter = starter === 1 ? 2 : 1; again.hidden = true; paint(); drawTally(); prompt();
        if (!two && turn !== mine) setTimeout(computer, 600);
      }
      if (joinCode) { showNet(); }
      function tap(i) {
        if (net) { if (over || b[i] || turn !== mine || !friendIn) return; b[i] = turn; K.sound('tap'); after(); send(); return; }
        if (over || b[i] || (!two && turn !== mine)) return;
        b[i] = turn; K.sound('tap'); after();
        if (!over && !two) setTimeout(computer, 550);
      }
      function computer() { if (!alive() || over) return; var me = mine === 1 ? 2 : 1, x = aiMove(b.slice(), me, level); b[x] = me; K.sound('tap'); after(); }
      function after() {
        var w = winner(b);
        if (!w) { turn = turn === 1 ? 2 : 1; paint(); prompt(); return; }
        over = true; paint(w.line); again.hidden = false;
        if (w.who === 'draw') { score.draw++; say(['🤝 ', 'A draw! Well played.']); K.sound('good'); if (!two && level === 'hard') { if (K.award('ttt', 'hard')) say(['🥇 ', 'A draw against the hardest computer: you earned the gold trophy!']); } }
        else if (net) { if (w.who === 1) score.me++; else score.them++; say(w.who === mine ? ['🎉 ', 'You win!'] : ['🙂 ', T('Your friend wins this time. Well played!')]); K.sound(w.who === mine ? 'success' : 'good'); }
        else if (two) { if (w.who === 1) score.me++; else score.them++; say([el('span', { class: 'kgm-mini', html: w.who === 1 ? FISH : DOVE }), w.who === 1 ? 'The fish wins!' : 'The dove wins!']); K.sound('success'); }
        else if (w.who === mine) { score.me++; say(['🎉 ', 'You win!']); K.sound('success'); if (K.award('ttt', level)) say(['🏆 ', 'You win! You earned a new trophy!']); }
        else { score.them++; say(['💻 ', 'The computer wins this time. Try again!']); K.sound('miss'); }
        drawTally();
      }
      newRound();
    }

    /* ============================ WORD BUILDER ============================ */
    var N = 13, MID = 6, RACK = 7, FULL_BONUS = 35;
    var REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    var VALUE = { a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 5, l: 1, m: 3, n: 1, o: 1, p: 3, q: 10, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 10 };
    var COUNT = { a: 7, b: 2, c: 2, d: 3, e: 10, f: 2, g: 2, h: 2, i: 7, j: 1, k: 1, l: 3, m: 2, n: 5, o: 6, p: 2, q: 1, r: 5, s: 4, t: 5, u: 3, v: 1, w: 2, x: 1, y: 2, z: 1, '?': 2 };
    var BONUS = (function () {
      var m = []; for (var r = 0; r < N; r++) { m.push([]); for (var c = 0; c < N; c++) m[r].push(''); }
      function sym(r, c, t) { [[r, c], [c, r], [N - 1 - r, c], [c, N - 1 - r], [r, N - 1 - c], [N - 1 - c, r], [N - 1 - r, N - 1 - c], [N - 1 - c, N - 1 - r]].forEach(function (p) { if (!m[p[0]][p[1]]) m[p[0]][p[1]] = t; }); }
      sym(0, 0, 'W3'); sym(0, 6, 'W3');
      sym(1, 1, 'W2'); sym(2, 2, 'W2'); sym(3, 3, 'W2');
      sym(1, 5, 'L3'); sym(5, 5, 'L3');
      sym(0, 3, 'L2'); sym(2, 6, 'L2'); sym(4, 6, 'L2'); sym(3, 0, 'L2');
      m[MID][MID] = 'ST';
      return m;
    })();
    var DICT = null, DICT_LOADING = null;
    function loadDict() {
      if (DICT) return Promise.resolve(DICT);
      if (DICT_LOADING) return DICT_LOADING;
      DICT_LOADING = fetch(BASE + 'wordbuilder-words.txt?ver=3', { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('dict'); return r.text(); }).then(function (txt) {
        var lines = txt.split('\n'), prev = '', words = [], total = 0;
        for (var i = 0; i < lines.length; i++) { var L = lines[i]; if (!L) continue; var k = L.charCodeAt(0) - 48, w = prev.slice(0, k) + L.slice(1); words.push(w); total += w.length; prev = w; }
        var cap = total + 2, ch = new Uint8Array(cap), child = new Int32Array(cap).fill(-1), sib = new Int32Array(cap).fill(-1), term = new Uint8Array(cap), n = 1;
        for (i = 0; i < words.length; i++) {
          var w = words[i], node = 0;
          for (var j = 0; j < w.length; j++) {
            var c = w.charCodeAt(j) - 97, x = child[node], last = -1;
            while (x >= 0 && ch[x] !== c) { last = x; x = sib[x]; }
            if (x < 0) { x = n++; ch[x] = c; if (last < 0) child[node] = x; else sib[last] = x; }
            node = x;
          }
          term[node] = 1;
        }
        DICT = { ch: ch, child: child, sib: sib, term: term, size: words.length };
        return DICT;
      });
      return DICT_LOADING;
    }
    function step(node, c) { var x = DICT.child[node]; while (x >= 0) { if (DICT.ch[x] === c) return x; x = DICT.sib[x]; } return -1; }
    function isWord(w) { var node = 0; for (var i = 0; i < w.length; i++) { node = step(node, w.charCodeAt(i) - 97); if (node < 0) return false; } return !!DICT.term[node]; }
    function tileVal(t) { return t.blank ? 0 : VALUE[t.ch]; }
    /* 7.9.29: what a word means (from WordNet; one small file per first letter, loaded when asked) */
    var MEAN = {};
    function meaningFile(l) {
      if (!MEAN[l]) MEAN[l] = fetch(BASE + 'wordbuilder-meanings/' + l + '.json?ver=2', { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('m'); return r.json(); }).catch(function () { delete MEAN[l]; return {}; });
      return MEAN[l];
    }
    function meaning(w) {
      return meaningFile(w.charAt(0)).then(function (d) {
        var m = d[w]; if (!m) return { w: w, m: '' };
        if (m.charAt(0) !== '@') return { w: w, m: m };
        var b = m.slice(1);
        return meaningFile(b.charAt(0)).then(function (d2) { return { w: w, base: b, m: d2[b] || '' }; });
      });
    }

    /* Every move a rack can make (Appel & Jacobson's method), for the computer and for hints. */
    function allMoves(board, rack) {
      var moves = [], empty = true;
      for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (board[r][c]) empty = false;
      [0, 1].forEach(function (vertical) {
        var B = []; for (var r = 0; r < N; r++) { B.push([]); for (var c = 0; c < N; c++) B[r].push(vertical ? board[c][r] : board[r][c]); }
        function at(r, c) { return (r < 0 || c < 0 || r >= N || c >= N) ? null : B[r][c]; }
        var cross = [], crossSum = [], hasCross = [];
        for (r = 0; r < N; r++) { cross.push([]); crossSum.push([]); hasCross.push([]); for (c = 0; c < N; c++) {
          if (B[r][c]) { cross[r].push(0); crossSum[r].push(0); hasCross[r].push(false); continue; }
          var up = '', down = '', s = 0, k = r - 1;
          while (k >= 0 && B[k][c]) { up = B[k][c].ch + up; s += tileVal(B[k][c]); k--; }
          k = r + 1; while (k < N && B[k][c]) { down += B[k][c].ch; s += tileVal(B[k][c]); k++; }
          if (!up && !down) { cross[r].push(0x3FFFFFF); crossSum[r].push(0); hasCross[r].push(false); continue; }
          var mask = 0; for (var x = 0; x < 26; x++) if (isWord(up + String.fromCharCode(97 + x) + down)) mask |= (1 << x);
          cross[r].push(mask); crossSum[r].push(s); hasCross[r].push(true);
        } }
        function anchor(r, c) { if (B[r][c]) return false; if (empty) return !vertical && r === MID && c === MID; return !!(at(r - 1, c) || at(r + 1, c) || at(r, c - 1) || at(r, c + 1)); }
        var have = {}; rack.forEach(function (t) { have[t] = (have[t] || 0) + 1; });
        for (r = 0; r < N; r++) {
          var placed = [];
          var record = function (endCol) {
            /* word from start to endCol-1 in row r */
            var start = endCol - 1; while (start > 0 && B[r][start - 1] || (start > 0 && placed.some(function (p) { return p.c === start - 1; }))) start--;
            var word = '', main = 0, mult = 1, side = 0;
            for (var c = start; c < endCol; c++) {
              var p = null; for (var q = 0; q < placed.length; q++) if (placed[q].c === c) { p = placed[q]; break; }
              if (p) {
                var lv = p.blank ? 0 : VALUE[p.ch], bo = BONUS[vertical ? c : r][vertical ? r : c], lm = bo === 'L2' ? 2 : bo === 'L3' ? 3 : 1, wm = bo === 'W2' || bo === 'ST' ? 2 : bo === 'W3' ? 3 : 1;
                main += lv * lm; mult *= wm; word += p.ch;
                if (hasCross[r][c]) side += (crossSum[r][c] + lv * lm) * wm;
              } else { main += tileVal(B[r][c]); word += B[r][c].ch; }
            }
            var score = main * mult + side + (placed.length === RACK ? FULL_BONUS : 0);
            moves.push({ word: word, score: score, tiles: placed.map(function (p) { return { r: vertical ? p.c : r, c: vertical ? r : p.c, ch: p.ch, blank: p.blank }; }), vertical: !!vertical });
          };
          var extend = function (node, c, anchorCol) {
            if (c >= N) { if (DICT.term[node] && placed.length && c > anchorCol) record(c); return; }
            var t = B[r][c];
            if (t) { var nx = step(node, t.ch.charCodeAt(0) - 97); if (nx >= 0) extend(nx, c + 1, anchorCol); return; }
            if (DICT.term[node] && placed.length && c > anchorCol) record(c);
            var x = DICT.child[node];
            while (x >= 0) {
              var L = DICT.ch[x], letter = String.fromCharCode(97 + L);
              if (cross[r][c] & (1 << L)) {
                if (have[letter]) { have[letter]--; placed.push({ c: c, ch: letter, blank: false }); extend(x, c + 1, anchorCol); placed.pop(); have[letter]++; }
                if (have['?']) { have['?']--; placed.push({ c: c, ch: letter, blank: true }); extend(x, c + 1, anchorCol); placed.pop(); have['?']++; }
              }
              x = DICT.sib[x];
            }
          };
          var prefix = [];
          var leftWith = function (node, limit, anchorCol) {
            var n = prefix.length;
            for (var k = 0; k < n; k++) placed.push({ c: anchorCol - n + k, ch: prefix[k].ch, blank: prefix[k].blank });
            extend(node, anchorCol, anchorCol);
            placed.splice(placed.length - n, n);
            if (limit <= 0) return;
            var x = DICT.child[node];
            while (x >= 0) {
              var L = DICT.ch[x], letter = String.fromCharCode(97 + L);
              if (have[letter]) { have[letter]--; prefix.push({ ch: letter, blank: false }); leftWith(x, limit - 1, anchorCol); prefix.pop(); have[letter]++; }
              if (have['?']) { have['?']--; prefix.push({ ch: letter, blank: true }); leftWith(x, limit - 1, anchorCol); prefix.pop(); have['?']++; }
              x = DICT.sib[x];
            }
          };
          for (var c0 = 0; c0 < N; c0++) {
            if (!anchor(r, c0)) continue;
            if (c0 > 0 && B[r][c0 - 1]) {
              var s0 = c0 - 1; while (s0 > 0 && B[r][s0 - 1]) s0--;
              var node = 0; for (var k = s0; k < c0 && node >= 0; k++) node = step(node, B[r][k].ch.charCodeAt(0) - 97);
              if (node >= 0) extend(node, c0, c0);
            } else {
              var limit = 0, k2 = c0 - 1; while (k2 >= 0 && !B[r][k2] && !anchor(r, k2)) { limit++; k2--; }
              leftWith(0, limit, c0);
            }
          }
        }
      });
      /* the same word in the same place can be found from two anchors: keep one */
      var seen = {}, out = [];
      moves.forEach(function (m) { var key = m.tiles.map(function (t) { return t.r + ',' + t.c + t.ch + (t.blank ? '*' : ''); }).sort().join('|'); if (!seen[key]) { seen[key] = 1; out.push(m); } });
      return out;
    }
    /* Checks a move the player made with the tiles on the board. */
    function judge(board, pend, first) {
      if (!pend.length) return { ok: false, why: 'Put some letters on the board first.' };
      var rows = {}, cols = {}; pend.forEach(function (p) { rows[p.r] = 1; cols[p.c] = 1; });
      var horiz = Object.keys(rows).length === 1, vert = Object.keys(cols).length === 1;
      if (!horiz && !vert) return { ok: false, why: 'The letters must be in one line, across or down.' };
      var B = board.map(function (row) { return row.slice(); }); pend.forEach(function (p) { B[p.r][p.c] = { ch: p.ch, blank: p.blank, mine: true }; });
      if (pend.length === 1) { var p0 = pend[0]; horiz = (p0.c > 0 && B[p0.r][p0.c - 1]) || (p0.c < N - 1 && B[p0.r][p0.c + 1]); if (!horiz) vert = true; }
      var dr = horiz ? 0 : 1, dc = horiz ? 1 : 0, ps = pend.slice().sort(function (a, b) { return horiz ? a.c - b.c : a.r - b.r; });
      for (var r = ps[0].r, c = ps[0].c; r <= ps[ps.length - 1].r && c <= ps[ps.length - 1].c; r += dr, c += dc) if (!B[r][c]) return { ok: false, why: 'There is a gap between your letters.' };
      if (first) { if (!pend.some(function (p) { return p.r === MID && p.c === MID; })) return { ok: false, why: 'The first word must cover the cross in the middle.' }; if (pend.length < 2) return { ok: false, why: 'The first word needs at least two letters.' }; }
      else { var touches = pend.some(function (p) { return [[-1, 0], [1, 0], [0, -1], [0, 1]].some(function (d) { var rr = p.r + d[0], cc = p.c + d[1]; return rr >= 0 && cc >= 0 && rr < N && cc < N && board[rr][cc]; }); }); if (!touches) return { ok: false, why: 'Your word must join the words already on the board.' }; }
      function wordAt(r, c, dr, dc) {
        while (r - dr >= 0 && c - dc >= 0 && B[r - dr][c - dc]) { r -= dr; c -= dc; }
        var w = '', sum = 0, mult = 1, cells = [];
        while (r < N && c < N && B[r][c]) { var t = B[r][c], lv = t.blank ? 0 : VALUE[t.ch], lm = 1, wm = 1; if (t.mine) { var bo = BONUS[r][c]; lm = bo === 'L2' ? 2 : bo === 'L3' ? 3 : 1; wm = bo === 'W2' || bo === 'ST' ? 2 : bo === 'W3' ? 3 : 1; } w += t.ch; sum += lv * lm; mult *= wm; cells.push([r, c]); r += dr; c += dc; }
        return { w: w, score: sum * mult, cells: cells };
      }
      var words = [], main = wordAt(ps[0].r, ps[0].c, dr, dc);
      if (main.w.length > 1) words.push(main);
      ps.forEach(function (p) { var x = wordAt(p.r, p.c, dc, dr); if (x.w.length > 1) words.push(x); });
      if (!words.length) return { ok: false, why: 'A word needs at least two letters.' };
      var bad = words.filter(function (x) { return !isWord(x.w); });
      var score = words.reduce(function (s, x) { return s + x.score; }, 0) + (pend.length === RACK ? FULL_BONUS : 0);
      if (bad.length) return { ok: false, bad: bad, words: words, score: score, why: 'not a word' };
      return { ok: true, words: words, score: score };
    }
    function wordBuilder(box, level, alive) {
      var inner = frame(box, 'words', 'words', ['church', 'prayer', 'fields', 'valley']);
      var wait = el('p', { class: 'kgm-wait', role: 'status' }, [el('span', { class: 'kgm-spin', 'aria-hidden': 'true' }), el('span', { text: 'Opening the dictionary…' })]);
      inner.appendChild(wait);
      loadDict().then(function () { if (!alive()) return; wait.remove(); choose(); }).catch(function () { wait.textContent = 'The dictionary could not be loaded. Press New game to try again.'; DICT_LOADING = null; });
      /* 7.20.0: against the computer, two players on one phone, or a friend online with a game code */
      /* 7.24.0: 2 to 4 players (n), on one phone or online */
      function fresh(n) {
        n = Math.max(2, Math.min(4, n || 2));
        var bag0 = []; Object.keys(COUNT).forEach(function (k) { for (var i = 0; i < COUNT[k]; i++) bag0.push(k); }); bag0 = K.shuffle(bag0);
        var rk = [], sc = [], sw = [], hn = [], h = level === 'hard' ? 1 : 3;
        for (var p = 0; p < n; p++) { rk.push([]); while (rk[p].length < RACK && bag0.length) rk[p].push(bag0.pop()); sc.push(0); sw.push(3); hn.push(h); }
        return { np: n, b: [], bag: bag0, racks: rk, scores: sc, passes: 0, turn: 0, swaps: sw, hints: hn, log: [], over: 0 };
      }
      function choose() {
        var join = K.net ? K.net.pending('words') : '';
        var ch = el('div', { class: 'kgm-wb-mode' }); inner.appendChild(ch);
        function go(m, sess, st, d) { ch.remove(); play(m, sess, st, d); }
        function draw0() {
          ch.innerHTML = '';
          ch.appendChild(el('p', { class: 'kgm-wb-mode__t', text: T('Who is playing?') }));
          var row = el('div', { class: 'kgm-wb-mode__b' }, [
            el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '💻 ' + T('Against the computer'), onclick: function () { go('cpu', null, fresh(2)); } })
          ]);
          ch.appendChild(row);
          /* how many players: on one phone (passed round), and online */
          var many = 2, nb = el('div', { class: 'kgm-wb-n', role: 'group', 'aria-label': T('How many players?') });
          function drawN() { nb.innerHTML = ''; nb.appendChild(el('span', { class: 'kgm-wb-n__t', text: '👥 ' + T('How many players?') })); [2, 3, 4].forEach(function (k) { nb.appendChild(el('button', { class: 'kgm-wb-n__b', type: 'button', 'aria-pressed': k === many ? 'true' : 'false', text: String(k), onclick: function () { many = k; drawN(); } })); }); }
          drawN(); ch.appendChild(nb);
          ch.appendChild(el('div', { class: 'kgm-wb-mode__b' }, [el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '📱 ' + T('Play on one phone'), onclick: function () { go('pass', null, fresh(many)); } })]));
          if (!K.net || !K.net.ok()) return;
          var ns = K.net.saved('words');
          if (ns) ch.appendChild(el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '↻ ' + T('Continue the online game') + ' ' + ns.code, onclick: function () { K.net.get(ns).then(function (d) { ns.v = d.v; go('net', ns, d.state, d); }).catch(function (e) { if (e && e.why === 'gone') K.net.forget('words'); draw0(); ch.appendChild(el('p', { class: 'kg-net__msg', text: K.net.why(e) })); }); } })]));
          ch.appendChild(K.net.chooser('words', function () { var st = fresh(many), seats = [1]; for (var q = 1; q < st.np; q++) seats.push(0); return K.net.create('words', st, st.np).then(function (s) { go('net', s, st, { seats: seats }); }); },
            function (c) { return K.net.join('words', c).then(function (s) { go('net', s, s.data.state, s.data); }); }, join));
          if (join) { var jb = ch.querySelector('.kg-net__join button'); join = ''; if (jb) setTimeout(function () { jb.click(); }, 50); }
        }
        draw0();
      }
      function play(mode, sess, st0, net0) {
        var NP = Math.max(2, Math.min(4, (st0 && (st0.np || (st0.racks && st0.racks.length))) || 2)), PL = []; for (var q0 = 0; q0 < NP; q0++) PL.push(q0);
        var board = [], bag = [], racks = PL.map(function () { return []; }), scores = PL.map(function () { return 0; }), passes = 0, turn = 0, over = false, pend = [], selRack = -1, swapMode = false, swapSel = {}, hintsA = PL.map(function () { return 3; }), L = [];
        var swapsLeft = PL.map(function () { return 3; }); /* 7.9.29: a few letter swaps per game, for each player */
        /* 7.24.0: online, the game begins when every player has joined */
        function allIn(d) { return !!(d && d.seats && PL.every(function (p) { return d.seats[p]; })); }
        function joined(d) { return d && d.seats ? PL.filter(function (p) { return d.seats[p]; }).length : 1; }
        var me = mode === 'net' ? sess.seat : 0, covered = false, friendIn = mode !== 'net' || allIn(net0), inCount = mode === 'net' ? joined(net0) : NP;
        for (var r = 0; r < N; r++) { board.push([]); for (var c = 0; c < N; c++) board[r].push(null); }
        function draw(p) { while (racks[p].length < RACK && bag.length) racks[p].push(bag.pop()); }
        function name(p) { return mode === 'cpu' ? (p === 0 ? 'You' : 'Computer') : mode === 'pass' ? T('Player ' + (p + 1)) : (p === me ? T('You') : NP === 2 ? T('Your friend') : T('Player ' + (p + 1))); }
        function cls(p) { return ['me', 'cpu', 'p2', 'p3'][p] || 'me'; }
        function nextP(p) { return (p + 1) % NP; }
        function canAct() { return !over && turn === me && !covered && friendIn; }
        var top = el('div', { class: 'kgm-wb-top' });
        var sc = PL.map(function () { return el('strong', { text: '0' }); }), bagN = el('strong', { text: String(bag.length) });
        var NUM = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'], ICON = mode === 'cpu' ? ['🙂', '💻'] : mode === 'pass' ? NUM : PL.map(function (p) { return p === me ? '🙂' : NP === 2 ? '🌍' : NUM[p]; });
        var scl = PL.map(function (p) { return el('span', { class: 'kgm-score kgm-score--' + cls(p) + (p === me ? ' kgm-score--you' : '') }, [el('span', { class: 'kgm-wb-sw kgm-wb-sw--' + cls(p), 'aria-hidden': 'true' }), el('span', { text: ICON[p] + ' ' + name(p) + ' ' }), sc[p]]); });
        scl.forEach(function (x) { top.appendChild(x); });
        top.appendChild(el('span', { class: 'kgm-score kgm-score--bag' }, [el('span', { text: '👜 Tiles in the bag: ' }), bagN]));
        inner.appendChild(top);
        /* 7.9.29: your letters and the computer's letters have different colours */
        if (NP === 2) inner.appendChild(el('p', { class: 'kgm-wb-key' }, [el('span', { class: 'kgm-wb-key__i' }, [el('span', { class: 'kgm-wb-sw kgm-wb-sw--me', 'aria-hidden': 'true' }), el('span', { text: mode === 'cpu' ? 'Your words' : mode === 'pass' ? T('Player 1’s words') : me === 0 ? T('Your words') : T('Your friend’s words') })]), el('span', { class: 'kgm-wb-key__i' }, [el('span', { class: 'kgm-wb-sw kgm-wb-sw--cpu', 'aria-hidden': 'true' }), el('span', { text: mode === 'cpu' ? 'The computer’s words' : mode === 'pass' ? T('Player 2’s words') : me === 1 ? T('Your words') : T('Your friend’s words') })])]));
        else inner.appendChild(el('p', { class: 'kgm-wb-key', text: T('Each player’s words are in their own colour.') }));
        var netBox = el('div', { class: 'kgm-wb-net' }); if (mode === 'net') inner.appendChild(netBox);
        var msg = el('p', { class: 'kgm-msg', 'aria-live': 'polite' }); inner.appendChild(msg);
        var defBox = el('div', { class: 'kgm-def', 'aria-live': 'polite', hidden: true }); inner.appendChild(defBox);
        var grid = el('div', { class: 'kgm-wb', role: 'grid', 'aria-label': 'Word Builder board' }); inner.appendChild(grid);
        var cells = [];
        for (r = 0; r < N; r++) for (c = 0; c < N; c++) (function (r, c) {
          var bo = BONUS[r][c], b = el('button', { class: 'kgm-sq' + (bo ? ' b-' + bo : ''), type: 'button' });
          b.addEventListener('click', function () { tapSquare(r, c); });
          cells.push(b); grid.appendChild(b);
        })(r, c);
        var rackEl = el('div', { class: 'kgm-rack', role: 'group', 'aria-label': 'Your letters' }); inner.appendChild(rackEl);
        var playBtn = el('button', { class: 'kt-btn kt-btn--yellow', type: 'button' }, [el('span', { text: 'Play word' })]);
        playBtn.addEventListener('click', function () { submit(); });
        var swapBtn, acts = el('div', { class: 'kgm-tools' }, [
          playBtn,
          el('button', { class: 'kgm-tool', type: 'button', onclick: function () { recall(); paint(); } }, [el('span', { text: '↩️ Take back' })]),
          el('button', { class: 'kgm-tool', type: 'button', onclick: function () { recall(); racks[me] = K.shuffle(racks[me]); paint(); } }, [el('span', { text: '🔀 Shuffle' })]),
          swapBtn = el('button', { class: 'kgm-tool', type: 'button', onclick: function () { toggleSwap(); } }, [el('span', { text: '🔄 Swap letters' })]),
          el('button', { class: 'kgm-tool', type: 'button', onclick: function () { if (!canAct()) return; recall(); pass(mode === 'cpu' ? 'You passed.' : name(me) + ' ' + T('passed.')); } }, [el('span', { text: '⏭️ Pass' })]),
          el('button', { class: 'kgm-tool', type: 'button', onclick: function () { hint(); } }, [el('span', { text: '💡 Hint' })])
        ]);
        inner.appendChild(acts);
        var logEl = el('ol', { class: 'kgm-log', 'aria-label': 'Words played' }); inner.appendChild(el('details', { class: 'kgm-logbox' }, [el('summary', { text: 'Words played' }), logEl]));
        inner.appendChild(el('p', { class: 'kgm-small', text: 'Tap a letter, then tap a square. Words go across or down and must join the words on the board. Using all 7 letters in one go earns 35 extra points. Squares: 2L and 3L double or triple a letter, 2W and 3W double or triple the whole word. You can swap letters 3 times in a game. Tap any word on the board, or in Words played, to see what it means.' }));
        function say(t, cls) { msg.className = 'kgm-msg ' + (cls || ''); msg.textContent = t; }
        function isFirst() { for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (board[r][c]) return false; return true; }
        function pendAt(r, c) { for (var i = 0; i < pend.length; i++) if (pend[i].r === r && pend[i].c === c) return i; return -1; }
        function tileEl(ch, blank, small) { return el('span', { class: 'kgm-tile' + (blank ? ' blank' : '') + (small ? ' small' : '') }, [el('span', { class: 'kgm-tile__l', text: ch === '?' ? '' : ch.toUpperCase() }), el('span', { class: 'kgm-tile__v', text: ch === '?' || blank ? '' : String(VALUE[ch]) })]); }
        function paint(hl) {
          for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) {
            var b = cells[r * N + c], t = board[r][c], pi = pendAt(r, c), bo = BONUS[r][c];
            b.innerHTML = ''; b.classList.toggle('pend', pi >= 0); b.classList.toggle('hl', !!(hl && hl.some(function (x) { return x[0] === r && x[1] === c; })));
            b.classList.toggle('last', !!(t && t.last));
            if (t) {
              var te = tileEl(t.ch, t.blank); te.classList.add(cls(t.who));
              /* 7.9.29: the computer's new letters catch fire one after the other, so you see at once what it played */
              if (t.burnAt && Date.now() < t.burnAt + 1100 && !REDUCED) { te.classList.add('burn'); te.style.animationDelay = (t.burnAt - Date.now()) + 'ms'; }
              b.appendChild(te);
            }
            else if (pi >= 0) b.appendChild(tileEl(pend[pi].ch, pend[pi].blank));
            else if (bo) b.appendChild(el('span', { class: 'kgm-bo', text: bo === 'ST' ? '✝' : bo.charAt(1) + bo.charAt(0) }));
            b.setAttribute('aria-label', 'Row ' + (r + 1) + ', column ' + (c + 1) + (t ? ': ' + t.ch.toUpperCase() : pi >= 0 ? ': ' + pend[pi].ch.toUpperCase() : bo === 'ST' ? ': start' : bo ? ': ' + bo : ''));
          }
          rackEl.innerHTML = ''; rackEl.hidden = covered;
          racks[me].forEach(function (ch, i) {
            var used = pend.some(function (p) { return p.ri === i; });
            var b = el('button', { class: 'kgm-rk' + (i === selRack ? ' sel' : '') + (used ? ' used' : '') + (swapMode && swapSel[i] ? ' swap' : ''), type: 'button', 'aria-label': ch === '?' ? 'Star tile (any letter)' : ch.toUpperCase() });
            b.appendChild(tileEl(ch, ch === '?'));
            b.disabled = used || over;
            b.addEventListener('click', function (e) { if (b.__dragged) { b.__dragged = false; e.preventDefault(); return; } if (swapMode) { swapSel[i] = !swapSel[i]; paint(); return; } selRack = selRack === i ? -1 : i; paint(); });
            /* 7.9.27: move your letters around to help you think: drag a letter along the rack (or select it and use the ← → keys) */
            if (!used && !over) rackDrag(b, i);
            b.addEventListener('keydown', function (e) { if (swapMode || pend.length || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return; var rtl = getComputedStyle(rackEl).direction === 'rtl', d = (e.key === 'ArrowRight') !== rtl ? 1 : -1, j = i + d; if (j < 0 || j >= racks[me].length) return; e.preventDefault(); moveRack(i, j); selRack = j; paint(); var nb = rackEl.querySelectorAll('.kgm-rk')[j]; if (nb) nb.focus(); });
            rackEl.appendChild(b);
          });
          if (swapMode) { var ok = el('button', { class: 'kt-btn kt-btn--yellow', type: 'button' }, [el('span', { text: 'Swap the chosen letters' })]); ok.addEventListener('click', doSwap); rackEl.appendChild(ok); }
          PL.forEach(function (p) { sc[p].textContent = String(scores[p]); scl[p].classList.toggle('turn', !over && p === turn && mode !== 'cpu'); }); bagN.textContent = String(bag.length);
          swapBtn.lastChild.textContent = '🔄 Swap letters (' + swapsLeft[me] + ' left)'; swapBtn.disabled = over || !swapsLeft[me];
          var j = pend.length ? judge(board, pend, isFirst()) : null;
          playBtn.disabled = !canAct() || !j || !j.ok;
          playBtn.lastChild.textContent = j && j.ok ? 'Play word (+' + j.score + ')' : 'Play word';
          if (pend.length && j && !j.ok && j.bad) say(j.bad.map(function (x) { return x.w.toUpperCase(); }).join(', ') + ': not in the dictionary yet.', 'try');
          else if (pend.length && j && !j.ok) say(j.why, 'try');
          else if (pend.length && j && j.ok) say(j.words.map(function (x) { return x.w.toUpperCase(); }).join(' + ') + ' = ' + j.score + ' points', 'good');
        }
        function chooseLetter(cb) {
          var dlg = el('div', { class: 'kgm-pick', role: 'dialog', 'aria-label': 'Choose a letter for the star tile' });
          dlg.appendChild(el('p', { text: 'Which letter should the star tile be?' }));
          var g = el('div', { class: 'kgm-pick__g' });
          'abcdefghijklmnopqrstuvwxyz'.split('').forEach(function (ch) { g.appendChild(el('button', { type: 'button', class: 'kgm-tool', text: ch.toUpperCase(), onclick: function () { dlg.remove(); cb(ch); } })); });
          dlg.appendChild(g); dlg.appendChild(el('button', { type: 'button', class: 'kgm-tool', text: 'Cancel', onclick: function () { dlg.remove(); } }));
          inner.appendChild(dlg); dlg.querySelector('button').focus();
        }
        function tapSquare(r, c) {
          if (board[r][c] && pendAt(r, c) < 0) { showWordsAt(r, c); return; }
          if (!canAct() || swapMode) return;
          var pi = pendAt(r, c);
          if (pi >= 0) { pend.splice(pi, 1); K.sound('back'); paint(); return; }
          if (board[r][c]) return;
          if (selRack < 0) { var free = -1; for (var i = 0; i < racks[me].length; i++) if (!pend.some(function (p) { return p.ri === i; })) { free = i; break; } if (free < 0) return; say('Tap one of your letters first, then tap a square.'); return; }
          var ri = selRack, ch = racks[me][ri];
          function put(letter, blank) { pend.push({ r: r, c: c, ch: letter, blank: blank, ri: ri }); selRack = -1; for (var i = 0; i < racks[me].length; i++) if (!pend.some(function (p) { return p.ri === i; })) { selRack = i; break; } K.sound('tap'); paint(); }
          if (ch === '?') chooseLetter(function (l) { put(l, true); }); else put(ch, false);
        }
        function recall() { pend = []; selRack = -1; }
        /* 7.9.29: the meanings of the words through a square of the board */
        function wordsAt(r, c) {
          var out = [];
          [[0, 1], [1, 0]].forEach(function (d) {
            var r0 = r, c0 = c; while (r0 - d[0] >= 0 && c0 - d[1] >= 0 && board[r0 - d[0]][c0 - d[1]]) { r0 -= d[0]; c0 -= d[1]; }
            var w = '', cl = []; while (r0 < N && c0 < N && board[r0][c0]) { w += board[r0][c0].ch; cl.push([r0, c0]); r0 += d[0]; c0 += d[1]; }
            if (w.length > 1) out.push({ w: w, cells: cl });
          });
          return out;
        }
        function showWordsAt(r, c) { var ws = wordsAt(r, c); if (!ws.length) return; showMeanings(ws.map(function (x) { return x.w; })); var hl = []; ws.forEach(function (x) { hl = hl.concat(x.cells); }); paint(hl); setTimeout(function () { if (alive()) paint(); }, 1600); }
        function showMeanings(list) {
          defBox.hidden = false; defBox.innerHTML = '';
          defBox.appendChild(el('p', { class: 'kgm-def__wait', text: 'Looking it up…' }));
          Promise.all(list.map(meaning)).then(function (res) {
            if (!alive()) return; defBox.innerHTML = '';
            res.forEach(function (x) {
              var head = [el('strong', { class: 'kgm-def__w', text: x.w.toUpperCase() })];
              if (x.base) head.push(el('span', { class: 'kgm-def__f', text: ' (a form of ' + x.base.toUpperCase() + ')' }));
              defBox.appendChild(el('p', { class: 'kgm-def__row' }, [el('span', { 'aria-hidden': 'true', text: '📖 ' })].concat(head, [el('span', { text: ': ' }), el('span', { text: x.m || 'We do not have the meaning of this word yet.' })])));
            });
            defBox.appendChild(el('button', { class: 'kgm-tool kgm-def__x', type: 'button', text: 'Close', onclick: function () { defBox.hidden = true; } }));
          });
        }
        function moveRack(from, to) { if (from === to) return; var ch = racks[me].splice(from, 1)[0]; racks[me].splice(to, 0, ch); }
        function rackDrag(b, i) {
          var x0 = 0, y0 = 0, on = false, moved = false, pid = null;
          b.style.touchAction = 'pan-y';
          b.addEventListener('pointerdown', function (e) { if (swapMode || (e.button && e.button !== 0)) return; on = true; moved = false; x0 = e.clientX; y0 = e.clientY; pid = e.pointerId; });
          b.addEventListener('pointermove', function (e) {
            if (!on || e.pointerId !== pid) return;
            var dx = e.clientX - x0, dy = e.clientY - y0;
            if (!moved) { if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return; moved = true; if (pend.length) { recall(); } try { b.setPointerCapture(pid); } catch (x) {} b.classList.add('drag'); }
            b.style.transform = 'translate(' + dx + 'px,' + Math.max(-12, Math.min(12, dy)) + 'px) scale(1.08)';
            e.preventDefault();
          });
          function end(e) {
            if (!on) return; on = false;
            if (!moved) return;
            b.__dragged = true; b.classList.remove('drag'); b.style.transform = '';
            var tiles = [].slice.call(rackEl.querySelectorAll('.kgm-rk')), x = e.clientX, to = i;
            tiles.forEach(function (t, k) { var r = t.getBoundingClientRect(); if (x >= r.left && x <= r.right) to = k; });
            if (x < tiles[0].getBoundingClientRect().left) to = getComputedStyle(rackEl).direction === 'rtl' ? tiles.length - 1 : 0;
            if (x > tiles[tiles.length - 1].getBoundingClientRect().right) to = getComputedStyle(rackEl).direction === 'rtl' ? 0 : tiles.length - 1;
            moveRack(i, Math.min(to, racks[me].length - 1)); selRack = -1; K.sound('tap'); paint();
          }
          b.addEventListener('pointerup', end); b.addEventListener('pointercancel', function () { on = false; b.classList.remove('drag'); b.style.transform = ''; });
        }
        function toggleSwap() {
          if (!canAct()) return;
          if (!swapsLeft[me] && !swapMode) { say('You have used all your swaps in this game.', 'try'); return; }
          if (bag.length < RACK) { say('There are not enough tiles left in the bag to swap.', 'try'); return; }
          recall(); swapMode = !swapMode; swapSel = {}; say(swapMode ? 'Tap the letters you want to swap, then press "Swap the chosen letters". Swapping uses your turn.' : ''); paint();
        }
        function doSwap() {
          var idx = Object.keys(swapSel).filter(function (k) { return swapSel[k]; }).map(Number);
          swapMode = false; if (!idx.length) { paint(); return; }
          var out = idx.map(function (i) { return racks[me][i]; });
          racks[me] = racks[me].filter(function (x, i) { return idx.indexOf(i) < 0; }); draw(me); bag = K.shuffle(bag.concat(out));
          swapsLeft[me]--; addLog(me, 'swapped ' + out.length + ' letters', 0); passes = 0; say((mode === 'cpu' ? 'You' : name(me)) + ' swapped ' + out.length + ' letters. Swaps left: ' + swapsLeft[me] + '.'); endTurn();
        }
        function addLog(p, what, pts, words, quiet) {
          if (!quiet) L.push([p, what, pts || 0, words || []]);
          var who = name(p);
          var li = el('li', { class: cls(p) });
          if (words && words.length) {
            li.appendChild(el('span', { text: who + ': ' }));
            words.forEach(function (w, k) { if (k) li.appendChild(el('span', { text: ', ' })); li.appendChild(el('button', { type: 'button', class: 'kgm-logw', title: 'What does ' + w.toUpperCase() + ' mean?', text: w.toUpperCase(), onclick: function () { showMeanings([w]); } })); });
            li.appendChild(el('span', { text: ' (+' + pts + ')' }));
          } else li.textContent = who + ': ' + what + (pts ? ' (+' + pts + ')' : '');
          logEl.insertBefore(li, logEl.firstChild);
        }
        function clearLast() { for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) if (board[r][c]) board[r][c].last = false; }
        function submit() {
          if (!canAct()) return;
          var j = judge(board, pend, isFirst()); if (!j.ok) { paint(); return; }
          clearLast();
          pend.forEach(function (p) { board[p.r][p.c] = { ch: p.ch, blank: p.blank, last: true, who: me }; });
          var used = pend.map(function (p) { return p.ri; });
          racks[me] = racks[me].filter(function (x, i) { return used.indexOf(i) < 0; });
          scores[me] += j.score; addLog(me, j.words.map(function (x) { return x.w.toUpperCase(); }).join(', '), j.score, j.words.map(function (x) { return x.w; }));
          pend = []; selRack = -1; passes = 0; draw(me); K.sound('good');
          say((mode === 'pass' ? name(me) + ': ' : 'Well done! ') + j.words[0].w.toUpperCase() + ' scores ' + j.score + ' points.', 'good');
          if (!racks[me].length && !bag.length) return finish(me);
          endTurn();
        }
        function pass(text) { passes++; addLog(turn, 'passed', 0); say(text); if (passes >= 2 * NP) return finish(-1); endTurn(); }
        /* the next player's turn: the computer, the other player on this phone (the letters hidden until they are ready), or the friend online */
        function endTurn() {
          turn = nextP(turn); selRack = -1; pend = [];
          if (mode === 'cpu') { paint(); if (turn === 1) setTimeout(computer, 750); return; }
          if (mode === 'pass') { me = turn; cover(); return; }
          paint(); send();
        }
        var coverEl = null;
        function cover() {
          covered = true; paint();
          coverEl = el('div', { class: 'kgm-wb-cover', role: 'dialog', 'aria-label': name(turn) }, [el('div', { class: 'kgm-wb-cover__in' }, [
            el('p', { class: 'kgm-wb-cover__big', text: NUM[turn] + ' ' + name(turn) }),
            el('p', { text: T('Pass the phone to') + ' ' + name(turn) + '. ' + T('Your letters stay hidden until you are ready.') }),
            el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: T('I am ready'), onclick: function () { coverEl.remove(); coverEl = null; covered = false; paint(); say(name(me) + ', ' + T('your turn.')); } })])]);
          inner.appendChild(coverEl); try { coverEl.querySelector('button').focus(); } catch (e) {}
        }
        /* online: the whole game as a small list, sent after each turn */
        function dump() {
          var cells = []; for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) { var t = board[r][c]; if (t) cells.push([r, c, t.ch, t.blank ? 1 : 0, t.who, t.last ? 1 : 0]); }
          return { np: NP, b: cells, bag: bag, racks: racks, scores: scores, passes: passes, turn: turn, swaps: swapsLeft, hints: hintsA, log: L, over: over ? 1 : 0 };
        }
        function load(o, anim) {
          if (!o || !o.racks) return;
          var t0 = Date.now() + 60, k = 0;
          for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) board[r][c] = null;
          (o.b || []).forEach(function (x) { if (x[0] < 0 || x[0] >= N || x[1] < 0 || x[1] >= N) return; var ch = String(x[2]).slice(0, 1).toLowerCase(); if (!/^[a-z]$/.test(ch)) return; var wh = Math.max(0, Math.min(NP - 1, +x[4] || 0)); board[x[0]][x[1]] = { ch: ch, blank: !!x[3], who: wh, last: !!x[5] }; if (anim && x[5] && wh !== me) board[x[0]][x[1]].burnAt = t0 + (k++) * 260; });
          bag = (o.bag || []).slice(); racks = PL.map(function (p) { return (o.racks[p] || []).slice(0, RACK); });
          scores = PL.map(function (p) { return +(o.scores || [])[p] || 0; }); passes = +o.passes || 0; turn = Math.max(0, Math.min(NP - 1, +o.turn || 0));
          swapsLeft = o.swaps || PL.map(function () { return 3; }); hintsA = o.hints || hintsA; L = Array.isArray(o.log) ? o.log : [];
          logEl.innerHTML = ''; L.forEach(function (e) { addLog(Math.max(0, Math.min(NP - 1, +e[0] || 0)), String(e[1]), +e[2] || 0, (e[3] || []).map(String), true); });
          pend = []; selRack = -1;
          if (anim && k) setTimeout(function () { if (alive()) paint(); }, 60 + k * 260 + 1150);
        }
        function send() {
          K.net.put(sess, dump()).catch(function (e) {
            if (e && e.why === 'late' && e.data) { sess.v = e.data.v; load(e.data.state); paint(); say(NP === 2 ? T('Your friend played first. Here is the board now.') : T('Another player played first. Here is the board now.'), 'try'); }
            else say(K.net.why(e), 'try');
          });
        }
        function drawNet() {
          netBox.innerHTML = '';
          if (!friendIn && sess.seat === 0) netBox.appendChild(K.net.card('words', sess.code, true));
          if (!friendIn && NP > 2) netBox.appendChild(el('p', { class: 'kg-net__small', text: T('Players here') + ': ' + inCount + ' / ' + NP }));
          if (friendIn || sess.seat !== 0) netBox.appendChild(el('p', { class: 'kg-net__small', text: T('Online game') + ' · ' + sess.code.replace(/(...)(...)/, '$1 $2') }));
        }
        function choose(moves) {
          if (!moves.length) return null;
          moves.sort(function (a, b) { return b.score - a.score; });
          if (level === 'hard') return moves[0];
          if (level === 'medium') { var mid = moves.slice(Math.floor(moves.length * 0.1), Math.max(2, Math.floor(moves.length * 0.4))); return K.pick(mid.length ? mid : moves); }
          var easy = moves.filter(function (m) { return m.word.length <= 5 && !m.tiles.some(function (t) { return t.blank; }) && m.score <= 14; });
          return K.pick(easy.length ? easy : moves.slice(Math.floor(moves.length * 0.6)));
        }
        function computer() {
          if (!alive() || over) return;
          say('The computer is thinking…');
          setTimeout(function () {
            if (!alive() || over) return;
            var m = choose(allMoves(board, racks[1]));
            if (!m) { if (bag.length >= RACK && swapsLeft[1] > 0) { swapsLeft[1]--; var out = racks[1].splice(0, 3); bag = K.shuffle(bag.concat(out)); draw(1); passes = 0; addLog(1, 'swapped ' + out.length + ' letters', 0); turn = 0; paint(); say('The computer swapped some letters. Your turn!'); return; } return pass('The computer passed. Your turn!'); }
            clearLast();
            var t0 = Date.now() + 60, order = m.tiles.slice().sort(function (a, b) { return (a.r - b.r) || (a.c - b.c); });
            order.forEach(function (t, k) { board[t.r][t.c] = { ch: t.ch, blank: t.blank, last: true, who: 1, burnAt: t0 + k * 260 }; var i = racks[1].indexOf(t.blank ? '?' : t.ch); if (i >= 0) racks[1].splice(i, 1); if (!REDUCED) setTimeout(function () { if (alive()) K.sound('tap'); }, 60 + k * 260); });
            scores[1] += m.score; passes = 0; draw(1); addLog(1, m.word.toUpperCase(), m.score, [m.word]); if (REDUCED) K.sound('tap');
            setTimeout(function () { if (alive()) paint(); }, 60 + order.length * 260 + 1150);
            if (!racks[1].length && !bag.length) return finish(1);
            turn = 0; paint(); say('The computer played ' + m.word.toUpperCase() + ' for ' + m.score + ' points. Your turn!');
          }, 350);
        }
        function hint() {
          if (!canAct()) return;
          if (hintsA[me] <= 0) { say('No hints left in this game.', 'try'); return; }
          recall(); var ms = allMoves(board, racks[me]); if (!ms.length) { say(swapsLeft[me] ? 'No word fits. Try swapping some letters.' : 'No word fits. You can pass.', 'try'); paint(); return; }
          ms.sort(function (a, b) { return b.score - a.score; }); var m = ms[Math.min(ms.length - 1, level === 'easy' ? 0 : Math.floor(ms.length * 0.2))];
          hintsA[me]--; paint(m.tiles.map(function (t) { return [t.r, t.c]; }));
          say('Try ' + m.word.toUpperCase() + ' on the glowing squares (' + m.score + ' points). Hints left: ' + hintsA[me]);
        }
        function finish(who, remote) {
          if (remote) { over = true; paint(); return result(); }
          over = true;
          /* the letters left on each rack are taken from that player's score; the one who used all their letters gets them */
          var left = PL.map(function (p) { return racks[p].reduce(function (s, x) { return s + (x === '?' ? 0 : VALUE[x]); }, 0); }), all = left.reduce(function (a, b) { return a + b; }, 0);
          PL.forEach(function (p) { scores[p] -= left[p]; }); if (who >= 0) scores[who] += all - left[who];
          paint(); if (mode === 'net') send();
          result();
        }
        function result() {
          if (mode !== 'cpu' && NP > 2) {
            /* 3 or 4 players: the places, first to last */
            var order = PL.slice().sort(function (x, y) { return scores[y] - scores[x]; }), top1 = scores[order[0]], tied = order.filter(function (p) { return scores[p] === top1; });
            var ex4 = el('div', { class: 'kgm-result' }, order.map(function (p, k) { return el('p', {}, [el('span', { text: ['🥇', '🥈', '🥉', '4️⃣'][PL.filter(function (x) { return scores[x] > scores[p]; }).length] + ' ' + name(p) + ': ' + scores[p] })]); }));
            if (tied.length > 1) { K.sound('good'); say(T('A draw! Well played.'), 'good'); inner.appendChild(ex4); return; }
            if (mode === 'net' && order[0] !== me) { K.sound('good'); say(name(order[0]) + ' ' + T('wins the game!') + ' ' + T('Well played!')); inner.appendChild(ex4); return; }
            K.sound('success'); K.celebrate(inner, mode === 'net' ? T('You won the game!') : name(order[0]) + ' ' + T('wins the game!'), null, ex4); return;
          }
          if (mode !== 'cpu') {
            var a = scores[0], b2 = scores[1], ex = el('div', { class: 'kgm-result' }, [el('p', {}, [el('span', { text: name(0) + ' ' + a + '  ·  ' + name(1) + ' ' + b2 })])]);
            var win = a === b2 ? -1 : a > b2 ? 0 : 1;
            if (win < 0) { K.sound('good'); say(T('A draw! Well played.'), 'good'); inner.appendChild(ex); return; }
            if (mode === 'net' && win !== me) { K.sound('good'); say(T('Your friend won this time. Well played!')); inner.appendChild(ex); return; }
            K.sound('success'); K.celebrate(inner, mode === 'net' ? T('You won the game!') : name(win) + ' ' + T('wins the game!'), null, ex); return;
          }
          var won = scores[0] > scores[1], tie = scores[0] === scores[1];
          var extra = el('div', { class: 'kgm-result' }, [el('p', {}, [el('span', { text: 'You ' + scores[0] + '  ·  Computer ' + scores[1] })])]);
          if (won) { K.sound('success'); var isNew = K.award('words', level); K.best('words', level, scores[0], 'high'); if (isNew) extra.appendChild(el('p', { text: 'You earned a new trophy!' })); K.celebrate(inner, 'You won the game!', null, extra); }
          else { K.sound(tie ? 'good' : 'miss'); say(tie ? 'A draw! Well played.' : 'The computer won this time. Well played!', tie ? 'good' : ''); inner.appendChild(extra); }
        }
        grid.addEventListener('keydown', function (e) {
          if (!canAct()) return;
          var k = e.key.toLowerCase();
          if (/^[a-z]$/.test(k)) { var i = racks[me].findIndex(function (x, i) { return x === k && !pend.some(function (p) { return p.ri === i; }); }); if (i < 0) i = racks[me].findIndex(function (x, i) { return x === '?' && !pend.some(function (p) { return p.ri === i; }); }); if (i >= 0) { selRack = i; paint(); } }
          if (e.key === 'Enter') { e.preventDefault(); submit(); }
          if (e.key === 'Escape') { recall(); paint(); }
        });
        load(st0);
        if (mode === 'net') {
          drawNet();
          K.net.watch(sess, function (d, unchanged) {
            if (!alive()) return;
            if (!d) { say(T('This online game has ended.')); K.net.forget('words'); return; }
            var was = friendIn, wasIn = inCount; friendIn = allIn(d); inCount = joined(d);
            if (friendIn !== was || inCount !== wasIn) { drawNet(); paint(); if (friendIn && !was) { K.sound('bell'); say(NP === 2 ? (sess.seat === 0 ? T('Your friend has joined. Your turn!') : T('Waiting for your friend’s move…')) : T('Everyone is here.') + ' ' + (turn === me ? T('Your turn!') : T('Waiting for') + ' ' + name(turn) + '…')); } }
            if (unchanged || !d.state) return;
            var wasOver = over; load(d.state, true); over = !!d.state.over; paint();
            var last = L[L.length - 1];
            if (over && !wasOver) return finish(-1, true);
            if (turn !== me && friendIn && NP > 2 && !over) say((last ? name(Math.max(0, Math.min(NP - 1, +last[0] || 0))) + ': ' + (last[3] && last[3].length ? last[3].join(', ').toUpperCase() + (last[2] ? ' (+' + last[2] + ')' : '') : last[1]) + '. ' : '') + T('Waiting for') + ' ' + name(turn) + '…');
            if (turn === me && friendIn) { K.net.nudge(); say(last ? name(Math.max(0, Math.min(NP - 1, +last[0] || 0))) + ': ' + (last[3] && last[3].length ? last[3].join(', ').toUpperCase() + (last[2] ? ' (+' + last[2] + ')' : '') : last[1]) + '. ' + T('Your turn!') : T('Your turn!'), 'good'); }
          });
          if (st0 && st0.over) { over = true; paint(); result(); return; }
        }
        paint();
        if (mode === 'cpu') say('You go first. Make a word through the cross in the middle.');
        else if (mode === 'pass') say(name(0) + ' ' + T('goes first. Make a word through the cross in the middle.'));
        else if (!friendIn) say(NP === 2 ? T('Waiting for your friend to join…') : T('Waiting for all the players to join…'));
        else say(turn === me ? T('Your turn!') + ' ' + (L.length ? '' : T('Make a word through the cross in the middle.')) : NP === 2 ? T('Waiting for your friend’s move…') : T('Waiting for') + ' ' + name(turn) + '…');
      }
    }

    /* 7.24.0: for Sudoku Race (games-duo.js) */
    K.sudoku = { find: findPuzzle, play: playSudoku, frame: function (holder) { return frame(holder, 'sudoku', 'sudoku', ['fields', 'valley', 'prayer', 'victory']); }, fmt: fmtTime };
    window.KJTGames.register({ id: 'sudoku', cat: 'think', icon: '🧮', name: 'Sudoku', blurb: 'Fill the grid with 1 to 9: four levels, up to Ultra Hard', daily: true, run: sudoku, levels: [['easy', 'Easy'], ['medium', 'Medium'], ['hard', 'Hard'], ['ultra', 'Ultra Hard']] });
    window.KJTGames.register({ id: 'ttt', cat: 'family', icon: '🐟', name: 'Fish & Dove', blurb: 'Three in a row: play the computer or a friend', daily: false, run: fishDove });
    window.KJTGames.register({ id: 'words', cat: 'family', icon: '🧩', name: 'Word Builder', blurb: 'Build English words on the board: against the computer, or 2 to 4 players', daily: false, run: wordBuilder, langs: ['en'] });
  }
  boot();
})();
