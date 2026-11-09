/* =====================================================================
   Hero: 3D particle portrait.
   16k points sampled from the photo (tools/build_assets.py) swarm in
   and assemble the portrait, push away from the cursor, scatter into
   dust as you scroll, and burst when you type "fun".
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

  // ---- decode point cloud -------------------------------------------
  const bin = atob(P.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const N = P.n;
  const xyz = new Int16Array(bytes.buffer, 0, N * 3);
  const target = new Float32Array(N * 3);
  const start = new Float32Array(N * 3);
  const bright = new Float32Array(N);
  const rnd = new Float32Array(N);
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < N; i++) {
    target[i * 3] = xyz[i * 3] / 16000;
    target[i * 3 + 1] = xyz[i * 3 + 1] / 16000;
    target[i * 3 + 2] = xyz[i * 3 + 2] / 16000;
    bright[i] = bytes[N * 6 + i] / 255;
    rnd[i] = rand();
    // start: a loose swirling galaxy around the portrait
    const a = rand() * Math.PI * 2, r = 1.6 + rand() * 2.6, h = (rand() - 0.5) * 2.4;
    start[i * 3] = Math.cos(a) * r;
    start[i * 3 + 1] = h;
    start[i * 3 + 2] = Math.sin(a) * r - 1.2;
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
    uPR: { value: renderer.getPixelRatio() },
    uSize: { value: 5.6 },
    uCream: { value: new THREE.Color(0xf2ebdd) },
    uLime: { value: new THREE.Color(0xc8f135) },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute vec3 aStart; attribute float aBright; attribute float aRand;
      uniform float uTime, uProgress, uMouseStrength, uScatter, uFun, uPR, uSize;
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

        // breathing
        p += 0.006 * vec3(sin(uTime * 1.3 + aRand * 31.0), cos(uTime * 1.1 + aRand * 17.0), sin(uTime * 0.9 + aRand * 11.0));

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
        gl_PointSize = (1.0 + aBright * 1.8 + touch * 2.5 + uFun * 1.5) * uPR * uSize / -mv.z;
      }`,
    fragmentShader: `
      uniform vec3 uCream, uLime; uniform float uFun;
      varying float vBright; varying float vTouch; varying float vRand; varying float vFade;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.05, d);
        vec3 col = mix(uCream, uLime, clamp(smoothstep(0.86, 1.0, vBright) * 0.35 + vTouch * 1.2, 0.0, 1.0));
        col = mix(col, vRand > 0.5 ? uLime : vec3(1.0, 0.55, 0.38), uFun * step(0.3, fract(vRand * 7.0)) * 0.85);
        gl_FragColor = vec4(col, a * (0.24 + vBright * 0.76) * 0.82 * vFade);
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
      Object.assign(layout, { x: 0, y: halfH - s * 1.05 - 0.15, s, base: 0.62 });
    } else {
      const s = Math.min(halfH * 0.86, halfW * 0.42);
      Object.assign(layout, { x: Math.min(halfW * 0.6, halfW - s * 0.92), y: -halfH + s * 1.02, s, base: 1 });
    }
    uniforms.uPR.value = renderer.getPixelRatio();
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
    const tx = RV.reduced ? 0 : mouse.x * 0.42 + Math.sin(elapsed * 0.35) * 0.06;
    const ty = RV.reduced ? 0 : -mouse.y * 0.14;
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
