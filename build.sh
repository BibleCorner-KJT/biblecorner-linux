#!/bin/bash
# Knowing Jesus Today for Linux: build and install the Flatpak (Fedora with GNOME; any Linux with Flatpak).
# Run it once from this folder:   bash build.sh
set -e
cd "$(dirname "$0")"
APP=today.knowingjesus.KJT
echo "1/4  Flathub (where the GNOME parts come from)"
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
echo "2/4  The newest GNOME runtime on Flathub"
V=""
for v in 52 51 50 49 48; do
  if flatpak remote-info --user flathub "runtime/org.gnome.Platform/$(uname -m)/$v" >/dev/null 2>&1; then V=$v; break; fi
done
[ -z "$V" ] && { echo "Could not reach Flathub. Check the internet and try again."; exit 1; }
sed -i "s/^runtime-version: .*/runtime-version: '$V'/" $APP.yml
flatpak install --user -y --noninteractive flathub org.gnome.Platform//$V org.gnome.Sdk//$V org.flatpak.Builder
echo "3/4  Building (GNOME $V)"
flatpak run org.flatpak.Builder --user --install --force-clean --repo=repo build $APP.yml
echo "4/4  A single file to keep or give to others"
flatpak build-bundle repo knowing-jesus-today.flatpak $APP --runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo
echo
echo "Done. Open it from Activities (Knowing Jesus Today), or run:  flatpak run $APP"
echo "The file knowing-jesus-today.flatpak installs it on another computer:  flatpak install --user knowing-jesus-today.flatpak"
