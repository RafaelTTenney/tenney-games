/* Rogue Dungeon - Neon Depths Edition */

let rlState = {
    canvas: null,
    ctx: null,
    tileSize: 24,
    cols: 20,
    rows: 20,
    map: [],        // 1 = Wall, 0 = Floor
    memory: [],     // True if player has visited this tile (Fog of War)
    visible: [],    // True if currently in FOV
    items: [],
    particles: [],  // Floating damage numbers
    player: {
        x: 1, y: 1, 
        hp: 100, maxHp: 100, 
        xp: 0, level: 1, 
        baseDmg: 6, 
        potions: 1, // Start with 1 potion
        weapon: {name: "Bare Hands", val: 0},
        armor: {name: "Rags", val: 0}
    },
    enemies: [],
    level: 1,
    log: [],
    animFrame: null
};

function initRogue() {
    rlState.canvas = document.getElementById('rogue-canvas');
    if(!rlState.canvas) return;
    rlState.ctx = rlState.canvas.getContext('2d');
    
    document.getElementById('rl-restart').onclick = startRun;
    
    // Remove old listeners to prevent duplicates
    window.removeEventListener('keydown', handleRogueInput);
    window.addEventListener('keydown', handleRogueInput);

    startRun();
    gameLoop(); // Start animation loop for particles
}

function stopRogue() {
    window.removeEventListener('keydown', handleRogueInput);
    if(rlState.animFrame) cancelAnimationFrame(rlState.animFrame);
}

function startRun() {
    rlState.level = 1;
    rlState.player = {
        x: 1, y: 1, 
        hp: 100, maxHp: 100, 
        xp: 0, level: 1, 
        baseDmg: 6, 
        potions: 1,
        weapon: {name: "Bare Hands", val: 0},
        armor: {name: "Rags", val: 0}
    };
    rlState.log = [];
    rlState.particles = [];
    
    generateLevel();
    logRL("Welcome to the Neon Depths.");
    updateRLUI();
    renderRL();
}

// --- Map Generation (Rooms & Corridors) ---
function generateLevel() {
    // Reset Grid
    rlState.map = Array(rlState.cols).fill().map(() => Array(rlState.rows).fill(1));
    rlState.memory = Array(rlState.cols).fill().map(() => Array(rlState.rows).fill(false));
    rlState.visible = Array(rlState.cols).fill().map(() => Array(rlState.rows).fill(false));
    rlState.enemies = [];
    rlState.items = [];

    const rooms = [];
    const maxRooms = 8;
    const minSize = 3;
    const maxSize = 6;

    for (let i = 0; i < maxRooms; i++) {
        // Random dimensions
        let w = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
        let h = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
        // Random position (ensure padding)
        let x = Math.floor(Math.random() * (rlState.cols - w - 2)) + 1;
        let y = Math.floor(Math.random() * (rlState.rows - h - 2)) + 1;

        let newRoom = { x, y, w, h };
        
        // Check collision with other rooms
        let failed = false;
        for (let other of rooms) {
            if (newRoom.x <= other.x + other.w && newRoom.x + newRoom.w >= other.x &&
                newRoom.y <= other.y + other.h && newRoom.y + newRoom.h >= other.y) {
                failed = true;
                break;
            }
        }

        if (!failed) {
            createRoom(newRoom);
            
            if (rooms.length > 0) {
                let prev = rooms[rooms.length - 1];
                let cx = newRoom.x + Math.floor(newRoom.w / 2);
                let cy = newRoom.y + Math.floor(newRoom.h / 2);
                let px = prev.x + Math.floor(prev.w / 2);
                let py = prev.y + Math.floor(prev.h / 2);

                if (Math.random() > 0.5) {
                    createHTunnel(px, cx, py);
                    createVTunnel(py, cy, cx);
                } else {
                    createVTunnel(py, cy, px);
                    createHTunnel(px, cx, cy);
                }
            }
            rooms.push(newRoom);
        }
    }

    // Place Player in first room
    let fRoom = rooms[0];
    rlState.player.x = fRoom.x + Math.floor(fRoom.w / 2);
    rlState.player.y = fRoom.y + Math.floor(fRoom.h / 2);

    // Spawn entities in other rooms
    for(let i=1; i<rooms.length; i++) {
        spawnInRoom(rooms[i]);
    }

    updateFOV();
}

function createRoom(room) {
    for (let x = room.x; x < room.x + room.w; x++) {
        for (let y = room.y; y < room.y + room.h; y++) {
            rlState.map[x][y] = 0;
        }
    }
}

function createHTunnel(x1, x2, y) {
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) {
        rlState.map[x][y] = 0;
    }
}

function createVTunnel(y1, y2, x) {
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) {
        rlState.map[x][y] = 0;
    }
}

function spawnInRoom(room) {
    // Chance for enemy
    if(Math.random() < 0.8) {
        let ex = room.x + Math.floor(Math.random() * room.w);
        let ey = room.y + Math.floor(Math.random() * room.h);
        // Base Enemy Scaling
        let hp = 15 + (rlState.level * 4);
        let dmg = 4 + Math.floor(rlState.level * 1.5);
        rlState.enemies.push({
            x: ex, y: ey, 
            hp: hp, maxHp: hp, 
            name: "Cyber-Goblin", 
            dmg: dmg,
            color: `hsl(${0 + (rlState.level * 20)}, 100%, 50%)` // Enemies change color per level
        });
    }

    // Chance for item
    if(Math.random() < 0.5) {
        let ix = room.x + Math.floor(Math.random() * room.w);
        let iy = room.y + Math.floor(Math.random() * room.h);
        if(rlState.map[ix][iy] === 0) {
            generateItem(ix, iy);
        }
    }
}

function generateItem(x, y) {
    let rand = Math.random();
    let val = Math.floor(Math.random() * 2) + rlState.level;
    
    // 30% Potion, 35% Weapon, 35% Armor
    if(rand < 0.3) {
        rlState.items.push({ x, y, type: 'potion', name: "Neon Potion", val: 30 });
    } else if (rand < 0.65) {
        rlState.items.push({ x, y, type: 'weapon', name: "Laser Blade Mk." + val, val: val * 2 });
    } else {
        rlState.items.push({ x, y, type: 'armor', name: "Plasteel Vest Mk." + val, val: val });
    }
}

// --- Input & Turn Logic ---
function handleRogueInput(e) {
    if(rlState.player.hp <= 0) return;
    
    let dx = 0, dy = 0;
    let tookTurn = false;

    if(e.key === "ArrowUp") dy = -1;
    else if(e.key === "ArrowDown") dy = 1;
    else if(e.key === "ArrowLeft") dx = -1;
    else if(e.key === "ArrowRight") dx = 1;
    
    if(e.key === " " || e.code === "Space") {
        e.preventDefault(); // <--- ADD THIS LINE HERE
        usePotion();
        tookTurn = true;
    }

    if(dx !== 0 || dy !== 0) {
        e.preventDefault();
        tookTurn = movePlayer(dx, dy);
    }

    if(tookTurn) {
        if(rlState.player.hp > 0) moveEnemies();
        updateRLUI();
    }
    // Render happens in gameLoop
}

function usePotion() {
    if(rlState.player.potions > 0) {
        rlState.player.potions--;
        let heal = 30; // Flat heal
        rlState.player.hp = Math.min(rlState.player.maxHp, rlState.player.hp + heal);
        logRL(`Used potion. Healed ${heal} HP.`);
        addParticle(rlState.player.x, rlState.player.y, `+${heal}`, "#00FF00");
    } else {
        logRL("No potions left!");
    }
}

function movePlayer(dx, dy) {
    let nx = rlState.player.x + dx;
    let ny = rlState.player.y + dy;

    if(nx < 0 || nx >= rlState.cols || ny < 0 || ny >= rlState.rows || rlState.map[nx][ny] === 1) {
        return false; // Wall hit, no turn taken
    }

    // Combat
    let target = rlState.enemies.find(e => e.x === nx && e.y === ny);
    if(target) {
        // Player Attack
        let dmg = rlState.player.baseDmg + rlState.player.weapon.val;
        // Critical hit chance
        let isCrit = Math.random() < 0.2;
        if(isCrit) dmg = Math.floor(dmg * 1.5);

        target.hp -= dmg;
        addParticle(target.x, target.y, dmg, isCrit ? "#FF0000" : "#fff", isCrit); // Floating text

        if(target.hp <= 0) {
            logRL(`Destroyed ${target.name}. +15 XP`);
            rlState.enemies = rlState.enemies.filter(e => e !== target);
            gainXP(15);
            // Drop loot chance
            if(Math.random() < 0.3) generateItem(nx, ny);
            
            checkLevelClear();
        } else {
            logRL(`Hit ${target.name} for ${dmg}.`);
        }
        return true; // Attack took a turn
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
        return true;
    }
}

function pickupItem(item) {
    if(item.type === 'potion') {
        rlState.player.potions++;
        logRL("Found a Potion.");
        addParticle(rlState.player.x, rlState.player.y, "POTION", "#00FF00");
    } else if(item.type === 'weapon') {
        if(item.val > rlState.player.weapon.val) {
            rlState.player.weapon = item;
            logRL(`Equipped ${item.name}!`);
            addParticle(rlState.player.x, rlState.player.y, "UPGRADE", "#00FFFF");
        } else {
            logRL(`Scrapped weak weapon (+5 XP).`);
            gainXP(5);
        }
    } else {
        if(item.val > rlState.player.armor.val) {
            rlState.player.armor = item;
            logRL(`Equipped ${item.name}!`);
            addParticle(rlState.player.x, rlState.player.y, "UPGRADE", "#00FFFF");
        } else {
            logRL(`Scrapped weak armor (+5 XP).`);
            gainXP(5);
        }
    }
}

function checkLevelClear() {
    if(rlState.enemies.length === 0) {
        logRL("Sector Clear! Descending...");
        // Heal a bit on level clear
        rlState.player.hp = Math.min(rlState.player.maxHp, rlState.player.hp + 10);
        setTimeout(() => {
            rlState.level++;
            generateLevel();
            logRL(`Entered Depth ${rlState.level}`);
        }, 1000);
    }
}

function moveEnemies() {
    rlState.enemies.forEach(e => {
        let dist = Math.abs(rlState.player.x - e.x) + Math.abs(rlState.player.y - e.y);
        
        if(dist <= 1) {
            // Attack
            let rawDmg = e.dmg;
            // Armor reduces damage
            let mitigated = Math.max(0, rawDmg - rlState.player.armor.val);
            // Minimum 1 damage if hit
            let finalDmg = Math.max(1, mitigated);
            
            rlState.player.hp -= finalDmg;
            addParticle(rlState.player.x, rlState.player.y, `-${finalDmg}`, "#FF0000");
            
            if(rlState.player.hp <= 0) {
                rlState.player.hp = 0;
                logRL("CRITICAL FAILURE. SYSTEM OFFLINE.");
            }
        } else if(dist < 8) {
            // Chase logic (simple pathfinding toward player)
            if(rlState.visible[e.x][e.y] || rlState.memory[e.x][e.y]) { // Only chase if player "woke" them or is nearby
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
    let req = rlState.player.level * 50;
    if(rlState.player.xp >= req) {
        rlState.player.xp -= req;
        rlState.player.level++;
        rlState.player.maxHp += 15;
        rlState.player.hp = rlState.player.maxHp;
        rlState.player.baseDmg += 2;
        logRL("LEVEL UP! Systems Upgraded.");
        addParticle(rlState.player.x, rlState.player.y, "LVL UP!", "#FFFF00");
    }
}

// --- Visuals & Rendering ---

function updateFOV() {
    let r = 5;
    // Clear visible
    rlState.visible = Array(rlState.cols).fill().map(() => Array(rlState.rows).fill(false));
    
    // Simple raycast approximation
    for(let x = rlState.player.x - r; x <= rlState.player.x + r; x++) {
        for(let y = rlState.player.y - r; y <= rlState.player.y + r; y++) {
            if(x>=0 && x<rlState.cols && y>=0 && y<rlState.rows) {
                // Check distance
                let d = Math.sqrt((x-rlState.player.x)**2 + (y-rlState.player.y)**2);
                if(d < r) {
                    rlState.visible[x][y] = true;
                    rlState.memory[x][y] = true;
                }
            }
        }
    }
}

function addParticle(x, y, text, color, bold=false) {
    rlState.particles.push({
        x: x * rlState.tileSize + 12, // center
        y: y * rlState.tileSize,
        text: text,
        color: color,
        life: 30, // frames
        bold: bold
    });
}

function logRL(msg) {
    rlState.log.unshift(msg);
    if(rlState.log.length > 5) rlState.log.pop();
    document.getElementById('rl-log').innerHTML = rlState.log.join("<br>");
}

function updateRLUI() {
    document.getElementById('rl-level').innerText = `Lvl: ${rlState.player.level}`;
    document.getElementById('rl-hp').innerText = `HP: ${rlState.player.hp}/${rlState.player.maxHp}`;
    let dmg = rlState.player.baseDmg + rlState.player.weapon.val;
    let def = rlState.player.armor.val;
    document.getElementById('rl-stats').innerText = `Atk: ${dmg} | Def: ${def}`;
    document.getElementById('rl-potions').innerText = `Potions: ${rlState.player.potions}`;
}

function gameLoop() {
    renderRL();
    rlState.animFrame = requestAnimationFrame(gameLoop);
}

function renderRL() {
    if(!rlState.ctx) return;
    let ctx = rlState.ctx;
    let ts = rlState.tileSize;

    // Background
    ctx.fillStyle = "#050005";
    ctx.fillRect(0,0,rlState.canvas.width, rlState.canvas.height);

    for(let x=0; x<rlState.cols; x++) {
        for(let y=0; y<rlState.rows; y++) {
            let px = x * ts;
            let py = y * ts;
            
            // Render logic
            if(rlState.visible[x][y]) {
                // Visible Floor
                if(rlState.map[x][y] === 0) {
                    ctx.fillStyle = "#111";
                    ctx.fillRect(px, py, ts, ts);
                    // Floor grid detail
                    ctx.strokeStyle = "#222";
                    ctx.strokeRect(px, py, ts, ts);
                } else {
                    // Visible Wall
                    ctx.fillStyle = "#444";
                    ctx.fillRect(px, py, ts, ts);
                    ctx.strokeStyle = "#FF00FF";
                    ctx.lineWidth = 1;
                    ctx.strokeRect(px+4, py+4, ts-8, ts-8);
                }
            } else if(rlState.memory[x][y]) {
                // Explored but hidden (Fog of War)
                if(rlState.map[x][y] === 0) {
                    ctx.fillStyle = "#080808";
                    ctx.fillRect(px, py, ts, ts);
                } else {
                    ctx.fillStyle = "#222";
                    ctx.fillRect(px, py, ts, ts);
                }
                // Dim overlay
                ctx.fillStyle = "rgba(0,0,0,0.6)";
                ctx.fillRect(px, py, ts, ts);
            }
        }
    }

    // Render Items
    rlState.items.forEach(i => {
        if(rlState.visible[i.x][i.y]) {
            let cx = i.x*ts + ts/2;
            let cy = i.y*ts + ts/2;
            
            ctx.shadowBlur = 10;
            if(i.type === 'weapon') {
                ctx.fillStyle = "#00FFFF";
                ctx.shadowColor = "#00FFFF";
                ctx.font = "16px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("⚔️", cx, cy);
            } else if(i.type === 'armor') {
                ctx.fillStyle = "#0000FF";
                ctx.shadowColor = "#0000FF";
                ctx.font = "16px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("🛡️", cx, cy);
            } else {
                ctx.fillStyle = "#00FF00";
                ctx.shadowColor = "#00FF00";
                ctx.beginPath();
                ctx.arc(cx, cy, 6, 0, Math.PI*2);
                ctx.fill();
            }
            ctx.shadowBlur = 0;
        }
    });

    // Render Enemies
    rlState.enemies.forEach(e => {
        if(rlState.visible[e.x][e.y]) {
            let cx = e.x*ts + ts/2;
            let cy = e.y*ts + ts/2;
            
            ctx.shadowBlur = 10;
            ctx.shadowColor = e.color || "red";
            ctx.fillStyle = e.color || "red";
            
            // Draw Enemy Shape (Triangle)
            ctx.beginPath();
            ctx.moveTo(cx, cy - 8);
            ctx.lineTo(cx + 8, cy + 8);
            ctx.lineTo(cx - 8, cy + 8);
            ctx.fill();
            
            // HP Bar
            let hpPct = e.hp / e.maxHp;
            ctx.fillStyle = "red";
            ctx.fillRect(e.x*ts + 2, e.y*ts - 4, (ts-4), 3);
            ctx.fillStyle = "#00FF00";
            ctx.fillRect(e.x*ts + 2, e.y*ts - 4, (ts-4)*hpPct, 3);
            
            ctx.shadowBlur = 0;
        }
    });

    // Render Player
    let px = rlState.player.x*ts;
    let py = rlState.player.y*ts;
    
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00FFFF";
    ctx.fillStyle = "#00FFFF";
    ctx.fillRect(px + 4, py + 4, ts - 8, ts - 8);
    ctx.fillStyle = "#fff";
    // Eyes
    ctx.fillRect(px + 7, py + 8, 3, 3);
    ctx.fillRect(px + 14, py + 8, 3, 3);
    ctx.shadowBlur = 0;

    // Render Particles
    for(let i=rlState.particles.length-1; i>=0; i--) {
        let p = rlState.particles[i];
        ctx.fillStyle = p.color;
        ctx.font = (p.bold ? "bold " : "") + "14px monospace";
        ctx.textAlign = "center";
        ctx.fillText(p.text, p.x, p.y);
        
        p.y -= 0.5; // Float up
        p.life--;
        if(p.life <= 0) rlState.particles.splice(i, 1);
    }
}
