/* Six Balloons. Boss Edna, the cow carried aloft by six balloons on a wooden yoke, drifts over the rooftops of
   Rotville at dusk, cheerful and entirely unbothered. Balloon Fight's Balloon Trip, over the town: the sky goes by,
   she steers left and right through it with all the momentum of a cow, and every flap lifts her a little, more the
   more balloons she has. The town's flying residents share the sky with her: Gnattoes hang in it in sorted swarms,
   Bagrat and the Jellybees cross it, Bogar comes for anything shiny, and Misery Peter follows her about and rains;
   a touch pops a balloon, and the rain weighs her down. The roofs below are the sea: brush them and a balloon goes,
   touch the street and she has come down. Loose balloons rise out of the streets to be caught, caught one after
   another they count for more, and the lit windows throw her treats. With no balloons left she comes back down,
   which nobody had asked her to. */
(() => {
  "use strict";
  const W = 270, H = 480;
  const GROUND = 468;                               // the street: what she has never touched
  const PXM = 10;                                   // pixels to a metre of the town: a house is seven or eight metres wide
  const $ = id => document.getElementById(id);
  const cv = $("c"), g = cv.getContext("2d");
  g.imageSmoothingEnabled = false;
  const store = {
    get(k, d) { try { const v = localStorage.getItem("sixballoons." + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem("sixballoons." + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };
  const LINES = {
    start: "Boss Edna drifts over the rooftops. Nobody has asked her to come back.",
    one: "One balloon left. Boss Edna remains entirely unbothered.",
    best: "Further than she has ever drifted.",
    end: "Boss Edna came back down. Nobody had asked her to.",
  };
  // her six, the back row first, and where each one's knot hangs from the knot on her yoke, laid out for the screen
  const SLOTS = ["green", "orange", "blue2", "blue1", "purple1", "purple2"];
  const BUNCH = { green: [-12, -44], orange: [5, -47], blue2: [20, -38], blue1: [-22, -30], purple1: [-6, -28], purple2: [10, -25] };
  const HUE = { green: "#74b843", orange: "#e8683a", blue1: "#4f8fcf", blue2: "#3c78c8", purple1: "#9466cc", purple2: "#aa5cb6" };
  const KINDS = ["green", "orange", "blue1", "blue2", "purple1", "purple2"];
  // Balloon Fight's floating: a flap adds a little lift and a held flap keeps flapping; the pull down is light, and
  // both depend on how many balloons she still has (px/s and px/s^2)
  const FLAP = [0, 56, 64, 72, 80, 88, 96];
  const FALL = [380, 192, 174, 158, 144, 132, 122];
  const VUP = 140, VDOWN = 165, FLAP_EVERY = 0.2;
  // steering: she gathers speed slowly and keeps it, a cow under balloons does not stop on a coin
  const STEER = 290, HDRAG = 1.4, VXMAX = 125;
  const TILTS = [-12, -8, -4, 0, 4, 8, 12];
  const tiltName = t => "edna_t" + (t < 0 ? "-" : "+") + String(Math.abs(t)).padStart(2, "0");
  const BODY = { dy: 1, rx: 18, ry: 15, feet: 20 };  // her body for touching things: an ellipse about her middle
  const fmt = n => Math.floor(n).toLocaleString("en-US");
  const rng = seed => { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  /* ---------- the town's paint: houses, washing, treats, the sky, drawn a row of pixels at a time ---------- */
  const ROOFS = [
    { base: "#b4553a", dark: "#7c3424", light: "#d27350" },     // terracotta
    { base: "#59607a", dark: "#3a3f55", light: "#7b84a0" },     // slate
    { base: "#6b7f4f", dark: "#46563a", light: "#8ba26a" },     // moss
    { base: "#8c5b3e", dark: "#5e3c28", light: "#ab7954" },     // shingle
  ];
  const WALLS = [
    { base: "#e0cfae", shade: "#c2b090", dark: "#9c8b6e", fleck: "#ebddc0" },   // cream plaster
    { base: "#cea76b", shade: "#b08c55", dark: "#866a3e", fleck: "#d8b47c" },   // ochre
    { base: "#a6b3c4", shade: "#8996a8", dark: "#66717f", fleck: "#b4c0cf" },   // pale blue
    { base: "#d6b3aa", shade: "#ba968d", dark: "#8f716a", fleck: "#dfc0b8" },   // dusty pink
    { base: "#9a4b3b", shade: "#7d3a2d", dark: "#5c2a21", brick: true },        // brick
  ];
  const BRICK = WALLS[4];
  const LIT = ["#ffd47a", "#fff0b5", "#f0a548"], DARKWIN = ["#2c2840", "#4b4565"];
  // the washing pegged out on the lines: o outline, a cloth, b its shade, c a stripe
  const LAUNDRY = {
    shirt: ["..ooo...ooo..", ".oaaaoooaaao.", "oaaaaaaaaaaao", "oaaaaaaaaaabo", "ooooaaaaaoooo", "...oaaaaao...",
            "...oaaaaao...", "...oaaaaao...", "...oaaaabo...", "...oaaaabo...", "...ooooooo..."],
    sock: ["ooooo..", "occco..", "oaaao..", "oaaao..", "oaaao..", "oaabo..", "oaaaoo.", "oaaaaao", "oaaaaao", ".oaaabo", "..ooooo"],
    johns: ["ooooooooooo", "occcccccccc", "oaaaaaaaaao", "oaaaaaaaabo", "oaaaaoaaabo", "oaaao.oaaao", "oaaao.oaaao",
            "oaaao.oaaao", "oaaao.oaabo", "oaaao.oaabo", "oaabo.oaabo", "occco.occco", "ooooo.ooooo"],
    towel: ["ooooooooooo", "oaaaaaaaabo", "occcccccccc", "oaaaaaaaabo", "oaaaaaaaabo", "occcccccccc", "oaaaaaaaabo", "oaaaaaaaabo", "ooooooooooo"],
  };
  const CLOTH = [
    { a: "#f1eee4", b: "#cbc6b8", c: "#d24b3e", o: "#2a2430" }, { a: "#d24b3e", b: "#9b3127", c: "#f1eee4", o: "#2a2430" },
    { a: "#4d7cc6", b: "#33579b", c: "#f1eee4", o: "#2a2430" }, { a: "#e7c64b", b: "#b6992f", c: "#4d7cc6", o: "#2a2430" },
    { a: "#8fbf72", b: "#668f4f", c: "#f1eee4", o: "#2a2430" },
  ];
  // what the windows throw her: o outline, a the colour, b its shade, w a shine, c leaves, x kernels; "." is nothing
  const TREATS = {
    apple: { m: ["....o.cc.", "....occ..", ".ooo.ooo.", "oaaaoaaao", "oawaaaaao", "oawaaaaao", "oaaaaaabo", "oaaaaabbo", ".oaaabbo.", "..ooooo.."],
             pal: { o: "#2a1a1e", a: "#d23a2e", b: "#962620", w: "#f6c0a8", c: "#4f8a2e" } },
    carrot: { m: [".c.c.c.", "..ccc..", "..ooo..", ".oaaao.", "oaawaao", "oaawaao", "oaaaabo", ".oaaao.", ".oaabo.", ".oaabo.", "..oao..", "..oao..", "...o..."],
              pal: { o: "#3a1c10", a: "#ee8a2a", b: "#b8601a", w: "#ffd09a", c: "#4f9a2e" } },
    corn: { m: ["..ooo..", ".oaaao.", "oaxaxao", "oaaaaao", "oxaxaxo", "oaaaaao", "oaxaxao", "ocaaaco", "occacco", ".ocdco.", "..ccc..", "...c..."],
            pal: { o: "#3a2a10", a: "#f2cf3a", x: "#c8961e", c: "#6aa83a", d: "#3f7a22" } },
    bread: { m: ["...oooo...", ".ooaaaaoo.", ".oawwaaao.", "oaww..aaao", "oaw....abo", "oaa....abo", "oaaa..aabo", ".oaaaaabo.", ".oobbbboo.", "...oooo..."],
             pal: { o: "#3a2414", a: "#c8884a", b: "#94602e", w: "#f0c890" } },
  };
  const dot = (c, x, y, col) => { c.fillStyle = col; c.fillRect(x | 0, y | 0, 1, 1); };
  function bitmap(c, m, pal, x, y) {
    for (let j = 0; j < m.length; j++) for (let i = 0; i < m[j].length; i++) {
      const ch = m[j][i];
      if (ch !== ".") { c.fillStyle = pal[ch]; c.fillRect(x + i, y + j, 1, 1); }
    }
  }

  // one house, decided once from its seed: its shape, its windows, its chimney and aerial, where its roof is.
  // The houses are the low floor of the game, the sea of Balloon Trip: two to four floors under the open sky
  function makeHouse(x, seed, d) {
    const r = rng(seed);
    const kind = r() < 0.42 ? "gable" : r() < 0.86 ? "hip" : "flat";
    const w = kind === "gable" ? 54 + (r() * 30 | 0) : 70 + (r() * 48 | 0);
    const wh = kind === "gable" ? 52 + (r() * 34 | 0) : 46 + (r() * 36 | 0);
    const roof = ROOFS[r() * ROOFS.length | 0], wall = WALLS[r() * WALLS.length | 0];
    const rh = kind === "gable" ? Math.round(w * 0.4) : kind === "hip" ? 13 + (r() * 9 | 0) : 0;
    const h = { x, w, wh, kind, roof, wall, rh, seed, wins: [], door: null, chimney: null, aerial: null, tank: null };
    const cols = Math.max(1, Math.floor((w - 8) / 16)), rows = Math.max(1, Math.floor((wh - 14) / 20)), gx = (w - cols * 16) / 2 + 5;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      if (j === rows - 1 && i === (cols >> 1) && r() < 0.7) { h.door = { dx: Math.round(gx + i * 16) }; continue; }
      h.wins.push({ dx: Math.round(gx + i * 16), dy: 8 + j * 20, lit: r() < 0.42 });
    }
    if (kind === "gable") h.attic = { lit: r() < 0.5 };
    if (kind !== "gable" && r() < 0.6) h.chimney = { dx: 8 + (r() * (w - 22) | 0), ch: 9 + (r() * 8 | 0), smoke: r() < 0.65 };
    else if (kind === "gable" && r() < 0.35) h.chimney = { dx: r() < 0.5 ? 2 : w - 9, ch: 10 + (r() * 7 | 0), smoke: r() < 0.65, side: true };
    if (d > 20 && r() < 0.3) h.aerial = { dx: 6 + (r() * (w - 12) | 0), ah: 14 + (r() * 8 | 0) };
    if (kind === "flat" && r() < 0.6) h.tank = { dx: 6 + (r() * (w - 24) | 0) };
    if (h.chimney) {
      const c = h.chimney, base = c.side ? GROUND - wh - 2 : roofAt(h, x + c.dx + 3) + 3;
      c.x = x + c.dx; c.top = base - c.ch - 3; c.bottom = base;
    }
    if (h.aerial) { const a = h.aerial; a.x = x + a.dx; a.base = roofAt(h, a.x) + 1; a.top = a.base - a.ah - 1; }
    return h;
  }
  // the top of a house over one column of the street, or null beyond its eaves
  function roofAt(h, wx) {
    const top = GROUND - h.wh, u = wx - h.x;
    if (u < -3 || u > h.w + 3) return null;
    if (h.kind === "gable") { const mid = h.w / 2; return Math.round(top - h.rh * Math.max(0, 1 - Math.abs(u - mid) / (mid + 3))); }
    if (h.kind === "hip") { const inset = h.rh * 0.9, e = Math.min(u + 3, h.w + 3 - u); return Math.round(top - Math.min(h.rh, h.rh * e / (inset + 3))); }
    return u < 0 || u > h.w ? null : top - 3;
  }
  function brick(c, x, y, w, hh, wl, phase) {
    c.fillStyle = wl.base; c.fillRect(x, y, w, hh);
    c.fillStyle = wl.shade;
    for (let j = 0; j < hh; j += 3) {
      c.fillRect(x, y + j, w, 1);
      for (let i = ((j / 3) & 1) * 3 + phase; i < w; i += 6) c.fillRect(x + i, y + j + 1, 1, 2);
    }
  }
  function windowAt(c, x, y, lit, wl) {
    if (lit) { c.fillStyle = "rgba(255, 210, 120, 0.22)"; c.fillRect(x - 2, y - 2, 10, 12); }
    c.fillStyle = wl.dark; c.fillRect(x - 1, y - 1, 8, 10);
    if (lit) { c.fillStyle = LIT[0]; c.fillRect(x, y, 6, 8); c.fillStyle = LIT[1]; c.fillRect(x, y, 2, 3); c.fillStyle = LIT[2]; c.fillRect(x + 4, y + 5, 2, 3); }
    else { c.fillStyle = DARKWIN[0]; c.fillRect(x, y, 6, 8); dot(c, x + 1, y + 1, DARKWIN[1]); dot(c, x + 2, y + 1, DARKWIN[1]); dot(c, x + 1, y + 2, DARKWIN[1]); }
    c.fillStyle = wl.dark; c.fillRect(x + 3, y, 1, 8); c.fillRect(x, y + 4, 6, 1);
    c.fillStyle = wl.shade; c.fillRect(x - 1, y + 9, 8, 1);
  }
  // the house painted once onto its own little canvas; the game only copies it
  function paint(h) {
    const PAD = 12, up = h.rh + (h.chimney ? h.chimney.ch + 6 : 0) + (h.aerial ? h.aerial.ah + 4 : 0) + 24;
    const c0 = document.createElement("canvas");
    c0.width = h.w + PAD * 2; c0.height = h.wh + up;
    const c = c0.getContext("2d"), r = rng(h.seed * 7 + 1), x = PAD, ground = c0.height, top = ground - h.wh, w = h.w, R = h.roof, Wl = h.wall;
    const local = wx => wx - h.x + PAD, ly = wy => wy - GROUND + ground;
    if (Wl.brick) brick(c, x, top, w, h.wh, Wl, 0);
    else {
      c.fillStyle = Wl.base; c.fillRect(x, top, w, h.wh);
      for (let k = 0; k < w * h.wh * 0.05; k++) dot(c, x + r() * w, top + r() * h.wh, r() < 0.5 ? Wl.shade : Wl.fleck);
    }
    c.fillStyle = Wl.shade; c.fillRect(x + w - 2, top, 2, h.wh);
    c.fillStyle = "rgba(0,0,0,0.18)"; c.fillRect(x, top, w, 2);
    for (const wi of h.wins) windowAt(c, x + wi.dx, top + wi.dy, wi.lit, Wl);
    if (h.door) {
      const dx = x + h.door.dx;
      c.fillStyle = Wl.dark; c.fillRect(dx - 1, ground - 13, 9, 13);
      c.fillStyle = "#5b3a2a"; c.fillRect(dx, ground - 12, 7, 12);
      c.fillStyle = "#73503a"; c.fillRect(dx + 1, ground - 11, 2, 10);
      dot(c, dx + 5, ground - 6, "#e3c26a");
    }
    if (h.kind === "gable") {
      const mid = w / 2;
      for (let i = 1; i <= h.rh; i++) {
        const half = Math.round((mid + 3) * (1 - i / h.rh)), y = top - i, l = Math.round(x + mid - half), rr = Math.round(x + mid + half);
        c.fillStyle = Wl.base; c.fillRect(l + 3, y, Math.max(0, rr - l - 6), 1);
        c.fillStyle = i % 3 === 0 ? R.dark : R.base; c.fillRect(l, y, 4, 1); c.fillRect(rr - 4, y, 4, 1);
        dot(c, l, y, R.light);
      }
      c.fillStyle = R.dark; c.fillRect(x - 3, top, 4, 1); c.fillRect(x + w - 1, top, 4, 1);
      dot(c, Math.round(x + mid), top - h.rh - 1, R.dark);
      const ay = top - Math.round(h.rh * 0.45), ax = Math.round(x + mid - 2);
      c.fillStyle = Wl.dark; c.fillRect(ax - 1, ay - 1, 6, 6);
      c.fillStyle = h.attic.lit ? LIT[0] : DARKWIN[0]; c.fillRect(ax, ay, 4, 4);
      if (h.attic.lit) { dot(c, ax, ay, LIT[1]); c.fillStyle = "rgba(255, 210, 120, 0.2)"; c.fillRect(ax - 2, ay - 2, 8, 8); }
    } else if (h.kind === "hip") {
      const inset = h.rh * 0.9;
      for (let i = 0; i <= h.rh; i++) {
        const y = top - i, l = Math.round(x - 3 + inset * i / h.rh), rr = Math.round(x + w + 3 - inset * i / h.rh), course = i % 3 === 0;
        c.fillStyle = course ? R.dark : R.base; c.fillRect(l, y, rr - l, 1);
        if (!course) { c.fillStyle = R.dark; for (let u = l + (Math.floor(i / 3) & 1) * 2; u < rr; u += 4) c.fillRect(u, y, 1, 1); }
        dot(c, l, y, R.dark); dot(c, rr - 1, y, R.dark);
      }
      c.fillStyle = R.light; c.fillRect(Math.round(x - 3 + inset), top - h.rh - 1, Math.round(w + 6 - 2 * inset), 1);
    } else {
      c.fillStyle = Wl.shade; c.fillRect(x - 1, top - 3, w + 2, 3);
      c.fillStyle = Wl.dark; c.fillRect(x - 1, top - 3, w + 2, 1);
      if (h.tank) {
        const tx = x + h.tank.dx;
        c.fillStyle = "#6c5b4a"; c.fillRect(tx, top - 17, 16, 14); c.fillStyle = "#86735f"; c.fillRect(tx + 1, top - 16, 3, 12);
        c.fillStyle = "#4b3f34"; c.fillRect(tx - 1, top - 18, 18, 2); c.fillRect(tx + 2, top - 3, 2, 3); c.fillRect(tx + 12, top - 3, 2, 3);
      }
    }
    if (h.chimney) {
      const ch = h.chimney, cx = local(ch.x), cy = ly(ch.top) + 3, base = ly(ch.bottom);
      brick(c, cx, cy, 7, base - cy, BRICK, 1);
      c.fillStyle = "#5c2a21"; c.fillRect(cx - 1, cy - 2, 9, 2);
      c.fillStyle = "#3a2b28"; c.fillRect(cx + 1, cy - 3, 5, 1);
    }
    if (h.aerial) {
      const a = h.aerial, ax = local(a.x), base = ly(a.base), ay = base - a.ah;
      c.fillStyle = "#3a3540"; c.fillRect(ax, ay, 1, base - ay);
      for (const [dy, half] of [[2, 5], [5, 4], [8, 3]]) c.fillRect(ax - half, ay + dy, half * 2 + 1, 1);
      dot(c, ax, ay - 1, "#6a6475");
    }
    h.img = c0; h.pad = PAD;
  }
  function smoke(h, t) {
    const ch = h.chimney, cx = ch.x - camX + 3, cy = ch.top + 1;
    for (let k = 0; k < 6; k++) {
      const age = (t * 0.55 + k / 6 + (h.seed % 7) / 7) % 1;
      g.fillStyle = `rgba(214, 208, 222, ${0.5 * (1 - age)})`;
      g.beginPath(); g.arc(Math.round(cx - age * 22 + Math.sin(age * 6 + k) * 2), Math.round(cy - 2 - age * 46), 2 + age * 5, 0, Math.PI * 2); g.fill();
    }
  }
  const sagY = (ay, by, sag, s) => ay + (by - ay) * s + sag * 4 * s * (1 - s);
  function curve(ax, ay, bx, by, sag, col) {
    g.strokeStyle = col; g.lineWidth = 1;
    g.beginPath(); g.moveTo(Math.round(ax) + 0.5, Math.round(ay) + 0.5);
    for (let s = 0.05; s <= 1.0001; s += 0.05) g.lineTo(Math.round(ax + (bx - ax) * s) + 0.5, Math.round(sagY(ay, by, sag, s)) + 0.5);
    g.stroke();
  }
  // the sky in bands with the moon in it, and two rows of roofs in the haze behind, each painted once
  let SKY = null, HAZE = [];
  function paintSky() {
    SKY = document.createElement("canvas"); SKY.width = W; SKY.height = H;
    const c = SKY.getContext("2d");
    const stops = [[0, [64, 70, 116]], [0.35, [116, 104, 150]], [0.62, [196, 138, 140]], [0.8, [232, 172, 130]], [1, [240, 196, 150]]];
    for (let i = 0; i < 28; i++) {
      const u = i / 27;
      let k = 0; while (k < stops.length - 2 && u > stops[k + 1][0]) k++;
      const [u0, c0] = stops[k], [u1, c1] = stops[k + 1], f = Math.min(1, (u - u0) / (u1 - u0));
      c.fillStyle = "rgb(" + c0.map((v, j) => Math.round(v + (c1[j] - v) * f)).join(",") + ")";
      c.fillRect(0, Math.floor(i * H / 28), W, Math.ceil(H / 28) + 1);
    }
    c.fillStyle = "rgba(255, 244, 214, 0.18)"; c.beginPath(); c.arc(214, 66, 15, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#f4ead0"; c.beginPath(); c.arc(214, 66, 9, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#ddd0b0"; c.fillRect(210, 64, 3, 3); c.fillRect(216, 69, 2, 2); c.fillRect(215, 61, 2, 2);
    HAZE = [[436, 5, "#7c7099", 0.22, 0.9], [456, 9, "#655b82", 0.32, 1.0]].map(([base, seed, col, lit, scale]) => {
      const L = 1600, hc = document.createElement("canvas"); hc.width = L; hc.height = 140;
      const c2 = hc.getContext("2d"), r = rng(seed), b = 140;
      let x = 0;
      while (x < L - 70) {
        const w = Math.round((22 + r() * 40) * scale), hh = Math.round((20 + r() * 50) * scale), kind = r();
        c2.fillStyle = col; c2.fillRect(x, b - hh, w, hh);
        if (kind < 0.55) { const rh = Math.round(w * 0.35); for (let i = 1; i <= rh; i++) { const cut = Math.round((w / 2) * i / rh); c2.fillRect(x + cut, b - hh - i, w - 2 * cut, 1); } }
        else if (kind < 0.8) c2.fillRect(x + 3, b - hh - 5, 4, 5);
        for (let k = 0; k < w * hh / 160; k++) if (r() < 0.5) { c2.fillStyle = r() < lit ? "#e8c47e" : "rgba(0,0,0,0.12)"; c2.fillRect(Math.round(x + 3 + r() * (w - 6)), Math.round(b - hh + 4 + r() * (hh - 8)), 2, 2); }
        x += w + (r() < 0.25 ? Math.round(6 + r() * 16) : 0);
      }
      return { c: hc, L: x, base };
    });
  }

  /* ---------- state ---------- */
  let state = "load";                               // load, ready, play, pause, falling, down, over
  let atlas = null, SPR = {};
  let bestScore = store.get("bestScore", 0), bestM = store.get("bestM", 0);
  let score = 0, bonus = 0, metres = 0, caught = 0, chain = 0, bestChain = 0, mult = 1, fed = 0, said = {}, nextMile = 250;
  let clock = 0, stateT = 0, camX = 0, speed = 70, shake = 0;
  let E = null, T = null, fx = [], pops = [];
  const input = { left: new Set(), right: new Set(), flap: new Set() };
  let flapT = 0;

  /* ---------- the town and the sky over it, made as she goes ---------- */
  const SKY_TOP = 40, SKY_BOTTOM = 336;            // where the Gnattoes hang: under the top of the screen, above the roofs
  // the way through a column of Gnattoes: wide at first and never narrower than she needs, since she stands about
  // a hundred pixels tall from the top of her highest balloon to her hooves
  const gapAt = d => Math.max(140, 188 - d / 40);
  // quiet: the town behind the first card, with nobody in its sky
  function newTown(seed, quiet) {
    T = { r: rng(seed), x: -40, houses: [], lines: [], gnats: [], flyers: [], loose: [], treats: [], prev: null, quiet,
          nextSwarm: W + 200, nextBagrat: 80 * PXM, nextJelly: 150 * PXM, nextBogar: 300 * PXM, nextPeter: 200 * PXM,
          nextLoose: 1.2, nextTreat: 4, nextStreet: 6 };
  }
  const pick = a => a[T.r() * a.length | 0];
  function grow(to) {
    while (T.x < to) {
      const d = Math.max(0, T.x / PXM);
      // the houses stand shoulder to shoulder with a lane between some; now and then a street opens wide enough for
      // a cow to come down into, and the street is the one thing she must never touch
      if (d > 80 && --T.nextStreet <= 0) { T.x += 58 + Math.round(T.r() * 26); T.nextStreet = 5 + (T.r() * 6 | 0); T.prev = null; }
      else T.x += d < 20 ? 0 : Math.round(T.r() * 14);
      const h = makeHouse(T.x, (T.r() * 4294967296) >>> 0, d);
      paint(h);
      T.houses.push(h);
      // now and then a washing line from this house back to the one before
      const p = T.prev;
      if (p && d > 30 && T.r() < 0.3) {
        const a = p.chimney && !p.chimney.side ? [p.chimney.x + 6, p.chimney.top + 3] : [p.x + p.w + 2, GROUND - p.wh - 1];
        const b = h.chimney && !h.chimney.side ? [h.chimney.x + 1, h.chimney.top + 3] : [h.x - 2, GROUND - h.wh - 1];
        if (b[0] - a[0] > 20 && b[0] - a[0] < 140) {
          const items = [];
          for (let s = 0.14; s < 0.9; s += 0.16 + T.r() * 0.1) items.push({ s, kind: pick(["shirt", "sock", "johns", "towel"]), col: T.r() * CLOTH.length | 0 });
          T.lines.push({ ax: a[0], ay: a[1], bx: b[0], by: b[1], sag: 8, items, seed: T.r() * 6 });
        }
      }
      T.prev = h;
      T.x += h.w;
    }
    if (T.quiet) return;
    // the Gnattoes, the fermentation pest: airborne, and unfortunately sorted, so they hang in rows and columns that
    // always leave her a way through
    while (T.nextSwarm < to) {
      const d = T.nextSwarm / PXM, x = T.nextSwarm, gap = gapAt(d), span = SKY_BOTTOM - SKY_TOP;
      const add = (dx, y) => T.gnats.push({ x: x + dx, y, ph: T.r() * 6 });
      const column = (dx, gy) => { for (let y = SKY_TOP; y <= SKY_BOTTOM; y += 20) if (y < gy || y > gy + gap) add(dx, y); };
      const shapes = d < 80 ? ["one", "one", "pair", "bar"] : d < 250 ? ["one", "pair", "bar", "column", "diag"]
        : d < 600 ? ["pair", "bar", "column", "diag", "arc", "column"] : ["pair", "bar", "column", "diag", "arc", "gate", "column"];
      const kind = pick(shapes);
      if (kind === "one") add(0, SKY_TOP + 20 + T.r() * (span - 40));
      else if (kind === "pair") { const y = SKY_TOP + T.r() * (span - gap - 30); add(0, y); add(0, y + gap + T.r() * 30); }
      else if (kind === "bar") { const y = SKY_TOP + 10 + T.r() * (span - 60); for (let i = 0; i < 3; i++) add(0, y + i * 20); }
      else if (kind === "column") column(0, SKY_TOP + 10 + T.r() * (span - gap - 20));
      else if (kind === "diag") {
        const n = 4 + (T.r() * 2 | 0), y0 = SKY_TOP + 20 + T.r() * (span - 40 - (n - 1) * 22), up = T.r() < 0.5;
        for (let i = 0; i < n; i++) add(i * 24, up ? y0 + (n - 1 - i) * 22 : y0 + i * 22);
      } else if (kind === "arc") {
        const cy = SKY_TOP + 60 + T.r() * (span - 120), cup = T.r() < 0.5 ? 1 : -1;
        for (let i = 0; i < 5; i++) { const a = Math.PI * i / 4; add(46 - Math.cos(a) * 46, cy + cup * Math.sin(a) * 46); }
      } else {
        // a gate: two columns one after the other, the way through each at a different height
        const g1 = SKY_TOP + 10 + T.r() * (span - gap - 20);
        const g2 = Math.max(SKY_TOP + 10, Math.min(SKY_BOTTOM - gap - 10, g1 + (T.r() < 0.5 ? -1 : 1) * (70 + T.r() * 50)));
        column(0, g1); column(160, g2);
      }
      T.nextSwarm += Math.max(150, 300 - d / 5) + T.r() * 120 + ({ column: 60, gate: 230, diag: 100, arc: 90 }[kind] || 0);
    }
    // Bagrat on his rounds from 80 m, flying straight at her, and from 500 m now and then dipping as he goes
    while (T.nextBagrat < to) {
      const d = T.nextBagrat / PXM;
      T.flyers.push({ kind: "bagrat", x: T.nextBagrat, y: SKY_TOP + 30 + T.r() * (SKY_BOTTOM - SKY_TOP - 60), vx: -(18 + T.r() * 20), vy: 0,
                      face: -1, swoop: d > 500 && T.r() < 0.5 ? 16 + T.r() * 18 : 0, ph: T.r() * 6, t: 0 });
      T.nextBagrat += (d < 400 ? 760 : 520) + T.r() * 380;
    }
    // Jellybees from 150 m, buzzing through town learning a little wiggle; two together from 450 m
    while (T.nextJelly < to) {
      const d = T.nextJelly / PXM, n = d < 450 ? 1 : 1 + (T.r() < 0.5 ? 1 : 0), y = SKY_TOP + 50 + T.r() * (SKY_BOTTOM - SKY_TOP - 100);
      for (let i = 0; i < n; i++)
        T.flyers.push({ kind: "jellybee", x: T.nextJelly + i * 30, y: y + i * 26, vx: -(14 + T.r() * 18), vy: 0, face: -1,
                        amp: 18 + T.r() * 20, w: 2.2 + T.r() * 1.2, ph: T.r() * 6, t: 0 });
      T.nextJelly += (d < 450 ? 950 : 700) + T.r() * 450;
    }
  }
  // Bogar and Misery Peter come to her where she is, so they are called up by the distance and then move on the screen
  function visitors() {
    if (T.quiet) return;
    const has = k => T.flyers.some(f => f.kind === k);
    // Bogar, the FIZZCO cap sorter, a winged night beetle who hogs anything shiny: her balloons are shiny
    if (camX >= T.nextBogar && !has("bogar")) {
      T.flyers.push({ kind: "bogar", x: camX + W + 24, y: 80 + T.r() * 170, vx: 0, vy: 0, svx: -70, svy: 0, face: -1, state: "enter", st: 0, ph: T.r() * 6, t: 0 });
      T.nextBogar = camX + 2400 + T.r() * 1200;
    }
    // Misery Peter, the small displeased cloud that hangs over the rooftops, alone: he follows her about and rains
    if (camX >= T.nextPeter && !has("peter")) {
      const y = 74 + T.r() * 36;
      T.flyers.push({ kind: "peter", x: camX + W + 30, y, y0: y, vx: 0, vy: 0, svx: -45, svy: 0, face: 1, state: "enter", st: 0, rc: 0, ph: T.r() * 6, t: 0 });
      T.nextPeter = Infinity;
    }
  }
  // where a flyer is now: Bagrat and the Jellybees bob and wiggle by the clock, the others where they have flown
  function flyerPos(f) {
    if (f.kind === "bagrat") return [f.x, f.y + Math.sin(clock * 6 + f.ph) * 1.5 + (f.swoop ? Math.sin(clock * 1.4 + f.ph) * f.swoop : 0)];
    if (f.kind === "jellybee") return [f.x, f.y + Math.sin(clock * f.w + f.ph) * f.amp];
    return [f.x, f.y + Math.sin(clock * 2 + f.ph)];
  }
  function flyerSprite(f) {
    if (f.kind === "bagrat") return f.swoop && Math.cos(clock * 1.4 + f.ph) > 0.2 ? "bagrat_t-10" : "bagrat_t+00";
    if (f.kind === "jellybee") { const c = Math.cos(clock * f.w + f.ph); return c > 0.35 ? "jellybee_t-10" : c < -0.35 ? "jellybee_t+10" : "jellybee_t+00"; }
    if (f.kind === "bogar") return f.svy < -30 ? "bogar_t+08" : f.svy > 30 ? "bogar_t-08" : "bogar_t+00";
    return "peter";
  }
  // the ellipse a touch is measured against: its middle in the world, and its half-widths, a little inside its outline
  function hitOf(f) {
    const s = SPR[flyerSprite(f)], [x, y] = flyerPos(f);
    return [x + f.face * (s.hit[0] - s.anchor[0]), y + s.hit[1] - s.anchor[1], s.rx * 0.85, s.ry * 0.85];
  }
  const gnatY = gn => gn.y + Math.sin(clock * 5 + gn.ph) * 1.5 + Math.max(0, Math.sin(clock * 0.8 + gn.ph * 7) - 0.88) * 75;
  // Misery Peter's rain: where it falls, and how much it weighs on a cow under it
  function rainPull(x, y) {
    for (const f of T.flyers) {
      if (f.kind !== "peter" || !f.raining) continue;
      const [hx, hy] = hitOf(f);
      if (Math.abs(x - (hx - camX)) < 24 && y > hy) return 190;
    }
    return 0;
  }
  // a loose balloon comes up out of the street somewhere ahead of her and rises, drifting on the wind a little
  // slower than she does, so it crosses the screen on a slant
  function looseBalloon() {
    T.loose.push({ x: camX + W * (0.5 + T.r() * 0.55), y: GROUND + 8, vy: 40 + T.r() * 18, k: pick(KINDS), ph: T.r() * 6, gone: false, seen: false });
    T.nextLoose = 2.6 + T.r() * 1.8;
  }
  function prune() {
    const left = camX - 120;
    T.houses = T.houses.filter(h => h.x + h.w > left);
    T.lines = T.lines.filter(l => l.bx > left); T.gnats = T.gnats.filter(gn => gn.x > left);
    T.flyers = T.flyers.filter(f => {
      const sx = f.x - camX;
      if (f.kind === "bogar" || f.kind === "peter") {
        if (f.state === "leave" && (sx < -70 || f.y < -60)) { if (f.kind === "peter") T.nextPeter = camX + 2600 + T.r() * 1600; return false; }
        return true;
      }
      return sx > -80;
    });
    T.treats = T.treats.filter(t => !t.gone && t.y < GROUND + 12);
    // a balloon she let get away - up off the top, or off the left - ends the run of catches
    for (const l of T.loose) {
      if (l.gone) continue;
      const sx = l.x - camX;
      if (sx < W && sx > 0 && l.y < H) l.seen = true;
      if (l.y < -4 || sx < -20) { l.gone = true; if (l.seen && state === "play" && chain > 0) miss(); }
    }
    T.loose = T.loose.filter(l => !l.gone);
  }

  /* ---------- Edna ---------- */
  function newEdna() {
    E = { x: 96, y: 200, vx: 0, vy: 0, n: 6, inv: 0, tilt: 0, face: 1, slots: [] };
    const [kx, ky] = knot(0);
    for (const s of SLOTS) E.slots.push({ s, k: "bal_" + s, alive: true, x: kx + BUNCH[s][0], y: ky + BUNCH[s][1] });
  }
  // the knot on her yoke, where the strings are tied, on the screen; mirrored when she faces left
  function knot(tilt) {
    const f = SPR[tiltName(tilt)];
    return [E.x + E.face * (f.knot[0] - f.anchor[0]), E.y - f.anchor[1] + f.knot[1]];
  }
  function centreOf(b) {
    const s = SPR[b.k];
    return [b.x + s.centre[0] - s.anchor[0], b.y + s.centre[1] - s.anchor[1], s.r * 0.8];
  }
  function flap() {
    if (E.n <= 0) return;
    E.vy = Math.max(-VUP, E.vy - FLAP[E.n]);
    if (state === "play") audio.flap();
    for (const b of E.slots) if (b.alive) b.y += 1.2;               // the bunch takes the tug a beat late
  }

  /* ---------- touching things ---------- */
  // a circle (or an ellipse) on the screen against the town and the sky: the point it touched, or null
  function touch(cx, cy, rx, ry) {
    const wx = cx + camX;
    const inRect = (x0, y0, x1, y1) => { const nx = Math.max(x0, Math.min(wx, x1)), ny = Math.max(y0, Math.min(cy, y1)); return ((nx - wx) / rx) ** 2 + ((ny - cy) / ry) ** 2 < 1 ? [nx - camX, ny] : null; };
    for (const gn of T.gnats) {
      if (Math.abs(gn.x - wx) > rx + 8) continue;
      const gy = gnatY(gn);
      if (((gn.x - wx) / (rx + 6)) ** 2 + ((gy - cy) / (ry + 6)) ** 2 < 1) return [gn.x - camX, gy, "gnattoe"];
    }
    for (const f of T.flyers) {
      if (f.kind === "peter") continue;                // he judges, and delivers no verdict: only his rain weighs on her
      const [hx, hy, frx, fry] = hitOf(f);
      if (((hx - wx) / (rx + frx)) ** 2 + ((hy - cy) / (ry + fry)) ** 2 < 1) return [hx - camX, hy, f.kind, f];
    }
    for (const h of T.houses) {
      if (h.x - 3 > wx + rx || h.x + h.w + 3 < wx - rx) continue;
      for (let c = Math.floor(wx - rx); c <= Math.ceil(wx + rx); c++) {
        const top = roofAt(h, c);
        if (top === null) continue;
        const dx = c + 0.5 - wx;
        if (Math.abs(dx) >= rx) continue;
        if (cy + ry * Math.sqrt(1 - (dx / rx) * (dx / rx)) >= top) return [c - camX, top];
      }
      const ch = h.chimney, a = h.aerial;
      const hit = (ch && inRect(ch.x - 1, ch.top, ch.x + 8, ch.bottom)) || (a && inRect(a.x - 5, a.top, a.x + 6, a.base));
      if (hit) return hit;
    }
    for (const l of T.lines) {
      if (l.ax > wx + rx || l.bx < wx - rx) continue;
      const s = Math.max(0, Math.min(1, (wx - l.ax) / (l.bx - l.ax))), y = sagY(l.ay, l.by, l.sag, s);
      if (cy + ry >= y - 1 && cy - ry <= y + 11) return [cx, y];
    }
    return null;
  }
  // how far her body has sunk into a house: a house is solid, whatever the balloons are doing
  function sunk(cx, cy, rx, ry) {
    const wx = cx + camX;
    let over = 0;
    for (const h of T.houses) {
      if (h.x - 3 > wx + rx || h.x + h.w + 3 < wx - rx) continue;
      for (let c = Math.floor(wx - rx); c <= Math.ceil(wx + rx); c++) {
        const top = roofAt(h, c);
        if (top === null) continue;
        const dx = c + 0.5 - wx;
        if (Math.abs(dx) >= rx) continue;
        over = Math.max(over, cy + ry * Math.sqrt(1 - (dx / rx) * (dx / rx)) - top);
      }
    }
    return over;
  }
  // she touched something: the balloon nearest it goes
  function bump(at) {
    let best = null, bd = 1e9;
    for (const b of E.slots) {
      if (!b.alive) continue;
      const [cx, cy] = centreOf(b), d = (cx - at[0]) ** 2 + (cy - at[1]) ** 2;
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) return;
    best.alive = false; E.n--;
    const [cx, cy] = centreOf(best), col = HUE[best.k.slice(4)];
    for (let k = 0; k < 12; k++) {
      const a = Math.random() * Math.PI * 2, v = 30 + Math.random() * 70;
      fx.push({ x: cx + camX, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, g: 160, t: 0, life: 0.5 + Math.random() * 0.3, col, s: 2 });
    }
    const [kx, ky] = knot(E.tilt);
    fx.push({ string: true, x: kx + camX, y: ky, x2: best.x + camX, y2: best.y, vx: -10, vy: 20, g: 220, t: 0, life: 0.9 });
    pops.push({ s: "POP", x: cx + camX, y: cy - 6, t: 0, col: "#ffffff" });
    // each one sounds like itself, and Bogar, having had something shiny, goes
    if (at[2] === "gnattoe") audio.buzz(false);
    else if (at[2] === "jellybee") audio.buzz(true);
    else if (at[2] === "bagrat") audio.coo();
    else if (at[2] === "bogar") { audio.clicks(); at[3].state = "leave"; }
    audio.pop();
    shake = 0.18; E.inv = 1.4;
    // pushed away from what she touched
    const dx = E.x - at[0], dy = E.y - at[1], len = Math.hypot(dx, dy) || 1;
    E.vx += (dx / len) * 70; E.vy = Math.max(-VUP, Math.min(VDOWN, E.vy + (dy / len) * 90));
    hud();
    if (E.n === 1 && !said.one) { said.one = true; say("one"); audio.low(); }
    if (E.n === 0) { state = "falling"; stateT = 0; }
  }
  function miss() { chain = 0; mult = 1; hud(); }
  // one caught: into an empty place in her bunch, or for points when all six are up; each one in a row counts more
  function grab(l) {
    l.gone = true; caught++; chain++; bestChain = Math.max(bestChain, chain);
    const empty = E.slots.find(b => !b.alive);
    let pts;
    if (empty) {
      empty.alive = true; empty.k = "bal_" + l.k; E.n++;
      empty.x = l.x - camX; empty.y = l.y;
      pts = 50 * mult; audio.grab();
    } else { pts = 100 * mult; audio.full(); }
    bonus += pts;
    pops.push({ s: "+" + pts, x: l.x, y: l.y - 22, t: 0, col: "#f2d75c" });
    mult = Math.min(9, mult + 1);
    hud();
  }

  /* ---------- a run ---------- */
  function start() {
    audio.unlock();
    newTown((Math.random() * 4294967296) >>> 0);
    newEdna();
    camX = 0; speed = 70; score = 0; bonus = 0; metres = 0; caught = 0; chain = 0; bestChain = 0; mult = 1; fed = 0; said = {}; nextMile = 250; fx = []; pops = []; shake = 0;
    flapT = 0;
    state = "play"; stateT = 0;
    $("ready").hidden = true; $("over").hidden = true;
    say("start");
    hud();
  }
  function down() {
    state = "down"; stateT = 0;
    window.rvBuzz?.("over");
    audio.land();
    for (let k = 0; k < 10; k++) fx.push({ x: E.x + camX + (Math.random() - 0.5) * 30, y: E.y + BODY.feet, vx: (Math.random() - 0.5) * 50, vy: -10 - Math.random() * 30, g: 60, t: 0, life: 0.7, col: "#c9bfae", s: 2 });
    say("end");
  }
  function over() {
    state = "over"; stateT = 0;
    const isBest = score > bestScore;
    if (isBest) { bestScore = score; store.set("bestScore", bestScore); }
    if (metres > bestM) { bestM = metres; store.set("bestM", bestM); }
    $("over-title").textContent = "Boss Edna came down.";
    $("over-line").textContent = isBest ? "A new best. Nobody had asked her to." : "Nobody had asked her to.";
    $("over-stats").textContent = fmt(metres) + " m · " + fmt(score) + " points · " + caught + (caught === 1 ? " balloon" : " balloons") + " caught" + (bestChain > 1 ? ", " + bestChain + " in a row" : "") + (fed ? " · " + fed + (fed === 1 ? " treat" : " treats") : "") + " · best " + fmt(bestScore) + " points";
    $("over").hidden = false;
    hud();
  }

  /* ---------- the loop ---------- */
  function update(dt) {
    clock += dt; stateT += dt;
    const playing = state === "play", attract = state === "ready";
    const camV = state === "falling" ? speed * 0.4 : speed;
    if (playing || attract || state === "falling") {
      speed = 70 + 40 * Math.min(1, metres / 1500);
      camX += camV * dt;
      grow(camX + W + 300);
      visitors();
      if (state !== "falling" && (T.nextLoose -= dt) <= 0) looseBalloon();
      if (playing && metres > 20 && (T.nextTreat -= dt) <= 0) throwTreat();
      prune();
    }
    if (T) flyers(dt, camV);
    // the hands: steering, and a flap that keeps flapping while it is held
    let dir = 0, flapping = false;
    if (playing) { dir = (input.right.size ? 1 : 0) - (input.left.size ? 1 : 0); flapping = input.flap.size > 0; }
    if (attract) {
      // behind the first card a careful hand keeps her up and lets her wander
      dir = Math.sin(clock * 0.5) > 0.6 ? 1 : Math.sin(clock * 0.5) < -0.6 ? -1 : 0;
      flapping = E.y > 190 + Math.sin(clock * 0.7) * 40;
    }
    if (flapping) { flapT -= dt; if (flapT <= 0) { flap(); flapT = FLAP_EVERY; } } else flapT = 0;
    if (state !== "down") {
      E.vx = Math.max(-VXMAX, Math.min(VXMAX, (E.vx + dir * STEER * dt) * Math.exp(-HDRAG * dt)));
      E.x += E.vx * dt;
      if (E.x < 26) { E.x = 26; E.vx = Math.max(E.vx, 0); }
      if (E.x > W - 26) { E.x = W - 26; E.vx = Math.min(E.vx, 0); }
      if (dir) E.face = dir; else if (Math.abs(E.vx) > 25) E.face = Math.sign(E.vx);
      // under Misery Peter's rain the balloons are wet, and she is heavier
      const wet = rainPull(E.x, E.y);
      E.vy = Math.max(-VUP, Math.min(VDOWN, E.vy + (FALL[E.n] + wet) * dt));
      if (wet && Math.random() < dt * 14) fx.push({ x: E.x + camX + (Math.random() - 0.5) * 40, y: E.y - 40 - Math.random() * 30, vx: 0, vy: 60, g: 300, t: 0, life: 0.25, col: "#c4d4ec", s: 1 });
      E.y += E.vy * dt;
    }
    // a house holds her up, and a wall lifts her over it, quickly but not all at once
    if (playing || state === "falling") {
      const pen = sunk(E.x, E.y + BODY.dy, BODY.rx, BODY.ry);
      if (pen > 0) { E.y -= Math.min(pen, Math.max(1.5, 300 * dt)); if (E.vy > 0) E.vy = 0; if (pen > 8) E.vy = Math.min(E.vy, -60); }
    }
    const target = Math.max(-12, Math.min(12, -E.vy / 10));
    E.tilt = TILTS.reduce((p, t) => (Math.abs(t - target) < Math.abs(p - target) ? t : p), 0);
    // the top of the sky turns her back, the way Balloon Fight's ceiling does
    const topY = Math.min(E.y - 22, ...E.slots.filter(b => b.alive).map(b => centreOf(b)[1] - 11));
    if (topY < 4) { E.y += 4 - topY; E.vy = Math.max(E.vy, 40); }
    // the balloons on their strings, each drifting after its place above the knot, a little behind her
    const [kx, ky] = knot(E.tilt), follow = 1 - Math.exp(-dt * 9);
    E.slots.forEach((b, i) => {
      const sx = kx + BUNCH[b.s][0] * E.face + Math.sin(clock * 1.3 + i * 1.7) * 1.2 - E.vx * 0.04, sy = ky + BUNCH[b.s][1] + Math.cos(clock * 1.1 + i) + Math.max(0, E.vy) * 0.02;
      b.x += (sx - b.x) * follow; b.y += (sy - b.y) * follow;
    });
    if (E.inv > 0) E.inv -= dt;
    if (playing) {
      metres = Math.floor(camX / PXM);
      score = metres * 10 + bonus;
      if (E.y + BODY.feet >= GROUND) { E.y = GROUND - BODY.feet; down(); }
      else if (E.inv <= 0) {
        let hit = touch(E.x, E.y + BODY.dy, BODY.rx, BODY.ry);
        if (!hit) for (const b of E.slots) { if (!b.alive) continue; const [cx, cy, r] = centreOf(b); hit = touch(cx, cy, r, r); if (hit) break; }
        if (hit) bump(hit);
      }
      for (const l of T.loose) {
        if (l.gone) continue;
        // the middle of the loose balloon, not the knot at its foot
        const lx = l.x - camX, ly = looseY(l) - 11.7;
        let got = Math.abs(lx - E.x) < BODY.rx + 8 && Math.abs(ly - E.y) < BODY.ry + 10;
        for (const b of E.slots) { if (got || !b.alive) continue; const [cx, cy, r] = centreOf(b); got = (cx - lx) ** 2 + (cy - ly) ** 2 < (r + 9) ** 2; }
        if (got) grab(l);
      }
      // flying through Misery Peter does nothing to her; it only gets a grumble out of him
      for (const f of T.flyers) {
        if (f.kind !== "peter") continue;
        f.grumbleT = (f.grumbleT || 0) - dt;
        const [hx, hy, prx, pry] = hitOf(f);
        if (f.grumbleT <= 0 && ((hx - camX - E.x) / (prx + 18)) ** 2 + ((hy - (E.y - 40)) / (pry + 42)) ** 2 < 1) { audio.grumble(); f.grumbleT = 2; }
      }
      // a treat lands in her mouth if it comes down anywhere near her face
      for (const t of T.treats) {
        if (t.gone) continue;
        const tx = t.x - camX;
        if (((tx - (E.x + E.face * 10)) / (BODY.rx + 6)) ** 2 + ((t.y - E.y) / (BODY.ry + 6)) ** 2 < 1) eat(t);
      }
      if (metres >= nextMile) { audio.cowbell(); banner(fmt(nextMile) + " m", 1.6); nextMile += 250; }
      if (!said.best && bestM >= 50 && metres > bestM) { said.best = true; say("best"); window.rvBuzz?.("good"); }
    } else if (state === "falling") {
      if (E.y + BODY.feet >= GROUND) { E.y = GROUND - BODY.feet; down(); }
      else if (sunk(E.x, E.y + BODY.dy + 1, BODY.rx, BODY.ry) > 0) down();
    } else if (state === "down" && stateT > 2.4) over();
    if (T) {
      for (const l of T.loose) { l.x += camV * 0.55 * dt; l.y -= l.vy * dt; }
      for (const t of T.treats) { t.t += dt; t.x += t.vx * dt; t.y += t.vy * dt; t.vy += TREAT_G * dt; }
      for (const h of T.houses) if (h.throwT > 0) h.throwT -= dt;
    }
    for (const p of fx) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.g * dt; if (p.string) { p.x2 += p.vx * dt; p.y2 += p.vy * dt; } }
    fx = fx.filter(p => p.t < p.life);
    for (const p of pops) p.t += dt;
    pops = pops.filter(p => p.t < 1.1);
    if (shake > 0) shake -= dt;
    audio.wind(state === "play" ? Math.min(1, Math.hypot(E.vx, E.vy) / 180 + 0.25) : attract ? 0.15 : 0);
  }
  const looseY = l => l.y + Math.sin(clock * 1.6 + l.ph) * 2;
  // the flyers move: Bagrat and the Jellybees straight on, Bogar and Misery Peter after her on the screen
  function flyers(dt, camV) {
    for (const f of T.flyers) {
      f.t += dt;
      if (f.kind === "bagrat" || f.kind === "jellybee") { f.x += f.vx * dt; continue; }
      f.st += dt;
      const sx = f.x - camX;
      if (f.kind === "bogar") {
        if (f.state === "enter") { f.svx = -70; f.svy = 0; if (f.st > 0.9) { f.state = "eye"; f.st = 0; if (state === "play") audio.clicks(); } }
        else if (f.state === "eye") { f.svx *= Math.exp(-dt * 6); f.svy *= Math.exp(-dt * 6); if (f.st > 0.7) { f.state = "chase"; f.st = 0; } }
        else if (f.state === "chase") {
          // after the middle of her bunch, turning no faster than a beetle can
          const alive = E.slots.filter(b => b.alive).map(centreOf);
          const tx = alive.length ? alive.reduce((a, c) => a + c[0], 0) / alive.length : E.x, ty = alive.length ? alive.reduce((a, c) => a + c[1], 0) / alive.length : E.y;
          const [hx, hy] = hitOf(f), dx = tx - (hx - camX), dy = ty - hy, len = Math.hypot(dx, dy) || 1;
          const step = 240 * dt;
          f.svx += Math.max(-step, Math.min(step, dx / len * 88 - f.svx));
          f.svy += Math.max(-step, Math.min(step, dy / len * 88 - f.svy));
          if (f.st > 3.2 || state !== "play") { f.state = "leave"; f.st = 0; }
        } else { f.svx += (-50 - f.svx) * Math.min(1, dt * 3); f.svy += (-90 - f.svy) * Math.min(1, dt * 3); }
        if (Math.abs(f.svx) > 8) f.face = Math.sign(f.svx);
      } else {
        // Misery Peter: drifts in, then keeps over her for a while, dry, darkening, raining, dry again; then goes
        if (f.state === "enter") { f.svx = -45; if (sx <= Math.max(60, Math.min(210, E.x))) { f.state = "watch"; f.st = 0; } }
        else if (f.state === "watch") {
          f.svx = Math.max(-32, Math.min(32, (E.x - sx) * 0.8));
          f.rc += dt;
          const ph = f.rc % 5.4;
          f.dark = ph >= 2.2; f.raining = ph >= 3.0;
          if (f.dark && !f.rumbled) { f.rumbled = true; if (state === "play") audio.rumble(); }
          if (!f.dark) f.rumbled = false;
          if (f.st > 13) { f.state = "leave"; f.st = 0; f.dark = f.raining = false; }
        } else { f.svx = -55; f.svy = -15; }
        f.svy = f.state === "leave" ? -15 : (f.y0 - f.y) * 0.5;
      }
      f.vx = f.svx + camV; f.vy = f.svy;
      f.x += f.vx * dt; f.y += f.vy * dt;
    }
    audio.rain(T.flyers.some(f => f.raining) && state === "play" ? 1 : 0);
  }
  // a lit window ahead of her opens, somebody leans out, and up comes a treat, thrown to come down by her
  const TREAT_G = 320;
  function throwTreat() {
    T.nextTreat = 3.5 + T.r() * 3;
    const wins = [];
    for (const h of T.houses) for (const wi of h.wins) {
      const sx = h.x + wi.dx + 3 - camX;
      if (wi.lit && sx > E.x + 40 && sx < W - 12) wins.push([h, wi]);
    }
    if (!wins.length) { T.nextTreat = 0.8; return; }
    const [h, wi] = pick(wins), wx = h.x + wi.dx + 3, wy = GROUND - h.wh + wi.dy + 2;
    const peak = Math.max(110, Math.min(wy - 70, E.y - 30 + T.r() * 50));
    const vy = -Math.sqrt(2 * TREAT_G * (wy - peak)), up = -vy / TREAT_G;
    const aim = E.x + (T.r() - 0.5) * 50;
    T.treats.push({ x: wx, y: wy, vx: Math.max(-60, Math.min(220, (aim - (wx - camX)) / up + speed)), vy, k: pick(Object.keys(TREATS)), t: 0, gone: false });
    h.throwT = 0.45; h.throwWin = wi;
    audio.toss();
  }
  function eat(t) {
    t.gone = true; fed++;
    bonus += 30;
    pops.push({ s: "+30", x: t.x, y: t.y - 12, t: 0, col: "#f0e3c2" });
    audio.munch();
  }

  /* ---------- drawing ---------- */
  function spr(name, x, y, alpha, face = 1) {
    const s = SPR[name];
    if (!s) return;
    const [sx, sy, w, h] = s.xywh;
    if (alpha !== undefined) g.globalAlpha = alpha;
    if (face < 0) {
      g.save(); g.translate(Math.round(x + s.anchor[0]), 0); g.scale(-1, 1);
      g.drawImage(atlas, sx, sy, w, h, 0, Math.round(y - s.anchor[1]), w, h);
      g.restore();
    } else g.drawImage(atlas, sx, sy, w, h, Math.round(x - s.anchor[0]), Math.round(y - s.anchor[1]), w, h);
    if (alpha !== undefined) g.globalAlpha = 1;
  }
  function string(x0, y0, x1, y1, col) {
    g.strokeStyle = col; g.lineWidth = 1;
    g.beginPath(); g.moveTo(Math.round(x0) + 0.5, Math.round(y0) + 0.5);
    g.quadraticCurveTo((x0 + x1) / 2 + (y1 - y0) * 0.05, (y0 + y1) / 2, Math.round(x1) + 0.5, Math.round(y1) + 0.5); g.stroke();
  }
  // the treats, each painted once and turned a quarter at a time as it flies
  let TREAT_IMG = {};
  function paintTreats() {
    for (const [k, tr] of Object.entries(TREATS)) {
      const c0 = document.createElement("canvas");
      c0.width = tr.m[0].length; c0.height = tr.m.length;
      bitmap(c0.getContext("2d"), tr.m, tr.pal, 0, 0);
      TREAT_IMG[k] = c0;
    }
  }
  // Misery Peter darker, for the rain coming
  let PETER_DARK = null;
  function paintPeter() {
    const s = SPR.peter, [sx, sy, w, h] = s.xywh, c0 = document.createElement("canvas");
    c0.width = w; c0.height = h;
    const c = c0.getContext("2d");
    c.drawImage(atlas, sx, sy, w, h, 0, 0, w, h);
    const d = c.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) { d.data[i] *= 0.55; d.data[i + 1] *= 0.56; d.data[i + 2] *= 0.68; }
    c.putImageData(d, 0, 0);
    PETER_DARK = c0;
  }
  function drawFlyer(f) {
    const [x, y] = flyerPos(f), sx = x - camX;
    if (sx < -60 || sx > W + 60) return;
    if (f.kind === "peter" && f.dark) {
      const s = SPR.peter;
      g.drawImage(PETER_DARK, Math.round(sx - s.anchor[0]), Math.round(y - s.anchor[1]));
    } else spr(flyerSprite(f), sx, y, undefined, f.face);
    // Bogar has seen something shiny
    if (f.kind === "bogar" && f.state === "eye" && Math.floor(f.st * 10) % 2 === 0) {
      g.font = "16px VT323, monospace"; g.textAlign = "center";
      g.fillStyle = "#000"; g.fillText("!", Math.round(sx) + 1, Math.round(y) - 17);
      g.fillStyle = "#f2d75c"; g.fillText("!", Math.round(sx), Math.round(y) - 18);
    }
  }
  function rain(f) {
    const [hx, hy] = hitOf(f), x0 = Math.round(hx - camX), y0 = Math.round(hy) + 10, len = GROUND - y0;
    g.fillStyle = "rgba(196, 212, 236, 0.75)";
    for (let i = 0; i < 18; i++) {
      const x = x0 - 22 + ((i * 37 + Math.floor(clock * 30) * 7) % 45), y = y0 + ((clock * 280 + i * 53) % len);
      g.fillRect(x, Math.round(y), 1, 5);
    }
  }
  function draw() {
    const sx = shake > 0 ? Math.round((Math.random() - 0.5) * 4) : 0, sy = shake > 0 ? Math.round((Math.random() - 0.5) * 3) : 0;
    g.save(); g.translate(sx, sy);
    g.drawImage(SKY, 0, 0);
    g.fillStyle = "rgba(244, 196, 186, 0.32)";
    for (const [u, y, w] of [[60, 168, 92], [260, 214, 64], [420, 132, 70]]) { const x = Math.round(((u - camX * 0.04) % 520 + 520) % 520 - 90); g.fillRect(x, y, w, 2); g.fillRect(x + 20, y + 4, w - 22, 1); }
    for (const [hz, par] of [[HAZE[0], 0.15], [HAZE[1], 0.32]]) {
      const off = ((camX * par) % hz.L + hz.L) % hz.L;
      g.drawImage(hz.c, -Math.round(off), hz.base - 140);
      g.drawImage(hz.c, Math.round(hz.L - off), hz.base - 140);
    }
    if (T) {
      for (const h of T.houses) {
        const x = Math.round(h.x - camX - h.pad);
        if (x > W || x + h.img.width < 0) continue;
        g.drawImage(h.img, x, GROUND - h.img.height);
        if (h.chimney && h.chimney.smoke) smoke(h, clock);
        // somebody at a lit window, leaning out to throw her something
        if (h.throwT > 0) {
          const wx = Math.round(h.x - camX + h.throwWin.dx), wy = GROUND - h.wh + h.throwWin.dy;
          g.fillStyle = LIT[1]; g.fillRect(wx, wy, 6, 8);
          g.fillStyle = "#3a2b2a"; g.fillRect(wx + 1, wy + 3, 4, 5); g.fillRect(wx + 2, wy + 2, 2, 1);
          // the arm out over the sill, up and then a little higher as the thing leaves the hand
          const lift = h.throwT > 0.3 ? 4 : 7;
          g.fillStyle = "#2a2024"; g.fillRect(wx + 3, wy + 3 - lift, 1, lift + 1); g.fillRect(wx + 3, wy + 2 - lift, 4, 1);
          g.fillStyle = "#e2b48c"; g.fillRect(wx + 4, wy + 3 - lift, 2, lift + 1);
          g.fillStyle = "#f2cfa8"; g.fillRect(wx + 4, wy + 3 - lift, 2, 1);
        }
      }
      for (const l of T.lines) {
        const ax = l.ax - camX, bx = l.bx - camX;
        if (bx < -20 || ax > W + 20) continue;
        curve(ax, l.ay, bx, l.by, l.sag, "#3b3340");
        for (const it of l.items) {
          const qx = Math.round(ax + (bx - ax) * it.s), qy = Math.round(sagY(l.ay, l.by, l.sag, it.s)), sway = Math.round(Math.sin(clock * 2.2 + it.s * 9 + l.seed));
          bitmap(g, LAUNDRY[it.kind], CLOTH[it.col], qx - (LAUNDRY[it.kind][0].length >> 1) + sway, qy + 1);
          dot(g, qx - 1, qy, "#e8e2d4"); dot(g, qx + 1, qy, "#e8e2d4");
        }
      }
    }
    // the street
    g.fillStyle = "#3a3540"; g.fillRect(0, GROUND, W, H - GROUND);
    g.fillStyle = "#6b6370"; g.fillRect(0, GROUND, W, 1);
    g.fillStyle = "#2c2832";
    for (let x = -(Math.round(camX) % 22); x < W; x += 22) g.fillRect(x, GROUND + 7, 10, 1);
    if (T) {
      for (const l of T.loose) {
        if (l.gone) continue;
        const x = l.x - camX, y = looseY(l);
        if (x < -20 || x > W + 20) continue;
        string(x, y, x - 2 + Math.sin(clock * 2 + l.ph) * 2, y + 16, "rgba(240,227,194,0.8)");
        spr("bal_" + l.k, x, y);
      }
      for (const t of T.treats) {
        if (t.gone) continue;
        const img = TREAT_IMG[t.k], q = Math.floor(t.t * 8) % 4;
        g.save(); g.translate(Math.round(t.x - camX), Math.round(t.y)); g.rotate(q * Math.PI / 2);
        g.drawImage(img, -(img.width >> 1), -(img.height >> 1)); g.restore();
      }
      for (const f of T.flyers) if (f.raining) rain(f);
      for (const f of T.flyers) if (f.kind === "peter") drawFlyer(f);
      for (const gn of T.gnats) {
        const x = gn.x - camX;
        if (x > -14 && x < W + 14) spr((Math.floor(clock * 10 + gn.ph * 4) & 1) ? "gnattoe_t-08" : "gnattoe_t+08", x, gnatY(gn), undefined, -1);
      }
      for (const f of T.flyers) if (f.kind !== "peter") drawFlyer(f);
    }
    if (E) {
      const blink = E.inv > 0 && state === "play" && Math.floor(E.inv * 10) % 2 === 0 ? 0.45 : undefined;
      const [kx, ky] = knot(E.tilt);
      for (const b of E.slots) if (b.alive) string(kx, ky, b.x, b.y, "#4a3428");
      for (const b of E.slots) if (b.alive) spr(b.k, b.x, b.y, blink);
      spr(tiltName(E.tilt), E.x, E.y, blink, E.face);
    }
    for (const p of fx) {
      g.globalAlpha = Math.max(0, 1 - p.t / p.life);
      if (p.string) string(p.x - camX, p.y, p.x2 - camX, p.y2, "#4a3428");
      else { g.fillStyle = p.col; g.fillRect(Math.round(p.x - camX), Math.round(p.y), p.s, p.s); }
      g.globalAlpha = 1;
    }
    g.font = "16px VT323, monospace"; g.textAlign = "center";
    for (const p of pops) {
      g.globalAlpha = Math.max(0, 1 - p.t / 1.1);
      g.fillStyle = "#000"; g.fillText(p.s, Math.round(p.x - camX) + 1, Math.round(p.y - p.t * 18) + 1);
      g.fillStyle = p.col; g.fillText(p.s, Math.round(p.x - camX), Math.round(p.y - p.t * 18)); g.globalAlpha = 1;
    }
    g.restore();
  }

  /* ---------- the screen's words ---------- */
  function hud() {
    $("score").textContent = fmt(score);
    $("dist").textContent = fmt(metres) + " m";
    $("mult").textContent = mult > 1 ? "x" + mult : "";
    $("best").textContent = "Best " + fmt(bestM) + " m";
    const n = E ? E.n : 6;
    $("balloons").setAttribute("aria-label", n + (n === 1 ? " balloon" : " balloons"));
    // one icon to a place in her bunch, in the colour of whatever balloon is in it, dim while it is empty
    [...$("balloons").children].forEach((el, i) => {
      const b = E && E.slots[i];
      el.classList.toggle("gone", b ? !b.alive : false);
      if (b) el.style.setProperty("--c", HUE[b.k.slice(4)]);
    });
  }
  let bannerTimer = 0;
  function banner(text, sec) {
    const el = $("banner");
    el.textContent = text;
    el.classList.remove("on", "hold");
    void el.offsetWidth;
    el.style.animationDuration = sec + "s";
    el.classList.add("on");
    clearTimeout(bannerTimer);
  }
  let subTimer = 0;
  function say(k) {
    $("sub").textContent = LINES[k];
    clearTimeout(subTimer);
    audio.line(k).then(d => { subTimer = setTimeout(() => { $("sub").textContent = ""; }, (Math.max(d, 1.8) + 0.6) * 1000); });
  }

  /* ---------- sound: the bed, four lines, the rest made on the spot ---------- */
  const audio = {
    ctx: null, on: store.get("sound", true), raw: {}, buf: {}, music: null,
    fetch() {
      for (const [k, f] of [["start", "assets/line-start.mp3"], ["one", "assets/line-one.mp3"], ["best", "assets/line-best.mp3"],
                            ["end", "assets/line-end.mp3"], ["music", "assets/whistle-walk.mp3"]]) {
        this.raw[k] = fetch(f).then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
      }
    },
    unlock() {
      if (this.ctx) { this.ctx.resume(); return; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch (e) { /* older Safari */ }
      const c = (this.ctx = new AC());
      c.resume();
      this.master = c.createGain(); this.master.gain.value = this.on ? 1 : 0; this.master.connect(c.destination);
      this.fxg = c.createGain(); this.fxg.gain.value = 0.5; this.fxg.connect(this.master);
      this.mus = c.createGain(); this.mus.gain.value = 0.24; this.mus.connect(this.master);
      this.vox = c.createGain(); this.vox.gain.value = 1; this.vox.connect(this.master);
      const n = c.createBuffer(1, c.sampleRate, c.sampleRate), d = n.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = n;
      // the air going past her: soft noise that rises as she moves faster
      const s = c.createBufferSource(), bp = c.createBiquadFilter(), gn = c.createGain();
      s.buffer = n; s.loop = true; bp.type = "bandpass"; bp.frequency.value = 500; bp.Q.value = 0.6; gn.gain.value = 0;
      s.connect(bp).connect(gn).connect(this.fxg); s.start();
      this.windGain = gn; this.windBp = bp;
      // the rain under Misery Peter: a hiss, silent until he rains
      const rs = c.createBufferSource(), rb = c.createBiquadFilter(), rg = c.createGain();
      rs.buffer = n; rs.loop = true; rb.type = "bandpass"; rb.frequency.value = 2600; rb.Q.value = 0.5; rg.gain.value = 0;
      rs.connect(rb).connect(rg).connect(this.fxg); rs.start(0, 0.37);
      this.rainGain = rg;
      for (const k of Object.keys(this.raw)) {
        this.buf[k] = this.raw[k].then(b => (b ? new Promise(ok => {
          const p = c.decodeAudioData(b, ok, () => ok(null));
          if (p && p.catch) p.catch(() => ok(null));
        }) : null)).catch(() => null);
      }
      this.buf.music.then(b => {
        if (!b || this.music) return;
        const m = c.createBufferSource(); m.buffer = b; m.loop = true; m.connect(this.mus); m.start(); this.music = m;
      });
    },
    set(on) { this.on = on; store.set("sound", on); if (this.master) this.master.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.04); },
    line(k) {
      if (!this.ctx) return Promise.resolve(0);
      return this.buf[k].then(b => {
        if (!b) return 0;
        const c = this.ctx, s = c.createBufferSource(); s.buffer = b; s.connect(this.vox); s.start();
        this.mus.gain.setTargetAtTime(0.1, c.currentTime, 0.08);
        this.mus.gain.setTargetAtTime(0.24, c.currentTime + b.duration + 0.2, 0.3);
        return b.duration;
      });
    },
    tone(f0, f1, dur, type = "square", vol = 0.12, when = 0) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), e = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      e.gain.setValueAtTime(0.0008, t); e.gain.exponentialRampToValueAtTime(vol, t + 0.01); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(e).connect(this.fxg); o.start(t); o.stop(t + dur + 0.03);
    },
    noise(dur, vol, lo, hi, when = 0) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), a = c.createBiquadFilter(), b = c.createBiquadFilter(), e = c.createGain();
      s.buffer = this.noiseBuf; s.loop = true; a.type = "highpass"; a.frequency.value = lo; b.type = "lowpass"; b.frequency.value = hi;
      e.gain.setValueAtTime(vol, t); e.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      s.connect(a).connect(b).connect(e).connect(this.fxg); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
    },
    wind(k) {
      if (!this.windGain) return;
      const t = this.ctx.currentTime;
      this.windGain.gain.setTargetAtTime(k * 0.08, t, 0.15);
      this.windBp.frequency.setTargetAtTime(380 + k * 520, t, 0.2);
    },
    // a flap: a breath of air and a small wooden creak from the yoke as it takes the strain
    flap() { this.noise(0.14, 0.026, 500, 2200); this.tone(150, 210, 0.08, "triangle", 0.018); },
    // a balloon goes: the bang, the rubber snapping back, a thump in the chest
    pop() { this.noise(0.07, 0.34, 1400, 9000); this.tone(170, 60, 0.09, "sine", 0.16); this.tone(900, 380, 0.05, "square", 0.03); },
    // a Gnattoe touched: a short fermented hum; a Jellybee: the same, higher, and wobbling
    buzz(high) {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime, o = c.createOscillator(), lf = c.createOscillator(), lg = c.createGain(), lp = c.createBiquadFilter(), e = c.createGain();
      o.type = "sawtooth"; o.frequency.value = high ? 330 : 160; lf.frequency.value = high ? 22 : 30; lg.gain.value = high ? 40 : 18;
      lf.connect(lg).connect(o.frequency); lp.type = "lowpass"; lp.frequency.value = high ? 2400 : 1200;
      e.gain.setValueAtTime(0.0008, t); e.gain.exponentialRampToValueAtTime(0.06, t + 0.02); e.gain.exponentialRampToValueAtTime(0.0008, t + 0.22);
      o.connect(lp).connect(e).connect(this.fxg); o.start(t); lf.start(t); o.stop(t + 0.25); lf.stop(t + 0.25);
    },
    // Bogar speaks in clicks; Bagrat is a pigeon; Misery Peter grumbles, rumbles before the rain, and rains
    clicks() { for (const w of [0, 0.07, 0.16]) this.noise(0.02, 0.18, 1800, 6000, w); },
    coo() { this.tone(520, 400, 0.12, "sine", 0.07); this.tone(470, 360, 0.16, "sine", 0.07, 0.15); },
    grumble() { this.noise(0.35, 0.12, 40, 320); this.tone(70, 50, 0.3, "sine", 0.08); },
    rumble() { this.noise(0.9, 0.08, 30, 220); this.tone(55, 40, 0.8, "sine", 0.05); },
    rain(k) { if (this.rainGain) this.rainGain.gain.setTargetAtTime(k * 0.05, this.ctx.currentTime, 0.3); },
    // a treat thrown up from a window, and a cow eating it
    toss() { this.noise(0.2, 0.04, 700, 2600); },
    munch() { for (const w of [0, 0.09, 0.19]) this.noise(0.06, 0.14, 300, 1800, w); this.tone(200, 150, 0.08, "triangle", 0.03, 0.05); },
    // one caught: a rubbery squeak and a bright little ring; with all six up, a run of notes
    grab() { this.tone(820, 1240, 0.12, "sine", 0.07); this.tone(1240, 1100, 0.1, "triangle", 0.045, 0.1); this.noise(0.05, 0.04, 2000, 6000); },
    full() { [784, 988, 1175, 1568].forEach((f, k) => this.tone(f, f, 0.14, "triangle", 0.06, k * 0.06)); },
    low() { this.tone(440, 440, 0.1, "square", 0.035); this.tone(440, 440, 0.1, "square", 0.035, 0.18); },
    // a cowbell every hundred metres: two square partials through a narrow band, gone fast
    cowbell() {
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime, bp = c.createBiquadFilter(), e = c.createGain();
      bp.type = "bandpass"; bp.frequency.value = 2600; bp.Q.value = 1.2;
      e.gain.setValueAtTime(0.0008, t); e.gain.exponentialRampToValueAtTime(0.32, t + 0.004);
      e.gain.exponentialRampToValueAtTime(0.06, t + 0.06); e.gain.exponentialRampToValueAtTime(0.0008, t + 0.55);
      bp.connect(e).connect(this.fxg);
      for (const f of [540, 800]) { const o = c.createOscillator(); o.type = "square"; o.frequency.value = f; o.connect(bp); o.start(t); o.stop(t + 0.6); }
    },
    // she comes down: a soft thump on the roof or the street, and a long moo
    land() {
      this.tone(130, 50, 0.22, "sine", 0.2); this.noise(0.2, 0.08, 80, 900);
      if (!this.ctx) return;
      const c = this.ctx, t = c.currentTime + 0.25, o = c.createOscillator(), lp = c.createBiquadFilter(), e = c.createGain(), v = c.createOscillator(), vg = c.createGain();
      o.type = "sawtooth"; o.frequency.setValueAtTime(128, t); o.frequency.linearRampToValueAtTime(162, t + 0.35); o.frequency.linearRampToValueAtTime(118, t + 1.1);
      v.frequency.value = 5.5; vg.gain.value = 3; v.connect(vg).connect(o.frequency);
      lp.type = "lowpass"; lp.frequency.setValueAtTime(420, t); lp.frequency.linearRampToValueAtTime(820, t + 0.3); lp.frequency.linearRampToValueAtTime(380, t + 1.1); lp.Q.value = 5;
      e.gain.setValueAtTime(0.0008, t); e.gain.exponentialRampToValueAtTime(0.16, t + 0.12); e.gain.setValueAtTime(0.16, t + 0.8); e.gain.exponentialRampToValueAtTime(0.0008, t + 1.25);
      o.connect(lp).connect(e).connect(this.fxg); o.start(t); v.start(t); o.stop(t + 1.3); v.stop(t + 1.3);
    },
  };
  // on a phone, these sounds buzz in the hand too (../../assets/buzz.js)
  window.rvBuzz?.on(audio, { pop: "hit", grab: "tap", full: "good", low: "tap", cowbell: "tap", munch: "tap" });
  audio.fetch();

  /* ---------- input: steer left and right, and flap; a held flap keeps flapping ---------- */
  const KEYS = { ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right", ArrowUp: "flap", KeyW: "flap", Space: "flap" };
  function padState() {
    for (const b of document.querySelectorAll(".sb-pad button")) b.classList.toggle("on", input[b.dataset.d].size > 0);
  }
  addEventListener("keydown", e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const d = KEYS[e.code];
    if (d) {
      if (state === "play") { e.preventDefault(); input[d].add("k" + e.code); padState(); }
      else if (state === "pause") { e.preventDefault(); pause(false); }
      else if ((state === "ready" || (state === "over" && !$("over").hidden)) && (e.target === document.body || e.code !== "Space")) {
        e.preventDefault(); start(); input[d].add("k" + e.code); padState();
      }
    } else if (e.code === "KeyP" || e.code === "Escape") {
      if (state === "play" || state === "pause") { e.preventDefault(); pause(state === "play"); }
    } else if (e.code === "Enter" && (state === "ready" || state === "over") && e.target === document.body) {
      e.preventDefault(); start();
    }
  });
  addEventListener("keyup", e => { const d = KEYS[e.code]; if (d && input[d].delete("k" + e.code)) padState(); });
  // on the screen itself a finger is a flap, held to keep flapping
  cv.addEventListener("pointerdown", e => {
    if (state === "pause") { pause(false); return; }
    if (state !== "play") return;
    input.flap.add("s" + e.pointerId);
    try { cv.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
    e.preventDefault();
  });
  const lift = e => { input.flap.delete("s" + e.pointerId); };
  cv.addEventListener("pointerup", lift);
  cv.addEventListener("pointercancel", lift);
  cv.addEventListener("lostpointercapture", lift);
  for (const b of document.querySelectorAll(".sb-pad button")) {
    const d = b.dataset.d, id = "p" + d;
    b.addEventListener("pointerdown", e => {
      e.preventDefault();
      if (state === "ready" || state === "over") start();
      if (state === "pause") pause(false);
      input[d].add(id + e.pointerId);
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* old browsers */ }
      padState();
    });
    const up = e => { if (input[d].delete(id + e.pointerId)) padState(); };
    b.addEventListener("pointerup", up);
    b.addEventListener("pointercancel", up);
    b.addEventListener("lostpointercapture", up);
    b.addEventListener("contextmenu", e => e.preventDefault());
  }
  $("play").addEventListener("click", start);
  $("again").addEventListener("click", start);
  $("share").addEventListener("click", async () => {
    const url = "https://rotville.world/games/six-balloons/";
    const t = "Boss Edna drifted " + fmt(metres) + " m over the rooftops of Rotville" + (caught ? " and caught " + caught + (caught === 1 ? " balloon" : " balloons") : "") + ". Nobody has asked her to come back.";
    const label = $("share").querySelector(".tape-label");
    if (navigator.share) {
      try { await navigator.share({ title: "Six Balloons", text: t, url }); return; } catch (err) { if (err && err.name === "AbortError") return; }
    }
    try { await navigator.clipboard.writeText(t + " " + url); label.textContent = "Copied"; } catch (err) { label.textContent = "Could not copy"; }
    setTimeout(() => { label.textContent = "Share"; }, 1600);
  });
  const soundBtn = $("sound");
  const sayVolume = () => {
    soundBtn.setAttribute("aria-pressed", String(audio.on));
    soundBtn.setAttribute("aria-label", audio.on ? "Sound on" : "Sound off");
    soundBtn.querySelector(".tape-label").textContent = audio.on ? "Sound: on" : "Sound: off";
  };
  soundBtn.addEventListener("click", () => { audio.set(!audio.on); sayVolume(); });
  sayVolume();
  function pause(on) {
    if (on && state === "play") {
      state = "pause"; banner("PAUSED", 1); $("banner").classList.remove("on"); $("banner").classList.add("hold");
      for (const k in input) input[k].clear();
      padState();
      if (audio.ctx) audio.ctx.suspend();
    } else if (!on && state === "pause") {
      state = "play"; $("banner").classList.remove("hold");
      if (audio.ctx) audio.ctx.resume();
    }
  }
  addEventListener("blur", () => pause(true));
  document.addEventListener("visibilitychange", () => { if (document.hidden) pause(true); });

  /* ---------- load, and a drift already going behind the first card ---------- */
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));   // a frame can be stamped before the clock started
    last = now;
    if (!atlas) return;
    if (state === "play" || state === "ready" || state === "falling" || state === "down") update(dt);
    else clock += dt;
    if (state === "play") hud();
    draw();
  }
  Promise.all([
    fetch("assets/scene.json").then(r => r.json()),
    new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = "assets/sprites.png"; }),
  ]).then(([scene, img]) => {
    SPR = scene.sprites; atlas = img;
    paintSky(); paintTreats(); paintPeter();
    newTown(11, true);
    newEdna();
    camX = 0;
    state = "ready";
    hud();
  }).catch(() => { $("sub").textContent = "The picture did not come through. Reload to try again."; });
  requestAnimationFrame(frame);
})();
