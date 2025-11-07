// --- TETRIS GAME SCRIPT ---
// Global variable declarations (no initial assignment)
let tetrisModal;
let runTetrisBtn;
let modalCloseBtn;
let canvas;
let ctx;
let scoreP;
let startBtn;
let controlsBtn;

// --- NEON RACER SCRIPT (ELEMENTS) ---
let racerModal;
let runRacerBtn;
let racerModalCloseBtn;
let racerCanvas;
let racerCtx;
let racerDistanceEl;
let racerSpeedEl;
let racerObstaclesEl;
let racerMessageEl;
let startRacerBtn;
let pauseRacerBtn;
let resetRacerBtn;
let toggleSoundBtn;
let racerMusic;
let racerEngine;
let racerDodgeSfx;
let racerCrashSfx;
let allAudio = [];

// --- FULL INVADERS SCRIPT (ELEMENTS) ---
let invadersModal;
let runInvadersBtn;
let invadersModalCloseBtn;
let invadersCanvas;
let invadersCtx;
let invadersMessageEl;
let startInvadersBtn;
let invadersScoreEl;


// --- MODAL HANDLING (TETRIS) ---
function closeModal() {
  if (!tetrisModal) return;
  tetrisModal.style.display = 'none';
  // Stop the game when closing
  if (game) {
    clearInterval(game);
    game = null;
  }
  block = null; // Clear active block
  // Clear canvas
  if (ctx && canvas) {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}
// --- MODAL HANDLING (RACER) ---
function closeRacerModal() {
  if (!racerModal) return;
  racerModal.style.display = 'none';
  if (typeof pauseRacer === 'function') {
    pauseRacer();
  }
}
// --- MODAL HANDLING (INVADERS) ---
function closeInvadersModal() {
  if (!invadersModal) return;
  invadersModal.style.display = 'none';
  if (typeof stopInvaders === 'function') {
    stopInvaders();
  }
}


// --- TETRIS GAME LOGIC (Rest of Tetris logic remains the same, using global variables) ---
const box = 24;
const speed = 50; 
let fastFall = false;
let score = 0;
let highScore;

const TETRIS_PLUS_HIGH_SCORE_KEY = 'tetrisPlusHighScore';

function updateScoreDisplay() {
  if(scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
}

function loadHighScore() {
  highScore = parseInt(localStorage.getItem(TETRIS_PLUS_HIGH_SCORE_KEY)) || 0;
  updateScoreDisplay();
}

function gameOverTetris() {
  if (game) clearInterval(game);
  game = null;
  if (startBtn) startBtn.textContent = 'Start';

  let message = 'Game Over! Score: ' + score;

  if (score > highScore) {
    highScore = score;
    localStorage.setItem(TETRIS_PLUS_HIGH_SCORE_KEY, highScore);
    message = 'Game Over! New high score: ' + score;
  }

  alert(message);
  updateScoreDisplay(); 
  
  score = 0;
}

let block;
let rows;
let game;
let count;
let currentLevel = 0;
const colorPalettes = [
  { fill: '#00FFFF', stroke: '#33FFFF', shadow: '#00FFFF' }, 
  { fill: '#FF00FF', stroke: '#FF33FF', shadow: '#FF00FF' }, 
  { fill: '#00FF00', stroke: '#33FF33', shadow: '#00FF00' }, 
  { fill: '#FFA500', stroke: '#FFB733', shadow: '#FFA500' }, 
  { fill: '#FFFF00', stroke: '#FFFF33', shadow: '#FFFF00' }, 
  { fill: '#9D00FF', stroke: '#8C00E6', shadow: '#9D00FF' }, 
  { fill: '#FD1C03', stroke: '#E41903', shadow: '#FD1C03' }, 
  { fill: '#FF69B4', stroke: '#E6529E', shadow: '#FF69B4' }, 
  { fill: '#F0F0F0', stroke: '#D9D9D9', shadow: '#F0F0F0' }  
];

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
  if (!ctx || !canvas) return; 
  
  if (!block) {
    let blockPoolSize = 7 + currentLevel;
    if (blockPoolSize > 12) blockPoolSize = 12; 
    
    let newBlockIndex = Math.floor(Math.random() * blockPoolSize);
    block = [all_blocks[newBlockIndex], 4, 0];

    if (isColliding(block)) {
      gameOverTetris();
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
          
          let newLevel = Math.floor(score / 50);

          if (newLevel > currentLevel) {
              currentLevel = newLevel;
          }
          
          updateScoreDisplay();
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
  
  ctx.shadowBlur = 0;
  count -= 1;
}

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
    if (!runTetrisBtn) return; // Only init if the button exists

    runTetrisBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if(tetrisModal) tetrisModal.style.display = 'flex';
      if (typeof loadHighScore === 'function') {
        loadHighScore();
      }
      if(startBtn) startBtn.textContent = 'Start';
    });

    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (tetrisModal) {
        tetrisModal.addEventListener('click', function(e) {
          if (e.target === tetrisModal) {
            closeModal();
          }
        });
    }

    if (startBtn) startBtn.addEventListener('click', start);
    if (controlsBtn) controlsBtn.addEventListener('click', function() {
      alert('Controls:\nRight Arrow: Right\nLeft Arrow: Left\nSpace Bar: Rotate\nDown Arrow: Speed Up Fall');
    });
    
    loadHighScore();
}

// --- NEON RACER SCRIPT (LOGIC) ---

const laneCount = 3;
let laneWidth = 100;

const playerCar = {
    lane: 1,
    baseWidth: 55,
    width: 55,
    height: 58,
    y: 410,
    x: 0
};
const GAPS_HIGH_SCORE_KEY = 'racerMostGapsCleared';
let racerMostGapsCleared = 0; 
const racerState = {
    running: false,
    lastTimestamp: 0,
    speed: 180,
    distance: 0,
    dodged: 0, 
    obstacles: [],
    speedLines: [],
    spawnTimer: 0, 
    animationFrame: null,

    spawnStartTime: 1800,
    spawnMinTime: 650,
    spawnTimeVariance: 200,
    spawnTimeTightenRate: 20,
    gapWidthStartMultiplier: 1.7,
    gapWidthMinMultiplier: 1.2,
    gapWidthTightenRate: 0.02,

    particles: [],
    explosionParticles: [],
    laneLerpSpeed: 0.18,
    shake: { time: 0, intensity: 0 },
    flash: { alpha: 0 },
    crashAnimId: null,

    carSway: 0,
    carSwaySpeed: 0.008,
    carSwayMax: 0.035,
    carTilt: 0,
    carTiltMax: 0.1,
    carTiltSpeed: 0.1,
    
    edgeFlash: 0,
    sound: false 
};
const obstacleHeight = 60;
let laneCenters = [];


function toggleSound() {
    if (!racerMusic || !racerEngine) return;
    racerState.sound = !racerState.sound;
    if (racerState.sound) {
        toggleSoundBtn.textContent = 'Mute';
        toggleSoundBtn.classList.add('active');
        if (racerMusic) racerMusic.play().catch(e => console.log("Audio play failed"));
        if (racerState.running && racerEngine) {
            racerEngine.play().catch(e => console.log("Audio play failed"));
        }
    } else {
        toggleSoundBtn.textContent = 'Unmute';
        toggleSoundBtn.classList.remove('active');
        allAudio.forEach(audio => audio ? audio.pause() : null);
    }
}

function playSound(sound) {
    if (!sound || !racerState.sound) return;
    sound.currentTime = 0;
    sound.play().catch(e => console.log("SFX play failed"));
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
    playSound(racerCrashSfx);
    
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
            p.y += p.vy; p.vy += 0.08; p.vx *= 0.995;
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
            p.x += p.vx; p.y += p.vy;
            p.vy += 0.03;
            p.life -= 1;
            if (p.life <= 0) racerState.particles.splice(i, 1);
        }
    }
}

function drawBackground() {
    if (!racerCtx || !racerCanvas) return;
    const gradient = racerCtx.createLinearGradient(0, 0, 0, racerCanvas.height);
    gradient.addColorStop(0, '#03051a');
    gradient.addColorStop(0.6, '#050417');
    gradient.addColorStop(1, '#0a0e24');
    racerCtx.fillStyle = gradient;
    racerCtx.fillRect(0, 0, racerCanvas.width, racerCanvas.height);

    drawPerspectiveGrid();

    let edgeAlpha = 0.06;
    if (racerState.edgeFlash > 0) {
        edgeAlpha = 0.06 + 0.74 * (racerState.edgeFlash / 20);
        racerState.edgeFlash -= 1;
    }
    racerCtx.fillStyle = `rgba(0,255,255,${edgeAlpha})`;
    racerCtx.fillRect(0, 0, 40, racerCanvas.height);
    racerCtx.fillRect(racerCanvas.width - 40, 0, 40, racerCanvas.height);

    racerCtx.strokeStyle = 'rgba(0,255,255,0.14)';
    racerCtx.lineWidth = 3;
    racerCtx.strokeRect(6, 6, racerCanvas.width - 12, racerCanvas.height - 12);

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

function drawPerspectiveGrid() {
    if (!racerCtx || !racerCanvas) return;
    const vpX = racerCanvas.width / 2;
    const vpY = 120;
    const bottomY = racerCanvas.height;
    racerCtx.strokeStyle = 'rgba(28, 255, 255, 0.08)';
    racerCtx.lineWidth = 2;
    const roadWidthTop = racerCanvas.width * 0.1;
    const roadWidthBottom = racerCanvas.width * 1.2;
    const numLines = 10;
    for (let i = 0; i <= numLines; i++) {
        const ratio = i / numLines;
        const xTopL = vpX - roadWidthTop * (1 - ratio);
        const xBottomL = vpX - roadWidthBottom * (1 - ratio);
        racerCtx.beginPath(); racerCtx.moveTo(xTopL, vpY); racerCtx.lineTo(xBottomL, bottomY); racerCtx.stroke();
        const xTopR = vpX + roadWidthTop * (1 - ratio);
        const xBottomR = vpX + roadWidthBottom * (1 - ratio);
        racerCtx.beginPath(); racerCtx.moveTo(xTopR, vpY); racerCtx.lineTo(xBottomR, bottomY); racerCtx.stroke();
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

function drawObstacleMarkers() {
    if (!racerCtx || !racerState.running || !racerCanvas) return;

    racerState.obstacles.forEach(ob => {
        if (ob.y < racerCanvas.height * 0.6) { 
            racerCtx.save();
            racerCtx.strokeStyle = `hsl(${ob.hue}, 90%, 60%)`;
            racerCtx.lineWidth = 1.5;
            racerCtx.globalAlpha = 0.35 * (1 - ob.y / (racerCanvas.height * 0.6)); 
            
            racerCtx.beginPath();
            racerCtx.moveTo(0, ob.y + obstacleHeight * 0.5); 
            racerCtx.lineTo(racerCanvas.width, ob.y + obstacleHeight * 0.5);
            racerCtx.stroke();
            
            racerCtx.restore();
        }
    });
}

function drawGlow() {
    if (!racerCtx || !racerCanvas) return;
    racerCtx.save();
    racerCtx.shadowBlur = 28;
    
    racerState.obstacles.forEach(ob => {
        racerCtx.shadowColor = ob.color;
        const top = ob.y;
        const gapLeft = ob.gapCenter - ob.gapWidth / 2;
        const gapRight = ob.gapCenter + ob.gapWidth / 2;
        racerCtx.fillStyle = 'rgba(0,0,0,0)'; 
        
        if (gapLeft > 0) {
            racerCtx.fillRect(0, top, gapLeft, obstacleHeight);
        }
        if (gapRight < racerCanvas.width) {
            racerCtx.fillRect(gapRight, top, racerCanvas.width - gapRight, obstacleHeight);
        }
    });

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
    
    racerCtx.restore();
}

function drawPlayer(delta) {
    if (!racerCtx) return;

    const targetX = laneCenters[playerCar.lane];
    const effectiveDelta = delta || 16.67; 
    const lerpAmount = 1 - Math.pow(1 - racerState.laneLerpSpeed, effectiveDelta / 16.67);
    playerCar.x += (targetX - playerCar.x) * lerpAmount;

    const targetTilt = (playerCar.x - targetX) * -0.005;
    const tiltLerp = 1 - Math.pow(1 - racerState.carTiltSpeed, effectiveDelta / 16.67);
    racerState.carTilt += (targetTilt - racerState.carTilt) * tiltLerp;
    racerState.carTilt = Math.max(-racerState.carTiltMax, Math.min(racerState.carTiltMax, racerState.carTilt));

    racerState.carSway = Math.sin(performance.now() * racerState.carSwaySpeed) * racerState.carSwayMax;
    
    racerCtx.save();
    racerCtx.translate(playerCar.x, playerCar.y + playerCar.height * 0.75);
    racerCtx.rotate(racerState.carSway + racerState.carTilt);

    const w = playerCar.width;
    const h = playerCar.height;
    const carY = -h * 0.75; 
    
    racerCtx.fillStyle = '#00FFFF';
    racerCtx.strokeStyle = '#00FFFF';
    racerCtx.lineWidth = 2;

    racerCtx.beginPath();
    racerCtx.moveTo(-w * 0.3, carY + h);
    racerCtx.lineTo(w * 0.3, carY + h);
    racerCtx.quadraticCurveTo(w * 0.45, carY + h * 0.4, w * 0.35, carY + h * 0.1);
    racerCtx.lineTo(0, carY);
    racerCtx.lineTo(-w * 0.35, carY + h * 0.1);
    racerCtx.quadraticCurveTo(-w * 0.45, carY + h * 0.4, -w * 0.3, carY + h);
    racerCtx.closePath();
    racerCtx.fill();
    racerCtx.stroke();
    
    racerCtx.restore();
}

function drawObstacles() {
    if (!racerCtx || !racerCanvas) return;
    
    drawObstacleMarkers();
    
    racerState.obstacles.forEach(ob => {
        racerCtx.fillStyle = ob.color;
        
        const top = ob.y;
        const gapLeft = ob.gapCenter - ob.gapWidth / 2;
        const gapRight = ob.gapCenter + ob.gapWidth / 2;

        if (gapLeft > 0) {
            racerCtx.fillRect(0, top, gapLeft, obstacleHeight);
        }
        if (gapRight < racerCanvas.width) {
            racerCtx.fillRect(gapRight, top, racerCanvas.width - gapRight, obstacleHeight);
        }
    });
}

function spawnObstacle() {
    if (!racerCanvas) return;
    
    let gapLane;
    const lastLane = racerState.obstacles.length > 0 ? racerState.obstacles[racerState.obstacles.length - 1].gapLane : -1;
    do {
        gapLane = Math.floor(Math.random() * laneCount);
    } while (gapLane === lastLane);
    
    let colorHue = Math.floor(Math.random() * 360);
    const currentGapMultiplier = Math.max(
        racerState.gapWidthMinMultiplier,
        racerState.gapWidthStartMultiplier - (racerState.dodged * racerState.gapWidthTightenRate)
    );
    let gapWidth = playerCar.width * currentGapMultiplier;
    gapWidth = Math.max(gapWidth, playerCar.width + 6);
    gapWidth = Math.min(gapWidth, Math.max(60, racerCanvas.width - 24));
    
    let gapCenter = laneCenters[gapLane];
    const half = gapWidth / 2;
    gapCenter = Math.max(half + 8, Math.min(racerCanvas.width - half - 8, gapCenter));
    
    racerState.obstacles.push({ y: -obstacleHeight, gapCenter, gapWidth, color: `hsl(${colorHue}, 90%, 60%)`, hue: colorHue });
    
    const dynamicForwardTime = Math.max(
        racerState.spawnMinTime,
        racerState.spawnStartTime - racerState.dodged * racerState.spawnTimeTightenRate
    );
    racerState.spawnTimer = dynamicForwardTime + Math.random() * racerState.spawnTimeVariance;
    
    racerState.edgeFlash = 20;
}

function resetObstacles() { racerState.obstacles = []; racerState.spawnTimer = 0; }
function ensureSpeedLines() { 
    if (!racerCanvas) return;
    while (racerState.speedLines.length < 14) { 
        racerState.speedLines.push({ x: 60 + Math.random() * (racerCanvas.width - 120), y: Math.random() * racerCanvas.height, length: 18 + Math.random() * 28 });
    } 
}
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

function updateRacer(delta) {
    if (!racerState.running || !racerCanvas) return;

    racerState.speed = Math.min(520, racerState.speed + (delta * 0.001));
    const traveled = racerState.speed * (delta / 1000) * (racerCanvas.height / 500);
    racerState.distance += traveled;

    racerState.spawnTimer -= delta;
    if (racerState.spawnTimer <= 0) {
        spawnObstacle();
    }
    
    racerState.obstacles.forEach(ob => {
        ob.y += traveled;
    });

    racerState.obstacles = racerState.obstacles.filter(ob => {
        if (ob.y > racerCanvas.height) {
            racerState.dodged += 1;
            spawnWhooshLines(ob.gapCenter, racerCanvas.height - 40);
            playSound(racerDodgeSfx);
            racerState.shake.time = 8;
            racerState.shake.intensity = 2;
            
            const scale = Math.min(1.3, 1 + racerState.dodged * 0.02);
            playerCar.width = playerCar.baseWidth * scale;
            
            if (racerState.dodged > 0 && racerState.dodged % 10 === 0) {
                racerState.speed = Math.min(520, racerState.speed + 24);
                if (racerMessageEl) racerMessageEl.textContent = `Boost! Speed increased.`;
            }
            return false;
        }
        return true;
    });

    racerState.speedLines.forEach(line => { line.y += traveled * 1.6; });
    racerState.speedLines = racerState.speedLines.filter(line => line.y < racerCanvas.height + 40);
    ensureSpeedLines();

    if (racerState.running) {
        const trailX = playerCar.x + (Math.random() - 0.5) * (playerCar.width * 0.2);
        const trailY = playerCar.y + playerCar.height - 5;
        racerState.particles.push({
            type: 'spark', x: trailX, y: trailY, vx: (Math.random() - 0.5) * 0.5,
            vy: 1.5 + Math.random() * 1.5, life: 15 + Math.random() * 20, size: 1 + Math.random() * 2.5,
            color: `rgba(30, 200, 255, ${0.3 + Math.random() * 0.3})`
        });
    }

    const carCenter = playerCar.x;
    const carLeft = carCenter - playerCar.width / 2;
    const carRight = carCenter + playerCar.width / 2;
    const carTop = playerCar.y;
    const carBottom = playerCar.y + playerCar.height;

    for (const ob of racerState.obstacles) {
        const obTop = ob.y;
        const obBottom = ob.y + obstacleHeight;
        
        if (obBottom > carTop && obTop < carBottom) {
            const gapLeft = ob.gapCenter - ob.gapWidth / 2;
            const gapRight = ob.gapCenter + ob.gapWidth / 2;

            if (carLeft < gapLeft || carRight > gapRight) {
                endRacerGame(carCenter, carTop + playerCar.height / 2); 
                return; 
            }
        }
    }
}

function renderRacer(delta) {
    if (!racerCtx || !racerCanvas) return;
    
    racerCtx.save();
    applyShakeTransform(); 
    
    drawBackground();
    drawSpeedLines();
    drawObstacles(); 
    drawGlow();
    drawPlayer(delta);
    
    drawParticles();

    if (racerState.flash.alpha > 0) {
        racerCtx.fillStyle = `rgba(255,255,255,${racerState.flash.alpha})`;
        racerCtx.fillRect(0, 0, racerCanvas.width, racerCanvas.height);
        racerState.flash.alpha *= 0.85; 
        if (racerState.flash.alpha < 0.01) racerState.flash.alpha = 0;
    }

    racerCtx.restore();
    
    if (racerState.crashAnimId && !racerState.running) {
        racerState.crashAnimId = requestAnimationFrame(() => renderRacer(delta));
    }
}

function updateHud() {
    if (racerDistanceEl) {
        racerDistanceEl.textContent = 'Distance: ' + Math.floor(racerState.distance) + 'm';
    }
    if (racerSpeedEl) {
        racerSpeedEl.textContent = 'Speed: ' + Math.floor(racerState.speed) + 'km/h';
    }
}

function gameLoop(timestamp) {
    if (!racerState.running) return;
    const delta = timestamp - racerState.lastTimestamp;
    racerState.lastTimestamp = timestamp;
    updateRacer(delta);
    renderRacer(delta);
    updateHud();
    if (racerState.running) {
        racerState.animationFrame = requestAnimationFrame(gameLoop);
    }
}

function startRacer() {
    if (racerState.running) return;
    if (racerMessageEl) { racerMessageEl.textContent = 'Neon boost engaged!'; }
    racerState.running = true;
    racerState.lastTimestamp = performance.now();
    racerState.spawnTimer = racerState.spawnStartTime;
    if (racerState.sound) {
        if (racerMusic) racerMusic.play().catch(e => console.log("Audio play failed"));
        if (racerEngine) racerEngine.play().catch(e => console.log("Audio play failed"));
    }
    racerState.animationFrame = requestAnimationFrame(gameLoop);
}

function pauseRacer() {
    if (!racerState.running) return;
    racerState.running = false;
    if (racerState.animationFrame) cancelAnimationFrame(racerState.animationFrame);
    if (racerMessageEl) { racerMessageEl.textContent = 'Paused. Hit start to keep racing.';
    }
    if (racerEngine) racerEngine.pause();
}

function loadRacerHighScore() {
    racerMostGapsCleared = parseInt(localStorage.getItem(GAPS_HIGH_SCORE_KEY)) || 0;
    if (racerObstaclesEl) {
        racerObstaclesEl.textContent = `Gaps: ${racerState.dodged} (Record: ${racerMostGapsCleared})`;
    }
}

function endRacerGame(crashX, crashY) {
    if (!racerState.running) return;
    
    spawnCrash(crashX, crashY); 
    
    racerState.running = false;
    if (racerState.animationFrame) cancelAnimationFrame(racerState.animationFrame);
    if (racerMusic) racerMusic.pause();
    if (racerEngine) racerEngine.pause();

    let message = 'CRASHED! Game Over.';
    if (racerState.dodged > racerMostGapsCleared) {
        racerMostGapsCleared = racerState.dodged;
        localStorage.setItem(GAPS_HIGH_SCORE_KEY, racerMostGapsCleared);
        message = 'CRASHED! NEW RECORD Gaps Cleared!';
    }

    if (racerMessageEl) racerMessageEl.textContent = message;
    if (racerObstaclesEl) {
        racerObstaclesEl.textContent = `Gaps: ${racerState.dodged} (Record: ${racerMostGapsCleared})`;
    }
    
    if (!racerState.crashAnimId) {
        racerState.crashAnimId = requestAnimationFrame(() => renderRacer(0));
    }
}

function resetRacer() {
    if (racerState.crashAnimId) { 
        cancelAnimationFrame(racerState.crashAnimId);
        racerState.crashAnimId = null;
    }
    pauseRacer();

    if (racerEngine) racerEngine.pause();
    if (racerMusic && racerState.sound) { 
        racerMusic.currentTime = 0;
        racerMusic.play().catch(e => console.log("Audio play failed"));
    }
    playerCar.lane = 1;
    playerCar.baseWidth = laneWidth * 0.55;
    playerCar.width = playerCar.baseWidth;
    playerCar.x = laneCenters[playerCar.lane];
    playerCar.height = 58;
    racerState.speed = 180;
    racerState.distance = 0;
    racerState.dodged = 0;
    racerState.speedLines = [];
    racerState.particles = [];
    racerState.explosionParticles = [];
    resetObstacles();
    racerState.shake.time = 0;
    racerState.shake.intensity = 0;
    racerState.flash.alpha = 0;
    
    loadRacerHighScore(); 
    
    if (racerMessageEl) racerMessageEl.textContent = 'Ready to race!';
    if (racerSpeedEl) racerSpeedEl.textContent = 'Speed: 180km/h';
    if (racerDistanceEl) racerDistanceEl.textContent = 'Distance: 0m';
    if (racerCtx && racerCanvas) {
        racerCtx.fillStyle = '#0a0e24';
        racerCtx.fillRect(0, 0, racerCanvas.width, racerCanvas.height);
        drawBackground();
        drawPlayer();
    }
}

function handleKey(event) {
    if (racerModal && racerModal.style.display !== 'flex') return;
    
    if (event.key === 'ArrowLeft' && racerState.running) {
        event.preventDefault();
        playerCar.lane = Math.max(0, playerCar.lane - 1);
    }
    if (event.key === 'ArrowRight' && racerState.running) {
        event.preventDefault();
        playerCar.lane = Math.min(laneCount - 1, playerCar.lane + 1);
    }
    if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        if (racerState.running) {
            pauseRacer();
        } else {
            startRacer();
        }
    }
}

// --- INIT RACER ---
function initRacerGame() {
    if (!runRacerBtn || !racerCanvas) return;
    
    // Set dynamic canvas/lane properties only once after canvas is found
    laneWidth = racerCanvas.width / laneCount;
    playerCar.baseWidth = laneWidth * 0.55;
    playerCar.width = playerCar.baseWidth;
    playerCar.y = racerCanvas.height - 90;
    
    laneCenters = Array.from({ length: laneCount }, (_, i) => i * laneWidth + laneWidth / 2);
    playerCar.x = laneCenters[playerCar.lane];

    runRacerBtn.addEventListener('click', function(e) {
        e.preventDefault();
        racerModal.style.display = 'flex';
        if (typeof resetRacer === 'function') {
            resetRacer();
        }
    });

    if (racerModalCloseBtn) racerModalCloseBtn.addEventListener('click', closeRacerModal);
    if (racerModal) {
        racerModal.addEventListener('click', function(e) {
            if (e.target === racerModal) {
                closeRacerModal();
            }
        });
    }
    
    if (startRacerBtn) startRacerBtn.addEventListener('click', startRacer);
    if (pauseRacerBtn) pauseRacerBtn.addEventListener('click', pauseRacer);
    if (resetRacerBtn) resetRacerBtn.addEventListener('click', resetRacer);
    if (toggleSoundBtn) toggleSoundBtn.addEventListener('click', toggleSound);

    allAudio = [racerMusic, racerEngine, racerDodgeSfx, racerCrashSfx];
    allAudio.forEach(audio => {
        if (audio) {
            audio.volume = 0.5; 
        }
    });
    if (racerMusic) racerMusic.volume = 0.3; 
    if (racerEngine) racerEngine.volume = 0.4;
    
    if (!document.__racerBound) {
        document.addEventListener('keydown', handleKey);
        document.__racerBound = true;
    }
    
    loadRacerHighScore(); 
    resetRacer();
}

// --- FULL INVADERS SCRIPT (LOGIC) ---
let invaderState = {
    player: { x: 140, y: 350, width: 20, height: 16, lives: 3, alive: true }, 
    bullet: { x: 0, y: 0, width: 4, height: 14, active: false, alive: false, speed: 24 },
    enemies: [],
    enemyBullets: [],
    bunkers: [], 
    mysteryShip: { x: 0, y: 20, width: 30, height: 14, active: false, direction: 1, alive: false },
    enemyDirection: 1,
    score: 0,
    level: 1,
    gameOver: false,
    gameLoopId: null,
    dropSpeed: 6, 
    enemyMoveInterval: 36, 
    enemyMoveTimer: 36, 
    enemyMoveAmount: 4, 
    initialEnemies: 0,
};

const bunkerPatternConnected = [
    [0, 1, 1, 1, 1, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1, 1],
    [1, 1, 1, 0, 0, 1, 1, 1],
    [1, 1, 0, 0, 0, 0, 1, 1]
];

const bunkerBlockSize = 5;
const bunkerTotalWidth = bunkerPatternConnected[0].length * bunkerBlockSize;

const invaderPalettes = ['#FF00FF', '#00FFFF', '#FF0000', '#00FF00', '#FFFF00', '#0000FF'];

function createBunkers() {
    if (!invadersCanvas) return;
    invaderState.bunkers = [];
    const bunkerCount = 4;
    const blockSize = bunkerBlockSize;
    const usableWidth = invadersCanvas.width - 60;
    const spacing = usableWidth / bunkerCount;
    const baseX = 30; 
    const bunkerY = Math.max( invadersCanvas.height - 140, 260 );
    
    for (let b = 0; b < bunkerCount; b++) {
        const center = baseX + spacing * b + spacing / 2;
        const left = Math.round(center - bunkerTotalWidth / 2);
        for (let r = 0; r < bunkerPatternConnected.length; r++) {
            for (let c = 0; c < bunkerPatternConnected[0].length; c++) {
                if (bunkerPatternConnected[r][c]) {
                    const px = left + c * blockSize;
                    const py = bunkerY + r * blockSize;
                    invaderState.bunkers.push({ x: px, y: py, width: blockSize, height: blockSize, alive: true });
                }
            }
        }
    }
}

function createEnemies() {
    const state = invaderState;
    if (!invadersCanvas) return;

    state.enemies = [];
    const rows = 4; 
    const approxEnemyWidth = 20;
    const padding = 12;
    const minCols = 8;
    const maxCols = 12;
    const availableWidth = invadersCanvas.width - 60;
    const colsEstimate = Math.floor(availableWidth / (approxEnemyWidth + padding));
    const cols = Math.min(Math.max(minCols, colsEstimate), maxCols);
    const enemyWidth = approxEnemyWidth;
    const enemyHeight = 14;
    const totalWidth = cols * enemyWidth + (cols - 1) * padding;
    const startX = (invadersCanvas.width - totalWidth) / 2;
    const startY = 60;
    const enemyTypes = [0, 1, 2, 0]; 
    
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            state.enemies.push({
                x: startX + c * (enemyWidth + padding),
                y: startY + r * (enemyHeight + 10),
                width: enemyWidth,
                height: enemyHeight,
                alive: true,
                type: enemyTypes[r % enemyTypes.length],
                points: (r % 2 === 0) ? 10 : 20
            });
        }
    }
    state.initialEnemies = state.enemies.length;
}

function checkCollision(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
}

function updateInvaders() {
    if (invaderState.gameOver || !invadersCanvas) return;
    const state = invaderState;

    if (state.bullet.active) {
        state.bullet.y -= state.bullet.speed;
        if (state.bullet.y + state.bullet.height < 0) {
            state.bullet.active = false;
            state.bullet.alive = false;
        }

        for (let b = state.bunkers.length - 1; b >= 0; b--) {
            const block = state.bunkers[b];
            if (block.alive && checkCollision(state.bullet, block)) {
                block.alive = false;
                state.bullet.active = false;
                state.bullet.alive = false;
                break;
            }
        }

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

    state.enemyMoveTimer--;
    if (state.enemyMoveTimer <= 0) {
        let moveDown = false;
        state.enemyMoveTimer = state.enemyMoveInterval;

        for (const enemy of state.enemies) {
            if (enemy.alive) {
                if (state.enemyDirection === 1 && enemy.x + enemy.width + state.enemyMoveAmount >= invadersCanvas.width) {
                    moveDown = true;
                    break;
                }
                if (state.enemyDirection === -1 && enemy.x - state.enemyMoveAmount <= 0) {
                    moveDown = true;
                    break;
                }
                if (enemy.y + enemy.height >= state.player.y - 10) {
                    stopInvaders("GAME OVER: Invaders reached you!");
                    return;
                }
            }
        }

        if (moveDown) {
            state.enemyDirection *= -1;
            for (const enemy of state.enemies) {
                if (enemy.alive) enemy.y += state.dropSpeed;
            }
        } else {
            for (const enemy of state.enemies) {
                if (enemy.alive) enemy.x += state.enemyDirection * state.enemyMoveAmount;
            }
        }

        if (state.enemies.every(e => !e.alive)) {
            startNextLevel();
            return;
        }
    }

    if (!state.mysteryShip.active && Math.random() < 0.003) {
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

    let aliveEnemies = state.enemies.filter(e => e.alive);
    let shootThreshold = Math.max(0.75, 0.98 - (state.level * 0.015));
    if (Math.random() > shootThreshold && aliveEnemies.length > 0) {
        let shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
        state.enemyBullets.push({
            x: shooter.x + Math.floor(shooter.width / 2) - 1,
            y: shooter.y + shooter.height,
            width: 2,
            height: 14,
            alive: true,
            speed: 3 + state.level * 0.15 
        });
    }

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
                return false;
            }
            return false; 
        }
        return bullet.y < invadersCanvas.height; 
    });
}

function drawInvaders() {
    if (!invadersCtx || !invadersCanvas) return;
    const state = invaderState;

    invadersCtx.fillStyle = '#000';
    invadersCtx.fillRect(0, 0, invadersCanvas.width, invadersCanvas.height);

    invadersCtx.save();
    invadersCtx.fillStyle = '#88FFFF';
    invadersCtx.strokeStyle = '#00FFFF';
    invadersCtx.lineWidth = 1;
    invadersCtx.shadowColor = '#00FFFF';
    invadersCtx.shadowBlur = state.player.alive ? 10 : 0;
    invadersCtx.fillRect(state.player.x, state.player.y, state.player.width, state.player.height);
    invadersCtx.strokeRect(state.player.x, state.player.y, state.player.width, state.player.height);
    invadersCtx.restore();

    invadersCtx.save();
    invadersCtx.fillStyle = '#00FF00';
    invadersCtx.strokeStyle = '#33FF33';
    invadersCtx.lineWidth = 0.5;
    invadersCtx.shadowColor = '#00FF00';
    invadersCtx.shadowBlur = 6;
    state.bunkers.forEach(block => {
        if (block.alive) {
            invadersCtx.fillRect(block.x, block.y, block.width, block.height);
            invadersCtx.strokeRect(block.x, block.y, block.width, block.height);
        }
    });
    invadersCtx.restore();

    if (state.bullet.active) {
        invadersCtx.save();
        invadersCtx.strokeStyle = '#88FFFF';
        invadersCtx.lineWidth = 3;
        invadersCtx.shadowColor = '#88FFFF';
        invadersCtx.shadowBlur = 12;
        const bx = Math.round(state.bullet.x + state.bullet.width / 2);
        invadersCtx.beginPath();
        invadersCtx.moveTo(bx, Math.round(state.bullet.y + state.bullet.height));
        invadersCtx.lineTo(bx, Math.round(state.bullet.y));
        invadersCtx.stroke();
        invadersCtx.restore();
    }

    const enemyColor = invaderPalettes[(state.level - 1) % invaderPalettes.length];
    invadersCtx.fillStyle = enemyColor;
    state.enemies.forEach(enemy => {
        if (enemy.alive) {
            invadersCtx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        }
    });

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

    const lifeBoxW = 20;
    const lifeBoxH = 16;
    const lifeY = invadersCanvas.height - 24;
    
    invadersCtx.font = '15px "Courier New", monospace';
    invadersCtx.fillStyle = '#fff';
    invadersCtx.fillText(`LIVES: ${state.player.lives}`, invadersCanvas.width - 150, lifeY + 12);
    
    invadersCtx.save();
    invadersCtx.fillStyle = '#88FFFF';
    invadersCtx.strokeStyle = '#00FFFF';
    invadersCtx.lineWidth = 1;
    invadersCtx.shadowColor = '#00FFFF';
    invadersCtx.shadowBlur = 10;
    
    for (let i = 0; i < state.player.lives; i++) {
        const sideX = invadersCanvas.width - 160 + i * 25; 
        invadersCtx.fillRect(sideX, lifeY, lifeBoxW, lifeBoxH);
        invadersCtx.strokeRect(sideX, lifeY, lifeBoxW, lifeBoxH);
    }
    invadersCtx.restore();
    
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
    state.enemyMoveInterval = Math.max(8, 36 - (state.level - 1) * 1.2);
    state.enemyMoveTimer = state.enemyMoveInterval;
    state.dropSpeed = 6 + (state.level - 1) * 1.2;
    createEnemies();
    createBunkers();
}

function startInvaders() {
    const state = invaderState;
    if (!invadersCanvas) return;

    if (state.gameOver) {
        state.score = 0;
        state.level = 1;
        state.player.lives = 3;
        state.player.alive = true;
        state.gameOver = false;
        state.enemyMoveInterval = 36;
        state.dropSpeed = 6;
        if (invadersScoreEl) invadersScoreEl.textContent = `Score: 0`;
    }
    
    if (invaderState.gameLoopId) {
        cancelAnimationFrame(invaderState.gameLoopId);
    }

    state.bullet.active = false;
    state.bullet.alive = false;
    state.enemyBullets = [];
    state.player.x = invadersCanvas.width / 2 - state.player.width / 2;
    if (invadersMessageEl) invadersMessageEl.textContent = `Space Invaders++ — Level 1`;

    createEnemies();
    createBunkers();
    invadersGameLoop();
}

function stopInvaders(message) {
    const state = invaderState;
    state.gameOver = true;
    if (state.gameLoopId) {
        cancelAnimationFrame(state.gameLoopId);
        state.gameLoopId = null;
    }
    if (invadersMessageEl) {
        invadersMessageEl.textContent = message;
    }
}

function handleInvadersKey(event) {
    if (!invadersModal || invadersModal.style.display !== 'flex') return;
    const state = invaderState;
    if (!invadersCanvas) return; 

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
        state.player.x = Math.max(0, state.player.x - 12);
    }
    if (event.key === 'ArrowRight') {
        event.preventDefault();
        state.player.x = Math.min(invadersCanvas.width - state.player.width, state.player.x + 12);
    }
}

// --- INIT INVADERS ---\
function initInvadersGame() {
    if (!runInvadersBtn || !invadersCanvas) return;
    
    runInvadersBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if(invadersModal) invadersModal.style.display = 'flex';
      if (invadersMessageEl) invadersMessageEl.textContent = "Press Start!";
    });

    if (invadersModalCloseBtn) invadersModalCloseBtn.addEventListener('click', closeInvadersModal);
    if (invadersModal) {
        invadersModal.addEventListener('click', function(e) {
          if (e.target === invadersModal) {
            closeInvadersModal();
          }
        });
    }

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

// --- INIT ALL GAMES ---
document.addEventListener('DOMContentLoaded', () => {
    // --- THE FIX: Assign elements *after* DOM content is loaded ---

    // Tetris Elements
    tetrisModal = document.getElementById('tetrisModal');
    runTetrisBtn = document.getElementById('runTetrisBtn');
    modalCloseBtn = document.getElementById('modalCloseBtn');
    canvas = document.getElementById('game');
    ctx = canvas ? canvas.getContext('2d') : null;
    scoreP = document.getElementById('score');
    startBtn = document.getElementById('startBtn');
    controlsBtn = document.getElementById('controlsBtn');

    // Neon Racer Elements
    racerModal = document.getElementById('racerModal');
    runRacerBtn = document.getElementById('runRacerBtn');
    racerModalCloseBtn = document.getElementById('racerModalCloseBtn');
    racerCanvas = document.getElementById('racer-canvas');
    racerCtx = racerCanvas ? racerCanvas.getContext('2d') : null;
    racerDistanceEl = document.getElementById('racer-distance');
    racerSpeedEl = document.getElementById('racer-speed');
    racerObstaclesEl = document.getElementById('racer-obstacles');
    racerMessageEl = document.getElementById('racer-message');
    startRacerBtn = document.getElementById('startRacerBtn');
    pauseRacerBtn = document.getElementById('pauseRacerBtn');
    resetRacerBtn = document.getElementById('resetRacerBtn');
    toggleSoundBtn = document.getElementById('toggleSoundBtn');
    // Audio elements assignment
    racerMusic = document.getElementById('racerMusic');
    racerEngine = document.getElementById('racerEngine');
    racerDodgeSfx = document.getElementById('racerDodgeSfx');
    racerCrashSfx = document.getElementById('racerCrashSfx');

    // Space Invaders Elements
    invadersModal = document.getElementById('invadersModal');
    runInvadersBtn = document.getElementById('runInvadersBtn');
    invadersModalCloseBtn = document.getElementById('invadersModalCloseBtn');
    invadersCanvas = document.getElementById('invaders-canvas');
    invadersCtx = invadersCanvas ? invadersCanvas.getContext('2d') : null;
    invadersMessageEl = document.getElementById('invaders-message');
    startInvadersBtn = document.getElementById('startInvadersBtn');
    invadersScoreEl = document.getElementById('invaders-score');
    
    // Check if external function exists and run it first
    if (typeof enforcePageAccess === 'function') {
        enforcePageAccess();
    }
  
    // Initialize games only if the primary entry buttons and canvas contexts are found
    if (runTetrisBtn && ctx) initTetrisGame();
    if (runRacerBtn && racerCtx) initRacerGame();
    if (runInvadersBtn && invadersCtx) initInvadersGame();
});
