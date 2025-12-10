{
type: uploaded file
fileName: sentinel-grid.js
fullContent:
/* SENTINEL GRID - Corrected & Enhanced */
(function(global){
  const Sentinel = (function(){
    // --- CONSTANTS ---
    const GRID = 40; // Size of grid cells
    let COLS, ROWS;
    
    const COLORS = {
        bg: '#050a05',
        grid: '#112211',
        wall: '#00ffaa',
        enemy: '#ff3366'
    };
    
    const TOWERS = {
      blaster: { name:'BLASTER', cost:50, color:'#00FF99', range:120, dmg:15, rate:30, glow:true },
      sniper:  { name:'SNIPER', cost:150, color:'#00FFFF', range:300, dmg:80, rate:90, glow:true },
      rapid:   { name:'RAPID', cost:120, color:'#FFFF00', range:100, dmg:5, rate:8, glow:true }
    };

    // --- STATE ---
    let canvas, ctx;
    let towers=[], enemies=[], projs=[], particles=[];
    let flowMap = {}; 
    let wave=1, money=350, lives=20, active=false;
    let buildType=null, selected=null;
    
    // Pathfinding
    let start, end;

    function init(c) {
        canvas = c; ctx = c.getContext('2d');
        // Fit grid to canvas size
        COLS = Math.floor(canvas.width / GRID);
        ROWS = Math.floor(canvas.height / GRID);
        start = {x:0, y:Math.floor(ROWS/2)};
        end = {x:COLS-1, y:Math.floor(ROWS/2)};
        reset();
    }

    function reset() {
        towers=[]; enemies=[]; projs=[]; particles=[];
        wave=1; money=350; lives=20; active=false;
        buildType=null; selected=null;
        calcPath();
    }

    function calcPath() {
        // BFS Flood Fill
        let q = [];
        let cameFrom = {};
        
        // Block map
        let blocks = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(0));
        towers.forEach(t => blocks[t.gx][t.gy] = 1);

        q.push(end);
        let endKey = `${end.x},${end.y}`;
        cameFrom[endKey] = null;
        flowMap = {};

        while(q.length > 0) {
            let curr = q.shift();
            let dirs = [[0,1],[0,-1],[1,0],[-1,0]];
            
            for(let d of dirs) {
                let nx = curr.x + d[0];
                let ny = curr.y + d[1];
                let key = `${nx},${ny}`;
                
                if(nx >=0 && nx < COLS && ny >= 0 && ny < ROWS && blocks[nx][ny] === 0) {
                    if(!(key in cameFrom)) {
                        cameFrom[key] = curr;
                        flowMap[key] = {x:curr.x, y:curr.y}; // Vector to next
                        q.push({x:nx, y:ny});
                    }
                }
            }
        }
        // Check if start is reachable
        return (`${start.x},${start.y}` in cameFrom);
    }

    function startWave() {
        if(active) return;
        active = true;
        let count = 6 + wave*2;
        let sent = 0;
        let int = setInterval(() => {
            spawnEnemy();
            sent++;
            if(sent>=count) clearInterval(int);
        }, 800);
    }

    function spawnEnemy() {
        let hp = 30 + (wave*15);
        let type = wave % 5 === 0 ? 'tank' : 'norm';
        if(type === 'tank') hp *= 3;
        
        enemies.push({
            x: start.x*GRID + GRID/2, y: start.y*GRID + GRID/2,
            hp, maxHp: hp, 
            spd: type==='tank'?1.5:2.5,
            color: type==='tank'?'#ff0000':'#ff3366',
            r: type==='tank'?12:8
        });
    }

    function update() {
        if(lives <= 0) return;

        // Enemies
        for(let i=enemies.length-1; i>=0; i--) {
            let e = enemies[i];
            let gx = Math.floor(e.x/GRID);
            let gy = Math.floor(e.y/GRID);
            
            // Flow Movement
            let next = flowMap[`${gx},${gy}`];
            if(next) {
                let tx = next.x*GRID + GRID/2;
                let ty = next.y*GRID + GRID/2;
                let dx = tx - e.x, dy = ty - e.y;
                let dist = Math.hypot(dx,dy);
                
                if(dist < e.spd) { e.x = tx; e.y = ty; }
                else { e.x += (dx/dist)*e.spd; e.y += (dy/dist)*e.spd; }
            } else if (gx === end.x && gy === end.y) {
                enemies.splice(i,1); lives--; continue;
            }

            if(e.hp <= 0) {
                enemies.splice(i,1); money+=15;
                for(let k=0;k<6;k++) particles.push({x:e.x, y:e.y, vx:Math.random()*4-2, vy:Math.random()*4-2, life:20, color:e.color});
            }
        }

        if(active && enemies.length === 0) { active = false; wave++; }

        // Towers
        towers.forEach(t => {
            if(t.cd > 0) t.cd--;
            else {
                let target = enemies.find(e => Math.hypot(e.x-t.x, e.y-t.y) < t.range);
                if(target) {
                    projs.push({x:t.x, y:t.y, tx:target.x, ty:target.y, speed:15, dmg:t.dmg, color:t.color, target:target});
                    t.cd = t.rate;
                }
            }
        });

        // Projs
        for(let i=projs.length-1; i>=0; i--) {
            let p = projs[i];
            if(p.target && enemies.includes(p.target)) {
                let dx = p.target.x - p.x, dy = p.target.y - p.y;
                let d = Math.hypot(dx,dy);
                if(d < p.speed) {
                    p.target.hp -= p.dmg;
                    projs.splice(i,1);
                    particles.push({x:p.x,y:p.y, vx:0, vy:0, life:5, color:p.color});
                } else {
                    p.x += (dx/d)*p.speed;
                    p.y += (dy/d)*p.speed;
                }
            } else projs.splice(i,1);
        }

        // Particles
        for(let i=particles.length-1;i>=0;i--) {
            let p = particles[i];
            p.x+=p.vx; p.y+=p.vy; p.life--;
            if(p.life<=0) particles.splice(i,1);
        }
    }

    function draw(ctx) {
        ctx.fillStyle = COLORS.bg; ctx.fillRect(0,0,canvas.width,canvas.height);

        // Draw Grid
        ctx.strokeStyle = COLORS.grid; ctx.lineWidth = 1;
        ctx.beginPath();
        for(let x=0; x<=canvas.width; x+=GRID) { ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); }
        for(let y=0; y<=canvas.height; y+=GRID) { ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); }
        ctx.stroke();

        // DRAW FLOW MAP (The Path)
        ctx.strokeStyle = 'rgba(0,255,100,0.15)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for(let key in flowMap) {
            let [gx, gy] = key.split(',').map(Number);
            let next = flowMap[key];
            let cx = gx*GRID + GRID/2;
            let cy = gy*GRID + GRID/2;
            let nx = next.x*GRID + GRID/2;
            let ny = next.y*GRID + GRID/2;
            ctx.moveTo(cx, cy); ctx.lineTo(nx, ny);
            // Draw small dot
            ctx.fillStyle = 'rgba(0,255,100,0.1)'; ctx.fillRect(gx*GRID+2, gy*GRID+2, GRID-4, GRID-4);
        }
        ctx.stroke();

        // Start/End
        ctx.fillStyle = '#0f0'; ctx.fillRect(start.x*GRID, start.y*GRID, GRID, GRID);
        ctx.fillStyle = '#f00'; ctx.fillRect(end.x*GRID, end.y*GRID, GRID, GRID);

        // Towers
        towers.forEach(t => {
            ctx.shadowBlur = 10; ctx.shadowColor = t.color;
            ctx.fillStyle = t.color; ctx.fillRect(t.x-15, t.y-15, 30, 30);
            ctx.shadowBlur = 0;
            // Level Badge
            ctx.fillStyle = '#000'; ctx.font='10px Arial'; ctx.fillText(t.level, t.x-3, t.y+3);
            
            if(selected===t) {
                ctx.strokeStyle='#fff'; ctx.strokeRect(t.x-18, t.y-18, 36, 36);
                ctx.beginPath(); ctx.arc(t.x,t.y,t.range,0,Math.PI*2); ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.stroke();
            }
        });

        // Enemies
        enemies.forEach(e => {
            ctx.fillStyle = e.color;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI*2); ctx.fill();
            // HP
            ctx.fillStyle = 'red'; ctx.fillRect(e.x-10, e.y-15, 20, 3);
            ctx.fillStyle = '#0f0'; ctx.fillRect(e.x-10, e.y-15, 20*(e.hp/e.maxHp), 3);
        });

        // Projs
        projs.forEach(p => { ctx.fillStyle = p.color; ctx.fillRect(p.x-3,p.y-3,6,6); });
        
        // Particles
        particles.forEach(p => { ctx.fillStyle = p.color; ctx.fillRect(p.x,p.y,2,2); });
    }

    function click(x, y) {
        let gx = Math.floor(x/GRID);
        let gy = Math.floor(y/GRID);
        if(gx<0||gx>=COLS||gy<0||gy>=ROWS) return;

        let existing = towers.find(t=>t.gx===gx && t.gy===gy);
        if(existing) { selected = existing; buildType=null; return; }

        if(buildType && money >= TOWERS[buildType].cost) {
            let def = TOWERS[buildType];
            let t = {gx, gy, x:gx*GRID+GRID/2, y:gy*GRID+GRID/2, ...def, level:1, cd:0};
            towers.push(t);
            if(calcPath()) {
                money -= def.cost;
                for(let i=0;i<10;i++) particles.push({x:t.x,y:t.y,vx:Math.random()*4-2,vy:Math.random()*4-2,life:20,color:'#fff'});
            } else {
                towers.pop(); calcPath(); // Undo
            }
        }
        selected = null;
    }

    return {
        init, update, draw, click, startWave, 
        setBuild: (k)=>{buildType=k; selected=null;}, 
        upgrade: ()=>{ if(selected && money>=selected.cost*0.8){money-=Math.floor(selected.cost*0.8); selected.level++; selected.dmg*=1.3;}}, 
        sell: ()=>{ if(selected){ money+=Math.floor(selected.cost*0.5); towers=towers.filter(t=>t!==selected); selected=null; calcPath();} },
        stop: ()=>{}, 
        conf: {towers: TOWERS},
        // EXPOSE PROPERTIES CORRECTLY
        get wave(){return wave}, get money(){return money}, get lives(){return lives}, 
        get sel(){return selected}, get buildMode(){return buildType}
    };
  })();
  window.SentinelGame = Sentinel;
})(window);
}
