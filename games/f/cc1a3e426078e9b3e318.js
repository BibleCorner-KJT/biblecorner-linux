/* KJT Kids Corner - Achievements (Site Core 5.6.0)
   One place that counts everything a child does on Kids Corner, and turns it
   into stars, a level and badges:
     - 3 stars per activity (shown on every activity card and in its top bar)
     - a level from the total stars (Little Lamb ... Champion of Faith)
     - 20 badges to unlock, with a pop-up when a new one is earned
   It reads what activities already remember (trail stops, story endings,
   game trophies, daily streak) and listens for small "kjt-achieve" events
   from the others (prayers, riddles, verses practised, pictures coloured,
   activity visits). Everything is kept on this device only. */
(function () {
  'use strict';
  var KEY = 'kjt_achieve_v1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} }
  function get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function today() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  var data = load();
  data.counts = data.counts || {}; data.sets = data.sets || {}; data.days = data.days || {}; data.earned = data.earned || {};

  /* ---------- recording (other scripts send: kjt-achieve {type, key}) ---------- */
  function record(type, key) {
    if (type === 'visit') { data.days[key] = data.days[key] || {}; data.days[key][today()] = 1; data.days.kids = data.days.kids || {}; data.days.kids[today()] = 1; }
    else if (key != null && key !== '') { data.sets[type] = data.sets[type] || {}; data.sets[type][key] = (data.sets[type][key] || 0) + 1; }
    else data.counts[type] = (data.counts[type] || 0) + 1;
    save(data); schedule();
  }
  window.addEventListener('kjt-achieve', function (e) { var d = e.detail || {}; if (d.type) record(d.type, d.key); });
  window.addEventListener('kjt-activity-shown', function (e) { if (e.detail && e.detail !== 'home') record('visit', e.detail); });
  window.addEventListener('kjt-trail-progress', function () { schedule(); });
  window.KJTAchieve = { record: record };

  /* ---------- what counts ---------- */
  function jsonEl(id) { var n = document.getElementById(id); if (!n) return null; try { return JSON.parse(n.textContent); } catch (e) { return null; } }
  function measure() {
    var m = {}, trail = get('kjt_trail_v1') || {}, tdata = jsonEl('kjt-trail-data');
    m.stops = Object.keys(trail).filter(function (k) { return trail[k] && trail[k].grow; }).length;
    m.trailsDone = 0; m.allStops = 0;
    if (tdata && tdata.trails) tdata.trails.forEach(function (t) { var n = t.stops.length, d = t.stops.filter(function (s) { return trail[s.slug] && trail[s.slug].grow; }).length; m.allStops += n; if (n && d === n) m.trailsDone++; });
    m.verses = Object.keys(data.sets.verse || {}).length;
    var st = get('kjt_stories_v1') || {}, sdata = jsonEl('kjt-stories-data'), types = {};
    if (sdata && sdata.stories) sdata.stories.forEach(function (s) { Object.keys(s.scenes).forEach(function (k) { if (s.scenes[k].end) types[s.id + ':' + k] = s.scenes[k].end.type; }); });
    m.endings = 0; m.learned = 0; m.missed = 0; m.storyComplete = 0;
    Object.keys(st).forEach(function (id) { var e = st[id].endings || []; m.endings += e.length; e.forEach(function (k) { var t = types[id + ':' + k]; if (t === 'learn') m.learned++; if (t === 'missed') m.missed++; }); if (sdata) { var s = sdata.stories.filter(function (x) { return x.id === id; })[0]; if (s) { var all = Object.keys(s.scenes).filter(function (k) { return s.scenes[k].end; }).length; if (all && e.length >= all) m.storyComplete++; } } });
    var tr = get('kjt_games_trophies') || {}; m.trophyPoints = 0; m.golds = 0; m.gamesWon = 0;
    Object.keys(tr).forEach(function (k) { m.trophyPoints += tr[k]; if (tr[k] >= 3) m.golds++; if (tr[k]) m.gamesWon++; });
    var daily = get('kjt_games_daily') || {}, n = Math.floor(Date.now() / 86400000), best = 0, run = 0;
    for (var i = n - 60; i <= n; i++) { if (daily[i]) { run++; best = Math.max(best, run); } else run = 0; }
    m.dailyBest = best; m.dailyDone = Object.keys(daily).length;
    /* 7.9.0: Bible Adventures: chapters finished */
    var adv = get('kjt_adventures_v1') || {}; m.adventure = 0; Object.keys(adv).forEach(function (k) { m.adventure += ((adv[k] || {}).done || []).length; });
    m.riddles = data.counts.riddle || 0; m.prayers = data.counts.prayer || 0;
    m.pictures = Object.keys(data.sets.picture || {}).length;
    function days(k) { return Object.keys(data.days[k] || {}).length; }
    m.kidsDays = days('kids');
    /* 5.9.0: real reading in My Little Bible (chapters read, reading days, streak, books finished) */
    var kr = get('kjt_kids_reading') || {}, ks = kr.sum || {}; m.readDays = Object.keys(kr.days || {}).length; m.kidsChapters = Object.keys(kr.read || {}).length; m.kidsStreak = +ks.best || 0; m.kidsBooks = (ks.books || []).length;
    var kb = (get('kjt_kids_bookmarks') || {}).items || {}; m.kidsBookmarks = Object.keys(kb).filter(function (k) { return !kb[k].del; }).length;
    /* 5.8.0: the Holy Bible page (signed in with the Pilgrim Key) */
    m.visited = ['bible', 'trail', 'stories', 'games', 'whoami', 'colouring', 'prayer'].filter(function (a) { return days(a) > 0; }).length;
    return m;
  }
  /* 3 stars per activity */
  var STARS = {
    bible: { label: 'My Little Bible', value: function (m) { return m.readDays; }, at: [1, 3, 7], unit: ['reading day', 'reading days'] },
    trail: { label: 'Bible Trail & Verse Garden', value: function (m) { return m.stops + m.verses; }, at: [1, 8, 20], unit: ['stop finished or verse practised', 'stops finished and verses practised'] },
    stories: { label: 'Story Adventures', value: function (m) { return m.endings + m.adventure; }, at: [1, 10, 30], unit: ['ending found', 'endings found'] },
    games: { label: 'Bible Games', value: function (m) { return m.trophyPoints; }, at: [1, 10, 25], unit: ['trophy point', 'trophy points'] },
    whoami: { label: 'Who Am I?', value: function (m) { return m.riddles; }, at: [3, 15, 40], unit: ['riddle solved', 'riddles solved'] },
    colouring: { label: 'Colouring pages', value: function (m) { return m.pictures; }, at: [1, 4, 10], unit: ['picture coloured', 'pictures coloured'] },
    prayer: { label: 'Prayer Garden', value: function (m) { return m.prayers; }, at: [1, 7, 21], unit: ['prayer said', 'prayers said'] },
    study: { label: 'Bible chapters', value: function (m) { return m.kidsChapters; }, at: [1, 10, 30], unit: ['chapter read', 'chapters read'], link: true }
  };
  function starsOf(id, m) { var s = STARS[id]; if (!s) return 0; var v = s.value(m); return s.at.filter(function (t) { return v >= t; }).length; }
  var LEVELS = [[0, '\ud83d\udc11', 'Little Lamb'], [3, '\ud83e\udd7e', 'Young Pilgrim'], [6, '\ud83e\udded', 'Bible Explorer'], [10, '\ud83d\ude4c', 'Faithful Helper'], [13, '\u2626\ufe0f', 'Friend of the Saints'], [17, '\ud83e\ude94', 'Lamp Bearer'], [21, '\ud83c\udfc6', 'Champion of Faith']];
  var BADGES = [
    ['first-steps', '\ud83d\udc63', 'First Steps', 'Finish your first Bible Trail stop', function (m) { return m.stops >= 1; }],
    ['trail-walker', '\ud83e\udd7e', 'Trail Walker', 'Finish every stop on one trail', function (m) { return m.trailsDone >= 1; }],
    ['pilgrim', '\ud83c\udf1f', 'Pilgrim', 'Finish every stop on every trail', function (m) { return m.allStops > 0 && m.stops >= m.allStops; }],
    ['gardener', '\ud83c\udf37', 'Gardener', 'Practise 5 memory verses in the Verse Garden', function (m) { return m.verses >= 5; }],
    ['storyteller', '\ud83d\udcdc', 'Storyteller', 'Reach the end of a Story Adventure', function (m) { return m.endings >= 1; }],
    ['path-finder', '\ud83e\udded', 'Path Finder', 'Find 15 story endings', function (m) { return m.endings >= 15; }],
    ['never-too-late', '\ud83c\udf31', 'Never Too Late', 'Find a "lesson learned" ending', function (m) { return m.learned >= 1; }],
    ['every-path', '\ud83d\uddfa\ufe0f', 'Every Path', 'Find every ending of one story', function (m) { return m.storyComplete >= 1; }],
    ['game-on', '\ud83c\udfae', 'Game On', 'Win your first game trophy', function (m) { return m.trophyPoints >= 1; }],
    ['gold', '\ud83e\udd47', 'Gold Medal', 'Win a gold trophy (Hard level)', function (m) { return m.golds >= 1; }],
    ['collector', '\ud83c\udfc6', 'Trophy Collector', 'Win trophies in 8 different games', function (m) { return m.gamesWon >= 8; }],
    ['daily-faithful', '\ud83d\udcc5', 'Daily Faithful', 'Complete the Daily Challenge 3 days in a row', function (m) { return m.dailyBest >= 3; }],
    ['riddler', '\u2753', 'Riddle Solver', 'Solve 10 Who Am I? riddles', function (m) { return m.riddles >= 10; }],
    ['artist', '\ud83c\udfa8', 'Little Artist', 'Colour your first picture', function (m) { return m.pictures >= 1; }],
    ['gallery', '\ud83d\uddbc\ufe0f', 'Gallery Maker', 'Colour 5 different pictures', function (m) { return m.pictures >= 5; }],
    ['prayerful', '\ud83d\ude4f', 'Faithful in Prayer', 'Say 7 prayers in the Prayer Garden', function (m) { return m.prayers >= 7; }],
    ['reader', '\ud83d\udcd6', 'Bible Reader', 'Read My Little Bible on 3 different days', function (m) { return m.readDays >= 3; }],
    ['all-rounder', '\ud83c\udf08', 'All-Rounder', 'Try every activity on Kids Corner', function (m) { return m.visited >= 7; }],
    ['faithful-week', '\ud83d\udd6f\ufe0f', 'Faithful Week', 'Visit Kids Corner on 7 different days', function (m) { return m.kidsDays >= 7; }],
    ['first-chapter', '\ud83d\udcd6', 'First Chapter', 'Read your first chapter in My Little Bible', function (m) { return m.kidsChapters >= 1; }],
    ['bible-week', '\ud83d\udd25', 'Bible Week', 'Read My Little Bible 7 days in a row', function (m) { return m.kidsStreak >= 7; }],
    ['book-finished', '\ud83c\udfc6', 'Whole Book', 'Read every chapter of a book of the Bible', function (m) { return m.kidsBooks >= 1; }],
    ['kid-bookmark', '\ud83d\udd16', 'First Bookmark', 'Bookmark a verse in My Little Bible', function (m) { return m.kidsBookmarks >= 1; }]
  ];
  function summary() {
    var m = measure(), stars = {}, total = 0;
    Object.keys(STARS).forEach(function (k) { stars[k] = starsOf(k, m); total += stars[k]; });
    var lvl = LEVELS[0], next = null;
    for (var i = 0; i < LEVELS.length; i++) { if (total >= LEVELS[i][0]) { lvl = LEVELS[i]; next = LEVELS[i + 1] || null; } }
    var badges = BADGES.map(function (b) { return { id: b[0], icon: b[1], name: b[2], how: b[3], got: !!b[4](m) }; });
    return { m: m, stars: stars, total: total, max: Object.keys(STARS).length * 3, level: lvl, next: next, badges: badges };
  }

  /* ---------- display ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { var v = attrs[k]; if (v == null || v === false) return; if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v; else if (k === 'style') n.style.cssText = v; else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v); });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function starText(n) { return '\u2605'.repeat(n) + '\u2606'.repeat(3 - n); }
  var panel = null, open = false;
  function drawPanel(S) {
    var host = document.querySelector('.kk-hub') || document.getElementById('categories');
    if (!host) return;
    if (!panel) {
      panel = el('section', { class: 'ka-panel', 'aria-label': 'My achievements' });
      var mine = host.querySelector('.kk-me__ach'), slot = host.querySelector('.kk-continue-slot');
      if (mine) mine.appendChild(panel); /* 7.3.0: inside My Pilgrim Corner */
      else if (slot) slot.parentNode.insertBefore(panel, slot.nextSibling); else host.insertBefore(panel, host.firstChild);
    }
    panel.innerHTML = '';
    var pct = S.next ? Math.round((S.total - S.level[0]) / (S.next[0] - S.level[0]) * 100) : 100, got = S.badges.filter(function (b) { return b.got; });
    panel.appendChild(el('div', { class: 'ka-top' }, [
      el('span', { class: 'ka-level-icon', text: S.level[1], 'aria-hidden': 'true' }),
      el('div', { class: 'ka-level' }, [
        el('small', { text: '\ud83c\udfc5 My achievements' }),
        el('strong', { text: S.level[2] }),
        el('div', { class: 'ka-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) }, [el('span', { style: 'width:' + pct + '%' })]),
        el('span', { class: 'ka-sub', text: '\u2b50 ' + S.total + ' of ' + S.max + ' stars' + (S.next ? ' \u00b7 ' + (S.next[0] - S.total) + ' more to become ' + S.next[1] + ' ' + S.next[2] : ' \u00b7 the highest level!') + ' \u00b7 \ud83c\udfc5 ' + got.length + ' of ' + S.badges.length + ' badges' })
      ]),
el('button', { class: 'ka-toggle ka-report', type: 'button', text: '\ud83d\udda8\ufe0f Report', title: 'Progress report for parents', onclick: function () { report(); } }),
      el('button', { class: 'ka-toggle', type: 'button', 'aria-expanded': open ? 'true' : 'false', text: open ? 'Hide' : 'See all', onclick: function () { open = !open; drawPanel(summary()); } })
    ]));
    var row = el('div', { class: 'ka-badges' });
    S.badges.forEach(function (b) { row.appendChild(el('span', { class: 'ka-badge' + (b.got ? ' got' : ''), title: b.name + ': ' + b.how, 'aria-label': b.name + (b.got ? ' (earned)' : ' (not yet earned): ' + b.how), text: b.got ? b.icon : '\ud83d\udd12' })); });
    panel.appendChild(row);
    if (open) {
      var grid = el('div', { class: 'ka-grid' });
      Object.keys(STARS).forEach(function (k) { var s = STARS[k], v = s.value(S.m), n = S.stars[k], nextAt = s.at[n]; grid.appendChild(el('div', { class: 'ka-item' }, [el('strong', { text: s.label }), el('span', { class: 'ka-stars', text: starText(n) }), el('small', { text: v + ' ' + s.unit[v === 1 ? 0 : 1] + (nextAt ? ' \u00b7 next star at ' + nextAt : ' \u00b7 all stars!') }), s.link ? el('a', { class: 'ka-link', href: '#kids-bible', text: '\ud83d\udcd6 Open My Little Bible \u2192' }) : null])); });
      panel.appendChild(el('h4', { class: 'ka-h', text: 'Stars for each activity' })); panel.appendChild(grid);
      var bl = el('div', { class: 'ka-grid' });
      S.badges.forEach(function (b) { bl.appendChild(el('div', { class: 'ka-item' + (b.got ? ' got' : '') }, [el('span', { class: 'ka-bicon', text: b.got ? b.icon : '\ud83d\udd12' }), el('strong', { text: b.name }), el('small', { text: b.how })])); });
      panel.appendChild(el('h4', { class: 'ka-h', text: 'Badges' })); panel.appendChild(bl);
    }
  }
  function drawCardStars(S) {
    document.querySelectorAll('a[data-kk-nav]').forEach(function (a) {
      var id = a.getAttribute('data-kk-nav'); if (!STARS[id] || a.classList.contains('kk-continue')) return;
      var s = a.querySelector('.ka-card-stars'); if (!s) { s = el('span', { class: 'ka-card-stars' }); a.appendChild(s); }
      s.textContent = starText(S.stars[id]); s.setAttribute('aria-label', S.stars[id] + ' of 3 stars'); s.classList.toggle('none', !S.stars[id]);
    });
    var bar = document.querySelector('.kk-focusbar'), cur = bar && !bar.hidden ? current : null;
    if (bar) { var fs = bar.querySelector('.ka-bar-stars'); if (!fs) { fs = el('span', { class: 'ka-bar-stars' }); var t = bar.querySelector('.kk-focusbar__title'); if (t) t.parentNode.insertBefore(fs, t.nextSibling); } fs.textContent = cur && STARS[cur] ? starText(S.stars[cur]) : ''; fs.title = cur && STARS[cur] ? STARS[cur].label + ': ' + S.stars[cur] + ' of 3 stars' : ''; }
  }
  var current = null;
  window.addEventListener('kjt-activity-shown', function (e) { current = e.detail === 'home' ? null : e.detail; schedule(); });

  /* ---------- pop-ups for anything newly earned ---------- */
  var toasts = [], showing = false;
  function toast(icon, title, text) { toasts.push([icon, title, text]); if (!showing) nextToast(); }
  function nextToast() {
    var t = toasts.shift(); if (!t) { showing = false; return; } showing = true;
    var n = el('div', { class: 'ka-toast', role: 'status' }, [el('span', { class: 'ka-toast__icon', text: t[0] }), el('span', {}, [el('strong', { text: t[1] }), el('small', { text: t[2] })])]);
    document.body.appendChild(n); if (window.KJTSound) window.KJTSound.play('success');
    setTimeout(function () { n.classList.add('in'); }, 20);
    setTimeout(function () { n.classList.remove('in'); setTimeout(function () { n.remove(); nextToast(); }, 400); }, 3200);
  }
  var timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(update, 250); }
  function update() {
    var S = summary(), first = !data.snap;
    if (!first) {
      Object.keys(S.stars).forEach(function (k) { if (S.stars[k] > (data.snap.stars[k] || 0)) toast('\u2b50', 'New star! ' + starText(S.stars[k]), STARS[k].label); });
      S.badges.forEach(function (b) { if (b.got && !data.earned[b.id]) toast(b.icon, 'New badge: ' + b.name, b.how); });
      if (S.level[2] !== data.snap.level) toast(S.level[1], 'You are now a ' + S.level[2] + '!', 'Keep reading, playing and praying.');
    }
    S.badges.forEach(function (b) { if (b.got && !data.earned[b.id]) data.earned[b.id] = today(); });
    data.snap = { stars: S.stars, level: S.level[2] }; save(data);
    drawPanel(S); drawCardStars(S);
  }
  /* 5.9.0: a printable progress report for parents (nothing is sent anywhere; the name is not saved) */
  function report() {
    var name = window.prompt('Child\u2019s name for the top of the report (optional, not saved):', '') ;
    /* 7.8.5: no bad language in the name */
    while (name && window.KJTNameFilter && !window.KJTNameFilter.ok(name)) name = window.prompt(window.KJTNameFilter.message + '\n\nChild\u2019s name (optional):', '');
    if (name === null) return;
    var S = summary(), kr = get('kjt_kids_reading') || {}, read = kr.read || {}, days = kr.days || {}, B = window.KJT_KIDS_BIBLE_BOOKS || [];
    var esc = function (v) { return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var star = function (n) { return '\u2605\u2605\u2605'.slice(0, n) + '\u2606\u2606\u2606'.slice(0, 3 - n); };
    var h = '<!doctype html><html><head><meta charset="utf-8"><title>Kids Corner progress report</title><style>@page{size:A4;margin:14mm}body{font:11pt/1.5 Georgia,serif;color:#1d1a22;margin:0}h1{font-size:20pt;color:#3e093f;margin:0}h2{font-size:13pt;color:#0f5d66;border-bottom:1px solid #cfdede;margin:6mm 0 2mm;padding-bottom:1mm}.sub{color:#6b5a74;margin:1mm 0 4mm}table{width:100%;border-collapse:collapse;font-size:10pt}td,th{border-bottom:1px solid #eee;padding:1.2mm 2mm;text-align:left}th{color:#0f5d66}.stars{color:#c99a00;font-size:12pt;letter-spacing:1px}.big{display:inline-block;margin:0 6mm 2mm 0}.big b{display:block;font-size:18pt;color:#3e093f}.badges span{display:inline-block;margin:0 2mm 2mm 0;padding:1mm 3mm;border:1px solid #e2d4f2;border-radius:3mm}.cal{display:grid;grid-template-columns:repeat(7,1fr);gap:1mm;max-width:120mm}.cal div{height:9mm;border:1px solid #eee;border-radius:1.5mm;font-size:8pt;padding:0.5mm;text-align:center}.cal .on{background:#ffe9a8;border-color:#e0b000;font-weight:700}.bar{height:2.5mm;background:#eee;border-radius:2mm;overflow:hidden}.bar i{display:block;height:100%;background:#e0a600}</style></head><body>';
    h += '<h1>\u2b50 Kids Corner progress report</h1><p class="sub">' + (name.trim() ? esc(name.trim()) + ' \u00b7 ' : '') + new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) + ' \u00b7 Knowing Jesus Today</p>';
    h += '<div class="big"><b>' + esc(S.level[1] + ' ' + S.level[2]) + '</b>level</div><div class="big"><b>' + S.total + ' / ' + S.max + '</b>stars</div><div class="big"><b>' + S.badges.filter(function (b) { return b.got; }).length + ' / ' + S.badges.length + '</b>badges</div>';
    h += '<h2>\ud83d\udcd6 Bible reading (My Little Bible)</h2>';
    var sum = kr.sum || {}, chapters = Object.keys(read).length;
    h += '<div class="big"><b>' + chapters + '</b>chapters read</div><div class="big"><b>' + Object.keys(days).length + '</b>reading days</div><div class="big"><b>' + (+sum.best || 0) + '</b>best days in a row</div><div class="big"><b>' + ((sum.books || []).length) + '</b>books finished</div>';
    var started = B.filter(function (b) { for (var c = 1; c <= b[2]; c++) if (read[b[0] + '.' + c]) return true; return false; });
    if (started.length) { h += '<table><tr><th>Book</th><th>Chapters read</th><th style="width:40%"></th></tr>'; started.forEach(function (b) { var n = 0; for (var c = 1; c <= b[2]; c++) if (read[b[0] + '.' + c]) n++; h += '<tr><td>' + (n === b[2] ? '\ud83c\udfc6 ' : '') + esc(b[1]) + '</td><td>' + n + ' of ' + b[2] + '</td><td><div class="bar"><i style="width:' + Math.round(n / b[2] * 100) + '%"></i></div></td></tr>'; }); h += '</table>'; }
    h += '<p class="sub">Chapters read each day, the last 4 weeks:</p><div class="cal">';
    for (var i = 27; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); var k = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2), n = days[k] || 0; h += '<div class="' + (n ? 'on' : '') + '">' + d.getDate() + (n ? '<br>' + n : '') + '</div>'; }
    var BMS = ((get('kjt_kids_bookmarks') || {}).items) || {}, bl = Object.keys(BMS).map(function (k) { return BMS[k]; }).filter(function (x) { return !x.del; }).sort(function (a, b) { return (b.at || 0) - (a.at || 0); });
    var STK = { heart: '\u2764\ufe0f', star: '\u2b50', pray: '\ud83d\ude4f', cross: '\u271d\ufe0f', dove: '\ud83d\udd4a\ufe0f', sun: '\u2600\ufe0f', lion: '\ud83e\udd81', sheep: '\ud83d\udc11', light: '\ud83d\udca1', wow: '\ud83d\ude2e', question: '\u2753', smile: '\ud83d\ude0a' }, NM = {}; B.forEach(function (b) { NM[b[0]] = b[1]; });
    h += '</div><h2>\ud83d\udd16 Bookmarks (' + bl.length + ')</h2>';
    if (bl.length) { h += '<table><tr><th></th><th>Verse</th><th>Note</th></tr>'; bl.slice(0, 40).forEach(function (b) { h += '<tr><td>' + (STK[b.sticker] || '\ud83d\udd16') + '</td><td>' + esc((NM[b.code] || b.code) + ' ' + b.ch + ':' + b.v) + '</td><td>' + esc(b.note || '') + '</td></tr>'; }); h += '</table>'; } else h += '<p class="sub">No bookmarks yet.</p>';
    h += '<h2>\u2b50 Stars for each activity</h2><table><tr><th>Activity</th><th>Stars</th><th>Progress</th></tr>';
    Object.keys(STARS).forEach(function (k) { var st = STARS[k], v = st.value(S.m); h += '<tr><td>' + esc(st.label) + '</td><td class="stars">' + star(S.stars[k]) + '</td><td>' + v + ' ' + esc(st.unit[v === 1 ? 0 : 1]) + '</td></tr>'; });
    h += '</table><h2>\ud83c\udfc5 Badges earned</h2><div class="badges">' + (S.badges.filter(function (b) { return b.got; }).map(function (b) { return '<span>' + b.icon + ' ' + esc(b.name) + '</span>'; }).join('') || '<p class="sub">No badges yet.</p>') + '</div>';
    h += '<p class="sub" style="margin-top:6mm">This report was made on this device from the child\u2019s Kids Corner progress. Nothing is sent to anyone.</p></body></html>';
    var fr = document.createElement('iframe'); fr.setAttribute('aria-hidden', 'true'); fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'; document.body.appendChild(fr);
    var doc = fr.contentWindow.document; doc.open(); doc.write(h); doc.close();
    setTimeout(function () { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { window.print(); } setTimeout(function () { fr.remove(); }, 60000); }, 300);
  }
  window.KJTAchieve.summary = summary;
  window.KJTAchieve.report = report;
  /* 7.9.26: after the Pilgrim Key brings progress from the site (signing in, another device), read it again and take it
     as it is: stars and badges already earned are not announced again */
  window.KJTAchieve.refresh = function (silent) {
    var d = load(); d.counts = d.counts || {}; d.sets = d.sets || {}; d.days = d.days || {}; d.earned = d.earned || {};
    if (silent) d.snap = null;
    data = d; update();
  };
  function boot() { update(); setInterval(function () { if (!document.hidden) update(); }, 6000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else setTimeout(boot, 0);
})();
