// @ts-nocheck
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/* ============================================================
       AeroVision · Anantam — self-contained build (file:// safe).
       THREE r128 UMD globals + inline app. No modules, no server.
       ============================================================ */
    export function initAeroVision() {
      "use strict";
      const boot = document.getElementById('boot');
      const bootErr = document.getElementById('bootErr');
      

      /* ---------------- config ---------------- */
      const COLORS = { bg: 0x050506 };
      const toLin = v => v < 0.04045 ? v * 0.0773993808 : Math.pow(v * 0.9478672986 + 0.0521327014, 2.4);
      const PRESSURE_RAMP = [[0.12, 0.36, 1.0], [0.12, 0.75, 0.42], [1.0, 0.89, 0.24], [1.0, 0.54, 0.17], [1.0, 0.17, 0.22]].map(c => c.map(toLin));
      const DISPLAY_LENGTH = 5.4, FLOOR_Y = -1.35;
      const STEM = {
        trackLength: 20.0, carLength: 0.210, airDensity: 1.225, mass: 0.052,
        co2Impulse: 1.90, burnTime: 0.16, rollCoef: 0.050, frontalFill: 0.62, dragGain: 8.0, cdMin: 0.06, cdMax: 0.55
      };
      const SCENES = {
        hero: { cam: [6.8, 2.3, 9.9], look: [0, 0.15, 0], spin: 0.14, flow: 0.20, pressure: 0.0, offset: 0.0 },
        problem: { cam: [7.7, 1.5, 7.3], look: [0, 0.0, 0], spin: 0.09, flow: 0.06, pressure: 0.0, offset: -0.15 },
        manifesto: { cam: [0.1, 3.7, 11.0], look: [0, 0.25, 0], spin: 0.26, flow: 0.26, pressure: 0.0, offset: 0.0 },
        flow: { cam: [8.5, 1.3, 5.6], look: [0, 0.0, 0], spin: 0.05, flow: 1.00, pressure: 0.0, offset: -0.15 },
        pressure: { cam: [-6.9, 2.0, 7.0], look: [0, 0.0, 0], spin: 0.05, flow: 0.30, pressure: 1.0, offset: 0.15 },
        engine: { cam: [-8.8, 1.7, 5.1], look: [0, 0.0, 0], spin: 0.04, flow: 0.72, pressure: 0.42, offset: -0.15 },
        launch: { cam: [5.6, 3.0, 10.6], look: [0, 0.2, 0], spin: 0.16, flow: 0.42, pressure: 0.1, offset: 0.0 },
        footer: { cam: [6.5, 4.0, 12.0], look: [0, 0.2, 0], spin: 0.10, flow: 0.30, pressure: 0.0, offset: 0.0 },
      };
      const SCENE_KEYS = ['hero', 'problem', 'manifesto', 'flow', 'pressure', 'engine', 'launch', 'footer'];
      const SCAN_STEPS = ['Reading surface…', 'Measuring frontal area…', 'Mapping curvature…', 'Detecting wing geometry…',
        'Correcting orientation…', 'Estimating pressure field…', 'Tracing streamlines…', 'Simulating 20 m run…'];
      const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
      const lerp = (a, b, t) => a + (b - a) * t;
      const damp = (c, t, l, dt) => lerp(c, t, 1 - Math.exp(-l * dt));
      const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      function rampAt(r, t) {
        t = clamp(t, 0, 1) * (r.length - 1); const i = Math.floor(t), f = t - i, a = r[i], b = r[Math.min(i + 1, r.length - 1)];
        return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
      }

      let renderer, scene, camera, controls, subject, streamlines, currentMesh = null, profile = null;

      function init() {
        /* ---------------- stage ---------------- */
        const mount = document.getElementById('stage');
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
        renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
        renderer.setSize(innerWidth, innerHeight);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.02;
        renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        mount.appendChild(renderer.domElement);

        scene = new THREE.Scene();
        scene.background = new THREE.Color(COLORS.bg);
        scene.fog = new THREE.FogExp2(COLORS.bg, 0.03);

        camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.1, 240);
        camera.position.set(11, 4.4, 16.5); // start pulled back for intro push-in

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.06; controls.enablePan = false;
        controls.minDistance = 4.2; controls.maxDistance = 22; controls.maxPolarAngle = Math.PI * 0.52; controls.enabled = false;

        buildLighting(); buildEnvironment();

        subject = new THREE.Group(); scene.add(subject);
        streamlines = new Streamlines(subject);
        // Resolve against Vite's base URL ("/aerovision/") so it works from
        // both "/aerovision" (cleanUrls, no trailing slash) and "/aerovision/".
        // A bare relative path resolves to the site root on the slash-less URL → 404.
        fetch(import.meta.env.BASE_URL + 'anantam-v1.stl').then(res => {
          if (!res.ok) throw new Error('Failed to fetch STL');
          return res.arrayBuffer();
        }).then(data => {
          const geo = new STLLoader().parse(data);
          setCar(meshFromGeometry(geo));
        }).catch(err => {
          console.error('Falling back to demo car due to error:', err);
          setCar(buildDemoCar());
        });

        initReveals(); initScrollTimeline(); initUpload(); initStudio();

        addEventListener('resize', onResize, { passive: true });

        // reveal stage, dismiss boot
        requestAnimationFrame(() => { mount.classList.add('ready'); setTimeout(() => boot.classList.add('gone'), 400); });
        last = performance.now(); requestAnimationFrame(frame);
      }

      /* ---------------- lighting ---------------- */
      function buildLighting() {
        const hemi = new THREE.HemisphereLight(0xbcd0ff, 0x090a0c, 0.5 * Math.PI); scene.add(hemi);
        const key = new THREE.DirectionalLight(0xffffff, 2.2 * Math.PI); key.position.set(6, 11, 7);
        key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
        key.shadow.camera.near = 1; key.shadow.camera.far = 40;
        key.shadow.camera.left = -12; key.shadow.camera.right = 12; key.shadow.camera.top = 12; key.shadow.camera.bottom = -12;
        key.shadow.bias = -0.0004; key.shadow.radius = 7; scene.add(key);
        const fill = new THREE.DirectionalLight(0x6f8bff, 0.55 * Math.PI); fill.position.set(-7, 4, 8); scene.add(fill);
        const rim = new THREE.DirectionalLight(0xffffff, 1.15 * Math.PI); rim.position.set(-4, 6, -9); scene.add(rim);
        const kick = new THREE.PointLight(0xE30613, 9 * 100, 20, 2.2); kick.position.set(7, 0.6, -4); scene.add(kick);
        const top = new THREE.SpotLight(0xffffff, 6.0 * 100, 30, Math.PI / 5, 0.7, 1.2);
        top.position.set(0, 9, 2); top.target.position.set(0, FLOOR_Y, 0); scene.add(top); scene.add(top.target);
      }

      /* ---------------- environment ---------------- */
      let dust;
      function buildEnvironment() {
        // procedural studio environment for reflections (no external dependency)
        const pmrem = new THREE.PMREMGenerator(renderer);
        const es = new THREE.Scene(); es.background = new THREE.Color(0x090a0c);
        const room = new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30),
          new THREE.MeshStandardMaterial({ side: THREE.BackSide, roughness: 1, metalness: 0, color: 0x121419 }));
        es.add(room);
        const glow = (hex, x, y, z, sx, sy, sz) => {
          const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz),
            new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide })); m.position.set(x, y, z); es.add(m);
        };
        glow(0xffffff, 0, 12, 2, 12, 0.2, 12);   // soft ceiling strip
        glow(0x2a3bff, -12, 3, 5, 0.2, 9, 10);   // cool wall
        glow(0xE30613, 11, -2, -5, 0.2, 7, 8);    // red motorsport kicker
        glow(0x6f8bff, 5, 6, -11, 8, 6, 0.2);    // back fill
        const env = pmrem.fromScene(es, 0.02).texture;
        scene.environment = env; pmrem.dispose();

        const floorMat = new THREE.MeshStandardMaterial({ color: 0x060708, roughness: 0.4, metalness: 0.6, envMapIntensity: 0.65 });
        const floor = new THREE.Mesh(new THREE.CircleGeometry(70, 96), floorMat);
        floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.receiveShadow = true; scene.add(floor);

        const grid = new THREE.GridHelper(120, 120, 0x161a20, 0x0d0f12);
        grid.position.y = FLOOR_Y + 0.001; grid.material.transparent = true; grid.material.opacity = 0.5; scene.add(grid);

        const blob = new THREE.Mesh(new THREE.PlaneGeometry(9, 5),
          new THREE.MeshBasicMaterial({ map: radialTex('rgba(0,0,0,0.55)'), transparent: true, depthWrite: false }));
        blob.rotation.x = -Math.PI / 2; blob.position.y = FLOOR_Y + 0.002; scene.add(blob);

        const N = 280, pos = new Float32Array(N * 3);
        for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() * 2 - 1) * 26; pos[i * 3 + 1] = Math.random() * 12 - 1; pos[i * 3 + 2] = (Math.random() * 2 - 1) * 26; }
        dust = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
          new THREE.PointsMaterial({ color: 0x9fb4e0, size: 0.03, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
        scene.add(dust);
        dust.userData.N = N;
      }
      function updateEnvironment(dt, t) {
        if (!dust) return; const p = dust.geometry.attributes.position, N = dust.userData.N;
        for (let i = 0; i < N; i++) { let y = p.getY(i) + dt * 0.11; if (y > 11) y = -1; p.setY(i, y); }
        p.needsUpdate = true; dust.rotation.y = t * 0.01;
      }
      function radialTex(color) {
        const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
        const g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
      }

      /* ---------------- geometry merge ---------------- */
      function mergeGeoms(geos, base) {
        base = base || [0.06, 0.07, 0.09];
        const ni = geos.map(g => { let x = g.index ? g.toNonIndexed() : g; if (!x.attributes.normal) x.computeVertexNormals(); return x; });
        let total = 0; ni.forEach(g => total += g.attributes.position.count);
        const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
        let o = 0; ni.forEach(g => { pos.set(g.attributes.position.array, o); nor.set(g.attributes.normal.array, o); o += g.attributes.position.array.length; });
        for (let i = 0; i < total; i++) { col[i * 3] = base[0]; col[i * 3 + 1] = base[1]; col[i * 3 + 2] = base[2]; }
        const out = new THREE.BufferGeometry();
        out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
        out.setAttribute('color', new THREE.BufferAttribute(col, 3));
        return out;
      }
      function carMaterial() { return new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.9, roughness: 0.28, vertexColors: true, envMapIntensity: 1.15 }); }

      /* ---------------- demo car ---------------- */
      function buildDemoCar() {
        const parts = [];
        const add = (geo, pos, rot, scl) => {
          pos = pos || [0, 0, 0]; rot = rot || [0, 0, 0]; scl = scl || [1, 1, 1];
          geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(pos[0], pos[1], pos[2]),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])), new THREE.Vector3(scl[0], scl[1], scl[2])));
          parts.push(geo);
        };
        const body = new THREE.CylinderGeometry(0.62, 0.40, 4.3, 26, 1); body.rotateZ(Math.PI / 2); add(body, [0, 0, 0], [0, 0, 0], [1, 0.6, 1.0]);
        const nose = new THREE.ConeGeometry(0.34, 1.35, 22); nose.rotateZ(-Math.PI / 2); add(nose, [2.7, -0.06, 0]);
        add(new THREE.SphereGeometry(0.5, 24, 18), [-0.6, 0.28, 0], [0, 0, 0], [2.0, 0.7, 0.75]);
        add(new THREE.SphereGeometry(0.42, 22, 16), [0.35, 0.24, 0], [0, 0, 0], [1.2, 0.7, 0.85]);
        [-1, 1].forEach(s => add(new THREE.BoxGeometry(1.8, 0.5, 0.55), [-0.4, -0.10, s * 0.62]));
        add(new THREE.BoxGeometry(0.55, 0.06, 2.7), [2.8, -0.34, 0]);
        add(new THREE.BoxGeometry(0.5, 0.36, 0.06), [2.82, -0.2, 1.34]); add(new THREE.BoxGeometry(0.5, 0.36, 0.06), [2.82, -0.2, -1.34]);
        add(new THREE.BoxGeometry(0.8, 0.06, 2.3), [-2.55, 0.6, 0], [0, 0, 0.14]);
        add(new THREE.BoxGeometry(0.06, 0.85, 0.1), [-2.55, 0.2, 1.05]); add(new THREE.BoxGeometry(0.06, 0.85, 0.1), [-2.55, 0.2, -1.05]);
        add(new THREE.BoxGeometry(0.9, 0.28, 1.4), [-2.35, -0.45, 0], [0, 0, -0.25]);
        const wheel = () => { const w = new THREE.CylinderGeometry(0.56, 0.56, 0.44, 24); w.rotateX(Math.PI / 2); return w; };
        [[1.75, 1.08], [1.75, -1.08], [-1.75, 1.08], [-1.75, -1.08]].forEach(p => add(wheel(), [p[0], -0.55, p[1]]));
        const mesh = new THREE.Mesh(mergeGeoms(parts), carMaterial()); mesh.castShadow = true; mesh.name = 'demoCar'; return mesh;
      }

      /* ---------------- model loading ---------------- */
      function loadModel(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        return readFile(file, ext).then(data => {
          if (ext === 'stl') { const g = new STLLoader().parse(data); return meshFromGeometry(g); }
          if (ext === 'obj') { return meshFromObject(new OBJLoader().parse(data)); }
          if (ext === 'glb' || ext === 'gltf') {
            return new Promise((res, rej) => {
              new GLTFLoader().parse(data, '', g => res(meshFromObject(g.scene)), rej);
            });
          }
          throw new Error('Unsupported format: .' + ext);
        });
      }
      function readFile(file, ext) {
        return new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read file'));
          if (ext === 'obj' || ext === 'gltf') r.readAsText(file); else r.readAsArrayBuffer(file);
        });
      }
      function meshFromGeometry(geo) { if (geo.index) geo = geo.toNonIndexed(); geo.computeVertexNormals(); return finalize(mergeGeoms([geo])); }
      function meshFromObject(root) {
        root.updateMatrixWorld(true); const geos = [];
        root.traverse(o => {
          if (o.isMesh && o.geometry) {
            let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
            if (!g.attributes.normal) g.computeVertexNormals(); g.applyMatrix4(o.matrixWorld);
            const c = new THREE.BufferGeometry(); c.setAttribute('position', g.attributes.position.clone());
            c.setAttribute('normal', g.attributes.normal.clone()); geos.push(c);
          }
        });
        if (!geos.length) throw new Error('No mesh geometry found in file');
        return finalize(mergeGeoms(geos));
      }
      function finalize(geo) {
        if (geo.attributes.uv) geo.deleteAttribute('uv');
        geo.center(); autoOrient(geo);
        const d = dims(geo); geo.scale(DISPLAY_LENGTH / Math.max(d.x, 1e-4), DISPLAY_LENGTH / Math.max(d.x, 1e-4), DISPLAY_LENGTH / Math.max(d.x, 1e-4));
        geo.computeBoundingBox(); geo.translate(0, FLOOR_Y - geo.boundingBox.min.y, 0); geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, carMaterial()); mesh.castShadow = true; mesh.name = 'userCar'; return mesh;
      }
      function dims(geo) { geo.computeBoundingBox(); const s = new THREE.Vector3(); geo.boundingBox.getSize(s); return s; }
      function autoOrient(geo) {
        let d = dims(geo);
        const longest = d.x >= d.y && d.x >= d.z ? 0 : (d.y >= d.z ? 1 : 2);
        if (longest === 1) geo.rotateZ(-Math.PI / 2); else if (longest === 2) geo.rotateY(Math.PI / 2);
        d = dims(geo); if (d.z < d.y) geo.rotateX(Math.PI / 2);
        geo.computeBoundingBox(); const pos = geo.attributes.position; let mx = 0;
        for (let i = 0; i < pos.count; i++)mx += pos.getX(i); mx /= pos.count; if (mx > 0) geo.rotateY(Math.PI);
      }

      /* ---------------- aero engine ---------------- */
      function analyze(mesh) {
        const geo = mesh.geometry, pos = geo.attributes.position; let nrm = geo.attributes.normal;
        if (!nrm) { geo.computeVertexNormals(); nrm = geo.attributes.normal; }
        geo.computeBoundingBox(); const bb = geo.boundingBox;
        const size = new THREE.Vector3(); bb.getSize(size); const center = new THREE.Vector3(); bb.getCenter(center);
        const L = size.x, W = size.z, H = size.y;
        const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), ab = new THREE.Vector3(), ac = new THREE.Vector3(), fn = new THREE.Vector3(), prev = new THREE.Vector3(), ctr = new THREE.Vector3();
        let area = 0, rough = 0, faces = 0, downArea = 0, wheelArea = 0;
        const slice = { front: nb(), mid: nb(), rear: nb() };
        const xF = center.x + L / 6, xR = center.x - L / 6, yLow = center.y - H / 6;
        for (let i = 0; i < pos.count; i += 3) {
          a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
          ab.subVectors(b, a); ac.subVectors(c, a); fn.crossVectors(ab, ac);
          const ar = fn.length() * 0.5; area += ar; if (ar < 1e-9) continue; fn.normalize();
          if (faces > 0) rough += 1 - Math.abs(fn.dot(prev)); prev.copy(fn); faces++;
          ctr.copy(a).add(b).add(c).multiplyScalar(1 / 3);
          if (fn.y < -0.3) downArea += ar; if (Math.abs(fn.z) > 0.6 && ctr.y < yLow) wheelArea += ar;
          const bk = ctr.x > xF ? slice.front : (ctr.x < xR ? slice.rear : slice.mid); grow(bk, ctr);
        }
        rough = faces > 1 ? rough / (faces - 1) : 0.3; const surf = area;
        const Amid = ra(slice.mid), Afront = ra(slice.front), Arear = ra(slice.rear);
        const noseSharp = clamp(1 - Afront / Math.max(Amid, 1e-6), 0, 1);
        const tailTaper = clamp(1 - Arear / Math.max(Amid, 1e-6), 0, 1);
        const boxiness = clamp(Amid / Math.max(W * H, 1e-6), 0, 1);
        const slender = L / Math.max(H, 1e-6);
        const downFrac = downArea / Math.max(surf, 1e-6);
        const wheelFrac = clamp(wheelArea / Math.max(surf, 1e-6) * 3.0, 0, 1);
        let cd = 0.14 + 0.18 * boxiness + 0.14 * clamp(rough - 0.25, 0, 1) - 0.10 * noseSharp - 0.06 * tailTaper - 0.05 * clamp((slender - 3) / 6, 0, 1) + 0.10 * wheelFrac;
        cd = clamp(cd, STEM.cdMin, STEM.cdMax);
        const toReal = STEM.carLength / Math.max(L, 1e-6);
        const frontalArea = (W * toReal) * (H * toReal) * STEM.frontalFill;
        const df = clamp((0.2 + 1.6 * downFrac + 0.4 * (W / L) - 0.5 * (H / L)) * 100, 5, 98);
        const efficiency = clamp((df / 100) / cd * 1.4, 0.4, 9);
        const flowQuality = clamp(100 * (0.5 + 0.4 * noseSharp + 0.3 * tailTaper - 0.5 * rough - 0.3 * wheelFrac), 6, 99);
        const run = simulateRun(cd, frontalArea);
        const tScore = clamp((2.1 - run.time) / (2.1 - 0.85) * 100, 8, 100);
        const score = clamp(Math.round(tScore * 0.78 + (efficiency / 9 * 100) * 0.22), 1, 100);
        return {
          dims: { L, W, H }, center, half: { L: L / 2, W: W / 2, H: H / 2 }, triangles: (pos.count / 3) | 0, cd, frontalArea,
          frontalAreaCm2: frontalArea * 1e4, downforce: Math.round(df), efficiency, flowQuality: Math.round(flowQuality),
          runTime: run.time, topMps: run.top, topMph: run.top * 2.23694, score,
          noseSharp, tailTaper, boxiness, rough, wheelFrac, slender, downFrac
        };
      }
      function simulateRun(cd, A) {
        const { airDensity: rho, mass: m, co2Impulse: J, burnTime: tb, rollCoef, dragGain, trackLength } = STEM;
        const dt = 0.0002, avg = J / tb; let v = 0, x = 0, t = 0, top = 0;
        while (x < trackLength && t < 6) {
          const th = t < tb ? avg * (2.0 * Math.exp(-t / tb * 2.0)) : 0;
          const dr = 0.5 * rho * cd * A * dragGain * v * v, fr = rollCoef * m * 9.81;
          const ac = (th - dr - (v > 0 ? fr : 0)) / m; v = Math.max(0, v + ac * dt); x += v * dt; t += dt; if (v > top) top = v;
        }
        return { time: clamp(t, 0.80, 2.2), top: clamp(top, 12, 34) };
      }
      function nb() { return { ymin: 1e9, ymax: -1e9, zmin: 1e9, zmax: -1e9, n: 0 }; }
      function grow(b, p) { if (p.y < b.ymin) b.ymin = p.y; if (p.y > b.ymax) b.ymax = p.y; if (p.z < b.zmin) b.zmin = p.z; if (p.z > b.zmax) b.zmax = p.z; b.n++; }
      function ra(b) { return b.n ? Math.max(b.ymax - b.ymin, 1e-4) * Math.max(b.zmax - b.zmin, 1e-4) : 1e-4; }

      /* ---------------- pressure ---------------- */
      const NEUTRAL = [0.055, 0.065, 0.085].map(toLin);
      function computePressure(mesh) {
        const geo = mesh.geometry, nrm = geo.attributes.normal, n = geo.attributes.position.count;
        const base = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
          const nx = nrm.getX(i), ny = nrm.getY(i); const facing = clamp(nx, -1, 1), upper = clamp(ny, 0, 1);
          let t = facing * 0.5 + 0.5; t = t * 0.82 - upper * 0.18 * (1 - facing * 0.5); const cc = rampAt(PRESSURE_RAMP, t);
          base[i * 3] = cc[0]; base[i * 3 + 1] = cc[1]; base[i * 3 + 2] = cc[2];
        }
        mesh.userData.pressure = base; return base;
      }
      function setNeutral(mesh) { const col = mesh.geometry.attributes.color; for (let i = 0; i < col.count; i++)col.setXYZ(i, NEUTRAL[0], NEUTRAL[1], NEUTRAL[2]); col.needsUpdate = true; }
      function setPressure(mesh) { const b = mesh.userData.pressure || computePressure(mesh); mesh.geometry.attributes.color.array.set(b); mesh.geometry.attributes.color.needsUpdate = true; }
      function blendPressure(mesh, amt) {
        const b = mesh.userData.pressure; if (!b) return; const col = mesh.geometry.attributes.color, a = clamp(amt, 0, 1);
        for (let i = 0; i < col.count; i++)col.setXYZ(i, NEUTRAL[0] + (b[i * 3] - NEUTRAL[0]) * a, NEUTRAL[1] + (b[i * 3 + 1] - NEUTRAL[1]) * a, NEUTRAL[2] + (b[i * 3 + 2] - NEUTRAL[2]) * a);
        col.needsUpdate = true;
      }

      /* ---------------- streamlines (signature feature) ---------------- */
      function Streamlines(parent) {
        this.parent = parent; this.group = new THREE.Group(); parent.add(this.group);
        this.lines = []; this.pulses = []; this.mode = 'airflow'; this._t = 0; this._line = null; this._pulse = null;
      }
      Streamlines.prototype.dispose = function () {
        while (this.group.children.length) {
          const c = this.group.children.pop();
          if (c.geometry) c.geometry.dispose(); if (c.material) { (Array.isArray(c.material) ? c.material : [c.material]).forEach(m => m.dispose()); }
        }
        this.lines = []; this.pulses = [];
      };
      Streamlines.prototype.build = function (p) {
        this.dispose();
        const c = p.center.clone();
        const r = new THREE.Vector3(p.half.L * 1.06, p.half.H * 1.08, p.half.W * 1.08);
        this.field = {
          c, r, vort: [
            { y: c.y + r.y * 0.55, z: c.z + r.z * 0.7, sign: +1, g: 0.5 },
            { y: c.y + r.y * 0.55, z: c.z - r.z * 0.7, sign: -1, g: 0.5 },
            { y: c.y - r.y * 0.5, z: c.z + r.z * 0.9, sign: -1, g: 0.28 },
            { y: c.y - r.y * 0.5, z: c.z - r.z * 0.9, sign: +1, g: 0.28 },
          ]
        };
        const span = Math.max(r.y, r.z) * 1.95, x0 = c.x + r.x * 1.5 + 0.9;
        const NY = 10, NZ = 18, RES = 64;
        const segPos = [], segCol = [];
        for (let iy = 0; iy < NY; iy++)for (let iz = 0; iz < NZ; iz++) {
          const y = c.y + (iy / (NY - 1) * 2 - 1) * span * 0.62, z = c.z + (iz / (NZ - 1) * 2 - 1) * span;
          const raw = this._integrate(new THREE.Vector3(x0, y, z), c, r);
          if (raw.P < 6) continue;
          const line = this._smooth(raw, RES);       // Catmull-Rom resample → silky
          this.lines.push(line);
          for (let k = 0; k < line.P - 1; k++) {
            const A = k * 3, B = (k + 1) * 3;
            // fade the head/tail of each line for an organic look
            const fa = edgeFade(k, line.P), fb = edgeFade(k + 1, line.P);
            segPos.push(line.pts[A], line.pts[A + 1], line.pts[A + 2], line.pts[B], line.pts[B + 1], line.pts[B + 2]);
            const c1 = spdCol(line.spd[k]), c2 = spdCol(line.spd[k + 1]);
            segCol.push(c1[0] * fa, c1[1] * fa, c1[2] * fa, c2[0] * fb, c2[1] * fb, c2[2] * fb);
          }
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(segPos, 3));
        g.setAttribute('color', new THREE.Float32BufferAttribute(segCol, 3));
        const m = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
        this._line = new THREE.LineSegments(g, m); this._line.frustumCulled = false; this.group.add(this._line);
        // flowing pulses
        const per = 2;
        for (let li = 0; li < this.lines.length; li++)for (let k = 0; k < per; k++)
          this.pulses.push({ line: li, idx: Math.random() * this.lines[li].P, spd: 22 + Math.random() * 10 });
        const pp = new Float32Array(this.pulses.length * 3), pc = new Float32Array(this.pulses.length * 3);
        const pg = new THREE.BufferGeometry();
        pg.setAttribute('position', new THREE.BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
        const pm = new THREE.PointsMaterial({ size: 0.13, map: softSprite(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true, sizeAttenuation: true });
        this._pulse = new THREE.Points(pg, pm); this._pulse.frustumCulled = false; this.group.add(this._pulse);
      };
      Streamlines.prototype._integrate = function (p, c, r) {
        const pts = [], spd = [], v = new THREE.Vector3(), v2 = new THREE.Vector3();
        const maxSteps = 220, dt = 0.04, xEnd = c.x - r.x - 3.8; p = p.clone();
        for (let s = 0; s < maxSteps; s++) {
          this._vel(p, c, r, v); pts.push(p.x, p.y, p.z); spd.push(v.length());
          const mid = p.clone().addScaledVector(v, dt * 0.5); this._vel(mid, c, r, v2); p.addScaledVector(v2, dt);
          if (p.x < xEnd) break;
        }
        return { pts, spd, P: pts.length / 3 };
      };
      Streamlines.prototype._smooth = function (raw, RES) {
        const vs = []; for (let i = 0; i < raw.P; i++)vs.push(new THREE.Vector3(raw.pts[i * 3], raw.pts[i * 3 + 1], raw.pts[i * 3 + 2]));
        const curve = new THREE.CatmullRomCurve3(vs, false, 'catmullrom', 0.5);
        const n = Math.max(8, Math.min(RES, raw.P)); const sp = curve.getSpacedPoints(n - 1);
        const pts = new Float32Array(n * 3), spd = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          pts[i * 3] = sp[i].x; pts[i * 3 + 1] = sp[i].y; pts[i * 3 + 2] = sp[i].z;
          const f = i / (n - 1) * (raw.P - 1); spd[i] = raw.spd[Math.min(raw.P - 1, Math.round(f))];
        }
        return { pts, spd, P: n };
      };
      Streamlines.prototype._vel = function (p, c, r, out) {
        out.set(-1, 0, 0);
        const qx = (p.x - c.x) / r.x, qy = (p.y - c.y) / r.y, qz = (p.z - c.z) / r.z;
        const d = Math.sqrt(qx * qx + qy * qy + qz * qz) + 1e-5;
        if (d < 1.6) {
          let nx = qx / r.x, ny = qy / r.y, nz = qz / r.z; const nl = Math.hypot(nx, ny, nz) + 1e-6; nx /= nl; ny /= nl; nz /= nl;
          const prox = clamp((1.6 - d) / 1.6, 0, 1);
          const vn = out.x * nx + out.y * ny + out.z * nz; if (vn < 0) { out.x -= nx * vn; out.y -= ny * vn; out.z -= nz * vn; }
          out.x += nx * prox * 1.2 - prox * 0.25; out.y += ny * prox * 1.2; out.z += nz * prox * 1.2;
          if (qy > 0) out.x -= prox * 0.9 * qy;
        }
        if (p.x < c.x + r.x * 0.2) {
          for (let i = 0; i < this.field.vort.length; i++) {
            const w = this.field.vort[i];
            const dy = p.y - w.y, dz = p.z - w.z, rr = Math.hypot(dy, dz) + 0.001, core = 0.4;
            const fade = clamp((c.x + r.x * 0.2 - p.x) / (r.x * 2.2), 0, 1), mag = w.sign * w.g / (rr + core) * fade;
            out.y += (-dz / rr) * mag; out.z += (dy / rr) * mag;
          }
        }
        if (p.x < c.x - r.x * 0.7) {
          const back = clamp((c.x - r.x * 0.7 - p.x) / (r.x * 2.6), 0, 1);
          out.x *= (1 - back * 0.42);
          out.y += Math.sin(p.z * 2.4 + p.x * 1.1) * back * 0.10;   // gentler, less noisy wake
          out.z += Math.cos(p.y * 2.4 + p.x * 1.1) * back * 0.10;
        }
      };
      Streamlines.prototype.setMode = function (m) { this.mode = m; };
      Streamlines.prototype.update = function (dt, intensity) {
        this._t += dt; if (!this._line) return;
        const vis = intensity > 0.01; this.group.visible = vis; if (!vis) return;
        const wake = this.mode === 'wake';
        this._line.material.opacity = (wake ? 0.13 : 0.2) * clamp(intensity, 0, 1) + 0.02;
        this._pulse.material.opacity = clamp(intensity, 0, 1);
        this._pulse.material.size = wake ? 0.16 : 0.13;
        const pos = this._pulse.geometry.attributes.position, col = this._pulse.geometry.attributes.color;
        for (let i = 0; i < this.pulses.length; i++) {
          const pu = this.pulses[i], ln = this.lines[pu.line];
          pu.idx += pu.spd * dt; if (pu.idx >= ln.P - 1) pu.idx -= (ln.P - 1);
          const i0 = Math.floor(pu.idx), f = pu.idx - i0, i1 = Math.min(i0 + 1, ln.P - 1), ax = i0 * 3, bx = i1 * 3;
          pos.setXYZ(i, lerp(ln.pts[ax], ln.pts[bx], f), lerp(ln.pts[ax + 1], ln.pts[bx + 1], f), lerp(ln.pts[ax + 2], ln.pts[bx + 2], f));
          const sp = lerp(ln.spd[i0], ln.spd[i1], f), cc = spdCol(sp, true); col.setXYZ(i, cc[0], cc[1], cc[2]);
        }
        pos.needsUpdate = true; col.needsUpdate = true;
      };
      function edgeFade(k, P) { const t = k / (P - 1); return clamp(Math.min(t * 4, (1 - t) * 3), 0, 1); }
      function spdCol(s, bright) { const sN = clamp(s / 2.6, 0, 1); return [lerp(bright ? 0.5 : 0.3, 1.0, sN), lerp(bright ? 0.7 : 0.56, 1.0, sN), 1.0]; }
      function softSprite() {
        const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
        const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(235,244,255,1)');
        g.addColorStop(0.35, 'rgba(140,182,255,0.7)'); g.addColorStop(1, 'rgba(40,90,220,0)');
        x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
      }

      /* ---------------- car swap ---------------- */
      function setCar(mesh) {
        if (currentMesh) { subject.remove(currentMesh); currentMesh.geometry.dispose(); currentMesh.material.dispose(); }
        currentMesh = mesh; subject.add(mesh);
        profile = analyze(mesh); computePressure(mesh); setNeutral(mesh); streamlines.build(profile);
      }

      /* ---------------- UI: reveals ---------------- */
      function initReveals() {
        const io = new IntersectionObserver(es => { es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { threshold: 0.2 });
        document.querySelectorAll('.reveal').forEach(el => io.observe(el));
        document.querySelectorAll('#hero .reveal').forEach(el => el.classList.add('in'));
      }

      /* ================================================================
         SCROLL TIMELINE — Apple-style cinematic scroll controller.
         
         Architecture:
         - scrollTarget is always an INTEGER (the scene index to snap to).
         - scrollCurrent smoothly interpolates toward scrollTarget.
         - Each wheel/touch gesture is debounced: we accumulate delta and
           only commit a scene change when the accumulated delta exceeds
           a threshold, preventing accidental double-skips.
         - A cooldown timer prevents rapid-fire scene changes.
         - The result: one deliberate scroll gesture = one scene transition,
           with buttery smooth interpolation between scenes.
         ================================================================ */
      const targets = { flow: 0.2, pressure: 0.0, spin: 0.14 };
      const curr = { flow: 0.2, pressure: 0.0, spin: 0.14 };
      let scrollCurrent = 0;
      let scrollTarget = 0;
      let scrollAccum = 0;          // accumulated wheel delta within a gesture
      let scrollCooldown = 0;       // timestamp when cooldown expires
      let lastGestureTime = 0;      // for detecting gesture boundaries
      const SCROLL_THRESHOLD = 50;  // px of accumulated wheel delta to trigger scene change
      const SCROLL_COOLDOWN = 800;  // ms to wait after a scene change before allowing another
      const TOTAL_SCENES = 7;       // last index (footer)

      function initScrollTimeline() {
        /* ---------- wheel (mouse + trackpad) ---------- */
        window.addEventListener('wheel', e => {
          if (studioMode || document.getElementById('scanner').classList.contains('on')) return;
          e.preventDefault();

          const now = performance.now();

          // If there's been a gap of >300ms since last wheel event, this is a new gesture
          if (now - lastGestureTime > 300) {
            scrollAccum = 0;
          }
          lastGestureTime = now;

          // If we're in cooldown, eat the event (absorbs trackpad momentum)
          if (now < scrollCooldown) return;

          // Accumulate the delta
          scrollAccum += e.deltaY;

          // Check if accumulated delta exceeds threshold
          if (Math.abs(scrollAccum) >= SCROLL_THRESHOLD) {
            if (scrollAccum > 0 && scrollTarget < TOTAL_SCENES) {
              // Scroll down → next scene
              scrollTarget = Math.min(TOTAL_SCENES, scrollTarget + 1);
              scrollCooldown = now + SCROLL_COOLDOWN;
              scrollAccum = 0;
            } else if (scrollAccum < 0 && scrollTarget > 0) {
              // Scroll up → previous scene
              scrollTarget = Math.max(0, scrollTarget - 1);
              scrollCooldown = now + SCROLL_COOLDOWN;
              scrollAccum = 0;
            }
          }
        }, { passive: false });

        /* ---------- touch (mobile swipes) ---------- */
        let touchStartY = 0;
        let touchAccum = 0;

        window.addEventListener('touchstart', e => {
          if (studioMode || document.getElementById('scanner').classList.contains('on')) return;
          touchStartY = e.touches[0].clientY;
          touchAccum = 0;
        }, { passive: true });

        window.addEventListener('touchmove', e => {
          if (studioMode || document.getElementById('scanner').classList.contains('on')) return;
          if (e.cancelable) e.preventDefault();

          const now = performance.now();
          if (now < scrollCooldown) return;

          const touchY = e.touches[0].clientY;
          const dy = touchStartY - touchY; // positive = swipe up = scroll down
          touchStartY = touchY;
          touchAccum += dy;

          if (Math.abs(touchAccum) >= 40) {
            if (touchAccum > 0 && scrollTarget < TOTAL_SCENES) {
              scrollTarget = Math.min(TOTAL_SCENES, scrollTarget + 1);
              scrollCooldown = now + SCROLL_COOLDOWN;
              touchAccum = 0;
            } else if (touchAccum < 0 && scrollTarget > 0) {
              scrollTarget = Math.max(0, scrollTarget - 1);
              scrollCooldown = now + SCROLL_COOLDOWN;
              touchAccum = 0;
            }
          }
        }, { passive: false });

        /* ---------- keyboard ---------- */
        window.addEventListener('keydown', e => {
          if (studioMode || document.getElementById('scanner').classList.contains('on')) return;
          const now = performance.now();
          if (now < scrollCooldown) return;

          if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ') {
            e.preventDefault();
            if (scrollTarget < TOTAL_SCENES) {
              scrollTarget++;
              scrollCooldown = now + SCROLL_COOLDOWN;
            }
          } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
            e.preventDefault();
            if (scrollTarget > 0) {
              scrollTarget--;
              scrollCooldown = now + SCROLL_COOLDOWN;
            }
          }
        });

        /* ---------- dot navigation clicks ---------- */
        document.querySelectorAll('#sceneDots .dot').forEach(btn => {
          btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.sceneIdx, 10);
            if (!isNaN(idx) && idx >= 0 && idx <= TOTAL_SCENES) {
              scrollTarget = idx;
              scrollCooldown = performance.now() + SCROLL_COOLDOWN;
            }
          });
        });
      }

      function getInterpolatedScene(tGlobalValue) {
        const idx = Math.floor(tGlobalValue);
        const f = tGlobalValue - idx;
        const k1 = SCENE_KEYS[idx];
        const k2 = SCENE_KEYS[Math.min(SCENE_KEYS.length - 1, idx + 1)];
        const s1 = SCENES[k1];
        const s2 = SCENES[k2];

        const cam = [
          lerp(s1.cam[0], s2.cam[0], f),
          lerp(s1.cam[1], s2.cam[1], f),
          lerp(s1.cam[2], s2.cam[2], f)
        ];
        const look = [
          lerp(s1.look[0], s2.look[0], f),
          lerp(s1.look[1], s2.look[1], f),
          lerp(s1.look[2], s2.look[2], f)
        ];
        const spin = lerp(s1.spin, s2.spin, f);
        const flow = lerp(s1.flow, s2.flow, f);
        const pressure = lerp(s1.pressure, s2.pressure, f);
        const offset = lerp(s1.offset, s2.offset, f);

        return { cam, look, spin, flow, pressure, offset };
      }

      function updatePanels() {
        const panels = document.querySelectorAll('#scroll .panel');
        const footer = document.getElementById('foot');

        if (studioMode) {
          document.getElementById('scroll').style.opacity = '0';
          document.getElementById('scroll').style.visibility = 'hidden';
          footer.style.opacity = '0';
          footer.style.visibility = 'hidden';
          return;
        } else {
          document.getElementById('scroll').style.opacity = '1';
          document.getElementById('scroll').style.visibility = 'visible';
        }

        panels.forEach((panel, i) => {
          const diff = scrollCurrent - i;
          
          if (diff > -1 && diff < 1) {
            panel.style.visibility = 'visible';
            
            let panelOpacity = 0;
            let translateY = 0;
            let blur = 0;
            
            if (diff <= 0) {
              const enterProgress = 1 + diff; // 0 to 1
              panelOpacity = enterProgress;
              translateY = (1 - enterProgress) * 60;
              blur = (1 - enterProgress) * 8;
              
              const reveals = panel.querySelectorAll('.reveal');
              reveals.forEach(el => {
                let delay = 0;
                if (el.classList.contains('d1')) delay = 0.12;
                else if (el.classList.contains('d2')) delay = 0.24;
                else if (el.classList.contains('d3')) delay = 0.36;
                
                const elProgress = clamp((enterProgress - delay) / (1 - delay), 0, 1);
                
                el.style.opacity = elProgress;
                el.style.transform = `translateY(${(1 - elProgress) * 30}px)`;
                el.style.filter = `blur(${(1 - elProgress) * 4}px)`;
              });
            } else {
              const exitProgress = diff; // 0 to 1
              panelOpacity = 1 - exitProgress;
              translateY = -exitProgress * 60;
              blur = exitProgress * 8;
              
              const reveals = panel.querySelectorAll('.reveal');
              reveals.forEach(el => {
                el.style.opacity = 1 - exitProgress;
                el.style.transform = 'none';
                el.style.filter = 'none';
              });
            }
            
            panel.style.opacity = panelOpacity;
            panel.style.transform = `translateY(${translateY}px)`;
            panel.style.filter = blur > 0.1 ? `blur(${blur}px)` : 'none';
            panel.style.pointerEvents = panelOpacity > 0.6 ? 'auto' : 'none';
            
          } else {
            panel.style.opacity = '0';
            panel.style.visibility = 'hidden';
            panel.style.pointerEvents = 'none';
          }
        });

        const footerDiff = scrollCurrent - 7;
        if (footerDiff > -1) {
          footer.style.visibility = 'visible';
          const footerProgress = 1 + footerDiff; // 0 to 1
          footer.style.opacity = footerProgress;
          footer.style.transform = `translateY(${(1 - footerProgress) * 50}px)`;
          footer.style.pointerEvents = footerProgress > 0.6 ? 'auto' : 'none';
        } else {
          footer.style.opacity = '0';
          footer.style.visibility = 'hidden';
          footer.style.pointerEvents = 'none';
        }

        // Update scene dot navigation
        const activeScene = Math.round(scrollCurrent);
        const dots = document.querySelectorAll('#sceneDots .dot');
        dots.forEach((d, i) => {
          d.classList.toggle('active', i === activeScene);
        });
      }

      /* ---------------- UI: upload + scanner ---------------- */
      function initUpload() {
        const drop = document.getElementById('drop'), input = document.getElementById('file');
        drop.addEventListener('click', () => input.click());
        input.addEventListener('change', e => { if (e.target.files[0]) go(e.target.files[0]); });
        ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('hot'); }));
        ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('hot'); }));
        drop.addEventListener('drop', e => { const f = e.dataTransfer.files[0]; if (f) go(f); });
        addEventListener('dragover', e => e.preventDefault());
        addEventListener('drop', e => { e.preventDefault(); if (e.target !== drop && e.dataTransfer.files[0]) go(e.dataTransfer.files[0]); });
      }
      function go(file) {
        if (!/\.(obj|glb|gltf|stl)$/i.test(file.name)) { uploadFail('Use an OBJ, GLB, GLTF or STL file'); return; }
        runScan(() => loadModel(file).then(mesh => { setCar(mesh); enterStudio(file.name); archiveAero(file.name); }).catch(err => uploadFail((err && err.message) || 'Could not read that model')));
      }
      /* Internal archival only — best-effort, fire-and-forget. Sends a bundle
         (metadata + aero metrics + a rendered thumbnail) to /api/archive after
         results are shown. Never awaited, swallows every error, and shows
         nothing to the user: if it fails for any reason (offline, server down,
         Drive misconfigured), AeroVision is completely unaffected. */
      function archiveAero(fileName) {
        try {
          var meta = {
            fileName: fileName,
            score: profile && profile.score,
            cd: profile && profile.cd,
            frontalAreaCm2: profile && profile.frontalAreaCm2,
            runTime: profile && profile.runTime,
            source: 'AeroVision web app'
          };
          var files = [
            { name: 'analysis.json', mimeType: 'application/json', content: safeJson({ fileName: fileName, metrics: profile }) },
            { name: 'metadata.json', mimeType: 'application/json', content: safeJson(meta) }
          ];
          var thumb = captureAeroThumbnail();
          if (thumb) files.push({ name: 'thumbnail.webp', mimeType: 'image/webp', contentBase64: thumb });
          fetch('/api/archive', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tool: 'AeroVision', uploadId: makeArchiveId(), timestamp: new Date().toISOString(), meta: meta, files: files }),
            keepalive: true
          }).catch(function () { /* best-effort — ignore all failures */ });
        } catch (e) { /* archival must never throw into the app */ }
      }
      function captureAeroThumbnail() {
        try {
          var src = renderer && renderer.domElement;
          if (!src || !src.width || !src.height) return null;
          try { renderer.render(scene, camera); } catch (e) { /* capture whatever is present */ }
          var w = 640, h = Math.max(1, Math.round(640 * src.height / src.width));
          var c = document.createElement('canvas'); c.width = w; c.height = h;
          var ctx = c.getContext('2d'); if (!ctx) return null;
          ctx.drawImage(src, 0, 0, w, h);
          var url = c.toDataURL('image/webp', 0.72);
          var comma = url.indexOf(',');
          return comma >= 0 ? url.slice(comma + 1) : null;
        } catch (e) { return null; }
      }
      function makeArchiveId() {
        try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
        return 'av-' + Date.now() + '-' + Math.floor(Math.random() * 1e9).toString(36);
      }
      function safeJson(v) { try { return JSON.stringify(v, null, 2); } catch (e) { return '{}'; } }
      function runScan(done) {
        const sc = document.getElementById('scanner'), fill = document.getElementById('scanFill'), pct = document.getElementById('scanPct'), step = document.getElementById('scanStep');
        sc.classList.add('on'); let p = 0, si = -1;
        (function tick() {
          p = Math.min(100, p + Math.random() * 13 + 4); fill.style.width = p + '%'; pct.textContent = Math.round(p) + '%';
          const ns = Math.min(SCAN_STEPS.length - 1, Math.floor(p / 100 * SCAN_STEPS.length)); if (ns !== si) { si = ns; step.textContent = SCAN_STEPS[si]; }
          if (p < 100) setTimeout(tick, 130); else setTimeout(() => { sc.classList.remove('on'); done(); }, 380);
        })();
      }
      function uploadFail(msg) {
        document.getElementById('scanner').classList.remove('on');
        const drop = document.getElementById('drop'), t = drop.querySelector('.drop-title'), s = drop.querySelector('.drop-sub');
        t.textContent = 'Couldn’t read that model'; s.textContent = msg; drop.style.borderColor = 'var(--red)';
        setTimeout(() => { t.textContent = 'Drop your model to begin'; s.textContent = 'or click to choose a file'; drop.style.borderColor = ''; }, 2800);
      }

      /* ---------------- UI: studio ---------------- */
      let studioMode = false;
      function initStudio() {
        const seg = document.getElementById('viewSeg');
        seg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
          seg.querySelectorAll('button').forEach(x => x.classList.remove('on')); b.classList.add('on'); applyView(b.dataset.view);
        }));
        document.getElementById('closeStudio').addEventListener('click', exitStudio);
        document.querySelectorAll('#cams button').forEach(b => b.addEventListener('click', () => applyCam(b.dataset.cam)));
        document.getElementById('openReport').addEventListener('click', openReport);
        document.getElementById('closeReport').addEventListener('click', closeReport);
        document.getElementById('capture').addEventListener('click', capture);
        document.getElementById('report').addEventListener('click', e => { if (e.target.id === 'report') closeReport(); });
        addEventListener('keydown', e => { if (e.key === 'Escape') { if (document.getElementById('report').classList.contains('on')) closeReport(); else if (studioMode) exitStudio(); } });
      }
      function enterStudio(name) {
        studioMode = true; document.body.style.overflow = 'hidden'; document.body.classList.add('studio-open'); subject.rotation.y = 0;
        camTarget.set(6.4, 2.3, 9.4); lookTarget.set(0, 0.1, 0);
        controls.target.set(0, 0.1, 0); controls.enabled = true; controls.update();
        targets.flow = 1.0; targets.pressure = 0.0; targets.spin = 0.0;
        streamlines.setMode('airflow'); setNeutral(currentMesh); currentMesh.material.wireframe = false;
        const seg = document.getElementById('viewSeg'); seg.querySelectorAll('button').forEach((x, i) => x.classList.toggle('on', i === 0));
        document.getElementById('modelName').textContent = name.replace(/\.[^.]+$/, '') || 'Your model';
        document.getElementById('modelSub').textContent = profile.triangles.toLocaleString() + ' triangles · deterministic estimate';
        const st = document.getElementById('studio'); st.classList.add('on'); st.setAttribute('aria-hidden', 'false');
        countMetric('cd', profile.cd, 3); countMetric('time', profile.runTime, 3, ' s');
        countMetric('top', profile.topMph, 0, '', ' mph'); countMetric('fa', profile.frontalAreaCm2, 1, '', ' cm²');
        countMetric('df', profile.downforce, 0); countMetric('flowq', profile.flowQuality, 0, '', '%');
        countScore(profile.score);
        requestAnimationFrame(() => { document.getElementById('scoreBar').style.width = profile.score + '%'; });
        document.getElementById('scoreNote').textContent = scoreLabel(profile.score) + ' · STEM Racing';
        fillSubs(profile); closeReport(); applyCam('hero');
      }
      function exitStudio() {
        studioMode = false; document.body.classList.remove('studio-open'); currentMesh.material.wireframe = false;
        controls.enabled = false; const st = document.getElementById('studio'); st.classList.remove('on'); st.setAttribute('aria-hidden', 'true');
        scrollTarget = 6; // return to launch scene
      }
      function applyView(mode) {
        if (!currentMesh) return; currentMesh.material.wireframe = (mode === 'wire');
        if (mode === 'pressure') { targets.flow = 0.18; targets.pressure = 1.0; setPressure(currentMesh); streamlines.setMode('airflow'); }
        else if (mode === 'wake') { targets.flow = 1.0; targets.pressure = 0.0; setNeutral(currentMesh); streamlines.setMode('wake'); }
        else if (mode === 'wire') { targets.flow = 0.4; targets.pressure = 0.0; setNeutral(currentMesh); streamlines.setMode('airflow'); }
        else { targets.flow = 1.0; targets.pressure = 0.0; setNeutral(currentMesh); streamlines.setMode('airflow'); }
      }
      function countMetric(name, target, dec, pre, suf) {
        pre = pre || ''; suf = suf || '';
        const el = document.querySelector('#metrics .v[data-metric="' + name + '"]'); if (!el) return;
        const t0 = performance.now(), dur = 950;
        (function run(now) {
          const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3), v = target * e;
          el.innerHTML = pre + v.toFixed(dec) + (suf ? '<small>' + suf + '</small>' : ''); if (k < 1) requestAnimationFrame(run);
        })(t0);
      }
      function countScore(target) {
        const el = document.getElementById('scoreVal'), t0 = performance.now(), dur = 1100;
        (function run(now) { const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.textContent = Math.round(target * e); if (k < 1) requestAnimationFrame(run); })(t0);
      }
      function scoreLabel(s) { return s >= 85 ? 'Exceptional' : s >= 70 ? 'Strong' : s >= 50 ? 'Competitive' : s >= 32 ? 'Developing' : 'High drag'; }

      /* ---------------- cinematic camera presets ---------------- */
      let camTween = null;
      const CAM_PRESETS = {
        hero: { p: [6.4, 2.3, 9.4], t: [0, 0.1, 0] },
        front: { p: [9.4, 1.5, 0.01], t: [0, 0.1, 0] },
        side: { p: [0.01, 1.4, 9.8], t: [0, 0.1, 0] },
        top: { p: [0.01, 10.6, 0.01], t: [0, 0, 0] },
        chase: { p: [6.9, 1.0, 6.3], t: [0, 0.25, 0] },
      };
      function flyTo(p, t, dur) {
        camTween = {
          fp: camera.position.clone(), tp: new THREE.Vector3(p[0], p[1], p[2]),
          ft: controls.target.clone(), tt: new THREE.Vector3(t[0], t[1], t[2]), k: 0, dur: dur || 1.15
        };
      }
      function applyCam(name) {
        const c = CAM_PRESETS[name] || CAM_PRESETS.hero; flyTo(c.p, c.t);
        document.querySelectorAll('#cams button').forEach(b => b.classList.toggle('on', b.dataset.cam === name));
      }

      /* ---------------- sub-scores + engineering report ---------------- */
      function computeSubs(p) {
        return {
          eff: clamp(p.efficiency / 9 * 100, 4, 99),
          df: clamp(p.downforce, 4, 99),
          flow: clamp(p.flowQuality, 4, 99),
          stab: clamp(46 + p.tailTaper * 34 + p.downforce * 0.14 - p.wheelFrac * 30 - (p.dims.H / p.dims.L) * 22, 6, 98),
        };
      }
      function fillSubs(p) {
        const s = computeSubs(p);
        const set = (k, v) => { const el = document.querySelector('#subs [data-sub="' + k + '"]'); if (el) el.style.width = Math.round(v) + '%'; };
        set('eff', 0); set('df', 0); set('flow', 0); set('stab', 0);
        requestAnimationFrame(() => requestAnimationFrame(() => { set('eff', s.eff); set('df', s.df); set('flow', s.flow); set('stab', s.stab); }));
      }
      function generateReport(p) {
        const s = computeSubs(p);
        const verdict = p.score >= 85 ? 'Exceptional aero package' : p.score >= 70 ? 'Strong, competitive design' :
          p.score >= 50 ? 'Competitive — clear gains available' : p.score >= 32 ? 'Developing — notable drag penalties' : 'High drag — significant rework advised';
        const strengths = [], issues = [], recs = [];
        if (p.cd <= 0.18) strengths.push('Low drag coefficient (' + p.cd.toFixed(3) + ') — slippery for this class.');
        if (p.noseSharp > 0.5) strengths.push('Well-tapered nose keeps the frontal stagnation zone small.');
        if (p.tailTaper > 0.5) strengths.push('Effective tail boat-tailing helps the wake close cleanly.');
        if (p.downforce >= 55) strengths.push('Healthy downforce index (' + p.downforce + ') from underbody and wing area.');
        if (p.rough < 0.28) strengths.push('Smooth, continuous surfaces keep the flow attached longer.');
        if (p.wheelFrac < 0.12) strengths.push('Wheels are largely faired in, limiting a major drag source.');

        if (p.cd > 0.30) issues.push('Elevated drag coefficient (' + p.cd.toFixed(3) + ') for a STEM-class car.');
        if (p.noseSharp < 0.35) issues.push('Blunt nose — the front cross-section grows too quickly.');
        if (p.tailTaper < 0.30) issues.push('Abrupt tail — a large base area feeds a wide, draggy wake.');
        if (p.wheelFrac > 0.25) issues.push('Exposed wheels are contributing substantial pressure drag.');
        if (p.rough > 0.40) issues.push('Sharp curvature transitions likely trip the flow early.');
        if (p.downforce < 30) issues.push('Low downforce index (' + p.downforce + ') — limited grip under load.');
        if (p.boxiness > 0.70) issues.push('Bulky mid-body — the maximum cross-section fills most of the envelope.');

        if (p.noseSharp < 0.40) recs.push('Sharpen and rake the nose so the leading cross-section builds gradually.');
        if (p.tailTaper < 0.40) recs.push('Extend a boat-tail or diffuser ramp to shrink the base and recover pressure.');
        if (p.wheelFrac > 0.20) recs.push('Fair or shroud the wheels — even partial covers cut wheel wake sharply.');
        if (p.rough > 0.35) recs.push('Blend abrupt surface transitions; keep curvature continuous over the canopy.');
        if (p.cd > 0.28) recs.push('Trim frontal area where regulations allow to reduce pressure drag.');
        if (p.downforce < 35) recs.push('Add a modest rear wing or underbody channel for stability at speed.');
        if (!recs.length) recs.push('Refine surface finish and reduce edge/fastener steps for marginal gains.');
        if (!strengths.length) strengths.push('Baseline geometry is a workable starting point for iteration.');
        if (!issues.length) issues.push('No major aerodynamic red flags detected in the geometry.');
        return { verdict, subs: s, strengths: strengths.slice(0, 4), issues: issues.slice(0, 4), recs: recs.slice(0, 5) };
      }
      function radarSVG(vals) {
        const n = vals.length, R = 76, cx = 100, cy = 96;
        const pt = (i, r) => { const a = -Math.PI / 2 + i / n * Math.PI * 2; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; };
        let rings = '';
        [0.25, 0.5, 0.75, 1].forEach(f => { rings += '<polygon points="' + vals.map((_, i) => pt(i, R * f).join(',')).join(' ') + '" class="rg"/>'; });
        let axes = '', labels = '';
        vals.forEach((d, i) => {
          const e = pt(i, R); axes += '<line x1="' + cx + '" y1="' + cy + '" x2="' + e[0] + '" y2="' + e[1] + '" class="rax"/>';
          const l = pt(i, R + 15); labels += '<text x="' + l[0] + '" y="' + (l[1] + 3) + '" class="rlb" text-anchor="middle">' + d.label + '</text>';
        });
        const poly = vals.map((d, i) => pt(i, R * clamp(d.v, 0, 100) / 100).join(',')).join(' ');
        const dots = vals.map((d, i) => { const p = pt(i, R * clamp(d.v, 0, 100) / 100); return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.6" class="rdot"/>'; }).join('');
        return '<svg viewBox="0 0 200 200" class="radar"><g>' + rings + axes + '<polygon points="' + poly + '" class="rfill"/>' + dots + labels + '</g></svg>';
      }
      function openReport() {
        if (!profile) return; const r = generateReport(profile);
        document.getElementById('repTitle').textContent = document.getElementById('modelName').textContent;
        document.getElementById('repVerdict').textContent = r.verdict;
        document.getElementById('repScore').textContent = profile.score;
        const lowDrag = clamp((STEM.cdMax - profile.cd) / (STEM.cdMax - STEM.cdMin) * 100, 4, 99);
        document.getElementById('repRadar').innerHTML = radarSVG([
          { label: 'Eff', v: r.subs.eff }, { label: 'Down', v: r.subs.df }, { label: 'Flow', v: r.subs.flow },
          { label: 'Stab', v: r.subs.stab }, { label: 'Slip', v: lowDrag }]);
        const rows = [['Efficiency', r.subs.eff], ['Downforce', r.subs.df], ['Flow quality', r.subs.flow], ['Stability', r.subs.stab]];
        document.getElementById('repSubs').innerHTML = rows.map(x =>
          '<div class="rsub"><div class="rsub-top"><span>' + x[0] + '</span><b>' + Math.round(x[1]) + '</b></div><i><b style="width:' + Math.round(x[1]) + '%"></b></i></div>').join('');
        const p = profile, Wmm = Math.round(p.dims.W / p.dims.L * 210), Hmm = Math.round(p.dims.H / p.dims.L * 210);
        const specs = [['Length', '210<u>mm</u>'], ['Width', Wmm + '<u>mm</u>'], ['Height', Hmm + '<u>mm</u>'],
        ['Frontal area', p.frontalAreaCm2.toFixed(1) + '<u>cm²</u>'], ['Drag coeff', p.cd.toFixed(3)],
        ['Mesh', p.triangles.toLocaleString() + '<u>tris</u>'], ['Top speed', Math.round(p.topMph) + '<u>mph</u>'],
        ['20 m run', p.runTime.toFixed(3) + '<u>s</u>']];
        document.getElementById('repSpecs').innerHTML = specs.map(s =>
          '<div class="spec"><span class="sk">' + s[0] + '</span><span class="sv">' + s[1] + '</span></div>').join('');
        document.getElementById('repStrengths').innerHTML = r.strengths.map(x => '<li>' + x + '</li>').join('');
        document.getElementById('repIssues').innerHTML = r.issues.map(x => '<li>' + x + '</li>').join('');
        document.getElementById('repRecs').innerHTML = r.recs.map(x => '<li>' + x + '</li>').join('');
        const el = document.getElementById('report'); el.classList.add('on'); el.setAttribute('aria-hidden', 'false');
      }
      function closeReport() { const el = document.getElementById('report'); el.classList.remove('on'); el.setAttribute('aria-hidden', 'true'); }
      function capture() {
        try {
          renderer.render(scene, camera);
          const url = renderer.domElement.toDataURL('image/png');
          const a = document.createElement('a'); a.href = url;
          a.download = 'aerovision-' + (profile ? ('score-' + profile.score) : 'view') + '.png'; a.click();
        } catch (e) { console.warn('capture failed', e); }
      }

      /* ---------------- camera + render loop ---------------- */
      const camTarget = new THREE.Vector3(6.8, 2.3, 9.9), lookTarget = new THREE.Vector3(0, 0.15, 0);
      const _pos = new THREE.Vector3(11, 4.4, 16.5), _look = new THREE.Vector3(0, 0.15, 0);
      const parallax = new THREE.Vector2(), _par = new THREE.Vector2();
      addEventListener('pointermove', e => parallax.set((e.clientX / innerWidth - 0.5) * 2, (e.clientY / innerHeight - 0.5) * 2), { passive: true });
      let intro = 0; // 0..1 intro progress
      let last = 0, tGlobal = 0;
      let currentOffset = 0;
      function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000); last = now; tGlobal += dt;
        
        if (!studioMode) {
          scrollCurrent = damp(scrollCurrent, scrollTarget, 2.8, dt);
          updatePanels();
          
          const f = clamp(scrollCurrent / 6, 0, 1);
          document.getElementById('stage').style.filter = 'brightness(' + (1 - f * 0.12) + ')';
          
          const cue = document.getElementById('cue');
          if (cue) { cue.style.opacity = scrollCurrent > 0.15 ? '0' : '1'; }
          
          const activeConfig = getInterpolatedScene(scrollCurrent);
          camTarget.set(activeConfig.cam[0], activeConfig.cam[1], activeConfig.cam[2]);
          lookTarget.set(activeConfig.look[0], activeConfig.look[1], activeConfig.look[2]);
          targets.flow = activeConfig.flow;
          targets.pressure = activeConfig.pressure;
          targets.spin = activeConfig.spin;
          currentOffset = damp(currentOffset, activeConfig.offset, 3.5, dt);
          
          const w = innerWidth, h = innerHeight;
          if (w > 820) {
            camera.setViewOffset(w, h, w * currentOffset, 0, w, h);
          } else {
            camera.clearViewOffset();
          }
          
          subject.rotation.y += curr.spin * dt;
          if (currentMesh && curr.pressure > 0.005) blendPressure(currentMesh, curr.pressure);
          
          if (intro < 1) { intro = Math.min(1, intro + dt / 2.2); }
          _par.x = damp(_par.x, parallax.x, 3, dt); _par.y = damp(_par.y, parallax.y, 3, dt);
          const io = easeInOut(intro);
          const tx = lerp(11, camTarget.x, io), ty = lerp(4.4, camTarget.y, io), tz = lerp(16.5, camTarget.z, io);
          const bob = Math.sin(tGlobal * 0.4) * 0.06;
          _pos.x = damp(_pos.x, tx + _par.x * 0.5, 2.0, dt);
          _pos.y = damp(_pos.y, ty - _par.y * 0.3 + bob, 2.0, dt);
          _pos.z = damp(_pos.z, tz, 2.0, dt);
          camera.position.copy(_pos);
          _look.x = damp(_look.x, lookTarget.x, 2.4, dt); _look.y = damp(_look.y, lookTarget.y, 2.4, dt); _look.z = damp(_look.z, lookTarget.z, 2.4, dt);
          camera.lookAt(_look);
        } else {
          const w = innerWidth, h = innerHeight;
          if (w > 820) {
            camera.setViewOffset(w, h, w * 0.15, 0, w, h);
          } else {
            camera.clearViewOffset();
          }
          
          if (camTween) {
            camTween.k = Math.min(1, camTween.k + dt / camTween.dur);
            const e = easeInOut(camTween.k);
            camera.position.lerpVectors(camTween.fp, camTween.tp, e);
            controls.target.lerpVectors(camTween.ft, camTween.tt, e);
            camera.lookAt(controls.target);
            if (camTween.k >= 1) camTween = null;
          }
          controls.update();
        }

        curr.flow = damp(curr.flow, targets.flow, 2.4, dt);
        curr.pressure = damp(curr.pressure, targets.pressure, 2.4, dt);
        curr.spin = damp(curr.spin, studioMode ? 0 : targets.spin, 3, dt);

        streamlines.update(dt, curr.flow);
        updateEnvironment(dt, tGlobal);
        renderer.toneMappingExposure = lerp(1.0, 1.08, curr.flow);
        renderer.render(scene, camera);
        requestAnimationFrame(frame);
      }

      function onResize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }

      /* ---------------- boot (runs last, after every declaration) ---------------- */
      try { init(); }
      catch (e) {
        console.error(e);
        boot.querySelector('.b-bar').style.display = 'none';
        bootErr.style.display = 'block';
        bootErr.textContent = 'Startup error: ' + ((e && e.message) || e);
      }
    };
