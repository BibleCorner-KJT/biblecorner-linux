"""Churches near me (2.16), made by the app: the website's directory of Orthodox churches and monasteries
(from OpenStreetMap, checked on the website), searched by town, postcode or name, or near where you are,
listed by distance and shown on a map. The town you type is looked up through the website (never sent
elsewhere); "Near me" asks your computer where you are, only when you press it, and it stays here."""
import json, math, random, re, time
from urllib.parse import quote
from gi.repository import Gtk, Adw, Gio, GLib, Pango, Gdk
from .core import STORE, SET, NET, SITE, lang, run_bg, log_problem
from .i18n import _
from .tilemap import TileMap

KINDS = ['church', 'cathedral', 'monastery', 'chapel', 'mission']
KIND_NAMES = {'church': 'Church', 'cathedral': 'Cathedral', 'monastery': 'Monastery', 'chapel': 'Chapel', 'mission': 'Mission'}
KIND_ICON = {'church': '⛪', 'cathedral': '⛪', 'monastery': '☦', 'chapel': '✝', 'mission': '✝'}
JURS = {'greek': 'Greek Orthodox', 'antiochian': 'Antiochian Orthodox', 'oca': 'Orthodox Church in America (OCA)',
        'russian': 'Russian Orthodox (ROCOR or Moscow)', 'serbian': 'Serbian Orthodox', 'romanian': 'Romanian Orthodox',
        'bulgarian': 'Bulgarian Orthodox', 'ukrainian': 'Ukrainian Orthodox', 'carpatho': 'Carpatho-Russian Orthodox (ACROD)',
        'georgian': 'Georgian Orthodox', 'albanian': 'Albanian Orthodox', 'jerusalem': 'Patriarchate of Jerusalem',
        'alexandria': 'Patriarchate of Alexandria', 'constantinople': 'Ecumenical Patriarchate of Constantinople', 'cyprus': 'Church of Cyprus',
        'polish': 'Polish Orthodox', 'czech': 'Orthodox Church of the Czech Lands and Slovakia',
        'rus-africa': 'Russian Orthodox, Exarchate of Africa', 'other': 'Orthodox (jurisdiction not given)'}
NOTES = {'rus-africa': 'The Exarchate of Africa was set up by the Moscow Patriarchate in 2021. The Patriarchate of Alexandria, to which the Orthodox Church in Africa belongs, does not recognise it.'}
JUR_COL = {'greek': '#1e5aa8', 'antiochian': '#8e2438', 'oca': '#2e7d6b', 'russian': '#b5442c', 'serbian': '#a8326e', 'romanian': '#c9a227',
           'bulgarian': '#3c8a3c', 'ukrainian': '#2b6ab0', 'carpatho': '#6b4c9a', 'georgian': '#9a3c3c', 'albanian': '#b03030',
           'jerusalem': '#7a1f78', 'alexandria': '#1f6f78', 'constantinople': '#6d4c2f', 'cyprus': '#d08a1f', 'polish': '#c03c5c',
           'czech': '#4c6b9a', 'rus-africa': '#8a6a3a', 'other': '#555555'}
CELL = 2
MAXLIST = 80


def urls():
    i = (STORE.kv('info') or {}).get('church') or {}
    return (i.get('data') or SITE + '/wp-content/uploads/kjt-cache/churches/'), (i.get('geo') or SITE + '/wp-json/kjt/v1/church-geocode')


def km(a, b, c, d):
    r = math.pi / 180
    x = math.sin((c - a) * r / 2) ** 2 + math.cos(a * r) * math.cos(c * r) * math.sin((d - b) * r / 2) ** 2
    return 12742 * math.asin(math.sqrt(min(1, x)))


def row_of(r):
    """[id,name,kind,jur,addr,city,region,postcode,country,lat,lon,web,phone,times,name_en,email,contact] -> dict"""
    r = list(r) + [''] * 17
    k = r[2] if isinstance(r[2], int) else 0
    return {'id': r[0], 'name': r[1] or '', 'kind': KINDS[k] if 0 <= k < len(KINDS) else 'church', 'jur': r[3] or 'other', 'addr': r[4] or '',
            'city': r[5] or '', 'region': r[6] or '', 'postcode': r[7] or '', 'country': r[8] or '', 'lat': float(r[9] or 0), 'lon': float(r[10] or 0),
            'web': r[11] or '', 'phone': r[12] or '', 'times': r[13] or '', 'name_en': r[14] or '', 'email': r[15] or '', 'contact': r[16] or ''}



def raw_of(d):
    """the other way (as the website keeps My churches)"""
    k = KINDS.index(d.get('kind')) if d.get('kind') in KINDS else 0
    return [d.get('id'), d.get('name', ''), k, d.get('jur', ''), d.get('addr', ''), d.get('city', ''), d.get('region', ''), d.get('postcode', ''),
            d.get('country', ''), d.get('lat', 0), d.get('lon', 0), d.get('web', ''), d.get('phone', ''), d.get('times', ''), d.get('name_en', ''),
            d.get('email', ''), d.get('contact', '')]

# ---------- where am I (the desktop's location portal: it asks you first) ----------
def locate(done, timeout=25):
    try:
        bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    except Exception:
        done(None); return
    tok = 'kjt%d' % random.randint(1, 10 ** 8)
    sender = bus.get_unique_name()[1:].replace('.', '_')
    sess = '/org/freedesktop/portal/desktop/session/%s/%s' % (sender, tok)
    state = {'over': False, 'subs': []}
    def finish(v):
        if state['over']:
            return
        state['over'] = True
        for s in state['subs']:
            bus.signal_unsubscribe(s)
        try:
            bus.call('org.freedesktop.portal.Desktop', sess, 'org.freedesktop.portal.Session', 'Close', None, None, Gio.DBusCallFlags.NONE, -1, None, None, None)
        except Exception:
            pass
        done(v)
    def updated(_c, _s, _p, _i, _sig, params):
        try:
            d = params.unpack()[1]
            finish((float(d['Latitude']), float(d['Longitude'])))
        except Exception:
            finish(None)
    def response(_c, _s, _p, _i, _sig, params):
        if params.unpack()[0] != 0:
            finish(None)
    state['subs'].append(bus.signal_subscribe('org.freedesktop.portal.Desktop', 'org.freedesktop.portal.Location', 'LocationUpdated',
                                              '/org/freedesktop/portal/desktop', None, Gio.DBusSignalFlags.NONE, updated))
    req = '/org/freedesktop/portal/desktop/request/%s/%s' % (sender, tok + 'r')
    state['subs'].append(bus.signal_subscribe('org.freedesktop.portal.Desktop', 'org.freedesktop.portal.Request', 'Response', req, None, Gio.DBusSignalFlags.NONE, response))
    def started(b, res):
        try:
            b.call_finish(res)
        except Exception:
            finish(None)
    def created(b, res):
        try:
            b.call_finish(res)
        except Exception:
            finish(None); return
        b.call('org.freedesktop.portal.Desktop', '/org/freedesktop/portal/desktop', 'org.freedesktop.portal.Location', 'Start',
               GLib.Variant('(osa{sv})', (sess, '', {'handle_token': GLib.Variant('s', tok + 'r')})), None, Gio.DBusCallFlags.NONE, -1, None, started)
    bus.call('org.freedesktop.portal.Desktop', '/org/freedesktop/portal/desktop', 'org.freedesktop.portal.Location', 'CreateSession',
             GLib.Variant('(a{sv})', ({'session_handle_token': GLib.Variant('s', tok), 'accuracy': GLib.Variant('u', 4)},)), None, Gio.DBusCallFlags.NONE, -1, None, created)
    GLib.timeout_add_seconds(timeout, lambda: (finish(None), False)[1])


# ---------- the page ----------
class ChurchPage(Gtk.Box):
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win; self.found = []; self.place = SET.get('ch_place') or None; self.here = None; self.open_id = None
        tv = Adw.ToolbarView(); tv.set_vexpand(True); self.append(tv)
        hb = Adw.HeaderBar(); tv.add_top_bar(hb); win.sidebar_button(hb)
        t = Gtk.Label(label=_('Churches near me')); t.add_css_class('heading'); hb.set_title_widget(t)
        # search, near me, filters
        bar = Gtk.Box(spacing=6, margin_top=8, margin_bottom=8, margin_start=10, margin_end=10)
        self.entry = Gtk.SearchEntry(hexpand=True, placeholder_text=_('Town, postcode or church name')); self.entry.connect('activate', lambda *_a: self.search())
        bar.append(self.entry)
        go = Gtk.Button(label=_('Search')); go.add_css_class('suggested-action'); go.connect('clicked', lambda *_a: self.search()); bar.append(go)
        me = Gtk.Button(label='📍 ' + _('Near me'), tooltip_text=_('Your computer asks you first; where you are stays here')); me.connect('clicked', lambda *_a: self.near_me()); bar.append(me)
        tv.add_top_bar(bar)
        fl = Gtk.Box(spacing=6, margin_bottom=6, margin_start=10, margin_end=10)
        self.kind = Gtk.DropDown.new_from_strings([_('All kinds')] + [_(KIND_NAMES[k]) for k in KINDS]); self.kind.connect('notify::selected', lambda *_a: self.draw())
        jl = sorted(JURS, key=lambda k: (k == 'other', JURS[k]))
        self.jkeys = [''] + jl
        self.jur = Gtk.DropDown.new_from_strings([_('All jurisdictions')] + [_(JURS[k]) for k in jl]); self.jur.connect('notify::selected', lambda *_a: self.draw())
        self.status = Gtk.Label(xalign=0, hexpand=True, ellipsize=Pango.EllipsizeMode.END); self.status.add_css_class('dim-label')
        fl.append(self.kind); fl.append(self.jur); fl.append(self.status)
        tv.add_top_bar(fl)
        # the list and the map
        self.listbox = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE); self.listbox.add_css_class('boxed-list')
        lb = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8, margin_top=6, margin_bottom=20, margin_start=10, margin_end=10)
        # 2.20: My churches: the ones you starred, kept on this computer, always at the top
        self.favhead = Gtk.Label(xalign=0); self.favhead.add_css_class('heading'); lb.append(self.favhead)
        self.favlist = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE); self.favlist.add_css_class('boxed-list'); lb.append(self.favlist)
        self.favnote = Gtk.Label(label=_('Star a church to keep it here, on this computer.'), xalign=0, wrap=True); self.favnote.add_css_class('dim-label'); self.favnote.add_css_class('caption'); lb.append(self.favnote)
        lb.append(self.listbox)
        credit = Gtk.Label(label=_('Church data © OpenStreetMap contributors (ODbL), checked on the website.'), xalign=0, wrap=True); credit.add_css_class('dim-label'); credit.add_css_class('caption')
        lb.append(credit)
        self.lsc = Gtk.ScrolledWindow(hscrollbar_policy=Gtk.PolicyType.NEVER, vexpand=True); self.lsc.set_child(lb)
        self.map = TileMap(on_pick=self.pick); self.map.on_move = self.moved_map; self.map.on_unpick = self.unpick
        # 2.25: Esc lets the chosen church go
        k = Gtk.EventControllerKey(); k.connect('key-pressed', lambda _c, kv, _k, _s: (self.unpick(), True)[1] if kv == Gdk.KEY_Escape and self.open_id is not None else False); self.add_controller(k)
        self.paned = Gtk.Paned(orientation=Gtk.Orientation.HORIZONTAL, wide_handle=True, shrink_start_child=False, shrink_end_child=False)
        self.lsc.set_size_request(340, -1); self.paned.set_start_child(self.lsc); self.paned.set_end_child(self.map); self.paned.set_position(440)
        tv.set_content(self.paned)
        self.loaded = False
        self.draw_favs()

    # 2.20: My churches
    def favs(self):
        f = SET.get('ch_fav')
        return f if isinstance(f, dict) else {}

    def is_fav(self, cid):
        return str(cid) in self.favs()

    def set_fav(self, r, on):
        f = dict(self.favs())
        if on:
            f[str(r['id'])] = {k: v for k, v in r.items() if k != 'd'}
        else:
            f.pop(str(r['id']), None)
        SET.set('ch_fav', f)
        self.draw_favs(); self.draw()
        self.fav_put(f)

    # 2.26: signed in, My churches are kept in the account (the same list as on the phone and the website)
    def fav_put(self, f):
        if not (STORE.kv('info') or {}).get('user'):
            return
        def work():
            from . import accounts as A
            import urllib.parse
            from .core import AJAX
            body = urllib.parse.urlencode({'action': 'kjt_ch_fav', 'fav': json.dumps({k: raw_of(v) for k, v in f.items()})}).encode()
            NET.get(AJAX, body, timeout=40, headers={'X-KJT-App': '1', 'Content-Type': 'application/x-www-form-urlencoded'})
        run_bg(work, lambda _r: None)

    def fav_get(self):
        if not (STORE.kv('info') or {}).get('user') or not NET.online():
            return
        def work():
            r = NET.ajax('kjt_ch_fav')
            return r.get('data') if r.get('success') else None
        def done(d):
            if not isinstance(d, dict):
                return
            acc = {str(k): row_of(v) for k, v in (d.get('fav') or {}).items() if isinstance(v, list)}
            loc = self.favs(); first = not SET.get('ch_fav_joined')
            out = dict(loc, **acc) if first else acc
            SET.set('ch_fav', out); SET.set('ch_fav_joined', 1)
            if first and any(k not in acc for k in loc):
                self.fav_put(out)
            self.draw_favs(); self.draw()
        run_bg(work, done)

    def star(self, r):
        b = Gtk.ToggleButton(active=self.is_fav(r['id']), valign=Gtk.Align.CENTER); b.add_css_class('flat'); b.add_css_class('kjt-ch-star')
        def look(b):
            on = b.get_active(); b.set_label('★' if on else '☆')
            b.set_tooltip_text(_('Remove from My churches') if on else _('Add to My churches'))
        look(b)
        def toggled(b):
            look(b)
            if b.get_active() != self.is_fav(r['id']):
                GLib.idle_add(lambda: (self.set_fav(r, b.get_active()), False)[1])
        b.connect('toggled', toggled)
        return b

    def draw_favs(self):
        while self.favlist.get_first_child():
            self.favlist.remove(self.favlist.get_first_child())
        f = list(self.favs().values())
        start = self.here or ((self.place['lat'], self.place['lon']) if self.place else None)
        for r in f:
            r = dict(r); r['d'] = km(start[0], start[1], r['lat'], r['lon']) if start else None
            self.favlist.append(self.row(r))
        self.favhead.set_label('★ ' + _('My churches') + (' (%d)' % len(f) if f else ''))
        self.favlist.set_visible(bool(f)); self.favnote.set_visible(not f)

    def set_compact(self, c):
        self.paned.set_orientation(Gtk.Orientation.VERTICAL if c else Gtk.Orientation.HORIZONTAL)
        self.lsc.set_size_request(-1 if c else 340, 220 if c else -1)
        self.paned.set_position(300 if c else 440)
        self.paned.set_start_child(None); self.paned.set_end_child(None)
        if c:
            self.paned.set_start_child(self.map); self.paned.set_end_child(self.lsc); self.map.set_size_request(-1, 260)
        else:
            self.paned.set_start_child(self.lsc); self.paned.set_end_child(self.map); self.map.set_size_request(-1, -1)

    # 2.23: the whole directory on the map, as on the website: numbers for each part of the world;
    # zoomed in, the churches in view (listed nearest the middle of the map first)
    DETAIL = 8

    def load_index(self):
        def done(ix):
            ix = ix if isinstance(ix, dict) else {}
            self.cells = ix.get('cells') or []
            if self.cells:
                if not self.found:
                    n = ix.get('n') or sum(c[1] for c in self.cells)
                    self.say(_('{0} Orthodox churches and monasteries in {1} countries. Search, press Near me, or zoom in on the map.').replace('{0}', '{:,}'.format(n)).replace('{1}', str(ix.get('countries') or '')))
            else:
                self.say(_('The church directory could not be reached. Check the internet, then try again.') + ((' (' + self.problem + ')') if getattr(self, 'problem', None) else ''))
            self.bubbles()
        run_bg(self.index, done)

    def bubbles(self):
        cells = getattr(self, 'cells', None) or []
        z = self.map.z
        if z >= self.DETAIL or not cells:
            self.map.set_bubbles([]); return
        step = 20 if z <= 3 else 10 if z == 4 else 6 if z == 5 else 4 if z == 6 else 2
        g = {}
        for c in cells:
            k = (int(math.floor(c[2] / step)), int(math.floor(c[3] / step)))
            a = g.setdefault(k, [0, 0.0, 0.0]); a[0] += c[1]; a[1] += c[2] * c[1]; a[2] += c[3] * c[1]
        self.map.set_bubbles([(a[1] / a[0], a[2] / a[0], a[0]) for a in g.values() if a[0]])

    def moved_map(self):
        self.bubbles()
        if self.map.z < self.DETAIL or not getattr(self, 'cells', None):
            return
        s_, w_, n_, e_ = self.map.bounds()
        keys = [c for c in self.cells if s_ - CELL <= c[2] <= n_ + CELL and w_ - CELL <= c[3] <= e_ + CELL]
        if len(keys) > 30:
            return
        lat, lon = self.map.lat, self.map.lon
        def work():
            out = []
            for c in keys:
                out += [row_of(r) for r in self.cell(c[0], c[4] if len(c) > 4 else 0)]
            inside = [r for r in out if s_ <= r['lat'] <= n_ and w_ <= r['lon'] <= e_]
            for r in inside:
                r['d'] = None; r['m'] = km(lat, lon, r['lat'], r['lon'])
            inside.sort(key=lambda r: r['m'])
            return inside
        def done(inside):
            if not isinstance(inside, list):
                return
            self.found = inside; self.center = None
            self.draw(fit=False, label=_('In this part of the map'))
            if not inside:
                self.say(_('No churches in this part of the map. Zoom out to see more.'))
        run_bg(work, done)

    def refresh(self):
        if self.loaded:
            return
        self.loaded = True
        self.load_index()
        self.fav_get()
        if self.place:
            self.entry.set_text(self.place.get('label', '')); self.at(self.place['lat'], self.place['lon'], self.place.get('label', ''))
        else:
            self.say(_('Type a town, a postcode or a church name, or press Near me.'))
            self.map.center(30, 10, 2)
            if self.favs():
                self.draw(); self.say(_('Type a town, a postcode or a church name, or press Near me.'))

    def say(self, t):
        self.status.set_label(t)

    # the directory
    def index(self):
        ix = STORE.kv('ch_index')
        if ix and ix.get('cells') and time.time() - ix.get('_t', 0) < 86400 or not NET.online():
            return ix or {}
        # 2.18: the website's address first, then the other address of the same site; a failure is said, not hidden
        old = ix
        for base in dict.fromkeys([urls()[0], SITE + '/wp-content/uploads/kjt-cache/churches/', 'https://biblecorner.com/wp-content/uploads/kjt-cache/churches/']):
            try:
                ix = json.loads(NET.get(base + 'index.json', timeout=40, strict=True).decode())
                ix['_t'] = time.time(); ix['_base'] = base; STORE.set_kv('ch_index', ix); self.problem = None
                return ix
            except Exception as e:
                self.problem = str(e)[:120]
                log_problem('churches index ' + base + ': ' + self.problem)
        # 2.20: through the website's address for the apps (when the files themselves are refused)
        try:
            r = NET.ajax('kjtb_desk', op='church_file', f='index')
            if r.get('success') and isinstance(r.get('data'), dict) and r['data'].get('cells'):
                ix = r['data']; ix['_t'] = time.time(); ix['_base'] = 'ajax'; STORE.set_kv('ch_index', ix); self.problem = None
                return ix
            log_problem('churches index (app address): ' + str(r.get('data'))[:120])
        except Exception as e:
            log_problem('churches index (app address): ' + str(e)[:120])
        return old or {}

    def cell(self, key, ver):
        c = STORE.kv('ch_c_' + key)
        if c and c.get('v') == ver:
            return c['c']
        if not NET.online():
            return (c or {}).get('c') or []
        try:
            base = (STORE.kv('ch_index') or {}).get('_base') or urls()[0]
            d = None
            if base != 'ajax':
                try:
                    d = json.loads(NET.get(base + 'c_%s.json?v=%s' % (key, ver), timeout=40, strict=True).decode())
                except Exception as e:
                    log_problem('churches square ' + key + ': ' + str(e)[:100])
            if d is None:
                r = NET.ajax('kjtb_desk', op='church_file', f='c_' + key)
                d = r['data'] if r.get('success') and isinstance(r.get('data'), dict) else None
            if d is None:
                raise ValueError('no square')
            STORE.set_kv('ch_c_' + key, {'v': ver, 'c': d.get('c') or []})
            kept = [x for x in (STORE.kv('ch_kept') or []) if x != key] + [key]
            STORE.set_kv('ch_kept', kept[-200:])
            return d.get('c') or []
        except Exception:
            return (c or {}).get('c') or []

    def around(self, lat, lon, ix):
        """the churches in the squares around a place (more squares where there are few)"""
        cells = {c[0]: c for c in ix.get('cells') or []}
        a, b = int(math.floor(lat / CELL)), int(math.floor(lon / CELL))
        out = []
        for ring in range(0, 4):
            for i in range(a - ring, a + ring + 1):
                for j in range(b - ring, b + ring + 1):
                    if max(abs(i - a), abs(j - b)) != ring:
                        continue
                    k = '%d_%d' % (i, j)
                    if k in cells:
                        out += [row_of(r) for r in self.cell(k, cells[k][4] if len(cells[k]) > 4 else 0)]
            if len(out) >= 40 and ring >= 1:
                break
        for r in out:
            r['d'] = km(lat, lon, r['lat'], r['lon'])
        out.sort(key=lambda r: r['d'])
        return out

    # finding
    def search(self):
        q = self.entry.get_text().strip()
        if not q:
            return
        self.say(_('Searching…'))
        def work():
            ix = self.index()
            # a church by its name, in what is kept here
            ql = q.casefold(); named = []
            if len(q) >= 3:
                for k in STORE.kv('ch_kept') or []:
                    for r in (STORE.kv('ch_c_' + k) or {}).get('c') or []:
                        rr = row_of(r)
                        if ql in rr['name'].casefold() or ql in rr['name_en'].casefold():
                            named.append(rr)
            g = {}
            # 2.18: through the website's usual address for the apps; its REST address if that one is not there
            try:
                r = NET.ajax('kjtb_desk', op='church_geo', q=q)
                if r.get('success') and isinstance(r.get('data'), dict):
                    g = r['data']
            except Exception as e:
                log_problem('church search (app address): ' + str(e)[:120])
            if not g.get('found') and not g.get('busy'):
                try:
                    u = urls()[1]
                    g2 = json.loads(NET.get(u + ('&' if '?' in u else '?') + 'q=' + quote(q), timeout=30).decode() or '{}')
                    if isinstance(g2, dict) and (g2.get('found') or g2.get('busy')):
                        g = g2
                except Exception as e:
                    log_problem('church search (REST): ' + str(e)[:120])
            if g.get('found'):
                return ('place', g['lat'], g['lon'], g.get('label') or q, self.around(g['lat'], g['lon'], ix))
            if named:
                return ('named', named)
            return ('none', g.get('busy'))
        def done(r):
            if isinstance(r, Exception) or not r:
                self.say(_('This page needs the internet. Try again when you are connected.')); return
            if r[0] == 'place':
                self.place = {'lat': r[1], 'lon': r[2], 'label': r[3]}; SET.set('ch_place', self.place)
                self.found = r[4]; self.here = None; self.show_found(r[1], r[2], r[3])
            elif r[0] == 'named':
                self.found = r[1]; self.show_found(None, None, q)
            else:
                self.say(_('Too many searches. Wait a minute, then try again.') if r[1] else _('No place found by that name. Try a town and its country.'))
        run_bg(work, done)

    def at(self, lat, lon, label):
        self.say(_('Searching…'))
        def done(r):
            if isinstance(r, list):
                self.found = r; self.show_found(lat, lon, label)
            else:
                self.say(_('This page needs the internet. Try again when you are connected.'))
        run_bg(lambda: self.around(lat, lon, self.index()), done)

    def near_me(self):
        self.say(_('Finding where you are…'))
        def got(p):
            if not p:
                self.say(_('Your location is not available. Type your town instead.')); self.entry.grab_focus(); return
            self.here = p; self.place = {'lat': p[0], 'lon': p[1], 'label': _('Near me')}
            self.entry.set_text(''); self.at(p[0], p[1], _('Near me'))
        locate(got)

    # showing
    def shown(self):
        k = self.kind.get_selected(); j = self.jkeys[self.jur.get_selected()] if self.jur.get_selected() < len(self.jkeys) else ''
        return [r for r in self.found if (not k or r['kind'] == KINDS[k - 1]) and (not j or r['jur'] == j)][:MAXLIST]

    def show_found(self, lat, lon, label):
        self.center = (lat, lon) if lat is not None else None
        self.draw(fit=True, label=label)

    def dist(self, d):
        if d is None:
            return ''
        mi = d * 0.621371
        return ('%.1f km' % d if d < 10 else '%d km' % round(d)) + ' · ' + ('%.1f mi' % mi if mi < 10 else '%d mi' % round(mi))

    def name(self, r):
        if r['name_en'] and lang() == 'en' and not re.search(r'[A-Za-z]', r['name']):
            return r['name_en']
        return r['name'] or r['name_en'] or _(KIND_NAMES[r['kind']])

    def draw(self, fit=False, label=None):
        while self.listbox.get_first_child():
            self.listbox.remove(self.listbox.get_first_child())
        rows = self.shown()
        if label is not None:
            self.label = label
        n = len(rows)
        if not n and getattr(self, 'problem', None) and not (STORE.kv('ch_index') or {}).get('cells'):
            self.say(_('The church directory could not be reached. Check the internet, then try again.') + ' (' + self.problem + ')')
        else:
            self.say((_('Churches found') + ': %d' % n + (' · ' + self.label if getattr(self, 'label', '') else '')) if n else _('No churches found here yet. Try a larger town nearby.'))
        for r in rows:
            self.listbox.append(self.row(r))
        ids = {r['id'] for r in rows}
        marks = [(r['lat'], r['lon'], r['id'], JUR_COL.get(r['jur'], '#7a1f78'), self.name(r)) for r in rows]
        marks += [(r['lat'], r['lon'], r['id'], '#d4a017', '★ ' + self.name(r)) for r in self.favs().values() if r['id'] not in ids]
        self.map.set_marks(marks, sel=self.open_id, here=self.here)
        if fit:
            near = [r for r in rows if r.get('d') is None or r['d'] <= max(25, rows[min(4, len(rows) - 1)].get('d') or 0) * 1.2] if rows else []
            pts = [(r['lat'], r['lon']) for r in near[:12]] + ([self.center] if getattr(self, 'center', None) else [])
            GLib.idle_add(lambda: (self.map.fit(pts, maxz=14), self.bubbles(), False)[2])

    def row(self, r):
        ex = Adw.ExpanderRow(title=GLib.markup_escape_text(self.name(r)),
                             subtitle=GLib.markup_escape_text(' · '.join(x for x in (_(KIND_NAMES[r['kind']]), _(JURS.get(r['jur'], JURS['other'])), self.dist(r.get('d'))) if x)))
        ex.set_title_lines(2); ex.set_subtitle_lines(2)
        ic = Gtk.Label(label=KIND_ICON.get(r['kind'], '⛪')); ic.add_css_class('kjt-ch-ic'); ex.add_prefix(ic)
        ex.add_suffix(self.star(r))
        ex.connect('notify::expanded', lambda e, _p, r=r: self.opened(r) if e.get_expanded() else None)
        addr = ', '.join(x for x in (r['addr'], ' '.join(y for y in (r['postcode'], r['city']) if y), r['region'], r['country']) if x)
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_top=8, margin_bottom=10, margin_start=14, margin_end=14)
        if r['name_en'] and r['name_en'] != r['name']:
            box.append(Gtk.Label(label=r['name_en'] if self.name(r) != r['name_en'] else r['name'], xalign=0, wrap=True, css_classes=['dim-label']))
        if addr:
            box.append(Gtk.Label(label='📍 ' + addr, xalign=0, wrap=True, selectable=True))
        if r['times']:
            box.append(Gtk.Label(label='🕯 ' + r['times'], xalign=0, wrap=True, selectable=True))
        if r['jur'] in NOTES:
            box.append(Gtk.Label(label=_(NOTES[r['jur']]), xalign=0, wrap=True, css_classes=['dim-label', 'caption']))
        acts = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=4, min_children_per_line=1, column_spacing=6, row_spacing=6)
        def link(label, uri):
            b = Gtk.Button(label=label); b.add_css_class('pill'); b.connect('clicked', lambda *_a: Gtk.UriLauncher.new(uri).launch(self.win, None, None, None)); acts.append(b)
        # 2.18: directions here, as on the website (car, on foot, by bike), drawn on the map, step by step
        dbtn = Gtk.Button(label='🧭 ' + _('Directions')); dbtn.add_css_class('pill'); dbtn.add_css_class('suggested-action')
        dbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, visible=False)
        dbtn.connect('clicked', lambda *_a, r=r: (dbox.set_visible(True), self.directions(r, dbox, 'car') if not dbox.get_first_child() else None)); acts.append(dbtn)
        if r['web']:
            link('🌐 ' + _('Website'), r['web'] if r['web'].startswith('http') else 'https://' + r['web'])
        if r['phone']:
            link('📞 ' + r['phone'], 'tel:' + re.sub(r'[^\d+]', '', r['phone']))
        if r['email']:
            link('✉ ' + _('Email'), 'mailto:' + r['email'])
        if r['contact'] and r['contact'].startswith('http'):
            link('💬 ' + _('Contact'), r['contact'])
        box.append(acts); box.append(dbox)
        ex.add_row(box)
        ex.cid = r['id']
        return ex

    ROUTE = {'car': 'https://routing.openstreetmap.de/routed-car/route/v1/driving/', 'foot': 'https://routing.openstreetmap.de/routed-foot/route/v1/foot/',
             'bike': 'https://routing.openstreetmap.de/routed-bike/route/v1/bike/'}

    def directions(self, r, box, mode):
        """the way from where you are (Near me) or the place you searched, to this church"""
        while box.get_first_child():
            box.remove(box.get_first_child())
        start = self.here or ((self.place['lat'], self.place['lon']) if self.place else None)
        modes = Gtk.Box(spacing=0); modes.add_css_class('linked'); first = None
        for k, lab in (('car', '🚗 ' + _('By car')), ('foot', '🚶 ' + _('On foot')), ('bike', '🚲 ' + _('By bike'))):
            b = Gtk.ToggleButton(label=lab, active=k == mode, group=first); first = first or b
            b.connect('toggled', lambda b, k=k: self.directions(r, box, k) if b.get_active() and k != mode else None); modes.append(b)
        box.append(modes)
        msg = Gtk.Label(xalign=0, wrap=True); msg.add_css_class('dim-label'); box.append(msg)
        osm = Gtk.Button(label=_('Open in OpenStreetMap'), halign=Gtk.Align.START); osm.add_css_class('flat')
        frm = ('%f%%2C%f' % start) if start else ''
        osm.connect('clicked', lambda *_a: Gtk.UriLauncher.new('https://www.openstreetmap.org/directions?engine=fossgis_osrm_%s&from=%s&to=%f%%2C%f' % ({'car': 'car', 'foot': 'foot', 'bike': 'bike'}[mode], frm, r['lat'], r['lon'])).launch(self.win, None, None, None))
        if not start:
            msg.set_label(_('Press Near me, or search your town, to start from there.')); box.append(osm); return
        msg.set_label(_('Finding the way…'))
        url = self.ROUTE[mode] + '%f,%f;%f,%f?overview=full&geometries=geojson&steps=true' % (start[1], start[0], r['lon'], r['lat'])
        def work():
            return json.loads(NET.get(url, timeout=40, strict=True).decode())
        def done(j):
            if not isinstance(j, dict) or j.get('code') != 'Ok' or not j.get('routes'):
                msg.set_label(_('No way was found. Try another way of travelling, or open it in OpenStreetMap.')); box.append(osm); return
            rt = j['routes'][0]
            pts = [(c[1], c[0]) for c in (rt.get('geometry') or {}).get('coordinates') or []]
            self.map.set_route(pts); self.map.fit(pts[::max(1, len(pts) // 40)] + [pts[-1]] if pts else [], maxz=16)
            msg.set_label('%s · %s' % (self.dist(rt.get('distance', 0) / 1000.0), self.dur(rt.get('duration', 0))))
            msg.remove_css_class('dim-label'); msg.add_css_class('heading')
            lst = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
            for leg in rt.get('legs') or []:
                for st in leg.get('steps') or []:
                    t = step_text(st)
                    if t:
                        row = Gtk.Box(spacing=8)
                        row.append(Gtk.Label(label=t, xalign=0, wrap=True, hexpand=True))
                        if st.get('distance', 0) > 0:
                            d = st['distance']; l2 = Gtk.Label(label=('%d m' % round(d) if d < 1000 else '%.1f km' % (d / 1000))); l2.add_css_class('dim-label'); row.append(l2)
                        lst.append(row)
            box.append(lst)
            note = Gtk.Label(label=_('The way is worked out by routing.openstreetmap.de, as on the website. Check the road signs as you go.'), xalign=0, wrap=True)
            note.add_css_class('caption'); note.add_css_class('dim-label'); box.append(note); box.append(osm)
        run_bg(work, done)

    def dur(self, sec):
        m = int(round(sec / 60.0))
        return ('%d min' % m) if m < 60 else ('%d h %02d min' % (m // 60, m % 60))

    def opened(self, r):
        self.open_id = r['id']; self.map.select(r['id'])
        if self.map.z < 13:
            self.map.center(r['lat'], r['lon'], 14)
        else:
            self.map.center(r['lat'], r['lon'])

    def unpick(self):
        self.open_id = None; self.map.select(None); self.map.set_route([])
        for box in (self.favlist, self.listbox):
            ch = box.get_first_child()
            while ch is not None:
                if hasattr(ch, 'get_expanded') and ch.get_expanded():
                    ch.set_expanded(False)
                ch = ch.get_next_sibling()

    def pick(self, cid):
        """a mark chosen on the map: its church opened in the list"""
        self.open_id = cid
        lb = self.listbox.get_parent()
        for box in (self.favlist, self.listbox):
            ch = box.get_first_child()
            while ch is not None:
                if getattr(ch, 'cid', None) == cid:
                    ch.set_expanded(True)
                    GLib.idle_add(lambda ch=ch: (self.lsc.get_vadjustment().set_value(max(0, ch.compute_bounds(lb)[1].get_y() - 20)) if ch.compute_bounds(lb)[0] else None, False)[1])
                elif ch.get_expanded() if hasattr(ch, 'get_expanded') else False:
                    ch.set_expanded(False)
                ch = ch.get_next_sibling()


TURN = {'left': 'Turn left', 'right': 'Turn right', 'slight left': 'Turn slightly left', 'slight right': 'Turn slightly right',
        'sharp left': 'Turn sharp left', 'sharp right': 'Turn sharp right', 'straight': 'Go straight on', 'uturn': 'Make a U-turn'}


def step_text(st):
    """a step of the way, in words (from the routing service's step)"""
    m = st.get('maneuver') or {}; t = m.get('type', ''); mod = m.get('modifier', ''); name = st.get('name') or ''
    on = (' ' + _('onto') + ' ' + name) if name else ''
    if t == 'depart':
        return _('Head out') + on
    if t == 'arrive':
        return '⛪ ' + _('You have arrived')
    if t in ('roundabout', 'rotary', 'roundabout turn', 'exit roundabout', 'exit rotary'):
        n = m.get('exit')
        return (_('At the roundabout, take exit') + ' %d' % n if n else _('At the roundabout')) + on
    if t in ('fork', 'on ramp', 'off ramp') and mod in ('left', 'slight left', 'sharp left'):
        return _('Keep left') + on
    if t in ('fork', 'on ramp', 'off ramp') and mod in ('right', 'slight right', 'sharp right'):
        return _('Keep right') + on
    if t == 'new name' or (t == 'continue' and mod in ('straight', '')):
        return (_('Go straight on') + on) if name else ''
    if mod in TURN:
        return _(TURN[mod]) + on
    return (_('Go straight on') + on) if name else ''
