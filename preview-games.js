// --- PREVIEW GAMES: NAMESPACED SIMPLE TETRIS + NAMESPACED PREVIEW INVADERS ---
// This file contains the preview (simple) Tetris and a preview namespaced Space Invaders.
// The more advanced versions (in experimental.js) may use different element IDs / globals
// so these preview implementations are intentionally namespaced to avoid conflicts.

// ---------------------- NAMESPACED SIMPLE TETRIS (preview) ----------------------

// DOM elements (Tetris preview) - namespaced with "preview-"
const runSimpleTetrisBtn = document.getElementById('runSimpleTetrisBtn');
const tetrisModal = document.getElementById('previewSimpleTetrisModal');
const tetrisModalCloseBtn = document.getElementById('preview-modalCloseBtn');
const tetrisCanvas = document.getElementById('preview-game');
const tetrisCtx = tetrisCanvas ? tetrisCanvas.getContext('2d') : null;
const tetrisScoreP = document.getElementById('preview-score');
const tetrisStartBtn = document.getElementById('preview-startBtn');
const tetrisControlsBtn = document.getElementById('preview-controlsBtn');

// Local variables (namespaced to avoid collisions with experimental/advanced versions)
const T_BOX = 24;
const T_SPEED = 50; // Milliseconds per frame

let t_fastFall = false;
let t_score = 0;
let t_highScore;
let t_messageTimer = 0;

let t_block;
let t_rows;
let t_gameInterval; // holds setInterval id
let t_count;

// Fixed palette
const T_PALETTE = { fill: '#00FFFF', stroke: '#33FFFF', shadow: '#00FFFF' };

// Block types
const T_ALL_BLOCKS = {
  0: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  1: [[1, 1], [1, 1]],
  2: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  3: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  4: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  5: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  6: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
};

function t_loadHighScore() {
  t_highScore = parseInt(localStorage.getItem('tetrisHighScore')) || 0;
  if (tetrisScoreP) tetrisScoreP.textContent = 'Score: ' + t_score + ' | High Score: ' + t_highScore;
}

function t_saveHighScore() {
  localStorage.setItem('tetrisHighScore', t_highScore);
  if (tetrisScoreP) tetrisScoreP.textContent = 'Score: ' + t_score + ' | High Score: ' + t_highScore;
}

function t_start() {
  t_rows = [];
  for (let i = 0; i < 20; i++) {
    let row = [];
    for (let x = 0; x < 10; x++) row.push(0);
    t_rows.push(row);
  }
  t_score = 0;
  t_loadHighScore();
  t_count = 10;
  t_messageTimer = 0;
  if (t_gameInterval) clearInterval(t_gameInterval);
  t_gameInterval = setInterval(t_drawFrame, T_SPEED);
  if (tetrisStartBtn) tetrisStartBtn.textContent = 'Restart';
}

function t_rotate() {
  if (!t_block) return;
  t_block[0] = t_transpose(t_block[0]);
  t_block[0] = t_reverse(t_block[0]);
  if (t_isColliding(t_block)) {
    t_block[0] = t_reverse(t_block[0]);
    t_block[0] = t_transpose(t_block[0]);
  }
}

function t_moveRight() {
  if (!t_block) return;
  t_block[1] += 1;
  if (t_isColliding(t_block)) t_block[1] -= 1;
}

function t_moveLeft() {
  if (!t_block) return;
  t_block[1] -= 1;
  if (t_isColliding(t_block)) t_block[1] += 1;
}

function t_transpose(L) {
  let final = [];
  for (let i = 0; i < L[0].length; i++) final.push([]);
  for (let i = 0; i < L.length; i++) {
    for (let x = 0; x < L[i].length; x++) final[x].push(L[i][x]);
  }
  return final;
}

function t_reverse(L) {
  for (let i = 0; i < L.length; i++) L[i].reverse();
  return L;
}

function t_isColliding(B) {
  for (let y = 0; y < B[0].length; y++) {
    for (let x = 0; x < B[0][y].length; x++) {
      if (B[0][y][x] === 1) {
        if (
          (B[1] + x) < 0 ||
          (B[1] + x) >= 10 ||
          (B[2] + y) >= 20
        ) return true;
        if (t_rows[B[2] + y] && t_rows[B[2] + y][B[1] + x] === 1) return true;
      }
    }
  }
  return false;
}

function t_drawFrame() {
  if (!tetrisCtx) return;

  // spawn
  if (!t_block) {
    let newBlockIndex = Math.floor(Math.random() * 7);
    t_block = [T_ALL_BLOCKS[newBlockIndex], 4, 0];

    if (t_isColliding(t_block)) {
      clearInterval(t_gameInterval);
      t_gameInterval = null;
      if (tetrisStartBtn) tetrisStartBtn.textContent = 'Start';
      if (t_score > t_highScore) {
        alert('Game Over! New high score: ' + t_score);
        t_highScore = t_score;
        t_saveHighScore();
      } else {
        alert('Game Over! Score: ' + t_score);
      }
      return;
    }
    return;
  }

  // clear
  tetrisCtx.fillStyle = '#050505';
  tetrisCtx.fillRect(0, 0, tetrisCanvas.width, tetrisCanvas.height);

  // gravity
  if (t_count === 0 || (t_fastFall && (t_count % 2 === 0))) {
    t_count = 10;
    t_block[2] += 1;

    if (t_isColliding(t_block)) {
      t_block[2] -= 1;

      // lock piece
      for (let y = 0; y < t_block[0].length; y++) {
        for (let x = 0; x < t_block[0][y].length; x++) {
          if (t_block[0][y][x] === 1) {
            if (t_rows[t_block[2] + y]) {
              t_rows[t_block[2] + y][t_block[1] + x] = 1;
            }
          }
        }
      }

      t_block = null;

      // clear lines
      let linesCleared = 0;
      for (let i = 0; i < 20; i++) {
        if (t_rows[i] && !t_rows[i].some(b => b === 0)) {
          t_rows.splice(i, 1);
          let row = [];
          for (let x = 0; x < 10; x++) row.push(0);
          t_rows.unshift(row);
          linesCleared++;
          i--;
        }
      }

      if (linesCleared === 1) t_score += 10;
      else if (linesCleared === 2) t_score += 20;
      else if (linesCleared === 3) t_score += 30;
      else if (linesCleared === 4) { t_score += 50; t_messageTimer = 40; }

      if (linesCleared > 0) {
        if (tetrisScoreP) tetrisScoreP.textContent = 'Score: ' + t_score + ' | High Score: ' + t_highScore;
      }
    }
  }

  // prepare grid + draw
  let RaB = t_rows.map(row => [...row]);
  if (t_block) {
    for (let y = 0; y < t_block[0].length; y++) {
      for (let x = 0; x < t_block[0][y].length; x++) {
        if (t_block[0][y][x] === 1) {
          if (RaB[t_block[2] + y]) {
            RaB[t_block[2] + y][t_block[1] + x] = 1;
          }
        }
      }
    }
  }

  tetrisCtx.fillStyle = T_PALETTE.fill;
  tetrisCtx.strokeStyle = T_PALETTE.stroke;
  tetrisCtx.lineWidth = 1;
  tetrisCtx.shadowColor = T_PALETTE.shadow;
  tetrisCtx.shadowBlur = 5;

  const t_size = T_BOX - 3;
  const t_offset = 1.5;

  for (let y = 0; y < RaB.length; y++) {
    for (let x = 0; x < RaB[y].length; x++) {
      if (RaB[y][x] === 1) {
        tetrisCtx.fillRect(x * T_BOX + t_offset, y * T_BOX + t_offset, t_size, t_size);
        tetrisCtx.strokeRect(x * T_BOX + t_offset, y * T_BOX + t_offset, t_size, t_size);
      }
    }
  }

  // TETRIS message
  if (t_messageTimer > 0) {
    tetrisCtx.fillStyle = 'yellow';
    tetrisCtx.font = 'bold 48px Arial';
    tetrisCtx.textAlign = 'center';
    tetrisCtx.shadowColor = 'black';
    tetrisCtx.shadowBlur = 5;
    tetrisCtx.fillText('TETRIS!', tetrisCanvas.width / 2, tetrisCanvas.height / 2);
    tetrisCtx.shadowBlur = 0;
    t_messageTimer--;
  }

  tetrisCtx.shadowBlur = 0;
  t_count -= 1;
}

// Modal controls for Tetris
function t_openModal() {
  if (tetrisModal) tetrisModal.style.display = 'flex';
  t_loadHighScore();
  if (tetrisStartBtn) tetrisStartBtn.textContent = 'Start';
}

function t_closeModal() {
  if (tetrisModal) tetrisModal.style.display = 'none';
  if (t_gameInterval) { clearInterval(t_gameInterval); t_gameInterval = null; }
  t_block = null;
  if (tetrisCtx) {
    tetrisCtx.fillStyle = '#050505';
    tetrisCtx.fillRect(0, 0, tetrisCanvas.width, tetrisCanvas.height);
  }
}

// Tetris keyboard handlers (only active when preview tetris modal is open)
document.addEventListener('keydown', event => {
  if (!tetrisModal || tetrisModal.style.display !== 'flex' || !t_gameInterval) return;
  if (['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(event.key) || event.code === 'Space') {
    event.preventDefault();
  }
  if (event.key === 'ArrowLeft') t_moveLeft();
  if (event.key === 'ArrowRight') t_moveRight();
  if (event.code === 'Space') t_rotate();
  if (event.key === 'ArrowDown') t_fastFall = true;
});

document.addEventListener('keyup', event => {
  if (event.key === 'ArrowDown') t_fastFall = false;
});

// ---------------------- NAMESPACED PREVIEW SPACE INVADERS ----------------------

// DOM elements (preview invaders) - namespaced with "preview-"
const runPreviewInvadersBtn = document.getElementById('runPreviewInvadersBtn');
const previewInvadersModal = document.getElementById('preview-invadersModal');
const previewInvadersModalCloseBtn = document.getElementById('preview-invadersModalCloseBtn');
const previewInvadersCanvas = document.getElementById('preview-invaders-canvas');
const previewInvadersCtx = previewInvadersCanvas ? previewInvadersCanvas.getContext('2d') : null;
const previewInvadersMessageEl = document.getElementById('preview-invaders-message');
const previewStartInvadersBtn = document.getElementById('preview-startInvadersBtn');
const previewInvadersScoreEl = document.getElementById('preview-invaders-score');

// State (namespaced)
let previewInvaderState = {
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
  enemyMoveInterval: 30
};

function previewCreateEnemies() {
  const state = previewInvaderState;
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

function previewCreateBunkers() {
  previewInvaderState.bunkers = [];
  const bunkerWidth = 4;
  const bunkerHeight = 3;
  const blockSize = 8;
  const startX = 30;
  const bunkerSpacing = (previewInvadersCanvas ? previewInvadersCanvas.width : 420 - 60) / 4;

  for (let b = 0; b < 4; b++) {
    let bunkerX = startX + (b * bunkerSpacing) + (bunkerSpacing / 2) - ((bunkerWidth * blockSize) / 2);
    for (let r = 0; r < bunkerHeight; r++) {
      for (let c = 0; c < bunkerWidth; c++) {
        if (r === bunkerHeight - 1 && (c === 1 || c === 2)) continue;
        previewInvaderState.bunkers.push({
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

function previewCheckCollision(objA, objB) {
  if (!objA.alive || !objB.alive) return false;
  return objA.x < objB.x + objB.width &&
         objA.x + objA.width > objB.x &&
         objA.y < objB.y + objB.height &&
         objA.y + objA.height > objB.y;
}

function previewUpdateInvaders() {
  if (previewInvaderState.gameOver || !previewInvadersCanvas) return;
  const state = previewInvaderState;

  // Player bullet
  if (state.bullet.active) {
    state.bullet.y -= 15;
    if (state.bullet.y < 0) {
      state.bullet.active = false;
      state.bullet.alive = false;
    }

    for (let b = state.bunkers.length - 1; b >= 0; b--) {
      let bunkerBlock = state.bunkers[b];
      if (bunkerBlock.alive && previewCheckCollision(state.bullet, bunkerBlock)) {
        bunkerBlock.alive = false;
        state.bullet.active = false;
        state.bullet.alive = false;
        break;
      }
    }

    if (state.bullet.active) {
      for (let i = state.enemies.length - 1; i >= 0; i--) {
        let enemy = state.enemies[i];
        if (enemy.alive && previewCheckCollision(state.bullet, enemy)) {
          enemy.alive = false;
          state.bullet.active = false;
          state.bullet.alive = false;
          state.score += 10;
          if (previewInvadersScoreEl) previewInvadersScoreEl.textContent = `Score: ${state.score}`;
          break;
        }
      }
    }

    if (state.bullet.active && state.mysteryShip.active) {
      if (previewCheckCollision(state.bullet, state.mysteryShip)) {
        state.mysteryShip.active = false;
        state.mysteryShip.alive = false;
        state.bullet.active = false;
        state.bullet.alive = false;
        let bonus = (Math.floor(Math.random() * 3) + 1) * 50;
        state.score += bonus;
        if (previewInvadersMessageEl) previewInvadersMessageEl.textContent = `+${bonus} POINTS!`;
        if (previewInvadersScoreEl) previewInvadersScoreEl.textContent = `Score: ${state.score}`;
      }
    }
  }

  // Enemy movement timer
  state.enemyMoveTimer--;
  if (state.enemyMoveTimer <= 0) {
    let moveDown = false;
    let moveStep = 5;

    let aliveEnemies = state.enemies.filter(e => e.alive);

    for (const enemy of aliveEnemies) {
      if ((state.enemyDirection > 0 && enemy.x + enemy.width >= previewInvadersCanvas.width - 5) ||
          (state.enemyDirection < 0 && enemy.x <= 5)) {
        moveDown = true;
        state.enemyDirection *= -1;
        moveStep = 0;
        break;
      }
    }

    aliveEnemies.forEach(enemy => {
      if (moveDown) enemy.y += state.dropSpeed;
      else enemy.x += state.enemyDirection * moveStep;

      if (enemy.y + enemy.height > state.player.y) {
        previewStopInvaders("GAME OVER: They reached you!");
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
      state.mysteryShip.x = previewInvadersCanvas.width;
      state.mysteryShip.direction = -1;
    }
  }

  if (state.mysteryShip.active) {
    state.mysteryShip.x += state.mysteryShip.direction * 1.5;
    if (state.mysteryShip.x > previewInvadersCanvas.width || state.mysteryShip.x < -state.mysteryShip.width) {
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
      if (bunkerBlock.alive && previewCheckCollision(bullet, bunkerBlock)) {
        bunkerBlock.alive = false;
        return false;
      }
    }

    if (previewCheckCollision(bullet, state.player)) {
      state.player.lives--;
      if (previewInvadersScoreEl) previewInvadersScoreEl.textContent = `Score: ${state.score}`;
      if (state.player.lives <= 0) {
        state.player.alive = false;
        previewStopInvaders("GAME OVER: You were hit!");
      } else {
        if (previewInvadersMessageEl) previewInvadersMessageEl.textContent = `HIT! ${state.player.lives} ships remain.`;
      }
      return false;
    }

    return bullet.y < previewInvadersCanvas.height;
  });

  // Bases destroyed lose condition
  if (state.bunkers.length > 0 && state.bunkers.filter(b => b.alive).length === 0) {
    previewStopInvaders("GAME OVER: Bases destroyed!");
  }

  // Level win
  if (aliveEnemies.length === 0 && !state.gameOver) {
    previewStartNextLevel();
  }
}

function previewDrawInvaders() {
  if (!previewInvadersCtx) return;
  const state = previewInvaderState;

  previewInvadersCtx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  previewInvadersCtx.fillRect(0, 0, previewInvadersCanvas.width, previewInvadersCanvas.height);

  if (state.player.alive) {
    previewInvadersCtx.fillStyle = '#00FFFF';
    previewInvadersCtx.fillRect(state.player.x, state.player.y, state.player.width, state.player.height);
  }

  if (state.bullet.active) {
    previewInvadersCtx.fillStyle = '#00FFFF';
    previewInvadersCtx.fillRect(state.bullet.x, state.bullet.y, state.bullet.width, state.bullet.height);
  }

  previewInvadersCtx.fillStyle = '#00FF00';
  state.bunkers.forEach(block => {
    if (block.alive) previewInvadersCtx.fillRect(block.x, block.y, block.width, block.height);
  });

  previewInvadersCtx.fillStyle = '#FF00FF';
  state.enemies.forEach(enemy => {
    if (enemy.alive) previewInvadersCtx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
  });

  if (state.mysteryShip.active) {
    previewInvadersCtx.fillStyle = '#FF0000';
    previewInvadersCtx.fillRect(state.mysteryShip.x, state.mysteryShip.y, state.mysteryShip.width, state.mysteryShip.height);
  }

  previewInvadersCtx.fillStyle = '#FF0000';
  state.enemyBullets.forEach(bullet => {
    previewInvadersCtx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
  });

  previewInvadersCtx.fillStyle = '#00FFFF';
  for (let i = 0; i < state.player.lives; i++) {
    previewInvadersCtx.fillRect(10 + i * (state.player.width + 10), 380, state.player.width, state.player.height);
  }

  previewInvadersCtx.font = '14px "Courier New", monospace';
  previewInvadersCtx.fillStyle = '#888';
  previewInvadersCtx.fillText(`Level: ${state.level}`, previewInvadersCanvas.width - 70, 390);
}

function previewInvadersGameLoop() {
  if (previewInvaderState.gameOver) return;
  previewUpdateInvaders();
  previewDrawInvaders();
  previewInvaderState.gameLoopId = requestAnimationFrame(previewInvadersGameLoop);
}

function previewStartNextLevel() {
  const state = previewInvaderState;
  state.level++;
  if (previewInvadersMessageEl) previewInvadersMessageEl.textContent = `Level ${state.level}!`;

  state.enemyBullets = [];
  state.bullet.active = false;
  state.bullet.alive = false;

  state.enemyMoveInterval = Math.max(5, 30 - (state.level - 1) * 2);
  state.enemyMoveTimer = state.enemyMoveInterval;

  previewCreateEnemies();
  previewCreateBunkers();
}

function previewStartInvaders() {
  if (previewInvaderState.gameLoopId) {
    cancelAnimationFrame(previewInvaderState.gameLoopId);
    previewInvaderState.gameLoopId = null;
  }

  previewInvaderState.gameOver = false;
  previewInvaderState.score = 0;
  previewInvaderState.level = 1;
  previewInvaderState.enemyBullets = [];
  previewInvaderState.bullet.active = false;
  previewInvaderState.bullet.alive = false;
  previewInvaderState.player.x = 140;
  previewInvaderState.player.lives = 3;
  previewInvaderState.player.alive = true;
  previewInvaderState.enemyDirection = 1;
  previewInvaderState.enemyMoveTimer = 0;
  previewInvaderState.enemyMoveInterval = 30;
  previewInvaderState.mysteryShip.active = false;
  previewInvaderState.mysteryShip.alive = false;

  if (previewInvadersScoreEl) previewInvadersScoreEl.textContent = "Score: 0";
  if (previewInvadersMessageEl) previewInvadersMessageEl.textContent = "Good luck!";
  if (previewStartInvadersBtn) previewStartInvadersBtn.textContent = 'Restart';

  previewCreateEnemies();
  previewCreateBunkers();
  previewInvaderState.gameLoopId = requestAnimationFrame(previewInvadersGameLoop);
}

function previewStopInvaders(message = "GAME OVER") {
  previewInvaderState.gameOver = true;
  if (previewInvaderState.gameLoopId) {
    cancelAnimationFrame(previewInvaderState.gameLoopId);
    previewInvaderState.gameLoopId = null;
  }
  if (previewInvadersMessageEl) previewInvadersMessageEl.textContent = message;
  if (previewStartInvadersBtn) previewStartInvadersBtn.textContent = 'Start';
}

function previewHandleInvadersKey(event) {
  if (!previewInvadersModal || previewInvadersModal.style.display !== 'flex') return;

  const state = previewInvaderState;

  if (event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault();
    if (state.gameOver) {
      previewStartInvaders();
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
    state.player.x = Math.min(previewInvadersCanvas.width - state.player.width, state.player.x + 10);
  }
}

function initPreviewInvadersGame() {
  if (previewStartInvadersBtn) previewStartInvadersBtn.addEventListener('click', previewStartInvaders);

  if (!document.__previewInvadersBound) {
    document.addEventListener('keydown', previewHandleInvadersKey);
    document.__previewInvadersBound = true;
  }

  if (previewInvadersCtx) {
    previewInvadersCtx.fillStyle = '#000';
    previewInvadersCtx.fillRect(0, 0, previewInvadersCanvas.width, previewInvadersCanvas.height);
  }
}

// ---------------------- INITIALIZATION ----------------------

document.addEventListener('DOMContentLoaded', function() {
  // Tetris bindings
  if (runSimpleTetrisBtn) runSimpleTetrisBtn.addEventListener('click', function(e){ e.preventDefault(); t_openModal(); });
  if (tetrisModalCloseBtn) tetrisModalCloseBtn.addEventListener('click', t_closeModal);
  if (tetrisStartBtn) tetrisStartBtn.addEventListener('click', t_start);
  if (tetrisControlsBtn) tetrisControlsBtn.addEventListener('click', function() {
    alert('Controls:\nRight Arrow: Move Right\nLeft Arrow: Move Left\nSpace Bar: Rotate\nDown Arrow: Speed Up Fall');
  });

  if (tetrisModal) {
    tetrisModal.addEventListener('click', function(e) {
      if (e.target === tetrisModal) t_closeModal();
    });
  }

  t_loadHighScore();

  // Preview Invaders bindings
  if (runPreviewInvadersBtn) {
    runPreviewInvadersBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (previewInvadersModal) previewInvadersModal.style.display = 'flex';
      if (previewInvadersMessageEl) previewInvadersMessageEl.textContent = "Press Start!";
    });
  }

  if (previewInvadersModalCloseBtn) {
    previewInvadersModalCloseBtn.addEventListener('click', function() {
      if (previewInvadersModal) previewInvadersModal.style.display = 'none';
      previewStopInvaders();
    });
  }

  if (previewInvadersModal) {
    previewInvadersModal.addEventListener('click', function(e) {
      if (e.target === previewInvadersModal) {
        if (previewInvadersModal) previewInvadersModal.style.display = 'none';
        previewStopInvaders();
      }
    });
  }

  // Initialize preview invaders logic
  initPreviewInvadersGame();
});
