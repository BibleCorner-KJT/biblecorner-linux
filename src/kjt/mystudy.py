"""My Study: bookmarks, highlights, notes and Study Pads; and your My KJT account (signing in here, in the app)."""
import time
from gi.repository import Gtk, Adw, Gdk, GLib, Pango, Gio
from .core import STORE, SET, NET, OT, NT, info, book_name, strip_tags, canon, run_bg
from .i18n import _
from .study import STUDY, COLORS


class StudyPage(Gtk.Box):
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win
        self.filter = ''
        tv = Adw.ToolbarView(); tv.set_vexpand(True); self.append(tv)
        hb = Adw.HeaderBar(); tv.add_top_bar(hb); win.sidebar_button(hb)
        # 2.11: Bible Study Journey, as in the Android app: the Journey (reading) and My study (bookmarks, notes, Study Pads)
        from .journey import JourneyView, JOURNEY, T as JT
        self.vs = Adw.ViewStack(vexpand=True)
        sw = Adw.ViewSwitcher(stack=self.vs, policy=Adw.ViewSwitcherPolicy.WIDE); hb.set_title_widget(sw)
        self.journey = JourneyView(win)
        self.sync_btn = Gtk.Button(icon_name='view-refresh-symbolic', tooltip_text=_('Bring in step with My KJT now')); self.sync_btn.connect('clicked', lambda *_: self.sync())
        hb.pack_end(self.sync_btn)
        # 2.17: export the study, as on the website and in the Android app: a file for AndBible, or a KJT backup
        ex = Gtk.MenuButton(icon_name='document-save-symbolic', tooltip_text=_('Export my study')); ex.add_css_class('flat')
        pop = Gtk.Popover(); pb = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, margin_top=6, margin_bottom=6, margin_start=6, margin_end=6)
        for lab, fn in ((_('For AndBible (bookmarks, notes and Study Pads)'), self.export_andbible), (_('KJT JSON (restore backup)'), self.export_json)):
            b = Gtk.Button(label=lab); b.add_css_class('flat'); b.get_child().set_xalign(0); b.connect('clicked', lambda _b, fn=fn: (pop.popdown(), fn())); pb.append(b)
        pop.set_child(pb); ex.set_popover(pop); hb.pack_end(ex)
        self.q = Gtk.SearchEntry(placeholder_text=_('Search your notes')); self.q.connect('search-changed', lambda *_: self.fill())
        hb.pack_start(self.q)
        # two columns side by side (the Study Pads on the left, the bookmarks on the right), each scrolling
        # on its own; on a narrow window they are one column again
        self.left = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16, margin_top=16, margin_bottom=30, margin_start=16, margin_end=8)
        self.left_sc = Gtk.ScrolledWindow(hscrollbar_policy=Gtk.PolicyType.NEVER, vexpand=True); self.left_sc.set_child(self.left)
        self.left_sc.set_size_request(260, -1)
        self.right = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16, margin_top=16, margin_bottom=30, margin_start=8, margin_end=16)
        c = Adw.Clamp(maximum_size=1400); c.set_child(self.right)
        self.right_sc = Gtk.ScrolledWindow(vexpand=True, hexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); self.right_sc.set_child(c)
        from .ui import steady
        steady(self.left_sc); steady(self.right_sc)
        self.sep = Gtk.Paned(start_child=self.left_sc, end_child=self.right_sc, shrink_start_child=False, resize_start_child=False, wide_handle=True,
                             position=SET.get('w_study_pads', 320))
        self.sep.connect('notify::position', lambda p, _x: SET.set('w_study_pads', p.get_position()) if self.wide and p.get_position() > 200 else None)
        self.vs.add_titled_with_icon(self.journey, 'journey', JT('Journey'), 'kjt-bible-symbolic')
        self.vs.add_titled_with_icon(self.sep, 'study', _('My Study'), 'kjt-study-symbolic')
        self.vs.set_visible_child_name(SET.get('sj_tab') or 'journey')
        def tab(*_):
            t = self.vs.get_visible_child_name(); SET.set('sj_tab', t)
            self.q.set_visible(t == 'study')
        self.vs.connect('notify::visible-child-name', tab); tab()
        tv.set_content(self.vs)
        # 2.34: on a phone (narrow window) Journey and My Study move to a bar at the bottom, as phone apps do,
        # so the search keeps room at the top
        self.hb, self.sw = hb, sw
        self.swbar = Adw.ViewSwitcherBar(stack=self.vs); tv.add_bottom_bar(self.swbar)
        self.wide = None
        self.box = self.right
        STUDY.listen(self.refresh)
        # the table of bookmarks comes and goes with the room there is (window resized, pads column dragged)
        def tick(*_):
            if self.get_mapped() and self.wide and self.right_sc.get_width() > 0 and self.table_room() != getattr(self, 'tabled', None) and not getattr(self, 'refilling', False):
                self.refilling = True
                GLib.idle_add(lambda: (self.fill(), setattr(self, 'refilling', False), False)[2])
            return True
        self.add_tick_callback(tick)

    WIDE = 700

    def set_compact(self, c):
        self.hb.set_title_widget(None if c else self.sw)
        self.swbar.set_reveal(c)
        self.q.set_hexpand(c)

    def save_dialog(self, name, write, done_text):
        fd = Gtk.FileDialog(initial_name=name)
        def fin(d, res):
            try:
                f = d.save_finish(res)
            except GLib.Error:
                return
            try:
                msg = write(f.get_path())
            except Exception as e:
                self.win.toast(_('Could not save the file.') + ' ' + str(e)[:80]); return
            if msg:
                d2 = Adw.AlertDialog(heading=_('Saved'), body=msg); d2.add_response('ok', _('OK')); d2.present(self.win)
        fd.save(self.win, None, fin)

    def export_andbible(self):
        """2.17: a file AndBible adds to what it already has (as the website and the Android app make it)"""
        from . import andbible
        if not [r for r in STUDY.records() if not r.get('deleted')]:
            self.win.toast(_('There are no bookmarks in your study to export yet.')); return
        def write(path):
            n, pads, skipped = andbible.build(path)
            return (_('Your AndBible file is ready') + ': %d ' % n + _('bookmarks') + (', %d ' % pads + _('Study Pads') if pads else '') + '.\n\n'
                    + _('To bring them into AndBible, open the file with AndBible (from your Downloads, or share it to AndBible). They are added to what AndBible already has; nothing there is replaced.'))
        self.save_dialog('my-study-andbible.abdb.zip', write, '')

    def export_json(self):
        """the same backup as the website's KJT JSON (it can be restored there and here)"""
        import datetime, json
        def write(path):
            data = {'format': 'KJT Bible Study', 'version': 1, 'exported': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                    'records': [r for r in STUDY.records() if not r.get('deleted')], 'studypads': STORE.pads() or []}
            try:
                from .journey import JOURNEY
                data['reading'] = JOURNEY.S
            except Exception:
                pass
            with open(path + '.part', 'w', encoding='utf-8') as fh:
                json.dump(data, fh, ensure_ascii=False, indent=1)
            import os
            os.replace(path + '.part', path)
            return _('Your backup (bookmarks, notes and reading journey) was downloaded.')
        self.save_dialog('my-kjt-bible-study.json', write, '')

    def do_size_allocate(self, width, height, baseline):
        Gtk.Box.do_size_allocate(self, width, height, baseline)
        if width > 0 and ((width >= self.WIDE) != self.wide or self.table_room() != getattr(self, 'tabled', None)):
            GLib.idle_add(lambda: (self.fill(), False)[1])

    TABLE = 900

    def table_room(self):
        """the bookmarks are a table with columns (date made, changed, Bible, Study Pads) when there is room for it"""
        w = self.right_sc.get_width() or (self.get_width() - (self.sep.get_position() if self.wide else 0))
        return bool(self.wide and w >= self.TABLE)

    def refresh(self):
        if self.get_mapped() or True:
            self.fill()
        # the Journey: bring in what was read on the other devices (not more than twice a minute)
        from .journey import JOURNEY
        if time.time() - getattr(self, 'jsync', 0) > 30:
            self.jsync = time.time(); JOURNEY.sync()

    def clear(self):
        w = self.get_width() or self.win.get_width() - 260
        self.wide = w >= self.WIDE
        self.left_sc.set_visible(self.wide)
        for b in (self.left, self.right):
            while b.get_first_child():
                b.remove(b.get_first_child())

    SORTS = [('bible', 'Bible order'), ('new', 'Newest first'), ('old', 'Oldest first'), ('changed', 'Last changed'), ('color', 'By colour'), ('pad', 'By Study Pad'), ('tr', 'By Bible')]

    def section(self, key, title, count, extra=None, child=None, parent=None):
        """a heading you can click to fold the list away (remembered), with its list under it"""
        open_ = not SET.get('fold_' + key)
        head = Gtk.Box(spacing=6)
        b = Gtk.Button(hexpand=True); b.add_css_class('flat')
        hb = Gtk.Box(spacing=8)
        arrow = Gtk.Image(icon_name='pan-down-symbolic' if open_ else 'pan-end-symbolic'); hb.append(arrow)
        hb.append(Gtk.Label(label=title, xalign=0, css_classes=['heading'], ellipsize=Pango.EllipsizeMode.END))   # 2.36: fits a phone
        hb.append(Gtk.Label(label=str(count), css_classes=['dim-label']))
        b.set_child(hb); b.set_tooltip_text(_('Fold away or show')); head.append(b)
        if extra:
            head.append(extra)
        lb = child or Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE)
        if not child:
            lb.add_css_class('boxed-list')
        rv = Gtk.Revealer(reveal_child=open_, transition_type=Gtk.RevealerTransitionType.SLIDE_DOWN); rv.set_child(lb)
        def flip(*_):
            now = not rv.get_reveal_child(); rv.set_reveal_child(now)
            arrow.set_from_icon_name('pan-down-symbolic' if now else 'pan-end-symbolic'); SET.set('fold_' + key, 0 if now else 1)
        b.connect('clicked', flip)
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6); box.append(head); box.append(rv)
        (parent or self.right).append(box)
        return lb

    def sort_key(self, how):
        from .bible import bible_name
        order = {b: i for i, b in enumerate(OT + NT)}
        cols = {c: i for i, c in enumerate(COLORS)}
        when = lambda r: int(r.get('created') or r.get('updated') or 0)
        bible = lambda r: (order.get(canon(r['book']), 999), int(r['chapter']), int(r.get('verse') or 1))
        return {'bible': bible, 'new': lambda r: -when(r), 'old': when, 'changed': lambda r: -int(r.get('updated') or r.get('created') or 0),
                'color': lambda r: ((STUDY.colors_of(r) or ['~'])[0],) + bible(r),
                'pad': lambda r: ((0, sorted(STUDY.pad_name(t).casefold() for t in r['tags'])[0]) if r.get('tags') else (1, '')) + bible(r),
                'tr': lambda r: (bible_name(r.get('translation') or '').casefold(),) + bible(r)}[how]

    def fill(self):
        self.clear()
        side = self.left if self.wide else self.right
        self.account(side)
        recs = STUDY.records()
        q = self.q.get_text().strip().casefold()
        pads = STUDY.pads()
        # Study Pads: a grid of coloured cards
        grid = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, homogeneous=True, min_children_per_line=1, max_children_per_line=1 if self.wide else 3, column_spacing=8, row_spacing=8)
        # 2.46: the Study Pads sorted as you choose (A–Z, most passages, newest)
        counts = {}
        for r in recs:
            for t in (r.get('tags') or []):
                counts[t] = counts.get(t, 0) + 1
        ps = SET.get('pad_sort', 'name')
        if ps == 'count':
            pads = sorted(pads, key=lambda p: (-counts.get(p['tag'], 0), STUDY.pad_name(p['tag']).casefold()))
        elif ps == 'recent':
            pads = sorted(pads, key=lambda p: -int(p.get('updated') or 0))
        else:
            pads = sorted(pads, key=lambda p: STUDY.pad_name(p['tag']).casefold())
        PS = [('name', 'A–Z'), ('count', 'Most passages'), ('recent', 'Newest')]
        pdd = Gtk.DropDown(model=Gtk.StringList.new([_(t) for _k, t in PS]), valign=Gtk.Align.CENTER, tooltip_text=_('Sort'))
        pdd.set_selected([k for k, _t in PS].index(ps) if ps in dict(PS) else 0)
        pdd.connect('notify::selected', lambda w, _p: (SET.set('pad_sort', PS[w.get_selected()][0]), GLib.idle_add(lambda: (self.fill(), False)[1])))
        self.section('pads', _('Study Pads'), len(pads), pdd, child=grid, parent=side)
        for p in pads:
            grid.append(self.pad_card(p['tag'], sum(1 for r in recs if p['tag'] in (r.get('tags') or []))))
        add = Gtk.Button(); add.add_css_class('card'); add.set_tooltip_text(_('Make a new Study Pad'))
        ab = Gtk.Box(spacing=8, margin_top=8, margin_bottom=8, margin_start=8, margin_end=8, halign=Gtk.Align.CENTER, valign=Gtk.Align.CENTER)
        ab.append(Gtk.Image(icon_name='kjt-plus-symbolic')); ab.append(Gtk.Label(label=_('New Study Pad'))); add.set_child(ab)
        add.connect('clicked', lambda *_: pad_dialog(self.win)); grid.append(add)
        if self.filter:
            allb = Gtk.Button(label=_('Show everything')); allb.add_css_class('pill'); allb.connect('clicked', lambda *_: self.set_filter('')); grid.append(allb)
        # bookmarks and notes, sorted as you choose
        kind = SET.get('study_kind', 'all')
        def words(r):
            rows = STORE.passage(r['translation'], r['book'], int(r['chapter']), int(r.get('verse') or 1), int(r['chapter']), int(r.get('verse_end') or r.get('verse') or 1))
            return ' '.join(strip_tags(x[2]).strip() for x in rows)
        def kind_ok(r):   # 2.46: show only some
            note, pads_ = (r.get('note') or '').strip(), r.get('tags') or []
            return kind == 'all' or (kind == 'notes' and note) or (kind == 'pads' and pads_) or (kind == 'plain' and not note and not pads_)
        shown = [r for r in recs if (not self.filter or self.filter in (r.get('tags') or [])) and kind_ok(r) and
                 (not q or q in (r.get('note') or '').casefold() or q in book_name(r['book'], tr=r.get('translation')).casefold()
                  or any(q in STUDY.pad_name(t).casefold() for t in (r.get('tags') or [])) or q in words(r).casefold())]
        how = SET.get('study_sort', 'new')
        if how not in dict(self.SORTS):
            how = 'new'
        shown.sort(key=self.sort_key(how))
        dd = Gtk.DropDown(model=Gtk.StringList.new([_(t) for _k, t in self.SORTS]), valign=Gtk.Align.CENTER, tooltip_text=_('Sort'))
        dd.set_selected([k for k, _ in self.SORTS].index(how))
        dd.connect('notify::selected', lambda w, _p: (SET.set('study_sort', self.SORTS[w.get_selected()][0]), GLib.idle_add(lambda: (self.fill(), False)[1])))
        KINDS = [('all', 'All'), ('notes', 'With a note'), ('pads', 'In a Study Pad'), ('plain', 'Bookmarks only')]
        kd = Gtk.DropDown(model=Gtk.StringList.new([_(t) for _k, t in KINDS]), valign=Gtk.Align.CENTER, tooltip_text=_('Show'))
        kd.set_selected([k for k, _t in KINDS].index(kind) if kind in dict(KINDS) else 0)
        kd.connect('notify::selected', lambda w, _p: (SET.set('study_kind', KINDS[w.get_selected()][0]), GLib.idle_add(lambda: (self.fill(), False)[1])))
        sbox = Gtk.Box(spacing=4); sbox.append(kd); sbox.append(Gtk.Image(icon_name='kjt-sort-symbolic')); sbox.append(dd)
        title = ('Study Pad: ' + STUDY.pad_name(self.filter)) if self.filter else _('Bookmarks and notes')
        lb = self.section('marks', title, len(shown), sbox)
        if not recs:
            lb.append(Adw.ActionRow(title=_('Nothing yet'), subtitle=_('In the Holy Bible, click a verse, then bookmark it, give it a colour or write a note.')))
        elif not shown:
            lb.append(Adw.ActionRow(title=_('Nothing matches')))
        table = self.tabled = self.table_room()
        if table and shown:
            lb.add_css_class('kjt-mtable'); lb.connect('row-activated', lambda _l, row: getattr(row, 'go', None) and row.go())
            self.groups = [Gtk.SizeGroup(mode=Gtk.SizeGroupMode.HORIZONTAL) for _ in range(6)]
            head = Gtk.ListBoxRow(activatable=False, selectable=False); head.add_css_class('kjt-mtable-head'); head.set_child(self.cells(None)); lb.append(head)
        for r in shown[:500]:
            lb.append(self.trow(r) if table else self.row(r))

    def ref(self, r):
        return ref_of(r)

    @staticmethod
    def day(t):
        t = int(t or 0)
        return time.strftime('%d %b %Y', time.localtime(t)) if t else '—'

    def cells(self, r):
        """one line of the table: colour · passage (with its words or note) · Bible · Study Pads · made · changed"""
        box = Gtk.Box(spacing=12)
        def col(i, w, text, markup=False, expand=False, lines=1):
            lb = Gtk.Label(xalign=0, wrap=lines > 1, lines=lines, ellipsize=Pango.EllipsizeMode.END, hexpand=expand, valign=Gtk.Align.CENTER)
            (lb.set_markup if markup else lb.set_label)(text)
            if w: lb.set_size_request(w, -1); lb.set_max_width_chars(max(6, w // 8))
            else: lb.set_width_chars(18); lb.set_max_width_chars(70)
            self.groups[i].add_widget(lb); box.append(lb); return lb
        if r is None:
            col(0, 22, ''); col(1, 0, _('Passage and note'), expand=True); col(2, 110, _('Bible')); col(3, 140, _('Study Pads')); col(4, 92, _('Made')); col(5, 92, _('Changed'))
            sp = Gtk.Box(); sp.set_size_request(76, -1); box.append(sp)
            return box
        dot = ''.join('<span foreground="%s" size="large">●</span>' % c for c in STUDY.colors_of(r)[:3])
        col(0, 22, dot, markup=True)
        rows = STORE.passage(r['translation'], r['book'], int(r['chapter']), int(r.get('verse') or 1), int(r['chapter']), int(r.get('verse_end') or r.get('verse') or 1))
        text = ' '.join(strip_tags(x[2]).strip() for x in rows)
        note = (r.get('note') or '').strip()
        body = '<b>%s</b>\n%s' % (GLib.markup_escape_text(self.ref(r)), ('📝 ' if note else '') + GLib.markup_escape_text((note or text)[:300]))
        col(1, 0, body, markup=True, expand=True, lines=3)
        from .bible import bible_name
        bn = col(2, 110, bible_name(r.get('translation') or '').split(' · ')[0]); bn.set_tooltip_text(bible_name(r.get('translation') or ''))
        pads = '\n'.join('<span foreground="%s">●</span> %s' % (STUDY.pad_color(t), GLib.markup_escape_text(STUDY.pad_name(t))) for t in (r.get('tags') or [])) or '—'
        col(3, 140, pads, markup=True, lines=3)
        col(4, 92, self.day(r.get('created')))
        col(5, 92, self.day(r.get('updated') or r.get('created')))
        sh = Gtk.Button(icon_name='kjt-share-symbolic', tooltip_text=_('Share'), valign=Gtk.Align.CENTER); sh.add_css_class('flat')
        sh.connect('clicked', lambda *_: self.share(r)); box.append(sh)
        e = Gtk.Button(icon_name='kjt-edit-symbolic', tooltip_text=_('Edit'), valign=Gtk.Align.CENTER); e.add_css_class('flat')
        e.connect('clicked', lambda *_: edit(self.win, r)); box.append(e)
        d = Gtk.Button(icon_name='user-trash-symbolic', tooltip_text=_('Remove'), valign=Gtk.Align.CENTER); d.add_css_class('flat')
        d.connect('clicked', lambda *_: self.remove(r)); box.append(d)
        return box

    def trow(self, r):
        row = Gtk.ListBoxRow(activatable=True); row.set_child(self.cells(r))
        row.set_tooltip_text('Open %s' % self.ref(r))
        row.go = lambda: self.win.open_passage(r['book'], int(r['chapter']), int(r.get('verse') or 1), tr=r.get('translation'), v2=(int(r.get('verse_end') or 0) if int(r.get('chapter_end') or r['chapter']) == int(r['chapter']) else 999))
        return row

    def row(self, r):
        rows = STORE.passage(r['translation'], r['book'], int(r['chapter']), int(r.get('verse') or 1), int(r['chapter']), int(r.get('verse_end') or r.get('verse') or 1))
        text = ' '.join(strip_tags(x[2]).strip() for x in rows)
        sub = GLib.markup_escape_text(((r.get('note') or '').strip() or text)[:300])
        if r.get('tags'):
            sub = '  '.join('<span foreground="%s">●</span> %s' % (STUDY.pad_color(t), GLib.markup_escape_text(STUDY.pad_name(t))) for t in r['tags']) + '\n' + sub
        made = self.day(r.get('created')); ch = self.day(r.get('updated'))
        from .bible import bible_name
        bn = bible_name(r.get('translation') or '').split(' · ')[0]
        sub = '<small>%s%s%s</small>\n' % (GLib.markup_escape_text(_('Made') + ' ' + made), GLib.markup_escape_text(' · ' + _('Changed').lower() + ' ' + ch) if r.get('updated') and ch != made else '', GLib.markup_escape_text(' · ' + bn) if bn else '') + sub
        row = Adw.ActionRow(title=GLib.markup_escape_text(self.ref(r)), subtitle=sub, activatable=True)
        row.set_subtitle_lines(4)
        if STUDY.colors_of(r):
            dot = Gtk.Label(); dot.set_markup(''.join('<span foreground="%s" size="large">●</span>' % c for c in STUDY.colors_of(r)[:3])); row.add_prefix(dot)
        sh = Gtk.Button(icon_name='kjt-share-symbolic', tooltip_text=_('Share'), valign=Gtk.Align.CENTER); sh.add_css_class('flat')
        sh.connect('clicked', lambda *_: self.share(r)); row.add_suffix(sh)
        e = Gtk.Button(icon_name='kjt-edit-symbolic', tooltip_text=_('Edit'), valign=Gtk.Align.CENTER); e.add_css_class('flat')
        e.connect('clicked', lambda *_: edit(self.win, r)); row.add_suffix(e)
        d = Gtk.Button(icon_name='user-trash-symbolic', tooltip_text=_('Remove'), valign=Gtk.Align.CENTER); d.add_css_class('flat')
        d.connect('clicked', lambda *_: self.remove(r)); row.add_suffix(d)
        row.connect('activated', lambda *_: self.win.open_passage(r['book'], int(r['chapter']), int(r.get('verse') or 1), tr=r.get('translation'), v2=(int(r.get('verse_end') or 0) if int(r.get('chapter_end') or r['chapter']) == int(r['chapter']) else 999)))
        return row

    def pad_card(self, tag, n):
        col = STUDY.pad_color(tag); h = paint(None, col)
        card = Gtk.Box(spacing=10); card.add_css_class('card'); card.add_css_class('kjt-padcard'); card.add_css_class('kjt-pb-' + h)
        if self.filter == tag:
            card.add_css_class('kjt-pad-on')
        p = STUDY.pad(tag) or {}
        badge = Gtk.Label(label=p.get('icon') or STUDY.pad_name(tag)[:1].upper(), valign=Gtk.Align.CENTER); badge.add_css_class('kjt-padbadge'); badge.add_css_class('kjt-pc-' + h)
        card.append(badge)
        txt = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, hexpand=True, valign=Gtk.Align.CENTER)
        nm = Gtk.Label(label=STUDY.pad_name(tag), xalign=0, ellipsize=Pango.EllipsizeMode.END, css_classes=['heading']); nm.set_tooltip_text(STUDY.pad_name(tag)); txt.append(nm)
        txt.append(Gtk.Label(label='%d passage%s' % (n, '' if n == 1 else 's'), xalign=0, css_classes=['dim-label', 'caption']))
        card.append(txt)
        sh = Gtk.Button(icon_name='kjt-share-symbolic', tooltip_text=_('Share'), valign=Gtk.Align.CENTER); sh.add_css_class('flat'); sh.add_css_class('circular')
        sh.connect('clicked', lambda *_: self.share_pad(tag)); card.append(sh)
        e = Gtk.Button(icon_name='kjt-edit-symbolic', tooltip_text=_('Name, colour, emoji'), valign=Gtk.Align.CENTER); e.add_css_class('flat'); e.add_css_class('circular')
        e.connect('clicked', lambda *_: pad_dialog(self.win, tag)); card.append(e)
        g = Gtk.GestureClick(); g.connect('released', lambda *_: self.set_filter('' if self.filter == tag else tag)); txt.add_controller(g)
        gb = Gtk.GestureClick(); gb.connect('released', lambda *_: self.set_filter('' if self.filter == tag else tag)); badge.add_controller(gb)
        card.set_tooltip_text(_('Click to show only this Study Pad'))
        card.set_cursor(Gdk.Cursor.new_from_name('pointer'))
        return card

    def words_of(self, r):
        rows = STORE.passage(r['translation'], r['book'], int(r['chapter']), int(r.get('verse') or 1), int(r['chapter']), int(r.get('verse_end') or r.get('verse') or 1))
        return ' '.join(strip_tags(x[2]).strip() for x in rows)

    def share(self, r):
        """2.46: a bookmark or note: copy, a picture, email or a text message"""
        from . import share
        from .bible import bible_name
        txt, note = self.words_of(r), (r.get('note') or '').strip()
        ref = '%s (%s)' % (self.ref(r), bible_name(r.get('translation') or '').split(' · ')[0])
        share.menu(self.win, '“%s”\n— %s%s\n\nbiblecorner.com' % (txt, ref, ('\n\n' + note) if note else ''), txt, ref)

    def share_pad(self, tag):
        """2.46: a whole Study Pad, as text"""
        from . import share
        out = ['🗂 ' + STUDY.pad_name(tag)]
        for r in STUDY.records():
            if tag in (r.get('tags') or []):
                out.append('\n“%s”\n— %s' % (self.words_of(r), self.ref(r)))
                if (r.get('note') or '').strip():
                    out.append('✎ ' + r['note'].strip())
        out.append('\nbiblecorner.com')
        share.menu(self.win, '\n'.join(out), None, STUDY.pad_name(tag))

    def rename(self, tag):
        d = Adw.AlertDialog(heading=_('Rename the Study Pad'))
        en = Gtk.Entry(text=STUDY.pad_name(tag), activates_default=True); d.set_extra_child(en)
        d.add_response('cancel', 'Cancel'); d.add_response('ok', 'Rename'); d.set_response_appearance('ok', Adw.ResponseAppearance.SUGGESTED); d.set_default_response('ok')
        d.connect('response', lambda _d, res: STUDY.rename_pad(tag, en.get_text()) if res == 'ok' else None); d.present(self.win)

    def remove(self, r):
        dlg = Adw.AlertDialog(heading=_('Remove this?'), body=self.ref(r) + ((' — ' + r['note'][:120]) if r.get('note') else ''))
        dlg.add_response('cancel', 'Cancel'); dlg.add_response('del', 'Remove'); dlg.set_response_appearance('del', Adw.ResponseAppearance.DESTRUCTIVE)
        dlg.connect('response', lambda d, res: STUDY.delete(r) if res == 'del' else None); dlg.present(self.win)

    def set_filter(self, t):
        self.filter = t; self.fill()

    # the account
    def account(self, parent=None):
        i = STORE.kv('info') or {}
        u = i.get('user')
        g = Adw.PreferencesGroup(title=_('My KJT account'))
        if u:
            when = STORE.kv('synced')
            mine = getattr(self, 'me', None) if getattr(self, 'me', None) and self.me.get('id') == u.get('id') else None
            row = Adw.ActionRow(title=GLib.markup_escape_text((mine or u).get('name') or 'Signed in'),
                                subtitle=_('Kept in step with knowingjesus.today%s') % (time.strftime(' · last %d %b %H:%M', time.localtime(when)) if when else ''))
            # 2.24: the avatar (click it to change it)
            avb = Gtk.Button(valign=Gtk.Align.CENTER, tooltip_text=_('Change my avatar')); avb.add_css_class('flat'); avb.add_css_class('circular')
            avb.set_child(self.avatar((mine or {}).get('avatar'), (mine or u).get('name'), 44))
            avb.connect('clicked', lambda *_: self.avatar_dialog()); row.add_prefix(avb)
            out = Gtk.Button(label=_('Sign out'), valign=Gtk.Align.CENTER); out.connect('clicked', lambda *_: self.sign_out()); row.add_suffix(out)
            g.add(row)
            if not mine and not getattr(self, 'me_asked', False):
                self.me_asked = True
                from . import accounts as A
                def got(m):
                    if isinstance(m, dict):
                        self.me = m; self.fill()
                run_bg(lambda: (A.remember(), A.fetch_photo((A.me() or {}).get('avatar')), A.me())[2], got)
            waiting = len(STORE.outbox())
            if waiting:
                g.add(Adw.ActionRow(title=_('%d changes wait for the internet') % waiting, subtitle=_('They are sent by themselves as soon as the website can be reached.')))
        else:
            row = Adw.ActionRow(title=_('Not signed in'), subtitle=_('Your bookmarks and notes stay on this computer. Sign in to keep them in step with My KJT on the website and your phone.'))
            row.set_subtitle_lines(4)
            b = Gtk.Button(label=_('Sign in'), valign=Gtk.Align.CENTER); b.add_css_class('suggested-action'); b.connect('clicked', lambda *_: self.sign_in_dialog()); row.add_suffix(b)
            g.add(row)
        (parent or self.right).append(g)
        self.accounts_group(parent or self.right, (u or {}).get('id'))

    # 2.24: the accounts on this computer
    def avatar(self, av, name, size):
        from . import accounts as A
        a = Adw.Avatar(size=size, text=name or '', show_initials=True)
        try:
            t = A.texture(av, name, size * 2)
            if t:
                a.set_custom_image(t)
        except Exception:
            pass
        return a

    def accounts_group(self, parent, me_id):
        from . import accounts as A
        others = [a for a in A.load() if a.get('id') != me_id]
        g = Adw.PreferencesGroup(title=_('Accounts on this computer'), description=_('Each person signs in once; then one click switches. Only a switch pass is kept on this computer (in its keyring), never a password.'))
        for a in others:
            row = Adw.ActionRow(title=GLib.markup_escape_text(a.get('name') or _('My study')))
            row.add_prefix(self.avatar(a.get('avatar'), a.get('name'), 36))
            sw = Gtk.Button(label=_('Switch'), valign=Gtk.Align.CENTER); sw.add_css_class('suggested-action'); sw.connect('clicked', lambda *_x, a=a: self.switch_to(a)); row.add_suffix(sw)
            x = Gtk.Button(icon_name='user-trash-symbolic', valign=Gtk.Align.CENTER, tooltip_text=_('Forget on this computer')); x.add_css_class('flat')
            x.connect('clicked', lambda *_x, a=a: self.forget_acct(a)); row.add_suffix(x)
            g.add(row)
        add = Adw.ButtonRow(title='＋ ' + _('Add another account')) if hasattr(Adw, 'ButtonRow') else None
        if add is None:
            add = Adw.ActionRow(title='＋ ' + _('Add another account'), activatable=True)
            add.connect('activated', lambda *_x: self.add_account())
        else:
            add.connect('activated', lambda *_x: self.add_account())
        g.add(add)
        parent.append(g)

    def switch_to(self, a):
        from . import accounts as A
        if not NET.online():
            self.win.toast(_('This needs the internet. Try again when you are connected.')); return
        def go():
            self.win.toast(_('Opening…'))
            def work():
                if STORE.outbox():
                    STUDY.flush()
                if STORE.outbox():
                    return 'waiting'      # never sent as the other person: they wait for this account
                return A.switch(a)
            def done(r):
                if r == 'ok':
                    self.me = None; self.me_asked = False
                    STUDY.sync(lambda _x: (self.fill(), self.win.toast(_('Welcome') + ', ' + (a.get('name') or ''))))
                elif r == 'waiting':
                    self.win.toast(_('Some changes are still waiting to be sent. Try again in a moment, with the internet.'))
                elif r == 'expired':
                    self.win.toast(_('This account must sign in again on this computer (its password was changed, or it was not used for six months).')); self.fill()
                else:
                    self.win.toast(_('Could not switch now. Please try again.'))
            run_bg(work, done)
        go()

    def forget_acct(self, a):
        from . import accounts as A
        d = Adw.AlertDialog(heading=_('Forget on this computer'), body=_('Forget this account on this computer? Its study stays safe on the website.'))
        d.add_response('cancel', _('Cancel')); d.add_response('go', _('Forget on this computer')); d.set_response_appearance('go', Adw.ResponseAppearance.DESTRUCTIVE)
        d.connect('response', lambda _d, r: run_bg(lambda: A.forget(a), lambda _x: self.fill()) if r == 'go' else None); d.present(self.win)

    def add_account(self):
        from . import accounts as A
        if not (STORE.kv('info') or {}).get('user'):
            self.sign_in_dialog(); return
        def work():
            A.remember()
            if STORE.outbox():
                STUDY.flush()
            return not STORE.outbox()
        def done(ok):
            if ok is not True:
                self.win.toast(_('Some changes are still waiting to be sent. Try again in a moment, with the internet.')); return
            STUDY.sign_out(lambda: (self.fill(), self.sign_in_dialog()))
        run_bg(work, done)

    def avatar_dialog(self):
        from . import accounts as A
        m = getattr(self, 'me', None)
        if not m:
            self.win.toast(_('This needs the internet. Try again when you are connected.')); return
        d = Adw.Dialog(title=_('My avatar'), content_width=460)
        tv = Adw.ToolbarView(); tv.add_top_bar(Adw.HeaderBar()); d.set_child(tv)
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10, margin_top=10, margin_bottom=16, margin_start=16, margin_end=16)
        sc = Gtk.ScrolledWindow(hscrollbar_policy=Gtk.PolicyType.NEVER, propagate_natural_height=True, max_content_height=640); sc.set_child(box); tv.set_content(sc)
        prev = Gtk.Box(halign=Gtk.Align.CENTER); box.append(prev)
        msg = Gtk.Label(wrap=True); msg.add_css_class('dim-label')
        state = {'m': m}
        def show():
            while prev.get_first_child():
                prev.remove(prev.get_first_child())
            prev.append(self.avatar(state['m'].get('avatar'), state['m'].get('name'), 96))
        def set_(fields, photo=None):
            msg.set_label(_('Saving…'))
            def work():
                r = A.post(dict({'op': 'avatar'}, **fields), photo)
                if r.get('success'):
                    A.fetch_photo(r['data'].get('avatar')); A.remember(r['data'])
                return r
            def done(r):
                if isinstance(r, dict) and r.get('success'):
                    state['m'] = dict(state['m'], **r['data']); self.me = state['m']; show(); msg.set_label('✓ ' + _('Saved')); self.fill()
                else:
                    code = ((r or {}).get('data') or {}).get('code') if isinstance(r, dict) else ''
                    msg.set_label(_('Choose a picture (JPEG, PNG or WebP, under 8 MB).') if code in ('type', 'file') else _('Could not save now. Please try again.'))
            run_bg(work, done)
        show()
        h = Gtk.Label(label=_('A picture'), xalign=0); h.add_css_class('heading'); box.append(h)
        fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=10, min_children_per_line=5, column_spacing=4, row_spacing=4)
        for k, sym in (m.get('symbols') or {}).items():
            b = Gtk.Button(label=sym); b.add_css_class('flat'); b.add_css_class('kjt-avsym')
            b.connect('clicked', lambda *_x, k=k: set_({'t': 'sym', 'v': k, 'c': (state['m'].get('avatar') or {}).get('c', '')})); fb.append(b)
        box.append(fb)
        row = Gtk.Box(spacing=8, homogeneous=True)
        ph = Gtk.Button(label='📷 ' + _('Choose a photo'))
        def pick(*_x):
            fd = Gtk.FileDialog(title=_('Choose a photo'))
            flt = Gtk.FileFilter(); flt.set_name(_('Pictures')); [flt.add_mime_type(t) for t in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')]
            ls = Gio.ListStore.new(Gtk.FileFilter); ls.append(flt); fd.set_filters(ls)
            def chosen(dlg, res):
                try:
                    f = dlg.open_finish(res)
                except Exception:
                    return
                if f and f.get_path():
                    set_({'t': 'photo', 'c': (state['m'].get('avatar') or {}).get('c', '')}, f.get_path())
            fd.open(self.win, None, chosen)
        ph.connect('clicked', pick); row.append(ph)
        nb = Gtk.Button(label=_('Just my first letter')); nb.connect('clicked', lambda *_x: set_({'t': 'none', 'c': (state['m'].get('avatar') or {}).get('c', '')})); row.append(nb)
        box.append(row)
        h2 = Gtk.Label(label=_('A colour'), xalign=0); h2.add_css_class('heading'); box.append(h2)
        cb = Gtk.Box(spacing=6)
        for c in m.get('colours') or []:
            b = Gtk.Button(); b.set_size_request(32, 32); b.add_css_class('circular')
            pr = Gtk.CssProvider(); css = 'button { background: %s; min-width: 32px; min-height: 32px; }' % c
            pr.load_from_string(css) if hasattr(pr, 'load_from_string') else pr.load_from_data(css, -1)
            b.get_style_context().add_provider(pr, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
            b.connect('clicked', lambda *_x, c=c: set_({'t': 'colour', 'c': c})); cb.append(b)
        box.append(cb); box.append(msg)
        d.present(self.win)

    def sign_in_dialog(self, how=None):
        how = how or SET.get('signin_how', 'key')
        d = Adw.AlertDialog(heading=_('Sign in to My KJT'), body=_('Open your study with your study key, or with the name (or e-mail) and password of your account on knowingjesus.today.'))
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        tabs = Gtk.Box(halign=Gtk.Align.FILL, homogeneous=True); tabs.add_css_class('linked')
        t_key = Gtk.ToggleButton(label=_('🔑 Study key'), active=how == 'key'); t_pw = Gtk.ToggleButton(label=_('Name and password'), group=t_key, active=how != 'key')
        tabs.append(t_key); tabs.append(t_pw); box.append(tabs)
        for t in (t_key, t_pw):
            t.get_child().set_ellipsize(Pango.EllipsizeMode.END)   # 2.38: the window fits a phone
        # 2.38: two parts shown one at a time (a Stack kept the wider size and pushed the window past a phone's screen)
        stack = Gtk.Box(orientation=Gtk.Orientation.VERTICAL)
        # the study key
        kb = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        key = Adw.PasswordEntryRow(title=_('Your study key  (KJT-XXXX-XXXX-XXXX-XXXX)'))
        lbl_shorten(key)
        kl = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE); kl.add_css_class('boxed-list'); kl.append(key); kb.append(kl)
        kb.append(wlink(NET_SITE() + '/my-kjt/', _('Lost your study key? Get a new one on the website')))
        stack.append(kb)
        # name and password
        pb = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        lg = Adw.EntryRow(title=_('Name or e-mail')); pw = Adw.PasswordEntryRow(title=_('Password'))
        lb = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE); lb.add_css_class('boxed-list'); lb.append(lg); lb.append(pw); pb.append(lb)
        pb.append(wlink(NET_SITE() + '/wp-login.php?action=lostpassword', _('Forgot your password?')))
        stack.append(pb)
        box.append(stack)
        box.append(wlink(NET_SITE() + '/my-kjt/', _('No study yet? Make one on the website (a study key needs no e-mail)')))
        d.set_extra_child(box)
        d.add_response('cancel', 'Cancel'); d.add_response('go', 'Sign in'); d.set_response_appearance('go', Adw.ResponseAppearance.SUGGESTED)
        d.set_default_response('go'); d.set_close_response('cancel')
        def mode():
            return 'key' if t_key.get_active() else 'pw'
        def check(*_):
            if mode() == 'key':
                raw = ''.join(ch for ch in key.get_text().upper() if ch.isalnum())
                ok = len(raw) in (16, 19)
            else:
                ok = bool(lg.get_text().strip() and pw.get_text())
            d.set_response_enabled('go', ok)
        def switch(*_):
            kb.set_visible(mode() == 'key'); pb.set_visible(mode() == 'pw'); SET.set('signin_how', mode()); check()
            GLib.idle_add(lambda: ((key if mode() == 'key' else lg).grab_focus(), False)[1])
        t_key.connect('toggled', switch); t_pw.connect('toggled', switch)
        for e in (key, lg, pw):
            e.connect('changed', check)
        for e in (key, pw):
            e.connect('entry-activated', lambda *_: d.get_response_enabled('go') and (d.close(), go()))
        def go():
            if not NET.online():
                self.win.toast('Signing in needs the internet'); return
            self.win.toast('Signing in…')
            if mode() == 'key':
                STUDY.sign_in('', '', done, key=key.get_text().strip())
            else:
                STUDY.sign_in(lg.get_text().strip(), pw.get_text(), done)
        def done(res):
            if res.get('ok'):
                self.win.toast('Welcome%s. Your study is now kept in step with My KJT.' % ((', ' + res['name']) if res.get('name') else ''))
                self.fill()
                from . import accounts as A
                self.me = None; self.me_asked = False
                run_bg(lambda: A.remember(), lambda _x: self.fill())
            else:
                wrong = 'That study key was not recognised. Check it and try again.' if mode() == 'key' else 'The name or the password is not right.'
                why = {'wrong': wrong, 'limit': 'Too many tries. Please wait an hour and try again.', 'net': 'The website could not be reached.'}.get(res.get('why'), 'Signing in did not work. Please try again.')
                self.win.toast(why)
                GLib.timeout_add(400, lambda: (self.sign_in_dialog(mode()), False)[1])
        d.connect('response', lambda _d, res: go() if res == 'go' else None)
        switch()
        d.present(self.win)

    def sign_out(self):
        d = Adw.AlertDialog(heading=_('Sign out?'), body=_('Your study stays safe in My KJT on the website. This computer forgets it until you sign in again.'))
        d.add_response('cancel', 'Cancel'); d.add_response('out', 'Sign out'); d.set_response_appearance('out', Adw.ResponseAppearance.DESTRUCTIVE)
        def resp(_d, res):
            if res == 'out':
                if STORE.outbox():
                    STUDY.flush()
                STUDY.sign_out(lambda: (self.fill(), self.win.toast('Signed out')))
        d.connect('response', resp); d.present(self.win)

    def sync(self):
        if not (STORE.kv('info') or {}).get('user'):
            self.sign_in_dialog(); return
        self.sync_btn.set_sensitive(False)
        def done(res):
            self.sync_btn.set_sensitive(True)
            self.win.toast('In step with My KJT' if res == 'ok' else ('Not signed in' if res == 'guest' else 'The website could not be reached'))
            self.fill()
        STUDY.sync(done)
        from .journey import JOURNEY
        JOURNEY.sync()


_PAINTED = set()


def paint(widget, hexcol):
    """give a widget a colour of its own (a Study Pad's colour)"""
    h = (hexcol or '#999999').lstrip('#').lower()
    if h not in _PAINTED:
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
        fg = '#1d1d1d' if (r * 299 + g * 587 + b * 114) / 1000 > 150 else '#ffffff'
        css = '.kjt-pc-%s { background-color: #%s; color: %s; } .kjt-padcard.kjt-pb-%s { border-left-color: #%s; }' % (h, h, fg, h, h)
        pr = Gtk.CssProvider(); pr.load_from_string(css) if hasattr(pr, 'load_from_string') else pr.load_from_data(css, -1)
        Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), pr, Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION)
        _PAINTED.add(h)
    return h


def pad_dialog(win, tag=None, done=None):
    """make a Study Pad, or change its name, colour and emoji; or remove it"""
    p = STUDY.pad(tag) if tag else None
    d = Adw.AlertDialog(heading=_('Study Pad') if tag else 'A new Study Pad')
    box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
    name = Gtk.Entry(text=STUDY.pad_name(tag) if tag else '', placeholder_text=_('Its name'), activates_default=True); box.append(name)
    icon = Gtk.Entry(text=(p or {}).get('icon', ''), placeholder_text=_('An emoji for it, if you like (optional)'), max_length=4); box.append(icon)
    box.append(Gtk.Label(label=_('Colour'), xalign=0, css_classes=['heading'], margin_top=4))
    pick = {'c': STUDY.pad_color(tag) if tag else STUDY.free_color()}
    fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=6, min_children_per_line=6, column_spacing=6, row_spacing=6)
    sw = {}
    def choose(c):
        pick['c'] = c
        for k, b in sw.items():
            (b.add_css_class if k == c else b.remove_css_class)('kjt-dot-on')
    for c in STUDY.PALETTE:
        b = Gtk.Button(tooltip_text=c, halign=Gtk.Align.CENTER); b.add_css_class('kjt-swatch'); b.add_css_class('kjt-pc-' + paint(b, c))
        b.connect('clicked', lambda _b, c=c: choose(c)); fb.append(b); sw[c] = b
    box.append(fb)
    try:
        any_c = Gtk.ColorDialogButton(dialog=Gtk.ColorDialog(with_alpha=False), halign=Gtk.Align.START, tooltip_text=_('Any colour'))
        rgba = Gdk.RGBA(); rgba.parse(pick['c']); any_c.set_rgba(rgba)
        def other(btn, _p):
            c = btn.get_rgba(); choose('#%02x%02x%02x' % (int(c.red * 255), int(c.green * 255), int(c.blue * 255)))
        any_c.connect('notify::rgba', other)
        row = Gtk.Box(spacing=8); row.append(Gtk.Label(label=_('Or any colour:'))); row.append(any_c); box.append(row)
    except Exception:
        pass
    choose(pick['c'])
    d.set_extra_child(box)
    d.add_response('cancel', 'Cancel')
    if tag:
        d.add_response('delete', 'Remove'); d.set_response_appearance('delete', Adw.ResponseAppearance.DESTRUCTIVE)
    d.add_response('save', 'Save' if tag else 'Make it'); d.set_response_appearance('save', Adw.ResponseAppearance.SUGGESTED)
    d.set_default_response('save'); d.set_close_response('cancel')
    def resp(_d, res):
        if res == 'save':
            if tag:
                STUDY.update_pad(tag, name=name.get_text(), color=pick['c'], icon=icon.get_text())
            elif name.get_text().strip():
                t = STUDY.new_pad(name.get_text(), color=pick['c'])
                if icon.get_text().strip():
                    STUDY.update_pad(t, icon=icon.get_text())
            if done:
                done()
        elif res == 'delete':
            n = sum(1 for r in STUDY.records() if tag in (r.get('tags') or []))
            c = Adw.AlertDialog(heading=_('Remove “%s”?') % STUDY.pad_name(tag),
                                body=_('The Study Pad goes away. Its %d bookmarks stay, without it.') % n if n else 'The Study Pad goes away.')
            c.add_response('cancel', 'Keep it'); c.add_response('go', 'Remove'); c.set_response_appearance('go', Adw.ResponseAppearance.DESTRUCTIVE)
            c.connect('response', lambda _c, r2: (STUDY.delete_pad(tag), done and done()) if r2 == 'go' else None); c.present(win)
    d.connect('response', resp); d.present(win)
    GLib.idle_add(lambda: (name.grab_focus(), False)[1])


def ref_of(r):
    v2 = r.get('verse_end'); c1 = int(r['chapter']); c2 = int(r.get('chapter_end') or c1)
    end = ('–%d:%d' % (c2, int(v2)) if c2 != c1 else '–%d' % int(v2)) if v2 and int(v2) else ''
    return '%s %d:%d%s' % (book_name(r['book'], tr=r.get('translation')), c1, int(r.get('verse') or 1), end)


def edit(win, r, focus='note'):
    """edit one bookmark in one place: its colour, its note and its Study Pads; or remove it"""
    r = next((x for x in STUDY.records() if x['id'] == r['id']), r)
    d = Adw.AlertDialog(heading='Edit', body=ref_of(r))
    box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
    # 2.15: no colour of its own: the colour is its Study Pads' colour
    chosen = {'c': None}
    # note
    box.append(Gtk.Label(label=_('Note'), xalign=0, css_classes=['heading']))
    tvw = Gtk.TextView(wrap_mode=Gtk.WrapMode.WORD_CHAR, top_margin=8, bottom_margin=8, left_margin=8, right_margin=8)
    tvw.get_buffer().set_text(r.get('note') or '')
    sc = Gtk.ScrolledWindow(min_content_height=130, min_content_width=240); sc.set_child(tvw); sc.add_css_class('card'); box.append(sc)
    # Study Pads
    box.append(Gtk.Label(label=_('Study Pads'), xalign=0, css_classes=['heading'], margin_top=4))
    fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=2, min_children_per_line=1, column_spacing=6)
    checks = {}
    for p in STUDY.pads():
        cb = Gtk.CheckButton(label=STUDY.pad_label(p['tag'])); cb.set_active(p['tag'] in (r.get('tags') or [])); fb.append(cb); checks[p['tag']] = cb
    if checks:
        box.append(fb)
    new = Gtk.Entry(placeholder_text=_('A new Study Pad: type its name')); box.append(new)
    d.set_extra_child(box)
    d.add_response('cancel', 'Cancel'); d.add_response('delete', 'Remove bookmark'); d.set_response_appearance('delete', Adw.ResponseAppearance.DESTRUCTIVE)
    d.add_response('save', 'Save'); d.set_response_appearance('save', Adw.ResponseAppearance.SUGGESTED)
    d.set_default_response('save'); d.set_close_response('cancel')
    def resp(_d, res):
        if res == 'save':
            b = tvw.get_buffer(); note = b.get_text(b.get_start_iter(), b.get_end_iter(), False).strip()[:5000]
            tags = [t for t, cb in checks.items() if cb.get_active()]
            if new.get_text().strip():
                tags.append(STUDY.new_pad(new.get_text()))
            cur = next((x for x in STUDY.records() if x['id'] == r['id']), r)
            if cur.get('color'):
                STUDY.set_color(cur, None); cur = next((x for x in STUDY.records() if x['id'] == r['id']), cur)
            if note != (cur.get('note') or '').strip():
                STUDY.set_note(cur, note); cur = dict(cur, note=note)
            if sorted(tags) != sorted(cur.get('tags') or []):
                STUDY.set_tags(cur, tags)
            win.toast('Saved: ' + ref_of(r))
        elif res == 'delete':
            keep = dict(r); STUDY.delete(r)
            def undo():
                n = STUDY.save(keep['translation'], keep['book'], int(keep['chapter']), int(keep.get('verse') or 1), int(keep.get('verse_end') or 0), color=keep.get('color'))
                if keep.get('note'):
                    STUDY.set_note(n, keep['note']); n = dict(n, note=keep['note'])
                if keep.get('tags'):
                    STUDY.set_tags(n, keep['tags'])
            win.toast('Removed: ' + ref_of(r), undo=undo)
    d.connect('response', resp); d.present(win)
    GLib.idle_add(lambda: ((new if focus == 'pads' else tvw).grab_focus(), False)[1])


def NET_SITE():
    from .core import SITE
    return SITE


def wlink(uri, text):
    """2.38: a link whose text goes onto more lines when there is no room (the sign-in window on a phone)"""
    b = Gtk.LinkButton(uri=uri, label=text)
    ch = b.get_child()
    if isinstance(ch, Gtk.Label):
        ch.set_wrap(True); ch.set_justify(Gtk.Justification.CENTER); ch.set_max_width_chars(40)
    return b


def lbl_shorten(row):
    """2.38: the title of an entry row shortens with … instead of widening its window"""
    def walk(w):
        if isinstance(w, Gtk.Label):
            w.set_ellipsize(Pango.EllipsizeMode.END)
        k = w.get_first_child()
        while k:
            walk(k); k = k.get_next_sibling()
    walk(row)
