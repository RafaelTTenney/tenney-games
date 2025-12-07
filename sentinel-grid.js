/* Sentinel Grid - Flagship Tower Defense Logic */

let tdState = {
    canvas: null,
    ctx: null,
    gridSize: 20,
    cols: 30,
    rows: 20,
    towers: [],
    enemies: [],
    projectiles: [],
    wave: 1,
    money: 100,
    lives: 20,
    running: false,
    gameLoopId: null,
    path: [],
    start: {x: 0, y: 10},
    end: {x: 29, y: 10},
    waveActive: false,
    enemiesToSpawn: 0,
    spawnTimer: 0
};

function initSentinel() {
    tdState.canvas = document.getElementById('sentinel-canvas');
    if(!tdState.canvas) return;
    tdState.ctx = tdState.canvas.getContext('2d');
    
    // UI Binds
    document.getElementById('td-start-wave').onclick = startWave;
    document.getElementById('td-reset').onclick = resetTD;
    document.getElementById('td-build-basic').onclick = () => { /* Select mode logic could go here */ };
    tdState.canvas.onclick = handleGridClick;

    resetTD();
    renderTD();
}

function stopSentinel() {
    tdState.running = false;
    cancelAnimationFrame(tdState.gameLoopId);
}

function resetTD() {
    tdState.towers = [];
    tdState.enemies = [];
    tdState.projectiles = [];
    tdState.wave = 1;
    tdState.money = 150;
    tdState.lives = 20;
    tdState.waveActive = false;
    tdState.enemiesToSpawn = 0;
    
    updatePath();
    updateUI();
    
    tdState.running = true;
    loopTD();
}

function startWave() {
    if(tdState.waveActive) return;
    tdState.waveActive = true;
    tdState.enemiesToSpawn = 5 + (tdState.wave * 2);
    tdState.spawnTimer = 0;
}

function updateUI() {
    document.getElementById('td-wave').innerText = "Wave: " + tdState.wave;
    document.getElementById('td-money').innerText = "$: " + tdState.money;
    document.getElementById('td-lives').innerText = "Lives: " + tdState.lives;
}

/* --- Core Loop --- */
function loopTD() {
    if(!tdState.running) return;
    
    updateTD();
    renderTD();
    tdState.gameLoopId = requestAnimationFrame(loopTD);
}

function updateTD() {
    // Spawning
    if(tdState.waveActive && tdState.enemiesToSpawn > 0) {
        tdState.spawnTimer++;
        if(tdState.spawnTimer > 40) { // Spawn rate
            spawnEnemy();
            tdState.enemiesToSpawn--;
            tdState.spawnTimer = 0;
        }
    } else if (tdState.waveActive && tdState.enemiesToSpawn === 0 && tdState.enemies.length === 0) {
        tdState.waveActive = false;
        tdState.wave++;
        tdState.money += 50 + (tdState.wave * 10);
        updateUI();
    }

    // Update Enemies
    for(let i = tdState.enemies.length - 1; i >= 0; i--) {
        let e = tdState.enemies[i];
        moveEnemy(e);
        if(e.reachedEnd) {
            tdState.lives--;
            tdState.enemies.splice(i, 1);
            updateUI();
            if(tdState.lives <= 0) {
                alert("Game Over! Wave: " + tdState.wave);
                resetTD();
            }
        } else if(e.hp <= 0) {
            tdState.money += e.reward;
            tdState.enemies.splice(i, 1);
            updateUI();
        }
    }

    // Towers Fire
    tdState.towers.forEach(t => {
        if(t.cooldown > 0) t.cooldown--;
        else {
            let target = getTarget(t);
            if(target) {
                fireProjectile(t, target);
                t.cooldown = t.maxCooldown;
            }
        }
    });

    // Projectiles
    for(let i = tdState.projectiles.length - 1; i >= 0; i--) {
        let p = tdState.projectiles[i];
        let dx = p.target.x - p.x;
        let dy = p.target.y - p.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        
        if(dist < p.speed) {
            p.target.hp -= p.damage;
            tdState.projectiles.splice(i, 1);
        } else {
            p.x += (dx/dist) * p.speed;
            p.y += (dy/dist) * p.speed;
        }
    }
}

/* --- Entities & Logic --- */
function spawnEnemy() {
    let hp = 20 + (tdState.wave * 10);
    tdState.enemies.push({
        x: tdState.start.x * tdState.gridSize + 10,
        y: tdState.start.y * tdState.gridSize + 10,
        gridX: tdState.start.x,
        gridY: tdState.start.y,
        hp: hp,
        maxHp: hp,
        speed: 2,
        pathIndex: 0,
        reward: 5,
        reachedEnd: false
    });
}

function moveEnemy(e) {
    if(tdState.path.length === 0) return; // Should not happen if path valid

    let targetNode = tdState.path[e.pathIndex];
    if(!targetNode) { e.reachedEnd = true; return; }

    let tx = targetNode.x * tdState.gridSize + 10;
    let ty = targetNode.y * tdState.gridSize + 10;

    let dx = tx - e.x;
    let dy = ty - e.y;
    let dist = Math.sqrt(dx*dx + dy*dy);

    if(dist < e.speed) {
        e.x = tx;
        e.y = ty;
        e.pathIndex++;
        if(e.pathIndex >= tdState.path.length) e.reachedEnd = true;
    } else {
        e.x += (dx/dist) * e.speed;
        e.y += (dy/dist) * e.speed;
    }
}

function getTarget(t) {
    for(let e of tdState.enemies) {
        let dx = e.x - (t.x * tdState.gridSize + 10);
        let dy = e.y - (t.y * tdState.gridSize + 10);
        if(Math.sqrt(dx*dx + dy*dy) <= t.range) return e;
    }
    return null;
}

function fireProjectile(t, target) {
    tdState.projectiles.push({
        x: t.x * tdState.gridSize + 10,
        y: t.y * tdState.gridSize + 10,
        target: target,
        speed: 8,
        damage: t.damage
    });
}

function handleGridClick(e) {
    if(tdState.waveActive) {
        document.getElementById('td-msg').innerText = "Cannot build during wave!";
        return;
    }

    let rect = tdState.canvas.getBoundingClientRect();
    let gx = Math.floor((e.clientX - rect.left) / tdState.gridSize);
    let gy = Math.floor((e.clientY - rect.top) / tdState.gridSize);

    // Check bounds and Start/End
    if(gx < 0 || gx >= tdState.cols || gy < 0 || gy >= tdState.rows) return;
    if((gx === tdState.start.x && gy === tdState.start.y) || (gx === tdState.end.x && gy === tdState.end.y)) return;

    // Check existing
    let existing = tdState.towers.find(t => t.x === gx && t.y === gy);
    if(existing) return; // Could implement sell here

    // Cost
    if(tdState.money < 50) {
        document.getElementById('td-msg').innerText = "Not enough money!";
        return;
    }

    // Temp placement to check path
    tdState.towers.push({x: gx, y: gy, range: 80, damage: 10, cooldown: 0, maxCooldown: 20});
    if(!updatePath()) {
        tdState.towers.pop(); // Revert
        document.getElementById('td-msg').innerText = "Cannot block the path!";
    } else {
        tdState.money -= 50;
        updateUI();
        document.getElementById('td-msg').innerText = "Tower placed.";
    }
}

/* --- Pathfinding (BFS) --- */
function updatePath() {
    let q = [tdState.start];
    let cameFrom = {};
    let startKey = `${tdState.start.x},${tdState.start.y}`;
    cameFrom[startKey] = null;
    let found = false;

    // Collision map
    let grid = Array(tdState.cols).fill().map(() => Array(tdState.rows).fill(false));
    tdState.towers.forEach(t => grid[t.x][t.y] = true);

    while(q.length > 0) {
        let curr = q.shift();
        if(curr.x === tdState.end.x && curr.y === tdState.end.y) {
            found = true;
            break;
        }

        let dirs = [{x:0, y:-1}, {x:0, y:1}, {x:-1, y:0}, {x:1, y:0}];
        for(let d of dirs) {
            let next = {x: curr.x + d.x, y: curr.y + d.y};
            if(next.x >= 0 && next.x < tdState.cols && next.y >= 0 && next.y < tdState.rows) {
                if(!grid[next.x][next.y]) {
                    let key = `${next.x},${next.y}`;
                    if(!(key in cameFrom)) {
                        q.push(next);
                        cameFrom[key] = curr;
                    }
                }
            }
        }
    }

    if(!found) return false;

    // Reconstruct
    let path = [];
    let curr = tdState.end;
    while(curr) {
        path.push(curr);
        let key = `${curr.x},${curr.y}`;
        curr = cameFrom[key];
    }
    tdState.path = path.reverse();
    return true;
}

/* --- Rendering --- */
function renderTD() {
    let ctx = tdState.ctx;
    ctx.fillStyle = "#051505";
    ctx.fillRect(0, 0, tdState.canvas.width, tdState.canvas.height);

    // Grid
    ctx.strokeStyle = "#003300";
    ctx.beginPath();
    for(let i=0; i<=tdState.cols; i++) { ctx.moveTo(i*tdState.gridSize, 0); ctx.lineTo(i*tdState.gridSize, tdState.canvas.height); }
    for(let i=0; i<=tdState.rows; i++) { ctx.moveTo(0, i*tdState.gridSize); ctx.lineTo(tdState.canvas.width, i*tdState.gridSize); }
    ctx.stroke();

    // Path Highlight
    ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
    tdState.path.forEach(p => {
        ctx.fillRect(p.x * tdState.gridSize, p.y * tdState.gridSize, tdState.gridSize, tdState.gridSize);
    });

    // Start/End
    ctx.fillStyle = "#00F"; ctx.fillRect(tdState.start.x * tdState.gridSize, tdState.start.y * tdState.gridSize, tdState.gridSize, tdState.gridSize);
    ctx.fillStyle = "#F00"; ctx.fillRect(tdState.end.x * tdState.gridSize, tdState.end.y * tdState.gridSize, tdState.gridSize, tdState.gridSize);

    // Towers
    ctx.fillStyle = "#0F0";
    tdState.towers.forEach(t => {
        ctx.fillRect(t.x * tdState.gridSize + 2, t.y * tdState.gridSize + 2, tdState.gridSize - 4, tdState.gridSize - 4);
    });

    // Enemies
    ctx.fillStyle = "#F0F";
    tdState.enemies.forEach(e => {
        ctx.beginPath();
        ctx.arc(e.x, e.y, 6, 0, Math.PI*2);
        ctx.fill();
        // HP Bar
        ctx.fillStyle = "red"; ctx.fillRect(e.x-6, e.y-10, 12, 2);
        ctx.fillStyle = "#0F0"; ctx.fillRect(e.x-6, e.y-10, 12 * (e.hp/e.maxHp), 2);
        ctx.fillStyle = "#F0F";
    });

    // Projectiles
    ctx.fillStyle = "#FF0";
    tdState.projectiles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI*2);
        ctx.fill();
    });
}
