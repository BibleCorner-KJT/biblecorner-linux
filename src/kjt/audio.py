"""Listening: the recorded chapters, played here (from this computer when saved, else from the website)."""
import os
from gi.repository import Gtk, GLib
from .core import NET, STORE, file_path, write_file, run_bg, book_name

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
        self.play_btn = Gtk.Button(icon_name='kjt-pause-symbolic', tooltip_text='Play or pause'); self.play_btn.add_css_class('circular')
        self.play_btn.connect('clicked', lambda *_: self.toggle())
        self.title = Gtk.Label(xalign=0, width_chars=16, ellipsize=3)
        self.title.add_css_class('heading')
        self.scale = Gtk.Scale(orientation=Gtk.Orientation.HORIZONTAL, hexpand=True, draw_value=False)
        self.scale.set_range(0, 1)
        self.scale.connect('change-value', self.on_seek)
        self.time = Gtk.Label(); self.time.add_css_class('numeric'); self.time.add_css_class('dim-label')
        self.save_btn = Gtk.Button(icon_name='kjt-download-symbolic', tooltip_text='Keep this chapter on this computer')
        self.save_btn.connect('clicked', lambda *_: self.save())
        close = Gtk.Button(icon_name='kjt-close-symbolic', tooltip_text='Stop'); close.add_css_class('flat')
        close.connect('clicked', lambda *_: self.stop())
        for w in (self.play_btn, self.title, self.scale, self.time, self.save_btn, close):
            bar.append(w)
        self.set_child(bar)
        GLib.timeout_add(500, self.tick)

    def set_compact(self, c):
        self.time.set_visible(not c)

    def local(self, tr, book, ch):
        return file_path('audio/%s/%s/%d.mp3' % (tr, book, ch))

    def play_chapter(self, tr, book, ch):
        if not self.player:
            self.win.toast('Sound is not available on this computer'); return
        self.cur = (tr, book, int(ch))
        self.title.set_label('%s %d' % (book_name(book, tr=tr), int(ch)))
        p = self.local(tr, book, int(ch))
        if os.path.exists(p):
            self.save_btn.set_visible(False)
            self.start('file://' + p); return
        self.save_btn.set_visible(True)
        def find():
            r = NET.ajax('kjtb_audio', tr=tr, book=book, ch=int(ch))
            return (r.get('data') or {}).get('url') if r.get('success') else None
        def got(url):
            if isinstance(url, str) and url:
                self.url = url
                self.start(url)
            elif isinstance(url, Exception):
                self.win.toast('Listening needs the internet, or the chapter kept on this computer')
            else:
                self.win.toast('There is no recording of this chapter in this Bible yet')
        run_bg(find, got)

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
        tr, book, ch = self.cur; url = self.url
        def work():
            data = NET.get(url, timeout=120, strict=True)
            write_file('audio/%s/%s/%d.mp3' % (tr, book, ch), data)
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
        def work():
            n = 0
            for ch in STORE.chapters(tr, book):
                if os.path.exists(self.local(tr, book, ch)):
                    continue
                r = NET.ajax('kjtb_audio', tr=tr, book=book, ch=ch)
                u = (r.get('data') or {}).get('url') if r.get('success') else None
                if u:
                    write_file('audio/%s/%s/%d.mp3' % (tr, book, ch), NET.get(u, timeout=120, strict=True)); n += 1
            return n
        run_bg(work, progress)
