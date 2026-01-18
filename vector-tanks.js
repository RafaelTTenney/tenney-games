// Vector Tanks - classic artillery duel.
(function () {
  const win = typeof window !== 'undefined' ? window : globalThis;
  let canvas, ctx;
  let running = false;
  let inited = false;
  let rafId = 0;

  const keys = {};
  let terrain = [];
  let player = null;
  let enemy = null;
  let projectile = null;
  let turn = 'player';
  let wind = 0;
  let angle = 45;
  let power = 40;

  function buildTerrain() {
    terrain = new Array(canvas.width).fill(0).map((_, x) => {
      const base = canvas.height - 80;
      const wave = Math.sin(x * 0.01) * 20 + Math.sin(x * 0.02) * 10;
      return base + wave;
    });
  }

  function groundY(x) {
    const ix = Math.max(0, Math.min(canvas.width - 1, Math.floor(x)));
    return terrain[ix] || canvas.height - 80;
  }

  function resetTanks() {
    player = { x: 140, y: groundY(140) - 14, hp: 100 };
    enemy = { x: canvas.width - 140, y: groundY(canvas.width - 140) - 14, hp: 100 };
    angle = 45;
    power = 40;
    turn = 'player';
    wind = (Math.random() - 0.5) * 0.18;
  }

  function updateHud() {
    const pEl = document.getElementById('tanks-player');
    const aEl = document.getElementById('tanks-ai');
    const wEl = document.getElementById('tanks-wind');
    const anEl = document.getElementById('tanks-angle');
    const pwEl = document.getElementById('tanks-power');
    if (pEl) pEl.textContent = `Player: ${Math.max(0, Math.floor(player.hp))}`;
    if (aEl) aEl.textContent = `AI: ${Math.max(0, Math.floor(enemy.hp))}`;
    if (wEl) wEl.textContent = `Wind: ${wind.toFixed(2)}`;
    if (anEl) anEl.textContent = `Angle: ${Math.floor(angle)}`;
    if (pwEl) pwEl.textContent = `Power: ${Math.floor(power)}`;
  }

  function fireShot(from, dir) {
    const rad = (angle * Math.PI) / 180;
    const speed = power * 0.25;
    projectile = {
      x: from.x,
      y: from.y - 6,
      vx: Math.cos(rad) * speed * dir,
      vy: -Math.sin(rad) * speed,
      owner: dir === 1 ? 'player' : 'ai'
    };
  }

  function aiTakeShot() {
    const dist = Math.abs(enemy.x - player.x);
    const g = 0.18;
    const aiAngle = 35 + Math.random() * 20;
    const rad = (aiAngle * Math.PI) / 180;
    let speed = Math.sqrt((dist * g) / Math.max(0.2, Math.sin(2 * rad)));
    speed = Math.min(22, Math.max(10, speed + (Math.random() - 0.5) * 4));
    angle = aiAngle;
    power = speed * 4;
    fireShot(enemy, -1);
  }

  function applyExplosion(x, y) {
    const radius = 40;
    const distP = Math.hypot(player.x - x, player.y - y);
    const distE = Math.hypot(enemy.x - x, enemy.y - y);
    if (distP < radius) player.hp -= (radius - distP) * 0.9;
    if (distE < radius) enemy.hp -= (radius - distE) * 0.9;
  }

  function update() {
    if (!running) return;
    if (projectile) {
      projectile.vy += 0.18;
      projectile.vx += wind * 0.2;
      projectile.x += projectile.vx;
      projectile.y += projectile.vy;

      if (projectile.x < 0 || projectile.x > canvas.width || projectile.y > canvas.height) {
        projectile = null;
        turn = turn === 'player' ? 'ai' : 'player';
        wind = (Math.random() - 0.5) * 0.18;
      } else if (projectile.y >= groundY(projectile.x)) {
        applyExplosion(projectile.x, projectile.y);
        projectile = null;
        turn = turn === 'player' ? 'ai' : 'player';
        wind = (Math.random() - 0.5) * 0.18;
      }
    } else if (turn === 'player') {
      if (keys['a'] || keys['A']) angle = Math.max(5, angle - 1);
      if (keys['d'] || keys['D']) angle = Math.min(85, angle + 1);
      if (keys['w'] || keys['W']) power = Math.min(80, power + 0.6);
      if (keys['s'] || keys['S']) power = Math.max(10, power - 0.6);
    } else if (turn === 'ai') {
      aiTakeShot();
    }

    if (player.hp <= 0 || enemy.hp <= 0) {
      running = false;
    }

    updateHud();
  }

  function drawTerrain() {
    ctx.fillStyle = '#151827';
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    for (let x = 0; x < canvas.width; x++) {
      ctx.lineTo(x, terrain[x]);
    }
    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fill();
  }

  function drawTank(tank, color) {
    ctx.fillStyle = color;
    ctx.fillRect(tank.x - 12, tank.y - 6, 24, 12);
    ctx.fillRect(tank.x - 6, tank.y - 12, 12, 6);
  }

  function draw() {
    if (!ctx) return;
    ctx.fillStyle = '#0b0714';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawTerrain();

    drawTank(player, '#a855f7');
    drawTank(enemy, '#f97316');

    if (projectile) {
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#f5e8ff';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`TURN: ${turn.toUpperCase()}`, 30, 30);

    if (!running) {
      ctx.fillStyle = '#f5e8ff';
      ctx.font = 'bold 22px monospace';
      const msg = player.hp <= 0 ? 'DEFEAT' : enemy.hp <= 0 ? 'VICTORY' : 'PAUSED / READY';
      ctx.fillText(msg, canvas.width * 0.4, canvas.height * 0.5);
    }
  }

  function loop() {
    if (!running) return;
    update();
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function resetVectorTanks() {
    buildTerrain();
    resetTanks();
    updateHud();
    draw();
  }

  function initVectorTanksGame() {
    if (inited) return;
    canvas = document.getElementById('tanks-canvas');
    if (!canvas) {
      win.initVectorTanksGame = function () {};
      win.startVectorTanks = function () {};
      win.pauseVectorTanks = function () {};
      win.resetVectorTanks = function () {};
      return;
    }
    ctx = canvas.getContext('2d');
    resetVectorTanks();
    document.addEventListener('keydown', (e) => {
      if (['a','A','d','D','w','W','s','S',' '].includes(e.key)) e.preventDefault();
      keys[e.key] = true;
      if (e.code === 'Space' && running && turn === 'player' && !projectile) {
        fireShot(player, 1);
      }
    });
    document.addEventListener('keyup', (e) => { keys[e.key] = false; });
    inited = true;
  }

  function startVectorTanks() {
    if (!inited) initVectorTanksGame();
    if (running) return;
    running = true;
    cancelAnimationFrame(rafId);
    loop();
  }

  function pauseVectorTanks() {
    running = false;
    cancelAnimationFrame(rafId);
    draw();
  }

  win.initVectorTanksGame = initVectorTanksGame;
  win.startVectorTanks = startVectorTanks;
  win.pauseVectorTanks = pauseVectorTanks;
  win.resetVectorTanks = resetVectorTanks;
})();
