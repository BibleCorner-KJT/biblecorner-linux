"""Listening: the recorded chapters, played here (from this computer when saved, else from the website).

2.13 · the same player as on the website and in the Android app:
 - the verse being read glows in the Bible and the page follows it ("Follow along"); scroll away and it waits
   ("Back to the verse");
 - previous / next verse and chapter, a position bar, speed (the voice keeps its pitch), a sleep timer
   (15, 30, 60 minutes or the end of the chapter);
 - "Keep listening": the next chapter follows by itself;
 - the recordings of a Bible (the King James: "With music" and "Reading only"), the one with music first, remembered;
 - "Listen from here" on a chosen verse; "Continue where you stopped" on the next start;
 - "Mark as read" from the player (Bible Study Journey), and marked by itself when heard to the end if
   "Mark chapters automatically" is on;
 - keep the chapter or the whole book on this computer, for listening without the internet (verse times kept too)."""
import json, os, re, time
from gi.repository import Gtk, GLib, Adw
from .core import NET, STORE, SET, file_path, run_bg, book_name
from .i18n import _

try:
    import gi
    gi.require_version('Gst', '1.0')
    from gi.repository import Gst
    Gst.init(None)
except Exception:  # no sound system: the app still works
    Gst = None

SPEEDS = ['0.75', '0.8', '0.9', '1', '1.1', '1.25', '1.5']
SLEEP = [('off', 'Off'), ('chapter', 'End of chapter'), ('15', '15 min'), ('30', '30 min'), ('60', '60 min')]


def icon_btn(icon, tip, fn, *cls):
    b = Gtk.Button(icon_name=icon, tooltip_text=_(tip), valign=Gtk.Align.CENTER)
    for c in cls or ('flat',):
        b.add_css_class(c)
    b.connect('clicked', lambda *_: fn())
    return b



# 2.18: the recordings belong to the website's Bibles. The same Bible kept here from CrossWire (the KJV, the Arabic
# Van Dyck) plays the website's recordings of it, with music and reading only.
SHARE = {'eng-kjv2006': 'eng-kjv', 'kjv': 'eng-kjv', 'eng-kjva': 'eng-kjv', 'sw-AraSVD': 'arb-vd', 'sw-ArSVD': 'arb-vd', 'sw-Arasvd': 'arb-vd'}


def atr(tr):
    if tr in SHARE:
        return SHARE[tr]
    if re.match(r'^sw-KJVA?(1769|2006|PCE)?$', tr or '', re.I):
        return 'eng-kjv'
    # 2.52: the Reina-Valera 1909 and the Louis Segond 1910 from CrossWire play the Spanish and French recordings
    if re.match(r'^sw-SpaRV(1909)?$', tr or '', re.I):
        return 'spaRV1909'
    if re.match(r'^sw-Fre(Segond|LSG)$', tr or '', re.I):
        return 'fraLSG'
    return tr

class Audio(Gtk.Revealer):
    def __init__(self, win):
        super().__init__(transition_type=Gtk.RevealerTransitionType.SLIDE_UP)
        self.win = win
        self.cur = None              # (tr, book, ch)
        self.times = []              # [(verse, start seconds)]
        self.verse = 0
        self.url = None
        self.tracks = {}             # tr -> [{'id','label','chapters'}]
        self.track = ''
        self.track_ids = []
        self.busy = False
        self.away_until = 0
        self.sleep = 'off'; self.sleep_at = 0
        self.want_t = 0              # where to start (Continue, Listen from here)
        self.rate = float(SET.get('audio_rate') or 1)
        self.player = None
        if Gst:
            self.player = Gst.ElementFactory.make('playbin', 'kjt-player')
            if self.player:
                st = Gst.ElementFactory.make('scaletempo', None)   # a faster or slower voice keeps its pitch
                if st:
                    self.player.set_property('audio-filter', st)
                bus = self.player.get_bus(); bus.add_signal_watch()
                bus.connect('message::eos', lambda *_: self.ended())
                bus.connect('message::error', self.on_error)
                bus.connect('message::async-done', lambda *_: self.started())

        outer = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4, margin_start=10, margin_end=10, margin_top=6, margin_bottom=6)
        outer.add_css_class('kjt-audio')
        # row 1: the controls, the name, the position
        row = Gtk.Box(spacing=4)
        self.b_prev_ch = icon_btn('media-skip-backward-symbolic', 'Previous chapter', lambda: self.step_ch(-1))
        self.b_prev_v = icon_btn('media-seek-backward-symbolic', 'Previous verse', lambda: self.step_v(-1))
        self.play_btn = icon_btn('kjt-pause-symbolic', 'Play or pause', self.toggle, 'circular', 'suggested-action')
        self.b_next_v = icon_btn('media-seek-forward-symbolic', 'Next verse', lambda: self.step_v(1))
        self.b_next_ch = icon_btn('media-skip-forward-symbolic', 'Next chapter', lambda: self.step_ch(1))
        for b in (self.b_prev_ch, self.b_prev_v, self.play_btn, self.b_next_v, self.b_next_ch):
            row.append(b)
        names = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, valign=Gtk.Align.CENTER, margin_start=6)
        self.title = Gtk.Label(xalign=0, width_chars=12, ellipsize=3); self.title.add_css_class('heading')
        self.vlabel = Gtk.Label(xalign=0, ellipsize=3); self.vlabel.add_css_class('caption'); self.vlabel.add_css_class('dim-label')
        names.append(self.title); names.append(self.vlabel); row.append(names)
        self.scale = Gtk.Scale(orientation=Gtk.Orientation.HORIZONTAL, hexpand=True, draw_value=False, valign=Gtk.Align.CENTER)
        self.scale.set_range(0, 1); self.scale.connect('change-value', self.on_seek); row.append(self.scale)
        self.time = Gtk.Label(); self.time.add_css_class('numeric'); self.time.add_css_class('dim-label'); row.append(self.time)
        self.back_btn = Gtk.Button(label=_('Back to the verse'), visible=False, valign=Gtk.Align.CENTER); self.back_btn.add_css_class('pill')
        self.back_btn.connect('clicked', lambda *_: self.back_to_verse()); row.append(self.back_btn)
        self.more = Gtk.ToggleButton(icon_name='kjt-more-symbolic', tooltip_text=_('More'), valign=Gtk.Align.CENTER, active=bool(SET.get('audio_more')))
        self.more.add_css_class('flat'); row.append(self.more)
        row.append(icon_btn('kjt-close-symbolic', 'Stop', self.stop))
        outer.append(row)
        # row 2: recording, speed, sleep timer, switches, mark as read, keep
        self.opts = Gtk.Revealer(reveal_child=self.more.get_active())
        self.more.connect('toggled', lambda b: (self.opts.set_reveal_child(b.get_active()), SET.set('audio_more', b.get_active())))
        fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=8, column_spacing=10, row_spacing=4, homogeneous=False)
        def labelled(text, w):
            b = Gtk.Box(spacing=6); l = Gtk.Label(label=_(text)); l.add_css_class('dim-label'); b.append(l); b.append(w); return b
        self.track_dd = Gtk.DropDown.new_from_strings([]); self.track_dd.connect('notify::selected', self.on_track)
        self.track_box = labelled('Recording', self.track_dd); self.track_box.set_visible(False); fb.append(self.track_box)
        self.speed_dd = Gtk.DropDown.new_from_strings(['%s×' % s for s in SPEEDS])
        self.speed_dd.set_selected(min(range(len(SPEEDS)), key=lambda i: abs(float(SPEEDS[i]) - self.rate)))
        self.speed_dd.connect('notify::selected', lambda dd, _p: self.set_rate(float(SPEEDS[dd.get_selected()])))
        fb.append(labelled('Speed', self.speed_dd))
        self.sleep_dd = Gtk.DropDown.new_from_strings([_(x[1]) for x in SLEEP])
        self.sleep_dd.connect('notify::selected', lambda dd, _p: self.set_sleep(SLEEP[dd.get_selected()][0]))
        fb.append(labelled('Sleep timer', self.sleep_dd))
        self.keep_sw = Gtk.Switch(active=SET.get('audio_keep') is not False, valign=Gtk.Align.CENTER)
        self.keep_sw.connect('notify::active', lambda s, _p: SET.set('audio_keep', s.get_active()))
        fb.append(labelled('Keep listening', self.keep_sw))
        self.follow_sw = Gtk.Switch(active=SET.get('audio_follow') is not False, valign=Gtk.Align.CENTER)
        self.follow_sw.connect('notify::active', lambda s, _p: (SET.set('audio_follow', s.get_active()), setattr(self, 'away_until', 0), self.follow_now()))
        fb.append(labelled('Follow along', self.follow_sw))
        self.mark_btn = Gtk.Button(); self.mark_btn.add_css_class('pill'); self.mark_btn.connect('clicked', lambda *_: self.mark_read())
        fb.append(self.mark_btn)
        self.save_btn = Gtk.Button(icon_name='kjt-download-symbolic', tooltip_text=_('Keep this chapter on this computer')); self.save_btn.add_css_class('flat')
        self.save_btn.connect('clicked', lambda *_: self.save())
        self.book_btn = Gtk.Button(label=_('Keep the whole book')); self.book_btn.add_css_class('flat')
        self.book_btn.connect('clicked', lambda *_: self.save_whole_book())
        fb.append(self.save_btn); fb.append(self.book_btn)
        self.opts.set_child(fb); outer.append(self.opts)
        self.set_child(outer)
        GLib.timeout_add(250, self.tick)
        from .journey import JOURNEY
        JOURNEY.listen(lambda: GLib.idle_add(lambda: (self.draw_mark(), False)[1]))
        GLib.timeout_add_seconds(4, self.offer_resume)

    # ---------- small screens
    def set_compact(self, c):
        self.time.set_visible(not c)
        for b in (self.b_prev_v, self.b_next_v):
            b.set_visible(not c)
        self.title.set_width_chars(5 if c else 12)   # 2.34: fits a phone's screen

    # ---------- where the recordings are
    def folder(self, tr, track=None):
        t = self.track if track is None else track
        return tr + ('_' + re.sub(r'[^a-z0-9-]', '', t) if t else '')

    def local(self, tr, book, ch, track=None):
        return file_path('audio/%s/%s/%d.mp3' % (self.folder(tr, track), book, ch))

    def tracks_of(self, tr, book, ch):
        out = []
        for t in self.tracks.get(tr) or []:
            if int(ch) in [int(x) for x in ((t.get('chapters') or {}).get(book) or [])]:
                out.append(t)
        return out

    def prefetch(self, tr):
        """which chapters have recordings (for "Listen from here")"""
        if tr in self.tracks or getattr(self, 'asking', None) == tr:
            return
        self.asking = tr
        def work():
            r = NET.ajax('kjtb_audio', tr=atr(tr))
            return ((r.get('data') or {}).get('tracks') or []) if r.get('success') else []
        def done(ts):
            self.asking = None
            if isinstance(ts, list) and ts:   # 2.52: "no recordings" is asked again later
                self.tracks[tr] = ts
        run_bg(work, done)

    def has_audio(self, tr, book, ch):
        if any(os.path.exists(self.local(tr, book, ch, track=t)) for t in ('', 'music')):
            return True
        return bool(self.tracks_of(tr, book, ch))

    def pick(self, tr, book, ch):
        ts = self.tracks_of(tr, book, ch)
        want = SET.get('audio_track')
        t = next((x for x in ts if x.get('id') == want), None) or (ts[0] if ts else None)
        self.track = ((t or {}).get('id', '') or '') if ts else (want or '')
        self.busy = True
        self.track_ids = [x.get('id', '') for x in ts]
        self.track_dd.set_model(Gtk.StringList.new([_(x.get('label') or '') for x in ts]))
        if self.track in self.track_ids:
            self.track_dd.set_selected(self.track_ids.index(self.track))
        self.track_box.set_visible(len(ts) > 1)
        self.busy = False

    def on_track(self, dd, _p):
        if self.busy or not self.cur:
            return
        i = dd.get_selected()
        if 0 <= i < len(self.track_ids) and self.track_ids[i] != self.track:
            SET.set('audio_track', self.track_ids[i])
            tr, book, ch = self.cur
            self.want_t = self.position()
            self.play_chapter(tr, book, ch, keep_time=True)

    # ---------- playing
    def play_chapter(self, tr, book, ch, verse=0, keep_time=False):
        if not self.player:
            self.win.toast(_('Sound is not available on this computer')); return
        self.cur = (tr, book, int(ch)); self.times = []; self.verse = 0; self.url = None
        if not keep_time:
            self.want_t = 0
        self.want_v = int(verse or 0)
        self.title.set_label('%s %d' % (book_name(book, tr=tr), int(ch))); self.vlabel.set_label('')
        self.draw_mark()

        def find():
            if not self.tracks.get(tr):   # 2.52: "no recordings" is asked again (recordings added later are found)
                r = NET.ajax('kjtb_audio', tr=atr(tr))
                self.tracks[tr] = ((r.get('data') or {}).get('tracks') or []) if r.get('success') else []
            return True

        def chosen(r=None):
            if isinstance(r, Exception):
                self.tracks.pop(tr, None)
            if self.cur != (tr, book, int(ch)):
                return
            self.pick(tr, book, ch)
            p = self.local(tr, book, int(ch))
            if not os.path.exists(p) and self.track:
                q = self.local(tr, book, int(ch), track='')
                p = q if os.path.exists(q) and not self.tracks.get(tr) else p
            if os.path.exists(p):
                self.save_btn.set_visible(False)
                self.load_times(p[:-4] + '.json')
                self.start('file://' + p); return
            self.save_btn.set_visible(True)
            track = self.track

            def ask():
                r = NET.ajax('kjtb_audio', tr=atr(tr), book=book, ch=int(ch), track=track)
                return r.get('data') if r.get('success') else None

            def got(d):
                if self.cur != (tr, book, int(ch)):
                    return
                if isinstance(d, dict) and d.get('url'):
                    self.url = d['url']; self.info = d
                    self.times = [(int(x[0]), float(x[1])) for x in (d.get('v') or []) if len(x) > 1]
                    self.start(d['url'])
                elif isinstance(d, Exception):
                    self.win.toast(_('Listening needs the internet, or the chapter kept on this computer'))
                else:
                    self.win.toast(_('There is no recording of this chapter in this Bible yet'))
            run_bg(ask, got)

        if tr in self.tracks:
            chosen()
        else:
            run_bg(find, chosen)

    def load_times(self, path):
        try:
            d = json.load(open(path))
            self.times = [(int(x[0]), float(x[1])) for x in (d.get('v') or []) if len(x) > 1]
        except Exception:
            self.times = []

    def start(self, uri):
        self.player.set_state(Gst.State.NULL)
        self.player.set_property('uri', uri)
        self.player.set_state(Gst.State.PLAYING)
        self.play_btn.set_icon_name('kjt-pause-symbolic')
        self.away_until = 0; self.back_btn.set_visible(False)
        self.set_reveal_child(True)
        self.pending_seek = True

    def started(self):
        """the recording is ready: the speed, and where to begin"""
        if not getattr(self, 'pending_seek', False) or not self.player:
            return
        self.pending_seek = False
        t = self.want_t
        if getattr(self, 'want_v', 0) and self.times:
            t = next((s for v, s in self.times if v == self.want_v), t)
        self.want_t = 0; self.want_v = 0
        self.seek_to(t)

    def seek_to(self, t):
        if not self.player:
            return
        self.player.seek(self.rate, Gst.Format.TIME, Gst.SeekFlags.FLUSH | Gst.SeekFlags.ACCURATE, Gst.SeekType.SET,
                         int(max(0, t) * Gst.SECOND), Gst.SeekType.NONE, -1)

    def position(self):
        if not self.player:
            return 0
        ok, pos = self.player.query_position(Gst.Format.TIME)
        return pos / Gst.SECOND if ok else 0

    def playing(self):
        if not self.player:
            return False
        _, st, _ = self.player.get_state(0)
        return st == Gst.State.PLAYING

    def toggle(self):
        if not self.player or not self.cur:
            return
        if self.playing():
            self.player.set_state(Gst.State.PAUSED); self.play_btn.set_icon_name('kjt-play-symbolic')
        else:
            self.player.set_state(Gst.State.PLAYING); self.play_btn.set_icon_name('kjt-pause-symbolic')

    def stop(self):
        self.keep_place()
        if self.player:
            self.player.set_state(Gst.State.NULL)
        self.set_reveal_child(False); self.cur = None; self.verse = 0
        self.show_verse(0)

    def set_rate(self, r):
        self.rate = r; SET.set('audio_rate', r)
        if self.cur and self.player:
            self.seek_to(self.position())

    def set_sleep(self, s):
        self.sleep = s
        self.sleep_at = time.time() + int(s) * 60 if s.isdigit() else 0

    def fade_stop(self):
        """the sleep timer: softly quieter, then a pause"""
        if not self.player:
            return
        v0 = self.player.get_property('volume'); n = [0]
        def step():
            n[0] += 1
            self.player.set_property('volume', max(0, v0 * (1 - n[0] / 20)))
            if n[0] >= 20:
                self.player.set_state(Gst.State.PAUSED); self.play_btn.set_icon_name('kjt-play-symbolic')
                self.player.set_property('volume', v0)
                self.busy = True; self.sleep_dd.set_selected(0); self.busy = False; self.set_sleep('off')
                return False
            return True
        GLib.timeout_add(150, step)

    # ---------- verses and chapters
    def step_v(self, d):
        if not self.cur:
            return
        if not self.times:
            self.seek_to(max(0, self.position() + d * 10)); return
        idx = next((i for i, (v, _s) in enumerate(self.times) if v == self.verse), 0)
        if d < 0 and self.position() - self.times[idx][1] > 2:
            d = 0
        j = max(0, min(len(self.times) - 1, idx + d))
        self.seek_to(self.times[j][1] + 0.01); self.away_until = 0
        if not self.playing():
            self.toggle()

    def step_ch(self, d):
        if not self.cur:
            return
        tr, book, ch = self.cur
        chs = STORE.chapters(tr, book) or []
        if ch + d in chs:
            self.play_chapter(tr, book, ch + d)
            self.follow_page(book, ch + d)

    def follow_page(self, book, ch):
        page = getattr(self.win, 'bible', None)
        if page and page.book == book and page.ch != ch and self.follow_sw.get_active():
            page.go(book, ch)

    def from_verse(self, tr, book, ch, v):
        """Listen from here (a chosen verse)"""
        if self.cur == (tr, book, int(ch)) and self.times:
            t = next((s for vv, s in self.times if vv == int(v)), None)
            if t is not None:
                self.seek_to(t + 0.01)
                if not self.playing():
                    self.toggle()
                return
        self.play_chapter(tr, book, ch, verse=v)

    def ended(self):
        if not self.cur:
            return
        tr, book, ch = self.cur
        # heard to the end: marked, when "Mark chapters automatically" is on (Bible Study Journey)
        try:
            from .journey import JOURNEY, BY
            from .core import canon
            k = '%s.%d' % (canon(book), ch)
            if JOURNEY.S['settings'].get('auto') and k.split('.')[0] in BY and not JOURNEY.is_read(k):
                JOURNEY.mark(k, 'auto')
        except Exception:
            pass
        if self.sleep == 'chapter':
            self.busy = True; self.sleep_dd.set_selected(0); self.busy = False; self.set_sleep('off')
            self.player.set_state(Gst.State.PAUSED); self.play_btn.set_icon_name('kjt-play-symbolic'); return
        if self.keep_sw.get_active() and ch + 1 in (STORE.chapters(tr, book) or []):
            self.play_chapter(tr, book, ch + 1)
            self.follow_page(book, ch + 1)
        else:
            self.player.set_state(Gst.State.PAUSED); self.play_btn.set_icon_name('kjt-play-symbolic')

    def on_error(self, bus, msg):
        self.win.toast(_('The recording could not be played'))
        self.stop()

    def on_seek(self, scale, scroll, value):
        if self.player:
            ok, dur = self.player.query_duration(Gst.Format.TIME)
            if ok and dur > 0:
                self.seek_to(max(0, min(1, value)) * dur / Gst.SECOND)
        return False

    # ---------- the verse being read, in the Bible
    def page(self):
        p = getattr(self.win, 'bible', None)
        if p and self.cur and (p.book, int(p.ch)) == (self.cur[1], self.cur[2]):
            return p
        return None

    def show_verse(self, v):
        p = getattr(self.win, 'bible', None)
        if p and hasattr(p, 'audio_verse'):
            p.audio_verse(v if self.page() else 0, follow=self.follow_sw.get_active() and time.time() > self.away_until)

    def follow_now(self):
        self.show_verse(self.verse)

    def user_scrolled(self):
        """the reader scrolled away from the verse being read: wait, and offer the way back"""
        if self.cur and self.playing() and self.follow_sw.get_active():
            self.away_until = time.time() + 20
            self.back_btn.set_visible(bool(self.page()))

    def back_to_verse(self):
        self.away_until = 0; self.back_btn.set_visible(False)
        if not self.page() and self.cur:
            p = getattr(self.win, 'bible', None)
            if p:
                p.go(self.cur[1], self.cur[2])
        self.show_verse(self.verse)

    def reapply(self):
        """the chapter was drawn again: the glow comes back"""
        p = getattr(self.win, 'bible', None)
        if p:
            self.prefetch(p.tr)
        if self.cur and self.verse:
            GLib.idle_add(lambda: (self.show_verse(self.verse), False)[1])

    def tick(self):
        if not self.player or not self.get_reveal_child() or not self.cur:
            return True
        ok1, pos = self.player.query_position(Gst.Format.TIME)
        ok2, dur = self.player.query_duration(Gst.Format.TIME)
        if ok1 and ok2 and dur > 0:
            self.scale.set_value(pos / dur)
            f = lambda t: '%d:%02d' % (t // Gst.SECOND // 60, t // Gst.SECOND % 60)
            self.time.set_label('%s / %s' % (f(pos), f(dur)))
        if ok1 and self.times:
            t = pos / Gst.SECOND; v = self.times[0][0]
            for vv, s in self.times:
                if s <= t:
                    v = vv
                else:
                    break
            if v != self.verse:
                self.verse = v; self.vlabel.set_label(_('verse') + ' %d' % v)
                self.show_verse(v)
            elif time.time() > self.away_until and self.back_btn.get_visible():
                self.back_btn.set_visible(False); self.show_verse(v)
        if self.sleep_at and time.time() >= self.sleep_at:
            self.sleep_at = 0; self.fade_stop()
        if self.playing() and int(time.time()) % 5 == 0:
            self.keep_place()
        return True

    # ---------- continue where you stopped
    def keep_place(self):
        if self.cur:
            tr, book, ch = self.cur
            SET.set('audio_resume', {'tr': tr, 'book': book, 'ch': ch, 'v': self.verse or 1, 't': int(self.position()), 'at': int(time.time())})

    def offer_resume(self):
        r = SET.get('audio_resume') or {}
        if r.get('book') and time.time() - r.get('at', 0) < 30 * 86400 and (r.get('v', 1) > 1 or r.get('t', 0) > 15) and not self.cur:
            t = Adw.Toast(title='%s: %s %d, %s %d' % (_('Continue listening'), book_name(r['book'], tr=r['tr']), r['ch'], _('verse'), r.get('v', 1)), timeout=12)
            t.set_button_label(_('Continue'))
            def go(*_a):
                self.want_t = r.get('t', 0)
                p = getattr(self.win, 'bible', None)
                if p:
                    self.win.show('bible'); p.go(r['book'], r['ch'])
                self.play_chapter(r['tr'], r['book'], r['ch'], keep_time=True)
            t.connect('button-clicked', go)
            try:
                self.win.toasts.add_toast(t)
            except Exception:
                pass
        return False

    # ---------- Bible Study Journey
    def draw_mark(self):
        try:
            from .journey import JOURNEY, BY
            from .core import canon
        except Exception:
            self.mark_btn.set_visible(False); return
        if not self.cur:
            return
        k = '%s.%d' % (canon(self.cur[1]), self.cur[2])
        if k.split('.')[0] not in BY:
            self.mark_btn.set_visible(False); return
        self.mark_btn.set_visible(True)
        done = JOURNEY.is_read(k)
        from .journey import T as JT
        self.mark_btn.set_label(('✓ ' + JT('read')) if done else _('Mark as read'))
        self.mark_btn.set_sensitive(not done)

    def mark_read(self):
        from .journey import JOURNEY
        from .core import canon
        if self.cur:
            for m in JOURNEY.mark('%s.%d' % (canon(self.cur[1]), self.cur[2]), 'button'):
                self.win.toast('%s %s' % (m[1], m[2]))

    # ---------- keeping recordings on this computer
    def save(self):
        if not self.cur or not self.url:
            return
        tr, book, ch = self.cur; url = self.url; dest = self.local(tr, book, ch); times = list(self.times)
        def work():
            data = NET.get(url, timeout=120, strict=True)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, 'wb') as f:
                f.write(data)
            with open(dest[:-4] + '.json', 'w') as f:
                json.dump({'v': times}, f)
            return True
        def fin(r):
            if r is True:
                self.save_btn.set_visible(False); self.win.toast(_('Kept on this computer') + ': %s %d' % (book_name(book, tr=tr), ch))
            else:
                self.win.toast(_('Could not keep the recording'))
        self.win.toast(_('Keeping the recording…'))
        run_bg(work, fin)

    def save_whole_book(self):
        if not self.cur:
            return
        tr, book, _ch = self.cur
        self.win.toast(_('Keeping the whole book…'))
        self.save_book(tr, book, lambda n: self.win.toast(_('Kept on this computer') + ': %s (%s)' % (book_name(book, tr=tr), n if isinstance(n, int) else '0')))

    def save_book(self, tr, book, progress=None):
        """keep every chapter of a book (for listening without the internet)"""
        track = self.track if self.cur and self.cur[0] == tr else (SET.get('audio_track') or '')
        def work():
            n = 0
            for ch in STORE.chapters(tr, book):
                dest = self.local(tr, book, ch, track=track)
                if os.path.exists(dest):
                    continue
                r = NET.ajax('kjtb_audio', tr=atr(tr), book=book, ch=ch, track=track)
                d = r.get('data') if r.get('success') else None
                if d and d.get('url'):
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    with open(dest, 'wb') as f:
                        f.write(NET.get(d['url'], timeout=120, strict=True))
                    with open(dest[:-4] + '.json', 'w') as f:
                        json.dump({'v': d.get('v') or []}, f)
                    n += 1
            return n
        run_bg(work, progress)
