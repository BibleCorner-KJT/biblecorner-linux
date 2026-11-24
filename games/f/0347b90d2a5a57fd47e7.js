/* KJT read-aloud voice \u2014 Site Core 5.1.0
   Used by the Adventure Trail, Memory Verse Garden and Prayer Garden.

   INDEPENDENCE: only voices stored on the device are used (localService),
   so the text is never sent to an online speech service.
   QUALITY: picks the most natural English voice on the device and skips
   robotic engines (eSpeak etc.). Reads sentence by sentence with pauses.
   Parents can choose a voice and speed in Parent Corner (saved on the device
   only, localStorage "kjt_voice").

   Buttons marked data-kjt-voice are hidden when no suitable voice exists;
   elements marked data-kjt-voice-none are shown instead. */
(function () {
  'use strict';
  var synth = window.speechSynthesis;
  var supported = !!(synth && window.SpeechSynthesisUtterance);
  var KEY = 'kjt_voice';
  var ROBOTIC = /espeak|mbrola|festival|pico|flite|speech-dispatcher/i;
  var NATURAL = /natural|neural|enhanced|premium|siri|wavenet/i;
  var GOOD = /samantha|daniel|karen|moira|serena|kate|oliver|arthur|martha|tessa|fiona|catherine|gordon|ava|allison|susan|evan|nicky/i;
  var OK = /zira|david|hazel|george|mark|libby|sonia|ryan|x-.*-local|english/i;
  var loaded = false, waiters = [], queue = [], speaking = false;

  function prefs() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function savePrefs(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }

  function score(v) {
    var n = v.name + ' ' + v.voiceURI, s = 0;
    if (ROBOTIC.test(n)) s -= 100;
    if (NATURAL.test(n)) s += 30;
    if (GOOD.test(n)) s += 20; else if (OK.test(n)) s += 5;
    if (/^en[-_]GB/i.test(v.lang)) s += 3;
    if (navigator.language && v.lang && v.lang.toLowerCase() === navigator.language.toLowerCase()) s += 2;
    if (v['default']) s += 1;
    return s;
  }

  /* English voices stored on this device, best first. */
  function list() {
    if (!supported) return [];
    return synth.getVoices()
      .filter(function (v) { return v.localService !== false && /^en/i.test(v.lang || ''); })
      .map(function (v) { return { voice: v, score: score(v), robotic: ROBOTIC.test(v.name + ' ' + v.voiceURI) }; })
      .sort(function (a, b) { return b.score - a.score; });
  }

  function chosen() {
    var p = prefs(), all = list();
    if (p.off) return null;
    if (p.name) for (var i = 0; i < all.length; i++) if (all[i].voice.name === p.name) return all[i].voice;
    return all.length && !all[0].robotic ? all[0].voice : null;
  }

  function available() { return supported && !!chosen(); }

  function apply(scope) {
    var ok = available();
    (scope || document).querySelectorAll('[data-kjt-voice]').forEach(function (el) { el.hidden = !ok; });
    (scope || document).querySelectorAll('[data-kjt-voice-none]').forEach(function (el) { el.hidden = ok; });
  }

  function ready(cb) { if (loaded) cb(); else waiters.push(cb); }
  function markLoaded() {
    if (loaded) return;
    loaded = true;
    apply(document);
    waiters.splice(0).forEach(function (cb) { cb(); });
  }
  if (supported) {
    if (synth.getVoices().length) markLoaded();
    synth.addEventListener && synth.addEventListener('voiceschanged', function () { loaded = false; markLoaded(); });
    setTimeout(markLoaded, 1500);
  } else markLoaded();

  function stop() { queue = []; speaking = false; if (supported) synth.cancel(); }

  /* Short sentences read more clearly and avoid browsers cutting off long text. */
  function chunks(text) {
    var parts = String(text).replace(/\s+/g, ' ').trim().match(/[^.!?;:]+[.!?;:]*["')]*\s*/g) || [];
    var out = [];
    parts.forEach(function (part) {
      part = part.trim();
      if (!part) return;
      if (part.length > 180) part.split(/,\s+/).forEach(function (p) { if (p) out.push(p); });
      else out.push(part);
    });
    return out;
  }

  function next() {
    if (!queue.length) { speaking = false; return; }
    var u = new SpeechSynthesisUtterance(queue.shift());
    var v = chosen();
    if (!v) { stop(); return; }
    u.voice = v; u.lang = v.lang;
    u.rate = prefs().rate === 'slow' ? 0.78 : 0.92;
    u.pitch = 1;
    u.onend = function () { if (speaking) setTimeout(next, 220); };
    u.onerror = function () { speaking = false; };
    synth.speak(u);
  }

  function speak(text) {
    if (!available()) return false;
    stop();
    queue = chunks(text);
    speaking = true;
    next();
    return true;
  }

  /* Parent Corner settings panel. */
  function settings(root) {
    ready(function () {
      root.innerHTML = '';
      var all = list(), p = prefs();
      var h = document.createElement('h3'); h.textContent = '\ud83d\udd0a Read-aloud voice on this device'; root.appendChild(h);
      var note = document.createElement('p');
      if (!supported || !all.length) {
        note.textContent = 'This device has no offline voice, so the read-aloud buttons are hidden. Phones and tablets usually have one built in; on a computer you can add a voice in the system\'s speech settings.';
        root.appendChild(note); return;
      }
      note.textContent = 'Read-aloud uses a voice stored on this device, so nothing is sent over the internet. Choose the voice your child understands best.';
      root.appendChild(note);

      var row = document.createElement('div'); row.className = 'kk-voice-row';
      var sel = document.createElement('select'); sel.setAttribute('aria-label', 'Voice');
      var off = document.createElement('option'); off.value = '__off'; off.textContent = 'Off (no read-aloud)'; sel.appendChild(off);
      var best = chosen();
      all.forEach(function (x, i) {
        var o = document.createElement('option');
        o.value = x.voice.name;
        o.textContent = x.voice.name + ' (' + x.voice.lang + ')' + (x.robotic ? ' \u00b7 robotic' : (i === 0 ? ' \u00b7 recommended' : ''));
        sel.appendChild(o);
      });
      sel.value = p.off ? '__off' : (best ? best.name : '__off');
      var speed = document.createElement('select'); speed.setAttribute('aria-label', 'Speed');
      [['normal', 'Normal speed'], ['slow', 'Slower']].forEach(function (s) { var o = document.createElement('option'); o.value = s[0]; o.textContent = s[1]; speed.appendChild(o); });
      speed.value = p.rate === 'slow' ? 'slow' : 'normal';
      var test = document.createElement('button'); test.type = 'button'; test.className = 'kt-btn'; test.textContent = '\u25b6 Test voice';
      function store() {
        var q = { rate: speed.value };
        if (sel.value === '__off') q.off = true; else q.name = sel.value;
        savePrefs(q); apply(document);
        test.disabled = sel.value === '__off';
      }
      sel.addEventListener('change', store); speed.addEventListener('change', store);
      test.addEventListener('click', function () { speak('In the beginning God created the heaven and the earth. Jesus loves you!'); });
      test.disabled = sel.value === '__off';
      row.appendChild(sel); row.appendChild(speed); row.appendChild(test);
      root.appendChild(row);
    });
  }

  window.KJTVoice = { supported: supported, available: available, speak: speak, stop: stop, apply: apply, ready: ready, list: list, settings: settings };
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-kjt-voice-settings]').forEach(settings);
    apply(document);
  });
})();
