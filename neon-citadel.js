/* NEON CITADEL - ULTIMATE EDITION */
(function(global){
  const Neon = (function(){
    
    // CONFIG: 1200 / 40 = 30 cols, 800 / 40 = 20 rows. Fits perfectly.
    const CELL = 40; 
    let COLS, ROWS;
    
    // DAMAGE TYPES: 'phys' (Physical), 'energy' (Energy), 'chem' (Chemical), 'ex' (Explosive)
    const TOWER_TYPES = {
        'gatling': { name:'VULCAN',  cost:120, color:'#00ffff', type:'phys',   dmg:8,   rng:160, rate:5,  hp:300, desc:"Rapid kinetic fire." },
        'cannon':  { name:'NOVA',    cost:350, color:'#ffaa00', type:'ex',     dmg:60,  rng:200, rate:70, hp:500, aoe:80, desc:"Explosive AoE shells." },
        'tesla':   { name:'FLUX',    cost:550, color:'#ff00ff', type:'energy', dmg:15,  rng:180, rate:25, hp:400, chain:true, desc:"Chaining energy beam." },
        'poison':  { name:'HEX',     cost:450, color:'#00ff00', type:'chem',   dmg:2,   rng:140, rate:5,  hp:400, gas:true, desc:"Dispenses corrosive gas." },
        'block':   { name:'BARRIER', cost:30,  color:'#666666', type:'none',   dmg:0,   rng:0,   rate:0,  hp:2000, desc:"Cheap routing wall." }
    };

    let canvas, ctx;
    let grid=[], towers=[], enemies=[], projectiles=[], particles=[], floatingText=[], gasClouds=[];
    
    // Flow Fields
    let mapStandard=[], mapDanger=[]; // Danger map avoids tower ranges
    
    let state = { wave:1, money:800, lives:20, active:false, frame:0 };
    let selection=null, buildMode=null, boss=null;
    let startNode, endNode;

    function init(c) {
        canvas = c; ctx = c.getContext('2d');
        COLS = Math.floor(canvas.width / CELL);
        ROWS = Math.floor(canvas.height / CELL);
        startNode = {x:0, y:Math.floor(ROWS/2)};
        endNode = {x:COLS-1, y:Math.floor(ROWS/2)};
        reset();
    }

    function reset() {
        state = { wave:1, money:800, lives:20, active:false, frame:0 };
        towers=[]; enemies=[]; projectiles=[]; particles=[]; floatingText=[]; gasClouds=[];
        grid = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(null));
        recalcPaths();
    }

    // --- AI & PATHFINDING ---

    function recalcPaths() {
        // 1. Initialize Maps
        mapStandard = createMap();
        mapDanger = createMap();

        // 2. Identify Tower Zones for Danger Map
        let dangerZone = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(0));
        towers.forEach(t => {
            if(t.type === 'block') return; // Walls aren't "dangerous", just obstacles
            let r = Math.ceil(t.rng/CELL);
            for(let xx=-r; xx<=r; xx++) {
                for(let yy=-r; yy<=r; yy++) {
                    let tx=t.gx+xx, ty=t.gy+yy;
                    if(tx>=0 && tx<COLS && ty>=0 && ty<ROWS) {
                        if((tx*CELL - t.x)**2 + (ty*CELL - t.y)**2 <= t.rng**2) {
                            dangerZone[tx][ty] += 10; // Add "weight" to dangerous tiles
                        }
                    }
                }
            }
        });

        // 3. Generate Flow Fields (Dijkstra)
        generateFlowField(mapStandard, endNode, (x,y) => grid[x][y] ? 9999 : 1);
        generateFlowField(mapDanger, endNode, (x,y) => (grid[x][y] ? 9999 : 1) + dangerZone[x][y]);
    }

    function createMap() {
        return new Array(COLS).fill(0).map(()=>new Array(ROWS).fill({cost:999999, next:null}));
    }

    function generateFlowField(map, target, weightFn) {
        let q = [];
        map[target.x][target.y] = { cost: 0, next: null };
        q.push(target);

        // Directions: Up, Down, Left, Right
        const dirs = [[0,1], [0,-1], [1,0], [-1,0]];

        while(q.length) {
            // Simple sort for priority queue behavior
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

        // Out of bounds check
        if(gx<0 || gx>=COLS || gy<0 || gy>=ROWS) return {x:COLS-1, y:Math.floor(ROWS/2)};

        // 1. Breaker AI: Attack nearest tower if blocked or close
        if(e.ai === 'breaker') {
            // Look for adjacent tower
            let dirs = [[1,0],[-1,0],[0,1],[0,-1]];
            for(let d of dirs) {
                let tx = gx+d[0], ty = gy+d[1];
                if(grid[tx]?.[ty]) return { action:'attack', target:grid[tx][ty] };
            }
        }

        // 2. Swarm AI: Wait/Circle if gathered
        if(e.ai === 'swarm' && e.swarming) {
            if(state.frame % 60 === 0 && Math.random() > 0.5) e.swarming = false; // Release swarm
            return null; // Stay put
        }

        // 3. Movement based on AI type
        let map = (e.ai === 'tactician') ? mapDanger : mapStandard;
        let cell = map[gx][gy];

        // If path blocked or invalid, default to standard map
        if(!cell || !cell.next) {
            cell = mapStandard[gx][gy];
        }
        
        // If still no path, attack a wall (failsafe)
        if((!cell || !cell.next) && grid[gx][gy]) return null;
        
        return cell ? cell.next : null;
    }

    // --- GAME LOOP ---

    function startWave() {
        if(state.active) return;
        state.active = true;
        
        let difficulty = 1 + (state.wave * 0.15);
        let budget = 200 * difficulty + (state.wave * 50);
        let queue = [];

        // Enemy Types & Costs
        const E_TYPES = {
            'scout':    { cost:15,  spd:2.5, hp:40,  ai:'std',      res:[],       color:'#0ff' }, // Fast, weak
            'grunt':    { cost:30,  spd:1.2, hp:120, ai:'std',      res:['phys'], color:'#f0f' }, // Basic
            'tank':     { cost:80,  spd:0.6, hp:500, ai:'std',      res:['ex'],   color:'#0f0' }, // Tanky
            'rogue':    { cost:60,  spd:2.0, hp:150, ai:'tactician',res:['chem'], color:'#ff0' }, // Avoids AOE
            'breaker':  { cost:100, spd:0.9, hp:400, ai:'breaker',  res:[],       color:'#f80' }, // Destroys towers
            'swarm':    { cost:20,  spd:3.0, hp:60,  ai:'swarm',    res:['energy'],color:'#aaa'}  // Fast mobs
        };

        // Composition Logic
        while(budget > 0) {
            let r = Math.random();
            let type = 'scout';
            if(state.wave > 1 && r > 0.6) type = 'grunt';
            if(state.wave > 3 && r > 0.8) type = 'swarm';
            if(state.wave > 4 && r > 0.9) type = 'rogue';
            if(state.wave > 6 && r > 0.92) type = 'tank';
            if(state.wave > 8 && r > 0.95) type = 'breaker';
            
            queue.push(type);
            budget -= E_TYPES[type].cost;
        }

        // Spawning Interval
        let spawnIndex = 0;
        let int = setInterval(() => {
            if(spawnIndex >= queue.length) {
                clearInterval(int);
                // SPAWN BOSS
                setTimeout(() => spawnBoss(), 2000);
            } else {
                spawnEnemy(queue[spawnIndex], E_TYPES[queue[spawnIndex]]);
                spawnIndex++;
            }
        }, 600 - Math.min(400, state.wave*10));
    }

    function spawnEnemy(type, def) {
        let hp = def.hp * (1 + state.wave*0.1);
        enemies.push({
            x: 0, y: (Math.floor(ROWS/2) * CELL) + CELL/2,
            ...def, maxHp:hp, hp:hp, type:type,
            angle:0, vx:0, vy:0, swarming: (type==='swarm')
        });
    }

    function spawnBoss() {
        let hp = 3000 * (1 + state.wave*0.25);
        boss = {
            x: 0, y: (Math.floor(ROWS/2) * CELL) + CELL/2,
            hp: hp, maxHp: hp, spd: 0.4, 
            type:'boss', ai:'breaker', color:'#fff', res:['phys','chem'],
            angle: 0, isBoss: true
        };
        enemies.push(boss);
        addText(200, 400, "WARNING: BOSS APPROACHING", "red");
    }

    function update() {
        if(state.lives <= 0) return;
        state.frame++;

        // --- Enemies ---
        for(let i=enemies.length-1; i>=0; i--) {
            let e = enemies[i];
            
            // Check Reach End
            if(e.x > (COLS-1)*CELL) {
                state.lives -= e.isBoss ? 20 : 1;
                addText(e.x, e.y, "BREACH", "red");
                enemies.splice(i,1);
                if(e.isBoss) boss = null;
                continue;
            }

            // Movement & AI
            let next = getNextMove(e);
            
            if(next && next.action === 'attack') {
                // Breaker Logic
                if(state.frame % 60 === 0) {
                    next.target.hp -= 50;
                    addPart(next.target.x, next.target.y, '#f00', 5);
                    if(next.target.hp <= 0) destroyTower(next.target);
                }
            } else if (next) {
                let tx = next.x*CELL + CELL/2;
                let ty = next.y*CELL + CELL/2;
                let dx = tx - e.x, dy = ty - e.y;
                let dist = Math.hypot(dx,dy);
                let ang = Math.atan2(dy, dx);
                
                e.vx = Math.cos(ang) * e.spd;
                e.vy = Math.sin(ang) * e.spd;
                e.angle = ang;
                
                e.x += e.vx;
                e.y += e.vy;
            }

            // Gas Damage
            gasClouds.forEach(g => {
                if(Math.hypot(g.x-e.x, g.y-e.y) < g.r) {
                   takeDamage(e, 0.5, 'chem'); // DoT
                }
            });

            if(e.hp <= 0) {
                let rew = e.isBoss ? 500 : (e.maxHp / 5);
                state.money += Math.floor(rew);
                addText(e.x, e.y, `+$${Math.floor(rew)}`, '#ff0');
                addPart(e.x, e.y, e.color, 20);
                enemies.splice(i,1);
                if(e.isBoss) boss = null;
            }
        }

        // --- Towers ---
        towers.forEach(t => {
            if(t.type === 'block') return;
            if(t.cd > 0) t.cd--;
            else {
                // Find Target
                let targets = enemies.filter(e => Math.hypot(e.x-t.x, e.y-t.y) < t.rng);
                if(targets.length > 0) {
                    // Priority: Boss -> Low HP -> Closest
                    targets.sort((a,b) => (b.isBoss?1000:0) + (a.hp - b.hp)); 
                    let target = targets[0];

                    if(t.type === 'poison') {
                        // Poison shoots a generic cloud location
                        projectiles.push({x:t.x, y:t.y, tx:target.x, ty:target.y, type:'canister', color:'#0f0', dmg:t.dmg, spd:6});
                        t.cd = t.rate;
                    } 
                    else if(t.type === 'tesla') {
                        fireTesla(t, target, enemies);
                        t.cd = t.rate;
                    } 
                    else {
                        // Standard Projectile
                        projectiles.push({
                            x:t.x, y:t.y, target:target, type:t.type, 
                            dmg:t.dmg, color:t.color, spd:12, aoe:t.aoe
                        });
                        t.cd = t.rate;
                    }
                }
            }
        });

        // --- Projectiles ---
        for(let i=projectiles.length-1; i>=0; i--) {
            let p = projectiles[i];
            
            if(p.type === 'canister') {
                // Moves to fixed location
                let dx = p.tx - p.x, dy = p.ty - p.y;
                let d = Math.hypot(dx,dy);
                if(d < p.spd) {
                    gasClouds.push({x:p.tx, y:p.ty, r:60, life:180}); // 3 sec cloud
                    projectiles.splice(i,1);
                } else {
                    p.x += (dx/d)*p.spd; p.y += (dy/d)*p.spd;
                }
                continue;
            }

            if(!p.target || (!enemies.includes(p.target) && !p.aoe)) { projectiles.splice(i,1); continue; }
            
            let dx = p.target.x - p.x, dy = p.target.y - p.y;
            let d = Math.hypot(dx,dy);
            
            if(d < p.spd) {
                if(p.aoe) {
                    // Explosion
                    particles.push({x:p.x, y:p.y, type:'shockwave', life:15, color:p.color});
                    enemies.forEach(e => {
                        if(Math.hypot(e.x-p.target.x, e.y-p.target.y) < p.aoe) takeDamage(e, p.dmg, 'ex');
                    });
                } else {
                    takeDamage(p.target, p.dmg, 'phys');
                }
                projectiles.splice(i,1);
            } else {
                p.x += (dx/d)*p.spd; p.y += (dy/d)*p.spd;
            }
        }

        // --- Particles & Gas ---
        gasClouds.forEach((g,i) => { g.life--; if(g.life<=0) gasClouds.splice(i,1); });
        particles.forEach((p,i) => { p.life--; p.x+=p.vx||0; p.y+=p.vy||0; if(p.life<=0) particles.splice(i,1); });
        floatingText.forEach((t,i) => { t.y-=0.5; t.life--; if(t.life<=0) floatingText.splice(i,1); });

        // Wave End Check
        if(state.active && enemies.length === 0) {
            state.active = false;
            state.wave++;
            state.money += 200; // Wave Clear Bonus
        }
    }

    function takeDamage(e, amt, type) {
        if(e.res.includes(type)) amt *= 0.25; // Resistance
        e.hp -= amt;
    }

    function fireTesla(t, target, enemies) {
        let chain = [target];
        let curr = target;
        takeDamage(target, t.dmg, 'energy');
        
        let hops = t.attrLevels && t.attrLevels.special ? 5 : 3;
        for(let k=0; k<hops; k++) {
            let next = enemies.find(e => !chain.includes(e) && Math.hypot(e.x-curr.x, e.y-curr.y) < 120);
            if(next) {
                chain.push(next);
                takeDamage(next, t.dmg * 0.7, 'energy');
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

    // --- DRAWING ---

    function draw(ctx) {
        // BG
        ctx.fillStyle = '#050508'; ctx.fillRect(0,0,canvas.width,canvas.height);
        
        // Grid Lines (Subtle)
        ctx.strokeStyle = 'rgba(0, 255, 204, 0.05)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for(let x=0;x<=COLS;x++) { ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,canvas.height); }
        for(let y=0;y<=ROWS;y++) { ctx.moveTo(0,y*CELL); ctx.lineTo(canvas.width,y*CELL); }
        ctx.stroke();

        // Build Mode Preview
        if(buildMode) {
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            for(let x=0;x<COLS;x++) for(let y=0;y<ROWS;y++) {
                if(mapStandard[x][y].cost < 9999) ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
            }
        }

        // Gas Clouds
        gasClouds.forEach(g => {
            ctx.fillStyle = 'rgba(0,255,0,0.2)';
            ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI*2); ctx.fill();
        });

        // Towers
        towers.forEach(t => drawTower(ctx, t));

        // Enemies
        enemies.forEach(e => drawEnemy(ctx, e));

        // Projectiles
        projectiles.forEach(p => {
            ctx.fillStyle = p.color; ctx.shadowBlur = 10; ctx.shadowColor = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.aoe?5:3, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
        });

        // Particles
        particles.forEach(p => {
            if(p.type === 'bolt') {
                ctx.strokeStyle = p.color; ctx.lineWidth = 2; ctx.shadowColor=p.color; ctx.shadowBlur=10;
                ctx.beginPath();
                if(p.chain.length>0) ctx.moveTo(p.chain[0].x, p.chain[0].y);
                for(let i=1; i<p.chain.length; i++) ctx.lineTo(p.chain[i].x, p.chain[i].y);
                ctx.stroke(); ctx.shadowBlur=0;
            } else if (p.type === 'shockwave') {
                ctx.strokeStyle = p.color; ctx.lineWidth = 3; 
                ctx.beginPath(); ctx.arc(p.x, p.y, (15-p.life)*4, 0, Math.PI*2); ctx.stroke();
            } else {
                ctx.fillStyle = p.color; ctx.globalAlpha = p.life/20;
                ctx.fillRect(p.x, p.y, 3, 3); ctx.globalAlpha = 1;
            }
        });

        // UI Text
        ctx.font = 'bold 14px "Segoe UI"';
        floatingText.forEach(t => {
            ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
        });

        // Boss Health Bar
        if(boss) {
            let cx = canvas.width/2;
            ctx.fillStyle = '#300'; ctx.fillRect(cx-250, 50, 500, 20);
            ctx.fillStyle = '#f00'; ctx.fillRect(cx-250, 50, 500*(boss.hp/boss.maxHp), 20);
            ctx.strokeStyle = '#fff'; ctx.strokeRect(cx-250, 50, 500, 20);
            ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.fillText("BOSS THREAT LEVEL: EXTREME", cx, 45); ctx.textAlign='left';
        }
    }

    function drawTower(ctx, t) {
        let x = t.x, y = t.y;
        ctx.save();
        ctx.translate(x, y);

        // Base
        ctx.fillStyle = '#222'; ctx.fillRect(-18,-18,36,36);
        ctx.strokeStyle = t.color; ctx.lineWidth = 2; ctx.strokeRect(-16,-16,32,32);
        
        // HP Bar
        if(t.hp < t.maxHp) {
            ctx.fillStyle = 'red'; ctx.fillRect(-16, -22, 32, 4);
            ctx.fillStyle = '#0f0'; ctx.fillRect(-16, -22, 32*(t.hp/t.maxHp), 4);
        }

        // Selection Ring
        if(selection === t) {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(0,0,t.rng,0,Math.PI*2); ctx.stroke();
        }

        // Turret visuals
        if(t.type === 'gatling') {
            // Rotating double barrel
            ctx.rotate(state.frame * 0.1);
            ctx.fillStyle = '#444'; ctx.fillRect(-6, -10, 12, 20);
            ctx.fillStyle = t.color; ctx.fillRect(-2, -15, 4, 10);
        } else if(t.type === 'cannon') {
            // Heavy square barrel
            ctx.rotate(Math.sin(state.frame*0.05)*0.5);
            ctx.fillStyle = t.color; ctx.fillRect(-8, -12, 16, 24);
        } else if(t.type === 'tesla') {
            // Pulsing Core
            let s = 1 + Math.sin(state.frame*0.5)*0.2;
            ctx.scale(s,s);
            ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill();
        } else if(t.type === 'poison') {
            // Vent
            ctx.fillStyle = '#242'; ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(Math.cos(state.frame*0.2)*6, Math.sin(state.frame*0.2)*6, 3, 0, Math.PI*2); ctx.fill();
        } else if(t.type === 'block') {
             ctx.fillStyle = '#555'; ctx.fillRect(-10,-10,20,20);
             ctx.strokeStyle = '#888'; ctx.beginPath(); ctx.moveTo(-10,-10); ctx.lineTo(10,10); ctx.moveTo(10,-10); ctx.lineTo(-10,10); ctx.stroke();
        }

        ctx.restore();
    }

    function drawEnemy(ctx, e) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);

        ctx.shadowColor = e.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = e.color;

        if(e.type === 'scout') {
            // Arrow
            ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(-8, 6); ctx.lineTo(-4, 0); ctx.lineTo(-8, -6); ctx.fill();
        } else if (e.type === 'tank') {
            // Heavy Square
            ctx.fillRect(-12,-12, 24, 24);
            ctx.fillStyle = '#000'; ctx.fillRect(-5,-5,10,10);
        } else if (e.type === 'rogue') {
            // Stealth Jet
            ctx.beginPath(); ctx.moveTo(12,0); ctx.lineTo(-6,8); ctx.lineTo(-2,0); ctx.lineTo(-6,-8); ctx.fill();
        } else if (e.type === 'breaker') {
            // Spiked Ram
            ctx.beginPath(); ctx.moveTo(14,0); ctx.lineTo(0, 10); ctx.lineTo(-10, 5); ctx.lineTo(-10, -5); ctx.lineTo(0, -10); ctx.fill();
        } else if (e.isBoss) {
            // Complex Boss Shape
            ctx.rotate(state.frame * 0.05);
            ctx.beginPath(); ctx.arc(0,0,15,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle = e.color; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.arc(0,0,25,0,Math.PI*2); ctx.stroke(); // Shield
            ctx.fillRect(20, -5, 10, 10); ctx.fillRect(-30, -5, 10, 10);
            ctx.fillRect(-5, 20, 10, 10); ctx.fillRect(-5, -30, 10, 10);
        } else {
            // Grunt/Swarm (Triangle)
            ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(-6, 5); ctx.lineTo(-6, -5); ctx.fill();
        }

        ctx.shadowBlur = 0;
        ctx.restore();
    }

    // --- INTERACTION ---

    function click(x, y) {
        let gx = Math.floor(x/CELL);
        let gy = Math.floor(y/CELL);
        if(gx<0||gx>=COLS||gy<0||gy>=ROWS) return;

        let t = grid[gx][gy];
        if(t) { selection = t; buildMode = null; return; }

        if(buildMode) {
            let def = TOWER_TYPES[buildMode];
            // Check if path is valid before building
            // Temporarily place tower
            grid[gx][gy] = {x:0}; 
            recalcPaths();
            let valid = mapStandard[startNode.x][startNode.y].cost < 9999;
            grid[gx][gy] = null; // Remove temp

            if(!valid) {
                addText(x, y, "PATH BLOCKED", "red");
                recalcPaths();
                return;
            }

            if(state.money >= def.cost) {
                state.money -= def.cost;
                let newT = {
                    gx, gy, x:gx*CELL+CELL/2, y:gy*CELL+CELL/2,
                    ...def, maxHp:def.hp, hp:def.hp, cd:0, 
                    attrLevels:{dmg:0,rng:0,rate:0}
                };
                grid[gx][gy] = newT;
                towers.push(newT);
                addPart(newT.x, newT.y, '#fff', 20);
                recalcPaths();
            } else {
                addText(x, y, "INSUFFICIENT FUNDS", "red");
            }
        }
        selection = null;
    }

    function addPart(x,y,c,n) { for(let i=0;i<n;i++) particles.push({x,y,color:c,vx:Math.random()*4-2,vy:Math.random()*4-2,life:10+Math.random()*15}); }
    function addText(x,y,t,c) { floatingText.push({x,y,text:t,color:c,life:60}); }

    return {
        init, update, draw, click, startWave, 
        setBuild: (k)=>{buildMode=k; selection=null;},
        deselect: ()=>{selection=null; buildMode=null;},
        
        upgrade: (attr) => {
            if(!selection) return;
            let baseCost = TOWER_TYPES[selection.type].cost;
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
            if(selection) { 
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
