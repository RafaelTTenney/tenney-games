{
type: uploaded file
fileName: vector-valley.js
fullContent:
/* Vector Valley - Visual & Pathing Update 
   - Difficulty: Easy/Med/Hard generate different paths.
   - Persistence: Holding shift or default behavior keeps tower selected.
   - Visuals: Neon lines, particles, surprising enemy shapes.
*/

(function(global){
  const Vector = (function(){
    
    const TOWERS = {
      turret: { name:'TURRET', cost:60, color:'#ffaa00', range:100, dmg:20, rate:25 },
      missile:{ name:'MISSILE',cost:140,color:'#ff4444', range:200, dmg:50, rate:70, aoe:50 },
      laser:  { name:'LASER',  cost:250, color:'#44ffff', range:150, dmg:5,  rate:4 }, // Fast rate
      stasis: { name:'STASIS', cost:200, color:'#aa66ff', range:120, dmg:0,  rate:60, slow:0.5 }
    };

    let canvas, ctx;
    let path = [];
    let towers=[], enemies=[], projs=[], particles=[];
    let wave=1, money=600, lives=20, active=false;
    let buildType=null, selected=null;
    
    function init(c, opts) {
      canvas = c; ctx = c.getContext('2d');
      reset(opts ? opts.difficulty : 'med');
    }

    function reset(diff) {
        wave = 1; money = 600; lives = 20; active = false;
        towers=[]; enemies=[]; projs=[]; particles=[];
        generatePath(diff);
    }

    function generatePath(diff) {
        let w = canvas.width, h = canvas.height;
        path = [{x:0, y:h/2}];
        
        if (diff === 'easy') {
            path.push({x:w*0.2, y:h/2});
            path.push({x:w*0.5, y:h*0.2});
            path.push({x:w*0.8, y:h*0.8});
            path.push({x:w, y:h*0.8});
        } else if (diff === 'hard') {
            // Zig zag madness
            for(let i=1; i<8; i++) {
                path.push({
                    x: (w/8)*i,
                    y: i%2===0 ? h*0.2 : h*0.8
                });
            }
            path.push({x:w, y:h*0.5});
        } else {
            // Medium
            path.push({x:w*0.3, y:h*0.3});
            path.push({x:w*0.3, y:h*0.7});
            path.push({x:w*0.7, y:h*0.7});
            path.push({x:w*0.7, y:h*0.3});
            path.push({x:w, y:h*0.3});
        }
    }

    function startWave() {
        if(active) return;
        active = true;
        let count = 6 + Math.floor(wave*1.5);
        let i = 0;
        let int = setInterval(() => {
            spawnEnemy(wave);
            i++;
            if(i >= count) clearInterval(int);
        }, 1000 - Math.min(600, wave*20));
    }

    function spawnEnemy(lvl) {
        let type = 'norm';
        if (lvl > 3 && Math.random()>0.7) type = 'fast';
        if (lvl > 5 && Math.random()>0.8) type = 'tank';
        
        let hp = 30 + (lvl * 10);
        let speed = 2;
        if(type==='fast') { speed=4; hp*=0.6; }
        if(type==='tank') { speed=1; hp*=2.5; }

        enemies.push({
            x: path[0].x, y: path[0].y,
            idx: 0,
            hp: hp, maxHp: hp, speed: speed, originalSpeed: speed,
            type: type,
            angle: 0
        });
    }

    function update() {
        if(lives<=0) return;
        
        // Enemies
        for(let i=enemies.length-1; i>=0; i--) {
            let e = enemies[i];
            let target = path[e.idx+1];
            if(!target) {
                lives--; enemies.splice(i,1); continue;
            }

            let dx = target.x - e.x;
            let dy = target.y - e.y;
            let d = Math.hypot(dx,dy);
            
            // Move
            if(d < e.speed) {
                e.idx++;
                e.x = target.x; e.y = target.y;
            } else {
                e.x += (dx/d)*e.speed;
                e.y += (dy/d)*e.speed;
            }
            e.angle += 0.1; // Rotate visual
            
            if(e.hp <= 0) {
                money += (e.type==='tank'?30:15);
                // Particle Explosion
                for(let p=0; p<10; p++) {
                    particles.push({x:e.x, y:e.y, vx:Math.random()*4-2, vy:Math.random()*4-2, life:20, color:'#fff'});
                }
                enemies.splice(i,1);
            }
            
            // Reset status effects
            e.speed = e.originalSpeed; 
        }

        if(active && enemies.length === 0) { active = false; wave++; }

        // Towers
        towers.forEach(t => {
            if(t.cd > 0) t.cd--;
            else {
                let target = enemies.find(e => Math.hypot(e.x-t.x, e.y-t.y) < t.range);
                if(target) {
                    if(t.name === 'STASIS') {
                        // AoE Slow instant
                        enemies.forEach(e => {
                            if(Math.hypot(e.x-t.x, e.y-t.y) < t.range) e.speed *= t.slow;
                        });
                        // Visual ripple
                        particles.push({x:t.x, y:t.y, life:10, type:'ripple', r:10, maxR:t.range, color:t.color});
                        t.cd = t.rate;
                    } else if (t.name === 'LASER') {
                         // Beam logic
                         target.hp -= t.dmg;
                         t.cd = t.rate;
                         particles.push({x:t.x, y:t.y, tx:target.x, ty:target.y, life:3, type:'beam', color:t.color});
                    } else {
                        // Projectile
                        projs.push({x:t.x, y:t.y, tx:target.x, ty:target.y, speed:10, dmg:t.dmg, aoe:t.aoe, color:t.color});
                        t.cd = t.rate;
                    }
                }
            }
        });

        // Projectiles
        for(let i=projs.length-1; i>=0; i--) {
            let p = projs[i];
            let dx = p.tx - p.x;
            let dy = p.ty - p.y;
            let d = Math.hypot(dx, dy);
            
            if(d < p.speed) {
                // Impact
                if(p.aoe) {
                    enemies.forEach(e => {
                        if(Math.hypot(e.x - p.tx, e.y - p.ty) < p.aoe) e.hp -= p.dmg;
                    });
                    particles.push({x:p.tx, y:p.ty, life:10, type:'ripple', r:5, maxR:p.aoe, color:p.color});
                } else {
                    // We need to find the enemy actually at this location roughly
                    let hit = enemies.find(e => Math.hypot(e.x - p.tx, e.y - p.ty) < 20);
                    if(hit) hit.hp -= p.dmg;
                }
                projs.splice(i,1);
            } else {
                p.x += (dx/d)*p.speed;
                p.y += (dy/d)*p.speed;
            }
        }

        // Particles
        for(let i=particles.length-1; i>=0; i--) {
            let p = particles[i];
            p.life--;
            if(p.type !== 'ripple' && p.type !== 'beam') {
                p.x += p.vx; p.y += p.vy;
            }
            if(p.life <= 0) particles.splice(i,1);
        }
    }

    function draw(ctx) {
        ctx.fillStyle = '#050a15';
        ctx.fillRect(0,0,canvas.width,canvas.height);

        // Path (Neon Glow)
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ffcc';
        ctx.strokeStyle = '#00ffcc';
        ctx.lineWidth = 4;
        ctx.beginPath();
        if(path.length) {
            ctx.moveTo(path[0].x, path[0].y);
            for(let i=1; i<path.length; i++) ctx.lineTo(path[i].x, path[i].y);
            ctx.stroke();
        }
        ctx.shadowBlur = 0;

        // Towers
        towers.forEach(t => {
            ctx.fillStyle = t.color;
            ctx.beginPath();
            if(t.name==='TURRET') { ctx.fillRect(t.x-10, t.y-10, 20, 20); }
            else if(t.name==='LASER') { ctx.moveTo(t.x, t.y-10); ctx.lineTo(t.x+10, t.y+10); ctx.lineTo(t.x-10, t.y+10); ctx.fill(); }
            else { ctx.arc(t.x, t.y, 10, 0, Math.PI*2); ctx.fill(); }
            
            if(selected===t) {
                ctx.strokeStyle='white'; ctx.beginPath(); ctx.arc(t.x,t.y, t.range, 0, Math.PI*2); ctx.stroke();
            }
        });

        // Enemies (More complex shapes)
        enemies.forEach(e => {
            ctx.save();
            ctx.translate(e.x, e.y);
            ctx.rotate(e.angle);
            ctx.fillStyle = (e.type==='tank') ? '#4488ff' : '#ff4444';
            if(e.type==='fast') ctx.fillStyle = '#ffff00';
            
            // Shape
            ctx.fillRect(-8,-8, 16, 16);
            ctx.fillStyle = '#fff';
            ctx.fillRect(-4,-4, 8, 8); // Core
            
            ctx.restore();
            
            // Health Bar
            ctx.fillStyle = '#333'; ctx.fillRect(e.x-10, e.y-15, 20, 4);
            ctx.fillStyle = '#0f0'; ctx.fillRect(e.x-10, e.y-15, 20*(e.hp/e.maxHp), 4);
        });

        // Particles & Projs
        projs.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
        });

        particles.forEach(p => {
            ctx.globalAlpha = p.life / 20;
            if(p.type === 'ripple') {
                ctx.strokeStyle = p.color;
                ctx.beginPath();
                let r = p.r + (p.maxR - p.r) * (1 - p.life/10);
                ctx.arc(p.x, p.y, r, 0, Math.PI*2);
                ctx.stroke();
            } else if (p.type === 'beam') {
                ctx.strokeStyle = p.color;
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.tx, p.ty); ctx.stroke();
            } else {
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, 3, 3);
            }
            ctx.globalAlpha = 1;
        });
    }

    function click(x, y) {
        // Check selection
        let t = towers.find(t => Math.hypot(t.x-x, t.y-y) < 15);
        if(t) { selected = t; buildType = null; return; }

        if(buildType && money >= TOWERS[buildType].cost) {
            let def = TOWERS[buildType];
            towers.push({
                x, y, ...def,
                level: 1, cd: 0
            });
            money -= def.cost;
            // Persistence: Do NOT clear buildType
        } else {
            selected = null;
        }
    }

    function setBuild(k) { buildType = k; selected = null; }
    function upgrade() {
        if(!selected || money < Math.floor(selected.cost*0.8)) return;
        money -= Math.floor(selected.cost*0.8);
        selected.level++;
        selected.dmg *= 1.4;
    }
    function sell() {
        if(!selected) return;
        money += Math.floor(selected.cost * 0.5);
        towers = towers.filter(t=>t!==selected);
        selected = null;
    }

    return {
        init, update, draw, click, startWave, setBuild, upgrade, sell, stop: ()=>{},
        conf: {towers: TOWERS},
        get wave(){return wave}, get money(){return money}, get lives(){return lives}, get sel(){return selected}, get buildMode(){return buildType}
    };

  })();

  if(typeof window !== 'undefined') window.VectorGame = Vector;
})(window);
}
