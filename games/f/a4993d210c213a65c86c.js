/* KJT Kids Corner \u00b7 soft sounds (Site Core 5.3.2)
   Tiny sounds made by the browser itself (Web Audio): no files, nothing
   downloaded, works offline. Short (under half a second), quiet, gentle.
     tap      soft pop                 buttons, cards, letters, dots
     open     two rising notes         opening an activity
     back     two falling notes        back to all activities
     good     small sparkle            a correct answer / a word found
     miss     soft low note            a wrong tap
     success  short happy tune         finishing a game, stop or puzzle
   Story scenes (5.4.1): sheep, fire, waves, thunder, angel, bell, coins,
   crash, crowd, birds, crickets, splash, wind, sad.
   Mute with the speaker button (remembered on this device only).
   API: window.KJTSound.play(name), .muted(), .toggle(). */
(function () {
  'use strict';
  var KEY = 'kjt_kids_sound', ctx = null, master = null, wet = null, last = {};
  var enabled = (window.KJT_KIDS_HUB && window.KJT_KIDS_HUB.sounds === false) ? false : true;
  /* 7.9.31: on Fun & Games ("quiet"), no tap or click sounds and no automatic sounds; the games' own sounds still play */
  var QUIET = !!(window.KJT_KIDS_HUB && window.KJT_KIDS_HUB.quiet), CLICKS = { tap: 1, open: 1, back: 1 };
  function muted() { try { return localStorage.getItem(KEY) === 'off'; } catch (e) { return false; } }
  function setMuted(m) { try { localStorage.setItem(KEY, m ? 'off' : 'on'); } catch (e) {} document.querySelectorAll('[data-kjt-sound-toggle]').forEach(paint); }
  function audio() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    /* A soft room echo for story sounds (5.5.1): a generated impulse, no files. */
    try {
      var len = ctx.sampleRate * 2.4, imp = ctx.createBuffer(2, len, ctx.sampleRate);
      for (var ch = 0; ch < 2; ch++) { var d = imp.getChannelData(ch); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
      var conv = ctx.createConvolver(); conv.buffer = imp; wet = ctx.createGain(); wet.gain.value = 0.32; wet.connect(conv); conv.connect(master);
    } catch (e) { wet = null; }
    return ctx;
  }
  /* One soft note: frequency glide, quick attack, smooth fade. */
  function note(freq, start, dur, type, vol, glideTo, reverb, attack) {
    var c = ctx, o = c.createOscillator(), g = c.createGain(), t = c.currentTime + start;
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + dur * 0.8);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.08, t + (attack || 0.012)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); if (reverb && wet) g.connect(wet); o.start(t); o.stop(t + dur + 0.02);
    return o;
  }
  /* Soft noise for waves, wind, fire, thunder, crowds (made once, reused). */
  var noiseBuf = null;
  function noise(start, dur, vol, type, freq, q, shape, reverb, sweepTo) {
    var c = ctx; if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    var src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + start;
    src.buffer = noiseBuf; src.loop = true; f.type = type || 'lowpass'; f.frequency.setValueAtTime(freq || 800, t); f.Q.value = q || 0.7;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    if (shape === 'swell') { g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    else { g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    src.connect(f); f.connect(g); g.connect(master); if (reverb && wet) g.connect(wet); src.start(t, Math.random()); src.stop(t + dur + 0.05);
  }
  function bleat(start, pitch) { /* a little sheep: a voice-like "baa" (two vowel resonances and a quick wobble) */
    var c = ctx, t = c.currentTime + start, p = pitch || 1, o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(330 * p, t); o.frequency.linearRampToValueAtTime(300 * p, t + 0.55);
    lfo.frequency.value = 11; lg.gain.value = 22 * p; lfo.connect(lg); lg.connect(o.frequency);
    [[750, 6, 1], [1250, 8, 0.6], [2600, 10, 0.25]].forEach(function (fm) { var f = c.createBiquadFilter(), fg = c.createGain(); f.type = 'bandpass'; f.frequency.value = fm[0]; f.Q.value = fm[1]; fg.gain.value = fm[2]; o.connect(f); f.connect(fg); fg.connect(g); });
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.06); g.gain.setValueAtTime(0.09, t + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.62);
    g.connect(master); if (wet) g.connect(wet); o.start(t); lfo.start(t); o.stop(t + 0.66); lfo.stop(t + 0.66);
  }
  var SOUNDS = {
    /* Story Adventures scene sounds (richer in 5.5.1: room echo, layered, gentler) */
    sheep: function () { bleat(0, 1); bleat(0.75, 1.12); },
    fire: function () { noise(0, 1.6, 0.035, 'lowpass', 380, 0.6, 'swell', true); for (var i = 0; i < 12; i++) noise(Math.random() * 1.4, 0.025 + Math.random() * 0.03, 0.04 + Math.random() * 0.04, 'highpass', 2000 + Math.random() * 2500); },
    waves: function () { noise(0, 2.4, 0.07, 'lowpass', 400, 0.5, 'swell', true, 1100); noise(1.2, 2.2, 0.05, 'lowpass', 500, 0.5, 'swell', true, 1300); noise(0.8, 1.2, 0.02, 'highpass', 3000, 0.5, 'swell', true); },
    thunder: function () { noise(0, 0.25, 0.1, 'highpass', 900, 0.7, null, true); noise(0.05, 2.6, 0.18, 'lowpass', 220, 0.8, null, true, 60); noise(0.4, 2.0, 0.08, 'lowpass', 120, 0.9, 'swell', true); },
    angel: function () { [659, 831, 988, 1319].forEach(function (f) { note(f, 0, 2.2, 'sine', 0.018, null, true, 0.5); }); [1976, 2637, 2349, 3136, 2637].forEach(function (f, i) { note(f, 0.25 + i * 0.14, 0.9, 'sine', 0.02, null, true); }); },
    bell: function () { [[220, 0.07, 3.2], [440, 0.035, 2.6], [587, 0.03, 2.2], [880 * 1.19, 0.018, 1.6], [880 * 1.5, 0.012, 1.3], [880 * 2.02, 0.01, 1.1]].forEach(function (b) { note(b[0], 0, b[2], 'sine', b[1], null, true, 0.004); }); },
    coins: function () { [2400, 2950, 2650, 3200, 2800].forEach(function (f, i) { note(f, i * 0.085, 0.22, 'triangle', 0.028, null, true, 0.003); note(f * 1.5, i * 0.085, 0.12, 'sine', 0.01); }); },
    crash: function () { noise(0, 0.5, 0.12, 'highpass', 1200, 0.7, null, true, 400); [2800, 3400, 2500, 4100].forEach(function (f, i) { note(f, 0.02 + i * 0.06, 0.18, 'triangle', 0.025, null, true, 0.003); }); note(90, 0, 0.35, 'sine', 0.1, 50); },
    crowd: function () { for (var i = 0; i < 5; i++) noise(i * 0.25, 1.4, 0.03, 'bandpass', 350 + i * 110, 3, 'swell', true); },
    birds: function () { [[0, 2900, 3700], [0.14, 3100, 2600], [0.5, 2700, 3500], [0.62, 3300, 2900], [1.1, 3000, 3900]].forEach(function (b) { note(b[1], b[0], 0.11, 'sine', 0.022, b[2], true, 0.01); }); },
    crickets: function () { for (var r = 0; r < 2; r++) for (var i = 0; i < 6; i++) note(4400, r * 0.7 + i * 0.055, 0.03, 'sine', 0.012, null, true, 0.004); },
    splash: function () { noise(0, 0.7, 0.09, 'bandpass', 1800, 0.8, null, true, 500); },
    wind: function () { noise(0, 2.6, 0.06, 'bandpass', 300, 3, 'swell', true, 900); noise(0.6, 2.0, 0.03, 'bandpass', 700, 5, 'swell', true, 400); },
    /* Dramatic cues (5.5.1) */
    tension: function () { note(73.4, 0, 2.6, 'sawtooth', 0.02, null, true, 0.9); note(77.8, 0, 2.6, 'sawtooth', 0.016, null, true, 0.9); noise(0, 2.4, 0.02, 'lowpass', 200, 0.7, 'swell', true); note(146.8, 0.5, 1.8, 'triangle', 0.015, 138.6, true, 0.6); },
    sting: function () { [110, 130.8, 155.6, 220].forEach(function (f) { note(f, 0, 1.6, 'sawtooth', 0.022, null, true, 0.01); }); note(55, 0, 1.4, 'sine', 0.09, 45, true); noise(0, 0.3, 0.05, 'lowpass', 600, 0.7, null, true); },
    heartbeat: function () { [0, 0.22, 0.9, 1.12].forEach(function (d, i) { note(i % 2 ? 50 : 60, d, 0.16, 'sine', i % 2 ? 0.07 : 0.1, 40); }); },
    /* Game sounds (5.5.0) */
    drum: function () { note(110, 0, 0.18, 'sine', 0.12, 55); noise(0, 0.08, 0.05, 'lowpass', 400); },
    drum2: function () { note(160, 0, 0.12, 'sine', 0.08, 90); },
    trumpet: function () { [392, 523, 659, 784].forEach(function (f, i) { note(f, i * 0.12, 0.3, 'sawtooth', 0.025); }); note(784, 0.48, 0.7, 'sawtooth', 0.03); },
    shout: function () { noise(0, 0.9, 0.08, 'bandpass', 700, 0.8, 'swell'); note(220, 0, 0.6, 'sawtooth', 0.02); },
    rumble: function () { noise(0, 1.8, 0.14, 'lowpass', 120, 0.8); noise(0.3, 1.4, 0.06, 'lowpass', 300, 0.8); },
    collect: function () { note(880, 0, 0.06, 'sine', 0.05, 1320); },
    hit: function () { note(180, 0, 0.16, 'sine', 0.08, 90); noise(0, 0.12, 0.04, 'lowpass', 500); },
    /* 7.9.9: Journey to Jerusalem and Paul's Journeys */
    diceroll: function () { for (var i = 0; i < 9; i++) { var t = i * 0.075 + Math.random() * 0.02; noise(t, 0.035, 0.07 - i * 0.005, 'bandpass', 2200 + Math.random() * 1500, 2.5); note(700 + Math.random() * 500, t, 0.03, 'triangle', 0.012); } noise(0, 0.7, 0.025, 'lowpass', 900, 0.7); },
    /* 7.9.10: Holy War (chess) */
    clack: function () { noise(0, 0.05, 0.08, 'bandpass', 1800, 2); note(240, 0, 0.09, 'triangle', 0.05, 170); note(620, 0.005, 0.05, 'sine', 0.02); },
    clash: function () { noise(0, 0.25, 0.09, 'highpass', 2500, 0.8, null, true, 900); [1900, 2600, 3300].forEach(function (f, i) { note(f, i * 0.015, 0.35, 'triangle', 0.02, f * 0.96, true, 0.003); }); note(160, 0, 0.18, 'sine', 0.06, 90); },
    /* 7.9.30: Holy War: a firm wooden step for every move, and a short battle when a piece is taken prisoner */
    /* 7.9.33: Solitaire: a card laid down, a card turned over, a shuffle, two tiles matched */
    card: function () { noise(0, 0.07, 0.07, 'bandpass', 2600, 0.9, null, false, 1200); note(180, 0.01, 0.08, 'sine', 0.05, 120); },
    cardflip: function () { noise(0, 0.05, 0.05, 'highpass', 3000, 0.7, null, false, 1600); note(520, 0, 0.05, 'triangle', 0.025, 380); },
    shuffle: function () { for (var i = 0; i < 9; i++) noise(i * 0.045, 0.06, 0.05 + 0.02 * Math.random(), 'bandpass', 2200 + Math.random() * 900, 0.9); note(200, 0.42, 0.1, 'sine', 0.05, 140); },
    tilematch: function () { noise(0, 0.04, 0.07, 'bandpass', 1500, 2.2); note(300, 0, 0.08, 'triangle', 0.05, 230); noise(0.09, 0.04, 0.07, 'bandpass', 1700, 2.2); note(330, 0.09, 0.08, 'triangle', 0.05, 250); note(1175, 0.18, 0.5, 'sine', 0.035, null, true); note(1760, 0.24, 0.6, 'sine', 0.02, null, true); },
    chessmove: function () { note(170, 0, 0.16, 'sine', 0.13, 95); noise(0, 0.06, 0.12, 'bandpass', 1100, 1.4); note(420, 0.003, 0.07, 'triangle', 0.04, 260); noise(0.07, 0.05, 0.04, 'bandpass', 700, 1.2); },
    /* 7.9.32: check: two sharp brass blasts over a timpani roll; checkmate: a great gong, a deep chord and a long rumble */
    check: function () {
      [0, 0.22].forEach(function (t) { [233, 277, 349].forEach(function (f) { note(f, t, 0.32, 'sawtooth', 0.03, null, true, 0.015); }); note(116.5, t, 0.32, 'square', 0.02, null, true, 0.015); });
      for (var i = 0; i < 8; i++) note(73.4, 0.02 + i * 0.05, 0.12, 'sine', 0.07 + i * 0.006, 60, true, 0.004);
      note(73.4, 0.44, 0.9, 'sine', 0.14, 50, true, 0.005); noise(0.44, 0.35, 0.05, 'lowpass', 300, 0.8, null, true);
    },
    checkmate: function () {
      [[110, 0.09], [164.8, 0.05], [233.1, 0.04], [311.1, 0.03], [523, 0.02], [741, 0.012]].forEach(function (g) { note(g[0], 0, 3.2, 'sine', g[1], g[0] * 0.985, true, 0.006); });
      noise(0, 0.5, 0.09, 'bandpass', 900, 0.9, null, true, 300); note(55, 0, 2.6, 'sine', 0.16, 41, true, 0.01);
      [146.8, 174.6, 220, 293.7].forEach(function (f) { note(f, 0.5, 2.2, 'sawtooth', 0.016, null, true, 0.25); });
      noise(0.3, 2.8, 0.12, 'lowpass', 140, 0.8, 'swell', true, 60);
    },
    battle: function () {
      /* swords cross twice */
      [0, 0.19].forEach(function (t, k) { noise(t, 0.18, 0.13, 'highpass', 2600, 0.8, null, true, 1200); [2093, 2794, 3520, 4186].forEach(function (f) { note(f * (k ? 1.06 : 1), t, 0.55, 'triangle', 0.022, f * 0.97, true, 0.002); }); });
      /* war drum */
      [0.05, 0.36].forEach(function (t) { note(92, t, 0.32, 'sine', 0.16, 48, true, 0.004); noise(t, 0.09, 0.06, 'lowpass', 380); });
      /* a shout from the troops */
      noise(0.12, 0.7, 0.06, 'bandpass', 650, 1.1, 'swell', true, 900); note(196, 0.14, 0.5, 'sawtooth', 0.018, 165, true, 0.05);
      /* the prison door shuts with a clank of chains */
      noise(0.62, 0.07, 0.12, 'bandpass', 1500, 2.2); note(130, 0.62, 0.3, 'square', 0.035, 82, true, 0.003);
      [0.7, 0.76, 0.83, 0.9].forEach(function (t, i) { note(1700 + i * 260, t, 0.09, 'triangle', 0.02, null, false, 0.002); });
    },
    hop: function () { var f = 420 + Math.random() * 120; note(f, 0, 0.09, 'triangle', 0.045, f * 1.5); note(180, 0, 0.06, 'sine', 0.05, 120); },
    climb: function () { [523, 587, 659, 784, 880, 1047, 1175, 1319].forEach(function (f, i) { note(f, i * 0.13, 0.5, 'triangle', 0.032, null, true, 0.006); note(f * 2, i * 0.13, 0.25, 'sine', 0.01, null, true); }); },
    slither: function () { noise(0, 1.6, 0.06, 'bandpass', 4200, 4, 'swell', true, 1500); note(392, 0, 1.6, 'triangle', 0.035, 98, true, 0.05); note(311, 0.1, 1.5, 'sine', 0.025, 78, true, 0.05); },
    hiss: function () { noise(0, 0.9, 0.07, 'highpass', 5200, 0.8, 'swell'); noise(0.15, 0.6, 0.04, 'bandpass', 3800, 6, 'swell'); },
    fanfare: function () { [[392, 0], [523, 0.16], [659, 0.32], [784, 0.48]].forEach(function (n) { note(n[0], n[1], 0.32, 'sawtooth', 0.028, null, true, 0.02); note(n[0] / 2, n[1], 0.32, 'square', 0.01, null, true, 0.02); }); [523, 659, 784, 1047].forEach(function (f) { note(f, 0.66, 1.6, 'sawtooth', 0.022, null, true, 0.03); }); note(131, 0.66, 1.6, 'sine', 0.06, null, true); },
    sail: function () { noise(0, 2.2, 0.05, 'lowpass', 500, 0.6, 'swell', true, 1200); noise(0.2, 1.8, 0.02, 'bandpass', 1600, 2, 'swell', true); note(220, 0.2, 0.9, 'sine', 0.012, 196, true, 0.3); },
    walk: function () { for (var i = 0; i < 6; i++) { noise(i * 0.22, 0.07, 0.05, 'bandpass', 900 + (i % 2) * 300, 1.6); note(140 + (i % 2) * 20, i * 0.22, 0.06, 'sine', 0.03, 100); } },
    quake: function () { noise(0, 2.4, 0.2, 'lowpass', 90, 0.9, 'swell', true, 50); noise(0.1, 2.0, 0.06, 'lowpass', 260, 0.8, 'swell', true); for (var i = 0; i < 7; i++) noise(0.3 + i * 0.25, 0.08, 0.05, 'bandpass', 1400 + Math.random() * 900, 3); },
    storm: function () { noise(0, 3.2, 0.12, 'lowpass', 600, 0.6, 'swell', true, 1600); noise(0.3, 2.8, 0.05, 'bandpass', 500, 3, 'swell', true, 1100); noise(0.9, 0.3, 0.1, 'highpass', 900, 0.7, null, true); noise(0.95, 2.4, 0.16, 'lowpass', 200, 0.8, null, true, 60); },
    dice: function () { for (var i = 0; i < 5; i++) noise(i * 0.06, 0.04, 0.05, 'highpass', 1800); },
    step: function () { note(520, 0, 0.05, 'triangle', 0.035); },
    sad: function () { note(523, 0, 0.5, 'triangle', 0.04, null, true); note(466, 0.35, 0.5, 'triangle', 0.036, null, true); note(392, 0.7, 1.1, 'triangle', 0.036, null, true); note(196, 0.7, 1.3, 'sine', 0.03, null, true, 0.2); },
    tap: function () { note(740, 0, 0.07, 'sine', 0.05, 980); },
    open: function () { note(659, 0, 0.12, 'triangle', 0.06); note(988, 0.08, 0.16, 'triangle', 0.055); },
    back: function () { note(880, 0, 0.1, 'triangle', 0.05); note(587, 0.07, 0.14, 'triangle', 0.045); },
    good: function () { note(1047, 0, 0.1, 'sine', 0.06); note(1568, 0.06, 0.16, 'sine', 0.045); },
    miss: function () { note(247, 0, 0.14, 'sine', 0.06, 196); },
    success: function () { [523, 659, 784, 1047].forEach(function (f, i) { note(f, i * 0.085, 0.18, 'triangle', 0.06); }); note(1568, 0.36, 0.3, 'sine', 0.035); }
  };
  function play(name) {
    if (!enabled || muted() || !SOUNDS[name] || (QUIET && CLICKS[name])) return;
    var now = Date.now(); if (last[name] && now - last[name] < 60) return; last[name] = now;
    if (!audio()) return;
    try { SOUNDS[name](); } catch (e) {}
  }
  function paint(btn) { var m = muted(); btn.textContent = m ? '\ud83d\udd07' : '\ud83d\udd0a'; btn.setAttribute('aria-pressed', m ? 'false' : 'true'); btn.setAttribute('aria-label', m ? 'Sounds are off. Turn sounds on' : 'Sounds are on. Turn sounds off'); btn.title = m ? 'Sounds off' : 'Sounds on'; }
  function toggleButton() {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'kk-sound'; b.setAttribute('data-kjt-sound-toggle', '');
    b.addEventListener('click', function (e) { e.stopPropagation(); setMuted(!muted()); if (!muted()) { audio(); SOUNDS.good(); } });
    paint(b); return b;
  }
  window.KJTSound = { play: play, muted: muted, toggle: function () { setMuted(!muted()); }, button: toggleButton, enabled: enabled };
  if (!enabled || QUIET) return;

  /* ---------- automatic sounds on Kids Corner ---------- */
  function onPage(el) { return el && (el.closest('.kjt-trail, .kjt-kids, .kk-hub, .kk-focusbar, .kc-overlay, #categories, .kk-home') || document.body.classList.contains('kk-hub-on')); }
  document.addEventListener('pointerdown', function (e) {
    var t = e.target; if (!t || !t.closest || !onPage(t)) return;
    if (t.closest('[data-kjt-sound-toggle], [data-kk-nav]')) return; /* these play their own sound */
    if (t.closest('button, a, [role="tab"], [role="radio"], .kg-cell, .kg-tile, canvas, .kk-feel, .kt-stop, .kt-opt, .kc-swatch, summary, select')) play('tap');
  }, true);
  /* Feedback sounds, from what the activities show on screen. */
  new MutationObserver(function (list) {
    list.forEach(function (m) {
      if (m.type === 'attributes') {
        var el = m.target;
        if (el.classList && el.classList.contains('found') && el.closest('.kg-words')) play('good');
        if (el.classList && (el.classList.contains('right')) && el.closest('.kt-options, .kk-riddle, .kjt-trail')) play('good');
        if (el.classList && el.classList.contains('gentle')) play('miss');
        return;
      }
      m.addedNodes.forEach(function (n) {
        if (n.nodeType !== 1) return;
        if (n.matches('.kg-done, .kt-celebrate__stars') || (n.querySelector && n.querySelector('.kt-celebrate__stars'))) play('success');
        else if (n.matches('.kg-ring:not(.kg-ring--hint)')) play('good');
        else if (n.matches('.kg-miss')) play('miss');
      });
    });
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
})();
