import { getHighScore, submitHighScore } from './score-store.js';

/* BREACH COMMAND (RAIL SURGE) */
(function(global){
  const Reverse = (function(){
    const LANES = 5;
    let laneY = [];
    let laneH = 0;
    let canvas, ctx;

    const UNITS = {
      spark:  { name:'SPARK', cost:26, color:'#fef08a', hp:50, spd:4.2, dmg:6, range:28, rate:10, breach:12, desc:'Hyper-fast lane runner built for reactor hits.' },
      striker:{ name:'STRIKER', cost:55, color:'#fb7185', hp:90, spd:3.2, dmg:14, range:32, rate:16, breach:14, desc:'Reliable lane brawler with solid damage.' },
      breaker:{ name:'BREAKER', cost:90, color:'#f97316', hp:180, spd:2.1, dmg:26, range:40, rate:26, breach:22, armor:0.3, desc:'Armored assault that shreds gate towers.' },
      arc:    { name:'ARC', cost:120, color:'#60a5fa', hp:100, spd:2.8, dmg:8, range:110, rate:20, breach:10, shock:70, desc:'Arc pulse that stuns nearby towers.' },
      phantom:{ name:'PHANTOM', cost:130, color:'#e9d5ff', hp:70, spd:4.0, dmg:10, range:26, rate:12, breach:18, stealth:0.55, desc:'Ghost runner that slips through fire.' },
      medic:  { name:'MEDIC', cost:110, color:'#a7f3d0', hp:120, spd:2.7, dmg:4, range:90, rate:22, breach:8, heal:8, desc:'Support unit that heals lane allies.' }
    };

    const TOWER_TYPES = {
      rail:  { name:'RAIL', cost:120, color:'#fde68a', range:320, dmg:14, rate:30, hp:120, beam:true },
      shard: { name:'SHARD', cost:140, color:'#f59e0b', range:220, dmg:24, rate:38, hp:150, aoe:60 },
      snare: { name:'SNARE', cost:120, color:'#93c5fd', range:260, dmg:10, rate:16, hp:130, slow:0.55 },
      sweeper:{ name:'SWEEPER', cost:170, color:'#fda4af', range:180, dmg:18, rate:20, hp:160, sweep:true },
      glare: { name:'GLARE', cost:130, color:'#fb7185', range:140, dmg:5, rate:8, hp:150, cone:true }
    };

    const ABILITIES = {
      emp: { name:'ION DUST', cost:160, cooldown:520, radius:160, stun:160 },
      overclock: { name:'REDLINE', cost:140, cooldown:420, duration:260, dmg:0.5, spd:0.5 },
      decoy: { name:'SURGE PACK', cost:120, cooldown:420, count:3, type:'spark' },
      strike: { name:'FLASH STRIKE', cost:210, cooldown:780, radius:140, dmg:150 }
    };

    const GAME_ID = 'tower-reverse-overdrive';

    let units = [];
    let towers = [];
    let projs = [];
    let particles = [];
    let storms = [];

    let wave = 1;
    let money = 320;
    let reactor = 140;
    let bestWave = 0;
    let submitted = false;
    let buildType = null;
    let frame = 0;

    let aiCredits = 260;
    let aiCooldown = 0;
    let aiUpgradeCooldown = 0;

    let heat = 0;
    let combo = 0;
    let stageHits = 0;
    let stageGoal = 16;

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
      laneH = canvas.height / LANES;
      laneY = Array.from({ length: LANES }, (_, i) => (i + 0.5) * laneH);
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
      money = 320;
      reactor = 140;
      aiCredits = 240;
      aiCooldown = 0;
      aiUpgradeCooldown = 80;
      heat = 0;
      combo = 0;
      stageHits = 0;
      stageGoal = 16;
      units = [];
      towers = [];
      projs = [];
      particles = [];
      storms = [];
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
      loadBestWave();
      seedTowers();
    }

    function seedTowers() {
      for (let i = 0; i < 6; i++) {
        attemptBuildTower(true);
      }
    }

    function getUpgradeCost(attr) {
      const lvl = upgradeState[attr] || 0;
      return Math.floor(110 * Math.pow(1.55, lvl));
    }

    function applyUpgradeToUnit(unit) {
      unit.baseSpd *= 1 + (upgradeState.spd * 0.1);
      unit.spd = unit.baseSpd;
      unit.dmg *= 1 + (upgradeState.dmg * 0.22);
      unit.maxHp *= 1 + (upgradeState.hp * 0.24);
      unit.hp = Math.min(unit.hp, unit.maxHp);
      unit.armor = Math.min(0.6, (unit.armor || 0) + upgradeState.armor * 0.08);
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

    function spawnUnit(type, lane) {
      const def = UNITS[type];
      if (!def) return;
      const unit = {
        x: 60,
        y: laneY[lane] + (Math.random() - 0.5) * 10,
        lane,
        hp: def.hp,
        maxHp: def.hp,
        spd: def.spd,
        baseSpd: def.spd,
        dmg: def.dmg,
        range: def.range,
        rate: def.rate,
        breach: def.breach,
        armor: def.armor || 0,
        heal: def.heal || 0,
        shock: def.shock || 0,
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
      heat = Math.min(160, heat + 6);
    }

    function attemptBuildTower(force) {
      const keys = Object.keys(TOWER_TYPES);
      const pick = keys[Math.floor(Math.random() * keys.length)];
      const def = TOWER_TYPES[pick];
      if (!force && aiCredits < def.cost) return false;
      const lane = Math.floor(Math.random() * LANES);
      const slot = Math.floor(Math.random() * 8);
      const x = 280 + slot * 100 + Math.random() * 30;
      const tower = {
        x,
        y: laneY[lane],
        lane,
        type: pick,
        name: def.name,
        color: def.color,
        range: def.range,
        dmg: def.dmg * (1 + wave * 0.1),
        rate: Math.max(6, Math.floor(def.rate * (1 - wave * 0.015))),
        aoe: def.aoe || 0,
        slow: def.slow || 0,
        beam: !!def.beam,
        cone: !!def.cone,
        sweep: !!def.sweep,
        hp: Math.floor(def.hp * (1 + wave * 0.22)),
        maxHp: Math.floor(def.hp * (1 + wave * 0.22)),
        level: 1,
        cd: Math.floor(Math.random() * 12),
        stun: 0,
        sweepDir: Math.random() > 0.5 ? 1 : -1,
        sweepTimer: 80
      };
      towers.push(tower);
      aiCredits -= def.cost;
      return true;
    }

    function attemptUpgradeTower() {
      if (!towers.length) return false;
      const target = towers[Math.floor(Math.random() * towers.length)];
      const cost = Math.floor(80 * Math.pow(1.6, target.level));
      if (aiCredits < cost) return false;
      target.level += 1;
      target.dmg *= 1.2;
      target.range *= 1.03;
      target.rate = Math.max(4, Math.floor(target.rate * 0.93));
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

    function useAbility(key) {
      const ability = ABILITIES[key];
      const state = abilityState[key];
      if (!ability || !state) return false;
      if (state.cooldown > 0 || money < ability.cost) return false;
      money -= ability.cost;
      state.cooldown = ability.cooldown;

      if (key === 'emp') {
        const cluster = towers.slice(0).sort((a, b) => b.x - a.x)[0];
        const cx = cluster ? cluster.x : canvas.width * 0.7;
        const cy = cluster ? cluster.y : canvas.height * 0.5;
        towers.forEach(t => {
          if (Math.hypot(t.x - cx, t.y - cy) < ability.radius) t.stun = Math.max(t.stun, ability.stun);
        });
        particles.push({ type:'ring', x:cx, y:cy, life:26, color:'#93c5fd', r:ability.radius });
      }

      if (key === 'overclock') {
        abilityState.overclock.timer = ability.duration;
      }

      if (key === 'decoy') {
        for (let i = 0; i < ability.count; i++) {
          const lane = Math.floor(Math.random() * LANES);
          spawnUnit(ability.type, lane);
        }
      }

      if (key === 'strike') {
        const cluster = towers.slice(0).sort((a, b) => b.x - a.x)[0];
        const cx = cluster ? cluster.x : canvas.width * 0.7;
        const cy = cluster ? cluster.y : canvas.height * 0.5;
        towers.forEach(t => {
          if (Math.hypot(t.x - cx, t.y - cy) < ability.radius) t.hp -= ability.dmg;
        });
        particles.push({ type:'shock', x:cx, y:cy, life:20, color:'#f97316', r:ability.radius });
      }
      return true;
    }

    function startWave() {
      money += 160 + wave * 60;
      aiCredits += 140 + wave * 50;
      aiCooldown = 12;
      aiUpgradeCooldown = 80;
    }

    function update() {
      frame++;

      if (reactor <= 0) {
        wave++;
        reactor = 140 + wave * 20;
        stageHits = 0;
        stageGoal = 16 + wave * 2;
        towers = [];
        projs = [];
        storms = [];
        aiCredits += 120 + wave * 50;
        seedTowers();
        if (wave > bestWave) bestWave = wave;
      }

      money += 0.05 + combo * 0.01;
      aiCredits += 0.04 + wave * 0.01;

      if (heat > 0) heat = Math.max(0, heat - 0.04);

      if (abilityState.emp.cooldown > 0) abilityState.emp.cooldown--;
      if (abilityState.overclock.cooldown > 0) abilityState.overclock.cooldown--;
      if (abilityState.decoy.cooldown > 0) abilityState.decoy.cooldown--;
      if (abilityState.strike.cooldown > 0) abilityState.strike.cooldown--;
      if (abilityState.overclock.timer > 0) abilityState.overclock.timer--;

      if (aiCooldown > 0) aiCooldown--;
      if (aiUpgradeCooldown > 0) aiUpgradeCooldown--;
      if (aiCooldown === 0 && aiCredits >= 120) {
        const built = attemptBuildTower();
        aiCooldown = built ? Math.max(10, 36 - wave * 2) : 22;
      }
      if (aiUpgradeCooldown === 0 && aiCredits >= 90) {
        const upgraded = attemptUpgradeTower();
        aiUpgradeCooldown = upgraded ? Math.max(80, 180 - wave * 4) : 110;
      }

      if (frame % 520 === 0) {
        storms.push({ x: canvas.width + 100, speed: 2.2, life: 420, lane: Math.floor(Math.random() * LANES) });
      }

      storms.forEach((s, i) => {
        s.x -= s.speed;
        s.life--;
        if (s.life <= 0 || s.x < -200) storms.splice(i, 1);
      });

      const overclockOn = abilityState.overclock.timer > 0;
      const spdMult = overclockOn ? 1 + ABILITIES.overclock.spd : 1;
      const dmgMult = overclockOn ? 1 + ABILITIES.overclock.dmg : 1;

      for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i];
        if (u.slowTimer > 0) u.slowTimer--;
        u.spd = (u.slowTimer > 0 ? u.baseSpd * 0.65 : u.baseSpd) * spdMult * (heat > 120 ? 0.8 : 1);

        if (u.heal && frame % 30 === 0) {
          units.forEach(o => {
            if (o.lane === u.lane && Math.abs(o.x - u.x) < u.range) {
              o.hp = Math.min(o.maxHp, o.hp + u.heal);
            }
          });
        }

        let attackTarget = null;
        towers.forEach(t => {
          if (t.hp <= 0) return;
          if (t.lane !== u.lane && !t.sweep) return;
          const d = Math.abs(t.x - u.x);
          if (d < u.range && (!attackTarget || d < attackTarget.dist)) {
            attackTarget = { t, dist: d };
          }
        });

        if (attackTarget) {
          if (u.cd > 0) {
            u.cd--;
          } else {
            const damage = u.dmg * dmgMult;
            attackTarget.t.hp -= damage;
            if (u.shock) attackTarget.t.stun = Math.max(attackTarget.t.stun, u.shock);
            particles.push({ type:'slash', x: attackTarget.t.x, y: attackTarget.t.y, life: 10, color: u.color });
            u.cd = u.rate;
          }
        }

        u.x += u.spd;

        if (u.x > canvas.width - 30) {
          reactor -= u.breach;
          stageHits++;
          combo = Math.min(20, combo + 1);
          money += 10 + combo;
          units.splice(i, 1);
          continue;
        }

        if (u.hp <= 0) {
          combo = Math.max(0, combo - 2);
          units.splice(i, 1);
        }
      }

      for (let i = towers.length - 1; i >= 0; i--) {
        const t = towers[i];
        if (t.hp <= 0) {
          money += 30 + wave * 4;
          towers.splice(i, 1);
          continue;
        }

        if (t.sweep) {
          t.sweepTimer--;
          if (t.sweepTimer <= 0) {
            t.sweepTimer = 80 + Math.random() * 40;
            t.lane = Math.max(0, Math.min(LANES - 1, t.lane + t.sweepDir));
            t.y = laneY[t.lane];
            if (t.lane === 0 || t.lane === LANES - 1) t.sweepDir *= -1;
          }
        }

        if (t.stun > 0) { t.stun--; continue; }
        if (t.cd > 0) { t.cd--; continue; }

        const target = units.find(u => (t.sweep || u.lane === t.lane) && Math.abs(u.x - t.x) < t.range * (u.stealth || 1));
        if (target) {
          if (t.beam) {
            applyTowerDamage(target, t.dmg);
            particles.push({ type:'beam', sx:t.x, sy:t.y, ex:target.x, ey:target.y, color:t.color, life:6 });
            t.cd = t.rate;
          } else if (t.cone) {
            units.forEach(u => {
              if ((t.sweep || u.lane === t.lane) && Math.abs(u.x - t.x) < t.range) {
                applyTowerDamage(u, t.dmg);
              }
            });
            particles.push({ type:'ring', x:t.x, y:t.y, life:12, color:t.color, r:t.range });
            t.cd = t.rate;
          } else {
            projs.push({ x:t.x, y:t.y, tx:target.x, ty:target.y, lane:target.lane, dmg:t.dmg, spd:10, aoe:t.aoe, slow:t.slow, color:t.color });
            t.cd = t.rate;
          }
        }
      }

      for (let i = projs.length - 1; i >= 0; i--) {
        const p = projs[i];
        const dx = p.tx - p.x;
        const d = Math.abs(dx);
        if (d < p.spd) {
          if (p.aoe) {
            units.forEach(u => {
              if (u.lane === p.lane && Math.abs(u.x - p.tx) < p.aoe) {
                applyTowerDamage(u, p.dmg);
                if (p.slow) u.slowTimer = Math.max(u.slowTimer, 40);
              }
            });
            particles.push({ type:'ring', x:p.tx, y:p.ty, life:14, color:p.color, r:p.aoe });
          } else {
            const hit = units.find(u => u.lane === p.lane && Math.abs(u.x - p.tx) < 12);
            if (hit) {
              applyTowerDamage(hit, p.dmg);
              if (p.slow) hit.slowTimer = Math.max(hit.slowTimer, 40);
            }
          }
          projs.splice(i, 1);
        } else {
          p.x += Math.sign(dx) * p.spd;
          particles.push({ type:'trail', x:p.x, y:p.ty, life:10, color:p.color });
        }
      }

      storms.forEach(s => {
        units.forEach(u => {
          if (u.lane === s.lane && Math.abs(u.x - s.x) < 80) {
            u.hp -= 0.15;
          }
        });
        towers.forEach(t => {
          if (t.lane === s.lane && Math.abs(t.x - s.x) < 120) {
            t.stun = Math.max(t.stun, 12);
          }
        });
      });

      particles.forEach((p, i) => {
        p.life--;
        if (p.vx) { p.x += p.vx; p.y += p.vy; }
        if (p.life <= 0) particles.splice(i, 1);
      });

      if (stageHits >= stageGoal) {
        reactor -= 20;
        stageHits = 0;
      }
    }

    function draw(ctx) {
      ctx.fillStyle = '#1b0904';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(255,130,70,0.25)';
      for (let i = 0; i < LANES; i++) {
        ctx.beginPath();
        ctx.moveTo(0, laneY[i]);
        ctx.lineTo(canvas.width, laneY[i]);
        ctx.stroke();
      }

      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(255,140,80,${0.02 + i * 0.001})`;
        ctx.fillRect((i * 60 + frame * 4) % canvas.width, 0, 4, canvas.height);
      }

      ctx.fillStyle = 'rgba(255,120,60,0.35)';
      ctx.fillRect(canvas.width - 40, 0, 40, canvas.height);

      towers.forEach(t => {
        ctx.fillStyle = '#1f1207';
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(t.x - 14, t.y - 10, 28, 20);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = t.color;
        ctx.fillRect(t.x - 4, t.y - 4, 8, 8);
      });

      storms.forEach(s => {
        ctx.fillStyle = 'rgba(255,120,60,0.25)';
        ctx.fillRect(s.x - 60, laneY[s.lane] - laneH / 2, 120, laneH);
      });

      units.forEach(u => {
        ctx.fillStyle = u.color;
        ctx.beginPath();
        ctx.moveTo(u.x + 10, u.y);
        ctx.lineTo(u.x - 8, u.y - 6);
        ctx.lineTo(u.x - 8, u.y + 6);
        ctx.closePath();
        ctx.fill();
      });

      projs.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 2, p.ty - 2, 4, 4);
      });

      particles.forEach(p => {
        if (p.type === 'spark') {
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x, p.y, 2, 2);
        } else if (p.type === 'trail') {
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.life / 10);
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

      ctx.fillStyle = '#fff7ed';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`REACTOR ${Math.max(0, Math.floor(reactor))}`, canvas.width - 180, 30);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(30, 24, Math.max(0, heat), 6);
      ctx.strokeStyle = '#1f1207';
      ctx.strokeRect(30, 24, 160, 6);
    }

    function click(x, y) {
      if (!buildType) return;
      if (x < 140) return;
      const def = UNITS[buildType];
      if (!def || money < def.cost) return;
      money -= def.cost;
      const lane = Math.max(0, Math.min(LANES - 1, Math.floor(y / laneH)));
      spawnUnit(buildType, lane);
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
        labels: ['PHASE', 'CREDITS', 'HEAT'],
        values: [`RUSH ${wave}`, Math.floor(money), Math.floor(heat)]
      }),
      castAbility: useAbility,
      stop: () => { submitBestWave(); },
      conf: { towers: UNITS },
      get wave(){return wave;},
      get money(){return money;},
      get lives(){return Math.floor(reactor);},
      get bestWave(){return bestWave;},
      get sel(){return null;},
      get buildMode(){return buildType;}
    };
  })();
  window.ReverseOverdriveGame = Reverse;
})(window);
