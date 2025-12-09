// SentinelGame adapter — wraps the existing procedural sentinel-grid.js 'td' implementation
// and exposes the object API Engine expects (init, update, draw, click, startWave, setBuild, upgrade, sell).
// This file keeps sentinel-grid.js unchanged and delegates to it.

/* global td, TD_CONF, tdSpawnEnemy, tdMoveEnemy, tdExplode, tdGetTarget, td.projectiles, td.towers, td.particles, td.enemies, tdUpdatePath, tdUpdateUI, tdStartWave, tdSelectType, tdUpgrade, tdSell, tdRender, tdClick */

const SentinelGame = {
  conf: {
    towers: (typeof TOWERS !== 'undefined') ? TOWERS : {}
  },

  init: function(canvas, diff) {
    if (!canvas || typeof td === 'undefined') return;
    // wire td to the canvas
    td.canvas = canvas;
    td.ctx = canvas.getContext('2d');
    td.canvas.onclick = tdClick;
    td.difficulty = diff || 1.0;

    // reset internal arrays WITHOUT calling tdReset (tdReset calls DOM update helpers)
    td.wave = 1; td.money = 250; td.lives = 20; td.waveActive = false;
    td.towers = []; td.enemies = []; td.projectiles = []; td.particles = []; td.startNodes = [{x:0,y:10}];
    td.buildType = 'blaster'; td.selected = null; td.enemiesToSpawn = 0; td.spawnTimer = 0;
    td.difficulty = diff || 1.0;

    // compute path using existing function (safe)
    if (typeof tdUpdatePath === 'function') tdUpdatePath();
  },

  stop: function() {
    // sentinel has a stop function: stopSentinel
    if (typeof stopSentinel === 'function') stopSentinel();
    td.running = false;
  },

  update: function() {
    if (typeof td === 'undefined') return;

    // --- Wave spawn logic ---
    if (td.waveActive) {
      if (td.enemiesToSpawn > 0) {
        td.spawnTimer++;
        if (td.spawnTimer > Math.max(10, 50 - td.wave)) {
          if (typeof tdSpawnEnemy === 'function') tdSpawnEnemy();
          td.enemiesToSpawn--;
          td.spawnTimer = 0;
        }
      } else if (td.enemies.length === 0) {
        if (typeof tdEndWave === 'function') tdEndWave();
      }
    }

    // --- Enemy movement & health ---
    for (let i = td.enemies.length - 1; i >= 0; i--) {
      const e = td.enemies[i];
      if (typeof tdMoveEnemy === 'function') tdMoveEnemy(e);
      if (e.reached) {
        td.lives--;
        td.enemies.splice(i, 1);
        if (td.lives <= 0) {
          const el = document.getElementById('td-msg');
          if (el) el.innerText = "GAME OVER! Lives hit zero.";
          // reset internal state (do light reset)
          td.wave = 1; td.money = 250; td.lives = 20; td.towers = []; td.enemies = []; td.projectiles = []; td.particles = [];
          if (typeof tdUpdatePath === 'function') tdUpdatePath();
        }
      } else if (e.hp <= 0) {
        td.money += e.reward || 0;
        if (typeof tdExplode === 'function') tdExplode(e.x, e.y, e.color || '#FFF');
        td.enemies.splice(i, 1);
      }
    }

    // --- Tower attacks ---
    td.towers.forEach(t => {
      if (t.cd > 0) t.cd--;
      else {
        let target = (typeof tdGetTarget === 'function') ? tdGetTarget(t) : null;
        if (target) {
          td.projectiles.push({
            x: t.x * TD_CONF.GRID + 10,
            y: t.y * TD_CONF.GRID + 10,
            target: target,
            speed: 8,
            dmg: t.dmg,
            color: t.color
          });
          t.cd = t.maxCd;
        }
      }
    });

    // --- Projectiles ---
    for (let i = td.projectiles.length - 1; i >= 0; i--) {
      const p = td.projectiles[i];
      if (!p.target || p.target.hp <= 0) { td.projectiles.splice(i, 1); continue; }
      let dx = p.target.x - p.x, dy = p.target.y - p.y;
      let dist = Math.hypot(dx, dy);
      if (dist < p.speed) {
        p.target.hp -= p.dmg;
        td.projectiles.splice(i, 1);
      } else {
        p.x += (dx / dist) * p.speed;
        p.y += (dy / dist) * p.speed;
      }
    }

    // --- Particles ---
    for (let i = td.particles.length - 1; i >= 0; i--) {
      const P = td.particles[i];
      P.x += P.vx; P.y += P.vy; P.life--;
      if (P.life <= 0) td.particles.splice(i, 1);
    }
  },

  draw: function(ctx) {
    // delegate to existing renderer if present (tdRender)
    if (typeof tdRender === 'function') {
      tdRender();
    } else if (ctx && td && td.ctx) {
      ctx.clearRect(0, 0, td.canvas.width, td.canvas.height);
    }
  },

  click: function(px, py) {
    if (!td.canvas || typeof tdClick !== 'function') return;
    // create a fake event consistent with sentinel tdClick expectations
    let rect = td.canvas.getBoundingClientRect();
    const ev = { clientX: rect.left + px, clientY: rect.top + py };
    try { tdClick(ev); } catch (e) { /* ignore */ }
  },

  startWave: function() {
    if (typeof tdStartWave === 'function') tdStartWave();
    else if (typeof tdStartWave === 'undefined' && typeof tdStartWave === 'function') tdStartWave();
  },

  setBuild: function(k) {
    if (typeof tdSelectType === 'function') tdSelectType(k);
    else td.buildType = k;
  },

  upgrade: function() {
    if (typeof tdUpgrade === 'function') tdUpgrade();
  },

  sell: function() {
    if (typeof tdSell === 'function') tdSell();
  }
};

// expose for environments
if (typeof window !== 'undefined') window.SentinelGame = SentinelGame;
if (typeof module !== 'undefined') module.exports = SentinelGame;
