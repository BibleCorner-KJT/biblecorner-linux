#!/bin/bash
# The KJT SimpleX bot, run by GitHub each morning (the website's host cannot run SimpleX Chat: no OpenSSL 3).
# It reads today's posts from the website (the same as the Telegram posts) and sends them to every SimpleX
# group it is a member of. Its keys live in the GitHub Actions cache of this repository (never in the repository).
#   MODE=setup  join the group (by its link) and list the groups;   MODE=post  send today's posts once
set -u
BIN="$HOME/sxbin/simplex-chat"; DATA="$HOME/sxdata"; mkdir -p "$DATA/files"
SITE="${SITE:-https://knowingjesus.today}"
LINK="${GROUP_LINK:-https://smp17.simplex.im/g#AiHuYaIlklw4qpYJXYIUbpX4_foaHUezMaHI4vNyAlw}"
run() {
  local extra=()
  [ -f "$DATA/kjt_chat.db" ] || extra=(--create-bot-display-name "KJT Bible Corner" --create-bot-allow-files)
  "$BIN" -d "$DATA/kjt" -y --files-folder "$DATA/files" "${extra[@]}" "$@" 2>&1
}
if [ ! -f "$DATA/joined" ]; then
  echo "== joining the group"; run -e "/c $LINK" -t 60 | tail -20; touch "$DATA/joined"
fi
echo "== the bot's groups"; run -e "/groups" -t 25 | tee "$DATA/groups.txt" | tail -20
mapfile -t GROUPS < <(grep -oE "^#[^ ]+|^#'[^']+'" "$DATA/groups.txt" | sort -u)
echo "groups: ${GROUPS[*]:-none}"
[ "${MODE:-post}" = "post" ] || exit 0
TODAY=$(TZ=America/New_York date +%F)
if [ "$(cat "$DATA/last_post" 2>/dev/null)" = "$TODAY" ]; then echo "already posted today"; exit 0; fi
[ ${#GROUPS[@]} -gt 0 ] || { echo "no group yet: approve 'KJT Bible Corner' in the SimpleX group"; exit 0; }
LANG_="${POST_LANG:-en}"
curl -fsS -m 60 "$SITE/wp-admin/admin-ajax.php?action=kjtb_dpost_feed&lang=$LANG_" -o feed.json || { echo "the website did not answer"; exit 1; }
n=$(jq '.data.posts | length' feed.json); echo "posts today: $n"
sent=0
for ((i=0; i<n; i++)); do
  msg=$(jq -c ".data.posts[$i].text" feed.json)   # quoted, with its line breaks kept as \n
  for g in "${GROUPS[@]}"; do
    out=$(run -e "$g $msg" -t 20); echo "$out" | tail -3
    echo "$out" | grep -qiE "error|not found|cannot" || sent=$((sent+1))
  done
done
echo "sent: $sent"
[ $sent -gt 0 ] && echo "$TODAY" > "$DATA/last_post"
exit 0
