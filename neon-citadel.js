const NeonGame = {
    // Game State
    wave: 1, money: 0, lives: 0, 
    enemies: [], towers: [], projs: [], parts: [], floats: [],
    grid: [], flowField: {}, 
    active: false, gameOver: false,
    startNode: {x:0,y:0}, endNode: {x:0,y:0},
    q: [], // Spawn queue
    
    // Selection
    sel: null, build: null,
    
    // Config
    conf: {
        grid: 40,
        colors: { bg: '#020202', grid: '#081108', wall: '#111' },
        towers: {
            laser: { name:'LASER', cost:80, r:120, dmg:8, cd:10, color:'#00FF00', type:'laser' },
            scatter: { name:'SCATTER', cost:150, r:100, dmg:20, cd:50, color:'#FF00FF', type:'scatter' },
            sniper: { name:'RAIL', cost:350, r:500, dmg:150, cd:150, color:'#0088FF', type:'sniper' },
            slow:  { name:'STASIS', cost:250, r:90, dmg:2, cd:5, color:'#00FFFF', type:'slow' },
            boost: { name:'LINK', cost:500, r:80, dmg:0, cd:0, color:'#FFD700', type:'boost' }
        }
    },
    
    init: function(c) {
        this.reset();
        this.money = 650;
        this.lives = 50;
        
        let cols = 20, rows = 15;
        this.grid = Array(cols).fill().map(() => Array(rows).fill(0));
        
        // Center start/end
        this.startNode = {x: 0, y: 7};
        this.endNode = {x: 19, y: 7};
        
        this.calcFlow();
    },
    
    reset: function() {
        this.wave = 1; this.active = false; this.gameOver = false;
        this.enemies = []; this.towers = []; this.projs = []; this.parts = []; this.q = []; this.floats = [];
        this.sel = null; this.build = null;
    },
    
    // --- PATHFINDING (Flow Field) ---
    calcFlow: function() {
        let q = [this.endNode], came = {};
        came[`${this.endNode.x},${this.endNode.y}`] = null;
        
        // BFS to find all paths to end
        while(q.length) {
            let curr = q.shift();
            // Check Start
            if(curr.x===this.startNode.x && curr.y===this.startNode.y) break;
            
            // Neighbors
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(d => {
                let nx=curr.x+d[0], ny=curr.y+d[1];
                if(nx>=0 && nx<20 && ny>=0 && ny<15 && this.grid[nx][ny]===0) {
                    let k = `${nx},${ny}`;
                    if(!(k in came)) {
                        came[k] = curr;
                        q.push({x:nx, y:ny});
                    }
                }
            });
        }
        
        this.flowField = came;
        // Return true if path exists
        return `${this.startNode.x},${this.startNode.y}` in came;
    },
    
    // --- LOOP ---
    update: function() {
        if(this.gameOver) return;
        
        // 1. Spawning
        if(this.active && this.q.length) {
            this.q[0].delay--;
            if(this.q[0].delay <= 0) this.spawn(this.q.shift());
        } else if(this.active && !this.enemies.length && !this.q.length) {
            this.active = false; this.wave++; 
            this.money += 150 + (this.wave*25);
            this.msg("WAVE COMPLETE - BONUS $" + (150 + (this.wave*25)));
        }
        
        // 2. Enemies
        this.enemies.forEach(e => {
            // Apply Slow Decay
            if(e.slowTimer > 0) e.slowTimer--;
            let speed = e.slowTimer > 0 ? e.baseSpeed * 0.5 : e.baseSpeed;
            
            // Move
            let gx = Math.floor(e.x/40), gy = Math.floor(e.y/40);
            if(gx === this.endNode.x && gy === this.endNode.y && Math.abs(e.x - (gx*40+20)) < 5) {
                e.dead = true; this.lives--; this.shake(5);
            }
            
            let next = this.flowField[`${gx},${gy}`];
            if(next) {
                let tx = next.x*40+20, ty = next.y*40+20;
                let dx = tx - e.x, dy = ty - e.y;
                let dist = Math.sqrt(dx*dx+dy*dy);
                if(dist > speed) {
                    e.x += (dx/dist) * speed; e.y += (dy/dist) * speed;
                } else {
                    e.x = tx; e.y = ty;
                }
            } else {
                e.x += speed; // Fallback
            }
        });
        this.enemies = this.enemies.filter(e => !e.dead);
        
        // 3. Towers
        this.towers.forEach(t => {
            if(t.cdCur > 0) t.cdCur--;
            
            // Find Target
            if(t.cdCur <= 0) {
                // Boost Logic
                if(t.type === 'boost') return; 
                
                // Get targets in range
                let targets = this.enemies.filter(e => (e.x-t.x)**2 + (e.y-t.y)**2 <= t.r**2);
                
                if(targets.length > 0) {
                    // Check for Boost neighbors
                    let fireRateMod = 1;
                    this.towers.forEach(n => {
                        if(n.type === 'boost' && (n.x-t.x)**2+(n.y-t.y)**2 < n.r**2) fireRateMod = 0.5;
                    });
                
                    if(t.type === 'scatter') {
                        t.cdCur = t.cd * fireRateMod;
                        // Shoot 5 pellets
                        for(let i=0; i<5; i++) {
                            let ang = Math.atan2(targets[0].y - t.y, targets[0].x - t.x) + (Math.random()-0.5);
                            this.projs.push({x:t.x,y:t.y, vx:Math.cos(ang)*6, vy:Math.sin(ang)*6, life:40, dmg:t.dmg, color:t.color, type:'bullet'});
                        }
                    } else if(t.type === 'slow') {
                        t.cdCur = t.cd; // Fires constantly
                        targets.forEach(e => {
                            e.slowTimer = 10;
                            if(Math.random()<0.3) this.addPart(e.x, e.y, t.color, 1);
                        });
                    } else if(t.type === 'sniper') {
                        // Railgun
                        let target = targets.reduce((a,b) => a.hp > b.hp ? a : b); // Highest HP
                        t.cdCur = t.cd * fireRateMod;
                        this.projs.push({x:t.x,y:t.y, tx:target.x, ty:target.y, life:15, color:t.color, type:'beam'});
                        target.hp -= t.dmg;
                        this.addFloat(target.x, target.y, t.dmg);
                        if(target.hp<=0) this.kill(target, t);
                    } else {
                        // Laser / Basic
                        let target = targets[0]; // First
                        t.cdCur = t.cd * fireRateMod;
                        this.projs.push({x:t.x,y:t.y, vx:0, vy:0, target:target, speed:12, dmg:t.dmg, color:t.color, type:'home'});
                    }
                }
            }
        });
        
        // 4. Projectiles
        this.projs.forEach(p => {
            if(p.type === 'beam') { p.life--; return; }
            
            if(p.type === 'home') {
                if(p.target && !p.target.dead) {
                    let dx = p.target.x - p.x, dy = p.target.y - p.y;
                    let d = Math.sqrt(dx*dx+dy*dy);
                    if(d < p.speed) {
                         p.target.hp -= p.dmg;
                         this.addFloat(p.target.x, p.target.y, Math.floor(p.dmg));
                         if(p.target.hp<=0) this.kill(p.target, null);
                         p.dead = true;
                         this.addPulse(p.x, p.y, p.color);
                    } else {
                        p.x += (dx/d)*p.speed; p.y += (dy/d)*p.speed;
                    }
                } else { p.dead = true; }
            } else if(p.type === 'bullet') {
                p.x += p.vx; p.y += p.vy; p.life--;
                if(p.life<=0) p.dead = true;
                // Simple collision
                for(let e of this.enemies) {
                    if(Math.abs(e.x-p.x)<10 && Math.abs(e.y-p.y)<10) {
                        e.hp -= p.dmg;
                        if(e.hp<=0) this.kill(e, null);
                        p.dead = true;
                        break;
                    }
                }
            }
        });
        this.projs = this.projs.filter(p => !p.dead && p.life > 0);
        
        // 5. Particles & Floats
        this.parts.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.life--; });
        this.parts = this.parts.filter(p => p.life>0);
        this.floats.forEach(f => { f.y-=0.5; f.life--; });
        this.floats = this.floats.filter(f => f.life>0);
    },
    
    // --- DRAW (The Fancy Part) ---
    draw: function(ctx) {
        // Clear & Background
        ctx.fillStyle = this.conf.colors.bg; 
        ctx.fillRect(0,0,800,600);
        
        // Enable additive blending for "Neon" look
        ctx.globalCompositeOperation = 'lighter';
        
        // Draw Grid
        ctx.strokeStyle = '#081108'; ctx.lineWidth = 1; ctx.beginPath();
        for(let i=0; i<=800; i+=40) { ctx.moveTo(i,0); ctx.lineTo(i,600); }
        for(let i=0; i<=600; i+=40) { ctx.moveTo(0,i); ctx.lineTo(800,i); }
        ctx.stroke();
        
        // Draw Start/End
        this.glow(ctx, '#00F', 20); ctx.fillRect(this.startNode.x*40+2, this.startNode.y*40+2, 36, 36);
        this.glow(ctx, '#F00', 20); ctx.fillRect(this.endNode.x*40+2, this.endNode.y*40+2, 36, 36);
        
        // Draw Towers
        this.towers.forEach(t => {
            this.glow(ctx, t.color, 15);
            ctx.fillStyle = t.color;
            // Base
            ctx.fillRect(t.x-14, t.y-14, 28, 28);
            // Black center for contrast
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#000'; ctx.fillRect(t.x-10, t.y-10, 20, 20);
            ctx.globalCompositeOperation = 'lighter';
            
            // Type specific graphic
            ctx.fillStyle = t.color;
            if(t.type==='laser') ctx.fillRect(t.x-4,t.y-4,8,8);
            if(t.type==='scatter') { ctx.fillRect(t.x-6,t.y-6,4,4); ctx.fillRect(t.x+2,t.y+2,4,4); ctx.fillRect(t.x+2,t.y-6,4,4); ctx.fillRect(t.x-6,t.y+2,4,4); }
            if(t.type==='sniper') ctx.fillRect(t.x-2,t.y-12,4,24);
            if(t.type==='boost') { ctx.beginPath(); ctx.arc(t.x,t.y,6,0,6.28); ctx.stroke(); }
            if(t.type==='slow') { ctx.beginPath(); ctx.arc(t.x,t.y,t.r,0,6.28); ctx.strokeStyle=t.color; ctx.globalAlpha=0.1; ctx.fill(); ctx.globalAlpha=1; ctx.stroke(); }
            
            // Level Pips
            for(let i=0; i<t.lvl; i++) ctx.fillRect(t.x-12+(i*4), t.y+16, 2, 2);
            
            // Selection Ring
            if(this.sel === t) {
                ctx.strokeStyle = '#FFF'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI*2); ctx.stroke();
            }
        });
        
        // Draw Enemies
        this.enemies.forEach(e => {
            this.glow(ctx, e.color, 10);
            ctx.fillStyle = e.color;
            if(e.type === 'boss') {
                ctx.fillRect(e.x-12, e.y-12, 24, 24);
                ctx.fillStyle = '#000'; ctx.fillRect(e.x-6, e.y-6, 12, 12);
            } else if(e.type === 'tank') {
                ctx.fillRect(e.x-10, e.y-10, 20, 20);
            } else {
                ctx.beginPath(); ctx.arc(e.x, e.y, 8, 0, Math.PI*2); ctx.fill();
            }
            // HP Bar
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'red'; ctx.fillRect(e.x-8, e.y-14, 16, 3);
            ctx.fillStyle = '#0F0'; ctx.fillRect(e.x-8, e.y-14, 16*(e.hp/e.maxHp), 3);
            ctx.globalCompositeOperation = 'lighter';
        });
        
        // Draw Projectiles
        this.projs.forEach(p => {
            this.glow(ctx, p.color, 10);
            ctx.strokeStyle = p.color; ctx.fillStyle = p.color;
            if(p.type === 'beam') {
                ctx.lineWidth = p.life > 5 ? 3 : 1;
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.tx, p.ty); ctx.stroke();
            } else {
                ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI*2); ctx.fill();
            }
        });
        
        // Particles
        this.parts.forEach(p => {
            ctx.fillStyle = p.color; ctx.globalAlpha = p.life/30;
            ctx.fillRect(p.x, p.y, 2, 2);
        });
        ctx.globalAlpha = 1;
        
        // Floats (Damage numbers)
        this.floats.forEach(f => {
            ctx.fillStyle = '#fff'; ctx.font = '12px monospace';
            ctx.fillText(f.val, f.x, f.y);
        });
        
        // Reset composite
        ctx.globalCompositeOperation = 'source-over';
    },
    
    // --- HELPERS ---
    glow: function(ctx, color, blur) {
        ctx.shadowBlur = blur; ctx.shadowColor = color;
    },
    
    startWave: function() {
        if(this.active) return;
        this.active = true;
        
        let count = 8 + this.wave * 2;
        let hpMult = this.wave * 1.5;
        
        for(let i=0; i<count; i++) {
            let type = 'norm';
            let speed = 2;
            let hp = 15 + (hpMult*10);
            
            // Wave Logic
            if(this.wave % 5 === 0 && i === count-1) { type = 'boss'; hp *= 10; speed = 0.8; }
            else if(this.wave > 3 && i % 4 === 0) { type = 'tank'; hp *= 3; speed = 1.2; }
            else if(this.wave > 5 && i % 3 === 0) { type = 'fast'; hp *= 0.8; speed = 3.5; }
            
            this.q.push({
                type: type,
                hp: hp,
                maxHp: hp,
                baseSpeed: speed,
                delay: i * (type==='fast'?15:30)
            });
        }
    },
    
    spawn: function(d) {
        let color = '#F0F';
        if(d.type==='tank') color = '#F00';
        if(d.type==='fast') color = '#FF0';
        if(d.type==='boss') color = '#FFF';
        
        this.enemies.push({
            x: this.startNode.x*40+20, y: this.startNode.y*40+20,
            hp: d.hp, maxHp: d.maxHp,
            baseSpeed: d.baseSpeed, slowTimer: 0,
            type: d.type, color: color, dead: false
        });
    },
    
    kill: function(e, t) {
        if(e.dead) return;
        e.dead = true;
        this.money += (e.type==='boss'?500:(e.type==='tank'?30:15));
        if(t) t.kills = (t.kills || 0) + 1;
        this.addPulse(e.x, e.y, e.color, 15);
    },
    
    addPart: function(x,y,c,n) { for(let i=0;i<n;i++) this.parts.push({x:x,y:y,vx:(Math.random()-0.5)*4,vy:(Math.random()-0.5)*4,life:20+Math.random()*10,color:c}); },
    addPulse: function(x,y,c,n=5) { this.addPart(x,y,c,n); },
    addFloat: function(x,y,v) { this.floats.push({x:x,y:y,val:v,life:30}); },
    shake: function(amt) { /* TODO: Screen shake */ },
    msg: function(txt) { document.getElementById('ui-msg').innerText = txt; },
    
    // Interaction
    handleClick: function(x, y) {
        // Check Selection
        let clicked = this.towers.find(t => Math.abs(t.x-x)<20 && Math.abs(t.y-y)<20);
        if(clicked) { this.sel = clicked; this.build = null; return; }
        
        // Build
        if(this.build) {
            let gx = Math.floor(x/40), gy = Math.floor(y/40);
            if(gx<0 || gx>=20 || gy<0 || gy>=15) return;
            if(this.grid[gx][gy]) return; // Occupied
            if((gx===this.startNode.x && gy===this.startNode.y) || (gx===this.endNode.x && gy===this.endNode.y)) return;
            
            // Tentative Place
            this.grid[gx][gy] = 1;
            if(!this.calcFlow()) {
                this.grid[gx][gy] = 0;
                this.msg("PATH BLOCKED!");
                return;
            }
            
            let proto = this.conf.towers[this.build];
            if(this.money >= proto.cost) {
                this.money -= proto.cost;
                this.towers.push({
                    x: gx*40+20, y: gy*40+20,
                    type: this.build, r: proto.r, dmg: proto.dmg, cd: proto.cd, cdCur: 0,
                    color: proto.color, lvl: 1, kills: 0
                });
                this.addPulse(gx*40+20, gy*40+20, '#FFF', 10);
            } else {
                this.grid[gx][gy] = 0;
                this.msg("INSUFFICIENT FUNDS");
            }
        } else {
            this.sel = null;
        }
    },
    
    setBuild: function(k) { this.build = k; if(k) this.sel = null; },
    upgrade: function() {
        if(!this.sel) return;
        let t = this.sel;
        let cost = Math.floor(this.conf.towers[t.type].cost * 0.5 * (t.lvl+1));
        if(this.money >= cost) {
            this.money -= cost;
            t.lvl++;
            t.dmg *= 1.4;
            t.r += 10;
            t.cd *= 0.9;
            this.msg("UPGRADED TO MK-" + t.lvl);
            this.addPulse(t.x, t.y, '#0FF', 20);
        }
    },
    sell: function() {
        if(!this.sel) return;
        let t = this.sel;
        let val = Math.floor(this.conf.towers[t.type].cost * 0.5 * (t.lvl+1) * 0.8);
        this.money += val;
        // Remove
        this.grid[Math.floor(t.x/40)][Math.floor(t.y/40)] = 0;
        this.towers = this.towers.filter(x => x !== t);
        this.sel = null;
        this.calcFlow();
    }
};
