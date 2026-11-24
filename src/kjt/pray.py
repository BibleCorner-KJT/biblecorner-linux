"""Prayer (2.16), made by the app as in the Android app: the daily prayers, the Creed and a poem to pray;
"Ask for prayer" (a request, shown on the prayer board after review); and the prayer board, to pray for one
another and reply. The words come from the website's own Prayer page in the reader's language, kept on this
computer. Requests and replies written without internet wait here and are sent by themselves later."""
import re, time, json
from urllib.parse import urljoin, urlencode
from gi.repository import Gtk, Adw, Gdk, GLib, Pango
from .core import STORE, NET, SITE, lang, run_bg
from .i18n import _
from .pageparse import Tree, keep_lines, by_id, page_url

LORDS = re.compile(r"lord.?s prayer|notre p|padre nuestro|отче|πάτερ|ابانا|أبانا|天父|हे हमारे", re.I)


def parse_pray(html):
    root = Tree(html).root
    out = {'prayers': [], 'board': [], 'quote': None}
    po = by_id(root, 'pray-one-for-another')
    bq = po.first(lambda n: n.tag == 'blockquote') if po else None
    if bq:
        a0 = bq.parent.first(lambda n: n.tag == 'a')
        out['quote'] = {'text': bq.text(), 'ref': a0.text() if a0 else '', 'href': a0.attrs.get('href', '') if a0 else ''}
    dp = by_id(root, 'daily-prayers')
    for d in (dp.all(lambda n: n.tag == 'details') if dp else []):
        h3 = d.first(lambda n: n.tag == 'h3'); sm = d.first(lambda n: n.tag == 'summary')
        p = {'id': d.attrs.get('id', ''), 'title': (h3.text() if h3 else '') or (sm.text() if sm else ''), 'blocks': [], 'ref': '', 'href': '', 'icon': '📿'}
        for el in d.all(lambda n: n.tag == 'p'):
            if sm is not None and _inside(el, sm):
                continue
            a = el.first(lambda n: n.tag == 'a' and '#/p/' in n.attrs.get('href', ''))
            if a and el.text() == a.text():
                p['ref'], p['href'] = a.text(), a.attrs['href']; continue
            t = keep_lines(el)
            if t:
                p['blocks'].append({'q': _has_parent(el, 'blockquote', d), 't': t})
        if LORDS.search(p['title']) or not out['prayers']:
            p['icon'] = '✝️'
        if p['blocks']:
            out['prayers'].append(p)
    cr = by_id(root, 'creed')
    crd = cr.first(lambda n: n.tag == 'details') if cr else None
    if crd:
        h3 = crd.first(lambda n: n.tag == 'h3'); h2 = cr.first(lambda n: n.tag == 'h2')
        out['prayers'].append({'id': 'creed', 'title': (h3.text() if h3 else '') or (h2.text() if h2 else ''), 'icon': '☦️',
                               'blocks': [{'t': keep_lines(x)} for x in crd.all(lambda n: n.tag == 'p') if keep_lines(x)]})
    pm = by_id(root, 'poem')
    art = pm.first(lambda n: n.tag == 'article') if pm else None
    if art:
        h2 = pm.first(lambda n: n.tag == 'h2'); by = ''
        if h2 is not None:
            sib = [k for k in h2.parent.children()]; i = sib.index(h2)
            if i + 1 < len(sib) and sib[i + 1].tag == 'p':
                by = sib[i + 1].text()
        out['prayers'].append({'id': 'poem', 'title': h2.text() if h2 else '', 'by': by, 'icon': '🕊️',
                               'blocks': [{'t': keep_lines(x), 'poem': True} for x in art.all(lambda n: n.tag == 'p') if keep_lines(x)]})
    sp = by_id(root, 'shared-prayers')
    for i, ar in enumerate(sp.all(lambda n: n.tag == 'article') if sp else []):
        kids = ar.children(); head = kids[0] if kids and kids[0].tag == 'div' else None
        direct = [k for k in kids if k.tag == 'p']
        it = {'key': ar.attrs.get('id') or 'legacy-%d' % (i + 1), 'label': '', 'meta': '', 'text': [], 'replies': [], 'form': None}
        if head is not None:
            hps = list(head.all(lambda n: n.tag == 'p'))
            it['label'] = hps[0].text() if hps else ''; it['meta'] = hps[1].text() if len(hps) > 1 else ''
        else:
            it['label'] = direct[0].text() if direct else ''; it['meta'] = direct[1].text() if len(direct) > 1 else ''; direct = direct[2:]
        it['text'] = [t for t in (keep_lines(p) for p in direct) if t]
        for c in kids:
            if c.tag != 'div' or c is head:
                continue
            f = c.first(lambda n: n.tag == 'form')
            if f is not None:
                for r in c.children('div'):
                    n = r.first(lambda x: x.tag == 'strong')
                    if n is not None:
                        it['replies'].append({'name': n.text(), 'text': keep_lines(r.first(lambda x: x.tag == 'p'))})
                val = lambda nm: next((x.attrs.get('value', '') for x in f.all(lambda x: x.attrs.get('name') == nm)), '')
                it['form'] = {'prayer_id': val('prayer_id'), 'legacy': val('legacy') or '0'}
            else:
                ps = list(c.all(lambda n: n.tag == 'p'))
                if len(ps) >= 2:
                    it['replies'].append({'name': ps[0].text(), 'text': keep_lines(ps[-1])})
        if it['text']:
            out['board'].append(it)
    return out if out['prayers'] or out['board'] else None


def _inside(n, anc):
    while n is not None:
        if n is anc:
            return True
        n = n.parent
    return False


def _has_parent(n, tag, stop):
    n = n.parent
    while n is not None and n is not stop:
        if n.tag == tag:
            return True
        n = n.parent
    return False


# ---------- sending: requests and replies wait on this computer until they can be sent ----------
QKEY = 'pray_queue'


def queue():
    return STORE.kv(QKEY) or []


def enqueue(item):
    item['at'] = int(time.time()); STORE.set_kv(QKEY, queue() + [item])


def send_all():
    """(in the background) send what waits; returns the results [(kind, ok, why)]"""
    q = queue()
    if not q:
        return []
    root = Tree(NET.get(page_url('pray', SITE + '/prayer/'), timeout=60, strict=True).decode('utf-8', 'replace')).root
    forms = list(root.all(lambda n: n.tag == 'form'))
    val = lambda f, nm: next((x.attrs.get('value', '') for x in f.all(lambda x: x.attrs.get('name') == nm)), '')
    left, done = [], []
    for it in q:
        data = dict(it['data'], kjt_json='1'); f = None
        if it['kind'] == 'request':
            f = next((x for x in forms if 'data-kjt-prayer' in x.attrs), None)
            data['action'] = 'kjt_submit_prayer'
            if f is not None:
                data['kjt_prayer_nonce'] = val(f, 'kjt_prayer_nonce')
        else:
            f = next((x for x in forms if val(x, 'prayer_id') == str(it['data'].get('prayer_id')) and (val(x, 'legacy') or '0') == str(it['data'].get('legacy') or '0')), None)
            data['action'] = 'kjt_prayer_reply'
            if f is not None:
                data['kjt_reply_nonce'] = val(f, 'kjt_reply_nonce')
        if f is None:
            done.append((it['kind'], False, 'gone')); continue
        dest = urljoin(SITE + '/prayer/', f.attrs.get('action') or '/wp-admin/admin-post.php')
        try:
            j = json.loads(NET.get(dest, data, timeout=60).decode('utf-8', 'replace'))
            ok = (j or {}).get('result') == 'sent'
            done.append((it['kind'], ok, '' if ok else str((j or {}).get('result') or 'error')))
        except Exception:
            left.append(it)
    STORE.set_kv(QKEY, left)
    return done


# ---------- the page ----------
class PrayPage(Gtk.Box):
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win; self.tab = 'pray'; self.view = None; self.loaded_lang = None
        tv = Adw.ToolbarView(); tv.set_vexpand(True); self.append(tv)
        hb = Adw.HeaderBar(); tv.add_top_bar(hb); win.sidebar_button(hb)
        self.back = Gtk.Button(icon_name='kjt-prev-symbolic', tooltip_text=_('All prayers'), visible=False); self.back.connect('clicked', lambda *_a: self.draw())
        hb.pack_start(self.back)
        self.seg = Gtk.Box(); self.seg.add_css_class('linked'); self.segs = {}
        first = None
        for k, lab in (('pray', '🙏 ' + _('Pray')), ('ask', '✍️ ' + _('Ask for prayer')), ('board', '🤝 ' + _('Prayer board'))):
            b = Gtk.ToggleButton(label=lab, group=first); first = first or b
            b.connect('toggled', lambda b, k=k: (setattr(self, 'tab', k), self.draw()) if b.get_active() else None)
            self.seg.append(b); self.segs[k] = b
        self.title = Gtk.Label(label=_('Prayer'), ellipsize=Pango.EllipsizeMode.END); self.title.add_css_class('heading')
        self.titlestack = Gtk.Stack(); self.titlestack.add_named(self.seg, 'seg'); self.titlestack.add_named(self.title, 'title')
        hb.set_title_widget(self.titlestack)
        # 2.34: on a phone (narrow window) the three tabs get a row of their own under the top bar, full width
        self.segrow = Gtk.Box(margin_start=8, margin_end=8, margin_top=6, margin_bottom=6, visible=False)
        tv.add_top_bar(self.segrow)
        for b in self.segs.values():
            b.get_child().set_ellipsize(Pango.EllipsizeMode.END) if isinstance(b.get_child(), Gtk.Label) else None
        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12, margin_top=18, margin_bottom=30, margin_start=16, margin_end=16)
        c = Adw.Clamp(maximum_size=760); c.set_child(self.box)
        self.sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); self.sc.set_child(c); tv.set_content(self.sc)
        k = Gtk.EventControllerKey(); k.connect('key-pressed', lambda c, kv, *_a: (self.draw(), True)[1] if kv == Gdk.KEY_Escape and self.view else False)
        self.add_controller(k)
        self.segs['pray'].set_active(True)

    def set_compact(self, c):
        here = self.seg.get_parent()
        want = self.segrow if c else self.titlestack
        if here is not want:
            if here is self.titlestack:
                self.titlestack.remove(self.seg)
            elif here is not None:
                here.remove(self.seg)
            if c:
                self.segrow.append(self.seg); self.seg.set_hexpand(True); self.seg.set_homogeneous(True)
            else:
                self.seg.set_hexpand(False); self.seg.set_homogeneous(False); self.titlestack.add_named(self.seg, 'seg')
        self.compact = c
        self.sync_title()

    def sync_title(self):
        # the tabs show in the title (wide) or in their own row (narrow); a single prayer shows its title
        c = getattr(self, 'compact', False)
        self.segrow.set_visible(c and not self.view)
        if c or self.view:
            self.titlestack.set_visible_child_name('title')
        elif self.titlestack.get_child_by_name('seg'):
            self.titlestack.set_visible_child_name('seg')

    # data
    def key(self):
        return 'pray_' + lang()

    def data(self):
        d = STORE.kv(self.key())
        if not d:   # 2.48: the Prayer page inside the app
            from . import pack
            h = pack.page('pray', lang()) if pack.present() else None
            d = parse_pray(h) if h else None
            if d:
                STORE.set_kv(self.key(), d)
        return d

    def refresh(self):
        if self.loaded_lang != lang():
            self.loaded_lang = lang(); self.draw()
        if not NET.online():
            return
        url = page_url('pray', SITE + '/prayer/'); k = self.key()
        def work():
            d = parse_pray(NET.get(url, timeout=60, strict=True).decode('utf-8', 'replace'))
            if d:
                STORE.set_kv(k, d)
            return d
        run_bg(work, lambda d: self.draw() if isinstance(d, dict) and self.view is None and self.tab != 'ask' and k == self.key() else None)
        if queue():
            self.send(None)

    # drawing helpers
    def clear(self):
        while self.box.get_first_child():
            self.box.remove(self.box.get_first_child())

    def label(self, s, *classes, sel=False):
        l = Gtk.Label(label=s, xalign=0, wrap=True, wrap_mode=Pango.WrapMode.WORD_CHAR, selectable=sel)
        for c in classes:
            l.add_css_class(c)
        return l

    def card(self):
        f = Gtk.Box(orientation=Gtk.Orientation.VERTICAL); f.add_css_class('card'); f.add_css_class('kjt-card')
        inner = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8, margin_top=12, margin_bottom=12, margin_start=16, margin_end=16); f.append(inner)
        self.box.append(f); return inner

    def ref_button(self, ref, href):
        b = Gtk.Button(label=ref + ' →', halign=Gtk.Align.START, tooltip_text=_('Read the chapter')); b.add_css_class('flat'); b.add_css_class('kjt-you-ref')
        b.connect('clicked', lambda *_a: self.win.open_link(href)); return b

    def copy_button(self, text):
        b = Gtk.Button(label='⎘ ' + _('Copy'), halign=Gtk.Align.START); b.add_css_class('pill')
        b.connect('clicked', lambda *_a: (Gdk.Display.get_default().get_clipboard().set(text), self.win.toast(_('Copied')))); return b

    def top(self):
        # back to the top; the keyboard on the page's buttons, so no text is chosen by itself
        def go():
            self.sc.get_vadjustment().set_value(0)
            (self.back if self.view else self.segs[self.tab]).grab_focus()
            return False
        GLib.idle_add(go)

    def pending(self):
        n = len(queue())
        if n:
            self.box.append(self.label('⏳ ' + _('Waiting to be sent (no internet):') + ' %d' % n, 'dim-label'))

    # the three parts
    def draw(self):
        self.view = None; self.back.set_visible(False); self.title.set_label(_('Prayer')); self.sync_title(); self.clear(); self.top()
        if self.tab == 'ask':
            return self.ask()
        d = self.data()
        if not d:
            self.box.append(self.label(_('Loading…') if NET.online() else _('Open this page once with internet: it is then kept on this device.'), 'dim-label')); return
        if self.tab == 'board':
            return self.board(d)
        if (d.get('quote') or {}).get('text'):
            hero = Gtk.Box(orientation=Gtk.Orientation.VERTICAL); hero.add_css_class('kjt-you-hero')
            inner = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_top=16, margin_bottom=16, margin_start=20, margin_end=20); hero.append(inner)
            inner.append(self.label('“' + d['quote']['text'] + '”', 'kjt-you-quote', sel=True))
            if d['quote'].get('ref'):
                inner.append(self.ref_button(d['quote']['ref'], d['quote'].get('href', '')))
            self.box.append(hero)
        for p in d.get('prayers') or []:
            b = Gtk.Button(); b.add_css_class('kjt-you-feel')
            row = Gtk.Box(spacing=12, margin_top=8, margin_bottom=8, margin_start=6, margin_end=6)
            e = Gtk.Label(label=p.get('icon') or '📿'); e.add_css_class('kjt-you-emo'); row.append(e)
            col = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True)
            col.append(self.label(p['title'], 'kjt-you-ft'))
            first = re.sub(r'\s+', ' ', p['blocks'][0]['t'] if p['blocks'] else '')
            s = self.label(first[:88] + '…' if len(first) > 90 else first, 'kjt-you-fs'); s.set_lines(2); s.set_ellipsize(Pango.EllipsizeMode.END); col.append(s)
            row.append(col); b.set_child(row); b.connect('clicked', lambda _b, p=p: self.read(p))
            self.box.append(b)

    def read(self, p):
        self.view = p.get('id') or p['title']; self.back.set_visible(True)
        self.title.set_label(p['title']); self.sync_title(); self.clear(); self.top()
        inner = self.card()
        head = Gtk.Box(spacing=12); e = Gtk.Label(label=p.get('icon') or '📿'); e.add_css_class('kjt-you-emo-big'); head.append(e)
        head.append(self.label(p['title'], 'kjt-you-big2')); inner.append(head)
        if p.get('by'):
            inner.append(self.label(p['by'], 'dim-label'))
        for b in p['blocks']:
            l = self.label(b['t'], 'kjt-pray-q' if b.get('q') else ('kjt-pray-poem' if b.get('poem') else 'kjt-pray-p'), sel=True)
            if b.get('q'):
                l.set_margin_start(14)
            inner.append(l)
        if p.get('ref'):
            inner.append(self.ref_button(p['ref'], p.get('href', '')))
        inner.append(self.copy_button(p['title'] + '\n\n' + '\n\n'.join(b['t'] for b in p['blocks']) + ('\n— ' + p['ref'] if p.get('ref') else '')))
        allb = Gtk.Button(label='← ' + _('All prayers'), halign=Gtk.Align.CENTER); allb.add_css_class('pill'); allb.connect('clicked', lambda *_a: self.draw())
        self.box.append(allb)

    def field(self, box, label, w):
        box.append(self.label(label, 'heading')); box.append(w)

    def ask(self):
        me = STORE.kv('pray_me') or {}
        inner = self.card()
        inner.append(self.label(_('Share a prayer request'), 'kjt-card-title'))
        inner.append(self.label(_('Your prayer matters. Your name and email stay private: only the prayer is shown, after review.'), 'dim-label'))
        name = Gtk.Entry(text=me.get('name', ''), max_length=120); email = Gtk.Entry(text=me.get('email', ''), max_length=254, input_purpose=Gtk.InputPurpose.EMAIL)
        req = Gtk.TextView(wrap_mode=Gtk.WrapMode.WORD_CHAR, top_margin=8, bottom_margin=8, left_margin=8, right_margin=8)
        rs = Gtk.ScrolledWindow(min_content_height=140); rs.set_child(req); rs.add_css_class('card')
        cb = Gtk.CheckButton(label=_('Email me when someone replies'), active=True)
        self.field(inner, _('Your name'), name); self.field(inner, _('Email (optional)'), email); self.field(inner, _('Your prayer request'), rs); inner.append(cb)
        go = Gtk.Button(label='🙏 ' + _('Send my request'), halign=Gtk.Align.START); go.add_css_class('suggested-action'); go.add_css_class('pill')
        msg = self.label('', 'dim-label'); inner.append(go); inner.append(msg)
        def send(*_a):
            b = req.get_buffer(); text = b.get_text(b.get_start_iter(), b.get_end_iter(), False).strip()[:6000]
            if not name.get_text().strip() or not text:
                msg.set_label(_('We could not receive your request. Please check every field and try again.')); return
            STORE.set_kv('pray_me', {'name': name.get_text().strip(), 'email': email.get_text().strip()})
            enqueue({'kind': 'request', 'data': {'name': name.get_text().strip(), 'email': email.get_text().strip(), 'request': text, 'reply_notifications': '1' if cb.get_active() else ''}})
            b.set_text('')
            self.send(msg, ok=_('Thank you. Your prayer request was received. It will appear on the prayer board after review.'),
                      bad=_('We could not receive your request. Please check every field and try again.'), btn=go)
        go.connect('clicked', send)
        self.pending()

    def send(self, msg, ok='', bad='', btn=None):
        if not NET.online():
            if msg:
                msg.set_label('✓ ' + _('Saved on this device. It will be sent by itself when you are back online.'))
            return
        if msg:
            msg.set_label(_('Sending…'))
        if btn:
            btn.set_sensitive(False)
        def done(res):
            if btn:
                btn.set_sensitive(True)
            if not msg:
                return
            if isinstance(res, Exception) or queue():
                msg.set_label('✓ ' + _('Saved on this device. It will be sent by itself when you are back online.'))
            elif res and res[-1][1]:
                msg.set_label('✓ ' + ok)
            else:
                msg.set_label(bad)
        run_bg(send_all, done)

    def board(self, d):
        prayed = STORE.kv('prayed') or {}
        if not d.get('board'):
            self.box.append(self.label(_('No shared prayers yet.'), 'dim-label')); return
        self.box.append(self.label(_('Pray for one another. Tap 🙏 when you have prayed.'), 'dim-label'))
        for it in d['board']:
            inner = self.card()
            top = Gtk.Box(spacing=8); lab = self.label(it['label'], 'kjt-pray-lab'); lab.set_wrap(False); top.append(lab)
            m = self.label(it['meta'], 'dim-label'); m.set_hexpand(True); m.set_xalign(1); top.append(m)
            inner.append(top)
            for t in it['text']:
                inner.append(self.label(t, 'kjt-pray-p', sel=True))
            for r in it['replies']:
                rb = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, margin_start=14); rb.add_css_class('kjt-pray-reply')
                rb.append(self.label(r['name'], 'heading')); rb.append(self.label(r['text'], sel=True)); inner.append(rb)
            row = Gtk.Box(spacing=8)
            pb = Gtk.ToggleButton(label=('✓ ' if prayed.get(it['key']) else '🙏 ') + _('I prayed'), active=bool(prayed.get(it['key']))); pb.add_css_class('pill')
            def tog(b, key=it['key']):
                m = dict(STORE.kv('prayed') or {})
                if b.get_active():
                    m[key] = int(time.time())
                else:
                    m.pop(key, None)
                STORE.set_kv('prayed', m); b.set_label(('✓ ' if b.get_active() else '🙏 ') + _('I prayed'))
            pb.connect('toggled', tog); row.append(pb)
            if it.get('form'):
                rp = Gtk.Button(label='💬 ' + _('Reply')); rp.add_css_class('pill'); rp.connect('clicked', lambda _b, inner=inner, it=it: self.reply(inner, it)); row.append(rp)
            inner.append(row)
        self.pending()

    def reply(self, inner, it):
        if getattr(inner, 'has_form', False):
            return
        inner.has_form = True
        me = STORE.kv('pray_me') or {}
        f = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_top=6)
        name = Gtk.Entry(text=me.get('name', ''), max_length=120); tv = Gtk.TextView(wrap_mode=Gtk.WrapMode.WORD_CHAR, top_margin=6, bottom_margin=6, left_margin=6, right_margin=6)
        ts = Gtk.ScrolledWindow(min_content_height=80); ts.set_child(tv); ts.add_css_class('card')
        self.field(f, _('Your name'), name); self.field(f, _('Your reply'), ts)
        go = Gtk.Button(label=_('Send'), halign=Gtk.Align.START); go.add_css_class('suggested-action'); go.add_css_class('pill')
        msg = self.label('', 'dim-label'); f.append(go); f.append(msg); inner.append(f)
        def send(*_a):
            b = tv.get_buffer(); text = b.get_text(b.get_start_iter(), b.get_end_iter(), False).strip()[:3000]
            if not name.get_text().strip() or not text:
                return
            enqueue({'kind': 'reply', 'data': {'prayer_id': it['form']['prayer_id'], 'legacy': it['form'].get('legacy') or '0', 'reply_name': name.get_text().strip(),
                                               'reply_email': me.get('email', ''), 'reply_text': text}})
            b.set_text('')
            self.send(msg, ok=_('Thank you. Your reply is awaiting review.'), bad=_('Your reply could not be saved. Check the fields and try again.'), btn=go)
        go.connect('clicked', send)
        GLib.idle_add(lambda: (tv.grab_focus(), False)[1])
