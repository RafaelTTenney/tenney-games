import { getHighScore, submitHighScore } from './score-store.js';

/* BREACH COMMAND */
(function(global){
  const Reverse = (function(){
    const UNITS = {
      raider: { name:'RAIDER', cost:40, color:'#66ff99', hp:70, spd:2.7, dmg:8, range:34, rate:16, breach:8, desc:'Fast skirmisher that shreds weak towers.' },
      brute:  { name:'BRUTE',  cost:95, color:'#ff9966', hp:220, spd:1.5, dmg:20, range:36, rate:26, breach:18, armor:0.35, desc:'Armored breaker with heavy tower damage.' },
      swarm:  { name:'SWARM',  cost:110, color:'#66ccff', hp:45, spd:3.2, dmg:6, range:28, rate:10, breach:6, desc:'Fast drones; great for distracting turrets.' },
      siege:  { name:'SIEGE',  cost:190, color:'#ffd166', hp:320, spd:1.1, dmg:34, range:60, rate:36, breach:32, bonus:1.4, desc:'Siege rig that melts fortified nodes.' },
      hacker: { name:'HACKER', cost:150, color:'#c77dff', hp:110, spd:2.0, dmg:4, range:80, rate:20, stun:80, breach:10, desc:'Disables towers briefly while attacking.' },
      bomber: { name:'BOMBER', cost:170, color:'#ff5d5d', hp:140, spd:2.2, dmg:0, range:22, rate:1, breach:14, explode:90, desc:'Explodes on contact, damaging nearby towers.' }
    };

    const TOWER_TYPES = {
      laser: { name:'LASER', color:'#ff4d6d', range:200, dmg:6, rate:6, hp:140, beam:true },
      cannon:{ name:'CANNON',color:'#ffd166', range:180, dmg:22, rate:40, hp:180, aoe:60 },
      tesla: { name:'TESLA', color:'#ffe95a', range:150, dmg:10, rate:26, hp:160, chain:3 },
      flak:  { name:'FLAK',  color:'#4d96ff', range:220, dmg:9, rate:14, hp:150, slow:0.5 }
    };

    const TOWER_LAYOUT = [
      { x: 260, y: 180, type:'laser' },
      { x: 520, y: 580, type:'flak' },
      { x: 720, y: 320, type:'cannon' },
      { x: 900, y: 520, type:'tesla' },
      { x: 400, y: 360, type:'laser' },
      { x: 840, y: 200, type:'flak' }
    ];

    let canvas, ctx;
    let path = [];
    let units = [];
    let towers = [];
    let projs = [];
    let particles = [];

    const GAME_ID = 'tower-reverse';
    let wave = 1;
    let money = 250;
    let lives = 30;
    let active = false;
    let baseMax = 120;
    let baseHp = 120;
    let bestWave = 0;
    let submitted = false;
    let buildType = null;
    let frame = 0;

    function init(c) {
      canvas = c;
      ctx = c.getContext('2d');
      reset();
    }

    async function loadBestWave() {
      bestWave = await getHighScore(GAME_ID);
    }

    async function submitBestWave() {
      if (submitted) return;
      submitted = true;
      const saved = await submitHighScore(GAME_ID, wave);
      if (typeof saved === 'number') bestWave = saved;
    }

    function reset() {
      wave = 1;
      money = 260;
      lives = 30;
      active = false;
      baseMax = 120;
      baseHp = baseMax;
      units = [];
      projs = [];
      particles = [];
      buildType = null;
      submitted = false;
      frame = 0;
      buildPath();
      buildTowers();
      loadBestWave();
    }

    function buildPath() {
      const w = canvas.width;
      const h = canvas.height;
      path = [
        { x: 30, y: h * 0.5 },
        { x: w * 0.25, y: h * 0.2 },
        { x: w * 0.5, y: h * 0.78 },
        { x: w * 0.7, y: h * 0.3 },
        { x: w * 0.88, y: h * 0.6 },
        { x: w - 40, y: h * 0.5 }
      ];
    }

    function buildTowers() {
      const scale = 1 + wave * 0.18;
      towers = TOWER_LAYOUT.map((t, i) => {
        const def = TOWER_TYPES[t.type];
        return {
          id: `${t.type}-${i}-${Date.now()}`,
          x: t.x,
          y: t.y,
          type: t.type,
          name: def.name,
          color: def.color,
          range: def.range,
          dmg: def.dmg * scale,
          rate: Math.max(6, Math.floor(def.rate * (1 - wave * 0.03))),
          aoe: def.aoe || 0,
          chain: def.chain || 0,
          slow: def.slow || 0,
          hp: Math.floor(def.hp * scale),
          maxHp: Math.floor(def.hp * scale),
          beam: !!def.beam,
          cd: Math.floor(Math.random() * 12),
          stun: 0
        };
      });
    }

    function startWave() {
      if (active) return;
      active = true;
      baseMax = 120 + wave * 50;
      baseHp = baseMax;
      money += 120 + wave * 70;
      buildTowers();
    }

    function spawnUnit(type) {
      const def = UNITS[type];
      if (!def) return;
      const jitter = (Math.random() - 0.5) * 26;
      units.push({
        x: path[0].x,
        y: path[0].y + jitter,
        idx: 0,
        hp: def.hp,
        maxHp: def.hp,
        spd: def.spd,
        baseSpd: def.spd,
        dmg: def.dmg,
        range: def.range,
        rate: def.rate,
        breach: def.breach,
        armor: def.armor || 0,
        bonus: def.bonus || 1,
        stun: def.stun || 0,
        explode: def.explode || 0,
        color: def.color,
        type,
        cd: 0,
        slowTimer: 0
      });
    }

    function findTowerTarget(u) {
      let best = null;
      let bestDist = Infinity;
      towers.forEach(t => {
        if (t.hp <= 0) return;
        const d = Math.hypot(t.x - u.x, t.y - u.y);
        if (d <= u.range && d < bestDist) {
          best = t;
          bestDist = d;
        }
      });
      return best;
    }

    function update() {
      frame++;
      if (lives <= 0) {
        submitBestWave();
        return;
      }

      money += 0.05 + wave * 0.004;

      for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i];
        if (u.slowTimer > 0) { u.slowTimer--; }
        u.spd = u.slowTimer > 0 ? u.baseSpd * 0.6 : u.baseSpd;

        const targetTower = findTowerTarget(u);
        if (targetTower) {
          if (u.cd > 0) {
            u.cd--;
          } else {
            if (u.type === 'bomber' && u.explode) {
              explode(u.x, u.y, u.explode, u.dmg || 0, 1.4);
              u.hp = 0;
            } else {
              const damage = u.dmg * u.bonus;
              targetTower.hp -= damage;
              if (u.stun) targetTower.stun = Math.max(targetTower.stun, u.stun);
              particles.push({ type:'slash', x: targetTower.x, y: targetTower.y, life: 10, color: u.color });
            }
            u.cd = u.rate;
          }
        } else {
          const target = path[u.idx + 1];
          if (!target) {
            baseHp -= u.breach;
            money += 10;
            units.splice(i, 1);
            continue;
          }
          const dx = target.x - u.x;
          const dy = target.y - u.y;
          const d = Math.hypot(dx, dy);
          if (d < u.spd) {
            u.idx++;
            u.x = target.x;
            u.y = target.y;
          } else {
            u.x += (dx / d) * u.spd;
            u.y += (dy / d) * u.spd;
          }
        }

        if (u.hp <= 0) {
          lives--;
          if (u.type === 'bomber' && u.explode) {
            explode(u.x, u.y, u.explode, u.dmg || 0, 1.4);
          }
          for (let k = 0; k < 8; k++) {
            particles.push({ type:'spark', x:u.x, y:u.y, vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4, life:18, color:u.color });
          }
          units.splice(i, 1);
          continue;
        }

        if (u.x < -30 || u.x > canvas.width + 30 || u.y < -30 || u.y > canvas.height + 30) {
          units.splice(i, 1);
        }
      }

      for (let i = towers.length - 1; i >= 0; i--) {
        const t = towers[i];
        if (t.hp <= 0) {
          money += 30 + wave * 5;
          for (let k = 0; k < 10; k++) {
            particles.push({ type:'debris', x:t.x, y:t.y, vx:(Math.random()-0.5)*6, vy:(Math.random()-0.5)*6, life:22, color:t.color });
          }
          towers.splice(i, 1);
          continue;
        }

        if (t.stun > 0) { t.stun--; continue; }
        if (t.cd > 0) { t.cd--; continue; }

        const target = units.find(u => Math.hypot(u.x - t.x, u.y - t.y) < t.range);
        if (target) {
          if (t.beam) {
            target.hp -= t.dmg;
            particles.push({ type:'beam', sx:t.x, sy:t.y, ex:target.x, ey:target.y, color:t.color, life:6 });
            t.cd = t.rate;
          } else if (t.chain) {
            chainStrike(t, target);
            t.cd = t.rate;
          } else {
            projs.push({
              x: t.x,
              y: t.y,
              tx: target.x,
              ty: target.y,
              dmg: t.dmg,
              spd: 9,
              aoe: t.aoe,
              slow: t.slow,
              color: t.color
            });
            t.cd = t.rate;
          }
        }
      }

      for (let i = projs.length - 1; i >= 0; i--) {
        const p = projs[i];
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const d = Math.hypot(dx, dy);
        if (d < p.spd) {
          if (p.aoe) {
            units.forEach(u => {
              if (Math.hypot(u.x - p.tx, u.y - p.ty) < p.aoe) {
                applyTowerDamage(u, p.dmg);
                if (p.slow) u.slowTimer = Math.max(u.slowTimer, 40);
              }
            });
            particles.push({ type:'ring', x:p.tx, y:p.ty, life:14, color:p.color, r:p.aoe });
          } else {
            const hit = units.find(u => Math.hypot(u.x - p.tx, u.y - p.ty) < 18);
            if (hit) {
              applyTowerDamage(hit, p.dmg);
              if (p.slow) hit.slowTimer = Math.max(hit.slowTimer, 40);
            }
          }
          projs.splice(i, 1);
        } else {
          p.x += (dx / d) * p.spd;
          p.y += (dy / d) * p.spd;
          particles.push({ type:'trail', x:p.x, y:p.y, life:12, color:p.color });
        }
      }

      particles.forEach((p, i) => {
        p.life--;
        if (p.vx) { p.x += p.vx; p.y += p.vy; }
        if (p.life <= 0) particles.splice(i, 1);
      });

      if (baseHp <= 0) {
        active = false;
        wave++;
        money += 150 + wave * 30;
        lives += 5;
        units = [];
        projs = [];
        if (wave > bestWave) bestWave = wave;
      }
    }

    function applyTowerDamage(unit, dmg) {
      const final = dmg * (1 - (unit.armor || 0));
      unit.hp -= final;
      particles.push({ type:'spark', x:unit.x, y:unit.y, life:10, color:unit.color });
    }

    function explode(x, y, r, dmg, towerMult) {
      particles.push({ type:'shock', x, y, life:18, color:'#ff8866', r });
      towers.forEach(t => {
        if (Math.hypot(t.x - x, t.y - y) < r) {
          t.hp -= dmg * (towerMult || 1);
        }
      });
    }

    function chainStrike(t, target) {
      let chain = [target];
      let curr = target;
      applyTowerDamage(curr, t.dmg);
      for (let k = 0; k < t.chain; k++) {
        let next = units.find(u => !chain.includes(u) && Math.hypot(u.x - curr.x, u.y - curr.y) < 120);
        if (next) {
          chain.push(next);
          applyTowerDamage(next, t.dmg * 0.8);
          curr = next;
        }
      }
      particles.push({ type:'bolt', chain, color:'#ffe95a', life:6 });
    }

    function draw(ctx) {
      const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      bg.addColorStop(0, '#04070d');
      bg.addColorStop(1, '#120514');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(0,255,204,0.45)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
      ctx.lineWidth = 1;

      const baseX = canvas.width - 55;
      ctx.fillStyle = 'rgba(255,0,120,0.15)';
      ctx.fillRect(baseX, 0, 45, canvas.height);
      ctx.strokeStyle = 'rgba(255,0,120,0.6)';
      ctx.strokeRect(baseX, 0, 45, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`CORE ${Math.max(0, Math.floor(baseHp))}/${baseMax}`, canvas.width - 210, 30);

      towers.forEach(t => {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.shadowBlur = 15;
        ctx.shadowColor = t.color;
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (t.stun > 0) {
          ctx.strokeStyle = '#ffe95a';
          ctx.beginPath();
          ctx.arc(0, 0, 20, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = '#f33';
        ctx.fillRect(t.x - 14, t.y - 22, 28, 4);
        ctx.fillStyle = '#0f0';
        ctx.fillRect(t.x - 14, t.y - 22, 28 * (t.hp / t.maxHp), 4);
      });

      units.forEach(u => {
        ctx.save();
        ctx.translate(u.x, u.y);
        ctx.fillStyle = u.color;
        if (u.type === 'swarm') {
          ctx.beginPath();
          ctx.moveTo(8, 0);
          ctx.lineTo(-8, 6);
          ctx.lineTo(-8, -6);
          ctx.fill();
        } else if (u.type === 'siege') {
          ctx.fillRect(-10, -10, 20, 20);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, 9, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        ctx.fillStyle = '#0f0';
        ctx.fillRect(u.x - 12, u.y - 16, 24 * (u.hp / u.maxHp), 3);
      });

      projs.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      });

      particles.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / 18);
        if (p.type === 'trail') {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, 3, 3);
        } else if (p.type === 'ring') {
          ctx.strokeStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (1 - p.life / 14), 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.type === 'shock') {
          ctx.strokeStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (1 - p.life / 18), 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.type === 'bolt') {
          drawBolt(ctx, p.chain, p.color);
        } else if (p.type === 'beam') {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3;
          ctx.shadowBlur = 15; ctx.shadowColor = p.color;
          ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p.ex, p.ey); ctx.stroke();
          ctx.shadowBlur = 0;
        } else if (p.type === 'debris' || p.type === 'spark' || p.type === 'slash') {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, 3, 3);
        }
        ctx.globalAlpha = 1;
      });
    }

    function drawBolt(ctx, chain, color) {
      if (chain.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.shadowBlur = 18;
      ctx.shadowColor = color;
      ctx.beginPath();
      for (let i = 1; i < chain.length; i++) {
        const a = chain[i - 1];
        const b = chain[i];
        drawBoltSegment(ctx, a.x, a.y, b.x, b.y, 1);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    function drawBoltSegment(ctx, x1, y1, x2, y2, depth) {
      const dist = Math.hypot(x2 - x1, y2 - y1);
      if (dist < 10 || depth <= 0) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        return;
      }
      let midX = (x1 + x2) / 2;
      let midY = (y1 + y2) / 2;
      const offset = Math.max(6, dist * 0.25);
      midX += (Math.random() - 0.5) * offset;
      midY += (Math.random() - 0.5) * offset;
      drawBoltSegment(ctx, x1, y1, midX, midY, depth - 1);
      drawBoltSegment(ctx, midX, midY, x2, y2, depth - 1);
    }

    function click(x, y) {
      if (!active || !buildType) return;
      if (x > 120) return;
      const def = UNITS[buildType];
      if (!def || money < def.cost) return;
      money -= def.cost;
      spawnUnit(buildType);
    }

    return {
      init,
      update,
      draw,
      click,
      startWave,
      setBuild: (k) => { buildType = k; },
      deselect: () => { buildType = null; },
      stop: () => { submitBestWave(); },
      conf: { towers: UNITS },
      get wave(){return wave;},
      get money(){return money;},
      get lives(){return lives;},
      get bestWave(){return bestWave;},
      get sel(){return null;},
      get buildMode(){return buildType;}
    };
  })();
  window.ReverseGame = Reverse;
})(window);
