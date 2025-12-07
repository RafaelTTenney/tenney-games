/* Tetris Grandmaster - Advanced Engine (Fixed Start) */

let gmState = {
    canvas: null,
    ctx: null,
    cols: 10,
    rows: 20,
    bs: 28,
    board: [],
    piece: null,
    ghost: null,
    holdPiece: null,
    holdUsed: false,
    queue: [],
    bag: [],
    score: 0,
    lines: 0,
    running: false,
    dropInterval: 800,
    lastTime: 0,
    dropCounter: 0,
    gameOver: false,
    shapes: [
        [[1,1,1,1]], // I
        [[1,1],[1,1]], // O
        [[0,1,0],[1,1,1]], // T
        [[1,0,0],[1,1,1]], // L
        [[0,0,1],[1,1,1]], // J
        [[0,1,1],[1,1,0]], // S
        [[1,1,0],[0,1,1]]  // Z
    ],
    colors: [null, '#00FFFF', '#FFFF00', '#AA00FF', '#FFAA00', '#0000FF', '#00FF00', '#FF0000']
};

function initGM() {
    gmState.canvas = document.getElementById('gm-canvas');
    if(!gmState.canvas) return;
    gmState.ctx = gmState.canvas.getContext('2d');
    
    // Explicitly re-bind the start button every time we init
    const startBtn = document.getElementById('gmStartBtn');
    if(startBtn) {
        startBtn.onclick = startGM;
    }

    window.addEventListener('keydown', handleGMInput);
}

function stopGM() {
    gmState.running = false;
    window.removeEventListener('keydown', handleGMInput);
}

function startGM() {
    gmState.board = Array(gmState.rows).fill().map(() => Array(gmState.cols).fill(0));
    gmState.score = 0;
    gmState.lines = 0;
    gmState.queue = [];
    gmState.holdPiece = null;
    gmState.gameOver = false;
    gmState.dropInterval = 800;
    fillQueue();
    spawnPiece();
    gmState.running = true;
    gmState.lastTime = 0;
    updateScore();
    loopGM();
}

function loopGM(time = 0) {
    if(!gmState.running) return;
    
    const deltaTime = time - gmState.lastTime;
    gmState.lastTime = time;

    gmState.dropCounter += deltaTime;
    if(gmState.dropCounter > gmState.dropInterval) {
        dropPiece();
    }

    renderGM();
    if(!gmState.gameOver) requestAnimationFrame(loopGM);
}

function fillQueue() {
    if(gmState.bag.length === 0) {
        gmState.bag = [1,2,3,4,5,6,7];
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
    
    if(collide(gmState.board, gmState.piece)) {
        gmState.gameOver = true;
        alert("Game Over! Score: " + gmState.score);
    }
    updateGhost();
}

function handleGMInput(e) {
    if(gmState.gameOver || !gmState.running) return;
    
    if(e.key === "ArrowLeft") { move(-1); }
    if(e.key === "ArrowRight") { move(1); }
    if(e.key === "ArrowDown") { dropPiece(); }
    if(e.key === "ArrowUp") { rotate(); }
    if(e.code === "Space") { hardDrop(); }
    if(e.key === "Shift" || e.key === "c") { hold(); }
    
    if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)) e.preventDefault();
}

function move(dir) {
    gmState.piece.x += dir;
    if(collide(gmState.board, gmState.piece)) {
        gmState.piece.x -= dir;
    } else {
        updateGhost();
    }
}

function rotate() {
    let prev = gmState.piece.matrix;
    let rotated = gmState.piece.matrix[0].map((val, index) => gmState.piece.matrix.map(row => row[index]).reverse());
    
    gmState.piece.matrix = rotated;
    if(collide(gmState.board, gmState.piece)) {
        gmState.piece.x += 1;
        if(collide(gmState.board, gmState.piece)) {
            gmState.piece.x -= 2;
            if(collide(gmState.board, gmState.piece)) {
                gmState.piece.x += 1;
                gmState.piece.matrix = prev;
            }
        }
    }
    updateGhost();
}

function dropPiece() {
    gmState.piece.y++;
    if(collide(gmState.board, gmState.piece)) {
        gmState.piece.y--;
        merge();
        spawnPiece();
        gmState.dropCounter = 0;
    }
}

function hardDrop() {
    while(!collide(gmState.board, gmState.piece)) {
        gmState.piece.y++;
    }
    gmState.piece.y--;
    merge();
    spawnPiece();
    gmState.dropCounter = 0;
}

function updateGhost() {
    gmState.ghost = { ...gmState.piece };
    while(!collide(gmState.board, gmState.ghost)) {
        gmState.ghost.y++;
    }
    gmState.ghost.y--;
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
    }
    gmState.holdUsed = true;
    updateGhost();
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

function merge() {
    gmState.piece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if(value !== 0) {
                gmState.board[y + gmState.piece.y][x + gmState.piece.x] = gmState.piece.type;
            }
        });
    });
    sweep();
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
        gmState.score += rowCount * 100 * rowCount;
        gmState.dropInterval = Math.max(100, 800 - (gmState.lines * 10));
        updateScore();
    }
}

function updateScore() {
    const el = document.getElementById('gm-score');
    if(el) el.innerText = `Lines: ${gmState.lines} | Score: ${gmState.score}`;
}

function renderGM() {
    let ctx = gmState.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, gmState.canvas.width, gmState.canvas.height);

    drawMatrix(gmState.board, {x:0, y:0});
    
    if(gmState.ghost) {
        ctx.globalAlpha = 0.2;
        drawMatrix(gmState.ghost.matrix, {x:gmState.ghost.x, y:gmState.ghost.y}, gmState.ghost.type);
        ctx.globalAlpha = 1.0;
    }
    drawMatrix(gmState.piece.matrix, {x:gmState.piece.x, y:gmState.piece.y}, gmState.piece.type);
}

function drawMatrix(matrix, offset, typeOverride) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            let val = typeOverride || value;
            if(val !== 0) {
                gmState.ctx.fillStyle = gmState.colors[val];
                gmState.ctx.fillRect((x + offset.x) * gmState.bs, (y + offset.y) * gmState.bs, gmState.bs-1, gmState.bs-1);
                
                gmState.ctx.lineWidth = 2;
                gmState.ctx.strokeStyle = "rgba(255,255,255,0.5)";
                gmState.ctx.strokeRect((x + offset.x) * gmState.bs, (y + offset.y) * gmState.bs, gmState.bs-1, gmState.bs-1);
            }
        });
    });
}
