"""2.50 · the reminders of My Agenda (Daily Helps): the page gives the coming ones ({id, at, title, body}); they come as
notifications while the app runs (also in the background, when "keep running" is on in Settings)."""
import json, time
from gi.repository import Gio, GLib
from .core import STORE

_app = None
_timer = None


def set_list(js):
    try:
        lst = json.loads(js) if isinstance(js, str) else (js or [])
        STORE.set_kv('agenda_alarms', [r for r in lst if isinstance(r, dict) and r.get('at')][:100])
    except Exception:
        pass


def start(app):
    global _app, _timer
    _app = app
    if _timer is None:
        _timer = GLib.timeout_add_seconds(30, tick)
    tick()


def tick():
    try:
        now = time.time() * 1000
        lst = STORE.kv('agenda_alarms') or []
        fired = STORE.kv('agenda_fired') or {}
        left, changed = [], False
        for r in lst:
            key = '%s@%s' % (r.get('id'), r.get('at'))
            if r['at'] <= now:
                if now - r['at'] < 6 * 3600 * 1000 and key not in fired and _app:
                    n = Gio.Notification.new(r.get('title') or 'My Agenda'); n.set_body(r.get('body') or '')
                    n.set_default_action_and_target('app.notice', GLib.Variant('s', 'helps'))
                    try:
                        _app.send_notification('agenda-' + key, n)
                    except Exception:
                        pass
                    fired[key] = int(now); changed = True
            else:
                left.append(r)
        if changed:
            fired = {k: v for k, v in fired.items() if now - v < 3 * 86400 * 1000}
            STORE.set_kv('agenda_fired', fired); STORE.set_kv('agenda_alarms', left)
    except Exception:
        pass
    return True
