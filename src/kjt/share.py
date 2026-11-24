"""2.46 · Sharing, as in the Android app: copy the words, the verse as a picture (copy or save it), or send it by email
or by text message with the phone's own apps (Chatty on a Linux phone, the mail program on a computer)."""
from urllib.parse import quote
from gi.repository import Gtk, Gdk, Gio
from .i18n import _


def launch(win, uri):
    try:
        Gtk.UriLauncher.new(uri).launch(win, None, None)
    except Exception:
        try:
            Gio.AppInfo.launch_default_for_uri(uri, None)
        except Exception:
            win.toast(_('No app here can open it'))


def menu(win, words, text=None, ref=None):
    """a small window: Copy · As a picture · By email · By text message"""
    from gi.repository import Adw
    d = Adw.Dialog(title=_('Share'), content_width=360)
    tv = Adw.ToolbarView(); tv.add_top_bar(Adw.HeaderBar())
    box = Gtk.ListBox(selection_mode=Gtk.SelectionMode.NONE, margin_top=8, margin_bottom=16, margin_start=12, margin_end=12); box.add_css_class('boxed-list')
    def act(icon, title, fn):
        r = Adw.ActionRow(title=title, activatable=True); r.add_prefix(Gtk.Image(icon_name=icon))
        r.connect('activated', lambda *_a: (d.close(), fn())); box.append(r)
    def copy():
        Gdk.Display.get_default().get_clipboard().set(words); win.toast(_('Copied: paste it in a message or a post'))
    act('kjt-copy-symbolic', _('Copy the text'), copy)
    if text:
        from . import picture
        act('kjt-picture-symbolic', _('Share as a picture…'), lambda: picture.share(win, text, ref or ''))
    act('mail-send-symbolic', _('By email'), lambda: launch(win, 'mailto:?subject=%s&body=%s' % (quote(ref or 'Bible Corner'), quote(words))))
    act('mail-message-new-symbolic', _('By text message'), lambda: launch(win, 'sms:?body=%s' % quote(words)))
    tv.set_content(box); d.set_child(tv); d.present(win)
