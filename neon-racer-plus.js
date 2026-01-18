import { getHighScore, submitHighScore } from './score-store.js';

(function () {
  // Neon Racer++ (full implementation restored from original experimental.js)
  const win = typeof window !== 'undefined' ? window : globalThis;

  // DOM references
  const racerModal = document.getElementById('racerModal');
  const runRacerBtn = document.getElementById('runRacerBtn');
  const racerModalCloseBtn = document.getElementById('racerModalCloseBtn');

  const racerCanvas = document.getElementById('racer-canvas');
  const racerCtx = racerCanvas ? racerCanvas.getContext('2d') : null;
  const racerDistanceEl = document.getElementById('racer-distance');
  const racerSpeedEl = document.getElementById('racer-speed');
  const racerObstaclesEl = document.getElementById('racer-obstacles');
  const racerShieldEl = document.getElementById('racer-shield');
  const racerBoostEl = document.getElementById('racer-boost');
  const racerMessageEl = document.getElementById('racer-message');
  const startRacerBtn = document.getElementById('startRacerBtn');
  const pauseRacerBtn = document.getElementById('pauseRacerBtn');
  const resetRacerBtn = document.getElementById('resetRacerBtn');

  // Guard if canvas not present
  if (!racerCanvas) {
    // Provide no-op globals to avoid UI errors
    win.initRacerGame = function () {};
    win.startRacer = function () { console.warn('racer canvas missing'); };
    win.pauseRacer = function () {};
    win.resetRacer = function () {};
    win.loadRacerHighScore = function () {};
    win.saveRacerHighScore = function () {};
    win.updateRacerHud = function () {};
    return;
  }

  // Constants and State (restored from original)
  const laneCount = 3;
  const laneWidth = racerCanvas.width / laneCount;
  const horizonY = 120;
  const canvasWidth = racerCanvas.width;
  const canvasHeight = racerCanvas.height;
  const roadWidthAtBottom = racerCanvas.width * 1.6;
  const roadWidthTop = racerCanvas.width * 0.08;

  const playerCar = {
      lane: 0,
      baseWidth: 0,
      width: 0,
      height: 58,
      y: racerCanvas ? racerCanvas.height - 90 : 410,
      x: racerCanvas ? racerCanvas.width / 2 : 170
  };

  const racerState = {
      running: false,
      crashed: false,
      lastTimestamp: 0,
      speed: 180,
      distance: 0,
      dodged: 0,
      mostGapsCleared: 0,
      nearMisses: 0,
      shield: 0,
      boostTimer: 0,
      obstacles: [],
      aiCars: [],
      aiSpawnTimer: 0,
      aiSpawnStartTime: 1600,
      pickups: [],
      speedLines: [],
      stars: [],
      spawnTimer: 0,
      animationFrame: null,
      spawnStartTime: 2100,
      spawnMinTime: 760,
      spawnTimeVariance: 200,
      spawnTimeTightenRate: 20,
      gapWidthStartMultiplier: 2.05,
      gapWidthMinMultiplier: 1.45,
      gapWidthTightenRate: 0.018,
      particles: [],
      explosionParticles: [],
      laneLerpSpeed: 0.2,
      shake: { x: 0, y: 0, intensity: 0 },
      flash: { alpha: 0 },
      crashAnimId: null,
      carSway: 0,
      carSwaySpeed: 0.008,
      carSwayMax: 0.035,
      carTilt: 0,
      carTiltMax: 0.1,
      carTiltSpeed: 0.16,
      edgeFlash: 0
  };

  const obstacleHeight = 60;

  // Perspective scaling & helpers
  function getPerspectiveScale(y) {
      if (y < horizonY) return 0;
      let normalizedY = (y - horizonY) / (canvasHeight - horizonY);
      let scale = Math.pow(normalizedY, 2.2);
      return Math.max(0.01, Math.min(scale, 1.0));
  }

  function roadWidthAtY(y) {
      const s = getPerspectiveScale(y);
      return (roadWidthAtBottom - roadWidthTop) * s + roadWidthTop;
  }

  function laneCenterAtY(laneIndex, targetY, roadWidthAtPlayerStored) {
      const vp = canvasWidth / 2;
      const playerLaneCenterAtPlayer = vp + laneIndex * (roadWidthAtPlayerStored / 3);
      const offsetFromVP = playerLaneCenterAtPlayer - vp;
      const rwY = roadWidthAtY(targetY);
      return vp + offsetFromVP * (rwY / roadWidthAtPlayerStored);
  }

  function getObstacleGap(ob) {
      const roadWPlayer = ob.roadWidthAtPlayer || roadWidthAtY(playerCar.y);
      const roadWAtY = roadWidthAtY(ob.y);
      const shift = (ob.gapShift || 0) * (roadWAtY / roadWPlayer);
      let center = laneCenterAtY(ob.gapLane, ob.y, roadWPlayer) + shift;
      const width = ob.gapWidthAtPlayer * (roadWAtY / roadWPlayer);
      const roadLeft = (canvasWidth / 2) - (roadWAtY / 2);
      const roadRight = (canvasWidth / 2) + (roadWAtY / 2);
      const half = width / 2;
      center = Math.max(roadLeft + half, Math.min(center, roadRight - half));
      return {
          center,
          width,
          left: center - half,
          right: center + half,
          roadWPlayer
      };
  }

  // Particle/effects functions
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
      racerState.crashed = true;
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
      racerState.shake.intensity = 1.2;
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
          } else if (p.type === 'trail') {
              racerCtx.save();
              const lifeRatio = Math.max(0, p.life / p.maxLife);
              racerCtx.strokeStyle = `rgba(130, 220, 255, ${lifeRatio * 0.7})`;
              racerCtx.lineWidth = p.size * lifeRatio;
              racerCtx.beginPath();
              racerCtx.moveTo(p.x, p.y);
              racerCtx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
              racerCtx.stroke();
              racerCtx.restore();

              p.x += p.vx;
              p.y += p.vy;
              p.vy += 0.02;
              p.vx += (playerCar.x - p.x) * 0.01;
              p.vx *= 0.98;
              p.life -= 1;
              if (p.life <= 0) racerState.particles.splice(i, 1);
          }
      }
  }

  // Starfield
  function ensureStars() {
      if (!racerCanvas) return;
      while (racerState.stars.length < 150) {
          racerState.stars.push({
              x: (Math.random() - 0.5) * canvasWidth * 2,
              y: (Math.random() - 0.5) * canvasHeight,
              z: Math.random() * canvasWidth
          });
      }
  }

  function drawStars() {
      if (!racerCtx) return;
      const vpX = canvasWidth / 2;
      const vpY = horizonY;

      racerCtx.fillStyle = '#FFFFFF';
      racerCtx.save();
      racerCtx.translate(vpX, vpY);

      racerState.stars.forEach(star => {
          const sx = star.x * (vpX / star.z);
          const sy = star.y * (vpY / star.z);
          const size = (1 - star.z / canvasWidth) * 3;
          if (sx < -vpX || sx > vpX || sy < -vpY || sy > (canvasHeight - vpY)) {
              return;
          }
          const alpha = (1 - star.z / canvasWidth) * 0.8;
          racerCtx.globalAlpha = Math.max(0.1, alpha);
          racerCtx.fillRect(sx - size / 2, sy - size / 2, size, size);
      });

      racerCtx.restore();
      racerCtx.globalAlpha = 1.0;
  }

  function drawBackground() {
      if (!racerCtx || !racerCanvas) return;
      racerCtx.fillStyle = '#0a0e24';
      racerCtx.fillRect(0, 0, racerCanvas.width, racerCanvas.height);

      drawStars();
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
  }

  function drawPerspectiveGrid() {
      if (!racerCtx || !racerCanvas) return;
      const vpX = racerCanvas.width / 2;
      const vpY = horizonY;
      const bottomY = racerCanvas.height;

      racerCtx.strokeStyle = 'rgba(28, 255, 255, 0.25)';
      racerCtx.lineWidth = 2;
      const numLines = 10;
      for (let i = 0; i <= numLines; i++) {
          const ratio = i / numLines;
          const xTopL = vpX - roadWidthTop * (1 - ratio);
          const xBottomL = vpX - roadWidthAtBottom * (1 - ratio);
          racerCtx.beginPath(); racerCtx.moveTo(xTopL, vpY); racerCtx.lineTo(xBottomL, bottomY); racerCtx.stroke();
          const xTopR = vpX + roadWidthTop * (1 - ratio);
          const xBottomR = vpX + roadWidthAtBottom * (1 - ratio);
          racerCtx.beginPath(); racerCtx.moveTo(xTopR, vpY); racerCtx.lineTo(xBottomR, bottomY); racerCtx.stroke();
      }
  }

  function drawSpeedLines() {
      if (!racerCtx) return;
      const vpX = racerCanvas.width / 2;
      const vpY = horizonY;

      racerCtx.strokeStyle = 'rgba(100, 220, 255, 0.4)';
      racerCtx.lineWidth = 1.5;

      racerState.speedLines.forEach(line => {
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

  function drawGlow() {
      if (!racerCtx) return;

      racerCtx.save();
      racerCtx.shadowBlur = 36;

      racerState.obstacles.forEach(ob => {
          const scale = getPerspectiveScale(ob.y);
          if (scale < 0.01) return;

          const scaledHeight = obstacleHeight * scale;
          const top = ob.y - scaledHeight;
          const gap = getObstacleGap(ob);
          const gapLeft = gap.left;
          const gapRight = gap.right;

          racerCtx.shadowColor = ob.color;
          racerCtx.fillStyle = 'rgba(0,0,0,0)';
          if (gapLeft > 0) {
              racerCtx.fillRect(0, top, gapLeft, scaledHeight);
          }
          if (gapRight < racerCanvas.width) {
              racerCtx.fillRect(gapRight, top, racerCanvas.width - gapRight, scaledHeight);
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

  function updatePlayerLanePosition(delta) {
      const playerScale = getPerspectiveScale(playerCar.y);
      const roadWidthAtPlayer = (roadWidthAtBottom - roadWidthTop) * playerScale + roadWidthTop;
      const scaledLaneWidth = roadWidthAtPlayer / 3;
      const targetX = (canvasWidth / 2) + (scaledLaneWidth * playerCar.lane);

      const effectiveDelta = delta || 16.67;
      const lerpAmount = 1 - Math.pow(1 - racerState.laneLerpSpeed, effectiveDelta / 16.67);
      playerCar.x += (targetX - playerCar.x) * lerpAmount;

      const targetTilt = (playerCar.x - targetX) * -0.005;
      const tiltLerp = 1 - Math.pow(1 - racerState.carTiltSpeed, effectiveDelta / 16.67);
      racerState.carTilt += (targetTilt - racerState.carTilt) * tiltLerp;
      racerState.carTilt = Math.max(-racerState.carTiltMax, Math.min(racerState.carTiltMax, racerState.carTilt));

      racerState.carSway = Math.sin(racerState.distance * racerState.carSwaySpeed) * racerState.carSwayMax;
  }

  function drawPlayer() {
      if (!racerCtx) return;
      racerCtx.save();
      racerCtx.translate(playerCar.x, playerCar.y + playerCar.height * 0.75);
      racerCtx.rotate(racerState.carSway + racerState.carTilt);

      const w = playerCar.width;
      const h = playerCar.height;
      const carY = -h * 0.75;

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

      racerCtx.fillStyle = '#0b1f3a';
      racerCtx.beginPath();
      racerCtx.moveTo(-w * 0.15, carY + h * 0.8);
      racerCtx.lineTo(w * 0.15, carY + h * 0.8);
      racerCtx.quadraticCurveTo(w * 0.25, carY + h * 0.5, 0, carY + h * 0.2);
      racerCtx.quadraticCurveTo(-w * 0.25, carY + h * 0.5, -w * 0.15, carY + h * 0.8);
      racerCtx.closePath();
      racerCtx.fill();

      racerCtx.fillStyle = '#3be7ff';
      racerCtx.fillRect(-w * 0.05, carY + h * 0.2, w * 0.1, h * 0.6);

      if (racerState.shield > 0) {
          racerCtx.save();
          racerCtx.globalAlpha = 0.5;
          racerCtx.strokeStyle = '#7dd3fc';
          racerCtx.lineWidth = 2;
          racerCtx.beginPath();
          racerCtx.arc(0, carY + h * 0.55, w * 0.55 + 6, 0, Math.PI * 2);
          racerCtx.stroke();
          racerCtx.restore();
      }

      racerCtx.restore();
  }

  function drawObstacles() {
      if (!racerCtx) return;

      racerState.obstacles.sort((a, b) => a.y - b.y);

      racerState.obstacles.forEach(ob => {
          const scale = getPerspectiveScale(ob.y);
          if (scale < 0.01) return;

          const scaledHeight = obstacleHeight * scale;
          const top = ob.y - scaledHeight;

          const gap = getObstacleGap(ob);
          const gapLeft = gap.left;
          const gapRight = gap.right;
          const edgeHeight = 6 * scale;

          if (gapLeft > 0) {
              racerCtx.fillStyle = ob.color;
              racerCtx.fillRect(0, top + edgeHeight, gapLeft, scaledHeight - edgeHeight);
              racerCtx.fillStyle = `hsl(${ob.hue}, 100%, 85%)`;
              racerCtx.fillRect(0, top, gapLeft, edgeHeight);
          }
          if (gapRight < racerCanvas.width) {
              racerCtx.fillStyle = ob.color;
              racerCtx.fillRect(gapRight, top + edgeHeight, canvasWidth - gapRight, scaledHeight - edgeHeight);
              racerCtx.fillStyle = `hsl(${ob.hue}, 100%, 85%)`;
              racerCtx.fillRect(gapRight, top, canvasWidth - gapRight, edgeHeight);
          }
      });
  }

  function drawAICars() {
      if (!racerCtx) return;
      racerState.aiCars.forEach(ai => {
          const scale = getPerspectiveScale(ai.y);
          if (scale < 0.02) return;
          const centerX = laneCenterAtY(ai.lanePos, ai.y, ai.roadWidthAtPlayer);
          const w = playerCar.baseWidth * scale * 0.9;
          const h = playerCar.height * scale * 0.9;
          racerCtx.save();
          racerCtx.translate(centerX, ai.y + h * 0.2);
          racerCtx.fillStyle = ai.color;
          racerCtx.beginPath();
          racerCtx.moveTo(-w * 0.35, h * 0.2);
          racerCtx.lineTo(w * 0.35, h * 0.2);
          racerCtx.lineTo(w * 0.25, -h * 0.4);
          racerCtx.lineTo(-w * 0.25, -h * 0.4);
          racerCtx.closePath();
          racerCtx.fill();
          racerCtx.restore();
      });
  }

  function drawPickups() {
      if (!racerCtx) return;
      racerState.pickups.forEach(pick => {
          const scale = getPerspectiveScale(pick.y);
          if (scale < 0.02) return;
          const roadWPlayer = pick.roadWidthAtPlayer || roadWidthAtY(playerCar.y);
          const centerX = laneCenterAtY(pick.lane, pick.y, roadWPlayer);
          const padW = (roadWidthAtY(pick.y) / 3) * 0.5;
          const padH = 8 * scale + 4;
          racerCtx.save();
          racerCtx.shadowBlur = 18;
          racerCtx.shadowColor = pick.type === 'shield' ? '#7dd3fc' : '#fbbf24';
          racerCtx.fillStyle = pick.type === 'shield' ? '#7dd3fc' : '#fbbf24';
          racerCtx.fillRect(centerX - padW / 2, pick.y - padH / 2, padW, padH);
          racerCtx.restore();
      });
  }

  function spawnObstacle() {
      const lanes = [-1, 0, 1];
      const gapLane = lanes[Math.floor(Math.random() * lanes.length)];
      const colorHue = Math.floor(Math.random() * 360);

      const currentGapMultiplier = Math.max(
          racerState.gapWidthMinMultiplier,
          racerState.gapWidthStartMultiplier - (racerState.dodged * racerState.gapWidthTightenRate)
      );

      const playerScale = getPerspectiveScale(playerCar.y);
      const roadWidthAtPlayer = (roadWidthAtBottom - roadWidthTop) * playerScale + roadWidthTop;
      const laneWidthAtPlayer = roadWidthAtPlayer / 3;
      let gapWidthAtPlayer = (laneWidthAtPlayer * 0.6) * currentGapMultiplier;

      const minSafeGap = Math.max(playerCar.width * 1.15, playerCar.baseWidth, laneWidthAtPlayer * 0.6);
      if (gapWidthAtPlayer < minSafeGap) {
          gapWidthAtPlayer = minSafeGap;
      }

      gapWidthAtPlayer = Math.min(gapWidthAtPlayer, 280);

      const spawnY = horizonY;

      const shiftLimit = laneWidthAtPlayer * 0.22;
      const gapShift = (Math.random() - 0.5) * shiftLimit;
      const shiftSpeed = (Math.random() - 0.5) * 30;

      racerState.obstacles.push({
          y: spawnY,
          gapLane: gapLane,
          gapWidthAtPlayer: gapWidthAtPlayer,
          roadWidthAtPlayer: roadWidthAtPlayer,
          gapShift,
          shiftSpeed,
          closeCall: false,
          color: `hsl(${colorHue}, 90%, 60%)`,
          hue: colorHue
      });

      if (Math.random() < 0.22) {
          const pickupType = Math.random() < 0.45 ? 'shield' : 'boost';
          racerState.pickups.push({
              y: spawnY - 20,
              lane: gapLane,
              roadWidthAtPlayer,
              type: pickupType
          });
      }

      const dynamicForwardTime = Math.max(
          racerState.spawnMinTime,
          racerState.spawnStartTime - racerState.dodged * racerState.spawnTimeTightenRate
      );
      racerState.spawnTimer = dynamicForwardTime + Math.random() * racerState.spawnTimeVariance;

      racerState.edgeFlash = 20;
  }

  function spawnAICar(startY) {
      const lanes = [-1, 0, 1];
      const lane = lanes[Math.floor(Math.random() * lanes.length)];
      const roadWidthAtPlayer = roadWidthAtY(playerCar.y);
      const colorHue = Math.floor(Math.random() * 360);
      const spawnY = typeof startY === 'number' ? startY : (horizonY + 140 + Math.random() * 60);
      racerState.aiCars.push({
          y: spawnY,
          lane,
          lanePos: lane,
          laneTarget: lane,
          roadWidthAtPlayer,
          speedFactor: 0.85 + Math.random() * 0.35,
          shiftTimer: 600 + Math.random() * 600,
          color: `hsl(${colorHue}, 90%, 58%)`
      });
  }

  function resetObstacles() {
      racerState.obstacles = [];
      racerState.spawnTimer = 0;
  }

  function ensureSpeedLines() {
      if (!racerCanvas) return;
      while (racerState.speedLines.length < 40) {
          racerState.speedLines.push({
              angle: Math.random() * Math.PI * 2,
              dist: 5 + Math.random() * 50,
              length: 18 + Math.random() * 28,
              speed: 0.5 + Math.random() * 0.5
          });
      }
  }

  function applyShakeTransform() {
      if (!racerCtx || (racerState.shake.x === 0 && racerState.shake.y === 0)) return;
      racerCtx.translate(Math.floor(racerState.shake.x), Math.floor(racerState.shake.y));
  }

  function startCrashAnimation() {
      if (racerState.crashAnimId) {
          cancelAnimationFrame(racerState.crashAnimId);
          racerState.crashAnimId = null;
      }
      const loop = (timestamp) => {
          const delta = timestamp - (racerState.lastCrashTimestamp || timestamp);
          racerState.lastCrashTimestamp = timestamp;

          renderRacer(delta);

          const activeParticles = (racerState.explosionParticles.length > 0) || (racerState.particles.length > 0);
          const activeShake = racerState.shake.intensity > 0.02;
          const activeFlash = racerState.flash.alpha > 0.02;

          if (activeParticles || activeFlash || activeShake) {
              racerState.crashAnimId = requestAnimationFrame(loop);
          } else {
              racerState.flash.alpha = 0;
              racerState.shake.intensity = 0;
              racerState.crashAnimId = null;
          }
      };
      racerState.lastCrashTimestamp = performance.now();
      racerState.crashAnimId = requestAnimationFrame(loop);
  }

  function updateRacer(delta) {
      if (!racerCanvas || racerState.crashed) return;

      updatePlayerLanePosition(delta);

      const speedInPxPerSecond = racerState.speed * 1.5;
      const traveled = (speedInPxPerSecond * (delta / 1000));

      const baseSpeed = 180 + racerState.dodged * 6 + Math.floor(racerState.distance / 800);
      if (racerState.boostTimer > 0) {
          racerState.boostTimer = Math.max(0, racerState.boostTimer - delta);
      }
      const boostBonus = racerState.boostTimer > 0 ? 140 : 0;
      racerState.speed = Math.min(560, baseSpeed + boostBonus);
      racerState.distance += traveled;

      racerState.spawnTimer -= delta;
      if (racerState.spawnTimer <= 0) {
          spawnObstacle();
      }

      racerState.aiSpawnTimer -= delta;
      if (racerState.aiSpawnTimer <= 0) {
          spawnAICar();
          racerState.aiSpawnTimer = Math.max(900, racerState.aiSpawnStartTime - Math.min(1100, racerState.dodged * 35));
      }

      racerState.obstacles.forEach(ob => {
          ob.y += traveled;
          if (ob.shiftSpeed) {
              const laneWidthAtPlayer = (ob.roadWidthAtPlayer || roadWidthAtY(playerCar.y)) / 3;
              const shiftLimit = laneWidthAtPlayer * 0.28;
              ob.gapShift += ob.shiftSpeed * (delta / 1000);
              if (ob.gapShift > shiftLimit || ob.gapShift < -shiftLimit) {
                  ob.shiftSpeed *= -1;
              }
          }
      });

      racerState.obstacles = racerState.obstacles.filter(ob => {
          if (ob.y > racerCanvas.height + obstacleHeight) {
              racerState.dodged += 1;
              spawnWhooshLines(canvasWidth / 2, racerCanvas.height - 40);
              const scale = Math.min(1.1, 1 + racerState.dodged * 0.008);
              playerCar.width = playerCar.baseWidth * scale;
              if (ob.closeCall) {
                  racerState.nearMisses += 1;
                  racerState.boostTimer = Math.max(racerState.boostTimer, 600);
                  if (racerMessageEl) racerMessageEl.textContent = 'Near miss! Boost surge.';
              }
              if (racerState.dodged > 0 && racerState.dodged % 10 === 0) {
                  if (racerMessageEl) racerMessageEl.textContent = `Boost! Speed increased.`;
              }
              return false;
          }
          return true;
      });

      racerState.aiCars.forEach(ai => {
          ai.y += traveled * ai.speedFactor;
          ai.shiftTimer -= delta;
          if (ai.shiftTimer <= 0) {
              const shift = Math.random() < 0.5 ? -1 : 1;
              ai.laneTarget = Math.max(-1, Math.min(1, ai.laneTarget + shift));
              ai.shiftTimer = 500 + Math.random() * 800;
          }
          ai.lanePos += (ai.laneTarget - ai.lanePos) * 0.06;
      });
      racerState.aiCars = racerState.aiCars.filter(ai => ai.y < racerCanvas.height + 80);

      racerState.pickups.forEach(pick => {
          pick.y += traveled;
      });
      racerState.pickups = racerState.pickups.filter(pick => {
          if (pick.y > racerCanvas.height + 40) return false;
          const pickupY = pick.y;
          const roadWPlayer = pick.roadWidthAtPlayer || roadWidthAtY(playerCar.y);
          const centerX = laneCenterAtY(pick.lane, pickupY, roadWPlayer);
          const inBand = Math.abs(pickupY - (playerCar.y + playerCar.height * 0.4)) < 26;
          const inLane = Math.abs(playerCar.x - centerX) < playerCar.width * 0.45;
          if (inBand && inLane) {
              if (pick.type === 'shield') {
                  racerState.shield = Math.min(2, racerState.shield + 1);
                  if (racerMessageEl) racerMessageEl.textContent = 'Shield charged.';
              } else if (pick.type === 'boost') {
                  racerState.boostTimer = Math.max(racerState.boostTimer, 1200);
                  if (racerMessageEl) racerMessageEl.textContent = 'Boost engaged!';
              }
              spawnParticles(centerX, pickupY, pick.type === 'shield' ? '#7dd3fc' : '#fbbf24', 14);
              return false;
          }
          return true;
      });

      const speedMod = (racerState.speed / 180);
      racerState.speedLines.forEach(line => {
          line.dist += traveled * 0.08 * line.speed * speedMod;
          line.length = 18 + Math.random() * 28 + line.dist * 0.1;
          if (line.dist > canvasWidth) {
              line.dist = 5 + Math.random() * 10;
              line.angle = Math.random() * Math.PI * 2;
              line.speed = 0.5 + Math.random() * 0.5;
          }
      });
      ensureSpeedLines();

      racerState.stars.forEach(star => {
          star.z -= traveled * 0.1;
          if (star.z <= 0.1) {
              star.x = (Math.random() - 0.5) * canvasWidth * 2;
              star.y = (Math.random() - 0.5) * canvasHeight;
              star.z = canvasWidth;
          }
      });
      ensureStars();

      const speedRatio = (racerState.speed - 180) / (520 - 180);
      const targetIntensity = speedRatio * 0.2;
      if (racerState.shake.intensity > targetIntensity) {
          racerState.shake.intensity = Math.max(targetIntensity, racerState.shake.intensity * 0.92);
      } else {
          racerState.shake.intensity = targetIntensity;
      }
      if (racerState.shake.intensity > 0.01) {
          racerState.shake.x = (Math.random() - 0.5) * racerState.shake.intensity * 10;
          racerState.shake.y = (Math.random() - 0.5) * racerState.shake.intensity * 10;
      } else {
          racerState.shake.x = 0;
          racerState.shake.y = 0;
      }

      if (racerState.running && Math.random() > 0.3) {
          const carAngle = racerState.carSway + racerState.carTilt;
          const spawnX = playerCar.x + Math.sin(carAngle) * (playerCar.height * 0.5);
          const spawnY = playerCar.y + playerCar.height - 10;
          racerState.particles.push({
              type: 'trail',
              x: spawnX + (Math.random() - 0.5) * 10,
              y: spawnY + (Math.random() - 0.5) * 5,
              vx: (Math.random() - 0.5) * 0.5,
              vy: 2.0 + Math.random() * 1.0,
              life: 25 + Math.random() * 15,
              maxLife: 40,
              size: 2 + Math.random() * 2,
          });
      }

      const playerScale = getPerspectiveScale(playerCar.y);
      const roadWidthPlayer = roadWidthAtY(playerCar.y);
      const exactPlayerCenterX = playerCar.x;

      const collisionWidth = playerCar.width * 0.9;
      const carLeft = exactPlayerCenterX - collisionWidth / 2;
      const carRight = exactPlayerCenterX + collisionWidth / 2;
      const carTop = playerCar.y;
      const carBottom = playerCar.y + playerCar.height;

      for (let i = 0; i < racerState.obstacles.length; i++) {
          const ob = racerState.obstacles[i];
          const scale = getPerspectiveScale(ob.y);
          const scaledHeight = obstacleHeight * scale;
          const obTop = ob.y - scaledHeight;
          const obBottom = ob.y;

          const gap = getObstacleGap(ob);
          const gapLeft = gap.left;
          const gapRight = gap.right;

          if (carBottom <= obTop || carTop >= obBottom) continue;

          const baseCushion = Math.max(2, Math.round(collisionWidth * 0.03));
          const safeGapLeft = gapLeft - baseCushion;
          const safeGapRight = gapRight + baseCushion;
          const nearMargin = Math.max(8, Math.round(collisionWidth * 0.12));

          if (!ob.closeCall) {
              if (carLeft < gapLeft + nearMargin || carRight > gapRight - nearMargin) {
                  ob.closeCall = true;
              }
          }

          if (carLeft < safeGapLeft || carRight > safeGapRight) {
              if (racerState.shield > 0) {
                  racerState.shield -= 1;
                  racerState.flash.alpha = 0.6;
                  racerState.shake.intensity = Math.max(racerState.shake.intensity, 0.2);
                  spawnParticles(playerCar.x, playerCar.y + playerCar.height / 2, '#7dd3fc', 24);
                  racerState.obstacles.splice(i, 1);
                  i -= 1;
                  if (racerMessageEl) racerMessageEl.textContent = 'Shield absorbed impact.';
                  continue;
              }
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

      for (let i = 0; i < racerState.aiCars.length; i++) {
          const ai = racerState.aiCars[i];
          const scale = getPerspectiveScale(ai.y);
          if (scale < 0.02) continue;
          const centerX = laneCenterAtY(ai.lanePos, ai.y, ai.roadWidthAtPlayer);
          const aiW = playerCar.baseWidth * scale * 0.9;
          const aiH = playerCar.height * scale * 0.9;
          const aiLeft = centerX - aiW / 2;
          const aiRight = centerX + aiW / 2;
          const aiTop = ai.y - aiH * 0.7;
          const aiBottom = ai.y + aiH * 0.3;
          if (carBottom <= aiTop || carTop >= aiBottom) continue;

          if (carRight > aiLeft && carLeft < aiRight) {
              if (racerState.shield > 0) {
                  racerState.shield -= 1;
                  racerState.flash.alpha = 0.6;
                  racerState.shake.intensity = Math.max(racerState.shake.intensity, 0.2);
                  spawnParticles(centerX, ai.y, '#7dd3fc', 22);
                  racerState.aiCars.splice(i, 1);
                  i -= 1;
                  if (racerMessageEl) racerMessageEl.textContent = 'Shield blocked rival.';
                  continue;
              }
              if (racerState.animationFrame) {
                  cancelAnimationFrame(racerState.animationFrame);
                  racerState.animationFrame = null;
              }
              saveRacerHighScore();
              spawnCrash(playerCar.x, playerCar.y + playerCar.height / 2);
              racerState.running = false;
              startCrashAnimation();
              if (racerMessageEl) {
                  racerMessageEl.textContent = 'Collision! Reset to roll out again.';
              }
              return;
          }
      }
  }

  function renderRacer(delta) {
      if (!racerCtx) return;

      racerCtx.save();
      applyShakeTransform();

      drawBackground();
      drawSpeedLines();
      drawGlow();
      drawObstacles();
      drawAICars();
      drawPickups();
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
      if (!racerState.running && !racerState.crashed) return;

      const delta = timestamp - (racerState.lastTimestamp || timestamp);
      racerState.lastTimestamp = timestamp;

      if (racerState.running) {
          updateRacer(delta);
      }

      renderRacer(delta);
      updateHud();

      if (racerState.running) {
          racerState.animationFrame = requestAnimationFrame(gameLoop);
      }
  }

  function startRacer() {
      if (racerState.running) return;

      if (racerState.crashed) {
          resetRacer();
      }

      if (racerMessageEl) {
          racerMessageEl.textContent = 'Neon boost engaged!';
      }
      racerState.running = true;
      racerState.crashed = false;
      racerState.lastTimestamp = performance.now();
      racerState.spawnTimer = racerState.spawnStartTime;

      if (racerState.animationFrame) {
          cancelAnimationFrame(racerState.animationFrame);
      }
      racerState.animationFrame = requestAnimationFrame(gameLoop);
  }

  function pauseRacer() {
      if (!racerState.running) return;
      racerState.running = false;
      if (racerState.animationFrame) {
          cancelAnimationFrame(racerState.animationFrame);
          racerState.animationFrame = null;
      }
      if (racerMessageEl) {
          racerMessageEl.textContent = 'Paused. Hit start to keep racing.';
      }
  }

  function resetRacer() {
      if (racerState.crashAnimId) {
          cancelAnimationFrame(racerState.crashAnimId);
          racerState.crashAnimId = null;
      }
      pauseRacer();

      playerCar.lane = 0;

      const playerScale = getPerspectiveScale(playerCar.y);
      const roadWidthAtPlayer = (roadWidthAtBottom - roadWidthTop) * playerScale + roadWidthTop;
      playerCar.baseWidth = (roadWidthAtPlayer / 3) * 0.55;
      playerCar.width = playerCar.baseWidth;

      playerCar.x = canvasWidth / 2;
      playerCar.height = 58;

      racerState.speed = 180;
      racerState.distance = 0;
      racerState.dodged = 0;
      racerState.nearMisses = 0;
      racerState.shield = 0;
      racerState.boostTimer = 0;
      racerState.speedLines = [];
      racerState.stars = [];
      racerState.particles = [];
      racerState.explosionParticles = [];
      racerState.pickups = [];
      racerState.shake = { x: 0, y: 0, intensity: 0 };
      racerState.flash = { alpha: 0 };
      racerState.carSway = 0;
      racerState.carTilt = 0;
      racerState.edgeFlash = 0;
      racerState.crashed = false;

      resetObstacles();
      racerState.aiCars = [];
      for (let i = 0; i < 2; i++) {
          spawnAICar(horizonY + 160 + i * 90);
      }
      racerState.aiSpawnTimer = racerState.aiSpawnStartTime;
      ensureSpeedLines();
      ensureStars();

      renderRacer(0);
      updateHud();
      if (racerMessageEl) {
          racerMessageEl.textContent = 'Ready! Use ← and → to slide through the gaps.';
      }
  }

  function shiftLane(offset) {
      if (racerState.crashed) return;

      const nextLane = Math.min(1, Math.max(-1, playerCar.lane + offset));
      if (nextLane === playerCar.lane) return;
      playerCar.lane = nextLane;

      if (!racerState.running) {
          updatePlayerLanePosition(16.67);
          renderRacer(0);
          updateHud();
      }
  }

  function handleKey(event) {
      if (!racerModal || racerModal.style.display !== 'flex') return;
      if (racerState.crashed) return;

      const key = event.code || event.key;
      if (key === 'ArrowLeft') {
          shiftLane(-1);
          event.preventDefault();
      }
      if (key === 'ArrowRight') {
          shiftLane(1);
          event.preventDefault();
      }
  }

  const GAME_ID = 'neon-racer-plus';

  async function loadRacerHighScore() {
      racerState.mostGapsCleared = await getHighScore(GAME_ID);
      updateHud();
  }

  async function saveRacerHighScore() {
      if (racerState.dodged > racerState.mostGapsCleared) {
          racerState.mostGapsCleared = racerState.dodged;
          const saved = await submitHighScore(GAME_ID, racerState.mostGapsCleared);
          if (typeof saved === 'number') racerState.mostGapsCleared = saved;
      }
  }

  function updateHud() {
      if (racerDistanceEl) racerDistanceEl.textContent = `Distance: ${Math.floor(racerState.distance)}m`;
      if (racerSpeedEl) racerSpeedEl.textContent = `Speed: ${Math.floor(racerState.speed)} mph`;
      if (racerObstaclesEl) racerObstaclesEl.textContent = `Gaps cleared: ${racerState.dodged} | Near: ${racerState.nearMisses} | High: ${racerState.mostGapsCleared}`;
      if (racerShieldEl) racerShieldEl.textContent = `Shield: ${racerState.shield}`;
      if (racerBoostEl) {
          const secs = Math.ceil(racerState.boostTimer / 1000);
          racerBoostEl.textContent = `Boost: ${racerState.boostTimer > 0 ? `ACTIVE ${secs}s` : 'Ready'}`;
      }
  }

  // INIT function (to be called by UI loader)
  function initRacerGame() {
      if (startRacerBtn) startRacerBtn.addEventListener('click', startRacer);
      if (pauseRacerBtn) pauseRacerBtn.addEventListener('click', pauseRacer);
      if (resetRacerBtn) resetRacerBtn.addEventListener('click', resetRacer);

      if (!document.__racerBound) {
          document.addEventListener('keydown', handleKey);
          document.__racerBound = true;
      }

      if (racerCanvas) {
          loadRacerHighScore();
          resetRacer();
      }
  }

  // Expose globals for compatibility with UI loader and legacy calls
  win.initRacerGame = initRacerGame;
  win.startRacer = startRacer;
  win.pauseRacer = pauseRacer;
  win.resetRacer = resetRacer;
  win.loadRacerHighScore = loadRacerHighScore;
  win.saveRacerHighScore = saveRacerHighScore;
  win.updateRacerHud = updateHud;
})();
