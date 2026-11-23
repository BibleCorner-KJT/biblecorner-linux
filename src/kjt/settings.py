"""Settings (language, appearance, app icon, reading, listening).
2.27: what was the Offline library here is in the Library: "On This Device" (libhub.py)."""
import json, os, shutil
from gi.repository import Gtk, Adw, GLib
from .core import STORE, SET, NET, LANGS, LANG_NAMES, DEFAULT_BIBLES, FILES, DATA, info, lang, read_file, run_bg
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
        # 2.42: no icon colour choice on Linux any more: it needed write access to your files (GNOME Software showed
        # "Potentially unsafe" because of it). The app always has its usual purple icon; Android keeps the choice.
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
            self.win.menu_btn.set_menu_model(self.win.make_menu())
            if SET.get('bg_keep'):
                # 2.42: the desktop is asked (once) to let the app run without a window: no tray icon any more
                def said(ok):
                    if not ok:
                        SET.set('bg_keep', False); self.win.menu_btn.set_menu_model(self.win.make_menu())
                        self.win.toast(_('Your computer did not allow Bible Corner to run in the background.'))
                        self.refresh()
                app.ask_background(said)
        self.switch(g, 'Notifications', 'When someone asks for prayer (🙏 New Prayer Request), and now and then news from Bible Corner. Checked about every half hour while the app runs.', 'n_news', True)
        self.switch(g, 'Keep running in the background', 'Closing the window hides it: the app keeps running, so notifications still come. Your computer asks you once to allow it. Open the app again from your list of apps; on GNOME it is also under Background Apps in the top-right menu. Quit closes it fully (Ctrl+Q).', 'bg_keep', False, bg)
        self.add(g)
        # the rest
        g = Adw.PreferencesGroup(title=_('Help'))
        r = Adw.ActionRow(title=_('Report a problem'), activatable=True); r.add_suffix(Gtk.Image(icon_name='go-next-symbolic'))
        r.connect('activated', lambda *_a: self.win.get_application().activate_action('report', None)); g.add(r)
        # 2.29: when the app says it is offline but the internet works, this shows why
        cr = Adw.ActionRow(title=_('Check the connection to the website'), subtitle=_('If the app says you are offline while the internet works'), activatable=True)
        cr.add_suffix(Gtk.Image(icon_name='network-wireless-symbolic'))
        def check(*_a):
            cr.set_subtitle(_('Checking…'))
            def work():
                NET.retry(); return NET.reach(timeout=15), getattr(NET, 'why', '')
            def done(res):
                ok, why = res if isinstance(res, tuple) else (False, str(res))
                cr.set_subtitle(_('The website can be reached. Everything that needs the internet works again.') if ok
                                else _('The website could not be reached:') + ' ' + (why or '?'))
            run_bg(work, done)
        cr.connect('activated', check); g.add(cr)
        r = Adw.ActionRow(title=_('On This Device'), subtitle=_('Everything downloaded, in the Library'), activatable=True); r.add_suffix(Gtk.Image(icon_name='go-next-symbolic'))
        r.connect('activated', lambda *_a: self.win.show('downloads')); g.add(r)
        self.add(g)


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
    flow = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=5, min_children_per_line=2, column_spacing=8, row_spacing=8, homogeneous=True)
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
