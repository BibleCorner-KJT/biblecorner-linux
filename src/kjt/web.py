"""2.15: website pages shown inside the app, as in the Android app: Prayer, Good Fun (the games) and Churches near me.
Only the website's own pages open here; any other link opens in your web browser. Bible links open in the app's Bible.
What the games keep (scores, names) stays in the app's own folder."""
import os, re
from urllib.parse import urlparse, urlencode
from gi.repository import Gtk, Adw, GLib, Pango
from .core import SITE, DATA, STORE, lang
from .i18n import _

try:
    import gi
    gi.require_version('WebKit', '6.0')
    from gi.repository import WebKit
except Exception:          # no web view on this computer: the page opens in the browser instead
    WebKit = None

OURS = ('knowingjesus.today', 'biblecorner.com')
PAGES = {
    'pray': ('Prayer', SITE + '/prayer/'),
    'fun': ('Good Fun', SITE + '/fun-and-games/'),
    'church': ('Churches near me', SITE + '/find-a-church/'),
}
_session = None


def ours(host):
    host = (host or '').lower()
    return any(host == h or host.endswith('.' + h) for h in OURS) or host == (urlparse(SITE).hostname or '')


def session():
    global _session
    if _session is None and WebKit:
        d = os.path.join(DATA, 'web'); os.makedirs(d, exist_ok=True)
        _session = WebKit.NetworkSession.new(os.path.join(d, 'data'), os.path.join(d, 'cache'))
        try:
            _session.get_cookie_manager().set_persistent_storage(os.path.join(d, 'cookies.sqlite'), WebKit.CookiePersistentStorage.SQLITE)
        except Exception:
            pass
    return _session


def address(key):
    title, fallback = PAGES[key]
    u = ((STORE.kv('info') or {}).get('pages') or {}).get(key) or fallback
    q = {'kjt_app': '1'}
    if lang() != 'en':
        q['lang'] = lang()
    return u + ('&' if '?' in u else '?') + urlencode(q)


class WebPage(Gtk.Box):
    def __init__(self, win, key):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win, self.key, self.loaded = win, key, None
        tv = Adw.ToolbarView(); tv.set_vexpand(True); self.append(tv)
        hb = Adw.HeaderBar(); tv.add_top_bar(hb); win.sidebar_button(hb)
        self.back = Gtk.Button(icon_name='kjt-prev-symbolic', tooltip_text=_('Back'), sensitive=False); self.back.connect('clicked', lambda *_a: self.web.go_back())
        hb.pack_start(self.back)
        t = Gtk.Label(label=_(PAGES[key][0]), ellipsize=Pango.EllipsizeMode.END); t.add_css_class('heading'); hb.set_title_widget(t)
        rl = Gtk.Button(icon_name='kjt-refresh-symbolic', tooltip_text=_('Reload')); rl.connect('clicked', lambda *_a: self.reload())
        ob = Gtk.Button(icon_name='kjt-globe-symbolic', tooltip_text=_('Open in your web browser')); ob.connect('clicked', lambda *_a: self.out(self.current()))
        hb.pack_end(ob); hb.pack_end(rl)
        self.bar = Gtk.ProgressBar(); self.bar.add_css_class('osd'); self.bar.set_visible(False)
        ov = Gtk.Overlay(); tv.set_content(ov)
        if WebKit:
            self.web = WebKit.WebView(network_session=session(), vexpand=True, hexpand=True)
            s = self.web.get_settings(); s.set_enable_developer_extras(False); s.set_javascript_can_open_windows_automatically(False)
            self.web.connect('decide-policy', self.policy)
            self.web.connect('permission-request', self.permission)
            self.web.connect('notify::estimated-load-progress', lambda w, _p: (self.bar.set_fraction(w.get_estimated_load_progress()), self.bar.set_visible(w.get_estimated_load_progress() < 1)))
            self.web.connect('load-changed', lambda w, _e: self.back.set_sensitive(w.can_go_back()))
            self.web.connect('load-failed', self.failed)
            ov.set_child(self.web)
        else:
            self.web = None
            st = Adw.StatusPage(icon_name='kjt-globe-symbolic', title=_(PAGES[key][0]), description=_('This page opens in your web browser.'))
            b = Gtk.Button(label=_('Open in your web browser'), halign=Gtk.Align.CENTER); b.add_css_class('pill'); b.add_css_class('suggested-action')
            b.connect('clicked', lambda *_a: self.out(address(self.key))); st.set_child(b); ov.set_child(st)
        self.bar.set_valign(Gtk.Align.START); ov.add_overlay(self.bar)

    def out(self, uri):
        Gtk.UriLauncher.new(uri).launch(self.win, None, None, None)

    def current(self):
        return (self.web.get_uri() if self.web else None) or address(self.key)

    def refresh(self):
        """shown: the page in the reader's language (loaded again when the language changed)"""
        if self.web and self.loaded != lang():
            self.loaded = lang(); self.web.load_uri(address(self.key))

    def reload(self):
        if self.web:
            self.web.reload()

    def failed(self, w, _ev, uri, err):
        html = ('<html><body style="font-family:sans-serif;text-align:center;padding:3em;color:#555"><h2>%s</h2><p>%s</p></body></html>'
                % (GLib.markup_escape_text(_(PAGES[self.key][0])), GLib.markup_escape_text(_('This page needs the internet. Try again when you are connected.'))))
        w.load_alternate_html(html, uri, None); self.loaded = None
        return True

    def permission(self, w, req):
        # Churches near me may ask where you are (the website's own page only); nothing else is allowed
        if WebKit and isinstance(req, WebKit.GeolocationPermissionRequest) and ours(urlparse(w.get_uri() or '').hostname):
            req.allow()
        else:
            req.deny()
        return True

    def policy(self, w, decision, kind):
        if not WebKit or kind not in (WebKit.PolicyDecisionType.NAVIGATION_ACTION, WebKit.PolicyDecisionType.NEW_WINDOW_ACTION):
            return False
        uri = decision.get_navigation_action().get_request().get_uri() or ''
        u = urlparse(uri)
        if u.scheme in ('about', 'data', 'blob'):
            return False
        # a Bible passage: in the app's own Bible
        if '#/p/' in uri or '#/read/' in uri:
            decision.ignore(); self.win.open_link(uri); return True
        if u.scheme in ('http', 'https') and ours(u.hostname):
            if kind == WebKit.PolicyDecisionType.NAVIGATION_ACTION:
                return False
            decision.ignore(); w.load_uri(uri); return True      # a new window of our own site: here
        decision.ignore()
        if u.scheme in ('http', 'https', 'mailto', 'tel', 'geo') or uri.startswith('simplex:'):
            self.out(uri)
        return True
