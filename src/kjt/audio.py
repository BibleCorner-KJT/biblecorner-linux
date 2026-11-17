"""Listening: the recorded chapters, played here (from this computer when saved, else from the website).
2.12: a Bible may have more than one recording (the King James: "With music" and "Reading only"), as on the
website and in the Android app: the bar offers the choice, the one with music first, and remembers it."""
import os, re
from gi.repository import Gtk, GLib
from .core import NET, STORE, SET, file_path, write_file, run_bg, book_name
from .i18n import _

try:
    import gi
    gi.require_version('Gst', '1.0')
    from gi.repository import Gst
    Gst.init(None)
except Exception:  # no sound system: the app still works
    Gst = None


class Audio(Gtk.Revealer):
    def __init__(self, win):
        super().__init__(transition_type=Gtk.RevealerTransitionType.SLIDE_UP)
        self.win = win
        self.cur = None  # (tr, book, ch)
        self.player = None
        if Gst:
            self.player = Gst.ElementFactory.make('playbin', 'kjt-player')
            if self.player:
                bus = self.player.get_bus(); bus.add_signal_watch()
                bus.connect('message::eos', lambda *_: self.next_chapter())
                bus.connect('message::error', self.on_error)
        bar = Gtk.Box(spacing=8, margin_start=10, margin_end=10, margin_top=6, margin_bottom=6)
        bar.add_css_class('kjt-audio')
        self.play_btn = Gtk.Button(icon_name='kjt-pause-symbolic', tooltip_text=_('Play or pause')); self.play_btn.add_css_class('circular')
        self.play_btn.connect('clicked', lambda *_: self.toggle())
        self.title = Gtk.Label(xalign=0, width_chars=16, ellipsize=3)
        self.title.add_css_class('heading')
        self.scale = Gtk.Scale(orientation=Gtk.Orientation.HORIZONTAL, hexpand=True, draw_value=False)
        self.scale.set_range(0, 1)
        self.scale.connect('change-value', self.on_seek)
        self.time = Gtk.Label(); self.time.add_css_class('numeric'); self.time.add_css_class('dim-label')
        # the recordings of this Bible (With music / Reading only)
        self.tracks = {}            # tr -> [{'id','label','chapters'}]
        self.track = ''             # the recording playing now
        self.track_dd = Gtk.DropDown.new_from_strings([]); self.track_dd.set_visible(False)
        self.track_dd.set_tooltip_text(_('Recording'))
        self.track_ids = []; self.track_busy = False
        self.track_dd.connect('notify::selected', self.on_track)
        self.save_btn = Gtk.Button(icon_name='kjt-download-symbolic', tooltip_text=_('Keep this chapter on this computer'))
        self.save_btn.connect('clicked', lambda *_: self.save())
        close = Gtk.Button(icon_name='kjt-close-symbolic', tooltip_text=_('Stop')); close.add_css_class('flat')
        close.connect('clicked', lambda *_: self.stop())
        for w in (self.play_btn, self.title, self.track_dd, self.scale, self.time, self.save_btn, close):
            bar.append(w)
        self.set_child(bar)
        GLib.timeout_add(500, self.tick)

    def set_compact(self, c):
        self.time.set_visible(not c)

    def local(self, tr, book, ch, track=None):
        t = self.track if track is None else track
        folder = tr + ('_' + re.sub(r'[^a-z0-9-]', '', t) if t else '')
        return file_path('audio/%s/%s/%d.mp3' % (folder, book, ch))

    def tracks_of(self, tr, book, ch):
        """the recordings that have this chapter, the one with music first (as the website lists them)"""
        out = []
        for t in self.tracks.get(tr) or []:
            chs = (t.get('chapters') or {}).get(book) or []
            if int(ch) in [int(x) for x in chs]:
                out.append(t)
        return out

    def pick(self, tr, book, ch):
        ts = self.tracks_of(tr, book, ch)
        want = SET.get('audio_track')
        t = next((x for x in ts if x.get('id') == want), None) or (ts[0] if ts else None)
        self.track = ((t or {}).get('id', '') or '') if ts else (SET.get('audio_track') or '')   # offline: the last choice
        self.track_busy = True
        self.track_ids = [x.get('id', '') for x in ts]
        self.track_dd.set_model(Gtk.StringList.new([_(x.get('label') or '') for x in ts]))
        if self.track in self.track_ids:
            self.track_dd.set_selected(self.track_ids.index(self.track))
        self.track_dd.set_visible(len(ts) > 1)
        self.track_busy = False

    def on_track(self, dd, _p):
        if self.track_busy or not self.cur:
            return
        i = dd.get_selected()
        if 0 <= i < len(self.track_ids) and self.track_ids[i] != self.track:
            SET.set('audio_track', self.track_ids[i])
            tr, book, ch = self.cur
            self.play_chapter(tr, book, ch)

    def play_chapter(self, tr, book, ch):
        if not self.player:
            self.win.toast('Sound is not available on this computer'); return
        self.cur = (tr, book, int(ch))
        self.title.set_label('%s %d' % (book_name(book, tr=tr), int(ch)))
        def find():
            if tr not in self.tracks:
                r = NET.ajax('kjtb_audio', tr=tr)
                self.tracks[tr] = ((r.get('data') or {}).get('tracks') or []) if r.get('success') else []
            return True
        def chosen(_r=None):
            if isinstance(_r, Exception):
                self.tracks.pop(tr, None)
            self.pick(tr, book, ch)
            p = self.local(tr, book, int(ch))
            if not os.path.exists(p) and not self.track:
                p = self.local(tr, book, int(ch), track='')
            if os.path.exists(p):
                self.save_btn.set_visible(False)
                self.start('file://' + p); return
            self.save_btn.set_visible(True)
            track = self.track
            def url():
                r = NET.ajax('kjtb_audio', tr=tr, book=book, ch=int(ch), track=track)
                return (r.get('data') or {}).get('url') if r.get('success') else None
            def got(u):
                if isinstance(u, str) and u:
                    self.url = u
                    self.start(u)
                elif isinstance(u, Exception):
                    self.win.toast('Listening needs the internet, or the chapter kept on this computer')
                else:
                    self.win.toast('There is no recording of this chapter in this Bible yet')
            run_bg(url, got)
        if tr in self.tracks:
            chosen()
        else:
            # offline and nothing known: play what is kept here (either recording)
            run_bg(find, chosen)

    def start(self, uri):
        self.player.set_state(Gst.State.NULL)
        self.player.set_property('uri', uri)
        self.player.set_state(Gst.State.PLAYING)
        self.play_btn.set_icon_name('kjt-pause-symbolic')
        self.set_reveal_child(True)

    def toggle(self):
        if not self.player:
            return
        _, st, _ = self.player.get_state(0)
        if st == Gst.State.PLAYING:
            self.player.set_state(Gst.State.PAUSED); self.play_btn.set_icon_name('kjt-play-symbolic')
        else:
            self.player.set_state(Gst.State.PLAYING); self.play_btn.set_icon_name('kjt-pause-symbolic')

    def stop(self):
        if self.player:
            self.player.set_state(Gst.State.NULL)
        self.set_reveal_child(False); self.cur = None

    def next_chapter(self):
        if not self.cur:
            return
        tr, book, ch = self.cur
        if ch + 1 in STORE.chapters(tr, book):
            self.play_chapter(tr, book, ch + 1)
            page = getattr(self.win, 'bible', None)
            if page and page.book == book and page.ch == ch:
                page.go(book, ch + 1)
        else:
            self.stop()

    def on_error(self, bus, msg):
        self.win.toast('The recording could not be played')
        self.stop()

    def on_seek(self, scale, scroll, value):
        if self.player:
            ok, dur = self.player.query_duration(Gst.Format.TIME)
            if ok and dur > 0:
                self.player.seek_simple(Gst.Format.TIME, Gst.SeekFlags.FLUSH | Gst.SeekFlags.KEY_UNIT, int(max(0, min(1, value)) * dur))
        return False

    def tick(self):
        if self.player and self.get_reveal_child():
            ok1, pos = self.player.query_position(Gst.Format.TIME)
            ok2, dur = self.player.query_duration(Gst.Format.TIME)
            if ok1 and ok2 and dur > 0:
                self.scale.set_value(pos / dur)
                f = lambda t: '%d:%02d' % (t // Gst.SECOND // 60, t // Gst.SECOND % 60)
                self.time.set_label('%s / %s' % (f(pos), f(dur)))
        return True

    def save(self):
        if not self.cur or not getattr(self, 'url', None):
            return
        tr, book, ch = self.cur; url = self.url; dest = self.local(tr, book, ch)
        def work():
            data = NET.get(url, timeout=120, strict=True)
            os.makedirs(os.path.dirname(dest), exist_ok=True)
            with open(dest, 'wb') as f:
                f.write(data)
            return True
        def fin(r):
            if r is True:
                self.save_btn.set_visible(False); self.win.toast('Kept on this computer: %s %d' % (book_name(book, tr=tr), ch))
            else:
                self.win.toast('Could not keep the recording')
        self.win.toast('Keeping the recording…')
        run_bg(work, fin)

    def save_book(self, tr, book, progress=None):
        """keep every chapter of a book (for listening without the internet)"""
        track = SET.get('audio_track') or ''
        def work():
            n = 0
            for ch in STORE.chapters(tr, book):
                dest = self.local(tr, book, ch, track=track)
                if os.path.exists(dest):
                    continue
                r = NET.ajax('kjtb_audio', tr=tr, book=book, ch=ch, track=track)
                u = (r.get('data') or {}).get('url') if r.get('success') else None
                if u:
                    os.makedirs(os.path.dirname(dest), exist_ok=True)
                    with open(dest, 'wb') as f:
                        f.write(NET.get(u, timeout=120, strict=True))
                    n += 1
            return n
        run_bg(work, progress)
