// --- EXPERIMENTAL.JS (updated bindings + invaders changes) ---

// NOTE: This file contains all game logic for Tetris, Neon Racer, and Space Invaders.
// Important fix: all Run/Start button event listeners and modal handlers are attached
// inside a DOMContentLoaded handler so they bind reliably after the DOM is parsed.

// --- TETRIS / RACER / INVADERS ELEMENT REFERENCES (may be null until DOM ready) ---
let tetrisModal, runTetrisBtn, modalCloseBtn;
let canvas, ctx, scoreP, startBtn, controlsBtn;

let racerModal, runRacerBtn, racerModalCloseBtn;
let racerCanvas, racerCtx, racerDistanceEl, racerSpeedEl, racerObstaclesEl, racerMessageEl;
let startRacerBtn, pauseRacerBtn, resetRacerBtn;

let invadersModal, runInvadersBtn, invadersModalCloseBtn;
let invadersCanvas, invadersCtx, invadersMessageEl, startInvadersBtn, invadersScoreEl;

// --- COMMON UTIL: safe query ---
function $id(id) {
  return document.getElementById(id);
}

// --- TETRIS GAME (variables kept as before) ---
const BOX = 24;
const TETRIS_FRAME_SPEED = 50;

let fastFall = false;
let score = 0;
let highScore;

let block;
let rows;
let game; // setInterval id
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
  { fill: '#FF69B4', stroke: '#E6529E', shadow: '#FF69B4' }
];

const all_blocks = {
  0: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  1: [[1,1],[1,1]],
  2: [[0,1,0],[1,1,1],[0,0,0]],
  3: [[0,1,1],[1,1,0],[0,0,0]],
  4: [[1,1,0],[0,1,1],[0,0,0]],
  5: [[1,0,0],[1,1,1],[0,0,0]],
  6: [[0,0,1],[1,1,1],[0,0,0]],
  7: [[0,1,0],[1,1,1],[0,1,0]],
  8: [[1,0,1],[1,1,1],[0,0,0]],
  9: [[1,0,0],[1,1,1],[0,0,1]],
  10:[[0,0,1],[1,1,1],[1,0,0]],
  11:[[1,1,1],[0,1,0],[0,1,0]]
};

function loadHighScore() {
  highScore = parseInt(localStorage.getItem('tetrisHighScore')) || 0;
  if (scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
}
function saveHighScore() {
  localStorage.setItem('tetrisHighScore', highScore);
  if (scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
}

function transpose(L){
  let final = [];
  for (let i=0;i<L[0].length;i++) final.push([]);
  for (let i=0;i<L.length;i++){
    for (let x=0;x<L[i].length;x++) final[x].push(L[i][x]);
  }
  return final;
}
function reverse(L){ for (let i=0;i<L.length;i++) L[i].reverse(); return L; }

function isColliding(B) {
  for (let y = 0; y < B[0].length; y++) {
    for (let x = 0; x < B[0][y].length; x++) {
      if (B[0][y][x] === 1) {
        if ((B[1] + x) < 0 || (B[1] + x) >= 10 || (B[2] + y) >= 20) return true;
        if (rows[B[2] + y] && rows[B[2] + y][B[1] + x] === 1) return true;
      }
    }
  }
  return false;
}

function startTetris() {
  rows = [];
  for (let i=0;i<20;i++){ let row=[]; for (let x=0;x<10;x++) row.push(0); rows.push(row); }
  score = 0;
  currentLevel = 0;
  loadHighScore();
  count = 10;
  if (game) clearInterval(game);
  game = setInterval(drawFrame, TETRIS_FRAME_SPEED);
  if (startBtn) startBtn.textContent = 'Restart';
}
function rotateTetris() {
  if (!block) return;
  block[0] = transpose(block[0]); block[0] = reverse(block[0]);
  if (isColliding(block)) { block[0] = reverse(block[0]); block[0] = transpose(block[0]); }
}
function moveRightTetris(){ if (!block) return; block[1]+=1; if (isColliding(block)) block[1]-=1; }
function moveLeftTetris(){ if (!block) return; block[1]-=1; if (isColliding(block)) block[1]+=1; }

function drawFrame(){
  if (!ctx) return;
  if (!block) {
    let blockPoolSize=7+currentLevel; if (blockPoolSize>12) blockPoolSize=12;
    let newBlockIndex = Math.floor(Math.random()*blockPoolSize);
    block = [all_blocks[newBlockIndex],4,0];
    if (isColliding(block)) {
      clearInterval(game); game=null;
      if (startBtn) startBtn.textContent='Start';
      if (score>highScore) { alert('Game Over! New high score: ' + score); highScore=score; saveHighScore(); }
      else { alert('Game Over! Score: ' + score); }
      return;
    }
    return;
  }
  ctx.fillStyle='#050505'; ctx.fillRect(0,0,canvas.width,canvas.height);
  if (count===0 || (fastFall && (count%2===0))) {
    count = 10; block[2]+=1;
    if (isColliding(block)) {
      block[2]-=1;
      for (let y=0;y<block[0].length;y++){
        for (let x=0;x<block[0][y].length;x++){
          if (block[0][y][x]===1) {
            if (rows[block[2]+y]) rows[block[2]+y][block[1]+x]=1;
          }
        }
      }
      block = null;
      for (let i=0;i<20;i++){
        if (rows[i] && !rows[i].some(b=>b===0)) {
          rows.splice(i,1);
          let row=[]; for (let x=0;x<10;x++) row.push(0); rows.unshift(row);
          score += 10;
          let newLevel = Math.floor(score/50);
          if (newLevel > currentLevel) currentLevel = newLevel;
          if (scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
          i--;
        }
      }
    }
  }

  let RaB = rows.map(r => [...r]);
  if (block) {
    for (let y=0;y<block[0].length;y++){
      for (let x=0;x<block[0][y].length;x++){
        if (block[0][y][x]===1){
          if (RaB[block[2]+y]) RaB[block[2]+y][block[1]+x]=1;
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

  const size = BOX - 3;
  const offset = 1.5;
  for (let y = 0; y < RaB.length; y++){
    for (let x = 0; x < RaB[y].length; x++){
      if (RaB[y][x] === 1) {
        ctx.fillRect(x*BOX + offset, y*BOX + offset, size, size);
        ctx.strokeRect(x*BOX + offset, y*BOX + offset, size, size);
      }
    }
  }
  ctx.shadowBlur = 0;
  count -= 1;
}

// tetris key handling (only when modal open and game running)
function tetrisKeydown(event){
  if (!tetrisModal || tetrisModal.style.display !== 'flex' || !game) return;
  if (['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(event.key) || event.code === 'Space') event.preventDefault();
  if (event.key === 'ArrowLeft') moveLeftTetris();
  if (event.key === 'ArrowRight') moveRightTetris();
  if (event.code === 'Space') rotateTetris();
  if (event.key === 'ArrowDown') fastFall = true;
}
function tetrisKeyup(ev){ if (ev.key === 'ArrowDown') fastFall = false; }

// --- NEON RACER (kept structure) ---
const laneCount = 3;
let laneWidth; // set on init
const playerCar = { lane: 1, baseWidth: 0, width: 0, height: 58, y: 0, x: 0 };
const racerState = {
  running:false, lastTimestamp:0, speed:180, distance:0, dodged:0,
  obstacles:[], speedLines:[], spawnTimer:0, animationFrame:null,
  gapWidthMultiplier:1.2, spawnStartDistance:420, spawnMinDistance:120,
  spawnVariance:120, spawnTightenRate:10, particles:[], explosionParticles:[],
  laneLerpSpeed:0.18, shake:{time:0,intensity:0}, flash:{alpha:0}, crashAnimId:null
};
const obstacleHeight = 60;
let laneCenters = []; // set on init

function spawnParticles(x,y,color,count=12){ for (let i=0;i<count;i++){ racerState.particles.push({type:'spark', x:x+(Math.random()-0.5)*20, y:y+(Math.random()-0.5)*12, vx:(Math.random()-0.5)*2.5, vy:-1-Math.random()*1.6, life:30+Math.random()*30, size:1+Math.random()*2, color }); } }

function spawnCrash(x, y) {
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
      color: `hsl(${Math.floor(Math.random()*40)},80%,60%)`
    });
  }

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
      const alpha = Math.max(0, p.life / 120);
      racerCtx.globalAlpha = alpha;
      racerCtx.fillStyle = p.color;
      racerCtx.translate(p.x, p.y);
      racerCtx.rotate(p.angle);
      racerCtx.fillRect(-p.size/2, -p.size/3, p.size, Math.max(1, p.size/2));
      racerCtx.restore();

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18;
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
      p.vy -= 0.01;
      p.size += 0.2;
      p.life -= 1;
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
      p.y += p.vy;
      p.vy += 0.08;
      p.vx *= 0.995;
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

  racerCtx.fillStyle = 'rgba(0,255,255,0.06)';
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
  const targetX = laneCenters[playerCar.lane];
  playerCar.x += (targetX - playerCar.x) * racerState.laneLerpSpeed;

  const left = playerCar.x - playerCar.width / 2;
  racerCtx.save();

  racerCtx.shadowColor = '#19d7ff';
  racerCtx.shadowBlur = 20;
  racerCtx.fillStyle = '#19d7ff';
  racerCtx.fillRect(left - 2, playerCar.y - 2, playerCar.width + 4, playerCar.height + 4);
  racerCtx.shadowBlur = 0;

  racerCtx.fillStyle = '#0b1f3a';
  racerCtx.fillRect(left + 6, playerCar.y + 10, playerCar.width - 12, playerCar.height - 20);

  racerCtx.fillStyle = '#19d7ff';
  racerCtx.fillRect(left + playerCar.width / 2 - 6, playerCar.y + 6, 12, playerCar.height - 12);

  racerCtx.fillStyle = '#3be7ff';
  racerCtx.fillRect(left + 6, playerCar.y + 2, playerCar.width - 12, 6);

  racerCtx.fillStyle = 'rgba(10, 200, 255, 0.08)';
  const trailWidth = Math.min(40, Math.floor((racerState.speed - 160) / 6));
  racerCtx.fillRect(left + playerCar.width / 2 - trailWidth / 2, playerCar.y + playerCar.height + 4, trailWidth, 8);

  racerCtx.restore();
}

function drawObstacles() {
  if (!racerCtx) return;
  racerState.obstacles.forEach(ob => {
    const top = ob.y;
    const gapLeft = ob.gapCenter - ob.gapWidth / 2;
    const gapRight = ob.gapCenter + ob.gapWidth / 2;

    racerCtx.save();
    racerCtx.shadowColor = ob.color;
    racerCtx.shadowBlur = 16;
    racerCtx.fillStyle = ob.color;
    if (gapLeft > 0) {
      racerCtx.fillRect(0, top, gapLeft, obstacleHeight);
      racerCtx.strokeStyle = 'rgba(255,255,255,0.06)';
      racerCtx.lineWidth = 1;
      racerCtx.strokeRect(Math.max(0, gapLeft - 6), top, 6, obstacleHeight);
    }
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

  let gapWidth = playerCar.width * racerState.gapWidthMultiplier;

  const safetyMargin = 6;
  gapWidth = Math.max(gapWidth, playerCar.width + safetyMargin);

  gapWidth = Math.min(gapWidth, Math.max(60, racerCanvas.width - 24));

  let gapCenter = laneCenters[gapLane];
  const half = gapWidth / 2;
  gapCenter = Math.max(half + 8, Math.min(racerCanvas.width - half - 8, gapCenter));

  racerState.obstacles.push({
    y: -obstacleHeight,
    gapCenter,
    gapWidth,
    color: `hsl(${colorHue}, 90%, 60%)`
  });

  const dynamicForward = Math.max(
    racerState.spawnMinDistance,
    racerState.spawnStartDistance - racerState.dodged * racerState.spawnTightenRate
  );
  racerState.spawnTimer = dynamicForward + Math.random() * racerState.spawnVariance;
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

function startCrashAnimation() {
  if (racerState.crashAnimId) {
    cancelAnimationFrame(racerState.crashAnimId);
    racerState.crashAnimId = null;
  }
  const loop = (timestamp) => {
    renderRacer();
    const activeParticles = (racerState.explosionParticles && racerState.explosionParticles.length > 0) || (racerState.particles && racerState.particles.length > 0);
    const activeShake = racerState.shake.time > 0;
    const activeFlash = racerState.flash.alpha > 0.02;
    if (activeParticles || activeShake || activeFlash) {
      racerState.crashAnimId = requestAnimationFrame(loop);
    } else {
      racerState.flash.alpha = 0;
      racerState.crashAnimId = null;
    }
  };
  racerState.crashAnimId = requestAnimationFrame(loop);
}

function updateRacer(delta) {
  if (!racerCanvas) return;
  racerState.speed = Math.min(520, 180 + racerState.dodged * 6 + Math.floor(racerState.distance / 800));
  const pixelsPerMs = (racerState.speed / 1000) * 1.25;
  const traveled = pixelsPerMs * delta;
  racerState.distance += traveled;
  racerState.spawnTimer -= traveled;

  if (racerState.spawnTimer <= 0) spawnObstacle();

  racerState.obstacles.forEach(ob => ob.y += traveled);

  racerState.obstacles = racerState.obstacles.filter(ob => {
    if (ob.y > racerCanvas.height) {
      racerState.dodged += 1;
      spawnParticles(ob.gapCenter, racerCanvas.height - 40, 'rgba(30,240,255,0.9)', 16);
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
    if (carLeft < gapLeft || carRight > gapRight) {
      if (racerState.animationFrame) { cancelAnimationFrame(racerState.animationFrame); racerState.animationFrame = null; }
      spawnCrash(playerCar.x, playerCar.y + playerCar.height / 2);
      racerState.running = false;
      startCrashAnimation();
      if (racerMessageEl) racerMessageEl.textContent = 'Crash! Reset to roll out again.';
      return;
    }
  }

  drawParticles();
}

function renderRacer() {
  if (!racerCtx) return;
  racerCtx.save();
  applyShakeTransform();
  drawBackground();
  drawSpeedLines();
  drawObstacles();
  drawPlayer();
  drawParticles();
  if (racerState.flash.alpha > 0) {
    racerCtx.fillStyle = `rgba(255,255,255,${racerState.flash.alpha})`;
    racerCtx.fillRect(0, 0, racerCanvas.width, racerCanvas.height);
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
  if (racerState.running) racerState.animationFrame = requestAnimationFrame(gameLoop);
}

function startRacer() {
  if (racerState.running) return;
  if (racerMessageEl) racerMessageEl.textContent = 'Neon boost engaged!';
  racerState.running = true;
  racerState.lastTimestamp = performance.now();
  racerState.animationFrame = requestAnimationFrame(gameLoop);
}

function pauseRacer() {
  if (!racerState.running) return;
  racerState.running = false;
  if (racerState.animationFrame) cancelAnimationFrame(racerState.animationFrame);
  if (racerMessageEl) racerMessageEl.textContent = 'Paused. Hit start to keep racing.';
}

function resetRacer() {
  if (racerState.crashAnimId) { cancelAnimationFrame(racerState.crashAnimId); racerState.crashAnimId = null; }
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
  if (racerMessageEl) racerMessageEl.textContent = 'Ready! Use ← and → to slide through the gaps.';
}

function shiftLane(offset) {
  const nextLane = Math.min(laneCount - 1, Math.max(0, playerCar.lane + offset));
  if (nextLane === playerCar.lane) return;
  playerCar.lane = nextLane;
  renderRacer();
  updateHud();
}

function handleKey(event) {
  if (!racerModal || racerModal.style.display !== 'flex') return;
  if (event.key === 'ArrowLeft') { shiftLane(-1); event.preventDefault(); }
  if (event.key === 'ArrowRight') { shiftLane(1); event.preventDefault(); }
}

function updateHud() {
  if (racerDistanceEl) racerDistanceEl.textContent = `Distance: ${Math.floor(racerState.distance)}m`;
  if (racerSpeedEl) racerSpeedEl.textContent = `Speed: ${Math.floor(racerState.speed)} mph`;
  if (racerObstaclesEl) racerObstaclesEl.textContent = `Gaps cleared: ${racerState.dodged}`;
}

// --- INIT RACER ---
function initRacerGame() {
  if (startRacerBtn) startRacerBtn.addEventListener('click', startRacer);
  if (pauseRacerBtn) pauseRacerBtn.addEventListener('click', pauseRacer);
  if (resetRacerBtn) resetRacerBtn.addEventListener('click', resetRacer);
  if (!document.__racerBound) { document.addEventListener('keydown', handleKey); document.__racerBound = true; }
  if (racerCanvas) { resetRacer(); }
}

// --- SPACE INVADERS SECTION ---
// This is the same Space Invaders implementation from the previous update but with bindings applied at DOMContentLoaded.
// (Bullets are drawn as '|' text like tetris-neon-invaders and bunkers use connected matrices like spaceInvaders.js)

let invaderState = {
  player: { x: 140, y: 350, width: 20, height: 16, lives: 3, alive: true },
  bullet: { x: 0, y: 0, width: 4, height: 10, active: false, alive: false },
  enemies: [], enemyBullets: [], bunkers: [], mysteryShip: { x:0,y:20,width:30,height:14,active:false,direction:1,alive:false },
  enemyDirection:1, score:0, level:1, gameOver:false, gameLoopId:null, dropSpeed:10,
  initialEnemies:0, enemyMoveTimer:0, enemyMoveInterval:30
};

const invaderPalettes2 = ['#FF00FF','#FFA500','#FFFF00','#00FF00','#00FFFF','#9D00FF','#FD1C03','#FF69B4'];

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
  const blockSize = 4;
  const bunkerCount = 4;
  const bunkerSpacing = (invadersCanvas.width - 60) / bunkerCount;

  for (let b=0;b<bunkerCount;b++){
    const bunkerX = 30 + (b * bunkerSpacing) + (bunkerSpacing / 2) - ((bunkerPatternConnected[0].length * blockSize) / 2) * 4;
    const bunkerY = 290;
    for (let r=0;r<bunkerPatternConnected.length;r++){
      for (let c=0;c<bunkerPatternConnected[0].length;c++){
        if (!bunkerPatternConnected[r][c]) continue;
        const px = bunkerX + c * (blockSize * 4);
        const py = bunkerY + r * (blockSize * 4);
        invaderState.bunkers.push({ x:px, y:py, width:blockSize*4, height:blockSize*4, alive:true });
      }
    }
  }
}

function createEnemies() {
  const state = invaderState;
  state.enemies = [];
  if (!invadersCanvas) return;

  const rows = 5;
  const approxEnemyWidth = 20;
  const padding = 12;
  const minCols = 8;
  const maxCols = 12;
  const availableWidth = Math.max(240, invadersCanvas.width - 60);
  const colsEstimate = Math.floor(availableWidth / (approxEnemyWidth + padding));
  const cols = Math.min(Math.max(minCols, colsEstimate), maxCols);

  const enemyWidth = approxEnemyWidth;
  const enemyHeight = 14;
  const totalWidth = cols * enemyWidth + (cols - 1) * padding;
  const startX = Math.max(12, Math.round((invadersCanvas.width - totalWidth) / 2));
  let startY = 28 + (state.level - 1) * 6; startY = Math.min(startY, 120);

  for (let r=0;r<rows;r++){
    for (let c=0;c<cols;c++){
      state.enemies.push({ x: startX + c * (enemyWidth + padding), y: startY + r * (enemyHeight + 10), width: enemyWidth, height: enemyHeight, alive:true });
    }
  }
  state.initialEnemies = state.enemies.length;
}

function checkCollisionRect(A,B){
  if (('alive' in A && !A.alive) || ('alive' in B && !B.alive)) return false;
  return A.x < B.x + B.width && A.x + A.width > B.x && A.y < B.y + B.height && A.y + A.height > B.y;
}

function updateInvaders() {
  if (invaderState.gameOver || !invadersCanvas) return;
  const state = invaderState;

  if (state.bullet.active) {
    state.bullet.y -= 12;
    if (state.bullet.y < 0) { state.bullet.active = false; state.bullet.alive = false; }
    for (let b=state.bunkers.length-1;b>=0;b--){
      const block = state.bunkers[b];
      if (block.alive && checkCollisionRect(state.bullet, block)) { block.alive=false; state.bullet.active=false; state.bullet.alive=false; break; }
    }
    if (state.bullet.active) {
      for (let i=state.enemies.length-1;i>=0;i--){
        const enemy = state.enemies[i];
        if (enemy.alive && checkCollisionRect(state.bullet, enemy)) { enemy.alive=false; state.bullet.active=false; state.bullet.alive=false; state.score+=10; if (invadersScoreEl) invadersScoreEl.textContent = `Score: ${state.score}`; break; }
      }
    }
    if (state.bullet.active && state.mysteryShip.active) {
      if (checkCollisionRect(state.bullet, state.mysteryShip)) {
        state.mysteryShip.active=false; state.mysteryShip.alive=false; state.bullet.active=false; state.bullet.alive=false;
        let bonus = (Math.floor(Math.random()*3)+1)*50; state.score+=bonus; if (invadersMessageEl) invadersMessageEl.textContent = `+${bonus} POINTS!`;
      }
    }
  }

  state.enemyMoveTimer--;
  if (state.enemyMoveTimer <= 0) {
    let moveDown=false; let moveStep=6;
    let aliveEnemies = state.enemies.filter(e=>e.alive);
    for (const enemy of aliveEnemies) {
      if ((state.enemyDirection>0 && enemy.x+enemy.width >= invadersCanvas.width - 6) || (state.enemyDirection<0 && enemy.x <= 6)) { moveDown=true; state.enemyDirection*=-1; moveStep=0; break; }
    }
    aliveEnemies.forEach(enemy=>{ if (moveDown) enemy.y += state.dropSpeed; else enemy.x += state.enemyDirection * moveStep; if (enemy.y + enemy.height > state.player.y) stopInvaders("GAME OVER: They reached you!"); });
    let progress = (state.initialEnemies - aliveEnemies.length) / state.initialEnemies;
    state.enemyMoveInterval = Math.max(3, (30 - (state.level-1)*2) * (1 - progress*0.9));
    state.enemyMoveTimer = state.enemyMoveInterval;
  }

  if (!state.mysteryShip.active && Math.random() > 0.998 - (state.level * 0.0005)) {
    state.mysteryShip.active = true; state.mysteryShip.alive = true;
    if (Math.random()>0.5) { state.mysteryShip.x = -state.mysteryShip.width; state.mysteryShip.direction = 1; } else { state.mysteryShip.x = invadersCanvas.width; state.mysteryShip.direction = -1; }
  }
  if (state.mysteryShip.active) { state.mysteryShip.x += state.mysteryShip.direction * (1.5 + state.level*0.2); if (state.mysteryShip.x > invadersCanvas.width || state.mysteryShip.x < -state.mysteryShip.width) { state.mysteryShip.active=false; state.mysteryShip.alive=false; } }

  let aliveEnemies = state.enemies.filter(e=>e.alive);
  let shootThreshold = Math.max(0.6, 0.98 - (state.level*0.02));
  if (Math.random() > shootThreshold && aliveEnemies.length > 0) {
    let shooter = aliveEnemies[Math.floor(Math.random()*aliveEnemies.length)];
    state.enemyBullets.push({ x: shooter.x + Math.floor(shooter.width/2) - 2, y: shooter.y + shooter.height, width:4, height:10, alive:true });
  }

  state.enemyBullets = state.enemyBullets.filter(bullet=>{
    bullet.y += 3 + state.level * 0.25;
    for (let b=state.bunkers.length-1;b>=0;b--){
      const bunkerBlock = state.bunkers[b];
      if (bunkerBlock.alive && checkCollisionRect(bullet, bunkerBlock)) { bunkerBlock.alive=false; return false; }
    }
    if (checkCollisionRect(bullet, state.player)) {
      state.player.lives--; if (invadersScoreEl) invadersScoreEl.textContent = `Score: ${state.score}`;
      if (state.player.lives <= 0) { state.player.alive=false; stopInvaders("GAME OVER: You were hit!"); } else { if (invadersMessageEl) invadersMessageEl.textContent = `HIT! ${state.player.lives} ships remain.`; }
      return false;
    }
    return bullet.y < invadersCanvas.height;
  });

  if (state.bunkers.length > 0 && state.bunkers.filter(b=>b.alive).length === 0) stopInvaders("GAME OVER: Bases destroyed!");

  if (aliveEnemies.length === 0 && !state.gameOver) startNextLevel();
}

function drawInvaders() {
  if (!invadersCtx) return;
  const state = invaderState;
  invadersCtx.fillStyle = '#000'; invadersCtx.fillRect(0,0,invadersCanvas.width,invadersCanvas.height);

  invaderState.bunkers.forEach(block=>{ if (block.alive){ invadersCtx.fillStyle = '#00FF00'; invadersCtx.fillRect(block.x, block.y, block.width, block.height); } });

  if (state.player.alive) { invadersCtx.fillStyle = '#00FFFF'; invadersCtx.fillRect(state.player.x, state.player.y, state.player.width, state.player.height); }

  if (state.bullet.active) {
    invadersCtx.fillStyle = '#FFFFFF'; invadersCtx.font = '16px monospace'; invadersCtx.textBaseline = 'top'; invadersCtx.fillText('|', Math.round(state.bullet.x), Math.round(state.bullet.y));
  }

  const enemyColor = invaderPalettes2[(state.level-1) % invaderPalettes2.length];
  invadersCtx.fillStyle = enemyColor;
  state.enemies.forEach(enemy=>{ if (enemy.alive) invadersCtx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height); });

  if (state.mysteryShip.active) {
    const ms=state.mysteryShip; invadersCtx.save(); invadersCtx.shadowColor='#FFD700'; invadersCtx.shadowBlur=12; invadersCtx.fillStyle='#FFD700'; invadersCtx.fillRect(ms.x, ms.y, ms.width, ms.height);
    const lights=['#FD1C03','#00FF00','#00FFFF','#FF00FF','#FFD700']; for (let i=0;i<5;i++){ invadersCtx.fillStyle = lights[i%lights.length]; invadersCtx.fillRect(ms.x + 3 + i * 5, ms.y + ms.height - 4, 3, 3); }
    invadersCtx.restore();
  }

  invadersCtx.fillStyle = '#FF0000'; invadersCtx.font = '14px monospace'; invadersCtx.textBaseline = 'top';
  state.enemyBullets.forEach(bullet=>{ invadersCtx.fillText('|', Math.round(bullet.x), Math.round(bullet.y)); });

  invadersCtx.fillStyle = '#00FFFF'; for (let i=0;i<state.player.lives;i++){ invadersCtx.fillRect(10 + i * (state.player.width + 10), 380, state.player.width, state.player.height); }

  invadersCtx.font = '15px "Courier New", monospace'; invadersCtx.fillStyle = '#fff'; invadersCtx.fillText(`Score: ${state.score}`, 12, 18);
  invadersCtx.fillStyle = '#88FFFF'; invadersCtx.fillText(`Level: ${state.level}`, invadersCanvas.width - 90, 18);
  if (invadersMessageEl) { invadersCtx.font = '14px Arial'; invadersCtx.fillStyle = '#FFD700'; invadersCtx.fillText(invadersMessageEl.textContent, 16, 35); }
}

function invadersGameLoop(){ if (invaderState.gameOver) return; updateInvaders(); drawInvaders(); invaderState.gameLoopId = requestAnimationFrame(invadersGameLoop); }

function startNextLevel() {
  const state = invaderState; state.level++;
  if (invadersMessageEl) invadersMessageEl.textContent = `Space Invaders++ — Level ${state.level}`;
  state.enemyBullets = []; state.bullet.active = false; state.bullet.alive = false;
  state.enemyMoveInterval = Math.max(5, 30 - (state.level-1)*2); state.enemyMoveTimer = state.enemyMoveInterval;
  state.dropSpeed = 10 + (state.level-1)*2;
  createEnemies(); createBunkers();
  if (invadersMessageEl) { const palette = invaderPalettes2[(state.level-1)%invaderPalettes2.length]; invadersMessageEl.style.color = palette; setTimeout(()=>{ if (invadersMessageEl) invadersMessageEl.style.color = '#eee'; }, 1200); }
}

function startInvaders() {
  if (invaderState.gameLoopId) { cancelAnimationFrame(invaderState.gameLoopId); invaderState.gameLoopId = null; }
  invaderState.gameOver = false; invaderState.score = 0; invaderState.level = 1; invaderState.enemyBullets = [];
  invaderState.bullet.active = false; invaderState.bullet.alive = false;
  invaderState.player.x = Math.max(10, (invadersCanvas ? invadersCanvas.width : 300)/2 - invaderState.player.width/2);
  invaderState.player.lives = 3; invaderState.player.alive = true; invaderState.enemyDirection = 1;
  invaderState.enemyMoveTimer = 0; invaderState.enemyMoveInterval = 30; invaderState.mysteryShip.active = false; invaderState.mysteryShip.alive = false; invaderState.dropSpeed = 10;
  if (invadersScoreEl) invadersScoreEl.textContent = "Score: 0"; if (invadersMessageEl) invadersMessageEl.textContent = "Good luck!"; if (startInvadersBtn) startInvadersBtn.textContent = 'Restart';
  createEnemies(); createBunkers(); invaderState.gameLoopId = requestAnimationFrame(invadersGameLoop);
}

function stopInvaders(message="GAME OVER"){
  invaderState.gameOver = true;
  if (invaderState.gameLoopId) { cancelAnimationFrame(invaderState.gameLoopId); invaderState.gameLoopId=null; }
  if (invadersMessageEl) invadersMessageEl.textContent = message;
  if (startInvadersBtn) startInvadersBtn.textContent = 'Start';
}

function handleInvadersKey(event){
  if (!invadersModal || invadersModal.style.display !== 'flex') return;
  const state = invaderState;
  if (event.key === ' ' || event.key === 'Spacebar') {
    event.preventDefault();
    if (state.gameOver) { startInvaders(); return; }
    if (!state.bullet.active && state.player.alive) {
      state.bullet.x = state.player.x + (state.player.width/2) - (state.bullet.width/2);
      state.bullet.y = state.player.y;
      state.bullet.active = true; state.bullet.alive = true;
    }
  }
  if (state.gameOver || !state.player.alive) return;
  if (event.key === 'ArrowLeft') { event.preventDefault(); state.player.x = Math.max(0, state.player.x - 12); }
  if (event.key === 'ArrowRight') { event.preventDefault(); state.player.x = Math.min(invadersCanvas.width - state.player.width, state.player.x + 12); }
}

// --- INITIALIZATION & BINDINGS ---
// All button bindings and modal handlers attached here to ensure elements exist.
document.addEventListener('DOMContentLoaded', () => {
  // query DOM elements now
  tetrisModal = $id('tetrisModal');
  runTetrisBtn = $id('runTetrisBtn');
  modalCloseBtn = $id('modalCloseBtn');
  canvas = $id('game');
  ctx = canvas ? canvas.getContext('2d') : null;
  scoreP = $id('score');
  startBtn = $id('startBtn');
  controlsBtn = $id('controlsBtn');

  racerModal = $id('racerModal');
  runRacerBtn = $id('runRacerBtn');
  racerModalCloseBtn = $id('racerModalCloseBtn');
  racerCanvas = $id('racer-canvas');
  racerCtx = racerCanvas ? racerCanvas.getContext('2d') : null;
  racerDistanceEl = $id('racer-distance');
  racerSpeedEl = $id('racer-speed');
  racerObstaclesEl = $id('racer-obstacles');
  racerMessageEl = $id('racer-message');
  startRacerBtn = $id('startRacerBtn');
  pauseRacerBtn = $id('pauseRacerBtn');
  resetRacerBtn = $id('resetRacerBtn');

  invadersModal = $id('invadersModal');
  runInvadersBtn = $id('runInvadersBtn');
  invadersModalCloseBtn = $id('invadersModalCloseBtn');
  invadersCanvas = $id('invaders-canvas');
  invadersCtx = invadersCanvas ? invadersCanvas.getContext('2d') : null;
  invadersMessageEl = $id('invaders-message');
  startInvadersBtn = $id('startInvadersBtn');
  invadersScoreEl = $id('invaders-score');

  // TETRIS: Run button opens modal and sets text; start button binds in initTetrisGame
  if (runTetrisBtn) {
    runTetrisBtn.addEventListener('click', function(e){
      e.preventDefault();
      if (tetrisModal) tetrisModal.style.display = 'flex';
      if (typeof loadHighScore === 'function') loadHighScore();
      if (startBtn) startBtn.textContent = 'Start';
    });
  }
  if (modalCloseBtn) modalCloseBtn.addEventListener('click', function(){ if (tetrisModal) tetrisModal.style.display='none'; if (game){ clearInterval(game); game=null;} block=null; if (ctx){ ctx.fillStyle='#050505'; ctx.fillRect(0,0,canvas.width,canvas.height); } });

  if (tetrisModal) tetrisModal.addEventListener('click', function(e){ if (e.target === tetrisModal) { if (tetrisModal) tetrisModal.style.display='none'; if (game){ clearInterval(game); game=null;} block=null; if (ctx){ ctx.fillStyle='#050505'; ctx.fillRect(0,0,canvas.width,canvas.height); } } });

  // Racer run/open/close
  if (runRacerBtn) {
    runRacerBtn.addEventListener('click', function(e){ e.preventDefault(); if (racerModal) racerModal.style.display='flex'; if (typeof resetRacer === 'function') resetRacer(); });
  }
  if (racerModalCloseBtn) racerModalCloseBtn.addEventListener('click', function(){ if (racerModal) racerModal.style.display='none'; if (typeof pauseRacer === 'function') pauseRacer(); });
  if (racerModal) racerModal.addEventListener('click', function(e){ if (e.target === racerModal) { if (racerModal) racerModal.style.display='none'; if (typeof pauseRacer === 'function') pauseRacer(); } });

  // Invaders run/open/close
  if (runInvadersBtn) {
    runInvadersBtn.addEventListener('click', function(e){ e.preventDefault(); if (invadersModal) invadersModal.style.display='flex'; if (invadersMessageEl) invadersMessageEl.textContent = "Press Start!"; });
  }
  if (invadersModalCloseBtn) invadersModalCloseBtn.addEventListener('click', function(){ if (invadersModal) invadersModal.style.display='none'; if (typeof stopInvaders === 'function') stopInvaders(); });
  if (invadersModal) invadersModal.addEventListener('click', function(e){ if (e.target === invadersModal) { if (invadersModal) invadersModal.style.display='none'; if (typeof stopInvaders === 'function') stopInvaders(); } });

  // Bind Tetris controls (init)
  if (typeof initTetrisGame === 'function') initTetrisGame();
  // Attach tetris keyboard handlers globally
  document.addEventListener('keydown', tetrisKeydown);
  document.addEventListener('keyup', tetrisKeyup);

  // Init Racer
  if (racerCanvas) {
    laneWidth = racerCanvas.width / laneCount;
    playerCar.baseWidth = laneWidth * 0.55;
    playerCar.width = playerCar.baseWidth;
    playerCar.y = racerCanvas.height - 90;
    laneCenters = Array.from({ length: laneCount }, (_, i) => i * laneWidth + laneWidth / 2);
    playerCar.x = laneCenters[playerCar.lane];
  }
  if (typeof initRacerGame === 'function') initRacerGame();

  // Init Invaders
  if (typeof initInvadersGame === 'function') initInvadersGame();

  // Log to console for debugging
  console.log('experimental.js: bindings attached and games initialized (if elements present).');
});

// Expose init functions in case external code needs them
window.initTetrisGame = function() {
  if (startBtn) startBtn.addEventListener('click', startTetris);
  if (controlsBtn) controlsBtn.addEventListener('click', function() {
    alert('Controls:\nRight Arrow: Right\nLeft Arrow: Left\nSpace Bar: Rotate\nDown Arrow: Speed Up Fall');
  });
  loadHighScore();
};
window.initRacerGame = initRacerGame;
window.initInvadersGame = function() {
  if (startInvadersBtn) startInvadersBtn.addEventListener('click', startInvaders);
  if (!document.__invadersBound) { document.addEventListener('keydown', handleInvadersKey); document.__invadersBound = true; }
  if (invadersCtx) { invadersCtx.fillStyle = '#000'; invadersCtx.fillRect(0,0,invadersCanvas.width,invadersCanvas.height); }
};

// End of file
