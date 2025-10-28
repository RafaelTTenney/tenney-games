// --- PREVIEW GAMES: SIMPLE TETRIS + FULL INVADERS (no Racer) ---


// ---------------------- SIMPLE TETRIS ----------------------

// Get DOM elements (Tetris)
const simpleTetrisModal = document.getElementById('simpleTetrisModal');
const runSimpleTetrisBtn = document.getElementById('runSimpleTetrisBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const canvas = document.getElementById('game');
const ctx = canvas ? canvas.getContext('2d') : null;
const scoreP = document.getElementById('score');
const startBtn = document.getElementById('startBtn');
const controlsBtn = document.getElementById('controlsBtn');

const box = 24;
const speed = 50; // Milliseconds per frame (50ms * 10 counts = 500ms drop time)

let fastFall = false;
let score = 0;
let highScore;
let tetrisMessageTimer = 0; // Timer for the "TETRIS!" message

let block;
let rows;
let game; // Holds the setInterval ID
let count;

// FIXED Color Palette (Always cyan for the simple version)
const fixedPalette = { fill: '#00FFFF', stroke: '#33FFFF', shadow: '#00FFFF' };

// Block types (The 7 classic pieces)
const all_blocks = {
  0: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I (Line)
  1: [[1, 1], [1, 1]],                                     // O (Square)
  2: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],                     // T
  3: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],                     // S
  4: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],                     // Z
  5: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],                     // J
  6: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],                     // L
};

function loadHighScore() {
  highScore = parseInt(localStorage.getItem('tetrisHighScore')) || 0;
  if(scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
}

function saveHighScore() {
  localStorage.setItem('tetrisHighScore', highScore);
  if(scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
}

function start() {
  rows = [];
  for (let i = 0; i < 20; i++) {
    let row = [];
    for (let x = 0; x < 10; x++) {
      row.push(0);
    }
    rows.push(row);
  }
  score = 0;
  loadHighScore();
  count = 10;
  tetrisMessageTimer = 0;
  if (game) clearInterval(game);
  game = setInterval(drawFrame, speed);
  if (startBtn) startBtn.textContent = 'Restart';
}

function rotate() {
  if (!block) return;
  block[0] = transpose(block[0]);
  block[0] = reverse(block[0]);
  if (isColliding(block)) {
    block[0] = reverse(block[0]);
    block[0] = transpose(block[0]);
  }
}

function moveRight() {
  if (!block) return;
  block[1] += 1;
  if (isColliding(block)) block[1] -= 1;
}

function moveLeft() {
  if (!block) return;
  block[1] -= 1;
  if (isColliding(block)) block[1] += 1;
}

function transpose(L) {
  let final = [];
  for (let i = 0; i < L[0].length; i++) final.push([]);
  for (let i = 0; i < L.length; i++) {
    for (let x = 0; x < L[i].length; x++) final[x].push(L[i][x]);
  }
  return final;
}

function reverse(L) {
  for (let i = 0; i < L.length; i++) L[i].reverse();
  return L;
}

function isColliding(B) {
  for (let y = 0; y < B[0].length; y++) {
    for (let x = 0; x < B[0][y].length; x++) {
      if (B[0][y][x] === 1) {
        if (
          (B[1] + x) < 0 ||
          (B[1] + x) >= 10 ||
          (B[2] + y) >= 20
        ) {
          return true;
        }
        if (rows[B[2] + y] && rows[B[2] + y][B[1] + x] === 1) {
          return true;
        }
      }
    }
  }
  return false;
}

function drawFrame() {
  if (!ctx) return;
  
  // 1. Spawning
  if (!block) {
    let newBlockIndex = Math.floor(Math.random() * 7);
    block = [all_blocks[newBlockIndex], 4, 0];

    if (isColliding(block)) {
      clearInterval(game);
      game = null;
      if (startBtn) startBtn.textContent = 'Start';
      if (score > highScore) {
        alert('Game Over! New high score: ' + score);
        highScore = score;
        saveHighScore();
      } else {
        alert('Game Over! Score: ' + score);
      }
      return;
    }
    return;
  }

  // 2. Clear Canvas
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 3. Gravity and Collision Check
  if (count === 0 || (fastFall && (count % 2 === 0))) {
    count = 10;
    block[2] += 1;

    if (isColliding(block)) {
      block[2] -= 1;

      // Lock piece
      for (let y = 0; y < block[0].length; y++) {
        for (let x = 0; x < block[0][y].length; x++) {
          if (block[0][y][x] === 1) {
            if (rows[block[2] + y]) {
                rows[block[2] + y][block[1] + x] = 1;
            }
          }
        }
      }

      block = null;

      // Line Clear and Score Logic
      let linesClearedThisTurn = 0;
      for (let i = 0; i < 20; i++) {
        if (rows[i] && !rows[i].some(b => b === 0)) {
          rows.splice(i, 1);
          let row = []
          for (let x = 0; x < 10; x++) row.push(0);
          rows.unshift(row);
          linesClearedThisTurn++;
          i--;
        }
      }

      // Score update
      if (linesClearedThisTurn === 1) {
        score += 10;
      } else if (linesClearedThisTurn === 2) {
        score += 20;
      } else if (linesClearedThisTurn === 3) {
        score += 30;
      } else if (linesClearedThisTurn === 4) {
        score += 50; // TETRIS Bonus
        tetrisMessageTimer = 40;
      }

      if (linesClearedThisTurn > 0) {
         if(scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
      }
    }
  }

  // 4. Prepare Grid for Drawing (Rows and Block)
  let RaB = rows.map(row => [...row]);
  if (block) {
    for (let y = 0; y < block[0].length; y++) {
      for (let x = 0; x < block[0][y].length; x++) {
        if (block[0][y][x] === 1) {
          if (RaB[block[2] + y]) {
             RaB[block[2] + y][block[1] + x] = 1;
          }
        }
      }
    }
  }

  // 5. Draw Blocks
  ctx.fillStyle = fixedPalette.fill;
  ctx.strokeStyle = fixedPalette.stroke;
  ctx.lineWidth = 1;
  ctx.shadowColor = fixedPalette.shadow;
  ctx.shadowBlur = 5;

  const size = box - 3;
  const offset = 1.5;

  for (let y = 0; y < RaB.length; y++) {
    for (let x = 0; x < RaB[y].length; x++) {
      if (RaB[y][x] === 1) {
        ctx.fillRect(x * box + offset, y * box + offset, size, size);
        ctx.strokeRect(x * box + offset, y * box + offset, size, size);
      }
    }
  }

  // 6. Draw "TETRIS!" message
  if (tetrisMessageTimer > 0) {
    ctx.fillStyle = 'yellow';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 5;
    ctx.fillText('TETRIS!', canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
    tetrisMessageTimer--;
  }

  ctx.shadowBlur = 0;
  count -= 1;
}


// --- Modal and Event Handlers (Tetris) ---

function openModal() {
    if(simpleTetrisModal) simpleTetrisModal.style.display = 'flex';
    // Load high score and set button text when opening
    loadHighScore();
    if(startBtn) startBtn.textContent = 'Start';
}

function closeModal() {
    if(simpleTetrisModal) simpleTetrisModal.style.display = 'none';
    
    // Stop the game when closing
    if (game) {
      clearInterval(game);
      game = null;
    }
    block = null; // Clear active block
    
    // Clear canvas
    if (ctx) {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// Key Event Handlers (Only active when the modal is open)
document.addEventListener('keydown', event => {
  if (!simpleTetrisModal || simpleTetrisModal.style.display !== 'flex' || !game) return;

  if (
    ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key) ||
    event.code === 'Space'
  ) {
    event.preventDefault();
  }
  if (event.key === 'ArrowLeft') moveLeft();
  if (event.key === 'ArrowRight') moveRight();
  if (event.code === 'Space') rotate();
  if (event.key === 'ArrowDown') fastFall = true;
});

document.addEventListener('keyup', event => {
  if (event.key === 'ArrowDown') fastFall = false;
});


// ---------------------- FULL INVADERS (ported) ----------------------

// INVADERS DOM elements
const invadersModal = document.getElementById('invadersModal');
const runInvadersBtn = document.getElementById('runInvadersBtn');
const invadersModalCloseBtn = document.getElementById('invadersModalCloseBtn');
const invadersCanvas = document.getElementById('invaders-canvas');
const invadersCtx = invadersCanvas ? invadersCanvas.getContext('2d') : null;
const invadersMessageEl = document.getElementById('invaders-message');
const startInvadersBtn = document.getElementById('startInvadersBtn');
const invadersScoreEl = document.getElementById('invaders-score');

// State for invaders
let invaderState = {
  player: { x: 140, y: 350, width: 20, height: 15, lives: 3, alive: true },
  bullet: { x: 0, y: 0, width: 4, height: 10, active: false, alive: false },
  enemies: [],
  enemyBullets: [],
  bunkers: [],
  mysteryShip: { x: 0, y: 20, width: 25, height: 12, active: false, direction: 1, alive: false },
  enemyDirection: 1,
  score: 0,
  level: 1,
  gameOver: false,
  gameLoopId: null,
  dropSpeed: 10,
  initialEnemies: 0,
  enemyMoveTimer: 0,
  enemyMoveInterval: 30 // Initial timer value (lower is faster)
};

function createEnemies() {
  const state = invaderState;
  state.enemies = [];
  const enemyWidth = 20;
  const enemyHeight = 15;
  
  let startY = 30 + (state.level - 1) * 10;
  startY = Math.min(startY, 150);

  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 8; c++) {
      state.enemies.push({
        x: 30 + c * (enemyWidth + 10),
        y: startY + r * (enemyHeight + 10),
        width: enemyWidth,
        height: enemyHeight,
        alive: true
      });
    }
  }
  state.initialEnemies = state.enemies.length;
}

function createBunkers() {
  invaderState.bunkers = [];
  const bunkerWidth = 4; // 4 blocks wide
  const bunkerHeight = 3; // 3 blocks high
  const blockSize = 8;
  const startX = 30;
  const bunkerSpacing = (invadersCanvas ? invadersCanvas.width : 420 - 60) / 4;

  for (let b = 0; b < 4; b++) {
    let bunkerX = startX + (b * bunkerSpacing) + (bunkerSpacing / 2) - ((bunkerWidth * blockSize) / 2);
    for (let r = 0; r < bunkerHeight; r++) {
      for (let c = 0; c < bunkerWidth; c++) {
        if (r === bunkerHeight - 1 && (c === 1 || c === 2)) continue;
        
        invaderState.bunkers.push({
          x: bunkerX + c * blockSize,
          y: 300 + r * blockSize,
          width: blockSize,
          height: blockSize,
          alive: true
        });
      }
    }
  }
}

function checkCollision(objA, objB) {
  if (!objA.alive || !objB.alive) return false;
  
  return objA.x < objB.x + objB.width &&
         objA.x + objA.width > objB.x &&
         objA.y < objB.y + objB.height &&
         objA.y + objA.height > objB.y;
}

function updateInvaders() {
  if (invaderState.gameOver || !invadersCanvas) return;
  const state = invaderState;

  // Player bullet
  if (state.bullet.active) {
    state.bullet.y -= 15;
    if (state.bullet.y < 0) {
      state.bullet.active = false;
      state.bullet.alive = false;
    }
    
    for (let b = state.bunkers.length - 1; b >= 0; b--) {
      let bunkerBlock = state.bunkers[b];
      if (bunkerBlock.alive && checkCollision(state.bullet, bunkerBlock)) {
        bunkerBlock.alive = false;
        state.bullet.active = false;
        state.bullet.alive = false;
        break; 
      }
    }
    
    if (state.bullet.active) {
        for (let i = state.enemies.length - 1; i >= 0; i--) {
          let enemy = state.enemies[i];
          if (enemy.alive && checkCollision(state.bullet, enemy)) {
            enemy.alive = false; 
            state.bullet.active = false;
            state.bullet.alive = false;
            state.score += 10;
            if (invadersScoreEl) invadersScoreEl.textContent = `Score: ${state.score}`;
            break;
          }
        }
    }
    
    if (state.bullet.active && state.mysteryShip.active) {
        if (checkCollision(state.bullet, state.mysteryShip)) {
            state.mysteryShip.active = false;
            state.mysteryShip.alive = false;
            state.bullet.active = false;
            state.bullet.alive = false;
            let bonus = (Math.floor(Math.random() * 3) + 1) * 50;
            state.score += bonus;
            if (invadersMessageEl) invadersMessageEl.textContent = `+${bonus} POINTS!`;
            if (invadersScoreEl) invadersScoreEl.textContent = `Score: ${state.score}`;
        }
    }
  }
  
  // Enemy movement (timer)
  state.enemyMoveTimer--;
  if (state.enemyMoveTimer <= 0) {
      let moveDown = false;
      let moveStep = 5;
      
      let aliveEnemies = state.enemies.filter(e => e.alive);
      
      for (const enemy of aliveEnemies) {
        if ((state.enemyDirection > 0 && enemy.x + enemy.width >= invadersCanvas.width - 5) ||
            (state.enemyDirection < 0 && enemy.x <= 5)) {
          moveDown = true;
          state.enemyDirection *= -1;
          moveStep = 0;
          break;
        }
      }

      aliveEnemies.forEach(enemy => {
          if (moveDown) {
            enemy.y += state.dropSpeed;
          } else {
            enemy.x += state.enemyDirection * moveStep;
          }
          
          if (enemy.y + enemy.height > state.player.y) {
            stopInvaders("GAME OVER: They reached you!");
          }
      });
      
      let progress = (state.initialEnemies - aliveEnemies.length) / state.initialEnemies;
      state.enemyMoveInterval = Math.max(3, (30 - (state.level - 1) * 2) * (1 - progress * 0.9));
      state.enemyMoveTimer = state.enemyMoveInterval;
  }

  // Mystery ship
  if (!state.mysteryShip.active && Math.random() > 0.998) {
      state.mysteryShip.active = true;
      state.mysteryShip.alive = true;
      if (Math.random() > 0.5) {
          state.mysteryShip.x = -state.mysteryShip.width;
          state.mysteryShip.direction = 1;
      } else {
          state.mysteryShip.x = invadersCanvas.width;
          state.mysteryShip.direction = -1;
      }
  }
  
  if (state.mysteryShip.active) {
      state.mysteryShip.x += state.mysteryShip.direction * 1.5;
      if (state.mysteryShip.x > invadersCanvas.width || state.mysteryShip.x < -state.mysteryShip.width) {
          state.mysteryShip.active = false;
          state.mysteryShip.alive = false;
      }
  }

  // Enemy shooting
  let aliveEnemies = state.enemies.filter(e => e.alive);
  if (Math.random() > (0.98 - (state.level * 0.01)) && aliveEnemies.length > 0) {
    let shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
    state.enemyBullets.push({ 
        x: shooter.x + shooter.width / 2 - 2,
        y: shooter.y + shooter.height, 
        width: 4,
        height: 10,
        alive: true
    });
  }

  // Move enemy bullets
  state.enemyBullets = state.enemyBullets.filter(bullet => {
    bullet.y += 3;
    
    for (let b = state.bunkers.length - 1; b >= 0; b--) {
      let bunkerBlock = state.bunkers[b];
      if (bunkerBlock.alive && checkCollision(bullet, bunkerBlock)) {
        bunkerBlock.alive = false;
        return false;
      }
    }
    
    if (checkCollision(bullet, state.player)) {
      state.player.lives--;
      if (invadersScoreEl) invadersScoreEl.textContent = `Score: ${state.score}`;
      if (state.player.lives <= 0) {
          state.player.alive = false;
          stopInvaders("GAME OVER: You were hit!");
      } else {
          if (invadersMessageEl) invadersMessageEl.textContent = `HIT! ${state.player.lives} ships remain.`;
      }
      return false;
    }
    
    return bullet.y < invadersCanvas.height;
  });
  
  // Bases destroyed lose condition
  if (state.bunkers.length > 0 && state.bunkers.filter(b => b.alive).length === 0) {
      stopInvaders("GAME OVER: Bases destroyed!");
  }
  
  // Level win
  if (aliveEnemies.length === 0 && !state.gameOver) {
      startNextLevel();
  }
}

function drawInvaders() {
  if (!invadersCtx) return;
  const state = invaderState;

  invadersCtx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  invadersCtx.fillRect(0, 0, invadersCanvas.width, invadersCanvas.height);
  
  if (state.player.alive) {
    invadersCtx.fillStyle = '#00FFFF';
    invadersCtx.fillRect(state.player.x, state.player.y, state.player.width, state.player.height);
  }

  if (state.bullet.active) {
    invadersCtx.fillStyle = '#00FFFF';
    invadersCtx.fillRect(state.bullet.x, state.bullet.y, state.bullet.width, state.bullet.height);
  }
  
  invadersCtx.fillStyle = '#00FF00';
  state.bunkers.forEach(block => {
      if (block.alive) {
          invadersCtx.fillRect(block.x, block.y, block.width, block.height);
      }
  });

  invadersCtx.fillStyle = '#FF00FF';
  state.enemies.forEach(enemy => {
    if (enemy.alive) {
      invadersCtx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    }
  });
  
  if (state.mysteryShip.active) {
      invadersCtx.fillStyle = '#FF0000';
      invadersCtx.fillRect(state.mysteryShip.x, state.mysteryShip.y, state.mysteryShip.width, state.mysteryShip.height);
  }
  
  invadersCtx.fillStyle = '#FF0000';
  state.enemyBullets.forEach(bullet => {
      invadersCtx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  });
  
  invadersCtx.fillStyle = '#00FFFF';
  for (let i = 0; i < state.player.lives; i++) {
      invadersCtx.fillRect(10 + i * (state.player.width + 10), 380, state.player.width, state.player.height);
  }
  
  invadersCtx.font = '14px "Courier New", monospace';
  invadersCtx.fillStyle = '#888';
  invadersCtx.fillText(`Level: ${state.level}`, invadersCanvas.width - 70, 390);
}

function invadersGameLoop() {
  if (invaderState.gameOver) return;
  updateInvaders();
  drawInvaders();
  invaderState.gameLoopId = requestAnimationFrame(invadersGameLoop);
}

function startNextLevel() {
    const state = invaderState;
    state.level++;
    if (invadersMessageEl) invadersMessageEl.textContent = `Level ${state.level}!`;
    
    state.enemyBullets = [];
    state.bullet.active = false;
    state.bullet.alive = false;
    
    state.enemyMoveInterval = Math.max(5, 30 - (state.level - 1) * 2); 
    state.enemyMoveTimer = state.enemyMoveInterval;
    
    createEnemies();
    createBunkers();
}

function startInvaders() {
  if (invaderState.gameLoopId) {
    cancelAnimationFrame(invaderState.gameLoopId);
    invaderState.gameLoopId = null;
  }
  
  invaderState.gameOver = false;
  invaderState.score = 0;
  invaderState.level = 1;
  invaderState.enemyBullets = [];
  invaderState.bullet.active = false;
  invaderState.bullet.alive = false;
  invaderState.player.x = 140;
  invaderState.player.lives = 3;
  invaderState.player.alive = true;
  invaderState.enemyDirection = 1;
  invaderState.enemyMoveTimer = 0;
  invaderState.enemyMoveInterval = 30;
  invaderState.mysteryShip.active = false;
  invaderState.mysteryShip.alive = false;
  
  if (invadersScoreEl) invadersScoreEl.textContent = "Score: 0";
  if (invadersMessageEl) invadersMessageEl.textContent = "Good luck!";
  if (startInvadersBtn) startInvadersBtn.textContent = 'Restart';
  
  createEnemies();
  createBunkers();
  invaderState.gameLoopId = requestAnimationFrame(invadersGameLoop);
}

function stopInvaders(message = "GAME OVER") {
  invaderState.gameOver = true;
  if (invaderState.gameLoopId) {
    cancelAnimationFrame(invaderState.gameLoopId);
    invaderState.gameLoopId = null;
  }
  if (invadersMessageEl) invadersMessageEl.textContent = message;
  if (startInvadersBtn) startInvadersBtn.textContent = 'Start';
}

function handleInvadersKey(event) {
  if (!invadersModal || invadersModal.style.display !== 'flex') return;

  const state = invaderState;
  
  if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (state.gameOver) {
          startInvaders();
          return;
      }
      
      if (!state.bullet.active && state.player.alive) {
        state.bullet.x = state.player.x + (state.player.width / 2) - (state.bullet.width / 2);
        state.bullet.y = state.player.y;
        state.bullet.active = true;
        state.bullet.alive = true;
      }
  }

  if (state.gameOver || !state.player.alive) return;

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    state.player.x = Math.max(0, state.player.x - 10);
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    state.player.x = Math.min(invadersCanvas.width - state.player.width, state.player.x + 10);
  }
}

function initInvadersGame() {
    if (startInvadersBtn) {
      startInvadersBtn.addEventListener('click', startInvaders);
    }
    
    if (!document.__invadersBound) {
      document.addEventListener('keydown', handleInvadersKey);
      document.__invadersBound = true;
    }
    
    if (invadersCtx) {
        invadersCtx.fillStyle = '#000';
        invadersCtx.fillRect(0, 0, invadersCanvas.width, invadersCanvas.height);
    }
}


// ---------------------- INITIALIZATION ----------------------

document.addEventListener('DOMContentLoaded', function() {
    // TETRIS bindings
    if (runSimpleTetrisBtn) runSimpleTetrisBtn.addEventListener('click', function(e){ e.preventDefault(); openModal(); });
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (startBtn) startBtn.addEventListener('click', start);
    if (controlsBtn) controlsBtn.addEventListener('click', function() {
      alert('Controls:\nRight Arrow: Move Right\nLeft Arrow: Move Left\nSpace Bar: Rotate\nDown Arrow: Speed Up Fall');
    });
    
    if (simpleTetrisModal) {
        simpleTetrisModal.addEventListener('click', function(e) {
            if (e.target === simpleTetrisModal) {
                closeModal();
            }
        });
    }
    
    loadHighScore();

    // INVADERS bindings (no Racer)
    if (runInvadersBtn) {
      runInvadersBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (invadersModal) invadersModal.style.display = 'flex';
        if (invadersMessageEl) invadersMessageEl.textContent = "Press Start!";
      });
    }

    if (invadersModalCloseBtn) {
      invadersModalCloseBtn.addEventListener('click', function() {
        if (invadersModal) invadersModal.style.display = 'none';
        stopInvaders();
      });
    }

    if (invadersModal) {
      invadersModal.addEventListener('click', function(e) {
        if (e.target === invadersModal) {
          if (invadersModal) invadersModal.style.display = 'none';
          stopInvaders();
        }
      });
    }

    // Initialize invaders logic
    initInvadersGame();
});
