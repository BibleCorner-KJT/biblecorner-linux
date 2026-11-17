"""List CrossWire's (and AndBible's) Bibles with their licences, to choose which can go on the website."""
import io, re, tarfile, urllib.request, csv, sys
SRC = {'CrossWire': 'https://www.crosswire.org/ftpmirror/pub/sword/raw/mods.d.tar.gz'}
rows = []
for src, url in SRC.items():
    data = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'KJT'}), timeout=120).read()
    t = tarfile.open(fileobj=io.BytesIO(data))
    for m in t.getmembers():
        if not m.name.endswith('.conf'): continue
        s = t.extractfile(m).read().decode('utf-8', 'replace')
        g = lambda k: (re.search(r'^' + k + r'\s*=\s*(.*)$', s, re.M) or [None, ''])[1].strip()
        name = (re.search(r'^\[(.+?)\]', s, re.M) or [None, ''])[1]
        if 'text' not in g('ModDrv').lower(): continue
        rows.append([src, name, g('Lang'), g('Description'), g('DistributionLicense'), g('Versification') or 'KJV', 'locked' if re.search(r'^CipherKey', s, re.M) else '', g('Feature'), g('InstallSize'), g('Version')])
rows.sort(key=lambda r: (r[2], r[1]))
w = csv.writer(open('out/bibles.tsv', 'w'), delimiter='\t'); w.writerow(['src', 'name', 'lang', 'description', 'licence', 'v11n', 'locked', 'feature', 'size', 'version']); w.writerows(rows)
print(len(rows))
