/* KJT Kids Corner - Pilgrim Keys (Site Core 5.7.0)
   Save all Kids Corner progress under a Pilgrim Key (three Bible words and a
   number, or four pictures and a number) and bring it back on any device.
   No names or personal information. Progress saves automatically while the
   child plays; entering a key on a device combines both, keeping the best of
   each. The printable Pilgrim Card comes in a boy and a girl design. */
(function () {
  'use strict';
  var C = window.KJT_PILGRIM; if (!C) return;
  var LOCAL = 'kjt_pilgrim';
  var SYNC = ['kjt_achieve_v1', 'kjt_trail_v1', 'kjt_stories_v1', 'kjt_games_trophies', 'kjt_games_best', 'kjt_games_daily', 'kjt_kids_last', 'kjt_games_pauljourney', 'kjtb_bible_study', 'kjt_kids_reading', 'kjt_kids_bookmarks', 'kjt_adventures_v1'];
  /* 5.8.0: written by the server from the Holy Bible page (the newest wins) */
  var SERVER = ['kjtb_bible_study'];
  var LOW_GAMES = ['twobytwo', 'crossword', 'timeline', 'books', 'memory'];
  var PIC = {}; C.pictures.forEach(function (p) { PIC[p[0]] = p[1]; });

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { var v = attrs[k]; if (v == null || v === false) return; if (k === 'text') n.textContent = v; else if (k === 'html') n.innerHTML = v; else if (k === 'class') n.className = v; else if (k === 'style') n.style.cssText = v; else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v); });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function getJ(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function setJ(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function me() { return getJ(LOCAL) || null; }
  function sound(n) { if (window.KJTSound) window.KJTSound.play(n); }

  /* ---------- keys ---------- */
  function display(norm) {
    if (!norm) return '';
    if (norm.indexOf('P:') === 0) { var m = norm.split(':'); return m[1].split(',').map(function (p) { return PIC[p] || '?'; }).join(' ') + '  ' + m[2]; }
    return norm.slice(2).split('-').join('\u00a0\u00b7 ');
  }
  /* 7.8.4: a key as text, for the browser's saved passwords: "LAMB STAR CEDAR 47", or a
     picture key by its picture names, "SHEEP DOVE STAR FISH 482" */
  function keyText(norm) {
    if (!norm) return '';
    if (norm.indexOf('P:') === 0) { var m = norm.split(':'); return m[1].split(',').join(' ').toUpperCase() + ' ' + m[2]; }
    return norm.slice(2).split('-').join(' ');
  }
  function parseWords(text) {
    var parts = String(text || '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
    /* a picture key typed by its picture names (as a browser saves it) */
    if (parts.length === 5 && /^\d{3}$/.test(parts[4]) && parts.slice(0, 4).every(function (p) { return PIC[p.toLowerCase()]; })) return { key: 'P:' + parts.slice(0, 4).map(function (p) { return p.toLowerCase(); }).join(',') + ':' + parts[4] };
    if (parts.length !== 4 || !/^\d{2}$/.test(parts[3])) return { error: 'A word key has three words and a two-digit number, like LAMB STAR CEDAR 47.' };
    for (var i = 0; i < 3; i++) if (C.words.indexOf(parts[i]) < 0) return { error: '\u201c' + parts[i] + '\u201d isn\u2019t one of the key words. Check the spelling on your card.' };
    return { key: 'W:' + parts.slice(0, 3).join('-') + '-' + parts[3] };
  }

  /* ---------- progress: collect and merge ---------- */
  function collect() { var s = {}; SYNC.forEach(function (k) { var v = localStorage.getItem(k); if (v != null) s[k] = v; }); return { v: 1, s: s }; }
  function parse(v) { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch (e) { return null; } }
  function mergeOne(k, a, b) {
    if (a == null) return b; if (b == null) return a;
    var o;
    switch (k) {
      case 'kjt_trail_v1': o = JSON.parse(JSON.stringify(a)); Object.keys(b).forEach(function (s) { o[s] = o[s] || {}; Object.keys(b[s] || {}).forEach(function (p) { if (b[s][p]) o[s][p] = b[s][p]; }); }); return o;
      case 'kjt_stories_v1': o = JSON.parse(JSON.stringify(a)); Object.keys(b).forEach(function (id) { if (!o[id]) { o[id] = b[id]; return; } var e = o[id].endings || []; (b[id].endings || []).forEach(function (x) { if (e.indexOf(x) < 0) e.push(x); }); o[id].endings = e; if ((!o[id].scene || o[id].scene === 'start') && b[id].scene) { o[id].scene = b[id].scene; o[id].path = b[id].path || []; } }); return o;
      case 'kjt_games_trophies': o = Object.assign({}, a); Object.keys(b).forEach(function (g) { o[g] = Math.max(o[g] || 0, b[g] || 0); }); return o;
      case 'kjt_games_best': o = Object.assign({}, a); Object.keys(b).forEach(function (g) { var low = LOW_GAMES.indexOf(g.split(':')[0]) >= 0; if (o[g] == null) o[g] = b[g]; else if (b[g] != null) o[g] = low ? Math.min(o[g], b[g]) : Math.max(o[g], b[g]); }); return o;
      case 'kjt_games_daily': return Object.assign({}, a, b);
      case 'kjt_kids_last': return (b.t || 0) > (a.t || 0) ? b : a;
      case 'kjtb_bible_study': return (b.at || 0) >= (a.at || 0) ? b : a;
      /* 5.9.0: My Little Bible: every chapter read on either device, the busier day count, the newest place */
      /* 5.9.1: bookmarks: the newest change to each one wins (removals included) */
      case 'kjt_kids_bookmarks':
        var ob = { v: 1, items: {} };
        [a, b].forEach(function (x) { Object.keys(x.items || {}).forEach(function (k) { var it = x.items[k], cur = ob.items[k]; if (!cur || (it.ed || 0) > (cur.ed || 0)) ob.items[k] = it; }); });
        ob.at = Math.max(a.at || 0, b.at || 0); return ob;
      case 'kjt_kids_reading':
        var o = { v: 1, read: {}, days: {}, last: null, tr: null }, newer = (b.at || 0) >= (a.at || 0) ? b : a;
        [a, b].forEach(function (x) { Object.keys(x.read || {}).forEach(function (k) { o.read[k] = o.read[k] ? Math.min(o.read[k], x.read[k]) : x.read[k]; }); Object.keys(x.days || {}).forEach(function (k) { o.days[k] = Math.max(o.days[k] || 0, x.days[k]); }); });
        o.last = newer.last || a.last || b.last; o.tr = newer.tr || a.tr || b.tr; o.at = Math.max(a.at || 0, b.at || 0); o.sum = newer.sum;
        return o;
      /* 7.9.0: Bible Adventures: every chapter, virtue and verse from either device */
      case 'kjt_adventures_v1':
        o = JSON.parse(JSON.stringify(a)); Object.keys(b).forEach(function (id) { var x = o[id] = o[id] || {}, y = b[id] || {}; ['done', 'virtues', 'verses'].forEach(function (f) { var l = x[f] || []; (y[f] || []).forEach(function (v) { if (l.indexOf(v) < 0) l.push(v); }); x[f] = l; }); x.at = Math.max(x.at || 0, y.at || 0); }); return o;
      case 'kjt_achieve_v1':
        o = { counts: {}, sets: {}, days: {}, earned: {}, snap: a.snap || b.snap };
        /* 7.9.26: the stars already shown are the most either side has seen (no "New star!" again for old stars) */
        if (a.snap && b.snap) { o.snap = { stars: {}, level: ((b.snap.stars && Object.keys(b.snap.stars).reduce(function (t, k) { return t + (b.snap.stars[k] || 0); }, 0)) || 0) > ((a.snap.stars && Object.keys(a.snap.stars).reduce(function (t, k) { return t + (a.snap.stars[k] || 0); }, 0)) || 0) ? b.snap.level : a.snap.level }; [a.snap, b.snap].forEach(function (x) { Object.keys(x.stars || {}).forEach(function (k) { o.snap.stars[k] = Math.max(o.snap.stars[k] || 0, x.stars[k] || 0); }); }); }
        [a, b].forEach(function (x) {
          Object.keys(x.counts || {}).forEach(function (c) { o.counts[c] = Math.max(o.counts[c] || 0, x.counts[c]); });
          Object.keys(x.sets || {}).forEach(function (t) { o.sets[t] = o.sets[t] || {}; Object.keys(x.sets[t]).forEach(function (kk) { o.sets[t][kk] = Math.max(o.sets[t][kk] || 0, x.sets[t][kk]); }); });
          Object.keys(x.days || {}).forEach(function (t) { o.days[t] = Object.assign(o.days[t] || {}, x.days[t]); });
          Object.keys(x.earned || {}).forEach(function (e) { o.earned[e] = o.earned[e] && o.earned[e] < x.earned[e] ? o.earned[e] : x.earned[e]; });
        });
        return o;
      default: return a;
    }
  }
  function mergeInto(remote) {
    var r = (remote && remote.s) || {};
    SYNC.forEach(function (k) {
      var a = parse(localStorage.getItem(k)), b = parse(r[k]), m = mergeOne(k, a, b);
      if (m != null) localStorage.setItem(k, JSON.stringify(m));
    });
    try { window.dispatchEvent(new CustomEvent('kjt-kids-reading-updated')); } catch (e) {}
  }

  /* ---------- talking to the site ---------- */
  function api(path, body, keepalive) {
    return fetch(C.rest + path, { method: 'POST', credentials: 'same-origin', keepalive: !!keepalive, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { j.status = r.status; return j; }, function () { return { ok: false, status: r.status }; }); })
      .catch(function () { return { ok: false, error: 'offline' }; });
  }
  /* 5.9.0: sign out: save to the key, then clear this device for the next child */
  function signOut() {
    var m = me(), finish = function () {
      SYNC.concat([LOCAL]).forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
      location.reload();
    };
    if (!m || !m.key) return finish();
    api('save', { key: m.key, data: JSON.stringify(collect()) }).then(finish, finish);
  }
  var lastSent = null, saving = false;
  function saveNow(keepalive) {
    var m = me(); if (!m || !m.key || saving) return;
    var data = collect(), str = JSON.stringify(data.s);
    if (str === lastSent) return;
    saving = true;
    api('save', { key: m.key, data: JSON.stringify(data) }, keepalive).then(function (j) {
      saving = false;
      if (j.ok) { lastSent = str; m.saved = Date.now(); setJ(LOCAL, m); takeServer(j.server); drawPanel(); }
      else if (j.error === 'unknown') { localStorage.removeItem(LOCAL); drawPanel(); }
    });
  }
  /* 5.8.0: what the server keeps for this key (the Holy Bible page's study summary) */
  function takeServer(srv) {
    if (!srv) return; var changed = false;
    SERVER.forEach(function (k) { if (srv[k] != null && localStorage.getItem(k) !== srv[k]) { localStorage.setItem(k, srv[k]); changed = true; } });
    if (changed && window.KJTAchieve && window.KJTAchieve.refresh) window.KJTAchieve.refresh();
  }
  setInterval(function () { if (!document.hidden) saveNow(false); }, 10000);
  document.addEventListener('visibilitychange', function () { if (document.hidden) saveNow(true); });
  window.addEventListener('kjt-achieve', function () { setTimeout(function () { saveNow(false); }, 2500); });

  /* ---------- the Pilgrim Key panel ---------- */
  var panel = null;
  function host() { return document.querySelector('.kk-hub') || document.getElementById('categories'); }
  function drawPanel() {
    var h = host(); if (!h) return;
    if (!panel) {
      panel = el('section', { class: 'kp-panel', id: 'my-pilgrim-card', 'aria-label': 'My Pilgrim Key' });
      var mine = h.querySelector('.kk-me__key'), after = h.querySelector('.ka-panel') || h.querySelector('.kk-continue-slot');
      if (mine) mine.appendChild(panel); /* 7.3.0: first in My Pilgrim Corner */
      else if (after) after.parentNode.insertBefore(panel, after.nextSibling); else h.insertBefore(panel, h.firstChild);
    }
    panel.innerHTML = '';
    var m = me();
    var corner = panel.closest && panel.closest('.kk-me'); if (corner) { corner.classList.toggle('kk-me--in', !!m); corner.classList.toggle('kk-me--out', !m); }
    if (!m) {
      panel.className = 'kp-panel kp-panel--out';
      panel.appendChild(el('div', { class: 'kp-row' }, [
        el('span', { class: 'kp-icon', text: '\ud83d\udd11', 'aria-hidden': 'true' }),
        el('div', { class: 'kp-text' }, [el('strong', { text: 'Keep your stars safe with a Pilgrim Key' }), el('span', { text: 'Save your progress and bring it back on any device. No name or email needed.' })]),
        el('div', { class: 'kp-actions' }, [
          el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83d\udd11 My Corner (Sign in)', onclick: enterDialog }),
          el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '\ud83d\udcbe Save my progress (Sign up)', onclick: createDialog })
        ])
      ]));
    } else {
      var ago = m.saved ? Math.max(0, Math.round((Date.now() - m.saved) / 60000)) : null;
      /* 7.9.1: a big, clear welcome when the child is signed in */
      panel.className = 'kp-panel kp-panel--in';
      panel.appendChild(el('div', { class: 'kp-hello' }, [
        el('span', { class: 'kp-hello__avatar', 'aria-hidden': 'true', text: myName() ? myName().charAt(0).toUpperCase() : '\u2b50' }),
        el('div', { class: 'kp-hello__text' }, [
          el('p', { class: 'kp-hello__line' }, myName() ? [el('span', { class: 'kp-hello__hi', text: 'Hello,' }), ' ', el('span', { class: 'kp-hello__name', 'data-kjt-notr': '', text: myName() }), el('span', { class: 'kp-hello__hi', text: '!' })] : [el('span', { class: 'kp-hello__hi', text: 'Welcome back' })]),
          el('p', { class: 'kp-hello__saved' }, [el('span', { 'aria-hidden': 'true', text: '\u2705 ' }), el('span', { text: 'Your progress is saved to your Pilgrim Key' })]),
          el('p', { class: 'kp-hello__ago' }, [el('span', { text: ago === null ? 'Saving\u2026' : 'Last saved ' + (ago < 1 ? 'just now' : ago + ' minute' + (ago === 1 ? '' : 's') + ' ago') + '. It saves by itself while you play.' })])
        ])
      ]));
      panel.appendChild(el('div', { class: 'kp-row kp-row--in' }, [
        el('div', { class: 'kp-actions' }, [
          el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83d\udc41\ufe0f Show my key', onclick: function () { showKeyDialog(m.key, false); } }),
          el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '\ud83d\udda8\ufe0f Print my Pilgrim Card', onclick: function () { cardDialog(m.key); } }),
          el('button', { class: 'kt-btn kt-btn--ghost kp-signout', type: 'button', text: '\ud83d\udeaa Sign out', onclick: function () { if (window.confirm('Sign out? Your stars and reading are saved with your Pilgrim Key.')) signOut(); } })
        ])
      ]));
      panel.appendChild(el('p', { class: 'kp-small' }, [
        el('button', { class: 'kp-link', type: 'button', text: myName() ? 'Change my name' : 'Add my name', onclick: nameDialog }), ' \u00b7 ',
        el('button', { class: 'kp-link', type: 'button', text: 'Use a different key', onclick: enterDialog }), ' \u00b7 ',
        el('button', { class: 'kp-link', type: 'button', text: 'Forget my key', onclick: forget }), ' \u00b7 ',
        el('button', { class: 'kp-link', type: 'button', text: 'For parents', onclick: parentsDialog })
      ]));
    }
      /* 6.8.2 (7.3.0: also before signing in): growing up? A clear way to take the reading to the grown-up Holy Bible page (it opens the
         "Bring in Kids Corner reading" panel there; the Pilgrim Key is entered once, on that page). */
      if (C.grownUp) panel.appendChild(el('div', { class: 'kp-grow' }, [
        el('span', { class: 'kp-grow__icon', text: '\ud83c\udf31', 'aria-hidden': 'true' }),
        el('span', { class: 'kp-grow__text' }, [el('strong', { text: 'Growing up?' }), el('span', { text: 'Bring every chapter you read, and your bookmarks and notes, into your own Bible study in Bible Corner.' })]),
        el('a', { class: 'kt-btn kt-btn--yellow kp-grow__go', href: C.grownUp, text: '\ud83d\udcd6 Take my reading to Bible Corner' })
      ]));
  }

  /* ---------- 7.8.4: a name, and remembering the card in the browser ----------
     The name (a first name or nickname) is kept only on this device and in the browser's own
     saved passwords. It is never sent to the website: the site still keeps only the progress,
     filed under a scrambled form of the key. */
  function cleanName(v) {
    v = String(v || '').replace(/\s+/g, ' ').trim().slice(0, 20);
    if (/@|https?:|www\.|\d{3,}/i.test(v)) return { error: 'Please use just a first name or a nickname (no email, phone number or address).' };
    /* 7.8.5: no bad language (kjt-name-filter.php / assets/name-filter.js) */
    if (window.KJTNameFilter && !window.KJTNameFilter.ok(v)) return { error: window.KJTNameFilter.message };
    return { name: v };
  }
  function myName() { var m = me(); return m && m.name ? m.name : ''; }
  function setName(n) { var m = me(); if (!m) return; if (n) m.name = n; else delete m.name; setJ(LOCAL, m); }
  /* 7.8.7: finish a sign-in the way browsers recognise it: the form is really sent
     (back to this same page), so Chrome, Edge, Firefox and Safari all offer to save
     the card. Its boxes have their names taken away first, so nothing in them is sent:
     the name stays on this device, and the key only went to the site as before. */
  function finishSignIn(form) {
    try {
      Array.prototype.forEach.call(form.querySelectorAll('input'), function (i) { i.removeAttribute('name'); i.removeAttribute('readonly'); });
      form.setAttribute('method', 'get');
      form.setAttribute('action', location.pathname + '#my-pilgrim-card');
      form.setAttribute('data-kp-go', '1');
      /* (not while the form is still being sent: browsers ignore a second send then) */
      setTimeout(function () { try { if (form.requestSubmit) form.requestSubmit(); else form.submit(); } catch (e) { location.reload(); } }, 30);
    } catch (e) { location.reload(); }
  }
  function letThrough(form, e) { if (form.getAttribute('data-kp-go') === '1') return true; e.preventDefault(); return false; }
  function eyeFor(input) {
    return el('button', { class: 'kp-eye', type: 'button', 'aria-label': 'Show or hide the key', text: '\ud83d\udc41\ufe0f', onclick: function () { input.type = input.type === 'password' ? 'text' : 'password'; } });
  }
  function nameField(value) {
    return el('input', { class: 'kp-input kp-name', type: 'text', name: 'username', autocomplete: 'username', maxlength: '20', spellcheck: 'false', placeholder: 'First name or nickname (optional)', 'aria-label': 'Name for this Pilgrim Card (optional)', value: value || '' });
  }
  function rememberForm(key, done) {
    var name = nameField(myName()), msg = el('p', { class: 'kp-msg', 'aria-live': 'polite' });
    var pass = el('input', { class: 'kp-input kp-pass', type: 'password', name: 'password', autocomplete: 'new-password', 'aria-label': 'Your Pilgrim Key', value: keyText(key) });
    pass.addEventListener('input', function () { pass.value = keyText(key); }); /* the card's key, as it is */
    var form = el('form', { class: 'kp-remember', method: 'post', action: '#', autocomplete: 'on' }, [
      el('p', { class: 'kp-remember__h', text: '\ud83d\udd10 Remember my card on this device' }),
      el('p', { class: 'kp-small', text: 'Your browser can keep your Pilgrim Card safe, so you don\u2019t need to type it next time. Only do this on your family\u2019s own phone, tablet or computer. Your name stays on this device: it is never sent to the website.' }),
      name, el('div', { class: 'kp-passrow' }, [pass, eyeFor(pass)]),
      el('div', { class: 'kt-row' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'submit', text: '\ud83d\udcbe Remember my card' })]), msg]);
    form.addEventListener('submit', function (e) {
      if (letThrough(form, e)) return;
      var n = cleanName(name.value); if (n.error) { msg.textContent = n.error; return; }
      setName(n.name); msg.textContent = '\u2705 ' + (n.name ? 'Thank you, ' + n.name + '! ' : '') + 'If your browser asks, choose \u201cSave\u201d.';
      if (done) done();
      finishSignIn(form);
    });
    return form;
  }
  function nameDialog() {
    var input = nameField(myName()), msg = el('p', { class: 'kp-msg', 'aria-live': 'polite' }), close;
    var form = el('form', { class: 'kp-remember' }, [
      el('p', { text: 'A first name or nickname to say hello to you. It stays on this device only and is never sent to the website.' }),
      input, el('div', { class: 'kt-row' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'submit', text: '\u2705 Save my name' }),
        myName() ? el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: 'Remove my name', onclick: function () { setName(''); close(); drawPanel(); } }) : null]), msg]);
    form.addEventListener('submit', function (e) { e.preventDefault(); var n = cleanName(input.value); if (n.error) { msg.textContent = n.error; return; } setName(n.name); close(); drawPanel(); });
    close = dialog('\ud83d\ude4b My name', form);
  }

  /* ---------- dialogs ---------- */
  function dialog(title, body) {
    var close = function () { o.remove(); document.removeEventListener('keydown', esc); };
    var esc = function (e) { if (e.key === 'Escape') close(); };
    var o = el('div', { class: 'kp-overlay', onclick: function (e) { if (e.target === o) close(); } }, [
      el('div', { class: 'kp-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, [
        el('div', { class: 'kp-dhead' }, [el('h3', { text: title }), el('button', { class: 'kp-x', type: 'button', 'aria-label': 'Close', text: '\u2715', onclick: function () { close(); } })]),
        body
      ])
    ]);
    document.body.appendChild(o); document.addEventListener('keydown', esc);
    var f = o.querySelector('input,button.kt-btn'); if (f) setTimeout(function () { f.focus(); }, 50);
    return close;
  }
  function createDialog() {
    var msg = el('p', { class: 'kp-msg' }), close;
    function make(type) {
      msg.textContent = 'Making your key\u2026';
      api('new', { type: type, data: JSON.stringify(collect()) }).then(function (j) {
        if (!j.ok) { msg.textContent = j.error === 'busy' ? 'Too many keys made from here in the last hour. Please try again later.' : 'The key couldn\u2019t be made right now. Please try again.'; return; }
        setJ(LOCAL, { key: j.key, saved: Date.now() }); lastSent = JSON.stringify(collect().s);
        close(); sound('success'); drawPanel(); showKeyDialog(j.key, true);
      });
    }
    close = dialog('\ud83d\udcbe Save my progress (Sign up)', el('div', {}, [
      el('p', { text: 'Choose your kind of Pilgrim Key. You\u2019ll use it to bring your stars and badges back on any phone, tablet or computer.' }),
      el('div', { class: 'kp-choose' }, [
        el('button', { class: 'kp-choice', type: 'button', onclick: function () { make('words'); } }, [el('span', { class: 'kp-choice__big', text: 'LAMB \u00b7 STAR \u00b7 47' }), el('strong', { text: '\ud83d\udcdd Word key' }), el('small', { text: 'Three Bible words and a number' })]),
        el('button', { class: 'kp-choice', type: 'button', onclick: function () { make('pictures'); } }, [el('span', { class: 'kp-choice__big', text: '\ud83d\udc11 \u2b50 \ud83c\udf33 \ud83d\udd4a\ufe0f  482' }), el('strong', { text: '\ud83d\uddbc\ufe0f Picture key' }), el('small', { text: 'Four pictures and a number, great for little ones' })])
      ]), msg
    ]));
  }
  function showKeyDialog(key, fresh) {
    var close = dialog(fresh ? '\ud83c\udf89 Here is your Pilgrim Key!' : '\ud83d\udd11 Your Pilgrim Key', el('div', {}, [
      fresh ? el('p', { text: 'Write it down or print your Pilgrim Card, and keep it somewhere safe. Anyone with this key can open your progress, so only share it with your family.' }) : null,
      el('div', { class: 'kp-keybox' + (key.indexOf('P:') === 0 ? ' pics' : ''), text: display(key) }),
      el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '\ud83d\udda8\ufe0f Print my Pilgrim Card', onclick: function () { close(); cardDialog(key); } })]),
      rememberForm(key)
    ]));
  }
  function enterDialog() {
    var mode = 'words', area = el('div'), msg = el('p', { class: 'kp-msg', 'aria-live': 'polite' }), close;
    var tabs = el('div', { class: 'kg-levels', role: 'tablist' });
    function drawTabs() { tabs.innerHTML = ''; [['words', '\ud83d\udcdd Word key'], ['pictures', '\ud83d\uddbc\ufe0f Picture key']].forEach(function (t) { tabs.appendChild(el('button', { class: 'kg-level', type: 'button', 'aria-pressed': mode === t[0] ? 'true' : 'false', text: t[1], onclick: function () { mode = t[0]; drawTabs(); draw(); } })); }); }
    var picks = [], digits = '';
    function draw() {
      area.innerHTML = ''; msg.textContent = '';
      if (mode === 'words') {
        /* 7.8.4: a real sign-in form, so the browser can fill in (and offer to save) the card.
           It is never sent anywhere: the key goes to the site the same way as before. */
        var who = nameField(''), inp = el('input', { class: 'kp-input kp-pass', type: 'password', name: 'password', autocomplete: 'current-password', autocapitalize: 'characters', spellcheck: 'false', placeholder: 'LAMB STAR CEDAR 47', 'aria-label': 'Your word key' });
        var form = el('form', { class: 'kp-signin', method: 'post', action: '#', autocomplete: 'on' }, [
          el('p', { text: 'Type the three words and the number from your Pilgrim Card (or tap it if your browser offers it):' }),
          who, el('div', { class: 'kp-passrow' }, [inp, eyeFor(inp)]),
          el('div', { class: 'kt-row' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'submit', text: '\ud83d\udd13 Open my progress' })])]);
        form.addEventListener('submit', function (e) { if (letThrough(form, e)) return; var n = cleanName(who.value); if (n.error) { msg.textContent = n.error; return; } go(inp.value, n.name, form, inp); });
        area.appendChild(form);
      } else {
        var slots = el('div', { class: 'kp-slots' }), pad = el('div', { class: 'kp-pad' }), num = el('input', { class: 'kp-input kp-num', type: 'text', inputmode: 'numeric', maxlength: '3', placeholder: '000', 'aria-label': 'Your 3-digit number', value: digits });
        function drawSlots() { slots.innerHTML = ''; for (var i = 0; i < 4; i++) slots.appendChild(el('span', { class: 'kp-slot' + (picks[i] ? ' on' : ''), text: picks[i] ? PIC[picks[i]] : String(i + 1) })); }
        C.pictures.forEach(function (p) { pad.appendChild(el('button', { class: 'kp-pic', type: 'button', 'aria-label': p[0], text: p[1], onclick: function () { if (picks.length < 4) { picks.push(p[0]); sound('step'); drawSlots(); } } })); });
        num.addEventListener('input', function () { num.value = num.value.replace(/\D/g, '').slice(0, 3); digits = num.value; });
        drawSlots();
        area.appendChild(el('p', { text: 'Tap your four pictures in order, then type your number:' }));
        area.appendChild(el('div', { class: 'kp-slotrow' }, [slots, el('button', { class: 'kp-link', type: 'button', text: '\u232b Undo', onclick: function () { picks.pop(); drawSlots(); } })]));
        /* 7.8.7: a sign-in form too, with a box the browser fills in with a saved card */
        var whoP = nameField(''), saved = el('input', { class: 'kp-input kp-pass kp-pass--saved', type: 'password', name: 'password', autocomplete: 'current-password', spellcheck: 'false', placeholder: '\ud83d\udd10 Saved card (your browser fills it in)', 'aria-label': 'Saved Pilgrim Card, filled in by your browser' });
        var pform = el('form', { class: 'kp-signin', method: 'post', action: '#', autocomplete: 'on' }, [pad, num, whoP, saved,
          el('div', { class: 'kt-row' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'submit', text: '\ud83d\udd13 Open my progress' })])]);
        pform.addEventListener('submit', function (e) {
          if (letThrough(pform, e)) return;
          var np = cleanName(whoP.value); if (np.error) { msg.textContent = np.error; return; }
          if (saved.value.trim()) { var k = parseWords(saved.value); if (k.error) { msg.textContent = k.error; return; } go(k.key, np.name, pform, saved, true); return; }
          if (picks.length !== 4) { msg.textContent = 'Please choose four pictures.'; return; }
          if (!/^\d{3}$/.test(num.value)) { msg.textContent = 'Please type your 3-digit number.'; return; }
          go('P:' + picks.join(',') + ':' + num.value, np.name, pform, saved);
        });
        area.appendChild(pform);
      }
    }
    function go(text, name, form, passBox, parsed) {
      var key = mode === 'words' && !parsed ? parseWords(text) : { key: text };
      if (key.error) { msg.textContent = key.error; return; }
      var cur = me();
      if (cur && cur.key !== key.key && !window.confirm('Switch to this key? The progress on this device will be combined into it.')) return;
      msg.textContent = 'Opening\u2026';
      api('load', { key: key.key }).then(function (j) {
        if (!j.ok) { msg.textContent = j.error === 'unknown' ? 'We couldn\u2019t find that key. Check it on your Pilgrim Card and try again.' : j.error === 'busy' ? 'Too many tries from here. Please wait a while and try again.' : 'Something went wrong. Please try again.'; sound('miss'); return; }
        mergeInto(j.data);
        var keep = { key: j.key, saved: Date.now() }, prevName = cur && cur.key === j.key ? cur.name : '';
        if (name || prevName) keep.name = name || prevName;
        setJ(LOCAL, keep);
        api('save', { key: j.key, data: JSON.stringify(collect()) }).then(function () {
          sound('success'); msg.textContent = '\u2705 Welcome back' + (keep.name ? ', ' + keep.name : '') + '! Your progress is here. If your browser asks, choose \u201cSave\u201d.';
          /* the card as the browser saves it (a picture key by its picture names) */
          if (passBox) passBox.value = keyText(j.key);
          setTimeout(function () { if (form) finishSignIn(form); else location.reload(); }, 900);
        });
      });
    }
    drawTabs(); draw();
    close = dialog('\ud83d\udd11 I have a Pilgrim Key', el('div', {}, [tabs, area, msg]));
  }
  function forget() {
    var m = me(); if (!m) return;
    if (!window.confirm('Forget your Pilgrim Key? Your saved progress will be deleted from the website. (The stars on this device stay.)')) return;
    api('forget', { key: m.key }).then(function () { localStorage.removeItem(LOCAL); drawPanel(); });
  }
  function parentsDialog() {
    dialog('\u2139\ufe0f Pilgrim Keys: for parents', el('div', { class: 'kp-parents' }, [
      el('p', { text: 'A Pilgrim Key lets your child keep their Kids Corner progress on any device, without an account.' }),
      el('p', { text: 'What is stored: only progress (stars, badges, trail stops, story endings, game scores and trophies). It is filed under a scrambled version of the key, so even the website owner cannot tell whose it is.' }),
      el('p', { text: 'What is never stored: names, email addresses, ages, photos, locations or the key itself.' }),
      el('p', { text: 'Anyone who knows the key can see that progress, so keep the card at home. \u201cForget my key\u201d deletes the saved progress at any time.' }),
      el('p', { text: 'A key that is not used for more than a year is deleted, with its progress.' }),
      el('p', { text: 'When your child grows up, \u201cTake my reading to Bible Corner\u201d brings their Kids Corner reading, bookmarks and notes into their own Bible study (they sign in there with a study key or email, then enter the Pilgrim Key once).' })
    ]));
  }

  /* ---------- the Pilgrim Card (boy and girl designs) ---------- */
  var artN = 0;
  function art(kind) {
    var boy = kind === 'boy', gid = 'kpSky' + (++artN); /* unique per card, so a hidden preview never hides the printed sky */
    var sky = boy ? '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16326e"/><stop offset="1" stop-color="#2f7fc1"/></linearGradient></defs>'
      : '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7b2cf"/><stop offset="1" stop-color="#fde7f0"/></linearGradient></defs>';
    var s = '<svg viewBox="0 0 200 250" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + sky + '<rect width="200" height="250" fill="url(#' + gid + ')"/>';
    if (boy) {
      var r = 11; for (var i = 0; i < 22; i++) { r = (r * 9301 + 49297) % 233280; var x = r / 233280 * 200; r = (r * 9301 + 49297) % 233280; var y = r / 233280 * 120; s += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (i % 3 ? 1 : 1.6) + '" fill="#fff" opacity=".85"/>'; }
      s += '<g transform="translate(150 45)"><circle r="16" fill="#fff6c9" opacity=".35"/><path d="M0-11L3-3 11 0 3 3 0 11-3 3-11 0-3-3Z" fill="#fff6c9"/></g>';
      s += '<path d="M0 170Q60 140 120 160T200 150V250H0Z" fill="#2c6b4f"/><path d="M0 200Q90 175 200 195V250H0Z" fill="#23573f"/>';
      s += '<g transform="translate(80 212)"><path d="M-17 0Q-16-50 0-53Q16-50 17 0Z" fill="#8d6e63"/><path d="M-18-26h36v6h-36z" fill="#F3C548"/><circle cy="-62" r="11" fill="#e8c4a0"/><path d="M-12-64q12-16 24 0l-2 6q-10-8-20 0z" fill="#5d4037"/><path d="M22 0V-78q0-9 8-9t8 9" fill="none" stroke="#5d4037" stroke-width="4" stroke-linecap="round"/></g>';
      s += '<g transform="translate(145 222)"><ellipse cy="-12" rx="17" ry="11" fill="#f5f2ea"/><circle cx="-9" cy="-18" r="7" fill="#f5f2ea"/><circle cx="7" cy="-19" r="8" fill="#f5f2ea"/><circle cx="17" cy="-14" r="6" fill="#3a3a3a"/><path d="M-9-3v5M7-3v5" stroke="#3a3a3a" stroke-width="2.5"/></g>';
    } else {
      s += '<g transform="translate(150 50)"><circle r="18" fill="#fff" opacity=".6"/><circle r="12" fill="#ffe082"/></g>';
      s += '<g transform="translate(60 60)" fill="#fff"><path d="M0 0q14-12 30-4-10 2-14 10 12 0 18 8-16 4-26-2Q2 6 0 0z"/><circle cx="-2" cy="1" r="4"/></g>';
      s += '<path d="M0 175Q70 150 130 168T200 160V250H0Z" fill="#a5d6a7"/><path d="M0 205Q100 185 200 205V250H0Z" fill="#81c784"/>';
      [[20, 200, '#f06292'], [45, 214, '#ba68c8'], [160, 205, '#f06292'], [182, 220, '#ffb74d'], [130, 226, '#ba68c8']].forEach(function (f) { s += '<g transform="translate(' + f[0] + ' ' + f[1] + ')"><path d="M0 0v14" stroke="#4caf50" stroke-width="2"/>' + [0, 72, 144, 216, 288].map(function (a) { return '<ellipse cx="0" cy="-5" rx="3" ry="5" fill="' + f[2] + '" transform="rotate(' + a + ')"/>'; }).join('') + '<circle r="2.5" fill="#fff59d"/></g>'; });
      s += '<g transform="translate(92 216)"><path d="M-18 0Q-17-48 0-52Q17-48 18 0Z" fill="#9575cd"/><path d="M-18-24h36v5h-36z" fill="#F3C548"/><circle cy="-61" r="11" fill="#e8c4a0"/><path d="M-14-58q-2-22 14-22t14 22q-4-14-14-14t-14 14z" fill="#6d4c41"/><path d="M-13-60q-3 22-1 36M13-60q3 22 1 36" stroke="#6d4c41" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M-26-30q4-6 10-2" stroke="#e8c4a0" stroke-width="4" fill="none" stroke-linecap="round"/><g transform="translate(-30 -34)"><path d="M0 0v10" stroke="#4caf50" stroke-width="2"/><circle r="4" fill="#f06292"/></g></g>';
    }
    return s + '</svg>';
  }
  function card(key, kind) {
    var S = window.KJTAchieve && window.KJTAchieve.summary ? window.KJTAchieve.summary() : null;
    var pics = key.indexOf('P:') === 0;
    return el('div', { class: 'kp-card kp-card--' + kind }, [
      el('div', { class: 'kp-card__art', html: art(kind) }),
      el('div', { class: 'kp-card__body' }, [
        el('img', { class: 'kp-card__logo', src: C.logo, alt: 'Knowing Jesus Today' }),
        el('p', { class: 'kp-card__kicker', text: 'Knowing Jesus Today \u00b7 Kids Corner' }),
        el('h4', { class: 'kp-card__title', text: 'Pilgrim Card' }),
        el('p', { class: 'kp-card__owner', html: 'This card belongs to <span></span>' }),
        el('p', { class: 'kp-card__label', text: 'My Pilgrim Key' }),
        el('p', { class: 'kp-card__key' + (pics ? ' pics' : ''), text: display(key) }),
        S ? el('p', { class: 'kp-card__level', text: S.level[1] + ' ' + S.level[2] + ' \u00b7 \u2b50 ' + S.total + ' stars \u00b7 \ud83c\udfc5 ' + S.badges.filter(function (b) { return b.got; }).length + ' badges' }) : null,
        el('p', { class: 'kp-card__how', text: 'Go to ' + C.site + ' \u2192 Kids Corner \u2192 \ud83d\udd11 My Corner (Sign in)' }),
        el('p', { class: 'kp-card__verse', text: '\u201cThy word is a lamp unto my feet, and a light unto my path.\u201d Psalm 119:105' })
      ])
    ]);
  }
  function cardDialog(key) {
    var kind = getJ('kjt_pilgrim_card') || 'boy', holder = el('div', { class: 'kp-card-holder' });
    var tabs = el('div', { class: 'kg-levels', role: 'group', 'aria-label': 'Card design' });
    function draw() { tabs.innerHTML = ''; [['boy', '\ud83d\udc66 Boy card'], ['girl', '\ud83d\udc67 Girl card']].forEach(function (t) { tabs.appendChild(el('button', { class: 'kg-level', type: 'button', 'aria-pressed': kind === t[0] ? 'true' : 'false', text: t[1], onclick: function () { kind = t[0]; setJ('kjt_pilgrim_card', kind); draw(); } })); }); holder.innerHTML = ''; holder.appendChild(card(key, kind)); }
    draw();
    var note = el('p', { class: 'kp-msg', 'aria-live': 'polite' });
    dialog('\ud83d\udda8\ufe0f My Pilgrim Card', el('div', {}, [tabs, holder, el('div', { class: 'kt-row', style: 'justify-content:center' }, [
      el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '\ud83d\udda8\ufe0f Print', onclick: function () { printCard(key, kind); } }),
      el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '\ud83d\uddbc\ufe0f Save as a picture', onclick: function () { savePicture(key, kind, note); } })
    ]), note, el('p', { class: 'kp-small', text: 'Tip: write your name on the card with a pen after printing. We never ask for it online.' })]));
  }
  function printCard(key, kind) {
    var old = document.querySelector('.kp-print'); if (old) old.remove();
    var box = el('div', { class: 'kp-print' }, [card(key, kind)]);
    document.body.appendChild(box);
    /* 5.7.1: print on a page exactly the size of the card (no empty A4 around it). */
    var page = el('style', { id: 'kp-page-size', text: '@page{size:140mm 90mm;margin:0}' });
    document.head.appendChild(page);
    var img = box.querySelector('img'), go = function () {
      document.body.classList.add('kjt-printing-pilgrim');
      var done = function () { document.body.classList.remove('kjt-printing-pilgrim'); box.remove(); page.remove(); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done); window.print();
      setTimeout(function () { if (document.body.classList.contains('kjt-printing-pilgrim') && !window.matchMedia('print').matches) done(); }, 1500);
    };
    if (img && !img.complete) { img.onload = go; img.onerror = go; } else go();
  }

  /* 5.7.1: the card as a picture (PNG), drawn at 10 pixels per millimetre (1400 x 900). */
  function loadImg(src) { return new Promise(function (res) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { res(null); }; i.src = src; }); }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function wrap(g, text, maxW) { var words = text.split(' '), lines = [], line = ''; words.forEach(function (w) { var t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }); if (line) lines.push(line); return lines; }
  function cardPicture(key, kind) {
    var W = 1400, H = 900, AW = Math.round(W * 0.36), boy = kind === 'boy', pics = key.indexOf('P:') === 0;
    var S = window.KJTAchieve && window.KJTAchieve.summary ? window.KJTAchieve.summary() : null;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H; var g = cv.getContext('2d');
    var SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', SERIF = 'Georgia,"Times New Roman",serif', MONO = 'ui-monospace,Menlo,Consolas,monospace';
    return Promise.all([loadImg('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(art(kind))), loadImg(C.logo)]).then(function (im) {
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
      /* the picture side, cropped to fill like on screen */
      if (im[0]) { var sc = Math.max(AW / 200, H / 250), dw = 200 * sc, dh = 250 * sc; g.save(); g.beginPath(); g.rect(0, 0, AW, H); g.clip(); g.drawImage(im[0], (AW - dw) / 2, (H - dh) / 2, dw, dh); g.restore(); }
      /* the writing side */
      var grad = g.createLinearGradient(AW, 0, W, H); grad.addColorStop(0, boy ? '#eef6ff' : '#fdf0f6'); grad.addColorStop(0.55, '#fff'); g.fillStyle = grad; g.fillRect(AW, 0, W - AW, H);
      g.fillStyle = '#F3C548'; g.fillRect(AW, 0, 16, H);
      var X = AW + 70, R = W - 60, y = 150;
      if (im[1]) { g.save(); g.shadowColor = 'rgba(0,0,0,.15)'; g.shadowBlur = 16; g.fillStyle = '#fff'; rr(g, W - 190, 40, 150, 150, 26); g.fill(); g.restore(); var ls = Math.min(126 / im[1].width, 126 / im[1].height); g.drawImage(im[1], W - 115 - im[1].width * ls / 2, 115 - im[1].height * ls / 2, im[1].width * ls, im[1].height * ls); }
      g.textBaseline = 'alphabetic';
      g.fillStyle = boy ? '#1E5AA8' : '#C2185B'; g.font = '800 21px ' + SANS; (function (t, x) { for (var i = 0; i < t.length; i++) { g.fillText(t[i], x, y); x += g.measureText(t[i]).width + 2.5; } })('KNOWING JESUS TODAY \u00b7 KIDS CORNER', X); /* stops before the logo */
      y += 88; g.fillStyle = boy ? '#16326e' : '#8e1650'; g.font = '400 84px ' + SERIF; g.fillText('Pilgrim Card', X, y);
      y += 66; g.fillStyle = '#665f6b'; g.font = '400 30px ' + SANS; g.fillText('This card belongs to', X, y); var ow = g.measureText('This card belongs to').width;
      g.strokeStyle = '#9e93a6'; g.lineWidth = 3; g.setLineDash([3, 7]); g.beginPath(); g.moveTo(X + ow + 16, y + 4); g.lineTo(R, y + 4); g.stroke(); g.setLineDash([]);
      y += 68; g.fillStyle = '#8d5a2b'; g.font = '800 24px ' + SANS; (function (t, x) { for (var i = 0; i < t.length; i++) { g.fillText(t[i], x, y); x += g.measureText(t[i]).width + 3; } })('MY PILGRIM KEY', X);
      /* the key, in one or two balanced lines */
      var keyText = display(key).replace(/\u00a0/g, ' '), boxW = R - X, fs = pics ? 70 : 54, lines;
      g.font = '800 ' + fs + 'px ' + (pics ? SANS : MONO);
      lines = [keyText];
      if (g.measureText(keyText).width > boxW - 60) { var parts = keyText.split(' \u00b7 '), half = Math.ceil(parts.length / 2); lines = [parts.slice(0, half).join(' \u00b7 ') + ' \u00b7', parts.slice(half).join(' \u00b7 ')]; }
      while (lines.some(function (l) { return g.measureText(l).width > boxW - 60; }) && fs > 28) { fs -= 2; g.font = '800 ' + fs + 'px ' + (pics ? SANS : MONO); }
      var lh = fs * 1.25, bh = lines.length * lh + 44; y += 20;
      g.fillStyle = '#fff7df'; rr(g, X, y, boxW, bh, 22); g.fill(); g.strokeStyle = '#F3C548'; g.lineWidth = 6; g.stroke();
      g.fillStyle = '#3E093F'; g.textAlign = 'center'; lines.forEach(function (l, i) { g.fillText(l, X + boxW / 2, y + 22 + lh * (i + 0.82)); }); g.textAlign = 'start';
      y += bh + 54;
      if (S) { g.fillStyle = '#3E093F'; g.font = '700 30px ' + SANS; g.fillText(S.level[1] + ' ' + S.level[2] + ' \u00b7 \u2b50 ' + S.total + ' stars \u00b7 \ud83c\udfc5 ' + S.badges.filter(function (b) { return b.got; }).length + ' badges', X, y); y += 46; }
      g.fillStyle = '#665f6b'; g.font = '400 24px ' + SANS; g.fillText('Go to ' + C.site + ' \u2192 Kids Corner \u2192 \ud83d\udd11 My Corner (Sign in)', X, y);
      y += 30; g.strokeStyle = '#efe3c8'; g.lineWidth = 2; g.beginPath(); g.moveTo(X, y); g.lineTo(R, y); g.stroke();
      y += 42; g.fillStyle = '#5b4a2b'; g.font = 'italic 400 27px ' + SERIF;
      wrap(g, '\u201cThy word is a lamp unto my feet, and a light unto my path.\u201d Psalm 119:105', R - X).forEach(function (l) { g.fillText(l, X, y); y += 36; });
      return new Promise(function (res) { cv.toBlob(function (b) { res(b); }, 'image/png'); });
    });
  }
  function savePicture(key, kind, note) {
    note.textContent = 'Making your picture\u2026';
    cardPicture(key, kind).then(function (blob) {
      if (!blob) { note.textContent = 'The picture could not be made on this device. Try Print instead.'; return; }
      var url = URL.createObjectURL(blob), a = el('a', { href: url, download: 'my-pilgrim-card.png' });
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
      note.textContent = '\u2705 Saved! Look for \u201cmy-pilgrim-card.png\u201d in your downloads or photos.'; sound('good');
    });
  }

  window.KJTPilgrim = { save: saveNow, collect: collect, merge: mergeInto };
  function boot() {
    drawPanel(); setInterval(drawPanel, 30000);
    /* 7.8.7: back from a sign-in: show the card, and tidy the address */
    if (location.hash === '#my-pilgrim-card') { try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {} if (panel) setTimeout(function () { panel.scrollIntoView({ block: 'center' }); }, 300); }
    var m = me(); if (!m) return;
    /* 5.8.0: bring in anything new from other devices and from the Holy Bible page first */
    api('load', { key: m.key }).then(function (j) { if (j && j.ok && j.data) { mergeInto(j.data); if (window.KJTAchieve && window.KJTAchieve.refresh) window.KJTAchieve.refresh(true); } saveNow(false); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 50); }); else setTimeout(boot, 50);
})();
