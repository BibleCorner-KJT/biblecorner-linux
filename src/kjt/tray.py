"""2.22: an icon in the tray (the panel's corner), so the app keeps running when its window is closed.

It speaks the StatusNotifierItem language that KDE, Cinnamon, XFCE, Budgie and GNOME (with the "AppIndicator and
KStatusNotifierItem Support" extension, which Fedora and Ubuntu ship) understand. A click on the icon shows the
window; its menu has Open and Quit. Where there is no tray, the window still hides and the app keeps running:
GNOME then lists it under Background Apps in the quick settings, and opening the app again shows the window."""
import os
from gi.repository import Gio, GLib, GdkPixbuf

ITEM_XML = '''<node>
 <interface name="org.kde.StatusNotifierItem">
  <property name="Category" type="s" access="read"/>
  <property name="Id" type="s" access="read"/>
  <property name="Title" type="s" access="read"/>
  <property name="Status" type="s" access="read"/>
  <property name="IconName" type="s" access="read"/>
  <property name="IconThemePath" type="s" access="read"/>
  <property name="IconPixmap" type="a(iiay)" access="read"/>
  <property name="ToolTip" type="(sa(iiay)ss)" access="read"/>
  <property name="ItemIsMenu" type="b" access="read"/>
  <property name="Menu" type="o" access="read"/>
  <method name="Activate"><arg type="i" direction="in"/><arg type="i" direction="in"/></method>
  <method name="SecondaryActivate"><arg type="i" direction="in"/><arg type="i" direction="in"/></method>
  <method name="ContextMenu"><arg type="i" direction="in"/><arg type="i" direction="in"/></method>
  <method name="Scroll"><arg type="i" direction="in"/><arg type="s" direction="in"/></method>
  <signal name="NewIcon"/><signal name="NewTitle"/><signal name="NewStatus"><arg type="s"/></signal>
 </interface>
</node>'''

MENU_XML = '''<node>
 <interface name="com.canonical.dbusmenu">
  <property name="Version" type="u" access="read"/>
  <property name="Status" type="s" access="read"/>
  <property name="TextDirection" type="s" access="read"/>
  <method name="GetLayout"><arg type="i" direction="in"/><arg type="i" direction="in"/><arg type="as" direction="in"/>
   <arg type="u" direction="out"/><arg type="(ia{sv}av)" direction="out"/></method>
  <method name="GetGroupProperties"><arg type="ai" direction="in"/><arg type="as" direction="in"/><arg type="a(ia{sv})" direction="out"/></method>
  <method name="GetProperty"><arg type="i" direction="in"/><arg type="s" direction="in"/><arg type="v" direction="out"/></method>
  <method name="Event"><arg type="i" direction="in"/><arg type="s" direction="in"/><arg type="v" direction="in"/><arg type="u" direction="in"/></method>
  <method name="EventGroup"><arg type="a(isvu)" direction="in"/><arg type="ai" direction="out"/></method>
  <method name="AboutToShow"><arg type="i" direction="in"/><arg type="b" direction="out"/></method>
  <method name="AboutToShowGroup"><arg type="ai" direction="in"/><arg type="ai" direction="out"/><arg type="ai" direction="out"/></method>
  <signal name="LayoutUpdated"><arg type="u"/><arg type="i"/></signal>
 </interface>
</node>'''


class Tray:
    """show(): what a click does; quit(): the menu's Quit. items: [(id, label)]"""
    def __init__(self, title, icon_png, show, quit, labels):
        self.title, self.show, self.quit, self.labels = title, show, quit, labels
        self.bus = None; self.ids = []; self.ok = False
        self.pixmaps = self._pixmaps(icon_png)
        try:
            self.bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        except Exception:
            return
        item = Gio.DBusNodeInfo.new_for_xml(ITEM_XML).interfaces[0]
        menu = Gio.DBusNodeInfo.new_for_xml(MENU_XML).interfaces[0]
        try:
            self.ids.append(self.bus.register_object('/StatusNotifierItem', item, self._item_call, self._item_prop, None))
            self.ids.append(self.bus.register_object('/MenuBar', menu, self._menu_call, self._menu_prop, None))
        except Exception:
            return
        self._register()
        # a tray that starts later (the panel restarted): register again
        self.watch = Gio.bus_watch_name_on_connection(self.bus, 'org.kde.StatusNotifierWatcher', Gio.BusNameWatcherFlags.NONE,
                                                      lambda *_a: self._register(), None)

    def _register(self):
        try:
            self.bus.call_sync('org.kde.StatusNotifierWatcher', '/StatusNotifierWatcher', 'org.kde.StatusNotifierWatcher',
                               'RegisterStatusNotifierItem', GLib.Variant('(s)', (self.bus.get_unique_name(),)), None,
                               Gio.DBusCallFlags.NONE, 3000, None)
            self.ok = True
        except Exception:
            self.ok = False

    def _pixmaps(self, path):
        out = []
        for size in (22, 32, 48, 64):
            try:
                pb = GdkPixbuf.Pixbuf.new_from_file_at_size(path, size, size)
                if not pb.get_has_alpha():
                    pb = pb.add_alpha(False, 0, 0, 0)
                w, h, rs, px = pb.get_width(), pb.get_height(), pb.get_rowstride(), pb.get_pixels()
                argb = bytearray()
                for y in range(h):
                    row = px[y * rs:y * rs + w * 4]
                    for x in range(0, w * 4, 4):
                        r, g, b, a = row[x], row[x + 1], row[x + 2], row[x + 3]
                        argb += bytes((a, r, g, b))
                out.append((w, h, bytes(argb)))
            except Exception:
                pass
        return out

    # the icon
    def _item_prop(self, conn, sender, path, iface, name):
        v = {'Category': GLib.Variant('s', 'ApplicationStatus'), 'Id': GLib.Variant('s', 'today.knowingjesus.KJT'),
             'Title': GLib.Variant('s', self.title), 'Status': GLib.Variant('s', 'Active'),
             'IconName': GLib.Variant('s', ''), 'IconThemePath': GLib.Variant('s', ''),
             'IconPixmap': GLib.Variant('a(iiay)', self.pixmaps),
             'ToolTip': GLib.Variant('(sa(iiay)ss)', ('', [], self.title, '')),
             'ItemIsMenu': GLib.Variant('b', False), 'Menu': GLib.Variant('o', '/MenuBar')}
        return v.get(name)

    def _item_call(self, conn, sender, path, iface, method, params, inv):
        if method in ('Activate', 'SecondaryActivate'):
            GLib.idle_add(lambda: (self.show(), False)[1])
        inv.return_value(None)

    # its menu: 1 Open, 2 Quit
    def _entry(self, i, label):
        return GLib.Variant('(ia{sv}av)', (i, {'label': GLib.Variant('s', label), 'enabled': GLib.Variant('b', True), 'visible': GLib.Variant('b', True)}, []))

    def _menu_prop(self, conn, sender, path, iface, name):
        return {'Version': GLib.Variant('u', 3), 'Status': GLib.Variant('s', 'normal'), 'TextDirection': GLib.Variant('s', 'ltr')}.get(name)

    def _menu_call(self, conn, sender, path, iface, method, params, inv):
        L = self.labels()
        if method == 'GetLayout':
            root = GLib.Variant('(ia{sv}av)', (0, {'children-display': GLib.Variant('s', 'submenu')},
                                               [self._entry(1, L[0]), self._entry(2, L[1])]))
            inv.return_value(GLib.Variant.new_tuple(GLib.Variant('u', 1), root))
        elif method == 'GetGroupProperties':
            items = [(1, {'label': GLib.Variant('s', L[0])}), (2, {'label': GLib.Variant('s', L[1])})]
            inv.return_value(GLib.Variant('(a(ia{sv}))', ([x for x in items if not params[0] or x[0] in params[0]],)))
        elif method == 'GetProperty':
            inv.return_value(GLib.Variant('(v)', (GLib.Variant('s', L[0] if params[0] == 1 else L[1]),)))
        elif method == 'Event':
            if params[1] == 'clicked':
                GLib.idle_add(lambda: ((self.show() if params[0] == 1 else self.quit() if params[0] == 2 else None), False)[1])
            inv.return_value(None)
        elif method == 'EventGroup':
            for ev in params[0]:
                if ev[1] == 'clicked':
                    i = ev[0]; GLib.idle_add(lambda i=i: ((self.show() if i == 1 else self.quit() if i == 2 else None), False)[1])
            inv.return_value(GLib.Variant('(ai)', ([],)))
        elif method == 'AboutToShow':
            inv.return_value(GLib.Variant('(b)', (False,)))
        elif method == 'AboutToShowGroup':
            inv.return_value(GLib.Variant('(aiai)', ([], [])))
        else:
            inv.return_value(None)

    def close(self):
        try:
            for i in self.ids:
                self.bus.unregister_object(i)
        except Exception:
            pass
        self.ids = []
