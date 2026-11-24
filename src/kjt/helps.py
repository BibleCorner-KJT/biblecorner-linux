"""2.49 · Daily Helps: My Agenda (for children), the prayer rope, my rule of prayer, names to remember, a thanksgiving
journal and the fasting helper. The same small program as on the website and in the Android app, kept inside this app
(kjt/tools), so it works with no internet. What a person writes stays on this computer (in the app's own web storage)."""
from gi.repository import Gtk, Adw
from .core import lang
from .i18n import _


class HelpsPage(Gtk.Box):
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win; self.wv = None; self.lang = None
        tv = Adw.ToolbarView(); tv.set_vexpand(True); self.append(tv); self.tv = tv
        hb = Adw.HeaderBar(); tv.add_top_bar(hb); win.sidebar_button(hb)
        t = Gtk.Label(label=_('Daily Helps')); t.add_css_class('heading'); hb.set_title_widget(t)
        home = Gtk.Button(icon_name='kjt-home-symbolic', tooltip_text=_('All the helps')); home.add_css_class('flat')
        home.connect('clicked', lambda *_a: self.open('')); hb.pack_start(home)
        self.draw()

    def url(self, which=''):
        from .sitecache import BASE, TOOLS
        return BASE + TOOLS + 'tools.html?lang=' + lang() + ('#' + which if which else '')

    def draw(self):
        from . import webgame
        self.lang = lang()
        self.wv = webgame.view_url(self.url()) if webgame.WebKit else None
        if self.wv is None:
            st = Adw.StatusPage(icon_name='kjt-heart-symbolic', title=_('Daily Helps'),
                                description=_('This computer cannot show the Daily Helps here. They are on the website: biblecorner.com/daily-helps/'))
            self.tv.set_content(st); return
        self.tv.set_content(self.wv)

    def open(self, which):
        if self.wv is not None:
            self.wv.load_uri(self.url(which))

    def refresh(self):
        if self.lang != lang():   # the language changed in Downloads
            self.draw()
