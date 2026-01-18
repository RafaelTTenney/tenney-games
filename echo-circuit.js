import { getHighScore, submitHighScore } from './score-store.js';

/* ASSAULT PROTOCOLS: ECHO CIRCUIT */
(function(global){
  const Game = (function(){
    const CELL = 40;
    let canvas, ctx, COLS, ROWS;

    const UNITS = {
      runner: { name:'RUNNER', cost:30, color:'#14b8a6', hp:60, spd:3.4, dmg:6, range:50, rate:14, desc:'Fast unit to seed future echoes.' },
      striker:{ name:'STRIKER', cost:55, color:'#2dd4bf', hp:90, spd:2.8, dmg:12, range:60, rate:18, desc:'Balanced attacker with good echo value.' },
      breaker:{ name:'BREAKER', cost:110, color:'#f97316', hp:210, spd:1.7, dmg:26, range:80, rate:26, armor:0.3, desc:'Heavy echo that smashes towers.' },
      surge:  { name:'SURGE', cost:90, color:'#5eead4', hp:80, spd:3.2, dmg:10, range:70, rate:16, desc:'Burst unit that fuels fast loops.' },
      medic:  { name:'MEDIC', cost:95, color:'#a7f3d0', hp:110, spd:2.4, dmg:4, range:90, rate:24, heal:8, desc:'Support that preserves your echoes.' }
    };

    const TOWER_TYPES = {
      prism:{ name:'PRISM', cost:140, color:'#0ea5e9', range:210, dmg:12, rate:14, hp:150, beam:true },
      shard:{ name:'SHARD', cost:160, color:'#fbbf24', range:180, dmg:24, rate:28, hp:170, aoe:70 },
      flare:{ name:'FLARE', cost:130, color:'#f97316', range:150, dmg:6, rate:8, hp:150, cone:true },
      snare:{ name:'SNARE', cost:140, color:'#5eead4', range:230, dmg:8, rate:16, hp:150, slow:0.55 }
    };

    const ABILITIES = {
      emp: { name:'ECHO NULL', cost:170, cooldown:620, radius:180, stun:160 },
      overclock: { name:'LOOP BOOST', cost:150, cooldown:520, duration:280, dmg:0.4, spd:0.35 },
      decoy: { name:'ECHO CLONE', cost:120, cooldown:520, count:3, type:'runner' },
      strike: { name:'REWRITE', cost:220, cooldown:760, radius:150, dmg:150 }
    };

    const GAME_ID = 'assault-echo';

    let grid = [];
    let units = [];
    let towers = [];
    let projs = [];
    let particles = [];

    let wave = 1;
    let money = 260;
    let integrity = 100;
    let bestWave = 0;
    let submitted = false;
    let buildType = null;
    let frame = 0;

    let core = null;
    let waveActive = false;
    let echoReady = [];
    let echoNext = [];
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
      money = 260;
      integrity = 100;
      units = [];
      towers = [];
      projs = [];
      particles = [];
      buildType = null;
      frame = 0;
      submitted = false;
      waveActive = false;
      echoReady = [];
      echoNext = [];
      pendingStrike = 0;
      upgradeState.dmg = 0;
      upgradeState.spd = 0;
      upgradeState.hp = 0;
      upgradeState.armor = 0;
      abilityState.emp.cooldown = 0;
      abilityState.overclock.cooldown = 0;
      abilityState.overclock.timer = 0;
      abilityState.decoy.cooldown = 0;
      abilityState.strike.cooldown = 0;
      core = {
        x: canvas.width - 80,
        y: canvas.height / 2,
        hp: 220,
        maxHp: 220
      };
      grid = new Array(COLS).fill(0).map(() => new Array(ROWS).fill(null));
      seedTowers();
      loadBestWave();
    }

    function seedTowers(){
      towers = [];
      const keys = Object.keys(TOWER_TYPES);
      for (let i = 0; i < 6; i++) {
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
          slow: def.slow || 0,
          beam: !!def.beam,
          cone: !!def.cone,
          hp: Math.floor(def.hp * (1 + wave * 0.22)),
          maxHp: Math.floor(def.hp * (1 + wave * 0.22)),
          cd: Math.floor(Math.random() * 12),
          stun: 0
        });
      }
    }

    function getUpgradeCost(attr){
      const lvl = upgradeState[attr] || 0;
      return Math.floor(110 * Math.pow(1.55, lvl));
    }

    function applyUpgradeToUnit(unit){
      unit.baseSpd *= 1 + (upgradeState.spd * 0.1);
      unit.spd = unit.baseSpd;
      unit.dmg *= 1 + (upgradeState.dmg * 0.22);
      unit.maxHp *= 1 + (upgradeState.hp * 0.24);
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

    function spawnUnit(type, y, isEcho){
      const def = UNITS[type];
      if (!def) return;
      const echoFactor = isEcho ? 0.7 : 1;
      const unit = {
        x: 80,
        y,
        hp: def.hp * echoFactor,
        maxHp: def.hp * echoFactor,
        spd: def.spd * (isEcho ? 0.9 : 1),
        baseSpd: def.spd * (isEcho ? 0.9 : 1),
        dmg: def.dmg * echoFactor,
        range: def.range,
        rate: def.rate,
        armor: def.armor || 0,
        heal: def.heal || 0,
        color: def.color,
        type,
        isEcho: !!isEcho,
        cd: 0,
        slowTimer: 0
      };
      if (!isEcho && (upgradeState.dmg || upgradeState.spd || upgradeState.hp || upgradeState.armor)) {
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
      particles.push({ type:'shock', x, y, life:18, color:'#14b8a6', r });
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
        towers.forEach(t => {
          if (Math.hypot(t.x - core.x, t.y - core.y) < ability.radius) t.stun = Math.max(t.stun, ability.stun);
        });
        particles.push({ type:'ring', x:core.x, y:core.y, life:26, color:'#14b8a6', r:ability.radius });
      }

      if (key === 'overclock') {
        abilityState.overclock.timer = ability.duration;
      }

      if (key === 'decoy') {
        for (let i = 0; i < ability.count; i++) {
          spawnUnit(ability.type, 120 + Math.random() * 560, true);
        }
      }

      if (key === 'strike') {
        pendingStrike = 200;
      }
      return true;
    }

    function startWave(){
      if (waveActive) return;
      waveActive = true;
      core.hp = core.maxHp;
      echoReady.forEach(type => {
        spawnUnit(type, 120 + Math.random() * 560, true);
      });
      echoReady = [];
      money += 140 + wave * 50;
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

      const overclockOn = abilityState.overclock.timer > 0;
      const spdMult = overclockOn ? 1 + ABILITIES.overclock.spd : 1;
      const dmgMult = overclockOn ? 1 + ABILITIES.overclock.dmg : 1;

      for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i];
        if (u.slowTimer > 0) u.slowTimer--;
        u.spd = (u.slowTimer > 0 ? u.baseSpd * 0.7 : u.baseSpd) * spdMult;

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
            attackTarget.t.hp -= u.dmg * dmgMult;
            particles.push({ type:'slash', x: attackTarget.t.x, y: attackTarget.t.y, life: 10, color: u.color });
            u.cd = u.rate;
          }
        } else {
          const dx = core.x - u.x;
          const dy = core.y - u.y;
          const d = Math.hypot(dx, dy) || 1;
          u.x += (dx / d) * u.spd;
          u.y += (dy / d) * u.spd;
        }

        if (Math.hypot(u.x - core.x, u.y - core.y) < 24) {
          core.hp -= u.dmg * 0.6;
          money += 8;
          units.splice(i, 1);
        } else if (u.hp <= 0) {
          integrity -= u.isEcho ? 0 : 1;
          units.splice(i, 1);
        }
      }

      for (let i = towers.length - 1; i >= 0; i--) {
        const t = towers[i];
        if (t.hp <= 0) {
          money += 25;
          towers.splice(i, 1);
          continue;
        }
        if (t.stun > 0) { t.stun--; continue; }
        if (t.cd > 0) { t.cd--; continue; }

        const target = units.find(u => Math.hypot(u.x - t.x, u.y - t.y) < t.range);
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
        if (p.life <= 0) particles.splice(i, 1);
      });

      if (pendingStrike > 0) {
        pendingStrike--;
        if (pendingStrike === 0) {
          explode(core.x, core.y, ABILITIES.strike.radius, ABILITIES.strike.dmg);
        }
      }

      if (core.hp <= 0 && waveActive) {
        waveActive = false;
        wave++;
        echoReady = echoNext.slice(0, 40);
        echoNext = [];
        towers = [];
        projs = [];
        seedTowers();
        core.maxHp = 220 + wave * 25;
        core.hp = core.maxHp;
        if (wave > bestWave) bestWave = wave;
      }
    }

    function draw(ctx){
      ctx.fillStyle = '#061014';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(20,184,166,0.08)';
      ctx.beginPath();
      for (let x = 0; x <= COLS; x++) {
        ctx.moveTo(x * CELL, 0);
        ctx.lineTo(x * CELL, canvas.height);
      }
      ctx.stroke();

      towers.forEach(t => {
        ctx.fillStyle = '#0b1220';
        ctx.strokeStyle = t.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(t.x - 12, t.y - 12, 24, 24);
        ctx.fill();
        ctx.stroke();
      });

      ctx.strokeStyle = '#14b8a6';
      ctx.beginPath();
      ctx.arc(core.x, core.y, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(20,184,166,0.1)';
      ctx.fill();

      units.forEach(u => {
        ctx.globalAlpha = u.isEcho ? 0.45 : 1;
        ctx.fillStyle = u.color;
        ctx.beginPath();
        ctx.arc(u.x, u.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
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

      ctx.fillStyle = '#ccfbf1';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`ECHOES ${echoNext.length}`, 30, 30);
      ctx.fillText(`LOOP ${waveActive ? 'ACTIVE' : 'READY'}`, 30, 50);
    }

    function click(x, y){
      if (!waveActive) return;
      if (pendingStrike > 0) {
        pendingStrike = 0;
        explode(x, y, ABILITIES.strike.radius, ABILITIES.strike.dmg);
        return;
      }
      if (!buildType) return;
      const def = UNITS[buildType];
      if (!def || money < def.cost) return;
      money -= def.cost;
      spawnUnit(buildType, y, false);
      echoNext.push(buildType);
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
        labels: ['LOOP', 'CREDITS', 'ECHO'],
        values: [`${wave} | ${waveActive ? 'LIVE' : 'READY'}`, Math.floor(money), echoNext.length]
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
  window.EchoCircuitGame = Game;
})(window);
