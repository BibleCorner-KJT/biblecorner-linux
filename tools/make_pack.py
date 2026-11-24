#!/usr/bin/env python3
"""The offline pack: everything the apps need to work with no internet, even on their first start.
Made from the website by GitHub (workflow "Make the offline pack"), kept on the branch "pack", and built into
the Linux app and the Android app. Only what the website shows to everyone; nothing private.

pack/
  info.json                    the website's list of Bibles, languages, book names (kjtb_desk op=info)
  bibles/<tr>/books.json       the nine Bibles of the app's languages: [{"code","name"}] in the website's order
  bibles/<tr>/<BOOK>.json.gz   one book: [[chapter, verse, text], ...]
  data/...                     the same files the apps download: dictionary, maps, cross-references, Greek and Hebrew
                               words, the words of Christ in red, the Church Fathers (writings and commentary)
  today/<lang>.json.gz         Today with God for about two years: {"days":[...]}
  pages/pray-<lang>.html       the Prayer page (prayers, Creed, poem; without the prayer board)
  pages/you-<lang>.html        You Today (feelings and their Scriptures)
  churches/index.json, c_*.json  Churches near me (the website's directory)
  games/index.json + files     Good Fun: the games page and every file it uses, by address
"""
import datetime, gzip, hashlib, json, os, re, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

SITE = os.environ.get('KJT_SITE', 'https://biblecorner.com')
OUT = sys.argv[1] if len(sys.argv) > 1 else 'pack'
LANGS = ['en', 'ar', 'el', 'ru', 'zh', 'fr', 'hi', 'es', 'tl']
UA = 'BibleCornerPack/1.0 (+https://biblecorner.com)'
DAYS = int(os.environ.get('KJT_DAYS', '760'))
log = lambda *a: print(*a, flush=True)


def get(url, tries=4, timeout=120):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept-Encoding': 'identity'})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:
            if i == tries - 1:
                raise
            time.sleep(2 + 3 * i)


def ajax(action, **q):
    q['action'] = action
    return json.loads(get(SITE + '/wp-admin/admin-ajax.php?' + urllib.parse.urlencode(q)).decode('utf-8'))


def put(rel, data):
    p = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'wb') as f:
        f.write(data if isinstance(data, bytes) else data.encode('utf-8'))


def gz(obj):
    return gzip.compress(json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode('utf-8'), 9)


def many(fn, items, workers=8):
    with ThreadPoolExecutor(workers) as ex:
        return list(ex.map(fn, items))


def main():
    t0 = time.time()
    info = ajax('kjtb_desk', op='info')['data']
    info.pop('user', None); info.pop('nonce_pw', None); info.pop('nonce_study', None); info.pop('nonce_out', None)
    put('info.json', json.dumps(info, ensure_ascii=False))
    data = info.get('data') or SITE + '/wp-content/plugins/kjt-local-bible/data/'
    defaults = info.get('defaults') or {}
    trs = []
    for l in LANGS:
        tr = defaults.get(l) or {'en': 'eng-kjv', 'ar': 'arb-vd', 'el': 'grcorth', 'ru': 'russyn', 'zh': 'cmn-cu89s', 'fr': 'fraLSG', 'hi': 'hin2017', 'es': 'spaRV1909', 'tl': 'tglulb'}[l]
        if tr not in trs:
            trs.append(tr)
    # the Bibles
    for tr in trs:
        books = ajax('kjtb_data', op='books', tr=tr).get('data') or []
        def one(b):
            r = ajax('kjtb_data', op='offline_book', tr=tr, book=b['book_code'])
            rows = [[int(x['chapter']), int(x['verse']), x['text']] for x in (r.get('data') or [])]
            if rows:
                put('bibles/%s/%s.json.gz' % (tr, b['book_code']), gz(rows))
                return {'code': b['book_code'], 'name': b.get('book') or b['book_code']}
        out = [x for x in many(one, books, 6) if x]
        put('bibles/%s/books.json' % tr, json.dumps(out, ensure_ascii=False))
        log('Bible', tr, len(out), 'books')
    # the files the apps download (the same names)
    en = (info.get('books') or {}).get('en') or {}
    OT = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL'.split()
    NT = 'MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split()
    files = ['dictionary/%s.json' % l for l in LANGS] + ['dictionary/people.json']
    files += ['maps/' + f for f in ['base.json', 'places.json', 'stories.json', 'words.json', 'chapters.json', 'ident.json', 'world.json', 'atlas.json', 'countries.json']]
    files += ['maps/names-%s.json' % l for l in LANGS if l != 'en'] + ['maps/relief/overview.jpg'] + ['maps/relief/t%d-%d.jpg' % (r, c) for r in range(3) for c in range(6)]
    files += ['xref/%s.json' % b for b in OT + NT] + ['words/%s.json.gz' % b for b in OT + NT] + ['words/lexicon.json.gz', 'words/morph.json.gz']
    files += ['../assets/red-letters/%s.json' % en[b] for b in NT if b in en]
    lib = json.loads(get(data + 'library/index.json').decode('utf-8'))
    put('data/library/index.json', json.dumps(lib, ensure_ascii=False))
    files += ['library/topics.json'] + ['library/%s.json.gz' % w['id'] for w in lib]
    files += ['fathers/%s.json.gz' % b for b in (info.get('commentary') or [])]
    missing = []
    def fetch(rel):
        try:
            put('data/' + rel.replace('../assets/', ''), get(data + rel))
        except Exception:
            missing.append(rel)
    many(fetch, files, 8)
    log('files', len(files) - len(missing), 'kept,', len(missing), 'not on the website:', missing[:12])
    # Today with God, about two years
    # the website gives 42 days from the first of the month asked, so ask month by month (no gaps)
    start = datetime.date.today().replace(day=1)
    for l in LANGS:
        days, d = [], start
        while d < start + datetime.timedelta(days=DAYS):
            try:
                r = ajax('kjtb_desk', op='today', lang=l, days=42, **{'from': d.isoformat()})
                days += (r.get('data') or {}).get('days') or []
            except Exception as e:
                log('today', l, d, e)
            d = (d.replace(day=28) + datetime.timedelta(days=5)).replace(day=1)
        seen, uniq = set(), []
        for x in sorted(days, key=lambda x: x.get('date') or ''):
            if x.get('date') not in seen:
                seen.add(x.get('date')); uniq.append(x)
        put('today/%s.json.gz' % l, gz({'days': uniq, 'made': datetime.date.today().isoformat()}))
        log('today', l, len(uniq), 'days')
    # Prayer and You Today, in each language (the prayer board is left out: it changes every day)
    pages = info.get('pages') or {}
    for key, fallback in (('pray', '/prayer/'), ('you', '/how-are-you-today/')):
        u = pages.get(key) or fallback
        if not u.startswith('http'):
            u = SITE + u
        for l in LANGS:
            try:
                h = get(u + ('' if l == 'en' else ('&' if '?' in u else '?') + 'lang=' + l)).decode('utf-8', 'replace')
                h = re.sub(r'<section[^>]*id="shared-prayers".*?</section>', '', h, flags=re.S)
                h = re.sub(r'<script\b.*?</script>', '', h, flags=re.S)
                put('pages/%s-%s.html' % (key, l), h)
            except Exception as e:
                log('page', key, l, e)
    # Churches near me
    ch = info.get('church') or {}
    base = ch.get('data') or SITE + '/wp-content/uploads/kjt-cache/churches/'
    try:
        ix = json.loads(get(base + 'index.json').decode('utf-8'))
        put('churches/index.json', json.dumps(ix, ensure_ascii=False))
        def cell(c):
            try:
                put('churches/c_%s.json' % c[0], get(base + 'c_%s.json?v=%s' % (c[0], c[4] if len(c) > 4 else 0)))
            except Exception:
                missing.append('church ' + c[0])
        many(cell, ix.get('cells') or [], 8)
        log('churches', ix.get('n'), 'in', len(ix.get('cells') or []), 'squares')
    except Exception as e:
        log('churches', e)
    # Good Fun: the games page and every file it uses
    try:
        page = SITE + '/fun-and-games/?kjt_embed=1&kjt_app=1'
        html = get(page).decode('utf-8', 'replace')
        urls = set(re.findall(r'''(?:src|href)=["'](%s[^"'#]+)["']''' % re.escape(SITE), html))
        try:
            r = ajax('kjt_games_files', hashes=1)
            d = r.get('data') or []
            urls |= set((d.get('files') or {}) if isinstance(d, dict) else d)
        except Exception:
            pass
        idx = {'page': page, 'files': {}}
        put('games/page.html', html)
        def gfile(u):
            try:
                b = get(u)
                name = hashlib.sha1(u.encode()).hexdigest()[:20] + os.path.splitext(urllib.parse.urlparse(u).path)[1][:6]
                put('games/f/' + name, b); idx['files'][u] = name
            except Exception:
                pass
        many(gfile, sorted(urls), 8)
        put('games/index.json', json.dumps(idx))
        log('games', len(idx['files']), 'files')
    except Exception as e:
        log('games', e)
    put('manifest.json', json.dumps({'made': datetime.datetime.utcnow().isoformat() + 'Z', 'site': SITE, 'bibles': trs, 'langs': LANGS}))
    tot = sum(os.path.getsize(os.path.join(a, f)) for a, _d, fs in os.walk(OUT) for f in fs)
    log('done in %d s, %.1f MB' % (time.time() - t0, tot / 1e6))


if __name__ == '__main__':
    main()
