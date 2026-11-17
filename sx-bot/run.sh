#!/bin/bash
# The KJT SimpleX bot, run by GitHub each hour (the website's host cannot run SimpleX Chat: no OpenSSL 3).
# Each visit it:
#   1. tells the website which SimpleX groups it is in, and what it sent last time;
#   2. gets back the group links to join (pasted on the website: Tools › App notifications › SimpleX)
#      and the posts waiting for it (the website decides what and when, as for Telegram);
#   3. joins the new groups, sends the posts (the picture, then the words), and says so to the website.
# Its keys (SimpleX's, and its own key for the website) live in the GitHub Actions cache, never in the repository.
set -u
BIN="$HOME/sxbin/simplex-chat"; DATA="$HOME/sxdata"; mkdir -p "$DATA/files"
SITE="${SITE:-https://knowingjesus.today}"
API="$SITE/wp-admin/admin-ajax.php?action=kjtb_sx_bot"
[ -s "$DATA/sitekey" ] || openssl rand -hex 24 > "$DATA/sitekey"
KEY=$(cat "$DATA/sitekey")
touch "$DATA/joined_links" "$DATA/sent_ids"
# the first link (given before the website had a place for it) counts as asked already
[ -f "$DATA/joined" ] && ! grep -q "smp17.simplex.im/g#AiHuYaIl" "$DATA/joined_links" && echo "https://smp17.simplex.im/g#AiHuYaIlklw4qpYJXYIUbpX4_foaHUezMaHI4vNyAlw" >> "$DATA/joined_links"
LOG="$DATA/log.txt"; : > "$LOG"
run() {
  local extra=()
  [ -f "$DATA/kjt_chat.db" ] || extra=(--create-bot-display-name "KJT Bible Corner" --create-bot-allow-files)
  "$BIN" -d "$DATA/kjt" -y --files-folder "$DATA/files" "${extra[@]}" "$@" 2>&1
}
say() { echo "$*" | tee -a "$LOG"; }

groups() {
  run -e "/groups" -t 30 > "$DATA/groups.txt"; tail -15 "$DATA/groups.txt"
  mapfile -t GRPS < <(grep -oE "^#'[^']+'|^#[^ ]+" "$DATA/groups.txt" | sort -u)
}
call() {   # tell the website, and get what to do
  local gj sj jj
  gj=$(printf '%s\n' "${GRPS[@]}" | jq -R . | jq -sc 'map(select(length>0))')
  sj=$(jq -R . < "$DATA/sent_ids" | jq -sc 'map(select(length>0))')
  jj=$(jq -R . < "$DATA/joined_links" | jq -sc 'map(select(length>0))')
  curl -fsS -m 90 -X POST "$API" --data-urlencode "key=$KEY" --data-urlencode "groups=$gj" \
       --data-urlencode "sent=$sj" --data-urlencode "joined=$jj" --data-urlencode "log=$(tail -c 2500 "$LOG")" -o reply.json
}

echo "== the bot's groups"; GRPS=(); groups
say "groups: ${GRPS[*]:-none (if you asked it to join: approve 'KJT Bible Corner' in the group)}"
call || { echo "the website did not answer"; exit 0; }
jq -e '.success' reply.json >/dev/null || { echo "the website said no:"; head -c 300 reply.json; exit 0; }
: > "$DATA/sent_ids"   # the website has these now

# new groups to join
newj=0
while read -r link; do
  [ -z "$link" ] && continue
  grep -qxF "$link" "$DATA/joined_links" && continue
  say "joining: ${link:0:40}…"; run -e "/c $link" -t 60 | tail -5 | tee -a "$LOG"
  echo "$link" >> "$DATA/joined_links"; newj=1
done < <(jq -r '.data.links[]?' reply.json)
[ $newj = 1 ] && { run -e "/groups" -t 40 >/dev/null; groups; }

# the posts waiting
n=$(jq '.data.queue | length' reply.json); say "posts waiting: $n"
for ((i=0; i<n; i++)); do
  id=$(jq -r ".data.queue[$i].id" reply.json); g=$(jq -r ".data.queue[$i].g" reply.json)
  if ! printf '%s\n' "${GRPS[@]}" | grep -qxF "$g"; then say "not in $g (yet): kept for later"; continue; fi
  ok=1
  if [ "$(jq -r ".data.queue[$i].img" reply.json)" != "" ]; then
    f="$DATA/files/post-$id.jpg"; jq -r ".data.queue[$i].img" reply.json | base64 -d > "$f"
    out=$(run -e "/img $g $f" -t 45); echo "$out" | tail -3
    echo "$out" | grep -qiE "error|not found|cannot|bad chat" && ok=0
  fi
  msg=$(jq -c ".data.queue[$i].text" reply.json)
  if [ $ok = 1 ] && [ "$msg" != '""' ]; then
    out=$(run -e "$g $msg" -t 20); echo "$out" | tail -3
    echo "$out" | grep -qiE "error|not found|cannot|bad chat" && ok=0
  fi
  if [ $ok = 1 ]; then echo "$id" >> "$DATA/sent_ids"; say "sent to $g"; else say "could not send to $g: $(echo "$out" | tail -1)"; fi
done
rm -f "$DATA"/files/post-*.jpg
# say what was sent (so it is not sent again)
if [ -s "$DATA/sent_ids" ] || [ $newj = 1 ]; then call && : > "$DATA/sent_ids"; fi
exit 0
