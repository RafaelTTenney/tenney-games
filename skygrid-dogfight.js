(function () {
  const canvas = document.getElementById('skygrid-canvas');
  if (!canvas) {
    window.initSkygrid = function () {};
    window.stopSkygrid = function () {};
    return;
  }
  const ctx = canvas.getContext('2d');
  const controlsSelect = document.getElementById('sky-controls');
  const hudHp = document.getElementById('sky-hp');
  const hudShield = document.getElementById('sky-shield');
  const hudBoost = document.getElementById('sky-boost');
  const hudKills = document.getElementById('sky-kills');
  const hudWave = document.getElementById('sky-wave');
  const startBtn = document.getElementById('sky-start');
  const pauseBtn = document.getElementById('sky-pause');
  const resetBtn = document.getElementById('sky-reset');

  const world = { width: 1600, height: 1000 };
  const input = { keys: {}, mouse: { x: canvas.width / 2, y: canvas.height / 2, down: false } };

  const state = {
    running: false,
    lastTime: 0,
    kills: 0,
    wave: 1,
    spawnTimer: 0,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    player: {
      x: world.width / 2,
      y: world.height / 2,
      vx: 0,
      vy: 0,
      hp: 120,
      maxHp: 120,
      shield: 100,
      maxShield: 100,
      boost: 100,
      maxBoost: 100,
      lastHit: 0,
      fireCooldown: 0,
      aimX: 1,
      aimY: 0
    }
  };

  function resetSkygrid() {
    state.running = false;
    state.lastTime = 0;
    state.kills = 0;
    state.wave = 1;
    state.spawnTimer = 0;
    state.enemies = [];
    state.bullets = [];
    state.enemyBullets = [];
    state.particles = [];
    state.player = {
      x: world.width / 2,
      y: world.height / 2,
      vx: 0,
      vy: 0,
      hp: 120,
      maxHp: 120,
      shield: 100,
      maxShield: 100,
      boost: 100,
      maxBoost: 100,
      lastHit: 0,
      fireCooldown: 0,
      aimX: 1,
      aimY: 0
    };
    spawnWave();
    updateHud();
    render();
  }

  function spawnWave() {
    state.enemies = [];
    const count = Math.min(3 + state.wave, 8);
    for (let i = 0; i < count; i++) {
      const edge = Math.floor(Math.random() * 4);
      const offset = 80 + Math.random() * 120;
      let x = 0;
      let y = 0;
      if (edge === 0) { x = offset; y = -offset; }
      if (edge === 1) { x = world.width + offset; y = Math.random() * world.height; }
      if (edge === 2) { x = Math.random() * world.width; y = world.height + offset; }
      if (edge === 3) { x = -offset; y = Math.random() * world.height; }

      const type = Math.random() > 0.6 ? 'strafer' : 'chaser';
      state.enemies.push({
        x,
        y,
        vx: 0,
        vy: 0,
        hp: type === 'chaser' ? 22 : 28,
        type,
        fireTimer: 600 + Math.random() * 800
      });
    }
  }

  function updateHud() {
    if (hudHp) hudHp.textContent = `HP: ${Math.max(0, Math.round(state.player.hp))}`;
    if (hudShield) hudShield.textContent = `Shield: ${Math.round(state.player.shield)}`;
    if (hudBoost) hudBoost.textContent = `Boost: ${Math.round(state.player.boost)}`;
    if (hudKills) hudKills.textContent = `Kills: ${state.kills}`;
    if (hudWave) hudWave.textContent = `Wave: ${state.wave}`;
  }

  function getControlMode() {
    return controlsSelect ? controlsSelect.value : 'mouse';
  }

  function aimFromKeyboard() {
    let ax = 0;
    let ay = 0;
    if (input.keys['ArrowUp']) ay -= 1;
    if (input.keys['ArrowDown']) ay += 1;
    if (input.keys['ArrowLeft']) ax -= 1;
    if (input.keys['ArrowRight']) ax += 1;
    if (ax !== 0 || ay !== 0) {
      const len = Math.hypot(ax, ay) || 1;
      state.player.aimX = ax / len;
      state.player.aimY = ay / len;
    }
  }

  function aimFromMouse(camera) {
    const worldX = camera.x + input.mouse.x;
    const worldY = camera.y + input.mouse.y;
    const dx = worldX - state.player.x;
    const dy = worldY - state.player.y;
    const len = Math.hypot(dx, dy) || 1;
    state.player.aimX = dx / len;
    state.player.aimY = dy / len;
  }

  function fireBullet() {
    if (state.player.fireCooldown > 0) return;
    const speed = 520;
    state.bullets.push({
      x: state.player.x + state.player.aimX * 18,
      y: state.player.y + state.player.aimY * 18,
      vx: state.player.aimX * speed,
      vy: state.player.aimY * speed,
      life: 900
    });
    state.player.fireCooldown = 140;
  }

  function enemyFire(enemy) {
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const lead = 0.12;
    const targetX = state.player.x + state.player.vx * lead * dist;
    const targetY = state.player.y + state.player.vy * lead * dist;
    const lx = targetX - enemy.x;
    const ly = targetY - enemy.y;
    const len = Math.hypot(lx, ly) || 1;
    state.enemyBullets.push({
      x: enemy.x,
      y: enemy.y,
      vx: (lx / len) * 280,
      vy: (ly / len) * 280,
      life: 1400
    });
  }

  function applyDamage(amount) {
    state.player.lastHit = performance.now();
    if (state.player.shield > 0) {
      const absorbed = Math.min(state.player.shield, amount);
      state.player.shield -= absorbed;
      amount -= absorbed;
    }
    if (amount > 0) {
      state.player.hp -= amount;
    }
  }

  function update(dt) {
    const player = state.player;
    const accel = 280;
    const maxSpeed = 320;
    const friction = 0.88;
    const boostActive = input.keys['Shift'] && player.boost > 0;
    const boostMultiplier = boostActive ? 1.6 : 1.0;

    let ax = 0;
    let ay = 0;
    if (input.keys['KeyW']) ay -= 1;
    if (input.keys['KeyS']) ay += 1;
    if (input.keys['KeyA']) ax -= 1;
    if (input.keys['KeyD']) ax += 1;

    if (ax !== 0 || ay !== 0) {
      const len = Math.hypot(ax, ay) || 1;
      player.vx += (ax / len) * accel * (dt / 1000) * boostMultiplier;
      player.vy += (ay / len) * accel * (dt / 1000) * boostMultiplier;
    }

    player.vx *= friction;
    player.vy *= friction;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > maxSpeed * boostMultiplier) {
      const scale = (maxSpeed * boostMultiplier) / speed;
      player.vx *= scale;
      player.vy *= scale;
    }

    player.x = Math.max(0, Math.min(world.width, player.x + player.vx * dt / 1000));
    player.y = Math.max(0, Math.min(world.height, player.y + player.vy * dt / 1000));

    if (boostActive) {
      player.boost = Math.max(0, player.boost - 30 * dt / 1000);
    } else {
      player.boost = Math.min(player.maxBoost, player.boost + 20 * dt / 1000);
    }

    if (performance.now() - player.lastHit > 1400) {
      player.shield = Math.min(player.maxShield, player.shield + 25 * dt / 1000);
    }

    if (player.fireCooldown > 0) player.fireCooldown -= dt;

    const controlMode = getControlMode();
    const camera = getCamera();
    if (controlMode === 'mouse') {
      aimFromMouse(camera);
    } else {
      aimFromKeyboard();
    }

    if (input.mouse.down || input.keys['Space']) {
      fireBullet();
    }

    state.bullets.forEach(b => {
      b.x += b.vx * dt / 1000;
      b.y += b.vy * dt / 1000;
      b.life -= dt;
    });
    state.bullets = state.bullets.filter(b => b.life > 0 && b.x > -200 && b.x < world.width + 200 && b.y > -200 && b.y < world.height + 200);

    state.enemyBullets.forEach(b => {
      b.x += b.vx * dt / 1000;
      b.y += b.vy * dt / 1000;
      b.life -= dt;
    });
    state.enemyBullets = state.enemyBullets.filter(b => b.life > 0 && b.x > -200 && b.x < world.width + 200 && b.y > -200 && b.y < world.height + 200);

    state.enemies.forEach(enemy => {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;
      if (enemy.type === 'chaser') {
        enemy.vx += ux * 120 * dt / 1000;
        enemy.vy += uy * 120 * dt / 1000;
      } else {
        enemy.vx += (ux * 80 - uy * 60) * dt / 1000;
        enemy.vy += (uy * 80 + ux * 60) * dt / 1000;
      }
      enemy.vx *= 0.92;
      enemy.vy *= 0.92;
      enemy.x += enemy.vx * dt / 1000;
      enemy.y += enemy.vy * dt / 1000;
      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        enemyFire(enemy);
        enemy.fireTimer = 800 + Math.random() * 600;
      }
    });

    // Collisions
    state.bullets.forEach(bullet => {
      state.enemies.forEach(enemy => {
        if (enemy.hp <= 0) return;
        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        if (Math.hypot(dx, dy) < 16) {
          enemy.hp -= 12;
          bullet.life = 0;
          if (enemy.hp <= 0) {
            state.kills += 1;
            state.particles.push({ x: enemy.x, y: enemy.y, life: 500 });
          }
        }
      });
    });

    state.enemyBullets.forEach(bullet => {
      const dx = bullet.x - player.x;
      const dy = bullet.y - player.y;
      if (Math.hypot(dx, dy) < 18) {
        applyDamage(12);
        bullet.life = 0;
      }
    });

    state.enemies = state.enemies.filter(e => e.hp > 0);
    if (state.enemies.length === 0) {
      state.wave += 1;
      spawnWave();
    }

    if (player.hp <= 0) {
      state.running = false;
    }

    updateHud();
  }

  function getCamera() {
    const camX = Math.max(0, Math.min(world.width - canvas.width, state.player.x - canvas.width / 2));
    const camY = Math.max(0, Math.min(world.height - canvas.height, state.player.y - canvas.height / 2));
    return { x: camX, y: camY };
  }

  function drawGrid(camera) {
    const spacing = 80;
    ctx.strokeStyle = 'rgba(71,245,255,0.18)';
    ctx.lineWidth = 1;
    for (let x = - (camera.x % spacing); x < canvas.width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = - (camera.y % spacing); y < canvas.height; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#050814';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const camera = getCamera();
    drawGrid(camera);

    // Draw player
    const player = state.player;
    const px = player.x - camera.x;
    const py = player.y - camera.y;
    ctx.save();
    ctx.translate(px, py);
    const angle = Math.atan2(player.aimY, player.aimX);
    ctx.rotate(angle);
    ctx.fillStyle = '#4af0ff';
    ctx.shadowColor = '#4af0ff';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, 10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, -10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (player.shield > 10) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(90,200,255,0.5)';
      ctx.lineWidth = 2;
      ctx.arc(px, py, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Enemies
    state.enemies.forEach(enemy => {
      const ex = enemy.x - camera.x;
      const ey = enemy.y - camera.y;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(Math.atan2(player.y - enemy.y, player.x - enemy.x));
      ctx.fillStyle = enemy.type === 'chaser' ? '#ff6b6b' : '#ffa94d';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, 8);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-10, -8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // Bullets
    ctx.fillStyle = '#c6f6ff';
    state.bullets.forEach(b => {
      ctx.fillRect(b.x - camera.x - 2, b.y - camera.y - 2, 4, 4);
    });
    ctx.fillStyle = '#ffb37b';
    state.enemyBullets.forEach(b => {
      ctx.fillRect(b.x - camera.x - 2, b.y - camera.y - 2, 4, 4);
    });

    // Particles
    state.particles.forEach(p => {
      ctx.fillStyle = 'rgba(255,200,120,0.6)';
      ctx.beginPath();
      ctx.arc(p.x - camera.x, p.y - camera.y, 12, 0, Math.PI * 2);
      ctx.fill();
      p.life -= 16;
    });
    state.particles = state.particles.filter(p => p.life > 0);

    if (!state.running) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e6f2ff';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Paused', canvas.width / 2, canvas.height / 2);
    }
  }

  function loop(timestamp) {
    if (!state.running) return;
    const dt = Math.min(40, timestamp - state.lastTime);
    state.lastTime = timestamp;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function start() {
    if (state.running) return;
    state.running = true;
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function pause() {
    state.running = false;
    render();
  }

  function bindInput() {
    if (window.__skygridBound) return;
    window.__skygridBound = true;
    document.addEventListener('keydown', (e) => { input.keys[e.code] = true; });
    document.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      input.mouse.x = e.clientX - rect.left;
      input.mouse.y = e.clientY - rect.top;
    });
    canvas.addEventListener('mousedown', () => { input.mouse.down = true; });
    canvas.addEventListener('mouseup', () => { input.mouse.down = false; });
    canvas.addEventListener('mouseleave', () => { input.mouse.down = false; });
  }

  function initSkygrid() {
    bindInput();
    resetSkygrid();
  }

  startBtn?.addEventListener('click', start);
  pauseBtn?.addEventListener('click', pause);
  resetBtn?.addEventListener('click', resetSkygrid);

  window.initSkygrid = initSkygrid;
  window.stopSkygrid = pause;
})();
