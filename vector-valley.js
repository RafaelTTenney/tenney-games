const VectorGame = {
    wave: 1, money: 0, lives: 0, diff: 1,
    enemies: [], towers: [], projs: [], parts: [],
    path: [], q: [], sel: null, build: null, active: false, gameOver: false,

    conf: {
        towers: {
            turret: { name:'TURRET', cost:60, r:120, dmg:20, cd:30, color:'#FFAA00' },
            rapid:  { name:'RAPID',  cost:180, r:100, dmg:8,  cd:6,  color:'#00FF00' },
            sniper: { name:'SNIPER', cost:350, r:400, dmg:100, cd:90, color:'#00FFFF' }
        }
    },

    init: function(c, diff) {
        this.reset();
        this.diff = diff;
        this.money = 500;
        this.lives = 20;
        // Winding Path
        this.path = [
            {x:0,y:100}, {x:200,y:100}, {x:200,y:400}, {x:500,y:400}, 
            {x:500,y:200}, {x:700,y:200}, {x:700,y:500}, {x:800,y:500}
        ];
    },

    reset: function() {
        this.wave=1; this.active=false; this.gameOver=false;
        this.enemies=[]; this.towers=[]; this.projs=[]; this.parts=[]; this.q=[];
        this.sel=null; this.build=null;
    },

    update: function() {
        if(this.gameOver) return;
        
        // Spawn
        if(this.active && this.q.length) {
            this.q[0].d--;
            if(this.q[0].d<=0) this.enemies.push(this.q.shift());
        } else if(this.active && !this.enemies.length && !this.q.length) {
            this.active=false; this.wave++; this.money += 100 + this.wave*20;
        }

        // Enemies
        this.enemies.forEach(e => {
            let t = this.path[e.idx];
            let dx=t.x-e.x, dy=t.y-e.y;
            let d=Math.sqrt(dx*dx+dy*dy);
            if(d < e.spd) {
                e.idx++;
                if(e.idx>=this.path.length) { e.dead=true; this.lives--; }
            } else {
                e.x += (dx/d)*e.spd; e.y += (dy/d)*e.spd;
            }
        });
        this.enemies = this.enemies.filter(e => !e.dead);

        // Towers
        this.towers.forEach(t => {
            if(t.cd>0) t.cd--;
            else {
                let target = this.enemies.find(e => (e.x-t.x)**2+(e.y-t.y)**2 < t.r**2);
                if(target) {
                    t.cd = t.maxCd;
                    this.projs.push({x:t.x, y:t.y, t:target, dmg:t.dmg, color:t.color, life:20});
                }
            }
        });

        // Projs
        this.projs.forEach(p => {
            if(!p.t || p.t.dead) { p.life=0; return; }
            // Instant hit (Vector style)
            p.t.hp -= p.dmg;
            if(p.t.hp <= 0) {
                p.t.dead = true; this.money += p.t.val;
                for(let i=0;i<8;i++) this.parts.push({x:p.t.x, y:p.t.y, vx:(Math.random()-.5)*5, vy:(Math.random()-.5)*5, life:20, color:p.t.color});
            }
            p.life--;
        });
        this.projs = this.projs.filter(p => p.life > 0);

        // Parts
        this.parts.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.life--; });
        this.parts = this.parts.filter(p => p.life>0);
    },

    draw: function(ctx) {
        ctx.fillStyle = '#051105'; ctx.fillRect(0,0,800,600);
        
        // Scanlines
        ctx.fillStyle = "rgba(0, 20, 0, 0.2)";
        for(let i=0; i<600; i+=2) ctx.fillRect(0,i,800,1);

        // Path
        ctx.strokeStyle = '#225522'; ctx.lineWidth = 20; ctx.lineCap='round';
        ctx.beginPath();
        this.path.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
        ctx.stroke();
        ctx.strokeStyle = '#44AA44'; ctx.lineWidth = 2;
        ctx.stroke();

        // Towers
        this.towers.forEach(t => {
            ctx.strokeStyle = t.color; ctx.lineWidth = 2;
            ctx.beginPath();
            if(t.type==='turret') { ctx.moveTo(t.x,t.y-10); ctx.lineTo(t.x+10,t.y+10); ctx.lineTo(t.x-10,t.y+10); ctx.closePath(); }
            else if(t.type==='rapid') ctx.strokeRect(t.x-8,t.y-8,16,16);
            else { ctx.arc(t.x,t.y,8,0,7); }
            ctx.stroke();
            
            if(this.sel===t) { ctx.beginPath(); ctx.arc(t.x,t.y,t.r,0,7); ctx.setLineDash([5,5]); ctx.stroke(); ctx.setLineDash([]); }
        });

        // Enemies
        this.enemies.forEach(e => {
            ctx.strokeStyle = e.color; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(e.x-6,e.y-6); ctx.lineTo(e.x+6,e.y+6); ctx.moveTo(e.x+6,e.y-6); ctx.lineTo(e.x-6,e.y+6); ctx.stroke();
            ctx.fillStyle='#0F0'; ctx.fillRect(e.x-10,e.y-15,20*(e.hp/e.maxHp),3);
        });

        // Lasers
        this.projs.forEach(p => {
            ctx.strokeStyle = p.color; ctx.lineWidth = 2; 
            ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.t.x,p.t.y); ctx.stroke();
        });

        // Particles
        this.parts.forEach(p => { ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,2,2); });
    },

    startWave: function() {
        if(this.active) return;
        this.active = true;
        let count = 6 + this.wave*2;
        for(let i=0; i<count; i++) {
            let type='norm', hp=20+this.wave*10, spd=2, col='#F0F';
            if(this.wave>2 && i%3===0) { type='shield'; hp*=1.5; col='#00F'; }
            if(this.wave>4 && i%5===0) { type='fast'; spd=4; hp*=0.7; col='#FF0'; }
            
            this.q.push({
                d: i*30, x:this.path[0].x, y:this.path[0].y, idx:1,
                hp:hp*this.diff, maxHp:hp*this.diff, spd:spd, type:type, color:col, val:15, dead:false
            });
        }
    },
    
    click: function(x,y) {
        let t = this.towers.find(t=>(t.x-x)**2+(t.y-y)**2 < 400);
        if(t) { this.sel=t; this.build=null; return; }
        if(this.build) {
            let def = this.conf.towers[this.build];
            if(this.money>=def.cost) {
                this.money-=def.cost;
                this.towers.push({x:x,y:y,type:this.build,r:def.r,dmg:def.dmg,maxCd:def.cd,cd:0,color:def.color,lvl:1});
            }
        }
    },
    setBuild: function(k) { this.build=k; if(k) this.sel=null; },
    upgrade: function() { if(this.sel) { this.money-=50; this.sel.lvl++; this.sel.dmg*=1.3; } },
    sell: function() { if(this.sel) { this.money+=40; this.towers=this.towers.filter(x=>x!==this.sel); this.sel=null; } }
};
