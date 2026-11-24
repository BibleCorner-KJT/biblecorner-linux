"""2.48 · the offline pack inside the app (kjt/pack, made from the website by GitHub: tools/make_pack.py): the nine
Bibles of the app's languages, the dictionary, the maps, the cross-references and Greek and Hebrew words, the Church
Fathers, Today with God for about two years, the Prayer and You Today pages, Churches near me and the games.
With it the app works with no internet, even on its very first start; the website, when it is there, brings what is newer."""
import gzip, json, os, shutil, time
from .core import STORE, SITE, FILES

DIR = os.path.join(os.path.dirname(__file__), 'pack')


def present():
    return os.path.exists(os.path.join(DIR, 'manifest.json'))


def text(rel):
    p = os.path.join(DIR, rel)
    try:
        if rel.endswith('.gz'):
            with gzip.open(p, 'rt', encoding='utf-8') as f:
                return f.read()
        with open(p, encoding='utf-8') as f:
            return f.read()
    except Exception:
        return None


def js(rel):
    t = text(rel)
    try:
        return json.loads(t) if t else None
    except Exception:
        return None


def manifest():
    return js('manifest.json') or {}


def bibles():
    d = os.path.join(DIR, 'bibles')
    return sorted(os.listdir(d)) if os.path.isdir(d) else []


def put_bible(tr, only=None):
    """a Bible of the pack into the app (only: one book, to show it at once); the books already here stay"""
    books = js('bibles/%s/books.json' % tr) or []
    for n, b in enumerate(books):
        code = b['code']
        if only and code != only:
            continue
        if STORE.chapters(tr, code):
            continue
        rows = js('bibles/%s/%s.json.gz' % (tr, code)) or []
        if rows:
            STORE.put_book(tr, code, b.get('name') or code, n, [{'chapter': r[0], 'verse': r[1], 'text': r[2]} for r in rows])


def day(lang, iso):
    """Today with God for one day (about two years are in the pack)"""
    global _days
    try:
        _days
    except NameError:
        _days = {}
    if lang not in _days:
        d = js('today/%s.json.gz' % lang) or {}
        _days[lang] = {x.get('date'): x for x in d.get('days') or []}
    return _days[lang].get(iso)


def page(key, lang):
    return text('pages/%s-%s.html' % (key, lang)) or text('pages/%s-en.html' % key)


def start(lang, after=None):
    """once after each new pack: everything to where the app reads it (in the background)"""
    if not present():
        return
    made = manifest().get('made')
    if not STORE.kv('info'):
        i = js('info.json')
        if i:
            STORE.set_kv('info', i)
    if STORE.kv('pack_made') == made:
        return
    from .core import DEFAULT_BIBLES, run_bg
    def work():
        mine = DEFAULT_BIBLES.get(lang, 'eng-kjv')
        order = [mine] + [b for b in bibles() if b != mine]
        # the reader's own Bible first, so the reader shows at once; the other Bibles last
        if order[0] in bibles():
            put_bible(order[0])
        if after:
            from gi.repository import GLib
            GLib.idle_add(lambda: (after(), False)[1])
        # the files, where the downloads put them (a file the website brought later stays)
        src = os.path.join(DIR, 'data')
        for a, _d, fs in os.walk(src):
            for f in fs:
                rel = os.path.relpath(os.path.join(a, f), src)
                dst = os.path.join(FILES, rel)
                if not os.path.exists(dst):
                    os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.copyfile(os.path.join(a, f), dst)
        # Churches near me
        ix = js('churches/index.json')
        if ix and not (STORE.kv('ch_index') or {}).get('cells'):
            ix['_t'] = 0; ix['_base'] = 'pack'; STORE.set_kv('ch_index', ix)
        for c in (ix or {}).get('cells') or []:
            if not STORE.kv('ch_c_' + c[0]):
                d = js('churches/c_%s.json' % c[0])
                if d:
                    STORE.set_kv('ch_c_' + c[0], {'v': c[4] if len(c) > 4 else 0, 'c': d.get('c') or []})
        # Good Fun: the games page and its files, kept as if fetched from the website
        g = js('games/index.json') or {}
        try:
            from . import sitecache
            page_html = text('games/page.html')
            if page_html:
                sitecache._keep(SITE + '/fun-and-games/?kjt_embed=1&kjt_linux=1', 200, 'text/html; charset=utf-8', page_html.replace('https://biblecorner.com', SITE).encode('utf-8'))
            import mimetypes
            for u, name in (g.get('files') or {}).items():
                uu = u.replace('https://biblecorner.com', SITE)
                if os.path.exists(sitecache._key(uu)):
                    continue
                with open(os.path.join(DIR, 'games', 'f', name), 'rb') as f:
                    body = f.read()
                ct = mimetypes.guess_type(u.split('?')[0])[0] or 'application/octet-stream'
                sitecache._keep(uu, 200, ct, body)
        except Exception:
            pass
        for tr in order[1:]:
            if tr in bibles():
                put_bible(tr)
        STORE.set_kv('pack_made', made)
        return True
    run_bg(work, lambda _r: None)
