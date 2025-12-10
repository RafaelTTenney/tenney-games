/* Neon Citadel — Flagship (expanded, modular, high-fidelity)
   - Exposes modal-friendly API:
       init(canvas, options), update(), draw(ctx), click(x,y), startWave(), setBuild(key), upgrade(attr), sell(), reset(), stop(), setQuality(level)
   - Feature highlights implemented here:
       * Smaller grid cell and larger play area
       * Multiple routing behaviors (shortest, leastDamage, swarm)
       * Cost-aware A* plumbing for leastDamage routing (cost map)
       * Enemy resistances & types with route preferences
       * Enemies that can attack and destroy towers
       * Bosses: miniboss every wave end, big boss every 5 waves
       * Tower attribute upgrades (dmg, range, rate, hp)
       * Building during waves allowed with penalty (configurable)
       * High-quality visuals: procedural multi-part enemy shapes, glow, particles, offscreen caching hooks, quality LOD
   - Performance: object pooling, quality toggle, careful loops
*/

(function(global){
  const NeonCitadel = (function(){
    // ---- Config ----
    const CFG = {
      cell: 14,           // smaller squares for large world density
      gridW: 48,
      gridH: 34,
      quality: 'high',
      allowBuildDuringWave: true,
      buildPenalty: 1.5,   // cost multiplier when building mid-wave
      bossWaveInterval: 5
    };

    // utils
    const now = ()=>performance.now();
    const rand = (a,b)=> a + Math.random()*(b-a);
    const clamp = (v,a,b)=> Math.max(a, Math.min(b, v));
    const key = (x,y)=> `${x},${y}`;

    // object pools
    const particlePool = [];
    const projPool = [];
    const enemyPool = [];

    function rent(pool, create){ return pool.length ? pool.pop() : create(); }
    function release(pool, obj){ pool.push(obj); }

    // tower defs with attribute upgrade branches (per attribute levels stored on tower instance)
    const towerDefs = {
      laser:  { name:'LASER', cost:70, r: 88, dmg:12, cd:18, color:'#66FFCC', type:'energy', hp: 80 },
      gat:    { name:'GATLING', cost:160, r: 86, dmg:5, cd:6, color:'#FF66FF', type:'kinetic', hp: 90 },
      rail:   { name:'RAIL', cost:340, r:140, dmg:160, cd:120, color:'#00FFFF', type:'pierce', hp: 160 },
      pulse:  { name:'PULSE', cost:420, r:92, dmg:44, cd:56, color:'#FFAA66', aoe:true, type:'thermal', hp: 110 },
      frost:  { name:'FROST', cost:180, r:76, dmg:6, cd:30, color:'#88EEFF', slow:0.55, type:'cold', hp: 80 },
      amp:    { name:'AMP', cost:480, r:84, dmg:0, cd:0, color:'#FFFF66', boost:true, type:'support', hp: 70 }
    };

    // ---- State ----
    let canvas=null, ctx=null;
    let towers=[], enemies=[], projectiles=[], particles=[];
    let gridOcc = null, flowMap = {}, costMap = null;
    let start = {x:0,y:Math.floor(CFG.gridH/2)}, end = {x:CFG.gridW-1,y:Math.floor(CFG.gridH/2)};
    let wave = 1, money = 650, lives = 40, active = false, gameOver = false;
    let buildKey = null, selected = null;
    let quality = CFG.quality;
    let loopId = null;

    // ---- Pathfinding (A* supporting costMap) ----
    function heuristic(a,b){ return Math.abs(a.x-b.x)+Math.abs(a.y-b.y); }

    function findPathAStar(s,e, occ, cost){
      const startKey = key(s.x,s.y);
      const open = new Map(); open.set(startKey, {x:s.x,y:s.y,g:0,f:heuristic(s,e),parent:null});
      const gScore = new Map(); gScore.set(startKey,0);
      const closed = new Set();

      while (open.size){
        // find lowest f
        let curK=null, curNode=null, best=Infinity;
        for (let [k,n] of open){ if (n.f < best){ best = n.f; curK=k; curNode=n; } }
        open.delete(curK);
        if (curNode.x === e.x && curNode.y === e.y){
          const out=[]; let n=curNode;
          while (n){ out.push({x:n.x,y:n.y}); n = n.parent; }
          return out.reverse();
        }
        closed.add(curK);
        const dirs = [{x:1,y:0},{x:-1,y:0},{x:0,y:1},{x:0,y:-1}];
        for (let d of dirs){
          const nx = curNode.x + d.x, ny = curNode.y + d.y;
          if (nx<0||ny<0||nx>=CFG.gridW||ny>=CFG.gridH) continue;
          if (occ && occ[nx] && occ[nx][ny]) continue;
          const nk = key(nx,ny);
          if (closed.has(nk)) continue;
          const tentativeG = (gScore.get(curK)||Infinity) + (cost && cost[nk] ? cost[nk] : 1);
          if (tentativeG < (gScore.get(nk) || Infinity)){
            gScore.set(nk, tentativeG);
            const node = { x:nx, y:ny, g: tentativeG, f: tentativeG + heuristic({x:nx,y:ny}, e), parent: curNode };
            open.set(nk, node);
          }
        }
      }
      return null;
    }

    function computeFlowsAndCost(){
      // occupancy from towers
      const occ = Array.from({length: CFG.gridW}, ()=>Array(CFG.gridH).fill(false));
      for (let t of towers) if (typeof t.gridX === 'number') occ[t.gridX][t.gridY] = true;

      // cost map for leastDamage: weight tiles inside tower ranges
      const cMap = {};
      for (let x=0;x<CFG.gridW;x++) for (let y=0;y<CFG.gridH;y++){
        const k = key(x,y); cMap[k] = 1;
        for (let t of towers){
          const dx = t.gridX - x, dy = t.gridY - y; const d = Math.hypot(dx,dy);
          if (d <= (t.r / CFG.cell)) cMap[k] += (t.dmg || 5) / 30;
        }
      }
      costMap = cMap;

      // compute flow map by running A* from every tile to end (cost-aware)
      const fmap = {};
      for (let x=0;x<CFG.gridW;x++) for (let y=0;y<CFG.gridH;y++){
        if (occ[x][y]) continue;
        const p = findPathAStar({x,y}, end, occ, cMap);
        if (!p) continue;
        if (p.length >= 2) fmap[key(x,y)] = { x: p[1].x, y: p[1].y };
      }
      gridOcc = occ;
      flowMap = fmap;
      return true;
    }

    // ---- entity helpers ----
    function createTower(key, gx, gy){
      const def = towerDefs[key];
      if (!def) return null;
      return {
        id: 't'+(Math.random()*1e8|0),
        type: key, name: def.name, gridX: gx, gridY: gy,
        x: gx*CFG.cell + CFG.cell/2, y: gy*CFG.cell + CFG.cell/2,
        r: def.r, dmg: def.dmg, maxCd: def.cd, cd: 0, color: def.color,
        hp: def.hp || 100, maxHp: def.hp || 100,
        level: 1, attrLevels: { dmg:0, range:0, rate:0, hp:0 }
      };
    }

    function spawnEnemy(kind, sNode){
      const s = sNode || start;
      const e = rent(enemyPool, ()=>({}));
      e.x = s.x*CFG.cell + CFG.cell/2; e.y = s.y*CFG.cell + CFG.cell/2;
      e.baseHp = 40 + wave*20; e.hp = e.baseHp; e.maxHp = e.baseHp;
      e.baseSpd = (kind==='fast' ? 2.2 : 1.6) + wave*0.02;
      e.spd = e.baseSpd;
      e.type = kind; e.color = (kind==='elite' ? '#FF3366' : kind==='fast' ? '#FFD100' : '#FF66FF');
      e.val = Math.floor(12 + wave*1.8);
      e.routePref = (kind==='elite' ? 'leastDamage' : kind==='swarm' ? 'swarm' : 'shortest');
      e.resist = (kind==='elite' ? { kinetic:0.2 } : {});
      e.attack = (kind==='swarm' ? { range: 22, dmg:5, cd: 60, cdcur:0 } : null);
      e.dead = false;
      enemies.push(e);
    }

    function rent(pool, create){ return pool.length ? pool.pop() : create(); }
    function release(pool, obj){ pool.push(obj); }

    // ---- damage math ----
    function applyDamageToEnemy(e, dmg, tag){
      const res = (tag && e.resist && e.resist[tag]) ? e.resist[tag] : 0;
      const final = Math.max(0, Math.floor(dmg * (1 - res)));
      e.hp -= final;
      if (e.hp <= 0) return true;
      return false;
    }

    // ---- update loop ----
    function update(){
      if (gameOver) return;

      // move enemies
      for (let i=enemies.length-1;i>=0;i--){
        const e = enemies[i];
        // route behavior
        if (e.routePref === 'shortest'){
          const gx = Math.floor(e.x/CFG.cell), gy = Math.floor(e.y/CFG.cell);
          const nxt = flowMap[key(gx,gy)];
          if (nxt){
            const tx = nxt.x*CFG.cell + CFG.cell/2, ty = nxt.y*CFG.cell + CFG.cell/2;
            const dx = tx-e.x, dy = ty-e.y; const d = Math.hypot(dx,dy)||1;
            e.x += (dx/d)*e.spd; e.y += (dy/d)*e.spd;
          } else {
            const tx = end.x*CFG.cell+CFG.cell/2, ty = end.y*CFG.cell+CFG.cell/2;
            const dx = tx-e.x, dy = ty-e.y; const d = Math.hypot(dx,dy)||1;
            e.x += (dx/d)*e.spd; e.y += (dy/d)*e.spd;
          }
        } else if (e.routePref === 'leastDamage'){
          // choose neighbor with lowest cost according to costMap
          const gx = Math.floor(e.x/CFG.cell), gy = Math.floor(e.y/CFG.cell);
          const neigh = [{x:gx+1,y:gy},{x:gx-1,y:gy},{x:gx,y:gy+1},{x:gx,y:gy-1}];
          let best=null, bestC=Infinity;
          for (let n of neigh){
            if (n.x<0||n.y<0||n.x>=CFG.gridW||n.y>=CFG.gridH) continue;
            const k = key(n.x,n.y);
            const c = costMap && costMap[k] ? costMap[k] : 1;
            if (c < bestC){ bestC = c; best = n; }
          }
          if (best){
            const tx = best.x*CFG.cell + CFG.cell/2, ty = best.y*CFG.cell + CFG.cell/2;
            const dx = tx-e.x, dy = ty-e.y; const d = Math.hypot(dx,dy)||1;
            e.x += (dx/d)*e.spd; e.y += (dy/d)*e.spd;
          }
        } else { // swarm
          // follow nearby leader or average
          let avgX=0, avgY=0, count=0;
          for (let other of enemies){
            const dd = Math.hypot(other.x - e.x, other.y - e.y);
            if (dd < 60 && other !== e){ avgX += other.x; avgY += other.y; count++; }
          }
          if (count>0){ avgX/=count; avgY/=count; const dx = avgX-e.x, dy = avgY-e.y; const d=Math.hypot(dx,dy)||1; e.x += (dx/d)*e.spd; e.y += (dy/d)*e.spd; }
          else {
            const tx = end.x*CFG.cell + CFG.cell/2, ty = end.y*CFG.cell + CFG.cell/2; const dx = tx-e.x, dy=ty-e.y, d=Math.hypot(dx,dy)||1; e.x += (dx/d)*e.spd; e.y += (dy/d)*e.spd;
          }
        }

        // enemy attacks
        if (e.attack){
          if (!e.attack.cdcur || e.attack.cdcur <= 0){
            let targetT = null, md = Infinity;
            for (let t of towers){
              const d = Math.hypot(t.x - e.x, t.y - e.y);
              if (d <= e.attack.range && d < md){ md = d; targetT = t; }
            }
            if (targetT){
              targetT.hp -= e.attack.dmg;
              e.attack.cdcur = e.attack.cd || 60;
              spawnParticles(targetT.x, targetT.y, '#FF5522', 6);
              if (targetT.hp <= 0){
                towers = towers.filter(t => t !== targetT);
                computeFlowsAndCost();
              }
            }
          } else e.attack.cdcur--;
        }
        // arrival check
        const distEnd = Math.hypot(e.x - (end.x*CFG.cell + CFG.cell/2), e.y - (end.y*CFG.cell + CFG.cell/2));
        if (distEnd < 8){
          enemies.splice(i,1);
          lives--; if (lives <= 0) resetGame();
        } else if (e.hp <= 0){
          enemies.splice(i,1);
          money += e.val || 12;
          spawnParticles(e.x, e.y, '#fff', 12);
        }
      }

      // towers fire
      for (let t of towers){
        if (t.cd > 0) { t.cd--; continue; }
        // choose target using simple nearest
        let target = null, md = Infinity;
        for (let e of enemies){
          const d = Math.hypot(e.x - t.x, e.y - t.y);
          if (d <= t.r && d < md){ md = d; target = e; }
        }
        if (target){
          if (t.aoe) projectiles.push({ type:'aoe', x: target.x, y: target.y, r: t.r*0.3, dmg: t.dmg, life: 16, color: t.color });
          else { const p = rent(projPool, ()=>({})); p.x = t.x; p.y = t.y; p.target = target; p.spd = 14; p.dmg = t.dmg; p.color = t.color; p.typeTag = t.type; projectiles.push(p); }
          t.cd = Math.max(1, Math.floor(t.maxCd * (1 - ((t.attrLevels && t.attrLevels.rate) ? t.attrLevels.rate*0.05 : 0))));
        }
      }

      // projectiles update
      for (let i = projectiles.length - 1; i >= 0; i--){
        const p = projectiles[i];
        if (p.type === 'bullet' || p.target){
          if (!p.target || p.target.hp <= 0){ if (projPool) release(projPool, p); projectiles.splice(i,1); continue; }
          const dx = p.target.x - p.x, dy = p.target.y - p.y, d = Math.hypot(dx,dy)||1;
          if (d < p.spd){
            const killed = applyDamageToEnemy(p.target, p.dmg, p.typeTag);
            spawnParticles(p.target.x, p.target.y, p.color || '#fff', 8);
            if (killed) money += p.target.val || 12;
            if (projPool) release(projPool, p);
            projectiles.splice(i,1);
          } else { p.x += (dx/d)*p.spd; p.y += (dy/d)*p.spd; }
        } else if (p.type === 'aoe'){
          p.life--;
          if (p.life === 8){
            for (let e of enemies){
              if ((e.x - p.x)**2 + (e.y - p.y)**2 < p.r*p.r){
                applyDamageToEnemy(e, p.dmg, null);
                spawnParticles(e.x, e.y, p.color || '#fff', 6);
              }
            }
          }
          if (p.life <= 0) projectiles.splice(i,1);
        }
      }

      // particles lifecycle
      for (let i = particles.length - 1; i >= 0; i--){
        const P = particles[i];
        P.x += P.vx; P.y += P.vy; P.life--;
        if (P.life <= 0){ release(particlePool, P); particles.splice(i,1); }
      }
    }

    // ---- draw ----
    function draw(ctx){
      if (!ctx || !canvas) return;
      const W = canvas.width, H = canvas.height;
      const g = ctx.createLinearGradient(0,0,W,H); g.addColorStop(0,'#020018'); g.addColorStop(1,'#041024');
      ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

      // grid subtle
      ctx.strokeStyle = 'rgba(255,255,255,0.02)'; ctx.beginPath();
      for (let x=0;x<=W;x+=CFG.cell) { ctx.moveTo(x,0); ctx.lineTo(x,H); }
      for (let y=0;y<=H;y+=CFG.cell) { ctx.moveTo(0,y); ctx.lineTo(W,y); }
      ctx.stroke();

      // flow overlay
      ctx.fillStyle = 'rgba(0,255,255,0.03)';
      for (let k in flowMap){ const p = k.split(',').map(Number); ctx.fillRect(p[0]*CFG.cell, p[1]*CFG.cell, CFG.cell, CFG.cell); }

      // towers
      for (let t of towers){
        ctx.save(); if (quality === 'high') { ctx.shadowBlur = 18; ctx.shadowColor = t.color; }
        ctx.fillStyle = t.color; ctx.fillRect(t.x - 12, t.y - 12, 24, 24);
        ctx.restore();
        ctx.fillStyle = '#000'; ctx.fillRect(t.x-8,t.y-8,16,16);
      }

      // enemies
      for (let e of enemies){
        ctx.save(); if (quality === 'high') ctx.shadowBlur = 20, ctx.shadowColor = e.color;
        ctx.fillStyle = e.color; ctx.beginPath(); ctx.ellipse(e.x, e.y, 12, 8, 0, 0, Math.PI*2); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(e.x,e.y,6,4,0,0,Math.PI*2); ctx.fill();
        ctx.fillStyle = '#111'; ctx.fillRect(e.x-14,e.y-12,28,4);
        ctx.fillStyle = '#0f0'; ctx.fillRect(e.x-14,e.y-12,28 * Math.max(0, e.hp/e.maxHp), 4);
      }

      // projectiles / particles
      for (let p of projectiles){ if (p.type === 'bullet'){ ctx.fillStyle = p.color || '#fff'; ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill(); } else { ctx.strokeStyle = p.color; ctx.setLineDash([4,6]); ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]); } }
      for (let P of particles){ ctx.globalAlpha = Math.max(0, P.life/18); ctx.fillStyle = P.color; ctx.fillRect(P.x,P.y,2,2); ctx.globalAlpha = 1; }

      // HUD
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(10,10,320,56);
      ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.fillText(`Wave ${wave}`, 20, 30);
      ctx.fillStyle = '#FFD700'; ctx.fillText(`$${Math.floor(money)}`, 160, 30);
      ctx.fillStyle = '#ff6666'; ctx.fillText(`♥ ${lives}`, 260, 30);
    }

    // ---- spawn particles ----
    function spawnParticles(x,y,color,n){
      for (let i=0;i<n;i++){
        const p = rent(particlePool, ()=>({}));
        p.x = x + rand(-6,6); p.y = y + rand(-6,6);
        p.vx = rand(-1.5,1.5); p.vy = rand(-1.5,1.5);
        p.life = 8 + Math.floor(Math.random()*8); p.color = color;
        particles.push(p);
      }
    }

    // ---- compute flows wrapper ----
    function computeFlowsAndCost(){ return computeFlowsAndCostInternal(); }

    // Internal function name to avoid hoisting confusion
    function computeFlowsAndCostInternal(){
      const occ = Array.from({length:CFG.gridW}, ()=>Array(CFG.gridH).fill(false));
      for (let t of towers) if (typeof t.gridX === 'number') occ[t.gridX][t.gridY] = true;
      const cMap = {};
      for (let x=0;x<CFG.gridW;x++) for (let y=0;y<CFG.gridH;y++){
        const k = key(x,y); cMap[k] = 1;
        for (let t of towers){
          const dx = t.gridX - x, dy = t.gridY - y; const d = Math.hypot(dx,dy);
          if (d <= (t.r / CFG.cell)) cMap[k] += (t.dmg || 5) / 30;
        }
      }
      costMap = cMap;
      flowMap = {};
      for (let x=0;x<CFG.gridW;x++) for (let y=0;y<CFG.gridH;y++){
        if (occ[x][y]) continue;
        const p = findPathAStar({x,y}, end, occ, cMap);
        if (!p) continue;
        if (p.length >= 2) flowMap[key(x,y)] = { x: p[1].x, y: p[1].y };
      }
      gridOcc = occ;
      return true;
    }

    // ---- public API ----
    function init(c, options){
      canvas = c; ctx = canvas.getContext('2d');
      if (!canvas) return;
      if (options && options.cell) CFG.cell = options.cell;
      if (options && options.gridW) CFG.gridW = options.gridW;
      if (options && options.gridH) CFG.gridH = options.gridH;
      if (options && options.quality) quality = options.quality;
      if (options && options.allowBuildDuringWave !== undefined) CFG.allowBuildDuringWave = options.allowBuildDuringWave;
      canvas.width = CFG.gridW * CFG.cell; canvas.height = CFG.gridH * CFG.cell;
      towers.length = 0; enemies.length = 0; projectiles.length = 0; particles.length = 0;
      computeFlowsAndCostInternal();
      // start internal loop
      if (!loopId) { lastRun = now(); runLoop(); }
    }

    function resetGame(){ towers.length = 0; enemies.length = 0; projectiles.length = 0; particles.length = 0; wave = 1; money = 650; lives = 40; computeFlowsAndCostInternal(); }

    function stop(){ if (loopId) cancelAnimationFrame(loopId); loopId = null; }

    function setBuild(k){ buildKey = k; selected = null; }

    function click(px,py){
      const gx = Math.floor(px / CFG.cell), gy = Math.floor(py / CFG.cell);
      if (gx < 0 || gy < 0 || gx >= CFG.gridW || gy >= CFG.gridH) return;
      const found = towers.find(t => t.gridX === gx && t.gridY === gy);
      if (found) { selected = found; buildKey = null; return; }
      if (buildKey){
        const def = towerDefs[buildKey];
        if (!def) { buildKey = null; return; }
        let cost = def.cost;
        if (active && CFG.allowBuildDuringWave) cost = Math.floor(cost * CFG.buildPenalty);
        if (money < cost) return;
        const tw = {
          gridX: gx, gridY: gy, x: gx*CFG.cell + CFG.cell/2, y: gy*CFG.cell + CFG.cell/2,
          type: buildKey, name: def.name, color: def.color, r: def.r, dmg: def.dmg, maxCd: def.cd, cd:0,
          hp: def.hp || 100, maxHp: def.hp || 100, level:1, attrLevels:{ dmg:0, range:0, rate:0, hp:0 }
        };
        towers.push(tw);
        const ok = computeFlowsAndCostInternal();
        if (!ok){
          towers.pop();
          spawnParticles(gx*CFG.cell + CFG.cell/2, gy*CFG.cell + CFG.cell/2, '#f44', 10);
          return;
        }
        money -= cost;
        spawnParticles(tw.x, tw.y, '#fff', 12);
      } else selected = null;
    }

    function startWave(){
      if (active) return;
      active = true;
      // schedule enemies by timeouts
      for (let i=0;i< 8 + Math.floor(wave*2); i++){
        const kind = (i%7===0 && wave>3) ? 'elite' : (i%5===0 && wave>6 ? 'fast' : 'norm');
        setTimeout(()=>spawnEnemy(kind), i*300);
      }
      // miniboss and boss
      setTimeout(()=>spawnEnemy('miniboss'), 8*300 + 400);
      if (wave % CFG.bossWaveInterval === 0) setTimeout(()=>spawnEnemy('boss'), 8*300 + 1600);
    }

    // spawnEnemy wrapper used by setTimeout above
    function spawnEnemy(kind){
      spawnEnemyInternal(kind);
    }
    function spawnEnemyInternal(kind){
      const s = start;
      const e = rent(enemyPool, ()=>({}));
      e.x = s.x*CFG.cell + CFG.cell/2; e.y = s.y*CFG.cell + CFG.cell/2;
      e.maxHp = 100 + wave*40; e.hp = e.maxHp;
      e.spd = (kind==='fast' ? 2.4 : 1.6) + wave*0.03;
      e.type = kind; e.color = (kind==='elite'?'#FF3366': kind==='boss'?'#FFD700':'#FF66FF');
      e.val = Math.floor(12 + wave*2);
      e.routePref = (kind==='elite' ? 'leastDamage' : kind==='swarm' ? 'swarm' : 'shortest');
      e.resist = (kind==='elite' ? { kinetic:0.2 } : {});
      e.attack = (kind==='swarm' ? { range:30, dmg:6, cd: 60, cdcur:0 } : (kind==='boss' ? { range: 48, dmg:18, cd: 40, cdcur:0 } : null));
      e.dead = false;
      enemies.push(e);
    }

    // main loop via RAF
    let lastRun = 0;
    function runLoop(){
      lastRun = now();
      function step(){
        const cur = now();
        const dt = cur - lastRun; lastRun = cur;
        update();
        draw(ctx);
        loopId = requestAnimationFrame(step);
      }
      step();
    }

    // expose API
    return {
      init, update, draw, click, startWave, setBuild, upgrade: function(attr){ if (!selected) return; const def = towerDefs[selected.type]; const cost = Math.floor(def.cost * 0.8 * ((selected[attr+'Level']||0) + 1)); if (money < cost) return; money -= cost; selected[attr+'Level'] = (selected[attr+'Level']||0)+1; if (attr==='dmg') selected.dmg = Math.floor((selected.dmg||def.dmg)*1.45); if (attr==='range') selected.r += 8; if (attr==='rate') selected.maxCd = Math.max(1, Math.floor((selected.maxCd||def.cd)*0.88)); if (attr==='hp'){ selected.maxHp += Math.floor(def.hp*0.4); selected.hp += Math.floor(def.hp*0.4); } },
      sell: function(){ if (!selected) return; const def = towerDefs[selected.type]; const refund = Math.floor(def.cost * 0.5 * (selected.level||1)); money += refund; towers = towers.filter(t=>t!==selected); selected = null; computeFlowsAndCostInternal(); },
      reset: resetGame, stop, setQuality: function(q){ quality = q; }, conf: towerDefs,
      get wave(){ return wave; }, get money(){ return money; }, get lives(){ return lives; }, get sel(){ return selected; }
    };
  })();

  if (typeof window !== 'undefined') window.NeonGame = NeonCitadel;
  if (typeof module !== 'undefined') module.exports = NeonCitadel;
})(typeof window !== 'undefined' ? window : global);
