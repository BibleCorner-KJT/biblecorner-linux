/* KJT Kids Corner - Bible Games: Action (Site Core 5.5.0)
   Manna from Heaven, Jonah's Voyage, Two by Two. (7.9.18: Walls of Jericho removed.)
   Canvas games with a start screen, levels, personal bests and trophies.
   Touch, mouse and keyboard all work. */
(function () {
  'use strict';
  if (!window.KJTGames) return;
  var K = window.KJTGames.kit, el = K.el;

  /* ---------- shared arcade helpers ---------- */
  function arena(box, tall) {
    var w = Math.min(box.clientWidth || 640, 760), phone = w < 560;
    var LW = 400, LH = Math.round(LW * (phone ? (tall ? 1.35 : 1.15) : (tall ? 0.8 : 0.62)));
    var cv = el('canvas', { class: 'kga-canvas', 'aria-label': 'Game area' }), dpr = window.devicePixelRatio || 1;
    var CW = w, CH = Math.round(w * LH / LW);
    cv.width = Math.round(CW * dpr); cv.height = Math.round(CH * dpr); cv.style.width = CW + 'px'; cv.style.height = CH + 'px';
    var g = cv.getContext('2d'); g.setTransform(dpr * CW / LW, 0, 0, dpr * CH / LH, 0, 0);
    var wrap = el('div', { class: 'kga-wrap' }, [cv]);
    box.appendChild(wrap);
    function toL(e) { var r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * LW / r.width, (e.clientY - r.top) * LH / r.height]; }
    return { cv: cv, g: g, LW: LW, LH: LH, wrap: wrap, toL: toL };
  }
  function overlay(A, title, lines, button, onGo) {
    var o = el('div', { class: 'kga-over' }, [el('h5', { text: title })].concat(lines.map(function (l) { return el('p', { text: l }); })).concat([
      el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: button, onclick: function () { o.remove(); onGo(); } })]));
    A.wrap.appendChild(o); return o;
  }
  function loop(step, alive) {
    var last = performance.now(), id = 0, stopped = false;
    function f(t) { if (stopped || !alive()) return; var dt = Math.min(0.05, (t - last) / 1000); last = t; if (step(dt) !== false) id = requestAnimationFrame(f); }
    id = requestAnimationFrame(f);
    K.onLeave(function () { stopped = true; cancelAnimationFrame(id); });
    return function () { stopped = true; cancelAnimationFrame(id); };
  }
  function keys(map) {
    function down(e) { var fn = map[e.key]; if (fn) { e.preventDefault(); fn(e); } }
    window.addEventListener('keydown', down);
    K.onLeave(function () { window.removeEventListener('keydown', down); });
  }
  function hud(g, LW, items) {
    g.save(); g.font = '700 13px system-ui,sans-serif'; g.textBaseline = 'top';
    var x = 8; items.forEach(function (t) { var w = g.measureText(t).width + 14; g.fillStyle = 'rgba(255,255,255,.88)'; roundRect(g, x, 8, w, 22, 11); g.fill(); g.fillStyle = '#3E093F'; g.fillText(t, x + 7, 12); x += w + 6; });
    g.restore();
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function emoji(g, ch, x, y, size) { g.font = size + 'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, x, y); g.textAlign = 'start'; }
  function finish(box, id, level, score, dir, text, passed, extraLine) {
    var b = K.best(id, level, score, dir);
    if (passed) K.award(id, level);
    var extra = el('p', { class: 'kg-best', text: (b.isNew ? '\ud83c\udfc5 New personal best! ' : '') + 'Your best on this level: ' + b.best + (extraLine ? ' \u00b7 ' + extraLine : '') });
    if (passed) { K.sound('success'); K.celebrate(box, text, null, extra); }
    else { K.sound('sad'); var d = el('div', { class: 'kg-done' }, [el('p', { class: 'kg-done__text', text: text }), extra, el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: 'Try again \u2192', onclick: K.start }), el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83c\udfae All games', onclick: K.menu })])]); box.appendChild(d); }
  }

  /* =================================================================
     MANNA FROM HEAVEN (Exodus 16)
     ================================================================= */
  function manna(box, level, alive) {
    var cfg = { easy: { target: 8, speed: 70, rate: 1.0, basket: 78, time: 22, storms: 0, quail: 0 }, medium: { target: 12, speed: 95, rate: 1.4, basket: 66, time: 22, storms: 0.15, quail: 0.12 }, hard: { target: 16, speed: 125, rate: 1.9, basket: 56, time: 22, storms: 0.25, quail: 0.15 } }[level];
    var A = arena(box), g = A.g, LW = A.LW, LH = A.LH;
    var bx = LW / 2, items = [], day = 1, got = 0, t = 0, spawn = 0, score = 0, daysMet = 0, msg = '', msgT = 0, running = false;
    function target() { return day === 6 ? cfg.target * 2 : cfg.target; }
    function dayLen() { return day === 6 ? cfg.time + 10 : cfg.time; }
    function scene() {
      var sky = g.createLinearGradient(0, 0, 0, LH); sky.addColorStop(0, '#ffcf8a'); sky.addColorStop(1, '#fff1d6'); g.fillStyle = sky; g.fillRect(0, 0, LW, LH);
      g.fillStyle = '#f2c98a'; g.beginPath(); g.moveTo(0, LH * .72); g.quadraticCurveTo(LW * .3, LH * .62, LW * .6, LH * .72); g.quadraticCurveTo(LW * .8, LH * .78, LW, LH * .7); g.lineTo(LW, LH); g.lineTo(0, LH); g.fill();
      for (var i = 0; i < 4; i++) { var x = 40 + i * 95; g.fillStyle = '#c8a36b'; g.beginPath(); g.moveTo(x - 16, LH * .72); g.lineTo(x, LH * .65); g.lineTo(x + 16, LH * .72); g.fill(); }
    }
    function drawBasket() { var w = cfg.basket, y = LH - 34; g.fillStyle = '#a0692d'; g.beginPath(); g.moveTo(bx - w / 2, y); g.lineTo(bx + w / 2, y); g.lineTo(bx + w / 2 - 8, y + 24); g.lineTo(bx - w / 2 + 8, y + 24); g.fill(); g.strokeStyle = '#7a4d1c'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx - w / 2 + 4, y + 8); g.lineTo(bx + w / 2 - 4, y + 8); g.moveTo(bx - w / 2 + 6, y + 16); g.lineTo(bx + w / 2 - 6, y + 16); g.stroke(); }
    function add() {
      var r = K.rand(), type = r < cfg.storms ? 'storm' : r < cfg.storms + cfg.quail ? 'quail' : 'manna';
      items.push({ x: K.rnd(20, LW - 20), y: -20, v: cfg.speed * K.rnd(.85, 1.25) * (type === 'storm' ? 1.15 : 1), type: type });
    }
    function move(x) { bx = Math.max(cfg.basket / 2, Math.min(LW - cfg.basket / 2, x)); }
    A.cv.addEventListener('pointermove', function (e) { if (running) move(A.toL(e)[0]); });
    A.cv.addEventListener('pointerdown', function (e) { if (running) move(A.toL(e)[0]); });
    keys({ ArrowLeft: function () { move(bx - 28); }, ArrowRight: function () { move(bx + 28); } });
    function frame() {
      scene();
      items.forEach(function (it) {
        if (it.type === 'manna') { g.fillStyle = got >= target() ? '#d7e4a6' : '#fffbe8'; g.beginPath(); g.arc(it.x, it.y, 9, 0, 7); g.fill(); g.strokeStyle = '#d9c68a'; g.lineWidth = 1.5; g.stroke(); }
        else if (it.type === 'quail') emoji(g, '\ud83d\udc26', it.x, it.y, 22);
        else { g.fillStyle = 'rgba(160,110,60,.55)'; g.beginPath(); g.arc(it.x, it.y, 14, 0, 7); g.fill(); g.beginPath(); g.arc(it.x + 10, it.y + 4, 10, 0, 7); g.fill(); }
      });
      drawBasket();
      hud(g, LW, ['Day ' + day + ' of 6', '\ud83c\udf5e ' + Math.min(got, target()) + ' / ' + target(), '\u23f1 ' + Math.max(0, Math.ceil(dayLen() - t)), 'Score ' + score]);
      if (msgT > 0) { g.fillStyle = 'rgba(62,9,63,.85)'; roundRect(g, 20, LH / 2 - 22, LW - 40, 44, 12); g.fill(); g.fillStyle = '#fff'; g.font = '700 14px system-ui,sans-serif'; g.textAlign = 'center'; g.fillText(msg, LW / 2, LH / 2 + 5); g.textAlign = 'start'; }
    }
    function say(m) { msg = m; msgT = 2.2; }
    function playDay() {
      running = true; got = 0; t = 0; items = []; spawn = 0;
      if (day === 6) say('Day 6: gather a double portion for the Sabbath!');
      loop(function (dt) {
        t += dt; msgT -= dt; spawn -= dt;
        if (spawn <= 0 && t < dayLen() - 1) { add(); spawn = 1 / cfg.rate * K.rnd(.6, 1.3); }
        var by = LH - 34;
        items = items.filter(function (it) {
          it.y += it.v * dt;
          if (it.y > by - 4 && it.y < by + 22 && Math.abs(it.x - bx) < cfg.basket / 2 + 6) {
            if (it.type === 'storm') { score = Math.max(0, score - 2); K.sound('hit'); say('A dust storm! Watch out!'); }
            else if (got >= target()) { score = Math.max(0, score - 1); K.sound('hit'); say('You have enough! Extra manna spoils (Exodus 16:20).'); }
            else { var v = it.type === 'quail' ? 2 : 1; got += v; score += v; K.sound('collect'); if (got >= target()) say('Enough for today! Only gather what you need.'); }
            return false;
          }
          return it.y < LH + 30;
        });
        frame();
        if (t >= dayLen()) { running = false; if (got >= target()) daysMet++; nextDay(); return false; }
      }, alive);
    }
    function nextDay() {
      var met = got >= target();
      if (day < 6) { var d = day; day++; overlay(A, met ? '\u2705 Day ' + d + ' done!' : 'Day ' + d + ' is over', [met ? 'You gathered what your family needs.' : 'Not quite enough today, but God provides again tomorrow.'], 'Start day ' + day + ' \u2192', playDay); return; }
      frame();
      var o = overlay(A, 'Day 7: The Sabbath', ['No manna falls today. God gave a double portion yesterday so that everyone can rest (Exodus 16:26).', 'What will you do?'], '\ud83d\ude4f Rest with my family', function () { score += 5; K.sound('good'); end(true); });
      var go = el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: 'Go out and gather anyway', onclick: function () { o.remove(); overlay(A, 'There is nothing to gather', ['Some people went out on the Sabbath and found nothing (Exodus 16:27). God asks us to rest.'], '\ud83d\ude4f Rest after all', function () { end(false); }); } });
      o.appendChild(go);
    }
    function end(rested) {
      frame();
      var passed = daysMet >= 5;
      finish(box, 'manna', level, score, 'high', passed ? 'You gathered faithfully for six days' + (rested ? ' and rested on the Sabbath (+5)!' : '!') + ' Score: ' + score : 'Score: ' + score + '. Try to gather enough on at least 5 of the 6 days.', passed);
    }
    frame();
    overlay(A, '\ud83c\udf5e Manna from Heaven', ['God fed His people in the desert with bread from heaven.', 'Move the basket to catch the manna. Gather what you need each day: extra manna spoils!' + (cfg.storms ? ' Avoid the dust storms.' : ''), 'Drag, tap, or use the \u2190 \u2192 keys.'], '\u25b6 Start day 1', playDay);
  }

  /* =================================================================
     JONAH'S VOYAGE (Jonah 1-2)
     ================================================================= */
  function jonah(box, level, alive) {
    var cfg = { easy: { speed: 120, hearts: 5, gap: 1.5 }, medium: { speed: 160, hearts: 4, gap: 1.15 }, hard: { speed: 205, hearts: 3, gap: 0.9 } }[level];
    var A = arena(box), g = A.g, LW = A.LW, LH = A.LH;
    var lanes = [LH * .38, LH * .58, LH * .78], lane = 1, py = lanes[1], obs = [], stage = 1, t = 0, spawn = 1, hearts = cfg.hearts, prayers = 0, hurt = 0, scroll = 0;
    var STAGES = { 1: { len: 32, name: 'The storm at sea' }, 2: { len: 24, name: 'Inside the great fish' } };
    function bg() {
      if (stage === 1) {
        var s = g.createLinearGradient(0, 0, 0, LH); s.addColorStop(0, '#2c3440'); s.addColorStop(.3, '#4d5b6e'); s.addColorStop(.31, '#2e5f8a'); s.addColorStop(1, '#1c3a57'); g.fillStyle = s; g.fillRect(0, 0, LW, LH);
        g.strokeStyle = 'rgba(190,220,255,.5)'; g.lineWidth = 2; for (var r = 0; r < 6; r++) { g.beginPath(); for (var x = -40; x < LW + 40; x += 20) { var y = LH * .32 + r * LH * .11 + Math.sin((x + scroll * (1 + r * .2)) / 25) * 5; if (x === -40) g.moveTo(x, y); else g.lineTo(x, y); } g.stroke(); }
        if (Math.floor(t * 2) % 7 === 0) { g.fillStyle = 'rgba(255,255,200,.12)'; g.fillRect(0, 0, LW, LH); }
      } else {
        var s2 = g.createLinearGradient(0, 0, 0, LH); s2.addColorStop(0, '#5a1a2a'); s2.addColorStop(1, '#2a0c14'); g.fillStyle = s2; g.fillRect(0, 0, LW, LH);
        g.strokeStyle = 'rgba(255,200,200,.18)'; g.lineWidth = 6; for (var k = 0; k < 8; k++) { var xx = ((k * 70 - scroll * .6) % (LW + 70) + LW + 70) % (LW + 70) - 35; g.beginPath(); g.arc(xx, LH * .15, 60, .2, 2.9); g.stroke(); }
      }
    }
    function drawBoat() {
      var x = 60, y = py;
      if (hurt > 0 && Math.floor(hurt * 10) % 2) return;
      if (stage === 1) { g.fillStyle = '#8d6645'; g.beginPath(); g.moveTo(x - 24, y - 6); g.lineTo(x + 24, y - 6); g.lineTo(x + 16, y + 6); g.lineTo(x - 16, y + 6); g.fill(); g.strokeStyle = '#5d4037'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x, y - 30); g.stroke(); g.fillStyle = '#f5f0e6'; g.beginPath(); g.moveTo(x + 2, y - 28); g.lineTo(x + 18, y - 10); g.lineTo(x + 2, y - 10); g.fill(); }
      else { g.fillStyle = '#e8c4a0'; g.beginPath(); g.arc(x, y - 16, 7, 0, 7); g.fill(); g.fillStyle = '#6d4c41'; g.beginPath(); g.moveTo(x - 9, y + 4); g.quadraticCurveTo(x, y - 14, x + 9, y + 4); g.fill(); }
    }
    function add() {
      var l = K.ri(0, 2), prayer = K.rand() < .35;
      obs.push({ x: LW + 30, lane: l, kind: prayer ? 'prayer' : stage === 1 ? (K.rand() < .5 ? 'rock' : 'wave') : 'bone' });
    }
    function drawObs(o) {
      var y = lanes[o.lane];
      if (o.kind === 'prayer') { g.fillStyle = '#ffe082'; g.save(); g.translate(o.x, y - 6); g.beginPath(); for (var i = 0; i < 10; i++) { var r = i % 2 ? 5 : 12, a = i * Math.PI / 5 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); g.restore(); }
      else if (o.kind === 'rock') { g.fillStyle = '#6d6d6d'; g.beginPath(); g.moveTo(o.x - 18, y + 6); g.lineTo(o.x - 8, y - 16); g.lineTo(o.x + 10, y - 12); g.lineTo(o.x + 18, y + 6); g.fill(); }
      else if (o.kind === 'wave') { g.fillStyle = '#9ed0f5'; g.beginPath(); g.moveTo(o.x - 22, y + 6); g.quadraticCurveTo(o.x - 6, y - 30, o.x + 16, y - 10); g.quadraticCurveTo(o.x + 4, y - 12, o.x + 4, y + 6); g.fill(); }
      else { g.strokeStyle = '#f3e3d3'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(o.x, y - 20); g.quadraticCurveTo(o.x + 10, y - 6, o.x, y + 6); g.stroke(); }
    }
    function laneTo(n) { lane = Math.max(0, Math.min(2, n)); K.sound('step'); }
    A.cv.addEventListener('pointerdown', function (e) { var p = A.toL(e); laneTo(p[1] < py ? lane - 1 : lane + 1); });
    keys({ ArrowUp: function () { laneTo(lane - 1); }, ArrowDown: function () { laneTo(lane + 1); } });
    function run() {
      t = 0; obs = []; spawn = 1;
      loop(function (dt) {
        t += dt; scroll += cfg.speed * dt; spawn -= dt; hurt = Math.max(0, hurt - dt);
        py += (lanes[lane] - py) * Math.min(1, dt * 12);
        if (spawn <= 0 && t < STAGES[stage].len - 2) { add(); spawn = cfg.gap * K.rnd(.7, 1.3); }
        var v = cfg.speed * (1 + t / 60);
        obs = obs.filter(function (o) {
          o.x -= v * dt;
          if (Math.abs(o.x - 60) < 22 && o.lane === lane) {
            if (o.kind === 'prayer') { prayers++; K.sound('collect'); return false; }
            if (hurt <= 0) { hearts--; hurt = 1.2; K.sound('hit'); }
            return false;
          }
          return o.x > -40;
        });
        bg(); obs.forEach(drawObs); drawBoat();
        hud(g, LW, [STAGES[stage].name, '\u2764\ufe0f ' + hearts, '\u2b50 ' + prayers, '\u23f1 ' + Math.max(0, Math.ceil(STAGES[stage].len - t))]);
        if (hearts <= 0) { finish(box, 'jonah', level, prayers, 'high', 'The storm was too strong this time. Prayers gathered: ' + prayers + '.', false); return false; }
        if (t >= STAGES[stage].len) {
          if (stage === 1) { stage = 2; overlay(A, '\ud83d\udc0b A great fish!', ['The sailors threw Jonah into the sea, and God sent a great fish to swallow him.', 'Inside the fish, Jonah prayed. Keep gathering prayers and avoid the bones!'], '\u25b6 Keep going', run); }
          else { K.sound('splash'); overlay(A, '\ud83c\udfd6\ufe0f Dry land!', ['The fish spat Jonah out onto dry land. \u201cSalvation is of the LORD\u201d (Jonah 2:9).', 'Now Jonah goes to Nineveh as God asked.'], 'See my score', function () { finish(box, 'jonah', level, prayers + hearts * 3, 'high', 'You made it through the storm and the great fish! Score: ' + (prayers + hearts * 3) + '.', true); }); }
          return false;
        }
      }, alive);
    }
    bg(); drawBoat();
    overlay(A, '\u26f5 Jonah\u2019s Voyage', ['God sent a great storm when Jonah ran away.', 'Move between the three lanes to avoid rocks and waves, and gather \u2b50 prayers.', 'Tap above or below the boat, or use the \u2191 \u2193 keys.'], '\u25b6 Set sail', run);
  }

  /* =================================================================
     TWO BY TWO (Genesis 7)
     ================================================================= */
  function twoByTwo(box, level, alive) {
    var cfg = { easy: { goal: 8, speed: 26, misses: 5, kinds: 6 }, medium: { goal: 12, speed: 34, misses: 4, kinds: 9 }, hard: { goal: 16, speed: 44, misses: 3, kinds: 12 } }[level];
    var ANIMALS = K.shuffle(['\ud83d\udc11', '\ud83d\udc04', '\ud83d\udc18', '\ud83e\udd92', '\ud83e\udd81', '\ud83d\udc0e', '\ud83d\udc2a', '\ud83d\udc13', '\ud83d\udc07', '\ud83d\udc22', '\ud83e\udd8a', '\ud83d\udc3b', '\ud83d\udc12', '\ud83e\udd93', '\ud83e\udd8c', '\ud83e\udd86', '\ud83d\udc10', '\ud83d\udc16']).slice(0, cfg.kinds);
    var A = arena(box, true), g = A.g, LW = A.LW, LH = A.LH;
    var lanes = [LH * .34, LH * .52, LH * .7, LH * .86], mobs = [], sel = null, pairs = 0, misses = 0, t = 0, spawn = 0, flying = [], idn = 0, msg = '', msgT = 0;
    var arkX = LW - 62;
    function scene() {
      var s = g.createLinearGradient(0, 0, 0, LH); s.addColorStop(0, '#9fd3ff'); s.addColorStop(.25, '#dff1ff'); s.addColorStop(.26, '#a8d98f'); s.addColorStop(1, '#7cbf6a'); g.fillStyle = s; g.fillRect(0, 0, LW, LH);
      g.fillStyle = 'rgba(80,90,110,.35)'; [[80, 40, 30], [120, 36, 34], [300, 44, 28], [330, 48, 22]].forEach(function (c) { g.beginPath(); g.arc(c[0], c[1], c[2], 0, 7); g.fill(); });
      /* The ark: a wooden hull with a house on top, and a ramp for the animals. */
      var top = LH * .3, base = LH * .93, x0 = arkX - 40, x1 = LW - 4;
      g.fillStyle = '#8d5a2b'; g.beginPath(); g.moveTo(x0 - 6, base - LH * .2); g.lineTo(x1 + 6, base - LH * .2); g.lineTo(x1 - 6, base); g.lineTo(x0 + 6, base); g.closePath(); g.fill();
      g.strokeStyle = '#6d4221'; g.lineWidth = 2; for (var k = 1; k < 4; k++) { var yy = base - LH * .2 + k * LH * .05; g.beginPath(); g.moveTo(x0, yy); g.lineTo(x1, yy); g.stroke(); }
      g.fillStyle = '#a8743f'; g.fillRect(x0 + 6, top + LH * .08, x1 - x0 - 12, base - LH * .2 - top - LH * .08);
      g.fillStyle = '#6d4221'; g.beginPath(); g.moveTo(x0, top + LH * .09); g.lineTo((x0 + x1) / 2, top); g.lineTo(x1, top + LH * .09); g.closePath(); g.fill();
      g.fillStyle = '#3e2412'; roundRect(g, x0 + 10, LH * .5, 26, LH * .2, 6); g.fill();
      g.strokeStyle = '#6d4221'; g.lineWidth = 5; g.beginPath(); g.moveTo(x0 + 14, LH * .7); g.lineTo(x0 - 20, LH * .9); g.stroke();
      g.fillStyle = '#fff'; g.font = '700 11px system-ui'; g.fillText('ARK', (x0 + x1) / 2 - 11, top + LH * .06);
    }
    function add() {
      var kind = K.pick(ANIMALS), a = K.ri(0, 3), b = (a + K.ri(1, 3)) % 4, id = ++idn;
      mobs.push({ id: id, kind: kind, lane: a, x: -20, v: cfg.speed * K.rnd(.8, 1.2) }, { id: id, kind: kind, lane: b, x: -20 - K.rnd(40, 160), v: cfg.speed * K.rnd(.8, 1.2) });
    }
    function say(m) { msg = m; msgT = 1.8; }
    A.cv.addEventListener('pointerdown', function (e) {
      var p = A.toL(e), hit = null;
      mobs.forEach(function (m) { if (Math.abs(m.x - p[0]) < 22 && Math.abs(lanes[m.lane] - p[1]) < 24) hit = m; });
      if (!hit) return;
      if (!sel || sel === hit) { sel = sel === hit ? null : hit; K.sound('step'); return; }
      if (sel.kind === hit.kind && sel !== hit) { mobs = mobs.filter(function (m) { return m !== sel && m !== hit; }); flying.push({ kind: hit.kind, x: hit.x, y: lanes[hit.lane], t: 0 }, { kind: sel.kind, x: sel.x, y: lanes[sel.lane], t: 0 }); pairs++; K.sound('good'); sel = null; }
      else { K.sound('miss'); say('Those two don\u2019t match!'); sel = hit; }
    });
    function run() {
      loop(function (dt) {
        t += dt; spawn -= dt; msgT -= dt;
        var onField = mobs.length / 2;
        if (spawn <= 0 && onField < 3 + (level === 'hard' ? 2 : level === 'medium' ? 1 : 0)) { add(); spawn = K.rnd(1.2, 2.4) / (1 + t / 90); }
        scene();
        var lost = null;
        mobs.forEach(function (m) { m.x += m.v * (1 + t / 120) * dt; if (m.x > arkX - 36) lost = m; });
        if (lost) { mobs = mobs.filter(function (m) { return m.id !== lost.id; }); if (sel && sel.id === lost.id) sel = null; misses++; K.sound('hit'); say('Noah sends it back to find its partner!'); }
        mobs.forEach(function (m) { var y = lanes[m.lane]; if (m === sel) { g.strokeStyle = '#F3C548'; g.lineWidth = 4; g.beginPath(); g.arc(m.x, y, 21, 0, 7); g.stroke(); } emoji(g, m.kind, m.x, y, 30); });
        flying = flying.filter(function (f) { f.t += dt; var k = Math.min(1, f.t / .7); emoji(g, f.kind, f.x + (arkX - 17 - f.x) * k, f.y + (LH * .5 - f.y) * k, 30 * (1 - k * .5)); return k < 1; });
        hud(g, LW, ['\ud83d\udc3e Pairs ' + pairs + ' / ' + cfg.goal, '\u274c ' + misses + ' / ' + cfg.misses]);
        if (msgT > 0) { g.fillStyle = 'rgba(62,9,63,.85)'; roundRect(g, 20, LH * .12, LW - 110, 30, 10); g.fill(); g.fillStyle = '#fff'; g.font = '700 12px system-ui'; g.fillText(msg, 30, LH * .12 + 19); }
        if (pairs >= cfg.goal) { finish(box, 'twobytwo', level, Math.round(t), 'low', 'The ark is full! All ' + cfg.goal + ' pairs went in, two by two, in ' + Math.round(t) + ' seconds.', true, 'fewest seconds wins'); return false; }
        if (misses >= cfg.misses) { finish(box, 'twobytwo', level, 999, 'low', 'Too many animals were sent back. You brought in ' + pairs + ' pairs.', false); return false; }
      }, alive);
    }
    scene();
    overlay(A, '\ud83d\udc3e Two by Two', ['The animals came to Noah two by two (Genesis 7:9).', 'Tap an animal, then tap its partner, to send them into the ark together. Don\u2019t let a single animal reach the ark alone!'], '\u25b6 Open the ark', run);
  }

  window.KJTGames.register({ id: 'manna', cat: 'action', icon: '\ud83c\udf5e', name: 'Manna from Heaven', blurb: 'Gather God\u2019s bread in the desert, but only what you need', daily: true, run: manna });
  window.KJTGames.register({ id: 'jonah', cat: 'action', icon: '\u26f5', name: 'Jonah\u2019s Voyage', blurb: 'Sail through the storm and out of the great fish', daily: true, run: jonah });
  window.KJTGames.register({ id: 'twobytwo', cat: 'action', icon: '\ud83d\udc3e', name: 'Two by Two', blurb: 'Send the animals into the ark in pairs', daily: true, run: twoByTwo });
})();
