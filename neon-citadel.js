// Neon Citadel — Flagship game with creative mechanics, elemental interactions and neon visuals.
// API: init(canvas,diff), update(), draw(ctx), click(x,y), startWave(), setBuild(k), upgrade(), sell()

const NeonCitadel = {
    canvas: null, ctx: null, gridW:20, gridH:15, cell:40,
    wave:1, money:650, lives:40, active:false, gameOver:false,
    grid:[], towers:[], enemies:[], projs:[], parts:[], floats:[], flow:{}, sel:null, build:null, q:[],
    diff:1.0,

    conf: {
        towers: {
            laser:  { name:'LASER',  cost:70,  r:100, dmg:12, cd:18, color:'#66FFCC', type:'energy' },
            gat:    { name:'GATLING',cost:160, r:80,  dmg:5,  cd:6,  color:'#FF66FF', type:'kinetic' },
            rail:   { name:'RAIL',   cost:340, r:600, dmg:160,cd:120,color:'#00FFFF', type:'pierce' },
            pulse:  { name:'PULSE',  cost:420, r:90,  dmg:44, cd:56, color:'#FFAA66', aoe:true, type:'thermal' },
            amp:    { name:'AMP',    cost:480, r:80,  dmg:0,  cd:0,  color:'#FFFF66', boost:true },
            frost:  { name:'FROST',  cost:180, r:80,  dmg:6,  cd:30, color:'#88EEFF', slow:0.55, type:'cold' },
            voider: { name:'VOID',   cost:360, r:70,  dmg:0,  cd:90, color:'#8855FF', debuff:'leech' }
        }
    },

    init: function(canvas, diff) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.diff = diff || 1.0;
        this.reset();
        this.money = 650; this.lives = 40;
        this.grid = Array(this.gridW).fill().map(()=>Array(this.gridH).fill(0));
        this.start = {x:0,y:7}; this.end = {x:19,y:7};
        this.calcFlow();
    },

    reset: function() {
        this.wave=1; this.money=650; this.lives=40; this.active=false; this.gameOver=false;
        this.grid = Array(this.gridW).fill().map(()=>Array(this.gridH).fill(0));
        this.towers=[]; this.enemies=[]; this.projs=[]; this.parts=[]; this.floats=[]; this.q=[]; this.sel=null; this.build=null;
        this.flow = {};
    },

    update: function() {
        if (this.gameOver) return;

        // spawn queue
        if (this.active && this.q.length) {
            this.q[0].d--;
            if (this.q[0].d <= 0) this.spawn(this.q.shift());
        } else if (this.active && !this.enemies.length && !this.q.length) {
            this.active = false; this.wave++; this.money += 180 + this.wave*40;
        }

        // movement
        this.enemies.forEach(e => {
            if (e.slow > 0) e.slow--;
            let gx = Math.floor(e.x/this.cell), gy = Math.floor(e.y/this.cell);
            let key = `${gx},${gy}`, next = this.flow[key];
            if (!next) {
                let tx = this.end.x*this.cell+this.cell/2, ty = this.end.y*this.cell+this.cell/2;
                let dx = tx-e.x, dy = ty-e.y, d = Math.hypot(dx,dy);
                e.x += (dx/d) * e.spd; e.y += (dy/d) * e.spd;
            } else {
                let tx = next.x*this.cell+this.cell/2, ty = next.y*this.cell+this.cell/2;
                let dx = tx-e.x, dy = ty-e.y, d = Math.hypot(dx,dy);
                if (d < e.spd) { e.x = tx; e.y = ty; }
                else { e.x += (dx/d)*e.spd; e.y += (dy/d)*e.spd; }
            }
            if (Math.hypot(e.x-(this.end.x*this.cell+this.cell/2), e.y-(this.end.y*this.cell+this.cell/2)) < 6) { e.dead=true; this.lives--; }
        });
        this.enemies = this.enemies.filter(e => !e.dead && e.hp > 0);

        // towers fire with synergy
        this.towers.forEach(t => {
            if (t.cd > 0) t.cd--;
            else {
                let conduit = 1.0;
                this.towers.forEach(n => {
                    if (n !== t && n.type === t.type && Math.abs(n.gridX - t.gridX) + Math.abs(n.gridY - t.gridY) === 1) conduit += 0.12;
                });
                let amp = 1.0;
                this.towers.forEach(n => { if (n.boost && Math.hypot(n.x - t.x, n.y - t.y) < n.r*0.9) amp *= 0.85; });

                let targets = this.enemies.filter(e => Math.hypot(e.x - t.x, e.y - t.y) <= t.r);
                if (targets.length) {
                    t.cd = Math.max(1, Math.floor(t.maxCd * amp / conduit));
                    if (t.aoe) {
                        let dmg = Math.floor(t.dmg * conduit);
                        targets.forEach(e => this.hit(e, dmg));
                        this.spawnParticles(t.x,t.y,t.color,6);
                    } else if (t.type === 'rail') {
                        let tg = targets.reduce((a,b)=>a.hp>b.hp?a:b);
                        this.projs.push({type:'beam', x:t.x, y:t.y, tx:tg.x, ty:tg.y, color:t.color, life:8});
                        this.hit(tg, Math.floor(t.dmg * conduit));
                    } else {
                        let target = targets[0];
                        this.projs.push({type:'bullet', x:t.x, y:t.y, t:target, spd:12, dmg: Math.floor(t.dmg*conduit), color:t.color, element:t.element});
                    }
                }
            }
        });

        // projectiles processing
        for (let i=this.projs.length-1;i>=0;i--) {
            let p = this.projs[i];
            if (p.type === 'beam') { p.life--; if (p.life<=0) this.projs.splice(i,1); continue; }
            if (!p.t || p.t.hp <= 0) { this.projs.splice(i,1); continue; }
            let dx = p.t.x - p.x, dy = p.t.y - p.y, dist = Math.hypot(dx,dy);
            if (dist < p.spd) {
                this.applyElementalDamage(p.t, p.dmg, p.element);
                this.spawnParticles(p.t.x,p.t.y,p.color,5);
                this.projs.splice(i,1);
            } else {
                p.x += (dx/dist)*p.spd; p.y += (dy/dist)*p.spd;
            }
        }

        // particles/floats
        for (let i=this.parts.length-1;i>=0;i--) { let P=this.parts[i]; P.x+=P.vx; P.y+=P.vy; P.life--; if (P.life<=0) this.parts.splice(i,1); }
        for (let i=this.floats.length-1;i>=0;i--) { this.floats[i].life--; if (this.floats[i].life<=0) this.floats.splice(i,1); }
    },

    applyElementalDamage: function(e, dmg, element) {
        let final = dmg;
        if (element === 'thermal') {
            e.hp -= final;
            e.burn = (e.burn || 0) + Math.floor(final * 0.25);
        } else if (element === 'cold') {
            e.hp -= final;
            e.slowTimer = Math.max(e.slowTimer||0, 30);
            e.spd *= 0.6;
        } else if (element === 'void') {
            e.hp -= Math.floor(final * 0.8);
            this.money += Math.floor(final * 0.02);
        } else {
            e.hp -= final;
        }
        if (e.hp <= 0) { e.dead = true; this.money += e.val; }
    },

    draw: function(ctx) {
        const W = this.canvas.width, H = this.canvas.height;
        let g = ctx.createLinearGradient(0,0,W,H);
        g.addColorStop(0,'#020018'); g.addColorStop(1,'#041024');
        ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

        ctx.strokeStyle = 'rgba(255,255,255,0.02)'; ctx.beginPath();
        for (let x=0;x<=W;x+=this.cell) { ctx.moveTo(x,0); ctx.lineTo(x,600); }
        for (let y=0;y<=600;y+=this.cell) { ctx.moveTo(0,y); ctx.lineTo(W,y); }
        ctx.stroke();

        ctx.fillStyle = 'rgba(0,255,255,0.04)';
        Object.values(this.flow).forEach(n => ctx.fillRect(n.x*this.cell, n.y*this.cell, this.cell, this.cell));

        this.towers.forEach(t=>{
            ctx.save();
            ctx.shadowBlur = 16; ctx.shadowColor = t.color;
            ctx.fillStyle = t.color; ctx.fillRect(t.x-14,t.y-14,28,28);
            ctx.restore();
            ctx.fillStyle = '#000'; ctx.fillRect(t.x-10,t.y-10,20,20);
            if (this.sel === t) {
                ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.beginPath();
                ctx.arc(t.x, t.y, t.r, 0, Math.PI*2); ctx.stroke();
            }
        });

        this.enemies.forEach(e=>{
            ctx.save();
            ctx.shadowBlur = 10; ctx.shadowColor = e.color; ctx.fillStyle = e.color;
            if (e.type==='elite') ctx.fillRect(e.x-10,e.y-10,20,20); else ctx.beginPath(), ctx.arc(e.x,e.y,8,0,Math.PI*2), ctx.fill();
            ctx.restore();
            ctx.fillStyle = '#222'; ctx.fillRect(e.x-8,e.y-14,16,3);
            ctx.fillStyle = '#0f0'; ctx.fillRect(e.x-8,e.y-14,16*(e.hp/e.maxHp),3);
        });

        this.projs.forEach(p => {
            if (p.type==='beam') { ctx.strokeStyle = p.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(p.tx,p.ty); ctx.stroke(); }
            else { ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x,p.y,3,0,Math.PI*2); ctx.fill(); }
        });

        this.parts.forEach(p => { ctx.fillStyle = p.color; ctx.globalAlpha = p.life/20; ctx.fillRect(p.x,p.y,2,2); ctx.globalAlpha = 1; });
        ctx.fillStyle = '#fff'; ctx.font='12px monospace';
        this.floats.forEach(f => ctx.fillText(f.val, f.x, f.y));

        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(10,10,200,50);
        ctx.fillStyle = '#fff'; ctx.fillText(`Wave ${this.wave}`,20,32);
        ctx.fillStyle = '#FFD700'; ctx.fillText(`$${Math.floor(this.money)}`,110,32);
    },

    startWave: function() {
        if (this.active) return;
        this.active = true;
        let count = 10 + Math.floor(this.wave*3*this.diff);
        for (let i=0;i<count;i++) {
            let type='norm', spd = 1.8 + Math.random()*0.6, hp = 20 + this.wave*18;
            if (this.wave > 4 && i % 7 === 0) { type = 'elite'; hp *= 2.6; spd *= 0.7; }
            if (this.wave > 2 && i % 5 === 0) { type = 'shield'; hp *= 1.6; }
            if (this.wave > 6 && i % 4 === 0) { type = 'fast'; hp *= 0.6; spd *= 2.0; }
            let color = type==='elite' ? '#FF3366' : (type==='fast' ? '#FFD100' : '#FF55FF');
            this.q.push({d: i*16 + Math.floor(Math.random()*6), type:type, hp:hp, maxHp:hp, spd:spd, color:color, val:12});
        }
    },

    spawn: function(d) {
        this.enemies.push({x:this.start.x*this.cell+this.cell/2, y:this.start.y*this.cell+this.cell/2, hp:d.hp, maxHp:d.maxHp, spd:d.spd, type:d.type, color:d.color, val:d.val, slow:0});
    },

    click: function(px, py) {
        let gx = Math.floor(px/this.cell), gy = Math.floor(py/this.cell);
        if (gx<0||gx>=this.gridW||gy<0||gy>=this.gridH) return;
        let found = this.towers.find(t => t.gridX === gx && t.gridY === gy);
        if (found) { this.sel = found; this.build = null; return; }

        if (this.active) return;
        if (this.build) {
            let def = this.conf.towers[this.build];
            if (this.money < def.cost) { this.build = null; return; }
            if ((gx===this.start.x && gy===this.start.y) || (gx===this.end.x && gy===this.end.y)) return;
            this.grid[gx][gy] = 1;
            if (!this.calcFlow()) { this.grid[gx][gy] = 0; return; }
            this.money -= def.cost;
            let tx = gx*this.cell + this.cell/2, ty = gy*this.cell + this.cell/2;
            this.towers.push({x:tx,y:ty,gridX:gx,gridY:gy,type:this.build,name:def.name,color:def.color,dmg:def.dmg,maxCd:def.cd,cd:0,r:def.r,level:1,aoe:def.aoe||false,boost:def.boost||false,element:def.type});
            this.spawnParticles(tx,ty,'#fff',10);
            this.build = null;
        } else {
            this.sel = null;
        }
    },

    setBuild: function(k) { this.build = k; this.sel = null; },

    upgrade: function() {
        if (!this.sel) return;
        let def = this.conf.towers[this.sel.type];
        let cost = Math.floor(def.cost * 0.75 * this.sel.level);
        if (this.money < cost) return;
        this.money -= cost;
        this.sel.level++; this.sel.dmg = Math.floor(this.sel.dmg*1.5); this.sel.r += 8; this.sel.maxCd = Math.max(3, Math.floor(this.sel.maxCd*0.92));
        this.spawnParticles(this.sel.x,this.sel.y,this.sel.color,12);
    },

    sell: function() {
        if (!this.sel) return;
        let def = this.conf.towers[this.sel.type];
        let refund = Math.floor(def.cost * 0.55 * this.sel.level);
        this.money += refund;
        this.grid[this.sel.gridX][this.sel.gridY] = 0;
        this.towers = this.towers.filter(t => t !== this.sel);
        this.sel = null;
        this.calcFlow();
    },

    calcFlow: function() {
        let gridOcc = Array.from({length:this.gridW}, ()=>Array(this.gridH).fill(false));
        for (let x=0;x<this.gridW;x++) for (let y=0;y<this.gridH;y++) if (this.grid[x][y]) gridOcc[x][y] = true;
        this.towers.forEach(t => gridOcc[t.gridX][t.gridY] = true);
        let q = [{x:this.end.x,y:this.end.y}], came = {};
        came[`${this.end.x},${this.end.y}`] = null;
        while (q.length) {
            let c = q.shift();
            if (c.x===this.start.x && c.y===this.start.y) break;
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(d=>{
                let nx = c.x + d[0], ny = c.y + d[1];
                if (nx>=0 && nx<this.gridW && ny>=0 && ny<this.gridH && !gridOcc[nx][ny]) {
                    let k = `${nx},${ny}`;
                    if (!(k in came)) { came[k] = c; q.push({x:nx,y:ny}); }
                }
            });
        }
        if (!(`${this.start.x},${this.start.y}` in came)) return false;
        this.flow = {};
        for (let key in came) {
            let parts = key.split(','); let cx = +parts[0], cy = +parts[1];
            let prev = came[key];
            if (prev) this.flow[key] = {x: prev.x, y: prev.y};
            else this.flow[key] = {x: this.start.x, y: this.start.y};
        }
        return true;
    },

    hit: function(e,dmg) { this.applyElementalDamage(e,dmg,null); },

    applyElementalDamage: function(e, dmg, element) {
        e.hp -= dmg;
        if (e.hp <= 0) { e.dead = true; this.money += e.val; }
    },

    spawn: function(d) {
        this.enemies.push({x:this.start.x*this.cell+this.cell/2, y:this.start.y*this.cell+this.cell/2, hp:d.hp, maxHp:d.maxHp, spd:d.spd, type:d.type, color:d.color, val:d.val, slow:0});
    },

    spawnParticles: function(x,y,c,n) { for (let i=0;i<n;i++) this.parts.push({x:x+Math.random()*6-3,y:y+Math.random()*6-3,vx:(Math.random()-0.5)*2,vy:(Math.random()-0.5)*2,life:10+Math.floor(Math.random()*10),color:c}); }
};

// Expose global names used by the page
const NeonGame = NeonCitadel;
if (typeof window !== 'undefined') window.NeonGame = NeonCitadel;
if (typeof module !== 'undefined') module.exports = NeonCitadel;
