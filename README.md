# Bible Corner for Linux (Knowing Jesus Today)

The Holy Bible, the Church Fathers, the Bible Dictionary and the Bible Maps of
[knowingjesus.today](https://knowingjesus.today), in an app of its own that works without the internet.

- **The Holy Bible**: many Bibles in nine languages, search, two Bibles side by side, listening, highlights, notes and Study Pads.
- **The Church Fathers** beside every chapter, and their writings to read like books.
- **Bible Dictionary**: names, places, the Apostles, the Fathers, and every place of the maps.
- **Bible Maps**: the land in its real colours, every place of Scripture, and story maps (Abraham, the Exodus, the Twelve Tribes, St Paul ...).
- **Today with God**: the verse of the day, the feast, the fast, the saints and the day's readings.
- **My KJT**: sign in to keep your study in step with the website and the Bible Corner app on your phone.

Made with Python, GTK 4 and libadwaita. Fits screens from 340 pixels wide.

## Install

**Easiest:** open the [Releases](../../releases) page, download `knowing-jesus-today.flatpak`, double-click it and press **Install**.

**Build it yourself:** `bash build.sh` (needs Flatpak; it fetches the GNOME runtime from Flathub).

**Try it without installing** (Fedora: `sudo dnf install python3-gobject gtk4 libadwaita`):
`KJT_LIB=src python3 src/kjt-app`

## Licence

The app: GPL-2.0-or-later. The texts it downloads keep the licences shown on knowingjesus.today.
Places: OpenBible.info Bible Geocoding Data (CC BY 4.0). Maps: Natural Earth (public domain).
