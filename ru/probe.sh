#!/bin/bash
# a look at the sources before converting (prints only)
UA="Mozilla/5.0 (X11; Linux x86_64) KJT-Bible-Corner/1.0 (+https://knowingjesus.today)"
API="https://ru.wikisource.org/w/api.php"
P="Жития святых по изложению свт. Димитрия Ростовского/"
echo "== wikisource pages"
curl -sG -A "$UA" "$API" --data-urlencode "action=query" --data-urlencode "list=allpages" --data-urlencode "apprefix=$P" --data-urlencode "aplimit=500" --data-urlencode "format=json" > ap.json
jq '.query.allpages | length' ap.json; jq -r '.query.allpages[:15][].title' ap.json; jq -r '.continue // empty' ap.json
T=$(jq -r '.query.allpages[20].title' ap.json)
curl -sG -A "$UA" "$API" --data-urlencode "action=parse" --data-urlencode "page=$T" --data-urlencode "prop=text" --data-urlencode "format=json" | jq -r '.parse.text["*"]' | sed 's/<[^>]*>//g' | head -c 1500
echo; echo "== azbyka"
for v in 1 2 3 4 5; do
  h=$(curl -sL -A "$UA" "https://azbyka.ru/otechnik/6/dobrotoljubie_tom_$v/" | grep -o 'books/download/[0-9]*/[^"]*\.epub' | head -1)
  echo "tom $v: $h"
  [ -n "$h" ] && curl -sL -A "$UA" -o t$v.epub "https://azbyka.ru/otechnik/$h" && ls -la t$v.epub && unzip -l t$v.epub | tail -3
done
