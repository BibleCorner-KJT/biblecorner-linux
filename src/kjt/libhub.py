"""2.27: the Library, in one place.
2.35: its first page is two columns, "On This Device" and "More Online" (two tabs on a phone): what is downloaded
moves from More Online to On This Device, what is deleted goes back. The pages of each library stay for links.

At the top, "On This Device": one page with everything kept on this computer (Bibles, Audio Bibles, Books,
The Church Fathers, Study tools, Games), its size, Delete, and "Update what is here".
Below it, the libraries, each with the same two tabs, "On This Device" and "Get more":
Bibles, Audio Bibles, Books (CrossWire and AndBible), The Church Fathers, Study tools.
The downloads show at the bottom of every page of the Library, each with its progress, Stop and Try again;
a stopped or interrupted download goes on from where it stopped."""
import json, os, shutil
from gi.repository import Gtk, Adw, GLib
from .core import STORE, SET, NET, FILES, DATA, lang, read_file, run_bg, book_name
from .i18n import _
from .downloads import DL

CATS = [('bibles', 'Bibles', 'kjt-bible-symbolic', 'Read and search without the internet'),
        ('audio', 'Audio Bibles', 'kjt-listen-symbolic', 'Listen without the internet'),
        ('books', 'Books', 'kjt-library-symbolic', 'Commentaries, dictionaries and books from CrossWire and AndBible'),
        ('fathers', 'The Church Fathers', 'kjt-cross-symbolic', 'Their writings, to read like books'),
        ('study', 'Study tools', 'kjt-dict-symbolic', 'Bible Dictionary, Bible Maps, the Fathers on each chapter, Greek and Hebrew')]
NAMES = dict((c[0], c[1]) for c in CATS)
KINDS = {'commentary': 'Commentary', 'dictionary': 'Dictionary', 'glossary': 'Glossary', 'daily': 'Daily readings', 'book': 'Book', 'map': 'Map', 'bible': 'Bible'}
STUDY = [('dict', 'Bible Dictionary', 'Every entry, and every place of the maps', 'dictionary', 'kjt-dict-symbolic'),
         ('maps', 'Bible Maps', 'The land in its real colours, the places and the story maps', 'maps', 'kjt-map-symbolic'),
         ('commentary', 'The Church Fathers on the Bible', 'Their commentary beside each chapter', 'fathers', 'kjt-cross-symbolic'),
         ('study', 'For the reader', 'Cross-references, the Greek and Hebrew words, the words of Christ in red', 'xref', 'kjt-bible-symbolic')]
MAIN_LANGS = ['English', 'Arabic', 'Greek', 'Ancient Greek', 'Russian', 'Church Slavonic', 'Chinese', 'French', 'Hindi', 'Spanish', 'Tagalog', 'Filipino']


def size_of(path):
    t = 0
    for root, _d, files in os.walk(path):
        for f in files:
            try:
                t += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return t


def mb(n):
    return ('%.1f GB' % (n / 1e9)) if n >= 1e9 else ('%.0f MB' % (n / 1e6)) if n > 1e6 else ('%.0f KB' % (n / 1e3))


def esc(s):
    return GLib.markup_escape_text(s or '')


# ---------------------------------------------------------------- what is on this computer
def here_bibles():
    from .bible import bible_name
    return sorted(STORE.bibles(), key=lambda t: bible_name(t).casefold())


def has_mp3(p):
    return any(fn.endswith('.mp3') for _r, _d, fs in os.walk(p) for fn in fs)


def here_audio():
    a = os.path.join(FILES, 'audio')
    return sorted(f for f in (os.listdir(a) if os.path.isdir(a) else []) if os.path.isdir(os.path.join(a, f)) and has_mp3(os.path.join(a, f)))


def here_books():
    try:
        from . import sword
        return [c for c in sword.installed() if c['_kind'] != 'bible']
    except Exception:
        return []


def fathers_index():
    try:
        return json.loads(read_file('library/index.json', as_json=False) or b'[]')
    except Exception:
        return []


def here_works(idx=None):
    lp = os.path.join(FILES, 'library')
    return [w for w in (idx if idx is not None else fathers_index()) if os.path.exists(os.path.join(lp, w['id'] + '.json.gz'))]


def folder_here(folder):
    p = os.path.join(FILES, folder)
    return os.path.isdir(p) and any(os.scandir(p))


def here_study():
    return [s for s in STUDY if folder_here(s[3])]


def games_size():
    try:
        from . import sitecache
        return sitecache.kept_size()
    except Exception:
        return 0


def here_counts():
    return {'bibles': len(STORE.bibles()), 'audio': len(here_audio()), 'books': len(here_books()), 'fathers': len(here_works()),
            'study': len(here_study()), 'games': 1 if games_size() > 2 * 1048576 else 0}


def used_space():
    tot = size_of(FILES) + sum(os.path.getsize(os.path.join(DATA, f)) for f in ('kjt.db', 'kjt.db-wal') if os.path.exists(os.path.join(DATA, f)))
    try:
        free = shutil.disk_usage(FILES if os.path.isdir(FILES) else DATA).free
    except OSError:
        free = 0
    return tot, free


def book_title(code, tr):
    try:
        return book_name(code, tr=tr)
    except Exception:
        return code


class _Rows:
    """collects the rows of one kind, to show 5 of a long list first"""
    def __init__(self):
        self.rows = []

    def add(self, r):
        self.rows.append(r)


# ---------------------------------------------------------------- the downloads, at the bottom
class DownloadBar(Gtk.Revealer):
    def __init__(self):
        super().__init__(transition_type=Gtk.RevealerTransitionType.SLIDE_UP)
        self.add_css_class('kjt-dlbar')
        self.list = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE); self.list.add_css_class('boxed-list')
        w = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_start=12, margin_end=12, margin_top=8, margin_bottom=8)
        head = Gtk.Box(spacing=6); self.title = Gtk.Label(xalign=0, hexpand=True, css_classes=['heading']); head.append(self.title)
        self.stop_btn = Gtk.Button(label=_('Stop all')); self.stop_btn.add_css_class('flat'); self.stop_btn.connect('clicked', lambda *_a: DL.cancel_all()); head.append(self.stop_btn)
        self.clear_btn = Gtk.Button(label=_('Clear the list')); self.clear_btn.add_css_class('flat'); self.clear_btn.connect('clicked', lambda *_a: DL.clear_finished()); head.append(self.clear_btn)
        w.append(head)
        sc = Gtk.ScrolledWindow(hscrollbar_policy=Gtk.PolicyType.NEVER, propagate_natural_height=True, max_content_height=220); sc.set_child(self.list); w.append(sc)
        sep = Gtk.Box(orientation=Gtk.Orientation.VERTICAL); sep.append(Gtk.Separator()); sep.append(w)
        self.set_child(sep)
        self.rows = {}
        DL.listen(self.update)

    def update(self, dl):
        jobs = list(dl.jobs)
        failed = [j for j in jobs if j.state == 'failed']
        if not dl.busy and not failed and jobs:
            GLib.idle_add(lambda: (DL.clear_finished(), False)[1])
        self.set_reveal_child(bool(dl.busy or failed))
        running = sum(1 for j in jobs if j.state == 'running'); waiting = sum(1 for j in jobs if j.state == 'waiting')
        self.title.set_label((_('Downloading') + ' · %d%%' % int(100 * overall(dl)) + (' · ' + _('waiting') + ' %d' % waiting if waiting else '')) if dl.busy else _('Some downloads did not finish'))
        self.stop_btn.set_visible(dl.busy); self.clear_btn.set_visible(not dl.busy)
        for key in list(self.rows):
            if all(id(j) != key for j in jobs):
                self.list.remove(self.rows.pop(key)['row'])
        for j in jobs:
            r = self.rows.get(id(j))
            if not r:
                row = Adw.ActionRow(title=esc(translate_title(j.title)))
                bar = Gtk.ProgressBar(valign=Gtk.Align.CENTER, hexpand=True); bar.set_size_request(120, -1)
                btn = Gtk.Button(valign=Gtk.Align.CENTER); btn.add_css_class('flat')
                btn.connect('clicked', lambda b, j=j: DL.cancel(j) if j.state in ('waiting', 'running') else DL.retry(j))
                row.add_suffix(bar); row.add_suffix(btn)
                self.list.append(row)
                r = self.rows[id(j)] = {'row': row, 'bar': bar, 'btn': btn}
            st = {'waiting': _('Waiting its turn'),
                  'running': ('%d%% · %d / %d%s' % (int(100 * j.fraction()), j.done, j.total, (' · ' + j.what) if j.what else '')) if j.total else _('Starting…'),
                  'done': _('Done') + (' (%d %s)' % (j.errors, _('not found')) if j.errors else ''),
                  'failed': _('Could not be downloaded: try again'), 'cancelled': _('Stopped')}[j.state]
            r['row'].set_subtitle(esc(st))
            r['bar'].set_fraction(j.fraction()); r['bar'].set_visible(j.state in ('running', 'done'))
            r['btn'].set_icon_name('kjt-close-symbolic' if j.state in ('waiting', 'running') else 'kjt-refresh-symbolic')
            r['btn'].set_tooltip_text(_('Stop') if j.state in ('waiting', 'running') else _('Try again'))
            r['btn'].set_visible(j.state != 'done' or j.errors > 0)


def overall(dl):
    js = [j for j in dl.jobs if j.state in ('waiting', 'running', 'done')]
    return (sum(j.fraction() for j in js) / len(js)) if js else 0.0


def translate_title(t):
    """'The Holy Bible · KJV' → each part in the language of the app"""
    return ' · '.join(_(p) for p in (t or '').split(' · '))


# ---------------------------------------------------------------- the Library
class LibHub(Gtk.Box):
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win
        self.nav = Adw.NavigationView(); self.nav.set_vexpand(True); self.append(self.nav)
        self.bar = DownloadBar(); self.append(self.bar)
        self.books = None
        self.subs = {}          # tag -> {'fill': fn}
        self.was_busy = False
        # 2.35: the first page is two columns, "On This Device" and "More Online": what you download moves from
        # the right column to the left one; what you delete goes back. On a phone: the same two lists as two tabs.
        tv = Adw.ToolbarView(); hb = Adw.HeaderBar(); tv.add_top_bar(hb); win.sidebar_button(hb)
        hb.set_title_widget(Adw.WindowTitle(title=_('Library'), subtitle=_('Everything here is free')))
        self.search = Gtk.SearchEntry(placeholder_text=_('Find'), width_chars=12); hb.pack_end(self.search)
        self.search.connect('search-changed', lambda *_a: self.refresh_home())
        self.hst = {'mode': 'home', 'q': self.search}
        self.tab = 'here'
        self.tabrow = Gtk.Box(margin_start=10, margin_end=10, margin_top=6, margin_bottom=2, homogeneous=True, visible=False); self.tabrow.add_css_class('linked')
        self.t_here = Gtk.ToggleButton(active=True); self.t_more = Gtk.ToggleButton(group=self.t_here)
        self.t_here.connect('toggled', lambda b: b.get_active() and self.set_tab('here'))
        self.t_more.connect('toggled', lambda b: b.get_active() and self.set_tab('more'))
        self.tabrow.append(self.t_here); self.tabrow.append(self.t_more); tv.add_top_bar(self.tabrow)
        self.cols = Gtk.Box(homogeneous=True, vexpand=True)
        self.left = Adw.PreferencesPage(); self.right = Adw.PreferencesPage(); self.left_groups = []; self.right_groups = []
        self.lcol = Gtk.Box(orientation=Gtk.Orientation.VERTICAL); self.rcol = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        self.lhead = Gtk.Label(xalign=0, margin_start=24, margin_top=14, css_classes=['title-3']); self.rhead = Gtk.Label(xalign=0, margin_start=24, margin_top=14, css_classes=['title-3'])
        self.lcol.append(self.lhead); self.lcol.append(self.left); self.rcol.append(self.rhead); self.rcol.append(self.right)
        self.left.set_vexpand(True); self.right.set_vexpand(True)
        self.cols.append(self.lcol); self.cols.append(Gtk.Separator(orientation=Gtk.Orientation.VERTICAL)); self.cols.append(self.rcol)
        self.cols.set_homogeneous(False); self.lcol.set_hexpand(True); self.rcol.set_hexpand(True)
        tv.set_content(self.cols)
        self.nav.add(Adw.NavigationPage(title=_('Library'), child=tv, tag='home'))
        self.nav.connect('popped', lambda *_a: GLib.idle_add(self.refresh_home))
        self.compact = False
        self.dl_sig = None; self.dl_bars = {}
        DL.listen(self.on_dl)
        self.dev_row = None

    def set_compact(self, c):
        self.compact = c
        self.tabrow.set_visible(c)
        self.search.set_width_chars(5 if c else 12)
        self.lhead.set_visible(not c); self.rhead.set_visible(not c)
        self.cols.get_first_child().get_next_sibling().set_visible(not c)
        self.set_tab(self.tab)

    def set_tab(self, t):
        self.tab = t
        self.lcol.set_visible(not self.compact or t == 'here')
        self.rcol.set_visible(not self.compact or t == 'more')
        (self.t_here if t == 'here' else self.t_more).set_active(True)

    # ---------- the first page
    def refresh(self):
        self.refresh_home()
        top = self.nav.get_visible_page()
        tag = top.get_tag() if top else None
        if tag in self.subs:
            self.subs[tag]['fill']()

    def refresh_home(self):
        for g in self.left_groups:
            self.left.remove(g)
        for g in self.right_groups:
            self.right.remove(g)
        self.left_groups = []; self.right_groups = []; self.dl_bars = {}
        def addl(g):
            self.left.add(g); self.left_groups.append(g)
        def addr(g):
            self.right.add(g); self.right_groups.append(g)
        have = self.fill_device(addl, self.hst)
        self.fill_online(addr, self.hst)
        self.lhead.set_label(_('On This Device')); self.rhead.set_label(_('More Online'))
        self.t_here.set_label(_('On This Device') + (' · %d' % have if have else '')); self.t_more.set_label(_('More Online'))
        for b in (self.t_here, self.t_more):
            if isinstance(b.get_child(), Gtk.Label):
                b.get_child().set_ellipsize(3)
        self.dl_sig = self.sig(DL)
        return False

    def sig(self, dl):
        return tuple((id(j), j.state) for j in dl.jobs)

    def on_dl(self, dl):
        busy = dl.busy
        # something started, finished or stopped: both columns again (what finished moves to On This Device)
        s = self.sig(dl)
        if s != self.dl_sig:
            self.dl_sig = s
            GLib.idle_add(self.refresh_home)
        else:
            for j in dl.jobs:
                b = self.dl_bars.get(id(j))
                if b:
                    try:
                        b[0].set_fraction(j.fraction()); b[1].set_subtitle(esc(('%d%%' % int(100 * j.fraction())) if j.total else _('Starting…')))
                    except Exception:
                        pass
        if self.was_busy and not busy:
            GLib.idle_add(lambda: (self.refresh(), False)[1])
        self.was_busy = busy

    # ---------- pages pushed from here
    def push(self, tag, title, sub, fill, tabs=False, search=False, end=None):
        """a page of the Library: its header (with ← back), optional tabs and search, and its content"""
        tv = Adw.ToolbarView(); hb = Adw.HeaderBar(); tv.add_top_bar(hb)
        wt = Adw.WindowTitle(title=_(title), subtitle=sub or ''); hb.set_title_widget(wt)
        st = {'mode': 'here', 'q': None, 'wt': wt}
        body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        if tabs:
            tb = Gtk.Box(halign=Gtk.Align.CENTER, margin_top=8, margin_bottom=4); tb.add_css_class('linked')
            th = Gtk.ToggleButton(label=_('On This Device'), active=True); tg = Gtk.ToggleButton(label=_('Get more'), group=th)
            th.connect('toggled', lambda b: b.get_active() and (st.__setitem__('mode', 'here'), refill()))
            tg.connect('toggled', lambda b: b.get_active() and (st.__setitem__('mode', 'get'), refill()))
            tb.append(th); tb.append(tg); body.append(tb); st['tg'] = tg; st['th'] = th
        if search:
            q = Gtk.SearchEntry(placeholder_text=_('Find'), width_chars=14); hb.pack_end(q); st['q'] = q
            q.connect('search-changed', lambda *_a: refill())
        if end:
            hb.pack_end(end)
        pp = Adw.PreferencesPage(vexpand=True); body.append(pp); tv.set_content(body)
        st['page'] = pp; st['groups'] = []
        def refill():
            for gg in st['groups']:
                pp.remove(gg)
            st['groups'] = []
            def add(gg):
                pp.add(gg); st['groups'].append(gg)
            fill(add, st)
        self.subs[tag] = {'fill': refill, 'st': st}
        self.nav.push(Adw.NavigationPage(title=_(title), child=tv, tag=tag))
        refill()
        return st

    def open_device(self):
        self.push('device', 'On This Device', '', self.fill_device)

    def open_cat(self, key, mode='here'):
        if key == 'books':
            return self.open_books(mode)
        title = NAMES[key]
        st = self.push('cat-' + key, title, '', lambda add, st, key=key: self.fill_cat(key, add, st), tabs=True, search=key in ('bibles', 'audio', 'fathers'))
        if mode == 'get':
            st['tg'].set_active(True)

    def open_books(self, mode='here', kind=None):
        from .library import LibraryPage
        if self.books is None:
            self.books = LibraryPage(self.win, back=lambda: self.nav.pop())
        if self.books.get_parent() is not None:
            self.books.get_parent().set_child(None)
        if self.nav.get_visible_page().get_tag() != 'books':
            self.nav.push(Adw.NavigationPage(title=_('Books'), child=self.books, tag='books'))
        if kind:
            self.books.show_kind(kind)
        elif mode == 'get':
            self.books.t_get.set_active(True)
        else:
            self.books.refresh()
        return self.books

    def open_href(self, href):
        self.open_books().open_href(href)

    # ---------- helpers
    def btn(self, icon, tip, fn):
        b = Gtk.Button(icon_name=icon, tooltip_text=tip, valign=Gtk.Align.CENTER); b.add_css_class('flat')
        b.connect('clicked', lambda *_a: fn()); return b

    def get_btn(self, plan, label=None):
        b = Gtk.Button(label=label or _('Download'), valign=Gtk.Align.CENTER); b.add_css_class('pill'); b.add_css_class('kjt-lib-get')
        b.connect('clicked', lambda *_a: self.get(plan)); return b

    def get(self, plan):
        if not NET.online():
            self.win.toast(_('Downloading needs the internet')); return
        DL.start(plan); self.win.toast(_('Downloading…'))

    def ask_delete(self, what, fn):
        d = Adw.AlertDialog(heading=_('Delete from this computer?'), body=what + '\n\n' + _('You can download it again at any time.'))
        d.add_response('no', _('Cancel')); d.add_response('yes', _('Delete')); d.set_response_appearance('yes', Adw.ResponseAppearance.DESTRUCTIVE)
        d.connect('response', lambda _d, r: (fn(), self.refresh()) if r == 'yes' else None); d.present(self.win)

    def more_row(self, key, text=None):
        r = Adw.ActionRow(title=esc(text or _('Get more')), activatable=True); r.add_prefix(Gtk.Image(icon_name='folder-download-symbolic'))
        r.add_suffix(Gtk.Image(icon_name='go-next-symbolic')); r.add_css_class('kjt-lib-more')
        r.connect('activated', lambda *_a: self.open_cat(key, 'get')); return r

    def none_row(self, text):
        r = Adw.ActionRow(title=esc(text)); r.add_css_class('dim-label'); r.add_css_class('kjt-lib-none'); return r

    # ---------- the two columns
    def short(self, g, rows, first=5):
        """a long list shows 5 and "Show all (N)" """
        for r in rows[:first] if len(rows) > first + 1 else rows:
            g.add(r)
        if len(rows) > first + 1:
            more = Adw.ButtonRow(title=_('Show all') + ' (%d)' % len(rows)) if hasattr(Adw, 'ButtonRow') else Adw.ActionRow(title=_('Show all') + ' (%d)' % len(rows), activatable=True)
            def show_all(*_a, g=g, rows=rows, more=more):
                g.remove(more)
                for r in rows[first:]:
                    g.add(r)
            more.connect('activated', show_all); g.add(more)

    def fill_device(self, add, st):
        """On This Device: the space and "Update everything here", what is downloading now, then what is here, by kind.
        Returns how many things are here."""
        tot, free = used_space(); have = 0; groups = []
        for key, title, icon, _sub in CATS + [('games', 'Games', 'kjt-fun-symbolic', '')]:
            c = _Rows()
            n = self.games_row(c, device=True) if key == 'games' else getattr(self, 'here_' + key)(c, st, flat=True)
            if not n:
                continue
            have += n
            g = Adw.PreferencesGroup(title='%s  ·  %d' % (_(title), n))
            self.short(g, c.rows)
            groups.append(g)
        # the summary
        g = Adw.PreferencesGroup()
        row = Adw.ActionRow(title='<b>%s</b>' % esc('%d %s' % (have, _('items'))), use_markup=True,
                            subtitle=esc(_('Space used') + ': ' + mb(tot) + ((' · ' + _('free') + ': ' + mb(free)) if free else '')))
        row.add_prefix(Gtk.Image(icon_name='drive-harddisk-symbolic', pixel_size=32))
        if have:
            up = Gtk.Button(icon_name='kjt-refresh-symbolic', valign=Gtk.Align.CENTER, tooltip_text=_('Update everything here') + '\n' + _('Fetches the newest corrections of the Bibles and books already on this computer. Nothing new is added.'))
            up.add_css_class('flat'); up.connect('clicked', lambda *_a: self.update_here()); row.add_suffix(up)
        g.add(row)
        if free:
            lb = Gtk.LevelBar(min_value=0, max_value=1, value=min(1.0, tot / float(tot + free)), margin_top=6, margin_bottom=2)
            lb.remove_offset_value('low'); lb.remove_offset_value('high'); lb.remove_offset_value('full'); g.add(lb)
        add(g)
        # what is coming now: it shows here at once, with its progress
        jobs = [j for j in DL.jobs if j.state in ('waiting', 'running')]
        if jobs:
            g = Adw.PreferencesGroup(title=_('Downloading'))
            for j in jobs:
                r = Adw.ActionRow(title=esc(translate_title(j.title)), subtitle=esc(_('Waiting its turn') if j.state == 'waiting' else ('%d%%' % int(100 * j.fraction())) if j.total else _('Starting…')))
                bar = Gtk.ProgressBar(valign=Gtk.Align.CENTER, fraction=j.fraction()); bar.set_size_request(80, -1); r.add_suffix(bar)
                stop = self.btn('kjt-close-symbolic', _('Stop'), lambda j=j: DL.cancel(j)); r.add_suffix(stop)
                g.add(r); self.dl_bars[id(j)] = (bar, r)
            add(g)
        for g in groups:
            add(g)
        if not have and not jobs:
            g = Adw.PreferencesGroup(); g.add(self.none_row(_('Nothing on this device yet'))); add(g)
        return have

    def fill_online(self, add, st):
        """More Online: everything not on this device yet, by kind; Download moves it to On This Device"""
        shown = 0
        if not NET.online():
            g = Adw.PreferencesGroup(); g.add(self.none_row(_('The list comes with the internet.'))); add(g)
        for key, title, icon, _sub in CATS + [('games', 'Games', 'kjt-fun-symbolic', '')]:
            c = _Rows(); extra = []
            if key == 'games':
                if games_size() > 2 * 1048576:
                    continue
                self.games_row(c)
            elif key == 'books':
                r = Adw.ActionRow(title=esc(_('Books')), subtitle=esc(_(_sub)), activatable=True); r.set_subtitle_lines(2)
                r.add_prefix(Gtk.Image(icon_name=icon)); r.add_suffix(Gtk.Image(icon_name='go-next-symbolic'))
                r.connect('activated', lambda *_a: self.open_books('get')); c.add(r)
            else:
                getattr(self, 'get_' + key)(c, st, extra.append)
            rows = [r for r in c.rows if 'kjt-lib-none' not in r.get_css_classes()]
            if not rows and not extra:
                continue
            g = Adw.PreferencesGroup(title=_(title))
            self.short(g, rows)
            for x in extra:          # e.g. "More Bibles from CrossWire and AndBible"
                r = x.get_row(0) if hasattr(x, 'get_row') else None
                ch = x
                rr = []
                # move the rows of that small group into this one
                lb = None
                def walk(w):
                    nonlocal lb
                    if isinstance(w, Gtk.ListBox):
                        lb = w; return
                    k = w.get_first_child()
                    while k and lb is None:
                        walk(k); k = k.get_next_sibling()
                walk(ch)
                if lb is not None:
                    k = lb.get_first_child()
                    while k:
                        nx = k.get_next_sibling(); rr.append(k); k = nx
                    for r in rr:
                        ch.remove(r); g.add(r)
            add(g); shown += 1
        if not shown:
            g = Adw.PreferencesGroup(); g.add(self.none_row('✓ ' + _('Everything is on this device'))); add(g)

    # ---------- a library: On This Device | Get more
    def fill_cat(self, key, add, st):
        g = Adw.PreferencesGroup()
        if st['mode'] == 'here':
            n = getattr(self, 'here_' + key)(g, st)
            if not n:
                g.add(self.none_row(_('Nothing on this device yet')))
                g.add(self.more_row(key))
            add(g)
        else:
            getattr(self, 'get_' + key)(g, st, add)
            add(g)

    def q(self, st):
        return ((st.get('q').get_text() if st.get('q') else '') or '').strip().casefold()

    # Bibles
    def here_bibles(self, g, st, flat=False):
        from .bible import bible_name
        vers = (STORE.kv('info') or {}).get('versions') or {}
        books_of = dict(STORE.bible_size()); q = self.q(st); n = 0
        for tr in here_bibles():
            if q and q not in bible_name(tr).casefold():
                continue
            row = Adw.ActionRow(title=esc(bible_name(tr)), subtitle=esc('✓ %d %s' % (books_of.get(tr, 0), _('books'))), activatable=True, tooltip_text=_('Read'))
            row.connect('activated', lambda *_a, tr=tr: self.read_bible(tr))
            row.add_suffix(self.btn('user-trash-symbolic', _('Delete from this computer'), lambda tr=tr: self.ask_delete(bible_name(tr), lambda: self.remove_bible(tr))))
            row.add_suffix(Gtk.Image(icon_name='go-next-symbolic'))
            g.add(row); n += 1
        return n

    def read_bible(self, tr):
        b = self.win.bible
        if hasattr(b, 'set_tr'):
            b.set_tr(tr)
        self.win.show('bible')

    def get_bibles(self, g, st, add):
        vers = (STORE.kv('info') or {}).get('versions') or {}; have = set(STORE.bibles()); q = self.q(st)
        by_lang = {}
        for tr, v in vers.items():
            if tr not in have and (not q or q in (v[1] or '').casefold() or q in (v[0] or '').casefold() or q in _(v[0]).casefold()):
                by_lang.setdefault(v[0], []).append((tr, v))
        if not vers:
            g.add(self.none_row(_('The list of Bibles to download comes with the internet.')))
        for lg in sorted(by_lang, key=lambda x: (MAIN_LANGS.index(x) if x in MAIN_LANGS else 99, x)):
            ex = Adw.ExpanderRow(title=esc(_(lg)), subtitle='%d' % len(by_lang[lg])); ex.add_css_class('kjt-lib-lang')
            if q or lg == ({'en': 'English', 'ar': 'Arabic', 'el': 'Greek', 'ru': 'Russian', 'fr': 'French', 'es': 'Spanish', 'zh': 'Chinese', 'hi': 'Hindi', 'tl': 'Tagalog'}).get(lang()):
                ex.set_expanded(True)
            for tr, v in sorted(by_lang[lg], key=lambda x: x[1][1]):
                row = Adw.ActionRow(title=esc(v[1])); row.add_suffix(self.get_btn({'bibles': [tr]})); ex.add_row(row)
            g.add(ex)
        g2 = Adw.PreferencesGroup()
        r = Adw.ActionRow(title=esc(_('More Bibles from CrossWire and AndBible')), subtitle=esc(_('Hundreds of Bibles in many languages')), activatable=True)
        r.add_prefix(Gtk.Image(icon_name='kjt-library-symbolic')); r.add_suffix(Gtk.Image(icon_name='go-next-symbolic'))
        r.connect('activated', lambda *_a: self.open_books('get', kind='bible')); g2.add(r); add(g2)

    def remove_bible(self, tr):
        if len(STORE.bibles()) <= 1:
            self.win.toast(_('Keep at least one Bible')); return
        try:
            from . import sword
            c = next((c for c in sword.installed() if sword.bible_code(c) == tr), None)
        except Exception:
            c = None
        if c:
            sword.remove(c)
        else:
            STORE.delete_bible(tr)
        if SET.get('tr') == tr:
            SET.set('tr', STORE.bibles()[0])
        self.win.toast(_('Deleted'))

    # Audio Bibles
    def here_audio(self, g, st, flat=False):
        from .bible import bible_name
        a = os.path.join(FILES, 'audio'); q = self.q(st); n = 0
        for f in here_audio():
            p = os.path.join(a, f); tr, _s, track = f.partition('_')
            name = bible_name(tr) + (' · ' + _('With music') if track == 'music' else (' · ' + track if track else ''))
            if q and q not in name.casefold():
                continue
            bk = sorted(b for b in os.listdir(p) if os.path.isdir(os.path.join(p, b)) and any(x.endswith('.mp3') for x in os.listdir(os.path.join(p, b))))
            nch = sum(len([x for x in os.listdir(os.path.join(p, b)) if x.endswith('.mp3')]) for b in bk)
            ex = Adw.ExpanderRow(title=esc(name), subtitle=esc('✓ %d %s · %d %s · %s' % (len(bk), _('books'), nch, _('chapters'), mb(size_of(p)))))
            ex.add_suffix(self.btn('user-trash-symbolic', _('Delete all of these recordings'), lambda p=p, name=name: self.ask_delete(name, lambda: shutil.rmtree(p, ignore_errors=True))))
            for b in bk:
                bp = os.path.join(p, b); nn = len([x for x in os.listdir(bp) if x.endswith('.mp3')])
                row = Adw.ActionRow(title=esc(book_title(b, tr)), subtitle='%d %s · %s' % (nn, _('chapters'), mb(size_of(bp))))
                row.add_suffix(self.btn('user-trash-symbolic', _('Delete from this computer'), lambda bp=bp, b=b, tr=tr: self.ask_delete(book_title(b, tr), lambda: shutil.rmtree(bp, ignore_errors=True))))
                ex.add_row(row)
            g.add(ex); n += 1
        return n

    def get_audio(self, g, st, add):
        al = getattr(self, 'audio_list', None)
        if al is None:
            g.add(self.none_row(_('Loading…') if NET.online() else _('The list comes with the internet.')))
            if NET.online() and not getattr(self, 'audio_asking', False):
                self.audio_asking = True
                def work():
                    r = NET.ajax('kjtb_audio_list')
                    return r.get('data') if r.get('success') else []
                def done(d):
                    self.audio_asking = False; self.audio_list = d if isinstance(d, list) else []
                    s = self.subs.get('cat-audio')
                    if s and s['st']['mode'] == 'get':
                        s['fill']()
                    self.refresh_home()
                run_bg(work, done)
            return
        if not al:
            g.add(self.none_row(_('No recordings to download now.'))); return
        q = self.q(st); a = os.path.join(FILES, 'audio')
        for x in al:
            for t in x['tracks']:
                name = x['name'] + ((' · ' + _(t['label'])) if len(x['tracks']) > 1 or t['id'] else '')
                if q and q not in name.casefold() and q not in _(x.get('lang') or '').casefold():
                    continue
                folder = x['tr'] + ('_' + t['id'] if t['id'] else '')
                tr_here = next((h for h in STORE.bibles() if h == x['tr']), x['tr'])
                def kept(b, folder=folder):
                    p = os.path.join(a, folder, b)
                    return len([f for f in os.listdir(p) if f.endswith('.mp3')]) if os.path.isdir(p) else 0
                books = t['books']; nk = sum(1 for b in books if kept(b) >= len(books[b]['ch']))
                ex = Adw.ExpanderRow(title=esc(name), subtitle=esc('%d %s · %s' % (len(books), _('book') if len(books) == 1 else _('books'), mb(t['bytes'])) + (' · ✓ %d %s' % (nk, _('on this device')) if nk else '')))
                todo = {b: books[b]['ch'] for b in books if kept(b) < len(books[b]['ch'])}
                if todo:
                    plan = {'audio': [{'tr': x['tr'], 'track': t['id'], 'name': x['name'], 'label': t['label'] if t['id'] else '', 'books': todo,
                                       'bnames': {b: book_title(b, tr_here) for b in todo}}]}
                    ex.add_suffix(self.get_btn(plan, _('Download all') + ' (' + mb(sum(books[b]['bytes'] for b in todo)) + ')'))
                for b in books:
                    k = kept(b); full = k >= len(books[b]['ch'])
                    row = Adw.ActionRow(title=esc(book_title(b, tr_here)), subtitle=esc('%d %s · %s' % (len(books[b]['ch']), _('chapters'), mb(books[b]['bytes'])) + (' · ✓ ' + _('On This Device') if full else (' · %d ✓' % k if k else ''))))
                    if not full:
                        row.add_suffix(self.get_btn({'audio': [{'tr': x['tr'], 'track': t['id'], 'name': x['name'], 'label': t['label'] if t['id'] else '', 'books': {b: books[b]['ch']},
                                                                 'bname': book_title(b, tr_here), 'bnames': {b: book_title(b, tr_here)}}]}))
                    ex.add_row(row)
                g.add(ex)

    # Books (CrossWire and AndBible): its own page; here only for On This Device
    def here_books(self, g, st, flat=False):
        n = 0
        try:
            from . import sword
        except Exception:
            return 0
        for c in here_books():
            row = Adw.ActionRow(title=esc(c.get('Description') or c['_name']), subtitle=esc(_(KINDS.get(c['_kind'], 'Book'))), activatable=True)
            row.connect('activated', lambda *_a, c=c: (self.open_books(), self.books.open(c)))
            row.add_suffix(self.btn('user-trash-symbolic', _('Delete from this computer'), lambda c=c: self.ask_delete(c.get('Description') or c['_name'], lambda: sword.remove(c))))
            row.add_suffix(Gtk.Image(icon_name='go-next-symbolic'))
            g.add(row); n += 1
        return n

    # The Church Fathers (each Father is one file: all his writings)
    def father_sub(self, w, extra=''):
        n = len(w.get('works') or [])
        return ' · '.join(x for x in (w.get('when') or '', '%d %s' % (n, _('work') if n == 1 else _('works')), extra) if x)

    def here_fathers(self, g, st, flat=False):
        lp = os.path.join(FILES, 'library'); q = self.q(st); n = 0
        for w in here_works():
            if q and q not in (w.get('name') or '').casefold() and not any(q in (x.get('t') or '').casefold() for x in w.get('works') or []):
                continue
            fp = os.path.join(lp, w['id'] + '.json.gz')
            row = Adw.ActionRow(title=esc(_(w.get('name') or w['id'])), subtitle=esc(self.father_sub(w, mb(os.path.getsize(fp)))), activatable=True)
            row.connect('activated', lambda *_a, w=w: self.read_father(w))
            row.add_suffix(self.btn('user-trash-symbolic', _('Delete from this computer'), lambda fp=fp, w=w: self.ask_delete(w.get('name') or w['id'], lambda: os.remove(fp))))
            row.add_suffix(Gtk.Image(icon_name='go-next-symbolic'))
            g.add(row); n += 1
        return n

    def read_father(self, w):
        self.win.show('fathers')
        try:
            self.win.fathers.open_author(w['id'])
        except Exception:
            pass

    def get_fathers(self, g, st, add):
        idx = getattr(self, 'hf_index', None)
        if idx is None:
            local = fathers_index()
            if NET.online() and not getattr(self, 'hf_asking', False):
                self.hf_asking = True
                def work():
                    return json.loads(NET.file('library/index.json').decode('utf-8'))
                def done(d):
                    self.hf_asking = False
                    self.hf_index = d if isinstance(d, list) else local
                    s = self.subs.get('cat-fathers')
                    if s and s['st']['mode'] == 'get':
                        s['fill']()
                    self.refresh_home()
                run_bg(work, done)
            idx = local
            if not idx:
                g.add(self.none_row(_('Loading…') if NET.online() else _('The list comes with the internet.'))); return
        langs = {lang(), 'en'}
        idx = [w for w in idx if not w.get('lang') or w['lang'] in langs]
        kept = {w['id'] for w in here_works(idx)}
        todo = [w for w in idx if w['id'] not in kept]
        q = self.q(st)
        if todo and not q:
            kb = sum(int(w.get('kb') or 0) for w in todo)
            r = Adw.ActionRow(title=esc(_('All their writings')), subtitle=esc('%d %s · %s' % (len(todo), _('Fathers'), mb(kb * 1000))))
            r.add_prefix(Gtk.Image(icon_name='kjt-library-symbolic')); r.add_suffix(self.get_btn({'works': todo}, _('Download all')))
            g.add(r)
        for w in todo:
            if q and q not in (w.get('name') or '').casefold() and not any(q in (x.get('t') or '').casefold() for x in w.get('works') or []):
                continue
            row = Adw.ActionRow(title=esc(_(w.get('name') or w['id'])), subtitle=esc(self.father_sub(w, mb(int(w.get('kb') or 0) * 1000))))
            row.add_suffix(self.get_btn({'works': [w]})); g.add(row)
        if not todo:
            g.add(self.none_row('✓ ' + _('Everything is on this device')))

    # Study tools
    def here_study(self, g, st, flat=False):
        n = 0
        for key, title, sub, folder, icon in STUDY:
            if not folder_here(folder):
                continue
            p = os.path.join(FILES, folder)
            row = Adw.ActionRow(title=esc(_(title)), subtitle=esc(_(sub) + ' · ' + mb(size_of(p)))); row.set_subtitle_lines(2)
            row.add_prefix(Gtk.Image(icon_name=icon))
            row.add_suffix(self.btn('user-trash-symbolic', _('Delete from this computer'), lambda p=p, title=title: self.ask_delete(_(title), lambda: shutil.rmtree(p, ignore_errors=True))))
            g.add(row); n += 1
        return n

    def study_plan(self, key):
        return {'dict': {'dict': [lang()]}, 'maps': {'maps': True, 'dict': [lang()]}, 'commentary': {'commentary': True}, 'study': {'study': True}}[key]

    def get_study(self, g, st, add):
        todo = [s for s in STUDY if not folder_here(s[3])]
        for key, title, sub, folder, icon in todo:
            row = Adw.ActionRow(title=esc(_(title)), subtitle=esc(_(sub))); row.set_subtitle_lines(2)
            row.add_prefix(Gtk.Image(icon_name=icon)); row.add_suffix(self.get_btn(self.study_plan(key))); g.add(row)
        if not todo:
            g.add(self.none_row('✓ ' + _('Everything is on this device')))

    # Games (On This Device only)
    def games_row(self, g, device=False):
        """device=True: only when the games are here (returns 1), for the list of what is here"""
        gs = games_size(); here = gs > 2 * 1048576
        if device and not here:
            return 0
        row = Adw.ActionRow(title=esc(_('Good Fun games')), subtitle=esc(('✓ ' + _('On This Device') + ' · ' + mb(gs)) if here else _('Every game, exactly as on the website, to play without the internet')))
        row.set_subtitle_lines(2); row.add_prefix(Gtk.Image(icon_name='kjt-fun-symbolic'))
        if here:
            from . import sitecache
            row.add_suffix(self.btn('user-trash-symbolic', _('Delete from this computer'), lambda: self.ask_delete(_('Good Fun games'), lambda: shutil.rmtree(sitecache.DIR, ignore_errors=True))))
        else:
            row.add_suffix(self.get_btn({'games': True}))
        g.add(row)
        return 1

    # ---------- everything here, fetched again
    def update_here(self):
        have = set(STORE.bibles()); vers = (STORE.kv('info') or {}).get('versions') or {}
        plan = {'bibles': sorted(t for t in have if t in vers), 'today': [lang()], 'refresh': True}
        if folder_here('dictionary'):
            plan['dict'] = [lang()]
        if folder_here('maps'):
            plan['maps'] = True
        if folder_here('fathers'):
            plan['commentary'] = True
        if folder_here('xref'):
            plan['study'] = True
        works = here_works()
        if works:
            plan['works'] = works
        if games_size() > 2 * 1048576:
            plan['games'] = True
        self.get(plan)
