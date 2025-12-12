/* NEON CITADEL - ULTIMATE EDITION V2 */
(function(global){
  const Neon = (function(){
    
    // CONFIG: 1200x800 Canvas. Cell size 30 = 40x26 Grid.
    const CELL = 30; 
    let COLS, ROWS;
    
    // TOWER CONFIGURATION
    const TOWER_TYPES = {
        'gatling': { 
            name:'VULCAN', cost:100, color:'#00ffff', type:'phys', 
            dmg:6, rng:120, rate:5, hp:300, 
            desc:"High rate of fire kinetic turret. Good vs shields." 
        },
        'cannon': { 
            name:'NOVA', cost:300, color:'#ffaa00', type:'ex', 
            dmg:50, rng:180, rate:60, hp:500, aoe:70, 
            desc:"Heavy explosive shells. Deals Area of Effect damage." 
        },
        'laser': { 
            name:'PRISM', cost:450, color:'#ff00ff', type:'energy', 
            dmg:3, rng:200, rate:0, hp:350, beam:true, 
            desc:"Continuous laser beam. Melts armor over time." 
        },
        'tesla': { 
            name:'ARC', cost:550, color:'#ffff00', type:'energy', 
            dmg:18, rng:150, rate:30, hp:400, chain:true, 
            desc:"Chains lightning between multiple targets." 
        },
        'missile': { 
            name:'HYDRA', cost:650, color:'#00ff88', type:'ex', 
            dmg:120, rng:280, rate:90, hp:400, missile:true, 
            desc:"Long-range homing missiles." 
        },
        'slow': { 
            name:'STASIS', cost:250, color:'#0088ff', type:'energy', 
            dmg:0, rng:120, rate:40, hp:600, slow:0.5, 
            desc:"Temporal field that slows enemies by 50%." 
        },
        'poison': { 
            name:'VENOM', cost:400, color:'#00ff00', type:'chem', 
            dmg:5, rng:140, rate:10, hp:450, gas:true, 
            desc:"Sprays corrosive gas that ignores shields." 
        },
        'block': { 
            name:'WALL', cost:25, color:'#555555', type:'none', 
            dmg:0, rng:0, rate:0, hp:1500, 
            desc:"A reinforced barrier to reroute enemies." 
        }
    };

    // GAME STATE
    let canvas, ctx;
    let grid=[], towers=[], enemies=[], projectiles=[], particles=[], floatingText=[], gasClouds=[];
    let mapStandard=[], mapDanger=[];
    let state = { wave:1, money:900, lives:50, active:false, frame:0, paused:false };
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
        state = { wave:1, money:900, lives:50, active:false, frame:0, paused:false };
        towers=[]; enemies=[]; projectiles=[]; particles=[]; floatingText=[]; gasClouds=[];
        grid = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(null));
        recalcPaths();
    }

    // --- PATHFINDING (Dijkstra Flow Fields) ---
    function recalcPaths() {
        mapStandard = createMap();
        mapDanger = createMap();

        // Weighted map for "Tactician" enemies who avoid towers
        let dangerWeights = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(0));
        towers.forEach(t => {
            if(t.type === 'block') return;
            let r = Math.ceil(t.rng/CELL);
            for(let xx=-r; xx<=r; xx++) {
                for(let yy=-r; yy<=r; yy++) {
                    let tx=t.gx+xx, ty=t.gy+yy;
                    if(tx>=0 && tx<COLS && ty>=0 && ty<ROWS) {
                        if((tx*CELL - t.x)**2 + (ty*CELL - t.y)**2 <= t.rng**2) {
                            dangerWeights[tx][ty] += 15; 
                        }
                    }
                }
            }
        });

        generateFlowField(mapStandard, endNode, (x,y) => grid[x][y] ? 9999 : 1);
        generateFlowField(mapDanger, endNode, (x,y) => (grid[x][y] ? 9999 : 1) + dangerWeights[x][y]);
    }

    function createMap() {
        return new Array(COLS).fill(0).map(()=>new Array(ROWS).fill({cost:999999, next:null}));
    }

    function generateFlowField(map, target, weightFn) {
        let q = [];
        map[target.x][target.y] = { cost: 0, next: null };
        q.push(target);
        const dirs = [[0,1], [0,-1], [1,0], [-1,0]]; // Cardinals

        while(q.length) {
            q.sort((a,b) => map[a.x][a.y].cost - map[b.x][b.y].cost);
            let u = q.shift();
            
            dirs.forEach(d => {
                let nx = u.x + d[0], ny = u.y + d[1];
                if(nx>=0 && nx<COLS && ny>=0 && ny<ROWS) {
                    let w = weightFn(nx, ny);
                    let newCost = map[u.x][u.y].cost + w;
                    if(newCost < map[nx][ny].cost && w < 9000) {
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

        // Breaker AI: Attacks towers if path is long or blocked
        if(e.ai === 'breaker') {
            let dirs = [[1,0],[-1,0],[0,1],[0,-1]];
            for(let d of dirs) {
                let tx = gx+d[0], ty = gy+d[1];
                if(grid[tx]?.[ty]) return { action:'attack', target:grid[tx][ty] };
            }
        }

        let map = (e.ai === 'tactician') ? mapDanger : mapStandard;
        let cell = map[gx][gy];
        if(!cell || !cell.next) cell = mapStandard[gx][gy]; // Fallback
        
        return cell ? cell.next : null;
    }

    // --- GAME LOOP ---
    function startWave() {
        if(state.active) return;
        state.active = true;
        
        // Dynamic Difficulty
        let diffMult = 1 + (state.wave * 0.12);
        let budget = 150 * diffMult + (state.wave * 40);
        let queue = [];

        const E_DEFS = {
            'drone':   { cost:10, hp:35,  spd:2.2, color:'#0ff', ai:'std' },
            'walker':  { cost:25, hp:100, spd:1.0, color:'#f0f', ai:'std', res:['phys'] },
            'heavy':   { cost:60, hp:400, spd:0.5, color:'#0f0', ai:'std', res:['ex'] },
            'ninja':   { cost:45, hp:120, spd:1.8, color:'#ff0', ai:'tactician', res:['chem'] },
            'ram':     { cost:80, hp:300, spd:0.8, color:'#f80', ai:'breaker', res:[] },
            'cluster': { cost:15, hp:50,  spd:2.5, color:'#aaa', ai:'std', count:3 } // Spawns 3
        };

        // Procedural Wave Generation
        while(budget > 0) {
            let options = ['drone'];
            if(state.wave > 2) options.push('walker');
            if(state.wave > 4) options.push('cluster');
            if(state.wave > 5) options.push('ninja');
            if(state.wave > 7) options.push('heavy');
            if(state.wave > 9) options.push('ram');
            
            let pick = options[Math.floor(Math.random()*options.length)];
            let def = E_DEFS[pick];
            
            if(pick === 'cluster') {
                for(let k=0; k<3; k++) queue.push({...def, type:'drone', cost:0}); // Mutate to drones
            } else {
                queue.push({type:pick, ...def});
            }
            budget -= def.cost;
        }

        let spawnIdx = 0;
        let int = setInterval(() => {
            if(state.paused) return;
            if(spawnIdx >= queue.length) {
                clearInterval(int);
                if(state.wave % 5 === 0) setTimeout(spawnBoss, 3000); // Boss Wave every 5
            } else {
                spawnEnemy(queue[spawnIdx]);
                spawnIdx++;
            }
        }, Math.max(200, 600 - state.wave*15));
    }

    function spawnEnemy(def) {
        let hp = def.hp * (1 + state.wave*0.1);
        enemies.push({
            x: 0, y: (Math.floor(ROWS/2) * CELL) + CELL/2,
            hp:hp, maxHp:hp, 
            spd:def.spd, color:def.color, type:def.type, ai:def.ai, res:def.res||[],
            angle:0, vx:0, vy:0, id:Math.random()
        });
    }

    function spawnBoss() {
        // Unique Boss Generation
        let types = ['MECH', 'HIVE', 'EYE', 'CONSTRUCT'];
        let type = types[(state.wave/5 - 1) % types.length];
        let hp = 4000 * Math.pow(1.3, state.wave/5);
        
        boss = {
            x: 0, y: (Math.floor(ROWS/2) * CELL) + CELL/2,
            hp:hp, maxHp:hp, spd:0.35, 
            type:'boss', bossType:type, ai:'breaker', color:'#fff', res:['phys','chem','energy','ex'],
            angle:0, isBoss:true, phase:0
        };
        enemies.push(boss);
        addText(canvas.width/2, canvas.height/2, `WARNING: ${type} CLASS DETECTED`, "#f00", 120);
    }

    function update() {
        if(state.paused) return; // PAUSE CHECK
        if(state.lives <= 0) return;
        state.frame++;

        // --- ENEMIES ---
        for(let i=enemies.length-1; i>=0; i--) {
            let e = enemies[i];
            
            // Slow Decay
            if(e.slowed) { e.slowTimer--; if(e.slowTimer<=0) e.slowed=false; }
            let spd = e.slowed ? e.spd * 0.5 : e.spd;

            // Goal
            if(e.x > (COLS-1)*CELL) {
                state.lives -= e.isBoss ? 20 : 1;
                addText(e.x, e.y, "BREACH", "red");
                enemies.splice(i,1);
                if(e.isBoss) boss = null;
                continue;
            }

            // Move / AI
            let next = getNextMove(e);
            if(next && next.action === 'attack') {
                if(state.frame % 40 === 0) {
                    next.target.hp -= (e.isBoss ? 150 : 30);
                    addPart(next.target.x, next.target.y, '#f00', 5);
                    particles.push({type:'text', x:next.target.x, y:next.target.y-10, text:'-HP', color:'red', life:30});
                    if(next.target.hp <= 0) destroyTower(next.target);
                }
            } else if (next) {
                let tx = next.x*CELL + CELL/2;
                let ty = next.y*CELL + CELL/2;
                let ang = Math.atan2(ty - e.y, tx - e.x);
                e.vx = Math.cos(ang) * spd;
                e.vy = Math.sin(ang) * spd;
                e.angle = ang;
                e.x += e.vx; e.y += e.vy;
            }

            // Gas Damage
            gasClouds.forEach(g => {
                if(Math.hypot(g.x-e.x, g.y-e.y) < g.r) takeDamage(e, 0.2, 'chem');
            });

            // Death
            if(e.hp <= 0) {
                let rew = e.isBoss ? 1000 : (e.maxHp/4);
                state.money += Math.floor(rew);
                addText(e.x, e.y, `+$${Math.floor(rew)}`, '#ff0');
                addPart(e.x, e.y, e.color, e.isBoss?50:15);
                enemies.splice(i,1);
                if(e.isBoss) boss = null;
            }
        }

        // --- TOWERS ---
        towers.forEach(t => {
            if(t.type === 'block') return; // Wall logic
            
            // Continuous Laser Logic
            if(t.type === 'laser') {
                let target = enemies.find(e => Math.hypot(e.x-t.x, e.y-t.y) < t.rng);
                if(target) {
                    t.angle = Math.atan2(target.y-t.y, target.x-t.x);
                    takeDamage(target, t.dmg * (t.attrLevels.dmg?1.5:1), 'energy'); // High tick rate low dmg
                    if(state.frame%4===0) particles.push({type:'spark', x:target.x, y:target.y, color:t.color, life:5});
                    t.firing = true;
                    t.target = target;
                } else {
                    t.firing = false;
                }
                return;
            }

            if(t.cd > 0) t.cd--;
            else {
                let targets = enemies.filter(e => Math.hypot(e.x-t.x, e.y-t.y) < t.rng);
                if(targets.length > 0) {
                    // Priority sorting
                    targets.sort((a,b) => (b.isBoss?1000:0) + (a.hp - b.hp)); 
                    let target = targets[0];
                    t.angle = Math.atan2(target.y-t.y, target.x-t.x); // Face target

                    if(t.type === 'poison') {
                        projectiles.push({x:t.x, y:t.y, tx:target.x, ty:target.y, type:'canister', color:t.color, dmg:t.dmg, spd:6});
                        t.cd = t.rate;
                    } 
                    else if(t.type === 'missile') {
                        projectiles.push({x:t.x, y:t.y, target:target, type:'missile', color:t.color, dmg:t.dmg, spd:4, acc:0.2, aoe:50});
                        t.cd = t.rate;
                    }
                    else if(t.type === 'tesla') {
                        fireTesla(t, target, enemies);
                        t.cd = t.rate;
                    }
                    else if(t.type === 'slow') {
                        particles.push({type:'pulse', x:t.x, y:t.y, r:10, maxR:t.rng, color:t.color, life:20});
                        targets.forEach(e => {
                             e.slowed = true; e.slowTimer = 60;
                        });
                        t.cd = t.rate;
                    }
                    else {
                        // Standard Projectile (Vulcan, Nova)
                        projectiles.push({
                            x:t.x, y:t.y, target:target, type:'bullet', 
                            dmg:t.dmg, color:t.color, spd:12, aoe:t.aoe
                        });
                        t.cd = t.rate;
                        t.recoil = 5; // Visual recoil
                    }
                }
            }
            if(t.recoil > 0) t.recoil--;
        });

        // --- PROJECTILES ---
        for(let i=projectiles.length-1; i>=0; i--) {
            let p = projectiles[i];
            
            // Logic varies by type
            if(p.type === 'canister') {
                let dx = p.tx - p.x, dy = p.ty - p.y;
                let d = Math.hypot(dx,dy);
                if(d < p.spd) {
                    gasClouds.push({x:p.tx, y:p.ty, r:50, life:180, color:p.color});
                    projectiles.splice(i,1);
                } else {
                    p.x += (dx/d)*p.spd; p.y += (dy/d)*p.spd;
                    particles.push({type:'trail', x:p.x, y:p.y, color:p.color, life:10});
                }
                continue;
            }

            if(p.type === 'missile') {
                if(!p.target || p.target.hp<=0) { p.target = enemies[0]; } // Retarget if dead
                if(!p.target) { projectiles.splice(i,1); continue; }

                let ang = Math.atan2(p.target.y - p.y, p.target.x - p.x);
                let vx = Math.cos(ang) * p.spd;
                let vy = Math.sin(ang) * p.spd;
                p.x += vx; p.y += vy;
                p.spd += p.acc; // Accelerate
                particles.push({type:'smoke', x:p.x, y:p.y, life:15});

                if(Math.hypot(p.target.x-p.x, p.target.y-p.y) < p.spd) {
                     explode(p.x, p.y, p.aoe, p.dmg, 'ex');
                     projectiles.splice(i,1);
                }
                continue;
            }

            // Bullet logic
            if(!p.target || (!enemies.includes(p.target) && !p.aoe)) { projectiles.splice(i,1); continue; }
            let dx = p.target.x - p.x, dy = p.target.y - p.y;
            let d = Math.hypot(dx,dy);
            
            if(d < p.spd) {
                if(p.aoe) explode(p.x, p.y, p.aoe, p.dmg, 'ex');
                else takeDamage(p.target, p.dmg, 'phys');
                projectiles.splice(i,1);
            } else {
                p.x += (dx/d)*p.spd; p.y += (dy/d)*p.spd;
            }
        }

        // --- CLEANUP ---
        gasClouds.forEach((g,i) => { g.life--; if(g.life<=0) gasClouds.splice(i,1); });
        particles.forEach((p,i) => { p.life--; p.x+=(p.vx||0); p.y+=(p.vy||0); if(p.life<=0) particles.splice(i,1); });
        floatingText.forEach((t,i) => { t.y-=0.5; t.life--; if(t.life<=0) floatingText.splice(i,1); });

        if(state.active && enemies.length === 0) {
            state.active = false;
            state.wave++;
            state.money += 300;
        }
    }

    // --- COMBAT HELPERS ---
    function takeDamage(e, amt, type) {
        if(e.res.includes(type)) amt *= 0.25;
        e.hp -= amt;
    }

    function explode(x, y, r, dmg, type) {
        particles.push({type:'shockwave', x, y, life:15, color:'#ffaa00'});
        enemies.forEach(e => {
            if(Math.hypot(e.x-x, e.y-y) < r) takeDamage(e, dmg, type);
        });
    }

    function fireTesla(t, target, enemies) {
        let chain = [target];
        let curr = target;
        takeDamage(target, t.dmg, 'energy');
        let hops = t.attrLevels.special ? 6 : 3;
        
        for(let k=0; k<hops; k++) {
            let next = enemies.find(e => !chain.includes(e) && Math.hypot(e.x-curr.x, e.y-curr.y) < 120);
            if(next) {
                chain.push(next);
                takeDamage(next, t.dmg * 0.8, 'energy');
                curr = next;
            } else break;
        }
        particles.push({type:'bolt', chain:chain, color:t.color, life:8});
    }

    function destroyTower(t) {
        grid[t.gx][t.gy] = null;
        towers = towers.filter(tw => tw !== t);
        if(selection === t) selection = null;
        addPart(t.x, t.y, '#fff', 30);
        recalcPaths();
    }

    // --- DRAWING SYSTEM ---
    function draw(ctx) {
        // Background
        ctx.fillStyle = '#050508'; ctx.fillRect(0,0,canvas.width,canvas.height);
        
        // Grid
        ctx.strokeStyle = 'rgba(0, 255, 204, 0.03)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for(let x=0;x<=COLS;x++) { ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,canvas.height); }
        for(let y=0;y<=ROWS;y++) { ctx.moveTo(0,y*CELL); ctx.lineTo(canvas.width,y*CELL); }
        ctx.stroke();

        // Valid Path Overlay (Build Mode)
        if(buildMode) {
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            for(let x=0;x<COLS;x++) for(let y=0;y<ROWS;y++) {
                if(mapStandard[x][y].cost < 9999) ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
            }
        }

        // Layers
        gasClouds.forEach(g => {
            let grad = ctx.createRadialGradient(g.x,g.y,5,g.x,g.y,g.r);
            grad.addColorStop(0, g.color); grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI*2); ctx.fill();
        });

        towers.forEach(t => drawTower(ctx, t));
        enemies.forEach(e => drawEnemy(ctx, e));

        projectiles.forEach(p => {
            ctx.fillStyle = p.color; 
            ctx.shadowBlur = 10; ctx.shadowColor = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.aoe?4:2, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
        });

        // Particle System
        particles.forEach(p => {
            if(p.type === 'bolt') {
                ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.shadowColor=p.color; ctx.shadowBlur=15;
                ctx.beginPath();
                if(p.chain.length) ctx.moveTo(p.chain[0].x, p.chain[0].y);
                for(let i=1; i<p.chain.length; i++) ctx.lineTo(p.chain[i].x, p.chain[i].y);
                ctx.stroke(); ctx.shadowBlur=0;
            } else if (p.type === 'shockwave') {
                ctx.strokeStyle = p.color; ctx.lineWidth = 3; 
                ctx.beginPath(); ctx.arc(p.x, p.y, (15-p.life)*4, 0, Math.PI*2); ctx.stroke();
            } else if (p.type === 'text') {
                ctx.fillStyle = p.color; ctx.font = '10px monospace'; ctx.fillText(p.text, p.x, p.y);
            } else if (p.type === 'pulse') {
                ctx.strokeStyle = p.color; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(p.x, p.y, p.maxR * (1 - p.life/20), 0, Math.PI*2); ctx.stroke();
            } else {
                ctx.fillStyle = p.color; ctx.globalAlpha = p.life/15;
                ctx.fillRect(p.x, p.y, 2, 2); ctx.globalAlpha = 1;
            }
        });

        // UI Overlay
        ctx.font = 'bold 12px "Segoe UI"';
        floatingText.forEach(t => {
            ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
        });

        // Boss Health UI
        if(boss) {
            let cx = canvas.width/2;
            let barW = 600;
            ctx.fillStyle = '#200'; ctx.fillRect(cx - barW/2, 60, barW, 25);
            ctx.fillStyle = '#f00'; ctx.fillRect(cx - barW/2, 60, barW*(boss.hp/boss.maxHp), 25);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(cx - barW/2, 60, barW, 25);
            ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.font='bold 16px Courier New';
            ctx.fillText(`THREAT: ${boss.bossType} // HP: ${Math.floor(boss.hp)}`, cx, 78);
            ctx.textAlign='left';
        }
    }

    function drawTower(ctx, t) {
        ctx.save();
        ctx.translate(t.x, t.y);
        
        // Base
        ctx.fillStyle = '#111'; ctx.fillRect(-CELL/2+2, -CELL/2+2, CELL-4, CELL-4);
        ctx.strokeStyle = '#333'; ctx.strokeRect(-CELL/2+2, -CELL/2+2, CELL-4, CELL-4);
        
        // Range Indicator (if selected)
        if(selection === t) {
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(0,0,t.rng,0,Math.PI*2); ctx.stroke();
        }

        // Turret Body Rotation
        ctx.rotate(t.angle || 0);

        // Recoil Offset
        let off = t.recoil || 0;

        // Specific Draw Logic
        if(t.type === 'gatling') {
            ctx.fillStyle = t.color; ctx.fillRect(-4, -8+off, 8, 16);
            ctx.fillStyle = '#444'; ctx.fillRect(-2, -12+off, 4, 20);
        } else if(t.type === 'cannon') {
            ctx.fillStyle = '#333'; ctx.fillRect(-6, -6, 12, 12);
            ctx.fillStyle = t.color; ctx.fillRect(-4, -10+off, 8, 20);
        } else if(t.type === 'laser') {
            ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = t.color; ctx.fillRect(-2, 0, 4, t.firing ? 18 : 10);
            if(t.firing) {
                 ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(0, t.target ? Math.hypot(t.target.y-t.y, t.target.x-t.x) : 200);
                 ctx.strokeStyle = t.color; ctx.lineWidth = 3; ctx.stroke();
            }
        } else if(t.type === 'tesla') {
            let s = 1 + Math.sin(state.frame*0.5)*0.2;
            ctx.scale(s,s);
            ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(0,0,8,0,Math.PI*2); ctx.stroke();
        } else if(t.type === 'block') {
            ctx.fillStyle = '#444'; ctx.fillRect(-10,-10,20,20);
            ctx.strokeStyle = t.color; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(-10,-10); ctx.lineTo(10,10); ctx.stroke();
        } else {
            // Generic
            ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill();
        }

        ctx.restore();
        
        // HP Bar
        if(t.hp < t.maxHp) {
            ctx.fillStyle = 'red'; ctx.fillRect(t.x-10, t.y-18, 20, 3);
            ctx.fillStyle = '#0f0'; ctx.fillRect(t.x-10, t.y-18, 20*(t.hp/t.maxHp), 3);
        }
    }

    function drawEnemy(ctx, e) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);

        ctx.shadowColor = e.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = e.color;

        if(e.type === 'drone') {
            ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(-6, 5); ctx.lineTo(-6, -5); ctx.fill();
        } else if (e.type === 'walker') {
            // Legs animation
            let l = Math.sin(state.frame*0.5)*5;
            ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-5, 8+l); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-5, -8-l); ctx.stroke();
            ctx.fillRect(-6, -6, 12, 12);
        } else if (e.isBoss) {
            // Boss Visuals
            ctx.scale(1.5, 1.5);
            if(e.bossType === 'EYE') {
                ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill();
                ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.arc(4,0,5,0,Math.PI*2); ctx.fill();
            } else if (e.bossType === 'MECH') {
                 ctx.fillStyle = '#444'; ctx.fillRect(-10,-10,20,20);
                 ctx.fillStyle = e.color; ctx.fillRect(5,-5,10,10); // Gun
            } else {
                ctx.beginPath(); ctx.arc(0,0,15,0,Math.PI*2); ctx.fill();
                ctx.strokeStyle = '#fff'; ctx.strokeRect(-12,-12,24,24);
            }
        } else {
            ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
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
            // Temp block for path check
            grid[gx][gy] = {x:0}; recalcPaths();
            let valid = mapStandard[startNode.x][startNode.y].cost < 9999;
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
                addPart(newT.x, newT.y, '#fff', 20);
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
            // FIX: Safely access cost. 
            // The cost map is in TOWER_TYPES, but selection might have drifted.
            // We use selection.type to look up base cost.
            let typeDef = TOWER_TYPES[selection.type];
            if(!typeDef) return; 

            let baseCost = typeDef.cost;
            let currentLvl = selection.attrLevels[attr] || 0;
            let cost = Math.floor(baseCost * 0.5 * (currentLvl + 1));

            if(state.money >= cost) {
                state.money -= cost;
                selection.attrLevels[attr] = currentLvl + 1;
                
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
