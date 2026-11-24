/* KJT Kids Corner \u00b7 activity hub (Site Core 5.3.2)
   Kids Corner opens on a home screen: the hero plus big picture cards,
   grouped (Read & Learn, Play, Create, Pray, Watch). Choosing a card shows
   ONLY that activity, full screen in its own colour, with "All activities"
   at the top and a floating home button, so children can't scroll into
   other sections. Each activity has its own address (#bible-games \u2026), so the
   phone's back button returns to the home screen.
   Without JavaScript the page stays the normal long page. */
(function () {
  'use strict';
  var CFG = window.KJT_KIDS_HUB || {};
  var ACTS = CFG.activities || [];
  var main = document.getElementById('categories') ? document.getElementById('categories').parentElement : null;
  var cats = document.getElementById('categories');
  if (!main || !cats || !ACTS.length) return;
  var S = window.KJTSound || { play: function () {}, button: null };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v; else if (k === 'style') n.style.cssText = v;
      else if (k.indexOf('on') === 0) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  /* ---------- which sections belong to which activity ---------- */
  /* Page blocks = the page's top-level sections and wrappers (some sections sit inside a wrapper). */
  var sections = Array.prototype.filter.call(main.children, function (n) { return n.tagName === 'SECTION' || n.tagName === 'DIV'; });
  function block(n) { while (n && n.parentElement && n.parentElement !== main) n = n.parentElement; return n && n.parentElement === main ? n : null; }
  var hero = sections[0] === cats ? null : sections[0];
  var owner = new Map(); /* section -> activity id */
  ACTS.forEach(function (a) {
    (a.sections || []).forEach(function (id) { var s = block(document.getElementById(id)); if (s) owner.set(s, a.id); });
    if (a.id === 'watch') document.querySelectorAll('[data-kjt-superbook-lang]').forEach(function (s) { var b = block(s); if (b) owner.set(b, 'watch'); });
  });
  /* 7.9.20: an activity with its own page (Fun & Games) opens that page */
  ACTS.forEach(function (a) { if (a.url && (location.hash === '#' + a.hash || (a.oldHashes || []).indexOf(location.hash.slice(1)) >= 0)) location.replace(a.url + (location.search || '')); });
  ACTS = ACTS.filter(function (a) { if (a.url) return true; var has = false; owner.forEach(function (v) { if (v === a.id) has = true; }); return has; });
  /* Use the first section of each activity that really exists as its address. */
  ACTS.forEach(function (a) { if (!document.getElementById(a.hash)) { var f = (a.sections || []).filter(function (id) { return document.getElementById(id); })[0]; if (f) a.hash = f; } });
  /* Sections without an activity join the next activity (e.g. an intro just
     before it); anything left at the end joins Parent Corner. */
  sections.forEach(function (s, i) {
    if (s === hero || s === cats || owner.has(s)) return;
    for (var j = i + 1; j < sections.length; j++) if (owner.has(sections[j]) && owner.get(sections[j]) !== 'parents') { owner.set(s, owner.get(sections[j])); return; }
    owner.set(s, 'parents');
  });
  var byId = {}; ACTS.forEach(function (a) { byId[a.id] = a; });

  /* ---------- home screen (hub) ---------- */
  var nav = cats.querySelector('nav');
  function cardFor(a) {
    var src = nav && (nav.querySelector('a[href="#' + a.card + '"]') || nav.querySelector('a[data-kk-card="' + a.card + '"]') || (a.altCard && nav.querySelector('a[href="#' + a.altCard + '"]')));
    var c;
    if (src) {
      c = src.cloneNode(true);
      var spans = c.querySelectorAll('span.block');
      if (spans[0] && a.title) spans[0].textContent = a.title;
      if (spans[1] && a.sub) spans[1].textContent = a.sub;
    } else {
      c = el('a', { class: 'kk-card-simple' }, [el('span', { class: 'kk-card-simple__icon', text: a.icon }), el('span', { text: a.title })]);
    }
    if (a.url) { c.setAttribute('href', a.url + (location.search || '')); c.removeAttribute('data-kk-nav'); c.classList.add('kk-card--page'); c.removeAttribute('target'); return c; }
    c.setAttribute('href', '#' + a.hash);
    c.setAttribute('data-kk-nav', a.id);
    c.removeAttribute('target');
    return c;
  }
  var hub = el('div', { class: 'kk-hub' });
  /* 7.3.0: "My Pilgrim Corner" first (Pilgrim Key: sign in, save progress, growing up;
     then my achievements), like My Study Space on the Holy Bible page. */
  hub.appendChild(el('section', { class: 'kk-me', 'aria-label': 'My Pilgrim Corner' }, [
    el('div', { class: 'kk-me__head' }, [
      el('span', { class: 'kk-me__icon', 'aria-hidden': 'true', text: '\u2b50' }),
      el('span', {}, [el('strong', { text: 'My Pilgrim Corner' }), el('small', { text: 'Save your stars, see your badges and keep growing' })])
    ]),
    el('div', { class: 'kk-me__key' }),
    el('div', { class: 'kk-me__ach' })
  ]));
  var topRow = el('div', { class: 'kk-hub__top' }, [el('h2', { class: 'kk-hub__title' }, [el('span', { class: 'kk-hub__title-icon', 'aria-hidden': 'true', text: '\ud83c\udf88' }), el('span', { class: 'kk-hub__title-text', text: CFG.heading || 'Choose your activity' })])]);
  if (S.button) topRow.appendChild(S.button());
  hub.appendChild(topRow);
  var cont = el('div', { class: 'kk-continue-slot' });
  hub.appendChild(cont);
  var groups = {}, groupsBox = el('div', { class: 'kk-hub__groups' });
  hub.appendChild(groupsBox);
  ACTS.forEach(function (a) {
    if (a.id === 'parents') return;
    if (!groups[a.group]) {
      /* 7.9.2: Read & Learn, Pray and Create on the first line; Play and Watch on the next */
      if (a.group === 'Play' && groupsBox.children.length) groupsBox.appendChild(el('div', { class: 'kk-hub__break', 'aria-hidden': 'true' }));
      /* Same wrapper as the original menu so the picture-card look is kept. */
      groups[a.group] = el('nav', { class: 'kk-hub__grid ' + (nav ? nav.className : ''), 'aria-label': a.group });
      if (nav && nav.hasAttribute('data-kjt-kids-cards')) groups[a.group].setAttribute('data-kjt-kids-cards', ''); groupsBox.appendChild(el('div', { class: 'kk-hub__group' }, [el('h3', { class: 'kk-hub__heading', text: a.group }), groups[a.group]])); }
    groups[a.group].appendChild(cardFor(a));
    groups[a.group].style.setProperty('--n', groups[a.group].children.length);
  });
  if (byId.parents) hub.appendChild(el('p', { class: 'kk-hub__parents' }, [el('a', { href: '#' + byId.parents.hash, 'data-kk-nav': 'parents', text: '\ud83d\udc68\u200d\ud83d\udc69\u200d\ud83d\udc67 Parent Corner \u00b7 safety and privacy' })]));
  if (nav) nav.hidden = true;
  (nav ? nav.parentElement : cats).appendChild(hub);

  /* ---------- focus bar + floating home button ---------- */
  var barTitle = el('span', { class: 'kk-focusbar__title' });
  var parts = el('span', { class: 'kk-parts' });
  var bar = el('div', { class: 'kk-focusbar', role: 'navigation', 'aria-label': 'Kids Corner' }, [
    el('button', { class: 'kk-focusbar__back', type: 'button', 'data-kk-nav': 'home', onclick: goHome }, [el('span', { 'aria-hidden': 'true', text: '\u2190 ' }), 'All activities']),
    barTitle, parts
  ]);
  if (S.button) bar.appendChild(S.button());
  main.insertBefore(bar, main.firstChild);
  var homeBtn = el('button', { class: 'kk-home', type: 'button', 'aria-label': 'All activities', title: 'All activities', 'data-kk-nav': 'home', onclick: goHome, text: '\ud83c\udfe0' });
  document.body.appendChild(homeBtn);

  /* ---------- routing ---------- */
  function activityForHash() {
    var h = decodeURIComponent(location.hash.replace(/^#/, ''));
    if (!h || h === 'categories' || h === 'top' || h === 'kids-home') return null;
    if (/^adventure(\/|-trail$)/.test(h)) return byId.trail ? 'trail' : null;
    if (/^story\//.test(h)) return byId.stories ? 'stories' : null;
    if (/^kb\//.test(h)) return byId.bible ? 'bible' : null;
    for (var i = 0; i < ACTS.length; i++) if (ACTS[i].hash === h) return ACTS[i].id;
    var s = block(document.getElementById(h));
    return s && owner.has(s) ? owner.get(s) : null;
  }
  var current = undefined;
  function render(fromUser) {
    var id = activityForHash();
    /* Remember the exact place (e.g. a trail stop) for "Continue where you left off". */
    if (id) { try { localStorage.setItem('kjt_kids_last', JSON.stringify({ id: id, hash: location.hash, t: Date.now() })); } catch (e) {} }
    if (id === current) return;
    var was = current; current = id;
    document.body.classList.add('kk-hub-on');
    document.body.classList.toggle('kk-focus', !!id);
    sections.forEach(function (s) {
      var show = id ? owner.get(s) === id : (s === hero || s === cats);
      s.classList.toggle('kk-off', !show);
    });
    bar.hidden = !id; homeBtn.hidden = !id;
    var a = id && byId[id];
    document.body.style.setProperty('--kk-bg1', a ? a.color[0] : '');
    document.body.style.setProperty('--kk-bg2', a ? a.color[1] : '');
    parts.innerHTML = '';
    if (a && a.parts) a.parts.forEach(function (pt) {
      if (!document.getElementById(pt[1])) return;
      parts.appendChild(el('button', { class: 'kk-part', type: 'button', text: pt[0], onclick: function () { var t = document.getElementById(pt[1]); if (t) window.scrollTo({ top: t.getBoundingClientRect().top + window.pageYOffset - (bar.offsetHeight + 8), behavior: 'smooth' }); } }));
    });
    if (a) {
      barTitle.textContent = a.icon + ' ' + a.title;
      try { localStorage.setItem('kjt_kids_last', JSON.stringify({ id: id, hash: location.hash, t: Date.now() })); } catch (e) {}
    } else paintContinue();
    if (fromUser !== false) window.scrollTo(0, id ? 0 : Math.max(0, (hero ? hero.offsetHeight : 0) - 40));
    if (a && was !== undefined) S.play('open');
    try { window.dispatchEvent(new CustomEvent('kjt-activity-shown', { detail: id || 'home' })); } catch (e) {}
    /* Reels measured while hidden had their arrow buttons switched off by the
       theme (it saw zero width). Re-measure once the activity is visible. */
    requestAnimationFrame(function () { setTimeout(refreshRails, 60); });
  }
  function refreshRails() {
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    sections.forEach(function (s) {
      if (s.classList.contains('kk-off')) return;
      s.querySelectorAll('.video-rail, .audio-rail, .bfp-card-row, [role="region"].overflow-x-auto').forEach(function (rail) {
        var box = rail.closest('section') || s, btns = box.querySelectorAll('button[aria-label]');
        var max = Math.max(0, rail.scrollWidth - rail.clientWidth - 3);
        btns.forEach(function (b) {
          var l = ((b.getAttribute('data-kjt-en-label')||b.getAttribute('aria-label')) || '').toLowerCase();
          if (!/scroll|previous|next/.test(l)) return;
          var off = /left|previous/.test(l) ? rail.scrollLeft <= 3 : /right|next/.test(l) ? rail.scrollLeft >= max : false;
          b.disabled = off; b.classList.toggle('kjt-rail-disabled', off);
        });
      });
    });
  }
  function goHome() {
    S.play('back');
    if (history.state && history.state.kkFromHub) history.back();
    else { history.pushState(null, '', location.pathname + location.search + '#kids-home'); render(); }
  }
  /* Cards: open the activity and remember it came from the hub (so Back returns there). */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-kk-nav]');
    if (!a) return;
    e.preventDefault();
    history.pushState({ kkFromHub: true }, '', a.getAttribute('href'));
    render();
  });
  window.addEventListener('hashchange', function () { render(); });
  window.addEventListener('popstate', function () { render(); });

  /* ---------- "Continue where you left off" ---------- */
  function paintContinue() {
    cont.innerHTML = '';
    var last; try { last = JSON.parse(localStorage.getItem('kjt_kids_last')); } catch (e) { last = null; }
    if (!last || !byId[last.id] || byId[last.id].url || last.id === 'parents' || Date.now() - last.t > 30 * 86400000) return;
    var a = byId[last.id], detail = '';
    var m = /^#adventure\/([\w-]+)/.exec(last.hash || '');
    if (m) { var stop = document.querySelector('#kjt-trail-data'); try { JSON.parse(stop.textContent).trails.forEach(function (t) { t.stops.forEach(function (s) { if (s.slug === m[1]) detail = s.icon + ' ' + s.title; }); }); } catch (e) {} }
    var sm = /^#story\/([\w-]+)/.exec(last.hash || '');
    if (sm) { try { JSON.parse(document.getElementById('kjt-stories-data').textContent).stories.forEach(function (s) { if (s.id === sm[1]) detail = s.icon + ' ' + s.title; }); } catch (e) {} }
    if (last.id === 'games') { try { var g = JSON.parse(localStorage.getItem('kjt_games_game')); detail = { seek: 'Word Seek', dots: 'Connect the Dots', diff: 'Spot the Difference', puzzle: 'Picture Puzzle' }[g] || ''; } catch (e) {} }
    cont.appendChild(el('a', { class: 'kk-continue', href: last.hash && last.hash !== '#' ? last.hash : '#' + a.hash, 'data-kk-nav': a.id, style: '--kb1:' + a.color[0] + ';--kb2:' + a.color[1] }, [
      el('span', { class: 'kk-continue__icon', text: a.icon, 'aria-hidden': 'true' }),
      el('span', { class: 'kk-continue__text' }, [el('small', { text: 'Continue where you left off' }), el('strong', { text: a.title + (detail ? ' \u00b7 ' + detail : '') })]),
      el('span', { class: 'kk-continue__go', text: '\u2192', 'aria-hidden': 'true' })
    ]));
  }

  /* ---------- "Choose another activity" after finishing something ---------- */
  new MutationObserver(function (list) {
    list.forEach(function (m) { m.addedNodes.forEach(function (n) {
      if (n.nodeType !== 1 || !current) return;
      var box = n.matches('.kg-done') ? n : (n.matches('.kt-celebrate__stars') ? n.parentElement : null);
      if (!box || box.querySelector('.kk-another')) return;
      var row = box.querySelector('.kt-row') || box;
      row.appendChild(el('button', { class: 'kt-btn kt-btn--ghost kk-another', type: 'button', 'data-kk-nav': 'home', onclick: goHome, text: '\ud83c\udfe0 Choose another activity' }));
    }); });
  }).observe(main, { childList: true, subtree: true });

  render(false);
  if (current) window.scrollTo(0, 0);
})();
