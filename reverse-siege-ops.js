import { getHighScore, submitHighScore } from './score-store.js';

/* BREACH COMMAND (SIEGE OPS) */
(function(global){
  const Reverse = (function(){
    const CELL = 40;
    let COLS, ROWS;

    const UNITS = {
      runner: { name:'RUNNER', cost:45, color:'#6ee7b7', hp:70, spd:2.8, dmg:6, range:26, rate:14, breach:12, role:'runner', desc:'Fast breach unit focused on core damage.' },
      raider: { name:'RAIDER', cost:70, color:'#7dd3fc', hp:110, spd:2.2, dmg:12, range:32, rate:18, breach:12, role:'breaker', desc:'Skirmisher that harasses nearby towers.' },
      brute:  { name:'BRUTE',  cost:120, color:'#fb7185', hp:280, spd:1.2, dmg:26, range:40, rate:28, breach:22, armor:0.35, role:'breaker', desc:'Armored breaker with heavy tower damage.' },
      siege:  { name:'SIEGE',  cost:210, color:'#fbbf24', hp:380, spd:0.95, dmg:38, range:70, rate:34, breach:34, bonus:1.6, role:'breaker', desc:'Siege rig that melts fortified nodes.' },
      hacker: { name:'HACKER', cost:170, color:'#c77dff', hp:140, spd:1.7, dmg:5, range:100, rate:26, breach:12, stun:110, role:'breaker', desc:'Disables towers briefly while attacking.' },
      bomber: { name:'BOMBER', cost:180, color:'#f97316', hp:160, spd:1.7, dmg:0, range:20, rate:1, breach:16, explode:120, role:'breaker', desc:'Explodes on contact, damaging nearby towers.' },
      ghost:  { name:'GHOST',  cost:150, color:'#d1fae5', hp:85, spd:2.6, dmg:9, range:26, rate:16, breach:16, stealth:0.55, role:'runner', desc:'Harder to target; slips past defenses.' },
      medic:  { name:'MEDIC',  cost:140, color:'#a7f3d0', hp:150, spd:1.9, dmg:5, range:80, rate:24, breach:8, heal:10, role:'support', desc:'Repairs allied attackers in a radius.' }
    };

    const TOWER_TYPES = {
      laser: { name:'LASER', cost:120, color:'#ff4d6d', range:200, dmg:6, rate:6, hp:140, beam:true },
      cannon:{ name:'CANNON',cost:160, color:'#ffd166', range:170, dmg:24, rate:42, hp:180, aoe:70 },
      tesla: { name:'TESLA', cost:180, color:'#ffe95a', range:150, dmg:12, rate:26, hp:160, chain:3 },
      flak:  { name:'FLAK',  cost:140, color:'#4d96ff', range:230, dmg:9, rate:14, hp:150, slow:0.5 },
      sniper:{ name:'SNIPER',cost:200, color:'#a855f7', range:280, dmg:34, rate:60, hp:120 },
      burner:{ name:'BURNER',cost:130, color:'#fb923c', range:120, dmg:4, rate:8, hp:160, cone:true }
    };

    const ABILITIES = {
      emp: { name:'EMP', cost:260, cooldown:1100, radius:180, stun:200 },
      overclock: { name:'OVERCLOCK', cost:220, cooldown:900, duration:420, dmg:0.35, spd:0.28 },
      decoy: { name:'DECOY SWARM', cost:160, cooldown:800, count:5, type:'runner' },
      strike: { name:'ORBITAL STRIKE', cost:300, cooldown:1400, radius:150, dmg:160 }
    };

    const GAME_ID = 'tower-reverse-siege';
    let canvas, ctx;
    let grid = [];
    let units = [];
    let towers = [];
    let projs = [];
    let particles = [];

    let startNode, endNode;
    let wave = 1;
    let money = 220;
    let lives = 25;
    let baseMax = 180;
    let baseHp = 180;
    let bestWave = 0;
    let submitted = false;
    let buildType = null;
    let frame = 0;

    let aiCredits = 0;
    let aiCooldown = 0;
    let aiUpgradeCooldown = 0;

    const upgradeState = { dmg: 0, spd: 0, hp: 0, armor: 0 };
    const abilityState = {
      emp: { cooldown: 0 },
      overclock: { cooldown: 0, timer: 0 },
      decoy: { cooldown: 0 },
      strike: { cooldown: 0 }
    };

    const spawnHistory = [];

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
      money = 220;
      lives = 25;
      baseMax = 180;
      baseHp = baseMax;
      aiCredits = 260;
      aiCooldown = 0;
      aiUpgradeCooldown = 80;
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
      abilityState.emp.cooldown = 0;
      abilityState.overclock.cooldown = 0;
      abilityState.overclock.timer = 0;
      abilityState.decoy.cooldown = 0;
      abilityState.strike.cooldown = 0;
      spawnHistory.length = 0;
      grid = new Array(COLS).fill(0).map(() => new Array(ROWS).fill(null));
      loadBestWave();
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
      unit.hp = Math.min(unit.hp, unit.maxHp);
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

    function getCommandState() {
      return {
        upgrades: getUpgradeState(),
        abilities: {
          emp: { cooldown: abilityState.emp.cooldown, cost: ABILITIES.emp.cost },
          overclock: { cooldown: abilityState.overclock.cooldown, cost: ABILITIES.overclock.cost },
          decoy: { cooldown: abilityState.decoy.cooldown, cost: ABILITIES.decoy.cost },
          strike: { cooldown: abilityState.strike.cooldown, cost: ABILITIES.strike.cost }
        },
        aiCredits
      };
    }

    function spawnUnit(type, record) {
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
        heal: def.heal || 0,
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
      if (record) spawnHistory.push({ type, frame });
    }

    function canPlaceTower(gx, gy) {
      if (gx <= 1 || gx >= COLS - 2 || gy <= 1 || gy >= ROWS - 2) return false;
      if (grid[gx][gy]) return false;
      if (gx === startNode.x && gy === startNode.y) return false;
      if (gx === endNode.x && gy === endNode.y) return false;
      return true;
    }

    function pickTowerType() {
      const counts = { runner: 1, breaker: 1, support: 1 };
      spawnHistory.forEach(s => {
        const role = UNITS[s.type]?.role || 'runner';
        counts[role] = (counts[role] || 0) + 1;
      });
      const weights = {
        laser: 1 + counts.runner * 0.6,
        sniper: 1 + counts.runner * 0.9,
        flak: 1 + counts.runner * 0.7,
        cannon: 1 + counts.breaker * 0.8,
        tesla: 1 + counts.support * 0.5 + counts.breaker * 0.4,
        burner: 1 + counts.breaker * 0.6
      };
      const entries = Object.entries(weights);
      const total = entries.reduce((sum, [,w]) => sum + w, 0);
      let roll = Math.random() * total;
      for (const [key, weight] of entries) {
        roll -= weight;
        if (roll <= 0) return key;
      }
      return 'laser';
    }

    function attemptBuildTower() {
      const pick = pickTowerType();
      const def = TOWER_TYPES[pick];
      if (aiCredits < def.cost) return false;

      let best = null;
      let bestScore = -Infinity;
      for (let attempt = 0; attempt < 40; attempt++) {
        const gx = Math.floor(Math.random() * COLS);
        const gy = Math.floor(Math.random() * ROWS);
        if (!canPlaceTower(gx, gy)) continue;
        const dx = gx - endNode.x;
        const dy = gy - endNode.y;
        const distCore = Math.hypot(dx, dy);
        const distStart = Math.hypot(gx - startNode.x, gy - startNode.y);
        const density = towers.reduce((acc, t) => acc + (Math.hypot(t.gx - gx, t.gy - gy) < 3 ? 1 : 0), 0);
        const score = (8 - Math.min(8, distCore)) + (Math.random() * 1.5) - density * 0.8 + (distStart * 0.05);
        if (score > bestScore) {
          bestScore = score;
          best = { gx, gy };
        }
      }
      if (!best) return false;

      const tower = {
        gx: best.gx,
        gy: best.gy,
        x: best.gx * CELL + CELL / 2,
        y: best.gy * CELL + CELL / 2,
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
        level: 1,
        cd: Math.floor(Math.random() * 12),
        stun: 0
      };
      grid[best.gx][best.gy] = tower;
      towers.push(tower);
      aiCredits -= def.cost;
      return true;
    }

    function attemptUpgradeTower() {
      if (!towers.length) return false;
      const target = towers[Math.floor(Math.random() * towers.length)];
      if (!target) return false;
      const cost = Math.floor(80 * Math.pow(1.6, target.level));
      if (aiCredits < cost) return false;
      target.level += 1;
      target.dmg *= 1.25;
      target.range *= 1.05;
      target.rate = Math.max(4, Math.floor(target.rate * 0.92));
      target.maxHp = Math.floor(target.maxHp * 1.2);
      target.hp = Math.min(target.hp + target.maxHp * 0.2, target.maxHp);
      aiCredits -= cost;
      return true;
    }

    function startWave() {
      aiCredits += 260 + wave * 160;
      baseMax = 180 + wave * 80;
      baseHp = baseMax;
      money += 120 + wave * 50;
      aiCooldown = 26;
      aiUpgradeCooldown = 80;
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

    function useAbility(key) {
      const ability = ABILITIES[key];
      const state = abilityState[key];
      if (!ability || !state) return false;
      if (state.cooldown > 0 || money < ability.cost) return false;
      money -= ability.cost;
      state.cooldown = ability.cooldown;

      if (key === 'emp') {
        const center = findTowerCluster(ability.radius);
        towers.forEach(t => {
          if (Math.hypot(t.x - center.x, t.y - center.y) < ability.radius) {
            t.stun = Math.max(t.stun, ability.stun);
          }
        });
        particles.push({ type:'shock', x:center.x, y:center.y, life:26, color:'#7dd3fc', r:ability.radius });
      }

      if (key === 'overclock') {
        abilityState.overclock.timer = ability.duration;
      }

      if (key === 'decoy') {
        for (let i = 0; i < ability.count; i++) {
          spawnUnit(ability.type, false);
        }
      }

      if (key === 'strike') {
        const center = findTowerCluster(ability.radius);
        explode(center.x, center.y, ability.radius, ability.dmg, 1.6);
      }
      return true;
    }

    function findTowerCluster(radius) {
      if (!towers.length) {
        return { x: endNode.x * CELL + CELL / 2, y: endNode.y * CELL + CELL / 2 };
      }
      let best = towers[0];
      let bestCount = -1;
      towers.forEach(t => {
        let count = 0;
        towers.forEach(o => {
          if (Math.hypot(o.x - t.x, o.y - t.y) < radius) count++;
        });
        if (count > bestCount) {
          best = t;
          bestCount = count;
        }
      });
      return { x: best.x, y: best.y };
    }

    function update() {
      frame++;
      if (lives <= 0) {
        submitBestWave();
        return;
      }

      money += 0.03 + wave * 0.004;
      aiCredits += 0.05 + wave * 0.012;

      if (abilityState.emp.cooldown > 0) abilityState.emp.cooldown--;
      if (abilityState.overclock.cooldown > 0) abilityState.overclock.cooldown--;
      if (abilityState.decoy.cooldown > 0) abilityState.decoy.cooldown--;
      if (abilityState.strike.cooldown > 0) abilityState.strike.cooldown--;
      if (abilityState.overclock.timer > 0) abilityState.overclock.timer--;

      while (spawnHistory.length && frame - spawnHistory[0].frame > 600) {
        spawnHistory.shift();
      }

      if (aiCooldown > 0) aiCooldown--;
      if (aiUpgradeCooldown > 0) aiUpgradeCooldown--;
      if (aiCooldown === 0 && aiCredits >= 120) {
        const built = attemptBuildTower();
        aiCooldown = built ? Math.max(14, 48 - wave * 1.2) : 24;
      }
      if (aiUpgradeCooldown === 0 && aiCredits >= 90) {
        const upgraded = attemptUpgradeTower();
        aiUpgradeCooldown = upgraded ? Math.max(70, 160 - wave * 4) : 110;
      }

      const coreX = endNode.x * CELL + CELL / 2;
      const coreY = endNode.y * CELL + CELL / 2;
      const overclockOn = abilityState.overclock.timer > 0;
      const overclockDmg = overclockOn ? 1 + ABILITIES.overclock.dmg : 1;
      const overclockSpd = overclockOn ? 1 + ABILITIES.overclock.spd : 1;

      for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i];
        if (u.slowTimer > 0) u.slowTimer--;
        u.spd = (u.slowTimer > 0 ? u.baseSpd * 0.6 : u.baseSpd) * overclockSpd;

        if (u.heal && frame % 30 === 0) {
          units.forEach(o => {
            if (Math.hypot(o.x - u.x, o.y - u.y) < u.range) {
              o.hp = Math.min(o.maxHp, o.hp + u.heal);
            }
          });
        }

        const towerTarget = (u.role === 'breaker') ? findTowerTarget(u) : null;
        if (towerTarget) {
          if (u.cd > 0) {
            u.cd--;
          } else {
            if (u.type === 'bomber' && u.explode) {
              explode(u.x, u.y, u.explode, u.dmg || 0, 1.4);
              u.hp = 0;
            } else {
              const damage = u.dmg * (u.bonus || 1) * overclockDmg;
              towerTarget.hp -= damage;
              if (u.stun) towerTarget.stun = Math.max(towerTarget.stun, u.stun);
              particles.push({ type:'slash', x: towerTarget.x, y: towerTarget.y, life: 10, color: u.color });
            }
            u.cd = u.rate;
          }
        } else {
          let vx = coreX - u.x;
          let vy = coreY - u.y;
          let mag = Math.hypot(vx, vy) || 1;
          vx /= mag;
          vy /= mag;

          let repelX = 0;
          let repelY = 0;
          towers.forEach(t => {
            const dx = u.x - t.x;
            const dy = u.y - t.y;
            const d = Math.hypot(dx, dy);
            if (d > 0 && d < 90) {
              const strength = (90 - d) / 90;
              repelX += (dx / d) * strength;
              repelY += (dy / d) * strength;
            }
          });

          let sepX = 0;
          let sepY = 0;
          units.forEach(o => {
            if (o === u) return;
            const dx = u.x - o.x;
            const dy = u.y - o.y;
            const d = Math.hypot(dx, dy);
            if (d > 0 && d < 18) {
              sepX += dx / d;
              sepY += dy / d;
            }
          });

          const jitter = (Math.random() - 0.5) * 0.2;
          const moveX = vx + repelX + sepX * 0.2 + jitter;
          const moveY = vy + repelY + sepY * 0.2 + jitter;
          const moveMag = Math.hypot(moveX, moveY) || 1;
          u.x += (moveX / moveMag) * u.spd;
          u.y += (moveY / moveMag) * u.spd;

          if (Math.hypot(u.x - coreX, u.y - coreY) < 24) {
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

      const timeShift = Math.sin(frame * 0.01) * 0.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.beginPath();
      for (let x = 0; x <= COLS; x++) { ctx.moveTo(x * CELL + timeShift, 0); ctx.lineTo(x * CELL + timeShift, canvas.height); }
      for (let y = 0; y <= ROWS; y++) { ctx.moveTo(0, y * CELL + timeShift); ctx.lineTo(canvas.width, y * CELL + timeShift); }
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0,255,204,0.12)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(startNode.x * CELL + CELL / 2, startNode.y * CELL + CELL / 2);
      ctx.lineTo(endNode.x * CELL + CELL / 2, endNode.y * CELL + CELL / 2);
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
        } else if (u.type === 'medic') {
          ctx.beginPath();
          ctx.arc(0, 0, 9, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(-4, 0); ctx.lineTo(4, 0);
          ctx.moveTo(0, -4); ctx.lineTo(0, 4);
          ctx.stroke();
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
      spawnUnit(buildType, true);
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
      getCommandState,
      castAbility: useAbility,
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
      window.ReverseSiegeOpsGame = Reverse;
})(window);
