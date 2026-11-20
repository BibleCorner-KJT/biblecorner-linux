"""2.11 · Bible Study Journey: My Reading Journey, as in the Android app and on the website.

"Mark as read" under every chapter (or automatically), progress for every book (grouped the Orthodox way, with the
Anagignoskomena), reading plans from the Church's life (the Psalter in 20 kathismata, Pascha to Pentecost, Great Lent,
the Gospels in 40 days, the New Testament in 90 days, the Bible in a year), milestones with verses, reading days and
streaks, the prayer before the Gospel and a word from the Fathers.

Kept on this computer (journey.json); signed in, it is the same record as on the website and the phone (kjtb_reading),
merged so that nothing read is ever lost."""
import datetime, json, os, threading, time
from gi.repository import Gtk, Adw, GLib, Pango
from .core import STORE, SET, NET, CONF, lang, book_name, run_bg, canon
from .i18n import _

HERE = os.path.dirname(os.path.abspath(__file__))
try:
    VERSES = json.load(open(os.path.join(HERE, 'chapters.json')))
except Exception:
    VERSES = {}
try:
    _J = json.load(open(os.path.join(HERE, 'journey-i18n.json'), encoding='utf-8'))
except Exception:
    _J = {}


def T(s):
    """the words of the Journey: the app's own translations, then the website's"""
    t = _(s)
    if t != s:
        return t
    return (_J.get(lang()) or {}).get(s) or s


GROUPS = [('law', 'The Law · Books of Moses', 'ot'), ('history', 'Historical Books', 'ot'), ('wisdom', 'Wisdom and Poetry', 'ot'), ('prophets', 'The Prophets', 'ot'),
          ('anag', 'Anagignoskomena · “worthy to be read”', 'anag'), ('appendix', 'Appendix of the Slavonic Bible (not counted)', 'appendix'),
          ('gospels', 'The Holy Gospels', 'nt'), ('acts', 'The Acts of the Apostles', 'nt'), ('paul', 'The Epistles of St Paul', 'nt'),
          ('catholic', 'The Catholic Epistles', 'nt'), ('revelation', 'The Revelation of St John', 'nt')]
TESTAMENT = {g[0]: g[2] for g in GROUPS}
CODES = {
    'law': ['GEN', 'EXO', 'LEV', 'NUM', 'DEU'],
    'history': ['JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST'],
    'wisdom': ['JOB', 'PSA', 'PRO', 'ECC', 'SNG'],
    'prophets': ['ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'],
    'anag': ['1ES', 'TOB', 'JDT', 'ESG', 'WIS', 'SIR', 'BAR', 'PRA', 'SUS', 'BEL', 'PRM', '1MA', '2MA'],
    'appendix': ['2ES'],
    'gospels': ['MAT', 'MRK', 'LUK', 'JHN'], 'acts': ['ACT'],
    'paul': ['ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB'],
    'catholic': ['JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD'], 'revelation': ['REV'],
}
EXTRA = {'1ES': '1 Esdras', '2ES': '2 Esdras', 'TOB': 'Tobit', 'JDT': 'Judith', 'ESG': 'Esther (Greek)', 'WIS': 'Wisdom of Solomon', 'SIR': 'Wisdom of Sirach',
         'BAR': 'Baruch', 'PRA': 'Prayer of Azariah', 'SUS': 'Susanna', 'BEL': 'Bel and the Dragon', 'PRM': 'Prayer of Manasseh', '1MA': '1 Maccabees', '2MA': '2 Maccabees'}
BOOKS = []   # [code, chapters, group]
for g, codes in CODES.items():
    for c in codes:
        n = len(VERSES.get(c) or [])
        if n:
            BOOKS.append((c, n, g))
BY = {b[0]: b for b in BOOKS}


def bname(code):
    n = book_name(code)
    return EXTRA.get(code, code) if (not n or n == code) else n


def label(k):
    c, ch = k.split('.')
    return '%s %s' % (bname(c), ch)


def chapters(codes):
    out = []
    for c in codes:
        if c in BY:
            out += ['%s.%d' % (c, i) for i in range(1, BY[c][1] + 1)]
    return out


def today():
    return (datetime.date.today() - datetime.date(1970, 1, 1)).days


def date_of(d):
    return datetime.date(1970, 1, 1) + datetime.timedelta(days=int(d))


def fmt(d):
    x = date_of(d)
    return '%d %s %d' % (x.day, T(x.strftime('%b')), x.year)


def blank():
    return {'v': 1, 'read': {}, 'days': {}, 'earned': {}, 'church': {}, 'parts': {}, 'plan': None,
            'settings': {'anag': True, 'auto': False, 'streaks': True, 'prayer': False, 'at': 0}}


def union(lst):
    a = sorted([[int(x[0]), min(int(x[1]), 999)] for x in (lst or []) if isinstance(x, (list, tuple)) and len(x) > 1 and int(x[0]) > 0 and int(x[1]) >= int(x[0])])
    o = []
    for x in a:
        if o and x[0] <= o[-1][1] + 1:
            o[-1][1] = max(o[-1][1], x[1])
        else:
            o.append(x)
    return o[:60]


def merge(a, b):
    """two records together: nothing read is ever lost (as on the website)"""
    a = a or blank(); b = b or blank()
    o = {'v': 1, 'read': {}, 'days': {}, 'earned': {}, 'church': {}, 'parts': {}}
    for x in (a, b):
        for k, v in (x.get('parts') or {}).items():
            o['parts'][k] = union((o['parts'].get(k) or []) + list(v or []))
        for d, it in (x.get('church') or {}).items():
            o['church'].setdefault(d, {}).update(it or {})
        for k, v in (x.get('read') or {}).items():
            try:
                v = [int(v[0]), int(v[1]), int(v[2] if len(v) > 2 else 1)]
            except Exception:
                continue
            c = o['read'].get(k)
            o['read'][k] = [min(c[0], v[0]), max(c[1], v[1]), max(c[2], v[2] or 1)] if c else [v[0], v[1], v[2] or 1]
        for d, n in (x.get('days') or {}).items():
            o['days'][str(d)] = max(int(o['days'].get(str(d), 0)), int(n or 0))
        for e, d in (x.get('earned') or {}).items():
            o['earned'][e] = min(o['earned'][e], int(d)) if e in o['earned'] else int(d)
    for k in ('plan', 'settings'):
        pa, pb = a.get(k), b.get(k)
        o[k] = (pb if pb is not None else pa) if ((pb or {}).get('at') or 0) >= ((pa or {}).get('at') or 0) else pa
    o['settings'] = dict(blank()['settings'], **(o.get('settings') or {}))
    for k in list(o['parts']):
        if k in o['read'] or not o['parts'][k]:
            del o['parts'][k]
    return o


def vcount(k):
    c, ch = k.split('.')
    v = VERSES.get(c) or []
    try:
        return int(v[int(ch) - 1])
    except Exception:
        return 0


def promote(o, day):
    for k in list(o.get('parts') or {}):
        n, p = vcount(k), o['parts'][k]
        if not n:
            continue
        if len(p) == 1 and p[0][0] <= 1 and p[0][1] >= n:
            o['read'].setdefault(k, [day, day, 1]); del o['parts'][k]
        elif k in o['read']:
            del o['parts'][k]
    return o


def pascha(y):
    a, b, c = y % 4, y % 7, y % 19
    d = (19 * c + 15) % 30; e = (2 * a + 4 * b - d + 34) % 7
    m = (d + e + 114) // 31; day = (d + e + 114) % 31 + 1
    return (datetime.date(y, m, day) + datetime.timedelta(days=13) - datetime.date(1970, 1, 1)).days


def season():
    t = today(); P = pascha(date_of(t).year)
    if P - 48 <= t <= P - 9:
        return ('lent', '🕊️ ' + T('Great Lent'), T('A blessed Lent! During the Fast the Church reads Genesis, Isaiah and Proverbs on weekdays.'), 'lent')
    if P - 8 <= t < P:
        return ('holyweek', '✝️ ' + T('Holy Week'), T('Walk with Christ to His Passion: read the last chapters of the Gospels.'), 'gospels40')
    if P <= t <= P + 39:
        return ('pascha', '☀️ ' + T('Christ is risen! Truly He is risen!'), T('From Pascha to Pentecost the Church reads the Acts of the Apostles and the Gospel of St John.'), 'pascha')
    if P + 39 < t <= P + 49:
        return ('pentecost', '🔥 ' + T('Towards Pentecost'), T('O Heavenly King, the Comforter, the Spirit of Truth, come and abide in us.'), 'pascha')
    return None


KATHISMATA = [(1, 8), (9, 17), (18, 24), (25, 32), (33, 37), (38, 46), (47, 55), (56, 64), (65, 70), (71, 77), (78, 85), (86, 91), (92, 101), (102, 105),
              (106, 109), (110, 118), (119, 119), (120, 134), (135, 143), (144, 150)]
NT = [c for g in ('gospels', 'acts', 'paul', 'catholic', 'revelation') for c in CODES[g] if c in BY]


def ot(S):
    return [c for g in ['law', 'history', 'wisdom', 'prophets'] + (['anag'] if S['settings'].get('anag') else []) for c in CODES[g] if c in BY]


PLANS = [
    ('psalter', '📜', 'The Psalter in 20 Kathismata', 20, 'The whole Psalter as the Church divides it for prayer: one kathisma a day. Monks read it every week; begin with one kathisma a day.'),
    ('pascha', '☀️', 'From Pascha to Pentecost: Acts and St John', 50, 'The Acts of the Apostles and the Gospel of St John, as read in church between Pascha and Pentecost. One chapter a day.'),
    ('lent', '🕊️', 'Great Lent: Genesis, Isaiah and Proverbs', 40, 'The Old Testament books read through the Lenten weekdays: Genesis and Proverbs at Vespers, Isaiah at the Sixth Hour.'),
    ('gospels40', '✝️', 'The Four Holy Gospels in 40 days', 40, 'Matthew, Mark, Luke and John: about two chapters a day. Beautiful for a fasting season.'),
    ('nt90', '📖', 'The New Testament in 90 days', 90, 'The whole New Testament, about three chapters a day.'),
    ('year', '📚', 'The Holy Bible in a Year', 365, 'The Old Testament and the New Testament side by side each day. Include the Anagignoskomena in Settings if you wish.'),
]
PLAN = {p[0]: p for p in PLANS}


def portions(pid, S):
    days = PLAN[pid][3]
    if pid == 'psalter':
        return [['PSA.%d' % i for i in range(a, b + 1)] for a, b in KATHISMATA]
    if pid == 'pascha':
        allc = chapters(['ACT']) + chapters(['JHN']); per = -(-len(allc) // days)
        return [allc[d * per:(d + 1) * per] for d in range(days)]
    tracks = {'lent': [chapters(['GEN']), chapters(['ISA']), chapters(['PRO'])], 'gospels40': [chapters(['MAT', 'MRK', 'LUK', 'JHN'])],
              'nt90': [chapters(NT)], 'year': [chapters(ot(S)), chapters(NT)]}[pid]
    out = []
    for i in range(days):
        day = []
        for t in tracks:
            day += t[i * len(t) // days:(i + 1) * len(t) // days]
        out.append(day)
    return out


MILESTONES = [
    ('first', '🕯️', 'In the beginning', 'Read your first chapter', lambda s, J: s['chapters'] >= 1, 'Thy word is a lamp unto my feet, and a light unto my path.', 'Psalm 119:105'),
    ('ch100', '📜', 'One hundred chapters', 'Read 100 chapters', lambda s, J: s['chapters'] >= 100, 'But his delight is in the law of the LORD; and in his law doth he meditate day and night.', 'Psalm 1:2'),
    ('ch500', '🍯', 'Sweeter than honey', 'Read 500 chapters', lambda s, J: s['chapters'] >= 500, 'How sweet are thy words unto my taste! yea, sweeter than honey to my mouth!', 'Psalm 119:103'),
    ('ch1000', '💎', 'Hidden in the heart', 'Read 1,000 chapters', lambda s, J: s['chapters'] >= 1000, 'Thy word have I hid in mine heart, that I might not sin against thee.', 'Psalm 119:11'),
    ('law', '🪨', 'The Books of Moses', 'Read the whole Law, Genesis to Deuteronomy', lambda s, J: full(s, 'law'), 'The law of the LORD is perfect, converting the soul.', 'Psalm 19:7'),
    ('history', '🏰', 'The Historical Books', 'Read Joshua to Esther', lambda s, J: full(s, 'history'), 'For whatsoever things were written aforetime were written for our learning.', 'Romans 15:4'),
    ('psalter', '🎶', 'The Psalter', 'Read all 150 Psalms', lambda s, J: s['books'].get('PSA', 0) >= (BY['PSA'][1] if 'PSA' in BY else 150), 'Let every thing that hath breath praise the LORD.', 'Psalm 150:6'),
    ('wisdom', '🦉', 'The Books of Wisdom', 'Read Job, Psalms, Proverbs, Ecclesiastes and the Song', lambda s, J: full(s, 'wisdom'), 'The fear of the LORD is the beginning of wisdom.', 'Proverbs 9:10'),
    ('prophets', '🗣️', 'The Holy Prophets', 'Read all the Prophets, Isaiah to Malachi', lambda s, J: full(s, 'prophets'), 'Surely the Lord GOD will do nothing, but he revealeth his secret unto his servants the prophets.', 'Amos 3:7'),
    ('anag', '📗', 'Worthy to be read', 'Read the Anagignoskomena', lambda s, J: full(s, 'anag'), 'For she is the brightness of the everlasting light, the unspotted mirror of the power of God, and the image of his goodness.', 'Wisdom 7:26'),
    ('ot', '🌳', 'The Old Testament', 'Read the whole Old Testament', lambda s, J: s['ot'][1] > 0 and s['ot'][0] >= s['ot'][1], 'And beginning at Moses and all the prophets, he expounded unto them in all the scriptures the things concerning himself.', 'Luke 24:27'),
    ('gospels', '✝️', 'The Four Holy Gospels', 'Read Matthew, Mark, Luke and John', lambda s, J: full(s, 'gospels'), 'But these are written, that ye might believe that Jesus is the Christ, the Son of God.', 'John 20:31'),
    ('acts', '🔥', 'The Acts of the Apostles', 'Read the book of Acts', lambda s, J: full(s, 'acts'), 'But ye shall receive power, after that the Holy Ghost is come upon you.', 'Acts 1:8'),
    ('paul', '✉️', 'The Epistles of St Paul', 'Read Romans to Hebrews', lambda s, J: full(s, 'paul'), 'I have fought a good fight, I have finished my course, I have kept the faith.', '2 Timothy 4:7'),
    ('catholic', '🤝', 'The Catholic Epistles', 'Read James to Jude', lambda s, J: full(s, 'catholic'), 'Beloved, let us love one another: for love is of God.', '1 John 4:7'),
    ('revelation', '👑', 'The Revelation', 'Read the Revelation of St John', lambda s, J: full(s, 'revelation'), 'Even so, come, Lord Jesus.', 'Revelation 22:20'),
    ('nt', '📖', 'The New Testament', 'Read the whole New Testament', lambda s, J: s['nt'][1] > 0 and s['nt'][0] >= s['nt'][1], 'For the word of God is quick, and powerful, and sharper than any twoedged sword.', 'Hebrews 4:12'),
    ('bible', '☦️', 'The whole Holy Bible', 'Read every chapter of the Bible. Glory to God for all things!', lambda s, J: s['total'] > 0 and s['read'] >= s['total'], 'The grass withereth, the flower fadeth: but the word of our God shall stand for ever.', 'Isaiah 40:8'),
    ('streak7', '🌅', 'New every morning', 'Read on 7 days in a row', lambda s, J: s['best'] >= 7, 'His compassions fail not. They are new every morning.', 'Lamentations 3:22-23'),
    ('streak40', '🏔️', 'Forty days', 'Read on 40 days in a row, like the forty days of the Fast', lambda s, J: s['best'] >= 40, 'Man shall not live by bread alone, but by every word that proceedeth out of the mouth of God.', 'Matthew 4:4'),
    ('plan', '🏁', 'A plan completed', 'Finish a reading plan', lambda s, J: bool(J.S['earned'].get('plan')) or bool((J.plan_status() or {}).get('complete')), 'I press toward the mark for the prize of the high calling of God in Christ Jesus.', 'Philippians 3:14'),
]
FATHERS = [
    ('This is the cause of all evils, the not knowing the Scriptures.', 'St John Chrysostom, Homily 9 on Colossians'),
    ('Ignorance of the Scriptures is ignorance of Christ.', 'St Jerome, Commentary on Isaiah'),
    ('Who is able to understand, Lord, even one of your words? We lose more of it than we grasp, like those who drink from a living spring.', 'St Ephrem the Syrian, Commentary on the Diatessaron'),
    ('A psalm is the calm of souls, the bringer of peace.', 'St Basil the Great, Homily on Psalm 1'),
    ('The soul should be nourished with the word of God; above all, with reading the New Testament and the Psalter.', 'St Seraphim of Sarov, Spiritual Instructions (paraphrased)'),
    ('If an earthly king wrote you a letter, would you not read it with joy? The King of Heaven has written to you.', 'after St Tikhon of Zadonsk'),
]
PRAYER = ('Illumine our hearts, O Master who lovest mankind, with the pure light of Thy divine knowledge, and open the eyes of our mind to the understanding of '
          'Thy Gospel teachings. Implant in us also the fear of Thy blessed commandments, that trampling down all carnal desires, we may enter upon a spiritual '
          'manner of living, both thinking and doing all things that are well-pleasing unto Thee. For Thou art the illumination of our souls and bodies, O Christ '
          'our God, and unto Thee we ascribe glory, together with Thy Father, who is from everlasting, and Thine all-holy, good and life-creating Spirit, now and '
          'ever, and unto ages of ages. Amen.')


def full(s, g):
    x = s['groups'].get(g)
    return bool(x) and x[1] > 0 and x[0] >= x[1]


def pct(a, b):
    if not b:
        return 0
    v = a * 100 // b
    return '<1' if v == 0 and a > 0 else v


class Journey:
    """the reading record, kept here and on the account"""
    def __init__(self):
        self.path = os.path.join(CONF, 'journey.json')
        try:
            self.S = json.load(open(self.path))
        except Exception:
            self.S = None
        self.S = promote(merge(self.S, None), today())
        self.pending = bool(SET.get('journey_unsent'))
        self.listeners = []
        self.timer = 0
        self.note = ''

    def listen(self, fn):
        self.listeners.append(fn)

    def changed(self):
        for fn in list(self.listeners):
            try:
                fn()
            except Exception:
                pass

    def save(self, send=True):
        try:
            os.makedirs(os.path.dirname(self.path), exist_ok=True)
            tmp = self.path + '.tmp'
            with open(tmp, 'w') as f:
                json.dump(self.S, f)
            os.replace(tmp, self.path)
        except Exception:
            pass
        if send and self.user():
            self.pending = True; SET.set('journey_unsent', True)
            if self.timer:
                GLib.source_remove(self.timer)
            self.timer = GLib.timeout_add(1500, self._push)

    @staticmethod
    def user():
        return (STORE.kv('info') or {}).get('user')

    def _post(self, op, data=None):
        i = STORE.kv('info') or {}
        if not i.get('nonce_study'):
            return None
        post = {'op': op, 'nonce': i['nonce_study']}
        if data is not None:
            post['data'] = json.dumps(data)
        return NET.ajax('kjtb_reading', post)

    def _push(self):
        self.timer = 0
        snap = json.loads(json.dumps(self.S))
        def work():
            return self._post('save', snap)
        def done(r):
            if isinstance(r, dict) and r.get('success'):
                self.pending = False; SET.set('journey_unsent', False)
                d = (r.get('data') or {}).get('data')
                if d:
                    self.S = promote(merge(self.S, d), today()); self.save(send=False); self.changed()
        run_bg(work, done)
        return False

    # 2.28: each account keeps its own reading journey on this computer (switching accounts swaps them; signing in
    # takes along what was read before signing in; signing out keeps the account's record for the next time)
    def _file(self, uid):
        return os.path.join(CONF, 'journey-%s.json' % ''.join(ch for ch in str(uid) if ch.isalnum()))

    def owner_check(self):
        u = self.user(); uid = str(u['id']) if u and u.get('id') else 'guest'
        own = SET.get('journey_owner')
        if own is None:
            SET.set('journey_owner', uid); return
        if own == uid:
            return
        try:
            with open(self._file(own) + '.tmp', 'w') as f:
                json.dump(self.S, f)
            os.replace(self._file(own) + '.tmp', self._file(own))
        except Exception:
            pass
        try:
            nxt = json.load(open(self._file(uid)))
        except Exception:
            nxt = None
        if own == 'guest':
            nxt = merge(nxt, self.S)
        self.S = promote(merge(nxt, None), today())
        SET.set('journey_owner', uid); self.save(send=False); self.changed()

    def sync(self, done=None):
        """send what waits, and bring in what was read on the other devices"""
        self.owner_check()
        if not self.user():
            if done:
                done()
            return
        def work():
            # 2.28: always the whole record, both ways: the website keeps what both have (nothing read is ever lost),
            # so chapters marked here while signed out, or before an update, reach the account too
            return self._post('save', json.loads(json.dumps(self.S)))
        def fin(r):
            ok = isinstance(r, dict) and r.get('success')
            if ok:
                d = (r.get('data') or {}).get('data')
                self.pending = False; SET.set('journey_unsent', False)
                if d:
                    self.S = promote(merge(self.S, d), today()); self.save(send=False)
                self.check(quiet=True); self.changed()
            self.last_sync = (time.time(), bool(ok))
            if done:
                done()
        run_bg(work, fin)

    # ---- reading
    def counted(self, b):
        return b[2] != 'appendix' and (b[2] != 'anag' or self.S['settings'].get('anag'))

    def is_read(self, k):
        return k in self.S['read']

    def mark(self, k, how='button'):
        t = today(); r = self.S['read'].get(k)
        self.S['read'][k] = [r[0], t, (r[2] or 1) + 1] if r else [t, t, 1]
        self.S['days'][str(t)] = int(self.S['days'].get(str(t), 0)) + 1
        self.S['parts'].pop(k, None)
        b = BY.get(k.split('.')[0])
        self.note = T('Glory to Thee, O Lord, glory to Thee!') if b and b[2] == 'gospels' else (T('Marked as read.') if how == 'auto' else T('Glory to God!'))
        self.save(); got = self.check(quiet=False); self.changed()
        return got

    def unmark(self, k):
        r = self.S['read'].get(k)
        if not r:
            return
        if (r[2] or 1) > 1:
            self.S['read'][k] = [r[0], r[1], r[2] - 1]
        else:
            del self.S['read'][k]
        t = str(today())
        if self.S['days'].get(t):
            self.S['days'][t] = int(self.S['days'][t]) - 1
            if not self.S['days'][t]:
                del self.S['days'][t]
        self.note = ''; self.save(); self.changed()

    def part_share(self, k):
        n, p = vcount(k), (self.S.get('parts') or {}).get(k)
        if not n or not p:
            return 0
        got = sum(max(0, min(x[1], n) - x[0] + 1) for x in p)
        return min(1, got / n)

    def stats(self):
        S = self.S
        st = {'books': {}, 'part': {}, 'groups': {}, 'read': 0, 'total': 0, 'ot': [0, 0], 'nt': [0, 0], 'chapters': len(S['read'])}
        for b in BOOKS:
            n = 0; part = 0; pn = 0
            for i in range(1, b[1] + 1):
                k = '%s.%d' % (b[0], i)
                if k in S['read']:
                    n += 1
                else:
                    sh = self.part_share(k)
                    if sh > 0:
                        part += sh; pn += 1
            st['books'][b[0]] = n; st['part'][b[0]] = (part, pn)
            g = st['groups'].setdefault(b[2], [0, 0]); g[0] += n; g[1] += b[1]
            if not self.counted(b):
                continue
            st['read'] += n; st['total'] += b[1]
            t = st['nt'] if TESTAMENT[b[2]] == 'nt' else st['ot']; t[0] += n; t[1] += b[1]
        days = set(int(d) for d, n in S['days'].items() if int(n or 0) > 0)
        t = today(); d = t if t in days else t - 1; run = 0
        while d in days:
            run += 1; d -= 1
        st['streak'] = run; st['days'] = len(days)
        best = r = 0; prev = None
        for x in sorted(days):
            r = r + 1 if prev is not None and prev == x - 1 else 1; best = max(best, r); prev = x
        st['best'] = best
        return st

    def plan_status(self):
        p = self.S.get('plan')
        if not p or p.get('id') not in PLAN:
            return None
        parts = portions(p['id'], self.S)
        day = min(len(parts) - 1, max(0, today() - int(p.get('start', today()))))
        due = [k for x in parts[:day + 1] for k in x]; allk = [k for x in parts for k in x]
        behind = len([k for k in due if k not in self.S['read']]) - len([k for k in parts[day] if k not in self.S['read']])
        done = len([k for k in allk if k in self.S['read']])
        return {'id': p['id'], 'parts': parts, 'day': day, 'today': parts[day], 'behind': max(0, behind), 'done': done, 'total': len(allk), 'complete': done == len(allk) and len(allk) > 0}

    def next_unread(self, lst=None):
        if lst is None:
            lst = chapters([b[0] for b in BOOKS if self.counted(b)])
        for k in lst:
            if k not in self.S['read']:
                return k
        return None

    def check(self, quiet=False):
        st = self.stats(); got = []
        for m in MILESTONES:
            if m[0] not in self.S['earned'] and m[4](st, self):
                self.S['earned'][m[0]] = today(); got.append(m)
        if got:
            self.save()
        return [] if quiet else got

    def start_plan(self, pid):
        self.S['plan'] = {'id': pid, 'start': today(), 'at': int(time.time() * 1000)}; self.save(); self.changed()

    def stop_plan(self):
        self.S['plan'] = None; self.save(); self.changed()

    def set_setting(self, k, v):
        self.S['settings'][k] = v; self.S['settings']['at'] = int(time.time() * 1000); self.save(); self.changed()

    def clear(self):
        self.S = blank(); self.save(send=False)
        if self.user():
            run_bg(lambda: self._post('clear'))
        self.changed()

    def add(self, x):
        """a backup (or the AndBible study) brought in: merged, nothing lost"""
        if not isinstance(x, dict) or not (x.get('read') or x.get('days')):
            return False
        self.S = promote(merge(self.S, x), today()); self.save(); self.check(quiet=True); self.changed()
        return True


JOURNEY = Journey()


# ------------------------------------------------------------------------------------------------ the page
CSS = '''
.kjj-hero { border-radius: 18px; padding: 18px 20px; color: white;
  background: linear-gradient(120deg, #6d1530 0%, #8f1d3a 45%, #1f5e63 100%); }
.kjj-hero label { color: white; }
.kjj-hero-title { font-family: Serif; font-weight: 800; font-size: 1.45em; }
.kjj-hero-cross { font-size: 1.9em; background: rgba(255,255,255,0.18); border-radius: 999px; min-width: 52px; min-height: 52px; color: #f3c548; }
.kjj-tab { border-radius: 999px; padding: 4px 14px; }
.kjj-tab:checked { background: #6d1530; color: white; }
.kjj-stat { border: 1px solid alpha(#6d1530, 0.18); border-radius: 14px; padding: 12px 6px; background: alpha(#f3c548, 0.06); }
.kjj-stat-n { font-family: Serif; font-weight: 800; font-size: 1.55em; color: #6d1530; }
.kjj-card { border: 1px solid alpha(#6d1530, 0.15); border-radius: 16px; padding: 14px 16px; background: alpha(#ffffff, 0.6); }
.kjj-card-title { font-weight: 800; color: #6d1530; }
.kjj-btn { background: #6d1530; color: white; border-radius: 999px; padding: 6px 16px; font-weight: 700; }
.kjj-ghost { border: 2px solid #6d1530; color: #6d1530; border-radius: 999px; padding: 4px 14px; font-weight: 700; background: none; }
.kjj-chip { border-radius: 999px; padding: 2px 12px; border: 1px solid alpha(#6d1530, 0.3); }
.kjj-chip.done { background: alpha(#2e7d5b, 0.15); color: #2e7d5b; }
.kjj-father { border-left: 4px solid #c99a1d; padding: 10px 14px; background: alpha(#f3c548, 0.10); border-radius: 0 12px 12px 0; }
.kjj-father-text { font-family: Serif; font-style: italic; font-size: 1.08em; }
.kjj-father-cite { font-family: Serif; font-weight: 700; color: #6d1530; font-size: 0.9em; }
.kjj-day { min-width: 14px; min-height: 14px; border-radius: 3px; background: alpha(#c99a1d, 0.18); }
.kjj-day.on { background: #2e7d5b; }
.kjj-day.today { box-shadow: inset 0 0 0 2px #c99a1d; }
.kjj-book { border: 1px solid alpha(#6d1530, 0.15); border-radius: 12px; padding: 8px 10px; background: alpha(#ffffff, 0.5); }
.kjj-book.done { background: alpha(#2e7d5b, 0.12); border-color: alpha(#2e7d5b, 0.4); }
.kjj-book.current { box-shadow: inset 0 0 0 2px #c99a1d; }
.kjj-book progressbar, .kjj-plan progressbar { min-height: 6px; }
.kjj-book progressbar trough, .kjj-plan progressbar trough { min-height: 6px; border-radius: 3px; }
.kjj-book progressbar progress, .kjj-plan progressbar progress { min-height: 6px; border-radius: 3px; background: #2e7d5b; }
.kjj-mile { border: 1px solid alpha(#6d1530, 0.15); border-radius: 14px; padding: 12px; background: alpha(#ffffff, 0.4); }
.kjj-mile.got { background: alpha(#f3c548, 0.16); border-color: alpha(#c99a1d, 0.5); }
.kjj-mile-icon { font-size: 1.9em; }
.kjj-season { border-radius: 16px; padding: 14px 16px; background: linear-gradient(120deg, alpha(#f3c548, 0.35), alpha(#f3c548, 0.12)); }
.kjj-plancard { border: 1px solid alpha(#6d1530, 0.15); border-radius: 16px; padding: 14px 16px; }
.kjj-plancard.current { border: 2px solid #6d1530; background: alpha(#6d1530, 0.05); }
.kjj-markbar { border-top: 1px solid alpha(#6d1530, 0.15); padding: 14px 28px 26px 28px; }
.kjj-done { color: #2e7d5b; font-weight: 700; }
'''
CSS_DARK = '''
.kjj-stat-n, .kjj-card-title, .kjj-father-cite { color: #f0b8c8; }
.kjj-card, .kjj-book, .kjj-mile { background: alpha(#ffffff, 0.04); border-color: alpha(#ffffff, 0.12); }
.kjj-ghost { border-color: #f0b8c8; color: #f0b8c8; }
.kjj-done { color: #7fd6a8; }
'''


def lab(text, *cls, wrap=True, x=0, sel=False):
    l = Gtk.Label(label=text, xalign=x, wrap=wrap, selectable=sel)
    if wrap:
        l.set_wrap_mode(Pango.WrapMode.WORD_CHAR)
    for c in cls:
        l.add_css_class(c)
    return l


def wrap_row():
    """2.37: a row of buttons that goes onto two lines when there is no room (a phone) instead of widening the page"""
    fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, min_children_per_line=1, max_children_per_line=4,
                     column_spacing=8, row_spacing=8, homogeneous=False, hexpand=True, halign=Gtk.Align.FILL)
    fb.append_btn = lambda b: (b.set_halign(Gtk.Align.START), fb.append(b))
    return fb


def btn(text, fn, *cls):
    b = Gtk.Button(label=text)
    for c in cls:
        b.add_css_class(c)
    b.connect('clicked', lambda *_: fn())
    return b


class JourneyView(Gtk.Box):
    TABS = [('today', 'Today'), ('books', 'Books'), ('milestones', 'Milestones'), ('plans', 'Reading plans'), ('settings', 'Settings')]

    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win
        self.tab = SET.get('journey_tab') or 'today'
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); self.append(sc)
        self.sc = sc
        clamp = Adw.Clamp(maximum_size=980, tightening_threshold=700)
        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=14, margin_top=16, margin_bottom=40, margin_start=16, margin_end=16)
        clamp.set_child(self.box); sc.set_child(clamp)
        JOURNEY.listen(lambda: GLib.idle_add(lambda: (self.fill(), False)[1]))
        self.fill()

    def clear(self):
        while self.box.get_first_child():
            self.box.remove(self.box.get_first_child())

    def fill(self):
        y = self.sc.get_vadjustment().get_value()
        self.clear()
        J = JOURNEY; st = J.stats()
        # the card, as in the app
        hero = Gtk.Box(spacing=16); hero.add_css_class('kjj-hero')
        cross = lab('☦', 'kjj-hero-cross', wrap=False, x=0.5); cross.set_valign(Gtk.Align.CENTER); hero.append(cross)
        tx = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True)
        tx.append(lab(T('Bible Study Journey'), 'kjj-hero-title'))
        line = '%s%% %s · %d / %d' % (pct(st['read'], st['total']), T('of the Holy Bible'), st['read'], st['total'])
        if J.S['settings'].get('streaks') and st['streak']:
            line += ' · 🔥 %d %s' % (st['streak'], T('days in a row'))
        tx.append(lab(line))
        sync = '☁ ' + T('Kept in step with your account') if J.user() else T('Your study is saved on this computer only. Sign in (My study) to keep it on all your devices.')
        tx.append(lab(sync, 'caption'))
        hero.append(tx)
        self.box.append(hero)
        # the tabs
        tabs = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=6, column_spacing=6, row_spacing=6, homogeneous=False)
        first = None
        for key, title in self.TABS:
            b = Gtk.ToggleButton(label=T(title), active=key == self.tab); b.add_css_class('kjj-tab'); b.add_css_class('flat')
            if first:
                b.set_group(first)
            first = first or b
            b.connect('toggled', lambda bb, key=key: bb.get_active() and self.go_tab(key))
            tabs.append(b)
        self.box.append(tabs)
        getattr(self, 'view_' + self.tab)(st)
        GLib.idle_add(lambda: (self.sc.get_vadjustment().set_value(y), False)[1])

    def go_tab(self, key):
        if key != self.tab:
            self.tab = key; SET.set('journey_tab', key); self.fill(); self.sc.get_vadjustment().set_value(0)

    def open_chapter(self, k):
        c, ch = k.split('.')
        self.win.show('bible'); self.win.bible.open_ref(c, int(ch))

    def card(self, *cls):
        c = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8); c.add_css_class('kjj-card')
        for x in cls:
            c.add_css_class(x)
        self.box.append(c)
        return c

    # ---- Today
    def stat(self, n, t):
        b = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2); b.add_css_class('kjj-stat')
        b.append(lab(str(n), 'kjj-stat-n', x=0.5, wrap=False)); b.append(lab(T(t), 'caption', x=0.5))
        b.set_size_request(120, -1)
        return b

    def view_today(self, st):
        J = JOURNEY; S = J.S; sn = season()
        if sn:
            b = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6); b.add_css_class('kjj-season')
            b.append(lab(sn[1], 'heading')); b.append(lab(sn[2]))
            if not S.get('plan') or S['plan'].get('id') != sn[3]:
                bb = btn(T('Begin') + ': ' + T(PLAN[sn[3]][2]), lambda: self.begin(sn[3]), 'kjj-btn'); bb.set_halign(Gtk.Align.START); b.append(bb)
            self.box.append(b)
        fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=5, min_children_per_line=2, column_spacing=8, row_spacing=8, homogeneous=True)
        fb.append(self.stat('%s%%' % pct(st['read'], st['total']), 'of the Holy Bible'))
        fb.append(self.stat('%s%%' % pct(*st['ot']), 'Old Testament'))
        fb.append(self.stat('%s%%' % pct(*st['nt']), 'New Testament'))
        fb.append(self.stat(st['streak'], 'day in a row' if st['streak'] == 1 else 'days in a row') if S['settings'].get('streaks') else self.stat(st['chapters'], 'chapters read'))
        fb.append(self.stat(st['days'], 'reading day' if st['days'] == 1 else 'reading days'))
        self.box.append(fb)
        ps = J.plan_status()
        c = self.card('kjj-plan')
        if ps:
            P = PLAN[ps['id']]
            c.append(lab('%s %s · %s %d / %d' % (P[1], T(P[2]), T('day'), ps['day'] + 1, P[3]), 'kjj-card-title'))
            pb = Gtk.ProgressBar(fraction=ps['done'] / max(1, ps['total'])); c.append(pb)
            c.append(lab(T('Plan complete. Glory to God!') if ps['complete'] else T("Today's reading:"), 'caption'))
            if not ps['complete']:
                chips = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=8, column_spacing=6, row_spacing=6)
                for k in ps['today']:
                    done = J.is_read(k)
                    b = btn(('✓ ' if done else '') + label(k), lambda k=k: self.open_chapter(k), 'kjj-chip', 'flat')
                    if done:
                        b.add_css_class('done')
                    chips.append(b)
                c.append(chips)
            if ps['behind']:
                c.append(lab('%d %s' % (ps['behind'], T('earlier chapters still to read. No worries: take them at your own pace. God is patient with us.')), 'caption'))
            nx = J.next_unread([k for x in ps['parts'] for k in x])
            if nx:
                b = btn(T('Continue with') + ' ' + label(nx) + ' →', lambda: self.open_chapter(nx), 'kjj-btn'); b.set_halign(Gtk.Align.START); c.append(b)
        else:
            c.append(lab(T('Read the whole Bible, one chapter at a time'), 'kjj-card-title'))
            c.append(lab(T('Choose a reading plan, or simply continue from where you are. Tap “Mark as read” under each chapter.'), 'dim-label'))
            row = wrap_row()
            nu = J.next_unread()
            if nu:
                row.append_btn(btn(T('Continue with') + ' ' + label(nu) + ' →', lambda: self.open_chapter(nu), 'kjj-btn'))
            row.append_btn(btn(T('Choose a reading plan'), lambda: self.go_tab('plans'), 'kjj-ghost'))
            c.append(row)
        # the Church readings marked as read (Today with God)
        ch = S.get('church') or {}
        dates = sorted(d for d in ch if ch[d])
        if dates:
            c2 = self.card(); c2.append(lab('✝ ' + T('Church readings'), 'kjj-card-title'))
            c2.append(lab('%d %s' % (len(dates), T('days kept')), 'caption'))
            for d in dates[-5:][::-1]:
                c2.append(lab('%s · %s ✓' % (d, ' · '.join(k.split('|')[0] for k in ch[d])), 'caption'))
        # the prayer before reading
        ex = Gtk.Expander(label='🕯️ ' + T('Prayer before reading'), expanded=bool(S['settings'].get('prayer')))
        pb2 = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_top=8)
        pb2.append(lab(T(PRAYER), sel=True)); pb2.append(lab(T('From the Divine Liturgy, before the reading of the Holy Gospel.'), 'caption', 'dim-label'))
        ex.set_child(pb2)
        pc = self.card(); pc.append(ex)
        # a word from the Fathers
        q = FATHERS[today() % len(FATHERS)]
        fb2 = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6); fb2.add_css_class('kjj-father')
        fb2.append(lab('“%s”' % T(q[0]), 'kjj-father-text', sel=True)); fb2.append(lab(T(q[1]), 'kjj-father-cite'))
        self.box.append(fb2)
        if S['settings'].get('streaks'):
            self.box.append(lab(T('Your reading days, last ten weeks'), 'caption', 'dim-label'))
            g = Gtk.Grid(column_spacing=4, row_spacing=4, halign=Gtk.Align.START)
            t = today(); start = t - 69; days = S['days']
            # weeks as columns, Monday at the top
            first = start - date_of(start).weekday()
            for d in range(first, t + 1):
                cell = Gtk.Box(); cell.add_css_class('kjj-day')
                n = int(days.get(str(d), 0) or 0)
                if d < start:
                    cell.set_opacity(0)
                if n:
                    cell.add_css_class('on')
                if d == t:
                    cell.add_css_class('today')
                cell.set_tooltip_text(fmt(d) + (': %d' % n if n else ''))
                g.attach(cell, (d - first) // 7, (d - first) % 7, 1, 1)
            self.box.append(g)

    def begin(self, pid):
        if JOURNEY.S.get('plan') and JOURNEY.S['plan'].get('id') != pid:
            d = Adw.AlertDialog(heading=T('Begin this plan instead of your current one?'), body=T('Chapters you have read stay read.'))
            d.add_response('no', _('Cancel')); d.add_response('yes', T('Begin')); d.set_response_appearance('yes', Adw.ResponseAppearance.SUGGESTED)
            d.connect('response', lambda _d, r: r == 'yes' and self._begin(pid))
            d.present(self.win)
        else:
            self._begin(pid)

    def _begin(self, pid):
        self.tab = 'today'; SET.set('journey_tab', 'today'); JOURNEY.start_plan(pid)

    # ---- Books
    def view_books(self, st):
        J = JOURNEY
        cur = canon(getattr(self.win.pages.get('bible'), 'book', '') or '') if self.win.pages.get('bible') else ''
        for g, title, _t in GROUPS:
            books = [b for b in BOOKS if b[2] == g]
            if not books:
                continue
            if g == 'anag' and not J.S['settings'].get('anag'):
                self.box.append(lab(T('The Anagignoskomena are hidden. Turn them on in Settings to count and track them.'), 'caption', 'dim-label'))
                continue
            x = st['groups'].get(g, [0, 0])
            self.box.append(lab('%s · %s%%' % (T(title), pct(*x)), 'heading'))
            fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=6, min_children_per_line=2, column_spacing=8, row_spacing=8, homogeneous=True)
            for code, n_ch, _g in books:
                n = st['books'].get(code, 0); done = n >= n_ch
                b = Gtk.Button(); b.add_css_class('kjj-book'); b.add_css_class('flat')
                if done:
                    b.add_css_class('done')
                if code == cur:
                    b.add_css_class('current')
                inner = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
                if code == cur:
                    inner.append(lab('📖 ' + T('Reading now'), 'caption'))
                nm = lab(('✓ ' if done else '') + bname(code), 'heading', wrap=False); nm.set_ellipsize(Pango.EllipsizeMode.END); inner.append(nm)
                inner.append(Gtk.ProgressBar(fraction=n / n_ch if n_ch else 0))
                part = st['part'].get(code, (0, 0))
                inner.append(lab('%d / %d' % (n, n_ch) + ('  +%d %s' % (part[1], T('in part')) if part[1] else ''), 'caption', wrap=False))
                b.set_child(inner); b.set_tooltip_text(bname(code))
                b.connect('clicked', lambda *_, code=code: self.open_chapter(J.next_unread(chapters([code])) or code + '.1'))
                fb.append(b)
            self.box.append(fb)

    # ---- Milestones
    def view_milestones(self, st):
        J = JOURNEY
        fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=3, min_children_per_line=1, column_spacing=10, row_spacing=10, homogeneous=True)
        for m in MILESTONES:
            if m[0] == 'anag' and not J.S['settings'].get('anag'):
                continue
            got = J.S['earned'].get(m[0])
            b = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4); b.add_css_class('kjj-mile')
            if got:
                b.add_css_class('got')
            b.append(lab(m[1] if got else '🔒', 'kjj-mile-icon', x=0.5, wrap=False))
            b.append(lab(T(m[2]), 'heading', x=0.5))
            b.append(lab(T('Reached on') + ' ' + fmt(got) if got else T(m[3]), 'caption', x=0.5))
            if got:
                b.append(lab('“%s” %s' % (T(m[5]), m[6]), 'caption', 'dim-label', x=0.5))
            fb.append(b)
        self.box.append(fb)

    # ---- Reading plans
    def view_plans(self, st):
        J = JOURNEY
        self.box.append(lab(T('One plan at a time. Chapters you have already read count towards any plan.'), 'dim-label'))
        for pid, icon, title, days, blurb in PLANS:
            cur = bool(J.S.get('plan')) and J.S['plan'].get('id') == pid
            allk = [k for x in portions(pid, J.S) for k in x]; done = len([k for k in allk if J.is_read(k)])
            c = Gtk.Box(spacing=14); c.add_css_class('kjj-plancard')
            if cur:
                c.add_css_class('current')
            c.append(lab(icon, 'kjj-mile-icon', wrap=False))
            tx = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4, hexpand=True)
            tx.append(lab(T(title), 'kjj-card-title')); tx.append(lab(T(blurb)))
            tx.append(lab('%d %s · %d %s' % (days, T('days'), len(allk), T('chapters')) + (' · %d %s' % (done, T('already read')) if done else ''), 'caption', 'dim-label'))
            c.append(tx)
            side = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, valign=Gtk.Align.CENTER)
            if cur:
                side.append(btn(T('Start again today'), lambda pid=pid: J.start_plan(pid), 'kjj-ghost'))
                side.append(btn(T('Stop this plan'), J.stop_plan, 'flat'))
            else:
                side.append(btn(T('Begin'), lambda pid=pid: self.begin(pid), 'kjj-btn'))
            c.append(side)
            self.box.append(c)

    # ---- Settings
    def view_settings(self, st):
        J = JOURNEY
        grp = Adw.PreferencesGroup()
        for key, title, note in (('anag', 'Include the Anagignoskomena', 'Tobit, Judith, Wisdom, Sirach, Baruch, the Maccabees and more, read in the Orthodox Church. 2 Esdras is never counted.'),
                                 ('auto', 'Mark chapters automatically', 'After you reach the end of a chapter and have spent at least 40 seconds on it.'),
                                 ('streaks', 'Show reading streaks and the calendar', 'Turn off if you prefer to read without counting days.'),
                                 ('prayer', 'Show the prayer before reading open', '')):
            r = Adw.SwitchRow(title=T(title), subtitle=T(note) if note else '', active=bool(J.S['settings'].get(key)))
            r.connect('notify::active', lambda row, _p, key=key: J.set_setting(key, row.get_active()))
            grp.add(r)
        self.box.append(grp)
        self.box.append(lab(T('Your reading journey is saved privately to your account and follows you to any device where you sign in. It is never shown publicly.') if J.user()
                            else T('Your reading journey is saved privately on this computer. To keep it on all your devices, sign in (My study): your progress will be moved into it.'), 'dim-label'))
        row = wrap_row()
        row.append_btn(btn('⬇️ ' + T('Download my reading record'), self.export, 'kjj-ghost'))
        row.append_btn(btn('⬆️ ' + T('Bring in a reading record'), self.import_, 'kjj-ghost'))
        dl = btn(T('Delete my reading history'), self.delete, 'flat'); dl.add_css_class('error'); row.append_btn(dl)
        self.box.append(row)

    def export(self):
        fd = Gtk.FileDialog(initial_name='my-reading-journey.json')
        def fin(d, res):
            try:
                f = d.save_finish(res)
            except GLib.Error:
                return
            with open(f.get_path(), 'w') as fh:
                json.dump(JOURNEY.S, fh, indent=1)
            self.win.toast(T('Saved.'))
        fd.save(self.win, None, fin)

    def import_(self):
        fd = Gtk.FileDialog()
        def fin(d, res):
            try:
                f = d.open_finish(res)
                x = json.load(open(f.get_path()))
            except Exception:
                return
            x = x.get('journey') if isinstance(x, dict) and isinstance(x.get('journey'), dict) else x
            self.win.toast(T('Added to your reading journey.') if JOURNEY.add(x) else T('Nothing to add from this file.'))
        fd.open(self.win, None, fin)

    def delete(self):
        d = Adw.AlertDialog(heading=T('Delete your whole reading history, plan and milestones?'), body=T('This cannot be undone.'))
        d.add_response('no', _('Cancel')); d.add_response('yes', T('Delete'))
        d.set_response_appearance('yes', Adw.ResponseAppearance.DESTRUCTIVE)
        d.connect('response', lambda _d, r: r == 'yes' and JOURNEY.clear())
        d.present(self.win)


# ------------------------------------------------------------------------------------------------ under each chapter
class MarkBar(Gtk.Box):
    """“Mark as read” under the chapter (and the next chapter of the plan)"""
    def __init__(self, page):
        super().__init__(spacing=10, margin_top=4)
        self.page = page; self.add_css_class('kjj-markbar')
        self.k = None; self.shown = 0; self.auto_done = False
        JOURNEY.listen(lambda: GLib.idle_add(lambda: (self.fill(), False)[1]))

    def key(self):
        b = canon(self.page.book)
        return '%s.%d' % (b, int(self.page.ch)) if b in BY else None

    def chapter_shown(self):
        k = self.key()
        if k != self.k:
            self.k = k; self.shown = time.time(); self.auto_done = False; JOURNEY.note = ''
        self.fill()

    def fill(self):
        while self.get_first_child():
            self.remove(self.get_first_child())
        k = self.key(); self.set_visible(bool(k))
        if not k:
            return
        r = JOURNEY.S['read'].get(k)
        fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=4, column_spacing=10, row_spacing=6, hexpand=True, halign=Gtk.Align.START)
        if not r:
            fb.append(btn('✓ ' + T('Mark as read') + ' · ' + label(k), lambda: self.mark('button'), 'kjj-btn'))
        else:
            fb.append(lab('✓ %s %s%s · %s' % (label(k), T('read'), (' %d×' % r[2]) if r[2] > 1 else '', fmt(r[1])), 'kjj-done', wrap=False))
            if r[1] == today():
                fb.append(btn(T('Undo'), lambda: JOURNEY.unmark(k), 'flat'))
            else:
                fb.append(btn(T('I read it again'), lambda: self.mark('again'), 'flat'))
            if JOURNEY.note:
                fb.append(lab(JOURNEY.note, 'dim-label', wrap=False))
            ps = JOURNEY.plan_status()
            nx = JOURNEY.next_unread([x for p in ps['parts'] for x in p]) if ps else None
            if nx and nx != k:
                fb.append(btn(T('Next in my plan') + ': ' + label(nx) + ' →', lambda: self.page.open_ref(nx.split('.')[0], int(nx.split('.')[1])), 'kjj-ghost'))
        self.append(fb)

    def mark(self, how):
        k = self.key()
        if not k:
            return
        got = JOURNEY.mark(k, how)
        for m in got:
            self.page.win.toast('%s %s · “%s” %s' % (m[1], T(m[2]), T(m[5]), m[6]))

    def scrolled(self, adj):
        """“Mark chapters automatically”: at the end of the chapter, after 40 seconds on it"""
        if not JOURNEY.S['settings'].get('auto') or self.auto_done:
            return
        k = self.key()
        if not k or JOURNEY.is_read(k) or k != self.k:
            return
        if adj.get_value() + adj.get_page_size() >= adj.get_upper() - 30:
            wait = 40 - (time.time() - self.shown)
            if wait <= 0:
                self.auto_done = True; self.mark('auto')
            elif not getattr(self, 'later', 0):
                def later():
                    self.later = 0
                    if self.key() == k and not JOURNEY.is_read(k) and JOURNEY.S['settings'].get('auto') and not self.auto_done:
                        a = self.page.scroll.get_vadjustment()
                        if a.get_value() + a.get_page_size() >= a.get_upper() - 60:
                            self.auto_done = True; self.mark('auto')
                    return False
                self.later = GLib.timeout_add(int(wait * 1000) + 100, later)
