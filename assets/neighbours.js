/* Changing channel between the games. A neighbour's link (each game page has its two in its HTML, written by the
   Rotville repo's tools/site/neighbours.py) puts static over this set with the next channel's number already in
   its corner, then goes; the next page starts in static and tunes in, from the ch-in class its head sets when it
   finds the note left here. With reduced motion it simply goes. */
(() => {
  const root = document.documentElement;
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const screen = document.querySelector("main .tv-screen");
  const corner = screen && [...screen.querySelectorAll(".osd")].find(o => /^CH\s/.test(o.textContent));
  const was = corner && corner.textContent;

  document.addEventListener("click", e => {
    const a = e.target.closest && e.target.closest(".nb-link");
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || still.matches) return;
    e.preventDefault();
    try { sessionStorage.setItem("rv.ch", "1"); } catch (err) { /* no storage: the next page opens without static */ }
    if (corner && a.dataset.ch) corner.textContent = "CH " + a.dataset.ch;
    root.classList.add("ch-out");
    setTimeout(() => location.assign(a.href), 340);
  });

  // back from the next channel, the browser may bring this page back exactly as it was left: mid-change
  addEventListener("pageshow", e => {
    if (!e.persisted) return;
    root.classList.remove("ch-out", "ch-in");
    if (corner) corner.textContent = was;
  });
  if (root.classList.contains("ch-in")) setTimeout(() => root.classList.remove("ch-in"), 800);
})();
