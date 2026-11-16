"""My Study: bookmarks, highlights, notes and Study Pads; and your My KJT account (signing in here, in the app)."""
import time
from gi.repository import Gtk, Adw, GLib, Pango
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
        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16, margin_top=16, margin_bottom=30, margin_start=16, margin_end=16)
        c = Adw.Clamp(maximum_size=820); c.set_child(self.box)
        sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(c); tv.set_content(sc)
        STUDY.listen(self.refresh)

    def refresh(self):
        if self.get_mapped() or True:
            self.fill()

    def clear(self):
        while self.box.get_first_child():
            self.box.remove(self.box.get_first_child())

    SORTS = [('bible', 'Bible order'), ('new', 'Newest first'), ('old', 'Oldest first'), ('changed', 'Last changed'), ('color', 'By colour')]

    def section(self, key, title, count, extra=None):
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
        lb = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE); lb.add_css_class('boxed-list')
        rv = Gtk.Revealer(reveal_child=open_, transition_type=Gtk.RevealerTransitionType.SLIDE_DOWN); rv.set_child(lb)
        def flip(*_):
            now = not rv.get_reveal_child(); rv.set_reveal_child(now)
            arrow.set_from_icon_name('pan-down-symbolic' if now else 'pan-end-symbolic'); SET.set('fold_' + key, 0 if now else 1)
        b.connect('clicked', flip)
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6); box.append(head); box.append(rv)
        self.box.append(box)
        return lb

    def sort_key(self, how):
        order = {b: i for i, b in enumerate(OT + NT)}
        cols = {c: i for i, c in enumerate(COLORS)}
        when = lambda r: int(r.get('created') or r.get('updated') or 0)
        bible = lambda r: (order.get(canon(r['book']), 999), int(r['chapter']), int(r.get('verse') or 1))
        return {'bible': bible, 'new': lambda r: -when(r), 'old': when, 'changed': lambda r: -int(r.get('updated') or r.get('created') or 0),
                'color': lambda r: (cols.get(r.get('color'), 99),) + bible(r)}[how]

    def fill(self):
        self.clear()
        self.account()
        recs = STUDY.records()
        q = self.q.get_text().strip().casefold()
        pads = STUDY.pads()
        # Study Pads
        if pads:
            lb = self.section('pads', 'Study Pads', len(pads))
            for p in pads:
                n = sum(1 for r in recs if p['tag'] in (r.get('tags') or []))
                row = Adw.ActionRow(title=GLib.markup_escape_text(STUDY.pad_label(p['tag'])), subtitle='%d passage%s' % (n, '' if n == 1 else 's'), activatable=True)
                row.connect('activated', lambda _r, t=p['tag']: self.set_filter('' if self.filter == t else t))
                if self.filter == p['tag']:
                    row.add_suffix(Gtk.Image(icon_name='kjt-check-symbolic'))
                rn = Gtk.Button(icon_name='kjt-edit-symbolic', tooltip_text='Rename this Study Pad', valign=Gtk.Align.CENTER); rn.add_css_class('flat')
                rn.connect('clicked', lambda _b, t=p['tag']: self.rename(t)); row.add_suffix(rn)
                lb.append(row)
            if self.filter:
                row = Adw.ActionRow(title='Show everything', activatable=True); row.connect('activated', lambda *_: self.set_filter('')); lb.append(row)
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
        for r in shown[:500]:
            lb.append(self.row(r))

    def ref(self, r):
        return ref_of(r)

    def row(self, r):
        rows = STORE.passage(r['translation'], r['book'], int(r['chapter']), int(r.get('verse') or 1), int(r['chapter']), int(r.get('verse_end') or r.get('verse') or 1))
        text = ' '.join(strip_tags(x[2]).strip() for x in rows)
        sub = (r.get('note') or '').strip() or text
        if r.get('tags'):
            sub = '  '.join(STUDY.pad_label(t) for t in r['tags']) + '\n' + sub
        row = Adw.ActionRow(title=GLib.markup_escape_text(self.ref(r)), subtitle=GLib.markup_escape_text(sub[:300]), activatable=True)
        row.set_subtitle_lines(3)
        if r.get('color') in COLORS:
            dot = Gtk.Label(); dot.set_markup('<span foreground="%s" size="x-large">●</span>' % COLORS[r['color']]); row.add_prefix(dot)
        e = Gtk.Button(icon_name='kjt-edit-symbolic', tooltip_text='Edit: colour, note, Study Pads', valign=Gtk.Align.CENTER); e.add_css_class('flat')
        e.connect('clicked', lambda *_: edit(self.win, r)); row.add_suffix(e)
        d = Gtk.Button(icon_name='user-trash-symbolic', tooltip_text='Remove', valign=Gtk.Align.CENTER); d.add_css_class('flat')
        d.connect('clicked', lambda *_: self.remove(r)); row.add_suffix(d)
        row.connect('activated', lambda *_: self.win.open_passage(r['book'], int(r['chapter']), int(r.get('verse') or 1), tr=r.get('translation')))
        return row

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
    def account(self):
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
            row.set_subtitle_lines(3)
            b = Gtk.Button(label='Sign in', valign=Gtk.Align.CENTER); b.add_css_class('suggested-action'); b.connect('clicked', lambda *_: self.sign_in_dialog()); row.add_suffix(b)
            g.add(row)
        self.box.append(g)

    def sign_in_dialog(self):
        d = Adw.AlertDialog(heading='Sign in to My KJT', body='Use the name (or e-mail) and password of your account on knowingjesus.today.')
        box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8)
        lg = Adw.EntryRow(title='Name or e-mail'); pw = Adw.PasswordEntryRow(title='Password')
        lb = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE); lb.add_css_class('boxed-list'); lb.append(lg); lb.append(pw); box.append(lb)
        self.err = Gtk.Label(wrap=True, css_classes=['error'], visible=False); box.append(self.err)
        link = Gtk.LinkButton(uri=NET_SITE() + '/wp-login.php?action=lostpassword', label='Forgot your password?'); box.append(link)
        reg = Gtk.LinkButton(uri=NET_SITE() + '/wp-login.php?action=register', label='No account yet? Make one on the website'); box.append(reg)
        d.set_extra_child(box)
        d.add_response('cancel', 'Cancel'); d.add_response('go', 'Sign in'); d.set_response_appearance('go', Adw.ResponseAppearance.SUGGESTED)
        d.set_default_response('go'); d.set_close_response('cancel')
        d.set_response_enabled('go', False)
        def check(*_):
            d.set_response_enabled('go', bool(lg.get_text().strip() and pw.get_text()))
        lg.connect('changed', check); pw.connect('changed', check)
        pw.connect('entry-activated', lambda *_: d.get_response_enabled('go') and (d.close(), go()))
        def go():
            if not NET.online():
                self.win.toast('Signing in needs the internet'); return
            self.win.toast('Signing in…')
            STUDY.sign_in(lg.get_text().strip(), pw.get_text(), done)
        def done(res):
            if res.get('ok'):
                self.win.toast('Welcome%s. Your study is now kept in step with My KJT.' % ((', ' + res['name']) if res.get('name') else ''))
                self.fill()
            else:
                why = {'wrong': 'The name or the password is not right.', 'limit': 'Too many tries. Please wait a few minutes.', 'net': 'The website could not be reached.'}.get(res.get('why'), 'Signing in did not work. Please try again.')
                self.win.toast(why)
                GLib.timeout_add(400, lambda: (self.sign_in_dialog(), False)[1])
        d.connect('response', lambda _d, res: go() if res == 'go' else None)
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
