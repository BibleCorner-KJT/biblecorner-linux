"""Good Fun (2.16): the Bible games, made by the app (not the website in a frame). The words, clues, verses and
riddles come from the website's games (kept on this computer), so they are the same on the phone and here.
Easy wins a bronze trophy, Medium silver, Hard gold; your best scores are kept on this computer.
This first set: Sudoku, Word Seek, Bible Crossword, Memory Match, Books of the Bible, Bible Timeline,
Verse Builder and Who Am I?"""
import json, os, random, re, time
from gi.repository import Gtk, Adw, Gdk, GLib, Pango
from .core import STORE, NET, SITE, lang, run_bg
from .i18n import _
from . import sfx

LEVELS = (('easy', 'Easy', '🥉'), ('medium', 'Medium', '🥈'), ('hard', 'Hard', '🥇'))
RANK = {'easy': 1, 'medium': 2, 'hard': 3}


def data():
    return STORE.kv('fun_data') or {}


def best(gid, level, score, lower=False):
    """keeps the best score of a game and level; returns (best, is_new)"""
    b = dict(STORE.kv('fun_best') or {}); k = gid + '.' + level; old = b.get(k)
    new = old is None or (score < old if lower else score > old)
    if new:
        b[k] = score; STORE.set_kv('fun_best', b)
    t = dict(STORE.kv('fun_trophy') or {})
    if RANK[level] > RANK.get(t.get(gid), 0):
        t[gid] = level; STORE.set_kv('fun_trophy', t)
    return (score if new else old), new


def fmt(s):
    return '%d:%02d' % (s // 60, s % 60)


def lbl(text, *classes, wrap=True, xalign=0):
    l = Gtk.Label(label=text, wrap=wrap, xalign=xalign, wrap_mode=Pango.WrapMode.WORD_CHAR)
    for c in classes:
        l.add_css_class(c)
    return l


class Game(Gtk.Box):
    """what every game has: a top row (what to do, the time), and its end"""
    lower = True          # a lower score (time) is better

    def __init__(self, page, level):
        super().__init__(orientation=Gtk.Orientation.VERTICAL, spacing=12)
        self.page, self.level, self.t0, self.over = page, level, time.time(), False
        self.top = Gtk.Box(spacing=10); self.append(self.top)
        self.info = lbl('', 'kjt-fun-info', wrap=True); self.info.set_hexpand(True); self.top.append(self.info)
        self.clock = lbl('⏱ 0:00', 'kjt-fun-clock', wrap=False); self.top.append(self.clock)
        GLib.timeout_add(500, self.tick)

    def secs(self):
        return int(time.time() - self.t0)

    def tick(self):
        if self.over or not self.get_root():
            return False
        self.clock.set_label('⏱ ' + fmt(self.secs())); return True

    def won(self, score, line):
        if self.over:
            return
        self.over = True; sfx.play('success')
        b, new = best(self.gid, self.level, score, self.lower)
        self.page.finished(self, line, (('🏅 ' + _('New personal best!') + ' ') if new else '') + _('Your best on this level:') + ' ' + (fmt(b) if self.lower else str(b)))


# ---------------- Sudoku ----------------
def sudoku_make(clues):
    base = list(range(1, 10))
    g = [[0] * 9 for _ in range(9)]
    def ok(g, r, c, v):
        if v in g[r] or any(g[i][c] == v for i in range(9)):
            return False
        br, bc = r // 3 * 3, c // 3 * 3
        return all(g[br + i][bc + j] != v for i in range(3) for j in range(3))
    def fill(i=0):
        if i == 81:
            return True
        r, c = divmod(i, 9)
        for v in random.sample(base, 9):
            if ok(g, r, c, v):
                g[r][c] = v
                if fill(i + 1):
                    return True
                g[r][c] = 0
        return False
    fill()
    sol = [row[:] for row in g]
    def count(g, lim=2):
        for i in range(81):
            r, c = divmod(i, 9)
            if g[r][c] == 0:
                n = 0
                for v in range(1, 10):
                    if ok(g, r, c, v):
                        g[r][c] = v; n += count(g, lim - n); g[r][c] = 0
                        if n >= lim:
                            return n
                return n
        return 1
    cells = random.sample(range(81), 81); left = 81
    for i in cells:
        if left <= clues:
            break
        r, c = divmod(i, 9); v = g[r][c]; g[r][c] = 0
        if count([row[:] for row in g]) != 1:
            g[r][c] = v
        else:
            left -= 1
    return g, sol


class Sudoku(Game):
    gid = 'sudoku'

    def __init__(self, page, level):
        super().__init__(page, level)
        self.info.set_label(_('Fill every row, column and square with the numbers 1 to 9.'))
        self.puz, self.sol = sudoku_make({'easy': 40, 'medium': 32, 'hard': 26}[level])
        self.cur = None; self.btn = {}; self.vals = [row[:] for row in self.puz]
        grid = Gtk.Grid(halign=Gtk.Align.CENTER, row_spacing=0, column_spacing=0); grid.add_css_class('kjt-sdk')
        for r in range(9):
            for c in range(9):
                b = Gtk.Button(label=str(self.puz[r][c]) if self.puz[r][c] else ''); b.add_css_class('kjt-sdk-cell')
                if self.puz[r][c]:
                    b.add_css_class('kjt-sdk-given')
                if c in (2, 5):
                    b.add_css_class('kjt-sdk-r')
                if r in (2, 5):
                    b.add_css_class('kjt-sdk-b')
                b.connect('clicked', lambda _b, r=r, c=c: self.choose(r, c))
                grid.attach(b, c, r, 1, 1); self.btn[(r, c)] = b
        self.append(grid)
        pad = Gtk.Box(spacing=4, halign=Gtk.Align.CENTER); pad.add_css_class('linked')
        for v in range(1, 10):
            b = Gtk.Button(label=str(v)); b.add_css_class('kjt-sdk-pad'); b.connect('clicked', lambda _b, v=v: self.put(v)); pad.append(b)
        e = Gtk.Button(label='⌫', tooltip_text=_('Clear')); e.add_css_class('kjt-sdk-pad'); e.connect('clicked', lambda *_a: self.put(0)); pad.append(e)
        self.append(pad)
        row = Gtk.Box(spacing=8, halign=Gtk.Align.CENTER)
        chk = Gtk.Button(label='✔ ' + _('Check my answers')); chk.add_css_class('pill'); chk.connect('clicked', lambda *_a: self.check(True)); row.append(chk)
        self.append(row)
        k = Gtk.EventControllerKey(); k.connect('key-pressed', self.key); self.add_controller(k)

    def choose(self, r, c):
        if self.cur:
            self.btn[self.cur].remove_css_class('kjt-sdk-on')
        self.cur = (r, c); self.btn[self.cur].add_css_class('kjt-sdk-on')
        v = self.vals[r][c]
        for (rr, cc), b in self.btn.items():
            (b.add_css_class if v and self.vals[rr][cc] == v else b.remove_css_class)('kjt-sdk-same')

    def key(self, c, kv, code, st):
        ch = Gdk.keyval_to_unicode(kv)
        if self.cur and ch and chr(ch) in '123456789':
            self.put(int(chr(ch))); return True
        if self.cur and kv in (Gdk.KEY_BackSpace, Gdk.KEY_Delete, Gdk.KEY_0):
            self.put(0); return True
        mv = {Gdk.KEY_Left: (0, -1), Gdk.KEY_Right: (0, 1), Gdk.KEY_Up: (-1, 0), Gdk.KEY_Down: (1, 0)}.get(kv)
        if mv:
            r, c = self.cur or (0, 0); r, c = (r + mv[0]) % 9, (c + mv[1]) % 9; self.choose(r, c); self.btn[(r, c)].grab_focus(); return True
        return False

    def put(self, v):
        if not self.cur or self.over:
            return
        r, c = self.cur
        if self.puz[r][c]:
            return
        self.vals[r][c] = v; b = self.btn[(r, c)]; b.set_label(str(v) if v else ''); b.remove_css_class('kjt-sdk-bad'); sfx.play('tap')
        self.choose(r, c)
        if all(self.vals[i][j] == self.sol[i][j] for i in range(9) for j in range(9)):
            self.won(self.secs(), '🎉 ' + _('Solved!') + ' ⏱ ' + fmt(self.secs()))

    def check(self, show):
        for (r, c), b in self.btn.items():
            if self.vals[r][c] and self.vals[r][c] != self.sol[r][c]:
                b.add_css_class('kjt-sdk-bad'); self.wrong = True
        sfx.play('miss' if getattr(self, 'wrong', False) else 'good'); self.wrong = False


# ---------------- Word Seek ----------------
class WordSeek(Game):
    gid = 'seek'

    def __init__(self, page, level):
        super().__init__(page, level)
        N = {'easy': 9, 'medium': 11, 'hard': 13}[level]; want = {'easy': 6, 'medium': 8, 'hard': 10}[level]
        dirs = [(0, 1), (1, 0)] + ([(1, 1), (-1, 1)] if level != 'easy' else []) + ([(0, -1), (-1, 0), (-1, -1), (1, -1)] if level == 'hard' else [])
        themes = page.themes()
        for _try in range(30):
            th = random.choice(themes)
            words = [w for w in th['words'] if 3 <= len(list(w)) <= N]
            if len(words) >= want:
                break
        self.theme = th['theme']
        grid = [[''] * N for _ in range(N)]; placed = []
        for w in random.sample(words, len(words)):
            if len(placed) >= want:
                break
            L = list(w)
            for _t in range(200):
                dr, dc = random.choice(dirs); r, c = random.randrange(N), random.randrange(N)
                er, ec = r + dr * (len(L) - 1), c + dc * (len(L) - 1)
                if not (0 <= er < N and 0 <= ec < N):
                    continue
                if all(grid[r + dr * i][c + dc * i] in ('', L[i]) for i in range(len(L))):
                    for i in range(len(L)):
                        grid[r + dr * i][c + dc * i] = L[i]
                    placed.append((w, [(r + dr * i, c + dc * i) for i in range(len(L))])); break
        letters = [ch for w, _c in placed for ch in w] or list('ABCDEFGHIJKLMNOPRSTUVWY')
        for r in range(N):
            for c in range(N):
                if not grid[r][c]:
                    grid[r][c] = random.choice(letters)
        self.N, self.grid, self.placed, self.found, self.drag = N, grid, placed, set(), None
        self.info.set_label(_('Find the hidden Bible words in the grid.') + '  ' + self.theme)
        body = Gtk.Box(spacing=16, halign=Gtk.Align.CENTER)
        self.area = Gtk.DrawingArea(content_width=N * 50, content_height=N * 50); self.area.set_draw_func(self.draw); body.append(self.area)
        d = Gtk.GestureDrag(); d.connect('drag-begin', self.d0); d.connect('drag-update', self.d1); d.connect('drag-end', self.d2); self.area.add_controller(d)
        self.list = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4, valign=Gtk.Align.START); body.append(self.list)
        self.labels = {}
        for w, _c in placed:
            l = lbl(w, 'kjt-seek-w', wrap=False); self.list.append(l); self.labels[w] = l
        self.append(body)

    def cell(self, x, y):
        s = self.area.get_width() / self.N
        return int(y // s), int(x // s)

    def d0(self, g, x, y):
        self.drag = [self.cell(x, y), self.cell(x, y)]; self.x0, self.y0 = x, y; self.area.queue_draw()

    def d1(self, g, dx, dy):
        r, c = self.cell(self.x0 + dx, self.y0 + dy)
        r0, c0 = self.drag[0]; dr, dc = r - r0, c - c0
        # straight lines only (along, down or slanting)
        if dr and dc and abs(dr) != abs(dc):
            if abs(dr) > abs(dc):
                dc = 0
            else:
                dr = 0
        self.drag[1] = (max(0, min(self.N - 1, r0 + dr)), max(0, min(self.N - 1, c0 + dc))); self.area.queue_draw()

    def line(self, a, b):
        (r0, c0), (r1, c1) = a, b; n = max(abs(r1 - r0), abs(c1 - c0))
        sr = (r1 > r0) - (r1 < r0); sc = (c1 > c0) - (c1 < c0)
        return [(r0 + sr * i, c0 + sc * i) for i in range(n + 1)]

    def d2(self, g, dx, dy):
        if not self.drag:
            return
        cells = self.line(*self.drag); self.drag = None
        for w, cs in self.placed:
            if w not in self.found and (cs == cells or cs == cells[::-1]):
                self.found.add(w); self.labels[w].add_css_class('kjt-seek-done'); sfx.play('good')
        self.area.queue_draw()
        if len(self.found) == len(self.placed) and self.placed:
            self.won(self.secs(), '🎉 ' + _('All words found!') + ' ⏱ ' + fmt(self.secs()))

    def draw(self, a, cr, w, h):
        import math
        s = w / self.N
        for wd, cs in self.placed:
            if wd in self.found:
                self.stroke(cr, cs, s, (0.79, 0.64, 0.15, 0.45))
        if self.drag:
            self.stroke(cr, self.line(*self.drag), s, (0.48, 0.12, 0.47, 0.35))
        fg = self.get_color()
        cr.set_source_rgba(fg.red, fg.green, fg.blue, 1)
        for r in range(self.N):
            for c in range(self.N):
                lay = a.create_pango_layout(self.grid[r][c]); lay.set_font_description(Pango.FontDescription.from_string('Sans Bold %d' % max(9, int(s * 0.38))))
                lw, lh = lay.get_pixel_size(); cr.move_to(c * s + (s - lw) / 2, r * s + (s - lh) / 2)
                from gi.repository import PangoCairo
                PangoCairo.show_layout(cr, lay)

    def stroke(self, cr, cs, s, rgba):
        (r0, c0), (r1, c1) = cs[0], cs[-1]
        cr.set_source_rgba(*rgba); cr.set_line_width(s * 0.72); cr.set_line_cap(1)
        cr.move_to(c0 * s + s / 2, r0 * s + s / 2); cr.line_to(c1 * s + s / 2, r1 * s + s / 2); cr.stroke()


# ---------------- Bible Crossword ----------------
class Crossword(Game):
    gid = 'crossword'; lower = False

    def __init__(self, page, level):
        super().__init__(page, level)
        D = data().get('extra') or {}
        clues = dict(D.get('clues') or {})
        if level == 'hard':
            clues.update(D.get('hardclues') or {})
        want = {'easy': 6, 'medium': 9, 'hard': 14}[level]; N = 15
        words = [w for w in clues if w.isalpha() and 3 <= len(w) <= (7 if level == 'easy' else 11 if level == 'medium' else 13)]
        if level == 'hard':
            words = [w for w in (D.get('hardclues') or {}) if len(w) <= 13] + words
        best_p = []
        for _t in range(40):
            p = self.build(random.sample(words, len(words)) if level != 'hard' else words[:20] + random.sample(words[20:], len(words) - 20), N, want)
            if len(p) > len(best_p):
                best_p = p
            if len(best_p) >= want:
                break
        self.placed = best_p; self.clues = clues
        minr = min(p[1] for p in best_p); minc = min(p[2] for p in best_p)
        self.placed = [(w, r - minr, c - minc, dr, dc) for w, r, c, dr, dc in best_p]
        R = max(r + dr * (len(w) - 1) for w, r, c, dr, dc in self.placed) + 1; C = max(c + dc * (len(w) - 1) for w, r, c, dr, dc in self.placed) + 1
        self.ch = {}
        for w, r, c, dr, dc in self.placed:
            for i, x in enumerate(w):
                self.ch[(r + dr * i, c + dc * i)] = x
        starts = {}; n = 0
        for w, r, c, dr, dc in sorted(self.placed, key=lambda p: (p[1], p[2])):
            if (r, c) not in starts:
                n += 1; starts[(r, c)] = n
        self.num = {p[0]: starts[(p[1], p[2])] for p in self.placed}
        self.info.set_label(_('Read the clues and fill in the words.'))
        body = Gtk.Box(spacing=18, halign=Gtk.Align.CENTER)
        grid = Gtk.Grid(row_spacing=2, column_spacing=2, valign=Gtk.Align.START); self.ent = {}; self.dir = (0, 1)
        for r in range(R):
            for c in range(C):
                if (r, c) in self.ch:
                    ov = Gtk.Overlay()
                    e = Gtk.Entry(max_length=1, width_chars=1, max_width_chars=1, xalign=0.5); e.add_css_class('kjt-xw-cell')
                    e.connect('changed', lambda e, k=(r, c): self.typed(e, k)); ov.set_child(e)
                    if (r, c) in starts:
                        nl = Gtk.Label(label=str(starts[(r, c)]), halign=Gtk.Align.START, valign=Gtk.Align.START, margin_start=2); nl.add_css_class('kjt-xw-n'); nl.set_can_target(False); ov.add_overlay(nl)
                    kc = Gtk.EventControllerKey(); kc.connect('key-pressed', lambda c_, kv, *_a, k=(r, c): self.key(k, kv)); e.add_controller(kc)
                    fc = Gtk.EventControllerFocus(); fc.connect('enter', lambda *_a, k=(r, c): self.focus(k)); e.add_controller(fc)
                    grid.attach(ov, c, r, 1, 1); self.ent[(r, c)] = e
                else:
                    sp = Gtk.Box(); sp.set_size_request(42, 42); grid.attach(sp, c, r, 1, 1)
        body.append(grid)
        cl = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=4, valign=Gtk.Align.START); cl.set_size_request(260, -1)
        self.clue_lab = {}
        for head, d in ((_('Across'), (0, 1)), (_('Down'), (1, 0))):
            cl.append(lbl(head, 'heading'))
            for w, r, c, dr, dc in sorted(self.placed, key=lambda p: self.num[p[0]]):
                if (dr, dc) == d:
                    l = lbl('%d. %s%s' % (self.num[w], clues.get(w, ''), '' if level == 'hard' else ' (%d)' % len(w)), 'kjt-xw-clue')
                    cl.append(l); self.clue_lab[w] = l
        body.append(cl); self.append(body)
        row = Gtk.Box(spacing=8, halign=Gtk.Align.CENTER)
        b1 = Gtk.Button(label='✔ ' + _('Check my answers')); b1.add_css_class('pill'); b1.connect('clicked', lambda *_a: self.check()); row.append(b1)
        self.hints = {'easy': 5, 'medium': 3, 'hard': 0}[level]
        if self.hints:
            self.hb = Gtk.Button(label='💡 ' + _('Hint') + ' (%d)' % self.hints); self.hb.add_css_class('pill'); self.hb.connect('clicked', lambda *_a: self.hint()); row.append(self.hb)
        self.append(row); self.lost = 0

    def build(self, words, N, want):
        grid = {}; placed = []
        def fits(w, r, c, dr, dc):
            cross = 0
            if not (0 <= r and 0 <= c and r + dr * (len(w) - 1) < N and c + dc * (len(w) - 1) < N):
                return -1
            if (r - dr, c - dc) in grid or (r + dr * len(w), c + dc * len(w)) in grid:
                return -1
            for i, x in enumerate(w):
                k = (r + dr * i, c + dc * i); g = grid.get(k)
                if g:
                    if g[0] != x or g[1] == (dr, dc):
                        return -1
                    cross += 1
                else:
                    for s in ((dc, dr), (-dc, -dr)):
                        if (k[0] + s[0], k[1] + s[1]) in grid:
                            return -1
            return cross
        for w in words:
            if len(placed) >= want:
                break
            if not placed:
                r, c = N // 2, max(0, (N - len(w)) // 2)
                for i, x in enumerate(w):
                    grid[(r, c + i)] = (x, (0, 1))
                placed.append((w, r, c, 0, 1)); continue
            opts = []
            for (gr, gc), (gx, gd) in list(grid.items()):
                for i, x in enumerate(w):
                    if x != gx:
                        continue
                    dr, dc = (1, 0) if gd == (0, 1) else (0, 1)
                    r, c = gr - dr * i, gc - dc * i
                    f = fits(w, r, c, dr, dc)
                    if f > 0:
                        opts.append((f, r, c, dr, dc))
            if opts:
                f, r, c, dr, dc = max(opts, key=lambda o: (o[0], random.random()))
                for i, x in enumerate(w):
                    grid[(r + dr * i, c + dc * i)] = (x, (dr, dc))
                placed.append((w, r, c, dr, dc))
        return placed

    def focus(self, k):
        across = (k[0], k[1] - 1) in self.ent or (k[0], k[1] + 1) in self.ent
        down = (k[0] - 1, k[1]) in self.ent or (k[0] + 1, k[1]) in self.ent
        if self.dir == (0, 1) and not across and down:
            self.dir = (1, 0)
        elif self.dir == (1, 0) and not down and across:
            self.dir = (0, 1)

    def typed(self, e, k):
        t = re.sub(r'[^A-Za-zΑ-Ωα-ωА-Яа-яЁё]', '', e.get_text()).upper()[-1:]
        if t != e.get_text():
            e.set_text(t); return
        e.remove_css_class('kjt-xw-bad')
        if t:
            nx = (k[0] + self.dir[0], k[1] + self.dir[1])
            if nx in self.ent:
                self.ent[nx].grab_focus()
        if all(self.ent[x].get_text() == self.ch[x] for x in self.ent):
            pts = max(0, len(self.placed) * 10 - self.lost)
            self.won(pts, '🎉 ' + _('Well done!') + ' ⭐ %d / %d' % (pts, len(self.placed) * 10))

    def key(self, k, kv):
        mv = {Gdk.KEY_Left: (0, -1), Gdk.KEY_Right: (0, 1), Gdk.KEY_Up: (-1, 0), Gdk.KEY_Down: (1, 0)}.get(kv)
        if mv:
            nx = (k[0] + mv[0], k[1] + mv[1])
            if nx in self.ent:
                self.dir = (abs(mv[0]), abs(mv[1])); self.ent[nx].grab_focus()
            return True
        if kv == Gdk.KEY_BackSpace and not self.ent[k].get_text():
            pv = (k[0] - self.dir[0], k[1] - self.dir[1])
            if pv in self.ent:
                self.ent[pv].grab_focus(); self.ent[pv].set_text('')
            return True
        return False

    def check(self):
        for k, e in self.ent.items():
            if e.get_text() and e.get_text() != self.ch[k]:
                e.add_css_class('kjt-xw-bad'); self.lost += 1; self.wrong = True
        sfx.play('miss' if getattr(self, 'wrong', False) else 'good'); self.wrong = False

    def hint(self):
        empty = [k for k, e in self.ent.items() if e.get_text() != self.ch[k]]
        if not empty or self.hints <= 0:
            return
        k = random.choice(empty); self.ent[k].set_text(self.ch[k]); self.ent[k].add_css_class('kjt-xw-shown')
        self.hints -= 1; self.lost += 3; self.hb.set_label('💡 ' + _('Hint') + ' (%d)' % self.hints); self.hb.set_sensitive(self.hints > 0)


# ---------------- Memory Match ----------------
class Memory(Game):
    gid = 'memory'

    def __init__(self, page, level):
        super().__init__(page, level)
        n = {'easy': 6, 'medium': 8, 'hard': 12}[level]
        pairs = random.sample((data().get('extra') or {}).get('pairs') or [], n)
        cards = [(i, t) for i, p in enumerate(pairs) for t in p]; random.shuffle(cards)
        self.info.set_label(_('Turn two cards: find each person and what goes with them.'))
        self.moves = 0; self.open = []; self.done = set(); self.cards = cards; self.btns = []
        fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, homogeneous=True, min_children_per_line=4, max_children_per_line=6, column_spacing=8, row_spacing=8)
        for j, (i, t) in enumerate(cards):
            b = Gtk.Button(label='☦'); b.add_css_class('kjt-mem'); b.set_size_request(180, 116)
            b.get_child().set_wrap(True); b.get_child().set_justify(Gtk.Justification.CENTER)
            b.connect('clicked', lambda _b, j=j: self.flip(j)); fb.append(b); self.btns.append(b)
        self.append(fb)

    def flip(self, j):
        if j in self.done or j in self.open or len(self.open) == 2 or self.over:
            return
        self.btns[j].set_label(self.cards[j][1]); self.btns[j].add_css_class('kjt-mem-up'); self.open.append(j); sfx.play('flip')
        if len(self.open) == 2:
            self.moves += 1; a, b = self.open
            if self.cards[a][0] == self.cards[b][0]:
                sfx.play('match')
                for x in (a, b):
                    self.done.add(x); self.btns[x].add_css_class('kjt-mem-ok')
                self.open = []
                if len(self.done) == len(self.cards):
                    self.won(self.moves, '🎉 ' + _('All pairs found!') + ' ' + _('Moves') + ': %d' % self.moves)
            else:
                def back():
                    for x in (a, b):
                        self.btns[x].set_label('☦'); self.btns[x].remove_css_class('kjt-mem-up')
                    self.open = []; return False
                GLib.timeout_add(900, back)
        self.info.set_label(_('Moves') + ': %d' % self.moves)


# ---------------- ordering games: Books of the Bible, Bible Timeline ----------------
class TapOrder(Game):
    """tap the items in their right order"""

    def setup(self, items, help_text):
        self.items = items; self.next = 0; self.miss = 0
        self.info.set_label(help_text)
        self.done_box = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=12, min_children_per_line=1, column_spacing=4, row_spacing=4)
        self.append(self.done_box)
        fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, homogeneous=False, max_children_per_line=4, min_children_per_line=1, column_spacing=8, row_spacing=8)
        order = list(range(len(items))); random.shuffle(order)
        for i in order:
            b = Gtk.Button(label=items[i]); b.add_css_class('kjt-tap'); b.get_child().set_wrap(True)
            b.connect('clicked', lambda b, i=i: self.tap(b, i)); fb.append(b)
        self.append(fb)

    def tap(self, b, i):
        if self.over:
            return
        if i == self.next:
            b.set_sensitive(False); b.add_css_class('kjt-tap-ok'); self.next += 1; sfx.play('step')
            self.done_box.append(lbl('%d. %s' % (self.next, self.items[i]), 'kjt-tap-done', wrap=False))
            if self.next == len(self.items):
                s = self.secs() + 5 * self.miss
                self.won(s, '🎉 ' + _('Well done!') + ' ⏱ ' + fmt(self.secs()) + ('  (+%ds)' % (5 * self.miss) if self.miss else ''))
        else:
            self.miss += 1; b.add_css_class('kjt-tap-bad'); sfx.play('miss'); GLib.timeout_add(500, lambda: (b.remove_css_class('kjt-tap-bad'), False)[1])


class Books(TapOrder):
    gid = 'books'

    def __init__(self, page, level):
        super().__init__(page, level)
        bk = (data().get('extra') or {}).get('books') or {}
        part = random.choice(['ot', 'nt']) if level != 'hard' else random.choice(['ot', 'nt'])
        allb = bk.get(part) or []
        n = {'easy': 6, 'medium': 10, 'hard': 14}[level]
        s = random.randrange(0, max(1, len(allb) - n))
        self.setup(allb[s:s + n], _('Tap the books in the order they are in the Bible.') + '  ' + (_('Old Testament') if part == 'ot' else _('New Testament')))


class Timeline(TapOrder):
    gid = 'timeline'

    def __init__(self, page, level):
        super().__init__(page, level)
        ev = sorted((data().get('extra') or {}).get('events') or [], key=lambda e: e.get('i', 0))
        n = {'easy': 5, 'medium': 7, 'hard': 10}[level]
        pick = sorted(random.sample(range(len(ev)), min(n, len(ev))))
        self.setup([ev[i]['t'] for i in pick], _('Tap what happened first, then what came next.'))


# ---------------- Verse Builder ----------------
class VerseBuilder(Game):
    gid = 'verse'

    def __init__(self, page, level):
        super().__init__(page, level)
        vs = (data().get('extra') or {}).get('verses') or []
        def n(v):
            return len(v['t'].split())
        pool = [v for v in vs if (n(v) <= 7 if level == 'easy' else 6 <= n(v) <= 12 if level == 'medium' else n(v) >= 9)] or vs
        self.rounds = random.sample(pool, min(5, len(pool))); self.i = 0; self.miss = 0
        self.body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10); self.append(self.body)
        self.round()

    def round(self):
        while self.body.get_first_child():
            self.body.remove(self.body.get_first_child())
        v = self.rounds[self.i]; self.words = v['t'].split(); self.next = 0
        self.info.set_label(_('Put the words of the verse in order.') + '  %d / %d' % (self.i + 1, len(self.rounds)))
        self.built = lbl('', 'kjt-vb-built'); self.body.append(self.built)
        self.body.append(lbl('— ' + v['ref'], 'dim-label'))
        fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, max_children_per_line=8, min_children_per_line=2, column_spacing=6, row_spacing=6)
        order = list(range(len(self.words))); random.shuffle(order)
        for j in order:
            b = Gtk.Button(label=self.words[j]); b.add_css_class('kjt-tap'); b.connect('clicked', lambda b, j=j: self.tap(b, j)); fb.append(b)
        self.body.append(fb)

    def tap(self, b, j):
        if self.over:
            return
        if self.words[j] == self.words[self.next]:
            b.set_sensitive(False); b.add_css_class('kjt-tap-ok'); self.next += 1; sfx.play('step')
            self.built.set_label(' '.join(self.words[:self.next]))
            if self.next == len(self.words):
                self.i += 1
                if self.i == len(self.rounds):
                    s = self.secs() + 3 * self.miss
                    self.won(s, '🎉 ' + _('Well done!') + ' ⏱ ' + fmt(self.secs()))
                else:
                    GLib.timeout_add(700, lambda: (self.round(), False)[1])
        else:
            self.miss += 1; b.add_css_class('kjt-tap-bad'); sfx.play('miss'); GLib.timeout_add(450, lambda: (b.remove_css_class('kjt-tap-bad'), False)[1])


# ---------------- Who Am I? ----------------
class WhoAmI(Game):
    gid = 'whoami'; lower = False

    def __init__(self, page, level):
        super().__init__(page, level)
        rs = [r for r in ((STORE.kv('info') or {}).get('riddles') or []) if r.get('wrong1') and r.get('wrong2')]
        hard = [r for r in rs if r.get('level') == 'hard']; easy = [r for r in rs if r.get('level') != 'hard']
        pool = hard if level == 'hard' and hard else easy or rs
        self.rounds = random.sample(pool, min(8, len(pool))); self.i = 0; self.score = 0
        self.body = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=10); self.append(self.body)
        if not self.rounds:
            self.info.set_label(_('Open this page once with internet: it is then kept on this device.')); return
        self.round()

    def round(self):
        while self.body.get_first_child():
            self.body.remove(self.body.get_first_child())
        r = self.rounds[self.i]; self.shown = 1; self.r = r
        self.info.set_label(_('Read the clues and guess the Bible person.') + '  %d / %d · ⭐ %d' % (self.i + 1, len(self.rounds), self.score))
        self.clues = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6); self.body.append(self.clues)
        self.clues.append(lbl('❓ ' + r['clues'][0], 'kjt-who-clue'))
        self.more = Gtk.Button(label='➕ ' + _('Another clue'), halign=Gtk.Align.START); self.more.add_css_class('pill')
        self.more.connect('clicked', lambda *_a: self.another()); self.more.set_sensitive(len(r['clues']) > 1); self.body.append(self.more)
        row = Gtk.Box(spacing=8, homogeneous=True)
        for name in random.sample([r['answer'], r['wrong1'], r['wrong2']], 3):
            b = Gtk.Button(label=name); b.add_css_class('kjt-tap'); b.connect('clicked', lambda b, name=name, row=row: self.answer(b, name, row)); row.append(b)
        self.body.append(row)

    def another(self):
        if self.shown < len(self.r['clues']):
            self.clues.append(lbl('❓ ' + self.r['clues'][self.shown], 'kjt-who-clue')); self.shown += 1; sfx.play('tap')
        self.more.set_sensitive(self.shown < len(self.r['clues']))

    def answer(self, b, name, row):
        ok = name == self.r['answer']
        b.add_css_class('kjt-tap-ok' if ok else 'kjt-tap-bad'); sfx.play('good' if ok else 'miss')
        for x in list(row):
            x.set_sensitive(False)
            if x.get_label() == self.r['answer']:
                x.add_css_class('kjt-tap-ok')
        if ok:
            self.score += max(1, 4 - self.shown)
        self.i += 1
        def nxt():
            if self.i == len(self.rounds):
                self.won(self.score, '🎉 ' + _('Well done!') + ' ⭐ %d' % self.score)
            else:
                self.round()
            return False
        GLib.timeout_add(1100, nxt)


GAMES = [('sudoku', '🔢', 'Sudoku', 'Fill every row, column and square with the numbers 1 to 9.', Sudoku),
         ('seek', '🔤', 'Word Seek', 'Find hidden Bible words in the grid', WordSeek),
         ('crossword', '✏️', 'Bible Crossword', 'Read the clues and fill in the words.', Crossword),
         ('whoami', '❓', 'Who Am I?', 'Read the clues and guess the Bible person', WhoAmI),
         ('memory', '🃏', 'Memory Match Master', 'Turn two cards: find each person and what goes with them.', Memory),
         ('books', '📚', 'Books of the Bible Race', 'Tap the books in the order they are in the Bible.', Books),
         ('timeline', '⏳', 'Bible Timeline', 'Tap what happened first, then what came next.', Timeline),
         ('verse', '🧩', 'Verse Builder', 'Put the words of the verse in order.', VerseBuilder)]


# 2.25: the website's drawing of each game (assets/kids-games/games.js), and its other games
ART_DIR = os.path.join(os.path.dirname(__file__), 'gameart')


def art(gid, icon, size=56):
    p = os.path.join(ART_DIR, gid + '.svg')
    if os.path.exists(p):
        try:
            pic = Gtk.Picture.new_for_filename(p); pic.set_size_request(size, size); pic.set_can_shrink(True)
            pic.set_content_fit(Gtk.ContentFit.CONTAIN); pic.set_valign(Gtk.Align.CENTER)
            return pic
        except Exception:
            pass
    return lbl(icon, 'kjt-you-emo', wrap=False)


RACE = {'sudoku': 'sudokurace', 'crossword': 'xwrace', 'seek': 'seekrace', 'verse': 'verserace', 'whoami': 'whoami2', 'chess': 'chess', 'checkers': 'checkers', 'c4': 'c4', 'ttt': 'ttt', 'mancala': 'mancala'}
RACE_NAMES = {'chess': 'Holy War (Chess)', 'checkers': 'Checkers', 'c4': 'Loaves and Fishes', 'ttt': 'Fish & Dove', 'mancala': 'Mancala', 'sudokurace': 'Sudoku Race', 'xwrace': 'Crossword Race', 'seekrace': 'Word Seek Race', 'verserace': 'Verse Race', 'whoami2': 'Who Am I? for two'}
WEB_GAMES = [('words', 'Word Builder', 'Build English words on the board: against the computer, or 2 to 4 players', True),
             ('journey', 'Journey to Jerusalem', 'Board game for 1–4 players: climb the ladders of good deeds, beware the serpents, and reach the Temple', True),
             ('tavli', 'Tavli (backgammon)', 'Race your checkers home: the game of Greek and Arab homes', True),
             ('morris', 'Nine Men’s Morris', 'Make rows of three: one of the oldest games in the world', True),
             ('duel', 'Quiz Duel', 'Who knows the Bible best? Play the computer or a friend', True),
             ('hunt', 'Word Hunt', 'Find words in a grid of letters, alone or against a friend', True),
             ('solitaire', 'Solitaire', 'Bible Tiles (Mahjong) or Bible Cards: you choose', False),
             ('puzzle', 'Picture Puzzle', 'Put the picture back together', False),
             ('diff', 'Spot the Difference', 'Find what has changed between two pictures', False),
             ('paul', 'Paul’s Journeys', 'Read the verses from Acts and follow Saint Paul across the Great Sea', False),
             ('icons', 'Icon Detective', 'Recognise saints in icons by their symbols', False),
             ('manna', 'Manna from Heaven', 'Gather God’s bread in the desert, but only what you need', False),
             ('jonah', 'Jonah’s Voyage', 'Sail through the storm and out of the great fish', False),
             ('twobytwo', 'Two by Two', 'Send the animals into the ark in pairs', False)]


class FunPage(Gtk.Box):
    def __init__(self, win):
        super().__init__(orientation=Gtk.Orientation.VERTICAL)
        self.win = win; self.game = None
        tv = Adw.ToolbarView(); tv.set_vexpand(True); self.append(tv)
        hb = Adw.HeaderBar(); tv.add_top_bar(hb); win.sidebar_button(hb)
        self.back = Gtk.Button(icon_name='kjt-prev-symbolic', tooltip_text=_('All games'), visible=False); self.back.connect('clicked', lambda *_a: self.hub())
        hb.pack_start(self.back)
        self.title = Gtk.Label(label=_('Good Fun')); self.title.add_css_class('heading'); hb.set_title_widget(self.title)
        # 2.18: sound on or off, and the whole screen for the game
        self.snd = Gtk.ToggleButton(icon_name='audio-volume-high-symbolic' if sfx.on() else 'audio-volume-muted-symbolic', active=sfx.on(), tooltip_text=_('Sounds'))
        self.snd.add_css_class('flat'); self.snd.connect('toggled', self.sound); hb.pack_end(self.snd)
        self.fs = Gtk.ToggleButton(icon_name='view-fullscreen-symbolic', tooltip_text=_('Full screen')); self.fs.add_css_class('flat')
        self.fs.connect('toggled', lambda b: win.fullscreen() if b.get_active() else win.unfullscreen()); hb.pack_end(self.fs)
        win.connect('notify::fullscreened', lambda w, _p: self.fs.set_active(w.is_fullscreen()))
        self.box = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=14, margin_top=16, margin_bottom=30, margin_start=16, margin_end=16)
        c = Adw.Clamp(maximum_size=900); c.set_child(self.box); self.clamp = c
        self.sc = Gtk.ScrolledWindow(vexpand=True, hscrollbar_policy=Gtk.PolicyType.NEVER); self.sc.set_child(c); tv.set_content(self.sc)
        self.hub()
        self.connect('unmap', lambda *_a: self.unmap_do())
        # 2.26: the games exactly as on the website (its own page and games), kept on this computer for use offline
        self.tv = tv; self.hb = hb; self.wv = None
        from . import webgame
        if webgame.WebKit:
            self.web_mode()

    def web_mode(self):
        from . import webgame
        self.wv = webgame.view('')
        if self.wv is None:
            return
        self.snd.set_visible(False); self.back.set_visible(False); self.back.set_sensitive(False)
        wb = Gtk.Button(icon_name='kjt-prev-symbolic', tooltip_text=_('Back'), visible=False); self.hb.pack_start(wb)
        wb.connect('clicked', lambda *_a: self.wv.go_back() if self.wv.can_go_back() else None)
        self.wv.connect('notify::uri', lambda v, _p: wb.set_visible(v.can_go_back()))
        self.keep = Gtk.Button(icon_name='kjt-download-symbolic', tooltip_text=_('Keep all the games on this computer (for use without the internet)')); self.keep.add_css_class('flat')
        self.keep.connect('clicked', lambda *_a: self.keep_all()); self.hb.pack_end(self.keep)
        self.tv.set_content(self.wv)

    def keep_all(self):
        from . import sitecache
        from .core import NET
        if not NET.online():
            self.win.toast(_('This needs the internet. Try again when you are connected.')); return
        self.keep.set_sensitive(False); self.win.toast(_('Keeping the games on this computer…'))
        def prog(i, n):
            self.keep.set_tooltip_text('%d / %d' % (i, n)); return False
        def done(n):
            self.keep.set_sensitive(True); self.keep.set_tooltip_text(_('Keep all the games on this computer (for use without the internet)'))
            self.win.toast(_('The games are kept on this computer: they work without the internet.') if n else _('Could not save now. Please try again.'))
        run_bg(lambda: sitecache.keep_games(prog), done)

    def refresh(self):
        d = data()
        if d and time.time() - d.get('_t', 0) < 86400 and d.get('_l') == lang() or not NET.online():
            return
        base = (STORE.kv('info') or {}).get('games') or SITE + '/wp-content/plugins/kjt-site-core/assets/kids-games/'
        lg = lang()
        def work():
            out = {'_t': time.time(), '_l': lg}
            out['extra'] = json.loads(NET.get(base + 'extra.json', timeout=60, strict=True).decode())
            out['words'] = json.loads(NET.get(base + 'words.json', timeout=60, strict=True).decode())
            if lg != 'en':
                try:
                    out['lang'] = json.loads(NET.get(base + 'lang/%s.json' % lg, timeout=60, strict=True).decode())
                except Exception:
                    pass
            STORE.set_kv('fun_data', out); return True
        run_bg(work, lambda r: self.hub() if r is True and self.game is None else None)

    def sound(self, b):
        from .core import SET
        SET.set('fun_sound', b.get_active()); b.set_icon_name('audio-volume-high-symbolic' if b.get_active() else 'audio-volume-muted-symbolic')
        if b.get_active():
            sfx.play('tap')

    def playing(self, on):
        """while a game is played it has the room: the menu at the side goes away (and comes back after)"""
        split = getattr(self.win, 'split', None)
        if on:
            if split is not None and split.get_show_sidebar() and not split.get_collapsed():
                self.hid_menu = True; split.set_show_sidebar(False)
            self.clamp.set_maximum_size(1400)
        else:
            if getattr(self, 'hid_menu', False) and split is not None:
                split.set_show_sidebar(True)
            self.hid_menu = False; self.clamp.set_maximum_size(900)

    def unmap_do(self):
        self.playing(False)
        if self.win.is_fullscreen():
            self.win.unfullscreen()

    def themes(self):
        d = data(); lw = (d.get('lang') or {}).get('themes')
        return [t for t in (lw if lw and lang() != 'en' else d.get('words') or []) if t.get('words')]

    def clear(self):
        while self.box.get_first_child():
            self.box.remove(self.box.get_first_child())

    def top(self):
        GLib.idle_add(lambda: (self.sc.get_vadjustment().set_value(0), False)[1])

    def hub(self):
        self.game = None; self.back.set_visible(False); self.title.set_label(_('Good Fun')); self.clear(); self.top(); self.playing(False)
        hero = Gtk.Box(orientation=Gtk.Orientation.VERTICAL); hero.add_css_class('kjt-you-hero')
        inner = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_top=16, margin_bottom=16, margin_start=20, margin_end=20); hero.append(inner)
        inner.append(lbl('🎲 ' + _('For the whole family').upper(), 'kjt-you-kick'))
        inner.append(lbl(_('Bible games and puzzles'), 'kjt-you-big'))
        tr = STORE.kv('fun_trophy') or {}
        n = {k: sum(1 for v in tr.values() if v == k) for k, _l, _i in LEVELS}
        inner.append(lbl('🏆 ' + _('My trophies:') + '  🥇 %d  🥈 %d  🥉 %d' % (n['hard'], n['medium'], n['easy']), 'kjt-you-sub'))
        self.box.append(hero)
        if not data().get('extra'):
            self.box.append(lbl(_('Loading…') if NET.online() else _('Open this page once with internet: it is then kept on this device.'), 'dim-label'))
            return
        fb = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, homogeneous=True, min_children_per_line=1, max_children_per_line=3, column_spacing=10, row_spacing=10, valign=Gtk.Align.START)
        for gid, icon, name, blurb, cls in GAMES:
            b = Gtk.Button(); b.add_css_class('kjt-you-feel')
            row = Gtk.Box(spacing=12, margin_top=8, margin_bottom=8, margin_start=6, margin_end=6)
            row.append(art(gid, icon))
            col = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True)
            t = lbl(_(name) + ('  ' + dict((k, i) for k, _l, i in LEVELS)[tr[gid]] if gid in tr else ''), 'kjt-you-ft'); t.set_max_width_chars(20); col.append(t)
            s = lbl(_(blurb), 'kjt-you-fs'); s.set_lines(2); s.set_ellipsize(Pango.EllipsizeMode.END); s.set_max_width_chars(24); col.append(s)
            row.append(col); b.set_child(row); b.connect('clicked', lambda _b, g=(gid, icon, name, blurb, cls): self.levels(g)); fb.append(b)
        self.box.append(fb)
        # 2.25: the website's other games, in the app (their own engine), with playing online
        self.box.append(lbl(_('More games'), 'kjt-you-big2'))
        self.box.append(lbl(_('Board games, action games and more: against the computer, two on one computer, or with a friend online. They need the internet.'), 'dim-label'))
        fb2 = Gtk.FlowBox(selection_mode=Gtk.SelectionMode.NONE, homogeneous=True, min_children_per_line=1, max_children_per_line=3, column_spacing=10, row_spacing=10)
        for gid, name, blurb, online in WEB_GAMES:
            b = Gtk.Button(); b.add_css_class('kjt-you-feel')
            row = Gtk.Box(spacing=12, margin_top=8, margin_bottom=8, margin_start=6, margin_end=6); row.append(art(gid, '🎲'))
            col = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=2, hexpand=True)
            t = lbl(_(name) + ('  🌐' if online else ''), 'kjt-you-ft'); t.set_max_width_chars(20); col.append(t)
            s2 = lbl(_(blurb), 'kjt-you-fs'); s2.set_lines(2); s2.set_ellipsize(Pango.EllipsizeMode.END); s2.set_max_width_chars(24); col.append(s2)
            row.append(col); b.set_child(row); b.connect('clicked', lambda _b, g=gid, n=name: self.web(g, n)); fb2.append(b)
        self.box.append(fb2)
        self.box.append(lbl('🌐 ' + _('can be played with a friend online, by a game code.'), 'dim-label'))

    def web(self, gid, name):
        """a game of the website's engine, in the app"""
        from . import webgame
        self.game = (gid, '', name, '', None); self.back.set_visible(True); self.title.set_label(_(name)); self.clear(); self.playing(True)
        if not NET.online():
            self.box.append(lbl(_('This game needs the internet. Try again when you are connected.'), 'dim-label')); return
        v = webgame.view(gid)
        if v is None:
            self.box.append(lbl(_('This computer cannot show the game here. It opens in your browser.'), 'dim-label'))
            Gtk.UriLauncher.new(webgame.url(gid)).launch(self.win, None, None, None); return
        v.set_size_request(-1, max(560, (self.win.get_height() or 800) - 140))
        self.box.append(v)

    def levels(self, g):
        gid, icon, name, blurb, cls = g
        self.game = g; self.back.set_visible(True); self.title.set_label(_(name)); self.clear(); self.top()
        self.box.append(lbl(icon + '  ' + _(name), 'kjt-you-big2')); self.box.append(lbl(_(blurb), 'dim-label'))
        bs = STORE.kv('fun_best') or {}
        row = Gtk.Box(spacing=10, halign=Gtk.Align.START)
        for k, l, medal in LEVELS:
            b = Gtk.Button(); b.add_css_class('pill'); b.add_css_class('kjt-fun-lvl')
            v = bs.get(gid + '.' + k)
            b.set_label('%s %s%s' % (medal, _(l), ('  · ' + (fmt(v) if cls.lower else str(v))) if v is not None else ''))
            b.connect('clicked', lambda _b, k=k: self.play(g, k)); row.append(b)
        self.box.append(row)
        # 2.25: with a friend online (the same board for two, from the website's engine)
        if gid in RACE:
            ob = Gtk.Button(halign=Gtk.Align.START); ob.add_css_class('pill'); ob.add_css_class('suggested-action')
            ob.set_label('🌐 ' + _('With a friend online')); ob.connect('clicked', lambda *_a: self.web(RACE[gid], RACE_NAMES[RACE[gid]])); self.box.append(ob)
            self.box.append(lbl(_('The same board for both of you, timed: send your friend the game code.'), 'dim-label'))

    def play(self, g, level):
        self.clear(); self.top(); self.playing(True); sfx.play('tap')
        try:
            w = g[4](self, level)
        except Exception as e:
            self.box.append(lbl(_('Open this page once with internet: it is then kept on this device.') + ' (%s)' % e, 'dim-label')); return
        self.box.append(w)

    def finished(self, game, line, best_line):
        bar = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6); bar.add_css_class('card'); bar.add_css_class('kjt-card')
        inner = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=6, margin_top=12, margin_bottom=12, margin_start=16, margin_end=16); bar.append(inner)
        inner.append(lbl(line, 'kjt-card-title')); inner.append(lbl(best_line, 'dim-label'))
        row = Gtk.Box(spacing=8)
        again = Gtk.Button(label='🔁 ' + _('Play again')); again.add_css_class('pill'); again.add_css_class('suggested-action')
        again.connect('clicked', lambda *_a: self.play(self.game, game.level)); row.append(again)
        allg = Gtk.Button(label='← ' + _('All games')); allg.add_css_class('pill'); allg.connect('clicked', lambda *_a: self.hub()); row.append(allg)
        inner.append(row)
        self.box.prepend(bar); self.top()
