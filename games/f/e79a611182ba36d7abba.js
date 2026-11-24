/* KJT Site Core - a gentle zoom on pictures under the mouse (7.9.1)
   The same soft effect as the picture in "God's Armoury": a picture grows a little inside its frame
   when the mouse is over it. Only pictures that sit in a frame that hides what overflows are zoomed,
   so nothing spills over the text around them. Small icons, games and the Bible text are left alone. */
(function () {
  'use strict';
  if (!window.matchMedia || !matchMedia('(hover: hover)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var SKIP = 'header,footer,#wpadminbar,.kad,.kg-app,.kg-stage,.kk-cs,.kjt-colour,.kp-overlay,.kb-overlay,[data-kjt-nozoom],.emoji,.wp-smiley';
  function host(img) {
    var p = img.parentElement;
    for (var i = 0; p && i < 4; i++, p = p.parentElement) {
      if (p.tagName === 'MAIN' || p.tagName === 'BODY') return null;
      var cs = getComputedStyle(p);
      if (/(hidden|clip)/.test(cs.overflow + cs.overflowX)) return p;
    }
    return null;
  }
  function prepare(img) {
    if (img.__kjtZoom !== undefined) return img.__kjtZoom;
    var ok = false;
    try {
      var r = img.getBoundingClientRect();
      if (r.width >= 120 && r.height >= 80 && !img.closest(SKIP) && img.closest('main')) {
        var h = host(img);
        if (h) { h.classList.add('kjt-zoom-host'); img.classList.add('kjt-zoom'); ok = true; }
      }
    } catch (e) {}
    img.__kjtZoom = ok; return ok;
  }
  /* The picture under the mouse: the picture itself, or one lying under a shade, badge or caption
     (heroes put a coloured layer over the picture), or the picture of the card being pointed at. */
  function under(t, x, y) {
    if (t.tagName === 'IMG') return t;
    for (var p = t, i = 0; p && i < 7 && p.tagName !== 'MAIN' && p.tagName !== 'BODY'; i++, p = p.parentElement) {
      var list = p.getElementsByTagName('img');
      for (var j = 0; j < list.length && j < 6; j++) {
        var r = list[j].getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return list[j];
      }
      if (p.tagName === 'A' && list.length) return list[0];
    }
    return null;
  }
  var cur = null;
  function off() { if (cur) { cur.classList.remove('kjt-zoom--on'); cur = null; } }
  document.addEventListener('mouseover', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    var img = under(t, e.clientX, e.clientY);
    if (img === cur) return;
    off();
    if (img && prepare(img)) { img.classList.add('kjt-zoom--on'); cur = img; }
  }, { passive: true });
  document.addEventListener('mouseleave', off, { passive: true });
  window.addEventListener('blur', off);
})();
