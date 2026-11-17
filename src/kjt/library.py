"""The Library: the free Bibles, commentaries, dictionaries and books of CrossWire and AndBible.
Nothing is added without your choice: you see the list first, then keep what you want on this computer."""
import re
from gi.repository import Gtk, Adw, GLib, Pango
from .core import SET, STORE, NET, lang, run_bg, book_name, canon
from .i18n import _
from . import sword as S
from .richtext import html_into, make_view

KINDS = [('bible', 'Bibles'), ('commentary', 'Commentaries'), ('book', 'Books'), ('dictionary', 'Dictionaries'),
         ('glossary', 'Glossaries'), ('daily', 'Daily readings'), ('map', 'Maps and pictures'), ('other', 'Other')]
LANG_LABEL = {'en': 'English', 'grc': 'Ancient Greek', 'el': 'Greek', 'ru': 'Russian', 'ar': 'Arabic', 'fr': 'French', 'es': 'Spanish', 'zh': 'Chinese', 'hi': 'Hindi',
              'tl': 'Tagalog', 'la': 'Latin', 'he': 'Hebrew', 'hbo': 'Ancient Hebrew', 'cu': 'Church Slavonic', 'syc': 'Syriac', 'syr': 'Syriac', 'cop': 'Coptic',
              'de': 'German', 'it': 'Italian', 'pt': 'Portuguese', 'ro': 'Romanian', 'uk': 'Ukrainian', 'bg': 'Bulgarian', 'sr': 'Serbian', 'ka': 'Georgian', 'hy': 'Armenian'}


def lang_of(c):
    return (c.get('Lang') or 'en').split('-')[0]


def lang_label(code):
    return LANG_LABEL.get(code, code)


def osis_ref(r):
    """'John.3.16', 'Matt.1.1-Matt.1.5', 'Gen 1:1' -> (book code, chapter, verse)"""
    r = (r or '').strip().split('-')[0].split(' ')[0] if '.' in (r or '') else (r or '')
    m = re.match(r'([1-4]?\s?[A-Za-z]+)[\s.]+(\d+)(?:[.:](\d+))?', r.strip())
    if not m:
        return None
    b = m.group(1).replace(' ', '')
    code = S.OSIS2CODE.get(b) or next((c for o, c in S.OSIS2CODE.items() if o.lower() == b.lower()), None) or canon(b)
    return code, int(m.group(2)), int(m.group(3) or 1)


def size_of(c):
    try:
        n = int(c.get('InstallSize') or 0)
    except ValueError:
        n = 0
    return ('%.0f MB' % (n / 1e6)) if n > 1e6 else ('%.0f KB' % (n / 1e3)) if n else ''


class LibraryPage(Gtk.Box):
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win
        self.cat = None
        self.mode = 'here'
        self.nav = Adw.NavigationView(); self.nav.set_vexpand(True); self.append(self.nav)
        tv = Adw.ToolbarView()
        hb = Adw.HeaderBar(); tv.add_top_bar(hb); win.sidebar_button(hb)
        self.q = Gtk.SearchEntry(placeholder_text=_('Find in the library'), width_chars=20, max_width_chars=30)
        self.q.connect('search-changed', lambda *_: self.later())
        hb.set_title_widget(self.q)
        tabs = Gtk.Box(halign=Gtk.Align.CENTER, margin_top=8, margin_bottom=4); tabs.add_css_class('linked')
        self.t_here = Gtk.ToggleButton(label=_('On this computer'), active=True); self.t_get = Gtk.ToggleButton(label=_('Get more'), group=self.t_here)
        self.t_here.connect('toggled', lambda b: b.get_active() and self.set_mode('here'))
        self.t_get.connect('toggled', lambda b: b.get_active() and self.set_mode('get'))
        tabs.append(self.t_here); tabs.append(self.t_get)
        body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL); body.append(tabs)
        self.filters = Gtk.Box(spacing=8, halign=Gtk.Align.CENTER, margin_bottom=4, visible=False)
        self.langs = ['mine', 'all']
        self.lang_dd = Gtk.DropDown.new_from_strings(['My languages', 'All languages']); self.lang_dd.connect('notify::selected', lambda *_: self.later())
        self.kind_dd = Gtk.DropDown.new_from_strings(['Everything'] + [k[1] for k in KINDS]); self.kind_dd.connect('notify::selected', lambda *_: self.later())
        self.filters.append(self.lang_dd); self.filters.append(self.kind_dd)
        body.append(self.filters)
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER)
        cl = Adw.Clamp(maximum_size=860); self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=18, margin_top=8, margin_bottom=24, margin_start=12, margin_end=12)
        cl.set_child(self.box); sc.set_child(cl); body.append(sc)
        tv.set_content(body)
        self.nav.add(Adw.NavigationPage(title='Library', child=tv, tag='home'))
        self.timer = 0
        from .downloads import DL
        DL.sword_listeners.append(lambda: self.fill() if self.mode == 'here' or self.cat is not None else None)

    # ---------- the two lists ----------
    def refresh(self):
        self.fill()

    def set_mode(self, m):
        self.mode = m
        self.filters.set_visible(m == 'get')
        if m == 'get' and self.cat is None:
            self.load()
        self.fill()

    def later(self):
        if self.timer:
            GLib.source_remove(self.timer)
        self.timer = GLib.timeout_add(220, lambda: (setattr(self, 'timer', 0), self.fill(), False)[2])

    def clear(self):
        while self.box.get_first_child():
            self.box.remove(self.box.get_first_child())

    def load(self, refresh=False):
        self.cat = None
        self.loading = True
        def done(r):
            self.loading = False
            self.cat = r if isinstance(r, list) else []
            langs = sorted({lang_of(c) for c in self.cat}, key=lambda l: (l not in (lang(), 'en', 'grc', 'el', 'ru', 'ar', 'cu'), lang_label(l)))
            self.langs = ['mine', 'all'] + langs
            self.lang_dd.set_model(Gtk.StringList.new(['My languages', 'All languages'] + ['%s (%d)' % (lang_label(l), sum(1 for c in self.cat if lang_of(c) == l)) for l in langs]))
            self.fill()
        run_bg(lambda: S.catalogue(refresh), done)

    def match(self, c):
        q = self.q.get_text().strip().casefold()
        if not q:
            return True
        return q in (c.get('Description') or '').casefold() or q in c['_name'].casefold() or q in S.about(c).casefold()[:600]

    def group(self, title, desc=''):
        g = Adw.PreferencesGroup(title=GLib.markup_escape_text(title), description=GLib.markup_escape_text(desc) if desc else None)
        self.box.append(g); return g

    def fill(self):
        self.clear()
        if self.mode == 'here':
            self.fill_here()
        else:
            self.fill_get()

    def fill_here(self):
        mine = [c for c in S.installed() if self.match(c)]
        if not mine:
            st = Adw.StatusPage(icon_name='kjt-library-symbolic', title=_('Your library is empty'),
                                description='Choose “Get more” to see the free Bibles, commentaries, dictionaries and books of CrossWire and AndBible. Nothing is added until you choose it.')
            b = Gtk.Button(label='Get more', halign=Gtk.Align.CENTER); b.add_css_class('pill'); b.add_css_class('suggested-action')
            b.connect('clicked', lambda *_: self.t_get.set_active(True)); st.set_child(b)
            self.box.append(st); return
        for k, title in KINDS:
            items = [c for c in mine if c['_kind'] == k]
            if not items:
                continue
            g = self.group(title)
            for c in sorted(items, key=lambda c: (not S.ORTHODOX_FIRST.search((c.get('Description') or '') + ' ' + c['_name']), (c.get('Description') or c['_name']).casefold())):
                row = Adw.ActionRow(title=GLib.markup_escape_text(c.get('Description') or c['_name']),
                                    subtitle=GLib.markup_escape_text('%s · %s' % (c['_name'], lang_label(lang_of(c)))), activatable=True)
                row.connect('activated', lambda _r, c=c: self.open(c))
                d = Gtk.Button(icon_name='user-trash-symbolic', tooltip_text=_('Remove from this computer'), valign=Gtk.Align.CENTER); d.add_css_class('flat')
                d.connect('clicked', lambda _b, c=c: self.ask_remove(c)); row.add_suffix(d)
                row.add_suffix(Gtk.Image(icon_name='go-next-symbolic'))
                g.add(row)

    def fill_get(self):
        if self.cat is None:
            sp = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10, margin_top=40, halign=Gtk.Align.CENTER)
            s = Gtk.Spinner(spinning=True); s.set_size_request(32, 32); sp.append(s)
            sp.append(Gtk.Label(label='Fetching the lists of CrossWire and AndBible…', css_classes=['dim-label'])); self.box.append(sp); return
        if not self.cat:
            st = Adw.StatusPage(icon_name='kjt-library-symbolic', title=_('The lists could not be fetched'), description='The library lists come with the internet. Try again when you are online.')
            b = Gtk.Button(label=_('Try again'), halign=Gtk.Align.CENTER); b.add_css_class('pill'); b.connect('clicked', lambda *_: (self.load(True), self.fill())); st.set_child(b)
            self.box.append(st); return
        have = {c['_name'].lower() for c in S.installed()}
        li = self.lang_dd.get_selected(); lsel = self.langs[li] if li < len(self.langs) else 'mine'
        ki = self.kind_dd.get_selected(); ksel = KINDS[ki - 1][0] if ki > 0 else None
        mine_langs = {lang(), 'en', 'grc', 'el'} | ({'cu', 'ru'} if lang() == 'ru' else set()) | ({'ar', 'syc'} if lang() == 'ar' else set())
        seen, rows = set(), []
        for c in self.cat:
            key = c['_name'].lower()
            if key in seen or S.locked(c):
                continue
            if lsel == 'mine' and lang_of(c) not in mine_langs:
                continue
            if lsel not in ('mine', 'all') and lang_of(c) != lsel:
                continue
            if ksel and c['_kind'] != ksel:
                continue
            if not self.match(c):
                continue
            seen.add(key); rows.append(c)
        info = Gtk.Label(label='Free to read, from CrossWire Bible Society and AndBible. %d shown. Choose what you want: each is downloaded once, then read without the internet.' % len(rows),
                         wrap=True, xalign=0, css_classes=['dim-label']); self.box.append(info)
        ortho = [c for c in rows if S.ORTHODOX_FIRST.search((c.get('Description') or '') + ' ' + c['_name'] + ' ' + S.about(c)[:300])]
        if ortho:
            g = self.group('For Orthodox readers', 'The Septuagint, the Byzantine and Patriarchal texts, the Holy Fathers and the early Church')
            for c in ortho[:60]:
                g.add(self.get_row(c, c['_name'].lower() in have))
        for k, title in KINDS:
            items = [c for c in rows if c['_kind'] == k and c not in ortho]
            if not items:
                continue
            ex = Adw.ExpanderRow(title=title, subtitle='%d' % len(items))
            ex.set_expanded(bool(self.q.get_text().strip()) or len(items) < 8)
            for c in sorted(items, key=lambda c: (c.get('Description') or c['_name']).casefold())[:400]:
                ex.add_row(self.get_row(c, c['_name'].lower() in have))
            g = self.group(''); g.add(ex)

    def get_row(self, c, have):
        sub = ' · '.join(x for x in (c['_name'], lang_label(lang_of(c)), c.get('_source'), size_of(c)) if x)
        row = Adw.ActionRow(title=GLib.markup_escape_text(c.get('Description') or c['_name']), subtitle=GLib.markup_escape_text(sub))
        ib = Gtk.MenuButton(icon_name='dialog-information-symbolic', tooltip_text=_('About this'), valign=Gtk.Align.CENTER); ib.add_css_class('flat')
        pop = Gtk.Popover(); lab = Gtk.Label(wrap=True, max_width_chars=60, xalign=0, selectable=True, margin_top=8, margin_bottom=8, margin_start=8, margin_end=8)
        lab.set_text((S.about(c) or c.get('Description') or '')[:2500] + '\n\nLicence: ' + (c.get('DistributionLicense') or 'not stated') + ('\nVersion: ' + c['Version'] if c.get('Version') else ''))
        ps = Gtk.ScrolledWindow(propagate_natural_height=True, max_content_height=380, propagate_natural_width=True, hscrollbar_policy=Gtk.PolicyType.NEVER); ps.set_child(lab)
        pop.set_child(ps); ib.set_popover(pop); row.add_suffix(ib)
        if have:
            row.add_suffix(Gtk.Label(label=_('✓ kept here'), css_classes=['dim-label']))
        else:
            b = Gtk.Button(icon_name='folder-download-symbolic', tooltip_text=_('Keep on this computer'), valign=Gtk.Align.CENTER)
            b.connect('clicked', lambda _b, c=c: self.get(c, _b)); row.add_suffix(b)
        return row

    def get(self, c, btn=None):
        from .downloads import DL
        DL.start({'sword': [c]})
        if btn:
            btn.set_sensitive(False); btn.set_tooltip_text('Downloading: see Downloads')
        self.win.toast('Downloading “%s”. You can keep reading.' % (c.get('Description') or c['_name']))

    def ask_remove(self, c):
        d = Adw.AlertDialog(heading='Remove “%s”?' % (c.get('Description') or c['_name']), body='It can be downloaded again at any time. Your bookmarks and notes are not touched.')
        d.add_response('cancel', 'Keep it'); d.add_response('go', 'Remove'); d.set_response_appearance('go', Adw.ResponseAppearance.DESTRUCTIVE)
        d.connect('response', lambda _d, r: (S.remove(c), self.fill(), self.win.toast('Removed')) if r == 'go' else None); d.present(self.win)

    # ---------- reading ----------
    def open(self, c, book=None, ch=None, v=None):
        k = c['_kind']
        if k == 'bible':
            tr = S.bible_code(c)
            if tr in STORE.bibles():
                self.win.show('bible'); self.win.bible.set_tr(tr)
            else:
                self.win.toast('This Bible is still being prepared')
            return
        if k == 'commentary':
            self.open_commentary(c, book, ch, v)
        elif k in ('book', 'map'):
            self.open_book(c)
        else:
            self.open_dict(c)

    def text_view(self):
        v = make_view(self.on_link)
        sc = Gtk.ScrolledWindow(vexpand=True, hexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER)
        cl = Adw.Clamp(maximum_size=820); cl.set_child(v); sc.set_child(cl)
        from .ui import steady; steady(sc)
        return v, sc

    def on_link(self, href):
        self.win.open_link(href)

    def open_commentary(self, c, book=None, ch=None, v=None):
        m = S.open_module(c)
        if not m:
            self.win.toast('This could not be opened'); return
        books = [b for b in m.books()]
        if not books:
            return
        tv = Adw.ToolbarView(); hb = Adw.HeaderBar(); tv.add_top_bar(hb)
        hb.set_title_widget(Adw.WindowTitle(title=c.get('Description') or c['_name'], subtitle=_('Commentary')))
        hb.pack_end(self.search_button(c, lambda q, emit, alive: self.search_verses(c, m, q, emit, alive)))
        bar = Gtk.Box(spacing=6, halign=Gtk.Align.CENTER, margin_top=6, margin_bottom=6)
        names = [book_name(S.OSIS2CODE.get(o, o)) if S.OSIS2CODE.get(o) else n for o, n, _ in books]
        bdd = Gtk.DropDown.new_from_strings(names); spin = Gtk.SpinButton.new_with_range(1, 150, 1)
        prev = Gtk.Button(icon_name='kjt-prev-symbolic', tooltip_text=_('Previous chapter')); nxt = Gtk.Button(icon_name='kjt-next-symbolic', tooltip_text=_('Next chapter'))
        read = Gtk.Button(label=_('Read the chapter →')); read.add_css_class('flat')
        for w in (prev, bdd, spin, nxt, read):
            bar.append(w)
        view, sc = self.text_view()
        body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL); body.append(bar); body.append(sc); tv.set_content(body)
        st = {'busy': False}
        def show(*_):
            if st['busy']:
                return
            i = bdd.get_selected(); osis, _n, nch = books[i]
            st['busy'] = True; spin.set_range(1, nch); st['busy'] = False
            chn = int(spin.get_value())
            code = S.OSIS2CODE.get(osis, osis)
            h = S.chapter_html(c, code, chn, None)
            if not h.strip():
                h = '<p>Nothing on this chapter.</p>'
            html_into(view, '<h2>%s %d</h2>' % (GLib.markup_escape_text(names[i]), chn) + h, self.on_link)
            SET.set('lib_pos_' + c['_name'], [osis, chn])
        def move(d):
            i = bdd.get_selected(); chn = int(spin.get_value()) + d
            if chn < 1 and i > 0:
                st['busy'] = True; bdd.set_selected(i - 1); st['busy'] = False; chn = books[i - 1][2]
            elif chn > books[i][2] and i < len(books) - 1:
                st['busy'] = True; bdd.set_selected(i + 1); st['busy'] = False; chn = 1
            spin.set_value(max(1, chn)); show()
        bdd.connect('notify::selected', lambda *_: (spin.set_value(1), show()) if not st['busy'] else None)
        spin.connect('value-changed', lambda *_: show() if not st['busy'] else None)
        prev.connect('clicked', lambda *_: move(-1)); nxt.connect('clicked', lambda *_: move(1))
        read.connect('clicked', lambda *_: self.win.open_passage(S.OSIS2CODE.get(books[bdd.get_selected()][0], books[bdd.get_selected()][0]), int(spin.get_value()), 1))
        osis0, ch0 = (S.CODE2OSIS.get(canon(book), book), ch) if book else (SET.get('lib_pos_' + c['_name']) or [books[0][0], 1])
        i0 = next((i for i, b in enumerate(books) if b[0] == osis0), 0)
        st['busy'] = True; bdd.set_selected(i0); spin.set_range(1, books[i0][2]); spin.set_value(ch0 or 1); st['busy'] = False
        show()
        self.nav.push(Adw.NavigationPage(title=c.get('Description') or c['_name'], child=tv))

    def open_book(self, c, node=0, title=None):
        try:
            g = S.GenBook(c)
        except Exception:
            self.win.toast('This book could not be opened'); return
        self.push_node(c, g, node, title or c.get('Description') or c['_name'])

    def push_node(self, c, g, n, title):
        tv = Adw.ToolbarView(); hb = Adw.HeaderBar(); tv.add_top_bar(hb)
        hb.set_title_widget(Adw.WindowTitle(title=title.replace('_', ' '), subtitle=c.get('Description') or c['_name']))
        hb.pack_end(self.search_button(c, lambda q, emit, alive: self.search_book(c, g, q, emit, alive)))
        body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        kids = g.children(n)
        text = g.text(n) if n else ''
        if text.strip() or not kids:
            view, sc = self.text_view()
            html_into(view, S.to_html(text, g.src) or '<p>(empty)</p>', self.on_link)
            body.append(sc)
            # reading on: the next part of the book
            nxt = self.next_node(g, n)
            if nxt is not None:
                b = Gtk.Button(label='Next: %s →' % g.node(nxt)['name'].replace('_', ' ')[:60], halign=Gtk.Align.END, margin_top=4, margin_bottom=6, margin_end=10); b.add_css_class('flat')
                b.connect('clicked', lambda *_: self.push_node(c, g, nxt, g.node(nxt)['name'])); body.append(b)
        if kids:
            lb = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE); lb.add_css_class('boxed-list')
            for k in kids:
                row = Adw.ActionRow(title=GLib.markup_escape_text(k['name'].replace('_', ' ')), activatable=True)
                if k['first'] >= 0:
                    row.add_suffix(Gtk.Image(icon_name='go-next-symbolic'))
                    if len(kids) <= 80:   # what is inside: the first few names under it
                        inner = [x['name'].replace('_', ' ') for x in g.children(k['n'])[:5] if x['name'].lower() not in ('preface', 'title', 'toc')]
                        if inner:
                            row.set_subtitle(GLib.markup_escape_text(' · '.join(inner)[:140])); row.set_subtitle_lines(1)
                row.connect('activated', lambda _r, k=k: self.push_node(c, g, k['n'], k['name']))
                lb.append(row)
            sc2 = Gtk.ScrolledWindow(vexpand=not (text.strip()), hscrollbar_policy=Gtk.PolicyType.NEVER, propagate_natural_height=bool(text.strip()), max_content_height=300)
            cl = Adw.Clamp(maximum_size=820, margin_top=8, margin_bottom=12, margin_start=12, margin_end=12); cl.set_child(lb); sc2.set_child(cl)
            body.append(sc2)
        tv.set_content(body)
        self.nav.push(Adw.NavigationPage(title=title.replace('_', ' ')[:40], child=tv))

    def next_node(self, g, n):
        """the next part in reading order: the first child, else the next sibling (or a parent's next)"""
        nd = g.node(n)
        if nd['first'] >= 0:
            return nd['first'] // 4
        while nd:
            if nd['next'] >= 0:
                return nd['next'] // 4
            if nd['parent'] < 0 or nd['parent'] // 4 == 0:
                return None
            nd = g.node(nd['parent'] // 4)
        return None

    def open_dict(self, c):
        m = S.open_module(c)
        if not m:
            self.win.toast('This could not be opened'); return
        tv = Adw.ToolbarView(); hb = Adw.HeaderBar(); tv.add_top_bar(hb)
        q = Gtk.SearchEntry(placeholder_text=_('Find a word'), width_chars=20); hb.set_title_widget(q)
        names = m.names()
        hb.pack_end(self.search_button(c, lambda qq, emit, alive: self.search_dict(c, m, names, qq, emit, alive)))
        model = Gtk.StringList.new([n for n in names])
        flt = Gtk.StringFilter(expression=Gtk.PropertyExpression.new(Gtk.StringObject, None, 'string'), match_mode=Gtk.StringFilterMatchMode.SUBSTRING, ignore_case=True)
        fm = Gtk.FilterListModel(model=model, filter=flt)
        sel = Gtk.SingleSelection(model=fm, autoselect=False)
        fac = Gtk.SignalListItemFactory()
        fac.connect('setup', lambda f, it: it.set_child(Gtk.Label(xalign=0, ellipsize=Pango.EllipsizeMode.END, margin_start=8, margin_top=4, margin_bottom=4)))
        fac.connect('bind', lambda f, it: it.get_child().set_label(it.get_item().get_string()))
        lv = Gtk.ListView(model=sel, factory=fac); lv.add_css_class('navigation-sidebar')
        ls = Gtk.ScrolledWindow(hscrollbar_policy=Gtk.PolicyType.NEVER); ls.set_child(lv); ls.set_size_request(220, -1)
        view, sc = self.text_view()
        paned = Gtk.Paned(start_child=ls, end_child=sc, position=SET.get('w_lib_dict', 260), shrink_start_child=False)
        paned.connect('notify::position', lambda p, _x: SET.set('w_lib_dict', p.get_position()))
        tv.set_content(paned)
        def show(*_):
            it = sel.get_selected_item()
            if not it:
                return
            word = it.get_string(); i = names.index(word)
            html_into(view, '<h2>%s</h2>%s' % (GLib.markup_escape_text(word), S.to_html(m.get(i), m.src)), self.on_link)
        sel.connect('notify::selected', show)
        q.connect('search-changed', lambda e: flt.set_search(e.get_text().strip()))
        html_into(view, '<h2>%s</h2><p>Choose a word on the left, or type it above.</p>' % GLib.markup_escape_text(c.get('Description') or c['_name']), self.on_link)
        self.nav.push(Adw.NavigationPage(title=c.get('Description') or c['_name'], child=tv))

    # ---------- 2.8: searching the whole of a commentary, a book or a dictionary ----------
    def search_button(self, c, run):
        mb = Gtk.MenuButton(icon_name='kjt-search-symbolic', tooltip_text=_('Search the whole of it'))
        pop = Gtk.Popover(); bx = Gtk.Box(spacing=6, margin_top=6, margin_bottom=6, margin_start=6, margin_end=6)
        e = Gtk.SearchEntry(placeholder_text=_('Search the whole of it'), width_chars=26); go = Gtk.Button(label=_('Search')); go.add_css_class('suggested-action')
        bx.append(e); bx.append(go); pop.set_child(bx); mb.set_popover(pop)
        def start(*_):
            t = e.get_text().strip()
            if len(t) >= 2:
                pop.popdown(); self.search_results(c, t, run)
        e.connect('activate', start); go.connect('clicked', start)
        return mb

    @staticmethod
    def snip(t, q):
        i = t.casefold().find(q.casefold())
        if i < 0:
            return None
        a, b = max(0, i - 70), min(len(t), i + len(q) + 90)
        E = GLib.markup_escape_text
        return ('…' if a else '') + E(t[a:i]) + '<b><span background="#f6d36588">' + E(t[i:i + len(q)]) + '</span></b>' + E(t[i + len(q):b]) + ('…' if b < len(t) else '')

    def search_results(self, c, q, run):
        import threading
        tv = Adw.ToolbarView(); hb = Adw.HeaderBar(); tv.add_top_bar(hb)
        hb.set_title_widget(Adw.WindowTitle(title='“%s”' % q, subtitle=c.get('Description') or c['_name']))
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8, margin_top=12, margin_bottom=20, margin_start=12, margin_end=12)
        status = Gtk.Label(label=_('Searching…'), xalign=0, css_classes=['dim-label']); box.append(status)
        lb = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE); lb.add_css_class('boxed-list'); box.append(lb)
        cl = Adw.Clamp(maximum_size=860); cl.set_child(box)
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(cl); tv.set_content(sc)
        page = Adw.NavigationPage(title=_('Search'), child=tv)
        st = {'n': 0, 'alive': True}
        page.connect('hidden', lambda *_: st.__setitem__('alive', False) if not page.get_mapped() and page.get_parent() is None else None)
        MAX = 300
        def emit(label, snippet, go):
            if st['n'] >= MAX:
                return False
            st['n'] += 1
            def add():
                row = Adw.ActionRow(title=GLib.markup_escape_text(label), subtitle=snippet, activatable=True); row.set_subtitle_lines(3)
                row.add_suffix(Gtk.Image(icon_name='go-next-symbolic')); row.connect('activated', lambda *_: go()); lb.append(row)
                status.set_label('Searching… %d found' % st['n']); return False
            GLib.idle_add(add)
            return st['n'] < MAX
        def alive(where=None):
            if where:
                GLib.idle_add(lambda: (st['alive'] and status.set_label('Searching… %s · %d found' % (where, st['n'])), False)[1])
            return st['alive']
        def work():
            try:
                run(q, emit, alive)
            finally:
                GLib.idle_add(lambda: (status.set_label(('%d%s found' % (st['n'], '+' if st['n'] >= MAX else '')) if st['n'] else 'Nothing found.'), False)[1])
        self.nav.push(page)
        threading.Thread(target=work, daemon=True).start()

    def search_verses(self, c, m, q, emit, alive):
        for osis, name, nch in m.books():
            nm = book_name(S.OSIS2CODE.get(osis, osis)) if S.OSIS2CODE.get(osis) else name
            if not alive(nm):
                return
            for ch in range(1, nch + 1):
                last = None
                for v, t in m.chapter(osis, ch):
                    if not t or t == last:
                        continue
                    last = t
                    h = self.snip(S.to_plain(t, m.src), q)
                    if h and not emit('%s %d:%d' % (nm, ch, v), h, lambda osis=osis, ch=ch, v=v: self.open_commentary(c, S.OSIS2CODE.get(osis, osis), ch, v)):
                        return

    def search_book(self, c, g, q, emit, alive):
        total = len(g.idx) // 4
        def trail(n):
            out, nd, k = [], g.node(n), 0
            while nd and nd['n'] != 0 and k < 50:
                out.insert(0, nd['name'].replace('_', ' ')); k += 1
                if nd['parent'] < 0:
                    break
                nd = g.node(nd['parent'] // 4)
            return ' › '.join(out)
        for n in range(1, total):
            if n % 50 == 0 and not alive('%d%%' % (n * 100 // total)):
                return
            try:
                t = g.text(n)
            except Exception:
                continue
            h = self.snip(S.to_plain(t, g.src), q) if t else None
            if h and not emit(trail(n) or c['_name'], h, lambda n=n: self.push_node(c, g, n, g.node(n)['name'])):
                return

    def search_dict(self, c, m, names, q, emit, alive):
        for i, w in enumerate(names):
            if i % 100 == 0 and not alive('%d%%' % (i * 100 // max(1, len(names)))):
                return
            try:
                t = S.to_plain(m.get(i), m.src)
            except Exception:
                t = ''
            h = self.snip(t, q) or (GLib.markup_escape_text(w) if q.casefold() in w.casefold() else None)
            if h and not emit(w, h, lambda i=i, w=w: self.show_word(c, m, w, i)):
                return

    def show_word(self, c, m, w, i):
        tv = Adw.ToolbarView(); tv.add_top_bar(Adw.HeaderBar())
        view, sc = self.text_view(); tv.set_content(sc)
        html_into(view, '<h2>%s</h2>%s' % (GLib.markup_escape_text(w), S.to_html(m.get(i), m.src)), self.on_link)
        self.nav.push(Adw.NavigationPage(title=w[:40], child=tv))

    # ---------- from elsewhere in the app ----------
    def open_href(self, href):
        """library:<module>|<book>|<chapter>|<verse>"""
        parts = href[8:].split('|')
        c = S.find(parts[0])
        if not c:
            return
        self.nav.pop_to_tag('home')
        if c['_kind'] == 'commentary' and len(parts) >= 3:
            self.open_commentary(c, parts[1], int(parts[2]), int(parts[3]) if len(parts) > 3 and parts[3] else None)
        else:
            self.open(c)


def commentaries_html(book, ch, verses):
    """for the reader's side panel: what the commentaries in your library say on this chapter or these verses"""
    out = []
    for c in sorted((c for c in S.installed() if c['_kind'] == 'commentary'),
                    key=lambda c: (not S.ORTHODOX_FIRST.search((c.get('Description') or '') + c['_name']), c['_name'])):
        m = S.open_module(c)
        if not m:
            continue
        osis = S.CODE2OSIS.get(canon(book), book)
        title = GLib.markup_escape_text(c.get('Description') or c['_name'])
        link = '<a href="library:%s|%s|%d|%s">%s</a>' % (c['_name'], canon(book), ch, (min(verses) if verses else ''), 'Read in the Library →')
        if verses:
            h, last = [], None
            for v in sorted(verses):
                t = m.get(osis, ch, v)
                if t.strip() and t != last:
                    last = t; h.append(S.to_html(t, m.src))
            body = ''.join(h)
            if not body.strip():
                continue
            plain = re.sub(r'<[^>]+>', '', body)
            if len(plain) > 4000:
                body = '<p>%s …</p>' % GLib.markup_escape_text(plain[:4000])
            out.append('<h3>%s</h3>%s<p>%s</p>' % (title, body, link))
        else:
            has = any(m.get(osis, ch, v).strip() for v in range(0, 4)) or bool(m.chapter(osis, ch) and any(t.strip() for _, t in m.chapter(osis, ch)))
            if has:
                out.append('<p>📖 <b>%s</b> · %s</p>' % (title, link))
    if not out:
        return ''
    return '<h2>In your library</h2>' + ('<p><small>Choose a verse to read what they say on it.</small></p>' if not verses else '') + ''.join(out)
