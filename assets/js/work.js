/* =====================================================================
   Selected work: a scroll-driven 3D ring of project cards (desktop),
   a swipeable row on phones, and a detail dialog for each project.
   ===================================================================== */
(function () {
  "use strict";
  const RV = window.RV;
  const data = (window.SITE && SITE.projects) || [];
  const section = document.getElementById("work");
  const ring = document.getElementById("ring");
  if (!section || !ring || !data.length) return;

  const n = data.length;
  const step = 360 / n;
  const pad = (i) => String(i + 1).padStart(2, "0");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  ring.innerHTML = data.map((p, i) => `
    <button class="card" type="button" data-i="${i}" data-cursor="open" aria-label="${esc(p.title)}: open details">
      <span class="card__num" aria-hidden="true">${pad(i)}</span>
      <span class="card__kicker">${esc(p.kicker)}</span>
      <h3>${esc(p.title)}</h3>
      <span class="card__tag">${esc(p.tagline)}</span>
      <span class="card__metrics">${p.metrics.slice(0, 4).map((m) => `<div><b>${esc(m.v)}</b><span>${esc(m.l)}</span></div>`).join("")}</span>
      <span class="card__more">Full story <svg><use href="#i-arrow"/></svg></span>
    </button>`).join("");
  document.getElementById("workTotal").textContent = pad(n - 1);
  const cards = [...ring.querySelectorAll(".card")];
  const idxEl = document.getElementById("workIdx");

  const desktop = () => window.matchMedia("(min-width: 861px)").matches;

  // ---- ring geometry ---------------------------------------------------
  let radius = 400;
  function measure() {
    const w = ring.offsetWidth || 420;
    radius = Math.round(w / 2 / Math.tan(Math.PI / n) + 80);
  }
  measure();
  window.addEventListener("resize", measure);

  function progress() {
    const r = section.getBoundingClientRect();
    const span = section.offsetHeight - window.innerHeight;
    return span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0;
  }

  let angle = 0, front = -1;
  function render(dt) {
    if (!desktop()) return;
    // one full turn across the pinned scroll, so the ring ends where it began;
    // each card dwells front-and-centre, then the ring turns quickly to the next
    const f = progress() * n;
    const k = Math.floor(f), r = f - k;
    const e = r < 0.4 ? 0 : r > 0.75 ? 1 : (r - 0.4) / 0.35;
    const target = -(k + e * e * (3 - 2 * e)) * step;
    angle += (target - angle) * (RV.reduced ? 1 : Math.min(1, dt * 7));
    ring.style.transform = `translateZ(${-radius}px) rotateY(${angle}deg)`;
    let best = 0, bestCos = -2;
    cards.forEach((c, i) => {
      const rel = ((i * step + angle) % 360 + 360) % 360;
      const cos = Math.cos((rel * Math.PI) / 180);
      c.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px)`;
      c.style.opacity = (0.12 + 0.88 * Math.max(0, cos) ** 1.5).toFixed(3);
      c.style.pointerEvents = cos > 0.2 ? "auto" : "none";
      c.tabIndex = cos > 0.6 ? 0 : -1;
      if (cos > bestCos) { bestCos = cos; best = i; }
    });
    if (best !== front) {
      front = best;
      cards.forEach((c, i) => c.classList.toggle("is-front", i === best));
      idxEl.textContent = pad(best);
    }
  }
  RV.loop(section, render, "50px");

  function goTo(i) {
    const span = section.offsetHeight - window.innerHeight;
    const k = ((i % n) + n) % n;
    const top = section.offsetTop + ((k + 0.15) / n) * span;
    window.scrollTo({ top, behavior: RV.reduced ? "auto" : "smooth" });
  }
  document.getElementById("workPrev").addEventListener("click", () => goTo((front < 0 ? 0 : front) - 1));
  document.getElementById("workNext").addEventListener("click", () => goTo((front < 0 ? 0 : front) + 1));

  // ---- detail dialog ---------------------------------------------------
  const modal = document.getElementById("projectModal");
  const $ = (id) => document.getElementById(id);
  function open(i) {
    const p = data[i];
    $("pmKicker").textContent = `${pad(i)} · ${p.kicker}`;
    $("pmTitle").textContent = p.title;
    $("pmTag").textContent = p.tagline;
    $("pmMetrics").innerHTML = p.metrics.map((m) => `<div><dt>${esc(m.v)}</dt><dd>${esc(m.l)}</dd></div>`).join("");
    $("pmBullets").innerHTML = (p.note ? `<li class="modal__note">${esc(p.note)}</li>` : "") + p.bullets.map((b) => `<li>${esc(b)}</li>`).join("");
    $("pmTech").innerHTML = p.tech.map((t) => `<span>${esc(t)}</span>`).join("");
    $("pmLinks").innerHTML = p.links.map((l, k) => `<a class="btn ${k ? "btn--ghost" : "btn--lime"}" href="${l.url}" target="_blank" rel="noopener">${esc(l.label)} <svg><use href="#i-arrow"/></svg></a>`).join("");
    if (typeof modal.showModal === "function") modal.showModal(); else modal.setAttribute("open", "");
  }
  ring.addEventListener("click", (e) => {
    const c = e.target.closest(".card");
    if (!c) return;
    const i = +c.dataset.i;
    if (desktop() && i !== front) goTo(i); else open(i);
  });
  $("pmClose").addEventListener("click", () => modal.close());
  modal.addEventListener("click", (e) => { if (e.target === modal) modal.close(); });
})();
