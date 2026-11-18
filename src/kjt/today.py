"""Today with God: the verse of the day, the day in the Church (feast, fast, saints) and its readings, read from the Bibles kept here."""
import datetime, re
from gi.repository import Gtk, Adw, Gdk, GLib, Pango
from .core import STORE, SET, NET, DEFAULT_BIBLES, lang, book_name, run_bg, strip_tags, file_path
from .i18n import _, fmt_date
from .bible import bible_name


class TodayPage(Gtk.Box):
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win
        self.day = datetime.date.today()
        tv = Adw.ToolbarView(); tv.set_vexpand(True); self.append(tv)
        hb = Adw.HeaderBar(); tv.add_top_bar(hb)
        win.sidebar_button(hb)
        self.prev = Gtk.Button(icon_name='kjt-prev-symbolic', tooltip_text=_('The day before')); self.prev.connect('clicked', lambda *_: self.move(-1))
        self.next = Gtk.Button(icon_name='kjt-next-symbolic', tooltip_text=_('The day after')); self.next.connect('clicked', lambda *_: self.move(1))
        self.label = Gtk.Label(ellipsize=3); self.label.add_css_class('heading')
        t = Gtk.Box(spacing=6); t.append(self.prev); t.append(self.label); t.append(self.next)
        hb.set_title_widget(t)
        # 2.10: a plain 'Today' button (the sun looked like a light/dark switch); it shows only on another day
        self.home = home = Gtk.Button(label=_('Today'), tooltip_text=_('Back to today'), visible=False); home.add_css_class('flat'); home.connect('clicked', lambda *_: self.goto(datetime.date.today())); hb.pack_start(home)
        # 2.13: the Orthodox calendar (as in the Android app): any day of any month, the great feasts marked
        self.cal_btn = Gtk.MenuButton(icon_name='x-office-calendar-symbolic', tooltip_text=_('Orthodox calendar')); self.cal_btn.add_css_class('flat')
        from .monthcal import MonthCal   # 2.26: the months and days in the app's language
        pop = Gtk.Popover(); self.cal = MonthCal(lambda d: (pop.popdown(), self.goto(d)), lambda _y, _m: self.mark_month())
        pop.connect('show', lambda *_a: (self.cal.set_month(self.day.year, self.day.month) if getattr(self, 'day', None) else None, self.mark_month()))
        pop.set_child(self.cal); self.cal_btn.set_popover(pop); hb.pack_end(self.cal_btn)
        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=14, margin_top=18, margin_bottom=30, margin_start=16, margin_end=16)
        c = Adw.Clamp(maximum_size=760); c.set_child(self.box)
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(c); __import__("kjt.ui", fromlist=["steady"]).steady(sc); tv.set_content(sc)
        self.loading = False

    compact = False

    def set_compact(self, c):
        self.compact = c
        self.box.set_margin_start(8 if c else 16); self.box.set_margin_end(8 if c else 16)
        if self.label.get_label():
            self.label.set_label(fmt_date(self.day, short=c))

    def data(self):
        d = dict(STORE.kv('today_' + lang()) or STORE.kv('today_en') or {})
        extra = STORE.kv('today_more_' + lang()) or {}   # 2.13: days fetched for the calendar
        if extra:
            have = {x['date'] for x in d.get('days') or []}
            d['days'] = list(d.get('days') or []) + [x for x in extra.values() if x['date'] not in have]
        return d

    def mark_month(self):
        """the great feasts of the month shown in the calendar, marked"""
        y, m = self.cal.y, self.cal.m; self.cal.marks = set()
        prefix = '%04d-%02d-' % (y, m)
        days = [x for x in (self.data().get('days') or []) if x['date'].startswith(prefix)]
        for x in days:
            if x.get('icon') or int(x.get('level', 0) or 0) >= 7:
                self.cal.marks.add(int(x['date'][8:10]))
        self.cal.draw()
        if len(days) < 28 and NET.online() and getattr(self, 'cal_asked', '') != prefix:
            self.cal_asked = prefix
            self.fetch_from(datetime.date(y, m, 1), then=self.mark_month)

    def fetch_from(self, day, then=None):
        lg = lang()
        def work():
            r = NET.ajax('kjtb_desk', op='today', lang=lg, days=42, **{'from': day.isoformat()})
            if r.get('success'):
                more = dict(STORE.kv('today_more_' + lg) or {})
                for x in r['data'].get('days') or []:
                    more[x['date']] = x
                if len(more) > 800:   # keep it small: the newest months
                    more = dict(sorted(more.items())[-800:])
                STORE.set_kv('today_more_' + lg, more); return True
            return False
        run_bg(work, lambda ok: then() if ok is True and then else None)

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
        self.day = day; self.home.set_visible(day != datetime.date.today()); self.show(); self.refresh()

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
        mb = Gtk.MenuButton(icon_name='kjt-share-symbolic', tooltip_text=_('Share'), valign=Gtk.Align.START); mb.add_css_class('flat'); mb.add_css_class('circular')
        pop = Gtk.Popover(); bx = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, margin_top=6, margin_bottom=6, margin_start=6, margin_end=6)
        def pic():
            from . import picture
            text, ref = get(); picture.share(self.win, text, ref)
        def copy():
            text, ref = get()
            Gdk.Display.get_default().get_clipboard().set('%s\n— %s' % (text, ref)); self.win.toast(_('Copied: paste it in a message or a post'))
        for lab, fn in (('Share as a picture…', pic), ('Copy the text', copy)):
            b = Gtk.Button(label=_(lab)); b.add_css_class('flat'); b.get_child().set_xalign(0)
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
            l = Gtk.Label(label=_(title), xalign=0, wrap=True, hexpand=True); l.add_css_class('kjt-card-title'); row.append(l)
            if share:
                row.append(self.share_btn(share))
            inner.append(row)
        self.box.append(f)
        return inner

    def feast_icon(self, box, ic):
        import os
        path = file_path('feasts/%s.jpg' % re.sub(r'[^a-z_]', '', ic['key']))
        pic = Gtk.Picture(can_shrink=True, content_fit=Gtk.ContentFit.CONTAIN, height_request=300, margin_top=6)
        pic.set_alternative_text(ic.get('t') or '')
        cap = Gtk.Label(label=ic.get('by') or '', xalign=0.5, wrap=True, css_classes=['caption', 'dim-label'])
        cap.set_tooltip_text(ic.get('page') or '')
        def put(*_):
            try:
                pic.set_filename(path); box.append(pic); box.append(cap)
            except Exception:
                pass
        if os.path.exists(path) and os.path.getsize(path) > 1000:
            put(); return
        def fetch():
            data = NET.get(ic['src'], timeout=30, strict=True)
            if not data or len(data) < 1000:
                raise ValueError('no picture')
            with open(path, 'wb') as f:
                f.write(data)
            return True
        run_bg(fetch, lambda r: put() if r is True else None)

    def text(self, s, *classes, sel=True):
        l = Gtk.Label(label=s, xalign=0, wrap=True, wrap_mode=Pango.WrapMode.WORD_CHAR, selectable=sel)
        for c in classes:
            l.add_css_class(c)
        return l

    def show(self):
        self.clear()
        iso = self.day.isoformat()
        self.label.set_label(fmt_date(self.day, short=self.compact))
        d = next((x for x in (self.data().get('days') or []) if x['date'] == iso), None)
        if not d:
            box = self.card('Today with God', '☦')
            box.append(self.text('This day is not on this computer yet. It comes with the internet: the app keeps the next two months each time it can reach the website.', 'dim-label'))
            if NET.online() and getattr(self, 'asked_day', None) != iso:
                self.asked_day = iso
                want = self.day
                self.fetch_from(self.day, then=lambda: self.show() if self.day == want else None)
            else:
                self.refresh(force=True)
            return
        # the day in the Church
        day_name = fmt_date(self.day)
        head = self.card(d.get('title') or d.get('feast') or _(self.day.strftime('%A')), '☦',
                         share=lambda: ('\n'.join(x for x in (d.get('title'), d.get('feast'), ('🍃 ' + d['fast']) if d.get('fast') else '', d.get('saints')) if x), 'Today with God · ' + day_name))
        if d.get('feast'):
            head.append(self.text(d['feast'], 'kjt-feast'))
        if d.get('fast'):
            head.append(self.text('🍃 ' + d['fast'], 'kjt-fast'))
        if d.get('saints'):
            head.append(self.text(d['saints'], 'dim-label'))
        # 2.10: the icon of a great feast (an old icon, public domain, from Wikimedia Commons), kept on this computer
        ic = d.get('icon') or {}
        if ic.get('src') and ic.get('key'):
            self.feast_icon(head, ic)
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
            # 2.10: a feast comes as [kind, name], a fast as [kind, name, last day]
            news = [(list(x) + ['', '', ''])[:3] for x in d['news']]
            box = self.card('Coming soon', '🕯', share=lambda: ('\n'.join(('🍃 ' if k == 'fast' else '✦ ') + n + (' — until ' + e if e else '') for k, n, e in news), 'Coming soon in the Church'))
            for kind, name, end in news:
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
        b = Gtk.Button(label=_('Read in the Holy Bible  →'), halign=Gtk.Align.START); b.add_css_class('flat'); b.add_css_class('kjt-ref')
        b.connect('clicked', lambda *_: self.win.open_passage(book, c1, v1))
        acts = Gtk.Box(spacing=6); acts.append(b)
        if rows:
            ref = '%s %d:%d%s' % (book_name(book, tr=tr), c1, v1, ('–%d' % v2 if c2 == c1 else '–%d:%d' % (c2, v2)) if (c2, v2) != (c1, v1) else '')
            words = ' '.join(strip_tags(t).strip() for _c, _v, t in rows)
            acts.append(self.share_btn(lambda: (words, ref + ' (%s)' % bible_name(tr).split(' · ')[0])))
        inner.append(acts)
        ex.set_child(inner); box.append(ex)
