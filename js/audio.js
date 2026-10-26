// audio.js — procedural Web Audio SFX (no external assets)
(function () {
  const G = window.G;
  G.audio = {
    ctx: null, enabled: true, master: null,
    init() {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.28;
        this.master.connect(this.ctx.destination);
      } catch (e) { this.ctx = null; }
    },
    resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    tone(freq, dur, type, vol, slide) {
      if (!this.ctx || !this.enabled) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
      g.gain.setValueAtTime(vol || 0.2, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur);
    },
    noise(dur, vol, filterFreq) {
      if (!this.ctx || !this.enabled) return;
      const t = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * dur);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq || 800;
      const g = this.ctx.createGain(); g.gain.value = vol || 0.2;
      src.connect(f); f.connect(g); g.connect(this.master); src.start(t);
    },
    hit() { this.noise(0.1, 0.2, 900); },
    cast() { this.tone(320, 0.16, 'triangle', 0.16, 520); },
    kill() { this.tone(440, 0.3, 'square', 0.14, 660); this.tone(220, 0.4, 'sawtooth', 0.11, 110); },
    death() { this.tone(300, 0.5, 'sawtooth', 0.16, 90); },
    turret() { this.tone(180, 0.25, 'square', 0.11, 120); },
    gold() { this.tone(880, 0.08, 'sine', 0.1); this.tone(1320, 0.1, 'sine', 0.09); },
    levelUp() { this.tone(523, 0.12, 'triangle', 0.13); this.tone(659, 0.12, 'triangle', 0.13); this.tone(784, 0.2, 'triangle', 0.13); },
    victory() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'triangle', 0.16), i * 140)); },
    defeat() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.35, 'sawtooth', 0.13), i * 160)); },
    click() { this.tone(600, 0.06, 'square', 0.07); },
    recall() { this.tone(700, 0.5, 'sine', 0.09, 1200); },
    nexus() { this.tone(200, 0.6, 'sawtooth', 0.2, 60); },
  };

  G.events.on('death', (d) => {
    if (d.unit && d.unit.isHero && d.unit.isHero()) {
      if (d.unit.isPlayer) G.audio.death();
      if (d.killer && d.killer.isPlayer) G.audio.kill();
    }
  });
  G.events.on('cast', () => G.audio.cast());
  G.events.on('levelUp', (e) => { if (e.hero && e.hero.isPlayer) G.audio.levelUp(); });
  G.events.on('hit', () => G.audio.hit());
  G.events.on('nexusDestroyed', () => G.audio.nexus());

  window.G = G;
})();
