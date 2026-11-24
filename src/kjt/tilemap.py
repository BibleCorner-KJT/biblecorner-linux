"""2.16: a street map of the world, drawn here from OpenStreetMap's map pictures (tiles), with places marked on it.
Drag to move, scroll (or + and −) to zoom, click a mark to choose it. The pictures are kept on this computer for
a week. Map © OpenStreetMap contributors (shown on the map)."""
import math, re, os, threading, time
import cairo
from gi.repository import Gtk, Gdk, GLib, Pango, PangoCairo, GdkPixbuf
from .core import DATA, NET, SET
from .i18n import _

TILE = 256
URL = 'https://tile.openstreetmap.org/%d/%d/%d.png'
# 2.43: satellite photos (Esri World Imagery, which OpenStreetMap also allows for placing things) and the names of places over them
SAT = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/%d/%d/%d'
SAT_NAMES = 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/%d/%d/%d'
KEEP = 7 * 86400
_cache = {}            # (layer, z, x, y) -> cairo picture / None while loading
_lock = threading.Semaphore(4)


_WORLD = None


def world():
    """2.48: the world inside the app (land and today's borders, from the website's maps), drawn where map pictures are missing
    (no internet): a list of shapes, each a list of points in pixels at zoom 0"""
    global _WORLD
    if _WORLD is not None:
        return _WORLD
    _WORLD = ([], [])
    try:
        from .core import read_file
        w = read_file('maps/world.json')
        if not w:
            from . import pack
            w = pack.js('data/maps/world.json')
        for i, key in enumerate(('land', 'borders')):
            shape = None; x = y = 0.0; cmd = 'M'; nums = []
            for tok in re.findall(r'[MmLlZz]|-?\d+(?:\.\d+)?', (w or {}).get(key) or ''):
                if tok in 'MmLlZz':
                    cmd = tok
                    if tok in 'Zz' and shape:
                        _WORLD[i].append(shape); shape = None
                    continue
                nums.append(float(tok))
                if len(nums) < 2:
                    continue
                a, b = nums; nums = []
                if cmd in 'ml':
                    x += a; y += b
                else:
                    x, y = a, b
                lon = x / 86.60254037844387 - 10; lat = 46 - y / 100.0
                px, py = to_px(max(-85, min(85, lat)), lon, 0)
                if cmd in 'Mm':
                    if shape:
                        _WORLD[i].append(shape)
                    shape = [(px, py)]; cmd = 'L' if cmd == 'M' else 'l'
                else:
                    shape.append((px, py))
            if shape:
                _WORLD[i].append(shape)
    except Exception:
        pass
    return _WORLD


def to_px(lat, lon, z):
    n = TILE * (2 ** z)
    lat = max(-85.0, min(85.0, lat))
    x = (lon + 180.0) / 360.0 * n
    s = math.sin(math.radians(lat))
    y = (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * n
    return x, y


def to_ll(x, y, z):
    n = TILE * (2 ** z)
    lon = x / n * 360.0 - 180.0
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    return lat, lon


class TileMap(Gtk.Overlay):
    def __init__(self, on_pick=None):
        super().__init__(hexpand=True, vexpand=True)
        self.lat, self.lon, self.z = 30.0, 10.0, 2
        self.marks = []          # (lat, lon, key, '#hex', label)
        self.sel = None; self.here = None; self.on_pick = on_pick; self.route = []
        self.bubbles = []        # 2.23: (lat, lon, count) of a part of the world, drawn as a number
        self.on_move = None      # 2.23: called (after a moment) when you move or zoom the map yourself
        self._mv = 0
        self.area = Gtk.DrawingArea(hexpand=True, vexpand=True); self.area.set_draw_func(self.draw); self.set_child(self.area)
        self.area.set_cursor(Gdk.Cursor.new_from_name('grab'))
        d = Gtk.GestureDrag(); d.connect('drag-begin', self.drag_begin); d.connect('drag-update', self.drag_update); d.connect('drag-end', lambda *_a: self.moved and self.user_moved()); self.area.add_controller(d)
        c = Gtk.GestureClick(); c.connect('released', self.click); self.area.add_controller(c)
        sc = Gtk.EventControllerScroll(flags=Gtk.EventControllerScrollFlags.VERTICAL); sc.connect('scroll', self.scroll); self.area.add_controller(sc)
        mo = Gtk.EventControllerMotion(); mo.connect('motion', lambda _c, x, y: setattr(self, 'pointer', (x, y))); self.area.add_controller(mo)
        self.pointer = None
        zb = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, halign=Gtk.Align.END, valign=Gtk.Align.START, margin_top=10, margin_end=10); zb.add_css_class('linked')
        for icon, d_ in (('kjt-plus-symbolic', 1), ('kjt-minus-symbolic', -1)):
            b = Gtk.Button(icon_name=icon, tooltip_text=_('Larger') if d_ > 0 else _('Smaller')); b.add_css_class('osd'); b.connect('clicked', lambda _b, d_=d_: self.zoom_by(d_)); zb.append(b)
        self.add_overlay(zb)
        att = Gtk.Label(label='© OpenStreetMap', halign=Gtk.Align.END, valign=Gtk.Align.END, margin_end=6, margin_bottom=4)
        att.add_css_class('kjt-map-att'); att.set_tooltip_text(_('Map © OpenStreetMap contributors')); self.add_overlay(att); self.att = att
        # 2.43: Map or Satellite (remembered); a place picked with a click (on_point, for the church form)
        self.on_point = None; self.pin = None; self.sat = bool(SET.get('map_sat'))
        lb = Gtk.Box(halign=Gtk.Align.START, valign=Gtk.Align.START, margin_top=10, margin_start=10); lb.add_css_class('linked')
        self.bmap = Gtk.ToggleButton(label='🗺 ' + _('Map'), active=not self.sat); self.bsat = Gtk.ToggleButton(label='🛰 ' + _('Satellite'), active=self.sat, group=self.bmap)
        for b in (self.bmap, self.bsat):
            b.add_css_class('osd'); lb.append(b)
        self.bsat.connect('toggled', lambda b: self.set_sat(b.get_active()))
        self.add_overlay(lb); self.set_sat(self.sat)
        self.dir = os.path.join(DATA, 'tiles'); os.makedirs(self.dir, exist_ok=True)

    def set_sat(self, on):
        self.sat = bool(on); SET.set('map_sat', self.sat)
        self.att.set_label('© Esri, Maxar · OpenStreetMap' if self.sat else '© OpenStreetMap')
        self.att.set_tooltip_text(_('Satellite photos © Esri, Maxar, Earthstar Geographics') if self.sat else _('Map © OpenStreetMap contributors'))
        self.area.queue_draw()

    def set_pin(self, lat, lon):
        self.pin = (lat, lon) if lat is not None else None; self.area.queue_draw()

    # the map's place
    def center(self, lat, lon, z=None):
        self.lat, self.lon = lat, lon
        if z is not None:
            self.z = max(2, min(18, int(z)))
        self.area.queue_draw()

    def fit(self, pts, maxz=15):
        """show all these places"""
        pts = [p for p in pts if p]
        if not pts:
            return
        w = max(200, self.area.get_width() or 600); h = max(200, self.area.get_height() or 400)
        la = [p[0] for p in pts]; lo = [p[1] for p in pts]
        for z in range(maxz, 1, -1):
            x1, y1 = to_px(max(la), min(lo), z); x2, y2 = to_px(min(la), max(lo), z)
            if x2 - x1 < w - 60 and y2 - y1 < h - 60:
                break
        cx, cy = to_px(max(la), min(lo), z); dx, dy = to_px(min(la), max(lo), z)
        self.lat, self.lon = to_ll((cx + dx) / 2, (cy + dy) / 2, z); self.z = z
        self.area.queue_draw()

    def set_marks(self, marks, sel=None, here=None):
        self.marks, self.sel, self.here = marks, sel, here; self.area.queue_draw()

    def set_route(self, pts):
        self.route = pts or []; self.area.queue_draw()

    def select(self, key):
        self.sel = key; self.area.queue_draw()

    def zoom_by(self, d, at=None):
        nz = max(2, min(18, self.z + d))
        if nz == self.z:
            return
        w, h = self.area.get_width(), self.area.get_height()
        if at:
            cx, cy = to_px(self.lat, self.lon, self.z)
            px, py = cx + at[0] - w / 2, cy + at[1] - h / 2
            plat, plon = to_ll(px, py, self.z)
            nx, ny = to_px(plat, plon, nz)
            self.lat, self.lon = to_ll(nx - (at[0] - w / 2), ny - (at[1] - h / 2), nz)
        self.z = nz; self.area.queue_draw(); self.user_moved()

    def user_moved(self):
        if not self.on_move:
            return
        self._mv += 1; n = self._mv
        GLib.timeout_add(350, lambda: (self.on_move() if n == self._mv else None, False)[1])

    def set_bubbles(self, b):
        self.bubbles = b or []; self.area.queue_draw()

    def bounds(self):
        """(south, west, north, east) of what is in view"""
        w, h = self.area.get_width() or 600, self.area.get_height() or 400
        cx, cy = to_px(self.lat, self.lon, self.z)
        n_, w_ = to_ll(cx - w / 2, cy - h / 2, self.z); s_, e_ = to_ll(cx + w / 2, cy + h / 2, self.z)
        return s_, w_, n_, e_

    # moving
    def drag_begin(self, g, x, y):
        self.drag0 = to_px(self.lat, self.lon, self.z); self.moved = False

    def drag_update(self, g, dx, dy):
        if abs(dx) + abs(dy) > 3:
            self.moved = True
        n = TILE * 2 ** self.z
        x, y = self.drag0[0] - dx, max(0, min(n, self.drag0[1] - dy))
        self.lat, self.lon = to_ll(x % n, y, self.z); self.area.queue_draw()

    def scroll(self, c, dx, dy):
        # 2.25: gentler: a touchpad's many small steps add up to one level, and at most one level each 0.3 s
        import time as _t
        self._acc = getattr(self, '_acc', 0.0) + dy
        if abs(self._acc) < 1.0 and c.get_unit() == Gdk.ScrollUnit.SURFACE:
            return True
        if c.get_unit() == Gdk.ScrollUnit.SURFACE and abs(self._acc) < 40:
            return True
        now = _t.monotonic()
        if now - getattr(self, '_last_zoom', 0) < 0.3:
            self._acc = 0.0; return True
        self._last_zoom = now; d = -1 if self._acc > 0 else 1; self._acc = 0.0
        self.zoom_by(d, self.pointer); return True

    def click(self, g, n, x, y):
        if getattr(self, 'moved', False):
            self.moved = False; return
        w, h = self.area.get_width(), self.area.get_height(); cx, cy = to_px(self.lat, self.lon, self.z)
        if self.on_point:   # 2.43: the church form: a click puts the pin there
            la, lo = to_ll(cx - w / 2 + x, cy - h / 2 + y, self.z); lo = ((lo + 180) % 360) - 180
            self.pin = (la, lo); self.area.queue_draw(); self.on_point(la, lo); return
        for la, lo, n in self.bubbles:     # a number: zoom in there
            mx, my = to_px(la, lo, self.z); sx, sy = mx - cx + w / 2, my - cy + h / 2
            r = 14 + min(16, math.log10(max(1, n)) * 6)
            if (sx - x) ** 2 + (sy - y) ** 2 < r * r:
                self.lat, self.lon = la, lo; self.zoom_by(3 if self.z < 6 else 2); return
        best, bd = None, 18 ** 2
        for m in self.marks:
            mx, my = to_px(m[0], m[1], self.z); sx, sy = mx - cx + w / 2, my - cy + h / 2
            d = (sx - x) ** 2 + (sy - y) ** 2
            if d < bd:
                best, bd = m, d
        if best and self.on_pick:
            self.sel = best[2]; self.area.queue_draw(); self.on_pick(best[2])
        elif not best and self.sel is not None:
            # 2.25: a click on the map itself lets the chosen place go
            self.sel = None; self.area.queue_draw()
            if getattr(self, 'on_unpick', None):
                self.on_unpick()

    # the pictures
    def tile(self, z, x, y, layer='map'):
        k = (layer, z, x, y)
        if k in _cache:
            return _cache[k]
        _cache[k] = None
        path = os.path.join(self.dir, ('%d_%d_%d.png' % (z, x, y)) if layer == 'map' else ('%s_%d_%d_%d.png' % (layer, z, x, y)))
        url = {'map': URL % (z, x, y), 'sat': SAT % (z, y, x), 'names': SAT_NAMES % (z, y, x)}[layer]
        def work():
            with _lock:
                if not (os.path.exists(path) and time.time() - os.path.getmtime(path) < KEEP and os.path.getsize(path) > 100):
                    data = NET.get(url, timeout=30, strict=True)
                    if not data or len(data) < 100:
                        raise ValueError('no tile')
                    if data[:4] != b'\x89PNG':   # 2.43: the satellite photos come as JPEG: kept as PNG, which the map draws
                        ld = GdkPixbuf.PixbufLoader(); ld.write(data); ld.close()
                        ld.get_pixbuf().savev(path + '.part', 'png', [], [])
                    else:
                        with open(path + '.part', 'wb') as f:
                            f.write(data)
                    os.replace(path + '.part', path)
                return path
        def done(r):
            if isinstance(r, str):
                try:
                    _cache[k] = cairo.ImageSurface.create_from_png(r)
                except Exception:
                    _cache.pop(k, None)
                    try:
                        os.remove(r)
                    except OSError:
                        pass
                self.area.queue_draw()
            else:
                GLib.timeout_add_seconds(20, lambda: (_cache.pop(k, None), False)[1])   # try again later
        if len(_cache) > 900:
            for kk in list(_cache)[:300]:
                _cache.pop(kk, None)
        from .core import run_bg
        run_bg(work, done)
        return None

    def any_missing(self, z, n, x0, y0, w, h):
        for ty in range(int(math.floor(y0 / TILE)), int(math.floor((y0 + h) / TILE)) + 1):
            if 0 <= ty < n:
                for tx in range(int(math.floor(x0 / TILE)), int(math.floor((x0 + w) / TILE)) + 1):
                    if self.tile(z, tx % n, ty, 'sat' if self.sat else 'map') is None:
                        return True
        return False

    def draw(self, area, cr, w, h):
        cr.set_source_rgb(0.93, 0.92, 0.9); cr.paint()
        z = self.z; n = 2 ** z; cx, cy = to_px(self.lat, self.lon, z)
        x0, y0 = cx - w / 2, cy - h / 2
        if not NET.online() or self.any_missing(z, n, x0, y0, w, h):   # 2.48: the world under the map pictures that are not here
            land, borders = world()
            if land:
                k = 2 ** z
                cr.set_source_rgb(0.81, 0.89, 0.93); cr.paint()
                cr.save(); cr.translate(-x0, -y0); cr.scale(k, k)
                for sh in land:
                    cr.move_to(*sh[0])
                    for p in sh[1:]:
                        cr.line_to(*p)
                    cr.close_path()
                cr.set_source_rgb(0.95, 0.94, 0.9); cr.fill()
                for sh in borders:
                    cr.move_to(*sh[0])
                    for p in sh[1:]:
                        cr.line_to(*p)
                cr.set_line_width(1.0 / k); cr.set_source_rgb(0.72, 0.68, 0.6); cr.stroke()
                cr.restore()
        for ty in range(int(math.floor(y0 / TILE)), int(math.floor((y0 + h) / TILE)) + 1):
            if ty < 0 or ty >= n:
                continue
            for tx in range(int(math.floor(x0 / TILE)), int(math.floor((x0 + w) / TILE)) + 1):
                px, py = tx * TILE - x0, ty * TILE - y0
                for layer in (('sat', 'names') if self.sat else ('map',)):
                    t = self.tile(z, tx % n, ty, layer)
                    if t is not None:
                        cr.set_source_surface(t, px, py); cr.paint()

        # 2.18: a route (directions), under the places
        if len(self.route) > 1:
            cr.set_line_join(1); cr.set_line_cap(1)
            for width, rgba in ((9, (1, 1, 1, 0.95)), (5.5, (0.12, 0.47, 0.9, 0.95))):
                for i, (la, lo) in enumerate(self.route):
                    px, py = to_px(la, lo, z); sx, sy = px - x0, py - y0
                    (cr.move_to if i == 0 else cr.line_to)(sx, sy)
                cr.set_source_rgba(*rgba); cr.set_line_width(width); cr.stroke()
        # 2.23: how many churches in each part of the world (zoomed out)
        for la, lo, n in self.bubbles:
            mx, my = to_px(la, lo, z); sx, sy = mx - x0, my - y0
            if sx < -30 or sy < -30 or sx > w + 30 or sy > h + 30:
                continue
            r = 14 + min(16, math.log10(max(1, n)) * 6)
            cr.arc(sx, sy, r + 2, 0, 2 * math.pi); cr.set_source_rgba(1, 1, 1, 0.9); cr.fill()
            cr.arc(sx, sy, r, 0, 2 * math.pi); cr.set_source_rgba(0.48, 0.12, 0.47, 0.88); cr.fill()
            lay = area.create_pango_layout(('%d' % n) if n < 1000 else ('%.1fk' % (n / 1000.0) if n < 10000 else '%dk' % (n // 1000)))
            lay.set_font_description(Pango.FontDescription.from_string('Sans Bold 9'))
            lw, lh = lay.get_pixel_size(); cr.set_source_rgb(1, 1, 1); cr.move_to(sx - lw / 2, sy - lh / 2); PangoCairo.show_layout(cr, lay)
        # the places
        for m in sorted(self.marks, key=lambda m: m[2] == self.sel):
            mx, my = to_px(m[0], m[1], z); sx, sy = mx - x0, my - y0
            if sx < -20 or sy < -20 or sx > w + 20 or sy > h + 20:
                continue
            on = m[2] == self.sel; r = 9 if on else 6
            rgb = Gdk.RGBA(); rgb.parse(m[3] or '#7a1f78')
            cr.arc(sx, sy, r + 2, 0, 2 * math.pi); cr.set_source_rgb(1, 1, 1); cr.fill()
            cr.arc(sx, sy, r, 0, 2 * math.pi); cr.set_source_rgba(rgb.red, rgb.green, rgb.blue, 1); cr.fill()
            if on and m[4]:
                lay = area.create_pango_layout(m[4]); lay.set_font_description(Pango.FontDescription.from_string('Sans Bold 10'))
                lw, lh = lay.get_pixel_size()
                cr.set_source_rgba(1, 1, 1, 0.92); cr.rectangle(sx + 12, sy - lh / 2 - 3, lw + 10, lh + 6); cr.fill()
                cr.set_source_rgb(0.24, 0.04, 0.25); cr.move_to(sx + 17, sy - lh / 2)
                PangoCairo.show_layout(cr, lay)
        if self.pin:   # 2.43: the place picked for the church form
            px_, py_ = to_px(self.pin[0], self.pin[1], z); sx, sy = px_ - x0, py_ - y0
            lay = area.create_pango_layout('⛪'); lay.set_font_description(Pango.FontDescription.from_string('Sans 22'))
            lw, lh = lay.get_pixel_size()
            cr.arc(sx, sy, 4, 0, 2 * math.pi); cr.set_source_rgb(0.48, 0.12, 0.47); cr.fill()
            cr.set_source_rgb(0, 0, 0); cr.move_to(sx - lw / 2, sy - lh - 2); PangoCairo.show_layout(cr, lay)
        if self.here:
            hx, hy = to_px(self.here[0], self.here[1], z); sx, sy = hx - x0, hy - y0
            cr.arc(sx, sy, 9, 0, 2 * math.pi); cr.set_source_rgba(0.12, 0.47, 0.9, 0.25); cr.fill()
            cr.arc(sx, sy, 5, 0, 2 * math.pi); cr.set_source_rgb(0.12, 0.47, 0.9); cr.fill()
