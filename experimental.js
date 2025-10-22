// --- TETRIS GAME SCRIPT ---

// Get modal elements
const tetrisModal = document.getElementById('tetrisModal');
const runTetrisBtn = document.getElementById('runTetrisBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');

// Get game elements (INSIDE the modal)
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreP = document.getElementById('score');
const startBtn = document.getElementById('startBtn');
const controlsBtn = document.getElementById('controlsBtn');

// --- NEON RACER SCRIPT (ELEMENTS) ---
// Get modal elements (Racer)
const racerModal = document.getElementById('racerModal');
const runRacerBtn = document.getElementById('runRacerBtn');
const racerModalCloseBtn = document.getElementById('racerModalCloseBtn');

// Get Racer game elements (INSIDE the modal)
const racerCanvas = document.getElementById('racer-canvas');
const racerCtx = racerCanvas ? racerCanvas.getContext('2d') : null;
const racerDistanceEl = document.getElementById('racer-distance');
const racerSpeedEl = document.getElementById('racer-speed');
const racerObstaclesEl = document.getElementById('racer-obstacles');
const racerMessageEl = document.getElementById('racer-message');
const startRacerBtn = document.getElementById('startRacerBtn');
const pauseRacerBtn = document.getElementById('pauseRacerBtn');
const resetRacerBtn = document.getElementById('resetRacerBtn');


// --- MODAL HANDLING (TETRIS) ---

// Modal Open/Close Logic
if (runTetrisBtn) {
    runTetrisBtn.addEventListener('click', function(e) {
      e.preventDefault();
      tetrisModal.style.display = 'flex';
      // Reset score text when opening
      if (typeof loadHighScore === 'function') {
        loadHighScore();
      }
      if(startBtn) startBtn.textContent = 'Start';
    });
}

function closeModal() {
  tetrisModal.style.display = 'none';
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

if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);

// Also close if user clicks outside the modal content
if (tetrisModal) {
    tetrisModal.addEventListener('click', function(e) {
      if (e.target === tetrisModal) {
        closeModal();
      }
    });
}

// --- MODAL HANDLING (RACER) ---

if (runRacerBtn) {
    runRacerBtn.addEventListener('click', function(e) {
      e.preventDefault();
      racerModal.style.display = 'flex';
      // Call reset to ensure the game is ready (defined below)
      if (typeof resetRacer === 'function') {
        resetRacer();
      }
    });
}

function closeRacerModal() {
  racerModal.style.display = 'none';
  // Stop the game when closing
  if (typeof pauseRacer === 'function') {
    pauseRacer();
  }
}

if (racerModalCloseBtn) racerModalCloseBtn.addEventListener('click', closeRacerModal);

// Also close if user clicks outside the modal content
if (racerModal) {
    racerModal.addEventListener('click', function(e) {
      if (e.target === racerModal) {
        closeRacerModal();
      }
    });
}


// --- TETRIS GAME LOGIC ---

const box = 24;
const speed = 50; // Milliseconds per frame

let fastFall = false;
let score = 0;
let highScore;

// High score (localStorage version)
function loadHighScore() {
  highScore = parseInt(localStorage.getItem('tetrisHighScore')) || 0;
  if(scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
}

function saveHighScore() {
  localStorage.setItem('tetrisHighScore', highScore);
  if(scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
}

// In-game variables
let block;
let rows;
let game; // This will hold the setInterval ID
let count;
let currentLevel = 0; // --- NEW --- Tracks game level based on score

// --- NEW --- Color palettes for different levels
const colorPalettes = [
  { fill: '#00FFFF', stroke: '#33FFFF', shadow: '#00FFFF' }, // Level 0 (Cyan)
  { fill: '#FF00FF', stroke: '#FF33FF', shadow: '#FF00FF' }, // Level 1 (Magenta)
  { fill: '#00FF00', stroke: '#33FF33', shadow: '#00FF00' }, // Level 2 (Lime)
  { fill: '#FFA500', stroke: '#FFB733', shadow: '#FFA500' }, // Level 3 (Orange)
  { fill: '#FFFF00', stroke: '#FFFF33', shadow: '#FFFF00' }  // Level 4 (Yellow)
];

// Block types
const all_blocks = {
  0: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
  1: [[1, 1], [1, 1]],
  2: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
  3: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
  4: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
  5: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
  6: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  7: [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
  8: [[1, 0, 1], [1, 1, 1], [0, 0, 0]],
  9: [[1, 0, 0], [1, 1, 1], [0, 0, 1]]
};

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
  currentLevel = 0; 
  loadHighScore(); 
  count = 10;
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
  if (!ctx) return; // Don't run if canvas isn't found
  
  if (!block) {
    let blockPoolSize = 7 + currentLevel; 
    if (blockPoolSize > 9) blockPoolSize = 9;
    let newBlockIndex = Math.floor(Math.random() * blockPoolSize);
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
  
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  if (count === 0 || (fastFall && (count % 2 === 0))) {
    count = 10;
    block[2] += 1; 
    
    if (isColliding(block)) {
      block[2] -= 1; 
      
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
      
      for (let i = 0; i < 20; i++) {
        if (rows[i] && !rows[i].some(b => b === 0)) {
          rows.splice(i, 1); 
          
          let row = []
          for (let x = 0; x < 10; x++) row.push(0);
          rows.unshift(row);
          
          score += 10;
          
          let newLevel = Math.floor(score / 100); // 100 points per level
          if (newLevel > currentLevel) {
              currentLevel = newLevel;
              console.log("Level up! Now on level " + currentLevel);
          }
          
          if(scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
          i--;
        }
      }
    }
  }

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

  let palette = colorPalettes[currentLevel % colorPalettes.length];
  ctx.fillStyle = palette.fill;
  ctx.strokeStyle = palette.stroke;
  ctx.lineWidth = 1;
  ctx.shadowColor = palette.shadow;
  ctx.shadowBlur = 5;

  for (let y = 0; y < RaB.length; y++) {
    for (let x = 0; x < RaB[y].length; x++) {
      if (RaB[y][x] === 1) {
        ctx.fillRect(x * box, y * box, box - 1, box - 1);
        ctx.strokeRect(x * box, y * box, box - 1, box - 1);
      }
    }
  }
  
  ctx.shadowBlur = 0;
  count -= 1;
}

// Checks keys (only when modal is open)
document.addEventListener('keydown', event => {
  if (tetrisModal.style.display !== 'flex' || !game) return;

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

// --- INIT TETRIS ---
function initTetrisGame() {
    if (startBtn) startBtn.addEventListener('click', start);
    if (controlsBtn) controlsBtn.addEventListener('click', function() {
      alert('Controls:\nRight Arrow: Right\nLeft Arrow: Left\nSpace Bar: Rotate\nDown Arrow: Speed Up Fall');
    });
    // Load high score on script start
    loadHighScore();
}

// Call init function (will be run by DOMContentLoaded listener in HTML)
initTetrisGame();



// --- NEON RACER SCRIPT (LOGIC) ---

// Constants and State
const laneCount = 3;
const laneWidth = racerCanvas ? racerCanvas.width / laneCount : 100;

const playerCar = {
  lane: 1,
  width: laneWidth * 0.55,
  height: 58,
  y: racerCanvas ? racerCanvas.height - 90 : 410
};

const state = {
  running: false,
  lastTimestamp: 0,
  speed: 180,
  distance: 0,
  dodged: 0,
  obstacles: [],
  speedLines: [],
  spawnTimer: 0,
  animationFrame: null,
  gapWidthMultiplier: 1.7 
};

const obstacleHeight = 60;
const laneCenters = Array.from({ length: laneCount }, (_, i) => i * laneWidth + laneWidth / 2);

function drawBackground() {
  if (!racerCtx) return;
  const gradient = racerCtx.createLinearGradient(0, 0, 0, racerCanvas.height);
  gradient.addColorStop(0, '#050417');
  gradient.addColorStop(1, '#0a0e24');
  racerCtx.fillStyle = gradient;
  racerCtx.fillRect(0, 0, racerCanvas.width, racerCanvas.height);

  racerCtx.fillStyle = '#0b1329';
  racerCtx.fillRect(0, 0, racerCanvas.width, racerCanvas.height);

  racerCtx.fillStyle = '#02040c';
  racerCtx.fillRect(0, 0, 40, racerCanvas.height);
  racerCtx.fillRect(racerCanvas.width - 40, 0, 40, racerCanvas.height);

  racerCtx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
  racerCtx.lineWidth = 4;
  racerCtx.strokeRect(6, 6, racerCanvas.width - 12, racerCanvas.height - 12);

  racerCtx.setLineDash([16, 24]);
  racerCtx.lineWidth = 3;
  racerCtx.strokeStyle = 'rgba(255,255,255,0.15)';
  racerCtx.beginPath();
  racerCtx.moveTo(laneWidth, 0);
  racerCtx.lineTo(laneWidth, racerCanvas.height);
  racerCtx.moveTo(laneWidth * 2, 0);
  racerCtx.lineTo(laneWidth * 2, racerCanvas.height);
  racerCtx.stroke();
  racerCtx.setLineDash([]);
}

function drawSpeedLines() {
  if (!racerCtx) return;
  racerCtx.strokeStyle = 'rgba(0, 255, 255, 0.35)';
  racerCtx.lineWidth = 2;
  state.speedLines.forEach(line => {
    racerCtx.beginPath();
    racerCtx.moveTo(line.x, line.y);
    racerCtx.lineTo(line.x, line.y + line.length);
    racerCtx.stroke();
  });
}

function drawPlayer() {
  if (!racerCtx) return;
  const centerX = laneCenters[playerCar.lane];
  const left = centerX - playerCar.width / 2;
  racerCtx.save();
  racerCtx.shadowColor = '#2cf5ff';
  racerCtx.shadowBlur = 18;
  racerCtx.fillStyle = '#19d7ff';
  racerCtx.fillRect(left, playerCar.y, playerCar.width, playerCar.height);
  racerCtx.shadowBlur = 0;
  racerCtx.fillStyle = '#0b1f3a';
  racerCtx.fillRect(left + 6, playerCar.y + 10, playerCar.width - 12, playerCar.height - 20);
  racerCtx.fillStyle = '#19d7ff';
  racerCtx.fillRect(left + playerCar.width / 2 - 6, playerCar.y + 6, 12, playerCar.height - 12);
  racerCtx.restore();
}

function drawObstacles() {
  if (!racerCtx) return;
  state.obstacles.forEach(ob => {
    const top = ob.y;
    const bottom = ob.y + obstacleHeight;
    const gapLeft = ob.gapCenter - ob.gapWidth / 2;
    const gapRight = ob.gapCenter + ob.gapWidth / 2;

    racerCtx.save();
    racerCtx.shadowColor = ob.color;
    racerCtx.shadowBlur = 14;
    racerCtx.fillStyle = ob.color;
    if (gapLeft > 0) {
      racerCtx.fillRect(0, top, gapLeft, obstacleHeight);
    }
    if (gapRight < racerCanvas.width) {
      racerCtx.fillRect(gapRight, top, racerCanvas.width - gapRight, obstacleHeight);
    }
    racerCtx.restore();

    racerCtx.fillStyle = 'rgba(255,255,255,0.08)';
    racerCtx.fillRect(gapLeft, top, ob.gapWidth, 4);
  });
}

function spawnObstacle() {
  const gapLane = Math.floor(Math.random() * laneCount);
  const colorHue = Math.floor(Math.random() * 360);
  const gapCenter = laneCenters[gapLane];
  const gapWidth = playerCar.width * state.gapWidthMultiplier;
  state.obstacles.push({
    y: -obstacleHeight,
    gapCenter,
    gapWidth,
    color: `hsl(${colorHue}, 90%, 60%)`
  });
  state.spawnTimer = 180 + Math.random() * 140;
}

function resetObstacles() {
  state.obstacles = [];
  state.spawnTimer = 0;
}

function ensureSpeedLines() {
  if (!racerCanvas) return;
  while (state.speedLines.length < 12) {
    state.speedLines.push({
      x: 60 + Math.random() * (racerCanvas.width - 120),
      y: Math.random() * racerCanvas.height,
      length: 18 + Math.random() * 26
    });
  }
}

function updateRacer(delta) {
  if (!racerCanvas) return;
  const pixelsPerMs = (state.speed / 1000) * 1.25;
  const traveled = pixelsPerMs * delta;
  state.distance += traveled;
  state.spawnTimer -= traveled;

  if (state.spawnTimer <= 0) {
    spawnObstacle();
  }

  state.obstacles.forEach(ob => {
    ob.y += traveled;
  });

  state.obstacles = state.obstacles.filter(ob => {
    if (ob.y > racerCanvas.height) {
      state.dodged += 1;
      if (state.dodged > 0 && state.dodged % 10 === 0) {
        state.speed = Math.min(340, state.speed + 15);
        state.gapWidthMultiplier = Math.max(1.15, state.gapWidthMultiplier - 0.05);
      }
      return false;
    }
    return true;
  });

  state.speedLines.forEach(line => {
    line.y += traveled * 1.4;
  });
  state.speedLines = state.speedLines.filter(line => line.y < racerCanvas.height + 40);
  ensureSpeedLines();

  const carCenter = laneCenters[playerCar.lane];
  const carLeft = carCenter - playerCar.width / 2;
  const carRight = carCenter + playerCar.width / 2;
  const carTop = playerCar.y;
  const carBottom = playerCar.y + playerCar.height;

  for (const ob of state.obstacles) {
    const obTop = ob.y;
    const obBottom = ob.y + obstacleHeight;
    if (carBottom <= obTop || carTop >= obBottom) continue;
    const gapLeft = ob.gapCenter - ob.gapWidth / 2;
    const gapRight = ob.gapCenter + ob.gapWidth / 2;
    if (carLeft < gapLeft || carRight > gapRight) {
      state.running = false;
      if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
      if (racerMessageEl) {
        racerMessageEl.textContent = 'Crash! Reset to roll out again.';
      }
      return;
    }
  }
}

function renderRacer() {
  drawBackground();
  drawSpeedLines();
  drawObstacles();
  drawPlayer();
}

function gameLoop(timestamp) {
  if (!state.running) return;
  const delta = timestamp - state.lastTimestamp;
  state.lastTimestamp = timestamp;
  updateRacer(delta);
  renderRacer();
  updateHud();
  if (state.running) {
    state.animationFrame = requestAnimationFrame(gameLoop);
  }
}

function startRacer() {
  if (state.running) return;
  if (racerMessageEl) {
    racerMessageEl.textContent = 'Neon boost engaged!';
  }
  state.running = true;
  state.lastTimestamp = performance.now();
  state.animationFrame = requestAnimationFrame(gameLoop);
}

function pauseRacer() {
  if (!state.running) return;
  state.running = false;
  if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
  if (racerMessageEl) {
    racerMessageEl.textContent = 'Paused. Hit start to keep racing.';
  }
}

function resetRacer() {
  pauseRacer();
  playerCar.lane = 1;
  state.speed = 180;
  state.distance = 0;
  state.dodged = 0;
  state.speedLines = [];
  state.gapWidthMultiplier = 1.7; 
  resetObstacles();
  ensureSpeedLines();
  renderRacer();
  updateHud();
  if (racerMessageEl) {
    racerMessageEl.textContent = 'Ready! Use ← and → to slide through the gaps.';
  }
}

function shiftLane(offset) {
  const nextLane = Math.min(laneCount - 1, Math.max(0, playerCar.lane + offset));
  if (nextLane === playerCar.lane) return;

  if (state.running) {
    const carCenter = laneCenters[nextLane]; 
    const carLeft = carCenter - playerCar.width / 2;
    const carRight = carCenter + playerCar.width / 2;
    const carTop = playerCar.y;
    const carBottom = playerCar.y + playerCar.height;

    for (const ob of state.obstacles) {
      const obTop = ob.y;
      const obBottom = ob.y + obstacleHeight;
      if (carBottom <= obTop || carTop >= obBottom) continue;
      const gapLeft = ob.gapCenter - ob.gapWidth / 2;
      const gapRight = ob.gapCenter + ob.gapWidth / 2;
      if (carLeft < gapLeft || carRight > gapRight) {
        return;
      }
    }
  }

  playerCar.lane = nextLane;
  renderRacer();
  updateHud();
}

function handleKey(event) {
  // IMPORTANT: Check if the RACER modal is open
  if (racerModal.style.display !== 'flex') return;
  
  if (event.key === 'ArrowLeft') {
    shiftLane(-1);
    event.preventDefault();
  }
  if (event.key === 'ArrowRight') {
    shiftLane(1);
    event.preventDefault();
  }
}

function updateHud() {
  if (racerDistanceEl) racerDistanceEl.textContent = `Distance: ${Math.floor(state.distance)}m`;
  if (racerSpeedEl) racerSpeedEl.textContent = `Speed: ${Math.floor(state.speed)} mph`;
  if (racerObstaclesEl) racerObstaclesEl.textContent = `Gaps cleared: ${state.dodged}`;
}

// --- INIT RACER ---
function initRacerGame() {
    // Bind controls
    if (startRacerBtn) startRacerBtn.addEventListener('click', startRacer);
    if (pauseRacerBtn) pauseRacerBtn.addEventListener('click', pauseRacer);
    if (resetRacerBtn) resetRacerBtn.addEventListener('click', resetRacer);

    // Bind keyboard
    if (!document.__racerBound) {
      document.addEventListener('keydown', handleKey);
      document.__racerBound = true;
    }

    // Initial setup call
    if (racerCanvas) {
      resetRacer();
    }
}

// Call init function (will be run by DOMContentLoaded listener in HTML)
initRacerGame();
