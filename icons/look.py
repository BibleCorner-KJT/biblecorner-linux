import json, urllib.parse, urllib.request
UA = 'KJT-Bible-Corner/1.0 (https://knowingjesus.today) python-urllib'
def api(**p):
    p.update(format='json'); req = urllib.request.Request('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(p), headers={'User-Agent': UA})
    return json.loads(urllib.request.urlopen(req, timeout=60).read())
def members(c, n=40):
    r = api(action='query', list='categorymembers', cmtitle=c, cmlimit=str(n), cmtype='file')
    return [x['title'] for x in r.get('query', {}).get('categorymembers', [])]
print('== main', members('Category:Main iconostasis of Annunciation Cathedral in Moscow', 100))
print('== vas', members('Category:Vasilyevskiy chin (GTG)', 50))
for q in ['Icons of Nativity of Virgin Mary in Russia', 'Icons of Presentation of Virgin Mary in Russia', 'Icons of Exaltation of the Cross Russia', 'Icons of Pentecost in Russia',
          'Icons of Anastasis in Russia', 'Icons of Annunciation in Russia', 'Icons of Transfiguration in Russia', 'Icons of Presentation of Jesus in Russia']:
    r = api(action='query', list='search', srsearch=q, srnamespace='14', srlimit='4')
    for x in r.get('query', {}).get('search', []):
        print('\n==', q, '->', x['title']); print('\n'.join(members(x['title'], 30)))
