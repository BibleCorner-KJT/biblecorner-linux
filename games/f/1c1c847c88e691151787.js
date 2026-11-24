/* KJT Kids Corner \u00b7 Colouring Studio (Site Core 5.3.1)
   Adds "Colour it here" and "Print to colour" to every colouring card.
   Tools: Fill (tap an area, it fills up to the lines), Pencil (3 sizes,
   outlines always stay on top) and Move; zoom - / + / Fit. Undo, start over,
   print the coloured picture, or save it as an image. Stays on the device. */
(function () {
  function ach(t, k) { try { window.dispatchEvent(new CustomEvent('kjt-achieve', { detail: { type: t, key: k } })); } catch (e) {} }

  'use strict';
  var section = document.getElementById('colouring');
  if (!section) return;

  var PALETTE = [
    ['#E53935', 'Red'], ['#FB8C00', 'Orange'], ['#FDD835', 'Yellow'], ['#7CB342', 'Light green'], ['#2E7D32', 'Green'],
    ['#4FC3F7', 'Sky blue'], ['#1E88E5', 'Blue'], ['#3949AB', 'Dark blue'], ['#8E24AA', 'Purple'], ['#F06292', 'Pink'],
    ['#8D6E63', 'Brown'], ['#5D4037', 'Dark brown'], ['#FFE0BD', 'Skin (light)'], ['#E0AC69', 'Skin (medium)'], ['#8D5524', 'Skin (dark)'],
    ['#F3C548', 'Gold'], ['#BDBDBD', 'Grey'], ['#424242', 'Dark grey'], ['#FFFFFF', 'White (rubber)']
  ];

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
  function hexRgb(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

  /* ---------- print helper (only the picture prints) ---------- */
  function printImage(url, title) {
    var old = document.querySelector('.kjt-colour-print'); if (old) old.remove();
    var box = el('div', { class: 'kjt-colour-print' }, [
      el('img', { src: url, alt: '' }),
      el('p', { text: title + ' \u00b7 Knowing Jesus Today \u00b7 Kids Corner' })
    ]);
    document.body.appendChild(box);
    var img = box.querySelector('img');
    var go = function () {
      document.body.classList.add('kjt-printing-colour');
      var done = function () { document.body.classList.remove('kjt-printing-colour'); box.remove(); window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      window.print();
      setTimeout(function () { if (!window.matchMedia('print').matches && document.body.classList.contains('kjt-printing-colour')) done(); }, 1500);
    };
    if (img.complete) go(); else { img.onload = go; img.onerror = go; }
  }

  /* ---------- studio ---------- */
  var studio = null;
  /* 7.9.40: turn a painting or photo into outlines to colour (stays on the device).
     The picture is softened, its colours grouped into a few areas, tiny areas are merged
     into their neighbours, and the borders between the areas become the lines: every
     area is closed, so Fill works well. */
  function lineArt(d, W, H) {
    var N = W * H, i, x, y, c, K = 9;
    var R = new Float32Array(N), G = new Float32Array(N), B = new Float32Array(N), T = new Float32Array(N);
    for (i = 0; i < N; i++) { R[i] = d.data[i * 4]; G[i] = d.data[i * 4 + 1]; B[i] = d.data[i * 4 + 2]; }
    var r = Math.max(2, Math.round(Math.max(W, H) / 220));
    function blur(A) {
      for (var pass = 0; pass < 2; pass++) for (var dir = 0; dir < 2; dir++) {
        var src = dir ? T : A, dst = dir ? A : T, outer = dir ? W : H, len = dir ? H : W;
        for (var o = 0; o < outer; o++) {
          var sum = 0, cnt = 0, k, at = dir ? function (t) { return t * W + o; } : function (t) { return o * W + t; };
          for (k = 0; k <= r && k < len; k++) { sum += src[at(k)]; cnt++; }
          for (k = 0; k < len; k++) {
            dst[at(k)] = sum / cnt;
            if (k + r + 1 < len) { sum += src[at(k + r + 1)]; cnt++; }
            if (k - r >= 0) { sum -= src[at(k - r)]; cnt--; }
          }
        }
      }
    }
    blur(R); blur(G); blur(B);
    /* k-means on a sample of pixels */
    var cen = [], step = Math.max(1, Math.floor(N / 6000)), sample = [];
    for (i = 0; i < N; i += step) sample.push(i);
    for (c = 0; c < K; c++) { var s0 = sample[Math.floor((c + 0.5) * sample.length / K)]; cen.push([R[s0], G[s0], B[s0]]); }
    function near(j) { var best = 0, bd = 1e12; for (var q = 0; q < K; q++) { var e = cen[q], dr = R[j] - e[0], dg = G[j] - e[1], db = B[j] - e[2], dd = dr * dr * 3 + dg * dg * 4 + db * db * 2; if (dd < bd) { bd = dd; best = q; } } return best; }
    for (var it = 0; it < 10; it++) {
      var acc = []; for (c = 0; c < K; c++) acc.push([0, 0, 0, 0]);
      sample.forEach(function (j) { var q = near(j), v = acc[q]; v[0] += R[j]; v[1] += G[j]; v[2] += B[j]; v[3]++; });
      for (c = 0; c < K; c++) if (acc[c][3]) cen[c] = [acc[c][0] / acc[c][3], acc[c][1] / acc[c][3], acc[c][2] / acc[c][3]];
    }
    var lab = new Uint8Array(N); for (i = 0; i < N; i++) lab[i] = near(i);
    /* smooth the areas (majority of the 5x5 neighbourhood) */
    for (var sm = 0; sm < 2; sm++) {
      var nl = new Uint8Array(lab), cnts = new Uint16Array(K);
      for (y = 2; y < H - 2; y++) for (x = 2; x < W - 2; x++) {
        cnts.fill(0); var bestL = lab[y * W + x], bestC = 0;
        for (var dy = -2; dy <= 2; dy++) for (var dx = -2; dx <= 2; dx++) { var L = lab[(y + dy) * W + x + dx]; if (++cnts[L] > bestC) { bestC = cnts[L]; bestL = L; } }
        nl[y * W + x] = bestL;
      }
      lab = nl;
    }
    /* merge tiny areas into a neighbour */
    var comp = new Int32Array(N).fill(-1), q = new Int32Array(N), minA = Math.max(80, N * 0.002);
    for (i = 0; i < N; i++) {
      if (comp[i] >= 0) continue;
      var qs = 0, qe = 0, L0 = lab[i]; q[qe++] = i; comp[i] = i;
      while (qs < qe) {
        var j = q[qs++], jx = j % W;
        if (jx > 0 && comp[j - 1] < 0 && lab[j - 1] === L0) { comp[j - 1] = i; q[qe++] = j - 1; }
        if (jx < W - 1 && comp[j + 1] < 0 && lab[j + 1] === L0) { comp[j + 1] = i; q[qe++] = j + 1; }
        if (j >= W && comp[j - W] < 0 && lab[j - W] === L0) { comp[j - W] = i; q[qe++] = j - W; }
        if (j < N - W && comp[j + W] < 0 && lab[j + W] === L0) { comp[j + W] = i; q[qe++] = j + W; }
      }
      if (qe < minA) {
        var votes = new Uint32Array(K), k2;
        for (k2 = 0; k2 < qe; k2++) { var m = q[k2], mx = m % W;
          if (mx > 0 && lab[m - 1] !== L0) votes[lab[m - 1]]++; if (mx < W - 1 && lab[m + 1] !== L0) votes[lab[m + 1]]++;
          if (m >= W && lab[m - W] !== L0) votes[lab[m - W]]++; if (m < N - W && lab[m + W] !== L0) votes[lab[m + W]]++; }
        var to = L0, tv = 0; for (c = 0; c < K; c++) if (votes[c] > tv) { tv = votes[c]; to = c; }
        if (to !== L0) for (k2 = 0; k2 < qe; k2++) lab[q[k2]] = to;
      }
    }
    for (i = 0; i < N; i++) {
      x = i % W; var edge = (x < W - 1 && lab[i + 1] !== lab[i]) || (i < N - W && lab[i + W] !== lab[i]);
      var v = edge ? 30 : 255; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255;
    }
    return d;
  }

  function openStudio(src, title, outline) {
    closeStudio();
    var canvas = el('canvas', { class: 'kc-canvas', 'aria-label': 'Colouring picture' });
    var status = el('p', { class: 'kc-status', role: 'status', 'aria-live': 'polite', text: 'Loading the picture\u2026' });
    var current = PALETTE[0][0], tool = 'fill', size = 2, zoom = 1, fit = 1;
    var SIZES = [0, 3, 7, 14];
    var swatches = el('div', { class: 'kc-palette', role: 'radiogroup', 'aria-label': 'Colours' });
    function drawSwatches() {
      swatches.innerHTML = '';
      PALETTE.forEach(function (p) {
        swatches.appendChild(el('button', { class: 'kc-swatch' + (p[0] === '#FFFFFF' ? ' kc-swatch--white' : ''), type: 'button', role: 'radio', 'aria-checked': p[0] === current ? 'true' : 'false', 'aria-label': p[1], title: p[1], style: 'background:' + p[0],
          onclick: function () { current = p[0]; drawSwatches(); } }));
      });
      var more = el('input', { type: 'color', class: 'kc-more', value: PALETTE.some(function (p) { return p[0] === current; }) ? '#00BCD4' : current, 'aria-label': 'Choose any colour', title: 'More colours' });
      more.addEventListener('input', function () { current = more.value.toUpperCase(); drawSwatches(); });
      swatches.appendChild(el('label', { class: 'kc-more-wrap' + (PALETTE.some(function (p) { return p[0] === current; }) ? '' : ' on') }, [more, el('span', { text: '\ud83c\udf08 More' })]));
    }
    drawSwatches();

    /* Tools: fill, pencil (3 sizes), move; zoom \u2212 / + / fit */
    var toolsBox = el('div', { class: 'kc-tools', role: 'group', 'aria-label': 'Tools' });
    var sizesBox = el('div', { class: 'kc-sizes', role: 'group', 'aria-label': 'Pencil size' });
    var zoomLabel = el('span', { class: 'kc-zoom-label', 'aria-live': 'polite' });
    function drawTools() {
      toolsBox.innerHTML = '';
      [['fill', '\ud83e\udea3', 'Fill'], ['pencil', '\u270f\ufe0f', 'Pencil'], ['move', '\u270b', 'Move']].forEach(function (t) {
        toolsBox.appendChild(el('button', { class: 'kc-tool', type: 'button', 'aria-pressed': tool === t[0] ? 'true' : 'false', title: t[2], onclick: function () { tool = t[0]; drawTools(); } }, [el('span', { text: t[1], 'aria-hidden': 'true' }), t[2]]));
      });
      sizesBox.innerHTML = '';
      sizesBox.hidden = tool !== 'pencil';
      [[1, 'Thin'], [2, 'Medium'], [3, 'Thick']].forEach(function (z) {
        sizesBox.appendChild(el('button', { class: 'kc-size', type: 'button', 'aria-pressed': size === z[0] ? 'true' : 'false', 'aria-label': z[1] + ' pencil', title: z[1], onclick: function () { size = z[0]; drawTools(); } }, [el('span', { class: 'kc-dot', style: 'width:' + (4 + z[0] * 5) + 'px;height:' + (4 + z[0] * 5) + 'px' })]));
      });
      canvas.style.touchAction = tool === 'fill' ? 'manipulation' : 'none';
      canvas.style.cursor = tool === 'move' ? 'grab' : tool === 'pencil' ? 'crosshair' : 'pointer';
      help.textContent = tool === 'fill' ? 'Pick a colour, then tap a space to fill it. White works as a rubber.'
        : tool === 'pencil' ? 'Draw with your finger or mouse. The outlines always stay on top.'
        : 'Drag the picture to move around when you have zoomed in.';
    }
    var help = status; /* one small line for tips and messages */
    var zoomBox = el('div', { class: 'kc-zoom', role: 'group', 'aria-label': 'Zoom' }, [
      el('button', { class: 'kc-zbtn', type: 'button', 'aria-label': 'Zoom out', text: '\u2212', onclick: function () { setZoom(zoom / 1.4); } }),
      zoomLabel,
      el('button', { class: 'kc-zbtn', type: 'button', 'aria-label': 'Zoom in', text: '+', onclick: function () { setZoom(zoom * 1.4); } }),
      el('button', { class: 'kc-zbtn kc-zbtn--fit', type: 'button', text: 'Fit', title: 'Show the whole picture', onclick: function () { setZoom(1); } })
    ]);
    function ibtn(icon, label, title, onclick, extra) { return el('button', Object.assign({ class: 'kc-ibtn', type: 'button', title: title, 'aria-label': label, onclick: onclick }, extra || {}), [el('span', { text: icon, 'aria-hidden': 'true' }), el('span', { class: 'kc-lbl', text: label })]); }
    var undoBtn = ibtn('\u21a9\ufe0f', 'Undo', 'Undo (Ctrl+Z)', function () { undo(); }, { disabled: 'disabled' });
    var redoBtn = ibtn('\u21aa\ufe0f', 'Redo', 'Redo (Ctrl+Y)', function () { redo(); }, { disabled: 'disabled' });
    var stage = el('div', { class: 'kc-stage' }, [canvas]);
    var panel = el('div', { class: 'kc-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Colour ' + title }, [
      el('div', { class: 'kc-bar' }, [
        el('h3', { class: 'kc-title', text: '\ud83c\udfa8 ' + title }),
        toolsBox, sizesBox,
        el('div', { class: 'kc-hist', role: 'group', 'aria-label': 'Undo and redo' }, [undoBtn, redoBtn]),
        zoomBox,
        el('button', { class: 'kc-close', type: 'button', 'aria-label': 'Close', title: 'Close', text: '\u2715', onclick: closeStudio })
      ]),
      swatches,
      stage,
      el('div', { class: 'kc-foot' }, [
        status,
        el('div', { class: 'kc-actions' }, [
          ibtn('\ud83e\uddf9', 'Start over', 'Clear all the colours', function () { if (window.confirm('Clear all the colours and start again?')) reset(); }),
          ibtn('\ud83d\udda8\ufe0f', 'Print', 'Print my picture', function () { ach('picture', title); printImage(canvas.toDataURL('image/png'), title); }),
          ibtn('\ud83d\udcbe', 'Save', 'Save my picture', function () { ach('picture', title); save(); }, { class: 'kc-ibtn kc-ibtn--main' })
        ])
      ])
    ]);
    drawTools();
    var overlay = el('div', { class: 'kc-overlay kjt-trail', onclick: function (e) { if (e.target === overlay) closeStudio(); } }, [panel]);
    document.body.appendChild(overlay);
    document.body.classList.add('kc-open');
    studio = { overlay: overlay, keys: function (e) {
      if (e.key === 'Escape') closeStudio();
      var mod = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
      if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    } };
    document.addEventListener('keydown', studio.keys);
    panel.querySelector('.kc-close').focus();

    var W, H, g, lum, wall, colour, out, history = [], future = [];
    function histButtons() { undoBtn.disabled = !history.length; redoBtn.disabled = !future.length; }
    var fills = 0;
    function remember(step) { history.push(step); if (history.length > 40) history.shift(); future = []; histButtons(); fills++; if (fills === 5) ach('picture', title); }
    function undo() { var st = history.pop(); if (!st) return; for (var n = 0; n < st.idx.length; n++) colour[st.idx[n]] = st.prev[n]; future.push(st); render(st.idx); histButtons(); }
    function redo() { var st = future.pop(); if (!st) return; for (var n = 0; n < st.idx.length; n++) colour[st.idx[n]] = st.next; history.push(st); render(st.idx); histButtons(); }
    function setZoom(z) {
      if (!W) return;
      z = Math.max(1, Math.min(6, z));
      /* keep the middle of the view in the middle while zooming */
      var cx = (stage.scrollLeft + stage.clientWidth / 2) / Math.max(1, canvas.offsetWidth), cy = (stage.scrollTop + stage.clientHeight / 2) / Math.max(1, canvas.offsetHeight);
      zoom = z;
      canvas.style.width = Math.round(W * fit * zoom) + 'px';
      canvas.style.height = Math.round(H * fit * zoom) + 'px';
      stage.classList.toggle('zoomed', zoom > 1.01);
      stage.scrollLeft = cx * canvas.offsetWidth - stage.clientWidth / 2;
      stage.scrollTop = cy * canvas.offsetHeight - stage.clientHeight / 2;
      zoomLabel.textContent = Math.round(zoom * 100) + '%';
    }
    function computeFit() {
      var maxW = Math.max(160, stage.clientWidth - 12), maxH = Math.max(160, stage.clientHeight - 12);
      fit = Math.min(maxW / W, maxH / H, 1.5);
    }
    var img = new Image();
    img.onload = function () {
      var k = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
      W = Math.round(img.naturalWidth * k); H = Math.round(img.naturalHeight * k);
      canvas.width = W; canvas.height = H;
      computeFit(); setZoom(1);
      g = canvas.getContext('2d', { willReadFrequently: true });
      g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.drawImage(img, 0, 0, W, H);
      var d; try { d = g.getImageData(0, 0, W, H); } catch (e) { status.textContent = 'This picture cannot be coloured here, but you can still print it.'; return; }
      if (outline) { lineArt(d, W, H); g.putImageData(d, 0, 0); }
      lum = new Uint8Array(W * H); var line = new Uint8Array(W * H);
      for (var i = 0; i < W * H; i++) { var p = i * 4, L = (d.data[p] * 3 + d.data[p + 1] * 6 + d.data[p + 2]) / 10; lum[i] = L; line[i] = L < 170 ? 1 : 0; }
      /* Walls = lines grown by 1 pixel, so small gaps in the drawing don't leak. */
      wall = new Uint8Array(W * H);
      for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
        var j = y * W + x; if (!line[j]) continue;
        for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) { var X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) wall[Y * W + X] = 1; }
      }
      colour = new Uint32Array(W * H).fill(0xFFFFFF);
      out = g.createImageData(W, H);
      render(null);
      status.textContent = 'Ready! Choose Fill or Pencil and start colouring.';
    };
    img.onerror = function () { status.textContent = 'The picture could not be loaded.'; };
    img.src = src;
    window.addEventListener('resize', onResize);
    function onResize() { if (!W || !document.body.contains(canvas)) { window.removeEventListener('resize', onResize); return; } computeFit(); setZoom(zoom); }

    function render(idx) {
      var o = out.data;
      function px(i) { var c = colour[i], f = lum[i] / 255, p = i * 4; o[p] = ((c >> 16) & 255) * f; o[p + 1] = ((c >> 8) & 255) * f; o[p + 2] = (c & 255) * f; o[p + 3] = 255; }
      if (idx) {
        var minX = W, minY = H, maxX = 0, maxY = 0;
        for (var n = 0; n < idx.length; n++) { var q = idx[n], qx = q % W, qy = (q / W) | 0; px(q); if (qx < minX) minX = qx; if (qx > maxX) maxX = qx; if (qy < minY) minY = qy; if (qy > maxY) maxY = qy; }
        if (maxX >= minX) g.putImageData(out, 0, 0, minX, minY, maxX - minX + 1, maxY - minY + 1);
      } else { for (var i = 0; i < W * H; i++) px(i); g.putImageData(out, 0, 0); }
    }
    function toImage(e) { var r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
    function fill(sx, sy, rgb) {
      var start = sy * W + sx;
      if (wall[start]) { /* tapped on a line: use the nearest open space */
        var best = -1, bd = 1e9;
        for (var dy = -6; dy <= 6; dy++) for (var dx = -6; dx <= 6; dx++) { var X = sx + dx, Y = sy + dy; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; var j = Y * W + X; if (!wall[j] && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = j; } }
        if (best < 0) return null; start = best;
      }
      var target = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
      if (colour[start] === target) return null;
      var seen = new Uint8Array(W * H), q = new Int32Array(W * H), qs = 0, qe = 0, region = [];
      q[qe++] = start; seen[start] = 1;
      while (qs < qe) {
        var i = q[qs++]; region.push(i);
        var x = i % W, y = (i / W) | 0;
        if (x > 0 && !seen[i - 1] && !wall[i - 1]) { seen[i - 1] = 1; q[qe++] = i - 1; }
        if (x < W - 1 && !seen[i + 1] && !wall[i + 1]) { seen[i + 1] = 1; q[qe++] = i + 1; }
        if (y > 0 && !seen[i - W] && !wall[i - W]) { seen[i - W] = 1; q[qe++] = i - W; }
        if (y < H - 1 && !seen[i + W] && !wall[i + W]) { seen[i + W] = 1; q[qe++] = i + W; }
      }
      /* Grow the colour up to the real line (under the 1-pixel wall), so there is no white edge. */
      for (var pass = 0; pass < 2; pass++) {
        var edge = [];
        for (var r = 0; r < region.length; r++) {
          var k = region[r], kx = k % W, ky = (k / W) | 0;
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { var X = kx + o[0], Y = ky + o[1]; if (X < 0 || Y < 0 || X >= W || Y >= H) return; var j = Y * W + X; if (!seen[j] && lum[j] >= 170 - pass * 40) { seen[j] = 1; edge.push(j); } });
        }
        region = region.concat(edge);
      }
      var idx = Uint32Array.from(region), prev = new Uint32Array(idx.length);
      for (var n = 0; n < idx.length; n++) { prev[n] = colour[idx[n]]; colour[idx[n]] = target; }
      return { idx: idx, prev: prev, next: target };
    }
    /* Pencil: paint a round brush along the stroke into the colour layer
       (outlines stay dark because the drawing is laid on top). */
    var stroke = null;
    function dab(x, y, rgb) {
      var rad = SIZES[size], target = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2], changed = [];
      var x0 = Math.max(0, Math.floor(x - rad)), x1 = Math.min(W - 1, Math.ceil(x + rad)), y0 = Math.max(0, Math.floor(y - rad)), y1 = Math.min(H - 1, Math.ceil(y + rad));
      for (var yy = y0; yy <= y1; yy++) for (var xx = x0; xx <= x1; xx++) {
        if ((xx - x) * (xx - x) + (yy - y) * (yy - y) > rad * rad) continue;
        var i = yy * W + xx; if (colour[i] === target) continue;
        if (!stroke.prev.has(i)) stroke.prev.set(i, colour[i]);
        colour[i] = target; changed.push(i);
      }
      return changed;
    }
    function segment(a, b, rgb) {
      var dist = Math.hypot(b[0] - a[0], b[1] - a[1]), steps = Math.max(1, Math.ceil(dist / Math.max(1, SIZES[size] / 2))), all = [];
      for (var t = 1; t <= steps; t++) all = all.concat(dab(a[0] + (b[0] - a[0]) * t / steps, a[1] + (b[1] - a[1]) * t / steps, rgb));
      if (all.length) render(all);
    }
    var down = null, pan = null;
    canvas.addEventListener('pointerdown', function (e) {
      if (!wall) return;
      if (tool === 'move') { pan = { x: e.clientX, y: e.clientY, l: stage.scrollLeft, t: stage.scrollTop }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; return; }
      if (tool === 'pencil') {
        e.preventDefault(); canvas.setPointerCapture(e.pointerId);
        var p = toImage(e); stroke = { last: p, prev: new Map(), rgb: hexRgb(current) };
        var ch = dab(p[0], p[1], stroke.rgb); if (ch.length) render(ch);
        return;
      }
      down = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('pointermove', function (e) {
      if (pan) { stage.scrollLeft = pan.l - (e.clientX - pan.x); stage.scrollTop = pan.t - (e.clientY - pan.y); return; }
      if (stroke) { var p = toImage(e); segment(stroke.last, p, stroke.rgb); stroke.last = p; }
    });
    function endStroke() {
      if (!stroke) return;
      if (stroke.prev.size) {
        var idx = new Uint32Array(stroke.prev.size), prev = new Uint32Array(stroke.prev.size), n = 0;
        stroke.prev.forEach(function (v, k) { idx[n] = k; prev[n] = v; n++; });
        remember({ idx: idx, prev: prev, next: (stroke.rgb[0] << 16) | (stroke.rgb[1] << 8) | stroke.rgb[2] });
      }
      stroke = null;
    }
    canvas.addEventListener('pointerup', function (e) {
      if (pan) { pan = null; canvas.style.cursor = 'grab'; return; }
      if (stroke) { endStroke(); return; }
      if (!down || tool !== 'fill') return;
      var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
      if (moved > 10) return; /* it was a scroll or drag, not a tap */
      var p = toImage(e), x = Math.floor(p[0]), y = Math.floor(p[1]);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      var step = fill(x, y, hexRgb(current));
      if (!step) return;
      remember(step);
      render(step.idx);
    });
    canvas.addEventListener('pointercancel', function () { down = null; pan = null; endStroke(); });
    /* Ctrl/\u2318 + mouse wheel zooms too. */
    stage.addEventListener('wheel', function (e) { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)); }, { passive: false });
    function reset() { if (!colour) return; colour.fill(0xFFFFFF); history = []; future = []; histButtons(); render(null); }
    function save() {
      canvas.toBlob(function (b) {
        if (!b) return; var url = URL.createObjectURL(b), a = el('a', { href: url, download: 'my-colouring-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png' });
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        status.textContent = 'Saved! Look in your downloads.';
      }, 'image/png');
    }
  }
  function closeStudio() {
    if (!studio) return;
    document.removeEventListener('keydown', studio.keys);
    studio.overlay.remove(); studio = null; document.body.classList.remove('kc-open');
  }

  /* ---------- add buttons to every colouring card ---------- */
  function decorate() {
    section.querySelectorAll('article').forEach(function (card) {
      if (card.dataset.kcReady) return;
      var img = card.querySelector('img'); if (!img) return;
      card.dataset.kcReady = '1';
      var title = (card.querySelector('h3') || {}).textContent || 'Colouring page';
      var src = img.currentSrc || img.src;
      var row = el('div', { class: 'kc-card-actions' }, [
        el('button', { class: 'kc-card-btn kc-card-btn--main', type: 'button', text: '\ud83c\udfa8 Colour it here', onclick: function () { openStudio(src, title.trim()); } }),
        el('button', { class: 'kc-card-btn', type: 'button', text: '\ud83d\udda8\ufe0f Print to colour', onclick: function () { printImage(src, title.trim()); } })
      ]);
      var body = card.querySelector('h3') ? card.querySelector('h3').parentElement : card;
      var link = body.querySelector('a');
      if (link) body.insertBefore(row, link); else body.appendChild(row);
    });
  }
  /* 7.9.40: colour any picture of the website */
  var SITE = []; try { SITE = JSON.parse((document.getElementById('kjt-site-pics') || {}).textContent || '[]'); } catch (e) {}
  function T(x) { try { return window.KJT_LANG && KJT_LANG.lang !== 'en' ? KJT_LANG.t(x) : x; } catch (e) { return x; } }
  function openChooser() {
    var old = document.querySelector('.kc-choose'); if (old) old.remove();
    var list = SITE.filter(function (p) { return p.kind === 'line'; }).concat(SITE.filter(function (p) { return p.kind !== 'line'; }));
    var grid = el('div', { class: 'kc-choose__g' });
    var box = el('div', { class: 'kc-choose kc-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': T('Choose a picture to colour'), onclick: function (e) { if (e.target === box) close(); } }, [
      el('div', { class: 'kc-choose__p' }, [
        el('div', { class: 'kc-choose__h' }, [
          el('h3', { text: T('Choose a picture to colour') }),
          el('button', { class: 'kc-card-btn', type: 'button', text: '\u2715 ' + T('Close'), onclick: function () { close(); } })
        ]),
        el('p', { class: 'kc-choose__n', text: T('Paintings and photos are turned into outlines for you to colour.') }),
        grid
      ])
    ]);
    function close() { box.remove(); document.removeEventListener('keydown', esc); document.body.classList.remove('kc-open'); }
    function esc(e) { if (e.key === 'Escape') close(); }
    list.forEach(function (p) {
      var b = el('button', { class: 'kc-choose__i' + (p.kind === 'line' ? ' is-line' : ''), type: 'button', title: p.name }, [el('img', { src: p.src, alt: '', loading: 'lazy', decoding: 'async' })]);
      b.setAttribute('aria-label', p.name);
      b.addEventListener('click', function () { close(); openStudio(p.src, p.name, p.kind !== 'line'); });
      grid.appendChild(b);
    });
    document.body.appendChild(box); document.body.classList.add('kc-open');
    document.addEventListener('keydown', esc);
    var f = box.querySelector('button'); if (f) f.focus();
  }
  if (SITE.length && !section.querySelector('.kc-more')) {
    var more = el('div', { class: 'kc-more' }, [el('button', { class: 'kc-card-btn kc-card-btn--main', type: 'button', text: '\ud83d\uddbc\ufe0f ' + T('Colour any picture from the website'), onclick: openChooser })]);
    /* put it just above the row of colouring cards */
    var total = section.querySelectorAll('article').length, row = section.querySelector('article');
    while (row && row.parentElement && row.parentElement.querySelectorAll('article').length < total) row = row.parentElement;
    row = row && row.parentElement; /* the row holding every card */
    if (row && row.parentElement && row.parentElement !== section && !row.parentElement.querySelector('h2')) row = row.parentElement;
    if (row && row.parentElement) row.parentElement.insertBefore(more, row); else section.appendChild(more);
  }

  decorate();
  new MutationObserver(decorate).observe(section, { childList: true, subtree: true });
})();
