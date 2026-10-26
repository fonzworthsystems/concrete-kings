// nav.js — grid pathfinding + collision helpers
(function () {
  const G = window.G;

  G.nav = {
    cell: 2.0,
    cols: 0, rows: 0,
    grid: null, // Uint8Array, 1 = walkable

    init() {
      const halfW = G.WORLD.halfW, halfD = G.WORLD.halfD;
      this.cols = Math.ceil((halfW * 2) / this.cell);
      this.rows = Math.ceil((halfD * 2) / this.cell);
      this.grid = new Uint8Array(this.cols * this.rows).fill(1);
      for (const c of G.map.collision) {
        const x0 = c.x - c.w / 2 - 1.0, z0 = c.z - c.d / 2 - 1.0;
        const x1 = c.x + c.w / 2 + 1.0, z1 = c.z + c.d / 2 + 1.0;
        this.markRect(x0, z0, x1, z1, 0);
      }
    },

    worldToCell(x, z) {
      return {
        cx: Math.floor((x + G.WORLD.halfW) / this.cell),
        cz: Math.floor((z + G.WORLD.halfD) / this.cell),
      };
    },
    cellToWorld(cx, cz) {
      return {
        x: cx * this.cell + this.cell / 2 - G.WORLD.halfW,
        z: cz * this.cell + this.cell / 2 - G.WORLD.halfD,
      };
    },
    idx(cx, cz) { return cz * this.cols + cx; },
    inBounds(cx, cz) { return cx >= 0 && cx < this.cols && cz >= 0 && cz < this.rows; },
    markRect(x0, z0, x1, z1, val) {
      const a = this.worldToCell(x0, z0), b = this.worldToCell(x1, z1);
      for (let cz = Math.max(0, a.cz); cz <= Math.min(this.rows - 1, b.cz); cz++) {
        for (let cx = Math.max(0, a.cx); cx <= Math.min(this.cols - 1, b.cx); cx++) {
          this.grid[this.idx(cx, cz)] = val;
        }
      }
    },
    walkableAt(x, z) {
      const c = this.worldToCell(x, z);
      if (!this.inBounds(c.cx, c.cz)) return false;
      return this.grid[this.idx(c.cx, c.cz)] === 1;
    },
    // straight-line walkability check (for path smoothing / range checks)
    lineWalkable(x0, z0, x1, z1) {
      const d = G.M.dist(x0, z0, x1, z1);
      const steps = Math.ceil(d / 1.0);
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        if (!this.walkableAt(G.M.lerp(x0, x1, t), G.M.lerp(z0, z1, t))) return false;
      }
      return true;
    },

    // A* path (8-direction), returns array of {x,z} or null
    findPath(sx, sz, tx, tz) {
      const start = this.worldToCell(sx, sz);
      const goal = this.worldToCell(tx, tz);
      if (!this.inBounds(start.cx, start.cz) || !this.inBounds(goal.cx, goal.cz)) return null;
      const sIdx = this.idx(start.cx, start.cz);
      const gIdx = this.idx(goal.cx, goal.cz);
      if (!this.grid[gIdx]) {
        // snap goal to nearest walkable cell
        let best = null, bestD = Infinity;
        for (let cz = 0; cz < this.rows; cz++) for (let cx = 0; cx < this.cols; cx++) {
          if (!this.grid[this.idx(cx, cz)]) continue;
          const w = this.cellToWorld(cx, cz);
          const d = G.M.dist2(w.x, w.z, tx, tz);
          if (d < bestD) { bestD = d; best = { cx, cz }; }
        }
        if (!best) return null;
        return this._astar(start.cx, start.cz, best.cx, best.cz);
      }
      if (sIdx === gIdx) return [{ x: sx, z: sz }];
      return this._astar(start.cx, start.cz, goal.cx, goal.cz);
    },

    _astar(sx, sy, gx, gy) {
      const { cols, rows } = this;
      const start = this.idx(sx, sy), goal = this.idx(gx, gy);
      const gScore = new Map([[start, 0]]);
      const cameFrom = new Map();
      const open = new Map([[start, this._h(sx, sy, gx, gy)]]);
      const closed = new Set();
      const dirs = [
        [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
        [1, 1, 1.4142], [1, -1, 1.4142], [-1, 1, 1.4142], [-1, -1, 1.4142],
      ];
      let iter = 0;
      while (open.size && iter++ < 4000) {
        // extract min f
        let cur = null, curF = Infinity;
        for (const [idx, f] of open) { if (f < curF) { curF = f; cur = idx; } }
        open.delete(cur);
        if (cur === goal) return this._reconstruct(cameFrom, cur);
        closed.add(cur);
        const cx = cur % cols, cz = Math.floor(cur / cols);
        for (const [dx, dz, cost] of dirs) {
          const nx = cx + dx, nz = cz + dz;
          if (!this.inBounds(nx, nz)) continue;
          const nidx = this.idx(nx, nz);
          if (!this.grid[nidx] || closed.has(nidx)) continue;
          // corner cutting prevention
          if (dx !== 0 && dz !== 0) {
            if (!this.grid[this.idx(cx + dx, cz)] || !this.grid[this.idx(cx, cz + dz)]) continue;
          }
          const tent = (gScore.get(cur) || 0) + cost;
          if (tent < (gScore.get(nidx) || Infinity)) {
            cameFrom.set(nidx, cur);
            gScore.set(nidx, tent);
            open.set(nidx, tent + this._h(nx, nz, gx, gy));
          }
        }
      }
      return null;
    },
    _h(cx, cz, gx, gy) {
      const dx = Math.abs(cx - gx), dz = Math.abs(cz - gy);
      return Math.max(dx, dz) + 0.4142 * Math.min(dx, dz);
    },
    _reconstruct(cameFrom, cur) {
      const path = [];
      while (cur !== undefined) {
        const cx = cur % this.cols, cz = Math.floor(cur / this.cols);
        path.push(this.cellToWorld(cx, cz));
        cur = cameFrom.get(cur);
      }
      path.reverse();
      return this._smooth(path);
    },
    _smooth(path) {
      if (!path || path.length <= 2) return path;
      const out = [path[0]];
      let i = 0;
      while (i < path.length - 1) {
        let j = path.length - 1;
        while (j > i + 1) {
          if (this.lineWalkable(path[i].x, path[i].z, path[j].x, path[j].z)) break;
          j--;
        }
        out.push(path[j]);
        i = j;
      }
      return out;
    },

    // resolve a position against static collision rects (push out)
    resolveStatic(p, radius) {
      const hw = G.WORLD.halfW - 0.6, hd = G.WORLD.halfD - 0.6;
      p.x = G.M.clamp(p.x, -hw, hw);
      p.z = G.M.clamp(p.z, -hd, hd);
      for (const c of G.map.collision) {
        const hx = c.w / 2 + radius, hz = c.d / 2 + radius;
        const dx = p.x - c.x, dz = p.z - c.z;
        const ox = hx - Math.abs(dx), oz = hz - Math.abs(dz);
        if (ox > 0 && oz > 0) {
          // push along the axis of least penetration
          if (ox < oz) p.x += (dx > 0 ? ox : -ox);
          else p.z += (dz > 0 ? oz : -oz);
        }
      }
      // keep inside world
      p.x = G.M.clamp(p.x, -hw, hw);
      p.z = G.M.clamp(p.z, -hd, hd);
    },
  };

  window.G = G;
})();
