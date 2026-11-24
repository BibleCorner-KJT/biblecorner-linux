/* KJT Kids Corner - Bible Games: Family & Board Games (Site Core 5.5.0)
   Journey to Jerusalem (1-4 players, or one player against the computer)
   and Quiz Duel (two players on one device). */
(function () {
  'use strict';
  if (!window.KJTGames) return;
  var K = window.KJTGames.kit, el = K.el;
  var COLORS = [['#70126F', 'Purple'], ['#F3C548', 'Gold'], ['#0B7778', 'Teal'], ['#E63956', 'Red']];

  function qPool(level, cat) {
    var all = K.questions(), max = level === 'easy' ? 1 : level === 'medium' ? 2 : 3;
    var pool = all.filter(function (q) { return (q.lvl || 1) <= max && (!cat || cat === 'mixed' || q.cat === cat); });
    return K.shuffle(pool.length > 10 ? pool : all);
  }
  function askQuestion(area, q, opts, done) {
    /* opts: { lifeline: bool, timer: seconds, cpu: probability or null } */
    var answers = K.shuffle(q.a.slice(0, 4)), right = q.a[0], box = el('div', { class: 'kg-q' });
    var list = el('div', { class: 'kg-q-opts' }), fb = el('p', { class: 'kg-note' }), finished = false, t = null;
    box.appendChild(el('p', { class: 'kg-q-text', text: q.q }));
    answers.forEach(function (a) { list.appendChild(el('button', { class: 'kt-opt kg-q-opt', type: 'button', text: a, onclick: function () { choose(a, this); } })); });
    box.appendChild(list);
    var tools = el('div', { class: 'kt-row' });
    if (opts.lifeline) tools.appendChild(el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83d\udcd6 Scripture help (removes 2 wrong answers)', onclick: function () {
      var wrong = K.shuffle([].slice.call(list.children).filter(function (b) { return b.textContent !== right && !b.disabled; })).slice(0, 2);
      wrong.forEach(function (b) { b.disabled = true; b.classList.add('gentle'); }); this.remove(); opts.onLifeline && opts.onLifeline();
    } }));
    var clock = null;
    if (opts.timer) { var left = opts.timer; clock = el('span', { class: 'kg-timer', text: '\u23f1 ' + left }); tools.appendChild(clock); t = setInterval(function () { left--; clock.textContent = '\u23f1 ' + left; if (left <= 0) { clearInterval(t); if (!finished) choose(null, null); } }, 1000); K.onLeave(function () { clearInterval(t); }); }
    box.appendChild(tools); box.appendChild(fb);
    area.innerHTML = ''; area.appendChild(box);
    function choose(a, btn) {
      if (finished) return; finished = true; if (t) clearInterval(t);
      var ok = a === right;
      [].slice.call(list.children).forEach(function (b) { b.disabled = true; if (b.textContent === right) b.classList.add('right'); });
      if (btn && !ok) btn.classList.add('gentle');
      fb.className = 'kg-note' + (ok ? '' : ' try'); fb.textContent = ok ? '\u2b50 Correct!' : (a === null ? '\u23f1 Time\u2019s up! ' : 'Not this time. ') + 'The answer is: ' + right;
      K.sound(ok ? 'good' : 'miss');
      setTimeout(function () { done(ok); }, ok ? 1100 : 1900);
    }
    if (opts.cpu != null) { setTimeout(function () { var ok = K.rand() < opts.cpu, target = ok ? right : K.pick(answers.filter(function (x) { return x !== right; })); var b = [].slice.call(list.children).filter(function (x) { return x.textContent === target; })[0]; choose(target, b); }, 1400); [].slice.call(list.children).forEach(function (b) { b.disabled = true; }); }
  }
  function setupPlayers(box, title, text, allowCpu, min, onGo, choices) {
    var count = allowCpu ? 1 : 2, names = [];
    var form = el('div', { class: 'kg-setup' }, [el('h5', { text: title }), el('p', { class: 'kt-note', text: text })]);
    var chips = el('div', { class: 'kg-levels', role: 'group', 'aria-label': 'Players' }), inputs = el('div', { class: 'kg-names' });
    function draw() {
      chips.innerHTML = '';
      (choices || (allowCpu ? [1, 2, 3, 4] : [2])).forEach(function (n) { chips.appendChild(el('button', { class: 'kg-level', type: 'button', 'aria-pressed': n === count ? 'true' : 'false', text: n === 1 ? 'Me vs computer' : n + ' players', onclick: function () { count = n; draw(); } })); });
      inputs.innerHTML = '';
      for (var i = 0; i < Math.max(count, min); i++) {
        (function (i) { var inp = el('input', { class: 'kg-name', type: 'text', maxlength: '14', value: names[i] || ('Player ' + (i + 1)), 'aria-label': 'Name of player ' + (i + 1), style: 'border-color:' + COLORS[i][0] }); inp.addEventListener('input', function () { names[i] = inp.value; }); inputs.appendChild(el('label', { class: 'kg-name-row' }, [el('span', { class: 'kg-dot', style: 'background:' + COLORS[i][0] }), inp])); })(i);
      }
    }
    draw();
    form.appendChild(chips); form.appendChild(inputs);
    form.appendChild(el('div', { class: 'kt-row' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '\u25b6 Start', onclick: function () {
      var ps = [];
      for (var i = 0; i < Math.max(count, min); i++) ps.push({ name: (names[i] || 'Player ' + (i + 1)).trim() || 'Player ' + (i + 1), color: COLORS[i][0], cpu: false, pos: 0, score: 0 });
      if (count === 1) { ps[0].name = ps[0].name || 'You'; ps.push({ name: 'Computer', color: COLORS[1][0], cpu: true, pos: 0, score: 0 }); }
      onGo(ps);
    } })]));
    box.appendChild(form);
  }

  /* =================================================================
     JOURNEY TO JERUSALEM
     ================================================================= */
  function journey(box, level, alive) {
    var cpuSkill = { easy: 0.45, medium: 0.6, hard: 0.75 }[level];
    setupPlayers(box, '\ud83c\udfb2 Journey to Jerusalem', 'Pilgrims travel the road to the Temple in Jerusalem. Roll the die, answer questions, and be the first to arrive!', true, 1, function (players) { box.innerHTML = ''; play(players); });
    function play(players) {
      var N = 30, cols = 6, rows = 5, TYPES = ['q', 'q', 'q', 'q', 'q', 'bless', 'bless', 'well', 'wild', 'wild', 'rest'];
      var spaces = [];
      for (var i = 0; i < N; i++) spaces.push(i === 0 ? 'start' : i === N - 1 ? 'temple' : K.pick(TYPES));
      var ICON = { start: '\ud83c\udfe0', temple: '\ud83c\udfdb\ufe0f', q: '\u2753', bless: '\u2b50', well: '\ud83d\udca7', wild: '\ud83c\udfdc\ufe0f', rest: '\ud83d\udd4a\ufe0f' };
      var pos = [];
      for (var k = 0; k < N; k++) { var row = Math.floor(k / cols), col = row % 2 ? cols - 1 - k % cols : k % cols; pos.push([60 + col * 96, 330 - row * 70]); }
      var svgNS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '0 0 600 380'); svg.setAttribute('class', 'kg-board'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Game board');
      var html = '<rect width="600" height="380" rx="18" fill="#f7ecd4"/><path d="M' + pos.map(function (p) { return p.join(' '); }).join(' L') + '" fill="none" stroke="#e0c592" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>';
      spaces.forEach(function (t, i) { var p = pos[i], fill = t === 'q' ? '#fff' : t === 'bless' ? '#fff4cf' : t === 'well' ? '#dff1ff' : t === 'wild' ? '#f6d9c4' : t === 'temple' ? '#F3C548' : '#e6f3f1';
        html += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (t === 'temple' ? 26 : 21) + '" fill="' + fill + '" stroke="#8d5a2b" stroke-width="2"/><text x="' + p[0] + '" y="' + (p[1] + 7) + '" font-size="' + (t === 'temple' ? 24 : 18) + '" text-anchor="middle">' + ICON[t] + '</text>'; });
      svg.innerHTML = html;
      var tokens = players.map(function (pl, i) { var c = document.createElementNS(svgNS, 'g'); c.innerHTML = '<circle r="11" fill="' + pl.color + '" stroke="#fff" stroke-width="3"/><text y="4" font-size="11" font-weight="800" fill="#fff" text-anchor="middle">' + (pl.cpu ? 'C' : (i + 1)) + '</text>'; svg.appendChild(c); return c; });
      function place() { players.forEach(function (pl, i) { var p = pos[Math.min(pl.pos, N - 1)], same = players.filter(function (o) { return o.pos === pl.pos; }), k = same.indexOf(pl); tokens[i].setAttribute('transform', 'translate(' + (p[0] - 10 + k * 8) + ' ' + (p[1] - 22 - k * 3) + ')'); }); }
      place();
      var turn = 0, busy = false;
      var status = el('div', { class: 'kg-turn' }), dieEl = el('span', { class: 'kg-die', text: '\ud83c\udfb2' }), rollBtn = el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '\ud83c\udfb2 Roll the die', onclick: function () { roll(); } });
      var panel = el('div', { class: 'kg-board-panel' }), legend = el('p', { class: 'kg-legend', text: '\u2753 question (right: +1, wrong: \u22121) \u00b7 \u2b50 blessing +2 \u00b7 \ud83d\udca7 well: roll again \u00b7 \ud83c\udfdc\ufe0f wilderness \u22123 \u00b7 \ud83d\udd4a\ufe0f rest' });
      box.appendChild(el('div', { class: 'kg-board-wrap' }, [svg, el('div', { class: 'kg-board-side' }, [status, el('div', { class: 'kt-row' }, [rollBtn, dieEl]), panel, legend])]));
      var QS = qPool(level, 'mixed'), qi = 0;
      function drawStatus() {
        status.innerHTML = '';
        players.forEach(function (pl, i) { status.appendChild(el('div', { class: 'kg-turn-row' + (i === turn ? ' on' : '') }, [el('span', { class: 'kg-dot', style: 'background:' + pl.color }), el('strong', { text: pl.name }), el('span', { text: ' \u00b7 space ' + (pl.pos + 1) + ' of ' + N })])); });
        rollBtn.disabled = busy || players[turn].cpu;
      }
      drawStatus();
      function roll() {
        if (busy) return; busy = true; drawStatus(); K.sound('dice');
        var n = 0, spins = 8, faces = ['\u2680', '\u2681', '\u2682', '\u2683', '\u2684', '\u2685'], v = 1;
        var id = setInterval(function () { v = K.ri(1, 6); dieEl.textContent = faces[v - 1]; if (++n >= spins) { clearInterval(id); move(v, function () { land(); }); } }, 90);
        K.onLeave(function () { clearInterval(id); });
      }
      function move(steps, then) {
        var pl = players[turn], dirn = steps < 0 ? -1 : 1, left = Math.abs(steps);
        var id = setInterval(function () { if (!alive()) return clearInterval(id); if (left <= 0 || (dirn > 0 && pl.pos >= N - 1) || (dirn < 0 && pl.pos <= 0)) { clearInterval(id); drawStatus(); then(); return; } pl.pos += dirn; left--; K.sound('step'); place(); }, 260);
        K.onLeave(function () { clearInterval(id); });
      }
      function msg(text, then) { panel.innerHTML = ''; panel.appendChild(el('p', { class: 'kg-board-msg', text: text })); setTimeout(then, 1600); }
      function land() {
        var pl = players[turn], t = spaces[pl.pos];
        if (pl.pos >= N - 1) return win(pl);
        if (t === 'q') {
          var q = QS[qi++ % QS.length];
          panel.innerHTML = ''; panel.appendChild(el('p', { class: 'kg-board-who', text: (pl.cpu ? 'The computer answers:' : pl.name + ', your question:') }));
          var area = el('div'); panel.appendChild(area);
          askQuestion(area, q, { cpu: pl.cpu ? cpuSkill : null }, function (ok) { move(ok ? 1 : -1, function () { if (pl.pos >= N - 1) return win(pl); next(); }); });
        } else if (t === 'bless') { K.sound('good'); msg('\u2b50 A blessing! \u201cThe LORD bless thee, and keep thee\u201d (Numbers 6:24). Move ahead 2.', function () { move(2, function () { if (pl.pos >= N - 1) return win(pl); next(); }); }); }
        else if (t === 'well') { K.sound('splash'); msg('\ud83d\udca7 A well of fresh water! Roll again.', function () { busy = false; drawStatus(); if (pl.cpu) setTimeout(roll, 700); }); }
        else if (t === 'wild') { K.sound('wind'); msg('\ud83c\udfdc\ufe0f Lost in the wilderness! Go back 3. (God still guides you.)', function () { move(-3, next); }); }
        else { msg('\ud83d\udd4a\ufe0f A place to rest. Say a prayer of thanks!', next); }
      }
      function next() { if (!alive()) return; turn = (turn + 1) % players.length; busy = false; panel.innerHTML = ''; drawStatus(); if (players[turn].cpu) setTimeout(function () { if (alive()) roll(); }, 800); }
      function win(pl) {
        busy = true; drawStatus(); rollBtn.disabled = true;
        var human = !pl.cpu, solo = players.some(function (p) { return p.cpu; });
        if (human) K.award('journey', level);
        if (human || !solo) K.celebrate(box, pl.name + ' reached the Temple in Jerusalem! \u201cI was glad when they said unto me, Let us go into the house of the LORD\u201d (Psalm 122:1).');
        else { K.sound('sad'); box.appendChild(el('div', { class: 'kg-done' }, [el('p', { class: 'kg-done__text', text: 'The computer reached the Temple first this time. Try again!' }), el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: 'Play again \u2192', onclick: K.start })])); }
      }
    }
  }

  /* =================================================================
     QUIZ DUEL
     ================================================================= */
  function duel(box, level) {
    var rounds = { easy: 5, medium: 7, hard: 10 }[level], secs = level === 'hard' ? 20 : 0, cat = 'mixed';
    var T = K.T || function (s) { return s; };
    /* 7.21.0: with a friend online - the same questions on both phones; each answers when ready; the scores are compared */
    if (K.net && K.net.ok()) setTimeout(function () {
      var join = K.net.pending('duel'), nbox = el('div', { class: 'kg-duel-net' });
      var ns = K.net.saved('duel');
      if (ns) nbox.appendChild(el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '↻ ' + T('Continue the online game') + ' ' + ns.code, onclick: function () { K.net.get(ns).then(function (d) { ns.v = d.v; online(ns, d); }).catch(function (e) { if (e && e.why === 'gone') K.net.forget('duel'); }); } })]));
      nbox.appendChild(K.net.chooser('duel', function () { var st = fresh(); return K.net.create('duel', st).then(function (x) { online(x, { seats: [1, 0], state: st }); }); },
        function (c) { return K.net.join('duel', c).then(function (x) { online(x, x.data); }); }, join));
      box.appendChild(nbox);
      if (join) { var jb = nbox.querySelector('.kg-net__join button'); if (jb) setTimeout(function () { jb.click(); }, 50); }
    }, 0);
    function fresh() { return { qs: qPool(level, cat).slice(0, rounds).map(function (q) { return { q: q.q, a: q.a.slice(0, 4) }; }), res: {}, n: 1 }; }
    function online(sess, d) {
      var st = d.state, seat = sess.seat, stop = null;
      function show() {
        box.innerHTML = '';
        box.appendChild(el('p', { class: 'kg-net__small', text: T('Online game') + ' · ' + sess.code.replace(/(...)(...)/, '$1 $2') }));
        if (seat === 0 && !(d.seats && d.seats[1])) box.appendChild(K.net.card('duel', sess.code, false));
        var me = st.res && st.res[seat], him = st.res && st.res[1 - seat];
        if (!me) { box.appendChild(el('div', { class: 'kg-handoff' }, [el('h5', { text: '⚔️ ' + T('Quiz Duel') }), el('p', { text: st.qs.length + ' ' + T('questions. Your friend gets the same ones. Answer when you are ready; the scores are compared when you have both finished.') }), el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '▶ ' + T('Start'), onclick: run })])); return; }
        if (!him) { box.appendChild(el('div', { class: 'kg-done' }, [el('p', { class: 'kg-done__text', text: '⭐ ' + me.score + ' / ' + st.qs.length }), el('p', { text: T('Waiting for your friend to answer the same questions…') })])); return; }
        var w = me.score === him.score ? -1 : me.score > him.score ? 0 : 1;
        K.sound(w === 0 ? 'success' : 'good');
        var rows = el('ol', { class: 'kg-duel-sum' });
        st.qs.forEach(function (q, i) { rows.appendChild(el('li', {}, [el('span', { text: q.q + ' ' }), el('strong', { text: (me.ok[i] ? '✓' : '✗') + ' ' + T('You') + ' · ' + (him.ok[i] ? '✓' : '✗') + ' ' + T('Your friend') })])); });
        box.appendChild(el('div', { class: 'kg-done' }, [el('p', { class: 'kg-done__text', text: w < 0 ? '🤝 ' + T('A draw! Well played.') : w === 0 ? '🎉 ' + T('You won the game!') : '🙂 ' + T('Your friend won this time. Well played!') }), el('p', { text: T('You') + ' ' + me.score + ' · ' + T('Your friend') + ' ' + him.score }), rows,
          el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: T('Play again') + ' →', onclick: function () { var n = fresh(); n.n = (st.n || 1) + 1; K.net.put(sess, n).then(function () { st = n; show(); }).catch(function (e) { if (e && e.why === 'late' && e.data) { sess.v = e.data.v; st = e.data.state; show(); } }); } }),
            el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '🚪 ' + T('Leave this game'), onclick: function () { K.net.forget('duel'); if (stop) stop(); K.start(); } })])]));
      }
      function run() {
        var i = 0, score = 0, ok = [], area = el('div', { class: 'kg-duel' }), head = el('p', { class: 'kg-theme' });
        box.innerHTML = ''; box.appendChild(head); box.appendChild(area);
        (function one() {
          if (i >= st.qs.length) { var r = { score: score, ok: ok }; K.net.update(sess, function (cur) { cur = cur || st; cur.res = cur.res || {}; cur.res[seat] = r; return cur; }).then(function () { return K.net.get(sess); }).then(function (dd) { st = dd.state; show(); }).catch(function (e) { box.appendChild(el('p', { class: 'kg-net__msg', text: K.net.why(e) })); }); return; }
          head.textContent = T('Question') + ' ' + (i + 1) + ' / ' + st.qs.length;
          askQuestion(area, st.qs[i], { timer: secs }, function (good) { ok.push(!!good); if (good) score++; i++; one(); });
        })();
      }
      stop = K.net.watch(sess, function (dd, unchanged) { if (!dd) return; d = dd; if (unchanged) return; var ns2 = dd.state; if ((ns2.n || 1) !== (st.n || 1) || JSON.stringify(ns2.res) !== JSON.stringify(st.res)) { var playing = box.querySelector('.kg-q') && !(st.res && st.res[seat]); st = ns2; if (!playing) show(); } });
      show();
    }
    var catRow = el('div', { class: 'kg-levels', role: 'group', 'aria-label': 'Category' });
    function drawCats() { catRow.innerHTML = ''; [['mixed', 'Mixed'], ['ot', 'Old Testament'], ['nt', 'New Testament'], ['church', 'Church & Saints']].forEach(function (c) { catRow.appendChild(el('button', { class: 'kg-level', type: 'button', 'aria-pressed': cat === c[0] ? 'true' : 'false', text: c[1], onclick: function () { cat = c[0]; drawCats(); } })); }); }
    drawCats();
    box.appendChild(el('p', { class: 'kg-theme', text: 'Choose a category:' })); box.appendChild(catRow);
    /* 7.24.1: also one player against the computer */
    setupPlayers(box, '\u2694\ufe0f Quiz Duel', 'Play the computer, or two players take turns on this device. ' + rounds + ' questions each' + (secs ? ', ' + secs + ' seconds per question' : '') + '. Three right in a row earns a bonus point, and each player has one \ud83d\udcd6 Scripture help.', true, 1, function (ps) { play(ps.slice(0, 2)); }, [1, 2]);
    function play(ps) {
      var QS = qPool(level, cat), qi = 0, turn = 0, asked = [0, 0], streak = [0, 0], life = [true, true];
      var board = el('div', { class: 'kg-scores' }), area = el('div', { class: 'kg-duel' });
      box.innerHTML = ''; box.appendChild(board); box.appendChild(area);
      function drawBoard() { board.innerHTML = ''; ps.forEach(function (p, i) { board.appendChild(el('div', { class: 'kg-score' + (i === turn ? ' on' : ''), style: 'border-color:' + p.color }, [el('strong', { text: p.name }), el('span', { text: p.score + ' pts' }), streak[i] >= 2 ? el('small', { text: '\ud83d\udd25 ' + streak[i] }) : null])); }); }
      function handoff() {
        drawBoard(); var p = ps[turn];
        if (p.cpu) { area.innerHTML = ''; area.appendChild(el('p', { class: 'kg-board-who', text: 'The computer answers:' })); var ca = el('div'); area.appendChild(ca); setTimeout(function () { ask(ca); }, 700); return; }
        area.innerHTML = '';
        area.appendChild(el('div', { class: 'kg-handoff' }, [el('p', { text: 'Question ' + (asked[turn] + 1) + ' of ' + rounds }), el('h5', { text: p.name + '\u2019s turn', style: 'color:' + p.color }), el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: 'I\u2019m ready \u2192', onclick: ask })]));
      }
      function ask(where) {
        var q = QS[qi++ % QS.length], i = turn, cpu = ps[i].cpu;
        askQuestion(where && where.nodeType ? where : area, q, { lifeline: life[i] && !cpu, onLifeline: function () { life[i] = false; }, timer: cpu ? 0 : secs, cpu: cpu ? { easy: 0.45, medium: 0.6, hard: 0.75 }[level] : null }, function (ok) {
          asked[i]++;
          if (ok) { ps[i].score++; streak[i]++; if (streak[i] === 3) { ps[i].score++; streak[i] = 0; K.sound('collect'); } } else streak[i] = 0;
          if (asked[0] >= rounds && asked[1] >= rounds) return end();
          turn = 1 - turn; handoff();
        });
      }
      function end() {
        drawBoard(); area.innerHTML = '';
        var a = ps[0], b = ps[1], text = a.score === b.score ? 'It\u2019s a tie, ' + a.score + ' to ' + b.score + '! Well played, both of you.' : (a.score > b.score ? a : b).name + ' wins, ' + Math.max(a.score, b.score) + ' to ' + Math.min(a.score, b.score) + '!';
        var cpuWon = ps.some(function (p) { return p.cpu; }) && (a.cpu ? a.score > b.score : b.cpu ? b.score > a.score : false);
        if (cpuWon) { K.sound('miss'); area.appendChild(el('div', { class: 'kg-done' }, [el('p', { class: 'kg-done__text', text: 'The computer won this time, ' + Math.max(a.score, b.score) + ' to ' + Math.min(a.score, b.score) + '. Try again!' }), el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: 'Play again \u2192', onclick: function () { K.start(); } })])); return; }
        K.award('duel', level); K.celebrate(box, text);
      }
      handoff();
    }
  }

  /* 7.9.9: Journey to Jerusalem moved to games-journey.js (the new big board) */
  window.KJTGames.register({ id: 'duel', cat: 'family', icon: '\u2694\ufe0f', name: 'Quiz Duel', blurb: 'Who knows the Bible best? Play the computer or a friend', run: duel });
})();
