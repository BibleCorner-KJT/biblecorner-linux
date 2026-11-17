#!/bin/bash
# Knowing Jesus Today for Linux: install it from its channel, so that GNOME Software keeps it up to date.
# Run it from this folder:   bash build.sh
#   (bash build.sh --local  builds it from these files instead, without the channel: only for testing)
# Your bookmarks, notes and downloads (in ~/.var/app/today.knowingjesus.KJT) are never touched.
set -e
cd "$(dirname "$0")"
APP=today.knowingjesus.KJT
CHAN=https://biblecorner-kjt.github.io/biblecorner-linux
echo "1/3  Flathub (where the GNOME parts come from)"
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo

if [ "${1:-}" = "--local" ]; then
  V=""
  for v in 52 51 50 49 48; do
    if flatpak remote-info --user flathub "runtime/org.gnome.Platform/$(uname -m)/$v" >/dev/null 2>&1; then V=$v; break; fi
  done
  [ -z "$V" ] && { echo "Could not reach Flathub. Check the internet and try again."; exit 1; }
  sed -i "s/^runtime-version: .*/runtime-version: '$V'/" $APP.yml
  flatpak install --user -y --noninteractive flathub org.gnome.Platform//$V org.gnome.Sdk//$V org.flatpak.Builder
  flatpak run org.flatpak.Builder --user --install --force-clean --repo=repo build $APP.yml
  echo "Built and installed from these files (GNOME Software will not update this copy: run bash build.sh to go back to the channel)."
  exit 0
fi

echo "2/3  The Knowing Jesus Today channel (GNOME Software looks there for updates)"
REMOTE=$(flatpak remotes --user --columns=name,url 2>/dev/null | awk -v u="$CHAN/repo/" '$2==u || $2==substr(u,1,length(u)-1) {print $1; exit}')
if [ -z "$REMOTE" ]; then
  REMOTE=knowing-jesus-today
  flatpak remote-add --user --if-not-exists --from $REMOTE "$CHAN/knowing-jesus-today.flatpakrepo"
fi
flatpak update --user --appstream $REMOTE >/dev/null 2>&1 || true

echo "3/3  Installing the newest version"
if flatpak list --user --app --columns=application,branch,origin | awk -v a=$APP -v r=$REMOTE '$1==a && $2=="stable" && $3!=r' | grep -q .; then
  flatpak uninstall --user -y --noninteractive $APP//stable   # the same branch from somewhere else (your data stays)
fi
if flatpak list --user --app --columns=application,branch,origin | awk -v a=$APP -v r=$REMOTE '$1==a && $2=="stable" && $3==r' | grep -q .; then
  flatpak update --user -y --noninteractive $APP//stable
else
  flatpak install --user -y --noninteractive $REMOTE $APP//stable
fi
flatpak make-current --user $APP stable >/dev/null 2>&1 || true
# a copy built on this computer (by the old build.sh) is not followed by GNOME Software: now that the channel's copy is
# installed, the old one goes away. (Only the program; your bookmarks, notes and downloads stay.)
flatpak list --user --app --columns=application,branch,origin 2>/dev/null | awk -v a=$APP -v r=$REMOTE '$1==a && ($3!=r || $2!="stable") {print $2}' | sort -u | while read -r B; do
  [ "$B" = stable ] && continue
  echo "     removing the old copy built on this computer ($B)"
  flatpak uninstall --user -y --noninteractive $APP//$B || true
done
if flatpak list --system --app --columns=application 2>/dev/null | grep -qx $APP; then
  echo "     note: there is also a copy for all users of this computer; GNOME Software may show both. You can remove that one in GNOME Software."
fi
echo
flatpak info --user $APP//stable | grep -E "Version|Origin" || true
echo "Done. Open it from Activities (Knowing Jesus Today). From now on GNOME Software shows its updates by itself."
