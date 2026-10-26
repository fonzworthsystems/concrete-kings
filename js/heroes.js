// heroes.js — the five playable heroes and their kits
(function () {
  const G = window.G;

  function H(overrides) {
    return Object.assign({}, G.BASE, overrides);
  }

  G.HEROES = [
    {
      id: 'rook',
      name: 'Rook',
      title: 'The Enforcer',
      role: 'Fighter',
      emoji: '\u{1F94A}', // boxing glove
      accent: 0xff9e3d,
      skin: 0xc9a07a,
      lore: 'A former underground prize-fighter who took a bullet for his crew and came back swinging. Rook walks into fights others run from, and the streets clear when he cracks his knuckles.',
      difficulty: 1,
      base: H({ hp: 680, hpPerLevel: 105, mp: 300, mpPerLevel: 34, mpRegen: 5.5, mpRegenPerLevel: 0.5, hpRegen: 2.4, hpRegenPerLevel: 0.28, ad: 62, adPerLevel: 3.6, armor: 32, armorPerLevel: 4.1, mr: 32, mrPerLevel: 1.5, attackSpeed: 0.66, attackSpeedPerLevel: 0.02, moveSpeed: 5.9, attackRange: 2.2 }),
      passive: { name: 'Tough Knuckles', desc: 'Rook\u2019s basic attacks deal bonus damage equal to 4% of his bonus health.' },
      abilities: [
        { key: 'Q', name: 'Haymaker', emoji: '\u{1F44A}', targeting: 'target', kind: 'dashStrike', desc: 'Dash to an enemy and deliver a haymaker, dealing physical damage and slowing them.', cooldown: 8, cost: 55, range: 7, base: [60, 100, 140, 180, 220], adRatio: 0.9, slow: 0.35, slowDur: 1.5, dash: true },
        { key: 'W', name: 'Street Guard', emoji: '\u{1F6E1}', targeting: 'self', kind: 'selfShield', desc: 'Brace yourself, gaining a shield and reducing incoming damage for a short time.', cooldown: 12, cost: 60, shield: [80, 130, 180, 230, 280], apRatio: 0.6, dr: 0.25, dur: 3 },
        { key: 'E', name: 'Ground Slam', emoji: '\u{1F4A5}', targeting: 'self', kind: 'aoeSelf', desc: 'Slam the ground, dealing area damage and slowing nearby enemies.', cooldown: 9, cost: 65, radius: 4, base: [70, 115, 160, 205, 250], adRatio: 0.8, slow: 0.4, slowDur: 2 },
        { key: 'R', name: 'Wrecking Ball', emoji: '\u{1F4A3}', targeting: 'aoe', kind: 'leapAoe', desc: 'Leap to a target location, crashing down for massive area damage and a brief stun.', cooldown: 90, cost: 100, range: 9, radius: 4.5, base: [200, 320, 440], adRatio: 1.3, stun: 1.0 },
      ],
    },
    {
      id: 'vesper',
      name: 'Vesper',
      title: 'The Shadow',
      role: 'Assassin',
      emoji: '\u{1F5E1}', // dagger
      accent: 0xb44dff,
      skin: 0xe0b48a,
      lore: 'Nobody knows Vesper\u2019s real name — only that she drives like a ghost and strikes before you see her. The last thing most marks ever feel is the cold edge of her knife.',
      difficulty: 3,
      base: H({ hp: 580, hpPerLevel: 88, mp: 280, mpPerLevel: 30, mpRegen: 5, mpRegenPerLevel: 0.45, hpRegen: 1.6, hpRegenPerLevel: 0.2, ad: 60, adPerLevel: 3.8, armor: 25, armorPerLevel: 3.0, mr: 30, mrPerLevel: 1.2, attackSpeed: 0.72, attackSpeedPerLevel: 0.026, moveSpeed: 6.0, attackRange: 2.2 }),
      passive: { name: 'Backstab', desc: 'Attacks and abilities against enemies facing away from Vesper deal 15% bonus damage.' },
      abilities: [
        { key: 'Q', name: 'Lunge', emoji: '\u{27A1}', targeting: 'target', kind: 'dashTarget', desc: 'Lunge to an enemy, dealing physical damage.', cooldown: 7, cost: 50, range: 7, base: [70, 110, 150, 190, 230], adRatio: 1.0 },
        { key: 'W', name: 'Smoke Screen', emoji: '\u{1F32B}', targeting: 'self', kind: 'stealthBuff', desc: 'Vanish into smoke: gain stealth, movement speed, and empowered next attack.', cooldown: 14, cost: 60, dur: 2.5, speed: 0.4, bonusDmg: [30, 60, 90, 120, 150], adRatio: 0.5 },
        { key: 'E', name: 'Shiv Toss', emoji: '\u{1F4CC}', targeting: 'skillshot', kind: 'skillshot', desc: 'Throw a shiv in a line, damaging the first enemy hit and applying a bleed.', cooldown: 8, cost: 55, range: 9, speed: 30, radius: 0.6, base: [60, 100, 140, 180, 220], adRatio: 0.8, bleed: [20, 35, 50, 65, 80], bleedDur: 3 },
        { key: 'R', name: 'Assassinate', emoji: '\u{2620}', targeting: 'target', kind: 'execute', desc: 'Strike a killing blow for huge damage. Kills reset the cooldown.', cooldown: 60, cost: 90, range: 6, base: [250, 375, 500], adRatio: 1.6, executeBelow: 0.35 },
      ],
    },
    {
      id: 'volt',
      name: 'Volt',
      title: 'The Hacker',
      role: 'Mage',
      emoji: '\u{26A1}', // lightning
      accent: 0x37c8ff,
      skin: 0xd9c6a5,
      lore: 'A disgraced systems engineer who turned the city\u2019s own grid into a weapon. Volt doesn\u2019t break doors — he overrides them, then melts whoever is standing behind.',
      difficulty: 2,
      base: H({ hp: 540, hpPerLevel: 80, mp: 380, mpPerLevel: 52, mpRegen: 7, mpRegenPerLevel: 0.7, hpRegen: 1.3, hpRegenPerLevel: 0.16, ad: 52, adPerLevel: 2.8, ap: 0, armor: 20, armorPerLevel: 2.6, mr: 30, mrPerLevel: 1.2, attackSpeed: 0.65, attackSpeedPerLevel: 0.016, moveSpeed: 5.7, attackRange: 3.4 }),
      passive: { name: 'Overcharge', desc: 'Volt\u2019s abilities mark enemies. His next ability against a marked target deals 20% bonus damage.' },
      abilities: [
        { key: 'Q', name: 'Arc Bolt', emoji: '\u{1F329}', targeting: 'skillshot', kind: 'skillshot', desc: 'Fire a bolt of lightning in a line, dealing magic damage to the first enemy hit.', cooldown: 5, cost: 55, range: 11, speed: 34, radius: 0.55, base: [80, 125, 170, 215, 260], apRatio: 0.75 },
        { key: 'W', name: 'EMP Field', emoji: '\u{1F4F6}', targeting: 'aoe', kind: 'aoeZone', desc: 'Create an electromagnetic field that damages and slows enemies inside it.', cooldown: 10, cost: 75, range: 10, radius: 3.5, dur: 4, base: [40, 70, 100, 130, 160], apRatio: 0.35, slow: 0.3, tick: 0.5 },
        { key: 'E', name: 'Blink', emoji: '\u{1F4A8}', targeting: 'aoe', kind: 'blink', desc: 'Short-range teleport to a target location.', cooldown: 12, cost: 50, range: 8 },
        { key: 'R', name: 'Overload', emoji: '\u{1F30A}', targeting: 'aoe', kind: 'aoeNuke', desc: 'Unleash a catastrophic overload, dealing heavy magic damage in an area.', cooldown: 80, cost: 110, range: 11, radius: 4.5, base: [220, 350, 480], apRatio: 1.1 },
      ],
    },
    {
      id: 'rico',
      name: 'Rico',
      title: 'The Gunner',
      role: 'Marksman',
      emoji: '\u{1F52B}', // pistol
      accent: 0xffd24d,
      skin: 0xb98a5e,
      lore: 'A wheelman\u2019s wheelman — calm hands, perfect aim, and a sidearm that has ended more chases than the cops ever did. Rico counts shots the way others count money.',
      difficulty: 2,
      base: H({ hp: 560, hpPerLevel: 86, mp: 320, mpPerLevel: 36, mpRegen: 6, mpRegenPerLevel: 0.5, hpRegen: 1.4, hpRegenPerLevel: 0.17, ad: 64, adPerLevel: 3.9, armor: 23, armorPerLevel: 3.0, mr: 28, mrPerLevel: 1.1, attackSpeed: 0.72, attackSpeedPerLevel: 0.03, moveSpeed: 5.9, attackRange: 5.2 }),
      passive: { name: 'Headshot', desc: 'Every 4th basic attack is a guaranteed critical hit.' },
      abilities: [
        { key: 'Q', name: 'Piercing Round', emoji: '\u{1F3EF}', targeting: 'skillshot', kind: 'skillshot', desc: 'Fire a piercing round that damages all enemies in a line.', cooldown: 7, cost: 50, range: 11, speed: 40, radius: 0.5, pierce: true, base: [60, 100, 140, 180, 220], adRatio: 1.0 },
        { key: 'W', name: 'Suppressing Fire', emoji: '\u{1F525}', targeting: 'self', kind: 'attackSpeedBuff', desc: 'Greatly increase attack speed for a short duration.', cooldown: 12, cost: 55, dur: 5, bonusAS: [0.3, 0.4, 0.5, 0.6, 0.7] },
        { key: 'E', name: 'Grapple', emoji: '\u{1FAA8}', targeting: 'self', kind: 'dashAway', desc: 'Dash backward, slowing nearby enemies.', cooldown: 13, cost: 60, range: 6, slow: 0.3, slowDur: 1.5 },
        { key: 'R', name: 'Barrage', emoji: '\u{1F4A5}', targeting: 'aoe', kind: 'channelBarrage', desc: 'Channel a hail of gunfire, dealing repeated physical damage in an area.', cooldown: 90, cost: 100, range: 10, radius: 3.5, dur: 3, base: [90, 140, 190], adRatio: 0.7, tick: 0.4 },
      ],
    },
    {
      id: 'doc',
      name: 'Doc Lumen',
      title: 'The Fixer',
      role: 'Support',
      emoji: '\u{2695}', // medical
      accent: 0x5cff8a,
      skin: 0xd9b08a,
      lore: 'The crew\u2019s back-alley surgeon and the reason half of them are still breathing. Doc patches people up mid-firefight and makes sure nobody ever fights alone.',
      difficulty: 2,
      base: H({ hp: 600, hpPerLevel: 92, mp: 400, mpPerLevel: 50, mpRegen: 8, mpRegenPerLevel: 0.75, hpRegen: 2.0, hpRegenPerLevel: 0.24, ad: 50, adPerLevel: 2.6, ap: 0, armor: 26, armorPerLevel: 3.4, mr: 32, mrPerLevel: 1.3, attackSpeed: 0.66, attackSpeedPerLevel: 0.018, moveSpeed: 5.8, attackRange: 3.0 }),
      passive: { name: 'Triage', desc: 'Allies near Doc regenerate health.' },
      abilities: [
        { key: 'Q', name: 'Heal Dart', emoji: '\u{1F489}', targeting: 'targetAlly', kind: 'healTarget', desc: 'Fire a dart that heals an ally or damages an enemy.', cooldown: 6, cost: 60, range: 9, heal: [80, 120, 160, 200, 240], apRatio: 0.55, dmg: [40, 60, 80, 100, 120] },
        { key: 'W', name: 'Stim Shield', emoji: '\u{1F6E1}', targeting: 'targetAlly', kind: 'shieldAlly', desc: 'Grant an ally a shield and bonus movement speed.', cooldown: 10, cost: 70, range: 9, shield: [90, 140, 190, 240, 290], apRatio: 0.7, speed: 0.25, dur: 3 },
        { key: 'E', name: 'Sedative', emoji: '\u{1F4A4}', targeting: 'skillshot', kind: 'skillshotCC', desc: 'Fire a sedative dart that stuns the first enemy hit.', cooldown: 11, cost: 65, range: 9, speed: 28, radius: 0.5, stun: [1.0, 1.15, 1.3, 1.45, 1.6], base: [50, 80, 110, 140, 170], apRatio: 0.5 },
        { key: 'R', name: 'Overdrive Field', emoji: '\u{2764}', targeting: 'aoe', kind: 'aoeHealZone', desc: 'Create a field that heals allies and amplifies their damage.', cooldown: 90, cost: 120, range: 9, radius: 4.5, dur: 5, heal: [60, 100, 140], apRatio: 0.3, dmgAmp: 0.15, tick: 0.5 },
      ],
    },
  ];

  G.HERO_BY_ID = {};
  G.HEROES.forEach((h) => { G.HERO_BY_ID[h.id] = h; });

  window.G = G;
})();
