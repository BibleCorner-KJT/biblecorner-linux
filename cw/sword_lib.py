"""The free libraries of CrossWire (and of AndBible, which uses the same format): Bibles, commentaries,
dictionaries and books, read here without the internet once downloaded.

The SWORD file formats are read directly (no extra programs): zText/zCom (compressed verse files),
RawText/RawCom (plain verse files, 2- or 4-byte sizes), zLD/RawLD/RawLD4 (dictionaries) and
RawGenBook (books with chapters).

The verse tables of each versification (sword_v11n.json) come from PySword:
  Copyright (c) 2008-2019 Various PySword developers: Kenneth Arnold, Joshua Gross, Tomas Groth,
  Ryan Hiebert, Philip Ridout, Matthew Wardrop. Permission is hereby granted, free of charge, to any
  person obtaining a copy of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights to use, copy, modify,
  merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to
  whom the Software is furnished to do so, subject to the following conditions: The above copyright
  notice and this permission notice shall be included in all copies or substantial portions of the
  Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
The modules themselves belong to their owners; each one's licence is shown before it is downloaded."""
import bz2, html, io, json, lzma, os, re, struct, tarfile, time, zipfile, zlib
FILES = "/tmp/cwroot"; STORE = NET = None

ROOT = os.path.join(FILES, 'sword')
SOURCES = [
    # name, catalogue (all the .conf files), where each module's zip is
    ('CrossWire', 'https://www.crosswire.org/ftpmirror/pub/sword/raw/mods.d.tar.gz', 'https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/{name}.zip'),
    ('AndBible', 'https://raw.githubusercontent.com/AndBible/data/master/andbible/mods.d.tar.gz', 'https://raw.githubusercontent.com/AndBible/data/master/andbible/zip/{name}.zip'),
    ('AndBible extra', 'https://raw.githubusercontent.com/AndBible/andbible-extra/master/mods.d.tar.gz', 'https://raw.githubusercontent.com/AndBible/andbible-extra/master/zip/{name}.zip'),
]

OSIS2CODE = dict(zip(
    'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal '
    'Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev '
    'Tob Jdt AddEsth EsthGr Wis Sir Bar EpJer PrAzar Sus Bel 1Macc 2Macc 3Macc 4Macc 1Esd 2Esd PrMan AddPs Ps151 Odes PssSol 1En AddDan'.split(),
    'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL '
    'MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV '
    'TOB JDT ESG ESG WIS SIR BAR LJE S3Y SUS BEL 1MA 2MA 3MA 4MA 1ES 2ES MAN PS2 PS2 ODA PSS ENO DAG'.split()))
CODE2OSIS = {}
for _o, _c in OSIS2CODE.items():
    CODE2OSIS.setdefault(_c, _o)

# books an Orthodox reader looks for first (their names, descriptions or words in them)
ORTHODOX_FIRST = re.compile(r'septuag|\blxx\b|brenton|byzantin|patriarch|antoniades|orthodox|chrysostom|church fathers|early ?fathers|philokalia|'
                            r'didache|ignatius|irenaeus|justin|athanas|basil|gregory|ephrem|synodal|elzevir|textus receptus|\bkjva\b|apocrypha|vulgat|josephus|peshitta|slavonic', re.I)

_V11N = None


def v11n(name):
    global _V11N
    if _V11N is None:
        with open(os.path.join(os.path.dirname(__file__), 'sword_v11n.json')) as f:
            _V11N = json.load(f)
    return _V11N.get((name or 'kjv').lower()) or _V11N['kjv']


# ------------------------------------------------------------------------------------------------
# the .conf files
# ------------------------------------------------------------------------------------------------
MULTI = {'GlobalOptionFilter', 'Feature', 'Obsoletes'}


def parse_conf(text):
    c, key = {}, None
    lines = text.replace('\r\n', '\n').split('\n')
    for i, line in enumerate(lines):
        if i == 0 or (not c.get('_name') and line.startswith('[')):
            m = re.match(r'\s*\[(.+?)\]', line)
            if m:
                c['_name'] = m.group(1).strip(); continue
        if key and c.get('_cont'):
            c[key] += '\n' + line.rstrip('\\'); c['_cont'] = line.endswith('\\'); continue
        m = re.match(r'([A-Za-z0-9_.]+)\s*=\s*(.*)$', line)
        if not m:
            continue
        key, val = m.group(1), m.group(2)
        cont = val.endswith('\\'); val = val.rstrip('\\')
        if key in MULTI:
            c.setdefault(key, []).append(val)
        else:
            c[key] = val
        c['_cont'] = cont
    c.pop('_cont', None)
    return c


def kind(c):
    d = (c.get('ModDrv') or '').lower()
    cat = (c.get('Category') or '').lower()
    if 'text' in d:
        return 'bible'
    if 'com' in d:
        return 'commentary'
    if 'ld' in d:
        return 'glossary' if 'glossar' in cat else ('daily' if 'daily' in cat or 'devotion' in cat else 'dictionary')
    if 'genbook' in d:
        return 'map' if 'map' in cat or 'image' in cat else 'book'
    return 'other'


def about(c):
    a = c.get('About') or ''
    a = a.replace('\\par', '\n').replace('\\pard', '').replace('\\qc', '')
    return re.sub(r'\\[a-z]+\d* ?', '', a).strip()


def locked(c):
    return 'CipherKey' in c and not (c.get('CipherKey') or '').strip()


# ------------------------------------------------------------------------------------------------
# the catalogue (what can be downloaded) and what is kept here
# ------------------------------------------------------------------------------------------------
def fetch(url, timeout):
    """a file from CrossWire or AndBible; if they cannot be reached, the website is not thought to be offline"""
    was = NET.down_until
    try:
        return NET.get(url, timeout=timeout, strict=True)
    finally:
        NET.down_until = was


def catalogue(refresh=False):
    """every module of every source, read from their lists of .conf files (kept here for a week)"""
    path = os.path.join(ROOT, 'catalogue.json')
    if not refresh and os.path.exists(path) and time.time() - os.path.getmtime(path) < 7 * 86400:
        try:
            with open(path) as f:
                return json.load(f)
        except Exception:
            pass
    out, errors = [], 0
    for src, url, _zip in SOURCES:
        try:
            raw = fetch(url, 90)
            with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as tar:
                for m in tar.getmembers():
                    if not m.isfile() or not m.name.lower().endswith('.conf'):
                        continue
                    f = tar.extractfile(m)
                    txt = f.read().decode('utf-8', 'replace') if f else ''
                    c = parse_conf(txt)
                    if not c.get('_name') or not c.get('ModDrv'):
                        continue
                    c['_source'] = src; c['_kind'] = kind(c)
                    out.append(c)
        except Exception as e:
            print('catalogue', src, e); errors += 1
    if out:
        os.makedirs(ROOT, exist_ok=True)
        with open(path, 'w') as f:
            json.dump(out, f)
    elif os.path.exists(path):
        with open(path) as f:
            return json.load(f)
    return out


def installed():
    out = []
    d = os.path.join(ROOT, 'mods.d')
    if os.path.isdir(d):
        for fn in sorted(os.listdir(d)):
            if fn.lower().endswith('.conf'):
                try:
                    with open(os.path.join(d, fn), encoding='utf-8', errors='replace') as f:
                        c = parse_conf(f.read())
                    c['_conf'] = fn; c['_kind'] = kind(c)
                    out.append(c)
                except Exception:
                    pass
    return out


def find(name):
    return next((c for c in installed() if c['_name'].lower() == name.lower()), None)


def bible_code(c):
    return 'sw-' + re.sub(r'[^A-Za-z0-9]', '', c['_name'])


def install(c, step=None, cancelled=lambda: False):
    """download one module and keep it here; a Bible is also put into the app's own Bibles"""
    src = next((s for s in SOURCES if s[0] == c.get('_source')), SOURCES[0])
    raw = fetch(src[2].format(name=c['_name']), 600)
    if cancelled():
        return False
    zf = zipfile.ZipFile(io.BytesIO(raw))
    root = os.path.realpath(ROOT)
    for m in zf.infolist():
        dest = os.path.realpath(os.path.join(root, m.filename))
        if not dest.startswith(root + os.sep):     # never write outside the library folder
            continue
        if m.is_dir():
            os.makedirs(dest, exist_ok=True); continue
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with zf.open(m) as s, open(dest, 'wb') as d:
            d.write(s.read())
    mine = find(c['_name'])
    if mine and mine['_kind'] == 'bible':
        to_store(mine, step, cancelled)
    return True


def remove(c):
    import shutil
    mod = open_module(c)
    if c['_kind'] == 'bible':
        STORE.delete_bible(bible_code(c))
    p = mod.base if mod else None
    if p:
        p = os.path.realpath(p if os.path.isdir(p) else os.path.dirname(p))
        if p.startswith(os.path.realpath(ROOT) + os.sep) and p != os.path.realpath(ROOT):
            shutil.rmtree(p, ignore_errors=True)
    try:
        os.remove(os.path.join(ROOT, 'mods.d', c['_conf']))
    except Exception:
        pass
    reg = STORE.kv('sword_bibles') or {}
    reg.pop(bible_code(c), None); STORE.set_kv('sword_bibles', reg)


# ------------------------------------------------------------------------------------------------
# turning SWORD markup (OSIS, ThML, GBF, TEI) into simple HTML, and into plain verse text
# ------------------------------------------------------------------------------------------------
def to_html(t, src='OSIS'):
    if not t:
        return ''
    src = (src or 'OSIS').upper()
    if src == 'GBF':
        t = re.sub(r'<RF>.*?<Rf>', '', t, flags=re.S); t = re.sub(r'<TS>(.*?)<Ts>', r'<h3>\1</h3>', t, flags=re.S)
        t = t.replace('<CM>', '<br><br>').replace('<CL>', '<br>'); t = re.sub(r'<FI>(.*?)<Fi>', r'<i>\1</i>', t, flags=re.S)
        t = re.sub(r'<(?!/?(?:h3|br|i)\b)[^>]{1,12}>', '', t)
        return t
    # notes and Strong's numbers are left out; the words stay
    t = re.sub(r'<note\b[^>]*/>', '', t)
    t = re.sub(r'<note\b.*?</note>', '', t, flags=re.S)
    t = re.sub(r'<(?:sync|milestone|lb\s+type="x-end-paragraph"|chapter|verse|div type="x-milestone")\b[^>]*/?>', ' ', t)
    t = re.sub(r'<lb\b[^>]*/?>', '<br>', t)
    t = re.sub(r'<title\b[^>]*>(.*?)</title>', r'<h3>\1</h3>', t, flags=re.S)
    t = re.sub(r'<head\b[^>]*>(.*?)</head>', r'<h3>\1</h3>', t, flags=re.S)
    t = re.sub(r'<divineName\b[^>]*>(.*?)</divineName>', lambda m: m.group(1).upper(), t, flags=re.S)
    t = re.sub(r'<hi\s+type="(?:italic|i)"[^>]*>(.*?)</hi>', r'<i>\1</i>', t, flags=re.S)
    t = re.sub(r'<hi\s+type="(?:bold|b)"[^>]*>(.*?)</hi>', r'<b>\1</b>', t, flags=re.S)
    t = re.sub(r'<(?:scripRef|reference)\b([^>]*)>(.*?)</(?:scripRef|reference)>', lambda m: ref_link(m.group(1), m.group(2)), t, flags=re.S)
    t = re.sub(r'<(?:/?)(?:w|transChange|seg|q|foreign|catchWord|rdg|abbr|name|span|font|sup|term|orth|pron|def|entryFree|sense|form|etym|gramGrp|pos|hi|added|unclear)\b[^>]*>', '', t)
    t = re.sub(r'</?(?:lg|l)\b[^>]*>', lambda m: '<br>' if m.group(0).startswith('</l') else '', t)
    t = re.sub(r'<div\b[^>]*/>', '', t)
    t = re.sub(r'<(/?)(?:div|list)\b[^>]*>', r'<\1div>', t)
    t = re.sub(r'<item\b[^>]*>', '<li>', t).replace('</item>', '</li>')
    t = re.sub(r'<(/?)(?:p|para)\b[^>]*>', r'<\1p>', t)
    t = re.sub(r'<(/?)h([1-6])\b[^>]*>', lambda m: '<%sh%s>' % (m.group(1), min(3, max(2, int(m.group(2))))), t)
    t = re.sub(r'<(?!/?(?:p|br|i|b|em|strong|h2|h3|li|ul|ol|div|a|blockquote|table|tr|td)\b)[^>]*>', '', t)
    return t


def ref_link(attrs, text):
    m = re.search(r'(?:osisRef|passage)\s*=\s*"([^"]+)"', attrs)
    ref = m.group(1) if m else text
    return '<a href="sword-ref:%s">%s</a>' % (html.escape(ref, quote=True), text)


def to_plain(t, src='OSIS'):
    h = to_html(t, src)
    h = re.sub(r'<h3>.*?</h3>', ' ', h, flags=re.S)
    h = re.sub(r'<[^>]+>', ' ', h)
    return re.sub(r'\s+', ' ', html.unescape(h)).strip()


# ------------------------------------------------------------------------------------------------
# reading the files
# ------------------------------------------------------------------------------------------------
def _path(c):
    p = (c.get('DataPath') or '').strip().lstrip('./')
    return os.path.join(ROOT, p)


def _dec(b, c):
    enc = (c.get('Encoding') or '').upper()
    try:
        return b.decode('utf-8' if enc in ('UTF-8', 'UTF8', '') and _utf8(b) else ('utf-8' if enc.startswith('UTF') else 'latin-1'))
    except Exception:
        return b.decode('latin-1', 'replace')


def _utf8(b):
    try:
        b.decode('utf-8'); return True
    except Exception:
        return False


def _unz(data, c):
    ct = (c.get('CompressType') or 'ZIP').upper()
    if ct == 'BZIP2':
        return bz2.decompress(data)
    if ct == 'XZ':
        return lzma.decompress(data)
    if ct == 'LZSS':
        raise ValueError('LZSS is not supported')
    return zlib.decompress(data)


class VerseModule:
    """Bibles and commentaries: one entry per verse"""
    def __init__(self, c):
        self.c = c
        self.base = _path(c)
        d = (c.get('ModDrv') or '').lower()
        self.z = d.startswith('z')
        self.four = d.endswith('4')
        self.src = c.get('SourceType') or ('GBF' if 'gbf' in d else 'OSIS')
        self.vs = v11n(c.get('Versification'))
        self.cache = {}
        bt = (c.get('BlockType') or 'CHAPTER').upper()
        self.letter = {'BOOK': 'b', 'CHAPTER': 'c', 'VERSE': 'v'}.get(bt, 'c')
        self.index = {}
        for t in ('ot', 'nt'):
            idx, n = {}, 2
            for osis, _name, chs in self.vs[t]:
                idx[osis] = n
                n += sum(chs) + len(chs) + 1
            self.index[t] = idx

    def books(self):
        """[(osis, name, chapters)] of the books this module has"""
        out = []
        for t in ('ot', 'nt'):
            if not os.path.exists(self._file(t, 'idx')):
                continue
            for osis, name, chs in self.vs[t]:
                out.append((osis, name, len(chs)))
        return out

    def _file(self, t, what):
        if self.z:
            return os.path.join(self.base, '%s.%sz%s' % (t, self.letter, {'idx': 'v', 'blk': 's', 'dat': 'z'}[what]))
        return os.path.join(self.base, t + ('.vss' if what == 'idx' else ''))

    def where(self, osis):
        for t in ('ot', 'nt'):
            for o, _n, chs in self.vs[t]:
                if o == osis:
                    return t, chs
        return None, None

    def get(self, osis, ch, v):
        t, chs = self.where(osis)
        if not t or ch < 1 or ch > len(chs) or v < 0 or v > chs[ch - 1]:
            return ''
        i = self.index[t][osis] + sum(chs[:ch - 1]) + (ch - 1) + 1 + v
        return self._read(t, i)

    def chapter(self, osis, ch):
        t, chs = self.where(osis)
        if not t or ch < 1 or ch > len(chs):
            return []
        return [(v, self.get(osis, ch, v)) for v in range(1, chs[ch - 1] + 1)]

    def _read(self, t, i):
        try:
            if self.z:
                rec = 12 if self.four else 10
                with open(self._file(t, 'idx'), 'rb') as f:
                    f.seek(i * rec); b = f.read(rec)
                if len(b) < rec:
                    return ''
                blk, start, size = struct.unpack('<III' if self.four else '<IIH', b)
                if size == 0:
                    return ''
                data = self._block(t, blk)
                return _dec(data[start:start + size], self.c)
            rec = 8 if self.four else 6
            with open(self._file(t, 'idx'), 'rb') as f:
                f.seek(i * rec); b = f.read(rec)
            if len(b) < rec:
                return ''
            start, size = struct.unpack('<II' if self.four else '<IH', b)
            if size == 0:
                return ''
            with open(self._file(t, 'dat'), 'rb') as f:
                f.seek(start); return _dec(f.read(size), self.c)
        except (FileNotFoundError, struct.error, zlib.error, OSError, ValueError, EOFError, lzma.LZMAError):
            return ''          # a damaged or missing entry: left out, the rest still reads

    def _block(self, t, blk):
        key = (t, blk)
        if key not in self.cache:
            with open(self._file(t, 'blk'), 'rb') as f:
                f.seek(blk * 12); off, size, _u = struct.unpack('<III', f.read(12))
            with open(self._file(t, 'dat'), 'rb') as f:
                f.seek(off); self.cache[key] = _unz(f.read(size), self.c)
            if len(self.cache) > 8:
                self.cache.pop(next(iter(self.cache)))
        return self.cache[key]


class LexModule:
    """dictionaries: one entry per word (zLD, RawLD, RawLD4)"""
    def __init__(self, c):
        self.c = c
        self.base = _path(c)
        d = (c.get('ModDrv') or '').lower()
        self.z = d.startswith('z'); self.four = d.endswith('4')
        self.src = c.get('SourceType') or 'ThML'
        self._keys = None
        self.blocks = {}

    def keys(self):
        if self._keys is None:
            out = []
            try:
                with open(self.base + '.idx', 'rb') as f:
                    idx = f.read()
                with open(self.base + '.dat', 'rb') as f:
                    dat = f.read()
            except FileNotFoundError:
                self._keys = []; return []
            rec = 8 if (self.z or self.four) else 6
            for n in range(len(idx) // rec):
                off, size = struct.unpack('<II' if rec == 8 else '<IH', idx[n * rec:(n + 1) * rec])
                end = dat.find(b'\n', off)
                key = _dec(dat[off:end if end >= 0 else off + 200].rstrip(b'\r'), self.c)
                out.append((key, off, size, end))
            self._keys = out
        return self._keys

    def names(self):
        return [k[0] for k in self.keys()]

    def get(self, n):
        key, off, size, end = self.keys()[n]
        with open(self.base + '.dat', 'rb') as f:
            if self.z:
                f.seek(end + 1); blk, entry = struct.unpack('<II', f.read(8))
                return self._zentry(blk, entry)
            f.seek(off); raw = f.read(size)
        nl = raw.find(b'\n')
        body = raw[nl + 1:] if nl >= 0 else raw
        if body.startswith(b'@LINK'):
            target = _dec(body[5:].strip(), self.c)
            i = self.find(target)
            return self.get(i) if i is not None and i != n else ''
        return _dec(body, self.c)

    def _zentry(self, blk, entry):
        if blk not in self.blocks:
            with open(self.base + '.zdx', 'rb') as f:
                f.seek(blk * 8); off, size = struct.unpack('<II', f.read(8))
            with open(self.base + '.zdt', 'rb') as f:
                f.seek(off); data = _unz(f.read(size), self.c)
            self.blocks[blk] = data
            if len(self.blocks) > 16:
                self.blocks.pop(next(iter(self.blocks)))
        data = self.blocks[blk]
        count = struct.unpack('<I', data[:4])[0]
        if entry >= count:
            return ''
        o, s = struct.unpack('<II', data[4 + entry * 8: 12 + entry * 8])
        return _dec(data[o:o + s].rstrip(b'\0'), self.c)

    def find(self, word):
        w = word.strip().upper()
        for i, k in enumerate(self.keys()):
            if k[0].strip().upper() == w:
                return i
        return None


class GenBook:
    """books with chapters (RawGenBook): a tree of headings, each with its text"""
    def __init__(self, c):
        self.c = c
        self.base = _path(c)
        self.src = c.get('SourceType') or 'ThML'
        with open(self.base + '.idx', 'rb') as f:
            self.idx = f.read()
        with open(self.base + '.dat', 'rb') as f:
            self.dat = f.read()

    def node(self, n):
        off = struct.unpack('<I', self.idx[n * 4:n * 4 + 4])[0]
        parent, nxt, first = struct.unpack('<iii', self.dat[off:off + 12])
        end = self.dat.index(b'\0', off + 12)
        name = _dec(self.dat[off + 12:end], self.c)
        ulen = struct.unpack('<H', self.dat[end + 1:end + 3])[0]
        user = self.dat[end + 3:end + 3 + ulen]
        return {'n': n, 'off': off, 'parent': parent, 'next': nxt, 'first': first, 'name': name, 'user': user}

    def children(self, n):
        """the headings under heading n (the links are places in the index file, 4 bytes each)"""
        out, seen = [], set()
        c = self.node(n)['first']
        total = len(self.idx) // 4
        while c is not None and c >= 0 and c not in seen and c // 4 < total:
            seen.add(c)
            k = self.node(c // 4); out.append(k); c = k['next']
        return out

    def text(self, n):
        u = self.node(n)['user']
        if len(u) < 8:
            return ''
        off, size = struct.unpack('<II', u[:8])
        with open(self.base + '.bdt', 'rb') as f:
            f.seek(off); return _dec(f.read(size), self.c)


def open_module(c):
    try:
        k = c.get('_kind') or kind(c)
        if k in ('bible', 'commentary'):
            return VerseModule(c)
        if k in ('dictionary', 'glossary', 'daily'):
            return LexModule(c)
        if k in ('book', 'map'):
            return GenBook(c)
    except Exception as e:
        print('sword open', c.get('_name'), e)
    return None


# ------------------------------------------------------------------------------------------------
# a CrossWire Bible becomes one of the app's Bibles (reading, search, compare, bookmarks all work)
# ------------------------------------------------------------------------------------------------
LANG_NAMES = {'en': 'English', 'ar': 'Arabic', 'el': 'Greek', 'grc': 'Greek', 'ru': 'Russian', 'zh': 'Chinese', 'fr': 'French', 'hi': 'Hindi', 'es': 'Spanish', 'tl': 'Tagalog'}


def to_store(c, step=None, cancelled=lambda: False):
    m = VerseModule(c)
    tr = bible_code(c)
    books = m.books()
    n = 0
    for order, (osis, name, nch) in enumerate(books):
        if cancelled():
            return
        rows = []
        for ch in range(1, nch + 1):
            for v, t in m.chapter(osis, ch):
                p = to_plain(t, m.src)
                if p:
                    rows.append({'chapter': ch, 'verse': v, 'text': html.escape(p, quote=False)})
        if rows:
            STORE.put_book(tr, OSIS2CODE.get(osis, osis.upper()), name, order, rows); n += 1
        if step:
            step(name)
    reg = STORE.kv('sword_bibles') or {}
    lg = (c.get('Lang') or 'en').split('-')[0]
    rtl = (c.get('Direction') or '').upper() == 'RTOL'
    reg[tr] = [LANG_NAMES.get(lg, lg), c.get('Description') or c['_name'], 'rtl' if rtl else 'ltr', c['_name']]
    STORE.set_kv('sword_bibles', reg)
    return n


def chapter_html(c, book_code, ch, v=None):
    """a commentary on a chapter (or on one verse), as simple HTML"""
    m = open_module(c)
    if not m:
        return ''
    osis = CODE2OSIS.get(book_code, book_code)
    parts, last = [], None
    for vv, t in (m.chapter(osis, ch) if v is None else [(v, m.get(osis, ch, v))]):
        if not t.strip() or t == last:
            continue
        last = t
        parts.append('<p><b>%d:%d</b></p>%s' % (ch, vv, to_html(t, m.src)))
    intro = m.get(osis, ch, 0) if v is None else ''
    if intro.strip():
        parts.insert(0, to_html(intro, m.src))
    return ''.join(parts)
