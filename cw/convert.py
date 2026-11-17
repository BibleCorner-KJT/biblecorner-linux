"""Turn the chosen CrossWire Bibles into the website's Bible files (one verse per line: "BOOK C:V text", gzip),
with a list of them (packs/bibles.json): name, language, licence, verse numbering."""
import csv, gzip, io, json, os, re, shutil, sys, urllib.request, zipfile
sys.path.insert(0, os.path.dirname(__file__))
import sword_lib as S
os.makedirs('out/packs', exist_ok=True)
info = {r['name']: r for r in csv.DictReader(open('out/bibles.tsv'), delimiter='\t')}
RTL = {'Syriac', 'Hebrew', 'Arabic'}
SCHEME = {'synodal': 'synodal', 'orthodox': 'synodal', 'lxx': 'lxx', 'vulg': 'lxx'}
out = []
for line in open(os.path.join(os.path.dirname(__file__), 'pick.txt')):
    line = line.strip()
    if not line or line.startswith('#'): continue
    name, language, rec = [x.strip() for x in line.split('|')]
    r = info.get(name)
    if not r or r['locked']:
        print('SKIP (not in the list or locked)', name); continue
    root = '/tmp/cwroot'; shutil.rmtree(root, ignore_errors=True); os.makedirs(root)
    try:
        data = urllib.request.urlopen(urllib.request.Request('https://www.crosswire.org/ftpmirror/pub/sword/packages/rawzip/%s.zip' % name, headers={'User-Agent': 'KJT'}), timeout=300).read()
        zipfile.ZipFile(io.BytesIO(data)).extractall(root)
    except Exception as e:
        print('SKIP (download)', name, e); continue
    confs = [os.path.join(root, 'mods.d', f) for f in os.listdir(os.path.join(root, 'mods.d')) if f.endswith('.conf')]
    c = S.parse_conf(open(confs[0], encoding='utf-8', errors='replace').read())
    S.ROOT = root
    try:
        m = S.VerseModule(c)
    except Exception as e:
        print('SKIP (open)', name, e); continue
    lines, books = [], []
    for osis, _n, nch in m.books():
        code = S.OSIS2CODE.get(osis)
        if not code: continue
        got = 0
        for ch in range(1, nch + 1):
            last = None
            for v, t in m.chapter(osis, ch):
                if not t: continue
                p = S.to_plain(t, m.src)
                p = re.sub(r'\s+', ' ', p).strip()
                if not p or p == last: continue
                last = p
                lines.append('%s %d:%d %s' % (code, ch, v, p)); got += 1
        if got: books.append(code)
    if len(lines) < 200:
        print('SKIP (too little text)', name, len(lines)); continue
    pid = 'cw' + re.sub(r'[^A-Za-z0-9]', '', name)
    with gzip.open('out/packs/%s.txt.gz' % pid, 'wt', encoding='utf-8', compresslevel=9) as f:
        f.write('\n'.join(lines) + '\n')
    v = (c.get('Versification') or 'KJV').lower()
    desc = re.sub(r'\s+', ' ', c.get('Description') or name).strip()
    out.append({'id': pid, 'sword': name, 'language': language, 'title': desc, 'dir': 'rtl' if language in RTL else 'ltr',
                'licence': (c.get('DistributionLicense') or '').strip() + ' · from CrossWire Bible Society', 'scheme': SCHEME.get(v, ''),
                'v11n': c.get('Versification') or 'KJV', 'verses': len(lines), 'books': books, 'rec': rec == '1',
                'size': os.path.getsize('out/packs/%s.txt.gz' % pid)})
    print('OK', pid, len(lines), 'verses', len(books), 'books', v)
json.dump(out, open('out/packs/bibles.json', 'w'), ensure_ascii=False, indent=0)
print('total', len(out))
