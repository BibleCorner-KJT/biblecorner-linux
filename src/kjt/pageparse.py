"""2.16: a very small reader of the website's pages (ids, classes, links, text), for the pages the app makes
from them (You Today, Prayer), as the Android app does."""
import re
from html.parser import HTMLParser
from urllib.parse import urlencode
from .core import STORE, lang

VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


class Node:
    __slots__ = ('tag', 'attrs', 'kids', 'parent')

    def __init__(self, tag, attrs, parent):
        self.tag, self.attrs, self.kids, self.parent = tag, dict(attrs), [], parent

    def cls(self, c):
        return c in (self.attrs.get('class') or '').split()

    def text(self, skip=None):
        out = []
        def walk(n):
            for k in n.kids:
                if isinstance(k, str):
                    out.append(k)
                elif k.tag not in ('script', 'style') and k.tag != skip:
                    walk(k)
        walk(self)
        return re.sub(r'\s+', ' ', ''.join(out)).strip()

    def all(self, pred=lambda n: True):
        for k in self.kids:
            if not isinstance(k, str):
                if pred(k):
                    yield k
                yield from k.all(pred)

    def first(self, pred=lambda n: True):
        return next(self.all(pred), None)

    def children(self, tag=None):
        return [k for k in self.kids if not isinstance(k, str) and (tag is None or k.tag == tag)]


class Tree(HTMLParser):
    def __init__(self, html):
        super().__init__(convert_charrefs=True)
        self.root = Node('#root', {}, None); self.cur = self.root
        self.feed(html); self.close()

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs, self.cur); self.cur.kids.append(n)
        if tag not in VOID:
            self.cur = n

    def handle_startendtag(self, tag, attrs):
        self.cur.kids.append(Node(tag, attrs, self.cur))

    def handle_endtag(self, tag):
        n = self.cur
        while n is not None and n.tag != tag:
            n = n.parent
        if n is not None and n.parent is not None:
            self.cur = n.parent

    def handle_data(self, data):
        self.cur.kids.append(data)



def keep_lines(n, skip=None):
    """the text with its lines kept (as the Android app reads a prayer)"""
    out = []
    def walk(x):
        for k in x.kids:
            if isinstance(k, str):
                out.append(k)
            elif k.tag == 'br':
                out.append('\n')
            elif k.tag not in ('script', 'style') and k.tag != skip:
                walk(k)
    if n is not None:
        walk(n)
    t = re.sub(r'[ \t]+', ' ', ''.join(out))
    t = re.sub(r' *\n *', '\n', t)
    return re.sub(r'\n{3,}', '\n\n', t).strip()


def by_id(root, i):
    return root.first(lambda n: n.attrs.get('id') == i)


def page_url(key, fallback):
    u = ((STORE.kv('info') or {}).get('pages') or {}).get(key) or fallback
    lg = lang()
    return u + (('&' if '?' in u else '?') + urlencode({'lang': lg}) if lg != 'en' else '')
