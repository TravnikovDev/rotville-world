# rotville.world

The website of Rotville, a perfectly normal town. Rotville is a series of short, deadpan stories about the residents who live there, posted on YouTube, TikTok and Instagram. This repository is the site exactly as [rotville.world](https://rotville.world) serves it.

## What is on the site

The main page has the town, the ways to watch it, and a small TV on Channel 3 that plays the opening seconds of the most-watched episodes.

[Megabite](https://rotville.world/games/megabite/) is the first game. Megabite is a snake of iron blocks with a plug for a head, and he goes under the town eating the square things people leave lying about. He gets longer. That is the whole of it. It plays with the arrow keys on a computer and with swipes on a phone.

[One Cent](https://rotville.world/games/one-cent/) is the second. Nickelpig wants the single cent lying in the road outside Big Barry, the office building with one enormous eye on its roof, and he may only move while that eye is shut. Hold to creep, let go when the eye opens.

[Lamp](https://rotville.world/games/lamp/) is the third. Fusegrin is a navy iron ball whose fuse is not a countdown but his lamp. The bulbs in a house go out one after another, and you roll him from room to room, up and down the ladders, to keep the whole house lit.

[Down the Drain](https://rotville.world/games/drain/) is the fourth. Holloring, a pink see-through jelly who keeps whatever gets lost down the drains, falls down a dark shaft that gets faster and darker the deeper he goes. A holler lights it up for a moment, whatever he catches floats inside him, and each pipe he hits knocks one thing back out. Three knocks and he stops, and the score is how far down he got.

[Paper Round](https://rotville.world/games/paper-round/) is the fifth. Sprouted Doris walks a lane on her roots with a satchel of envelopes and delivers the hellos nobody sent to the places people live in, a post, a pipe, a bench, a file. Tap a place with a green flower to throw one, steer round the puddles and what is left on the lane, and pick up more letters as you go. Three places missed and the round is over.

[Say Hello](https://rotville.world/games/say-hello/) is the sixth. Gil Lister, a cheerful worm who lives inside the pipes, pops out of one pipe after another to say hello, and in the town's lore nobody ever says it back. Here you do: tap him while he is out. Shytan pops out too, under his umbrella, and tapping him counts as a miss. The pipes lose their caps one by one and Gil gets quicker, and three hellos nobody answered end it.

[Pipe Dream](https://rotville.world/games/pipe-dream/) is the seventh. When dreams clog in Rotville, Knightley is called: the dream plumber, a frog skeleton in a starry sleep cap. A dream comes up like a cloud in front of Snoreacle, the hooded idol that mutters in its sleep, and you lay pipe from the next pieces to carry it to the drain before it reaches an open end. If it does, it gets out onto the floor and leaves a puddle with a star floating in it, and three wet floors end the night. The first clogs are near and come with the pieces they need; after that, every clog cleared, the dream comes sooner and runs faster, and there is more old pipe nobody can move.

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
| `games/megabite/`, `games/one-cent/`, `games/lamp/`, `games/drain/`, `games/paper-round/`, `games/say-hello/`, `games/pipe-dream/` | the games |
| `404.html` | the page for a link that leads nowhere |
| `CNAME` | the domain |

## Rights

The characters, art, music, voice, episodes and code here belong to Rotville, and all rights are reserved. The repository is public so that GitHub Pages can serve the site, not so that its contents can be reused.
