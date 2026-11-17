"""Today with God: the verse of the day, the day in the Church (feast, fast, saints) and its readings, read from the Bibles kept here."""
import datetime, re
from gi.repository import Gtk, Adw, Gdk, GLib, Pango
from .core import STORE, SET, NET, DEFAULT_BIBLES, lang, book_name, run_bg, strip_tags
from .bible import bible_name


class TodayPage(Gtk.Box):
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win
        self.day = datetime.date.today()
        tv = Adw.ToolbarView(); tv.set_vexpand(True); self.append(tv)
        hb = Adw.HeaderBar(); tv.add_top_bar(hb)
        win.sidebar_button(hb)
        self.prev = Gtk.Button(icon_name='kjt-prev-symbolic', tooltip_text='The day before'); self.prev.connect('clicked', lambda *_: self.move(-1))
        self.next = Gtk.Button(icon_name='kjt-next-symbolic', tooltip_text='The day after'); self.next.connect('clicked', lambda *_: self.move(1))
        self.label = Gtk.Label(ellipsize=3); self.label.add_css_class('heading')
        t = Gtk.Box(spacing=6); t.append(self.prev); t.append(self.label); t.append(self.next)
        hb.set_title_widget(t)
        home = Gtk.Button(icon_name='kjt-today-symbolic', tooltip_text='Back to today'); home.add_css_class('flat'); home.connect('clicked', lambda *_: self.goto(datetime.date.today())); hb.pack_start(home)
        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=14, margin_top=18, margin_bottom=30, margin_start=16, margin_end=16)
        c = Adw.Clamp(maximum_size=760); c.set_child(self.box)
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(c); tv.set_content(sc)
        self.loading = False

    compact = False

    def set_compact(self, c):
        self.compact = c
        self.box.set_margin_start(8 if c else 16); self.box.set_margin_end(8 if c else 16)
        if self.label.get_label():
            self.label.set_label(self.day.strftime('%a %-d %b %Y' if c else '%A %-d %B %Y'))

    def data(self):
        return STORE.kv('today_' + lang()) or STORE.kv('today_en') or {}

    def refresh(self, force=False):
        """fetch the coming days now and then, so the app always knows today without the internet"""
        d = self.data(); days = d.get('days') or []
        have = {x['date'] for x in days}
        need = force or not days or (self.day + datetime.timedelta(days=7)).isoformat() not in have
        if need and NET.online() and not self.loading:
            self.loading = True
            lg = lang()
            def work():
                r = NET.ajax('kjtb_desk', op='today', lang=lg, days=62)
                if r.get('success'):
                    STORE.set_kv('today_' + lg, r['data']); return True
                return False
            def fin(ok):
                self.loading = False
                if ok is True:
                    self.show()
            run_bg(work, fin)

    def move(self, d):
        self.goto(self.day + datetime.timedelta(days=d))

    def goto(self, day):
        self.day = day; self.show(); self.refresh()

    def bible_for(self, book):
        for tr in (SET.get('tr'), DEFAULT_BIBLES.get(lang()), 'eng-kjv'):
            if tr and STORE.find_book(tr, book):
                return tr
        for tr in STORE.bibles():
            if STORE.find_book(tr, book):
                return tr
        return None

    def clear(self):
        while self.box.get_first_child():
            self.box.remove(self.box.get_first_child())

    def share_btn(self, get):
        """share this part of the day: as a picture, or as text to paste"""
        mb = Gtk.MenuButton(icon_name='kjt-share-symbolic', tooltip_text='Share', valign=Gtk.Align.START); mb.add_css_class('flat'); mb.add_css_class('circular')
        pop = Gtk.Popover(); bx = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, margin_top=6, margin_bottom=6, margin_start=6, margin_end=6)
        def pic():
            from . import picture
            text, ref = get(); picture.share(self.win, text, ref)
        def copy():
            text, ref = get()
            Gdk.Display.get_default().get_clipboard().set('%s\n— %s' % (text, ref)); self.win.toast('Copied: paste it in a message or a post')
        for lab, fn in (('Share as a picture…', pic), ('Copy the text', copy)):
            b = Gtk.Button(label=lab); b.add_css_class('flat'); b.get_child().set_xalign(0)
            b.connect('clicked', lambda _b, fn=fn: (pop.popdown(), fn())); bx.append(b)
        pop.set_child(bx); mb.set_popover(pop)
        return mb

    def card(self, title, icon=None, share=None):
        f = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        f.add_css_class('card'); f.add_css_class('kjt-card')
        inner = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8, margin_top=14, margin_bottom=14, margin_start=16, margin_end=16)
        f.append(inner)
        if title:
            row = Gtk.Box(spacing=10)
            ic = {'☦': 'kjt-cross-symbolic', '✝': 'kjt-heart-symbolic', '📖': 'kjt-bible-symbolic', '🕯': 'kjt-today-symbolic'}.get(icon)
            if ic:
                im = Gtk.Image(icon_name=ic, pixel_size=18, valign=Gtk.Align.START, margin_top=3); im.add_css_class('kjt-nav-icon'); row.append(im)
            l = Gtk.Label(label=title, xalign=0, wrap=True, hexpand=True); l.add_css_class('kjt-card-title'); row.append(l)
            if share:
                row.append(self.share_btn(share))
            inner.append(row)
        self.box.append(f)
        return inner

    def text(self, s, *classes, sel=True):
        l = Gtk.Label(label=s, xalign=0, wrap=True, wrap_mode=Pango.WrapMode.WORD_CHAR, selectable=sel)
        for c in classes:
            l.add_css_class(c)
        return l

    def show(self):
        self.clear()
        iso = self.day.isoformat()
        self.label.set_label(self.day.strftime('%a %-d %b %Y' if self.compact else '%A %-d %B %Y'))
        d = next((x for x in (self.data().get('days') or []) if x['date'] == iso), None)
        if not d:
            box = self.card('Today with God', '☦')
            box.append(self.text('This day is not on this computer yet. It comes with the internet: the app keeps the next two months each time it can reach the website.', 'dim-label'))
            self.refresh(force=True)
            return
        # the day in the Church
        day_name = self.day.strftime('%A %-d %B %Y')
        head = self.card(d.get('title') or d.get('feast') or self.day.strftime('%A'), '☦',
                         share=lambda: ('\n'.join(x for x in (d.get('title'), d.get('feast'), ('🍃 ' + d['fast']) if d.get('fast') else '', d.get('saints')) if x), 'Today with God · ' + day_name))
        if d.get('feast'):
            head.append(self.text(d['feast'], 'kjt-feast'))
        if d.get('fast'):
            head.append(self.text('🍃 ' + d['fast'], 'kjt-fast'))
        if d.get('saints'):
            head.append(self.text(d['saints'], 'dim-label'))
        # the verse of the day
        v = d.get('votd')
        if v:
            tr = self.bible_for(v['book'])
            box = self.card('Verse of the day', '✝', share=lambda: (vtext['t'], vtext['ref']))
            vtext = {}
            rows = STORE.passage(tr, v['book'], v['c'], v['v1'], v['c'], v['v2']) if tr else []
            txt = ' '.join(strip_tags(r[2]).strip() for r in rows) if rows else (strip_tags(v.get('text', '')) if lang() == 'en' else '')
            if txt.strip():
                box.append(self.text('“%s”' % txt.strip(), 'kjt-verse', sel=False))
            ref = '%s %d:%d%s' % (book_name(v['book'], tr=tr), v['c'], v['v1'], '–%d' % v['v2'] if v['v2'] > v['v1'] else '')
            vtext.update(t=txt.strip(), ref=ref + (' (%s)' % bible_name(tr).split(' · ')[0] if tr else ''))
            b = Gtk.Button(label=ref + '  →', halign=Gtk.Align.START); b.add_css_class('flat'); b.add_css_class('kjt-ref')
            b.connect('clicked', lambda *_: self.win.open_passage(v['book'], v['c'], v['v1'])); box.append(b)
        # the readings
        if d.get('readings'):
            box = self.card('The readings of the day', '📖')
            for r in d['readings']:
                for ref in r.get('refs') or []:
                    self.reading(box, r, ref)
        if d.get('news'):
            box = self.card('Coming soon', '🕯', share=lambda: ('\n'.join(('🍃 ' if k == 'fast' else '✦ ') + n + (' — until ' + e if e else '') for k, n, e in d['news']), 'Coming soon in the Church'))
            for kind, name, end in d['news']:
                box.append(self.text(('🍃 ' if kind == 'fast' else '✦ ') + name + (' — until ' + end if end else ''), sel=False))
        self.prev.set_sensitive(True); self.next.set_sensitive(True)

    def reading(self, box, r, ref):
        book, c1, v1, c2, v2 = ref
        tr = self.bible_for(book)
        title = '%s%s — %s %d:%d%s' % (r.get('src', ''), ' (%s)' % r['desc'] if r.get('desc') else '', book_name(book, tr=tr), c1, v1,
                                      ('–%d' % v2 if c2 == c1 else '–%d:%d' % (c2, v2)) if (c2, v2) != (c1, v1) else '')
        ex = Gtk.Expander(label=title, expanded=bool(r.get('main')) and SET.get('readings_open', True))
        ex.get_label_widget().add_css_class('heading') if ex.get_label_widget() else None
        inner = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_top=6, margin_start=6)
        rows = STORE.passage(tr, book, c1, v1, c2, v2) if tr else []
        if rows:
            parts = []
            for ch, v, t in rows:
                parts.append('<span foreground="#2b8a7e" size="smaller" rise="4000"><b>%s</b></span> %s' % (('%d:%d' % (ch, v)) if c2 != c1 else v, GLib.markup_escape_text(strip_tags(t).strip())))
            l = Gtk.Label(xalign=0, wrap=True, wrap_mode=Pango.WrapMode.WORD_CHAR, selectable=True); l.set_markup(' '.join(parts)); l.add_css_class('kjt-reading')
            inner.append(l)
        else:
            inner.append(self.text('This book is not in the Bibles on this computer. Choose Downloads in the sidebar.', 'dim-label'))
        b = Gtk.Button(label='Read in the Holy Bible  →', halign=Gtk.Align.START); b.add_css_class('flat'); b.add_css_class('kjt-ref')
        b.connect('clicked', lambda *_: self.win.open_passage(book, c1, v1))
        acts = Gtk.Box(spacing=6); acts.append(b)
        if rows:
            ref = '%s %d:%d%s' % (book_name(book, tr=tr), c1, v1, ('–%d' % v2 if c2 == c1 else '–%d:%d' % (c2, v2)) if (c2, v2) != (c1, v1) else '')
            words = ' '.join(strip_tags(t).strip() for _c, _v, t in rows)
            acts.append(self.share_btn(lambda: (words, ref + ' (%s)' % bible_name(tr).split(' · ')[0])))
        inner.append(acts)
        ex.set_child(inner); box.append(ex)
