/* KJT Site Core - page languages (7.9.0)
   One language engine for the site's pages, starting with Kids Corner. The same six
   languages as the Holy Bible page (English, Arabic, French, Spanish, Chinese, Hindi, Tagalog), and
   the same choice: picking a language here or on the Holy Bible page is remembered on this
   device for both (localStorage "kjtb_ui_lang"). ?lang=xx in the address also works.

   - The words come from word lists in assets/i18n/<area>-<lang>.json ("English": "translation").
     A text not in the list stays in English. Numbers are matched too: "{0} stars" covers
     "3 stars". "__patterns" holds [regular expression, replacement] pairs for the rest.
   - Arabic reads right to left.
   - Scripture shown by the readers, names children type, and anything inside
     [data-kjt-notr] are never translated.
   - Other scripts can use window.KJT_LANG: .lang, .t(text), .on(fn) (when the words are ready).
   - Administrators see a "still in English" list (visitors never do). */
(function () {
  'use strict';
  var CFG = window.KJT_LANG_CFG || {};
  var LANGS = CFG.langs || { en: { name: 'English', dir: 'ltr' } };
  var KEY = 'kjtb_ui_lang';
  var lang = 'en';
  try {
    var q = new URLSearchParams(location.search).get('lang');
    /* 7.9.25: a page whose address already carries its language (biblecorner.com/es/…) */
    if (CFG.lang && LANGS[CFG.lang]) { lang = CFG.lang; try { localStorage.setItem(KEY, lang); } catch (x) {} }
    else if (q && LANGS[q]) lang = q;
    else { var s = localStorage.getItem(KEY); if (s && LANGS[s]) lang = s; }
  } catch (e) {}
  var ON = lang !== 'en', META = LANGS[lang] || {}, RTL = META.dir === 'rtl';
  /* the Church readings and feasts (KJT Local Bible) translate themselves: tell them the language */
  if (!window.KJTB_UI_LANG) window.KJTB_UI_LANG = lang;
  var D = null, PATS = [], BKRE = null, VALS = {}, ready = [], missing = {};
  var api = window.KJT_LANG = {
    lang: lang, on: function (fn) { if (!ON || D) fn(lang); else ready.push(fn); },
    t: function (s) { return tr(s); },
    en: function (el) { if (el.__kjtEnText != null) return el.__kjtEnText; var w = document.createTreeWalker(el, 4), n, o = ''; while ((n = w.nextNode())) o += n.__kjtEn != null ? n.__kjtEn : n.nodeValue; return o; }, dir: RTL ? 'rtl' : 'ltr', langs: LANGS
  };
  /* keep the address in step, so a shared link opens in the same language */
  try {
    var u0 = new URL(location.href);
    if (ON && !CFG.keepUrl && u0.searchParams.get('lang') !== lang) { u0.searchParams.set('lang', lang); history.replaceState(history.state, '', u0.href); }
  } catch (e) {}
  if (ON && CFG.server) document.documentElement.classList.add('kjt-lang-' + lang); /* 7.10.0: the server already translated the page: nothing to hide */
  else if (ON) {
    document.documentElement.classList.add('kjt-lang-' + lang, 'kjt-i18n-wait');
    setTimeout(function () { document.documentElement.classList.remove('kjt-i18n-wait'); }, 2500);
  }

  /* ---------- translating one text ---------- */
  var EDGE = /^([\s ←-⇿⌀-⏿①-➿⬀-⯿️‍•·—–\-:|()\[\]“”«»]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF])*/;
  var EDGE_END = /([\s ←-⇿⌀-⏿①-➿⬀-⯿️‍•·—–\-:|()\[\]“”«»]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDFFF])*$/;
  /* 7.9.14: long Scripture keys are stored by a short fingerprint ("#" + FNV-1a of the text), which keeps
     the word lists small; the page computes the same fingerprint. */
  function fp(s) { var h = 0x811c9dc5; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return '#' + h.toString(36) + '.' + s.length; }
  function has(k) { if (Object.prototype.hasOwnProperty.call(D, k)) return D[k]; if (k.length > 120) { var f = fp(k); if (Object.prototype.hasOwnProperty.call(D, f)) return D[f]; } return null; }
  var NOEMO = null;
  function look(s) {
    if (!s) return null;
    var hv = has(s); if (hv != null) return hv;
    /* 7.9.26: a label whose emoji was already turned into a picture ("👁️ Show my key" seen as "Show my key") */
    if (!NOEMO) { NOEMO = {}; for (var q in D) { if (q.charAt(0) === '_' || !Object.prototype.hasOwnProperty.call(D, q) || typeof D[q] !== 'string') continue; var e1 = (q.match(EDGE) || [''])[0]; if (e1 && e1.trim()) { var r1 = q.slice(e1.length); if (r1 && !NOEMO[r1]) { var tv = D[q], e2 = (tv.match(EDGE) || [''])[0]; NOEMO[r1] = tv.slice(e2.length); } } } }
    if (Object.prototype.hasOwnProperty.call(NOEMO, s)) return NOEMO[s];
    /* numbers: "3 stars" -> "{0} stars" */
    var nums = [], k = s.replace(/\d+(?:[.,]\d+)?/g, function (n) { nums.push(n); return '{' + (nums.length - 1) + '}'; });
    if (nums.length && Object.prototype.hasOwnProperty.call(D, k)) return D[k].replace(/\{(\d+)\}/g, function (m, i) { return nums[+i] != null ? nums[+i] : m; });
    /* Bible references: "Psalm 23:1" -> the book's name in the page language */
    if (BKRE) { var mb = s.match(BKRE); if (mb && /^\s+\d[\d:.,–\-\s&]*$/.test(s.slice(mb[0].length))) return ((D.__bookrefs && D.__bookrefs[mb[1]]) || D.__books[mb[1]]) + refNums(mb[1], s.slice(mb[0].length)); }
    for (var i = 0; i < PATS.length; i++) {
      var m = s.match(PATS[i][0]);
      if (m) return PATS[i][1].replace(/\$(\d)|\$t(\d)/g, function (x, a, b) { if (a) return m[+a] || ''; var keep = NOREC; NOREC = true; var o = tr(m[+b] || ''); NOREC = keep; return o; });
    }
    return null;
  }
  /* 7.9.34: Greek and Russian Bibles number the Psalms (and a few other chapters) as the Septuagint does:
     "Psalm 23:1" is shown as Psalm 22:1 there, the number the reader will find in that Bible. */
  var VM = null;
  function bookCode(name) {
    var i = BK_EN.indexOf(name); if (i >= 0) return BK_CODE[i];
    if (name === 'Psalm') return 'PSA';
    var t = D.__books && D.__books[name]; if (!t) return '';
    for (var j = 0; j < BK_EN.length; j++) if (D.__books[BK_EN[j]] === t) return BK_CODE[j];
    return '';
  }
  function vmap(code, c, v) {
    if (VM) for (var i = 0; i < VM.length; i++) { var r = VM[i]; if (r[0] === code && r[1] === c && (v || 1) >= r[2] && (v || 1) <= r[3]) return [r[4], v ? r[5] + v - r[2] : 0]; }
    return [c, v];
  }
  function refNums(name, rest) {
    if (!VM) return rest;
    var code = bookCode(name); if (!code) return rest;
    var m = /^(\s+)(\d+)(?::(\d+)(?:([-–])(\d+)(?::(\d+))?)?)?(.*)$/.exec(rest); if (!m) return rest;
    var c = +m[2], v = m[3] ? +m[3] : 0, a = vmap(code, c, v), out = m[1] + a[0] + (v ? ':' + a[1] : '');
    if (m[5]) {
      if (m[6]) { var z = vmap(code, +m[5], +m[6]); out += m[4] + (z[0] !== a[0] ? z[0] + ':' : '') + z[1]; }
      else { var z2 = vmap(code, c, +m[5]); out += m[4] + (z2[0] !== a[0] ? z2[0] + ':' : '') + z2[1]; }
    }
    return out + m[7];
  }
  function tr(v) {
    if (!ON || !D || v == null) return v;
    var s = String(v); if (!/[A-Za-z]/.test(s)) return s;
    var lead = s.match(/^\s*/)[0], tail = s.match(/\s*$/)[0], core = s.trim();
    if (VALS[core] || VALS[core.replace(/\d+(?:[.,]\d+)?/g, '#')]) return v;
    var out = look(core);
    if (out == null) {
      /* emoji, arrows and dots at either end are kept as they are */
      var a = (core.match(EDGE) || [''])[0], rest = core.slice(a.length), b = (rest.match(EDGE_END) || [''])[0], mid = rest.slice(0, rest.length - b.length);
      if (mid && mid !== core) { var o2 = look(mid); if (o2 != null) out = a + o2 + (RTL ? flip(b) : b); }
      if (out == null && a && rest && rest !== mid) { var o3 = look(rest); if (o3 != null) out = a + o3; }
      if (out == null && (VALS[mid] || VALS[rest])) return v;
    }
    if (out == null) { if (!NOREC && core.length > 1 && /[A-Za-z]{2}/.test(core) && !KEEP.test(core)) missing[core] = 1; return v; }
    VALS[out.trim()] = 1;
    return lead + out + tail;
  }
  /* video titles and file names stay as they are */
  var KEEP = /^(KJT ☦|KJVA?|KJV|LSG|RV1909|CUV)$|Superbook|Superlibro|SUPERBOOK|スーパーブック|^LIVE \||\.(jpe?g|png|gif|webp)$/;
  function flip(s) { return s.replace(/→/g, '\u0001').replace(/←/g, '→').replace(/\u0001/g, '←'); }

  /* ---------- the page ---------- */
  /* 7.9.14: on the whole site (CFG.chrome) the header, menus and footer are translated too */
  var SKIP = 'script,style,textarea,code,pre,[data-kjt-notr],.kb-text,.kb-v,.kjtb,.kjtb-lect,.kjtb-feasts,.kp-keybox,.kp-name,#wpadminbar,.kjt-langmenu' + (CFG.chrome ? '' : ',header,footer');
  var SKIP_ATTR = 'script,style,[data-kjt-notr],#wpadminbar' + (CFG.chrome ? '' : ',header,footer');
  var ROOTS = CFG.roots || 'main';
  function skipped(el) { return !el || (el.closest && el.closest(SKIP)); }
  function doText(n) {
    var el = n.parentElement; if (skipped(el)) return;
    if (el.closest && (function (x) { while (x) { if (x.__kjtTx) return true; x = x.parentElement; } return false; })(el)) return;
    var v = n.nodeValue;
    if (RTL && v && !n.__kjtArrow && /^\s*[\u2190\u2192]\s*$/.test(v)) { n.__kjtArrow = 1; n.nodeValue = v.replace(/[\u2190\u2192]/, function (c) { return c === '\u2192' ? '\u2190' : '\u2192'; }); return; } /* 7.9.16: a lone arrow points the way the page reads */
    if (!v || !/[A-Za-z]/.test(v)) return;
    if (n.__kjtEn == null) n.__kjtEn = v; /* 7.9.19: the English is kept, so scripts can still recognise a card by its English name */
    NOREC = false;
    var o = tr(v); NOREC = false;
    if (o !== v && o.indexOf(VMARK) >= 0) return verse(o, function (t) { n.nodeValue = t; });
    if (o !== v) n.nodeValue = o;
  }
  /* 7.9.14: Scripture is not translated by hand: the word list says which verses they are
     ("§v:JHN:3:16:16"), and the text comes from the Bible of the page's language on this site. */
  var VMARK = '\u00a7v:', VCACHE = {};
  /* 7.9.34: the verses are asked for together (up to 60 in one request): a page with hundreds of verses
     sent one request for each, the web host refused many of them, and the English stayed. Verses already
     fetched are kept for this visit (sessionStorage), and a request that fails is tried again once. */
  var VQ = [], VT = null, SS = null; try { SS = window.sessionStorage; } catch (e) {}
  function vget(k) { try { return SS ? SS.getItem('kjtv:' + k) : null; } catch (e) { return null; } }
  function vset(k, t) { try { if (SS) SS.setItem('kjtv:' + k, t); } catch (e) {} }
  function vtext(j, bible) { return j && j.length ? j.map(function (x) { return String(x[2]).replace(/<[^>]+>/g, ''); }).join(' ').trim() : null; }
  function vflush() {
    VT = null;
    var all = VQ.splice(0), groups = {};
    all.forEach(function (q) { (groups[q.bible] = groups[q.bible] || []).push(q); });
    Object.keys(groups).forEach(function (bible) {
      var list = groups[bible];
      for (var i = 0; i < list.length; i += 60) vsend(bible, list.slice(i, i + 60), 0);
    });
  }
  function vsend(bible, part, tries) {
    if (!CFG.passages) { part.forEach(function (q) { vone(q, bible); }); return; }
    var url = CFG.passages + (CFG.passages.indexOf('?') < 0 ? '?' : '&') + 'tr=' + encodeURIComponent(bible) + '&q=' + part.map(function (q) { return q.ref; }).join(',');
    fetch(url).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !j.items) throw 0;
      part.forEach(function (q, i) { var t = j.translation === bible ? vtext(j.items[i]) : null; if (t) vset(q.key, t); q.done(t); });
    }).catch(function () {
      if (tries < 1) setTimeout(function () { vsend(bible, part, tries + 1); }, 1500);
      else part.forEach(function (q) { q.done(null); });
    });
  }
  function vone(q, bible) {
    var m = q.m;
    fetch(CFG.passage + (CFG.passage.indexOf('?') < 0 ? '?' : '&') + 'code=' + m[1] + '&c=' + m[2] + '&c2=' + (m[5] || m[2]) + '&v1=' + m[3] + '&v2=' + m[4] + '&tr=' + encodeURIComponent(bible))
      .then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { var t = j && j.translation === bible ? vtext(j.verses) : null; if (t) vset(q.key, t); q.done(t); }).catch(function () { q.done(null); });
  }
  function verse1(m) {
    var bible = (LANGS[lang] || {}).bible || '', key = m.slice(1).join('.') + '@' + bible;
    if (VCACHE[key]) return VCACHE[key];
    var hit = vget(key); if (hit) return (VCACHE[key] = Promise.resolve(hit));
    return (VCACHE[key] = new Promise(function (done) {
      VQ.push({ m: m, key: key, bible: bible, ref: [m[1], m[2], m[3], m[4], m[5] || m[2]].join('.'), done: done });
      if (!VT) VT = setTimeout(vflush, 40);
    }));
  }
  /* 7.9.14: other scripts ask for a passage in the page's language: KJT_LANG.passage('Malachi', 1, 13, 14)
     gives a promise of the text, or null when the language's Bible is not installed. */
  var BK_EN = 'Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation'.split('|'), BK_CODE = 'GEN|EXO|LEV|NUM|DEU|JOS|JDG|RUT|1SA|2SA|1KI|2KI|1CH|2CH|EZR|NEH|EST|JOB|PSA|PRO|ECC|SNG|ISA|JER|LAM|EZK|DAN|HOS|JOL|AMO|OBA|JON|MIC|NAM|HAB|ZEP|HAG|ZEC|MAL|MAT|MRK|LUK|JHN|ACT|ROM|1CO|2CO|GAL|EPH|PHP|COL|1TH|2TH|1TI|2TI|TIT|PHM|HEB|JAS|1PE|2PE|1JN|2JN|3JN|JUD|REV'.split('|');
  api.passage = function (book, c, v1, v2) {
    var k = BK_EN.indexOf(String(book).replace(/^Psalm$/, 'Psalms').replace(/^Song of Songs$/, 'Song of Solomon'));
    if (!ON || k < 0 || !CFG.passage) return Promise.resolve(null);
    return verse1([null, BK_CODE[k], String(c), String(v1 || 1), String(v2 || v1 || 1)]);
  };
  /* One value can hold several verse markers next to ordinary text or HTML (a reference link, a
     heading); each marker becomes that passage in the language's Bible. If any passage is missing
     the English stays. html=true escapes the verse text for innerHTML. */
  function verse(o, put, html) {
    if (!CFG.passage) return;
    var re = /§v:([0-9A-Z]+):(\d+):(\d+):(\d+)(?::(\d+))?/g, ms = [], m;
    while ((m = re.exec(o))) ms.push(m);
    if (!ms.length) return;
    Promise.all(ms.map(verse1)).then(function (ts) {
      if (ts.some(function (t) { return !t; })) return;
      var i = 0, r = o.replace(re, function () { var t = ts[i++]; return html ? t.replace(/&/g, '&amp;').replace(/</g, '&lt;') : t; });
      r.replace(/<[^>]+>/g, '\u0000').split('\u0000').forEach(function (x) { x = x.replace(/&amp;/g, '&').replace(/&lt;/g, '<').trim(); if (x) VALS[x] = 1; });
      put(r);
    });
  }
  var NOREC = false;
  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  /* 7.9.34: pictures with writing on them have a copy for each language (the Ten Commandments in the Armoury):
     CFG.langImages = { 'file.webp': ['ar', 'el', …] } -> file-ar.webp on the Arabic page */
  function langImg(el) {
    if (el.tagName !== 'IMG' || el.__kjtImg || !CFG.langImages) return;
    var src = el.getAttribute('src') || '';
    for (var f in CFG.langImages) {
      if (src.slice(-f.length - 1) === '/' + f && CFG.langImages[f].indexOf(lang) >= 0) {
        el.__kjtImg = 1; el.setAttribute('src', src.slice(0, -f.length) + f.replace(/(\.\w+)$/, '-' + lang + '$1'));
        if (el.getAttribute('srcset')) el.removeAttribute('srcset');
        return;
      }
    }
  }
  function doAttrs(el) {
    if (el.tagName === 'IMG') langImg(el);
    if (!el.getAttribute || skipped(el.parentElement || el) && el.tagName !== 'INPUT') return;
    if (el.closest && el.closest(SKIP_ATTR)) return;
    ATTRS.forEach(function (a) { var v = el.getAttribute(a); if (v && /[A-Za-z]/.test(v)) { var o = tr(v); if (o !== v && o.indexOf(VMARK) >= 0) { verse(o, function (t) { el.setAttribute(a, t); }); return; } if (o !== v) { if (a === 'aria-label' && !el.hasAttribute('data-kjt-en-label')) el.setAttribute('data-kjt-en-label', v); el.setAttribute(a, o); } } }); /* 7.9.16: the English label is kept for scripts that recognise buttons by it (left/right arrows) */
    if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type) && el.value) { var o = tr(el.value); if (o !== el.value) el.value = o; }
  }
  /* Paragraphs with bold or italic words, links or line breaks inside are translated whole
     (their inner HTML is the key), so the sentence keeps its order in every language. */
  var BLOCK = 'p,li,h1,h2,h3,h4,h5,h6,blockquote,figcaption,label,dt,dd,td,th,small,summary';
  var INLINE = /^(B|STRONG|EM|I|A|BR|SPAN|SUP|SUB|U|SMALL|MARK|ABBR|CITE|Q|TIME)$/;
  function norm(h) { return h.replace(/\s+/g, ' ').replace(/ (data-kjt-tx|style)="[^"]*"/g, '').trim(); }
  /* 7.9.26: the same sentence whose links point somewhere else today (a Bible link that now opens
     biblecorner.com, a page that moved) is still recognised: tags are compared without their
     attributes, and the page's own links are kept in the translation. */
  var LOOSE = null;
  function lkey(h) { return norm(h).replace(/<([a-z0-9]+)\b[^>]*>/gi, '<$1>'); }
  function loose(el, key) {
    if (!D) return null;
    if (!LOOSE) { LOOSE = {}; for (var k in D) if (k.indexOf('<') >= 0 && Object.prototype.hasOwnProperty.call(D, k)) LOOSE[lkey(k)] = k; }
    var k0 = LOOSE[lkey(key)]; if (k0 == null) return null;
    return D[k0].indexOf(VMARK) >= 0 ? D[k0] : reattr(el, D[k0]);
  }
  /* the translation, with the links and classes the page has today */
  function reattr(el, html) {
    var t = document.createElement('template'); t.innerHTML = html;
    var mine = el.querySelectorAll('*'), theirs = t.content.querySelectorAll('*');
    if (mine.length !== theirs.length) return html;
    for (var i = 0; i < mine.length; i++) {
      if (mine[i].tagName !== theirs[i].tagName) return html;
      [].slice.call(mine[i].attributes).forEach(function (a) { if (!/^(title|aria-label|alt)$/.test(a.name) || !theirs[i].hasAttribute(a.name)) theirs[i].setAttribute(a.name, a.value); });
    }
    return t.innerHTML;
  }
  function doBlock(el) {
    if (el.__kjtTx || skipped(el) || !el.firstElementChild) return false;
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) if (!INLINE.test(c.tagName) || c.querySelector('button,input,img,svg,div,p')) return false;
    var key = norm(el.innerHTML); if (!/[A-Za-z]{2}/.test(el.textContent)) return false;
    var out = has(key);
    if (out == null) { var nk = key.replace(/ href="[^"]*"/g, ''); if (nk !== key) { out = has(nk); if (out != null && out.indexOf(VMARK) < 0) out = reattr(el, out); } }
    if (out == null) { out = loose(el, key); }
    if (out == null) { el.__kjtMiss = 1; return false; }
    if (out.indexOf(VMARK) < 0 && out.indexOf('<') >= 0) out = reattr(el, out); /* 7.9.28: a translation may leave out its tags' attributes: the page's own are used */
    el.__kjtTx = 1; el.__kjtEnText = el.textContent;
    if (out.indexOf(VMARK) >= 0) { verse(out, function (t) { el.innerHTML = t; }, true); return true; }
    el.innerHTML = out; return true;
  }
  function doTree(node) {
    if (!node) return;
    if (node.nodeType === 3) return doText(node);
    if (node.nodeType !== 1 || skipped(node)) return;
    doAttrs(node);
    if (node.matches && node.matches(BLOCK)) doBlock(node);
    node.querySelectorAll && node.querySelectorAll(BLOCK).forEach(doBlock);
    var w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), n, list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(doText);
    node.querySelectorAll('[placeholder],[title],[aria-label],[alt],input[type=button],input[type=submit]').forEach(doAttrs);
    if (RTL && node.matches && node.matches('[role=dialog],.kp-overlay,.kld-pop,.kld-dive,.kb-overlay,.kg-overlay')) node.setAttribute('dir', 'rtl');
  }
  function wrapDialogs() {
    var c = window.confirm, p = window.prompt, a = window.alert;
    window.confirm = function (m) { return c.call(window, tr(m)); };
    window.prompt = function (m, d) { return p.call(window, tr(m), d); };
    window.alert = function (m) { return a.call(window, tr(m)); };
  }
  function roots() { return [].slice.call(document.querySelectorAll(ROOTS)); }

  /* ---------- the language menu ---------- */
  function langUrl(code) {
    if (window.KJTB_LANG_URL) return window.KJTB_LANG_URL(code); /* 7.9.16: on the Bible page, the reader's chapter opens in that language's Bible */
    var u = new URL(location.href);
    if (code === 'en') u.searchParams.delete('lang'); else u.searchParams.set('lang', code);
    return u.href;
  }
  function menu() {
    if (CFG.menuIn === '') return; /* the page has its own (the Bible page) */
    var host = document.querySelector(CFG.menuIn || 'main section') ; if (!host || document.querySelector('.kjt-langmenu')) return;
    var inHeader = !!(host.closest && host.closest('header'));
    var wrap = document.createElement('div'); wrap.className = 'kjt-langmenu' + (inHeader ? ' kjt-langmenu--header' : ''); wrap.setAttribute('dir', 'ltr'); wrap.setAttribute('data-kjt-notr', '');
    var b = document.createElement('button'); b.type = 'button'; b.className = 'kjt-langmenu__btn'; b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false');
    b.innerHTML = '<svg class="kjt-langmenu__globe" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3z"/></svg> '; /* 7.9.22: a plain line globe, one colour */ var nm = document.createElement('span'); nm.className = 'kjt-langmenu__name'; nm.textContent = (LANGS[lang] || {}).name || 'English'; b.appendChild(nm);
    var sh = document.createElement('span'); sh.className = 'kjt-langmenu__short'; sh.textContent = lang.toUpperCase(); sh.setAttribute('aria-hidden', 'true'); b.appendChild(sh); b.setAttribute('aria-label', 'Language: ' + ((LANGS[lang] || {}).name || 'English'));
    var list = document.createElement('ul'); list.className = 'kjt-langmenu__list'; list.hidden = true; list.setAttribute('role', 'menu');
    Object.keys(LANGS).forEach(function (code) {
      var li = document.createElement('li'), a = document.createElement('a');
      a.href = langUrl(code); a.textContent = LANGS[code].name; a.setAttribute('lang', code); a.setAttribute('role', 'menuitem');
      if (code === lang) a.setAttribute('aria-current', 'true');
      a.addEventListener('click', function () { try { localStorage.setItem(KEY, code); } catch (e) {} if (window.KJTB_KEEP_PLACE) try { window.KJTB_KEEP_PLACE(); } catch (e) {} });
      li.appendChild(a); list.appendChild(li);
    });
    b.addEventListener('click', function (e) { e.stopPropagation(); list.querySelectorAll('a').forEach(function (x) { x.href = langUrl(x.getAttribute('lang')); }); list.hidden = !list.hidden; b.setAttribute('aria-expanded', list.hidden ? 'false' : 'true'); });
    document.addEventListener('click', function () { if (!list.hidden) { list.hidden = true; b.setAttribute('aria-expanded', 'false'); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !list.hidden) { list.hidden = true; b.setAttribute('aria-expanded', 'false'); b.focus(); } });
    wrap.appendChild(b); wrap.appendChild(list);
    if (!inHeader && getComputedStyle(host).position === 'static') host.style.position = 'relative';
    /* in the header: before the phone menu button, so it is always in sight */
    var tog = inHeader && host.querySelector('.bfp-mobile-toggle');
    if (tog) host.insertBefore(wrap, tog); else host.appendChild(wrap);
  }

  /* ---------- the word list ---------- */
  function words(done) {
    if (!ON) return done();
    var inline = window.KJT_LANG_WORDS && window.KJT_LANG_WORDS[lang];
    if (inline) return done(inline);
    var files = (CFG.areas || []).map(function (a) { return (CFG.base || '') + a + '-' + lang + '.json?v=' + encodeURIComponent(CFG.ver || ''); });
    Promise.all(files.map(function (f) { return fetch(f, { credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }); }))
      .then(function (parts) { var all = {}; parts.forEach(function (p) { for (var k in p) if (k !== '__patterns') all[k] = p[k]; else all.__patterns = (all.__patterns || []).concat(p[k]); }); done(all); });
  }
  function report() {
    var list = Object.keys(missing).filter(function (x) { return !/^[\d\s\W]*$/.test(x); });
    try { localStorage.setItem('kjt_i18n_missing_' + lang, JSON.stringify(list)); } catch (e) {}
    if (!CFG.admin || !list.length) return;
    var box = document.createElement('div'); box.className = 'kjt-i18n-report'; box.setAttribute('dir', 'ltr'); box.setAttribute('data-kjt-notr', '');
    box.innerHTML = '<strong>' + (META.name || lang) + ': ' + list.length + ' text(s) still in English on this page</strong><small>Only administrators see this. Copy the list to have them translated.</small>';
    var ta = document.createElement('textarea'); ta.readOnly = true; ta.value = list.join('\n'); box.appendChild(ta);
    var x = document.createElement('button'); x.type = 'button'; x.textContent = 'Close'; x.onclick = function () { box.remove(); }; box.appendChild(x);
    document.body.appendChild(box);
  }
  api.missing = function () { return Object.keys(missing); };

  /* 7.9.14: links to other pages of the site keep the language */
  function keepLang(e) {
    if (!ON || CFG.keepUrl) return; /* 7.18.0: not where the address carries the language (biblecorner.com/ar/…): a link to /fr/ became /fr/?lang=ar and went back to Arabic */
    var a = e.target && e.target.closest && e.target.closest('a[href]'); if (!a || a.closest('.kjt-langmenu') || a.hasAttribute('hreflang') || a.hasAttribute('lang')) return;
    try {
      var u = new URL(a.getAttribute('href'), location.href);
      if (u.origin !== location.origin || /\/wp-(admin|json|content|includes)\/|\.(pdf|jpe?g|png|gif|webp|mp3|mp4|zip|apk)$/i.test(u.pathname) || u.searchParams.has('lang')) return;
      if (u.pathname === location.pathname && u.hash) return;
      u.searchParams.set('lang', lang); a.setAttribute('href', u.href);
    } catch (x) {}
  }
  document.addEventListener('click', keepLang, true); document.addEventListener('auxclick', keepLang, true);
  /* 7.9.14: Arabic is hard to read small and tight. Any Arabic text set smaller than 15px is made
     bigger, Latin letter-spacing is removed, and paragraphs (above all Scripture with its vowel
     marks) get more room between the lines. This covers every part of the page, also what other
     scripts translate (the Bible page) or add later. */
  var AR_RE = /[\u0600-\u06FF]/, HARAKAT = /[\u064B-\u0652\u0670]/;
  function arFix(root) {
    if (lang !== 'ar') return;
    var els = (root && root.querySelectorAll ? [root].concat([].slice.call(root.querySelectorAll('*'))) : []);
    els.forEach(function (el) {
      if (el.nodeType !== 1 || el.__kjtAr || /^(SCRIPT|STYLE|SVG|PATH|IMG|INPUT|TEXTAREA|OPTION)$/i.test(el.tagName)) return;
      var own = ''; for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) own += c.nodeValue;
      if (!AR_RE.test(own)) return;
      el.__kjtAr = 1;
      var cs = getComputedStyle(el), fs = parseFloat(cs.fontSize) || 16;
      /* 7.9.16: in the Bible adventures and the games, space over the picture is tight: only very small writing grows */
      if (el.closest && el.closest('.kad-top,.kad-hint,.kad-ui,.kgm')) { if (fs < 13) el.style.fontSize = '14px'; }
      else if (fs < 15.5) el.style.fontSize = (fs <= 12.5 ? 18 : Math.max(16, Math.round(fs * 1.25))) + 'px';
      if (parseFloat(cs.letterSpacing) > 0) el.style.letterSpacing = '0';
      if (cs.textTransform === 'uppercase') el.style.textTransform = 'none';
      var size = parseFloat(el.style.fontSize) || fs, lh = parseFloat(cs.lineHeight), text = (el.textContent || '').trim();
      var want = HARAKAT.test(text) ? 2.25 : (text.length > 60 ? 1.9 : 1.5);
      if (!(lh >= size * want - 0.5)) el.style.lineHeight = String(want);
    });
  }
  var arTimer = null, arQueue = [];
  function arSoon(n) { if (lang !== 'ar' || !n || n.nodeType !== 1) return; arQueue.push(n); clearTimeout(arTimer); arTimer = setTimeout(function () { var q = arQueue.splice(0); q.forEach(arFix); }, 250); }
  if (lang === 'ar') {
    var arStart = function () {
      arFix(document.body);
      new MutationObserver(function (list) { list.forEach(function (m) { if (m.type === 'characterData') { if (m.target.parentElement) { m.target.parentElement.__kjtAr = 0; arSoon(m.target.parentElement); } } else m.addedNodes.forEach(function (n) { if (n.nodeType === 3 && n.parentElement) { n.parentElement.__kjtAr = 0; arSoon(n.parentElement); } else arSoon(n); }); }); })
        .observe(document.body, { childList: true, subtree: true, characterData: true });
    };
    if (document.readyState === 'complete') setTimeout(arStart, 300); else window.addEventListener('load', function () { setTimeout(arStart, 300); });
  }
  function start() {
    menu();
    if (!ON) return;
    var vmapReady = (META.vers && CFG.vmap && window.fetch) ? fetch(CFG.vmap).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) { VM = j && j[META.vers] || null; }).catch(function () {}) : Promise.resolve();
    words(function (d) { vmapReady.then(function () { go(d); }); });
    function go(d) {
      D = d || {}; PATS = (D.__patterns || []).map(function (p) { try { return [new RegExp(p[0]), p[1]]; } catch (e) { return null; } }).filter(Boolean);
      Object.keys(D).forEach(function (k) { var x = D[k]; if (typeof x === 'string') { VALS[x] = 1; VALS[x.replace(/\{\d+\}/g, '#')] = 1; var x2 = x.replace(EDGE, '').replace(EDGE_END, ''); VALS[x2] = 1; VALS[x2.replace(/\{\d+\}/g, '#')] = 1; } });
      if (D.__books) Object.keys(D.__books).forEach(function (k) { VALS[D.__books[k]] = 1; });
      if (D.__books) BKRE = new RegExp('^(' + Object.keys(D.__books).sort(function (a, b) { return b.length - a.length; }).map(function (b) { return b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')(?=\\s+\\d)');
      document.documentElement.setAttribute('lang', META.locale || lang);
      if (RTL) [].slice.call(document.querySelectorAll(CFG.chrome ? 'main,header,footer' : ROOTS)).forEach(function (r) { r.setAttribute('dir', 'rtl'); });
      roots().forEach(function (r) { doTree(r); });
      wrapDialogs();
      document.documentElement.classList.remove('kjt-i18n-wait');
      /* everything the page adds or changes later (games, dialogs, pop-ups) */
      var mo = new MutationObserver(function (list) {
        list.forEach(function (m) {
          try {
            if (m.type === 'characterData') return doText(m.target);
            if (m.type === 'attributes') return doAttrs(m.target);
            m.addedNodes.forEach(function (n) { if (n.nodeType === 1 && n.closest && n.closest(CFG.chrome ? '#wpadminbar' : 'header,footer,#wpadminbar')) return; doTree(n); });
          } catch (e) {}
        });
      });
      mo.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
      ready.splice(0).forEach(function (fn) { try { fn(lang); } catch (e) {} });
      setTimeout(report, 6000);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
