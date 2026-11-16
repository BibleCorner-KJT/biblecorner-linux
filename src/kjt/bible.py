"""The Holy Bible: reading, comparing, searching, listening, the Holy Fathers beside each chapter, and your study."""
import bisect, re, unicodedata
from gi.repository import Gtk, Adw, Gdk, GLib, Pango
from .core import STORE, SET, OT, NT, DEFAULT_BIBLES, canon, book_name, lang, read_file
from .study import STUDY, COLORS
from .richtext import html_into, make_view, setup_tags


CATS = [('law', 'Law (Pentateuch)', 'GEN EXO LEV NUM DEU'), ('hist', 'History', 'JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST'),
        ('wis', 'Wisdom and Poetry', 'JOB PSA PRO ECC SNG'), ('major', 'Major Prophets', 'ISA JER LAM EZK DAN'),
        ('minor', 'Minor Prophets', 'HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL'), ('dc', 'Deuterocanonical books', ''),
        ('gosp', 'Gospels', 'MAT MRK LUK JHN'), ('acts', 'Church History', 'ACT'),
        ('paul', 'Epistles of St Paul', 'ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB'),
        ('gen', 'General Epistles', 'JAS 1PE 2PE 1JN 2JN 3JN JUD'), ('rev', 'Prophecy (Revelation)', 'REV')]
CAT = {b: c for c, _, bs in CATS for b in bs.split()}
CAT_COLORS = {'law': ('#dc2626', '#fdeeee', '#991b1b'), 'hist': ('#9ca3af', '#ffffff', '#374151'), 'wis': ('#f97316', '#fff2e8', '#9a3412'),
              'major': ('#2563eb', '#edf3ff', '#1e40af'), 'minor': ('#ec4899', '#fdeef6', '#9d174d'), 'dc': ('#0d9488', '#e8f7f5', '#115e59'),
              'gosp': ('#16a34a', '#eaf7ee', '#166534'), 'acts': ('#9333ea', '#f5edfd', '#6b21a8'), 'paul': ('#facc15', '#fffbe2', '#854d0e'),
              'gen': ('#92400e', '#f6eee6', '#78350f'), 'rev': ('#c9a227', '#fff6d8', '#7a5a00')}


def cat_of(code):
    return CAT.get(canon(code), 'dc')


def bible_name(tr):
    v = (STORE.kv('info') or {}).get('versions', {}).get(tr)
    return v[1] if v else tr


def bible_dir(tr):
    v = (STORE.kv('info') or {}).get('versions', {}).get(tr)
    return (v[2] if v and len(v) > 2 else 'ltr') == 'rtl' or tr.startswith(('arb', 'urd', 'pes', 'heb'))


def fold(s):
    return ''.join(c for c in unicodedata.normalize('NFD', s or '') if unicodedata.category(c) != 'Mn').casefold()


def ib(icon, tip, fn=None, toggle=False):
    b = (Gtk.ToggleButton if toggle else Gtk.Button)(icon_name=icon, tooltip_text=tip)
    b.add_css_class('flat')
    if fn:
        b.connect('toggled' if toggle else 'clicked', lambda *_: fn())
    return b


class BiblePage(Gtk.Box):
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win
        self.tr = SET.get('tr') or DEFAULT_BIBLES.get(lang(), 'eng-kjv')
        if self.tr not in STORE.bibles() and STORE.bibles():
            self.tr = STORE.bibles()[0]
        self.tr2 = SET.get('tr2') or ''
        self.book = SET.get('book') or 'JHN'
        self.ch = SET.get('ch', 1)
        self.sel = []
        self.size = SET.get('size', 1.0)
        self.vpos, self.vnum, self.vend = [], [], []
        self.syncing_toggles = False

        tv = Adw.ToolbarView(); self.append(tv); tv.set_vexpand(True)
        hb = Adw.HeaderBar(); tv.add_top_bar(hb); self.hb = hb
        win.sidebar_button(hb)
        self.trbtn = Gtk.MenuButton(tooltip_text='Choose the Bible'); self.trbtn.set_popover(self.make_tr_menu(False)); hb.pack_start(self.trbtn)
        self.prev = ib('kjt-prev-symbolic', 'Previous chapter (←)', lambda: self.step(-1))
        self.next = ib('kjt-next-symbolic', 'Next chapter (→)', lambda: self.step(1))
        self.where = Gtk.MenuButton(always_show_arrow=True, tooltip_text='Choose a book and chapter'); self.where.add_css_class('flat')
        self.where.set_popover(self.make_picker())
        tb = Gtk.Box(spacing=2); tb.append(self.prev); tb.append(self.where); tb.append(self.next)
        hb.set_title_widget(tb)

        # tools (in the top bar on a big window; at the bottom on a small one)
        self.tools = Gtk.Box(spacing=2)
        self.search_btn = ib('kjt-search-symbolic', 'Search the Bible (Ctrl+F)', toggle=True)
        self.hf_btn = ib('kjt-cross-symbolic', 'The Holy Fathers on this chapter', toggle=True)
        self.cmp_btn = Gtk.MenuButton(icon_name='kjt-compare-symbolic', tooltip_text='Compare with another Bible'); self.cmp_btn.add_css_class('flat'); self.cmp_btn.set_popover(self.make_tr_menu(True))
        for w in (self.search_btn, self.hf_btn, self.cmp_btn, ib('kjt-listen-symbolic', 'Listen', self.listen), ib('kjt-map-symbolic', 'Map of this chapter', self.map),
                  self.size_button()):
            self.tools.append(w)
        hb.pack_end(self.tools)

        self.sbar = Gtk.SearchBar(); self.sentry = Gtk.SearchEntry(placeholder_text='Search words in this Bible', hexpand=True)
        self.sbar.set_child(self.sentry); self.sbar.connect_entry(self.sentry); tv.add_top_bar(self.sbar)
        self.sentry.connect('activate', self.do_search)
        self.search_btn.connect('toggled', lambda b: self.toggle_search(b.get_active()))
        self.hf_btn.connect('toggled', lambda b: self.toggle_fathers(b.get_active()))

        # the chapter, and beside it (or over it, on a small screen) the Holy Fathers or what was found
        self.osv = Adw.OverlaySplitView(sidebar_position=Gtk.PackType.END, show_sidebar=False, min_sidebar_width=300, max_sidebar_width=440, sidebar_width_fraction=0.36)
        self.view = Gtk.TextView(editable=False, cursor_visible=False, wrap_mode=Gtk.WrapMode.WORD_CHAR, left_margin=28, right_margin=28,
                                 top_margin=18, bottom_margin=40, pixels_below_lines=6, pixels_inside_wrap=5)
        self.view.add_css_class('kjt-bible')
        click = Gtk.GestureClick(); click.connect('released', self.on_click); self.view.add_controller(click)
        rclick = Gtk.GestureClick(button=3); rclick.connect('pressed', self.on_menu); self.view.add_controller(rclick)
        lp = Gtk.GestureLongPress(); lp.connect('pressed', lambda g, x, y: self.on_menu(g, 1, x, y)); self.view.add_controller(lp)
        self.scroll = Gtk.ScrolledWindow(hexpand=True, vexpand=True)
        self.scroll.get_vadjustment().connect('value-changed', self.remember_place)
        c = Adw.Clamp(maximum_size=860, tightening_threshold=600); c.set_child(self.view); self.scroll.set_child(c)
        self.osv.set_content(self.scroll)
        side = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        sh = Gtk.Box(spacing=6, margin_start=12, margin_end=6, margin_top=6, margin_bottom=2)
        self.side_title = Gtk.Label(xalign=0, hexpand=True, ellipsize=Pango.EllipsizeMode.END); self.side_title.add_css_class('heading')
        sh.append(self.side_title); sh.append(ib('kjt-close-symbolic', 'Close', self.close_side)); side.append(sh)
        self.side = Gtk.Stack(vexpand=True, transition_type=Gtk.StackTransitionType.CROSSFADE)
        self.hf_view = make_view(self.on_link); hs = Gtk.ScrolledWindow(); hs.set_child(self.hf_view); self.side.add_named(hs, 'hf')
        self.results = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE); self.results.add_css_class('navigation-sidebar')
        rs = Gtk.ScrolledWindow(); rs.set_child(self.results); self.side.add_named(rs, 'search')
        self.xref_view = make_view(self.on_link); xs = Gtk.ScrolledWindow(); xs.set_child(self.xref_view); self.side.add_named(xs, 'xref')
        self.words_view = make_view(self.on_link); ws = Gtk.ScrolledWindow(); ws.set_child(self.words_view); self.side.add_named(ws, 'words')
        side.append(self.side)
        self.osv.set_sidebar(side)
        self.osv.connect('notify::show-sidebar', self.side_closed)
        tv.set_content(self.osv)

        # the verses chosen: what to do with them
        self.bar = Gtk.Revealer(transition_type=Gtk.RevealerTransitionType.SLIDE_UP)
        barbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4, margin_start=10, margin_end=10, margin_top=6, margin_bottom=6)
        barbox.add_css_class('kjt-selbar'); self.bar.set_child(barbox)
        top = Gtk.Box(spacing=8); barbox.append(top)
        lbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, valign=Gtk.Align.CENTER)
        self.sel_label = Gtk.Label(xalign=0, ellipsize=Pango.EllipsizeMode.END); self.sel_label.add_css_class('kjt-sel-label'); lbox.append(self.sel_label)
        self.sel_state = Gtk.Label(xalign=0, ellipsize=Pango.EllipsizeMode.END, max_width_chars=40); self.sel_state.add_css_class('kjt-sel-state'); self.sel_state.add_css_class('caption'); lbox.append(self.sel_state)
        lbox.set_hexpand(True); top.append(lbox)
        self.colors = Gtk.Box(spacing=5, valign=Gtk.Align.CENTER)
        self.dots = {}
        for c, hexv in COLORS.items():
            b = Gtk.Button(tooltip_text='Highlight: ' + c, valign=Gtk.Align.CENTER); b.add_css_class('kjt-dot'); b.add_css_class('kjt-dot-' + c)
            b.connect('clicked', lambda _b, c=c: self.bookmark(c)); self.colors.append(b); self.dots[c] = b
        self.nocolor = Gtk.Button(tooltip_text='No colour (keep the bookmark)', valign=Gtk.Align.CENTER); self.nocolor.add_css_class('kjt-dot'); self.nocolor.add_css_class('kjt-dot-none')
        self.nocolor.connect('clicked', lambda *_: self.uncolor()); self.colors.append(self.nocolor)
        acts = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=10, min_children_per_line=2, column_spacing=2, row_spacing=2, homogeneous=False)
        def labelled(icon, text, fn):
            b = Gtk.Button(tooltip_text=text); b.add_css_class('flat')
            row = Gtk.Box(spacing=5); row.append(Gtk.Image(icon_name=icon)); lb = Gtk.Label(label=text); lb.add_css_class('kjt-act-label'); row.append(lb); b.set_child(row)
            b.connect('clicked', lambda *_: fn()); self.act_labels.append(lb)
            b.label = lb
            return b
        self.act_labels = []
        for icon, tip, fn in (('kjt-route-symbolic', 'Cross-references', lambda: self.side_show('xref')), ('kjt-globe-symbolic', 'Greek and Hebrew words', lambda: self.side_show('words')),
                              ('kjt-copy-symbolic', 'Copy (Ctrl+C)', self.copy), ('kjt-study-symbolic', 'Bookmark', self.bookmark), ('kjt-note-symbolic', 'Note', self.note),
                              ('kjt-tag-symbolic', 'Study Pads', self.pads), ('kjt-close-symbolic', 'Clear the choice (Esc)', self.unselect)):
            btn = labelled(icon, tip.split(' (')[0], fn); acts.append(btn)
            if tip == 'Bookmark':
                self.bm_btn = btn
            elif tip == 'Note':
                self.note_btn = btn
        self.del_btn = labelled('kjt-trash-symbolic', 'Remove bookmark', lambda: self.remove()); acts.insert(self.del_btn, 2)
        top.append(self.colors); barbox.append(acts)
        tv.add_bottom_bar(self.bar)

        # small screens: the tools at the bottom
        self.cbar = Gtk.ActionBar(); self.cbar.set_revealed(False)
        cb = Gtk.Box(spacing=0, homogeneous=True, hexpand=True)
        self.c_search = ib('kjt-search-symbolic', 'Search', toggle=True); self.c_hf = ib('kjt-cross-symbolic', 'The Holy Fathers', toggle=True)
        self.c_search.bind_property('active', self.search_btn, 'active', 1 | 2); self.c_hf.bind_property('active', self.hf_btn, 'active', 1 | 2)
        more = Gtk.MenuButton(icon_name='kjt-more-symbolic', tooltip_text='More'); more.add_css_class('flat')
        mp = Gtk.Popover(); mb = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, margin_top=6, margin_bottom=6, margin_start=6, margin_end=6)
        for lab, fn in (('Compare with another Bible…', lambda: (mp.popdown(), GLib.idle_add(lambda: (self.cmp_btn.popup(), False)[1]))),
                        ('Map of this chapter', lambda: (mp.popdown(), self.map())), ('Larger text', lambda: self.zoom(1.1)), ('Smaller text', lambda: self.zoom(1 / 1.1))):
            b = Gtk.Button(label=lab); b.add_css_class('flat'); b.get_child().set_xalign(0); b.connect('clicked', lambda _b, fn=fn: fn()); mb.append(b)
        mp.set_child(mb); more.set_popover(mp)
        for w in (ib('kjt-prev-symbolic', 'Previous chapter', lambda: self.step(-1)), self.c_search, self.c_hf, ib('kjt-listen-symbolic', 'Listen', self.listen), more,
                  ib('kjt-next-symbolic', 'Next chapter', lambda: self.step(1))):
            cb.append(w)
        self.cbar.set_center_widget(cb)
        tv.add_bottom_bar(self.cbar)

        k = Gtk.EventControllerKey(); k.connect('key-pressed', self.on_key); self.add_controller(k)
        STUDY.listen(lambda: self.show(keep=True) if self.get_mapped() else None)

    def size_button(self):
        menu = Gtk.MenuButton(icon_name='kjt-textsize-symbolic', tooltip_text='Text size (Ctrl + and Ctrl −)'); menu.add_css_class('flat')
        pop = Gtk.Popover(); pb = Gtk.Box(spacing=6, margin_top=6, margin_bottom=6, margin_start=6, margin_end=6)
        for icon, f, tip in (('kjt-minus-symbolic', 1 / 1.1, 'Smaller'), ('kjt-textsize-symbolic', 0, 'Usual size'), ('kjt-plus-symbolic', 1.1, 'Larger')):
            b = Gtk.Button(icon_name=icon, tooltip_text=tip); b.connect('clicked', lambda _b, f=f: self.zoom(f)); pb.append(b)
        pop.set_child(pb); menu.set_popover(pop)
        return menu

    def set_compact(self, c):
        self.compact = c
        self.tools.set_visible(not c)
        self.prev.set_visible(not c); self.next.set_visible(not c)
        self.cbar.set_revealed(c)
        self.osv.set_collapsed(c)
        for lb in getattr(self, 'act_labels', []):
            lb.set_visible(not c)
        m = 12 if c else 28
        self.view.set_left_margin(m); self.view.set_right_margin(m)
        self.trbtn.set_visible(True)

    # ---------- choosing ----------
    def make_tr_menu(self, compare):
        pop = Gtk.Popover()
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, margin_top=6, margin_bottom=6, margin_start=6, margin_end=6, spacing=2)
        sc = Gtk.ScrolledWindow(propagate_natural_height=True, max_content_height=440, propagate_natural_width=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(box)
        pop.set_child(sc)
        def fill(*_):
            while box.get_first_child():
                box.remove(box.get_first_child())
            if compare:
                b = Gtk.Button(label='No comparison'); b.add_css_class('flat'); b.connect('clicked', lambda *_: (pop.popdown(), self.set_tr2(''))); box.append(b)
            for t in STORE.bibles():
                b = Gtk.Button(); b.add_css_class('flat')
                lb = Gtk.Label(label=bible_name(t), xalign=0, max_width_chars=34, ellipsize=Pango.EllipsizeMode.END); b.set_child(lb)
                if t == (self.tr2 if compare else self.tr):
                    lb.add_css_class('heading')
                b.connect('clicked', lambda _b, t=t: (pop.popdown(), self.set_tr2(t) if compare else self.set_tr(t)))
                box.append(b)
        pop.connect('show', fill)
        return pop

    def make_picker(self):
        pop = Gtk.Popover()
        self.pstack = Gtk.Stack(transition_type=Gtk.StackTransitionType.SLIDE_LEFT_RIGHT, transition_duration=150)
        pop.set_child(self.pstack)
        def show(*_):
            w, h = self.win.get_width(), self.win.get_height()
            pop.set_size_request(min(580, max(300, w - 24)), min(480, max(260, h - 110)))
            self.fill_picker()
        pop.connect('show', show)
        return pop

    def fill_picker(self):
        for c in list(self.pstack):
            self.pstack.remove(c)
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8, margin_top=8, margin_bottom=8, margin_start=8, margin_end=8)
        q = Gtk.SearchEntry(placeholder_text='Type a book…'); box.append(q)
        books = STORE.books(self.tr)
        legend = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=6, min_children_per_line=1, column_spacing=10, row_spacing=2)
        present = {cat_of(c) for c, _ in books}
        for key, label, _bs in CATS:
            if key not in present:
                continue
            lb = Gtk.Label(xalign=0); lb.set_markup('<span foreground="%s">■</span> <small>%s</small>' % (CAT_COLORS[key][0], GLib.markup_escape_text(label))); legend.append(lb)
        box.append(legend)
        buttons = []
        for title, part in (('Old Testament', lambda c: canon(c) not in NT), ('New Testament', lambda c: canon(c) in NT)):
            fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=6, min_children_per_line=3, homogeneous=True, row_spacing=4, column_spacing=4)
            n = 0
            for code, nm in books:
                if not part(code):
                    continue
                n += 1
                name = book_name(code, tr=self.tr) if lang() != 'en' or not nm else nm
                b = Gtk.Button(label=name, tooltip_text=name); b.get_child().set_ellipsize(Pango.EllipsizeMode.END)
                b.add_css_class('kjt-bk'); b.add_css_class('kjt-bk-' + cat_of(code))
                if code == self.book:
                    b.add_css_class('kjt-bk-here')
                b.connect('clicked', lambda _b, code=code: self.pick_chapter(code))
                fb.append(b); buttons.append((fold(name + ' ' + (nm or '') + ' ' + code), b, code))
            if n:
                box.append(Gtk.Label(label=title, xalign=0, css_classes=['heading'])); box.append(fb)
        if not books:
            box.append(Gtk.Label(label='This Bible is not on this computer yet. Open Downloads to keep it.', wrap=True))
        def filt(*_):
            t = fold(q.get_text().strip())
            for s, b, _c in buttons:
                b.get_parent().set_visible(not t or t in s)
        q.connect('search-changed', filt)
        q.connect('activate', lambda *_: next((self.pick_chapter(c) for s, b, c in buttons if b.get_parent().get_visible()), None))
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(box)
        self.pstack.add_named(sc, 'books'); self.pstack.set_visible_child_name('books')
        GLib.idle_add(lambda: (q.grab_focus(), False)[1])

    def pick_chapter(self, code):
        chs = STORE.chapters(self.tr, code)
        if len(chs) == 1:
            self.pick_verse(code, chs[0], back='books'); return
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8, margin_top=8, margin_bottom=8, margin_start=8, margin_end=8)
        hb = Gtk.Box(spacing=8)
        hb.append(ib('kjt-prev-symbolic', 'The books', lambda: self.pstack.set_visible_child_name('books')))
        hb.append(Gtk.Label(label=book_name(code, tr=self.tr), css_classes=['title-4'])); box.append(hb)
        fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=10, min_children_per_line=5, homogeneous=True, row_spacing=4, column_spacing=4)
        for c in chs:
            b = Gtk.Button(label=str(c))
            if code == self.book and c == self.ch:
                b.add_css_class('suggested-action')
            b.connect('clicked', lambda _b, c=c: self.pick_verse(code, c)); fb.append(b)
        box.append(fb)
        self.picker_page(box, 'chapters')

    def picker_page(self, box, name):
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(box)
        old = self.pstack.get_child_by_name(name)
        if old:
            self.pstack.remove(old)
        self.pstack.add_named(sc, name); self.pstack.set_visible_child_name(name)

    def pick_verse(self, code, ch, back='chapters'):
        """the third step, as on the website: the verse (or the whole chapter)"""
        rows = STORE.chapter(self.tr, code, ch)
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8, margin_top=8, margin_bottom=8, margin_start=8, margin_end=8)
        hb = Gtk.Box(spacing=8)
        hb.append(ib('kjt-prev-symbolic', 'The chapters', lambda: self.pstack.set_visible_child_name(back)))
        hb.append(Gtk.Label(label='%s %d' % (book_name(code, tr=self.tr), ch), css_classes=['title-4'], hexpand=True, xalign=0))
        whole = Gtk.Button(label='The whole chapter'); whole.add_css_class('suggested-action')
        whole.connect('clicked', lambda *_: (self.where.popdown(), self.go(code, ch))); hb.append(whole)
        box.append(hb)
        box.append(Gtk.Label(label='Or go to a verse:', xalign=0, css_classes=['dim-label']))
        fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=10, min_children_per_line=5, homogeneous=True, row_spacing=4, column_spacing=4)
        for v, _t in rows:
            b = Gtk.Button(label=str(v)); b.connect('clicked', lambda _b, v=v: (self.where.popdown(), self.go(code, ch, v))); fb.append(b)
        box.append(fb)
        self.picker_page(box, 'verses')

    def set_tr(self, t):
        b = STORE.find_book(t, self.book) or (STORE.books(t)[0][0] if STORE.books(t) else self.book)
        self.tr = t; SET.set('tr', t); self.go(b, self.ch)

    def set_tr2(self, t):
        self.tr2 = t; SET.set('tr2', t); self.show(keep=True)

    def go(self, book, ch, verse=0):
        self.book, self.ch = book, int(ch)
        SET.set('book', book); SET.set('ch', self.ch)
        self.sel = [verse] if verse else []
        self.show(scroll_to=verse)
        if STUDY.user():
            STUDY.send({'op': 'position', 'translation': self.tr, 'book': book, 'chapter': self.ch, 'verse': verse or 1})

    def code_name(self, code, tr):
        return book_name(code, tr=tr)

    def open_ref(self, book, ch, v=0):
        self.go(STORE.find_book(self.tr, book) or book, ch, v)

    def step(self, d):
        chs = STORE.chapters(self.tr, self.book)
        if self.ch + d in chs:
            self.go(self.book, self.ch + d); return
        books = [b for b, _ in STORE.books(self.tr)]
        if self.book in books:
            i = books.index(self.book) + d
            if 0 <= i < len(books):
                c = STORE.chapters(self.tr, books[i])
                if c:
                    self.go(books[i], c[0] if d > 0 else c[-1])

    def zoom(self, f):
        self.size = 1.0 if f == 0 else max(0.7, min(2.4, self.size * f)); SET.set('size', self.size); self.show(keep=True)

    def listen(self):
        self.win.audio.play_chapter(self.tr, self.book, self.ch)

    def map(self):
        self.win.map_chapter(self.book, self.ch)

    # ---------- the chapter ----------
    def show(self, keep=False, scroll_to=0):
        buf = self.view.get_buffer()
        adj = self.scroll.get_vadjustment(); y = adj.get_value()
        buf.set_text('')
        setup_tags(buf, self.size)
        t = buf.get_tag_table()
        def tag(name, **p):
            o = t.lookup(name)
            if o:
                t.remove(o)
            return buf.create_tag(name, **p)
        fs = 1.15 * self.size
        dark = Adw.StyleManager.get_default().get_dark()
        tag('title', family='Serif', weight=Pango.Weight.BOLD, scale=1.7 * self.size, pixels_below_lines=16, foreground='#e9c8f0' if dark else '#3e093f')
        tag('vn', rise=5 * Pango.SCALE, scale=0.62 * fs, foreground='#5fc4b5' if dark else '#2b8a7e', weight=Pango.Weight.BOLD)
        tag('vt', family='Serif', scale=fs)
        tag('cmp', family='Serif', scale=0.95 * fs, foreground='#b9a9c2' if dark else '#6d5f74', style=Pango.Style.ITALIC)
        tag('note', scale=0.8 * fs, foreground='#e0b040' if dark else '#9c6b00')
        for c, hx in COLORS.items():
            tag('hl-' + c, background=hx, background_full_height=False, **({'foreground': '#1d1a1f'} if dark else {}))
        tag('sel', background='#6b4d78' if dark else '#e9d8f3')
        tag('red', foreground='#ff8a80' if dark else '#b3261e')
        tag('notetext', scale=0.82 * fs, style=Pango.Style.ITALIC, foreground='#e0b040' if dark else '#8a5a00', left_margin=36, pixels_above_lines=2, pixels_below_lines=6)
        tag('names', scale=0.85 * fs, foreground='#b9a9c2' if dark else '#6d5f74', pixels_above_lines=18)
        red = self.red_letters()
        rtl = bible_dir(self.tr)
        self.view.set_direction(Gtk.TextDirection.RTL if rtl else Gtk.TextDirection.LTR)
        rows = STORE.chapter(self.tr, self.book, self.ch)
        name = book_name(self.book, tr=self.tr)
        self.where.set_label('%s %d' % (name, self.ch))
        self.trbtn.set_label(bible_name(self.tr).split(' · ')[0])
        end = buf.get_end_iter
        buf.insert_with_tags_by_name(end(), '%s %d\n' % (name, self.ch), 'title')
        if not rows:
            buf.insert_with_tags_by_name(end(), 'This chapter is not on this computer. Open Downloads to keep this Bible.\n', 'vt')
        other = {}
        if self.tr2 and self.tr2 != self.tr:
            b2 = STORE.find_book(self.tr2, self.book)
            if b2:
                other = dict(STORE.chapter(self.tr2, b2, self.ch))
        marks = STUDY.in_chapter(self.tr, self.book, self.ch)
        self.vpos, self.vnum, self.vend = [], [], []
        for v, text in rows:
            start = buf.get_char_count()
            buf.insert_with_tags_by_name(end(), ' %d ' % v, 'vn')
            s2 = buf.get_char_count()
            plain = re.sub(r'<[^>]+>', '', text).strip()
            buf.insert_with_tags_by_name(end(), plain, 'vt')
            rr = red.get(str(v))
            if rr and rr[0].strip() == plain:
                for a, z in rr[1]:
                    buf.apply_tag_by_name('red', buf.get_iter_at_offset(s2 + a), buf.get_iter_at_offset(min(s2 + z, s2 + len(plain))))
            r = marks.get(v)
            if r:
                col = r.get('color') or 'yellow'
                buf.apply_tag_by_name('hl-' + (col if col in COLORS else 'yellow'), buf.get_iter_at_offset(s2), end())
                if r.get('note') and int(r.get('verse', 0)) == v:
                    buf.insert_with_tags_by_name(end(), ' ✎', 'note')
                    buf.insert_with_tags_by_name(end(), '\n' + r['note'].strip() + '\n', 'notetext')
            if v in other:
                buf.insert_with_tags_by_name(end(), '\n' + re.sub(r'<[^>]+>', '', other[v]).strip(), 'cmp')
            self.vpos.append(start); self.vnum.append(v); self.vend.append(buf.get_char_count())
            buf.insert(end(), '\n' if other else ' ')
        self.mark_selection()
        self.chapter_names(buf)
        if self.osv.get_show_sidebar():
            self.refresh_side()
        if keep:
            GLib.idle_add(lambda: (adj.set_value(y), False)[1])
        elif scroll_to and scroll_to in self.vnum:
            self.scroll_to_verse(scroll_to)
        else:
            GLib.idle_add(lambda: (adj.set_value(0), False)[1])

    def scroll_to_verse(self, v, tries=12):
        if v not in self.vnum:
            return
        def go():
            it = self.view.get_buffer().get_iter_at_offset(self.vpos[self.vnum.index(v)])
            r = self.view.get_iter_location(it)
            adj = self.scroll.get_vadjustment()
            if adj.get_upper() - adj.get_page_size() < r.y - 60 and go.n > 0:
                go.n -= 1; return True          # not laid out yet: try again in a moment
            adj.set_value(max(0, min(r.y - 70, adj.get_upper() - adj.get_page_size())))
            return False
        go.n = tries
        GLib.timeout_add(40, go)

    def top_verse(self):
        """the verse at the top of the screen (kept, to continue reading there)"""
        if not self.vpos:
            return 0
        y = int(self.scroll.get_vadjustment().get_value()) + 80
        ok, it = self.view.get_iter_at_location(10, y)
        if not ok:
            return 0
        i = bisect.bisect_right(self.vpos, it.get_offset()) - 1
        return self.vnum[i] if i >= 0 else 0

    def remember_place(self, *_):
        if getattr(self, 'place_timer', 0):
            GLib.source_remove(self.place_timer)
        def keep():
            self.place_timer = 0
            v = self.top_verse()
            if v:
                SET.set('place', {'tr': self.tr, 'book': self.book, 'ch': self.ch, 'v': v})
            return False
        self.place_timer = GLib.timeout_add(700, keep)

    def mark_selection(self):
        """only the 'chosen' colour changes: the chapter is not drawn again"""
        buf = self.view.get_buffer()
        buf.remove_tag_by_name('sel', buf.get_start_iter(), buf.get_end_iter())
        for i, v in enumerate(self.vnum):
            if v in self.sel:
                buf.apply_tag_by_name('sel', buf.get_iter_at_offset(self.vpos[i] + 1), buf.get_iter_at_offset(self.vend[i]))
        self.update_bar()

    def verse_at(self, x, y):
        bx, by = self.view.window_to_buffer_coords(Gtk.TextWindowType.WIDGET, int(x), int(y))
        ok, it = self.view.get_iter_at_location(bx, by)
        if not ok or not self.vpos:
            return 0
        i = bisect.bisect_right(self.vpos, it.get_offset()) - 1
        return self.vnum[i] if i >= 0 else 0

    def on_click(self, g, n, x, y):
        if self.view.get_buffer().get_has_selection():
            return
        bx, by = self.view.window_to_buffer_coords(Gtk.TextWindowType.WIDGET, int(x), int(y))
        ok, it = self.view.get_iter_at_location(bx, by)
        if ok:
            for t in it.get_tags():
                nm = t.get_property('name') or ''
                if nm.startswith('link:'):
                    self.win.open_link(nm[5:]); return
                if nm in ('note', 'notetext'):
                    v = self.verse_at(x, y)
                    if v:
                        self.sel = [v]; self.mark_selection(); self.note(); return
        v = self.verse_at(x, y)
        if not v:
            return
        st = g.get_current_event_state()
        if st & Gdk.ModifierType.SHIFT_MASK and self.sel:
            a, b = min(self.sel[0], v), max(self.sel[0], v)
            self.sel = list(range(a, b + 1))
        elif v in self.sel:
            self.sel.remove(v)
        else:
            self.sel = sorted(set(self.sel + [v])) if st & Gdk.ModifierType.CONTROL_MASK else [v]
        self.mark_selection()
        if self.osv.get_show_sidebar():
            self.refresh_side()

    def current(self):
        """the bookmark the chosen verse already has (or None)"""
        return STUDY.in_chapter(self.tr, self.book, self.ch).get(min(self.sel)) if self.sel else None

    def update_bar(self):
        if not self.sel:
            self.bar.set_reveal_child(False); return
        a, b = min(self.sel), max(self.sel)
        self.sel_label.set_label('%s %d:%d%s' % (book_name(self.book, tr=self.tr), self.ch, a, '–%d' % b if b > a else ''))
        r = self.current()
        col = (r or {}).get('color')
        for c, btn in self.dots.items():
            (btn.add_css_class if c == col else btn.remove_css_class)('kjt-dot-on')
        self.nocolor.set_visible(bool(r and col))
        if r:
            bits = ['Bookmarked'] + (['highlighted ' + col] if col else []) + (['note: ' + r['note'].strip()[:60]] if r.get('note') else []) + (['#' + t for t in (r.get('tags') or [])])
            self.sel_state.set_label(' · '.join(bits))
        else:
            self.sel_state.set_label('Not bookmarked yet')
        self.bm_btn.get_parent().set_visible(not r); self.del_btn.get_parent().set_visible(bool(r))
        self.note_btn.label.set_label('Edit note' if r and r.get('note') else 'Note')
        self.bar.set_reveal_child(True)

    def unselect(self):
        self.sel = []; self.mark_selection()

    def selected_text(self):
        rows = dict(STORE.chapter(self.tr, self.book, self.ch))
        a, b = min(self.sel), max(self.sel)
        txt = ' '.join(re.sub(r'<[^>]+>', '', rows.get(v, '')).strip() for v in range(a, b + 1) if v in rows)
        return '“%s”\n— %s (%s)' % (txt, self.sel_label.get_label(), bible_name(self.tr).split(' · ')[0])

    def copy(self):
        Gdk.Display.get_default().get_clipboard().set(self.selected_text()); self.win.toast('Copied')

    def bookmark(self, color=None):
        a, b = min(self.sel), max(self.sel)
        old = self.current()
        r = STUDY.save(self.tr, self.book, self.ch, a, b if b > a else 0, color=color)
        if old is None:
            self.win.toast(('Highlighted: ' if color else 'Bookmarked: ') + self.sel_label.get_label(), undo=lambda: STUDY.delete(r))
        elif color and color != old.get('color'):
            prev = old.get('color')
            self.win.toast('Colour changed', undo=lambda: STUDY.set_color(r, prev))
        GLib.idle_add(lambda: (self.update_bar(), False)[1])
        return r

    def uncolor(self):
        r = self.current()
        if r and r.get('color'):
            prev = r['color']; STUDY.set_color(r, None)
            self.win.toast('Colour removed (the bookmark stays)', undo=lambda: STUDY.set_color(r, prev))

    def remove(self):
        """remove the bookmark (and its colour, note and Study Pads), with Undo"""
        r = self.current()
        if not r:
            return
        keep = dict(r)
        STUDY.delete(r)
        def undo():
            n = STUDY.save(keep['translation'], keep['book'], int(keep['chapter']), int(keep.get('verse') or 1), int(keep.get('verse_end') or 0), color=keep.get('color'))
            if keep.get('note'):
                STUDY.set_note(n, keep['note'])
            if keep.get('tags'):
                STUDY.set_tags(dict(n, note=keep.get('note', '')), keep['tags'])
        self.win.toast('Bookmark removed: ' + self.sel_label.get_label(), undo=undo)

    def record(self):
        return STUDY.in_chapter(self.tr, self.book, self.ch).get(min(self.sel)) or self.bookmark()

    def note(self):
        r = self.record()
        d = Adw.AlertDialog(heading='Note', body=self.sel_label.get_label())
        tvw = Gtk.TextView(wrap_mode=Gtk.WrapMode.WORD_CHAR, top_margin=8, bottom_margin=8, left_margin=8, right_margin=8)
        tvw.get_buffer().set_text(r.get('note') or '')
        sc = Gtk.ScrolledWindow(min_content_height=150, min_content_width=260); sc.set_child(tvw); sc.add_css_class('card')
        d.set_extra_child(sc)
        d.add_response('cancel', 'Cancel')
        if r.get('note'):
            d.add_response('delete', 'Delete note'); d.set_response_appearance('delete', Adw.ResponseAppearance.DESTRUCTIVE)
        d.add_response('save', 'Save'); d.set_response_appearance('save', Adw.ResponseAppearance.SUGGESTED)
        def resp(dlg, res):
            if res == 'save':
                b = tvw.get_buffer(); STUDY.set_note(r, b.get_text(b.get_start_iter(), b.get_end_iter(), False).strip()[:5000])
            elif res == 'delete':
                old = r.get('note', ''); STUDY.set_note(r, '')
                self.win.toast('Note deleted', undo=lambda: STUDY.set_note(r, old))
        d.connect('response', resp); d.present(self.win)
        GLib.idle_add(lambda: (tvw.grab_focus(), False)[1])

    def pads(self):
        r = self.record()
        d = Adw.AlertDialog(heading='Study Pads', body=self.sel_label.get_label())
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6)
        checks = {}
        for p in STUDY.pads():
            cb = Gtk.CheckButton(label=p['tag']); cb.set_active(p['tag'] in (r.get('tags') or [])); box.append(cb); checks[p['tag']] = cb
        new = Gtk.Entry(placeholder_text='New Study Pad (one word)'); box.append(new)
        d.set_extra_child(box)
        d.add_response('cancel', 'Cancel'); d.add_response('save', 'Save'); d.set_response_appearance('save', Adw.ResponseAppearance.SUGGESTED)
        def resp(dlg, res):
            if res != 'save':
                return
            tags = [t for t, cb in checks.items() if cb.get_active()]
            nt = re.sub(r'[^\w-]', '', new.get_text().strip().lower())[:30]
            if nt:
                tags.append(nt)
            STUDY.set_tags(r, tags)
        d.connect('response', resp); d.present(self.win)

    def on_key(self, c, keyval, code, state):
        if isinstance(self.get_root().get_focus(), (Gtk.Text, Gtk.Entry, Gtk.SearchEntry, Gtk.TextView)) and self.get_root().get_focus() is not self.view:
            return False
        ctrl = state & Gdk.ModifierType.CONTROL_MASK
        if keyval in (Gdk.KEY_Left, Gdk.KEY_Page_Up) and not state:
            self.step(-1); return True
        if keyval in (Gdk.KEY_Right, Gdk.KEY_Page_Down) and not state:
            self.step(1); return True
        if keyval == Gdk.KEY_f and ctrl:
            self.search_btn.set_active(True); self.sentry.grab_focus(); return True
        if keyval == Gdk.KEY_c and ctrl and self.sel and not self.view.get_buffer().get_has_selection():
            self.copy(); return True
        if keyval in (Gdk.KEY_plus, Gdk.KEY_equal, Gdk.KEY_KP_Add) and ctrl:
            self.zoom(1.1); return True
        if keyval in (Gdk.KEY_minus, Gdk.KEY_KP_Subtract) and ctrl:
            self.zoom(1 / 1.1); return True
        if keyval == Gdk.KEY_0 and ctrl:
            self.zoom(0); return True
        if keyval == Gdk.KEY_Escape and self.sel:
            self.unselect(); return True
        return False

    # ---------- right click (or a long press): what to do with the verse ----------
    def on_menu(self, g, n, x, y):
        v = self.verse_at(x, y)
        if not v:
            return
        if v not in self.sel:
            self.sel = [v]; self.mark_selection()
        return

    def old_menu(self, x, y):
        pop = Gtk.Popover(has_arrow=True); pop.set_parent(self.view)
        r = Gdk.Rectangle(); r.x, r.y, r.width, r.height = int(x), int(y), 1, 1; pop.set_pointing_to(r)
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, margin_top=6, margin_bottom=6, margin_start=6, margin_end=6)
        box.append(Gtk.Label(label=self.sel_label.get_label(), xalign=0, css_classes=['heading'], margin_start=6, margin_bottom=4))
        dots = Gtk.Box(spacing=6, margin_start=6, margin_bottom=4)
        for c in COLORS:
            b = Gtk.Button(tooltip_text='Highlight: ' + c); b.add_css_class('kjt-dot'); b.add_css_class('kjt-dot-' + c)
            b.connect('clicked', lambda _b, c=c: (pop.popdown(), self.bookmark(c))); dots.append(b)
        box.append(dots)
        for icon, label, fn in (('kjt-copy-symbolic', 'Copy', self.copy), ('kjt-study-symbolic', 'Bookmark', self.bookmark), ('kjt-note-symbolic', 'Write a note', self.note),
                                ('kjt-tag-symbolic', 'Put in a Study Pad', self.pads), (None, None, None),
                                ('kjt-cross-symbolic', 'The Holy Fathers on it', lambda: self.side_show('hf')), ('kjt-route-symbolic', 'Cross-references', lambda: self.side_show('xref')),
                                ('kjt-globe-symbolic', 'Greek and Hebrew words', lambda: self.side_show('words')), ('kjt-compare-symbolic', 'Compare with another Bible', lambda: self.cmp_btn.popup()),
                                ('kjt-listen-symbolic', 'Listen to this chapter', self.listen), ('kjt-map-symbolic', 'Places on the map', self.map)):
            if icon is None:
                box.append(Gtk.Separator(margin_top=3, margin_bottom=3)); continue
            b = Gtk.Button(); b.add_css_class('flat')
            row = Gtk.Box(spacing=10); row.append(Gtk.Image(icon_name=icon)); row.append(Gtk.Label(label=label, xalign=0)); b.set_child(row)
            b.connect('clicked', lambda _b, fn=fn: (pop.popdown(), fn())); box.append(b)
        pop.set_child(box)
        pop.connect('closed', lambda p: GLib.idle_add(lambda: (p.unparent(), False)[1]))
        pop.popup()

    def refresh_side(self):
        what = self.side.get_visible_child_name()
        if what == 'hf':
            self.show_fathers()
        elif what == 'xref':
            self.show_xref()
        elif what == 'words':
            self.show_words()

    # ---------- the people and places of the chapter ----------
    def chapter_names(self, buf):
        from .dictionary import entries
        key = '%s.%d.' % (canon(self.book), self.ch)
        found = []
        pl = read_file('maps/places.json') or {}
        for r in pl.get('p', []):
            if key in (' ' + r[6] + ' ').replace(' ', ' ').replace(' ' , ' ') and (' ' + r[6]).find(' ' + key) >= 0:
                found.append((r[7] or 'p-' + r[0], r[1], 'place'))
        pe = read_file('dictionary/people.json') or {}
        for r in pe.get('p', []):
            if (' ' + r[5]).find(' ' + key) >= 0:
                found.append((r[0], r[2] or r[1], 'person'))
        if not found:
            return
        seen, items = set(), []
        for i, n, k in found:
            if i not in seen:
                seen.add(i); items.append((i, n))
        end = buf.get_end_iter
        buf.insert_with_tags_by_name(end(), '\n\nIn this chapter: ', 'names')
        for k, (i, n) in enumerate(items[:60]):
            t = buf.get_tag_table().lookup('link:#kd:' + i) or buf.create_tag('link:#kd:' + i, foreground='#8cc4e8' if Adw.StyleManager.get_default().get_dark() else '#2b6a8e', underline=Pango.Underline.SINGLE)
            buf.insert_with_tags_by_name(end(), n, 'names', 'link:#kd:' + i)
            if k < len(items[:60]) - 1:
                buf.insert_with_tags_by_name(end(), ' · ', 'names')

    # ---------- the words of Christ in red (the King James text) ----------
    def red_letters(self):
        if not SET.get('red', True) or not self.tr.startswith('eng-kjv'):
            return {}
        en = (STORE.kv('info') or {}).get('books', {}).get('en', {})
        d = read_file('red-letters/%s.json' % en.get(canon(self.book), '')) if en.get(canon(self.book)) else None
        return (d or {}).get(str(self.ch), {})

    # ---------- cross-references ----------
    def ref_text(self, ref):
        m = re.match(r'([1-4A-Z]{3}) (\d+):(\d+)(?:-(\d+))?', ref)
        if not m:
            return ref, '', None
        b, c, v1 = m.group(1), int(m.group(2)), int(m.group(3)); v2 = int(m.group(4) or v1)
        tr = self.tr if STORE.find_book(self.tr, b) else next((t for t in STORE.bibles() if STORE.find_book(t, b)), None)
        rows = STORE.passage(tr, b, c, v1, c, v2) if tr else []
        label = '%s %d:%d%s' % (book_name(b, tr=tr or self.tr), c, v1, '–%d' % v2 if v2 > v1 else '')
        return label, ' '.join(re.sub(r'<[^>]+>', '', r[2]).strip() for r in rows), '#/p/kjva/%s/%d/%d' % (b, c, v1)

    def show_xref(self):
        d = read_file('xref/%s.json' % canon(self.book))
        h = ['<h2>%s %d</h2>' % (esc(book_name(self.book, tr=self.tr)), self.ch)]
        if d is None:
            h.append('<p>The cross-references are not on this computer yet. Open Downloads and bring everything up to date.</p>')
        else:
            verses = sorted(self.sel) if self.sel else [v for v in self.vnum if '%d:%d' % (self.ch, v) in d]
            if not self.sel:
                h.append('<p><small>The whole chapter. Choose a verse to see only its own.</small></p>')
            for v in verses:
                refs = d.get('%d:%d' % (self.ch, v)) or []
                h.append('<h3>v. %d</h3>' % v)
                if not refs:
                    h.append('<p><small>None.</small></p>')
                for ref in refs:
                    label, text, href = self.ref_text(ref)
                    h.append('<p><a href="%s">%s</a> <small>%s</small></p>' % (esc(href or ''), esc(label), esc(text[:240] + ('…' if len(text) > 240 else ''))))
        html_into(self.xref_view, ''.join(h), self.on_link, 0.95)

    # ---------- the Greek and Hebrew words ----------
    def show_words(self):
        d = read_file('words/%s.json.gz' % canon(self.book))
        h = []
        if d is None:
            h.append('<p>The words of the original are not on this computer yet. Open Downloads and bring everything up to date.</p>')
        elif not self.sel:
            h.append('<p>Choose a verse (click it) to see its words in the original language.</p>')
        else:
            for v in sorted(self.sel)[:6]:
                ws = (d.get(str(self.ch)) or {}).get(str(v)) or []
                h.append('<h3>%s %d:%d</h3>' % (esc(book_name(self.book, tr=self.tr)), self.ch, v))
                if not ws:
                    h.append('<p><small>Not available for this verse.</small></p>')
                for w in ws:
                    orig, tl, gloss, num = (list(w) + ['', '', '', ''])[:4]
                    h.append('<p><b>%s</b>  <i>%s</i> — %s  <a href="strong:%s"><small>%s</small></a></p>' % (esc(orig), esc(tl), esc(gloss), esc(num), esc(num)))
            h.append('<p><small>The Greek (Byzantine text) and Hebrew words, with their meanings and Strong\'s numbers: STEPBible.org (CC BY 4.0).</small></p>')
        html_into(self.words_view, ''.join(h), self.on_link, 0.95)

    # ---------- the side: the Holy Fathers, or what was found ----------
    def toggle_search(self, on):
        self.sbar.set_search_mode(on)
        if on:
            self.sentry.grab_focus()
            if self.results.get_first_child():
                self.side_show('search')
        elif self.side.get_visible_child_name() == 'search':
            self.close_side()

    def toggle_fathers(self, on):
        if on:
            self.side_show('hf')
        elif self.side.get_visible_child_name() == 'hf':
            self.close_side()

    def side_show(self, what):
        self.side.set_visible_child_name(what)
        self.side_title.set_label({'hf': 'The Holy Fathers', 'search': 'Found in this Bible', 'xref': 'Cross-references', 'words': 'The words of the original'}[what])
        self.osv.set_show_sidebar(True)
        if what == 'hf':
            self.show_fathers()
        elif what == 'xref':
            self.show_xref()
        elif what == 'words':
            self.show_words()

    def close_side(self):
        self.osv.set_show_sidebar(False)

    def side_closed(self, *_):
        if not self.osv.get_show_sidebar() and self.hf_btn.get_active():
            self.hf_btn.set_active(False)

    def show_fathers(self):
        code = canon(self.book)
        d = read_file('fathers/%s.json.gz' % code)
        names = (STORE.kv('info') or {}).get('fathers', {})
        h = ['<h2>%s %d</h2>' % (book_name(self.book, tr=self.tr), self.ch)]
        if d is None:
            h.append('<p>The Holy Fathers\' commentary is not on this computer yet. Open Downloads to keep it.</p>')
        else:
            want = set(self.sel)
            rows = []
            for r in d['e'].get(str(self.ch), []):
                v1, v2 = int(r[0]), int(r[1]) or int(r[0])
                if want and not any(v1 <= w <= max(v1, v2) or v1 == 0 for w in want):
                    continue
                a = d['a'][r[2]] if r[2] < len(d['a']) else ''
                rows.append((v1, v2, (names.get(a) or [a, '', 9999])[2], a, d['s'][r[3]] if r[3] < len(d['s']) else '', r[4]))
            rows.sort(key=lambda x: (x[0], x[1], x[2]))
            if not rows:
                h.append('<p>Nothing on %s.</p>' % ('these verses' if want else 'this chapter'))
            elif want:
                h.append('<p><small>On the verses you chose. Clear the choice to see the whole chapter.</small></p>')
            for v1, v2, _, a, src, q in rows:
                nm, yrs, _ = names.get(a) or [a, '', 9999]
                vv = ('v. %d' % v1 + ('–%d' % v2 if v2 > v1 else '')) if v1 else 'the chapter'
                if 'Catena Aurea' in src:
                    src = 'from the Catena Aurea'
                q = re.sub(r'^\(in loco\.?\)\s*', '', q)
                h.append('<h3>%s</h3><p><small>%s%s</small></p><blockquote>%s</blockquote><p><small>%s</small></p>' % (esc(nm), (esc(yrs) + ' · ') if yrs else '', vv, esc(q), esc(src)))
        html_into(self.hf_view, ''.join(h), self.on_link, 0.95)

    def do_search(self, *_):
        q = self.sentry.get_text().strip()
        while self.results.get_first_child():
            self.results.remove(self.results.get_first_child())
        if not q:
            return
        res = STORE.search(self.tr, q)
        self.results.append(Gtk.Label(label=('%d found' % len(res)) if res else 'Nothing found', xalign=0, css_classes=['dim-label'], margin_start=12, margin_top=8, margin_bottom=4))
        names = {}
        for b, c, v, t in res:
            nm = names.get(b) or names.setdefault(b, book_name(b, tr=self.tr))
            row = Gtk.Button(); row.add_css_class('flat')
            bx = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2)
            bx.append(Gtk.Label(label='%s %d:%d' % (nm, c, v), xalign=0, css_classes=['heading']))
            bx.append(Gtk.Label(label=re.sub(r'<[^>]+>', '', t), xalign=0, wrap=True, lines=3, ellipsize=Pango.EllipsizeMode.END, max_width_chars=40))
            row.set_child(bx)
            row.connect('clicked', lambda _b, b=b, c=c, v=v: (self.go(b, c, v), self.compact and self.close_side()))
            self.results.append(row)
        self.side_show('search')

    def on_link(self, href):
        if href.startswith('strong:'):
            self.show_lexicon(href[7:]); return
        self.win.open_link(href)

    def show_lexicon(self, num):
        """what a Greek or Hebrew word means (STEPBible's brief lexicons)"""
        lex = read_file('words/lexicon.json.gz') or {}
        e = lex.get(num) or lex.get(num[0] + num[1:].zfill(4))
        h = ['<p><a href="words:back">← Back to the verse</a></p>']
        if not e:
            h.append('<p>%s is not in the lexicon on this computer.</p>' % esc(num))
        else:
            lemma, tl, gloss, defin = (list(e) + ['', '', '', ''])[:4]
            h.append('<h2>%s</h2><p><i>%s</i> — <b>%s</b>  <small>%s</small></p><p>%s</p>' % (esc(lemma), esc(tl), esc(gloss), esc(num), esc(defin).replace('; ', '<br>')))
            h.append('<p><small>STEPBible.org brief lexicons (CC BY 4.0).</small></p>')
        html_into(self.words_view, ''.join(h), lambda href: self.show_words() if href == 'words:back' else self.on_link(href), 0.95)

    compact = False


def esc(s):
    return (s or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
