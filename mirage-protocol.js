import { getHighScore, submitHighScore } from './score-store.js';

/* ASSAULT PROTOCOLS: MIRAGE PROTOCOL */
(function(global){
  const Game = (function(){
    const CELL = 40;
    let canvas, ctx, COLS, ROWS;

    const UNITS = {
      scout: { name:'SCOUT', cost:35, color:'#60a5fa', hp:60, spd:3.2, dmg:5, range:60, rate:16, vision:140, desc:'Fast recon with wide vision.' },
      ghost: { name:'GHOST', cost:70, color:'#93c5fd', hp:80, spd:3.0, dmg:8, range:70, rate:16, vision:110, stealth:0.6, desc:'Low-profile infiltrator.' },
      saboteur: { name:'SABOTEUR', cost:110, color:'#f87171', hp:120, spd:2.2, dmg:14, range:90, rate:20, vision:100, stun:80, desc:'Disables towers while striking.' },
      breaker: { name:'BREAKER', cost:140, color:'#fb7185', hp:210, spd:1.6, dmg:26, range:90, rate:26, armor:0.3, vision:90, desc:'Heavy unit for core breach.' },
      signal: { name:'SIGNAL', cost:95, color:'#38bdf8', hp:100, spd:2.5, dmg:8, range:120, rate:18, vision:160, desc:'Signal relay that reveals farther.' }
    };

    const TOWER_TYPES = {
      beam: { name:'BEAM', cost:120, color:'#f97316', range:190, dmg:10, rate:10, hp:140, beam:true },
      shard:{ name:'SHARD', cost:140, color:'#f59e0b', range:180, dmg:22, rate:28, hp:160, aoe:60 },
      prism:{ name:'PRISM', cost:160, color:'#60a5fa', range:230, dmg:12, rate:16, hp:150, chain:3 },
      flare:{ name:'FLARE', cost:130, color:'#fb7185', range:150, dmg:6, rate:8, hp:150, cone:true }
    };

    const ABILITIES = {
      emp: { name:'SCAN PULSE', cost:160, cooldown:620, radius:200, stun:160, duration:260 },
      overclock: { name:'OVERCLOCK', cost:140, cooldown:520, duration:300, dmg:0.35, spd:0.3 },
      decoy: { name:'DECOY SCOUTS', cost:120, cooldown:520, count:3, type:'scout' },
      strike: { name:'ORBITAL', cost:240, cooldown:900, radius:150, dmg:150 }
    };

    const GAME_ID = 'assault-mirage';

    let grid = [];
    let units = [];
    let towers = [];
    let projs = [];
    let particles = [];
    let cores = [];

    let wave = 1;
    let money = 240;
    let integrity = 100;
    let bestWave = 0;
    let submitted = false;
    let buildType = null;
    let frame = 0;

    let scanTimer = 0;
    let scanRadius = 0;
    let pendingStrike = 0;

    const upgradeState = { dmg: 0, spd: 0, hp: 0, armor: 0 };
    const abilityState = {
      emp: { cooldown: 0 },
      overclock: { cooldown: 0, timer: 0 },
      decoy: { cooldown: 0 },
      strike: { cooldown: 0 }
    };

    function init(c){
      canvas = c;
      ctx = c.getContext('2d');
      COLS = Math.floor(canvas.width / CELL);
      ROWS = Math.floor(canvas.height / CELL);
      reset();
    }

    async function loadBestWave(){
      bestWave = await getHighScore(GAME_ID);
    }

    async function submitBestWave(){
      if (submitted) return;
      submitted = true;
      const saved = await submitHighScore(GAME_ID, wave);
      if (typeof saved === 'number') bestWave = saved;
    }

    function reset(){
      wave = 1;
      money = 240;
      integrity = 100;
      scanTimer = 0;
      scanRadius = 0;
      pendingStrike = 0;
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
      grid = new Array(COLS).fill(0).map(() => new Array(ROWS).fill(null));
      cores = buildCores();
      seedTowers();
      loadBestWave();
    }

    function buildCores(){
      const positions = [
        { x: Math.floor(COLS * 0.65), y: Math.floor(ROWS * 0.3) },
        { x: Math.floor(COLS * 0.75), y: Math.floor(ROWS * 0.55) },
        { x: Math.floor(COLS * 0.6), y: Math.floor(ROWS * 0.7) }
      ];
      const realIndex = Math.floor(Math.random() * positions.length);
      return positions.map((p, i) => ({
        x: p.x * CELL + CELL / 2,
        y: p.y * CELL + CELL / 2,
        hp: i === realIndex ? 240 : 120,
        maxHp: i === realIndex ? 240 : 120,
        real: i === realIndex,
        visible: false,
        dead: false
      }));
    }

    function seedTowers(){
      towers = [];
      const keys = Object.keys(TOWER_TYPES);
      for (let i = 0; i < 8; i++) {
        const pick = keys[Math.floor(Math.random() * keys.length)];
        const def = TOWER_TYPES[pick];
        const gx = 3 + Math.floor(Math.random() * (COLS - 6));
        const gy = 2 + Math.floor(Math.random() * (ROWS - 4));
        towers.push({
          x: gx * CELL + CELL / 2,
          y: gy * CELL + CELL / 2,
          type: pick,
          name: def.name,
          color: def.color,
          range: def.range,
          dmg: def.dmg * (1 + wave * 0.12),
          rate: Math.max(6, Math.floor(def.rate * (1 - wave * 0.02))),
          aoe: def.aoe || 0,
          chain: def.chain || 0,
          beam: !!def.beam,
          cone: !!def.cone,
          hp: Math.floor(def.hp * (1 + wave * 0.22)),
          maxHp: Math.floor(def.hp * (1 + wave * 0.22)),
          cd: Math.floor(Math.random() * 12),
          stun: 0,
          visible: false
        });
      }
    }

    function getUpgradeCost(attr){
      const lvl = upgradeState[attr] || 0;
      return Math.floor(120 * Math.pow(1.6, lvl));
    }

    function applyUpgradeToUnit(unit){
      unit.baseSpd *= 1 + (upgradeState.spd * 0.1);
      unit.spd = unit.baseSpd;
      unit.dmg *= 1 + (upgradeState.dmg * 0.2);
      unit.maxHp *= 1 + (upgradeState.hp * 0.22);
      unit.hp = Math.min(unit.hp, unit.maxHp);
      unit.armor = Math.min(0.6, (unit.armor || 0) + upgradeState.armor * 0.08);
    }

    function upgrade(attr){
      if (!upgradeState.hasOwnProperty(attr)) return false;
      const cost = getUpgradeCost(attr);
      if (money < cost) return false;
      money -= cost;
      upgradeState[attr] += 1;
      units.forEach(unit => applyUpgradeToUnit(unit));
      return true;
    }

    function getUpgradeState(){
      return {
        dmg: { level: upgradeState.dmg, cost: getUpgradeCost('dmg') },
        spd: { level: upgradeState.spd, cost: getUpgradeCost('spd') },
        hp: { level: upgradeState.hp, cost: getUpgradeCost('hp') },
        armor: { level: upgradeState.armor, cost: getUpgradeCost('armor') }
      };
    }

    function getCommandState(){
      return {
        upgrades: getUpgradeState(),
        abilities: {
          emp: { cooldown: abilityState.emp.cooldown, cost: ABILITIES.emp.cost },
          overclock: { cooldown: abilityState.overclock.cooldown, cost: ABILITIES.overclock.cost },
          decoy: { cooldown: abilityState.decoy.cooldown, cost: ABILITIES.decoy.cost },
          strike: { cooldown: abilityState.strike.cooldown, cost: ABILITIES.strike.cost }
        },
        aiCredits: 0
      };
    }

    function spawnUnit(type, y){
      const def = UNITS[type];
      if (!def) return;
      const unit = {
        x: 80,
        y,
        hp: def.hp,
        maxHp: def.hp,
        spd: def.spd,
        baseSpd: def.spd,
        dmg: def.dmg,
        range: def.range,
        rate: def.rate,
        armor: def.armor || 0,
        vision: def.vision || 80,
        stealth: def.stealth || 1,
        stun: def.stun || 0,
        color: def.color,
        type,
        cd: 0,
        slowTimer: 0,
        target: { x: 200 + Math.random() * 800, y: 100 + Math.random() * 600 }
      };
      if (upgradeState.dmg || upgradeState.spd || upgradeState.hp || upgradeState.armor) {
        applyUpgradeToUnit(unit);
      }
      units.push(unit);
    }

    function applyTowerDamage(unit, dmg){
      const final = dmg * (1 - (unit.armor || 0));
      unit.hp -= final;
      particles.push({ type:'spark', x:unit.x, y:unit.y, life:10, color:unit.color });
    }

    function explode(x, y, r, dmg){
      particles.push({ type:'shock', x, y, life:18, color:'#60a5fa', r });
      towers.forEach(t => {
        if (Math.hypot(t.x - x, t.y - y) < r) t.hp -= dmg;
      });
    }

    function useAbility(key){
      const ability = ABILITIES[key];
      const state = abilityState[key];
      if (!ability || !state) return false;
      if (state.cooldown > 0 || money < ability.cost) return false;
      money -= ability.cost;
      state.cooldown = ability.cooldown;

      if (key === 'emp') {
        scanTimer = ability.duration;
        scanRadius = ability.radius;
        towers.forEach(t => {
          if (Math.hypot(t.x - canvas.width * 0.55, t.y - canvas.height * 0.5) < ability.radius) t.stun = Math.max(t.stun, ability.stun);
        });
        particles.push({ type:'ring', x:canvas.width * 0.55, y:canvas.height * 0.5, life:30, color:'#60a5fa', r:ability.radius });
      }

      if (key === 'overclock') {
        abilityState.overclock.timer = ability.duration;
      }

      if (key === 'decoy') {
        for (let i = 0; i < ability.count; i++) {
          spawnUnit(ability.type, 120 + Math.random() * 560);
        }
      }

      if (key === 'strike') {
        pendingStrike = 200;
      }
      return true;
    }

    function startWave(){
      money += 120 + wave * 50;
      for (let i = 0; i < 2; i++) {
        spawnUnit('scout', 160 + Math.random() * 480);
      }
    }

    function updateVisibility(){
      towers.forEach(t => { t.visible = false; });
      cores.forEach(c => { c.visible = false; });
      units.forEach(u => {
        const vis = u.vision || 80;
        towers.forEach(t => {
          if (Math.hypot(t.x - u.x, t.y - u.y) < vis) t.visible = true;
        });
        cores.forEach(c => {
          if (Math.hypot(c.x - u.x, c.y - u.y) < vis) c.visible = true;
        });
      });
      if (scanTimer > 0) {
        towers.forEach(t => {
          if (Math.hypot(t.x - canvas.width * 0.55, t.y - canvas.height * 0.5) < scanRadius) t.visible = true;
        });
        cores.forEach(c => {
          if (Math.hypot(c.x - canvas.width * 0.55, c.y - canvas.height * 0.5) < scanRadius) c.visible = true;
        });
      }
    }

    function update(){
      frame++;
      if (integrity <= 0) {
        submitBestWave();
        return;
      }

      if (abilityState.emp.cooldown > 0) abilityState.emp.cooldown--;
      if (abilityState.overclock.cooldown > 0) abilityState.overclock.cooldown--;
      if (abilityState.decoy.cooldown > 0) abilityState.decoy.cooldown--;
      if (abilityState.strike.cooldown > 0) abilityState.strike.cooldown--;
      if (abilityState.overclock.timer > 0) abilityState.overclock.timer--;
      if (scanTimer > 0) scanTimer--;

      updateVisibility();

      const overclockOn = abilityState.overclock.timer > 0;
      const spdMult = overclockOn ? 1 + ABILITIES.overclock.spd : 1;
      const dmgMult = overclockOn ? 1 + ABILITIES.overclock.dmg : 1;

      for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i];
        if (u.slowTimer > 0) u.slowTimer--;
        u.spd = (u.slowTimer > 0 ? u.baseSpd * 0.7 : u.baseSpd) * spdMult;

        let attackTarget = null;
        let coreTarget = null;

        cores.forEach(c => {
          if (c.visible && c.hp > 0) {
            const d = Math.hypot(c.x - u.x, c.y - u.y);
            if (d < u.range && (!coreTarget || d < coreTarget.dist)) {
              coreTarget = { c, dist: d };
            }
          }
        });

        towers.forEach(t => {
          if (t.hp <= 0) return;
          const d = Math.hypot(t.x - u.x, t.y - u.y);
          if (d < u.range && (!attackTarget || d < attackTarget.dist)) {
            attackTarget = { t, dist: d };
          }
        });

        if (coreTarget || attackTarget) {
          if (u.cd > 0) {
            u.cd--;
          } else {
            if (coreTarget) {
              coreTarget.c.hp -= u.dmg * dmgMult;
              particles.push({ type:'slash', x: coreTarget.c.x, y: coreTarget.c.y, life: 10, color: u.color });
            } else {
              attackTarget.t.hp -= u.dmg * dmgMult;
              if (u.stun) attackTarget.t.stun = Math.max(attackTarget.t.stun, u.stun);
              particles.push({ type:'slash', x: attackTarget.t.x, y: attackTarget.t.y, life: 10, color: u.color });
            }
            u.cd = u.rate;
          }
        } else {
          const dx = u.target.x - u.x;
          const dy = u.target.y - u.y;
          const d = Math.hypot(dx, dy) || 1;
          u.x += (dx / d) * u.spd;
          u.y += (dy / d) * u.spd;
          if (Math.hypot(u.x - u.target.x, u.y - u.target.y) < 12) {
            u.target = { x: 200 + Math.random() * 800, y: 100 + Math.random() * 600 };
          }
        }

        if (u.hp <= 0) {
          integrity -= 1;
          units.splice(i, 1);
        }
      }

      for (let i = towers.length - 1; i >= 0; i--) {
        const t = towers[i];
        if (t.hp <= 0) {
          money += 20;
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
          } else if (t.cone) {
            units.forEach(u => {
              if (Math.hypot(u.x - t.x, u.y - t.y) < t.range) {
                applyTowerDamage(u, t.dmg);
              }
            });
            particles.push({ type:'ring', x:t.x, y:t.y, life:12, color:t.color, r:t.range });
            t.cd = t.rate;
          } else {
            projs.push({ x:t.x, y:t.y, tx:target.x, ty:target.y, dmg:t.dmg, spd:9, aoe:t.aoe, color:t.color });
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
              }
            });
            particles.push({ type:'ring', x:p.tx, y:p.ty, life:14, color:p.color, r:p.aoe });
          } else {
            const hit = units.find(u => Math.hypot(u.x - p.tx, u.y - p.ty) < 14);
            if (hit) applyTowerDamage(hit, p.dmg);
          }
          projs.splice(i, 1);
        } else {
          p.x += (dx / d) * p.spd;
          p.y += (dy / d) * p.spd;
        }
      }

      particles.forEach((p, i) => {
        p.life--;
        if (p.vx) { p.x += p.vx; p.y += p.vy; }
        if (p.life <= 0) particles.splice(i, 1);
      });

      if (pendingStrike > 0) {
        pendingStrike--;
        if (pendingStrike === 0) {
          explode(canvas.width * 0.6, canvas.height * 0.5, ABILITIES.strike.radius, ABILITIES.strike.dmg);
        }
      }

      cores.forEach(c => {
        if (c.hp <= 0 && !c.dead) {
          if (c.real) {
            wave++;
            money += 200 + wave * 60;
            cores = buildCores();
            seedTowers();
            units = [];
            if (wave > bestWave) bestWave = wave;
          } else {
            integrity -= 12;
            c.dead = true;
            c.hp = 0;
          }
        }
      });
    }

    function drawFog(){
      ctx.save();
      ctx.fillStyle = 'rgba(2,4,10,0.7)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'destination-out';
      units.forEach(u => {
        ctx.beginPath();
        ctx.arc(u.x, u.y, u.vision, 0, Math.PI * 2);
        ctx.fill();
      });
      if (scanTimer > 0) {
        ctx.beginPath();
        ctx.arc(canvas.width * 0.55, canvas.height * 0.5, scanRadius, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }

    function draw(ctx){
      ctx.fillStyle = '#020308';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(96,165,250,0.08)';
      ctx.beginPath();
      for (let x = 0; x <= COLS; x++) {
        ctx.moveTo(x * CELL, 0);
        ctx.lineTo(x * CELL, canvas.height);
      }
      ctx.stroke();

      cores.forEach(c => {
        if (!c.visible) return;
        ctx.strokeStyle = c.real ? '#22d3ee' : '#64748b';
        ctx.beginPath();
        ctx.arc(c.x, c.y, 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = c.real ? 'rgba(34,211,238,0.12)' : 'rgba(100,116,139,0.15)';
        ctx.fill();
      });

      towers.forEach(t => {
        if (!t.visible) return;
        ctx.fillStyle = '#0b1220';
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(t.x - 12, t.y - 12, 24, 24);
        ctx.fill();
        ctx.stroke();
      });

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

      drawFog();

      ctx.fillStyle = '#e0f2fe';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`INTEGRITY ${integrity}`, 30, 30);
    }

    function click(x, y){
      if (pendingStrike > 0) {
        pendingStrike = 0;
        explode(x, y, ABILITIES.strike.radius, ABILITIES.strike.dmg);
        return;
      }
      if (!buildType) return;
      const def = UNITS[buildType];
      if (!def || money < def.cost) return;
      money -= def.cost;
      spawnUnit(buildType, y);
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
        labels: ['MISSION', 'CREDITS', 'INTEGRITY'],
        values: [`${wave}`, Math.floor(money), integrity]
      }),
      castAbility: useAbility,
      stop: () => { submitBestWave(); },
      conf: { towers: UNITS },
      get wave(){return wave;},
      get money(){return money;},
      get lives(){return integrity;},
      get bestWave(){return bestWave;},
      get sel(){return null;},
      get buildMode(){return buildType;}
    };
  })();
  window.MirageProtocolGame = Game;
})(window);
