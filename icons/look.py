import json, urllib.parse, urllib.request
UA = 'KJT-Bible-Corner/1.0 (https://knowingjesus.today) python-urllib'
def api(**p):
    p.update(format='json'); req = urllib.request.Request('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(p), headers={'User-Agent': UA})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())
for f in ['File:Nativity (15th c., Annunciation Cathedral in Moscow).jpg', 'File:Theofanus uspenie.jpg', 'File:Ascension from Vasilyevskiy chin (15th c., GTG).jpg']:
    r = api(action='query', titles=f, prop='categories', cllimit='50')
    for p in r['query']['pages'].values():
        print(f, [c['title'] for c in p.get('categories', [])])
cats = ['Category:Festal tier of the Annunciation Cathedral in Moscow', 'Category:Iconostasis of the Annunciation Cathedral in Moscow', 'Category:Icons in the Annunciation Cathedral in Moscow',
        'Category:Vasilyevsky chin', 'Category:Icons of the Nativity of the Theotokos', 'Category:Icons of the Presentation of Mary', 'Category:Icons of the Exaltation of the Cross',
        'Category:Icons of the Pentecost', 'Category:Icons of the Anastasis', 'Category:Icons of the Annunciation', 'Category:Novgorod icons', 'Category:Andrei Rublev']
for c in cats:
    r = api(action='query', list='categorymembers', cmtitle=c, cmlimit='200', cmtype='file|subcat')
    m = [x['title'] for x in r.get('query', {}).get('categorymembers', [])]
    print('\n==', c, len(m)); print('\n'.join(m[:200]))
