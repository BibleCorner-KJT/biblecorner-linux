"""2.43: Add a church, and "Error? Fix it here" for a church, in the app (as on the website's Find a Church page).
The form goes to the website, which checks it and sends it to the people who look after the directory.
- A click on the map puts the church in its place (Map or Satellite); a position pasted in any form (Google Maps or
  Earth, OpenStreetMap, degrees-minutes-seconds) is turned into the form the website uses.
- The address as each country writes it: Canada with province and postal code, the USA with state and ZIP code.
- For a correction: the form is filled with what the app shows; you tick what is wrong and correct it."""
import json, math, os, re
from urllib.parse import urlencode
from gi.repository import Gtk, Adw, GLib
from .core import SITE, NET, lang, run_bg
from .i18n import _
from .tilemap import TileMap

STATES = {
    'US': {'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California', 'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware',
           'DC': 'District of Columbia', 'FL': 'Florida', 'GA': 'Georgia', 'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
           'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland', 'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota',
           'MS': 'Mississippi', 'MO': 'Missouri', 'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
           'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio', 'OK': 'Oklahoma', 'OR': 'Oregon',
           'PA': 'Pennsylvania', 'PR': 'Puerto Rico', 'RI': 'Rhode Island', 'SC': 'South Carolina', 'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas',
           'UT': 'Utah', 'VT': 'Vermont', 'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming'},
    'CA': {'AB': 'Alberta', 'BC': 'British Columbia', 'MB': 'Manitoba', 'NB': 'New Brunswick', 'NL': 'Newfoundland and Labrador', 'NS': 'Nova Scotia',
           'NT': 'Northwest Territories', 'NU': 'Nunavut', 'ON': 'Ontario', 'PE': 'Prince Edward Island', 'QC': 'Quebec', 'SK': 'Saskatchewan', 'YT': 'Yukon'}}


# ---------- a position written in any of the usual ways (as the website's pick.js) ----------
def _done(a, b, swapped=False):
    if a is None or b is None or not (math.isfinite(a) and math.isfinite(b)):
        return None
    if abs(a) > 90 and abs(b) <= 90:
        a, b, swapped = b, a, True
    if abs(a) > 90 or abs(b) > 180:
        return None
    return round(a, 6), round(b, 6), swapped


_BODY = r"(-?\d+(?:\.\d+)?)\s*(?:°|DEG\b|D\b)?\s*(?:(\d+(?:\.\d+)?)\s*(?:'|MIN\b|M\b))?\s*(?:(\d+(?:\.\d+)?)\s*(?:\"|SEC\b|S\b(?!\s*\d)))?"
_BEFORE = re.compile(r'([NSEW])\s*' + _BODY)
_AFTER = re.compile(_BODY + r'\s*([NSEW])?')


def parse_pos(text):
    """(lat, lon, swapped) in decimal degrees, North and East positive; None if it can't be read"""
    s = (text or '').strip()
    if not s:
        return None
    for pat in (r'!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)', r'[?&](?:q|ll|query|center|destination|daddr)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*\+?(-?\d+(?:\.\d+)?)',
                r'@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)', r'#map=\d+(?:\.\d+)?/(-?\d+(?:\.\d+)?)/(-?\d+(?:\.\d+)?)'):
        m = re.search(pat, s, re.I)
        if m:
            return _done(float(m.group(1)), float(m.group(2)))
    m1, m2 = re.search(r'mlat=(-?\d+(?:\.\d+)?)', s), re.search(r'mlon=(-?\d+(?:\.\d+)?)', s)
    if m1 and m2:
        return _done(float(m1.group(1)), float(m2.group(1)))
    if re.match(r'https?://', s, re.I):
        return None
    s = s.upper()
    for a, b in (("′’‘´`", "'"), ('″“”', '"'), ('º˚', '°')):
        for ch in a:
            s = s.replace(ch, b)
    for w, l in (('NORTH', 'N'), ('SOUTH', 'S'), ('EAST', 'E'), ('WEST', 'W')):
        s = re.sub(r'\b' + w + r'\b', l, s)
    s = re.sub(r"(\d)\s*''", r'\1"', s)
    if not re.search(r'[°\'"NSEW]', s):
        m = re.match(r'^(-?\d+,\d+)\s*[;\s]\s*(-?\d+,\d+)$', s)
        if m:
            return _done(float(m.group(1).replace(',', '.')), float(m.group(2).replace(',', '.')))
        n = re.findall(r'-?\d+(?:\.\d+)?', s)
        return _done(float(n[0]), float(n[1])) if len(n) == 2 else None
    s = re.sub(r'(\d),(\d)', r'\1.\2', s)
    first = bool(re.match(r'^[NSEW]', s)); parts = []
    for m in (_BEFORE if first else _AFTER).finditer(s):
        if not m.group(0).strip():
            continue
        h, d, mi, se = (m.group(1), m.group(2), m.group(3), m.group(4)) if first else (m.group(4), m.group(1), m.group(2), m.group(3))
        if d is None:
            continue
        if (mi and float(mi) >= 60) or (se and float(se) >= 60):
            return None
        v = abs(float(d)) + (float(mi) / 60 if mi else 0) + (float(se) / 3600 if se else 0)
        if d.startswith('-') or h in ('S', 'W'):
            v = -v
        parts.append((v, h or ''))
        if len(parts) > 2:
            break
    if len(parts) != 2:
        return None
    (av, ah), (bv, bh) = parts
    if ah in ('E', 'W') or bh in ('N', 'S'):
        return _done(bv, av, True)
    return _done(av, bv)


def dms(lat, lon):
    """the same place as Google Earth writes it"""
    def one(x, pos, neg):
        h = neg if x < 0 else pos; x = abs(x); d = int(x); mf = (x - d) * 60; mi = int(mf); se = round((mf - mi) * 60, 1)
        if se >= 60:
            se = 0; mi += 1
        if mi >= 60:
            mi = 0; d += 1
        return '%d°%02d\'%04.1f"%s' % (d, mi, se, h)
    return one(lat, 'N', 'S') + ' ' + one(lon, 'E', 'W')


def postcode_ok(cc, v):
    """the postcode as the country writes it, '' for none, None when it can't be one"""
    v = (v or '').strip().upper()
    if not v:
        return ''
    if cc == 'US':
        m = re.match(r'^(\d{5})(?:[- ]?(\d{4}))?$', v)
        return (m.group(1) + ('-' + m.group(2) if m.group(2) else '')) if m else None
    if cc == 'CA':
        m = re.match(r'^([ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z])(\d[ABCEGHJ-NPRSTV-Z]\d)$', re.sub(r'\s+', '', v))
        return (m.group(1) + ' ' + m.group(2)) if m else None
    return v


_COUNTRIES = None


def countries():
    global _COUNTRIES
    if _COUNTRIES is None:
        try:
            with open(os.path.join(os.path.dirname(__file__), 'countries.json'), encoding='utf-8') as f:
                _COUNTRIES = json.load(f)
        except Exception:
            _COUNTRIES = {}
    d = _COUNTRIES.get(lang()) or _COUNTRIES.get('en') or {}
    return sorted(d.items(), key=lambda x: x[1].casefold())


# ---------- the form ----------
WRONG = [('name', 'The name'), ('address', 'The address'), ('kind', 'Church or monastery, or the jurisdiction'), ('place', 'The place on the map'),
         ('contact', 'Website, email or phone'), ('closed', 'It is closed, or not Orthodox')]


def open_form(win, page, r=None):
    """r: the church to correct (a row of the directory), or None to add a new one"""
    from .church import KINDS, KIND_NAMES, JURS
    d = Adw.Dialog(title=_('Error? Fix it here') if r else _('Add a church'), content_width=640, content_height=760)
    tv = Adw.ToolbarView(); hb = Adw.HeaderBar(show_end_title_buttons=False, show_start_title_buttons=False)
    cancel = Gtk.Button(label=_('Cancel')); cancel.connect('clicked', lambda *_a: d.close()); hb.pack_start(cancel)
    send = Gtk.Button(label=_('Send')); send.add_css_class('suggested-action'); hb.pack_end(send)
    tv.add_top_bar(hb); d.set_child(tv)
    pg = Adw.PreferencesPage(); tv.set_content(pg)
    st = Gtk.Label(xalign=0, wrap=True, margin_start=12, margin_end=12); st.add_css_class('heading')
    stw = Adw.PreferencesGroup(); stw.add(st); stw.set_visible(False); pg.add(stw)
    def say(t, bad=True):
        st.set_label(t); stw.set_visible(bool(t)); st.remove_css_class('error' if not bad else 'success'); st.add_css_class('error' if bad else 'success')
    # what is wrong (a correction)
    checks = []
    if r:
        g = Adw.PreferencesGroup(title=_('What is wrong?'), description=_('Correct it in the boxes below, then press Send.'))
        for k, lab in WRONG:
            row = Adw.ActionRow(title=_(lab)); cb = Gtk.CheckButton(valign=Gtk.Align.CENTER); row.add_prefix(cb); row.set_activatable_widget(cb); g.add(row); checks.append((k, cb))
        pg.add(g)
    # the church
    g = Adw.PreferencesGroup(title=_('The church'))
    name = Adw.EntryRow(title=_('Name of the church or monastery')); name_en = Adw.EntryRow(title=_('Name in English'))
    kind = Adw.ComboRow(title=_('Kind'), model=Gtk.StringList.new([_(KIND_NAMES[k]) for k in KINDS]))
    jk = sorted(JURS, key=lambda k: (k == 'other', JURS[k])); jur = Adw.ComboRow(title=_('Jurisdiction'), model=Gtk.StringList.new([_(JURS[k]) for k in jk]))
    for w in (name, name_en, kind, jur):
        g.add(w)
    pg.add(g)
    # the address
    g = Adw.PreferencesGroup(title=_('Address'))
    cl = countries(); ccodes = [''] + [c for c, _n in cl]
    ctry = Adw.ComboRow(title=_('Country'), model=Gtk.StringList.new(['—'] + [n for _c, n in cl]), enable_search=True)
    ctry.set_expression(Gtk.PropertyExpression.new(Gtk.StringObject, None, 'string'))   # what typing searches in
    street = Adw.EntryRow(title=_('Street address')); city = Adw.EntryRow(title=_('Town or city'))
    region_e = Adw.EntryRow(title=_('State, province or region')); region_c = Adw.ComboRow(title=_('State'))
    post = Adw.EntryRow(title=_('Postcode')); perr = Gtk.Label(xalign=0, wrap=True, visible=False, margin_start=12); perr.add_css_class('error')
    for w in (ctry, street, city, region_e, region_c, post):
        g.add(w)
    g.add(perr); pg.add(g)
    rkeys = []
    def cc():
        i = ctry.get_selected(); return ccodes[i] if 0 <= i < len(ccodes) else ''
    def addr_for(*_a):
        c = cc(); stt = STATES.get(c)
        keep = (rkeys[region_c.get_selected()] if region_c.get_visible() and region_c.get_selected() < len(rkeys) else region_e.get_text()).strip()
        region_c.set_visible(bool(stt)); region_e.set_visible(not stt)
        if stt:
            rkeys[:] = [''] + list(stt)
            region_c.set_title(_('State') if c == 'US' else _('Province or territory'))
            region_c.set_model(Gtk.StringList.new(['—'] + ['%s (%s)' % (stt[k], k) for k in stt]))
            hit = [k for k in stt if k == keep.upper() or stt[k].lower() == keep.lower()]
            region_c.set_selected(rkeys.index(hit[0]) if hit else 0)
        else:
            if keep and (keep.upper() in STATES['US'] or keep.upper() in STATES['CA']):
                keep = STATES['US'].get(keep.upper()) or STATES['CA'].get(keep.upper(), keep)
            region_e.set_text(keep)
        post.set_title(_('ZIP code') if c == 'US' else _('Postal code') if c == 'CA' else _('Postcode'))
        check_post(True)
    def check_post(quiet=False):
        v = postcode_ok(cc(), post.get_text())
        if v is None:
            perr.set_label(_('A ZIP code has 5 numbers, like 10001 (or 10001-1234).') if cc() == 'US' else _('A Canadian postal code is like K1A 0B1.'))
            perr.set_visible(not quiet or bool(post.get_text())); return False
        perr.set_visible(False)
        if v and cc() in ('US', 'CA') and v != post.get_text():
            post.set_text(v)
        return True
    ctry.connect('notify::selected', addr_for)
    fc = Gtk.EventControllerFocus(); fc.connect('leave', lambda *_a: check_post(False)); post.add_controller(fc)
    # the place on the map
    g = Adw.PreferencesGroup(title=_('Where is it? Click the church on the map.'), description=_('Optional, but it helps us put it in the right place. Zoom in, then click on the church.'))
    pos = {'lat': None, 'lon': None}
    info = Gtk.Label(xalign=0, wrap=True, selectable=True, margin_start=4); info.add_css_class('heading')
    m = TileMap(); m.set_size_request(-1, 300)
    def show(la, lo, how=''):
        pos['lat'], pos['lon'] = (round(la, 6), round(lo, 6)) if la is not None else (None, None)
        m.set_pin(la, lo); clear.set_sensitive(la is not None)
        info.set_label(('📍 %.6f, %.6f  (%s)' % (la, lo, dms(la, lo)) + (' · ' + how if how else '')) if la is not None else '')
    m.on_point = lambda la, lo: show(la, lo, _('Set from the map'))
    frame = Gtk.Frame(); frame.set_child(m); g.add(frame); g.add(info)
    paste = Adw.EntryRow(title=_('Or paste its position (from Google Maps, Google Earth or OpenStreetMap)'), show_apply_button=True)
    def pasted(*_a):
        v = parse_pos(paste.get_text())
        if not v:
            say('⚠ ' + _('This position could not be read. Try 40.712806, -74.006000 or 40°42′46.1″N 74°00′21.6″W, or click the map.')); return
        say(''); show(v[0], v[1], _('Converted from what you pasted')); m.center(v[0], v[1], max(m.z, 17))
    paste.connect('apply', pasted); paste.connect('entry-activated', pasted); g.add(paste)
    clear = Gtk.Button(label=_('Remove the pin'), halign=Gtk.Align.START, sensitive=False, margin_top=6); clear.add_css_class('flat')
    clear.connect('clicked', lambda *_a: show(None, None)); g.add(clear)
    pg.add(g)
    # contact
    g = Adw.PreferencesGroup(title=_('Contact'))
    web = Adw.EntryRow(title=_('Website')); cmail = Adw.EntryRow(title=_('Email or contact page of the church')); phone = Adw.EntryRow(title=_('Phone'))
    for w in (web, cmail, phone):
        g.add(w)
    pg.add(g)
    g = Adw.PreferencesGroup(title=_('What should we know?'))
    tvw = Gtk.TextView(wrap_mode=Gtk.WrapMode.WORD_CHAR, top_margin=8, bottom_margin=8, left_margin=8, right_margin=8); tvw.set_size_request(-1, 90)
    fr = Gtk.Frame(); fr.set_child(tvw); g.add(fr)
    you = Adw.EntryRow(title=_('Your email') + ' (' + _('optional, only if you would like an answer') + ')'); g.add(you)
    pg.add(g)
    # filled with what the app shows (a correction), or ready for a new church
    if r:
        name.set_text(r.get('name') or ''); name_en.set_text(r.get('name_en') or '')
        kind.set_selected(KINDS.index(r['kind']) if r.get('kind') in KINDS else 0); jur.set_selected(jk.index(r['jur']) if r.get('jur') in jk else len(jk) - 1)
        if r.get('country') in ccodes:
            ctry.set_selected(ccodes.index(r['country']))
        region_e.set_text(r.get('region') or ''); street.set_text(r.get('addr') or ''); city.set_text(r.get('city') or '')
        web.set_text(r.get('web') or ''); cmail.set_text(r.get('email') or r.get('contact') or ''); phone.set_text(r.get('phone') or '')
        addr_for(); post.set_text(r.get('postcode') or '')
        if r.get('lat') or r.get('lon'):
            show(r['lat'], r['lon']); m.center(r['lat'], r['lon'], 17)
    else:
        jur.set_selected(len(jk) - 1)
        mp = getattr(page, 'map', None)
        if mp:
            m.center(mp.lat, mp.lon, max(mp.z, 3))
        addr_for()
    def go(*_a):
        if re.search(r'https?://|www\.|@', name.get_text(), re.I):
            say('⚠ ' + _('The name should be the name of the church, not a web address or an email.')); return
        if not name.get_text().strip() and not r:
            say('⚠ ' + _('Please write the name of the church, or what should be corrected.')); return
        if not check_post(False):
            say('⚠ ' + perr.get_label()); return
        if web.get_text().strip() and not re.match(r'^(https?://)?[^\s.]+\.\S{2,}$', web.get_text().strip(), re.I):
            say('⚠ ' + _('Please check the website address.')); return
        if you.get_text().strip() and not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', you.get_text().strip()):
            say('⚠ ' + _('Please check your email.')); return
        b = tvw.get_buffer()
        data = [('church', str(r['id']) if r else ''), ('name', name.get_text().strip()), ('name_en', name_en.get_text().strip()), ('kind', KINDS[kind.get_selected()]),
                ('jur', jk[jur.get_selected()] if jur.get_selected() < len(jk) else 'other'), ('country', cc()), ('addr', street.get_text().strip()), ('city', city.get_text().strip()),
                ('region', (rkeys[region_c.get_selected()] if region_c.get_visible() and region_c.get_selected() < len(rkeys) else region_e.get_text()).strip()),
                ('postcode', post.get_text().strip()), ('lat', '%.6f' % pos['lat'] if pos['lat'] is not None else ''), ('lon', '%.6f' % pos['lon'] if pos['lon'] is not None else ''),
                ('web', web.get_text().strip()), ('cmail', cmail.get_text().strip()), ('phone', phone.get_text().strip()),
                ('note', b.get_text(b.get_start_iter(), b.get_end_iter(), False).strip()), ('email', you.get_text().strip())]
        data += [('wrong[]', k) for k, cb in checks if cb.get_active()]
        send.set_sensitive(False); say(_('Sending…'), False)
        def work():
            try:
                out = NET.get(SITE + '/wp-json/kjt/v1/church-suggest', urlencode(data).encode(), timeout=40)
            except Exception:
                return None
            try:
                return json.loads(out.decode('utf-8'))
            except Exception:
                return None
        def done(j):
            send.set_sensitive(True)
            if not isinstance(j, dict):
                say('⚠ ' + _('It could not be sent. Please check your connection and try again.')); return
            if j.get('ok'):
                win.toast('✓ ' + _(j.get('message') or 'Thank you! We will check it and add it to the directory.')); d.close()
            else:
                say('⚠ ' + _(j.get('message') or 'It could not be sent. Please try again.'))
        run_bg(work, done)
    send.connect('clicked', go)
    d.present(win)
