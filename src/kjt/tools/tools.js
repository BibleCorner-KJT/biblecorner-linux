/* KJT Daily Helps · 4.118.0
   One small program for the website, the Android app and the Linux app (the apps keep a copy, so it works with no
   internet): My Agenda (for children: my day, routines, homework, the week with the Church's feasts and fasts, stars),
   the prayer rope, my rule of prayer, my list of names to remember, my thanksgiving journal and the fasting helper.
   Everything a person writes stays in their own browser or phone (localStorage); nothing is sent anywhere. */
(function () {
  'use strict';
  var root = document.getElementById('kjt-tools'); if (!root) return;
  var Q = new URLSearchParams(location.search);
  var LANG = (Q.get('lang') || root.getAttribute('data-lang') || document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
  var ONLY = root.getAttribute('data-only') || Q.get('only') || '';
  var ORDER = ['ar', 'el', 'es', 'fr', 'hi', 'ru', 'tl', 'zh'];
  var WORDS = window.KJT_TOOLS_WORDS || {};
  function t(s) { var a = WORDS[s], i = ORDER.indexOf(LANG); return a && i >= 0 && a[i] ? a[i] : s; }
  if (LANG === 'ar') root.setAttribute('dir', 'rtl');
  var AJAX = root.getAttribute('data-ajax') || (location.href.indexOf('/wp-content/plugins/') > 0 && location.protocol !== 'file:' ? location.href.split('/wp-content/')[0] : 'https://biblecorner.com') + '/wp-admin/admin-ajax.php';
  document.documentElement.lang = LANG;

  /* ---------- keeping things on this device ---------- */
  var KEY = 'kjt_daily_helps_v1', S;
  function load() { try { S = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { S = {}; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  load();

  /* ---------- small helpers ---------- */
  function el(tag, a, kids) {
    var e = document.createElement(tag);
    if (a) for (var k in a) {
      if (k === 'text') e.textContent = a[k];
      else if (k === 'on') for (var ev in a.on) e.addEventListener(ev, a.on[ev]);
      else if (k === 'cls') e.className = a[k];
      else if (a[k] !== null && a[k] !== undefined && a[k] !== false) e.setAttribute(k, a[k] === true ? '' : a[k]);
    }
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function id() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function iso(d) { d = d || new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function day(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function add(s, n) { var d = day(s); d.setDate(d.getDate() + n); return iso(d); }
  var LOC = { zh: 'zh-CN', tl: 'fil', el: 'el', ar: 'ar' }[LANG] || LANG;
  function fmt(s, o) { try { return day(s).toLocaleDateString(LOC, o || { weekday: 'long', day: 'numeric', month: 'long' }); } catch (e) { return s; } }
  function btn(text, fn, cls) { return el('button', { type: 'button', cls: 'kt-btn ' + (cls || ''), text: text, on: { click: fn } }); }
  function clear(e) { while (e.firstChild) e.removeChild(e.firstChild); return e; }
  function say(msg) { var b = el('div', { cls: 'kt-toast', role: 'status', text: msg }); document.body.appendChild(b); setTimeout(function () { b.remove(); }, 2600); }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

  /* ---------- the Church's days (feasts and fasts), from the website or the app ---------- */
  var DAYS = null;
  function churchDays(done) {
    if (DAYS) return done(DAYS);
    var keep = function (list) { DAYS = {}; (list || []).forEach(function (d) { DAYS[d.date] = d; }); done(DAYS); };
    try { if (window.KJTApp && KJTApp.today) { keep(JSON.parse(KJTApp.today(LANG))); return; } } catch (e) {}
    var cached = null; try { cached = JSON.parse(localStorage.getItem('kjt_daily_helps_days_' + LANG) || 'null'); } catch (e) {}
    var from = iso(); from = from.slice(0, 8) + '01';
    fetch(AJAX + '?action=kjtb_desk&op=today&days=62&helps=1&lang=' + LANG + '&from=' + from, { credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (j) { var l = (j && j.data && j.data.days) || []; try { localStorage.setItem('kjt_daily_helps_days_' + LANG, JSON.stringify(l)); } catch (e) {} keep(l); })
      .catch(function () { keep(cached || []); });
  }
  /* the Church's days of one month (and the first days of the next), for the agenda's calendar */
  var MONTHS = {};
  function churchMonth(y, m, done) {
    var key = y + '-' + ('0' + (m + 1)).slice(-2), from = key + '-01';
    if (MONTHS[key]) return done(MONTHS[key]);
    var keep = function (list) { var o = {}; (list || []).forEach(function (d) { o[d.date] = d; }); MONTHS[key] = o; done(o); };
    try { if (window.KJTApp && KJTApp.days) { keep(JSON.parse(KJTApp.days(LANG, from, 42))); return; } } catch (e) {}
    var ck = 'kjt_daily_helps_m_' + LANG + '_' + key, cached = null; try { cached = JSON.parse(localStorage.getItem(ck) || 'null'); } catch (e) {}
    fetch(AJAX + '?action=kjtb_desk&op=today&days=42&helps=1&lang=' + LANG + '&from=' + from, { credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (j) { var l = (j && j.data && j.data.days) || []; try { localStorage.setItem(ck, JSON.stringify(l)); } catch (e) {} keep(l); })
      .catch(function () { keep(cached || []); });
  }

  function churchLine(d) {
    if (!d) return null;
    var bits = [];
    if (d.feast) bits.push('✦ ' + d.feast);
    if (d.fast) bits.push('🍃 ' + d.fast);
    return bits.length ? el('div', { cls: 'kt-church', text: bits.join(' · ') }) : null;
  }

  /* ---------- the tools ---------- */
  var TOOLS = [
    { k: 'agenda', icon: '🎒', name: 'My Agenda', sub: 'Day, week, month and year; birthdays, homework and reminders' },
    { k: 'rope', icon: '📿', name: 'Prayer rope', sub: 'Count the Jesus Prayer quietly' },
    { k: 'rule', icon: '🕯️', name: 'My rule of prayer', sub: 'A small daily rule, ticked off each day' },
    { k: 'names', icon: '📜', name: 'Names to remember', sub: 'The living and the departed, for my prayers' },
    { k: 'thanks', icon: '🙏', name: 'Thanksgiving journal', sub: 'One line of thanks each day' },
    { k: 'fast', icon: '🍲', name: 'Fasting helper', sub: 'Today’s fast and simple meals' }
  ];
  var view = clear(root).appendChild(el('div', { cls: 'kt' }));

  function route() {
    var k = (location.hash || '').replace('#', '') || ONLY || '';
    if (ONLY) k = ONLY;
    var tool = TOOLS.filter(function (x) { return x.k === k; })[0];
    clear(view);
    if (!tool) return home();
    if (!ONLY) view.appendChild(el('a', { cls: 'kt-back', href: '#', text: '← ' + t('All the helps') }));
    view.appendChild(el('h2', { cls: 'kt-title', text: tool.icon + ' ' + t(tool.name) }));
    var body = view.appendChild(el('div', { cls: 'kt-body' }));
    ({ agenda: agenda, rope: rope, rule: rule, names: names, thanks: thanks, fast: fasting })[tool.k](body);
  }
  function home() {
    view.appendChild(el('p', { cls: 'kt-lead', text: t('Small helps for each day. What you write stays on this device only.') }));
    var g = view.appendChild(el('div', { cls: 'kt-grid' }));
    TOOLS.forEach(function (x) {
      g.appendChild(el('a', { cls: 'kt-card', href: '#' + x.k }, [el('span', { cls: 'kt-card-i', text: x.icon }), el('b', { text: t(x.name) }), el('small', { text: t(x.sub) })]));
    });
  }
  window.addEventListener('hashchange', route);

  /* ======================= MY AGENDA (children) =======================
     4.119.0: a calm, useful agenda, not a game. Day, week, month and year views; the Church's great feasts and other
     special days (New Year…) marked; birthdays every year; homework; reminders (in the apps they come even when the
     app is closed; on the website while the page is open). A grown-up can change the routines and print them. */
  function A() {
    if (!S.agenda) S.agenda = {};
    var a = S.agenda;
    a.routines = a.routines || defaultRoutines(); a.ticks = a.ticks || {}; a.tasks = a.tasks || []; a.events = a.events || [];
    a.pin = a.pin || ''; a.view = a.view || 'day'; a.hwRemind = a.hwRemind !== false;
    return a;
  }
  function defaultRoutines() {
    function r(name, icon, when, steps) { return { id: id(), name: name, icon: icon, when: when, steps: steps.map(function (s) { return { id: id(), t: s[1], icon: s[0] }; }) }; }
    return [
      r('Getting ready', '🌅', 'morning', [['🙏', 'Morning prayers'], ['🪥', 'Wash and brush teeth'], ['👕', 'Get dressed'], ['🥣', 'Breakfast'], ['🎒', 'Take my bag']]),
      r('After school', '🏠', 'afternoon', [['🍎', 'A snack'], ['📚', 'Homework'], ['🧸', 'Tidy my things']]),
      r('Bedtime', '🌙', 'evening', [['🎒', 'Pack my bag for tomorrow'], ['🛁', 'Bath or wash'], ['🕯️', 'Evening prayers'], ['😴', 'Sleep']])
    ];
  }
  function partOfDay() { var h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; }

  /* ---------- special days: the Church's great feasts (with Pascha and the feasts that follow it) and New Year ---------- */
  function pascha(y) {   // the Orthodox Pascha (Julian reckoning, given as a date of the civil calendar)
    var a = y % 4, b = y % 7, c = y % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
    var m = Math.floor((d + e + 114) / 31), dd = ((d + e + 114) % 31) + 1;
    var j = new Date(y, m - 1, dd); j.setDate(j.getDate() + (y >= 2100 ? 14 : 13)); return iso(j);
  }
  var SPECIAL = {};
  function specialDays(y) {
    if (SPECIAL[y]) return SPECIAL[y];
    var o = {}, P = pascha(y);
    function put(d, icon, name, great) { o[d] = o[d] || []; o[d].push({ icon: icon, t: name, great: !!great }); }
    put(y + '-01-01', '🎆', 'New Year');
    put(y + '-01-06', '🕊️', 'Theophany', 1); put(y + '-02-02', '☦', 'Meeting of the Lord', 1); put(y + '-03-25', '☦', 'Annunciation', 1);
    put(y + '-06-29', '☦', 'Saints Peter and Paul'); put(y + '-08-06', '☦', 'Transfiguration', 1); put(y + '-08-15', '☦', 'Dormition of the Theotokos', 1);
    put(y + '-09-01', '☦', 'Church New Year'); put(y + '-09-08', '☦', 'Nativity of the Theotokos', 1); put(y + '-09-14', '✝️', 'Elevation of the Cross', 1);
    put(y + '-11-21', '☦', 'Entry of the Theotokos', 1); put(y + '-12-25', '⭐', 'Nativity of Christ (Christmas)', 1);
    put(add(P, -48), '🍃', 'Great Lent begins'); put(add(P, -7), '🌿', 'Palm Sunday', 1); put(add(P, -2), '✝️', 'Holy Friday');
    put(P, '☦', 'Pascha: Christ is Risen!', 1); put(add(P, 39), '☦', 'Ascension', 1); put(add(P, 49), '🔥', 'Pentecost', 1);
    put(y + '-11-15', '🍃', 'Nativity Fast begins');
    return (SPECIAL[y] = o);
  }
  function specialOn(d) { return specialDays(+d.slice(0, 4))[d] || []; }

  /* ---------- what is on a day (events repeat weekly or yearly; birthdays every year) ---------- */
  function eventsOn(a, d) {
    var wd = day(d).getDay();
    return a.events.filter(function (e) {
      if (e.date === d) return true;
      if (d < e.date) return false;
      if (e.repeat === 'week') return day(e.date).getDay() === wd;
      if (e.repeat === 'year' || e.kind === 'birthday') return e.date.slice(5) === d.slice(5);
      return false;
    }).sort(function (x, y) { return (x.time || '99') < (y.time || '99') ? -1 : 1; });
  }
  function evLabel(e, d) {
    if (e.kind === 'birthday') { var n = +d.slice(0, 4) - +e.date.slice(0, 4); return '🎂 ' + e.t + (e.year && n > 0 ? ' · ' + n + ' ' + t('years') : ''); }
    return (e.time ? e.time + ' · ' : '') + e.t;
  }
  function homeworkOn(a, d) { return a.tasks.filter(function (x) { return x.due === d; }); }

  /* ---------- reminders ---------- */
  function upcomingReminders(a) {
    var out = [], now = Date.now(), today = iso();
    for (var i = 0; i < 21; i++) {
      var d = add(today, i);
      eventsOn(a, d).forEach(function (e) {
        var r = e.remind || (e.kind === 'birthday' ? 'eve' : 'none'); if (r === 'none') return;
        var at;
        if (r === 'eve') { at = day(add(d, -1)); at.setHours(18, 0, 0, 0); }
        else { at = day(d); var tm = (e.time || '08:00').split(':'); at.setHours(+tm[0], +tm[1], 0, 0); at = new Date(at.getTime() - (+r) * 60000); }
        if (at.getTime() > now) out.push({ id: e.id + '-' + d, at: at.getTime(), title: (e.kind === 'birthday' ? '🎂 ' : '📌 ') + e.t, body: (r === 'eve' ? t('Tomorrow') : fmt(d, { weekday: 'long', day: 'numeric', month: 'long' })) + (e.time ? ' · ' + e.time : '') });
      });
      if (a.hwRemind) a.tasks.filter(function (x) { return !x.done && x.due === d; }).forEach(function (x) {
        var at = day(add(d, -1)); at.setHours(18, 0, 0, 0);
        if (at.getTime() > now) out.push({ id: 'hw-' + x.id, at: at.getTime(), title: '📚 ' + x.t, body: t('Homework for tomorrow') });
      });
    }
    return out.sort(function (x, y) { return x.at - y.at; });
  }
  var remindTimer = null;
  function syncReminders() {
    var a = A(), list = upcomingReminders(a);
    try { if (window.KJTApp && KJTApp.reminders) { KJTApp.reminders(JSON.stringify(list)); return; } } catch (e) {}
    try { if (window.webkit && webkit.messageHandlers && webkit.messageHandlers.kjtRemind) { webkit.messageHandlers.kjtRemind.postMessage(JSON.stringify(list)); return; } } catch (e) {}
    // the website: while the page is open
    if (remindTimer) clearInterval(remindTimer);
    remindTimer = setInterval(function () {
      var fired = S.fired || (S.fired = {}), now = Date.now(), changed = false;
      list.forEach(function (r) {
        if (r.at <= now && now - r.at < 3600000 && !fired[r.id + r.at]) {
          fired[r.id + r.at] = 1; changed = true;
          try { if (window.Notification && Notification.permission === 'granted') new Notification(r.title, { body: r.body }); else say('🔔 ' + r.title + ' · ' + r.body); } catch (e) { say('🔔 ' + r.title); }
        }
      });
      if (changed) { Object.keys(fired).forEach(function (k) { if (+k.slice(-13) < now - 86400000 * 3) delete fired[k]; }); save(); }
    }, 30000);
  }
  function inApp() { return !!((window.KJTApp && KJTApp.reminders) || (window.webkit && webkit.messageHandlers && webkit.messageHandlers.kjtRemind)); }
  function keep() { save(); syncReminders(); }

  /* ---------- the agenda ---------- */
  var VIEWS = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']];
  function agenda(body) {
    var a = A(), today = iso();
    Object.keys(a.ticks).forEach(function (k) { if (k < add(today, -7)) delete a.ticks[k]; });
    a.tasks = a.tasks.filter(function (x) { return !(x.done && x.due < add(today, -14)); });
    a.events = a.events.filter(function (e) { return e.kind === 'birthday' || (e.repeat && e.repeat !== 'none') || e.date >= add(today, -31); });
    if (!a.cursor) a.cursor = today;
    save(); syncReminders();

    var bar = body.appendChild(el('div', { cls: 'kt-seg', role: 'tablist' }));
    var pane = body.appendChild(el('div'));
    function go(view, d) {
      if (view) a.view = view; if (d) a.cursor = d; save();
      Array.prototype.forEach.call(bar.children, function (b) { b.setAttribute('aria-selected', b.getAttribute('data-k') === a.view ? 'true' : 'false'); });
      clear(pane);
      ({ day: dayView, week: weekView, month: monthView, year: yearView })[a.view](pane, a, go);
    }
    VIEWS.forEach(function (v) { bar.appendChild(el('button', { type: 'button', role: 'tab', 'data-k': v[0], cls: 'kt-segb', text: t(v[1]), on: { click: function () { go(v[0]); } } })); });
    go(a.view);

    if (!inApp() && window.Notification && Notification.permission === 'default') {
      body.appendChild(el('div', { cls: 'kt-line kt-center' }, [btn('🔔 ' + t('Allow reminders'), function (ev) { Notification.requestPermission(); ev.target.remove(); }, 'is-small')]));
    }
    if (!inApp()) body.appendChild(el('p', { cls: 'kt-sub kt-center', text: t('On the website, reminders come while this page is open. In the Bible Corner app they come even when it is closed.') }));
    var g = body.appendChild(el('details', { cls: 'kt-grown' }, [el('summary', { text: '🔒 ' + t('For grown-ups') })]));
    g.addEventListener('toggle', function () { if (g.open && !g.getAttribute('data-done')) { g.setAttribute('data-done', '1'); grownups(g, a, function () { go(); }); } });
  }

  function navBar(label, prev, next, now) {
    return el('div', { cls: 'kt-nav' }, [btn('‹', prev, 'is-ghost', null), el('b', { text: label }), btn('›', next, 'is-ghost'), now ? btn(t('Today'), now, 'is-small') : null]);
  }
  function markLine(d, a, church) {
    var box = el('div', { cls: 'kt-marks' });
    specialOn(d).forEach(function (x) { box.appendChild(el('div', { cls: 'kt-special' + (x.great ? ' is-great' : ''), text: x.icon + ' ' + t(x.t) })); });
    if (church && church.feast && !specialOn(d).some(function (x) { return x.great; })) box.appendChild(el('div', { cls: 'kt-church', text: '✦ ' + church.feast }));
    if (church && church.fast) box.appendChild(el('div', { cls: 'kt-church kt-fastline', text: '🍃 ' + church.fast }));
    return box;
  }

  /* ----- one day ----- */
  function dayView(p, a, go) {
    var d = a.cursor, today = iso(), isToday = d === today;
    p.appendChild(navBar(fmt(d), function () { go(null, add(d, -1)); }, function () { go(null, add(d, 1)); }, isToday ? null : function () { go(null, today); }));
    var mk = p.appendChild(el('div'));
    var dt = day(d); churchMonth(dt.getFullYear(), dt.getMonth(), function (M) { mk.appendChild(markLine(d, a, M[d])); });

    // now: the routine of this part of the day (today only)
    if (isToday) {
      var ticks = a.ticks[today] || (a.ticks[today] = {});
      a.routines.filter(function (r) { return r.when === partOfDay(); }).forEach(function (r) {
        var box = p.appendChild(el('section', { cls: 'kt-card2' }, [el('h3', { text: r.icon + ' ' + t(r.name) })]));
        r.steps.forEach(function (st) {
          var cb = el('input', { type: 'checkbox' }); cb.checked = !!ticks[st.id];
          cb.addEventListener('change', function () { ticks[st.id] = cb.checked; save(); });
          box.appendChild(el('label', { cls: 'kt-check kt-check-big' }, [cb, ' ' + st.icon + ' ' + t(st.t)]));
        });
      });
    }

    // the day's events and birthdays
    var evBox = p.appendChild(el('section', { cls: 'kt-card2' }, [el('h3', { text: '📅 ' + t('Plans') })]));
    var evs = eventsOn(a, d);
    if (!evs.length) evBox.appendChild(el('p', { cls: 'kt-sub', text: t('Nothing planned.') }));
    evs.forEach(function (e) {
      var rm = e.remind && e.remind !== 'none' || e.kind === 'birthday' ? ' 🔔' : '';
      evBox.appendChild(el('div', { cls: 'kt-ev' }, [el('span', { text: evLabel(e, d) + (e.repeat === 'week' ? ' · ' + t('every week') : '') + rm }),
        btn('✕', function () { if (!confirmOk(t('Remove this?'))) return; a.events = a.events.filter(function (y) { return y !== e; }); keep(); go(); }, 'is-ghost is-small')]));
    });
    evBox.appendChild(addForm(a, d, go));

    // homework
    var hw = p.appendChild(el('section', { cls: 'kt-card2' }, [el('h3', { text: '📚 ' + t('Homework') })]));
    var list = isToday ? a.tasks.filter(function (x) { return !x.done || x.due >= today; }) : homeworkOn(a, d);
    list.sort(function (x, y) { return x.due < y.due ? -1 : 1; }).forEach(function (x) {
      var cb = el('input', { type: 'checkbox' }); cb.checked = !!x.done;
      cb.addEventListener('change', function () { x.done = cb.checked; keep(); go(); });
      hw.appendChild(el('div', { cls: 'kt-task' + (x.done ? ' is-done' : '') }, [cb, el('div', { cls: 'kt-task-t' }, [el('b', { text: x.t }), el('small', { text: dueWord(x.due) })]),
        btn('✕', function () { a.tasks = a.tasks.filter(function (y) { return y !== x; }); keep(); go(); }, 'is-ghost is-small')]));
    });
    if (!list.length) hw.appendChild(el('p', { cls: 'kt-sub', text: t('No homework.') }));
    var f = hw.appendChild(el('form', { cls: 'kt-line' }));
    var what = el('input', { type: 'text', maxlength: '100', required: true, placeholder: t('What do I have to do?') });
    var due = el('input', { type: 'date', value: isToday ? add(d, 1) : d, 'aria-label': t('For when?') });
    f.appendChild(what); f.appendChild(due); f.appendChild(btn('＋', function () {}, 'is-small is-main')).setAttribute('type', 'submit');
    f.addEventListener('submit', function (e) { e.preventDefault(); var w = what.value.trim(); if (!w || !due.value) return; a.tasks.push({ id: id(), t: w, due: due.value, done: false }); keep(); go(); });
  }
  function confirmOk(q) { try { return window.confirm ? confirm(q) : true; } catch (e) { return true; } }

  function addForm(a, d, go) {
    var wrap = el('div');
    var open = btn('＋ ' + t('Add a plan or a birthday'), function () { open.remove(); wrap.appendChild(form()); }, 'is-small');
    wrap.appendChild(open);
    function form() {
      var f = el('form', { cls: 'kt-form' });
      var kind = el('select', { 'aria-label': t('What is it?') });
      [['event', '📌 ' + t('A plan')], ['birthday', '🎂 ' + t('A birthday')]].forEach(function (o) { kind.appendChild(el('option', { value: o[0], text: o[1] })); });
      var what = el('input', { type: 'text', maxlength: '80', required: true, placeholder: t('What? (a trip, church, sport, a visit…)') });
      var date = el('input', { type: 'date', required: true, value: d });
      var time = el('input', { type: 'time', 'aria-label': t('Time (optional)') });
      var rep = el('select', { 'aria-label': t('Repeat') });
      [['none', 'Once'], ['week', 'Every week'], ['year', 'Every year']].forEach(function (o) { rep.appendChild(el('option', { value: o[0], text: t(o[1]) })); });
      var rem = el('select', { 'aria-label': t('Reminder') });
      [['none', 'No reminder'], ['0', 'Remind me at the time'], ['15', 'Remind me 15 minutes before'], ['60', 'Remind me 1 hour before'], ['eve', 'Remind me the evening before']].forEach(function (o) { rem.appendChild(el('option', { value: o[0], text: '🔔 ' + t(o[1]) })); });
      var year = el('label', { cls: 'kt-inline', style: 'display:none' }, [el('input', { type: 'checkbox', checked: true }), ' ' + t('The date is the day of birth (to show the age)')]);
      function kindChanged() {
        var b = kind.value === 'birthday';
        what.placeholder = b ? t('Whose birthday?') : t('What? (a trip, church, sport, a visit…)');
        time.style.display = rep.style.display = b ? 'none' : ''; year.style.display = b ? '' : 'none';
        rem.value = b ? 'eve' : 'none';
      }
      kind.addEventListener('change', kindChanged);
      f.appendChild(el('div', { cls: 'kt-line' }, [kind, what]));
      f.appendChild(el('div', { cls: 'kt-line' }, [date, time, rep]));
      f.appendChild(el('div', { cls: 'kt-line' }, [rem, year]));
      f.appendChild(el('div', { cls: 'kt-line' }, [btn(t('Save'), function () {}, 'is-main'), btn(t('Cancel'), function () { go(); }, 'is-ghost')]));
      f.querySelector('.is-main').setAttribute('type', 'submit');
      f.addEventListener('submit', function (e) {
        e.preventDefault(); var w = what.value.trim(); if (!w || !date.value) return;
        var b = kind.value === 'birthday';
        a.events.push({ id: id(), kind: kind.value, t: w, date: date.value, time: b ? '' : time.value, repeat: b ? 'year' : rep.value, remind: rem.value, year: b ? year.querySelector('input').checked : false });
        keep(); go();
      });
      setTimeout(function () { try { what.focus(); } catch (e) {} }, 50);
      return f;
    }
    return wrap;
  }

  function dueWord(d) {
    var today = iso();
    if (d < today) return '⚠ ' + t('Late');
    if (d === today) return t('Today');
    if (d === add(today, 1)) return t('Tomorrow');
    return fmt(d, { weekday: 'long', day: 'numeric', month: 'short' });
  }

  /* ----- a week ----- */
  function weekView(p, a, go) {
    var d = a.cursor, wd = (day(d).getDay() + 6) % 7, start = add(d, -wd), today = iso();
    p.appendChild(navBar(fmt(start, { day: 'numeric', month: 'short' }) + ' – ' + fmt(add(start, 6), { day: 'numeric', month: 'short', year: 'numeric' }),
      function () { go(null, add(d, -7)); }, function () { go(null, add(d, 7)); }, function () { go(null, today); }));
    var list = p.appendChild(el('div'));
    var s0 = day(start), s6 = day(add(start, 6)), need = [[s0.getFullYear(), s0.getMonth()]];
    if (s6.getMonth() !== s0.getMonth()) need.push([s6.getFullYear(), s6.getMonth()]);
    var M = {}, left = need.length;
    need.forEach(function (n) { churchMonth(n[0], n[1], function (o) { for (var k in o) M[k] = o[k]; if (--left === 0) draw(); }); });
    function draw() {
      for (var i = 0; i < 7; i++) (function (ds) {
        var c = el('button', { type: 'button', cls: 'kt-wrow' + (ds === today ? ' is-today' : ''), on: { click: function () { go('day', ds); } } });
        c.appendChild(el('div', { cls: 'kt-wday-h', text: fmt(ds, { weekday: 'long', day: 'numeric', month: 'short' }) }));
        c.appendChild(markLine(ds, a, M[ds]));
        eventsOn(a, ds).forEach(function (e) { c.appendChild(el('div', { cls: 'kt-ev-s', text: (e.kind === 'birthday' ? '' : '📌 ') + evLabel(e, ds) })); });
        homeworkOn(a, ds).forEach(function (x) { if (!x.done) c.appendChild(el('div', { cls: 'kt-ev-s', text: '📚 ' + x.t })); });
        list.appendChild(c);
      })(add(start, i));
    }
  }

  /* ----- a month ----- */
  function weekdayNames() { var out = [], mon = add(iso(), -((new Date().getDay() + 6) % 7)); for (var i = 0; i < 7; i++) out.push(fmt(add(mon, i), { weekday: 'narrow' })); return out; }
  function monthGrid(y, m, a, opts) {
    var first = new Date(y, m, 1), lead = (first.getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate(), today = iso();
    var g = el('div', { cls: 'kt-mgrid' + (opts.mini ? ' is-mini' : '') });
    weekdayNames().forEach(function (w) { g.appendChild(el('span', { cls: 'kt-mh', text: w })); });
    for (var i = 0; i < lead; i++) g.appendChild(el('span'));
    for (var dd = 1; dd <= n; dd++) (function (ds) {
      var sp = specialOn(ds), evs = eventsOn(a, ds), hw = homeworkOn(a, ds).filter(function (x) { return !x.done; }), ch = opts.church ? opts.church[ds] : null;
      var cls = 'kt-md' + (ds === today ? ' is-today' : '') + (sp.some(function (x) { return x.great; }) ? ' is-feast' : sp.length ? ' is-special' : '') + (ch && ch.fast ? ' is-fast' : '') + (ds === opts.sel ? ' is-sel' : '');
      var c = el('button', { type: 'button', cls: cls, title: sp.map(function (x) { return t(x.t); }).concat(evs.map(function (e) { return evLabel(e, ds); })).join(' · '), on: { click: function () { opts.pick(ds); } } }, [el('span', { cls: 'kt-mdn', text: String(+ds.slice(8)) })]);
      if (!opts.mini) {
        var dots = el('span', { cls: 'kt-dots' });
        if (sp.length) dots.appendChild(el('i', { text: sp[0].icon }));
        evs.slice(0, 2).forEach(function (e) { dots.appendChild(el('i', { text: e.kind === 'birthday' ? '🎂' : '•' })); });
        if (hw.length) dots.appendChild(el('i', { text: '📚' }));
        c.appendChild(dots);
      } else if (evs.length) c.classList.add('has-ev');
      g.appendChild(c);
    })(y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + dd).slice(-2));
    return g;
  }
  function monthView(p, a, go) {
    var d = a.cursor, dt = day(d), y = dt.getFullYear(), m = dt.getMonth(), today = iso();
    var label = fmt(iso(new Date(y, m, 1)), { month: 'long', year: 'numeric' });
    p.appendChild(navBar(label, function () { go(null, iso(new Date(y, m - 1, 1))); }, function () { go(null, iso(new Date(y, m + 1, 1))); }, function () { go(null, today); }));
    var holder = p.appendChild(el('div')), detail = p.appendChild(el('div', { cls: 'kt-card2' }));
    churchMonth(y, m, function (M) {
      function pick(ds) { a.cursor = ds; save(); clear(holder).appendChild(monthGrid(y, m, a, { church: M, pick: pick, sel: ds })); showDay(ds); }
      function showDay(ds) {
        clear(detail);
        detail.appendChild(el('h3', { text: fmt(ds) }));
        detail.appendChild(markLine(ds, a, M[ds]));
        eventsOn(a, ds).forEach(function (e) { detail.appendChild(el('div', { cls: 'kt-ev-s', text: (e.kind === 'birthday' ? '' : '📌 ') + evLabel(e, ds) })); });
        homeworkOn(a, ds).forEach(function (x) { detail.appendChild(el('div', { cls: 'kt-ev-s', text: '📚 ' + x.t })); });
        detail.appendChild(btn(t('Open this day') + ' →', function () { go('day', ds); }, 'is-small'));
      }
      pick(d.slice(0, 7) === iso(new Date(y, m, 1)).slice(0, 7) ? d : iso(new Date(y, m, 1)));
    });
    p.appendChild(el('p', { cls: 'kt-legend' }, [el('span', { cls: 'kt-key is-feast' }), ' ' + t('Great feast') + '  ', el('span', { cls: 'kt-key is-fast' }), ' ' + t('Fast day') + '  🎂 ' + t('Birthday') + '  • ' + t('Plan') + '  📚 ' + t('Homework')]));
  }

  /* ----- a year ----- */
  function yearView(p, a, go) {
    var y = day(a.cursor).getFullYear(), today = iso();
    p.appendChild(navBar(String(y), function () { go(null, (y - 1) + a.cursor.slice(4)); }, function () { go(null, (y + 1) + a.cursor.slice(4)); }, function () { go(null, today); }));
    var g = p.appendChild(el('div', { cls: 'kt-year' }));
    for (var m = 0; m < 12; m++) (function (m) {
      var box = g.appendChild(el('div', { cls: 'kt-ym' }));
      box.appendChild(el('button', { type: 'button', cls: 'kt-ymh', text: fmt(iso(new Date(y, m, 1)), { month: 'long' }), on: { click: function () { go('month', iso(new Date(y, m, 1))); } } }));
      box.appendChild(monthGrid(y, m, a, { mini: true, pick: function (ds) { go('day', ds); } }));
    })(m);
    // the year's special days and birthdays, in order
    var list = p.appendChild(el('section', { cls: 'kt-card2' }, [el('h3', { text: '✨ ' + t('Special days of the year') })]));
    var all = [], sp = specialDays(y);
    Object.keys(sp).forEach(function (k) { sp[k].forEach(function (x) { all.push([k, x.icon + ' ' + t(x.t), x.great]); }); });
    a.events.forEach(function (e) { if (e.kind === 'birthday') all.push([y + e.date.slice(4), evLabel(e, y + e.date.slice(4)), false]); });
    all.sort(function (x, z) { return x[0] < z[0] ? -1 : 1; }).forEach(function (r) {
      list.appendChild(el('button', { type: 'button', cls: 'kt-yl' + (r[2] ? ' is-great' : ''), on: { click: function () { go('day', r[0]); } } }, [el('span', { cls: 'kt-yld', text: fmt(r[0], { day: 'numeric', month: 'short' }) }), el('span', { text: r[1] })]));
    });
    p.appendChild(el('p', { cls: 'kt-sub', text: t('The great feasts are given by the new calendar. On the old calendar the fixed feasts are 13 days later; Pascha is the same.') }));
  }

  /* ----- grown-ups ----- */
  function grownups(p, a, redraw) {
    var inner = p.appendChild(el('div'));
    function locked() {
      clear(inner);
      if (!a.pin) return open();
      var f = inner.appendChild(el('form', { cls: 'kt-line' }));
      var pin = el('input', { type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'off', placeholder: 'PIN' }); f.appendChild(pin);
      f.appendChild(btn('OK', function () {}, 'is-small')).setAttribute('type', 'submit');
      f.addEventListener('submit', function (e) { e.preventDefault(); if (pin.value === a.pin) open(); else say(t('That PIN is not right.')); });
    }
    function open() {
      clear(inner);
      inner.appendChild(el('div', { cls: 'kt-line' }, [btn('🖨 ' + t('Print the lists for the fridge'), function () { printLists(a); }, 'is-main')]));
      var hwc = el('input', { type: 'checkbox' }); hwc.checked = a.hwRemind;
      hwc.addEventListener('change', function () { a.hwRemind = hwc.checked; keep(); });
      inner.appendChild(el('label', { cls: 'kt-check' }, [hwc, ' 🔔 ' + t('Remind homework the evening before (18:00)')]));
      a.routines.forEach(function (r) {
        var box = inner.appendChild(el('section', { cls: 'kt-card2' }));
        var nm = el('input', { type: 'text', maxlength: '40', value: t(r.name) }); nm.addEventListener('change', function () { r.name = nm.value.trim() || r.name; save(); redraw(); });
        var wh = el('select'); [['morning', '🌅', 'Morning'], ['afternoon', '🏠', 'Afternoon'], ['evening', '🌙', 'Evening']].forEach(function (o) { wh.appendChild(el('option', { value: o[0], text: o[1] + ' ' + t(o[2]) })); }); wh.value = r.when;
        wh.addEventListener('change', function () { r.when = wh.value; save(); redraw(); });
        box.appendChild(el('div', { cls: 'kt-line' }, [nm, wh, btn('🗑', function () { a.routines = a.routines.filter(function (x) { return x !== r; }); save(); open(); redraw(); }, 'is-ghost is-small')]));
        r.steps.forEach(function (st) {
          var ic = el('input', { type: 'text', maxlength: '4', cls: 'kt-mini', value: st.icon }); ic.addEventListener('change', function () { st.icon = ic.value.trim() || '✔️'; save(); redraw(); });
          var tx = el('input', { type: 'text', maxlength: '40', value: t(st.t) }); tx.addEventListener('change', function () { st.t = tx.value.trim() || st.t; save(); redraw(); });
          box.appendChild(el('div', { cls: 'kt-line' }, [ic, tx, btn('✕', function () { r.steps = r.steps.filter(function (x) { return x !== st; }); save(); open(); redraw(); }, 'is-ghost is-small')]));
        });
        box.appendChild(btn('＋ ' + t('Add a step'), function () { r.steps.push({ id: id(), t: t('New step'), icon: '✔️' }); save(); open(); }, 'is-small'));
      });
      inner.appendChild(el('div', { cls: 'kt-line' }, [
        btn('＋ ' + t('Add a routine'), function () { a.routines.push({ id: id(), name: t('My routine'), icon: '⭐', when: 'afternoon', steps: [] }); save(); open(); }, 'is-small'),
        btn('↺ ' + t('Back to the first routines'), function () { a.routines = defaultRoutines(); save(); open(); redraw(); }, 'is-ghost is-small')]));
      var np = el('input', { type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'off', placeholder: a.pin ? t('A new PIN (empty: no PIN)') : t('A PIN for grown-ups (optional)') });
      inner.appendChild(el('div', { cls: 'kt-line' }, [np, btn(t('Save'), function () { a.pin = np.value.trim(); save(); say(a.pin ? t('The PIN is kept.') : t('No PIN now.')); }, 'is-small')]));
      inner.appendChild(el('p', { cls: 'kt-note', text: t('Everything in My Agenda stays on this device. Nothing is sent to the website.') }));
      inner.appendChild(btn('🔒 ' + t('Close'), function () { p.open = false; locked(); }, 'is-ghost is-small'));
    }
    locked();
  }

  /* the routines on one page, with boxes to tick by hand for a week, for the fridge */
  function printLists(a) {
    var css = 'body{font:16px/1.4 system-ui,sans-serif;margin:24px;color:#222}h1{font-size:22px;margin:0 0 4px}h2{font-size:18px;margin:18px 0 6px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:6px;text-align:center}td:first-child{text-align:left}small{color:#666}';
    var mon = add(iso(), -((new Date().getDay() + 6) % 7)), days = [];
    for (var i = 0; i < 7; i++) days.push(fmt(add(mon, i), { weekday: 'short' }));
    var doc = el('div');
    doc.appendChild(el('h1', { text: '🎒 ' + t('My Agenda') }));
    a.routines.forEach(function (r) {
      doc.appendChild(el('h2', { text: r.icon + ' ' + t(r.name) }));
      var tb = doc.appendChild(el('table')), hr = tb.appendChild(el('tr')); hr.appendChild(el('th'));
      days.forEach(function (x) { hr.appendChild(el('th', { text: x })); });
      r.steps.forEach(function (st) { var tr = tb.appendChild(el('tr')); tr.appendChild(el('td', { text: st.icon + ' ' + t(st.t) })); days.forEach(function () { tr.appendChild(el('td', { text: '☐' })); }); });
    });
    doc.appendChild(el('p', {}, [el('small', { text: 'biblecorner.com' })]));
    var html = '<!doctype html><html lang="' + LANG + '"' + (LANG === 'ar' ? ' dir="rtl"' : '') + '><head><meta charset="utf-8"><title>' + t('My Agenda') + '</title><style>' + css + '</style></head><body>' + doc.innerHTML + '</body></html>';
    var f = el('iframe', { style: 'position:fixed;width:0;height:0;border:0', 'aria-hidden': 'true' }); document.body.appendChild(f);
    f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
    setTimeout(function () { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) {} setTimeout(function () { f.remove(); }, 2000); }, 300);
  }

  /* ======================= PRAYER ROPE ======================= */
  var PRAYERS = [
    ['Lord Jesus Christ, Son of God, have mercy on me, a sinner.', 'Jesus Prayer'],
    ['Most Holy Theotokos, save us.', 'To the Theotokos'],
    ['Lord, have mercy.', 'Lord, have mercy'],
    ['Through the prayers of our holy fathers, Lord Jesus Christ our God, have mercy on us.', 'For the saints’ prayers']
  ];
  function rope(p) {
    var R = S.rope || (S.rope = { size: 100, prayer: 0, n: 0, days: {} });
    var today = iso(); R.days[today] = R.days[today] || 0;
    var pick = el('select'); PRAYERS.forEach(function (x, i) { pick.appendChild(el('option', { value: i, text: t(x[1]) })); }); pick.value = R.prayer;
    var size = el('select'); [33, 50, 100, 150, 300].forEach(function (n) { size.appendChild(el('option', { value: n, text: n + ' ' + t('knots') })); }); size.value = R.size;
    p.appendChild(el('div', { cls: 'kt-line' }, [pick, size]));
    var words = p.appendChild(el('p', { cls: 'kt-prayer kt-rope-words' }));
    var ring = p.appendChild(el('button', { type: 'button', cls: 'kt-rope', 'aria-label': t('Count one prayer') }));
    var num = ring.appendChild(el('b')), of = ring.appendChild(el('small'));
    var info = p.appendChild(el('p', { cls: 'kt-sub kt-center' }));
    function draw() {
      words.textContent = t(PRAYERS[R.prayer][0]);
      num.textContent = R.n; of.textContent = '/ ' + R.size;
      ring.style.setProperty('--kt-p', (R.n / R.size * 360) + 'deg');
      info.textContent = t('Today') + ': ' + R.days[today] + ' · ' + t('Touch the circle for each prayer. Take your time.');
    }
    ring.addEventListener('click', function () {
      R.n++; R.days[today]++; buzz(15);
      if (R.n >= R.size) { R.n = 0; buzz([60, 80, 60]); say('☦ ' + t('The rope is finished. Glory to God!')); }
      Object.keys(R.days).forEach(function (k) { if (k < add(today, -60)) delete R.days[k]; });
      save(); draw();
    });
    pick.addEventListener('change', function () { R.prayer = +pick.value; save(); draw(); });
    size.addEventListener('change', function () { R.size = +size.value; R.n = Math.min(R.n, R.size - 1); save(); draw(); });
    p.appendChild(el('div', { cls: 'kt-line kt-center' }, [btn('↺ ' + t('Start again'), function () { R.n = 0; save(); draw(); }, 'is-ghost')]));
    p.appendChild(el('p', { cls: 'kt-note', text: t('Pray slowly and with attention, not for the number. How much to pray is best set with your spiritual father.') }));
    draw();
  }

  /* ======================= MY RULE OF PRAYER ======================= */
  var RULE_ITEMS = [['morning', '🌅', 'Morning prayers'], ['psalm', '📖', 'A Psalm'], ['gospel', '✝️', 'A chapter of the Gospel'], ['epistle', '📜', 'A chapter of the Epistles'],
    ['jesus', '📿', 'The Jesus Prayer'], ['saint', '🕊️', 'The life of the saint of the day'], ['evening', '🌙', 'Evening prayers'], ['names', '📜', 'Pray for the names I remember']];
  function rule(p) {
    var U = S.rule || (S.rule = { items: { morning: 1, gospel: 1, jesus: 1, evening: 1 }, jesus: 33, ticks: {} });
    var today = iso(), tk = U.ticks[today] || (U.ticks[today] = {});
    Object.keys(U.ticks).forEach(function (k) { if (k < add(today, -90)) delete U.ticks[k]; });
    var chosen = RULE_ITEMS.filter(function (x) { return U.items[x[0]]; });
    p.appendChild(el('div', { cls: 'kt-date', text: fmt(today) }));
    var list = p.appendChild(el('section', { cls: 'kt-routine' }));
    chosen.forEach(function (x) {
      var label = t(x[2]) + (x[0] === 'jesus' ? ' × ' + U.jesus : '');
      var cb = el('input', { type: 'checkbox' }); cb.checked = !!tk[x[0]];
      cb.addEventListener('change', function () { tk[x[0]] = cb.checked; save(); streak(); });
      list.appendChild(el('label', { cls: 'kt-check kt-check-big' }, [cb, ' ' + x[1] + ' ' + label]));
    });
    if (!chosen.length) list.appendChild(el('p', { cls: 'kt-sub', text: t('Choose below what your rule holds.') }));
    var st = p.appendChild(el('p', { cls: 'kt-sub' }));
    function streak() {
      var n = 0, d = today;
      while (U.ticks[d] && chosen.length && chosen.every(function (x) { return U.ticks[d][x[0]]; })) { n++; d = add(d, -1); }
      st.textContent = n ? '🔥 ' + n + ' ' + t('days in a row with the whole rule') : t('Little by little: a small rule kept each day is better than a big one left.');
    }
    streak();
    p.appendChild(el('h3', { text: '⚙️ ' + t('What my rule holds') }));
    var set = p.appendChild(el('div', { cls: 'kt-set' }));
    RULE_ITEMS.forEach(function (x) {
      var cb = el('input', { type: 'checkbox' }); cb.checked = !!U.items[x[0]];
      cb.addEventListener('change', function () { U.items[x[0]] = cb.checked ? 1 : 0; save(); route(); });
      set.appendChild(el('label', { cls: 'kt-check' }, [cb, ' ' + x[1] + ' ' + t(x[2])]));
    });
    var jn = el('select'); [12, 33, 50, 100, 300, 500].forEach(function (n) { jn.appendChild(el('option', { value: n, text: n })); }); jn.value = U.jesus;
    jn.addEventListener('change', function () { U.jesus = +jn.value; save(); route(); });
    set.appendChild(el('label', { cls: 'kt-inline' }, [t('Jesus Prayers each day') + ' ', jn]));
    p.appendChild(el('div', { cls: 'kt-line' }, [btn('🖨 ' + t('Print my rule'), function () { window.print(); }, 'is-ghost')]));
    p.appendChild(el('p', { cls: 'kt-note', text: t('A rule of prayer is best made with your spiritual father or your priest.') }));
  }

  /* ======================= NAMES TO REMEMBER ======================= */
  function names(p) {
    var N = S.names || (S.names = { living: [], departed: [] });
    var reading = p.appendChild(el('section', { cls: 'kt-routine kt-read' }));
    function drawReading() {
      clear(reading);
      reading.appendChild(el('h3', { text: '🕯️ ' + t('Reading the names') }));
      if (N.living.length) {
        reading.appendChild(el('p', { cls: 'kt-prayer', text: t('Remember, O Lord, Thy servants, and have mercy on them:') }));
        reading.appendChild(el('p', { cls: 'kt-names', text: N.living.map(function (x) { return x.n; }).join(', ') }));
      }
      if (N.departed.length) {
        reading.appendChild(el('p', { cls: 'kt-prayer', text: t('Give rest, O Lord, to the souls of Thy servants who have fallen asleep:') }));
        reading.appendChild(el('p', { cls: 'kt-names', text: N.departed.map(function (x) { return x.n; }).join(', ') }));
        reading.appendChild(el('p', { cls: 'kt-prayer', text: t('Memory eternal.') }));
      }
      if (!N.living.length && !N.departed.length) reading.appendChild(el('p', { cls: 'kt-sub', text: t('Write the names below. They stay on this device only.') }));
    }
    drawReading();
    // the days of remembrance coming (3rd, 9th, 40th day, then each year)
    var soon = []; var today = iso();
    N.departed.forEach(function (x) {
      if (!x.d) return;
      [[2, '3rd day'], [8, '9th day'], [39, '40th day']].forEach(function (k) { var ds = add(x.d, k[0]); if (ds >= today && ds <= add(today, 30)) soon.push([ds, x.n, t(k[1])]); });
      var y = new Date().getFullYear(); for (var yy = y; yy <= y + 1; yy++) { var ds = yy + x.d.slice(4); if (ds > x.d && ds >= today && ds <= add(today, 30)) soon.push([ds, x.n, t('Yearly memorial')]); }
    });
    if (soon.length) {
      p.appendChild(el('h3', { text: '📅 ' + t('Days of remembrance soon') }));
      soon.sort().forEach(function (s) { p.appendChild(el('div', { cls: 'kt-row', text: fmt(s[0], { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + s[1] + ' · ' + s[2] })); });
    }
    [['living', '🌿', 'The living'], ['departed', '🕊️', 'The departed']].forEach(function (g) {
      p.appendChild(el('h3', { text: g[1] + ' ' + t(g[2]) }));
      N[g[0]].forEach(function (x) {
        p.appendChild(el('div', { cls: 'kt-row kt-line' }, [el('span', { text: x.n + (x.d ? ' · † ' + fmt(x.d, { day: 'numeric', month: 'short', year: 'numeric' }) : '') }),
          btn('✕', function () { N[g[0]] = N[g[0]].filter(function (y) { return y !== x; }); save(); route(); }, 'is-ghost is-small')]));
      });
      var f = el('form', { cls: 'kt-line' }); var nm = el('input', { type: 'text', maxlength: '60', required: true, placeholder: t('A name (the baptismal name if you know it)') });
      f.appendChild(nm);
      var dd = null; if (g[0] === 'departed') { dd = el('input', { type: 'date', 'aria-label': t('Day of falling asleep (optional)'), title: t('Day of falling asleep (optional)') }); f.appendChild(dd); }
      f.appendChild(btn('＋', function () {}, 'is-small is-main')).setAttribute('type', 'submit');
      f.addEventListener('submit', function (e) { e.preventDefault(); var v = nm.value.trim(); if (!v) return; N[g[0]].push({ n: v, d: dd && dd.value ? dd.value : '' }); save(); route(); });
      p.appendChild(f);
    });
  }

  /* ======================= THANKSGIVING JOURNAL ======================= */
  var THANKS_VERSES = [['Psalm 118:1', 'PSA', 118, 1], ['1 Thessalonians 5:18', '1TH', 5, 18], ['Psalm 103:2', 'PSA', 103, 2], ['Colossians 3:15', 'COL', 3, 15], ['Psalm 100:4', 'PSA', 100, 4], ['James 1:17', 'JAS', 1, 17], ['Philippians 4:6', 'PHP', 4, 6]];
  var THANKS_KJV = {
    'Psalm 118:1': 'O give thanks unto the LORD; for he is good: because his mercy endureth for ever.',
    '1 Thessalonians 5:18': 'In every thing give thanks: for this is the will of God in Christ Jesus concerning you.',
    'Psalm 103:2': 'Bless the LORD, O my soul, and forget not all his benefits.',
    'Colossians 3:15': 'And let the peace of God rule in your hearts, to the which also ye are called in one body; and be ye thankful.',
    'Psalm 100:4': 'Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name.',
    'James 1:17': 'Every good gift and every perfect gift is from above, and cometh down from the Father of lights.',
    'Philippians 4:6': 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.'
  };
  function thanks(p) {
    var J = S.thanks || (S.thanks = {});
    var today = iso(), v = THANKS_VERSES[day(today).getDate() % THANKS_VERSES.length];
    var vb = p.appendChild(el('blockquote', { cls: 'kt-verse' }));
    if (LANG === 'en') { vb.appendChild(el('p', { text: THANKS_KJV[v[0]] })); }
    vb.appendChild(el('cite', { text: v[0] }));
    var box = el('textarea', { rows: '3', maxlength: '500', placeholder: t('Today I thank God for…') }); box.value = J[today] || '';
    box.addEventListener('input', function () { if (box.value.trim()) J[today] = box.value; else delete J[today]; save(); });
    p.appendChild(el('label', { cls: 'kt-label', text: fmt(today) })); p.appendChild(box);
    var keys = Object.keys(J).filter(function (k) { return k !== today; }).sort().reverse();
    var month = today.slice(0, 7), count = Object.keys(J).filter(function (k) { return k.slice(0, 7) === month; }).length;
    p.appendChild(el('p', { cls: 'kt-sub', text: '🙏 ' + count + ' ' + t('days of thanks this month') }));
    keys.slice(0, 60).forEach(function (k) { p.appendChild(el('div', { cls: 'kt-entry' }, [el('b', { text: fmt(k, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) }), el('p', { text: J[k] })])); });
  }

  /* ======================= FASTING HELPER ======================= */
  var FAST_KINDS = [   // matched on the calendar's words in each language (the website's own wording)
    { k: 'none', test: /^$/, icon: '🥳', name: 'No fasting', what: 'All foods are allowed. A day of joy.' },
    { k: 'fish', test: /fish|ιχθύος|рыба|pescado|poisson|isda|मछली|鱼|السمك/i, icon: '🐟', name: 'Fish allowed', what: 'No meat, eggs or milk foods. Fish, oil and wine are allowed.' },
    { k: 'oil', test: /oil|ελαίου|елей|aceite|huile|langis|तेल|油|الزيت/i, icon: '🫒', name: 'Oil and wine', what: 'No meat, fish, eggs or milk foods. Olive oil and wine are allowed.' },
    { k: 'dairy', test: /meat fast|κρέας|без мяса|sin carne|sans viande|walang karne|मांस|戒肉|اللحم/i, icon: '🧀', name: 'No meat', what: 'No meat. Eggs, milk foods and fish are allowed.' },
    { k: 'strict', test: /./, icon: '🍞', name: 'Fast', what: 'No meat, fish, eggs or milk foods; no oil or wine on strict days.' }
  ];
  var MEALS = {
    none: ['Any good family meal, eaten with thanks'],
    fish: ['Baked fish with lemon and potatoes', 'Fish soup with vegetables', 'Rice with prawns and peppers'],
    oil: ['Lentil soup with olive oil', 'Beans in tomato sauce (fasolakia)', 'Pasta with vegetables and olive oil', 'Hummus with bread and salad', 'Stuffed peppers with rice'],
    dairy: ['An omelette with vegetables', 'Pasta with cheese', 'Rice pudding'],
    strict: ['Bread, fruit and nuts (no oil)', 'Boiled vegetables and rice, no oil', 'Lentils boiled with herbs, no oil', 'Fresh salad with lemon (no oil)']
  };
  function fasting(p) {
    var today = iso(), out = p.appendChild(el('div', { cls: 'kt-fast' }, [el('p', { cls: 'kt-sub', text: t('Looking at the Church calendar…') })]));
    churchDays(function (D) {
      clear(out);
      for (var i = 0; i < 3; i++) {
        var ds = add(today, i), d = D[ds], f = d ? (d.fast || '') : null;
        var kind = f === null ? null : f === '' ? FAST_KINDS[0] : (FAST_KINDS.filter(function (k) { return k.k !== 'none' && k.test.test(f); })[0] || FAST_KINDS[4]);
        var c = out.appendChild(el('section', { cls: 'kt-routine' }));
        c.appendChild(el('b', { text: (i === 0 ? t('Today') : i === 1 ? t('Tomorrow') : fmt(ds, { weekday: 'long' })) + ' · ' + fmt(ds, { day: 'numeric', month: 'long' }) }));
        if (!kind) { c.appendChild(el('p', { cls: 'kt-sub', text: t('The Church calendar could not be read (internet?).') })); continue; }
        if (d && d.feast) c.appendChild(el('div', { cls: 'kt-church', text: '✦ ' + d.feast }));
        c.appendChild(el('div', { cls: 'kt-fast-k', text: kind.icon + ' ' + t(kind.name) + (f ? ' · ' + f : '') }));
        c.appendChild(el('p', { text: t(kind.what) }));
        if (i === 0) {
          c.appendChild(el('p', { cls: 'kt-sub', text: t('Ideas for meals:') }));
          var ul = c.appendChild(el('ul'));
          MEALS[kind.k].forEach(function (m) { ul.appendChild(el('li', { text: t(m) })); });
        }
      }
      out.appendChild(el('p', { cls: 'kt-note', text: t('Fasting is for the soul: with prayer, almsgiving and kindness. Children, the sick, the elderly and mothers follow a lighter rule; your spiritual father sets your own.') }));
    });
  }

  route();
})();
