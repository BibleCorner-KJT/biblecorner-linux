/* KJT Kids Corner - Bible Adventures: The Armour of God (Site Core 7.9.11)
   Ephesians 6:10-18. The child starts small, weak and afraid in a village under a dark cloud.
   The Archangel Michael brings a message from God, and in seven missions the child receives
   the belt of truth, the breastplate of righteousness, the shoes of the gospel of peace, the
   shield of faith, the helmet of salvation, the sword of the Spirit and prayer. Each piece
   appears on the child. A mission can be failed (wrong choices have real consequences): try
   again, or go on without that piece.
   The last battle depends on what the child carries: with the whole armour the child stands,
   protects the friends, and the Lord Jesus comes in glory and casts the devil down (shown as a
   great light, never as a picture). With pieces missing the child is beaten but survives, to
   come back stronger. With no armour at all the darkness wins (told plainly but with hope).
   Uses the David & Goliath engine (adventure.js): scenes, characters and the Faith Journey.
   Scripture is shown from the Bible of the page language when there is one. */
(function () {
  'use strict';
  function boot() {
    var KA = window.KJTAdventure; if (!KA || !KA.kit) return setTimeout(boot, 200);
    var K = KA.kit, A = K.A, $ = K.$, wait = K.wait, img = K.img, load = K.load, store = K.store, clamp = K.clamp;
    var LANG = function () { return (window.KJT_LANG && window.KJT_LANG.lang) || 'en'; };
    function T(s) { return window.KJT_LANG && window.KJT_LANG.t && LANG() !== 'en' ? window.KJT_LANG.t(s) : s; }
    function passage(book, ch, v1, v2) {
      return new Promise(function (resolve) {
        if (LANG() === 'en') return resolve(null);
        var done = false, go = function () { if (done) return; done = true; if (!window.KJT_KIDS_PASSAGE) return resolve(null); window.KJT_KIDS_PASSAGE(book, ch, v1, v2).then(resolve, function () { resolve(null); }); };
        if (window.KJT_KIDS_PASSAGE) return go(); window.addEventListener('kjt-kids-passage-ready', go, { once: true }); setTimeout(go, 3500);
      });
    }
    /* a verse: [book, chapter, from, to, King James words, reference] */
    function V(v) { return passage(v[0], v[1], v[2], v[3]).then(function (t) { return { text: t || v[4], ref: v[5] }; }); }
    function sayVerse(g, who, v) { return V(v).then(function (x) { return g.say(who, '“' + x.text + '”', { ref: x.ref, verse: true }); }); }
    function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function alive(g) { return g.root && g.root.isConnected && KA.game() === g; }

    /* ---------------- the armour ---------------- */
    var ORDER = ['belt', 'breast', 'shoes', 'shield', 'helmet', 'sword', 'prayer'];
    var DRAW = ['shoes', 'belt', 'breast', 'sword', 'shield', 'helmet'];
    var NAME = { belt: 'The belt of truth', breast: 'The breastplate of righteousness', shoes: 'The shoes of the gospel of peace', shield: 'The shield of faith', helmet: 'The helmet of salvation', sword: 'The sword of the Spirit', prayer: 'Prayer' };
    var KEY = {
      belt: ['Ephesians', 6, 14, 14, 'Stand therefore, having your loins girt about with truth, and having on the breastplate of righteousness;', 'Ephesians 6:14'],
      breast: ['Ephesians', 6, 14, 14, 'Stand therefore, having your loins girt about with truth, and having on the breastplate of righteousness;', 'Ephesians 6:14'],
      shoes: ['Ephesians', 6, 15, 15, 'And your feet shod with the preparation of the gospel of peace;', 'Ephesians 6:15'],
      shield: ['Ephesians', 6, 16, 16, 'Above all, taking the shield of faith, wherewith ye shall be able to quench all the fiery darts of the wicked.', 'Ephesians 6:16'],
      helmet: ['Ephesians', 6, 17, 17, 'And take the helmet of salvation, and the sword of the Spirit, which is the word of God:', 'Ephesians 6:17'],
      sword: ['Ephesians', 6, 17, 17, 'And take the helmet of salvation, and the sword of the Spirit, which is the word of God:', 'Ephesians 6:17'],
      prayer: ['Ephesians', 6, 18, 18, 'Praying always with all prayer and supplication in the Spirit, and watching thereunto with all perseverance and supplication for all saints;', 'Ephesians 6:18']
    };
    var SKIP = { belt: 'Go on without the belt of truth', breast: 'Go on without the breastplate', shoes: 'Go on without the shoes of peace', shield: 'Go on without the shield of faith', helmet: 'Go on without the helmet of salvation', sword: 'Go on without the sword of the Spirit', prayer: 'Go on without prayer' };
    function rec() { var d = load(); return d.armour || {}; }
    function saveRec(r) { var d = load(); d.armour = r; store(d); }
    function has(p) { return (rec().virtues || []).indexOf(p) >= 0; }
    function kind() { return rec().hero || 'boy'; }
    function heroIn(g, x, h) {
      g.adv.who.hero.face = 'hero-' + kind();
      var f = FACE[kind()]; g.adv.who.hero.fx = f[0]; g.adv.who.hero.fy = f[1]; g.adv.who.hero.fs = f[2];
      return g.actor('hero', { img: 'hero-' + kind(), layers: DRAW.filter(has).map(layer), x: x, y: g.ground, h: h || 500, alt: 'You', speed: 300 });
    }
    /* 7.9.11: the warriors and their armour (pictures by the site owner): one layer per piece, per warrior */
    var FACE = { boy: [53, 21, 540], girl: [58, 22, 560] };
    function layer(p) { return 'arm-' + p + '-' + kind(); }
    function dress(g) { var a = g.actors.hero; if (a) g.actor('hero', { layers: DRAW.filter(has).map(layer) }); }
    /* receiving a piece: it shines onto the child, then the Faith Journey card */
    function receive(g, p) {
      var a = g.actors.hero; g.flashWhite(); A.fx('oil'); if (a) g.burst(a.x, a.y - a.h * 0.5, 'star', 34, { speed: 3, up: 1.4, r: 5, life: 1.3 });
      return V(KEY[p]).then(function (x) { return g.reward(p, x.text, x.ref); }).then(function () { dress(g); return wait(300); });
    }
    function lose(g, p, o) {
      o.skip = o.skip || SKIP[p]; o.pic = 'ic-' + p;
      /* the verse in the Bible of the page language */
      var m = o.ref && String(o.ref).match(/^(.+?)\s(\d+):(\d+)(?:[\u2013-](\d+))?$/);
      if (!m || LANG() === 'en') return g.fail(o);
      return passage(m[1], +m[2], +m[3], +(m[4] || m[3])).then(function (t) { if (t) o.verse = t; return g.fail(o); });
    }

    /* ---------------- the people ---------------- */
    var WHO = {
      hero: { name: 'You', face: 'hero-boy', fx: 50, fy: 26, fs: 330 },
      michael: { name: 'The Archangel Michael', face: 'michael', fx: 50, fy: 28, fs: 300 },
      devil: { name: 'The devil', face: 'devil', fx: 62, fy: 9, fs: 560 },
      woman: { name: 'Martha', face: 'npc-woman', fx: 50, fy: 28, fs: 330 },
      elder: { name: 'Old Simeon', face: 'npc-elder', fx: 50, fy: 28, fs: 330 },
      merchant: { name: 'Benjamin the merchant', face: 'npc-merchant', fx: 50, fy: 28, fs: 330 },
      child: { name: 'Little Anna', face: 'npc-child', fx: 50, fy: 52, fs: 330 },
      stranger: { name: 'A stranger', face: 'npc-stranger', fx: 50, fy: 30, fs: 330 }
    };
    function npc(g, id, x, opts) { opts = opts || {}; return g.actor(id, { img: 'npc-' + id, x: x, y: g.ground, h: opts.h || (id === 'child' ? 300 : 400), alt: T(WHO[id].name), speed: 220, flip: !!opts.flip, cls: opts.cls }); }
    function michaelIn(g, x) { g.flashWhite(); A.fx('chime'); g.glow(true, 'rgba(255,236,170,.45)'); var m = g.actor('michael', { img: 'michael', x: x, y: g.ground - 10, h: 520, alt: 'The Archangel Michael', cls: 'kad-appear kaa-holy' }); g.burst(x, g.ground - 300, 'star', 30, { speed: 2.6, up: 1, r: 4, life: 1.4 }); return m; }
    function michaelOut(g) { var m = g.actors.michael; if (!m) return wait(0); m.el.classList.add('kad-gone'); g.glow(false); return wait(1600).then(function () { g.remove('michael'); }); }

    /* ======================= mini-games ======================= */
    function panel(g, cls, kids) { g.clearUI(); var p = $('div', { class: 'kaa-panel ' + (cls || '') }, kids); g.ui.appendChild(p); return p; }

    /* True or false: the belt of truth */
    function truthGame(g) {
      var Q = shuffle([
        ['God made the heavens and the earth.', true], ['A little lie does not matter to God.', false], ['Jesus rose from the dead on the third day.', true],
        ['God loves only grown-ups, not small children.', false], ['God will never leave you nor forsake you.', true], ['If nobody sees you do wrong, it is not wrong.', false],
        ['Jesus is the way, the truth and the life.', true], ['You have to be big and strong before God can help you.', false]
      ]).slice(0, 6);
      return new Promise(function (res, rej) {
        var i = 0, wrong = 0, card, fb;
        function ask() {
          if (!alive(g)) return;
          var q = Q[i];
          card = panel(g, 'kaa-tf', [$('p', { class: 'kaa-eyebrow', text: 'True or false?' }), $('p', { class: 'kaa-count', text: (i + 1) + ' / ' + Q.length }), $('p', { class: 'kaa-big', text: q[0] }),
            $('div', { class: 'kaa-row' }, [$('button', { class: 'kaa-btn kaa-btn--true', type: 'button', text: '✔ True', onclick: function () { pick(true); } }), $('button', { class: 'kaa-btn kaa-btn--false', type: 'button', text: '✘ False', onclick: function () { pick(false); } })]),
            fb = $('p', { class: 'kaa-fb', 'aria-live': 'polite' })]);
        }
        function pick(v) {
          if (card.classList.contains('done')) return; card.classList.add('done');
          var ok = v === Q[i][1]; A.fx(ok ? 'chime' : 'wobble'); if (!ok) { wrong++; g.shake(300); }
          fb.textContent = ok ? (Q[i][1] ? 'Yes! That is the truth.' : 'Right: that is a lie!') : (Q[i][1] ? 'No, that is true!' : 'No, that is a lie!');
          setTimeout(function () {
            if (wrong >= 2) return rej('lost');
            i++; if (i < Q.length) ask(); else { g.clearUI(); res(); }
          }, 1300);
        }
        ask();
      });
    }

    /* Put the story of salvation in order: the helmet of salvation */
    function orderGame(g) {
      var S = ['Jesus is born in Bethlehem.', 'Jesus teaches, heals the sick and forgives sinners.', 'Jesus dies on the Cross for our sins.', 'Jesus rises from the dead on the third day.', 'Jesus goes up into heaven, and sends the Holy Spirit.'];
      return new Promise(function (res, rej) {
        var next = 0, wrong = 0, list = $('div', { class: 'kaa-order' }), done = $('ol', { class: 'kaa-order__done' }), fb = $('p', { class: 'kaa-fb', 'aria-live': 'polite' });
        panel(g, 'kaa-orderp', [$('p', { class: 'kaa-eyebrow', text: 'Remember what Jesus has done for you' }), $('p', { class: 'kaa-sub', text: 'Tap the events in the right order, from the first to the last.' }), done, list, fb]);
        shuffle(S).forEach(function (t) {
          var b = $('button', { class: 'kaa-card', type: 'button', text: t, onclick: function () {
            if (b.disabled) return;
            if (t === S[next]) { b.disabled = true; b.classList.add('ok'); A.fx('chime'); done.appendChild($('li', { text: t })); next++; fb.textContent = ''; if (next === S.length) setTimeout(function () { g.clearUI(); res(); }, 900); }
            else { wrong++; A.fx('wobble'); b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope'); fb.textContent = wrong >= 3 ? 'Think: what happened first? Then what came next?' : 'Not yet. What happened before that?'; if (wrong >= 5) setTimeout(function () { rej('lost'); }, 600); }
          } });
          list.appendChild(b);
        });
      });
    }

    /* Finish the verse: learning the sword of the Spirit */
    function verseGame(g) {
      var VS = [
        { pre: 'Man shall not live by', gap: 'bread', post: 'alone, but by every word of God.', opts: ['bread', 'games', 'money', 'sleep'], ref: 'Luke 4:4' },
        { pre: 'Thou shalt worship the Lord thy God, and him', gap: 'only', post: 'shalt thou serve.', opts: ['only', 'sometimes', 'later', 'never'], ref: 'Luke 4:8' },
        { pre: 'Thou shalt not', gap: 'tempt', post: 'the Lord thy God.', opts: ['tempt', 'love', 'thank', 'praise'], ref: 'Luke 4:12' }
      ];
      return new Promise(function (res, rej) {
        var i = 0, wrong = 0;
        function ask() {
          var v = VS[i], fb = $('p', { class: 'kaa-fb', 'aria-live': 'polite' }), gap = $('span', { class: 'kaa-gap', text: '_____' });
          var row = $('div', { class: 'kaa-row kaa-row--wrap' });
          panel(g, 'kaa-verse', [$('p', { class: 'kaa-eyebrow', text: 'Sharpen your sword: finish the verse' }), $('p', { class: 'kaa-count', text: (i + 1) + ' / ' + VS.length }),
            $('p', { class: 'kaa-big kaa-big--verse' }, [$('span', { text: v.pre }), ' ', gap, ' ', $('span', { text: v.post })]), $('p', { class: 'kaa-ref', text: v.ref }), row, fb]);
          shuffle(v.opts).forEach(function (o) { var lab = T('gap:' + o); if (lab === 'gap:' + o) lab = o; row.appendChild($('button', { class: 'kaa-btn', type: 'button', text: lab, 'data-kjt-notr': '', onclick: function () {
            if (o === v.gap) { gap.textContent = lab; gap.classList.add('ok'); A.fx('chime'); fb.textContent = 'Yes! Jesus said these words when the devil tempted Him.'; setTimeout(function () { i++; if (i < VS.length) ask(); else { g.clearUI(); res(); } }, 1500); }
            else { wrong++; A.fx('wobble'); g.shake(250); this.disabled = true; fb.textContent = 'Not that word. Try again.'; if (wrong >= 3) setTimeout(function () { rej('lost'); }, 500); }
          } })); });
        }
        ask();
      });
    }

    /* Hold to pray, and do not let the distractions take you away: prayer */
    function prayerGame(g) {
      var FOR = ['For my family', 'For my friends', 'For the people who are unkind to me', 'Thank You, Lord, for everything', 'Forgive me, Lord, and help me'];
      var DIS = ['Come and play instead!', 'Prayer is boring!', 'Look at this, quick!', 'You can pray tomorrow.', 'Your game is waiting!', 'God is not listening anyway.'];
      return new Promise(function (res, rej) {
        var lit = 0, strikes = 0, holding = false, fill = 0, raf = 0, last = 0, timer = 0;
        var candles = $('div', { class: 'kaa-candles' }), what = $('p', { class: 'kaa-big kaa-pray-for' }), bar = $('div', { class: 'kaa-pbar' }, [$('i')]), fb = $('p', { class: 'kaa-fb', 'aria-live': 'polite' });
        FOR.forEach(function () { candles.appendChild($('span', { class: 'kaa-candle' }, [$('i', { class: 'kaa-flame' }), $('b')])); });
        var btn = $('button', { class: 'kaa-btn kaa-pray', type: 'button', text: '🙏 Hold to pray' });
        var box = panel(g, 'kaa-prayer', [$('p', { class: 'kaa-eyebrow', text: 'Light the candles with your prayers' }), $('p', { class: 'kaa-sub', text: 'Hold the button down to pray. Do not tap the things that try to distract you!' }), candles, what, bar, btn, fb]);
        function show() { what.textContent = lit < FOR.length ? FOR[lit] : ''; }
        show();
        function down(e) { e.preventDefault(); holding = true; btn.classList.add('on'); A.init(); }
        function up() { holding = false; btn.classList.remove('on'); }
        btn.addEventListener('pointerdown', down); btn.addEventListener('pointerup', up); btn.addEventListener('pointerleave', up); btn.addEventListener('pointercancel', up);
        function distract() {
          if (!alive(g) || lit >= FOR.length) return;
          var t = DIS[Math.floor(Math.random() * DIS.length)], d = $('button', { class: 'kaa-distract', type: 'button', text: t });
          d.style.left = (8 + Math.random() * 64) + '%'; d.style.top = (12 + Math.random() * 50) + '%';
          d.addEventListener('pointerdown', function (e) {
            e.stopPropagation(); e.preventDefault(); d.remove(); strikes++; fill = 0; A.fx('wobble'); g.shake(300);
            fb.textContent = strikes >= 3 ? '' : 'You stopped praying! (' + strikes + ' / 3)';
            if (strikes >= 3) { stop(); rej('lost'); }
          });
          g.stage.appendChild(d); setTimeout(function () { d.classList.add('kad-out'); setTimeout(function () { d.remove(); }, 300); }, 2600);
        }
        function stop() { cancelAnimationFrame(raf); clearInterval(timer); g.stage.querySelectorAll('.kaa-distract').forEach(function (x) { x.remove(); }); }
        timer = setInterval(distract, 1700);
        (function loop(now) {
          if (!alive(g)) return stop();
          var dt = last ? (now - last) / 1000 : 0; last = now;
          if (holding && lit < FOR.length) { fill += dt / 2.2; if (Math.random() < 0.08) A.fx('whirl', fill); }
          else fill = Math.max(0, fill - dt * 0.6);
          bar.firstChild.style.width = Math.min(100, fill * 100) + '%';
          if (fill >= 1) { candles.children[lit].classList.add('on'); A.fx('chime'); lit++; fill = 0; show(); if (lit >= FOR.length) { stop(); setTimeout(function () { g.clearUI(); res(); }, 900); return; } }
          raf = requestAnimationFrame(loop);
        })(performance.now());
      });
    }

    /* Fiery darts: tap each one before it reaches you (or your friends). Used in the forest and in the battle.
       o: { n, speed, shield: bool, friends: [actor ids], guard: bool (Michael guards the friends), onHit(target) } */
    function dartsGame(g, o) {
      var DOUBT = ['God has forgotten you!', 'You are too small!', 'Nobody loves you!', 'Give up!', 'You will fail!', 'God does not hear you!', 'Be afraid!', 'You are all alone!'];
      return new Promise(function (res) {
        var sent = 0, alive2 = true, darts = [], hits = 0, blocked = 0, raf = 0, nextAt = performance.now() + 800;
        var layer = $('div', { class: 'kaa-darts' }); g.stage.appendChild(layer);
        function heroBox(id) { var a = g.actors[id]; if (!a) return null; var r = a.el.getBoundingClientRect(), s = g.stage.getBoundingClientRect(); return { x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height * 0.45, w: r.width }; }
        function spawn() {
          var targets = ['hero'].concat(o.friends || []), tid = targets[Math.floor(Math.random() * targets.length)], t = heroBox(tid); if (!t) return;
          var s = g.stage.getBoundingClientRect(), y0 = clamp(t.y + (Math.random() - 0.5) * 140, 80, s.height - 80);
          var el = $('button', { class: 'kaa-dart', type: 'button', 'aria-label': 'A fiery dart' }, [$('i', { class: 'kaa-dart__f' }), $('span', { class: 'kaa-dart__t', text: T(DOUBT[Math.floor(Math.random() * DOUBT.length)]) })]);
          var d = { el: el, x: s.width + 40, y: y0, tx: t.x, ty: t.y, tid: tid, v: (s.width) / ((o.speed || 2.6) - Math.min(1.1, sent * 0.07)) };
          el.addEventListener('pointerdown', function (e) { e.preventDefault(); e.stopPropagation(); block(d); });
          layer.appendChild(el); darts.push(d); sent++; A.fx('whoosh');
        }
        function block(d) {
          if (d.dead) return;
          if (!o.shield) { var m = $('div', { class: 'kad-hint', text: T('You have no shield to stop it!') }); g.stage.appendChild(m); setTimeout(function () { m.remove(); }, 900); return; }
          d.dead = true; blocked++; A.fx('clank'); d.el.classList.add('kaa-dart--out');
          var a = g.actors.hero; if (a) { a.el.classList.remove('kaa-block'); void a.el.offsetWidth; a.el.classList.add('kaa-block'); }
          setTimeout(function () { d.el.remove(); }, 400);
        }
        function hit(d) {
          d.dead = true; hits++; d.el.classList.add('kaa-dart--hit'); setTimeout(function () { d.el.remove(); }, 300);
          if (o.guard && d.tid !== 'hero') { A.fx('chime'); var m = g.actors.michael; if (m) g.burst(m.x, m.y - m.h * 0.5, 'star', 10, { speed: 2, r: 3, life: .7 }); return; }
          A.fx('hit'); g.shake(260); var r = g.root.querySelector('.kaa-hurt'); if (!r) { r = $('div', { class: 'kaa-hurt' }); g.stage.appendChild(r); } r.classList.remove('on'); void r.offsetWidth; r.classList.add('on');
          if (o.onHit && o.onHit(d.tid) === false) finish();
        }
        function finish() { if (!alive2) return; alive2 = false; cancelAnimationFrame(raf); setTimeout(function () { layer.remove(); res({ hits: hits, blocked: blocked }); }, 500); }
        var last = performance.now();
        (function loop(now) {
          if (!alive(g)) { layer.remove(); return; }
          var dt = (now - last) / 1000; last = now;
          if (sent < o.n && now >= nextAt) { spawn(); nextAt = now + Math.max(650, 1500 - sent * 60) + Math.random() * 500; }
          darts.forEach(function (d) {
            if (d.dead) return;
            var dx = d.tx - d.x, dy = d.ty - d.y, L = Math.hypot(dx, dy); if (L < 30) return hit(d);
            var step = d.v * dt; d.x += dx / L * step; d.y += dy / L * step;
            d.el.style.transform = 'translate(' + d.x.toFixed(1) + 'px,' + d.y.toFixed(1) + 'px)';
          });
          darts = darts.filter(function (d) { return !d.dead; });
          if (sent >= o.n && !darts.length) return finish();
          if (alive2) raf = requestAnimationFrame(loop);
        })(last);
      });
    }

    /* Stepping stones over the river: the shoes of the gospel of peace carry the good news across */
    function stonesGame(g) {
      var XS = [705, 800, 895, 990], BANK0 = 560, BANK1 = 1150, Y = 868;
      return new Promise(function (res, rej) {
        var at = -1, lives = 3, busy = false, t0 = performance.now(), raf = 0;
        var stones = XS.map(function (x, i) { var el = $('div', { class: 'kaa-stone' }, [$('i')]); g.layer.appendChild(el); return { x: x, el: el, ph: i * 0.9, up: true }; });
        var info = $('p', { class: 'kaa-fb kaa-fb--stay' });
        var jump = $('button', { class: 'kaa-btn kaa-jump', type: 'button', text: '⬆ Jump to the next stone' });
        panel(g, 'kaa-stonesp', [$('p', { class: 'kaa-eyebrow', text: 'Cross the river with the good news' }), $('p', { class: 'kaa-sub', text: 'The stones go under the water and come up again. Jump when the next stone is up!' }), jump, info]);
        function paintLives() { info.textContent = T('Tries left:') + ' ' + '❤️'.repeat(lives); }
        paintLives();
        function phase(st, now) { return ((now - t0) / 1000 + st.ph) % 3.2; }
        function up(st, now) { return phase(st, now) < 2.1; }
        (function loop(now) {
          if (!alive(g)) return;
          stones.forEach(function (st) { var ph = phase(st, now); st.up = ph < 2.1; st.el.classList.toggle('down', !st.up); st.el.classList.toggle('warn', ph > 1.55 && ph < 2.1); st.el.style.left = (st.x * g.s) + 'px'; st.el.style.top = (Y * g.s) + 'px'; st.el.style.setProperty('--s', g.s); });
          raf = requestAnimationFrame(loop);
        })(performance.now());
        function hop(toX, then) {
          var a = g.actors.hero, x0 = a.x, y0 = g.ground, t1 = performance.now(), D = 520; A.fx('whoosh');
          return new Promise(function (r2) { (function f(now) { var t = Math.min(1, (now - t1) / D); a.x = x0 + (toX - x0) * t; a.y = y0 - Math.sin(Math.PI * t) * 90; a.flip = toX < x0; a.el.classList.toggle('kad-flip', a.flip); g.place(a); if (t < 1) requestAnimationFrame(f); else { a.y = y0; g.place(a); r2(); } })(t1); }).then(then);
        }
        jump.addEventListener('click', function () {
          if (busy || !alive(g)) return; busy = true;
          var target = at + 1 < XS.length ? XS[at + 1] : BANK1;
          hop(target, function () {
            if (target === BANK1) { cancelAnimationFrame(raf); stones.forEach(function (s) { s.el.remove(); }); g.clearUI(); A.fx('cheer'); return res(); }
            var st = stones[at + 1], now2 = performance.now();
            /* a little kindness: a stone that was up when you jumped still holds you */
            if (!up(st, now2) && !up(st, now2 - 650)) {
              lives--; A.fx('splash'); g.shake(300); var a = g.actors.hero; a.el.classList.add('kaa-sink');
              return wait(800).then(function () { a.el.classList.remove('kaa-sink'); a.x = BANK0; g.place(a); at = -1; paintLives(); busy = false;
                if (lives <= 0) { cancelAnimationFrame(raf); stones.forEach(function (s) { s.el.remove(); }); rej('lost'); } });
            }
            at++; A.fx('step'); busy = false;
          });
        });
      });
    }

    /* ======================= the chapters ======================= */
    function ch1(g) { /* the village under the shadow: the belt of truth */
      return g.scene('village', { ground: 880, bounds: [140, 1540], ambience: 'camp', weather: 'tense' })
        .then(function () { A.music('sad'); return g.chapterTitle(1, 'Small and Afraid', 'A village under a dark cloud'); })
        .then(function () { return g.say('narrator', 'Once there was a little village under a dark cloud. Lies were spreading from house to house, people were afraid, and nobody smiled any more.'); })
        .then(function () { return g.choose('Who are you in this story?', [{ label: '⚔️ A young man', value: 'boy' }, { label: '⚔️ A young woman', value: 'girl' }], 'narrator'); })
        .then(function (k) { var r = rec(); r.hero = k; saveRec(r); heroIn(g, 360); g.follow = g.actors.hero; return g.say('hero', 'I am weak and afraid. When the dark cloud comes, I hide in my house. How could someone like me ever fight the darkness?'); })
        .then(function () { return wait(400); })
        .then(function () { michaelIn(g, 1000); return wait(900); })
        .then(function () { A.music('calm'); return g.say('michael', 'Fear not! I am Michael, a servant of the Most High God. The Lord has seen your village, and He has seen you.'); })
        .then(function () { return g.say('michael', 'The enemy, the devil, is coming against this land with his fiery darts. You cannot win with your own strength. But God gives His armour to all who trust in Him.'); })
        .then(function () { return sayVerse(g, 'michael', ['Ephesians', 6, 10, 11, 'Finally, my brethren, be strong in the Lord, and in the power of his might. Put on the whole armour of God, that ye may be able to stand against the wiles of the devil.', 'Ephesians 6:10–11']); })
        .then(function () { return g.say('michael', 'There are seven gifts. Find them one by one. The first is the belt of truth. In this village the devil is spreading lies. Listen to the people, and learn to tell truth from lies.'); })
        .then(function () { return michaelOut(g); })
        .then(function () {
          npc(g, 'woman', 620); npc(g, 'stranger', 980, { flip: true }); npc(g, 'elder', 1380, { flip: true });
          g.quest('The belt of truth', ['Talk to Martha', 'Talk to the stranger', 'Talk to old Simeon', 'Find out who is lying']);
          g.explore(true);
          return new Promise(function (res) {
            var heard = {}, n = 0;
            function talk(id, i, lines) {
              var o = g.spot({ x: g.actors[id].x, y: g.ground - 250, r: 90, label: T(WHO[id].name), icon: '💬', near: 140, onReach: function () {
                g.explore(false);
                return lines.reduce(function (p, l) { return p.then(function () { return g.say(l[0], l[1], l[2]); }); }, Promise.resolve()).then(function () {
                  if (!heard[id]) { heard[id] = 1; n++; g.tick(i); } g.unspot(o); if (n >= 3) res(); else g.explore(true);
                });
              } });
            }
            talk('woman', 0, [['woman', 'Do not be afraid, my friend. God loves you, and He will never leave you. My mother taught me that, and it is still true.'], ['woman', '“I will never leave thee, nor forsake thee.” That is what the Lord says.', { ref: 'Hebrews 13:5' }]]);
            talk('stranger', 1, [['stranger', 'Heh heh… Listen, my friend. God does not care about people like you. And if nobody sees you do something wrong, then it is not wrong at all.'], ['stranger', 'Everyone tells little lies. They do not matter. Trust me…']]);
            talk('elder', 2, [['elder', 'I am old, child, and I have seen many dark clouds. Jesus said: “I am the way, the truth, and the life.” Hold on to Him, and the lies cannot hold you.', { ref: 'John 14:6' }]]);
          });
        })
        .then(function () { g.explore(false); return g.choose('Who told you lies?', [{ label: 'Martha', value: 1 }, { label: 'The stranger', value: 2 }, { label: 'Old Simeon', value: 3 }]); })
        .then(function (v) {
          if (v !== 2) return lose(g, 'belt', { icon: '🌫️', eyebrow: 'The lie fooled you', title: 'You believed a lie', text: 'The stranger said that God does not care about children and that hidden sins are not wrong. Those were lies. When we cannot tell truth from lies, the enemy can lead us anywhere.', verse: 'And ye shall know the truth, and the truth shall make you free.', ref: 'John 8:32', tip: 'Compare what each person says with what God says in the Bible.' });
          g.tick(3); var s = g.actors.stranger; s.el.classList.add('kad-gone'); A.fx('flee');
          return g.say('narrator', 'The stranger hissed, pulled his hood down over his face, and slipped away into the shadows. He was one of the devil’s helpers!').then(function () { g.remove('stranger'); return g.say('elder', 'Well done, child. Now let us see if you can always tell the truth from a lie.'); });
        })
        .then(function () { g.quest(null); return truthGame(g).catch(function () { return lose(g, 'belt', { icon: '🌫️', eyebrow: 'Too many lies got through', title: 'You were not sure what is true', text: 'Some lies sounded true to you. Without the belt of truth, the devil can trick you again and again.', verse: 'Thy word is a lamp unto my feet, and a light unto my path.', ref: 'Psalm 119:105', tip: 'Ask yourself: does God say this in the Bible?' }); }); })
        .then(function () { return g.say('narrator', 'A golden light shone around you. The belt of truth was fastened around your waist.'); })
        .then(function () { return receive(g, 'belt'); });
    }

    function ch2(g) { /* the market: the breastplate of righteousness */
      return g.scene('market', { ground: 880, bounds: [140, 1540], ambience: 'camp' })
        .then(function () { A.music('calm'); return g.chapterTitle(2, 'The Market', 'Doing what is right when nobody is watching'); })
        .then(function () { heroIn(g, 260); g.follow = g.actors.hero; npc(g, 'merchant', 1150, { flip: true }); return g.say('narrator', 'Michael had told you: “The breastplate of righteousness protects your heart. It belongs to those who do what is right, even when it is hard.” So you went to the busy market.'); })
        .then(function () { g.quest('The breastplate of righteousness', ['Buy bread for your mother', 'Help someone in need', 'Stand up for what is right']); return g.walk('hero', 960); })
        .then(function () { return g.say('merchant', 'Here is your bread, young one. And here is your change… oh, I am in such a hurry today!'); })
        .then(function () { return g.say('narrator', 'You look at the coins in your hand. The merchant gave you far too much: three silver coins instead of one!'); })
        .then(function () { return g.choose('What do you do?', [{ label: 'Keep the coins quietly. He will never notice.', value: 1 }, { label: 'Give the extra coins back to him.', value: 2 }, { label: 'Buy sweets with the extra money.', value: 3 }]); })
        .then(function (v) {
          if (v !== 2) return lose(g, 'breast', { icon: '💰', eyebrow: 'A crack in your heart', title: 'You kept what was not yours', text: 'Nobody saw it, but God did, and your heart knew it too. Keeping what is not ours is stealing. The breastplate of righteousness cannot cover a heart that chooses wrong.', verse: 'Thou shalt not steal.', ref: 'Exodus 20:15', tip: 'Do what is right even when nobody is watching.' });
          g.tick(0); A.fx('chime'); return g.say('merchant', 'Two extra coins? You gave them back? What an honest heart! May God bless you.');
        })
        .then(function () { npc(g, 'child', 520, { cls: 'kad-appear' }); return g.say('narrator', 'Behind a stall you see a little girl sitting alone. She is crying. She has not eaten all day.'); })
        .then(function () { return g.say('child', 'I am so hungry…'); })
        .then(function () { return g.choose('You have one loaf of bread for your family. What do you do?', [{ label: 'Pretend you did not see her.', value: 1 }, { label: 'Share your bread with her, and take her to her family.', value: 2 }, { label: 'Tell her to go away.', value: 3 }]); })
        .then(function (v) {
          if (v !== 2) return lose(g, 'breast', { icon: '🍞', eyebrow: 'You walked past', title: 'You did not help', text: 'The little girl stayed hungry and alone. Righteousness is not only about the wrong things we do not do; it is also about the good things we do for others.', verse: 'Inasmuch as ye have done it unto one of the least of these my brethren, ye have done it unto me.', ref: 'Matthew 25:40', tip: 'When you see someone in need, help them.' });
          g.tick(1); A.fx('chime'); return g.say('child', 'Thank you! You are kind… like the people in the stories about Jesus!');
        })
        .then(function () { npc(g, 'elder', 1450, { flip: true }); return g.say('narrator', 'Then some big boys start laughing at old Simeon. They push him and knock over his basket of figs.'); })
        .then(function () { return g.choose('The boys look at you. “Come on, laugh with us!”', [{ label: 'Laugh with them, so they like you.', value: 1 }, { label: 'Walk away and say nothing.', value: 2 }, { label: 'Say kindly: “Stop. He is our elder,” and help him pick up the figs.', value: 3 }]); })
        .then(function (v) {
          if (v !== 3) return lose(g, 'breast', { icon: '😔', eyebrow: 'You did not stand up', title: v === 1 ? 'You joined the bullies' : 'You left him alone', text: v === 1 ? 'Laughing at someone who is old and weak hurts them, and it hurts God too.' : 'Sometimes doing nothing is also a wrong choice. Old Simeon needed someone to stand with him.', verse: 'Thou shalt rise up before the hoary head, and honour the face of the old man, and fear thy God: I am the LORD.', ref: 'Leviticus 19:32', tip: 'Be brave and kind: stand up for people who are treated badly.' });
          g.tick(2); return g.say('elder', 'Thank you, child. You have a righteous heart. The boys have gone, and they looked ashamed.');
        })
        .then(function () { g.quest(null); return g.say('narrator', 'A shining breastplate covered your heart, strong and bright.'); })
        .then(function () { return receive(g, 'breast'); });
    }

    function ch3(g) { /* the river: the shoes of the gospel of peace */
      return g.scene('bridge', { ground: 880, bounds: [140, 1540], ambience: 'brook' })
        .then(function () { A.music('calm'); return g.chapterTitle(3, 'The Broken Bridge', 'Making peace, carrying the good news'); })
        .then(function () { heroIn(g, 260); g.follow = g.actors.hero; npc(g, 'woman', 420); npc(g, 'merchant', 1300, { flip: true }); return g.say('narrator', 'Two families live on the two sides of the river. Long ago they quarrelled, and they broke the bridge between them. Now they only shout at each other across the water.'); })
        .then(function () { return g.say('merchant', 'Your family broke our fence! We will never forgive you!'); })
        .then(function () { return g.say('woman', 'And your family stole our sheep! Stay on your side of the river!'); })
        .then(function () { g.quest('The shoes of the gospel of peace', ['Speak words of peace', 'Carry the good news across the river']); return g.choose('What do you say to Martha?', [{ label: '“They are bad people. Shout louder!”', value: 1 }, { label: '“Jesus forgives us, so we can forgive too. Let us make peace.”', value: 2 }, { label: '“It is not my problem.”', value: 3 }]); })
        .then(function (v) {
          if (v !== 2) return lose(g, 'shoes', { icon: '🗣️', eyebrow: 'The quarrel grew', title: 'No peace by the river', text: v === 1 ? 'Angry words made the quarrel bigger. Now the two families will not even look at each other.' : 'Turning away did not help. The families stayed enemies.', verse: 'A soft answer turneth away wrath: but grievous words stir up anger.', ref: 'Proverbs 15:1', tip: 'Peacemakers speak gently and remind people of God’s forgiveness.' });
          g.tick(0); return g.say('woman', 'Forgive… like Jesus forgives us? You are right, child. I am tired of being angry. Will you carry my message to the other side? Tell them: “We forgive you. Come, let us rebuild the bridge.”');
        })
        .then(function () { return g.say('narrator', 'The bridge is broken, but stepping stones cross the river. The water is fast: the stones go under and come up again.'); })
        .then(function () { return g.walk('hero', 560); })
        .then(function () { return stonesGame(g).catch(function () { return lose(g, 'shoes', { icon: '🌊', eyebrow: 'Into the water', title: 'You could not cross', text: 'The river was too fast, and the message of peace did not reach the other side.', verse: 'How beautiful are the feet of them that preach the gospel of peace, and bring glad tidings of good things!', ref: 'Romans 10:15', tip: 'Watch the next stone. Jump only when it has just come up.' }); }); })
        .then(function () { g.tick(1); return g.walk('hero', 1180); })
        .then(function () { return g.say('hero', 'Martha says: “We forgive you. Come, let us rebuild the bridge.”'); })
        .then(function () { return g.say('merchant', 'She… forgives us? Then we forgive them too! Blessed are the peacemakers! Come, everyone: we will build the bridge again, together.', { ref: 'Matthew 5:9' }); })
        .then(function () { A.fx('cheer'); g.quest(null); return g.say('narrator', 'Your feet began to shine. You were given shoes of peace, to carry the good news wherever you go.'); })
        .then(function () { return receive(g, 'shoes'); });
    }

    function ch4(g) { /* the dark forest: the shield of faith */
      return g.scene('forest', { ground: 880, bounds: [140, 1540], ambience: 'battle', weather: 'tense' })
        .then(function () { A.music('tense'); return g.chapterTitle(4, 'The Dark Forest', 'Fiery darts in the night'); })
        .then(function () { heroIn(g, 360); g.follow = g.actors.hero; return g.say('narrator', 'Night fell in the forest. Red light glowed between the trees, and you heard whispers in the dark.'); })
        .then(function () { g.actor('imp', { img: 'imp', x: 1380, y: g.ground - 20, h: 230, alt: 'A little demon', flip: true, cls: 'kad-appear' }); A.fx('growl'); return g.say('narrator', 'Little demons with bows! They are shooting fiery darts, and every dart carries a doubt: “God has forgotten you!” “Give up!”'); })
        .then(function () { michaelIn(g, 700); return g.say('michael', 'Quick, take this! It is the shield of faith. When a dart comes, lift your shield: trust God, and do not believe the doubt!'); })
        .then(function () { var r = rec(); r.virtues = r.virtues || []; return g.say('michael', 'Tap every dart before it reaches you. If three darts hit you, the doubts will win.'); })
        .then(function () { michaelOut(g); g.quest('The shield of faith', ['Stop the fiery darts: you can be hit only 2 times']); var hits = 0;
          /* Michael lends the shield for the fight; it is the child's to keep only if the darts are stopped */
          g.actor('hero', { layers: DRAW.filter(function (p) { return has(p) || p === 'shield'; }).map(layer) });
          return dartsGame(g, { n: 14, speed: 3.0, shield: true, onHit: function () { hits++; return hits < 3; } }).then(function (r) {
            if (r.hits >= 3) { dress(g); return lose(g, 'shield', { icon: '🔥', eyebrow: 'The doubts won', title: 'The darts struck you', text: 'Too many fiery darts got through. You started to believe them: “God has forgotten me.” But that is not true!', verse: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God.', ref: 'Isaiah 41:10', tip: 'Watch the right side of the screen and tap each dart as soon as you see it.' }); }
          });
        })
        .then(function () { var i = g.actors.imp; if (i) { i.el.classList.add('kad-gone'); A.fx('flee'); } g.quest(null); return g.say('narrator', 'The last dart broke against your shield and fell to the ground in sparks. The little demon ran away into the dark.'); })
        .then(function () { A.music('calm'); return g.say('hero', 'I trusted God, and the darts could not hurt me!'); })
        .then(function () { return receive(g, 'shield'); });
    }

    function ch5(g) { /* the hill of the Cross: the helmet of salvation */
      return g.scene('hill', { ground: 880, bounds: [140, 1540], ambience: 'hills', sparkles: [[840, 330], [800, 380], [880, 360]] })
        .then(function () { A.music('calm'); return g.chapterTitle(5, 'The Hill of the Cross', 'Remember what Jesus has done'); })
        .then(function () { heroIn(g, 300); g.follow = g.actors.hero; return g.say('narrator', 'At dawn you climbed a green hill. On the top stood an empty cross, and nearby an empty tomb. The sun was rising.'); })
        .then(function () { michaelIn(g, 1120); return g.say('michael', 'The helmet of salvation protects your mind. When the enemy says, “You are too bad for God,” remember what Jesus has done for you.'); })
        .then(function () { return michaelOut(g); })
        .then(function () { g.quest('The helmet of salvation', ['Remember the story of salvation', 'Answer Michael']); return orderGame(g).catch(function () { return lose(g, 'helmet', { icon: '✝️', eyebrow: 'You forgot', title: 'The story got mixed up', text: 'If we forget what Jesus has done, the enemy can make us think we are lost. The helmet of salvation is remembering that Jesus saves us.', verse: 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.', ref: 'John 3:16', tip: 'Jesus was born, He taught and healed, He died on the Cross, He rose again, and He went up into heaven.' }); }); })
        .then(function () { g.tick(0); michaelIn(g, 1120); return g.choose('Michael asks: “If you do something wrong and you are truly sorry, what will God do?”', [{ label: 'He will never forgive me.', value: 1 }, { label: 'He will forgive me, because Jesus died for my sins.', value: 2 }, { label: 'He will forgive me only if I am very good first.', value: 3 }], 'michael'); })
        .then(function (v) {
          if (v !== 2) return lose(g, 'helmet', { icon: '✝️', eyebrow: 'A lie in your mind', title: 'You forgot God’s mercy', text: 'The enemy wants you to believe that God will not forgive you. But Jesus died and rose again so that we can be forgiven.', verse: 'If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.', ref: '1 John 1:9', tip: 'God forgives everyone who is truly sorry and turns to Him.' });
          g.tick(1); return sayVerse(g, 'michael', ['1 John', 1, 9, 9, 'If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.', '1 John 1:9']);
        })
        .then(function () { g.quest(null); return michaelOut(g); })
        .then(function () { return receive(g, 'helmet'); });
    }

    function ch6(g) { /* the desert: the sword of the Spirit */
      return g.scene('desert', { ground: 880, bounds: [140, 1540], ambience: 'camp' })
        .then(function () { A.music('calm'); return g.chapterTitle(6, 'The Desert', 'The sword of the Spirit is the word of God'); })
        .then(function () { heroIn(g, 300); g.follow = g.actors.hero; michaelIn(g, 900); return g.say('michael', 'When the Lord Jesus was in the desert, the devil came to tempt Him three times. Jesus did not fight with a sword of iron. He answered with the word of God.', { ref: 'Luke 4:1–13' }); })
        .then(function () { return g.say('michael', 'The word of God is the sword of the Spirit. Learn these three verses, and your sword will be sharp.'); })
        .then(function () { g.quest('The sword of the Spirit', ['Learn the three verses', 'Answer the tempter']); return verseGame(g).catch(function () { return lose(g, 'sword', { icon: '📖', eyebrow: 'A blunt sword', title: 'You did not know the words', text: 'Without God’s word, we have nothing to answer the tempter with.', verse: 'Thy word have I hid in mine heart, that I might not sin against thee.', ref: 'Psalm 119:11', tip: 'Read each verse slowly. Which word makes sense?' }); }); })
        .then(function () { g.tick(0); return michaelOut(g); })
        .then(function () { npc(g, 'stranger', 1250, { flip: true, cls: 'kad-appear' }); A.fx('growl'); return g.say('stranger', 'Well, well… a little warrior in the desert. You must be so hungry. Look: nobody is here. Take the bread from that traveller’s bag. Who will know?'); })
        .then(function () { return g.choose('Answer the tempter with the word of God:', [{ label: 'Man shall not live by bread alone, but by every word of God.', value: 1 }, { label: 'Thou shalt not tempt the Lord thy God.', value: 2 }, { label: 'All right, just this once.', value: 3 }]); })
        .then(function (v) { if (v !== 1) return failSword(g); A.fx('hit'); g.shake(300); return g.say('stranger', 'Grr…! Then climb that high rock and jump! If God loves you, He must catch you!'); })
        .then(function () { return g.choose('Answer the tempter:', [{ label: 'Man shall not live by bread alone.', value: 1 }, { label: 'Thou shalt not tempt the Lord thy God.', value: 2 }, { label: 'Yes! Let me show you!', value: 3 }]); })
        .then(function (v) { if (v !== 2) return failSword(g); A.fx('hit'); g.shake(300); return g.say('stranger', 'Enough! Bow down to me, and I will give you everything you want: toys, sweets, all the games in the world!'); })
        .then(function () { return g.choose('Answer the tempter:', [{ label: 'Thou shalt worship the Lord thy God, and him only shalt thou serve.', value: 1 }, { label: 'Can I have the games first?', value: 2 }, { label: 'Thou shalt not tempt the Lord thy God.', value: 3 }]); })
        .then(function (v) {
          if (v !== 1) return failSword(g);
          A.fx('flee'); var s = g.actors.stranger; s.el.classList.add('kad-gone'); g.tick(1);
          return sayVerse(g, 'narrator', ['James', 4, 7, 7, 'Submit yourselves therefore to God. Resist the devil, and he will flee from you.', 'James 4:7']);
        })
        .then(function () { g.quest(null); g.remove('stranger'); return receive(g, 'sword'); });
    }
    function failSword(g) { return lose(g, 'sword', { icon: '🗡️', eyebrow: 'The tempter won', title: 'You did not answer with God’s word', text: 'The tempter twisted your words and you gave in. Each temptation needs the right word of God, just as Jesus answered in the desert.', verse: 'It is written, Man shall not live by bread alone, but by every word of God.', ref: 'Luke 4:4', tip: 'Bread: “not by bread alone”. Jumping to test God: “not tempt the Lord”. Bowing down: “worship the Lord only”.' }); }

    function ch7(g) { /* the holy mountain: prayer */
      return g.scene('mountain', { ground: 880, bounds: [140, 1540], ambience: 'hills', weather: 'tense' })
        .then(function () { A.music('calm'); return g.chapterTitle(7, 'The Holy Mountain', 'Praying always'); })
        .then(function () { heroIn(g, 260); g.follow = g.actors.hero; npc(g, 'elder', 760); return g.say('narrator', 'Before the great battle, old Simeon led you up the mountain to a little church at the top, where the monks pray day and night.'); })
        .then(function () { return g.say('elder', 'The armour is strong, child, but a soldier must also stay close to his King. That is prayer. Without prayer, even the best armour feels heavy.'); })
        .then(function () { return sayVerse(g, 'elder', ['Matthew', 26, 41, 41, 'Watch and pray, that ye enter not into temptation: the spirit indeed is willing, but the flesh is weak.', 'Matthew 26:41']); })
        .then(function () { g.quest('Prayer', ['Light five candles with your prayers']); return prayerGame(g).catch(function () { return lose(g, 'prayer', { icon: '🕯️', eyebrow: 'Distracted', title: 'You stopped praying', text: 'The distractions pulled you away again and again, and the candles stayed dark. The enemy loves it when we forget to pray.', verse: 'Pray without ceasing.', ref: '1 Thessalonians 5:17', tip: 'Keep holding the button and do not touch anything else, even when it calls you.' }); }); })
        .then(function () { g.tick(0); g.quest(null); g.glow(true, 'rgba(255,214,120,.4)'); A.fx('chime'); return g.say('elder', 'Five candles shine in the church. God has heard every prayer. Now you are ready.'); })
        .then(function () { g.glow(false); A.music('calm'); return g.picture('pray-' + kind(), { alt: 'The warrior kneels in prayer before the battle' }); })
        .then(function () { return g.say('narrator', 'At sunrise, on the mountain, you knelt down with your sword and shield beside you, and gave the battle to God. “Not by my strength, Lord, but by Yours.”'); })
        .then(function () { g.unpicture(); return receive(g, 'prayer'); });
    }

    /* ---------------- the last battle ---------------- */
    function ch8(g) {
      var pieces = ORDER.filter(has), missingDef = ['belt', 'breast', 'shoes', 'helmet'].filter(function (p) { return !has(p); }).length;
      var hp = 100, bar = null;
      function paintHP() { if (!bar) { bar = $('div', { class: 'kaa-hp' }, [$('span', { text: T('Strength') }), $('b', {}, [$('i')])]); g.questBox.appendChild(bar); } bar.querySelector('i').style.width = Math.max(0, hp) + '%'; bar.classList.toggle('low', hp < 35); }
      function hurt(n) { hp -= n; paintHP(); return hp > 0; }
      return g.scene('battle', { ground: 880, bounds: [140, 1540], ambience: 'battle', weather: 'tense' })
        .then(function () { A.music('tense'); return g.chapterTitle(8, 'The Last Battle', 'Stand firm'); })
        .then(function () {
          heroIn(g, 520); g.follow = null; g.cam.tx = 836;
          npc(g, 'woman', 220); npc(g, 'child', 330); npc(g, 'elder', 120);
          return g.say('narrator', 'The dark cloud came down over the plain. Your friends from the village stood behind you, afraid. And then he came: the devil himself.');
        })
        .then(function () { A.fx('growl'); g.shake(500); return g.picture('devil-rise', { alt: 'The devil rises out of the smoke', wait: 2600 }); })
        .then(function () { g.unpicture(); return wait(500); })
        .then(function () { g.actor('devil', { img: 'devil', x: 1250, y: g.ground, h: 640, alt: 'The devil', cls: 'kad-appear kaa-evil' }); g.actor('imp', { img: 'imp', x: 1520, y: g.ground - 30, h: 220, alt: 'A little demon', flip: true }); A.fx('growl'); g.shake(600); return wait(900); })
        .then(function () {
          g.quest('Stand firm', [T('Your armour:') + ' ' + pieces.length + ' / 7']);
          paintHP();
          if (!pieces.length) return g.say('devil', 'Ha! Look at you. No armour, no shield, no sword, no prayer. You are nothing but a weak and frightened nobody. You are MINE.');
          if (pieces.length < 7) return g.say('devil', 'So, you found some pieces of that armour. But not all of them! I can see where you are weak…');
          return g.say('devil', 'The whole armour of God? It does not matter! I will make you give up, and I will take your friends!');
        })
        .then(function () {
          /* the three temptations: the sword answers them */
          var TEM = [
            ['devil', 'You are hungry and tired. Take what you want, steal, lie, do anything! Who cares?', 'Man shall not live by bread alone, but by every word of God.'],
            ['devil', 'If God really loves you, jump into the fire, and He will have to save you!', 'Thou shalt not tempt the Lord thy God.'],
            ['devil', 'Bow down and worship me, and I will give you the whole world!', 'Thou shalt worship the Lord thy God, and him only shalt thou serve.']
          ];
          var DECOY = ['Maybe you are right…', 'I will think about it.', 'Just this once.'];
          return TEM.reduce(function (p, t, i) { return p.then(function () {
            if (!alive(g) || hp <= 0) return;
            return g.say(t[0], t[1]).then(function () {
              var opts = has('sword') ? shuffle([{ label: t[2], value: 1 }, { label: TEM[(i + 1) % 3][2], value: 2 }, { label: DECOY[i], value: 3 }]) : [{ label: 'No… I don’t want to… (you have no sword to answer with)', value: 4 }, { label: DECOY[i], value: 3 }];
              return g.choose(has('sword') ? 'Strike with the sword of the Spirit:' : 'You have no sword! What can you say?', opts);
            }).then(function (v) {
              if (v === 1) { A.fx('hit'); g.flashWhite(); var d = g.actors.devil; d.el.classList.remove('kaa-recoil'); void d.el.offsetWidth; d.el.classList.add('kaa-recoil'); return g.say('narrator', 'Your words flashed like a sword of light, and the devil fell back with a howl!'); }
              g.shake(500); A.fx('thump');
              var dmg = (v === 4 ? 12 : 18) + missingDef * 4; hurt(dmg);
              return g.say('narrator', v === 4 ? 'Without the word of God you had no answer, and his words cut into your heart.' : 'You listened to him, and it hurt you. You feel weaker.');
            });
          }); }, Promise.resolve());
        })
        .then(function () {
          if (!alive(g) || hp <= 0) return;
          return g.say('devil', 'Then burn! My fiery darts will strike you AND your little friends!').then(function () {
            var guard = has('prayer');
            if (guard) { michaelIn(g, 300); }
            return (guard ? g.say('michael', 'You prayed, so I am here! I will guard your friends. You stand firm and lift your shield!') : Promise.resolve()).then(function () {
              if (!has('shield')) return g.say('narrator', 'The darts are coming… but you have no shield of faith!');
            }).then(function () {
              g.cam.tx = 836;
              return dartsGame(g, { n: 16, speed: 2.4, shield: has('shield'), friends: ['woman', 'child', 'elder'], guard: guard, onHit: function (who) { var dmg = (who === 'hero' ? 7 : 5) + missingDef * 3; return hurt(dmg); } });
            });
          });
        })
        .then(function () { if (alive(g)) return ending(g, pieces, hp); });
    }
    function ending(g, pieces, hp) {
      if (!pieces.length) return darkness(g);
      if (pieces.length === 7 && hp > 0) return victory(g);
      return beaten(g, pieces, hp);
    }
    function victory(g) {
      g.quest(null);
      return (kind() === 'girl' ? g.picture('battle-girl', { alt: 'The warrior stands firm against the devil', wait: 600 }) : Promise.resolve())
        .then(function () { return g.say('narrator', 'You stood firm. The darts broke on your shield, the lies broke on your belt of truth, and the devil could not move you. He roared with rage…'); })
        .then(function () { g.unpicture(); A.stopMusic(); g.shake(800); A.fx('thump'); return wait(800); })
        .then(function () { g.flashWhite(); g.glow(true, 'rgba(255,248,220,.85)'); A.fx('reward'); A.fx('cheer'); g.root.classList.add('kaa-glory'); return wait(1500); })
        .then(function () { return g.say('narrator', 'Then the sky opened. A light brighter than the sun shone over the whole plain, and the sound of a trumpet filled the air. The Lord Jesus came in glory, with all His holy angels.'); })
        .then(function () { var d = g.actors.devil, i = g.actors.imp; if (i) i.el.classList.add('kad-gone'); A.fx('thump'); g.shake(900);
          /* the devil falls down, beaten, and lies on the ground */
          if (d) g.actor('devil', { img: 'devil-down', h: 330, x: 1230, y: g.ground + 10, idle: false, cls: 'kaa-fallen' });
          return wait(1600); })
        .then(function () { return g.picture('devil-defeated', { alt: 'The devil lies defeated in the light', wait: 600 }); })
        .then(function () { return g.say('narrator', 'The devil fell to the ground and could not rise. All his strength was gone before the Lord.'); })
        .then(function () { return sayVerse(g, 'narrator', ['Revelation', 20, 10, 10, 'And the devil that deceived them was cast into the lake of fire and brimstone, where the beast and the false prophet are, and shall be tormented day and night for ever and ever.', 'Revelation 20:10']); })
        .then(function () { g.unpicture(); g.remove('devil'); g.remove('imp'); g.root.classList.remove('kaa-glory'); g.glow(false); return g.scene('victory', { ground: 880, bounds: [140, 1540], ambience: 'hills', sparkles: [[836, 220], [760, 300], [910, 290]] }); })
        .then(function () {
          A.music('joy'); for (var k in g.actors) g.remove(k);
          heroIn(g, 760); npc(g, 'woman', 420); npc(g, 'child', 560); npc(g, 'elder', 1000, { flip: true }); npc(g, 'merchant', 1180, { flip: true }); g.actor('michael', { img: 'michael', x: 1400, y: g.ground - 10, h: 520, alt: 'The Archangel Michael', cls: 'kaa-holy', flip: true }); g.cam.tx = 836;
          return g.say('michael', 'You were small and weak, but you were strong in the Lord and in the power of His might. The victory belongs to Him, and He shares it with all who trust Him.');
        })
        .then(function () { return sayVerse(g, 'michael', ['Ephesians', 6, 13, 13, 'Wherefore take unto you the whole armour of God, that ye may be able to withstand in the evil day, and having done all, to stand.', 'Ephesians 6:13']); })
        .then(function () { g.finishChapter(8); return journeyCard(g, true); });
    }
    function beaten(g, pieces, hp) {
      var missing = ORDER.filter(function (p) { return pieces.indexOf(p) < 0; });
      g.quest(null);
      return g.say('narrator', 'The devil struck you where your armour was missing. You fell to the ground, and the darkness came very close…')
        .then(function () { A.music('sad'); g.shake(700); A.fx('thump'); var h = g.actors.hero; if (h) h.el.classList.add('kaa-down'); return wait(1200); })
        .then(function () { return g.picture(pieces.length === 7 ? 'fallen-armour' : 'fallen', { alt: 'The warriors lie beaten on the battlefield', wait: 1400 }); })
        .then(function () { if (!g.actors.michael) michaelIn(g, 300); return g.say('michael', 'Get up, child of God! You are hurt, but you are alive. The battle is not over, and God is not finished with you.'); })
        .then(function () { g.unpicture(); var h = g.actors.hero; if (h) h.el.classList.remove('kaa-down'); return g.say('narrator', 'Michael lifted you up and carried you and your friends away from the plain. You survived, to fight another day.'); })
        .then(function () {
          var box = $('div', { class: 'kad-fail kaa-beaten' }, [
            $('div', { class: 'kad-fail__icon', 'aria-hidden': 'true', text: '🩹' }), $('p', { class: 'kad-fail__eyebrow', text: 'Beaten, but not lost' }), $('h3', { text: 'You survived to fight another day' }),
            $('p', { class: 'kad-fail__why', text: pieces.length === 7 ? 'You had the whole armour, but you listened to the enemy or let the darts through. Stand firm and try again!' : 'Without the whole armour of God, nobody can stand against the devil. These pieces were missing:' }),
            pieces.length < 7 ? $('div', { class: 'kaa-missing' }, missing.map(function (p) { return $('span', { class: 'kaa-miss' }, [$('img', { src: img('ic-' + p), alt: '' }), $('small', { text: NAME[p] })]); })) : null,
            $('p', { class: 'kad-fail__tip', text: pieces.length === 7 ? '💡 Answer every temptation with the right verse, and tap every fiery dart.' : '💡 Go back to the chapters where you lost a piece, win it, and face the enemy again.' }),
            $('div', { class: 'kad-fail__go' }, [$('button', { class: 'kad-next', type: 'button', text: '↻ Face the enemy again', onclick: function () { A.fx('tap'); g.play(7); } }), $('button', { class: 'kad-next kad-next--ghost', type: 'button', text: '🗺️ Chapters', onclick: function () { A.fx('tap'); g.chapters(); } })])]);
          g.clearUI(); g.ui.appendChild(box); return new Promise(function () {});
        });
    }
    function darkness(g) {
      g.quest(null); A.stopMusic();
      return g.say('narrator', 'You had no armour at all: no truth, no righteousness, no peace, no faith, no salvation, no word of God, no prayer. When the devil came, you could not stand.')
        .then(function () { A.fx('fail'); g.root.classList.add('kaa-dark'); return wait(2600); })
        .then(function () { A.fx('growl'); return g.picture('abyss', { cls: 'kad-pic--abyss', alt: 'The devil in the darkness', wait: 1200 }); })
        .then(function () {
          var d = load(), r = d.armour || {}; r.lostDark = (r.lostDark || 0) + 1; d.armour = r; store(d);
          var box = $('div', { class: 'kad-fail kaa-abyss' }, [
            $('div', { class: 'kad-fail__icon', 'aria-hidden': 'true', text: '🌑' }), $('p', { class: 'kad-fail__eyebrow', text: 'Swallowed by the darkness' }), $('h3', { text: 'You fell into the outer darkness' }),
            $('p', { class: 'kad-fail__why', text: 'Without God’s armour, the enemy pulled you down into the darkness, far away from the light of God. This is what the devil wants for every person.' }),
            $('p', { class: 'kad-fail__why kaa-hope', text: 'But this is only a story. In real life, as long as you live, God is calling you back to Him, and His armour is a free gift for everyone who asks. Begin again, and this time put it on!' }),
            $('div', { class: 'kad-fail__go' }, [$('button', { class: 'kad-next', type: 'button', text: '☀️ Begin again', onclick: function () { A.fx('tap'); var d0 = load(); var h = (d0.armour || {}).hero; d0.armour = { hero: h }; store(d0); g.root.classList.remove('kaa-dark'); g.paintVirtues(); g.play(0); } }), $('button', { class: 'kad-next kad-next--ghost', type: 'button', text: '🗺️ Chapters', onclick: function () { A.fx('tap'); g.root.classList.remove('kaa-dark'); g.chapters(); } })])]);
          g.clearUI(); g.ui.appendChild(box); return new Promise(function () {});
        });
    }
    function journeyCard(g) {
      var list = $('div', { class: 'kaa-missing kaa-missing--won' }, ORDER.map(function (p) { return $('span', { class: 'kaa-miss' }, [$('img', { src: img('ic-' + p), alt: '' }), $('small', { text: NAME[p] })]); }));
      var box = $('div', { class: 'kad-journey kaa-journey' }, [
        $('p', { class: 'kad-chapters__eyebrow', text: 'Victory in the Lord' }), $('h2', { text: 'You stood firm!' }),
        $('p', { class: 'kad-chapters__sub', text: 'You put on the whole armour of God, piece by piece. Wear it every day: truth, righteousness, peace, faith, salvation, the word of God, and prayer.' }), list,
        $('div', { class: 'kad-fail__go' }, [$('button', { class: 'kad-next', type: 'button', text: '🗺️ Chapters', onclick: function () { A.fx('tap'); g.chapters(); } }), $('button', { class: 'kad-next kad-next--ghost', type: 'button', text: 'Back to Kids Corner', onclick: function () { g.close(); } })])]);
      g.clearUI(); g.ui.appendChild(box);
      var r = g.stage.getBoundingClientRect(); for (var i = 0; i < 80; i++) { var a = Math.random() * 6.283, sp = 3 + Math.random() * 6; g.parts.push({ x: r.width / 2, y: r.height * 0.35, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, g: 0.08, r: 4 + Math.random() * 5, life: 2 + Math.random(), kind: 'star', c: ['#ffe27a', '#fff3c4', '#f3c548', '#ffffff'][i % 4] }); }
      return new Promise(function () {});
    }

    var ARMOUR = {
      id: 'armour', dir: 'armour', hero: 'hero', title: 'The Armour of God', sub: 'Small and weak at the start, strong in the Lord at the end.',
      eyebrow: 'A Bible adventure · Ephesians 6:10–18', tip: 'Win the seven pieces of the armour of God (top right), then face the enemy. Everything is saved on this device.',
      restart: '↺ Begin a new journey (take off all the armour)', length: '8 chapters · about 30 minutes', menuBg: 'village', menuAmbience: 'camp', rewardLabel: 'A new piece of the armour of God',
      who: WHO,
      virtues: { belt: ['', NAME.belt, 'ic-belt'], breast: ['', NAME.breast, 'ic-breast'], shoes: ['', NAME.shoes, 'ic-shoes'], shield: ['', NAME.shield, 'ic-shield'], helmet: ['', NAME.helmet, 'ic-helmet'], sword: ['', NAME.sword, 'ic-sword'], prayer: ['', NAME.prayer, 'ic-prayer'] },
      chapters: [
        { title: 'Small and Afraid', sub: 'The belt of truth', bg: 'village', run: ch1 },
        { title: 'The Market', sub: 'The breastplate of righteousness', bg: 'market', run: ch2 },
        { title: 'The Broken Bridge', sub: 'The shoes of the gospel of peace', bg: 'bridge', run: ch3 },
        { title: 'The Dark Forest', sub: 'The shield of faith', bg: 'forest', run: ch4 },
        { title: 'The Hill of the Cross', sub: 'The helmet of salvation', bg: 'hill', run: ch5 },
        { title: 'The Desert', sub: 'The sword of the Spirit', bg: 'desert', run: ch6 },
        { title: 'The Holy Mountain', sub: 'Prayer', bg: 'mountain', run: ch7 },
        { title: 'The Last Battle', sub: 'Stand firm', bg: 'battle', run: ch8, noFinish: true }
      ]
    };
    KA.register(ARMOUR);
  }
  boot();
})();
