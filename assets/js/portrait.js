/* =====================================================================
   Hero: 3D particle portrait.
   ~36k dots on a halftone grid built from the photo (tools/build_assets.py)
   swarm in and assemble the portrait, push away from the cursor, scatter
   into dust as you scroll, and burst when you type "fun".
   ===================================================================== */
(function () {
  "use strict";
  const THREE = window.THREE;
  const RV = window.RV;
  const canvas = document.getElementById("portrait");
  const P = window.PORTRAIT;
  if (!THREE || !canvas || !P) return;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (e) { canvas.remove(); return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0, 4.2);
  const group = new THREE.Group();
  scene.add(group);

  // ---- decode the dot grid --------------------------------------------
  // Each grid cell with a tone > 0 becomes one dot (tools/build_assets.py).
  const bytesOf = (s) => {
    const bin = atob(s), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return u;
  };
  const tone = bytesOf(P.tone), depth = bytesOf(P.depth);
  const N = P.n;
  const target = new Float32Array(N * 3);
  const start = new Float32Array(N * 3);
  const bright = new Float32Array(N);
  const rnd = new Float32Array(N);
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const hash = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s); };
  let i = 0;
  for (let r = 0; r < P.rows; r++) {
    for (let c = 0; c < P.cols; c++) {
      const t = tone[r * P.cols + c];
      if (!t || i >= N) continue;
      bright[i] = t / 255;
      // a touch of jitter keeps the grid from looking like a screen
      target[i * 3] = P.x0 + (c + (hash(c, r) - 0.5) * 0.16) * P.step;
      target[i * 3 + 1] = P.y0 - (r + (hash(c + 71, r + 13) - 0.5) * 0.16) * P.step;
      target[i * 3 + 2] = (depth[i] / 255) * P.zmax + bright[i] * 0.03;
      rnd[i] = rand();
      // start: a loose swirling galaxy around the portrait
      const a = rand() * Math.PI * 2, rr = 1.6 + rand() * 2.6, h = (rand() - 0.5) * 2.4;
      start[i * 3] = Math.cos(a) * rr;
      start[i * 3 + 1] = h;
      start[i * 3 + 2] = Math.sin(a) * rr - 1.2;
      i++;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(target, 3));
  geo.setAttribute("aStart", new THREE.BufferAttribute(start, 3));
  geo.setAttribute("aBright", new THREE.BufferAttribute(bright, 1));
  geo.setAttribute("aRand", new THREE.BufferAttribute(rnd, 1));

  const uniforms = {
    uTime: { value: 0 },
    uProgress: { value: RV.reduced ? 1 : 0 },
    uMouse: { value: new THREE.Vector3(9, 9, 0) },
    uMouseStrength: { value: 0 },
    uScatter: { value: 0 },
    uFun: { value: 0 },
    uStep: { value: P.step },
    uScale: { value: 1000 },
    uCream: { value: new THREE.Color(0xf2ebdd) },
    uLime: { value: new THREE.Color(0xc8f135) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute vec3 aStart; attribute float aBright; attribute float aRand;
      uniform float uTime, uProgress, uMouseStrength, uScatter, uFun, uStep, uScale;
      uniform vec3 uMouse;
      varying float vBright; varying float vTouch; varying float vRand; varying float vFade;
      void main(){
        // staggered assembly
        float t = clamp((uProgress - aRand * 0.4) / 0.6, 0.0, 1.0);
        t = 1.0 - pow(1.0 - t, 3.0);
        vec3 swirl = aStart;
        float ang = (1.0 - t) * 2.2;
        swirl.xz = mat2(cos(ang), -sin(ang), sin(ang), cos(ang)) * swirl.xz;
        vec3 p = mix(swirl, position, t);

        // breathing: a slow shimmer, kept well under the dot pitch so the face stays crisp
        p += vec3(0.0006 * sin(uTime * 1.3 + aRand * 31.0), 0.0006 * cos(uTime * 1.1 + aRand * 17.0), 0.004 * sin(uTime * 0.9 + aRand * 11.0));

        // cursor: push particles away and lift them toward the camera
        vec2 d = p.xy - uMouse.xy;
        float dist = length(d);
        float touch = smoothstep(0.32, 0.0, dist) * uMouseStrength;
        p.xy += normalize(d + 1e-5) * touch * 0.16;
        p.z += touch * 0.35;
        vTouch = touch;

        // scroll scatter: dissolve outward into drifting dust
        vec3 dir = normalize(position + vec3(aRand - 0.5, aRand * 0.7 - 0.35, 0.6));
        p += dir * uScatter * (0.9 + aRand * 2.6);
        p.y += uScatter * uScatter * (aRand - 0.3) * 1.2;

        // ".fun" burst
        vec3 fdir = normalize(vec3(sin(aRand * 91.0), cos(aRand * 57.0), sin(aRand * 23.0) + 0.6));
        p += fdir * uFun * (0.8 + aRand * 2.2);

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        vBright = aBright; vRand = aRand;
        vFade = 1.0 - uScatter * (0.35 + aRand * 0.65);
        // dot size in world units (a share of the grid pitch), so it tracks the layout
        float settle = mix(1.6, 1.0, t);
        // halftone: dot area follows brightness
        gl_PointSize = max(1.0, uStep * (0.22 + pow(aBright, 0.7) * 1.35 + touch * 1.6 + uFun * 1.2) * settle * uScale / -mv.z);
      }`,
    fragmentShader: `
      uniform vec3 uCream, uLime; uniform float uFun;
      varying float vBright; varying float vTouch; varying float vRand; varying float vFade;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.14, d);
        vec3 col = mix(uCream, uLime, clamp(vTouch * 1.2, 0.0, 1.0));
        col = mix(col, vRand > 0.5 ? uLime : vec3(1.0, 0.55, 0.38), uFun * step(0.3, fract(vRand * 7.0)) * 0.85);
        gl_FragColor = vec4(col, a * (0.12 + pow(vBright, 1.15) * 0.88) * 0.95 * vFade);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  group.add(points);

  // background dust
  const DN = 700;
  const dpos = new Float32Array(DN * 3);
  for (let i = 0; i < DN; i++) {
    dpos[i * 3] = (rand() - 0.5) * 14;
    dpos[i * 3 + 1] = (rand() - 0.5) * 9;
    dpos[i * 3 + 2] = -2 - rand() * 6;
  }
  const dgeo = new THREE.BufferGeometry();
  dgeo.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0xf2ebdd, size: 0.018, transparent: true, opacity: 0.35, depthWrite: false }));
  scene.add(dust);

  // ---- layout -------------------------------------------------------
  const layout = { x: 1, y: -0.2, s: 1.1, base: 1 };
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
    const halfW = halfH * camera.aspect;
    if (camera.aspect < 0.9) {
      const s = Math.min(halfW * 0.98, halfH * 0.62);
      // phones: a dimmed backdrop, raised so the eyes sit clear of the status pill
      Object.assign(layout, { x: 0, y: halfH - s * 1.05 - 0.05, s, base: 0.62 });
    } else {
      const s = Math.min(halfH * 0.86, halfW * 0.42);
      Object.assign(layout, { x: Math.min(halfW * 0.6, halfW - s * 0.92), y: -halfH + s * 1.02, s, base: 1 });
    }
    // device pixels per world unit at distance 1, times the portrait's scale
    uniforms.uScale.value = layout.s * (h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
  }
  window.addEventListener("resize", resize);
  resize();

  // ---- input ---------------------------------------------------------
  const ndc = new THREE.Vector2(9, 9);
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  let pointerIn = false;
  const mouse = { x: 0, y: 0 };
  window.addEventListener("pointermove", (e) => {
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    mouse.x = ndc.x; mouse.y = ndc.y;
    pointerIn = true;
  }, { passive: true });
  document.addEventListener("pointerleave", () => { pointerIn = false; });

  // touch: a tap ripples the portrait
  window.addEventListener("touchstart", (e) => {
    const t = e.touches[0];
    if (!t) return;
    ndc.set((t.clientX / innerWidth) * 2 - 1, -(t.clientY / innerHeight) * 2 + 1);
    pointerIn = true;
    clearTimeout(window.__rvTouchT);
    window.__rvTouchT = setTimeout(() => (pointerIn = false), 900);
  }, { passive: true });

  // ".fun" burst
  let funT = -1;
  RV.on("fun", () => { funT = 0; });

  RV.setPortraitOpacity = (vis) => { canvas.style.opacity = (Math.pow(vis, 1.2) * layout.base).toFixed(3); };
  RV.on("hero", (vis) => RV.setPortraitOpacity(vis));

  // ---- loop ----------------------------------------------------------
  let last = performance.now(), t0 = last, rotY = 0, rotX = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const vis = RV.heroVis;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (vis < 0.01 && funT < 0) { canvas.style.opacity = "0"; return; }
    RV.setPortraitOpacity(vis);

    const elapsed = (now - t0) / 1000;
    uniforms.uTime.value = elapsed;
    if (!RV.reduced) uniforms.uProgress.value = Math.min(1, elapsed / 3.2);
    uniforms.uScatter.value += (Math.min(1, (1 - vis) * 1.25) - uniforms.uScatter.value) * 0.15;

    if (funT >= 0) {
      funT += dt;
      const up = Math.min(1, funT / 0.5), down = Math.max(0, (funT - 1.1) / 1.4);
      uniforms.uFun.value = Math.sin((up - down) * Math.PI * 0.5) * (1 - down);
      if (funT > 2.6) { funT = -1; uniforms.uFun.value = 0; }
    }

    // gentle parallax toward the pointer
    // (kept small: a big turn shows the portrait is a relief, not a head)
    const tx = RV.reduced ? 0 : mouse.x * 0.24 + Math.sin(elapsed * 0.35) * 0.05;
    const ty = RV.reduced ? 0 : -mouse.y * 0.1;
    rotY += (tx - rotY) * 0.06;
    rotX += (ty - rotX) * 0.06;
    group.position.set(layout.x, layout.y, 0);
    group.scale.setScalar(layout.s);
    group.rotation.set(rotX, rotY, 0);
    dust.rotation.y = elapsed * 0.01;

    // cursor in the portrait's local space
    group.updateMatrixWorld();
    const strength = pointerIn && vis > 0.4 ? 1 : 0;
    uniforms.uMouseStrength.value += (strength - uniforms.uMouseStrength.value) * 0.08;
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(plane, hit)) {
      points.worldToLocal(hit);
      uniforms.uMouse.value.lerp(hit, 0.35);
    }

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
})();
