"""Bible Maps, drawn here: the land in its real colours, every place of Scripture, and the story maps."""
import json, math, re
import cairo
from gi.repository import Gtk, Adw, Gdk, GdkPixbuf, GLib, Pango, PangoCairo
from .core import STORE, SET, lang, read_file, file_path, book_name, strip_tags
from .i18n import _

COL = {'s': '#7a1f6b', 'r': '#8a7a5a', 'm': '#6d4c2f', 'w': '#1f6f9b', 'i': '#2e7d6b', 'v': '#6b7a2e', 'c': '#b5442c', 'o': '#555555'}
WATERS = [['w_med', 27.6, 33.3, 1.6], ['w_dead', 35.47, 31.1, 0], ['w_gal', 35.6, 32.95, 0], ['w_red', 38.6, 20.5, 1.2], ['w_black', 34.5, 43.4, 1.3],
          ['w_casp', 50.6, 41.2, 1], ['w_pers', 51.2, 27.3, 1], ['w_nile', 31.0, 25.2, 0.6], ['w_euph', 41.0, 34.9, 0.6], ['w_tig', 43.9, 35.9, 0.4], ['w_jor', 35.57, 32.35, 0]]
KIND = {'s': '●', 'r': '▭', 'm': '▲', 'w': '≈', 'i': '◆', 'v': '⌄', 'c': '⛺', 'o': '•'}
KIND_KEYS = ['s', 'r', 'm', 'w', 'i', 'v', 'c', 'o']
MINS, MAXS = 0.03, 900


def rgb(h, a=1.0):
    h = h.lstrip('#'); return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a)


def parse_path(d):
    """SVG path (M L H V Z, absolute or relative) -> list of (points, closed)"""
    out, cur, x, y, sx, sy = [], None, 0.0, 0.0, 0.0, 0.0
    toks = re.findall(r'[MmLlHhVvZz]|-?\d*\.?\d+(?:e-?\d+)?', d or '')
    cmd, i = 'M', 0
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t; i += 1
            if cmd in 'Zz':
                if cur:
                    out.append((cur, True)); cur = None
                x, y = sx, sy
            continue
        if cmd in 'Mm':
            a, b = float(toks[i]), float(toks[i + 1]); i += 2
            if cur:
                out.append((cur, False))
            x, y = (x + a, y + b) if cmd == 'm' else (a, b)
            sx, sy = x, y; cur = [(x, y)]
            cmd = 'l' if cmd == 'm' else 'L'
        elif cmd in 'Ll':
            a, b = float(toks[i]), float(toks[i + 1]); i += 2
            x, y = (x + a, y + b) if cmd == 'l' else (a, b); cur.append((x, y))
        elif cmd in 'Hh':
            a = float(toks[i]); i += 1; x = x + a if cmd == 'h' else a; cur.append((x, y))
        elif cmd in 'Vv':
            a = float(toks[i]); i += 1; y = y + a if cmd == 'v' else a; cur.append((x, y))
        else:
            i += 1
    if cur:
        out.append((cur, False))
    return out


# the soft colours of today's countries (each country differs from its neighbours: Natural Earth's MAPCOLOR7)
WORLD_COLS = ['#f1dfb8', '#e2cfe6', '#cfe3c3', '#f3cdbd', '#c9dbef', '#ece3a9', '#dcc6ae']


class Map:
    """the map data, read once"""
    def __init__(self):
        self.ok = False
        self.on_fixed = []

    def load(self):
        b = read_file('maps/base.json'); pl = read_file('maps/places.json')
        if not b or not pl:
            self.ok = False; return False
        self.w, self.h, self.box, self.k, self.c = b['w'], b['h'], b['box'], b['k'], b['c']
        self.land = parse_path(b['land']); self.lakes = parse_path(b.get('lakes')); self.rivers = parse_path(b.get('rivers')); self.borders = parse_path(b.get('borders'))
        self.P = []
        for r in pl['p']:
            vs = r[6].split(' ') if r[6] else []
            self.P.append({'id': r[0], 'en': r[1], 't': r[2], 'x': r[3], 'y': r[4], 'c': r[5], 'v': vs, 'n': len(vs), 'd': r[7], 'j': r[8], 'alts': r[9], 'at': r[11] if len(r) > 11 else ''})
        self.BY = {p['id']: p for p in self.P}
        self.stories = read_file('maps/stories.json') or []
        self.words_all = read_file('maps/words.json') or {}
        self.chapters = read_file('maps/chapters.json') or {}
        self.ident = read_file('maps/ident.json') or {}
        self.set_lang(lang())
        self.relief = {}
        w = read_file('maps/world.json') or {}
        self.wland = parse_path(w.get('land')); self.wborders = parse_path(w.get('borders'))
        self.countries = w.get('countries') or []; self.capitals = w.get('capitals') or []
        # 2.18: each country of today's world in its own soft colour (Natural Earth, public domain)
        cj = read_file('maps/countries.json') or {}
        self.cpoly = []
        for c in cj.get('c') or []:
            parts = parse_path(c[3]); xs = [x for pts, _c in parts for x, _y in pts]; ys = [y for pts, _c in parts for _x, y in pts]
            if xs:
                self.cpoly.append((int(c[0]), parts, (min(xs), min(ys), max(xs), max(ys))))
        self.ok = True
        if (pl.get('v') or 1) < 2 and not getattr(self, 'fixing', False):
            self.fix_data()
        return True

    def fetch_atlas_list(self, done):
        import threading
        from .core import NET, write_file
        def run():
            try:
                write_file('maps/atlas.json', NET.file('maps/atlas.json'))
                for k in ('words.json',):
                    write_file('maps/' + k, NET.file('maps/' + k))
            except Exception:
                return
            def again():
                self.words_all = read_file('maps/words.json') or self.words_all; self.set_lang(self.lang); done(); return False
            GLib.idle_add(again)
        threading.Thread(target=run, daemon=True).start()

    def fix_data(self):
        """2.8: the map data were corrected (the figurative Babylons of Revelation were pinned on Rome, and more):
        the corrected files replace the old ones by themselves, then the map is drawn again"""
        import threading
        from .core import NET, write_file
        self.fixing = True
        def run():
            try:
                for f in ('places.json', 'chapters.json', 'words.json'):
                    write_file('maps/' + f, NET.file('maps/' + f))
            except Exception:
                self.fixing = False; return
            def again():
                self.ok = False
                if self.load():
                    for cb in list(self.on_fixed):
                        cb()
                return False
            GLib.idle_add(again)
        threading.Thread(target=run, daemon=True).start()

    def set_lang(self, l):
        self.lang = l
        self.W = dict(self.words_all.get('en') or {}, **(self.words_all.get(l) or {}))
        self.names = (read_file('maps/names-%s.json' % l) or {}) if l != 'en' else {}

    def T(self, k, *a):
        s = str(self.W.get(k, k))
        for i, x in enumerate(a):
            s = s.replace('{%d}' % i, str(x))
        return s

    def wn(self, names):
        return names.get(self.lang) or names.get('en') or ''

    def inside(self, x, y):
        """inside the Bible map itself (the world around it shows only countries and capitals)"""
        return 0 <= x <= self.w and 0 <= y <= self.h

    def nm(self, p):
        return self.names.get(p['id']) or p['en']

    def U(self, lon, lat):
        return ((lon - self.box[0]) * self.k * self.c, (self.box[3] - lat) * self.k)

    def image(self, name):
        if name not in self.relief:
            try:
                pb = GdkPixbuf.Pixbuf.new_from_file(file_path('maps/relief/' + name))
                surf = cairo.ImageSurface(cairo.FORMAT_RGB24, pb.get_width(), pb.get_height())
                cr = cairo.Context(surf); Gdk.cairo_set_source_pixbuf(cr, pb, 0, 0); cr.paint()
                self.relief[name] = surf
            except Exception:
                self.relief[name] = None
        return self.relief[name]


M = Map()


class MapView(Gtk.DrawingArea):
    def __init__(self, page):
        super().__init__(hexpand=True, vexpand=True)
        self.page = page
        self.cx, self.cy, self.s = 0, 0, 1
        self.sel = None; self.only = None; self.story = None; self.stops = []; self.step_i = -1
        self.shown = {k: True for k in KIND_KEYS}
        self.visible = []
        self.set_draw_func(self.draw)
        self.fitted = False
        d = Gtk.GestureDrag(); d.connect('drag-begin', self.drag_begin); d.connect('drag-update', self.drag_update); self.add_controller(d)
        sc = Gtk.EventControllerScroll(flags=Gtk.EventControllerScrollFlags.VERTICAL); sc.connect('scroll', self.on_scroll); self.add_controller(sc)
        mo = Gtk.EventControllerMotion(); mo.connect('motion', lambda c, x, y: setattr(self, 'mouse', (x, y))); self.add_controller(mo)
        z = Gtk.GestureZoom(); z.connect('begin', lambda g, s: setattr(self, 'zs', self.s)); z.connect('scale-changed', lambda g, f: (self.zooming(), self.zoom_to(self.zs * f))); self.add_controller(z)
        c = Gtk.GestureClick(); c.connect('released', self.on_click); self.add_controller(c)
        self.mouse = (0, 0); self.moved = False; self.touched = False; self.vsize = (0, 0)
        self.cache = None; self.busy_zoom = False; self.zoom_timer = 0

    # where things are
    def to_screen(self, x, y):
        return ((x - self.cx) * self.s + self.get_width() / 2, (y - self.cy) * self.s + self.get_height() / 2)

    def to_map(self, sx, sy):
        return ((sx - self.get_width() / 2) / self.s + self.cx, (sy - self.get_height() / 2) / self.s + self.cy)

    def in_view(self, x, y, m=0):
        sx, sy = self.to_screen(x, y)
        return -m <= sx <= self.get_width() + m and -m <= sy <= self.get_height() + m

    def fit(self, b, pad=0):
        w, h = max(1, self.get_width()), max(1, self.get_height())
        bw, bh = max(b[2], 1e-3), max(b[3], 1e-3)
        self.s = max(MINS, min(MAXS, min(w / bw, h / bh) * 0.92))
        self.cx, self.cy = b[0] + bw / 2, b[1] + bh / 2
        self.queue_draw()

    def home(self):
        if self.get_height() > self.get_width() * 1.15:
            a, b = M.U(27.5, 39.5), M.U(45.5, 26.5)   # a tall, narrow screen: the Bible lands, not the whole map
            self.fit([a[0], a[1], b[0] - a[0], b[1] - a[1]])
        else:
            self.fit([0, 0, M.w, M.h])

    def jerusalem(self):
        a = M.U(35.205, 31.792); b = M.U(35.262, 31.762)
        self.fit([a[0], a[1], b[0] - a[0], b[1] - a[1]])

    def fit_points(self, pts, minspan=3):
        if not pts:
            return
        xs = [p['x'] for p in pts]; ys = [p['y'] for p in pts]
        x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
        w, h = max(x1 - x0, minspan), max(y1 - y0, minspan)
        self.fit([(x0 + x1) / 2 - w / 2, (y0 + y1) / 2 - h / 2, w, h])

    def zoom_to(self, ns, px=None, py=None):
        ns = max(MINS, min(MAXS, ns))
        if px is None:
            px, py = self.get_width() / 2, self.get_height() / 2
        mx, my = self.to_map(px, py)
        self.s = ns
        self.cx = mx - (px - self.get_width() / 2) / ns; self.cy = my - (py - self.get_height() / 2) / ns
        self.queue_draw()

    def center(self, x, y, s=None):
        self.cx, self.cy = x, y
        if s:
            self.s = max(MINS, min(MAXS, s))
        self.queue_draw()

    # moving
    def drag_begin(self, g, x, y):
        self.d0 = (self.cx, self.cy); self.moved = False; self.touched = True

    def drag_update(self, g, dx, dy):
        if abs(dx) + abs(dy) > 3:
            self.moved = True
        self.cx = self.d0[0] - dx / self.s; self.cy = self.d0[1] - dy / self.s; self.queue_draw()

    def on_scroll(self, c, dx, dy):
        self.touched = True; self.zooming(); self.zoom_to(self.s * (1.12 ** (-max(-3, min(3, dy)))), *self.mouse); return True

    def on_click(self, g, n, x, y):
        if self.moved:
            self.moved = False; return
        best, bd = None, 14 ** 2
        if self.story:
            for st in self.stops:
                sx, sy = self.to_screen(st['x'], st['y']); d = (sx - x) ** 2 + (sy - y) ** 2
                if d < bd:
                    best, bd = st, d
            if best:
                self.page.go_step(best['i'])
            return
        for p in self.visible:
            sx, sy = self.to_screen(p['x'], p['y']); d = (sx - x) ** 2 + (sy - y) ** 2
            if d < bd:
                best, bd = p, d
        if best:
            self.page.choose(best)

    # drawing
    def min_n(self):
        s = self.s
        return 0 if self.only else (12 if s < 0.22 else 5 if s < 0.5 else 2 if s < 1.2 else 0)

    def poly(self, cr, parts, close_all=False):
        for pts, closed in parts:
            cr.move_to(*pts[0])
            for p in pts[1:]:
                cr.line_to(*p)
            if closed or close_all:
                cr.close_path()

    # the land, the waters and the borders: drawn once into a picture a little larger than the window,
    # which then only slides while the map is moved (and is drawn again when it stops)
    def paint_base(self, cr, vw, vh):
        c = self.cache
        if c and c['vw'] == vw and c['vh'] == vh:
            dx, dy = (self.cx - c['cx']) * self.s, (self.cy - c['cy']) * self.s
            if c['s'] == self.s and abs(dx) < c['mw'] - 2 and abs(dy) < c['mh'] - 2:
                cr.set_source_surface(c['surf'], vw / 2 - c['W'] / 2 - dx, vh / 2 - c['H'] / 2 - dy); cr.paint(); return
            if c['s'] != self.s and self.busy_zoom:
                cr.set_source_rgba(*rgb('#dbe7ee')); cr.paint()
                cr.save(); cr.translate(vw / 2 + (c['cx'] - self.cx) * self.s, vh / 2 + (c['cy'] - self.cy) * self.s); cr.scale(self.s / c['s'], self.s / c['s'])
                cr.translate(-c['W'] / 2, -c['H'] / 2); cr.set_source_surface(c['surf'], 0, 0); cr.get_source().set_filter(cairo.FILTER_FAST); cr.paint(); cr.restore()
                return
        mw, mh = int(vw * 0.25) + 2, int(vh * 0.25) + 2
        while (vw + 2 * mw) * (vh + 2 * mh) > 24_000_000 and mw > 2:
            mw, mh = mw // 2, mh // 2
        W, H = vw + 2 * mw, vh + 2 * mh
        surf = cairo.ImageSurface(cairo.FORMAT_RGB24, W, H)
        b = cairo.Context(surf)
        b.set_source_rgba(*rgb('#bcd8ea')); b.paint()                       # the sea
        b.translate(W / 2, H / 2); b.scale(self.s, self.s); b.translate(-self.cx, -self.cy)
        lw = 1 / self.s
        if M.wland or getattr(M, 'cpoly', None):   # the rest of the world: only outside the Bible map's own frame
            b.save(); b.set_fill_rule(cairo.FILL_RULE_EVEN_ODD)
            b.rectangle(-1e6, -1e6, 2e6, 2e6); b.rectangle(0, 0, M.w, M.h); b.clip()
            b.set_fill_rule(cairo.FILL_RULE_WINDING)
            if getattr(M, 'cpoly', None):
                # 2.18: a political map: each country in its own soft colour, white borders between them
                x0, y0 = self.cx - W / 2 / self.s, self.cy - H / 2 / self.s; x1, y1 = self.cx + W / 2 / self.s, self.cy + H / 2 / self.s
                for col, parts, bb in M.cpoly:
                    if bb[2] < x0 or bb[0] > x1 or bb[3] < y0 or bb[1] > y1:
                        continue
                    self.poly(b, parts, True); b.set_source_rgba(*rgb(WORLD_COLS[(col - 1) % len(WORLD_COLS)])); b.fill_preserve()
                    b.set_source_rgba(1, 1, 1, 0.9); b.set_line_width(1.1 * lw); b.stroke()
            else:
                self.poly(b, M.wland, True); b.set_source_rgba(*rgb('#ece5d3')); b.fill()
                self.poly(b, M.wborders); b.set_source_rgba(*rgb('#b3a588', 0.75)); b.set_line_width(0.8 * lw); b.stroke()
            b.restore()
            b.rectangle(0, 0, M.w, M.h); b.set_source_rgba(*rgb('#cdbf9f', 0.5)); b.set_line_width(lw); b.stroke()
        self.poly(b, M.land, True)
        b.set_source_rgba(*rgb('#efe6cf')); b.fill_preserve()
        b.save(); b.clip()
        img = M.image('overview.jpg')
        if img:
            b.save(); b.scale(M.w / img.get_width(), M.h / img.get_height()); b.set_source_surface(img, 0, 0)
            b.get_source().set_filter(cairo.FILTER_GOOD); b.paint(); b.restore()
        if self.s > 0.9:
            tw, th = M.w / 6, M.h / 3
            x0, y0 = self.cx - W / 2 / self.s, self.cy - H / 2 / self.s
            x1, y1 = self.cx + W / 2 / self.s, self.cy + H / 2 / self.s
            for r in range(3):
                for col in range(6):
                    if col * tw > x1 or (col + 1) * tw < x0 or r * th > y1 or (r + 1) * th < y0:
                        continue
                    t = M.image('t%d-%d.jpg' % (r, col))
                    if t:
                        b.save(); b.translate(col * tw - 0.5, r * th - 0.5); b.scale((tw + 1) / t.get_width(), (th + 1) / t.get_height())
                        b.set_source_surface(t, 0, 0); b.get_source().set_filter(cairo.FILTER_GOOD); b.paint(); b.restore()
        b.restore()
        self.poly(b, M.borders); b.set_source_rgba(*rgb('#a89878', 0.6)); b.set_line_width(0.8 * lw); b.set_dash([3 * lw, 3 * lw]); b.stroke(); b.set_dash([])
        self.poly(b, M.lakes, True); b.set_source_rgba(*rgb('#cfe0ea')); b.fill_preserve(); b.set_source_rgba(*rgb('#8fb2c8')); b.set_line_width(0.8 * lw); b.stroke()
        self.poly(b, M.rivers); b.set_source_rgba(*rgb('#5f95bb')); b.set_line_width(1.4 * lw); b.set_line_cap(cairo.LINE_CAP_ROUND); b.set_line_join(cairo.LINE_JOIN_ROUND); b.stroke()
        self.cache = {'surf': surf, 's': self.s, 'cx': self.cx, 'cy': self.cy, 'vw': vw, 'vh': vh, 'W': W, 'H': H, 'mw': mw, 'mh': mh}
        cr.set_source_surface(surf, vw / 2 - W / 2, vh / 2 - H / 2); cr.paint()

    def zooming(self):
        """while the wheel turns, the picture is only stretched; drawn sharp again a moment after"""
        self.busy_zoom = True
        if self.zoom_timer:
            GLib.source_remove(self.zoom_timer)
        def done():
            self.zoom_timer = 0; self.busy_zoom = False; self.queue_draw(); return False
        self.zoom_timer = GLib.timeout_add(160, done)

    def draw(self, area, cr, vw, vh):
        if not M.ok:
            cr.set_source_rgba(*rgb('#dbe7ee')); cr.paint(); return
        if self.fitted and not self.touched and (vw, vh) != self.vsize and not self.story and self.only is None and not self.sel:
            self.vsize = (vw, vh); self.home(); return
        self.vsize = (vw, vh)
        if not self.fitted and vw > 10:
            self.fitted = True
            if not getattr(self.page, 'pending', None):
                self.home()
            else:
                GLib.idle_add(self.page.run_pending)
        self.paint_base(cr, vw, vh)
        cr.save()
        cr.translate(vw / 2, vh / 2); cr.scale(self.s, self.s); cr.translate(-self.cx, -self.cy)
        lw = 1 / self.s
        # a story
        st = self.story
        if st:
            for n, t in enumerate(st.get('tribes') or []):
                hue = (n * 47) % 360
                self.poly(cr, t['_d'], True)
                on = self.step_i >= 0 and self.stops[self.step_i].get('tribe') == n
                cr.set_source_rgba(*hsl(hue, .55, .55, .55 if on else .32)); cr.fill_preserve()
                cr.set_source_rgba(*hsl(hue, .45, .35, 1)); cr.set_line_width((2.5 if on else 1) * lw); cr.stroke()
            if not st.get('nolines'):
                for li, leg in enumerate(st.get('legs') or []):
                    col = st['cs'][li] if st.get('cs') else st['c']
                    for k in range(1, len(leg)):
                        a, b = leg[k - 1], leg[k]
                        mx, my = (a['x'] + b['x']) / 2, (a['y'] + b['y']) / 2
                        bend = 0.12 if k % 2 else -0.12
                        qx, qy = mx - (b['y'] - a['y']) * bend, my + (b['x'] - a['x']) * bend
                        cr.move_to(a['x'], a['y'])
                        cr.curve_to(a['x'] + 2 / 3 * (qx - a['x']), a['y'] + 2 / 3 * (qy - a['y']), b['x'] + 2 / 3 * (qx - b['x']), b['y'] + 2 / 3 * (qy - b['y']), b['x'], b['y'])
                    cr.set_source_rgba(*rgb(col, .85)); cr.set_line_width(2.6 * lw); cr.set_dash([7 * lw, 4 * lw]); cr.stroke(); cr.set_dash([])
        cr.restore()
        # pins (in screen space, so they keep their size)
        self.visible = []
        if not st:
            mn, city = self.min_n(), self.s > 60
            for p in M.P:
                if self.only is not None and p['id'] not in self.only:
                    continue
                if self.only is None and (not self.shown.get(p['t']) or p['t'] == 'r'):
                    continue
                if p['j'] and not city and self.only is None:
                    continue
                # another name of the same spot is not a pin of its own: it is named on the place's pin
                if p['at'] and p is not self.sel and (self.only is None or p['at'] in self.only):
                    continue
                if p['n'] < mn and p is not self.sel:
                    continue
                if not self.in_view(p['x'], p['y'], 40):
                    continue
                self.visible.append(p)
                sx, sy = self.to_screen(p['x'], p['y'])
                cr.arc(sx, sy, 3.6, 0, 2 * math.pi); cr.set_source_rgba(1, 1, 1, .95); cr.fill()
                cr.arc(sx, sy, 2.6, 0, 2 * math.pi); cr.set_source_rgba(*rgb(COL.get(p['t'], '#555555'))); cr.fill()
            if self.sel and self.in_view(self.sel['x'], self.sel['y'], 40):
                sx, sy = self.to_screen(self.sel['x'], self.sel['y'])
                cr.arc(sx, sy, 11, 0, 2 * math.pi); cr.set_source_rgba(*rgb('#f3c548', .45)); cr.fill()
                cr.arc(sx, sy, 6, 0, 2 * math.pi); cr.set_source_rgba(*rgb('#3e093f')); cr.fill()
                cr.arc(sx, sy, 3, 0, 2 * math.pi); cr.set_source_rgba(*rgb('#f3c548')); cr.fill()
        else:
            seen = set()
            for p in self.stops:
                if st.get('tribes'):
                    continue
                sx, sy = self.to_screen(p['x'], p['y'])
                on = p['i'] == self.step_i
                r = 11 if on else 9
                cr.arc(sx, sy, r, 0, 2 * math.pi); cr.set_source_rgba(*rgb(p.get('col') or st['c'])); cr.fill_preserve()
                cr.set_source_rgba(1, 1, 1, 1); cr.set_line_width(2 if on else 1.5); cr.stroke()
                key = (round(p['x'] * 10), round(p['y'] * 10))
                if key not in seen:
                    seen.add(key); self.text(cr, str(p['i'] + 1), sx, sy, 9.5, '#ffffff', mid=True, bold=True, halo=False)
        if not st and M.capitals and self.s > 0.06:
            for x, y, rk, names in M.capitals:
                # 2.18: today's capitals everywhere (also in the Bible lands: Jerusalem, Damascus, Cairo, Amman…), small and grey
                if not self.in_view(x, y) or rk > self.world_rank() + (2 if M.inside(x, y) else 0):
                    continue
                sx, sy = self.to_screen(x, y)
                cr.rectangle(sx - 2.5, sy - 2.5, 5, 5); cr.set_source_rgba(1, 1, 1, .9); cr.fill_preserve()
                cr.set_source_rgba(*rgb('#7b8088')); cr.set_line_width(1.4); cr.stroke()
        self.labels(cr, vw, vh)
        self.scale_bar(cr, vw, vh)

    def world_rank(self):
        s = self.s
        return 1 if s < 0.05 else 3 if s < 0.09 else 5 if s < 0.2 else 7 if s < 0.6 else 10

    def scale_bar(self, cr, vw, vh):
        """a ruler at the bottom: how far that is on the ground"""
        km_px = 111.32 / (M.k * self.s)
        best = None
        for e in range(-2, 5):
            for m in (1, 2, 5):
                d = m * 10 ** e
                if d / km_px <= 130:
                    best = d
        if not best:
            return
        w = best / km_px
        x, y = 14, vh - 16
        lab = ('%g km' % best) if best >= 1 else ('%d m' % round(best * 1000))
        mi = best * 0.621371
        lab += '  ·  ' + (('%g mi' % float('%.2g' % mi)) if mi >= 1 else ('%d ft' % round(mi * 5280, -1)))
        tw, th = self.text(cr, lab, 0, 0, 9.5, '#000000', measure=True)
        cr.set_source_rgba(1, 1, 1, .78); cr.rectangle(x - 6, y - th - 12, max(w, tw) + 12, th + 20); cr.fill()
        cr.set_source_rgba(*rgb('#3a2e3f')); cr.set_line_width(2)
        cr.move_to(x, y - 5); cr.line_to(x, y); cr.line_to(x + w, y); cr.line_to(x + w, y - 5); cr.stroke()
        cr.set_source_rgba(*rgb('#3a2e3f')); cr.rectangle(x, y - 2, w / 2, 2); cr.fill()
        self.text(cr, lab, x, y - th / 2 - 7, 9.5, '#3a2e3f')

    def text(self, cr, s, x, y, size, color, mid=False, bold=False, italic=False, halo=True, measure=False):
        cr.new_path()
        lay = PangoCairo.create_layout(cr)
        fd = Pango.FontDescription.from_string('Sans %s%s %.1f' % ('Bold ' if bold else '', 'Italic ' if italic else '', size))
        lay.set_font_description(fd); lay.set_text(s, -1)
        w, h = lay.get_pixel_size()
        if measure:
            return w, h
        x0 = x - w / 2 if mid else x
        y0 = y - h / 2
        cr.move_to(x0, y0)
        if halo:
            PangoCairo.layout_path(cr, lay); cr.set_source_rgba(1, 1, 1, .85); cr.set_line_width(3); cr.set_line_join(cairo.LINE_JOIN_ROUND); cr.stroke()
            cr.move_to(x0, y0)
        cr.set_source_rgba(*rgb(color)); PangoCairo.show_layout(cr, lay); cr.new_path()
        return w, h

    def labels(self, cr, vw, vh):
        cand, s = [], self.s
        for w in WATERS:
            if (w[3] and s > 0.9 and w[3] > 1.1) or (not w[3] and s < 1.5):
                continue
            x, y = M.U(w[1], w[2])
            if self.in_view(x, y):
                cand.append((1e6 + w[3] * 10, x, y, M.T(w[0]), 'water'))
        st = self.story
        if not st:
            if self.sel:
                cand.append((1e9, self.sel['x'], self.sel['y'], M.nm(self.sel), 'sel'))
            for p in M.P:
                if p is self.sel or (self.only is not None and p['id'] not in self.only):
                    continue
                if p['at'] and (self.only is None or p['at'] in self.only):
                    continue
                if p['t'] == 'r':
                    if self.only is not None:
                        if self.in_view(p['x'], p['y']):
                            cand.append((p['n'] + 5000, p['x'], p['y'], M.nm(p), 'region'))
                        continue
                    if not self.shown['r'] or p['n'] < (40 if s < 0.3 else 12 if s < 0.8 else 3 if s < 3 else 0) or (p['j'] and s < 60):
                        continue
                    if self.in_view(p['x'], p['y']):
                        cand.append((p['n'] * 3 + 500, p['x'], p['y'], M.nm(p), 'region'))
                    continue
                if p in self.visible:
                    cand.append((p['n'] + (2 if p['c'] == 2 else 0), p['x'], p['y'], M.nm(p), 'pin'))
            rk = self.world_rank()
            for x, y, r, names in M.countries:
                if r <= rk + 1 and not M.inside(x, y) and self.in_view(x, y):
                    cand.append((300 - r * 10, x, y, M.wn(names), 'country'))
            if s > 0.06:
                for x, y, r, names in M.capitals:
                    if self.in_view(x, y) and (r <= rk if not M.inside(x, y) else r <= rk + 2):
                        cand.append(((100 if not M.inside(x, y) else 5) - r, x, y, M.wn(names), 'capital'))
        else:
            for p in self.stops:
                cand.append((1e8 - p['i'], p['x'], p['y'], p['label'], 'stop'))
        cand.sort(key=lambda c: -c[0])
        taken, n = [], 0
        def free(x, y, w, h):
            for t in taken:
                if x < t[0] + t[2] and x + w > t[0] and y < t[1] + t[3] and y + h > t[1]:
                    return False
            taken.append((x, y, w, h)); return True
        for pr, x, y, t, kind in cand:
            if n > 220:
                break
            size = {'water': 11, 'region': 11.5, 'sel': 12.5, 'stop': 11, 'country': 10.5, 'capital': 9.5}.get(kind, 10.5)
            w, h = self.text(cr, t, 0, 0, size, '#000000', measure=True, bold=kind in ('sel', 'stop'), italic=kind == 'water')
            sx, sy = self.to_screen(x, y)
            mid = kind in ('water', 'region', 'country')
            x0 = sx - w / 2 if mid else sx + 8
            y0 = sy - h / 2 - (12 if kind == 'stop' else 0)
            if x0 < 2 or x0 + w > vw - 2 or y0 < 2 or y0 + h > vh - 2:
                continue
            if not free(x0, y0, w, h):
                continue
            color = {'water': '#2a6a93', 'region': '#6d5a3a', 'sel': '#3e093f', 'stop': '#3e093f', 'country': '#8d8170', 'capital': '#6b7079'}.get(kind, '#3a2e3f')
            if kind in ('region', 'country'):
                t = t.upper()
            self.text(cr, t, x0, y0 + h / 2, size, color, bold=kind in ('sel', 'stop'), italic=kind == 'water')
            n += 1


_PAINTED = set()


def paint_class(hexcol):
    h = (hexcol or '#999999').lstrip('#').lower()
    if h not in _PAINTED:
        css = '.kjt-story.kjt-sb-%s { border-left: 6px solid #%s; }' % (h, h)
        pr = Gtk.CssProvider(); pr.load_from_string(css) if hasattr(pr, 'load_from_string') else pr.load_from_data(css, -1)
        Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), pr, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
        _PAINTED.add(h)
    return h


def hsl(h, s, l, a):
    import colorsys
    r, g, b = colorsys.hls_to_rgb(h / 360, l, s)
    return (r, g, b, a)


class MapsPage(Gtk.Box):
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win
        self.pending = None
        tv = Adw.ToolbarView(); tv.set_vexpand(True); self.append(tv)
        hb = Adw.HeaderBar(); tv.add_top_bar(hb); win.sidebar_button(hb)
        self.q = Gtk.SearchEntry(placeholder_text=_('Find a place…'), width_chars=18, max_width_chars=26); self.q.connect('activate', self.find)
        hb.set_title_widget(self.q)
        self.list_btn = Gtk.ToggleButton(icon_name='kjt-list-symbolic', tooltip_text=_('Places and story maps')); self.list_btn.add_css_class('flat')
        hb.pack_end(self.list_btn)
        kinds = Gtk.MenuButton(icon_name='kjt-pin-symbolic', tooltip_text=_('Which places to show')); kinds.add_css_class('flat')
        pop = Gtk.Popover(); kb = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, margin_top=6, margin_bottom=6, margin_start=6, margin_end=6)
        self.kind_checks = kb; pop.set_child(kb); kinds.set_popover(pop); hb.pack_end(kinds)
        self.mv = MapView(self)
        ov = Gtk.Overlay(); ov.set_child(self.mv)
        self.credit = Gtk.Label(css_classes=['kjt-map-credit'], halign=Gtk.Align.START, valign=Gtk.Align.END, wrap=True, max_width_chars=70, margin_start=190, margin_bottom=6, margin_end=70)
        ov.add_overlay(self.credit)
        # the map's own buttons, on the map
        ctl = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, halign=Gtk.Align.END, valign=Gtk.Align.END, margin_end=10, margin_bottom=10)
        for icon, tip, fn in (('kjt-plus-symbolic', 'Zoom in', lambda: self.mv.zoom_to(self.mv.s * 1.6)), ('kjt-minus-symbolic', 'Zoom out', lambda: self.mv.zoom_to(self.mv.s / 1.6)),
                              ('kjt-jerusalem-symbolic', 'Jerusalem close up', lambda: self.mv.jerusalem()), ('kjt-home-symbolic', 'Whole map', lambda: (self.clear_only(), self.mv.home()))):
            bt = Gtk.Button(icon_name=icon, tooltip_text=_(tip)); bt.add_css_class('circular'); bt.add_css_class('osd'); bt.connect('clicked', lambda _b, fn=fn: fn()); ctl.append(bt)
        ov.add_overlay(ctl)
        # a story's steps, on the map
        self.snav = Gtk.Box(spacing=4, halign=Gtk.Align.CENTER, valign=Gtk.Align.START, margin_top=10, visible=False); self.snav.add_css_class('osd'); self.snav.add_css_class('toolbar')
        self.snav_label = Gtk.Label(width_chars=8, ellipsize=Pango.EllipsizeMode.END, max_width_chars=22)
        for w in (Gtk.Button(icon_name='kjt-prev-symbolic', tooltip_text=_('Previous')), self.snav_label, Gtk.Button(icon_name='kjt-next-symbolic', tooltip_text=_('Next'))):
            if isinstance(w, Gtk.Button):
                w.add_css_class('flat')
            self.snav.append(w)
        self.snav.get_first_child().connect('clicked', lambda *_: self.go_step(max(0, self.mv.step_i - 1)))
        self.snav.get_last_child().connect('clicked', lambda *_: self.go_step(min(len(self.mv.stops) - 1, self.mv.step_i + 1)))
        ov.add_overlay(self.snav)
        self.side = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8, margin_top=12, margin_bottom=12, margin_start=12, margin_end=12)
        ss = Gtk.ScrolledWindow(hscrollbar_policy=Gtk.PolicyType.NEVER, vexpand=True); ss.set_child(self.side); self.side_scroll = ss
        # two tabs, as on the website: all the places, or the story maps
        tabs = Gtk.Box(spacing=0, halign=Gtk.Align.CENTER, margin_top=10, margin_start=10, margin_end=10); tabs.add_css_class('linked')
        self.tab_p = Gtk.ToggleButton(label=_('📍 All places')); self.tab_s = Gtk.ToggleButton(label=_('🧭 Story maps'), group=self.tab_p)
        self.tab_a = Gtk.ToggleButton(label=_('🗺 Old atlases'), group=self.tab_p)
        self.tab_a.connect('toggled', lambda b: b.get_active() and self.mode != 'atlas' and self.set_mode('atlas'))
        self.tab_p.connect('toggled', lambda b: b.get_active() and self.mode != 'places' and self.set_mode('places'))
        self.tab_s.connect('toggled', lambda b: b.get_active() and self.mode != 'stories' and self.set_mode('stories'))
        tabs.append(self.tab_p); tabs.append(self.tab_s); tabs.append(self.tab_a); self.tabs = tabs
        for b in (self.tab_p, self.tab_s, self.tab_a):
            b.get_child().set_ellipsize(Pango.EllipsizeMode.END)   # 2.34: the three tabs fit a phone
        sidebox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL); sidebox.append(tabs); sidebox.append(ss)
        self.mode = ''
        self.osv = Adw.OverlaySplitView(sidebar_position=Gtk.PackType.END, min_sidebar_width=300, max_sidebar_width=380, sidebar_width_fraction=0.3, show_sidebar=True)
        # 2.8: the old atlases take the map's place while that tab is open
        self.stage = Gtk.Stack(transition_type=Gtk.StackTransitionType.CROSSFADE); self.stage.add_named(ov, 'map')
        self.atlas = AtlasView(); self.stage.add_named(self.atlas, 'atlas')
        self.osv.set_content(self.stage); from .ui import resizable; self.osv.set_sidebar(resizable(self.osv, sidebox, 'maps_side', end=True, lo=260, hi=800))
        self.osv.bind_property('show-sidebar', self.list_btn, 'active', 1 | 2)
        tv.set_content(self.osv)

    def set_compact(self, c):
        self.compact = c
        self.osv.set_collapsed(c)
        self.osv.set_show_sidebar(not c)
        self.credit.set_visible(not c)
        # 2.34: on a phone the search and the three tabs take less room
        self.q.set_width_chars(8 if c else 18)
        self.tabs.set_homogeneous(c); self.tabs.set_halign(Gtk.Align.FILL if c else Gtk.Align.CENTER)

    def reveal(self):
        """on a small screen the panel slides over the map when there is something to read"""
        self.osv.set_show_sidebar(True)

    compact = False

    def refresh(self):
        if self.redraw_fixed not in M.on_fixed:
            M.on_fixed.append(self.redraw_fixed)
        if not M.ok or M.lang != lang():
            if M.ok:
                M.set_lang(lang())
            elif not M.load():
                self.clear_side(); self.side.append(Gtk.Label(label=_('The Bible Maps are not on this computer yet. Choose Downloads in the sidebar.'), wrap=True, xalign=0)); return
            for t in M.stories:
                for tr in t.get('tribes') or []:
                    tr['_d'] = parse_path(tr['d'])
            while self.kind_checks.get_first_child():
                self.kind_checks.remove(self.kind_checks.get_first_child())
            for k in KIND_KEYS:
                cb = Gtk.CheckButton(label=M.T('k_' + k), active=True)
                cb.connect('toggled', lambda b, k=k: (self.mv.shown.__setitem__(k, b.get_active()), self.mv.queue_draw()))
                self.kind_checks.append(cb)
            self.credit.set_label(M.T('credit'))
            self.home_side()
        self.mv.queue_draw()

    def redraw_fixed(self):
        self.mv.sel = None; self.mv.only = None
        if self.get_mapped():
            self.home_side()
        self.mv.queue_draw()

    def run_pending(self):
        p, self.pending = self.pending, None
        if p:
            p()
        return False

    def later(self, fn):
        """the map must have a size before it can centre anything"""
        if self.mv.fitted:
            fn()
        else:
            self.pending = fn

    # the side panel
    def clear_side(self):
        while self.side.get_first_child():
            self.side.remove(self.side.get_first_child())

    def label(self, s, *cls, wrap=True):
        l = Gtk.Label(label=s, xalign=0, wrap=wrap, wrap_mode=Pango.WrapMode.WORD_CHAR)
        for c in cls:
            l.add_css_class(c)
        self.side.append(l); return l

    def home_side(self):
        self.set_mode(self.mode or 'places')

    def set_mode(self, m):
        self.mode = m
        self.tab_p.set_label('📍 ' + M.T('tab_places')); self.tab_s.set_label('🧭 ' + M.T('tab_stories')); self.tab_a.set_label('🗺 ' + M.T('tab_atlas'))
        for b in (self.tab_p, self.tab_s, self.tab_a):
            if isinstance(b.get_child(), Gtk.Label): b.get_child().set_ellipsize(Pango.EllipsizeMode.END)
        {'places': self.tab_p, 'stories': self.tab_s, 'atlas': self.tab_a}.get(m, self.tab_p).set_active(True)
        self.stage.set_visible_child_name('atlas' if m == 'atlas' else 'map')
        self.clear_side(); self.mv.story = None; self.mv.stops = []; self.mv.sel = None; self.snav.set_visible(False)
        self.side_scroll.get_vadjustment().set_value(0)
        if m == 'atlas':
            self.atlas_home()
        elif m == 'stories':
            self.mv.only = None; self.stories_home()
        else:
            self.places_home()
        self.mv.queue_draw()

    def places_home(self):
        self.label(M.T('title'), 'title-2'); self.label(M.T('sub'), 'dim-label')
        # the places named most often, as chips
        fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=6, column_spacing=4, row_spacing=4, margin_top=6)
        for p in sorted((p for p in M.P if p['t'] != 'r'), key=lambda p: -p['n'])[:24]:
            b = Gtk.Button(label=M.nm(p)); b.add_css_class('kjt-chip'); b.set_tooltip_text(M.T('verses', p['n']))
            b.connect('clicked', lambda _b, p=p: self.choose(p, True)); fb.append(b)
        self.side.append(fb)
        # what the colours of the pins mean (and which to show)
        self.label(M.T('kinds'), 'heading').set_margin_top(10)
        kf = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=2, min_children_per_line=2)
        for k in KIND_KEYS:
            cb = Gtk.CheckButton(active=self.mv.shown.get(k, True))
            lb = Gtk.Label(); lb.set_markup('<span foreground="%s">%s</span>  %s' % (COL[k], KIND[k], GLib.markup_escape_text(M.T('k_' + k)))); cb.set_child(lb)
            cb.connect('toggled', lambda b, k=k: (self.mv.shown.__setitem__(k, b.get_active()), self.mv.queue_draw())); kf.append(cb)
        self.side.append(kf)
        sb = Gtk.Button(label='🧭 ' + M.T('tab_stories'), margin_top=10); sb.add_css_class('pill'); sb.connect('clicked', lambda *_: self.set_mode('stories')); self.side.append(sb)
        note = self.label(_("Grey squares are today’s capitals, to find your way; they are not places of the Bible."), 'caption', 'dim-label'); note.set_margin_top(8)

    def atlas_home(self):
        """the old atlases: maps drawn by hand centuries ago (public domain, Wikimedia Commons); each picture is
        fetched the first time it is opened and then kept on this computer"""
        self.label(M.T('atlas_t'), 'title-2'); self.label(M.T('atlas_sub'), 'dim-label')
        a = read_file('maps/atlas.json')
        if not a:
            self.label(M.T('atlas_off'), 'caption'); M.fetch_atlas_list(lambda: self.mode == 'atlas' and self.set_mode('atlas')); return
        self.atlas.show_grid(a, self.open_atlas)
        for sec, key in (('ot', 'atlas_ot'), ('nt', 'atlas_nt')):
            maps = [m for m in a['maps'] if m['s'] == sec]
            if not maps:
                continue
            self.label(M.T(key), 'heading').set_margin_top(8)
            for m in maps:
                b = Gtk.Button(); b.add_css_class('flat')
                v = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=1)
                v.append(Gtk.Label(label=m['t'], xalign=0, wrap=True, css_classes=['heading']))
                v.append(Gtk.Label(label=' · '.join(x for x in (m.get('y'), m.get('by')) if x), xalign=0, wrap=True, css_classes=['caption', 'dim-label']))
                b.set_child(v); b.connect('clicked', lambda _b, m=m: self.open_atlas(a, m)); self.side.append(b)
        self.label(M.T('atlas_src') + ' · public domain', 'caption', 'dim-label').set_margin_top(8)

    def open_atlas(self, a, m):
        self.atlas.open(a, m)

    def stories_home(self):
        self.label(M.T('stories'), 'title-2')
        for st in M.stories:
            h = paint_class(st['c'])
            b = Gtk.Button(); b.add_css_class('card'); b.add_css_class('kjt-story'); b.add_css_class('kjt-sb-' + h)
            bx = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, margin_top=8, margin_bottom=8, margin_start=10, margin_end=8)
            t = Gtk.Label(xalign=0, wrap=True); t.set_markup('<span foreground="%s"><b>%s</b></span>' % (st['c'], GLib.markup_escape_text(M.T('s_' + st['id'])))); bx.append(t)
            i = Gtk.Label(label=M.T('i_' + st['id']), xalign=0, wrap=True, lines=2, ellipsize=Pango.EllipsizeMode.END, css_classes=['caption', 'dim-label']); bx.append(i)
            b.set_child(bx); b.connect('clicked', lambda _b, i=st['id']: self.open_story(i)); self.side.append(b)
        self.later(self.mv.home)

    def clear_only(self):
        self.snav.set_visible(False)
        self.mv.only = None; self.mv.story = None; self.mv.sel = None; self.set_mode('places')

    def suggest(self, *_):
        pass

    def find(self, *_):
        q = self.q.get_text().strip().casefold()
        if not q or not M.ok:
            return
        hits = [p for p in M.P if M.nm(p).casefold().startswith(q) or p['en'].casefold().startswith(q)] or [p for p in M.P if q in M.nm(p).casefold()]
        hits.sort(key=lambda p: -p['n'])
        if len(hits) == 1:
            self.choose(hits[0], True); return
        self.clear_side()
        self.label(M.T('found', len(hits)) if hits else M.T('nores'), 'heading')
        for p in hits[:80]:
            b = Gtk.Button(label='%s · %s' % (M.nm(p), M.T('verses', p['n']))); b.add_css_class('flat'); b.get_child().set_xalign(0)
            b.connect('clicked', lambda _b, p=p: self.choose(p, True)); self.side.append(b)
        back = Gtk.Button(label='← ' + M.T('back').replace(M.T('stories'), '').strip() if False else '← ' + M.T('allp')); back.connect('clicked', lambda *_: self.clear_only()); self.side.append(back)

    def choose(self, p, center=False):
        self.snav.set_visible(False)
        self.mv.sel = p; self.mv.story = None
        self.reveal()
        if center:
            self.mv.center(p['x'], p['y'], max(self.mv.s, 140 if p['j'] else 3.2))
        else:
            self.mv.queue_draw()
        self.clear_side()
        self.label(M.nm(p), 'title-2')
        self.label('%s · %s' % (M.T('k_' + p['t']), M.T('verses', p['n'])), 'dim-label')
        self.label(M.T('c%d' % p['c']), 'caption')
        if p['alts'] > 1:
            self.label(M.T('alts', p['alts']), 'caption')
        # the other names found at this same spot (one pin for them all)
        main = M.BY.get(p['at']) if p['at'] else None
        if main:
            bx = Gtk.Box(spacing=6); bx.append(Gtk.Label(label=M.T('samespot'), css_classes=['caption']))
            mb = Gtk.Button(label=M.nm(main)); mb.add_css_class('kjt-chip'); mb.connect('clicked', lambda *_: self.choose(main, True)); bx.append(mb); self.side.append(bx)
        here = sorted((o for o in M.P if o['at'] == p['id']), key=lambda o: -o['n'])
        if here:
            self.label(M.T('alsohere'), 'caption').set_margin_top(4)
            fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=4, column_spacing=4, row_spacing=4)
            for o in here:
                b = Gtk.Button(label='%s %s' % (KIND[o['t']], M.nm(o))); b.add_css_class('kjt-chip'); b.connect('clicked', lambda _b, o=o: self.choose(o, False)); fb.append(b)
            self.side.append(fb)
        row = Gtk.Box(spacing=6)
        dct = Gtk.Button(label='📜 ' + M.T('dict')); dct.connect('clicked', lambda *_: self.win.open_dict(p['d'] or 'p-' + p['id'])); row.append(dct)
        self.side.append(row)
        self.verses(p['v'][:30])
        if len(p['v']) > 30:
            more = Gtk.Button(label=M.T('more')); more.add_css_class('flat'); more.connect('clicked', lambda b: (b.set_visible(False), self.verses(p['v'][30:])))
            self.side.append(more)
        back = Gtk.Button(label='← ' + M.T('allp'), margin_top=10); back.add_css_class('flat'); back.connect('clicked', lambda *_: self.clear_only()); self.side.append(back)

    def verses(self, vs):
        for v in vs:
            self.verse(v)

    def verse(self, ref):
        m = re.match(r'([1-4A-Z]{3})\.(\d+)\.(\d+)(?:-(\d+))?', ref or '')
        if not m:
            return
        b, c, v1, v2 = m.group(1), int(m.group(2)), int(m.group(3)), int(m.group(4) or m.group(3))
        tr = SET.get('tr') if SET.get('tr') and STORE.find_book(SET.get('tr'), b) else next((x for x in STORE.bibles() if STORE.find_book(x, b)), None)
        rows = STORE.passage(tr, b, c, v1, c, v2) if tr else []
        btn = Gtk.Button(); btn.add_css_class('flat')
        bx = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
        bx.append(Gtk.Label(label='%s %d:%d%s' % (book_name(b, tr=tr), c, v1, '–%d' % v2 if v2 > v1 else ''), xalign=0, css_classes=['heading']))
        if rows:
            bx.append(Gtk.Label(label=' '.join(strip_tags(r[2]).strip() for r in rows), xalign=0, wrap=True, wrap_mode=Pango.WrapMode.WORD_CHAR, max_width_chars=38))
        btn.set_child(bx); btn.connect('clicked', lambda *_: self.win.open_passage(b, c, v1))
        self.side.append(btn)

    # stories
    def open_story(self, sid):
        st = next((x for x in M.stories if x['id'] == sid), None)
        if not st:
            return
        if self.mode != 'stories':
            self.mode = 'stories'; self.tab_s.set_active(True)
        self.mv.sel = None; self.mv.only = None; self.mv.story = st; self.mv.step_i = -1
        self.reveal()
        stops, i = [], 0
        for n, t in enumerate(st.get('tribes') or []):
            stops.append({'x': t['x'], 'y': t['y'], 'i': i, 'r': t['r'], 'label': M.T('t_' + t['k']), 'tribe': n, 'leg': 0}); i += 1
        for li, leg in enumerate(st.get('legs') or []):
            col = st['cs'][li] if st.get('cs') else st['c']
            for p in leg:
                lab = M.T('l_' + p['k']) if p.get('k') else (M.nm(M.BY[p['id']]) if p.get('id') in M.BY else '')
                stops.append({'x': p['x'], 'y': p['y'], 'i': i, 'r': p.get('r'), 'id': p.get('id'), 'n': p.get('n'), 'leg': li, 'col': col, 'label': lab}); i += 1
        self.mv.stops = stops
        self.clear_side()
        back = Gtk.Button(label='← ' + M.T('back'), halign=Gtk.Align.START); back.add_css_class('flat'); back.connect('clicked', lambda *_: self.set_mode('stories')); self.side.append(back)
        h = self.label(M.T('s_' + sid), 'title-2'); h.set_markup('<span foreground="%s">%s</span>' % (st['c'], GLib.markup_escape_text(M.T('s_' + sid))))
        self.label(M.T('i_' + sid))
        nav = Gtk.Box(spacing=6, homogeneous=True)
        self.pv = Gtk.Button(label='← ' + M.T('prev')); self.pv.connect('clicked', lambda *_: self.go_step(max(0, self.mv.step_i - 1)))
        self.nx = Gtk.Button(label=M.T('start') + ' →'); self.nx.add_css_class('suggested-action'); self.nx.connect('clicked', lambda *_: self.go_step(min(len(stops) - 1, self.mv.step_i + 1)))
        self.pv.set_sensitive(False); nav.append(self.pv); nav.append(self.nx); self.side.append(nav)
        self.card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6); self.side.append(self.card)
        last = -1
        for p in stops:
            if st.get('legs') and len(st['legs']) > 1 and p['leg'] != last:
                last = p['leg']; l = self.label(M.T('leg%d' % (p['leg'] + 1)), 'heading'); l.set_markup('<span foreground="%s"><b>%s</b></span>' % (p['col'], GLib.markup_escape_text(M.T('leg%d' % (p['leg'] + 1)))))
            b = Gtk.Button(); b.add_css_class('flat')
            lb = Gtk.Label(xalign=0, wrap=True)
            lb.set_markup('<span foreground="%s"><b>%d</b></span>  %s%s' % (p.get('col') or st['c'], p['i'] + 1, GLib.markup_escape_text(p['label']),
                                                                         ('  <small>%s</small>' % GLib.markup_escape_text(self.ref_label(p['r']))) if p.get('r') else ''))
            b.set_child(lb); b.connect('clicked', lambda _b, i=p['i']: self.go_step(i)); self.side.append(b)
        def fit():
            if st.get('zoom') == 'jer':
                self.mv.jerusalem()
            else:
                self.mv.fit_points(stops, 30)
        self.later(fit)
        self.mv.queue_draw()

    def ref_label(self, r):
        m = re.match(r'([1-4A-Z]{3})\.(\d+)\.(\d+)(?:-(\d+))?', r or '')
        if not m:
            return ''
        return '%s %s:%s%s' % (book_name(m.group(1)), m.group(2), m.group(3), '–' + m.group(4) if m.group(4) else '')

    def go_step(self, i):
        st = self.mv.story
        if not st or not (0 <= i < len(self.mv.stops)):
            return
        p = self.mv.stops[i]; self.mv.step_i = i
        self.snav.set_visible(True); self.snav_label.set_label('%d / %d  %s' % (i + 1, len(self.mv.stops), p['label']))
        if self.compact:
            self.osv.set_show_sidebar(False)
        self.pv.set_sensitive(i > 0); self.nx.set_label(M.T('next') + ' →'); self.nx.set_sensitive(i < len(self.mv.stops) - 1)
        while self.card.get_first_child():
            self.card.remove(self.card.get_first_child())
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4, margin_top=8, margin_bottom=8, margin_start=10, margin_end=10)
        fr = Gtk.Frame(); fr.set_child(box); fr.add_css_class('kjt-step'); self.card.append(fr)
        box.append(Gtk.Label(label=M.T('step', i + 1, len(self.mv.stops)), xalign=0, css_classes=['dim-label', 'caption']))
        box.append(Gtk.Label(label=p['label'], xalign=0, wrap=True, css_classes=['title-4']))
        if p.get('n'):
            box.append(Gtk.Label(label=M.T(p['n']), xalign=0, wrap=True))
        if p.get('r'):
            old = self.side; self.side = box; self.verse(p['r']); self.side = old
        if p.get('id') in M.BY:
            pl = M.BY[p['id']]
            b = Gtk.Button(label='📍 %s · %s' % (M.nm(pl), M.T('verses', pl['n']))); b.add_css_class('flat')
            b.connect('clicked', lambda *_: self.choose(pl, True)); box.append(b)
        want = max(self.mv.s, 160) if st.get('zoom') == 'jer' else (self.mv.s if st.get('tribes') else max(self.mv.s, 2.2))
        self.mv.center(p['x'], p['y'], want)

    # from elsewhere in the app
    def show_place(self, pid):
        self.refresh()
        p = M.BY.get(pid) if M.ok else None
        if p:
            self.later(lambda: self.choose(p, True))

    def show_chapter(self, book, ch):
        self.refresh()
        if not M.ok:
            return
        from .core import canon
        pre = '%s.%d.' % (canon(book), ch)
        ids = {p['id'] for p in M.P if any(v.startswith(pre) for v in p['v'])}
        self.mv.story = None; self.mv.sel = None; self.mv.only = ids
        self.reveal()
        self.clear_side()
        self.label(M.T('chapter', '%s %d' % (book_name(book), ch)), 'title-3')
        if not ids:
            self.label(M.T('nochap'))
        for p in sorted((M.BY[i] for i in ids), key=lambda p: -p['n']):
            b = Gtk.Button(label=M.nm(p)); b.add_css_class('flat'); b.get_child().set_xalign(0)
            b.connect('clicked', lambda _b, p=p: self.choose(p, True)); self.side.append(b)
        back = Gtk.Button(label='← ' + M.T('allp'), margin_top=10); back.add_css_class('flat'); back.connect('clicked', lambda *_: self.clear_only()); self.side.append(back)
        pts = [M.BY[i] for i in ids]
        self.later(lambda: self.mv.fit_points(pts, 30) if pts else self.mv.home())


class AtlasView(Gtk.Box):
    """the old atlases: a grid of the maps, and one map to zoom (wheel, pinch, buttons) and move (drag)"""
    def __init__(self):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.stack = Gtk.Stack(vexpand=True); self.append(self.stack)
        self.grid = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, homogeneous=True, min_children_per_line=2, max_children_per_line=6, column_spacing=10, row_spacing=10,
                                margin_top=12, margin_bottom=12, margin_start=12, margin_end=12, valign=Gtk.Align.START)
        gs = Gtk.ScrolledWindow(hscrollbar_policy=Gtk.PolicyType.NEVER); gs.set_child(self.grid); self.stack.add_named(gs, 'grid')
        view = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        top = Gtk.Box(spacing=8, margin_top=6, margin_bottom=6, margin_start=8, margin_end=8)
        back = Gtk.Button(icon_name='kjt-prev-symbolic', tooltip_text=_('All the atlases')); back.add_css_class('flat'); back.connect('clicked', lambda *_: self.stack.set_visible_child_name('grid')); top.append(back)
        cap = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, hexpand=True)
        self.title = Gtk.Label(xalign=0, ellipsize=Pango.EllipsizeMode.END, css_classes=['heading']); self.sub = Gtk.Label(xalign=0, ellipsize=Pango.EllipsizeMode.END, css_classes=['caption', 'dim-label'])
        cap.append(self.title); cap.append(self.sub); top.append(cap)
        for icon, tip, f in (('kjt-minus-symbolic', 'Zoom out', 1 / 1.6), ('kjt-plus-symbolic', 'Zoom in', 1.6), ('kjt-home-symbolic', 'Whole map', 0)):
            b = Gtk.Button(icon_name=icon, tooltip_text=_(tip)); b.add_css_class('flat'); b.connect('clicked', lambda _b, f=f: self.zoom(f) if f else self.fit()); top.append(b)
        view.append(top)
        self.area = Gtk.DrawingArea(vexpand=True, hexpand=True); self.area.set_draw_func(self.draw)
        self.status = Gtk.Label(css_classes=['dim-label'], vexpand=True)
        self.vstack = Gtk.Stack(vexpand=True); self.vstack.add_named(self.area, 'pic'); self.vstack.add_named(self.status, 'wait'); view.append(self.vstack)
        self.stack.add_named(view, 'view')
        self.pix = None; self.s = 1; self.tx = 0; self.ty = 0; self.fit_s = 1
        sc = Gtk.EventControllerScroll(flags=Gtk.EventControllerScrollFlags.VERTICAL); sc.connect('scroll', self.on_scroll); self.area.add_controller(sc)
        mo = Gtk.EventControllerMotion(); mo.connect('motion', lambda _c, x, y: setattr(self, 'mouse', (x, y))); self.area.add_controller(mo)
        dr = Gtk.GestureDrag(); dr.connect('drag-begin', lambda *_: setattr(self, 'd0', (self.tx, self.ty))); dr.connect('drag-update', self.on_drag); self.area.add_controller(dr)
        zm = Gtk.GestureZoom(); zm.connect('begin', lambda *_: setattr(self, 'z0', self.s)); zm.connect('scale-changed', self.on_pinch); self.area.add_controller(zm)
        cl = Gtk.GestureClick(); cl.connect('pressed', lambda g, n, x, y: n == 2 and self.zoom(2, x, y)); self.area.add_controller(cl)
        self.mouse = (0, 0)

    def show_grid(self, a, opener):
        while self.grid.get_first_child():
            self.grid.remove(self.grid.get_first_child())
        for m in a['maps']:
            b = Gtk.Button(); b.add_css_class('card')
            v = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_top=6, margin_bottom=6, margin_start=6, margin_end=6)
            pic = Gtk.Picture(content_fit=Gtk.ContentFit.COVER, height_request=130, can_shrink=True); v.append(pic)
            v.append(Gtk.Label(label=m['t'], wrap=True, lines=2, ellipsize=Pango.EllipsizeMode.END, xalign=0, css_classes=['caption-heading']))
            b.set_child(v); b.connect('clicked', lambda _b, m=m: opener(a, m)); self.grid.append(b)
            self.fetch(a, m, True, lambda path, pic=pic: pic.set_filename(path))
        self.stack.set_visible_child_name('grid')

    def fetch(self, a, m, thumb, done, fail=None):
        """the picture from this computer, or fetched once and kept"""
        import os, threading
        from .core import NET, file_path, write_file
        rel = 'maps/atlas/%s%s.jpg' % ('thumbs/' if thumb else '', m['id'])
        path = file_path(rel)
        if os.path.exists(path):
            done(path); return
        def run():
            try:
                data = NET.get(a['base'] + ('thumbs/' if thumb else '') + m['id'] + '.jpg', timeout=180, strict=True)
                os.makedirs(os.path.dirname(path), exist_ok=True); write_file(rel, data)
                GLib.idle_add(lambda: (done(path), False)[1])
            except Exception:
                if fail:
                    GLib.idle_add(lambda: (fail(), False)[1])
        threading.Thread(target=run, daemon=True).start()

    def open(self, a, m):
        self.title.set_label(m['t']); self.title.set_tooltip_text(m['t'])
        self.sub.set_label(' · '.join(x for x in (m.get('y'), m.get('by'), 'Wikimedia Commons, public domain') if x))
        self.pix = None; self.status.set_label('Opening the map… (large picture)'); self.vstack.set_visible_child_name('wait')
        self.stack.set_visible_child_name('view')
        def show(path):
            try:
                pb = GdkPixbuf.Pixbuf.new_from_file(path)
                sf = cairo.ImageSurface(cairo.FORMAT_RGB24, pb.get_width(), pb.get_height())
                c2 = cairo.Context(sf); Gdk.cairo_set_source_pixbuf(c2, pb, 0, 0); c2.paint()
                self.pix = sf
            except Exception:
                self.status.set_label('This map could not be opened.'); return
            self.vstack.set_visible_child_name('pic'); GLib.idle_add(lambda: (self.fit(), False)[1])
        self.fetch(a, m, False, show, lambda: self.status.set_label('This map needs the internet the first time.'))

    def fit(self):
        if not self.pix:
            return
        w, h = self.area.get_width() or 800, self.area.get_height() or 600
        pw, ph = self.pix.get_width(), self.pix.get_height()
        self.fit_s = min(w / pw, h / ph); self.s = self.fit_s
        self.tx = (w - pw * self.s) / 2; self.ty = (h - ph * self.s) / 2; self.area.queue_draw()

    def zoom(self, f, x=None, y=None):
        if not self.pix:
            return
        if x is None:
            x, y = (self.area.get_width() or 800) / 2, (self.area.get_height() or 600) / 2
        ns = max(self.fit_s * 0.8, min(3.0, self.s * f)); f = ns / self.s
        self.tx = x - (x - self.tx) * f; self.ty = y - (y - self.ty) * f; self.s = ns; self.area.queue_draw()

    def on_scroll(self, _c, _dx, dy):
        self.zoom(1 / 1.15 if dy > 0 else 1.15, *self.mouse); return True

    def on_drag(self, _g, dx, dy):
        self.tx, self.ty = self.d0[0] + dx, self.d0[1] + dy; self.area.queue_draw()

    def on_pinch(self, g, scale):
        ok, x, y = g.get_bounding_box_center()
        f = (self.z0 * scale) / self.s
        if ok:
            self.zoom(f, x, y)

    def draw(self, _a, cr, w, h):
        cr.set_source_rgb(0.91, 0.88, 0.81); cr.paint()
        if not self.pix:
            return
        cr.translate(self.tx, self.ty); cr.scale(self.s, self.s)
        cr.set_source_surface(self.pix, 0, 0); cr.get_source().set_filter(cairo.FILTER_GOOD if self.s < 1 else cairo.FILTER_BILINEAR); cr.paint()
