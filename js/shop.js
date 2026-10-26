// shop.js — item definitions, buying/selling, inventory
(function () {
  const G = window.G;

  G.ITEMS = [
    { id: 'brass', name: 'Brass Knuckles', emoji: '\u{1F44A}', cat: 'Offense', cost: 450, stats: { ad: 12 }, desc: '+12 Attack Damage' },
    { id: 'streetiron', name: 'Street Iron', emoji: '\u{1F529}', cat: 'Offense', cost: 1300, stats: { ad: 35 }, desc: '+35 Attack Damage' },
    { id: 'heavyord', name: 'Heavy Ordnance', emoji: '\u{1F4A3}', cat: 'Offense', cost: 3200, stats: { ad: 65, crit: 0.2 }, desc: '+65 AD, +20% Crit' },
    { id: 'talon', name: 'Talon Edge', emoji: '\u{1F5E1}', cat: 'Offense', cost: 3100, stats: { ad: 50, lifesteal: 0.15 }, desc: '+50 AD, +15% Lifesteal' },
    { id: 'reaper', name: 'Reaper Scythe', emoji: '\u{2694}', cat: 'Offense', cost: 2800, stats: { ad: 55, crit: 0.25, lifesteal: 0.15 }, desc: '+55 AD, +25% Crit, +15% Lifesteal' },
    { id: 'arc', name: 'Arc Reactor', emoji: '\u{26A1}', cat: 'Offense', cost: 1200, stats: { ap: 40 }, desc: '+40 Ability Power' },
    { id: 'overclock', name: 'Overclocked Core', emoji: '\u{1F525}', cat: 'Offense', cost: 3000, stats: { ap: 80 }, desc: '+80 Ability Power' },
    { id: 'voltage', name: 'Voltage Cell', emoji: '\u{1F50B}', cat: 'Offense', cost: 850, stats: { ap: 25, cdr: 0.1 }, desc: '+25 AP, +10% Cooldown Reduction' },
    { id: 'critshot', name: 'Critical Shot', emoji: '\u{1F3AF}', cat: 'Offense', cost: 1000, stats: { crit: 0.2 }, desc: '+20% Crit Chance' },
    { id: 'vampsiphon', name: 'Vampiric Siphon', emoji: '\u{1FA78}', cat: 'Offense', cost: 900, stats: { lifesteal: 0.1 }, desc: '+10% Lifesteal' },
    { id: 'kevlar', name: 'Kevlar Vest', emoji: '\u{1F9E5}', cat: 'Defense', cost: 450, stats: { armor: 30 }, desc: '+30 Armor' },
    { id: 'riot', name: 'Riot Shield', emoji: '\u{1F6E1}', cat: 'Defense', cost: 1200, stats: { armor: 60, maxHp: 200 }, desc: '+60 Armor, +200 HP' },
    { id: 'bulwark', name: 'Bulwark', emoji: '\u{1F6E1}', cat: 'Defense', cost: 2900, stats: { maxHp: 350, armor: 80 }, desc: '+350 HP, +80 Armor' },
    { id: 'jammer', name: 'Signal Jammer', emoji: '\u{1F4F5}', cat: 'Defense', cost: 1200, stats: { mr: 40, maxHp: 150 }, desc: '+40 MR, +150 HP' },
    { id: 'hazmat', name: 'Hazmat Suit', emoji: '\u{2623}', cat: 'Defense', cost: 2900, stats: { maxHp: 350, mr: 80 }, desc: '+350 HP, +80 Magic Resist' },
    { id: 'trauma', name: 'Trauma Plate', emoji: '\u{269B}', cat: 'Defense', cost: 2800, stats: { maxHp: 500, hpRegen: 6 }, desc: '+500 HP, +6 HP/s' },
    { id: 'sneakers', name: 'Sneakers', emoji: '\u{1F45F}', cat: 'Utility', cost: 350, stats: { msPercent: 8 }, desc: '+8% Move Speed' },
    { id: 'adrenaline', name: 'Adrenaline', emoji: '\u{1F4AA}', cat: 'Utility', cost: 1500, stats: { maxHp: 250, ad: 15 }, desc: '+250 HP, +15 AD' },
    { id: 'chrono', name: 'Chrono Watch', emoji: '\u{231A}', cat: 'Utility', cost: 2500, stats: { ap: 40, armor: 30, cdr: 0.2 }, desc: '+40 AP, +30 Armor, +20% CDR' },
    { id: 'momentum', name: 'Momentum Boots', emoji: '\u{1F45F}', cat: 'Utility', cost: 1100, stats: { msPercent: 12, attackSpeed: 0.1 }, desc: '+12% Move Speed, +10% Attack Speed' },
  ];
  G.ITEM_BY_ID = {};
  G.ITEMS.forEach((i) => { G.ITEM_BY_ID[i.id] = i; });

  G.buyItem = function (hero, itemId) {
    const item = G.ITEM_BY_ID[itemId];
    if (!item) return { ok: false, reason: 'unknown item' };
    if (hero.gold < item.cost) return { ok: false, reason: 'not enough gold' };
    if (hero.items.filter(Boolean).length >= 6) return { ok: false, reason: 'inventory full' };
    hero.gold -= item.cost;
    hero.items.push(item);
    hero.recomputeStats();
    hero.hp = Math.min(hero.maxHp, hero.hp);
    return { ok: true, item };
  };

  G.sellItem = function (hero, slot) {
    const item = hero.items[slot];
    if (!item) return { ok: false };
    hero.gold += Math.floor(item.cost * 0.7);
    hero.items[slot] = null;
    hero.recomputeStats();
    hero.hp = Math.min(hero.maxHp, hero.hp);
    return { ok: true };
  };

  G.tickIncome = function (dt) {
    for (const h of G.state.heroes) {
      if (!h.alive) continue;
      h.gold += G.GOLD.passivePerSec * dt;
      h.goldEarned += G.GOLD.passivePerSec * dt;
    }
  };

  window.G = G;
})();
