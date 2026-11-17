"""You Today (2.15): "How are you today?" - choose a feeling and read what God says to you in the Scriptures.
As in the Android app, the words and verses come from the website's own page (in the reader's language),
so editing that page updates the app; a copy is kept on this computer, so it works without internet."""
import re
from gi.repository import Gtk, Adw, Gdk, GLib, Pango
from .core import STORE, NET, SITE, lang, run_bg
from .i18n import _
from .pageparse import Tree, page_url

EMO = {'thankful': '🙏', 'angry': '😠', 'anxious': '😟', 'betrayed': '💔', 'dealing-with-loss': '🕊️', 'discouraged': '😞', 'financial-issues': '🪙', 'hatred': '🔥', 'in-danger': '🛡️', 'jealous': '😒', 'lacking-faith': '🕯️', 'lazy': '💤', 'leaving-on-a-trip': '🧳', 'lonely': '🫂', 'need-courage': '🦁', 'need-direction': '🧭', 'prayerful': '📿', 'sad': '😢', 'scared': '😨', 'seeking-peace': '🌿', 'sinful': '🤲', 'tempted': '⚠️', 'weak': '🌱', 'comfort': '🤍'}


def parse_you(html):
    """the page -> {feelings: [{id, title, sub, passages: [{ref, href, verses: [[n, text]]}]}], comfort, quote} (as the Android app)"""
    root = Tree(html).root
    out = {'feelings': [], 'comfort': None, 'quote': None}
    fe = root.first(lambda n: n.attrs.get('id') == 'feelings')
    if not fe:
        return None
    q = fe.first(lambda n: n.cls('border-l-4')) or fe.first(lambda n: 'border-yellow' in (n.attrs.get('class') or ''))
    if q:
        p, a = q.first(lambda n: n.tag == 'p'), q.first(lambda n: n.tag == 'a')
        out['quote'] = {'text': p.text() if p else '', 'ref': a.text() if a else '', 'href': a.attrs.get('href', '') if a else ''}
    for d in fe.all(lambda n: n.tag == 'details' and n.attrs.get('id')):
        sm = d.first(lambda n: n.tag == 'summary')
        spans = [s for s in sm.all(lambda n: n.tag == 'span' and n.parent is not None and n.parent.tag == 'span')] if sm else []
        f = {'id': d.attrs['id'], 'title': spans[0].text() if spans else (sm.text() if sm else ''), 'sub': spans[1].text() if len(spans) > 1 else '', 'passages': []}
        for a in d.all(lambda n: n.tag == 'a' and '#/p/' in n.attrs.get('href', '')):
            if not re.search(r'\d', a.text()):
                continue                     # "Read the whole chapter", not a passage of its own
            block, verses = a.parent, []
            for p in block.all(lambda n: n.tag == 'p'):
                if p.first(lambda n: n is a) is not None:
                    continue
                sp = p.first(lambda n: n.tag == 'span'); num = sp.text() if sp else ''; whole = p.text(skip='a')
                if not whole:
                    continue
                verses.append([num, whole[len(num):].strip() if num and whole.startswith(num) else whole])
            f['passages'].append({'ref': a.text(), 'href': a.attrs['href'], 'verses': verses})
        if f['title']:
            out['feelings'].append(f)
    cm = root.first(lambda n: n.attrs.get('id') == 'comfort')
    if cm:
        h2, p0 = cm.first(lambda n: n.tag == 'h2'), cm.first(lambda n: n.tag == 'p')
        c = {'id': 'comfort', 'title': h2.text() if h2 else _('Comfort verses'), 'sub': p0.text() if p0 else '', 'passages': []}
        for ar in cm.all(lambda n: n.tag == 'article'):
            a = ar.first(lambda n: n.tag == 'a'); ps = list(ar.all(lambda n: n.tag == 'p'))
            c['passages'].append({'ref': a.text() if a else '', 'href': a.attrs.get('href', '') if a else '', 'verses': [['', ps[-1].text() if ps else '']]})
        if c['passages']:
            out['comfort'] = c
    return out if out['feelings'] else None


# ---------- the page ----------
class YouPage(Gtk.Box):
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win; self.view = None
        tv = Adw.ToolbarView(); tv.set_vexpand(True); self.append(tv)
        hb = Adw.HeaderBar(); tv.add_top_bar(hb); win.sidebar_button(hb)
        self.back = Gtk.Button(icon_name='kjt-prev-symbolic', tooltip_text=_('All feelings'), visible=False); self.back.connect('clicked', lambda *_a: self.list())
        hb.pack_start(self.back)
        self.title = Gtk.Label(label=_('You Today'), ellipsize=Pango.EllipsizeMode.END); self.title.add_css_class('heading'); hb.set_title_widget(self.title)
        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=14, margin_top=18, margin_bottom=30, margin_start=16, margin_end=16)
        c = Adw.Clamp(maximum_size=820); c.set_child(self.box)
        self.sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); self.sc.set_child(c); tv.set_content(self.sc)
        k = Gtk.EventControllerKey(); k.connect('key-pressed', lambda c, kv, *_a: (self.list(), True)[1] if kv in (Gdk.KEY_Escape, Gdk.KEY_BackSpace) and self.view else False)
        self.add_controller(k)
        self.loaded_lang = None

    def key(self):
        return 'you_' + lang()

    def data(self):
        return STORE.kv(self.key())

    def refresh(self):
        if self.loaded_lang != lang():
            self.loaded_lang = lang(); self.list()
        if not NET.online():
            return
        url = page_url('you', SITE + '/how-are-you-today/')
        k = self.key()
        def work():
            d = parse_you(NET.get(url, timeout=60, strict=True).decode('utf-8', 'replace'))
            if d:
                STORE.set_kv(k, d)
            return d
        def done(d):
            if isinstance(d, dict) and self.view is None and k == self.key():
                self.list()
        run_bg(work, done)

    def clear(self):
        while self.box.get_first_child():
            self.box.remove(self.box.get_first_child())

    def label(self, s, *classes, sel=False, markup=False):
        l = Gtk.Label(xalign=0, wrap=True, wrap_mode=Pango.WrapMode.WORD_CHAR, selectable=sel)
        l.set_markup(s) if markup else l.set_label(s)
        for c in classes:
            l.add_css_class(c)
        return l

    def ref_button(self, ref, href):
        b = Gtk.Button(label=ref + ' →', halign=Gtk.Align.START, tooltip_text=_('Read the chapter')); b.add_css_class('flat'); b.add_css_class('kjt-you-ref')
        b.connect('clicked', lambda *_a: self.win.open_link(href)); return b

    def list(self):
        self.view = None; self.back.set_visible(False); self.title.set_label(_('You Today')); self.clear()
        d = self.data()
        hero = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6); hero.add_css_class('kjt-you-hero')
        inner = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_top=18, margin_bottom=18, margin_start=20, margin_end=20); hero.append(inner)
        inner.append(self.label('💬 ' + _('You Today').upper(), 'kjt-you-kick'))
        inner.append(self.label(_('How are you today?'), 'kjt-you-big'))
        inner.append(self.label(_('Choose how you feel. God speaks to you in the Scriptures.'), 'kjt-you-sub'))
        if d and (d.get('quote') or {}).get('text'):
            inner.append(self.label('“' + d['quote']['text'] + '”', 'kjt-you-quote', sel=True))
            if d['quote'].get('ref'):
                inner.append(self.ref_button(d['quote']['ref'], d['quote'].get('href', '')))
        self.box.append(hero)
        if not d:
            self.box.append(self.label(_('Loading…') if NET.online() else _('Open this page once with internet: it is then kept on this device.'), 'dim-label'))
            return
        grid = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, homogeneous=True, min_children_per_line=1, max_children_per_line=3, valign=Gtk.Align.START,
                           column_spacing=10, row_spacing=10)
        for f in d['feelings'] + ([d['comfort']] if d.get('comfort') else []):
            b = Gtk.Button(); b.add_css_class('kjt-you-feel')
            if f['id'] == 'comfort':
                b.add_css_class('kjt-you-comfort')
            row = Gtk.Box(spacing=12, margin_top=8, margin_bottom=8, margin_start=6, margin_end=6)
            e = Gtk.Label(label=EMO.get(f['id'], '✨')); e.add_css_class('kjt-you-emo'); row.append(e)
            col = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True)
            t = self.label(f['title'], 'kjt-you-ft'); t.set_max_width_chars(18); col.append(t)
            if f.get('sub'):
                s = self.label(f['sub'], 'kjt-you-fs'); s.set_lines(2); s.set_ellipsize(Pango.EllipsizeMode.END); s.set_max_width_chars(22); col.append(s)
            row.append(col); b.set_child(row)
            b.connect('clicked', lambda _b, f=f: self.detail(f))
            grid.append(b)
        self.box.append(grid)
        GLib.idle_add(lambda: (self.sc.get_vadjustment().set_value(0), False)[1])

    def detail(self, f):
        self.view = f['id']; self.back.set_visible(True); self.title.set_label(f['title']); self.clear()
        head = Gtk.Box(spacing=14)
        e = Gtk.Label(label=EMO.get(f['id'], '✨')); e.add_css_class('kjt-you-emo-big'); head.append(e)
        col = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, valign=Gtk.Align.CENTER)
        col.append(self.label(f['title'], 'kjt-you-big2'))
        if f.get('sub'):
            col.append(self.label(f['sub'], 'dim-label'))
        head.append(col); self.box.append(head)
        for p in f['passages']:
            card = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6); card.add_css_class('card'); card.add_css_class('kjt-card')
            inner = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_top=10, margin_bottom=10, margin_start=14, margin_end=14); card.append(inner)
            top = Gtk.Box(spacing=6); top.append(self.ref_button(p['ref'], p['href']))
            plain = p['ref'] + '\n' + '\n'.join(((n + ' ') if n else '') + t for n, t in p['verses'])
            cp = Gtk.Button(icon_name='kjt-copy-symbolic', tooltip_text=_('Copy'), hexpand=True, halign=Gtk.Align.END); cp.add_css_class('flat')
            cp.connect('clicked', lambda b, s=plain: (Gdk.Display.get_default().get_clipboard().set(s), self.win.toast(_('Copied'))))
            top.append(cp); inner.append(top)
            mk = ' '.join(('<sup><small>%s</small></sup> ' % GLib.markup_escape_text(n) if n else '') + GLib.markup_escape_text(t) for n, t in p['verses'])
            inner.append(self.label(mk, 'kjt-you-verse', sel=True, markup=True))
            self.box.append(card)
        end = Gtk.Box(spacing=10, halign=Gtk.Align.CENTER, margin_top=6)
        pray = Gtk.Button(label='🙏 ' + _('Pray about it')); pray.add_css_class('suggested-action'); pray.add_css_class('pill')
        pray.connect('clicked', lambda *_a: self.win.show('pray')); end.append(pray)
        allb = Gtk.Button(label='← ' + _('All feelings')); allb.add_css_class('pill'); allb.connect('clicked', lambda *_a: self.list()); end.append(allb)
        self.box.append(end)
        GLib.idle_add(lambda: (self.sc.get_vadjustment().set_value(0), False)[1])
