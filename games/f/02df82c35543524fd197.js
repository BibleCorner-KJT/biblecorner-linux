/* KJT Local Bible - "My KJT" in the site header, on every page (4.9.12)
   Signed out: 👤 My KJT · Sign in (opens the My KJT page).
   Signed in: 👤 your name, with a small menu (My KJT, My Bible Study Journey (4.14.4: was My Bible study and Reading journey; My prayers is in My KJT),
   My prayers, Settings, Sign out).
   Kids Corner: ⭐ My Pilgrim Card for the child, and a small "Grown-ups" link. Children
   are never asked to sign in or to give an email.
   Who is signed in is asked after the page has loaded (pages stay cached and fast);
   the answer never contains an email address. */
(function () {
  'use strict';
  var C = window.KJTB_MY || {}; if (!C.ajax) return;
  var LANGS = ['en', 'ar', 'el', 'ru', 'zh', 'fr', 'hi', 'es', 'tl'];
  function pageLang() {
    var l = '';
    try { l = new URLSearchParams(location.search).get('lang') || ''; } catch (e) {}
    if (LANGS.indexOf(l) < 0) l = (window.KJT_LANG && window.KJT_LANG.lang) || window.KJTB_UI_LANG || '';
    if (LANGS.indexOf(l) < 0) { try { l = localStorage.getItem('kjtb_ui_lang') || ''; } catch (e) {} }
    return LANGS.indexOf(l) >= 0 ? l : 'en';
  }
  var LANG = pageLang(), D = null, waiting = [];
  /* the words (shared with the My KJT page) */
  function dict(fn) {
    if (LANG === 'en') return fn(null);
    if (D) return fn(D);
    waiting.push(fn); if (waiting.length > 1) return;
    fetch(C.i18n + '?v=' + encodeURIComponent(C.ver || ''), { credentials: 'same-origin' }).then(function (r) { return r.json(); })
      .then(function (j) { D = j || {}; }).catch(function () { D = {}; })
      .then(function () { var w = waiting; waiting = []; w.forEach(function (f) { f(D); }); });
  }
  function T(s) { if (!D || LANG === 'en') return s; var e = D[s]; return (e && e[LANG]) || s; }
  window.KJTB_MY_I18N = { lang: LANG, dict: dict, t: T };

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { var v = attrs[k]; if (v == null) return; if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v; else n.setAttribute(k, v); });
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  /* 4.9.15: signing in brings the reader back to the page they were on */
  function withBack(u) {
    if (C.here) return u;
    try { var x = new URL(u, location.href), here = new URL(location.href); here.hash = '';
      ['kjtb_key_status', 'kjtb_email_status', 'kjtb_code', 'loggedout', 'kjtb_deleted', 'kjtb_back'].forEach(function (k) { here.searchParams.delete(k); });
      x.searchParams.set('kjtb_back', here.href); return x.href; } catch (e) { return u; }
  }
  /* 4.16.2: links carry no return address (to crawlers every Bible page made a different link to My KJT,
     hundreds of thousands of them, and a crawler followed them all); it is added when a person clicks */
  function backOnClick(a) { ['click', 'auxclick', 'keydown'].forEach(function (ev) { a.addEventListener(ev, function (e) { if (ev === 'keydown' && e.key !== 'Enter') return; var h = a.getAttribute('href') || '', i = h.indexOf('#'); a.setAttribute('href', withBack(i < 0 ? h : h.slice(0, i)) + (i < 0 ? '' : h.slice(i))); }, true); }); return a; }
  document.addEventListener('click', function (e) { var a = e.target && e.target.closest && e.target.closest('a[data-kjtb-back]'); if (!a || a.getAttribute('data-kjtb-done')) return; try { var x = new URL(a.href, location.href); x.searchParams.set('kjtb_back', a.getAttribute('data-kjtb-back')); a.href = x.href; a.setAttribute('data-kjtb-done', '1'); } catch (er) {} }, true);
  function withLang(u) { if (LANG === 'en') return u; try { var x = new URL(u, location.href); x.searchParams.set('lang', LANG); return x.href; } catch (e) { return u; } }

  var header = document.querySelector('header.bfp-header .bfp-container') || document.querySelector('header .bfp-container') || document.querySelector('header');
  if (!header) return;
  var box = el('div', { class: 'kjt-myh' + (C.kids ? ' kjt-myh--kids' : ''), 'data-kjt-my-notr': '' });
  var nav = header.querySelector('.bfp-nav'), mob = header.querySelector('.bfp-mobile-toggle');
  if (mob) header.insertBefore(box, mob); else if (nav && nav.nextSibling) header.insertBefore(box, nav.nextSibling); else header.appendChild(box);

  /* ---------- Kids Corner: the child's own card, and a quiet link for grown-ups ---------- */
  if (C.kids) {
    dict(function () {
      box.innerHTML = '';
      box.appendChild(el('a', { class: 'kjt-myh__btn kjt-myh__btn--kids', href: '#my-pilgrim-card' }, [el('span', { 'aria-hidden': 'true', text: '⭐ ' }), T('My Pilgrim Card')]));
      box.appendChild(backOnClick(el('a', { class: 'kjt-myh__grown', href: withLang(C.my), rel: 'nofollow', title: T('For grown-ups: My KJT') }, [T('Grown-ups')])));
      box.querySelector('.kjt-myh__btn--kids').addEventListener('click', function (e) {
        var card = document.getElementById('my-pilgrim-card'); if (!card) return;
        e.preventDefault(); if (location.hash && location.hash !== '#my-pilgrim-card') { try { history.pushState(null, '', location.pathname + location.search + '#kids-home'); window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (x) {} }
        setTimeout(function () { var c2 = document.getElementById('my-pilgrim-card'); if (c2) c2.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 120);
      });
    });
    return;
  }

  /* ---------- everywhere else: My KJT ---------- */
  function signedOut() {
    box.innerHTML = '';
    box.appendChild(backOnClick(el('a', { class: 'kjt-myh__btn', href: withLang(C.my) + '#kjtb-account-zone', rel: 'nofollow' }, [el('span', { class: 'kjt-myh__icon', 'aria-hidden': 'true', text: '👤' }), el('span', { class: 'kjt-myh__label' }, [el('b', { text: 'My KJT' }), el('small', { text: T('Sign in') })])])));
  }
  function signedIn(me) {
    box.innerHTML = '';
    /* 4.14.4: the site's own name (the administrators' public name since Site Core 7.11.1) is not a person's name */
    var name = (me.name || '').trim(); if (/^knowing jesus today$/i.test(name)) name = '';
    var first = name ? name.split(/\s+/)[0].slice(0, 16) : 'My KJT';
    var btn = el('button', { class: 'kjt-myh__btn kjt-myh__btn--in', type: 'button', 'aria-haspopup': 'true', 'aria-expanded': 'false', 'aria-label': T('Open the My KJT menu') },
      [el('span', { class: 'kjt-myh__avatar', 'aria-hidden': 'true', text: name ? name.charAt(0).toUpperCase() : '👤' }), el('span', { class: 'kjt-myh__label' }, [el('b', { text: first }), el('small', { text: 'My KJT ▾' })])]);
    var B = C.bible || '/', q = function (what) { try { var u = new URL(B, location.href); u.searchParams.set('kjtb_open', what); if (LANG !== 'en') u.searchParams.set('lang', LANG); return u.href; } catch (e) { return B; } };
    var menu = el('div', { class: 'kjt-myh__menu', role: 'menu', hidden: '' }, [
      el('p', { class: 'kjt-myh__who' }, [el('span', { text: T('Welcome back') }), name ? el('strong', { text: name }) : null]),
      el('a', { role: 'menuitem', href: withLang(C.my) }, ['🏠 ', T('My KJT')]),
      /* 4.14.4: one item for My Bible study and My Reading Journey (they are one card, Bible Study Journey);
         My prayers is in My KJT (the item above), so it is not repeated */
      el('a', { role: 'menuitem', href: q('journey'), 'data-kjtb-sj': 'journey' }, ['🧭 ', T('My Bible Study Journey')]),
      el('a', { role: 'menuitem', href: withLang(C.my) + '#my-settings' }, ['⚙️ ', T('Settings')]),
      me.logout ? el('a', { role: 'menuitem', class: 'kjt-myh__out', href: me.logout }, ['↩ ', T('Sign out')]) : null
    ]);
    box.appendChild(btn); box.appendChild(menu);
    function set(open) { menu.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false'); }
    btn.addEventListener('click', function (e) { e.stopPropagation(); set(menu.hidden); });
    document.addEventListener('click', function (e) { if (!box.contains(e.target)) set(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') set(false); });
    menu.addEventListener('click', function (e) { var a = e.target.closest('a'); if (a && a.classList.contains('kjt-myh__out')) forget(); });
    /* 4.14.5: My Bible Study Journey opens at the first click: right here on the Bible page; from any other
       page, the Bible page is told (in this tab) to open it as soon as it loads */
    menu.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-kjtb-sj]'); if (!a) return;
      var w = a.getAttribute('data-kjtb-sj');
      if (typeof window.KJTB_OPEN_SJ === 'function' && window.KJTB_OPEN_SJ(w)) { e.preventDefault(); set(false); return; }
      try { sessionStorage.setItem('kjtb_ask', JSON.stringify({ w: w, t: Date.now() })); } catch (x) {}
    });
  }
  /* remembered for a minute in this tab, so moving between pages does not ask every time */
  var KEY = 'kjt_my_me';
  function forget() { try { sessionStorage.removeItem(KEY); } catch (e) {} }
  if (/[?&](kjtb_email_status|kjtb_key_status|loggedout|kjtb_deleted)=/.test(location.search) || C.here) forget();
  document.addEventListener('submit', function (e) { if (e.target && /admin-post\.php/.test(e.target.getAttribute('action') || '')) forget(); }, true);
  document.addEventListener('click', function (e) { var a = e.target.closest && e.target.closest('a[href*="action=logout"]'); if (a) forget(); }, true);
  function show(me) { dict(function () { if (me && me.in) signedIn(me); else signedOut(); }); }
  var cached = null; try { cached = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) {}
  signedOut();
  if (cached && Date.now() - cached.t < 60000) { show(cached.me); return; }
  fetch(C.ajax + '?action=kjtb_me', { credentials: 'same-origin', cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
    var me = j && j.success ? j.data : { in: false };
    try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), me: me })); } catch (e) {}
    show(me);
  }).catch(function () { show({ in: false }); });
})();
