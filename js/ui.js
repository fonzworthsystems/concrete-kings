// ui.js — HUD, minimap, shop, menus, end screen
(function () {
  const G = window.G;

  function el(tag, cls, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (parent) parent.appendChild(e);
    return e;
  }

  G.ui = {
    els: {},
    minimap: null, minimapCtx: null,
    mw: 200, mh: 104,
    selected: null,
    shopOpen: false, shopCat: 'All',
    player: null,

    init() {
      this.buildHud();
      this.buildShop();
      this.buildMenu();
      this.buildEnd();
    },

    // ================= HUD =================
    buildHud() {
      const hud = document.getElementById('hud');

      const bottom = el('div', 'hud-bottom', hud); bottom.id = 'hud-bottom';

      // stats card
      const sc = el('div', 'panel', bottom); sc.id = 'stats-card';
      sc.innerHTML = '<div class="hero-name"></div><div class="hero-title"></div>' +
        '<div class="bars">' +
        '<div class="bar-row"><span class="label">HP</span><div class="bar"><div class="fill hp"></div><div class="bar-text"></div></div></div>' +
        '<div class="bar-row"><span class="label">MP</span><div class="bar"><div class="fill mp"></div><div class="bar-text"></div></div></div>' +
        '<div class="bar"><div class="fill xp"></div></div>' +
        '</div>';
      this.els.name = sc.querySelector('.hero-name');
      this.els.title = sc.querySelector('.hero-title');
      this.els.hpFill = sc.querySelector('.fill.hp');
      this.els.mpFill = sc.querySelector('.fill.mp');
      this.els.xpFill = sc.querySelector('.fill.xp');
      this.els.hpText = sc.querySelectorAll('.bar-text')[0];
      this.els.mpText = sc.querySelectorAll('.bar-text')[1];

      // abilities
      const ab = el('div', null, bottom); ab.id = 'abilities';
      this.abilityEls = [];
      for (let i = 0; i < 4; i++) {
        const a = el('div', 'ability', ab);
        a.innerHTML = '<div class="icon"></div><div class="key"></div><div class="level"></div><div class="cd"></div>';
        a.addEventListener('click', () => { G.events.emit('abilityClick', i); });
        this.abilityEls.push(a);
        const keys = ['Q', 'W', 'E', 'R'];
        a.querySelector('.key').textContent = keys[i];
      }

      // items
      const items = el('div', null, bottom); items.id = 'items';
      this.itemEls = [];
      for (let i = 0; i < 6; i++) {
        const s = el('div', 'item-slot empty', items);
        s.textContent = '·';
        s.addEventListener('click', () => { G.events.emit('sellItem', i); });
        this.itemEls.push(s);
      }

      // meta
      const meta = el('div', null, bottom); meta.id = 'meta';
      meta.innerHTML = '<div id="gold"></div><div id="kda"></div><div id="score"></div><div id="hint"></div>';
      this.els.gold = meta.querySelector('#gold');
      this.els.kda = meta.querySelector('#kda');
      this.els.score = meta.querySelector('#score');
      this.els.hint = meta.querySelector('#hint');
      this.els.hint.textContent = 'Right-click move · Q/W/E/R cast · Ctrl+Q/W/E/R level · T ward · B recall · P shop';

      // minimap
      const mmw = el('div', null, hud); mmw.id = 'minimap-wrap';
      const mm = el('div', null, mmw); mm.id = 'minimap';
      const c = el('canvas', null, mm);
      c.width = this.mw; c.height = this.mh;
      this.minimap = c; this.minimapCtx = c.getContext('2d');

      // banner / respawn / casting
      this.els.banner = el('div', null, hud); this.els.banner.id = 'banner';
      this.els.respawn = el('div', null, hud); this.els.respawn.id = 'respawn';
      this.els.casting = el('div', null, hud); this.els.casting.id = 'casting';
    },

    // ================= SHOP =================
    buildShop() {
      const hud = document.getElementById('hud');
      const shop = el('div', 'panel', hud); shop.id = 'shop';
      const tabs = el('div', 'shop-tabs', shop);
      ['All', 'Offense', 'Defense', 'Utility'].forEach((cat) => {
        const t = el('div', 'shop-tab' + (cat === 'All' ? ' active' : ''), tabs);
        t.textContent = cat;
        t.addEventListener('click', () => { this.shopCat = cat; this.renderShop(); });
      });
      this.els.shopItems = el('div', null, shop); this.els.shopItems.id = 'shop-items';
      this.els.shopGold = el('div', null, shop); this.els.shopGold.id = 'shop-gold';
      const close = el('div', 'shop-tab', tabs); close.textContent = 'Close (P)';
      close.addEventListener('click', () => this.closeShop());
    },
    openShop() { this.shopOpen = true; document.getElementById('shop').classList.add('open'); this.renderShop(); },
    closeShop() { this.shopOpen = false; document.getElementById('shop').classList.remove('open'); },
    renderShop() {
      if (!this.els.shopItems) return;
      const p = this.player;
      this.els.shopGold.textContent = 'Gold: ' + Math.floor(p ? p.gold : 0);
      const list = G.ITEMS.filter((i) => this.shopCat === 'All' || i.cat === this.shopCat);
      this.els.shopItems.innerHTML = '';
      list.forEach((it) => {
        const owned = p && p.items.some((x) => x && x.id === it.id);
        const d = el('div', 'shop-item', this.els.shopItems);
        d.innerHTML = '<div class="si-icon">' + it.emoji + '</div>' +
          '<div class="si-body"><div class="si-name">' + it.name + (owned ? ' (owned)' : '') + '</div>' +
          '<div class="si-desc">' + it.desc + '</div></div>' +
          '<div class="si-cost">' + it.cost + 'g</div>';
        d.addEventListener('click', () => {
          const r = G.buyItem(p, it.id);
          if (!r.ok) G.events.emit('toast', r.reason);
          else G.audio.gold();
          this.renderShop();
        });
      });
    },

    // ================= MENU / HERO SELECT =================
    buildMenu() {
      const hud = document.getElementById('hud');
      const menu = el('div', null, hud); menu.id = 'menu';
      menu.innerHTML = '<div class="menu-card panel">' +
        '<h1 class="team-a">CONCRETE KINGS</h1>' +
        '<div class="tagline">A 5v5 urban-warfare MOBA. Take the streets, break their base, own the city.</div>' +
        '<div id="hero-grid"></div>' +
        '<div id="hero-detail"></div>' +
        '<button id="btn-lock">SELECT HERO</button>' +
        '</div>';
      this.els.menu = menu;
      this.els.heroGrid = menu.querySelector('#hero-grid');
      this.els.heroDetail = menu.querySelector('#hero-detail');
      this.els.btnLock = menu.querySelector('#btn-lock');
      this.els.btnLock.disabled = true;
      this.els.btnLock.addEventListener('click', () => {
        if (this.selected) { G.audio.click(); G.events.emit('lockHero', this.selected.id); }
      });
    },
    renderHeroSelect() {
      this.els.heroGrid.innerHTML = '';
      G.HEROES.forEach((h) => {
        const c = el('div', 'hero-card', this.els.heroGrid);
        c.innerHTML = '<div class="hc-portrait" style="background:' + G.teamColorCSS[G.TEAM_A] + '22">' + h.emoji + '</div>' +
          '<div class="hc-name">' + h.name + '</div>' +
          '<div class="hc-role">' + h.role + ' · ' + h.title + '</div>';
        c.addEventListener('click', () => { this.selected = h; this.els.btnLock.disabled = false; this.renderDetail(h); G.audio.click(); });
      });
      this.els.heroDetail.innerHTML = '<h3>Pick a fighter</h3><div class="hd-lore">Choose your champion to enter the district.</div>';
    },
    renderDetail(h) {
      let ab = '';
      h.abilities.forEach((a) => {
        ab += '<div><b>' + a.key + '</b> — ' + a.name + ': ' + a.desc + '</div>';
      });
      this.els.heroDetail.innerHTML = '<h3>' + h.emoji + ' ' + h.name + ' — ' + h.role + '</h3>' +
        '<div class="hd-lore">' + h.lore + '</div>' +
        '<div class="hd-abilities">' + ab + '</div>' +
        '<div class="hd-lore">Passive: <b>' + h.passive.name + '</b> — ' + h.passive.desc + '</div>';
    },
    showMenu() { this.els.menu.style.display = 'flex'; },
    hideMenu() { this.els.menu.style.display = 'none'; },

    // ================= END =================
    buildEnd() {
      const hud = document.getElementById('hud');
      const end = el('div', null, hud); end.id = 'end';
      end.innerHTML = '<div class="end-card panel"><h2 id="end-title"></h2>' +
        '<div class="end-stats" id="end-stats"></div>' +
        '<button id="btn-again">PLAY AGAIN</button></div>';
      this.els.end = end;
      this.els.endTitle = end.querySelector('#end-title');
      this.els.endStats = end.querySelector('#end-stats');
      end.querySelector('#btn-again').addEventListener('click', () => { G.audio.click(); G.events.emit('playAgain'); });
    },
    showEnd(victory, player) {
      this.els.end.style.display = 'flex';
      this.els.endTitle.textContent = victory ? 'VICTORY' : 'DEFEAT';
      this.els.endTitle.style.color = victory ? G.teamColorCSS[G.TEAM_A] : G.teamColorCSS[G.TEAM_B];
      const p = player;
      this.els.endStats.textContent = 'K ' + p.kills + ' / D ' + p.deaths + ' / A ' + p.assists +
        ' · CS ' + p.cs + ' · Gold ' + Math.floor(p.goldEarned) + ' · DMG ' + Math.floor(p.dmgDealt) +
        ' · Level ' + p.level + ' · ' + Math.floor(G.state.time / 60) + ':' + String(Math.floor(G.state.time % 60)).padStart(2, '0');
    },
    hideEnd() { this.els.end.style.display = 'none'; },

    // ================= per-frame update =================
    update(dt) {
      const p = this.player;
      if (!p) return;
      // stats
      this.els.name.textContent = p.name + ' · Lv ' + p.level;
      this.els.title.textContent = p.def.title;
      this.els.hpFill.style.width = (p.hp / p.maxHp * 100) + '%';
      this.els.mpFill.style.width = (p.maxMp ? p.mp / p.maxMp * 100 : 0) + '%';
      this.els.hpText.textContent = Math.ceil(p.hp) + ' / ' + Math.ceil(p.maxHp);
      this.els.mpText.textContent = Math.ceil(p.mp) + ' / ' + Math.ceil(p.maxMp);
      const xpPct = p.level >= 18 ? 1 : (p.xp - G.xpToLevel[p.level - 1]) / (G.xpToLevel[p.level] - G.xpToLevel[p.level - 1]);
      this.els.xpFill.style.width = (G.M.clamp(xpPct, 0, 1) * 100) + '%';

      // abilities
      for (let i = 0; i < 4; i++) {
        const a = p.abilities[i];
        const e = this.abilityEls[i];
        const cd = Math.max(0, (a.cooldownUntil - G.state.time));
        const cdEl = e.querySelector('.cd');
        if (cd > 0) { cdEl.style.display = 'flex'; cdEl.textContent = cd.toFixed(1); }
        else cdEl.style.display = 'none';
        e.classList.toggle('ready', a.level > 0 && cd <= 0 && p.mp >= a.def.cost);
        e.querySelector('.icon').textContent = a.def.emoji;
        e.querySelector('.level').textContent = a.level > 0 ? a.level : '';
        e.style.opacity = a.level > 0 ? 1 : 0.4;
      }

      // items
      for (let i = 0; i < 6; i++) {
        const it = p.items[i];
        const s = this.itemEls[i];
        if (it) { s.textContent = it.emoji; s.classList.remove('empty'); s.title = it.name + ' — ' + it.desc; }
        else { s.textContent = '·'; s.classList.add('empty'); s.title = ''; }
      }

      // meta
      this.els.gold.textContent = Math.floor(p.gold) + ' ⛁';
      this.els.kda.textContent = p.kills + ' / ' + p.deaths + ' / ' + p.assists;
      this.els.score.textContent = G.score ? (G.score[G.TEAM_A] + ' vs ' + G.score[G.TEAM_B]) : '';

      // respawn overlay
      if (!p.alive) {
        const t = Math.max(0, p.respawnAt - G.state.time);
        this.els.respawn.textContent = 'Respawning in ' + t.toFixed(0) + 's';
      } else this.els.respawn.textContent = '';

      // casting overlay
      this.els.casting.textContent = G.castState ? ('Cast ' + G.castState.ab.def.name + ' — click to confirm, right-click to cancel') : '';

      // banner
      const ann = G.state.announcements[G.state.announcements.length - 1];
      if (ann && G.state.time - ann.at < 3.5) {
        this.els.banner.innerHTML = '<div class="line" style="color:' + (ann.color || '#fff') + '">' + ann.text + '</div>';
      } else if (G.state.time - (ann ? ann.at : 0) > 4) {
        this.els.banner.innerHTML = '';
      }
    },

    // ================= minimap =================
    updateMinimap() {
      const ctx = this.minimapCtx;
      if (!ctx) return;
      ctx.clearRect(0, 0, this.mw, this.mh);
      const sx = this.mw / (G.WORLD.halfW * 2), sy = this.mh / (G.WORLD.halfD * 2);
      const mx = (x) => (x + G.WORLD.halfW) * sx;
      const my = (z) => (z + G.WORLD.halfD) * sy;

      // bg
      ctx.fillStyle = '#0c1014';
      ctx.fillRect(0, 0, this.mw, this.mh);
      // fog overlay
      if (G.fogOverlay) ctx.drawImage(G.fogOverlay.cv, 0, 0, this.mw, this.mh);
      // lanes
      ctx.strokeStyle = '#3a414c'; ctx.lineWidth = 2;
      G.WORLD.laneZ.forEach((z) => {
        ctx.beginPath(); ctx.moveTo(mx(-52), my(z)); ctx.lineTo(mx(52), my(z)); ctx.stroke();
      });
      // river
      ctx.strokeStyle = '#1a2b38'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(mx(0), my(-27)); ctx.lineTo(mx(0), my(27)); ctx.stroke();
      // bases
      [G.TEAM_A, G.TEAM_B].forEach((t) => {
        const nx = t === G.TEAM_A ? -G.NEXUS.x : G.NEXUS.x;
        ctx.fillStyle = G.teamColorCSS[t];
        ctx.fillRect(mx(nx) - 4, my(0) - 4, 8, 8);
      });
      // turrets
      for (const t of G.state.turrets) {
        if (!t.alive) continue;
        ctx.fillStyle = G.teamColorCSS[t.team];
        ctx.fillRect(mx(t.pos.x) - 2, my(t.pos.z) - 2, 4, 4);
      }
      // inhibitors
      for (const i of G.state.inhibitors) {
        if (!i.alive) continue;
        ctx.fillStyle = G.teamColorCSS[i.team];
        ctx.fillRect(mx(i.pos.x) - 2.5, my(i.pos.z) - 2.5, 5, 5);
      }
      // monsters
      for (const m of G.state.monsters) {
        if (!m.alive) continue;
        ctx.fillStyle = m.isEpic ? '#b44dff' : '#c08040';
        ctx.fillRect(mx(m.pos.x) - 2, my(m.pos.z) - 2, 4, 4);
      }
      // minions
      for (const m of G.state.minions) {
        if (!m.alive) continue;
        ctx.fillStyle = G.teamColorCSS[m.team];
        ctx.fillRect(mx(m.pos.x) - 1, my(m.pos.z) - 1, 2, 2);
      }
      // heroes
      for (const h of G.state.heroes) {
        if (!h.alive) continue;
        if (h.team === G.TEAM_B && !G.vision.enemyVisible(h, G.TEAM_A)) continue;
        ctx.fillStyle = G.teamColorCSS[h.team];
        ctx.beginPath(); ctx.arc(mx(h.pos.x), my(h.pos.z), h.isPlayer ? 3.5 : 3, 0, Math.PI * 2); ctx.fill();
        if (h.isPlayer) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); }
      }
    },
  };

  window.G = G;
})();
