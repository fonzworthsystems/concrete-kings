// config.js — game constants, world data, and static balance values
(function () {
  const G = window.G = window.G || {};

  // ---- teams ----
  G.TEAM_A = 0; // player  "Emerald Syndicate"
  G.TEAM_B = 1; // enemy   "Crimson Cartel"
  G.teamName = ['Emerald Syndicate', 'Crimson Cartel'];
  G.teamColor = [0x2ee6a8, 0xff4d5e];
  G.teamColorCSS = ['#2ee6a8', '#ff4d5e'];
  G.teamDark = [0x123a2c, 0x3a0d13];
  G.teamLabel = ['A', 'B'];

  // ---- world geometry (horizontal 3-lane map) ----
  G.WORLD = {
    halfW: 52,            // X extent: -52..52
    halfD: 27,            // Z extent: -27..27
    groundY: 0,
    laneZ: [-18, 0, 18],  // top, mid, bottom lanes
    baseAX: -48,          // team A base X
    baseBX: 48,           // team B base X
  };

  // ---- lane / turret layout ----
  // turrets: per lane per side at these |x| offsets (from own base outward)
  // [outerX, innerX]  (measured as distance from own base toward enemy)
  G.TURRET = {
    outerDist: 18,   // outer turret |x| = 48 - 18 = 30
    innerDist: 36,   // inner turret |x| = 48 - 36 = 12
    baseDist: 6,     // base turret near nexus
    range: 9.5,
    radius: 1.1,
    // stats
    hp: 2600,
    ad: 180,
    armor: 45,
    mr: 45,
    attackSpeed: 1.1,
    // turret damage ramps up per consecutive hit on a hero
    rampPerHit: 0.25,
  };

  G.INHIBITOR = {
    dist: 28,        // |x| = 20
    hp: 2000,
    respawn: 300,    // seconds to respawn after destroyed
    radius: 0.9,
  };

  G.NEXUS = {
    x: 48, z: 0,     // absolute |x|; sign flips per side
    hp: 3200,
    radius: 1.4,
  };

  // ---- minions ----
  G.MINION = {
    waveInterval: 30,
    count: 4,            // melee+ranged per wave
    meleeHp: 420, rangedHp: 300, superHp: 1500, siegeHp: 850,
    meleeAd: 14, rangedAd: 24, superAd: 60, siegeAd: 45,
    armor: 0, mr: 0,
    speed: 4.0,
    bounty: 18, superBounty: 45, siegeBounty: 30,
    xp: 30, superXp: 60,
    range: 2.2, rangedRange: 6.0,
  };

  // ---- neutral jungle ----
  G.JUNGLE = {
    camps: [
      // (x, z, monsterKind, count) — pockets between/around lanes
      { x: -24, z: -22.5, kind: 'wolf', count: 2 },
      { x: -24, z: 22.5, kind: 'raptor', count: 3 },
      { x: 24, z: -22.5, kind: 'raptor', count: 3 },
      { x: 24, z: 22.5, kind: 'wolf', count: 2 },
      { x: 0, z: -9, kind: 'golem', count: 2 },
      { x: 0, z: 9, kind: 'golem', count: 2 },
    ],
    monsters: {
      wolf:   { hp: 500, ad: 22, armor: 6, mr: 0, speed: 3.6, bounty: 24, xp: 45, range: 2.2, radius: 0.7 },
      raptor: { hp: 340, ad: 16, armor: 2, mr: 0, speed: 3.9, bounty: 18, xp: 32, range: 2.0, radius: 0.55 },
      golem:  { hp: 900, ad: 30, armor: 12, mr: 4, speed: 2.9, bounty: 55, xp: 85, range: 2.6, radius: 0.95 },
    },
    // epic objectives
    kingpin: { x: 0, z: -22.5, name: 'KINGPIN', hp: 5500, ad: 120, bounty: 300, xp: 220, buffName: 'Street Dominance', radius: 1.5 },
    cache:   { x: 0, z: 22.5, name: 'ARMS CACHE', hp: 3500, ad: 90, bounty: 220, xp: 180, buffName: 'Heavy Ordnance', radius: 1.3 },
  };

  // ---- bushes (concealment zones): {x, z, w, d} ----
  G.BUSHES = [
    // lane bushes (pairs along each lane)
    { x: -26, z: -18, w: 7, d: 4.5 },
    { x: 8,  z: -18, w: 7, d: 4.5 },
    { x: -26, z: 18,  w: 7, d: 4.5 },
    { x: 8,  z: 18,  w: 7, d: 4.5 },
    { x: -26, z: 0,   w: 6, d: 4.5 },
    { x: 10, z: 0,   w: 6, d: 4.5 },
    // river/jungle bushes
    { x: -10, z: -12, w: 5, d: 4 },
    { x: 12,  z: 12,  w: 5, d: 4 },
    { x: -10, z: 12,  w: 5, d: 4 },
    { x: 12,  z: -12, w: 5, d: 4 },
  ];

  // ---- minion waypoints per lane (from A base to B base) ----
  // generated at runtime but stored as function for clarity
  G.laneWaypoints = function (laneZ) {
    return [
      { x: -46, z: laneZ },
      { x: 46, z: laneZ },
    ];
  };

  // ---- hero base stats defaults (overridden per hero) ----
  G.BASE = {
    hp: 600, hpPerLevel: 92,
    mp: 320, mpPerLevel: 42,
    mpRegen: 6, mpRegenPerLevel: 0.6,
    hpRegen: 1.5, hpRegenPerLevel: 0.18,
    ad: 58, adPerLevel: 3.4,
    ap: 0,
    armor: 24, armorPerLevel: 3.2,
    mr: 30, mrPerLevel: 1.2,
    attackSpeed: 0.68, attackSpeedPerLevel: 0.022,
    moveSpeed: 5.8,
    attackRange: 2.4,
    critChance: 0, critDamage: 1.75,
    lifesteal: 0,
  };

  // ---- xp curve (level 1..18) ----
  G.xpToLevel = (function () {
    const arr = [0];
    let total = 0;
    for (let lv = 1; lv < 18; lv++) {
      total += 60 + lv * 40;
      arr.push(total);
    }
    return arr; // arr[i] = cumulative xp needed to reach level i+1
  })();

  // ---- respawn timers ----
  G.respawnTime = function (level, gameSeconds) {
    const base = 6 + level * 2.0;
    const late = Math.max(0, (gameSeconds - 600) / 1200) * 25; // scales up late game
    return Math.min(60, base + late);
  };

  // ---- gold ----
  G.GOLD = {
    passivePerSec: 1.6,
    heroKill: 300,
    assist: 150,
    turret: 150,
    turretGlobal: 50,
    inhibitor: 150,
    nexus: 1000,
  };

  window.G = G;
})();
