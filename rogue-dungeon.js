import { getHighScore, submitHighScore } from './score-store.js';

/* Rogue Dungeon - Neon Depths Edition */

const ROGUE_GAME_ID = 'rogue-dungeon';
let rogueBestLevel = 0;
let rogueSubmitted = false;

async function loadRogueBest() {
    rogueBestLevel = await getHighScore(ROGUE_GAME_ID);
    updateRLUI();
}

async function submitRogueBestIfNeeded() {
    if (rogueSubmitted) return;
    rogueSubmitted = true;
    if (rlState.level <= rogueBestLevel) return;
    const saved = await submitHighScore(ROGUE_GAME_ID, rlState.level);
    if (typeof saved === 'number') rogueBestLevel = saved;
    updateRLUI();
}

let rlState = {
    canvas: null,
    ctx: null,
    tileSize: 20,
    cols: 30,
    rows: 30,
    map: [],        // 1 = Wall, 0 = Floor
    memory: [],     // True if player has visited this tile (Fog of War)
    visible: [],    // True if currently in FOV
    items: [],
    traps: [],
    shrines: [],
    rooms: [],
    stairs: null,
    stairsActive: false,
    particles: [],  // Floating damage numbers
    alert: 0,
    alertMax: 100,
    player: {
        x: 1, y: 1, 
        hp: 100, maxHp: 100, 
        xp: 0, level: 1, 
        baseDmg: 6, 
        potions: 1, // Start with 1 potion
        weapon: {name: "Bare Hands", val: 0},
        armor: {name: "Rags", val: 0},
        shield: 0,
        pulseCharges: 1,
        pulseMax: 2
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
    rlState.canvas.width = rlState.cols * rlState.tileSize;
    rlState.canvas.height = rlState.rows * rlState.tileSize;
    
    document.getElementById('rl-restart').onclick = startRun;
    
    // Remove old listeners to prevent duplicates
    window.removeEventListener('keydown', handleRogueInput);
    window.addEventListener('keydown', handleRogueInput);

    startRun();
    loadRogueBest();
    gameLoop(); // Start animation loop for particles
}

function stopRogue() {
    window.removeEventListener('keydown', handleRogueInput);
    if(rlState.animFrame) cancelAnimationFrame(rlState.animFrame);
}

function startRun() {
    rogueSubmitted = false;
    rlState.level = 1;
    rlState.player = {
        x: 1, y: 1, 
        hp: 100, maxHp: 100, 
        xp: 0, level: 1, 
        baseDmg: 6, 
        potions: 1,
        weapon: {name: "Bare Hands", val: 0},
        armor: {name: "Rags", val: 0},
        shield: 0,
        pulseCharges: 1,
        pulseMax: 2
    };
    rlState.log = [];
    rlState.particles = [];
    rlState.alert = 0;
    
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
    rlState.traps = [];
    rlState.shrines = [];
    rlState.stairs = null;
    rlState.stairsActive = false;

    const rooms = [];
    const maxRooms = 14;
    const minSize = 4;
    const maxSize = 9;

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

    if (rooms.length === 0) {
        const fallback = {
            x: Math.max(1, Math.floor(rlState.cols / 2) - 2),
            y: Math.max(1, Math.floor(rlState.rows / 2) - 2),
            w: 5,
            h: 5
        };
        createRoom(fallback);
        rooms.push(fallback);
    }

    rlState.rooms = rooms;

    // Place Player in first room
    let fRoom = rooms[0];
    rlState.player.x = fRoom.x + Math.floor(fRoom.w / 2);
    rlState.player.y = fRoom.y + Math.floor(fRoom.h / 2);

    ensureConnectedRooms(rooms);

    // Spawn entities in other rooms
    for(let i=1; i<rooms.length; i++) {
        spawnInRoom(rooms[i]);
    }

    // Place exit in farthest room (last room)
    let lastRoom = rooms[rooms.length - 1];
    rlState.stairs = {
        x: lastRoom.x + Math.floor(lastRoom.w / 2),
        y: lastRoom.y + Math.floor(lastRoom.h / 2)
    };

    pruneDisconnectedFloors();
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

function isFeatureBlocked(x, y) {
    if (rlState.player.x === x && rlState.player.y === y) return true;
    if (rlState.stairs && rlState.stairs.x === x && rlState.stairs.y === y) return true;
    if (rlState.enemies.find(e => e.x === x && e.y === y)) return true;
    if (rlState.items.find(i => i.x === x && i.y === y)) return true;
    if (rlState.traps.find(t => t.x === x && t.y === y)) return true;
    if (rlState.shrines.find(s => s.x === x && s.y === y)) return true;
    return false;
}

function findOpenTile(room) {
    for (let tries = 0; tries < 20; tries++) {
        const x = room.x + Math.floor(Math.random() * room.w);
        const y = room.y + Math.floor(Math.random() * room.h);
        if (rlState.map[x][y] === 0 && !isFeatureBlocked(x, y)) {
            return { x, y };
        }
    }
    return null;
}

function computeConnectivity(startX, startY) {
    const cols = rlState.cols;
    const rows = rlState.rows;
    const visited = Array(cols).fill().map(() => Array(rows).fill(false));
    const dist = Array(cols).fill().map(() => Array(rows).fill(-1));

    if (rlState.map[startX][startY] !== 0) {
        return { visited, dist };
    }

    const queue = [{ x: startX, y: startY }];
    visited[startX][startY] = true;
    dist[startX][startY] = 0;

    for (let i = 0; i < queue.length; i++) {
        const cur = queue[i];
        const neighbors = [
            { x: cur.x + 1, y: cur.y },
            { x: cur.x - 1, y: cur.y },
            { x: cur.x, y: cur.y + 1 },
            { x: cur.x, y: cur.y - 1 }
        ];
        neighbors.forEach(next => {
            if (next.x < 0 || next.x >= cols || next.y < 0 || next.y >= rows) return;
            if (visited[next.x][next.y]) return;
            if (rlState.map[next.x][next.y] !== 0) return;
            visited[next.x][next.y] = true;
            dist[next.x][next.y] = dist[cur.x][cur.y] + 1;
            queue.push(next);
        });
    }

    return { visited, dist };
}

function ensureConnectedRooms(rooms) {
    if (!rooms || rooms.length === 0) return;
    const start = { x: rlState.player.x, y: rlState.player.y };
    let connectivity = computeConnectivity(start.x, start.y);

    rooms.forEach(room => {
        const cx = room.x + Math.floor(room.w / 2);
        const cy = room.y + Math.floor(room.h / 2);
        if (!connectivity.visited[cx][cy]) {
            createHTunnel(start.x, cx, start.y);
            createVTunnel(start.y, cy, cx);
            connectivity = computeConnectivity(start.x, start.y);
        }
    });
}

function pruneDisconnectedFloors() {
    const cols = rlState.cols;
    const rows = rlState.rows;
    const startX = rlState.player.x;
    const startY = rlState.player.y;
    if (rlState.map[startX][startY] !== 0) return;

    const connectivity = computeConnectivity(startX, startY);
    const visited = connectivity.visited;
    const dist = connectivity.dist;

    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            if (rlState.map[x][y] === 0 && !visited[x][y]) {
                rlState.map[x][y] = 1;
                rlState.memory[x][y] = false;
                rlState.visible[x][y] = false;
            }
        }
    }

    rlState.items = rlState.items.filter(i => visited[i.x] && visited[i.x][i.y]);
    rlState.traps = rlState.traps.filter(t => visited[t.x] && visited[t.x][t.y]);
    rlState.enemies = rlState.enemies.filter(e => visited[e.x] && visited[e.x][e.y]);
    rlState.shrines = rlState.shrines.filter(s => visited[s.x] && visited[s.x][s.y]);

    if (rlState.stairs && (!visited[rlState.stairs.x] || !visited[rlState.stairs.x][rlState.stairs.y])) {
        let best = null;
        let bestDist = -1;
        for (let x = 0; x < cols; x++) {
            for (let y = 0; y < rows; y++) {
                if (!visited[x][y]) continue;
                if (x === rlState.player.x && y === rlState.player.y) continue;
                if (dist[x][y] > bestDist) {
                    bestDist = dist[x][y];
                    best = { x, y };
                }
            }
        }
        rlState.stairs = best || { x: rlState.player.x, y: rlState.player.y };
    }
}

function spawnInRoom(room) {
    // Chance for enemy
    if(Math.random() < 0.8) {
        const spawn = findOpenTile(room);
        if(spawn) {
            const enemy = createEnemyAt(spawn.x, spawn.y);
            if (enemy) rlState.enemies.push(enemy);
        }
    }

    // Chance for item
    if(Math.random() < 0.5) {
        const spawn = findOpenTile(room);
        if(spawn) generateItem(spawn.x, spawn.y);
    }

    // Chance for trap
    if(Math.random() < 0.3) {
        const spawn = findOpenTile(room);
        if(spawn) rlState.traps.push({ x: spawn.x, y: spawn.y, active: true });
    }

    // Chance for shrine
    if(Math.random() < 0.2) {
        const spawn = findOpenTile(room);
        if(spawn) {
            const roll = Math.random();
            let type = 'heal';
            if (roll > 0.7) type = 'fury';
            else if (roll > 0.4) type = 'shield';
            rlState.shrines.push({ x: spawn.x, y: spawn.y, type, active: true });
        }
    }
}

function createEnemyAt(ex, ey) {
    // Base Enemy Scaling
    let hp = 15 + (rlState.level * 4);
    let dmg = 4 + Math.floor(rlState.level * 1.5);
    let typeRoll = Math.random();
    let enemy = {
        x: ex, y: ey,
        hp: hp, maxHp: hp,
        name: "Cyber-Goblin",
        dmg: dmg,
        moveDelay: 1,
        moveCooldown: 0,
        range: 1,
        xp: 15,
        color: `hsl(${0 + (rlState.level * 20)}, 100%, 50%)`
    };
    if (typeRoll > 0.6 && rlState.level >= 2) {
        enemy.name = "Neon Wraith";
        enemy.hp = hp - 2;
        enemy.maxHp = enemy.hp;
        enemy.dmg = Math.max(3, dmg - 1);
        enemy.range = 2;
        enemy.rangedDmg = Math.max(2, Math.floor(enemy.dmg * 0.7));
        enemy.moveDelay = 2;
        enemy.xp = 18;
        enemy.color = "#9b5cff";
    } else if (typeRoll > 0.82 && rlState.level >= 3) {
        enemy.name = "Steel Brute";
        enemy.hp = hp + 10 + rlState.level * 2;
        enemy.maxHp = enemy.hp;
        enemy.dmg = dmg + 2;
        enemy.moveDelay = 2;
        enemy.range = 1;
        enemy.xp = 22;
        enemy.color = "#ff7755";
    }
    return enemy;
}

function generateItem(x, y) {
    let rand = Math.random();
    let val = Math.floor(Math.random() * 2) + rlState.level;
    
    // 20% Potion, 25% Weapon, 25% Armor, 15% Chip, 15% Cache
    if(rand < 0.2) {
        rlState.items.push({ x, y, type: 'potion', name: "Neon Potion", val: 30 });
    } else if (rand < 0.45) {
        rlState.items.push({ x, y, type: 'weapon', name: "Laser Blade Mk." + val, val: val * 2 });
    } else if (rand < 0.7) {
        rlState.items.push({ x, y, type: 'armor', name: "Plasteel Vest Mk." + val, val: val });
    } else if (rand < 0.85) {
        rlState.items.push({ x, y, type: 'chip', name: "Core Chip", val: 5 });
    } else {
        rlState.items.push({ x, y, type: 'cache', name: "Data Cache", val: 20, reveal: 6 });
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

    if(e.key === "e" || e.key === "E" || e.code === "KeyE") {
        e.preventDefault();
        usePulse();
        tookTurn = true;
    }

    if(dx !== 0 || dy !== 0) {
        e.preventDefault();
        tookTurn = movePlayer(dx, dy);
    }

    if(tookTurn) {
        if(rlState.player.hp > 0) moveEnemies();
        tickAlert();
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

function usePulse() {
    if (rlState.player.pulseCharges <= 0) {
        logRL("Pulse offline. No charges.");
        return;
    }
    rlState.player.pulseCharges--;
    const radius = 2;
    let hit = 0;
    rlState.enemies.forEach(enemy => {
        const dist = Math.abs(enemy.x - rlState.player.x) + Math.abs(enemy.y - rlState.player.y);
        if (dist <= radius) {
            const dmg = 8 + Math.floor(rlState.level * 1.5);
            enemy.hp -= dmg;
            enemy.moveCooldown = Math.max(enemy.moveCooldown, 1);
            addParticle(enemy.x, enemy.y, dmg, "#7dd3fc", true);
            hit++;
        }
    });
    rlState.enemies = rlState.enemies.filter(enemy => {
        if (enemy.hp > 0) return true;
        logRL(`Pulse destroyed ${enemy.name}. +${enemy.xp || 15} XP`);
        gainXP(enemy.xp || 15);
        if (Math.random() < 0.35 && rlState.player.pulseCharges < rlState.player.pulseMax) {
            rlState.player.pulseCharges++;
            logRL("Pulse recharged.");
        }
        return false;
    });
    if (hit > 0) {
        logRL("EMP pulse detonated.");
        checkLevelClear();
    } else {
        logRL("Pulse fizzled. No targets.");
    }
}

function findRandomOpenTile() {
    for (let i = 0; i < 80; i++) {
        const x = Math.floor(Math.random() * rlState.cols);
        const y = Math.floor(Math.random() * rlState.rows);
        if (rlState.map[x][y] !== 0) continue;
        if (isFeatureBlocked(x, y)) continue;
        return { x, y };
    }
    return null;
}

function spawnReinforcement() {
    const tile = findRandomOpenTile();
    if (!tile) return;
    const enemy = createEnemyAt(tile.x, tile.y);
    if (enemy) {
        rlState.enemies.push(enemy);
        logRL("Reinforcement deployed.");
    }
}

function tickAlert() {
    rlState.alert = Math.min(rlState.alertMax, rlState.alert + 8);
    if (rlState.alert >= rlState.alertMax) {
        spawnReinforcement();
        rlState.alert = 20;
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
            logRL(`Destroyed ${target.name}. +${target.xp || 15} XP`);
            rlState.enemies = rlState.enemies.filter(e => e !== target);
            gainXP(target.xp || 15);
            if(Math.random() < 0.3 && rlState.player.pulseCharges < rlState.player.pulseMax) {
                rlState.player.pulseCharges++;
                logRL("Pulse charge recovered.");
            }
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

        if(rlState.stairsActive && rlState.stairs && nx === rlState.stairs.x && ny === rlState.stairs.y) {
            logRL("Accessing lift... descending.");
            advanceLevel();
            return true;
        }

        // Trap check
        const trap = rlState.traps.find(t => t.x === nx && t.y === ny && t.active);
        if(trap) {
            trap.active = false;
            const trapDmg = 6 + Math.floor(rlState.level * 1.5);
            rlState.player.hp = Math.max(0, rlState.player.hp - trapDmg);
            addParticle(nx, ny, `-${trapDmg}`, "#FF3333");
            logRL("Triggered a trap!");
            if(rlState.player.hp <= 0) {
                rlState.player.hp = 0;
                logRL("CRITICAL FAILURE. SYSTEM OFFLINE.");
                submitRogueBestIfNeeded();
            }
        }
        
        // Item Pickup
        let itemIdx = rlState.items.findIndex(i => i.x === nx && i.y === ny);
        if(itemIdx !== -1) {
            let item = rlState.items[itemIdx];
            pickupItem(item);
            rlState.items.splice(itemIdx, 1);
        }
        const shrine = rlState.shrines.find(s => s.x === nx && s.y === ny && s.active);
        if(shrine) {
            triggerShrine(shrine);
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
    } else if(item.type === 'chip') {
        rlState.player.maxHp += item.val;
        rlState.player.hp = Math.min(rlState.player.maxHp, rlState.player.hp + item.val);
        rlState.player.baseDmg += 1;
        logRL("Installed Core Chip (+HP/+DMG).");
        addParticle(rlState.player.x, rlState.player.y, "CHIP", "#FFD700");
    } else if(item.type === 'cache') {
        logRL("Recovered data cache. Map pulse online.");
        gainXP(item.val);
        revealMemoryPulse(rlState.player.x, rlState.player.y, item.reveal || 6);
        if (rlState.player.pulseCharges < rlState.player.pulseMax) {
            rlState.player.pulseCharges++;
            logRL("Pulse charge restored.");
        }
        addParticle(rlState.player.x, rlState.player.y, "+DATA", "#7dd3fc");
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

function triggerShrine(shrine) {
    shrine.active = false;
    if (shrine.type === 'shield') {
        rlState.player.shield += 1;
        logRL("Shield shrine: barrier charged.");
        addParticle(shrine.x, shrine.y, "SHIELD", "#7dd3fc", true);
    } else if (shrine.type === 'fury') {
        rlState.player.baseDmg += 2;
        logRL("Fury shrine: attack matrix boosted.");
        addParticle(shrine.x, shrine.y, "FURY", "#ff8a65", true);
    } else {
        const heal = Math.min(30, rlState.player.maxHp - rlState.player.hp);
        rlState.player.hp = Math.min(rlState.player.maxHp, rlState.player.hp + heal);
        if (heal > 0) {
            logRL("Restore shrine: systems repaired.");
            addParticle(shrine.x, shrine.y, `+${heal}`, "#00FFAA", true);
        } else {
            logRL("Restore shrine: systems already stable.");
            addParticle(shrine.x, shrine.y, "STABLE", "#00FFAA", true);
        }
    }
}

function checkLevelClear() {
    if(rlState.enemies.length === 0) {
        if(!rlState.stairsActive) {
            rlState.stairsActive = true;
            logRL("Sector Clear. Lift online.");
            rlState.player.hp = Math.min(rlState.player.maxHp, rlState.player.hp + 10);
        }
    }
}

function advanceLevel() {
    rlState.level++;
    generateLevel();
    rlState.stairsActive = false;
    logRL(`Entered Depth ${rlState.level}`);
}

function moveEnemies() {
    rlState.enemies.forEach(e => {
        if(e.moveCooldown && e.moveCooldown > 0) {
            e.moveCooldown--;
            return;
        }
        let dist = Math.abs(rlState.player.x - e.x) + Math.abs(rlState.player.y - e.y);
        
        if((e.range && dist <= e.range) || dist <= 1) {
            // Attack
            let rawDmg = e.dmg;
            if(e.range && dist > 1) {
                rawDmg = e.rangedDmg || Math.max(2, Math.floor(e.dmg * 0.7));
                logRL(`${e.name} fires from range.`);
            }
            // Armor reduces damage
            let mitigated = Math.max(0, rawDmg - rlState.player.armor.val);
            // Minimum 1 damage if hit
            let finalDmg = Math.max(1, mitigated);

            if(rlState.player.shield > 0) {
                rlState.player.shield -= 1;
                addParticle(rlState.player.x, rlState.player.y, "SHIELD", "#7dd3fc", true);
                logRL("Shield absorbed a hit.");
                if(e.moveDelay && e.moveDelay > 1) e.moveCooldown = e.moveDelay - 1;
                return;
            }
            
            rlState.player.hp -= finalDmg;
            addParticle(rlState.player.x, rlState.player.y, `-${finalDmg}`, "#FF0000");
            
            if(rlState.player.hp <= 0) {
                rlState.player.hp = 0;
                logRL("CRITICAL FAILURE. SYSTEM OFFLINE.");
                submitRogueBestIfNeeded();
            }
            if(e.moveDelay && e.moveDelay > 1) e.moveCooldown = e.moveDelay - 1;
        } else if(dist < 8) {
            // Chase logic (simple pathfinding toward player)
            if(rlState.visible[e.x][e.y] || rlState.memory[e.x][e.y]) { // Only chase if player "woke" them or is nearby
                let dx = rlState.player.x - e.x;
                let dy = rlState.player.y - e.y;
                let mx = 0, my = 0;
                
                if(Math.abs(dx) > Math.abs(dy)) mx = dx > 0 ? 1 : -1;
                else my = dy > 0 ? 1 : -1;

                const nextX = e.x + mx;
                const nextY = e.y + my;
                if(nextX >= 0 && nextX < rlState.cols && nextY >= 0 && nextY < rlState.rows) {
                    if(rlState.map[nextX][nextY] === 0 && !isOccupied(nextX, nextY)) {
                        e.x = nextX;
                        e.y = nextY;
                    }
                }
                if(e.moveDelay && e.moveDelay > 1) e.moveCooldown = e.moveDelay - 1;
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

function revealMemoryPulse(cx, cy, radius) {
    for(let x = cx - radius; x <= cx + radius; x++) {
        for(let y = cy - radius; y <= cy + radius; y++) {
            if(x >= 0 && x < rlState.cols && y >= 0 && y < rlState.rows) {
                const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                if(d <= radius && rlState.map[x][y] === 0) {
                    rlState.memory[x][y] = true;
                }
            }
        }
    }
}

// --- Visuals & Rendering ---

function updateFOV() {
    let r = 8;
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
        x: x * rlState.tileSize + (rlState.tileSize / 2),
        y: y * rlState.tileSize + (rlState.tileSize / 2),
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
    const bestLabel = rogueBestLevel > 0 ? ` | Best: ${rogueBestLevel}` : '';
    document.getElementById('rl-level').innerText = `Lvl: ${rlState.player.level}${bestLabel}`;
    document.getElementById('rl-hp').innerText = `HP: ${rlState.player.hp}/${rlState.player.maxHp}`;
    let dmg = rlState.player.baseDmg + rlState.player.weapon.val;
    let def = rlState.player.armor.val;
    document.getElementById('rl-stats').innerText = `Atk: ${dmg} | Def: ${def} | Shield: ${rlState.player.shield}`;
    const pulseLabel = `${rlState.player.pulseCharges}/${rlState.player.pulseMax}`;
    const alertPct = Math.round((rlState.alert / rlState.alertMax) * 100);
    document.getElementById('rl-pulse').innerText = `Pulse: ${pulseLabel} (E)`;
    document.getElementById('rl-alert').innerText = `Alert: ${alertPct}%`;
    document.getElementById('rl-potions').innerText = `Potions: ${rlState.player.potions}`;
}

window.initRogue = initRogue;
window.stopRogue = stopRogue;

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
            } else if(i.type === 'chip') {
                ctx.fillStyle = "#FFD700";
                ctx.shadowColor = "#FFD700";
                ctx.beginPath();
                ctx.moveTo(cx, cy - 7);
                ctx.lineTo(cx + 7, cy);
                ctx.lineTo(cx, cy + 7);
                ctx.lineTo(cx - 7, cy);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = "#fff2a8";
                ctx.stroke();
            } else if(i.type === 'cache') {
                ctx.fillStyle = "#7dd3fc";
                ctx.shadowColor = "#7dd3fc";
                ctx.fillRect(cx - 6, cy - 6, 12, 12);
                ctx.strokeStyle = "#0ea5e9";
                ctx.strokeRect(cx - 6, cy - 6, 12, 12);
                ctx.beginPath();
                ctx.moveTo(cx - 4, cy);
                ctx.lineTo(cx + 4, cy);
                ctx.stroke();
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

    // Render Traps
    rlState.traps.forEach(t => {
        if(rlState.visible[t.x][t.y]) {
            let cx = t.x*ts + ts/2;
            let cy = t.y*ts + ts/2;
            ctx.strokeStyle = t.active ? "#FF3333" : "#662222";
            ctx.beginPath();
            ctx.moveTo(cx - 6, cy - 6);
            ctx.lineTo(cx + 6, cy + 6);
            ctx.moveTo(cx + 6, cy - 6);
            ctx.lineTo(cx - 6, cy + 6);
            ctx.stroke();
        }
    });

    // Render Shrines
    rlState.shrines.forEach(s => {
        if(rlState.visible[s.x][s.y] || rlState.memory[s.x][s.y]) {
            let cx = s.x*ts + ts/2;
            let cy = s.y*ts + ts/2;
            let color = "#00FFAA";
            if (s.type === 'shield') color = "#7dd3fc";
            if (s.type === 'fury') color = "#ff8a65";
            const fill = s.active ? color : "#223";
            ctx.fillStyle = fill;
            ctx.strokeStyle = color;
            ctx.beginPath();
            ctx.moveTo(cx, cy - 7);
            ctx.lineTo(cx + 7, cy);
            ctx.lineTo(cx, cy + 7);
            ctx.lineTo(cx - 7, cy);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    });

    // Render Stairs / Lift
    if(rlState.stairs) {
        let sx = rlState.stairs.x;
        let sy = rlState.stairs.y;
        if(rlState.visible[sx][sy] || rlState.memory[sx][sy]) {
            let px = sx * ts + ts/2;
            let py = sy * ts + ts/2;
            ctx.fillStyle = rlState.stairsActive ? "#00FFAA" : "#225544";
            ctx.fillRect(px - 6, py - 6, 12, 12);
            ctx.strokeStyle = "#00FFAA";
            ctx.strokeRect(px - 6, py - 6, 12, 12);
        }
    }

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
