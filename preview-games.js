// --- PREVIEW GAMES: NAMESPACED SIMPLE TETRIS + NAMESPACED SPACE INVADERS++ ---
// This file contains the preview (simple) Tetris and the advanced Space Invaders++ ported from experimental.js.
// The advanced version is namespaced to avoid conflicts; the original remains in experimental.js.

// ---------------------- NAMESPACED SIMPLE TETRIS (preview) ----------------------

const runSimpleTetrisBtn = document.getElementById('runSimpleTetrisBtn');
const tetrisModal = document.getElementById('previewSimpleTetrisModal');
const tetrisModalCloseBtn = document.getElementById('preview-modalCloseBtn');
const tetrisCanvas = document.getElementById('preview-game');
const tetrisCtx = tetrisCanvas ? tetrisCanvas.getContext('2d') : null;
const tetrisScoreP = document.getElementById('preview-score');
const tetrisStartBtn = document.getElementById('preview-startBtn');
const tetrisControlsBtn = document.getElementById('preview-controlsBtn');

const T_BOX = 24;
const T_SPEED = 150; // gravity step in ms

let t_fastFall = false;
let t_score = 0;
let t_highScore;
let t_messageTimer = 0;

let t_block;
let t_rows;
let t_tetrisLoopId = null;
let t_lastTime = 0;
let t_accumulator = 0;

// offscreen buffer to avoid visual flashing
let t_offscreenCanvas = null;
let t_offscreenCtx = null;

const T_PALETTE = { fill: '#00FFFF', stroke: '#33FFFF', shadow: '#00FFFF' };
const T_PLAYFIELD_BG = '#23262b'; // DARK GRAY for playfield

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

function t_initOffscreen() {
  if (!tetrisCanvas) return;
  t_offscreenCanvas = document.createElement('canvas');
  t_offscreenCanvas.width = tetrisCanvas.width;
  t_offscreenCanvas.height = tetrisCanvas.height;
  t_offscreenCtx = t_offscreenCanvas.getContext('2d');
  // initialize offscreen background so first blit is solid
  t_offscreenCtx.fillStyle = T_PLAYFIELD_BG;
  t_offscreenCtx.fillRect(0, 0, t_offscreenCanvas.width, t_offscreenCanvas.height);
  if (tetrisCtx) {
    // draw initial stable background once
    tetrisCtx.fillStyle = T_PLAYFIELD_BG;
    tetrisCtx.fillRect(0, 0, tetrisCanvas.width, tetrisCanvas.height);
  }
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
  t_messageTimer = 0;
  t_block = null;
  t_accumulator = 0;
  t_lastTime = performance.now();
  if (!t_offscreenCanvas) t_initOffscreen();
  // stop any existing loop
  if (t_tetrisLoopId) cancelAnimationFrame(t_tetrisLoopId);
  t_tetrisLoopId = requestAnimationFrame(tetrisLoop);
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

// The gravity step - moves the block down once and handles locking and clearing
function t_gravityStep() {
  // spawn if none
  if (!t_block) {
    let newBlockIndex = Math.floor(Math.random() * 7);
    t_block = [T_ALL_BLOCKS[newBlockIndex], 4, 0];
    if (t_isColliding(t_block)) {
      // game over
      t_stopGame();
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

  // move down
  t_block[2] += 1;
  if (t_isColliding(t_block)) {
    t_block[2] -= 1;

    // lock piece into playfield
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

// Draws entire frame to offscreen canvas, then blits to visible canvas.
// Offscreen buffering avoids partial-frame visible clearing and reduces flashing.
function t_drawToOffscreen() {
  if (!t_offscreenCtx || !t_offscreenCanvas) return;

  // Fill background (offscreen) — no shadow blur for background paint
  t_offscreenCtx.save();
  t_offscreenCtx.shadowBlur = 0;
  t_offscreenCtx.fillStyle = T_PLAYFIELD_BG;
  t_offscreenCtx.fillRect(0, 0, t_offscreenCanvas.width, t_offscreenCanvas.height);
  t_offscreenCtx.restore();

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

  // draw blocks
  t_offscreenCtx.save();
  t_offscreenCtx.fillStyle = T_PALETTE.fill;
  t_offscreenCtx.strokeStyle = T_PALETTE.stroke;
  t_offscreenCtx.lineWidth = 1;
  t_offscreenCtx.shadowColor = T_PALETTE.shadow;
  t_offscreenCtx.shadowBlur = 5;

  const t_size = T_BOX - 3;
  const t_offset = 1.5;

  for (let y = 0; y < RaB.length; y++) {
    for (let x = 0; x < RaB[y].length; x++) {
      if (RaB[y][x] === 1) {
        t_offscreenCtx.fillRect(x * T_BOX + t_offset, y * T_BOX + t_offset, t_size, t_size);
        t_offscreenCtx.strokeRect(x * T_BOX + t_offset, y * T_BOX + t_offset, t_size, t_size);
      }
    }
  }

  // TETRIS message
  if (t_messageTimer > 0) {
    t_offscreenCtx.fillStyle = 'yellow';
    t_offscreenCtx.font = 'bold 48px Arial';
    t_offscreenCtx.textAlign = 'center';
    t_offscreenCtx.shadowColor = 'black';
    t_offscreenCtx.shadowBlur = 5;
    t_offscreenCtx.fillText('TETRIS!', t_offscreenCanvas.width / 2, t_offscreenCanvas.height / 2);
    t_messageTimer--;
  }
  t_offscreenCtx.restore();

  // Blit offscreen to onscreen in one operation
  if (tetrisCtx && t_offscreenCanvas) {
    tetrisCtx.drawImage(t_offscreenCanvas, 0, 0);
  }
}

// The animation loop uses requestAnimationFrame and an accumulator so gravity is time-based.
// This removes the use of setInterval and prevents visible clearing artifacts during frames.
function tetrisLoop(ts) {
  if (!tetrisCtx || !t_offscreenCtx) {
    t_tetrisLoopId = null;
    return;
  }
  t_tetrisLoopId = requestAnimationFrame(tetrisLoop);

  let now = ts || performance.now();
  let delta = now - t_lastTime;
  t_lastTime = now;
  t_accumulator += delta;

  // gravity step interval changes when fast-falling
  const gravityInterval = t_fastFall ? Math.max(10, T_SPEED / 2) : T_SPEED;

  // run as many gravity steps as accumulated time allows (keeps physics stable when tab focus changes)
  while (t_accumulator >= gravityInterval) {
    t_accumulator -= gravityInterval;
    t_gravityStep();
  }

  // draw current frame after updating physics
  t_drawToOffscreen();
}

// Stops the tetris game loop and clears state
function t_stopGame() {
  if (t_tetrisLoopId) {
    cancelAnimationFrame(t_tetrisLoopId);
    t_tetrisLoopId = null;
  }
  t_block = null;
  if (tetrisCtx) {
    tetrisCtx.fillStyle = T_PLAYFIELD_BG;
    tetrisCtx.fillRect(0, 0, tetrisCanvas.width, tetrisCanvas.height);
  }
  if (tetrisStartBtn) tetrisStartBtn.textContent = 'Start';
}

// Modal controls for Tetris
function t_openModal() {
  if (tetrisModal) tetrisModal.style.display = 'flex';
  t_loadHighScore();
  if (tetrisStartBtn) tetrisStartBtn.textContent = 'Start';
  if (!t_offscreenCanvas) t_initOffscreen();
}

function t_closeModal() {
  if (tetrisModal) tetrisModal.style.display = 'none';
  t_stopGame();
}

// Tetris keyboard handlers
document.addEventListener('keydown', event => {
  if (!tetrisModal || tetrisModal.style.display !== 'flex') return;

  // prevent page scroll when using arrows/space and when modal is open
  if (['ArrowRight','ArrowLeft','ArrowUp','ArrowDown',' '].includes(event.key) || event.code === 'Space') {
    event.preventDefault();
  }

  // only accept movement if game is running or block present (so controls are responsive)
  if (!t_block && !t_tetrisLoopId) return;

  if (event.key === 'ArrowLeft') t_moveLeft();
  if (event.key === 'ArrowRight') t_moveRight();
  if (event.code === 'Space' || event.key === ' ') t_rotate();
  if (event.key === 'ArrowDown') t_fastFall = true;
});

document.addEventListener('keyup', event => {
  if (event.key === 'ArrowDown') t_fastFall = false;
});

// ---------------------- NAMESPACED SPACE INVADERS++ (PREVIEW) ----------------------

// DOM elements (preview invaders) - namespaced with "preview-"
const runPreviewInvadersBtn = document.getElementById('runPreviewInvadersBtn');
const previewInvadersModal = document.getElementById('preview-invadersModal');
const previewInvadersModalCloseBtn = document.getElementById('preview-invadersModalCloseBtn');
const previewInvadersCanvas = document.getElementById('preview-invaders-canvas');
const previewInvadersCtx = previewInvadersCanvas ? previewInvadersCanvas.getContext('2d') : null;
const previewInvadersMessageEl = document.getElementById('preview-invaders-message');
const previewStartInvadersBtn = document.getElementById('preview-startInvadersBtn');
const previewInvadersScoreEl = document.getElementById('preview-invaders-score');

// The advanced Space Invaders++ logic, namespaced for preview
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
const previewInvaderPalettes = ['#FF00FF','#FFA500','#FFFF00','#00FF00','#00FFFF','#9D00FF','#FD1C03','#FF69B4'];

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
  const bunkerSpacing = (previewInvadersCanvas.width - 60) / 4;
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
  if (('alive' in objA && !objA.alive) || ('alive' in objB && !objB.alive)) return false;
  return objA.x < objB.x + objB.width &&
         objA.x + objA.width > objB.x &&
         objA.y < objB.y + objB.height &&
         objA.y + objA.height > objB.y;
}

function previewUpdateInvaders() {
  if (previewInvaderState.gameOver || !previewInvadersCanvas) return;
  const state = previewInvaderState;

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

  if (!state.mysteryShip.active && Math.random() > 0.998 - (state.level * 0.0005)) {
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
    state.mysteryShip.x += state.mysteryShip.direction * (1.5 + state.level * 0.2);
    if (state.mysteryShip.x > previewInvadersCanvas.width || state.mysteryShip.x < -state.mysteryShip.width) {
      state.mysteryShip.active = false;
      state.mysteryShip.alive = false;
    }
  }

  let aliveEnemies = state.enemies.filter(e => e.alive);
  let shootThreshold = Math.max(0.6, 0.98 - (state.level * 0.02));
  if (Math.random() > shootThreshold && aliveEnemies.length > 0) {
    let shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
    state.enemyBullets.push({
      x: shooter.x + shooter.width / 2 - 2,
      y: shooter.y + shooter.height,
      width: 4,
      height: 10,
      alive: true
    });
  }

  state.enemyBullets = state.enemyBullets.filter(bullet => {
    bullet.y += 3 + state.level * 0.25;
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

  if (state.bunkers.length > 0 && state.bunkers.filter(b => b.alive).length === 0) {
    previewStopInvaders("GAME OVER: Bases destroyed!");
  }

  if (aliveEnemies.length === 0 && !state.gameOver) {
    previewStartNextLevel();
  }
}

function previewDrawInvaders() {
  if (!previewInvadersCtx) return;
  const state = previewInvaderState;
  previewInvadersCtx.fillStyle = '#000';
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
  const enemyColor = previewInvaderPalettes[(state.level - 1) % previewInvaderPalettes.length];
  previewInvadersCtx.fillStyle = enemyColor;
  state.enemies.forEach(enemy => {
    if (enemy.alive) previewInvadersCtx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
  });
  if (state.mysteryShip.active) {
    previewInvadersCtx.fillStyle = '#FFD700';
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
  if (previewInvadersMessageEl) previewInvadersMessageEl.textContent = `Space Invaders — Level ${state.level}`;
  state.enemyBullets = [];
  state.bullet.active = false;
  state.bullet.alive = false;
  state.enemyMoveInterval = Math.max(5, 30 - (state.level - 1) * 2);
  state.enemyMoveTimer = state.enemyMoveInterval;
  state.dropSpeed = 10 + (state.level - 1) * 2;
  previewCreateEnemies();
  previewCreateBunkers();
  if (previewInvadersMessageEl) {
    const palette = previewInvaderPalettes[(state.level - 1) % previewInvaderPalettes.length];
    previewInvadersMessageEl.style.color = palette;
    setTimeout(() => { if (previewInvadersMessageEl) previewInvadersMessageEl.style.color = '#eee'; }, 1200);
  }
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
  previewInvaderState.dropSpeed = 10;
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
  initPreviewInvadersGame();
});
