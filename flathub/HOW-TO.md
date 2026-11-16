# Putting the app on Flathub (so it installs from GNOME Software)

1. **Prove the app is yours.** Flathub gives a short code once the app is accepted; it goes in a file on the
   website: `https://knowingjesus.today/.well-known/org.flathub.VerifiedApps.txt` (one line: the code).
2. **Ask Flathub to add it.** On GitHub: fork https://github.com/flathub/flathub, make a branch from
   `new-pr`, add `today.knowingjesus.KJT.yml` from this folder, and open a pull request to `new-pr`
   titled "Add today.knowingjesus.KJT".
3. **Answer the reviewers** (usually within one to four weeks). After it is merged, the app appears in
   Software and updates by itself.

Each new version: tag the release here (v2.2 ...), then change `tag:` in the manifest of the Flathub
repository (flathub/today.knowingjesus.KJT) to the new tag.
