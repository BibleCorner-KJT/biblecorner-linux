"""My Study: bookmarks, highlights, notes and Study Pads; and your My KJT account (signing in here, in the app)."""
import time
from gi.repository import Gtk, Adw, GLib, Pango
from .core import STORE, SET, NET, info, book_name, strip_tags
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

    def fill(self):
        self.clear()
        self.account()
        recs = STUDY.records()
        q = self.q.get_text().strip().casefold()
        pads = STUDY.pads()
        # Study Pads
        if pads:
            g = Adw.PreferencesGroup(title='Study Pads')
            for p in pads:
                n = sum(1 for r in recs if p['tag'] in (r.get('tags') or []))
                row = Adw.ActionRow(title=GLib.markup_escape_text('#' + p['tag']), subtitle='%d verses' % n, activatable=True)
                row.connect('activated', lambda _r, t=p['tag']: self.set_filter(t))
                if self.filter == p['tag']:
                    row.add_suffix(Gtk.Image(icon_name='object-select-symbolic'))
                g.add(row)
            if self.filter:
                row = Adw.ActionRow(title='Show everything', activatable=True); row.connect('activated', lambda *_: self.set_filter('')); g.add(row)
            self.box.append(g)
        # bookmarks and notes
        shown = [r for r in recs if (not self.filter or self.filter in (r.get('tags') or [])) and
                 (not q or q in (r.get('note') or '').casefold() or q in book_name(r['book']).casefold())]
        shown.sort(key=lambda r: -int(r.get('updated') or r.get('created') or 0))
        g = Adw.PreferencesGroup(title=('#' + self.filter) if self.filter else 'Bookmarks and notes',
                                 description='Nothing yet. In the Holy Bible, click a verse, then bookmark it, give it a colour or write a note.' if not recs else '')
        for r in shown[:500]:
            g.add(self.row(r))
        self.box.append(g)

    def ref(self, r):
        v2 = r.get('verse_end')
        return '%s %d:%d%s' % (book_name(r['book'], tr=r.get('translation')), int(r['chapter']), int(r.get('verse') or 1), '–%d' % int(v2) if v2 else '')

    def row(self, r):
        rows = STORE.passage(r['translation'], r['book'], int(r['chapter']), int(r.get('verse') or 1), int(r['chapter']), int(r.get('verse_end') or r.get('verse') or 1))
        text = ' '.join(strip_tags(x[2]).strip() for x in rows)
        sub = (r.get('note') or '').strip() or text
        row = Adw.ActionRow(title=GLib.markup_escape_text(self.ref(r)), subtitle=GLib.markup_escape_text(sub[:300]), activatable=True)
        row.set_subtitle_lines(3)
        if r.get('color') in COLORS:
            dot = Gtk.Label(); dot.set_markup('<span foreground="%s" size="x-large">●</span>' % COLORS[r['color']]); row.add_prefix(dot)
        if r.get('tags'):
            row.add_suffix(Gtk.Label(label=' '.join('#' + t for t in r['tags']), css_classes=['dim-label', 'caption']))
        d = Gtk.Button(icon_name='user-trash-symbolic', tooltip_text='Remove', valign=Gtk.Align.CENTER); d.add_css_class('flat')
        d.connect('clicked', lambda *_: self.remove(r)); row.add_suffix(d)
        row.connect('activated', lambda *_: self.win.open_passage(r['book'], int(r['chapter']), int(r.get('verse') or 1), tr=r.get('translation')))
        return row

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


def NET_SITE():
    from .core import SITE
    return SITE
