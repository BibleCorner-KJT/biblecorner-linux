"""2.18: the Offline library (what is kept on this computer, and what is not: Bibles, recordings, books;
keep or delete each) and Settings (language, appearance, app icon, reading, listening)."""
import json, os, shutil
from gi.repository import Gtk, Adw, GLib
from .core import STORE, SET, NET, LANGS, LANG_NAMES, DEFAULT_BIBLES, FILES, DATA, info, lang, read_file
from .i18n import _
from .downloads import DL, default_plan


def size_of(path):
    t = 0
    for root, _, files in os.walk(path):
        for f in files:
            try:
                t += os.path.getsize(os.path.join(root, f))
            except OSError:
                pass
    return t


def mb(n):
    return '%.0f MB' % (n / 1e6) if n > 1e6 else '%.0f KB' % (n / 1e3)


class DownloadsPage(Gtk.Box):
    """the Offline library"""
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win
        tv = Adw.ToolbarView(); tv.set_vexpand(True); self.append(tv)
        hb = Adw.HeaderBar(); tv.add_top_bar(hb); win.sidebar_button(hb)
        hb.set_title_widget(Adw.WindowTitle(title=_('Offline library'), subtitle=_('What is kept on this computer')))
        self.q = Gtk.SearchEntry(placeholder_text=_('Find a Bible')); self.q.connect('search-changed', lambda *_a: self.refresh()); hb.pack_end(self.q)
        self.page = Adw.PreferencesPage(); tv.set_content(self.page)
        # the downloads: shown only while something is downloading (or could not be)
        self.queue_box = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE); self.queue_box.add_css_class('boxed-list')
        qwrap = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_start=12, margin_end=12, margin_top=8, margin_bottom=8)
        qhead = Gtk.Box(spacing=6); self.qtitle = Gtk.Label(xalign=0, hexpand=True, css_classes=['heading']); qhead.append(self.qtitle)
        self.stop_btn = Gtk.Button(label=_('Stop all')); self.stop_btn.add_css_class('flat'); self.stop_btn.connect('clicked', lambda *_: DL.cancel_all()); qhead.append(self.stop_btn)
        self.clear_btn = Gtk.Button(label=_('Clear the list')); self.clear_btn.add_css_class('flat'); self.clear_btn.connect('clicked', lambda *_: DL.clear_finished()); qhead.append(self.clear_btn)
        qwrap.append(qhead)
        qs = Gtk.ScrolledWindow(hscrollbar_policy=Gtk.PolicyType.NEVER, propagate_natural_height=True, max_content_height=220); qs.set_child(self.queue_box); qwrap.append(qs)
        self.rev = Gtk.Revealer(); self.rev.set_child(qwrap); tv.add_bottom_bar(self.rev)
        self.rows = {}
        DL.listen(self.progress)
        self.groups = []
        self.was_busy = False

    def progress(self, dl):
        jobs = list(dl.jobs)
        failed = [j for j in jobs if j.state == 'failed']
        if not dl.busy and not failed and jobs:
            GLib.idle_add(lambda: (DL.clear_finished(), False)[1])     # done: nothing more to show
        self.rev.set_reveal_child(bool(dl.busy or failed))
        running = sum(1 for j in jobs if j.state == 'running'); waiting = sum(1 for j in jobs if j.state == 'waiting')
        self.qtitle.set_label((_('Downloading') + ' · %d' % running + (' · ' + _('waiting') + ' %d' % waiting if waiting else '')) if dl.busy else _('Some downloads did not finish'))
        self.stop_btn.set_visible(dl.busy); self.clear_btn.set_visible(not dl.busy)
        for key in list(self.rows):
            if all(id(j) != key for j in jobs):
                self.queue_box.remove(self.rows.pop(key)['row'])
        for j in jobs:
            r = self.rows.get(id(j))
            if not r:
                row = Adw.ActionRow(title=GLib.markup_escape_text(_(j.title)))
                bar = Gtk.ProgressBar(valign=Gtk.Align.CENTER, hexpand=True); bar.set_size_request(120, -1)
                btn = Gtk.Button(valign=Gtk.Align.CENTER); btn.add_css_class('flat')
                btn.connect('clicked', lambda b, j=j: DL.cancel(j) if j.state in ('waiting', 'running') else DL.retry(j))
                row.add_suffix(bar); row.add_suffix(btn)
                self.queue_box.append(row)
                r = self.rows[id(j)] = {'row': row, 'bar': bar, 'btn': btn}
            st = {'waiting': _('Waiting its turn'), 'running': '%d / %d%s' % (j.done, j.total, (' · ' + j.what) if j.what else '') if j.total else _('Starting…'),
                  'done': _('Done') + (' (%d not found)' % j.errors if j.errors else ''), 'failed': _('Could not be downloaded: try again'), 'cancelled': _('Stopped')}[j.state]
            r['row'].set_subtitle(GLib.markup_escape_text(st))
            r['bar'].set_fraction(j.fraction()); r['bar'].set_visible(j.state in ('running', 'done'))
            r['btn'].set_icon_name('kjt-close-symbolic' if j.state in ('waiting', 'running') else 'kjt-refresh-symbolic')
            r['btn'].set_tooltip_text(_('Stop') if j.state in ('waiting', 'running') else _('Try again'))
            r['btn'].set_visible(j.state != 'done' or j.errors > 0)
        if self.was_busy and not dl.busy:
            self.refresh()
        self.was_busy = dl.busy

    # ---------- helpers
    def add(self, g):
        self.page.add(g); self.groups.append(g)

    def opened(self, key, ex):
        """an open or closed list stays as you left it"""
        ex.set_expanded(bool(SET.get('lib_x_' + key)))
        ex.connect('notify::expanded', lambda e, _p: SET.set('lib_x_' + key, e.get_expanded()))
        return ex

    def btn(self, icon, tip, fn, cls=None):
        b = Gtk.Button(icon_name=icon, tooltip_text=tip, valign=Gtk.Align.CENTER)
        b.add_css_class(cls or 'flat'); b.connect('clicked', lambda *_a: fn()); return b

    def keep_btn(self, plan):
        b = Gtk.Button(label=_('Download'), valign=Gtk.Align.CENTER); b.add_css_class('pill'); b.add_css_class('kjt-lib-get')
        b.connect('clicked', lambda *_a: self.get(plan)); return b

    def get(self, plan):
        if not NET.online():
            self.win.toast(_('Downloading needs the internet')); return
        DL.start(plan); self.win.toast(_('Downloading…'))

    def ask_delete(self, what, fn):
        d = Adw.AlertDialog(heading=_('Delete from this computer?'), body=what + '\n\n' + _('You can download it again at any time.'))
        d.add_response('no', _('Cancel')); d.add_response('yes', _('Delete')); d.set_response_appearance('yes', Adw.ResponseAppearance.DESTRUCTIVE)
        d.connect('response', lambda _d, r: (fn(), self.refresh()) if r == 'yes' else None); d.present(self.win)

    def status(self, here, extra=''):
        return ('✓ ' + _('On this computer') if here else _('Not on this computer')) + ((' · ' + extra) if extra else '')

    # ---------- the page
    def refresh(self):
        for g in self.groups:
            self.page.remove(g)
        self.groups = []
        i = STORE.kv('info') or {}
        vers = i.get('versions') or {}
        have = set(STORE.bibles())
        books_of = dict(STORE.bible_size())
        q = (self.q.get_text() or '').strip().casefold()
        from .bible import bible_name
        # what is here, in short
        tot = size_of(FILES) + sum(os.path.getsize(os.path.join(DATA, f)) for f in ('kjt.db', 'kjt.db-wal') if os.path.exists(os.path.join(DATA, f)))
        try:
            free = shutil.disk_usage(FILES).free
        except OSError:
            free = 0
        g = Adw.PreferencesGroup(description=_('Everything marked ✓ works without the internet. Delete what you do not need to free space.'))
        top = Adw.ActionRow(title=_('On this computer') + ': %d %s' % (len(have), _('Bibles')), subtitle=_('Space used') + ': ' + mb(tot) + ((' · ' + _('free') + ': ' + mb(free)) if free else ''))
        top.add_prefix(Gtk.Image(icon_name='drive-harddisk-symbolic'))
        up = Gtk.Button(label=_('Update what is here'), valign=Gtk.Align.CENTER, tooltip_text=_('Fetches the newest corrections of the Bibles and books already on this computer. Nothing new is added.'))
        up.add_css_class('pill'); up.connect('clicked', lambda *_a: self.update_here()); top.add_suffix(up)
        g.add(top); self.add(g)

        # ---- Bibles
        g = Adw.PreferencesGroup(title=_('Bibles'))
        here = sorted(have, key=lambda t: bible_name(t).casefold())
        ex = self.opened('bibles_here', Adw.ExpanderRow(title=_('On this computer') + ' (%d)' % len(here), subtitle=_('Read and search without the internet')))
        ex.add_prefix(Gtk.Image(icon_name='emblem-ok-symbolic'))
        for tr in here:
            if q and q not in bible_name(tr).casefold():
                continue
            row = Adw.ActionRow(title=GLib.markup_escape_text(bible_name(tr)), subtitle=GLib.markup_escape_text(self.status(True, '%d %s' % (books_of.get(tr, 0), _('books')))))
            if tr in vers:
                row.add_suffix(self.btn('view-refresh-symbolic', _('Fetch again (for corrections)'), lambda tr=tr: self.get({'bibles': [tr]})))
            row.add_suffix(self.btn('user-trash-symbolic', _('Delete from this computer'), lambda tr=tr: self.ask_delete(bible_name(tr), lambda: self.remove_bible(tr))))
            ex.add_row(row)
        if q:
            ex.set_expanded(True)
        g.add(ex)
        by_lang = {}
        for tr, v in vers.items():
            if tr not in have and (not q or q in (v[1] or '').casefold() or q in (v[0] or '').casefold()):
                by_lang.setdefault(v[0], []).append((tr, v))
        if not vers:
            g.add(Adw.ActionRow(title=_('The list of Bibles to download comes with the internet.')))
        elif by_lang:
            ex2 = self.opened('bibles_more', Adw.ExpanderRow(title=_('Not on this computer') + ' (%d)' % sum(len(x) for x in by_lang.values()), subtitle=_('Bibles you can download, by language')))
            ex2.add_prefix(Gtk.Image(icon_name='folder-download-symbolic'))
            if q:
                ex2.set_expanded(True)
            g.add(ex2)
            MAIN = ['English', 'Arabic', 'Greek', 'Ancient Greek', 'Russian', 'Church Slavonic', 'Chinese', 'French', 'Hindi', 'Spanish', 'Tagalog', 'Filipino']
            for lg in sorted(by_lang, key=lambda x: (MAIN.index(x) if x in MAIN else 99, x)):
                ex3 = Adw.ExpanderRow(title=GLib.markup_escape_text(_(lg)), subtitle='%d' % len(by_lang[lg])); ex3.add_css_class('kjt-lib-lang')
                if q:
                    ex3.set_expanded(True)
                for tr, v in sorted(by_lang[lg], key=lambda x: x[1][1]):
                    row = Adw.ActionRow(title=GLib.markup_escape_text(v[1]), subtitle=self.status(False))
                    row.add_suffix(self.keep_btn({'bibles': [tr]})); ex3.add_row(row)
                ex2.add_row(ex3)
        self.add(g)

        # ---- Recordings
        g = Adw.PreferencesGroup(title=_('Recordings'), description=_('Chapters you kept while listening (Keep chapter, Keep the whole book). Recordings not kept here play with the internet.'))
        a = os.path.join(FILES, 'audio')
        def has_mp3(p):
            return any(fn.endswith('.mp3') for _r, _d, fs in os.walk(p) for fn in fs)
        folders = sorted(f for f in (os.listdir(a) if os.path.isdir(a) else []) if os.path.isdir(os.path.join(a, f)) and has_mp3(os.path.join(a, f)))
        if not folders:
            g.add(Adw.ActionRow(title=_('No recordings on this computer yet.'), subtitle=_('In the Bible, press ▶ Listen, then Keep chapter or Keep the whole book.')))
        for f in folders:
            p = os.path.join(a, f); tr, _s, track = f.partition('_')
            bk = sorted(b for b in os.listdir(p) if os.path.isdir(os.path.join(p, b)) and any(x.endswith('.mp3') for x in os.listdir(os.path.join(p, b))))
            nch = sum(len([x for x in os.listdir(os.path.join(p, b)) if x.endswith('.mp3')]) for b in bk)
            ex = self.opened('aud_' + f, Adw.ExpanderRow(title=GLib.markup_escape_text(bible_name(tr) + (' · ' + _('With music') if track == 'music' else (' · ' + track if track else ''))),
                                                          subtitle=self.status(True, '%d %s · %s' % (nch, _('chapters'), mb(size_of(p))))))
            ex.add_suffix(self.btn('user-trash-symbolic', _('Delete all of these recordings'), lambda p=p, f=f: self.ask_delete(f, lambda: shutil.rmtree(p, ignore_errors=True))))
            for b in bk:
                bp = os.path.join(p, b); n = len([x for x in os.listdir(bp) if x.endswith('.mp3')])
                row = Adw.ActionRow(title=GLib.markup_escape_text(book_title(b, tr)), subtitle='%d %s · %s' % (n, _('chapters'), mb(size_of(bp))))
                row.add_suffix(self.btn('user-trash-symbolic', _('Delete from this computer'), lambda bp=bp, b=b: self.ask_delete(book_title(b, tr), lambda: shutil.rmtree(bp, ignore_errors=True))))
                ex.add_row(row)
            g.add(ex)
        self.add(g)

        # ---- Books and study helps
        g = Adw.PreferencesGroup(title=_('Books and study helps'))
        def item(title, sub, folder, plan, icon):
            p = os.path.join(FILES, folder)
            here = os.path.isdir(p) and any(os.scandir(p))
            row = Adw.ActionRow(title=_(title), subtitle=GLib.markup_escape_text(_(sub) + '\n' + self.status(here, mb(size_of(p)) if here else '')))
            row.set_subtitle_lines(3); row.add_prefix(Gtk.Image(icon_name=icon))
            if here:
                row.add_suffix(self.btn('view-refresh-symbolic', _('Fetch again (for corrections)'), lambda: self.get(plan)))
                row.add_suffix(self.btn('user-trash-symbolic', _('Delete from this computer'), lambda: self.ask_delete(_(title), lambda: shutil.rmtree(p, ignore_errors=True))))
            else:
                row.add_suffix(self.keep_btn(plan))
            g.add(row)
        item('Bible Dictionary', 'Every entry, and every place of the maps', 'dictionary', {'dict': [lang()]}, 'kjt-dict-symbolic')
        item('Bible Maps', 'The land in its real colours, the places and the story maps', 'maps', {'maps': True, 'dict': [lang()]}, 'kjt-map-symbolic')
        item('The Holy Fathers on the Bible', 'Their commentary beside each chapter', 'fathers', {'commentary': True}, 'kjt-cross-symbolic')
        item('For the reader', 'Cross-references, the Greek and Hebrew words, the words of Christ in red', 'xref', {'study': True}, 'kjt-bible-symbolic')
        # the Holy Fathers' books, one by one
        lp = os.path.join(FILES, 'library')
        try:
            idx = json.loads(read_file('library/index.json') or b'[]')
        except Exception:
            idx = []
        kept = [w for w in idx if os.path.exists(os.path.join(lp, w['id'] + '.json.gz'))]
        ex = self.opened('fathers_books', Adw.ExpanderRow(title=_('The Holy Fathers'), subtitle=GLib.markup_escape_text(_('Their writings, to read like books') + '\n' + self.status(bool(kept), '%d / %d · %s' % (len(kept), len(idx), mb(size_of(lp))) if kept else ''))))
        ex.set_subtitle_lines(3); ex.add_prefix(Gtk.Image(icon_name='kjt-library-symbolic'))
        if len(kept) < len(idx) or not idx:
            ex.add_suffix(self.keep_btn({'library': True}))
        for w in kept:
            fp = os.path.join(lp, w['id'] + '.json.gz')
            row = Adw.ActionRow(title=GLib.markup_escape_text(w.get('title') or w['id']), subtitle=GLib.markup_escape_text((w.get('author') or '') + ' · ' + mb(os.path.getsize(fp))))
            row.add_suffix(self.btn('user-trash-symbolic', _('Delete from this computer'), lambda fp=fp, w=w: self.ask_delete(w.get('title') or w['id'], lambda: os.remove(fp))))
            ex.add_row(row)
        g.add(ex)
        self.add(g)

        # ---- the free libraries (CrossWire, AndBible): books that are not Bibles
        try:
            from . import sword
            mods = [c for c in sword.installed() if c['_kind'] != 'bible']
        except Exception:
            mods = []
        if mods:
            g = Adw.PreferencesGroup(title=_('Books from the free libraries'), description=_('Commentaries, dictionaries and books from CrossWire and AndBible (in the Library).'))
            ex = self.opened('sword_books', Adw.ExpanderRow(title=_('On this computer') + ' (%d)' % len(mods)))
            for c in mods:
                row = Adw.ActionRow(title=GLib.markup_escape_text(c.get('Description') or c['_name']), subtitle=GLib.markup_escape_text(c['_name'] + ' · ' + _(c['_kind'])))
                row.add_suffix(self.btn('user-trash-symbolic', _('Delete from this computer'), lambda c=c: self.ask_delete(c.get('Description') or c['_name'], lambda: sword.remove(c))))
                ex.add_row(row)
            g.add(ex); self.add(g)

    def update_here(self):
        """the newest corrections of what is here; nothing new"""
        have = set(STORE.bibles()); vers = (STORE.kv('info') or {}).get('versions') or {}
        here = lambda f: os.path.isdir(os.path.join(FILES, f)) and any(os.scandir(os.path.join(FILES, f)))
        plan = {'bibles': sorted(t for t in have if t in vers), 'today': [lang()]}
        if here('dictionary'):
            plan['dict'] = [lang()]
        if here('maps'):
            plan['maps'] = True
        if here('library'):
            plan['library'] = True
        if here('fathers'):
            plan['commentary'] = True
        if here('xref'):
            plan['study'] = True
        self.get(plan)

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


def book_title(code, tr):
    try:
        from .core import book_name
        return book_name(code, tr=tr) or code
    except Exception:
        return code


class SettingsPage(Gtk.Box):
    """2.18: every setting in one place"""
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win
        tv = Adw.ToolbarView(); tv.set_vexpand(True); self.append(tv)
        hb = Adw.HeaderBar(); tv.add_top_bar(hb); win.sidebar_button(hb)
        hb.set_title_widget(Adw.WindowTitle(title=_('Settings')))
        self.page = Adw.PreferencesPage(); tv.set_content(self.page)
        self.groups = []

    def add(self, g):
        self.page.add(g); self.groups.append(g)

    def switch(self, g, title, sub, key, default=True, after=None):
        row = Adw.SwitchRow(title=_(title), subtitle=_(sub) if sub else '')
        v = SET.get(key); row.set_active(default if v is None else bool(v))
        def ch(r, _p):
            SET.set(key, r.get_active())
            if after:
                after()
        row.connect('notify::active', ch); g.add(row)

    def refresh(self):
        for g in self.groups:
            self.page.remove(g)
        self.groups = []
        # language
        g = Adw.PreferencesGroup(title=_('Language'), description=_('The language of the Bible Dictionary, the Bible Maps and Today with God. Your Bibles can be in any language.'))
        dd = Adw.ComboRow(title=_('Language'), model=Gtk.StringList.new([LANG_NAMES[l] for l in LANGS]))
        dd.set_selected(LANGS.index(lang()) if lang() in LANGS else 0)
        def changed(row, _p):
            l = LANGS[row.get_selected()]
            if l == lang():
                return
            SET.set('lang', l); SET.set('lang_chosen', 1)
            need = {'bibles': [] if STORE.find_book(DEFAULT_BIBLES.get(l, ''), 'JHN') else [DEFAULT_BIBLES[l]], 'dict': [l], 'maps': True, 'today': [l]}
            if NET.online():
                DL.start(need)
            self.win.language_changed()
        dd.connect('notify::selected', changed)
        g.add(dd); self.add(g)
        # 2.24: accounts and avatar (in Study Journey, where the account is)
        g = Adw.PreferencesGroup(title=_('Accounts on this computer'))
        r = Adw.ActionRow(title=_('My account, my avatar and other accounts'), activatable=True); r.add_prefix(Gtk.Image(icon_name='avatar-default-symbolic')); r.add_suffix(Gtk.Image(icon_name='go-next-symbolic'))
        r.connect('activated', lambda *_a: self.win.show('study')); g.add(r); self.add(g)
        # appearance
        g = Adw.PreferencesGroup(title=_('Appearance'))
        looks = [('auto', 'Follow the computer'), ('light', 'Light'), ('dark', 'Dark')]
        cur = SET.get('style') or 'auto'
        lr = Adw.ComboRow(title=_('Light or dark'), model=Gtk.StringList.new([_(x[1]) for x in looks]))
        lr.set_selected([x[0] for x in looks].index(cur) if cur in [x[0] for x in looks] else 0)
        lr.connect('notify::selected', lambda r, _p: self.win.get_application().set_style(looks[r.get_selected()][0]))
        g.add(lr); self.add(g)
        self.add(icon_group())
        # 2.18: the reading page: paper colours that are easy on the eyes
        from . import paper
        g = Adw.PreferencesGroup(title=_('Reading page'), description=_('Dark letters on a warm, paper-like page are the clearest and the easiest on the eyes for long reading. Candlelight is only for a dark room.'))
        first = None; cur = paper.current()
        def pick(btn, k):
            if not btn.get_active():
                return
            SET.set('paper', k); paper.apply()
            for key in ('bible', 'fathers'):
                pg = getattr(self.win, 'pages', {}).get(key)
                if pg is not None and hasattr(pg, 'repaint'):
                    pg.repaint()
        for k in paper.ORDER:
            r = Adw.ActionRow(title=_(paper.NAMES[k]), subtitle=_(paper.TIPS[k]))
            r.add_prefix(paper.swatch(k))
            ck = Gtk.CheckButton(valign=Gtk.Align.CENTER, active=(k == cur))
            if first is None:
                first = ck
            else:
                ck.set_group(first)
            ck.connect('toggled', pick, k); r.add_suffix(ck); r.set_activatable_widget(ck); g.add(r)
        self.add(g)
        # reading
        g = Adw.PreferencesGroup(title=_('Reading'))
        rd = lambda: self.win.page('bible').show(keep=True) if 'bible' in getattr(self.win, 'pages', {}) else None
        self.switch(g, 'Colour verses by their Study Pads', '', 'pad_colours', True, rd)
        self.switch(g, 'The words of Christ in red', 'In the King James Version', 'red', True, rd)
        self.add(g)
        # listening
        g = Adw.PreferencesGroup(title=_('Listening'))
        au = lambda: (self.win.audio.follow_sw.set_active(SET.get('audio_follow') is not False), self.win.audio.keep_sw.set_active(SET.get('audio_keep') is not False)) if getattr(self.win, 'audio', None) else None
        self.switch(g, 'Follow along', 'The verse being read glows, and the chapter scrolls with it', 'audio_follow', True, au)
        self.switch(g, 'Keep listening', 'Go on to the next chapter by itself', 'audio_keep', True, au)
        self.add(g)
        # 2.22: closing the window
        g = Adw.PreferencesGroup(title=_('When the window is closed'))
        def bg():
            app = self.win.get_application()
            (app.start_tray() if SET.get('bg_keep') else app.stop_tray())
            self.win.menu_btn.set_menu_model(self.win.make_menu())
        self.switch(g, 'Keep running in the tray', 'Closing the window hides it: the app keeps running, with its icon in the tray (on GNOME, with the AppIndicator extension; otherwise under Background Apps). Quit closes it fully (Ctrl+Q).', 'bg_keep', False, bg)
        self.add(g)
        # the rest
        g = Adw.PreferencesGroup(title=_('Help'))
        r = Adw.ActionRow(title=_('Report a problem'), activatable=True); r.add_suffix(Gtk.Image(icon_name='go-next-symbolic'))
        r.connect('activated', lambda *_a: self.win.get_application().activate_action('report', None)); g.add(r)
        r = Adw.ActionRow(title=_('Offline library'), subtitle=_('What is kept on this computer'), activatable=True); r.add_suffix(Gtk.Image(icon_name='go-next-symbolic'))
        r.connect('activated', lambda *_a: self.win.show('downloads')); g.add(r)
        self.add(g)


ICONS = [('purple', 'Purple'), ('navy', 'Navy blue'), ('black', 'Black'), ('green', 'Green'), ('wine', 'Wine red'),
         ('golden', 'Gold'), ('royalblue', 'Royal blue'), ('royalpurple', 'Royal purple'), ('bluecross', 'Blue'), ('teal', 'Teal and gold'), ('violet', 'Violet')]
APP_ID = 'today.knowingjesus.KJT'


def _apps_dir():
    return os.path.join(os.environ.get('XDG_DATA_HOME_HOST') or os.path.expanduser('~/.local/share'), 'applications')


def current_icon():
    p = os.path.join(_apps_dir(), APP_ID + '.desktop')
    try:
        for line in open(p, encoding='utf-8'):
            if line.startswith('Icon=') and 'kjt-icon-' in line:
                return line.strip().rsplit('kjt-icon-', 1)[1].split('.')[0]
    except OSError:
        pass
    return 'purple'


def set_icon(name):
    """the usual (purple) icon is the app's own; another one is a small menu entry of the user's own, in
    ~/.local/share/applications, that shows the chosen picture (taken away again for the usual one)"""
    d = _apps_dir(); desk = os.path.join(d, APP_ID + '.desktop')
    for f in os.listdir(d) if os.path.isdir(d) else []:
        if f.startswith('kjt-icon-') and f.endswith('.png'):
            try: os.remove(os.path.join(d, f))
            except OSError: pass
    if name == 'purple':
        try: os.remove(desk)
        except OSError: pass
        return True
    src = os.path.join(os.path.dirname(__file__), 'appicons', name + '.png')
    if not os.path.exists(src):
        return False
    os.makedirs(d, exist_ok=True)
    pic = os.path.join(d, 'kjt-icon-%s.png' % name)
    shutil.copyfile(src, pic)
    base = '/app/share/applications/%s.desktop' % APP_ID
    try:
        text = open(base, encoding='utf-8').read()
    except OSError:
        text = '[Desktop Entry]\nType=Application\nName=Bible Corner - KJT\nExec=kjt\nIcon=x\nCategories=Education;Literature;\nStartupNotify=true\n'
    out = []
    for line in text.splitlines():
        if line.startswith('Exec='):
            line = 'Exec=flatpak run %s' % APP_ID
        elif line.startswith('Icon='):
            line = 'Icon=' + pic
        out.append(line)
    if not any(l.startswith('Icon=') for l in out):
        out.append('Icon=' + pic)
    out.append('X-Flatpak=' + APP_ID)
    with open(desk, 'w', encoding='utf-8') as f:
        f.write('\n'.join(out) + '\n')
    return True


def icon_group():
    g = Adw.PreferencesGroup(title=_('App icon'), description=_('The icon of the app in your list of apps and on the dock.'))
    flow = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=6, min_children_per_line=3, column_spacing=8, row_spacing=8, homogeneous=True)
    note = Gtk.Label(xalign=0, wrap=True, css_classes=['caption', 'dim-label'], margin_top=6)
    cur = current_icon(); btns = []
    for key, label in ICONS:
        b = Gtk.ToggleButton(active=key == cur, group=btns[0] if btns else None); b.add_css_class('flat')
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4, margin_top=4, margin_bottom=4)
        pic = Gtk.Picture.new_for_filename(os.path.join(os.path.dirname(__file__), 'appicons', key + '.png'))
        pic.set_size_request(64, 64); pic.set_can_shrink(True); box.append(pic)
        box.append(Gtk.Label(label=_(label) + (' · ' + _('usual') if key == 'purple' else ''), css_classes=['caption']))
        b.set_child(box); btns.append(b); flow.append(b)
        def chose(bt, key=key):
            if not bt.get_active():
                return
            try:
                ok = set_icon(key)
            except OSError:
                ok = False
            note.set_label(_('The new icon shows in a moment (open the list of apps again).') if ok else _('The icon could not be changed here.'))
        b.connect('toggled', chose)
    wrap = Gtk.Box(orientation=Gtk.Orientation.VERTICAL); wrap.append(flow); wrap.append(note)
    g.add(wrap)
    return g
