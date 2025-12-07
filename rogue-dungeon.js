/* Rogue Dungeon - Flagship Roguelite Logic */

let rlState = {
    canvas: null,
    ctx: null,
    tileSize: 24,
    cols: 20,
    rows: 20,
    map: [],
    visible: [],
    player: {x: 1, y: 1, hp: 100, maxHp: 100, xp: 0, level: 1, dmg: 10},
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
    generateLevel();
    logRL("You enter the dark dungeon...");
    renderRL();
    updateRLUI();
}

function generateLevel() {
    // Simple Cellular Automata or Random Walk
    rlState.map = Array(rlState.cols).fill().map(() => Array(rlState.rows).fill(1)); // 1 = Wall
    rlState.visible = Array(rlState.cols).fill().map(() => Array(rlState.rows).fill(false));
    rlState.enemies = [];

    // Carve floors (0)
    let driller = {x: 10, y: 10};
    rlState.map[driller.x][driller.y] = 0;
    for(let i=0; i<200; i++) {
        let dir = Math.floor(Math.random()*4);
        if(dir===0 && driller.x > 1) driller.x--;
        if(dir===1 && driller.x < rlState.cols-2) driller.x++;
        if(dir===2 && driller.y > 1) driller.y--;
        if(dir===3 && driller.y < rlState.rows-2) driller.y++;
        rlState.map[driller.x][driller.y] = 0;
    }

    // Place Player
    rlState.player.x = driller.x;
    rlState.player.y = driller.y; // Start at end of drill

    // Place Enemies
    let enemyCount = 3 + rlState.level;
    for(let i=0; i<enemyCount; i++) {
        let ex, ey;
        do {
            ex = Math.floor(Math.random() * rlState.cols);
            ey = Math.floor(Math.random() * rlState.rows);
        } while(rlState.map[ex][ey] === 1 || (ex === rlState.player.x && ey === rlState.player.y));
        
        rlState.enemies.push({x: ex, y: ey, hp: 20 + (rlState.level*5), maxHp: 20 + (rlState.level*5), name: "Goblin"});
    }

    updateFOV();
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
        moveEnemies();
        renderRL();
    }
}

function movePlayer(dx, dy) {
    let nx = rlState.player.x + dx;
    let ny = rlState.player.y + dy;

    if(rlState.map[nx][ny] === 1) {
        logRL("You bump into a wall.");
        return;
    }

    let target = rlState.enemies.find(e => e.x === nx && e.y === ny);
    if(target) {
        // Attack
        target.hp -= rlState.player.dmg;
        logRL(`You hit ${target.name} for ${rlState.player.dmg} dmg.`);
        if(target.hp <= 0) {
            logRL(`${target.name} dies! +10 XP`);
            rlState.enemies = rlState.enemies.filter(e => e !== target);
            gainXP(10);
            if(rlState.enemies.length === 0) {
                logRL("Level Cleared! Descending...");
                setTimeout(() => {
                    rlState.level++;
                    generateLevel();
                    renderRL();
                    updateRLUI();
                }, 1000);
            }
        }
    } else {
        rlState.player.x = nx;
        rlState.player.y = ny;
        updateFOV();
    }
}

function moveEnemies() {
    rlState.enemies.forEach(e => {
        let dx = rlState.player.x - e.x;
        let dy = rlState.player.y - e.y;
        
        // Simple AI: Move closer if visible/close
        if(Math.abs(dx) <= 5 && Math.abs(dy) <= 5) {
            if(Math.abs(dx) + Math.abs(dy) === 1) {
                // Attack Player
                let dmg = 2 + rlState.level;
                rlState.player.hp -= dmg;
                logRL(`${e.name} hits you for ${dmg} dmg!`);
                updateRLUI();
                if(rlState.player.hp <= 0) {
                    logRL("You died! Press Restart.");
                }
            } else {
                let mx = 0, my = 0;
                if(Math.abs(dx) > Math.abs(dy)) mx = dx > 0 ? 1 : -1;
                else my = dy > 0 ? 1 : -1;

                if(rlState.map[e.x+mx][e.y+my] === 0 && !(e.x+mx === rlState.player.x && e.y+my === rlState.player.y)) {
                     // Basic anti-stacking check needed in real game
                     e.x += mx;
                     e.y += my;
                }
            }
        }
    });
}

function gainXP(amt) {
    rlState.player.xp += amt;
    if(rlState.player.xp >= rlState.player.level * 50) {
        rlState.player.xp = 0;
        rlState.player.level++;
        rlState.player.maxHp += 10;
        rlState.player.hp = rlState.player.maxHp;
        rlState.player.dmg += 2;
        logRL("Level Up! You feel stronger.");
    }
    updateRLUI();
}

function updateFOV() {
    // Simple radius clear
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
    document.getElementById('rl-level').innerText = "Lvl: " + rlState.level;
    document.getElementById('rl-hp').innerText = `HP: ${rlState.player.hp}/${rlState.player.maxHp}`;
    document.getElementById('rl-xp').innerText = "XP: " + rlState.player.xp;
}

function renderRL() {
    let ctx = rlState.ctx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0,0,rlState.canvas.width, rlState.canvas.height);

    let ts = rlState.tileSize;
    for(let x=0; x<rlState.cols; x++) {
        for(let y=0; y<rlState.rows; y++) {
            if(rlState.visible[x][y]) {
                if(rlState.map[x][y] === 1) ctx.fillStyle = "#444"; // Wall
                else ctx.fillStyle = "#222"; // Floor
                ctx.fillRect(x*ts, y*ts, ts-1, ts-1);
            }
        }
    }

    // Enemies
    rlState.enemies.forEach(e => {
        if(rlState.visible[e.x][e.y]) {
            ctx.fillStyle = "red";
            ctx.fillText("E", e.x*ts + 6, e.y*ts + 16);
        }
    });

    // Player
    ctx.fillStyle = "#00FFFF";
    ctx.fillRect(rlState.player.x*ts + 4, rlState.player.y*ts + 4, ts-8, ts-8);
}
