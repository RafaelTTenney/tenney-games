// Tunnel Rush - rotate through gaps in a fast tunnel.
(function () {
  const win = typeof window !== 'undefined' ? window : globalThis;
  let canvas, ctx;
  let running = false;
  let inited = false;
  let rafId = 0;

  const keys = {};
  let player = { angle: 0, angVel: 0 };
  let obstacles = [];
  let score = 0;
  let speed = 1.0;
  let gapSize = Math.PI * 0.66;
  let spawnTimer = 0;

  function updateHud() {
    const scoreEl = document.getElementById('tunnel-score');
    const speedEl = document.getElementById('tunnel-speed');
    const gapEl = document.getElementById('tunnel-gap');
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    if (speedEl) speedEl.textContent = `Speed: ${speed.toFixed(1)}x`;
    if (gapEl) gapEl.textContent = `Gap: ${Math.round((gapSize * 180) / Math.PI)}°`;
  }

  function spawnObstacle() {
    obstacles.push({
      z: 600,
      gapAngle: Math.random() * Math.PI * 2,
      gapSize,
      rotSpeed: (Math.random() - 0.5) * 0.6
    });
  }

  function resetTunnelRush() {
    score = 0;
    speed = 1.0;
    gapSize = Math.PI * 0.66;
    obstacles = [];
    player = { angle: 0, angVel: 0 };
    spawnTimer = 0;
    for (let i = 0; i < 4; i++) {
      spawnObstacle();
      obstacles[obstacles.length - 1].z += i * 180;
    }
    updateHud();
    draw();
  }

  function update(delta) {
    if (!running) return;
    const dt = delta / 1000;

    if (keys['ArrowLeft']) player.angVel -= 3.2 * dt;
    if (keys['ArrowRight']) player.angVel += 3.2 * dt;
    player.angVel *= 0.92;
    player.angle += player.angVel;

    spawnTimer -= delta;
    if (spawnTimer <= 0) {
      spawnObstacle();
      spawnTimer = 520 - speed * 50;
    }

    obstacles.forEach(ob => {
      ob.z -= 180 * dt * speed;
      ob.gapAngle += ob.rotSpeed * dt;
    });

    for (let i = obstacles.length - 1; i >= 0; i--) {
      const ob = obstacles[i];
      if (ob.z <= 0) {
        const diff = angleDiff(player.angle, ob.gapAngle);
        if (Math.abs(diff) <= ob.gapSize / 2) {
          score++;
          speed = Math.min(4.5, speed + 0.08);
          gapSize = Math.max(Math.PI * 0.28, gapSize - 0.02);
        } else {
          running = false;
        }
        obstacles.splice(i, 1);
      }
    }

    updateHud();
  }

  function angleDiff(a, b) {
    let diff = a - b;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  function drawRing(ob, radiusBase) {
    const scale = 1 / (1 + ob.z / 300);
    const radius = radiusBase * scale;
    const thickness = 16 * scale + 2;
    const gapStart = ob.gapAngle - ob.gapSize / 2;
    const gapEnd = ob.gapAngle + ob.gapSize / 2;

    ctx.strokeStyle = '#0ea5e9';
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.arc(0, 0, radius, gapEnd, gapStart + Math.PI * 2);
    ctx.stroke();
  }

  function draw() {
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#010b14';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2, h / 2);

    for (let i = 0; i < 8; i++) {
      ctx.strokeStyle = 'rgba(14,165,233,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 40 + i * 28, 0, Math.PI * 2);
      ctx.stroke();
    }

    obstacles.forEach(ob => drawRing(ob, 220));

    const playerRadius = 180;
    const px = Math.cos(player.angle) * playerRadius;
    const py = Math.sin(player.angle) * playerRadius;
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    if (!running) {
      ctx.fillStyle = '#e0f2fe';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('PAUSED / READY', w * 0.28, h * 0.52);
    }
  }

  function loop(timestamp) {
    if (!running) return;
    const delta = timestamp - (loop.last || timestamp);
    loop.last = timestamp;
    update(delta);
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function initTunnelRushGame() {
    if (inited) return;
    canvas = document.getElementById('tunnel-canvas');
    if (!canvas) {
      win.initTunnelRushGame = function () {};
      win.startTunnelRush = function () {};
      win.pauseTunnelRush = function () {};
      win.resetTunnelRush = function () {};
      return;
    }
    ctx = canvas.getContext('2d');
    resetTunnelRush();
    document.addEventListener('keydown', (e) => {
      if (['ArrowLeft','ArrowRight'].includes(e.code)) e.preventDefault();
      keys[e.key] = true;
    });
    document.addEventListener('keyup', (e) => { keys[e.key] = false; });
    inited = true;
  }

  function startTunnelRush() {
    if (!inited) initTunnelRushGame();
    if (running) return;
    running = true;
    cancelAnimationFrame(rafId);
    loop.last = performance.now();
    rafId = requestAnimationFrame(loop);
  }

  function pauseTunnelRush() {
    running = false;
    cancelAnimationFrame(rafId);
    draw();
  }

  win.initTunnelRushGame = initTunnelRushGame;
  win.startTunnelRush = startTunnelRush;
  win.pauseTunnelRush = pauseTunnelRush;
  win.resetTunnelRush = resetTunnelRush;
})();
