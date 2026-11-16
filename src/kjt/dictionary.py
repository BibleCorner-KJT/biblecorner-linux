"""The Bible Dictionary: places, names, the Apostles, the Fathers, peoples and words of the faith; and every place on the Bible Maps."""
import json, os, re, html, unicodedata
from gi.repository import Gtk, Adw, GLib, Pango
from .core import STORE, SET, lang, read_file, book_name, strip_tags, info
from .richtext import html_into, make_view

PW = json.load(open(os.path.join(os.path.dirname(__file__), 'place_words.json'), encoding='utf-8'))
HW = json.load(open(os.path.join(os.path.dirname(__file__), 'people_words.json'), encoding='utf-8'))
KINDS = [('', 'All'), ('place', '🏛️ Places'), ('name', '👤 Names'), ('apostle', '🕊️ Apostles'), ('father', '📖 Fathers'), ('people', '🏕️ Peoples'), ('faith', '✝️ The faith')]
_cache = {}


def fold(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s or '') if unicodedata.category(c) != 'Mn').casefold()


def fmt(s, *a):
    s = str(s)
    for i, x in enumerate(a):
        s = s.replace('{%d}' % i, str(x))
    return s


def place_entries(l):
    """the places of the Bible Maps, written as dictionary entries (as the website does)"""
    pl = read_file('maps/places.json')
    if not pl or not pl.get('p'):
        return []
    ident = read_file('maps/ident.json') or {}
    names = (read_file('maps/names-%s.json' % l) or {}) if l != 'en' else {}
    W = PW.get(l) or PW['en']
    en = ((STORE.kv('info') or {}).get('books') or {}).get('en') or {}
    def ref(v):
        p = v.split('.'); return '%s %s:%s' % (book_name(p[0], l), p[1], p[2])
    def link(v):
        p = v.split('.'); return '<a href="#/p/kjva/%s/%s/%s">%s</a>' % (en.get(p[0], p[0]), p[1], p[2], html.escape(ref(v)))
    def where(x):
        t, a1 = x[0], x[1]; y = x[2] if len(x) > 3 else ''
        return fmt(W.get(t) or '{0}', a1, y) if t else a1
    out, seen = [], set()
    for r in pl['p']:
        if r[7]:
            continue  # it has its own full entry
        name = names.get(r[0]) or r[1]
        vs = r[6].split(' ') if r[6] else []
        kind = W['k'].get(r[2]) or W['k']['o']
        h = '<p>' + html.escape(fmt(W['one'] if len(vs) == 1 else W['intro'], name, kind, len(vs))) + (' ' + fmt(W['first'], link(vs[0])) if vs else '') + '</p>'
        ids = ident.get(r[0]) or []
        if ids:
            x0 = ids[0]
            h += '<h3>%s</h3><p>%s <small>(%s)</small></p>' % (html.escape(W['where']), html.escape(where(x0)), html.escape(W['c%d' % x0[-1]]))
            if len(ids) > 1:
                h += '<p>%s %s</p>' % (html.escape(W['also']), '; '.join('%s <small>(%s)</small>' % (html.escape(where(x)), html.escape(W['c%d' % x[-1]])) for x in ids[1:]))
        if vs:
            h += '<h3>%s</h3>' % html.escape(W['verses'])
            for v in vs[:4]:
                p = v.split('.')
                h += '<blockquote><span class="kd-v" data-v="%s.%s.%s.%s.%s"></span> — %s</blockquote>' % (p[0], p[1], p[2], p[2], p[1], link(v))
            if len(vs) > 4:
                h += '<p>%s: %s%s</p>' % (html.escape(W['more']), ', '.join(link(v) for v in vs[4:40]), ' …' if len(vs) > 40 else '')
        key = name + '|' + r[2]
        t = name + ((' (%s)' % (ref(vs[0]) if vs else r[0])) if key in seen else '')
        seen.add(key)
        out.append({'id': 'p-' + r[0], 't': t, 'g': 'place', 'k': [name], 'h': h, 'map': r[0],
                    'x': fmt(W['one'] if len(vs) == 1 else W['intro'], name, kind, len(vs)),
                    'c': [['openbible', '', 'https://www.openbible.info/geo/ancient/%s/%s' % (r[0], r[10])]]})
    return out


def people_entries(l, base):
    """the people of the Bible (Theographic Bible Metadata, with Orthodox corrections), as the website makes them"""
    d = read_file('dictionary/people.json')
    if not d or not d.get('p'):
        return []
    W = HW.get(l) or HW['en']
    en = ((STORE.kv('info') or {}).get('books') or {}).get('en') or {}
    title = {e['id']: e['t'] for e in base}
    cnt = {}
    for r in d['p']:
        cnt[r[2] or r[1]] = cnt.get(r[2] or r[1], 0) + 1
    for r in d['p']:
        t = r[2] or r[1]
        if cnt[t] > 1 and r[5]:
            p = r[5].split(' ')[0].split('.'); t += ' (%s %s:%s)' % (book_name(p[0], l), p[1], p[2])
        title[r[0]] = t
    def ref(v):
        p = v.split('.'); return '%s %s:%s' % (book_name(p[0], l), p[1], p[2])
    def link(v):
        p = v.split('.'); return '<a href="#/p/kjva/%s/%s/%s">%s</a>' % (en.get(p[0], p[0]), p[1], p[2], html.escape(ref(v)))
    def who(ids):
        return ', '.join('<a href="#kd:%s">%s</a>' % (i, html.escape(title[i])) for i in ids if i in title)
    def make(r, x):
        vs = r[5].split(' ') if r[5] else []
        n, g = r[6], r[3] or 'n'
        h = '<p>' + html.escape(x) + (' ' + fmt(W['first'], link(vs[0])) if vs else '') + (' ' + html.escape(fmt(W['also'], r[4])) if r[4] else '') + '</p>'
        fam = [(W['father'], r[7]), (W['mother'], r[8]), (W['wife'] if g == 'm' else W['husband'] if g == 'f' else W['spouse'], r[9]), (W['children'], r[10]), (W['siblings'], r[11])]
        fam = [(a, b) for a, b in fam if who(b)]
        if fam:
            h += '<h3>%s</h3><ul>%s</ul>' % (html.escape(W['fam']), ''.join('<li><b>%s:</b> %s</li>' % (html.escape(a), who(b)) for a, b in fam))
        if vs:
            h += '<h3>%s</h3>' % html.escape(W['verses'])
            for v in vs[:4]:
                p = v.split('.')
                h += '<blockquote><span class="kd-v" data-v="%s.%s.%s.%s.%s"></span> — %s</blockquote>' % (p[0], p[1], p[2], p[2], p[1], link(v))
            if len(vs) > 4:
                h += '<p>%s: %s%s</p>' % (html.escape(W['more']), ', '.join(link(v) for v in vs[4:40]), ' …' if n > 40 else '')
        return h
    out = []
    for r in d['p']:
        n, g = r[6], r[3] or 'n'
        x = fmt(W[g + '1'] if n == 1 else W[g], r[1], n)
        out.append({'id': r[0], 't': title[r[0]], 'g': 'name', 'k': [r[1]] + ([r[4]] if r[4] else []), 'x': x, 'make': (lambda r=r, x=x: make(r, x)),
                    'c': [['theographic', '', 'https://github.com/robertrouse/theographic-bible-metadata']]})
    return out


def entries(l=None):
    l = l or lang()
    if l in _cache:
        return _cache[l]
    d = read_file('dictionary/%s.json' % l) or read_file('dictionary/en.json') or {}
    E = list(d.get('entries') or [])
    have = {e['id'] for e in E}
    E += [e for e in place_entries(l) if e['id'] not in have]
    E += [e for e in people_entries(l, E) if e['id'] not in have]
    for e in E:
        e['_s'] = fold(e['t'] + ' ' + ' '.join(e.get('k') or []))
    E.sort(key=lambda e: e['t'].casefold())
    _cache[l] = E
    return E


def forget():
    _cache.clear()


class DictPage(Gtk.Box):
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win
        self.kind = ''
        self.cur = None
        self.split = Adw.NavigationSplitView(); self.split.set_vexpand(True); self.append(self.split)
        # the list
        lt = Adw.ToolbarView(); lh = Adw.HeaderBar(); lt.add_top_bar(lh); win.sidebar_button(lh)
        lh.set_title_widget(Adw.WindowTitle(title='Bible Dictionary'))
        top = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_start=8, margin_end=8, margin_top=6, margin_bottom=6)
        self.q = Gtk.SearchEntry(placeholder_text='Find a word, a name or a place'); self.q.connect('search-changed', lambda *_: self.later())
        top.append(self.q)
        self.kinds = Gtk.DropDown.new_from_strings([k[1] for k in KINDS]); self.kinds.connect('notify::selected', lambda *_: self.fill())
        top.append(self.kinds)
        lt.add_top_bar(top)
        self.list = Gtk.ListBox(selection_mode=Gtk.SelectionMode.SINGLE); self.list.add_css_class('navigation-sidebar')
        self.list.connect('row-activated', lambda _l, row: self.open(row.entry))
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(self.list); lt.set_content(sc)
        self.count = Gtk.Label(css_classes=['dim-label', 'caption'], margin_bottom=4); lt.add_bottom_bar(self.count)
        self.split.set_sidebar(Adw.NavigationPage(title='Bible Dictionary', child=lt))
        # the article
        at = Adw.ToolbarView(); self.ah = Adw.HeaderBar(); at.add_top_bar(self.ah)
        self.map_btn = Gtk.Button(icon_name='kjt-map-symbolic', tooltip_text='Show on the Bible Maps'); self.map_btn.add_css_class('flat'); self.map_btn.connect('clicked', lambda *_: self.win.show_on_map(self.cur.get('map')))
        self.ah.pack_end(self.map_btn)
        self.view = make_view(self.on_link)
        c = Adw.Clamp(maximum_size=780); c.set_child(self.view)
        asc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); asc.set_child(c); at.set_content(asc)
        self.article = Adw.NavigationPage(title='', child=at)
        self.split.set_content(self.article)
        self.split.set_min_sidebar_width(260); self.split.set_max_sidebar_width(360)

    def set_compact(self, c):
        self.split.set_collapsed(c)

    def refresh(self):
        forget(); self.fill()
        if not self.cur:
            E = entries()
            if E:
                self.open(E[0], select=False)
            else:
                html_into(self.view, '<p>The Bible Dictionary is not on this computer yet. Choose Downloads in the sidebar.</p>')

    def later(self):
        """wait for a pause in the typing"""
        if getattr(self, 'timer', 0):
            GLib.source_remove(self.timer)
        self.timer = GLib.timeout_add(140, lambda: (setattr(self, 'timer', 0), self.fill(), False)[2])

    def fill(self):
        q = fold(self.q.get_text().strip())
        k = KINDS[self.kinds.get_selected()][0]
        while self.list.get_first_child():
            self.list.remove(self.list.get_first_child())
        found = [e for e in entries() if (not k or e['g'] == k) and (not q or q in e['_s'])]
        if q:
            found.sort(key=lambda e: (not fold(e['t']).startswith(q), e['t'].casefold()))
        for e in found[:400]:
            row = Gtk.ListBoxRow(); row.entry = e
            b = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=1, margin_top=4, margin_bottom=4)
            b.append(Gtk.Label(label=e['t'], xalign=0, ellipsize=Pango.EllipsizeMode.END))
            if e.get('x'):
                b.append(Gtk.Label(label=strip_tags(e['x']), xalign=0, ellipsize=Pango.EllipsizeMode.END, css_classes=['dim-label', 'caption']))
            row.set_child(b); self.list.append(row)
        self.count.set_label('%d found%s' % (len(found), ' (the first 400 shown)' if len(found) > 400 else ''))

    def open(self, e, select=True):
        self.cur = e
        self.article.set_title(e['t'])
        src = ''.join('<li><a href="%s">%s</a></li>' % (html.escape(c[2]), html.escape(c[0].title())) for c in (e.get('c') or []) if len(c) > 2 and c[2])
        if 'h' not in e and e.get('make'):
            e['h'] = e['make']()
        spots = html_into(self.view, '<h1>%s</h1>%s%s' % (html.escape(e['t']), e.get('h', ''), ('<h3>Sources</h3><ul>%s</ul>' % src) if src else ''), self.on_link)
        self.fill_verses(spots)
        self.map_btn.set_visible(bool(e.get('map')) or (e['g'] == 'place' and bool(self.place_for(e))))
        if e.get('map') is None and e['g'] == 'place':
            e['map'] = self.place_for(e)
        self.split.set_show_content(True)

    def place_for(self, e):
        pl = read_file('maps/places.json') or {}
        for r in pl.get('p', []):
            if r[7] == e['id']:
                return r[0]
        return None

    def fill_verses(self, spots):
        buf = self.view.get_buffer()
        tr = SET.get('tr')
        for mark, dv in spots:
            p = dv.split('.')
            try:
                b, c, v1, v2 = p[0], int(p[1]), int(p[2]), int(p[3])
            except Exception:
                continue
            t = tr if tr and STORE.find_book(tr, b) else next((x for x in STORE.bibles() if STORE.find_book(x, b)), None)
            rows = STORE.passage(t, b, c, v1, c, v2) if t else []
            txt = ' '.join(strip_tags(r[2]).strip() for r in rows) or '📖 %d:%d' % (c, v1)
            buf.insert_with_tags_by_name(buf.get_iter_at_mark(mark), '“%s”' % txt if rows else txt, 'quote')

    def open_id(self, i):
        e = next((x for x in entries() if x['id'] == i), None)
        if e:
            self.open(e)
        return bool(e)

    def on_link(self, href):
        self.win.open_link(href)
