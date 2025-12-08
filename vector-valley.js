const VectorGame = {
    wave: 1, money: 0, lives: 0, waveActive: false,
    enemies: [], towers: [], projs: [], parts: [],
    path: [], q: [], sel: null, build: null,
    
    conf: {
        colors: { bg: '#100500', path: '#331100', accent: '#FF8800' },
        towers: {
            turret: { name:'Turret', cost:60, r:100, dmg:20, cd:30, color:'#FF8800' },
            sniper: { name:'Sniper', cost:150, r:300, dmg:100, cd:90, color:'#00FFFF' },
            heavy:  { name:'Heavy', cost:250, r:80, dmg:80, cd:40, color:'#FF0000' }
        }
    },
    
    init: function(canvas, diff) {
        this.reset();
        this.money = 400;
        this.lives = 20;
        this.generatePath(diff, canvas.width, canvas.height);
    },
    
    reset: function() {
        this.wave = 1; this.waveActive = false;
        this.enemies = []; this.towers = []; this.projs = []; this.parts = []; this.q = [];
        this.sel = null; this.build = null;
    },
    
    generatePath: function(diff, W, H) {
        this.path = [];
        let y = H/2;
        this.path.push({x:0, y:y});
        
        if(diff === 'easy') {
            this.path.push({x:100, y:y}); this.path.push({x:100, y:100});
            this.path.push({x:300, y:100}); this.path.push({x:300, y:500});
            this.path.push({x:500, y:500}); this.path.push({x:500, y:200});
            this.path.push({x:700, y:200}); this.path.push({x:700, y:y});
        } else if(diff === 'med') {
            this.path.push({x:200, y:y}); this.path.push({x:200, y:200});
            this.path.push({x:600, y:200}); this.path.push({x:600, y:400});
            this.path.push({x:800, y:400});
        } else {
            this.path.push({x:800, y:y});
        }
        let last = this.path[this.path.length-1];
        if(last.x < W) this.path.push({x:W, y:last.y});
    },
    
    update: function() {
        // Spawning
        if(this.waveActive && this.q.length > 0) {
            this.q[0].delay--;
            if(this.q[0].delay <= 0) {
                this.spawnEnemy(this.q.shift());
            }
        } else if(this.waveActive && this.enemies.length === 0 && this.q.length === 0) {
            this.waveActive = false;
            this.wave++;
            this.money += 100 + (this.wave*10);
        }
        
        // Logic
        this.enemies.forEach(e => this.moveEnemy(e));
        this.enemies = this.enemies.filter(e => e.active);
        this.towers.forEach(t => this.updateTower(t));
        this.projs.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            let hit = false;
            for(let e of this.enemies) {
                if((e.x-p.x)**2 + (e.y-p.y)**2 < (e.r+p.r)**2) {
                    e.hp -= p.dmg;
                    hit = true;
                    if(e.hp <= 0) this.killEnemy(e);
                    break;
                }
            }
            if(hit || p.x<0 || p.x>800 || p.y<0 || p.y>600) p.active = false;
        });
        this.projs = this.projs.filter(p => p.active);
        this.parts.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.life--; });
        this.parts = this.parts.filter(p => p.life > 0);
    },
    
    draw: function(ctx) {
        // BG
        ctx.fillStyle = this.conf.colors.bg; ctx.fillRect(0,0,800,600);
        
        // Path
        ctx.strokeStyle = this.conf.colors.path; ctx.lineWidth = 40; ctx.lineCap='round'; ctx.lineJoin='round';
        ctx.beginPath();
        if(this.path.length) { ctx.moveTo(this.path[0].x, this.path[0].y); for(let i=1;i<this.path.length;i++) ctx.lineTo(this.path[i].x, this.path[i].y); }
        ctx.stroke();
        
        // Entities
        this.towers.forEach(t => {
            ctx.fillStyle = '#222'; ctx.fillRect(t.x-15,t.y-15,30,30);
            ctx.fillStyle = t.color; ctx.fillRect(t.x-10,t.y-10,20,20);
            if(this.sel === t) { ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(t.x,t.y,t.r,0,Math.PI*2); ctx.stroke(); }
        });
        this.enemies.forEach(e => {
            ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = '#0F0'; ctx.fillRect(e.x-10,e.y-15,20*(e.hp/e.maxHp),4);
        });
        this.projs.forEach(p => { ctx.fillStyle=p.color; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); });
        this.parts.forEach(p => { ctx.fillStyle=p.color; ctx.globalAlpha=p.life/20; ctx.fillRect(p.x,p.y,2,2); ctx.globalAlpha=1; });
    },
    
    // Helpers
    startWave: function() {
        if(this.waveActive) return;
        this.waveActive = true;
        let count = 5 + Math.floor(this.wave * 1.5);
        let hp = 20 + (this.wave * 15);
        for(let i=0; i<count; i++) this.q.push({
            hp: hp, maxHp: hp, speed: 2 + (Math.random()*0.5),
            type: (i%5===0 && this.wave>3) ? 'tank' : 'norm', delay: i * 40
        });
    },
    
    spawnEnemy: function(d) {
        let s = this.path[0];
        this.enemies.push({ x:s.x, y:s.y, hp:d.hp, maxHp:d.maxHp, speed:d.speed, r:10, active:true, pathIdx:1, color:d.type==='tank'?'#F00':'#F0F', val:10 });
    },
    
    moveEnemy: function(e) {
        if(e.pathIdx >= this.path.length) { e.active = false; this.lives--; return; }
        let t = this.path[e.pathIdx];
        let dx = t.x - e.x, dy = t.y - e.y, dist = Math.sqrt(dx*dx+dy*dy);
        if(dist < e.speed) { e.x = t.x; e.y = t.y; e.pathIdx++; }
        else { e.x += (dx/dist)*e.speed; e.y += (dy/dist)*e.speed; }
    },
    
    killEnemy: function(e) { e.active = false; this.money += e.val; for(let i=0;i<5;i++) this.parts.push({x:e.x,y:e.y,vx:Math.random()-0.5,vy:Math.random()-0.5,life:20,color:e.color}); },
    
    updateTower: function(t) {
        if(t.cdCur > 0) t.cdCur--;
        else {
            let target = this.enemies.find(e => (e.x-t.x)**2 + (e.y-t.y)**2 <= t.r**2);
            if(target) {
                t.cdCur = t.cd;
                let ang = Math.atan2(target.y - t.y, target.x - t.x);
                this.projs.push({ x:t.x, y:t.y, vx:Math.cos(ang)*10, vy:Math.sin(ang)*10, r:3, color:t.color, dmg:t.dmg, active:true });
            }
        }
    },
    
    handleClick: function(mx, my) {
        // Select
        let clicked = this.towers.find(t => Math.abs(t.x-mx)<15 && Math.abs(t.y-my)<15);
        if(clicked) { this.sel = clicked; this.build = null; return; }
        
        // Build
        if(this.build) {
            let tConf = this.conf.towers[this.build];
            if(this.money >= tConf.cost) {
                // Check path proximity
                for(let i=0; i<this.path.length-1; i++) {
                     let p1=this.path[i], p2=this.path[i+1];
                     let l2=(p1.x-p2.x)**2+(p1.y-p2.y)**2, t=((mx-p1.x)*(p2.x-p1.x)+(my-p1.y)*(p2.y-p1.y))/l2;
                     t=Math.max(0,Math.min(1,t));
                     let px=p1.x+t*(p2.x-p1.x), py=p1.y+t*(p2.y-p1.y);
                     if((mx-px)**2+(my-py)**2 < 30**2) return; // Too close
                }
                this.money -= tConf.cost;
                this.towers.push({ x:mx, y:my, type:this.build, r:tConf.r, dmg:tConf.dmg, cd:tConf.cd, cdCur:0, color:tConf.color, lvl:1 });
                for(let i=0;i<8;i++) this.parts.push({x:mx,y:my,vx:Math.random()*4-2,vy:Math.random()*4-2,life:20,color:'#FFF'});
            }
        } else {
            this.sel = null;
        }
    },
    
    setBuild: function(t) { this.build = t; if(t) this.sel = null; },
    upgrade: function() { if(this.sel && this.money >= Math.floor(this.conf.towers[this.sel.type].cost*0.7*this.sel.lvl)) { this.money-=Math.floor(this.conf.towers[this.sel.type].cost*0.7*this.sel.lvl); this.sel.lvl++; this.sel.dmg*=1.5; this.sel.r+=20; this.sel.cd*=0.9; } },
    sell: function() { if(this.sel) { this.money+=Math.floor(this.conf.towers[this.sel.type].cost*0.5*this.sel.lvl); this.towers = this.towers.filter(t=>t!==this.sel); this.sel=null; } }
};
