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
// --- Audio Elements Removed ---
// --- Audio Elements Removed ---

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
        if (typeof resetRacer === 'function') {
            resetRacer();
        }
    });
}

function closeRacerModal() {
    racerModal.style.display = 'none';
    if (typeof pauseRacer === 'function') {
        pauseRacer();
    }
}

if (racerModalCloseBtn) racerModalCloseBtn.addEventListener('click', closeRacerModal);

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
  highScore = parseInt(localStorage.getItem('tetris+HighScore')) || 0;
  if(scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
}

function saveHighScore() {
  localStorage.setItem('tetris+HighScore', highScore); // <-- ### FIX: Changed key to 'tetris+HighScore'
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
  { fill: '#FD1C03', stroke: '#E41903', shadow: '#FD1C03' }, // Level 6 (Red)
  { fill: '#FF69B4', stroke: '#E6529E', shadow: '#FF69B4' }, // Level 7 (Pink)
  { fill: '#F0F0F0', stroke: '#D9D9D9', shadow: '#F0F0F0' }  // Level 8 (White)
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
const horizonY = 120; // Y pixel of horizon
const canvasWidth = racerCanvas ? racerCanvas.width : 340;
const canvasHeight = racerCanvas ? racerCanvas.height : 520;
// --- ### NEW: Define the "width" of the road at the bottom of the screen
const roadWidthAtBottom = racerCanvas.width * 1.6; // <-- ### MOD: Was 1.2 (Wider lanes)
const roadWidthTop = racerCanvas.width * 0.08; // <-- ### MOD: Was 0.1 (Narrower top)


const playerCar = {
    lane: 0, // <-- ### MOD: Use -1, 0, 1 for lanes. Start at 0 (center).
    baseWidth: laneWidth * 0.55,
    width: laneWidth * 0.55,
    height: 58,
    y: racerCanvas ? racerCanvas.height - 90 : 410,
    x: racerCanvas ? racerCanvas.width / 2 : 170 // Start at center
};

const racerState = {
    running: false,
    crashed: false, // <-- ### NEW: To stop game loop on crash
    lastTimestamp: 0,
    speed: 180,
    distance: 0,
    dodged: 0,
    mostGapsCleared: 0,
    obstacles: [],
    speedLines: [], // <-- ### MOD: Will be radial lines
    stars: [], // <-- ### NEW: Starfield
    spawnTimer: 0,
    animationFrame: null,

    // Difficulty Tuning (Time-based)
    spawnStartTime: 2200, // <-- ### MOD: Was 1800 (More time)
    spawnMinTime: 800, // <-- ### MOD: Was 650 (More time)
    spawnTimeVariance: 200,
    spawnTimeTightenRate: 20,
    gapWidthStartMultiplier: 1.8, // <-- ### MOD: Was 1.7 (Wider gaps)
    gapWidthMinMultiplier: 1.4, // <-- ### MOD: Was 1.2 (Wider gaps)
    gapWidthTightenRate: 0.02,

    particles: [],
    explosionParticles: [],
    laneLerpSpeed: 0.12, // <-- ### MOD: Was 0.18 (slower merge)
    shake: { time: 0, intensity: 0 },
    flash: { alpha: 0 },
    crashAnimId: null,

    // Car physics/feel
    carSway: 0,
    carSwaySpeed: 0.008,
    carSwayMax: 0.035,
    carTilt: 0,
    carTiltMax: 0.1,
    carTiltSpeed: 0.1,

    // Visuals
    edgeFlash: 0,
};

const obstacleHeight = 60; // This will now be the *base* height at full scale
// --- ### REMOVED: Old laneCenters
// --- Sound Control Removed ---

// --- ### NEW: Pseudo-3D Scaling Function ### ---
/**
 * Calculates a scale (0.0 to 1.0) based on Y position.
 * @param {number} y - The current Y coordinate.
 * @returns {number} A scale factor from 0.0 (horizon) to 1.0 (bottom).
 */
function getPerspectiveScale(y) {
    if (y < horizonY) return 0; // Above horizon, scale is 0

    // --- ### NEW: Non-linear scaling ### ---
    // Use a power curve (e.g., pow(2.2)) to make scaling non-linear
    // Things will stay smaller for longer, then grow rapidly
    let normalizedY = (y - horizonY) / (canvasHeight - horizonY);
    let scale = Math.pow(normalizedY, 2.2); // Was linear
    // --- ### END NEW ### ---

    // Add a minimum scale so it's visible, and clip at 1.0
    return Math.max(0.01, Math.min(scale, 1.0)); // <-- MOD: min scale from 0.05 to 0.01
}


function spawnWhooshLines(x, y) {
    const count = 10 + Math.floor(Math.random() * 6);
    for (let i = 0; i < count; i++) {
        const angle = (Math.random() - 0.5) * 1.2;
        const speed = 4 + Math.random() * 5;
        racerState.particles.push({
            type: 'whoosh',
            x: x + (Math.random() - 0.5) * 40,
            y: y + (Math.random() - 0.5) * 10,
            vx: Math.sin(angle) * speed,
            vy: Math.cos(angle) * speed * 0.5 + 2.0,
            life: 20 + Math.random() * 15,
            size: 1 + Math.random() * 2.5,
            color: 'rgba(150, 240, 255, 0.7)'
        });
    }
}

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

function spawnCrash(x, y) {
    // --- Sound calls removed ---
    racerState.crashed = true; // <-- ### NEW: Set crashed state

    // shards
    const shardCount = 18 + Math.floor(Math.random() * 8);
    for (let i = 0; i < shardCount; i++) {
        racerState.explosionParticles.push({
            type: 'shard', x: x + (Math.random() - 0.5) * 36, y: y + (Math.random() - 0.5) * 18,
            vx: (Math.random() - 0.5) * (4 + Math.random() * 6), vy: -2 - Math.random() * 6,
            life: 40 + Math.random() * 60, size: 4 + Math.random() * 8,
            angle: Math.random() * Math.PI * 2, angularVel: (Math.random() - 0.5) * 0.4,
            color: `hsl(${Math.floor(Math.random()*40)},80%,60%)`
        });
    }
    // smoke
    const smokeCount = 8 + Math.floor(Math.random() * 6);
    for (let i = 0; i < smokeCount; i++) {
        racerState.explosionParticles.push({
            type: 'smoke', x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 1.2, vy: -0.6 - Math.random() * 1.2,
            life: 50 + Math.random() * 50, size: 10 + Math.random() * 20, alpha: 0.45 + Math.random() * 0.15
        });
    }
    spawnParticles(x, y, 'rgba(255,200,120,0.95)', 12);
    racerState.shake.time = 28 + Math.floor(Math.random() * 18);
    racerState.shake.intensity = 6 + Math.random() * 8;
    racerState.flash.alpha = 0.95;
}

function drawParticles() {
    if (!racerCtx) return;

    // Explosion particles
    for (let i = racerState.explosionParticles.length - 1; i >= 0; i--) {
        const p = racerState.explosionParticles[i];
        if (p.type === 'shard') {
            racerCtx.save();
            racerCtx.globalAlpha = Math.max(0, p.life / 120);
            racerCtx.fillStyle = p.color;
            racerCtx.translate(p.x, p.y);
            racerCtx.rotate(p.angle);
            racerCtx.fillRect(-p.size/2, -p.size/3, p.size, Math.max(1, p.size/2));
            racerCtx.restore();
            p.x += p.vx; p.y += p.vy; p.vy += 0.18; p.vx *= 0.995;
            p.angle += p.angularVel; p.life -= 1;
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
            p.x += p.vx; p.y += p.vy; p.vx *= 0.995; p.vy -= 0.01;
            p.size += 0.2; p.life -= 1;
            if (p.life <= 0) racerState.explosionParticles.splice(i, 1);
        }
    }
    // Standard particles
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
            p.x += p.vx; p.y += p.vy; p.vy += 0.08; p.vx *= 0.995;
            p.life -= 1;
            if (p.life <= 0) racerState.particles.splice(i, 1);
        } else if (p.type === 'whoosh') {
            racerCtx.save();
            racerCtx.globalAlpha = Math.max(0, p.life / 35);
            racerCtx.strokeStyle = p.color;
            racerCtx.lineWidth = p.size;
            racerCtx.beginPath();
            racerCtx.moveTo(p.x, p.y);
            racerCtx.lineTo(p.x - p.vx * 2, p.y - p.vy * 2);
            racerCtx.stroke();
            racerCtx.restore();
            p.x += p.vx; p.y += p.vy; p.vy += 0.03;
            p.life -= 1;
            if (p.life <= 0) racerState.particles.splice(i, 1);
        // --- ### NEW: Render logic for engine trail ### ---
        } else if (p.type === 'trail') {
            racerCtx.save();
            racerCtx.globalAlpha = Math.max(0, p.life / p.maxLife);
            racerCtx.strokeStyle = p.color;
            racerCtx.lineWidth = p.size;
            racerCtx.beginPath();
            racerCtx.moveTo(p.x, p.y);
            racerCtx.lineTo(p.x - p.vx * 2.5, p.y - p.vy * 2.5); // Draw line
            racerCtx.stroke();
            racerCtx.restore();
            p.x += p.vx; p.y += p.vy; p.vy += 0.02; // Faint gravity
            p.life -= 1;
            if (p.life <= 0) racerState.particles.splice(i, 1);
        }
    }
}

// --- ### NEW: Draw stars ### ---
function drawStars() {
    if (!racerCtx) return;
    const vpX = racerCanvas.width / 2;
    const vpY = horizonY;

    racerCtx.fillStyle = '#FFFFFF';
    racerState.stars.forEach(star => {
        // Calculate position based on 3D perspective
        const scale = getPerspectiveScale(star.y);
        if (scale <= 0) return; // Don't draw if behind horizon

        // Project star from VP
        const projX = vpX + (star.x - vpX) / (1 - scale * 0.8);
        const projY = vpY + (star.y - vpY) / (1 - scale * 0.8);
        
        const size = star.size * scale;
        
        // Only draw if on screen
        if (projX > 0 && projX < canvasWidth && projY > horizonY && projY < canvasHeight) {
             racerCtx.globalAlpha = Math.min(1, scale * 5); // Fade in
             racerCtx.fillRect(projX - size / 2, projY - size / 2, size, size);
        }
    });
    racerCtx.globalAlpha = 1.0;
}

function drawBackground() {
    if (!racerCtx || !racerCanvas) return;
    // gradient sky
    const gradient = racerCtx.createLinearGradient(0, 0, 0, racerCanvas.height);
    gradient.addColorStop(0, '#000000'); // <-- ### MOD: Pure black at top
    gradient.addColorStop(0.5, '#03010d'); // <-- ### MOD: Dark purple/blue
    gradient.addColorStop(1, '#0a0e24'); // <-- Keep bottom
    racerCtx.fillStyle = gradient;
    racerCtx.fillRect(0, 0, racerCanvas.width, racerCanvas.height);

    // --- ### NEW: Draw stars ### ---
    drawStars();

    drawPerspectiveGrid(); // Back to drawing the static grid

    // edge flash
    let edgeAlpha = 0.06;
    if (racerState.edgeFlash > 0) {
        edgeAlpha = 0.06 + 0.74 * (racerState.edgeFlash / 20);
        racerState.edgeFlash -= 1;
    }
    racerCtx.fillStyle = `rgba(0,255,255,${edgeAlpha})`;
    racerCtx.fillRect(0, 0, 40, racerCanvas.height);
    racerCtx.fillRect(racerCanvas.width - 40, 0, 40, racerCanvas.height);

    // border
    racerCtx.strokeStyle = 'rgba(0,255,255,0.14)';
    racerCtx.lineWidth = 3;
    racerCtx.strokeRect(6, 6, racerCanvas.width - 12, racerCanvas.height - 12);

    // --- Horizontal lines removed as requested ---
}

function drawPerspectiveGrid() {
    if (!racerCtx || !racerCanvas) return;
    const vpX = racerCanvas.width / 2;
    const vpY = 120;
    const bottomY = racerCanvas.height;
    // --- ### MOD: Brighter lines ### ---
    racerCtx.strokeStyle = 'rgba(28, 255, 255, 0.25)'; // Was 0.08
    racerCtx.lineWidth = 2;
    // --- ### MOD: Use new road width constants ### ---
    const numLines = 10;
    for (let i = 0; i <= numLines; i++) {
        const ratio = i / numLines;
        const xTopL = vpX - roadWidthTop * (1 - ratio);
        const xBottomL = vpX - roadWidthAtBottom * (1 - ratio); // <-- MOD
        racerCtx.beginPath(); racerCtx.moveTo(xTopL, vpY); racerCtx.lineTo(xBottomL, bottomY); racerCtx.stroke();
        const xTopR = vpX + roadWidthTop * (1 - ratio);
        const xBottomR = vpX + roadWidthAtBottom * (1 - ratio); // <-- MOD
        racerCtx.beginPath(); racerCtx.moveTo(xTopR, vpY); racerCtx.lineTo(xBottomR, bottomY); racerCtx.stroke();
    }
}

// --- ### MOD: New "streaking" speed lines logic ### ---
function drawSpeedLines() {
    if (!racerCtx) return;
    const vpX = racerCanvas.width / 2;
    const vpY = horizonY;

    racerCtx.strokeStyle = 'rgba(100, 220, 255, 0.4)'; // Brighter
    racerCtx.lineWidth = 1.5;

    racerState.speedLines.forEach(line => {
        // Calculate start and end points based on angle and dist
        const startX = vpX + Math.cos(line.angle) * line.dist;
        const startY = vpY + Math.sin(line.angle) * line.dist;
        const endX = vpX + Math.cos(line.angle) * (line.dist + line.length);
        const endY = vpY + Math.sin(line.angle) * (line.dist + line.length);

        racerCtx.beginPath();
        racerCtx.moveTo(startX, startY);
        racerCtx.lineTo(endX, endY);
        racerCtx.stroke();
    });
}
// --- ### END MOD ### ---

// --- ### MOD: Glow logic updated to use scaling ### ---
function drawGlow() {
    if (!racerCtx) return;

    racerCtx.save();
    racerCtx.shadowBlur = 36; // <-- ### MOD: Was 28 (softer glow)

    // 1. Obstacle Glow
    racerState.obstacles.forEach(ob => {
        // --- Calculate scaled properties ---
        const scale = getPerspectiveScale(ob.y);
        if (scale === 0) return; // Don't draw if above horizon

        const scaledHeight = obstacleHeight * scale;
        const top = ob.y - scaledHeight; // Top edge of the obstacle

        // --- ### MOD: Calculate gap X based on perspective ### ---
        // --- ### MOD: Use new road width constants ### ---
        const roadWidthAtPlayer = (roadWidthAtBottom - roadWidthTop) * scale + roadWidthTop;
        const scaledLaneWidth = roadWidthAtPlayer / 3;
        const scaledGapCenter = (canvasWidth / 2) + (scaledLaneWidth * ob.gapLane);
        const scaledGapWidth = ob.gapWidth * scale;
        // --- End gap calculation ---


        const gapLeft = scaledGapCenter - scaledGapWidth / 2;
        const gapRight = scaledGapCenter + scaledGapWidth / 2;
        // --- End scaling calculations ---

        racerCtx.shadowColor = ob.color;
        racerCtx.fillStyle = 'rgba(0,0,0,0)';
        if (gapLeft > 0) {
            racerCtx.fillRect(0, top, gapLeft, scaledHeight);
        }
        if (gapRight < racerCanvas.width) {
            racerCtx.fillRect(gapRight, top, racerCanvas.width - gapRight, scaledHeight);
        }
    });

    // --- ### MOD: Reverted Player Glow to match original shape ### ---
    racerCtx.shadowColor = '#19d7ff';
    racerCtx.translate(playerCar.x, playerCar.y + playerCar.height * 0.75);
    racerCtx.rotate(racerState.carSway + racerState.carTilt);
    const w = playerCar.width;
    const h = playerCar.height;
    const carY = -h * 0.75;
    racerCtx.fillStyle = 'rgba(0,0,0,0)';
    racerCtx.beginPath();
    racerCtx.moveTo(-w * 0.3, carY + h);
    racerCtx.lineTo(w * 0.3, carY + h);
    racerCtx.quadraticCurveTo(w * 0.45, carY + h * 0.4, w * 0.35, carY + h * 0.1);
    racerCtx.lineTo(0, carY);
    racerCtx.lineTo(-w * 0.35, carY + h * 0.1);
    racerCtx.quadraticCurveTo(-w * 0.45, carY + h * 0.4, -w * 0.3, carY + h);
    racerCtx.closePath();
    racerCtx.fill();
    // --- ### END MOD ### ---

    racerCtx.restore();
}

// --- ### MOD: Reverted Player draw logic ### ---
function drawPlayer(delta) {
    if (!racerCtx) return;

    // --- ### MOD: Calculate targetX based on perspective ### ---
    const playerScale = getPerspectiveScale(playerCar.y); // Scale at player's Y
    // --- ### MOD: Use new road width constants ### ---
    const roadWidthAtPlayer = (roadWidthAtBottom - roadWidthTop) * playerScale + roadWidthTop;
    const scaledLaneWidth = roadWidthAtPlayer / 3;
    const targetX = (canvasWidth / 2) + (scaledLaneWidth * playerCar.lane);
    // --- End targetX calculation ---

    const effectiveDelta = delta || 16.67;
    const lerpAmount = 1 - Math.pow(1 - racerState.laneLerpSpeed, effectiveDelta / 16.67);
    playerCar.x += (targetX - playerCar.x) * lerpAmount;

    const targetTilt = (playerCar.x - targetX) * -0.005;
    const tiltLerp = 1 - Math.pow(1 - racerState.carTiltSpeed, effectiveDelta / 16.67);
    racerState.carTilt += (targetTilt - racerState.carTilt) * tiltLerp;
    racerState.carTilt = Math.max(-racerState.carTiltMax, Math.min(racerState.carTiltMax, racerState.carTilt));

    racerState.carSway = Math.sin(racerState.distance * racerState.carSwaySpeed) * racerState.carSwayMax;

    racerCtx.save();
    racerCtx.translate(playerCar.x, playerCar.y + playerCar.height * 0.75);
    racerCtx.rotate(racerState.carSway + racerState.carTilt);

    const w = playerCar.width;
    const h = playerCar.height;
    const carY = -h * 0.75;

    // Main body (tapered shape)
    racerCtx.fillStyle = '#19d7ff';
    racerCtx.beginPath();
    racerCtx.moveTo(-w * 0.3, carY + h);
    racerCtx.lineTo(w * 0.3, carY + h);
    racerCtx.quadraticCurveTo(w * 0.45, carY + h * 0.4, w * 0.35, carY + h * 0.1);
    racerCtx.lineTo(0, carY);
    racerCtx.lineTo(-w * 0.35, carY + h * 0.1);
    racerCtx.quadraticCurveTo(-w * 0.45, carY + h * 0.4, -w * 0.3, carY + h);
    racerCtx.closePath();
    racerCtx.fill();

    // "Cockpit" (darker)
    racerCtx.fillStyle = '#0b1f3a';
    racerCtx.beginPath();
    racerCtx.moveTo(-w * 0.15, carY + h * 0.8);
    racerCtx.lineTo(w * 0.15, carY + h * 0.8);
    racerCtx.quadraticCurveTo(w * 0.25, carY + h * 0.5, 0, carY + h * 0.2);
    racerCtx.quadraticCurveTo(-w * 0.25, carY + h * 0.5, -w * 0.15, carY + h * 0.8);
    racerCtx.closePath();
    racerCtx.fill();

    // Center highlight
    racerCtx.fillStyle = '#3be7ff';
    racerCtx.fillRect(-w * 0.05, carY + h * 0.2, w * 0.1, h * 0.6);

    racerCtx.restore();
}
// --- ### END MOD ### ---

// --- ### MOD: Obstacle draw logic updated to use scaling ### ---
function drawObstacles() {
    if (!racerCtx) return;

    // Sort obstacles so nearest are drawn last (on top)
    racerState.obstacles.sort((a, b) => a.y - b.y);

    racerState.obstacles.forEach(ob => {
        // --- Calculate scaled properties ---
        const scale = getPerspectiveScale(ob.y);
        if (scale <= 0.01) return; // Don't draw if at/behind horizon

        const scaledHeight = obstacleHeight * scale;
        // Adjust top so the *bottom* of the obstacle moves with `ob.y`
        const top = ob.y - scaledHeight;

        // --- ### MOD: Calculate gap X based on perspective ### ---
        // --- ### MOD: Use new road width constants ### ---
        const roadWidthAtPlayer = (roadWidthAtBottom - roadWidthTop) * scale + roadWidthTop;
        const scaledLaneWidth = roadWidthAtPlayer / 3;
        const scaledGapCenter = (canvasWidth / 2) + (scaledLaneWidth * ob.gapLane);
        const scaledGapWidth = ob.gapWidth * scale;
        // --- End gap calculation ---

        const gapLeft = scaledGapCenter - scaledGapWidth / 2;
        const gapRight = scaledGapCenter + scaledGapWidth / 2;

        const edgeHeight = 6 * scale; // <-- ### MOD: Was 4 * scale (thicker edge)
        // --- End scaling calculations ---

        // left chunk
        if (gapLeft > 0) {
            racerCtx.fillStyle = ob.color;
            racerCtx.fillRect(0, top + edgeHeight, gapLeft, scaledHeight - edgeHeight);
            racerCtx.fillStyle = `hsl(${ob.hue}, 100%, 85%)`; // <-- ### MOD: Was 90%, 75% (brighter)
            racerCtx.fillRect(0, top, gapLeft, edgeHeight);
        }
        // right chunk
        if (gapRight < racerCanvas.width) {
            racerCtx.fillStyle = ob.color;
            racerCtx.fillRect(gapRight, top + edgeHeight, canvasWidth - gapRight, scaledHeight - edgeHeight);
            racerCtx.fillStyle = `hsl(${ob.hue}, 100%, 85%)`; // <-- ### MOD: Was 90%, 75% (brighter)
            racerCtx.fillRect(gapRight, top, canvasWidth - gapRight, edgeHeight);
        }
    });
}

function spawnObstacle() {
    // --- ### MOD: Store lane (-1, 0, 1) instead of center ### ---
    const lanes = [-1, 0, 1];
    const gapLane = lanes[Math.floor(Math.random() * lanes.length)];
    const colorHue = Math.floor(Math.random() * 360);

    const currentGapMultiplier = Math.max(
        racerState.gapWidthMinMultiplier,
        racerState.gapWidthStartMultiplier - (racerState.dodged * racerState.gapWidthTightenRate)
    );
    // Base width is now based on car's base width, not lane width
    let gapWidth = playerCar.baseWidth * currentGapMultiplier;

    // --- ### MOD: Fix for gap size vs player size ### ---
    // Ensure the gap is ALWAYS wider than the MAXIMUM possible player width
    const maxPlayerWidth = playerCar.baseWidth * 1.3; // From updateRacer
    gapWidth = Math.max(gapWidth, maxPlayerWidth + 20); // Safety net
    // --- ### END MOD ### ---

    gapWidth = Math.min(gapWidth, 250); // Max gap width in "world" units

    racerState.obstacles.push({
        y: horizonY, // <-- ### MOD: Spawn at horizon
        gapLane: gapLane, // <-- ### MOD: Store lane
        gapWidth: gapWidth, // <-- ### MOD: Store base gap width
        color: `hsl(${colorHue}, 90%, 60%)`,
        hue: colorHue
    });

    const dynamicForwardTime = Math.max(
        racerState.spawnMinTime,
        racerState.spawnStartTime - racerState.dodged * racerState.spawnTimeTightenRate
    );
    racerState.spawnTimer = dynamicForwardTime + Math.random() * racerState.spawnTimeVariance;

    racerState.edgeFlash = 20;
}

function resetObstacles() {
    racerState.obstacles = [];
    racerState.spawnTimer = 0;
}

// --- ### MOD: New logic for radial speed lines ### ---
function ensureSpeedLines() {
    if (!racerCanvas) return;
    while (racerState.speedLines.length < 40) { // Was 14
        racerState.speedLines.push({
            angle: Math.random() * Math.PI * 2, // Angle from VP
            dist: 5 + Math.random() * 50,      // Distance from VP
            length: 18 + Math.random() * 28,
            speed: 0.5 + Math.random() * 0.5 // Speed multiplier
        });
    }
}
// --- ### END MOD ### ---

// --- ### NEW: Starfield generation ### ---
function ensureStars() {
    if (!racerCanvas) return;
    while (racerState.stars.length < 100) {
        racerState.stars.push({
            x: Math.random() * canvasWidth * 2 - canvasWidth, // Spread around VP
            y: horizonY + Math.random() * (canvasHeight - horizonY),
            size: 0.5 + Math.random() * 1.5,
            speed: 0.1 + Math.random() * 0.1 // Slower parallax speed
        });
    }
}
// --- ### END NEW ### ---

function applyShakeTransform() {
    if (!racerCtx) return {dx:0, dy:0};
    if (racerState.shake.time > 0) {
        const intensity = racerState.shake.intensity;
        const dx = (Math.random() - 0.5) * intensity;
        const dy = (Math.random() - 0.5) * intensity;
        racerCtx.translate(dx, dy);
        racerState.shake.time -= 1;
        racerState.shake.intensity *= 0.985;
        return {dx, dy};
    }
    return {dx:0, dy:0};
}

function startCrashAnimation() {
    if (racerState.crashAnimId) {
        cancelAnimationFrame(racerState.crashAnimId);
        racerState.crashAnimId = null;
    }
    const loop = (timestamp) => {
        const delta = timestamp - (racerState.lastCrashTimestamp || timestamp);
        racerState.lastCrashTimestamp = timestamp;
        renderRacer(delta); // Will re-render the static car + particles
        const activeParticles = (racerState.explosionParticles.length > 0) || (racerState.particles.length > 0);
        const activeShake = racerState.shake.time > 0;
        const activeFlash = racerState.flash.alpha > 0.02;
        if (activeParticles || activeShake || activeFlash) {
            racerState.crashAnimId = requestAnimationFrame(loop);
        } else {
            racerState.flash.alpha = 0;
            racerState.crashAnimId = null;
        }
    };
    racerState.lastCrashTimestamp = performance.now();
    racerState.crashAnimId = requestAnimationFrame(loop);
}

function updateRacer(delta) {
    if (!racerCanvas || racerState.crashed) return; // <-- ### MOD: Stop update if crashed

    const speedInPxPerSecond = racerState.speed * 1.5;
    const traveled = (speedInPxPerSecond * (delta / 1000));
    
    // Base speed increase
    const baseSpeed = 180 + racerState.dodged * 6 + Math.floor(racerState.distance / 800);
    racerState.speed = Math.min(520, baseSpeed);
    racerState.distance += traveled;

    // --- Engine pitch update removed ---

    racerState.spawnTimer -= delta;

    if (racerState.spawnTimer <= 0) {
        spawnObstacle();
    }

    // Move obstacles
    racerState.obstacles.forEach(ob => {
        ob.y += traveled;
    });

    // Filter obstacles and handle dodges
    racerState.obstacles = racerState.obstacles.filter(ob => {
        if (ob.y > racerCanvas.height + obstacleHeight) { // Wait until it's fully off-screen
            racerState.dodged += 1;
            // Spawn whoosh near center
            spawnWhooshLines(canvasWidth / 2, racerCanvas.height - 40);
            // --- playSound removed ---

            // --- NEW --- Add small dodge-shake
            racerState.shake.time = 8;
            racerState.shake.intensity = 2;

            // Player width scaling (keep this, it looks cool)
            const scale = Math.min(1.3, 1 + racerState.dodged * 0.02);
            playerCar.width = playerCar.baseWidth * scale;

            if (racerState.dodged > 0 && racerState.dodged % 10 === 0) {
                //racerState.speed = Math.min(520, racerState.speed + 24); // Handled by baseSpeed
                if (racerMessageEl) racerMessageEl.textContent = `Boost! Speed increased.`;
            }
            return false;
        }
        return true;
    });

    // --- ### MOD: Update radial speed lines ### ---
    const speedMod = (racerState.speed / 180); // Speed multiplier
    racerState.speedLines.forEach(line => {
        line.dist += traveled * 0.08 * line.speed * speedMod; // Move outward
        line.length = 18 + Math.random() * 28 + line.dist * 0.1; // Get longer as they move out

        if (line.dist > canvasWidth) { // Reset if too far
            line.dist = 5 + Math.random() * 10;
            line.angle = Math.random() * Math.PI * 2;
            line.speed = 0.5 + Math.random() * 0.5;
        }
    });
    ensureSpeedLines(); // Call this
    // --- ### END MOD ### ---
    
    // --- ### NEW: Update stars ### ---
    racerState.stars.forEach(star => {
        star.y += traveled * star.speed; // Move stars
        if (star.y > canvasHeight) {
            star.y = horizonY;
            star.x = Math.random() * canvasWidth * 2 - canvasWidth;
        }
    });
    ensureStars();
    // --- ### END NEW ### ---

    // --- ### MOD: Spawn new engine trail particles ### ---
    if (racerState.running) {
        const trailX = playerCar.x + (Math.random() - 0.5) * (playerCar.width * 0.2);
        const trailY = playerCar.y + playerCar.height - 10; // Start higher
        const life = 15 + Math.random() * 20;
        racerState.particles.push({
             type: 'trail', x: trailX, y: trailY,
             vx: (Math.random() - 0.5) * 0.4, vy: 2.0 + Math.random() * 1.5,
             life: life, maxLife: life, size: 1 + Math.random() * 2,
             color: `rgba(50, 220, 255, ${0.4 + Math.random() * 0.3})`
        });
    }
    // --- ### END MOD ### ---


    // --- ### MOD: Collision Check with Scaling ### ---
    const carCenter = playerCar.x;
    const carLeft = carCenter - playerCar.width / 2;
    const carRight = carCenter + playerCar.width / 2;
    const carTop = playerCar.y;
    const carBottom = playerCar.y + playerCar.height;

    for (const ob of racerState.obstacles) {
        // --- Calculate scaled properties ---
        const scale = getPerspectiveScale(ob.y);
        const scaledHeight = obstacleHeight * scale;
        const obTop = ob.y - scaledHeight;
        const obBottom = ob.y;

        // --- ### MOD: Calculate gap X based on perspective ### ---
        // --- ### MOD: Use new road width constants ### ---
        const roadWidthAtPlayer = (roadWidthAtBottom - roadWidthTop) * scale + roadWidthTop;
        const scaledLaneWidth = roadWidthAtPlayer / 3;
        const scaledGapCenter = (canvasWidth / 2) + (scaledLaneWidth * ob.gapLane);
        const scaledGapWidth = ob.gapWidth * scale;
        // --- End gap calculation ---

        const gapLeft = scaledGapCenter - scaledGapWidth / 2;
        const gapRight = scaledGapCenter + scaledGapWidth / 2;
        // --- End scaling calculations ---

        if (carBottom <= obTop || carTop >= obBottom) continue;

        if (carLeft < gapLeft || carRight > gapRight) {
            if (racerState.animationFrame) {
                cancelAnimationFrame(racerState.animationFrame);
                racerState.animationFrame = null;
            }
            saveRacerHighScore();
            spawnCrash(playerCar.x, playerCar.y + playerCar.height / 2);
            racerState.running = false;
            startCrashAnimation();
            if (racerMessageEl) {
                racerMessageEl.textContent = 'Crash! Reset to roll out again.';
            }
            return;
        }
    }
}

function renderRacer(delta) {
    if (!racerCtx) return;

    racerCtx.save();
    
    // --- ### NEW: Subtle speed shake ### ---
    if(racerState.running) {
        const speedShake = (racerState.speed / 520) * 0.75; // Max 0.75px shake
        racerCtx.translate((Math.random() - 0.5) * speedShake, (Math.random() - 0.5) * speedShake);
    }
    // --- ### END NEW ### ---
    
    applyShakeTransform(); // Crash shake

    // Draw world
    drawBackground();
    drawSpeedLines(); // <-- ### MOD: Draws new radial lines

    // --- ### MOD: REMOVED CLIPPING ### ---
    // This allows obstacles to be drawn from the VP
    
    // --- Draw glow layer *under* main objects
    drawGlow();

    // Draw main objects
    drawObstacles();

    // --- ### END MOD ### ---

    drawPlayer(delta); // Draw player on top of road

    // Draw effects on top
    drawParticles();

    // Draw flash overlay
    if (racerState.flash.alpha > 0) {
        racerCtx.fillStyle = `rgba(255,255,255,${racerState.flash.alpha})`;
        racerCtx.fillRect(0, 0, racerCanvas.width, racerCanvas.height);
        racerState.flash.alpha *= 0.92;
        if (racerState.flash.alpha < 0.02) racerState.flash.alpha = 0;
    }
    racerCtx.restore();
}

function gameLoop(timestamp) {
    // <-- ### MOD: Stop game loop if crashed ### ---
    if (!racerState.running && !racerState.crashed) return;

    const delta = timestamp - (racerState.lastTimestamp || timestamp);
    racerState.lastTimestamp = timestamp;

    if (racerState.running) { // Only update if not crashed
        updateRacer(delta);
    }

    renderRacer(delta); // Always render (for crash animation)

    updateHud();

    // <-- ### MOD: Stop requesting frames if crashed ### ---
    if (racerState.running) {
        racerState.animationFrame = requestAnimationFrame(gameLoop);
    }
}

function startRacer() {
    if (racerState.running) return;

    // If just reset from a crash, just start
    if (racerState.crashed) {
        resetRacer();
    }

    if (racerMessageEl) {
        racerMessageEl.textContent = 'Neon boost engaged!';
    }
    racerState.running = true;
    racerState.crashed = false; // Ensure not crashed
    racerState.lastTimestamp = performance.now();
    racerState.spawnTimer = racerState.spawnStartTime;

    // --- Audio start removed ---

    if (racerState.animationFrame) {
        cancelAnimationFrame(racerState.animationFrame);
    }
    racerState.animationFrame = requestAnimationFrame(gameLoop);
}

function pauseRacer() {
    if (!racerState.running) return; // Can't pause if not running
    racerState.running = false;
    if (racerState.animationFrame) {
        cancelAnimationFrame(racerState.animationFrame);
        racerState.animationFrame = null;
    }
    if (racerMessageEl) {
        racerMessageEl.textContent = 'Paused. Hit start to keep racing.';
    }
    // --- Audio pause removed ---
}

function resetRacer() {
    if (racerState.crashAnimId) {
        cancelAnimationFrame(racerState.crashAnimId);
        racerState.crashAnimId = null;
    }
    pauseRacer();

    // --- Audio reset removed ---

    playerCar.lane = 0; // <-- ### MOD: Reset to center lane
    playerCar.baseWidth = laneWidth * 0.55;
    playerCar.width = playerCar.baseWidth;
    playerCar.x = canvasWidth / 2; // <-- ### MOD: Reset to center X
    playerCar.height = 58;

    racerState.speed = 180;
    racerState.distance = 0;
    racerState.dodged = 0;
    racerState.speedLines = []; // <-- ### MOD: Reset new speed lines
    racerState.stars = []; // <-- ### NEW: Reset stars
    racerState.particles = [];
    racerState.explosionParticles = [];
    racerState.shake = { time: 0, intensity: 0 };
    racerState.flash = { alpha: 0 };
    racerState.carSway = 0;
    racerState.carTilt = 0;
    racerState.edgeFlash = 0;
    racerState.crashed = false; // <-- ### MOD: Reset crashed state

    resetObstacles();
    ensureSpeedLines(); // <-- ### MOD: Init new speed lines
    ensureStars(); // <-- ### NEW: Init stars
    renderRacer(0); // Render a single frame
    updateHud();
    if (racerMessageEl) {
        racerMessageEl.textContent = 'Ready! Use ← and → to slide through the gaps.';
    }
}

// --- ### MOD: Lane shifting logic updated ### ---
function shiftLane(offset) {
    if (racerState.crashed) return; // <-- ### MOD: Don't allow steering if crashed

    const nextLane = Math.min(1, Math.max(-1, playerCar.lane + offset));
    if (nextLane === playerCar.lane) return;
    playerCar.lane = nextLane;
    if (!racerState.running) {
        renderRacer(0); // Re-render to new position
        updateHud();
    }
}

function handleKey(event) {
    if (!racerModal || racerModal.style.display !== 'flex') return;
    if (racerState.crashed) return; // <-- ### MOD: Don't allow steering if crashed

    if (event.key === 'ArrowLeft') {
        shiftLane(-1);
        event.preventDefault();
    }
    if (event.key === 'ArrowRight') {
        shiftLane(1);
        event.preventDefault();
    }
}

// --- Functions to manage Racer high score ---
function loadRacerHighScore() {
    racerState.mostGapsCleared = parseInt(localStorage.getItem('racer+mostGapsCleared')) || 0;
}

function saveRacerHighScore() {
    if (racerState.dodged > racerState.mostGapsCleared) {
        racerState.mostGapsCleared = racerState.dodged;
        localStorage.setItem('racer+mostGapsCleared', racerState.mostGapsCleared);
    }
}
// --- End of new functions ---

function updateHud() {
    if (racerDistanceEl) racerDistanceEl.textContent = `Distance: ${Math.floor(racerState.distance)}m`;
    if (racerSpeedEl) racerSpeedEl.textContent = `Speed: ${Math.floor(racerState.speed)} mph`;
    if (racerObstaclesEl) racerObstaclesEl.textContent = `Gaps cleared: ${racerState.dodged} | High: ${racerState.mostGapsCleared}`;
}

// --- INIT RACER ---
function initRacerGame() {
    if (startRacerBtn) startRacerBtn.addEventListener('click', startRacer);
    if (pauseRacerBtn) pauseRacerBtn.addEventListener('click', pauseRacer);
    if (resetRacerBtn) resetRacerBtn.addEventListener('click', resetRacer);

    // --- Sound button logic removed ---

    // --- Audio properties removed ---

    if (!document.__racerBound) {
        document.addEventListener('keydown', handleKey);
        document.__racerBound = true;
    }

    if (racerCanvas) {
        loadRacerHighScore(); // Load high score on init
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
  bullet: { x: 0, y: 0, width: 4, height: 14, active: false, alive: false, speed: 24 },//14
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

  // Lives UI: show two boxes at start; when hit, show one at left and one on the side.
  // This still represents 3 total lives (active ship + two reserve boxes).
  const lifeBoxW = 14;
  const lifeBoxH = 10;
  const lifeLeftX = 10;
  const lifeY = invadersCanvas.height - 28;

  invadersCtx.fillStyle = '#00FFFF';
  // lives mapping:
  // lives === 3 -> two boxes at left
  // lives === 2 -> one box at left, and one "on the side" (STATIC)
  // lives === 1 -> one "on the side" (STATIC)
  if (state.player.lives >= 3) {
    // two reserve boxes shown on the left
    invadersCtx.fillRect(lifeLeftX, lifeY, lifeBoxW, lifeBoxH);
    invadersCtx.fillRect(lifeLeftX + lifeBoxW + 8, lifeY, lifeBoxW, lifeBoxH);
  } else if (state.player.lives === 2) {
    // one reserve left, and one "on the side" placed at a fixed side position (no longer tied to player.x)
    invadersCtx.fillRect(lifeLeftX, lifeY, lifeBoxW, lifeBoxH);
    const sideX = Math.min(invadersCanvas.width - lifeBoxW - 8, lifeLeftX + 60);
    invadersCtx.fillRect(sideX, lifeY, lifeBoxW, lifeBoxH);
  } else if (state.player.lives === 1) {
    // only the side box remains to indicate the last life (STATIC)
    const sideX = Math.min(invadersCanvas.width - lifeBoxW - 8, lifeLeftX + 60);
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
