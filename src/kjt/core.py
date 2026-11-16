"""Knowing Jesus Today for Linux: the data kept on this computer, and the website it comes from.

Everything the app shows lives in one folder of your own (~/.var/app/today.knowingjesus.KJT/data/kjt):
 - kjt.db       the Bibles (every verse, with a search index), your study, and small settings
 - files/       the dictionary, the maps, the Holy Fathers' library and commentary, saved audio
The website is asked only to fetch these (once, and for updates), to sign in, and to keep your study in step
with My KJT.
"""
import gzip, hashlib, http.cookiejar, json, os, sqlite3, threading, time, urllib.parse, urllib.request
from gi.repository import GLib, Gio

SITE = os.environ.get('KJT_SITE', 'https://knowingjesus.today').rstrip('/')
AJAX = SITE + '/wp-admin/admin-ajax.php'
UA = 'KnowingJesusToday-Linux/2.0 (+https://knowingjesus.today)'
LANGS = ['en', 'ar', 'el', 'ru', 'zh', 'fr', 'hi', 'es', 'tl']
LANG_NAMES = {'en': 'English', 'ar': 'العربية', 'el': 'Ελληνικά', 'ru': 'Русский', 'zh': '中文', 'fr': 'Français', 'hi': 'हिन्दी', 'es': 'Español', 'tl': 'Filipino'}
DEFAULT_BIBLES = {'en': 'eng-kjv', 'ar': 'arb-vd', 'el': 'grcorth', 'ru': 'russyn', 'zh': 'cmn-cu89s', 'fr': 'fraLSG', 'hi': 'hin2017', 'es': 'spaRV1909', 'tl': 'tglulb'}
RTL = {'ar', 'he', 'fa', 'ur'}
OT = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL'.split()
NT = 'MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split()
ALIAS = {'MAR': 'MRK', 'JOH': 'JHN', 'JN': 'JHN', 'JAM': 'JAS', '1JO': '1JN', '2JO': '2JN', '3JO': '3JN', 'PHI': 'PHP', 'EZE': 'EZK', 'JOE': 'JOL', 'SOL': 'SNG', 'NAH': 'NAM', 'ZCH': 'ZEC', 'PS': 'PSA', 'PSM': 'PSA', 'JDE': 'JUD'}

DATA = os.path.join(GLib.get_user_data_dir(), 'kjt')
FILES = os.path.join(DATA, 'files')
CONF = os.path.join(GLib.get_user_config_dir(), 'kjt')
for d in (DATA, FILES, CONF):
    os.makedirs(d, exist_ok=True)


def canon(code):
    c = (code or '').upper().replace(' ', '').replace('.', '')
    return ALIAS.get(c, c)


# ------------------------------------------------------------------------------------------------
# settings
# ------------------------------------------------------------------------------------------------
class Settings:
    def __init__(self):
        self.path = os.path.join(CONF, 'settings.json')
        try:
            with open(self.path) as f:
                self.d = json.load(f)
        except Exception:
            self.d = {}

    def get(self, k, default=None):
        return self.d.get(k, default)

    def set(self, k, v):
        self.d[k] = v
        try:
            with open(self.path + '.part', 'w') as f:
                json.dump(self.d, f)
            os.replace(self.path + '.part', self.path)
        except Exception:
            pass


SET = Settings()


def lang():
    return SET.get('lang', 'en')


# ------------------------------------------------------------------------------------------------
# the store
# ------------------------------------------------------------------------------------------------
class Store:
    def __init__(self):
        self.lock = threading.RLock()
        self.memo = {}  # small settings read once
        self.bookmemo = {}
        self.db = sqlite3.connect(os.path.join(DATA, 'kjt.db'), check_same_thread=False)
        self.db.execute('PRAGMA journal_mode=WAL')
        x = self.db.execute
        x('CREATE TABLE IF NOT EXISTS verse (tr TEXT, book TEXT, ch INTEGER, v INTEGER, text TEXT, PRIMARY KEY (tr, book, ch, v))')
        x('CREATE TABLE IF NOT EXISTS book (tr TEXT, code TEXT, name TEXT, ord INTEGER, PRIMARY KEY (tr, code))')
        x("CREATE VIRTUAL TABLE IF NOT EXISTS vsearch USING fts5(text, tr UNINDEXED, book UNINDEXED, ch UNINDEXED, v UNINDEXED, tokenize='unicode61 remove_diacritics 2')")
        x('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)')
        x('CREATE TABLE IF NOT EXISTS record (id TEXT PRIMARY KEY, j TEXT)')
        x('CREATE TABLE IF NOT EXISTS pad (tag TEXT PRIMARY KEY, j TEXT)')
        x('CREATE TABLE IF NOT EXISTS outbox (n INTEGER PRIMARY KEY AUTOINCREMENT, j TEXT)')
        self.db.commit()

    # small things
    def kv(self, k, default=None):
        if k in self.memo:
            return self.memo[k] if self.memo[k] is not None else default
        with self.lock:
            r = self.db.execute('SELECT v FROM kv WHERE k=?', (k,)).fetchone()
        v = json.loads(r[0]) if r else None
        self.memo[k] = v
        return v if v is not None else default

    def set_kv(self, k, v):
        with self.lock:
            self.db.execute('INSERT OR REPLACE INTO kv VALUES (?,?)', (k, json.dumps(v)))
            self.db.commit()
        self.memo[k] = v

    # the Bibles
    def put_book(self, tr, code, name, ord_, rows):
        with self.lock:
            self.db.execute('DELETE FROM verse WHERE tr=? AND book=?', (tr, code))
            self.db.execute('DELETE FROM vsearch WHERE tr=? AND book=?', (tr, code))
            vals = [(tr, code, int(r['chapter']), int(r['verse']), r['text']) for r in rows if str(r.get('chapter', '')).isdigit() and str(r.get('verse', '')).isdigit()]
            self.db.executemany('INSERT OR REPLACE INTO verse VALUES (?,?,?,?,?)', vals)
            self.db.executemany('INSERT INTO vsearch (text, tr, book, ch, v) VALUES (?,?,?,?,?)', [(strip_tags(v[4]), tr, code, v[2], v[3]) for v in vals])
            self.db.execute('INSERT OR REPLACE INTO book VALUES (?,?,?,?)', (tr, code, name, ord_))
            self.db.commit()
        self.bookmemo.pop(tr, None)

    def has_book(self, tr, code):
        with self.lock:
            return self.db.execute('SELECT 1 FROM verse WHERE tr=? AND book=? LIMIT 1', (tr, code)).fetchone() is not None

    def bibles(self):
        with self.lock:
            return [r[0] for r in self.db.execute('SELECT DISTINCT tr FROM book')]

    def books(self, tr):
        if tr in self.bookmemo:
            return self.bookmemo[tr]
        r = self._books(tr); self.bookmemo[tr] = r
        return r

    def _books(self, tr):
        with self.lock:
            rows = self.db.execute('SELECT code, name FROM book WHERE tr=? ORDER BY ord', (tr,)).fetchall()
        allb = OT + NT
        def pos(c):
            c = canon(c)
            return allb.index(c) if c in allb else 1000
        out, last = [], -1
        for i, (c, n) in enumerate(rows):
            p = pos(c)
            if p < 1000:
                last = p
            out.append((c, n, p if p < 1000 else last + 0.001 * (i + 1)))
        out.sort(key=lambda x: x[2])
        return [(c, n) for c, n, _ in out]

    def chapters(self, tr, book):
        with self.lock:
            return [r[0] for r in self.db.execute('SELECT DISTINCT ch FROM verse WHERE tr=? AND book=? ORDER BY ch', (tr, book))]

    def chapter(self, tr, book, ch):
        with self.lock:
            return self.db.execute('SELECT v, text FROM verse WHERE tr=? AND book=? AND ch=? ORDER BY v', (tr, book, ch)).fetchall()

    def find_book(self, tr, code):
        """the same book under another code in this Bible (JHN / JOH ...)"""
        c = canon(code)
        for b, _ in self.books(tr):
            if canon(b) == c:
                return b
        return None

    def passage(self, tr, book, c1, v1, c2=None, v2=None):
        b = self.find_book(tr, book)
        if not b:
            return []
        c2 = c2 or c1; v2 = v2 or v1
        with self.lock:
            rows = self.db.execute('SELECT ch, v, text FROM verse WHERE tr=? AND book=? AND ch BETWEEN ? AND ? ORDER BY ch, v', (tr, b, c1, c2)).fetchall()
        return [r for r in rows if (r[0], r[1]) >= (c1, v1) and (r[0], r[1]) <= (c2, v2 if v2 else 999)]

    def search(self, tr, q, limit=300):
        q = q.strip()
        if not q:
            return []
        with self.lock:
            if any('一' <= ch <= '鿿' for ch in q):
                return self.db.execute('SELECT book, ch, v, text FROM verse WHERE tr=? AND text LIKE ? LIMIT ?', (tr, '%' + q + '%', limit)).fetchall()
            words = ['"' + w.replace('"', '') + '"' for w in q.split() if w]
            try:
                return self.db.execute('SELECT book, ch, v, text FROM vsearch WHERE vsearch MATCH ? AND tr=? LIMIT ?', (' '.join(words), tr, limit)).fetchall()
            except sqlite3.OperationalError:
                return []

    def bible_size(self):
        with self.lock:
            return self.db.execute('SELECT tr, COUNT(DISTINCT book) FROM book GROUP BY tr').fetchall()

    def delete_bible(self, tr):
        with self.lock:
            for t in ('verse', 'book', 'vsearch'):
                self.db.execute('DELETE FROM %s WHERE tr=?' % t, (tr,))
            self.db.commit()
        self.bookmemo.pop(tr, None)

    # your study
    def records(self):
        with self.lock:
            return [json.loads(r[0]) for r in self.db.execute('SELECT j FROM record')]

    def put_records(self, recs, replace=False):
        with self.lock:
            if replace:
                self.db.execute('DELETE FROM record')
            self.db.executemany('INSERT OR REPLACE INTO record VALUES (?,?)', [(r['id'], json.dumps(r)) for r in recs])
            self.db.commit()

    def del_record(self, rid):
        with self.lock:
            self.db.execute('DELETE FROM record WHERE id=?', (rid,)); self.db.commit()

    def pads(self):
        with self.lock:
            return [json.loads(r[0]) for r in self.db.execute('SELECT j FROM pad')]

    def put_pads(self, pads, replace=False):
        with self.lock:
            if replace:
                self.db.execute('DELETE FROM pad')
            self.db.executemany('INSERT OR REPLACE INTO pad VALUES (?,?)', [(p['tag'], json.dumps(p)) for p in pads])
            self.db.commit()

    def del_pad(self, tag):
        with self.lock:
            self.db.execute('DELETE FROM pad WHERE tag=?', (tag,)); self.db.commit()

    def queue(self, op):
        with self.lock:
            self.db.execute('INSERT INTO outbox (j) VALUES (?)', (json.dumps(op),)); self.db.commit()

    def outbox(self):
        with self.lock:
            return [(n, json.loads(j)) for n, j in self.db.execute('SELECT n, j FROM outbox ORDER BY n')]

    def done(self, n):
        with self.lock:
            self.db.execute('DELETE FROM outbox WHERE n=?', (n,)); self.db.commit()


def strip_tags(s):
    import re
    return re.sub(r'<[^>]+>', '', s or '')


def file_path(rel):
    p = os.path.join(FILES, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


_FILE_MEMO = {}  # the last files read, kept while they are unchanged (the reader opens the same ones again and again)


def read_file(rel, as_json=True):
    p = os.path.join(FILES, rel)
    try:
        st = os.stat(p)
    except OSError:
        return None
    key = (rel, as_json)
    hit = _FILE_MEMO.get(key)
    if hit and hit[0] == st.st_mtime:
        return hit[1]
    with open(p, 'rb') as f:
        b = f.read()
    if rel.endswith('.gz'):
        b = gzip.decompress(b)
    v = json.loads(b.decode('utf-8')) if as_json else b
    if as_json and not rel.startswith('library/'):
        if len(_FILE_MEMO) > 24:
            _FILE_MEMO.pop(next(iter(_FILE_MEMO)))
        _FILE_MEMO[key] = (st.st_mtime, v)
    return v


def write_file(rel, data):
    p = file_path(rel)
    with open(p + '.part', 'wb') as f:
        f.write(data)
    os.replace(p + '.part', p)


# ------------------------------------------------------------------------------------------------
# the website
# ------------------------------------------------------------------------------------------------
class Net:
    def __init__(self):
        self.jar = http.cookiejar.LWPCookieJar(os.path.join(DATA, 'cookies.txt'))
        try:
            self.jar.load(ignore_discard=True)
        except Exception:
            pass
        self.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.lock = threading.Lock()
        self.down_until = 0

    def online(self):
        if time.time() < self.down_until:
            return False
        try:
            return Gio.NetworkMonitor.get_default().get_network_available()
        except Exception:
            return True

    def get(self, url, data=None, timeout=40, strict=False):
        if not url.startswith('http'):
            url = SITE + url
        body = urllib.parse.urlencode(data).encode() if isinstance(data, dict) else data
        req = urllib.request.Request(url, data=body, headers={'User-Agent': UA, 'Accept-Encoding': 'identity'})
        try:
            r = self.op.open(req, timeout=timeout)
            out = r.read()
        except urllib.error.HTTPError as e:
            out = e.read()
            if e.code >= 500 or strict:
                raise
        except Exception:
            self.down_until = time.time() + 15
            raise
        with self.lock:
            try:
                self.jar.save(ignore_discard=True)
            except Exception:
                pass
        return out

    def ajax(self, action, post=None, **q):
        url = AJAX + '?' + urllib.parse.urlencode(dict({'action': action}, **q))
        b = self.get(url, post)
        try:
            return json.loads(b.decode('utf-8'))
        except Exception:
            return {'success': False, 'data': {'message': 'The website answered something unexpected.'}}

    def file(self, rel_url):
        """a file under the plugin's data/ folder"""
        info = STORE.kv('info') or {}
        base = info.get('data') or (SITE + '/wp-content/plugins/kjt-local-bible/data/')
        if os.environ.get('KJT_SITE') and base.startswith('http') and not base.startswith(SITE):
            base = SITE + '/' + base.split('/', 3)[3]
        return self.get(base + rel_url, timeout=120, strict=True)

    def signed_out(self):
        self.jar.clear()
        try:
            self.jar.save(ignore_discard=True)
        except Exception:
            pass


STORE = Store()
NET = Net()


def info(refresh=False):
    """what the website offers (Bibles, names, ...); kept for offline use"""
    i = STORE.kv('info')
    if (refresh or not i) and NET.online():
        try:
            r = NET.ajax('kjtb_desk', op='info')
            if r.get('success'):
                i = r['data']; STORE.set_kv('info', i)
        except Exception:
            pass
    return i or {}


def book_name(code, lg=None, tr=None):
    lg = lg or lang()
    i = STORE.kv('info') or {}
    c = canon(code)
    n = (i.get('books', {}).get(lg) or {}).get(c) or (i.get('books', {}).get(lg) or {}).get(code)
    if n:
        return n
    if tr:
        for b, nm in STORE.books(tr):
            if b == code:
                return nm
    return (i.get('books', {}).get('en') or {}).get(c, code)


def run_bg(fn, done=None, *a):
    """fn in the background; done(result or Exception) on the window's thread"""
    def work():
        try:
            r = fn(*a)
        except Exception as e:
            r = e
        if done:
            GLib.idle_add(lambda: (done(r), False)[1])
    threading.Thread(target=work, daemon=True).start()
