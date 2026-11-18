"""2.18: the games' soft sounds, as on the website: made here (no sound files are downloaded), short, quiet and
gentle. Made once into small WAV files in the app's own folder, then played. Off with the speaker button."""
import math, os, random, struct, wave
from gi.repository import Gtk
from .core import DATA, SET

RATE = 22050
_made = {}
_playing = []


def _note(buf, f, start, dur, vol=0.25, glide=None, kind='sine'):
    n0, n = int(start * RATE), int(dur * RATE)
    if len(buf) < n0 + n:
        buf.extend([0.0] * (n0 + n - len(buf)))
    ph = 0.0
    for i in range(n):
        t = i / RATE
        fr = f * ((glide / f) ** (t / dur) if glide else 1)
        ph += 2 * math.pi * fr / RATE
        s = math.sin(ph) if kind == 'sine' else (2 / math.pi) * math.asin(math.sin(ph))     # sine, or triangle
        env = min(1.0, t / 0.012) * math.exp(-4.5 * t / dur)
        buf[n0 + i] += s * env * vol


def _noise(buf, start, dur, vol=0.15, smooth=0.5):
    n0, n = int(start * RATE), int(dur * RATE)
    if len(buf) < n0 + n:
        buf.extend([0.0] * (n0 + n - len(buf)))
    last = 0.0
    for i in range(n):
        last = last * smooth + (random.random() * 2 - 1) * (1 - smooth)
        buf[n0 + i] += last * vol * math.exp(-6 * i / n)


SOUNDS = {
    'tap': lambda b: _note(b, 660, 0, 0.09, 0.18, 520),
    'good': lambda b: [_note(b, f, i * 0.07, 0.22, 0.16) for i, f in enumerate((880, 1175, 1568))],
    'miss': lambda b: _note(b, 220, 0, 0.28, 0.22, 170, 'tri'),
    'success': lambda b: [_note(b, f, i * 0.11, 0.38, 0.17) for i, f in enumerate((523, 659, 784, 1047))] + [_note(b, 1319, 0.5, 0.6, 0.12)],
    'sad': lambda b: [_note(b, f, i * 0.16, 0.4, 0.15, None, 'tri') for i, f in enumerate((392, 349, 311))],
    'flip': lambda b: (_noise(b, 0, 0.06, 0.18, 0.2), _note(b, 520, 0, 0.06, 0.08, 380, 'tri')),
    'card': lambda b: (_noise(b, 0, 0.07, 0.2, 0.3), _note(b, 180, 0.01, 0.08, 0.15, 120)),
    'match': lambda b: (_note(b, 300, 0, 0.08, 0.15, 230, 'tri'), _note(b, 330, 0.09, 0.08, 0.15, 250, 'tri'), _note(b, 1175, 0.16, 0.3, 0.1)),
    'step': lambda b: _note(b, 420, 0, 0.07, 0.14, 300, 'tri'),
    'collect': lambda b: _note(b, 880, 0, 0.08, 0.16, 1320),
}


def on():
    return SET.get('fun_sound') is not False


def _file(name):
    if name in _made:
        return _made[name]
    d = os.path.join(DATA, 'sfx'); os.makedirs(d, exist_ok=True)
    p = os.path.join(d, name + '.wav')
    if not os.path.exists(p):
        buf = []; random.seed(name); SOUNDS[name](buf)
        peak = max(1e-6, max(abs(x) for x in buf))
        k = min(1.0, 0.9 / peak)
        with wave.open(p + '.part', 'wb') as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
            w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, x * k)) * 32000)) for x in buf + [0.0] * 400))
        os.replace(p + '.part', p)
    _made[name] = p
    return p


def play(name):
    if not on() or name not in SOUNDS:
        return
    try:
        m = Gtk.MediaFile.new_for_filename(_file(name))
        m.set_volume(0.7); m.play()
        _playing.append(m)                      # kept until it has played
        del _playing[:-6]
    except Exception:
        pass
