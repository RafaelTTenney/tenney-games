{
type: uploaded file
fileName: sentinel-grid.js
fullContent:
/* Sentinel Grid - Classic Maze Building 
   - Functionality: Users place towers on a grid. Enemies pathfind using BFS.
   - Mechanics: Blocking path logic (must keep one path open).
*/

(function(global){
  const Sentinel = (function(){
    // Config
    const GRID = 30; // Larger grid cells for visibility
    const COLS = 30;
    const ROWS = 20;
    const BG_COLOR = '#051005';
    
    // Tower Defs
    const TOWERS = {
      blaster: { name:'BLASTER', cost:50, color:'#00FF00', range:3.5, dmg:12, rate:30 },
      sniper:  { name:'SNIPER', cost:120, color:'#00FFFF', range:8, dmg:60, rate:90 },
      rapid:   { name:'RAPID', cost:100, color:'#FFFF00', range:3, dmg:4, rate:8 }
    };

    // State
    let canvas, ctx, width, height;
    let towers=[], enemies=[], projs=[], particles=[];
    let map=[], flowMap={};
    let wave=1, money=300, lives=20, active=false;
    let buildType=null, selected=null;
    
    // Pathing
    const start = {x:0, y:Math.floor(ROWS/2)};
    const end = {x:COLS-1, y:Math.floor(ROWS/2)};

    function init(c) {
      canvas = c; ctx = c.getContext('2d');
      width = COLS * GRID; height = ROWS * GRID;
      canvas.width = width; canvas.height = height;
      reset();
    }

    function reset() {
      towers = []; enemies = []; projs = []; particles = [];
      wave = 1; money = 300; lives = 20; active = false;
      buildType = null; selected = null;
      calcPath();
    }

    function calcPath() {
        // BFS for Flow Map
        let q = [];
        let cameFrom = {};
        let targetKey = `${end.x},${end.y}`;
        
        // Initialize Map
        for(let x=0; x<COLS; x++) {
            map[x] = [];
            for(let y=0; y<ROWS; y++) {
                map[x][y] = 0; // 0 empty, 1 tower
            }
        }
        towers.forEach(t => map[t.gx][t.gy] = 1);

        // BFS from END backwards
        q.push(end);
        cameFrom[targetKey] = null;
        
        let foundStart = false;
        flowMap = {}; // Reset flow

        while(q.length > 0) {
            let curr = q.shift();
            if (curr.x === start.x && curr.y === start.y) foundStart = true;

            let dirs = [[0,1],[0,-1],[1,0],[-1,0]];
            for(let d of dirs) {
                let nx = curr.x + d[0];
                let ny = curr.y + d[1];
                let key = `${nx},${ny}`;
                
                if (nx >=0 && nx < COLS && ny >= 0 && ny < ROWS && map[nx][ny] === 0) {
                    if (!(key in cameFrom)) {
                        cameFrom[key] = curr; // Point to where we came from (towards end)
                        flowMap[key] = {x: curr.x, y: curr.y}; // Store vector to next step
                        q.push({x:nx, y:ny});
                    }
                }
            }
        }
        return foundStart;
    }

    function startWave() {
        if(active) return;
        active = true;
        let count = 8 + wave*2;
        let sent = 0;
        let int = setInterval(() => {
            spawnEnemy(wave);
            sent++;
            if(sent >= count) clearInterval(int);
        }, 800);
    }

    function spawnEnemy(lvl) {
        let hp = 20 + (lvl*15);
        let speed = 2 + (lvl*0.1);
        enemies.push({
            x: start.x*GRID, y: start.y*GRID + GRID/2,
            hp: hp, maxHp: hp, spd: speed,
            color: lvl%5===0 ? '#ff3333' : '#ff66ff',
            r: 8
        });
    }

    function update() {
        if (lives <= 0) return;

        // Enemies
        for(let i=enemies.length-1; i>=0; i--) {
            let e = enemies[i];
            let gx = Math.floor(e.x/GRID);
            let gy = Math.floor(e.y/GRID);
            
            // Movement
            let next = flowMap[`${gx},${gy}`];
            if (next) {
                let tx = next.x*GRID + GRID/2;
                let ty = next.y*GRID + GRID/2;
                let dx = tx - e.x;
                let dy = ty - e.y;
                let dist = Math.hypot(dx,dy);
                
                if (dist > e.spd) {
                    e.x += (dx/dist) * e.spd;
                    e.y += (dy/dist) * e.spd;
                } else {
                    e.x = tx; e.y = ty;
                }
            } else if (gx === end.x && gy === end.y) {
                enemies.splice(i, 1);
                lives--;
                continue;
            }

            // Death
            if (e.hp <= 0) {
                money += 15;
                enemies.splice(i, 1);
                // Particle boom
                for(let k=0; k<5; k++) particles.push({x:e.x, y:e.y, vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4, life:10});
            }
        }

        if (active && enemies.length === 0) {
            active = false;
            wave++;
        }

        // Towers
        towers.forEach(t => {
            if (t.cd > 0) t.cd--;
            else {
                let target = enemies.find(e => Math.hypot(e.x - t.x, e.y - t.y) < t.range);
                if (target) {
                    projs.push({x:t.x, y:t.y, tx:target.x, ty:target.y, speed:12, dmg:t.dmg, color:t.color, target:target});
                    t.cd = t.rate;
                }
            }
        });

        // Projectiles
        for(let i=projs.length-1; i>=0; i--) {
            let p = projs[i];
            if(p.target && enemies.includes(p.target)) {
                // homing
                let dx = p.target.x - p.x;
                let dy = p.target.y - p.y;
                let d = Math.hypot(dx,dy);
                if (d < p.speed) {
                    p.target.hp -= p.dmg;
                    projs.splice(i,1);
                } else {
                    p.x += (dx/d)*p.speed;
                    p.y += (dy/d)*p.speed;
                }
            } else {
                projs.splice(i,1);
            }
        }

        // Particles
        particles.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.life--; });
        particles = particles.filter(p => p.life > 0);
    }

    function draw(ctx) {
        // Clear
        ctx.fillStyle = BG_COLOR;
        ctx.fillRect(0,0,width,height);

        // Grid Lines
        ctx.strokeStyle = '#0a2a0a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let x=0; x<=width; x+=GRID) { ctx.moveTo(x,0); ctx.lineTo(x,height); }
        for(let y=0; y<=height; y+=GRID) { ctx.moveTo(0,y); ctx.lineTo(width,y); }
        ctx.stroke();

        // Path hint
        ctx.fillStyle = 'rgba(0, 255, 0, 0.05)';
        for(let key in flowMap) {
            let [x,y] = key.split(',').map(Number);
            ctx.fillRect(x*GRID, y*GRID, GRID, GRID);
        }

        // Start/End
        ctx.fillStyle = '#0f0'; ctx.fillRect(start.x*GRID, start.y*GRID, GRID, GRID);
        ctx.fillStyle = '#f00'; ctx.fillRect(end.x*GRID, end.y*GRID, GRID, GRID);

        // Towers
        towers.forEach(t => {
            ctx.fillStyle = t.color;
            ctx.fillRect(t.x-10, t.y-10, 20, 20);
            if (selected === t) {
                ctx.strokeStyle = '#fff';
                ctx.strokeRect(t.x-12, t.y-12, 24, 24);
                ctx.beginPath(); ctx.arc(t.x,t.y,t.range,0,Math.PI*2); ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.stroke();
            }
        });

        // Enemies
        enemies.forEach(e => {
            ctx.fillStyle = e.color;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill();
            // HP Bar
            ctx.fillStyle = 'red'; ctx.fillRect(e.x-8, e.y-12, 16, 3);
            ctx.fillStyle = '#0f0'; ctx.fillRect(e.x-8, e.y-12, 16*(e.hp/e.maxHp), 3);
        });

        // Projectiles
        projs.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x-2, p.y-2, 4, 4);
        });
        
        // Particles
        ctx.fillStyle = '#fff';
        particles.forEach(p => ctx.fillRect(p.x, p.y, 2, 2));

        // Placement Preview
        if(buildType) {
            let def = TOWERS[buildType];
            // We need current mouse position, but we only have click. 
            // In a real sophisticated engine we'd track mousemove. 
            // For now, no ghost preview to save complexity, just standard click-to-build.
        }
    }

    function click(x, y) {
        let gx = Math.floor(x/GRID);
        let gy = Math.floor(y/GRID);
        
        if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) return;

        // Select existing
        let existing = towers.find(t => t.gx === gx && t.gy === gy);
        if (existing) {
            selected = existing;
            buildType = null;
            return;
        }

        // Build
        if (buildType && money >= TOWERS[buildType].cost) {
            // Tentative placement
            let def = TOWERS[buildType];
            let t = {gx, gy, x:gx*GRID+GRID/2, y:gy*GRID+GRID/2, ...def, level:1, cd:0};
            towers.push(t);
            
            // Check Path
            if (calcPath()) {
                money -= def.cost;
                // Particle POOF
                for(let i=0;i<8;i++) particles.push({x:t.x,y:t.y,vx:(Math.random()-0.5)*5,vy:(Math.random()-0.5)*5,life:15});
            } else {
                towers.pop(); // Blocked path, revert
                calcPath(); // recalculate old valid path
            }
        }
        selected = null;
    }

    function setBuild(k) { buildType = k; selected = null; }
    function upgrade() {
        if(!selected || money < selected.cost) return;
        money -= Math.floor(selected.cost * 0.8);
        selected.level++;
        selected.dmg *= 1.3;
        selected.range *= 1.1;
    }
    function sell() {
        if(!selected) return;
        money += Math.floor(selected.cost * 0.5);
        towers = towers.filter(t => t !== selected);
        selected = null;
        calcPath();
    }

    return {
        init, update, draw, click, startWave, setBuild, upgrade, sell, stop: ()=>{},
        conf: {towers: TOWERS},
        get wave(){return wave}, get money(){return money}, get lives(){return lives}, get sel(){return selected}, get buildMode(){return buildType}
    };
  })();
  
  if(typeof window !== 'undefined') window.SentinelGame = Sentinel;
})(window);
}
