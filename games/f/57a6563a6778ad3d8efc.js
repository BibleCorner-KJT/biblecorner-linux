/* KJT Kids Corner - Bible Games: Explore (Site Core 5.5.0)
   Paul's Journeys (tap the cities of Saint Paul's journeys on a map) and
   Icon Detective (recognise saints in icons by their symbols). */
(function () {
  'use strict';
  if (!window.KJTGames) return;
  var K = window.KJTGames.kit, el = K.el, D = K.data || {};

  /* =================================================================
     PAUL'S JOURNEYS - a simple map of the eastern Mediterranean
     ================================================================= */
  var W = 660, H = 400, LON0 = 11, LON1 = 37.5, LAT0 = 30, LAT1 = 43;
  function xy(lon, lat) { return [((lon - LON0) / (LON1 - LON0) * W), ((LAT1 - lat) / (LAT1 - LAT0) * H)]; }
  function poly(pts) { return pts.map(function (p, i) { var q = xy(p[0], p[1]); return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' ') + 'Z'; }
  var LAND = [
    [[10.2, 43.9], [12.3, 44.2], [13.5, 43.6], [14.2, 42.4], [15.2, 41.9], [16.1, 41.4], [17.2, 40.9], [18.5, 40.2], [18.4, 39.9], [17.1, 40.5], [16.6, 39.9], [17.1, 39.0], [16.6, 38.4], [16.1, 38.0], [15.6, 38.3], [15.8, 39.4], [15.0, 40.2], [14.3, 40.6], [13.9, 41.2], [12.9, 41.4], [12.2, 41.8], [11.1, 42.4], [10.5, 43.0]],
    [[12.4, 37.9], [13.3, 38.2], [15.6, 38.3], [15.1, 37.3], [15.1, 36.7], [14.5, 36.8], [12.6, 37.6]],
    [[19.4, 43.2], [19.4, 41.8], [19.4, 40.3], [20.2, 39.6], [20.8, 38.9], [21.1, 38.3], [21.6, 37.2], [21.9, 36.8], [22.4, 36.4], [22.8, 36.8], [23.2, 36.5], [23.0, 37.4], [23.2, 37.9], [24.0, 37.7], [24.0, 38.2], [22.9, 38.9], [23.3, 39.1], [22.6, 40.2], [22.9, 40.6], [23.8, 40.4], [24.4, 40.9], [26.0, 40.8], [26.3, 40.6], [29.0, 41.1], [28.0, 41.6], [28.0, 43.2]],
    [[11, 29], [11, 33.8], [11.5, 33.3], [13.0, 32.9], [15.1, 32.4], [15.5, 31.3], [19.0, 30.3], [20.0, 32.2], [21.0, 32.8], [23.0, 32.6], [25.0, 31.6], [29.0, 30.9], [30.0, 31.3], [31.0, 31.6], [32.3, 31.2], [33.0, 31.1], [34.2, 31.3], [34.6, 32.0], [34.9, 32.8], [35.2, 33.3], [35.5, 34.3], [35.9, 35.2], [35.8, 36.0], [36.2, 36.5], [35.8, 36.8], [34.8, 36.8], [34.0, 36.3], [32.8, 36.0], [31.4, 36.7], [30.6, 36.8], [30.4, 36.2], [29.0, 36.6], [28.2, 36.8], [27.3, 37.0], [27.2, 37.4], [26.3, 38.3], [26.8, 38.9], [26.1, 39.4], [26.2, 40.2], [26.7, 40.4], [27.5, 40.6], [29.0, 41.1], [29.0, 43.2], [38, 43.2], [38, 29]],
    [[23.5, 35.3], [24.3, 35.6], [25.4, 35.4], [26.3, 35.3], [26.1, 35.0], [24.8, 34.9], [23.6, 35.2]],
    [[32.3, 35.1], [33.0, 35.4], [34.6, 35.7], [34.0, 35.0], [33.0, 34.6], [32.4, 34.7]]
  ];
  /* Label nudges where city names would overlap or leave the map. */
  var OFF = { 'Berea': [-8, -7], 'Seleucia': [-8, 14], 'Antioch': [-8, -8], 'Perga': [4, 16], 'Rhodes': [-8, 4], 'Lystra': [-8, 13], 'Derbe': [8, -6], 'Salamis': [8, 12], 'Tyre': [8, 5], 'Sidon': [8, -3], 'Miletus': [8, 10], 'Myra': [8, 11], 'Corinth': [-8, 4], 'Caesarea': [-8, 4], 'Jerusalem': [-8, 6] };
  function paulMap(box, level) {
    var js = D.journeys || [], C = D.cities || {}, idx = K.store('pauljourney') || 0;
    var labels = level !== 'hard', guide = level === 'easy';
    var chooser = el('div', { class: 'kg-levels', role: 'group', 'aria-label': 'Journey' });
    var svgNS = 'http://www.w3.org/2000/svg';
    var holder = el('div', { class: 'kg-map-wrap' }), info = el('div', { class: 'kg-map-info', 'aria-live': 'polite' });
    box.appendChild(el('p', { class: 'kg-theme', text: 'Choose a journey:' })); box.appendChild(chooser);
    box.appendChild(el('div', { class: 'kg-map-layout' }, [holder, info]));
    function drawChooser() { chooser.innerHTML = ''; js.forEach(function (j, i) { chooser.appendChild(el('button', { class: 'kg-level', type: 'button', 'aria-pressed': i === idx ? 'true' : 'false', text: j.name.replace("Paul's ", ''), onclick: function () { idx = i; K.store('pauljourney', i); drawChooser(); run(); } })); }); }
    drawChooser();
    function run() {
      var j = js[idx], step = 1, wrong = 0, names = {}; j.stops.forEach(function (s) { names[s[0]] = 1; });
      var svg = document.createElementNS(svgNS, 'svg'); svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 'kg-map'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Map of the eastern Mediterranean');
      var html = '<rect width="' + W + '" height="' + H + '" fill="#bfe3ff"/>';
      LAND.forEach(function (p) { html += '<path d="' + poly(p) + '" fill="#f2e2c0" stroke="#c9a775" stroke-width="1.5"/>'; });
      html += '<text x="' + xy(18.5, 34.2)[0] + '" y="' + xy(18.5, 34.2)[1] + '" font-size="15" font-style="italic" fill="#6aa7d8">The Great Sea</text><g class="kg-route"></g>';
      svg.innerHTML = html;
      var route = svg.querySelector('.kg-route');
      /* All cities of all journeys appear, so children must find the right one. */
      Object.keys(C).forEach(function (name) {
        var p = xy(C[name][0], C[name][1]), g = document.createElementNS(svgNS, 'g');
        g.setAttribute('class', 'kg-city'); g.setAttribute('tabindex', '0'); g.setAttribute('role', 'button'); g.setAttribute('aria-label', labels ? name : 'City');
        g.innerHTML = '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="12" fill="transparent"/><circle class="dot" cx="' + p[0] + '" cy="' + p[1] + '" r="5.5" fill="#8d5a2b" stroke="#fff" stroke-width="2"/>' + (labels ? '<text x="' + (p[0] + (OFF[name] ? OFF[name][0] : 8)) + '" y="' + (p[1] + (OFF[name] ? OFF[name][1] : -7)) + '"' + (OFF[name] && OFF[name][0] < 0 ? ' text-anchor="end"' : '') + ' font-size="11" font-weight="700" fill="#3e2412">' + name + '</text>' : '');
        g.addEventListener('click', function () { tap(name, g); }); g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(name, g); } });
        g.dataset.name = name; svg.appendChild(g);
      });
      holder.innerHTML = ''; holder.appendChild(svg);
      var start = j.stops[0][0]; mark(start); say('\ud83d\udccd ' + start + ': ' + j.stops[0][1], 'Where did Paul go next? Tap the city on the map.');
      function mark(name) { var g = svg.querySelector('[data-name="' + name + '"]'); if (g) g.classList.add('visited'); }
      function hint() { svg.querySelectorAll('.kg-city').forEach(function (g) { g.classList.toggle('next', guide && step < j.stops.length && g.dataset.name === j.stops[step][0]); }); }
      hint();
      function tap(name) {
        if (step >= j.stops.length) return;
        var want = j.stops[step][0];
        if (name === want) {
          var a = xy.apply(null, C[j.stops[step - 1][0]]), b = xy.apply(null, C[name]);
          var line = document.createElementNS(svgNS, 'line'); line.setAttribute('x1', a[0]); line.setAttribute('y1', a[1]); line.setAttribute('x2', b[0]); line.setAttribute('y2', b[1]); line.setAttribute('class', 'kg-leg'); route.appendChild(line);
          mark(name); K.sound('good'); say('\ud83d\udccd ' + name + ': ' + j.stops[step][1], step + 1 < j.stops.length ? 'Where next?' : '');
          step++; hint();
          if (step >= j.stops.length) { K.award('paul', level); K.celebrate(box, 'You followed ' + j.name + ' (' + j.ref + ') with ' + wrong + ' wrong tap' + (wrong === 1 ? '' : 's') + '!'); }
        } else { wrong++; K.sound('miss'); say(null, (labels ? 'That\u2019s ' + name + '. ' : 'Not that one. ') + 'Look ' + direction(C[j.stops[step - 1][0]], C[want]) + ' of ' + j.stops[step - 1][0] + '.'); }
      }
      function direction(from, to) { var dx = to[0] - from[0], dy = to[1] - from[1], ns = dy > .7 ? 'north' : dy < -.7 ? 'south' : '', ew = dx > .7 ? 'east' : dx < -.7 ? 'west' : ''; return (ns + (ns && ew ? '-' : '') + ew) || 'near'; }
      function say(fact, ask) { if (fact) info.innerHTML = ''; if (fact) info.appendChild(el('p', { class: 'kg-map-fact', text: fact })); var old = info.querySelector('.kg-note'); if (old) old.remove(); if (ask) info.appendChild(el('p', { class: 'kg-note', text: ask })); info.insertBefore(el('p', { class: 'kg-map-title', text: j.name + ' \u00b7 ' + j.ref + ' \u00b7 stop ' + Math.min(step + 1, j.stops.length) + ' of ' + j.stops.length }), info.firstChild); var dup = info.querySelectorAll('.kg-map-title'); if (dup.length > 1) dup[1].remove(); }
    }
    run();
  }

  /* =================================================================
     ICON DETECTIVE
     ================================================================= */
  function icons(box, level) {
    var S = D.saints || [], rounds = 8, n = level === 'easy' ? 3 : 4;
    var mode = 'learn';
    var tabs = el('div', { class: 'kg-levels', role: 'group' }), area = el('div');
    box.appendChild(tabs); box.appendChild(area);
    function drawTabs() { tabs.innerHTML = ''; [['learn', '\ud83d\udcd6 Learn the symbols'], ['quiz', '\ud83d\udd0d Detective test']].forEach(function (m) { tabs.appendChild(el('button', { class: 'kg-level', type: 'button', 'aria-pressed': mode === m[0] ? 'true' : 'false', text: m[1], onclick: function () { mode = m[0]; drawTabs(); mode === 'learn' ? learn() : quiz(); } })); }); }
    drawTabs();
    function learn() {
      area.innerHTML = '';
      area.appendChild(el('p', { class: 'kt-note', text: 'In icons, saints are often painted with objects that tell us who they are. Learn them, then try the Detective test!' }));
      var list = el('div', { class: 'kg-saints' });
      S.forEach(function (s) { list.appendChild(el('div', { class: 'kg-saint' }, [el('strong', { text: s.name }), el('span', { class: 'kg-saint__sym', text: s.symbols }), el('small', { text: s.about })])); });
      area.appendChild(list);
    }
    function quiz() {
      var qs = K.shuffle(S).slice(0, rounds), i = 0, score = 0;
      function ask() {
        var s = qs[i], opts = K.shuffle([s].concat(K.shuffle(S.filter(function (x) { return x !== s; })).slice(0, n - 1)));
        var parts = s.symbols.split(' \u00b7 '), shown = level === 'hard' ? [K.pick(parts)] : parts;
        area.innerHTML = '';
        area.appendChild(el('p', { class: 'kg-theme', text: 'Case ' + (i + 1) + ' of ' + rounds + ' \u00b7 Solved: ' + score }));
        area.appendChild(el('div', { class: 'kg-clue-card' }, [el('p', { text: '\ud83d\udd0d In an icon you see:' }), el('p', { class: 'kg-clue-sym', text: shown.join('   ') }), el('p', { text: 'Which saint is it?' })]));
        var row = el('div', { class: 'kt-options' }), fb = el('p', { class: 'kg-note' });
        opts.forEach(function (o) { row.appendChild(el('button', { class: 'kt-opt', type: 'button', text: o.name, onclick: function () {
          [].slice.call(row.children).forEach(function (b) { b.disabled = true; if (b.textContent === s.name) b.classList.add('right'); });
          if (o === s) { score++; K.sound('good'); fb.className = 'kg-note'; fb.textContent = '\u2b50 Correct! ' + s.about; } else { this.classList.add('gentle'); K.sound('miss'); fb.className = 'kg-note try'; fb.textContent = 'It\u2019s ' + s.name + '. ' + s.about; }
          area.appendChild(el('div', { class: 'kt-row' }, [el('button', { class: 'kt-btn', type: 'button', text: i + 1 < rounds ? 'Next case \u2192' : 'See my result', onclick: function () { i++; if (i < rounds) ask(); else end(); } })]));
        } })); });
        area.appendChild(row); area.appendChild(fb);
      }
      function end() { area.innerHTML = ''; var passed = score >= 6; if (passed) K.award('icons', level); K.celebrate(box, 'You solved ' + score + ' of ' + rounds + ' cases!' + (passed ? '' : ' Solve 6 or more to win a trophy.')); }
      ask();
    }
    learn();
  }

  /* 7.9.9: Paul's Journeys moved to games-paul.js (the real map) */
  window.KJTGames.register({ id: 'icons', cat: 'explore', icon: '\ud83d\uddbc\ufe0f', name: 'Icon Detective', blurb: 'Recognise saints in icons by their symbols', daily: true, run: icons });
})();
