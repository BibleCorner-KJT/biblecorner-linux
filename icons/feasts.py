"""The icons of the great feasts for Today with God: old icons (public domain) from Wikimedia Commons.
Each feast: Commons searches, best first; the first picture whose licence is public domain is taken (600 px wide).
Out: out/<key>.jpg and out/credits.json (title, painter, date, licence, address of each)."""
import json, os, re, time, urllib.parse, urllib.request
UA = 'KJT-Bible-Corner/1.0 (https://knowingjesus.today; Orthodox Bible app) python-urllib'
API = 'https://commons.wikimedia.org/w/api.php'
A = '15th c., Annunciation Cathedral in Moscow'
Q = {
    'nativity': ['Nativity (%s)' % A, 'Nativity of Christ icon Rublev', 'Nativity of Christ Novgorod icon 15th century'],
    'theophany': ['Baptism (%s)' % A, 'Theophany icon Rublev', 'Baptism of Christ Novgorod icon'],
    'meeting': ['Presentation (%s)' % A, 'Meeting of the Lord (%s)' % A, 'Presentation of Jesus at the Temple Rublev icon'],
    'annunciation': ['Annunciation (%s)' % A, 'Annunciation Ustyug icon', 'Annunciation icon Rublev'],
    'palm': ['Entry into Jerusalem (%s)' % A, 'Entry into Jerusalem Rublev icon'],
    'pascha': ['Descent into Hell (%s)' % A, 'Anastasis icon 15th century', 'Descent into Hell Dionisius icon'],
    'ascension': ['Ascension (%s)' % A, 'Ascension of Christ Rublev icon'],
    'pentecost': ['Pentecost (%s)' % A, 'Descent of the Holy Spirit (%s)' % A, 'Pentecost icon Novgorod 15th century'],
    'transfiguration': ['Transfiguration (%s)' % A, 'Transfiguration icon Theophanes the Greek', 'Transfiguration Rublev icon'],
    'dormition': ['Dormition (%s)' % A, 'Dormition icon Theophanes the Greek', 'Dormition of the Theotokos icon 15th century'],
    'nativity_theotokos': ['Nativity of the Theotokos icon 16th century', 'Nativity of the Mother of God icon Novgorod', 'Nativity of the Virgin icon Russian'],
    'elevation': ['Exaltation of the Cross icon 15th century', 'Elevation of the Holy Cross icon Russian', 'Exaltation of the Holy Cross icon'],
    'entry': ['Entry of the Theotokos into the Temple icon 16th century', 'Presentation of the Virgin icon Russian', 'Introduction of the Theotokos icon'],
}
os.makedirs('out', exist_ok=True)
def api(**p):
    p.update(format='json')
    req = urllib.request.Request(API + '?' + urllib.parse.urlencode(p), headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())
credits = {}
for key, qs in Q.items():
    got = None
    for q in qs:
        r = api(action='query', generator='search', gsrsearch='filetype:bitmap ' + q, gsrnamespace='6', gsrlimit='8', prop='imageinfo', iiprop='url|extmetadata|size', iiurlwidth='600')
        pages = sorted((r.get('query') or {}).get('pages', {}).values(), key=lambda x: x.get('index', 99))
        for p in pages:
            ii = (p.get('imageinfo') or [{}])[0]; em = ii.get('extmetadata') or {}
            lic = (em.get('LicenseShortName') or {}).get('value', '')
            if 'public domain' not in lic.lower() and lic.upper() not in ('PD', 'CC0'):
                continue
            if ii.get('width', 0) < 300 or not ii.get('thumburl'):
                continue
            got = (p['title'], ii, em, lic); break
        print(key, '|', q, '->', got[0] if got else None, flush=True)
        if got:
            break
        time.sleep(1)
    if not got:
        continue
    title, ii, em, lic = got
    req = urllib.request.Request(ii['thumburl'], headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=60) as r, open('out/%s.jpg' % key, 'wb') as f:
        f.write(r.read())
    strip = lambda s: re.sub(r'<[^>]+>', '', s or '').strip()
    credits[key] = {'file': title, 'page': ii.get('descriptionurl'), 'artist': strip((em.get('Artist') or {}).get('value')), 'date': strip((em.get('DateTimeOriginal') or {}).get('value')),
                    'licence': lic, 'about': strip((em.get('ImageDescription') or {}).get('value'))[:300]}
    time.sleep(1)
json.dump(credits, open('out/credits.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps(credits, ensure_ascii=False, indent=1))
