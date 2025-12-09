/* --- SENTINEL GRID LOGIC --- */

// Configuration constants for the game board and colors
const TD_CONF = {
    GRID: 20,
    COLS: 30,
    ROWS: 20,
    COLORS: {
        BG: '#051505', 
        GRID: '#003300', 
        PATH: 'rgba(0, 255, 0, 0.1)' // Highlight color for the path
    }
};

// Tower definitions, including stats and costs
const TOWERS = {
    blaster: { name: "Blaster", desc: "Balanced damage & range.", cost: 50, color: "#00FF00", range: 4, dmg: 15, cd: 25 },
    sniper: { name: "Sniper", desc: "Long range, high damage.", cost: 120, color: "#00FFFF", range: 9, dmg: 80, cd: 80 },
    rapid: { name: "Rapid", desc: "Fast fire rate, low damage.", cost: 100, color: "#FFFF00", range: 3, dmg: 5, cd: 6 }
};

// Global game state object
let td = {
    canvas: null, ctx: null, running: false, loopId: null,
    wave: 1, money: 250, lives: 20, waveActive: false, 
    enemies: [], towers: [], projectiles: [], particles: [],
    // Initial start point and end point coordinates (grid units)
    startNodes: [{x: 0, y: 10}], 
    endNode: {x: 29, y: 10}, 
    paths: [], // Stores computed paths for each starting point
    buildType: 'blaster', 
    selected: null, // Currently selected tower for inspector
    enemiesToSpawn: 0, 
    spawnTimer: 0, 
    difficulty: 1.0 // Wave difficulty multiplier
};

/**
 * Initializes the Sentinel Grid game. Called when the modal is opened.
 */
function initSentinel() {
    td.canvas = document.getElementById('sentinel-canvas');
    td.ctx = td.canvas.getContext('2d');
    td.canvas.onclick = tdClick;
    tdReset();
}

/**
 * Stops the game loop and pauses the game. Called when the modal is closed.
 */
function stopSentinel() {
    td.running = false;
    cancelAnimationFrame(td.loopId);
}

/**
 * Resets all game state variables to their initial values.
 */
function tdReset() {
    td.running = false;
    td.wave = 1; td.money = 250; td.lives = 20; td.waveActive = false;
    td.towers = []; td.enemies = []; td.projectiles = []; td.particles = [];
    td.startNodes = [{x: 0, y: 10}]; td.difficulty = 1.0;
    td.selected = null;
    
    // Recalculate paths based on empty tower grid
    tdUpdatePath();
    tdUpdateUI();
    // Select the default tower for building
    tdSelectType('blaster');
    
    // Start the game loop
    td.running = true;
    tdLoop();
}

/**
 * The main game loop, runs approximately 60 times per second.
 */
function tdLoop() {
    if(!td.running) return;
    
    // --- Wave Management Logic ---
    if(td.waveActive) {
        if(td.enemiesToSpawn > 0) {
            td.spawnTimer++;
            // Spawn enemies faster as the wave number increases
            if(td.spawnTimer > Math.max(10, 50 - td.wave)) {
                tdSpawnEnemy();
                td.enemiesToSpawn--;
                td.spawnTimer = 0;
            }
        } else if(td.enemies.length === 0) {
            // End wave when all enemies are spawned and destroyed
            tdEndWave();
        }
    }
    
    // --- Enemy Movement and Health Checks ---
    td.enemies.forEach((e, i) => {
        tdMoveEnemy(e);
        if(e.reached) {
            // Enemy reached the end
            td.lives--; 
            td.enemies.splice(i, 1);
            if(td.lives <= 0) { 
                // Using an alternative for alert() as per instructions
                document.getElementById('td-msg').innerText = "GAME OVER! Lives hit zero.";
                tdReset(); 
            }
        } else if(e.hp <= 0) {
            // Enemy destroyed
            td.money += e.reward;
            tdExplode(e.x, e.y, e.color);
            td.enemies.splice(i, 1);
        }
    });
    
    // --- Tower Attack Logic ---
    td.towers.forEach(t => {
        if(t.cd > 0) t.cd--;
        else {
            let target = tdGetTarget(t);
            if(target) {
                // Fire a projectile at the target
                td.projectiles.push({
                    x: t.x*20+10, y: t.y*20+10, 
                    target: target, 
                    speed: 8, 
                    dmg: t.dmg, 
                    color: t.color
                });
                t.cd = t.maxCd;
            }
        }
    });
    
    // --- Projectile Movement and Hit Detection ---
    td.projectiles.forEach((p, i) => {
        if(!p.target || p.target.hp <= 0) { 
            td.projectiles.splice(i,1); 
            return; 
        }
        let dx = p.target.x - p.x, dy = p.target.y - p.y;
        let dist = Math.sqrt(dx*dx+dy*dy);
        if(dist < p.speed) {
            // Hit detected
            p.target.hp -= p.dmg;
            td.projectiles.splice(i, 1);
        } else {
            // Move projectile towards target
            p.x += (dx/dist)*p.speed; 
            p.y += (dy/dist)*p.speed;
        }
    });

    // --- Particle Effects Update ---
    for(let i=td.particles.length-1; i>=0; i--) {
        let p = td.particles[i];
        p.x += p.vx; p.y += p.vy; p.life--;
        if(p.life <= 0) td.particles.splice(i, 1);
    }

    // Rendering and UI update
    tdRender();
    tdUpdateUI();
    td.loopId = requestAnimationFrame(tdLoop);
}

/**
 * Initiates the start of a new enemy wave.
 */
function tdStartWave() {
    if(td.waveActive) return;
    td.waveActive = true;
    td.enemiesToSpawn = 5 + Math.floor(td.wave * 2);
    document.getElementById('td-msg').innerText = "Wave " + td.wave + " incoming!";
    
    // Special wave events (adding new entry points)
    if(td.wave === 5) { 
        td.startNodes.push({x: 15, y: 0}); 
        tdUpdatePath(); 
        document.getElementById('td-msg').innerText = "Wave 5: Breach detected North!"; 
    }
    if(td.wave === 10) { 
        td.startNodes.push({x: 15, y: 19}); 
        tdUpdatePath(); 
        document.getElementById('td-msg').innerText = "Wave 10: Breach detected South!";
    }
}

/**
 * Handles the end of an enemy wave, grants reward, and prepares for the next.
 */
function tdEndWave() {
    td.waveActive = false;
    td.money += 100 + (td.wave * 10);
    td.wave++; 
    td.difficulty += 0.2; // Increase difficulty multiplier
    document.getElementById('td-msg').innerText = "Wave Complete! Press 'Start Wave' for the next one.";
}

/**
 * Creates and adds a new enemy to the game.
 */
function tdSpawnEnemy() {
    let start = td.startNodes[Math.floor(Math.random()*td.startNodes.length)];
    let hp = Math.floor((20 + td.wave*10) * td.difficulty);
    td.enemies.push({
        x: start.x*20+10, y: start.y*20+10, // Pixel coordinates
        hp: hp, maxHp: hp, 
        speed: 1.5 + (td.wave*0.1), 
        pathIndex: 0,
        reward: 5 + Math.floor(td.wave/2), 
        reached: false, 
        origin: start, // Which start node it came from
        // Color changes for bosses (every 5 waves)
        color: td.wave % 5 === 0 ? '#F00' : '#F0F' 
    });
}

/**
 * Moves an enemy one step along its calculated path.
 * @param {object} e The enemy object.
 */
function tdMoveEnemy(e) {
    let pathObj = td.paths.find(p => p.start.x === e.origin.x && p.start.y === e.origin.y);
    if(!pathObj || !pathObj.nodes[e.pathIndex]) { 
        e.reached = true; 
        return; 
    }
    let t = pathObj.nodes[e.pathIndex]; // Target grid node
    let tx = t.x*20+10, ty = t.y*20+10;
    let dx = tx - e.x, dy = ty - e.y;
    let dist = Math.sqrt(dx*dx+dy*dy);
    if(dist < e.speed) {
        // Reached the center of the current node, move to the next
        e.x = tx; e.y = ty; e.pathIndex++;
        if(e.pathIndex >= pathObj.nodes.length) e.reached = true;
    } else {
        // Move towards the target node
        e.x += (dx/dist)*e.speed; e.y += (dy/dist)*e.speed;
    }
}

/**
 * Finds the nearest enemy within a tower's range.
 * @param {object} t The tower object.
 * @returns {object|null} The target enemy or null.
 */
function tdGetTarget(t) {
    let closest = null, minD = 9999;
    // Tower center pixel coordinates
    let towerX = t.x*20+10;
    let towerY = t.y*20+10;

    td.enemies.forEach(e => {
        let d = Math.sqrt(Math.pow(e.x - towerX, 2) + Math.pow(e.y - towerY, 2));
        // Check if enemy is within range (range is in grid units, convert to pixels)
        if(d <= t.range*TD_CONF.GRID && d < minD) { 
            minD = d; 
            closest = e; 
        }
    });
    return closest;
}

/**
 * Handles the canvas click event for building and selecting towers.
 * @param {Event} e The click event.
 */
function tdClick(e) {
    if(td.waveActive) { 
        document.getElementById('td-msg').innerText = "Cannot build during a wave!"; 
        return; 
    }
    let rect = td.canvas.getBoundingClientRect();
    let gx = Math.floor((e.clientX - rect.left) / TD_CONF.GRID);
    let gy = Math.floor((e.clientY - rect.top) / TD_CONF.GRID);
    if(gx<0||gx>=TD_CONF.COLS||gy<0||gy>=TD_CONF.ROWS) return;

    let existing = td.towers.find(t => t.x === gx && t.y === gy);
    if(existing) {
        // Select existing tower
        td.selected = existing;
        td.buildType = null;
        tdUpdateInspector();
        return;
    }

    if(td.buildType) {
        // Attempt to Build a new tower
        let type = TOWERS[td.buildType];
        if(td.money < type.cost) { 
            document.getElementById('td-msg').innerText = "Insufficient funds ($" + type.cost + " required)!"; 
            return; 
        }
        
        // Check if location blocks start or end nodes
        if(gx === td.endNode.x && gy === td.endNode.y) return;
        for(let s of td.startNodes) if(gx===s.x && gy===s.y) return;
        
        // Temporarily add tower to check path
        let newTower = {
            x: gx, y: gy, 
            type: td.buildType, 
            name: type.name, 
            range: type.range, 
            dmg: type.dmg, 
            maxCd: type.cd, 
            cd: 0, 
            level: 1, 
            color: type.color
        };
        td.towers.push(newTower);
        
        // Check if the new tower blocks any path
        if(!tdUpdatePath()) {
            td.towers.pop(); // Remove if path is blocked
            document.getElementById('td-msg').innerText = "Placement blocked all paths! Move it elsewhere.";
        } else {
            // Placement successful
            td.money -= type.cost;
            tdExplode(gx*20+10, gy*20+10, '#FFF');
            document.getElementById('td-msg').innerText = type.name + " built!";
        }
    } else {
        // Deselect current tower
        td.selected = null;
        tdUpdateInspector();
    }
}

/**
 * Sets the currently selected tower type for building.
 * @param {string} t The tower type ('blaster', 'sniper', 'rapid').
 */
function tdSelectType(t) {
    td.buildType = t;
    td.selected = null;
    document.querySelectorAll('.tower-btn').forEach(b => b.classList.remove('active'));
    // Ensure the correct button is highlighted even if the ID changes
    const btn = document.getElementById('btn-'+t);
    if (btn) btn.classList.add('active');
    tdUpdateInspector();
}

/**
 * Updates the Tower Inspector panel with details of the selected tower or build type.
 */
function tdUpdateInspector() {
    let title = document.getElementById('insp-title');
    let desc = document.getElementById('insp-desc');
    let stats = document.getElementById('insp-stats');

    if(td.selected) {
        // Show selected tower details
        let t = td.selected;
        title.innerText = t.name + " (Lvl " + t.level + ")";
        desc.innerText = "Active defense unit.";
        stats.style.display = 'block';
        document.getElementById('insp-dmg').innerText = Math.round(t.dmg);
        document.getElementById('insp-rng').innerText = t.range.toFixed(1);
        document.getElementById('insp-lvl').innerText = t.level;
        
        // Calculate upgrade cost
        let cost = Math.floor(TOWERS[t.type].cost * 0.8 * t.level);
        document.getElementById('insp-cost').innerText = cost;
    } else if(td.buildType) {
        // Show build type details
        let t = TOWERS[td.buildType];
        title.innerText = t.name;
        desc.innerText = t.desc + " Cost: $" + t.cost;
        stats.style.display = 'none';
    } else {
        // Default text
        title.innerText = "Select Unit";
        desc.innerText = "Click a button to build or click an existing tower to inspect it.";
        stats.style.display = 'none';
    }
}

/**
 * Upgrades the currently selected tower.
 */
function tdUpgrade() {
    if(!td.selected) return;
    let t = td.selected;
    let cost = Math.floor(TOWERS[t.type].cost * 0.8 * t.level);
    if(td.money >= cost) {
        td.money -= cost;
        t.level++;
        t.dmg = Math.floor(t.dmg * 1.3); // 30% damage increase
        t.range += 0.5; // Small range increase
        t.maxCd = Math.max(5, Math.floor(t.maxCd * 0.95)); // 5% faster cooldown (min 5)
        
        tdUpdateInspector();
        tdExplode(t.x*20+10, t.y*20+10, '#0F0');
        document.getElementById('td-msg').innerText = t.name + " upgraded to Level " + t.level + "!";
    } else {
        document.getElementById('td-msg').innerText = "Not enough money to upgrade!";
    }
}

/**
 * Sells the currently selected tower, refunding some money.
 */
function tdSell() {
    if(!td.selected) return;
    let t = td.selected;
    // Refund 50% of base cost per level
    let refund = Math.floor(TOWERS[t.type].cost * 0.5 * t.level);
    td.money += refund;
    
    // Remove tower from list
    td.towers = td.towers.filter(x => x !== t);
    td.selected = null;
    
    // Recalculate paths as a tower was removed
    tdUpdatePath();
    tdSelectType('blaster'); // Reset inspector to build mode
    document.getElementById('td-msg').innerText = t.name + " sold for $" + refund + ".";
}

/**
 * Re-calculates the shortest path from all start nodes to the end node (BFS).
 * @returns {boolean} True if all paths are found, false if a path is blocked.
 */
function tdUpdatePath() {
    // Create a 2D array representation of the grid (true=blocked, false=open)
    let grid = Array(TD_CONF.COLS).fill().map(() => Array(TD_CONF.ROWS).fill(false));
    td.towers.forEach(t => grid[t.x][t.y] = true);
    
    let newPaths = [];
    for(let start of td.startNodes) {
        let p = tdBFS(start, td.endNode, grid);
        if(!p) return false; // Found a blocked path
        newPaths.push({start: start, nodes: p});
    }
    td.paths = newPaths;
    return true;
}

/**
 * Breadth-First Search (BFS) algorithm to find the shortest path.
 * @param {object} start Starting {x, y} node.
 * @param {object} end Ending {x, y} node.
 * @param {boolean[][]} grid The grid state (walls/towers).
 * @returns {object[]|null} The path array or null if no path is found.
 */
function tdBFS(start, end, grid) {
    let q = [start];
    let came = {}; 
    came[`${start.x},${start.y}`] = null;

    while(q.length) {
        let curr = q.shift();
        if(curr.x===end.x && curr.y===end.y) break;

        // Check neighbors (North, South, West, East)
        [{x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}].forEach(d => {
            let n = {x:curr.x+d.x, y:curr.y+d.y};
            
            // Check bounds and if the node is blocked by a tower
            if(n.x>=0 && n.x<TD_CONF.COLS && n.y>=0 && n.y<TD_CONF.ROWS && !grid[n.x][n.y]) {
                if(!came.hasOwnProperty(`${n.x},${n.y}`)) { 
                    came[`${n.x},${n.y}`] = curr; 
                    q.push(n); 
                }
            }
        });
    }

    // Reconstruct path
    if(!came.hasOwnProperty(`${end.x},${end.y}`)) return null;
    let path = [], curr = end;
    while(curr) { 
        path.push(curr); 
        let prev = came[`${curr.x},${curr.y}`];
        if(!prev) break; // Reached the start node
        curr = prev;
    }
    // The reconstructed path is from end to start, so reverse it
    return path.reverse();
}

/**
 * Creates particle effects (explosion) at a given position.
 * @param {number} x X pixel coordinate.
 * @param {number} y Y pixel coordinate.
 * @param {string} c Color of particles.
 */
function tdExplode(x, y, c) {
    for(let i=0; i<6; i++) {
        td.particles.push({
            x:x, y:y, 
            vx:(Math.random()-0.5)*4, // Velocity X
            vy:(Math.random()-0.5)*4, // Velocity Y
            life:15, // Particle lifespan
            color:c
        });
    }
}

/**
 * Updates the main HUD elements (Wave, Money, Lives).
 */
function tdUpdateUI() {
    document.getElementById('td-wave').innerText = td.wave;
    document.getElementById('td-money').innerText = td.money;
    document.getElementById('td-lives').innerText = td.lives;
}

/**
 * Renders all game elements to the canvas.
 */
function tdRender() {
    let ctx = td.ctx;
    // Clear canvas
    ctx.fillStyle = TD_CONF.COLORS.BG; 
    ctx.fillRect(0,0,600,400);
    
    // Draw Grid Lines
    ctx.strokeStyle = '#002200'; 
    ctx.beginPath();
    for(let i=0; i<=TD_CONF.COLS; i++) { ctx.moveTo(i*TD_CONF.GRID,0); ctx.lineTo(i*TD_CONF.GRID,400); }
    for(let i=0; i<=TD_CONF.ROWS; i++) { ctx.moveTo(0,i*TD_CONF.GRID); ctx.lineTo(600,i*TD_CONF.GRID); }
    ctx.stroke();
    
    // Draw Path Highlight
    ctx.fillStyle = TD_CONF.COLORS.PATH;
    td.paths.forEach(p => p.nodes.forEach(n => ctx.fillRect(n.x*TD_CONF.GRID, n.y*TD_CONF.GRID, TD_CONF.GRID, TD_CONF.GRID)));
    
    // Draw Start/End Nodes
    td.startNodes.forEach(s => { ctx.fillStyle="#00F"; ctx.fillRect(s.x*TD_CONF.GRID, s.y*TD_CONF.GRID, TD_CONF.GRID, TD_CONF.GRID); });
    ctx.fillStyle="#F00"; ctx.fillRect(td.endNode.x*TD_CONF.GRID, td.endNode.y*TD_CONF.GRID, TD_CONF.GRID, TD_CONF.GRID);
    
    // Draw Towers
    td.towers.forEach(t => {
        ctx.fillStyle = t.color; 
        ctx.fillRect(t.x*TD_CONF.GRID+2, t.y*TD_CONF.GRID+2, 16, 16);
        
        // Draw Level pips
        ctx.fillStyle = "#fff";
        for(let i=0; i<t.level && i<5; i++) { // Limit pips to 5 for aesthetics
            ctx.fillRect(t.x*TD_CONF.GRID+3+(i*3), t.y*TD_CONF.GRID+3, 1.5, 1.5);
        }
    });
    
    // Draw Enemies
    td.enemies.forEach(e => {
        ctx.fillStyle = e.color; 
        ctx.beginPath(); 
        ctx.arc(e.x, e.y, 6, 0, Math.PI*2); 
        ctx.fill();
        
        // Draw Health Bar
        ctx.fillStyle = "#F00"; 
        ctx.fillRect(e.x-6, e.y-8, 12, 2);
        ctx.fillStyle = "#0F0"; 
        ctx.fillRect(e.x-6, e.y-8, 12*(e.hp/e.maxHp), 2);
    });
    
    // Draw Projectiles
    td.projectiles.forEach(p => {
        ctx.fillStyle = p.color; 
        ctx.beginPath(); 
        ctx.arc(p.x, p.y, 3, 0, Math.PI*2); 
        ctx.fill();
    });

    // Draw Particles
    td.particles.forEach(p => {
        ctx.fillStyle = p.color; 
        ctx.globalAlpha = p.life/15; // Fade out effect
        ctx.beginPath(); 
        ctx.arc(p.x, p.y, 2, 0, Math.PI*2); 
        ctx.fill(); 
        ctx.globalAlpha = 1.0;
    });
    
    // Draw Selected Tower highlight and Range Circle
    if(td.selected) {
        // Highlight square
        ctx.strokeStyle = "#FFF"; 
        ctx.lineWidth = 2; 
        ctx.strokeRect(td.selected.x*TD_CONF.GRID, td.selected.y*TD_CONF.GRID, TD_CONF.GRID, TD_CONF.GRID);
        
        // Range Circle
        ctx.beginPath(); 
        ctx.arc(td.selected.x*TD_CONF.GRID+10, td.selected.y*TD_CONF.GRID+10, td.selected.range*TD_CONF.GRID, 0, Math.PI*2);
        ctx.strokeStyle = "rgba(255,255,255,0.2)"; 
        ctx.stroke();
    }
}
