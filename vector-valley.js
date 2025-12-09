const VectorGame = {
    wave: 1, money: 0, lives: 0, active: false, gameOver: false,
    enemies: [], towers: [], projs: [], parts: [],
    path: [], q: [], sel: null, build: null,
    
    conf: {
        towers: {
            turret: { name:'TURRET', cost:75, r:110, dmg:25, cd:30, color:'#FFAA00' },
            sniper: { name:'SNIPER', cost:200, r:350, dmg:120, cd:90, color:'#00FFFF' },
            heavy:  { name:'HEAVY', cost:300, r:90, dmg:100, cd:45, color:'#FF0000' }
        }
    },
    
    init: function(c) {
        this.reset();
        this.money = 450;
        this.lives = 20;
        this.genPath();
    },
    
    reset: function() {
        this.wave = 1; this.active = false; this.gameOver = false;
        this.enemies=[]; this.towers=[]; this.projs=[]; this.parts=[]; this.q=[];
        this.sel=null; this.build=null;
    },
    
    genPath: function() {
        // Hardcoded winding path
        this.path = [
            {x:0,y:100}, {x:200,y:100}, {x:200,y:400},
            {x:400,y:400}, {x:400,y:200}, {x:600,y:200},
            {x:600,y:500}, {x:800,y:500}
        ];
    },
    
    update: function() {
        if(this.gameOver) return;
        
        // Spawn
        if(this.active && this.q.length) {
            this.q[0].delay--;
            if(this.q[0].delay <= 0) this.enemies.push(this.q.shift());
        } else if(this.active && !this.enemies.length && !this.q.length) {
            this.active = false; this.wave++; this.money += 100 + this.wave*20;
        }
        
        // Enemies
        this.enemies.forEach(e => {
            let t = this.path[e.idx];
            let dx = t.x - e.x, dy = t.y - e.y;
            let d = Math.sqrt(dx*dx+dy*dy);
            if(d < e.speed) {
                e.idx++;
                if(e.idx >= this.path.length) { e.dead = true; this.lives--; }
            } else {
                e.x += (dx/d)*e.speed; e.y += (dy/d)*e.speed;
            }
        });
        this.enemies = this.enemies.filter(e => !e.dead);
        
        // Towers
        this.towers.forEach(t => {
            if(t.cd > 0) t.cd--;
            else {
                let target = this.enemies.find(e => (e.x-t.x)**2+(e.y-t.y)**2 <= t.r**2);
                if(target) {
                    t.cd = t.maxCd;
                    this.projs.push({x:t.x,y:t.y, tx:target.x, ty:target.y, color:t.color, dmg:t.dmg, life:10});
                    target.hp -= t.dmg;
                    if(target.hp<=0) { target.dead = true; this.money += target.val; this.explode(target.x, target.y, target.color); }
                }
            }
        });
        
        // Particles
        this.parts.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.life--; });
        this.parts = this.parts.filter(p => p.life>0);
        this.projs.forEach(p => p.life--);
        this.projs = this.projs.filter(p => p.life>0);
    },
    
    draw: function(ctx) {
        // Grid BG
        ctx.fillStyle = '#110500'; ctx.fillRect(0,0,800,600);
        ctx.strokeStyle = '#331100'; ctx.lineWidth = 2;
        ctx.beginPath();
        for(let i=0;i<800;i+=50) { ctx.moveTo(i,0); ctx.lineTo(i,600); }
        ctx.stroke();
        
        // Path
        ctx.strokeStyle = '#FF5500'; ctx.lineWidth = 4;
        ctx.shadowBlur = 10; ctx.shadowColor = '#FF5500';
        ctx.beginPath();
        this.path.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
        ctx.stroke();
        ctx.shadowBlur = 0;
        
        // Towers
        this.towers.forEach(t => {
            ctx.fillStyle = t.color; ctx.beginPath();
            if(t.type === 'turret') { ctx.moveTo(t.x, t.y-10); ctx.lineTo(t.x+10, t.y+10); ctx.lineTo(t.x-10, t.y+10); } // Triangle
            else ctx.fillRect(t.x-10, t.y-10, 20, 20); // Square
            ctx.fill();
            if(this.sel === t) { ctx.strokeStyle='#fff'; ctx.lineWidth=1; ctx.beginPath(); ctx.arc(t.x,t.y,t.r,0,6.28); ctx.stroke(); }
        });
        
        // Enemies
        this.enemies.forEach(e => {
            ctx.fillStyle = e.color; ctx.fillRect(e.x-8, e.y-8, 16, 16);
            ctx.fillStyle = '#0F0'; ctx.fillRect(e.x-8, e.y-12, 16*(e.hp/e.maxHp), 2);
        });
        
        // Lasers
        ctx.lineWidth = 2;
        this.projs.forEach(p => {
            ctx.strokeStyle = p.color; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.tx, p.ty); ctx.stroke();
        });
        
        // Parts
        this.parts.forEach(p => { ctx.fillStyle=p.color; ctx.fillRect(p.x, p.y, 2, 2); });
    },
    
    // API
    startWave: function() {
        if(this.active) return;
        this.active = true;
        for(let i=0; i<5+this.wave*2; i++) {
            this.q.push({
                x:this.path[0].x, y:this.path[0].y, idx:1,
                hp:20+this.wave*10, maxHp:20+this.wave*10,
                speed:2, color:'#F0F', val:15, delay:i*30, dead:false
            });
        }
    },
    explode: function(x,y,c) { for(let i=0;i<8;i++) this.parts.push({x:x,y:y,vx:Math.random()*4-2,vy:Math.random()*4-2,life:20,color:c}); },
    handleClick: function(x,y) {
        let t = this.towers.find(t => (t.x-x)**2+(t.y-y)**2 < 400);
        if(t) { this.sel=t; this.build=null; return; }
        if(this.build) {
            let def = this.conf.towers[this.build];
            if(this.money >= def.cost) {
                this.money -= def.cost;
                this.towers.push({x:x,y:y,type:this.build,r:def.r,dmg:def.dmg,maxCd:def.cd,cd:0,color:def.color,lvl:1});
            }
        }
    },
    setBuild: function(k) { this.build=k; if(k) this.sel=null; },
    upgrade: function() { if(this.sel) { this.money-=50; this.sel.lvl++; this.sel.dmg*=1.5; } },
    sell: function() { if(this.sel) { this.towers = this.towers.filter(x=>x!==this.sel); this.sel=null; this.money+=50; } }
};
