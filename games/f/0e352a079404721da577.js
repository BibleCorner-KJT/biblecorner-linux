/* KJT Kids Corner - Bible Games: Journey to Jerusalem (Site Core 7.9.9)
   The pilgrims' board game, made bigger and richer: 100 squares on a painted road from
   Galilee, through the wilderness and across the Jordan, up the hills of Judea to the
   Temple in Jerusalem.
   - Each player is a Bible character (David, Ruth, Peter, Esther, Daniel, Joseph), drawn
     here in SVG: they hop square by square, climb and slide.
   - Ladders are good deeds and serpents are sins, each with its verse (in the page
     language's Bible when there is one). Scroll squares ask a Bible question; wells let
     you roll again; a 6 rolls again.
   - Easy: 5 serpents and you may pass square 100. Medium: 8 serpents. Hard: 10 serpents
     and the Temple must be reached exactly. 1 to 4 players, or one against the computer.
   - Sounds are made on the device (sounds.js). Texts are plain page text, so the Kids
     Corner languages translate them; names and Scripture are never altered. */
(function () {
  'use strict';
  if (!window.KJTGames) return;
  var K = window.KJTGames.kit, el = K.el, T = K.T || function (s) { return s; };
  var NS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs, kids) { var n = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); }); (kids || []).forEach(function (c) { if (c) n.appendChild(c); }); return n; }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* Scripture in the page language (from the Kids Bible), English otherwise */
  function passage(book, ch, v1, v2) {
    return new Promise(function (resolve) {
      if ((K.lang || 'en') === 'en') return resolve(null);
      var done = false, go = function () { if (done) return; done = true; if (!window.KJT_KIDS_PASSAGE) return resolve(null); window.KJT_KIDS_PASSAGE(book, ch, v1, v2).then(resolve, function () { resolve(null); }); };
      if (window.KJT_KIDS_PASSAGE) return go();
      window.addEventListener('kjt-kids-passage-ready', go, { once: true }); setTimeout(go, 4000);
    });
  }
  function verseBox(v) {
    var txt = el('span', { class: 'kj-verse__t', 'data-kjt-notr': '', text: '“' + v[4] + '”' });
    passage(v[0], v[1], v[2], v[3]).then(function (t) { if (t) txt.textContent = '“' + t + '”'; });
    return el('p', { class: 'kj-verse' }, [txt, el('span', { class: 'kj-verse__r', text: v[5] })]);
  }

  /* ---------------- the pilgrims ---------------- */
  var CHARS = [
    { id: 'david', name: 'David', robe: '#2f6fc0', robe2: '#1f4f92', skin: '#d39a6a', hair: '#5a3218', ring: '#2f6fc0' },
    { id: 'ruth', name: 'Ruth', robe: '#3d8f4e', robe2: '#2a6a37', skin: '#c98d5e', hair: '#2f1c10', ring: '#3d8f4e' },
    { id: 'peter', name: 'Peter', robe: '#c46a28', robe2: '#93501d', skin: '#c4875a', hair: '#8b8378', ring: '#c46a28' },
    { id: 'esther', name: 'Esther', robe: '#5b2d8e', robe2: '#40206a', skin: '#d6a274', hair: '#1f130c', ring: '#7a3fb5' },
    { id: 'daniel', name: 'Daniel', robe: '#b2352f', robe2: '#862521', skin: '#b97c50', hair: '#24160d', ring: '#b2352f' },
    { id: 'joseph', name: 'Joseph', robe: '#e0a21a', robe2: '#b07c0e', skin: '#cf9563', hair: '#3b2414', ring: '#0e8a8a' }
  ];
  /* one pilgrim, feet at 0,0, about 96 units tall */
  function charArt(c) {
    var s = '', sk = c.skin, R = c.robe, R2 = c.robe2;
    s += '<ellipse cx="0" cy="0" rx="24" ry="6.5" fill="rgba(40,20,0,.28)"/>';
    /* sandals and feet */
    s += '<rect x="-12" y="-11" width="9" height="10" rx="3" fill="' + sk + '"/><rect x="3" y="-11" width="9" height="10" rx="3" fill="' + sk + '"/>';
    s += '<rect x="-14" y="-3.5" width="12" height="4" rx="2" fill="#6b3f1d"/><rect x="2" y="-3.5" width="12" height="4" rx="2" fill="#6b3f1d"/>';
    /* robe */
    if (c.id === 'joseph') {
      s += '<defs><clipPath id="kj-coat"><path d="M-17 -54 Q0 -60 17 -54 L24 -9 Q0 -4 -24 -9 Z"/></clipPath></defs><g clip-path="url(#kj-coat)">';
      ['#d63a3a', '#f0a31b', '#f6d23c', '#3e9b4f', '#2a7fc4', '#7a3fb5', '#d63a3a'].forEach(function (col, i) { s += '<rect x="-30" y="' + (-62 + i * 8.6) + '" width="60" height="8.8" fill="' + col + '"/>'; });
      s += '<path d="M6 -60 L30 -60 L30 0 L10 0 Z" fill="rgba(0,0,0,.14)"/></g>';
    } else {
      s += '<path d="M-17 -54 Q0 -60 17 -54 L24 -9 Q0 -4 -24 -9 Z" fill="' + R + '"/>';
      s += '<path d="M5 -57 Q12 -56 17 -54 L24 -9 Q16 -7 9 -6 Z" fill="' + R2 + '" opacity=".75"/>';
    }
    if (c.id === 'esther') s += '<path d="M-24 -9 Q0 -4 24 -9 L23 -13 Q0 -8 -23 -13 Z" fill="#f3c548"/><path d="M-3 -56 L3 -56 L4 -10 L-4 -10 Z" fill="#f3c548" opacity=".85"/>';
    if (c.id === 'daniel') s += '<path d="M-24 -9 Q0 -4 24 -9 L23 -13 Q0 -8 -23 -13 Z" fill="#f3c548"/>';
    /* belt */
    s += '<path d="M-19 -35 Q0 -31 19 -35 L19.5 -30 Q0 -26 -19.5 -30 Z" fill="' + (c.id === 'esther' ? '#f3c548' : c.id === 'peter' ? '#5b3a1e' : '#f1e3c2') + '"/>';
    /* arms */
    s += '<path d="M-17 -53 Q-27 -44 -25 -30" stroke="' + (c.id === 'joseph' ? '#2a7fc4' : R) + '" stroke-width="9" stroke-linecap="round" fill="none"/><circle cx="-25" cy="-28" r="4.6" fill="' + sk + '"/>';
    s += '<path d="M17 -53 Q27 -44 25 -30" stroke="' + (c.id === 'joseph' ? '#d63a3a' : R2) + '" stroke-width="9" stroke-linecap="round" fill="none"/><circle cx="25" cy="-28" r="4.6" fill="' + sk + '"/>';
    /* neck and head */
    s += '<rect x="-4.5" y="-62" width="9" height="8" rx="3" fill="' + sk + '"/>';
    s += '<circle cx="0" cy="-74" r="17" fill="' + sk + '"/>';
    /* hair and head cover */
    if (c.id === 'david') s += '<path d="M-17 -76 Q-18 -94 0 -93 Q18 -94 17 -76 Q12 -84 0 -84 Q-12 -84 -17 -76 Z" fill="' + c.hair + '"/><circle cx="-15" cy="-82" r="4.5" fill="' + c.hair + '"/><circle cx="15" cy="-82" r="4.5" fill="' + c.hair + '"/><circle cx="-6" cy="-91" r="4.5" fill="' + c.hair + '"/><circle cx="7" cy="-91" r="4.5" fill="' + c.hair + '"/><path d="M-17 -80 Q0 -86 17 -80" stroke="#2f6fc0" stroke-width="4" fill="none"/><path d="M16 -80 L24 -74 M16 -80 L25 -79" stroke="#2f6fc0" stroke-width="2.6" stroke-linecap="round"/>';
    if (c.id === 'ruth') s += '<path d="M-20 -70 Q-22 -96 0 -95 Q22 -96 20 -70 L23 -52 Q16 -60 15 -72 Q0 -86 -15 -72 Q-16 -60 -23 -52 Z" fill="#e8d7ad"/><path d="M-20 -78 Q0 -90 20 -78" stroke="#c9b37e" stroke-width="2" fill="none"/>';
    if (c.id === 'peter') s += '<path d="M-17 -78 Q-15 -90 -6 -90 Q0 -86 6 -90 Q15 -90 17 -78 Q12 -82 9 -80 Q0 -84 -9 -80 Q-12 -82 -17 -78 Z" fill="' + c.hair + '"/><path d="M-14 -70 Q-15 -54 0 -52 Q15 -54 14 -70 Q10 -63 0 -64 Q-10 -63 -14 -70 Z" fill="' + c.hair + '"/>';
    if (c.id === 'esther') s += '<path d="M-18 -72 Q-21 -96 0 -94 Q21 -96 18 -72 L21 -50 Q15 -54 14 -70 Q0 -82 -14 -70 Q-15 -54 -21 -50 Z" fill="' + c.hair + '"/><path d="M-12 -88 L-12 -100 L-6 -93 L0 -103 L6 -93 L12 -100 L12 -88 Z" fill="#f3c548" stroke="#b8860b" stroke-width="1"/><circle cx="0" cy="-95" r="2" fill="#2a7fc4"/>';
    if (c.id === 'daniel') s += '<path d="M-18 -76 Q-20 -96 0 -96 Q20 -96 18 -76 Q14 -84 0 -84 Q-14 -84 -18 -76 Z" fill="#efe2c4"/><path d="M-18 -78 Q0 -88 18 -78" stroke="#d2bd8e" stroke-width="2" fill="none"/><path d="M-12 -62 Q0 -54 12 -62 Q8 -58 0 -57 Q-8 -58 -12 -62 Z" fill="' + c.hair + '"/>';
    if (c.id === 'joseph') s += '<path d="M-17 -76 Q-19 -94 0 -93 Q19 -94 17 -76 Q10 -86 -2 -84 Q-12 -84 -17 -76 Z" fill="' + c.hair + '"/>';
    /* face */
    s += '<ellipse cx="-6" cy="-74" rx="2.6" ry="3.2" fill="#2a1a10"/><ellipse cx="6" cy="-74" rx="2.6" ry="3.2" fill="#2a1a10"/><circle cx="-5.2" cy="-75.3" r="1" fill="#fff"/><circle cx="6.8" cy="-75.3" r="1" fill="#fff"/>';
    s += '<ellipse cx="-11" cy="-68" rx="3.4" ry="2.2" fill="rgba(214,110,80,.35)"/><ellipse cx="11" cy="-68" rx="3.4" ry="2.2" fill="rgba(214,110,80,.35)"/>';
    if (c.id !== 'peter') s += '<path d="M-5 -66 Q0 -62 5 -66" stroke="#7a3a22" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
    else s += '<path d="M-4 -63 Q0 -60 4 -63" stroke="#5a2a1a" stroke-width="1.8" fill="none" stroke-linecap="round"/>';
    /* what each one carries */
    if (c.id === 'david') s += '<path d="M25 -28 Q30 -14 33 -4" stroke="#7a4a22" stroke-width="2" fill="none"/><ellipse cx="33" cy="-3" rx="4" ry="3" fill="#8a5a2b"/><circle cx="33" cy="-3" r="2.2" fill="#b8b2a6"/><path d="M-20 -40 Q-30 -36 -28 -24 Q-18 -22 -16 -32 Z" fill="#9a6a3a"/>';
    if (c.id === 'ruth') s += '<g transform="translate(-27 -30) rotate(-12)"><path d="M-3 18 L0 -18 M0 18 L3 -16 M3 18 L6 -14 M-6 18 L-4 -14" stroke="#c9961e" stroke-width="2"/><ellipse cx="0" cy="-17" rx="2.6" ry="6" fill="#e8b832"/><ellipse cx="4" cy="-15" rx="2.4" ry="5.5" fill="#e8b832"/><ellipse cx="-4" cy="-14" rx="2.4" ry="5.5" fill="#e8b832"/><ellipse cx="7" cy="-12" rx="2.2" ry="5" fill="#f0c84a"/><rect x="-6" y="3" width="13" height="4" rx="2" fill="#a0522d"/></g>';
    if (c.id === 'peter') s += '<g transform="translate(30 -24) rotate(70)"><path d="M-14 0 Q0 -9 12 0 Q0 9 -14 0 Z" fill="#6aa9d6"/><path d="M12 0 L19 -6 L19 6 Z" fill="#4c8dc0"/><circle cx="-8" cy="-1.5" r="1.4" fill="#123"/></g>';
    if (c.id === 'esther') s += '<rect x="-29" y="-48" width="4" height="34" rx="2" fill="#d4a017"/><circle cx="-27" cy="-50" r="4.5" fill="#f3c548"/>';
    if (c.id === 'daniel') s += '<g transform="translate(-31 -2)"><ellipse cx="0" cy="-9" rx="11" ry="8" fill="#d9a441"/><circle cx="-9" cy="-17" r="8.5" fill="#b9782a"/><circle cx="-9" cy="-17" r="6" fill="#e8b24f"/><circle cx="-11" cy="-18" r="1.1" fill="#222"/><circle cx="-7" cy="-18" r="1.1" fill="#222"/><path d="M-10 -14.5 Q-9 -13 -8 -14.5" stroke="#5a3010" stroke-width="1" fill="none"/><path d="M10 -10 Q16 -14 14 -20" stroke="#d9a441" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="14" cy="-21" r="2.2" fill="#8a5a1a"/><rect x="-6" y="-3" width="3" height="4" rx="1" fill="#c48a30"/><rect x="4" y="-3" width="3" height="4" rx="1" fill="#c48a30"/></g>';
    if (c.id === 'joseph') s += '<path d="M25 -30 L29 -6" stroke="#7a4a22" stroke-width="3" stroke-linecap="round"/>';
    return s;
  }
  function portrait(c, size) {
    var svg = sv('svg', { viewBox: '-40 -110 80 116', width: size, height: Math.round(size * 1.45), class: 'kj-portrait', 'aria-hidden': 'true' });
    svg.innerHTML = charArt(c); return svg;
  }

  /* ---------------- the board ---------------- */
  var LADDERS = [[4, 25, 0], [9, 31, 1], [21, 42, 2], [28, 56, 3], [36, 57, 4], [51, 72, 5], [63, 84, 6], [71, 91, 7]];
  var SERPENTS = [[17, 7, 0], [33, 12, 1], [48, 26, 2], [74, 53, 4], [87, 58, 5], [62, 19, 3], [93, 69, 6], [55, 35, 7], [44, 24, 8], [98, 78, 9]];
  var SCROLLS = [14, 39, 46, 66, 79, 89], WELLS = [11, 60, 82];
  var GOOD = [
    ['You shared your lunch with a hungry child.', ['Luke', 3, 11, 11, 'He that hath two coats, let him impart to him that hath none; and he that hath meat, let him do likewise.', 'Luke 3:11']],
    ['You prayed for your family before bed.', ['1 Thessalonians', 5, 17, 17, 'Pray without ceasing.', '1 Thessalonians 5:17']],
    ['You helped a traveller who had fallen, like the Good Samaritan.', ['Luke', 10, 37, 37, 'Go, and do thou likewise.', 'Luke 10:37']],
    ['You forgave a friend who hurt you.', ['Ephesians', 4, 32, 32, 'And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ’s sake hath forgiven you.', 'Ephesians 4:32']],
    ['You told the truth, even when it was hard.', ['Ephesians', 4, 25, 25, 'Wherefore putting away lying, speak every man truth with his neighbour: for we are members one of another.', 'Ephesians 4:25']],
    ['You helped your mother and father at home.', ['Exodus', 20, 12, 12, 'Honour thy father and thy mother: that thy days may be long upon the land which the LORD thy God giveth thee.', 'Exodus 20:12']],
    ['You visited someone who was sick.', ['Matthew', 25, 36, 36, 'I was sick, and ye visited me.', 'Matthew 25:36']],
    ['You thanked God for everything.', ['1 Thessalonians', 5, 18, 18, 'In every thing give thanks: for this is the will of God in Christ Jesus concerning you.', '1 Thessalonians 5:18']]
  ];
  var BAD = [
    ['You told a lie.', ['Proverbs', 12, 22, 22, 'Lying lips are abomination to the LORD: but they that deal truly are his delight.', 'Proverbs 12:22']],
    ['You lost your temper and shouted.', ['James', 1, 20, 20, 'For the wrath of man worketh not the righteousness of God.', 'James 1:20']],
    ['You wanted more and more things.', ['Luke', 12, 15, 15, 'Take heed, and beware of covetousness: for a man’s life consisteth not in the abundance of the things which he possesseth.', 'Luke 12:15']],
    ['You thought you were better than others.', ['Proverbs', 16, 18, 18, 'Pride goeth before destruction, and an haughty spirit before a fall.', 'Proverbs 16:18']],
    ['You were jealous of a friend.', ['1 Corinthians', 13, 4, 4, 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up.', '1 Corinthians 13:4']],
    ['You grumbled and complained.', ['Philippians', 2, 14, 14, 'Do all things without murmurings and disputings.', 'Philippians 2:14']],
    ['You said unkind words.', ['Ephesians', 4, 29, 29, 'Let no corrupt communication proceed out of your mouth, but that which is good to the use of edifying, that it may minister grace unto the hearers.', 'Ephesians 4:29']],
    ['You disobeyed your parents.', ['Ephesians', 6, 1, 1, 'Children, obey your parents in the Lord: for this is right.', 'Ephesians 6:1']],
    ['You laughed at someone.', ['Matthew', 7, 12, 12, 'Therefore all things whatsoever ye would that men should do to you, do ye even so to them.', 'Matthew 7:12']],
    ['You fell asleep instead of praying.', ['Matthew', 26, 41, 41, 'Watch and pray, that ye enter not into temptation: the spirit indeed is willing, but the flesh is weak.', 'Matthew 26:41']]
  ];
  var SORRY = ['1 John', 1, 9, 9, 'If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.', '1 John 1:9'];
  var GLAD = ['Psalms', 122, 1, 1, 'I was glad when they said unto me, Let us go into the house of the LORD.', 'Psalm 122:1'];

  function cell(n) { var r = Math.floor((n - 1) / 10), c = (n - 1) % 10; if (r % 2) c = 9 - c; return { x: c * 100, y: (9 - r) * 100, cx: c * 100 + 50, cy: (9 - r) * 100 + 50 }; }

  function scenery() {
    var s = '<defs>' +
      '<linearGradient id="kj-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4ef"/><stop offset=".7" stop-color="#cfe9f5"/><stop offset="1" stop-color="#f6e6c2"/></linearGradient>' +
      '<linearGradient id="kj-hills" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cdb57c"/><stop offset="1" stop-color="#b7a065"/></linearGradient>' +
      '<linearGradient id="kj-desert" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9c98d"/><stop offset="1" stop-color="#dcb574"/></linearGradient>' +
      '<linearGradient id="kj-green" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9cc56a"/><stop offset="1" stop-color="#6fa648"/></linearGradient>' +
      '<linearGradient id="kj-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe9a3"/><stop offset="1" stop-color="#e2b43a"/></linearGradient>' +
      '<linearGradient id="kj-wood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9a6332"/><stop offset=".5" stop-color="#c78b4f"/><stop offset="1" stop-color="#8a5629"/></linearGradient>' +
      '<radialGradient id="kj-sun"><stop offset="0" stop-color="#fff7c9"/><stop offset=".5" stop-color="#ffe27a" stop-opacity=".9"/><stop offset="1" stop-color="#ffd24a" stop-opacity="0"/></radialGradient>' +
      '<filter id="kj-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>' +
      '<filter id="kj-shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#2a1500" flood-opacity=".35"/></filter>' +
      '<pattern id="kj-grain" width="40" height="40" patternUnits="userSpaceOnUse"><circle cx="7" cy="9" r="1.4" fill="rgba(90,60,20,.12)"/><circle cx="28" cy="22" r="1.1" fill="rgba(90,60,20,.1)"/><circle cx="17" cy="34" r="1.6" fill="rgba(255,255,255,.12)"/></pattern>' +
      '</defs>';
    /* sky and Jerusalem */
    s += '<rect x="0" y="-210" width="1000" height="230" fill="url(#kj-sky)"/><circle cx="860" cy="-150" r="70" fill="url(#kj-sun)"/>';
    s += '<g fill="#fff" opacity=".85"><ellipse cx="300" cy="-160" rx="46" ry="14"/><ellipse cx="330" cy="-170" rx="30" ry="14"/><ellipse cx="620" cy="-182" rx="40" ry="11"/><ellipse cx="645" cy="-190" rx="24" ry="11"/></g>';
    s += '<path d="M0 -40 Q120 -90 260 -60 Q420 -100 560 -62 Q720 -96 860 -58 Q940 -76 1000 -60 L1000 20 L0 20 Z" fill="#c8b07a"/>';
    /* city walls */
    var wall = '<rect x="0" y="-62" width="1000" height="70" fill="#d9c49a"/>';
    for (var i = 0; i < 50; i++) wall += '<rect x="' + (i * 20 + 3) + '" y="-72" width="12" height="12" fill="#d9c49a"/>';
    wall += '<rect x="0" y="-62" width="1000" height="70" fill="url(#kj-grain)"/>';
    for (var j = 0; j < 8; j++) wall += '<path d="M' + (j * 130 + 40) + ' -40 l14 0 l0 -10 q-7 -8 -14 0 z" fill="#8a7550"/>';
    [[330, 1], [560, 1.1], [790, .95]].forEach(function (t) { wall += '<g transform="translate(' + t[0] + ' 8) scale(' + t[1] + ')"><rect x="-26" y="-120" width="52" height="120" fill="#d2bb8c"/><rect x="-26" y="-120" width="52" height="120" fill="url(#kj-grain)"/>' + [-21, -7, 7, 21].map(function (x) { return '<rect x="' + (x - 5) + '" y="-131" width="10" height="11" fill="#d2bb8c"/>'; }).join('') + '<path d="M-8 -80 l16 0 l0 -14 q-8 -10 -16 0 z" fill="#7a6442"/></g>'; });
    s += wall;
    /* the Temple, at the top of the road (square 100 is top left) */
    s += '<g transform="translate(110 -6)" filter="url(#kj-shadow)">' +
      '<rect x="-108" y="-24" width="216" height="30" fill="#efe3c6"/><rect x="-100" y="-34" width="200" height="12" fill="#e6d6b0"/>' +
      '<rect x="-74" y="-150" width="148" height="118" fill="#f7efdb"/><rect x="-74" y="-150" width="148" height="118" fill="url(#kj-grain)"/>' +
      [-58, -34, -10, 14, 38, 62].map(function (x) { return '<rect x="' + (x - 5) + '" y="-140" width="10" height="106" fill="#e5d6b4"/>'; }).join('') +
      '<rect x="-20" y="-112" width="40" height="80" rx="20" fill="#7a5a2a"/><rect x="-20" y="-112" width="40" height="80" rx="20" fill="url(#kj-gold)" opacity=".55"/>' +
      '<path d="M-86 -150 L0 -192 L86 -150 Z" fill="url(#kj-gold)" stroke="#b8860b" stroke-width="2"/><rect x="-88" y="-156" width="176" height="8" fill="#e2b43a"/>' +
      '<circle cx="0" cy="-168" r="9" fill="#fff6d0" opacity=".9"/></g>';
    s += '<g opacity=".9">' + [[250, -8], [480, -6], [700, -10], [930, -8]].map(function (p) { return '<g transform="translate(' + p[0] + ' ' + p[1] + ')"><rect x="-3" y="-6" width="6" height="14" fill="#6b4a2a"/><ellipse cx="0" cy="-14" rx="16" ry="12" fill="#7d8f4a"/><ellipse cx="-5" cy="-18" rx="9" ry="7" fill="#98a95e"/></g>'; }).join('') + '</g>';
    /* three lands under the road */
    s += '<rect x="0" y="0" width="1000" height="310" fill="url(#kj-hills)"/>';
    for (var h = 0; h < 6; h++) s += '<path d="M0 ' + (40 + h * 48) + ' Q250 ' + (20 + h * 48) + ' 500 ' + (44 + h * 48) + ' T1000 ' + (34 + h * 48) + '" stroke="rgba(120,90,40,.25)" stroke-width="3" fill="none"/>';
    s += '<path d="M0 300 Q250 280 500 310 T1000 300 L1000 620 L0 620 Z" fill="url(#kj-desert)"/>';
    s += '<path d="M0 600 Q260 570 520 610 T1000 600 L1000 1000 L0 1000 Z" fill="url(#kj-green)"/>';
    s += '<rect x="0" y="0" width="1000" height="1000" fill="url(#kj-grain)"/>';
    /* the Jordan river */
    s += '<path d="M-10 588 C150 560 260 640 420 600 S700 560 820 610 S960 640 1010 600" stroke="#7fc3e8" stroke-width="34" fill="none" opacity=".9"/><path d="M-10 588 C150 560 260 640 420 600 S700 560 820 610 S960 640 1010 600" stroke="#bfe6fb" stroke-width="10" fill="none" stroke-dasharray="30 26" opacity=".8"/>';
    /* the Sea of Galilee and a boat */
    s += '<ellipse cx="900" cy="905" rx="150" ry="100" fill="#5fb0e0"/><ellipse cx="900" cy="905" rx="150" ry="100" fill="none" stroke="#e7f6ff" stroke-width="5" opacity=".6"/>' +
      '<g transform="translate(880 900)"><path d="M-30 0 Q0 16 30 0 Z" fill="#8a5a2b"/><path d="M0 -2 L0 -46" stroke="#5a3a1a" stroke-width="3"/><path d="M2 -44 Q22 -24 2 -6 Z" fill="#fff8e6"/></g>';
    /* desert rocks and palms, hill olives, Galilee flowers */
    [[80, 380], [270, 470], [520, 360], [690, 500], [880, 410], [430, 540]].forEach(function (p) { s += '<ellipse cx="' + p[0] + '" cy="' + p[1] + '" rx="26" ry="12" fill="#c49a62" opacity=".55"/>'; });
    [[160, 330], [760, 340], [600, 540]].forEach(function (p) { s += '<g transform="translate(' + p[0] + ' ' + p[1] + ')" opacity=".75"><path d="M0 0 Q4 -24 0 -46" stroke="#8a6a3a" stroke-width="5" fill="none"/><path d="M0 -46 Q-22 -50 -30 -36 M0 -46 Q22 -52 30 -38 M0 -46 Q-12 -62 -24 -60 M0 -46 Q12 -64 26 -60" stroke="#4f8a3a" stroke-width="6" fill="none" stroke-linecap="round"/></g>'; });
    [[60, 120], [330, 60], [610, 160], [880, 90], [200, 230], [760, 250]].forEach(function (p) { s += '<g transform="translate(' + p[0] + ' ' + p[1] + ')" opacity=".6"><rect x="-3" y="-4" width="6" height="12" fill="#6b4a2a"/><ellipse cx="0" cy="-12" rx="16" ry="11" fill="#7d8f4a"/></g>'; });
    for (var f = 0; f < 26; f++) { var fx = (f * 137) % 1000, fy = 640 + (f * 71) % 330; if (fx > 740 && fy > 800) continue; s += '<circle cx="' + fx + '" cy="' + fy + '" r="4" fill="' + ['#fff6a8', '#ffffff', '#f6c14a'][f % 3] + '" opacity=".7"/>'; }
    /* a little village at the start */
    s += '<g transform="translate(60 990)" opacity=".85">' + [[-30, 0], [10, -6], [44, 2]].map(function (p) { return '<g transform="translate(' + p[0] + ' ' + p[1] + ')"><rect x="-16" y="-28" width="32" height="28" fill="#e9d7ae"/><rect x="-18" y="-32" width="36" height="6" fill="#cdb37f"/><rect x="-5" y="-16" width="10" height="16" fill="#8a6a3a"/></g>'; }).join('') + '</g>';
    return s;
  }
  function scrollIcon(cx, cy) { return '<g transform="translate(' + cx + ' ' + (cy + 8) + ')"><rect x="-17" y="-12" width="34" height="24" rx="3" fill="#fff4d6" stroke="#b08a4a" stroke-width="2"/><rect x="-21" y="-15" width="7" height="30" rx="3.5" fill="#c7a061"/><rect x="14" y="-15" width="7" height="30" rx="3.5" fill="#c7a061"/><text x="0" y="7" font-size="20" font-weight="900" text-anchor="middle" fill="#6a3e12" font-family="Georgia,serif">?</text></g>'; }
  function wellIcon(cx, cy) { return '<g transform="translate(' + cx + ' ' + (cy + 10) + ')"><ellipse cx="0" cy="8" rx="20" ry="7" fill="#4a90c2"/><path d="M-20 8 L-20 -6 Q0 -12 20 -6 L20 8 Q0 15 -20 8 Z" fill="#b9a37a" stroke="#7a6442" stroke-width="2"/><path d="M-16 -6 L-16 -26 M16 -6 L16 -26" stroke="#6b4a2a" stroke-width="3"/><path d="M-20 -26 L0 -36 L20 -26 Z" fill="#9a6332"/><path d="M0 -26 L0 -6" stroke="#555" stroke-width="1.5"/><rect x="-4" y="-10" width="8" height="7" fill="#7a5a32"/></g>'; }

  function tiles() {
    var s = '';
    for (var n = 1; n <= 100; n++) {
      var c = cell(n), alt = (Math.floor((n - 1) / 10) + n) % 2, special = SCROLLS.indexOf(n) >= 0 ? 'scroll' : WELLS.indexOf(n) >= 0 ? 'well' : n === 100 ? 'temple' : n === 1 ? 'start' : '';
      var fill = special === 'temple' ? 'url(#kj-gold)' : special === 'scroll' ? '#fdf1d2' : special === 'well' ? '#dff2fb' : alt ? '#fffaf0' : '#f7ecd6';
      s += '<rect x="' + (c.x + 5) + '" y="' + (c.y + 5) + '" width="90" height="90" rx="14" fill="' + fill + '" opacity="' + (special ? .9 : .5) + '" stroke="#8a6a3a" stroke-opacity=".45" stroke-width="2"/>';
      s += '<text x="' + (c.x + 15) + '" y="' + (c.y + 30) + '" font-size="21" font-weight="800" fill="#5a3b1a" font-family="system-ui,sans-serif" opacity=".85">' + n + '</text>';
      if (special === 'scroll') s += scrollIcon(c.cx, c.cy);
      if (special === 'well') s += wellIcon(c.cx, c.cy);
      if (special === 'temple') s += '<g transform="translate(' + c.cx + ' ' + (c.cy + 12) + ')"><path d="M-22 12 L-22 -10 Q0 -30 22 -10 L22 12 Z" fill="#8a5a1a"/><path d="M-16 12 L-16 -8 Q0 -22 16 -8 L16 12 Z" fill="#ffe9a3"/><path d="M0 -26 L0 -40 M-6 -34 L6 -34" stroke="#b8860b" stroke-width="3"/></g>';
      if (special === 'start') s += '<g transform="translate(' + c.cx + ' ' + (c.cy + 14) + ')"><path d="M-20 10 L-20 -10 L0 -24 L20 -10 L20 10 Z" fill="#e9d7ae" stroke="#8a6a3a" stroke-width="2"/><rect x="-5" y="-2" width="10" height="12" fill="#8a6a3a"/></g>';
    }
    return s;
  }
  function ladderArt(a, b) {
    var A = cell(a), B = cell(b), x1 = A.cx, y1 = A.cy + 10, x2 = B.cx, y2 = B.cy - 6, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L * 15, ny = dx / L * 15, s = '';
    s += '<path d="M' + x1 + ' ' + y1 + ' L' + x2 + ' ' + y2 + '" stroke="#ffe27a" stroke-width="64" stroke-linecap="round" opacity=".28" filter="url(#kj-soft)"/>';
    var rungs = Math.floor(L / 30);
    for (var i = 1; i < rungs; i++) { var t = i / rungs, px = x1 + dx * t, py = y1 + dy * t; s += '<path d="M' + (px + nx) + ' ' + (py + ny) + ' L' + (px - nx) + ' ' + (py - ny) + '" stroke="#a8713c" stroke-width="7" stroke-linecap="round"/>'; }
    [1, -1].forEach(function (k) { s += '<path d="M' + (x1 + nx * k) + ' ' + (y1 + ny * k) + ' L' + (x2 + nx * k) + ' ' + (y2 + ny * k) + '" stroke="#6e431c" stroke-width="10" stroke-linecap="round"/><path d="M' + (x1 + nx * k) + ' ' + (y1 + ny * k) + ' L' + (x2 + nx * k) + ' ' + (y2 + ny * k) + '" stroke="#c98d50" stroke-width="5" stroke-linecap="round"/>'; });
    s += '<g transform="translate(' + x1 + ' ' + (y1 + 4) + ')"><path d="M0 -12 L3.5 -4 L12 -4 L5 1.5 L7.5 10 L0 5 L-7.5 10 L-5 1.5 L-12 -4 L-3.5 -4 Z" fill="#ffd54a" stroke="#b8860b" stroke-width="1.5"/></g>';
    return s;
  }
  var SKINS = [['#46a33e', '#226b1f', '#f2dc5d'], ['#7b9a2a', '#4d6316', '#e9e28a'], ['#2f8f7a', '#17594b', '#bdf0d8'], ['#a35b2c', '#6b3814', '#f6c27a'], ['#5f6fb8', '#36437a', '#c9d2ff']];
  /* a serpent's body: a smooth wavy line from its head (higher square) to its tail */
  function serpentPts(a, b, k) {
    var A = cell(a), B = cell(b), x1 = A.cx, y1 = A.cy, x2 = B.cx, y2 = B.cy + 18, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L, waves = Math.max(1.5, L / 190), amp = Math.min(46, 16 + L / 14), pts = [];
    for (var i = 0; i <= 60; i++) { var t = i / 60, w = Math.sin(t * Math.PI * waves * 2 + (k % 2 ? Math.PI : 0)) * amp * Math.sin(Math.min(1, t * 1.2) * Math.PI); pts.push([x1 + dx * t + nx * w, y1 + dy * t + ny * w]); }
    return pts;
  }
  function serpentArt(pts, k) {
    var sk = SKINS[k % SKINS.length], s = '', d = 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' L');
    /* outline, body tapering to the tail, belly spots */
    for (var i = 0; i < pts.length - 1; i += 2) { var w = 30 - 22 * i / pts.length, e0 = Math.min(pts.length - 1, i + 2); s += '<path d="M' + pts[i][0].toFixed(1) + ' ' + pts[i][1].toFixed(1) + ' L' + pts[e0][0].toFixed(1) + ' ' + pts[e0][1].toFixed(1) + '" stroke="' + sk[1] + '" stroke-width="' + (w + 5).toFixed(1) + '" stroke-linecap="round"/>'; }
    for (var j = 0; j < pts.length - 1; j += 2) { var w2 = 30 - 22 * j / pts.length, e = Math.min(pts.length - 1, j + 2); s += '<path d="M' + pts[j][0].toFixed(1) + ' ' + pts[j][1].toFixed(1) + ' L' + pts[e][0].toFixed(1) + ' ' + pts[e][1].toFixed(1) + '" stroke="' + sk[0] + '" stroke-width="' + w2.toFixed(1) + '" stroke-linecap="round"/>'; }
    s += '<path d="' + d + '" stroke="' + sk[2] + '" stroke-width="5" fill="none" stroke-dasharray="7 13" stroke-linecap="round" opacity=".85"/>';
    /* the head, turned along the body */
    var h = pts[0], n = pts[3], ang = Math.atan2(h[1] - n[1], h[0] - n[0]) * 180 / Math.PI;
    s += '<g transform="translate(' + h[0].toFixed(1) + ' ' + h[1].toFixed(1) + ') rotate(' + ang.toFixed(1) + ')">' +
      '<path d="M22 0 L34 -4 M22 0 L34 4" stroke="#d6332e" stroke-width="2.5" stroke-linecap="round"/>' +
      '<ellipse cx="4" cy="0" rx="22" ry="17" fill="' + sk[1] + '"/><ellipse cx="4" cy="0" rx="19.5" ry="14.5" fill="' + sk[0] + '"/>' +
      '<circle cx="8" cy="-8" r="6" fill="#fff"/><circle cx="8" cy="8" r="6" fill="#fff"/><circle cx="10" cy="-8" r="3" fill="#1a1a1a"/><circle cx="10" cy="8" r="3" fill="#1a1a1a"/><circle cx="11" cy="-9.2" r="1" fill="#fff"/><circle cx="11" cy="6.8" r="1" fill="#fff"/>' +
      '<path d="M19 -3 Q22 0 19 3" stroke="' + sk[1] + '" stroke-width="2" fill="none"/></g>';
    return s;
  }

  /* ---------------- a die you can see roll ---------------- */
  var FACE_ROT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
  function makeDie() {
    var cube = el('div', { class: 'kj-die__cube' });
    [1, 2, 3, 4, 5, 6].forEach(function (f) { var face = el('div', { class: 'kj-die__face kj-die__face--' + f }); var P = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] }[f]; for (var i = 1; i <= 9; i++) face.appendChild(el('i', { class: P.indexOf(i) >= 0 ? 'on' : '' })); cube.appendChild(face); });
    var wrap = el('div', { class: 'kj-die', 'aria-hidden': 'true' }, [cube]), spins = 0;
    wrap.show = function (v, roll) { var r = FACE_ROT[v]; spins += roll ? 2 : 0; cube.style.transform = 'rotateX(' + (r[0] + spins * 360) + 'deg) rotateY(' + (r[1] + spins * 360 + (roll ? 360 : 0)) + 'deg)'; };
    wrap.show(1, false);
    return wrap;
  }

  /* ---------------- the game ---------------- */
  function journey(box, level, alive) {
    var COMP, serp, exact, LAD = {}, SER;
    function cfg(lv) { level = lv; COMP = { easy: 0.5, medium: 0.62, hard: 0.75 }[level] || 0.6; serp = SERPENTS.slice(0, level === 'easy' ? 5 : level === 'medium' ? 8 : 10); exact = level === 'hard'; SER = {}; serp.forEach(function (s) { SER[s[0]] = s; }); }
    cfg(level); LADDERS.forEach(function (l) { LAD[l[0]] = l; });
    var NET = null, join = K.net ? K.net.pending('journey') : '';

    /* ----- 1) choose players and pilgrims ----- */
    var count = 1, slots = [];
    var setup = el('div', { class: 'kj-setup' });
    box.appendChild(setup);
    function drawSetup() {
      setup.innerHTML = '';
      setup.appendChild(el('div', { class: 'kj-setup__head' }, [el('h5', { text: '🏛️ Journey to Jerusalem' }), el('p', { class: 'kt-note', text: 'Walk the road from Galilee to the Temple in Jerusalem. Good deeds are ladders that lift you up; sins are serpents that pull you down. Roll the die and be the first to reach the Temple!' })]));
      var chips = el('div', { class: 'kg-levels', role: 'group', 'aria-label': 'Players' });
      [1, 2, 3, 4].forEach(function (n) { chips.appendChild(el('button', { class: 'kg-level', type: 'button', 'aria-pressed': n === count ? 'true' : 'false', text: n === 1 ? 'Me vs computer' : n + ' players', onclick: function () { count = n; slots = slots.slice(0, n); drawSetup(); } })); });
      setup.appendChild(chips);
      var need = slots.length < count;
      setup.appendChild(el('p', { class: 'kj-setup__ask', text: need ? (count === 1 ? 'Choose your pilgrim:' : 'Player ' + (slots.length + 1) + ', choose your pilgrim:') : 'Ready? Tap a pilgrim above to change.' }));
      var chosen = el('div', { class: 'kj-slots' });
      for (var i = 0; i < count; i++) (function (i) {
        var c = slots[i];
        chosen.appendChild(el('button', { class: 'kj-slot' + (c ? ' on' : ''), type: 'button', style: c ? '--kj-ring:' + c.ring : '', 'aria-label': 'Player ' + (i + 1), onclick: function () { if (slots[i]) { slots.splice(i, 1); drawSetup(); } } }, [
          el('span', { class: 'kj-slot__n', text: count === 1 ? 'You' : 'Player ' + (i + 1) }), c ? portrait(c, 54) : el('span', { class: 'kj-slot__q', text: '?' }), el('strong', { text: c ? c.name : '…' })]));
      })(i);
      setup.appendChild(chosen);
      var grid = el('div', { class: 'kj-chars' });
      CHARS.forEach(function (c) {
        var taken = slots.indexOf(c) >= 0;
        grid.appendChild(el('button', { class: 'kj-char' + (taken ? ' taken' : ''), type: 'button', style: '--kj-ring:' + c.ring, disabled: taken || !need ? 'disabled' : null, onclick: function () { if (slots.length < count && slots.indexOf(c) < 0) { slots.push(c); K.sound('tap'); drawSetup(); } } }, [portrait(c, 70), el('strong', { text: c.name })]));
      });
      setup.appendChild(grid);
      setup.appendChild(el('div', { class: 'kt-row' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', disabled: need ? 'disabled' : null, text: '▶ Start the journey', onclick: function () {
        var ps = slots.map(function (c, i) { return { c: c, pos: 1, cpu: false, label: count === 1 ? 'You' : 'Player ' + (i + 1) }; });
        if (count === 1) { var left = CHARS.filter(function (c) { return slots.indexOf(c) < 0; }); ps.push({ c: K.pick(left), pos: 1, cpu: true, label: 'Computer' }); }
        setup.remove(); play(ps); try { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
      } })]));
      /* 7.22.0: online, up to 4 phones */
      if (K.net && K.net.ok()) {
        var ns = K.net.saved('journey');
        if (ns) setup.appendChild(el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '↻ Continue the online game', title: ns.code, onclick: function () { K.net.get(ns).then(function (d) { ns.v = d.v; online(ns, d); }).catch(function (e) { if (e && e.why === 'gone') K.net.forget('journey'); drawSetup(); }); } })]));
        setup.appendChild(K.net.chooser('journey', function () { var st = { lvl: level, seed: (Math.random() * 1e9) | 0, pl: [], go: 0, log: [], n: 1 }; return K.net.create('journey', st, 4).then(function (x) { online(x, { seats: [1, 0, 0, 0], state: st, v: x.v }); }); },
          function (c) { return K.net.join('journey', c).then(function (x) { online(x, x.data); }); }, join));
        setup.appendChild(el('p', { class: 'kt-note', style: 'text-align:center', text: 'Online: up to 4 players, each on their own phone.' }));
        if (join) { var jb = setup.querySelector('.kg-net__join button'); join = ''; if (jb) setTimeout(function () { jb.click(); }, 50); }
      }
    }
    drawSetup();

    /* ----- online: a lobby where each phone chooses a pilgrim, then the same board on every phone ----- */
    function seeded(arr, seed) { var a = arr.slice(), x = seed | 0; function r() { x = x + 0x6D2B79F5 | 0; var t = Math.imul(x ^ x >>> 15, 1 | x); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; } for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
    function online(sess, d) {
      var seat = sess.seat, st = d.state || {}, lob = null, game = null;
      NET = { sess: sess, seat: seat };
      setup.remove();
      function update(fn) { return K.net.update(sess, function (cur) { cur = cur || st; return fn(cur) || cur; }).then(function () { return K.net.get(sess); }).then(function (dd) { d = dd; st = dd.state; show(); }).catch(function (e) { if (lob) lob.appendChild(el('p', { class: 'kg-net__msg', text: K.net.why(e) })); }); }
      function players() { return (st.pl || []).map(function (x, k) { return { c: CHARS[x.c], pos: 1, cpu: false, remote: x.s !== seat, s: x.s, k: k + 1, label: x.s === seat ? 'You' : 'Player ' + (k + 1) }; }); }
      function show() {
        if (st.go) { if (lob) { lob.remove(); lob = null; } if (!game || game.n !== (st.n || 1)) { if (game) game.end(); cfg(st.lvl || level); game = play(players(), { sess: sess, seat: seat, st: st, update: update }); } else game.sync(st); return; }
        if (game) { game.end(); game = null; }
        if (!lob) { lob = el('div', { class: 'kj-setup' }); box.appendChild(lob); }
        lob.innerHTML = '';
        lob.appendChild(el('div', { class: 'kj-setup__head' }, [el('h5', { text: '🏛️ Journey to Jerusalem' }), el('p', { class: 'kg-net__small' }, [el('span', { text: 'Online game' }), el('span', { 'data-kjt-notr': '', text: ' · ' + sess.code.replace(/(...)(...)/, '$1 $2') })])]));
        if (seat === 0) lob.appendChild(K.net.card('journey', sess.code, false));
        var pl = st.pl || [], mine = pl.filter(function (x) { return x.s === seat; })[0];
        var chosen = el('div', { class: 'kj-slots' });
        pl.forEach(function (x, k) { var c = CHARS[x.c]; chosen.appendChild(el('div', { class: 'kj-slot on', style: '--kj-ring:' + c.ring }, [el('span', { class: 'kj-slot__n', text: x.s === seat ? 'You' : 'Player ' + (k + 1) }), portrait(c, 54), el('strong', { text: c.name })])); });
        lob.appendChild(chosen);
        if (!mine) {
          lob.appendChild(el('p', { class: 'kj-setup__ask', text: 'Choose your pilgrim:' }));
          var grid = el('div', { class: 'kj-chars' });
          CHARS.forEach(function (c, ci) { var taken = pl.some(function (x) { return x.c === ci; });
            grid.appendChild(el('button', { class: 'kj-char' + (taken ? ' taken' : ''), type: 'button', style: '--kj-ring:' + c.ring, disabled: taken ? 'disabled' : null, onclick: function () { K.sound('tap'); update(function (cur) { cur.pl = cur.pl || []; if (cur.go || cur.pl.some(function (x) { return x.s === seat || x.c === ci; })) return cur; cur.pl.push({ s: seat, c: ci }); return cur; }); } }, [portrait(c, 70), el('strong', { text: c.name })])); });
          lob.appendChild(grid);
        } else if (seat === 0) {
          lob.appendChild(el('p', { class: 'kj-setup__ask', text: pl.length < 2 ? 'Waiting for your friends to join and choose a pilgrim…' : 'Everyone ready? Start when all your friends have chosen.' }));
          lob.appendChild(el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', disabled: pl.length < 2 ? 'disabled' : null, text: '▶ Start the journey', onclick: function () { update(function (cur) { if ((cur.pl || []).length >= 2) cur.go = 1; return cur; }); } })]));
        } else lob.appendChild(el('p', { class: 'kj-setup__ask', text: 'Waiting for the first player to start the journey…' }));
        lob.appendChild(el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '🚪 Leave this game', onclick: function () { K.net.forget('journey'); K.start(); } })]));
      }
      K.net.watch(sess, function (dd, unchanged) { if (!alive() || !dd) return; d = dd; if (unchanged) return; var was = st.go; st = dd.state || {}; if (was && st.go && game && game.n === (st.n || 1)) { game.sync(st); if (!game.idle()) return; } show(); });
      show();
    }

    /* ----- 2) the board ----- */
    function play(players, net) {
      var applied = 0, FAST = false, ended = false, mySeat = net ? net.seat : -1;
      function live() { return alive() && !ended; }
      var wrap = el('div', { class: 'kj-game' });
      var view = el('div', { class: 'kj-view' }), pan = el('div', { class: 'kj-pan' });
      var svg = sv('svg', { viewBox: '0 -215 1000 1215', class: 'kj-board', role: 'img', 'aria-label': 'Board: the road to Jerusalem' });
      var html = scenery() + tiles();
      LADDERS.forEach(function (l) { html += ladderArt(l[0], l[1]); });
      var SP = {}; serp.forEach(function (s, i) { SP[s[0]] = serpentPts(s[0], s[1], i); html += serpentArt(SP[s[0]], i); });
      svg.innerHTML = html;
      var tokLayer = sv('g', { class: 'kj-tokens' }); svg.appendChild(tokLayer);
      var toks = players.map(function (p) { var g = sv('g', { class: 'kj-tok' }), inner = sv('g', { class: 'kj-tok__in' }); inner.innerHTML = '<circle cx="0" cy="-2" r="30" fill="' + p.c.ring + '" opacity=".22"/>' + charArt(p.c); g.appendChild(inner); tokLayer.appendChild(g); return g; });
      pan.appendChild(svg); view.appendChild(pan);
      var card = el('div', { class: 'kj-card', hidden: 'hidden', 'aria-live': 'polite' }); view.appendChild(card);
      /* side panel */
      var side = el('div', { class: 'kj-side' }), list = el('div', { class: 'kj-players' }), die = makeDie();
      var rollBtn = el('button', { class: 'kt-btn kt-btn--yellow kj-roll', type: 'button', text: '🎲 Roll the die', onclick: function () { roll().then(function () { pump(); }); } });
      var msg = el('p', { class: 'kj-msg', 'aria-live': 'polite' });
      var zoomBtn = el('button', { class: 'kt-btn kt-btn--ghost kj-zoom', type: 'button', text: '🔍 Zoom in', onclick: function () { zoomed = !zoomed; paintZoom(); } });
      var diceRow = el('div', { class: 'kj-dice-row' }, [die, rollBtn]);
      side.appendChild(list); side.appendChild(diceRow); side.appendChild(msg); side.appendChild(zoomBtn);
      /* on phones the die sits on the board, so nobody has to scroll to roll */
      /* 7.9.10: under the board (not over it), and it stays in sight while the board is scrolled */
      if (window.innerWidth < 900) { diceRow.classList.add('kj-dice-row--over'); msg.classList.add('kj-msg--over'); view.appendChild(msg); }
      side.appendChild(el('div', { class: 'kj-key' }, [
        el('span', {}, [el('b', { text: '🪜' }), ' ', 'Ladder: a good deed lifts you up']),
        el('span', {}, [el('b', { text: '🐍' }), ' ', 'Serpent: a sin pulls you down']),
        el('span', {}, [el('b', { text: '📜' }), ' ', 'Scroll: answer a question, right moves you 3 ahead']),
        el('span', {}, [el('b', { text: '💧' }), ' ', 'Well: roll again']),
        el('span', {}, [el('b', { text: '🎲' }), ' ', 'A 6: roll again']),
        exact ? el('span', {}, [el('b', { text: '🏛️' }), ' ', 'Reach the Temple with the exact number']) : null]));
      wrap.appendChild(view); if (window.innerWidth < 900) wrap.appendChild(diceRow); wrap.appendChild(side); box.appendChild(wrap);

      /* zoom (on by default on small screens): follows the player who is moving */
      var zoomed = window.innerWidth < 700, Z = 2.2, focus = cell(1);
      function paintZoom() {
        zoomBtn.textContent = zoomed ? '🗺️ Whole board' : '🔍 Zoom in';
        view.classList.toggle('zoomed', zoomed); follow(focus, true);
      }
      function follow(c, now) {
        focus = c; if (!zoomed) { pan.style.transform = ''; return; }
        var W = view.clientWidth, H = view.clientHeight, bw = W * Z, bh = bw * 1215 / 1000, px = c.cx / 1000 * bw, py = (c.cy + 215) / 1215 * bh;
        var tx = Math.max(Math.min(0, W / 2 - px), W - bw), ty = Math.max(Math.min(0, H * .5 - py), H - bh);
        pan.style.transition = now ? 'none' : ''; pan.style.width = bw + 'px'; pan.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
      }
      paintZoom();
      var onResize = function () { follow(focus, true); }; window.addEventListener('resize', onResize); K.onLeave(function () { window.removeEventListener('resize', onResize); });

      function spot(i, n) { var c = cell(n), same = players.filter(function (p) { return p.pos === n; }), k = same.indexOf(players[i]), m = same.length; var off = m > 1 ? [[-20, -8], [20, -8], [-20, 14], [20, 14]][k] : [0, 0]; return [c.cx + off[0], c.cy + 30 + off[1]]; }
      function put(i, x, y, sc) { toks[i].setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') scale(' + (sc || 0.7) + ')'); toks[i].dataset.y = y; }
      function placeAll() { players.forEach(function (p, i) { var s = spot(i, p.pos); put(i, s[0], s[1]); }); /* lower tokens in front, the moving player on top */ toks.slice().sort(function (a, b) { return (+a.dataset.y) - (+b.dataset.y); }).forEach(function (t) { tokLayer.appendChild(t); }); tokLayer.appendChild(toks[turn]); }
      var turn = 0, busy = false, QF = K.questions().filter(function (q) { return (q.lvl || 1) <= ({ easy: 1, medium: 2, hard: 3 }[level] || 2); }), QS = net ? seeded(QF, net.st.seed) : K.shuffle(QF), qi = 0;
      placeAll();

      function drawPlayers() {
        list.innerHTML = '';
        players.forEach(function (p, i) {
          list.appendChild(el('div', { class: 'kj-pl' + (i === turn ? ' on' : ''), style: '--kj-ring:' + p.c.ring }, [portrait(p.c, 40), el('span', { class: 'kj-pl__txt' }, [el('strong', { text: p.c.name }), el('small', { text: p.label }), el('small', { class: 'kj-pl__sq', text: 'Square ' + p.pos })])]));
        });
        rollBtn.disabled = busy || players[turn].cpu || players[turn].remote;
      }
      function say(t) { msg.textContent = t || ''; }
      drawPlayers(); say(players[0].cpu ? '' : players[0].remote ? 'Waiting for player ' + players[0].k + ' to roll…' : 'Your turn: roll the die!');

      /* hop from square to square */
      function hopTo(i, n) {
        return new Promise(function (res) {
          var a = spot(i, players[i].pos), b0 = players[i].pos; players[i].pos = n; var b = spot(i, n); players[i].pos = b0;
          var t0 = performance.now(), D = FAST ? 60 : 240;
          (function f(now) { if (!live()) return res(); var t = Math.min(1, (now - t0) / D), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, x = a[0] + (b[0] - a[0]) * e, y = a[1] + (b[1] - a[1]) * e - Math.sin(Math.PI * t) * 34; put(i, x, y, 0.7 + Math.sin(Math.PI * t) * 0.06); if (t < 1) requestAnimationFrame(f); else { players[i].pos = n; res(); } })(t0);
        });
      }
      async function walk(i, steps) {
        var p = players[i], dir = 1;
        for (var k = 0; k < steps; k++) {
          var next = p.pos + dir;
          if (next > 100) { if (exact) { dir = -1; next = p.pos - 1; } else next = 100; }
          if (next === p.pos) break;
          K.sound('hop'); follow(cell(next)); await hopTo(i, next); if (!live()) return;
        }
        placeAll(); drawPlayers();
      }
      function glide(i, pts, ms, sound) {
        return new Promise(function (res) {
          if (!FAST) K.sound(sound); ms = FAST ? ms / 5 : ms; var t0 = performance.now(), lastF = 0;
          (function f(now) { if (!live()) return res(); var t = Math.min(1, (now - t0) / ms), e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2, idx = e * (pts.length - 1), a = pts[Math.floor(idx)], b = pts[Math.min(pts.length - 1, Math.floor(idx) + 1)], fr = idx - Math.floor(idx), x = a[0] + (b[0] - a[0]) * fr, y = a[1] + (b[1] - a[1]) * fr; put(i, x, y + 30); if (now - lastF > 120) { lastF = now; follow({ cx: x, cy: y }); } if (t < 1) requestAnimationFrame(f); else res(); })(t0);
        });
      }
      /* a card on the board; people tap to go on, the computer goes on by itself */
      function showCard(kind, title, text, verse, btnText, auto) {
        return new Promise(function (res) {
          card.className = 'kj-card kj-card--' + kind; card.innerHTML = '';
          card.appendChild(el('div', { class: 'kj-card__in' }, [
            el('p', { class: 'kj-card__icon', text: { good: '🪜', bad: '🐍', well: '💧', six: '🎲', q: '📜', info: 'ℹ️' }[kind] || '⭐', 'aria-hidden': 'true' }),
            el('h5', { class: 'kj-card__t', text: title }), text ? el('p', { class: 'kj-card__p', text: text }) : null, verse ? verseBox(verse) : null,
            el('button', { class: 'kt-btn kt-btn--yellow kj-card__go', type: 'button', text: btnText, onclick: function () { close(); } })]));
          card.hidden = false; var closed = false;
          function close() { if (closed) return; closed = true; card.hidden = true; res(); }
          if (auto) setTimeout(close, FAST ? 200 : auto);
        });
      }
      function askCard(q, cpu, forced) {
        return new Promise(function (res) {
          var answers = K.shuffle(q.a.slice(0, 4)), right = q.a[0], done = false;
          card.className = 'kj-card kj-card--q'; card.innerHTML = '';
          var opts = el('div', { class: 'kj-q-opts' }), fb = el('p', { class: 'kj-q-fb' });
          answers.forEach(function (a) { opts.appendChild(el('button', { class: 'kt-opt kj-q-opt', type: 'button', text: a, onclick: function () { choose(a, this); } })); });
          card.appendChild(el('div', { class: 'kj-card__in' }, [el('p', { class: 'kj-card__icon', text: '📜', 'aria-hidden': 'true' }), el('h5', { class: 'kj-card__t', text: 'A scroll with a question!' }), el('p', { class: 'kj-card__p kj-q', text: q.q }), opts, fb]));
          card.hidden = false;
          function choose(a, btn) {
            if (done) return; done = true; var ok = a === right;
            [].slice.call(opts.children).forEach(function (b) { b.disabled = true; if (b.textContent === right) b.classList.add('right'); });
            if (!ok && btn) btn.classList.add('gentle');
            fb.textContent = ok ? '⭐ Correct! Move ahead 3.' : 'Not this time. Stay on this square.';
            K.sound(ok ? 'good' : 'miss');
            setTimeout(function () { card.hidden = true; res(ok); }, FAST ? 150 : ok ? 1500 : 2300);
          }
          if (cpu) { [].slice.call(opts.children).forEach(function (b) { b.disabled = true; }); setTimeout(function () { var ok = forced !== undefined ? !!forced : K.rand() < COMP, target = ok ? right : K.pick(answers.filter(function (x) { return x !== right; })); done = false; [].slice.call(opts.children).forEach(function (b) { b.disabled = false; }); choose(target, [].slice.call(opts.children).filter(function (b) { return b.textContent === target; })[0]); }, FAST ? 150 : 1600); }
        });
      }

      var ANS = [], FORCED = null, AUTO = false;
      async function roll(fv, fa) {
        if (busy || !live()) return; busy = true; drawPlayers(); say('');
        var me = turn, p = players[turn], rep = !!fv, v = fv || K.ri(1, 6); ANS = []; FORCED = fa ? fa.slice() : null; AUTO = !!(p.cpu || p.remote || rep);
        if (net && !rep) applied++;
        if (!FAST) K.sound('diceroll'); die.show(v, true); await wait(FAST ? 120 : 950); if (!live()) return;
        say(p.cpu ? 'The computer rolled ' + v + '.' : p.remote ? 'Player ' + p.k + ' rolled ' + v + '.' : 'You rolled ' + v + '!');
        if (exact && p.pos + v > 100) { await showCard('info', 'Too far!', 'You need exactly ' + (100 - p.pos) + ' to reach the Temple. You walk to the Temple steps and back.', null, 'OK', AUTO ? 1800 : 0); }
        await walk(turn, v); if (!live()) return;
        await land(v === 6);
        if (net && !rep) { var ev = { p: me, v: v, a: ANS }; net.update(function (cur) { cur.log = cur.log || []; if ((cur.n || 1) === game.n) cur.log.push(ev); return cur; }); }
      }
      var game = { n: net ? (net.st.n || 1) : 1, log: net ? (net.st.log || []) : [],
        end: function () { ended = true; wrap.remove(); },
        idle: function () { return false; },
        sync: function (st2) { game.log = st2.log || []; pump(); } };
      function pump() {
        if (!net || busy || !live() || applied >= game.log.length) { FAST = false; return; }
        var ev = game.log[applied]; FAST = game.log.length - applied > 1;
        if (!players[ev.p]) { applied++; return pump(); }
        applied++; turn = ev.p; roll(ev.v, ev.a || []).then(function () { pump(); });
      }
      async function land(six) {
        var i = turn, p = players[i];
        if (p.pos >= 100) return win(i);
        if (LAD[p.pos]) {
          var l = LAD[p.pos], g = GOOD[l[2]];
          K.sound('good'); await showCard('good', 'A good deed!', g[0], g[1], '⬆ Climb up!', AUTO ? 2600 : 0); if (!live()) return;
          var A = cell(l[0]), B = cell(l[1]); await glide(i, [[A.cx, A.cy], [B.cx, B.cy]], 1300, 'climb'); p.pos = l[1]; placeAll(); drawPlayers();
          if (p.pos >= 100) return win(i);
        } else if (SER[p.pos]) {
          var s = SER[p.pos], b = BAD[s[2]];
          K.sound('hiss'); await showCard('bad', 'Oh no, a serpent!', b[0], b[1], '⬇ Slide down', AUTO ? 2600 : 0); if (!live()) return;
          await glide(i, SP[s[0]], 1700, 'slither'); p.pos = s[1]; placeAll(); drawPlayers();
          await showCard('info', 'Say sorry to God, and keep going. He forgives!', null, SORRY, 'Amen →', AUTO ? 2200 : 0); if (!live()) return;
        } else if (SCROLLS.indexOf(p.pos) >= 0 && QS.length) {
          var ok = await askCard(QS[qi++ % QS.length], AUTO, FORCED ? (FORCED.length ? FORCED.shift() : 0) : undefined); if (!live()) return; ANS.push(ok ? 1 : 0);
          if (ok) { await walk(i, 3); if (!live()) return; if (p.pos >= 100) return win(i); return land(six); }
        } else if (WELLS.indexOf(p.pos) >= 0) {
          K.sound('splash'); await showCard('well', 'A well of fresh water!', 'Drink and rest a moment, then roll again.', null, '🎲 Roll again', AUTO ? 1800 : 0);
          return again();
        }
        if (six) { await showCard('six', 'You rolled a 6!', 'Roll again.', null, '🎲 Roll again', AUTO ? 1500 : 0); return again(); }
        next();
      }
      function again() { if (!live()) return; busy = false; drawPlayers(); say(players[turn].cpu ? '' : players[turn].remote ? 'Player ' + players[turn].k + ' rolls again…' : 'Roll again!'); if (players[turn].cpu) setTimeout(function () { if (live()) roll(); }, 700); }
      function next() {
        if (!live()) return;
        turn = (turn + 1) % players.length; busy = false; placeAll(); drawPlayers(); follow(cell(players[turn].pos));
        var p = players[turn]; if (net && !p.remote && !FAST) K.net.nudge();
        say(p.cpu ? 'The computer is rolling…' : p.remote ? 'Waiting for player ' + p.k + ' to roll…' : (players.length > 1 && !net && !players.some(function (x) { return x.cpu; }) ? 'Next player: roll the die!' : 'Your turn: roll the die!'));
        if (p.cpu) setTimeout(function () { if (live()) roll(); }, 900);
      }
      async function win(i) {
        busy = true; rollBtn.disabled = true; var p = players[i]; placeAll(); drawPlayers();
        follow(cell(100)); svg.classList.add('kj-won');
        var glow = sv('circle', { cx: 110, cy: -90, r: 10, fill: '#fff6c8', class: 'kj-glory' }); svg.insertBefore(glow, tokLayer);
        K.sound('fanfare'); await wait(600); K.sound('bell');
        var human = !p.cpu && !p.remote;
        if (human) K.award('journey', level);
        var againBtn = net ? el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: 'Play again →', onclick: function () { net.update(function (cur) { cur.log = []; cur.n = (cur.n || 1) + 1; cur.seed = (Math.random() * 1e9) | 0; return cur; }); } })
          : el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: 'Play again →', onclick: K.start });
        card.className = 'kj-card kj-card--win'; card.innerHTML = '';
        card.appendChild(el('div', { class: 'kj-card__in' }, [portrait(p.c, 90), el('h5', { class: 'kj-card__t' }, [el('span', { 'data-kjt-notr': '', text: p.c.name }), ' · ', el('span', { text: human ? 'Welcome to the Temple in Jerusalem!' : p.remote ? 'reached the Temple first. Well played!' : 'The computer reached the Temple first this time. Try again!' })]), verseBox(GLAD),
          el('div', { class: 'kt-row', style: 'justify-content:center' }, [againBtn, net ? el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '🚪 Leave this game', onclick: function () { K.net.forget('journey'); K.start(); } }) : el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '🎮 All games', onclick: K.menu })])]));
        card.hidden = false;
        if (human) { K.sound('success'); } else K.sound('sad');
      }
      if (players[0].cpu) setTimeout(roll, 900);
      if (net) { FAST = game.log.length > 1; setTimeout(pump, 300); }
      return game;
    }
  }

  window.KJTGames.register({ id: 'journey', cat: 'family', icon: '🏛️', name: 'Journey to Jerusalem', blurb: 'Board game for 1–4 players: climb the ladders of good deeds, beware the serpents, and reach the Temple', run: journey });
})();
