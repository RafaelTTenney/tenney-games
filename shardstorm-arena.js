import { getHighScore, submitHighScore } from './score-store.js';

/* ASSAULT PROTOCOLS: SHARDSTORM ARENA */
(function(global){
  const Game = (function(){
    let canvas, ctx;
    const WIDTH = 1200;
    const HEIGHT = 800;

    const UNITS = {
      shard: { name:'SHARD', cost:30, color:'#f472b6', hp:60, spd:3.6, dmg:6, range:50, rate:14, desc:'Fast runner that captures score beacons.' },
      lancer:{ name:'LANCER', cost:55, color:'#fb7185', hp:100, spd:3.0, dmg:12, range:60, rate:18, desc:'Balanced scorer with tower damage.' },
      prism: { name:'PRISM', cost:80, color:'#a855f7', hp:120, spd:2.4, dmg:6, range:100, rate:20, desc:'Long-range scorer that clears towers.' },
      burst: { name:'BURST', cost:110, color:'#fbbf24', hp:80, spd:4.2, dmg:14, range:45, rate:10, desc:'High-speed burst unit for quick scores.' },
      tank:  { name:'TANK', cost:130, color:'#f59e0b', hp:220, spd:1.8, dmg:20, range:70, rate:24, armor:0.3, desc:'Armored shard that survives storms.' }
    };

    const TOWER_TYPES = {
      spike: { name:'SPIKE', cost:120, color:'#f97316', range:160, dmg:10, rate:12, hp:140, beam:true },
      shard: { name:'SHARD', cost:140, color:'#f472b6', range:170, dmg:20, rate:28, hp:160, aoe:60 },
      prism: { name:'PRISM', cost:160, color:'#a855f7', range:220, dmg:12, rate:16, hp:150, chain:3 },
      flare: { name:'FLARE', cost:130, color:'#fb7185', range:140, dmg:6, rate:8, hp:150, cone:true }
    };

    const ABILITIES = {
      emp: { name:'SHARD FREEZE', cost:160, cooldown:520, radius:170, stun:180 },
      overclock: { name:'HYPERFLOW', cost:140, cooldown:420, duration:260, dmg:0.4, spd:0.45 },
      decoy: { name:'SHARD CLONE', cost:120, cooldown:420, count:3, type:'shard' },
      strike: { name:'METEOR', cost:220, cooldown:720, radius:140, dmg:160 }
    };

    const GAME_ID = 'assault-shardstorm';

    let units = [];
    let towers = [];
    let projs = [];
    let particles = [];
    let beacons = [];
    let storms = [];

    let wave = 1;
    let money = 260;
    let integrity = 100;
    let bestWave = 0;
    let submitted = false;
    let buildType = null;
    let frame = 0;

    let roundActive = false;
    let roundTimer = 0;
    let roundScore = 0;
    let targetScore = 12;
    let pendingStrike = 0;

    let aiCredits = 0;

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
      roundActive = false;
      roundTimer = 0;
      roundScore = 0;
      targetScore = 12;
      pendingStrike = 0;
      units = [];
      towers = [];
      projs = [];
      particles = [];
      storms = [];
      beacons = buildBeacons();
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
      seedTowers();
      loadBestWave();
    }

    function buildBeacons(){
      return Array.from({ length: 3 }, (_, i) => ({
        x: 260 + Math.random() * 680,
        y: 160 + Math.random() * 480,
        radius: 28,
        pulse: i * 20
      }));
    }

    function seedTowers(){
      towers = [];
      const keys = Object.keys(TOWER_TYPES);
      for (let i = 0; i < 7; i++) {
        const pick = keys[Math.floor(Math.random() * keys.length)];
        const def = TOWER_TYPES[pick];
        towers.push({
          x: 200 + Math.random() * 800,
          y: 120 + Math.random() * 560,
          type: pick,
          name: def.name,
          color: def.color,
          range: def.range,
          dmg: def.dmg * (1 + wave * 0.1),
          rate: Math.max(6, Math.floor(def.rate * (1 - wave * 0.015))),
          aoe: def.aoe || 0,
          chain: def.chain || 0,
          beam: !!def.beam,
          cone: !!def.cone,
          hp: Math.floor(def.hp * (1 + wave * 0.2)),
          maxHp: Math.floor(def.hp * (1 + wave * 0.2)),
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
        aiCredits
      };
    }

    function spawnUnit(type, x, y){
      const def = UNITS[type];
      if (!def) return;
      const unit = {
        x,
        y,
        hp: def.hp,
        maxHp: def.hp,
        spd: def.spd,
        baseSpd: def.spd,
        dmg: def.dmg,
        range: def.range,
        rate: def.rate,
        armor: def.armor || 0,
        color: def.color,
        type,
        cd: 0,
        slowTimer: 0,
        target: null
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
      particles.push({ type:'shock', x, y, life:18, color:'#f97316', r });
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
          if (Math.hypot(t.x - canvas.width * 0.5, t.y - canvas.height * 0.5) < ability.radius) t.stun = Math.max(t.stun, ability.stun);
        });
        particles.push({ type:'ring', x:canvas.width * 0.5, y:canvas.height * 0.5, life:26, color:'#f472b6', r:ability.radius });
      }

      if (key === 'overclock') {
        abilityState.overclock.timer = ability.duration;
      }

      if (key === 'decoy') {
        for (let i = 0; i < ability.count; i++) {
          spawnUnit(ability.type, 200 + Math.random() * 800, 150 + Math.random() * 500);
        }
      }

      if (key === 'strike') {
        pendingStrike = 200;
      }
      return true;
    }

    function startWave(){
      roundActive = true;
      roundTimer = 900;
      roundScore = 0;
      targetScore = 10 + wave * 2;
      storms = Array.from({ length: 2 + Math.floor(wave / 2) }, () => ({
        x: 200 + Math.random() * 800,
        y: 120 + Math.random() * 560,
        r: 70 + Math.random() * 40,
        drift: (Math.random() - 0.5) * 0.6
      }));
      seedTowers();
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

      if (roundActive) {
        roundTimer--;
        if (roundTimer <= 0) {
          roundActive = false;
          if (roundScore < targetScore) integrity -= 15;
          wave++;
          money += 120 + roundScore * 5;
          if (wave > bestWave) bestWave = wave;
          units = [];
        }
      }

      storms.forEach(s => {
        s.x += s.drift;
        s.y += Math.sin((frame + s.x) * 0.01) * 0.3;
      });

      const overclockOn = abilityState.overclock.timer > 0;
      const spdMult = overclockOn ? 1 + ABILITIES.overclock.spd : 1;
      const dmgMult = overclockOn ? 1 + ABILITIES.overclock.dmg : 1;

      for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i];
        if (u.slowTimer > 0) u.slowTimer--;
        u.spd = (u.slowTimer > 0 ? u.baseSpd * 0.7 : u.baseSpd) * spdMult;

        storms.forEach(s => {
          if (Math.hypot(u.x - s.x, u.y - s.y) < s.r) {
            u.hp -= 0.25;
          }
        });

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
          if (!u.target || Math.hypot(u.x - u.target.x, u.y - u.target.y) < 10) {
            const beacon = beacons[Math.floor(Math.random() * beacons.length)];
            u.target = beacon ? { x: beacon.x, y: beacon.y } : { x: canvas.width / 2, y: canvas.height / 2 };
          }
          const dx = u.target.x - u.x;
          const dy = u.target.y - u.y;
          const d = Math.hypot(dx, dy) || 1;
          u.x += (dx / d) * u.spd;
          u.y += (dy / d) * u.spd;
        }

        beacons.forEach(b => {
          if (Math.hypot(u.x - b.x, u.y - b.y) < b.radius) {
            roundScore++;
            money += 8;
            b.x = 220 + Math.random() * 760;
            b.y = 140 + Math.random() * 520;
            u.hp = 0;
          }
        });

        if (u.hp <= 0) {
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
        if (p.vx) { p.x += p.vx; p.y += p.vy; }
        if (p.life <= 0) particles.splice(i, 1);
      });

      if (pendingStrike > 0) {
        pendingStrike--;
        if (pendingStrike === 0) {
          explode(canvas.width * 0.5, canvas.height * 0.5, ABILITIES.strike.radius, ABILITIES.strike.dmg);
        }
      }

      if (roundScore >= targetScore && roundActive) {
        roundActive = false;
        wave++;
        money += 200 + roundScore * 6;
        units = [];
        if (wave > bestWave) bestWave = wave;
      }
    }

    function draw(ctx){
      ctx.fillStyle = '#120718';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = `rgba(244,114,182,${0.03 + i * 0.001})`;
        ctx.fillRect((i * 50 + frame * 3) % canvas.width, 0, 3, canvas.height);
      }

      storms.forEach(s => {
        ctx.fillStyle = 'rgba(251,113,133,0.12)';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      beacons.forEach(b => {
        b.pulse = (b.pulse + 1) % 60;
        ctx.strokeStyle = '#f472b6';
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius + Math.sin(b.pulse * 0.1) * 4, 0, Math.PI * 2);
        ctx.stroke();
      });

      towers.forEach(t => {
        ctx.fillStyle = '#1b0f24';
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
        ctx.moveTo(u.x + 10, u.y);
        ctx.lineTo(u.x - 8, u.y - 6);
        ctx.lineTo(u.x - 8, u.y + 6);
        ctx.closePath();
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

      ctx.fillStyle = '#fff1f2';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`ROUND ${roundActive ? Math.ceil(roundTimer / 60) : 'READY'}`, 30, 30);
      ctx.fillText(`SCORE ${roundScore}/${targetScore}`, 30, 50);
    }

    function click(x, y){
      if (!roundActive) return;
      if (pendingStrike > 0) {
        pendingStrike = 0;
        explode(x, y, ABILITIES.strike.radius, ABILITIES.strike.dmg);
        return;
      }
      if (!buildType) return;
      const def = UNITS[buildType];
      if (!def || money < def.cost) return;
      money -= def.cost;
      spawnUnit(buildType, x, y);
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
        labels: ['ROUND', 'CREDITS', 'SCORE'],
        values: [`${wave} | ${roundActive ? Math.ceil(roundTimer / 60) + 's' : 'READY'}`, Math.floor(money), `${roundScore}/${targetScore}`]
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
  window.ShardstormArenaGame = Game;
})(window);
