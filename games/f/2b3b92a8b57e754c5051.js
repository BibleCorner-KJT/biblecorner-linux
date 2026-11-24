/* KJT Kids Corner - Bible Games: Thinking & Puzzles (Site Core 5.5.0)
   Bible Crossword, Verse Builder, Bible Timeline, Books of the Bible Race,
   Memory Match Master. */
(function () {
  'use strict';
  if (!window.KJTGames) return;
  var K = window.KJTGames.kit, el = K.el, D = K.data || {};

  function bestLine(id, level, score, dir, unit) {
    var b = K.best(id, level, score, dir);
    return el('p', { class: 'kg-best', text: (b.isNew ? '\ud83c\udfc5 New personal best! ' : '') + 'Your best on this level: ' + b.best + (unit ? ' ' + unit : '') });
  }
  function timer(box) {
    var t0 = Date.now(), n = el('span', { class: 'kg-timer', text: '\u23f1 0:00' });
    var id = setInterval(function () { if (!document.body.contains(n)) return clearInterval(id); n.textContent = '\u23f1 ' + fmt(secs()); }, 500);
    K.onLeave(function () { clearInterval(id); });
    function secs() { return Math.round((Date.now() - t0) / 1000); }
    return { node: n, secs: secs, stop: function () { clearInterval(id); return secs(); }, add: function (s) { t0 -= s * 1000; } };
  }
  function fmt(s) { return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }

  /* A reorderable list (Timeline, Books): tap an item, then tap where it should go, or use the arrows. */
  function orderList(items, label) {
    var list = el('ol', { class: 'kg-order-list', 'aria-label': label }), sel = null, order = items.slice();
    function draw() {
      list.innerHTML = '';
      order.forEach(function (it, i) {
        var li = el('li', { class: 'kg-ol-item' + (sel === i ? ' sel' : '') + (it.state ? ' ' + it.state : '') }, [
          el('button', { class: 'kg-ol-main', type: 'button', onclick: function () { if (sel === null) sel = i; else if (sel === i) sel = null; else { var m = order.splice(sel, 1)[0]; order.splice(i, 0, m); sel = null; K.sound('step'); } clear(); draw(); } }, [el('span', { class: 'kg-ol-n', text: String(i + 1) }), el('span', { text: it.text }), it.sub && it.state ? el('small', { text: it.sub }) : null]),
          el('button', { class: 'kg-ol-arrow', type: 'button', 'aria-label': 'Move up', text: '\u25b2', disabled: i === 0 ? 'disabled' : null, onclick: function () { swap(i, i - 1); } }),
          el('button', { class: 'kg-ol-arrow', type: 'button', 'aria-label': 'Move down', text: '\u25bc', disabled: i === order.length - 1 ? 'disabled' : null, onclick: function () { swap(i, i + 1); } })
        ]);
        list.appendChild(li);
      });
    }
    function clear() { order.forEach(function (o) { o.state = ''; }); }
    function swap(a, b) { var t = order[a]; order[a] = order[b]; order[b] = t; sel = null; clear(); K.sound('step'); draw(); }
    draw();
    return { node: list, order: function () { return order; }, draw: draw };
  }

  /* =================================================================
     BIBLE CROSSWORD
     ================================================================= */
  /* 7.24.0: race: { make: true } returns the crossword (lay) only; race: { lay, done(result) } plays that crossword in Crossword Race */
  function crossword(box, level, race) {
    if (!race || typeof race !== 'object') race = null; /* the games frame passes alive() as the third argument */
    /* 5.9.0: hard = more and longer words, harder clues (D.hardclues), no letter counts, no hints */
    /* 7.9.0: in another language the answers are that language's own words (K.lw()), the clues are translated,
       and letters are counted as the reader sees them (K.G: graphemes) */
    var LW = K.lw ? K.lw() : null, LOC = !!(LW && LW.answers), G = K.G || function (x) { return String(x).split(''); }, GC = {};
    function g(w) { return GC[w] || (GC[w] = G(w)); }
    function loc(src) { if (!LOC) return src || {}; var o = {}; Object.keys(src || {}).forEach(function (w) { var a = LW.answers[w]; if (a && g(a).length >= 2) o[a] = K.T(src[w]); }); return o; }
    var CL = loc(D.clues), HC = loc(D.hardclues);
    var HARD = level === 'hard', want = { easy: 6, medium: 9, hard: 16 }[level], N = HARD ? 17 : 15, clues = CL;
    var short = K.lang === 'zh' ? 0.5 : 1;
    var words;
    if (HARD) {
      clues = {}; Object.keys(CL).forEach(function (w) { clues[w] = CL[w]; }); Object.keys(HC).forEach(function (w) { clues[w] = HC[w]; });
      words = K.shuffle(Object.keys(HC)).concat(K.shuffle(Object.keys(CL).filter(function (w) { return g(w).length >= 6 * short; })));
    } else words = K.shuffle(Object.keys(clues)).filter(function (w) { return g(w).length <= (level === 'easy' ? 7 : 10); });
    var grid, placed, lay = race && race.lay;
    function tryBuild() {
      grid = []; for (var r = 0; r < N; r++) grid.push(new Array(N).fill(''));
      placed = []; var used = {};
      function fits(w0, r, c, dr, dc) {
        var cross = 0, w = g(w0);
        if (r - dr >= 0 && c - dc >= 0 && grid[r - dr][c - dc]) return -1;
        var er = r + dr * w.length, ec = c + dc * w.length;
        if (er < N && ec < N && er >= 0 && ec >= 0 && grid[er] && grid[er][ec]) return -1;
        for (var i = 0; i < w.length; i++) {
          var rr = r + dr * i, cc = c + dc * i;
          if (rr < 0 || cc < 0 || rr >= N || cc >= N) return -1;
          var ch = grid[rr][cc];
          if (ch) { if (ch !== w[i] || used[rr + ',' + cc + (dr ? 'v' : 'h')]) return -1; cross++; continue; }
          /* no touching neighbours alongside a new letter */
          if (dr === 0) { if ((rr > 0 && grid[rr - 1][cc]) || (rr < N - 1 && grid[rr + 1][cc])) return -1; }
          else { if ((cc > 0 && grid[rr][cc - 1]) || (cc < N - 1 && grid[rr][cc + 1])) return -1; }
        }
        return cross;
      }
      function put(w0, r, c, dr, dc) { var w = g(w0); for (var i = 0; i < w.length; i++) { grid[r + dr * i][c + dc * i] = w[i]; used[(r + dr * i) + ',' + (c + dc * i) + (dr ? 'v' : 'h')] = 1; } placed.push({ w: w0, r: r, c: c, dr: dr, dc: dc }); }
      var first = words[0]; put(first, Math.floor(N / 2), Math.floor((N - g(first).length) / 2), 0, 1);
      for (var k = 1; k < words.length && placed.length < want; k++) {
        var w = words[k], best = null;
        if (placed.some(function (p) { return p.w === w; })) continue;
        for (var r = 0; r < N; r++) for (var c = 0; c < N; c++) [[0, 1], [1, 0]].forEach(function (d) {
          var f = fits(w, r, c, d[0], d[1]); if (f > 0 && (!best || f > best.f || (f === best.f && K.rand() < .3))) best = { r: r, c: c, dr: d[0], dc: d[1], f: f };
        });
        if (best) put(w, best.r, best.c, best.dr, best.dc);
      }
      return placed.length >= Math.min(want, 5);
    }
    if (!lay) {
    /* short words (Chinese, Hindi, Arabic) cross less often: try more layouts and keep the fullest */
    var tries = LOC && /^(zh|hi|ar)$/.test(K.lang) ? 40 : 6, bestG = null, bestP = null;
    for (var attempt = 0; attempt < tries; attempt++) {
      var okB = tryBuild();
      if (!bestP || placed.length > bestP.length) { bestG = grid; bestP = placed; }
      if (okB && placed.length >= want) break;
      if (okB && !LOC) break;
      words = K.shuffle(words);
    }
    lay = { N: N, hard: HARD, p: bestP.map(function (p) { return { w: p.w, r: p.r, c: p.c, dr: p.dr, dc: p.dc, q: clues[p.w] }; }) };
    }
    if (race && race.make) return lay;
    /* the crossword drawn from its plan (the same plan on both phones in a race) */
    N = lay.N; HARD = !!lay.hard; clues = {}; grid = []; for (var r0 = 0; r0 < N; r0++) grid.push(new Array(N).fill(''));
    placed = lay.p.map(function (p) { clues[p.w] = p.q; var w = g(p.w); for (var i = 0; i < w.length; i++) grid[p.r + p.dr * i][p.c + p.dc * i] = w[i]; return { w: p.w, r: p.r, c: p.c, dr: p.dr, dc: p.dc }; });
    /* crop */
    var minR = N, maxR = 0, minC = N, maxC = 0;
    placed.forEach(function (p) { minR = Math.min(minR, p.r); minC = Math.min(minC, p.c); maxR = Math.max(maxR, p.r + p.dr * (g(p.w).length - 1)); maxC = Math.max(maxC, p.c + p.dc * (g(p.w).length - 1)); });
    var rows = maxR - minR + 1, cols = maxC - minC + 1;
    /* numbering */
    var starts = {}, num = 0;
    placed.slice().sort(function (a, b) { return (a.r - b.r) || (a.c - b.c); }).forEach(function (p) { var k = p.r + ',' + p.c; if (!starts[k]) starts[k] = ++num; p.n = starts[k]; });
    var gridEl = el('div', { class: 'kg-xw', style: '--cols:' + cols + ';--rows:' + rows }), inputs = {};
    for (var r = minR; r <= maxR; r++) for (var c = minC; c <= maxC; c++) {
      var ch = grid[r][c], key = r + ',' + c;
      if (!ch) { gridEl.appendChild(el('span', { class: 'kg-xw-blank' })); continue; }
      var inp = el('input', { class: 'kg-xw-in', maxlength: LOC ? null : '1', inputmode: 'text', autocomplete: 'off', autocapitalize: 'characters', 'aria-label': 'Letter', 'data-k': key, lang: LOC ? K.lang : null });
      inputs[key] = { el: inp, ch: ch, r: r, c: c };
      gridEl.appendChild(el('span', { class: 'kg-xw-cell' }, [starts[key] ? el('small', { text: String(starts[key]) }) : null, inp]));
    }
    var dir = [0, 1];
    Object.keys(inputs).forEach(function (k) {
      var it = inputs[k];
      it.el.addEventListener('focus', function () { highlight(it); });
      it.el.addEventListener('input', function (e) {
        if (e && e.isComposing) return;
        it.el.value = letter(it.el.value);
        it.el.classList.remove('bad', 'good');
        /* Hindi letters can take two key presses (a consonant and its vowel sign): stay in the square */
        if (it.el.value && !(LOC && K.lang === 'hi')) { var nx = inputs[(it.r + dir[0]) + ',' + (it.c + dir[1])]; if (nx) nx.el.focus(); }
        if (it.el.value) check(false);
      });
      it.el.addEventListener('compositionend', function () { it.el.value = letter(it.el.value); if (it.el.value) { var nx = inputs[(it.r + dir[0]) + ',' + (it.c + dir[1])]; if (nx) nx.el.focus(); check(false); } });
      it.el.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !it.el.value) { var pv = inputs[(it.r - dir[0]) + ',' + (it.c - dir[1])]; if (pv) { pv.el.focus(); pv.el.value = ''; e.preventDefault(); } }
      });
      it.el.addEventListener('click', function () { var across = !!(inputs[it.r + ',' + (it.c - 1)] || inputs[it.r + ',' + (it.c + 1)]), down = !!(inputs[(it.r - 1) + ',' + it.c] || inputs[(it.r + 1) + ',' + it.c]); if (across && down) dir = dir[1] ? [1, 0] : [0, 1]; else dir = across ? [0, 1] : [1, 0]; highlight(it); });
    });
    function letter(v) {
      v = String(v || '');
      if (!LOC || K.lang === 'fr' || K.lang === 'es') return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z]/g, '').slice(-1);
      if (K.lang === 'ar') v = v.replace(/[\u064B-\u065F\u0670\u0640]/g, '');
      var gg = G(v.replace(/\s/g, '')); return gg.length ? gg[gg.length - 1] : '';
    }
    function highlight(it) {
      Object.keys(inputs).forEach(function (k) { inputs[k].el.parentNode.classList.remove('hl'); });
      var p = placed.filter(function (p) { return p.dr === dir[0] && p.dc === dir[1] && cellsOf(p).indexOf(it.r + ',' + it.c) >= 0; })[0];
      if (p) { cur = p; cellsOf(p).forEach(function (k) { inputs[k].el.parentNode.classList.add('hl'); }); clueNodes.forEach(function (n) { n.classList.toggle('on', n.p === p); }); }
    }
    function cellsOf(p) { var out = []; for (var i = 0; i < g(p.w).length; i++) out.push((p.r + p.dr * i) + ',' + (p.c + p.dc * i)); return out; }
    var clueNodes = [], across = el('ol', { class: 'kg-xw-clues' }), down = el('ol', { class: 'kg-xw-clues' });
    placed.slice().sort(function (a, b) { return a.n - b.n; }).forEach(function (p) {
      var li = el('li', { value: String(p.n), text: p.n + '. ' + clues[p.w] + (HARD ? '' : ' (' + g(p.w).length + ')'), onclick: function () { dir = [p.dr, p.dc]; inputs[p.r + ',' + p.c].el.focus(); highlight(inputs[p.r + ',' + p.c]); } });
      li.p = p; clueNodes.push(li); (p.dr ? down : across).appendChild(li);
    });
    /* 7.9.12: points. Every word is worth 10; a revealed letter costs 2 from each word it is in, a revealed word gives 0 */
    var tm = timer(box), hints = race ? 5 : { easy: 6, medium: 4, hard: 0 }[level], done = false, cur = null, lost = new Map(), used = 0;
    placed.forEach(function (p) { lost.set(p, 0); });
    var ptsEl = el('span', { class: 'kg-theme kg-xw-pts' });
    function points() { var t = 0; lost.forEach(function (v) { t += Math.max(0, 10 - v); }); return t; }
    function showPts() { ptsEl.textContent = '\u2b50 ' + points() + ' / ' + placed.length * 10; }
    function cost(key, n) { placed.forEach(function (p) { if (cellsOf(p).indexOf(key) >= 0) lost.set(p, Math.min(10, lost.get(p) + n)); }); showPts(); }
    function solved(p) { return cellsOf(p).every(function (k) { return inputs[k].el.value === inputs[k].ch; }); }
    var hintBtn = el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', onclick: function () {
      if (!hints || done) return; var empty = Object.keys(inputs).filter(function (k) { return inputs[k].el.value !== inputs[k].ch; }); if (!empty.length) return;
      var pool = cur && !solved(cur) ? empty.filter(function (k) { return cellsOf(cur).indexOf(k) >= 0; }) : empty;
      var key = K.pick(pool.length ? pool : empty), it = inputs[key]; it.el.value = it.ch; it.el.classList.remove('bad'); it.el.classList.add('good'); hints--; used++; if (race) tm.add(20); cost(key, 2); hintBtn.textContent = '\ud83d\udca1 ' + (race ? K.T('Reveal a letter (+20 s)') : 'Reveal a letter') + ' (' + hints + ')'; hintBtn.disabled = !hints; K.sound && K.sound('tap'); check(false);
    }, text: '\ud83d\udca1 ' + (race ? K.T('Reveal a letter (+20 s)') : 'Reveal a letter') + ' (' + hints + ')' });
    if (!hints) hintBtn.hidden = true;
    var wordBtn = el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83d\udd0e Reveal the word', title: 'The word you chose is filled in, but it gives no points.', onclick: function () {
      if (done) return;
      var p = cur && !solved(cur) ? cur : placed.slice().sort(function (a, b) { return a.n - b.n; }).filter(function (q) { return !solved(q); })[0]; if (!p) return;
      cellsOf(p).forEach(function (k) { var it = inputs[k]; if (it.el.value !== it.ch) { it.el.value = it.ch; it.el.classList.remove('bad'); it.el.classList.add('shown'); } });
      lost.set(p, 10); showPts(); clueNodes.forEach(function (n) { if (n.p === p) n.classList.add('shown'); });
      cur = p; highlight(inputs[p.r + ',' + p.c]); K.sound && K.sound('tap'); check(false);
    } });
    function check(show) {
      var all = true;
      Object.keys(inputs).forEach(function (k) { var it = inputs[k], ok = it.el.value === it.ch; if (!ok) all = false; if (show && it.el.value) it.el.classList.toggle('bad', !ok); });
      if (all && !done && race) { done = true; K.sound && K.sound('success'); race.done({ ms: tm.stop() * 1000, hints: used }); return; }
      if (all && !done) { done = true; var s = tm.stop(), pt = points(); K.award('crossword', level); K.celebrate(box, 'Crossword complete in ' + fmt(s) + '!', null, el('div', {}, [el('p', { class: 'kg-best kg-xw-score', text: '\u2b50 ' + pt + ' / ' + placed.length * 10 + ' points' }), bestLine('crosswordpts', level, pt, 'high', 'points'), pt < placed.length * 10 ? el('p', { class: 'kg-best', text: 'Fewer hints, more points!' }) : null])); }
    }
    showPts();
    box.appendChild(el('div', { class: 'kg-row-top' }, [el('span', { class: 'kg-theme', text: placed.length + ' words' }), race ? null : ptsEl, tm.node]));
    box.appendChild(el('div', { class: 'kg-xw-wrap' }, [el('div', { class: 'kg-xw-scroll' }, [gridEl]), el('div', { class: 'kg-xw-side' }, [el('h5', { text: 'Across' }), across, el('h5', { text: 'Down' }), down])]));
    box.appendChild(el('div', { class: 'kt-row' }, [el('button', { class: 'kt-btn', type: 'button', text: '\u2714 Check my answers', onclick: function () { check(true); } }), hintBtn, race ? null : wordBtn]));
    box.appendChild(el('p', { class: 'kg-xw-rule', text: race ? K.T('The fastest wins. A revealed letter adds 20 seconds.') : 'Every word is worth 10 points. A revealed letter costs 2 points, and a revealed word gives no points.' }));
  }

  /* =================================================================
     VERSE BUILDER
     ================================================================= */
  function verseBuilder(box, level) {
    /* 7.9.0: the verses in the page language (Chinese has no spaces: its words come from the browser's word finder) */
    var LW = K.lw ? K.lw() : null, LOC = !!(LW && K.lang && K.lang !== 'en'), ZH = LOC && K.lang === 'zh', SEP = ZH ? '' : ' ';
    var WS = null; try { if (ZH && Intl.Segmenter) WS = new Intl.Segmenter('zh', { granularity: 'word' }); } catch (e) {}
    function split(t) {
      if (!ZH) return t.split(/\s+/);
      var out = [];
      if (WS) Array.from(WS.segment(t)).forEach(function (x) { if (x.isWordLike || !out.length) out.push(x.segment); else out[out.length - 1] += x.segment; });
      else (t.match(/[\u4e00-\u9fff]{1,2}[^\u4e00-\u9fff]*/g) || [t]).forEach(function (x) { out.push(x); });
      /* join single characters into pairs so there are not too many tiles */
      var j = []; out.forEach(function (x) { if (j.length && (j[j.length - 1].length < 2 || x.length < 2) && (j[j.length - 1] + x).length <= 4) j[j.length - 1] += x; else j.push(x); });
      return j;
    }
    function TT(x) { return LOC ? K.T(x) : x; }
    var all = (D.verses || []).map(function (v) { var t = TT(v.t), w = split(t); return { t: t, ref: TT(v.ref), w: w, n: w.length }; });
    var pool = all.filter(function (v) { return level === 'easy' ? v.n <= 7 : level === 'medium' ? v.n >= 6 && v.n <= 12 : v.n >= 9; });
    if (pool.length < 5) pool = all;
    var rounds = K.shuffle(pool).slice(0, 5), idx = 0, score = 0, tm = timer(box);
    var DECOYS = (LOC && LW.decoys) || ['sheep', 'bread', 'river', 'mountain', 'king', 'star', 'fish', 'door', 'joy', 'wind', 'stone', 'gold'];
    box.appendChild(el('div', { class: 'kg-row-top' }, [el('span', { class: 'kg-theme kg-vb-count' }), tm.node]));
    var area = el('div', { class: 'kg-vb' }); box.appendChild(area);
    function round() {
      var v = rounds[idx], words = v.w, picked = [], tiles;
      box.querySelector('.kg-vb-count').textContent = TT('Verse ' + (idx + 1) + ' of ' + rounds.length) + ' \u00b7 ' + v.ref;
      var extra = level === 'hard' ? K.shuffle(DECOYS.filter(function (d) { return v.t.toLowerCase().indexOf(d) < 0; })).slice(0, 3) : [];
      tiles = K.shuffle(words.concat(extra)).map(function (w, i) { return { w: w, i: i, used: false }; });
      var line = el('div', { class: 'kg-vb-line', 'aria-live': 'polite', 'data-kjt-notr': LOC ? '' : null }), bank = el('div', { class: 'kg-vb-bank', 'data-kjt-notr': LOC ? '' : null }), msg = el('p', { class: 'kg-note', 'data-kjt-notr': LOC ? '' : null });
      function draw() {
        line.innerHTML = ''; bank.innerHTML = '';
        if (!picked.length) line.appendChild(el('span', { class: 'kg-vb-hint', text: TT('Tap the words in the right order\u2026') }));
        picked.forEach(function (t, k) { line.appendChild(el('button', { class: 'kg-vb-w on', type: 'button', text: t.w, onclick: function () { picked.splice(k, 1); t.used = false; draw(); } })); });
        tiles.forEach(function (t) { if (!t.used) bank.appendChild(el('button', { class: 'kg-vb-w', type: 'button', text: t.w, onclick: function () { t.used = true; picked.push(t); K.sound('step'); draw(); test(); } })); });
      }
      function test() {
        if (picked.length !== words.length) return;
        var ok = picked.map(function (t) { return t.w; }).join(SEP) === words.join(SEP);
        if (ok) { score++; K.sound('good'); msg.className = 'kg-note'; msg.textContent = '\u2b50 ' + TT('Well done!') + ' \u201c' + v.t + '\u201d (' + v.ref + ')'; setTimeout(next, 1400); }
        else { K.sound('miss'); msg.className = 'kg-note try'; msg.textContent = TT('Not quite. Tap a word in your answer to take it back.'); }
      }
      function next() { idx++; if (idx >= rounds.length) finish(); else round(); }
      area.innerHTML = ''; area.appendChild(line); area.appendChild(bank); area.appendChild(msg);
      area.appendChild(el('div', { class: 'kt-row' }, [el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83d\udca1 Show first word', onclick: function () { if (picked.length) return; var t = tiles.filter(function (x) { return x.w === words[0] && !x.used; })[0]; if (t) { t.used = true; picked.push(t); draw(); } } }),
        el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: 'Skip \u2192', onclick: next })]));
      draw();
    }
    function finish() { var s = tm.stop(); area.innerHTML = ''; var passed = score >= 4; if (passed) K.award('verse', level); if (passed) K.celebrate(box, 'You built ' + score + ' of ' + rounds.length + ' verses in ' + fmt(s) + '!', null, bestLine('verse', level, score * 1000 - s, 'high', 'points')); else { K.celebrate(box, 'You built ' + score + ' of ' + rounds.length + ' verses. Build 4 or more to win a trophy!'); } }
    round();
  }

  /* =================================================================
     BIBLE TIMELINE
     ================================================================= */
  function timeline(box, level) {
    var n = { easy: 4, medium: 6, hard: 9 }[level], ev = D.events || [];
    var chosen = K.shuffle(ev).slice(0, n), tries = 0, tm = timer(box);
    var items = K.shuffle(chosen).map(function (e) { return { text: e.t, sub: e.ref, i: e.i, state: '' }; });
    while (items.every(function (it, k, a) { return k === 0 || a[k - 1].i < it.i; })) items = K.shuffle(items);
    var L = orderList(items, 'Events to put in order');
    var msg = el('p', { class: 'kg-note' });
    box.appendChild(el('div', { class: 'kg-row-top' }, [el('span', { class: 'kg-theme', text: 'Earliest at the top \u2193 latest at the bottom' }), tm.node]));
    box.appendChild(el('p', { class: 'kt-note', text: 'Tap an event, then tap the place it belongs, or use the arrows.' }));
    box.appendChild(L.node); box.appendChild(msg);
    var checkBtn = el('button', { class: 'kt-btn', type: 'button', text: '\u2714 Check the order', onclick: function () {
      tries++; var order = L.order(), sorted = order.slice().sort(function (a, b) { return a.i - b.i; }), good = 0;
      order.forEach(function (it, k) { it.state = it === sorted[k] ? 'good' : 'bad'; if (it.state === 'good') good++; });
      L.draw();
      if (good === order.length) { var s = tm.stop(); checkBtn.disabled = true; K.award('timeline', level); K.celebrate(box, 'History in perfect order, in ' + tries + (tries === 1 ? ' try' : ' tries') + '!', null, bestLine('timeline', level, tries, 'low', tries === 1 ? 'try' : 'tries')); }
      else { K.sound('miss'); msg.className = 'kg-note try'; msg.textContent = good + ' of ' + order.length + ' are in the right place (green). Keep going!'; }
    } });
    box.appendChild(el('div', { class: 'kt-row' }, [checkBtn]));
  }

  /* =================================================================
     BOOKS OF THE BIBLE RACE
     ================================================================= */
  function booksRace(box, level) {
    var B = D.books || { ot: [], nt: [] }, n = { easy: 10, medium: 16, hard: 24 }[level];
    var cards = K.shuffle(B.ot.map(function (b) { return { b: b, t: 'ot' }; }).concat(B.nt.map(function (b) { return { b: b, t: 'nt' }; }))).slice(0, n);
    var i = 0, mistakes = 0, tm = timer(box);
    box.appendChild(el('div', { class: 'kg-row-top' }, [el('span', { class: 'kg-theme kg-br-count' }), tm.node]));
    var area = el('div', { class: 'kg-br' }); box.appendChild(area);
    function sortPhase() {
      box.querySelector('.kg-br-count').textContent = 'Part 1 \u00b7 Old or New Testament? ' + (i + 1) + ' of ' + cards.length;
      var c = cards[i], msg = el('p', { class: 'kg-note' });
      area.innerHTML = '';
      area.appendChild(el('div', { class: 'kg-br-card', text: '\ud83d\udcd6 ' + c.b }));
      function answer(t) {
        if (t === c.t) { K.sound('collect'); i++; if (i >= cards.length) (level === 'easy' ? done() : orderPhase()); else sortPhase(); }
        else { mistakes++; tm.add(3); K.sound('miss'); msg.className = 'kg-note try'; msg.textContent = 'Not quite: ' + c.b + ' is in the ' + (c.t === 'ot' ? 'Old' : 'New') + ' Testament. (+3 seconds)'; setTimeout(function () { i++; if (i >= cards.length) (level === 'easy' ? done() : orderPhase()); else sortPhase(); }, 1300); }
      }
      area.appendChild(el('div', { class: 'kg-br-buttons' }, [
        el('button', { class: 'kg-br-btn ot', type: 'button', text: '\ud83d\udcdc Old Testament', onclick: function () { answer('ot'); } }),
        el('button', { class: 'kg-br-btn nt', type: 'button', text: '\u271d New Testament', onclick: function () { answer('nt'); } })
      ]));
      area.appendChild(msg);
    }
    function orderPhase() {
      var list = K.pick([B.ot, B.nt]), len = level === 'hard' ? 7 : 5, s = K.ri(0, list.length - len), run = list.slice(s, s + len);
      box.querySelector('.kg-br-count').textContent = 'Part 2 \u00b7 Put these books in Bible order';
      var items = K.shuffle(run).map(function (b) { return { text: b, i: list.indexOf(b), state: '' }; });
      var L = orderList(items, 'Books to put in order'), msg = el('p', { class: 'kg-note' });
      area.innerHTML = ''; area.appendChild(L.node); area.appendChild(msg);
      area.appendChild(el('div', { class: 'kt-row' }, [el('button', { class: 'kt-btn', type: 'button', text: '\u2714 Check', onclick: function () {
        var o = L.order(), sorted = o.slice().sort(function (a, b) { return a.i - b.i; }), good = 0;
        o.forEach(function (it, k) { it.state = it === sorted[k] ? 'good' : 'bad'; if (it.state === 'good') good++; }); L.draw();
        if (good === o.length) done(); else { mistakes++; tm.add(3); K.sound('miss'); msg.className = 'kg-note try'; msg.textContent = good + ' of ' + o.length + ' in the right place. (+3 seconds)'; }
      } })]));
    }
    function done() { var s = tm.stop(); area.innerHTML = ''; K.award('books', level); K.celebrate(box, 'Finished in ' + fmt(s) + ' with ' + mistakes + ' mistake' + (mistakes === 1 ? '' : 's') + '!', null, bestLine('books', level, s, 'low', 'seconds')); }
    sortPhase();
  }

  /* =================================================================
     MEMORY MATCH MASTER
     ================================================================= */
  function memory(box, level) {
    var n = { easy: 6, medium: 8, hard: 12 }[level], pairs = K.shuffle(D.pairs || []).slice(0, n);
    var cards = K.shuffle(pairs.reduce(function (a, p, i) { a.push({ id: i, text: p[0] }, { id: i, text: p[1] }); return a; }, []));
    var open = [], matched = 0, moves = 0, lock = false, tm = timer(box);
    var grid = el('div', { class: 'kg-mm', style: '--cols:' + (n === 6 ? 4 : n === 8 ? 4 : 6) });
    var info = el('span', { class: 'kg-theme', text: 'Moves: 0' });
    box.appendChild(el('div', { class: 'kg-row-top' }, [info, tm.node]));
    box.appendChild(el('p', { class: 'kt-note', text: 'Find the matching pairs: a person and their story, a saint and their symbol.' }));
    cards.forEach(function (c) {
      var b = el('button', { class: 'kg-mm-card', type: 'button', 'aria-label': 'Hidden card' }, [el('span', { class: 'kg-mm-back', text: '\u2626' }), el('span', { class: 'kg-mm-front', text: c.text })]);
      b.addEventListener('click', function () {
        if (lock || b.classList.contains('open') || b.classList.contains('done')) return;
        b.classList.add('open'); b.setAttribute('aria-label', c.text); K.sound('step'); open.push({ c: c, b: b });
        if (open.length === 2) {
          moves++; info.textContent = 'Moves: ' + moves;
          var a = open[0], d = open[1];
          if (a.c.id === d.c.id) { a.b.classList.add('done'); d.b.classList.add('done'); open = []; matched++; K.sound('good');
            if (matched === n) { var s = tm.stop(); K.award('memory', level); K.celebrate(box, 'All ' + n + ' pairs found in ' + moves + ' moves (' + fmt(s) + ')!', null, bestLine('memory', level, moves, 'low', 'moves')); } }
          else { lock = true; setTimeout(function () { a.b.classList.remove('open'); d.b.classList.remove('open'); a.b.setAttribute('aria-label', 'Hidden card'); d.b.setAttribute('aria-label', 'Hidden card'); open = []; lock = false; }, 900); }
        }
      });
      grid.appendChild(b);
    });
    box.appendChild(grid);
  }

  /* 7.24.0: for Crossword Race (games-duo.js) */
  K.crossword = { make: function (level) { return crossword(null, level, { make: true }); }, play: function (box, level, lay, done) { crossword(box, level, { lay: lay, done: done }); } };
  window.KJTGames.register({ id: 'crossword', cat: 'think', icon: '\u270f\ufe0f', name: 'Bible Crossword', blurb: 'A brand-new crossword with Bible clues every time', daily: true, run: crossword });
  window.KJTGames.register({ id: 'verse', cat: 'think', icon: '\ud83d\udcdc', name: 'Verse Builder', blurb: 'Put the words of a memory verse back in order', daily: true, run: verseBuilder });
  window.KJTGames.register({ id: 'timeline', cat: 'think', icon: '\u23f3', name: 'Bible Timeline', blurb: 'Put Bible events in order, from Creation to Pentecost', daily: true, run: timeline });
  window.KJTGames.register({ id: 'books', cat: 'think', icon: '\ud83d\udcda', name: 'Books of the Bible Race', blurb: 'Old or New Testament? Race the clock', daily: true, run: booksRace });
  window.KJTGames.register({ id: 'memory', cat: 'think', icon: '\ud83c\udccf', name: 'Memory Match Master', blurb: 'Match saints with symbols, people with stories', daily: true, run: memory });
})();
