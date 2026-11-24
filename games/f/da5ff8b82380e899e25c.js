/* KJT Site Core - media cards and rails (7.8.0; was inline "3.7.0" code).
 *
 * 1. Media rails (sideways-scrolling lists of videos, audio, episodes...):
 *    the arrow keys scroll them, and a rail with no left/right buttons gets a pair.
 * 2. Media cards that carry a link open it when clicked or when Enter is pressed.
 *    Cards with no link are left alone rather than guessed.
 *
 * Rails are recognised by what they are: a list marked as a media rail, or a
 * list of several items that scrolls sideways. Nothing depends on the names of
 * styling classes, so restyling a page does not break it.
 */
(function () {
  'use strict';

  var MEDIA_WORDS = /video|audio|episode|kids|superbook|favourites|informative|reflect|film/i;
  var MARKED = '.video-rail,.audio-rail,[data-kjt-media-rail]';

  function scrollsSideways(el) {
    var x = window.getComputedStyle(el).overflowX;
    return x === 'auto' || x === 'scroll';
  }

  function stepFor(rail) { return Math.max(260, Math.floor(rail.clientWidth * 0.82)); }
  /* 7.9.16: buttons are recognised by their English label, kept by the page translator in
     data-kjt-en-label, so the arrows work in every language (in French and Spanish they did nothing
     and a second pair was added; in Arabic they did nothing). Right to left, "next" scrolls the other way. */
  function label(b) { return (b.getAttribute('data-kjt-en-label') || b.getAttribute('aria-label') || '').toLowerCase(); }
  function rtl(rail) { return window.getComputedStyle(rail).direction === 'rtl'; }
  function go(rail, dir) { rail.scrollBy({ left: (rtl(rail) ? -dir : dir) * stepFor(rail), behavior: 'smooth' }); }
  function pos(rail) { return Math.abs(rail.scrollLeft); }
  function findRailFor(b) {
    var s = b.closest('section,[id]'); if (!s) return null; var l = label(b);
    return l.indexOf('tools') >= 0 ? s.querySelector(':is([aria-label="Scrollable tool list"],[data-kjt-en-label="Scrollable tool list"])') || s.querySelector('.overflow-x-auto') : s.querySelector('.video-rail,.audio-rail,.bfp-card-row,.overflow-x-auto,[data-kjt-media-rail]');
  }
  function wirePair(p, n, rail) {
    if (!p || !n || !rail || p.dataset.kjtThemeRailWired || n.dataset.kjtThemeRailWired) return;
    p.dataset.kjtThemeRailWired = n.dataset.kjtThemeRailWired = '1'; rail.dataset.kjtRailBound = '1';
    function state() { var m = Math.max(0, rail.scrollWidth - rail.clientWidth - 3); p.disabled = pos(rail) <= 3; n.disabled = pos(rail) >= m; p.classList.toggle('kjt-rail-disabled', p.disabled); n.classList.toggle('kjt-rail-disabled', n.disabled); }
    p.addEventListener('click', function (e) { e.preventDefault(); e.stopImmediatePropagation(); go(rail, -1); setTimeout(state, 400); }, true);
    n.addEventListener('click', function (e) { e.preventDefault(); e.stopImmediatePropagation(); go(rail, 1); setTimeout(state, 400); }, true);
    rail.addEventListener('scroll', state, { passive: true }); window.addEventListener('resize', state); setTimeout(state, 100);
  }
  function wirePairs() {
    document.querySelectorAll('button[aria-label]').forEach(function (p) {
      if (!/(left|previous)/.test(label(p)) || p.dataset.kjtThemeRailWired) return;
      var h = p.parentElement; if (!h) return;
      var n = Array.prototype.filter.call(h.querySelectorAll('button[aria-label]'), function (b) { return b !== p && /(right|next)/.test(label(b)); })[0];
      wirePair(p, n, findRailFor(p));
    });
  }

  function findRails() {
    var found = [];
    var seen = new Set();
    var add = function (el) { if (!seen.has(el)) { seen.add(el); found.push(el); } };
    document.querySelectorAll(MARKED).forEach(add);
    /* Lists that scroll sideways (only elements that hold several items). */
    document.querySelectorAll('div,ul,ol').forEach(function (el) {
      if (el.children.length > 1 && scrollsSideways(el)) add(el);
    });
    return found.filter(function (rail) {
      if (rail.dataset.kjtRailBound) return false;
      var section = rail.closest('section');
      var text = ((rail.getAttribute('data-kjt-en-label')||rail.getAttribute('aria-label')) || '') + ' ' + (section ? section.textContent || '' : '').slice(0, 300);
      return rail.children.length > 1 && MEDIA_WORDS.test(text);
    });
  }

  function makeButton(dir, label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.textContent = dir < 0 ? '‹' : '›';
    b.style.cssText = 'width:40px;height:40px;border-radius:999px;border:1px solid #e9c83b;background:#e9c83b;color:#3e093f;font-size:26px;line-height:1';
    b.dataset.dir = dir;
    return b;
  }

  function bindRail(rail) {
    rail.dataset.kjtRailBound = '1';
    rail.dataset.kjtMediaRail = '1';
    var section = rail.closest('section') || rail.parentElement;
    var controls = section ? Array.prototype.filter.call(section.querySelectorAll('button'), function (b) {
      return /scroll .* (left|right)|previous|next/i.test(label(b));
    }) : [];
    if (controls.length < 2) {
      /* Only add buttons when the page has none of its own. */
      var bar = document.createElement('div');
      bar.className = 'kjt-rail-controls';
      bar.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin:8px 0';
      bar.append(makeButton(-1, 'Scroll media left'), makeButton(1, 'Scroll media right'));
      rail.before(bar);
      controls = Array.prototype.slice.call(bar.querySelectorAll('button'));
    }
    controls.forEach(function (b, i) {
      if (b.dataset.kjtThemeRailWired) return;
      b.dataset.kjtThemeRailWired = '1';
      var l = label(b);
      var dir = /left|previous/.test(l) ? -1 : /right|next/.test(l) ? 1 : (i ? 1 : -1);
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopImmediatePropagation(); go(rail, dir); }, true);
    });
    rail.addEventListener('keydown', function (e) {
      var r = rtl(rail);
      if (e.key === 'ArrowRight') { e.preventDefault(); go(rail, r ? -1 : 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(rail, r ? 1 : -1); }
    });
  }

  function cardLink(card) {
    var a = card.querySelector('a[href]');
    if (a && a.href && !a.href.endsWith('#')) return a.href;
    var els = [card].concat(Array.prototype.slice.call(card.querySelectorAll('[data-url],[data-href],[data-kjt-url]')));
    for (var i = 0; i < els.length; i++) {
      var d = els[i].dataset || {};
      var u = d.kjtUrl || d.url || d.href;
      if (u) return u;
    }
    return '';
  }

  function bindCards() {
    document.querySelectorAll('.video-rail > *, .audio-rail > *, [data-kjt-media-rail] > *').forEach(function (card) {
      if (card.dataset.kjtCardBound) return;
      var url = cardLink(card);
      if (!url) return;
      card.dataset.kjtCardBound = '1';
      card.classList.add('kjt-media-clickable');
      if (!card.hasAttribute('tabindex')) card.tabIndex = 0;
      card.addEventListener('click', function (e) {
        if (e.target.closest('a,button,input,select,textarea')) return;
        location.href = url;
      });
      card.addEventListener('keydown', function (e) {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('a,button')) { e.preventDefault(); location.href = url; }
      });
    });
  }

  function start() { wirePairs(); findRails().forEach(bindRail); bindCards(); setTimeout(wirePairs, 1500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
