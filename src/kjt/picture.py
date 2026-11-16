"""Share a verse as a picture (the same designer as on the website): a look, a shape and letters; then copy or save it."""
import math, os, re
import cairo
from gi.repository import Gtk, Adw, Gdk, GLib, Pango, PangoCairo, Gio

THEMES = {
    'royal': ('Royal', ('#4b0b4b', '#22061f'), '#c9a227', '#fff8e6', '#f3c548', '#d9c6dc'),
    'gold': ('Gold', ('#f6dc8a', '#c9a227'), '#5a0e2a', '#2a0a2c', '#5a0e2a', '#4a2a12'),
    'parchment': ('Parchment', ('#f8eed5', '#e6d2a2'), '#8b5a2b', '#3a2412', '#8e2438', '#6b4a2a'),
    'sunrise': ('Sunrise', ('#ffad5c', '#d6336c'), '#ffffff', '#ffffff', '#fff3c4', '#ffe6ee'),
    'ocean': ('Sea', ('#2a86c8', '#0b3557'), '#bfe6ff', '#ffffff', '#bfe6ff', '#d6ecfa'),
    'olive': ('Olive', ('#5b8a42', '#1f3d1a'), '#e8d48a', '#fffbe8', '#f3e08a', '#dfe8cf'),
    'rose': ('Rose', ('#b33a6b', '#4a0d2a'), '#ffd1e1', '#fff1f6', '#ffd1e1', '#f6d6e2'),
    'night': ('Night', ('#132552', '#03081a'), '#c9a227', '#f4f1ff', '#f3c548', '#c9cde8'),
    'photo': ('My photo', ('#222222', '#000000'), '#ffffff', '#ffffff', '#f3c548', '#e6e6e6'),
}
SHAPES = {'portrait': ('Portrait', 1080, 1350), 'square': ('Square', 1080, 1080), 'story': ('Story', 1080, 1920), 'landscape': ('Landscape', 1920, 1080)}
FONTS = {'classic': ('Classic', 'Serif'), 'clean': ('Clean', 'Sans'), 'elegant': ('Elegant', 'Serif Italic')}


def rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def cross(cr, x, y, s, color):
    """the Orthodox cross: the slanted bar rises on the left as you look at it"""
    cr.set_source_rgb(*rgb(color)); cr.set_line_width(s * 0.11); cr.set_line_cap(cairo.LINE_CAP_ROUND)
    for a, b, c, d in ((0, -0.5, 0, 0.5), (-0.13, -0.34, 0.13, -0.34), (-0.28, -0.14, 0.28, -0.14), (-0.17, 0.2, 0.17, 0.34)):
        cr.move_to(x + a * s, y + b * s); cr.line_to(x + c * s, y + d * s)
    cr.stroke()


def photo_surface(path):
    from gi.repository import GdkPixbuf
    pb = GdkPixbuf.Pixbuf.new_from_file(path)
    pb = pb.apply_embedded_orientation() or pb
    s = cairo.ImageSurface(cairo.FORMAT_RGB24, pb.get_width(), pb.get_height())
    c = cairo.Context(s); Gdk.cairo_set_source_pixbuf(c, pb, 0, 0); c.paint()
    return s


def render(text, ref, theme='royal', shape='portrait', font='classic', site='biblecorner.com', photo=None):
    name, bg, fr, tx, rf, sb = THEMES[theme]
    _, W, H = SHAPES[shape]
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    cr = cairo.Context(surf)
    g = cairo.LinearGradient(0, 0, W * 0.4, H); g.add_color_stop_rgb(0, *rgb(bg[0])); g.add_color_stop_rgb(1, *rgb(bg[1]))
    cr.set_source(g); cr.paint()
    if theme == 'photo' and photo is not None:   # your own picture, filling the card, a little darker for the words
        pw, ph = photo.get_width(), photo.get_height(); k = max(W / pw, H / ph)
        cr.save(); cr.translate((W - pw * k) / 2, (H - ph * k) / 2); cr.scale(k, k); cr.set_source_surface(photo, 0, 0); cr.paint(); cr.restore()
        cr.set_source_rgba(0, 0, 0, 0.45); cr.paint()
    if theme == 'night':  # a few stars
        import random
        rnd = random.Random(7)
        for _ in range(90):
            cr.set_source_rgba(1, 1, 1, rnd.uniform(0.25, 0.8)); cr.arc(rnd.uniform(0, W), rnd.uniform(0, H * 0.7), rnd.uniform(1, 3.2), 0, 2 * math.pi); cr.fill()
    m = W * 0.06
    cr.set_source_rgb(*rgb(fr)); cr.set_line_width(5); cr.rectangle(m, m, W - 2 * m, H - 2 * m); cr.stroke()
    cr.set_line_width(1.5); cr.rectangle(m + 14, m + 14, W - 2 * m - 28, H - 2 * m - 28); cr.stroke()
    family = FONTS[font][1]
    box_w = W - 2 * m - 120
    top, bottom = m + 70, H - m - 200          # the words and the reference stay above the cross
    lay = PangoCairo.create_layout(cr)
    lay.set_width(int(box_w * Pango.SCALE)); lay.set_alignment(Pango.Alignment.CENTER); lay.set_wrap(Pango.WrapMode.WORD_CHAR)
    rl = PangoCairo.create_layout(cr); rl.set_text('— ' + ref, -1)
    words = text if len(text) <= 900 else text[:880].rsplit(' ', 1)[0] + ' …'
    size = 78
    while True:
        lay.set_font_description(Pango.FontDescription.from_string('%s %d' % (family, size)))
        lay.set_spacing(int(size * 0.18 * Pango.SCALE))
        lay.set_text('“' + words + '”', -1)
        rl.set_font_description(Pango.FontDescription.from_string('Sans Bold %d' % max(28, int(size * 0.5))))
        tw, th = lay.get_pixel_size(); rw, rh = rl.get_pixel_size()
        if th + 30 + rh <= bottom - top or size <= 20:
            break
        size -= 2
    y0 = top + (bottom - top - (th + 30 + rh)) / 2
    cr.move_to((W - box_w) / 2, y0); cr.set_source_rgb(*rgb(tx)); PangoCairo.show_layout(cr, lay)
    cr.move_to((W - rw) / 2, y0 + th + 30); cr.set_source_rgb(*rgb(rf)); PangoCairo.show_layout(cr, rl)
    # the cross and the website, at the bottom
    cross(cr, W / 2, H - m - 120, 64, rf)
    sl = PangoCairo.create_layout(cr); sl.set_font_description(Pango.FontDescription.from_string('Sans 26')); sl.set_text(site, -1)
    sw, sh = sl.get_pixel_size(); cr.move_to((W - sw) / 2, H - m - 70); cr.set_source_rgb(*rgb(sb)); PangoCairo.show_layout(cr, sl)
    return surf


def texture(surf):
    import io
    b = io.BytesIO(); surf.write_to_png(b)
    return Gdk.Texture.new_from_bytes(GLib.Bytes.new(b.getvalue()))


def share(win, text, ref):
    """the small designer: choose the look, then copy or save"""
    from .core import SET
    o = dict(theme=SET.get('pic_theme', 'royal'), shape=SET.get('pic_shape', 'portrait'), font=SET.get('pic_font', 'classic'))
    photo = {'surf': None}
    if o['theme'] == 'photo':
        o['theme'] = 'royal'
    d = Adw.Dialog(title='Share as a picture', content_width=800, content_height=660)
    tv = Adw.ToolbarView(); tv.add_top_bar(Adw.HeaderBar())
    body = Gtk.Box(spacing=14, margin_start=14, margin_end=14, margin_top=8, margin_bottom=14)
    pic = Gtk.Picture(can_shrink=True, content_fit=Gtk.ContentFit.CONTAIN, hexpand=True, vexpand=True)
    body.append(pic)
    side = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8); side.set_size_request(230, -1)
    state = {}
    def draw(*_):
        state['surf'] = render(text, ref, photo=photo['surf'], **o)
        pic.set_paintable(texture(state['surf']))
        for k, v in o.items():
            if not (k == 'theme' and v == 'photo'):
                SET.set('pic_' + k, v)
    def choice(title, table, key):
        side.append(Gtk.Label(label=title, xalign=0, css_classes=['heading']))
        fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=3, min_children_per_line=2, column_spacing=4, row_spacing=4)
        group = None
        for k, row in table.items():
            b = Gtk.ToggleButton(label=row[0]); b.set_active(o[key] == k)
            if group:
                b.set_group(group)
            group = group or b
            b.connect('toggled', lambda bt, k=k: bt.get_active() and (pick_photo(bt) if k == 'photo' else (o.__setitem__(key, k), draw())))
            fb.append(b)
        side.append(fb)
    def pick_photo(button):
        """a photo from this computer: it stays on this computer, only the picture you share leaves it"""
        fd = Gtk.FileDialog(title='Choose a photo')
        flt = Gtk.FileFilter(); flt.set_name('Pictures'); flt.add_mime_type('image/*')
        fs = Gio.ListStore.new(Gtk.FileFilter); fs.append(flt); fd.set_filters(fs)
        pics = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES)
        if pics and os.path.isdir(pics):
            fd.set_initial_folder(Gio.File.new_for_path(pics))
        def done(dlg, res):
            try:
                f = dlg.open_finish(res)
                photo['surf'] = photo_surface(f.get_path())
            except Exception:
                win.toast('That picture could not be opened')
                return
            o['theme'] = 'photo'; draw()
        fd.open(win, None, done)
    choice('Look', THEMES, 'theme'); choice('Shape', SHAPES, 'shape'); choice('Letters', FONTS, 'font')
    side.append(Gtk.Separator(margin_top=6, margin_bottom=6))
    def copy_pic(*_):
        Gdk.Display.get_default().get_clipboard().set(texture(state['surf'])); win.toast('Picture copied: paste it in a message or a post')
    def save_pic(*_):
        fd = Gtk.FileDialog(initial_name=re.sub(r'[^\w\- ]', '', ref).strip().replace(' ', '-') + '.png')
        pics = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES)
        if pics and os.path.isdir(pics):
            fd.set_initial_folder(Gio.File.new_for_path(pics))
        def done(dlg, res):
            try:
                f = dlg.save_finish(res)
            except GLib.Error:
                return
            state['surf'].write_to_png(f.get_path()); win.toast('Picture saved: ' + os.path.basename(f.get_path()))
        fd.save(win, None, done)
    def copy_text(*_):
        Gdk.Display.get_default().get_clipboard().set('“%s”\n— %s' % (text, ref)); win.toast('Text copied')
    for label, fn, main in (('Copy picture', copy_pic, True), ('Save picture…', save_pic, False), ('Copy as text', copy_text, False)):
        b = Gtk.Button(label=label); b.connect('clicked', fn)
        if main:
            b.add_css_class('suggested-action')
        side.append(b)
    ss = Gtk.ScrolledWindow(hscrollbar_policy=Gtk.PolicyType.NEVER, propagate_natural_width=True); ss.set_child(side)
    body.append(ss)
    tv.set_content(body); d.set_child(tv)
    draw()
    d.present(win)
