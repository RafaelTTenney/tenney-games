/* NEON CITADEL - V5 (HIGH RES PIXEL GRID) */
(function(global){
  const Neon = (function(){
    
    // CONFIG: 1200x800 Canvas / 20px Cell = 60x40 Grid
    // This allows for "Pixel" style maze building
    const CELL = 20; 
    let COLS, ROWS;
    
    // TOWER CONFIGURATION
    const TOWER_TYPES = {
        'gatling': { 
            name:'VULCAN', cost:100, color:'#00ffff', type:'phys', 
            dmg:6, rng:140, rate:5, hp:300, 
            desc:"Rapid-fire kinetic. Cheap and reliable." 
        },
        'pyro': {
            name:'PYRO', cost:350, color:'#ff5500', type:'chem',
            dmg:4, rng:100, rate:2, hp:400, cone:true,
            desc:"Flamethrower. Sprays fire in a cone."
        },
        'cannon': { 
            name:'NOVA', cost:450, color:'#ffaa00', type:'ex', 
            dmg:60, rng:180, rate:55, hp:500, aoe:60, 
            desc:"Explosive shells. Good AoE." 
        },
        'lance': { 
            name:'LANCE', cost:600, color:'#ff00aa', type:'energy', 
            dmg:5, rng:180, rate:0, hp:300, beam:true, 
            desc:"Concentrated plasma beam." 
        },
        'tesla': { 
            name:'STORM', cost:800, color:'#ffff00', type:'energy', 
            dmg:35, rng:150, rate:35, hp:400, chain:true, 
            desc:"High-voltage arcs chain to 5 targets." 
        },
        'missile': { 
            name:'HYDRA', cost:1200, color:'#00ff88', type:'ex', 
            dmg:180, rng:300, rate:70, hp:450, missile:true, 
            desc:"Long-range smart missiles." 
        },
        'laser': { 
            name:'PHASE', cost:2000, color:'#d000ff', type:'energy', 
            dmg:25, rng:260, rate:0, hp:800, beam:true, 
            desc:"Capital-class obliterator beam." 
        },
        'block': { 
            name:'WALL', cost:15, color:'#444', type:'none', 
            dmg:0, rng:0, rate:0, hp:1500, 
            desc:"Cheap wall for complex maze building." 
        }
    };

    // GAME STATE
    let canvas, ctx;
    let grid=[], towers=[], enemies=[], projectiles=[], particles=[], floatingText=[], gasClouds=[], debris=[];
    let mapStandard=[], mapDanger=[];
    let state = { wave:1, money:600, lives:20, active:false, frame:0, paused:false, shake:0 };
    let selection=null, buildMode=null, boss=null;
    let startNode, endNode;

    // --- INITIALIZATION ---
    function init(c) {
        canvas = c; ctx = c.getContext('2d');
        COLS = Math.floor(canvas.width / CELL);
        ROWS = Math.floor(canvas.height / CELL);
        startNode = {x:0, y:Math.floor(ROWS/2)};
        endNode = {x:COLS-1, y:Math.floor(ROWS/2)};
        reset();
    }

    function reset() {
        state = { wave:1, money:600, lives:20, active:false, frame:0, paused:false, shake:0 };
        towers=[]; enemies=[]; projectiles=[]; particles=[]; floatingText=[]; gasClouds=[]; debris=[];
        grid = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(null));
        recalcPaths();
    }

    // --- PATHFINDING (OPTIMIZED) ---
    function recalcPaths() {
        // Since the grid is 2400 tiles now, we only run this when necessary.
        mapStandard = createMap();
        mapDanger = createMap();

        // Tactician Weights
        let dangerWeights = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(0));
        towers.forEach(t => {
            if(t.type === 'block') return;
            // Smaller radius check for optimization
            let r = Math.ceil(t.rng/CELL);
            for(let xx=-r; xx<=r; xx++) {
                for(let yy=-r; yy<=r; yy++) {
                    let tx=t.gx+xx, ty=t.gy+yy;
                    if(tx>=0 && tx<COLS && ty>=0 && ty<ROWS) {
                        if((tx*CELL - t.x)**2 + (ty*CELL - t.y)**2 <= t.rng**2) {
                            dangerWeights[tx][ty] = 50; // High avoid cost
                        }
                    }
                }
            }
        });

        // Generate Maps
        generateFlowField(mapStandard, endNode, (x,y) => grid[x][y] ? 999999 : 1);
        generateFlowField(mapDanger, endNode, (x,y) => (grid[x][y] ? 999999 : 1) + dangerWeights[x][y]);
    }

    function createMap() {
        return new Array(COLS).fill(0).map(()=>new Array(ROWS).fill({cost:999999, next:null}));
    }

    function generateFlowField(map, target, weightFn) {
        let q = [];
        map[target.x][target.y] = { cost: 0, next: null };
        q.push(target);
        
        // Priority Queue (Buckets) optimization isn't needed for 60x40 in JS, standard array sort is fast enough (~2ms)
        const dirs = [[0,1], [0,-1], [1,0], [-1,0]]; 

        while(q.length) {
            // Sort by lowest cost
            q.sort((a,b) => map[a.x][a.y].cost - map[b.x][b.y].cost);
            let u = q.shift();
            
            dirs.forEach(d => {
                let nx = u.x + d[0], ny = u.y + d[1];
                if(nx>=0 && nx<COLS && ny>=0 && ny<ROWS) {
                    let w = weightFn(nx, ny);
                    let newCost = map[u.x][u.y].cost + w;
                    if(newCost < map[nx][ny].cost && w < 500000) {
                        map[nx][ny] = { cost: newCost, next: {x:u.x, y:u.y} };
                        q.push({x:nx, y:ny});
                    }
                }
            });
        }
    }

    function getNextMove(e) {
        let gx = Math.floor(e.x/CELL);
        let gy = Math.floor(e.y/CELL);
        if(gx<0 || gx>=COLS || gy<0 || gy>=ROWS) return {x:COLS-1, y:Math.floor(ROWS/2)};

        // Breaker AI
        if(e.ai === 'breaker') {
            // Check 3 tile radius
            let nearby = towers.find(t => Math.hypot(t.x - e.x, t.y - e.y) < CELL * 3);
            if(nearby) return { action: 'attack', target: nearby };
        }

        let map = (e.ai === 'tactician') ? mapDanger : mapStandard;
        let cell = map[gx][gy];
        if(!cell || !cell.next) cell = mapStandard[gx][gy]; 
        
        return cell ? cell.next : null;
    }

    // --- GAME LOOP ---
    function startWave() {
        if(state.active) return;
        state.active = true;
        
        // Interest Mechanic
        if(state.wave > 1) {
            let interest = Math.floor(state.money * 0.10);
            if(interest > 0) {
                state.money += interest;
                addText(canvas.width/2, canvas.height/2 + 40, `INTEREST EARNED: +$${interest}`, '#0f0', 120);
            }
        }

        let diffMult = 1 + (state.wave * 0.25); 
        let budget = 250 * diffMult + (state.wave * 150);
        let queue = [];

        const E_DEFS = {
            'drone':   { cost:10, hp:40,  spd:3.5, color:'#0ff', ai:'std' },
            'grunt':   { cost:25, hp:140, spd:2.0, color:'#f0f', ai:'std', res:['phys'] },
            'heavy':   { cost:70, hp:500, spd:1.0, color:'#0f0', ai:'std', res:['ex'] },
            'ninja':   { cost:50, hp:180, spd:3.0, color:'#ff0', ai:'tactician', res:['chem'] },
            'ram':     { cost:80, hp:450, spd:1.5, color:'#f80', ai:'breaker', res:[] },
            'spectre': { cost:120, hp:250, spd:4.0, color:'#fff', ai:'std', res:['energy'] } 
        };

        while(budget > 0) {
            let options = ['drone'];
            if(state.wave > 2) options.push('grunt');
            if(state.wave > 3) options.push('ram');
            if(state.wave > 5) options.push('ninja');
            if(state.wave > 7) options.push('heavy');
            if(state.wave > 9) options.push('spectre');
            
            let pick = options[Math.floor(Math.random()*options.length)];
            let def = E_DEFS[pick];
            queue.push({type:pick, ...def});
            budget -= def.cost;
        }

        let spawnIdx = 0;
        let int = setInterval(() => {
            if(state.paused) return;
            if(spawnIdx >= queue.length) {
                clearInterval(int);
                if(state.wave % 5 === 0) setTimeout(spawnBoss, 4000);
            } else {
                spawnEnemy(queue[spawnIdx]);
                spawnIdx++;
            }
        }, Math.max(80, 500 - state.wave*25)); // Spawns get very fast
    }

    function spawnEnemy(def) {
        let hp = def.hp * (1 + state.wave*0.35);
        enemies.push({
            x: 0, y: (Math.floor(ROWS/2) * CELL) + CELL/2,
            hp:hp, maxHp:hp, 
            spd:def.spd, color:def.color, type:def.type, ai:def.ai, res:def.res||[],
            angle:0, vx:0, vy:0, id:Math.random(), state: 'move', attackCooldown: 0
        });
    }

    function spawnBoss() {
        let hp = 20000 * Math.pow(1.6, state.wave/5);
        boss = {
            x: 0, y: (Math.floor(ROWS/2) * CELL) + CELL/2,
            hp:hp, maxHp:hp, spd:0.6, 
            type:'boss', bossType:'TITAN', ai:'breaker', color:'#fff', res:['phys','chem','energy','ex'],
            angle:0, isBoss:true, state:'move', frame:0
        };
        enemies.push(boss);
        state.shake = 40; 
        addText(canvas.width/2, canvas.height/2, `WARNING: TITAN CLASS APPROACHING`, "#f00", 200);
    }

    function update() {
        if(state.paused || state.lives <= 0) return;
        state.frame++;
        if(state.shake > 0) state.shake--;

        // --- ENEMIES ---
        for(let i=enemies.length-1; i>=0; i--) {
            let e = enemies[i];
            
            if(e.isBoss) e.frame++;

            // FIXED: Health Subtraction logic
            // Check if they passed the last column
            if(e.x >= (COLS-1)*CELL) {
                state.lives -= e.isBoss ? 1000 : 1;
                state.shake = 10;
                // Add breach effect
                for(let k=0;k<20;k++) particles.push({type:'spark', x:e.x, y:e.y, color:'red', life:30, vx:-5, vy:Math.random()*10-5});
                enemies.splice(i,1);
                if(e.isBoss) boss = null;
                continue;
            }

            let next = getNextMove(e);

            if(next && next.action === 'attack') {
                e.state = 'attack';
                if(state.frame % 15 === 0) {
                    e.attackAnim = 5; 
                    next.target.hp -= (e.isBoss ? 800 : 50); // Massive Boss Damage
                    addPart(next.target.x, next.target.y, '#f00', 3);
                    
                    if(next.target.hp <= 0) {
                        state.shake = 5;
                        destroyTower(next.target);
                        e.state = 'move';
                    }
                }
            } else if (next) {
                e.state = 'move';
                let tx = next.x*CELL + CELL/2;
                let ty = next.y*CELL + CELL/2;
                let dx = tx - e.x, dy = ty - e.y;
                let ang = Math.atan2(dy, dx);
                
                e.vx = Math.cos(ang) * e.spd;
                e.vy = Math.sin(ang) * e.spd;
                e.angle = ang;
                e.x += e.vx; e.y += e.vy;
            }

            if(e.hp <= 0) {
                let rew = e.isBoss ? 5000 : (e.maxHp/6);
                state.money += Math.floor(rew);
                addText(e.x, e.y, `+$${Math.floor(rew)}`, '#ff0');
                // Debris
                debris.push({x:e.x, y:e.y, color:'#333', life:600, angle:Math.random()*6});
                enemies.splice(i,1);
                if(e.isBoss) { boss = null; state.shake = 60; }
            }
            if(e.attackAnim > 0) e.attackAnim--;
        }

        // --- TOWERS ---
        towers.forEach(t => {
            if(t.type === 'block') return;

            // BEAM WEAPONS (Lance/Phase)
            if(t.beam) {
                let target = enemies.find(e => Math.hypot(e.x-t.x, e.y-t.y) < t.rng);
                if(target) {
                    t.angle = Math.atan2(target.y-t.y, target.x-t.x);
                    takeDamage(target, t.dmg, t.type); 
                    if(state.frame%2===0) particles.push({type:'spark', x:target.x, y:target.y, color:t.color, life:8, vx:Math.random()*6-3, vy:Math.random()*6-3});
                    t.firing = true; t.target = target;
                } else {
                    t.firing = false;
                }
                return;
            }

            // FLAMETHROWER (Pyro)
            if(t.cone) {
                 if(state.frame % 3 === 0) {
                     // Check range
                     let targets = enemies.filter(e => Math.hypot(e.x-t.x, e.y-t.y) < t.rng);
                     if(targets.length > 0) {
                         let target = targets[0];
                         t.angle = Math.atan2(target.y-t.y, target.x-t.x);
                         // Fire Particle
                         let spread = (Math.random()-0.5) * 0.5;
                         projectiles.push({
                             x:t.x, y:t.y, type:'fire', color:t.color, life:30, 
                             vx: Math.cos(t.angle+spread)*5, vy: Math.sin(t.angle+spread)*5
                         });
                         // Cone Damage
                         targets.forEach(e => {
                             let ea = Math.atan2(e.y-t.y, e.x-t.x);
                             let diff = Math.abs(ea - t.angle);
                             if(diff < 0.3 && Math.hypot(e.x-t.x, e.y-t.y) < t.rng) takeDamage(e, t.dmg, 'chem');
                         });
                     }
                 }
                 return;
            }

            if(t.cd > 0) t.cd--;
            else {
                let targets = enemies.filter(e => Math.hypot(e.x-t.x, e.y-t.y) < t.rng);
                if(targets.length > 0) {
                    targets.sort((a,b) => (b.isBoss?1000:0) + (a.hp - b.hp)); 
                    let target = targets[0];
                    t.angle = Math.atan2(target.y-t.y, target.x-t.x);

                    if(t.type === 'missile') {
                        projectiles.push({x:t.x, y:t.y, target:target, type:'missile', color:t.color, dmg:t.dmg, spd:4, acc:0.4, aoe:90});
                    }
                    else if(t.type === 'tesla') {
                        fireTesla(t, target, enemies);
                    }
                    else {
                        // Plasma Bolt
                        projectiles.push({
                            x:t.x, y:t.y, target:target, type:'plasma', 
                            dmg:t.dmg, color:t.color, spd:18, aoe:t.aoe,
                            vx: Math.cos(t.angle)*18, vy: Math.sin(t.angle)*18
                        });
                        t.muzzle = 4; 
                    }
                    t.cd = t.rate;
                    t.recoil = 6;
                }
            }
            if(t.recoil > 0) t.recoil--;
            if(t.muzzle > 0) t.muzzle--;
        });

        // --- PROJECTILES ---
        for(let i=projectiles.length-1; i>=0; i--) {
            let p = projectiles[i];
            
            if(p.type === 'fire') {
                p.x += p.vx; p.y += p.vy;
                p.life--;
                if(p.life<=0) projectiles.splice(i,1);
                continue;
            }

            if(p.type === 'missile') {
                if(!p.target || p.target.hp<=0) p.target = enemies[0];
                if(!p.target) { projectiles.splice(i,1); continue; }
                
                let ang = Math.atan2(p.target.y - p.y, p.target.x - p.x);
                let vx = Math.cos(ang) * p.spd;
                let vy = Math.sin(ang) * p.spd;
                p.x += vx; p.y += vy;
                p.spd += p.acc;
                particles.push({type:'smoke', x:p.x, y:p.y, life:8});

                if(Math.hypot(p.target.x-p.x, p.target.y-p.y) < p.spd) {
                     explode(p.x, p.y, p.aoe, p.dmg, 'ex');
                     projectiles.splice(i,1);
                }
                continue;
            }

            if(p.type === 'plasma') {
                p.x += p.vx; p.y += p.vy;
                particles.push({type:'spark', x:p.x, y:p.y, color:p.color, life:4, vx:0, vy:0});

                // Hit Detection
                let hit = enemies.find(e => Math.hypot(e.x-p.x, e.y-p.y) < 25);
                if(hit) {
                    if(p.aoe) explode(p.x, p.y, p.aoe, p.dmg, 'ex');
                    else {
                        takeDamage(hit, p.dmg, 'phys');
                        particles.push({type:'burst', x:p.x, y:p.y, color:p.color, life:10});
                    }
                    projectiles.splice(i,1);
                } 
                else if(p.x<0||p.x>canvas.width||p.y<0||p.y>canvas.height) {
                    projectiles.splice(i,1);
                }
            }
        }

        // Cleanup
        debris.forEach((d,i) => { d.life--; if(d.life<=0) debris.splice(i,1); });
        gasClouds.forEach((g,i) => { g.life--; if(g.life<=0) gasClouds.splice(i,1); });
        particles.forEach((p,i) => { p.life--; p.x+=(p.vx||0); p.y+=(p.vy||0); if(p.life<=0) particles.splice(i,1); });
        floatingText.forEach((t,i) => { t.y-=0.5; t.life--; if(t.life<=0) floatingText.splice(i,1); });

        if(state.active && enemies.length === 0) {
            state.active = false;
            state.wave++;
            state.money += 400; // Base wave clear
        }
    }

    // --- HELPERS ---
    function takeDamage(e, amt, type) {
        if(e.res.includes(type)) amt *= 0.25;
        e.hp -= amt;
    }

    function explode(x, y, r, dmg, type) {
        state.shake = 4;
        particles.push({type:'shockwave', x, y, life:15, color:'#ffaa00'});
        enemies.forEach(e => {
            if(Math.hypot(e.x-x, e.y-y) < r) takeDamage(e, dmg, type);
        });
    }

    function fireTesla(t, target, enemies) {
        let chain = [target];
        let curr = target;
        takeDamage(target, t.dmg, 'energy');
        let hops = t.attrLevels.special ? 8 : 5;
        for(let k=0; k<hops; k++) {
            let next = enemies.find(e => !chain.includes(e) && Math.hypot(e.x-curr.x, e.y-curr.y) < 130);
            if(next) {
                chain.push(next);
                takeDamage(next, t.dmg * 0.9, 'energy');
                curr = next;
            } else break;
        }
        particles.push({type:'bolt', chain:chain, color:t.color, life:5});
    }

    function destroyTower(t) {
        grid[t.gx][t.gy] = null;
        towers = towers.filter(tw => tw !== t);
        if(selection === t) selection = null;
        explode(t.x, t.y, 40, 0, 'none');
        recalcPaths();
    }

    // --- DRAWING ---
    function draw(ctx) {
        ctx.save();
        
        // Shake
        if(state.shake > 0) {
            ctx.translate((Math.random()-0.5)*state.shake, (Math.random()-0.5)*state.shake);
        }

        ctx.fillStyle = '#050508'; ctx.fillRect(0,0,canvas.width,canvas.height);
        
        // Render Debris
        debris.forEach(d => {
            ctx.save(); ctx.translate(d.x, d.y); ctx.rotate(d.angle);
            ctx.fillStyle = `rgba(50,50,50,${d.life/600})`;
            ctx.fillRect(-8,-8,16,16);
            ctx.restore();
        });

        // Subtle Grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for(let x=0;x<=COLS;x++) { ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,canvas.height); }
        for(let y=0;y<=ROWS;y++) { ctx.moveTo(0,y*CELL); ctx.lineTo(canvas.width,y*CELL); }
        ctx.stroke();

        // Valid Path Overlay
        if(buildMode) {
            ctx.fillStyle = 'rgba(0, 255, 200, 0.1)';
            for(let x=0;x<COLS;x++) for(let y=0;y<ROWS;y++) {
                if(mapStandard[x][y].cost < 999999) ctx.fillRect(x*CELL, y*CELL, CELL, CELL);
            }
        }

        // --- GLOW LAYER ---
        ctx.globalCompositeOperation = 'lighter';

        towers.forEach(t => drawTower(ctx, t));
        enemies.forEach(e => drawEnemy(ctx, e));

        projectiles.forEach(p => {
            ctx.shadowBlur = 10; ctx.shadowColor = p.color;
            ctx.fillStyle = p.color;
            if(p.type === 'fire') {
                 ctx.globalAlpha = p.life/30;
                 ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill();
                 ctx.globalAlpha = 1;
            } else if(p.type === 'plasma') {
                ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
            } else {
                ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
            }
            ctx.shadowBlur = 0;
        });

        particles.forEach(p => {
            if(p.type === 'bolt') {
                drawLightning(ctx, p.chain, p.color);
            } else if (p.type === 'shockwave') {
                ctx.strokeStyle = p.color; ctx.lineWidth = 2; 
                ctx.beginPath(); ctx.arc(p.x, p.y, (20-p.life)*4, 0, Math.PI*2); ctx.stroke();
            } else if (p.type === 'burst') {
                ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 10 - p.life, 0, Math.PI*2); ctx.fill();
            } else if (p.type === 'spark') {
                ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 2, 2);
            }
        });

        ctx.globalCompositeOperation = 'source-over'; // Reset

        // Floating Text
        ctx.font = 'bold 12px "Segoe UI"';
        floatingText.forEach(t => {
            ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
        });

        // Boss Bar
        if(boss) {
            let cx = canvas.width/2;
            let barW = 800;
            ctx.fillStyle = '#200'; ctx.fillRect(cx - barW/2, 50, barW, 20);
            ctx.fillStyle = '#f00'; ctx.fillRect(cx - barW/2, 50, barW*(boss.hp/boss.maxHp), 20);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(cx - barW/2, 50, barW, 20);
            ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.font='bold 16px monospace';
            ctx.fillText(`THREAT: TITAN // HP: ${Math.floor(boss.hp)}`, cx, 45);
            ctx.textAlign='left';
        }

        ctx.restore();
    }

    function drawLightning(ctx, chain, color) {
        if(chain.length < 2) return;
        ctx.strokeStyle = color; ctx.lineWidth = 2; 
        ctx.shadowColor = color; ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(chain[0].x, chain[0].y);
        
        for(let i=1; i<chain.length; i++) {
            let s = chain[i-1], e = chain[i];
            let dist = Math.hypot(e.x-s.x, e.y-s.y);
            let steps = Math.floor(dist/10); 
            if(steps<1) steps=1;
            
            for(let j=1; j<=steps; j++) {
                let t = j/steps;
                let nx = s.x + (e.x-s.x)*t;
                let ny = s.y + (e.y-s.y)*t;
                // Static jitter
                nx += (Math.random()-0.5)*10;
                ny += (Math.random()-0.5)*10;
                ctx.lineTo(nx, ny);
            }
        }
        ctx.stroke(); ctx.shadowBlur = 0;
    }

    function drawTower(ctx, t) {
        ctx.save();
        ctx.translate(t.x, t.y);
        
        // Base - Pixel Look
        ctx.fillStyle = '#111'; ctx.fillRect(-8,-8,16,16);
        ctx.strokeStyle = t.color; ctx.lineWidth=1; ctx.strokeRect(-8,-8,16,16);
        
        if(selection === t) {
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(0,0,t.rng,0,Math.PI*2); ctx.stroke();
        }

        ctx.rotate(t.angle || 0);
        
        // TURRET SPRITES
        ctx.fillStyle = t.color;
        if(t.type === 'gatling') {
            ctx.fillRect(-3, -6, 6, 12);
        } else if(t.beam) {
            ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = t.color; ctx.fillRect(-2,0,4,10);
            if(t.firing) {
                 let dist = t.target ? Math.hypot(t.target.y-t.y, t.target.x-t.x) : 200;
                 ctx.shadowBlur = 15; ctx.shadowColor = t.color;
                 ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
                 ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(dist, 0); ctx.stroke();
            }
        } else if (t.type === 'pyro') {
            ctx.fillStyle = '#d30'; ctx.fillRect(-5,-5,10,10);
            ctx.fillStyle = '#fa0'; ctx.fillRect(-3, 5, 6, 6);
        } else if (t.type === 'block') {
            ctx.fillStyle = '#333'; ctx.fillRect(-9,-9,18,18);
            ctx.fillStyle = '#555'; ctx.fillRect(-5,-5,10,10);
        } else {
            ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill();
        }

        ctx.restore();
        
        if(t.hp < t.maxHp) {
            ctx.fillStyle = 'red'; ctx.fillRect(t.x-8, t.y-12, 16, 2);
            ctx.fillStyle = '#0f0'; ctx.fillRect(t.x-8, t.y-12, 16*(t.hp/t.maxHp), 2);
        }
    }

    function drawEnemy(ctx, e) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);
        
        if(e.attackAnim) ctx.translate(Math.random()*4-2, 0);

        ctx.shadowColor = e.color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = e.color;

        if(e.isBoss) {
            ctx.scale(2.5, 2.5);
            ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.stroke();
        } else {
            ctx.fillRect(-4,-4,8,8); // Pixel enemy
        }

        ctx.restore();
    }

    // --- INPUT ---
    function click(x, y) {
        let gx = Math.floor(x/CELL);
        let gy = Math.floor(y/CELL);
        if(gx<0||gx>=COLS||gy<0||gy>=ROWS) return;

        let t = grid[gx][gy];
        if(t) { selection = t; buildMode = null; return; }

        if(buildMode) {
            let def = TOWER_TYPES[buildMode];
            grid[gx][gy] = {x:0}; recalcPaths();
            let valid = mapStandard[startNode.x][startNode.y].cost < 999999;
            grid[gx][gy] = null; 

            if(!valid) {
                addText(x, y, "BLOCKED PATH", "red");
                recalcPaths();
                return;
            }

            if(state.money >= def.cost) {
                state.money -= def.cost;
                let newT = {
                    gx, gy, x:gx*CELL+CELL/2, y:gy*CELL+CELL/2,
                    ...def, maxHp:def.hp, hp:def.hp, cd:0, 
                    attrLevels:{dmg:0,rng:0,rate:0}, id:Date.now()
                };
                grid[gx][gy] = newT;
                towers.push(newT);
                for(let i=0;i<8;i++) particles.push({type:'spark', x:newT.x, y:newT.y, color:'#fff', life:20, vx:Math.random()*4-2, vy:Math.random()*4-2});
                recalcPaths();
            } else {
                addText(x, y, "NO FUNDS", "red");
            }
        }
        selection = null;
    }

    function addPart(x,y,c,n) { for(let i=0;i<n;i++) particles.push({x,y,color:c,vx:Math.random()*4-2,vy:Math.random()*4-2,life:10+Math.random()*15}); }
    function addText(x,y,t,c,l=60) { floatingText.push({x,y,text:t,color:c,life:l}); }

    return {
        init, update, draw, click, startWave, 
        setBuild: (k)=>{ buildMode=k; selection=null; },
        deselect: ()=>{ selection=null; buildMode=null; state.paused=false; },
        pause: (b) => { state.paused = b; },
        upgrade: (attr) => {
            if(!selection) return;
            let typeDef = TOWER_TYPES[selection.type];
            if(!typeDef) return; 
            let cost = Math.floor(typeDef.cost * 0.5 * ((selection.attrLevels[attr]||0) + 1));
            if(state.money >= cost) {
                state.money -= cost;
                selection.attrLevels[attr] = (selection.attrLevels[attr]||0) + 1;
                if(attr === 'dmg') selection.dmg *= 1.25;
                if(attr === 'rng') { selection.rng *= 1.15; recalcPaths(); }
                if(attr === 'rate') selection.rate *= 0.85;
                addText(selection.x, selection.y, "UPGRADED", "#0f0");
            }
        },
        sell: () => { 
            if(selection && TOWER_TYPES[selection.type]) { 
                state.money += Math.floor(TOWER_TYPES[selection.type].cost * 0.5); 
                destroyTower(selection); 
            }
        },
        stop: ()=>{},
        conf: {towers: TOWER_TYPES},
        get state(){return state}, get sel(){return selection}, get buildMode(){return buildMode}
    };
  })();
  window.NeonGame = Neon;
})(window);
