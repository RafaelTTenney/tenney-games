import { getHighScore, submitHighScore } from './score-store.js';

/* BREACH COMMAND (SIGNAL DOMINION) */
(function(global){
  const Reverse = (function(){
    const CELL = 40;
    let COLS, ROWS;
    let canvas, ctx;

    const UNITS = {
      spark: { name:'SPARK', cost:30, color:'#22d3ee', hp:55, spd:3.4, dmg:5, range:26, rate:12, capture:1.4, desc:'Fast node runner that accelerates capture.' },
      skirmish: { name:'SKIRMISH', cost:55, color:'#7dd3fc', hp:85, spd:2.6, dmg:12, range:34, rate:18, capture:1.0, desc:'Balanced assault unit for towers and nodes.' },
      breaker: { name:'BREAKER', cost:90, color:'#fb7185', hp:180, spd:1.7, dmg:24, range:40, rate:28, capture:0.6, armor:0.25, desc:'Armored tower breaker.' },
      prism: { name:'PRISM', cost:115, color:'#c084fc', hp:110, spd:2.1, dmg:6, range:90, rate:22, capture:0.9, disrupt:120, desc:'Pulse disruptor that jams tower fire.' },
      viper: { name:'VIPER', cost:140, color:'#f59e0b', hp:75, spd:3.6, dmg:10, range:26, rate:10, capture:1.3, stealth:0.6, desc:'Hard to track infiltrator for rapid flips.' },
      medic: { name:'MEDIC', cost:120, color:'#a7f3d0', hp:130, spd:2.0, dmg:4, range:80, rate:24, capture:0.7, heal:8, desc:'Repairs nearby allies under fire.' }
    };

    const TOWER_TYPES = {
      prism: { name:'PRISM', cost:140, color:'#38bdf8', range:190, dmg:7, rate:6, hp:150, beam:true },
      mortar:{ name:'MORTAR', cost:170, color:'#fbbf24', range:210, dmg:28, rate:46, hp:170, aoe:70 },
      chain: { name:'CHAIN', cost:180, color:'#facc15', range:150, dmg:12, rate:24, hp:160, chain:3 },
      snare: { name:'SNARE', cost:150, color:'#60a5fa', range:220, dmg:9, rate:16, hp:150, slow:0.5 },
      glare: { name:'GLARE', cost:160, color:'#fb7185', range:120, dmg:4, rate:8, hp:160, cone:true }
    };

    const ABILITIES = {
      emp: { name:'JAMMER FIELD', cost:180, cooldown:700, radius:170, debuff:0.55 },
      overclock: { name:'SURGE PUSH', cost:140, cooldown:520, duration:320, spd:0.45, dmg:0.35 },
      decoy: { name:'DROP POD', cost:120, cooldown:480, count:4, type:'spark' },
      strike: { name:'BLACKOUT', cost:240, cooldown:900, radius:150, dmg:140 }
    };

    const GAME_ID = 'tower-reverse';

    let grid = [];
    let units = [];
    let towers = [];
    let projs = [];
    let particles = [];
    let nodes = [];
    let buildType = null;
    let frame = 0;

    let wave = 1;
    let money = 240;
    let integrity = 100;
    let dominance = 0;
    let bestWave = 0;
    let submitted = false;

    let aiCredits = 200;
    let aiCooldown = 0;
    let aiUpgradeCooldown = 0;

    const upgradeState = { dmg: 0, spd: 0, hp: 0, armor: 0 };
    const abilityState = {
      emp: { cooldown: 0, timer: 0, radius: 0 },
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
      dominance = 0;
      aiCredits = 220;
      aiCooldown = 0;
      aiUpgradeCooldown = 120;
      frame = 0;
      submitted = false;
      upgradeState.dmg = 0;
      upgradeState.spd = 0;
      upgradeState.hp = 0;
      upgradeState.armor = 0;
      abilityState.emp.cooldown = 0;
      abilityState.emp.timer = 0;
      abilityState.decoy.cooldown = 0;
      abilityState.strike.cooldown = 0;
      abilityState.overclock.cooldown = 0;
      abilityState.overclock.timer = 0;
      units = [];
      towers = [];
      projs = [];
      particles = [];
      nodes = buildNodes();
      grid = new Array(COLS).fill(0).map(() => new Array(ROWS).fill(null));
      loadBestWave();
      seedTowers();
    }

    function buildNodes() {
      const midX = Math.floor(COLS * 0.55);
      const midY = Math.floor(ROWS * 0.5);
      const positions = [
        { x: midX - 6, y: midY - 4 },
        { x: midX + 2, y: midY + 1 },
        { x: midX - 2, y: midY + 5 }
      ];
      return positions.map((p, idx) => ({
        id: `node-${idx}-${Date.now()}`,
        x: p.x * CELL + CELL / 2,
        y: p.y * CELL + CELL / 2,
        radius: 90,
        control: 0,
        owner: 'neutral'
      }));
    }

    function seedTowers() {
      for (let i = 0; i < 4; i++) {
        attemptBuildTower(true);
      }
    }

    function getUpgradeCost(attr) {
      const lvl = upgradeState[attr] || 0;
      return Math.floor(120 * Math.pow(1.6, lvl));
    }

    function applyUpgradeToUnit(unit) {
      unit.baseSpd *= 1 + (upgradeState.spd * 0.09);
      unit.spd = unit.baseSpd;
      unit.dmg *= 1 + (upgradeState.dmg * 0.2);
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

    function spawnUnit(type, record, x, y) {
      const def = UNITS[type];
      if (!def) return;
      const unit = {
        x: x ?? 80,
        y: y ?? (canvas.height * 0.5 + (Math.random() - 0.5) * 40),
        hp: def.hp,
        maxHp: def.hp,
        spd: def.spd,
        baseSpd: def.spd,
        dmg: def.dmg,
        range: def.range,
        rate: def.rate,
        armor: def.armor || 0,
        heal: def.heal || 0,
        disrupt: def.disrupt || 0,
        capture: def.capture || 1,
        stealth: def.stealth || 1,
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
      return true;
    }

    function attemptBuildTower(force) {
      if (!force && aiCredits < 120) return false;
      const keys = Object.keys(TOWER_TYPES);
      const pick = keys[Math.floor(Math.random() * keys.length)];
      const def = TOWER_TYPES[pick];
      if (!force && aiCredits < def.cost) return false;

      let best = null;
      let bestScore = -Infinity;
      nodes.forEach(node => {
        for (let i = 0; i < 18; i++) {
          const gx = Math.max(2, Math.min(COLS - 3, Math.floor(node.x / CELL) + Math.floor((Math.random() - 0.5) * 6)));
          const gy = Math.max(2, Math.min(ROWS - 3, Math.floor(node.y / CELL) + Math.floor((Math.random() - 0.5) * 6)));
          if (!canPlaceTower(gx, gy)) continue;
          const dist = Math.hypot(gx * CELL - node.x, gy * CELL - node.y);
          const score = (Math.random() * 2) + (200 - dist);
          if (score > bestScore) {
            bestScore = score;
            best = { gx, gy };
          }
        }
      });
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
        hp: Math.floor(def.hp * (1 + wave * 0.22)),
        maxHp: Math.floor(def.hp * (1 + wave * 0.22)),
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
      const cost = Math.floor(90 * Math.pow(1.6, target.level));
      if (aiCredits < cost) return false;
      target.level += 1;
      target.dmg *= 1.22;
      target.range *= 1.04;
      target.rate = Math.max(4, Math.floor(target.rate * 0.92));
      target.maxHp = Math.floor(target.maxHp * 1.18);
      target.hp = Math.min(target.hp + target.maxHp * 0.2, target.maxHp);
      aiCredits -= cost;
      return true;
    }

    function applyTowerDamage(unit, dmg) {
      const final = dmg * (1 - (unit.armor || 0));
      unit.hp -= final;
      particles.push({ type:'spark', x:unit.x, y:unit.y, life:10, color:unit.color });
    }

    function explode(x, y, r, dmg) {
      particles.push({ type:'shock', x, y, life:18, color:'#ff8866', r });
      towers.forEach(t => {
        if (Math.hypot(t.x - x, t.y - y) < r) t.hp -= dmg;
      });
      units.forEach(u => {
        if (Math.hypot(u.x - x, u.y - y) < r) u.hp -= dmg * 0.6;
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
      particles.push({ type:'bolt', chain, color:'#facc15', life:6 });
    }

    function useAbility(key) {
      const ability = ABILITIES[key];
      const state = abilityState[key];
      if (!ability || !state) return false;
      if (state.cooldown > 0 || money < ability.cost) return false;
      money -= ability.cost;
      state.cooldown = ability.cooldown;

      if (key === 'emp') {
        abilityState.emp.timer = 260;
        abilityState.emp.radius = ability.radius;
        particles.push({ type:'ring', x: canvas.width * 0.6, y: canvas.height * 0.5, life:28, color:'#38bdf8', r:ability.radius });
      }
      if (key === 'overclock') {
        abilityState.overclock.timer = ability.duration;
      }
      if (key === 'decoy') {
        for (let i = 0; i < ability.count; i++) {
          spawnUnit(ability.type, false, 120 + Math.random() * 80, canvas.height * 0.5 + (Math.random() - 0.5) * 120);
        }
      }
      if (key === 'strike') {
        const center = { x: canvas.width * 0.55, y: canvas.height * 0.5 };
        explode(center.x, center.y, ability.radius, ability.dmg);
      }
      return true;
    }

    function startWave() {
      money += 140 + wave * 50;
      aiCredits += 160 + wave * 60;
      aiCooldown = 10;
      aiUpgradeCooldown = 100;
    }

    function updateNodes() {
      nodes.forEach(n => {
        let player = 0;
        let ai = 0;
        units.forEach(u => {
          if (Math.hypot(u.x - n.x, u.y - n.y) < n.radius) player += u.capture;
        });
        towers.forEach(t => {
          if (Math.hypot(t.x - n.x, t.y - n.y) < n.radius) ai += 1;
        });
        if (player !== ai) {
          n.control += (player - ai) * 0.0028;
          n.control = Math.max(-1, Math.min(1, n.control));
        }
        if (n.control >= 0.7) n.owner = 'player';
        else if (n.control <= -0.7) n.owner = 'ai';
        else n.owner = 'neutral';
      });
    }

    function pickTargetNode(u) {
      let target = null;
      let best = Infinity;
      nodes.forEach(n => {
        if (n.owner === 'player') return;
        const d = Math.hypot(n.x - u.x, n.y - u.y);
        if (d < best) { best = d; target = n; }
      });
      if (!target) {
        nodes.forEach(n => {
          const d = Math.hypot(n.x - u.x, n.y - u.y);
          if (d < best) { best = d; target = n; }
        });
      }
      return target;
    }

    function update() {
      frame++;
      if (integrity <= 0) {
        submitBestWave();
        return;
      }

      if (abilityState.emp.cooldown > 0) abilityState.emp.cooldown--;
      if (abilityState.overclock.cooldown > 0) abilityState.overclock.cooldown--;
      if (abilityState.decoy.cooldown > 0) abilityState.decoy.cooldown--;
      if (abilityState.strike.cooldown > 0) abilityState.strike.cooldown--;
      if (abilityState.emp.timer > 0) abilityState.emp.timer--;
      if (abilityState.overclock.timer > 0) abilityState.overclock.timer--;

      updateNodes();

      const playerNodes = nodes.filter(n => n.owner === 'player').length;
      const aiNodes = nodes.filter(n => n.owner === 'ai').length;
      if (playerNodes !== aiNodes) {
        dominance += (playerNodes - aiNodes) * 0.06;
        dominance = Math.max(0, Math.min(100, dominance));
      } else {
        dominance = Math.max(0, dominance - 0.02);
      }

      if (aiNodes > playerNodes) integrity = Math.max(0, integrity - 0.03 * (aiNodes - playerNodes));

      money += 0.05 + playerNodes * 0.04;
      aiCredits += 0.04 + aiNodes * 0.04;

      if (aiCooldown > 0) aiCooldown--;
      if (aiUpgradeCooldown > 0) aiUpgradeCooldown--;
      if (aiCooldown === 0 && aiCredits >= 120) {
        const built = attemptBuildTower();
        aiCooldown = built ? Math.max(14, 44 - wave * 2) : 24;
      }
      if (aiUpgradeCooldown === 0 && aiCredits >= 90) {
        const upgraded = attemptUpgradeTower();
        aiUpgradeCooldown = upgraded ? Math.max(90, 200 - wave * 6) : 120;
      }

      const surgeOn = abilityState.overclock.timer > 0;
      const spdMult = surgeOn ? 1 + ABILITIES.overclock.spd : 1;
      const dmgMult = surgeOn ? 1 + ABILITIES.overclock.dmg : 1;
      const jammerOn = abilityState.emp.timer > 0;

      for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i];
        if (u.slowTimer > 0) u.slowTimer--;
        u.spd = (u.slowTimer > 0 ? u.baseSpd * 0.6 : u.baseSpd) * spdMult;

        if (u.heal && frame % 30 === 0) {
          units.forEach(o => {
            if (Math.hypot(o.x - u.x, o.y - u.y) < u.range) {
              o.hp = Math.min(o.maxHp, o.hp + u.heal);
            }
          });
        }

        let attackTarget = null;
        towers.forEach(t => {
          if (t.hp <= 0) return;
          const d = Math.hypot(t.x - u.x, t.y - u.y);
          if (d < u.range && (!attackTarget || d < attackTarget.dist)) {
            attackTarget = { t, dist: d };
          }
        });

        if (attackTarget) {
          if (u.cd > 0) {
            u.cd--;
          } else {
            if (u.disrupt) attackTarget.t.stun = Math.max(attackTarget.t.stun, u.disrupt);
            attackTarget.t.hp -= u.dmg * dmgMult;
            particles.push({ type:'slash', x: attackTarget.t.x, y: attackTarget.t.y, life: 10, color: u.color });
            u.cd = u.rate;
          }
        } else {
          const targetNode = pickTargetNode(u);
          const tx = targetNode ? targetNode.x : canvas.width * 0.6;
          const ty = targetNode ? targetNode.y : canvas.height * 0.5;
          const dx = tx - u.x;
          const dy = ty - u.y;
          const mag = Math.hypot(dx, dy) || 1;
          const strafe = Math.sin((frame + i) * 0.05) * 0.4;
          u.x += (dx / mag + strafe) * u.spd;
          u.y += (dy / mag - strafe) * u.spd;
        }

        if (u.hp <= 0) {
          for (let k = 0; k < 6; k++) {
            particles.push({ type:'spark', x:u.x, y:u.y, vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4, life:18, color:u.color });
          }
          units.splice(i, 1);
          continue;
        }
      }

      for (let i = towers.length - 1; i >= 0; i--) {
        const t = towers[i];
        if (t.hp <= 0) {
          money += 25 + wave * 4;
          grid[t.gx][t.gy] = null;
          for (let k = 0; k < 10; k++) {
            particles.push({ type:'debris', x:t.x, y:t.y, vx:(Math.random()-0.5)*6, vy:(Math.random()-0.5)*6, life:22, color:t.color });
          }
          towers.splice(i, 1);
          continue;
        }

        if (t.stun > 0) { t.stun--; continue; }
        if (t.cd > 0) { t.cd--; continue; }

        let effectiveRange = t.range;
        if (jammerOn && Math.hypot(t.x - canvas.width * 0.6, t.y - canvas.height * 0.5) < abilityState.emp.radius) {
          effectiveRange *= ABILITIES.emp.debuff;
        }

        const target = units.find(u => Math.hypot(u.x - t.x, u.y - t.y) < effectiveRange * (u.stealth || 1));
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
              if (Math.hypot(u.x - t.x, u.y - t.y) < effectiveRange) {
                applyTowerDamage(u, t.dmg);
              }
            });
            particles.push({ type:'ring', x:t.x, y:t.y, life:12, color:t.color, r:effectiveRange });
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

      if (dominance >= 100) {
        wave++;
        money += 180 + wave * 40;
        integrity = Math.min(100, integrity + 15);
        aiCredits += 180 + wave * 60;
        dominance = 0;
        nodes = buildNodes();
        units = [];
        projs = [];
        particles.push({ type:'ring', x: canvas.width * 0.6, y: canvas.height * 0.5, life:60, color:'#34d399', r:260 });
        if (wave > bestWave) bestWave = wave;
      }
    }

    function drawNode(ctx, node) {
      ctx.save();
      ctx.translate(node.x, node.y);
      const pulse = Math.sin(frame * 0.06) * 4;
      ctx.strokeStyle = node.owner === 'player' ? '#22d3ee' : (node.owner === 'ai' ? '#fb7185' : '#64748b');
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, node.radius + pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.rotate(frame * 0.01);
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.lineTo(18, 12);
      ctx.lineTo(-18, 12);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.restore();

      const barW = 60;
      ctx.strokeStyle = '#111827';
      ctx.strokeRect(node.x - barW / 2, node.y + node.radius + 10, barW, 6);
      ctx.fillStyle = '#22d3ee';
      const pct = (node.control + 1) / 2;
      ctx.fillRect(node.x - barW / 2, node.y + node.radius + 10, barW * pct, 6);
    }

    function draw(ctx) {
      const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      bg.addColorStop(0, '#02141c');
      bg.addColorStop(1, '#071018');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(56,189,248,0.05)';
      ctx.beginPath();
      for (let x = 0; x <= COLS; x++) { ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, canvas.height); }
      for (let y = 0; y <= ROWS; y++) { ctx.moveTo(0, y * CELL); ctx.lineTo(canvas.width, y * CELL); }
      ctx.stroke();

      nodes.forEach(n => drawNode(ctx, n));

      towers.forEach(t => {
        ctx.save();
        ctx.translate(t.x, t.y);
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(-12, -12, 24, 24);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = t.color;
        ctx.fillRect(-4, -4, 8, 8);
        ctx.restore();

        const hpPct = Math.max(0, t.hp / t.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(t.x - 16, t.y - 24, 32, 4);
        ctx.fillStyle = '#fb7185';
        ctx.fillRect(t.x - 16, t.y - 24, 32 * hpPct, 4);
      });

      units.forEach(u => {
        ctx.save();
        ctx.translate(u.x, u.y);
        ctx.rotate(Math.atan2(u.spd, 1));
        ctx.fillStyle = u.color;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-8, 6);
        ctx.lineTo(-8, -6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        const hpPct = Math.max(0, u.hp / u.maxHp);
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(u.x - 12, u.y - 18, 24, 3);
        ctx.fillStyle = '#22d3ee';
        ctx.fillRect(u.x - 12, u.y - 18, 24 * hpPct, 3);
      });

      projs.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
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
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.moveTo(p.sx, p.sy);
          ctx.lineTo(p.ex, p.ey);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (p.type === 'ring') {
          ctx.strokeStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.life / 40);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (p.type === 'bolt') {
          drawBolt(ctx, p.chain, p.color);
        }
      });

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`SIGNAL ${Math.floor(integrity)}%`, 30, 30);
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(30, 38, Math.max(0, dominance), 6);
      ctx.strokeStyle = '#0f172a';
      ctx.strokeRect(30, 38, 100, 6);
    }

    function drawBolt(ctx, chain, color) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < chain.length - 1; i++) {
        const a = chain[i];
        const b = chain[i + 1];
        drawBoltSegment(ctx, a.x, a.y, b.x, b.y, 1);
      }
      ctx.stroke();
      ctx.lineWidth = 1;
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
      if (x < 140) return;
      const def = UNITS[buildType];
      if (!def || money < def.cost) return;
      money -= def.cost;
      spawnUnit(buildType, true, x, y);
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
      getHud: () => ({
        labels: ['DOMINANCE', 'CREDITS', 'SIGNAL'],
        values: [`${Math.floor(dominance)}%`, Math.floor(money), `${Math.floor(integrity)}%`]
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
  window.ReverseDuelGame = Reverse;
})(window);
