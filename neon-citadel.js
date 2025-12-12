/* NEON CITADEL - V4 (CHAOS ENGINE) */
(function(global){
  const Neon = (function(){
    
    // CONFIG: 1200x800 Canvas / 40px Cell
    const CELL = 40; 
    let COLS, ROWS;
    
    // TOWER CONFIGURATION
    const TOWER_TYPES = {
        'gatling': { 
            name:'VULCAN', cost:150, color:'#00ffff', type:'phys', 
            dmg:8, rng:160, rate:5, hp:400, 
            desc:"High ROF kinetic rounds. Shreds light armor." 
        },
        'lance': { 
            name:'LANCE', cost:500, color:'#ff00aa', type:'energy', 
            dmg:6, rng:200, rate:0, hp:350, beam:true, 
            desc:"Concentrated plasma beam. Melts targets." 
        },
        'cannon': { 
            name:'NOVA', cost:400, color:'#ffaa00', type:'ex', 
            dmg:80, rng:200, rate:60, hp:600, aoe:90, 
            desc:"Heavy explosive ordnance. Massive area damage." 
        },
        'poison': { 
            name:'VENOM', cost:450, color:'#00ff00', type:'chem', 
            dmg:8, rng:150, rate:10, hp:500, gas:true, 
            desc:"Corrosive nanobots. Ignores shields." 
        },
        'tesla': { 
            name:'STORM', cost:650, color:'#ffff00', type:'energy', 
            dmg:40, rng:160, rate:40, hp:450, chain:true, 
            desc:"Generates high-voltage lightning arcs." 
        },
        'laser': { 
            name:'PHASE', cost:1000, color:'#d000ff', type:'energy', 
            dmg:18, rng:280, rate:0, hp:800, beam:true, 
            desc:"Capital-class beam weapon. Obliterates armor." 
        },
        'missile': { 
            name:'HYDRA', cost:900, color:'#00ff88', type:'ex', 
            dmg:200, rng:350, rate:80, hp:500, missile:true, 
            desc:"Long-range smart missiles." 
        },
        'block': { 
            name:'BARRIER', cost:25, color:'#444', type:'none', 
            dmg:0, rng:0, rate:0, hp:2500, 
            desc:"Heavy plasteel routing wall." 
        }
    };

    // GAME STATE
    let canvas, ctx;
    let grid=[], towers=[], enemies=[], projectiles=[], particles=[], floatingText=[], gasClouds=[];
    let mapStandard=[], mapDanger=[];
    // Difficulty increased: Lower starting money, harder waves
    let state = { wave:1, money:650, lives:50, active:false, frame:0, paused:false, shake:0 };
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
        state = { wave:1, money:650, lives:50, active:false, frame:0, paused:false, shake:0 };
        towers=[]; enemies=[]; projectiles=[]; particles=[]; floatingText=[]; gasClouds=[];
        grid = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(null));
        recalcPaths();
    }

    // --- PATHFINDING ---
    function recalcPaths() {
        mapStandard = createMap();
        mapDanger = createMap();

        // Tactician Weight Map
        let dangerWeights = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(0));
        towers.forEach(t => {
            if(t.type === 'block') return;
            let r = Math.ceil(t.rng/CELL);
            for(let xx=-r; xx<=r; xx++) {
                for(let yy=-r; yy<=r; yy++) {
                    let tx=t.gx+xx, ty=t.gy+yy;
                    if(tx>=0 && tx<COLS && ty>=0 && ty<ROWS) {
                        if((tx*CELL - t.x)**2 + (ty*CELL - t.y)**2 <= t.rng**2) {
                            dangerWeights[tx][ty] += 20; // Higher aversion
                        }
                    }
                }
            }
        });

        generateFlowField(mapStandard, endNode, (x,y) => grid[x][y] ? 99999 : 1);
        generateFlowField(mapDanger, endNode, (x,y) => (grid[x][y] ? 99999 : 1) + dangerWeights[x][y]);
    }

    function createMap() {
        return new Array(COLS).fill(0).map(()=>new Array(ROWS).fill({cost:999999, next:null}));
    }

    function generateFlowField(map, target, weightFn) {
        let q = [];
        map[target.x][target.y] = { cost: 0, next: null };
        q.push(target);
        const dirs = [[0,1], [0,-1], [1,0], [-1,0]]; 

        while(q.length) {
            q.sort((a,b) => map[a.x][a.y].cost - map[b.x][b.y].cost);
            let u = q.shift();
            
            dirs.forEach(d => {
                let nx = u.x + d[0], ny = u.y + d[1];
                if(nx>=0 && nx<COLS && ny>=0 && ny<ROWS) {
                    let w = weightFn(nx, ny);
                    let newCost = map[u.x][u.y].cost + w;
                    if(newCost < map[nx][ny].cost && w < 90000) {
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

        // Breaker AI: Attacks towers if near
        if(e.ai === 'breaker') {
            let nearby = towers.find(t => Math.hypot(t.x - e.x, t.y - e.y) < CELL * 1.5);
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
        
        // HARDER SCALING: 35% HP increase per wave instead of 15%
        let diffMult = 1 + (state.wave * 0.35); 
        let budget = 200 * diffMult + (state.wave * 100);
        let queue = [];

        const E_DEFS = {
            'drone':   { cost:15, hp:50,  spd:3.0, color:'#0ff', ai:'std' },
            'walker':  { cost:35, hp:180, spd:1.5, color:'#f0f', ai:'std', res:['phys'] },
            'heavy':   { cost:80, hp:600, spd:0.7, color:'#0f0', ai:'std', res:['ex'] },
            'ninja':   { cost:60, hp:200, spd:2.5, color:'#ff0', ai:'tactician', res:['chem'] },
            'ram':     { cost:90, hp:500, spd:1.2, color:'#f80', ai:'breaker', res:[] },
            'wraith':  { cost:150, hp:300, spd:3.5, color:'#fff', ai:'std', res:['energy'] } // Fast
        };

        // Procedural Wave Composition
        while(budget > 0) {
            let options = ['drone'];
            if(state.wave > 1) options.push('walker');
            if(state.wave > 3) options.push('ram');
            if(state.wave > 4) options.push('ninja');
            if(state.wave > 6) options.push('heavy');
            if(state.wave > 8) options.push('wraith');
            
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
                if(state.wave % 5 === 0) setTimeout(spawnBoss, 3000);
            } else {
                spawnEnemy(queue[spawnIdx]);
                spawnIdx++;
            }
        // Spawn faster as waves progress
        }, Math.max(100, 500 - state.wave*20));
    }

    function spawnEnemy(def) {
        // HP Scaling
        let hp = def.hp * (1 + state.wave*0.3);
        enemies.push({
            x: 0, y: (Math.floor(ROWS/2) * CELL) + CELL/2,
            hp:hp, maxHp:hp, 
            spd:def.spd, color:def.color, type:def.type, ai:def.ai, res:def.res||[],
            angle:0, vx:0, vy:0, id:Math.random(), state: 'move', attackCooldown: 0
        });
    }

    function spawnBoss() {
        // BOSS IS NOW A TANK
        let hp = 15000 * Math.pow(1.5, state.wave/5);
        boss = {
            x: 0, y: (Math.floor(ROWS/2) * CELL) + CELL/2,
            hp:hp, maxHp:hp, spd:0.45, 
            type:'boss', bossType:'OMEGA', ai:'breaker', color:'#fff', res:['phys','chem','energy','ex'],
            angle:0, isBoss:true, state:'move', frame:0
        };
        enemies.push(boss);
        state.shake = 30; // Entrance Shake
        addText(canvas.width/2, canvas.height/2, `ALERT: OMEGA CLASS DETECTED`, "#f00", 180);
    }

    function update() {
        if(state.paused || state.lives <= 0) return;
        state.frame++;
        if(state.shake > 0) state.shake--;

        // --- ENEMIES ---
        for(let i=enemies.length-1; i>=0; i--) {
            let e = enemies[i];
            
            if(e.isBoss) e.frame++;

            if(e.x > canvas.width) {
                state.lives -= e.isBoss ? 50 : 1;
                state.shake = 20;
                enemies.splice(i,1);
                if(e.isBoss) boss = null;
                continue;
            }

            let next = getNextMove(e);

            if(next && next.action === 'attack') {
                e.state = 'attack';
                if(state.frame % 20 === 0) {
                    e.attackAnim = 5; 
                    // Boss deals massive damage to towers
                    next.target.hp -= (e.isBoss ? 500 : 60);
                    addPart(next.target.x, next.target.y, '#f00', 5);
                    particles.push({type:'text', x:next.target.x, y:next.target.y-10, text:'CRIT', color:'red', life:20});
                    
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
                let rew = e.isBoss ? 2500 : (e.maxHp/5);
                state.money += Math.floor(rew);
                addText(e.x, e.y, `+$${Math.floor(rew)}`, '#ff0');
                // Explosion particles
                for(let k=0; k<10; k++) particles.push({type:'spark', x:e.x, y:e.y, color:e.color, life:20, vx:Math.random()*10-5, vy:Math.random()*10-5});
                enemies.splice(i,1);
                if(e.isBoss) { boss = null; state.shake = 50; }
            }
            if(e.attackAnim > 0) e.attackAnim--;
        }

        // --- TOWERS ---
        towers.forEach(t => {
            if(t.type === 'block') return;

            // CONTINUOUS BEAMS (Lance/Phase)
            if(t.beam) {
                let target = enemies.find(e => Math.hypot(e.x-t.x, e.y-t.y) < t.rng);
                if(target) {
                    t.angle = Math.atan2(target.y-t.y, target.x-t.x);
                    takeDamage(target, t.dmg, t.type); 
                    // Particle emission at hit point
                    if(state.frame%2===0) particles.push({type:'spark', x:target.x, y:target.y, color:t.color, life:10, vx:Math.random()*4-2, vy:Math.random()*4-2});
                    t.firing = true; t.target = target;
                } else {
                    t.firing = false;
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

                    if(t.type === 'poison') {
                        projectiles.push({x:t.x, y:t.y, tx:target.x, ty:target.y, type:'canister', color:t.color, dmg:t.dmg, spd:6});
                    } 
                    else if(t.type === 'missile') {
                        projectiles.push({x:t.x, y:t.y, target:target, type:'missile', color:t.color, dmg:t.dmg, spd:4, acc:0.3, aoe:80});
                    }
                    else if(t.type === 'tesla') {
                        fireTesla(t, target, enemies);
                    }
                    else {
                        // Plasma Bolt
                        projectiles.push({
                            x:t.x, y:t.y, target:target, type:'plasma', 
                            dmg:t.dmg, color:t.color, spd:16, aoe:t.aoe,
                            vx: Math.cos(t.angle)*16, vy: Math.sin(t.angle)*16
                        });
                        t.muzzle = 5; 
                    }
                    t.cd = t.rate;
                    t.recoil = 8;
                }
            }
            if(t.recoil > 0) t.recoil--;
            if(t.muzzle > 0) t.muzzle--;
        });

        // --- PROJECTILES ---
        for(let i=projectiles.length-1; i>=0; i--) {
            let p = projectiles[i];
            
            if(p.type === 'canister') {
                let dx = p.tx - p.x, dy = p.ty - p.y;
                if(Math.hypot(dx,dy) < p.spd) {
                    gasClouds.push({x:p.tx, y:p.ty, r:60, life:200, color:p.color});
                    projectiles.splice(i,1);
                } else {
                    let ang = Math.atan2(dy,dx);
                    p.x += Math.cos(ang)*p.spd; p.y += Math.sin(ang)*p.spd;
                    particles.push({type:'trail', x:p.x, y:p.y, color:p.color, life:10});
                }
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
                particles.push({type:'smoke', x:p.x, y:p.y, life:10});

                if(Math.hypot(p.target.x-p.x, p.target.y-p.y) < p.spd) {
                     explode(p.x, p.y, p.aoe, p.dmg, 'ex');
                     projectiles.splice(i,1);
                }
                continue;
            }

            if(p.type === 'plasma') {
                p.x += p.vx; p.y += p.vy;
                // Trail
                particles.push({type:'spark', x:p.x, y:p.y, color:p.color, life:5, vx:0, vy:0});

                let hit = enemies.find(e => Math.hypot(e.x-p.x, e.y-p.y) < 20);
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

        gasClouds.forEach((g,i) => { g.life--; if(g.life<=0) gasClouds.splice(i,1); });
        particles.forEach((p,i) => { p.life--; p.x+=(p.vx||0); p.y+=(p.vy||0); if(p.life<=0) particles.splice(i,1); });
        floatingText.forEach((t,i) => { t.y-=0.5; t.life--; if(t.life<=0) floatingText.splice(i,1); });

        if(state.active && enemies.length === 0) {
            state.active = false;
            state.wave++;
            state.money += 400;
        }
    }

    // --- HELPERS ---
    function takeDamage(e, amt, type) {
        if(e.res.includes(type)) amt *= 0.25;
        e.hp -= amt;
    }

    function explode(x, y, r, dmg, type) {
        state.shake = 5;
        particles.push({type:'shockwave', x, y, life:20, color:'#ffaa00'});
        enemies.forEach(e => {
            if(Math.hypot(e.x-x, e.y-y) < r) takeDamage(e, dmg, type);
        });
    }

    function fireTesla(t, target, enemies) {
        let chain = [target];
        let curr = target;
        takeDamage(target, t.dmg, 'energy');
        let hops = t.attrLevels.special ? 7 : 4;
        for(let k=0; k<hops; k++) {
            let next = enemies.find(e => !chain.includes(e) && Math.hypot(e.x-curr.x, e.y-curr.y) < 140);
            if(next) {
                chain.push(next);
                takeDamage(next, t.dmg * 0.85, 'energy');
                curr = next;
            } else break;
        }
        // Lightning Effect
        particles.push({type:'bolt', chain:chain, color:t.color, life:8});
    }

    function destroyTower(t) {
        grid[t.gx][t.gy] = null;
        towers = towers.filter(tw => tw !== t);
        if(selection === t) selection = null;
        explode(t.x, t.y, 60, 0, 'none'); // Visual explosion
        recalcPaths();
    }

    // --- DRAWING ---
    function draw(ctx) {
        ctx.save();
        
        // SCREEN SHAKE
        if(state.shake > 0) {
            let dx = (Math.random()-0.5) * state.shake;
            let dy = (Math.random()-0.5) * state.shake;
            ctx.translate(dx, dy);
        }

        ctx.fillStyle = '#020205'; ctx.fillRect(0,0,canvas.width,canvas.height);
        
        // Subtle Grid (Logic requires it, but visuals can hide it)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)'; ctx.lineWidth = 1;
        ctx.beginPath();
        for(let x=0;x<=COLS;x++) { ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,canvas.height); }
        for(let y=0;y<=ROWS;y++) { ctx.moveTo(0,y*CELL); ctx.lineTo(canvas.width,y*CELL); }
        ctx.stroke();

        if(buildMode) {
            ctx.fillStyle = 'rgba(0, 255, 200, 0.05)';
            for(let x=0;x<COLS;x++) for(let y=0;y<ROWS;y++) {
                if(mapStandard[x][y].cost < 99999) ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
            }
        }

        gasClouds.forEach(g => {
            let grad = ctx.createRadialGradient(g.x,g.y,10,g.x,g.y,g.r);
            grad.addColorStop(0, g.color); grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI*2); ctx.fill();
        });

        towers.forEach(t => drawTower(ctx, t));
        enemies.forEach(e => drawEnemy(ctx, e));

        projectiles.forEach(p => {
            ctx.shadowBlur = 15; ctx.shadowColor = p.color;
            if(p.type === 'plasma') {
                // Glowing Bolt
                let grad = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,6);
                grad.addColorStop(0, '#fff'); grad.addColorStop(1, p.color);
                ctx.fillStyle = grad;
                ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI*2); ctx.fill();
            } else {
                ctx.fillStyle = p.color; 
                ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
            }
            ctx.shadowBlur = 0;
        });

        particles.forEach(p => {
            if(p.type === 'bolt') {
                drawLightning(ctx, p.chain, p.color);
            } else if (p.type === 'shockwave') {
                ctx.strokeStyle = p.color; ctx.lineWidth = 4; 
                ctx.beginPath(); ctx.arc(p.x, p.y, (20-p.life)*5, 0, Math.PI*2); ctx.stroke();
            } else if (p.type === 'text') {
                ctx.fillStyle = p.color; ctx.font = 'bold 14px monospace'; ctx.fillText(p.text, p.x, p.y);
            } else if (p.type === 'burst') {
                ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 10 - p.life, 0, Math.PI*2); ctx.fill();
            } else {
                ctx.fillStyle = p.color; ctx.globalAlpha = p.life/15;
                ctx.fillRect(p.x, p.y, 3, 3); ctx.globalAlpha = 1;
            }
        });

        ctx.restore(); // End Shake

        ctx.font = 'bold 12px "Segoe UI"';
        floatingText.forEach(t => {
            ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
        });

        if(boss) {
            let cx = canvas.width/2;
            let barW = 800;
            ctx.fillStyle = '#200'; ctx.fillRect(cx - barW/2, 60, barW, 30);
            ctx.fillStyle = '#f00'; ctx.fillRect(cx - barW/2, 60, barW*(boss.hp/boss.maxHp), 30);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(cx - barW/2, 60, barW, 30);
            ctx.fillStyle = '#fff'; ctx.textAlign='center'; ctx.font='bold 20px Courier New';
            ctx.fillText(`THREAT LEVEL: OMEGA // HP: ${Math.floor(boss.hp)}`, cx, 82);
            ctx.textAlign='left';
        }
    }

    // --- VISUAL FX ---
    function drawLightning(ctx, chain, color) {
        if(chain.length < 2) return;
        ctx.strokeStyle = color; ctx.lineWidth = 2; 
        ctx.shadowColor = color; ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(chain[0].x, chain[0].y);
        
        for(let i=1; i<chain.length; i++) {
            let start = chain[i-1];
            let end = chain[i];
            let dist = Math.hypot(end.x-start.x, end.y-start.y);
            let steps = dist / 10;
            
            // Recursive Jagger
            let currX = start.x, currY = start.y;
            for(let j=1; j<steps; j++) {
                let t = j/steps;
                let nx = start.x + (end.x - start.x)*t;
                let ny = start.y + (end.y - start.y)*t;
                // Jitter
                nx += (Math.random()-0.5) * 15;
                ny += (Math.random()-0.5) * 15;
                ctx.lineTo(nx, ny);
            }
            ctx.lineTo(end.x, end.y);
        }
        ctx.stroke(); ctx.shadowBlur = 0;
    }

    function drawTower(ctx, t) {
        ctx.save();
        ctx.translate(t.x, t.y);
        
        // Base
        ctx.fillStyle = '#0a0a0a'; ctx.fillRect(-CELL/2+2, -CELL/2+2, CELL-4, CELL-4);
        ctx.strokeStyle = t.color; ctx.lineWidth=1; ctx.strokeRect(-CELL/2+2, -CELL/2+2, CELL-4, CELL-4);
        
        if(selection === t) {
            ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(0,0,t.rng,0,Math.PI*2); ctx.stroke();
        }

        ctx.rotate(t.angle || 0);
        let off = t.recoil || 0;

        if(t.type === 'gatling') {
            ctx.fillStyle = t.color; ctx.fillRect(-5, -8+off, 10, 18);
            if(t.muzzle) { ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0, 15, 8, 0, Math.PI*2); ctx.fill(); }
        } else if(t.beam) {
            // BEAM EMITTER
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = t.color; ctx.fillRect(-4, 0, 8, 14);
            if(t.firing) {
                 let dist = t.target ? Math.hypot(t.target.y-t.y, t.target.x-t.x) : 200;
                 // Pulsing Beam
                 let width = 3 + Math.sin(state.frame)*1.5;
                 ctx.shadowBlur = 20; ctx.shadowColor = t.color;
                 ctx.strokeStyle = t.color; ctx.lineWidth = width*2;
                 ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(dist, 0); ctx.stroke();
                 // Core
                 ctx.shadowBlur = 0; ctx.strokeStyle = '#fff'; ctx.lineWidth = width;
                 ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(dist, 0); ctx.stroke();
            }
        } else if(t.type === 'block') {
            ctx.fillStyle = '#222'; ctx.fillRect(-14,-14,28,28);
            ctx.strokeStyle = '#666'; ctx.strokeRect(-10,-10,20,20);
            ctx.beginPath(); ctx.moveTo(-14,-14); ctx.lineTo(14,14); ctx.stroke();
        } else {
            ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(0,0,9,0,Math.PI*2); ctx.fill();
            if(t.muzzle) { ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(12, 0, 8, 0, Math.PI*2); ctx.fill(); }
        }

        ctx.restore();
        
        if(t.hp < t.maxHp) {
            ctx.fillStyle = 'red'; ctx.fillRect(t.x-10, t.y-18, 20, 3);
            ctx.fillStyle = '#0f0'; ctx.fillRect(t.x-10, t.y-18, 20*(t.hp/t.maxHp), 3);
        }
    }

    function drawEnemy(ctx, e) {
        ctx.save();
        ctx.translate(e.x, e.y);
        ctx.rotate(e.angle);
        
        if(e.attackAnim) ctx.translate(Math.random()*4-2, 0);

        ctx.shadowColor = e.color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = e.color;

        if(e.isBoss) {
            // GIANT BOSS VISUAL
            ctx.scale(3, 3);
            // Core
            ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0,0,15,0,Math.PI*2); ctx.fill();
            // Rotating Shield
            ctx.save();
            ctx.rotate(state.frame * 0.1);
            ctx.strokeStyle = e.color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(0,0,20,0,Math.PI*1.5); ctx.stroke();
            ctx.restore();
            // Eye
            ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.arc(5,0,6,0,Math.PI*2); ctx.fill();
        } 
        else if(e.type === 'ram') {
            ctx.beginPath(); ctx.moveTo(15,0); ctx.lineTo(-8, 12); ctx.lineTo(-8, -12); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.fillRect(10, -6, 6, 12); 
        } 
        else if (e.type === 'wraith') {
            // Ghostly shape
            ctx.globalAlpha = 0.7;
            ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(-10, 8); ctx.lineTo(-5, 0); ctx.lineTo(-10, -8); ctx.fill();
            ctx.globalAlpha = 1.0;
        } 
        else {
            ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill();
            // Glow center
            ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0,0,2,0,Math.PI*2); ctx.fill();
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
            let valid = mapStandard[startNode.x][startNode.y].cost < 99999;
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
                // Construction Effect
                for(let i=0;i<10;i++) particles.push({type:'spark', x:newT.x, y:newT.y, color:'#fff', life:20, vx:Math.random()*4-2, vy:Math.random()*4-2});
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
