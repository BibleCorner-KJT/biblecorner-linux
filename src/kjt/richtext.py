"""Simple HTML (the dictionary, the Holy Fathers' writings, Study Pads) shown in a Gtk.TextView."""
import re, html
from html.parser import HTMLParser
from gi.repository import Gtk, Pango, Gdk

BLOCK = {'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'li', 'blockquote', 'tr', 'ul', 'ol', 'section', 'article', 'figure'}


def setup_tags(buf, size=1.0):
    t = buf.get_tag_table()
    def tag(name, **props):
        old = t.lookup(name)
        if old:
            t.remove(old)
        buf.create_tag(name, **props)
    tag('b', weight=Pango.Weight.BOLD)
    tag('i', style=Pango.Style.ITALIC)
    tag('u', underline=Pango.Underline.SINGLE)
    tag('h1', weight=Pango.Weight.BOLD, scale=1.6 * size, pixels_above_lines=14, pixels_below_lines=6, family='Serif')
    tag('h2', weight=Pango.Weight.BOLD, scale=1.35 * size, pixels_above_lines=14, pixels_below_lines=6, family='Serif')
    tag('h3', weight=Pango.Weight.BOLD, scale=1.15 * size, pixels_above_lines=10, pixels_below_lines=4)
    tag('p', pixels_below_lines=10, scale=size)
    tag('sup', rise=6 * Pango.SCALE, scale=0.7)
    tag('small', scale=0.85)
    tag('quote', left_margin=24, style=Pango.Style.ITALIC, pixels_below_lines=8, scale=size, paragraph_background='rgba(243,197,72,0.12)')
    tag('li', left_margin=22, pixels_below_lines=4, scale=size)
    tag('a', foreground='#3d5aa8', underline=Pango.Underline.SINGLE)
    tag('dim', foreground='#7a6c82')
    tag('verse', scale=size, family='Serif', pixels_below_lines=6)


class Render(HTMLParser):
    """writes HTML into the buffer at its end; links are kept as tags named link:<href>"""
    def __init__(self, view, on_link=None, size=1.0):
        super().__init__(convert_charrefs=True)
        self.view, self.buf, self.on_link = view, view.get_buffer(), on_link
        self.stack = []; self.href = []; self.pending_nl = 0; self.skip = 0; self.spots = []
        self.size = size

    def nl(self, n=1):
        it = self.buf.get_end_iter()
        if self.buf.get_char_count() == 0:
            return
        it2 = it.copy(); it2.backward_chars(2)
        tail = self.buf.get_text(it2, it, False)
        have = len(tail) - len(tail.rstrip('\n'))
        if have < n:
            self.buf.insert(it, '\n' * (n - have))

    def tags(self):
        out = []
        for t in self.stack:
            if t in ('b', 'strong'): out.append('b')
            elif t in ('i', 'em', 'cite'): out.append('i')
            elif t == 'u': out.append('u')
            elif t in ('h1', 'h2', 'h3'): out.append(t)
            elif t in ('h4', 'h5'): out.append('h3')
            elif t == 'sup': out.append('sup')
            elif t == 'small': out.append('small')
            elif t == 'blockquote': out.append('quote')
            elif t == 'li': out.append('li')
        if not any(x in out for x in ('h1', 'h2', 'h3', 'quote', 'li')):
            out.append('p')
        if self.href:
            out.append(self.link_tag(self.href[-1]))
        return out

    def link_tag(self, href):
        name = 'link:' + href
        t = self.buf.get_tag_table().lookup(name)
        if not t:
            t = self.buf.create_tag(name, foreground='#3d5aa8', underline=Pango.Underline.SINGLE)
        return name

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag in ('script', 'style'):
            self.skip += 1; return
        if tag == 'br':
            self.buf.insert(self.buf.get_end_iter(), '\n'); return
        if tag in BLOCK:
            self.nl(2 if tag in ('p', 'h1', 'h2', 'h3', 'blockquote') else 1)
        if tag == 'li':
            self.stack.append('li'); self.buf.insert_with_tags_by_name(self.buf.get_end_iter(), '• ', 'li'); return
        if tag == 'a':
            h = a.get('href') or ''
            if h and not h.startswith('#fn') and not h.startswith('#r'):
                self.href.append(h); self.stack.append('a')
            else:
                self.stack.append('a-plain')
            return
        if tag == 'span' and 'kd-v' in (a.get('class') or '') and a.get('data-v'):
            m = self.buf.create_mark(None, self.buf.get_end_iter(), True)
            self.spots.append((m, a['data-v']))
        self.stack.append(tag)

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip - 1); return
        if tag == 'a':
            if self.stack and self.stack[-1] == 'a':
                self.stack.pop()
                if self.href:
                    self.href.pop()
            elif self.stack and self.stack[-1] == 'a-plain':
                self.stack.pop()
            return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i] == tag:
                del self.stack[i:]; break
        if tag in BLOCK:
            self.nl(2 if tag in ('p', 'h1', 'h2', 'h3', 'blockquote') else 1)

    def handle_data(self, d):
        if self.skip:
            return
        d = re.sub(r'\s+', ' ', d)
        if not d.strip() and (self.buf.get_char_count() == 0 or self.buf.get_text(self.buf.get_iter_at_offset(max(0, self.buf.get_char_count() - 1)), self.buf.get_end_iter(), False) in ('\n', ' ')):
            return
        it = self.buf.get_end_iter()
        if self.buf.get_char_count() and d.startswith(' '):
            prev = self.buf.get_iter_at_offset(self.buf.get_char_count() - 1)
            if self.buf.get_text(prev, it, False) == '\n':
                d = d.lstrip()
        self.buf.insert_with_tags_by_name(it, d, *self.tags())


def html_into(view, s, on_link=None, size=1.0, clear=True):
    buf = view.get_buffer()
    if clear:
        buf.set_text('')
    setup_tags(buf, size)
    r = Render(view, on_link, size)
    r.feed(s or '')
    r.close()
    # trailing empty lines
    end = buf.get_end_iter(); st = end.copy()
    while st.backward_char() and st.get_char() == '\n':
        pass
    st.forward_char()
    if st.get_offset() < end.get_offset():
        buf.delete(st, end)
    return r.spots


def make_view(on_link=None):
    """a read-only text view whose links (link:<href> tags) call on_link(href)"""
    v = Gtk.TextView(editable=False, cursor_visible=False, wrap_mode=Gtk.WrapMode.WORD_CHAR,
                     left_margin=18, right_margin=18, top_margin=14, bottom_margin=24)
    v.add_css_class('kjt-text')
    if on_link:
        click = Gtk.GestureClick()
        def pressed(g, n, x, y):
            bx, by = v.window_to_buffer_coords(Gtk.TextWindowType.WIDGET, int(x), int(y))
            ok, it = v.get_iter_at_location(bx, by)
            if not ok:
                return
            for t in it.get_tags():
                nm = t.get_property('name') or ''
                if nm.startswith('link:'):
                    on_link(nm[5:]); return
        click.connect('released', pressed)
        v.add_controller(click)
        motion = Gtk.EventControllerMotion()
        def moved(c, x, y):
            bx, by = v.window_to_buffer_coords(Gtk.TextWindowType.WIDGET, int(x), int(y))
            ok, it = v.get_iter_at_location(bx, by)
            hand = ok and any((t.get_property('name') or '').startswith('link:') for t in it.get_tags())
            v.set_cursor_from_name('pointer' if hand else 'text')
        motion.connect('motion', moved)
        v.add_controller(motion)
    return v


def verse_link(href):
    """#/p/kjva/John/3/16-18 -> ('John', 3, 16, 18)"""
    m = re.search(r'#/(?:p|read)/[^/]+/([^/]+)/(\d+)(?:/(\d+)(?:[-–](\d+))?)?', href or '')
    if not m:
        return None
    from urllib.parse import unquote
    return unquote(m.group(1)), int(m.group(2)), int(m.group(3) or 0), int(m.group(4) or 0)
