/* Rogue Dungeon - Flagship Roguelite Logic (Enhanced) */

let rlState = {
    canvas: null,
    ctx: null,
    tileSize: 24,
    cols: 20,
    rows: 20,
    map: [],
    visible: [],
    items: [],
    player: {
        x: 1, y: 1, 
        hp: 100, maxHp: 100, 
        xp: 0, level: 1, 
        baseDmg: 5, 
        weapon: {name: "Fists", val: 0},
        armor: {name: "Clothes", val: 0}
    },
    enemies: [],
    level: 1,
    log: []
};

function initRogue() {
    rlState.canvas = document.getElementById('rogue-canvas');
    if(!rlState.canvas) return;
    rlState.ctx = rlState.canvas.getContext('2d');
    
    document.getElementById('rl-restart').onclick = startRun;
    window.addEventListener('keydown', handleRogueInput);

    startRun();
}

function stopRogue() {
    window.removeEventListener('keydown', handleRogueInput);
}

function startRun() {
    rlState.level = 1;
    rlState.player.hp = 100;
    rlState.player.maxHp = 100;
    rlState.player.xp = 0;
    rlState.player.level = 1;
    rlState.player.baseDmg = 5;
    rlState.player.weapon = {name: "Fists", val: 0};
    rlState.player.armor = {name: "Clothes", val: 0};
    rlState.log = [];
    
    generateLevel();
    logRL("Welcome to the dungeon.");
    renderRL();
    updateRLUI();
}

function generateLevel() {
    rlState.map = Array(rlState.cols).fill().map(() => Array(rlState.rows).fill(1));
    rlState.visible = Array(rlState.cols).fill().map(() => Array(rlState.rows).fill(false));
    rlState.enemies = [];
    rlState.items = [];

    // Carve floors
    let driller = {x: 10, y: 10};
    rlState.map[driller.x][driller.y] = 0;
    for(let i=0; i<250; i++) {
        let dir = Math.floor(Math.random()*4);
        if(dir===0 && driller.x > 1) driller.x--;
        if(dir===1 && driller.x < rlState.cols-2) driller.x++;
        if(dir===2 && driller.y > 1) driller.y--;
        if(dir===3 && driller.y < rlState.rows-2) driller.y++;
        rlState.map[driller.x][driller.y] = 0;
    }
    rlState.player.x = driller.x;
    rlState.player.y = driller.y;

    // Spawn Enemies
    let enemyCount = 3 + rlState.level;
    spawnThings(enemyCount, 'enemy');

    // Spawn Items
    spawnThings(2, 'item');

    updateFOV();
}

function spawnThings(count, type) {
    for(let i=0; i<count; i++) {
        let ex, ey;
        do {
            ex = Math.floor(Math.random() * rlState.cols);
            ey = Math.floor(Math.random() * rlState.rows);
        } while(rlState.map[ex][ey] === 1 || (ex === rlState.player.x && ey === rlState.player.y));
        
        if(type === 'enemy') {
            rlState.enemies.push({x: ex, y: ey, hp: 20 + (rlState.level*5), maxHp: 20 + (rlState.level*5), name: "Goblin", dmg: 5 + rlState.level});
        } else {
            // Random item
            let isWeapon = Math.random() > 0.5;
            let val = Math.floor(Math.random() * 3) + rlState.level;
            rlState.items.push({
                x: ex, y: ey, 
                type: isWeapon ? 'weapon' : 'armor',
                val: val,
                name: (isWeapon ? "Sword +" : "Shield +") + val
            });
        }
    }
}

function handleRogueInput(e) {
    if(rlState.player.hp <= 0) return;
    
    let dx = 0, dy = 0;
    if(e.key === "ArrowUp") dy = -1;
    if(e.key === "ArrowDown") dy = 1;
    if(e.key === "ArrowLeft") dx = -1;
    if(e.key === "ArrowRight") dx = 1;

    if(dx !== 0 || dy !== 0) {
        e.preventDefault();
        movePlayer(dx, dy);
        if(rlState.player.hp > 0) moveEnemies();
        renderRL();
        updateRLUI();
    }
}

function movePlayer(dx, dy) {
    let nx = rlState.player.x + dx;
    let ny = rlState.player.y + dy;

    if(rlState.map[nx][ny] === 1) {
        logRL("Blocked.");
        return;
    }

    // Combat
    let target = rlState.enemies.find(e => e.x === nx && e.y === ny);
    if(target) {
        let totalDmg = rlState.player.baseDmg + rlState.player.weapon.val;
        target.hp -= totalDmg;
        logRL(`Hit ${target.name} for ${totalDmg}.`);
        if(target.hp <= 0) {
            logRL(`Killed ${target.name}. +10 XP`);
            rlState.enemies = rlState.enemies.filter(e => e !== target);
            gainXP(10);
            if(rlState.enemies.length === 0) {
                logRL("Area clear! Descending...");
                setTimeout(() => {
                    rlState.level++;
                    generateLevel();
                    renderRL();
                }, 1000);
            }
        }
    } else {
        // Move
        rlState.player.x = nx;
        rlState.player.y = ny;
        
        // Item Pickup
        let itemIdx = rlState.items.findIndex(i => i.x === nx && i.y === ny);
        if(itemIdx !== -1) {
            let item = rlState.items[itemIdx];
            pickupItem(item);
            rlState.items.splice(itemIdx, 1);
        }
        updateFOV();
    }
}

function pickupItem(item) {
    if(item.type === 'weapon') {
        if(item.val > rlState.player.weapon.val) {
            rlState.player.weapon = item;
            logRL(`Equipped ${item.name}!`);
        } else {
            logRL(`Found ${item.name} (worse).`);
        }
    } else {
        if(item.val > rlState.player.armor.val) {
            rlState.player.armor = item;
            logRL(`Equipped ${item.name}!`);
        } else {
            logRL(`Found ${item.name} (worse).`);
        }
    }
}

function moveEnemies() {
    rlState.enemies.forEach(e => {
        let dist = Math.abs(rlState.player.x - e.x) + Math.abs(rlState.player.y - e.y);
        
        if(dist <= 1) {
            // Attack
            let dmg = Math.max(1, e.dmg - rlState.player.armor.val);
            rlState.player.hp -= dmg;
            logRL(`${e.name} hits you for ${dmg}!`);
            if(rlState.player.hp <= 0) logRL("GAME OVER. Restart?");
        } else if(dist < 6) {
            // Chase
            let dx = rlState.player.x - e.x;
            let dy = rlState.player.y - e.y;
            let mx = 0, my = 0;
            if(Math.abs(dx) > Math.abs(dy)) mx = dx > 0 ? 1 : -1;
            else my = dy > 0 ? 1 : -1;

            if(rlState.map[e.x+mx][e.y+my] === 0 && !isOccupied(e.x+mx, e.y+my)) {
                e.x += mx;
                e.y += my;
            }
        }
    });
}

function isOccupied(x, y) {
    if(rlState.player.x === x && rlState.player.y === y) return true;
    if(rlState.enemies.find(e => e.x === x && e.y === y)) return true;
    return false;
}

function gainXP(amt) {
    rlState.player.xp += amt;
    if(rlState.player.xp >= rlState.player.level * 50) {
        rlState.player.xp = 0;
        rlState.player.level++;
        rlState.player.maxHp += 10;
        rlState.player.hp = rlState.player.maxHp;
        rlState.player.baseDmg += 2;
        logRL("Level Up! Stats increased.");
    }
}

function updateFOV() {
    let r = 5;
    for(let x = rlState.player.x - r; x <= rlState.player.x + r; x++) {
        for(let y = rlState.player.y - r; y <= rlState.player.y + r; y++) {
            if(x>=0 && x<rlState.cols && y>=0 && y<rlState.rows) {
                rlState.visible[x][y] = true;
            }
        }
    }
}

function logRL(msg) {
    rlState.log.unshift(msg);
    if(rlState.log.length > 3) rlState.log.pop();
    document.getElementById('rl-log').innerHTML = rlState.log.join("<br>");
}

function updateRLUI() {
    document.getElementById('rl-level').innerText = `Lvl: ${rlState.player.level}`;
    document.getElementById('rl-hp').innerText = `HP: ${rlState.player.hp}/${rlState.player.maxHp}`;
    let dmg = rlState.player.baseDmg + rlState.player.weapon.val;
    let def = rlState.player.armor.val;
    document.getElementById('rl-xp').innerText = `Atk: ${dmg} | Def: ${def}`;
}

function renderRL() {
    let ctx = rlState.ctx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0,0,rlState.canvas.width, rlState.canvas.height);

    let ts = rlState.tileSize;
    for(let x=0; x<rlState.cols; x++) {
        for(let y=0; y<rlState.rows; y++) {
            if(rlState.visible[x][y]) {
                if(rlState.map[x][y] === 1) ctx.fillStyle = "#444";
                else ctx.fillStyle = "#222";
                ctx.fillRect(x*ts, y*ts, ts-1, ts-1);
            }
        }
    }

    // Items
    rlState.items.forEach(i => {
        if(rlState.visible[i.x][i.y]) {
            ctx.fillStyle = i.type === 'weapon' ? "#00FF00" : "#0000FF";
            ctx.font = "16px monospace";
            ctx.fillText(i.type === 'weapon' ? "⚔️" : "🛡️", i.x*ts + 2, i.y*ts + 18);
        }
    });

    // Enemies
    rlState.enemies.forEach(e => {
        if(rlState.visible[e.x][e.y]) {
            ctx.fillStyle = "red";
            ctx.font = "bold 20px monospace";
            ctx.fillText("E", e.x*ts + 6, e.y*ts + 20);
        }
    });

    // Player
    ctx.fillStyle = "#00FFFF";
    ctx.fillRect(rlState.player.x*ts + 4, rlState.player.y*ts + 4, ts-8, ts-8);
}
