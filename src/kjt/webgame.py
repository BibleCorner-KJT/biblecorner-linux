"""2.25: the website's other games, and playing with a friend online, inside the app (the games' own engine in an
embedded view, as in the Android app; no browser opens). Its cookies stay in this app's own folder."""
import os
from gi.repository import Gtk, GLib
from .core import SITE, DATA, lang

try:
    import gi
    gi.require_version('WebKit', '6.0')
    from gi.repository import WebKit
except Exception:
    WebKit = None

_session = None


def session():
    global _session
    if _session is None and WebKit:
        d = os.path.join(DATA, 'web')
        _session = WebKit.NetworkSession.new(os.path.join(d, 'data'), os.path.join(d, 'cache'))
        try:
            _session.get_cookie_manager().set_persistent_storage(os.path.join(d, 'cookies.sqlite'), WebKit.CookiePersistentStorage.SQLITE)
        except Exception:
            pass
    return _session


def url(game=''):
    q = '?kjt_embed=1&kjt_linux=1' + ('&lang=' + lang() if lang() != 'en' else '')
    return SITE + '/fun-and-games/' + q + ('#play-' + game if game else '')


def view(game, on_title=None):
    """the game in a web view; None when this computer cannot show one (then the browser is offered)"""
    if not WebKit:
        return None
    wv = WebKit.WebView(network_session=session(), vexpand=True, hexpand=True)
    st = wv.get_settings()
    try:
        st.set_enable_developer_extras(False); st.set_media_playback_requires_user_gesture(False)
    except Exception:
        pass
    # links away from the games open in the browser
    def decide(v, dec, kind):
        try:
            if kind == WebKit.PolicyDecisionType.NAVIGATION_ACTION:
                u = dec.get_navigation_action().get_request().get_uri() or ''
                if u.startswith('http') and '/fun-and-games/' not in u and '/wp-admin/admin-ajax.php' not in u and dec.get_navigation_action().is_user_gesture():
                    Gtk.UriLauncher.new(u).launch(v.get_root(), None, None, None); dec.ignore(); return True
            elif kind == WebKit.PolicyDecisionType.NEW_WINDOW_ACTION:
                u = dec.get_navigation_action().get_request().get_uri() or ''
                if u:
                    Gtk.UriLauncher.new(u).launch(v.get_root(), None, None, None)
                dec.ignore(); return True
        except Exception:
            pass
        return False
    wv.connect('decide-policy', decide)
    if on_title:
        wv.connect('notify::title', lambda v, _p: on_title(v.get_title() or ''))
    wv.load_uri(url(game))
    return wv
