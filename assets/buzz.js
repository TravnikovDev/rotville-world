/* A short buzz in the hand when something happens in a game. Each game names which of its sounds also buzz,
   rvBuzz.on(audio, { tumble: "lose", glug: "tap" }), and calls rvBuzz("over") where its ending makes no sound.
   The buzz does not follow the sound switch: a phone on silent still buzzes. Android browsers vibrate; Safari
   gives web pages no vibration, so an iPhone stays still, and a computer has nothing to vibrate. */
(() => {
  const KINDS = {
    tap: 10,                        // a small thing went right: a pickup, a delivery, a piece laid
    bump: 25,                       // a knock: a wall, a cone, a wrong tap
    hit: 45,                        // a hard knock
    good: [15, 45, 15],             // a success worth feeling
    great: [20, 50, 20, 50, 45],    // a level cleared, a skill shot
    lose: [70, 50, 110],            // a life, a ball or a round lost
    over: [100, 60, 180],           // the game is over
  };
  const can = "vibrate" in navigator && matchMedia("(pointer: coarse)").matches;
  const weight = p => Array.isArray(p) ? p.reduce((s, v, i) => s + (i % 2 ? 0 : v), 0) : p;
  let until = 0, held = 0;

  function buzz(kind) {
    const p = typeof kind === "string" ? KINDS[kind] : kind;
    if (!can || !p || document.hidden) return;
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;   // the browser refuses before a tap
    const now = performance.now(), w = weight(p);
    if (now < until && w <= held) return;   // one still running: only a stronger one cuts in, so a burst stays one buzz
    until = now + (Array.isArray(p) ? p.reduce((s, v) => s + v, 0) : p) + 40;
    held = w;
    try { navigator.vibrate(p); } catch (e) { /* not allowed here */ }
  }

  // a sound that buzzes too: the value is a kind, a length in ms, or a function of the sound's arguments
  buzz.on = (audio, map) => {
    for (const name in map) {
      const play = audio[name], k = map[name];
      if (typeof play !== "function") continue;
      audio[name] = function (...args) {
        buzz(typeof k === "function" ? k(...args) : k);
        return play.apply(this, args);
      };
    }
    return audio;
  };

  window.rvBuzz = buzz;
})();
