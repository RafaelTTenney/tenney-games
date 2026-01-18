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
  let lapTime = 0;
  let bestLap = null;
  let checkpoints = [];
  let checkpointIndex = 0;

  const track = {
    width: 90,
    points: [
      { x: 160, y: 500 },
      { x: 140, y: 170 },
      { x: 380, y: 120 },
      { x: 720, y: 210 },
      { x: 760, y: 470 },
      { x: 420, y: 540 }
    ]
  };

  function resetCar() {
    car = {
      x: track.points[0].x,
      y: track.points[0].y,
      angle: -Math.PI / 2,
      vx: 0,
      vy: 0
    };
  }

  function buildCheckpoints() {
    checkpoints = track.points.map(p => ({ x: p.x, y: p.y }));
    checkpointIndex = 0;
  }

  function updateHud() {
    const lapEl = document.getElementById('rally-lap');
    const timeEl = document.getElementById('rally-time');
    const bestEl = document.getElementById('rally-best');
    const cpEl = document.getElementById('rally-checkpoint');
    const speedEl = document.getElementById('rally-speed');
    if (lapEl) lapEl.textContent = `Lap: ${lap}`;
    if (timeEl) timeEl.textContent = `Time: ${lapTime.toFixed(1)}s`;
    if (bestEl) bestEl.textContent = `Best: ${bestLap ? bestLap.toFixed(1) + 's' : '--'}`;
    if (cpEl) cpEl.textContent = `Checkpoint: ${checkpointIndex + 1}/${checkpoints.length}`;
    const speed = Math.hypot(car.vx, car.vy);
    if (speedEl) speedEl.textContent = `Speed: ${speed.toFixed(1)}`;
  }

  function onTrack(x, y) {
    return distanceToTrack(x, y).dist <= track.width * 0.5;
  }

  function distanceToTrack(x, y) {
    let best = { dist: Infinity, x: 0, y: 0 };
    for (let i = 0; i < track.points.length; i++) {
      const a = track.points[i];
      const b = track.points[(i + 1) % track.points.length];
      const p = closestPointOnSegment(x, y, a.x, a.y, b.x, b.y);
      const d = Math.hypot(x - p.x, y - p.y);
      if (d < best.dist) best = { dist: d, x: p.x, y: p.y };
    }
    return best;
  }

  function closestPointOnSegment(px, py, ax, ay, bx, by) {
    const abx = bx - ax;
    const aby = by - ay;
    const apx = px - ax;
    const apy = py - ay;
    const ab2 = abx * abx + aby * aby;
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
    return { x: ax + abx * t, y: ay + aby * t };
  }

  function update() {
    if (!running) return;
    time += 1 / 60;
    lapTime += 1 / 60;

    const accel = keys['ArrowUp'] ? 0.16 : keys['ArrowDown'] ? -0.12 : 0;
    car.vx += Math.cos(car.angle) * accel;
    car.vy += Math.sin(car.angle) * accel;

    const speed = Math.hypot(car.vx, car.vy);
    const maxSpeed = onTrack(car.x, car.y) ? 6.2 : 3.0;
    if (speed > maxSpeed) {
      car.vx = (car.vx / speed) * maxSpeed;
      car.vy = (car.vy / speed) * maxSpeed;
    }

    const turnBase = onTrack(car.x, car.y) ? 0.05 : 0.035;
    const turnRate = turnBase * (0.6 + Math.min(1, speed / 6));
    if (keys['ArrowLeft']) car.angle -= turnRate;
    if (keys['ArrowRight']) car.angle += turnRate;

    const desiredVx = Math.cos(car.angle) * speed;
    const desiredVy = Math.sin(car.angle) * speed;
    const grip = onTrack(car.x, car.y) ? 0.08 : 0.02;
    car.vx += (desiredVx - car.vx) * grip;
    car.vy += (desiredVy - car.vy) * grip;

    car.vx *= onTrack(car.x, car.y) ? 0.985 : 0.94;
    car.vy *= onTrack(car.x, car.y) ? 0.985 : 0.94;

    car.x += car.vx;
    car.y += car.vy;

    const nearest = distanceToTrack(car.x, car.y);
    if (nearest.dist > track.width * 0.7) {
      const dx = car.x - nearest.x;
      const dy = car.y - nearest.y;
      const d = Math.hypot(dx, dy) || 1;
      car.x = nearest.x + (dx / d) * track.width * 0.7;
      car.y = nearest.y + (dy / d) * track.width * 0.7;
      car.vx *= 0.7;
      car.vy *= 0.7;
    }

    const cp = checkpoints[checkpointIndex];
    if (cp && Math.hypot(car.x - cp.x, car.y - cp.y) < 34) {
      checkpointIndex++;
      if (checkpointIndex >= checkpoints.length) {
        checkpointIndex = 0;
        lap++;
        if (!bestLap || lapTime < bestLap) bestLap = lapTime;
        lapTime = 0;
      }
    }

    updateHud();
  }

  function drawTrack() {
    ctx.fillStyle = '#0a0502';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#2a1409';
    ctx.lineWidth = track.width + 26;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    track.points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = track.width;
    ctx.beginPath();
    track.points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([12, 16]);
    ctx.beginPath();
    track.points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    checkpoints.forEach((c, idx) => {
      ctx.strokeStyle = idx === checkpointIndex ? '#fbbf24' : 'rgba(255,255,255,0.2)';
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
    lapTime = 0;
    bestLap = null;
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
