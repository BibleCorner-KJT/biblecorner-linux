"""My Study: bookmarks, highlights, notes and Study Pads; and your My KJT account (signing in here, in the app)."""
import time
from gi.repository import Gtk, Adw, Gdk, GLib, Pango
from .core import STORE, SET, NET, OT, NT, info, book_name, strip_tags, canon
from .study import STUDY, COLORS


class StudyPage(Gtk.Box):
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win
        self.filter = ''
        tv = Adw.ToolbarView(); tv.set_vexpand(True); self.append(tv)
        hb = Adw.HeaderBar(); tv.add_top_bar(hb); win.sidebar_button(hb)
        hb.set_title_widget(Adw.WindowTitle(title='My Study'))
        self.sync_btn = Gtk.Button(icon_name='view-refresh-symbolic', tooltip_text='Bring in step with My KJT now'); self.sync_btn.connect('clicked', lambda *_: self.sync())
        hb.pack_end(self.sync_btn)
        self.q = Gtk.SearchEntry(placeholder_text='Search your notes'); self.q.connect('search-changed', lambda *_: self.fill())
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
        tv.set_content(self.sep)
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
        hb.append(Gtk.Label(label=title, xalign=0, css_classes=['heading']))
        hb.append(Gtk.Label(label=str(count), css_classes=['dim-label']))
        b.set_child(hb); b.set_tooltip_text('Fold away or show'); head.append(b)
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
                'color': lambda r: (cols.get(r.get('color'), 99),) + bible(r),
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
        self.section('pads', 'Study Pads', len(pads), child=grid, parent=side)
        for p in pads:
            grid.append(self.pad_card(p['tag'], sum(1 for r in recs if p['tag'] in (r.get('tags') or []))))
        add = Gtk.Button(); add.add_css_class('card'); add.set_tooltip_text('Make a new Study Pad')
        ab = Gtk.Box(spacing=8, margin_top=8, margin_bottom=8, margin_start=8, margin_end=8, halign=Gtk.Align.CENTER, valign=Gtk.Align.CENTER)
        ab.append(Gtk.Image(icon_name='kjt-plus-symbolic')); ab.append(Gtk.Label(label='New Study Pad')); add.set_child(ab)
        add.connect('clicked', lambda *_: pad_dialog(self.win)); grid.append(add)
        if self.filter:
            allb = Gtk.Button(label='Show everything'); allb.add_css_class('pill'); allb.connect('clicked', lambda *_: self.set_filter('')); grid.append(allb)
        # bookmarks and notes, sorted as you choose
        shown = [r for r in recs if (not self.filter or self.filter in (r.get('tags') or [])) and
                 (not q or q in (r.get('note') or '').casefold() or q in book_name(r['book'], tr=r.get('translation')).casefold()
                  or any(q in STUDY.pad_name(t).casefold() for t in (r.get('tags') or [])))]
        how = SET.get('study_sort', 'new')
        if how not in dict(self.SORTS):
            how = 'new'
        shown.sort(key=self.sort_key(how))
        dd = Gtk.DropDown(model=Gtk.StringList.new([t for _, t in self.SORTS]), valign=Gtk.Align.CENTER, tooltip_text='Sort')
        dd.set_selected([k for k, _ in self.SORTS].index(how))
        dd.connect('notify::selected', lambda w, _p: (SET.set('study_sort', self.SORTS[w.get_selected()][0]), GLib.idle_add(lambda: (self.fill(), False)[1])))
        sbox = Gtk.Box(spacing=4); sbox.append(Gtk.Image(icon_name='kjt-sort-symbolic')); sbox.append(dd)
        title = ('Study Pad: ' + STUDY.pad_name(self.filter)) if self.filter else 'Bookmarks and notes'
        lb = self.section('marks', title, len(shown), sbox)
        if not recs:
            lb.append(Adw.ActionRow(title='Nothing yet', subtitle='In the Holy Bible, click a verse, then bookmark it, give it a colour or write a note.'))
        elif not shown:
            lb.append(Adw.ActionRow(title='Nothing matches'))
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
            col(0, 22, ''); col(1, 0, 'Passage and note', expand=True); col(2, 110, 'Bible'); col(3, 140, 'Study Pads'); col(4, 92, 'Made'); col(5, 92, 'Changed')
            sp = Gtk.Box(); sp.set_size_request(76, -1); box.append(sp)
            return box
        dot = '<span foreground="%s" size="x-large">●</span>' % COLORS[r['color']] if r.get('color') in COLORS else ''
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
        e = Gtk.Button(icon_name='kjt-edit-symbolic', tooltip_text='Edit: colour, note, Study Pads', valign=Gtk.Align.CENTER); e.add_css_class('flat')
        e.connect('clicked', lambda *_: edit(self.win, r)); box.append(e)
        d = Gtk.Button(icon_name='user-trash-symbolic', tooltip_text='Remove', valign=Gtk.Align.CENTER); d.add_css_class('flat')
        d.connect('clicked', lambda *_: self.remove(r)); box.append(d)
        return box

    def trow(self, r):
        row = Gtk.ListBoxRow(activatable=True); row.set_child(self.cells(r))
        row.set_tooltip_text('Open %s' % self.ref(r))
        row.go = lambda: self.win.open_passage(r['book'], int(r['chapter']), int(r.get('verse') or 1), tr=r.get('translation'))
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
        sub = '<small>%s%s%s</small>\n' % (GLib.markup_escape_text('Made ' + made), GLib.markup_escape_text(' · changed ' + ch) if r.get('updated') and ch != made else '', GLib.markup_escape_text(' · ' + bn) if bn else '') + sub
        row = Adw.ActionRow(title=GLib.markup_escape_text(self.ref(r)), subtitle=sub, activatable=True)
        row.set_subtitle_lines(4)
        if r.get('color') in COLORS:
            dot = Gtk.Label(); dot.set_markup('<span foreground="%s" size="x-large">●</span>' % COLORS[r['color']]); row.add_prefix(dot)
        e = Gtk.Button(icon_name='kjt-edit-symbolic', tooltip_text='Edit: colour, note, Study Pads', valign=Gtk.Align.CENTER); e.add_css_class('flat')
        e.connect('clicked', lambda *_: edit(self.win, r)); row.add_suffix(e)
        d = Gtk.Button(icon_name='user-trash-symbolic', tooltip_text='Remove', valign=Gtk.Align.CENTER); d.add_css_class('flat')
        d.connect('clicked', lambda *_: self.remove(r)); row.add_suffix(d)
        row.connect('activated', lambda *_: self.win.open_passage(r['book'], int(r['chapter']), int(r.get('verse') or 1), tr=r.get('translation')))
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
        e = Gtk.Button(icon_name='kjt-edit-symbolic', tooltip_text='Name, colour, emoji', valign=Gtk.Align.CENTER); e.add_css_class('flat'); e.add_css_class('circular')
        e.connect('clicked', lambda *_: pad_dialog(self.win, tag)); card.append(e)
        g = Gtk.GestureClick(); g.connect('released', lambda *_: self.set_filter('' if self.filter == tag else tag)); txt.add_controller(g)
        gb = Gtk.GestureClick(); gb.connect('released', lambda *_: self.set_filter('' if self.filter == tag else tag)); badge.add_controller(gb)
        card.set_tooltip_text('Click to show only this Study Pad')
        card.set_cursor(Gdk.Cursor.new_from_name('pointer'))
        return card

    def rename(self, tag):
        d = Adw.AlertDialog(heading='Rename the Study Pad')
        en = Gtk.Entry(text=STUDY.pad_name(tag), activates_default=True); d.set_extra_child(en)
        d.add_response('cancel', 'Cancel'); d.add_response('ok', 'Rename'); d.set_response_appearance('ok', Adw.ResponseAppearance.SUGGESTED); d.set_default_response('ok')
        d.connect('response', lambda _d, res: STUDY.rename_pad(tag, en.get_text()) if res == 'ok' else None); d.present(self.win)

    def remove(self, r):
        dlg = Adw.AlertDialog(heading='Remove this?', body=self.ref(r) + ((' — ' + r['note'][:120]) if r.get('note') else ''))
        dlg.add_response('cancel', 'Cancel'); dlg.add_response('del', 'Remove'); dlg.set_response_appearance('del', Adw.ResponseAppearance.DESTRUCTIVE)
        dlg.connect('response', lambda d, res: STUDY.delete(r) if res == 'del' else None); dlg.present(self.win)

    def set_filter(self, t):
        self.filter = t; self.fill()

    # the account
    def account(self, parent=None):
        i = STORE.kv('info') or {}
        u = i.get('user')
        g = Adw.PreferencesGroup(title='My KJT account')
        if u:
            when = STORE.kv('synced')
            row = Adw.ActionRow(title=GLib.markup_escape_text(u.get('name') or 'Signed in'),
                                subtitle='Kept in step with knowingjesus.today%s' % (time.strftime(' · last %d %b %H:%M', time.localtime(when)) if when else ''))
            row.add_prefix(Gtk.Image(icon_name='avatar-default-symbolic', pixel_size=32))
            out = Gtk.Button(label='Sign out', valign=Gtk.Align.CENTER); out.connect('clicked', lambda *_: self.sign_out()); row.add_suffix(out)
            g.add(row)
            waiting = len(STORE.outbox())
            if waiting:
                g.add(Adw.ActionRow(title='%d changes wait for the internet' % waiting, subtitle='They are sent by themselves as soon as the website can be reached.'))
        else:
            row = Adw.ActionRow(title='Not signed in', subtitle='Your bookmarks and notes stay on this computer. Sign in to keep them in step with My KJT on the website and your phone.')
            row.set_subtitle_lines(4)
            b = Gtk.Button(label='Sign in', valign=Gtk.Align.CENTER); b.add_css_class('suggested-action'); b.connect('clicked', lambda *_: self.sign_in_dialog()); row.add_suffix(b)
            g.add(row)
        (parent or self.right).append(g)

    def sign_in_dialog(self, how=None):
        how = how or SET.get('signin_how', 'key')
        d = Adw.AlertDialog(heading='Sign in to My KJT', body='Open your study with your study key, or with the name (or e-mail) and password of your account on knowingjesus.today.')
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10)
        tabs = Gtk.Box(halign=Gtk.Align.CENTER); tabs.add_css_class('linked')
        t_key = Gtk.ToggleButton(label='🔑 Study key', active=how == 'key'); t_pw = Gtk.ToggleButton(label='Name and password', group=t_key, active=how != 'key')
        tabs.append(t_key); tabs.append(t_pw); box.append(tabs)
        stack = Gtk.Stack(transition_type=Gtk.StackTransitionType.CROSSFADE, vhomogeneous=False)
        # the study key
        kb = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        key = Adw.PasswordEntryRow(title='Your study key  (KJT-XXXX-XXXX-XXXX-XXXX)')
        kl = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE); kl.add_css_class('boxed-list'); kl.append(key); kb.append(kl)
        kb.append(Gtk.LinkButton(uri=NET_SITE() + '/my-kjt/', label='Lost your study key? Get a new one on the website'))
        stack.add_named(kb, 'key')
        # name and password
        pb = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        lg = Adw.EntryRow(title='Name or e-mail'); pw = Adw.PasswordEntryRow(title='Password')
        lb = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE); lb.add_css_class('boxed-list'); lb.append(lg); lb.append(pw); pb.append(lb)
        pb.append(Gtk.LinkButton(uri=NET_SITE() + '/wp-login.php?action=lostpassword', label='Forgot your password?'))
        stack.add_named(pb, 'pw')
        box.append(stack)
        box.append(Gtk.LinkButton(uri=NET_SITE() + '/my-kjt/', label='No study yet? Make one on the website (a study key needs no e-mail)'))
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
            stack.set_visible_child_name(mode()); SET.set('signin_how', mode()); check()
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
            else:
                wrong = 'That study key was not recognised. Check it and try again.' if mode() == 'key' else 'The name or the password is not right.'
                why = {'wrong': wrong, 'limit': 'Too many tries. Please wait an hour and try again.', 'net': 'The website could not be reached.'}.get(res.get('why'), 'Signing in did not work. Please try again.')
                self.win.toast(why)
                GLib.timeout_add(400, lambda: (self.sign_in_dialog(mode()), False)[1])
        d.connect('response', lambda _d, res: go() if res == 'go' else None)
        switch()
        d.present(self.win)

    def sign_out(self):
        d = Adw.AlertDialog(heading='Sign out?', body='Your study stays safe in My KJT on the website. This computer forgets it until you sign in again.')
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
    d = Adw.AlertDialog(heading='Study Pad' if tag else 'A new Study Pad')
    box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
    name = Gtk.Entry(text=STUDY.pad_name(tag) if tag else '', placeholder_text='Its name', activates_default=True); box.append(name)
    icon = Gtk.Entry(text=(p or {}).get('icon', ''), placeholder_text='An emoji for it, if you like (optional)', max_length=4); box.append(icon)
    box.append(Gtk.Label(label='Colour', xalign=0, css_classes=['heading'], margin_top=4))
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
        any_c = Gtk.ColorDialogButton(dialog=Gtk.ColorDialog(with_alpha=False), halign=Gtk.Align.START, tooltip_text='Any colour')
        rgba = Gdk.RGBA(); rgba.parse(pick['c']); any_c.set_rgba(rgba)
        def other(btn, _p):
            c = btn.get_rgba(); choose('#%02x%02x%02x' % (int(c.red * 255), int(c.green * 255), int(c.blue * 255)))
        any_c.connect('notify::rgba', other)
        row = Gtk.Box(spacing=8); row.append(Gtk.Label(label='Or any colour:')); row.append(any_c); box.append(row)
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
            c = Adw.AlertDialog(heading='Remove “%s”?' % STUDY.pad_name(tag),
                                body='The Study Pad goes away. Its %d bookmarks stay, without it.' % n if n else 'The Study Pad goes away.')
            c.add_response('cancel', 'Keep it'); c.add_response('go', 'Remove'); c.set_response_appearance('go', Adw.ResponseAppearance.DESTRUCTIVE)
            c.connect('response', lambda _c, r2: (STUDY.delete_pad(tag), done and done()) if r2 == 'go' else None); c.present(win)
    d.connect('response', resp); d.present(win)
    GLib.idle_add(lambda: (name.grab_focus(), False)[1])


def ref_of(r):
    v2 = r.get('verse_end')
    return '%s %d:%d%s' % (book_name(r['book'], tr=r.get('translation')), int(r['chapter']), int(r.get('verse') or 1), '–%d' % int(v2) if v2 else '')


def edit(win, r, focus='note'):
    """edit one bookmark in one place: its colour, its note and its Study Pads; or remove it"""
    r = next((x for x in STUDY.records() if x['id'] == r['id']), r)
    d = Adw.AlertDialog(heading='Edit', body=ref_of(r))
    box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
    # colour
    box.append(Gtk.Label(label='Colour', xalign=0, css_classes=['heading']))
    dots = Gtk.Box(spacing=6); chosen = {'c': r.get('color') if r.get('color') in COLORS else None}; btns = {}
    def pick(c):
        chosen['c'] = c
        for k, b in btns.items():
            (b.add_css_class if k == c else b.remove_css_class)('kjt-dot-on')
    for c in list(COLORS) + [None]:
        b = Gtk.Button(tooltip_text=c or 'No colour'); b.add_css_class('kjt-dot'); b.add_css_class('kjt-dot-' + (c or 'none'))
        b.connect('clicked', lambda _b, c=c: pick(c)); dots.append(b); btns[c] = b
    pick(chosen['c']); box.append(dots)
    # note
    box.append(Gtk.Label(label='Note', xalign=0, css_classes=['heading'], margin_top=4))
    tvw = Gtk.TextView(wrap_mode=Gtk.WrapMode.WORD_CHAR, top_margin=8, bottom_margin=8, left_margin=8, right_margin=8)
    tvw.get_buffer().set_text(r.get('note') or '')
    sc = Gtk.ScrolledWindow(min_content_height=130, min_content_width=300); sc.set_child(tvw); sc.add_css_class('card'); box.append(sc)
    # Study Pads
    box.append(Gtk.Label(label='Study Pads', xalign=0, css_classes=['heading'], margin_top=4))
    fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=2, min_children_per_line=1, column_spacing=6)
    checks = {}
    for p in STUDY.pads():
        cb = Gtk.CheckButton(label=STUDY.pad_label(p['tag'])); cb.set_active(p['tag'] in (r.get('tags') or [])); fb.append(cb); checks[p['tag']] = cb
    if checks:
        box.append(fb)
    new = Gtk.Entry(placeholder_text='A new Study Pad: type its name'); box.append(new)
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
            if chosen['c'] != cur.get('color'):
                STUDY.set_color(cur, chosen['c']); cur = next((x for x in STUDY.records() if x['id'] == r['id']), cur)
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
