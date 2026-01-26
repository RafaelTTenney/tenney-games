(function () {
  const canvas = document.getElementById('swarm-canvas');
  if (!canvas) {
    window.initSwarm = function () {};
    window.stopSwarm = function () {};
    return;
  }
  const ctx = canvas.getContext('2d');
  const controlSelect = document.getElementById('swarm-controls');
  const autoFireToggle = document.getElementById('swarm-autofire');
  const hudHp = document.getElementById('swarm-hp');
  const hudShield = document.getElementById('swarm-shield');
  const hudPower = document.getElementById('swarm-power');
  const hudScore = document.getElementById('swarm-score');
  const hudWave = document.getElementById('swarm-wave');
  const startBtn = document.getElementById('swarm-start');
  const pauseBtn = document.getElementById('swarm-pause');
  const resetBtn = document.getElementById('swarm-reset');

  const input = { keys: {}, mouse: { x: canvas.width / 2, y: canvas.height / 2, down: false } };

  const state = {
    running: false,
    lastTime: 0,
    scroll: 0,
    score: 0,
    wave: 1,
    spawnTimer: 0,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    pickups: [],
    player: {
      x: canvas.width / 2,
      y: canvas.height - 90,
      hp: 110,
      maxHp: 110,
      shield: 80,
      maxShield: 80,
      power: 1,
      fireCooldown: 0,
      slowmo: 100,
      lastHit: 0
    }
  };

  function resetSwarm() {
    state.running = false;
    state.lastTime = 0;
    state.scroll = 0;
    state.score = 0;
    state.wave = 1;
    state.spawnTimer = 0;
    state.enemies = [];
    state.bullets = [];
    state.enemyBullets = [];
    state.pickups = [];
    state.player = {
      x: canvas.width / 2,
      y: canvas.height - 90,
      hp: 110,
      maxHp: 110,
      shield: 80,
      maxShield: 80,
      power: 1,
      fireCooldown: 0,
      slowmo: 100,
      lastHit: 0
    };
    updateHud();
    render();
  }

  function updateHud() {
    if (hudHp) hudHp.textContent = `HP: ${Math.max(0, Math.round(state.player.hp))}`;
    if (hudShield) hudShield.textContent = `Shield: ${Math.round(state.player.shield)}`;
    if (hudPower) hudPower.textContent = `Power: ${state.player.power}`;
    if (hudScore) hudScore.textContent = `Score: ${state.score}`;
    if (hudWave) hudWave.textContent = `Wave: ${state.wave}`;
  }

  function getAimMode() {
    return controlSelect ? controlSelect.value : 'forward';
  }

  function firePlayer() {
    if (state.player.fireCooldown > 0) return;
    const aimMode = getAimMode();
    let dirX = 0;
    let dirY = -1;
    if (aimMode === 'mouse') {
      const dx = input.mouse.x - state.player.x;
      const dy = input.mouse.y - state.player.y;
      const len = Math.hypot(dx, dy) || 1;
      dirX = dx / len;
      dirY = dy / len;
    }

    const spread = 0.2;
    const shots = state.player.power;
    for (let i = 0; i < shots; i++) {
      const offset = (i - (shots - 1) / 2) * spread;
      const angle = Math.atan2(dirY, dirX) + offset;
      state.bullets.push({
        x: state.player.x,
        y: state.player.y - 16,
        vx: Math.cos(angle) * 520,
        vy: Math.sin(angle) * 520,
        life: 900
      });
    }
    state.player.fireCooldown = 120;
  }

  function spawnEnemy() {
    const typeRoll = Math.random();
    let type = 'drone';
    if (typeRoll > 0.75) type = 'bomber';
    else if (typeRoll > 0.45) type = 'zigzag';
    const x = 60 + Math.random() * (canvas.width - 120);
    state.enemies.push({
      x,
      y: -40,
      hp: type === 'bomber' ? 50 : type === 'zigzag' ? 28 : 20,
      type,
      timer: 0,
      fireTimer: 900 + Math.random() * 500
    });
  }

  function spawnPickup(x, y) {
    const roll = Math.random();
    let type = 'repair';
    if (roll > 0.6) type = 'power';
    else if (roll > 0.3) type = 'shield';
    state.pickups.push({ x, y, type, vy: 60 });
  }

  function applyDamage(amount) {
    state.player.lastHit = performance.now();
    if (state.player.shield > 0) {
      const absorbed = Math.min(state.player.shield, amount);
      state.player.shield -= absorbed;
      amount -= absorbed;
    }
    if (amount > 0) state.player.hp -= amount;
  }

  function update(dt) {
    const player = state.player;
    const speed = 300;
    let dx = 0;
    let dy = 0;
    if (input.keys['KeyW']) dy -= 1;
    if (input.keys['KeyS']) dy += 1;
    if (input.keys['KeyA']) dx -= 1;
    if (input.keys['KeyD']) dx += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy) || 1;
      player.x += (dx / len) * speed * dt / 1000;
      player.y += (dy / len) * speed * dt / 1000;
    }

    player.x = Math.max(40, Math.min(canvas.width - 40, player.x));
    player.y = Math.max(60, Math.min(canvas.height - 60, player.y));

    if (player.fireCooldown > 0) player.fireCooldown -= dt;
    if (performance.now() - player.lastHit > 1400) {
      player.shield = Math.min(player.maxShield, player.shield + 20 * dt / 1000);
    }

    const autoFire = autoFireToggle ? autoFireToggle.checked : true;
    if (autoFire || input.mouse.down || input.keys['Space']) {
      firePlayer();
    }

    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnEnemy();
      state.spawnTimer = Math.max(260, 720 - state.wave * 40);
    }

    state.scroll += dt * 0.08;

    state.enemies.forEach(enemy => {
      enemy.timer += dt;
      if (enemy.type === 'drone') {
        enemy.y += 120 * dt / 1000;
      } else if (enemy.type === 'zigzag') {
        enemy.y += 110 * dt / 1000;
        enemy.x += Math.sin(enemy.timer / 200) * 1.6;
      } else {
        enemy.y += 80 * dt / 1000;
      }

      enemy.fireTimer -= dt;
      if (enemy.type === 'bomber' && enemy.fireTimer <= 0) {
        state.enemyBullets.push({
          x: enemy.x,
          y: enemy.y + 10,
          vx: 0,
          vy: 240,
          life: 1600
        });
        enemy.fireTimer = 1000 + Math.random() * 700;
      }
    });

    state.bullets.forEach(b => {
      b.x += b.vx * dt / 1000;
      b.y += b.vy * dt / 1000;
      b.life -= dt;
    });
    state.enemyBullets.forEach(b => {
      b.x += b.vx * dt / 1000;
      b.y += b.vy * dt / 1000;
      b.life -= dt;
    });

    state.bullets.forEach(b => {
      state.enemies.forEach(enemy => {
        if (enemy.hp <= 0) return;
        if (Math.hypot(b.x - enemy.x, b.y - enemy.y) < 18) {
          enemy.hp -= 12;
          b.life = 0;
          if (enemy.hp <= 0) {
            state.score += enemy.type === 'bomber' ? 80 : 40;
            if (Math.random() < 0.3) spawnPickup(enemy.x, enemy.y);
          }
        }
      });
    });

    state.enemyBullets.forEach(b => {
      if (Math.hypot(b.x - player.x, b.y - player.y) < 16) {
        applyDamage(12);
        b.life = 0;
      }
    });

    state.enemies = state.enemies.filter(e => e.hp > 0 && e.y < canvas.height + 80);
    state.bullets = state.bullets.filter(b => b.life > 0 && b.y > -80 && b.y < canvas.height + 80);
    state.enemyBullets = state.enemyBullets.filter(b => b.life > 0 && b.y < canvas.height + 80);

    state.pickups.forEach(p => {
      p.y += p.vy * dt / 1000;
      if (Math.hypot(p.x - player.x, p.y - player.y) < 20) {
        if (p.type === 'repair') player.hp = Math.min(player.maxHp, player.hp + 18);
        if (p.type === 'shield') player.shield = Math.min(player.maxShield, player.shield + 25);
        if (p.type === 'power') player.power = Math.min(3, player.power + 1);
        p.y = canvas.height + 100;
      }
    });
    state.pickups = state.pickups.filter(p => p.y < canvas.height + 40);

    if (state.score > state.wave * 200) {
      state.wave += 1;
    }

    if (player.hp <= 0) {
      state.running = false;
    }

    updateHud();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#050a12';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Scrolling grid
    ctx.strokeStyle = 'rgba(125,252,154,0.2)';
    ctx.lineWidth = 1;
    const spacing = 60;
    for (let x = 0; x < canvas.width; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = -spacing; y < canvas.height + spacing; y += spacing) {
      ctx.beginPath();
      const offset = (state.scroll % spacing);
      ctx.moveTo(0, y + offset);
      ctx.lineTo(canvas.width, y + offset);
      ctx.stroke();
    }

    // Player
    ctx.save();
    ctx.translate(state.player.x, state.player.y);
    ctx.fillStyle = '#7dfc9a';
    ctx.shadowColor = '#7dfc9a';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(14, 14);
    ctx.lineTo(-14, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (state.player.shield > 6) {
      ctx.strokeStyle = 'rgba(125,252,154,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Enemies
    state.enemies.forEach(enemy => {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.fillStyle = enemy.type === 'bomber' ? '#ffcc5c' : '#ff6b6b';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(0, 16);
      ctx.lineTo(-12, -12);
      ctx.lineTo(12, -12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // Bullets
    ctx.fillStyle = '#e6f2ff';
    state.bullets.forEach(b => ctx.fillRect(b.x - 2, b.y - 4, 4, 8));
    ctx.fillStyle = '#ffb347';
    state.enemyBullets.forEach(b => ctx.fillRect(b.x - 2, b.y - 4, 4, 8));

    // Pickups
    state.pickups.forEach(p => {
      ctx.fillStyle = p.type === 'power' ? '#7dfc9a' : p.type === 'shield' ? '#47f5ff' : '#ff7a47';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fill();
    });

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
    if (window.__swarmBound) return;
    window.__swarmBound = true;
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

  function initSwarm() {
    bindInput();
    resetSwarm();
  }

  startBtn?.addEventListener('click', start);
  pauseBtn?.addEventListener('click', pause);
  resetBtn?.addEventListener('click', resetSwarm);

  window.initSwarm = initSwarm;
  window.stopSwarm = pause;
})();
