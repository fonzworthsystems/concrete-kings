// map.js — build the urban battlefield: ground, roads, buildings, bases, collision
(function () {
  const G = window.G;

  G.map = {
    turretPos: [],       // {x,z,team,lane}
    inhibitorPos: [],    // {x,z,team,lane}
    nexusPos: [],        // {x,z,team}
    bushes: G.BUSHES,
    collision: [],       // axis-aligned rects {x,z,w,d} blocking movement
    lanePolylines: [],   // per lane, list of {x,z}
    campPos: [],         // jungle camp spawn points
  };

  G.map.build = function () {
    this.collision = [];
    this.turretPos = [];
    this.inhibitorPos = [];
    this.nexusPos = [];

    this._ground();
    this._roads();
    this._buildings();
    this._river();
    this._bases();
    this._turrets();
    this._inhibitors();
    this._nexus();
    this._bushes();
    this._jungle();
    this._lanes();
  };

  // ---- ground ----
  G.map._ground = function () {
    const geo = new THREE.PlaneGeometry(G.WORLD.halfW * 2, G.WORLD.halfD * 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x272c35, roughness: 0.95, metalness: 0 });
    const g = new THREE.Mesh(geo, mat);
    g.rotation.x = -Math.PI / 2;
    g.position.y = -0.05;
    g.receiveShadow = true;
    G.scene.add(g);

    // subtle ground grid
    const grid = new THREE.GridHelper(G.WORLD.halfW * 2, 52, 0x2c323c, 0x1e232b);
    grid.position.y = 0.0;
    grid.material.opacity = 0.5;
    grid.material.transparent = true;
    G.scene.add(grid);
  };

  // ---- lane roads ----
  G.map._roads = function () {
    const roadColor = 0x2b3038;
    G.WORLD.laneZ.forEach((z) => {
      const w = 4.6;
      const road = new THREE.Mesh(
        new THREE.PlaneGeometry(G.WORLD.halfW * 2, w),
        new THREE.MeshStandardMaterial({ color: 0x353c47, roughness: 0.9 })
      );
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.01, z);
      road.receiveShadow = true;
      G.scene.add(road);
      // dashed center line
      const n = 24;
      for (let i = 0; i < n; i++) {
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(1.6, 0.22),
          new THREE.MeshBasicMaterial({ color: 0x555e6a })
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(-G.WORLD.halfW + (i + 0.5) * (G.WORLD.halfW * 2 / n), 0.02, z);
        G.scene.add(dash);
      }
      // curb edges
      [-w / 2, w / 2].forEach((dz) => {
        const curb = new THREE.Mesh(
          new THREE.BoxGeometry(G.WORLD.halfW * 2, 0.14, 0.28),
          new THREE.MeshStandardMaterial({ color: 0x3a414c, roughness: 0.7 })
        );
        curb.position.set(0, 0.07, z + dz);
        curb.receiveShadow = true;
        G.scene.add(curb);
      });
    });
  };

  // ---- buildings (city blocks) ----
  G.map._buildings = function () {
    // seeded deterministic
    let seed = 12345;
    const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

    const laneBlock = (z) => Math.abs(z - (-18)) < 6.2 || Math.abs(z) < 6.2 || Math.abs(z - 18) < 6.2;
    const nearKeyPoint = (x, z) => {
      for (const t of this.turretPos) if (G.M.dist(x, z, t.x, t.z) < 9) return true;
      for (const c of G.JUNGLE.camps) if (G.M.dist(x, z, c.x, c.z) < 8) return true;
      if (G.M.dist(x, z, G.JUNGLE.kingpin.x, G.JUNGLE.kingpin.z) < 11) return true;
      if (G.M.dist(x, z, G.JUNGLE.cache.x, G.JUNGLE.cache.z) < 11) return true;
      for (const b of G.BUSHES) if (Math.abs(x - b.x) < b.w / 2 + 2 && Math.abs(z - b.z) < b.d / 2 + 2) return true;
      return false;
    };

    const palette = [0x3a414d, 0x414a58, 0x333a45, 0x4a4452, 0x3d4651, 0x453f39];
    for (let x = -42; x <= 42; x += 8) {
      for (let z = -22; z <= 22; z += 8) {
        if (laneBlock(z)) continue;
        if (Math.abs(x) < 6) continue; // river
        if (nearKeyPoint(x, z)) continue;
        if (Math.abs(x) > 46 || Math.abs(z) > 24) continue;
        const w = 5 + rnd() * 3;
        const d = 5 + rnd() * 3;
        const h = 6 + rnd() * 16;
        const color = palette[Math.floor(rnd() * palette.length)];
        const bld = G.rend.box(w, h, d, color, { roughness: 0.8 });
        bld.position.set(x, h / 2, z);
        G.scene.add(bld);
        this.collision.push({ x, z, w, d });
        // neon sign on some buildings
        if (rnd() > 0.55) {
          const sign = G.rend.box(w * 0.5, 0.4, 0.3, 0x111111, {});
          sign.position.set(x, h * 0.72, z + d / 2 + 0.2);
          const glow = G.rend.box(w * 0.46, 0.1, 0.06, [0xff3b6b, 0x37c8ff, 0xffd24d, 0x9b5cff][Math.floor(rnd() * 4)], { emissive: 0xffffff, emissiveIntensity: 1.6 });
          glow.position.set(x, h * 0.72, z + d / 2 + 0.32);
          G.scene.add(sign); G.scene.add(glow);
        }
      }
    }
    // perimeter walls
    const wallMat = { roughness: 0.7 };
    [-G.WORLD.halfW + 0.5, G.WORLD.halfW - 0.5].forEach((x) => {
      const w = G.rend.box(1, 8, G.WORLD.halfD * 2, 0x22262e, wallMat);
      w.position.set(x, 4, 0); G.scene.add(w);
    });
    [-G.WORLD.halfD + 0.5, G.WORLD.halfD - 0.5].forEach((z) => {
      const w = G.rend.box(G.WORLD.halfW * 2, 8, 1, 0x22262e, wallMat);
      w.position.set(0, 4, z); G.scene.add(w);
    });
    this.collision.push({ x: -G.WORLD.halfW + 0.5, z: 0, w: 1, d: G.WORLD.halfD * 2 });
    this.collision.push({ x: G.WORLD.halfW - 0.5, z: 0, w: 1, d: G.WORLD.halfD * 2 });
    this.collision.push({ x: 0, z: -G.WORLD.halfD + 0.5, w: G.WORLD.halfW * 2, d: 1 });
    this.collision.push({ x: 0, z: G.WORLD.halfD - 0.5, w: G.WORLD.halfW * 2, d: 1 });
  };

  // ---- central river/canal ----
  G.map._river = function () {
    const river = new THREE.Mesh(
      new THREE.PlaneGeometry(3.4, G.WORLD.halfD * 2),
      new THREE.MeshStandardMaterial({ color: 0x12202a, roughness: 0.3, metalness: 0.4 })
    );
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, 0.03, 0);
    G.scene.add(river);
    // bridges over lanes
    G.WORLD.laneZ.forEach((z) => {
      const br = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 0.22, 4.6),
        new THREE.MeshStandardMaterial({ color: 0x3a414c, roughness: 0.7 })
      );
      br.position.set(0, 0.12, z);
      br.receiveShadow = true;
      G.scene.add(br);
    });
  };

  // ---- base platforms ----
  G.map._bases = function () {
    [-G.NEXUS.x, G.NEXUS.x].forEach((x) => {
      const team = x < 0 ? G.TEAM_A : G.TEAM_B;
      const pad = new THREE.Mesh(
        new THREE.CircleGeometry(7, 32),
        new THREE.MeshStandardMaterial({ color: G.teamColor[team], roughness: 0.6, emissive: G.teamColor[team], emissiveIntensity: 0.25 })
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(x, 0.02, 0);
      G.scene.add(pad);
      // base "stronghold" building
      const hold = G.rend.box(10, 5, 12, G.teamDark[team], { roughness: 0.6 });
      hold.position.set(x, 2.5, 0);
      G.scene.add(hold);
    });
  };

  // ---- turret placement (data only; visuals created by units.js) ----
  G.map._turrets = function () {
    const defs = [];
    G.WORLD.laneZ.forEach((z, li) => {
      [[G.TEAM_A, -1], [G.TEAM_B, 1]].forEach(([team, sgn]) => {
        const baseX = sgn < 0 ? G.WORLD.baseAX : G.WORLD.baseBX;
        const outer = baseX - sgn * G.TURRET.outerDist; // toward enemy
        const inner = baseX - sgn * G.TURRET.innerDist;
        defs.push({ x: outer, z, team, lane: li, tier: 'outer' });
        defs.push({ x: inner, z, team, lane: li, tier: 'inner' });
      });
    });
    // base turrets guarding nexus
    [[G.TEAM_A, -1], [G.TEAM_B, 1]].forEach(([team, sgn]) => {
      defs.push({ x: sgn * (G.NEXUS.x - G.TURRET.baseDist), z: -6, team, lane: -1, tier: 'base' });
      defs.push({ x: sgn * (G.NEXUS.x - G.TURRET.baseDist), z: 6, team, lane: -1, tier: 'base' });
    });
    this.turretPos = defs;
  };

  G.map._inhibitors = function () {
    G.WORLD.laneZ.forEach((z, li) => {
      [[G.TEAM_A, -1], [G.TEAM_B, 1]].forEach(([team, sgn]) => {
        const x = sgn * G.INHIBITOR.dist;
        this.inhibitorPos.push({ x, z, team, lane: li });
      });
    });
  };

  G.map._nexus = function () {
    this.nexusPos = [
      { x: -G.NEXUS.x, z: 0, team: G.TEAM_A },
      { x: G.NEXUS.x, z: 0, team: G.TEAM_B },
    ];
  };

  // ---- bushes (visual + collision is passable) ----
  G.map._bushes = function () {
    G.BUSHES.forEach((b, i) => {
      const g = G.rend.group();
      const n = Math.max(2, Math.floor(b.w / 1.6));
      for (let k = 0; k < n; k++) {
        const bx = b.x - b.w / 2 + (k + 0.5) * (b.w / n);
        const h = 1.8 + (k % 2) * 0.5;
        const bush = G.rend.sphere(h * 0.55, 0x1f3a2a, { roughness: 0.9, flat: true });
        bush.position.set(bx, h * 0.4, b.z);
        bush.scale.z = b.d / (h * 1.1);
        g.add(bush);
      }
      g.position.y = 0;
      G.scene.add(g);
      G.map.bushes[i] = { x: b.x, z: b.z, w: b.w, d: b.d, mesh: g };
    });
  };

  // ---- jungle visual markers ----
  G.map._jungle = function () {
    // camp pads
    G.JUNGLE.camps.forEach((c) => {
      const pad = new THREE.Mesh(
        new THREE.CircleGeometry(3, 20),
        new THREE.MeshStandardMaterial({ color: 0x20242b, roughness: 0.9 })
      );
      pad.rotation.x = -Math.PI / 2;
      pad.position.set(c.x, 0.015, c.z);
      G.scene.add(pad);
      this.campPos.push(c);
    });
    // epic pits
    [G.JUNGLE.kingpin, G.JUNGLE.cache].forEach((e) => {
      const pit = new THREE.Mesh(
        new THREE.CircleGeometry(4.5, 28),
        new THREE.MeshStandardMaterial({ color: 0x141a22, roughness: 0.4, metalness: 0.3 })
      );
      pit.rotation.x = -Math.PI / 2;
      pit.position.set(e.x, 0.02, e.z);
      G.scene.add(pit);
      // glow ring
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(4.2, 4.6, 40),
        new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.6, side: THREE.DoubleSide })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(e.x, 0.05, e.z);
      G.scene.add(ring);
    });
  };

  G.map._lanes = function () {
    this.lanePolylines = G.WORLD.laneZ.map((z) => G.laneWaypoints(z));
  };

  window.G = G;
})();
