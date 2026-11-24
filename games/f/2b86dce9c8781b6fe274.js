/* KJT Kids Corner - Bible Adventures (Site Core 7.9.0)
   A real adventure game in the browser, built for Kids Corner: painted scenes, characters
   that walk, breathe and react, a story told in dialogue, choices, mini-games, music and
   sound made on the device, and a Faith Journey of virtues and Scriptures to collect.
   First adventure: David & Goliath (1 Samuel 16-17), in six chapters.

   - Everything is kept on this device (localStorage "kjt_adventures_v1") and travels with
     the Pilgrim Card. Each chapter finished counts for Story Adventures stars.
   - No violence shown: the battle is a moment of faith, the giant kneels and falls.
   - The texts are plain page text, so the Kids Corner languages translate them.
   - window.KJTAdventure.open(id) opens an adventure (id: "david"). */
(function () {
  'use strict';
  var CFG = window.KJT_ADVENTURE || {};
  var BASE = CFG.base || '';
  var BIBLE = (CFG.bible || '/bible-corner/').replace(/#.*$/, '');
  var KEY = 'kjt_adventures_v1';
  var WW = 1672, WH = 941;
  var CUR = null; /* 7.9.11: the adventure being played (each can keep its pictures in its own folder) */
  function img(n) { return (CFG.img || BASE + 'img/') + (CUR && CUR.dir ? CUR.dir + '/' : '') + n + '.webp'; } /* 7.11.0: the pictures may be in KJT Site Pictures */
  function $(t, a, kids) {
    var n = document.createElement(t);
    if (a) Object.keys(a).forEach(function (k) { var v = a[k]; if (v == null || v === false) return; if (k === 'text') n.textContent = v; else if (k === 'html') n.innerHTML = v; else if (k === 'class') n.className = v; else if (k === 'style') n.style.cssText = v; else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v); });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function store(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }

  /* ======================= sound and music (Web Audio, made on the device) ======================= */
  var A = (function () {
    var ctx = null, master = null, musicBus = null, sfx = null, amb = null, verb = null, timers = [], ambNodes = [], on = true;
    function muted() { try { return localStorage.getItem('kjt_kids_sound') === 'off'; } catch (e) { return false; } }
    function init() {
      if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted() ? 0 : 0.9; master.connect(ctx.destination);
      var comp = ctx.createDynamicsCompressor(); comp.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.32; sfx = ctx.createGain(); sfx.gain.value = 0.8; amb = ctx.createGain(); amb.gain.value = 0.5;
      [musicBus, sfx, amb].forEach(function (g) { g.connect(comp); });
      /* a soft hall */
      var len = ctx.sampleRate * 3, imp = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var c = 0; c < 2; c++) { var d = imp.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      verb = ctx.createConvolver(); verb.buffer = imp; var vg = ctx.createGain(); vg.gain.value = 0.35; verb.connect(vg); vg.connect(comp);
      return ctx;
    }
    function setMuted(m) { try { localStorage.setItem('kjt_kids_sound', m ? 'off' : 'on'); } catch (e) {} if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.1); }
    /* a plucked string (Karplus-Strong): the harp */
    var cache = {};
    function pluckBuf(freq) {
      var k = Math.round(freq); if (cache[k]) return cache[k];
      var sr = ctx.sampleRate, dur = 2.6, n = Math.floor(sr * dur), b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0), p = Math.max(2, Math.round(sr / freq)), buf = new Float32Array(p);
      for (var i = 0; i < p; i++) buf[i] = Math.random() * 2 - 1;
      var idx = 0;
      for (var j = 0; j < n; j++) { var nx = (idx + 1) % p; var v = (buf[idx] + buf[nx]) * 0.4985; d[j] = buf[idx]; buf[idx] = v; idx = nx; }
      return (cache[k] = b);
    }
    function harp(freq, when, vol, bus) {
      if (!init()) return; var t = ctx.currentTime + (when || 0);
      var s = ctx.createBufferSource(); s.buffer = pluckBuf(freq);
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 3200;
      var g = ctx.createGain(); g.gain.setValueAtTime(vol || 0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 2.5);
      s.connect(f); f.connect(g); g.connect(bus || sfx); g.connect(verb); s.start(t);
    }
    function tone(freq, when, dur, type, vol, glide, bus) {
      if (!init()) return; var t = ctx.currentTime + (when || 0), o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t); if (glide) o.frequency.exponentialRampToValueAtTime(glide, t + dur * 0.9);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(bus || sfx); g.connect(verb); o.start(t); o.stop(t + dur + 0.05);
    }
    function noise(dur, when, type, freq, q, vol, attack, bus) {
      if (!init()) return null; var t = ctx.currentTime + (when || 0), n = Math.floor(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), last = 0;
      for (var i = 0; i < n; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = type === 'brown' ? last * 3.5 : w; }
      var s = ctx.createBufferSource(); s.buffer = b; var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 800; f.Q.value = q || 0.8;
      var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.2, t + (attack || 0.02)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(bus || sfx); s.start(t); return s;
    }
    /* D major pentatonic, the music of the hills */
    var SCALE = [146.83, 164.81, 185.0, 220.0, 246.94, 293.66, 329.63, 369.99, 440.0, 493.88, 587.33, 659.25, 739.99];
    var CHORDS = [[0, 2, 5, 7, 9], [3, 5, 8, 10, 12], [1, 4, 6, 8, 11], [2, 5, 7, 9, 12]];
    var mood = 'calm', bar = 0;
    function musicTick() {
      if (!ctx || !on) return;
      if (mood === 'sad') { var lo = [0, 3, 1, 2][bar % 4]; harp(SCALE[lo] * 0.5, 0, 0.3, musicBus); harp(SCALE[lo + 2] * 0.5, 0.9, 0.22, musicBus); tone(73.4, 0, 3.4, 'sine', 0.08, 69, musicBus); bar++; return; }
      var ch = CHORDS[bar % CHORDS.length], tense = mood === 'tense', joy = mood === 'joy';
      var step = tense ? 0.42 : joy ? 0.2 : 0.3;
      ch.forEach(function (i, k) { if (tense && k % 2) return; harp(SCALE[i] * (tense ? 0.5 : 1), k * step, tense ? 0.32 : 0.22, musicBus); });
      if (Math.random() < (joy ? 0.9 : 0.5)) harp(SCALE[ch[Math.floor(Math.random() * ch.length)] + 0] * 2, step * 5 + 0.1, 0.14, musicBus);
      if (tense) tone(73.4, 0, 2.8, 'sine', 0.12, null, musicBus);
      bar++;
    }
    function music(m) { mood = m || 'calm'; if (!init()) return; stopMusic(); musicTick(); timers.push(setInterval(musicTick, mood === 'tense' ? 3400 : mood === 'sad' ? 4200 : 3000)); }
    function stopMusic() { timers.forEach(clearInterval); timers = []; }
    /* ambience per place: wind, birds, the brook, the camp */
    function ambience(kind) {
      if (!init()) return; stopAmb();
      var t0 = ctx.currentTime;
      function bed(type, f, q, vol) {
        var n = ctx.sampleRate * 4, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), last = 0;
        for (var i = 0; i < n; i++) { var w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = type === 'brown' ? last * 3.5 : w; }
        var s = ctx.createBufferSource(); s.buffer = b; s.loop = true; var fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q;
        var g = ctx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(vol, t0 + 2.5);
        var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07 + Math.random() * 0.05; lg.gain.value = vol * 0.5; lfo.connect(lg); lg.connect(g.gain); lfo.start();
        s.connect(fl); fl.connect(g); g.connect(amb); s.start(); ambNodes.push(s, lfo, g);
      }
      bed('brown', 420, 0.5, 0.35);
      if (kind === 'brook') { bed('white', 1600, 0.7, 0.07); bed('white', 3200, 1.2, 0.03); }
      if (kind === 'camp') bed('brown', 250, 0.6, 0.25);
      if (kind === 'town') bed('brown', 300, 0.6, 0.12);
      var birds = setInterval(function () {
        if (kind === 'camp' || kind === 'battle' || Math.random() < 0.4) return;
        var f = 2200 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 3);
        for (var i = 0; i < n; i++) tone(f * (1 + Math.random() * 0.15), i * 0.13, 0.09, 'sine', 0.05, f * 1.25, amb);
      }, 2600);
      timers.push(birds);
    }
    function stopAmb() { ambNodes.forEach(function (n) { try { if (n.gain) n.gain.setTargetAtTime(0, ctx.currentTime, 0.4); else n.stop(ctx.currentTime + 1.5); } catch (e) {} }); ambNodes = []; }
    var FX = {
      step: function () { noise(0.08, 0, 'white', 900, 1.5, 0.04); },
      tap: function () { tone(880, 0, 0.12, 'sine', 0.08, 1200); },
      baa: function () { if (!init()) return; var t = ctx.currentTime, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = 'sawtooth'; o2.type = 'sawtooth'; o.frequency.value = 520; o2.frequency.value = 523; lfo.frequency.value = 22; lg.gain.value = 18; lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
        o.frequency.setValueAtTime(560, t); o.frequency.linearRampToValueAtTime(470, t + 0.55); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 2;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        o.connect(f); o2.connect(f); f.connect(g); g.connect(sfx); g.connect(verb); [o, o2, lfo].forEach(function (x) { x.start(t); x.stop(t + 0.65); }); },
      chime: function () { [0, 4, 7, 12].forEach(function (s, i) { harp(293.66 * Math.pow(2, s / 12) * 2, i * 0.09, 0.4); }); },
      reward: function () { [0, 4, 7, 12, 16, 19, 24].forEach(function (s, i) { harp(293.66 * Math.pow(2, s / 12), i * 0.08, 0.45); }); tone(1174, 0.6, 1.4, 'sine', 0.06); },
      thump: function () { tone(55, 0, 0.6, 'sine', 0.6, 38); noise(0.35, 0, 'brown', 120, 0.6, 0.5); },
      whoosh: function () { noise(0.5, 0, 'white', 900, 1.2, 0.25, 0.15); },
      whirl: function (p) { tone(300 + p * 500, 0, 0.12, 'triangle', 0.04 + p * 0.05, 400 + p * 600); },
      hit: function () { tone(180, 0, 0.25, 'square', 0.15, 90); noise(0.2, 0, 'white', 2400, 1, 0.3); },
      cheer: function () { for (var i = 0; i < 6; i++) noise(1.8, i * 0.08, 'white', 700 + Math.random() * 900, 0.7, 0.12, 0.3); [0, 4, 7, 12].forEach(function (s, i) { harp(293.66 * Math.pow(2, s / 12), 0.3 + i * 0.12, 0.4); }); },
      oil: function () { for (var i = 0; i < 9; i++) tone(1174 + i * 120, i * 0.07, 0.6, 'sine', 0.05, 2349); },
      clank: function () { tone(1400, 0, 0.18, 'square', 0.06, 900); tone(2100, 0.05, 0.2, 'triangle', 0.05, 1500); noise(0.15, 0, 'white', 3000, 2, 0.12); },
      splash: function () { noise(0.4, 0, 'white', 2600, 0.8, 0.18, 0.01); tone(600, 0.02, 0.15, 'sine', 0.06, 1200); },
      soft: function () { tone(330, 0, 0.3, 'sine', 0.08, 300); },
      growl: function () { noise(1.4, 0, 'brown', 160, 0.9, 0.55, 0.25); tone(62, 0, 1.3, 'sawtooth', 0.05, 48); },
      shout: function () { noise(0.35, 0, 'white', 700, 1.6, 0.22, 0.02); tone(240, 0, 0.3, 'triangle', 0.08, 300); tone(55, 0.02, 0.3, 'sine', 0.4, 40); },
      flee: function () { noise(0.9, 0, 'white', 1200, 0.9, 0.18, 0.05); },
      wobble: function () { tone(500, 0, 0.6, 'triangle', 0.06, 220); tone(520, 0.08, 0.5, 'triangle', 0.05, 260); },
      fail: function () { [0, -3, -7, -12].forEach(function (st, i) { harp(220 * Math.pow(2, st / 12), i * 0.32, 0.45); }); tone(55, 0.2, 2.4, 'sine', 0.25, 45); },
      baaFrom: function (pan) { if (!init()) return; var p = ctx.createStereoPanner ? ctx.createStereoPanner() : null, keep = sfx; if (p) { p.pan.value = Math.max(-1, Math.min(1, pan || 0)); p.connect(sfx); sfx = p; } try { FX.baa(); } finally { sfx = keep; } }
    };
    return { init: init, harp: harp, tone: tone, fx: function (n, a) { if (!muted() && FX[n]) try { init(); FX[n](a); } catch (e) {} }, music: music, stopMusic: stopMusic, ambience: ambience, stop: function () { stopMusic(); stopAmb(); }, muted: muted, setMuted: setMuted, SCALE: SCALE, ctx: function () { return ctx; } };
  })();

  /* ======================= the stage ======================= */
  var G = null; /* the running game */
  function Game(adv) {
    var self = this; this.adv = adv; this.actors = {}; this.spots = []; this.mode = 'story'; this.cam = { x: 0, y: 0 }; this.follow = null; this.bounds = [80, WW - 80]; this.ground = 880;
    var root = this.root = $('div', { class: 'kad', role: 'dialog', 'aria-modal': 'true', 'aria-label': adv.title });
    var stage = this.stage = $('div', { class: 'kad-stage' });
    var world = this.world = $('div', { class: 'kad-world' });
    this.bg = [$('img', { class: 'kad-bg', alt: '', draggable: 'false' }), $('img', { class: 'kad-bg', alt: '', draggable: 'false' })]; this.bgi = 0;
    world.appendChild(this.bg[0]); world.appendChild(this.bg[1]);
    this.layer = $('div', { class: 'kad-actors' }); world.appendChild(this.layer);
    this.fxc = $('canvas', { class: 'kad-fx' });
    stage.appendChild(world); stage.appendChild(this.fxc);
    this.light = $('div', { class: 'kad-light' }); stage.appendChild(this.light);
    this.flash = $('div', { class: 'kad-flash' }); stage.appendChild(this.flash);
    /* top bar */
    this.questBox = $('div', { class: 'kad-quest', hidden: 'hidden' });
    this.virtues = $('div', { class: 'kad-virtues', 'aria-label': 'Faith Journey' });
    var snd = $('button', { class: 'kad-btn kad-snd', type: 'button', 'aria-label': 'Sound on or off', onclick: function () { A.setMuted(!A.muted()); paintSnd(); } });
    function paintSnd() { snd.textContent = A.muted() ? '🔇' : '🔊'; }
    paintSnd();
    var close = $('button', { class: 'kad-btn kad-close', type: 'button', 'aria-label': 'Close the adventure', text: '✕', onclick: function () { self.close(); } });
    var map = $('button', { class: 'kad-btn kad-mapbtn', type: 'button', 'aria-label': 'Chapters', text: '🗺️', onclick: function () { self.chapters(); } });
    this.top = $('div', { class: 'kad-top' }, [this.questBox, $('div', { class: 'kad-top__right' }, [this.virtues, map, snd, close])]);
    stage.appendChild(this.top);
    this.title = $('div', { class: 'kad-title', hidden: 'hidden' }); stage.appendChild(this.title);
    this.ui = $('div', { class: 'kad-ui' }); stage.appendChild(this.ui);
    root.appendChild(stage);
    document.body.appendChild(root);
    document.documentElement.classList.add('kad-lock');
    world.addEventListener('pointerdown', function (e) { self.groundTap(e); });
    this.key = function (e) { self.onKey(e); }; document.addEventListener('keydown', this.key);
    this.resize = function () { self.layout(); }; window.addEventListener('resize', this.resize);
    this.parts = []; this.fxLoop();
    this.paintVirtues();
    this.layout();
  }
  var P = Game.prototype;
  P.layout = function () {
    var r = this.stage.getBoundingClientRect(), s = Math.max(r.width / WW, r.height / WH);
    this.s = s; this.sw = r.width; this.sh = r.height;
    this.world.style.width = WW * s + 'px'; this.world.style.height = WH * s + 'px';
    this.fxc.width = Math.round(r.width * (window.devicePixelRatio || 1)); this.fxc.height = Math.round(r.height * (window.devicePixelRatio || 1));
    for (var k in this.actors) this.place(this.actors[k]);
    this.spots.forEach(this.placeSpot, this);
    this.camera(true);
  };
  P.camera = function (now) {
    var narrow = this.sw < this.sh * 1.2;
    var hero = this.actors[this.adv.hero || 'david'];
    if (this.mode === 'explore' && narrow && hero) this.lookAt = hero;
    var s = this.s, tx = narrow && this.lookAt && this.lookAt.el && this.lookAt.el.isConnected ? this.lookAt.x : this.cam.tx != null ? this.cam.tx : (this.follow ? this.follow.x : WW / 2);
    var x = clamp(tx * s - this.sw / 2, 0, Math.max(0, WW * s - this.sw)), y = Math.max(0, WH * s - this.sh) * 0.72;
    this.cam.x = now ? x : this.cam.x + (x - this.cam.x) * 0.12; this.cam.y = y;
    this.world.style.transform = 'translate(' + (-this.cam.x).toFixed(1) + 'px,' + (-this.cam.y).toFixed(1) + 'px)';
  };
  /* the background, cross-faded */
  P.scene = function (name, opts) {
    opts = opts || {}; var self = this, next = this.bg[1 - this.bgi], cur = this.bg[this.bgi];
    return new Promise(function (res) {
      next.onload = function () { next.classList.add('on'); cur.classList.remove('on'); self.bgi = 1 - self.bgi; setTimeout(res, 700); };
      next.onerror = function () { res(); };
      next.src = img('bg-' + name);
      self.place_name = name; self.ground = opts.ground || 880; self.bounds = opts.bounds || [80, WW - 80];
      self.sparkles = opts.sparkles || []; self.weather = opts.weather || 'sun';
      A.ambience(opts.ambience || 'hills');
    });
  };
  /* ---------- characters ---------- */
  P.actor = function (id, o) {
    var a = this.actors[id];
    if (!a) {
      a = { id: id, el: $('div', { class: 'kad-actor kad-actor--' + id }), im: $('img', { alt: o.alt || '', draggable: 'false' }), sh: $('i', { class: 'kad-shadow' }) };
      a.el.appendChild(a.sh); a.el.appendChild(a.im); this.layer.appendChild(a.el); this.actors[id] = a;
    }
    Object.keys(o).forEach(function (k) { a[k] = o[k]; });
    a.im.src = img(o.img || a.img);
    /* 7.9.11: extra layers drawn over the picture (the pieces of armour), same size and place */
    if (o.layers) { [].slice.call(a.el.querySelectorAll('img.kad-layer')).forEach(function (x) { x.remove(); }); o.layers.forEach(function (n) { a.el.appendChild($('img', { class: 'kad-layer', alt: '', draggable: 'false', src: img(n) })); }); a.el.classList.remove('kad-idle'); void a.el.offsetWidth; /* the layers move together with the picture */ }
    a.el.classList.toggle('kad-flip', !!a.flip); a.el.classList.toggle('kad-idle', a.idle !== false);
    if (o.cls) a.el.className = 'kad-actor kad-actor--' + id + ' ' + o.cls + (a.flip ? ' kad-flip' : '') + (a.idle !== false ? ' kad-idle' : '');
    this.place(a); return a;
  };
  P.place = function (a) {
    var s = this.s; a.el.style.left = (a.x * s) + 'px'; a.el.style.top = (a.y * s) + 'px'; a.el.style.height = (a.h * s) + 'px';
    a.el.style.zIndex = Math.round(a.y) + (a.z || 0);
  };
  P.remove = function (id) { var a = this.actors[id]; if (a) { a.el.remove(); delete this.actors[id]; } };
  P.fadeIn = function (id) { var a = this.actors[id]; if (a) { a.el.classList.add('kad-appear'); } };
  P.walk = function (id, x, opts) {
    opts = opts || {}; var self = this, a = this.actors[id]; if (!a) return Promise.resolve();
    var from = a.x, to = opts.free ? x : clamp(x, this.bounds[0], this.bounds[1]), d = Math.abs(to - from); if (d < 4) return Promise.resolve();
    var speed = (opts.speed || (a.speed || 260)), dur = d / speed * 1000, t0 = performance.now(), toY = opts.y != null ? opts.y : a.y, fromY = a.y, lastStep = 0;
    a.flip = to < from ? !a.facesLeft : !!a.facesLeft; if (a.noFlip) a.flip = false;
    a.el.classList.toggle('kad-flip', a.flip); a.el.classList.add('kad-walk'); if (a.heavy) a.el.classList.add('kad-heavy');
    a.walking = (a.walking || 0) + 1; var token = a.walking;
    return new Promise(function (res) {
      function step(now) {
        if (a.walking !== token) return res();
        var p = clamp((now - t0) / dur, 0, 1), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        a.x = from + (to - from) * e; a.y = fromY + (toY - fromY) * e; self.place(a);
        if (id === (self.adv.hero || 'david') && now - lastStep > (a.heavy ? 520 : 330)) { lastStep = now; A.fx(a.heavy ? 'clank' : 'step'); }
        if (p < 1) requestAnimationFrame(step); else { a.el.classList.remove('kad-walk', 'kad-heavy'); res(); }
      }
      requestAnimationFrame(step);
    });
  };
  /* ---------- the effects layer: sun motes, birds, sparkles, dust, light ---------- */
  P.fxLoop = function () {
    var self = this, c = this.fxc, ctx = c.getContext('2d'), motes = [], birds = [], t0 = performance.now();
    for (var i = 0; i < 40; i++) motes.push({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8, sp: 0.2 + Math.random() * 0.6, ph: Math.random() * 6 });
    function frame(now) {
      if (!self.root.isConnected) return;
      var dpr = window.devicePixelRatio || 1, W = c.width, H = c.height, t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      if (!self.reduced) {
        /* golden motes drifting in the light */
        motes.forEach(function (m) {
          m.y -= m.sp * 0.00025; m.x += Math.sin(t * 0.4 + m.ph) * 0.0002; if (m.y < -0.05) { m.y = 1.05; m.x = Math.random(); }
          var a = 0.25 + 0.25 * Math.sin(t * 1.3 + m.ph); ctx.fillStyle = 'rgba(255,236,170,' + a.toFixed(3) + ')';
          ctx.beginPath(); ctx.arc(m.x * W, m.y * H, m.r * dpr, 0, 6.283); ctx.fill();
        });
        /* birds now and then */
        if (self.weather !== 'tense' && Math.random() < 0.003 && birds.length < 3) birds.push({ x: -0.05, y: 0.08 + Math.random() * 0.2, v: 0.0007 + Math.random() * 0.0005, ph: Math.random() * 6, s: 0.6 + Math.random() * 0.6 });
        birds = birds.filter(function (b) {
          b.x += b.v; var w = Math.sin(t * 9 + b.ph) * 5 * b.s * dpr, x = b.x * W, y = b.y * H + Math.sin(t + b.ph) * 6 * dpr;
          ctx.strokeStyle = 'rgba(60,40,60,.55)'; ctx.lineWidth = 1.6 * dpr; ctx.beginPath(); ctx.moveTo(x - 9 * b.s * dpr, y - w); ctx.quadraticCurveTo(x - 4 * b.s * dpr, y - 2 * dpr, x, y); ctx.quadraticCurveTo(x + 4 * b.s * dpr, y - 2 * dpr, x + 9 * b.s * dpr, y - w); ctx.stroke();
          return b.x < 1.1;
        });
        /* water sparkles */
        (self.sparkles || []).forEach(function (sp, i) {
          var a = Math.max(0, Math.sin(t * 2.2 + i * 1.7)); if (a < 0.3) return;
          var x = (sp[0] * self.s - self.cam.x) * dpr, y = (sp[1] * self.s - self.cam.y) * dpr, r = (2 + a * 5) * dpr;
          ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.85).toFixed(2) + ')'; ctx.lineWidth = 1.4 * dpr;
          ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
        });
      }
      /* particles (dust, stars, oil) */
      self.parts = self.parts.filter(function (p) {
        p.life -= 1 / 60; if (p.life <= 0) return false;
        p.vy += p.g || 0; p.x += p.vx; p.y += p.vy; var a = Math.min(1, p.life / (p.fade || 0.6));
        var x = (p.world ? p.x * self.s - self.cam.x : p.x) * dpr, y = (p.world ? p.y * self.s - self.cam.y : p.y) * dpr;
        ctx.globalAlpha = a;
        if (p.kind === 'star') { ctx.fillStyle = p.c || '#ffe27a'; star(ctx, x, y, p.r * dpr, t * 3 + p.ph); }
        else { ctx.fillStyle = p.c || 'rgba(210,180,140,.6)'; ctx.beginPath(); ctx.arc(x, y, p.r * dpr, 0, 6.283); ctx.fill(); }
        ctx.globalAlpha = 1; return true;
      });
      self.camera(false);
      requestAnimationFrame(frame);
    }
    function star(ctx, x, y, r, rot) { ctx.beginPath(); for (var i = 0; i < 10; i++) { var rr = i % 2 ? r * 0.45 : r, an = rot + i * Math.PI / 5; ctx.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr); } ctx.closePath(); ctx.fill(); }
    try { this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    requestAnimationFrame(frame);
  };
  P.burst = function (x, y, kind, n, opts) { /* world coordinates */
    opts = opts || {}; for (var i = 0; i < (n || 20); i++) { var a = Math.random() * 6.283, v = (opts.speed || 2) * (0.4 + Math.random()); this.parts.push({ world: true, x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (opts.up || 0), g: opts.g != null ? opts.g : 0.03, r: (opts.r || 3) * (0.6 + Math.random()), life: (opts.life || 1.2) * (0.6 + Math.random() * 0.6), kind: kind, c: opts.c, ph: Math.random() * 6 }); }
  };
  P.shake = function (ms) { var st = this.stage; st.classList.remove('kad-shake'); void st.offsetWidth; st.classList.add('kad-shake'); setTimeout(function () { st.classList.remove('kad-shake'); }, ms || 600); };
  P.glow = function (on, color) { this.light.style.setProperty('--glow', color || 'rgba(255,220,120,.55)'); this.light.classList.toggle('on', !!on); };
  /* 7.9.12: a full painted picture over the scene (the story goes on in the speech box below it).
     The picture is shown whole; the same picture, blurred, fills the space around it. */
  P.picture = function (name, o) {
    o = o || {}; this.unpicture(true); var src = img(name);
    var p = $('div', { class: 'kad-pic' + (o.cls ? ' ' + o.cls : '') }, [$('div', { class: 'kad-pic__bg', style: 'background-image:url("' + src + '")' }), $('img', { class: 'kad-pic__im', src: src, alt: o.alt || '' })]);
    var im0 = p.lastChild; im0.onload = function () { p.classList.toggle('kad-pic--wide', im0.naturalWidth > im0.naturalHeight * 1.2); };
    this.stage.insertBefore(p, this.top); this.pic = p; void p.offsetWidth; p.classList.add('on');
    return wait(o.wait != null ? o.wait : 900);
  };
  P.unpicture = function (now) { var p = this.pic; if (!p) return; this.pic = null; if (now) return p.remove(); p.classList.remove('on'); setTimeout(function () { p.remove(); }, 900); };
  P.flashWhite = function () { var f = this.flash; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); };

  /* ---------- telling the story ---------- */
  var WHO = {
    narrator: { name: '', face: null },
    david: { name: 'David', face: 'david', fx: 50, fy: 13, fs: 420 },
    samuel: { name: 'Samuel', face: 'samuel', fx: 50, fy: 15, fs: 380 },
    saul: { name: 'King Saul', face: 'saul', fx: 48, fy: 9, fs: 420 },
    goliath: { name: 'Goliath', face: 'goliath', fx: 52, fy: 9, fs: 420 },
    jesse: { name: 'Jesse', face: null },
    eliab: { name: 'Eliab', face: null }
  };
  P.say = function (who, text, opts) {
    opts = opts || {}; var self = this, w = (this.adv.who && this.adv.who[who]) || WHO[who] || { name: who };
    this.ui.innerHTML = '';
    /* on a narrow (portrait) screen the camera turns to whoever is speaking */
    if (this.sw < this.sh * 1.2 && this.actors[who]) { this.lookAt = this.actors[who]; }
    var box = $('div', { class: 'kad-say kad-say--' + who + (opts.verse ? ' kad-say--verse' : '') });
    if (w.face) { var f = $('span', { class: 'kad-face', 'aria-hidden': 'true' }); f.style.backgroundImage = 'url(' + img(w.face) + ')'; f.style.backgroundPosition = w.fx + '% ' + w.fy + '%'; f.style.backgroundSize = w.fs + '%'; box.appendChild(f); }
    var body = $('div', { class: 'kad-say__body' });
    if (w.name) body.appendChild($('p', { class: 'kad-say__name', text: w.name }));
    var tx = $('p', { class: 'kad-say__text' }); body.appendChild(tx);
    if (opts.ref) body.appendChild($('a', { class: 'kad-say__ref', href: BIBLE + '#/p/kjva/' + opts.ref.replace(/^(\d?\s?[A-Za-z]+)\s(\d+):(\d+)(?:[–-](\d+))?$/, function (m, b, c, v1, v2) { return encodeURIComponent(b) + '/' + c + '/' + v1 + (v2 ? '-' + v2 : ''); }), target: '_blank', rel: 'noopener', text: '📖 ' + opts.ref }));
    var next = $('button', { class: 'kad-next', type: 'button', text: opts.button || 'Continue ▶' });
    var voice = window.KJTVoice && window.KJTVoice.supported ? $('button', { class: 'kad-btn kad-voice', type: 'button', 'aria-label': 'Read aloud', text: '🗣️', onclick: function (e) { e.stopPropagation(); try { window.KJTVoice.speak(tx.textContent); } catch (x) {} } }) : null;
    box.appendChild(body); box.appendChild($('div', { class: 'kad-say__go' }, [voice, next])); this.ui.appendChild(box);
    if (opts.verse) tx.classList.add('kad-verse');
    /* the text appears letter by letter (tap to show it all) */
    /* 7.9.11: the words are put in the page language before they are typed out */
    var full = window.KJT_LANG && window.KJT_LANG.lang !== 'en' && window.KJT_LANG.t ? window.KJT_LANG.t(text) : text, i = 0, typing = true, speed = opts.verse ? 18 : 24;
    tx.textContent = full; var h = tx.offsetHeight; tx.style.minHeight = h + 'px'; tx.textContent = '';
    var tick = setInterval(function () { i += 2; tx.textContent = full.slice(0, i); if (i >= full.length) { clearInterval(tick); typing = false; tx.textContent = full; } }, speed);
    if (who === 'goliath') { this.shake(400); A.fx('thump'); }
    return new Promise(function (res) {
      function go(e) { if (e) e.stopPropagation(); if (typing) { clearInterval(tick); typing = false; tx.textContent = full; return; } A.fx('tap'); box.classList.add('kad-out'); self.sayDone = null; setTimeout(function () { box.remove(); res(); }, 160); }
      next.addEventListener('click', go); box.addEventListener('click', go); self.sayDone = go;
      setTimeout(function () { next.focus({ preventScroll: true }); }, 50);
    });
  };
  P.choose = function (prompt, options, who) {
    var self = this; this.ui.innerHTML = '';
    var w = (this.adv.who && this.adv.who[who || this.adv.hero || 'david']) || WHO[who || 'david'] || {}; var box = $('div', { class: 'kad-say kad-choose' });
    if (w.face) { var f = $('span', { class: 'kad-face', 'aria-hidden': 'true' }); f.style.backgroundImage = 'url(' + img(w.face) + ')'; f.style.backgroundPosition = w.fx + '% ' + w.fy + '%'; f.style.backgroundSize = w.fs + '%'; box.appendChild(f); }
    var body = $('div', { class: 'kad-say__body' }, [$('p', { class: 'kad-say__name', text: prompt })]);
    var list = $('div', { class: 'kad-options' }); body.appendChild(list); box.appendChild(body); this.ui.appendChild(box);
    return new Promise(function (res) {
      options.forEach(function (o, i) {
        var b = $('button', { class: 'kad-option', type: 'button' }, [$('span', { class: 'kad-option__n', 'aria-hidden': 'true', text: String(i + 1) }), $('span', { text: o.label })]);
        b.addEventListener('click', function (e) { e.stopPropagation(); A.fx('tap'); box.classList.add('kad-out'); setTimeout(function () { box.remove(); res(o.value != null ? o.value : i); }, 160); });
        list.appendChild(b); if (!i) setTimeout(function () { b.focus({ preventScroll: true }); }, 50);
      });
    });
  };
  P.clearUI = function () { this.ui.innerHTML = ''; };
  P.chapterTitle = function (n, title, sub) {
    var t = this.title; t.innerHTML = ''; t.appendChild($('p', { class: 'kad-title__n', text: 'Chapter ' + n })); t.appendChild($('h2', { text: title })); if (sub) t.appendChild($('p', { class: 'kad-title__sub', text: sub }));
    t.hidden = false; t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    return wait(2800).then(function () { t.classList.remove('on'); return wait(500); }).then(function () { t.hidden = true; });
  };
  /* ---------- quests and exploring ---------- */
  P.quest = function (title, items) {
    var q = this.questBox; q.innerHTML = ''; this.qitems = [];
    if (!title) { q.hidden = true; return; }
    q.appendChild($('p', { class: 'kad-quest__h', text: title }));
    var ul = $('ul'); var self = this;
    items.forEach(function (t) { var li = $('li', { text: t }); ul.appendChild(li); self.qitems.push(li); });
    q.appendChild(ul); q.hidden = false;
  };
  P.tick = function (i, text) { var li = this.qitems && this.qitems[i]; if (!li) return; if (text) li.textContent = text; li.classList.add('done'); };
  P.spot = function (o) {
    var self = this;
    var b = $('button', { class: 'kad-spot' + (o.cls ? ' ' + o.cls : ''), type: 'button', 'aria-label': o.label }, [o.icon ? $('span', { class: 'kad-spot__icon', 'aria-hidden': 'true', text: o.icon }) : null]);
    o.el = b; this.spots.push(o); this.layer.appendChild(b); this.placeSpot(o);
    b.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    b.addEventListener('click', function (e) { e.stopPropagation(); self.reach(o); });
    return o;
  };
  P.placeSpot = function (o) { var s = this.s, r = (o.r || 70) * s; o.el.style.left = (o.x * s - r) + 'px'; o.el.style.top = (o.y * s - r) + 'px'; o.el.style.width = o.el.style.height = (2 * r) + 'px'; o.el.style.zIndex = 2000;
    /* a hidden lamb: only the top of the picture shows, its lower edge on the rock's edge */
    var im = o.el.querySelector('.kad-hid'); if (im) { var H = 120 * s, k = o.peek || 0.33; im.style.height = H + 'px'; im.style.top = (r - k * H) + 'px'; im.style.clipPath = 'inset(0 0 ' + ((1 - k) * 100).toFixed(1) + '% 0)'; im.classList.toggle('kad-hid--flip', !!o.flipImg); }
    var st = o.el.querySelector('.kad-bstone'); if (st) st.style.width = (o.w || 46) * s + 'px';
  };
  P.unspot = function (o) { if (!o) return; o.el.remove(); this.spots = this.spots.filter(function (x) { return x !== o; }); };
  P.reach = function (o) {
    var self = this; if (this.busy || this.mode !== 'explore') return; this.busy = true;
    var H0 = this.adv.hero || 'david', d = this.actors[H0], target = o.stand != null ? o.stand : (o.x + (d.x < o.x ? -o.near || -90 : o.near || 90));
    (o.walk === false ? Promise.resolve() : this.walk(H0, target)).then(function () { return o.onReach(o); }).then(function () { self.busy = false; }, function () { self.busy = false; });
  };
  P.groundTap = function (e) {
    var H0 = this.adv.hero || 'david'; if (this.mode !== 'explore' || this.busy || !this.actors[H0]) return;
    var r = this.world.getBoundingClientRect(), x = (e.clientX - r.left) / this.s; A.init();
    this.walk(H0, x);
  };
  P.onKey = function (e) {
    if (e.key === 'Escape') { this.close(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && this.sayDone && !(e.target && e.target.closest && e.target.closest('button'))) { e.preventDefault(); this.sayDone(); return; }
    var H0 = this.adv.hero || 'david';
    if (this.mode === 'explore' && this.actors[H0] && !this.busy && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault(); var d = this.actors[H0]; this.walk(H0, d.x + (e.key === 'ArrowLeft' ? -160 : 160));
    }
    if (this.mode === 'explore' && (e.key === 'Enter' || e.key === ' ')) {
      var d2 = this.actors[H0], best = null; this.spots.forEach(function (o) { var dd = Math.abs(o.x - d2.x); if (!best || dd < best.d) best = { o: o, d: dd }; });
      if (best) { e.preventDefault(); this.reach(best.o); }
    }
  };
  P.explore = function (on) { this.mode = on ? 'explore' : 'story'; this.root.classList.toggle('kad-exploring', !!on); if (on) this.hint(); };
  P.hint = function () {
    if (this.hinted) return; this.hinted = true;
    var h = $('div', { class: 'kad-hint', text: 'Tap the ground to walk. Tap anything you want to look at.' }); this.stage.appendChild(h); setTimeout(function () { h.classList.add('kad-out'); setTimeout(function () { h.remove(); }, 600); }, 4200);
  };
  /* ---------- the Faith Journey ---------- */
  var VIRTUES = { care: ['🐑', 'Faithful care'], heart: ['💛', 'A heart for God'], courage: ['🦁', 'Courage'], trust: ['🛡️', 'Trust in God'], wisdom: ['🌿', 'Humble wisdom'], faith: ['⭐', 'Faith over fear'] };
  P.paintVirtues = function () {
    var d = load(), mine = (d[this.adv.id] && d[this.adv.id].virtues) || [], box = this.virtues, V = this.adv.virtues || VIRTUES; box.innerHTML = '';
    Object.keys(V).forEach(function (k) { var on = mine.indexOf(k) >= 0, sp = $('span', { class: 'kad-virtue' + (on ? ' on' : '') + (V[k][2] ? ' kad-virtue--pic' : ''), title: V[k][1] + (on ? '' : ' (not yet)'), 'aria-label': V[k][1] + (on ? '' : ' (not yet)'), text: V[k][2] ? null : V[k][0] }); if (V[k][2]) sp.appendChild($('img', { src: img(V[k][2]), alt: '' })); box.appendChild(sp); });
  };
  P.reward = function (virtue, verse, ref) {
    var self = this, v = (this.adv.virtues || VIRTUES)[virtue]; this.clearUI(); A.fx('reward');
    var d = load(), rec = d[this.adv.id] = d[this.adv.id] || {}; rec.virtues = rec.virtues || []; if (rec.virtues.indexOf(virtue) < 0) rec.virtues.push(virtue);
    rec.verses = rec.verses || []; if (ref && rec.verses.indexOf(ref) < 0) rec.verses.push(ref); store(d); this.paintVirtues();
    var card = $('div', { class: 'kad-reward' }, [
      v[2] ? $('div', { class: 'kad-reward__pic', 'aria-hidden': 'true' }, [$('img', { src: img(v[2]), alt: '' })]) : $('div', { class: 'kad-reward__star', 'aria-hidden': 'true', text: v[0] }),
      $('p', { class: 'kad-reward__h', text: this.adv.rewardLabel || 'New on your Faith Journey' }),
      $('h3', { text: v[1] }),
      verse ? $('blockquote', { class: 'kad-verse' }, ['“' + verse + '”', $('cite', { text: ref })]) : null,
      $('button', { class: 'kad-next', type: 'button', text: 'Keep going ▶' })
    ]);
    this.ui.appendChild(card);
    var r = this.stage.getBoundingClientRect();
    for (var i = 0; i < 46; i++) { var a = Math.random() * 6.283, sp = 3 + Math.random() * 5; this.parts.push({ x: r.width / 2, y: r.height * 0.42, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, g: 0.08, r: 4 + Math.random() * 5, life: 1.6 + Math.random(), kind: 'star', c: ['#ffe27a', '#fff3c4', '#f3c548', '#ffffff'][i % 4], ph: Math.random() * 6 }); }
    return new Promise(function (res) { var b = card.querySelector('button'); b.focus({ preventScroll: true }); b.addEventListener('click', function () { A.fx('tap'); card.classList.add('kad-out'); self.sayDone = null; setTimeout(function () { card.remove(); res(); }, 200); }); self.sayDone = function () { b.click(); }; });
  };
  P.finishChapter = function (n) {
    var d = load(), rec = d[this.adv.id] = d[this.adv.id] || {}; rec.done = rec.done || []; rec.v2 = 1; if (rec.done.indexOf(n) < 0) rec.done.push(n); rec.at = Date.now(); store(d);
    try { window.dispatchEvent(new CustomEvent('kjt-achieve', { detail: { type: 'adventure', key: this.adv.id + '-' + n } })); } catch (e) {}
  };
  /* ---------- chapters ---------- */
  P.chapters = function () {
    /* 7.9.12: David & Goliath gained a chapter (The Lion, now 2): move saved progress along */
    (function (d) { var r = d.david; if (this.adv.id !== 'david' || !r || r.v2) return; r.done = (r.done || []).map(function (n) { return n >= 2 ? n + 1 : n; }); if (r.done.indexOf(1) >= 0) r.done.push(2); r.v2 = 1; store(d); }).call(this, load());
    var self = this, adv = this.adv, done = ((load()[adv.id] || {}).done) || [];
    this.mode = 'menu'; this.stopTimers(); this.root.classList.remove('kad-lost'); this.clearUI(); this.quest(null); A.music('calm');
    var grid = $('div', { class: 'kad-chapters__grid' });
    adv.chapters.forEach(function (c, i) {
      var n = i + 1, open = n === 1 || done.indexOf(n - 1) >= 0 || done.indexOf(n) >= 0, isDone = done.indexOf(n) >= 0;
      var b = $('button', { class: 'kad-ch' + (isDone ? ' done' : '') + (open ? '' : ' locked'), type: 'button', disabled: open ? null : 'disabled' }, [
        $('span', { class: 'kad-ch__pic', style: 'background-image:url(' + img('bg-' + c.bg) + ')' }),
        $('span', { class: 'kad-ch__n', text: isDone ? '✓' : open ? String(n) : '🔒' }),
        $('span', { class: 'kad-ch__t' }, [$('strong', { text: c.title }), $('small', { text: c.sub })])
      ]);
      b.addEventListener('click', function () { A.fx('tap'); self.play(i); });
      grid.appendChild(b);
    });
    var box = $('div', { class: 'kad-chapters' }, [
      $('p', { class: 'kad-chapters__eyebrow', text: adv.eyebrow || 'A Bible adventure · 1 Samuel 16–17' }),
      $('h2', { text: adv.title }), $('p', { class: 'kad-chapters__sub', text: adv.sub }), grid,
      $('p', { class: 'kad-chapters__tip', text: adv.tip || 'Your Faith Journey (top right) fills up as you go. Everything is saved on this device.' }),
      adv.restart && done.length ? $('button', { class: 'kad-next kad-next--ghost kad-restart', type: 'button', text: adv.restart, onclick: function () { var d0 = load(); delete d0[adv.id]; store(d0); self.paintVirtues(); A.fx('tap'); self.chapters(); } }) : null
    ]);
    this.ui.appendChild(box);
    for (var k in this.actors) this.remove(k); this.unpicture(true);
    this.spots.slice().forEach(this.unspot, this);
    this.scene(adv.menuBg || adv.chapters[0].bg, { ambience: adv.menuAmbience || 'hills' });
  };
  /* 7.9.2: a wrong choice can lose the chapter. The story stops, the reason is told kindly
     but plainly, with a verse to hold on to, and the child can try again. */
  P.fail = function (o) {
    var self = this; o = o || {};
    this.explore(false); this.busy = false; this.clearUI(); this.quest(null); this.glow(false); this.stopTimers();
    A.music('sad'); A.fx('fail'); this.root.classList.add('kad-lost');
    var d = load(), rec = d[this.adv.id] = d[this.adv.id] || {}; rec.lost = (rec.lost || 0) + 1; store(d);
    var go = $('div', { class: 'kad-fail__go' }, [
      $('button', { class: 'kad-next', type: 'button', text: '↻ Try again', onclick: function () { A.fx('tap'); self.root.classList.remove('kad-lost'); self.play(self.cur); } }),
      o.back != null ? $('button', { class: 'kad-next kad-next--ghost', type: 'button', text: o.backLabel || 'Go back a chapter', onclick: function () { A.fx('tap'); self.root.classList.remove('kad-lost'); self.play(o.back); } }) : null,
      o.skip ? $('button', { class: 'kad-next kad-next--ghost', type: 'button', text: o.skip, onclick: function () { A.fx('tap'); self.root.classList.remove('kad-lost'); self.finishChapter(self.cur + 1); if (self.cur + 1 < self.adv.chapters.length) self.play(self.cur + 1); else self.chapters(); } }) : null,
      $('button', { class: 'kad-next kad-next--ghost', type: 'button', text: '🗺️ Chapters', onclick: function () { A.fx('tap'); self.root.classList.remove('kad-lost'); self.chapters(); } })
    ]);
    var card = $('div', { class: 'kad-fail', role: 'alertdialog', 'aria-live': 'assertive' }, [
      $('div', { class: 'kad-fail__icon', 'aria-hidden': 'true', text: o.icon || '💔' }),
      $('p', { class: 'kad-fail__eyebrow', text: o.eyebrow || 'The story did not end well' }),
      $('h3', { text: o.title || 'You lost your faith' }),
      o.pic ? $('div', { class: 'kad-fail__pic' }, [$('img', { src: img(o.pic), alt: '' })]) : null,
      $('p', { class: 'kad-fail__why', text: o.text || '' }),
      o.verse ? $('blockquote', { class: 'kad-verse' }, ['“' + o.verse + '”', $('cite', { text: o.ref || '' })]) : null,
      o.tip ? $('p', { class: 'kad-fail__tip', text: '💡 ' + o.tip }) : null,
      go
    ]);
    this.ui.appendChild(card);
    setTimeout(function () { var b = card.querySelector('button'); if (b) b.focus({ preventScroll: true }); }, 60);
    return Promise.reject('failed');
  };
  /* timers that belong to one chapter (nightfall, the lion), stopped when the chapter ends */
  P.later = function (fn, ms, every) { this._timers = this._timers || []; var id = every ? setInterval(fn, ms) : setTimeout(fn, ms); this._timers.push(id); return id; };
  P.stopTimers = function () { (this._timers || []).forEach(function (id) { clearTimeout(id); clearInterval(id); }); this._timers = []; if (this.dusk) { this.dusk.remove(); this.dusk = null; } };
  P.play = function (i) {
    var self = this, c = this.adv.chapters[i]; this.cur = i; this.stopTimers(); this.root.classList.remove('kad-lost'); this.clearUI(); this.quest(null); this.mode = 'story'; this.cam.tx = null; this.lookAt = null; this.busy = false;
    for (var k in this.actors) this.remove(k); this.unpicture(true);
    this.spots.slice().forEach(this.unspot, this);
    this.glow(false);
    Promise.resolve().then(function () { return c.run(self); }).then(function () {
      self.stopTimers(); if (c.noFinish) return; self.finishChapter(i + 1);
      if (i + 1 < self.adv.chapters.length) return self.say('narrator', 'Chapter ' + (i + 1) + ' complete!', { button: 'On to the next chapter ▶' }).then(function () { self.play(i + 1); });
      self.chapters();
    }).catch(function (e) { if (e === 'failed' || e === 'closed') return; if (window.console) console.error(e); self.chapters(); });
  };
  P.close = function () {
    this.stopTimers(); A.stop(); try { if (window.KJTVoice) window.KJTVoice.stop(); } catch (e) {}
    document.removeEventListener('keydown', this.key); window.removeEventListener('resize', this.resize);
    this.root.remove(); document.documentElement.classList.remove('kad-lock'); G = null;
    if (location.hash.indexOf('#adventure-') === 0) history.replaceState(null, '', location.pathname + location.search + '#story-adventures');
    try { window.dispatchEvent(new CustomEvent('kjt-adventure-closed')); } catch (e) {}
  };

  /* ======================= mini-games ======================= */
  /* The harp: play the glowing strings, and Psalm 23 appears line by line */
  P.harpGame = function () {
    var self = this; this.clearUI();
    var lines = [
      ['The LORD is my shepherd;', [0, 2, 4]],
      ['I shall not want.', [4, 3, 2]],
      ['He maketh me to lie down in green pastures:', [1, 3, 5, 4]],
      ['he leadeth me beside the still waters.', [5, 4, 2, 0]],
      ['He restoreth my soul.', [0, 2, 4, 5]]
    ];
    var NOTES = [293.66, 329.63, 369.99, 440, 493.88, 587.33];
    var wrap = $('div', { class: 'kad-harp' }), lyric = $('div', { class: 'kad-harp__lines' });
    var tip = $('p', { class: 'kad-harp__tip', text: 'Play the glowing string.' });
    var harpBox = $('div', { class: 'kad-harp__instr' }, [$('img', { src: img('harp'), alt: 'David’s harp', draggable: 'false' })]);
    var strings = $('div', { class: 'kad-harp__strings' });
    var btns = NOTES.map(function (f, i) { var b = $('button', { class: 'kad-string', type: 'button', 'aria-label': 'String ' + (i + 1) }); b.style.setProperty('--i', i); strings.appendChild(b); return b; });
    harpBox.appendChild(strings);
    wrap.appendChild($('p', { class: 'kad-harp__h', text: 'Psalm 23 · a song of David' })); wrap.appendChild(lyric); wrap.appendChild(harpBox); wrap.appendChild(tip);
    this.ui.appendChild(wrap);
    return new Promise(function (res) {
      var li = 0, pi = 0, cur = null;
      function show() {
        btns.forEach(function (b) { b.classList.remove('glow'); });
        if (li >= lines.length) { tip.textContent = ''; A.fx('chime'); setTimeout(res, 1600); return; }
        var want = lines[li][1][pi]; btns[want].classList.add('glow');
        if (!cur) { cur = $('p', { class: 'kad-harp__line' }); lyric.appendChild(cur); }
        var words = lines[li][0].split(' '), show = Math.ceil(words.length * pi / lines[li][1].length);
        cur.textContent = words.slice(0, show).join(' ');
      }
      btns.forEach(function (b, i) {
        b.addEventListener('pointerdown', function (e) {
          e.preventDefault(); A.harp(NOTES[i], 0, 0.7); b.classList.remove('pluck'); void b.offsetWidth; b.classList.add('pluck');
          if (li >= lines.length) return;
          if (i === lines[li][1][pi]) {
            pi++;
            if (pi >= lines[li][1].length) { cur.textContent = lines[li][0]; cur.classList.add('done'); cur = null; li++; pi = 0; }
          }
          show();
        });
      });
      show();
    });
  };
  /* The sling (7.9.2: slower, and one throw per stone): hold to swing faster, let go when the light is in the gold */
  P.slingGame = function (left) {
    var self = this; this.clearUI();
    var box = $('div', { class: 'kad-sling' });
    var ring = $('div', { class: 'kad-sling__ring' }, [$('i', { class: 'kad-sling__zone' }), $('i', { class: 'kad-sling__dot' })]);
    var meter = $('div', { class: 'kad-sling__meter' }, [$('i')]);
    var tip = $('p', { class: 'kad-sling__tip', text: 'Hold the button to swing the sling. Let go when the light reaches the gold.' });
    var btn = $('button', { class: 'kad-sling__btn', type: 'button', text: '🪨 Hold to swing' });
    box.appendChild(tip); box.appendChild($('div', { class: 'kad-sling__row' }, [ring, meter])); box.appendChild(btn); this.ui.appendChild(box);
    var dot = ring.querySelector('.kad-sling__dot'), zone = ring.querySelector('.kad-sling__zone'), fill = meter.querySelector('i');
    return new Promise(function (res) {
      var holding = false, ang = 0, speed = 0, raf = 0, zoneAt = 200 + Math.floor(Math.random() * 140), last = 0, done = false;
      zone.style.transform = 'rotate(' + zoneAt + 'deg)';
      if ((self.slingMisses || 0) >= 2) zone.classList.add('big');
      function loop(now) {
        var dt = Math.min(40, now - (last || now)); last = now;
        if (holding) speed = Math.min(1, speed + dt / 3000); else speed = Math.max(0, speed - dt / 1400);
        ang = (ang + speed * dt * 0.42) % 360; dot.style.transform = 'rotate(' + ang + 'deg)'; fill.style.height = (speed * 100) + '%';
        if (holding && Math.floor(ang / 90) !== self._q) { self._q = Math.floor(ang / 90); A.fx('whirl', speed); }
        if (!done) raf = requestAnimationFrame(loop);
      }
      raf = requestAnimationFrame(loop);
      function down(e) { if (done) return; e.preventDefault(); A.init(); holding = true; btn.classList.add('on'); btn.textContent = '↻ Swinging… let go at the gold!'; self.actors.david && self.actors.david.el.classList.add('kad-swing'); }
      function up(e) {
        if (!holding || done) return; e.preventDefault(); holding = false; done = true; cancelAnimationFrame(raf);
        self.actors.david && self.actors.david.el.classList.remove('kad-swing');
        var diff = Math.abs(((ang - zoneAt + 540) % 360) - 180), good = diff < (zone.classList.contains('big') ? 38 : 24) && speed > 0.55;
        A.fx('whoosh'); if (!good) self.slingMisses = (self.slingMisses || 0) + 1;
        btn.disabled = true; btn.textContent = good ? '✨ Let go!' : speed <= 0.55 ? 'Too slow…' : 'Not in the gold…';
        setTimeout(function () { res(good); }, 250);
      }
      btn.addEventListener('pointerdown', down); btn.addEventListener('pointerup', up); btn.addEventListener('pointerleave', up); btn.addEventListener('pointercancel', up);
      btn.addEventListener('keydown', function (e) { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) down(e); });
      btn.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') up(e); });
    });
  };
  P.throwStone = function (toX, toY, o) {
    o = o || {}; var d = this.actors.david, self = this, x0 = d.x + 60, y0 = d.y - d.h * 0.85;
    var stone = $('img', { class: 'kad-stone', src: img('stone-b'), alt: '' }); this.layer.appendChild(stone);
    if (o.wobble) A.fx('wobble');
    return new Promise(function (res) {
      var t = 0, step = o.miss ? 0.008 : 0.0095;
      (function fly() { t += step; var e = t, wob = o.wobble ? Math.sin(t * 26) * 38 * t : 0, x = x0 + (toX - x0) * e, y = y0 + (toY - y0) * e - Math.sin(e * Math.PI) * 160 + wob;
        if (o.miss && t > 1) { x += (t - 1) * 700; y -= (t - 1) * 120; }
        stone.style.left = (x * self.s) + 'px'; stone.style.top = (y * self.s) + 'px'; stone.style.width = (40 * self.s) + 'px'; stone.style.transform = 'rotate(' + (t * (o.wobble ? 1700 : 700)) + 'deg)';
        self.parts.push({ world: true, x: x, y: y, vx: 0, vy: 0, r: 2.4, life: 0.4, c: 'rgba(255,240,200,.8)' });
        if (t < (o.miss ? 1.35 : 1)) requestAnimationFrame(fly); else { stone.remove(); res(); } })();
    });
  };

  /* ======================= David & Goliath ======================= */
  var DAVID = {
    id: 'david', title: 'David & Goliath', sub: 'Faith over fear: the shepherd boy who trusted God.',
    chapters: [
      { title: 'The Shepherd Boy', sub: 'Find the lost lambs and play your harp', bg: 'fields', run: ch1 },
      { title: 'The Lion', sub: 'Aim your sling and save the lambs', bg: 'fields', run: chLion },
      { title: 'The Prophet Comes', sub: 'Samuel looks for God’s chosen king', bg: 'town', run: ch2 },
      { title: 'To the Camp', sub: 'Bread for your brothers, and a giant’s challenge', bg: 'camp', run: ch3 },
      { title: 'Five Smooth Stones', sub: 'Choose your stones from the brook', bg: 'valley', run: ch4 },
      { title: 'The Valley of Elah', sub: 'The battle is the LORD’s', bg: 'valley', run: ch5 },
      { title: 'Victory', sub: 'Your Faith Journey', bg: 'victory', run: ch6 }
    ]
  };
  function davidIn(g, x, h) { return g.actor('david', { img: 'david', x: x, y: g.ground, h: h || 400, alt: 'David', speed: 300 }); }

  /* places in the hills where a lamb can hide: only its head peeks over a rock or out of the flowers.
     [x, y of the rock's edge, how much of the lamb shows, flipped] (picture coordinates of bg-fields) */
  var HIDES = [[1497, 548, 0.28, 1], [1186, 512, 0.26, 0], [482, 806, 0.3, 1], [905, 706, 0.28, 0], [58, 566, 0.3, 0], [600, 512, 0.26, 1], [1062, 642, 0.27, 1], [1335, 600, 0.28, 0]];
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function ch1(g) {
    return g.scene('fields', { ground: 885, bounds: [120, 1560], ambience: 'hills', sparkles: [[1180, 760], [1240, 840], [1300, 900], [1120, 880], [1390, 860]] })
      .then(function () { A.music('calm'); return g.chapterTitle(1, 'The Shepherd Boy', 'The hills of Bethlehem'); })
      .then(function () { davidIn(g, 300); g.follow = g.actors.david; return g.say('narrator', 'Long ago, in the hills of Bethlehem, a shepherd boy named David looked after his father Jesse’s sheep. He knew every one of them by name.'); })
      .then(function () { return g.say('david', 'Oh no! Three of the little lambs have wandered off and hidden. The sun is going down. I must find them before dark!'); })
      .then(function () { return g.say('narrator', 'Look carefully at the hills: behind the rocks, in the flowers, by the water. A lamb hiding shows only a little bit of its head. Tap 👂 Listen to hear which way the bleating comes from.'); })
      .then(function () {
        g.quest('Find the lost lambs before dark', ['Lambs found: 0 of 3', 'Play your harp under the olive tree']);
        var found = 0, places = shuffle(HIDES).slice(0, 3), left = [];
        /* the sun goes down: about two and a half minutes */
        var dusk = g.dusk = $('div', { class: 'kad-dusk' }); g.stage.insertBefore(dusk, g.top);
        var sun = $('div', { class: 'kad-sunbar', 'aria-label': 'Time until dark' }, [$('i')]); g.questBox.appendChild(sun);
        var listen = $('button', { class: 'kad-btn kad-listen', type: 'button', text: '👂 Listen' }); g.questBox.appendChild(listen);
        var T0 = Date.now(), DAY = 150000;
        g.explore(true);
        return new Promise(function (res, rej) {
          places.forEach(function (p, i) {
            var o = g.spot({ x: p[0], y: p[1], r: 46, label: 'Something is hiding here', cls: 'kad-spot--hid', near: 100, onReach: function () {
              if (o.found) return; o.found = true; g.unspot(o); left = left.filter(function (x) { return x !== o; }); A.fx('baa'); found++;
              var lamb = g.actor('lamb' + i, { img: 'lamb', x: p[0], y: Math.min(g.ground, p[1] + 70), h: 150, alt: 'A lamb', speed: 340, cls: 'kad-appear' });
              g.burst(p[0], p[1], 'star', 10, { speed: 2.2, up: 1, r: 4, life: 0.9 });
              g.tick(0, 'Lambs found: ' + found + ' of 3'); if (found < 3) g.qitems[0].classList.remove('done');
              return wait(400).then(function () { return g.say('david', ['There you are, little one! Come, follow me.', 'Found you! You were hiding from me, weren’t you?', 'The last one! Now the whole flock is safe.'][found - 1]); })
                .then(function () { lamb.followIdx = found; if (found === 3) { g.tick(0, 'Lambs found: 3 of 3'); sun.remove(); listen.remove(); res(); } });
            } });
            o.peek = p[2]; o.flipImg = !!p[3];
            o.el.appendChild($('img', { class: 'kad-hid', src: img('lamb'), alt: '', draggable: 'false' }));
            g.placeSpot(o); left.push(o);
          });
          /* listening: the nearest lamb bleats from its side of the screen, and peeks out for a moment */
          var lastListen = 0;
          listen.addEventListener('click', function (e) {
            e.stopPropagation(); if (Date.now() - lastListen < 3500 || !left.length) return; lastListen = Date.now();
            var d = g.actors.david, best = left.slice().sort(function (a, b) { return Math.abs(a.x - d.x) - Math.abs(b.x - d.x); })[0];
            A.fx('baaFrom', clamp((best.x - d.x) / 700, -1, 1));
            var dist = Math.abs(best.x - d.x);
            listen.textContent = dist < 250 ? '👂 Very close!' : dist < 600 ? '👂 Getting closer…' : best.x < d.x ? '👂 Far away, to the left' : '👂 Far away, to the right';
            best.el.classList.remove('kad-peek'); void best.el.offsetWidth; best.el.classList.add('kad-peek');
            setTimeout(function () { listen.textContent = '👂 Listen'; }, 3200);
          });
          /* sometimes a lamb bleats by itself */
          g.later(function () { if (left.length && Math.random() < 0.5) { var o = left[Math.floor(Math.random() * left.length)], d = g.actors.david; if (d) A.fx('baaFrom', clamp((o.x - d.x) / 700, -1, 1)); } }, 9000, true);
          g.later(function () {
            if (found >= 3) return;
            var p = Math.min(1, (Date.now() - T0) / DAY); dusk.style.opacity = (p * 0.88).toFixed(3); sun.firstChild.style.width = ((1 - p) * 100).toFixed(1) + '%';
            if (p > 0.75) sun.classList.add('late');
            if (p >= 1 && found < 3) {
              g.fail({ icon: '🌙', eyebrow: 'Night fell on the hills', title: 'The lambs are lost', text: 'It became too dark to see, and the little lambs were still out alone in the hills. A shepherd must keep looking, and look carefully, before the night comes.', verse: 'What man of you, having an hundred sheep, if he lose one of them, doth not leave the ninety and nine in the wilderness, and go after that which is lost, until he find it?', ref: 'Luke 15:4', tip: 'Tap 👂 Listen: the bleating comes from the side where a lamb is hiding. Look for a little head and ears over the rocks.' }).catch(rej);
            }
          }, 250, true);
          /* the lambs follow David */
          g.later(function () {
            var d = g.actors.david; if (!d) return;
            for (var i = 0; i < 3; i++) { var l = g.actors['lamb' + i]; if (!l || !l.followIdx) continue; var want = d.x + (d.flip ? 1 : -1) * (110 + 70 * l.followIdx); if (Math.abs(l.x - want) > 60 && !l.moving) { l.moving = true; (function (l, want) { g.walk(l.id, want, { y: g.ground - 6 - l.followIdx * 8 }).then(function () { l.moving = false; }); })(l, want); } }
          }, 300, true);
        });
      })
      .then(function () {
        g.explore(false);
        if (g.dusk) { g.dusk.style.transition = 'opacity 2s'; g.dusk.style.opacity = '0.25'; }
        A.music('calm');
        return g.say('narrator', 'With every lamb safe, David sat down under the old olive tree. He took out his harp and sang a song to God.');
      })
      .then(function () { g.explore(true); return new Promise(function (res) { var o = g.spot({ x: 200, y: 640, r: 90, label: 'Sit under the olive tree and play the harp', icon: '🎶', near: 0, stand: 260, onReach: function () { g.unspot(o); g.explore(false); res(); } }); }); })
      .then(function () { A.stopMusic(); return g.harpGame(); })
      .then(function () { g.clearUI(); g.tick(1); A.music('calm'); return g.say('narrator', '“The LORD is my shepherd; I shall not want.” David cared for his sheep the way God cares for us: He never leaves us, and He brings us home.', { ref: 'Psalm 23:1' }); })
      .then(function () { return g.reward('care', 'The LORD is my shepherd; I shall not want.', 'Psalm 23:1'); });
  }
  /* 7.9.12: The lion (1 Samuel 17:34-35), its own chapter. The lion looks out of the bushes in three places;
     each time David has a few seconds to aim his sling and hit it. A miss, or too slow, and the lion takes a lamb. */
  var LION_AT = [[700, 640], [1260, 500], [930, 630], [1500, 650], [470, 480]];
  function chLion(g) {
    return g.scene('fields', { ground: 885, bounds: [120, 1560], ambience: 'hills' })
      .then(function () { A.music('calm'); return g.chapterTitle(2, 'The Lion', 'Evening in the hills of Bethlehem'); })
      .then(function () {
        davidIn(g, 240); g.follow = g.actors.david;
        for (var i = 0; i < 3; i++) g.actor('lamb' + i, { img: 'lamb', x: 120 + i * 40, y: g.ground - 6 - i * 8, h: 150, alt: 'A lamb', speed: 340, flip: true });
        g.dusk = $('div', { class: 'kad-dusk' }); g.stage.insertBefore(g.dusk, g.top); g.dusk.style.opacity = '0.45';
        return g.say('narrator', 'The sun touched the hills. David turned for home with all his lambs… and then the bushes moved. Two eyes shone in the shadows, and a deep growl rolled across the field.');
      })
      .then(function () { return g.lion(); })
      .then(function () { return g.say('david', 'The LORD delivered me out of the paw of the lion. I will never forget it: God is with me.'); });
  }
  P.lion = function () {
    var self = this;
    A.music('tense'); A.fx('growl'); this.shake(400);
    this.dusk.style.transition = 'opacity 1.5s'; this.dusk.style.opacity = '0.55';
    return this.choose('A lion is creeping toward the lambs! What will David do?', [
      { label: 'Run home and leave the lambs', value: 1 },
      { label: 'Hide behind a rock and hope it goes away', value: 2 },
      { label: 'Trust God, take his sling and go after the lion', value: 3 }
    ]).then(function (v) {
      if (v !== 3) return self.fail({ icon: '🦁', eyebrow: 'Fear won', title: v === 1 ? 'David ran away' : 'David hid', text: (v === 1 ? 'David ran home and left the lambs alone in the field.' : 'David hid and did nothing.') + ' The lion came out of the bushes and carried a lamb away. A good shepherd does not leave his sheep when danger comes: he trusts God and protects them.', verse: 'I am the good shepherd: the good shepherd giveth his life for the sheep.', ref: 'John 10:11' });
      return self.say('david', 'Lord, be with me! I will not let it take my father’s lambs.').then(function () { return self.slingLion(); });
    }).then(function () { self.quest(null); self.cam.tx = null; return self.say('narrator', 'The lion turned and ran into the hills, and did not come back. David held the littlest lamb close. “The LORD saved us,” he whispered.', { ref: '1 Samuel 17:34–35' }); });
  };
  P.slingLion = function () {
    var self = this, ROUNDS = 3, WIN = [4200, 3600, 3000];
    var spots = shuffle(LION_AT).slice(0, ROUNDS);
    this.quest('Stop the lion with your sling', ['Hit the lion: 0 of ' + ROUNDS]);
    var tip = $('p', { class: 'kad-hint kad-hint--stay', text: 'Aim at the lion and tap (or let go) to sling a stone. Be quick, and do not miss!' }); this.stage.appendChild(tip);
    var aim = $('div', { class: 'kad-aim' }), ret = $('div', { class: 'kad-reticle', 'aria-hidden': 'true' }), clock = $('div', { class: 'kad-lionclock', 'aria-hidden': 'true' }, [$('i')]);
    aim.appendChild(ret); this.stage.appendChild(aim); this.questBox.appendChild(clock);
    var lion = $('img', { class: 'kad-lion', src: img('lion'), alt: 'A lion', draggable: 'false' }); this.layer.appendChild(lion);
    return new Promise(function (res, rej) {
      var round = 0, open = false, at = null, px = null, py = null, t0 = 0, raf = 0, over = false, dn = false;
      function size(p) { return 210 + (p[1] - 450) * 0.7; } /* the lion is bigger nearer the front */
      function show() {
        if (!self.root.isConnected) return;
        at = spots[round]; var h = size(at), s = self.s;
        lion.style.left = (at[0] * s) + 'px'; lion.style.top = (at[1] * s) + 'px'; lion.style.height = (h * s) + 'px'; lion.style.zIndex = Math.round(at[1]) + 5;
        /* on a wide screen David and the lion are both in sight; on a phone the camera turns to the lion */
        self.lookAt = null; self.cam.tx = self.sw < self.sh * 1.2 ? at[0] : clamp((at[0] + (self.actors.david ? self.actors.david.x : at[0])) / 2, 0, 1672);
        lion.classList.remove('hit', 'up'); void lion.offsetWidth; lion.classList.add('up');
        A.fx('growl'); open = true; t0 = performance.now(); loop();
      }
      function loop() {
        if (!open) return; var left = 1 - (performance.now() - t0) / WIN[round];
        clock.firstChild.style.width = Math.max(0, left * 100).toFixed(1) + '%'; clock.classList.toggle('late', left < .35);
        if (left <= 0) { open = false; return lose('slow'); }
        raf = requestAnimationFrame(loop);
      }
      function sway() { var t = performance.now() / 1000; return [Math.sin(t * 2.1) * 14 + Math.sin(t * 5.3) * 5, Math.cos(t * 1.7) * 10]; } /* the sling is not perfectly steady */
      function moveRet(e) { var r = aim.getBoundingClientRect(); px = e.clientX - r.left; py = e.clientY - r.top - (e.pointerType === 'touch' ? 70 : 0); ret.style.left = px + 'px'; ret.style.top = py + 'px'; ret.classList.add('on'); }
      (function wob() { if (over || !self.root.isConnected) return; if (px != null) { var w = sway(); ret.style.transform = 'translate(-50%,-50%) translate(' + w[0].toFixed(1) + 'px,' + w[1].toFixed(1) + 'px)'; } requestAnimationFrame(wob); })();
      aim.addEventListener('pointermove', function (e) { moveRet(e); });
      aim.addEventListener('pointerdown', function (e) { e.preventDefault(); A.init(); dn = true; moveRet(e); try { aim.setPointerCapture(e.pointerId); } catch (x) {} var d = self.actors.david; if (d) d.el.classList.add('kad-swing'); });
      aim.addEventListener('pointerup', function (e) { if (!dn) return; dn = false; moveRet(e); var d = self.actors.david; if (d) d.el.classList.remove('kad-swing'); if (open) shoot(); });
      function shoot() {
        open = false; cancelAnimationFrame(raf);
        var w = sway(), wr = self.world.getBoundingClientRect(), ar = aim.getBoundingClientRect();
        var wx = (ar.left + px + w[0] - wr.left) / self.s, wy = (ar.top + py + w[1] - wr.top) / self.s;
        var h = size(at), hx = at[0], hy = at[1] - h * 0.62, hitR = h * 0.42, hit = Math.hypot(wx - hx, (wy - hy) * 0.9) < hitR;
        A.fx('whoosh');
        self.throwStone(hit ? hx : wx, hit ? hy : wy, { miss: !hit }).then(function () {
          if (!hit) return lose('miss');
          round++; A.fx('hit'); lion.classList.add('hit'); self.shake(250);
          self.burst(hx, hy, 'star', 14, { speed: 2.4, up: 0.6, r: 4, life: 0.8 });
          self.tick(0, 'Hit the lion: ' + round + ' of ' + ROUNDS); if (round < ROUNDS) self.qitems[0].classList.remove('done');
          if (round >= ROUNDS) { over = true; A.fx('flee'); setTimeout(function () { end(); res(); }, 700); return; }
          tip.textContent = 'It ran into another bush! Watch for it…';
          self.later(show, 1300 + Math.random() * 900);
        });
      }
      function end() { over = true; open = false; cancelAnimationFrame(raf); tip.remove(); aim.remove(); clock.remove(); lion.remove(); var d = self.actors.david; if (d) d.el.classList.remove('kad-swing'); }
      function lose(why) {
        end(); A.fx('growl');
        self.fail({ icon: '🦁', eyebrow: why === 'miss' ? 'The stone missed' : 'Too slow', title: 'The lion took a lamb', text: (why === 'miss' ? 'The stone flew past the lion, ' : 'David waited too long, ') + 'and the lion leapt out and carried a lamb away into the hills. David knew God was with him; he must be quick and aim carefully.', verse: 'Be sober, be vigilant; because your adversary the devil, as a roaring lion, walketh about, seeking whom he may devour.', ref: '1 Peter 5:8', tip: 'Put the circle on the lion’s face, wait for it to steady, then let go. The bar at the top shows how much time is left.' }).catch(rej);
      }
      self.later(show, 900);
    });
  };

  function ch2(g) {
    var sons = [['Eliab', 'the eldest: tall and handsome'], ['Abinadab', 'the second son'], ['Shammah', 'the third son'], ['Nethaneel', 'the fourth son'], ['Raddai', 'the fifth son'], ['Ozem', 'the sixth son'], ['Elihu', 'the seventh son']];
    /* 7.9.12: Samuel comes to the town, to Jesse's house; David is called in from the fields and walks to him */
    return g.scene('town', { ground: 885, bounds: [120, 1560], ambience: 'town' })
      .then(function () { A.music('calm'); return g.chapterTitle(3, 'The Prophet Comes', 'Bethlehem, at the house of Jesse'); })
      .then(function () {
        g.follow = null; g.cam.tx = 900;
        g.actor('samuel', { img: 'samuel', x: 60, y: g.ground, h: 430, alt: 'The prophet Samuel', speed: 200, facesLeft: false });
        return g.say('narrator', 'One day an old man came up the road into the town of Bethlehem. It was Samuel, the prophet of God. Even the elders of the town trembled when they saw him.', { ref: '1 Samuel 16:4' });
      })
      .then(function () { return g.walk('samuel', 1180); })
      .then(function () { g.actors.samuel.flip = true; g.actors.samuel.el.classList.add('kad-flip'); return g.say('samuel', 'I come in peace. The LORD has sent me to the house of Jesse, for He has chosen a king from among his sons.', { ref: '1 Samuel 16:1' }); })
      .then(function () { return g.say('narrator', 'Jesse called his sons into the courtyard, and they came before Samuel, one by one. David was still out in the fields with the sheep. Nobody thought to call him.'); })
      .then(function () {
        /* the sons pass before Samuel */
        var i = 0;
        function nextSon() {
          if (i >= sons.length) return Promise.resolve();
          var s = sons[i++];
          return g.choose(s[0] + ', ' + s[1] + '. Is he the one God has chosen?', [{ label: 'Yes, he must be the king!', value: 1 }, { label: 'Let’s ask God', value: 2 }], 'samuel')
            .then(function () { return g.say('samuel', i === 1 ? 'Look not on his face, or on the height of his stature. The LORD seeth not as man seeth: for man looketh on the outward appearance, but the LORD looketh on the heart.' : 'Neither hath the LORD chosen this one.', { ref: i === 1 ? '1 Samuel 16:7' : null, verse: i === 1 }); })
            .then(function () { return i < 3 ? nextSon() : (i = sons.length, Promise.resolve()); });
        }
        return nextSon();
      })
      .then(function () { return g.say('narrator', 'And so it went: seven sons of Jesse passed before Samuel, and the LORD had chosen none of them.'); })
      .then(function () { return g.choose('What should Samuel ask?', [{ label: 'Are these all thy children?', value: 1 }, { label: 'Then I will go home.', value: 2 }], 'samuel'); })
      .then(function (v) { return v === 2 ? g.say('narrator', 'But Samuel knew God had sent him for a reason. So he asked Jesse, “Are these all thy children?”') : Promise.resolve(); })
      .then(function () { return g.say('jesse', 'There remaineth yet the youngest, and, behold, he keepeth the sheep.', { ref: '1 Samuel 16:11' }); })
      .then(function () { return g.say('samuel', 'Send and fetch him: for we will not sit down till he come hither.', { ref: '1 Samuel 16:11' }); })
      /* out in the fields: a servant runs to David, and David goes up to the town */
      .then(function () { g.remove('samuel'); return g.scene('fields', { ground: 885, bounds: [120, 1560], ambience: 'hills', sparkles: [[1180, 760], [1240, 840], [1300, 900]] }); })
      .then(function () {
        davidIn(g, 360); g.follow = g.actors.david; g.cam.tx = null;
        g.actor('lambA', { img: 'lamb', x: 560, y: g.ground - 6, h: 150, alt: 'A lamb', speed: 340 });
        return g.say('narrator', 'Out in the fields, a servant came running over the hills, out of breath. “David! The prophet Samuel is at your father’s house, and he will not sit down to eat until you come!”');
      })
      .then(function () { return g.say('david', 'The prophet Samuel? Asking for me, the youngest? I will go at once!'); })
      .then(function () {
        g.quest('Go up to Bethlehem', ['Walk to the town']); g.explore(true);
        return new Promise(function (res) { var o = g.spot({ x: 1290, y: 470, r: 90, label: 'Go up to the town', icon: '🏘️', near: 0, stand: 1480, onReach: function () { g.unspot(o); g.explore(false); res(); } }); });
      })
      .then(function () { g.tick(0); g.remove('lambA'); return g.scene('town', { ground: 885, bounds: [120, 1560], ambience: 'town' }); })
      .then(function () {
        g.actor('samuel', { img: 'samuel', x: 1180, y: g.ground, h: 430, alt: 'The prophet Samuel', speed: 200, facesLeft: false, flip: true });
        davidIn(g, 60); g.follow = null; g.cam.tx = 900; g.quest(null);
        return g.walk('david', 900);
      })
      .then(function () { return g.say('narrator', 'David came in from the fields: a ruddy boy with bright eyes. And the LORD said to Samuel, “Arise, anoint him: for this is he.”', { ref: '1 Samuel 16:12' }); })
      .then(function () {
        g.quest('The anointing', ['Tap Samuel’s horn of oil']); g.explore(true);
        return new Promise(function (res) { var o = g.spot({ x: 1175, y: 640, r: 80, label: 'Samuel’s horn of oil', icon: '📯', walk: false, onReach: function () { g.unspot(o); g.explore(false); res(); } }); });
      })
      .then(function () {
        g.tick(0); A.fx('oil'); g.glow(true, 'rgba(255,215,110,.6)');
        var d = g.actors.david; d.el.classList.add('kad-anointed');
        for (var k = 0; k < 4; k++) setTimeout(function () { g.burst(d.x, d.y - d.h * 0.9, 'star', 18, { speed: 1.6, up: 0.5, g: 0.02, r: 4, life: 1.8, c: '#ffe27a' }); }, k * 350);
        return wait(1800);
      })
      .then(function () { return g.say('narrator', 'Then Samuel took the horn of oil, and anointed him in the midst of his brethren: and the Spirit of the LORD came upon David from that day forward.', { ref: '1 Samuel 16:13', verse: true }); })
      .then(function () { g.glow(false); return g.say('david', 'Me? I am only the youngest, a shepherd boy… But God sees my heart. I will serve Him with all of it.'); })
      .then(function () { return g.reward('heart', 'Man looketh on the outward appearance, but the LORD looketh on the heart.', '1 Samuel 16:7'); });
  }

  /* tents in bg-camp: [x, y, short name, how Jesse describes it] */
  /* tents in bg-camp: [x, y, what David says (Jesse's directions), the quest line, the label] */
  var TENTS = [
    [640, 380, 'Ten loaves of bread and parched corn for my brothers. Father said their tent is the blue-striped one, with the rack of spears in front. There are so many tents… I must look carefully.', 'Find the blue-striped tent with the spears', 'Look in the striped tent'],
    [880, 430, 'Ten loaves of bread and parched corn for my brothers. Father said their tent is the one with the red woven rug hanging inside. There are so many tents… I must look carefully.', 'Find the tent with the red woven rug', 'Look in the tent with the rug'],
    [1130, 430, 'Ten loaves of bread and parched corn for my brothers. Father said their tent is one of the small white tents far down the camp. There are so many tents… I must look carefully.', 'Find the small white tents far away', 'Look in the white tents'],
    [1460, 400, 'Ten loaves of bread and parched corn for my brothers. Father said their tent is the red-striped one, with the round shields beside it. There are so many tents… I must look carefully.', 'Find the red-striped tent with the shields', 'Look in the red tent']
  ];
  function ch3(g) {
    var tents, want;
    return g.scene('camp', { ground: 860, bounds: [380, 1300], ambience: 'camp' })
      .then(function () { A.music('calm'); return g.chapterTitle(4, 'To the Camp', 'The army of Israel, by the Valley of Elah'); })
      .then(function () { davidIn(g, 420, 380); g.follow = g.actors.david; return g.say('narrator', 'Years passed. David’s three eldest brothers went to war with King Saul against the Philistines. Their father sent David with food for them.', { ref: '1 Samuel 17:17' }); })
      .then(function () {
        /* the tents of the camp: Jesse told David how to find the right one */
        tents = shuffle(TENTS); want = tents[0];
        return g.say('david', want[2]);
      })
      .then(function () {
        g.quest('Bring the bread to your brothers', [want[3]]); g.explore(true);
        var tries = 0;
        return new Promise(function (res) {
          TENTS.forEach(function (t) {
            var o = g.spot({ x: t[0], y: t[1], r: 70, label: t[4], cls: 'kad-spot--quiet', near: 0, stand: clamp(t[0], 400, 1290), onReach: function () {
              if (t === want) { g.spots.slice().forEach(function (x) { if (x.tent) g.unspot(x); }); g.explore(false); res(); return; }
              tries++; A.fx('soft');
              return g.say('narrator', ['A soldier looks up from his bread: “The sons of Jesse? Not in this tent, lad.”', '“Eliab of Bethlehem? No, he is not here. Look again.”', 'Only spears and shields in this one. This is not the right tent.'][tries % 3]);
            } });
            o.tent = true;
          });
        });
      })
      .then(function () { g.tick(0); return g.say('narrator', 'David greeted his brothers. But suddenly the whole camp went quiet. From across the valley came heavy footsteps…'); })
      .then(function () { A.music('tense'); g.weather = 'tense'; g.shake(500); A.fx('thump'); return wait(700); })
      .then(function () { g.shake(500); A.fx('thump'); return wait(700); })
      .then(function () { return g.say('goliath', 'I defy the armies of Israel this day! Give me a man, that we may fight together!', { ref: '1 Samuel 17:10' }); })
      .then(function () { return g.say('narrator', 'It was Goliath of Gath, a giant champion of the Philistines. His armour shone like fire, and his spear was like a weaver’s beam. All the men of Israel ran from him, and were sore afraid.', { ref: '1 Samuel 17:24' }); })
      .then(function () { return g.choose('What will David say?', [{ label: '“Who is this, that he should defy the armies of the living God?”', value: 1 }, { label: '“Let’s hide with the others.”', value: 2 }]); })
      .then(function (v) {
        if (v === 2) return g.fail({ icon: '🫣', eyebrow: 'Fear won', title: 'Nobody stood up for God', text: 'David hid with the others. Day after day the giant mocked the living God, and nobody answered him. David forgot the lion God had saved him from, and let fear speak louder than faith.', verse: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee.', ref: 'Isaiah 41:10' });
        return g.say('narrator', 'The soldiers stared at the shepherd boy. Somebody ran to tell the king.');
      })
      .then(function () { g.actor('saul', { img: 'saul', x: 1260, y: g.ground, h: 450, alt: 'King Saul', flip: true }); g.fadeIn('saul'); return wait(400); })
      .then(function () { return g.say('saul', 'Thou art not able to go against this Philistine to fight with him: for thou art but a youth, and he a man of war from his youth.', { ref: '1 Samuel 17:33' }); })
      .then(function () { return g.say('david', 'Thy servant kept his father’s sheep. When a lion and a bear came and took a lamb, I went after them and saved it. The LORD that delivered me out of the paw of the lion, and out of the paw of the bear, He will deliver me out of the hand of this Philistine.', { ref: '1 Samuel 17:37' }); })
      .then(function () { return g.say('saul', 'Go, and the LORD be with thee. But take my armour: my helmet of brass, and my coat of mail.'); })
      .then(function () {
        g.quest('King Saul’s armour', ['Put on the king’s armour', 'Try to walk']); g.explore(true);
        return new Promise(function (res) { var o = g.spot({ x: 1130, y: 640, r: 80, label: 'Put on King Saul’s armour', icon: '🛡️', near: 140, onReach: function () { g.unspot(o); res(); } }); });
      })
      .then(function () {
        A.fx('clank'); setTimeout(function () { A.fx('clank'); }, 220);
        var d = g.actors.david; d.el.classList.add('kad-armoured'); d.heavy = true; d.speed = 70; g.tick(0);
        return g.say('david', 'Oof! This helmet is so heavy… and this coat of mail… I can hardly move!');
      })
      .then(function () { g.explore(true); return new Promise(function (res) { var tries = 0, t = setInterval(function () { var d = g.actors.david; if (!d) return clearInterval(t); if (d.walking && ++tries > 3) { clearInterval(t); res(); } }, 400); }); })
      .then(function () { g.explore(false); g.tick(1); return wait(700); })
      .then(function () { return g.choose('The armour is the king’s own. What will David do?', [{ label: 'Keep the king’s armour: it is strong and shining', value: 1 }, { label: 'Take it off, and go as a shepherd trusting God', value: 2 }]); })
      .then(function (v) {
        if (v === 1) {
          var d = g.actors.david; g.follow = d;
          return g.say('narrator', 'David clanked down into the valley in armour he had never tried. He could hardly lift his arm to swing the sling. Goliath laughed, and came on…')
            .then(function () { A.fx('thump'); g.shake(700); return wait(700); })
            .then(function () { return g.fail({ icon: '🛡️', eyebrow: 'Goliath won the battle', title: 'Goliath defeated David', text: 'David trusted in King Saul’s heavy armour instead of in the LORD. He was so slow that the giant beat him before he could throw a single stone.', verse: 'Some trust in chariots, and some in horses: but we will remember the name of the LORD our God.', ref: 'Psalm 20:7' }); });
        }
        return g.say('david', 'I cannot go with these; for I have not proved them.', { ref: '1 Samuel 17:39' });
      })
      .then(function () { var d = g.actors.david; d.el.classList.remove('kad-armoured'); d.heavy = false; d.speed = 300; A.fx('soft'); return g.say('narrator', 'David took the armour off. He would go as he was: a shepherd, with his staff, his sling, and his trust in God.'); })
      .then(function () { A.music('calm'); g.weather = 'sun'; return g.reward('courage', 'The LORD that delivered me out of the paw of the lion, and out of the paw of the bear, he will deliver me.', '1 Samuel 17:37'); });
  }

  /* the brook: smooth stones fly true, rough ones wobble and miss. [x, y, size] in bg-valley */
  var BROOK = [[985, 640, 62], [1075, 662, 58], [1180, 640, 56], [1290, 668, 60], [1395, 700, 58], [1150, 815, 64], [1255, 845, 62], [1365, 905, 66], [1495, 880, 60], [1040, 860, 58], [1425, 790, 56], [1195, 720, 54]];
  function bag() { var r = (load().david || {}).bag; return Array.isArray(r) && r.length ? r.slice(0, 5) : ['s', 's', 's', 's', 's']; }
  function ch4(g) {
    return g.scene('valley', { ground: 880, bounds: [180, 960], ambience: 'brook', sparkles: [[1000, 700], [1150, 760], [1300, 820], [1420, 860], [1250, 900], [1100, 880]] })
      .then(function () { A.music('calm'); return g.chapterTitle(5, 'Five Smooth Stones', 'The brook in the valley'); })
      .then(function () { davidIn(g, 300); g.follow = g.actors.david; return g.say('narrator', 'David went down to the brook in the valley. Some stones had been made smooth by the running water. Others were rough, cracked and jagged.'); })
      .then(function () { return g.say('david', 'Only smooth stones fly true. A rough stone wobbles in the air and misses. I must look at each one carefully before I put it in my bag.'); })
      .then(function () {
        g.quest('Choose five smooth stones', ['Stones in your bag: 0 of 5']); g.explore(true); g.cam.tx = 1150;
        var kinds = shuffle(['s', 's', 's', 's', 's', 's', 's', 'r', 'r', 'r', 'r', 'r']), got = [];
        var bagBar = $('div', { class: 'kad-bag', 'aria-label': 'Your shepherd’s bag' }); g.stage.appendChild(bagBar);
        function paintBag() {
          bagBar.innerHTML = ''; bagBar.appendChild($('span', { class: 'kad-bag__h', text: '👜' }));
          for (var i = 0; i < 5; i++) (function (i) {
            var k = got[i], b = $('button', { class: 'kad-bag__slot' + (k ? ' full kad-bag__slot--' + k.kind : ''), type: 'button', 'aria-label': k ? 'A stone in your bag: tap to put it back' : 'Empty' });
            if (k) { b.appendChild($('img', { src: img('stone-b'), alt: '', class: 'kad-bstone kad-bstone--' + k.kind })); b.addEventListener('click', function (e) { e.stopPropagation(); A.fx('splash'); var x = got.splice(i, 1)[0]; x.o.el.hidden = false; x.o.taken = false; paintBag(); g.tick(0, 'Stones in your bag: ' + got.length + ' of 5'); g.qitems[0].classList.remove('done'); }); }
            bagBar.appendChild(b);
          })(i);
        }
        paintBag();
        return new Promise(function (res) {
          BROOK.forEach(function (p, i) {
            var kind = kinds[i];
            var o = g.spot({ x: p[0], y: p[1], r: 44, label: 'A stone in the brook', cls: 'kad-spot--bstone', walk: false, onReach: function () {
              if (o.taken || got.length >= 5) return;
              return g.inspectStone(kind).then(function (keep) {
                if (!keep) { A.fx('splash'); return; }
                o.taken = true; o.el.hidden = true; A.fx('splash'); got.push({ kind: kind, o: o });
                g.burst(p[0], p[1], 'dot', 12, { speed: 2.2, up: 1.5, g: 0.12, r: 2.5, life: 0.7, c: 'rgba(220,240,255,.9)' });
                paintBag(); g.tick(0, 'Stones in your bag: ' + got.length + ' of 5'); if (got.length < 5) g.qitems[0].classList.remove('done');
                else { A.fx('chime'); var d = load(), rec = d.david = d.david || {}; rec.bag = got.map(function (x) { return x.kind; }); store(d); setTimeout(function () { bagBar.remove(); res(); }, 900); }
              });
            } });
            o.w = p[2]; o.el.appendChild($('img', { class: 'kad-bstone kad-bstone--' + kind, src: img('stone-b'), alt: '', draggable: 'false', style: 'transform:rotate(' + Math.round(Math.random() * 50 - 25) + 'deg)' }));
            g.placeSpot(o);
          });
        });
      })
      .then(function () { g.explore(false); g.cam.tx = null; return g.say('narrator', 'He chose him five stones out of the brook, and put them in a shepherd’s bag. His sling was in his hand.', { ref: '1 Samuel 17:40', verse: true }); })
      .then(function () { return g.say('david', 'One for each finger of my hand. But it is not the stones that will win. It is the LORD.'); })
      .then(function () { return g.reward('wisdom', 'And he took his staff in his hand, and chose him five smooth stones out of the brook.', '1 Samuel 17:40'); });
  }
  /* a stone up close: the child decides */
  P.inspectStone = function (kind) {
    var self = this; this.busyUI = true;
    var big = $('img', { class: 'kad-inspect__stone kad-bstone--' + kind, src: img('stone-b'), alt: '' });
    var card = $('div', { class: 'kad-inspect' }, [
      $('p', { class: 'kad-inspect__h', text: 'Look closely. Is this stone smooth?' }), $('div', { class: 'kad-inspect__pic' }, [big]),
      $('div', { class: 'kad-inspect__go' }, [$('button', { class: 'kad-next', type: 'button', 'data-k': '1', text: '👜 Put it in my bag' }), $('button', { class: 'kad-next kad-next--ghost', type: 'button', 'data-k': '0', text: '💧 Put it back in the water' })])
    ]);
    this.ui.appendChild(card); A.fx('splash');
    return new Promise(function (res) {
      card.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; e.stopPropagation(); A.fx('tap'); card.remove(); self.busyUI = false; res(b.getAttribute('data-k') === '1'); });
    });
  };

  function ch5(g) {
    return g.scene('valley', { ground: 885, bounds: [300, 760], ambience: 'battle', sparkles: [[1150, 760], [1300, 820], [1250, 900]] })
      .then(function () { A.music('tense'); g.weather = 'tense'; return g.chapterTitle(6, 'The Valley of Elah', 'Faith over fear'); })
      .then(function () {
        davidIn(g, 420); g.follow = null; g.cam.tx = 860;
        g.actor('goliath', { img: 'goliath', x: 1290, y: 640, h: 620, alt: 'Goliath', flip: true, cls: 'kad-giant' });
        g.shake(500); A.fx('thump'); return wait(600);
      })
      .then(function () { return g.say('narrator', 'Goliath came down into the valley. When he saw David, a ruddy boy with a staff and a sling, he laughed.'); })
      .then(function () { return g.say('goliath', 'Am I a dog, that thou comest to me with staves? Come to me, little one!', { ref: '1 Samuel 17:43' }); })
      .then(function () {
        var ask = function () {
          return g.choose('What did David answer?', [
            { label: '“I am bigger than I look!”', value: 1 },
            { label: '“Thou comest to me with a sword and a spear: but I come to thee in the name of the LORD of hosts.”', value: 2 },
            { label: '“Please, let us be friends.”', value: 3 }
          ]).then(function (v) {
            if (v === 2) return true;
            if (v === 1) return g.say('narrator', 'David puffed out his chest and ran at the giant in his own strength…').then(function () { A.fx('thump'); g.shake(800); return wait(600); }).then(function () { return g.fail({ icon: '💔', eyebrow: 'David lost his faith', title: 'Goliath defeated David', text: 'David forgot where his strength came from. He trusted in himself instead of in the LORD, and alone he was no match for the giant.', verse: 'Pride goeth before destruction, and an haughty spirit before a fall.', ref: 'Proverbs 16:18' }); });
            return g.say('narrator', 'David lowered his sling and stepped back. Goliath roared with laughter and strode toward him…').then(function () { A.fx('thump'); g.shake(800); return wait(500); }).then(function () { return g.walk('david', 200, { speed: 420 }); }).then(function () { return g.fail({ icon: '🏃', eyebrow: 'Fear won', title: 'David ran away', text: 'The giant mocked the living God, and David backed away and ran from the valley. Israel stayed afraid, and the Philistines were not stopped that day.', verse: 'Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.', ref: 'Joshua 1:9' }); });
          });
        };
        return ask();
      })
      .then(function () { return g.say('david', 'Thou comest to me with a sword, and with a spear: but I come to thee in the name of the LORD of hosts, the God of the armies of Israel. For the battle is the LORD’s!', { ref: '1 Samuel 17:45', verse: true }); })
      .then(function () { g.actor('david', { img: 'david-sling', h: 420, noFlip: true }); g.glow(true, 'rgba(255,230,150,.35)'); return g.say('narrator', 'David ran toward the giant. He put his hand in his bag, took out a stone, and placed it in his sling…'); })
      .then(function () { return g.battle(); })
      .then(function () {
        var go = g.actors.goliath; A.fx('hit'); g.flashWhite(); g.shake(900); A.stopMusic();
        g.burst(go.x - 30, go.y - go.h * 0.88, 'star', 26, { speed: 3, r: 5, life: 1.2, c: '#ffe9a6' });
        return wait(700).then(function () {
          g.actor('goliath', { img: 'goliath-kneel', h: 520, cls: 'kad-giant kad-fall' });
          A.fx('thump'); g.shake(1000);
          g.burst(go.x, go.y, 'dot', 40, { speed: 3.2, up: 1.2, g: 0.04, r: 6, life: 2, c: 'rgba(214,186,140,.55)' });
          return wait(1800);
        });
      })
      .then(function () { var go = g.actors.goliath; go.el.classList.add('kad-gone'); g.glow(true, 'rgba(255,240,190,.5)'); A.fx('cheer'); A.music('joy'); g.weather = 'sun'; return wait(1200); })
      .then(function () { return g.say('narrator', 'The giant fell to the ground. So David prevailed over the Philistine with a sling and with a stone. Not by sword, not by spear, but by the LORD.', { ref: '1 Samuel 17:50', verse: true }); })
      .then(function () { g.glow(false); return g.say('david', 'All the earth will know that there is a God in Israel, and that the LORD saveth not with sword and spear: for the battle is the LORD’s!', { ref: '1 Samuel 17:46–47' }); })
      .then(function () { return g.reward('faith', 'For the battle is the LORD’s.', '1 Samuel 17:47'); });
  }

  /* the throws: one stone from the bag each time. A good swing with a smooth stone hits;
     a rough stone wobbles wide; a bad swing misses. Each miss, Goliath comes closer. */
  P.battle = function () {
    var self = this, stones = bag(), n = 0, go = this.actors.goliath; this.slingMisses = 0;
    var bagBar = $('div', { class: 'kad-bag kad-bag--battle', 'aria-label': 'Stones left' }); this.stage.appendChild(bagBar);
    function paint() { bagBar.innerHTML = ''; bagBar.appendChild($('span', { class: 'kad-bag__h', text: '👜' })); stones.forEach(function (k, i) { var b = $('span', { class: 'kad-bag__slot' + (i >= n ? ' full kad-bag__slot--' + k : ' used') }); if (i >= n) b.appendChild($('img', { src: img('stone-b'), alt: '', class: 'kad-bstone kad-bstone--' + k })); bagBar.appendChild(b); }); }
    paint();
    function throwOne() {
      if (n >= stones.length) {
        bagBar.remove();
        return self.walk('goliath', self.actors.david.x + 230, { speed: 140, free: true }).then(function () { A.fx('thump'); self.shake(900); return wait(600); })
          .then(function () { return self.fail({ icon: '💔', eyebrow: 'The stones were gone', title: 'Goliath defeated David', text: stones.indexOf('r') >= 0 ? 'Some of David’s stones were rough, so they wobbled and flew wide. When the last stone was gone, the giant reached him.' : 'Every stone missed, and the giant reached David. David let fear hurry his hand instead of trusting God and waiting for the right moment.', verse: 'They that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles.', ref: 'Isaiah 40:31', tip: stones.indexOf('r') >= 0 ? 'Go back to the brook and choose only smooth stones.' : 'Hold to swing, and let go only when the light is in the gold.', back: stones.indexOf('r') >= 0 ? 3 : null, backLabel: '🪨 Back to the brook' }); });
      }
      var kind = stones[n];
      self.lookAt = self.actors.david;
      return self.slingGame(stones.length - n).then(function (good) {
        n++; paint(); self.clearUI();
        if (good && kind === 's') { setTimeout(function () { self.lookAt = go; }, 500); return self.throwStone(go.x - 40, go.y - go.h * 0.88).then(function () { bagBar.remove(); return true; }); }
        return self.throwStone(go.x - (kind === 'r' ? 260 : 80), go.y - go.h * (kind === 'r' ? 1.25 : 1.15), { wobble: kind === 'r' || !good, miss: true }).then(function () {
          self.lookAt = go; A.fx('thump'); self.shake(500);
          return self.say('narrator', kind === 'r' && good ? 'A good swing, but the stone was rough: it wobbled in the air and flew wide! Goliath laughed and came closer.' : 'The stone flew past the giant. Goliath laughed and came closer.');
        }).then(function () { return self.walk('goliath', Math.max(self.actors.david.x + 380, go.x - 110), { speed: 120, free: true }); }).then(throwOne);
      });
    }
    return throwOne();
  };
  function ch6(g) {
    return g.scene('victory', { ground: 880, bounds: [300, 1400], ambience: 'brook', sparkles: [[1100, 800], [1300, 860], [1500, 880], [1250, 760]] })
      .then(function () { A.music('joy'); return g.chapterTitle(7, 'Victory', 'Faith over fear'); })
      .then(function () { davidIn(g, 820, 420); g.follow = g.actors.david; g.actor('lambv', { img: 'lamb', x: 640, y: 900, h: 150, alt: 'A lamb' }); return g.say('narrator', 'The valley was quiet again. The sling lay on the rock, and the giant’s spear lay in the grass. The army of Israel shouted for joy.'); })
      .then(function () { A.fx('cheer'); return g.say('david', 'It was never my strength. God was with me in the fields, with the lambs, with the lion and the bear… and He was with me today.'); })
      .then(function () { return g.say('narrator', 'Many years later, David became king of Israel. And a thousand years after that, in David’s own town of Bethlehem, Jesus Christ was born: the Son of David, the Good Shepherd, who defeated the greatest enemy of all.', { ref: 'Matthew 1:1' }); })
      .then(function () { return g.trust(); });
  }
  P.trust = function () {
    var self = this, d = load(), rec = d[this.adv.id] || {}, vs = rec.verses || [];
    this.finishChapter(this.adv.chapters.length);
    var r = this.reward('trust', 'Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.', 'Joshua 1:9');
    return r.then(function () {
      self.clearUI(); d = load(); rec = d[self.adv.id] || {}; vs = rec.verses || [];
      var list = $('ul', { class: 'kad-journey__verses' });
      vs.forEach(function (ref) { list.appendChild($('li', {}, [$('a', { href: BIBLE + '#/p/kjva/' + ref.replace(/^(\d?\s?[A-Za-z]+)\s(\d+):(\d+)(?:[–-](\d+))?$/, function (m, b, c, v1, v2) { return encodeURIComponent(b) + '/' + c + '/' + v1 + (v2 ? '-' + v2 : ''); }), target: '_blank', rel: 'noopener', text: '📖 ' + ref })])); });
      var vir = $('div', { class: 'kad-journey__virtues' });
      Object.keys(VIRTUES).forEach(function (k) { var on = (rec.virtues || []).indexOf(k) >= 0; vir.appendChild($('div', { class: 'kad-journey__v' + (on ? ' on' : '') }, [$('span', { text: VIRTUES[k][0] }), $('small', { text: VIRTUES[k][1] })])); });
      var box = $('div', { class: 'kad-journey' }, [
        $('p', { class: 'kad-chapters__eyebrow', text: 'Adventure complete' }), $('h2', { text: 'Your Faith Journey' }), vir,
        $('p', { class: 'kad-journey__h', text: 'Scriptures you have unlocked' }), list,
        $('div', { class: 'kad-journey__go' }, [
          $('button', { class: 'kad-next', type: 'button', text: '🗺️ All chapters', onclick: function () { self.chapters(); } }),
          $('button', { class: 'kad-next kad-next--ghost', type: 'button', text: 'Back to Kids Corner', onclick: function () { self.close(); } })
        ])
      ]);
      self.ui.appendChild(box); A.fx('reward');
      return new Promise(function () {}); /* stays until the child chooses */
    });
  };

  var ADVENTURES = { david: DAVID };
  function open(id, chapter) {
    if (G) return; var adv = ADVENTURES[id || 'david']; if (!adv) return;
    CUR = adv; A.init(); G = new Game(adv);
    try { history.replaceState(null, '', location.pathname + location.search + '#adventure-' + adv.id); } catch (e) {}
    if (chapter != null) G.play(chapter); else G.chapters();
  }
  window.KJTAdventure = { open: open, progress: function () { return load(); }, game: function () { return G; },
    /* 7.9.11: other adventures (adventure-armour.js) add themselves here */
    register: function (adv) { ADVENTURES[adv.id] = adv; paintCards(); if (pendingOpen === adv.id) { pendingOpen = null; setTimeout(function () { open(adv.id); }, 300); } },
    kit: { P: P, A: A, $: $, wait: wait, clamp: clamp, img: img, load: load, store: store } };
  var pendingOpen = null;

  /* the card on the page */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-kjt-adventure]'); if (!b) return;
    e.preventDefault(); open(b.getAttribute('data-kjt-adventure'));
  });
  function paintCards() {
    var d = load();
    document.querySelectorAll('[data-kjt-adventure-progress]').forEach(function (el) {
      var id = el.getAttribute('data-kjt-adventure-progress'), adv = ADVENTURES[id]; if (!adv) return;
      var n = ((d[id] || {}).done || []).length; el.textContent = n ? (n >= adv.chapters.length ? '⭐ Adventure complete! Play again any time.' : '▶ ' + n + ' of ' + adv.chapters.length + ' chapters done') : (adv.length || '7 chapters · about 25 minutes');
    });
  }
  window.addEventListener('kjt-adventure-closed', paintCards);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', paintCards); else paintCards();
  if (/^#adventure-(\w+)/.test(location.hash)) { var m = location.hash.match(/^#adventure-(\w+)/); if (ADVENTURES[m[1]]) setTimeout(function () { open(m[1]); }, 600); else pendingOpen = m[1]; }
})();
