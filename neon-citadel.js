import { getHighScore, submitHighScore } from './score-store.js';

/* NEON CITADEL - V9 (VISUAL & LOGIC FIXES) */
(function(global){
  const Neon = (function(){
    
    // CONFIG
    const CELL = 20; 
    let COLS, ROWS;
    
    // --- TOWER DEFINITIONS ---
    const TOWER_TYPES = {
      'gatling': { 
            name:'VULCAN', cost:100, color:'#00ffff', type:'phys', 
            dmg:8, rng:140, rate:5, hp:300, 
            desc:"Rapid-fire kinetic. Cheap and reliable." 
        },
        'pyro': {
            name:'PYRO', cost:350, color:'#ff5500', type:'chem',
            dmg:5, rng:110, rate:2, hp:400, cone:true,
            desc:"Flamethrower. Melts Armor/Swarms."
        },
        'cannon': { 
            name:'NOVA', cost:450, color:'#ffaa00', type:'ex', 
            dmg:60, rng:180, rate:55, hp:600, aoe:50, 
            desc:"Heavy shells. Smashes Armor clusters." 
        },
        'rail': { 
            name:'RAILGUN', cost:700, color:'#ffffff', type:'phys', 
            dmg:80, rng:320, rate:70, hp:350, pierce:true, 
            desc:"Hyper-velocity slug. Pierces line of enemies." 
        },
        'tesla': { 
            name:'STORM', cost:850, color:'#ffee00', type:'energy', 
            dmg:35, rng:160, rate:35, hp:450, chain:true, 
            desc:"Chains fractal lightning. Overloads Shields." 
        },
        'orbit': { 
            name:'ORBIT', cost:1000, color:'#0088ff', type:'energy', 
            dmg:15, rng:150, rate:8, hp:500, drone:true, 
            desc:"Deploys an autonomous defense drone." 
        },
        'missile': { 
            name:'HYDRA', cost:1300, color:'#00ff88', type:'ex', 
            dmg:180, rng:350, rate:70, hp:450, missile:true, 
            desc:"Long-range smart missiles. Good vs Bosses." 
        },
        'poison': { 
            name:'PLAGUE', cost:550, color:'#00ff00', type:'chem', 
            dmg:8, rng:140, rate:40, hp:500, gas:true, 
            desc:"Launches corrosive gas canisters." 
        },
        'laser': { 
            name:'PHASE', cost:2200, color:'#d000ff', type:'energy', 
            dmg:30, rng:280, rate:0, hp:800, beam:true, 
            desc:"Capital-class obliterator beam." 
        },
        'block': { 
            name:'BARRIER', cost:20, color:'#444', type:'none', 
            dmg:0, rng:0, rate:0, hp:2000, 
            desc:"Heavy routing obstacle." 
        }
    };

    // --- ENEMY DEFINITIONS ---
    const ENEMY_INFO = {
        'drone':   { name: 'DRONE',   hp: 'LOW',  spd: 'FAST', weak: 'NONE',   desc: 'Fast, swarming scout unit.' },
        'grunt':   { name: 'GRUNT',   hp: 'MED',  spd: 'MED',  weak: 'PHYS',   desc: 'Standard infantry.' },
        'tank':    { name: 'TANK',    hp: 'HIGH', spd: 'SLOW', weak: 'CHEM/EX',desc: 'Heavily Armored (Yellow). Resists Bullets.' },
        'shield':  { name: 'AEGIS',   hp: 'MED',  spd: 'MED',  weak: 'ENERGY', desc: 'Energy Shield (Blue). Regenerates.' },
        'runner':  { name: 'SPEED',   hp: 'LOW',  spd: 'V.FAST', weak: 'AOE',  desc: 'High velocity breacher.' },
        'boss':    { name: 'TITAN',   hp: 'EXTREME', spd: 'SLOW', weak: 'ALL', desc: 'Level Boss. Massive threat.' }
    };

    // GAME STATE
    let canvas, ctx;
    let grid=[], towers=[], enemies=[], projectiles=[], particles=[], floatingText=[], gasClouds=[];
    let mapStandard=[], mapDanger=[];
    const GAME_ID = 'tower-neon';
    let state = { wave:1, money:750, lives:30, active:false, frame:0, paused:false, shake:0 };
    let bestWave = 0;
    let submitted = false;
    let selection=null, buildMode=null, boss=null;
    let startNode, endNode;

    // --- INIT ---
    function init(c) {
        canvas = c; ctx = c.getContext('2d');
        COLS = Math.floor(canvas.width / CELL);
        ROWS = Math.floor(canvas.height / CELL);
        startNode = {x:0, y:Math.floor(ROWS/2)};
        endNode = {x:COLS-1, y:Math.floor(ROWS/2)};
        reset();
    }

    async function loadBestWave() {
        bestWave = await getHighScore(GAME_ID);
    }

    async function submitBestWave() {
        if (submitted) return;
        submitted = true;
        const saved = await submitHighScore(GAME_ID, state.wave);
        if (typeof saved === 'number') bestWave = saved;
    }

    function reset() {
        state = { wave:1, money:750, lives:30, active:false, frame:0, paused:false, shake:0 };
        towers=[]; enemies=[]; projectiles=[]; particles=[]; floatingText=[]; gasClouds=[];
        grid = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(null));
        submitted = false;
        recalcPaths();
        loadBestWave();
    }

    // --- PATHFINDING ---
    function recalcPaths() {
        mapStandard = createMap();
        mapDanger = createMap();

        let dangerWeights = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(0));
        towers.forEach(t => {
            if(t.type === 'block') return;
            let r = Math.ceil(t.rng/CELL);
            for(let xx=-r; xx<=r; xx++) {
                for(let yy=-r; yy<=r; yy++) {
                    let tx=t.gx+xx, ty=t.gy+yy;
                    if(tx>=0 && tx<COLS && ty>=0 && ty<ROWS) {
                        if((tx*CELL - t.x)**2 + (ty*CELL - t.y)**2 <= t.rng**2) {
                            dangerWeights[tx][ty] = 50;
                        }
                    }
                }
            }
        });

        generateFlowField(mapStandard, endNode, (x,y) => grid[x][y] ? 999999 : 1);
        generateFlowField(mapDanger, endNode, (x,y) => (grid[x][y] ? 999999 : 1) + dangerWeights[x][y]);
    }

    function createMap() { return new Array(COLS).fill(0).map(()=>new Array(ROWS).fill({cost:999999, next:null})); }

    function generateFlowField(map, target, weightFn) {
        let q = []; map[target.x][target.y] = { cost: 0, next: null }; q.push(target);
        const dirs = [[0,1], [0,-1], [1,0], [-1,0]]; 
        while(q.length) {
            q.sort((a,b) => map[a.x][a.y].cost - map[b.x][b.y].cost);
            let u = q.shift();
            dirs.forEach(d => {
                let nx = u.x + d[0], ny = u.y + d[1];
                if(nx>=0 && nx<COLS && ny>=0 && ny<ROWS) {
                    let w = weightFn(nx, ny);
                    let newCost = map[u.x][u.y].cost + w;
                    if(newCost < map[nx][ny].cost && w < 500000) {
                        map[nx][ny] = { cost: newCost, next: {x:u.x, y:u.y} }; q.push({x:nx, y:ny});
                    }
                }
            });
        }
    }

    function getNextMove(e) {
        let gx = Math.floor(e.x/CELL); let gy = Math.floor(e.y/CELL);
        if(gx<0 || gx>=COLS || gy<0 || gy>=ROWS) return {x:COLS-1, y:Math.floor(ROWS/2)};
        let map = (e.ai === 'tactician') ? mapDanger : mapStandard;
        let cell = map[gx][gy]; if(!cell || !cell.next) cell = mapStandard[gx][gy]; 
        return cell ? cell.next : null;
    }

    // --- GAME LOOP ---
    function startWave() {
        if(state.active) return;
        state.active = true;
        
        if(state.money > 0 && state.wave > 1) {
            let interest = Math.floor(state.money * 0.1);
            if(interest>0) { state.money+=interest; addText(canvas.width/2, canvas.height/2+60, `INTEREST: +$${interest}`, '#0f0', 100); }
        }

        let diffMult = 1 + (state.wave * 0.3);
        let budget = 300 * diffMult + (state.wave * 120);
        let queue = [];

        const DEFS = {
            'drone':  { cost:15, hp:40,  spd:3.0, color:'#0ff', ai:'std', armor:0, shield:0 },
            'grunt':  { cost:30, hp:120, spd:1.8, color:'#f0f', ai:'std', armor:0, shield:0 },
            'shield': { cost:60, hp:100, spd:1.5, color:'#08f', ai:'std', armor:0, shield:150 },
            'tank':   { cost:90, hp:400, spd:0.8, color:'#aa0', ai:'std', armor:1, shield:0 },
            'runner': { cost:50, hp:80,  spd:4.0, color:'#f88', ai:'tactician', armor:0, shield:0 }
        };

        while(budget > 0) {
            let opts = ['drone'];
            if(state.wave > 2) opts.push('grunt');
            if(state.wave > 3) opts.push('shield');
            if(state.wave > 5) opts.push('runner');
            if(state.wave > 7) opts.push('tank');
            let type = opts[Math.floor(Math.random()*opts.length)];
            let def = DEFS[type];
            queue.push({type, ...def});
            budget -= def.cost;
        }

        let i = 0;
        let int = setInterval(() => {
            if(state.paused) return;
            if(i >= queue.length) {
                clearInterval(int);
                if(state.wave % 5 === 0) setTimeout(spawnBoss, 4000);
            } else { spawnEnemy(queue[i]); i++; }
        }, Math.max(100, 600 - state.wave*25));
    }

    function spawnEnemy(def) {
        let mult = 1 + (state.wave*0.35);
        let hp = def.hp * mult;
        let shield = (def.shield || 0) * mult;
        enemies.push({
            x: 0, y: (Math.floor(ROWS/2) * CELL) + CELL/2,
            hp, maxHp:hp, shield, maxShield:shield, armor:def.armor||0,
            spd:def.spd, color:def.color, type:def.type, ai:def.ai,
            angle:0, vx:0, vy:0, id:Math.random(), shieldRecharge:0
        });
    }

    function spawnBoss() {
        let hp = 30000 * Math.pow(1.5, state.wave/5);
        boss = {
            x: 0, y: (Math.floor(ROWS/2) * CELL) + CELL/2,
            hp, maxHp:hp, spd:0.5, shield:hp*0.5, maxShield:hp*0.5, armor:1,
            type:'boss', bossType:'TITAN', ai:'std', color:'#fff',
            angle:0, isBoss:true, shieldRecharge:0
        };
        enemies.push(boss);
        state.shake = 50;
        addText(canvas.width/2, canvas.height/2, "WARNING: CLASS 5 TITAN", "red", 200);
    }

    function update() {
        if(state.paused || state.lives <= 0) {
            if (state.lives <= 0) submitBestWave();
            return;
        }
        state.frame++;
        if(state.shake > 0) state.shake--;

        // ENEMIES
        for(let i=enemies.length-1; i>=0; i--) {
            let e = enemies[i];
            
            // Shield Recharge
            if(e.maxShield > 0 && e.shield < e.maxShield && e.shieldRecharge <= 0) {
                e.shield += e.maxShield * 0.005; 
            }
            if(e.shieldRecharge > 0) e.shieldRecharge--;

            // Move
            if(e.x >= (COLS-1)*CELL) {
                state.lives -= e.isBoss?1000:1;
                state.shake = 10;
                enemies.splice(i,1);
                if(e.isBoss) boss=null;
                continue;
            }

            let next = getNextMove(e);
            if(next) {
                let tx = next.x*CELL + CELL/2, ty = next.y*CELL + CELL/2;
                let ang = Math.atan2(ty-e.y, tx-e.x);
                e.vx = Math.cos(ang)*e.spd; e.vy = Math.sin(ang)*e.spd;
                e.angle = ang; e.x+=e.vx; e.y+=e.vy;
            }

            if(e.hp <= 0) {
                let rew = e.isBoss ? 5000 : (e.maxHp/5);
                state.money += Math.floor(rew);
                addText(e.x, e.y, `+$${Math.floor(rew)}`, '#ff0');
                for(let k=0;k<8;k++) particles.push({type:'spark', x:e.x, y:e.y, color:e.color, life:20, vx:Math.random()*6-3, vy:Math.random()*6-3});
                enemies.splice(i,1);
                if(e.isBoss) { boss=null; state.shake=60; }
            }
        }

        // TOWERS
        towers.forEach(t => {
            if(t.type === 'block') return;

            // ORBIT TOWER LOGIC
            if(t.type === 'orbit') {
                t.angle = (t.angle || 0) + 0.1; // Rotate drone
                let dx = t.x + Math.cos(t.angle)*25;
                let dy = t.y + Math.sin(t.angle)*25;
                
                if(state.frame % 15 === 0) {
                    let target = enemies.find(e => Math.hypot(e.x-dx, e.y-dy) < t.rng);
                    if(target) {
                         projectiles.push({x:dx, y:dy, target:target, type:'plasma', color:t.color, dmg:t.dmg, spd:12});
                    }
                }
                return;
            }

            // FLAMETHROWER
            if(t.cone) {
                if(state.frame%3===0) {
                    let target = enemies.find(e=>Math.hypot(e.x-t.x, e.y-t.y)<t.rng);
                    if(target) {
                        t.angle = Math.atan2(target.y-t.y, target.x-t.x);
                        let spread = (Math.random()-0.5)*0.5;
                        projectiles.push({x:t.x, y:t.y, type:'fire', color:t.color, life:30, vx:Math.cos(t.angle+spread)*6, vy:Math.sin(t.angle+spread)*6});
                        // Cone Damage
                        enemies.forEach(e => {
                            if(Math.hypot(e.x-t.x, e.y-t.y)<t.rng && Math.abs(Math.atan2(e.y-t.y,e.x-t.x) - t.angle) < 0.4) {
                                takeDamage(e, t.dmg, t.type);
                            }
                        });
                    }
                }
                return;
            }

            // RAILGUN
            if(t.pierce) {
                if(t.cd>0) t.cd--;
                else {
                    let target = enemies.find(e=>Math.hypot(e.x-t.x, e.y-t.y)<t.rng);
                    if(target) {
                        t.angle = Math.atan2(target.y-t.y, target.x-t.x);
                        enemies.forEach(e => {
                            let dToT = Math.hypot(e.x-t.x, e.y-t.y);
                            let angToE = Math.atan2(e.y-t.y, e.x-t.x);
                            if(dToT < t.rng && Math.abs(angToE - t.angle) < 0.1) {
                                takeDamage(e, t.dmg, 'phys');
                                particles.push({type:'spark', x:e.x, y:e.y, color:'#fff', life:10});
                            }
                        });
                        particles.push({type:'beam', sx:t.x, sy:t.y, ex:t.x+Math.cos(t.angle)*t.rng, ey:t.y+Math.sin(t.angle)*t.rng, color:'#fff', life:8});
                        t.cd = t.rate;
                        t.recoil = 10;
                    }
                }
                return;
            }

            // BEAM
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

            if(t.cd > 0) t.cd--;
            else {
                let targets = enemies.filter(e => Math.hypot(e.x-t.x, e.y-t.y) < t.rng);
                if(targets.length > 0) {
                    targets.sort((a,b) => (b.isBoss?1000:0) + (a.hp - b.hp));
                    let target = targets[0];
                    t.angle = Math.atan2(target.y-t.y, target.x-t.x);

                    if(t.type === 'tesla') fireTesla(t, target, enemies);
                    else if(t.type === 'poison') projectiles.push({x:t.x, y:t.y, tx:target.x, ty:target.y, type:'canister', color:t.color, dmg:t.dmg, spd:6});
                    else if(t.type === 'missile') projectiles.push({x:t.x, y:t.y, target:target, type:'missile', color:t.color, dmg:t.dmg, spd:3, acc:0.3, aoe:90});
                    else {
                        projectiles.push({x:t.x, y:t.y, target:target, type:t.type==='ex'?'shell':'bullet', color:t.color, dmg:t.dmg, spd:15, aoe:t.aoe, vx:Math.cos(t.angle)*15, vy:Math.sin(t.angle)*15});
                        t.muzzle = 4;
                    }
                    t.cd = t.rate;
                    t.recoil = 6;
                }
            }
            if(t.recoil > 0) t.recoil--;
            if(t.muzzle > 0) t.muzzle--;
        });

        // PROJECTILES
        for(let i=projectiles.length-1; i>=0; i--) {
            let p = projectiles[i];
            
            if(p.type === 'fire') {
                p.x+=p.vx; p.y+=p.vy; p.life--; if(p.life<=0) projectiles.splice(i,1); continue;
            }

            if(p.type === 'canister') {
                let d = Math.hypot(p.tx-p.x, p.ty-p.y);
                if(d < p.spd) {
                    gasClouds.push({x:p.tx, y:p.ty, r:60, life:240, color:p.color, dmg:p.dmg});
                    projectiles.splice(i,1);
                } else {
                    let a = Math.atan2(p.ty-p.y, p.tx-p.x);
                    p.x+=Math.cos(a)*p.spd; p.y+=Math.sin(a)*p.spd;
                    particles.push({type:'trail', x:p.x, y:p.y, color:p.color, life:10});
                }
                continue;
            }

            if(p.type === 'missile') {
                if(!p.target || p.target.hp<=0) p.target = enemies[0];
                if(!p.target) { projectiles.splice(i,1); continue; }
                
                let ang = Math.atan2(p.target.y - p.y, p.target.x - p.x);
                // Homing
                let vx = Math.cos(ang) * p.spd;
                let vy = Math.sin(ang) * p.spd;
                p.x += vx; p.y += vy;
                p.spd += p.acc;
                particles.push({type:'smoke', x:p.x, y:p.y, life:15});

                if(Math.hypot(p.target.x-p.x, p.target.y-p.y) < p.spd) {
                     explode(p.x, p.y, p.aoe, p.dmg, 'ex');
                     projectiles.splice(i,1);
                }
                continue;
            }

            // Bullet/Shell/Plasma
            p.x+=p.vx; p.y+=p.vy;
            let hit = enemies.find(e => Math.hypot(e.x-p.x, e.y-p.y) < 20);
            if(hit) {
                if(p.aoe) explode(p.x, p.y, p.aoe, p.dmg, 'ex');
                else {
                    let type = (p.type==='plasma') ? 'energy' : 'phys';
                    takeDamage(hit, p.dmg, type);
                    particles.push({type:'spark', x:p.x, y:p.y, color:p.color, life:5});
                }
                projectiles.splice(i,1);
            } else if(p.x<0||p.x>canvas.width||p.y<0||p.y>canvas.height) projectiles.splice(i,1);
        }

        // GAS
        gasClouds.forEach((g,i) => {
            if(state.frame % 20 === 0) {
                enemies.forEach(e => {
                    if(Math.hypot(e.x-g.x, e.y-g.y) < g.r) takeDamage(e, g.dmg, 'chem');
                });
            }
            g.life--; if(g.life<=0) gasClouds.splice(i,1);
        });

        particles.forEach((p,i) => { p.life--; p.x+=(p.vx||0); p.y+=(p.vy||0); if(p.life<=0) particles.splice(i,1); });
        floatingText.forEach((t,i) => { t.y-=0.5; t.life--; if(t.life<=0) floatingText.splice(i,1); });

        if(state.active && enemies.length===0) { state.active=false; state.wave++; state.money+=400; if (state.wave > bestWave) bestWave = state.wave; }
    }

    function takeDamage(e, amt, type) {
        e.shieldRecharge = 120;
        if(e.shield > 0) {
            let mult = (type === 'energy') ? 2.0 : (type === 'phys') ? 0.5 : 1.0;
            e.shield -= amt * mult;
            if(e.shield < 0) {
                e.hp += e.shield; e.shield = 0;
                particles.push({type:'burst', x:e.x, y:e.y, color:'#0088ff', life:10});
            } else {
                particles.push({type:'spark', x:e.x, y:e.y, color:'#0088ff', life:5});
                return;
            }
        }
        if(e.armor > 0) {
            if(type === 'phys') amt *= 0.5;
            if(type === 'chem' || type === 'ex') amt *= 1.5;
        }
        e.hp -= amt;
    }

    function explode(x, y, r, dmg, type) {
        state.shake = 5;
        particles.push({type:'shockwave', x, y, life:15, color:'#ffaa00'});
        enemies.forEach(e => { if(Math.hypot(e.x-x, e.y-y) < r) takeDamage(e, dmg, type); });
    }

    function fireTesla(t, target, enemies) {
        let chain = [target];
        let curr = target;
        takeDamage(target, t.dmg, 'energy');
        for(let k=0; k<5; k++) {
            let next = enemies.find(e => !chain.includes(e) && Math.hypot(e.x-curr.x, e.y-curr.y) < 130);
            if(next) { chain.push(next); takeDamage(next, t.dmg*0.8, 'energy'); curr=next; }
        }
        particles.push({type:'bolt', chain, color:t.color, life:5});
    }

    // --- DRAWING ---
    function draw(ctx) {
        ctx.save();
        if(state.shake>0) ctx.translate((Math.random()-0.5)*state.shake, (Math.random()-0.5)*state.shake);
        
        ctx.fillStyle = '#050508'; ctx.fillRect(0,0,canvas.width,canvas.height);

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.02)'; ctx.lineWidth=1;
        ctx.beginPath();
        for(let x=0;x<=COLS;x++) { ctx.moveTo(x*CELL,0); ctx.lineTo(x*CELL,canvas.height); }
        for(let y=0;y<=ROWS;y++) { ctx.moveTo(0,y*CELL); ctx.lineTo(canvas.width,y*CELL); }
        ctx.stroke();

        if(buildMode) {
            ctx.fillStyle = 'rgba(0,255,100,0.1)';
            for(let x=0;x<COLS;x++) for(let y=0;y<ROWS;y++) if(mapStandard[x][y].cost<999999) ctx.fillRect(x*CELL,y*CELL,CELL,CELL);
        }

        // Gas Clouds
        gasClouds.forEach(g => {
            let grad = ctx.createRadialGradient(g.x, g.y, 10, g.x, g.y, g.r);
            grad.addColorStop(0, `rgba(50,255,50,0.6)`);
            grad.addColorStop(1, 'rgba(0,255,0,0)');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.arc(g.x, g.y, g.r, 0, Math.PI*2); ctx.fill();
        });

        // Beams
        particles.forEach(p => {
            if(p.type === 'beam') {
                ctx.strokeStyle = p.color; ctx.lineWidth = p.life/2; 
                ctx.beginPath(); ctx.moveTo(p.sx, p.sy); ctx.lineTo(p.ex, p.ey); ctx.stroke();
            }
        });

        towers.forEach(t => drawTower(ctx, t));
        enemies.forEach(e => drawEnemy(ctx, e));

        projectiles.forEach(p => {
            ctx.fillStyle = p.color;
            if(p.type==='fire') {
                ctx.globalAlpha = p.life/30; ctx.beginPath(); ctx.arc(p.x, p.y, 6 + (30-p.life)/2, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
            } else if (p.type==='missile') {
                // Rocket
                ctx.save(); ctx.translate(p.x, p.y); 
                let ang = Math.atan2(p.vy, p.vx);
                ctx.rotate(ang);
                ctx.fillStyle = p.color;
                ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(-4, 4); ctx.lineTo(-4, -4); ctx.fill(); // Body
                ctx.fillStyle = '#fff'; ctx.fillRect(-6,-2,4,4); // Thruster
                ctx.restore();
            } else if (p.type==='plasma') {
                 ctx.shadowBlur=10; ctx.shadowColor=p.color; 
                 ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2); ctx.fill(); 
                 ctx.shadowBlur=0;
            } else if (p.type==='canister') {
                 ctx.fillStyle='#0f0'; ctx.fillRect(p.x-3, p.y-3, 6, 6);
            } else {
                ctx.shadowBlur=5; ctx.shadowColor=p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
            }
        });

        particles.forEach(p => {
            if(p.type === 'bolt') drawFractalLightning(ctx, p.chain, p.color);
            else if(p.type === 'shockwave') {
                ctx.strokeStyle=p.color; ctx.lineWidth=3; ctx.beginPath(); ctx.arc(p.x, p.y, (20-p.life)*4, 0, Math.PI*2); ctx.stroke();
            } else if(p.type === 'spark') {
                ctx.fillStyle=p.color; ctx.fillRect(p.x, p.y, 2, 2);
            } else if(p.type === 'smoke') {
                ctx.fillStyle = `rgba(150,150,150,${p.life/15})`; ctx.beginPath(); ctx.arc(p.x,p.y,p.life/2,0,Math.PI*2); ctx.fill();
            } else if(p.type === 'trail') {
                 ctx.fillStyle = p.color; ctx.globalAlpha=p.life/10; ctx.fillRect(p.x,p.y,3,3); ctx.globalAlpha=1;
            }
        });

        floatingText.forEach(t => { ctx.fillStyle=t.color; ctx.font='bold 12px Arial'; ctx.fillText(t.text, t.x, t.y); });

        if(boss) {
            let cx = canvas.width/2;
            let bw = 800;
            ctx.fillStyle = '#200'; ctx.fillRect(cx-bw/2, 50, bw, 20);
            ctx.fillStyle = '#f00'; ctx.fillRect(cx-bw/2, 50, bw*(boss.hp/boss.maxHp), 20);
            if(boss.shield>0) {
                ctx.fillStyle = '#08f'; ctx.fillRect(cx-bw/2, 75, bw*(boss.shield/boss.maxShield), 10);
            }
            ctx.fillStyle='#fff'; ctx.textAlign='center'; ctx.font="bold 16px monospace"; ctx.fillText(`TITAN CLASS // HP: ${Math.floor(boss.hp)}`, cx, 45); ctx.textAlign='left';
        }

        ctx.restore();
    }

    // --- RECURSIVE FRACTAL LIGHTNING ---
    function drawFractalLightning(ctx, chain, color) {
        if(chain.length<2) return;
        ctx.strokeStyle=color; ctx.lineWidth=2; ctx.shadowColor=color; ctx.shadowBlur=15;
        ctx.lineCap = 'round';
        ctx.beginPath();
        
        // Draw main segments
        for(let i=1; i<chain.length; i++) {
            let start = chain[i-1];
            let end = chain[i];
            drawBoltSegment(ctx, start.x, start.y, end.x, end.y, 1);
        }
        ctx.stroke(); 
        ctx.shadowBlur=0;
    }

    function drawBoltSegment(ctx, x1, y1, x2, y2, depth) {
        let dist = Math.hypot(x2-x1, y2-y1);
        if(dist < 10 || depth <= 0) {
            ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
            return;
        }
        let midX = (x1+x2)/2; let midY = (y1+y2)/2;
        // Jitter based on distance
        let offset = Math.max(5, dist * 0.2); 
        midX += (Math.random()-0.5) * offset;
        midY += (Math.random()-0.5) * offset;
        
        drawBoltSegment(ctx, x1, y1, midX, midY, depth-1);
        drawBoltSegment(ctx, midX, midY, x2, y2, depth-1);
    }

    function drawTower(ctx, t) {
        ctx.save(); ctx.translate(t.x, t.y);
        
        // Base
        ctx.fillStyle = '#111'; ctx.fillRect(-8,-8,16,16);
        ctx.strokeStyle = t.color; ctx.lineWidth=1; ctx.strokeRect(-8,-8,16,16);
        
        if(selection===t) { ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(0,0,t.rng,0,Math.PI*2); ctx.stroke(); }

        // Drone
        if(t.type === 'orbit') {
             let dx = Math.cos(t.angle)*25, dy = Math.sin(t.angle)*25;
             ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(dx, dy, 5, 0, Math.PI*2); ctx.fill();
             ctx.strokeStyle = t.color; ctx.globalAlpha=0.3; ctx.beginPath(); ctx.arc(0,0,25,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha=1;
        } else {
            // ROTATING TURRET HEAD
            ctx.rotate(t.angle);
            let off = t.recoil||0;
            ctx.fillStyle = t.color;

            if(t.type === 'gatling') {
                ctx.fillRect(-3, -8+off, 6, 16); 
                ctx.fillStyle='#444'; ctx.fillRect(-4,-4,8,8); 
            } else if (t.type === 'cannon') {
                ctx.fillRect(-6, -6+off, 12, 14);
                ctx.fillStyle='#222'; ctx.fillRect(-4,-4,8,8);
            } else if (t.type === 'rail') {
                ctx.fillRect(-2, -10+off, 4, 20); 
                ctx.fillStyle='#fff'; ctx.fillRect(-2,-12+off,4,4);
            } else if (t.type === 'missile') {
                ctx.fillStyle='#222'; ctx.fillRect(-6,-6,12,12); // Pod
                ctx.fillStyle=t.color; 
                if(!t.cd || t.cd < 20) { // Show missiles if ready
                    ctx.fillRect(-4, -8, 2, 6); ctx.fillRect(2, -8, 2, 6);
                }
            } else if (t.type === 'pyro') {
                ctx.fillStyle='#d40'; ctx.fillRect(-5,-8,10,14);
                ctx.fillStyle='#f90'; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
            } else if (t.type === 'tesla') {
                ctx.fillStyle='#aa0'; ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill();
                ctx.fillStyle='#ff0'; ctx.beginPath(); ctx.arc(0,0,3,0,Math.PI*2); ctx.fill(); // Core
            } else if (t.type === 'poison') {
                ctx.fillStyle='#060'; ctx.fillRect(-6,-6,12,12); // Vat
                ctx.fillStyle='#0f0'; ctx.fillRect(-4,-4,8,8); // Sludge
            } else {
                ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill();
                if(t.muzzle) { ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0, 10, 4, 0, Math.PI*2); ctx.fill(); }
            }
        }
        ctx.restore();
        
        if(t.hp < t.maxHp) {
             ctx.fillStyle = 'red'; ctx.fillRect(t.x-8, t.y-12, 16, 2);
             ctx.fillStyle = '#0f0'; ctx.fillRect(t.x-8, t.y-12, 16*(t.hp/t.maxHp), 2);
        }
    }

    function drawEnemy(ctx, e) {
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle);
        
        if(e.shield > 0) {
            ctx.strokeStyle = `rgba(0, 136, 255, ${Math.min(1, e.shield/e.maxShield + 0.2)})`;
            ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.stroke();
        }

        ctx.fillStyle = e.color;
        if(e.isBoss) {
            ctx.scale(4, 4); 
            ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.stroke();
            ctx.fillStyle = `rgba(255,0,0,${Math.abs(Math.sin(state.frame*0.1))})`; 
            ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fill();
        } else if (e.type === 'tank') {
            ctx.fillRect(-9,-9,18,18); ctx.fillStyle='#000'; ctx.fillRect(-5,-5,10,10);
        } else {
            ctx.beginPath(); ctx.moveTo(7,0); ctx.lineTo(-6, 6); ctx.lineTo(-6, -6); ctx.fill();
        }
        ctx.restore();
    }

    // --- INTERFACE ---
    function click(x, y) {
        let gx = Math.floor(x/CELL), gy = Math.floor(y/CELL);
        if(gx<0||gx>=COLS||gy<0||gy>=ROWS) return;

        let t = grid[gx][gy];
        if(t) { selection = t; buildMode = null; return; }

        if(buildMode) {
            let def = TOWER_TYPES[buildMode];
            if(!def) return;
            grid[gx][gy] = {x:0}; recalcPaths();
            let valid = mapStandard[startNode.x][startNode.y].cost < 999999;
            grid[gx][gy] = null; 
            if(valid && state.money >= def.cost) {
                state.money -= def.cost;
                let newT = { gx, gy, x:gx*CELL+CELL/2, y:gy*CELL+CELL/2, ...def, maxHp:def.hp, hp:def.hp, cd:0, attrLevels:{dmg:0,rng:0,rate:0}, id:Date.now() };
                grid[gx][gy] = newT; towers.push(newT); recalcPaths();
            }
        }
        selection = null;
    }

    function addText(x,y,t,c,l=60) { floatingText.push({x,y,text:t,color:c,life:l}); }
    
    // PUBLIC API
    return {
        init, update, draw, click, startWave, 
        setBuild: (k)=>{ buildMode=k; selection=null; },
        deselect: ()=>{ selection=null; buildMode=null; state.paused=false; },
        pause: (b) => { state.paused = b; },
        upgrade: (attr) => {
             if(selection && TOWER_TYPES[selection.type]) { 
                 let def = TOWER_TYPES[selection.type];
                 let cost = Math.floor(def.cost*0.5*((selection.attrLevels[attr]||0)+1));
                 if(state.money>=cost) {
                     state.money-=cost; selection.attrLevels[attr] = (selection.attrLevels[attr]||0)+1;
                     if(attr==='dmg') selection.dmg*=1.25;
                     if(attr==='rng') { selection.rng*=1.15; recalcPaths(); }
                     if(attr==='rate') selection.rate*=0.85;
                 }
             }
        },
        sell: ()=>{ 
            if(selection && TOWER_TYPES[selection.type]){ 
                state.money+=Math.floor(TOWER_TYPES[selection.type].cost*0.5); 
                grid[selection.gx][selection.gy]=null; 
                towers=towers.filter(t=>t!==selection); 
                selection=null; 
                recalcPaths(); 
            } else { selection = null; }
        },
        stop: ()=>{ submitBestWave(); },
        getEnemyTypes: () => ENEMY_INFO,
        drawPreview: (ctx, type) => {
            let def = ENEMY_INFO[type];
            let dummy = { 
                x:50, y:50, angle:0, 
                color: (type==='tank'?'#aa0': type==='shield'?'#08f': type==='drone'?'#0ff': type==='runner'?'#f88': '#f0f'), 
                type:type, isBoss:(type==='boss'), 
                shield:(type==='shield'?10:0), maxShield:10 
            };
            if(type==='boss') dummy.color='#fff';
            drawEnemy(ctx, dummy);
        },
        conf: {towers: TOWER_TYPES},
        get state(){return state}, get bestWave(){return bestWave}, get sel(){return selection}, get buildMode(){return buildMode}
    };
  })();
  window.NeonGame = Neon;
})(window);
