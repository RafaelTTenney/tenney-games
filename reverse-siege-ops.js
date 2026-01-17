import { getHighScore, submitHighScore } from './score-store.js';

/* BREACH COMMAND (CONVOY RUN) */
(function(global){
  const Reverse = (function(){
    const CELL = 40;
    let COLS, ROWS;
    let canvas, ctx;

    const UNITS = {
      scout:  { name:'SCOUT', cost:40, color:'#22d3ee', hp:60, spd:2.8, dmg:6, range:60, rate:18, supply:1, desc:'Fast escort that chases nearby turrets.' },
      guard:  { name:'GUARD', cost:70, color:'#a7f3d0', hp:120, spd:2.0, dmg:12, range:70, rate:20, supply:2, desc:'Balanced convoy guard unit.' },
      breaker:{ name:'BREAKER', cost:120, color:'#fb7185', hp:220, spd:1.6, dmg:28, range:80, rate:26, armor:0.35, supply:3, desc:'Armored tower breaker for heavy defenses.' },
      medic:  { name:'MEDIC', cost:90, color:'#c4f2ff', hp:110, spd:1.8, dmg:4, range:90, rate:24, heal:10, supply:2, desc:'Support drone that repairs escorts.' },
      sniper: { name:'SNIPER', cost:140, color:'#f8fafc', hp:90, spd:1.7, dmg:30, range:160, rate:36, supply:2, desc:'Long-range convoy overwatch.' },
      ward:   { name:'WARD', cost:160, color:'#fbbf24', hp:160, spd:1.5, dmg:8, range:120, rate:28, shield:0.2, supply:3, desc:'Shield drone that dampens tower damage.' }
    };

    const TOWER_TYPES = {
      rail:  { name:'RAIL', cost:140, color:'#f97316', range:200, dmg:10, rate:10, hp:150, beam:true },
      mortar:{ name:'MORTAR', cost:170, color:'#fbbf24', range:180, dmg:26, rate:46, hp:170, aoe:70 },
      tesla: { name:'TESLA', cost:190, color:'#fde68a', range:150, dmg:12, rate:24, hp:160, chain:3 },
      flak:  { name:'FLAK', cost:140, color:'#4d96ff', range:230, dmg:9, rate:14, hp:150, slow:0.5 },
      burner:{ name:'BURNER', cost:150, color:'#fb7185', range:120, dmg:4, rate:8, hp:160, cone:true }
    };

    const ABILITIES = {
      emp: { name:'EMP', cost:220, cooldown:900, radius:180, stun:200 },
      overclock: { name:'OVERCLOCK', cost:200, cooldown:800, duration:360, dmg:0.4, spd:0.3 },
      decoy: { name:'DECOY FLOCK', cost:160, cooldown:700, count:4, type:'scout' },
      strike: { name:'ARTILLERY', cost:280, cooldown:1200, radius:150, dmg:160 }
    };

    const GAME_ID = 'tower-reverse-siege';

    let grid = [];
    let units = [];
    let towers = [];
    let projs = [];
    let particles = [];

    let wave = 1;
    let money = 240;
    let integrity = 100;
    let bestWave = 0;
    let submitted = false;
    let buildType = null;
    let frame = 0;

    let aiCredits = 240;
    let aiCooldown = 0;
    let aiUpgradeCooldown = 0;

    let supplyCap = 8;
    let supplyUsed = 0;

    let carrier = null;
    let waypoints = [];
    let gates = [];
    let unlocked = { tier1: false, tier2: false, tier3: false };
    let inTransit = false;

    const upgradeState = { dmg: 0, spd: 0, hp: 0, armor: 0 };
    const abilityState = {
      emp: { cooldown: 0 },
      overclock: { cooldown: 0, timer: 0 },
      decoy: { cooldown: 0 },
      strike: { cooldown: 0 }
    };

    function init(c) {
      canvas = c;
      ctx = c.getContext('2d');
      COLS = Math.floor(canvas.width / CELL);
      ROWS = Math.floor(canvas.height / CELL);
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
      money = 240;
      integrity = 100;
      aiCredits = 260;
      aiCooldown = 0;
      aiUpgradeCooldown = 80;
      supplyCap = 8;
      supplyUsed = 0;
      units = [];
      towers = [];
      projs = [];
      particles = [];
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
      unlocked = { tier1: true, tier2: false, tier3: false };
      carrier = {
        x: 80,
        y: canvas.height / 2,
        hp: 520,
        maxHp: 520,
        spd: 0.9,
        shield: 0
      };
      waypoints = [{ x: canvas.width - 120, y: canvas.height / 2 }];
      gates = buildGates();
      inTransit = false;
      grid = new Array(COLS).fill(0).map(() => new Array(ROWS).fill(null));
      loadBestWave();
      seedTowers();
    }

    function buildGates() {
      return [
        { x: canvas.width * 0.35, y: canvas.height * 0.35, radius: 60, tier: 1, active: true },
        { x: canvas.width * 0.55, y: canvas.height * 0.65, radius: 60, tier: 2, active: true },
        { x: canvas.width * 0.75, y: canvas.height * 0.5, radius: 60, tier: 3, active: true }
      ];
    }

    function isUnitUnlocked(type) {
      if (type === 'scout' || type === 'guard' || type === 'medic') return true;
      if ((type === 'breaker' || type === 'sniper') && unlocked.tier2) return true;
      if (type === 'ward' && unlocked.tier3) return true;
      return false;
    }

    function canBuild(type) {
      const def = UNITS[type];
      if (!def || !isUnitUnlocked(type)) return false;
      return supplyUsed + (def.supply || 1) <= supplyCap;
    }

    function getUpgradeCost(attr) {
      const lvl = upgradeState[attr] || 0;
      return Math.floor(120 * Math.pow(1.6, lvl));
    }

    function applyUpgradeToUnit(unit) {
      unit.baseSpd *= 1 + (upgradeState.spd * 0.06);
      unit.spd = unit.baseSpd;
      unit.dmg *= 1 + (upgradeState.dmg * 0.16);
      unit.maxHp *= 1 + (upgradeState.hp * 0.2);
      unit.hp = Math.min(unit.hp, unit.maxHp);
      unit.armor = Math.min(0.6, (unit.armor || 0) + upgradeState.armor * 0.05);
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
        aiCredits,
        supplyCap,
        supplyUsed
      };
    }

    function spawnUnit(type) {
      const def = UNITS[type];
      if (!def) return;
      const unit = {
        x: carrier.x + (Math.random() - 0.5) * 30,
        y: carrier.y + (Math.random() - 0.5) * 30,
        hp: def.hp,
        maxHp: def.hp,
        spd: def.spd,
        baseSpd: def.spd,
        dmg: def.dmg,
        range: def.range,
        rate: def.rate,
        armor: def.armor || 0,
        heal: def.heal || 0,
        shield: def.shield || 0,
        supply: def.supply || 1,
        color: def.color,
        type,
        cd: 0,
        slowTimer: 0
      };
      if (upgradeState.dmg || upgradeState.spd || upgradeState.hp || upgradeState.armor) {
        applyUpgradeToUnit(unit);
      }
      units.push(unit);
      supplyUsed += unit.supply;
    }

    function canPlaceTower(gx, gy) {
      if (gx <= 1 || gx >= COLS - 2 || gy <= 1 || gy >= ROWS - 2) return false;
      if (grid[gx][gy]) return false;
      return true;
    }

    function attemptBuildTower(force) {
      const keys = Object.keys(TOWER_TYPES);
      const pick = keys[Math.floor(Math.random() * keys.length)];
      const def = TOWER_TYPES[pick];
      if (!force && aiCredits < def.cost) return false;
      let best = null;
      let bestScore = -Infinity;
      for (let i = 0; i < 20; i++) {
        const gx = 2 + Math.floor(Math.random() * (COLS - 4));
        const gy = 2 + Math.floor(Math.random() * (ROWS - 4));
        if (!canPlaceTower(gx, gy)) continue;
        const dx = gx * CELL - carrier.x;
        const dy = gy * CELL - carrier.y;
        const score = (Math.random() * 4) + Math.hypot(dx, dy) * 0.2;
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
        dmg: def.dmg * (1 + wave * 0.12),
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

    function seedTowers() {
      for (let i = 0; i < 5; i++) {
        attemptBuildTower(true);
      }
    }

    function attemptUpgradeTower() {
      if (!towers.length) return false;
      const target = towers[Math.floor(Math.random() * towers.length)];
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

    function applyTowerDamage(unit, dmg) {
      const final = dmg * (1 - (unit.armor || 0)) * (1 - (unit.shield || 0));
      unit.hp -= final;
      particles.push({ type:'spark', x:unit.x, y:unit.y, life:10, color:unit.color });
    }

    function explode(x, y, r, dmg) {
      particles.push({ type:'shock', x, y, life:18, color:'#ff8866', r });
      towers.forEach(t => {
        if (Math.hypot(t.x - x, t.y - y) < r) t.hp -= dmg;
      });
    }

    function useAbility(key) {
      const ability = ABILITIES[key];
      const state = abilityState[key];
      if (!ability || !state) return false;
      if (state.cooldown > 0 || money < ability.cost) return false;
      money -= ability.cost;
      state.cooldown = ability.cooldown;

      if (key === 'emp') {
        towers.forEach(t => {
          if (Math.hypot(t.x - carrier.x, t.y - carrier.y) < ability.radius) t.stun = Math.max(t.stun, ability.stun);
        });
        particles.push({ type:'ring', x:carrier.x, y:carrier.y, life:26, color:'#93c5fd', r:ability.radius });
      }

      if (key === 'overclock') {
        abilityState.overclock.timer = ability.duration;
      }

      if (key === 'decoy') {
        for (let i = 0; i < ability.count; i++) {
          spawnUnit(ability.type);
        }
      }

      if (key === 'strike') {
        const target = towers[0];
        const cx = target ? target.x : carrier.x + 200;
        const cy = target ? target.y : carrier.y;
        explode(cx, cy, ability.radius, ability.dmg);
      }
      return true;
    }

    function startWave() {
      inTransit = true;
      money += 160 + wave * 60;
      aiCredits += 140 + wave * 50;
      aiCooldown = 12;
      aiUpgradeCooldown = 80;
    }

    function updateWaypoints() {
      if (!inTransit) return;
      if (!waypoints.length) return;
      const target = waypoints[0];
      const dx = target.x - carrier.x;
      const dy = target.y - carrier.y;
      const d = Math.hypot(dx, dy);
      if (d < 8) {
        waypoints.shift();
        if (!waypoints.length) inTransit = false;
        return;
      }
      carrier.x += (dx / d) * carrier.spd;
      carrier.y += (dy / d) * carrier.spd;
    }

    function updateGates() {
      gates.forEach(g => {
        if (!g.active) return;
        if (Math.hypot(carrier.x - g.x, carrier.y - g.y) < g.radius) {
          g.active = false;
          if (g.tier === 1) { unlocked.tier2 = true; supplyCap += 2; }
          if (g.tier === 2) { unlocked.tier3 = true; supplyCap += 2; }
          if (g.tier === 3) { supplyCap += 2; }
          money += 120;
          particles.push({ type:'ring', x:g.x, y:g.y, life:30, color:'#22c55e', r:g.radius });
        }
      });
    }

    function update() {
      frame++;
      if (integrity <= 0) {
        submitBestWave();
        return;
      }

      money += 0.04;
      aiCredits += 0.04 + wave * 0.01;

      if (abilityState.emp.cooldown > 0) abilityState.emp.cooldown--;
      if (abilityState.overclock.cooldown > 0) abilityState.overclock.cooldown--;
      if (abilityState.decoy.cooldown > 0) abilityState.decoy.cooldown--;
      if (abilityState.strike.cooldown > 0) abilityState.strike.cooldown--;
      if (abilityState.overclock.timer > 0) abilityState.overclock.timer--;

      if (aiCooldown > 0) aiCooldown--;
      if (aiUpgradeCooldown > 0) aiUpgradeCooldown--;
      if (aiCooldown === 0 && aiCredits >= 120) {
        const built = attemptBuildTower();
        aiCooldown = built ? Math.max(12, 40 - wave * 2) : 20;
      }
      if (aiUpgradeCooldown === 0 && aiCredits >= 90) {
        const upgraded = attemptUpgradeTower();
        aiUpgradeCooldown = upgraded ? Math.max(90, 200 - wave * 6) : 120;
      }

      updateWaypoints();
      updateGates();

      const overclockOn = abilityState.overclock.timer > 0;
      const spdMult = overclockOn ? 1 + ABILITIES.overclock.spd : 1;
      const dmgMult = overclockOn ? 1 + ABILITIES.overclock.dmg : 1;

      for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i];
        if (u.slowTimer > 0) u.slowTimer--;
        u.spd = (u.slowTimer > 0 ? u.baseSpd * 0.65 : u.baseSpd) * spdMult;
        if (u.heal && frame % 30 === 0) {
          units.forEach(o => {
            if (Math.hypot(o.x - u.x, o.y - u.y) < u.range) {
              o.hp = Math.min(o.maxHp, o.hp + u.heal);
            }
          });
        }

        let target = null;
        let best = Infinity;
        towers.forEach(t => {
          if (t.hp <= 0) return;
          const d = Math.hypot(t.x - u.x, t.y - u.y);
          if (d < u.range && d < best) { target = t; best = d; }
        });

        if (target) {
          if (u.cd > 0) {
            u.cd--;
          } else {
            target.hp -= u.dmg * dmgMult;
            particles.push({ type:'slash', x: target.x, y: target.y, life: 10, color: u.color });
            u.cd = u.rate;
          }
        } else {
          const orbitX = carrier.x + Math.cos((frame + i * 30) * 0.02) * 50;
          const orbitY = carrier.y + Math.sin((frame + i * 30) * 0.02) * 50;
          const dx = orbitX - u.x;
          const dy = orbitY - u.y;
          const d = Math.hypot(dx, dy) || 1;
          u.x += (dx / d) * u.spd;
          u.y += (dy / d) * u.spd;
        }

        if (u.hp <= 0) {
          supplyUsed = Math.max(0, supplyUsed - (u.supply || 1));
          units.splice(i, 1);
        }
      }

      for (let i = towers.length - 1; i >= 0; i--) {
        const t = towers[i];
        if (t.hp <= 0) {
          money += 30 + wave * 4;
          grid[t.gx][t.gy] = null;
          towers.splice(i, 1);
          continue;
        }

        if (t.stun > 0) { t.stun--; continue; }
        if (t.cd > 0) { t.cd--; continue; }

        const distCarrier = Math.hypot(carrier.x - t.x, carrier.y - t.y);
        let target = null;
        if (distCarrier < t.range) {
          target = carrier;
        } else {
          target = units.find(u => Math.hypot(u.x - t.x, u.y - t.y) < t.range);
        }

        if (target) {
          if (target === carrier) {
            carrier.hp -= t.dmg * 0.7;
            particles.push({ type:'beam', sx:t.x, sy:t.y, ex:carrier.x, ey:carrier.y, color:t.color, life:6 });
            t.cd = t.rate;
          } else if (t.chain) {
            applyTowerDamage(target, t.dmg);
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
            projs.push({ x:t.x, y:t.y, tx:target.x, ty:target.y, dmg:t.dmg, spd:8, aoe:t.aoe, slow:t.slow, color:t.color });
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

      if (carrier.hp <= 0) {
        integrity -= 20;
        carrier.hp = carrier.maxHp;
        inTransit = false;
      }

      if (carrier.x > canvas.width - 80) {
        wave++;
        money += 200 + wave * 60;
        carrier.x = 80;
        carrier.y = canvas.height / 2;
        carrier.hp = carrier.maxHp;
        waypoints = [{ x: canvas.width - 120, y: canvas.height / 2 }];
        gates = buildGates();
        inTransit = false;
        towers = [];
        projs = [];
        particles.push({ type:'ring', x: canvas.width - 120, y: canvas.height / 2, life:40, color:'#22c55e', r:180 });
        seedTowers();
        if (wave > bestWave) bestWave = wave;
      }
    }

    function draw(ctx) {
      ctx.fillStyle = '#0b120f';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(34,197,94,0.08)';
      ctx.beginPath();
      for (let y = 0; y <= canvas.height; y += 40) {
        ctx.moveTo(0, y + Math.sin((frame + y) * 0.01) * 6);
        ctx.lineTo(canvas.width, y + Math.sin((frame + y) * 0.01) * 6);
      }
      ctx.stroke();

      gates.forEach(g => {
        if (!g.active) return;
        ctx.strokeStyle = 'rgba(34,197,94,0.45)';
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.radius, 0, Math.PI * 2);
        ctx.stroke();
      });

      towers.forEach(t => {
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(t.x - 12, t.y - 12, 24, 24);
        ctx.fill();
        ctx.stroke();
      });

      ctx.fillStyle = '#94a3b8';
      ctx.beginPath();
      ctx.arc(carrier.x, carrier.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#e2e8f0';
      ctx.stroke();

      units.forEach(u => {
        ctx.fillStyle = u.color;
        ctx.beginPath();
        ctx.arc(u.x, u.y, 6, 0, Math.PI * 2);
        ctx.fill();
      });

      projs.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
      });

      particles.forEach(p => {
        if (p.type === 'spark') {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, 2, 2);
        } else if (p.type === 'trail') {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.life / 12);
          ctx.fillRect(p.x, p.y, 2, 2);
          ctx.globalAlpha = 1;
        } else if (p.type === 'beam') {
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = 0.7;
          ctx.beginPath();
          ctx.moveTo(p.sx, p.sy);
          ctx.lineTo(p.ex, p.ey);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (p.type === 'ring') {
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      });

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`CONVOY ${Math.floor(carrier.hp)}/${carrier.maxHp}`, 30, 30);
      ctx.fillText(`SUPPLY ${supplyUsed}/${supplyCap}`, 30, 50);
    }

    function click(x, y) {
      if (buildType) {
        if (x < 140) return;
        const def = UNITS[buildType];
        if (!def || money < def.cost) return;
        if (!canBuild(buildType)) return;
        money -= def.cost;
        spawnUnit(buildType);
        return;
      }
      if (x < 140) return;
      waypoints.push({ x, y });
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
      canBuild,
      getHud: () => ({
        labels: ['PHASE', 'CREDITS', 'CONVOY'],
        values: [`RUN ${wave}`, Math.floor(money), `${Math.floor(carrier.hp)}`]
      }),
      castAbility: useAbility,
      stop: () => { submitBestWave(); },
      conf: { towers: UNITS },
      get wave(){return wave;},
      get money(){return money;},
      get lives(){return Math.floor(integrity);},
      get bestWave(){return bestWave;},
      get sel(){return null;},
      get buildMode(){return buildType;}
    };
  })();
  window.ReverseSiegeOpsGame = Reverse;
})(window);
