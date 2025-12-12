/* NEON CITADEL - V7 (FINAL TACTICAL & VISUAL OVERHAUL) */
(function(global){
  const Neon = (function(){
    
    // CONFIG: 20px Cell = 60x40 Grid on a 1200x800 Canvas
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
            desc:"Hyper-velocity slug. Pierces enemies in a line." 
        },
        'tesla': { 
            name:'STORM', cost:850, color:'#ffee00', type:'energy', 
            dmg:35, rng:160, rate:35, hp:450, chain:true, 
            desc:"Chains fractal lightning. Overloads Shields." 
        },
        'orbit': { 
            name:'ORBIT', cost:1000, color:'#0088ff', type:'energy', 
            dmg:15, rng:140, rate:8, hp:500, drone:true, 
            desc:"Deploys an autonomous defense drone." 
        },
        'missile': { 
            name:'HYDRA', cost:1300, color:'#00ff88', type:'ex', 
            dmg:180, rng:350, rate:70, hp:450, missile:true, 
            desc:"Long-range smart missiles. Good vs Bosses." 
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

    // --- ENEMY DEFINITIONS (For Codex & Spawning) ---
    const ENEMY_INFO = {
        'drone':   { name: 'DRONE',   hp: 'LOW',  spd: 'FAST', weak: 'NONE',   desc: 'Fast, swarming scout unit. No defenses.' },
        'grunt':   { name: 'GRUNT',   hp: 'MED',  spd: 'MED',  weak: 'PHYS',   desc: 'Standard infantry. Balanced stats.' },
        'tank':    { name: 'TANK',    hp: 'HIGH', spd: 'SLOW', weak: 'CHEM/EX',desc: 'Heavily Armored (Yellow Bar). Resists Bullets.' },
        'shield':  { name: 'AEGIS',   hp: 'MED',  spd: 'MED',  weak: 'ENERGY', desc: 'Energy Shield (Blue Bar). Regenerates if not hit.' },
        'runner':  { name: 'SPEED',   hp: 'LOW',  spd: 'V.FAST', weak: 'AOE',  desc: 'High velocity breacher. Hard to hit.' },
        'boss':    { name: 'TITAN',   hp: 'EXTREME', spd: 'SLOW', weak: 'ALL', desc: 'Level Boss. Massive threat. Requires focused fire.' }
    };

    // GAME STATE
    let canvas, ctx;
    let grid=[], towers=[], enemies=[], projectiles=[], particles=[], floatingText=[], gasClouds=[];
    let mapStandard=[], mapDanger=[];
    let state = { wave:1, money:750, lives:30, active:false, frame:0, paused:false, shake:0 };
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

    function reset() {
        state = { wave:1, money:750, lives:30, active:false, frame:0, paused:false, shake:0 };
        towers=[]; enemies=[]; projectiles=[]; particles=[]; floatingText=[]; gasClouds=[];
        grid = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(null));
        recalcPaths();
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
                            dangerWeights[tx][ty] = 50; // Tactical AI Avoidance Cost
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

    // --- LOGIC ---
    function startWave() {
        if(state.active) return;
        state.active = true;
        
        // Compound Interest
        if(state.money > 0 && state.wave > 1) {
            let interest = Math.floor(state.money * 0.1);
            if(interest>0) { state.money+=interest; addText(canvas.width/2, canvas.height/2+60, `INTEREST: +$${interest}`, '#0f0', 100); }
        }

        let diffMult = 1 + (state.wave * 0.3);
        let budget = 300 * diffMult + (state.wave * 120);
        let queue = [];

        // SPAWN DEFS
        const DEFS = {
            'drone':  { cost:15, hp:40,  spd:3.0, color:'#0ff', ai:'std', armor:0, shield:0 },
            'grunt':  { cost:30, hp:120, spd:1.8, color:'#f0f', ai:'std', armor:0, shield:0 },
            'shield': { cost:60, hp:100, spd:1.5, color:'#08f', ai:'std', armor:0, shield:150 }, // Shield Unit
            'tank':   { cost:90, hp:400, spd:0.8, color:'#aa0', ai:'std', armor:1, shield:0 },   // Armor Unit
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
        if(state.paused || state.lives <= 0) return;
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
                // Explosion
                for(let k=0;k<8;k++) particles.push({type:'spark', x:e.x, y:e.y, color:e.color, life:20, vx:Math.random()*6-3, vy:Math.random()*6-3});
                enemies.splice(i,1);
                if(e.isBoss) { boss=null; state.shake=60; }
            }
        }

        // TOWERS
        towers.forEach(t => {
            if(t.type === 'block') return;

            // ORBIT DRONE
            if(t.drone) {
                t.droneAngle = (t.droneAngle||0) + 0.1;
                let dx = t.x + Math.cos(t.droneAngle)*25;
                let dy = t.y + Math.sin(t.droneAngle)*25;
                
                if(state.frame % 10 === 0) { // Fast fire
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
                        // Raycast Line Check
                        enemies.forEach(e => {
                            let dToT = Math.hypot(e.x-t.x, e.y-t.y);
                            let angToE = Math.atan2(e.y-t.y, e.x-t.x);
                            // If enemy is within range and within a very narrow angle (piercing line)
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

            // BEAM (Laser)
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
                    else if(t.type === 'missile') projectiles.push({x:t.x, y:t.y, target:target, type:'missile', color:t.color, dmg:t.dmg, spd:4, acc:0.4, aoe:90});
                    else {
                        // Standard Bullet
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

        particles.forEach((p,i) => { p.life--; p.x+=(p.vx||0); p.y+=(p.vy||0); if(p.life<=0) particles.splice(i,1); });
        floatingText.forEach((t,i) => { t.y-=0.5; t.life--; if(t.life<=0) floatingText.splice(i,1); });

        if(state.active && enemies.length===0) { state.active=false; state.wave++; state.money+=400; }
    }

    // --- DAMAGE SYSTEM (TACTICAL) ---
    function takeDamage(e, amt, type) {
        e.shieldRecharge = 120; // Reset recharge timer

        // SHIELD LOGIC (Blue Health)
        if(e.shield > 0) {
            // Energy deals double to shields. Physical deals half.
            let mult = (type === 'energy') ? 2.0 : (type === 'phys') ? 0.5 : 1.0;
            e.shield -= amt * mult;
            if(e.shield < 0) {
                // Bleed through damage
                e.hp += e.shield; 
                e.shield = 0;
                particles.push({type:'burst', x:e.x, y:e.y, color:'#0088ff', life:10});
            } else {
                particles.push({type:'spark', x:e.x, y:e.y, color:'#0088ff', life:5});
                return; // Shield absorbed it completely
            }
        }

        // ARMOR LOGIC (Yellow Health - handled via 'armor' flag)
        if(e.armor > 0) {
            // Physical reduced by 50%. Chem/Ex increased by 50%.
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
                ctx.globalAlpha = p.life/30; ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
            } else if (p.type==='missile') {
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x-p.vx*2, p.y-p.vy*2); ctx.strokeStyle=p.color; ctx.stroke();
                ctx.fillRect(p.x-2, p.y-2, 4, 4);
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
                ctx.fillStyle = `rgba(100,100,100,${p.life/10})`; ctx.beginPath(); ctx.arc(p.x,p.y,p.life,0,Math.PI*2); ctx.fill();
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

    // FRACTAL LIGHTNING FOR TESLA
    function drawFractalLightning(ctx, chain, color) {
        if(chain.length<2) return;
        ctx.strokeStyle=color; ctx.lineWidth=2; ctx.shadowColor=color; ctx.shadowBlur=10;
        ctx.beginPath(); ctx.moveTo(chain[0].x, chain[0].y);
        for(let i=1; i<chain.length; i++) {
            let s=chain[i-1], e=chain[i];
            let dist = Math.hypot(e.x-s.x, e.y-s.y);
            let steps = Math.floor(dist/15);
            for(let j=1; j<=steps; j++) {
                let t = j/steps;
                let nx = s.x + (e.x-s.x)*t + (Math.random()-0.5)*20; // Chaos
                let ny = s.y + (e.y-s.y)*t + (Math.random()-0.5)*20;
                ctx.lineTo(nx, ny);
            }
            ctx.lineTo(e.x, e.y);
        }
        ctx.stroke(); ctx.shadowBlur=0;
    }

    function drawTower(ctx, t) {
        ctx.save(); ctx.translate(t.x, t.y);
        
        // Base
        ctx.fillStyle = '#111'; ctx.fillRect(-8,-8,16,16);
        ctx.strokeStyle = t.color; ctx.lineWidth=1; ctx.strokeRect(-8,-8,16,16);
        
        if(selection===t) { ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(0,0,t.rng,0,Math.PI*2); ctx.stroke(); }

        // Drone
        if(t.drone) {
             let dx = Math.cos(t.droneAngle)*25, dy = Math.sin(t.droneAngle)*25;
             ctx.fillStyle = t.color; ctx.beginPath(); ctx.arc(dx, dy, 4, 0, Math.PI*2); ctx.fill();
             ctx.strokeStyle = t.color; ctx.beginPath(); ctx.arc(0,0,25,0,Math.PI*2); ctx.stroke();
        } else {
            ctx.rotate(t.angle);
            let off = t.recoil||0;
            ctx.fillStyle = t.color;

            if(t.type === 'gatling') {
                ctx.fillRect(-3, -8+off, 6, 16); // Gun barrel
                ctx.fillStyle='#444'; ctx.fillRect(-4,-4,8,8); // Pivot
            } else if (t.type === 'cannon') {
                ctx.fillRect(-5, -6+off, 10, 14);
                ctx.fillStyle='#222'; ctx.fillRect(-6,-6,12,6);
            } else if (t.type === 'rail') {
                ctx.fillRect(-2, -10+off, 4, 20); // Long barrel
                ctx.fillStyle='#fff'; ctx.fillRect(-3,-10+off,6,2); // Caps
            } else if (t.type === 'pyro') {
                ctx.fillStyle='#f50'; ctx.fillRect(-4,-4,8,12);
                ctx.fillStyle='#f90'; ctx.beginPath(); ctx.arc(0,8,4,0,Math.PI*2); ctx.fill(); // Tank
            } else {
                ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill();
                if(t.muzzle) { ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(0, 10, 4, 0, Math.PI*2); ctx.fill(); }
            }
        }
        ctx.restore();
        // HP Bar
        if(t.hp < t.maxHp) {
             ctx.fillStyle = 'red'; ctx.fillRect(t.x-8, t.y-12, 16, 2);
             ctx.fillStyle = '#0f0'; ctx.fillRect(t.x-8, t.y-12, 16*(t.hp/t.maxHp), 2);
        }
    }

    function drawEnemy(ctx, e) {
        ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle);
        
        // Shield Halo
        if(e.shield > 0) {
            ctx.strokeStyle = `rgba(0, 136, 255, ${Math.min(1, e.shield/e.maxShield + 0.2)})`;
            ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.stroke();
        }

        ctx.fillStyle = e.color;
        if(e.isBoss) {
            ctx.scale(4, 4); // MASSIVE BOSS
            ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill();
            ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(0,0,14,0,Math.PI*2); ctx.stroke();
            // Core Pulse
            ctx.fillStyle = `rgba(255,0,0,${Math.abs(Math.sin(state.frame*0.1))})`; 
            ctx.beginPath(); ctx.arc(0,0,4,0,Math.PI*2); ctx.fill();
        } else if (e.type === 'tank') {
            ctx.fillRect(-8,-8,16,16); ctx.strokeStyle='#000'; ctx.strokeRect(-8,-8,16,16);
        } else {
            ctx.beginPath(); ctx.moveTo(6,0); ctx.lineTo(-5, 5); ctx.lineTo(-5, -5); ctx.fill();
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
             if(selection && TOWER_TYPES[selection.type]) { // Safety check
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
            } else {
                // If selection is invalid, just clear it to stop crashes
                selection = null;
            }
        },
        getEnemyTypes: () => ENEMY_INFO,
        // Helper to draw enemy on Codex canvas
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
        get state(){return state}, get sel(){return selection}, get buildMode(){return buildMode}
    };
  })();
  window.NeonGame = Neon;
})(window);
