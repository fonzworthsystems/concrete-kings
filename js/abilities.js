// abilities.js — ability runtime, targeting, casting, zones, DoTs, CC
(function () {
  const G = window.G;

  G.state.zones = G.state.zones || [];
  G.state.dots = G.state.dots || [];

  // ---------------- build & level ----------------
  G.buildAbilities = function (hero) {
    hero.abilities = hero.def.abilities.map((d) => ({ def: d, level: 0, cooldownUntil: 0 }));
    hero.abilities[0].level = 1;
    hero.abilities[1].level = 1;
    hero.abilities[2].level = 1;
    hero.abilities[3].level = 0;
    hero.skillPoints = 1;
  };

  G.abVal = function (ab, arr) {
    if (!arr) return 0;
    const l = Math.max(0, Math.min(ab.level - 1, arr.length - 1));
    return arr[l];
  };

  G.levelUpAbility = function (hero, i) {
    if (!hero.skillPoints || hero.skillPoints <= 0) return false;
    const ab = hero.abilities[i];
    if (!ab) return false;
    const max = ab.def.key === 'R' ? 3 : 5;
    if (ab.level >= max) return false;
    if (ab.def.key === 'R' && hero.level < 6 + ab.level * 5) return false;
    ab.level++;
    hero.skillPoints--;
    if (hero.isPlayer) G.events.emit('abilityLevel', { hero });
    return true;
  };

  G.autoLevel = function (hero) {
    let guard = 0;
    while (hero.skillPoints > 0 && guard++ < 30) {
      const r = hero.abilities[3];
      if (hero.level >= 6 && r.level < 3 && hero.level >= 6 + r.level * 5) { G.levelUpAbility(hero, 3); continue; }
      let idx = -1, low = 99;
      for (let i = 0; i < 3; i++) {
        const a = hero.abilities[i];
        if (a.level < 5 && a.level < low) { low = a.level; idx = i; }
      }
      if (idx >= 0) G.levelUpAbility(hero, idx);
      else break;
    }
  };

  // ---------------- damage helpers ----------------
  G.abilityDamage = function (hero, ab) {
    let d = G.abVal(ab, ab.def.base);
    if (ab.def.adRatio) d += hero.stats.ad * ab.def.adRatio;
    if (ab.def.apRatio) d += hero.stats.ap * ab.def.apRatio;
    return d;
  };

  // volt overcharge mark
  G.voltBonus = function (hero, target) {
    if (hero.def && hero.def.id === 'volt') {
      if (target.voltedBy === hero.id) { target.voltedBy = null; return 1.2; }
      target.voltedBy = hero.id;
    }
    return 1.0;
  };

  // ---------------- CC ----------------
  G.applyStun = function (target, dur) {
    if (target.ccUntil < G.state.time + dur) target.ccUntil = G.state.time + dur;
    if (target.recalling) { target.recalling = false; }
  };
  G.applySlow = function (target, slow, dur) {
    target.slowUntil = G.state.time + dur;
    target.slowFactor = 1 - slow;
  };

  // ---------------- AoE helpers ----------------
  function enemiesInRadius(hero, x, z, r) {
    const out = [];
    for (const u of G.state.units()) {
      if (u.team === hero.team || !u.alive) continue;
      if (G.M.dist(u.pos.x, u.pos.z, x, z) <= r + u.radius) out.push(u);
    }
    return out;
  }
  function alliesInRadius(hero, x, z, r) {
    const out = [];
    for (const u of G.state.heroes) {
      if (u.team !== hero.team || !u.alive) continue;
      if (G.M.dist(u.pos.x, u.pos.z, x, z) <= r + u.radius) out.push(u);
    }
    return out;
  }

  G.damageAoe = function (hero, x, z, r, dmg, type, opts) {
    opts = opts || {};
    for (const t of enemiesInRadius(hero, x, z, r)) {
      const mult = G.voltBonus(hero, t) * (opts.backstab ? G.backstabMult(hero, t) : 1);
      G.applyDamage(hero, t, dmg * mult, type, { crit: opts.crit });
    }
  };

  G.backstabMult = function (hero, t) {
    if (hero.def && hero.def.id === 'vesper') {
      const dx = t.pos.x - hero.pos.x, dz = t.pos.z - hero.pos.z;
      const d = Math.sqrt(dx * dx + dz * dz) || 1;
      const dot = (t.face.x * (dx / d)) + (t.face.z * (dz / d));
      if (dot > 0.2) return 1.15;
    }
    return 1.0;
  };

  // ---------------- effects ----------------
  G.fxRing = function (x, z, radius, color, life) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.4, radius, 40),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.08, z);
    G.scene.add(ring);
    G.state.effects.push({ mesh: ring, born: G.state.time, life: life || 0.4, update(m, dt) { m.scale.setScalar(1 + dt * 4); m.material.opacity *= 0.92; } });
  };
  G.fxFlash = function (x, z, color, radius) {
    const s = G.rend.sphere(radius || 0.8, color, { emissive: color, emissiveIntensity: 2 });
    s.position.set(x, 0.6, z);
    G.scene.add(s);
    G.state.effects.push({ mesh: s, born: G.state.time, life: 0.35, update(m, dt) { m.material.transparent = true; m.material.opacity = Math.max(0, (m.material.opacity === undefined ? 1 : m.material.opacity) - dt * 3); m.scale.multiplyScalar(1 + dt * 2); } });
  };
  G.fxLine = function (x0, z0, x1, z1, color, life) {
    const len = G.M.dist(x0, z0, x1, z1);
    const mid = { x: (x0 + x1) / 2, z: (z0 + z1) / 2 };
    const ang = G.M.angle(x1 - x0, z1 - z0);
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(len, 0.5, 0.12),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false })
    );
    m.position.set(mid.x, 1.2, mid.z);
    m.rotation.y = ang;
    G.scene.add(m);
    G.state.effects.push({ mesh: m, born: G.state.time, life: life || 0.3, update(m2) { m2.material.opacity *= 0.9; } });
  };

  // ---------------- skillshot projectile ----------------
  G.spawnSkillshot = function (hero, ab, dirX, dirZ, opts) {
    opts = opts || {};
    const dmg = G.abilityDamage(hero, ab);
    const p = new G.Projectile(hero, null, {
      dmg, type: opts.type || G.DMG.MAGICAL, color: opts.color || 0x9bd7ff, speed: ab.def.speed || 30, size: opts.size || 0.4,
      pierce: ab.def.pierce || false,
    });
    p.direction = { x: dirX, z: dirZ };
    p.maxRange = ab.def.range || 11;
    p.origin = { x: hero.pos.x, z: hero.pos.z };
    p.skillshot = true;
    p.skill = ab;
    p.skillOpts = opts;
    p.pos.set(hero.pos.x, hero.pos.y + 1.3, hero.pos.z);
    G.state.projectiles.push(p);
    return p;
  };

  // override projectile update for skillshots (non-homing)
  G.Projectile.prototype.update = (function (orig) {
    return function (dt) {
      if (this.dead) return;
      if (this.skillshot) {
        const step = this.speed * dt;
        this.pos.x += this.direction.x * step;
        this.pos.z += this.direction.z * step;
        this.pos.y += this.direction.y * step;
        this.mesh.position.copy(this.pos);
        this.mesh.rotation.y = G.M.angle(this.direction.x, this.direction.z);
        // range check
        if (G.M.dist(this.pos.x, this.pos.z, this.origin.x, this.origin.z) > this.maxRange) { this.expire(); return; }
        // hit check
        let hit = null;
        for (const u of G.state.units()) {
          if (u.team === this.source.team || !u.alive) continue;
          const d = G.M.dist(this.pos.x, this.pos.z, u.pos.x, u.pos.z);
          if (d <= (this.size + u.radius)) { hit = u; break; }
        }
        if (hit) {
          if (this.skillOpts.onHit) this.skillOpts.onHit(hit, this.pos);
          else {
            const mult = G.voltBonus(this.source, hit);
            G.applyDamage(this.source, hit, this.dmg * mult, this.type, {});
          }
          if (this.skill.def.pierce) {
            // mark hit so we don't double-hit; store hit ids
            this.hitIds = this.hitIds || [];
            if (this.hitIds.indexOf(hit.id) >= 0) return;
            this.hitIds.push(hit.id);
          } else {
            this.expire();
          }
        }
        return;
      }
      orig.call(this, dt);
    };
  })(G.Projectile.prototype.update);
  G.Projectile.prototype.expire = function () {
    this.dead = true;
    G.scene.remove(this.mesh);
  };

  // ---------------- zones ----------------
  G.Zone = class Zone {
    constructor(hero, x, z, radius, dur, opts) {
      this.hero = hero; this.x = x; this.z = z; this.radius = radius;
      this.until = G.state.time + dur;
      this.opts = opts;
      this.lastTick = 0;
      this.mesh = new THREE.Mesh(
        new THREE.CircleGeometry(radius, 40),
        new THREE.MeshBasicMaterial({ color: opts.color || 0x37c8ff, transparent: true, opacity: 0.22, depthWrite: false })
      );
      this.mesh.rotation.x = -Math.PI / 2;
      this.mesh.position.set(x, 0.07, z);
      G.scene.add(this.mesh);
      G.state.zones.push(this);
    }
    update(dt) {
      if (G.state.time >= this.until) { this.destroy(); return false; }
      if (G.state.time - this.lastTick >= this.opts.tick) {
        this.lastTick = G.state.time;
        this.tick();
      }
      this.mesh.material.opacity = 0.16 + 0.08 * Math.sin(G.state.time * 3);
      return true;
    }
    tick() {}
    destroy() { G.scene.remove(this.mesh); this.dead = true; }
  };

  G.DamageZone = class DamageZone extends G.Zone {
    tick() {
      const dmg = G.abVal(this.hero.abilities.find(a => a.def === this.opts.ab), this.opts.ab.base) + (this.opts.apRatio ? this.hero.stats.ap * this.opts.apRatio : 0) + (this.opts.adRatio ? this.hero.stats.ad * this.opts.adRatio : 0);
      for (const t of enemiesInRadius(this.hero, this.x, this.z, this.radius)) {
        G.applyDamage(this.hero, t, dmg, this.opts.type || G.DMG.MAGICAL, {});
        if (this.opts.slow) G.applySlow(t, this.opts.slow, 0.6);
      }
    }
  };
  G.HealZone = class HealZone extends G.Zone {
    tick() {
      for (const a of alliesInRadius(this.hero, this.x, this.z, this.radius)) {
        a.heal(this.opts.heal + (this.opts.apRatio ? this.hero.stats.ap * this.opts.apRatio : 0));
      }
    }
  };

  // ---------------- cast ----------------
  G.castAbility = function (hero, ab, target, point) {
    if (ab.level <= 0) return false;
    if (G.state.time < ab.cooldownUntil) return false;
    if (hero.mp < ab.def.cost) return false;
    if (G.state.time < hero.ccUntil) return false;
    if (hero.recalling) hero.recalling = false;

    const def = ab.def;
    const dmg = G.abilityDamage(hero, ab);
    const kind = def.kind;

    // spend mana + cooldown (unless execute resets)
    hero.mp -= def.cost;
    ab.cooldownUntil = G.state.time + def.cooldown;

    switch (kind) {
      case 'dashStrike': case 'dashTarget': {
        if (!target) return false;
        const t = target;
        // dash to just outside target
        const ang = G.M.angle(t.pos.x - hero.pos.x, t.pos.z - hero.pos.z);
        const d = Math.max(0.5, G.M.dist(hero.pos.x, hero.pos.z, t.pos.x, t.pos.z) - (hero.stats.attackRange - 0.5));
        hero.pos.x = t.pos.x - Math.cos(ang) * d;
        hero.pos.z = t.pos.z - Math.sin(ang) * d;
        G.nav.resolveStatic(hero.pos, hero.radius);
        hero.mesh.position.copy(hero.pos);
        hero.facing(t.pos.x, t.pos.z);
        const mult = G.voltBonus(hero, t) * G.backstabMult(hero, t);
        G.applyDamage(hero, t, dmg * mult, G.DMG.PHYSICAL, {});
        if (def.slow) G.applySlow(t, def.slow, def.slowDur);
        G.fxFlash(t.pos.x, t.pos.z, 0xffcc88, 0.6);
        break;
      }
      case 'selfShield': {
        const shield = G.abVal(ab, def.shield) + (def.apRatio ? hero.stats.ap * def.apRatio : 0);
        G.addBuff(hero, { name: def.name, duration: def.dur, stats: { shield, dr: def.dr || 0 } });
        G.fxRing(hero.pos.x, hero.pos.z, 1.6, 0x2ee6a8, 0.5);
        break;
      }
      case 'aoeSelf': {
        G.damageAoe(hero, hero.pos.x, hero.pos.z, def.radius, dmg, G.DMG.PHYSICAL, {});
        for (const t of enemiesInRadius(hero, hero.pos.x, hero.pos.z, def.radius)) G.applySlow(t, def.slow, def.slowDur);
        G.fxRing(hero.pos.x, hero.pos.z, def.radius, 0xff9e3d, 0.5);
        G.fxFlash(hero.pos.x, hero.pos.z, 0xff9e3d, def.radius * 0.6);
        break;
      }
      case 'leapAoe': {
        if (!point) return false;
        const px = G.M.clamp(point.x, -G.WORLD.halfW + 2, G.WORLD.halfW - 2);
        const pz = G.M.clamp(point.z, -G.WORLD.halfD + 2, G.WORLD.halfD - 2);
        G.fxFlash(hero.pos.x, hero.pos.z, 0xff9e3d, 0.5);
        hero.pos.set(px, 0, pz);
        G.nav.resolveStatic(hero.pos, hero.radius);
        hero.mesh.position.copy(hero.pos);
        G.damageAoe(hero, px, pz, def.radius, dmg, G.DMG.PHYSICAL, {});
        for (const t of enemiesInRadius(hero, px, pz, def.radius)) G.applyStun(t, def.stun || 0.5);
        G.fxRing(px, pz, def.radius, 0xff9e3d, 0.6);
        G.fxFlash(px, pz, 0xff9e3d, def.radius * 0.5);
        break;
      }
      case 'stealthBuff': {
        hero.stealthUntil = G.state.time + def.dur;
        hero.nextAttackBonus = G.abVal(ab, def.bonusDmg) + (def.adRatio ? hero.stats.ad * def.adRatio : 0);
        G.addBuff(hero, { name: def.name, duration: def.dur, stats: { msPercent: def.speed * 100 } });
        G.fxFlash(hero.pos.x, hero.pos.z, 0x333344, 1.2);
        break;
      }
      case 'skillshot': case 'skillshotCC': {
        if (!point) return false;
        let dx = point.x - hero.pos.x, dz = point.z - hero.pos.z;
        const dl = Math.sqrt(dx * dx + dz * dz) || 1;
        dx /= dl; dz /= dl;
        const opts = { type: def.kind === 'skillshotCC' ? G.DMG.MAGICAL : (def.pierce ? G.DMG.PHYSICAL : G.DMG.MAGICAL), color: def.pierce ? 0xffd24d : 0x9bd7ff, size: def.radius || 0.5 };
        if (def.kind === 'skillshotCC') opts.color = 0x5cff8a;
        const p = G.spawnSkillshot(hero, ab, dx, dz, opts);
        if (def.bleed) {
          p.skillOpts.onHit = (t, pos) => { G.applyDamage(hero, t, G.abilityDamage(hero, ab), G.DMG.PHYSICAL, {}); G.applyDot(hero, t, G.abVal(ab, def.bleed), def.bleedDur, G.DMG.PHYSICAL); };
        } else if (def.kind === 'skillshotCC') {
          p.skillOpts.onHit = (t, pos) => { G.applyDamage(hero, t, dmg, G.DMG.MAGICAL, {}); G.applyStun(t, G.abVal(ab, def.stun)); G.fxFlash(t.pos.x, t.pos.z, 0x5cff8a, 0.7); };
        } else if (def.pierce) {
          p.skillOpts.onHit = (t, pos) => { G.applyDamage(hero, t, dmg, G.DMG.PHYSICAL, {}); };
        }
        G.fxLine(hero.pos.x, hero.pos.z, hero.pos.x + dx * def.range, hero.pos.z + dz * def.range, opts.color, 0.25);
        break;
      }
      case 'execute': {
        if (!target) return false;
        const t = target;
        let d = dmg;
        if (t.hp / t.maxHp < (def.executeBelow || 0.35)) d *= 1.4;
        const mult = G.backstabMult(hero, t);
        const killed = G.applyDamage(hero, t, d * mult, G.DMG.PHYSICAL, {});
        G.fxFlash(t.pos.x, t.pos.z, 0xb44dff, 0.8);
        if (!t.alive && t.isHero()) ab.cooldownUntil = 0; // reset on kill
        break;
      }
      case 'aoeZone': {
        if (!point) return false;
        new G.DamageZone(hero, point.x, point.z, def.radius, def.dur, { ab: def, apRatio: def.apRatio, slow: def.slow, tick: def.tick || 0.5, color: 0x37c8ff });
        break;
      }
      case 'blink': {
        if (!point) return false;
        const px = G.M.clamp(point.x, -G.WORLD.halfW + 1, G.WORLD.halfW - 1);
        const pz = G.M.clamp(point.z, -G.WORLD.halfD + 1, G.WORLD.halfD - 1);
        G.fxFlash(hero.pos.x, hero.pos.z, 0x37c8ff, 0.5);
        hero.pos.set(px, 0, pz);
        G.nav.resolveStatic(hero.pos, hero.radius);
        hero.mesh.position.copy(hero.pos);
        G.fxFlash(px, pz, 0x37c8ff, 0.5);
        break;
      }
      case 'aoeNuke': {
        if (!point) return false;
        G.damageAoe(hero, point.x, point.z, def.radius, dmg, G.DMG.MAGICAL, {});
        G.fxRing(point.x, point.z, def.radius, 0x37c8ff, 0.6);
        G.fxFlash(point.x, point.z, 0x37c8ff, def.radius * 0.5);
        break;
      }
      case 'attackSpeedBuff': {
        G.addBuff(hero, { name: def.name, duration: def.dur, stats: { attackSpeed: G.abVal(ab, def.bonusAS) } });
        G.fxFlash(hero.pos.x, hero.pos.z, 0xffd24d, 0.6);
        break;
      }
      case 'dashAway': {
        // dash opposite of nearest enemy (or current facing)
        let away = { x: -Math.cos(hero.mesh.rotation.y), z: -Math.sin(hero.mesh.rotation.y) };
        let near = null, nearD = 99;
        for (const u of G.state.units()) {
          if (u.team === hero.team || !u.alive) continue;
          const d = G.M.dist(hero.pos.x, hero.pos.z, u.pos.x, u.pos.z);
          if (d < nearD) { nearD = d; near = u; }
        }
        if (near) { away.x = (hero.pos.x - near.pos.x) / nearD; away.z = (hero.pos.z - near.pos.z) / nearD; }
        hero.pos.x += away.x * def.range;
        hero.pos.z += away.z * def.range;
        G.nav.resolveStatic(hero.pos, hero.radius);
        hero.mesh.position.copy(hero.pos);
        for (const t of enemiesInRadius(hero, hero.pos.x, hero.pos.z, 3)) G.applySlow(t, def.slow, def.slowDur);
        G.fxFlash(hero.pos.x, hero.pos.z, 0xffd24d, 0.5);
        break;
      }
      case 'channelBarrage': {
        if (!point) return false;
        hero.channel = {
          ability: ab, until: G.state.time + def.dur, lastTick: 0,
          x: point.x, z: point.z, radius: def.radius,
        };
        hero.destination = null; hero.attackTarget = null;
        G.fxRing(point.x, point.z, def.radius, 0xffd24d, 0.6);
        break;
      }
      case 'healTarget': {
        if (!target) return false;
        if (target.team === hero.team) {
          target.heal(G.abVal(ab, def.heal) + (def.apRatio ? hero.stats.ap * def.apRatio : 0));
          G.fxFlash(target.pos.x, target.pos.z, 0x5cff8a, 0.5);
        } else {
          G.applyDamage(hero, target, G.abVal(ab, def.dmg) + (def.apRatio ? hero.stats.ap * def.apRatio : 0), G.DMG.MAGICAL, {});
          G.fxFlash(target.pos.x, target.pos.z, 0x7cc7ff, 0.5);
        }
        break;
      }
      case 'shieldAlly': {
        if (!target || target.team !== hero.team) return false;
        const shield = G.abVal(ab, def.shield) + (def.apRatio ? hero.stats.ap * def.apRatio : 0);
        G.addBuff(target, { name: def.name, duration: def.dur, stats: { shield, msPercent: def.speed * 100 } });
        G.fxRing(target.pos.x, target.pos.z, 1.4, 0x5cff8a, 0.5);
        break;
      }
      case 'aoeHealZone': {
        if (!point) return false;
        const z = new G.HealZone(hero, point.x, point.z, def.radius, def.dur, { heal: G.abVal(ab, def.heal), apRatio: def.apRatio, tick: def.tick || 0.5, color: 0x5cff8a });
        // damage amp buff to allies inside at cast
        for (const a of alliesInRadius(hero, point.x, point.z, def.radius)) {
          G.addBuff(a, { name: def.name, duration: def.dur, stats: { ad: a.stats.ad * (def.dmgAmp || 0), ap: a.stats.ap * (def.dmgAmp || 0) } });
        }
        break;
      }
      default: return false;
    }
    if (hero.isPlayer) G.events.emit('cast', { hero, ability: ab });
    return true;
  };

  // ---------------- DoT ----------------
  G.applyDot = function (source, target, dps, dur, type) {
    G.state.dots.push({ source, target, dps, type, until: G.state.time + dur, lastTick: 0 });
  };
  G.tickDots = function (dt) {
    const d = G.state.dots;
    for (let i = d.length - 1; i >= 0; i--) {
      const dot = d[i];
      if (!dot.target.alive || G.state.time >= dot.until) { d.splice(i, 1); continue; }
      if (G.state.time - dot.lastTick >= 0.5) {
        dot.lastTick = G.state.time;
        G.applyDamage(dot.source, dot.target, dot.dps * 0.5, dot.type, { silent: true });
      }
    }
  };

  // ---------------- channeling (Rico R) ----------------
  G.tickChannels = function (dt) {
    for (const h of G.state.heroes) {
      if (!h.alive || !h.channel) continue;
      const c = h.channel;
      if (G.state.time >= c.until || G.state.time < h.ccUntil) { h.channel = null; continue; }
      if (G.state.time - c.lastTick >= 0.4) {
        c.lastTick = G.state.time;
        const ab = c.ability;
        const dmg = G.abilityDamage(h, ab);
        for (const t of enemiesInRadius(h, c.x, c.z, c.radius)) {
          G.applyDamage(h, t, dmg, G.DMG.PHYSICAL, { silent: true });
        }
        G.fxFlash(c.x + G.M.rand(-c.radius, c.radius), c.z + G.M.rand(-c.radius, c.radius), 0xffd24d, 0.3);
      }
    }
  };

  // ---------------- passives ----------------
  G.tickPassives = function (dt) {
    // Doc Lumen Triage: allies near Doc regen
    for (const h of G.state.heroes) {
      if (!h.alive || !h.def || h.def.id !== 'doc') continue;
      for (const a of G.state.heroes) {
        if (a.team !== h.team || !a.alive || a.id === h.id) continue;
        if (G.M.dist(a.pos.x, a.pos.z, h.pos.x, h.pos.z) < 6) a.heal(8 * dt);
      }
    }
  };

  // ---------------- casting state (player) ----------------
  G.castState = null;
  G.beginCast = function (hero, i) {
    const ab = hero.abilities[i];
    if (!ab || ab.level <= 0) return;
    if (G.state.time < ab.cooldownUntil) { if (hero.isPlayer) G.events.emit('castFail', 'on cooldown'); return; }
    if (hero.mp < ab.def.cost) { if (hero.isPlayer) G.events.emit('castFail', 'not enough mana'); return; }
    if (ab.def.targeting === 'self') {
      G.castAbility(hero, ab, null, null);
      return;
    }
    G.castState = { hero, i, ab, mode: ab.def.targeting };
    G.events.emit('casting', { hero, ab });
  };
  G.cancelCast = function () {
    if (G.castState) { G.events.emit('casting', null); G.castState = null; }
  };
  G.resolveCast = function (point, clickedUnit) {
    if (!G.castState) return false;
    const cs = G.castState;
    const ab = cs.ab;
    const hero = cs.hero;
    let ok = false;
    if (cs.mode === 'target' || cs.mode === 'targetAlly') {
      if (clickedUnit && clickedUnit.alive) {
        if (cs.mode === 'targetAlly' && clickedUnit.team !== hero.team) ok = false;
        else ok = G.castAbility(hero, ab, clickedUnit, null);
      }
    } else if (cs.mode === 'skillshot' || cs.mode === 'aoe') {
      ok = G.castAbility(hero, ab, null, { x: point.x, z: point.z });
    }
    G.castState = null;
    G.events.emit('casting', null);
    return ok;
  };

  window.G = G;
})();
