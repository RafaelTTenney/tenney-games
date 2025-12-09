const SentinelGame = {
    wave: 1, money: 0, lives: 0, diff: 1.0,
    enemies: [], towers: [], projs: [], parts: [],
    start: {x:0, y:10}, end: {x:29, y:10}, paths: [],
    active: false, gameOver: false, q: [],
    sel: null, build: null,
    
    conf: {
        towers: {
            blaster: { name:'BLASTER', cost:50, r:4, dmg:15, cd:25, color:'#0F0' },
            sniper: { name:'SNIPER', cost:120, r:9, dmg:80, cd:80, color:'#0FF' },
            rapid: { name:'RAPID', cost:100, r:3, dmg:5, cd:6, color:'#FF0' }
        }
    },

    init: function(c, diff) {
        this.reset();
        this.diff = diff;
        this.money = 250;
        this.lives = 20;
        this.updatePath();
    },

    reset: function() {
        this.wave=1; this.active=false; this.gameOver=false;
        this.enemies=[]; this.towers=[]; this.projs=[]; this.parts=[]; this.q=[];
        this.sel=null; this.build=null;
    },

    updatePath: function() {
        let grid = Array(30).fill().map(() => Array(20).fill(false));
        this.towers.forEach(t => grid[t.x][t.y] = true);
        
        let q = [this.start], came = {};
        came[`${this.start.x},${this.start.y}`] = null;
        
        // BFS from START to END
        let found = false;
        while(q.length) {
            let c = q.shift();
            if(c.x===this.end.x && c.y===this.end.y) { found=true; break; }
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(d => {
                let n={x:c.x+d.x, y:c.y+d.y};
                if(n.x>=0 && n.x<30 && n.y>=0 && n.y<20 && !grid[n.x][n.y]) {
                    let k = `${n.x},${n.y}`;
                    if(!(k in came)) { came[k]=c; q.push(n); }
                }
            });
        }
        
        if(!found) return false;
        
        // Reconstruct
        let path = [], c = this.end;
        while(c) {
            path.push(c);
            c = came[`${c.x},${c.y}`];
        }
        this.paths = path.reverse();
        return true;
    },

    update: function() {
        if(this.gameOver) return;
        
        // Spawn
        if(this.active && this.q.length) {
            this.q[0].d--;
            if(this.q[0].d<=0) this.enemies.push(this.q.shift());
        } else if(this.active && !this.enemies.length && !this.q.length) {
            this.active = false; this.wave++; this.money += 100 + (this.wave*10);
        }

        // Enemies
        this.enemies.forEach(e => {
            if(e.pidx >= this.paths.length) { e.dead=true; this.lives--; return; }
            let t = this.paths[e.pidx];
            let tx = t.x*20+10, ty = t.y*20+10;
            let dx=tx-e.x, dy=ty-e.y;
            let d=Math.sqrt(dx*dx+dy*dy);
            if(d<e.spd) { e.x=tx; e.y=ty; e.pidx++; }
            else { e.x+=(dx/d)*e.spd; e.y+=(dy/d)*e.spd; }
        });
        this.enemies = this.enemies.filter(e => !e.dead);

        // Towers
        this.towers.forEach(t => {
            if(t.cd>0) t.cd--;
            else {
                let target = this.enemies.find(e => (e.x-(t.x*20+10))**2 + (e.y-(t.y*20+10))**2 < (t.r*20)**2);
                if(target) {
                    t.cd = t.maxCd;
                    this.projs.push({x:t.x*20+10, y:t.y*20+10, t:target, spd:8, dmg:t.dmg, color:t.color});
                }
            }
        });

        // Projs
        this.projs.forEach(p => {
            if(!p.t || p.t.dead) { p.dead=true; return; }
            let dx=p.t.x-p.x, dy=p.t.y-p.y;
            let d=Math.sqrt(dx*dx+dy*dy);
            if(d<p.spd) {
                p.t.hp -= p.dmg;
                if(p.t.hp<=0) { p.t.dead=true; this.money+=p.t.val; this.explode(p.t.x,p.t.y,p.t.color); }
                p.dead=true;
            } else {
                p.x+=(dx/d)*p.spd; p.y+=(dy/d)*p.spd;
            }
        });
        this.projs = this.projs.filter(p => !p.dead);

        // Particles
        this.parts.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.life--; });
        this.parts = this.parts.filter(p => p.life>0);
    },

    draw: function(ctx) {
        ctx.fillStyle = '#051505'; ctx.fillRect(0,0,800,600);
        
        // Grid
        ctx.strokeStyle = '#003300'; ctx.beginPath();
        for(let i=0;i<=30;i++) { ctx.moveTo(i*20,0); ctx.lineTo(i*20,400); } // 400 height for Sentinel
        for(let i=0;i<=20;i++) { ctx.moveTo(0,i*20); ctx.lineTo(600,i*20); }
        ctx.stroke();

        // Path
        ctx.fillStyle = 'rgba(0,255,0,0.1)';
        this.paths.forEach(p => ctx.fillRect(p.x*20, p.y*20, 20, 20));

        // Start/End
        ctx.fillStyle = '#00F'; ctx.fillRect(this.start.x*20, this.start.y*20, 20, 20);
        ctx.fillStyle = '#F00'; ctx.fillRect(this.end.x*20, this.end.y*20, 20, 20);

        // Towers
        this.towers.forEach(t => {
            ctx.fillStyle = t.color; ctx.fillRect(t.x*20+2, t.y*20+2, 16, 16);
            if(this.sel===t) { ctx.strokeStyle='#FFF'; ctx.strokeRect(t.x*20,t.y*20,20,20); }
        });

        // Enemies
        this.enemies.forEach(e => {
            ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x, e.y, 6, 0, 7); ctx.fill();
            ctx.fillStyle = '#F00'; ctx.fillRect(e.x-6,e.y-8,12,2);
            ctx.fillStyle = '#0F0'; ctx.fillRect(e.x-6,e.y-8,12*(e.hp/e.maxHp),2);
        });

        // Projs
        this.projs.forEach(p => { ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,3,0,7); ctx.fill(); });
        
        // Parts
        this.parts.forEach(p => { ctx.fillStyle=p.color; ctx.fillRect(p.x,p.y,2,2); });
    },

    startWave: function() {
        if(this.active) return;
        this.active = true;
        let count = 5 + this.wave*2;
        let hp = (20 + this.wave*10) * this.diff;
        for(let i=0; i<count; i++) {
            this.q.push({
                d: i*20, x:this.start.x*20+10, y:this.start.y*20+10, pidx:0,
                hp:hp, maxHp:hp, spd:1.5, color:this.wave%5===0?'#F00':'#F0F', val:5, dead:false
            });
        }
    },

    click: function(x,y) {
        let gx = Math.floor(x/20), gy = Math.floor(y/20);
        if(gx<0||gx>=30||gy<0||gy>=20) return;

        let t = this.towers.find(t => t.x===gx && t.y===gy);
        if(t) { this.sel=t; this.build=null; return; }

        if(this.build) {
            let def = this.conf.towers[this.build];
            if(this.money >= def.cost) {
                if(gx===this.end.x && gy===this.end.y) return;
                
                // Temp Place
                this.towers.push({x:gx, y:gy, type:this.build, dmg:def.dmg, r:def.r, maxCd:def.cd, cd:0, color:def.color, lvl:1});
                if(!this.updatePath()) {
                    this.towers.pop(); // Blocked path
                } else {
                    this.money -= def.cost;
                    this.explode(gx*20+10, gy*20+10, '#FFF');
                }
            }
        } else { this.sel=null; }
    },
    
    setBuild: function(k) { this.build=k; if(k) this.sel=null; },
    upgrade: function() { if(this.sel) { this.money-=50; this.sel.lvl++; this.sel.dmg*=1.3; } },
    sell: function() { if(this.sel) { this.money+=25; this.towers=this.towers.filter(x=>x!==this.sel); this.sel=null; this.updatePath(); } },
    explode: function(x,y,c) { for(let i=0;i<6;i++) this.parts.push({x:x,y:y,vx:(Math.random()-.5)*4,vy:(Math.random()-.5)*4,life:15,color:c}); }
};
