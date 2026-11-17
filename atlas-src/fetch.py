"""Fetch public-domain atlas plates from Wikimedia Commons: atlas/<slug>.jpg (max 4800 px), thumbs, atlas.json."""
import json, os, re, sys, time, urllib.parse, urllib.request
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
API = 'https://commons.wikimedia.org/w/api.php'
UA = {'User-Agent': 'KJT-Bible-Maps/1.0 (https://knowingjesus.today; atlas of public-domain maps)'}
def api(**p):
    p.update(format='json', formatversion=2)
    r = urllib.request.Request(API + '?' + urllib.parse.urlencode(p), headers=UA)
    return json.load(urllib.request.urlopen(r, timeout=60))
def info(titles):
    out = []
    for i in range(0, len(titles), 40):
        d = api(action='query', prop='imageinfo', iiprop='url|size|extmetadata|mime', titles='|'.join(titles[i:i+40]))
        out += d['query'].get('pages', [])
    return out
def strip(h): return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', h or '')).strip()
os.makedirs('out/atlas/thumbs', exist_ok=True)
# 1. candidates found by searching (metadata only, for choosing)
cands = []
for q in open('atlas-src/search.txt').read().split('\n'):
    if not q.strip(): continue
    d = api(action='query', list='search', srsearch=q + ' filetype:bitmap', srnamespace=6, srlimit=25)
    cands += [x['title'] for x in d['query']['search']]
cands = list(dict.fromkeys(cands))
cl = []
for p in info(cands):
    ii = (p.get('imageinfo') or [{}])[0]; m = ii.get('extmetadata', {})
    cl.append({'t': p['title'], 'w': ii.get('width'), 'h': ii.get('height'), 'lic': strip(m.get('LicenseShortName', {}).get('value')),
               'date': strip(m.get('DateTimeOriginal', {}).get('value'))[:60], 'by': strip(m.get('Artist', {}).get('value'))[:80],
               'desc': strip(m.get('ImageDescription', {}).get('value'))[:160], 'thumb': ii.get('url')})
json.dump(cl, open('out/atlas/candidates.json', 'w'), indent=1, ensure_ascii=False)
# 2. the chosen plates: downloaded, made smaller, with their credits
picks = ['File:' + x.strip() for x in open('atlas-src/pick.txt').read().split('\n') if x.strip()]
extra = [x.strip() for x in open('atlas-src/pick2.txt').read().split('\n') if x.strip()] if os.path.exists('atlas-src/pick2.txt') else []
picks += ['File:' + x if not x.startswith('File:') else x for x in extra]
cat = []
for p in info(picks):
    if p.get('missing') or not p.get('imageinfo'):
        print('MISSING', p['title']); continue
    ii = p['imageinfo'][0]; m = ii.get('extmetadata', {})
    lic = strip(m.get('LicenseShortName', {}).get('value'))
    if not re.search(r'public domain|pd|cc0', lic, re.I):
        print('NOT PD', p['title'], lic); continue
    slug = re.sub(r'[^a-z0-9]+', '-', p['title'][5:].rsplit('.', 1)[0].lower()).strip('-')[:70]
    src = 'out/tmp'; 
    for k in range(4):
        try:
            urllib.request.urlretrieve if False else None
            with urllib.request.urlopen(urllib.request.Request(ii['url'], headers=UA), timeout=300) as r, open(src, 'wb') as f: f.write(r.read())
            break
        except Exception as e:
            print('retry', p['title'], e); time.sleep(10)
    im = Image.open(src); im = im.convert('RGB')
    w, h = im.size; s = min(1, 4800 / max(w, h)); im2 = im.resize((int(w*s), int(h*s)), Image.LANCZOS) if s < 1 else im
    im2.save('out/atlas/%s.jpg' % slug, quality=84, optimize=True, progressive=True)
    t = im.copy(); t.thumbnail((640, 640)); t.save('out/atlas/thumbs/%s.jpg' % slug, quality=80)
    cat.append({'id': slug, 'file': p['title'], 'w': im2.size[0], 'h': im2.size[1], 'lic': lic,
                'by': strip(m.get('Artist', {}).get('value'))[:160], 'date': strip(m.get('DateTimeOriginal', {}).get('value'))[:80],
                'desc': strip(m.get('ImageDescription', {}).get('value'))[:400],
                'src': 'https://commons.wikimedia.org/wiki/' + urllib.parse.quote(p['title'].replace(' ', '_'))})
    print('OK', slug, im2.size); time.sleep(1)
os.remove('out/tmp') if os.path.exists('out/tmp') else None
json.dump(cat, open('out/atlas/atlas.json', 'w'), indent=1, ensure_ascii=False)
