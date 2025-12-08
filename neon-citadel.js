const NeonGame = {
    wave: 1, money: 0, lives: 0, waveActive: false,
    enemies: [], towers: [], projs: [], parts: [],
    grid: [], flowField: {}, startNode: {x:0,y:0}, endNode: {x:0,y:0},
    q: [], sel: null, build: null,
    
    conf: {
        grid: 40,
        colors: { bg: '#000500', grid: '#002200', accent: '#00FF00' },
        towers: {
            prism: { name:'Prism', cost:80, r:120, dmg:5, cd:5, color:'#00FF00' },
            pulse: { name:'Pulse', cost:180, r:100, dmg:40, cd:50, color:'#FF00FF' },
            rail:  { name:'Rail', cost:300, r:400, dmg:200, cd:120, color:'#0088FF' },
            buff:  { name:'Node', cost:400, r:80, dmg:0, cd:0, color:'#FFFF00' }
        }
    },
    
    init: function(canvas) {
        this.reset();
        this.money = 600;
        this.lives = 50;
        
        let cols = canvas.width / 40, rows = canvas.height / 40;
        this.grid = Array(cols).fill().map(() => Array(rows).fill(0));
        this.startNode = {x:0, y:Math.floor(rows/2)};
        this.endNode = {x:cols-1, y:Math.floor(rows/2)};
        this.updatePath();
    },
    
    reset: function() {
        this.wave = 1; this.waveActive = false;
        this.enemies = []; this.towers = []; this.projs = []; this.parts = []; this.q = [];
        this.sel = null; this.build = null;
    },
    
    updatePath: function() {
        let cols = this.grid.length, rows = this.grid[0].length;
        let q = [this.endNode], cameFrom = {};
        cameFrom[`${this.endNode.x},${this.endNode.y}`] = null;
        
        while(q.length) {
            let curr = q.shift();
            if(curr.x===this.startNode.x && curr.y===this.startNode.y) break;
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(d => {
                let nx=curr.x+d[0], ny=curr.y+d[1];
                if(nx>=0 && nx<cols && ny>=0 && ny<rows && this.grid[nx][ny]===0) {
                    let k=`${nx},${ny}`;
                    if(!(k in cameFrom)) { cameFrom[k]=curr; q.push({x:nx, y:ny}); }
                }
            });
        }
        this.flowField = cameFrom;
        return `${this.startNode.x},${this.startNode.y}` in cameFrom;
    },
    
    update: function() {
        if(this.waveActive && this.q.length) {
            this.q[0].delay--;
            if(this.q[0].delay <= 0) this.spawnEnemy(this.q.shift());
        } else if(this.waveActive && !this.enemies.length && !this.q.length) {
            this.waveActive = false; this.wave++; this.money += 100 + (this.wave*10);
        }
        
        this.enemies.forEach(e => this.moveEnemy(e));
        this.enemies = this.enemies.filter(e => e.active);
        this.towers.forEach(t => this.updateTower(t));
        
        this.projs.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if(p.type === 'rail') p.life--; 
            else {
                let hit=false;
                for(let e of this.enemies) {
                    if((e.x-p.x)**2+(e.y-p.y)**2 < (e.r+p.r)**2) { e.hp-=p.dmg; hit=true; if(e.hp<=0) this.killEnemy(e); break; }
                }
                if(hit || p.x<0 || p.x>800 || p.y<0 || p.y>600) p.active=false;
            }
        });
        this.projs = this.projs.filter(p => p.active || (p.type==='rail' && p.life>0));
        this.parts.forEach(p => { p.x+=p.vx; p.y+=p.vy; p.life--; });
        this.parts = this.parts.filter(p => p.life > 0);
    },
    
    draw: function(ctx) {
        ctx.fillStyle = this.conf.colors.bg; ctx.fillRect(0,0,800,600);
        
        // Grid
        ctx.strokeStyle = this.conf.colors.grid; ctx.lineWidth = 1; ctx.beginPath();
        for(let x=0;x<=800;x+=40) { ctx.moveTo(x,0); ctx.lineTo(x,600); }
        for(let y=0;y<=600;y+=40) { ctx.moveTo(0,y); ctx.lineTo(800,y); }
        ctx.stroke();
        
        ctx.fillStyle='#00F'; ctx.fillRect(this.startNode.x*40, this.startNode.y*40, 40, 40);
        ctx.fillStyle='#F00'; ctx.fillRect(this.endNode.x*40, this.endNode.y*40, 40, 40);
        
        this.towers.forEach(t => {
            ctx.fillStyle = '#222'; ctx.fillRect(t.x-15,t.y-15,30,30);
            ctx.fillStyle = t.color; ctx.fillRect(t.x-10,t.y-10,20,20);
            if(t.type === 'prism') {
                ctx.strokeStyle = t.color; ctx.lineWidth = 1;
                this.towers.forEach(t2 => { if(t!==t2 && t2.type==='prism' && (t.x-t2.x)**2+(t.y-t2.y)**2 < 100**2) { ctx.beginPath(); ctx.moveTo(t.x,t.y); ctx.lineTo(t2.x,t2.y); ctx.stroke(); } });
            }
            if(this.sel === t) { ctx.strokeStyle='rgba(255,255,255,0.3)'; ctx.beginPath(); ctx.arc(t.x,t.y,t.r,0,Math.PI*2); ctx.stroke(); }
        });
        
        this.enemies.forEach(e => {
            ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x,e.y,e.r,0,Math.PI*2); ctx.fill();
            ctx.fillStyle = '#0F0'; ctx.fillRect(e.x-10,e.y-15,20*(e.hp/e.maxHp),4);
        });
        
        this.projs.forEach(p => {
            ctx.fillStyle=p.color; ctx.strokeStyle=p.color;
            if(p.type==='rail') { ctx.lineWidth=2; ctx.globalAlpha=p.life/10; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.tx,p.ty); ctx.stroke(); ctx.globalAlpha=1; }
            else { ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); }
        });
        this.parts.forEach(p => { ctx.fillStyle=p.color; ctx.globalAlpha=p.life/20; ctx.fillRect(p.x,p.y,2,2); ctx.globalAlpha=1; });
    },
    
    startWave: function() {
        if(this.waveActive) return;
        this.waveActive = true;
        let count = 5 + Math.floor(this.wave * 1.5), hp = 20 + (this.wave * 15);
        for(let i=0; i<count; i++) this.q.push({ hp: hp, maxHp: hp, speed: 1.5 + (Math.random()*0.5), type: (i%5===0 && this.wave>3) ? 'tank' : 'norm', delay: i * 40 });
    },
    
    spawnEnemy: function(d) {
        this.enemies.push({ x:this.startNode.x*40+20, y:this.startNode.y*40+20, hp:d.hp, maxHp:d.maxHp, speed:d.speed, r:10, active:true, color:d.type==='tank'?'#F00':'#F0F', val:10 });
    },
    
    moveEnemy: function(e) {
        let gx = Math.floor(e.x/40), gy = Math.floor(e.y/40);
        if(gx === this.endNode.x && gy === this.endNode.y) { e.active = false; this.lives--; return; }
        let next = this.flowField[`${gx},${gy}`];
        if(next) {
            let tx = next.x * 40 + 20, ty = next.y * 40 + 20;
            let dx = tx - e.x, dy = ty - e.y, dist = Math.sqrt(dx*dx+dy*dy);
            e.x += (dx/dist)*e.speed; e.y += (dy/dist)*e.speed;
        } else { e.x += e.speed; }
    },
    
    killEnemy: function(e) { e.active = false; this.money += e.val; for(let i=0;i<5;i++) this.parts.push({x:e.x,y:e.y,vx:Math.random()-0.5,vy:Math.random()-0.5,life:20,color:e.color}); },

    updateTower: function(t) {
        if(t.cdCur > 0) t.cdCur--;
        else {
            let target = this.enemies.find(e => (e.x-t.x)**2 + (e.y-t.y)**2 <= t.r**2);
            if(target) {
                t.cdCur = t.cd;
                let mult = 1;
                this.towers.forEach(b => { if(b.type==='buff' && (b.x-t.x)**2+(b.y-t.y)**2 < b.r**2) mult += 0.5; });
                
                if(t.type === 'rail') {
                    this.projs.push({x:t.x,y:t.y,tx:target.x,ty:target.y,type:'rail',life:10,color:t.color});
                    this.enemies.forEach(e => { if((e.x-t.x)**2+(e.y-t.y)**2 < t.r**2) { e.hp -= t.dmg*mult; if(e.hp<=0) this.killEnemy(e); } });
                } else if(t.type !== 'buff') {
                    let ang = Math.atan2(target.y - t.y, target.x - t.x);
                    this.projs.push({x:t.x,y:t.y,vx:Math.cos(ang)*10,vy:Math.sin(ang)*10,r:3,color:t.color,dmg:t.dmg*mult,active:true});
                }
            }
        }
    },
    
    handleClick: function(mx, my) {
        let clicked = this.towers.find(t => Math.abs(t.x-mx)<15 && Math.abs(t.y-my)<15);
        if(clicked) { this.sel = clicked; this.build = null; return; }
        
        if(this.build) {
            let gx = Math.floor(mx/40), gy = Math.floor(my/40);
            if(this.grid[gx][gy]) return;
            if((gx===this.startNode.x && gy===this.startNode.y) || (gx===this.endNode.x && gy===this.endNode.y)) return;
            
            this.grid[gx][gy] = 1;
            if(!this.updatePath()) { this.grid[gx][gy] = 0; return; }
            
            let tConf = this.conf.towers[this.build];
            if(this.money >= tConf.cost) {
                this.money -= tConf.cost;
                this.towers.push({x:gx*40+20,y:gy*40+20,type:this.build,r:tConf.r,dmg:tConf.dmg,cd:tConf.cd,cdCur:0,color:tConf.color,lvl:1});
            } else { this.grid[gx][gy] = 0; }
        } else { this.sel = null; }
    },
    
    setBuild: function(t) { this.build = t; if(t) this.sel = null; },
    upgrade: function() { if(this.sel && this.money >= Math.floor(this.conf.towers[this.sel.type].cost*0.7*this.sel.lvl)) { this.money-=Math.floor(this.conf.towers[this.sel.type].cost*0.7*this.sel.lvl); this.sel.lvl++; this.sel.dmg*=1.5; this.sel.r+=20; this.sel.cd*=0.9; } },
    sell: function() { if(this.sel) { this.money+=Math.floor(this.conf.towers[this.sel.type].cost*0.5*this.sel.lvl); this.towers=this.towers.filter(t=>t!==this.sel); this.grid[Math.floor(this.sel.x/40)][Math.floor(this.sel.y/40)]=0; this.updatePath(); this.sel=null; } }
};
