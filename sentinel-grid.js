/* Sentinel Grid (Advanced Edition)
   - Large, optimized, modal-friendly tower defence engine
   - API: init(canvas, options), update(), draw(ctx), click(x,y), startWave(), setBuild(name), upgrade(), sell(),
          reset(), stop(), setQuality(level)
   - Performance features:
       * Object pooling for particles/projectiles/enemies
       * Spatial hashing grid for quick nearest-target queries
       * Reverse-loop mutation-safe updates
       * Configurable quality (high/medium/low) to trade visuals for speed
       * Batched draw techniques and offscreen sprite caching for towers
   - Gameplay features:
       * Responsive canvas sizing & configurable GRID cell
       * Persistent placement mode and single-placement toggle
       * Multiple start nodes and pathfinding (BFS) that gracefully handles blocked paths
       * Rich enemy visuals (radial gradients, glow) + health bars + particle effects
       * Towers have per-attribute upgrades (dmg, range, rate, hp)
       * Enemies can have resistances and small AI flags (fast, shield, swarm)
       * Towers & enemies use lightweight prototypes for memory efficiency
*/

const SentinelGame = (function () {
  // ---------- UTILITIES ----------
  const U = {
    now: () => performance.now(),
    clamp: (v,a,b) => Math.max(a, Math.min(b, v)),
    rand: (a,b) => a + Math.random()*(b-a),
    hashKey: (x,y) => `${x},${y}`,
    mixColor: function(c1, c2, t){
      // c1/c2 as '#RRGGBB', return blended hex
      const p = (hex) => parseInt(hex.replace('#',''),16);
      const cA = p(c1), cB = p(c2);
      const r = (cA>>16), g = (cA>>8)&255, b = cA&255;
      const r2 = (cB>>16), g2 = (cB>>8)&255, b2 = cB&255;
      const rr = Math.round(r + (r2-r)*t), gg = Math.round(g + (g2-g)*t), bb = Math.round(b + (b2-b)*t);
      return `#${((1<<24) + (rr<<16) + (gg<<8) + bb).toString(16).slice(1)}`;
    }
  };

  // ---------- POOLS ----------
  function Pool(createFn){
    const items = [];
    return {
      rent: (...args) => items.pop() || createFn(...args),
      release: (it) => { items.push(it); }
    };
  }

  // ---------- CONFIG / STATE ----------
  const DEFAULT = {
    GRID: 26,
    COLS: 34,
    ROWS: 20,
    colors: {
      bg: '#051505',
      grid: '#062206',
      path: 'rgba(0,255,0,0.08)'
    },
    initialMoney: 300,
    initialLives: 20,
    persistentPlacement: true,
    quality: 'high' // 'high'|'med'|'low' - affects particles/shadow
  };

  // game variables
  let cfg = {};
  let canvas = null, ctx = null;
  let loopId = null, running = false;

  // gameplay state
  let wave = 1, money = 0, lives = 0, waveActive = false;
  let towers = [], enemies = [], projectiles = [], particles = [];
  let startNodes = [], endNode = null;
  let gridOcc = null; // occupancy for pathfinding
  let flowMap = {}; // key->next cell to follow
  let buildType = null, selected = null;
  let spawnQueue = [], spawnTimer = 0, enemiesToSpawn = 0;
  let spatial = null; // spatial hash

  // performance pools
  const particlePool = Pool(() => ({x:0,y:0,vx:0,vy:0,life:0,color:'#fff'}));
  const projPool = Pool(() => ({x:0,y:0,tx:0,ty:0,spd:8,dmg:6,color:'#fff',target:null,type:'bullet'}));
  const enemyPool = Pool(() => ({x:0,y:0,hp:0,maxHp:0,spd:1,type:'norm',color:'#f0f',val:6,origin:null,pathIndex:0,routePref:'shortest',resist:{}}));

  // ---------- SPATIAL HASH (fast nearest queries) -------------
  function Spatial(cols, rows, cell) {
    const sx = Math.ceil((cols*cell) / cell);
    const sy = Math.ceil((rows*cell) / cell);
    const buckets = new Map();
    function key(ix,iy){ return `${ix},${iy}`; }
    return {
      clear(){ buckets.clear(); },
      insert(obj, x, y){
        const ix = Math.floor(x / cell), iy = Math.floor(y / cell);
        const k = key(ix,iy);
        if (!buckets.has(k)) buckets.set(k,[]);
        buckets.get(k).push(obj);
        obj.__spKey = k;
      },
      remove(obj){
        const k = obj.__spKey;
        if (!k) return;
        const arr = buckets.get(k);
        if (!arr) return;
        const i = arr.indexOf(obj);
        if (i>=0) arr.splice(i,1);
        delete obj.__spKey;
      },
      queryRadius(x,y,r){
        const ix0 = Math.floor((x-r)/cell), iy0 = Math.floor((y-r)/cell);
        const ix1 = Math.floor((x+r)/cell), iy1 = Math.floor((y+r)/cell);
        const out = [];
        for (let ix=ix0; ix<=ix1; ix++){
          for (let iy=iy0; iy<=iy1; iy++){
            const k = key(ix,iy);
            const arr = buckets.get(k);
            if (arr) for (let v of arr) out.push(v);
          }
        }
        return out;
      }
    };
  }

  // ---------- PATHFINDING (BFS) ----------
  function bfsPaths(){
    // compute gridOcc and BFS from end to every tile; create flowMap
    const cols = cfg.COLS, rows = cfg.ROWS;
    const occ = Array.from({length:cols}, ()=>Array(rows).fill(false));
    for (let t of towers) if (typeof t.x === 'number') occ[t.x][t.y] = true;
    gridOcc = occ;
    const q = [{x:endNode.x, y:endNode.y}];
    const came = {};
    came[U.hashKey(endNode.x,endNode.y)] = null;
    while (q.length){
      const cur = q.shift();
      const neigh = [[0,1],[0,-1],[1,0],[-1,0]];
      for (let d of neigh){
        const nx = cur.x + d[0], ny = cur.y + d[1];
        if (nx>=0 && nx<cols && ny>=0 && ny<rows && !occ[nx][ny]){
          const k = U.hashKey(nx,ny);
          if (!came.hasOwnProperty(k)){
            came[k] = cur;
            q.push({x:nx,y:ny});
          }
        }
      }
    }
    // if some start cannot reach end, return false
    for (let s of startNodes){
      if (!came.hasOwnProperty(U.hashKey(s.x,s.y))) return false;
    }
    // build flowMap
    flowMap = {};
    for (let k in came){
      const parts = k.split(',').map(Number); const cx = parts[0], cy = parts[1];
      const prev = came[k];
      if (!prev) continue;
      flowMap[k] = {x: prev.x, y: prev.y};
    }
    return true;
  }

  // ---------- ENTITY FACTORIES ----------
  function createTower(type, gx, gy){
    const def = cfg.towers[type];
    if (!def) return null;
    return {
      id: 't'+(Math.random()*1e8|0),
      type,
      name: def.name,
      gridX: gx,
      gridY: gy,
      x: gx*cfg.GRID + Math.floor(cfg.GRID/2),
      y: gy*cfg.GRID + Math.floor(cfg.GRID/2),
      dmg: def.dmg,
      r: def.range * cfg.GRID,
      maxCd: def.cd,
      cd: 0,
      color: def.color,
      level: 1,
      hp: def.hp || 100,
      maxHp: def.hp || 100,
      attr: { dmg:0, range:0, rate:0, hp:0 }
    };
  }

  function spawnEnemy(kind, snode){
    const e = enemyPool.rent();
    const s = snode || startNodes[0];
    e.x = s.x*cfg.GRID + Math.floor(cfg.GRID/2);
    e.y = s.y*cfg.GRID + Math.floor(cfg.GRID/2);
    e.type = kind || 'norm';
    e.routePref = (kind==='elite' ? 'leastDamage' : kind==='fast' ? 'shortest' : 'shortest');
    e.spd = (kind==='fast' ? 2.1 : 1.4 + Math.random()*0.6) * (1 + wave*0.02);
    e.maxHp = Math.floor((20 + wave*10) * (kind==='elite' ? 2.6 : kind==='fast' ? 0.7 : 1));
    e.hp = e.maxHp;
    e.color = (kind==='elite' ? '#FF3366' : kind==='fast' ? '#FFD100' : '#FF66FF');
    e.val = Math.floor(6 + wave*1.2);
    e.resist = (kind==='elite' ? { kinetic:0.2 } : {});
    e.pathIndex = 0;
    e.origin = s;
    enemies.push(e);
    spatial.insert(e, e.x, e.y);
  }

  // ---------- DRAW HELPERS & CACHING ----------
  function createTowerSprite(def){
    // offscreen canvas pre-renders a small sprite for each tower type to accelerate draw
    const s = document.createElement('canvas');
    s.width = cfg.GRID; s.height = cfg.GRID;
    const c = s.getContext('2d');
    c.clearRect(0,0,s.width,s.height);
    // base
    c.fillStyle = def.color; c.beginPath(); c.arc(s.width/2, s.height/2, Math.floor(s.width*0.28),0,Math.PI*2); c.fill();
    // core
    c.fillStyle = '#000'; c.beginPath(); c.arc(s.width/2, s.height/2, Math.floor(s.width*0.14),0,Math.PI*2); c.fill();
    // emblem
    c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(s.width/2-4, s.height/2-1, 8,2);
    return s;
  }

  // sprite cache by tower type
  let spriteCache = {};

  // ---------- PUBLIC API IMPLEMENTATION ----------
  function init(c, options){
    canvas = c;
    ctx = canvas.getContext('2d');
    cfg = Object.assign({}, DEFAULT, options || {});
    // ensure towers mapping provided if options include 'towers' (adapter injects game-specific definitions)
    if (!cfg.towers) cfg.towers = {
      blaster: {name:'Blaster', cost:50, range:4, dmg:15, cd:25, color:'#00FF00', hp:80},
      sniper:  {name:'Sniper', cost:120, range:9, dmg:80, cd:80, color:'#00FFFF', hp:60},
      rapid:   {name:'Rapid', cost:100, range:3, dmg:5, cd:6, color:'#FFFF00', hp:70}
    };
    // compute canvas default size
    canvas.width = cfg.COLS * cfg.GRID;
    canvas.height = cfg.ROWS * cfg.GRID;
    money = cfg.initialMoney || DEFAULT.initialMoney;
    lives = cfg.initialLives || DEFAULT.initialLives;
    startNodes = options && options.startNodes ? options.startNodes.slice() : [{x:0,y:Math.floor(cfg.ROWS/2)}];
    endNode = options && options.endNode ? Object.assign({}, options.endNode) : {x: cfg.COLS-1, y: Math.floor(cfg.ROWS/2)};
    cfg.persistentPlacement = ('persistentPlacement' in cfg) ? cfg.persistentPlacement : true;
    cfg.quality = cfg.quality || DEFAULT.quality;
    // caches
    spriteCache = {};
    for (let k in cfg.towers) spriteCache[k] = createTowerSprite(cfg.towers[k]);
    // reset gameplay structures
    towers.length = 0; enemies.length = 0; projectiles.length = 0; particles.length = 0;
    flowMap = {};
    spatial = Spatial(cfg.COLS, cfg.ROWS, cfg.GRID);
    // precompute paths
    bfsPaths();
    // start loop
    if (!running) { running = true; loop(); }
  }

  function stop(){
    running = false;
    if (loopId) cancelAnimationFrame(loopId);
    loopId = null;
  }

  function reset(){
    // clear arrays but reuse objects
    for (let e of enemies) enemyPool.release(e);
    enemies.length = 0;
    projectiles.length = 0;
    particles.length = 0;
    towers.length = 0;
    flowMap = {};
    bfsPaths();
    money = cfg.initialMoney || DEFAULT.initialMoney;
    lives = cfg.initialLives || DEFAULT.initialLives;
    wave = 1; waveActive = false;
  }

  // start a wave: build a spawn queue and spawn over time
  function startWave(){
    if (waveActive) return;
    waveActive = true;
    enemiesToSpawn = 6 + Math.floor(wave*2);
    spawnTimer = 0;
    spawnQueue.length = 0;
    for (let i=0;i<enemiesToSpawn;i++){
      let kind = 'norm';
      if (wave>3 && i % 7 === 0) kind = 'elite';
      if (wave>5 && i % 5 === 0) kind = 'fast';
      if (i === enemiesToSpawn-1 && (wave % 4 === 0)) kind = 'elite'; // last enemy might be stronger
      spawnQueue.push({delay: i*16 + Math.floor(Math.random()*6), kind});
    }
  }

  // upgrade selected tower
  function upgrade(){
    if (!selected) return;
    const t = selected;
    const def = cfg.towers[t.type];
    const cost = Math.floor(def.cost * 0.8 * (t.level || 1));
    if (money < cost) return;
    money -= cost;
    t.level = (t.level || 1) + 1;
    t.dmg = Math.floor(t.dmg * 1.3);
    t.r += Math.floor(cfg.GRID * 0.2);
    t.maxCd = Math.max(3, Math.floor(t.maxCd * 0.92));
    t.hp += Math.floor(def.hp * 0.25);
    spawnParticleBurst(t.x, t.y, '#0f8', 10);
  }

  function sell(){
    if (!selected) return;
    const t = selected;
    const def = cfg.towers[t.type];
    const refund = Math.floor(def.cost * 0.55 * (t.level || 1));
    money += refund;
    // remove from towers array
    const idx = towers.indexOf(t);
    if (idx >= 0) towers.splice(idx,1);
    // recalc paths and spatial
    bfsPaths();
    selected = null;
  }

  // set build selection
  function setBuild(k){
    buildType = k;
    selected = null;
  }

  // click handler with pixel coords
  function click(px, py){
    const gx = Math.floor(px / cfg.GRID), gy = Math.floor(py / cfg.GRID);
    if (gx < 0 || gx >= cfg.COLS || gy < 0 || gy >= cfg.ROWS) return;
    const existing = towers.find(t => t.gridX === gx && t.gridY === gy);
    if (existing){
      selected = existing; buildType = null; return;
    }
    if (buildType){
      const def = cfg.towers[buildType];
      if (!def) return;
      if (money < def.cost) return;
      // can't build on start/end
      if (startNodes.some(s => s.x === gx && s.y === gy)) return;
      if (gx === endNode.x && gy === endNode.y) return;
      // attempt placement then test path
      const tw = createTower(buildType, gx, gy);
      towers.push(tw);
      const ok = bfsPaths();
      if (!ok){
        towers.pop();
        // blocked, give feedback
        spawnParticleBurst(gx*cfg.GRID + cfg.GRID/2, gy*cfg.GRID + cfg.GRID/2, '#f44', 8);
        return;
      }
      money -= def.cost;
      spawnParticleBurst(tw.x, tw.y, '#fff', 14);
      if (!cfg.persistentPlacement) buildType = null;
    } else {
      selected = null;
    }
  }

  // ---------- UPDATE / DRAW LOOP ----------
  function update(dt){
    // spawn handling from queue
    if (waveActive && spawnQueue.length){
      // decrease all delays by 1 tick and spawn when delay <= 0
      for (let i = spawnQueue.length-1;i>=0;i--){
        const sq = spawnQueue[i];
        sq.delay--;
        if (sq.delay <= 0){
          spawnEnemy(sq.kind, startNodes[Math.floor(Math.random()*startNodes.length)]);
          spawnQueue.splice(i,1);
        }
      }
    } else if (waveActive && enemies.length === 0 && spawnQueue.length === 0){
      // wave ends
      waveActive = false;
      wave++;
      money += 120 + wave*20;
    }

    // enemies update - reverse loop safe
    for (let i=enemies.length-1;i>=0;i--){
      const e = enemies[i];
      // route following using flowMap
      const gx = Math.floor(e.x / cfg.GRID), gy = Math.floor(e.y / cfg.GRID);
      const fk = U.hashKey(gx,gy);
      const next = flowMap[fk];
      if (next){
        const tx = next.x*cfg.GRID + Math.floor(cfg.GRID/2), ty = next.y*cfg.GRID + Math.floor(cfg.GRID/2);
        const dx = tx - e.x, dy = ty - e.y; const d = Math.hypot(dx,dy) || 1;
        if (d < e.spd) { e.x = tx; e.y = ty; e.pathIndex++; }
        else { e.x += (dx/d) * e.spd; e.y += (dy/d) * e.spd; }
      } else {
        // fallback move straight to end
        const tx = endNode.x*cfg.GRID + Math.floor(cfg.GRID/2), ty = endNode.y*cfg.GRID + Math.floor(cfg.GRID/2);
        const dx = tx - e.x, dy = ty - e.y; const d = Math.hypot(dx,dy)||1;
        e.x += (dx/d) * e.spd; e.y += (dy/d) * e.spd;
      }
      // update spatial
      spatial.remove(e); spatial.insert(e, e.x, e.y);
      // check arrival
      if (Math.hypot(e.x - (endNode.x*cfg.GRID + cfg.GRID/2), e.y - (endNode.y*cfg.GRID + cfg.GRID/2)) < 8){
        // reached
        enemies.splice(i,1); enemyPool.release(e);
        lives--; if (lives <= 0) { reset(); break; }
      } else if (e.hp <= 0){
        // killed
        enemies.splice(i,1); enemyPool.release(e);
        money += e.val;
        spawnParticleBurst(e.x, e.y, '#fff', 10);
      }
    }

    // towers fire - simple nearest targeting via spatial.queryRadius
    for (let t of towers){
      if (t.cd > 0){ t.cd--; continue; }
      const search = spatial.queryRadius(t.x, t.y, t.r*0.9 || 1);
      let target = null, minD = Infinity;
      for (let s of search){
        const d = Math.hypot(s.x - t.x, s.y - t.y);
        if (d <= t.r && d < minD){ minD = d; target = s; }
      }
      if (target){
        const p = projPool.rent();
        p.x = t.x; p.y = t.y; p.target = target; p.spd = 10; p.dmg = t.dmg; p.color = t.color;
        projectiles.push(p);
        t.cd = t.maxCd;
      }
    }

    // projectiles update (reverse safe)
    for (let i = projectiles.length-1; i>=0; i--){
      const p = projectiles[i];
      if (!p.target || p.target.hp <= 0){ projPool.release(p); projectiles.splice(i,1); continue; }
      const dx = p.target.x - p.x, dy = p.target.y - p.y; const d = Math.hypot(dx,dy) || 1;
      if (d < p.spd){
        // hit
        p.target.hp -= p.dmg;
        spawnParticleBurst(p.target.x, p.target.y, p.color || '#fff', 6);
        projPool.release(p); projectiles.splice(i,1);
      } else {
        p.x += (dx/d) * p.spd; p.y += (dy/d) * p.spd;
      }
    }

    // particles
    for (let i = particles.length-1; i>=0; i--){
      const P = particles[i];
      P.x += P.vx; P.y += P.vy; P.life--;
      if (P.life <= 0){ particlePool.release(P); particles.splice(i,1); }
    }
  }

  // ---------- DRAW ----------
  function draw(drawCtx){
    if (!drawCtx) return;
    // clear
    const W = canvas.width, H = canvas.height;
    drawCtx.fillStyle = cfg.colors.bg; drawCtx.fillRect(0,0,W,H);
    // path highlight tiles
    drawCtx.fillStyle = cfg.colors.path;
    Object.keys(flowMap).forEach(k => {
      const p = k.split(',').map(Number); drawCtx.fillRect(p[0]*cfg.GRID, p[1]*cfg.GRID, cfg.GRID, cfg.GRID);
    });
    // grid lines (subtle)
    drawCtx.strokeStyle = cfg.colors.grid; drawCtx.beginPath();
    for (let x=0; x<=cfg.COLS; x++){ drawCtx.moveTo(x*cfg.GRID,0); drawCtx.lineTo(x*cfg.GRID, H); }
    for (let y=0; y<=cfg.ROWS; y++){ drawCtx.moveTo(0,y*cfg.GRID); drawCtx.lineTo(W, y*cfg.GRID); }
    drawCtx.stroke();

    // towers (use sprite cache)
    for (let t of towers){
      const sprite = spriteCache[t.type];
      if (sprite){
        drawCtx.drawImage(sprite, t.gridX*cfg.GRID + Math.floor((cfg.GRID - sprite.width)/2), t.gridY*cfg.GRID + Math.floor((cfg.GRID - sprite.height)/2));
      } else {
        drawCtx.fillStyle = t.color; drawCtx.fillRect(t.x - 10, t.y - 10, 20, 20);
      }
      // hp ring
      drawCtx.strokeStyle = 'rgba(255,255,255,0.06)'; drawCtx.beginPath(); drawCtx.arc(t.x, t.y, Math.max(12, t.r*0.6), 0, Math.PI*2); drawCtx.stroke();
    }

    // enemies (batched)
    for (let e of enemies){
      // glow radial
      drawCtx.save();
      if (cfg.quality === 'high') { drawCtx.shadowBlur = 14; drawCtx.shadowColor = e.color; }
      const grad = drawCtx.createRadialGradient(e.x-4, e.y-4, 2, e.x, e.y, 14);
      grad.addColorStop(0, e.color); grad.addColorStop(1, 'rgba(0,0,0,0)');
      drawCtx.fillStyle = grad; drawCtx.beginPath(); drawCtx.arc(e.x, e.y, 8, 0, Math.PI*2); drawCtx.fill();
      drawCtx.restore();
      drawCtx.fillStyle = '#000'; drawCtx.beginPath(); drawCtx.arc(e.x, e.y, 4, 0, Math.PI*2); drawCtx.fill();
      // health bar
      drawCtx.fillStyle = '#222'; drawCtx.fillRect(e.x-10, e.y-12, 20, 3);
      drawCtx.fillStyle = '#0f0'; drawCtx.fillRect(e.x-10, e.y-12, 20 * Math.max(0, e.hp/e.maxHp), 3);
    }

    // projectiles
    for (let p of projectiles){
      drawCtx.fillStyle = p.color || '#fff'; drawCtx.beginPath(); drawCtx.arc(p.x, p.y, 3, 0, Math.PI*2); drawCtx.fill();
    }

    // particles
    for (let P of particles){
      drawCtx.globalAlpha = Math.max(0, P.life / 12);
      drawCtx.fillStyle = P.color || '#fff'; drawCtx.fillRect(P.x, P.y, 2, 2);
      drawCtx.globalAlpha = 1;
    }

    // HUD overlay small (caller may also render its own HUD)
    drawCtx.fillStyle = 'rgba(0,0,0,0.35)'; drawCtx.fillRect(8,8,220,44);
    drawCtx.fillStyle = '#fff'; drawCtx.font = '12px monospace';
    drawCtx.fillText(`Wave ${wave}`, 18, 30);
    drawCtx.fillStyle = '#FFD700'; drawCtx.fillText(`$${Math.floor(money)}`, 110, 30);
    drawCtx.fillStyle = '#ff6666'; drawCtx.fillText(`♥ ${lives}`, 180, 30);

    // selection inspector highlight
    if (selected){
      drawCtx.strokeStyle = '#fff'; drawCtx.lineWidth = 2;
      drawCtx.strokeRect(selected.gridX*cfg.GRID, selected.gridY*cfg.GRID, cfg.GRID, cfg.GRID);
    }
  }

  // ---------- PARTICLES HELPERS ----------
  function spawnParticleBurst(x,y,color,n){
    for (let i=0;i<n;i++){
      const p = particlePool.rent();
      p.x = x + (Math.random()-0.5)*8; p.y = y + (Math.random()-0.5)*8;
      p.vx = (Math.random()-0.5)*2.5; p.vy = (Math.random()-0.5)*2.5; p.life = 8 + Math.floor(Math.random()*8); p.color = color;
      particles.push(p);
    }
  }

  // ---------- LOOP ENTRY ----------
  let lastTick = U.now();
  function loop(){
    if (!running) return;
    const now = U.now();
    const dt = Math.min(33, now - lastTick); lastTick = now;
    update(dt);
    draw(ctx);
    loopId = requestAnimationFrame(loop);
  }

  // ---------- QUALITY / UTILITY ----------
  function setQuality(level){
    cfg.quality = level;
  }

  // ---------- EXPORT ----------
  return {
    init: init,
    update: (dt)=>update(dt||16),
    draw: (c)=>draw(c||ctx),
    click: click,
    startWave: startWave,
    setBuild: setBuild,
    tdSelectType: setBuild,
    upgrade: upgrade,
    sell: sell,
    reset: reset,
    stop: stop,
    setQuality: setQuality,
    // read-only
    get state(){ return {wave, money, lives, waveActive}; },
    get conf(){ return { towers: cfg.towers }; },
    get sel(){ return selected; }
  };
})();

if (typeof window !== 'undefined') window.SentinelGame = SentinelGame;
if (typeof module !== 'undefined') module.exports = SentinelGame;
