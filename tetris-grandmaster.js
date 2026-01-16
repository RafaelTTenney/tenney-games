import { getHighScore, submitHighScore } from './score-store.js';

/* Tetris Grandmaster - Enhanced Logic with Lock Delay & Visuals */

let gmState = {
    canvas: null,
    ctx: null,
    cols: 10,
    rows: 20,
    bs: 24, // Block Size adjusted for layout
    offsetX: 100, // Offset to center the board
    offsetY: 10,
    
    board: [],
    piece: null,
    ghost: null,
    holdPiece: null,
    holdUsed: false,
    queue: [],
    bag: [],
    
    score: 0,
    lines: 0,
    level: 0,
    grade: "9", // 9..1, S1..GM
    grades: ["9","8","7","6","5","4","3","2","1","S1","S2","S3","S4","M","GM"],
    highScore: 0,
    
    running: false,
    gameOver: false,
    
    // Timing & Physics
    lastTime: 0,
    dropCounter: 0,
    dropInterval: 800, // Gravity
    lockTimer: 0,      // How long piece has been on ground
    lockDelay: 500,    // 0.5 seconds to slide
    isLanded: false,   // Is piece currently touching ground?
    
    shapes: [
        [[1,1,1,1]],       // I
        [[1,1],[1,1]],     // O
        [[0,1,0],[1,1,1]], // T
        [[1,0,0],[1,1,1]], // L
        [[0,0,1],[1,1,1]], // J
        [[0,1,1],[1,1,0]], // S
        [[1,1,0],[0,1,1]]  // Z
    ],
    colors: [null, '#00FFFF', '#FFFF00', '#AA00FF', '#FFAA00', '#0000FF', '#00FF00', '#FF0000']
};

const GM_GAME_ID = 'tetris-grandmaster';

async function loadGMHighScore() {
    gmState.highScore = await getHighScore(GM_GAME_ID);
    if (gmState.ctx) renderGM();
}

async function submitGMHighScoreIfNeeded() {
    if (gmState.score <= gmState.highScore) return;
    const saved = await submitHighScore(GM_GAME_ID, gmState.score);
    if (typeof saved === 'number') gmState.highScore = saved;
    if (gmState.ctx) renderGM();
}

function initGM() {
    gmState.canvas = document.getElementById('gm-canvas');
    if(!gmState.canvas) return;
    gmState.ctx = gmState.canvas.getContext('2d');
    
    // Bind Start Button Logic safely
    const btn = document.getElementById('gmStartBtn');
    if(btn) btn.onclick = startGM;

    window.addEventListener('keydown', handleGMInput);
    
    // Initial Render (Empty)
    renderGM();
    loadGMHighScore();
}

function stopGM() {
    gmState.running = false;
    window.removeEventListener('keydown', handleGMInput);
}

function startGM() {
    gmState.board = Array(gmState.rows).fill().map(() => Array(gmState.cols).fill(0));
    gmState.score = 0;
    gmState.lines = 0;
    gmState.level = 0;
    gmState.grade = "9";
    
    gmState.queue = [];
    gmState.bag = [];
    gmState.holdPiece = null;
    gmState.holdUsed = false;
    
    gmState.gameOver = false;
    gmState.dropInterval = 800;
    gmState.lockTimer = 0;
    gmState.isLanded = false;

    loadGMHighScore();
    
    fillQueue();
    spawnPiece();
    
    gmState.running = true;
    gmState.lastTime = 0;
    loopGM();
}

function loopGM(time = 0) {
    if(!gmState.running) return;
    
    const deltaTime = time - gmState.lastTime;
    gmState.lastTime = time;

    // Normal Gravity
    if (!gmState.isLanded) {
        gmState.dropCounter += deltaTime;
        if(gmState.dropCounter > gmState.dropInterval) {
            dropPiece();
        }
    } else {
        // LOCK DELAY LOGIC (Sliding)
        // If landed, we count down lock timer
        gmState.lockTimer += deltaTime;
        if (gmState.lockTimer > gmState.lockDelay) {
            lockPiece();
        }
    }

    renderGM();
    if(!gmState.gameOver) requestAnimationFrame(loopGM);
}

/* --- Gameplay Logic --- */

function fillQueue() {
    if(gmState.bag.length === 0) {
        gmState.bag = [1,2,3,4,5,6,7];
        // Fisher-Yates shuffle
        for (let i = gmState.bag.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [gmState.bag[i], gmState.bag[j]] = [gmState.bag[j], gmState.bag[i]];
        }
    }
    while(gmState.queue.length < 3) {
        gmState.queue.push(gmState.bag.pop());
    }
}

function spawnPiece() {
    if(gmState.queue.length === 0) fillQueue();
    let type = gmState.queue.shift();
    
    gmState.piece = {
        matrix: gmState.shapes[type-1],
        x: 3, 
        y: 0,
        type: type
    };
    
    gmState.holdUsed = false;
    gmState.isLanded = false;
    gmState.lockTimer = 0;
    gmState.dropCounter = 0;

    // Game Over Check
    if(collide(gmState.board, gmState.piece)) {
        gmState.gameOver = true;
        renderGM(); // Show fail state
        submitGMHighScoreIfNeeded();
    }
    updateGhost();
    checkLanding(); // Check immediately if we spawned on floor
}

function checkLanding() {
    // Check if moving down 1 spot collides
    gmState.piece.y++;
    if (collide(gmState.board, gmState.piece)) {
        gmState.isLanded = true;
    } else {
        gmState.isLanded = false;
    }
    gmState.piece.y--;
}

function handleGMInput(e) {
    if(gmState.gameOver || !gmState.running) return;
    
    let actionTaken = false;

    if(e.key === "ArrowLeft") { move(-1); actionTaken = true; }
    if(e.key === "ArrowRight") { move(1); actionTaken = true; }
    if(e.key === "ArrowDown") { 
        // Soft drop resets lock timer slightly to allow "plugging"
        gmState.dropCounter = gmState.dropInterval + 10; 
        actionTaken = true; 
    }
    if(e.key === "ArrowUp") { rotate(); actionTaken = true; }
    if(e.code === "Space") { hardDrop(); actionTaken = true; }
    if(e.key === "Shift" || e.key === "c") { hold(); actionTaken = true; }
    
    // Prevent default scroll
    if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();
}

function move(dir) {
    gmState.piece.x += dir;
    if(collide(gmState.board, gmState.piece)) {
        gmState.piece.x -= dir; // Revert
    } else {
        // Successful move resets lock timer (Sliding Rule)
        if(gmState.isLanded) gmState.lockTimer = 0;
        updateGhost();
        checkLanding();
    }
}

function rotate() {
    let prev = gmState.piece.matrix;
    // Transpose + Reverse
    let rotated = gmState.piece.matrix[0].map((val, index) => gmState.piece.matrix.map(row => row[index]).reverse());
    
    gmState.piece.matrix = rotated;
    if(collide(gmState.board, gmState.piece)) {
        // Wall Kick (Try Right, then Left)
        gmState.piece.x += 1;
        if(collide(gmState.board, gmState.piece)) {
            gmState.piece.x -= 2;
            if(collide(gmState.board, gmState.piece)) {
                gmState.piece.x += 1;
                gmState.piece.matrix = prev; // Fail
                return;
            }
        }
    }
    // Successful rotate resets lock timer
    if(gmState.isLanded) gmState.lockTimer = 0;
    updateGhost();
    checkLanding();
}

function dropPiece() {
    gmState.piece.y++;
    if(collide(gmState.board, gmState.piece)) {
        gmState.piece.y--;
        // Don't lock immediately in dropPiece. 
        // The Lock Timer in loopGM handles the actual locking.
        gmState.isLanded = true; 
    } else {
        gmState.isLanded = false;
        gmState.dropCounter = 0;
    }
}

function hardDrop() {
    while(!collide(gmState.board, gmState.piece)) {
        gmState.piece.y++;
    }
    gmState.piece.y--;
    lockPiece(); // Hard drop locks instantly
}

function lockPiece() {
    // Add to board
    gmState.piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if(value !== 0) {
                gmState.board[y + gmState.piece.y][x + gmState.piece.x] = gmState.piece.type;
            }
        });
    });
    
    sweep();
    spawnPiece();
}

function hold() {
    if(gmState.holdUsed) return;
    
    let currentType = gmState.piece.type;
    if(gmState.holdPiece === null) {
        gmState.holdPiece = currentType;
        spawnPiece();
    } else {
        let temp = gmState.holdPiece;
        gmState.holdPiece = currentType;
        gmState.piece = {
            matrix: gmState.shapes[temp-1],
            x: 3,
            y: 0,
            type: temp
        };
        // Reset positioning logic for new piece
        gmState.isLanded = false;
        gmState.lockTimer = 0;
        updateGhost();
        checkLanding();
    }
    gmState.holdUsed = true;
}

function collide(board, piece) {
    const m = piece.matrix;
    for(let y=0; y<m.length; y++) {
        for(let x=0; x<m[y].length; x++) {
            if(m[y][x] !== 0 && 
               (board[y + piece.y] && board[y + piece.y][x + piece.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function updateGhost() {
    gmState.ghost = { ...gmState.piece };
    while(!collide(gmState.board, gmState.ghost)) {
        gmState.ghost.y++;
    }
    gmState.ghost.y--;
}

function sweep() {
    let rowCount = 0;
    outer: for(let y = gmState.rows - 1; y > 0; y--) {
        for(let x = 0; x < gmState.cols; x++) {
            if(gmState.board[y][x] === 0) continue outer;
        }
        const row = gmState.board.splice(y, 1)[0].fill(0);
        gmState.board.unshift(row);
        y++;
        rowCount++;
    }
    
    if(rowCount > 0) {
        gmState.lines += rowCount;
        gmState.score += rowCount * 100 * (gmState.level + 1);
        
        // Level Up
        gmState.level += rowCount;
        
        // Update Grade based on score thresholds (Simplified)
        let gradeIdx = Math.min(Math.floor(gmState.score / 2000), gmState.grades.length - 1);
        gmState.grade = gmState.grades[gradeIdx];
        
        // Increase Speed
        let speed = Math.max(50, 800 - (gmState.level * 10)); 
        gmState.dropInterval = speed;
    }
}

/* --- Rendering --- */

function renderGM() {
    let ctx = gmState.ctx;
    let canvas = gmState.canvas;
    
    // Background
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw Board Background
    ctx.fillStyle = '#111';
    ctx.fillRect(gmState.offsetX, gmState.offsetY, gmState.cols * gmState.bs, gmState.rows * gmState.bs);
    ctx.strokeStyle = '#333';
    ctx.strokeRect(gmState.offsetX, gmState.offsetY, gmState.cols * gmState.bs, gmState.rows * gmState.bs);

    // Draw Stack
    drawMatrix(gmState.board, {x:0, y:0});
    
    // Draw Ghost
    if(gmState.ghost && !gmState.gameOver) {
        ctx.globalAlpha = 0.2;
        drawMatrix(gmState.ghost.matrix, {x:gmState.ghost.x, y:gmState.ghost.y}, gmState.ghost.type);
        ctx.globalAlpha = 1.0;
    }
    
    // Draw Active Piece
    if(gmState.piece && !gmState.gameOver) {
        drawMatrix(gmState.piece.matrix, {x:gmState.piece.x, y:gmState.piece.y}, gmState.piece.type);
    }

    // --- Sidebar UI ---
    ctx.fillStyle = "#fff";
    ctx.font = "16px Arial";
    
    // HOLD (Left Side)
    ctx.fillText("HOLD", 20, 50);
    if(gmState.holdPiece) {
        let shape = gmState.shapes[gmState.holdPiece-1];
        drawMiniMatrix(shape, 20, 60, gmState.holdPiece);
    }

    // NEXT (Right Side)
    let nextX = gmState.offsetX + (gmState.cols * gmState.bs) + 20;
    ctx.fillText("NEXT", nextX, 50);
    for(let i=0; i<Math.min(3, gmState.queue.length); i++) {
        let type = gmState.queue[i];
        let shape = gmState.shapes[type-1];
        drawMiniMatrix(shape, nextX, 60 + (i * 60), type);
    }

    // STATS
    ctx.fillStyle = "#fff";
    ctx.font = "bold 20px monospace";
    ctx.fillText("GRADE: " + gmState.grade, nextX, 300);
    ctx.font = "16px monospace";
    ctx.fillText("LEVEL: " + gmState.level, nextX, 330);
    ctx.fillText("LINES: " + gmState.lines, nextX, 350);
    ctx.fillText("SCORE: " + gmState.score, nextX, 370);
    ctx.fillText("HIGH: " + gmState.highScore, nextX, 390);

    // GAME OVER OVERLAY
    if(gmState.gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.8)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ff0000";
        ctx.font = "30px Arial";
        ctx.fillText("GAME OVER", 140, 200);
        ctx.fillStyle = "#fff";
        ctx.font = "20px Arial";
        ctx.fillText("Final Grade: " + gmState.grade, 160, 240);
        ctx.fillText("Press Close to Reset", 150, 280);
    }
}

function drawMatrix(matrix, offset, typeOverride) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            let val = typeOverride || value;
            if(val !== 0) {
                let px = (x + offset.x) * gmState.bs + gmState.offsetX;
                let py = (y + offset.y) * gmState.bs + gmState.offsetY;
                
                gmState.ctx.fillStyle = gmState.colors[val];
                gmState.ctx.fillRect(px, py, gmState.bs-1, gmState.bs-1);
                
                gmState.ctx.lineWidth = 2;
                gmState.ctx.strokeStyle = "rgba(255,255,255,0.5)";
                gmState.ctx.strokeRect(px, py, gmState.bs-1, gmState.bs-1);
            }
        });
    });
}

function drawMiniMatrix(matrix, startX, startY, type) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if(value !== 0) {
                gmState.ctx.fillStyle = gmState.colors[type];
                gmState.ctx.fillRect(startX + x*15, startY + y*15, 14, 14);
            }
        });
    });
}
