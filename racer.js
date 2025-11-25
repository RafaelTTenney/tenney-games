(function () {
  // Neon Racer (multi-game version) - simplified racer extracted from multi-game.js
  const globalScope = typeof window !== 'undefined' ? window : globalThis;

  function createRacerModule() {
    const canvas = document.getElementById('racer-canvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const laneCount = 3;
    const laneWidth = canvas.width / laneCount;

    const playerCar = {
      lane: 1,
      width: laneWidth * 0.55,
      height: 58,
      y: canvas.height - 90
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
      animationFrame: null
    };

    const obstacleHeight = 60;
    const laneCenters = Array.from({ length: laneCount }, (_, i) => i * laneWidth + laneWidth / 2);

    function drawBackground() {
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#050417');
      gradient.addColorStop(1, '#0a0e24');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = '#02040c';
      ctx.fillRect(0, 0, 40, canvas.height);
      ctx.fillRect(canvas.width - 40, 0, 40, canvas.height);

      ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

      ctx.setLineDash([16, 24]);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.moveTo(laneWidth, 0);
      ctx.lineTo(laneWidth, canvas.height);
      ctx.moveTo(laneWidth * 2, 0);
      ctx.lineTo(laneWidth * 2, canvas.height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    function drawSpeedLines() {
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      state.speedLines.forEach(line => {
        ctx.beginPath();
        ctx.moveTo(line.x, line.y);
        ctx.lineTo(line.x, line.y + line.length);
        ctx.stroke();
      });
    }

    function drawPlayer() {
      const centerX = laneCenters[playerCar.lane];
      const left = centerX - playerCar.width / 2;
      ctx.save();
      ctx.shadowColor = '#2cf5ff';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#19d7ff';
      ctx.fillRect(left, playerCar.y, playerCar.width, playerCar.height);
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0b1f3a';
      ctx.fillRect(left + 6, playerCar.y + 10, playerCar.width - 12, playerCar.height - 20);
      ctx.fillStyle = '#19d7ff';
      ctx.fillRect(left + playerCar.width / 2 - 6, playerCar.y + 6, 12, playerCar.height - 12);
      ctx.restore();
    }

    function drawObstacles() {
      state.obstacles.forEach(ob => {
        const top = ob.y;
        const gapLeft = ob.gapCenter - ob.gapWidth / 2;
        const gapRight = ob.gapCenter + ob.gapWidth / 2;

        ctx.save();
        ctx.shadowColor = ob.color;
        ctx.shadowBlur = 14;
        ctx.fillStyle = ob.color;
        if (gapLeft > 0) {
          ctx.fillRect(0, top, gapLeft, obstacleHeight);
        }
        if (gapRight < canvas.width) {
          ctx.fillRect(gapRight, top, canvas.width - gapRight, obstacleHeight);
        }
        ctx.restore();

        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(gapLeft, top, ob.gapWidth, 4);
      });
    }

    function spawnObstacle() {
      const gapLane = Math.floor(Math.random() * laneCount);
      const colorHue = Math.floor(Math.random() * 360);
      const gapCenter = laneCenters[gapLane];
      const gapWidth = playerCar.width * 1.35;
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
      while (state.speedLines.length < 12) {
        state.speedLines.push({
          x: 60 + Math.random() * (canvas.width - 120),
          y: Math.random() * canvas.height,
          length: 18 + Math.random() * 26
        });
      }
    }

    function updateRacer(delta) {
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
        if (ob.y > canvas.height) {
          state.dodged += 1;
          state.speed = Math.min(340, state.speed + 8);
          return false;
        }
        return true;
      });

      state.speedLines.forEach(line => {
        line.y += traveled * 1.4;
      });
      state.speedLines = state.speedLines.filter(line => line.y < canvas.height + 40);
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
          const message = document.getElementById('racer-message');
          if (message) {
            message.textContent = 'Crash! Reset to roll out again.';
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
      const message = document.getElementById('racer-message');
      if (message) {
        message.textContent = 'Neon boost engaged!';
      }
      state.running = true;
      state.lastTimestamp = performance.now();
      state.animationFrame = requestAnimationFrame(gameLoop);
    }

    function pauseRacer() {
      if (!state.running) return;
      state.running = false;
      if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
      const message = document.getElementById('racer-message');
      if (message) {
        message.textContent = 'Paused. Hit start to keep racing.';
      }
    }

    function resetRacer() {
      pauseRacer();
      playerCar.lane = 1;
      state.speed = 180;
      state.distance = 0;
      state.dodged = 0;
      state.speedLines = [];
      resetObstacles();
      ensureSpeedLines();
      renderRacer();
      updateHud();
      const message = document.getElementById('racer-message');
      if (message) {
        message.textContent = 'Ready! Use ← and → to slide through the gaps.';
      }
    }

    function shiftLane(offset) {
      const nextLane = Math.min(laneCount - 1, Math.max(0, playerCar.lane + offset));
      if (nextLane === playerCar.lane) return;
      playerCar.lane = nextLane;
      renderRacer();
      updateHud();
    }

    function handleKey(event) {
      if (document.getElementById('racer-game').style.display !== 'flex') return;
      if (event.key === 'ArrowLeft') {
        shiftLane(-1);
        event.preventDefault();
      }
      if (event.key === 'ArrowRight') {
        shiftLane(1);
        event.preventDefault();
      }
    }

    if (!document.__racerBound) {
      document.addEventListener('keydown', handleKey);
      document.__racerBound = true;
    }

    function updateHud() {
      const distanceEl = document.getElementById('racer-distance');
      const speedEl = document.getElementById('racer-speed');
      const obstaclesEl = document.getElementById('racer-obstacles');
      if (distanceEl) distanceEl.textContent = `Distance: ${Math.floor(state.distance)}m`;
      if (speedEl) speedEl.textContent = `Speed: ${Math.floor(state.speed)} mph`;
      if (obstaclesEl) obstaclesEl.textContent = `Gaps cleared: ${state.dodged}`;
    }

    return {
      init() {
        resetRacer();
      },
      start: startRacer,
      pause: pauseRacer,
      reset: resetRacer,
      updateHud: updateHud
    };
  }

  let racerModule = null;
  function initRacerGame() {
    if (!racerModule) racerModule = createRacerModule();
    if (racerModule && typeof racerModule.init === 'function') racerModule.init();
  }

  globalScope.initRacerGame = initRacerGame;
  globalScope.startRacer = function () {
    if (!racerModule) initRacerGame();
    if (racerModule && typeof racerModule.start === 'function') racerModule.start();
  };
  globalScope.pauseRacer = function () {
    if (!racerModule) initRacerGame();
    if (racerModule && typeof racerModule.pause === 'function') racerModule.pause();
  };
  globalScope.resetRacer = function () {
    if (!racerModule) initRacerGame();
    if (racerModule && typeof racerModule.reset === 'function') racerModule.reset();
  };
  globalScope.updateRacerHud = function () {
    if (racerModule && typeof racerModule.updateHud === 'function') racerModule.updateHud();
  };
})();
