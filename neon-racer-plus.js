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
      obstacles: [],
      speedLines: [],
      stars: [],
      spawnTimer: 0,
      animationFrame: null,
      spawnStartTime: 2200,
      spawnMinTime: 800,
      spawnTimeVariance: 200,
      spawnTimeTightenRate: 20,
      gapWidthStartMultiplier: 1.7,
      gapWidthMinMultiplier: 1.2,
      gapWidthTightenRate: 0.02,
      particles: [],
      explosionParticles: [],
      laneLerpSpeed: 0.12,
      shake: { x: 0, y: 0, intensity: 0 },
      flash: { alpha: 0 },
      crashAnimId: null,
      carSway: 0,
      carSwaySpeed: 0.008,
      carSwayMax: 0.035,
      carTilt: 0,
      carTiltMax: 0.1,
      carTiltSpeed: 0.1,
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
          const roadWPlayer = ob.roadWidthAtPlayer || roadWidthAtY(playerCar.y);
          const scaledGapCenter = laneCenterAtY(ob.gapLane, ob.y, roadWPlayer);
          const scaledGapWidth = ob.gapWidthAtPlayer * (roadWidthAtY(ob.y) / roadWPlayer);

          const gapLeft = scaledGapCenter - scaledGapWidth / 2;
          const gapRight = scaledGapCenter + scaledGapWidth / 2;

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

  function drawPlayer(delta) {
      if (!racerCtx) return;

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

          const roadWPlayer = ob.roadWidthAtPlayer || roadWidthAtY(playerCar.y);
          const scaledGapCenter = laneCenterAtY(ob.gapLane, ob.y, roadWPlayer);
          const scaledGapWidth = (ob.gapWidthAtPlayer) * (roadWidthAtY(ob.y) / roadWPlayer);

          const gapLeft = scaledGapCenter - scaledGapWidth / 2;
          const gapRight = scaledGapCenter + scaledGapWidth / 2;
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
      let gapWidthAtPlayer = (laneWidthAtPlayer * 0.55) * currentGapMultiplier;

      const minSafeGap = Math.max(playerCar.width * 1.05, playerCar.baseWidth * 0.95, laneWidthAtPlayer * 0.5);
      if (gapWidthAtPlayer < minSafeGap) {
          gapWidthAtPlayer = minSafeGap;
      }

      gapWidthAtPlayer = Math.min(gapWidthAtPlayer, 250);

      const spawnY = horizonY;

      racerState.obstacles.push({
          y: spawnY,
          gapLane: gapLane,
          gapWidthAtPlayer: gapWidthAtPlayer,
          roadWidthAtPlayer: roadWidthAtPlayer,
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

      const speedInPxPerSecond = racerState.speed * 1.5;
      const traveled = (speedInPxPerSecond * (delta / 1000));

      const baseSpeed = 180 + racerState.dodged * 6 + Math.floor(racerState.distance / 800);
      racerState.speed = Math.min(520, baseSpeed);
      racerState.distance += traveled;

      racerState.spawnTimer -= delta;
      if (racerState.spawnTimer <= 0) {
          spawnObstacle();
      }

      racerState.obstacles.forEach(ob => {
          ob.y += traveled;
      });

      racerState.obstacles = racerState.obstacles.filter(ob => {
          if (ob.y > racerCanvas.height + obstacleHeight) {
              racerState.dodged += 1;
              spawnWhooshLines(canvasWidth / 2, racerCanvas.height - 40);
              const scale = Math.min(1.3, 1 + racerState.dodged * 0.02);
              playerCar.width = playerCar.baseWidth * scale;
              if (racerState.dodged > 0 && racerState.dodged % 10 === 0) {
                  if (racerMessageEl) racerMessageEl.textContent = `Boost! Speed increased.`;
              }
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
      const exactPlayerCenterX = laneCenterAtY(playerCar.lane, playerCar.y, roadWidthPlayer);

      const collisionWidth = playerCar.width * 0.96;
      const carLeft = exactPlayerCenterX - collisionWidth / 2;
      const carRight = exactPlayerCenterX + collisionWidth / 2;
      const carTop = playerCar.y;
      const carBottom = playerCar.y + playerCar.height;

      for (const ob of racerState.obstacles) {
          const scale = getPerspectiveScale(ob.y);
          const scaledHeight = obstacleHeight * scale;
          const obTop = ob.y - scaledHeight;
          const obBottom = ob.y;

          const roadWPlayerStored = ob.roadWidthAtPlayer || roadWidthPlayer;
          const scaledGapCenter = laneCenterAtY(ob.gapLane, ob.y, roadWPlayerStored);
          const scaledGapWidth = ob.gapWidthAtPlayer * (roadWidthAtY(ob.y) / roadWPlayerStored);
          const gapLeft = scaledGapCenter - scaledGapWidth / 2;
          const gapRight = scaledGapCenter + scaledGapWidth / 2;

          if (carBottom <= obTop || carTop >= obBottom) continue;

          const baseCushion = Math.max(5, Math.round(collisionWidth * 0.06));
          const innerLaneBonus = Math.max(10, Math.round(collisionWidth * 0.18));
          const outerLaneTrim = Math.max(4, Math.round(collisionWidth * 0.08));

          let safeGapLeft = gapLeft - baseCushion;
          let safeGapRight = gapRight + baseCushion;

          if (ob.gapLane === -1) {
              // Left lane: push the safe gap toward center by trimming the outer edge
              safeGapLeft += outerLaneTrim;
              safeGapRight += innerLaneBonus;
          } else if (ob.gapLane === 1) {
              // Right lane: push the safe gap toward center by trimming the outer edge
              safeGapLeft -= innerLaneBonus;
              safeGapRight -= outerLaneTrim;
          }

          if (carLeft < safeGapLeft || carRight > safeGapRight) {
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
      applyShakeTransform();

      drawBackground();
      drawSpeedLines();
      drawGlow();
      drawObstacles();
      drawPlayer(delta);
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
      racerState.speedLines = [];
      racerState.stars = [];
      racerState.particles = [];
      racerState.explosionParticles = [];
      racerState.shake = { x: 0, y: 0, intensity: 0 };
      racerState.flash = { alpha: 0 };
      racerState.carSway = 0;
      racerState.carTilt = 0;
      racerState.edgeFlash = 0;
      racerState.crashed = false;

      resetObstacles();
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
          renderRacer(0);
          updateHud();
      }
  }

  function handleKey(event) {
      if (!racerModal || racerModal.style.display !== 'flex') return;
      if (racerState.crashed) return;

      if (event.key === 'ArrowLeft') {
          shiftLane(-1);
          event.preventDefault();
      }
      if (event.key === 'ArrowRight') {
          shiftLane(1);
          event.preventDefault();
      }
  }

  function loadRacerHighScore() {
      racerState.mostGapsCleared = parseInt(localStorage.getItem('racer+mostGapsCleared')) || 0;
  }

  function saveRacerHighScore() {
      if (racerState.dodged > racerState.mostGapsCleared) {
          racerState.mostGapsCleared = racerState.dodged;
          localStorage.setItem('racer+mostGapsCleared', racerState.mostGapsCleared);
      }
  }

  function updateHud() {
      if (racerDistanceEl) racerDistanceEl.textContent = `Distance: ${Math.floor(racerState.distance)}m`;
      if (racerSpeedEl) racerSpeedEl.textContent = `Speed: ${Math.floor(racerState.speed)} mph`;
      if (racerObstaclesEl) racerObstaclesEl.textContent = `Gaps cleared: ${racerState.dodged} | High: ${racerState.mostGapsCleared}`;
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
