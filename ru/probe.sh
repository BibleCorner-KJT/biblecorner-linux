#!/bin/bash
UA="Mozilla/5.0 (X11; Linux x86_64) KJT-Bible-Corner/1.0 (+https://knowingjesus.today)"
curl -sL -A "$UA" "https://azbyka.ru/otechnik/6/dobrotoljubie_tom_1/5_1" > c.html
ls -la c.html
grep -o 'class="[^"]*"' c.html | sort | uniq -c | sort -rn | head -40
grep -o 'id="[^"]*"' c.html | sort | uniq -c | sort -rn | head -20
python3 - <<'PY'
s=open('c.html',encoding='utf-8').read()
i=s.find('Антоний'); print(s[max(0,i-3000):i+1500])
j=s.find('<p',s.find('selectable')) ; print('----', s[j:j+1500] if j>0 else 'no selectable')
PY
curl -sL -A "$UA" "https://azbyka.ru/otechnik/6/dobrotoljubie_tom_1/" | grep -o 'href="[^"]*dobrotoljubie_tom_1/[0-9_]*"[^>]*>[^<]*' | head -12
