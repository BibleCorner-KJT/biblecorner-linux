"""Knowing Jesus Today for Linux: a whole app of its own, that works without the internet."""
import os, sys, re
import gi
gi.require_version('Gtk', '4.0'); gi.require_version('Adw', '1'); gi.require_version('PangoCairo', '1.0')
from gi.repository import Gtk, Adw, Gio, GLib, Gdk, GObject

from .core import STORE, SET, NET, SITE, LANGS, LANG_NAMES, info, lang, canon, run_bg
from .i18n import _
from .downloads import DL, default_plan, have_data
from .study import STUDY, COLORS
from .richtext import verse_link

APP_ID = 'today.knowingjesus.KJT'
VERSION = '2.11'

CSS = '''
.kjt-brand { font-family: Serif; font-weight: 800; font-size: 1.3em; color: #c99a1d; letter-spacing: 1px; }
textview.kjt-bible, textview.kjt-text, textview.kjt-book { background: transparent; }
.kjt-card { background: alpha(#f3c548, 0.07); border-radius: 14px; }
.kjt-card-title { font-family: Serif; font-weight: 700; font-size: 1.2em; color: #3e093f; }
.kjt-verse { font-family: Serif; font-size: 1.22em; font-style: italic; }
.kjt-reading { font-family: Serif; font-size: 1.08em; }
.kjt-feast { font-weight: 700; color: #8a1f2b; }
.kjt-fast { color: #4f6b2a; }
.kjt-ref { color: #2b6a8e; font-weight: 600; }
.kjt-map-credit { background: alpha(white, 0.78); border-radius: 6px; padding: 1px 6px; color: #5a5060; font-size: 0.8em; }
.kjt-audio { border-top: 1px solid alpha(currentColor, 0.1); background: alpha(#f3c548, 0.06); }
.kjt-step { border-radius: 12px; }
.kjt-sel-label { font-weight: 700; }
.kjt-chapinfo { background: alpha(#f3c548, 0.10); border-radius: 12px; padding: 10px 12px; }
.kjt-grip { background: alpha(currentColor, 0.06); } .kjt-grip:hover { background: alpha(@accent_color, 0.35); }
.kjt-tile { padding: 10px 14px; } .kjt-tile-icon { font-size: 1.6em; }
.kjt-padcard { padding: 10px 8px 10px 12px; border-left: 7px solid #999; }
.kjt-padcard.kjt-pad-on { box-shadow: inset 0 0 0 2px @accent_color; }
.kjt-padbadge { border-radius: 999px; min-width: 34px; min-height: 34px; font-size: 1.15em; font-weight: bold; }
.kjt-swatch { min-width: 26px; min-height: 26px; padding: 0; border-radius: 999px; }
.kjt-swatch.kjt-dot-on { box-shadow: 0 0 0 3px @accent_color; }
button.kjt-chip { min-height: 26px; padding: 2px 10px; border-radius: 999px; font-size: 0.92em; }
button.kjt-chip-yellow { background: #f6d365; color: #1d1a1f; } button.kjt-chip-green { background: #9be3a4; color: #1d1a1f; }
button.kjt-chip-blue { background: #9cc9f5; color: #1d1a1f; } button.kjt-chip-pink { background: #f7a8c4; color: #1d1a1f; }
button.kjt-chip-purple { background: #c9a7f0; color: #1d1a1f; }

.kjt-selbar { border-top: 1px solid alpha(currentColor, 0.1); }
.kjt-sel-state { color: #7a1f6b; font-weight: 600; }
button.kjt-dot.kjt-dot-on { border: 3px solid #3e093f; }
.kjt-selbar flowboxchild { padding: 0; min-width: 0; }
.kjt-mtable-head label { font-weight: 700; opacity: .7; font-size: .9em; }
.kjt-mtable row { padding: 6px 8px; }
button.kjt-dot-none { background: transparent; border: 2px dashed alpha(currentColor, 0.45); }
.kjt-nav row { border-radius: 8px; }
.kjt-nav-icon { color: #7a1f6b; }
button.kjt-dot { min-width: 22px; min-height: 22px; padding: 0; border-radius: 999px; border: 2px solid alpha(black, 0.12); }
button.kjt-dot:hover { border-color: alpha(black, 0.35); }
''' + 'button.kjt-bk { border-left: 4px solid transparent; font-weight: 500; }\nbutton.kjt-bk-law { border-left-color: #dc2626; background: #fdeeee; color: #991b1b; }\nbutton.kjt-bk-hist { border-left-color: #64748b; background: #f1f5f9; color: #334155; }\nbutton.kjt-bk-wis { border-left-color: #f97316; background: #fff2e8; color: #9a3412; }\nbutton.kjt-bk-major { border-left-color: #2563eb; background: #edf3ff; color: #1e40af; }\nbutton.kjt-bk-minor { border-left-color: #ec4899; background: #fdeef6; color: #9d174d; }\nbutton.kjt-bk-dc { border-left-color: #0d9488; background: #e8f7f5; color: #115e59; }\nbutton.kjt-bk-gosp { border-left-color: #16a34a; background: #eaf7ee; color: #166534; }\nbutton.kjt-bk-acts { border-left-color: #9333ea; background: #f5edfd; color: #6b21a8; }\nbutton.kjt-bk-paul { border-left-color: #facc15; background: #fffbe2; color: #854d0e; }\nbutton.kjt-bk-gen { border-left-color: #92400e; background: #f6eee6; color: #78350f; }\nbutton.kjt-bk-rev { border-left-color: #c9a227; background: #fff6d8; color: #7a5a00; }\nbutton.kjt-bk-here { outline: 2px solid #3e093f; outline-offset: -2px; font-weight: 800; }\n' + ''.join('button.kjt-dot-%s { background: %s; }\n' % (c, h) for c, h in COLORS.items())

DARK = 'button.kjt-bk-law { background: alpha(#dc2626, 0.16); color: #f2eaf4; }\nbutton.kjt-bk-hist { background: alpha(#64748b, 0.22); color: #f2eaf4; }\nbutton.kjt-bk-wis { background: alpha(#f97316, 0.16); color: #f2eaf4; }\nbutton.kjt-bk-major { background: alpha(#2563eb, 0.16); color: #f2eaf4; }\nbutton.kjt-bk-minor { background: alpha(#ec4899, 0.16); color: #f2eaf4; }\nbutton.kjt-bk-dc { background: alpha(#0d9488, 0.16); color: #f2eaf4; }\nbutton.kjt-bk-gosp { background: alpha(#16a34a, 0.16); color: #f2eaf4; }\nbutton.kjt-bk-acts { background: alpha(#9333ea, 0.16); color: #f2eaf4; }\nbutton.kjt-bk-paul { background: alpha(#facc15, 0.16); color: #f2eaf4; }\nbutton.kjt-bk-gen { background: alpha(#92400e, 0.16); color: #f2eaf4; }\nbutton.kjt-bk-rev { background: alpha(#c9a227, 0.16); color: #f2eaf4; }\nbutton.kjt-bk-here { outline-color: #e9c8f0; }\n' + '''
.kjt-card-title { color: #e9c8f0; }
.kjt-feast { color: #ff9a9a; }
.kjt-fast { color: #b5d68a; }
.kjt-ref { color: #8cc4e8; }
.kjt-nav-icon { color: #e0a8d8; }
.kjt-map-credit { background: alpha(black, 0.55); color: #ddd; }
'''

PAGES = [('today', 'Today with God', 'kjt-today-symbolic'), ('bible', 'The Holy Bible', 'kjt-bible-symbolic'),
         ('fathers', 'The Holy Fathers', 'kjt-cross-symbolic'), ('dict', 'Bible Dictionary', 'kjt-dict-symbolic'),
         ('maps', 'Bible Maps', 'kjt-map-symbolic'), ('library', 'Library', 'kjt-library-symbolic'), ('study', 'Study Journey', 'kjt-study-symbolic'),
         ('downloads', 'Downloads', 'kjt-download-symbolic')]


def icon_button(icon, tip, fn=None, flat=True, toggle=False):
    b = (Gtk.ToggleButton if toggle else Gtk.Button)(icon_name=icon, tooltip_text=tip)
    if flat:
        b.add_css_class('flat')
    if fn:
        b.connect('toggled' if toggle else 'clicked', lambda *_: fn())
    return b


class Window(Adw.ApplicationWindow):
    def __init__(self, app):
        super().__init__(application=app, title='Bible Corner - KJT')
        self.set_size_request(340, 420)  # fits the smallest screens
        self.set_default_size(SET.get('w', 1200), SET.get('h', 820))
        if SET.get('max'):
            self.maximize()
        self.compact = False
        self.pages = {}
        self.toasts = Adw.ToastOverlay()
        self.split = Adw.OverlaySplitView(min_sidebar_width=220, max_sidebar_width=260)
        self.toasts.set_child(self.split)
        from .audio import Audio
        self.audio = Audio(self)

        # the sidebar
        st = Adw.ToolbarView(); sh = Adw.HeaderBar(); st.add_top_bar(sh)
        brand = Gtk.Box(spacing=4, tooltip_text='Bible Corner - KJT')
        bl = Gtk.Label(label='KJT'); bl.add_css_class('kjt-brand'); brand.append(bl)
        bi = Gtk.Image(icon_name='kjt-cross-symbolic', pixel_size=18); bi.add_css_class('kjt-brand'); brand.append(bi)
        sh.set_title_widget(brand)
        self.menu_btn = Gtk.MenuButton(icon_name='kjt-more-symbolic', menu_model=self.make_menu(), tooltip_text=_('Menu'))
        sh.pack_end(self.menu_btn)
        # 2.10: light or dark, one click (the menu also has "Follow the computer")
        self.dark_btn = Gtk.Button(); self.dark_btn.add_css_class('flat'); self.dark_btn.connect('clicked', lambda *_: app.set_style('light' if Adw.StyleManager.get_default().get_dark() else 'dark'))
        sh.pack_start(self.dark_btn); self.dark_icon()
        Adw.StyleManager.get_default().connect('notify::dark', lambda *_: self.dark_icon())
        self.nav = Gtk.ListBox(selection_mode=Gtk.SelectionMode.SINGLE); self.nav.add_css_class('navigation-sidebar'); self.nav.add_css_class('kjt-nav')
        for n, (key, title, icon) in enumerate(PAGES):
            row = Gtk.ListBoxRow(); row.key = key
            b = Gtk.Box(spacing=12, margin_top=7, margin_bottom=7, margin_start=4)
            im = Gtk.Image(icon_name=icon); im.add_css_class('kjt-nav-icon'); b.append(im)
            row.lab = Gtk.Label(label=_(title), xalign=0); b.append(row.lab); row.set_child(b); row.title = title; row.n = n
            row.set_tooltip_text('%s (Ctrl+%d)' % (_(title), n + 1))
            self.nav.append(row)
        self.nav.connect('row-activated', lambda _l, row: self.show(row.key, from_nav=True))
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(self.nav); st.set_content(sc)
        from .ui import resizable
        self.split.set_sidebar(resizable(self.split, st, 'nav', lo=180, hi=420))

        # the pages (each made the first time it is opened, so the app starts at once)
        self.stack = Gtk.Stack(transition_type=Gtk.StackTransitionType.CROSSFADE, transition_duration=120, vexpand=True, hhomogeneous=False, vhomogeneous=False)
        content = Gtk.Box(orientation=Gtk.Orientation.VERTICAL); content.append(self.stack); content.append(self.audio)
        self.split.set_content(content)
        self.set_content(self.toasts)

        # smaller windows and screens
        bp = Adw.Breakpoint.new(Adw.BreakpointCondition.parse('max-width: 820sp'))
        bp.add_setter(self.split, 'collapsed', True)
        self.add_breakpoint(bp)
        bp2 = Adw.Breakpoint.new(Adw.BreakpointCondition.parse('max-width: 620sp'))
        bp2.add_setter(self.split, 'collapsed', True)
        self.add_breakpoint(bp2)
        # the small-screen layout follows the room the pages really have (the window less the sidebar)
        self.connect('notify::default-width', lambda *_: GLib.idle_add(self.fit_layout))
        self.split.connect('notify::collapsed', lambda *_: GLib.idle_add(self.fit_layout))
        self.split.connect('notify::show-sidebar', lambda *_: GLib.idle_add(self.fit_layout))
        GLib.timeout_add(300, self.fit_layout)

        k = Gtk.ShortcutController(scope=Gtk.ShortcutScope.GLOBAL)
        for n, (key, _t, _i) in enumerate(PAGES):
            k.add_shortcut(Gtk.Shortcut.new(Gtk.ShortcutTrigger.parse_string('<Control>%d' % (n + 1)), Gtk.CallbackAction.new(lambda *_a, key=key: (self.show(key), True)[1])))
        self.add_controller(k)

        self.connect('close-request', self.on_close)
        DL.listen(self.on_download)
        self.show('bible')
        GLib.idle_add(self.first_run)
        GLib.timeout_add(600, self.offer_continue)

    # the pages
    def page(self, key):
        if key not in self.pages:
            if key == 'today':
                from .today import TodayPage as P
            elif key == 'bible':
                from .bible import BiblePage as P
            elif key == 'fathers':
                from .fathers import FathersPage as P
            elif key == 'dict':
                from .dictionary import DictPage as P
            elif key == 'maps':
                from .maps import MapsPage as P
            elif key == 'study':
                from .mystudy import StudyPage as P
            elif key == 'library':
                from .library import LibraryPage as P
            else:
                from .settings import DownloadsPage as P
            p = P(self); self.pages[key] = p; self.stack.add_named(p, key)
            p.fresh = True
            if hasattr(p, 'set_compact'):
                p.set_compact(self.compact)
        return self.pages[key]

    bible = property(lambda self: self.page('bible'))
    maps = property(lambda self: self.page('maps'))
    dict = property(lambda self: self.page('dict'))
    today = property(lambda self: self.page('today'))
    fathers = property(lambda self: self.page('fathers'))
    study = property(lambda self: self.page('study'))
    library = property(lambda self: self.page('library'))
    downloads = property(lambda self: self.page('downloads'))

    NARROW = 800   # below this much room the pages use their small-screen layout

    def fit_layout(self):
        w = self.get_width() or self.get_default_size()[0]
        if w <= 0:
            return False
        room = w - (self.split.get_max_sidebar_width() if (self.split.get_show_sidebar() and not self.split.get_collapsed()) else 0)
        c = room < self.NARROW
        if c != self.compact:
            self.set_compact(c)
        return False

    def do_size_allocate(self, width, height, baseline):
        Adw.ApplicationWindow.do_size_allocate(self, width, height, baseline)
        if getattr(self, '_last_w', None) != width:
            self._last_w = width
            GLib.idle_add(self.fit_layout)

    def set_compact(self, c):
        self.compact = c
        for p in self.pages.values():
            if hasattr(p, 'set_compact'):
                p.set_compact(c)
        self.audio.set_compact(c)

    # helpers the pages use
    def sidebar_button(self, hb):
        b = icon_button('kjt-sidebar-symbolic', 'Show the menu', lambda: self.split.set_show_sidebar(not self.split.get_show_sidebar()))
        self.split.bind_property('collapsed', b, 'visible', GObject.BindingFlags.SYNC_CREATE)
        hb.pack_start(b)
        return b

    def toast(self, text, undo=None):
        t = Adw.Toast(title=GLib.markup_escape_text(text), timeout=5 if undo else 3)
        if undo:
            t.set_button_label('Undo')
            t.connect('button-clicked', lambda *_: undo())
        self.toasts.add_toast(t)

    def show(self, key, from_nav=False):
        page = self.page(key)
        self.stack.set_visible_child_name(key)
        SET.set('page', key)
        if getattr(page, 'fresh', False) or key in ('study', 'downloads', 'today'):
            page.fresh = False
            if hasattr(page, 'refresh'):
                page.refresh()
            if key in ('today', 'bible'):
                page.show()
        if not from_nav:
            for row in self.nav:
                if getattr(row, 'key', None) == key:
                    self.nav.select_row(row); break
        if self.split.get_collapsed():
            self.split.set_show_sidebar(False)

    def code_for(self, name):
        """'Exodus', '1 Chronicles', 'JHN' or a name in any language -> book code"""
        n = re.sub(r'\s+', ' ', name or '').strip()
        if re.fullmatch(r'[1-4A-Z]{3}', n.upper()) and len(n) == 3:
            return canon(n)
        i = STORE.kv('info') or {}
        for lg, books in (i.get('books') or {}).items():
            for code, nm in books.items():
                if nm.casefold() == n.casefold():
                    return code
        for tr in STORE.bibles():
            for code, nm in STORE.books(tr):
                if nm.casefold() == n.casefold():
                    return canon(code)
        return canon(n)

    def open_passage(self, book, ch, v=0, tr=None):
        code = self.code_for(book)
        b = self.bible
        if tr and tr in STORE.bibles() and tr != b.tr:
            b.tr = tr; SET.set('tr', tr)
        self.show('bible')
        if not STORE.find_book(b.tr, code):
            other = next((t for t in STORE.bibles() if STORE.find_book(t, code)), None)
            if other:
                b.tr = other; SET.set('tr', other)
        b.open_ref(code, int(ch), int(v or 0))

    def open_dict(self, i):
        self.show('dict')
        if not self.dict.open_id(i):
            self.toast('Not in the Bible Dictionary yet')

    def show_on_map(self, pid):
        if pid:
            self.show('maps'); self.maps.show_place(pid)

    def map_chapter(self, book, ch):
        self.show('maps'); self.maps.show_chapter(book, ch)

    def open_link(self, href):
        if not href:
            return
        if href.startswith('library:'):
            self.show('library'); self.library.open_href(href); return
        if href.startswith('sword-ref:'):
            from .library import osis_ref
            r = osis_ref(href[10:])
            if r:
                self.open_passage(*r)
            return
        v = verse_link(href)
        if v:
            self.open_passage(v[0], v[1], v[2]); return
        m = re.search(r'#kd:([\w-]+)', href) or re.match(r'kd:([\w-]+)', href)
        if m:
            self.open_dict(m.group(1)); return
        m = re.search(r'bible-dictionary/?\?(?:.*&)?(?:kd|e|entry)=([\w-]+)', href)
        if m:
            self.open_dict(m.group(1)); return
        if href.startswith('#'):
            return
        url = href if re.match(r'https?://', href) else SITE + ('' if href.startswith('/') else '/') + href
        Gtk.UriLauncher.new(url).launch(self, None, None, None)

    def dark_icon(self):
        d = Adw.StyleManager.get_default().get_dark()
        self.dark_btn.set_icon_name('weather-clear-symbolic' if d else 'weather-clear-night-symbolic')
        self.dark_btn.set_tooltip_text(_('Light') if d else _('Dark'))
        # the Bible's colours are drawn for light or dark: draw it again
        b = getattr(self, 'pages', {}).get('bible')
        if b is not None and getattr(b, 'book', None):
            try:
                b.show(keep=True)
            except Exception:
                pass

    @staticmethod
    def make_menu():
        # 2.8: SimpleX first to talk to us; the Android app beside this one; the daily post for the website's administrators
        menu = Gio.Menu()
        talk = Gio.Menu(); talk.append(_('Talk to us on SimpleX'), 'app.simplex'); talk.append(_('The Android app (Bible Corner)'), 'app.android'); menu.append_section(None, talk)
        look = Gio.Menu(); look.append(_('Follow the computer'), 'app.style::auto'); look.append(_('Light'), 'app.style::light'); look.append(_('Dark'), 'app.style::dark')
        menu.append_section(_('Appearance'), look)
        more = Gio.Menu(); more.append(_('Daily verse post (administrators)'), 'app.dpost'); more.append(_('Keyboard shortcuts'), 'app.keys'); more.append(_('About Bible Corner - KJT'), 'app.about'); menu.append_section(None, more)
        return menu

    def language_changed(self):
        from .dictionary import forget
        forget()
        # 2.8: the menus in the new language at once (the rest of the words when the app is opened again)
        self.menu_btn.set_menu_model(self.make_menu()); self.menu_btn.set_tooltip_text(_('Menu'))
        r = self.nav.get_first_child()
        while r:
            if hasattr(r, 'lab'):
                r.lab.set_label(_(r.title)); r.set_tooltip_text('%s (Ctrl+%d)' % (_(r.title), r.n + 1))
            r = r.get_next_sibling()
        try:
            self.toast(_('Some words change when the app is opened again.'))
        except Exception:
            pass
        for k, p in self.pages.items():
            p.fresh = True
        cur = self.stack.get_visible_child_name()
        if cur:
            self.show(cur)

    def offer_continue(self):
        """a small bubble: back to the very verse where you stopped reading"""
        p = SET.get('place')
        if not p or not have_data() or not STORE.find_book(p.get('tr', ''), p.get('book', '')):
            return False
        b = self.bible
        if p['book'] == b.book and p['ch'] == b.ch and p.get('v', 1) <= 2:
            return False
        t = Adw.Toast(title=GLib.markup_escape_text('Continue reading where you left off: %s %d:%d' % (b.code_name(p['book'], p['tr']), p['ch'], p.get('v', 1))), timeout=10, button_label=_('Continue'))
        def go(*_):
            if p['tr'] != b.tr:
                b.tr = p['tr']; SET.set('tr', p['tr'])
            self.show('bible'); b.go(p['book'], p['ch'], 0); b.scroll_to_verse(p.get('v', 1))
        t.connect('button-clicked', go)
        self.toasts.add_toast(t)
        return False

    # starting and stopping
    def first_run(self):
        if have_data():
            self.background()
            return False
        d = Adw.AlertDialog(heading=_('Welcome to Bible Corner - KJT'),
                            body=_('The app keeps the Holy Bible, the Holy Fathers, the Bible Dictionary and the Bible Maps on this computer, so you can read them without the internet. Choose your languages:'))
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4)
        flow = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=3, min_children_per_line=2, column_spacing=6)
        checks = {}
        for l in LANGS:
            cb = Gtk.CheckButton(label=LANG_NAMES[l], active=(l == 'en')); checks[l] = cb; flow.append(cb)
        box.append(flow)
        allr = Gtk.CheckButton(label=_('Also the Holy Fathers\' writings and commentary (about 60 MB)'), active=True, margin_top=8)
        allr.get_last_child().set_wrap(True) if isinstance(allr.get_last_child(), Gtk.Label) else None
        box.append(allr)
        d.set_extra_child(box)
        d.add_response('later', 'Later'); d.add_response('go', 'Download'); d.set_response_appearance('go', Adw.ResponseAppearance.SUGGESTED)
        def resp(_d, res):
            if res != 'go':
                return
            langs = [l for l, cb in checks.items() if cb.get_active()] or ['en']
            # the app's language stays the computer's own; the other languages are only downloaded
            if not NET.online():
                self.toast('Downloading needs the internet. Choose Downloads when you are online.'); return
            DL.start(default_plan(langs, allr.get_active()))
            self.show('downloads')
        d.connect('response', resp); d.present(self)
        return False

    def on_download(self, dl):
        if dl.busy:
            return
        for k, p in self.pages.items():
            p.fresh = True
        cur = self.stack.get_visible_child_name()
        if cur and cur != 'downloads':
            self.show(cur)
        if not dl.stop:
            self.toast('Everything is kept on this computer' if not dl.errors else 'Downloaded, with %d problems: try again later' % dl.errors)
        if cur == 'downloads' and have_data() and not SET.get('welcomed'):
            SET.set('welcomed', 1); self.show('today')

    def background(self):
        """now and then: what the website offers, Today with God, and your study"""
        def tick():
            if NET.online():
                def fin(_):
                    if (STORE.kv('info') or {}).get('user'):
                        STUDY.sync()
                    if 'today' in self.pages:
                        self.today.refresh()
                run_bg(lambda: info(refresh=True), fin)
            return True
        GLib.timeout_add_seconds(2, lambda: (tick(), False)[1])
        GLib.timeout_add_seconds(600, tick)

    def on_close(self, *_):
        if not self.is_maximized():
            w, h = self.get_default_size(); SET.set('w', w); SET.set('h', h)
        SET.set('max', self.is_maximized())
        return False


SIMPLEX = 'https://smp17.simplex.im/g#AiHuYaIlklw4qpYJXYIUbpX4_foaHUezMaHI4vNyAlw'   # the KJT group (as on the website)


class App(Adw.Application):
    def __init__(self):
        super().__init__(application_id=APP_ID, flags=Gio.ApplicationFlags.HANDLES_OPEN)
        GLib.set_application_name('Bible Corner - KJT')
        for name, fn, keys in (('about', self.about, None), ('keys', self.keys, ['<Ctrl>question']), ('quit', lambda *_: self.quit(), ['<Ctrl>q']),
                               ('simplex', lambda *_: self.open_uri(SIMPLEX), None), ('android', lambda *_: self.open_uri('https://biblecorner.com/app'), None),
                               ('dpost', lambda *_: __import__('kjt.dpost', fromlist=['open_post']).open_post(self.props.active_window), None)):
            a = Gio.SimpleAction.new(name, None); a.connect('activate', fn); self.add_action(a)
            if keys:
                self.set_accels_for_action('app.' + name, keys)

    def do_startup(self):
        Adw.Application.do_startup(self)
        disp = Gdk.Display.get_default()
        Gtk.IconTheme.get_for_display(disp).add_search_path(os.path.join(os.path.dirname(__file__), 'icons'))
        from .journey import CSS as JCSS, CSS_DARK as JDARK   # 2.11: Bible Study Journey
        p = Gtk.CssProvider(); p.load_from_data((CSS + JCSS).encode(), -1)
        Gtk.StyleContext.add_provider_for_display(disp, p, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
        dark = Gtk.CssProvider(); dark.load_from_data((DARK + JDARK).encode(), -1)
        sm = Adw.StyleManager.get_default()
        def scheme(*_):
            if sm.get_dark():
                Gtk.StyleContext.add_provider_for_display(disp, dark, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION + 1)
            else:
                Gtk.StyleContext.remove_provider_for_display(disp, dark)
        sm.connect('notify::dark', scheme); scheme()
        # 2.10: Appearance: follow the computer, light or dark (kept)
        st = SET.get('style') or 'auto'
        a = Gio.SimpleAction.new_stateful('style', GLib.VariantType.new('s'), GLib.Variant('s', st))
        a.connect('change-state', lambda act, v: self.set_style(v.get_string()))
        self.add_action(a); self.style_action = a; self.set_style(st)

    def set_style(self, st):
        st = st if st in ('auto', 'light', 'dark') else 'auto'
        SET.set('style', st); self.style_action.set_state(GLib.Variant('s', st))
        Adw.StyleManager.get_default().set_color_scheme({'auto': Adw.ColorScheme.DEFAULT, 'light': Adw.ColorScheme.FORCE_LIGHT, 'dark': Adw.ColorScheme.FORCE_DARK}[st])

    def do_activate(self):
        w = self.props.active_window or Window(self)
        w.present()

    def do_open(self, files, n, hint):
        self.do_activate()

    def about(self, *_):
        d = Adw.AboutDialog(application_name='Bible Corner - KJT', application_icon=APP_ID, version=VERSION, website='https://knowingjesus.today',
                            comments='The Holy Bible, the Holy Fathers, the Bible Dictionary and the Bible Maps, kept on your computer: the Orthodox faith, to know Jesus today.',
                            license_type=Gtk.License.GPL_2_0)
        d.set_developer_name('Knowing Jesus Today')
        d.add_credit_section('Places', ['OpenBible.info Bible Geocoding Data (CC BY 4.0)'])
        d.add_credit_section('Maps', ['Natural Earth (public domain)'])
        d.add_link('Talk to us on SimpleX', SIMPLEX)
        d.add_link('The Android app (Bible Corner)', 'https://biblecorner.com/app')
        d.add_credit_section('Library', ['CrossWire Bible Society https://crosswire.org', 'AndBible https://andbible.org', 'PySword versification tables (MIT)'])
        d.present(self.props.active_window)

    def open_uri(self, uri):
        Gtk.UriLauncher.new(uri).launch(self.props.active_window, None, None, None)

    def keys(self, *_):
        d = Adw.AlertDialog(heading='Keyboard shortcuts',
                            body='Ctrl+1 … Ctrl+7   the pages\n← →   previous and next chapter\nCtrl+F   search the Bible\nShift+click   choose several verses\nCtrl+click   add a verse to the choice\nEsc   clear the choice\nCtrl+Q   quit')
        d.add_response('ok', 'OK'); d.present(self.props.active_window)


def main():
    # if the app ever freezes, where it was stuck is written here (to send it, so it can be put right)
    import faulthandler
    from .core import DATA
    try:
        log = open(os.path.join(DATA, 'problems.log'), 'a')
        faulthandler.enable(file=log)
        faulthandler.dump_traceback_later(60, repeat=False, file=log, exit=False)
        def alive():
            faulthandler.cancel_dump_traceback_later(); faulthandler.dump_traceback_later(60, repeat=False, file=log, exit=False)
            return True
        GLib.timeout_add_seconds(20, alive)
    except Exception:
        pass
    return App().run(sys.argv)
