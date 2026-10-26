// vision.js — fog of war, bush concealment, stealth, wards
(function () {
  const G = window.G;

  G.vision = {
    cell: 0.5, cols: 0, rows: 0,
    gridA: null, gridB: null,
    acc: 0,
    init() {
      this.cols = Math.ceil((G.WORLD.halfW * 2) / this.cell);
      this.rows = Math.ceil((G.WORLD.halfD * 2) / this.cell);
      this.gridA = new Float32Array(this.cols * this.rows);
      this.gridB = new Float32Array(this.cols * this.rows);
      G.fog = { cell: this.cell, cols: this.cols, rows: this.rows };
    },
    wx(x) { return Math.floor((x + G.WORLD.halfW) / this.cell); },
    wz(z) { return Math.floor((z + G.WORLD.halfD) / this.cell); },
    idx(gx, gz) { return gz * this.cols + gx; },
    stamp(grid, x, z, radius) {
      const r = Math.ceil(radius / this.cell);
      const cx = this.wx(x), cz = this.wz(z);
      const r2 = r * r;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dz * dz > r2) continue;
          const gx = cx + dx, gz = cz + dz;
          if (gx < 0 || gz < 0 || gx >= this.cols || gz >= this.rows) continue;
          const i = this.idx(gx, gz);
          if (grid[i] < 1) grid[i] = 1;
        }
      }
    },
    inBush(x, z) {
      for (const b of G.map.bushes) {
        if (Math.abs(x - b.x) < b.w / 2 && Math.abs(z - b.z) < b.d / 2) return b;
      }
      return null;
    },
    enemyVisible(u, team) {
      if (!u.alive || u.dead) return false;
      if (u.isHero && u.isHero() && (u.stealthUntil || 0) > G.state.time) {
        for (const e of G.state.units()) {
          if (e.team === team && e.alive && G.M.dist(e.pos.x, e.pos.z, u.pos.x, u.pos.z) < 2.8) return true;
        }
        return false;
      }
      if (u.isStructure && u.isStructure()) return true;
      if (this.inBush(u.pos.x, u.pos.z)) {
        for (const e of G.state.units()) {
          if (e.team === team && e.alive && G.M.dist(e.pos.x, e.pos.z, u.pos.x, u.pos.z) < 3.0) return true;
        }
        for (const w of G.state.wards) {
          if (w.team === team && G.state.time < w.until && G.M.dist(w.x, w.z, u.pos.x, u.pos.z) < 3.0) return true;
        }
        return false;
      }
      for (const e of G.state.allUnits()) {
        if (e.team === team && e.alive && G.M.dist2(e.pos.x, e.pos.z, u.pos.x, u.pos.z) < e.visionRadius * e.visionRadius) return true;
      }
      for (const w of G.state.wards) {
        if (w.team === team && G.state.time < w.until && G.M.dist2(w.x, w.z, u.pos.x, u.pos.z) < w.radius * w.radius) return true;
      }
      return false;
    },
    computeGrid(team) {
      const grid = team === G.TEAM_A ? this.gridA : this.gridB;
      grid.fill(0);
      for (const u of G.state.allUnits()) {
        if (u.team !== team || !u.alive) continue;
        this.stamp(grid, u.pos.x, u.pos.z, u.visionRadius);
      }
      for (const w of G.state.wards) {
        if (w.team === team && G.state.time < w.until) this.stamp(grid, w.x, w.z, w.radius);
      }
      return grid;
    },
    update(dt) {
      this.acc += dt;
      if (this.acc < 0.12) return;
      this.acc = 0;
      G.rend.updateFogOverlay(this.computeGrid(G.TEAM_A));
      if (G.ui && G.ui.updateMinimap) G.ui.updateMinimap();
    },
  };

  // ---- fog overlay (aspect-correct, overrides render.js version) ----
  G.rend.initFogOverlay = function () {
    const cols = G.fog.cols, rows = G.fog.rows;
    const cv = document.createElement('canvas');
    cv.width = cols; cv.height = rows;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, cols, rows);
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(G.WORLD.halfW * 2, G.WORLD.halfD * 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.52, depthWrite: false })
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.06;
    plane.renderOrder = 2;
    G.scene.add(plane);
    G.fogOverlay = { cv, ctx, tex, plane, cols, rows };
  };
  G.rend.updateFogOverlay = function (grid) {
    const fo = G.fogOverlay;
    if (!fo) return;
    const ctx = fo.ctx, cols = fo.cols, rows = fo.rows;
    const img = ctx.createImageData(cols, rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const v = grid[y * cols + x];
        const i = (y * cols + x) * 4;
        const a = Math.round((1 - v) * 235);
        img.data[i] = 4; img.data[i + 1] = 6; img.data[i + 2] = 10; img.data[i + 3] = a;
      }
    }
    ctx.putImageData(img, 0, 0);
    fo.tex.needsUpdate = true;
  };

  // ---- wards (trinket) ----
  G.placeWard = function (hero, x, z) {
    if (!hero.alive) return false;
    if ((hero.wardUntil || 0) > G.state.time) return false;
    hero.wardUntil = G.state.time + 75;
    const w = {
      x: G.M.clamp(x, -G.WORLD.halfW + 1, G.WORLD.halfW - 1),
      z: G.M.clamp(z, -G.WORLD.halfD + 1, G.WORLD.halfD - 1),
      team: hero.team, until: G.state.time + 90, radius: 7,
    };
    const m = G.rend.cylinder(0.28, 0.28, 0.55, G.teamColor[hero.team], { emissive: G.teamColor[hero.team], emissiveIntensity: 0.9 });
    m.position.set(w.x, 0.28, w.z);
    G.scene.add(m);
    w.mesh = m;
    G.state.wards.push(w);
    G.fxRing(w.x, w.z, 1.0, G.teamColor[hero.team], 0.4);
    return true;
  };
  G.updateWards = function () {
    for (let i = G.state.wards.length - 1; i >= 0; i--) {
      const w = G.state.wards[i];
      if (G.state.time >= w.until) {
        if (w.mesh) G.scene.remove(w.mesh);
        G.state.wards.splice(i, 1);
      }
    }
  };

  window.G = G;
})();
