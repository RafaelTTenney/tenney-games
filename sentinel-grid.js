/* Sentinel Grid - Flagship Tower Defense Logic (Enhanced) */

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
    money: 120,
    lives: 20,
    running: false,
    gameLoopId: null,
    path: [],
    startNodes: [{x: 0, y: 10}], // Array of spawn points
    end: {x: 29, y: 10},
    waveActive: false,
    enemiesToSpawn: 0,
    spawnTimer: 0,
    difficultyMultiplier: 1.0
};

function initSentinel() {
    tdState.canvas = document.getElementById('sentinel-canvas');
    if(!tdState.canvas) return;
    tdState.ctx = tdState.canvas.getContext('2d');
    
    document.getElementById('td-start-wave').onclick = startWave;
    document.getElementById('td-reset').onclick = resetTD;
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
    tdState.difficultyMultiplier = 1.0;
    tdState.startNodes = [{x: 0, y: 10}]; // Reset to single spawn
    
    updatePath();
    updateUI();
    
    tdState.running = true;
    loopTD();
}

function startWave() {
    if(tdState.waveActive) return;
    tdState.waveActive = true;
    // Harder scaling
    tdState.enemiesToSpawn = 5 + Math.floor(tdState.wave * 2.5);
    tdState.spawnTimer = 0;
    
    // Multi-Direction Attack after Wave 5
    if(tdState.wave === 5) {
        tdState.startNodes.push({x: 15, y: 0}); // Attack from top
        updatePath(); // Re-calc paths
        alert("Warning: Enemies attacking from the North!");
    }
    if(tdState.wave === 10) {
        tdState.startNodes.push({x: 15, y: 19}); // Attack from bottom
        updatePath();
        alert("Warning: Enemies attacking from the South!");
    }
}

function updateUI() {
    document.getElementById('td-wave').innerText = "Wave: " + tdState.wave;
    document.getElementById('td-money').innerText = "$: " + tdState.money;
    document.getElementById('td-lives').innerText = "Lives: " + tdState.lives;
}

function loopTD() {
    if(!tdState.running) return;
    updateTD();
    renderTD();
    tdState.gameLoopId = requestAnimationFrame(loopTD);
}

function updateTD() {
    // Spawning logic
    if(tdState.waveActive && tdState.enemiesToSpawn > 0) {
        tdState.spawnTimer++;
        // Spawn faster in later waves
        let rate = Math.max(10, 40 - tdState.wave); 
        if(tdState.spawnTimer > rate) {
            spawnEnemy();
            tdState.enemiesToSpawn--;
            tdState.spawnTimer = 0;
        }
    } else if (tdState.waveActive && tdState.enemiesToSpawn === 0 && tdState.enemies.length === 0) {
        endWave();
    }

    // Enemies
    for(let i = tdState.enemies.length - 1; i >= 0; i--) {
        let e = tdState.enemies[i];
        moveEnemy(e);
        if(e.reachedEnd) {
            tdState.lives--;
            tdState.enemies.splice(i, 1);
            updateUI();
            if(tdState.lives <= 0) {
                alert("Game Over! You reached Wave " + tdState.wave);
                resetTD();
                return;
            }
        } else if(e.hp <= 0) {
            tdState.money += e.reward;
            tdState.enemies.splice(i, 1);
            updateUI();
        }
    }

    // Towers
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
        if(!p.target || p.target.hp <= 0) {
             tdState.projectiles.splice(i, 1);
             continue;
        }
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

function endWave() {
    tdState.waveActive = false;
    tdState.money += 50 + (tdState.wave * 10);
    tdState.wave++;
    tdState.difficultyMultiplier += 0.2;
    updateUI();
}

function spawnEnemy() {
    // Pick random start node
    let startNode = tdState.startNodes[Math.floor(Math.random() * tdState.startNodes.length)];
    
    // Calculate HP based on wave
    let hp = Math.floor((20 + (tdState.wave * 15)) * tdState.difficultyMultiplier);
    
    tdState.enemies.push({
        x: startNode.x * tdState.gridSize + 10,
        y: startNode.y * tdState.gridSize + 10,
        gridX: startNode.x,
        gridY: startNode.y,
        hp: hp,
        maxHp: hp,
        speed: 2 + (tdState.wave * 0.1), // Gets faster
        pathIndex: 0,
        reward: 5 + Math.floor(tdState.wave/2),
        reachedEnd: false,
        origin: startNode // To know which path to follow
    });
}

function moveEnemy(e) {
    // Determine path based on origin
    let specificPath = tdState.paths.find(p => p.start.x === e.origin.x && p.start.y === e.origin.y);
    if(!specificPath || !specificPath.nodes) return; 

    let pathNodes = specificPath.nodes;
    let targetNode = pathNodes[e.pathIndex];
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
        if(e.pathIndex >= pathNodes.length) e.reachedEnd = true;
    } else {
        e.x += (dx/dist) * e.speed;
        e.y += (dy/dist) * e.speed;
    }
}

function getTarget(t) {
    // Simple closest target
    let closest = null;
    let minDist = 9999;
    for(let e of tdState.enemies) {
        let dx = e.x - (t.x * tdState.gridSize + 10);
        let dy = e.y - (t.y * tdState.gridSize + 10);
        let dist = Math.sqrt(dx*dx + dy*dy);
        if(dist <= t.range && dist < minDist) {
            minDist = dist;
            closest = e;
        }
    }
    return closest;
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
        document.getElementById('td-msg').innerText = "Wait for wave to end!";
        return;
    }

    let rect = tdState.canvas.getBoundingClientRect();
    let gx = Math.floor((e.clientX - rect.left) / tdState.gridSize);
    let gy = Math.floor((e.clientY - rect.top) / tdState.gridSize);

    if(gx < 0 || gx >= tdState.cols || gy < 0 || gy >= tdState.rows) return;
    
    // Check if clicked Start/End
    if(gx === tdState.end.x && gy === tdState.end.y) return;
    for(let s of tdState.startNodes) { if(gx === s.x && gy === s.y) return; }

    // Check existing tower for UPGRADE
    let existing = tdState.towers.find(t => t.x === gx && t.y === gy);
    if(existing) {
        let cost = existing.level * 50;
        if(tdState.money >= cost) {
            tdState.money -= cost;
            existing.level++;
            existing.damage += 5;
            existing.range += 10;
            updateUI();
            document.getElementById('td-msg').innerText = "Upgraded to Lvl " + existing.level;
        } else {
            document.getElementById('td-msg').innerText = "Need $" + cost + " to upgrade.";
        }
        return;
    }

    // Build New
    if(tdState.money < 50) {
        document.getElementById('td-msg').innerText = "Need $50 to build.";
        return;
    }

    // Place temp and check path
    tdState.towers.push({x: gx, y: gy, range: 80, damage: 10, cooldown: 0, maxCooldown: 20, level: 1});
    if(!updatePath()) {
        tdState.towers.pop(); // Invalid position
        document.getElementById('td-msg').innerText = "Cannot block path!";
    } else {
        tdState.money -= 50;
        updateUI();
        document.getElementById('td-msg').innerText = "Tower built.";
    }
}

// Multi-Path BFS
function updatePath() {
    let allPathsValid = true;
    let newPaths = [];

    // Map obstacles
    let grid = Array(tdState.cols).fill().map(() => Array(tdState.rows).fill(false));
    tdState.towers.forEach(t => grid[t.x][t.y] = true);

    for(let start of tdState.startNodes) {
        let path = findPath(start, tdState.end, grid);
        if(!path) {
            allPathsValid = false;
            break;
        }
        newPaths.push({start: start, nodes: path});
    }

    if(allPathsValid) {
        tdState.paths = newPaths;
        return true;
    }
    return false;
}

function findPath(start, end, grid) {
    let q = [start];
    let cameFrom = {};
    let startKey = `${start.x},${start.y}`;
    cameFrom[startKey] = null;
    let found = false;

    while(q.length > 0) {
        let curr = q.shift();
        if(curr.x === end.x && curr.y === end.y) { found = true; break; }

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

    if(!found) return null;
    let path = [];
    let curr = end;
    while(curr) {
        path.push(curr);
        let key = `${curr.x},${curr.y}`;
        curr = cameFrom[key];
    }
    return path.reverse();
}

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

    // Paths
    if(tdState.paths) {
        ctx.fillStyle = "rgba(0, 255, 0, 0.1)";
        tdState.paths.forEach(pObj => {
            pObj.nodes.forEach(p => {
                ctx.fillRect(p.x * tdState.gridSize, p.y * tdState.gridSize, tdState.gridSize, tdState.gridSize);
            });
        });
    }

    // Start/End
    ctx.fillStyle = "#00F"; 
    tdState.startNodes.forEach(s => ctx.fillRect(s.x * tdState.gridSize, s.y * tdState.gridSize, tdState.gridSize, tdState.gridSize));
    ctx.fillStyle = "#F00"; ctx.fillRect(tdState.end.x * tdState.gridSize, tdState.end.y * tdState.gridSize, tdState.gridSize, tdState.gridSize);

    // Towers
    tdState.towers.forEach(t => {
        // Color changes with level
        ctx.fillStyle = t.level === 1 ? "#0F0" : (t.level === 2 ? "#FF0" : "#F0F");
        ctx.fillRect(t.x * tdState.gridSize + 2, t.y * tdState.gridSize + 2, tdState.gridSize - 4, tdState.gridSize - 4);
        
        // Level Indicator
        ctx.fillStyle = "black";
        ctx.font = "10px Arial";
        ctx.fillText(t.level, t.x*tdState.gridSize + 6, t.y*tdState.gridSize + 14);
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
