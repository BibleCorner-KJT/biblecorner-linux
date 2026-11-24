/* KJT Site Core 7.21.0 - Games for two (and more): one frame for every board game where players take turns.
   Each game can be played against the computer (Easy, Medium, Hard), by two players on one phone, or with
   a friend online by a game code (see "Play with a friend" in games.js). The game itself only says what the
   board looks like, which moves are allowed, and who has won; the frame does the rest: choosing how to play,
   whose turn it is, the computer's moves, sending moves to the friend's phone, the score and "Play again".
   Games here: Loaves and Fishes (four in a row), Checkers, Mancala, Nine Men's Morris, Tavli, and Word Hunt
   (find words in a grid of letters, inspired by the free app Lexica). */
(function () {
  'use strict';
  var ME = document.currentScript && document.currentScript.src || '';
  var BASE = ME.replace(/games-duo\.js.*$/, '');
  function boot() {
    if (!window.KJTGames) { setTimeout(boot, 50); return; }
    var K = window.KJTGames.kit, el = K.el, T = K.T || function (s) { return s; };

    /* ======================= the frame ======================= */
    /* spec: { id, title, sides: [[icon, name], [icon, name]], init(), turn(st), apply(st, m), legal(st) -> moves,
               result(st) -> null | { w: 0 | 1 | -1 (draw), text }, ai(st, level) -> move, view(holder, api) -> { draw(st, ctx) },
               flip: true when the second side should see the board turned round } */
    function duo(box, level, alive, spec) {
      var wrap = el('div', { class: 'kd kd--' + spec.id }); box.appendChild(wrap);
      var mode = 'cpu', sess = null, seat = 0, ss = [0, 1], st = null, gameN = 1, friendIn = true, busy = false, done = false, tally = [0, 0, 0], view = null, stopWatch = null;
      var join = K.net ? K.net.pending(spec.id) : '';
      function mySide() { return mode === 'net' ? ss[seat] : mode === 'cpu' ? 0 : spec.turn(st); }
      function sideName(s) {
        if (mode === 'cpu') return s === 0 ? T('You') : T('Computer');
        if (mode === 'net') return s === ss[seat] ? T('You') : T('Your friend');
        return spec.sides[s][1];
      }
      /* ---- choosing how to play ---- */
      function setup() {
        if (stopWatch) { stopWatch(); stopWatch = null; }
        wrap.innerHTML = '';
        var s = el('div', { class: 'kd-setup' });
        s.appendChild(el('h5', { class: 'kd-setup__t', text: spec.title }));
        if (spec.about) s.appendChild(el('p', { class: 'kt-note', text: spec.about }));
        s.appendChild(el('p', { class: 'kd-setup__q', text: T('Who is playing?') }));
        var row = el('div', { class: 'kd-setup__b' });
        row.appendChild(el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '💻 ' + T('Against the computer'), onclick: function () { start('cpu'); } }));
        row.appendChild(el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '👥 ' + T('2 players, one phone'), onclick: function () { start('local'); } }));
        s.appendChild(row);
        if (K.net && K.net.ok()) {
          var ns = K.net.saved(spec.id);
          if (ns) s.appendChild(el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '↻ ' + T('Continue the online game') + ' ' + ns.code, onclick: function () {
            K.net.get(ns).then(function (d) { ns.v = d.v; start('net', ns, d); }).catch(function (e) { if (e && e.why === 'gone') K.net.forget(spec.id); setup(); s.appendChild(el('p', { class: 'kg-net__msg', text: K.net.why(e) })); });
          } })]));
          s.appendChild(K.net.chooser(spec.id, function () { var w = fresh(1, [0, 1]); return K.net.create(spec.id, w).then(function (x) { start('net', x, { seats: [1, 0], state: w }); }); },
            function (c) { return K.net.join(spec.id, c).then(function (x) { start('net', x, x.data); }); }, join));
          if (join) { var jb = s.querySelector('.kg-net__join button'); join = ''; if (jb) setTimeout(function () { jb.click(); }, 50); }
        }
        if (spec.rules) s.appendChild(el('details', { class: 'kd-rules' }, [el('summary', { text: '📖 ' + T('How to play') }), el('p', { text: spec.rules })]));
        wrap.appendChild(s);
      }
      function fresh(n, sides) { return { g: spec.init(n), n: n, ss: sides, tally: tally.slice() }; }
      /* ---- the game ---- */
      var statusEl, tallyEl, netBox, endBox, board;
      function start(m, s, d) {
        mode = m; sess = s || null; seat = s ? s.seat : 0; done = false; busy = false;
        var w = d && d.state && d.state.g ? d.state : fresh(1, [0, 1]);
        st = w.g; gameN = w.n || 1; ss = w.ss || [0, 1]; if (w.tally) tally = w.tally.slice();
        friendIn = m !== 'net' || !!(d && d.seats && d.seats[1]);
        wrap.innerHTML = '';
        netBox = el('div', { class: 'kd-net' }); tallyEl = el('div', { class: 'kd-tally' });
        statusEl = el('p', { class: 'kd-status', 'aria-live': 'polite' });
        board = el('div', { class: 'kd-board' }); endBox = el('div', { class: 'kd-end', hidden: 'hidden' });
        var tools = el('div', { class: 'kt-row kd-tools' }, [
          el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: m === 'net' ? '🚪 ' + T('Leave this game') : '↩ ' + T('Choose again'), onclick: function () { if (m === 'net') K.net.forget(spec.id); setup(); } }),
          window.KJTSound && window.KJTSound.button ? window.KJTSound.button() : null
        ]);
        [netBox, tallyEl, statusEl, board, endBox, tools].forEach(function (x) { wrap.appendChild(x); });
        view = spec.view(board, { el: el, T: T, K: K, level: level });
        if (m === 'net') { drawNet(); watch(); }
        redraw(); next();
      }
      function flipFor() { return !!spec.flip && mode === 'net' && ss[seat] === 1; }
      function canAct() { return !done && !busy && friendIn && (mode === 'local' || spec.turn(st) === mySide()); }
      function redraw() {
        tallyEl.innerHTML = '';
        [0, 1].forEach(function (s) { tallyEl.appendChild(el('span', { class: 'kd-score kd-score--' + s + (!done && spec.turn(st) === s ? ' on' : '') }, [el('span', { class: 'kd-score__i', 'aria-hidden': 'true', html: spec.sides[s][0] }), el('span', { text: sideName(s) + ' ' }), el('strong', { text: String(tally[s]) })])); });
        if (tally[2]) tallyEl.appendChild(el('span', { class: 'kd-score' }, [el('span', { text: '🤝 ' + tally[2] })]));
        view.draw(st, { me: mySide(), turn: spec.turn(st), canAct: canAct(), flip: flipFor(), mode: mode, move: move, say: say, done: done });
        status();
      }
      function say(t) { statusEl.textContent = t; }
      function status() {
        if (done) return;
        var t = spec.turn(st);
        if (mode === 'net' && !friendIn) return say(T('Waiting for your friend to join…'));
        if (mode === 'cpu') return say(t === 0 ? T('Your move.') : T('The computer is thinking…'));
        if (mode === 'net') return say(t === ss[seat] ? T('Your move.') : T('Waiting for your friend’s move…'));
        say(spec.sides[t][1] + ': ' + T('your move.'));
      }
      function move(m) {
        if (!canAct()) return;
        var ok = !spec.legal || spec.legal(st).some(function (x) { return same(x, m); });
        if (!ok) return;
        st = spec.apply(st, m); K.sound(spec.sound || 'tap');
        if (mode === 'net') send();
        next();
      }
      function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
      function next() {
        var r = spec.result(st);
        redraw();
        if (r) return finish(r);
        if (mode === 'cpu' && spec.turn(st) === 1) {
          busy = true; redraw();
          setTimeout(function () {
            if (!alive() || done) return;
            var mv = spec.ai(st, level);
            busy = false;
            if (mv === null || mv === undefined) { redraw(); return; }
            st = spec.apply(st, mv); K.sound(spec.sound || 'tap'); next();
          }, spec.aiDelay || 450);
        }
      }
      function finish(r) {
        done = true; endBox.hidden = false; endBox.innerHTML = '';
        if (!finish.counted || finish.counted !== gameN + ':' + JSON.stringify(st).length) { finish.counted = gameN + ':' + JSON.stringify(st).length; tally[r.w < 0 ? 2 : r.w]++; }
        var txt;
        if (r.w < 0) { txt = T('A draw! Well played.'); K.sound('good'); }
        else if (mode === 'cpu') { txt = r.w === 0 ? T('You won the game!') : T('The computer won this time. Well played!'); K.sound(r.w === 0 ? 'success' : 'miss'); if (r.w === 0) K.award(spec.id, level); }
        else if (mode === 'net') { txt = r.w === ss[seat] ? T('You won the game!') : T('Your friend won this time. Well played!'); K.sound(r.w === ss[seat] ? 'success' : 'good'); }
        else { txt = spec.sides[r.w][1] + ' ' + T('wins the game!'); K.sound('success'); }
        say(txt);
        endBox.appendChild(el('p', { class: 'kd-end__t', text: (r.w < 0 ? '🤝 ' : '🎉 ') + txt }));
        if (r.text) endBox.appendChild(el('p', { class: 'kd-end__s', text: r.text }));
        endBox.appendChild(el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: T('Play again') + ' →', onclick: rematch })]));
        redraw();
      }
      /* the next game: online, the other player begins */
      function rematch() {
        var w = fresh(gameN + 1, mode === 'net' ? [ss[1], ss[0]] : [0, 1]);
        if (mode === 'local' && spec.swapStart) w.g = spec.swapStart(w.g, gameN);
        st = w.g; gameN = w.n; ss = w.ss; done = false; endBox.hidden = true;
        if (mode === 'net') K.net.put(sess, w).catch(function (e) { if (e && e.why === 'late' && e.data) apply(e.data); });
        next();
      }
      /* ---- online ---- */
      function wrapState() { return { g: st, n: gameN, ss: ss, tally: tally }; }
      function send() { K.net.put(sess, wrapState()).catch(function (e) { if (e && e.why === 'late' && e.data) { sess.v = e.data.v; apply(e.data); } else say(K.net.why(e)); }); }
      function apply(d) {
        var w = d.state; if (!w || !w.g) return;
        var wasMine = spec.turn(st) === ss[seat];
        if (w.n !== gameN) { done = false; endBox.hidden = true; }
        st = w.g; gameN = w.n; ss = w.ss || ss; if (w.tally) tally = w.tally.slice();
        var r = spec.result(st);
        if (r && !done) { redraw(); finish(r); return; }
        redraw();
        if (!wasMine && spec.turn(st) === ss[seat] && !done) K.net.nudge();
      }
      function drawNet() {
        netBox.innerHTML = '';
        if (!friendIn && seat === 0) netBox.appendChild(K.net.card(spec.id, sess.code, true));
        else netBox.appendChild(el('p', { class: 'kg-net__small', text: T('Online game') + ' · ' + sess.code.replace(/(...)(...)/, '$1 $2') }));
      }
      function watch() {
        stopWatch = K.net.watch(sess, function (d, unchanged) {
          if (!alive()) return;
          if (!d) { say(T('This online game has ended.')); K.net.forget(spec.id); return; }
          var was = friendIn; friendIn = !!(d.seats && d.seats[1]);
          if (friendIn !== was) { drawNet(); redraw(); if (friendIn && seat === 0) K.sound('bell'); }
          if (unchanged) return;
          apply(d);
        });
      }
      setup();
    }
    K.duo = duo;

    /* small helpers for the computer players */
    function shuffle(a) { return K.shuffle(a); }
    /* negamax with alpha-beta: spec gives moves, apply, eval (from the side to move), terminal */
    function search(st, depth, alpha, beta, g) {
      var r = g.result(st);
      if (r) return r.w < 0 ? 0 : (r.w === g.turn(st) ? 100000 + depth : -100000 - depth);
      if (depth === 0) return g.score(st);
      var ms = g.order ? g.order(st, g.legal(st)) : g.legal(st), best = -Infinity;
      for (var i = 0; i < ms.length; i++) {
        var nx = g.apply(st, ms[i]), same = g.turn(nx) === g.turn(st);
        var v = same ? search(nx, depth - 1, alpha, beta, g) : -search(nx, depth - 1, -beta, -alpha, g);
        if (v > best) best = v; if (best > alpha) alpha = best; if (alpha >= beta) break;
      }
      return best === -Infinity ? 0 : best;
    }
    function bestMove(st, depth, g, noise) {
      var ms = shuffle(g.legal(st)); if (!ms.length) return null;
      if (g.order) ms = g.order(st, ms);
      var best = -Infinity, pick = [], alpha = -Infinity;
      ms.forEach(function (m) {
        var nx = g.apply(st, m), v = g.turn(nx) === g.turn(st) ? search(nx, depth - 1, -Infinity, Infinity, g) : -search(nx, depth - 1, -Infinity, Infinity, g);
        if (noise) v += (K.rand() - 0.5) * noise;
        if (v > best + 1e-9) { best = v; pick = [m]; } else if (Math.abs(v - best) <= 1e-9) pick.push(m);
      });
      return K.pick(pick);
    }
    var DEPTH = function (level, e, m, h) { return level === 'hard' ? h : level === 'medium' ? m : e; };

    /* ======================= Loaves and Fishes (four in a row) ======================= */
    var C4W = 7, C4H = 6;
    var LOAF = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#f3c548" stroke="#b07a12" stroke-width="2"/><ellipse cx="20" cy="22" rx="11" ry="7.5" fill="#d18a2c"/><path d="M12 19c2-3 14-3 16 0" stroke="#f6d48a" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
    var FISHP = '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="#3b82c4" stroke="#1d4f80" stroke-width="2"/><path d="M9 20c4-6 13-6 17 0-4 6-13 6-17 0z" fill="#dbeafe"/><path d="M26 20l6-5v10z" fill="#dbeafe"/><circle cx="13.5" cy="19" r="1.4" fill="#1d4f80"/></svg>';
    var C4 = {
      init: function () { var b = []; for (var i = 0; i < C4W * C4H; i++) b.push(0); return { b: b, t: 0, last: -1 }; },
      turn: function (s) { return s.t; },
      legal: function (s) { var o = []; for (var c = 0; c < C4W; c++) if (!s.b[c]) o.push(c); return o; },
      apply: function (s, c) { var b = s.b.slice(), r = C4H - 1; while (r >= 0 && b[r * C4W + c]) r--; if (r < 0) return s; b[r * C4W + c] = s.t + 1; return { b: b, t: 1 - s.t, last: r * C4W + c }; },
      line: function (b) {
        var D = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (var r = 0; r < C4H; r++) for (var c = 0; c < C4W; c++) { var p = b[r * C4W + c]; if (!p) continue;
          for (var k = 0; k < 4; k++) { var cells = [r * C4W + c], ok = true;
            for (var j = 1; j < 4; j++) { var rr = r + D[k][0] * j, cc = c + D[k][1] * j; if (rr < 0 || rr >= C4H || cc < 0 || cc >= C4W || b[rr * C4W + cc] !== p) { ok = false; break; } cells.push(rr * C4W + cc); }
            if (ok) return { p: p, cells: cells }; } }
        return null;
      },
      result: function (s) { var l = C4.line(s.b); if (l) return { w: l.p - 1 }; return s.b.every(function (x) { return x; }) ? { w: -1 } : null; },
      score: function (s) {
        var me = s.t + 1, b = s.b, sc = 0, D = [[0, 1], [1, 0], [1, 1], [1, -1]];
        for (var r = 0; r < C4H; r++) { if (b[r * C4W + 3] === me) sc += 3; else if (b[r * C4W + 3]) sc -= 3; }
        for (r = 0; r < C4H; r++) for (var c = 0; c < C4W; c++) for (var k = 0; k < 4; k++) {
          var mine = 0, his = 0, ok = true;
          for (var j = 0; j < 4; j++) { var rr = r + D[k][0] * j, cc = c + D[k][1] * j; if (rr < 0 || rr >= C4H || cc < 0 || cc >= C4W) { ok = false; break; } var v = b[rr * C4W + cc]; if (v === me) mine++; else if (v) his++; }
          if (!ok || (mine && his)) continue;
          sc += mine === 3 ? 6 : mine === 2 ? 2 : 0; sc -= his === 3 ? 8 : his === 2 ? 2 : 0;
        }
        return sc;
      },
      order: function (s, ms) { return ms.slice().sort(function (a, b) { return Math.abs(a - 3) - Math.abs(b - 3); }); }
    };
    function c4(box, level, alive) {
      duo(box, level, alive, {
        id: 'c4', title: '🍞 ' + T('Loaves and Fishes'), sides: [[LOAF, T('Loaves')], [FISHP, T('Fishes')]],
        about: T('Four in a row: drop your loaves or fishes into the baskets. The first to make a line of four, across, up or slanting, wins.'),
        rules: T('Tap a column to drop your piece; it falls to the lowest free place. Make a line of four of your own pieces across, up and down, or slanting. If the board fills up first, it is a draw.'),
        init: C4.init, turn: C4.turn, legal: C4.legal, apply: C4.apply, result: C4.result,
        ai: function (s, lv) { var d = DEPTH(lv, 2, 4, 6); return bestMove(s, d, C4, lv === 'easy' ? 30 : lv === 'medium' ? 4 : 0); },
        view: function (holder) {
          var g = el('div', { class: 'kd-c4' }); holder.appendChild(g); var cells = [];
          for (var i = 0; i < C4W * C4H; i++) (function (i) { var c = el('button', { class: 'kd-c4__c', type: 'button', 'aria-label': T('Column') + ' ' + (i % C4W + 1) }); c.addEventListener('click', function () { if (api.ctx) api.ctx.move(i % C4W); }); cells.push(c); g.appendChild(c); })(i);
          var api = { draw: function (s, ctx) {
            api.ctx = ctx; var l = C4.line(s.b);
            s.b.forEach(function (v, i) { var c = cells[i]; c.innerHTML = v ? (v === 1 ? LOAF : FISHP) : ''; c.className = 'kd-c4__c' + (v ? ' p' : '') + (i === s.last ? ' last' : '') + (l && l.cells.indexOf(i) >= 0 ? ' win' : ''); c.disabled = !ctx.canAct; });
          } };
          return api;
        }
      });
    }

    /* ======================= Checkers (draughts) ======================= */
    /* 8x8, the dark squares; side 0 (light) starts at the bottom and moves up. Taking is required, several jumps
       in one move when possible; a piece that reaches the far row becomes a king (moves both ways). */
    var CK = {
      init: function () { var b = []; for (var i = 0; i < 64; i++) { var r = i >> 3, c = i & 7, dark = (r + c) % 2 === 1; b.push(!dark ? 0 : r < 3 ? 3 : r > 4 ? 1 : 0); } return { b: b, t: 0, q: 0 }; },
      turn: function (s) { return s.t; },
      side: function (p) { return p === 1 || p === 2 ? 0 : p === 3 || p === 4 ? 1 : -1; },
      king: function (p) { return p === 2 || p === 4; },
      dirs: function (p) { return CK.king(p) ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : CK.side(p) === 0 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]]; },
      jumps: function (b, from, p, path, caps, out) {
        var any = false, r = from >> 3, c = from & 7;
        [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(function (d) {
          if (!CK.king(p) && CK.dirs(p).every(function (x) { return x[0] !== d[0] || x[1] !== d[1]; })) return;
          var mr = r + d[0], mc = c + d[1], tr = r + 2 * d[0], tc = c + 2 * d[1];
          if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return;
          var mid = mr * 8 + mc, to = tr * 8 + tc;
          if (b[to] || CK.side(b[mid]) !== 1 - CK.side(p) || caps.indexOf(mid) >= 0) return;
          any = true;
          var nb = b.slice(); nb[from] = 0; nb[to] = p;
          var crowned = !CK.king(p) && ((CK.side(p) === 0 && tr === 0) || (CK.side(p) === 1 && tr === 7));
          if (crowned) out.push({ p: path.concat([to]), x: caps.concat([mid]) });
          else CK.jumps(nb, to, p, path.concat([to]), caps.concat([mid]), out);
        });
        if (!any && caps.length) out.push({ p: path, x: caps });
      },
      legal: function (s) {
        var caps = [], steps = [];
        for (var i = 0; i < 64; i++) { var p = s.b[i]; if (CK.side(p) !== s.t) continue;
          var j = []; CK.jumps(s.b, i, p, [i], [], j); caps = caps.concat(j);
          if (!caps.length) CK.dirs(p).forEach(function (d) { var r = (i >> 3) + d[0], c = (i & 7) + d[1]; if (r >= 0 && r < 8 && c >= 0 && c < 8 && !s.b[r * 8 + c]) steps.push({ p: [i, r * 8 + c], x: [] }); });
        }
        return caps.length ? caps : steps;
      },
      apply: function (s, m) {
        var b = s.b.slice(), from = m.p[0], to = m.p[m.p.length - 1], p = b[from];
        b[from] = 0; m.x.forEach(function (x) { b[x] = 0; });
        var r = to >> 3; if (p === 1 && r === 0) p = 2; if (p === 3 && r === 7) p = 4;
        b[to] = p;
        return { b: b, t: 1 - s.t, q: m.x.length || p !== s.b[from] ? 0 : s.q + 1 };
      },
      result: function (s) {
        if (!CK.legal(s).length) return { w: 1 - s.t };
        if (s.q >= 60) return { w: -1, text: T('Thirty moves each without taking a piece.') };
        return null;
      },
      score: function (s) { var sc = 0; s.b.forEach(function (p, i) { if (!p) return; var v = CK.king(p) ? 170 : 100 + (CK.side(p) === 0 ? (7 - (i >> 3)) : (i >> 3)) * 3; sc += CK.side(p) === s.t ? v : -v; }); return sc; },
      order: function (s, ms) { return ms.slice().sort(function (a, b) { return b.x.length - a.x.length; }); }
    };
    var CKP = function (side, king) { return '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="22" r="15" fill="' + (side ? '#5b1a5c' : '#f3e2b3') + '" stroke="' + (side ? '#2a0a2c' : '#a7832d') + '" stroke-width="2.5"/><circle cx="20" cy="19" r="15" fill="' + (side ? '#7d2f7e' : '#fff4d6') + '" stroke="' + (side ? '#2a0a2c' : '#a7832d') + '" stroke-width="2.5"/>' + (king ? '<path d="M12 22l2-8 4 4 2-6 2 6 4-4 2 8z" fill="#f3c548" stroke="#9a6b10" stroke-width="1.2"/>' : '<circle cx="20" cy="19" r="8" fill="none" stroke="' + (side ? '#a35aa4' : '#e2c785') + '" stroke-width="2"/>') + '</svg>'; };
    function checkers(box, level, alive) {
      duo(box, level, alive, {
        id: 'checkers', title: '⛀ ' + T('Checkers'), sides: [[CKP(0, false), T('Light pieces')], [CKP(1, false), T('Dark pieces')]], flip: true,
        about: T('Move your pieces forward on the dark squares, jump over the other side’s pieces to take them, and reach the far side to be crowned king.'),
        rules: T('Pieces move one square forward, slanting. To take, jump over an enemy piece to the empty square behind it; if you can take, you must, and you keep jumping while you can. A piece that reaches the far row becomes a king and may move backwards too. You win when the other side cannot move.'),
        init: CK.init, turn: CK.turn, legal: CK.legal, apply: CK.apply, result: CK.result,
        ai: function (s, lv) { return bestMove(s, DEPTH(lv, 2, 4, 6), CK, lv === 'easy' ? 120 : lv === 'medium' ? 20 : 0); },
        view: function (holder) {
          var g = el('div', { class: 'kd-ck' }); holder.appendChild(g); var cells = [], sel = -1, path = [], ctx0 = null, s0 = null;
          for (var i = 0; i < 64; i++) (function (i) { var c = el('button', { class: 'kd-ck__c' + (((i >> 3) + (i & 7)) % 2 ? ' dark' : ''), type: 'button' }); c.addEventListener('click', function () { tap(i); }); cells.push(c); g.appendChild(c); })(i);
          function idx(v) { return ctx0 && ctx0.flip ? 63 - v : v; }
          function cands() { return CK.legal(s0).filter(function (m) { for (var k = 0; k < path.length; k++) if (m.p[k] !== path[k]) return false; return true; }); }
          function tap(v) {
            if (!ctx0 || !ctx0.canAct) return; var i = idx(v);
            if (path.length) {
              var cs = cands().filter(function (m) { return m.p[path.length] === i; });
              if (cs.length) { path.push(i); var full = cs.filter(function (m) { return m.p.length === path.length; }); if (full.length && cands().length === full.length) { var m = full[0]; path = []; ctx0.move(m); return; } paint(); return; }
            }
            var mine = CK.side(s0.b[i]) === s0.t && CK.legal(s0).some(function (m) { return m.p[0] === i; });
            path = mine ? [i] : []; K.sound('tap'); paint();
          }
          function paint() {
            var targets = path.length ? cands().map(function (m) { return m.p[path.length]; }) : [], movable = {};
            if (ctx0 && ctx0.canAct && !path.length) CK.legal(s0).forEach(function (m) { movable[m.p[0]] = 1; });
            for (var v = 0; v < 64; v++) { var i = idx(v), p = s0.b[i], c = cells[v];
              c.innerHTML = p ? CKP(CK.side(p), CK.king(p)) : '';
              c.classList.toggle('sel', path.indexOf(i) >= 0); c.classList.toggle('to', targets.indexOf(i) >= 0); c.classList.toggle('can', !!movable[i]); }
          }
          return { draw: function (s, ctx) { s0 = s; ctx0 = ctx; path = []; paint(); } };
        }
      });
    }

    /* ======================= Mancala (Kalah) ======================= */
    /* six pits each and a store; four seeds in every pit. Sow to the right (counter-clockwise), skip the other's store;
       ending in your store: another turn; ending in an empty pit of yours: take it and the seeds opposite. */
    var MC = {
      init: function () { return { p: [4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0], t: 0, last: -1 }; },
      turn: function (s) { return s.t; },
      legal: function (s) { var o = []; for (var i = 0; i < 6; i++) { var k = s.t ? 7 + i : i; if (s.p[k]) o.push(k); } return o; },
      apply: function (s, k) {
        var p = s.p.slice(), n = p[k], i = k, mine = s.t ? 13 : 6, his = s.t ? 6 : 13; p[k] = 0;
        while (n) { i = (i + 1) % 14; if (i === his) continue; p[i]++; n--; }
        var t = 1 - s.t;
        if (i === mine) t = s.t;
        else if (p[i] === 1 && (s.t ? i >= 7 && i <= 12 : i <= 5) && p[12 - i]) { p[mine] += p[12 - i] + 1; p[12 - i] = 0; p[i] = 0; }
        var a = p.slice(0, 6).reduce(function (x, y) { return x + y; }, 0), b = p.slice(7, 13).reduce(function (x, y) { return x + y; }, 0);
        if (!a || !b) { p[6] += a; p[13] += b; for (var j = 0; j < 6; j++) { p[j] = 0; p[7 + j] = 0; } }
        return { p: p, t: t, last: i };
      },
      result: function (s) {
        var a = s.p.slice(0, 6).some(Boolean), b = s.p.slice(7, 13).some(Boolean);
        if (a && b) return null;
        return { w: s.p[6] === s.p[13] ? -1 : s.p[6] > s.p[13] ? 0 : 1, text: s.p[6] + ' – ' + s.p[13] };
      },
      score: function (s) { var d = s.p[6] - s.p[13]; return s.t ? -d : d; }
    };
    function mancala(box, level, alive) {
      duo(box, level, alive, {
        id: 'mancala', title: '🌰 ' + T('Mancala'), sides: [['🟡', T('Gold')], ['🟣', T('Purple')]], flip: true, sound: 'tap',
        about: T('An old game of the lands of the Bible, played with seeds. Sow your seeds round the board and gather the most in your store.'),
        rules: T('Tap one of your pits: its seeds are sown one by one into the next pits, your store included (not the other player’s store). If the last seed lands in your store, you play again. If it lands in an empty pit on your side, you take it and all the seeds in the pit opposite. When one side has no seeds left, the game ends; the most seeds in the store wins.'),
        init: MC.init, turn: MC.turn, legal: MC.legal, apply: MC.apply, result: MC.result,
        ai: function (s, lv) { return bestMove(s, DEPTH(lv, 2, 5, 8), MC, lv === 'easy' ? 6 : lv === 'medium' ? 1 : 0); },
        view: function (holder) {
          var g = el('div', { class: 'kd-mc' }); holder.appendChild(g); var ctx0 = null;
          var top = el('div', { class: 'kd-mc__row kd-mc__row--top' }), bot = el('div', { class: 'kd-mc__row' }), sl = el('div', { class: 'kd-mc__store kd-mc__store--l' }), sr = el('div', { class: 'kd-mc__store kd-mc__store--r' });
          g.appendChild(sl); var mid = el('div', { class: 'kd-mc__mid' }, [top, bot]); g.appendChild(mid); g.appendChild(sr);
          function seeds(n) { var h = ''; for (var i = 0; i < Math.min(n, 12); i++) h += '<i></i>'; return '<span class="kd-mc__seeds">' + h + '</span><b>' + n + '</b>'; }
          function pit(k, s, ctx) { var b = el('button', { class: 'kd-mc__pit' + (k === s.last ? ' last' : ''), type: 'button', html: seeds(s.p[k]) }); var mine = ctx.mode === 'local' ? (k < 6 ? 0 : 1) === s.t : (k < 6 ? 0 : 1) === ctx.me; b.disabled = !ctx.canAct || !mine || !s.p[k] || (k < 6 ? 0 : 1) !== s.t; b.addEventListener('click', function () { ctx.move(k); }); return b; }
          return { draw: function (s, ctx) {
            ctx0 = ctx; top.innerHTML = ''; bot.innerHTML = '';
            var me = ctx.flip ? 1 : 0, low = me ? 7 : 0, high = me ? 0 : 7;
            for (var i = 0; i < 6; i++) bot.appendChild(pit(low + i, s, ctx));
            for (i = 5; i >= 0; i--) top.appendChild(pit(high + i, s, ctx));
            sr.innerHTML = seeds(s.p[me ? 13 : 6]); sl.innerHTML = seeds(s.p[me ? 6 : 13]);
            sr.className = 'kd-mc__store kd-mc__store--r s' + me; sl.className = 'kd-mc__store kd-mc__store--l s' + (1 - me);
            bot.className = 'kd-mc__row s' + me; top.className = 'kd-mc__row kd-mc__row--top s' + (1 - me);
          } };
        }
      });
    }

    /* ======================= Nine Men's Morris ======================= */
    var NM_ADJ = [[1, 9], [0, 2, 4], [1, 14], [4, 10], [1, 3, 5, 7], [4, 13], [7, 11], [4, 6, 8], [7, 12], [0, 10, 21], [3, 9, 11, 18], [6, 10, 15], [8, 13, 17], [5, 12, 14, 20], [2, 13, 23], [11, 16], [15, 17, 19], [12, 16], [10, 19], [16, 18, 20, 22], [13, 19], [9, 22], [19, 21, 23], [14, 22]];
    var NM_MILLS = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [9, 10, 11], [12, 13, 14], [15, 16, 17], [18, 19, 20], [21, 22, 23], [0, 9, 21], [3, 10, 18], [6, 11, 15], [1, 4, 7], [16, 19, 22], [8, 12, 17], [5, 13, 20], [2, 14, 23]];
    var NM_XY = [[0, 0], [3, 0], [6, 0], [1, 1], [3, 1], [5, 1], [2, 2], [3, 2], [4, 2], [0, 3], [1, 3], [2, 3], [4, 3], [5, 3], [6, 3], [2, 4], [3, 4], [4, 4], [1, 5], [3, 5], [5, 5], [0, 6], [3, 6], [6, 6]];
    var NM = {
      init: function () { var b = []; for (var i = 0; i < 24; i++) b.push(0); return { b: b, h: [9, 9], t: 0, q: 0 }; },
      turn: function (s) { return s.t; },
      inMill: function (b, i) { return NM_MILLS.some(function (m) { return m.indexOf(i) >= 0 && b[m[0]] && b[m[0]] === b[m[1]] && b[m[1]] === b[m[2]]; }); },
      count: function (b, p) { return b.filter(function (x) { return x === p; }).length; },
      legal: function (s) {
        var me = s.t + 1, him = 2 - s.t, b = s.b, out = [], steps = [];
        if (s.h[s.t]) { for (var i = 0; i < 24; i++) if (!b[i]) steps.push([-1, i]); }
        else { var fly = NM.count(b, me) === 3;
          for (i = 0; i < 24; i++) if (b[i] === me) (fly ? b.map(function (x, j) { return x ? -1 : j; }).filter(function (j) { return j >= 0; }) : NM_ADJ[i].filter(function (j) { return !b[j]; })).forEach(function (j) { steps.push([i, j]); }); }
        var his = [], free = []; for (i = 0; i < 24; i++) if (b[i] === him) { his.push(i); if (!NM.inMill(b, i)) free.push(i); }
        if (!free.length) free = his;
        steps.forEach(function (st) { var nb = b.slice(); if (st[0] >= 0) nb[st[0]] = 0; nb[st[1]] = me;
          var mill = NM_MILLS.some(function (m) { return m.indexOf(st[1]) >= 0 && nb[m[0]] === me && nb[m[1]] === me && nb[m[2]] === me; });
          if (mill && free.length) free.forEach(function (r) { out.push({ f: st[0], t: st[1], r: r }); }); else out.push({ f: st[0], t: st[1], r: -1 }); });
        return out;
      },
      apply: function (s, m) { var b = s.b.slice(), h = s.h.slice(); if (m.f >= 0) b[m.f] = 0; else h[s.t]--; b[m.t] = s.t + 1; if (m.r >= 0) b[m.r] = 0; return { b: b, h: h, t: 1 - s.t, q: m.r >= 0 ? 0 : s.q + 1, last: m.t }; },
      result: function (s) {
        for (var p = 0; p < 2; p++) if (!s.h[p] && NM.count(s.b, p + 1) < 3) return { w: 1 - p };
        if (!NM.legal(s).length) return { w: 1 - s.t };
        if (s.q >= 80) return { w: -1, text: T('Forty moves each without a mill.') };
        return null;
      },
      score: function (s) {
        var me = s.t + 1, him = 2 - s.t, b = s.b, sc = (NM.count(b, me) + s.h[s.t] - NM.count(b, him) - s.h[1 - s.t]) * 30;
        NM_MILLS.forEach(function (m) { var a = 0, o = 0; m.forEach(function (i) { if (b[i] === me) a++; else if (b[i] === him) o++; }); if (!o && a === 2) sc += 6; if (!a && o === 2) sc -= 6; if (a === 3) sc += 4; if (o === 3) sc -= 4; });
        return sc;
      },
      order: function (s, ms) { return ms.slice().sort(function (a, b) { return (b.r >= 0) - (a.r >= 0); }); }
    };
    function morris(box, level, alive) {
      duo(box, level, alive, {
        id: 'morris', title: '⚪ ' + T('Nine Men’s Morris'), sides: [['<span class="kd-nm__dot kd-nm__dot--0"></span>', T('White')], ['<span class="kd-nm__dot kd-nm__dot--1"></span>', T('Black')]],
        about: T('One of the oldest board games in the world, played in the times of the Bible. Make rows of three to take the other player’s pieces.'),
        rules: T('First, take turns placing your nine pieces on the points. Then move a piece along a line to a free point next to it. Three of your pieces in a row along a line is a mill: then take one of the other player’s pieces (not one in a mill, unless all are). With only three pieces left, you may jump to any free point. You win when the other player has only two pieces, or cannot move.'),
        init: NM.init, turn: NM.turn, legal: NM.legal, apply: NM.apply, result: NM.result, aiDelay: 550,
        ai: function (s, lv) { return bestMove(s, DEPTH(lv, 1, 2, 3), NM, lv === 'easy' ? 40 : lv === 'medium' ? 6 : 0); },
        view: function (holder) {
          var NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '-0.6 -0.6 7.2 7.2'); svg.setAttribute('class', 'kd-nm');
          var lines = ''; [[0, 6], [1, 5], [2, 4]].forEach(function (q) { lines += '<rect x="' + q[0] + '" y="' + q[0] + '" width="' + (q[1] - q[0]) + '" height="' + (q[1] - q[0]) + '" />'; });
          lines += '<path d="M3 0V2M3 4V6M0 3H2M4 3H6"/>';
          svg.innerHTML = '<g class="kd-nm__lines">' + lines + '</g>';
          var hands = el('div', { class: 'kd-nm__hands' }); holder.appendChild(hands); holder.appendChild(svg);
          var pts = [], s0 = null, ctx0 = null, from = -1, pend = null;
          NM_XY.forEach(function (xy, i) { var c = document.createElementNS(NS, 'circle'); c.setAttribute('cx', xy[0]); c.setAttribute('cy', xy[1]); c.setAttribute('r', '0.32'); c.addEventListener('click', function () { tap(i); }); svg.appendChild(c); pts.push(c); });
          function tap(i) {
            if (!ctx0 || !ctx0.canAct) return; var L = NM.legal(s0);
            if (pend) { var m = L.filter(function (x) { return x.f === pend.f && x.t === pend.t && x.r === i; })[0]; if (m) { pend = null; from = -1; ctx0.move(m); } return; }
            if (s0.h[s0.t]) { var ms = L.filter(function (x) { return x.t === i; }); if (!ms.length) return; if (ms[0].r < 0) { ctx0.move(ms[0]); return; } pend = { f: -1, t: i }; ctx0.say(T('A mill! Tap a piece of the other player to take it.')); paint(); return; }
            if (from >= 0) { var ms2 = L.filter(function (x) { return x.f === from && x.t === i; }); if (ms2.length) { if (ms2[0].r < 0) { from = -1; ctx0.move(ms2[0]); return; } pend = { f: from, t: i }; ctx0.say(T('A mill! Tap a piece of the other player to take it.')); paint(); return; } }
            from = L.some(function (x) { return x.f === i; }) ? i : -1; K.sound('tap'); paint();
          }
          function paint() {
            var L = ctx0 && ctx0.canAct ? NM.legal(s0) : [], b = s0.b.slice();
            if (pend) { if (pend.f >= 0) b[pend.f] = 0; b[pend.t] = s0.t + 1; }
            pts.forEach(function (c, i) { var p = b[i], cls = 'kd-nm__pt' + (p ? ' p' + p : '');
              if (pend && L.some(function (x) { return x.f === pend.f && x.t === pend.t && x.r === i; })) cls += ' take';
              else if (!pend && from >= 0 && L.some(function (x) { return x.f === from && x.t === i; })) cls += ' to';
              else if (!pend && from < 0 && L.some(function (x) { return s0.h[s0.t] ? x.t === i : x.f === i; })) cls += ' can';
              if (i === from) cls += ' sel'; if (i === s0.last) cls += ' last';
              c.setAttribute('class', cls); c.setAttribute('r', p ? '0.36' : '0.2'); });
            hands.innerHTML = '';
            [0, 1].forEach(function (p) { hands.appendChild(el('span', { class: 'kd-nm__hand' }, [el('span', { html: '<span class="kd-nm__dot kd-nm__dot--' + p + '"></span>' }), el('span', { text: ' × ' + s0.h[p] })])); });
          }
          return { draw: function (s, ctx) { s0 = s; ctx0 = ctx; from = -1; pend = null; paint(); } };
        }
      });
    }

    /* ======================= Tavli (backgammon, Portes) ======================= */
    /* 24 points; side 0 moves from point 24 to 1 (indices 23 -> 0) and bears off from 0-5; side 1 the other way
       (0 -> 23, home 18-23). The board holds signed counts: + side 0, - side 1. A turn: roll, then move one checker
       at a time; as many dice as possible must be used (with one die only, the higher one if possible). */
    var TV = {
      init: function () { var b = []; for (var i = 0; i < 24; i++) b.push(0); b[23] = 2; b[12] = 5; b[7] = 3; b[5] = 5; b[0] = -2; b[11] = -5; b[16] = -3; b[18] = -5; return { b: b, bar: [0, 0], off: [0, 0], t: 0, d: [], r: false }; },
      turn: function (s) { return s.t; },
      sg: function (t) { return t ? -1 : 1; },
      own: function (s, i, t) { return TV.sg(t) * s.b[i] > 0; },
      home: function (s, t) { if (s.bar[t]) return false; for (var i = 0; i < 24; i++) { var inHome = t ? i >= 18 : i <= 5; if (!inHome && TV.own(s, i, t)) return false; } return true; },
      /* single moves with one die: [from, to, die]; from 'B' = the bar, to 'O' = off */
      singles: function (s, t, die) {
        var out = [], g = TV.sg(t);
        function open(to) { return g * s.b[to] >= -1; }
        if (s.bar[t]) { var e = t ? die - 1 : 24 - die; if (open(e)) out.push(['B', e, die]); return out; }
        var canOff = TV.home(s, t);
        for (var i = 0; i < 24; i++) { if (!TV.own(s, i, t)) continue;
          var to = t ? i + die : i - die;
          if (to >= 0 && to < 24) { if (open(to)) out.push([i, to, die]); continue; }
          if (!canOff) continue;
          var exact = t ? to === 24 : to === -1;
          if (exact) { out.push([i, 'O', die]); continue; }
          var farther = false; for (var j = 0; j < 24; j++) if (TV.own(s, j, t) && (t ? (j >= 18 && j < i) : (j <= 5 && j > i))) farther = true;
          if (!farther) out.push([i, 'O', die]);
        }
        return out;
      },
      step: function (s, m) {
        var b = s.b.slice(), bar = s.bar.slice(), off = s.off.slice(), t = s.t, g = TV.sg(t), d = s.d.slice();
        if (m[0] === 'B') bar[t]--; else b[m[0]] -= g;
        if (m[1] === 'O') off[t]++; else { if (g * b[m[1]] === -1) { b[m[1]] = 0; bar[1 - t]++; } b[m[1]] += g; }
        d.splice(d.indexOf(m[2]), 1);
        return { b: b, bar: bar, off: off, t: t, d: d, r: true };
      },
      seqs: function (s) {
        var all = [];
        (function go(st, path) {
          var any = false, seen = {};
          st.d.forEach(function (die) { if (seen[die]) return; seen[die] = 1;
            TV.singles(st, st.t, die).forEach(function (m) { any = true; go(TV.step(st, m), path.concat([m])); }); });
          if (!any) all.push({ p: path, s: st });
        })(s, []);
        var max = 0; all.forEach(function (x) { if (x.p.length > max) max = x.p.length; });
        var best = all.filter(function (x) { return x.p.length === max; });
        if (max === 1 && s.d.length === 2 && s.d[0] !== s.d[1]) { var hi = Math.max(s.d[0], s.d[1]); var withHi = best.filter(function (x) { return x.p[0][2] === hi; }); if (withHi.length) best = withHi; }
        return best;
      },
      legal: function (s) {
        if (!s.r) return [{ roll: 1 }];
        var sq = TV.seqs(s), out = [], seen = {};
        sq.forEach(function (x) { if (!x.p.length) return; var k = JSON.stringify(x.p[0]); if (!seen[k]) { seen[k] = 1; out.push({ m: x.p[0] }); } });
        return out.length ? out : [{ pass: 1 }];
      },
      apply: function (s, mv) {
        if (mv.roll) { var a = 1 + Math.floor(Math.random() * 6), b = 1 + Math.floor(Math.random() * 6); var n = { b: s.b, bar: s.bar, off: s.off, t: s.t, d: a === b ? [a, a, a, a] : [a, b], r: true, rolled: [a, b] }; return n; }
        if (mv.pass) return { b: s.b, bar: s.bar, off: s.off, t: 1 - s.t, d: [], r: false, rolled: s.rolled };
        var n2 = TV.step(s, mv.m); n2.rolled = s.rolled; n2.last = mv.m;
        if (n2.off[s.t] === 15) return n2;
        if (!n2.d.length || !TV.seqs(n2).some(function (x) { return x.p.length; })) { n2.t = 1 - s.t; n2.d = []; n2.r = false; }
        return n2;
      },
      result: function (s) { if (s.off[0] === 15) return { w: 0, text: s.off[1] ? '' : T('A double win (mars): the other side had not borne off any checker.') }; if (s.off[1] === 15) return { w: 1, text: s.off[0] ? '' : T('A double win (mars): the other side had not borne off any checker.') }; return null; },
      /* how good a position is for side t */
      eval: function (st, t) {
        var g = TV.sg(t), pip = [0, 0], blots = 0, made = 0, sc = 0;
        for (var i = 0; i < 24; i++) { var v = st.b[i]; if (v > 0) pip[0] += v * (i + 1); if (v < 0) pip[1] += -v * (24 - i);
          if (g * v === 1) { var risk = 0; for (var j = 0; j < 24; j++) if (g * st.b[j] < 0) { var dist = t ? i - j : j - i; if (dist > 0 && dist <= 12) risk += dist <= 6 ? 2 : 1; } blots += risk; }
          if (g * v >= 2) { made++; if (t ? i >= 18 : i <= 5) made += 1.5; } }
        pip[0] += st.bar[0] * 25; pip[1] += st.bar[1] * 25;
        sc = (t ? pip[0] - pip[1] : pip[1] - pip[0]) * 1.2 + made * 4 - blots * 3 + (st.off[t] - st.off[1 - t]) * 8 + st.bar[1 - t] * 12 - st.bar[t] * 12;
        return sc;
      }
    };
    var TV_PLAN = { key: '', moves: [] };
    function tavliAI(s, lv) {
      if (!s.r) return { roll: 1 };
      var key = JSON.stringify(s);
      if (TV_PLAN.key === key && TV_PLAN.moves.length) { var m = TV_PLAN.moves.shift(); TV_PLAN.key = JSON.stringify(TV.apply(s, { m: m })); return { m: m }; }
      var sq = TV.seqs(s); if (!sq.length || !sq[0].p.length) return { pass: 1 };
      var scored = sq.map(function (x) { return { x: x, v: TV.eval(x.s, s.t) + (lv === 'easy' ? (Math.random() - 0.5) * 60 : lv === 'medium' ? (Math.random() - 0.5) * 10 : 0) }; }).sort(function (a, b) { return b.v - a.v; });
      var pick = scored[0].x.p.slice(), first = pick.shift();
      TV_PLAN.moves = pick; var nx = TV.apply(s, { m: first }); TV_PLAN.key = JSON.stringify(nx);
      return { m: first };
    }
    var TVC = function (side) { return '<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="' + (side ? '#5b1a5c' : '#fff6dc') + '" stroke="' + (side ? '#2a0a2c' : '#a7832d') + '" stroke-width="3"/><circle cx="20" cy="20" r="9" fill="none" stroke="' + (side ? '#a35aa4' : '#e2c785') + '" stroke-width="2"/></svg>'; };
    var DIE = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
    function tavli(box, level, alive) {
      duo(box, level, alive, {
        id: 'tavli', title: '🎲 ' + T('Tavli (backgammon)'), sides: [[TVC(0), T('Light pieces')], [TVC(1), T('Dark pieces')]], flip: true, aiDelay: 650,
        about: T('The board game loved in Greek, Arab and Russian homes: race your fifteen checkers round the board and bear them off first.'),
        rules: T('Roll the dice and move your checkers forward by the numbers shown, one checker per die (a double plays four times). You may not land on a point with two or more of the other side’s checkers; landing on a single one sends it to the bar, and it must come in again before anything else moves. When all your checkers are in your home (the last six points), bear them off. Use as many dice as you can. The first to bear off all fifteen wins.'),
        init: TV.init, turn: TV.turn, legal: TV.legal, apply: TV.apply, result: TV.result, sound: 'tap',
        ai: function (s, lv) { return tavliAI(s, lv); },
        view: function (holder) {
          var top = el('div', { class: 'kd-tv__row kd-tv__row--top' }), bot = el('div', { class: 'kd-tv__row' }), bar = el('div', { class: 'kd-tv__bar' }), offB = el('button', { class: 'kd-tv__off', type: 'button' });
          var dice = el('div', { class: 'kd-tv__dice' }), rollB = el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '🎲 ' + T('Roll the dice') }), passB = el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: T('No move possible: pass the dice') });
          var g = el('div', { class: 'kd-tv' }, [el('div', { class: 'kd-tv__field' }, [top, bar, bot]), offB]);
          holder.appendChild(g); holder.appendChild(el('div', { class: 'kd-tv__ctl' }, [dice, rollB, passB]));
          var s0 = null, ctx0 = null, from = null;
          rollB.addEventListener('click', function () { if (ctx0) { K.sound('dice'); ctx0.move({ roll: 1 }); } });
          passB.addEventListener('click', function () { if (ctx0) ctx0.move({ pass: 1 }); });
          offB.addEventListener('click', function () { tapTo('O'); });
          function legal() { return s0 && ctx0 && ctx0.canAct && s0.r ? TV.legal(s0).filter(function (x) { return x.m; }).map(function (x) { return x.m; }) : []; }
          function tapFrom(f) { var L = legal(); if (!L.some(function (m) { return m[0] === f; })) { from = null; paint(); return; } from = f; K.sound('tap'); paint(); }
          function tapTo(to) {
            var L = legal(); if (from === null) return;
            var ms = L.filter(function (m) { return m[0] === from && m[1] === to; }); if (!ms.length) return;
            ms.sort(function (a, b) { return a[2] - b[2]; }); var m = ms[0]; from = null; ctx0.move({ m: m });
          }
          function point(i) {
            var v = s0.b[i], n = Math.abs(v), side = v < 0 ? 1 : 0, L = legal();
            var b = el('button', { class: 'kd-tv__pt' + (i % 2 ? ' odd' : '') + (from === i ? ' sel' : '') + (L.some(function (m) { return m[0] === from && m[1] === i; }) ? ' to' : '') + (from === null && L.some(function (m) { return m[0] === i; }) ? ' can' : '') + (s0.last && s0.last[1] === i ? ' last' : ''), type: 'button', 'aria-label': T('Point') + ' ' + (s0.t || !ctx0.flip ? 24 - i : i + 1) });
            var stack = el('span', { class: 'kd-tv__stack' });
            for (var k = 0; k < Math.min(n, 5); k++) stack.appendChild(el('span', { class: 'kd-tv__ck', html: TVC(side) }));
            if (n > 5) stack.appendChild(el('b', { class: 'kd-tv__n', text: String(n) }));
            b.appendChild(stack);
            b.addEventListener('click', function () { if (from !== null && L.some(function (m) { return m[0] === from && m[1] === i; })) tapTo(i); else tapFrom(i); });
            return b;
          }
          function paint() {
            top.innerHTML = ''; bot.innerHTML = ''; bar.innerHTML = '';
            var me = ctx0.flip ? 1 : 0;
            /* side 0 at the bottom: the bottom row shows points 12..1 (indices 11..0) from left to right; flipped for side 1 */
            var botIdx = [], topIdx = [];
            for (var k = 0; k < 12; k++) { botIdx.push(11 - k); topIdx.push(12 + k); }
            if (me) { botIdx = botIdx.map(function (i) { return 23 - i; }); topIdx = topIdx.map(function (i) { return 23 - i; }); }
            botIdx.forEach(function (i, k) { if (k === 6) bot.appendChild(el('span', { class: 'kd-tv__gap' })); bot.appendChild(point(i)); });
            topIdx.forEach(function (i, k) { if (k === 6) top.appendChild(el('span', { class: 'kd-tv__gap' })); top.appendChild(point(i)); });
            var L = legal();
            [0, 1].forEach(function (sd) { if (!s0.bar[sd]) return; var bb = el('button', { class: 'kd-tv__barck' + (from === 'B' && sd === s0.t ? ' sel' : '') + (from === null && sd === s0.t && L.some(function (m) { return m[0] === 'B'; }) ? ' can' : ''), type: 'button', html: TVC(sd) + '<b>' + s0.bar[sd] + '</b>' }); bb.addEventListener('click', function () { if (sd === s0.t) tapFrom('B'); }); bar.appendChild(bb); });
            offB.innerHTML = '<span>' + T('Off') + '</span>' + [me, 1 - me].map(function (sd) { return '<span class="kd-tv__offn">' + TVC(sd) + '<b>' + s0.off[sd] + '</b></span>'; }).join('');
            offB.classList.toggle('to', L.some(function (m) { return m[0] === from && m[1] === 'O'; }));
            dice.innerHTML = '';
            if (s0.r && s0.rolled) { var left = s0.d.slice(); (s0.rolled[0] === s0.rolled[1] ? [s0.rolled[0], s0.rolled[0], s0.rolled[0], s0.rolled[0]] : s0.rolled).forEach(function (v) { var k2 = left.indexOf(v), used = k2 < 0; if (!used) left.splice(k2, 1); dice.appendChild(el('span', { class: 'kd-tv__die' + (used ? ' used' : ''), text: DIE[v] })); }); }
            var mine = ctx0.canAct;
            rollB.hidden = !(mine && !s0.r); passB.hidden = !(mine && s0.r && TV.legal(s0)[0].pass);
          }
          return { draw: function (s, ctx) { s0 = s; ctx0 = ctx; from = null; paint(); } };
        }
      });
    }

    /* ======================= Word Hunt (inspired by Lexica) ======================= */
    /* A grid of letters; find words by joining letters that touch (across, up and down, slanting), each square once.
       Alone, two players on one phone (the same board, one after the other), or with a friend online (the same
       board on both phones; the scores are compared when both have played). English words. */
    var WH_DICT = null, WH_LOADING = null;
    function whDict() {
      if (WH_DICT) return Promise.resolve(WH_DICT);
      if (WH_LOADING) return WH_LOADING;
      WH_LOADING = fetch(BASE + 'wordbuilder-words.txt?ver=3', { credentials: 'same-origin' }).then(function (r) { if (!r.ok) throw new Error('dict'); return r.text(); }).then(function (txt) {
        var lines = txt.split('\n'), prev = '', root = {};
        for (var i = 0; i < lines.length; i++) { var L = lines[i]; if (!L) continue; var k = L.charCodeAt(0) - 48, w = prev.slice(0, k) + L.slice(1); prev = w;
          if (w.length < 3 || w.length > 16 || !/^[a-z]+$/.test(w)) continue;
          var n = root; for (var j = 0; j < w.length; j++) { var c = w[j]; n = n[c] || (n[c] = {}); } n.$ = 1; }
        WH_DICT = root; return root;
      }).catch(function (e) { WH_LOADING = null; throw e; });
      return WH_LOADING;
    }
    function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
    var WH_FREQ = 'eeeeeeeeeeeeaaaaaaaaaiiiiiiiioooooooonnnnnnrrrrrrttttttllllssssuuuuddddgggbbccmmppffhhvvwwyykjxqz';
    function whBoard(seed, n) {
      var r = mulberry(seed), b = [], vow = 0;
      for (var i = 0; i < n * n; i++) { var c = WH_FREQ[Math.floor(r() * WH_FREQ.length)]; b.push(c); if ('aeiou'.indexOf(c) >= 0) vow++; }
      var need = Math.round(n * n * 0.35);
      while (vow < need) { var k = Math.floor(r() * b.length); if ('aeiou'.indexOf(b[k]) < 0) { b[k] = 'aeiou'[Math.floor(r() * 5)]; vow++; } }
      return b;
    }
    function whNear(n, a, b) { var ar = Math.floor(a / n), ac = a % n, br = Math.floor(b / n), bc = b % n; return a !== b && Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1; }
    function whTile(c) { return c === 'q' ? 'qu' : c; }
    function whSolve(dict, b, n) {
      var found = {}, used = [];
      function go(i, node, w) {
        var t = whTile(b[i]); for (var k = 0; k < t.length; k++) { node = node[t[k]]; if (!node) return; } w += t;
        if (node.$ && w.length >= 3) found[w] = 1;
        used[i] = 1;
        for (var j = 0; j < b.length; j++) if (!used[j] && whNear(n, i, j)) go(j, node, w);
        used[i] = 0;
      }
      for (var i = 0; i < b.length; i++) go(i, dict, '');
      return Object.keys(found);
    }
    function whPoints(w) { var l = w.length; return l <= 4 ? 1 : l === 5 ? 2 : l === 6 ? 3 : l === 7 ? 5 : 11; }
    function wordHunt(box, level, alive) {
      var SIZE = level === 'easy' ? 4 : 5, TIME = level === 'hard' ? 120 : 180;
      var wrap = el('div', { class: 'kd kd--hunt' }); box.appendChild(wrap);
      var join = K.net ? K.net.pending('hunt') : '', stopWatch = null;
      var wait = el('p', { class: 'kgm-wait', role: 'status' }, [el('span', { class: 'kgm-spin', 'aria-hidden': 'true' }), el('span', { text: T('Opening the dictionary…') })]);
      wrap.appendChild(wait);
      whDict().then(function (dict) { if (!alive()) return; wait.remove(); setup(dict); }).catch(function () { wait.textContent = T('The dictionary could not be loaded. Press New game to try again.'); });
      function setup(dict) {
        if (stopWatch) { stopWatch(); stopWatch = null; }
        wrap.innerHTML = '';
        var s = el('div', { class: 'kd-setup' });
        s.appendChild(el('h5', { class: 'kd-setup__t', text: '🔤 ' + T('Word Hunt') }));
        s.appendChild(el('p', { class: 'kt-note', text: T('Find as many words as you can in the grid before the time runs out: join letters that touch, across, up and down or slanting.') }));
        s.appendChild(el('p', { class: 'kd-setup__q', text: T('Who is playing?') }));
        s.appendChild(el('div', { class: 'kd-setup__b' }, [
          el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '🙂 ' + T('Just me'), onclick: function () { round(dict, { mode: 'solo', seed: (Math.random() * 1e9) | 0 }); } }),
          el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '👥 ' + T('2 players, one phone'), onclick: function () { round(dict, { mode: 'local', seed: (Math.random() * 1e9) | 0, p: 0, res: [] }); } })
        ]));
        if (K.net && K.net.ok()) {
          var ns = K.net.saved('hunt');
          if (ns) s.appendChild(el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '↻ ' + T('Continue the online game') + ' ' + ns.code, onclick: function () { K.net.get(ns).then(function (d) { ns.v = d.v; online(dict, ns, d); }).catch(function (e) { if (e && e.why === 'gone') K.net.forget('hunt'); setup(dict); }); } })]));
          s.appendChild(K.net.chooser('hunt', function () { var st = { seed: (Math.random() * 1e9) | 0, size: SIZE, time: TIME, res: {} }; return K.net.create('hunt', st).then(function (x) { online(dict, x, { seats: [1, 0], state: st }); }); },
            function (c) { return K.net.join('hunt', c).then(function (x) { online(dict, x, x.data); }); }, join));
          if (join) { var jb = s.querySelector('.kg-net__join button'); join = ''; if (jb) setTimeout(function () { jb.click(); }, 50); }
        }
        s.appendChild(el('details', { class: 'kd-rules' }, [el('summary', { text: '📖 ' + T('How to play') }), el('p', { text: T('Drag your finger across letters that touch, or tap them one after another and tap the last letter again. Words have at least 3 letters; each square once per word. Points: 3 or 4 letters 1, 5 letters 2, 6 letters 3, 7 letters 5, 8 or more 11. The Word Hunt is inspired by Lexica, a free word game for Android.') })]));
        wrap.appendChild(s);
      }
      /* one board, played once */
      function play(dict, seed, size, time, title, done) {
        wrap.innerHTML = '';
        var b = whBoard(seed, size), all = whSolve(dict, b, size), found = [], score = 0, left = time, path = [], over = false;
        var head = el('div', { class: 'kd-wh__head' }), timer = el('strong', { class: 'kd-wh__time' }), sc = el('strong'), cur = el('p', { class: 'kd-wh__cur', 'aria-live': 'polite' });
        head.appendChild(el('span', { class: 'kd-score' }, [el('span', { text: '⏱ ' }), timer]));
        head.appendChild(el('span', { class: 'kd-score' }, [el('span', { text: '⭐ ' + T('Points') + ' ' }), sc]));
        head.appendChild(el('span', { class: 'kd-score' }, [el('span', { text: '🔎 ' + all.length + ' ' + T('words to find') })]));
        if (title) wrap.appendChild(el('p', { class: 'kd-status', text: title }));
        wrap.appendChild(head); wrap.appendChild(cur);
        var grid = el('div', { class: 'kd-wh', style: 'grid-template-columns:repeat(' + size + ',1fr)' }); wrap.appendChild(grid);
        var tiles = b.map(function (c, i) { var t = el('div', { class: 'kd-wh__t', 'data-i': String(i), text: whTile(c).replace(/^./, function (x) { return x.toUpperCase(); }) }); grid.appendChild(t); return t; });
        var list = el('div', { class: 'kd-wh__found' }); wrap.appendChild(list);
        function word() { return path.map(function (i) { return whTile(b[i]); }).join(''); }
        function paint() { tiles.forEach(function (t, i) { t.classList.toggle('on', path.indexOf(i) >= 0); t.classList.toggle('end', path[path.length - 1] === i); }); cur.textContent = path.length ? word().toUpperCase() : ' '; sc.textContent = String(score); }
        function add(i) {
          if (over) return; var k = path.indexOf(i);
          if (k >= 0) { if (k === path.length - 2) { path.pop(); paint(); } return; }
          if (path.length && !whNear(size, path[path.length - 1], i)) return;
          path.push(i); K.sound('tap'); paint();
        }
        function submit() {
          var w = word(); path = [];
          if (w.length >= 3 && all.indexOf(w) >= 0 && found.indexOf(w) < 0) { found.push(w); score += whPoints(w); K.sound('good'); cur.textContent = '✓ ' + w.toUpperCase() + ' +' + whPoints(w); list.insertBefore(el('span', { class: 'kd-wh__w', text: w.toUpperCase() }), list.firstChild); }
          else if (w.length >= 3) { K.sound('miss'); cur.textContent = found.indexOf(w) >= 0 ? T('Already found') + ': ' + w.toUpperCase() : w.toUpperCase() + ': ' + T('not a word here'); }
          else cur.textContent = ' ';
          tiles.forEach(function (t) { t.classList.remove('on', 'end'); }); sc.textContent = String(score);
        }
        /* drag across the letters, or tap them (tap the last one again to send the word) */
        var dragging = false, moved = false;
        function at(e) { var t = document.elementFromPoint(e.clientX, e.clientY); t = t && t.closest && t.closest('.kd-wh__t'); if (!t) return -1; var r = t.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); return Math.sqrt(dx * dx + dy * dy) < r.width * 0.42 ? +t.getAttribute('data-i') : -1; }
        grid.addEventListener('pointerdown', function (e) { var i = at(e); if (i < 0) return; e.preventDefault(); try { grid.setPointerCapture(e.pointerId); } catch (x) {} dragging = true; moved = false;
          if (path.length && path[path.length - 1] === i) { submit(); dragging = false; return; }
          if (path.length && !whNear(size, path[path.length - 1], i)) path = [];
          add(i); });
        grid.addEventListener('pointermove', function (e) { if (!dragging) return; var i = at(e); if (i >= 0 && i !== path[path.length - 1]) { moved = true; add(i); } });
        grid.addEventListener('pointerup', function () { if (dragging && moved && path.length >= 2) submit(); dragging = false; });
        grid.style.touchAction = 'none';
        var tick = setInterval(function () {
          if (!alive()) { clearInterval(tick); return; }
          left--; timer.textContent = Math.floor(left / 60) + ':' + ('0' + left % 60).slice(-2);
          if (left <= 10 && left > 0) K.sound('tap');
          if (left <= 0) { clearInterval(tick); over = true; path = []; paint(); K.sound('bell'); done({ score: score, words: found.slice(), all: all }); }
        }, 1000);
        K.onLeave(function () { clearInterval(tick); });
        timer.textContent = Math.floor(left / 60) + ':' + ('0' + left % 60).slice(-2); paint();
      }
      function showWords(box2, r, other) {
        var mine = el('div', { class: 'kd-wh__found' });
        r.words.forEach(function (w) { mine.appendChild(el('span', { class: 'kd-wh__w' + (other && other.indexOf(w) >= 0 ? ' both' : ''), text: w.toUpperCase() })); });
        box2.appendChild(mine);
        var missed = r.all.filter(function (w) { return r.words.indexOf(w) < 0; }).sort(function (a, b) { return b.length - a.length; }).slice(0, 12);
        if (missed.length) box2.appendChild(el('p', { class: 'kd-wh__miss', text: T('Some words you could have found') + ': ' + missed.map(function (w) { return w.toUpperCase(); }).join(', ') }));
      }
      function again(dict) { return el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: T('Play again') + ' →', onclick: function () { setup(dict); } })]); }
      function round(dict, o) {
        if (o.mode === 'solo') return play(dict, o.seed, SIZE, TIME, '', function (r) {
          var end = el('div', { class: 'kd-end' }, [el('p', { class: 'kd-end__t', text: '⭐ ' + r.score + ' ' + T('points') + ' · ' + r.words.length + ' / ' + r.all.length + ' ' + T('words') })]);
          var best = K.best('hunt', level, r.score, 'high'); if (best.isNew) end.appendChild(el('p', { text: T('A new personal best!') }));
          if (r.score >= (SIZE === 4 ? 15 : 25)) K.award('hunt', level);
          showWords(end, r); end.appendChild(again(dict)); wrap.appendChild(end);
        });
        /* two players on one phone: the same board, one after the other */
        var who = o.p === 0 ? T('Player 1') : T('Player 2');
        var cover = el('div', { class: 'kd-setup' }, [el('p', { class: 'kd-setup__t', text: (o.p === 0 ? '1️⃣ ' : '2️⃣ ') + who }), el('p', { text: o.p === 0 ? T('Player 1 plays first. Player 2, don’t look!') : T('Pass the phone to Player 2: the same letters, the same time.') }),
          el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: T('I am ready'), onclick: function () { play(dict, o.seed, SIZE, TIME, who, function (r) { o.res[o.p] = r; if (o.p === 0) { o.p = 1; round(dict, o); } else localEnd(dict, o); }); } })]);
        wrap.innerHTML = ''; wrap.appendChild(cover);
      }
      function localEnd(dict, o) {
        var a = o.res[0], b2 = o.res[1], w = a.score === b2.score ? -1 : a.score > b2.score ? 0 : 1;
        var end = el('div', { class: 'kd-end' }, [el('p', { class: 'kd-end__t', text: w < 0 ? '🤝 ' + T('A draw! Well played.') : '🎉 ' + (w === 0 ? T('Player 1') : T('Player 2')) + ' ' + T('wins the game!') }), el('p', { text: T('Player 1') + ' ' + a.score + ' · ' + T('Player 2') + ' ' + b2.score })]);
        K.sound('success'); end.appendChild(el('p', { class: 'kd-wh__miss', text: T('Player 1') })); showWords(end, a, b2.words); end.appendChild(el('p', { class: 'kd-wh__miss', text: T('Player 2') })); showWords(end, b2, a.words); end.appendChild(again(dict));
        wrap.innerHTML = ''; wrap.appendChild(end);
      }
      /* online: the same board on both phones; each plays when ready; the scores are compared */
      function online(dict, sess, d) {
        var st = d.state || {}, seat = sess.seat, mine = st.res && st.res[seat];
        function results(state) {
          wrap.innerHTML = '';
          var r = state.res || {}, me = r[seat], him = r[1 - seat];
          wrap.appendChild(el('p', { class: 'kg-net__small', text: T('Online game') + ' · ' + sess.code.replace(/(...)(...)/, '$1 $2') }));
          if (!him) {
            wrap.appendChild(el('div', { class: 'kd-end' }, [el('p', { class: 'kd-end__t', text: '⭐ ' + me.score + ' ' + T('points') }), el('p', { text: T('Waiting for your friend to play the same letters…') })]));
            if (seat === 0 && !(d.seats && d.seats[1])) wrap.appendChild(K.net.card('hunt', sess.code, false));
            return;
          }
          var w = me.score === him.score ? -1 : me.score > him.score ? 0 : 1;
          var end = el('div', { class: 'kd-end' }, [el('p', { class: 'kd-end__t', text: w < 0 ? '🤝 ' + T('A draw! Well played.') : w === 0 ? '🎉 ' + T('You won the game!') : '🙂 ' + T('Your friend won this time. Well played!') }), el('p', { text: T('You') + ' ' + me.score + ' · ' + T('Your friend') + ' ' + him.score })]);
          K.sound(w === 0 ? 'success' : 'good');
          end.appendChild(el('p', { class: 'kd-wh__miss', text: T('Your words (gold: your friend found them too)') })); showWords(end, { words: me.words, all: whSolve(dict, whBoard(state.seed, state.size), state.size) }, him.words);
          end.appendChild(el('p', { class: 'kd-wh__miss', text: T('Your friend’s words') + ': ' + him.words.map(function (x) { return x.toUpperCase(); }).join(', ') }));
          end.appendChild(el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: T('Play again') + ' →', onclick: function () {
            var nst = { seed: (Math.random() * 1e9) | 0, size: SIZE, time: TIME, res: {}, n: (state.n || 1) + 1 };
            K.net.put(sess, nst).then(function () { start(nst); }).catch(function (e) { if (e && e.why === 'late' && e.data) { sess.v = e.data.v; start(e.data.state); } });
          } }), el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '🚪 ' + T('Leave this game'), onclick: function () { K.net.forget('hunt'); setup(dict); } })]));
          wrap.appendChild(end);
        }
        function start(state) {
          st = state;
          if (st.res && st.res[seat]) { results(st); return; }
          wrap.innerHTML = '';
          wrap.appendChild(el('p', { class: 'kg-net__small', text: T('Online game') + ' · ' + sess.code.replace(/(...)(...)/, '$1 $2') }));
          if (seat === 0 && !(d.seats && d.seats[1])) wrap.appendChild(K.net.card('hunt', sess.code, false));
          wrap.appendChild(el('div', { class: 'kd-setup' }, [el('p', { text: T('Your friend gets the same letters. Play when you are ready; the scores are compared when you have both played.') }),
            el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '▶ ' + T('Start'), onclick: function () {
              play(dict, st.seed, st.size || SIZE, st.time || TIME, '', function (r) {
                var mineR = { score: r.score, words: r.words };
                K.net.update(sess, function (cur) { cur = cur || st; cur.res = cur.res || {}; cur.res[seat] = mineR; return cur; }).then(function () { return K.net.get(sess); }).then(function (dd) { results(dd.state); }).catch(function (e) { wrap.appendChild(el('p', { class: 'kg-net__msg', text: K.net.why(e) })); });
              });
            } })]));
        }
        stopWatch = K.net.watch(sess, function (dd, unchanged) {
          if (!alive() || !dd) return; d = dd;
          if (unchanged) return;
          var s2 = dd.state || {};
          if ((s2.n || 1) !== (st.n || 1)) { start(s2); return; }
          st = s2; if (st.res && st.res[seat]) results(st);
        });
        start(st);
      }
    }

    /* ======================= races: the same challenge for two players ======================= */
    /* o: { id, title, about, rules, make() -> the shared challenge (made once, by the first phone, and sent to the other),
            play(holder, ch, done(r)), better(a, b) -> true when a beats b, line(r) -> short text of a result } */
    function race(box, level, alive, o) {
      var wrap = el('div', { class: 'kd kd--race' }); box.appendChild(wrap);
      var join = K.net ? K.net.pending(o.id) : '', stopWatch = null;
      /* 7.24.0: the challenge can take a moment to make (a Sudoku): make() may give a promise */
      function make() {
        var w = el('p', { class: 'kd-status kd-wait', text: '⏳ ' + T('Preparing the challenge…') }); wrap.appendChild(w);
        return new Promise(function (res) { setTimeout(function () { res(o.make()); }, 30); }).then(function (ch) { w.remove(); return ch; }, function (e) { w.remove(); throw e; });
      }
      function setup() {
        if (stopWatch) { stopWatch(); stopWatch = null; }
        wrap.innerHTML = '';
        var s = el('div', { class: 'kd-setup' });
        s.appendChild(el('h5', { class: 'kd-setup__t', text: o.title }));
        s.appendChild(el('p', { class: 'kt-note', text: o.about }));
        s.appendChild(el('p', { class: 'kd-setup__q', text: T('Who is playing?') }));
        s.appendChild(el('div', { class: 'kd-setup__b' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '👥 ' + T('2 players, one phone'), onclick: function () { make().then(function (ch) { if (alive()) local(ch, 0, []); }); } })]));
        if (K.net && K.net.ok()) {
          var ns = K.net.saved(o.id);
          if (ns) s.appendChild(el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '↻ ' + T('Continue the online game') + ' ' + ns.code, onclick: function () { K.net.get(ns).then(function (d) { ns.v = d.v; online(ns, d); }).catch(function (e) { if (e && e.why === 'gone') K.net.forget(o.id); setup(); }); } })]));
          s.appendChild(K.net.chooser(o.id, function () { return make().then(function (ch) { var st = { ch: ch, res: {}, n: 1 }; return K.net.create(o.id, st).then(function (x) { online(x, { seats: [1, 0], state: st }); }); }); },
            function (c) { return K.net.join(o.id, c).then(function (x) { online(x, x.data); }); }, join));
          if (join) { var jb = s.querySelector('.kg-net__join button'); join = ''; if (jb) setTimeout(function () { jb.click(); }, 50); }
        }
        if (o.rules) s.appendChild(el('details', { class: 'kd-rules' }, [el('summary', { text: '📖 ' + T('How to play') }), el('p', { text: o.rules })]));
        wrap.appendChild(s);
      }
      function again() { return el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: T('Play again') + ' →', onclick: setup })]); }
      function local(ch, p, res) {
        wrap.innerHTML = '';
        var who = p === 0 ? T('Player 1') : T('Player 2');
        wrap.appendChild(el('div', { class: 'kd-setup' }, [el('p', { class: 'kd-setup__t', text: (p === 0 ? '1️⃣ ' : '2️⃣ ') + who }), el('p', { text: p === 0 ? T('Player 1 plays first. Player 2, don’t look!') : T('Pass the phone to Player 2: the same challenge.') }),
          el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: T('I am ready'), onclick: function () { wrap.innerHTML = ''; wrap.appendChild(el('p', { class: 'kd-status', text: who })); var h = el('div'); wrap.appendChild(h);
            o.play(h, ch, function (r) { res[p] = r; if (p === 0) local(ch, 1, res); else { var w = o.better(res[0], res[1]) ? 0 : o.better(res[1], res[0]) ? 1 : -1; K.sound('success');
              wrap.innerHTML = ''; wrap.appendChild(el('div', { class: 'kd-end' }, [el('p', { class: 'kd-end__t', text: w < 0 ? '🤝 ' + T('A draw! Well played.') : '🎉 ' + (w === 0 ? T('Player 1') : T('Player 2')) + ' ' + T('wins the game!') }), el('p', { text: T('Player 1') + ': ' + o.line(res[0]) }), el('p', { text: T('Player 2') + ': ' + o.line(res[1]) }), again()])); } }); } })]));
      }
      function online(sess, d) {
        var st = d.state || {}, seat = sess.seat;
        function code() { return el('p', { class: 'kg-net__small', text: T('Online game') + ' · ' + sess.code.replace(/(...)(...)/, '$1 $2') }); }
        function results() {
          wrap.innerHTML = ''; wrap.appendChild(code());
          var me = st.res[seat], him = st.res[1 - seat];
          if (!him) { wrap.appendChild(el('div', { class: 'kd-end' }, [el('p', { class: 'kd-end__t', text: o.line(me) }), el('p', { text: T('Waiting for your friend to play the same challenge…') })])); if (seat === 0 && !(d.seats && d.seats[1])) wrap.appendChild(K.net.card(o.id, sess.code, false)); return; }
          var w = o.better(me, him) ? 0 : o.better(him, me) ? 1 : -1; K.sound(w === 0 ? 'success' : 'good');
          wrap.appendChild(el('div', { class: 'kd-end' }, [el('p', { class: 'kd-end__t', text: w < 0 ? '🤝 ' + T('A draw! Well played.') : w === 0 ? '🎉 ' + T('You won the game!') : '🙂 ' + T('Your friend won this time. Well played!') }),
            el('p', { text: T('You') + ': ' + o.line(me) }), el('p', { text: T('Your friend') + ': ' + o.line(him) }),
            el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: T('Play again') + ' →', onclick: function () { make().then(function (ch) { var n = { ch: ch, res: {}, n: (st.n || 1) + 1 }; return K.net.put(sess, n).then(function () { start(n); }); }).catch(function (e) { if (e && e.why === 'late' && e.data) { sess.v = e.data.v; start(e.data.state); } }); } }),
              el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '🚪 ' + T('Leave this game'), onclick: function () { K.net.forget(o.id); setup(); } })])]));
        }
        function start(state) {
          st = state; st.res = st.res || {};
          if (st.res[seat]) { results(); return; }
          wrap.innerHTML = ''; wrap.appendChild(code());
          if (seat === 0 && !(d.seats && d.seats[1])) wrap.appendChild(K.net.card(o.id, sess.code, false));
          wrap.appendChild(el('div', { class: 'kd-setup' }, [el('p', { text: T('Your friend gets the same challenge. Play when you are ready; the results are compared when you have both played.') }),
            el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '▶ ' + T('Start'), onclick: function () { wrap.innerHTML = ''; var h = el('div'); wrap.appendChild(h);
              o.play(h, st.ch, function (r) { K.net.update(sess, function (cur) { cur = cur || st; cur.res = cur.res || {}; cur.res[seat] = r; return cur; }).then(function () { return K.net.get(sess); }).then(function (dd) { st = dd.state; results(); }).catch(function (e) { wrap.appendChild(el('p', { class: 'kg-net__msg', text: K.net.why(e) })); }); }); } })]));
        }
        stopWatch = K.net.watch(sess, function (dd, unchanged) { if (!alive() || !dd) return; d = dd; if (unchanged) return; var s2 = dd.state || {}; if ((s2.n || 1) !== (st.n || 1)) { start(s2); return; } var playing = !st.res || !st.res[seat]; st = s2; if (!playing) results(); });
        start(st);
      }
      setup();
    }
    function clock() { var t0 = Date.now(), plus = 0; return { add: function (ms) { plus += ms; }, ms: function () { return Date.now() - t0 + plus; } }; }
    function secs(ms) { return (ms / 1000).toFixed(1) + ' s'; }

    /* ---- Verse Race: the same memory verses for both players; tap the words in order, the fastest wins ---- */
    function verseRace(box, level, alive) {
      var LW = K.lw ? K.lw() : null, LOC = !!(LW && K.lang && K.lang !== 'en');
      var ROUNDS = level === 'easy' ? 2 : 3;
      race(box, level, alive, {
        id: 'verserace', title: '📜 ' + T('Verse Race'),
        about: T('The same memory verses for both players: put the words back in order. The fastest wins; a wrong word costs two seconds.'),
        make: function () {
          var all = ((K.data && K.data.verses) || []).map(function (v) { return { t: LOC ? T(v.t) : v.t, ref: LOC ? T(v.ref) : v.ref }; }).filter(function (v) { var n = K.lang === 'zh' ? Math.ceil(v.t.replace(/\s+/g, '').length / 2) : v.t.split(/\s+/).length; return n >= 5 && n <= (level === 'hard' ? 22 : level === 'medium' ? 16 : 11); });
          if (all.length < ROUNDS) all = ((K.data && K.data.verses) || []).map(function (v) { return { t: LOC ? T(v.t) : v.t, ref: LOC ? T(v.ref) : v.ref }; });
          return { vs: K.shuffle(all).slice(0, ROUNDS), seed: (Math.random() * 1e9) | 0 };
        },
        play: function (h, ch, done) {
          var i = 0, c = clock(), wrong = 0, R = mulberry(ch.seed);
          function one() {
            if (i >= ch.vs.length) return done({ ms: c.ms(), wrong: wrong });
            var v = ch.vs[i], words = K.lang === 'zh' ? (v.t.replace(/\s+/g, '').match(/.{1,2}/g) || [v.t]) : v.t.split(/\s+/), order = words.map(function (w, k) { return k; });
            for (var k = order.length - 1; k > 0; k--) { var j = Math.floor(R() * (k + 1)), tmp = order[k]; order[k] = order[j]; order[j] = tmp; }
            h.innerHTML = '';
            var built = el('p', { class: 'kd-vr__built', 'data-kjt-notr': '' }), pool = el('div', { class: 'kd-vr__pool', 'data-kjt-notr': '' }), next = 0;
            h.appendChild(el('p', { class: 'kd-status', text: (i + 1) + ' / ' + ch.vs.length + ' · ' + v.ref }));
            h.appendChild(built); h.appendChild(pool);
            order.forEach(function (k) { var b = el('button', { class: 'kd-vr__w', type: 'button', text: words[k] }); b.addEventListener('click', function () {
              if (words[k] === words[next]) { b.disabled = true; b.classList.add('ok'); built.appendChild(el('span', { text: words[k] + ' ' })); next++; K.sound('tap'); if (next >= words.length) { K.sound('good'); i++; setTimeout(one, 700); } }
              else { wrong++; c.add(2000); K.sound('miss'); b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); }
            }); pool.appendChild(b); });
          }
          one();
        },
        better: function (a, b) { return a.ms < b.ms; },
        line: function (r) { return secs(r.ms) + (r.wrong ? ' (' + r.wrong + ' × ' + T('wrong word') + ')' : ''); }
      });
    }

    /* ---- Word Seek Race: the same grid of hidden words for both players; find them all, the fastest wins ---- */
    function seekRace(box, level, alive) {
      var N = level === 'easy' ? 8 : level === 'medium' ? 10 : 11, COUNT = level === 'easy' ? 6 : level === 'medium' ? 8 : 10;
      var DIRS = level === 'easy' ? [[0, 1], [1, 0]] : level === 'medium' ? [[0, 1], [1, 0], [1, 1], [-1, 1]] : [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
      race(box, level, alive, {
        id: 'seekrace', title: '🔍 ' + T('Word Seek Race'),
        about: T('The same grid of hidden Bible words for both players. Find them all: the fastest wins.'),
        make: function () {
          var LW = K.lw ? K.lw() : null, TH = (LW && LW.themes && LW.themes.length) ? LW.themes : (K.words || []);
          for (var tries = 0; tries < 30; tries++) {
            var th = K.pick(TH), grid = [], placed = [];
            for (var r = 0; r < N; r++) { grid.push([]); for (var c = 0; c < N; c++) grid[r].push(''); }
            K.shuffle(th.words.filter(function (w) { var g = K.G(w.toUpperCase().replace(/\s+/g, '')); return g.length >= 3 && g.length <= N; })).forEach(function (w) {
              if (placed.length >= COUNT) return; var g = K.G(w.toUpperCase().replace(/\s+/g, ''));
              for (var t = 0; t < 200; t++) { var d = K.pick(DIRS), r0 = K.ri(0, N - 1), c0 = K.ri(0, N - 1), cells = [], ok = true;
                for (var i = 0; i < g.length; i++) { var rr = r0 + d[0] * i, cc = c0 + d[1] * i; if (rr < 0 || cc < 0 || rr >= N || cc >= N || (grid[rr][cc] && grid[rr][cc] !== g[i])) { ok = false; break; } cells.push([rr, cc]); }
                if (!ok) continue; cells.forEach(function (x, i) { grid[x[0]][x[1]] = g[i]; }); placed.push({ w: w, cells: cells }); break; }
            });
            if (placed.length >= Math.min(4, COUNT)) {
              var fill = []; placed.forEach(function (p) { p.cells.forEach(function (x) { fill.push(grid[x[0]][x[1]]); }); });
              for (r = 0; r < N; r++) for (c = 0; c < N; c++) if (!grid[r][c]) grid[r][c] = K.pick(fill);
              return { grid: grid, words: placed, theme: th.theme || '' };
            }
          }
          return { grid: [], words: [] };
        },
        play: function (h, ch, done) {
          var c = clock(), found = 0, sel = null, n = ch.grid.length;
          var list = el('div', { class: 'kd-sr__list', 'data-kjt-notr': '' }), g = el('div', { class: 'kd-sr', 'data-kjt-notr': '', style: 'grid-template-columns:repeat(' + n + ',1fr)' });
          if (ch.theme) h.appendChild(el('p', { class: 'kd-status', text: ch.theme }));
          h.appendChild(list); h.appendChild(g);
          var tags = ch.words.map(function (p) { var t = el('span', { class: 'kd-wh__w', text: p.w }); list.appendChild(t); return t; });
          var cells = [];
          ch.grid.forEach(function (row, r) { row.forEach(function (ltr, cc) { var b = el('button', { class: 'kd-sr__c', type: 'button', text: ltr }); b.addEventListener('click', function () { tap(r, cc); }); cells.push(b); g.appendChild(b); }); });
          function tap(r, cc) {
            if (!sel) { sel = [r, cc]; cells[r * n + cc].classList.add('sel'); K.sound('tap'); return; }
            var a = sel; sel = null; cells[a[0] * n + a[1]].classList.remove('sel');
            ch.words.forEach(function (p, k) {
              if (tags[k].classList.contains('done')) return;
              var s0 = p.cells[0], e0 = p.cells[p.cells.length - 1];
              if ((s0[0] === a[0] && s0[1] === a[1] && e0[0] === r && e0[1] === cc) || (e0[0] === a[0] && e0[1] === a[1] && s0[0] === r && s0[1] === cc)) {
                tags[k].classList.add('done'); found++; K.sound('good'); p.cells.forEach(function (x) { cells[x[0] * n + x[1]].classList.add('found'); });
                if (found === ch.words.length) setTimeout(function () { done({ ms: c.ms(), found: found }); }, 500);
              }
            });
          }
          h.appendChild(el('p', { class: 'kt-note', text: T('Tap the first letter of a word, then its last letter.') }));
        },
        better: function (a, b) { return a.ms < b.ms; },
        line: function (r) { return secs(r.ms); }
      });
    }

    /* ---- 7.24.0: Sudoku Race: the same Sudoku for both players, timed; a hint adds 30 seconds ---- */
    function sudokuRace(box, level, alive) {
      var S = K.sudoku; if (!S) { box.appendChild(el('p', { class: 'kt-note', text: T('Open this page again with internet to play.') })); return; }
      race(box, level, alive, {
        id: 'sudokurace', title: '🧮 ' + T('Sudoku Race'),
        about: T('The same Sudoku for both players. Solve it: the fastest wins. A hint adds 30 seconds.'),
        make: function () { return new Promise(function (res) { S.find(level === 'ultra' ? 'hard' : level, alive, function (p) { res({ grid: p.grid, sol: p.sol }); }); }); },
        play: function (h, ch, done) { var inner = S.frame(h); S.play(inner, ch, level, alive, { done: done }); },
        better: function (a, b) { return a.ms < b.ms; },
        line: function (r) { return S.fmt(r.ms / 1000) + (r.hints ? ' (' + r.hints + ' × 💡)' : ''); }
      });
    }
    /* ---- 7.24.0: Crossword Race: the same crossword for both players, timed; a revealed letter adds 20 seconds ---- */
    function xwRace(box, level, alive) {
      var X = K.crossword; if (!X) { box.appendChild(el('p', { class: 'kt-note', text: T('Open this page again with internet to play.') })); return; }
      race(box, level, alive, {
        id: 'xwrace', title: '✏️ ' + T('Crossword Race'),
        about: T('The same crossword for both players. Fill it in: the fastest wins. A revealed letter adds 20 seconds.'),
        make: function () { return X.make(level); },
        play: function (h, ch, done) { X.play(h, level, ch, done); },
        better: function (a, b) { return a.ms < b.ms; },
        line: function (r) { var s = Math.round(r.ms / 1000); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2) + (r.hints ? ' (' + r.hints + ' × 💡)' : ''); }
      });
    }

    /* ---- Who Am I? for two: each player secretly picks a Bible person; ask yes-or-no questions in turn and guess ---- */
    var WHO = [['👴', 'Abraham'], ['👵', 'Sarah'], ['🧺', 'Moses'], ['💃', 'Miriam'], ['🎵', 'David'], ['🌾', 'Ruth'], ['👑', 'Esther'], ['🦁', 'Daniel'], ['🔥', 'Elijah'], ['🐋', 'Jonah'], ['🚢', 'Noah'], ['🧥', 'Joseph'],
      ['🌹', 'The Virgin Mary'], ['🦗', 'John the Baptist'], ['🗝️', 'Peter'], ['✉️', 'Paul'], ['🎣', 'Andrew'], ['🏺', 'Mary Magdalene'], ['🍲', 'Martha'], ['⚰️', 'Lazarus'], ['🌳', 'Zacchaeus'], ['🌙', 'Nicodemus'], ['✋', 'Thomas'], ['🪨', 'Stephen']];
    function whoTwo(box, level, alive) {
      var wrap = el('div', { class: 'kd kd--who' }); box.appendChild(wrap);
      var join = K.net ? K.net.pending('whoami2') : '', stopWatch = null;
      function setup() {
        if (stopWatch) { stopWatch(); stopWatch = null; }
        wrap.innerHTML = '';
        var s = el('div', { class: 'kd-setup' });
        s.appendChild(el('h5', { class: 'kd-setup__t', text: '❓ ' + T('Who Am I? for two') }));
        s.appendChild(el('p', { class: 'kt-note', text: T('Each player secretly chooses a person from the Bible. Take turns asking questions that can be answered yes or no, turn down the cards that do not fit, and be the first to guess the other’s person.') }));
        if (K.net && K.net.ok()) {
          var ns = K.net.saved('whoami2');
          if (ns) s.appendChild(el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '↻ ' + T('Continue the online game') + ' ' + ns.code, onclick: function () { K.net.get(ns).then(function (d) { ns.v = d.v; online(ns, d); }).catch(function (e) { if (e && e.why === 'gone') K.net.forget('whoami2'); setup(); }); } })]));
          s.appendChild(K.net.chooser('whoami2', function () { var st = { sec: {}, log: [], t: 0, win: -1, n: 1 }; return K.net.create('whoami2', st).then(function (x) { online(x, { seats: [1, 0], state: st }); }); },
            function (c) { return K.net.join('whoami2', c).then(function (x) { online(x, x.data); }); }, join));
          if (join) { var jb = s.querySelector('.kg-net__join button'); join = ''; if (jb) setTimeout(function () { jb.click(); }, 50); }
        }
        s.appendChild(el('p', { class: 'kt-note', text: T('Sitting together? Each of you thinks of a person from the cards, and you ask your questions out loud: use the cards on one phone to turn down who it cannot be.') }));
        s.appendChild(el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '🃏 ' + T('Just the cards'), onclick: function () { wrap.innerHTML = ''; wrap.appendChild(cards(function () {}, null)); wrap.appendChild(el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '↩ ' + T('Choose again'), onclick: setup })])); } }));
        wrap.appendChild(s);
      }
      /* the 24 cards; tap to turn one down (or, when choosing / guessing, to pick it) */
      function cards(onPick, pickMode, downKey) {
        var down = {}; try { down = JSON.parse(localStorage.getItem(downKey || '') || '{}') || {}; } catch (e) {}
        var g = el('div', { class: 'kd-who' });
        WHO.forEach(function (w, i) { var b = el('button', { class: 'kd-who__c' + (down[i] ? ' down' : ''), type: 'button' }, [el('span', { class: 'kd-who__i', text: w[0] }), el('span', { class: 'kd-who__n', text: T(w[1]) })]);
          b.addEventListener('click', function () { if (pickMode) { onPick(i); return; } down[i] = !down[i]; b.classList.toggle('down', !!down[i]); K.sound('tap'); try { if (downKey) localStorage.setItem(downKey, JSON.stringify(down)); } catch (e) {} });
          g.appendChild(b); });
        return g;
      }
      function online(sess, d) {
        var st = d.state || {}, seat = sess.seat, guessing = false;
        function send(fn) { return K.net.update(sess, function (cur) { cur = cur || st; return fn(cur) || cur; }).then(function () { return K.net.get(sess); }).then(function (dd) { st = dd.state; draw(); }).catch(function (e) { wrap.appendChild(el('p', { class: 'kg-net__msg', text: K.net.why(e) })); }); }
        function draw() {
          wrap.innerHTML = '';
          wrap.appendChild(el('p', { class: 'kg-net__small', text: T('Online game') + ' · ' + sess.code.replace(/(...)(...)/, '$1 $2') }));
          if (seat === 0 && !(d.seats && d.seats[1])) wrap.appendChild(K.net.card('whoami2', sess.code, true));
          var sec = st.sec || {};
          if (sec[seat] === undefined) {
            wrap.appendChild(el('p', { class: 'kd-status', text: T('Choose your secret person: your friend will try to guess who it is.') }));
            wrap.appendChild(cards(function (i) { send(function (cur) { cur.sec = cur.sec || {}; cur.sec[seat] = i; }); }, true)); return;
          }
          wrap.appendChild(el('p', { class: 'kd-who__mine', text: T('Your secret person') + ': ' + WHO[sec[seat]][0] + ' ' + T(WHO[sec[seat]][1]) }));
          if (st.win >= 0) {
            K.sound(st.win === seat ? 'success' : 'good');
            wrap.appendChild(el('div', { class: 'kd-end' }, [el('p', { class: 'kd-end__t', text: st.win === seat ? '🎉 ' + T('You guessed it! You won the game!') : '🙂 ' + T('Your friend guessed your person. Well played!') }),
              el('p', { text: T('Your friend’s person was') + ': ' + WHO[sec[1 - seat]][0] + ' ' + T(WHO[sec[1 - seat]][1]) }),
              el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: T('Play again') + ' →', onclick: function () { try { localStorage.removeItem('kjt_who_' + sess.code); } catch (e) {} send(function (cur) { return { sec: {}, log: [], t: 1 - (cur.t0 || 0), t0: 1 - (cur.t0 || 0), win: -1, n: (cur.n || 1) + 1 }; }); } }),
                el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '🚪 ' + T('Leave this game'), onclick: function () { K.net.forget('whoami2'); setup(); } })])]));
            return;
          }
          if (sec[1 - seat] === undefined) { wrap.appendChild(el('p', { class: 'kd-status', text: T('Waiting for your friend to choose a person…') })); return; }
          var log = st.log || [], last = log[log.length - 1], myTurn = st.t === seat;
          var talk = el('div', { class: 'kd-who__log' });
          log.slice(-6).forEach(function (x) { talk.appendChild(el('p', { class: 'kd-who__q' + (x.s === seat ? ' me' : '') }, [el('strong', { text: (x.s === seat ? T('You') : T('Your friend')) + ': ' }), el('span', { text: x.g !== undefined ? T('Is it') + ' ' + T(WHO[x.g][1]) + '?' : x.q }),
            el('em', { text: x.a ? ' → ' + (x.a === 'yes' ? T('Yes') : x.a === 'no' ? T('No') : x.a === 'right' ? '✓' : x.a === 'wrong' ? T('No') : T('I don’t know')) : '' })])); });
          wrap.appendChild(talk);
          if (last && !last.a && last.g === undefined && last.s !== seat) {
            wrap.appendChild(el('p', { class: 'kd-status', text: T('Your friend asks') + ': ' + last.q }));
            wrap.appendChild(el('div', { class: 'kt-row', style: 'justify-content:center' }, [['yes', '👍 ' + T('Yes')], ['no', '👎 ' + T('No')], ['dk', '🤷 ' + T('I don’t know')]].map(function (a) {
              return el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: a[1], onclick: function () { send(function (cur) { var L = cur.log[cur.log.length - 1]; if (L && !L.a) { L.a = a[0]; cur.t = seat; } }); } }); })));
          } else if (myTurn && !(last && !last.a && last.s === seat)) {
            if (guessing) {
              wrap.appendChild(el('p', { class: 'kd-status', text: T('Tap the person you think it is.') }));
              wrap.appendChild(cards(function (i) { guessing = false; send(function (cur) { var ok = cur.sec[1 - seat] === i; cur.log.push({ s: seat, g: i, a: ok ? 'right' : 'wrong' }); if (ok) cur.win = seat; else cur.t = 1 - seat; }); }, true));
              wrap.appendChild(el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: T('Back'), onclick: function () { guessing = false; draw(); } })); return;
            }
            var inp = el('input', { class: 'kd-who__in', type: 'text', maxlength: '120', placeholder: T('Was this person a king?') });
            wrap.appendChild(el('p', { class: 'kd-status', text: T('Your turn: ask a question that can be answered yes or no.') }));
            wrap.appendChild(el('div', { class: 'kd-who__ask' }, [inp, el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: T('Ask'), onclick: function () { var q = inp.value.trim(); if (!q) return; send(function (cur) { cur.log.push({ s: seat, q: q.slice(0, 120) }); }); } })]));
            wrap.appendChild(el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '🎯 ' + T('I know who it is!'), onclick: function () { guessing = true; draw(); } }));
          } else wrap.appendChild(el('p', { class: 'kd-status', text: last && !last.a && last.s === seat ? T('Waiting for your friend’s answer…') : T('Waiting for your friend’s question…') }));
          wrap.appendChild(el('p', { class: 'kt-note', text: T('Tap a card to turn it down when it cannot be the person.') }));
          wrap.appendChild(cards(function () {}, false, 'kjt_who_' + sess.code + '_' + (st.n || 1)));
        }
        stopWatch = K.net.watch(sess, function (dd, unchanged) { if (!alive() || !dd) return; d = dd; if (unchanged) return; var wasT = st.t, wasLen = (st.log || []).length; st = dd.state; if (!guessing) draw(); if ((st.log || []).length !== wasLen && st.t === seat) K.net.nudge(); });
        draw();
      }
      setup();
    }

    K.duoGames = { C4: C4, CK: CK, MC: MC, NM: NM, bestMove: bestMove };
    window.KJTGames.register({ id: 'c4', cat: 'family', icon: '🍞', name: 'Loaves and Fishes', blurb: 'Four in a row: the computer, a friend, or online', run: c4 });
    window.KJTGames.register({ id: 'checkers', cat: 'family', icon: '⛀', name: 'Checkers', blurb: 'Jump, take and be crowned king', run: checkers });
    window.KJTGames.register({ id: 'mancala', cat: 'family', icon: '🌰', name: 'Mancala', blurb: 'Sow the seeds and fill your store: an old game of Bible lands', run: mancala });
    window.KJTGames.register({ id: 'hunt', cat: 'think', icon: '🔤', name: 'Word Hunt', blurb: 'Find words in a grid of letters, alone or against a friend', run: wordHunt, langs: ['en'] });
    window.KJTGames.register({ id: 'tavli', cat: 'family', icon: '🎲', name: 'Tavli (backgammon)', blurb: 'Race your checkers home: the game of Greek and Arab homes', run: tavli });
    window.KJTGames.register({ id: 'verserace', cat: 'family', icon: '📜', name: 'Verse Race', blurb: 'The same memory verses for two: who puts them back in order first?', run: verseRace });
    window.KJTGames.register({ id: 'sudokurace', cat: 'think', icon: '⏱️', name: 'Sudoku Race', blurb: 'The same Sudoku for two, timed: who solves it first?', run: sudokuRace });
    window.KJTGames.register({ id: 'xwrace', cat: 'think', icon: '⏱️', name: 'Crossword Race', blurb: 'The same crossword for two, timed: who fills it in first?', run: xwRace });
    window.KJTGames.register({ id: 'seekrace', cat: 'family', icon: '🔍', name: 'Word Seek Race', blurb: 'The same hidden words for two: who finds them all first?', run: seekRace });
    window.KJTGames.register({ id: 'whoami2', cat: 'family', icon: '❓', name: 'Who Am I? for two', blurb: 'Guess your friend’s secret Bible person with yes-or-no questions', run: whoTwo });
    window.KJTGames.register({ id: 'morris', cat: 'family', icon: '⚪', name: 'Nine Men’s Morris', blurb: 'Make rows of three: one of the oldest games in the world', run: morris });
    try { window.dispatchEvent(new Event('kjt-games-parts')); } catch (e) {}
    if (window.KJTDuoMore) window.KJTDuoMore(K, duo, el, T, BASE);
  }
  boot();
})();
