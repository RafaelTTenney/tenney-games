{
type: uploaded file
fileName: neon-citadel.js
fullContent:
/* NEON CITADEL - Flagship Tower Defence
   Features:
   - Dijkstra Maps for Smart AI (Avoids high damage zones)
   - Destructible Towers & Breaker Enemies
   - Complex Particles & Glow Effects
   - 3-Way Upgrade System per Tower
   - Boss Mechanics
*/

(function(global){
  const Neon = (function(){
    
    // --- CONFIGURATION ---
    const CELL = 20;
    const COLS = 45; 
    const ROWS = 30; 
    const GRID_W = COLS * CELL;
    const GRID_H = ROWS * CELL;
    
    // Tech Tree / Defs
    const TOWER_TYPES = {
        'gatling': { name:'VULCAN', cost:150, color:'#ff00ff', dmg:5, rng: 120, rate: 5, hp: 200 },
        'cannon':  { name:'HEAVY',  cost:350, color:'#00ffff', dmg:80, rng: 180, rate: 60, hp: 400, aoe: 40 },
        'tesla':   { name:'TESLA',  cost:500, color:'#ffff00', dmg:15, rng: 100, rate: 30, hp: 300, chain: 3 },
        'buffer':  { name:'AEGIS',  cost:400, color:'#00ff00', dmg:0,  rng: 80,  rate: 0,  hp: 800, buff: true }
    };

    // --- GAME STATE ---
    let canvas, ctx;
    let grid = []; // 2D array for occupancy/tower refs
    let costMap = []; // Dijkstra map for smart enemies
    let towers = [];
    let enemies = [];
    let projectiles = [];
    let particles = [];
    let floatingTexts = [];
    
    let state = {
        wave: 1,
        money: 800,
        lives: 50,
        active: false,
        gameOver: false,
        frame: 0
    };
    
    let selection = null;
    let buildMode = null;
    let bossActive = null;

    // --- INITIALIZATION ---
    function init(c) {
        canvas = c; ctx = c.getContext('2d');
        canvas.width = GRID_W;
        canvas.height = GRID_H;
        reset();
    }

    function reset() {
        state = { wave: 1, money: 800, lives: 50, active: false, gameOver: false, frame: 0 };
        towers = []; enemies = []; projectiles = []; particles = [];
        selection = null; buildMode = null; bossActive = null;
        
        // Init Grid
        grid = new Array(COLS).fill(0).map(() => new Array(ROWS).fill(null));
        recalcPaths();
    }

    // --- AI & PATHFINDING (Dijkstra) ---
    function recalcPaths() {
        // Create Cost Map based on Tower DPS zones
        // Normal floor = 1. High Damage zone = 5+. Towers = Infinity (unless blocking)
        
        let dMap = new Array(COLS).fill(0).map(() => new Array(ROWS).fill(9999));
        let weightMap = new Array(COLS).fill(0).map(() => new Array(ROWS).fill(1));

        // Mark dangerous zones
        towers.forEach(t => {
            let cx = t.gx, cy = t.gy;
            let rangeCells = Math.ceil(t.rng / CELL);
            for(let xx = -rangeCells; xx <= rangeCells; xx++) {
                for(let yy = -rangeCells; yy <= rangeCells; yy++) {
                    let tx = cx+xx, ty = cy+yy;
                    if(tx>=0 && tx<COLS && ty>=0 && ty<ROWS) {
                        weightMap[tx][ty] += (t.dmg / t.rate) * 2; // Higher DPS = Higher Weight
                    }
                }
            }
            grid[t.gx][t.gy] = t; // Mark occupancy
        });

        // Target is middle right
        let target = {x: COLS-1, y: Math.floor(ROWS/2)};
        let q = [target];
        dMap[target.x][target.y] = 0;

        // Dijkstra Flood Fill
        while(q.length) {
            let curr = q.shift(); // Get node with lowest dist (simplified queue)
            
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(d => {
                let nx = curr.x + d[0], ny = curr.y + d[1];
                if(nx >=0 && nx < COLS && ny >=0 && ny < ROWS && !grid[nx][ny]) {
                    let newCost = dMap[curr.x][curr.y] + weightMap[nx][ny];
                    if(newCost < dMap[nx][ny]) {
                        dMap[nx][ny] = newCost;
                        // Determine insertion index for priority queue (simple sort for now)
                        q.push({x:nx, y:ny});
                        q.sort((a,b) => dMap[a.x][a.y] - dMap[b.x][b.y]);
                    }
                }
            });
        }
        costMap = dMap;
    }

    function getNextMove(gx, gy, type) {
        // "Breakers" might attack walls, others follow flow
        let best = {x:gx, y:gy, val: 99999};
        
        // If Breaker and near tower, return null (stay to attack)
        if(type === 'breaker') {
            let neighbors = [[0,1],[0,-1],[1,0],[-1,0]];
            for(let d of neighbors) {
                let nx=gx+d[0], ny=gy+d[1];
                if(grid[nx] && grid[nx][ny] && grid[nx][ny].hp) return 'attack'; // Special flag
            }
        }

        // Standard gradient descent on CostMap
        [[0,1],[0,-1],[1,0],[-1,0]].forEach(d => {
            let nx = gx + d[0], ny = gy + d[1];
            if(nx>=0 && nx<COLS && ny>=0 && ny<ROWS) {
                if(costMap[nx][ny] < best.val) {
                    best = {x:nx, y:ny, val:costMap[nx][ny]};
                }
            }
        });
        return best;
    }

    // --- GAME LOOP ---
    function update() {
        if(state.gameOver) return;
        state.frame++;

        // --- ENEMY LOGIC ---
        for(let i=enemies.length-1; i>=0; i--) {
            let e = enemies[i];
            
            // Movement Logic
            let gx = Math.floor(e.x/CELL);
            let gy = Math.floor(e.y/CELL);
            
            if (gx === COLS-1) { // Reached End
                state.lives--;
                enemies.splice(i,1);
                if(state.lives<=0) state.gameOver = true;
                continue;
            }

            if(e.freeze > 0) e.freeze--;
            else {
                let move = getNextMove(gx, gy, e.type);
                
                if(move === 'attack') {
                    // Attack adjacent tower
                    if(state.frame % 30 === 0) {
                        // Find tower
                        let neighbors = [[0,1],[0,-1],[1,0],[-1,0]];
                        for(let d of neighbors) {
                            let t = grid[gx+d[0]][gy+d[1]];
                            if(t && t.hp) {
                                t.hp -= e.dmg;
                                addParticle(t.x, t.y, '#ff0000', 5);
                                if(t.hp <= 0) destroyTower(t);
                                break;
                            }
                        }
                    }
                } else {
                    let tx = move.x * CELL + CELL/2;
                    let ty = move.y * CELL + CELL/2;
                    let angle = Math.atan2(ty - e.y, tx - e.x);
                    e.x += Math.cos(angle) * e.spd;
                    e.y += Math.sin(angle) * e.spd;
                }
            }

            if(e.hp <= 0) {
                state.money += e.val;
                addFloatingText(e.x, e.y, `+$${e.val}`, '#ffff00');
                if(e.isBoss) bossActive = null;
                enemies.splice(i,1);
                // Big Explosion
                for(let k=0;k<15;k++) addParticle(e.x, e.y, e.color, 20);
            }
        }

        // --- TOWER LOGIC ---
        towers.forEach(t => {
            if(t.cd > 0) t.cd--;
            else {
                // Find Target
                let target = null;
                // Simple distance check (optimization: limit check to nearby cells)
                let rangeSq = t.rng * t.rng;
                for(let e of enemies) {
                    let dSq = (e.x-t.x)**2 + (e.y-t.y)**2;
                    if(dSq <= rangeSq) {
                        target = e;
                        break; // First target
                    }
                }

                if(target) {
                    if(t.type === 'tesla') {
                        // Chain Lightning
                        fireTesla(t, target);
                    } else {
                        // Projectile
                        projectiles.push({
                            x:t.x, y:t.y, target:target, 
                            type: t.type, dmg: t.dmg, speed: 12, 
                            color: t.color, aoe: t.aoe
                        });
                    }
                    t.cd = t.rate;
                }
            }
        });

        // --- PROJECTILES ---
        for(let i=projectiles.length-1; i>=0; i--) {
            let p = projectiles[i];
            if(!p.target) { projectiles.splice(i,1); continue; }
            
            let dx = p.target.x - p.x;
            let dy = p.target.y - p.y;
            let dist = Math.hypot(dx,dy);
            
            if(dist < p.speed) {
                // Hit
                if(p.aoe) {
                    // Explosion
                    enemies.forEach(e => {
                        if(Math.hypot(e.x-p.target.x, e.y-p.target.y) < p.aoe) {
                            e.hp -= p.dmg;
                        }
                    });
                    addParticle(p.target.x, p.target.y, 'orange', 10);
                } else {
                    p.target.hp -= p.dmg;
                }
                projectiles.splice(i,1);
            } else {
                p.x += (dx/dist)*p.speed;
                p.y += (dy/dist)*p.speed;
            }
        }
        
        // --- PARTICLES ---
        updateParticles();
    }

    function fireTesla(source, firstTarget) {
        let chain = [firstTarget];
        let curr = firstTarget;
        curr.hp -= source.dmg;
        
        let max = source.attrLevels.special ? 5 : 3; // Upgrade check
        
        for(let i=0; i<max; i++) {
            let next = enemies.find(e => e!==curr && !chain.includes(e) && Math.hypot(e.x-curr.x, e.y-curr.y) < 100);
            if(next) {
                next.hp -= source.dmg * 0.8;
                chain.push(next);
                curr = next;
            } else break;
        }
        
        // Visual
        particles.push({type:'lightning', chain: chain, start:{x:source.x, y:source.y}, life:5, color:'#ffff00'});
    }

    function destroyTower(t) {
        grid[t.gx][t.gy] = null;
        towers = towers.filter(tw => tw !== t);
        if(selection === t) selection = null;
        recalcPaths();
        // Debris particles
        for(let i=0; i<20; i++) addParticle(t.x, t.y, '#555', 30);
    }

    // --- RENDER ---
    function draw(ctx) {
        // BG
        ctx.fillStyle = '#020205'; ctx.fillRect(0,0,canvas.width,canvas.height);
        
        // Grid (Faint)
        ctx.strokeStyle = '#111'; ctx.beginPath();
        for(let x=0;x<=GRID_W;x+=CELL) { ctx.moveTo(x,0); ctx.lineTo(x,GRID_H); }
        for(let y=0;y<=GRID_H;y+=CELL) { ctx.moveTo(0,y); ctx.lineTo(GRID_W,y); }
        ctx.stroke();

        // High Quality Glow
        ctx.globalCompositeOperation = 'lighter';

        // Towers
        towers.forEach(t => {
            ctx.shadowBlur = 15; ctx.shadowColor = t.color;
            ctx.fillStyle = t.color;
            ctx.fillRect(t.x-8, t.y-8, 16, 16);
            
            // Health Bar for Tower
            if(t.hp < t.maxHp) {
                ctx.fillStyle = 'red'; ctx.fillRect(t.x-10, t.y-15, 20, 2);
                ctx.fillStyle = '#0f0'; ctx.fillRect(t.x-10, t.y-15, 20*(t.hp/t.maxHp), 2);
            }

            // Selection Ring
            if(selection === t) {
                ctx.strokeStyle = '#fff'; ctx.lineWidth=2;
                ctx.strokeRect(t.x-10, t.y-10, 20, 20);
                ctx.beginPath(); ctx.arc(t.x, t.y, t.rng, 0, Math.PI*2); 
                ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.stroke();
            }
        });

        // Enemies
        enemies.forEach(e => {
            ctx.shadowBlur = 10; ctx.shadowColor = e.color;
            ctx.fillStyle = e.color;
            
            // Draw Complex Enemy Shape
            ctx.save();
            ctx.translate(e.x, e.y);
            if(e.type === 'breaker') {
                ctx.rotate(state.frame * 0.1);
                ctx.fillRect(-6,-6, 12, 12);
            } else if (e.isBoss) {
                ctx.scale(2,2);
                ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
            } else {
                ctx.beginPath(); ctx.moveTo(5,0); ctx.lineTo(-5, 4); ctx.lineTo(-5,-4); ctx.fill();
            }
            ctx.restore();
        });

        // Projectiles
        projectiles.forEach(p => {
            ctx.shadowBlur = 5; ctx.shadowColor = p.color;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
        });

        // Particles
        particles.forEach(p => {
            if(p.type === 'lightning') {
                ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.beginPath();
                ctx.moveTo(p.start.x, p.start.y);
                p.chain.forEach(node => ctx.lineTo(node.x, node.y));
                ctx.stroke();
            } else {
                ctx.globalAlpha = p.life/10;
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, 2, 2);
            }
        });

        ctx.globalCompositeOperation = 'source-over';
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;

        // Floating Text
        updateFloatingText(ctx);

        // Boss Bar
        if(bossActive) {
            ctx.fillStyle = '#330000'; ctx.fillRect(200, 20, GRID_W-400, 20);
            ctx.fillStyle = '#ff0000'; ctx.fillRect(200, 20, (GRID_W-400)*(bossActive.hp/bossActive.maxHp), 20);
            ctx.fillStyle = '#fff'; ctx.font = '12px Arial'; ctx.fillText("MEGA BOSS", 210, 35);
        }
    }

    // --- UTILS ---
    function addParticle(x, y, color, count) {
        for(let i=0; i<count; i++) {
            particles.push({
                x:x, y:y, color:color, 
                vx:(Math.random()-0.5)*3, vy:(Math.random()-0.5)*3, 
                life: 20 + Math.random()*20 
            });
        }
    }

    function updateParticles() {
        for(let i=particles.length-1; i>=0; i--) {
            let p = particles[i];
            if(p.type !== 'lightning') {
                p.x += p.vx; p.y += p.vy;
            }
            p.life--;
            if(p.life <= 0) particles.splice(i,1);
        }
    }

    function addFloatingText(x, y, text, color) {
        floatingTexts.push({x, y, text, color, life: 40});
    }
    
    function updateFloatingText(ctx) {
        ctx.font = '10px monospace';
        for(let i=floatingTexts.length-1; i>=0; i--) {
            let t = floatingTexts[i];
            t.y -= 0.5; t.life--;
            ctx.fillStyle = t.color;
            ctx.fillText(t.text, t.x, t.y);
            if(t.life<=0) floatingTexts.splice(i,1);
        }
    }

    // --- CONTROLS API ---
    function click(x, y) {
        let gx = Math.floor(x/CELL), gy = Math.floor(y/CELL);
        
        // Select Tower
        let t = grid[gx] ? grid[gx][gy] : null;
        if(t) { selection = t; buildMode = null; return; }

        // Build
        if(buildMode && state.money >= TOWER_TYPES[buildMode].cost) {
            // Can build mid-wave but costs 50% more?
            let cost = TOWER_TYPES[buildMode].cost;
            if(state.active) cost = Math.floor(cost * 1.5);
            
            if(state.money < cost) {
                addFloatingText(x, y, "Insufficient Funds", 'red');
                return;
            }

            // Create
            let def = TOWER_TYPES[buildMode];
            let newT = {
                gx, gy, x:gx*CELL+CELL/2, y:gy*CELL+CELL/2,
                type: buildMode, name: def.name, color: def.color,
                dmg: def.dmg, rng: def.rng, rate: def.rate, 
                hp: def.hp, maxHp: def.hp,
                cd: 0, aoe: def.aoe,
                attrLevels: { dmg:0, rng:0, rate:0 }
            };
            
            towers.push(newT);
            state.money -= cost;
            addParticle(newT.x, newT.y, '#fff', 10);
            
            // Recalc path to ensure not blocking start
            recalcPaths();
            // If path blocked? (Implementation detail: complex for open grid, usually we allow maze block or check path existence)
            // For Flagship complexity, we assume blocking is allowed but enemies attack walls.
        } else {
            selection = null;
        }
    }

    function startWave() {
        if(state.active) return;
        state.active = true;
        
        // Wave config
        let count = 10 + state.wave * 2;
        let hpMult = 1 + (state.wave * 0.2);
        
        let sent = 0;
        let int = setInterval(() => {
            let type = 'norm';
            // Logic for types
            if(state.wave > 2 && Math.random()>0.7) type = 'breaker';
            if(state.wave > 4 && Math.random()>0.8) type = 'fast';

            spawnEnemy(type, hpMult);
            sent++;
            if(sent >= count) {
                clearInterval(int);
                // Check Boss
                if(state.wave % 5 === 0) spawnEnemy('boss', hpMult*5);
                else spawnEnemy('miniboss', hpMult*2);
            }
        }, 800);
    }

    function spawnEnemy(type, mult) {
        let hp = 40 * mult;
        let spd = 1.5;
        let color = '#f0f';
        let isBoss = false;

        if(type === 'breaker') { color = '#ff8800'; hp *= 1.5; spd = 1.0; } // Attacks walls
        if(type === 'fast') { color = '#ffff00'; hp *= 0.6; spd = 2.5; }
        if(type === 'miniboss') { color = '#aa00aa'; hp *= 3; spd = 1.2; }
        if(type === 'boss') { color = '#ff0000'; hp *= 10; spd = 0.8; isBoss = true; }

        let e = {
            x: 0, y: Math.floor(ROWS/2)*CELL + CELL/2,
            hp, maxHp: hp, spd, color, type, val: 20,
            isBoss: isBoss, dmg: 10, freeze: 0
        };
        enemies.push(e);
        if(isBoss) bossActive = e;
    }

    function upgrade(attr) {
        if(!selection) return;
        let baseCost = TOWER_TYPES[selection.type].cost;
        
        // Custom upgrade logic
        if(attr === 'dmg') {
            let cost = Math.floor(baseCost * 0.5 * ((selection.attrLevels.dmg||0)+1));
            if(state.money >= cost) { state.money-=cost; selection.dmg *= 1.4; selection.attrLevels.dmg++; }
        }
        if(attr === 'rng') {
             let cost = Math.floor(baseCost * 0.4 * ((selection.attrLevels.rng||0)+1));
             if(state.money >= cost) { state.money-=cost; selection.rng *= 1.2; selection.attrLevels.rng++; }
        }
        if(attr === 'rate') {
             let cost = Math.floor(baseCost * 0.6 * ((selection.attrLevels.rate||0)+1));
             if(state.money >= cost) { state.money-=cost; selection.rate *= 0.85; selection.attrLevels.rate++; }
        }
        // Recalc paths because threat level changed
        recalcPaths();
    }
    
    function setBuild(k) { buildMode = k; selection = null; }

    return {
        init, update, draw, click, startWave, setBuild, upgrade, 
        sell: () => { if(selection) { state.money += Math.floor(TOWER_TYPES[selection.type].cost*0.5); destroyTower(selection); } }, 
        stop: () => {},
        conf: { towers: TOWER_TYPES },
        get wave(){return state.wave}, get money(){return state.money}, get lives(){return state.lives}, 
        get sel(){return selection}, get buildMode(){return buildMode}
    };
  })();

  if(typeof window !== 'undefined') window.NeonGame = Neon;
})(window);
}
