"""2.54: the player on the lock screen and in the system's media controls (MPRIS), on a computer and on a Linux
phone (Phosh, Plasma Mobile): the chapter's name and verse, play/pause, previous/next chapter, and a bar that shows
how far the chapter has played and can be dragged to go back or forward a little."""
import time
from gi.repository import Gio, GLib
from .core import book_name

XML = '''<node>
 <interface name="org.mpris.MediaPlayer2">
  <method name="Raise"/><method name="Quit"/>
  <property name="CanQuit" type="b" access="read"/><property name="CanRaise" type="b" access="read"/>
  <property name="HasTrackList" type="b" access="read"/><property name="Identity" type="s" access="read"/>
  <property name="DesktopEntry" type="s" access="read"/>
  <property name="SupportedUriSchemes" type="as" access="read"/><property name="SupportedMimeTypes" type="as" access="read"/>
 </interface>
 <interface name="org.mpris.MediaPlayer2.Player">
  <method name="Next"/><method name="Previous"/><method name="Pause"/><method name="PlayPause"/><method name="Stop"/><method name="Play"/>
  <method name="Seek"><arg direction="in" name="Offset" type="x"/></method>
  <method name="SetPosition"><arg direction="in" name="TrackId" type="o"/><arg direction="in" name="Position" type="x"/></method>
  <method name="OpenUri"><arg direction="in" name="Uri" type="s"/></method>
  <signal name="Seeked"><arg name="Position" type="x"/></signal>
  <property name="PlaybackStatus" type="s" access="read"/><property name="Rate" type="d" access="readwrite"/>
  <property name="Metadata" type="a{sv}" access="read"/><property name="Volume" type="d" access="readwrite"/>
  <property name="Position" type="x" access="read"/><property name="MinimumRate" type="d" access="read"/>
  <property name="MaximumRate" type="d" access="read"/><property name="CanGoNext" type="b" access="read"/>
  <property name="CanGoPrevious" type="b" access="read"/><property name="CanPlay" type="b" access="read"/>
  <property name="CanPause" type="b" access="read"/><property name="CanSeek" type="b" access="read"/>
  <property name="CanControl" type="b" access="read"/>
 </interface>
</node>'''
P = 'org.mpris.MediaPlayer2.Player'


class Mpris:
    def __init__(self, audio):
        self.a = audio; self.con = None; self.ids = []
        self.last = {}; self.track = 0; self.expect = None
        self.node = Gio.DBusNodeInfo.new_for_xml(XML)
        try:
            Gio.bus_own_name(Gio.BusType.SESSION, 'org.mpris.MediaPlayer2.today.knowingjesus.KJT', Gio.BusNameOwnerFlags.NONE, self.acquired, None, None)
        except Exception:
            pass

    def acquired(self, con, _name):
        self.con = con
        for iface in self.node.interfaces:
            try:
                self.ids.append(con.register_object('/org/mpris/MediaPlayer2', iface, self.call, self.get, self.set))
            except Exception:
                pass

    # ---------- what the system asks
    def us(self):
        """position and length in microseconds"""
        pos = int(self.a.position() * 1e6)
        dur = 0
        try:
            from .audio import Gst
            ok, d = self.a.player.query_duration(Gst.Format.TIME)
            dur = int(d / 1000) if ok and d > 0 else 0
        except Exception:
            pass
        return pos, dur

    def title(self):
        if not self.a.cur:
            return 'Bible Corner'
        tr, book, ch = self.a.cur
        try:
            name = book_name(book)
        except Exception:
            name = book
        return '%s %d%s' % (name, ch, (':%d' % self.a.verse) if self.a.verse else '')

    def meta(self):
        _p, dur = self.us()
        m = {'mpris:trackid': GLib.Variant('o', '/today/knowingjesus/KJT/track/%d' % self.track),
             'xesam:title': GLib.Variant('s', self.title()),
             'xesam:artist': GLib.Variant('as', ['Bible Corner - KJT']),
             'xesam:album': GLib.Variant('s', 'Bible Corner')}
        if dur:
            m['mpris:length'] = GLib.Variant('x', dur)
        return m

    def status(self):
        if not self.a.cur:
            return 'Stopped'
        return 'Playing' if self.a.playing() else 'Paused'

    def props(self, iface):
        if iface == 'org.mpris.MediaPlayer2':
            return {'CanQuit': GLib.Variant('b', False), 'CanRaise': GLib.Variant('b', True), 'HasTrackList': GLib.Variant('b', False),
                    'Identity': GLib.Variant('s', 'Bible Corner - KJT'), 'DesktopEntry': GLib.Variant('s', 'today.knowingjesus.KJT'),
                    'SupportedUriSchemes': GLib.Variant('as', []), 'SupportedMimeTypes': GLib.Variant('as', [])}
        on = bool(self.a.cur)
        return {'PlaybackStatus': GLib.Variant('s', self.status()), 'Rate': GLib.Variant('d', float(self.a.rate)),
                'Metadata': GLib.Variant('a{sv}', self.meta()), 'Volume': GLib.Variant('d', 1.0),
                'Position': GLib.Variant('x', self.us()[0]), 'MinimumRate': GLib.Variant('d', 0.5), 'MaximumRate': GLib.Variant('d', 2.0),
                'CanGoNext': GLib.Variant('b', on), 'CanGoPrevious': GLib.Variant('b', on), 'CanPlay': GLib.Variant('b', on),
                'CanPause': GLib.Variant('b', on), 'CanSeek': GLib.Variant('b', on), 'CanControl': GLib.Variant('b', True)}

    def get(self, con, sender, path, iface, prop):
        return self.props(iface).get(prop)

    def set(self, con, sender, path, iface, prop, value):
        if prop == 'Rate':
            try:
                self.a.set_rate(max(0.5, min(2.0, value.unpack())))
            except Exception:
                pass
        return True

    def call(self, con, sender, path, iface, method, params, inv):
        a = self.a
        try:
            if method == 'Raise':
                a.win.present()
            elif method in ('PlayPause',) or (method == 'Play' and not a.playing()) or (method == 'Pause' and a.playing()):
                a.toggle()
            elif method == 'Stop':
                if a.playing():
                    a.toggle()
            elif method == 'Next':
                a.step_ch(1)
            elif method == 'Previous':
                a.step_ch(-1)
            elif method == 'Seek':
                (off,) = params.unpack(); a.seek_to(max(0, a.position() + off / 1e6)); self.seeked()
            elif method == 'SetPosition':
                _t, pos = params.unpack(); a.seek_to(max(0, pos / 1e6)); self.seeked()
        except Exception:
            pass
        inv.return_value(None)

    # ---------- telling the system what changed (called by the player's clock, a few times a second)
    def seeked(self, pos=None):
        if not self.con:
            return
        if pos is None:
            pos = self.us()[0]
        self.expect = None
        try:
            self.con.emit_signal(None, '/org/mpris/MediaPlayer2', P, 'Seeked', GLib.Variant('(x)', (int(pos),)))
        except Exception:
            pass

    def update(self):
        if not self.con:
            return
        if self.a.cur and self.last.get('cur') != self.a.cur:
            self.track += 1
        now = {'cur': self.a.cur, 'PlaybackStatus': self.status(), 'title': self.title(), 'len': self.us()[1], 'Rate': float(self.a.rate)}
        changed = {}
        if now['PlaybackStatus'] != self.last.get('PlaybackStatus'):
            changed['PlaybackStatus'] = GLib.Variant('s', now['PlaybackStatus'])
        if now['title'] != self.last.get('title') or now['len'] != self.last.get('len') or now['cur'] != self.last.get('cur'):
            changed['Metadata'] = GLib.Variant('a{sv}', self.meta())
        if now['Rate'] != self.last.get('Rate'):
            changed['Rate'] = GLib.Variant('d', now['Rate'])
        if now['cur'] != self.last.get('cur'):
            on = bool(self.a.cur)
            for k in ('CanGoNext', 'CanGoPrevious', 'CanPlay', 'CanPause', 'CanSeek'):
                changed[k] = GLib.Variant('b', on)
        self.last = now
        if changed:
            try:
                self.con.emit_signal(None, '/org/mpris/MediaPlayer2', 'org.freedesktop.DBus.Properties', 'PropertiesChanged',
                                     GLib.Variant('(sa{sv}as)', (P, changed, [])))
            except Exception:
                pass
        # a jump (the bar in the app, a verse step): the system's bar follows
        pos = self.us()[0]; t = time.monotonic()
        if self.expect and now['PlaybackStatus'] == 'Playing':
            want = self.expect[0] + (t - self.expect[1]) * 1e6 * float(self.a.rate)
            if abs(pos - want) > 1.5e6:
                self.seeked(pos)
        elif self.expect and now['PlaybackStatus'] != 'Playing' and abs(pos - self.expect[0]) > 1.5e6:
            self.seeked(pos)
        self.expect = (pos, t)
