// core.js — math helpers, event bus, input, camera controller, game loop
(function () {
  const G = window.G;

  // ---------------- math ----------------
  G.M = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    dist2: (ax, az, bx, bz) => { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; },
    dist: (ax, az, bx, bz) => Math.sqrt(G.M.dist2(ax, az, bx, bz)),
    rand: (a, b) => a + Math.random() * (b - a),
    randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    // angle of a 2D direction vector (x, z) in radians
    angle: (x, z) => Math.atan2(z, x),
    // move a 2D point toward a target by max step
    stepToward: (ax, az, bx, bz, step) => {
      const d = G.M.dist(ax, az, bx, bz);
      if (d <= step || d === 0) return { x: bx, z: bz };
      const t = step / d;
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t };
    },
  };

  // ---------------- event bus ----------------
  G.events = {
    handlers: {},
    on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); },
    emit(ev, data) { (this.handlers[ev] || []).forEach((fn) => fn(data)); },
  };

  // ---------------- input ----------------
  G.input = {
    keys: {},
    mouse: { x: 0, y: 0, wx: 0, wz: 0, down: false, rightDown: false },
    onMouseDown: null,
    onMouseUp: null,
    onKeyDown: null,
    init(canvas) {
      window.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        this.keys[e.code] = true;
        this.keys[e.key.toLowerCase()] = true;
        if (this.onKeyDown) this.onKeyDown(e.code, e.key.toLowerCase());
      });
      window.addEventListener('keyup', (e) => {
        this.keys[e.code] = false;
        this.keys[e.key.toLowerCase()] = false;
      });
      canvas.addEventListener('mousemove', (e) => {
        this.mouse.x = e.clientX;
        this.mouse.y = e.clientY;
        this.updateWorld();
      });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) { this.mouse.down = true; if (this.onMouseDown) this.onMouseDown(e); }
        if (e.button === 2) { this.mouse.rightDown = true; if (this.onMouseDown) this.onMouseDown(e); }
      });
      window.addEventListener('mouseup', (e) => {
        if (e.button === 0) { this.mouse.down = false; if (this.onMouseUp) this.onMouseUp(e); }
        if (e.button === 2) { this.mouse.rightDown = false; if (this.onMouseUp) this.onMouseUp(e); }
      });
    },
    updateWorld() {
      if (!G.camera || !G.raycaster || !G.groundPlane) return;
      const ndc = new THREE.Vector2(
        (this.mouse.x / window.innerWidth) * 2 - 1,
        -(this.mouse.y / window.innerHeight) * 2 + 1
      );
      G.raycaster.setFromCamera(ndc, G.camera);
      const hit = G.raycaster.ray.intersectPlane(G.groundPlane, new THREE.Vector3());
      if (hit) { this.mouse.wx = hit.x; this.mouse.wz = hit.z; }
    },
    isDown(code) { return !!this.keys[code]; },
  };

  // ---------------- camera controller ----------------
  G.cam = {
    yaw: -0.62,          // fixed orientation; map appears ~diagonal
    pitch: 0.92,         // looking down
    distance: 30,
    target: new THREE.Vector3(0, 0, 0),
    pos: new THREE.Vector3(0, 0, 0),
    init() {
      G.camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 0.1, 400);
      G.camera.up.set(0, 1, 0);
      G.raycaster = new THREE.Raycaster();
      G.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    },
    snap(hero) {
      this.target.copy(hero.pos);
      this.apply();
    },
    apply() {
      // camera sits behind team A (bottom-left), looking toward B
      const yaw = this.yaw, pitch = this.pitch;
      const cx = Math.cos(yaw) * Math.cos(pitch);
      const cy = Math.sin(pitch);
      const cz = Math.sin(yaw) * Math.cos(pitch);
      const d = this.distance;
      this.pos.set(
        this.target.x + cx * d,
        this.target.y + cy * d + 6,
        this.target.z + cz * d
      );
      G.camera.position.copy(this.pos);
      G.camera.lookAt(this.target.x, this.target.y + 2, this.target.z);
    },
    update(dt, hero) {
      if (!hero) return;
      // smooth follow
      this.target.x = G.M.lerp(this.target.x, hero.pos.x, Math.min(1, dt * 8));
      this.target.z = G.M.lerp(this.target.z, hero.pos.z, Math.min(1, dt * 8));
      this.target.y = G.M.lerp(this.target.y, hero.pos.y, Math.min(1, dt * 8));
      this.apply();
    },
  };

  // ---------------- game loop ----------------
  G.loop = {
    running: false,
    last: 0,
    start(updateFn, renderFn) {
      this.running = true;
      this.last = performance.now();
      const frame = (now) => {
        if (!this.running) return;
        let dt = (now - this.last) / 1000;
        this.last = now;
        dt = G.M.clamp(dt, 0, 0.05); // clamp big hitches
        if (updateFn) updateFn(dt);
        if (renderFn) renderFn(dt);
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },
    stop() { this.running = false; },
  };

  window.G = G;
})();
