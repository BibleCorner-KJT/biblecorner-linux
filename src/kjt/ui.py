"""Small things shared by the pages."""
from gi.repository import Gtk, Gdk
from .core import SET


def resizable(split, child, key, end=False, lo=180, hi=900):
    """a side panel you can make wider or narrower by dragging its edge; the width is remembered"""
    box = Gtk.Box()
    grip = Gtk.Box(); grip.set_size_request(7, -1); grip.add_css_class('kjt-grip'); grip.set_tooltip_text('Drag to make this wider or narrower')
    try:
        grip.set_cursor(Gdk.Cursor.new_from_name('col-resize'))
    except Exception:
        pass
    child.set_hexpand(True)
    if end:
        box.append(grip); box.append(child)
    else:
        box.append(child); box.append(grip)
    def width(w):
        w = int(max(lo, min(hi, w)))
        if w > split.get_max_sidebar_width():
            split.set_max_sidebar_width(w); split.set_min_sidebar_width(w)
        else:
            split.set_min_sidebar_width(w); split.set_max_sidebar_width(w)
    w0 = SET.get('w_' + key)
    if w0:
        width(w0)
    st = {}
    d = Gtk.GestureDrag()
    d.connect('drag-begin', lambda g, x, y: st.update(w=box.get_width()))
    d.connect('drag-update', lambda g, dx, dy: width(st.get('w', box.get_width()) + (-dx if end else dx)))
    d.connect('drag-end', lambda g, dx, dy: SET.set('w_' + key, box.get_width()))
    grip.add_controller(d)
    return box


def steady(scrolled):
    """a click into a long text must not make the page slide to the text's end (GTK scrolls to a widget that gets the keyboard)"""
    v = scrolled.get_child()
    if isinstance(v, Gtk.Viewport):
        v.set_scroll_to_focus(False)
    return scrolled
