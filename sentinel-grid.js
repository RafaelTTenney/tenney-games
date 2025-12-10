/*
  Sentinel Grid — restored & enhanced (modal-friendly, non-breaking)
  - Preserves compatibility with tower-defence.html and any code expecting a Sentinel engine.
  - Exposes: init(canvas, options), update(), draw(ctx), click(x,y), startWave(), setBuild(name), upgrade(), sell(), reset(), stop(), setPlacementMode(single), setQuality(level)
  - Also provides legacy function aliases where present in original code (kept non-breaking).
  - Features:
      * Larger default play area (canvas-based)
      * Uses TD_CONF.GRID consistently
      * Persistent placement by default (toggleable)
      * Visual improvements (gradient enemies, glow, particles)
      * Safe reverse-loop updates (avoid splicing during forEach)
      * stop() cancels RAF and clears timers
*/

(function(global){
  const TD_CONF = {
    GRID: 24,
    COLS: 36,
    ROWS: 22,
    COLORS: {
      BG: '#051505',
      GRID: '#003300',
      PATH: 'rgba(0, 255, 0, 0.08)'
    }
  };

  // Towers definitions (kept simple and extensible)
  const TOWERS = {
    blaster: { name: "Blaster", cost: 50, color: "#00FF00", range: 4, dmg: 15, cd: 25, hp: 80 },
    sniper:  { name: "Sniper",  cost: 120, color: "#00FFFF", range: 9, dmg: 80, cd: 80, hp: 60 },
    rapid:   { name: "Rapid",   cost: 100, color: "#FFFF00", range: 3, dmg: 5, cd: 6, hp: 70 }
  };

  // Internal state
  let canvas, ctx;
  let loopId = null, running = false;
  let placementSingle = false;
  let quality = 'high'; // 'high','med','low'

  let gridCols = TD_CONF.COLS, gridRows = TD_CONF.ROWS, gridSize = TD_CONF.GRID;
  let startNodes = [{x:0,y: Math.floor(gridRows/2)}], endNode = {x: gridCols-1, y: Math.floor(gridRows/2)};
  let towers = [], enemies = [], projectiles = [], particles = [];
  let flow = {}; // key 'x,y' -> {x,y}
  let spawnQueue = [], spawnTick = 0, wave = 1, money = 250, lives = 20, waveActive = false;
  let placementMode = true; // persistent by default

  // Pools for performance
  const particlePool = [];
  function rentParticle(){ return particlePool.pop() || {x:0,y:0,vx:0,vy:0,life:0,color:'#fff'}; }
  function releaseParticle(p){ particlePool.push(p); }

  // Public API object
  const API = {
    init,
    update,
    draw,
    click,
    startWave,
    setBuild,
    upgrade,
    sell,
    reset,
    stop,
    setPlacementMode,
    setQuality,
    // read-only
    get state(){ return { wave, money, lives, waveActive }; },
    get conf(){ return { towers: TOWERS }; },
    get sel(){ return selected; }
  };

  // Backwards compatibility: expose some legacy names that existed previously
  // We'll attach them after API created.

  // Internal helpers
  function key(x,y){ return `${x},${y}`; }
  function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }

  // Selected tower (for inspector)
  let selected = null;
  let buildType = null;

  // Initialize engine for modal canvas
  function init(c, options){
    canvas = c;
    ctx = canvas.getContext('2d');

    // If options provide custom grid or difficulty, accept them
    if (options && options.gridSize) { gridSize = options.gridSize; TD_CONF.GRID = gridSize; }
    if (options && options.cols) { gridCols = options.cols; }
    if (options && options.rows) { gridRows = options.rows; }
    if (options && options.placementSingle !== undefined) { placementMode = !options.placementSingle; placementSingle = options.placementSingle; }
    if (options && options.quality) quality = options.quality;

    // set canvas size to default play area (caller may resize)
    canvas.width = Math.max(canvas.width, gridCols * gridSize);
    canvas.height = Math.max(canvas.height, gridRows * gridSize);

    // reset state
    reset();

    // begin loop if not running
    if (!running) { running = true; lastTick = performance.now(); loop(); }
  }

  function stop(){
    running = false;
    if (loopId) { cancelAnimationFrame(loopId); loopId = null; }
    // clear any spawn queue timers if we used setTimeout (we do not), safe cleanup here
    spawnQueue.length = 0;
  }

  function reset(){
    // clear arrays (release pooled particles)
    for (let p of particles) releaseParticle(p);
    particles.length = 0;
    enemies.length = 0;
    projectiles.length = 0;
    towers.length = 0;
    flow = {};
    spawnQueue = [];
    spawnTick = 0;
    wave = 1;
    money = 250;
    lives = 20;
    waveActive = false;
    selected = null;
    buildType = null;
    // compute initial flow (empty grid)
    computeFlow();
  }

  // pathfinding BFS (from end node to all tiles) - returns true if all start nodes can reach end
  function computeFlow(){
    const cols = gridCols, rows = gridRows;
    const occ = Array.from({length:cols}, ()=>Array(rows).fill(false));
    for (let t of towers) if (typeof t.gridX === 'number') occ[t.gridX][t.gridY] = true;

    const q = [{x:endNode.x,y:endNode.y}];
    const came = {};
    came[key(endNode.x,endNode.y)] = null;

    while (q.length){
      const c = q.shift();
      [[0,1],[0,-1],[1,0],[-1,0]].forEach(d=>{
        const nx = c.x + d[0], ny = c.y + d[1];
        if (nx>=0 && nx<cols && ny>=0 && ny<rows && !occ[nx][ny]){
          const k = key(nx,ny);
          if (!came.hasOwnProperty(k)){ came[k] = c; q.push({x:nx,y:ny}); }
        }
      });
    }

    // ensure each start can reach end
    for (let s of startNodes){
      if (!came.hasOwnProperty(key(s.x,s.y))) {
        return false;
      }
    }

    // populate flow map: for each tile record next tile toward end
    const fmap = {};
    for (let k in came){
      const parts = k.split(',').map(Number);
      const prev = came[k];
      if (!prev) continue;
      fmap[k] = { x: prev.x, y: prev.y };
    }
    flow = fmap;
    return true;
  }

  // Spawn logic
  function startWave(){
    if (waveActive) return;
    waveActive = true;
    spawnQueue.length = 0;
    const count = 6 + Math.floor(wave * 2);
    for (let i=0;i<count;i++){
      let kind = 'norm';
      if (wave > 4 && i % 7 === 0) kind = 'elite';
      if (wave > 2 && i % 5 === 0) kind = 'shield';
      if (wave > 6 && i % 4 === 0) kind = 'fast';
      spawnQueue.push({ d: i*16 + Math.floor(Math.random()*8), kind });
    }
    // schedule a miniboss at end of wave; bigger boss every 5 waves
    spawnQueue.push({ d: count*16 + 40, kind: 'miniboss' });
    if (wave % 5 === 0) spawnQueue.push({ d: count*16 + 160, kind: 'boss' });
  }

  // per-tick update (called by loop)
  let lastTick = 0;
  function loop(){
    if (!running) return;
    const now = performance.now();
    const dt = now - lastTick;
    lastTick = now;
    update(dt);
    draw(ctx);
    loopId = requestAnimationFrame(loop);
  }

  function update(dt){
    // spawnQueue handling
    if (waveActive && spawnQueue.length){
      for (let i = spawnQueue.length - 1; i >= 0; i--){
        const item = spawnQueue[i];
        item.d -= 16; // approximate tick
        if (item.d <= 0){
          // spawn
          spawnEnemy(item.kind);
          spawnQueue.splice(i,1);
        }
      }
    } else if (waveActive && enemies.length === 0 && spawnQueue.length === 0){
      waveActive = false;
      wave++;
      money += 100 + wave*10;
    }

    // enemies update (reverse loop)
    for (let i = enemies.length - 1; i >= 0; i--){
      const e = enemies[i];
      // handle movement via flow map based on grid cell
      const gx = Math.floor(e.x / gridSize), gy = Math.floor(e.y / gridSize);
      const f = flow[key(gx,gy)];
      if (f){
        const tx = f.x*gridSize + gridSize/2, ty = f.y*gridSize + gridSize/2;
        let dx = tx - e.x, dy = ty - e.y;
        const d = Math.hypot(dx,dy) || 1;
        const spd = e.spd;
        if (d <= spd) { e.x = tx; e.y = ty; e.pathIndex++; }
        else { e.x += (dx/d) * spd; e.y += (dy/d) * spd; }
      } else {
        // fallback direct
        const tx = endNode.x*gridSize + gridSize/2, ty = endNode.y*gridSize + gridSize/2;
        let dx = tx - e.x, dy = ty - e.y; const d = Math.hypot(dx,dy) || 1;
        e.x += (dx/d) * e.spd; e.y += (dy/d) * e.spd;
      }

      // check arrival or death
      const distToEnd = Math.hypot(e.x - (endNode.x*gridSize + gridSize/2), e.y - (endNode.y*gridSize + gridSize/2));
      if (distToEnd < 8) {
        enemies.splice(i,1);
        lives--;
        if (lives <= 0) { reset(); break; }
      } else if (e.hp <= 0) {
        money += e.val || 6;
        spawnParticleBurst(e.x, e.y, e.color || '#fff', 10);
        enemies.splice(i,1);
      }
    }

    // towers firing (iterate normal)
    for (let t of towers){
      if (t.cd > 0) { t.cd--; continue; }
      // simple nearest target
      let nearest = null, minD = 99999;
      for (let e of enemies){
        const d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d <= (t.range * gridSize) && d < minD){ minD = d; nearest = e; }
      }
      if (nearest){
        projectiles.push({ x: t.x, y: t.y, target: nearest, spd: 10, dmg: t.dmg, color: t.color });
        t.cd = t.maxCd || t.cd;
      }
    }

    // projectiles update (reverse loop)
    for (let i = projectiles.length - 1; i >= 0; i--){
      const p = projectiles[i];
      if (!p.target || p.target.hp <= 0) { projectiles.splice(i,1); continue; }
      const dx = p.target.x - p.x, dy = p.target.y - p.y;
      const d = Math.hypot(dx,dy) || 1;
      if (d < p.spd){
        p.target.hp -= p.dmg;
        spawnParticleBurst(p.target.x, p.target.y, p.color || '#fff', 6);
        projectiles.splice(i,1);
      } else {
        p.x += (dx/d) * p.spd; p.y += (dy/d) * p.spd;
      }
    }

    // particles update
    for (let i = particles.length -1; i >= 0; i--){
      const P = particles[i];
      P.x += P.vx; P.y += P.vy; P.life--;
      if (P.life <= 0){ releaseParticle(P); particles.splice(i,1); }
    }
  }

  // draw function
  function draw(ctxDraw){
    if (!ctxDraw) return;
    // clear
    ctxDraw.fillStyle = TD_CONF.COLORS.BG; ctxDraw.fillRect(0,0,canvas.width,canvas.height);
    // path overlay
    ctxDraw.fillStyle = TD_CONF.COLORS.PATH;
    for (let k in flow){
      const parts = k.split(',').map(Number);
      ctxDraw.fillRect(parts[0]*gridSize, parts[1]*gridSize, gridSize, gridSize);
    }
    // grid lines
    ctxDraw.strokeStyle = TD_CONF.COLORS.GRID; ctxDraw.beginPath();
    for (let x=0;x<=gridCols;x++){ ctxDraw.moveTo(x*gridSize, 0); ctxDraw.lineTo(x*gridSize, canvas.height); }
    for (let y=0;y<=gridRows;y++){ ctxDraw.moveTo(0, y*gridSize); ctxDraw.lineTo(canvas.width, y*gridSize); }
    ctxDraw.stroke();

    // draw towers
    for (let t of towers){
      ctxDraw.save();
      if (quality === 'high') { ctxDraw.shadowBlur = 12; ctxDraw.shadowColor = t.color; }
      ctxDraw.fillStyle = t.color; ctxDraw.fillRect(t.x-12, t.y-12, 24, 24);
      ctxDraw.restore();
      ctxDraw.fillStyle = '#000'; ctxDraw.fillRect(t.x-8, t.y-8, 16, 16);
    }

    // draw enemies with gradient & glow
    for (let e of enemies){
      ctxDraw.save();
      if (quality === 'high') ctxDraw.shadowBlur = 12, ctxDraw.shadowColor = e.color;
      const grad = ctxDraw.createRadialGradient(e.x-4, e.y-4, 2, e.x, e.y, 14);
      grad.addColorStop(0, e.color || '#FF66FF'); grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctxDraw.fillStyle = grad; ctxDraw.beginPath(); ctxDraw.arc(e.x, e.y, 8, 0, Math.PI*2); ctxDraw.fill();
      ctxDraw.restore();
      ctxDraw.fillStyle = '#000'; ctxDraw.beginPath(); ctxDraw.arc(e.x, e.y, 4, 0, Math.PI*2); ctxDraw.fill();
      // hp bar
      ctxDraw.fillStyle = '#222'; ctxDraw.fillRect(e.x-10, e.y-12, 20, 3);
      ctxDraw.fillStyle = '#0f0'; ctxDraw.fillRect(e.x-10, e.y-12, 20 * Math.max(0, e.hp / e.maxHp), 3);
    }

    // projectiles
    for (let p of projectiles){
      ctxDraw.fillStyle = p.color || '#fff'; ctxDraw.beginPath(); ctxDraw.arc(p.x, p.y, 3, 0, Math.PI*2); ctxDraw.fill();
    }

    // particles
    for (let P of particles){
      ctxDraw.globalAlpha = Math.max(0, P.life / 12);
      ctxDraw.fillStyle = P.color || '#fff'; ctxDraw.fillRect(P.x, P.y, 2, 2);
      ctxDraw.globalAlpha = 1;
    }
  }

  // Helpers: spawn enemy of kind at random start
  function spawnEnemy(kind){
    const sn = startNodes[Math.floor(Math.random()*startNodes.length)];
    const e = {
      x: sn.x * gridSize + gridSize/2,
      y: sn.y * gridSize + gridSize/2,
      hp: Math.floor((16 + wave*10) * (kind==='elite'?2.6: kind==='fast'?0.7:1)),
      maxHp: 0,
      spd: (kind==='fast' ? 2.2 : 1.4 + Math.random()*0.6),
      type: kind,
      color: (kind==='elite' ? '#FF3366' : kind==='fast' ? '#FFD100' : '#FF66FF'),
      val: Math.floor(5 + wave*0.8),
      pathIndex: 0
    };
    e.maxHp = e.hp;
    enemies.push(e);
  }

  // UI placement click
  function click(px, py){
    const gx = Math.floor(px / gridSize), gy = Math.floor(py / gridSize);
    if (gx < 0 || gx >= gridCols || gy < 0 || gy >= gridRows) return;
    // existing tower select
    const existing = towers.find(t => t.gridX === gx && t.gridY === gy);
    if (existing) { selected = existing; buildType = null; return; }

    // place
    if (buildType){
      const def = TOWERS[buildType];
      if (!def) return;
      if (money < def.cost) return;
      // prevent blocking start/end
      if ((gx === endNode.x && gy === endNode.y) || startNodes.some(s=>s.x===gx && s.y===gy)) return;
      // add tentatively
      const tw = {
        type: buildType, name: def.name, gridX: gx, gridY: gy,
        x: gx*gridSize + gridSize/2, y: gy*gridSize + gridSize/2,
        dmg: def.dmg, range: def.range, r: def.range * gridSize,
        maxCd: def.cd, cd: 0, color: def.color, level:1, hp: def.hp || 80, maxHp: def.hp || 80
      };
      towers.push(tw);
      const ok = computeFlow();
      if (!ok){
        // blocked, undo
        towers.pop();
        spawnParticleBurst(gx*gridSize + gridSize/2, gy*gridSize + gridSize/2, '#f44', 10);
        return;
      }
      money -= def.cost;
      spawnParticleBurst(tw.x, tw.y, '#fff', 12);
      if (placementSingle) buildType = null;
    } else {
      selected = null;
    }
  }

  // build selection
  function setBuild(name){
    buildType = name;
    selected = null;
  }

  function tdSelectType(name){ setBuild(name); } // alias for legacy callers

  function upgrade(){
    if (!selected) return;
    const def = TOWERS[selected.type];
    const cost = Math.floor(def.cost * 0.8 * (selected.level || 1));
    if (money < cost) return;
    money -= cost;
    selected.level = (selected.level || 1) + 1;
    selected.dmg = Math.floor(selected.dmg * 1.3);
    selected.r = selected.r + Math.floor(gridSize * 0.2);
    selected.maxCd = Math.max(4, Math.floor(selected.maxCd * 0.95));
    spawnParticleBurst(selected.x, selected.y, '#0f0', 12);
  }

  function sell(){
    if (!selected) return;
    const def = TOWERS[selected.type];
    const refund = Math.floor(def.cost * 0.5 * (selected.level || 1));
    money += refund;
    towers = towers.filter(t => t !== selected);
    selected = null;
    computeFlow();
  }

  // helper particle spawns
  function spawnParticleBurst(x,y,color,n){
    for (let i=0;i<n;i++){
      const p = rentParticle();
      p.x = x + (Math.random()-0.5)*8; p.y = y + (Math.random()-0.5)*8;
      p.vx = (Math.random()-0.5)*2; p.vy = (Math.random()-0.5)*2;
      p.life = 8 + Math.floor(Math.random()*8); p.color = color;
      particles.push(p);
    }
  }

  // set placement mode
  function setPlacementMode(single){
    placementSingle = !!single;
    placementMode = !placementSingle;
  }

  function setQuality(q){
    quality = q;
  }

  // Expose API and legacy names
  const SentinelGame = API;
  // Legacy global names used by tower-defence.html: provide them where possible
  // Provide tdUpdateUI etc. if other pages call them (no-op safe wrappers)
  function legacy_tdInit(){ /* noop wrapper for compatibility */ }
  function legacy_tdReset(){ reset(); }
  function legacy_tdStartWave(){ startWave(); }
  function legacy_tdUpdatePath(){ computeFlow(); }
  function legacy_tdSpawnEnemy(kind){ spawnEnemy(kind); }

  // attach to window
  global.SentinelGame = SentinelGame;
  global.initSentinel = function(canvasEl, diff){ return SentinelGame.init(canvasEl, {difficulty: diff}); };
  // legacy function aliases (non-breaking)
  global.tdInit = legacy_tdInit;
  global.tdReset = legacy_tdReset;
  global.tdStartWave = legacy_tdStartWave;
  global.tdUpdatePath = legacy_tdUpdatePath;
  global.tdSpawnEnemy = legacy_tdSpawnEnemy;
  global.tdSelectType = tdSelectType;

  // export module if present
  if (typeof module !== 'undefined') module.exports = SentinelGame;

})(typeof window !== 'undefined' ? window : global);
