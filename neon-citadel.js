{
type: uploaded file
fileName: neon-citadel.js
fullContent:
/* NEON CITADEL - Flagship | Corrected & Polished */
(function(global){
  const Neon = (function(){
    
    // Config
    const CELL = 30; // Grid Size
    let COLS, ROWS;
    
    const TOWER_TYPES = {
        'gatling': { name:'VULCAN', cost:150, color:'#ff00ff', dmg:6, rng:150, rate:5, hp:200 },
        'cannon':  { name:'HEAVY',  cost:400, color:'#00ffff', dmg:100, rng:200, rate:60, hp:500, aoe:50 },
        'tesla':   { name:'TESLA',  cost:550, color:'#ffff00', dmg:18, rng:120, rate:30, hp:350, chain:true },
        'buffer':  { name:'AEGIS',  cost:450, color:'#00ff00', dmg:0, rng:90, rate:0, hp:1000, buff:true }
    };

    // State
    let canvas, ctx;
    let grid=[], towers=[], enemies=[], projectiles=[], particles=[], floatingText=[];
    let costMap=[]; // Dijkstra Flow Field
    let state = { wave:1, money:800, lives:50, active:false, frame:0 };
    let selection=null, buildMode=null, boss=null;

    function init(c) {
        canvas = c; ctx = c.getContext('2d');
        COLS = Math.floor(canvas.width / CELL);
        ROWS = Math.floor(canvas.height / CELL);
        reset();
    }

    function reset() {
        state = { wave:1, money:800, lives:50, active:false, frame:0 };
        towers=[]; enemies=[]; projectiles=[]; particles=[]; floatingText=[];
        grid = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(null));
        recalcPath();
    }

    // --- AI ---
    function recalcPath() {
        // Dijkstra Map
        let map = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(99999));
        let weights = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(1));
        
        // Towers add weight (Danger zones)
        towers.forEach(t => {
            let cx = t.gx, cy = t.gy;
            let r = Math.ceil(t.rng/CELL);
            for(let xx=-r; xx<=r; xx++) {
                for(let yy=-r; yy<=r; yy++) {
                    let tx=cx+xx, ty=cy+yy;
                    if(tx>=0 && tx<COLS && ty>=0 && ty<ROWS) weights[tx][ty] += 5; // Danger
                }
            }
            grid[t.gx][t.gy] = t; // Occupied
        });

        let q = [];
        let target = {x:COLS-1, y:Math.floor(ROWS/2)};
        map[target.x][target.y] = 0;
        q.push(target);

        while(q.length) {
            let u = q.shift();
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(d => {
                let nx = u.x + d[0], ny = u.y + d[1];
                if(nx>=0 && nx<COLS && ny>=0 && ny<ROWS && !grid[nx][ny]) {
                    let alt = map[u.x][u.y] + weights[nx][ny];
                    if(alt < map[nx][ny]) {
                        map[nx][ny] = alt;
                        q.push({x:nx, y:ny});
                        // Simple sort for Priority Queue simulation
                        q.sort((a,b) => map[a.x][a.y] - map[b.x][b.y]);
                    }
                }
            });
        }
        costMap = map;
    }

    function getNextMove(gx, gy, type) {
        // Breakers attack towers if stuck
        let bestVal = 99999;
        let bestMove = null;

        [[0,1],[0,-1],[1,0],[-1,0]].forEach(d => {
            let nx=gx+d[0], ny=gy+d[1];
            if(nx>=0 && nx<COLS && ny>=0 && ny<ROWS) {
                // If blocked by tower
                if(grid[nx][ny]) {
                    if(type === 'breaker') return 'attack'; 
                } else {
                    if(costMap[nx][ny] < bestVal) {
                        bestVal = costMap[nx][ny];
                        bestMove = {x:nx, y:ny};
                    }
                }
            }
        });
        return bestMove;
    }

    function startWave() {
        if(state.active) return;
        state.active = true;
        let count = 8 + state.wave*2;
        let sent = 0;
        let int = setInterval(() => {
            let type = 'norm';
            if(state.wave > 2 && Math.random()>0.7) type = 'breaker';
            if(state.wave > 4 && Math.random()>0.8) type = 'fast';
            spawnEnemy(type);
            sent++;
            if(sent>=count) {
                clearInterval(int);
                if(state.wave % 5 === 0) spawnEnemy('boss');
            }
        }, 600);
    }

    function spawnEnemy(type) {
        let hp = 50 * (1 + state.wave*0.2);
        let spd = 1.5;
        let color = '#f0f';
        let isBoss = false;

        if(type==='breaker') { color='#ff8800'; hp*=1.5; spd=1.0; }
        if(type==='fast') { color='#ffff00'; hp*=0.6; spd=2.5; }
        if(type==='boss') { color='#ff0000'; hp*=15; spd=0.8; isBoss=true; }

        let e = {
            x:0, y:Math.floor(ROWS/2)*CELL + CELL/2,
            hp, maxHp:hp, spd, color, type, isBoss, 
            val:20
        };
        enemies.push(e);
        if(isBoss) boss = e;
    }

    function update() {
        if(state.lives<=0) return;
        state.frame++;

        // Enemies
        for(let i=enemies.length-1; i>=0; i--) {
            let e = enemies[i];
            let gx = Math.floor(e.x/CELL);
            let gy = Math.floor(e.y/CELL);

            if(gx === COLS-1) { enemies.splice(i,1); state.lives--; continue; }

            let move = getNextMove(gx, gy, e.type);
            
            if(move === 'attack') {
                if(state.frame % 30 === 0) {
                    // Attack nearest tower
                    [[0,1],[0,-1],[1,0],[-1,0]].forEach(d => {
                        let t = grid[gx+d[0]]?.[gy+d[1]];
                        if(t) {
                            t.hp -= 10;
                            addPart(t.x, t.y, '#f00', 3);
                            if(t.hp<=0) destroyTower(t);
                        }
                    });
                }
            } else if(move && move.x !== undefined) {
                let tx = move.x*CELL + CELL/2;
                let ty = move.y*CELL + CELL/2;
                let angle = Math.atan2(ty-e.y, tx-e.x);
                e.x += Math.cos(angle)*e.spd;
                e.y += Math.sin(angle)*e.spd;
            }

            if(e.hp <= 0) {
                state.money += e.val;
                addText(e.x, e.y, `+$${e.val}`, '#ff0');
                addPart(e.x, e.y, e.color, 15);
                if(e.isBoss) boss = null;
                enemies.splice(i,1);
            }
        }
        
        if(state.active && enemies.length===0) { state.active=false; state.wave++; }

        // Towers
        towers.forEach(t => {
            if(t.cd > 0) t.cd--;
            else {
                let target = enemies.find(e => (e.x-t.x)**2 + (e.y-t.y)**2 < t.rng**2);
                if(target) {
                    if(t.type === 'tesla') {
                        // Chain
                        let curr = target;
                        let chain = [curr];
                        curr.hp -= t.dmg;
                        for(let k=0; k<3; k++) {
                            let next = enemies.find(e => !chain.includes(e) && (e.x-curr.x)**2 + (e.y-curr.y)**2 < 100**2);
                            if(next) { chain.push(next); next.hp -= t.dmg*0.8; curr=next; }
                        }
                        particles.push({type:'lightning', chain, color:t.color, life:5});
                    } else {
                        projectiles.push({x:t.x, y:t.y, tx:target.x, ty:target.y, speed:12, dmg:t.dmg, aoe:t.aoe, color:t.color, target});
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
                    enemies.forEach(e => { if((e.x-p.target.x)**2+(e.y-p.target.y)**2 < p.aoe**2) e.hp-=p.dmg; });
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
            if(p.type !== 'lightning') { p.x+=p.vx; p.y+=p.vy; }
            if(p.life<=0) particles.splice(i,1);
        }
        
        // Text
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
    }

    function draw(ctx) {
        ctx.fillStyle = '#020205'; ctx.fillRect(0,0,canvas.width,canvas.height);
        
        // High Fidelity Glow
        ctx.shadowBlur = 15;
        
        // Towers
        towers.forEach(t => {
            ctx.shadowColor = t.color;
            ctx.fillStyle = t.color;
            ctx.fillRect(t.x-12, t.y-12, 24, 24);
            
            // HP Bar (if damaged)
            if(t.hp < t.maxHp) {
                ctx.fillStyle = 'red'; ctx.fillRect(t.x-12, t.y-18, 24, 3);
                ctx.fillStyle = '#0f0'; ctx.fillRect(t.x-12, t.y-18, 24*(t.hp/t.maxHp), 3);
            }
            if(selected === t) {
                ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.strokeRect(t.x-14, t.y-14, 28, 28);
                ctx.beginPath(); ctx.arc(t.x,t.y,t.rng,0,Math.PI*2); ctx.strokeStyle='rgba(255,255,255,0.2)'; ctx.stroke();
            }
        });

        // Enemies
        enemies.forEach(e => {
            ctx.shadowColor = e.color;
            ctx.fillStyle = e.color;
            ctx.save(); ctx.translate(e.x, e.y);
            if(e.type==='breaker') { ctx.rotate(state.frame*0.1); ctx.fillRect(-8,-8,16,16); }
            else if(e.isBoss) { ctx.scale(2,2); ctx.beginPath(); ctx.arc(0,0,10,0,Math.PI*2); ctx.fill(); }
            else { ctx.beginPath(); ctx.moveTo(8,0); ctx.lineTo(-6,6); ctx.lineTo(-6,-6); ctx.fill(); }
            ctx.restore();
        });

        // Projectiles
        projectiles.forEach(p => {
            ctx.shadowColor = p.color; ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill();
        });

        // Particles
        particles.forEach(p => {
            if(p.type === 'lightning') {
                ctx.shadowColor = p.color; ctx.strokeStyle = p.color; ctx.lineWidth=2;
                ctx.beginPath(); ctx.moveTo(p.chain[0].x, p.chain[0].y);
                for(let i=1; i<p.chain.length; i++) ctx.lineTo(p.chain[i].x, p.chain[i].y);
                ctx.stroke();
            } else {
                ctx.globalAlpha = p.life/15; ctx.fillStyle = p.color; ctx.fillRect(p.x,p.y,2,2);
            }
            ctx.globalAlpha = 1;
        });
        
        ctx.shadowBlur = 0; // Reset

        // Floating Text
        ctx.font = '12px monospace';
        floatingText.forEach(t => {
            ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
        });

        // Boss Bar
        if(boss) {
            ctx.fillStyle = '#400'; ctx.fillRect(300, 30, 600, 20);
            ctx.fillStyle = '#f00'; ctx.fillRect(300, 30, 600*(boss.hp/boss.maxHp), 20);
            ctx.fillStyle = '#fff'; ctx.fillText("MEGA BOSS", 580, 45);
        }
    }

    function click(x, y) {
        let gx = Math.floor(x/CELL);
        let gy = Math.floor(y/CELL);
        if(gx<0||gx>=COLS||gy<0||gy>=ROWS) return;

        let t = grid[gx][gy];
        if(t) { selection = t; buildMode = null; return; }

        if(buildMode && state.money >= TOWER_TYPES[buildMode].cost) {
            let def = TOWER_TYPES[buildMode];
            let cost = def.cost;
            if(state.active) cost = Math.floor(cost*1.5); // Building during wave penalty

            if(state.money >= cost) {
                let newT = {
                    gx, gy, x:gx*CELL+CELL/2, y:gy*CELL+CELL/2,
                    ...def, maxHp:def.hp, cd:0, attrLevels:{dmg:0,rng:0,rate:0}
                };
                grid[gx][gy] = newT;
                towers.push(newT);
                state.money -= cost;
                recalcPath();
                addPart(newT.x, newT.y, '#fff', 10);
            } else {
                addText(x, y, "NO FUNDS", 'red');
            }
        }
        selection = null;
    }

    // Utils
    function addPart(x,y,c,n) { for(let i=0;i<n;i++) particles.push({x,y,color:c,vx:Math.random()*4-2,vy:Math.random()*4-2,life:20}); }
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
                if(attr==='dmg') selection.dmg *= 1.4;
                if(attr==='rng') selection.rng *= 1.2;
                if(attr==='rate') selection.rate *= 0.85;
                recalcPath(); // threat changed
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
}
