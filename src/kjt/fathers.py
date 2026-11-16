"""The Holy Fathers: their writings, kept on this computer, to read like books."""
import json, os
from gi.repository import Gtk, Adw, GLib, Pango
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

    def refresh(self):
        idx = read_file('library/index.json') or []
        self.idx = {x['id']: x for x in idx}
        page = Adw.NavigationPage(title='The Holy Fathers', tag='home')
        tv = Adw.ToolbarView(); hb = Adw.HeaderBar(); tv.add_top_bar(hb); self.win.sidebar_button(hb)
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=18, margin_top=18, margin_bottom=30, margin_start=16, margin_end=16)
        last = SET.get('lib_last')
        if last and last.get('a') in self.idx:
            b = Gtk.Button(label='Continue reading: %s' % last.get('title', ''), halign=Gtk.Align.START); b.add_css_class('suggested-action'); b.add_css_class('pill')
            b.connect('clicked', lambda *_: self.open_part(last['a'], last['w'], last['p'])); box.append(b)
        if not idx:
            box.append(Gtk.Label(label='The writings of the Holy Fathers are not on this computer yet. Choose Downloads in the sidebar.', wrap=True, xalign=0))
        for title, about, ids in META['eras']:
            have = [a for a in ids if a in self.idx]
            if not have:
                continue
            grp = Adw.PreferencesGroup(title=title, description=about)
            for a in have:
                x = self.idx[a]
                row = Adw.ActionRow(title=GLib.markup_escape_text(x['name']), subtitle=GLib.markup_escape_text(x.get('when') or META['life'].get(a, '')), activatable=True)
                row.add_suffix(Gtk.Image(icon_name='go-next-symbolic'))
                row.connect('activated', lambda _r, a=a: self.open_author(a))
                grp.add(row)
            box.append(grp)
        c = Adw.Clamp(maximum_size=760); c.set_child(box)
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(c); tv.set_content(sc)
        page.set_child(tv)
        self.nav.replace([page])

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
                grp = Adw.PreferencesGroup(title=GLib.markup_escape_text(w['t']))
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
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(c); tv.set_content(sc)
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
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(c)
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


def esc(s):
    return (s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
