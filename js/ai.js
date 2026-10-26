// ai.js — bot brain: lanes, farming, combat, retreat, shop, objectives
(function () {
  const G = window.G;

  const BUILDS = {
    Fighter: ['brass', 'streetiron', 'riot', 'heavyord', 'bulwark', 'trauma'],
    Assassin: ['brass', 'vampsiphon', 'streetiron', 'reaper', 'heavyord', 'momentum'],
    Mage: ['arc', 'voltage', 'overclock', 'chrono', 'hazmat', 'sneakers'],
    Marksman: ['critshot', 'brass', 'heavyord', 'reaper', 'adrenaline', 'momentum'],
    Support: ['kevlar', 'jammer', 'arc', 'chrono', 'hazmat', 'riot'],
  };
  const LANE = { Fighter: 0, Mage: 1, Assassin: 1, Marksman: 2, Support: 2 };

  G.ai = {
    init() {
      for (const h of G.state.heroes) {
        if (h.isPlayer) continue;
        h.ai = { lane: LANE[h.def.role] || 1, build: BUILDS[h.def.role] || BUILDS.Fighter, buildIdx: 0, roamer: h.def.role === 'Assassin', objTimer: G.M.rand(60, 120), engageTimer: 0 };
        h.skillPoints = 1;
        G.autoLevel(h);
      }
    },

    update(bot, dt) {
      if (!bot.alive) return;
      const a = bot.ai;
      if (!a) return;

      if (bot.skillPoints > 0) G.autoLevel(bot);

      // ---- recall channel ----
      if (bot.recalling) {
        if (G.state.time >= bot.recallUntil) {
          this.completeRecall(bot);
        }
        return;
      }

      // ---- fountain / shop ----
      if (this.nearBase(bot, 8)) {
        bot.heal(bot.maxHp * 0.25 * dt * 4);
        bot.mp = Math.min(bot.maxMp, bot.mp + bot.maxMp * 0.3 * dt);
        this.tryShop(bot);
      }

      const threat = this.nearestEnemyHero(bot, 10);
      const hpPct = bot.hp / bot.maxHp;
      const underTurret = this.underEnemyTurret(bot);

      // ---- emergency: recall or retreat ----
      if (threat && hpPct < 0.22 && !underTurret) { this.startRecall(bot); return; }
      if (threat && hpPct < 0.35) { this.retreat(bot); return; }

      // ---- combat / farm / push ----
      let target = threat;
      if (!target || G.M.dist(bot.pos.x, bot.pos.z, target.pos.x, target.pos.z) > 9) {
        target = this.nearestEnemyMinion(bot, 6.5);
      }

      if (target) {
        this.fight(bot, target);
        return;
      }

      // objective grouping late game
      if (G.state.time > 480 && G.state.time > a.objTimer + 45) {
        a.objTimer = G.state.time;
        if (this.goObjective(bot)) return;
      }

      if (a.roamer) this.roam(bot);
      else this.pushLane(bot);
    },

    nearestEnemyHero(bot, maxDist) {
      let best = null, bestD = maxDist * maxDist;
      for (const h of G.state.heroes) {
        if (h.team === bot.team || !h.alive) continue;
        if (!G.vision.enemyVisible(h, bot.team)) continue;
        const d = G.M.dist2(bot.pos.x, bot.pos.z, h.pos.x, h.pos.z);
        if (d < bestD) { bestD = d; best = h; }
      }
      return best;
    },
    nearestEnemyMinion(bot, maxDist) {
      let best = null, bestD = maxDist * maxDist;
      for (const m of G.state.minions) {
        if (m.team === bot.team || !m.alive) continue;
        const d = G.M.dist2(bot.pos.x, bot.pos.z, m.pos.x, m.pos.z);
        if (d < bestD) { bestD = d; best = m; }
      }
      return best;
    },
    nearestAllyHero(bot, maxDist) {
      let best = null, bestD = maxDist * maxDist;
      for (const h of G.state.heroes) {
        if (h.team !== bot.team || !h.alive || h.id === bot.id) continue;
        const d = G.M.dist2(bot.pos.x, bot.pos.z, h.pos.x, h.pos.z);
        if (d < bestD) { bestD = d; best = h; }
      }
      return best;
    },
    nearBase(bot, d) {
      const nx = bot.team === G.TEAM_A ? -G.NEXUS.x : G.NEXUS.x;
      return G.M.dist(bot.pos.x, bot.pos.z, nx, 0) < d;
    },
    underEnemyTurret(bot) {
      for (const t of G.state.turrets) {
        if (t.team === bot.team || !t.alive) continue;
        if (G.M.dist(bot.pos.x, bot.pos.z, t.pos.x, t.pos.z) < G.TURRET.range + 1) return true;
      }
      return false;
    },

    fight(bot, target) {
      // support heroes heal/shield allies instead of pure aggression
      if (bot.def.role === 'Support') {
        const ally = this.lowestAlly(bot, 9);
        if (ally) {
          this.castSupport(bot, ally);
          if (G.M.dist(bot.pos.x, bot.pos.z, ally.pos.x, ally.pos.z) > 6) bot.setDestination(ally.pos.x, ally.pos.z, false);
          else bot.setDestination(target.pos.x, target.pos.z, false);
          return;
        }
      }
      bot.startAttack(target, true);
      // move into range if needed
      if (!bot.inRange(target)) bot.setDestination(target.pos.x, target.pos.z, true);
      this.castOffensive(bot, target);
    },

    lowestAlly(bot, maxDist) {
      let best = null, bestPct = 1;
      for (const h of G.state.heroes) {
        if (h.team !== bot.team || !h.alive) continue;
        const d = G.M.dist(bot.pos.x, bot.pos.z, h.pos.x, h.pos.z);
        if (d > maxDist) continue;
        const pct = h.hp / h.maxHp;
        if (pct < bestPct) { bestPct = pct; best = h; }
      }
      return best;
    },

    castSupport(bot, ally) {
      const ab = bot.abilities;
      // Q heal / W shield on low ally
      for (const i of [0, 1]) {
        const a = ab[i];
        if (!a || a.level <= 0 || G.state.time < a.cooldownUntil || bot.mp < a.def.cost) continue;
        if (a.def.targeting === 'targetAlly') {
          if (G.M.dist(bot.pos.x, bot.pos.z, ally.pos.x, ally.pos.z) < a.def.range) {
            G.castAbility(bot, a, ally, null);
          }
        }
      }
      // R heal zone on ally cluster
      const r = ab[3];
      if (r && r.level > 0 && G.state.time >= r.cooldownUntil && bot.mp >= r.def.cost && ally.hp / ally.maxHp < 0.6) {
        G.castAbility(bot, r, null, { x: ally.pos.x, z: ally.pos.z });
      }
    },

    castOffensive(bot, target) {
      const ab = bot.abilities;
      // W self-buff when fighting
      const w = ab[1];
      if (w && w.level > 0 && G.state.time >= w.cooldownUntil && bot.mp >= w.def.cost && w.def.targeting === 'self') {
        G.castAbility(bot, w, null, null);
      }
      // offensive abilities Q/E/R
      for (const i of [0, 2, 3]) {
        const a = ab[i];
        if (!a || a.level <= 0 || G.state.time < a.cooldownUntil || bot.mp < a.def.cost) continue;
        const tgt = a.def.targeting;
        const d = G.M.dist(bot.pos.x, bot.pos.z, target.pos.x, target.pos.z);
        if (tgt === 'target' || tgt === 'targetAlly') {
          if (d < a.def.range) G.castAbility(bot, a, target, null);
        } else if (tgt === 'skillshot' || tgt === 'aoe') {
          if (d < a.def.range) G.castAbility(bot, a, null, { x: target.pos.x, z: target.pos.z });
        }
      }
    },

    pushLane(bot) {
      const lane = bot.ai.lane;
      let wps = G.map.lanePolylines[lane];
      if (bot.team === G.TEAM_B) wps = wps.slice().reverse();
      // advance to next waypoint beyond current progress
      let next = wps[wps.length - 1];
      for (const wp of wps) {
        if (bot.team === G.TEAM_A ? wp.x > bot.pos.x + 1 : wp.x < bot.pos.x - 1) { next = wp; break; }
      }
      bot.setDestination(next.x, next.z, false);
      // auto-acquire minions passed along the way
      const near = this.nearestEnemyMinion(bot, bot.stats.attackRange + 2);
      if (near) bot.startAttack(near, false);
    },

    roam(bot) {
      // jungler: farm nearby camp, else gank, else push mid
      const monster = this.nearestMonster(bot, 14);
      if (monster) {
        if (G.M.dist(bot.pos.x, bot.pos.z, monster.pos.x, monster.pos.z) > 2.5) {
          bot.setPath(G.nav.findPath(bot.pos.x, bot.pos.z, monster.pos.x, monster.pos.z), false);
        }
        bot.startAttack(monster, true);
        return;
      }
      const threat = this.nearestEnemyHero(bot, 14);
      if (threat && threat.hp / threat.maxHp < 0.6) {
        if (G.M.dist(bot.pos.x, bot.pos.z, threat.pos.x, threat.pos.z) > 2.5) {
          bot.setPath(G.nav.findPath(bot.pos.x, bot.pos.z, threat.pos.x, threat.pos.z), false);
        }
        bot.startAttack(threat, true);
        this.castOffensive(bot, threat);
        return;
      }
      this.pushLane(bot);
    },

    nearestMonster(bot, maxDist) {
      let best = null, bestD = maxDist * maxDist;
      for (const m of G.state.monsters) {
        if (!m.alive) continue;
        const d = G.M.dist2(bot.pos.x, bot.pos.z, m.pos.x, m.pos.z);
        if (d < bestD) { bestD = d; best = m; }
      }
      return best;
    },

    retreat(bot) {
      const nx = bot.team === G.TEAM_A ? -G.NEXUS.x : G.NEXUS.x;
      bot.stopAttack();
      bot.setPath(G.nav.findPath(bot.pos.x, bot.pos.z, nx, bot.pos.z), false);
    },

    startRecall(bot) {
      bot.recalling = true;
      bot.recallUntil = G.state.time + 6;
      bot.stopAttack();
      bot.destination = null;
    },
    completeRecall(bot) {
      bot.recalling = false;
      const nx = bot.team === G.TEAM_A ? -G.NEXUS.x : G.NEXUS.x;
      bot.pos.set(nx, 0, 0);
      bot.mesh.position.copy(bot.pos);
      bot.hp = bot.maxHp;
      bot.mp = bot.maxMp;
      this.tryShop(bot);
      G.fxFlash(nx, 0, G.teamColor[bot.team], 1.2);
    },

    tryShop(bot) {
      const a = bot.ai;
      const build = a.build;
      let guard = 0;
      while (guard++ < 6 && a.buildIdx < build.length) {
        const id = build[a.buildIdx];
        const item = G.ITEM_BY_ID[id];
        if (bot.gold >= item.cost) { G.buyItem(bot, id); a.buildIdx++; }
        else break;
      }
    },

    goObjective(bot) {
      const aliveAllies = G.state.heroes.filter(h => h.team === bot.team && h.alive).length;
      if (aliveAllies < 3) return false;
      const target = G.state.time % 2 === 0 ? G.JUNGLE.kingpin : G.JUNGLE.cache;
      const mx = G.state.monsters.find(m => m.alive && Math.abs(m.pos.x - target.x) < 2 && Math.abs(m.pos.z - target.z) < 2);
      if (!mx) return false;
      const d = G.M.dist(bot.pos.x, bot.pos.z, mx.pos.x, mx.pos.z);
      if (d > 4) {
        if (G.M.dist(bot.pos.x, bot.pos.z, mx.pos.x, mx.pos.z) > 2.5) bot.setPath(G.nav.findPath(bot.pos.x, bot.pos.z, mx.pos.x, mx.pos.z), false);
      }
      bot.startAttack(mx, true);
      this.castOffensive(bot, mx);
      return true;
    },
  };

  window.G = G;
})();
