// main.js — bootstrap, match flow, input, game loop
(function () {
  const G = window.G;
  const A = G.TEAM_A, B = G.TEAM_B;

  function boot() {
    G.rend.init(document.getElementById('gl'));
    G.rend.scene();
    G.cam.init();
    G.cam.yaw = -0.55;
    G.cam.pitch = 0.9;
    G.cam.distance = 28;
    G.input.init(document.getElementById('gl'));
    G.audio.init();
    G.ui.init();
    G.ui.renderHeroSelect();
    G.ui.showMenu();
    G.state.phase = 'menu';
    wireEvents();
    wireInput();
    G.loop.start(update, render);
  }

  // ---------------- events ----------------
  function wireEvents() {
    G.events.on('lockHero', (id) => G.startMatch(id));
    G.events.on('playAgain', () => location.reload());
    G.events.on('abilityClick', (i) => {
      const p = G.player;
      if (!p || !p.alive || G.state.phase !== 'match') return;
      G.beginCast(p, i);
    });
    G.events.on('sellItem', (i) => { if (G.player) G.sellItem(G.player, i); });
    G.events.on('nexusDestroyed', (e) => {
      if (G.matchEnded) return;
      G.matchEnded = true;
      const victory = e.nexus.team === B;
      G.state.phase = 'end';
      G.ui.showEnd(victory, G.player);
      if (victory) G.audio.victory(); else G.audio.defeat();
      G.announce(victory ? 'VICTORY — the district is yours!' : 'DEFEAT — the district falls.', G.teamColorCSS[victory ? A : B]);
    });
    G.events.on('heroDeath', (e) => {
      if (e.killer && e.killer.isHero && e.killer.isHero()) {
        G.announce(e.killer.name + ' eliminated ' + e.hero.name, G.teamColorCSS[e.killer.team]);
      }
    });
  }

  function wireInput() {
    G.input.onKeyDown = (code, key) => {
      const p = G.player;
      G.audio.resume();
      if (!p || G.state.phase !== 'match') return;
      const ctrl = G.input.keys['ControlLeft'] || G.input.keys['ControlRight'];
      if (code === 'KeyQ' || key === 'q') { ctrl ? G.levelUpAbility(p, 0) : G.beginCast(p, 0); }
      else if (code === 'KeyW' || key === 'w') { ctrl ? G.levelUpAbility(p, 1) : G.beginCast(p, 1); }
      else if (code === 'KeyE' || key === 'e') { ctrl ? G.levelUpAbility(p, 2) : G.beginCast(p, 2); }
      else if (code === 'KeyR' || key === 'r') { ctrl ? G.levelUpAbility(p, 3) : G.beginCast(p, 3); }
      else if (code === 'KeyS' || key === 's') { p.stopAttack(); p.destination = null; p.path = null; }
      else if (code === 'KeyB' || key === 'b') { startRecall(p); }
      else if (code === 'KeyT' || key === 't') { if (p.alive) G.placeWard(p, G.input.mouse.wx, G.input.mouse.wz); }
      else if (code === 'KeyP' || key === 'p') { G.ui.shopOpen ? G.ui.closeShop() : G.ui.openShop(); }
      else if (code === 'Space') { G.cam.snap(p); }
      else if (code === 'Escape') { G.cancelCast(); }
    };
    G.input.onMouseDown = (e) => {
      G.audio.resume();
      const p = G.player;
      if (!p || G.state.phase !== 'match') return;
      const pt = { x: G.input.mouse.wx, z: G.input.mouse.wz };
      if (e.button === 2) {
        if (G.castState) { G.cancelCast(); return; }
        if (!p.alive) return;
        const u = unitAtPoint(pt.x, pt.z);
        if (u && u.team !== p.team && u.alive) {
          p.startAttack(u, true);
          if (!p.inRange(u)) p.setPath(G.nav.findPath(p.pos.x, p.pos.z, u.pos.x, u.pos.z) || [{ x: u.pos.x, z: u.pos.z }], true);
        } else {
          p.stopAttack();
          p.setPath(G.nav.findPath(p.pos.x, p.pos.z, pt.x, pt.z) || [{ x: pt.x, z: pt.z }], false);
        }
      } else if (e.button === 0) {
        if (G.castState) {
          const u = unitAtPoint(pt.x, pt.z);
          G.resolveCast(pt, u);
        }
      }
    };
  }

  function unitAtPoint(x, z) {
    let best = null, bestD = 6.8;
    for (const u of G.state.units()) {
      if (!u.alive) continue;
      const d = G.M.dist2(x, z, u.pos.x, u.pos.z);
      const hitR = (u.radius + 1.4) * (u.radius + 1.4);
      if (d < bestD && d < hitR) { bestD = d; best = u; }
    }
    return best;
  }

  function startRecall(p) {
    if (!p.alive || p.recalling) return;
    p.recalling = true;
    p.recallUntil = G.state.time + 6;
    p.stopAttack();
    p.destination = null; p.path = null;
    G.audio.recall();
  }

  // ---------------- match setup ----------------
  G.startMatch = function (heroId) {
    G.resetState();
    G.map.build();
    G.nav.init();
    G.vision.init();
    G.rend.initFogOverlay();
    spawnStructures();
    spawnMonsters();

    const allIds = G.HEROES.map((h) => h.id);
    G.player = G.spawnHero(G.HERO_BY_ID[heroId], A, { isPlayer: true });
    for (const id of allIds) if (id !== heroId) G.spawnHero(G.HERO_BY_ID[id], A, {});
    for (const id of allIds) G.spawnHero(G.HERO_BY_ID[id], B, {});

    G.ai.init();
    G.ui.player = G.player;
    G.ui.hideMenu();
    G.ui.hideEnd();
    if (G.ui.shopOpen) G.ui.closeShop();
    G.state.phase = 'match';
    G.matchEnded = false;
    G.score = { [A]: 0, [B]: 0 };
    G.waveTimer = G.MINION.waveInterval;
    G.cam.snap(G.player);
    G.announce('Battle begins — take the streets!', '#2ee6a8');
    spawnWaves();
  };

  G.resetState = function () {
    const s = G.state;
    s.heroes = []; s.minions = []; s.monsters = []; s.turrets = [];
    s.inhibitors = []; s.nexuses = []; s.projectiles = [];
    s.effects = []; s.wards = []; s.announcements = [];
    s.zones = []; s.dots = [];
    s.time = 0;
  };

  function spawnStructures() {
    for (const t of G.map.turretPos) {
      G.state.turrets.push(new G.Turret({ team: t.team, x: t.x, z: t.z, tier: t.tier, lane: t.lane }));
    }
    for (const i of G.map.inhibitorPos) {
      G.state.inhibitors.push(new G.Inhibitor({ team: i.team, x: i.x, z: i.z, lane: i.lane }));
    }
    for (const n of G.map.nexusPos) {
      G.state.nexuses.push(new G.Nexus({ team: n.team, x: n.x, z: n.z }));
    }
  }
  function spawnMonsters() {
    for (const c of G.JUNGLE.camps) G.spawnMonsterCamp(c);
    G.spawnEpic(G.JUNGLE.kingpin, 'kingpin');
    G.spawnEpic(G.JUNGLE.cache, 'cache');
  }
  function spawnWaves() {
    for (let lane = 0; lane < 3; lane++) {
      for (const team of [A, B]) {
        for (let i = 0; i < 3; i++) G.spawnMinion(team, lane, 'melee');
        for (let i = 0; i < 2; i++) G.spawnMinion(team, lane, 'ranged');
        const enemy = team === A ? B : A;
        const inh = G.state.inhibitors.find((x) => x.team === enemy && x.lane === lane);
        if (inh && inh.destroyed) G.spawnMinion(team, lane, 'super');
      }
    }
  }

  function nearestEnemyInRange(u, range) {
    let best = null, bestD = range * range;
    for (const e of G.state.units()) {
      if (e.team === u.team || !e.alive) continue;
      const d = G.M.dist2(u.pos.x, u.pos.z, e.pos.x, e.pos.z);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  // ---------------- update ----------------
  function update(dt) {
    G.state.time += dt;
    if (G.state.phase === 'match') updateMatch(dt);
    G.ui.update(dt);
  }

  function updateMatch(dt) {
    const p = G.player;

    G.waveTimer -= dt;
    if (G.waveTimer <= 0) { G.waveTimer = G.MINION.waveInterval; spawnWaves(); }

    G.tickIncome(dt);

    for (const h of G.state.heroes) if (h.skillPoints > 0) G.autoLevel(h);

    // player QoL: auto-attack when idle
    if (p && p.alive && !p.attackTarget && !p.destination) {
      const e = nearestEnemyInRange(p, p.stats.attackRange + 1.5);
      if (e) p.startAttack(e, false);
    }

    // player recall
    if (p && p.recalling && G.state.time >= p.recallUntil) {
      p.recalling = false;
      p.pos.set(-G.NEXUS.x, 0, 0);
      p.mesh.position.copy(p.pos);
      p.hp = p.maxHp; p.mp = p.maxMp;
      G.audio.recall();
    }

    // bots decide
    for (const h of G.state.heroes) if (h.alive && !h.isPlayer) G.ai.update(h, dt);
    // everyone acts
    for (const h of G.state.heroes) {
      if (h.alive) h.update(dt);
      else if (h.respawnAt && G.state.time >= h.respawnAt) respawn(h);
    }
    for (const m of G.state.minions) if (m.alive) m.update(dt);
    for (const t of G.state.turrets) t.update(dt);
    for (const i of G.state.inhibitors) i.update(dt);
    for (const n of G.state.nexuses) n.update(dt);
    for (const m of G.state.monsters) m.update(dt);

    // projectiles
    for (let i = G.state.projectiles.length - 1; i >= 0; i--) {
      const pr = G.state.projectiles[i];
      pr.update(dt);
      if (pr.dead) G.state.projectiles.splice(i, 1);
    }
    updateEffects(dt);
    for (let i = G.state.zones.length - 1; i >= 0; i--) {
      if (!G.state.zones[i].update(dt)) G.state.zones.splice(i, 1);
    }
    G.tickDots(dt);
    G.tickChannels(dt);
    G.tickBuffs(dt);
    G.tickPassives(dt);
    G.updateWards();
    updateStructureInvuln();
    G.vision.update(dt);

    G.score = { [A]: 0, [B]: 0 };
    for (const h of G.state.heroes) G.score[h.team] += h.kills;

    if (p) G.cam.update(dt, p);
  }

  function respawn(h) {
    h.alive = true; h.dead = false;
    h.hp = h.maxHp; h.mp = h.maxMp;
    const nx = h.team === A ? -G.NEXUS.x : G.NEXUS.x;
    h.pos.set(nx, 0, G.M.rand(-5, 5));
    h.mesh.position.copy(h.pos);
    h.mesh.visible = true;
    h.hbDirty = true;
    h.respawnAt = 0;
    G.fxFlash(nx, 0, G.teamColor[h.team], 1.5);
  }

  function updateStructureInvuln() {
    for (const t of G.state.turrets) {
      if (!t.alive) continue;
      let vuln = false;
      for (const m of G.state.minions) {
        if (m.team === t.team || !m.alive) continue;
        if (G.M.dist(m.pos.x, m.pos.z, t.pos.x, t.pos.z) < G.TURRET.range + 2) { vuln = true; break; }
      }
      t.invulnUntil = vuln ? 0 : Infinity;
    }
    for (const n of G.state.nexuses) {
      const baseTurrets = G.state.turrets.filter((t) => t.team === n.team && t.tier === 'base');
      const anyAlive = baseTurrets.some((t) => t.alive);
      n.invulnUntil = anyAlive ? Infinity : 0;
    }
  }

  function updateEffects(dt) {
    const arr = G.state.effects;
    for (let i = arr.length - 1; i >= 0; i--) {
      const e = arr[i];
      const mesh = e.mesh || e;
      const born = (e.born !== undefined) ? e.born : (mesh.userData ? mesh.userData.born : G.state.time);
      const life = (e.life !== undefined) ? e.life : (mesh.userData ? mesh.userData.life : 1);
      const age = G.state.time - born;
      if (age >= life) { G.scene.remove(mesh); arr.splice(i, 1); continue; }
      if (e.update) e.update(mesh, dt);
      else if (mesh.userData && mesh.userData.vy !== undefined) {
        mesh.position.y += mesh.userData.vy * dt;
        if (mesh.material) mesh.material.opacity = Math.max(0, 1 - age / life);
      }
    }
  }

  // ---------------- render ----------------
  function render() {
    if (G.state.phase === 'menu') {
      G.camera.position.set(0, 46, 62);
      G.camera.lookAt(0, 0, 0);
    } else {
      updateVisibility();
    }
    G.renderer.render(G.scene, G.camera);
  }

  function updateVisibility() {
    for (const u of G.state.units()) {
      if (u.team !== A) {
        const vis = G.vision.enemyVisible(u, A) && u.alive;
        u.mesh.visible = vis;
        u.healthBar.sprite.visible = vis && (u.hp / u.maxHp < 0.999);
      }
    }
  }

  window.addEventListener('load', boot);
  window.G = G;
})();
