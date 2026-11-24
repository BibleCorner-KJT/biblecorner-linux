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
  function churchLine(d) {
    if (!d) return null;
    var bits = [];
    if (d.feast) bits.push('✦ ' + d.feast);
    if (d.fast) bits.push('🍃 ' + d.fast);
    return bits.length ? el('div', { cls: 'kt-church', text: bits.join(' · ') }) : null;
  }

  /* ---------- the tools ---------- */
  var TOOLS = [
    { k: 'agenda', icon: '🎒', name: 'My Agenda', sub: 'My day, homework, the week and stars (for children)' },
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

  /* ======================= MY AGENDA (children) ======================= */
  function A() {
    if (!S.agenda) {
      S.agenda = { routines: defaultRoutines(), ticks: {}, tasks: [], events: [], stars: 0, starDays: {}, plan: {}, review: {}, pin: '' };
      save();
    }
    return S.agenda;
  }
  function defaultRoutines() {
    function r(name, icon, when, steps) { return { id: id(), name: name, icon: icon, when: when, steps: steps.map(function (s) { return { id: id(), t: s[1], icon: s[0] }; }) }; }
    return [
      r('Getting ready', '🌅', 'morning', [['🙏', 'Morning prayers'], ['🪥', 'Wash and brush teeth'], ['👕', 'Get dressed'], ['🥣', 'Breakfast'], ['🎒', 'Take my bag']]),
      r('After school', '🏠', 'afternoon', [['🍎', 'A snack'], ['📚', 'Homework'], ['🧸', 'Tidy my things'], ['🤸', 'Play outside']]),
      r('Bedtime', '🌙', 'evening', [['🛁', 'Bath or wash'], ['🎒', 'Pack my bag for tomorrow'], ['📖', 'A Bible story'], ['🕯️', 'Evening prayers'], ['😴', 'Sleep']])
    ];
  }
  var SUBJECTS = [['📐', 'Maths'], ['📖', 'Reading'], ['✏️', 'Writing'], ['🔬', 'Science'], ['🌍', 'Geography'], ['🏛️', 'History'], ['🗣️', 'Languages'], ['🎨', 'Art'], ['🎵', 'Music'], ['⚽', 'Sport'], ['☦️', 'Religion'], ['📝', 'Other']];
  var BADGES = [[5, '🌱', 'Little seed'], [15, '⭐', 'Shining star'], [30, '🏅', 'Faithful helper'], [60, '🏆', 'Great organiser'], [100, '👑', 'Champion of good habits']];

  function agenda(body) {
    var a = A(), tabs = [['day', '☀️', 'My day'], ['work', '📚', 'Homework'], ['week', '📅', 'My week'], ['stars', '⭐', 'Stars'], ['set', '⚙️', 'Grown-ups']];
    var cur = S.agendaTab || 'day';
    var bar = body.appendChild(el('div', { cls: 'kt-tabs', role: 'tablist' }));
    var pane = body.appendChild(el('div', { cls: 'kt-pane' }));
    function show(k) {
      cur = k; S.agendaTab = k; save();
      Array.prototype.forEach.call(bar.children, function (b) { b.setAttribute('aria-selected', b.getAttribute('data-k') === k ? 'true' : 'false'); });
      clear(pane);
      ({ day: myDay, work: homework, week: week, stars: stars, set: grownups })[k](pane, a, show);
    }
    tabs.forEach(function (x) { bar.appendChild(el('button', { type: 'button', role: 'tab', 'data-k': x[0], cls: 'kt-tab', on: { click: function () { show(x[0]); } } }, [el('span', { text: x[1] }), el('small', { text: t(x[2]) })])); });
    show(cur);
  }

  function myDay(p, a, show) {
    var today = iso();
    p.appendChild(el('div', { cls: 'kt-date', text: fmt(today) }));
    var ch = p.appendChild(el('div'));
    churchDays(function (D) { var l = churchLine(D[today]); if (l) ch.appendChild(l); });
    var ticks = a.ticks[today] || (a.ticks[today] = {});
    // keep only two weeks of ticks
    Object.keys(a.ticks).forEach(function (k) { if (k < add(today, -14)) delete a.ticks[k]; });
    var h = new Date().getHours();
    var order = h < 12 ? ['morning', 'afternoon', 'evening'] : h < 17 ? ['afternoon', 'evening', 'morning'] : ['evening', 'morning', 'afternoon'];
    order.forEach(function (when) {
      a.routines.filter(function (r) { return r.when === when; }).forEach(function (r) { p.appendChild(routineCard(r, ticks, a, today)); });
    });
    // homework for today (and late)
    var due = a.tasks.filter(function (x) { return !x.done && x.due <= today; });
    if (due.length) {
      p.appendChild(el('h3', { text: '📚 ' + t('Homework for today') }));
      due.forEach(function (x) { p.appendChild(taskRow(x, a, function () { show('day'); })); });
    }
    var ev = a.events.filter(function (e) { return e.date === today; });
    if (ev.length) { p.appendChild(el('h3', { text: '📌 ' + t('Today') })); ev.forEach(function (e) { p.appendChild(el('div', { cls: 'kt-row', text: (e.time ? e.time + ' · ' : '') + e.t })); }); }
    p.appendChild(planTomorrow(a, today));
  }

  function routineCard(r, ticks, a, today) {
    var done = r.steps.filter(function (s) { return ticks[s.id]; }).length;
    var c = el('section', { cls: 'kt-routine' + (done === r.steps.length && r.steps.length ? ' is-done' : '') });
    c.appendChild(el('div', { cls: 'kt-routine-h' }, [el('b', { text: r.icon + ' ' + t(r.name) }), el('span', { cls: 'kt-count', text: done + ' / ' + r.steps.length })]));
    c.appendChild(el('div', { cls: 'kt-progress' }, [el('i', { style: 'width:' + (r.steps.length ? Math.round(100 * done / r.steps.length) : 0) + '%' })]));
    var g = c.appendChild(el('div', { cls: 'kt-steps' }));
    r.steps.forEach(function (s) {
      g.appendChild(el('button', { type: 'button', cls: 'kt-step' + (ticks[s.id] ? ' is-on' : ''), 'aria-pressed': ticks[s.id] ? 'true' : 'false', on: { click: function () {
        ticks[s.id] = !ticks[s.id]; buzz(20);
        var all = r.steps.every(function (x) { return ticks[x.id]; });
        var sd = a.starDays[today] || (a.starDays[today] = {});
        if (all && !sd[r.id]) { sd[r.id] = 1; a.stars++; say('⭐ ' + t('Well done! A new star.')); }
        save(); var n = routineCard(r, ticks, a, today); c.replaceWith(n);
      } } }, [el('span', { cls: 'kt-step-i', text: s.icon }), el('span', { text: t(s.t) })]));
    });
    return c;
  }

  function planTomorrow(a, today) {
    var tm = add(today, 1), box = el('section', { cls: 'kt-plan' });
    box.appendChild(el('h3', { text: '🌙 ' + t('Plan tomorrow tonight') }));
    box.appendChild(el('div', { cls: 'kt-sub', text: fmt(tm) }));
    var ch = box.appendChild(el('div'));
    churchDays(function (D) { var l = churchLine(D[tm]); if (l) ch.appendChild(l); });
    var tasks = a.tasks.filter(function (x) { return !x.done && x.due === tm; }), ev = a.events.filter(function (e) { return e.date === tm; });
    if (!tasks.length && !ev.length) box.appendChild(el('p', { cls: 'kt-sub', text: t('Nothing written for tomorrow yet.') }));
    ev.forEach(function (e) { box.appendChild(el('div', { cls: 'kt-row', text: '📌 ' + (e.time ? e.time + ' · ' : '') + e.t })); });
    tasks.forEach(function (x) { box.appendChild(el('div', { cls: 'kt-row', text: '📚 ' + x.t })); });
    var pl = a.plan[tm] || (a.plan[tm] = {});
    Object.keys(a.plan).forEach(function (k) { if (k < today) delete a.plan[k]; });
    [['bag', '🎒', 'My bag is packed'], ['clothes', '👕', 'My clothes are ready'], ['homework', '📚', 'My homework is done']].forEach(function (x) {
      var cb = el('input', { type: 'checkbox' }); cb.checked = !!pl[x[0]];
      cb.addEventListener('change', function () { pl[x[0]] = cb.checked; save(); });
      box.appendChild(el('label', { cls: 'kt-check' }, [cb, ' ' + x[1] + ' ' + t(x[2])]));
    });
    return box;
  }

  function taskRow(x, a, redraw) {
    var row = el('div', { cls: 'kt-task' + (x.done ? ' is-done' : '') });
    var cb = el('input', { type: 'checkbox', 'aria-label': t('Done') }); cb.checked = !!x.done;
    cb.addEventListener('change', function () {
      x.done = cb.checked;
      if (x.done) { a.stars++; say('⭐ ' + t('Well done! A new star.')); }
      else a.stars = Math.max(0, a.stars - 1);
      save(); redraw();
    });
    var info = el('div', { cls: 'kt-task-t' }, [el('b', { text: (x.icon || '📝') + ' ' + x.t }),
      el('small', { text: dueWord(x.due) + (x.mins ? ' · ' + t('I think') + ' ' + x.mins + ' ' + t('min') : '') + (x.took ? ' · ' + t('it took') + ' ' + x.took + ' ' + t('min') : '') })]);
    row.appendChild(cb); row.appendChild(info);
    if (x.steps && x.steps.length) {
      var ul = el('ul', { cls: 'kt-substeps' });
      x.steps.forEach(function (s) { var c2 = el('input', { type: 'checkbox' }); c2.checked = !!s.done; c2.addEventListener('change', function () { s.done = c2.checked; save(); }); ul.appendChild(el('li', {}, [el('label', {}, [c2, ' ' + s.t])])); });
      info.appendChild(ul);
    }
    if (x.done && !x.took) {
      var tk = el('input', { type: 'number', min: '1', max: '600', cls: 'kt-mini', placeholder: t('min') });
      info.appendChild(el('div', { cls: 'kt-took' }, [t('How long did it take?') + ' ', tk, btn('OK', function () { var v = parseInt(tk.value, 10); if (v > 0) { x.took = v; save(); redraw(); } }, 'is-small')]));
    }
    row.appendChild(btn('✕', function () { a.tasks = a.tasks.filter(function (y) { return y !== x; }); save(); redraw(); }, 'is-ghost'));
    return row;
  }
  function dueWord(d) {
    var today = iso();
    if (d < today) return '⚠ ' + t('Late') + ' · ' + fmt(d, { weekday: 'short', day: 'numeric', month: 'short' });
    if (d === today) return t('Today');
    if (d === add(today, 1)) return t('Tomorrow');
    return fmt(d, { weekday: 'long', day: 'numeric', month: 'short' });
  }

  function homework(p, a, show) {
    var redraw = function () { show('work'); };
    var f = p.appendChild(el('form', { cls: 'kt-form' }));
    var what = el('input', { type: 'text', required: true, maxlength: '120', placeholder: t('What do I have to do?') });
    var subj = el('select', { 'aria-label': t('Subject') });
    SUBJECTS.forEach(function (s, i) { subj.appendChild(el('option', { value: i, text: s[0] + ' ' + t(s[1]) })); });
    var when = el('select', { 'aria-label': t('For when?') });
    [['0', 'Today'], ['1', 'Tomorrow'], ['2', 'In 2 days'], ['3', 'In 3 days'], ['7', 'In a week']].forEach(function (o) { when.appendChild(el('option', { value: o[0], text: t(o[1]) })); }); when.value = '1';
    var mins = el('input', { type: 'number', min: '1', max: '600', cls: 'kt-mini', placeholder: t('min') });
    var steps = el('textarea', { rows: '2', maxlength: '500', placeholder: t('Big task? Write small steps, one per line (optional)') });
    f.appendChild(what);
    f.appendChild(el('div', { cls: 'kt-line' }, [subj, when, el('label', { cls: 'kt-inline' }, [t('How long will it take?') + ' ', mins])]));
    f.appendChild(steps);
    f.appendChild(btn('＋ ' + t('Add'), function () {}, 'is-main')).setAttribute('type', 'submit');
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var w = what.value.trim(); if (!w) return;
      var s = SUBJECTS[+subj.value];
      a.tasks.push({ id: id(), t: w, icon: s[0], due: add(iso(), +when.value), mins: parseInt(mins.value, 10) || 0, done: false,
        steps: steps.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 12).map(function (x) { return { t: x, done: false }; }) });
      save(); redraw();
    });
    var today = iso(), groups = [['Late', function (x) { return !x.done && x.due < today; }], ['Today', function (x) { return !x.done && x.due === today; }], ['Tomorrow', function (x) { return !x.done && x.due === add(today, 1); }],
      ['This week', function (x) { return !x.done && x.due > add(today, 1) && x.due <= add(today, 7); }], ['Later', function (x) { return !x.done && x.due > add(today, 7); }], ['Done', function (x) { return x.done; }]];
    var any = false;
    groups.forEach(function (g) {
      var l = a.tasks.filter(g[1]).sort(function (x, y) { return x.due < y.due ? -1 : 1; }); if (!l.length) return; any = true;
      p.appendChild(el('h3', { text: t(g[0]) }));
      l.forEach(function (x) { p.appendChild(taskRow(x, a, redraw)); });
    });
    if (!any) p.appendChild(el('p', { cls: 'kt-sub', text: t('No homework written yet.') }));
    // finished homework older than a month is let go
    var old = add(today, -31); a.tasks = a.tasks.filter(function (x) { return !(x.done && x.due < old); });
  }

  function week(p, a, show) {
    var start = S.agendaWeek || iso(); var d0 = day(start); var wd = (d0.getDay() + 6) % 7; start = add(start, -wd);
    var nav = p.appendChild(el('div', { cls: 'kt-line kt-weeknav' }));
    nav.appendChild(btn('‹', function () { S.agendaWeek = add(start, -7); save(); show('week'); }, 'is-ghost'));
    nav.appendChild(el('b', { text: fmt(start, { day: 'numeric', month: 'short' }) + ' – ' + fmt(add(start, 6), { day: 'numeric', month: 'short', year: 'numeric' }) }));
    nav.appendChild(btn('›', function () { S.agendaWeek = add(start, 7); save(); show('week'); }, 'is-ghost'));
    if (S.agendaWeek) nav.appendChild(btn(t('This week'), function () { S.agendaWeek = ''; save(); show('week'); }, 'is-small'));
    var list = p.appendChild(el('div', { cls: 'kt-week' }));
    churchDays(function (D) {
      for (var i = 0; i < 7; i++) {
        var ds = add(start, i), c = el('div', { cls: 'kt-wday' + (ds === iso() ? ' is-today' : '') });
        c.appendChild(el('b', { text: fmt(ds, { weekday: 'long', day: 'numeric', month: 'short' }) }));
        var l = churchLine(D[ds]); if (l) c.appendChild(l);
        a.events.filter(function (e) { return e.date === ds; }).sort(function (x, y) { return (x.time || '') < (y.time || '') ? -1 : 1; }).forEach(function (e) {
          c.appendChild(el('div', { cls: 'kt-row' }, ['📌 ' + (e.time ? e.time + ' · ' : '') + e.t + ' ', btn('✕', function () { a.events = a.events.filter(function (y) { return y !== e; }); save(); show('week'); }, 'is-ghost is-small')]));
        });
        a.tasks.filter(function (x) { return x.due === ds && !x.done; }).forEach(function (x) { c.appendChild(el('div', { cls: 'kt-row', text: '📚 ' + x.t })); });
        list.appendChild(c);
      }
    });
    var f = p.appendChild(el('form', { cls: 'kt-form' }, [el('h3', { text: '📌 ' + t('Add something to my week') })]));
    var what = el('input', { type: 'text', required: true, maxlength: '100', placeholder: t('A birthday, a school trip, church on Sunday…') });
    var date = el('input', { type: 'date', required: true, value: iso() }), time = el('input', { type: 'time' });
    f.appendChild(what); f.appendChild(el('div', { cls: 'kt-line' }, [date, time]));
    f.appendChild(btn('＋ ' + t('Add'), function () {}, 'is-main')).setAttribute('type', 'submit');
    f.addEventListener('submit', function (e) { e.preventDefault(); if (!what.value.trim() || !date.value) return; a.events.push({ id: id(), t: what.value.trim(), date: date.value, time: time.value }); a.events = a.events.filter(function (x) { return x.date >= add(iso(), -60); }); save(); show('week'); });
  }

  function stars(p, a) {
    p.appendChild(el('div', { cls: 'kt-big', text: '⭐ ' + a.stars }));
    p.appendChild(el('p', { cls: 'kt-sub', text: t('A star for each finished routine and each finished homework.') }));
    var g = p.appendChild(el('div', { cls: 'kt-badges' }));
    BADGES.forEach(function (b) { g.appendChild(el('div', { cls: 'kt-badge' + (a.stars >= b[0] ? ' is-on' : '') }, [el('span', { text: b[1] }), el('b', { text: t(b[2]) }), el('small', { text: b[0] + ' ⭐' })])); });
    // the week's look back (on Sunday, or any day)
    var wk = add(iso(), -((new Date().getDay() + 6) % 7));
    var r = a.review[wk] || (a.review[wk] = { good: '', change: '' });
    p.appendChild(el('h3', { text: '🔁 ' + t('Looking back at my week') }));
    var good = el('textarea', { rows: '2', maxlength: '400', placeholder: t('What went well this week?') }); good.value = r.good;
    var chg = el('textarea', { rows: '2', maxlength: '400', placeholder: t('What will I do better next week?') }); chg.value = r.change;
    good.addEventListener('input', function () { r.good = good.value; save(); }); chg.addEventListener('input', function () { r.change = chg.value; save(); });
    p.appendChild(good); p.appendChild(chg);
    p.appendChild(el('p', { cls: 'kt-prayer', text: t('Thank You, Lord, for this week. Help me to do my work well and to be kind to everyone. Amen.') }));
  }

  function grownups(p, a, show) {
    function unlocked(go) {
      if (!a.pin) return go();
      var f = el('form', { cls: 'kt-form' }, [el('p', { text: '🔒 ' + t('For grown-ups: write the PIN') })]);
      var pin = el('input', { type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'off' }); f.appendChild(pin); f.appendChild(btn('OK', function () {}, 'is-main')).setAttribute('type', 'submit');
      f.addEventListener('submit', function (e) { e.preventDefault(); if (pin.value === a.pin) { clear(p); go(); } else say(t('That PIN is not right.')); });
      p.appendChild(f);
    }
    unlocked(function () {
      p.appendChild(el('p', { cls: 'kt-sub', text: t('Change the routines here. A PIN keeps these changes for grown-ups.') }));
      a.routines.forEach(function (r) {
        var box = p.appendChild(el('section', { cls: 'kt-routine' }));
        var nm = el('input', { type: 'text', maxlength: '40', value: t(r.name) }); nm.addEventListener('change', function () { r.name = nm.value.trim() || r.name; save(); });
        var wh = el('select'); [['morning', '🌅 Morning'], ['afternoon', '🏠 Afternoon'], ['evening', '🌙 Evening']].forEach(function (o) { wh.appendChild(el('option', { value: o[0], text: o[1].split(' ')[0] + ' ' + t(o[1].split(' ')[1]) })); }); wh.value = r.when;
        wh.addEventListener('change', function () { r.when = wh.value; save(); });
        box.appendChild(el('div', { cls: 'kt-line' }, [el('span', { cls: 'kt-step-i', text: r.icon }), nm, wh, btn('🗑', function () { a.routines = a.routines.filter(function (x) { return x !== r; }); save(); show('set'); }, 'is-ghost')]));
        r.steps.forEach(function (s) {
          var st = el('input', { type: 'text', maxlength: '40', value: t(s.t) }); st.addEventListener('change', function () { s.t = st.value.trim() || s.t; save(); });
          var ic = el('input', { type: 'text', maxlength: '4', cls: 'kt-mini', value: s.icon }); ic.addEventListener('change', function () { s.icon = ic.value.trim() || '✔️'; save(); });
          box.appendChild(el('div', { cls: 'kt-line' }, [ic, st, btn('✕', function () { r.steps = r.steps.filter(function (x) { return x !== s; }); save(); show('set'); }, 'is-ghost is-small')]));
        });
        box.appendChild(btn('＋ ' + t('Add a step'), function () { r.steps.push({ id: id(), t: t('New step'), icon: '✔️' }); save(); show('set'); }, 'is-small'));
      });
      p.appendChild(btn('＋ ' + t('Add a routine'), function () { a.routines.push({ id: id(), name: t('My routine'), icon: '⭐', when: 'afternoon', steps: [] }); save(); show('set'); }));
      p.appendChild(btn('↺ ' + t('Back to the first routines'), function () { if (window.confirm ? confirm(t('Put back the first routines?')) : true) { a.routines = defaultRoutines(); save(); show('set'); } }, 'is-ghost'));
      p.appendChild(el('h3', { text: '🔒 PIN' }));
      var np = el('input', { type: 'password', inputmode: 'numeric', maxlength: '8', autocomplete: 'off', placeholder: a.pin ? t('A new PIN (empty: no PIN)') : t('A PIN for grown-ups (optional)') });
      p.appendChild(el('div', { cls: 'kt-line' }, [np, btn(t('Save'), function () { a.pin = np.value.trim(); save(); say(a.pin ? t('The PIN is kept.') : t('No PIN now.')); }, 'is-small')]));
      p.appendChild(el('p', { cls: 'kt-note', text: t('Everything in My Agenda stays on this device. Nothing is sent to the website.') }));
    });
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
