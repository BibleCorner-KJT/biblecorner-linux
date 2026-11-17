"""Downloads and language: what the app keeps on this computer."""
import os, shutil
from gi.repository import Gtk, Adw, GLib
from .core import STORE, SET, NET, LANGS, LANG_NAMES, DEFAULT_BIBLES, FILES, info, lang, read_file
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
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win
        tv = Adw.ToolbarView(); tv.set_vexpand(True); self.append(tv)
        hb = Adw.HeaderBar(); tv.add_top_bar(hb); win.sidebar_button(hb)
        hb.set_title_widget(Adw.WindowTitle(title=_('Downloads and language')))
        self.page = Adw.PreferencesPage(); tv.set_content(self.page)
        # the downloads, each on its own line: waiting, running (with its progress), done, failed
        self.queue_box = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE); self.queue_box.add_css_class('boxed-list')
        qwrap = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_start=12, margin_end=12, margin_top=8, margin_bottom=8)
        qhead = Gtk.Box(spacing=6); self.qtitle = Gtk.Label(label='Downloads', xalign=0, hexpand=True, css_classes=['heading']); qhead.append(self.qtitle)
        self.stop_btn = Gtk.Button(label=_('Stop all')); self.stop_btn.add_css_class('flat'); self.stop_btn.connect('clicked', lambda *_: DL.cancel_all()); qhead.append(self.stop_btn)
        self.clear_btn = Gtk.Button(label=_('Clear the list')); self.clear_btn.add_css_class('flat'); self.clear_btn.connect('clicked', lambda *_: DL.clear_finished()); qhead.append(self.clear_btn)
        qwrap.append(qhead)
        qs = Gtk.ScrolledWindow(hscrollbar_policy=Gtk.PolicyType.NEVER, propagate_natural_height=True, max_content_height=260); qs.set_child(self.queue_box); qwrap.append(qs)
        self.rev = Gtk.Revealer(); self.rev.set_child(qwrap); tv.add_bottom_bar(self.rev)
        self.rows = {}
        DL.listen(self.progress)
        self.groups = []
        self.was_busy = False

    def progress(self, dl):
        jobs = list(dl.jobs)
        self.rev.set_reveal_child(bool(jobs))
        running = sum(1 for j in jobs if j.state == 'running'); waiting = sum(1 for j in jobs if j.state == 'waiting')
        self.qtitle.set_label('Downloads · %d running%s' % (running, ', %d waiting' % waiting if waiting else '') if dl.busy else 'Downloads · finished')
        self.stop_btn.set_visible(dl.busy); self.clear_btn.set_visible(not dl.busy or any(j.state not in ('waiting', 'running') for j in jobs))
        # one line per download (made once, then only brought up to date)
        for key in list(self.rows):
            if all(id(j) != key for j in jobs):
                self.queue_box.remove(self.rows.pop(key)['row'])
        for j in jobs:
            r = self.rows.get(id(j))
            if not r:
                row = Adw.ActionRow(title=GLib.markup_escape_text(j.title))
                bar = Gtk.ProgressBar(valign=Gtk.Align.CENTER, hexpand=True); bar.set_size_request(120, -1)
                btn = Gtk.Button(valign=Gtk.Align.CENTER); btn.add_css_class('flat')
                btn.connect('clicked', lambda b, j=j: DL.cancel(j) if j.state in ('waiting', 'running') else DL.retry(j))
                row.add_suffix(bar); row.add_suffix(btn)
                self.queue_box.append(row)
                r = self.rows[id(j)] = {'row': row, 'bar': bar, 'btn': btn}
            st = {'waiting': 'Waiting its turn', 'running': '%d of %d%s' % (j.done, j.total, (' · ' + j.what) if j.what else '') if j.total else 'Starting…',
                  'done': 'Done' + (' (%d not found)' % j.errors if j.errors else ''), 'failed': 'Could not be downloaded: try again', 'cancelled': 'Stopped'}[j.state]
            r['row'].set_subtitle(GLib.markup_escape_text(st))
            r['bar'].set_fraction(j.fraction()); r['bar'].set_visible(j.state in ('running', 'done'))
            r['btn'].set_icon_name('kjt-close-symbolic' if j.state in ('waiting', 'running') else 'kjt-refresh-symbolic')
            r['btn'].set_tooltip_text('Stop this download' if j.state in ('waiting', 'running') else 'Download again')
            r['btn'].set_visible(j.state != 'done' or j.errors > 0)
        if self.was_busy and not dl.busy:
            self.refresh()
        self.was_busy = dl.busy

    def refresh(self):
        for g in self.groups:
            self.page.remove(g)
        self.groups = []
        i = STORE.kv('info') or {}
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
        # the Bibles
        have = set(STORE.bibles())
        g = Adw.PreferencesGroup(title=_('Bibles'), description=_('Each Bible kept here can be read and searched without the internet.'))
        vers = i.get('versions') or {}
        if not vers:
            g.add(Adw.ActionRow(title=_('The list of Bibles comes with the internet.')))
        by_lang = {}
        for tr, v in vers.items():
            by_lang.setdefault(v[0], []).append((tr, v))
        for lg in sorted(by_lang, key=lambda x: (x != 'English', x)):
            ex = Adw.ExpanderRow(title=lg, subtitle=_('%d kept here') % sum(1 for tr, _ in by_lang[lg] if tr in have))
            for tr, v in by_lang[lg]:
                row = Adw.ActionRow(title=GLib.markup_escape_text(v[1]))
                if tr in have:
                    b = Gtk.Button(icon_name='user-trash-symbolic', tooltip_text=_('Remove from this computer'), valign=Gtk.Align.CENTER); b.add_css_class('flat')
                    b.connect('clicked', lambda _b, tr=tr: self.remove_bible(tr)); row.add_suffix(b)
                    u = Gtk.Button(icon_name='view-refresh-symbolic', tooltip_text=_('Fetch again (for corrections)'), valign=Gtk.Align.CENTER); u.add_css_class('flat')
                    u.connect('clicked', lambda _b, tr=tr: DL.start({'bibles': [tr]})); row.add_suffix(u)
                else:
                    b = Gtk.Button(icon_name='folder-download-symbolic', tooltip_text=_('Keep on this computer'), valign=Gtk.Align.CENTER)
                    b.connect('clicked', lambda _b, tr=tr: DL.start({'bibles': [tr]})); row.add_suffix(b)
                ex.add_row(row)
            g.add(ex)
        self.add(g)
        # 2.9: the app's icon (as in the Android app)
        self.add(icon_group())
        # the rest
        g = Adw.PreferencesGroup(title=_('Also kept here'))
        def item(title, sub, folder, plan):
            p = os.path.join(FILES, folder)
            here = os.path.isdir(p) and any(os.scandir(p))
            row = Adw.ActionRow(title=_(title), subtitle=_(sub) + (' · ' + mb(size_of(p)) if here else ' · ' + _('not yet')))
            b = Gtk.Button(icon_name='view-refresh-symbolic' if here else 'folder-download-symbolic', tooltip_text=_('Fetch again') if here else 'Keep on this computer', valign=Gtk.Align.CENTER)
            b.connect('clicked', lambda *_: DL.start(plan)); row.add_suffix(b); g.add(row)
        item('Bible Dictionary', 'Every entry, and every place of the maps', 'dictionary', {'dict': [lang()]})
        item('Bible Maps', 'The land in its real colours, the places and the story maps', 'maps', {'maps': True, 'dict': [lang()]})
        item('The Holy Fathers', 'Their writings, to read like books', 'library', {'library': True})
        item('The Holy Fathers on the Bible', 'Their commentary beside each chapter', 'fathers', {'commentary': True})
        item('For the reader', 'Cross-references, the Greek and Hebrew words, the words of Christ in red', 'xref', {'study': True})
        a = os.path.join(FILES, 'audio')
        if os.path.isdir(a):
            row = Adw.ActionRow(title=_('Recordings kept here'), subtitle=mb(size_of(a)))
            b = Gtk.Button(icon_name='user-trash-symbolic', tooltip_text=_('Remove the recordings'), valign=Gtk.Align.CENTER); b.add_css_class('flat')
            b.connect('clicked', lambda *_: (shutil.rmtree(a, ignore_errors=True), self.refresh())); row.add_suffix(b); g.add(row)
        self.add(g)
        g = Adw.PreferencesGroup()
        b = Gtk.Button(label=_('Bring everything up to date'), halign=Gtk.Align.CENTER); b.add_css_class('pill'); b.add_css_class('suggested-action')
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


ICONS = [('purple', 'Purple'), ('navy', 'Navy blue'), ('black', 'Black'), ('green', 'Green'), ('wine', 'Wine red')]
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
    flow = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=5, min_children_per_line=3, column_spacing=8, row_spacing=8, homogeneous=True)
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
