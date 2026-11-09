/* =====================================================================
   Skills: a drag-to-spin 3D sphere of tags, with group filters.
   ===================================================================== */
(function () {
  "use strict";
  const RV = window.RV;
  const sphere = document.getElementById("sphere");
  const catsEl = document.getElementById("skillCats");
  const groups = (window.SITE && SITE.skills) || {};
  if (!sphere || !catsEl) return;

  const items = [];
  Object.entries(groups).forEach(([g, list]) => list.forEach((name) => items.push({ g, name })));
  const N = items.length;

  // Fibonacci sphere
  const golden = Math.PI * (3 - Math.sqrt(5));
  items.forEach((it, i) => {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    it.p = [Math.cos(th) * r, y, Math.sin(th) * r];
    const el = document.createElement("span");
    el.className = "sphere__tag";
    el.textContent = it.name;
    el.dataset.group = it.g;
    sphere.appendChild(el);
    it.el = el;
  });

  // group filter buttons
  const names = ["All", ...Object.keys(groups)];
  catsEl.innerHTML = names.map((g) => `<button type="button" aria-pressed="${g === "All"}" data-g="${g}">${g}</button>`).join("");
  catsEl.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const g = b.dataset.g;
    catsEl.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    items.forEach((it) => {
      it.el.classList.toggle("on", g !== "All" && it.g === g);
      it.el.classList.toggle("off", g !== "All" && it.g !== g);
    });
    vy += 0.9; // a little spin for feedback
  });

  // rotation state: accumulated 3x3 matrix
  let M = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  let vx = 0.0, vy = 0.35; // rad/s
  const mul = (a, b) => [
    a[0] * b[0] + a[1] * b[3] + a[2] * b[6], a[0] * b[1] + a[1] * b[4] + a[2] * b[7], a[0] * b[2] + a[1] * b[5] + a[2] * b[8],
    a[3] * b[0] + a[4] * b[3] + a[5] * b[6], a[3] * b[1] + a[4] * b[4] + a[5] * b[7], a[3] * b[2] + a[4] * b[5] + a[5] * b[8],
    a[6] * b[0] + a[7] * b[3] + a[8] * b[6], a[6] * b[1] + a[7] * b[4] + a[8] * b[7], a[6] * b[2] + a[7] * b[5] + a[8] * b[8],
  ];
  const rotX = (t) => [1, 0, 0, 0, Math.cos(t), -Math.sin(t), 0, Math.sin(t), Math.cos(t)];
  const rotY = (t) => [Math.cos(t), 0, Math.sin(t), 0, 1, 0, -Math.sin(t), 0, Math.cos(t)];

  // drag
  let dragging = false, lx = 0, ly = 0, lt = 0;
  sphere.addEventListener("pointerdown", (e) => {
    dragging = true; lx = e.clientX; ly = e.clientY; lt = performance.now();
    sphere.setPointerCapture(e.pointerId);
  });
  sphere.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const now = performance.now(), dt = Math.max(8, now - lt) / 1000;
    const dx = e.clientX - lx, dy = e.clientY - ly;
    vy = (dx / sphere.offsetWidth) * 3.2 / dt * 0.6;
    vx = -(dy / sphere.offsetHeight) * 3.2 / dt * 0.6;
    lx = e.clientX; ly = e.clientY; lt = now;
  });
  const end = () => { dragging = false; };
  sphere.addEventListener("pointerup", end);
  sphere.addEventListener("pointercancel", end);

  RV.loop(sphere, (dt) => {
    if (!dragging) {
      // ease back to a gentle idle spin
      vx += (0 - vx) * Math.min(1, dt * 1.5);
      vy += ((RV.reduced ? 0 : 0.3) - vy) * Math.min(1, dt * 1.2);
    }
    M = mul(rotY(vy * dt), mul(rotX(vx * dt), M));
    const R = sphere.offsetWidth * 0.4;
    for (const it of items) {
      const [x, y, z] = it.p;
      const X = M[0] * x + M[1] * y + M[2] * z;
      const Y = M[3] * x + M[4] * y + M[5] * z;
      const Z = M[6] * x + M[7] * y + M[8] * z;
      const s = 0.62 + (Z + 1) * 0.3;
      it.el.style.transform = `translate(-50%, -50%) translate3d(${(X * R).toFixed(1)}px, ${(Y * R).toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
      it.el.style.opacity = (0.18 + 0.82 * ((Z + 1) / 2) ** 1.3).toFixed(3);
      it.el.style.zIndex = String(Math.round((Z + 1) * 50));
    }
  });
})();
