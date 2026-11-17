"""The icons of the great feasts for Today with God: old icons (public domain) from Wikimedia Commons.
Each feast: Commons searches, best first; the first picture whose licence is public domain is taken (600 px wide).
Out: out/<key>.jpg and out/credits.json (title, painter, date, licence, address of each)."""
import json, os, re, time, urllib.parse, urllib.request
UA = 'KJT-Bible-Corner/1.0 (https://knowingjesus.today; Orthodox Bible app) python-urllib'
API = 'https://commons.wikimedia.org/w/api.php'
A = '15th c., Annunciation Cathedral in Moscow'
AC = 'Annunciation Cathedral in Moscow'
# exact files first (the festal row of the Annunciation Cathedral, 1405, and the Vasilyevsky row, 1408), then a search whose
# result must have one of the words in its name
Q = {
    'nativity': [['File:Nativity (15th c., %s).jpg' % AC], 'Nativity icon Russia 15th', ['nativity']],
    'theophany': [['File:Baptism (15th c., %s).jpg' % AC, 'File:Baptism (%s).jpg' % AC], 'Baptism of Christ icon Russia 15th', ['baptism', 'theophany', 'kreshchenie']],
    'meeting': [['File:Sretenie (%s).jpg' % AC], 'Sretenie icon', ['sretenie', 'presentation', 'meeting']],
    'annunciation': [['File:Annunciation (%s).jpg' % AC, 'File:Annunciation from Vasilyevskiy chin (1408, Tretyakov gallery).jpg'], 'Annunciation icon Russia 15th', ['annunciation', 'blagoveshchenie']],
    'palm': [['File:Entry into Jerusalem (%s).jpg' % AC], 'Entry into Jerusalem icon Russia', ['jerusalem']],
    'pascha': [['File:Descent into Hell (%s).jpg' % AC, 'File:Resurrection (%s).jpg' % AC, 'File:Descent into Hell (%s) by shakko.jpg' % AC], 'Descent into Hell icon Russia 15th century', ['descent into hell', 'anastasis', 'resurrection', 'harrowing']],
    'ascension': [['File:Ascension (%s).jpg' % AC, 'File:Ascension from Vasilyevskiy chin (15th c., GTG).jpg'], 'Ascension icon Russia 15th', ['ascension']],
    'pentecost': [['File:Pentecost (%s).jpg' % AC, 'File:Descent of the Holy Spirit (%s).jpg' % AC, 'File:Pentecost (15th c., %s).jpg' % AC], 'Descent of the Holy Spirit icon Russia', ['pentecost', 'holy spirit', 'troitsa', 'soshestvie']],
    'transfiguration': [['File:Transfiguration (%s).jpg' % AC, 'File:Transfiguration (15th c., %s).jpg' % AC, 'File:Transfiguration by Feofan Grek from Spaso-Preobrazhensky Cathedral in Pereslavl-Zalessky (15th c, Tretyakov gallery).jpeg'], 'Transfiguration icon Russia 15th', ['transfiguration', 'preobrazhenie']],
    'dormition': [['File:Dormition (%s).jpg' % AC, 'File:Dormition (15th c., %s).jpg' % AC, 'File:Theofanus uspenie.jpg'], 'Dormition icon Russia 15th', ['dormition', 'uspenie']],
    'nativity_theotokos': [['File:0648Ha. Hermitage Museum. Icon Nativity of the Virgin.jpg'], 'Nativity of the Virgin icon Russia', ['nativity of the virgin', 'nativity of the theotokos', 'nativity of mary', 'rozhdestvo bogoroditsy']],
    'elevation': [['File:Unknown painter - Exaltation of the Cross - WGA23497.jpg'], 'Exaltation of the Cross icon', ['exaltation', 'elevation', 'vozdvizhenie']],
    'entry': [[], ['Entry of the Theotokos into the Temple icon', 'Presentation of the Virgin in the Temple icon Russia', 'Vvedenie icon', 'Presentation of Mary icon', 'Entrance of the Theotokos icon', 'Введение во храм икона'], ['entry of the theotokos', 'presentation of the virgin', 'presentation of mary', 'vvedenie', 'entrance of the theotokos', 'introduction', 'введение', 'entry of the virgin', 'entry of the mother of god', 'presentation of the blessed virgin']],
}
os.makedirs('out', exist_ok=True)
def api(**p):
    p.update(format='json')
    req = urllib.request.Request(API + '?' + urllib.parse.urlencode(p), headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())
credits = {}
def good(p):
    ii = (p.get('imageinfo') or [{}])[0]; em = ii.get('extmetadata') or {}
    lic = (em.get('LicenseShortName') or {}).get('value', '')
    if 'public domain' not in lic.lower() and lic.upper() not in ('PD', 'CC0'):
        return None
    if ii.get('width', 0) < 300 or not ii.get('thumburl'):
        return None
    return (p['title'], ii, em, lic)
for key, (files, q, words) in Q.items():
    got = None
    for f in files:
        r = api(action='query', titles=f, prop='imageinfo', iiprop='url|extmetadata|size', iiurlwidth='600')
        for p in (r.get('query') or {}).get('pages', {}).values():
            if 'missing' not in p:
                got = good(p)
        print(key, '|', f, '->', bool(got), flush=True)
        if got:
            break
    for qq in ([q] if isinstance(q, str) else q):
      if got:
        break
      r = api(action='query', generator='search', gsrsearch='filetype:bitmap ' + qq, gsrnamespace='6', gsrlimit='40', prop='imageinfo', iiprop='url|extmetadata|size', iiurlwidth='600')
      if True:
        for p in sorted((r.get('query') or {}).get('pages', {}).values(), key=lambda x: x.get('index', 99)):
            t = p['title'].lower()
            if any(w in t for w in words) and not any(b in t for b in ('hall', 'interior', 'museum of russian icons', 'riza', 'detail', 'fragment')):
                got = good(p)
                if got:
                    break
        print(key, '| search', qq, '->', got[0] if got else None, flush=True)
    if not got:
        continue
    title, ii, em, lic = got
    req = urllib.request.Request(ii['thumburl'], headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r, open('out/%s.jpg' % key, 'wb') as fo:
        fo.write(r.read())
    strip = lambda s: re.sub(r'<[^>]+>', '', s or '').strip()
    credits[key] = {'file': title, 'page': ii.get('descriptionurl'), 'artist': re.sub(r'Public domain image.*$', '', strip((em.get('Artist') or {}).get('value'))).strip(),
                    'date': re.sub(r'date QS:.*$', '', strip((em.get('DateTimeOriginal') or {}).get('value'))).strip(), 'licence': lic}
    time.sleep(1)
json.dump(credits, open('out/credits.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(credits, ensure_ascii=False, indent=1))
