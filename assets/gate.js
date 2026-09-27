/* Rotville - the gate: Channel 3 follows its reel, the tape plays the bed. */
(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Channel 3 ----------
     assets/channel3.mp4 holds the hooks of the six most-watched episodes back to back; each segment ends in
     0.3 s of black that the page covers with static, so the file carries no noise to download. */
  const tv = document.querySelector(".tv");
  const reel = document.getElementById("reel");
  if (tv && reel) {
    const eps = JSON.parse(document.getElementById("channel3").textContent);
    const link = document.getElementById("tv-link");
    const epLabel = document.getElementById("tv-ep");
    const title = document.getElementById("tv-title");
    const watch = ["youtube", "tiktok", "instagram"].map(k => [k, document.getElementById("w-" + k)]);
    const noise = tv.querySelector(".static");
    const GAP = 0.3;
    let cur = 0;

    const show = i => {
      if (i === cur) return;
      cur = i;
      const e = eps[i];
      epLabel.textContent = "EP " + e.ep;
      title.textContent = e.title;
      link.href = e.youtube;
      link.setAttribute("aria-label", "Watch " + e.title + " on YouTube");
      for (const [k, a] of watch) a.href = e[k];
    };
    const tick = () => {
      const t = reel.currentTime;
      let i = eps.findIndex(e => t >= e.start && t < e.end);
      if (i < 0) i = 0;
      show(i);
      noise.classList.toggle("on", !reduce && t >= eps[i].end - GAP - 0.03);
      if (!reel.paused) requestAnimationFrame(tick);
    };
    const play = () => {
      const p = reel.play();
      if (p && p.catch) p.catch(() => tv.classList.add("blocked"));
    };

    reel.addEventListener("play", () => { tv.classList.remove("blocked"); requestAnimationFrame(tick); });
    reel.addEventListener("pause", () => noise.classList.remove("on"));
    // a tap on a set that is not playing starts it; a tap on a playing one opens the episode
    link.addEventListener("click", ev => { if (reel.paused) { ev.preventDefault(); play(); } });

    if (reduce) {
      reel.removeAttribute("autoplay");
      reel.pause();
      tv.classList.add("blocked");
    } else if ("IntersectionObserver" in window) {
      // plays only while it can be seen
      new IntersectionObserver(([en]) => (en.isIntersecting ? play() : reel.pause()), { threshold: 0.2 }).observe(reel);
    } else {
      play();
    }
  }

  /* ---------- the tape: lydian-plucks, looped without a gap, fetched only when switched on ---------- */
  const tape = document.getElementById("tape");
  if (!tape) return;
  const label = tape.querySelector(".tape-label");
  let ctx, gain, buf, src, loading, on = false, sleep;

  const load = async () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    ctx.resume();                      // inside the tap, so phones let it sound
    gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    const data = await (await fetch("assets/lydian-plucks.mp3")).arrayBuffer();
    buf = await new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail));
  };
  // the encoder pads both ends with silence, which would click at the loop: loop between the first and last sound
  const edges = b => {
    const d = b.getChannelData(0), n = d.length, lim = Math.min(n >> 3, b.sampleRate * 0.2);
    let s = 0, e = n - 1;
    while (s < lim && Math.abs(d[s]) < 1e-4) s++;
    while (n - 1 - e < lim && Math.abs(d[e]) < 1e-4) e--;
    return [s / b.sampleRate, (e + 1) / b.sampleRate];
  };
  const say = () => {
    tape.setAttribute("aria-pressed", String(on));
    label.textContent = on ? "Tape: on" : "Tape: off";
  };

  tape.addEventListener("click", async () => {
    on = !on;
    say();
    clearTimeout(sleep);
    try {
      if (on) {
        if (navigator.audioSession) navigator.audioSession.type = "playback";   // plays with the phone on silent
        if (loading) ctx.resume();     // later taps wake it inside the tap too
        else loading = load();
        await loading;
        if (!on) return;
        if (!src) {
          const [a, b] = edges(buf);
          src = ctx.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          src.loopStart = a;
          src.loopEnd = b;
          src.connect(gain);
          src.start(0, a);
        }
        gain.gain.setTargetAtTime(0.8, ctx.currentTime, 0.15);
      } else if (ctx) {
        gain.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
        sleep = setTimeout(() => { if (!on) ctx.suspend(); }, 800);
      }
    } catch (err) {
      on = false;
      say();
      label.textContent = "Tape: jammed";
    }
  });
})();
