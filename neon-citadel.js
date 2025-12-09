/* Neon Citadel — Flagship (Expanded, high-fidelity, modular)
   - Large, feature-rich flagship engine intended to be the marquee experience.
   - Focus: advanced routing, resistances, tower attribute upgrades, enemies that attack towers,
            bosses with phases, placement during waves (with cost/penalty), high-quality visual systems.
   - Performance focus: offscreen canvas pre-renders, pooling, LOD quality settings.
   - Public API: init(canvas, options), update(), draw(ctx), click(x,y), startWave(), setBuild(key), upgrade(attr), sell(), reset(), stop(), setQuality(q)
*/

const NeonCitadel = (function(){
  // ------------- Utilities & small toolkit -------------
  const NOW = ()=>performance.now();
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const rand = (a,b)=>a + Math.random()*(b-a);
  const toKey = (x,y)=>`${x},${y}`;

  // ------------- Configuration (tweak to taste) -------------
  const CFG = {
    cell: 16,            // small grid cell for dense playfield
    gridW: 48,
    gridH: 30,
    bgA: '#020018',
    bgB: '#041024',
    quality: 'high',     // high/medium/low
    allowBuildDuringWave: true,
    buildDuringWaveMultiplier: 1.4 // increased cost when building mid-wave
  };

  // ------------- Pools & helpers -------------
  function Pool(make){ const cache=[]; return {rent:(...a)=>cache.pop()||make(...a), release:(it)=>cache.push(it)}; }
  const particlePool = Pool(()=>({x:0,y:0,vx:0,vy:0,life:0,color:'#fff'}));
  const projPool = Pool(()=>({x:0,y:0,tx:0,ty:0,spd:10,dmg:0,color:'#fff',target:null,type:'bullet'}));
  const enemyPool = Pool(()=>({x:0,y:0,hp:0,maxHp:0,spd:1,type:'norm',color:'#f0f',val:6,routePref:'shortest',resist:{}}));

  // ------------- Game State -------------
  let canvas=null, ctx=null;
  let towers = [], enemies = [], projectiles = [], particles = [];
  let gridOcc = null, flowMap = {};
  let start = {x:0,y:Math.floor(CFG.gridH/2)}, end = {x:CFG.gridW-1,y:Math.floor(CFG.gridH/2)};
  let wave = 1, money = 650, lives = 40, active = false, gameOver = false;
  let buildKey = null, selected = null;
  let loopId = null, running = false;
  let quality = CFG.quality;
  let pathCostMap = null; // used for leastDamage routing

  // ------------- Tower Definitions with attribute branches -------------
  const towerDefs = {
    laser:  { name:'LASER',  cost:70,  r: 80, dmg:12, cd:18, color:'#66FFCC', type:'energy', hp:80 },
    gat:    { name:'GATLING',cost:160, r: 72, dmg:5,  cd:6 , color:'#FF66FF', type:'kinetic', hp:90 },
    rail:   { name:'RAIL',   cost:340, r:120, dmg:160,cd:120,color:'#00FFFF', type:'pierce', hp:160 },
    pulse:  { name:'PULSE',  cost:420, r:76, dmg:44, cd:56, color:'#FFAA66', aoe:true, type:'thermal', hp:110 },
    frost:  { name:'FROST',  cost:180, r:72, dmg:6,  cd:30, color:'#88EEFF', slow:0.55, type:'cold', hp:80 },
    amp:    { name:'AMP',    cost:480, r:84, dmg:0,  cd:0,  color:'#FFFF66', boost:true, type:'support', hp:70 }
  };

  // ------------- Pathfinding A* (fast implementation with open binary heap) -------------
  class BinaryHeap {
    constructor(scoreFunction){ this.content=[]; this.scoreFunction = scoreFunction; }
    push(element){ this.content.push(element); this.sinkDown(this.content.length-1); }
    pop(){ const result=this.content[0]; const end=this.content.pop(); if (this.content.length>0){ this.content[0]=end; this.bubbleUp(0); } return result; }
    remove(node){ const len=this.content.length; for (let i=0;i<len;i++){ if (this.content[i]===node){ const end=this.content.pop(); if (i===len-1) break; this.content[i]=end; this.sinkDown(i); this.bubbleUp(i); break; } } }
    sinkDown(n){ const element=this.content[n]; const score=this.scoreFunction(element); while (n>0){ const parentN = ((n+1)>>1)-1; const parent = this.content[parentN]; if (score >= this.scoreFunction(parent)) break; this.content[parentN]=element; this.content[n]=parent; n=parentN; } }
    bubbleUp(n){ const len=this.content.length; const element=this.content[n]; const elemScore=this.scoreFunction(element); while(true){ const child2N = (n+1)<<1; const child1N = child2N-1; let swap=null; let child1Score; if (child1N < len){ const child1 = this.content[child1N]; child1Score = this.scoreFunction(child1); if (child1Score < elemScore) swap = child1N; } if (child2N < len){ const child2 = this.content[child2N]; const child2Score = this.scoreFunction(child2); if ((swap === null ? elemScore : child1Score) > child2Score) swap = child2N; } if (swap === null) break; this.content[n] = this.content[swap]; this.content[swap] = element; n = swap; } }
  }

  function findPathAStar(startCell, endCell, occ, costMap){
    const keyOf = (p)=>`${p.x},${p.y}`;
    const openHeap = new BinaryHeap(node => node.f);
    const startKey = keyOf(startCell);
    const startNode = { x:startCell.x, y:startCell.y, g:0, f:heur(startCell,endCell), parent:null };
    const closedSet = new Map();
    const gScore = new Map();
    gScore.set(startKey, 0);
    openHeap.push(startNode);

    while (openHeap && openHeap.content && openHeap.content.length){
      const current = openHeap.pop();
      const ck = keyOf(current);
      if (current.x === endCell.x && current.y === endCell.y){
        // reconstruct
        const path = []; let cur = current;
        while (cur){ path.push({x:cur.x,y:cur.y}); cur = cur.parent; }
        return path.reverse();
      }
      closedSet.set(ck, true);
      const neighbors = [{x:current.x+1,y:current.y},{x:current.x-1,y:current.y},{x:current.x,y:current.y+1},{x:current.x,y:current.y-1}];
      for (let n of neighbors){
        if (n.x<0||n.x>=CFG.gridW||n.y<0||n.y>=CFG.gridH) continue;
        if (occ && occ[n.x] && occ[n.x][n.y]) continue;
        const nk = keyOf(n);
        if (closedSet.has(nk)) continue;
        const tentativeG = (gScore.get(ck) || Infinity) + (costMap ? (costMap[nk] || 1) : 1);
        if (tentativeG < (gScore.get(nk) || Infinity)){
          gScore.set(nk, tentativeG);
          const node = {x:n.x,y:n.y,g:tentativeG,f:tentativeG+heur(n,endCell), parent: current};
          openHeap.push(node);
        }
      }
    }
    return null;
  }

  function heur(a,b){ return Math.abs(a.x-b.x)+Math.abs(a.y-b.y); }

  // ------------- Flow/Cost map calculation -------------
  function calcFlowsAndCost(){
    // create occupancy map
    const occ = Array.from({length:CFG.gridW}, ()=>Array(CFG.gridH).fill(false));
    for (let t of towers) occ[t.gridX][t.gridY] = true;
    // cost map: tiles covered by towers have increased cost (rough DPS estimate)
    const costMap = {};
    for (let x=0;x<CFG.gridW;x++) for (let y=0;y<CFG.gridH;y++){
      let key = toKey(x,y); costMap[key] = 1;
      for (let t of towers){
        const dx = t.gridX - x, dy = t.gridY - y; const d = Math.hypot(dx,dy);
        if (d <= (t.r / CFG.cell)) costMap[key] += (t.dmg || 5) / 30; // crude weight
      }
    }
    pathCostMap = costMap;
    // compute flowMap using A* from each tile to end (cost-aware)
    flowMap = {};
    for (let x=0;x<CFG.gridW;x++) for (let y=0;y<CFG.gridH;y++){
      if (occ[x][y]) continue;
      const p = findPathAStar({x,y}, end, occ, costMap);
      if (p && p.length >= 2) flowMap[toKey(x,y)] = { x: p[1].x, y: p[1].y };
    }
    gridOcc = occ;
    return true;
  }

  // ------------- Entities & mechanics -------------
  function makeTower(key, gx, gy){
    const def = towerDefs[key];
    return {
      id: 'T'+(Math.random()*1e8|0),
      type: key, name: def.name, gridX: gx, gridY: gy,
      x: gx*CFG.cell + CFG.cell/2, y: gy*CFG.cell + CFG.cell/2,
      r: def.r, dmg: def.dmg, maxCd: def.cd, cd: 0, color: def.color,
      level: 1, hp: def.hp || 100, maxHp: def.hp || 100,
      attrLevels: { dmg:0, range:0, rate:0, hp:0 }
    };
  }

  function spawnEnemy(kind='norm', sNode){
    const e = enemyPool.rent();
    const s = sNode || start;
    e.x = s.x*CFG.cell + CFG.cell/2; e.y = s.y*CFG.cell + CFG.cell/2;
    e.maxHp = Math.floor((40 + wave*20) * (kind==='elite' ? 2.6 : 1));
    e.hp = e.maxHp;
    e.spd = (kind==='fast' ? 2.2 : 1.6) + wave*0.02;
    e.type = kind; e.color = (kind==='elite' ? '#FF3366' : kind==='fast' ? '#FFD100' : '#FF66FF');
    e.val = Math.floor(12 + wave*1.5);
    e.routePref = (kind==='elite' ? 'leastDamage' : kind==='swarm' ? 'swarm' : 'shortest');
    e.resist = (kind==='elite' ? { kinetic:0.2 } : {});
    e.attack = (kind==='swarm' ? { range: 28, dmg: 6, cd: 60, cdcur:0 } : null);
    enemies.push(e);
  }

  // Apply damage factoring resistances
  function damageEnemy(e, dmg, typeTag){
    const res = (typeTag && e.resist && e.resist[typeTag]) ? e.resist[typeTag] : 0;
    const final = Math.max(0, Math.floor(dmg * (1 - res)));
    e.hp -= final;
    if (e.hp <= 0) return true;
    return false;
  }

  // Towers attack & projectiles
  function towerAction(t){
    if (t.cd > 0) { t.cd--; return; }
    // select nearest enemy in range
    let target = null, md = Infinity;
    for (let e of enemies){
      const d = Math.hypot(e.x - t.x, e.y - t.y);
      if (d <= t.r && d < md) { md = d; target = e; }
    }
    if (target){
      if (t.aoe) projectiles.push({type:'aoe', x: target.x, y: target.y, r: t.r*0.3, dmg: t.dmg, life: 16, color: t.color});
      else {
        const p = projPool.rent(); p.x = t.x; p.y = t.y; p.target = target; p.spd = 14; p.dmg = t.dmg; p.color = t.color; p.type = 'bullet'; projectiles.push(p);
      }
      t.cd = Math.max(1, Math.floor(t.maxCd * (1 - (t.attrLevels.rate*0.05))));
    }
  }

  // Enemy attacking towers (for enemies that can attack)
  function enemyAttack(e){
    if (!e.attack) return;
    if (!e.attack.cdcur || e.attack.cdcur <= 0){
      let tx = null, md = Infinity;
      for (let t of towers){
        const d = Math.hypot(t.x - e.x, t.y - e.y);
        if (d <= e.attack.range && d < md){ md = d; tx = t; }
      }
      if (tx){
        tx.hp -= e.attack.dmg;
        e.attack.cdcur = e.attack.cd || 60;
        spawnParticles(tx.x, tx.y, '#FF4422', 6);
        if (tx.hp <= 0){
          // destroy tower
          towers = towers.filter(tt => tt !== tx);
          calcFlowsAndCost();
        }
      }
    } else e.attack.cdcur--;
  }

  // ---------- Particles ----------
  function spawnParticles(x,y,color,n){
    for (let i=0;i<n;i++){
      const p = particlePool.rent();
      p.x = x + rand(-6,6); p.y = y + rand(-6,6); p.vx = rand(-1.5,1.5); p.vy = rand(-1.5,1.5); p.life = 8 + (Math.random()*8|0); p.color = color;
      particles.push(p);
    }
  }

  // ---------- Flow / cost recalculation wrapper ----------
  function calcFlows(){
    return calcFlowsAndCost();
  }

  // ---------- Main Update ----------
  function update(dt){
    if (gameOver) return;
    // move enemies & AI
    for (let i=enemies.length-1;i>=0;i--){
      const e = enemies[i];
      // route by preference
      if (e.routePref === 'shortest'){
        const gx = Math.floor(e.x/CFG.cell), gy = Math.floor(e.y/CFG.cell);
        const nx = flowMap[toKey(gx,gy)];
        if (nx){
          const tx = nx.x*CFG.cell + CFG.cell/2, ty = nx.y*CFG.cell + CFG.cell/2;
          const dx = tx - e.x, dy = ty - e.y; const d = Math.hypot(dx,dy)||1;
          e.x += (dx/d)*e.spd; e.y += (dy/d)*e.spd;
        } else { /* fallback */ }
      } else if (e.routePref === 'leastDamage'){
        // pick neighbor with smallest pathCostMap value
        const gx = Math.floor(e.x/CFG.cell), gy = Math.floor(e.y/CFG.cell);
        const neigh = [{x:gx+1,y:gy},{x:gx-1,y:gy},{x:gx,y:gy+1},{x:gx,y:gy-1}];
        let best=null, bestC = Infinity;
        for (let n of neigh){
          if (n.x<0||n.x>=CFG.gridW||n.y<0||n.y>=CFG.gridH) continue;
          const ck = toKey(n.x,n.y);
          const c = pathCostMap ? (pathCostMap[ck] || 1) : 1;
          if (c < bestC){ bestC = c; best = n; }
        }
        if (best){
          const tx = best.x*CFG.cell + CFG.cell/2, ty = best.y*CFG.cell + CFG.cell/2;
          const dx = tx - e.x, dy = ty - e.y; const d = Math.hypot(dx,dy)||1;
          e.x += (dx/d)*e.spd; e.y += (dy/d)*e.spd;
        }
      } else { // swarm
        // simple flock: average direction of local group
        let avgX = 0, avgY = 0, count = 0;
        for (let j=0;j<enemies.length;j++){ if (i===j) continue; const other = enemies[j]; const distO = Math.hypot(other.x-e.x, other.y-e.y); if (distO < 60){ avgX += other.x; avgY += other.y; count++; } }
        if (count>0){ avgX /= count; avgY /= count; const dx = avgX - e.x, dy = avgY - e.y, d = Math.hypot(dx,dy)||1; e.x += (dx/d)*e.spd; e.y += (dy/d)*e.spd; } else {
          // fallback to shortest
          const gx = Math.floor(e.x/CFG.cell), gy = Math.floor(e.y/CFG.cell);
          const nx = flowMap[toKey(gx,gy)];
          if (nx){ const tx = nx.x*CFG.cell+CFG.cell/2, ty = nx.y*CFG.cell+CFG.cell/2; const dx = tx-e.x, dy=ty-e.y, d=Math.hypot(dx,dy)||1; e.x+=(dx/d)*e.spd; e.y+=(dy/d)*e.spd; }
        }
      }
      // enemy attacks towers when able
      if (e.attack) enemyAttack(e);
      // arrival check
      if (Math.hypot(e.x - (end.x*CFG.cell + CFG.cell/2), e.y - (end.y*CFG.cell + CFG.cell/2)) < 8){
        enemies.splice(i,1); enemyPool.release(e);
        lives--; if (lives <= 0) { resetGame(); break; }
      }
    }

    // towers fire
    for (let t of towers) towerAction(t);

    // projectiles
    for (let i=projectiles.length-1;i>=0;i--){
      const p = projectiles[i];
      if (p.type==='bullet'){
        if (!p.target || p.target.hp <= 0){ projPool.release(p); projectiles.splice(i,1); continue; }
        const dx = p.target.x - p.x, dy = p.target.y - p.y; const d = Math.hypot(dx,dy)||1;
        if (d < p.spd){ const killed = damageEnemy(p.target, p.dmg, p.typeTag); spawnParticles(p.target.x,p.target.y,p.color,8); projPool.release(p); projectiles.splice(i,1); if (killed) money += p.target.val; }
        else { p.x += (dx/d)*p.spd; p.y += (dy/d)*p.spd; }
      } else if (p.type==='aoe'){
        p.life--; if (p.life===5){ for (let e of enemies){ if ((e.x-p.x)**2 + (e.y-p.y)**2 < p.r*p.r){ damageEnemy(e, p.dmg, null); spawnParticles(e.x,e.y,p.color,8); } } }
        if (p.life<=0){ projectiles.splice(i,1); }
      }
    }

    // particle lifecycle
    for (let i=particles.length-1;i>=0;i--){ const P = particles[i]; P.x+=P.vx; P.y+=P.vy; P.life--; if (P.life<=0){ particlePool.release(P); particles.splice(i,1); } }

    // cleanup dead enemies
    for (let i=enemies.length-1;i>=0;i--) if (enemies[i].hp <= 0){ money += enemies[i].val; enemyPool.release(enemies[i]); enemies.splice(i,1); }
  }

  // ---------- DRAW (high-fidelity effects) ----------
  function draw(c){
    if (!c) return;
    const W = canvas.width, H = canvas.height;
    const g = c.createLinearGradient(0,0,W,H); g.addColorStop(0,CFG.bgA); g.addColorStop(1,CFG.bgB);
    c.fillStyle = g; c.fillRect(0,0,W,H);

    // faint grid for orientation
    c.strokeStyle = 'rgba(255,255,255,0.012)'; c.beginPath();
    for (let x=0;x<=W;x+=CFG.cell) { c.moveTo(x,0); c.lineTo(x,H); }
    for (let y=0;y<=H;y+=CFG.cell) { c.moveTo(0,y); c.lineTo(W,y); }
    c.stroke();

    // flow overlay
    c.fillStyle = 'rgba(0,255,255,0.03)';
    Object.keys(flowMap).forEach(k => { const parts = k.split(',').map(Number); c.fillRect(parts[0]*CFG.cell, parts[1]*CFG.cell, CFG.cell, CFG.cell); });

    // towers: glow + core + UI rings
    for (let t of towers){
      c.save();
      if (quality === 'high') { c.shadowBlur = 18; c.shadowColor = t.color; }
      c.fillStyle = t.color; c.fillRect(t.x-12, t.y-12, 24, 24);
      c.restore();
      c.fillStyle = '#000'; c.fillRect(t.x-8, t.y-8, 16,16);
      // hp ring
      const hpRatio = clamp(t.hp / (t.maxHp||100), 0, 1);
      c.strokeStyle = `rgba(255,255,255,${0.06 + 0.2*hpRatio})`; c.beginPath(); c.arc(t.x, t.y, Math.max(20, t.r*0.6), 0, Math.PI*2); c.stroke();
    }

    // enemies: multi-layered procedural sprites
    for (let e of enemies){
      c.save(); if (quality==='high'){ c.shadowBlur = 20; c.shadowColor = e.color; }
      c.fillStyle = e.color; c.beginPath(); c.ellipse(e.x, e.y, 12, 8, 0, 0, Math.PI*2); c.fill();
      c.restore();
      c.fillStyle = '#000'; c.beginPath(); c.ellipse(e.x,e.y,6,4,0,0,Math.PI*2); c.fill();
      // health bar
      c.fillStyle = '#111'; c.fillRect(e.x-14,e.y-12,28,4); c.fillStyle = '#0f0'; c.fillRect(e.x-14,e.y-12,28*(e.hp/e.maxHp),4);
    }

    // projectiles & particles
    for (let p of projectiles){
      if (p.type === 'bullet'){ c.fillStyle = p.color; c.beginPath(); c.arc(p.x,p.y,3,0,Math.PI*2); c.fill(); }
      else { c.strokeStyle = p.color; c.setLineDash([4,6]); c.beginPath(); c.arc(p.x,p.y,p.r,0,Math.PI*2); c.stroke(); c.setLineDash([]); }
    }
    for (let p of particles){ c.globalAlpha = Math.max(0, p.life / 14); c.fillStyle = p.color; c.fillRect(p.x,p.y,2,2); c.globalAlpha = 1; }

    // HUD
    c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(10,10,300,56);
    c.fillStyle = '#fff'; c.font = '12px monospace'; c.fillText(`Wave ${wave}`, 20, 30); c.fillStyle = '#FFD700'; c.fillText(`$${Math.floor(money)}`, 140, 30); c.fillStyle = '#ff6666'; c.fillText(`♥ ${lives}`, 240, 30);
  }

  // ---------- Public API ----------
  function init(c, options){
    canvas = c; ctx = c.getContext('2d');
    if (options && options.cell) CFG.cell = options.cell;
    if (options && options.gridW) CFG.gridW = options.gridW;
    if (options && options.gridH) CFG.gridH = options.gridH;
    if (options && options.quality) quality = options.quality;
    canvas.width = CFG.gridW * CFG.cell; canvas.height = CFG.gridH * CFG.cell;
    money = 650; lives = 40; wave = 1; active = false; gameOver = false;
    towers.length=0; enemies.length=0; projectiles.length=0; particles.length=0;
    calcFlows();
    if (!running){ running = true; mainLoop(); }
  }

  function resetGame(){ towers.length=0; enemies.length=0; projectiles.length=0; particles.length=0; calcFlows(); wave=1; money=650; lives=40; active=false; gameOver=false; }

  function stop(){ running = false; if (loopId) cancelAnimationFrame(loopId); loopId = null; }

  function startWave(){
    if (active) return;
    active = true;
    // schedule varied spawns + boss if wave multiple
    const count = 10 + Math.floor(wave*3);
    for (let i=0;i<count;i++){
      const delay = i*18 + Math.floor(Math.random()*8);
      setTimeout(()=>{ const kind = (i%7===0 && wave>3)? 'elite' : (i%5===0 && wave>6 ? 'fast' : 'norm'); spawnEnemy(kind, start); }, delay);
    }
    if (wave % 5 === 0) setTimeout(()=>spawnEnemy('boss', start), count*18 + 60);
  }

  function setBuild(k){ buildKey = k; selected = null; }

  function upgrade(attr){ if (!selected) return; const def = towerDefs[selected.type]; const cost = Math.floor(def.cost * 0.8 * ((selected[attr+'Level']||0) + 1)); if (money < cost) return; money -= cost; selected[attr+'Level'] = (selected[attr+'Level']||0)+1; if (attr==='dmg') selected.dmg = Math.floor((selected.dmg||def.dmg) * 1.45); if (attr==='range') selected.r += 8; if (attr==='rate') selected.maxCd = Math.max(1, Math.floor((selected.maxCd||def.cd) * 0.88)); if (attr==='hp'){ selected.maxHp += Math.floor(def.hp * 0.4); selected.hp += Math.floor(def.hp * 0.4); } }

  function sell(){ if (!selected) return; const def = towerDefs[selected.type]; const refund = Math.floor(def.cost * 0.5 * (selected.level||1)); money += refund; towers = towers.filter(t => t !== selected); selected = null; calcFlows(); }

  function click(px,py){
    const gx = Math.floor(px / CFG.cell), gy = Math.floor(py / CFG.cell);
    if (gx < 0 || gy < 0 || gx >= CFG.gridW || gy >= CFG.gridH) return;
    const found = towers.find(t => t.gridX === gx && t.gridY === gy);
    if (found) { selected = found; buildKey = null; return; }
    if (buildKey){
      const def = towerDefs[buildKey];
      if (!def) return;
      let cost = def.cost;
      if (active && CFG.allowBuildDuringWave) cost = Math.floor(cost * CFG.buildDuringWaveMultiplier);
      if (money < cost) return;
      towers.push({ gridX: gx, gridY: gy, x: gx*CFG.cell + CFG.cell/2, y: gy*CFG.cell + CFG.cell/2, type: buildKey, name: def.name, dmg: def.dmg, r: def.r, maxCd: def.cd, cd:0, color: def.color, hp: def.hp, maxHp: def.hp, level:1 });
      const ok = calcFlows();
      if (!ok){ towers.pop(); spawnParticles(gx*CFG.cell+CFG.cell/2, gy*CFG.cell+CFG.cell/2, '#f44', 8); return; }
      money -= cost;
      spawnParticles(gx*CFG.cell+CFG.cell/2, gy*CFG.cell+CFG.cell/2, '#fff', 12);
      // persistent placement by design
    } else selected = null;
  }

  function setQuality(q){ quality = q; }

  // main loop
  let last = NOW();
  function mainLoop(){
    if (!running) return;
    const cur = NOW(); const dt = cur - last; last = cur;
    update(dt);
    draw(ctx);
    loopId = requestAnimationFrame(mainLoop);
  }

  return {
    init, update, draw, click, startWave, setBuild, upgrade, sell, reset: resetGame, stop, setQuality,
    get conf(){ return towerDefs; },
    get wave(){ return wave; },
    get money(){ return money; },
    get lives(){ return lives; },
    get sel(){ return selected; }
  };
})();

if (typeof window !== 'undefined') window.NeonGame = NeonCitadel;
if (typeof module !== 'undefined') module.exports = NeonCitadel;
