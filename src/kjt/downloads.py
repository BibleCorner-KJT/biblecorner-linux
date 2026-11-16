"""Fetching what the app keeps on this computer, in the background, with its progress."""
import json, threading
from concurrent.futures import ThreadPoolExecutor
PARALLEL = 4  # files fetched at the same time
from gi.repository import GLib
from .core import STORE, NET, LANGS, DEFAULT_BIBLES, info, write_file, read_file, lang

MAP_FILES = ['base.json', 'places.json', 'stories.json', 'words.json', 'chapters.json', 'ident.json']


class Downloader:
    def __init__(self):
        self.listeners = []
        self.busy = False
        self.stop = False
        self.done = self.total = 0
        self.what = ''
        self.errors = 0
        self.lock = threading.Lock()

    def listen(self, fn):
        self.listeners.append(fn)

    def tell(self):
        for fn in list(self.listeners):
            GLib.idle_add(lambda fn=fn: (fn(self), False)[1])

    def start(self, plan):
        """plan: {'bibles': [tr, ...], 'library': bool, 'commentary': bool, 'dict': [lang, ...], 'maps': bool, 'today': [lang, ...]}"""
        if self.busy:
            return
        self.busy, self.stop, self.done, self.total, self.errors = True, False, 0, 0, 0
        threading.Thread(target=self.run, args=(plan,), daemon=True).start()

    def step(self, what):
        with self.lock:
            self.done += 1; self.what = what
        self.tell()

    def run(self, plan):
        try:
            i = info(refresh=True)
            jobs = []
            for tr in plan.get('bibles', []):
                jobs.append(('bible', tr))
            if plan.get('dict'):
                jobs.append(('dict', plan['dict']))
            if plan.get('maps'):
                jobs.append(('maps', plan.get('dict') or [lang()]))
            if plan.get('library'):
                jobs.append(('library', None))
            if plan.get('commentary'):
                jobs.append(('commentary', i.get('commentary') or []))
            if plan.get('study', plan.get('commentary')):
                jobs.append(('study', i.get('commentary') or []))
            for lg in plan.get('today', []):
                jobs.append(('today', lg))
            self.total = len(jobs); self.tell()
            for kind, arg in jobs:
                if self.stop:
                    break
                try:
                    getattr(self, 'get_' + kind)(arg)
                except Exception as e:
                    self.errors += 1
                    print('download', kind, arg, e)
        finally:
            self.busy = False; self.what = ''
            STORE.set_kv('downloaded', STORE.kv('downloaded', 0) + 1)
            self.tell()

    # each kind
    def get_bible(self, tr):
        self.what = 'The Holy Bible · ' + tr; self.tell()
        r = NET.ajax('kjtb_data', op='books', tr=tr)
        books = (r.get('data') or []) if r.get('success') else []
        self.total += len(books); self.tell()
        def one(nb):
            n, b = nb
            if self.stop:
                return
            code = b['book_code']
            try:
                rr = NET.ajax('kjtb_data', op='offline_book', tr=tr, book=code)
            except Exception:
                rr = {}
            if rr.get('success'):
                STORE.put_book(tr, code, b.get('book') or code, n, rr['data'])
            else:
                self.errors += 1
            self.step('The Holy Bible · ' + tr + ' · ' + (b.get('book') or code))
        with ThreadPoolExecutor(PARALLEL) as ex:
            list(ex.map(one, enumerate(books)))
        self.step('The Holy Bible · ' + tr)

    def get_dict(self, langs):
        ls = sorted(set(['en'] + list(langs)))
        self.total += len(ls)
        for lg in ls:
            write_file('dictionary/%s.json' % lg, NET.file('dictionary/%s.json' % lg))
            self.step('Bible Dictionary · ' + lg)
        try:
            write_file('dictionary/people.json', NET.file('dictionary/people.json'))
        except Exception:
            self.errors += 1
        self.step('Bible Dictionary')

    def get_maps(self, langs):
        files = MAP_FILES + ['names-%s.json' % l for l in set(langs) if l != 'en'] + ['relief/overview.jpg'] + ['relief/t%d-%d.jpg' % (r, c) for r in range(3) for c in range(6)]
        self.total += len(files)
        def one(f):
            if self.stop:
                return
            try:
                write_file('maps/' + f, NET.file('maps/' + f))
            except Exception:
                self.errors += 1
            self.step('Bible Maps')
        with ThreadPoolExecutor(PARALLEL) as ex:
            list(ex.map(one, files))
        self.step('Bible Maps')

    def get_library(self, _):
        idx = json.loads(NET.file('library/index.json').decode('utf-8'))
        write_file('library/index.json', json.dumps(idx).encode())
        self.total += len(idx)
        def one(f):
            if self.stop:
                return
            try:
                write_file('library/%s.json.gz' % f['id'], NET.file('library/%s.json.gz' % f['id']))
            except Exception:
                self.errors += 1
            self.step('The Holy Fathers · ' + f['name'])
        with ThreadPoolExecutor(PARALLEL) as ex:
            list(ex.map(one, idx))
        self.step('The Holy Fathers')

    def get_commentary(self, books):
        self.total += len(books)
        def one(b):
            if self.stop:
                return
            try:
                write_file('fathers/%s.json.gz' % b, NET.file('fathers/%s.json.gz' % b))
            except Exception:
                self.errors += 1
            self.step('The Holy Fathers on the Bible · ' + b)
        with ThreadPoolExecutor(PARALLEL) as ex:
            list(ex.map(one, books))
        self.step('Commentary')

    def get_study(self, books):
        """for the reader: the cross-references of every verse, the Greek and Hebrew words, and the words of Christ in red"""
        from .core import OT, NT
        codes = OT + NT
        en = (STORE.kv('info') or {}).get('books', {}).get('en', {})
        files = ['xref/%s.json' % b for b in codes] + ['words/%s.json.gz' % b for b in codes] + ['words/lexicon.json.gz']
        files += ['../assets/red-letters/%s.json' % en[b] for b in NT if b in en]
        self.total += len(files)
        def one(f):
            if self.stop:
                return
            try:
                write_file(f.replace('../assets/', ''), NET.file(f))
            except Exception:
                pass  # not every book has every kind
            self.step('For the reader')
        with ThreadPoolExecutor(PARALLEL) as ex:
            list(ex.map(one, files))

    def get_today(self, lg):
        r = NET.ajax('kjtb_desk', op='today', lang=lg, days=62)
        if r.get('success'):
            STORE.set_kv('today_' + lg, r['data'])
        self.step('Today')


DL = Downloader()


def default_plan(langs, everything=True):
    return {'bibles': [DEFAULT_BIBLES[l] for l in langs if l in DEFAULT_BIBLES], 'dict': langs, 'maps': True,
            'library': everything, 'commentary': everything, 'today': langs}


def have_data():
    return bool(STORE.bibles())
