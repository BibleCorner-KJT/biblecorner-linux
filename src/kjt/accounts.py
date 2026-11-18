"""2.24: several accounts on this computer, switched with one click, and an avatar for each (as in the Android app).

For each person who signed in here, the website gives a "switch pass" (never a password). The passes are kept in the
computer's keyring (GNOME Keyring / KWallet, through the Secret service) when it can be reached, otherwise in a file
only you can read. Switching sends what is waiting first, then opens the other person's study."""
import json, os, math, uuid
from gi.repository import GLib, Gdk
from .core import NET, STORE, DATA, run_bg, info, log_problem

ACCT_FILE = os.path.join(DATA, 'accounts.json')
_SECRET = None


def _secret():
    global _SECRET
    if _SECRET is None:
        try:
            import gi
            gi.require_version('Secret', '1')
            from gi.repository import Secret
            _SECRET = (Secret, Secret.Schema.new('today.knowingjesus.KJT.accounts', Secret.SchemaFlags.NONE, {'app': Secret.SchemaAttributeType.STRING}))
        except Exception:
            _SECRET = False
    return _SECRET


def load():
    s = _secret()
    if s:
        try:
            v = s[0].password_lookup_sync(s[1], {'app': 'kjt'}, None)
            if v:
                return json.loads(v)
        except Exception as e:
            log_problem('keyring read: ' + str(e)[:100])
    try:
        with open(ACCT_FILE) as f:
            return json.load(f)
    except Exception:
        return []


def save(lst):
    s = _secret()
    if s:
        try:
            s[0].password_store_sync(s[1], {'app': 'kjt'}, s[0].COLLECTION_DEFAULT, 'Bible Corner - KJT accounts', json.dumps(lst), None)
            if os.path.exists(ACCT_FILE):
                os.remove(ACCT_FILE)
            return
        except Exception as e:
            log_problem('keyring write: ' + str(e)[:100])
    tmp = ACCT_FILE + '.part'
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as f:
        json.dump(lst, f)
    os.replace(tmp, ACCT_FILE)


def post(fields, photo=None):
    """the website's accounts address: only the apps may use it (the X-KJT-App header)"""
    if photo:
        bd = uuid.uuid4().hex; parts = []
        for k, v in fields.items():
            parts.append(('--%s\r\nContent-Disposition: form-data; name="%s"\r\n\r\n%s\r\n' % (bd, k, v)).encode())
        with open(photo, 'rb') as f:
            data = f.read()
        parts.append(('--%s\r\nContent-Disposition: form-data; name="photo"; filename="photo"\r\nContent-Type: application/octet-stream\r\n\r\n' % bd).encode() + data + b'\r\n')
        parts.append(('--%s--\r\n' % bd).encode())
        body = b''.join(parts); ctype = 'multipart/form-data; boundary=' + bd
    else:
        import urllib.parse
        body = urllib.parse.urlencode(dict(fields, action='kjtb_acct')).encode(); ctype = 'application/x-www-form-urlencoded'
        fields = None
    from .core import AJAX
    url = AJAX + ('?action=kjtb_acct' if photo else '')
    b = NET.get(url, body, timeout=60, headers={'X-KJT-App': '1', 'Content-Type': ctype})
    try:
        return json.loads(b.decode('utf-8'))
    except Exception:
        return {'success': False, 'data': {'code': 'answer'}}


def me():
    try:
        r = NET.ajax('kjtb_acct', op='me')
        return r['data'] if r.get('success') else None
    except Exception:
        return None


def remember(m=None):
    """the person signed in now is kept here (a switch pass is asked for once)"""
    m = m or me()
    if not m or not m.get('id'):
        return None
    lst = load(); hit = next((a for a in lst if a.get('id') == m['id']), None)
    if hit:
        hit['name'] = m.get('name'); hit['avatar'] = m.get('avatar'); save(lst); return m
    r = post({'op': 'pass', 'device': 'Linux computer'})
    if r.get('success') and r['data'].get('pass'):
        lst = [a for a in load() if a.get('id') != m['id']]
        lst.append({'id': m['id'], 'name': m.get('name'), 'avatar': m.get('avatar'), 'pass': r['data']['pass']}); save(lst)
    return m


def forget(a):
    try:
        post({'op': 'forget', 'pass': a['pass']})
    except Exception:
        pass
    save([x for x in load() if x.get('id') != a.get('id')])


def switch(a):
    """returns 'ok', 'expired' or 'error' (the cookie of the other person comes with the answer)"""
    r = post({'op': 'switch', 'pass': a['pass']})
    if r.get('success'):
        STORE.put_records([], replace=True); STORE.put_pads([], replace=True)
        info(refresh=True)
        return 'ok'
    if (r.get('data') or {}).get('code') == 'expired':
        save([x for x in load() if x.get('id') != a.get('id')])
        return 'expired'
    return 'error'


# ---------- the avatar, drawn ----------
def texture(av, name, size=96):
    """a picture for Adw.Avatar: the photo, or a symbol (or the first letter) on its colour"""
    av = av or {}
    if av.get('t') == 'photo' and av.get('url'):
        d = os.path.join(DATA, 'avatars'); os.makedirs(d, exist_ok=True)
        p = os.path.join(d, os.path.basename(av['url']).split('?')[0])
        if os.path.exists(p):
            try:
                return Gdk.Texture.new_from_filename(p)
            except Exception:
                pass
        return None
    import cairo
    from gi.repository import Pango, PangoCairo
    sf = cairo.ImageSurface(cairo.FORMAT_ARGB32, size, size); cr = cairo.Context(sf)
    rgba = Gdk.RGBA(); rgba.parse(av.get('c') or '#7a1f78')
    cr.arc(size / 2, size / 2, size / 2, 0, 2 * math.pi); cr.set_source_rgb(rgba.red, rgba.green, rgba.blue); cr.fill()
    t = av.get('s') if av.get('t') == 'sym' and av.get('s') else ((name or '✓').strip()[:1] or '✓').upper()
    lay = PangoCairo.create_layout(cr); lay.set_text(t, -1)
    lay.set_font_description(Pango.FontDescription.from_string('Sans Bold %d' % int(size * 0.36)))
    w, h = lay.get_pixel_size(); cr.set_source_rgb(1, 1, 1); cr.move_to((size - w) / 2, (size - h) / 2); PangoCairo.show_layout(cr, lay)
    sf.flush()
    p = os.path.join(DATA, 'avatars'); os.makedirs(p, exist_ok=True); fn = os.path.join(p, '_drawn.png'); sf.write_to_png(fn)
    with open(fn, 'rb') as f:
        return Gdk.Texture.new_from_bytes(GLib.Bytes.new(f.read()))


def fetch_photo(av):
    """keep the photo here (in the background)"""
    if not av or av.get('t') != 'photo' or not av.get('url'):
        return
    d = os.path.join(DATA, 'avatars'); os.makedirs(d, exist_ok=True)
    p = os.path.join(d, os.path.basename(av['url']).split('?')[0])
    if not os.path.exists(p):
        data = NET.get(av['url'], timeout=30, strict=True)
        with open(p + '.part', 'wb') as f:
            f.write(data)
        os.replace(p + '.part', p)
