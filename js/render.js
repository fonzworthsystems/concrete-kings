// render.js — Three.js scene, renderer, lights, material/factory helpers
(function () {
  const G = window.G;

  G.rend = {
    init(canvas) {
      G.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
      G.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      G.renderer.setSize(window.innerWidth, window.innerHeight);
      G.renderer.shadowMap.enabled = true;
      G.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      G.renderer.outputColorSpace = THREE.SRGBColorSpace;
      G.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      G.renderer.toneMappingExposure = 1.05;
    },

    scene() {
      G.scene = new THREE.Scene();
      G.scene.background = new THREE.Color(0x0c1016);
      G.scene.fog = new THREE.Fog(0x141a22, 60, 200);

      // lights
      const hemi = new THREE.HemisphereLight(0xcfdfff, 0x2a2433, 1.25);
      G.scene.add(hemi);
      const sun = new THREE.DirectionalLight(0xfff2df, 1.95);
      sun.position.set(40, 70, 20);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
      sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
      sun.shadow.camera.near = 10; sun.shadow.camera.far = 200;
      sun.shadow.bias = -0.0004;
      G.scene.add(sun);
      G.sun = sun;

      // ambient fill
      const amb = new THREE.AmbientLight(0x3c4c66, 0.85);
      G.scene.add(amb);
    },

    // material helpers (cached)
    _mats: {},
    mat(color, opts) {
      opts = opts || {};
      const key = color + '|' + (opts.roughness || 0.7) + '|' + (opts.metal || 0) + '|' + (opts.emissive || '') + '|' + (opts.flat ? 'f' : '');
      if (this._mats[key]) return this._mats[key];
      const m = new THREE.MeshStandardMaterial({
        color,
        roughness: opts.roughness !== undefined ? opts.roughness : 0.7,
        metalness: opts.metal || 0,
        flatShading: !!opts.flat,
      });
      if (opts.emissive) m.emissive = new THREE.Color(opts.emissive);
      if (opts.emissiveIntensity) m.emissiveIntensity = opts.emissiveIntensity;
      this._mats[key] = m;
      return m;
    },

    // factory: axis-aligned box centered at (x,y,z)
    box(w, h, d, color, opts) {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, this.mat(color, opts));
      mesh.castShadow = true; mesh.receiveShadow = true;
      return mesh;
    },
    cylinder(rt, rb, h, color, opts) {
      const geo = new THREE.CylinderGeometry(rt, rb, h, 16);
      const mesh = new THREE.Mesh(geo, this.mat(color, opts));
      mesh.castShadow = true; mesh.receiveShadow = true;
      return mesh;
    },
    sphere(r, color, opts) {
      const geo = new THREE.SphereGeometry(r, 16, 12);
      const mesh = new THREE.Mesh(geo, this.mat(color, opts));
      mesh.castShadow = true; mesh.receiveShadow = true;
      return mesh;
    },
    // a flat "capsule"-like unit body: torso + head + limbs done by caller
    group() {
      const g = new THREE.Group();
      g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
      return g;
    },

    // ---- health bar sprite ----
    makeHealthBar() {
      const cv = document.createElement('canvas');
      cv.width = 128; cv.height = 20;
      const tex = new THREE.CanvasTexture(cv);
      tex.minFilter = THREE.LinearFilter;
      const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(2.4, 0.38, 1);
      sprite.renderOrder = 999;
      sprite.visible = false;
      return { sprite, cv, tex };
    },
    drawHealthBar(hb, pct, team, opts) {
      opts = opts || {};
      const cv = hb.cv, ctx = cv.getContext('2d');
      ctx.clearRect(0, 0, 128, 20);
      const c = team === G.TEAM_B ? '#ff4d5e' : '#2ee6a8';
      // background
      ctx.fillStyle = 'rgba(6,8,12,0.85)';
      ctx.fillRect(0, 3, 128, 14);
      // fill
      const p = G.M.clamp(pct, 0, 1);
      const w = Math.max(0, p * 124);
      let fill = c;
      if (opts.shield) fill = '#cbd5e1';
      else if (opts.mana) fill = '#60a5fa';
      ctx.fillStyle = fill;
      ctx.fillRect(2, 5, w, 10);
      // border
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(0.5, 2.5, 127, 15);
      hb.tex.needsUpdate = true;
    },

    // ---- floating text (damage numbers, etc.) ----
    floatingText(text, pos, color) {
      const cv = document.createElement('canvas');
      cv.width = 256; cv.height = 96;
      const ctx = cv.getContext('2d');
      ctx.font = 'bold 64px "Avenir Next", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.strokeText(text, 128, 48);
      ctx.fillStyle = color || '#ffffff';
      ctx.fillText(text, 128, 48);
      const tex = new THREE.CanvasTexture(cv);
      const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true });
      const s = new THREE.Sprite(mat);
      s.scale.set(2.6, 0.98, 1);
      s.position.copy(pos);
      s.renderOrder = 1000;
      s.userData = { born: G.state.time, life: 1.0, vy: 1.6 };
      G.scene.add(s);
      G.state.effects.push(s);
    },
  };

  // ---- fog-of-war ground overlay ----
  G.rend.initFogOverlay = function () {
    const res = 128;
    const cv = document.createElement('canvas');
    cv.width = res; cv.height = res;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, res, res);
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(G.WORLD.halfW * 2, G.WORLD.halfD * 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.72, depthWrite: false })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.06;
    plane.renderOrder = 2;
    G.scene.add(plane);
    G.fogOverlay = { cv, ctx, tex, plane, res };
  };

  // update fog overlay from a visibility grid (res x res), 0..1 visibility
  G.rend.updateFogOverlay = function (grid) {
    const fo = G.fogOverlay;
    if (!fo) return;
    const ctx = fo.ctx, res = fo.res;
    const img = ctx.createImageData(res, res);
    for (let y = 0; y < res; y++) {
      for (let x = 0; x < res; x++) {
        const v = grid[y * res + x];
        const i = (y * res + x) * 4;
        // visible -> transparent; hidden -> opaque dark
        const a = Math.round((1 - v) * 235);
        img.data[i] = 4; img.data[i + 1] = 6; img.data[i + 2] = 10; img.data[i + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    fo.tex.needsUpdate = true;
  };

  window.G = G;
})();
