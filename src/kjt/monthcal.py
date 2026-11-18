"""2.26: a month calendar in the app's language (Gtk.Calendar takes the computer's own month and day names)."""
import calendar, datetime
from gi.repository import Gtk
from .i18n import _, rtl

MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']


class MonthCal(Gtk.Box):
    def __init__(self, on_pick, on_month=None):
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_top=8, margin_bottom=8, margin_start=8, margin_end=8)
        self.on_pick, self.on_month = on_pick, on_month
        t = datetime.date.today(); self.y, self.m = t.year, t.month; self.marks = set()
        hd = Gtk.Box(spacing=4)
        pv = Gtk.Button(icon_name='go-previous-symbolic'); pv.add_css_class('flat'); pv.connect('clicked', lambda *_a: self.step(-1))
        nx = Gtk.Button(icon_name='go-next-symbolic'); nx.add_css_class('flat'); nx.connect('clicked', lambda *_a: self.step(1))
        self.title = Gtk.Label(hexpand=True); self.title.add_css_class('heading')
        hd.append(pv); hd.append(self.title); hd.append(nx); self.append(hd)
        self.grid = Gtk.Grid(column_homogeneous=True, row_spacing=2, column_spacing=2); self.append(self.grid)
        self.draw()

    def step(self, d):
        m = self.m + d; y = self.y + (m - 1) // 12; m = (m - 1) % 12 + 1
        self.set_month(y, m)

    def set_month(self, y, m):
        self.y, self.m = y, m; self.marks = set(); self.draw()
        if self.on_month:
            self.on_month(y, m)

    def clear_marks(self):
        self.marks = set(); self.draw()

    def mark_day(self, d):
        self.marks.add(d); self.draw()

    def draw(self):
        self.title.set_label('%s %d' % (_(MONTHS[self.m - 1]), self.y))
        while self.grid.get_first_child():
            self.grid.remove(self.grid.get_first_child())
        for i, d in enumerate(SHORT):
            l = Gtk.Label(label=_(d)); l.add_css_class('dim-label'); l.add_css_class('caption'); self.grid.attach(l, i, 0, 1, 1)
        today = datetime.date.today()
        for r, week in enumerate(calendar.Calendar(0).monthdayscalendar(self.y, self.m)):
            for c, d in enumerate(week):
                if not d:
                    continue
                b = Gtk.Button(label=str(d)); b.add_css_class('flat'); b.add_css_class('kjt-mcal-day')
                if d in self.marks:
                    b.add_css_class('kjt-mcal-feast')
                if (self.y, self.m, d) == (today.year, today.month, today.day):
                    b.add_css_class('kjt-mcal-today')
                b.connect('clicked', lambda _b, d=d: self.on_pick(datetime.date(self.y, self.m, d)))
                self.grid.attach(b, c, r + 1, 1, 1)
