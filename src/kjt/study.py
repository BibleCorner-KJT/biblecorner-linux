"""Your study: bookmarks (with colours and notes) and Study Pads, kept here and in step with My KJT."""
import hashlib, json, time
from gi.repository import GLib
from .core import STORE, NET, info, run_bg

COLORS = {'yellow': '#f6d365', 'green': '#9be3a4', 'blue': '#9cc9f5', 'pink': '#f7a8c4', 'purple': '#c9a7f0'}


def rid(tr, book, ch, v):
    return hashlib.sha256(('%s|%s|%d|%d' % (tr, book, int(ch), int(v))).encode()).hexdigest()


class Study:
    def __init__(self):
        self.listeners = []
        self.syncing = False

    def listen(self, fn):
        self.listeners.append(fn)

    def changed(self):
        for fn in list(self.listeners):
            GLib.idle_add(lambda fn=fn: (fn(), False)[1])

    def user(self):
        return (STORE.kv('info') or {}).get('user')

    # reading
    def records(self):
        return STORE.records()

    def in_chapter(self, tr, book, ch):
        out = {}
        for r in STORE.records():
            if r.get('translation') == tr and r.get('book') == book and int(r.get('chapter', 0)) <= ch <= int(r.get('chapter_end') or r.get('chapter', 0)):
                c1, v1 = int(r['chapter']), int(r.get('verse') or 1)
                c2 = int(r.get('chapter_end') or c1); v2 = int(r.get('verse_end') or v1)
                for v in range(1 if ch > c1 else v1, (v2 if ch == c2 else 400) + 1):
                    out[v] = r
        return out

    def pads(self):
        return sorted(STORE.pads(), key=lambda p: self.pad_name(p.get('tag', '')).casefold())

    def pad(self, tag):
        return next((p for p in STORE.pads() if p.get('tag') == tag), None)

    def pad_name(self, tag):
        """the Study Pad's own name, as on the website (the short code behind it stays hidden)"""
        p = self.pad(tag)
        return ((p or {}).get('name') or '').strip() or tag.replace('-', ' ').replace('_', ' ').capitalize()

    def pad_label(self, tag):
        p = self.pad(tag) or {}
        return (p.get('icon') or '🗂') + ' ' + self.pad_name(tag)

    def new_pad(self, name):
        """a new Study Pad with the name you give it; it returns the pad's code"""
        import re
        name = ' '.join(name.split())[:60]
        tag = re.sub(r'[^\w-]+', '-', name.lower()).strip('-')[:30] or 'pad'
        base, n = tag, 2
        while self.pad(tag) and self.pad_name(tag).casefold() != name.casefold():
            tag = '%s-%d' % (base, n); n += 1
        if not self.pad(tag):
            pad = {'tag': tag, 'name': name, 'color': '', 'updated': int(time.time()), 'items': []}
            STORE.put_pads([pad])
            self.send({'op': 'save', 'pad': json.dumps(pad), 'merge': 1}, pads=True)
            self.changed()
        return tag

    def rename_pad(self, tag, name):
        p = self.pad(tag)
        if not p or not name.strip():
            return
        base = int(p.get('updated') or 0)
        p = dict(p, name=' '.join(name.split())[:60], updated=int(time.time())); STORE.put_pads([p])
        self.send({'op': 'save', 'pad': json.dumps(dict(p, base=base)), 'merge': 1}, pads=True); self.changed()

    def pad_color(self, tag):
        for p in STORE.pads():
            if p.get('tag') == tag and p.get('color'):
                return p['color']
        return None

    # changing (here at once; on the website now, or as soon as it can be reached)
    def save(self, tr, book, ch, v, v_end=0, color=None, note=None):
        i = rid(tr, book, ch, v)
        old = next((r for r in STORE.records() if r['id'] == i), {})
        r = dict(old, id=i, translation=tr, book=book, chapter=int(ch), verse=int(v), note=old.get('note', '') if note is None else note,
                 created=old.get('created', int(time.time())), updated=int(time.time()))
        if v_end and int(v_end) > int(v):
            r['verse_end'] = int(v_end)
        if color:
            r['color'] = color
        STORE.put_records([r])
        post = {'op': 'save', 'translation': tr, 'book': book, 'chapter': ch, 'verse': v, 'note': r['note']}
        if r.get('verse_end'):
            post['verse_end'] = r['verse_end']
        if r.get('color'):
            post['color'] = r['color']
        self.send(post)
        if r.get('tags'):
            self.send({'op': 'update_tags', 'id': i, 'tags': ' '.join(r['tags'])})
        self.changed()
        return r

    def set_note(self, r, note):
        r = dict(r, note=note, updated=int(time.time())); STORE.put_records([r])
        self.send({'op': 'update_note', 'id': r['id'], 'note': note}); self.changed()

    def set_color(self, r, color):
        r = dict(r, updated=int(time.time()))
        if color:
            r['color'] = color
        else:
            r.pop('color', None)
        STORE.put_records([r])
        self.send({'op': 'edit', 'id': r['id'], 'color': color or ''}); self.changed()

    def set_tags(self, r, tags):
        r = dict(r, tags=sorted(set(t for t in tags if t))[:12], updated=int(time.time())); STORE.put_records([r])
        self.send({'op': 'update_tags', 'id': r['id'], 'tags': ' '.join(r['tags'])})
        for t in r['tags']:
            if not any(p['tag'] == t for p in STORE.pads()):
                STORE.put_pads([{'tag': t, 'color': '', 'updated': int(time.time()), 'items': []}])
        self.changed()

    def delete(self, r):
        STORE.del_record(r['id']); self.send({'op': 'delete', 'id': r['id']}); self.changed()

    # the website
    def send(self, post, pads=False):
        if not self.user():
            return
        STORE.queue({'pads': pads, 'post': post})
        run_bg(self.flush)

    def flush(self):
        i = STORE.kv('info') or {}
        if not i.get('nonce_study') or not NET.online():
            return False
        for n, job in STORE.outbox():
            post = dict(job['post'], nonce=i['nonce_study'])
            if not job.get('pads') and i.get('user'):
                post['clientUser'] = i['user']['id']
            try:
                r = NET.ajax('kjtb_studypads' if job.get('pads') else 'kjtb_study', post)
            except Exception:
                return False
            STORE.done(n)
            if r.get('success') and isinstance(r.get('data'), dict) and r['data'].get('records') is not None and not job.get('pads'):
                STORE.put_records(r['data']['records'], replace=True)
        return True

    def sync(self, done=None):
        """send what waits, then take the website's copy (it is the one shared by all your devices)"""
        if self.syncing:
            return
        self.syncing = True
        def work():
            i = info(refresh=True)
            if not i.get('user'):
                return 'guest'
            self.flush()
            r = NET.ajax('kjtb_study', {'op': 'list', 'nonce': i['nonce_study'], 'clientUser': i['user']['id']})
            if r.get('success'):
                STORE.put_records(r['data'].get('records') or [], replace=True)
                if r['data'].get('position'):
                    STORE.set_kv('server_position', r['data']['position'])
            p = NET.ajax('kjtb_studypads', {'op': 'get', 'nonce': i['nonce_study']})
            if p.get('success'):
                STORE.put_pads(p['data'].get('pads') or [], replace=True)
            STORE.set_kv('synced', int(time.time()))
            return 'ok'
        def fin(res):
            self.syncing = False; self.changed()
            if done:
                done(res)
        run_bg(work, fin)

    def sign_in(self, login, password, done):
        def work():
            i = info(refresh=True)
            r = NET.ajax('kjtb_app_pw', {'log': login, 'pwd': password, 'nonce': i.get('nonce_pw', '')})
            if not r.get('success'):
                code = (r.get('data') or {}).get('code') if isinstance(r.get('data'), dict) else ''
                return {'ok': False, 'why': 'wrong' if code == 'wrong' else ('limit' if code == 'limit' else 'error')}
            # what was kept here as a guest goes up to your account
            mine = STORE.records()
            i = info(refresh=True)
            for x in mine:
                post = {'op': 'save', 'translation': x['translation'], 'book': x['book'], 'chapter': x['chapter'], 'verse': x['verse'], 'note': x.get('note', '')}
                if x.get('verse_end'):
                    post['verse_end'] = x['verse_end']
                if x.get('color'):
                    post['color'] = x['color']
                STORE.queue({'pads': False, 'post': post})
                if x.get('tags'):
                    STORE.queue({'pads': False, 'post': {'op': 'update_tags', 'id': x['id'], 'tags': ' '.join(x['tags'])}})
            return {'ok': True, 'name': r['data'].get('name')}
        def fin(res):
            if isinstance(res, dict) and res.get('ok'):
                self.sync(lambda _: done(res))
            else:
                done(res if isinstance(res, dict) else {'ok': False, 'why': 'net'})
        run_bg(work, fin)

    def sign_out(self, done):
        def work():
            i = STORE.kv('info') or {}
            try:
                if i.get('nonce_out'):
                    NET.ajax('kjtb_app_out', {'nonce': i['nonce_out']})
            except Exception:
                pass
            NET.signed_out()
            STORE.put_records([], replace=True); STORE.put_pads([], replace=True)
            for n, _ in STORE.outbox():
                STORE.done(n)
            info(refresh=True)
            return True
        run_bg(work, lambda _: (self.changed(), done()))


STUDY = Study()
