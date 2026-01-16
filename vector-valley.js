import { getHighScore, submitHighScore } from './score-store.js';

/* VECTOR VALLEY */
(function(global){
  const Vector = (function(){
    
    const TOWERS = {
      turret: { name:'TURRET', cost:60, color:'#ffaa00', range:120, dmg:20, rate:25 },
      missile:{ name:'MISSILE',cost:140,color:'#ff4444', range:220, dmg:50, rate:70, aoe:60 },
      laser:  { name:'LASER',  cost:250, color:'#44ffff', range:160, dmg:4,  rate:3 },
      stasis: { name:'STASIS', cost:200, color:'#aa66ff', range:140, dmg:0,  rate:60, slow:0.5 }
    };

    let canvas, ctx;
    let path=[], towers=[], enemies=[], projs=[], particles=[];
    const GAME_ID = 'tower-vector';
    let wave=1, money=600, lives=20, active=false;
    let bestWave = 0;
    let submitted = false;
    let buildType=null, selected=null;

    function init(c, opts) {
        canvas = c; ctx = c.getContext('2d');
        reset(opts ? opts.difficulty : 'med');
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

    function reset(diff) {
        wave=1; money=600; lives=20; active=false;
        towers=[]; enemies=[]; projs=[]; particles=[];
        buildType=null; selected=null;
        submitted = false;
        generatePath(diff);
        loadBestWave();
    }

    function generatePath(diff) {
        let w = canvas.width, h = canvas.height;
        path = [{x:0, y:h/2}];
        if(diff === 'easy') {
            path.push({x:w*0.5, y:h*0.2}, {x:w*0.8, y:h*0.8}, {x:w, y:h*0.8});
        } else if(diff === 'hard') {
            for(let i=1; i<8; i++) path.push({x:(w/8)*i, y: i%2===0? h*0.2 : h*0.8});
            path.push({x:w, y:h/2});
        } else {
            path.push({x:w*0.2, y:h*0.2}, {x:w*0.8, y:h*0.2}, {x:w*0.5, y:h*0.8}, {x:w, y:h*0.8});
        }
    }

    function startWave() {
        if(active) return;
        active = true;
        let count = 8 + wave*2;
        let sent = 0;
        let int = setInterval(() => {
            spawnEnemy();
            sent++;
            if(sent >= count) clearInterval(int);
        }, 900);
    }

    function spawnEnemy() {
        let hp = 40 + (wave*15);
        let type = 'norm';
        if(wave > 3 && Math.random()>0.7) type = 'fast';
        if(wave > 5 && Math.random()>0.8) type = 'tank';
        
        let spd = 2;
        if(type==='fast') { spd=4; hp*=0.6; }
        if(type==='tank') { spd=1; hp*=3; }

        enemies.push({
            x: path[0].x, y: path[0].y, idx: 0,
            hp, maxHp: hp, speed: spd, baseSpeed: spd, type, angle:0
        });
    }

    function update() {
        if(lives <= 0) {
            submitBestWave();
            return;
        }

        for(let i=enemies.length-1; i>=0; i--) {
            let e = enemies[i];
            let target = path[e.idx+1];
            if(!target) { lives--; enemies.splice(i,1); continue; }

            let dx = target.x - e.x, dy = target.y - e.y;
            let d = Math.hypot(dx,dy);
            
            if(d < e.speed) {
                e.idx++; e.x = target.x; e.y = target.y;
            } else {
                e.x += (dx/d)*e.speed; e.y += (dy/d)*e.speed;
            }
            if (e.x < -20 || e.x > canvas.width + 20 || e.y < -20 || e.y > canvas.height + 20) {
                lives--; enemies.splice(i,1); continue;
            }
            e.angle += 0.1;
            e.speed = e.baseSpeed; 

            if(e.hp <= 0) {
                money += 15; enemies.splice(i,1);
                for(let k=0;k<8;k++) particles.push({x:e.x, y:e.y, vx:Math.random()*6-3, vy:Math.random()*6-3, life:20, color:'#fff'});
            }
        }
        
        if(active && enemies.length===0) { active=false; wave++; if (wave > bestWave) bestWave = wave; }

        towers.forEach(t => {
            if(t.cd > 0) t.cd--;
            else {
                let target = enemies.find(e => Math.hypot(e.x-t.x, e.y-t.y) < t.range);
                if(target) {
                    if(t.name==='LASER') {
                        target.hp -= t.dmg; t.cd = t.rate;
                        particles.push({type:'beam', x:t.x, y:t.y, tx:target.x, ty:target.y, color:t.color, life:4, width:4});
                    } else if(t.name==='STASIS') {
                        enemies.forEach(e => { if(Math.hypot(e.x-t.x, e.y-t.y) < t.range) e.speed *= t.slow; });
                        particles.push({type:'ring', x:t.x, y:t.y, r:1, maxR:t.range, color:t.color, life:15});
                        t.cd = t.rate;
                    } else {
                        projs.push({x:t.x, y:t.y, tx:target.x, ty:target.y, speed:12, dmg:t.dmg, aoe:t.aoe, color:t.color});
                        t.cd = t.rate;
                    }
                }
            }
        });

        for(let i=projs.length-1; i>=0; i--) {
            let p = projs[i];
            let dx = p.tx - p.x, dy = p.ty - p.y;
            let d = Math.hypot(dx, dy);
            
            if(d < p.speed) {
                if(p.aoe) {
                    enemies.forEach(e => { if(Math.hypot(e.x-p.tx, e.y-p.ty) < p.aoe) e.hp -= p.dmg; });
                    particles.push({type:'ring', x:p.tx, y:p.ty, r:1, maxR:p.aoe, color:p.color, life:10});
                } else {
                    let hit = enemies.find(e => Math.hypot(e.x-p.tx, e.y-p.ty) < 30);
                    if(hit) hit.hp -= p.dmg;
                }
                projs.splice(i,1);
            } else {
                p.x += (dx/d)*p.speed; p.y += (dy/d)*p.speed;
                particles.push({type:'trail', x:p.x, y:p.y, color:p.color, life:10});
            }
        }
        
        for(let i=particles.length-1; i>=0; i--) {
            let p = particles[i];
            p.life--;
            if(p.type!=='ring'&&p.type!=='beam') { p.x+=p.vx; p.y+=p.vy; }
            if(p.life<=0) particles.splice(i,1);
        }
    }

    function draw(ctx) {
        const bg = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        bg.addColorStop(0, '#050a15');
        bg.addColorStop(1, '#080511');
        ctx.fillStyle = bg;
        ctx.fillRect(0,0,canvas.width,canvas.height);
        
        ctx.shadowBlur = 20; ctx.shadowColor = '#00ffcc';
        ctx.strokeStyle = '#00ffcc'; ctx.lineWidth = 3;
        ctx.beginPath();
        if(path.length) {
            ctx.moveTo(path[0].x, path[0].y);
            for(let i=1;i<path.length;i++) ctx.lineTo(path[i].x, path[i].y);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;

        towers.forEach(t => {
            ctx.shadowBlur = 10;
            ctx.shadowColor = t.color;
            ctx.fillStyle = t.color;
            ctx.beginPath();
            if(t.name === 'TURRET') ctx.fillRect(t.x-10, t.y-10, 20, 20);
            else ctx.arc(t.x, t.y, 10, 0, Math.PI*2);
            ctx.fill();
            ctx.shadowBlur = 0;
            if(selected === t) {
                ctx.strokeStyle = '#fff'; ctx.lineWidth=1;
                ctx.beginPath(); ctx.arc(t.x,t.y,t.range,0,Math.PI*2); ctx.stroke();
            }
        });

        enemies.forEach(e => {
            ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.angle);
            ctx.fillStyle = e.type==='tank'?'#4488ff':(e.type==='fast'?'#ffff00':'#ff4444');
            ctx.fillRect(-8,-8,16,16);
            ctx.restore();
            ctx.fillStyle = '#0f0'; ctx.fillRect(e.x-10, e.y-15, 20*(e.hp/e.maxHp), 3);
        });

        projs.forEach(p => { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2); ctx.fill(); });
        particles.forEach(p => {
            ctx.globalAlpha = p.life/20;
            if(p.type === 'ring') {
                ctx.strokeStyle = p.color; ctx.beginPath();
                ctx.arc(p.x, p.y, p.maxR * (1 - p.life/15), 0, Math.PI*2); ctx.stroke();
            } else if (p.type === 'beam') {
                ctx.strokeStyle = p.color; ctx.lineWidth = p.width || 3;
                ctx.shadowBlur = 12; ctx.shadowColor = p.color;
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.tx, p.ty); ctx.stroke();
                ctx.shadowBlur = 0;
            } else {
                ctx.fillStyle = p.color; ctx.fillRect(p.x,p.y,3,3);
            }
            ctx.globalAlpha = 1;
        });
    }

    function click(x, y) {
        let t = towers.find(t => Math.hypot(t.x-x, t.y-y) < 20);
        if(t) { selected=t; buildType=null; return; }
        if(buildType && money >= TOWERS[buildType].cost) {
            let def = TOWERS[buildType];
            towers.push({x, y, type: buildType, ...def, level:1, cd:0});
            money -= def.cost;
        } else selected = null;
    }

    return {
        init, update, draw, click, startWave,
        setBuild: (k)=>{buildType=k; selected=null;},
        deselect: ()=>{selected=null; buildType=null;},
        upgrade: ()=>{
            if(selected){
                const cost = Math.floor(selected.cost * 0.8 * (selected.level || 1));
                if(money>=cost){ money-=cost; selected.level++; selected.dmg*=1.4; }
            }
        },
        sell: ()=>{if(selected){ money+=Math.floor(selected.cost*0.5); towers=towers.filter(t=>t!==selected); selected=null; }},
        stop: ()=>{ submitBestWave(); },
        conf: {towers: TOWERS},
        get wave(){return wave}, get money(){return money}, get lives(){return lives}, get bestWave(){return bestWave},
        get sel(){return selected}, get buildMode(){return buildType}
    };
  })();
  window.VectorGame = Vector;
})(window);
