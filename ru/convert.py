"""The Russian books for the Holy Fathers' library (run by GitHub: ru.yml).

 - Добротолюбие (the Philokalia in the Russian translation of St Theophan the Recluse, 2nd ed., Moscow 1895-1901,
   public domain), from the pages of the Orthodox portal «Азбука веры» (azbyka.ru/otechnik), one author per volume.
 - Жития святых по изложению свт. Димитрия Ростовского (the Russian edition of 1902-1911, public domain; reprint
   Kiev 2004), from Russian Wikisource, one author per month of the Church year (September first), a work per day.

Output: out/library/<id>.json.gz in the format of the website's data/library (a work: {t, p: [{t, h}]}) and
out/library/ru-index.json (their entries for data/library/index.json, with "lang": "ru").
"""
import gzip, json, os, re, sys, time, urllib.parse, urllib.request
from bs4 import BeautifulSoup

UA = 'Mozilla/5.0 (X11; Linux x86_64) KJT-Bible-Corner/1.0 (+https://knowingjesus.today; Orthodox Bible app)'
OUT = 'out/library'
os.makedirs(OUT, exist_ok=True)
KEEP = {'p', 'h2', 'h3', 'h4', 'b', 'strong', 'i', 'em', 'sup', 'sub', 'br', 'blockquote', 'ol', 'ul', 'li', 'hr', 'small'}


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode('utf-8', 'replace')
        except Exception as e:
            print('  retry', url[:90], e, flush=True); time.sleep(5 * (i + 1))
    return ''


def clean(node):
    """only plain reading tags, no attributes; links become their words"""
    for t in node.find_all(['script', 'style', 'noscript', 'img', 'figure', 'button', 'form', 'svg', 'audio', 'video']):
        t.decompose()
    for t in node.find_all(True):
        if t.name in ('h1',):
            t.name = 'h2'
        if t.name == 'h5' or t.name == 'h6':
            t.name = 'h4'
        if t.name not in KEEP:
            t.unwrap(); continue
        t.attrs = {}
    h = str(node)
    h = re.sub(r'^<div>|</div>$', '', h)
    h = re.sub(r'<p>\s*</p>', '', h)
    h = re.sub(r'\n{3,}', '\n\n', h)
    return h.strip()


def slug(s):
    return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def write(aid, works):
    raw = json.dumps(works, ensure_ascii=False, separators=(',', ':')).encode()
    with gzip.open(os.path.join(OUT, aid + '.json.gz'), 'wb', 9) as f:
        f.write(raw)
    kb = os.path.getsize(os.path.join(OUT, aid + '.json.gz')) // 1024
    return [{'id': k, 't': v['t'], 'n': len(v['p']), 'kb': len(json.dumps(v, ensure_ascii=False).encode()) // 1024} for k, v in works.items()], kb


INDEX = []

# ---------------------------------------------------------------- the Philokalia
ROMAN = ['I', 'II', 'III', 'IV', 'V']
def philokalia():
    for v in range(1, 6):
        base = 'https://azbyka.ru/otechnik/6/dobrotoljubie_tom_%d/' % v
        toc = get(base)
        nums = []
        for m in re.finditer(r'dobrotoljubie_tom_%d/(\d+)(?:_\d+)?["#]' % v, toc):
            n = int(m.group(1))
            if n not in nums:
                nums.append(n)
        print('tom', v, len(nums), 'pages', flush=True)
        works = {}
        for n in nums:
            html = get(base + str(n)); time.sleep(1.2)
            if not html:
                continue
            s = BeautifulSoup(html, 'html.parser')
            box = s.find(id='selectable-content')
            if not box:
                print('  no text', n); continue
            for x in box.select('.bg_data_tooltip, .noprint, .book-nav, .nav-part-left, .nav-part-right, .related-item'):
                x.decompose()
            tt = s.find('title').get_text(' ', strip=True) if s.find('title') else ''
            title = re.sub(r',\s*Добротолюбие.*$', '', tt).strip() or ('Глава %d' % n)
            h = clean(box)
            if len(re.sub(r'<[^>]+>', '', h)) < 40:
                continue
            works['%02d' % n] = {'t': title, 'p': [{'t': title, 'h': h}]}
        aid = 'ru-dobrotolyubie-%d' % v
        meta, kb = write(aid, works)
        INDEX.append({'id': aid, 'name': 'Добротолюбие. Том %s' % ROMAN[v - 1], 'when': 'пер. свт. Феофана Затворника, 1895–1901', 'lang': 'ru',
                      'source': 'Добротолюбие в русском переводе, дополненное. Изд. 2-е. М., 1895–1901 (текст: «Азбука веры», azbyka.ru)',
                      'works': meta, 'kb': kb})
        print('  ->', aid, len(works), 'works', kb, 'KB gz', flush=True)


# ---------------------------------------------------------------- the Lives of the Saints
API = 'https://ru.wikisource.org/w/api.php'
LIVES = 'Жития святых по изложению свт. Димитрия Ростовского/'
MONTHS = [('Сентябрь', 'сентября', 9), ('Октябрь', 'октября', 10), ('Ноябрь', 'ноября', 11), ('Декабрь', 'декабря', 12), ('Январь', 'января', 1),
          ('Февраль', 'февраля', 2), ('Март', 'марта', 3), ('Апрель', 'апреля', 4), ('Май', 'мая', 5), ('Июнь', 'июня', 6), ('Июль', 'июля', 7), ('Август', 'августа', 8)]


def api(**p):
    p.update(format='json', maxlag='5')
    t = get(API + '?' + urllib.parse.urlencode(p))
    try:
        return json.loads(t)
    except Exception:
        return {}


def lives():
    titles = []; cont = {}
    while True:
        r = api(action='query', list='allpages', apprefix=LIVES, aplimit='500', **cont)
        titles += [x['title'] for x in r.get('query', {}).get('allpages', [])]
        if 'continue' not in r:
            break
        cont = {'apcontinue': r['continue']['apcontinue']}
    print('lives pages', len(titles), flush=True)
    for mi, (mon, gen, mno) in enumerate(MONTHS):
        days = sorted({int(t.rsplit('/', 1)[1]) for t in titles if re.fullmatch(re.escape(LIVES + mon) + r'/\d+', t)})
        works = {}
        for d in days:
            r = api(action='parse', page=LIVES + mon + '/' + str(d), prop='text', disableeditsection='1', disabletoc='1'); time.sleep(0.8)
            html = (r.get('parse') or {}).get('text', {}).get('*', '')
            if not html:
                print('  no page', mon, d); continue
            s = BeautifulSoup(html, 'html.parser')
            for x in s.select('.tocline, .ws-noexport, .noprint, .mw-editsection, table.headertemplate, #headertemplate, .header_notes, .lives-head, style, .reference-text-tooltip'):
                x.decompose()
            for x in s.find_all(string=re.compile(r'^\s*(←|Источник:)')):
                p = x.find_parent(['p', 'div', 'td', 'tr'])
                if p is not None:
                    p.decompose()
            root = s.find(class_='mw-parser-output') or s
            names = [h.get_text(' ', strip=True) for h in root.find_all(['h2', 'h3'])][:6]
            h = clean(root)
            if len(re.sub(r'<[^>]+>', '', h)) < 80:
                continue
            title = '%d %s' % (d, gen)
            works['%02d-%02d' % (mno, d)] = {'t': title + (': ' + '; '.join(names) if names else ''), 'p': [{'t': title, 'h': h}]}
        aid = 'ru-zhitiya-%02d' % (mi + 1)
        meta, kb = write(aid, works)
        INDEX.append({'id': aid, 'name': 'Жития святых: %s' % mon.lower(), 'when': 'по изложению свт. Димитрия Ростовского', 'lang': 'ru',
                      'source': 'Жития святых на русском языке, изложенные по руководству Четьих-Миней св. Димитрия Ростовского (репринт: Киев, 2004). Текст: Русская Викитека (общественное достояние)',
                      'works': meta, 'kb': kb})
        print('  ->', aid, len(works), 'days', kb, 'KB gz', flush=True)


if __name__ == '__main__':
    what = sys.argv[1:] or ['philokalia', 'lives']
    if 'philokalia' in what:
        philokalia()
    if 'lives' in what:
        lives()
    with open(os.path.join(OUT, 'ru-index.json'), 'w') as f:
        json.dump(INDEX, f, ensure_ascii=False, indent=0)
    print('done', sum(x['kb'] for x in INDEX), 'KB gz in all')
