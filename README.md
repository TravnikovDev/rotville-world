# rotville.world

The gate of Rotville: one static page with no build step. Every file here is served as it is.

Everything here - the art, the renders, the music, the voice and the episodes - belongs to Rotville. All rights reserved: the repository is public so the site can be served, not so its contents can be reused.

## How it is published

GitHub Pages serves this repository's `main` branch, folder `(root)`, at **rotville.world** (the `CNAME` file). To change the site, edit it here, commit and push; Pages redeploys in a minute or two.

The domain's DNS lives at Namecheap → Domain List → rotville.world → **Advanced DNS**:
- Delete the two parking records: the CNAME `www` → `parkingpage.namecheap.com` and the URL redirect on `@`.
- Add four **A records** for host `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
- Add a **CNAME record**: host `www`, value `travnikovdev.github.io.`

Then in the repo's Settings → Pages, tick **Enforce HTTPS** once GitHub has issued the certificate (the box is greyed out until then), and optionally verify the domain under the account's Settings → Pages → Verified domains, so no other account can claim it.

## What is here

| file | what it is |
|---|---|
| `index.html`, `assets/gate.css`, `assets/gate.js` | the page |
| `assets/banner-900.webp`, `assets/banner-1400.webp` | the channel banner, "A perfectly normal town." |
| `assets/logo-256.webp`, `favicon*`, `apple-touch-icon.png`, `icon-*.png` | the avatar and the icons |
| `assets/channel3.mp4`, `assets/channel3.jpg` | Channel 3: the opening seconds of the six most-watched episodes (033, 069, 083, 074, 078, 067), 27 s, muted, one after another |
| `assets/lydian-plucks.mp3` | the bed behind the **Tape** button, fetched only when someone switches it on |
| `assets/grain.png` | the tape grain and the static between channels |
| `assets/og.jpg` | the preview card when the link is pasted anywhere: the name, the three road signs, and Channel 3 showing episode 033 |
| `404.html` | "This tape could not be found." |
| `games/megabite/` | **Megabite**, the first game: Snake as his lore writes it, under the town. `assets/sprites.png` (16 KB) holds his head in four facings, sixteen views of six different blocks cut from his own column, and the five things he eats, pre-rendered in Blender and then hand-edited by the user (his face) - no model file ships, and the sheet is not regenerated over those edits. On a phone held upright the grid turns 11 wide and as tall as the screen allows. `og.jpg` is its preview card (a real frame of the game on the Rotville TV), `dream-circuit.mp3` is its bed, `line-start.mp3` / `line-stop.mp3` the narrator's two lines. The best length and the sound setting live in the visitor's own browser. |
| `CNAME`, `.nojekyll`, `robots.txt`, `site.webmanifest` | the domain, and plain-file serving |

The six episodes' titles and links, and where each one starts in the reel, sit in `index.html` inside `<script id="channel3">`. `assets/channel3.json` holds the same list. To change what Channel 3 shows, rebuild the reel and that list together.
