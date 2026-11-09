/* =====================================================================
   rishikeshvarma.fun: core behaviour
   nav · reveal · marquees · back-to-top button · typing rotator ·
   custom cursor · tilt cards · copy email · ".fun" easter egg
   ===================================================================== */
(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const RV = (window.RV = { reduced, finePointer, heroVis: 1, listeners: {} });

  RV.on = (ev, fn) => (RV.listeners[ev] = RV.listeners[ev] || []).push(fn);
  RV.emit = (ev, data) => (RV.listeners[ev] || []).forEach((fn) => fn(data));

  /** Run fn(dt, t) on animation frames only while el is near the viewport. */
  RV.loop = function (el, fn, margin) {
    let vis = false, running = false, last = 0;
    const tick = (now) => {
      if (!vis) { running = false; return; }
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      fn(dt, now / 1000);
      requestAnimationFrame(tick);
    };
    new IntersectionObserver(([e]) => {
      vis = e.isIntersecting;
      if (vis && !running) { running = true; last = performance.now(); requestAnimationFrame(tick); }
    }, { rootMargin: margin || "120px" }).observe(el);
  };

  /* ------------------------------------------------------------------ */
  /* Toast                                                               */
  /* ------------------------------------------------------------------ */
  const toastEl = document.getElementById("toast");
  let toastT;
  RV.toast = (msg) => {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove("show"), 2600);
  };

  /* ------------------------------------------------------------------ */
  /* Nav                                                                 */
  /* ------------------------------------------------------------------ */
  const nav = document.getElementById("nav");
  const toggle = document.getElementById("navToggle");
  toggle.addEventListener("click", () => {
    const open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });

  // smooth in-page navigation (no CSS scroll-behavior, so loop jumps stay instant)
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href").slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    const top = id === "top" ? 0 : target.getBoundingClientRect().top + window.scrollY - nav.offsetHeight + 1;
    window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
    history.replaceState(null, "", "#" + id);
  });

  const navLinks = [...document.querySelectorAll(".nav__links a")];
  const secIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) navLinks.forEach((l) => l.classList.toggle("is-active", l.getAttribute("href") === "#" + en.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  ["about", "work", "skills", "journey", "research", "contact"].forEach((id) => {
    const s = document.getElementById(id);
    if (s) secIO.observe(s);
  });

  /* ------------------------------------------------------------------ */
  /* Reveal                                                              */
  /* ------------------------------------------------------------------ */
  const revIO = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("is-in"); revIO.unobserve(en.target); } });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
  RV.reveal = (root) => (root || document).querySelectorAll(".reveal:not(.is-in)").forEach((el) => revIO.observe(el));
  RV.reveal();

  /* ------------------------------------------------------------------ */
  /* Typing rotator (all copies stay in sync for the seamless loop)      */
  /* ------------------------------------------------------------------ */
  const rotEls = [...document.querySelectorAll("[data-rotator]")];
  const phrases = (window.SITE && SITE.rotator) || [];
  if (rotEls.length && phrases.length && !reduced) {
    let pi = 0, ci = phrases[0].length, deleting = false, wait = 1.8;
    let acc = 0, last = performance.now();
    (function step(now) {
      const dt = (now - last) / 1000;
      last = now;
      acc += dt;
      const speed = deleting ? 0.028 : 0.055;
      if (wait > 0) wait -= dt;
      else if (acc > speed) {
        acc = 0;
        const p = phrases[pi];
        if (!deleting) {
          ci++;
          if (ci >= p.length) { ci = p.length; deleting = true; wait = 1.9; }
        } else {
          ci--;
          if (ci <= 0) { ci = 0; deleting = false; pi = (pi + 1) % phrases.length; wait = 0.25; }
        }
        const txt = phrases[pi].slice(0, ci) || "​";
        rotEls.forEach((el) => (el.textContent = txt));
      }
      requestAnimationFrame(step);
    })(last);
  }

  /* ------------------------------------------------------------------ */
  /* Marquees (speed reacts to scroll velocity)                          */
  /* ------------------------------------------------------------------ */
  const marquees = [];
  function setupMarquee(m) {
    const track = m.querySelector(".marquee__track");
    if (!m.dataset.base) m.dataset.base = track.innerHTML;
    const base = m.dataset.base;
    track.innerHTML = base;
    const perUnit = track.children.length;
    let unit = base, reps = 1;
    while (track.scrollWidth < window.innerWidth * 1.1 && reps < 12) { unit += base; reps++; track.innerHTML = unit; }
    track.innerHTML = unit + unit;
    const kids = track.children;
    return { m, track, unit: kids[perUnit * reps].offsetLeft - kids[0].offsetLeft, x: 0, speed: +m.dataset.speed || 40 };
  }
  document.querySelectorAll("[data-marquee]").forEach((m) => marquees.push(setupMarquee(m)));

  let scrollVel = 0, lastY = window.scrollY, lastT = performance.now();
  if (!reduced) {
    (function mq(now) {
      const dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;
      scrollVel *= 0.92;
      for (const q of marquees) {
        const dir = Math.sign(q.speed);
        q.x -= (q.speed + dir * Math.min(Math.abs(scrollVel) * 0.35, 900)) * dt;
        if (q.x <= -q.unit) q.x += q.unit;
        if (q.x > 0) q.x -= q.unit;
        q.track.style.transform = `translate3d(${q.x.toFixed(2)}px,0,0)`;
      }
      requestAnimationFrame(mq);
    })(lastT);
  }

  /* ------------------------------------------------------------------ */
  /* Hero visibility (drives the 3D portrait) + back-to-top button       */
  /* ------------------------------------------------------------------ */
  const heroes = [...document.querySelectorAll("[data-hero]")];
  const toTop = document.getElementById("toTop");

  function heroVisibility() {
    const vh = window.innerHeight;
    let v = 0;
    for (const h of heroes) v = Math.max(v, 1 - Math.min(1, Math.abs(h.getBoundingClientRect().top) / (vh * 0.9)));
    return v;
  }

  function onScroll() {
    const y = window.scrollY;
    const now = performance.now();
    const dt = Math.max(1, now - (onScroll.t || now - 16));
    onScroll.t = now;
    scrollVel = scrollVel * 0.6 + ((y - lastY) / dt) * 1000 * 0.4;
    lastY = y;

    if (toTop) toTop.classList.toggle("show", y > window.innerHeight * 0.8);

    RV.heroVis = heroVisibility();
    RV.emit("hero", RV.heroVis);
    nav.classList.toggle("is-solid", RV.heroVis < 0.85 || nav.classList.contains("is-open"));
    RV.emit("scroll", window.scrollY);
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  if (toTop) toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }));

  /* ------------------------------------------------------------------ */
  /* More builds grid                                                    */
  /* ------------------------------------------------------------------ */
  const grid = document.getElementById("builds-grid");
  const langColor = { Python: "#c8f135", TypeScript: "#7fb2ff", JavaScript: "#f2d15c" };
  if (grid && window.SITE) {
    grid.innerHTML = SITE.builds.map((b) => `
      <a class="build reveal" href="${b.url}" target="_blank" rel="noopener" data-cursor="code">
        <div class="build__top"><h4>${b.name}</h4><svg><use href="#i-arrow"/></svg></div>
        <p>${b.text}</p>
        <span class="lang" style="--c:${langColor[b.lang] || "#a8a296"}">${b.lang}</span>
      </a>`).join("");
    RV.reveal(grid);
  }

  /* ------------------------------------------------------------------ */
  /* Tilt cards with glare                                               */
  /* ------------------------------------------------------------------ */
  if (finePointer && !reduced) {
    document.querySelectorAll("[data-tilt]").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.transform = `perspective(900px) rotateY(${(px - 0.5) * 12}deg) rotateX(${(0.5 - py) * 10}deg) translateZ(0)`;
        el.style.setProperty("--gx", px * 100 + "%");
        el.style.setProperty("--gy", py * 100 + "%");
        el.style.setProperty("--go", "1");
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; el.style.setProperty("--go", "0"); });
    });
  }

  /* ------------------------------------------------------------------ */
  /* Custom cursor                                                       */
  /* ------------------------------------------------------------------ */
  if (finePointer && !reduced) {
    const cur = document.querySelector(".cursor");
    const dot = cur.querySelector(".cursor__dot");
    const ring = cur.querySelector(".cursor__ring");
    const label = cur.querySelector(".cursor__label");
    document.body.classList.add("has-cursor");
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my, shown = false;
    window.addEventListener("pointermove", (e) => {
      mx = e.clientX; my = e.clientY;
      if (!shown) { shown = true; rx = mx; ry = my; cur.classList.add("is-live"); }
      const t = e.target.closest("[data-cursor], a, button, .cats button");
      const lab = t && t.dataset ? t.dataset.cursor : "";
      cur.classList.toggle("is-hover", !!t);
      cur.classList.toggle("has-label", !!lab);
      label.textContent = lab ? { github: "GitHub", linkedin: "Say hi", visit: "Visit", read: "Read", code: "Code", open: "Open", drag: "Drag", email: "Write", call: "Call", resume: "PDF", top: "Top" }[lab] || lab : "";
    }, { passive: true });
    document.addEventListener("pointerleave", () => cur.classList.remove("is-live"));
    document.addEventListener("pointerenter", () => { if (shown) cur.classList.add("is-live"); });
    // A modal <dialog> opens in the browser's top layer, above every z-index,
    // so the project dialog used to hide this cursor (the native one is off).
    // Make the cursor a manual popover, which lives in the top layer too, and
    // re-raise it whenever a dialog opens: the newest top-layer entry paints last.
    const canPop = typeof cur.showPopover === "function";
    const raise = () => {
      try { if (cur.matches(":popover-open")) cur.hidePopover(); cur.showPopover(); } catch (e) { /* keep going */ }
    };
    if (canPop) { cur.setAttribute("popover", "manual"); raise(); }
    document.querySelectorAll("dialog").forEach((d) => {
      new MutationObserver(() => {
        if (canPop) { if (d.open) raise(); }
        else document.body.classList.toggle("cursor-native", !!document.querySelector("dialog[open]"));
      }).observe(d, { attributes: true, attributeFilter: ["open"] });
    });
    (function follow() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      dot.style.transform = `translate3d(${mx}px,${my}px,0)`;
      ring.style.transform = `translate3d(${rx}px,${ry}px,0)`;
      requestAnimationFrame(follow);
    })();
  }

  /* ------------------------------------------------------------------ */
  /* Copy email                                                          */
  /* ------------------------------------------------------------------ */
  const copyBtn = document.getElementById("copyEmail");
  if (copyBtn) copyBtn.addEventListener("click", async () => {
    const email = copyBtn.dataset.email;
    try { await navigator.clipboard.writeText(email); RV.toast("Email copied ✦ talk soon"); }
    catch (e) { RV.toast(email); }
  });

  /* ------------------------------------------------------------------ */
  /* ".fun" easter egg: type f-u-n anywhere                              */
  /* ------------------------------------------------------------------ */
  let keys = "";
  window.addEventListener("keydown", (e) => {
    if (e.target.closest && e.target.closest("input, textarea, [contenteditable]")) return;
    if (e.key.length !== 1) return;
    keys = (keys + e.key.toLowerCase()).slice(-3);
    if (keys === "fun") {
      keys = "";
      RV.emit("fun");
      RV.toast("You found the .fun part ✦");
      if (RV.heroVis < 0.3) window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    }
  });

  /* ------------------------------------------------------------------ */
  /* Resize + boot                                                       */
  /* ------------------------------------------------------------------ */
  let rT;
  window.addEventListener("resize", () => {
    clearTimeout(rT);
    rT = setTimeout(() => {
      for (let i = 0; i < marquees.length; i++) marquees[i] = setupMarquee(marquees[i].m);
      onScroll();
    }, 150);
  });
  const yr = document.getElementById("year");
  if (yr) yr.textContent = new Date().getFullYear();
  RV.onScroll = onScroll;
  requestAnimationFrame(onScroll);
})();
