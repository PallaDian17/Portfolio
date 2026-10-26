/* HERO RING: a 3D replica of the reference loop. Twelve curved panels hang on a ring (concave toward the centre) with a
   mono-type ribbon orbiting through them on a tilted axis. A wide-angle camera drifts inside the ring on a 9 s loop:
   diagonal band → looking up the axis (tunnel) → grazing one panel → level band → dropping below as the ring swings over.
   Everything is unlit (MeshBasicMaterial) on paper white, as in the reference. */
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

export function mountHeroRing(host, opts) {
  opts = opts || {};
  const reduce = !!opts.reduce;
  const LOOP = 9;                       // seconds, same as the reference
  const MAX_ROLL = opts.maxRoll != null ? opts.maxRoll : 25;
  const STILL_AT = opts.stillAt != null ? opts.stillAt : 4.2;   // reduced-motion frame
  const R = 5;                          // ring radius
  const PAPER = 0xF1F1F1, INK = '#21262B', STEEL = '#778899', GREY = '#A9A9A9', PAPER_CSS = '#F1F1F1';

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxDpr || 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(opts.flat ? 0xffffff : PAPER, 1);
  host.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(80, 1, 0.05, 100);
  const ring = new THREE.Group(); scene.add(ring);

  /* ---------- textures ---------- */
  const loader = new THREE.TextureLoader();
  const videos = [];
  function coverFit(tex, imgAspect, panelAspect) {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    if (imgAspect > panelAspect) { tex.repeat.set(panelAspect / imgAspect, 1); tex.offset.set((1 - tex.repeat.x) / 2, 0); }
    else { tex.repeat.set(1, imgAspect / panelAspect); tex.offset.set(0, (1 - tex.repeat.y) / 2); }
  }
  function imageTex(src, imgAspect, panelAspect) {
    const t = loader.load(src, () => kick()); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; coverFit(t, imgAspect, panelAspect); return t;
  }
  function videoTex(src, poster, imgAspect, panelAspect) {
    if (reduce || opts.noVideo) return imageTex(poster, imgAspect, panelAspect);
    const v = document.createElement('video');
    v.src = src; v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', ''); v.crossOrigin = 'anonymous'; v.preload = 'auto';
    videos.push(v);
    const t = new THREE.VideoTexture(v); t.colorSpace = THREE.SRGBColorSpace; coverFit(t, imgAspect, panelAspect); return t;
  }
  function typeTex(lines, bg, fg, panelAspect, opt) {
    opt = opt || {};
    const H = 640, W = Math.round(H * panelAspect), c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = fg; g.textBaseline = 'alphabetic';
    if (opt.mono) {
      g.font = '500 30px "Geist Mono", ui-monospace, monospace';
      lines.forEach((l, i) => g.fillText(l, 40, 80 + i * 46));
    } else {
      const size = opt.size || 150; g.font = '800 ' + size + 'px Geist, system-ui, sans-serif';
      const lh = size * 0.88, total = lh * lines.length, y0 = (H - total) / 2 + size * 0.78;
      lines.forEach((l, i) => { const w = g.measureText(l).width; g.fillText(l, (W - w) / 2, y0 + i * lh); });
    }
    if (opt.tag) { g.font = '500 24px "Geist Mono", ui-monospace, monospace'; g.globalAlpha = .75; g.fillText(opt.tag, 40, H - 40); g.globalAlpha = 1; }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  const alphaCache = {};
  function roundAlpha(panelAspect) {
    const key = panelAspect.toFixed(2); if (alphaCache[key]) return alphaCache[key];
    const H = 256, W = Math.round(H * panelAspect), r = 18, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff';
    g.beginPath(); g.roundRect(0, 0, W, H, r); g.fill();
    return (alphaCache[key] = new THREE.CanvasTexture(c));
  }

  /* ---------- panels ---------- */
  /* curved quad centred on its own origin: x = R sin a, z = R cos a - R (edges bend toward the ring centre at -R) */
  function panelGeo(span, h) {
    const seg = 18, pos = [], uv = [], idx = [];
    for (let j = 0; j <= 1; j++) for (let i = 0; i <= seg; i++) {
      const a = -span / 2 + span * i / seg;
      pos.push(R * Math.sin(a), (j - 0.5) * h, R * Math.cos(a) - R);
      uv.push(1 - i / seg, j);                         // reads correctly from inside the ring
    }
    for (let i = 0; i < seg; i++) { const a = i, b = i + 1, c = i + seg + 1, d = i + seg + 2; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); return geo;
  }
  const D = Math.PI / 180;
  /* Eight panels at 45° steps. Slot roles follow the reference read from outside the ring:
     0 accent (orange) · 1 light, larger (white) · 2 dark type (green) · 3 warm (pink) · 4 portrait (dancer) · 5 red · 6 dark (blue) · 7 board (web3).
     [kind, src/lines, span°, height, y, tilt°, radius scale, extra] */
  const P = [
    ['video', 'clips/loafer-loop.mp4', 42, 4.3, -0.35, 3, 1.00, { poster: 'clips/loafer.jpg', ar: 9 / 16 }],
    ['video', 'clips/mf1-loop.mp4', 45, 5.0, -0.05, 1, 1.00, { poster: 'clips/mf1.jpg', ar: 4 / 5 }],
    ['img', 'workflow/catalog/01.jpg', 43, 4.4, 0.35, -2, 1.00, { ar: 3 / 4 }],
    ['video', 'clips/forreal-loop.mp4', 44, 4.4, 0.4, -3, 1.01, { poster: 'clips/forreal.jpg', ar: 9 / 16 }],
    ['video', 'clips/kalakicks-loop.mp4', 41, 4.9, 0.1, 3, 0.99, { poster: 'clips/kalakicks.jpg', ar: 9 / 16 }],
    ['video', 'clips/final-loop.mp4', 42, 4.8, -0.3, -2, 1.00, { poster: 'clips/final.jpg', ar: 9 / 16 }],
    ['video', 'clips/boat-loop.mp4', 38, 4.2, -0.5, 2, 0.99, { poster: 'clips/boat.jpg', ar: 9 / 16 }],
    ['img', 'workflow/poster.jpg', 44, 4.4, 0.3, -3, 1.01, { ar: 16 / 9 }],
  ];
  const panels = P.map((p, k) => {
    const [kind, src, spanDeg, h, y, tilt, rs, x] = p;
    const span = spanDeg * D, arc = R * span, aspect = arc / h;
    let map;
    if (kind === 'video') map = videoTex(src, x.poster, x.ar, aspect);
    else if (kind === 'img') map = imageTex(src, x.ar, aspect);
    else map = typeTex(src, x.bg, x.fg, aspect, { mono: kind === 'mono', tag: x.tag, size: 150 });
    let flatMap = null;
    if (opts.flat && typeof opts.flat[k] === 'object') {          /* two-tone stand-in: [base, inset, x0, y0, x1, y1] */
      const f = opts.flat[k], c = document.createElement('canvas'); c.width = 128; c.height = Math.round(128 / aspect);
      const g = c.getContext('2d'); g.fillStyle = f[0]; g.fillRect(0, 0, c.width, c.height); g.fillStyle = f[1];
      g.fillRect(f[2] * c.width, f[3] * c.height, (f[4] - f[2]) * c.width, (f[5] - f[3]) * c.height);
      flatMap = new THREE.CanvasTexture(c); flatMap.colorSpace = THREE.SRGBColorSpace;
    }
    const mat = opts.flat ? new THREE.MeshBasicMaterial(flatMap ? { map: flatMap, side: THREE.DoubleSide } : { color: new THREE.Color(opts.flat[k]), side: THREE.DoubleSide }) : new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide, alphaMap: roundAlpha(aspect), alphaTest: 0.5 });
    if (!opts.flat) mat.onBeforeCompile = (sh) => {
      /* both faces read the right way round: back faces mirror u about the centre of the cover-fit window (u -> 1 - u) */
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>',
        'vec2 mUv = vMapUv; if (!gl_FrontFacing) mUv.x = 1.0 - mUv.x;\n#ifdef USE_MAP\n  vec4 sampledDiffuseColor = texture2D( map, mUv );\n  diffuseColor *= sampledDiffuseColor;\n#endif');
    };
    const m = new THREE.Mesh(panelGeo(span, h), mat);
    const a = k * 360 / P.length * D;
    const pivot = new THREE.Object3D();
    pivot.position.set(R * rs * Math.sin(a), y, R * rs * Math.cos(a));
    pivot.rotation.y = a;
    m.rotation.z = tilt * D;
    pivot.add(m); ring.add(pivot);
    return m;
  });

  /* ---------- ribbon: the phrase once round a vertical ring of radius 0.6 R, axis horizontal ---------- */
  const RR = 3.0, RH = 0.3;
  const ribbon = new THREE.Group(); scene.add(ribbon);
  const ribbonTilt = new THREE.Group(); ribbon.add(ribbonTilt);
  const ribbonSpin = new THREE.Group(); ribbonTilt.add(ribbonSpin);
  let ribbonMesh = null;
  function buildRibbon() {
    const phrase = 'ASHISH PALLATHERY®  AI CREATIVE TECHNOLOGIST  WORKFLOWS & FILMS  ©2026   ';
    const W = 4096, H = 66, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.clearRect(0, 0, W, H); g.fillStyle = INK;
    g.font = '500 44px "Geist Mono", ui-monospace, monospace'; g.textBaseline = 'middle';
    const pw = g.measureText(phrase).width;
    g.save(); g.scale(W / pw, 1); g.fillText(phrase, 0, H / 2 + 2); g.restore();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.wrapS = THREE.RepeatWrapping;
    const geo = new THREE.CylinderGeometry(RR, RR, RH, 160, 1, true);
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide, depthWrite: false, alphaTest: 0.08 });
    if (ribbonMesh) { ribbonSpin.remove(ribbonMesh); ribbonMesh.geometry.dispose(); ribbonMesh.material.map.dispose(); ribbonMesh.material.dispose(); }
    ribbonMesh = new THREE.Mesh(geo, mat); ribbonMesh.renderOrder = 2; ribbonSpin.add(ribbonMesh);
  }
  buildRibbon();
  if (opts.noRibbon) ribbon.visible = false;
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('500 44px "Geist Mono"'), document.fonts.load('800 150px Geist')]).then(() => {
      buildRibbon(); kick();
      if (!opts.flat) panels.forEach((m, i) => { const p = P[i]; if (p[0] === 'type' || p[0] === 'mono') { const span = p[2] * D, aspect = R * span / p[3]; const old = m.material.map; m.material.map = typeTex(p[1], p[7].bg, p[7].fg, aspect, { mono: p[0] === 'mono', tag: p[7].tag, size: 150 }); m.material.needsUpdate = true; old.dispose(); } });
    }).catch(() => {});
  }
  /* the text ring stands upright: its axis is horizontal along az 135, so its plane holds the 45° panel's line of sight
     and from there it reads as a thin vertical line, as in the reference */
  const RIB_AXIS = opts.ribAxis != null ? opts.ribAxis : 135, RIB_TILT = opts.ribTilt != null ? opts.ribTilt : 6;
  ribbon.rotation.set(0, (RIB_AXIS - 90) * D, 0);
  ribbonTilt.rotation.set(RIB_TILT * D, 0, Math.PI / 2);

  /* ---------- camera path ---------- */
  /* Keys: [t, pos r (×R), pos az°, pos y, target r (×R), target az°, target y, roll°]. Positions and targets are
     interpolated as Catmull-Rom curves in world space, so the path can swing through the centre without azimuth wrap. */
  const KEYS = opts.keys || [
    [0.0, 1.72, 172, 3.3, 0.25, 0, -1.0, -28],
    [0.6, 1.45, 158, 3.6, 0.35, 345, -1.3, -32],
    [1.2, 1.08, 143, 3.9, 0.45, 330, -1.3, -36],
    [1.8, 0.80, 128, 2.6, 0.80, 300, -0.4, -44],
    [2.4, 0.45, 45, 2.5, 0.50, 280, -1.5, -62],
    [3.0, 0.55, 300, 7.2, 0.15, 120, -3.0, -95],
    [3.6, 1.20, 350, 4.5, 0.40, 180, -1.5, -40],
    [4.2, 1.45, 0, 2.9, 0.50, 180, -0.4, -12],
    [4.8, 1.85, 25, 1.2, 0.10, 210, 0.0, -5],
    [5.6, 2.12, 45, 0.1, 0.00, 225, 0.0, 0],
    [6.0, 1.90, 58, -1.8, 0.25, 238, 0.9, 2],
    [6.4, 1.65, 72, -3.3, 0.30, 252, 1.2, 4],
    [6.9, 1.55, 90, -3.8, 0.30, 270, 1.1, -4],
    [7.4, 1.55, 108, -3.8, 0.30, 288, 0.9, -10],
    [7.9, 1.78, 140, -1.0, 0.25, 320, 0.2, -20],
    [8.4, 1.80, 160, 2.2, 0.25, 350, -0.8, -26],
    [9.0, 1.72, 172, 3.3, 0.25, 0, -1.0, -28],
  ];
  const keyPts = [];
  function buildKeyPts() {
    keyPts.length = 0;
    KEYS.forEach(k => {
      const pa = k[2] * D, ta = k[5] * D;
      keyPts.push({ t: k[0], p: new THREE.Vector3(R * k[1] * Math.sin(pa), k[3], R * k[1] * Math.cos(pa)), q: new THREE.Vector3(R * k[4] * Math.sin(ta), k[6], R * k[4] * Math.cos(ta)), roll: k[7] });
    });
  }
  buildKeyPts();
  function cr(p0, p1, p2, p3, t) { const t2 = t * t, t3 = t2 * t; return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3); }
  function crV(a, b, c, d, t, out) { out.set(cr(a.x, b.x, c.x, d.x, t), cr(a.y, b.y, c.y, d.y, t), cr(a.z, b.z, c.z, d.z, t)); return out; }
  const P_ = new THREE.Vector3(), Q_ = new THREE.Vector3(), F_ = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0), RQ = new THREE.Quaternion();
  function placeCamera(t) {
    t = ((t % LOOP) + LOOP) % LOOP;
    const n = keyPts.length - 1; let i = 0; while (i < n - 1 && keyPts[i + 1].t <= t) i++;
    const k0 = keyPts[i === 0 ? n - 1 : i - 1], k1 = keyPts[i], k2 = keyPts[i + 1], k3 = keyPts[i + 2 > n ? 1 : i + 2];
    const u = (t - k1.t) / (k2.t - k1.t);
    crV(k0.p, k1.p, k2.p, k3.p, u, P_); crV(k0.q, k1.q, k2.q, k3.q, u, Q_);
    /* v3: roll capped (default 25 deg) so the loop never barrel-rolls; vestibular-safe */
    const roll = Math.max(-MAX_ROLL, Math.min(MAX_ROLL, cr(k0.roll, k1.roll, k2.roll, k3.roll, u)));
    camera.position.copy(P_); camera.up.copy(UP); camera.lookAt(Q_);
    F_.subVectors(Q_, P_).normalize();
    RQ.setFromAxisAngle(F_, -roll * D); camera.quaternion.premultiply(RQ);
    ribbonSpin.rotation.y = -t / LOOP * Math.PI * 2 * 0.35;   /* the phrase runs slowly round its ring (own axis) */
  }

  /* ---------- sizing: hold a constant diagonal field of view so portrait and landscape frame the same ---------- */
  let DIAG = (opts.diag || 104) * D;
  function resize() {
    const w = host.clientWidth || 1, h = host.clientHeight || 1, a = w / h;
    camera.aspect = a;
    camera.fov = 2 * Math.atan(Math.tan(DIAG / 2) / Math.sqrt(a * a + 1)) / D;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  const ro = 'ResizeObserver' in window ? new ResizeObserver(resize) : null; if (ro) ro.observe(host); else window.addEventListener('resize', resize);

  /* ---------- loop ---------- */
  let running = false, raf = 0, t0 = performance.now(), tFrozen = opts.time != null ? opts.time : null, offset = 0, pausedAt = 0;
  function frame(now) {
    const t = tFrozen != null ? tFrozen : (now - t0) / 1000 + offset;
    placeCamera(reduce ? STILL_AT : t);
    renderer.render(scene, camera);
    if (running) raf = requestAnimationFrame(frame);
  }
  /* a frozen frame (reduced motion) re-renders when each texture or font arrives, so it never shows half-loaded */
  function kick() { if (!running && typeof frame === 'function') requestAnimationFrame(frame); }
  function play() { if (running) return; running = true; t0 = performance.now(); offset = pausedAt; videos.forEach(v => v.play().catch(() => {})); raf = requestAnimationFrame(frame); }
  function pause() { if (!running) return; running = false; cancelAnimationFrame(raf); pausedAt = (performance.now() - t0) / 1000 + offset; videos.forEach(v => v.pause()); }
  if (reduce || tFrozen != null) { requestAnimationFrame(frame); }
  return { play, pause, renderAt(t) { tFrozen = t; frame(performance.now()); },
    renderRaw(k) {           /* tuning hook: [pos r, pos az, pos y, tgt r, tgt az, tgt y, roll, diag?] */
      if (k[7]) { DIAG = k[7] * D; resize(); }
      const pa = k[1] * D, ta = k[4] * D;
      P_.set(R * k[0] * Math.sin(pa), k[2], R * k[0] * Math.cos(pa)); Q_.set(R * k[3] * Math.sin(ta), k[5], R * k[3] * Math.cos(ta));
      camera.position.copy(P_); camera.up.copy(UP); camera.lookAt(Q_);
      F_.subVectors(Q_, P_).normalize(); RQ.setFromAxisAngle(F_, -k[6] * D); camera.quaternion.premultiply(RQ);
      renderer.render(scene, camera);
    }, setKeys(k) { KEYS.splice(0, KEYS.length, ...k); buildKeyPts(); }, renderer, camera, scene };
}
