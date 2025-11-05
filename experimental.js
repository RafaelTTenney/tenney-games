// --- TETRIS GAME SCRIPT ---

// Get modal elements
const tetrisModal = document.getElementById('tetrisModal');
const runTetrisBtn = document.getElementById('runTetrisBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');

// Get game elements (INSIDE the modal)
const canvas = document.getElementById('game');
const ctx = canvas ? canvas.getContext('2d') : null;
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

// --- FULL INVADERS SCRIPT (ELEMENTS) ---
const invadersModal = document.getElementById('invadersModal');
const runInvadersBtn = document.getElementById('runInvadersBtn');
const invadersModalCloseBtn = document.getElementById('invadersModalCloseBtn');
const invadersCanvas = document.getElementById('invaders-canvas');
const invadersCtx = invadersCanvas ? invadersCanvas.getContext('2d') : null;
const invadersMessageEl = document.getElementById('invaders-message');
const startInvadersBtn = document.getElementById('startInvadersBtn');
const invadersScoreEl = document.getElementById('invaders-score');


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

// --- MODAL HANDLING (INVADERS) ---

if (runInvadersBtn) {
    runInvadersBtn.addEventListener('click', function(e) {
      e.preventDefault();
      invadersModal.style.display = 'flex';
      if (invadersMessageEl) invadersMessageEl.textContent = "Press Start!";
      // DO NOT auto-start, let the user press the button
    });
}

function closeInvadersModal() {
  invadersModal.style.display = 'none';
  if (typeof stopInvaders === 'function') {
    stopInvaders();
  }
}

if (invadersModalCloseBtn) invadersModalCloseBtn.addEventListener('click', closeInvadersModal);

if (invadersModal) {
    invadersModal.addEventListener('click', function(e) {
      if (e.target === invadersModal) {
        closeInvadersModal();
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
let currentLevel = 0;

const colorPalettes = [
  { fill: '#00FFFF', stroke: '#33FFFF', shadow: '#00FFFF' }, // Level 0 (Cyan)
  { fill: '#FF00FF', stroke: '#FF33FF', shadow: '#FF00FF' }, // Level 1 (Magenta)
  { fill: '#00FF00', stroke: '#33FF33', shadow: '#00FF00' }, // Level 2 (Lime)
  { fill: '#FFA500', stroke: '#FFB733', shadow: '#FFA500' }, // Level 3 (Orange)
  { fill: '#FFFF00', stroke: '#FFFF33', shadow: '#FFFF00' }, // Level 4 (Yellow)
  { fill: '#9D00FF', stroke: '#8C00E6', shadow: '#9D00FF' }, // Level 5 (Purple)
  { fill: '#FD1C03', stroke: '#E41903', shadow: '#FD1C03' }, // Level 6 (red)
  { fill: '#FF69B4', stroke: '#E6529E', shadow: '#FF69B4' }  // Level 7 (pink)
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
  9: [[1, 0, 0], [1, 1, 1], [0, 0, 1]],
  10: [[0, 0, 1], [1, 1, 1], [1, 0, 0]], 
  11: [[1, 1, 1], [0, 1, 0], [0, 1, 0]] 
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
    if (blockPoolSize > 12) blockPoolSize = 12; // Cap is 12 (0-11)
    
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
          
          let newLevel = Math.floor(score / 50); //potentially 100 points per level
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

// Draw the blocks with a larger separation
  const size = box - 3; // New size (e.g., 21px)
  const offset = 1.5;   // Offset to center the 21px block in the 24px cell

  for (let y = 0; y < RaB.length; y++) {
    for (let x = 0; x < RaB[y].length; x++) {
      if (RaB[y][x] === 1) {
        // Use new size and offset
        ctx.fillRect(x * box + offset, y * box + offset, size, size);
        ctx.strokeRect(x * box + offset, y * box + offset, size, size);
      }
    }
  }
  
  ctx.shadowBlur = 0;
  count -= 1;
}

// Checks keys (only when modal is open)
document.addEventListener('keydown', event => {
  if (tetrisModal && tetrisModal.style.display !== 'flex' || !game) return;

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


// --- NEON RACER SCRIPT (LOGIC) ---

// Constants and State
const laneCount = 3;
const laneWidth = racerCanvas ? racerCanvas.width / laneCount : 100;

// playerCar now has baseWidth and smooth x for nicer movement
const playerCar = {
  lane: 1,
  baseWidth: laneWidth * 0.55,
  width: laneWidth * 0.55,
  height: 58,
  y: racerCanvas ? racerCanvas.height - 90 : 410,
  x: 0 // pixel x, will be set in reset
};

const racerState = {
  running: false,
  lastTimestamp: 0,
  speed: 180,
  distance: 0,
  dodged: 0,
  obstacles: [],
  speedLines: [],
  spawnTimer: 0, // decreases with progress (measured in "forward" pixels)
  animationFrame: null,
  // LATERAL (side-to-side) gap multiplier: keep constant at 1.2 (120% of vehicle base width)
  gapWidthMultiplier: 1.2, // SIDE-TO-SIDE constant as requested
  // FORWARD spacing tuning (start easier / larger distance, then tighten)
  spawnStartDistance: 420, // starting forward distance between obstacle bars
  spawnMinDistance: 120,   // minimum forward distance as difficulty increases
  spawnVariance: 120,      // random variation added each spawn
  spawnTightenRate: 10,    // how much forward distance reduces per cleared gap (in pixels)
  particles: [], // visual particles for bursts
  explosionParticles: [], // detailed crash particles (shards + smoke)
  laneLerpSpeed: 0.18, // how fast car slides between lanes
  shake: { time: 0, intensity: 0 }, // screen shake state
  flash: { alpha: 0 }, // crash flash
  crashAnimId: null // requestAnimationFrame id for crash animation loop
};

const obstacleHeight = 60;
const laneCenters = Array.from({ length: laneCount }, (_, i) => i * laneWidth + laneWidth / 2);

// Particles for visual flair (light sparks)
function spawnParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    racerState.particles.push({
      type: 'spark',
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 12,
      vx: (Math.random() - 0.5) * 2.5,
      vy: -1 - Math.random() * 1.6,
      life: 30 + Math.random() * 30,
      size: 1 + Math.random() * 2,
      color
    });
  }
}

// Crash: shards + smoke + sparks + shake + flash
function spawnCrash(x, y) {
  // shards: metal pieces
  const shardCount = 18 + Math.floor(Math.random() * 8);
  for (let i = 0; i < shardCount; i++) {
    racerState.explosionParticles.push({
      type: 'shard',
      x: x + (Math.random() - 0.5) * 36,
      y: y + (Math.random() - 0.5) * 18,
      vx: (Math.random() - 0.5) * (4 + Math.random() * 6),
      vy: -2 - Math.random() * 6,
      life: 40 + Math.random() * 60,
      size: 4 + Math.random() * 8,
      angle: Math.random() * Math.PI * 2,
      angularVel: (Math.random() - 0.5) * 0.4,
      color: `hsl(${Math.floor(Math.random()*40)},80%,60%)` // orange-ish shards
    });
  }

  // smoke: expanding soft puffs
  const smokeCount = 8 + Math.floor(Math.random() * 6);
  for (let i = 0; i < smokeCount; i++) {
    racerState.explosionParticles.push({
      type: 'smoke',
      x: x + (Math.random() - 0.5) * 30,
      y: y + (Math.random() - 0.5) * 10,
      vx: (Math.random() - 0.5) * 1.2,
      vy: -0.6 - Math.random() * 1.2,
      life: 50 + Math.random() * 50,
      size: 10 + Math.random() * 20,
      alpha: 0.45 + Math.random() * 0.15
    });
  }

  // small sparks
  spawnParticles(x, y, 'rgba(255,200,120,0.95)', 12);

  // screen shake and flash
  racerState.shake.time = 28 + Math.floor(Math.random() * 18);
  racerState.shake.intensity = 6 + Math.random() * 8;
  racerState.flash.alpha = 0.95;
}

// Draw explosion and normal particles and also advance their physics
function drawParticles() {
  if (!racerCtx) return;

  // Explosion particles (shards + smoke)
  for (let i = racerState.explosionParticles.length - 1; i >= 0; i--) {
    const p = racerState.explosionParticles[i];

    if (p.type === 'shard') {
      // draw rotated rectangle shard
      racerCtx.save();
      const alpha = Math.max(0, p.life / 120);
      racerCtx.globalAlpha = alpha;
      racerCtx.fillStyle = p.color;
      racerCtx.translate(p.x, p.y);
      racerCtx.rotate(p.angle);
      racerCtx.fillRect(-p.size/2, -p.size/3, p.size, Math.max(1, p.size/2));
      racerCtx.restore();

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18; // gravity
      p.vx *= 0.995;
      p.angle += p.angularVel;
      p.life -= 1;
      if (p.life <= 0) racerState.explosionParticles.splice(i, 1);
    } else if (p.type === 'smoke') {
      racerCtx.save();
      const lifeRatio = Math.max(0, p.life / 100);
      racerCtx.globalAlpha = p.alpha * lifeRatio;
      racerCtx.fillStyle = `rgba(30,30,30,${0.6 * lifeRatio})`;
      racerCtx.beginPath();
      racerCtx.ellipse(p.x, p.y, p.size * (1 - lifeRatio*0.2), p.size * (0.6 + (1 - lifeRatio)*0.4), 0, 0, Math.PI*2);
      racerCtx.fill();
      racerCtx.restore();

      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.995;
      p.vy -= 0.01; // slight buoyancy
      p.size += 0.2;
      p.life -= 1;
      if (p.life <= 0) racerState.explosionParticles.splice(i, 1);
    }
  }

  // Standard spark particles
  for (let i = racerState.particles.length - 1; i >= 0; i--) {
    const p = racerState.particles[i];
    if (p.type === 'spark') {
      racerCtx.save();
      racerCtx.globalAlpha = Math.max(0, p.life / 60);
      racerCtx.fillStyle = p.color;
      racerCtx.beginPath();
      racerCtx.arc(p.x, p.y, p.size, 0, Math.PI*2);
      racerCtx.fill();
      racerCtx.restore();

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.vx *= 0.995;
      p.life -= 1;
      if (p.life <= 0) racerState.particles.splice(i, 1);
    }
  }
}

// BACKGROUND & HUD visuals
function drawBackground() {
  if (!racerCtx || !racerCanvas) return;
  // gradient sky
  const gradient = racerCtx.createLinearGradient(0, 0, 0, racerCanvas.height);
  gradient.addColorStop(0, '#03051a');
  gradient.addColorStop(0.6, '#050417');
  gradient.addColorStop(1, '#0a0e24');
  racerCtx.fillStyle = gradient;
  racerCtx.fillRect(0, 0, racerCanvas.width, racerCanvas.height);

  // neon edge bars
  racerCtx.fillStyle = 'rgba(0,255,255,0.06)';
  racerCtx.fillRect(0, 0, 40, racerCanvas.height);
  racerCtx.fillRect(racerCanvas.width - 40, 0, 40, racerCanvas.height);

  // border
  racerCtx.strokeStyle = 'rgba(0,255,255,0.14)';
  racerCtx.lineWidth = 3;
  racerCtx.strokeRect(6, 6, racerCanvas.width - 12, racerCanvas.height - 12);

  // moving horizon lines for speed effect
  racerCtx.lineWidth = 2;
  racerCtx.strokeStyle = 'rgba(28, 255, 255, 0.06)';
  const base = Math.floor((performance.now() / 40) % 30);
  for (let i = 0; i < 10; i++) {
    racerCtx.beginPath();
    racerCtx.moveTo(0, 120 + (i * 30) + base);
    racerCtx.lineTo(racerCanvas.width, 120 + (i * 30) + base - ((i % 2) * 6));
    racerCtx.stroke();
  }
}

function drawSpeedLines() {
  if (!racerCtx) return;
  racerCtx.strokeStyle = 'rgba(0, 255, 255, 0.28)';
  racerCtx.lineWidth = 2;
  racerState.speedLines.forEach(line => {
    racerCtx.beginPath();
    racerCtx.moveTo(line.x, line.y);
    racerCtx.lineTo(line.x, line.y + line.length);
    racerCtx.stroke();
  });
}

function drawPlayer() {
  if (!racerCtx) return;
  // smooth x lerp towards target lane center
  const targetX = laneCenters[playerCar.lane];
  playerCar.x += (targetX - playerCar.x) * racerState.laneLerpSpeed;

  const left = playerCar.x - playerCar.width / 2;
  racerCtx.save();

  // outer glow
  racerCtx.shadowColor = '#19d7ff';
  racerCtx.shadowBlur = 20;
  racerCtx.fillStyle = '#19d7ff';
  racerCtx.fillRect(left - 2, playerCar.y - 2, playerCar.width + 4, playerCar.height + 4);
  racerCtx.shadowBlur = 0;

  // body
  racerCtx.fillStyle = '#0b1f3a';
  racerCtx.fillRect(left + 6, playerCar.y + 10, playerCar.width - 12, playerCar.height - 20);

  // highlights
  racerCtx.fillStyle = '#19d7ff';
  racerCtx.fillRect(left + playerCar.width / 2 - 6, playerCar.y + 6, 12, playerCar.height - 12);

  // top canopy
  racerCtx.fillStyle = '#3be7ff';
  racerCtx.fillRect(left + 6, playerCar.y + 2, playerCar.width - 12, 6);

  // small exhaust trail based on speed
  racerCtx.fillStyle = 'rgba(10, 200, 255, 0.08)';
  const trailWidth = Math.min(40, Math.floor((racerState.speed - 160) / 6));
  racerCtx.fillRect(left + playerCar.width / 2 - trailWidth / 2, playerCar.y + playerCar.height + 4, trailWidth, 8);

  racerCtx.restore();
}

function drawObstacles() {
  if (!racerCtx) return;
  racerState.obstacles.forEach(ob => {
    const top = ob.y;
    const bottom = ob.y + obstacleHeight;
    const gapLeft = ob.gapCenter - ob.gapWidth / 2;
    const gapRight = ob.gapCenter + ob.gapWidth / 2;

    racerCtx.save();
    racerCtx.shadowColor = ob.color;
    racerCtx.shadowBlur = 16;
    racerCtx.fillStyle = ob.color;
    // left chunk
    if (gapLeft > 0) {
      racerCtx.fillRect(0, top, gapLeft, obstacleHeight);
      // neon edge
      racerCtx.strokeStyle = 'rgba(255,255,255,0.06)';
      racerCtx.lineWidth = 1;
      racerCtx.strokeRect(Math.max(0, gapLeft - 6), top, 6, obstacleHeight);
    }
    // right chunk
    if (gapRight < racerCanvas.width) {
      racerCtx.fillRect(gapRight, top, racerCanvas.width - gapRight, obstacleHeight);
      racerCtx.strokeStyle = 'rgba(255,255,255,0.06)';
      racerCtx.lineWidth = 1;
      racerCtx.strokeRect(gapRight, top, 6, obstacleHeight);
    }
    racerCtx.restore();

    racerCtx.fillStyle = 'rgba(255,255,255,0.06)';
    racerCtx.fillRect(gapLeft, top + 2, ob.gapWidth, 4);
  });
}

function spawnObstacle() {
  const gapLane = Math.floor(Math.random() * laneCount);
  const colorHue = Math.floor(Math.random() * 360);

  // Use the current player width so the lateral gap truly fits the vehicle.
  // LATERAL gap is constant at 120% of the vehicle current width (side-to-side spacing).
  // This fixes occasions where the vehicle was scaled larger than the gap computed from baseWidth.
  let gapWidth = playerCar.width * racerState.gapWidthMultiplier;

  // Ensure an explicit safety margin so the car can always fit (in case of rounding or timing)
  const safetyMargin = 6; // pixels of free space on both sides combined
  gapWidth = Math.max(gapWidth, playerCar.width + safetyMargin);

  // Clamp gap width so it never exceeds the canvas (leave small edges)
  gapWidth = Math.min(gapWidth, Math.max(60, racerCanvas.width - 24));

  let gapCenter = laneCenters[gapLane];

  // Clamp center so the gap remains fully on-screen
  const half = gapWidth / 2;
  gapCenter = Math.max(half + 8, Math.min(racerCanvas.width - half - 8, gapCenter));

  racerState.obstacles.push({
    y: -obstacleHeight,
    gapCenter,
    gapWidth,
    color: `hsl(${colorHue}, 90%, 60%)`
  });

  // FORWARD spacing: start easier (long distance) then tighten as player clears gaps
  const dynamicForward = Math.max(
    racerState.spawnMinDistance,
    racerState.spawnStartDistance - racerState.dodged * racerState.spawnTightenRate
  );
  racerState.spawnTimer = dynamicForward + Math.random() * racerState.spawnVariance;
}

function resetObstacles() {
  racerState.obstacles = [];
  racerState.spawnTimer = 0;
}

function ensureSpeedLines() {
  if (!racerCanvas) return;
  while (racerState.speedLines.length < 14) {
    racerState.speedLines.push({
      x: 60 + Math.random() * (racerCanvas.width - 120),
      y: Math.random() * racerCanvas.height,
      length: 18 + Math.random() * 28
    });
  }
}

function applyShakeTransform() {
  // Returns {dx, dy} and applies translation to racerCtx. Call between save()/restore().
  if (!racerCtx) return {dx:0, dy:0};
  if (racerState.shake.time > 0) {
    const intensity = racerState.shake.intensity;
    const dx = (Math.random() - 0.5) * intensity;
    const dy = (Math.random() - 0.5) * intensity;
    racerCtx.translate(dx, dy);
    racerState.shake.time -= 1;
    // decay intensity slightly
    racerState.shake.intensity *= 0.985;
    return {dx, dy};
  }
  return {dx:0, dy:0};
}

// Crash animation loop runs after the main game stops, so flash/shake/smoke/shards can play out.
// It repeatedly renders frames until explosion particles and flash/shake are finished.
function startCrashAnimation() {
  // Cancel any previous crash animation
  if (racerState.crashAnimId) {
    cancelAnimationFrame(racerState.crashAnimId);
    racerState.crashAnimId = null;
  }

  const loop = (timestamp) => {
    // We still want to update particle physics each frame (drawParticles advances them)
    // and render the current state. renderRacer does both.
    renderRacer();

    // Keep the loop running while there are active crash visuals
    const activeParticles = (racerState.explosionParticles && racerState.explosionParticles.length > 0)
                           || (racerState.particles && racerState.particles.length > 0);
    const activeShake = racerState.shake.time > 0;
    const activeFlash = racerState.flash.alpha > 0.02;

    if (activeParticles || activeShake || activeFlash) {
      racerState.crashAnimId = requestAnimationFrame(loop);
    } else {
      // stop animating; clear any residual small alpha
      racerState.flash.alpha = 0;
      racerState.crashAnimId = null;
      // Leave the screen showing the post-crash state; user can Reset to return to normal
    }
  };

  racerState.crashAnimId = requestAnimationFrame(loop);
}

function updateRacer(delta) {
  if (!racerCanvas) return;
  // dynamic speed scaling: increase with dodged
  racerState.speed = Math.min(520, 180 + racerState.dodged * 6 + Math.floor(racerState.distance / 800));
  const pixelsPerMs = (racerState.speed / 1000) * 1.25;
  const traveled = pixelsPerMs * delta;
  racerState.distance += traveled;
  racerState.spawnTimer -= traveled;

  // NOTE: SIDE-TO-SIDE gap is fixed at 1.2× vehicle current width (no change here)
  // racerState.gapWidthMultiplier remains constant

  if (racerState.spawnTimer <= 0) {
    spawnObstacle();
  }

  // Move obstacles
  racerState.obstacles.forEach(ob => {
    ob.y += traveled;
  });

  // Filter obstacles and handle dodges
  racerState.obstacles = racerState.obstacles.filter(ob => {
    if (ob.y > racerCanvas.height) {
      racerState.dodged += 1;
      // spawn a small particle burst to reward the player visually
      spawnParticles(ob.gapCenter, racerCanvas.height - 40, 'rgba(30,240,255,0.9)', 16);

      // player grows slightly up to 130% for visual effect
      const scale = Math.min(1.3, 1 + racerState.dodged * 0.02);
      playerCar.width = playerCar.baseWidth * scale;

      // milestone boosts
      if (racerState.dodged > 0 && racerState.dodged % 10 === 0) {
        racerState.speed = Math.min(520, racerState.speed + 24);
        if (racerMessageEl) racerMessageEl.textContent = `Boost! Speed increased.`;
      }
      return false;
    }
    return true;
  });

  // Move speed lines for parallax speed feel
  racerState.speedLines.forEach(line => {
    line.y += traveled * 1.6;
  });
  racerState.speedLines = racerState.speedLines.filter(line => line.y < racerCanvas.height + 40);
  ensureSpeedLines();

  // Collision check against obstacles
  const carCenter = playerCar.x;
  const carLeft = carCenter - playerCar.width / 2;
  const carRight = carCenter + playerCar.width / 2;
  const carTop = playerCar.y;
  const carBottom = playerCar.y + playerCar.height;

  for (const ob of racerState.obstacles) {
    const obTop = ob.y;
    const obBottom = ob.y + obstacleHeight;
    if (carBottom <= obTop || carTop >= obBottom) continue;
    const gapLeft = ob.gapCenter - ob.gapWidth / 2;
    const gapRight = ob.gapCenter + ob.gapWidth / 2;
    // check overlap: if any part of car outside the gap => crash
    if (carLeft < gapLeft || carRight > gapRight) {
      // enhanced crash sequence
      // cancel the running game frame if any
      if (racerState.animationFrame) {
        cancelAnimationFrame(racerState.animationFrame);
        racerState.animationFrame = null;
      }

      spawnCrash(playerCar.x, playerCar.y + playerCar.height / 2);

      // stop the main game loop but start crash animation loop so flash/shake/smoke play out
      racerState.running = false;
      startCrashAnimation();

      if (racerMessageEl) {
        racerMessageEl.textContent = 'Crash! Reset to roll out again.';
      }
      return;
    }
  }

  // Update explosion & particles (drawParticles advances them)
  // But we don't render here; render happens in main loop
  drawParticles();
}

function renderRacer() {
  if (!racerCtx) return;

  racerCtx.save();

  // apply screen shake transform if active
  applyShakeTransform();

  // background and world
  drawBackground();
  drawSpeedLines();
  drawObstacles();
  drawPlayer();

  // draw explosion and particles on top
  drawParticles();

  // crash flash overlay (when flash.alpha > 0)
  if (racerState.flash.alpha > 0) {
    racerCtx.fillStyle = `rgba(255,255,255,${racerState.flash.alpha})`;
    racerCtx.fillRect(0, 0, racerCanvas.width, racerCanvas.height);
    // decay flash even if game not running; this will be processed by the crash animation loop
    racerState.flash.alpha *= 0.92;
    if (racerState.flash.alpha < 0.02) racerState.flash.alpha = 0;
  }

  racerCtx.restore();
}

function gameLoop(timestamp) {
  if (!racerState.running) return;
  const delta = timestamp - racerState.lastTimestamp;
  racerState.lastTimestamp = timestamp;
  updateRacer(delta);
  renderRacer();
  updateHud();
  if (racerState.running) {
    racerState.animationFrame = requestAnimationFrame(gameLoop);
  }
}

function startRacer() {
  if (racerState.running) return;
  if (racerMessageEl) {
    racerMessageEl.textContent = 'Neon boost engaged!';
  }
  racerState.running = true;
  racerState.lastTimestamp = performance.now();
  racerState.animationFrame = requestAnimationFrame(gameLoop);
}

function pauseRacer() {
  if (!racerState.running) return;
  racerState.running = false;
  if (racerState.animationFrame) cancelAnimationFrame(racerState.animationFrame);
  if (racerMessageEl) {
    racerMessageEl.textContent = 'Paused. Hit start to keep racing.';
  }
}

function resetRacer() {
  // Stop any running crash animation too
  if (racerState.crashAnimId) {
    cancelAnimationFrame(racerState.crashAnimId);
    racerState.crashAnimId = null;
  }

  pauseRacer();
  playerCar.lane = 1;
  playerCar.baseWidth = laneWidth * 0.55;
  playerCar.width = playerCar.baseWidth;
  playerCar.x = laneCenters[playerCar.lane];
  playerCar.height = 58;
  racerState.speed = 180;
  racerState.distance = 0;
  racerState.dodged = 0;
  racerState.speedLines = [];
  // reset lateral gap to constant 120% and forward spawn settings back to "easy start"
  racerState.gapWidthMultiplier = 1.2;
  racerState.spawnStartDistance = 420;
  racerState.spawnMinDistance = 120;
  racerState.spawnVariance = 120;
  racerState.spawnTightenRate = 10;
  racerState.particles = [];
  racerState.explosionParticles = [];
  racerState.shake = { time: 0, intensity: 0 };
  racerState.flash = { alpha: 0 };
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

  // if running, we still allow lane shift but we animate smoothly via playerCar.x lerp
  playerCar.lane = nextLane;
  renderRacer();
  updateHud();
}

function handleKey(event) {
  // IMPORTANT: Check if the RACER modal is open
  if (!racerModal || racerModal.style.display !== 'flex') return;
  
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
  if (racerDistanceEl) racerDistanceEl.textContent = `Distance: ${Math.floor(racerState.distance)}m`;
  if (racerSpeedEl) racerSpeedEl.textContent = `Speed: ${Math.floor(racerState.speed)} mph`;
  if (racerObstaclesEl) racerObstaclesEl.textContent = `Gaps cleared: ${racerState.dodged}`;
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


// --- FULL INVADERS SCRIPT (LOGIC) ---
// --- [MODIFIED FOR WIDER PLAY AREA, CONNECTED BUNKERS, OLD-STYLE ENEMIES + MORE] ---

/*
  User requested:
  - Make bullets like the ones in tetris-neon-invaders (that file used text '|' for bullets)
  - Make bunkers like the ones in spaceInvaders.js (connected defense matrices)
  - Keep aliens back to old functioning, but more of them
  - Apply changes only to Space Invaders section and return full file
*/

/* ============================
   State and configuration
   ============================ */
let invaderState = {
  player: { x: 140, y: 350, width: 20, height: 16, lives: 3, alive: true }, // keep starting lives at 3 as requested
  // bullet represented as small rect for collisions; will be drawn as a laser stroke
  bullet: { x: 0, y: 0, width: 4, height: 14, active: false, alive: false, speed: 14 },
  enemies: [],
  enemyBullets: [],
  bunkers: [], // will be created via connected defense matrices (like spaceInvaders.js)
  mysteryShip: { x: 0, y: 20, width: 30, height: 14, active: false, direction: 1, alive: false },
  enemyDirection: 1,
  score: 0,
  level: 1,
  gameOver: false,
  gameLoopId: null,
  dropSpeed: 6, // reduced default drop speed to make levels gentler
  initialEnemies: 0,
  enemyMoveTimer: 0,
  enemyMoveInterval: 40 // slower base interval to reduce early-level speed
};

// color palettes retained
const invaderPalettes = ['#FF00FF','#FFA500','#FFFF00','#00FF00','#00FFFF','#9D00FF','#FD1C03','#FF69B4'];

/* ============================
   BUNKERS: Connected defense matrices (like spaceInvaders.js)
   We'll build 4 bunkers; each bunker uses a connected pattern (6x12).
   We'll store bunker blocks in pixel coords for direct drawing and collision.
   ============================ */

const bunkerPatternConnected = [
  [0,1,1,1,1,1,1,1,1,1,1,0],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1],
  [1,1,1,1,0,0,0,0,1,1,1,1],
  [1,1,1,0,0,0,0,0,0,1,1,1],
  [1,1,1,0,0,0,0,0,0,1,1,1]
];

function createBunkers() {
  invaderState.bunkers = [];
  if (!invadersCanvas) return;
  const blockSize = 6; // pixel size for each pattern cell
  const bunkerCount = 4;
  // center bunkers evenly across playable width, leave 30px margin left/right
  const usableWidth = invadersCanvas.width - 60;
  const bunkerTotalWidth = bunkerPatternConnected[0].length * blockSize;
  const spacing = usableWidth / bunkerCount;
  const baseX = 30; // left margin

  const bunkerY = Math.max( invadersCanvas.height - 140, 260 ); // place above player area

  for (let b = 0; b < bunkerCount; b++) {
    const center = baseX + spacing * b + spacing / 2;
    const left = Math.round(center - bunkerTotalWidth / 2);
    for (let r = 0; r < bunkerPatternConnected.length; r++) {
      for (let c = 0; c < bunkerPatternConnected[0].length; c++) {
        if (bunkerPatternConnected[r][c]) {
          const px = left + c * blockSize;
          const py = bunkerY + r * blockSize;
          invaderState.bunkers.push({
            x: px,
            y: py,
            width: blockSize,
            height: blockSize,
            alive: true
          });
        }
      }
    }
  }
}

/* ============================
   ENEMIES: Old-style rectangular enemies, but more of them and wider formation
   - We'll compute columns based on canvas width to use more horizontal space
   - Keep behavior (move left/right, drop when hitting edges), shooting preserved
   ============================ */
function createEnemies() {
  const state = invaderState;
  state.enemies = [];

  const rows = 4; // reduced rows to make levels easier
  const approxEnemyWidth = 20;
  const padding = 12;
  const minCols = 8;
  const maxCols = 12;
  const availableWidth = Math.max(300, (invadersCanvas ? invadersCanvas.width : 300) - 60);
  const colsEstimate = Math.floor(availableWidth / (approxEnemyWidth + padding));
  const cols = Math.min(Math.max(minCols, colsEstimate), maxCols);

  const enemyWidth = approxEnemyWidth;
  const enemyHeight = 14;

  const totalWidth = cols * enemyWidth + (cols - 1) * padding;
  const startX = Math.max(12, Math.round((invadersCanvas.width - totalWidth) / 2));
  let startY = 28 + (state.level - 1) * 6;
  startY = Math.min(startY, 120);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      state.enemies.push({
        x: startX + c * (enemyWidth + padding),
        y: startY + r * (enemyHeight + 10),
        width: enemyWidth,
        height: enemyHeight,
        alive: true
      });
    }
  }

  state.initialEnemies = state.enemies.length;
}

/* ============================
   AABB collision helper (works for bunker blocks, rectangles)
   ============================ */
function checkCollision(objA, objB) {
  if (('alive' in objA && !objA.alive) || ('alive' in objB && !objB.alive)) return false;
  return objA.x < objB.x + objB.width &&
         objA.x + objA.width > objB.x &&
         objA.y < objB.y + objB.height &&
         objA.y + objA.height > objB.y;
}

/* ============================
   Update logic
   Mostly keeps prior invaders behavior but adapted to new structures.
   ============================ */
function updateInvaders() {
  if (invaderState.gameOver || !invadersCanvas) return;
  const state = invaderState;

  // Player bullet movement (laser)
  if (state.bullet.active) {
    state.bullet.y -= state.bullet.speed;
    if (state.bullet.y + state.bullet.height < 0) {
      state.bullet.active = false;
      state.bullet.alive = false;
    }

    // Collide with bunkers (connected bunkers represented as many small rectangles)
    for (let b = state.bunkers.length - 1; b >= 0; b--) {
      const block = state.bunkers[b];
      if (block.alive && checkCollision(state.bullet, block)) {
        block.alive = false;
        state.bullet.active = false;
        state.bullet.alive = false;
        break;
      }
    }

    // Collide with enemies
    if (state.bullet.active) {
      for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i];
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

    // Mystery ship
    if (state.bullet.active && state.mysteryShip.active) {
      if (checkCollision(state.bullet, state.mysteryShip)) {
        state.mysteryShip.active = false;
        state.mysteryShip.alive = false;
        state.bullet.active = false;
        state.bullet.alive = false;
        let bonus = (Math.floor(Math.random() * 3) + 1) * 50;
        state.score += bonus;
        if (invadersMessageEl) invadersMessageEl.textContent = `+${bonus} POINTS!`;
      }
    }
  }

  // Enemy movement (timer-based)
  state.enemyMoveTimer--;
  if (state.enemyMoveTimer <= 0) {
    let moveDown = false;
    let moveStep = 4; // smaller horizontal step to slow lateral movement

    let aliveEnemies = state.enemies.filter(e => e.alive);

    // Check edges
    for (const enemy of aliveEnemies) {
      if ((state.enemyDirection > 0 && enemy.x + enemy.width >= invadersCanvas.width - 6) ||
          (state.enemyDirection < 0 && enemy.x <= 6)) {
        moveDown = true;
        state.enemyDirection *= -1;
        moveStep = 0;
        break;
      }
    }

    // Update positions
    aliveEnemies.forEach(enemy => {
      if (moveDown) enemy.y += state.dropSpeed;
      else enemy.x += state.enemyDirection * moveStep;

      if (enemy.y + enemy.height > state.player.y) {
        stopInvaders("GAME OVER: They reached you!");
      }
    });

    let progress = (state.initialEnemies - aliveEnemies.length) / state.initialEnemies;
    // gentler acceleration: slower base and less aggressive speed-up based on progress
    state.enemyMoveInterval = Math.max(6, (36 - (state.level - 1) * 1.2) * (1 - progress * 0.7));
    state.enemyMoveTimer = state.enemyMoveInterval;
  }

  // Mystery ship spawn (rarer now)
  if (!state.mysteryShip.active && Math.random() > 0.995 - (state.level * 0.0003)) {
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
    state.mysteryShip.x += state.mysteryShip.direction * (1.5 + state.level * 0.2);
    if (state.mysteryShip.x > invadersCanvas.width || state.mysteryShip.x < -state.mysteryShip.width) {
      state.mysteryShip.active = false;
      state.mysteryShip.alive = false;
    }
  }

  // Enemy shooting
  let aliveEnemies = state.enemies.filter(e => e.alive);
  // make shooting less frequent: higher threshold and slower increase per level
  let shootThreshold = Math.max(0.75, 0.98 - (state.level * 0.015));
  if (Math.random() > shootThreshold && aliveEnemies.length > 0) {
    let shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
    state.enemyBullets.push({
      x: shooter.x + Math.floor(shooter.width / 2) - 1,
      y: shooter.y + shooter.height,
      width: 2,
      height: 14,
      alive: true,
      speed: 3 + state.level * 0.15 // slightly slower bullets
    });
  }

  // Move enemy bullets, collide with bunkers/player
  state.enemyBullets = state.enemyBullets.filter(bullet => {
    bullet.y += bullet.speed;

    for (let b = state.bunkers.length - 1; b >= 0; b--) {
      const bunkerBlock = state.bunkers[b];
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

  // Lose if all bunkers destroyed (same as before)
  if (state.bunkers.length > 0 && state.bunkers.filter(b => b.alive).length === 0) {
    stopInvaders("GAME OVER: Bases destroyed!");
  }

  // Level cleared
  if (aliveEnemies.length === 0 && !state.gameOver) {
    startNextLevel();
  }
}

/* ============================
   DRAWING: bullets as neon lasers (stroked lines) and bunkers as connected blocks
   ============================ */
function drawInvaders() {
  if (!invadersCtx) return;
  const state = invaderState;

  // clear frame
  invadersCtx.fillStyle = '#000';
  invadersCtx.fillRect(0, 0, invadersCanvas.width, invadersCanvas.height);

  // Draw bunkers (connected style: blocks arranged in matrix)
  invaderState.bunkers.forEach(block => {
    if (block.alive) {
      invadersCtx.fillStyle = '#00FF00';
      invadersCtx.fillRect(block.x, block.y, block.width, block.height);
    }
  });

  // Draw player (rectangle)
  if (state.player.alive) {
    invadersCtx.fillStyle = '#00FFFF';
    // Draw as a small pixel-art ship like before but keep rect for collisions
    // We'll draw a simple filled rect for clarity
    invadersCtx.fillRect(state.player.x, state.player.y, state.player.width, state.player.height);
  }

  // Player bullet: DRAW AS NEON LASER LINE
  if (state.bullet.active) {
    invadersCtx.save();
    invadersCtx.strokeStyle = '#88FFFF';
    invadersCtx.lineWidth = 3;
    invadersCtx.shadowColor = '#88FFFF';
    invadersCtx.shadowBlur = 12;
    // draw vertical laser centered at bullet.x
    const bx = Math.round(state.bullet.x + state.bullet.width / 2);
    invadersCtx.beginPath();
    invadersCtx.moveTo(bx, Math.round(state.bullet.y + state.bullet.height));
    invadersCtx.lineTo(bx, Math.round(state.bullet.y));
    invadersCtx.stroke();
    invadersCtx.restore();
  }

  // Draw enemies (rectangles - old style)
  const enemyColor = invaderPalettes[(state.level - 1) % invaderPalettes.length];
  invadersCtx.fillStyle = enemyColor;
  state.enemies.forEach(enemy => {
    if (enemy.alive) {
      invadersCtx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    }
  });

  // Mystery ship (keeps earlier visual)
  if (state.mysteryShip.active) {
    const ms = state.mysteryShip;
    invadersCtx.save();
    invadersCtx.shadowColor = '#FFD700';
    invadersCtx.shadowBlur = 12;
    invadersCtx.fillStyle = '#FFD700';
    invadersCtx.fillRect(ms.x, ms.y, ms.width, ms.height);
    const lights = ['#FD1C03', '#00FF00', '#00FFFF', '#FF00FF', '#FFD700'];
    for (let i = 0; i < 5; i++) {
      invadersCtx.fillStyle = lights[i % lights.length];
      invadersCtx.fillRect(ms.x + 3 + i * 5, ms.y + ms.height - 4, 3, 3);
    }
    invadersCtx.restore();
  }

  // Enemy bullets: draw as thin red lasers
  state.enemyBullets.forEach(bullet => {
    invadersCtx.save();
    invadersCtx.strokeStyle = '#FF5555';
    invadersCtx.lineWidth = 2;
    invadersCtx.shadowColor = '#FF5555';
    invadersCtx.shadowBlur = 8;
    const ex = Math.round(bullet.x + bullet.width / 2);
    invadersCtx.beginPath();
    invadersCtx.moveTo(ex, Math.round(bullet.y));
    invadersCtx.lineTo(ex, Math.round(bullet.y + bullet.height));
    invadersCtx.stroke();
    invadersCtx.restore();
  });

  // Lives UI: show two boxes at start; when hit, show one at left and one on the side near the player.
  // This still represents 3 total lives (active ship + two reserve boxes).
  const lifeBoxW = 14;
  const lifeBoxH = 10;
  const lifeLeftX = 10;
  const lifeY = invadersCanvas.height - 28;

  invadersCtx.fillStyle = '#00FFFF';
  // lives mapping:
  // lives === 3 -> two boxes at left
  // lives === 2 -> one box at left, one box on the side (near player)
  // lives === 1 -> one box on the side (near player)
  if (state.player.lives >= 3) {
    // two reserve boxes shown on the left
    invadersCtx.fillRect(lifeLeftX, lifeY, lifeBoxW, lifeBoxH);
    invadersCtx.fillRect(lifeLeftX + lifeBoxW + 8, lifeY, lifeBoxW, lifeBoxH);
  } else if (state.player.lives === 2) {
    // one reserve left, and one "on the side" near player's current x
    invadersCtx.fillRect(lifeLeftX, lifeY, lifeBoxW, lifeBoxH);
    const sideX = Math.min(invadersCanvas.width - lifeBoxW - 8, Math.max( lifeLeftX + 60, state.player.x + state.player.width + 8 ));
    invadersCtx.fillRect(sideX, lifeY, lifeBoxW, lifeBoxH);
  } else if (state.player.lives === 1) {
    // only the side box remains to indicate the last life
    const sideX = Math.min(invadersCanvas.width - lifeBoxW - 8, Math.max( lifeLeftX + 60, state.player.x + state.player.width + 8 ));
    invadersCtx.fillRect(sideX, lifeY, lifeBoxW, lifeBoxH);
  }
  // Note: the active ship itself is still drawn at state.player.x, so the player always sees the active ship + these "reserve" boxes.

  // HUD
  invadersCtx.font = '15px "Courier New", monospace';
  invadersCtx.fillStyle = '#fff';
  invadersCtx.fillText(`Score: ${state.score}`, 12, 18);
  invadersCtx.fillStyle = '#88FFFF';
  invadersCtx.fillText(`Level: ${state.level}`, invadersCanvas.width - 90, 18);

  if (invadersMessageEl) {
    invadersCtx.font = '14px Arial';
    invadersCtx.fillStyle = '#FFD700';
    invadersCtx.fillText(invadersMessageEl.textContent, 16, 35);
  }
}

/* ============================
   Game loop / control functions
   ============================ */
function invadersGameLoop() {
  if (invaderState.gameOver) return;
  updateInvaders();
  drawInvaders();
  invaderState.gameLoopId = requestAnimationFrame(invadersGameLoop);
}

function startNextLevel() {
  const state = invaderState;
  state.level++;
  if (invadersMessageEl) invadersMessageEl.textContent = `Space Invaders++ — Level ${state.level}`;

  state.enemyBullets = [];
  state.bullet.active = false;
  state.bullet.alive = false;

  // gentler progression: slower interval decrease and smaller drop speed growth
  state.enemyMoveInterval = Math.max(8, 36 - (state.level - 1) * 1.2);
  state.enemyMoveTimer = state.enemyMoveInterval;
  state.dropSpeed = 6 + (state.level - 1) * 1.2;

  createEnemies();
  createBunkers();

  if (invadersMessageEl) {
    const palette = invaderPalettes[(state.level - 1) % invaderPalettes.length];
    invadersMessageEl.style.color = palette;
    setTimeout(() => { if (invadersMessageEl) invadersMessageEl.style.color = '#eee'; }, 1200);
  }
}

function startInvaders() {
  if (invaderState.gameLoopId) {
    cancelAnimationFrame(invaderState.gameLoopId);
    invaderState.gameLoopId = null;
  }

  // Reset game state
  invaderState.gameOver = false;
  invaderState.score = 0;
  invaderState.level = 1;
  invaderState.enemyBullets = [];
  invaderState.bullet.active = false;
  invaderState.bullet.alive = false;
  invaderState.player.x = Math.max(10, (invadersCanvas ? invadersCanvas.width : 300) / 2 - invaderState.player.width / 2);
  invaderState.player.lives = 3; // keep player lives at 3 per request
  invaderState.player.alive = true;
  invaderState.enemyDirection = 1;
  invaderState.enemyMoveTimer = 0;
  invaderState.enemyMoveInterval = 36; // slower starting interval
  invaderState.mysteryShip.active = false;
  invaderState.mysteryShip.alive = false;
  invaderState.dropSpeed = 6; // reduced base drop speed

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

/* ============================
   Input handling for invaders
   - Shooting sets bullet rect (collision) but visually it's rendered as a neon laser line
   ============================ */
function handleInvadersKey(event) {
  // Only run if the invaders modal is open
  if (!invadersModal || invadersModal.style.display !== 'flex') return;

  const state = invaderState;

  // Allow shooting even if game is over (to restart)
  if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (state.gameOver) {
          startInvaders(); // Restart game on spacebar if game is over
          return;
      }

      if (!state.bullet.active && state.player.alive) {
        // create bullet rectangle for collisions
        state.bullet.x = state.player.x + (state.player.width / 2) - (state.bullet.width / 2);
        state.bullet.y = state.player.y - state.bullet.height;
        state.bullet.active = true;
        state.bullet.alive = true; // for collision check
      }
  }

  if (state.gameOver || !state.player.alive) return; // Don't move if game is over or player is dead

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    state.player.x = Math.max(0, state.player.x - 12);
  }
  if (event.key === 'ArrowRight') {
    event.preventDefault();
    state.player.x = Math.min(invadersCanvas.width - state.player.width, state.player.x + 12);
  }
}

// --- INIT INVADERS ---
function initInvadersGame() {
    if (startInvadersBtn) {
      startInvadersBtn.addEventListener('click', startInvaders);
    }

    // Bind keyboard listener for invaders
    if (!document.__invadersBound) {
      document.addEventListener('keydown', handleInvadersKey);
      document.__invadersBound = true;
    }

    // Initial clear
    if (invadersCtx) {
        invadersCtx.fillStyle = '#000';
        invadersCtx.fillRect(0, 0, invadersCanvas.width, invadersCanvas.height);
    }
}

// --- INIT ALL GAMES ---
document.addEventListener('DOMContentLoaded', () => {
  // enforcePageAccess may redirect if user lacks permission
  if (typeof enforcePageAccess === 'function' && !enforcePageAccess('experimental.html')) {
      return;
  }

  if (typeof initTetrisGame === 'function') {
    initTetrisGame();
  }
  if (typeof initRacerGame === 'function') {
    initRacerGame();
  }
  if (typeof initInvadersGame === 'function') {
    initInvadersGame();
  }
});
