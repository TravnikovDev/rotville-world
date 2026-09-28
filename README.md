# rotville.world

The website of Rotville, a perfectly normal town. Rotville is a series of short, deadpan stories about the residents who live there, posted on YouTube, TikTok and Instagram. This repository is the site exactly as [rotville.world](https://rotville.world) serves it.

## What is on the site

The main page has the town, the ways to watch it, and a small TV on Channel 3 that plays the opening seconds of the most-watched episodes.

[Megabite](https://rotville.world/games/megabite/) is the first game. Megabite is a snake of iron blocks with a plug for a head, and he goes under the town eating the square things people leave lying about. He gets longer. That is the whole of it. It plays with the arrow keys on a computer and with swipes on a phone.

[One Cent](https://rotville.world/games/one-cent/) is the second. Nickelpig wants the single cent lying in the road outside Big Barry, the office building with one enormous eye on its roof, and he may only move while that eye is shut. Hold to creep, let go when the eye opens.

[Lamp](https://rotville.world/games/lamp/) is the third. Fusegrin is a navy iron ball whose fuse is not a countdown but his lamp. The bulbs in a house go out one after another, and you roll him from room to room, up and down the ladders, to keep the whole house lit.

Rotville is on [YouTube](https://www.youtube.com/@Rotville), [TikTok](https://www.tiktok.com/@rotville.world) and [Instagram](https://www.instagram.com/rotville.world/).

## How it is made

The site is plain HTML, CSS and JavaScript, with no framework and no build step, and GitHub Pages serves the `main` branch as it is. The games are drawn on a canvas from pre-rendered sprites. The fonts are VT323, Lilita One and Overpass from Google Fonts.

To run it on your own computer, start a static server in this folder and open http://localhost:8000:

```bash
python3 -m http.server 8000
```

| path | what it is |
|---|---|
| `index.html`, `assets/` | the main page with its styles, script, pictures, reel and music |
| `games/megabite/`, `games/one-cent/`, `games/lamp/` | the games |
| `404.html` | the page for a link that leads nowhere |
| `CNAME` | the domain |

## Rights

The characters, art, music, voice, episodes and code here belong to Rotville, and all rights are reserved. The repository is public so that GitHub Pages can serve the site, not so that its contents can be reused.
