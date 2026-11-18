"""2.17: your study (bookmarks, notes and Study Pads) as a file for AndBible, made on this computer, the same as
the website and the Android app make it (so the same bookmark is never added twice). It is a "Study Pad
export" as AndBible makes them: opened in AndBible, it is added to what AndBible already has, and nothing there
is replaced."""
import hashlib, json, os, shutil, sqlite3, tempfile, time, zipfile
from .core import STORE

HERE = os.path.dirname(os.path.abspath(__file__))
ALIASES = {'EZE': 'EZK', 'JOE': 'JOL', 'MAR': 'MRK', 'PHI': 'PHP', 'SOL': 'SNG'}
NAMED = {'yellow': -5317, 'green': -7617718, 'blue': -12627531, 'pink': -1499549, 'purple': -6543440}
GOLD = -3562969


def ordinals():
    """book|chapter|verse -> AndBible's verse number (JSword's KJVA, as AndBible stores bookmarks)"""
    chapters = json.load(open(os.path.join(HERE, 'kjva-chapters.json')))
    out, o = {}, 1
    for i, (code, counts) in enumerate(chapters.items()):
        if i == 53:
            o += 1                         # the New Testament's introduction
        o += 1                             # the book's introduction
        for c, last in enumerate(counts):
            o += 1                         # the chapter's introduction
            for v in range(1, last + 1):
                o += 1; out['%s|%d|%d' % (code, c + 1, v)] = o
    assert o == 38272 and out['GEN|1|1'] == 4
    return out


def h16(s):
    return hashlib.sha256(s.encode('utf-8')).digest()[:16]


def argb(c):
    c = (c or '').strip().lower()
    if c in NAMED:
        return NAMED[c]
    if len(c) == 7 and c[0] == '#':
        try:
            v = 0xFF000000 | int(c[1:], 16)
            return v - (1 << 32) if v > 0x7FFFFFFF else v
        except ValueError:
            pass
    return GOLD


def build(path):
    """writes the AndBible file; returns (bookmarks, Study Pads, left out)"""
    recs = [r for r in (STORE.records() or []) if not r.get('deleted')]
    pads = {p.get('tag'): p for p in (STORE.pads() or []) if p.get('tag')}
    mp = ordinals()
    tmpd = tempfile.mkdtemp(prefix='kjt-andbible-')
    try:
        dbf = os.path.join(tmpd, 'bookmarks.sqlite3')
        shutil.copy(os.path.join(HERE, 'andbible-template.sqlite3'), dbf)
        db = sqlite3.connect(dbf)
        labels, added, skipped = {}, 0, 0
        def label(tag):
            if tag not in labels:
                labels[tag] = h16('kjtb-label|' + tag)
                name = ((pads.get(tag) or {}).get('name') or '').strip() or tag
                db.execute('INSERT OR IGNORE INTO Label (id,name,color) VALUES (?,?,?)', (labels[tag], name, argb((pads.get(tag) or {}).get('color'))))
            return labels[tag]
        pos = {}
        for tag, p in pads.items():
            for i, it in enumerate(p.get('items') or []):
                if it.get('t') == 'bm':
                    pos.setdefault(tag, {})[it.get('ref')] = (i, int(it.get('indent') or 0))
        for r in recs:
            code = ALIASES.get(str(r.get('book', '')).upper(), str(r.get('book', '')).upper())
            ch = int(r.get('chapter') or 0); v = max(1, int(r.get('verse') or 0))
            start = mp.get('%s|%d|%d' % (code, ch, v))
            if not start:
                skipped += 1; continue
            finish = start
            if r.get('verse_end'):
                finish = max(start, mp.get('%s|%d|%d' % (code, int(r.get('chapter_end') or ch), int(r['verse_end'])), start))
            bid = h16('kjtb-export|' + str(r.get('id') or '%s|%d|%d' % (code, ch, v)))
            stamp = max(1, int(r.get('updated') or time.time())) * 1000
            db.execute('INSERT OR IGNORE INTO BibleBookmark (kjvOrdinalStart,kjvOrdinalEnd,ordinalStart,ordinalEnd,v11n,id,createdAt,lastUpdatedOn,wholeVerse) VALUES (?,?,?,?,?,?,?,?,1)',
                       (start, finish, start, finish, 'KJVA', bid, stamp, stamp))
            note = (r.get('note') or '').strip()
            if note:
                db.execute('INSERT OR IGNORE INTO BibleBookmarkNotes (bookmarkId,notes) VALUES (?,?)', (bid, note))
            seen = []
            for t in r.get('tags') or []:
                if t and t not in seen:
                    seen.append(t)
            for order, tag in enumerate(seen[:12]):
                lid = label(tag)
                ref = '%s|%s|%d|%d' % (r.get('translation', ''), str(r.get('book', '')).upper(), ch, int(r.get('verse') or 0))
                o, ind = (pos.get(tag) or {}).get(ref, (10000 + added, 0))
                db.execute('INSERT OR IGNORE INTO BibleBookmarkToLabel (bookmarkId,labelId,orderNumber,indentLevel) VALUES (?,?,?,?)', (bid, lid, o, ind))
                if order == 0:
                    db.execute('UPDATE BibleBookmark SET primaryLabelId=? WHERE id=?', (lid, bid))
            added += 1
        for tag, p in pads.items():
            lid = label(tag)
            for i, it in enumerate(p.get('items') or []):
                if it.get('t') != 'text':
                    continue
                eid = h16('kjtb-pad|%s|%s' % (tag, it.get('id', i)))
                db.execute('INSERT OR IGNORE INTO StudyPadTextEntry (id,labelId,orderNumber,indentLevel) VALUES (?,?,?,?)', (eid, lid, i, int(it.get('indent') or 0)))
                db.execute('INSERT OR IGNORE INTO StudyPadTextEntryText (studyPadTextEntryId,text) VALUES (?,?)', (eid, it.get('html') or ''))
        db.commit(); db.close()
        part = path + '.part'
        with zipfile.ZipFile(part, 'w', zipfile.ZIP_DEFLATED) as z:
            # the manifest first: AndBible reads it to know this is a Study Pad export
            z.writestr('AndBibleBackupManifest.json', json.dumps({'backupType': 'STUDYPAD_EXPORT', 'contains': ['BOOKMARKS'], 'manifestVersion': 1, 'andBibleVersion': 1117}))
            z.write(dbf, 'db/bookmarks.sqlite3')
        os.replace(part, path)
        return added, len(labels), skipped
    finally:
        shutil.rmtree(tmpd, ignore_errors=True)
