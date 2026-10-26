// units.js — entities, movement, combat, projectiles, effects
(function () {
  const G = window.G;

  G.uid = 0;
  G.DMG = { PHYSICAL: 'physical', MAGICAL: 'magical', TRUE: 'true' };

  // ---------------- state ----------------
  G.state = {
    time: 0,
    phase: 'menu',         // menu | select | match | end
    heroes: [],            // all heroes (player + bots)
    minions: [],
    monsters: [],
    turrets: [],
    inhibitors: [],
    nexuses: [],
    projectiles: [],
    effects: [],
    wards: [],
    announcements: [],
  };
  G.state.allUnits = function () { return [].concat(this.heroes, this.minions, this.monsters, this.turrets); };
  G.state.units = function () { return [].concat(this.heroes, this.minions, this.monsters); };

  // ---------------- stats ----------------
  function emptyStats() {
    return {
      maxHp: 0, maxMp: 0, ad: 0, ap: 0, armor: 0, mr: 0,
      attackSpeed: 0.68, attackRange: 2.4, moveSpeed: 5.8,
      crit: 0, critDmg: 1.75, lifesteal: 0, hpRegen: 0, mpRegen: 0,
      cdr: 0, msPercent: 0, shield: 0, dr: 0,
    };
  }

  // compute final stats for any unit (base + perLevel + items + buffs)
  G.computeStats = function (u) {
    const s = emptyStats();
    const def = u.def || {};
    const b = def.base || G.BASE;
    const lvl = u.level || 1;
    const lvlm = lvl - 1;

    s.maxHp = (b.hp || 0) + (b.hpPerLevel || 0) * lvlm;
    s.maxMp = (b.mp || 0) + (b.mpPerLevel || 0) * lvlm;
    s.ad = (b.ad || 0) + (b.adPerLevel || 0) * lvlm;
    s.ap = (b.ap || 0) + (b.apPerLevel || 0) * lvlm;
    s.armor = (b.armor || 0) + (b.armorPerLevel || 0) * lvlm;
    s.mr = (b.mr || 0) + (b.mrPerLevel || 0) * lvlm;
    s.attackSpeed = (b.attackSpeed || 0.68) + (b.attackSpeedPerLevel || 0) * lvlm;
    s.attackRange = b.attackRange || 2.4;
    s.moveSpeed = b.moveSpeed || 5.8;
    s.crit = b.critChance || 0;
    s.critDmg = b.critDamage || 1.75;
    s.lifesteal = b.lifesteal || 0;
    s.hpRegen = (b.hpRegen || 0) + (b.hpRegenPerLevel || 0) * lvlm;
    s.mpRegen = (b.mpRegen || 0) + (b.mpRegenPerLevel || 0) * lvlm;

    // items
    if (u.items) {
      for (const it of u.items) {
        if (!it) continue;
        const st = it.stats || {};
        for (const k in st) {
          if (k === 'msPercent') s.msPercent += st[k];
          else if (k === 'cdr') s.cdr += st[k];
          else if (k === 'crit') s.crit += st[k];
          else if (k === 'critDmg') s.critDmg += st[k];
          else if (k === 'lifesteal') s.lifesteal += st[k];
          else if (k === 'maxHp') { s.maxHp += st[k]; }
          else s[k] = (s[k] || 0) + st[k];
        }
      }
    }
    // buffs
    if (u.buffs) {
      for (const bf of u.buffs) {
        const st = bf.stats || {};
        for (const k in st) s[k] = (s[k] || 0) + st[k];
      }
    }
    // clamp cdr
    s.cdr = G.M.clamp(s.cdr, 0, 0.45);
    s.moveSpeed = s.moveSpeed * (1 + (s.msPercent || 0) / 100);
    s.moveSpeed = G.M.clamp(s.moveSpeed, 2.2, 12);
    return s;
  };

  G.mitigate = function (amount, res) {
    return amount * (100 / (100 + Math.max(0, res)));
  };

  // ---------------- humanoid mesh builder ----------------
  function buildHumanoid(team, bodyColor, opts) {
    opts = opts || {};
    const g = new THREE.Group();
    const skin = opts.skin || 0x333333;
    const accent = opts.accent || bodyColor;
    const h = opts.height || 2.1;

    const body = G.rend.box(opts.bodyW || 0.62, h * 0.42, 0.4, bodyColor, { roughness: 0.6 });
    body.position.y = h * 0.34;
    const head = G.rend.sphere(h * 0.14, skin, { roughness: 0.7 });
    head.position.y = h * 0.62;
    // arms
    const armGeo = new THREE.BoxGeometry(0.2, h * 0.36, 0.2);
    const armMat = G.rend.mat(bodyColor, { roughness: 0.6 });
    const lArm = new THREE.Mesh(armGeo, armMat); lArm.position.set(-0.42, h * 0.36, 0);
    const rArm = new THREE.Mesh(armGeo, armMat); rArm.position.set(0.42, h * 0.36, 0);
    // legs
    const legGeo = new THREE.BoxGeometry(0.24, h * 0.3, 0.24);
    const lLeg = new THREE.Mesh(legGeo, armMat); lLeg.position.set(-0.18, h * 0.15, 0);
    const rLeg = new THREE.Mesh(legGeo, armMat); rLeg.position.set(0.18, h * 0.15, 0);
    g.add(body, head, lArm, rArm, lLeg, rLeg);

    // weapon
    if (opts.weapon) {
      const w = opts.weapon;
      let wm;
      if (w === 'gun') {
        wm = G.rend.box(0.14, 0.14, 0.8, 0x1a1c20, { metal: 0.6, roughness: 0.4 });
        wm.position.set(0.55, h * 0.4, 0.1);
      } else if (w === 'fists') {
        wm = G.rend.sphere(0.16, 0xd8d8d8, { roughness: 0.5 });
        wm.position.set(0.55, h * 0.36, 0);
      } else if (w === 'blade') {
        wm = G.rend.box(0.1, 0.1, 0.9, 0xc9d4de, { metal: 0.8, roughness: 0.25 });
        wm.position.set(0.55, h * 0.36, 0.05);
      } else if (w === 'staff') {
        wm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, h * 0.7, 8), G.rend.mat(accent, { metal: 0.3, roughness: 0.5 }));
        wm.position.set(0.5, h * 0.5, 0);
      } else if (w === 'smg') {
        wm = G.rend.box(0.12, 0.2, 0.55, 0x14161a, { metal: 0.5, roughness: 0.4 });
        wm.position.set(0.55, h * 0.36, 0.05);
      }
      if (wm) g.add(wm);
    }
    // team ring under unit
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.72, 24),
      new THREE.MeshBasicMaterial({ color: G.teamColor[team], transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    g.add(ring);

    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  // ---------------- Unit base class ----------------
  class Unit {
    constructor(opts) {
      this.id = ++G.uid;
      this.team = opts.team;
      this.name = opts.name || 'Unit';
      this.type = opts.type || 'unit';
      this.radius = opts.radius || 0.55;
      this.def = opts.def || null;       // hero definition / data
      this.level = opts.level || 1;
      this.pos = new THREE.Vector3(opts.x || 0, 0, opts.z || 0);
      this.face = { x: 1, z: 0 };
      this.alive = true;
      this.stats = emptyStats();
      this.hp = opts.hp || 100;
      this.mp = opts.mp || 0;
      this.visionRadius = opts.visionRadius || 8;

      // movement
      this.destination = null;
      this.path = null;         // list of {x,z}
      this.pathIdx = 0;
      this.moveDir = new THREE.Vector3();

      // combat
      this.attackTarget = null;
      this.attackTimer = 0;
      this.autoChase = false;
      this.lastHitTime = 0;

      // cooldowns
      this.ccUntil = 0;         // hard CC (stun/suppress)
      this.slowUntil = 0;
      this.slowFactor = 1;
      this.invulnUntil = 0;

      // progression
      this.gold = 0;
      this.xp = 0;
      this.kills = 0; this.deaths = 0; this.assists = 0;
      this.cs = 0;
      this.items = [];
      this.buffs = [];
      this.goldEarned = 0;
      this.dmgDealt = 0;

      // visuals
      this.mesh = this.buildMesh();
      this.mesh.position.copy(this.pos);
      G.scene.add(this.mesh);
      this.healthBar = G.rend.makeHealthBar();
      this.healthBar.sprite.position.set(this.pos.x, 2.6, this.pos.z);
      G.scene.add(this.healthBar.sprite);
      this.hbDirty = true;
      this.dead = false;

      this.recomputeStats();
      this.hp = this.stats.maxHp || this.hp;
      this.maxHp = this.stats.maxHp || this.hp;
      this.mp = this.stats.maxMp || this.mp;
      this.maxMp = this.stats.maxMp || this.mp;
    }

    buildMesh() {
      return buildHumanoid(this.team, G.teamColor[this.team], {});
    }
    recomputeStats() {
      this.stats = G.computeStats(this);
      const hpPct = this.maxHp ? this.hp / this.maxHp : 1;
      const mpPct = this.maxMp ? this.mp / this.maxMp : 1;
      this.maxHp = this.stats.maxHp;
      this.maxMp = this.stats.maxMp;
      this.hp = Math.min(this.maxHp, this.maxHp * hpPct);
      this.mp = Math.min(this.maxMp, this.maxMp * mpPct);
      this.hbDirty = true;
    }

    alive() { return this.alive && !this.dead; }
    isHero() { return this.type === 'hero'; }
    isStructure() { return this.type === 'turret' || this.type === 'inhibitor' || this.type === 'nexus'; }

    facing(x, z) {
      const dx = x - this.pos.x, dz = z - this.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz) || 1;
      this.face = { x: dx / d, z: dz / d };
      this.mesh.rotation.y = Math.atan2(-dz, dx);
    }

    setDestination(x, z, chase) {
      this.destination = { x, z };
      this.path = null;
      this.autoChase = !!chase;
    }
    setPath(path, chase) {
      if (!path || path.length === 0) { this.destination = null; return; }
      this.path = path;
      this.pathIdx = 0;
      this.destination = path[path.length - 1];
      this.autoChase = !!chase;
    }

    canMove() {
      return this.alive && G.state.time < this.ccUntil ? false : true;
    }

    currentMoveSpeed() {
      let ms = this.stats.moveSpeed;
      if (G.state.time < this.slowUntil) ms *= this.slowFactor;
      return ms;
    }

    move(dt) {
      if (!this.canMove() || !this.destination) return;
      const ms = this.currentMoveSpeed();

      // follow path waypoints
      let target = this.destination;
      if (this.path && this.pathIdx < this.path.length) {
        target = this.path[this.pathIdx];
      }

      const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 0.15) {
        if (this.path && this.pathIdx < this.path.length - 1) { this.pathIdx++; return; }
        this.destination = null;
        this.path = null;
        return;
      }
      const step = ms * dt;
      const nx = this.pos.x + (dx / d) * step;
      const nz = this.pos.z + (dz / d) * step;
      const oldx = this.pos.x, oldz = this.pos.z;
      this.pos.x = nx; this.pos.z = nz;
      G.nav.resolveStatic(this.pos, this.radius);
      // if stuck against a wall, try sliding along one axis
      if (G.M.dist(this.pos.x, this.pos.z, oldx, oldz) < step * 0.1) {
        this.pos.x = oldx; this.pos.z = oldz;
      }
      this.facing(target.x, target.z);
      this.mesh.position.copy(this.pos);
    }

    // ---------------- combat ----------------
    inRange(t) {
      const r = this.stats.attackRange + t.radius;
      return G.M.dist2(this.pos.x, this.pos.z, t.pos.x, t.pos.z) <= r * r;
    }

    startAttack(t, chase) {
      this.attackTarget = t;
      this.autoChase = !!chase;
      this.destination = null; this.path = null;
    }
    stopAttack() { this.attackTarget = null; }

    tryAttack(dt) {
      if (!this.attackTarget) return;
      const t = this.attackTarget;
      if (!t.alive || t.dead) { this.attackTarget = null; return; }
      if (this.inRange(t)) {
        this.facing(t.pos.x, t.pos.z);
        if (this.attackTimer <= 0) {
          this.performAttack(t);
          this.attackTimer = 1 / this.stats.attackSpeed;
        }
      } else if (this.autoChase) {
        // move toward target if chasing (already handled by caller setting destination)
      }
    }

    performAttack(t) {
      this.lastHitTime = G.state.time;
      this.attackCount = (this.attackCount || 0) + 1;
      let dmg = this.stats.ad;
      if (this.nextAttackBonus) { dmg += this.nextAttackBonus; this.nextAttackBonus = 0; }
      // Rook: Tough Knuckles — bonus damage from bonus health
      if (this.isHero() && this.def && this.def.id === 'rook') {
        const innate = this.def.base.hp + this.def.base.hpPerLevel * (this.level - 1);
        dmg += Math.max(0, this.maxHp - innate) * 0.04;
      }
      // Vesper: Backstab
      if (this.isHero() && this.def && this.def.id === 'vesper') dmg *= G.backstabMult(this, t);
      let isCrit = Math.random() < this.stats.crit;
      // Rico: Headshot — every 4th attack crits
      if (this.isHero() && this.def && this.def.id === 'rico' && this.attackCount % 4 === 0) isCrit = true;
      const total = isCrit ? dmg * this.stats.critDmg : dmg;
      if (this.stats.attackRange >= 3.5) {
        G.spawnProjectile(this, t, { dmg: total, type: G.DMG.PHYSICAL, crit: isCrit, color: 0xffffff, speed: 30 });
      } else {
        this.meleeSwing();
        G.applyDamage(this, t, total, G.DMG.PHYSICAL, { crit: isCrit });
      }
    }

    meleeSwing() {
      // quick visual lunge
      const s = this.mesh.scale.x;
      this.mesh.scale.set(s * 1.08, s * 1.02, s * 1.08);
      const restore = () => this.mesh.scale.set(s, s, s);
      setTimeout(restore, 90);
    }

    takeDamage(amount, type, source, opts) {
      if (!this.alive || this.dead) return 0;
      if (G.state.time < this.invulnUntil) return 0;
      opts = opts || {};
      let dmg = amount;
      if (type === G.DMG.PHYSICAL) dmg = G.mitigate(amount, this.stats.armor);
      else if (type === G.DMG.MAGICAL) dmg = G.mitigate(amount, this.stats.mr);
      dmg *= (1 - Math.min(1, this.stats.dr || 0)); // damage reduction
      // shield absorbs first
      let sLeft = this.stats.shield || 0;
      if (sLeft > 0) {
        const absorbed = Math.min(sLeft, dmg);
        this.stats.shield -= absorbed;
        dmg -= absorbed;
        if (this.stats.shield < 0.001) this.stats.shield = 0;
      }
      dmg = Math.max(0, dmg);
      this.hp -= dmg;
      if (dmg > 0 && this.recalling) { this.recalling = false; this.recallUntil = 0; }
      this.hbDirty = true;
      if (source) {
        source.dmgDealt = (source.dmgDealt || 0) + dmg;
        const heal = dmg * (source.stats ? source.stats.lifesteal : 0);
        if (heal > 0 && source.alive) source.heal(heal);
      }
      // damage number
      if (opts.silent !== true) {
        const color = opts.crit ? '#ffb020' : (type === G.DMG.MAGICAL ? '#7cc7ff' : '#ffffff');
        G.rend.floatingText(Math.round(dmg), new THREE.Vector3(this.pos.x, this.pos.y + 2.2, this.pos.z), color);
      }
      if (this.hp <= 0) { this.hp = 0; this.die(source); }
      return dmg;
    }

    heal(amount) {
      if (!this.alive || this.dead) return;
      this.hp = Math.min(this.maxHp, this.hp + amount);
      this.hbDirty = true;
    }

    die(killer) {
      if (!this.alive || this.dead) return;
      this.alive = false;
      this.dead = true;
      this.deaths++;
      this.attackTarget = null;
      this.destination = null;
      // visual
      this.mesh.visible = false;
      this.healthBar.sprite.visible = false;
      G.events.emit('death', { unit: this, killer });
    }

    update(dt) {
      this.move(dt);
      if (this.attackTimer > 0) this.attackTimer -= dt;
      this.tryAttack(dt);
      // regen
      if (this.alive && this.stats.hpRegen > 0 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.stats.hpRegen * dt);
      if (this.alive && this.stats.mpRegen > 0 && this.mp < this.maxMp) this.mp = Math.min(this.maxMp, this.mp + this.stats.mpRegen * dt);
      // health bar follow
      this.healthBar.sprite.position.set(this.pos.x, this.pos.y + 2.7, this.pos.z);
      if (this.hbDirty) {
        this.hbDirty = false;
        const pct = this.maxHp ? this.hp / this.maxHp : 0;
        this.healthBar.sprite.visible = this.alive && pct < 0.999;
        G.rend.drawHealthBar(this.healthBar, pct, this.team);
      }
      this.mesh.position.copy(this.pos);
    }
  }

  // ---------------- Hero ----------------
  class Hero extends Unit {
    constructor(opts) {
      super(opts);
      this.type = 'hero';
      this.isPlayer = !!opts.isPlayer;
      this.abilities = [];   // filled by G.buildAbilities
      this.qLevel = 1; this.wLevel = 1; this.eLevel = 1; this.rLevel = 0;
      this.skillPoints = 1;
      this.respawnAt = 0;
      this.recalling = false;
      this.recallUntil = 0;
      this.killStreak = 0;
      this.bounty = 300;
      this.lastDamageFrom = null;
      this.assistTrack = [];
      this.nextAttackBonus = 0;
      this.attackCount = 0;
      this.stealthUntil = 0;
      this.updateMeshHero();
    }
    updateMeshHero() {
      // heroes get a taller custom mesh from def
      const def = this.def;
      if (!def) return;
      const old = this.mesh;
      this.mesh = G.buildHeroMesh(this);
      this.mesh.position.copy(this.pos);
      this.mesh.rotation.y = old.rotation.y;
      G.scene.add(this.mesh);
      G.scene.remove(old);
    }
    recomputeStats() {
      super.recomputeStats();
      // mana/energy resource handled by def
    }
    useAbility(i, target) {
      const ab = this.abilities[i];
      if (!ab) return false;
      if (G.state.time < ab.cooldownUntil) return false;
      if (this.mp < ab.cost) return false;
      if (this.ccUntil > G.state.time) return false;
      return true;
    }
    die(killer) {
      super.die(killer);
      this.recalling = false;
      const t = G.respawnTime(this.level, G.state.time);
      this.respawnAt = G.state.time + t;
      if (killer && killer.team !== this.team && killer.isHero()) {
        killer.kills++;
        killer.gold += killer.killReward(this);
        // bounty system
        this.bounty = 300;
        this.killStreak = 0;
        // assists
        for (const id of this.assistTrack) {
          const a = G.state.heroes.find((h) => h.id === id);
          if (a && a.team === killer.team && a.id !== killer.id) { a.assists++; a.gold += G.GOLD.assist; }
        }
      }
      G.events.emit('heroDeath', { hero: this, killer });
    }
    killReward(victim) {
      let g = G.GOLD.heroKill + (victim.killStreak || 0) * 60;
      return g;
    }
  }

  // ---------------- Minion ----------------
  class Minion extends Unit {
    constructor(opts) {
      super(opts);
      this.type = 'minion';
      this.kind = opts.kind || 'melee'; // melee | ranged | siege | super
      this.lane = opts.lane;
      this.leashPos = null;   // leash anchor
      this.waypoints = opts.waypoints || [];
      this.wpIdx = 0;
      this.aggro = null;
      this.applyKind();
    }
    applyKind() {
      const M = G.MINION;
      let hp, ad, range, color, radius, size;
      if (this.kind === 'ranged') { hp = M.rangedHp; ad = M.rangedAd; range = M.rangedRange; color = 0xcdd6e0; radius = 0.5; size = 1.0; }
      else if (this.kind === 'siege') { hp = M.siegeHp; ad = M.siegeAd; range = M.rangedRange; color = 0xaab6c4; radius = 0.7; size = 1.2; }
      else if (this.kind === 'super') { hp = M.superHp; ad = M.superAd; range = 2.4; color = 0xffd28a; radius = 0.75; size = 1.35; }
      else { hp = M.meleeHp; ad = M.meleeAd; range = M.range; color = 0xcdd6e0; radius = 0.5; size = 0.95; }
      this.def = { base: { hp, ad, armor: M.armor, mr: M.mr, attackSpeed: 1.0, attackRange: range, moveSpeed: M.speed } };
      this.hp = hp; this.maxHp = hp;
      this.radius = radius;
      this.minionColor = color;
      this.mesh.scale.setScalar(size);
    }
    buildMesh() {
      return buildHumanoid(this.team, G.teamColor[this.team], { height: 1.6, bodyW: 0.5, weapon: this.kind === 'ranged' || this.kind === 'siege' ? 'gun' : 'fists' });
    }
    bounty() {
      if (this.kind === 'super') return G.MINION.superBounty;
      if (this.kind === 'siege') return G.MINION.siegeBounty;
      return G.MINION.bounty;
    }
    xpValue() { return this.kind === 'super' ? G.MINION.superXp : G.MINION.xp; }

    update(dt) {
      // aggro: if an enemy hero attacked us recently, or nearest enemy within leash
      this.updateAggro();
      if (this.aggro && this.aggro.alive) {
        this.startAttack(this.aggro, true);
        // move toward aggro if out of range
        if (!this.inRange(this.aggro)) {
          this.destination = { x: this.aggro.pos.x, z: this.aggro.pos.z };
          this.path = null;
        } else {
          this.destination = null;
        }
      } else if (!this.attackTarget || !this.attackTarget.alive) {
        // follow lane waypoints toward enemy base
        if (this.wpIdx < this.waypoints.length) {
          const wp = this.waypoints[this.wpIdx];
          this.destination = { x: wp.x, z: wp.z };
          if (G.M.dist(this.pos.x, this.pos.z, wp.x, wp.z) < 1.0) this.wpIdx++;
        } else {
          this.destination = null;
        }
        // auto-acquire nearest enemy in range
        const near = this.nearestEnemy(6);
        if (near) this.startAttack(near, false);
      }
      super.update(dt);
      // stop at final waypoint
      if (this.wpIdx >= this.waypoints.length && !this.attackTarget) this.destination = null;
    }

    updateAggro() {
      // if currently fighting, keep; else pick nearest enemy hero (prioritize) or minion within leash
      const leash = this.leashPos || this.pos;
      if (this.attackTarget && this.attackTarget.alive && G.M.dist(this.pos.x, this.pos.z, leash.x, leash.z) < 12) return;
      let best = null, bestScore = Infinity;
      for (const u of G.state.units()) {
        if (u.team === this.team || !u.alive) continue;
        const d = G.M.dist2(this.pos.x, this.pos.z, u.pos.x, u.pos.z);
        const score = u.isHero() ? d * 0.5 : d;
        if (score < bestScore && d < 14 * 14) { bestScore = score; best = u; }
      }
      this.aggro = best;
    }

    nearestEnemy(maxDist) {
      let best = null, bestD = maxDist * maxDist;
      for (const u of G.state.units()) {
        if (u.team === this.team || !u.alive) continue;
        if (u.isStructure()) continue;
        const d = G.M.dist2(this.pos.x, this.pos.z, u.pos.x, u.pos.z);
        if (d < bestD) { bestD = d; best = u; }
      }
      return best;
    }

    die(killer) {
      super.die(killer);
      // gold + xp to killer (last-hit)
      if (killer && killer.team !== this.team && killer.isHero()) {
        killer.gold += this.bounty();
        killer.goldEarned += this.bounty();
        killer.cs++;
        G.grantXp(killer, this.xpValue());
        // nearby allied heroes share XP
        for (const h of G.state.heroes) {
          if (h.team === killer.team && h.id !== killer.id && h.alive && G.M.dist(h.pos.x, h.pos.z, this.pos.x, this.pos.z) < 12) {
            G.grantXp(h, this.xpValue() * 0.5);
          }
        }
      }
      G.events.emit('minionDeath', { minion: this, killer });
    }
  }

  // ---------------- Turret ----------------
  class Turret extends Unit {
    constructor(opts) {
      super(opts);
      this.type = 'turret';
      this.radius = G.TURRET.radius;
      this.tier = opts.tier;
      this.lane = opts.lane;
      this.structure = true;
      this.hitStreak = 0; this.hitStreakTarget = null;
      this.def = { base: { hp: G.TURRET.hp, ad: G.TURRET.ad, armor: G.TURRET.armor, mr: G.TURRET.mr, attackSpeed: G.TURRET.attackSpeed, attackRange: G.TURRET.range } };
      this.hp = G.TURRET.hp; this.maxHp = G.TURRET.hp;
      this.invulnUntil = Infinity; // until minion/turret alive (set by main)
      this.visionRadius = 11;
    }
    buildMesh() {
      const g = new THREE.Group();
      const base = G.rend.cylinder(1.5, 1.8, 1.0, 0x2a2f38, { roughness: 0.7 });
      base.position.y = 0.5;
      const shaft = G.rend.cylinder(0.5, 0.7, 5.0, 0x333a45, { roughness: 0.6 });
      shaft.position.y = 3.4;
      const head = G.rend.box(1.6, 0.9, 1.6, G.teamColor[this.team], { emissive: G.teamColor[this.team], emissiveIntensity: 0.4, roughness: 0.5 });
      head.position.y = 6.0;
      const core = G.rend.sphere(0.45, 0xffffff, { emissive: G.teamColor[this.team], emissiveIntensity: 1.2 });
      core.position.y = 6.0;
      g.add(base, shaft, head, core);
      g.userData.core = core;
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return g;
    }
    acquireTarget() {
      let best = null, bestD = this.stats.attackRange + 2;
      for (const u of G.state.units()) {
        if (u.team === this.team || !u.alive) continue;
        const d = G.M.dist(this.pos.x, this.pos.z, u.pos.x, u.pos.z);
        if (d < bestD) { bestD = d; best = u; }
      }
      return best;
    }
    update(dt) {
      if (!this.alive) return;
      if (this.invulnUntil > G.state.time) { this.mesh.userData.core.material = G.rend.mat(0x888888); }
      // find target: prioritize enemy hero attacking allies under turret, else nearest
      let target = null;
      for (const u of G.state.heroes) {
        if (u.team === this.team || !u.alive) continue;
        const d = G.M.dist(this.pos.x, this.pos.z, u.pos.x, u.pos.z);
        if (d < this.stats.attackRange && u.attackTarget && u.attackTarget.team === this.team) { target = u; break; }
      }
      if (!target) target = this.acquireTarget();
      this.attackTarget = target;
      super.update(dt);
      // ramping damage vs same hero
      if (target && target.isHero()) {
        if (this.hitStreakTarget === target.id) this.hitStreak++;
        else { this.hitStreakTarget = target.id; this.hitStreak = 0; }
      } else this.hitStreak = 0;
    }
    performAttack(t) {
      this.lastHitTime = G.state.time;
      const ramp = t.isHero() ? 1 + this.hitStreak * G.TURRET.rampPerHit : 1;
      G.spawnProjectile(this, t, { dmg: this.stats.ad * ramp, type: G.DMG.PHYSICAL, color: G.teamColor[this.team], speed: 26, size: 1.3 });
    }
  }

  // ---------------- Inhibitor (non-attacking structure) ----------------
  class Inhibitor extends Unit {
    constructor(opts) {
      super(opts);
      this.type = 'inhibitor';
      this.radius = G.INHIBITOR.radius;
      this.lane = opts.lane;
      this.def = { base: { hp: G.INHIBITOR.hp, armor: 30, mr: 30 } };
      this.hp = G.INHIBITOR.hp; this.maxHp = G.INHIBITOR.hp;
      this.respawnTimer = 0;
      this.destroyed = false;
      this.visionRadius = 9;
    }
    buildMesh() {
      const g = new THREE.Group();
      const ped = G.rend.cylinder(1.0, 1.2, 0.8, 0x2a2f38, { roughness: 0.7 });
      ped.position.y = 0.4;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(1.0), G.rend.mat(G.teamColor[this.team], { emissive: G.teamColor[this.team], emissiveIntensity: 0.9, roughness: 0.3 }));
      gem.position.y = 1.6;
      gem.rotation.y = Math.PI / 4;
      g.add(ped, gem);
      g.userData.gem = gem;
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return g;
    }
    update(dt) {
      super.update(dt);
      if (this.destroyed) {
        this.respawnTimer -= dt;
        if (this.respawnTimer <= 0) { this.respawn(); }
      }
    }
    die(killer) {
      if (this.destroyed) return;
      super.die(killer);
      this.destroyed = true;
      this.respawnTimer = G.INHIBITOR.respawn;
      this.mesh.visible = false;
      this.healthBar.sprite.visible = false;
      G.events.emit('inhibitorDestroyed', { inhibitor: this, killer });
    }
    respawn() {
      this.destroyed = false;
      this.alive = true; this.dead = false;
      this.hp = this.maxHp;
      this.mesh.visible = true;
      this.hbDirty = true;
      G.events.emit('inhibitorRespawn', { inhibitor: this });
    }
  }

  // ---------------- Nexus ----------------
  class Nexus extends Unit {
    constructor(opts) {
      super(opts);
      this.type = 'nexus';
      this.radius = G.NEXUS.radius;
      this.def = { base: { hp: G.NEXUS.hp, armor: 40, mr: 40 } };
      this.hp = G.NEXUS.hp; this.maxHp = G.NEXUS.hp;
      this.visionRadius = 12;
    }
    buildMesh() {
      const g = new THREE.Group();
      const base = G.rend.cylinder(2.2, 2.6, 1.4, 0x2a2f38, { roughness: 0.7 });
      base.position.y = 0.7;
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.8), G.rend.mat(G.teamColor[this.team], { emissive: G.teamColor[this.team], emissiveIntensity: 0.7, roughness: 0.25 }));
      crystal.position.y = 2.6;
      g.add(base, crystal);
      g.userData.crystal = crystal;
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return g;
    }
    die(killer) {
      super.die(killer);
      G.events.emit('nexusDestroyed', { nexus: this, killer });
    }
  }

  // ---------------- Monster (jungle neutral) ----------------
  class Monster extends Unit {
    constructor(opts) {
      super(opts);
      this.type = 'monster';
      this.camp = opts.camp;
      this.kind = opts.kind;
      this.def = { base: { hp: opts.hp, ad: opts.ad, armor: opts.armor || 0, mr: opts.mr || 0, attackSpeed: 1.0, attackRange: opts.range || 2.2 } };
      this.hp = opts.hp; this.maxHp = opts.hp;
      this.radius = opts.radius || 0.6;
      this.spawnPos = { x: opts.x, z: opts.z };
      this.leashRange = 7;
      this.respawnAt = 0;
      this.visionRadius = 5;
      this.isEpic = !!opts.epic;
      if (this.isEpic) { this.buffName = opts.buffName; this.radius = opts.radius || 1.4; }
    }
    buildMesh() {
      const g = new THREE.Group();
      const color = this.isEpic ? (this.kind === 'kingpin' ? 0x7a4bff : 0xffa533) : 0x4a5568;
      const body = G.rend.sphere(0.7, color, { roughness: 0.8, flat: true });
      body.position.y = 0.7;
      const head = G.rend.sphere(0.4, color, { roughness: 0.8, flat: true });
      head.position.y = 1.25;
      const eye = G.rend.sphere(0.12, 0xff3355, { emissive: 0xff3355, emissiveIntensity: 1.2 });
      eye.position.set(0, 1.25, 0.35);
      g.add(body, head, eye);
      g.scale.setScalar(this.isEpic ? 1.9 : (this.kind === 'golem' ? 1.3 : 1.0));
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return g;
    }
    update(dt) {
      if (!this.alive) {
        if (this.respawnAt && G.state.time >= this.respawnAt) { this.respawn(); return; }
        return;
      }
      // leash: if pulled too far, reset
      if (G.M.dist(this.pos.x, this.pos.z, this.spawnPos.x, this.spawnPos.z) > this.leashRange) {
        this.hp = this.maxHp;
        this.hbDirty = true;
        this.pos.set(this.spawnPos.x, 0, this.spawnPos.z);
        this.mesh.position.copy(this.pos);
        this.attackTarget = null;
        this.aggro = null;
      }
      // acquire target: nearest attacker / enemy in range
      if (!this.attackTarget || !this.attackTarget.alive) {
        let best = null, bestD = 6 * 6;
        for (const u of G.state.heroes) {
          if (!u.alive) continue;
          const d = G.M.dist2(this.pos.x, this.pos.z, u.pos.x, u.pos.z);
          if (d < bestD) { bestD = d; best = u; }
        }
        this.aggro = best;
      }
      if (this.aggro && this.aggro.alive) {
        this.startAttack(this.aggro, true);
        if (!this.inRange(this.aggro)) this.destination = { x: this.aggro.pos.x, z: this.aggro.pos.z };
        else this.destination = null;
      }
      super.update(dt);
    }
    die(killer) {
      super.die(killer);
      this.respawnAt = G.state.time + (this.isEpic ? 300 : 90);
      this.mesh.visible = false;
      this.healthBar.sprite.visible = false;
      if (killer && killer.isHero()) {
        killer.gold += this.camp ? this.camp.bounty : 0;
        killer.goldEarned += this.camp ? this.camp.bounty : 0;
        killer.cs++;
        G.grantXp(killer, this.camp ? this.camp.xp : 0);
        // grant buff to killing team (epic)
        if (this.isEpic) {
          for (const h of G.state.heroes) {
            if (h.team === killer.team && h.alive) {
              G.addBuff(h, { name: this.buffName, stats: this.buffStats() });
            }
          }
          G.announce(this.buffName + ' claimed by ' + G.teamName[killer.team] + '!', G.teamColorCSS[killer.team]);
        }
      }
      G.events.emit('monsterDeath', { monster: this, killer });
    }
    buffStats() {
      if (this.kind === 'kingpin') return { ad: 40, ap: 40, hpRegen: 6 };
      return { ad: 25, ap: 25, moveSpeed: 0.6 };
    }
    respawn() {
      this.alive = true; this.dead = false;
      this.hp = this.maxHp;
      this.respawnAt = 0;
      this.pos.set(this.spawnPos.x, 0, this.spawnPos.z);
      this.mesh.visible = true;
      this.hbDirty = true;
    }
  }

  // ---------------- projectiles ----------------
  G.spawnProjectile = function (source, target, opts) {
    const p = new G.Projectile(source, target, opts);
    G.state.projectiles.push(p);
    return p;
  };

  G.Projectile = class Projectile {
    constructor(source, target, opts) {
      this.source = source;
      this.target = target;
      this.opts = opts;
      this.pos = new THREE.Vector3(source.pos.x, source.pos.y + 1.2, source.pos.z);
      this.speed = opts.speed || 26;
      this.dmg = opts.dmg;
      this.type = opts.type || G.DMG.PHYSICAL;
      this.color = opts.color || 0xffffff;
      this.size = opts.size || 0.5;
      this.crit = !!opts.crit;
      this.aoe = opts.aoe || 0;
      this.onHit = opts.onHit || null;
      this.dead = false;
      this.mesh = G.rend.sphere(this.size, this.color, { emissive: this.color, emissiveIntensity: 1.0, roughness: 0.3 });
      this.mesh.position.copy(this.pos);
      G.scene.add(this.mesh);
    }
    update(dt) {
      if (this.dead) return;
      let dest;
      if (this.target && this.target.alive) {
        dest = { x: this.target.pos.x, y: this.target.pos.y + 1.1, z: this.target.pos.z };
      } else {
        // homing to last known point; if target dead, hit ground
        if (this.target) dest = { x: this.target.pos.x, y: 0.1, z: this.target.pos.z };
        else dest = this.pos;
      }
      const dx = dest.x - this.pos.x, dy = dest.y - this.pos.y, dz = dest.z - this.pos.z;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const step = this.speed * dt;
      if (d <= step || d < 0.05) {
        this.hit();
      } else {
        this.pos.x += (dx / d) * step;
        this.pos.y += (dy / d) * step;
        this.pos.z += (dz / d) * step;
        this.mesh.position.copy(this.pos);
        this.mesh.rotation.y = G.M.angle(dx, dz);
      }
    }
    hit() {
      this.dead = true;
      G.scene.remove(this.mesh);
      if (this.target && this.target.alive) {
        if (this.onHit) this.onHit(this.target, this.pos);
        else G.applyDamage(this.source, this.target, this.dmg, this.type, { crit: this.crit, aoe: this.aoe });
      }
    }
  };

  // ---------------- damage / buffs / xp ----------------
  G.applyDamage = function (source, target, amount, type, opts) {
    if (!target || !target.alive) return 0;
    const dealt = target.takeDamage(amount, type, source, opts);
    // track assist
    if (target.isHero() && source && source.isHero() && source.team !== target.team) {
      target.lastDamageFrom = source;
      if (target.assistTrack.indexOf(source.id) < 0) target.assistTrack.push(source.id);
      target.lastHitTime = G.state.time;
    }
    return dealt;
  };

  G.addBuff = function (u, buff) {
    // buff = { name, stats:{}, duration }
    if (!u.buffs) u.buffs = [];
    u.buffs.push(Object.assign({ until: G.state.time + (buff.duration || 60) }, buff));
    u.recomputeStats();
  };

  G.tickBuffs = function (dt) {
    for (const u of G.state.heroes) {
      if (!u.buffs || !u.buffs.length) continue;
      const before = u.buffs.length;
      u.buffs = u.buffs.filter((b) => !b.duration || b.until > G.state.time);
      if (u.buffs.length !== before) u.recomputeStats();
    }
  };

  G.grantXp = function (hero, amount) {
    if (!hero.alive) return;
    hero.xp += amount;
    while (hero.level < 18 && hero.xp >= G.xpToLevel[hero.level]) {
      hero.level++;
      hero.skillPoints++;
      hero.heal(hero.stats.maxHp * 0.25);
      hero.mp = hero.maxMp;
      hero.recomputeStats();
      G.events.emit('levelUp', { hero });
    }
    if (hero.isPlayer) G.events.emit('playerXp', { hero });
  };

  G.announce = function (text, color) {
    G.state.announcements.push({ text, color, at: G.state.time });
    G.events.emit('announce', { text, color });
  };

  // ---------------- spawn helpers ----------------
  G.spawnMinion = function (team, lane, kind) {
    const laneZ = G.WORLD.laneZ[lane];
    const startX = team === G.TEAM_A ? G.WORLD.baseAX + 4 : G.WORLD.baseBX - 4;
    const waypoints = G.map.lanePolylines[lane];
    const wps = team === G.TEAM_A ? waypoints : waypoints.slice().reverse();
    const m = new G.Minion({
      team, lane, kind,
      x: startX, z: laneZ,
      waypoints: wps,
      visionRadius: 6,
    });
    G.state.minions.push(m);
    return m;
  };

  G.spawnHero = function (def, team, opts) {
    opts = opts || {};
    const spawnX = team === G.TEAM_A ? G.WORLD.baseAX + 3 : G.WORLD.baseBX - 3;
    const spawnZ = G.M.rand(-6, 6);
    const h = new G.Hero({
      team, def, name: def.name,
      x: spawnX, z: spawnZ,
      isPlayer: !!opts.isPlayer,
      radius: 0.6,
      visionRadius: 9,
    });
    h.def = def;
    h.recomputeStats();
    h.hp = h.maxHp; h.mp = h.maxMp;
    // build abilities
    if (G.buildAbilities) G.buildAbilities(h);
    G.state.heroes.push(h);
    return h;
  };

  G.spawnMonsterCamp = function (camp) {
    const info = G.JUNGLE.monsters[camp.kind];
    for (let i = 0; i < camp.count; i++) {
      const ang = (i / camp.count) * Math.PI * 2;
      const m = new G.Monster({
        team: G.TEAM_B, // neutral but hostile-to-all via aggro logic; team used only for color neutrality
        kind: camp.kind, camp: info,
        x: camp.x + Math.cos(ang) * 1.5, z: camp.z + Math.sin(ang) * 1.5,
        hp: info.hp, ad: info.ad, armor: info.armor, mr: info.mr, range: info.range, radius: info.radius,
      });
      m.campData = { x: camp.x, z: camp.z, bounty: info.bounty, xp: info.xp };
      G.state.monsters.push(m);
    }
  };

  G.spawnEpic = function (epic, kind) {
    const m = new G.Monster({
      team: G.TEAM_B,
      kind, epic: true, buffName: epic.buffName,
      x: epic.x, z: epic.z,
      hp: epic.hp, ad: epic.ad, radius: epic.radius, range: 3.0, armor: 30, mr: 30,
    });
    m.campData = { x: epic.x, z: epic.z, bounty: epic.bounty, xp: epic.xp };
    G.state.monsters.push(m);
  };

  // ---------------- hero mesh (distinct silhouette per role) ----------------
  G.buildHeroMesh = function (hero) {
    const def = hero.def;
    const role = def.role;
    const color = G.teamColor[hero.team];
    const accent = def.accent || color;
    const opts = { height: 2.3, bodyW: 0.7, accent, skin: def.skin || 0xc9a07a };
    switch (role) {
      case 'Fighter': opts.weapon = 'fists'; break;
      case 'Assassin': opts.weapon = 'blade'; break;
      case 'Mage': opts.weapon = 'staff'; break;
      case 'Marksman': opts.weapon = 'gun'; break;
      case 'Support': opts.weapon = 'smg'; break;
      default: opts.weapon = 'fists';
    }
    // tint body toward accent for readability
    const mesh = buildHumanoid(hero.team, accent, opts);
    return mesh;
  };

  G.Unit = Unit;
  G.Hero = Hero;
  G.Minion = Minion;
  G.Turret = Turret;
  G.Inhibitor = Inhibitor;
  G.Nexus = Nexus;
  G.Monster = Monster;

  window.G = G;
})();
