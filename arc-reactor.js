// Arc Reactor - classic asteroid survival with a core to protect.
(function () {
  const win = typeof window !== 'undefined' ? window : globalThis;
  let canvas, ctx;
  let w = 0;
  let h = 0;
  let running = false;
  let inited = false;
  let rafId = 0;

  const keys = {};
  const stars = [];
  const bullets = [];
  const asteroids = [];
  let ship = null;
  let score = 0;
  let lives = 3;
  let wave = 1;
  let core = { x: 0, y: 0, r: 34, hp: 100 };
  let shootCooldown = 0;
  let invuln = 0;

  function resetShip() {
    ship = {
      x: w * 0.3,
      y: h * 0.5,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2
    };
    invuln = 120;
  }

  function spawnStars() {
    stars.length = 0;
    for (let i = 0; i < 140; i++) {
      stars.push({ x: Math.random() * w, y: Math.random() * h, r: Math.random() * 2 + 0.5 });
    }
  }

  function spawnAsteroids(count) {
    for (let i = 0; i < count; i++) {
      const size = 3;
      let x = Math.random() * w;
      let y = Math.random() * h;
      if (Math.hypot(x - core.x, y - core.y) < 140) {
        x = Math.random() * w;
        y = Math.random() * h;
      }
      asteroids.push(makeAsteroid(x, y, size));
    }
  }

  function makeAsteroid(x, y, size) {
    const speed = 0.6 + Math.random() * 0.6 + wave * 0.05;
    const angle = Math.random() * Math.PI * 2;
    return {
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: size * 18,
      size
    };
  }

  function splitAsteroid(a) {
    if (a.size <= 1) return;
    for (let i = 0; i < 2; i++) {
      const nx = a.x + (Math.random() - 0.5) * 12;
      const ny = a.y + (Math.random() - 0.5) * 12;
      asteroids.push(makeAsteroid(nx, ny, a.size - 1));
    }
  }

  function updateHud() {
    const scoreEl = document.getElementById('arc-score');
    const coreEl = document.getElementById('arc-core');
    const livesEl = document.getElementById('arc-lives');
    const waveEl = document.getElementById('arc-wave');
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
    if (coreEl) coreEl.textContent = `Core: ${Math.max(0, Math.floor(core.hp))}%`;
    if (livesEl) livesEl.textContent = `Lives: ${lives}`;
    if (waveEl) waveEl.textContent = `Wave: ${wave}`;
  }

  function fireBullet() {
    if (!ship || shootCooldown > 0) return;
    shootCooldown = 12;
    const speed = 7;
    bullets.push({
      x: ship.x + Math.cos(ship.angle) * 16,
      y: ship.y + Math.sin(ship.angle) * 16,
      vx: Math.cos(ship.angle) * speed,
      vy: Math.sin(ship.angle) * speed,
      life: 80
    });
  }

  function update() {
    if (!running) return;
    if (shootCooldown > 0) shootCooldown--;
    if (invuln > 0) invuln--;

    if (keys['ArrowLeft']) ship.angle -= 0.06;
    if (keys['ArrowRight']) ship.angle += 0.06;
    if (keys['ArrowUp']) {
      ship.vx += Math.cos(ship.angle) * 0.12;
      ship.vy += Math.sin(ship.angle) * 0.12;
    }

    ship.vx *= 0.98;
    ship.vy *= 0.98;
    ship.x += ship.vx;
    ship.y += ship.vy;
    wrap(ship);

    for (let i = bullets.length - 1; i >= 0; i--) {
      const b = bullets[i];
      b.x += b.vx;
      b.y += b.vy;
      b.life--;
      if (b.life <= 0) bullets.splice(i, 1);
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      a.x += a.vx;
      a.y += a.vy;
      wrap(a);

      if (Math.hypot(a.x - core.x, a.y - core.y) < a.r + core.r) {
        core.hp -= 6 + a.size * 4;
        asteroids.splice(i, 1);
        splitAsteroid(a);
        continue;
      }
    }

    for (let i = asteroids.length - 1; i >= 0; i--) {
      const a = asteroids[i];
      for (let j = bullets.length - 1; j >= 0; j--) {
        const b = bullets[j];
        if (Math.hypot(a.x - b.x, a.y - b.y) < a.r) {
          bullets.splice(j, 1);
          asteroids.splice(i, 1);
          score += 20 * a.size;
          splitAsteroid(a);
          break;
        }
      }
    }

    if (invuln === 0) {
      for (let i = asteroids.length - 1; i >= 0; i--) {
        const a = asteroids[i];
        if (Math.hypot(a.x - ship.x, a.y - ship.y) < a.r + 10) {
          lives--;
          resetShip();
          asteroids.splice(i, 1);
          splitAsteroid(a);
          break;
        }
      }
    }

    if (asteroids.length === 0) {
      wave++;
      spawnAsteroids(3 + wave);
    }

    if (core.hp <= 0 || lives <= 0) {
      running = false;
    }

    updateHud();
  }

  function wrap(obj) {
    if (obj.x < -20) obj.x = w + 20;
    if (obj.x > w + 20) obj.x = -20;
    if (obj.y < -20) obj.y = h + 20;
    if (obj.y > h + 20) obj.y = -20;
  }

  function draw() {
    if (!ctx) return;
    ctx.fillStyle = '#020508';
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#0c1d2b';
    stars.forEach(s => {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(core.x, core.y, core.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(34,211,238,0.08)';
    ctx.fill();

    asteroids.forEach(a => {
      ctx.strokeStyle = '#8bafc2';
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      ctx.stroke();
    });

    bullets.forEach(b => {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    });

    if (ship) {
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.angle);
      ctx.strokeStyle = invuln > 0 ? '#fbbf24' : '#e2f2ff';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-10, 7);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-10, -7);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
    }

    if (!running) {
      ctx.fillStyle = '#e2f2ff';
      ctx.font = 'bold 22px monospace';
      ctx.fillText('PAUSED / READY', w * 0.35, h * 0.5);
    }
  }

  function loop() {
    if (!running) return;
    update();
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function resetArcReactor() {
    score = 0;
    lives = 3;
    wave = 1;
    core = { x: w * 0.6, y: h * 0.5, r: 34, hp: 100 };
    bullets.length = 0;
    asteroids.length = 0;
    resetShip();
    spawnAsteroids(4);
    updateHud();
    draw();
  }

  function initArcReactorGame() {
    if (inited) return;
    canvas = document.getElementById('arc-canvas');
    if (!canvas) {
      win.initArcReactorGame = function () {};
      win.startArcReactor = function () {};
      win.pauseArcReactor = function () {};
      win.resetArcReactor = function () {};
      return;
    }
    ctx = canvas.getContext('2d');
    w = canvas.width;
    h = canvas.height;
    spawnStars();
    resetArcReactor();
    document.addEventListener('keydown', (e) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','Space'].includes(e.code)) e.preventDefault();
      keys[e.key] = true;
      if (e.code === 'Space') fireBullet();
    });
    document.addEventListener('keyup', (e) => { keys[e.key] = false; });
    inited = true;
  }

  function startArcReactor() {
    if (!inited) initArcReactorGame();
    if (running) return;
    running = true;
    cancelAnimationFrame(rafId);
    loop();
  }

  function pauseArcReactor() {
    running = false;
    cancelAnimationFrame(rafId);
    draw();
  }

  win.initArcReactorGame = initArcReactorGame;
  win.startArcReactor = startArcReactor;
  win.pauseArcReactor = pauseArcReactor;
  win.resetArcReactor = resetArcReactor;
})();
