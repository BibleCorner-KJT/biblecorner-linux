"""2.26: the website's own pages (the games) inside the app, exactly as on the website, and kept for use without the
internet. They are shown from kjt-site://app/…, which this app answers itself: with the internet it fetches the page
from the website (with this app's own sign-in) and keeps a copy; without it, it gives the copy kept here. Playing
online (the website's addresses for it) goes through the same way."""
import hashlib, json, os, re, threading, urllib.request, urllib.error
from gi.repository import GLib, Gio
from .core import SITE, DATA, NET, AJAX, log_problem

SCHEME = 'kjt-site'
BASE = SCHEME + '://app'
DIR = os.path.join(DATA, 'sitecache')
_done = False
TEXT = ('text/', 'application/javascript', 'application/json', 'application/x-javascript', 'image/svg')


def to_site(uri):
    return SITE + uri[len(BASE):] if uri.startswith(BASE) else uri


def to_app(url):
    return BASE + url[len(SITE):] if url.startswith(SITE) else url


def _rewrite(body, ctype):
    if not any(ctype.startswith(t) for t in TEXT):
        return body
    try:
        s = body.decode('utf-8')
    except Exception:
        return body
    host = SITE.split('://', 1)[1]
    s = s.replace(SITE, BASE).replace(SITE.replace('/', '\\/'), BASE.replace('/', '\\/')).replace('"//' + host, '"' + BASE).replace("'//" + host, "'" + BASE)
    return s.encode('utf-8')


def _key(url):
    return os.path.join(DIR, hashlib.sha1(url.encode()).hexdigest())


def _keep(url, status, ctype, body):
    try:
        os.makedirs(DIR, exist_ok=True)
        with open(_key(url) + '.part', 'wb') as f:
            f.write(body)
        os.replace(_key(url) + '.part', _key(url))
        with open(_key(url) + '.json', 'w') as f:
            json.dump({'url': url, 'type': ctype, 'status': status}, f)
    except Exception:
        pass


def _kept(url):
    try:
        with open(_key(url) + '.json') as f:
            m = json.load(f)
        with open(_key(url), 'rb') as f:
            return m.get('status', 200), m.get('type', 'application/octet-stream'), f.read()
    except Exception:
        return None


def fetch(url, method='GET', body=None, ctype=None):
    """(status, content type, body) from the website, or the copy kept here"""
    keepable = method == 'GET' and '/wp-admin/admin-ajax.php' not in url and '/wp-json/' not in url
    if NET.online():
        try:
            h = {'X-KJT-App': '1'} if method == 'POST' else {}
            if ctype:
                h['Content-Type'] = ctype
            req_url = url
            opener = getattr(NET, 'op', None)
            req = urllib.request.Request(req_url, data=body if method == 'POST' else None, method=method,
                                         headers=dict({'User-Agent': 'Mozilla/5.0 (X11; Linux) BibleCornerKJT', 'Accept-Encoding': 'identity'}, **h))
            r = (opener.open(req, timeout=40) if opener else urllib.request.urlopen(req, timeout=40))
            data = r.read(); st = r.status; ct = r.headers.get('Content-Type', 'application/octet-stream').split(';')[0].strip()
            if keepable and st == 200:
                _keep(url, st, ct, data)
            return st, ct, data
        except urllib.error.HTTPError as e:
            try:
                return e.code, e.headers.get('Content-Type', 'text/plain').split(';')[0], e.read()
            except Exception:
                return e.code, 'text/plain', b''
        except Exception as e:
            log_problem('site page ' + url[-80:] + ': ' + str(e)[:80])
    k = _kept(url)
    if k:
        return k
    if not keepable and method == 'GET' and '/wp-admin/admin-ajax.php' in url:
        return 200, 'application/json', b'{"success":false,"data":{"code":"offline"}}'
    return 404, 'text/html', ('<html><body style="font-family:sans-serif;padding:2em">' +
                              'This needs the internet once, then it is kept on this computer.</body></html>').encode()


def _answer(req):
    uri = req.get_uri(); url = to_site(uri)
    method = req.get_http_method() or 'GET'; body = None; ctype = None
    if method == 'POST':
        try:
            st = req.get_http_body()
            if st:
                chunks = []
                while True:
                    b = st.read_bytes(65536, None).get_data()
                    if not b:
                        break
                    chunks.append(b)
                body = b''.join(chunks)
            hh = req.get_http_headers()
            ctype = hh.get_one('Content-Type') if hh else None
        except Exception:
            body = b''
    def work():
        status, ct, data = fetch(url, method, body, ctype)
        data = _rewrite(data, ct)
        GLib.idle_add(lambda: (_finish(req, status, ct, data), False)[1])
    threading.Thread(target=work, daemon=True).start()


def _finish(req, status, ct, data):
    from gi.repository import WebKit
    try:
        stream = Gio.MemoryInputStream.new_from_bytes(GLib.Bytes.new(data))
        resp = WebKit.URISchemeResponse.new(stream, len(data))
        resp.set_status(int(status), None); resp.set_content_type(ct + ('; charset=utf-8' if any(ct.startswith(t) for t in TEXT) else ''))
        req.finish_with_response(resp)
    except Exception as e:
        try:
            req.finish_error(GLib.Error(str(e)))
        except Exception:
            pass


def register(WebKit):
    global _done
    if _done:
        return
    _done = True
    ctx = WebKit.WebContext.get_default()
    ctx.register_uri_scheme(SCHEME, _answer)
    sm = ctx.get_security_manager()
    for f in ('register_uri_scheme_as_secure', 'register_uri_scheme_as_cors_enabled'):
        try:
            getattr(sm, f)(SCHEME)
        except Exception:
            pass


# ---------- keep all the games here (for use without the internet) ----------
def keep_games(progress=None, cancel=None, fresh=True):
    """fetches the games page and every file the games use; returns how many files are kept
    (2.27: progress(i, n) is called from this thread; a file kept already is kept as it is unless fresh)"""
    page = SITE + '/fun-and-games/?kjt_embed=1&kjt_linux=1'
    st, ct, html = fetch(page)
    if st != 200:
        return 0
    urls = set(re.findall(r'''(?:src|href)=["'](%s[^"'#]+)["']''' % re.escape(SITE), html.decode('utf-8', 'replace')))
    try:
        r = NET.ajax('kjt_games_files')
        if r.get('success'):
            urls |= set(r['data'] or [])
    except Exception:
        pass
    n = 0; urls = sorted(urls)
    for i, u in enumerate(urls):
        if cancel and cancel():
            break
        if progress:
            progress(i + 1, len(urls))
        if not fresh and _kept(u):
            n += 1; continue
        if fetch(u)[0] == 200:
            n += 1
    return n


def kept_size():
    t = 0
    try:
        for f in os.listdir(DIR):
            t += os.path.getsize(os.path.join(DIR, f))
    except Exception:
        pass
    return t
