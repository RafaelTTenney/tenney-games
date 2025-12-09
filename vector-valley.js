/* Vector Valley — Advanced Fixed-Path Tower Defence (distinct visual identity)
   - Supports three difficulties: 'easy'|'med'|'hard'
   - Fixed scenic paths; easy = more winding (slower enemy progress), hard = straighter (faster)
   - Richer tower set, upgrade branches, meaningful upgrade economy
   - Improved visuals: gradients, scanlines, particle feedback
   - API: init(canvas, difficultyStringOrNumber), update(), draw(ctx), click(x,y), startWave(), setBuild(k), upgrade(), sell()
*/

const VectorValley = {
  // state
  canvas: null, ctx: null, wave: 1, money: 500, lives: 20, active: false, gameOver: false,
  enemies: [], towers: [], projs: [], parts: [], q: [], sel: null, build: null,
  path: [], difficulty: 'med', diffMult: 1.0,

  // tower config (upgrade-friendly)
  conf: {
    towers: {
      turret:  { name:'TURRET',  cost:70,  r:120, dmg:26, cd:28, color:'#FFAA00' }, // balanced
      rapid:   { name:'RAPID',   cost:140, r:90,  dmg:7,  cd:6,  color:'#00FF66' }, // rate
      sniper:  { name:'SNIPER',  cost:360, r:420, dmg:160,cd:100,color:'#00FFFF' }, // glass cannon
      mortar:  { name:'MORTAR',  cost:200, r:200, dmg:60, cd:80, color:'#FF8844', aoe: true }, // AOE
      beacon:  { name:'BEACON',  cost:240, r:140, dmg:0,  cd:0,  color:'#AA66FF', boost: true } // boosts neighbor towers
    }
  },

  init: function(canvas, difficulty) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // support numeric or string difficulty
    if (typeof difficulty === 'string') this.difficulty = difficulty;
    else if (difficulty === 0.8) this.difficulty = 'easy';
    else if (difficulty === 1.5) this.difficulty = 'hard';
    else this.difficulty = 'med';

    this.diffMult = (this.difficulty === 'easy') ? 0.8 : (this.difficulty === 'hard') ? 1.5 : 1.0;

    this.money = 500;
    this.lives = 20;
    this.reset();
    this.setupPath();
    this.gameOver = false;
  },

  reset: function() {
    this.wave = 1; this.active = false; this.gameOver = false;
    this.enemies = []; this.towers = []; this.projs = []; this.parts = []; this.q = [];
    this.sel = null; this.build = null;
  },

  // Different preset paths; easy = winding, med = balanced, hard = straighter
  setupPath: function() {
    if (!this.canvas) return;
    if (this.difficulty === 'easy') {
      // Very winding scenic path
      this.path = [
        {x:20, y:140},{x:160,y:140},{x:160,y:60},{x:320,y:60},{x:320,y:220},{x:480,y:220},
        {x:480,y:100},{x:640,y:100},{x:640,y:300},{x:780,y:300}
      ];
    } else if (this.difficulty === 'med') {
      // Moderate winding
      this.path = [
        {x:10,y:160},{x:180,y:160},{x:180,y:240},{x:360,y:240},{x:360,y:120},
        {x:520,y:120},{x:520,y:280},{x:760,y:280}
      ];
    } else {
      // Hard: straighter, faster route to exit
      this.path = [
        {x:0,y:200},{x:220,y:200},{x:420,y:200},{x:640,y:200},{x:800,y:200}
      ];
    }
  },

  update: function() {
    if (this.gameOver) return;

    // Spawn logic (queue)
    if (this.active && this.q.length) {
      this.q[0].d--;
      if (this.q[0].d <= 0) {
        const ent = this.q.shift();
        this.enemies.push(Object.assign({}, ent, {
          x: this.path[0].x, y: this.path[0].y,
          idx: 1, hp: ent.hp * this.diffMult, maxHp: ent.hp * this.diffMult, dead:false
        }));
      }
    } else if (this.active && !this.enemies.length && !this.q.length) {
      this.active = false; this.wave++; this.money += 120 + this.wave*30;
    }

    // Move enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const targetPoint = this.path[e.idx] || null;
      if (!targetPoint) {
        // reached end
        this.lives--; this.enemies.splice(i,1);
        if (this.lives <= 0) { this.gameOver = true; }
        continue;
      }
      let dx = targetPoint.x - e.x, dy = targetPoint.y - e.y;
      let d = Math.hypot(dx,dy);
      let spd = e.spd || (1.2 + (this.wave*0.05));
      if (d < spd) {
        e.idx++;
      } else {
        e.x += (dx/d) * spd; e.y += (dy/d) * spd;
      }
    }

    // Towers act
    this.towers.forEach(t => {
      if (t.cd > 0) t.cd--;
      else {
        // boosted cooldown reduction by beacons nearby
        let boostFactor = 1.0;
        this.towers.forEach(n => {
          if (n.type === 'beacon') {
            let dd = (n.x - t.x)**2 + (n.y - t.y)**2;
            if (dd < (n.r*0.7)**2) boostFactor *= 0.78;
          }
        });

        let target = this.enemies.find(e => (e.x - t.x)**2 + (e.y - t.y)**2 < (t.r**2));
        if (target) {
          t.cd = Math.max(1, Math.floor((t.maxCd||t.cdBase||t.maxCd) * boostFactor));
          if (t.aoe) {
            // mortar: create an AOE hit
            this.projs.push({type:'aoe', x:target.x, y:target.y, r:28, dmg:t.dmg, color:t.color, life:12});
          } else {
            // projectile
            this.projs.push({type:'bullet', x:t.x, y:t.y, t:target, spd:10, dmg:t.dmg, color:t.color});
          }
        }
      }
    });

    // Projectiles
    for (let i = this.projs.length - 1; i >= 0; i--) {
      const p = this.projs[i];
      if (p.type === 'bullet') {
        if (!p.t || p.t.dead) { this.projs.splice(i,1); continue; }
        let dx = p.t.x - p.x, dy = p.t.y - p.y, dist = Math.hypot(dx,dy);
        if (dist < p.spd) {
          p.t.hp -= p.dmg;
          this.spawnParticles(p.t.x, p.t.y, p.color, 6);
          if (p.t.hp <= 0) { p.t.dead = true; this.money += p.t.val || 12; }
          this.projs.splice(i,1);
        } else {
          p.x += (dx/dist) * p.spd; p.y += (dy/dist) * p.spd;
        }
      } else if (p.type === 'aoe') {
        p.life--;
        if (p.life === 6) {
          // apply damage to enemies in radius
          this.enemies.forEach(e => {
            if ((e.x - p.x)**2 + (e.y - p.y)**2 < p.r*p.r) {
              e.hp -= p.dmg;
              this.spawnParticles(e.x, e.y, p.color, 8);
              if (e.hp <= 0) e.dead = true;
            }
          });
        }
        if (p.life <= 0) this.projs.splice(i,1);
      }
    }
    this.enemies = this.enemies.filter(e => !e.dead && e.idx <= this.path.length);

    // Particles
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const P = this.parts[i];
      P.x += P.vx; P.y += P.vy; P.life--;
      if (P.life <= 0) this.parts.splice(i,1);
    }
  },

  draw: function(ctx) {
    const W = this.canvas.width, H = this.canvas.height;
    // background gradient
    let g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#02050a'); g.addColorStop(1,'#031217');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

    // subtle vignette
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(0,0,W,H);

    // rails - thick understroke
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#102a10'; ctx.lineWidth = 26; ctx.beginPath();
    this.path.forEach((p,i)=> i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
    ctx.stroke();
    // inner rail bright
    ctx.strokeStyle = '#44ffaa'; ctx.lineWidth = 2; ctx.stroke();

    // scanlines
    ctx.fillStyle = 'rgba(0, 20, 10, 0.06)';
    for (let y=0;y<H;y+=2) ctx.fillRect(0,y,W,1);

    // towers
    this.towers.forEach(t => {
      ctx.save();
      ctx.shadowBlur = 12; ctx.shadowColor = t.color;
      ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(t.x, t.y, 12, 0, Math.PI*2); ctx.fill();
      ctx.restore();
      // center cut
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(t.x, t.y, 7, 0, Math.PI*2); ctx.fill();
      // range (if selected)
      if (this.sel === t) {
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath();
        ctx.arc(t.x, t.y, t.r, 0, Math.PI*2); ctx.stroke();
      }
    });

    // enemies
    this.enemies.forEach(e => {
      ctx.save();
      ctx.shadowBlur = 14; ctx.shadowColor = e.color;
      ctx.fillStyle = e.color;
      ctx.beginPath(); ctx.arc(e.x,e.y,8,0,Math.PI*2); ctx.fill();
      ctx.restore();
      // health bar
      ctx.fillStyle = '#111'; ctx.fillRect(e.x-10,e.y-14,20,3);
      ctx.fillStyle = '#0f0'; ctx.fillRect(e.x-10,e.y-14,20*(e.hp/e.maxHp),3);
    });

    // projectiles
    this.projs.forEach(p => {
      if (p.type === 'bullet') {
        ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.x-1,p.y); ctx.stroke();
      } else {
        // aoe pulse
        ctx.strokeStyle = p.color; ctx.setLineDash([4,6]); ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
      }
    });

    // particles
    this.parts.forEach(p => {
      ctx.fillStyle = p.color; ctx.globalAlpha = p.life/18; ctx.fillRect(p.x,p.y,2,2); ctx.globalAlpha = 1;
    });

    // HUD overlay (distance/wave at top-left)
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(10,10,180,44);
    ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.fillText(`Wave ${this.wave}`,20,32);
    ctx.fillStyle = '#ffd700'; ctx.fillText(`$${Math.floor(this.money)}`,100,32);
  },

  startWave: function() {
    if (this.active) return;
    this.active = true;
    const baseCount = 6 + Math.floor(this.wave * 2 * this.diffMult);
    for (let i=0;i<baseCount;i++) {
      let type = 'norm'; let hp = 18 + this.wave*12;
      let spd = 1.2 + (this.difficulty==='easy'? -0.12 : (this.difficulty==='hard'? 0.6 : 0.15));
      if (this.wave > 3 && i % 4 === 0) { type='shield'; hp *= 1.6; }
      if (this.wave > 5 && i % 6 === 0) { type='fast'; spd *= 2.0; hp *= 0.7; }
      let color = type==='shield' ? '#66aaff' : (type==='fast' ? '#ffff66' : '#ff66ff');
      this.q.push({d: i*26, type:type, hp:hp, spd:spd, color:color, val:10});
    }
  },

  click: function(x,y) {
    // cannot place on path area — disallow placement near path nodes
    for (let p of this.path) if ((p.x-x)**2 + (p.y-y)**2 < 25*25) return;
    let clicked = this.towers.find(t => (t.x-x)**2 + (t.y-y)**2 < 16*16);
    if (clicked) { this.sel = clicked; this.build = null; return; }

    if (this.active) return;
    if (this.build) {
      let def = this.conf.towers[this.build];
      if (this.money < def.cost) return;
      let T = {
        x: x, y: y, type: this.build, name: def.name, color: def.color, r: def.r, dmg: def.dmg,
        maxCd: def.cd, cd: 0, level: 1, aoe: def.aoe || false, boost: def.boost || false, val: Math.floor(def.cost*0.6)
      };
      this.towers.push(T);
      this.money -= def.cost;
      this.spawnParticles(x,y,'#fff',10);
      this.build = null;
    } else {
      this.sel = null;
    }
  },

  setBuild: function(k) { this.build = k; this.sel = null; },

  upgrade: function() {
    if (!this.sel) return;
    const def = this.conf.towers[this.sel.type];
    let cost = Math.floor(def.cost * 0.9 * this.sel.level);
    if (this.money < cost) return;
    this.money -= cost;
    this.sel.level++;
    this.sel.dmg = Math.floor(this.sel.dmg * 1.6);
    this.sel.r = Math.floor(this.sel.r * 1.12);
    this.sel.maxCd = Math.max(2, Math.floor(this.sel.maxCd * 0.88));
    this.spawnParticles(this.sel.x, this.sel.y, this.sel.color, 14);
  },

  sell: function() {
    if (!this.sel) return;
    this.money += this.sel.val || 20;
    this.towers = this.towers.filter(t => t !== this.sel);
    this.sel = null;
  },

  spawnParticles: function(x,y,color,n) {
    for (let i=0;i<n;i++) this.parts.push({x:x+Math.random()*8-4, y:y+Math.random()*8-4, vx:(Math.random()-0.5)*2, vy:(Math.random()-0.5)*2, life:10+Math.floor(Math.random()*8), color:color});
  }
};

// Expose a global name the page expects without redeclaring consts (avoid duplicate 'const' issues)
if (typeof window !== 'undefined') window.VectorGame = VectorValley;
if (typeof module !== 'undefined') module.exports = VectorValley;
