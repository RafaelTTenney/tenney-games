const NeonGame = {
    wave: 1, money: 0, lives: 0, diff: 1,
    enemies: [], towers: [], projs: [], parts: [], floats: [],
    grid: [], flow: {}, active: false, gameOver: false,
    start: {x:0,y:7}, end: {x:19,y:7}, q: [],
    sel: null, build: null,

    conf: {
        towers: {
            basic: { name:'LASER', cost:50, r:100, dmg:10, cd:20, color:'#00FF00' },
            rapid: { name:'GATLING', cost:150, r:80, dmg:4, cd:5, color:'#FF00FF' },
            sniper:{ name:'RAIL', cost:300, r:600, dmg:120, cd:120, color:'#00FFFF' },
            aoe:   { name:'PULSE', cost:400, r:90, dmg:50, cd:60, color:'#FF8800' },
            boost: { name:'AMP', cost:500, r:70, dmg:0, cd:0, color:'#FFFF00' }
        }
    },

    init: function(c, difficulty) {
        this.reset();
        this.diff = difficulty;
        this.money = 600;
        this.lives = 50;
        this.grid = Array(20).fill().map(()=>Array(15).fill(0));
        this.calcFlow();
    },

    reset: function() {
        this.wave=1; this.active=false; this.gameOver=false;
        this.enemies=[]; this.towers=[]; this.projs=[]; this.parts=[]; this.q=[]; this.floats=[];
        this.sel=null; this.build=null;
    },

    calcFlow: function() {
        let q = [this.end], came = {};
        came[`${this.end.x},${this.end.y}`] = null;
        while(q.length) {
            let c = q.shift();
            if(c.x===this.start.x && c.y===this.start.y) break;
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(d => {
                let nx=c.x+d[0], ny=c.y+d[1];
                if(nx>=0 && nx<20 && ny>=0 && ny<15 && !this.grid[nx][ny]) {
                    let k = `${nx},${ny}`;
                    if(!(k in came)) { came[k]=c; q.push({x:nx,y:ny}); }
                }
            });
        }
        this.flow = came;
        return `${this.start.x},${this.start.y}` in came;
    },

    update: function() {
        if(this.gameOver) return;
        
        // Spawn
        if(this.active && this.q.length) {
            this.q[0].d--;
            if(this.q[0].d<=0) this.spawn(this.q.shift());
        } else if(this.active && !this.enemies.length && !this.q.length) {
            this.active = false; this.wave++;
            this.money += 100 + (this.wave*20);
        }

        // Enemies
        this.enemies.forEach(e => {
            if(e.frz > 0) e.frz--;
            let spd = e.frz > 0 ? e.spd * 0.5 : e.spd;
            
            let gx = Math.floor(e.x/40), gy = Math.floor(e.y/40);
            let next = this.flow[`${gx},${gy}`];
            
            if(gx===this.end.x && gy===this.end.y && Math.abs(e.x-(gx*40+20))<5) {
                e.dead = true; this.lives--;
            } else if(next) {
                let tx = next.x*40+20, ty = next.y*40+20;
                let dx = tx-e.x, dy = ty-e.y;
                let dist = Math.sqrt(dx*dx+dy*dy);
                if(dist < spd) { e.x = tx; e.y = ty; }
                else { e.x += (dx/dist)*spd; e.y += (dy/dist)*spd; }
            }
        });
        this.enemies = this.enemies.filter(e => !e.dead);

        // Towers
        this.towers.forEach(t => {
            if(t.cdCur > 0) t.cdCur--;
            else {
                if(t.type === 'boost') return;
                
                // Boost Check
                let boost = 1;
                this.towers.forEach(n => {
                    if(n.type==='boost' && (n.x-t.x)**2+(n.y-t.y)**2 < 4900) boost = 0.5;
                });

                let targets = this.enemies.filter(e => (e.x-t.x)**2+(e.y-t.y)**2 < t.r**2);
                if(targets.length) {
                    t.cdCur = t.cd * boost;
                    if(t.type === 'aoe') {
                        this.addPart(t.x, t.y, t.color, 15);
                        targets.forEach(e => this.hit(e, t.dmg));
                    } else if(t.type === 'sniper') {
                        let tg = targets.reduce((a,b)=>a.hp>b.hp?a:b);
                        this.projs.push({type:'beam', x:t.x, y:t.y, tx:tg.x, ty:tg.y, color:t.color, life:10});
                        this.hit(tg, t.dmg);
                    } else {
                        // Projectile
                        this.projs.push({type:'bullet', x:t.x, y:t.y, t:targets[0], spd:12, dmg:t.dmg, color:t.color});
                    }
                }
            }
        });

        // Projectiles
        this.projs.forEach(p => {
            if(p.type==='beam') p.life--;
            else {
                if(!p.t || p.t.dead) { p.dead=true; return; }
                let dx = p.t.x-p.x, dy = p.t.y-p.y;
                let dist = Math.sqrt(dx*dx+dy*dy);
                if(dist < p.spd) {
                    this.hit(p.t, p.dmg);
                    p.dead = true;
                    this.addPart(p.x, p.y, p.color, 3);
                } else {
                    p.x += (dx/dist)*p.spd; p.y += (dy/dist)*p.spd;
                }
            }
        });
        this.projs = this.projs.filter(p => !p.dead && (p.type!=='beam'||p.life>0));
        
        // Particles
        this.parts.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.life--; });
        this.parts = this.parts.filter(p=>p.life>0);
        
        // Floats
        this.floats.forEach(f => { f.y-=0.5; f.life--; });
        this.floats = this.floats.filter(f=>f.life>0);
    },

    hit: function(e, dmg) {
        e.hp -= dmg;
        this.floats.push({x:e.x, y:e.y-10, val:Math.floor(dmg), life:30});
        if(e.hp <= 0) {
            e.dead = true;
            this.money += e.val;
            this.addPart(e.x, e.y, e.color, 10);
        }
    },

    draw: function(ctx) {
        ctx.fillStyle = '#050505'; ctx.fillRect(0,0,800,600);
        
        // Grid
        ctx.strokeStyle = '#111'; ctx.lineWidth = 1; ctx.beginPath();
        for(let i=0; i<=800; i+=40) { ctx.moveTo(i,0); ctx.lineTo(i,600); }
        for(let i=0; i<=600; i+=40) { ctx.moveTo(0,i); ctx.lineTo(800,i); }
        ctx.stroke();

        // Bloom Mode
        ctx.globalCompositeOperation = 'lighter';

        // Towers
        this.towers.forEach(t => {
            ctx.shadowBlur = 15; ctx.shadowColor = t.color; ctx.fillStyle = t.color;
            ctx.fillRect(t.x-14, t.y-14, 28, 28);
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = '#000'; ctx.fillRect(t.x-10, t.y-10, 20, 20);
            ctx.globalCompositeOperation = 'lighter';
            ctx.fillStyle = t.color;
            
            // Symbols
            if(t.type==='basic') ctx.fillRect(t.x-4,t.y-4,8,8);
            if(t.type==='sniper') ctx.fillRect(t.x-2,t.y-12,4,24);
            if(t.type==='aoe') { ctx.beginPath(); ctx.arc(t.x,t.y,6,0,7); ctx.stroke(); }
            if(t.type==='boost') { ctx.font='10px Arial'; ctx.fillText('+', t.x-3, t.y+3); }

            // Range (if selected)
            if(this.sel === t) {
                ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath();
                ctx.arc(t.x, t.y, t.r, 0, 7); ctx.stroke();
            }
        });

        // Enemies
        this.enemies.forEach(e => {
            ctx.shadowBlur = 10; ctx.shadowColor = e.color; ctx.fillStyle = e.color;
            if(e.type==='tank') ctx.fillRect(e.x-10, e.y-10, 20, 20);
            else ctx.beginPath(), ctx.arc(e.x, e.y, 8, 0, 7), ctx.fill();
            
            // Health bar
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'red'; ctx.fillRect(e.x-8, e.y-15, 16, 3);
            ctx.fillStyle = '#0F0'; ctx.fillRect(e.x-8, e.y-15, 16*(e.hp/e.maxHp), 3);
            ctx.globalCompositeOperation = 'lighter';
        });

        // Projectiles
        this.projs.forEach(p => {
            ctx.shadowBlur = 10; ctx.shadowColor = p.color; ctx.strokeStyle = p.color; ctx.fillStyle = p.color;
            if(p.type==='beam') { ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.tx,p.ty); ctx.stroke(); }
            else { ctx.beginPath(); ctx.arc(p.x,p.y,3,0,7); ctx.fill(); }
        });

        // Particles
        this.parts.forEach(p => {
            ctx.fillStyle = p.color; ctx.globalAlpha = p.life/20;
            ctx.fillRect(p.x,p.y,2,2);
        });
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'source-over';
        
        // Floats
        ctx.fillStyle = '#fff'; ctx.font = "12px monospace";
        this.floats.forEach(f => ctx.fillText(f.val, f.x, f.y));

        // Start/End
        ctx.fillStyle = '#00F'; ctx.fillRect(this.start.x*40+10, this.start.y*40+10, 20, 20);
        ctx.fillStyle = '#F00'; ctx.fillRect(this.end.x*40+10, this.end.y*40+10, 20, 20);
    },

    startWave: function() {
        if(this.active) return;
        this.active = true;
        let count = 10 + this.wave*2;
        let hp = (20 + this.wave*15) * this.diff;
        
        for(let i=0; i<count; i++) {
            let type = 'norm';
            let speed = 2;
            if(i%5===0 && this.wave>2) { type='tank'; hp*=2; speed=1; }
            if(i%3===0 && this.wave>5) { type='fast'; hp*=0.6; speed=3.5; }
            
            this.q.push({
                d: i*30, type: type, hp: hp, maxHp: hp, spd: speed, frz: 0,
                color: type==='tank'?'#F00':(type==='fast'?'#FF0':'#F0F'), val: 10
            });
        }
    },
    
    spawn: function(d) {
        this.enemies.push({
            x:this.start.x*40+20, y:this.start.y*40+20,
            hp:d.hp, maxHp:d.maxHp, spd:d.spd, type:d.type, color:d.color, val:d.val, frz:0
        });
    },
    
    addPart: function(x,y,c,n) { for(let i=0;i<n;i++) this.parts.push({x:x,y:y,vx:(Math.random()-.5)*5,vy:(Math.random()-.5)*5,life:20,color:c}); },
    
    click: function(x,y) {
        let t = this.towers.find(t => Math.abs(t.x-x)<20 && Math.abs(t.y-y)<20);
        if(t) { this.sel=t; this.build=null; return; }
        
        if(this.build) {
            let gx=Math.floor(x/40), gy=Math.floor(y/40);
            if(gx<0||gx>=20||gy<0||gy>=15||this.grid[gx][gy]) return;
            if((gx===this.start.x&&gy===this.start.y)||(gx===this.end.x&&gy===this.end.y)) return;
            
            this.grid[gx][gy]=1;
            if(!this.calcFlow()) { this.grid[gx][gy]=0; return; }
            
            let def = this.conf.towers[this.build];
            if(this.money>=def.cost) {
                this.money-=def.cost;
                this.towers.push({x:gx*40+20,y:gy*40+20,type:this.build,r:def.r,dmg:def.dmg,cd:def.cd,cdCur:0,color:def.color,lvl:1});
                this.addPart(gx*40+20,gy*40+20,'#FFF',10);
            } else { this.grid[gx][gy]=0; }
        } else { this.sel=null; }
    },
    
    setBuild: function(k) { this.build=k; if(k) this.sel=null; },
    upgrade: function() { if(!this.sel) return; let t=this.sel; let c=Math.floor(this.conf.towers[t.type].cost*0.6*(t.lvl+1)); if(this.money>=c){ this.money-=c; t.lvl++; t.dmg*=1.4; t.r+=10; } },
    sell: function() { if(!this.sel) return; let t=this.sel; let c=Math.floor(this.conf.towers[t.type].cost*0.6*(t.lvl+1)*0.5); this.money+=c; this.grid[Math.floor(t.x/40)][Math.floor(t.y/40)]=0; this.towers=this.towers.filter(x=>x!==t); this.sel=null; this.calcFlow(); }
};
