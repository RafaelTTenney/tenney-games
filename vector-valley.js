/* Vector Valley — upgraded and modal-friendly
   - API: init(canvas, optionsOrDiff), update(), draw(ctx), click(x,y), startWave(), setBuild(k), upgrade(), sell(), reset(), stop(), setPlacementMode(single)
   - Features: difficulty presets with path differences, larger play area, persistent placement by default, improved enemy visuals, particle effects, quality settings.
*/

(function(global){
  const VectorValley = (function(){
    // ---- Config ----
    const DEFAULT = {
      canvasW: 1100,
      canvasH: 720,
      quality: 'high'
    };

    // tower definitions
    const conf = {
      towers: {
        turret:  { name:'TURRET',  cost:70,  r:120, dmg:26, cd:28, color:'#FFAA00', hp:100 },
        rapid:   { name:'RAPID',   cost:140, r:90,  dmg:7,  cd:6,  color:'#00FF66', hp:90 },
        sniper:  { name:'SNIPER',  cost:360, r:420, dmg:160,cd:100,color:'#00FFFF', hp:60 },
        mortar:  { name:'MORTAR',  cost:200, r:200, dmg:60, cd:80, color:'#FF8844', aoe:true, hp:90 },
        beacon:  { name:'BEACON',  cost:240, r:140, dmg:0,  cd:0,  color:'#AA66FF', boost:true, hp:80 }
      }
    };

    // ---- State ----
    let canvas=null, ctx=null;
    let width=DEFAULT.canvasW, height=DEFAULT.canvasH;
    let wave=1, money=500, lives=20, active=false, gameOver=false;
    let enemies = [], towers = [], projs = [], particles = [], queue = [];
    let path = [], difficulty = 'med', diffMult = 1.0;
    let build = null, sel = null;
    let placementSingle = false;
    let quality = DEFAULT.quality;

    // expose conf
    function getConf(){ return conf; }

    // ---- Path generators ----
    function generatePathFor(d){
      difficulty = d || 'med';
      if (canvas){
        const w = canvas.width, h = canvas.height;
        if (difficulty === 'easy'){
          return [
            {x:20, y: Math.floor(h*0.35)},
            {x: Math.floor(w*0.15), y: Math.floor(h*0.35)},
            {x: Math.floor(w*0.15), y: Math.floor(h*0.12)},
            {x: Math.floor(w*0.33), y: Math.floor(h*0.12)},
            {x: Math.floor(w*0.33), y: Math.floor(h*0.28)},
            {x: Math.floor(w*0.49), y: Math.floor(h*0.28)},
            {x: Math.floor(w*0.49), y: Math.floor(h*0.5)},
            {x: Math.floor(w*0.66), y: Math.floor(h*0.5)},
            {x: Math.floor(w*0.66), y: Math.floor(h*0.72)},
            {x: Math.floor(w-20), y: Math.floor(h*0.72)}
          ];
        } else if (difficulty === 'hard'){
          return [
            {x:0, y: Math.floor(h*0.5)},
            {x: Math.floor(w*0.35), y: Math.floor(h*0.5)},
            {x: Math.floor(w*0.7), y: Math.floor(h*0.5)},
            {x: Math.floor(w-10), y: Math.floor(h*0.5)}
          ];
        } else {
          return [
            {x:10, y: Math.floor(h*0.4)},
            {x: Math.floor(w*0.2), y: Math.floor(h*0.4)},
            {x: Math.floor(w*0.2), y: Math.floor(h*0.62)},
            {x: Math.floor(w*0.42), y: Math.floor(h*0.62)},
            {x: Math.floor(w*0.42), y: Math.floor(h*0.32)},
            {x: Math.floor(w*0.62), y: Math.floor(h*0.32)},
            {x: Math.floor(w*0.62), y: Math.floor(h*0.66)},
            {x: Math.floor(w*0.86), y: Math.floor(h*0.66)}
          ];
        }
      }
      return [];
    }

    // ---- Initialization ----
    function init(c, opt){
      canvas = c; ctx = canvas.getContext('2d');
      if (!canvas) return;
      // options can be difficulty string or object
      if (typeof opt === 'string') { setDifficulty(opt); }
      else if (typeof opt === 'object' && opt !== null){
        if (opt.difficulty) setDifficulty(opt.difficulty);
        if (opt.placementSingle !== undefined) placementSingle = !!opt.placementSingle;
        if (opt.quality) quality = opt.quality;
      }
      canvas.width = canvas.width || DEFAULT.canvasW;
      canvas.height = canvas.height || DEFAULT.canvasH;
      width = canvas.width; height = canvas.height;
      money = 500; lives = 20; wave = 1; active = false;
      enemies.length = 0; towers.length = 0; projs.length = 0; particles.length = 0; queue.length = 0;
      path = generatePathFor(difficulty);
    }

    function stop(){ /* stop timers if any */ }

    function reset(){ init(canvas, {difficulty: difficulty, placementSingle: !placementSingle, quality}); }

    // ---- Gameplay ----
    function startWave(){
      if (active) return;
      active = true;
      const base = 6 + Math.floor(wave * 2 * diffMult);
      for (let i=0;i<base;i++){
        let type = 'norm';
        if (wave > 3 && i % 4 === 0) type = 'shield';
        if (wave > 5 && i % 6 === 0) type = 'fast';
        queue.push({ d: i * 26, type });
      }
      // miniboss and boss schedule
      queue.push({ d: base*26 + 40, type: 'miniboss' });
      if (wave % 5 === 0) queue.push({ d: base*26 + 160, type: 'boss' });
    }

    function spawnQueued(){
      if (!active) return;
      for (let i = queue.length -1; i>=0; i--){
        queue[i].d -= 16;
        if (queue[i].d <= 0){ spawnEnemy(queue[i].type); queue.splice(i,1); }
      }
    }

    function spawnEnemy(type){
      const e = {
        x: path[0].x, y: path[0].y,
        idx: 1, hp: 18 + wave*12,
        maxHp: 18 + wave*12, spd: 1.2 + Math.random()*0.6,
        type, color: '#ff66ff', val: 10, dead:false
      };
      if (type === 'fast'){ e.spd *= 1.9; e.hp *= 0.7; e.color = '#ffd100'; }
      if (type === 'shield'){ e.hp *= 1.6; e.color = '#66aaff'; }
      if (type === 'boss'){ e.hp *= 8 + wave*2; e.spd *= 0.6; e.color = '#ffd700'; e.val *= 10; }
      enemies.push(e);
    }

    function update(){
      if (gameOver) return;
      spawnQueued();

      // move enemies
      for (let i=enemies.length-1;i>=0;i--){
        const e = enemies[i];
        const target = path[e.idx];
        if (!target){ lives--; enemies.splice(i,1); if (lives<=0) gameOver=true; continue; }
        const dx = target.x - e.x, dy = target.y - e.y;
        const d = Math.hypot(dx,dy)||1;
        if (d < e.spd) e.idx++; else { e.x += (dx/d)*e.spd; e.y += (dy/d)*e.spd; }
      }

      // towers actions
      for (let t of towers){
        if (t.cd > 0) t.cd--;
        else {
          let target = enemies.find(ev => (ev.x - t.x)**2 + (ev.y - t.y)**2 < (t.r**2));
          if (target){
            projs.push({ x: t.x, y: t.y, t: target, spd: 12, dmg: t.dmg, color: t.color });
            t.cd = t.maxCd;
          }
        }
      }

      // projectiles
      for (let i = projs.length-1; i>=0; i--){
        const p = projs[i];
        if (!p.t || p.t.dead){ projs.splice(i,1); continue; }
        const dx = p.t.x - p.x, dy = p.t.y - p.y;
        const d = Math.hypot(dx,dy)||1;
        if (d < p.spd){ p.t.hp -= p.dmg; spawnParticles(p.t.x,p.t.y,p.color,6); if (p.t.hp <= 0){ p.t.dead=true; money += p.t.val || 12; } projs.splice(i,1); }
        else { p.x += (dx/d)*p.spd; p.y += (dy/d)*p.spd; }
      }

      // particles
      for (let i = particles.length-1;i>=0;i--){ const P = particles[i]; P.x += P.vx; P.y += P.vy; P.life--; if (P.life <= 0) particles.splice(i,1); }

      // end wave check
      if (active && enemies.length === 0 && queue.length === 0){ active=false; wave++; money += 120 + wave*30; }
    }

    function draw(ctx){
      if (!ctx) return;
      const W = canvas.width, H = canvas.height;
      // background
      const g = ctx.createLinearGradient(0,0,0,H); g.addColorStop(0,'#02050a'); g.addColorStop(1,'#031217');
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

      // rails
      ctx.lineCap = 'round';
      ctx.strokeStyle = '#102a10'; ctx.lineWidth = 26; ctx.beginPath();
      path.forEach((p,i)=> i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
      ctx.stroke();
      ctx.strokeStyle = '#44ffaa'; ctx.lineWidth = 2; ctx.stroke();

      // towers
      for (let t of towers){
        ctx.save(); ctx.shadowBlur = 12; ctx.shadowColor = t.color; ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(t.x,t.y,12,0,Math.PI*2); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(t.x,t.y,7,0,Math.PI*2); ctx.fill();
      }

      // enemies
      for (let e of enemies){
        drawEnemy(ctx, e);
      }

      // projectiles and particles
      for (let p of projs){ ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill(); }
      for (let P of particles){ ctx.fillStyle = P.color; ctx.fillRect(P.x,P.y,2,2); }

      // HUD
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(10,10,180,44);
      ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.fillText(`Wave ${wave}`,20,32);
      ctx.fillStyle = '#ffd700'; ctx.fillText(`$${Math.floor(money)}`,100,32);
    }

    function drawEnemy(ctx, e){
      ctx.save();
      if (quality === 'high') ctx.shadowBlur = 14, ctx.shadowColor = e.color;
      const g = ctx.createRadialGradient(e.x-4,e.y-4,2,e.x,e.y,12); g.addColorStop(0,e.color); g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(e.x,e.y,9,0,Math.PI*2); ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(e.x,e.y,5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(e.x-10,e.y-14,20,3);
      ctx.fillStyle = '#0f0'; ctx.fillRect(e.x-10,e.y-14,20*(e.hp/e.maxHp),3);
    }

    function click(x,y){
      // disallow placing too close to path nodes
      for (let p of path) if ((p.x - x)**2 + (p.y - y)**2 < 30*30) return;
      const clicked = towers.find(t => (t.x - x)**2 + (t.y - y)**2 < 16*16);
      if (clicked){ sel = clicked; build = null; return; }
      if (build){
        const def = conf.towers[build];
        if (!def || money < def.cost) return;
        const T = { x, y, type: build, name: def.name, color: def.color, r: def.r, dmg: def.dmg, maxCd: def.cd, cd:0, level:1, val: Math.floor(def.cost*0.6) };
        // store towers coordinates as pixel positions
        towers.push(T);
        money -= def.cost;
        spawnParticles(x,y,'#fff',10);
        if (placementSingle) setBuild(null);
      } else sel = null;
    }

    function setBuild(k){ build = k; sel = null; }
    function setPlacementMode(single){ placementSingle = !!single; }
    function upgrade(){ if (!sel) return; const def = conf.towers[sel.type]; const cost = Math.floor(def.cost * 0.9 * (sel.level||1)); if (money < cost) return; money -= cost; sel.level++; sel.dmg = Math.floor(sel.dmg*1.6); sel.r = Math.floor(sel.r*1.12); sel.maxCd = Math.max(2, Math.floor(sel.maxCd*0.88)); spawnParticles(sel.x, sel.y, '#0F0', 14); }
    function sell(){ if (!sel) return; money += sel.val || 20; towers = towers.filter(t=>t!==sel); sel = null; }

    function spawnParticles(x,y,color,n){ for (let i=0;i<n;i++) particles.push({ x: x + rand(-6,6), y: y + rand(-6,6), vx: rand(-1,1), vy: rand(-1,1), life: 8 + Math.floor(Math.random()*8), color }); }

    function setDifficulty(d){ difficulty = d; diffMult = (d==='easy'?0.8: d==='hard'?1.6:1.0); path = generatePathFor(d); }
    function setQuality(q){ quality = q; }

    // expose API
    return {
      init, update: update, draw, click, startWave, setBuild, upgrade, sell, reset, stop,
      conf: conf, setPlacementMode, setQuality, setDifficulty,
      get wave(){ return wave; }, get money(){ return money; }, get lives(){ return lives; }, get sel(){ return sel; }
    };
  })();

  // attach to window/module
  if (typeof window !== 'undefined') window.VectorGame = VectorValley;
  if (typeof module !== 'undefined') module.exports = VectorValley;
})(typeof window !== 'undefined' ? window : global);
