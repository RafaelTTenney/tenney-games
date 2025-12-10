/* NEON CITADEL - Flagship Edition */
(function(global){
  const Neon = (function(){
    
    // CONFIG: High Density Grid
    const CELL = 25; // Good balance for 1200px width
    let COLS, ROWS;
    
    const TOWER_TYPES = {
        'gatling': { name:'VULCAN', cost:150, color:'#ff00ff', dmg:5, rng:150, rate:5, hp:200 },
        'cannon':  { name:'HEAVY',  cost:400, color:'#00ffff', dmg:120, rng:240, rate:60, hp:600, aoe:60 },
        'tesla':   { name:'TESLA',  cost:600, color:'#ffff00', dmg:20, rng:140, rate:30, hp:400, chain:true },
        'buffer':  { name:'AEGIS',  cost:500, color:'#00ff00', dmg:0, rng:100, rate:0, hp:1200, buff:true }
    };

    // State
    let canvas, ctx;
    let grid=[], towers=[], enemies=[], projectiles=[], particles=[], floatingText=[];
    let costMap=[], weightMap=[];
    let state = { wave:1, money:1200, lives:50, active:false, frame:0 };
    let selection=null, buildMode=null, boss=null;
    let startNode, endNode;

    function init(c) {
        canvas = c; ctx = c.getContext('2d');
        // Dynamic Grid Calculation
        COLS = Math.ceil(canvas.width / CELL);
        ROWS = Math.ceil(canvas.height / CELL);
        
        startNode = {x:0, y:Math.floor(ROWS/2)};
        endNode = {x:COLS-1, y:Math.floor(ROWS/2)};
        
        reset();
    }

    function reset() {
        state = { wave:1, money:1200, lives:50, active:false, frame:0 };
        towers=[]; enemies=[]; projectiles=[]; particles=[]; floatingText=[];
        grid = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(null));
        recalcPath();
    }

    // --- AI: Dijkstra Flow Field ---
    function recalcPath() {
        // Init maps
        costMap = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(999999));
        weightMap = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(1));
        
        // 1. Calculate Weights (Danger Zones)
        towers.forEach(t => {
            // Occupied Cells
            grid[t.gx][t.gy] = t;
            // Danger Radius adds weight (Enemies prefer avoiding heavy fire)
            let r = Math.ceil(t.rng/CELL);
            for(let xx=-r; xx<=r; xx++) {
                for(let yy=-r; yy<=r; yy++) {
                    let tx=t.gx+xx, ty=t.gy+yy;
                    if(tx>=0 && tx<COLS && ty>=0 && ty<ROWS) weightMap[tx][ty] += 4;
                }
            }
        });

        // 2. Flood Fill from End
        let q = [];
        costMap[endNode.x][endNode.y] = 0;
        q.push(endNode);

        while(q.length) {
            let u = q.shift();
            // Check Neighbors
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(d => {
                let nx = u.x + d[0], ny = u.y + d[1];
                if(nx>=0 && nx<COLS && ny>=0 && ny<ROWS) {
                    // Cost = Current + 1 + Weight + (Tower? Infinity unless Breaker)
                    let isTower = (grid[nx][ny] !== null);
                    let moveCost = weightMap[nx][ny];
                    if(isTower) moveCost += 1000; // Soft block, AI tries to go around

                    if(costMap[nx][ny] > costMap[u.x][u.y] + moveCost) {
                        costMap[nx][ny] = costMap[u.x][u.y] + moveCost;
                        q.push({x:nx, y:ny});
                        // Optimization: Simple Sort for priority
                        q.sort((a,b) => costMap[a.x][a.y] - costMap[b.x][b.y]);
                    }
                }
            });
        }
    }

    function getNextMove(gx, gy, type) {
        let best = { val: 999999, dir: null };
        let moves = [{x:0,y:1}, {x:0,y:-1}, {x:1,y:0}, {x:-1,y:0}];
        
        moves.forEach(d => {
            let nx=gx+d.x, ny=gy+d.y;
            if(nx>=0 && nx<COLS && ny>=0 && ny<ROWS) {
                let cost = costMap[nx][ny];
                let tower = grid[nx][ny];

                // "Breaker" Logic: If cost is huge (meaning path blocked or long detour), attack wall
                if(tower && type === 'breaker') {
                   // If adjacent is tower, return special 'attack' command
                   best = { val: -1, dir: 'attack' }; 
                } 
                else if (cost < best.val) {
                    best = { val: cost, dir: {x:nx, y:ny} };
                }
            }
        });

        if(best.dir === 'attack') return 'attack';
        return best.dir;
    }

    // --- GAME LOOP ---
    function startWave() {
        if(state.active) return;
        state.active = true;
        let count = 10 + Math.floor(state.wave * 2.5);
        let sent = 0;
        let int = setInterval(() => {
            // Dynamic Spawning
            let r = Math.random();
            let type = 'norm';
            if(state.wave > 2 && r > 0.7) type = 'breaker';
            if(state.wave > 4 && r > 0.85) type = 'fast';
            if(state.wave > 6 && r > 0.92) type = 'heavy';
            
            spawnEnemy(type);
            sent++;
            if(sent >= count) {
                clearInterval(int);
                if(state.wave % 5 === 0) spawnEnemy('boss');
            }
        }, Math.max(200, 800 - state.wave*20));
    }

    function spawnEnemy(type) {
        let mult = 1 + (state.wave * 0.2);
        let hp = 60 * mult;
        let spd = 1.5;
        let color = '#ff00ff';
        let isBoss = false;

        if(type==='breaker') { color='#ff8800'; hp*=1.2; spd=1.0; } // Orange
        if(type==='fast') { color='#ffff00'; hp*=0.6; spd=2.8; }    // Yellow
        if(type==='heavy') { color='#00ffaa'; hp*=4.0; spd=0.7; }   // Cyan
        if(type==='boss') { color='#ff0000'; hp*=25.0; spd=0.6; isBoss=true; }

        let e = {
            x: 0, y: (Math.floor(ROWS/2) * CELL) + CELL/2,
            hp, maxHp: hp, spd, color, type, isBoss,
            val: isBoss?500:25, angle:0
        };
        enemies.push(e);
        if(isBoss) boss = e;
    }

    function update() {
        if(state.lives <= 0) return;
        state.frame++;

        // Enemies
        for(let i=enemies.length-1; i>=0; i--) {
            let e = enemies[i];
            let gx = Math.floor(e.x/CELL);
            let gy = Math.floor(e.y/CELL);

            // Reached End
            if(gx === COLS-1) {
                state.lives -= (e.isBoss ? 20 : 1);
                enemies.splice(i,1);
                continue;
            }

            // Move Logic
            let move = getNextMove(gx, gy, e.type);

            if(move === 'attack') {
                // Find adjacent tower
                let moves = [{x:0,y:1}, {x:0,y:-1}, {x:1,y:0}, {x:-1,y:0}];
                moves.forEach(d => {
                    let t = grid[gx+d.x]?.[gy+d.y];
                    if(t && state.frame % 20 === 0) {
                        t.hp -= 20; // Attack Damage
                        addPart(t.x, t.y, '#f00', 2);
                        if(t.hp <= 0) destroyTower(t);
                    }
                });
            } else if (move) {
                let tx = move.x*CELL + CELL/2;
                let ty = move.y*CELL + CELL/2;
                let ang = Math.atan2(ty - e.y, tx - e.x);
                e.x += Math.cos(ang) * e.spd;
                e.y += Math.sin(ang) * e.spd;
                e.angle += 0.1;
            }

            // Death
            if(e.hp <= 0) {
                state.money += e.val;
                addText(e.x, e.y, `+$${e.val}`, '#fff');
                addPart(e.x, e.y, e.color, e.isBoss ? 50 : 15);
                if(e.isBoss) boss = null;
                enemies.splice(i,1);
            }
        }

        // Wave End Check
        if(state.active && enemies.length === 0) {
            state.active = false;
            state.wave++;
        }

        // Towers
        towers.forEach(t => {
            if(t.cd > 0) t.cd--;
            else {
                // Find Target
                let target = enemies.find(e => (e.x-t.x)**2 + (e.y-t.y)**2 < t.rng**2);
                if(target) {
                    if(t.type === 'tesla') {
                        // Chain Lightning
                        let chain = [target];
                        let curr = target;
                        curr.hp -= t.dmg;
                        let maxChain = t.attrLevels.special ? 5 : 3;
                        for(let k=0; k<maxChain; k++) {
                            let next = enemies.find(e => !chain.includes(e) && (e.x-curr.x)**2 + (e.y-curr.y)**2 < 100**2);
                            if(next) { chain.push(next); next.hp -= t.dmg*0.7; curr=next; }
                        }
                        particles.push({type:'lightning', chain, color:t.color, life:6});
                    } else {
                        projectiles.push({
                            x:t.x, y:t.y, target, 
                            type: t.type, dmg:t.dmg, aoe:t.aoe, 
                            color:t.color, speed: 12
                        });
                    }
                    t.cd = t.rate;
                }
            }
        });

        // Projectiles
        for(let i=projectiles.length-1; i>=0; i--) {
            let p = projectiles[i];
            if(!p.target) { projectiles.splice(i,1); continue; }
            let dx = p.target.x - p.x, dy = p.target.y - p.y;
            let d = Math.hypot(dx,dy);
            
            if(d < p.speed) {
                if(p.aoe) {
                    enemies.forEach(e => {
                        if((e.x-p.target.x)**2 + (e.y-p.target.y)**2 < p.aoe**2) e.hp -= p.dmg;
                    });
                    addPart(p.target.x, p.target.y, 'orange', 10);
                } else {
                    p.target.hp -= p.dmg;
                }
                projectiles.splice(i,1);
            } else {
                p.x += (dx/d)*p.speed;
                p.y += (dy/d)*p.speed;
            }
        }

        // Particles
        for(let i=particles.length-1; i>=0; i--) {
            let p = particles[i];
            p.life--;
            if(p.type !== 'lightning') { p.x += p.vx; p.y += p.vy; }
            if(p.life<=0) particles.splice(i,1);
        }

        // Floating Text
        for(let i=floatingText.length-1; i>=0; i--) {
            let t = floatingText[i];
            t.y -= 0.5; t.life--;
            if(t.life<=0) floatingText.splice(i,1);
        }
    }

    function destroyTower(t) {
        grid[t.gx][t.gy] = null;
        towers = towers.filter(tw => tw !== t);
        if(selection === t) selection = null;
        recalcPath();
        addPart(t.x, t.y, '#fff', 20);
    }

    // --- RENDER ---
    function draw(ctx) {
        // BG
        ctx.fillStyle = '#020205'; ctx.fillRect(0,0,canvas.width,canvas.height);
        
        // Render Flow Field (Subtle Debug Look)
        if(buildMode) {
            ctx.fillStyle = 'rgba(255,255,255,0.02)';
            for(let x=0; x<COLS; x+=2) {
                for(let y=0; y<ROWS; y+=2) {
                    if(costMap[x][y] < 999) ctx.fillRect(x*CELL, y*CELL, CELL, CELL);
                }
            }
        }

        // High Quality Glow
        ctx.shadowBlur = 10;

        // Towers
        towers.forEach(t => {
            ctx.shadowColor = t.color;
            ctx.fillStyle = t.color;
            ctx.fillRect(t.x-CELL/2 + 2, t.y-CELL/2 + 2, CELL-4, CELL-4);
            
            // HP Bar
            if(t.hp < t.maxHp) {
                ctx.fillStyle = 'red'; ctx.fillRect(t.x-10, t.y-12, 20, 3);
                ctx.fillStyle = '#0f0'; ctx.fillRect(t.x-10, t.y-12, 20*(t.hp/t.maxHp), 3);
            }
            // Selection
            if(selection === t) {
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.arc(t.x,t.y,t.rng,0,Math.PI*2); ctx.stroke();
            }
        });

        // Enemies
        enemies.forEach(e => {
            ctx.shadowColor = e.color;
            ctx.fillStyle = e.color;
            ctx.save(); ctx.translate(e.x, e.y);
            
            // Unique Geometry
            if(e.type === 'breaker') {
                ctx.rotate(state.frame * 0.2);
                ctx.fillRect(-8,-8, 16, 16);
            } else if (e.isBoss) {
                let s = 1.5 + Math.sin(state.frame*0.1)*0.2;
                ctx.scale(s, s);
                ctx.beginPath(); ctx.arc(0,0,12,0,Math.PI*2); ctx.fill();
            } else if (e.type === 'fast') {
                ctx.rotate(e.angle);
                ctx.beginPath(); ctx.moveTo(10,0); ctx.lineTo(-6, 5); ctx.lineTo(-6, -5); ctx.fill();
            } else {
                ctx.beginPath(); ctx.arc(0,0,6,0,Math.PI*2); ctx.fill();
            }
            ctx.restore();
        });

        // Projs
        projectiles.forEach(p => {
            ctx.shadowColor = p.color; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
        });

        // Particles
        particles.forEach(p => {
            if(p.type === 'lightning') {
                ctx.shadowColor = p.color; ctx.strokeStyle = p.color; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(p.chain[0].x, p.chain[0].y);
                for(let i=1;i<p.chain.length;i++) ctx.lineTo(p.chain[i].x, p.chain[i].y);
                ctx.stroke();
            } else {
                ctx.globalAlpha = p.life/20; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 2, 2);
            }
            ctx.globalAlpha = 1;
        });

        ctx.shadowBlur = 0;
        
        // Text
        ctx.font = '12px monospace';
        floatingText.forEach(t => {
            ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
        });

        // Boss Bar
        if(boss) {
            let w = canvas.width/2;
            ctx.fillStyle = '#400'; ctx.fillRect(w-200, 40, 400, 20);
            ctx.fillStyle = '#f00'; ctx.fillRect(w-200, 40, 400*(boss.hp/boss.maxHp), 20);
            ctx.fillStyle = '#fff'; ctx.fillText("BOSS THREAT", w-40, 55);
        }
    }

    function click(x, y) {
        let gx = Math.floor(x/CELL);
        let gy = Math.floor(y/CELL);
        if(gx<0||gx>=COLS||gy<0||gy>=ROWS) return;

        let t = grid[gx][gy];
        if(t) { selection = t; buildMode = null; return; }

        if(buildMode) {
            let def = TOWER_TYPES[buildMode];
            let cost = def.cost * (state.active ? 1.5 : 1);
            if(state.money >= cost) {
                let newT = {
                    gx, gy, x:gx*CELL+CELL/2, y:gy*CELL+CELL/2,
                    ...def, maxHp:def.hp, cd:0, attrLevels:{dmg:0,rng:0,rate:0}
                };
                grid[gx][gy] = newT;
                towers.push(newT);
                state.money -= cost;
                addPart(newT.x, newT.y, '#fff', 15);
                recalcPath();
            } else {
                addText(x, y, "NO CREDITS", 'red');
            }
        }
        selection = null;
    }

    function addPart(x,y,c,n) { for(let i=0;i<n;i++) particles.push({x,y,color:c,vx:Math.random()*6-3,vy:Math.random()*6-3,life:20+Math.random()*10}); }
    function addText(x,y,t,c) { floatingText.push({x,y,text:t,color:c,life:40}); }

    return {
        init, update, draw, click, startWave, 
        setBuild: (k)=>{buildMode=k; selection=null;},
        upgrade: (attr)=>{
            if(!selection) return;
            let base = TOWER_TYPES[selection.type].cost;
            let cost = Math.floor(base * 0.5 * ((selection.attrLevels[attr]||0)+1));
            if(state.money >= cost) {
                state.money -= cost;
                selection.attrLevels[attr]++;
                if(attr==='dmg') selection.dmg *= 1.3;
                if(attr==='rng') selection.rng *= 1.15;
                if(attr==='rate') selection.rate *= 0.9;
                recalcPath();
            }
        },
        sell: ()=>{ if(selection){ state.money+=Math.floor(TOWER_TYPES[selection.type].cost*0.5); destroyTower(selection); }},
        stop: ()=>{},
        conf: {towers: TOWER_TYPES},
        get state(){return state}, get sel(){return selection}, get buildMode(){return buildMode}
    };
  })();
  window.NeonGame = Neon;
})(window);
