// Neon Rally - top-down arcade racing with checkpoints.
(function () {
  const win = typeof window !== 'undefined' ? window : globalThis;
  let canvas, ctx;
  let running = false;
  let inited = false;
  let rafId = 0;

  const keys = {};
  let car = null;
  let lap = 1;
  let time = 0;
  let checkpoints = [];
  let checkpointIndex = 0;

  const outer = { x: 70, y: 60, w: 760, h: 480 };
  const inner = { x: 260, y: 200, w: 380, h: 200 };

  function resetCar() {
    car = {
      x: outer.x + outer.w / 2,
      y: outer.y + outer.h - 40,
      angle: -Math.PI / 2,
      speed: 0
    };
  }

  function buildCheckpoints() {
    checkpoints = [
      { x: outer.x + outer.w / 2, y: outer.y + outer.h - 20 },
      { x: outer.x + outer.w - 20, y: outer.y + outer.h / 2 },
      { x: outer.x + outer.w / 2, y: outer.y + 20 },
      { x: outer.x + 20, y: outer.y + outer.h / 2 }
    ];
    checkpointIndex = 0;
  }

  function updateHud() {
    const lapEl = document.getElementById('rally-lap');
    const timeEl = document.getElementById('rally-time');
    const speedEl = document.getElementById('rally-speed');
    if (lapEl) lapEl.textContent = `Lap: ${lap}`;
    if (timeEl) timeEl.textContent = `Time: ${time.toFixed(1)}s`;
    if (speedEl) speedEl.textContent = `Speed: ${Math.abs(car.speed).toFixed(1)}`;
  }

  function onTrack(x, y) {
    const insideOuter = x > outer.x && x < outer.x + outer.w && y > outer.y && y < outer.y + outer.h;
    const insideInner = x > inner.x && x < inner.x + inner.w && y > inner.y && y < inner.y + inner.h;
    return insideOuter && !insideInner;
  }

  function update() {
    if (!running) return;
    time += 1 / 60;

    const accel = keys['ArrowUp'] ? 0.14 : keys['ArrowDown'] ? -0.1 : 0;
    car.speed += accel;
    car.speed *= 0.98;
    const maxSpeed = onTrack(car.x, car.y) ? 5.2 : 2.5;
    car.speed = Math.max(Math.min(car.speed, maxSpeed), -2.5);

    if (keys['ArrowLeft']) car.angle -= 0.04 * (car.speed >= 0 ? 1 : -1);
    if (keys['ArrowRight']) car.angle += 0.04 * (car.speed >= 0 ? 1 : -1);

    car.x += Math.cos(car.angle) * car.speed;
    car.y += Math.sin(car.angle) * car.speed;

    if (!onTrack(car.x, car.y)) {
      car.speed *= 0.94;
    }

    const cp = checkpoints[checkpointIndex];
    if (cp && Math.hypot(car.x - cp.x, car.y - cp.y) < 30) {
      checkpointIndex++;
      if (checkpointIndex >= checkpoints.length) {
        checkpointIndex = 0;
        lap++;
      }
    }

    updateHud();
  }

  function drawTrack() {
    ctx.fillStyle = '#0a0502';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#1a0f08';
    ctx.fillRect(outer.x, outer.y, outer.w, outer.h);

    ctx.fillStyle = '#0a0502';
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 3;
    ctx.strokeRect(outer.x, outer.y, outer.w, outer.h);
    ctx.strokeRect(inner.x, inner.y, inner.w, inner.h);

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.setLineDash([8, 12]);
    ctx.beginPath();
    ctx.moveTo(outer.x + outer.w / 2, outer.y);
    ctx.lineTo(outer.x + outer.w / 2, outer.y + outer.h);
    ctx.stroke();
    ctx.setLineDash([]);

    checkpoints.forEach((c, idx) => {
      ctx.strokeStyle = idx === checkpointIndex ? '#fbbf24' : 'rgba(255,255,255,0.15)';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 18, 0, Math.PI * 2);
      ctx.stroke();
    });
  }

  function drawCar() {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-10, 8);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, -8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    if (!ctx) return;
    drawTrack();
    drawCar();

    if (!running) {
      ctx.fillStyle = '#fff7ed';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('PAUSED / READY', canvas.width * 0.35, canvas.height * 0.5);
    }
  }

  function loop() {
    if (!running) return;
    update();
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function resetNeonRally() {
    resetCar();
    buildCheckpoints();
    lap = 1;
    time = 0;
    updateHud();
    draw();
  }

  function initNeonRallyGame() {
    if (inited) return;
    canvas = document.getElementById('rally-canvas');
    if (!canvas) {
      win.initNeonRallyGame = function () {};
      win.startNeonRally = function () {};
      win.pauseNeonRally = function () {};
      win.resetNeonRally = function () {};
      return;
    }
    ctx = canvas.getContext('2d');
    resetNeonRally();
    document.addEventListener('keydown', (e) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code)) e.preventDefault();
      keys[e.key] = true;
    });
    document.addEventListener('keyup', (e) => { keys[e.key] = false; });
    inited = true;
  }

  function startNeonRally() {
    if (!inited) initNeonRallyGame();
    if (running) return;
    running = true;
    cancelAnimationFrame(rafId);
    loop();
  }

  function pauseNeonRally() {
    running = false;
    cancelAnimationFrame(rafId);
    draw();
  }

  win.initNeonRallyGame = initNeonRallyGame;
  win.startNeonRally = startNeonRally;
  win.pauseNeonRally = pauseNeonRally;
  win.resetNeonRally = resetNeonRally;
})();
