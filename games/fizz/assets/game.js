/* Fizz: Whisko fills the bottles; Cracked Keyf checks every one. */
(() => {
  "use strict";

  const $ = id => document.getElementById(id);
  const canvas = $("c");
  const g = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  g.imageSmoothingEnabled = false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(key, fallback) {
      try { const value = localStorage.getItem("fizz." + key); return value === null ? fallback : JSON.parse(value); }
      catch (_) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("fizz." + key, JSON.stringify(value)); }
      catch (_) { /* private browsing */ }
    },
  };

  let sprites = {}, atlas = null;
  let state = "ready", holding = false, fill = 0, target = .7, band = .22;
  let accepted = 0, rejected = 0, best = store.get("best", 0);
  let feedbackEnd = 0, lastTime = 0, clock = 0, bubbleClock = 0;
  let heldPointer = null, heldKey = false;

  const sound = {
    on: store.get("sound", true),
    ctx: null,
    unlock() {
      if (!this.on) return;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!this.ctx) this.ctx = new AudioContext();
      if (this.ctx.state === "suspended") this.ctx.resume();
    },
    tone(start, end, length, gain = .1, kind = "sine", delay = 0) {
      if (!this.on || !this.ctx) return;
      const c = this.ctx, at = c.currentTime + delay;
      const oscillator = c.createOscillator(), volume = c.createGain();
      oscillator.type = kind;
      oscillator.frequency.setValueAtTime(start, at);
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, end), at + length);
      volume.gain.setValueAtTime(.0001, at);
      volume.gain.exponentialRampToValueAtTime(gain, at + .012);
      volume.gain.exponentialRampToValueAtTime(.0001, at + length);
      oscillator.connect(volume).connect(c.destination);
      oscillator.start(at); oscillator.stop(at + length + .02);
    },
    bubble() { this.tone(340 + Math.random() * 250, 700 + Math.random() * 420, .09, .035, "sine"); },
    good() {
      this.tone(420, 660, .13, .09, "triangle");
      this.tone(610, 980, .18, .07, "triangle", .1);
    },
    bad() {
      this.tone(180, 75, .3, .11, "sawtooth");
      this.tone(120, 60, .18, .06, "triangle", .09);
    },
  };

  function syncSound() {
    $("sound").setAttribute("aria-pressed", String(sound.on));
    $("sound").querySelector(".tape-label").textContent = sound.on ? "Sound: on" : "Sound: off";
  }
  $("sound").addEventListener("click", () => {
    sound.on = !sound.on;
    store.set("sound", sound.on);
    syncSound();
    if (sound.on) sound.unlock();
  });
  syncSound();

  function updateUI() {
    $("score").textContent = accepted + (accepted === 1 ? " BOTTLE" : " BOTTLES");
    $("score").setAttribute("aria-label", "Bottles accepted: " + accepted);
    $("misses").textContent = "REJECTED " + rejected + "/3";
    $("misses").setAttribute("aria-label", "Rejected bottles: " + rejected + " of 3");
    $("best").textContent = "Best " + best + (best === 1 ? " bottle" : " bottles");
  }
  updateUI();

  function say(message, kind = "") {
    const el = $("status");
    el.textContent = message;
    el.className = "fz-status" + (kind ? " " + kind : "");
  }

  function newBottle() {
    fill = 0;
    target = .68 + ((accepted + rejected) % 3 - 1) * .035;
    band = Math.max(.105, .22 - accepted * .009);
    state = "playing";
    say("");
    $("stir").disabled = false;
  }

  function start() {
    accepted = 0;
    rejected = 0;
    holding = false;
    heldPointer = null;
    heldKey = false;
    $("ready").hidden = true;
    $("over").hidden = true;
    sound.unlock();
    newBottle();
    updateUI();
  }

  function startHold() {
    if (state !== "playing" || holding) return;
    sound.unlock();
    holding = true;
    bubbleClock = 0;
    $("stir").classList.add("is-held");
  }

  function stopHold(cancel = false) {
    if (!holding) return;
    holding = false;
    $("stir").classList.remove("is-held");
    if (!cancel) judge();
  }

  function judge(overflow = false) {
    if (state !== "playing") return;
    const low = target - band / 2, high = target + band / 2;
    const good = !overflow && fill >= low && fill <= high;
    $("stir").disabled = true;
    state = "feedback";
    feedbackEnd = performance.now() + 950;
    if (good) {
      accepted++;
      if (accepted > best) { best = accepted; store.set("best", best); }
      say(Math.abs(fill - target) < band * .16 ? "EXACT FILL. ACCEPTED." : "ACCEPTED.", "good");
      sound.good();
    } else {
      rejected++;
      say(overflow || fill > high ? "OVERFILLED. REJECTED." : "FLAT. REJECTED.", "bad");
      sound.bad();
    }
    updateUI();
  }

  function finish() {
    state = "over";
    $("stir").disabled = true;
    $("over-line").textContent = accepted + (accepted === 1 ? " bottle passed inspection." : " bottles passed inspection.");
    $("over-best").textContent = "Best: " + best;
    $("over").hidden = false;
    say("");
  }

  $("play").addEventListener("click", start);
  $("again").addEventListener("click", start);

  for (const surface of [$("stir"), $("screen")]) {
    surface.addEventListener("pointerdown", event => {
      if (state !== "playing" || event.target.closest(".fz-card")) return;
      event.preventDefault();
      heldPointer = event.pointerId;
      try { surface.setPointerCapture(event.pointerId); } catch (_) { /* unsupported capture */ }
      startHold();
    });
    surface.addEventListener("pointerup", event => {
      if (heldPointer !== event.pointerId) return;
      event.preventDefault();
      heldPointer = null;
      stopHold();
    });
    surface.addEventListener("pointercancel", event => {
      if (heldPointer !== event.pointerId) return;
      heldPointer = null;
      stopHold(true);
    });
    surface.addEventListener("lostpointercapture", event => {
      if (heldPointer !== event.pointerId) return;
      heldPointer = null;
      stopHold(true);
    });
  }
  window.addEventListener("keydown", event => {
    if (event.code !== "Space" || event.repeat || state !== "playing") return;
    event.preventDefault();
    heldKey = true;
    startHold();
  });
  window.addEventListener("keyup", event => {
    if (event.code !== "Space" || !heldKey) return;
    event.preventDefault();
    heldKey = false;
    stopHold();
  });
  window.addEventListener("blur", () => { heldKey = false; heldPointer = null; stopHold(true); });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { heldKey = false; heldPointer = null; stopHold(true); }
    lastTime = performance.now();
  });

  $("share").addEventListener("click", async () => {
    const url = "https://rotville.world/games/fizz/";
    const text = accepted + (accepted === 1 ? " bottle" : " bottles") + " passed inspection at FIZZCO.";
    try {
      if (navigator.share) await navigator.share({ title: "Fizz · Rotville", text, url });
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text + " " + url);
        $("share").querySelector(".tape-label").textContent = "Copied";
      }
    } catch (_) { /* cancelled or unavailable */ }
  });

  const wall = document.createElement("canvas");
  wall.width = W; wall.height = H;
  const bg = wall.getContext("2d");
  bg.imageSmoothingEnabled = false;
  function rect(x, y, w, h, color, ctx = bg) {
    ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  function paintWall() {
    rect(0, 0, W, H, "#1b1126");
    rect(0, 58, W, 332, "#322032");
    for (let y = 59, row = 0; y < 384; y += 18, row++) {
      rect(0, y, W, 1, "#1f1529");
      for (let x = (row & 1) ? -17 : 0; x < W; x += 34) {
        rect(x, y + 1, 1, 17, "#201527");
        rect(x + 2, y + 2, 29, 2, row % 3 ? "#3d2739" : "#42263d");
      }
    }
    // The magenta vat and its brass feed pipe sit behind the fill station.
    rect(10, 66, 20, 307, "#241824");
    rect(14, 67, 5, 306, "#775641");
    rect(15, 67, 2, 306, "#b18151");
    rect(20, 67, 113, 12, "#614331");
    rect(20, 67, 113, 3, "#b78a59");
    rect(127, 71, 13, 112, "#6b4c35");
    rect(131, 72, 4, 111, "#b69060");
    rect(19, 86, 8, 8, "#3d2c2e");
    rect(125, 73, 9, 9, "#3d2c2e");
    rect(0, 374, W, 106, "#211823");
    for (let x = 0; x < W; x += 27) rect(x, 393, 1, 87, "#3e2d34");
    rect(0, 390, W, 6, "#7b5b45");
    rect(0, 395, W, 3, "#2c2027");

    // The station: blocky metal rather than a glossy gauge.
    rect(34, 88, 202, 291, "#1b1521");
    rect(37, 91, 196, 285, "#625047");
    rect(43, 96, 184, 274, "#332833");
    rect(54, 99, 162, 29, "#241b25");
    rect(57, 102, 156, 2, "#aa7458");
    bg.fillStyle = "#ffc579";
    bg.font = "bold 19px 'Lilita One', sans-serif";
    bg.textAlign = "center";
    bg.fillText("FIZZCO", 135, 122);
    rect(45, 140, 180, 2, "#aa7859");
    rect(45, 142, 180, 2, "#1f1721");
    rect(50, 158, 35, 171, "#291e2a");
    rect(185, 158, 35, 171, "#291e2a");
    for (const x of [55, 200]) {
      rect(x, 165, 11, 15, "#a3714d");
      rect(x + 2, 168, 7, 9, "#3d2c30");
      rect(x + 3, 170, 5, 5, "#cb5a93");
      rect(x, 306, 11, 15, "#a3714d");
      rect(x + 2, 309, 7, 9, "#3d2c30");
      rect(x + 3, 311, 5, 5, "#a9d677");
    }
    rect(51, 344, 168, 24, "#8a6149");
    rect(51, 346, 168, 4, "#b88759");
    for (let x = 54; x < 215; x += 17) rect(x, 353, 11, 10, "#513d38");
    rect(100, 162, 70, 12, "#6d4c39");
    rect(127, 166, 16, 32, "#9c764d");
    rect(131, 167, 6, 31, "#d1a363");
    rect(115, 193, 40, 9, "#2f2229");
    rect(120, 196, 30, 5, "#b47b57");
    // The two syrup vats make this a FIZZCO floor, even on a small phone screen.
    rect(0, 308, 76, 12, "#694b3d");
    rect(4, 311, 68, 4, "#bb885e");
    rect(5, 320, 67, 90, "#2a1b2a");
    rect(10, 326, 57, 69, "#57314d");
    rect(11, 327, 55, 13, "#b7458b");
    rect(17, 333, 7, 3, "#f09acb");
    rect(42, 330, 4, 4, "#f09acb");
    rect(5, 396, 67, 12, "#7a5346");
    rect(12, 399, 54, 3, "#ba8c63");
    rect(198, 308, 72, 12, "#694b3d");
    rect(203, 311, 67, 4, "#bb885e");
    rect(200, 320, 66, 90, "#2a1b2a");
    rect(205, 326, 56, 69, "#35452e");
    rect(206, 327, 54, 13, "#82b449");
    rect(214, 331, 5, 4, "#c5ed91");
    rect(242, 334, 7, 3, "#c5ed91");
    rect(200, 396, 66, 12, "#7a5346");
    rect(205, 399, 55, 3, "#ba8c63");
    rect(36, 371, 198, 10, "#ae7b53");
    rect(36, 380, 198, 9, "#3e2d31");
    for (let x = 49; x < 227; x += 22) rect(x, 383, 12, 2, "#715440");
    rect(0, 420, W, 4, "#a27652");
    rect(0, 424, W, 22, "#47302f");
    for (let x = 0; x < W; x += 25) {
      rect(x, 425, 19, 17, "#775346");
      rect(x + 2, 427, 15, 2, "#9e7354");
    }
    rect(0, 445, W, 4, "#a27652");
  }
  paintWall();

  function pathBottle(ctx) {
    ctx.beginPath();
    ctx.moveTo(116, 200); ctx.lineTo(154, 200);
    ctx.lineTo(154, 220); ctx.lineTo(169, 234);
    ctx.lineTo(174, 350); ctx.lineTo(169, 356);
    ctx.lineTo(101, 356); ctx.lineTo(96, 350);
    ctx.lineTo(101, 234); ctx.lineTo(116, 220);
    ctx.closePath();
  }
  function drawBottle(now) {
    g.save();
    pathBottle(g); g.fillStyle = "#201c2e"; g.fill();
    g.clip();
    const bottom = 351, top = 232, height = bottom - top;
    const rise = Math.min(1.02, fill) * height;
    const liquid = g.createLinearGradient(0, bottom - rise, 0, bottom);
    liquid.addColorStop(0, "#f48ec9"); liquid.addColorStop(.18, "#d24b9b"); liquid.addColorStop(1, "#75285d");
    g.fillStyle = liquid;
    g.fillRect(98, bottom - rise, 74, rise + 3);
    if (fill > 0 && !reduce) {
      g.fillStyle = "rgba(255,226,245,.7)";
      for (let i = 0; i < 16; i++) {
        const x = 105 + ((i * 37) % 59), y = bottom - ((i * 23 + now * (12 + i % 4 * 6)) % Math.max(1, rise));
        g.fillRect(x, y, i % 3 === 0 ? 3 : 2, 2);
      }
    }
    rect(103, 234, 4, 112, "rgba(255,247,230,.17)", g);
    rect(161, 242, 3, 101, "rgba(255,247,230,.1)", g);
    g.restore();
    pathBottle(g); g.strokeStyle = "#b9a590"; g.lineWidth = 3; g.stroke();
    pathBottle(g); g.strokeStyle = "#514748"; g.lineWidth = 1; g.stroke();
    rect(116, 198, 38, 5, "#d3a77b", g);
    rect(121, 204, 28, 5, "#544442", g);
    // A marked bracket outside the bottle keeps the target visible at any fill.
    const y = Math.round(bottom - target * height);
    const half = Math.round(band * height / 2);
    rect(93, y - half, 5, half * 2, "#f3c56c", g);
    rect(172, y - half, 5, half * 2, "#f3c56c", g);
    rect(91, y - half, 11, 3, "#ffe4a1", g);
    rect(91, y + half - 3, 11, 3, "#ffe4a1", g);
    rect(168, y - half, 11, 3, "#ffe4a1", g);
    rect(168, y + half - 3, 11, 3, "#ffe4a1", g);
    g.fillStyle = "#ffe1a0";
    g.font = "13px 'VT323', monospace";
    g.textAlign = "left";
    g.fillText("FILL", 181, y + 4);
  }

  function sprite(name, x, baseline, scale, tilt = 0) {
    if (!atlas || !sprites[name]) return;
    const [sx, sy, sw, sh, ax, ay] = sprites[name];
    g.save();
    g.translate(Math.round(x), Math.round(baseline));
    g.rotate(tilt);
    g.drawImage(atlas, sx, sy, sw, sh, Math.round(-ax * scale), Math.round(-ay * scale), Math.round(sw * scale), Math.round(sh * scale));
    g.restore();
  }

  function render() {
    g.drawImage(wall, 0, 0);
    drawBottle(clock);
    const frame = holding && !reduce ? Math.floor(clock * 15) % 3 : 0;
    sprite(["whisko_front", "whisko_right", "whisko_left"][frame], 49, 389, .62, holding && !reduce ? -.035 : 0);
    sprite("keyf_front", 221, 388, .65, state === "feedback" && rejected > 0 && !reduce ? -.035 : 0);
    if (state === "feedback") {
      const acceptedBottle = $("status").classList.contains("good");
      g.save();
      g.translate(135, 286);
      g.rotate(-.14);
      g.fillStyle = acceptedBottle ? "#24482f" : "#602d32";
      g.fillRect(-45, -13, 90, 27);
      g.strokeStyle = acceptedBottle ? "#c9efa3" : "#ffb0ab";
      g.lineWidth = 2; g.strokeRect(-45, -13, 90, 27);
      g.fillStyle = acceptedBottle ? "#dbffc0" : "#ffe0d8";
      g.font = "19px 'VT323', monospace";
      g.textAlign = "center";
      g.fillText(acceptedBottle ? "ACCEPTED" : "REJECTED", 0, 7);
      g.restore();
    }
  }

  function loop(now) {
    if (!lastTime) lastTime = now;
    const dt = Math.min(.05, (now - lastTime) / 1000);
    lastTime = now;
    if (!document.hidden) {
      clock += dt;
      if (state === "playing" && holding) {
        fill += (Math.min(.72, .32 + accepted * .025)) * dt;
        bubbleClock += dt;
        if (bubbleClock >= .16) { bubbleClock = 0; sound.bubble(); }
        if (fill >= 1.03) { holding = false; $("stir").classList.remove("is-held"); judge(true); }
      }
      if (state === "feedback" && now >= feedbackEnd) {
        if (rejected >= 3) finish();
        else newBottle();
      }
      render();
    }
    requestAnimationFrame(loop);
  }

  Promise.all([
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = reject;
      image.src = "assets/sprites.png";
    }),
    fetch("assets/sprites.json").then(response => {
      if (!response.ok) throw Error("Sprite map failed");
      return response.json();
    }),
  ]).then(([image, map]) => {
    atlas = image; sprites = map;
    $("play").disabled = false;
    $("play").textContent = "▶ PLAY";
  }).catch(() => {
    $("play").textContent = "ART UNAVAILABLE";
  });
  $("play").disabled = true;
  $("play").textContent = "LOADING";
  requestAnimationFrame(loop);
})();
