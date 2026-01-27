(function () {
  const canvas = document.getElementById('duel-canvas');
  if (!canvas) {
    window.initDuel = function () {};
    window.stopDuel = function () {};
    return;
  }

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;

  const controlsSelect = document.getElementById('duel-controls');
  const hudHp = document.getElementById('duel-hp');
  const hudShield = document.getElementById('duel-shield');
  const hudBoss = document.getElementById('duel-boss');
  const hudCooldown = document.getElementById('duel-cooldown');
  const hudPhase = document.getElementById('duel-phase');
  const startBtn = document.getElementById('duel-start');
  const pauseBtn = document.getElementById('duel-pause');
  const resetBtn = document.getElementById('duel-reset');

  const input = { keys: {}, mouse: { x: canvas.width / 2, y: canvas.height / 2 } };

  const SETTINGS = {
    player: {
      thrust: 560,
      reverseThrust: 340,
      turnRate: 0.0044,
      maxSpeed: 520,
      drag: 0.985,
      fireCooldown: 120
    },
    bullets: {
      speed: 860,
      life: 1100
    },
    enemies: {
      baseCount: 4,
      maxCount: 14,
      thrust: 230,
      thrustVar: 140,
      maxSpeed: 290,
      maxSpeedVar: 130,
      fireBase: 540,
      fireVar: 300,
      bulletSpeed: 380
    },
    shieldRegenDelay: 900,
    shieldRegenRate: 28,
    lookAhead: 260,
    starTile: 2400
  };

  const MAX_WAVES = 6;

  const state = {
    running: false,
    lastTime: 0,
    wave: 1,
    kills: 0,
    spawnTimer: 0,
    spawnInterval: 0,
    waveSpawnsRemaining: 0,
    completed: false,
    bullets: [],
    enemyBullets: [],
    enemies: [],
    particles: [],
    background: {
      stars: []
    },
    camera: {
      x: 0,
      y: 0
    },
    player: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      hp: 120,
      maxHp: 120,
      shield: 80,
      maxShield: 80,
      lastHit: 0,
      fireCooldown: 0
    }
  };

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function wrapOffset(value, size) {
    return ((value % size) + size) % size;
  }

  function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  function buildBackground() {
    state.background.stars = [];
    const layers = [
      { count: 160, sizeMin: 0.6, sizeMax: 1.6, alphaMin: 0.25, alphaMax: 0.7, color: '210,240,255' },
      { count: 110, sizeMin: 1.0, sizeMax: 2.3, alphaMin: 0.3, alphaMax: 0.85, color: '135,210,255' },
      { count: 70, sizeMin: 1.6, sizeMax: 3.0, alphaMin: 0.4, alphaMax: 1, color: '255,190,110' }
    ];
    layers.forEach(layer => {
      for (let i = 0; i < layer.count; i++) {
        state.background.stars.push({
          x: Math.random() * SETTINGS.starTile,
          y: Math.random() * SETTINGS.starTile,
          size: rand(layer.sizeMin, layer.sizeMax),
          alpha: rand(layer.alphaMin, layer.alphaMax),
          color: layer.color
        });
      }
    });
  }

  function resetDuel() {
    state.running = false;
    state.lastTime = 0;
    state.wave = 1;
    state.kills = 0;
    state.spawnTimer = 0;
    state.spawnInterval = 0;
    state.waveSpawnsRemaining = 0;
    state.completed = false;
    state.bullets = [];
    state.enemyBullets = [];
    state.enemies = [];
    state.particles = [];
    buildBackground();
    state.player = {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: -Math.PI / 2,
      hp: 120,
      maxHp: 120,
      shield: 80,
      maxShield: 80,
      lastHit: 0,
      fireCooldown: 0
    };
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    spawnWave();
    updateHud();
    render();
  }

  function updateHud() {
    if (hudHp) hudHp.textContent = `Hull: ${Math.max(0, Math.round(state.player.hp))}`;
    if (hudShield) hudShield.textContent = `Shield: ${Math.round(state.player.shield)}`;
    if (hudBoss) hudBoss.textContent = `Kills: ${state.kills}`;
    if (hudCooldown) hudCooldown.textContent = `Enemies: ${state.enemies.length}`;
    if (hudPhase) hudPhase.textContent = `Wave: ${Math.min(state.wave, MAX_WAVES)}/${MAX_WAVES}`;
  }

  function getAssistMode() {
    return controlsSelect ? controlsSelect.value : 'assist';
  }

  function spawnParticle(x, y, color) {
    state.particles.push({
      x,
      y,
      vx: rand(-120, 120),
      vy: rand(-120, 120),
      size: rand(1.5, 3.5),
      life: rand(280, 520),
      maxLife: 520,
      color: color || '255,180,120'
    });
  }

  function spawnExplosion(x, y, color) {
    for (let i = 0; i < 16; i++) spawnParticle(x, y, color);
  }

  function spawnEnemy() {
    const player = state.player;
    const forward = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
    const biasFront = Math.random() < 0.72;
    const offset = biasFront ? rand(-Math.PI * 0.45, Math.PI * 0.45) : rand(Math.PI * 0.6, Math.PI * 1.4);
    const spawnAngle = Math.atan2(forward.y, forward.x) + offset;
    const radius = rand(520, 860);
    const x = player.x + Math.cos(spawnAngle) * radius;
    const y = player.y + Math.sin(spawnAngle) * radius;

    const typeRoll = Math.random();
    const type = typeRoll > 0.75 ? 'ace' : typeRoll > 0.4 ? 'strafer' : 'chaser';
    const skill = type === 'ace' ? 1.2 : type === 'strafer' ? 1.05 : 0.9;
    state.enemies.push({
      x,
      y,
      vx: 0,
      vy: 0,
      hp: (type === 'ace' ? 28 : type === 'strafer' ? 24 : 20) + Math.floor((state.wave - 1) * 1.6),
      angle: rand(0, Math.PI * 2),
      type,
      turnRate: (0.0028 + Math.random() * 0.0012) * skill,
      thrust: (SETTINGS.enemies.thrust + Math.random() * SETTINGS.enemies.thrustVar) * skill,
      maxSpeed: (SETTINGS.enemies.maxSpeed + Math.random() * SETTINGS.enemies.maxSpeedVar) * skill,
      orbit: Math.random() > 0.5 ? 1 : -1,
      fireTimer: getEnemyFireDelay(type),
      skill
    });
  }

  function spawnWave() {
    state.enemies = [];
    const initialCount = Math.min(SETTINGS.enemies.baseCount + Math.floor((state.wave - 1) * 0.8), SETTINGS.enemies.maxCount);
    const waveBudget = Math.min(SETTINGS.enemies.baseCount + 2 + Math.floor(state.wave * 1.1), SETTINGS.enemies.maxCount + 4);
    state.waveSpawnsRemaining = Math.max(0, waveBudget - initialCount);
    state.spawnInterval = Math.max(820, 1600 - state.wave * 120);
    state.spawnTimer = state.spawnInterval;
    for (let i = 0; i < initialCount; i++) spawnEnemy();
  }

  function getEnemyFireDelay(type) {
    const typeOffset = type === 'ace' ? -120 : type === 'chaser' ? 0 : 80;
    const variance = type === 'ace' ? SETTINGS.enemies.fireVar * 0.7 : SETTINGS.enemies.fireVar;
    return SETTINGS.enemies.fireBase + typeOffset + Math.random() * variance;
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

  function firePlayer() {
    if (state.player.fireCooldown > 0) return;
    const player = state.player;
    let fireAngle = player.angle;

    if (getAssistMode() === 'assist') {
      let closest = null;
      let closestDist = Infinity;
      state.enemies.forEach(enemy => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const dist = Math.hypot(dx, dy);
        const angleTo = Math.atan2(dy, dx);
        const diff = Math.abs(normalizeAngle(angleTo - player.angle));
        if (dist < 900 && diff < 0.6 && dist < closestDist) {
          closestDist = dist;
          closest = enemy;
          fireAngle = angleTo;
        }
      });
      if (!closest) fireAngle = player.angle;
    }

    state.bullets.push({
      x: player.x + Math.cos(fireAngle) * 20,
      y: player.y + Math.sin(fireAngle) * 20,
      vx: Math.cos(fireAngle) * SETTINGS.bullets.speed,
      vy: Math.sin(fireAngle) * SETTINGS.bullets.speed,
      life: SETTINGS.bullets.life,
      damage: 12
    });

    state.player.fireCooldown = SETTINGS.player.fireCooldown;
  }

  function enemyFire(enemy) {
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const len = Math.hypot(dx, dy) || 1;
    const speed = SETTINGS.enemies.bulletSpeed + enemy.skill * 40;
    state.enemyBullets.push({
      x: enemy.x + Math.cos(enemy.angle) * 16,
      y: enemy.y + Math.sin(enemy.angle) * 16,
      vx: (dx / len) * speed,
      vy: (dy / len) * speed,
      life: 1200
    });
  }

  function update(dt) {
    const dtSec = dt / 1000;
    const player = state.player;

    const left = input.keys['ArrowLeft'] || input.keys['KeyA'];
    const right = input.keys['ArrowRight'] || input.keys['KeyD'];
    const forward = input.keys['ArrowUp'] || input.keys['KeyW'];
    const reverse = input.keys['ArrowDown'] || input.keys['KeyS'];

    if (left) player.angle -= SETTINGS.player.turnRate * dt;
    if (right) player.angle += SETTINGS.player.turnRate * dt;

    if (forward) {
      player.vx += Math.cos(player.angle) * SETTINGS.player.thrust * dtSec;
      player.vy += Math.sin(player.angle) * SETTINGS.player.thrust * dtSec;
    }
    if (reverse) {
      player.vx -= Math.cos(player.angle) * SETTINGS.player.reverseThrust * dtSec;
      player.vy -= Math.sin(player.angle) * SETTINGS.player.reverseThrust * dtSec;
    }

    player.vx *= Math.pow(SETTINGS.player.drag, dt / 16.67);
    player.vy *= Math.pow(SETTINGS.player.drag, dt / 16.67);
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > SETTINGS.player.maxSpeed) {
      const scale = SETTINGS.player.maxSpeed / speed;
      player.vx *= scale;
      player.vy *= scale;
    }

    player.x += player.vx * dtSec;
    player.y += player.vy * dtSec;

    const targetCamX = player.x + Math.cos(player.angle) * SETTINGS.lookAhead;
    const targetCamY = player.y + Math.sin(player.angle) * SETTINGS.lookAhead;
    state.camera.x += (targetCamX - state.camera.x) * 0.08;
    state.camera.y += (targetCamY - state.camera.y) * 0.08;

    if (performance.now() - player.lastHit > SETTINGS.shieldRegenDelay) {
      player.shield = Math.min(player.maxShield, player.shield + SETTINGS.shieldRegenRate * dtSec);
    }

    if (player.fireCooldown > 0) player.fireCooldown -= dt;

    if (input.keys['Space']) firePlayer();

    state.bullets.forEach(b => {
      b.x += b.vx * dtSec;
      b.y += b.vy * dtSec;
      b.life -= dt;
    });
    state.bullets = state.bullets.filter(b => b.life > 0);

    state.enemyBullets.forEach(b => {
      b.x += b.vx * dtSec;
      b.y += b.vy * dtSec;
      b.life -= dt;
    });
    state.enemyBullets = state.enemyBullets.filter(b => b.life > 0);

    state.enemies.forEach(enemy => {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      let desired = Math.atan2(dy, dx);
      if (enemy.type === 'strafer' && dist < 260) desired += enemy.orbit * Math.PI / 2;
      if (enemy.type === 'ace' && dist < 180) desired -= enemy.orbit * Math.PI / 2;
      const diff = normalizeAngle(desired - enemy.angle);
      const turnStep = enemy.turnRate * dt;
      enemy.angle += clamp(diff, -turnStep, turnStep);

      enemy.vx += Math.cos(enemy.angle) * enemy.thrust * dtSec;
      enemy.vy += Math.sin(enemy.angle) * enemy.thrust * dtSec;

      const eSpeed = Math.hypot(enemy.vx, enemy.vy);
      if (eSpeed > enemy.maxSpeed) {
        const scale = enemy.maxSpeed / eSpeed;
        enemy.vx *= scale;
        enemy.vy *= scale;
      }

      enemy.vx *= Math.pow(0.988, dt / 16.67);
      enemy.vy *= Math.pow(0.988, dt / 16.67);
      enemy.x += enemy.vx * dtSec;
      enemy.y += enemy.vy * dtSec;

      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        enemyFire(enemy);
        enemy.fireTimer = getEnemyFireDelay(enemy.type);
      }
    });

    state.bullets.forEach(bullet => {
      state.enemies.forEach(enemy => {
        if (enemy.hp <= 0) return;
        if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < 16) {
          enemy.hp -= bullet.damage || 12;
          bullet.life = 0;
          spawnParticle(enemy.x, enemy.y, '255,200,160');
          if (enemy.hp <= 0) {
            state.kills += 1;
            spawnExplosion(enemy.x, enemy.y, enemy.type === 'ace' ? '255,120,255' : '255,170,110');
          }
        }
      });
    });

    state.enemyBullets.forEach(bullet => {
      if (Math.hypot(bullet.x - player.x, bullet.y - player.y) < 18) {
        applyDamage(10);
        spawnParticle(player.x, player.y, '120,200,255');
        bullet.life = 0;
      }
    });

    state.enemies = state.enemies.filter(e => e.hp > 0);

    state.spawnTimer -= dt;
    if (state.waveSpawnsRemaining > 0 && state.spawnTimer <= 0 && state.enemies.length < SETTINGS.enemies.maxCount) {
      spawnEnemy();
      state.waveSpawnsRemaining -= 1;
      state.spawnTimer = state.spawnInterval * (0.7 + Math.random() * 0.5);
    }

    if (state.enemies.length === 0 && state.waveSpawnsRemaining <= 0) {
      if (state.wave >= MAX_WAVES) {
        state.completed = true;
        state.running = false;
      } else {
        state.wave += 1;
        spawnWave();
      }
    }

    if (player.hp <= 0) state.running = false;

    state.particles.forEach(p => {
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.life -= dt;
    });
    state.particles = state.particles.filter(p => p.life > 0);

    updateHud();
  }

  function worldToScreen(x, y, camX, camY, rot, centerX, centerY) {
    const dx = x - camX;
    const dy = y - camY;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    const rx = dx * cosR - dy * sinR;
    const ry = dx * sinR + dy * cosR;
    return { x: centerX + rx, y: centerY + ry };
  }

  function drawEnemyBrackets(x, y, color) {
    const size = 10;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - size, y - size / 2);
    ctx.lineTo(x - size / 2, y - size / 2);
    ctx.lineTo(x - size / 2, y - size);
    ctx.moveTo(x + size, y - size / 2);
    ctx.lineTo(x + size / 2, y - size / 2);
    ctx.lineTo(x + size / 2, y - size);
    ctx.moveTo(x - size, y + size / 2);
    ctx.lineTo(x - size / 2, y + size / 2);
    ctx.lineTo(x - size / 2, y + size);
    ctx.moveTo(x + size, y + size / 2);
    ctx.lineTo(x + size / 2, y + size / 2);
    ctx.lineTo(x + size / 2, y + size);
    ctx.stroke();
  }

  function drawCockpitFrame(centerX, centerY) {
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(71,245,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.1);
    ctx.lineTo(w * 0.26, h * 0.72);
    ctx.lineTo(w * 0.74, h * 0.72);
    ctx.lineTo(w * 0.92, h * 0.1);
    ctx.stroke();

    ctx.fillStyle = 'rgba(6,12,20,0.35)';
    ctx.fillRect(0, h * 0.74, w, h * 0.26);
    ctx.strokeStyle = 'rgba(71,245,255,0.25)';
    ctx.strokeRect(0, h * 0.74, w, h * 0.26);

    ctx.strokeStyle = 'rgba(125,252,154,0.65)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(centerX - 50, centerY);
    ctx.lineTo(centerX + 50, centerY);
    ctx.moveTo(centerX, centerY - 50);
    ctx.lineTo(centerX, centerY + 50);
    ctx.stroke();

    ctx.fillStyle = 'rgba(125,252,154,0.9)';
    ctx.font = '11px monospace';
    ctx.fillText(`SPD ${Math.round(Math.hypot(state.player.vx, state.player.vy))}`, 16, h * 0.77 + 20);
    ctx.fillText(`SHD ${Math.round(state.player.shield)}`, 16, h * 0.77 + 38);
    ctx.fillText(`HULL ${Math.round(state.player.hp)}`, 16, h * 0.77 + 56);
    ctx.fillText(`WAVE ${Math.min(state.wave, MAX_WAVES)}`, w - 110, h * 0.77 + 20);
    ctx.fillText(`KILLS ${state.kills}`, w - 110, h * 0.77 + 38);

    ctx.restore();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const player = state.player;
    const rot = -player.angle - Math.PI / 2;
    const centerX = canvas.width / 2;
    const centerY = canvas.height * 0.62;

    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const camX = state.camera.x;
    const camY = state.camera.y;
    const tile = SETTINGS.starTile;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(rot);
    ctx.translate(-camX, -camY);

    state.background.stars.forEach(star => {
      const offsetX = wrapOffset(star.x - camX + tile * 0.5, tile) - tile * 0.5;
      const offsetY = wrapOffset(star.y - camY + tile * 0.5, tile) - tile * 0.5;
      const sx = camX + offsetX;
      const sy = camY + offsetY;
      ctx.fillStyle = `rgba(${star.color},${star.alpha})`;
      ctx.fillRect(sx, sy, star.size, star.size);
    });

    state.enemies.forEach(enemy => {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(enemy.angle);
      const bodyColor = enemy.type === 'ace' ? '#ff7bff' : enemy.type === 'strafer' ? '#ffa94d' : '#ff6b6b';
      ctx.fillStyle = bodyColor;
      ctx.shadowColor = bodyColor;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, 8);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-10, -8);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    });

    ctx.fillStyle = '#bfe8ff';
    state.bullets.forEach(b => {
      ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    });
    ctx.fillStyle = '#ffb37b';
    state.enemyBullets.forEach(b => {
      ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    });

    state.particles.forEach(p => {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = `rgba(${p.color},${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();

    state.enemies.forEach(enemy => {
      const screen = worldToScreen(enemy.x, enemy.y, camX, camY, rot, centerX, centerY);
      if (screen.x < -40 || screen.x > canvas.width + 40 || screen.y < -40 || screen.y > canvas.height + 40) return;
      const color = enemy.type === 'ace' ? 'rgba(255,120,255,0.9)' : enemy.type === 'strafer' ? 'rgba(255,170,90,0.9)' : 'rgba(255,110,110,0.9)';
      drawEnemyBrackets(screen.x, screen.y, color);
    });

    drawCockpitFrame(centerX, centerY);

    if (!state.running) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e6f2ff';
      ctx.font = '20px monospace';
      ctx.textAlign = 'center';
      const label = state.completed
        ? 'Mission Complete - Press Reset'
        : state.player.hp <= 0
          ? 'Ship Destroyed - Press Reset'
          : 'Paused';
      ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    }
  }

  function loop(timestamp) {
    if (!state.running) return;
    const dt = Math.min(36, timestamp - state.lastTime);
    state.lastTime = timestamp;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  function start() {
    if (state.running) return;
    if (state.completed) return;
    state.running = true;
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function pause() {
    state.running = false;
    render();
  }

  function bindInput() {
    if (window.__duelBound) return;
    window.__duelBound = true;
    document.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) {
        e.preventDefault();
      }
      input.keys[e.code] = true;
    });
    document.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
    canvas.addEventListener('mousemove', (e) => {
      const rect = canvas.getBoundingClientRect();
      input.mouse.x = e.clientX - rect.left;
      input.mouse.y = e.clientY - rect.top;
    });
  }

  function initDuel() {
    bindInput();
    resetDuel();
  }

  startBtn?.addEventListener('click', start);
  pauseBtn?.addEventListener('click', pause);
  resetBtn?.addEventListener('click', resetDuel);

  window.initDuel = initDuel;
  window.stopDuel = pause;
})();
