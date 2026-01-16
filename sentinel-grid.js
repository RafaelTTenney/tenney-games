import { getHighScore, submitHighScore } from './score-store.js';

/* SENTINEL GRID */
(function(global){
  const Sentinel = (function(){
    const GRID = 40; 
    const TOWERS = {
      blaster: { name:'BLASTER', cost:50, color:'#00FF99', range:120, dmg:15, rate:30 },
      sniper:  { name:'SNIPER', cost:150, color:'#00FFFF', range:300, dmg:80, rate:90 },
      rapid:   { name:'RAPID', cost:120, color:'#FFFF00', range:100, dmg:5, rate:8 }
    };

    let canvas, ctx, COLS, ROWS;
    let towers=[], enemies=[], projs=[], particles=[], flowMap={};
    const GAME_ID = 'tower-sentinel';
    let wave=1, money=350, lives=20, active=false;
    let bestWave = 0;
    let submitted = false;
    let buildType=null, selected=null;
    let start, end;

    function init(c) {
        canvas = c; ctx = c.getContext('2d');
        COLS = Math.floor(canvas.width / GRID);
        ROWS = Math.floor(canvas.height / GRID);
        start = {x:0, y:Math.floor(ROWS/2)};
        end = {x:COLS-1, y:Math.floor(ROWS/2)};
        reset();
    }

    async function loadBestWave() {
        bestWave = await getHighScore(GAME_ID);
    }

    async function submitBestWave() {
        if (submitted) return;
        submitted = true;
        const saved = await submitHighScore(GAME_ID, wave);
        if (typeof saved === 'number') bestWave = saved;
    }

    function reset() {
        towers=[]; enemies=[]; projs=[]; particles=[];
        wave=1; money=350; lives=20; active=false;
        submitted = false;
        calcPath();
        loadBestWave();
    }

    function calcPath() {
        let q = [end], cameFrom = {};
        cameFrom[`${end.x},${end.y}`] = null;
        let blocks = new Array(COLS).fill(0).map(()=>new Array(ROWS).fill(0));
        towers.forEach(t => blocks[t.gx][t.gy] = 1);
        flowMap = {};

        while(q.length > 0) {
            let curr = q.shift();
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(d => {
                let nx = curr.x + d[0], ny = curr.y + d[1];
                let key = `${nx},${ny}`;
                if(nx>=0 && nx<COLS && ny>=0 && ny<ROWS && !blocks[nx][ny] && !(key in cameFrom)) {
                    cameFrom[key] = curr;
                    flowMap[key] = {x:curr.x, y:curr.y};
                    q.push({x:nx, y:ny});
                }
            });
        }
        return (`${start.x},${start.y}` in cameFrom);
    }

    function startWave() {
        if(active) return;
        active = true;
        let count = 6 + wave*2;
        let sent = 0;
        let int = setInterval(() => {
            enemies.push({
                x: start.x*GRID+GRID/2, y: start.y*GRID+GRID/2,
                hp: 30 + wave*10, maxHp: 30 + wave*10, spd: 2.5,
                color: '#ff3366', r: 8
            });
            sent++;
            if(sent>=count) clearInterval(int);
        }, 800);
    }

    function update() {
        if(lives <= 0) {
            submitBestWave();
            return;
        }
        for(let i=enemies.length-1; i>=0; i--) {
            let e = enemies[i];
            let gx = Math.floor(e.x/GRID), gy = Math.floor(e.y/GRID);
            if (gx < 0 || gx >= COLS || gy < 0 || gy >= ROWS) {
                enemies.splice(i,1);
                lives--;
                continue;
            }
            let next = flowMap[`${gx},${gy}`];
            if(next) {
                let tx = next.x*GRID+GRID/2, ty = next.y*GRID+GRID/2;
                let dx = tx-e.x, dy = ty-e.y, d = Math.hypot(dx,dy);
                if(d < e.spd) { e.x=tx; e.y=ty; }
                else { e.x+=(dx/d)*e.spd; e.y+=(dy/d)*e.spd; }
            } else if (gx===end.x && gy===end.y) {
                enemies.splice(i,1); lives--; continue;
            }
            if (e.x < -10 || e.x > canvas.width + 10 || e.y < -10 || e.y > canvas.height + 10) {
                enemies.splice(i,1);
                lives--;
                continue;
            }
            if(e.hp<=0) { enemies.splice(i,1); money+=15; }
        }
        if(active && enemies.length===0) { active=false; wave++; if (wave > bestWave) bestWave = wave; }
        
        towers.forEach(t => {
            if(t.cd>0) t.cd--;
            else {
                let target = enemies.find(e => Math.hypot(e.x-t.x, e.y-t.y) < t.range);
                if(target) {
                    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
                    projs.push({x:t.x, y:t.y, tx:target.x, ty:target.y, speed:15, dmg:t.dmg, color:t.color});
                    t.cd = t.rate;
                }
            }
        });

        for(let i=projs.length-1; i>=0; i--) {
            let p = projs[i];
            let dx = p.tx-p.x, dy = p.ty-p.y, d = Math.hypot(dx,dy);
            if(d < p.speed) {
                let hit = enemies.find(e => Math.hypot(e.x-p.tx, e.y-p.ty) < 20);
                if(hit) {
                    hit.hp -= p.dmg;
                    for(let k=0;k<6;k++) {
                        particles.push({x:p.tx, y:p.ty, vx:(Math.random()-0.5)*4, vy:(Math.random()-0.5)*4, life:18, color:p.color});
                    }
                }
                projs.splice(i,1);
            } else { p.x += (dx/d)*p.speed; p.y += (dy/d)*p.speed; }
        }

        for(let i=particles.length-1; i>=0; i--) {
            let p = particles[i];
            p.life--;
            p.x += p.vx; p.y += p.vy;
            if(p.life<=0) particles.splice(i,1);
        }
    }

    function draw(ctx) {
        const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        bg.addColorStop(0, '#050a05');
        bg.addColorStop(1, '#04090c');
        ctx.fillStyle = bg;
        ctx.fillRect(0,0,canvas.width,canvas.height);

        ctx.strokeStyle = '#112211'; ctx.beginPath();
        for(let x=0;x<=canvas.width;x+=GRID) { ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); }
        for(let y=0;y<=canvas.height;y+=GRID) { ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); }
        ctx.stroke();

        ctx.strokeStyle = 'rgba(0,255,100,0.15)'; ctx.lineWidth=2; ctx.beginPath();
        for(let key in flowMap) {
            let [gx,gy] = key.split(',').map(Number);
            let next = flowMap[key];
            ctx.moveTo(gx*GRID+GRID/2, gy*GRID+GRID/2);
            ctx.lineTo(next.x*GRID+GRID/2, next.y*GRID+GRID/2);
        }
        ctx.stroke();

        ctx.fillStyle = '#0f0'; ctx.fillRect(start.x*GRID, start.y*GRID, GRID, GRID);
        ctx.fillStyle = '#f00'; ctx.fillRect(end.x*GRID, end.y*GRID, GRID, GRID);

        towers.forEach(t => {
            ctx.save();
            ctx.translate(t.x, t.y);
            ctx.shadowBlur = 14;
            ctx.shadowColor = t.color;
            ctx.fillStyle = t.color;
            ctx.fillRect(-15, -15, 30, 30);
            ctx.shadowBlur = 0;
            if(t.angle !== undefined) {
                ctx.rotate(t.angle);
                ctx.fillStyle = '#111';
                ctx.fillRect(-3, -18, 6, 18);
            }
            ctx.restore();
            if(selected===t) { ctx.strokeStyle='#fff'; ctx.strokeRect(t.x-15,t.y-15,30,30); }
        });
        enemies.forEach(e => {
            ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = '#0f0';
            ctx.fillRect(e.x - 10, e.y - 16, 20 * (e.hp / e.maxHp), 3);
        });
        projs.forEach(p => {
            ctx.fillStyle = p.color; ctx.fillRect(p.x-3,p.y-3,6,6);
            ctx.globalAlpha = 0.35;
            ctx.fillRect(p.x-8, p.y-8, 3, 3);
            ctx.globalAlpha = 1;
        });
        particles.forEach(p => {
            ctx.globalAlpha = p.life/18;
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, 2, 2);
            ctx.globalAlpha = 1;
        });
    }

    function click(x, y) {
        let gx=Math.floor(x/GRID), gy=Math.floor(y/GRID);
        if(gx<0||gx>=COLS||gy<0||gy>=ROWS) return;
        let t = towers.find(t=>t.gx===gx && t.gy===gy);
        if(t) { selected=t; buildType=null; return; }
        if(buildType && money>=TOWERS[buildType].cost) {
            let def = TOWERS[buildType];
            towers.push({gx, gy, x:gx*GRID+GRID/2, y:gy*GRID+GRID/2, type: buildType, ...def, level:1, cd:0, angle: 0});
            if(calcPath()) money-=def.cost;
            else { towers.pop(); calcPath(); }
        }
        selected=null;
    }

    return {
        init, update, draw, click, startWave,
        setBuild: (k)=>{buildType=k; selected=null;},
        deselect: ()=>{selected=null; buildType=null;},
        upgrade: ()=>{
            if(selected){
                const cost = Math.floor(selected.cost * 0.8 * (selected.level || 1));
                if(money>=cost){
                    money-=cost;
                    selected.level++;
                    selected.dmg*=1.3;
                }
            }
        },
        sell: ()=>{if(selected){money+=Math.floor(selected.cost*0.5); towers=towers.filter(t=>t!==selected); selected=null; calcPath();}},
        stop: ()=>{ submitBestWave(); },
        conf: {towers: TOWERS},
        get wave(){return wave}, get money(){return money}, get lives(){return lives}, get bestWave(){return bestWave},
        get sel(){return selected}, get buildMode(){return buildType}
    };
  })();
  window.SentinelGame = Sentinel;
})(window);
