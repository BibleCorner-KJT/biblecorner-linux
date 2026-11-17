"""2.8 · The daily Verse of the day post, for the website's administrators (as in the Android app): the picture in each
chosen language and its words, sent with one click to the SimpleX groups first, then Telegram (both set on the website:
Tools › App notifications), or copied / saved to send by hand."""
import base64, io, json, threading, datetime
from gi.repository import Gtk, Adw, Gdk, GLib, Gio, Pango
from .core import NET, SET
from . import picture

LANGS = [('en', 'English', 'eng-kjv', 'VERSE OF THE DAY'), ('ar', 'العربية', 'arb-vd', 'آية اليوم'), ('el', 'Ελληνικά', 'grcorth', 'ΕΔΑΦΙΟ ΤΗΣ ΗΜΕΡΑΣ'),
         ('ru', 'Русский', 'russyn', 'СТИХ ДНЯ'), ('zh', '中文', 'cmn-cu89s', '每日经文'), ('fr', 'Français', 'fraLSG', 'VERSET DU JOUR'),
         ('hi', 'हिन्दी', 'hin2017', 'आज का वचन'), ('es', 'Español', 'spaRV1909', 'VERSÍCULO DEL DÍA'), ('tl', 'Tagalog', 'tglulb', 'TALATA NG ARAW')]


def bg(fn, done):
    def run():
        try:
            r = fn()
        except Exception as e:
            r = {'success': False, 'data': {'why': str(e)}}
        GLib.idle_add(lambda: (done(r), False)[1])
    threading.Thread(target=run, daemon=True).start()


def open_post(win):
    d = Adw.Dialog(title='Daily verse post', content_width=760, content_height=760)
    tv = Adw.ToolbarView(); tv.add_top_bar(Adw.HeaderBar())
    box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=12, margin_top=12, margin_bottom=20, margin_start=16, margin_end=16)
    sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); sc.set_child(box); tv.set_content(sc); d.set_child(tv)
    wait = Gtk.Label(label='Loading…', xalign=0, css_classes=['dim-label']); box.append(wait)
    d.present(win)

    def got(r):
        box.remove(wait)
        if not r.get('success'):
            box.append(Gtk.Label(label="This is for the website's administrators. Sign in with your admin account (My Study › Sign in), then open it again.", wrap=True, xalign=0))
            return
        draw(r['data'])

    def checks(title, items, key):
        picked = SET.get(key)
        row = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=6, column_spacing=4, row_spacing=4)
        lab = Gtk.Label(label=title, xalign=0, css_classes=['heading']); box.append(lab); box.append(row)
        cbs = []
        for it in items:
            cb = Gtk.CheckButton(label=it['l'], active=picked is None or it['i'] in picked); cb.i = it['i']; cbs.append(cb); row.append(cb)
            cb.connect('toggled', lambda *_: SET.set(key, [c.i for c in cbs if c.get_active()]))
        return lambda: [c.i for c in cbs if c.get_active()]

    def draw(info):
        box.append(Gtk.Label(label='The Verse of the day as a picture and words in each language you tick. Look at them, then send with one click.', wrap=True, xalign=0))
        if not info.get('simplex'):
            box.append(Gtk.Label(label='The SimpleX bot is not set up on the website yet (Tools › App notifications › Daily posts (SimpleX)). Until then: copy the picture and the words, and paste them in SimpleX.', wrap=True, xalign=0, css_classes=['warning']))
        groups = checks('SimpleX', info.get('groups') or [], 'dp_groups') if info.get('simplex') else (lambda: [])
        chats = checks('Telegram', info.get('chats') or [], 'dp_chats') if info.get('telegram') else (lambda: [])
        langs = SET.get('dp_langs') or info.get('langs') or ['en']
        lrow = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=9, column_spacing=4, row_spacing=4)
        box.append(Gtk.Label(label='Languages', xalign=0, css_classes=['heading'])); box.append(lrow)
        cards = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=16)
        made = {}
        def sync(*_):
            on = [L[0] for L, cb in lchecks if cb.get_active()]; SET.set('dp_langs', on)
            for L, cb in lchecks:
                if cb.get_active() and L[0] not in made:
                    made[L[0]] = card(L, info, groups, chats); cards.append(made[L[0]])
                if L[0] in made:
                    made[L[0]].set_visible(cb.get_active())
        lchecks = []
        for L in LANGS:
            cb = Gtk.CheckButton(label=L[1], active=L[0] in langs); cb.connect('toggled', sync); lchecks.append((L, cb)); lrow.append(cb)
        if info.get('simplex') or info.get('telegram'):
            allb = Gtk.Button(label='📤 Send all' + (' to SimpleX' + (' and Telegram' if info.get('telegram') else '') if info.get('simplex') else ' to Telegram'), halign=Gtk.Align.START)
            allb.add_css_class('suggested-action'); allb.add_css_class('pill')
            def send_all(*_):
                todo = [c for c in cards if c.get_visible() and getattr(c, 'ready', False)]
                def step(i):
                    if i >= len(todo):
                        return
                    c = todo[i]
                    after = lambda: step(i + 1)
                    if info.get('simplex'):
                        c.send('sx', lambda: c.send('tg', after) if info.get('telegram') else after())
                    else:
                        c.send('tg', after)
                step(0)
            allb.connect('clicked', send_all); box.append(allb)
        box.append(cards)
        sync()

    def card(L, info, groups, chats):
        c = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8); c.add_css_class('card')
        inner = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=8, margin_top=10, margin_bottom=10, margin_start=10, margin_end=10); c.append(inner)
        inner.append(Gtk.Label(label=L[1], xalign=0, css_classes=['title-3']))
        st = Gtk.Label(xalign=0, wrap=True, css_classes=['caption']); inner.append(st)
        pic = Gtk.Picture(can_shrink=True, content_fit=Gtk.ContentFit.CONTAIN, height_request=360); inner.append(pic)
        cap = Gtk.TextView(wrap_mode=Gtk.WrapMode.WORD_CHAR, top_margin=6, bottom_margin=6, left_margin=6, right_margin=6, height_request=120); cap.add_css_class('card'); inner.append(cap)
        row = Gtk.Box(spacing=6); inner.append(row)
        sx = Gtk.Button(label='📤 SimpleX', visible=bool(info.get('simplex'))); sx.add_css_class('suggested-action')
        tg = Gtk.Button(label='📤 Telegram', visible=bool(info.get('telegram')))
        cp = Gtk.Button(label='Copy the picture'); cw = Gtk.Button(label='Copy the words'); sv = Gtk.Button(label='Save the picture…')
        for b in (sx, tg, cp, cw, sv):
            row.append(b); b.set_sensitive(False)
        lg = (info.get('log') or {}).get(L[0])
        if lg and lg.get('d') == info.get('today'):
            st.set_label('✓ Sent today at %s' % lg.get('t'))
        state = {}
        c.ready = False

        def loaded(r):
            v = ((r.get('data') or {}).get('votd') or {}) if r.get('success') else {}
            if not v.get('text'):
                st.set_label('The Verse of the day could not be loaded (internet?).'); return
            surf = picture.render(v['text'], v['ref'])
            buf = io.BytesIO(); surf.write_to_png(buf); state['png'] = buf.getvalue(); state['surf'] = surf
            pic.set_paintable(picture.texture(surf))
            try:
                date = datetime.date.today().strftime('%d %B %Y').lstrip('0')
            except Exception:
                date = ''
            rtl = any('֐' <= ch <= 'ࣿ' for ch in v['text'])
            text = '☦ %s · %s\n\n%s\n— %s\n\nhttps://biblecorner.com/' % (L[3], date, ('«%s»' if rtl else '“%s”') % v['text'], v['ref'])
            cap.get_buffer().set_text(text)
            if v.get('tr') and v['tr'] != L[2]:
                st.set_label('⚠ %s is not on the website: the verse is in another Bible (%s).' % (L[2], v['tr']))
            for b in (sx, tg, cp, cw, sv):
                b.set_sensitive(True)
            c.ready = True
        bg(lambda: NET.ajax('kjtb_app_notices', since=0, votd=1, lang=L[0], tr=L[2]), loaded)

        def words():
            b = cap.get_buffer(); return b.get_text(b.get_start_iter(), b.get_end_iter(), False)

        def send(kind, then=None):
            if not c.ready:
                if then:
                    then()
                return
            ids = groups() if kind == 'sx' else chats()
            if not ids:
                st.set_label('Tick at least one %s above.' % ('SimpleX group' if kind == 'sx' else 'Telegram chat'))
                if then:
                    then()
                return
            btn = sx if kind == 'sx' else tg; btn.set_sensitive(False)
            st.set_label('Sending to %s…%s' % ('SimpleX' if kind == 'sx' else 'Telegram', ' (it can take a minute)' if kind == 'sx' else ''))
            post = {'nonce': info['nonce'], 'img': base64.b64encode(state['png']).decode(), 'caption': words(), 'lang': L[0], ('groups' if kind == 'sx' else 'chats'): ','.join(str(i) for i in ids)}
            def done(r):
                btn.set_sensitive(True)
                sent = ((r.get('data') or {}).get('sent') or []) if r.get('success') else []
                good = [x['l'] for x in sent if x.get('ok')]; bad = ['%s: %s' % (x['l'], x.get('err')) for x in sent if not x.get('ok')]
                if good and not bad:
                    st.set_label('✓ Sent at %s · %s' % (datetime.datetime.now().strftime('%H:%M'), ', '.join(good)))
                else:
                    st.set_label(('✓ ' + ', '.join(good) + ' · ' if good else '') + '✗ ' + (' · '.join(bad) or 'Not sent (%s)' % ((r.get('data') or {}).get('why') or 'error')))
                if then:
                    then()
            bg(lambda: NET.ajax('kjtb_dpost_sx' if kind == 'sx' else 'kjtb_dpost_send', post), done)
        c.send = send
        sx.connect('clicked', lambda *_: send('sx')); tg.connect('clicked', lambda *_: send('tg'))
        cp.connect('clicked', lambda *_: (Gdk.Display.get_default().get_clipboard().set(picture.texture(state['surf'])), st.set_label('Picture copied: paste it in SimpleX or anywhere.')))
        cw.connect('clicked', lambda *_: (Gdk.Display.get_default().get_clipboard().set(words()), st.set_label('Words copied.')))
        def save(*_):
            fd = Gtk.FileDialog(initial_name='verse-of-the-day-%s.png' % L[0])
            def fin(dlg, res):
                try:
                    f = dlg.save_finish(res)
                except GLib.Error:
                    return
                with open(f.get_path(), 'wb') as fh:
                    fh.write(state['png'])
                st.set_label('Saved.')
            fd.save(win, None, fin)
        sv.connect('clicked', save)
        return c

    bg(lambda: NET.ajax('kjtb_dpost_info', _=str(datetime.datetime.now().timestamp())), got)
