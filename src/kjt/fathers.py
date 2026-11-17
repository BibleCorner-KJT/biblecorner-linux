"""The Holy Fathers: their writings, kept on this computer, to read like books."""
import json, os
from gi.repository import Gtk, Adw, Gdk, GLib, Pango
from .core import SET, read_file
from .richtext import html_into, make_view

META = json.load(open(os.path.join(os.path.dirname(__file__), 'fathers_meta.json'), encoding='utf-8'))


class FathersPage(Gtk.Box):
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win
        self.nav = Adw.NavigationView(); self.nav.set_vexpand(True); self.append(self.nav)
        self.home = None
        self.size = SET.get('lib_size', 1.0)

    def topics(self):
        """the topics, eras and colours (fetched with the writings; a copy comes with the app)"""
        t = read_file('library/topics.json')
        if not t:
            t = json.load(open(os.path.join(os.path.dirname(__file__), 'fathers_topics.json'), encoding='utf-8'))
        self.T = t
        self.TOPIC = {x[0]: x for x in t['topics']}
        return t

    def tags_of(self, a, w):
        return (self.T.get('tags', {}).get(a) or {}).get(w, '').split()

    def topic_count(self, tid):
        n = 0
        for a, x in self.idx.items():
            n += sum(1 for w in x['works'] if tid in self.tags_of(a, w['id']))
        return n

    def refresh(self):
        idx = read_file('library/index.json') or []
        self.idx = {x['id']: x for x in idx}
        T = self.topics()
        page = Adw.NavigationPage(title='The Holy Fathers', tag='home')
        tv = Adw.ToolbarView(); hb = Adw.HeaderBar(); tv.add_top_bar(hb); self.win.sidebar_button(hb)
        self.q = Gtk.SearchEntry(placeholder_text='Find a Father or a writing', width_chars=22); hb.set_title_widget(self.q)
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=18, margin_top=18, margin_bottom=30, margin_start=16, margin_end=16)
        self.home_box = box
        self.q.connect('search-changed', lambda *_: self.fill_home())
        c = Adw.Clamp(maximum_size=980); c.set_child(box)
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(c); __import__("kjt.ui", fromlist=["steady"]).steady(sc); tv.set_content(sc)
        page.set_child(tv)
        self.nav.replace([page])
        self.fill_home()

    def fill_home(self):
        box, T = self.home_box, self.T
        while box.get_first_child():
            box.remove(box.get_first_child())
        q = self.q.get_text().strip().casefold()
        last = SET.get('lib_last')
        if last and last.get('a') in self.idx and not q:
            b = Gtk.Button(label='Continue reading: %s' % last.get('title', ''), halign=Gtk.Align.START); b.add_css_class('suggested-action'); b.add_css_class('pill')
            b.connect('clicked', lambda *_: self.open_part(last['a'], last['w'], last['p'])); box.append(b)
        if not self.idx:
            box.append(Gtk.Label(label='The writings of the Holy Fathers are not on this computer yet. Choose Downloads in the sidebar.', wrap=True, xalign=0))
            return
        # read by topic: coloured tiles, as on the website
        if not q:
            box.append(Gtk.Label(label='Read by topic', xalign=0, css_classes=['title-3']))
            tiles = [(t, self.topic_count(t[0])) for t in T['topics']]
            tiles = [x for x in tiles if x[1] > 0]
            fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, homogeneous=True, min_children_per_line=2, max_children_per_line=4, column_spacing=10, row_spacing=10)
            more = SET.get('hf_all_topics')
            for i, (t, n) in enumerate(tiles):
                if i >= 8 and not more:
                    break
                b = Gtk.Button(); b.add_css_class('kjt-tile'); b.add_css_class(tile_class(T['colors'][i % len(T['colors'])]))
                v = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, margin_top=6, margin_bottom=6)
                v.append(Gtk.Label(label=t[1], xalign=0, css_classes=['kjt-tile-icon']))
                v.append(Gtk.Label(label=t[2], xalign=0, wrap=True, css_classes=['heading']))
                v.append(Gtk.Label(label='%d writing%s' % (n, '' if n == 1 else 's'), xalign=0, css_classes=['caption']))
                b.set_child(v); b.connect('clicked', lambda _b, t=t: self.open_topic(t[0])); fb.append(b)
            box.append(fb)
            if len(tiles) > 8:
                tb = Gtk.Button(label=('▴ Fewer topics' if more else '▾ All topics (%d)' % len(tiles)), halign=Gtk.Align.CENTER); tb.add_css_class('flat')
                tb.connect('clicked', lambda *_: (SET.set('hf_all_topics', 0 if more else 1), self.fill_home())); box.append(tb)
        # the Fathers, era by era, each era in its own colour
        for i, (title, about, ids) in enumerate(T['eras']):
            have = [a for a in ids if a in self.idx and (not q or q in (self.idx[a]['name'] + ' ' + ' '.join(w['t'] for w in self.idx[a]['works']) + ' ' + T.get('about', {}).get(a, '')).casefold())]
            if not have:
                continue
            col = ERA_COLORS[i % len(ERA_COLORS)]; h = era_class(col)
            head = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, margin_top=8)
            lt = Gtk.Label(xalign=0, wrap=True); lt.set_markup('<span foreground="%s"><b><big>%s</big></b></span>' % (col, GLib.markup_escape_text(title))); head.append(lt)
            head.append(Gtk.Label(label=about, xalign=0, wrap=True, css_classes=['dim-label']))
            box.append(head)
            fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, homogeneous=True, min_children_per_line=1, max_children_per_line=3, column_spacing=10, row_spacing=10)
            for a in have:
                x = self.idx[a]
                b = Gtk.Button(); b.add_css_class('card'); b.add_css_class('kjt-fcard'); b.add_css_class('kjt-era-' + h)
                v = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, margin_top=8, margin_bottom=8, margin_start=10, margin_end=8)
                v.append(Gtk.Label(label=x['name'], xalign=0, wrap=True, max_width_chars=24, css_classes=['heading']))
                life = x.get('when') or META['life'].get(a, '')
                n = len(x['works'])
                v.append(Gtk.Label(label='%s%s%d writing%s' % (life, ' · ' if life else '', n, '' if n == 1 else 's'), xalign=0, css_classes=['dim-label', 'caption']))
                tops = self.top_topics(a)
                if tops:
                    v.append(Gtk.Label(label='  '.join(self.TOPIC[t][1] + ' ' + self.TOPIC[t][2] for t in tops[:3]), xalign=0, wrap=True, lines=2, max_width_chars=30, ellipsize=Pango.EllipsizeMode.END, css_classes=['caption']))
                b.set_child(v); b.connect('clicked', lambda _b, a=a: self.open_author(a)); fb.append(b)
            box.append(fb)

    def top_topics(self, a):
        n = {}
        for w in self.idx[a]['works']:
            for t in self.tags_of(a, w['id']):
                if t in self.TOPIC and t not in ('letters', 'begin'):
                    n[t] = n.get(t, 0) + 1
        order = [t[0] for t in self.T['topics']]
        return sorted(n, key=lambda t: (-n[t], order.index(t)))

    def open_topic(self, tid):
        """the writings on one topic, Father by Father, in the order of the eras"""
        t = self.TOPIC[tid]
        page = Adw.NavigationPage(title=t[2])
        tv = Adw.ToolbarView(); tv.add_top_bar(Adw.HeaderBar())
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=14, margin_top=18, margin_bottom=30, margin_start=16, margin_end=16)
        i = [x[0] for x in self.T['topics']].index(tid)
        hdr = Gtk.Box(spacing=12); hdr.add_css_class('kjt-tile'); hdr.add_css_class(tile_class(self.T['colors'][i % len(self.T['colors'])]))
        hdr.append(Gtk.Label(label=t[1], css_classes=['kjt-tile-icon'], margin_start=14))
        hdr.append(Gtk.Label(label=t[2], xalign=0, wrap=True, css_classes=['title-2'], margin_top=14, margin_bottom=14)); box.append(hdr)
        for ei, (title, about, ids) in enumerate(self.T['eras']):
            for a in ids:
                if a not in self.idx:
                    continue
                ws = [w for w in self.idx[a]['works'] if tid in self.tags_of(a, w['id'])]
                parts = [x for x in self.T.get('parts', {}).get(tid, []) if x[0] == a]
                if not ws and not parts:
                    continue
                grp = Adw.PreferencesGroup(title=GLib.markup_escape_text(self.idx[a]['name']), description=GLib.markup_escape_text(self.idx[a].get('when') or META['life'].get(a, '')))
                for x in parts:
                    row = Adw.ActionRow(title=GLib.markup_escape_text(x[3]), subtitle='One part of the writing', activatable=True)
                    row.connect('activated', lambda _r, a=a, x=x: self.open_part(a, x[1], x[2])); row.add_suffix(Gtk.Image(icon_name='go-next-symbolic')); grp.add(row)
                for w in ws:
                    others = [self.TOPIC[o][1] + ' ' + self.TOPIC[o][2] for o in self.tags_of(a, w['id']) if o != tid and o in self.TOPIC]
                    sub = ('%d parts' % w['n'] if w.get('n', 1) > 1 else '') + (' · ' if w.get('n', 1) > 1 and others else '') + ' · '.join(others)
                    row = Adw.ActionRow(title=GLib.markup_escape_text(w['t']), subtitle=GLib.markup_escape_text(sub), activatable=True)
                    row.connect('activated', lambda _r, a=a, w=w: self.open_work(a, w['id'])); row.add_suffix(Gtk.Image(icon_name='go-next-symbolic')); grp.add(row)
                box.append(grp)
        c = Adw.Clamp(maximum_size=820); c.set_child(box)
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(c); __import__("kjt.ui", fromlist=["steady"]).steady(sc); tv.set_content(sc)
        page.set_child(tv); self.nav.push(page)

    def open_work(self, a, wid):
        """a writing in one part opens at once; one in many parts opens its Father's page"""
        data = read_file('library/%s.json.gz' % a) or {}
        parts = (data.get(wid) or {}).get('p') or []
        if len(parts) == 1:
            self.open_part(a, wid, 0)
        else:
            self.open_author(a)

    def open_author(self, a):
        x = self.idx[a]
        data = read_file('library/%s.json.gz' % a)
        page = Adw.NavigationPage(title=x['name'])
        tv = Adw.ToolbarView(); tv.add_top_bar(Adw.HeaderBar())
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=14, margin_top=18, margin_bottom=30, margin_start=16, margin_end=16)
        t = Gtk.Label(label=x['name'], xalign=0, wrap=True); t.add_css_class('title-1'); box.append(t)
        sub = META['life'].get(a) or x.get('when') or ''
        if sub:
            box.append(Gtk.Label(label=sub, xalign=0, css_classes=['dim-label']))
        if META['about'].get(a):
            l = Gtk.Label(label=META['about'][a], xalign=0, wrap=True); l.add_css_class('kjt-about'); box.append(l)
        if data is None:
            box.append(Gtk.Label(label='Not on this computer yet. Choose Downloads in the sidebar.', xalign=0, wrap=True))
        else:
            for w in x['works']:
                work = data.get(w['id']) or {}
                parts = work.get('p') or []
                tops = [self.TOPIC[o][1] + ' ' + self.TOPIC[o][2] for o in self.tags_of(a, w['id']) if o in getattr(self, 'TOPIC', {})]
                grp = Adw.PreferencesGroup(title=GLib.markup_escape_text(w['t']), description=GLib.markup_escape_text(' · '.join(tops)) if tops else None)
                if len(parts) == 1:
                    row = Adw.ActionRow(title='Read', activatable=True); row.add_suffix(Gtk.Image(icon_name='go-next-symbolic'))
                    row.connect('activated', lambda _r, w=w: self.open_part(a, w['id'], 0)); grp.add(row)
                else:
                    ex = Adw.ExpanderRow(title='%d parts' % len(parts))
                    for n, p in enumerate(parts):
                        row = Adw.ActionRow(title=GLib.markup_escape_text(p.get('t') or 'Part %d' % (n + 1)), activatable=True)
                        row.connect('activated', lambda _r, w=w, n=n: self.open_part(a, w['id'], n)); ex.add_row(row)
                    grp.add(ex)
                box.append(grp)
        c = Adw.Clamp(maximum_size=760); c.set_child(box)
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(c); __import__("kjt.ui", fromlist=["steady"]).steady(sc); tv.set_content(sc)
        page.set_child(tv); self.nav.push(page)

    def open_part(self, a, wid, n):
        data = read_file('library/%s.json.gz' % a) or {}
        work = data.get(wid) or {}
        parts = work.get('p') or []
        if not parts:
            return
        n = max(0, min(n, len(parts) - 1))
        p = parts[n]
        name = self.idx.get(a, {}).get('name', '')
        title = work.get('t', '') + ((' · ' + p.get('t')) if len(parts) > 1 and p.get('t') else '')
        SET.set('lib_last', {'a': a, 'w': wid, 'p': n, 'title': title})
        page = Adw.NavigationPage(title=title)
        tv = Adw.ToolbarView(); hb = Adw.HeaderBar(); tv.add_top_bar(hb)
        view = make_view(self.win.open_link)
        view.add_css_class('kjt-book')
        def draw():
            html_into(view, '<h1>%s</h1><p><i>%s</i></p>%s' % (esc(title), esc(name), p.get('h', '')), self.win.open_link, self.size)
        draw()
        for lab, f in (('A+', 1.1), ('A−', 1 / 1.1)):
            b = Gtk.Button(label=lab, tooltip_text='Text size'); b.add_css_class('flat')
            def zoom(_b, f=f):
                self.size = max(0.7, min(2.2, self.size * f)); SET.set('lib_size', self.size); draw()
            b.connect('clicked', zoom); hb.pack_end(b)
        c = Adw.Clamp(maximum_size=820); c.set_child(view)
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(c); __import__("kjt.ui", fromlist=["steady"]).steady(sc)
        tv.set_content(sc)
        if len(parts) > 1:
            bar = Gtk.ActionBar()
            if n > 0:
                b = Gtk.Button(label='← ' + (parts[n - 1].get('t') or 'Before')); b.get_child().set_ellipsize(Pango.EllipsizeMode.END)
                b.connect('clicked', lambda *_: (self.nav.pop(), self.open_part(a, wid, n - 1))); bar.pack_start(b)
            bar.set_center_widget(Gtk.Label(label='%d / %d' % (n + 1, len(parts)), css_classes=['dim-label']))
            if n < len(parts) - 1:
                b = Gtk.Button(label=(parts[n + 1].get('t') or 'Next') + ' →'); b.get_child().set_ellipsize(Pango.EllipsizeMode.END)
                b.connect('clicked', lambda *_: (self.nav.pop(), self.open_part(a, wid, n + 1))); bar.pack_end(b)
            tv.add_bottom_bar(bar)
        page.set_child(tv); self.nav.push(page)


ERA_COLORS = ['#7a1f6b', '#8e2438', '#b8860b', '#1f6f9b', '#2e7d6b', '#6d4c2f', '#5f6b7a']
_PAINTED = set()


def _css(css):
    pr = Gtk.CssProvider(); pr.load_from_string(css) if hasattr(pr, 'load_from_string') else pr.load_from_data(css, -1)
    Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), pr, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)


def tile_class(c):
    """a topic tile in its two colours (as on the website)"""
    name = 'kjt-tile-%s-%s' % (c[0].lstrip('#'), c[1].lstrip('#'))
    if name not in _PAINTED:
        _css('button.%s, box.%s { background: linear-gradient(135deg, %s, %s); color: white; border-radius: 14px; } '
             'button.%s:hover { filter: brightness(1.06); }' % (name, name, c[0], c[1], name))
        _PAINTED.add(name)
    return name


def era_class(col):
    h = col.lstrip('#')
    if h not in _PAINTED:
        _css('button.kjt-fcard.kjt-era-%s { border-left: 6px solid #%s; }' % (h, h))
        _PAINTED.add(h)
    return h


def esc(s):
    return (s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
