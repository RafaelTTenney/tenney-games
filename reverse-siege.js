import { getHighScore, submitHighScore } from './score-store.js';

/* BREACH COMMAND (AI OPPONENT) */
(function(global){
  const Reverse = (function(){
    const CELL = 40;
    let COLS, ROWS;

    const UNITS = {
      runner: { name:'RUNNER', cost:35, color:'#6ee7b7', hp:60, spd:3.2, dmg:6, range:26, rate:12, breach:12, role:'runner', desc:'Fast breach unit focused on core damage.' },
      raider: { name:'RAIDER', cost:60, color:'#7dd3fc', hp:90, spd:2.6, dmg:10, range:30, rate:16, breach:10, role:'breaker', desc:'Skirmisher that harasses nearby towers.' },
      brute:  { name:'BRUTE',  cost:95, color:'#fb7185', hp:220, spd:1.5, dmg:22, range:38, rate:26, breach:18, armor:0.3, role:'breaker', desc:'Armored breaker with heavy tower damage.' },
      siege:  { name:'SIEGE',  cost:170, color:'#fbbf24', hp:320, spd:1.1, dmg:32, range:60, rate:32, breach:30, bonus:1.5, role:'breaker', desc:'Siege rig that melts fortified nodes.' },
      hacker: { name:'HACKER', cost:140, color:'#c77dff', hp:120, spd:2.0, dmg:4, range:90, rate:22, breach:12, stun:90, role:'breaker', desc:'Disables towers briefly while attacking.' },
      bomber: { name:'BOMBER', cost:150, color:'#f97316', hp:140, spd:2.1, dmg:0, range:20, rate:1, breach:14, explode:100, role:'breaker', desc:'Explodes on contact, damaging nearby towers.' },
      ghost:  { name:'GHOST',  cost:120, color:'#d1fae5', hp:75, spd:3.0, dmg:8, range:26, rate:14, breach:16, stealth:0.6, role:'runner', desc:'Harder to target; slips past defenses.' }
    };

    const TOWER_TYPES = {
      laser: { name:'LASER', cost:120, color:'#ff4d6d', range:200, dmg:6, rate:6, hp:140, beam:true },
      cannon:{ name:'CANNON',cost:160, color:'#ffd166', range:170, dmg:24, rate:42, hp:180, aoe:70 },
      tesla: { name:'TESLA', cost:180, color:'#ffe95a', range:150, dmg:12, rate:26, hp:160, chain:3 },
      flak:  { name:'FLAK',  cost:140, color:'#4d96ff', range:230, dmg:9, rate:14, hp:150, slow:0.5 },
      sniper:{ name:'SNIPER',cost:200, color:'#a855f7', range:280, dmg:34, rate:60, hp:120 },
      burner:{ name:'BURNER',cost:130, color:'#fb923c', range:120, dmg:4, rate:8, hp:160, cone:true }
    };

    const GAME_ID = 'tower-reverse';
    let canvas, ctx;
    let grid = [];
    let flowMap = {};
    let units = [];
    let towers = [];
    let projs = [];
    let particles = [];

    let startNode, endNode;
    let wave = 1;
    let money = 260;
    let lives = 30;
    let baseMax = 140;
    let baseHp = 140;
    let bestWave = 0;
    let submitted = false;
    let buildType = null;
    let frame = 0;

    let aiCredits = 0;
    let aiCooldown = 0;

    const upgradeState = {
      dmg: 0,
      spd: 0,
      hp: 0,
      armor: 0
    };

    function init(c) {
      canvas = c;
      ctx = c.getContext('2d');
      COLS = Math.floor(canvas.width / CELL);
      ROWS = Math.floor(canvas.height / CELL);
      startNode = { x: 0, y: Math.floor(ROWS / 2) };
      endNode = { x: COLS - 1, y: Math.floor(ROWS / 2) };
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
      baseMax = 140;
      baseHp = baseMax;
      aiCredits = 240;
      aiCooldown = 0;
      units = [];
      projs = [];
      particles = [];
      towers = [];
      buildType = null;
      frame = 0;
      submitted = false;
      upgradeState.dmg = 0;
      upgradeState.spd = 0;
      upgradeState.hp = 0;
      upgradeState.armor = 0;
      grid = new Array(COLS).fill(0).map(() => new Array(ROWS).fill(null));
      recalcFlow();
      loadBestWave();
    }

    function recalcFlow() {
      flowMap = {};
      const q = [endNode];
      const cameFrom = {};
      cameFrom[`${endNode.x},${endNode.y}`] = null;

      while (q.length) {
        const curr = q.shift();
        const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
        dirs.forEach(d => {
          const nx = curr.x + d[0];
          const ny = curr.y + d[1];
          const key = `${nx},${ny}`;
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) return;
          if (grid[nx][ny]) return;
          if (key in cameFrom) return;
          cameFrom[key] = curr;
          flowMap[key] = { x: curr.x, y: curr.y };
          q.push({ x: nx, y: ny });
        });
      }
      return (`${startNode.x},${startNode.y}` in cameFrom);
    }

    function getUpgradeCost(attr) {
      const lvl = upgradeState[attr] || 0;
      const base = 120;
      return Math.floor(base * Math.pow(1.6, lvl));
    }

    function applyUpgradeToUnit(unit) {
      unit.baseSpd *= 1 + (upgradeState.spd * 0.08);
      unit.spd = unit.baseSpd;
      unit.dmg *= 1 + (upgradeState.dmg * 0.18);
      unit.maxHp *= 1 + (upgradeState.hp * 0.22);
      unit.hp = unit.maxHp;
      unit.armor = Math.min(0.6, (unit.armor || 0) + upgradeState.armor * 0.06);
    }

    function upgrade(attr) {
      if (!upgradeState.hasOwnProperty(attr)) return false;
      const cost = getUpgradeCost(attr);
      if (money < cost) return false;
      money -= cost;
      upgradeState[attr] += 1;
      units.forEach(unit => applyUpgradeToUnit(unit));
      return true;
    }

    function getUpgradeState() {
      return {
        dmg: { level: upgradeState.dmg, cost: getUpgradeCost('dmg') },
        spd: { level: upgradeState.spd, cost: getUpgradeCost('spd') },
        hp: { level: upgradeState.hp, cost: getUpgradeCost('hp') },
        armor: { level: upgradeState.armor, cost: getUpgradeCost('armor') }
      };
    }

    function spawnUnit(type) {
      const def = UNITS[type];
      if (!def) return;
      const jitter = (Math.random() - 0.5) * 20;
      const unit = {
        x: startNode.x * CELL + CELL / 2,
        y: startNode.y * CELL + CELL / 2 + jitter,
        hp: def.hp,
        maxHp: def.hp,
        spd: def.spd,
        baseSpd: def.spd,
        dmg: def.dmg,
        range: def.range,
        rate: def.rate,
        breach: def.breach,
        bonus: def.bonus || 1,
        armor: def.armor || 0,
        stun: def.stun || 0,
        explode: def.explode || 0,
        stealth: def.stealth || 1,
        role: def.role,
        color: def.color,
        type,
        cd: 0,
        slowTimer: 0
      };
      if (upgradeState.dmg || upgradeState.spd || upgradeState.hp || upgradeState.armor) {
        applyUpgradeToUnit(unit);
      }
      units.push(unit);
    }

    function canPlaceTower(gx, gy) {
      if (gx <= 1 || gx >= COLS - 2 || gy <= 1 || gy >= ROWS - 2) return false;
      if (grid[gx][gy]) return false;
      if (gx === startNode.x && gy === startNode.y) return false;
      if (gx === endNode.x && gy === endNode.y) return false;
      return true;
    }

    function attemptBuildTower() {
      const types = Object.keys(TOWER_TYPES);
      const pick = types[Math.floor(Math.random() * types.length)];
      const def = TOWER_TYPES[pick];
      if (aiCredits < def.cost) return false;

      for (let attempt = 0; attempt < 16; attempt++) {
        const gx = Math.floor(Math.random() * COLS);
        const gy = Math.floor(Math.random() * ROWS);
        if (!canPlaceTower(gx, gy)) continue;
        grid[gx][gy] = { temp: true };
        const valid = recalcFlow();
        if (!valid) {
          grid[gx][gy] = null;
          recalcFlow();
          continue;
        }
        const tower = {
          gx,
          gy,
          x: gx * CELL + CELL / 2,
          y: gy * CELL + CELL / 2,
          type: pick,
          name: def.name,
          color: def.color,
          range: def.range,
          dmg: def.dmg * (1 + wave * 0.15),
          rate: Math.max(6, Math.floor(def.rate * (1 - wave * 0.02))),
          aoe: def.aoe || 0,
          chain: def.chain || 0,
          slow: def.slow || 0,
          beam: !!def.beam,
          cone: !!def.cone,
          hp: Math.floor(def.hp * (1 + wave * 0.25)),
          maxHp: Math.floor(def.hp * (1 + wave * 0.25)),
          cd: Math.floor(Math.random() * 12),
          stun: 0
        };
        grid[gx][gy] = tower;
        towers.push(tower);
        aiCredits -= def.cost;
        return true;
      }
      return false;
    }

    function startWave() {
      aiCredits += 240 + wave * 140;
      baseMax = 140 + wave * 70;
      baseHp = baseMax;
      money += 140 + wave * 60;
      aiCooldown = 30;
    }

    function findTowerTarget(u) {
      let best = null;
      let bestDist = Infinity;
      towers.forEach(t => {
        if (t.hp <= 0) return;
        const range = t.range * (u.stealth || 1);
        const d = Math.hypot(t.x - u.x, t.y - u.y);
        if (d <= range && d < bestDist) {
          best = t;
          bestDist = d;
        }
      });
      return best;
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
      units.forEach(u => {
        if (Math.hypot(u.x - x, u.y - y) < r) {
          u.hp -= dmg * 0.6;
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

    function update() {
      frame++;
      if (lives <= 0) {
        submitBestWave();
        return;
      }

      money += 0.05 + wave * 0.006;

      if (aiCooldown > 0) aiCooldown--;
      if (aiCooldown === 0 && aiCredits >= 120) {
        const built = attemptBuildTower();
        aiCooldown = built ? Math.max(12, 40 - wave * 2) : 20;
      }

      for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i];
        if (u.slowTimer > 0) u.slowTimer--;
        u.spd = u.slowTimer > 0 ? u.baseSpd * 0.6 : u.baseSpd;

        const towerTarget = (u.role === 'breaker') ? findTowerTarget(u) : null;
        if (towerTarget) {
          if (u.cd > 0) {
            u.cd--;
          } else {
            if (u.type === 'bomber' && u.explode) {
              explode(u.x, u.y, u.explode, u.dmg || 0, 1.4);
              u.hp = 0;
            } else {
              const damage = u.dmg * (u.bonus || 1);
              towerTarget.hp -= damage;
              if (u.stun) towerTarget.stun = Math.max(towerTarget.stun, u.stun);
              particles.push({ type:'slash', x: towerTarget.x, y: towerTarget.y, life: 10, color: u.color });
            }
            u.cd = u.rate;
          }
        } else {
          const gx = Math.floor(u.x / CELL);
          const gy = Math.floor(u.y / CELL);
          const next = flowMap[`${gx},${gy}`];
          if (next) {
            const tx = next.x * CELL + CELL / 2;
            const ty = next.y * CELL + CELL / 2;
            const dx = tx - u.x;
            const dy = ty - u.y;
            const d = Math.hypot(dx, dy);
            if (d < u.spd) {
              u.x = tx;
              u.y = ty;
            } else {
              u.x += (dx / d) * u.spd;
              u.y += (dy / d) * u.spd;
            }
          } else if (gx === endNode.x && gy === endNode.y) {
            baseHp -= u.breach;
            money += 10;
            units.splice(i, 1);
            continue;
          }
        }

        if (u.hp <= 0) {
          lives--;
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
          money += 35 + wave * 5;
          grid[t.gx][t.gy] = null;
          recalcFlow();
          for (let k = 0; k < 10; k++) {
            particles.push({ type:'debris', x:t.x, y:t.y, vx:(Math.random()-0.5)*6, vy:(Math.random()-0.5)*6, life:22, color:t.color });
          }
          towers.splice(i, 1);
          continue;
        }

        if (t.stun > 0) { t.stun--; continue; }
        if (t.cd > 0) { t.cd--; continue; }

        const target = units.find(u => Math.hypot(u.x - t.x, u.y - t.y) < t.range * (u.stealth || 1));
        if (target) {
          if (t.beam) {
            applyTowerDamage(target, t.dmg);
            particles.push({ type:'beam', sx:t.x, sy:t.y, ex:target.x, ey:target.y, color:t.color, life:6 });
            t.cd = t.rate;
          } else if (t.chain) {
            chainStrike(t, target);
            t.cd = t.rate;
          } else if (t.cone) {
            units.forEach(u => {
              if (Math.hypot(u.x - t.x, u.y - t.y) < t.range) {
                applyTowerDamage(u, t.dmg);
              }
            });
            particles.push({ type:'ring', x:t.x, y:t.y, life:12, color:t.color, r:t.range });
            t.cd = t.rate;
          } else {
            projs.push({ x:t.x, y:t.y, tx:target.x, ty:target.y, dmg:t.dmg, spd:9, aoe:t.aoe, slow:t.slow, color:t.color });
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
        wave++;
        money += 150 + wave * 40;
        lives += 5;
        aiCredits += 160 + wave * 60;
        baseMax = 140 + wave * 70;
        baseHp = baseMax;
        units = [];
        projs = [];
        if (wave > bestWave) bestWave = wave;
      }
    }

    function draw(ctx) {
      const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      bg.addColorStop(0, '#04070d');
      bg.addColorStop(1, '#120514');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath();
      for (let x = 0; x <= COLS; x++) { ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, canvas.height); }
      for (let y = 0; y <= ROWS; y++) { ctx.moveTo(0, y * CELL); ctx.lineTo(canvas.width, y * CELL); }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0,255,204,0.45)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      let cursor = { x: startNode.x, y: startNode.y };
      ctx.moveTo(cursor.x * CELL + CELL / 2, cursor.y * CELL + CELL / 2);
      const maxSteps = COLS * ROWS;
      let steps = 0;
      while (steps++ < maxSteps) {
        const next = flowMap[`${cursor.x},${cursor.y}`];
        ctx.lineTo(cursor.x * CELL + CELL / 2, cursor.y * CELL + CELL / 2);
        if (!next) break;
        cursor = next;
      }
      ctx.stroke();
      ctx.lineWidth = 1;

      const baseX = (COLS - 1) * CELL;
      ctx.fillStyle = 'rgba(255,0,120,0.18)';
      ctx.fillRect(baseX, 0, CELL, canvas.height);
      ctx.strokeStyle = 'rgba(255,0,120,0.6)';
      ctx.strokeRect(baseX, 0, CELL, canvas.height);
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
        if (u.type === 'runner' || u.type === 'ghost') {
          ctx.beginPath();
          ctx.moveTo(10, 0);
          ctx.lineTo(-8, 7);
          ctx.lineTo(-8, -7);
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
        } else if (p.type === 'ring' || p.type === 'shock') {
          ctx.strokeStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (1 - p.life / 14), 0, Math.PI * 2);
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
      if (!buildType) return;
      if (x > 140) return;
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
      upgrade,
      getUpgradeState,
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
