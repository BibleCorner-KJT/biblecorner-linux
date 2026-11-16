"""Downloads and language: what the app keeps on this computer."""
import os, shutil
from gi.repository import Gtk, Adw, GLib
from .core import STORE, SET, NET, LANGS, LANG_NAMES, DEFAULT_BIBLES, FILES, info, lang, read_file
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
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win
        tv = Adw.ToolbarView(); tv.set_vexpand(True); self.append(tv)
        hb = Adw.HeaderBar(); tv.add_top_bar(hb); win.sidebar_button(hb)
        hb.set_title_widget(Adw.WindowTitle(title='Downloads and language'))
        self.page = Adw.PreferencesPage(); tv.set_content(self.page)
        self.prog = Gtk.ProgressBar(show_text=True, margin_start=12, margin_end=12, margin_top=6, margin_bottom=6)
        self.stop_btn = Gtk.Button(label='Stop'); self.stop_btn.connect('clicked', lambda *_: setattr(DL, 'stop', True))
        bar = Gtk.Box(spacing=6); bar.append(self.prog); self.prog.set_hexpand(True); bar.append(self.stop_btn)
        self.rev = Gtk.Revealer(); self.rev.set_child(bar); tv.add_bottom_bar(self.rev)
        DL.listen(self.progress)
        self.groups = []

    def progress(self, dl):
        self.rev.set_reveal_child(dl.busy)
        if dl.busy:
            self.prog.set_fraction(dl.done / max(1, dl.total)); self.prog.set_text(dl.what or 'Getting ready…')
        else:
            self.refresh()

    def refresh(self):
        for g in self.groups:
            self.page.remove(g)
        self.groups = []
        i = STORE.kv('info') or {}
        # language
        g = Adw.PreferencesGroup(title='Language', description='The language of the Bible Dictionary, the Bible Maps and Today with God. Your Bibles can be in any language.')
        dd = Adw.ComboRow(title='Language', model=Gtk.StringList.new([LANG_NAMES[l] for l in LANGS]))
        dd.set_selected(LANGS.index(lang()) if lang() in LANGS else 0)
        def changed(row, _p):
            l = LANGS[row.get_selected()]
            if l == lang():
                return
            SET.set('lang', l)
            need = {'bibles': [] if STORE.find_book(DEFAULT_BIBLES.get(l, ''), 'JHN') else [DEFAULT_BIBLES[l]], 'dict': [l], 'maps': True, 'today': [l]}
            if NET.online():
                DL.start(need)
            self.win.language_changed()
        dd.connect('notify::selected', changed)
        g.add(dd); self.add(g)
        # the Bibles
        have = set(STORE.bibles())
        g = Adw.PreferencesGroup(title='Bibles', description='Each Bible kept here can be read and searched without the internet.')
        vers = i.get('versions') or {}
        if not vers:
            g.add(Adw.ActionRow(title='The list of Bibles comes with the internet.'))
        by_lang = {}
        for tr, v in vers.items():
            by_lang.setdefault(v[0], []).append((tr, v))
        for lg in sorted(by_lang, key=lambda x: (x != 'English', x)):
            ex = Adw.ExpanderRow(title=lg, subtitle='%d kept here' % sum(1 for tr, _ in by_lang[lg] if tr in have))
            for tr, v in by_lang[lg]:
                row = Adw.ActionRow(title=GLib.markup_escape_text(v[1]))
                if tr in have:
                    b = Gtk.Button(icon_name='user-trash-symbolic', tooltip_text='Remove from this computer', valign=Gtk.Align.CENTER); b.add_css_class('flat')
                    b.connect('clicked', lambda _b, tr=tr: self.remove_bible(tr)); row.add_suffix(b)
                    u = Gtk.Button(icon_name='view-refresh-symbolic', tooltip_text='Fetch again (for corrections)', valign=Gtk.Align.CENTER); u.add_css_class('flat')
                    u.connect('clicked', lambda _b, tr=tr: DL.start({'bibles': [tr]})); row.add_suffix(u)
                else:
                    b = Gtk.Button(icon_name='folder-download-symbolic', tooltip_text='Keep on this computer', valign=Gtk.Align.CENTER)
                    b.connect('clicked', lambda _b, tr=tr: DL.start({'bibles': [tr]})); row.add_suffix(b)
                ex.add_row(row)
            g.add(ex)
        self.add(g)
        # the rest
        g = Adw.PreferencesGroup(title='Also kept here')
        def item(title, sub, folder, plan):
            p = os.path.join(FILES, folder)
            here = os.path.isdir(p) and any(os.scandir(p))
            row = Adw.ActionRow(title=title, subtitle=sub + (' · ' + mb(size_of(p)) if here else ' · not yet'))
            b = Gtk.Button(icon_name='view-refresh-symbolic' if here else 'folder-download-symbolic', tooltip_text='Fetch again' if here else 'Keep on this computer', valign=Gtk.Align.CENTER)
            b.connect('clicked', lambda *_: DL.start(plan)); row.add_suffix(b); g.add(row)
        item('Bible Dictionary', 'Every entry, and every place of the maps', 'dictionary', {'dict': [lang()]})
        item('Bible Maps', 'The land in its real colours, the places and the story maps', 'maps', {'maps': True, 'dict': [lang()]})
        item('The Holy Fathers', 'Their writings, to read like books', 'library', {'library': True})
        item('The Holy Fathers on the Bible', 'Their commentary beside each chapter', 'fathers', {'commentary': True})
        a = os.path.join(FILES, 'audio')
        if os.path.isdir(a):
            row = Adw.ActionRow(title='Recordings kept here', subtitle=mb(size_of(a)))
            b = Gtk.Button(icon_name='user-trash-symbolic', tooltip_text='Remove the recordings', valign=Gtk.Align.CENTER); b.add_css_class('flat')
            b.connect('clicked', lambda *_: (shutil.rmtree(a, ignore_errors=True), self.refresh())); row.add_suffix(b); g.add(row)
        self.add(g)
        g = Adw.PreferencesGroup()
        b = Gtk.Button(label='Bring everything up to date', halign=Gtk.Align.CENTER); b.add_css_class('pill'); b.add_css_class('suggested-action')
        b.connect('clicked', lambda *_: DL.start(dict(default_plan([lang()]), bibles=sorted(have) or default_plan([lang()])['bibles'])))
        g.add(b); self.add(g)

    def add(self, g):
        self.page.add(g); self.groups.append(g)

    def remove_bible(self, tr):
        if len(STORE.bibles()) <= 1:
            self.win.toast('Keep at least one Bible'); return
        STORE.delete_bible(tr)
        if SET.get('tr') == tr:
            SET.set('tr', STORE.bibles()[0])
        self.refresh(); self.win.toast('Removed')
