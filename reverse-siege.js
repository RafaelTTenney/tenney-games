import { getHighScore, submitHighScore } from './score-store.js';

/* REVERSE SIEGE */
(function(global){
  const Reverse = (function(){
    const UNITS = {
      raider: { name:'RAIDER', cost:40, color:'#66ff99', hp:60, spd:2.6, breach:6, desc:'Fast, light infantry for early pressure.' },
      brute:  { name:'BRUTE',  cost:90, color:'#ff9966', hp:160, spd:1.6, breach:14, desc:'Armored bruiser with heavy breach power.' },
      swarm:  { name:'SWARM',  cost:120, color:'#66ccff', hp:35, spd:3.2, breach:4, desc:'Rapid drone swarm. Fragile but dangerous.' },
      siege:  { name:'SIEGE',  cost:180, color:'#ffd166', hp:260, spd:1.2, breach:28, desc:'Slow siege rig that melts the core.' }
    };

    const BASE_TOWERS = [
      { x: 260, y: 180, range: 180, dmg: 10, rate: 28, color:'#ff4d6d' },
      { x: 520, y: 580, range: 160, dmg: 12, rate: 24, color:'#4d96ff' },
      { x: 720, y: 320, range: 220, dmg: 16, rate: 34, color:'#ffd166' },
      { x: 900, y: 520, range: 200, dmg: 18, rate: 38, color:'#9b5de5' }
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
    let baseMax = 40;
    let baseHp = 40;
    let bestWave = 0;
    let submitted = false;
    let buildType = null;

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
      money = 250;
      lives = 30;
      active = false;
      baseMax = 40;
      baseHp = baseMax;
      units = [];
      projs = [];
      particles = [];
      buildType = null;
      submitted = false;
      buildPath();
      buildTowers();
      loadBestWave();
    }

    function buildPath() {
      const w = canvas.width;
      const h = canvas.height;
      path = [
        { x: 20, y: h * 0.5 },
        { x: w * 0.25, y: h * 0.2 },
        { x: w * 0.5, y: h * 0.8 },
        { x: w * 0.75, y: h * 0.35 },
        { x: w - 30, y: h * 0.5 }
      ];
    }

    function buildTowers() {
      towers = BASE_TOWERS.map(t => ({ ...t, cd: 0, boost: 1 }));
    }

    function startWave() {
      if (active) return;
      active = true;
      money += 150 + wave * 60;
      lives += 5;
      towers.forEach(t => { t.boost = 1 + wave * 0.12; });
      baseMax = 40 + wave * 12;
      baseHp = baseMax;
    }

    function spawnUnit(type) {
      const def = UNITS[type];
      if (!def) return;
      const jitter = (Math.random() - 0.5) * 20;
      units.push({
        x: path[0].x,
        y: path[0].y + jitter,
        idx: 0,
        hp: def.hp,
        maxHp: def.hp,
        spd: def.spd,
        breach: def.breach,
        color: def.color,
        type
      });
    }

    function update() {
      if (lives <= 0) {
        submitBestWave();
        return;
      }

      for (let i = units.length - 1; i >= 0; i--) {
        const u = units[i];
        const target = path[u.idx + 1];
        if (!target) {
          baseHp -= u.breach;
          money += 8;
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
        if (u.x < -20 || u.x > canvas.width + 20 || u.y < -20 || u.y > canvas.height + 20) {
          units.splice(i, 1);
          continue;
        }
      }

      for (let i = towers.length - 1; i >= 0; i--) {
        const t = towers[i];
        if (t.cd > 0) { t.cd--; continue; }
        const target = units.find(u => Math.hypot(u.x - t.x, u.y - t.y) < t.range);
        if (target) {
          projs.push({ x: t.x, y: t.y, tx: target.x, ty: target.y, dmg: t.dmg * t.boost, spd: 10, color: t.color });
          t.cd = t.rate;
        }
      }

      for (let i = projs.length - 1; i >= 0; i--) {
        const p = projs[i];
        const dx = p.tx - p.x;
        const dy = p.ty - p.y;
        const d = Math.hypot(dx, dy);
        if (d < p.spd) {
          const hit = units.find(u => Math.hypot(u.x - p.tx, u.y - p.ty) < 18);
          if (hit) {
            hit.hp -= p.dmg;
            if (hit.hp <= 0) {
              lives--;
              units = units.filter(u => u !== hit);
              particles.push({ x: hit.x, y: hit.y, life: 18, color: hit.color, vx: Math.random() * 4 - 2, vy: Math.random() * 4 - 2 });
            }
          }
          projs.splice(i, 1);
        } else {
          p.x += (dx / d) * p.spd;
          p.y += (dy / d) * p.spd;
        }
      }

      particles.forEach((p, i) => {
        p.life--;
        p.x += p.vx;
        p.y += p.vy;
        if (p.life <= 0) particles.splice(i, 1);
      });

      if (baseHp <= 0) {
        active = false;
        wave++;
        if (wave > bestWave) bestWave = wave;
      }

      if (active && units.length === 0) {
        const minCost = Math.min(...Object.values(UNITS).map(u => u.cost));
        if (money < minCost) active = false;
      }
    }

    function draw(ctx) {
      const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      bg.addColorStop(0, '#04070d');
      bg.addColorStop(1, '#0a0514');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(0,255,204,0.5)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x, path[i].y);
      ctx.stroke();
      ctx.lineWidth = 1;

      const baseX = canvas.width - 40;
      ctx.fillStyle = 'rgba(255,0,100,0.15)';
      ctx.fillRect(baseX, 0, 30, canvas.height);
      ctx.strokeStyle = 'rgba(255,0,100,0.6)';
      ctx.strokeRect(baseX, 0, 30, canvas.height);

      towers.forEach(t => {
        ctx.shadowBlur = 12;
        ctx.shadowColor = t.color;
        ctx.fillStyle = t.color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      units.forEach(u => {
        ctx.fillStyle = u.color;
        ctx.beginPath();
        ctx.arc(u.x, u.y, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0f0';
        ctx.fillRect(u.x - 12, u.y - 16, 24 * (u.hp / u.maxHp), 3);
      });

      projs.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - 3, p.y - 3, 6, 6);
      });

      particles.forEach(p => {
        ctx.globalAlpha = p.life / 18;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 3, 3);
        ctx.globalAlpha = 1;
      });

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`BASE ${Math.max(0, Math.floor(baseHp))}/${baseMax}`, canvas.width - 180, 30);
    }

    function click(x, y) {
      if (!active || !buildType) return;
      if (x > 80) return;
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
