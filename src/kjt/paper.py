"""2.18: reading pages that are easy on the eyes: the page behind the Bible, the Church Fathers and the books.

Chosen from what is known about reading comfort:
 - dark letters on a light page are read faster and more accurately than light letters on dark (the
   "positive polarity" advantage: the brighter page makes the pupil smaller and the letters sharper);
 - warm, paper-like pages (cream, peach, yellow) were read fastest, and cool blue, blue-grey and green
   pages slowest, by readers with and without dyslexia (Rello & Bigham, ASSETS 2017); cream is what the
   British Dyslexia Association recommends;
 - never pure black on pure white (glare), and at night a warm dark page with soft parchment letters,
   not white on black (the letters seem to glow and smear: "halation"), and little blue light;
 - but not the harshest contrast either: pure black on white over-stimulates the eye, so every page here keeps
   its letters between 10:1 and 12:1 against the page (WCAG asks 4.5:1; AAA 7:1; black on white is 21:1),
   and every coloured word (titles, verse numbers, the words of Christ) at least 5:1;
 - light text on a dark page blurs ("halation") for the many people with astigmatism, whose pupils open wide
   in the dark: so the light pages come first, and the night page is kept soft.
"""
from gi.repository import Gtk, Gdk, Adw
from .core import SET

# key: (name, page, letters, titles, verse numbers, words of Christ, dark?, edge of the page (old book) or None)
THEMES = {
    'cream':   ('Cream paper',   '#FAF3E3', '#3A2E24', '#6B2C14', '#8A5A1E', '#A0251B', False, None),
    'oldbook': ('Old book',      '#F0E2C0', '#33261A', '#7A1E12', '#7A1E12', '#8E1F14', False, '#E2CC9C'),
    'peach':   ('Warm peach',    '#EDD1B0', '#2A2016', '#5E1F10', '#6B4518', '#8E1F14', False, None),
    'evening': ('Evening sepia', '#D9C6A2', '#241A10', '#5A1E0E', '#5A3E1C', '#7E1B10', False, None),
    'candle':  ('Candlelight (dark room)', '#1E1914', '#D8CBB0', '#E3B66E', '#C9A05A', '#F09A86', True, None),
}
ORDER = ['app', 'cream', 'oldbook', 'peach', 'evening', 'candle']
NAMES = {'app': 'As the app (light or dark)'}
NAMES.update({k: v[0] for k, v in THEMES.items()})
TIPS = {
    'app': 'The page follows the app: white by day, dark at night.',
    'cream': 'Soft cream, as recommended for comfortable reading. A good everyday page.',
    'oldbook': 'Aged parchment with a book type and darker edges, like an old printed Bible.',
    'peach': 'Warm peach: in studies, the page people read fastest on.',
    'evening': 'A dimmer sepia page for the evening, with less glare.',
    'candle': 'Only for a dark room: a warm dark page with soft letters and little blue light. For long reading, a light page is clearer.',
}

_prov = None
WIDGETS = ('textview.kjt-bible', 'textview.kjt-book')


def current():
    k = SET.get('paper') or 'cream'
    return k if k in THEMES else 'app'


def theme():
    return THEMES.get(current())


def is_dark():
    """are the letters light on a dark page? (the colours of words follow this)"""
    t = theme()
    return t[6] if t else Adw.StyleManager.get_default().get_dark()


def colour(what, dark_default, light_default):
    """a word's colour on this page: what is 'title', 'vn' or 'red'"""
    t = theme()
    if not t:
        return dark_default if Adw.StyleManager.get_default().get_dark() else light_default
    if what == 'soft':
        return mix(t[2], t[1], 0.3)
    return {'title': t[3], 'vn': t[4], 'red': t[5], 'ink': t[2]}[what]


def mix(a, b, f):
    """colour a, f of the way towards colour b"""
    a = [int(a[i:i + 2], 16) for i in (1, 3, 5)]; b = [int(b[i:i + 2], 16) for i in (1, 3, 5)]
    return '#%02x%02x%02x' % tuple(round(x + (y - x) * f) for x, y in zip(a, b))


def css_for(k):
    t = THEMES.get(k)
    if not t:
        return ''
    name, bg, fg, ti, vn, red, dark, edge = t
    page = bg if not edge else 'radial-gradient(ellipse at center, %s 55%%, %s 100%%)' % (bg, edge)
    sel = ', '.join(WIDGETS); txt = ', '.join(w + ' text' for w in WIDGETS)
    font = 'font-family: "EB Garamond", "Crimson Text", "Libre Baskerville", Georgia, "Noto Serif", "DejaVu Serif", Serif;' if k == 'oldbook' else ''
    # the page lies on the app like a page of a book: its own colour, rounded, with a soft shadow
    return ('%s { background: %s; color: %s; %s border-radius: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.18), 0 6px 18px rgba(60,40,10,0.10); margin: 6px 10px 10px 10px; }\n'
            '%s { background: transparent; color: %s; }\n'
            'textview.kjt-bible text selection, textview.kjt-book text selection { background: alpha(%s, 0.28); color: %s; }\n'
            % (sel, page, fg, font, txt, fg, ti, fg))


def apply():
    global _prov
    disp = Gdk.Display.get_default()
    if _prov is not None:
        Gtk.StyleContext.remove_provider_for_display(disp, _prov); _prov = None
    css = css_for(current())
    if css:
        _prov = Gtk.CssProvider()
        _prov.load_from_string(css) if hasattr(_prov, 'load_from_string') else _prov.load_from_data(css, -1)
        Gtk.StyleContext.add_provider_for_display(disp, _prov, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION + 5)


def swatch(k, size=40):
    """a little picture of the page, with 'Aa' on it"""
    t = THEMES.get(k)
    da = Gtk.DrawingArea(content_width=size, content_height=size, valign=Gtk.Align.CENTER)
    def draw(_a, cr, w, h):
        import math
        if t:
            bg, fg = Gdk.RGBA(), Gdk.RGBA(); bg.parse(t[1]); fg.parse(t[2])
        else:
            dark = Adw.StyleManager.get_default().get_dark()
            bg, fg = Gdk.RGBA(), Gdk.RGBA(); bg.parse('#242424' if dark else '#ffffff'); fg.parse('#eeeeee' if dark else '#222222')
        r = 8
        cr.new_sub_path(); cr.arc(w - r, r, r, -math.pi / 2, 0); cr.arc(w - r, h - r, r, 0, math.pi / 2); cr.arc(r, h - r, r, math.pi / 2, math.pi); cr.arc(r, r, r, math.pi, 3 * math.pi / 2); cr.close_path()
        cr.set_source_rgba(bg.red, bg.green, bg.blue, 1); cr.fill_preserve(); cr.set_source_rgba(0.5, 0.45, 0.4, 0.5); cr.set_line_width(1); cr.stroke()
        cr.set_source_rgba(fg.red, fg.green, fg.blue, 1); cr.select_font_face('Serif'); cr.set_font_size(h * 0.42)
        ext = cr.text_extents('Aa'); cr.move_to((w - ext.width) / 2 - ext.x_bearing, (h - ext.height) / 2 - ext.y_bearing); cr.show_text('Aa')
    da.set_draw_func(draw)
    return da
