/* KJT Kids Corner - Bible Games: Holy War (Site Core 7.9.10)
   Chess, the side of good against the side of evil, on a painted board.
   Good: the Archangel Michael (king), the Archangel Gabriel (queen), holy bishops, Saint George
   (knights), churches (rooks) and soldiers of light (pawns). Evil: the devil (king), the old
   serpent (queen), false prophets (bishops), dragons (knights), towers of Babel (rooks) and
   little demons (pawns). Christ is not a piece: the victory is His, and the game says so.
   - Full rules: castling, en passant, promotion (choose the piece), check, checkmate,
     stalemate, draws by repetition, 50 moves or too few pieces.
   - Play the side of good against the computer (Easy, Medium, Hard), or two players.
   - Tap a piece to see where it can go; Undo; a Hint on Easy and Medium; a guide to the pieces.
   - The game in progress is kept on this device, so a child can come back to it.
   Texts are plain page text, so the Kids Corner languages translate them. */
(function () {
  'use strict';
  if (!window.KJTGames) return;
  var K = window.KJTGames.kit, el = K.el, T = K.T || function (s) { return s; };
  var NS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs) { var n = document.createElementNS(NS, tag); Object.keys(attrs || {}).forEach(function (k) { if (attrs[k] != null) n.setAttribute(k, attrs[k]); }); return n; }
  function passage(book, ch, v1, v2) {
    return new Promise(function (resolve) {
      if ((K.lang || 'en') === 'en') return resolve(null);
      var done = false, go = function () { if (done) return; done = true; if (!window.KJT_KIDS_PASSAGE) return resolve(null); window.KJT_KIDS_PASSAGE(book, ch, v1, v2).then(resolve, function () { resolve(null); }); };
      if (window.KJT_KIDS_PASSAGE) return go();
      window.addEventListener('kjt-kids-passage-ready', go, { once: true }); setTimeout(go, 4000);
    });
  }
  function verseBox(v) {
    var txt = el('span', { class: 'kc-verse__t', 'data-kjt-notr': '', text: '“' + v[4] + '”' });
    passage(v[0], v[1], v[2], v[3]).then(function (t) { if (t) txt.textContent = '“' + t + '”'; });
    return el('p', { class: 'kc-verse' }, [txt, el('span', { class: 'kc-verse__r', text: v[5] })]);
  }

/* Holy War pieces (SVG). Each piece stands on its base at y = 36, drawn in a box about -45..45 wide. */
var KC_DEFS = '<defs>' +
  '<linearGradient id="kc-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff4c2"/><stop offset=".45" stop-color="#f0c64a"/><stop offset="1" stop-color="#a8740f"/></linearGradient>' +
  '<linearGradient id="kc-goldh" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a8740f"/><stop offset=".5" stop-color="#ffe58a"/><stop offset="1" stop-color="#a8740f"/></linearGradient>' +
  '<linearGradient id="kc-white" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#f1ece0"/><stop offset="1" stop-color="#cfc6b2"/></linearGradient>' +
  '<linearGradient id="kc-wing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9dcf0"/></linearGradient>' +
  '<linearGradient id="kc-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f8fd8"/><stop offset="1" stop-color="#1f4f92"/></linearGradient>' +
  '<linearGradient id="kc-redc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2453a"/><stop offset="1" stop-color="#8f1c18"/></linearGradient>' +
  '<linearGradient id="kc-steel" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9aa6b2"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#8a96a2"/></linearGradient>' +
  '<radialGradient id="kc-halo"><stop offset="0" stop-color="#fffbe0"/><stop offset=".55" stop-color="#ffe066"/><stop offset="1" stop-color="#f3c548" stop-opacity="0"/></radialGradient>' +
  '<linearGradient id="kc-obs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b4766"/><stop offset="1" stop-color="#170c1d"/></linearGradient>' +
  '<linearGradient id="kc-dark" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a3358"/><stop offset=".6" stop-color="#2a1834"/><stop offset="1" stop-color="#120816"/></linearGradient>' +
  '<linearGradient id="kc-devil" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#b3262a"/><stop offset=".6" stop-color="#6e1218"/><stop offset="1" stop-color="#2e060a"/></linearGradient>' +
  '<linearGradient id="kc-scale" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3f5e3a"/><stop offset=".6" stop-color="#1f3420"/><stop offset="1" stop-color="#0c160d"/></linearGradient>' +
  '<linearGradient id="kc-stone" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a2230"/><stop offset=".5" stop-color="#4c4052"/><stop offset="1" stop-color="#231b28"/></linearGradient>' +
  '<radialGradient id="kc-ember"><stop offset="0" stop-color="#ffe08a"/><stop offset=".5" stop-color="#ff5a2a"/><stop offset="1" stop-color="#ff2a10" stop-opacity="0"/></radialGradient>' +
  '<radialGradient id="kc-glowr"><stop offset="0" stop-color="#ff3b30" stop-opacity=".55"/><stop offset="1" stop-color="#ff3b30" stop-opacity="0"/></radialGradient>' +
  '</defs>';

function kcBase(good) {
  return good
    ? '<ellipse cx="0" cy="40" rx="33" ry="9" fill="rgba(30,15,0,.35)"/><ellipse cx="0" cy="38" rx="31" ry="9" fill="#8a5d0c"/><ellipse cx="0" cy="35" rx="31" ry="9" fill="url(#kc-gold)"/><ellipse cx="0" cy="34" rx="24" ry="6" fill="none" stroke="#fff6c8" stroke-width="1.5" opacity=".8"/>'
    : '<ellipse cx="0" cy="40" rx="33" ry="9" fill="rgba(0,0,0,.4)"/><ellipse cx="0" cy="38" rx="31" ry="9" fill="#0d0610"/><ellipse cx="0" cy="35" rx="31" ry="9" fill="url(#kc-obs)"/><ellipse cx="0" cy="34" rx="24" ry="6" fill="none" stroke="#e0332b" stroke-width="1.6" opacity=".85"/>';
}
var SKIN = '#e3b48a', SKIN2 = '#c98d5e';
function kcEyes(x, y, col) { return '<circle cx="' + (x - 4) + '" cy="' + y + '" r="1.7" fill="' + (col || '#2a1a10') + '"/><circle cx="' + (x + 4) + '" cy="' + y + '" r="1.7" fill="' + (col || '#2a1a10') + '"/>'; }

var KC_ART = {
  /* ---------- the side of good ---------- */
  P: function () { /* a soldier of light: helmet, white tunic, shield of faith */
    return kcBase(true) +
      '<path d="M-15 33 L-12 2 Q0 -4 12 2 L15 33 Z" fill="url(#kc-white)" stroke="#bfb293" stroke-width="1.5"/>' +
      '<circle cx="0" cy="-9" r="10.5" fill="' + SKIN + '"/>' + kcEyes(0, -8) + '<path d="M-3 -3.5 Q0 -1.5 3 -3.5" stroke="#8a4a2a" stroke-width="1.3" fill="none"/>' +
      '<path d="M-12 -10 Q-12 -25 0 -25 Q12 -25 12 -10 L9 -10 Q9 -14 0 -14 Q-9 -14 -9 -10 Z" fill="url(#kc-gold)" stroke="#8a5d0c" stroke-width="1"/><path d="M0 -25 Q-2 -32 4 -34" stroke="#d63a3a" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<g transform="translate(-1 17)"><ellipse rx="13" ry="15" fill="url(#kc-gold)" stroke="#8a5d0c" stroke-width="1.6"/><path d="M0 -10 V10 M-8 -2 H8" stroke="#c62828" stroke-width="3.4" stroke-linecap="round"/></g>';
  },
  R: function () { /* the Church: white walls, a golden dome and the Cross */
    return kcBase(true) +
      '<path d="M-23 34 L-21 -6 L21 -6 L23 34 Z" fill="url(#kc-white)" stroke="#bfb293" stroke-width="1.6"/>' +
      '<path d="M-25 -6 L0 -18 L25 -6 Z" fill="#d9cfb8" stroke="#bfb293" stroke-width="1.2"/>' +
      '<rect x="-12" y="-28" width="24" height="12" fill="url(#kc-white)" stroke="#bfb293" stroke-width="1.2"/>' +
      '<path d="M-13 -28 Q-17 -44 0 -52 Q17 -44 13 -28 Z" fill="url(#kc-gold)" stroke="#8a5d0c" stroke-width="1.2"/><path d="M-5 -30 Q-6 -42 0 -48" stroke="#fff6c8" stroke-width="2" fill="none" opacity=".7"/>' +
      '<path d="M0 -52 V-68 M-6 -62 H6 M-4 -57 L4 -55" stroke="#c98a12" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M-7 34 V18 Q0 9 7 18 V34 Z" fill="#7a4a1e"/><path d="M-15 8 V0 Q-11 -4 -7 0 V8 Z M7 8 V0 Q11 -4 15 0 V8 Z" fill="url(#kc-blue)"/><path d="M-3 -19 V-24 Q0 -26 3 -24 V-19 Z" fill="url(#kc-blue)"/>';
  },
  B: function () { /* a holy bishop: mitre, beard, vestments with crosses, crozier */
    return kcBase(true) +
      '<path d="M-17 34 L-13 -2 Q0 -8 13 -2 L17 34 Z" fill="url(#kc-gold)" stroke="#8a5d0c" stroke-width="1.4"/>' +
      '<path d="M-5 -4 L-6 34 L6 34 L5 -4 Z" fill="url(#kc-white)"/><path d="M0 6 V14 M-3 10 H3 M0 20 V28 M-3 24 H3" stroke="#c62828" stroke-width="1.8"/>' +
      '<circle cx="0" cy="-13" r="10" fill="' + SKIN + '"/>' + kcEyes(0, -14) +
      '<path d="M-9 -11 Q-10 2 0 4 Q10 2 9 -11 Q6 -6 0 -7 Q-6 -6 -9 -11 Z" fill="#e8e4dc" stroke="#c9c2b4" stroke-width=".8"/>' +
      '<path d="M-11 -20 Q-13 -38 0 -40 Q13 -38 11 -20 Z" fill="url(#kc-gold)" stroke="#8a5d0c" stroke-width="1.2"/><circle cx="0" cy="-30" r="3.2" fill="#c62828"/><circle cx="-6" cy="-24" r="1.8" fill="#2a7fc4"/><circle cx="6" cy="-24" r="1.8" fill="#2a7fc4"/><path d="M0 -40 V-48 M-3.5 -45 H3.5" stroke="#c98a12" stroke-width="2.4" stroke-linecap="round"/>' +
      '<path d="M22 34 V-30" stroke="#c99a2a" stroke-width="3.6" stroke-linecap="round"/><path d="M21 32 V-28" stroke="#ffe58a" stroke-width="1.2" stroke-linecap="round"/><path d="M22 -30 V-42 M17 -36 H27" stroke="#c98a12" stroke-width="3" stroke-linecap="round"/><circle cx="19" cy="4" r="4" fill="' + SKIN + '"/>';
  },
  N: function () { /* Saint George: the white horse and the lance with the red cross */
    return kcBase(true) +
      '<path d="M-36 34 L-18 -60" stroke="#8a5d0c" stroke-width="3.2" stroke-linecap="round"/><path d="M-20 -50 L-34 -52 L-32 -40 L-18 -40 Z" fill="#fff" stroke="#c9c2b4"/><path d="M-26 -51 L-25 -40 M-33 -46 L-19 -45" stroke="#c62828" stroke-width="2.2"/>' +
      '<path d="M-20 34 L-17 12 Q-27 0 -19 -16 Q-9 -36 8 -40 L14 -50 L18 -38 Q31 -30 32 -14 Q33 -6 28 -4 Q22 -1 16 -5 Q10 -8 5 -4 Q12 10 18 34 Z" fill="url(#kc-white)" stroke="#a8b0ba" stroke-width="2"/>' +
      '<path d="M8 -40 Q-4 -34 -10 -22 Q-16 -10 -15 6 Q-22 -6 -19 -16 Q-12 -32 2 -40 Z" fill="url(#kc-gold)"/><path d="M-15 6 Q-12 -6 -6 -18" stroke="#c98a12" stroke-width="2" fill="none"/>' +
      '<circle cx="14" cy="-26" r="3" fill="#2a1a10"/><circle cx="15" cy="-27" r="1" fill="#fff"/><circle cx="27" cy="-10" r="1.8" fill="#6a6a7a"/>' +
      '<path d="M6 -22 L28 -8 M10 -24 Q8 -14 10 -6" stroke="#c62828" stroke-width="2" fill="none"/><circle cx="10" cy="-14" r="2.2" fill="url(#kc-gold)"/>';
  },
  Q: function () { /* the Archangel Gabriel: wings, halo, white robe, golden trumpet */
    return kcBase(true) +
      '<path d="M-6 -16 Q-38 -30 -40 -6 Q-34 4 -22 2 Q-34 12 -24 22 Q-12 20 -8 6 Z" fill="url(#kc-wing)" stroke="#a9bdd4" stroke-width="1.2"/><path d="M6 -16 Q38 -30 40 -6 Q34 4 22 2 Q34 12 24 22 Q12 20 8 6 Z" fill="url(#kc-wing)" stroke="#a9bdd4" stroke-width="1.2"/>' +
      '<path d="M-30 -14 Q-20 -14 -10 -8 M-31 0 Q-22 -2 -12 2 M30 -14 Q20 -14 10 -8 M31 0 Q22 -2 12 2" stroke="#b9cde2" stroke-width="1.4" fill="none"/>' +
      '<path d="M-17 34 L-11 -4 Q0 -10 11 -4 L17 34 Z" fill="url(#kc-white)" stroke="#bfb293" stroke-width="1.4"/><path d="M-12 30 Q0 34 12 30" stroke="#5aa0e0" stroke-width="3" fill="none"/><path d="M-4 -6 L-6 34 M4 -6 L6 34" stroke="#5aa0e0" stroke-width="2.2"/>' +
      '<circle cx="0" cy="-26" r="15" fill="url(#kc-halo)"/><circle cx="0" cy="-26" r="13" fill="none" stroke="#e0b13a" stroke-width="1.6"/>' +
      '<circle cx="0" cy="-20" r="9.5" fill="' + SKIN + '"/>' + kcEyes(0, -20) + '<path d="M-3 -16 Q0 -14 3 -16" stroke="#8a4a2a" stroke-width="1.2" fill="none"/>' +
      '<path d="M-10 -20 Q-11 -32 0 -32 Q11 -32 10 -20 Q8 -27 0 -27 Q-8 -27 -10 -20 Z" fill="#c9922e"/><path d="M-9 -26 Q0 -30 9 -26" stroke="url(#kc-gold)" stroke-width="2" fill="none"/>' +
      '<path d="M8 -8 L30 -24 L33 -19 Z" fill="url(#kc-gold)" stroke="#8a5d0c" stroke-width="1"/><ellipse cx="32.5" cy="-22" rx="3.5" ry="6" transform="rotate(-36 32.5 -22)" fill="url(#kc-gold)" stroke="#8a5d0c"/><circle cx="7" cy="-7" r="3.2" fill="' + SKIN + '"/>' +
      '<path d="M-24 -40 l1.5 3 3 .5 -2.2 2 .6 3 -2.9 -1.5 -2.9 1.5 .6 -3 -2.2 -2 3 -.5z" fill="#fff6c8"/>';
  },
  K: function () { /* the Archangel Michael: wings, golden armour, red cloak, crown, sword of the Spirit */
    return kcBase(true) +
      '<path d="M-8 -14 Q-44 -34 -44 -4 Q-38 6 -26 4 Q-38 16 -26 26 Q-12 22 -10 6 Z" fill="url(#kc-wing)" stroke="#a9bdd4" stroke-width="1.2"/><path d="M8 -14 Q44 -34 44 -4 Q38 6 26 4 Q38 16 26 26 Q12 22 10 6 Z" fill="url(#kc-wing)" stroke="#a9bdd4" stroke-width="1.2"/>' +
      '<path d="M-34 -12 Q-22 -12 -12 -6 M-35 4 Q-24 2 -13 6 M34 -12 Q22 -12 12 -6 M35 4 Q24 2 13 6" stroke="#b9cde2" stroke-width="1.4" fill="none"/>' +
      '<path d="M-19 34 L-13 -2 Q0 -8 13 -2 L19 34 Z" fill="url(#kc-redc)"/>' +
      '<path d="M-12 34 L-9 12 L9 12 L12 34 Z" fill="url(#kc-white)"/>' +
      '<path d="M-12 -4 Q0 -9 12 -4 L10 14 Q0 18 -10 14 Z" fill="url(#kc-gold)" stroke="#8a5d0c" stroke-width="1.2"/><path d="M0 -4 V12 M-6 3 H6" stroke="#c62828" stroke-width="2.4"/>' +
      '<circle cx="0" cy="-30" r="17" fill="url(#kc-halo)"/><circle cx="0" cy="-30" r="15" fill="none" stroke="#e0b13a" stroke-width="1.8"/>' +
      '<circle cx="0" cy="-22" r="10" fill="' + SKIN + '"/>' + kcEyes(0, -22) + '<path d="M-3 -17.5 Q0 -16 3 -17.5" stroke="#8a4a2a" stroke-width="1.2" fill="none"/>' +
      '<path d="M-10 -22 Q-11 -33 0 -33 Q11 -33 10 -22 Q8 -29 0 -29 Q-8 -29 -10 -22 Z" fill="#b07a2a"/>' +
      '<path d="M-10 -30 L-10 -38 L-5 -33 L0 -40 L5 -33 L10 -38 L10 -30 Z" fill="url(#kc-gold)" stroke="#8a5d0c" stroke-width="1"/><circle cx="0" cy="-33" r="1.6" fill="#c62828"/>' +
      '<path d="M22 6 V-52" stroke="#9aa6b2" stroke-width="6" stroke-linecap="round"/><path d="M22 4 V-50" stroke="#f4f7fb" stroke-width="2.6" stroke-linecap="round"/><path d="M22 -52 L22 -58" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><path d="M14 6 H30" stroke="#d9a520" stroke-width="4.5" stroke-linecap="round"/><path d="M22 6 V16" stroke="#7a4a1e" stroke-width="4" stroke-linecap="round"/><circle cx="22" cy="18" r="3" fill="url(#kc-gold)"/><circle cx="18" cy="8" r="3.4" fill="' + SKIN + '"/>';
  },
  /* ---------- the side of evil ---------- */
  p: function () { /* a little demon: small horns, glowing eyes, bat wings */
    return kcBase(false) +
      '<path d="M-8 4 Q-24 -8 -28 6 Q-22 6 -20 12 Q-16 6 -12 12 Z M8 4 Q24 -8 28 6 Q22 6 20 12 Q16 6 12 12 Z" fill="#3a1e44" stroke="#120816" stroke-width="1"/>' +
      '<path d="M-14 33 Q-16 10 -10 0 Q0 -6 10 0 Q16 10 14 33 Z" fill="url(#kc-dark)"/>' +
      '<circle cx="0" cy="-8" r="12" fill="url(#kc-dark)" stroke="#120816" stroke-width="1"/>' +
      '<path d="M-8 -16 Q-12 -26 -6 -30 Q-7 -22 -3 -18 Z M8 -16 Q12 -26 6 -30 Q7 -22 3 -18 Z" fill="#8b1a1a"/>' +
      '<ellipse cx="-4.5" cy="-9" rx="3.4" ry="2.6" fill="#ffd23f"/><ellipse cx="4.5" cy="-9" rx="3.4" ry="2.6" fill="#ffd23f"/><circle cx="-4.5" cy="-9" r="1.2" fill="#c62828"/><circle cx="4.5" cy="-9" r="1.2" fill="#c62828"/>' +
      '<path d="M-5 -2 Q0 1 5 -2" stroke="#e0332b" stroke-width="1.4" fill="none"/><path d="M-3 -1.4 L-2.2 .6 L-1.4 -1 M3 -1.4 L2.2 .6 L1.4 -1" stroke="#fff" stroke-width=".9" fill="none"/>' +
      '<path d="M12 20 Q22 24 20 32" stroke="#3a1e44" stroke-width="2.4" fill="none"/><path d="M18 30 L21 35 L23 29 Z" fill="#8b1a1a"/>';
  },
  r: function () { /* the tower of Babel: dark stone steps, burning windows, never finished */
    return kcBase(false) +
      '<path d="M-26 34 L-24 18 L24 18 L26 34 Z" fill="url(#kc-stone)" stroke="#0d0610"/><path d="M-21 18 L-19 2 L19 2 L21 18 Z" fill="url(#kc-stone)" stroke="#0d0610"/><path d="M-16 2 L-14 -14 L14 -14 L16 2 Z" fill="url(#kc-stone)" stroke="#0d0610"/><path d="M-11 -14 L-10 -28 L-4 -32 L1 -27 L6 -34 L10 -28 L11 -14 Z" fill="url(#kc-stone)" stroke="#0d0610"/>' +
      '<path d="M-24 18 Q0 22 24 18 M-19 2 Q0 6 19 2 M-14 -14 Q0 -10 14 -14" stroke="#6a5a72" stroke-width="1.2" fill="none"/>' +
      '<path d="M-5 34 V25 Q0 21 5 25 V34 Z" fill="#ff5a2a"/><path d="M-14 12 V8 Q-12 6 -10 8 V12 Z M10 12 V8 Q12 6 14 8 V12 Z M-3 -4 V-8 Q0 -10 3 -8 V-4 Z M-6 -20 V-23 Q-4.5 -24.5 -3 -23 V-20 Z" fill="#ffb02a"/>' +
      '<circle cx="0" cy="28" r="10" fill="url(#kc-glowr)"/><path d="M6 -34 Q12 -44 6 -52 Q4 -44 0 -42" stroke="#5a5060" stroke-width="2.4" fill="none" opacity=".7" stroke-linecap="round"/>';
  },
  b: function () { /* the false prophet: a dark hood, burning eyes, a crooked staff */
    return kcBase(false) +
      '<path d="M-18 34 Q-17 4 -12 -8 Q0 -14 12 -8 Q17 4 18 34 Z" fill="url(#kc-dark)" stroke="#0d0610" stroke-width="1"/>' +
      '<path d="M-14 -4 Q-18 -30 0 -44 Q18 -30 14 -4 Q0 2 -14 -4 Z" fill="url(#kc-dark)" stroke="#0d0610" stroke-width="1"/><path d="M-9 -8 Q-10 -26 0 -34 Q10 -26 9 -8 Q0 -4 -9 -8 Z" fill="#0b050d"/>' +
      '<ellipse cx="-4" cy="-19" rx="2.8" ry="1.8" fill="#ff3b30"/><ellipse cx="4" cy="-19" rx="2.8" ry="1.8" fill="#ff3b30"/><circle cx="0" cy="-19" r="9" fill="url(#kc-glowr)"/>' +
      '<path d="M-6 4 Q0 8 6 4 L5 34 L-5 34 Z" fill="#6e1218"/>' +
      '<path d="M-24 34 V-28 Q-24 -40 -14 -38 Q-10 -36 -14 -32" stroke="#4a3a2a" stroke-width="3.2" fill="none" stroke-linecap="round"/><circle cx="-14" cy="-31" r="5" fill="#c62828"/><circle cx="-14" cy="-31" r="9" fill="url(#kc-glowr)"/><circle cx="-21" cy="4" r="3.4" fill="#3a2a40"/>';
  },
  n: function () { /* the dragon: dark scales, horns, a burning eye, smoke */
    return kcBase(false) +
      '<path d="M20 34 L17 12 Q27 0 20 -14 Q12 -32 -6 -38 L-10 -50 L-16 -38 Q-28 -34 -32 -20 L-36 -12 Q-34 -4 -26 -6 Q-18 -8 -12 -4 Q-16 10 -20 34 Z" fill="url(#kc-scale)" stroke="#081008" stroke-width="2"/>' +
      '<path d="M-6 -38 L-2 -50 L2 -40 Z M4 -34 L10 -44 L12 -32 Z M12 -26 L20 -32 L18 -20 Z M16 -14 L24 -16 L19 -6 Z M18 0 L26 0 L20 8 Z" fill="#7a1c1c"/>' +
      '<path d="M-14 -36 L-22 -48 L-18 -34 Z" fill="#cfc2a8"/><path d="M-6 -36 L-8 -48 L-2 -36 Z" fill="#cfc2a8"/>' +
      '<ellipse cx="-14" cy="-24" rx="4" ry="2.8" fill="#ffd23f"/><ellipse cx="-14" cy="-24" rx="1.2" ry="2.6" fill="#1a0a0a"/><circle cx="-14" cy="-24" r="8" fill="url(#kc-glowr)"/>' +
      '<path d="M-34 -12 Q-28 -10 -20 -11 M-30 -8 L-29 -5 M-25 -9 L-24 -6" stroke="#cfc2a8" stroke-width="1.6" fill="none"/><circle cx="-33" cy="-16" r="1.3" fill="#0a0a0a"/>' +
      '<path d="M-10 -2 Q-4 8 -6 20 M-2 -2 Q4 10 2 24" stroke="#2f4a2c" stroke-width="2" fill="none"/>' +
      '<circle cx="-40" cy="-16" r="4" fill="#6a6070" opacity=".55"/><circle cx="-45" cy="-21" r="3" fill="#6a6070" opacity=".4"/>';
  },
  q: function () { /* the old serpent: coils, a dark crown, red eyes, a forked tongue */
    return kcBase(false) +
      '<ellipse cx="0" cy="26" rx="25" ry="9" fill="url(#kc-dark)" stroke="#0d0610"/><ellipse cx="0" cy="22" rx="17" ry="5" fill="#3d6b3a" opacity=".85"/>' +
      '<ellipse cx="2" cy="12" rx="20" ry="8" fill="url(#kc-dark)" stroke="#0d0610"/><ellipse cx="2" cy="9" rx="13" ry="4" fill="#3d6b3a" opacity=".85"/>' +
      '<path d="M8 6 Q18 -8 6 -20 Q-4 -28 0 -38" stroke="#1d1024" stroke-width="15" fill="none" stroke-linecap="round"/><path d="M8 6 Q18 -8 6 -20 Q-4 -28 0 -38" stroke="url(#kc-dark)" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M12 0 Q16 -8 8 -16" stroke="#3d6b3a" stroke-width="4" fill="none" stroke-linecap="round" opacity=".85"/>' +
      '<ellipse cx="-2" cy="-40" rx="13" ry="10" fill="url(#kc-dark)" stroke="#0d0610"/>' +
      '<ellipse cx="-7" cy="-42" rx="3.2" ry="2.2" fill="#ff3b30"/><ellipse cx="3" cy="-42" rx="3.2" ry="2.2" fill="#ff3b30"/><ellipse cx="-7" cy="-42" rx=".9" ry="2" fill="#1a0505"/><ellipse cx="3" cy="-42" rx=".9" ry="2" fill="#1a0505"/>' +
      '<path d="M-12 -35 L-20 -33 M-20 -33 L-25 -36 M-20 -33 L-25 -30" stroke="#e0332b" stroke-width="1.6" stroke-linecap="round"/>' +
      '<path d="M-10 -48 L-12 -58 L-6 -52 L-2 -62 L2 -52 L8 -58 L6 -48 Z" fill="#5a4a20" stroke="#2a2010" stroke-width="1"/><circle cx="-2" cy="-52" r="1.6" fill="#ff3b30"/>';
  },
  k: function () { /* the devil: horns, bat wings, a dark iron crown, a trident */
    return kcBase(false) +
      '<path d="M-8 -12 Q-30 -40 -46 -18 Q-38 -16 -38 -8 Q-32 -12 -28 -4 Q-24 -10 -18 -2 Q-16 -8 -10 2 Z" fill="#2e0a12" stroke="#120408" stroke-width="1.2"/><path d="M8 -12 Q30 -40 46 -18 Q38 -16 38 -8 Q32 -12 28 -4 Q24 -10 18 -2 Q16 -8 10 2 Z" fill="#2e0a12" stroke="#120408" stroke-width="1.2"/>' +
      '<path d="M-10 -10 L-38 -16 M-12 -6 L-28 -4 M10 -10 L38 -16 M12 -6 L28 -4" stroke="#5a1820" stroke-width="1.2"/>' +
      '<path d="M-19 34 Q-18 6 -12 -4 Q0 -10 12 -4 Q18 6 19 34 Z" fill="url(#kc-dark)" stroke="#0d0610"/><path d="M-10 -2 Q0 -6 10 -2 L8 18 Q0 22 -8 18 Z" fill="url(#kc-devil)"/>' +
      '<circle cx="0" cy="-20" r="11" fill="url(#kc-devil)" stroke="#2e060a" stroke-width="1"/>' +
      '<path d="M-9 -26 Q-18 -36 -14 -46 Q-12 -36 -5 -30 Z M9 -26 Q18 -36 14 -46 Q12 -36 5 -30 Z" fill="#1a0a0a"/>' +
      '<path d="M-9 -28 L-11 -38 L-5 -32 L0 -40 L5 -32 L11 -38 L9 -28 Z" fill="#3a3440" stroke="#14101a" stroke-width="1"/><circle cx="0" cy="-32" r="1.8" fill="#ff3b30"/>' +
      '<path d="M-7 -21 L-2 -19 M7 -21 L2 -19" stroke="#1a0505" stroke-width="1.6"/><ellipse cx="-4.5" cy="-18" rx="2.6" ry="1.7" fill="#ffd23f"/><ellipse cx="4.5" cy="-18" rx="2.6" ry="1.7" fill="#ffd23f"/>' +
      '<path d="M-5 -12 Q0 -9 5 -12" stroke="#1a0505" stroke-width="1.4" fill="none"/><path d="M-3 -9 L0 -4 L3 -9" fill="#1a0505"/>' +
      '<path d="M24 34 V-40" stroke="#2a2230" stroke-width="3.2" stroke-linecap="round"/><path d="M16 -40 V-48 M24 -40 V-54 M32 -40 V-48 M16 -40 H32" stroke="#2a2230" stroke-width="3" stroke-linecap="round"/><path d="M16 -48 L14 -44 M24 -54 L22 -50 M32 -48 L30 -44" stroke="#c62828" stroke-width="2"/><circle cx="20" cy="0" r="3.4" fill="#6e1218"/>' +
      '<circle cx="0" cy="34" r="16" fill="url(#kc-glowr)" opacity=".6"/>';
  }
};


  /* ======================= the rules ======================= */
  /* board: 64 squares, 0 = a8 (top left, the side of evil), 63 = h1. Upper case = good ("w"), lower case = evil ("b"). */
  var KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]], KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  var DI = [[-1, -1], [-1, 1], [1, -1], [1, 1]], OR = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  function on(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
  function sideOf(p) { return !p ? null : p === p.toUpperCase() ? 'w' : 'b'; }
  function startState() {
    var b = 'rnbqkbnrpppppppp' + new Array(33).join(' ') + 'PPPPPPPPRNBQKBNR';
    return { b: b.split('').map(function (x) { return x === ' ' ? '' : x; }), turn: 'w', cas: 'KQkq', ep: -1, half: 0, full: 1 };
  }
  function attacked(B, i, by) {
    var r = i >> 3, c = i & 7, k, rr, cc, p;
    var pd = by === 'w' ? 1 : -1, P = by === 'w' ? 'P' : 'p';
    for (k = -1; k <= 1; k += 2) { rr = r + pd; cc = c + k; if (on(rr, cc) && B[rr * 8 + cc] === P) return true; }
    var N = by === 'w' ? 'N' : 'n', Kk = by === 'w' ? 'K' : 'k', Bb = by === 'w' ? 'B' : 'b', R = by === 'w' ? 'R' : 'r', Q = by === 'w' ? 'Q' : 'q';
    for (k = 0; k < 8; k++) { rr = r + KN[k][0]; cc = c + KN[k][1]; if (on(rr, cc) && B[rr * 8 + cc] === N) return true; rr = r + KG[k][0]; cc = c + KG[k][1]; if (on(rr, cc) && B[rr * 8 + cc] === Kk) return true; }
    for (k = 0; k < 4; k++) {
      rr = r + DI[k][0]; cc = c + DI[k][1]; while (on(rr, cc)) { p = B[rr * 8 + cc]; if (p) { if (p === Bb || p === Q) return true; break; } rr += DI[k][0]; cc += DI[k][1]; }
      rr = r + OR[k][0]; cc = c + OR[k][1]; while (on(rr, cc)) { p = B[rr * 8 + cc]; if (p) { if (p === R || p === Q) return true; break; } rr += OR[k][0]; cc += OR[k][1]; }
    }
    return false;
  }
  function kingAt(B, s) { var K0 = s === 'w' ? 'K' : 'k'; for (var i = 0; i < 64; i++) if (B[i] === K0) return i; return -1; }
  function inCheck(st, s) { s = s || st.turn; var k = kingAt(st.b, s); return k >= 0 && attacked(st.b, k, s === 'w' ? 'b' : 'w'); }
  function pseudo(st) {
    var B = st.b, me = st.turn, ms = [], i, r, c, p, t, k, rr, cc, d;
    function add(f, to, extra) { var m = { f: f, t: to, p: B[f], cap: B[to] || '' }; if (extra) for (var x in extra) m[x] = extra[x]; ms.push(m); }
    for (i = 0; i < 64; i++) {
      p = B[i]; if (!p || sideOf(p) !== me) continue; r = i >> 3; c = i & 7; t = p.toLowerCase();
      if (t === 'p') {
        var fw = me === 'w' ? -1 : 1, home = me === 'w' ? 6 : 1, last = me === 'w' ? 0 : 7, one = (r + fw) * 8 + c;
        var promo = function (f, to, cap) { ['q', 'r', 'b', 'n'].forEach(function (x) { add(f, to, { promo: me === 'w' ? x.toUpperCase() : x }); }); };
        if (on(r + fw, c) && !B[one]) { if (r + fw === last) promo(i, one); else { add(i, one); if (r === home && !B[(r + 2 * fw) * 8 + c]) add(i, (r + 2 * fw) * 8 + c, { dbl: 1 }); } }
        for (k = -1; k <= 1; k += 2) { rr = r + fw; cc = c + k; if (!on(rr, cc)) continue; var to = rr * 8 + cc;
          if (B[to] && sideOf(B[to]) !== me) { if (rr === last) promo(i, to); else add(i, to); }
          else if (to === st.ep) add(i, to, { epx: 1, cap: me === 'w' ? 'p' : 'P' }); }
      } else if (t === 'n' || t === 'k') {
        var L = t === 'n' ? KN : KG;
        for (k = 0; k < 8; k++) { rr = r + L[k][0]; cc = c + L[k][1]; if (!on(rr, cc)) continue; var q = B[rr * 8 + cc]; if (!q || sideOf(q) !== me) add(i, rr * 8 + cc); }
        if (t === 'k') {
          var opp = me === 'w' ? 'b' : 'w';
          if (me === 'w' && i === 60) {
            if (st.cas.indexOf('K') >= 0 && B[63] === 'R' && !B[61] && !B[62] && !attacked(B, 60, opp) && !attacked(B, 61, opp) && !attacked(B, 62, opp)) add(60, 62, { castle: 'K' });
            if (st.cas.indexOf('Q') >= 0 && B[56] === 'R' && !B[59] && !B[58] && !B[57] && !attacked(B, 60, opp) && !attacked(B, 59, opp) && !attacked(B, 58, opp)) add(60, 58, { castle: 'Q' });
          }
          if (me === 'b' && i === 4) {
            if (st.cas.indexOf('k') >= 0 && B[7] === 'r' && !B[5] && !B[6] && !attacked(B, 4, opp) && !attacked(B, 5, opp) && !attacked(B, 6, opp)) add(4, 6, { castle: 'k' });
            if (st.cas.indexOf('q') >= 0 && B[0] === 'r' && !B[3] && !B[2] && !B[1] && !attacked(B, 4, opp) && !attacked(B, 3, opp) && !attacked(B, 2, opp)) add(4, 2, { castle: 'q' });
          }
        }
      } else {
        var dirs = t === 'b' ? DI : t === 'r' ? OR : DI.concat(OR);
        for (d = 0; d < dirs.length; d++) { rr = r + dirs[d][0]; cc = c + dirs[d][1]; while (on(rr, cc)) { var q2 = B[rr * 8 + cc]; if (!q2) add(i, rr * 8 + cc); else { if (sideOf(q2) !== me) add(i, rr * 8 + cc); break; } rr += dirs[d][0]; cc += dirs[d][1]; } }
      }
    }
    return ms;
  }
  function apply(st, m) {
    var B = st.b.slice(), me = st.turn, cas = st.cas;
    B[m.t] = m.promo || m.p; B[m.f] = '';
    if (m.epx) B[m.t + (me === 'w' ? 8 : -8)] = '';
    if (m.castle === 'K') { B[61] = 'R'; B[63] = ''; } else if (m.castle === 'Q') { B[59] = 'R'; B[56] = ''; } else if (m.castle === 'k') { B[5] = 'r'; B[7] = ''; } else if (m.castle === 'q') { B[3] = 'r'; B[0] = ''; }
    if (m.p === 'K') cas = cas.replace(/[KQ]/g, ''); if (m.p === 'k') cas = cas.replace(/[kq]/g, '');
    [[63, 'K'], [56, 'Q'], [7, 'k'], [0, 'q']].forEach(function (x) { if (m.f === x[0] || m.t === x[0]) cas = cas.replace(x[1], ''); });
    return { b: B, turn: me === 'w' ? 'b' : 'w', cas: cas, ep: m.dbl ? (m.f + m.t) / 2 : -1, half: (m.p.toLowerCase() === 'p' || m.cap) ? 0 : st.half + 1, full: st.full + (me === 'b' ? 1 : 0) };
  }
  function legal(st) { var me = st.turn; return pseudo(st).filter(function (m) { var n = apply(st, m); return !attacked(n.b, kingAt(n.b, me), me === 'w' ? 'b' : 'w'); }); }
  function keyOf(st) { return st.b.map(function (x) { return x || '.'; }).join('') + st.turn + st.cas + st.ep; }
  function lowMaterial(B) {
    var minor = 0, other = 0; B.forEach(function (p) { if (!p) return; var t = p.toLowerCase(); if (t === 'k') return; if (t === 'n' || t === 'b') minor++; else other++; });
    return other === 0 && minor <= 1;
  }

  /* ======================= the computer ======================= */
  var VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  /* where pieces like to stand, from the side of good's point of view (a8 first) */
  var PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]
  };
  function evaluate(st) {
    var s = 0, B = st.b;
    for (var i = 0; i < 64; i++) { var p = B[i]; if (!p) continue; var t = p.toLowerCase(); if (p === t) s -= VAL[t] + PST[t][(7 - (i >> 3)) * 8 + (i & 7)]; else s += VAL[t] + PST[t][i]; }
    return st.turn === 'w' ? s : -s;
  }
  var MATE = 100000, nodes = 0;
  function order(ms) { return ms.sort(function (a, b) { return ((b.cap ? VAL[b.cap.toLowerCase()] * 10 - VAL[b.p.toLowerCase()] : 0) + (b.promo ? 800 : 0)) - ((a.cap ? VAL[a.cap.toLowerCase()] * 10 - VAL[a.p.toLowerCase()] : 0) + (a.promo ? 800 : 0)); }); }
  function quiesce(st, a, b, d) {
    var stand = evaluate(st); if (stand >= b) return b; if (a < stand) a = stand; if (d <= 0) return a;
    var ms = order(legal(st).filter(function (m) { return m.cap || m.promo; }));
    for (var i = 0; i < ms.length; i++) { nodes++; var sc = -quiesce(apply(st, ms[i]), -b, -a, d - 1); if (sc >= b) return b; if (sc > a) a = sc; }
    return a;
  }
  function negamax(st, depth, a, b, ply, qd) {
    var ms = legal(st);
    if (!ms.length) return inCheck(st) ? -MATE + ply : 0;
    if (depth <= 0) return qd ? quiesce(st, a, b, qd) : evaluate(st);
    order(ms);
    for (var i = 0; i < ms.length; i++) { nodes++; var sc = -negamax(apply(st, ms[i]), depth - 1, -b, -a, ply + 1, qd); if (sc >= b) return b; if (sc > a) a = sc; if (nodes > 40000) break; }
    return a;
  }
  function bestMove(st, level) {
    var cfg = { easy: [1, 0, 140], medium: [2, 2, 30], hard: [3, 2, 0] }[level] || [2, 2, 30];
    var ms = order(legal(st)); if (!ms.length) return null; nodes = 0;
    /* Easy and Medium weigh every move (with a little chance); Hard searches with a narrowing window */
    var alpha = -MATE - 1, scored = ms.map(function (m) {
      var sc = -negamax(apply(st, m), cfg[0] - 1, -MATE - 1, level === 'hard' ? -alpha : MATE + 1, 1, cfg[1]);
      if (sc > alpha) alpha = sc;
      return { m: m, s: sc + (cfg[2] ? (K.rand() - 0.5) * cfg[2] : 0) };
    });
    scored.sort(function (x, y) { return y.s - x.s; });
    /* Easy sometimes misses a better move, like a beginner */
    if (level === 'easy' && scored.length > 2 && K.rand() < 0.25) return scored[1 + Math.floor(K.rand() * Math.min(3, scored.length - 1))].m;
    return scored[0].m;
  }

  /* ======================= words ======================= */
  var NAMES = {
    K: ['The Archangel Michael', 'King', 'He leads the armies of heaven. Moves one square in any direction.', ['Revelation', 12, 7, 7, 'And there was war in heaven: Michael and his angels fought against the dragon; and the dragon fought and his angels,', 'Revelation 12:7']],
    Q: ['The Archangel Gabriel', 'Queen', 'The messenger of good news. Moves any number of squares in any direction.', ['Luke', 1, 19, 19, 'And the angel answering said unto him, I am Gabriel, that stand in the presence of God; and am sent to speak unto thee, and to shew thee these glad tidings.', 'Luke 1:19']],
    B: ['A holy bishop', 'Bishop', 'A shepherd of the Church. Moves any number of squares diagonally.', ['1 Peter', 5, 2, 2, 'Feed the flock of God which is among you, taking the oversight thereof, not by constraint, but willingly.', '1 Peter 5:2']],
    N: ['Saint George', 'Knight', 'The brave soldier of Christ. Jumps in an L shape, even over other pieces.', ['2 Timothy', 2, 3, 3, 'Thou therefore endure hardness, as a good soldier of Jesus Christ.', '2 Timothy 2:3']],
    R: ['The Church', 'Rook', 'A strong tower for God’s people. Moves any number of squares up, down or sideways.', ['Proverbs', 18, 10, 10, 'The name of the LORD is a strong tower: the righteous runneth into it, and is safe.', 'Proverbs 18:10']],
    P: ['A soldier of light', 'Pawn', 'Armed with the shield of faith. Moves forward one square (two on its first move) and captures diagonally. At the far end it becomes a stronger piece.', ['Ephesians', 6, 16, 16, 'Above all, taking the shield of faith, wherewith ye shall be able to quench all the fiery darts of the wicked.', 'Ephesians 6:16']],
    k: ['The devil', 'King', 'The enemy of our souls. Moves one square in any direction.', ['1 Peter', 5, 8, 8, 'Be sober, be vigilant; because your adversary the devil, as a roaring lion, walketh about, seeking whom he may devour:', '1 Peter 5:8']],
    q: ['The old serpent', 'Queen', 'The deceiver from the garden. Moves any number of squares in any direction.', ['Genesis', 3, 1, 1, 'Now the serpent was more subtil than any beast of the field which the LORD God had made.', 'Genesis 3:1']],
    b: ['A false prophet', 'Bishop', 'He tells lies about God. Moves any number of squares diagonally.', ['Matthew', 7, 15, 15, 'Beware of false prophets, which come to you in sheep’s clothing, but inwardly they are ravening wolves.', 'Matthew 7:15']],
    n: ['The dragon', 'Knight', 'Fierce, but defeated. Jumps in an L shape, even over other pieces.', ['Revelation', 12, 9, 9, 'And the great dragon was cast out, that old serpent, called the Devil, and Satan, which deceiveth the whole world:', 'Revelation 12:9']],
    r: ['The tower of Babel', 'Rook', 'Built by pride, never finished. Moves any number of squares up, down or sideways.', ['Genesis', 11, 4, 4, 'And they said, Go to, let us build us a city and a tower, whose top may reach unto heaven; and let us make us a name.', 'Genesis 11:4']],
    p: ['A little demon', 'Pawn', 'A small temptation. Moves forward one square (two on its first move) and captures diagonally.', ['James', 4, 7, 7, 'Submit yourselves therefore to God. Resist the devil, and he will flee from you.', 'James 4:7']]
  };
  var WIN = ['James', 4, 7, 7, 'Submit yourselves therefore to God. Resist the devil, and he will flee from you.', 'James 4:7'];
  var LOSE = ['John', 16, 33, 33, 'In the world ye shall have tribulation: but be of good cheer; I have overcome the world.', 'John 16:33'];
  var DRAW = ['Ephesians', 6, 13, 13, 'Wherefore take unto you the whole armour of God, that ye may be able to withstand in the evil day, and having done all, to stand.', 'Ephesians 6:13'];
  var FILES = 'abcdefgh';

  /* ======================= the game ======================= */
  var SAVE = 'chess_save';
  function chess(box, level, alive) {
    var defs = sv('svg', { width: 0, height: 0, style: 'position:absolute;width:0;height:0', 'aria-hidden': 'true' }); defs.innerHTML = KC_DEFS; box.appendChild(defs);
    function art(p, size) { var s = sv('svg', { viewBox: '-48 -72 96 116', width: size, height: Math.round(size * 116 / 96), class: 'kc-art', 'aria-hidden': 'true' }); s.innerHTML = KC_ART[p](); return s; }
    var saved = K.store(SAVE);
    var setup = el('div', { class: 'kc-setup' }); box.appendChild(setup);
    var mode = 'cpu', joinCode = K.net ? K.net.pending('chess') : '';
    if (joinCode) mode = 'net';
    function drawSetup() {
      setup.innerHTML = '';
      setup.appendChild(el('div', { class: 'kc-hero' }, [
        el('div', { class: 'kc-hero__good' }, [art('K', 92), art('N', 70), art('P', 56)]),
        el('div', { class: 'kc-hero__words' }, [el('h5', { text: '♟️ Holy War (Chess)' }), el('p', { class: 'kt-note', text: 'Chess: the side of good against the side of evil. The Archangel Michael and the armies of heaven face the devil and his helpers. Trap the enemy king and win the battle!' })]),
        el('div', { class: 'kc-hero__evil' }, [art('p', 56), art('n', 70), art('k', 92)])]));
      var chips = el('div', { class: 'kg-levels', role: 'group', 'aria-label': 'Players' });
      var MODES = [['cpu', 'Me (good) vs computer (evil)'], ['two', '2 players, one phone']]; if (K.net && K.net.ok()) MODES.push(['net', '🌐 Play with a friend online']);
      MODES.forEach(function (m) { chips.appendChild(el('button', { class: 'kg-level', type: 'button', 'aria-pressed': mode === m[0] ? 'true' : 'false', text: m[1], onclick: function () { mode = m[0]; drawSetup(); } })); });
      setup.appendChild(chips);
      /* 7.20.0: with a friend online, by a game code */
      var ns = K.net && K.net.saved('chess');
      if (ns) setup.appendChild(el('div', { class: 'kt-row' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '↻ ' + T('Continue the online game') + ' ' + ns.code, onclick: function () { K.net.get(ns).then(function (d) { ns.v = d.v; setup.remove(); play('net', { hist: (d.state && d.state.hist) || [] }, ns, d); }).catch(function (e) { if (e && e.why === 'gone') K.net.forget('chess'); drawSetup(); setup.appendChild(el('p', { class: 'kg-net__msg', text: K.net.why(e) })); }); } })]));
      if (mode === 'net') {
        setup.appendChild(K.net.chooser('chess', function () { return K.net.create('chess', { hist: [] }).then(function (s) { setup.remove(); play('net', null, s, { seats: [1, 0] }); }); },
          function (c) { return K.net.join('chess', c).then(function (s) { setup.remove(); play('net', { hist: (s.data.state && s.data.state.hist) || [] }, s, s.data); }); }, joinCode));
        if (joinCode) { var jb = setup.querySelector('.kg-net__join button'); joinCode = ''; if (jb) setTimeout(function () { jb.click(); }, 50); }
        setup.appendChild(guide()); return;
      }
      var row = el('div', { class: 'kt-row' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: '▶ Start the battle', onclick: function () { K.store(SAVE, null); setup.remove(); play(mode, null); } })]);
      if (saved && saved.hist && saved.hist.length && saved.mode !== 'net') row.appendChild(el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '↻ Continue my last game', onclick: function () { setup.remove(); play(saved.mode, saved); } }));
      setup.appendChild(row);
      setup.appendChild(guide());
    }
    function guide() {
      var g = el('details', { class: 'kc-guide' }, [el('summary', { text: '📖 Meet the pieces and how they move' })]);
      var grid = el('div', { class: 'kc-guide__grid' });
      'KQBNRPkqbnrp'.split('').forEach(function (p) {
        var n = NAMES[p];
        grid.appendChild(el('div', { class: 'kc-gp kc-gp--' + (sideOf(p) === 'w' ? 'good' : 'evil') }, [art(p, 64), el('div', { class: 'kc-gp__t' }, [el('strong', { text: n[0] }), el('small', { text: n[1] }), el('span', { text: n[2] }), verseBox(n[3])])]));
      });
      g.appendChild(grid); return g;
    }
    drawSetup();

    function play(mode, restore, sess, net0) {
      var cpu = mode === 'cpu', netm = mode === 'net' && !!sess, mySide = netm ? (sess.seat === 0 ? 'w' : 'b') : 'w', flip = netm && mySide === 'b', friendIn = !netm || !!(net0 && net0.seats && net0.seats[1]);
      var st = startState(), hist = [], keys = {}, over = null, sel = -1, moves = [], lastMove = null, captured = { w: [], b: [] };
      function remember() { var k = keyOf(st); keys[k] = (keys[k] || 0) + 1; }
      if (restore) { restore.hist.forEach(function (h) { var m = legal(st).filter(function (x) { return x.f === h[0] && x.t === h[1] && (!h[2] || x.promo === h[2]); })[0]; if (m) { if (m.cap) captured[sideOf(m.p)].push(m.cap); hist.push({ st: st, m: m }); st = apply(st, m); lastMove = m; } }); }
      Object.keys(keys).forEach(function (k) { delete keys[k]; });
      hist.forEach(function (h) { var k = keyOf(h.st); keys[k] = (keys[k] || 0) + 1; }); remember();

      var wrap = el('div', { class: 'kc-game' }), view = el('div', { class: 'kc-view' });
      var svg = sv('svg', { viewBox: '0 0 1000 1000', class: 'kc-board', role: 'img', 'aria-label': 'Chess board' });
      var X0 = 80, SQ = 105;
      var bg = '<defs><linearGradient id="kc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b0d26"/><stop offset=".42" stop-color="#4a2048"/><stop offset=".58" stop-color="#d8b46a"/><stop offset="1" stop-color="#fff3cf"/></linearGradient>' +
        '<linearGradient id="kc-frame" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5a3a1a"/><stop offset=".5" stop-color="#c9952e"/><stop offset="1" stop-color="#ffe9a3"/></linearGradient>' +
        '<pattern id="kc-wood" width="105" height="105" patternUnits="userSpaceOnUse"><path d="M0 20 Q52 12 105 22 M0 58 Q52 50 105 60 M0 90 Q52 84 105 94" stroke="rgba(60,30,10,.12)" stroke-width="3" fill="none"/></pattern>' +
        '<radialGradient id="kc-danger"><stop offset=".35" stop-color="#ff2d1a" stop-opacity=".85"/><stop offset=".7" stop-color="#ff6a00" stop-opacity=".4"/><stop offset="1" stop-color="#ff2d1a" stop-opacity="0"/></radialGradient>' +
        '<radialGradient id="kc-check"><stop offset="0" stop-color="#ff3b30" stop-opacity=".85"/><stop offset="1" stop-color="#ff3b30" stop-opacity="0"/></radialGradient></defs>';
      bg += '<rect width="1000" height="1000" rx="34" fill="url(#kc-sky)"/>';
      for (var e = 0; e < 26; e++) bg += '<circle cx="' + ((e * 173) % 1000) + '" cy="' + (8 + (e * 67) % 60) + '" r="' + (1 + e % 3) + '" fill="#ff7a3a" opacity=".55"/>';
      for (var s2 = 0; s2 < 18; s2++) bg += '<circle cx="' + ((s2 * 211 + 40) % 1000) + '" cy="' + (940 + (s2 * 37) % 55) + '" r="' + (1.5 + s2 % 2) + '" fill="#fff" opacity=".8"/>';
      bg += '<rect x="' + (X0 - 14) + '" y="' + (X0 - 14) + '" width="' + (SQ * 8 + 28) + '" height="' + (SQ * 8 + 28) + '" rx="14" fill="url(#kc-frame)" stroke="#3a2210" stroke-width="3"/>';
      for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) { var light = (r + c) % 2 === 0; bg += '<rect x="' + (X0 + c * SQ) + '" y="' + (X0 + r * SQ) + '" width="' + SQ + '" height="' + SQ + '" fill="' + (light ? '#f2e4c2' : '#8a643c') + '"/>'; }
      bg += '<rect x="' + X0 + '" y="' + X0 + '" width="' + SQ * 8 + '" height="' + SQ * 8 + '" fill="url(#kc-wood)"/>';
      for (var f = 0; f < 8; f++) { bg += '<text x="' + (X0 + f * SQ + SQ / 2) + '" y="' + (X0 + SQ * 8 + 44) + '" class="kc-coord" text-anchor="middle">' + FILES[flip ? 7 - f : f] + '</text><text x="' + (X0 - 38) + '" y="' + (X0 + f * SQ + SQ / 2 + 9) + '" class="kc-coord kc-coord--rank" text-anchor="middle">' + (flip ? f + 1 : 8 - f) + '</text>'; }
      /* 7.20.0: online, the side of evil sees the board from its own side */
      var bTop = flip ? ['good', 'The side of good'] : ['evil', 'The side of evil'], bBot = flip ? ['evil', 'The side of evil'] : ['good', 'The side of good'];
      bg += '<text x="500" y="44" class="kc-banner kc-banner--' + bTop[0] + '" text-anchor="middle">' + esc(T(bTop[1])) + '</text><text x="500" y="984" class="kc-banner kc-banner--' + bBot[0] + '" text-anchor="middle">' + esc(T(bBot[1])) + '</text>';
      svg.innerHTML = bg;
      var hiG = sv('g', {}), pcG = sv('g', { class: 'kc-pieces' }), mvG = sv('g', {});
      svg.appendChild(hiG); svg.appendChild(pcG); svg.appendChild(mvG);
      view.appendChild(svg);
      var card = el('div', { class: 'kc-card', hidden: 'hidden' }); view.appendChild(card);

      /* side panel */
      var side = el('div', { class: 'kc-side' });
      var pGood = el('div', { class: 'kc-pl kc-pl--good' }), pEvil = el('div', { class: 'kc-pl kc-pl--evil' }), status = el('p', { class: 'kc-status', 'aria-live': 'polite' });
      var undoBtn = el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '↶ Undo', onclick: undo });
      var hintBtn = level !== 'hard' ? el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: '💡 Hint', onclick: hint }) : null;
      var newBtn = el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: netm ? '🚪 ' + T('Leave this game') : '🔄 New battle', onclick: function () { if (netm) K.net.forget('chess'); K.store(SAVE, null); K.start(); } });
      if (netm) undoBtn.hidden = true;
      var netBox = el('div', { class: 'kc-netbox' });
      if (netm) side.appendChild(netBox);
      if (flip) { side.appendChild(pGood); side.appendChild(status); side.appendChild(pEvil); } else { side.appendChild(pEvil); side.appendChild(status); side.appendChild(pGood); }
      side.appendChild(el('div', { class: 'kt-row kc-tools' }, [undoBtn, hintBtn, newBtn, window.KJTSound && window.KJTSound.button ? window.KJTSound.button() : null])); /* 7.9.31: sounds on/off */
      side.appendChild(guide());
      wrap.appendChild(view); wrap.appendChild(side); box.appendChild(wrap);
      try { box.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (x) {}

      function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
      function vi(i) { return flip ? 63 - i : i; }
      function xy(i) { i = vi(i); return [X0 + (i & 7) * SQ + SQ / 2, X0 + (i >> 3) * SQ + SQ / 2]; }
      var nodesBy = {};
      function drawPieces(anim) {
        var old = nodesBy, used = {}, next = {};
        function inner(g, p) { g.innerHTML = '<g class="kc-p__in" transform="translate(0 -8) scale(1.14)">' + KC_ART[p]() + '</g>'; g.dataset.p = p; }
        /* 1) pieces that did not move; 2) the piece that moved slides; 3) others (the castling rook) slide from where they were */
        st.b.forEach(function (p, i) { if (p && old[i] && old[i].dataset.p === p && !(anim && anim.f === i)) { next[i] = old[i]; used[i] = 1; } });
        if (anim && st.b[anim.t] && old[anim.f] && !next[anim.t]) { next[anim.t] = old[anim.f]; used[anim.f] = 1; }
        st.b.forEach(function (p, i) {
          if (!p || next[i]) return;
          var best = null, bd = 99; Object.keys(old).forEach(function (k) { if (used[k] || old[k].dataset.p !== p) return; var d = Math.abs((k >> 3) - (i >> 3)) + Math.abs((k & 7) - (i & 7)); if (d < bd) { bd = d; best = k; } });
          if (best !== null) { next[i] = old[best]; used[best] = 1; return; }
          var g = sv('g', { class: 'kc-p kc-p--' + (sideOf(p) === 'w' ? 'good' : 'evil') }); inner(g, p); var a0 = xy(i); g.style.transform = 'translate(' + a0[0] + 'px,' + a0[1] + 'px)'; pcG.appendChild(g); next[i] = g;
        });
        Object.keys(old).forEach(function (k) { if (used[k]) return; var g = old[k]; g.classList.add('kc-p--gone'); setTimeout(function () { g.remove(); }, 450); });
        Object.keys(next).forEach(function (i) { var g = next[i], p = st.b[i]; if (g.dataset.p !== p) inner(g, p); var a = xy(+i); g.style.transform = 'translate(' + a[0] + 'px,' + a[1] + 'px)'; });
        nodesBy = next;
        /* lower rows in front; the piece that moved on top while it slides */
        Object.keys(next).sort(function (a, b) { return a - b; }).forEach(function (k) { pcG.appendChild(next[k]); });
        if (anim && next[anim.t]) pcG.appendChild(next[anim.t]);
      }
      function drawMarks() {
        var h = '';
        if (lastMove) [lastMove.f, lastMove.t].forEach(function (i) { i = vi(i); h += '<rect x="' + (X0 + (i & 7) * SQ) + '" y="' + (X0 + (i >> 3) * SQ) + '" width="' + SQ + '" height="' + SQ + '" fill="#ffe066" opacity=".42"/>'; });
        if (inCheck(st)) { var k = kingAt(st.b, st.turn), c0 = xy(k); h += '<circle cx="' + c0[0] + '" cy="' + c0[1] + '" r="58" fill="url(#kc-check)"/>'; }
        /* 7.9.32: Easy and Medium: on your turn, your pieces that can be taken glow with a slow red pulse */
        if ((cpu || netm) && level !== 'hard' && !over && !busy && st.turn === mySide) {
          for (var di = 0; di < 64; di++) { var dp = st.b[di]; if (!dp || sideOf(dp) !== mySide || dp === 'K' || dp === 'k') continue; if (attacked(st.b, di, mySide === 'w' ? 'b' : 'w')) { var dc = xy(di); h += '<circle class="kc-danger" cx="' + dc[0] + '" cy="' + dc[1] + '" r="62" fill="url(#kc-danger)"/>'; } }
        }
        if (sel >= 0) { var sv0 = vi(sel); h += '<rect x="' + (X0 + (sv0 & 7) * SQ + 3) + '" y="' + (X0 + (sv0 >> 3) * SQ + 3) + '" width="' + (SQ - 6) + '" height="' + (SQ - 6) + '" rx="10" fill="none" stroke="#f3c548" stroke-width="6"/>'; }
        hiG.innerHTML = h;
        var m2 = ''; moves.forEach(function (m) { var c1 = xy(m.t); m2 += m.cap ? '<circle cx="' + c1[0] + '" cy="' + c1[1] + '" r="47" fill="none" stroke="#0b7778" stroke-width="7" opacity=".75"/>' : '<circle cx="' + c1[0] + '" cy="' + c1[1] + '" r="15" fill="#0b7778" opacity=".6"/>'; });
        mvG.innerHTML = m2;
      }
      function tray(list) { var t = el('span', { class: 'kc-tray' }); list.forEach(function (p) { t.appendChild(art(p, 24)); }); return t; }
      function drawSide() {
        var who = function (s) { if (netm) return s === mySide ? T('You') : T('Your friend'); return s === 'w' ? (cpu ? 'You' : 'Player 1') : (cpu ? 'Computer' : 'Player 2'); };
        pGood.innerHTML = ''; pEvil.innerHTML = '';
        pGood.appendChild(art('K', 40)); pGood.appendChild(el('span', { class: 'kc-pl__t' }, [el('strong', { text: 'The side of good' }), el('small', { text: who('w') }), tray(captured.w)]));
        pEvil.appendChild(art('k', 40)); pEvil.appendChild(el('span', { class: 'kc-pl__t' }, [el('strong', { text: 'The side of evil' }), el('small', { text: who('b') }), tray(captured.b)]));
        pGood.classList.toggle('on', !over && st.turn === 'w'); pEvil.classList.toggle('on', !over && st.turn === 'b');
        undoBtn.disabled = !hist.length || busy || Date.now() > undoUntil; if (hintBtn) hintBtn.disabled = !!over || busy || (cpu && st.turn !== 'w') || (netm && st.turn !== mySide);
      }
      function say(t) { status.textContent = t; }
      function turnText() {
        if (over) return;
        var chk = inCheck(st);
        if (netm) { say(!friendIn ? T('Waiting for your friend to join…') : st.turn === mySide ? (chk ? T('Check! Protect your king.') : T('Your move.')) : T('Waiting for your friend’s move…')); return; }
        if (cpu) say(st.turn === 'w' ? (chk ? 'Check! Protect your king, the Archangel Michael.' : 'Your move.') : 'The enemy is thinking…');
        else say(st.turn === 'w' ? (chk ? 'Check! The side of good must protect its king.' : 'The side of good: your move.') : (chk ? 'Check! The side of evil must protect its king.' : 'The side of evil: your move.'));
      }
      var busy = false;
      function hlist() { return hist.map(function (h) { return [h.m.f, h.m.t, h.m.promo || '']; }); }
      function save() { if (netm) return; K.store(SAVE, over ? null : { mode: mode, hist: hlist() }); }
      function refresh(anim) { drawPieces(anim); drawMarks(); drawSide(); turnText(); }
      refresh();

      /* tapping the board */
      function squareAt(ev) { var pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY; var q = pt.matrixTransform(svg.getScreenCTM().inverse()), c = Math.floor((q.x - X0) / SQ), r = Math.floor((q.y - X0) / SQ); return on(r, c) ? vi(r * 8 + c) : -1; }
      svg.addEventListener('click', function (ev) {
        if (over || busy || (cpu && st.turn !== 'w') || (netm && (st.turn !== mySide || !friendIn))) return;
        var i = squareAt(ev); if (i < 0) return;
        var hit = moves.filter(function (m) { return m.t === i; });
        if (sel >= 0 && hit.length) { if (hit.length > 1) return choosePromo(hit); return doMove(hit[0]); }
        if (st.b[i] && sideOf(st.b[i]) === st.turn) { sel = i; moves = legal(st).filter(function (m) { return m.f === i; }); K.sound('tap'); }
        else { sel = -1; moves = []; }
        drawMarks();
      });
      function choosePromo(list) {
        card.hidden = false; card.innerHTML = '';
        var row = el('div', { class: 'kc-promo' });
        list.forEach(function (m) { row.appendChild(el('button', { class: 'kc-promo__b', type: 'button', onclick: function () { card.hidden = true; doMove(m); } }, [art(m.promo, 56), el('small', { text: NAMES[m.promo][0] })])); });
        card.appendChild(el('div', { class: 'kc-card__in' }, [el('h5', { text: 'Your soldier reached the end! Choose what it becomes:' }), row]));
      }
      function doMove(m, remote) {
        sel = -1; moves = [];
        hist.push({ st: st, m: m }); if (m.cap) captured[sideOf(m.p)].push(m.cap);
        st = apply(st, m); lastMove = m; remember(); undoOpen();
        refresh({ f: m.f, t: m.t, p: m.p });
        K.sound(m.cap ? 'battle' : m.castle ? 'trumpet' : 'chessmove'); /* 7.9.30 */
        if (netm && !remote) send();
        var end = gameOver(); if (end) return finish(end);
        if (inCheck(st)) K.sound('check'); /* 7.9.32 */
        save();
        if (netm && remote && st.turn === mySide) K.net.nudge();
        if (cpu && st.turn === 'b') thinkSoon();
      }
      function thinkSoon() {
        busy = true; drawSide(); turnText();
        setTimeout(function () {
          if (!alive()) return;
          var m = bestMove(st, level); busy = false;
          if (m) setTimeout(function () { if (alive()) doMove(m); }, 120);
        }, 520);
      }
      function gameOver() {
        var ms = legal(st);
        if (!ms.length) return inCheck(st) ? (st.turn === 'w' ? 'evil' : 'good') : 'stalemate';
        if (keys[keyOf(st)] >= 3) return 'repeat';
        if (st.half >= 100) return 'fifty';
        if (lowMaterial(st.b)) return 'material';
        return null;
      }
      function finish(end) {
        over = end; save(); drawSide();
        var good = end === 'good', evil = end === 'evil', title, text, v;
        if (good) { title = 'Victory! The devil is defeated.'; text = cpu ? 'You trapped the devil’s king. Resist the devil, and he will flee from you!' : 'The side of good wins the battle!'; v = WIN; K.sound('checkmate'); setTimeout(function () { if (alive()) K.sound('fanfare'); }, 1500); if (cpu) K.award('chess', level); }
        else if (evil) { title = cpu ? 'The enemy won this battle, but not the war!' : 'The side of evil wins this battle.'; text = 'Christ has already overcome the world. Put on the whole armour of God and try again!'; v = LOSE; K.sound('checkmate'); setTimeout(function () { if (alive()) K.sound('sad'); }, 1700); }
        else { title = 'A draw!'; text = end === 'stalemate' ? 'Stalemate: no one can move, and no one is in check.' : end === 'repeat' ? 'The same position came three times.' : end === 'fifty' ? 'Fifty moves without a capture or a soldier moving.' : 'There are not enough pieces left to win.'; v = DRAW; K.sound('bell'); }
        say(title);
        card.hidden = false; card.innerHTML = '';
        card.appendChild(el('div', { class: 'kc-card__in kc-card--' + (good ? 'win' : evil ? 'lose' : 'draw') }, [el('div', { class: 'kc-card__art' }, [art(good ? 'K' : evil ? 'k' : 'P', 86)]), el('h5', { text: title }), el('p', { text: text }), verseBox(v),
          el('div', { class: 'kt-row', style: 'justify-content:center' }, [el('button', { class: 'kt-btn kt-btn--yellow', type: 'button', text: 'Play again →', onclick: function () { K.store(SAVE, null); K.start(); } }), el('button', { class: 'kt-btn kt-btn--ghost', type: 'button', text: 'See the board', onclick: function () { card.hidden = true; } })])]));
      }
      /* Undo is allowed only for 5 seconds after a move (against the computer: after its reply) */
      var undoUntil = 0, undoTimer = null;
      function undoOpen() {
        undoUntil = Date.now() + 5000; clearTimeout(undoTimer);
        undoBtn.classList.remove('kc-undo--live'); void undoBtn.offsetWidth; undoBtn.classList.add('kc-undo--live');
        undoTimer = setTimeout(function () { undoUntil = 0; undoBtn.classList.remove('kc-undo--live'); drawSide(); }, 5000);
      }
      function undoShut() { undoUntil = 0; clearTimeout(undoTimer); undoBtn.classList.remove('kc-undo--live'); }
      function undo() {
        if (!hist.length || busy || Date.now() > undoUntil) return;
        undoShut();
        var n = cpu ? (st.turn === 'w' && hist.length >= 2 ? 2 : 1) : 1;
        if (over && cpu && hist.length && sideOf(hist[hist.length - 1].m.p) === 'w') n = 1;
        for (var k = 0; k < n && hist.length; k++) { var k0 = keyOf(st); keys[k0]--; var h = hist.pop(); if (h.m.cap) captured[sideOf(h.m.p)].pop(); st = h.st; }
        lastMove = hist.length ? hist[hist.length - 1].m : null; over = null; card.hidden = true; sel = -1; moves = [];
        save(); refresh(); K.sound('tap');
        if (cpu && st.turn === 'b') thinkSoon();
      }
      function hint() {
        if (over || busy) return;
        var m = bestMove(st, 'medium'); if (!m) return;
        sel = m.f; moves = [m]; drawMarks(); K.sound('good');
        say('Try moving this piece to the glowing square.');
      }
      /* 7.20.0: online: send my moves; take my friend's (each one is checked against the rules) */
      function send() {
        K.net.put(sess, { hist: hlist() }).catch(function (e) {
          if (e && e.why === 'late' && e.data) { sess.v = e.data.v; replay((e.data.state && e.data.state.hist) || []); }
          else say(K.net.why(e));
        });
      }
      function same(a, b) { return a.length >= b.length && b.every(function (h, k) { return a[k][0] === h[0] && a[k][1] === h[1] && (a[k][2] || '') === (h[2] || ''); }); }
      function replay(rh) {
        var mine = hlist();
        if (same(rh, mine)) { for (var k = mine.length; k < rh.length; k++) { var m = legal(st).filter(function (x) { return x.f === rh[k][0] && x.t === rh[k][1] && (!rh[k][2] || x.promo === rh[k][2]); })[0]; if (!m || over) break; doMove(m, true); } return; }
        st = startState(); hist = []; captured = { w: [], b: [] }; over = null; lastMove = null; Object.keys(keys).forEach(function (k) { delete keys[k]; }); remember();
        for (var j = 0; j < rh.length; j++) { var m2 = legal(st).filter(function (x) { return x.f === rh[j][0] && x.t === rh[j][1] && (!rh[j][2] || x.promo === rh[j][2]); })[0]; if (!m2) break; if (m2.cap) captured[sideOf(m2.p)].push(m2.cap); hist.push({ st: st, m: m2 }); st = apply(st, m2); lastMove = m2; remember(); }
        card.hidden = true; refresh(); var e2 = gameOver(); if (e2) finish(e2);
      }
      function drawNet() {
        netBox.innerHTML = '';
        if (!friendIn && sess.seat === 0) netBox.appendChild(K.net.card('chess', sess.code, true));
        else netBox.appendChild(el('p', { class: 'kg-net__small', text: T('Online game') + ' · ' + sess.code.replace(/(...)(...)/, '$1 $2') + ' · ' + (mySide === 'w' ? T('You are the side of good') : T('You are the side of evil')) }));
      }
      if (netm) {
        drawNet();
        K.net.watch(sess, function (d, unchanged) {
          if (!alive()) return;
          if (!d) { say(T('This online game has ended.')); K.net.forget('chess'); return; }
          var was = friendIn; friendIn = !!(d.seats && d.seats[1]);
          if (friendIn !== was) { drawNet(); turnText(); if (friendIn && sess.seat === 0) K.sound('bell'); }
          if (unchanged) return;
          replay((d.state && d.state.hist) || []);
        });
      }
      if (cpu && st.turn === 'b' && !gameOver()) thinkSoon();
      var end0 = gameOver(); if (end0) finish(end0);
    }
  }

  window.KJTGames.register({ id: 'chess', cat: 'family', icon: '♟️', name: 'Holy War (Chess)', blurb: 'Chess: the side of good against the side of evil', run: chess });
})();
