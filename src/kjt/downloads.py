"""Fetching what the app keeps on this computer: a queue of downloads, two at a time, each with its own progress."""
import json, threading, time
from concurrent.futures import ThreadPoolExecutor
from gi.repository import GLib
from .core import STORE, NET, LANGS, DEFAULT_BIBLES, info, write_file, read_file, lang, OT, NT

PARALLEL = 4   # files fetched at the same time, within one download
WORKERS = 2    # downloads running at the same time; the others wait their turn
MAP_FILES = ['base.json', 'places.json', 'stories.json', 'words.json', 'chapters.json', 'ident.json', 'world.json']


class Job:
    """one download: a Bible, the dictionary, the maps, the Holy Fathers ..."""
    def __init__(self, kind, arg, title):
        self.kind, self.arg, self.title = kind, arg, title
        self.done = self.total = self.errors = 0
        self.state = 'waiting'        # waiting · running · done · failed · cancelled
        self.what = ''
        self.cancel = False
        self.lock = threading.Lock()

    @property
    def key(self):
        return (self.kind, json.dumps(self.arg, sort_keys=True))

    def fraction(self):
        return 1.0 if self.state == 'done' else (self.done / self.total if self.total else 0.0)


class Downloader:
    def __init__(self):
        self.listeners = []
        self.jobs = []
        self.lock = threading.Lock()
        self.running = 0
        self.last_tell = 0

    # --- what the rest of the app reads ---
    @property
    def busy(self):
        return any(j.state in ('waiting', 'running') for j in self.jobs)

    @property
    def errors(self):
        return sum(j.errors for j in self.jobs if j.state != 'cancelled')

    @property
    def stop(self):
        return False

    @stop.setter
    def stop(self, v):
        if v:
            self.cancel_all()

    @property
    def done(self):
        return sum(j.done for j in self.jobs)

    @property
    def total(self):
        return sum(max(j.total, 1) for j in self.jobs)

    @property
    def what(self):
        r = [j for j in self.jobs if j.state == 'running']
        return ' · '.join(j.title for j in r)

    def listen(self, fn):
        self.listeners.append(fn)

    def tell(self, force=False):
        now = time.time()
        if not force and now - self.last_tell < 0.15:
            return
        self.last_tell = now
        for fn in list(self.listeners):
            GLib.idle_add(lambda fn=fn: (fn(self), False)[1])

    # --- adding to the queue ---
    def start(self, plan):
        """plan: {'bibles': [tr, ...], 'dict': [lang, ...], 'maps': bool, 'library': bool, 'commentary': bool, 'study': bool, 'today': [lang, ...]}
        each part becomes its own download in the queue (a part already waiting or running is not added twice)"""
        jobs = []
        for tr in plan.get('bibles', []):
            jobs.append(Job('bible', tr, 'The Holy Bible · ' + tr))
        if plan.get('dict'):
            jobs.append(Job('dict', sorted(set(plan['dict'])), 'Bible Dictionary'))
        if plan.get('maps'):
            jobs.append(Job('maps', sorted(set(plan.get('dict') or [lang()])), 'Bible Maps'))
        if plan.get('library'):
            jobs.append(Job('library', None, 'The Holy Fathers: their writings'))
        if plan.get('commentary'):
            jobs.append(Job('commentary', None, 'The Holy Fathers on the Bible'))
        if plan.get('study', plan.get('commentary')):
            jobs.append(Job('study', None, 'For the reader: cross-references, Greek and Hebrew'))
        for lg in plan.get('today', []):
            jobs.append(Job('today', lg, 'Today with God · ' + lg))
        for c in plan.get('sword', []):
            jobs.append(Job('sword', {k: v for k, v in c.items() if not k.startswith('_') or k in ('_name', '_source', '_kind')}, 'Library · ' + (c.get('Description') or c['_name'])))
        with self.lock:
            busy = {j.key for j in self.jobs if j.state in ('waiting', 'running')}
            # finished downloads leave the list when new ones come
            self.jobs = [j for j in self.jobs if j.state in ('waiting', 'running')]
            for j in jobs:
                if j.key not in busy:
                    self.jobs.append(j)
        self.tell(True)
        self.pump()

    def pump(self):
        with self.lock:
            while self.running < WORKERS:
                j = next((x for x in self.jobs if x.state == 'waiting'), None)
                if not j:
                    break
                j.state = 'running'; self.running += 1
                threading.Thread(target=self.run, args=(j,), daemon=True).start()

    def run(self, job):
        try:
            if job.kind in ('commentary', 'study'):
                job.arg = info(refresh=False).get('commentary') or []
            getattr(self, 'get_' + job.kind)(job, job.arg)
            job.state = 'cancelled' if job.cancel else ('done' if job.errors == 0 or job.done > job.errors else 'failed')
        except Exception as e:
            print('download', job.kind, job.arg, e)
            job.errors += 1; job.state = 'cancelled' if job.cancel else 'failed'
        finally:
            with self.lock:
                self.running -= 1
            STORE.set_kv('downloaded', (STORE.kv('downloaded', 0) or 0) + 1)
            self.tell(True)
            self.pump()

    def cancel(self, job):
        job.cancel = True
        if job.state == 'waiting':
            job.state = 'cancelled'
        self.tell(True)

    def cancel_all(self):
        for j in self.jobs:
            if j.state in ('waiting', 'running'):
                self.cancel(j)

    def retry(self, job):
        with self.lock:
            j = Job(job.kind, job.arg, job.title)
            self.jobs.append(j)
        self.tell(True); self.pump()

    def clear_finished(self):
        with self.lock:
            self.jobs = [j for j in self.jobs if j.state in ('waiting', 'running')]
        self.tell(True)

    # --- helpers for each kind ---
    def step(self, job, what=''):
        with job.lock:
            job.done += 1
            if what:
                job.what = what
        self.tell()

    def files(self, job, rels, label, dest=lambda f: f, quiet=False):
        job.total += len(rels); self.tell()
        def one(f):
            if job.cancel:
                return
            try:
                write_file(dest(f), NET.file(f))
            except Exception:
                if not quiet:
                    job.errors += 1
            self.step(job, label)
        with ThreadPoolExecutor(PARALLEL) as ex:
            list(ex.map(one, rels))

    # --- each kind ---
    def get_bible(self, job, tr):
        r = NET.ajax('kjtb_data', op='books', tr=tr)
        books = (r.get('data') or []) if r.get('success') else []
        if not books:
            job.errors += 1; return
        job.total += len(books); self.tell()
        def one(nb):
            n, b = nb
            if job.cancel:
                return
            code = b['book_code']
            try:
                rr = NET.ajax('kjtb_data', op='offline_book', tr=tr, book=code)
            except Exception:
                rr = {}
            if rr.get('success'):
                STORE.put_book(tr, code, b.get('book') or code, n, rr['data'])
            else:
                job.errors += 1
            self.step(job, b.get('book') or code)
        with ThreadPoolExecutor(PARALLEL) as ex:
            list(ex.map(one, enumerate(books)))

    def get_dict(self, job, langs):
        ls = sorted(set(['en'] + list(langs)))
        self.files(job, ['dictionary/%s.json' % lg for lg in ls] + ['dictionary/people.json'], 'Bible Dictionary')

    def get_maps(self, job, langs):
        files = MAP_FILES + ['names-%s.json' % l for l in set(langs) if l != 'en'] + ['relief/overview.jpg'] + ['relief/t%d-%d.jpg' % (r, c) for r in range(3) for c in range(6)]
        self.files(job, ['maps/' + f for f in files], 'Bible Maps')

    def get_library(self, job, _):
        idx = json.loads(NET.file('library/index.json').decode('utf-8'))
        write_file('library/index.json', json.dumps(idx).encode())
        try:   # the topics, eras and colours of the Holy Fathers page (the same as on the website)
            write_file('library/topics.json', NET.file('library/topics.json'))
        except Exception:
            pass
        self.files(job, ['library/%s.json.gz' % f['id'] for f in idx], 'The Holy Fathers')

    def get_commentary(self, job, books):
        self.files(job, ['fathers/%s.json.gz' % b for b in books], 'The Holy Fathers on the Bible')

    def get_study(self, job, _):
        """for the reader: the cross-references of every verse, the Greek and Hebrew words, and the words of Christ in red"""
        en = (STORE.kv('info') or {}).get('books', {}).get('en', {})
        files = ['xref/%s.json' % b for b in OT + NT] + ['words/%s.json.gz' % b for b in OT + NT] + ['words/lexicon.json.gz']
        files += ['../assets/red-letters/%s.json' % en[b] for b in NT if b in en]
        self.files(job, files, 'For the reader', dest=lambda f: f.replace('../assets/', ''), quiet=True)  # not every book has every kind

    def get_sword(self, job, c):
        """one book of the free libraries (CrossWire, AndBible); a Bible is also made one of the app's Bibles"""
        from . import sword
        job.total = 1; self.tell()
        def step(what):
            if job.total == 1:
                job.total = 1 + 90
            self.step(job, what)
        sword.install(c, step, lambda: job.cancel)
        self.step(job, 'done'); job.done = job.total
        self.tell(True)
        GLib.idle_add(lambda: (self.after_sword(), False)[1])

    def after_sword(self):
        for fn in self.sword_listeners:
            fn()

    sword_listeners = []

    def get_today(self, job, lg):
        job.total = 1
        r = NET.ajax('kjtb_desk', op='today', lang=lg, days=62)
        if r.get('success'):
            STORE.set_kv('today_' + lg, r['data'])
        else:
            job.errors += 1
        self.step(job, 'Today with God')


DL = Downloader()


def default_plan(langs, everything=True):
    return {'bibles': [DEFAULT_BIBLES[l] for l in langs if l in DEFAULT_BIBLES], 'dict': langs, 'maps': True,
            'library': everything, 'commentary': everything, 'today': langs}


def have_data():
    return bool(STORE.bibles())
