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

  const world = { width: canvas.width, height: canvas.height };
  const input = { keys: {}, mouse: { x: canvas.width / 2, y: canvas.height / 2, down: false } };
  const SETTINGS = {
    player: {
      turnRate: 0.0064,
      thrust: 760,
      reverseThrust: 420,
      maxSpeed: 560,
      drag: 0.992,
      fireCooldown: 70
    },
    bullets: {
      speed: 780,
      life: 1050
    },
    enemies: {
      baseCount: 4,
      maxCount: 18,
      thrust: 250,
      thrustVar: 120,
      maxSpeed: 305,
      maxSpeedVar: 110,
      fireBase: 460,
      fireVar: 320,
      bulletSpeed: 390
    },
    shieldRegenDelay: 1050,
    shieldRegenRate: 36,
    background: {
      starLayers: [
        { count: 210, sizeMin: 0.6, sizeMax: 1.6, alphaMin: 0.3, alphaMax: 0.75, speed: 0.18, color: '215,240,255' },
        { count: 140, sizeMin: 1.0, sizeMax: 2.3, alphaMin: 0.35, alphaMax: 0.9, speed: 0.38, color: '140,210,255' },
        { count: 70, sizeMin: 1.5, sizeMax: 3.4, alphaMin: 0.4, alphaMax: 1, speed: 0.62, color: '125,252,154' }
      ]
    }
  };
  const MAX_WAVES = 8;
  const VIEW_SCALE = 0.9;

  const state = {
    running: false,
    lastTime: 0,
    kills: 0,
    wave: 1,
    spawnTimer: 0,
    spawnInterval: 0,
    waveSpawnsRemaining: 0,
    completed: false,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    particles: [],
    background: {
      stars: [],
      nebulae: [],
      comets: [],
      tileW: 0,
      tileH: 0
    },
    camera: {
      x: world.width / 2,
      y: world.height / 2
    },
    player: {
      x: world.width / 2,
      y: world.height / 2,
      vx: 0,
      vy: 0,
      hp: 120,
      maxHp: 120,
      shield: 100,
      maxShield: 100,
      lastHit: 0,
      fireCooldown: 0,
      angle: -Math.PI / 2
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

  function getWaveSpeedScale() {
    return clamp(0.9 + (state.wave - 1) * 0.05, 0.9, 1.7);
  }

  function getWaveAggroScale() {
    return clamp(0.88 + (state.wave - 1) * 0.06, 0.88, 2);
  }

  function buildBackground() {
    state.background.stars = [];
    state.background.nebulae = [];
    state.background.comets = [];
    state.background.tileW = Math.max(canvas.width * 2.7, 2600);
    state.background.tileH = Math.max(canvas.height * 2.7, 1900);

    const tileW = state.background.tileW;
    const tileH = state.background.tileH;

    SETTINGS.background.starLayers.forEach(layer => {
      for (let i = 0; i < layer.count; i++) {
        state.background.stars.push({
          x: Math.random() * tileW,
          y: Math.random() * tileH,
          size: rand(layer.sizeMin, layer.sizeMax),
          alpha: rand(layer.alphaMin, layer.alphaMax),
          speed: layer.speed,
          color: layer.color
        });
      }
    });

    const nebulaColors = [
      '70,180,255',
      '255,120,90',
      '110,255,200'
    ];
    const nebulaCount = 3;
    for (let i = 0; i < nebulaCount; i++) {
      state.background.nebulae.push({
        x: Math.random() * tileW,
        y: Math.random() * tileH,
        radius: rand(180, 320),
        color: nebulaColors[i % nebulaColors.length],
        alpha: rand(0.18, 0.28)
      });
    }
  }

  function spawnComet() {
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) { x = -80; y = rand(0, world.height); }
    if (edge === 1) { x = world.width + 80; y = rand(0, world.height); }
    if (edge === 2) { x = rand(0, world.width); y = -80; }
    if (edge === 3) { x = rand(0, world.width); y = world.height + 80; }

    const angle = rand(0, Math.PI * 2);
    const speed = rand(220, 420);
    state.background.comets.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(800, 1400)
    });
  }

  function spawnEnemy() {
    const waveSpeed = getWaveSpeedScale();
    const waveAggro = getWaveAggroScale();
    const angle = Math.random() * Math.PI * 2;
    const radius = rand(640, 980);
    const x = state.player.x + Math.cos(angle) * radius;
    const y = state.player.y + Math.sin(angle) * radius;

    const typeRoll = Math.random();
    const type = typeRoll > 0.78 ? 'ace' : typeRoll > 0.45 ? 'strafer' : 'chaser';
    const skill = type === 'ace' ? 1.18 : type === 'strafer' ? 1 : 0.85;
    const hpBase = type === 'ace' ? 28 : type === 'chaser' ? 20 : 24;
    state.enemies.push({
      x,
      y,
      vx: 0,
      vy: 0,
      hp: hpBase + Math.floor((state.wave - 1) * 1.8),
      type,
      angle: Math.random() * Math.PI * 2,
      turnRate: (0.0033 + Math.random() * 0.0016) * skill * waveAggro,
      thrust: (SETTINGS.enemies.thrust + Math.random() * SETTINGS.enemies.thrustVar) * skill * waveSpeed,
      maxSpeed: (SETTINGS.enemies.maxSpeed + Math.random() * SETTINGS.enemies.maxSpeedVar) * waveSpeed,
      orbit: Math.random() > 0.5 ? 1 : -1,
      fireTimer: getEnemyFireDelayForType(type),
      skill
    });
  }

  function resetSkygrid() {
    state.running = false;
    state.lastTime = 0;
    state.kills = 0;
    state.wave = 1;
    state.spawnTimer = 0;
    state.spawnInterval = 0;
    state.waveSpawnsRemaining = 0;
    state.completed = false;
    state.enemies = [];
    state.bullets = [];
    state.enemyBullets = [];
    state.particles = [];
    buildBackground();
    state.player = {
      x: world.width / 2,
      y: world.height / 2,
      vx: 0,
      vy: 0,
      hp: 120,
      maxHp: 120,
      shield: 100,
      maxShield: 100,
      lastHit: 0,
      fireCooldown: 0,
      angle: -Math.PI / 2
    };
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    spawnWave();
    updateHud();
    render();
  }

  function spawnWave() {
    state.enemies = [];
    const initialCount = Math.min(SETTINGS.enemies.baseCount + Math.floor((state.wave - 1) * 0.9), SETTINGS.enemies.maxCount);
    const waveBudget = Math.min(SETTINGS.enemies.baseCount + 2 + Math.floor(state.wave * 1.1), SETTINGS.enemies.maxCount + 4);
    state.waveSpawnsRemaining = Math.max(0, waveBudget - initialCount);
    state.spawnInterval = Math.max(900, 1900 - state.wave * 110);
    state.spawnTimer = state.spawnInterval;
    for (let i = 0; i < initialCount; i++) {
      spawnEnemy();
    }
  }

  function updateHud() {
    if (hudHp) hudHp.textContent = `HP: ${Math.max(0, Math.round(state.player.hp))}`;
    if (hudShield) hudShield.textContent = `Shield: ${Math.round(state.player.shield)}`;
    const speed = Math.hypot(state.player.vx, state.player.vy);
    if (hudBoost) hudBoost.textContent = `Speed: ${Math.round(speed)}`;
    if (hudKills) hudKills.textContent = `Kills: ${state.kills}`;
    if (hudWave) hudWave.textContent = `Wave: ${Math.min(state.wave, MAX_WAVES)}/${MAX_WAVES}`;
  }

  function getFireMode() {
    return controlsSelect ? controlsSelect.value : 'space';
  }

  function fireBullet() {
    if (state.player.fireCooldown > 0) return;
    const speed = SETTINGS.bullets.speed;
    state.bullets.push({
      x: state.player.x + Math.cos(state.player.angle) * 18,
      y: state.player.y + Math.sin(state.player.angle) * 18,
      vx: Math.cos(state.player.angle) * speed,
      vy: Math.sin(state.player.angle) * speed,
      life: SETTINGS.bullets.life
    });
    state.player.fireCooldown = SETTINGS.player.fireCooldown;
  }

  function enemyFire(enemy) {
    const waveAggro = getWaveAggroScale();
    const dx = state.player.x - enemy.x;
    const dy = state.player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const lead = 0.35 + enemy.skill * 0.2;
    const targetX = state.player.x + state.player.vx * lead;
    const targetY = state.player.y + state.player.vy * lead;
    const lx = targetX - enemy.x;
    const ly = targetY - enemy.y;
    const len = Math.hypot(lx, ly) || 1;
    const speed = (SETTINGS.enemies.bulletSpeed + enemy.skill * 55) * waveAggro;
    state.enemyBullets.push({
      x: enemy.x + Math.cos(enemy.angle) * 16,
      y: enemy.y + Math.sin(enemy.angle) * 16,
      vx: (lx / len) * speed,
      vy: (ly / len) * speed,
      life: 1200
    });
  }

  function spawnParticle(x, y, opts) {
    state.particles.push({
      x,
      y,
      vx: opts.vx || 0,
      vy: opts.vy || 0,
      size: opts.size || 2,
      color: opts.color || '255,200,120',
      life: opts.life || 400,
      maxLife: opts.life || 400
    });
  }

  function spawnExplosion(x, y, hue) {
    const baseColor = hue || '255,190,120';
    for (let i = 0; i < 18; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(80, 320);
      spawnParticle(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: rand(2, 5),
        life: rand(400, 720),
        color: baseColor
      });
    }
  }

  function spawnSparks(x, y, hue) {
    const sparkColor = hue || '255,240,180';
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(40, 160);
      spawnParticle(x, y, {
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: rand(1, 3),
        life: rand(200, 380),
        color: sparkColor
      });
    }
  }

  function emitThruster(player, reverse) {
    const angle = player.angle + Math.PI + rand(-0.4, 0.4);
    const speed = rand(80, 200);
    const offset = reverse ? -14 : 16;
    const baseX = player.x - Math.cos(player.angle) * offset;
    const baseY = player.y - Math.sin(player.angle) * offset;
    spawnParticle(baseX, baseY, {
      vx: Math.cos(angle) * speed + player.vx * 0.2,
      vy: Math.sin(angle) * speed + player.vy * 0.2,
      size: rand(1.5, 3.5),
      life: rand(220, 420),
      color: reverse ? '120,200,255' : '71,245,255'
    });
  }

  function getEnemyFireDelayForType(type) {
    const waveAggro = getWaveAggroScale();
    const typeOffset = type === 'ace' ? -80 : type === 'chaser' ? 0 : 70;
    const variance = type === 'ace' ? SETTINGS.enemies.fireVar * 0.7 : SETTINGS.enemies.fireVar;
    return (SETTINGS.enemies.fireBase + typeOffset + Math.random() * variance) / waveAggro;
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
    const dtSec = dt / 1000;
    const rotSpeed = SETTINGS.player.turnRate;
    const thrust = SETTINGS.player.thrust;
    const reverseThrust = SETTINGS.player.reverseThrust;
    const maxSpeed = SETTINGS.player.maxSpeed;
    const drag = Math.pow(SETTINGS.player.drag, dt / 16.67);

    const left = input.keys['ArrowLeft'] || input.keys['KeyA'];
    const right = input.keys['ArrowRight'] || input.keys['KeyD'];
    const forward = input.keys['ArrowUp'] || input.keys['KeyW'];
    const reverse = input.keys['ArrowDown'] || input.keys['KeyS'];

    if (left) player.angle -= rotSpeed * dt;
    if (right) player.angle += rotSpeed * dt;
    if (forward) {
      player.vx += Math.cos(player.angle) * thrust * dtSec;
      player.vy += Math.sin(player.angle) * thrust * dtSec;
      emitThruster(player, false);
    }
    if (reverse) {
      player.vx -= Math.cos(player.angle) * reverseThrust * dtSec;
      player.vy -= Math.sin(player.angle) * reverseThrust * dtSec;
      emitThruster(player, true);
    }

    player.vx *= drag;
    player.vy *= drag;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > maxSpeed) {
      const scale = maxSpeed / speed;
      player.vx *= scale;
      player.vy *= scale;
    }

    player.x += player.vx * dtSec;
    player.y += player.vy * dtSec;
    state.camera.x = player.x;
    state.camera.y = player.y;

    if (performance.now() - player.lastHit > SETTINGS.shieldRegenDelay) {
      player.shield = Math.min(player.maxShield, player.shield + SETTINGS.shieldRegenRate * dt / 1000);
    }

    if (player.fireCooldown > 0) player.fireCooldown -= dt;

    const fireMode = getFireMode();
    if (input.keys['Space'] || (fireMode === 'mouse' && input.mouse.down)) {
      fireBullet();
    }

    if (Math.random() < dtSec * 0.18) spawnComet();

    state.bullets.forEach(b => {
      b.x += b.vx * dt / 1000;
      b.y += b.vy * dt / 1000;
      b.life -= dt;
    });
    const camX = state.camera.x;
    const camY = state.camera.y;
    const viewRadius = Math.max(canvas.width, canvas.height) / VIEW_SCALE;
    const bulletCull = viewRadius * 1.4;
    const enemyCull = viewRadius * 1.9;
    state.bullets = state.bullets.filter(b => {
      if (b.life <= 0) return false;
      return Math.hypot(b.x - camX, b.y - camY) < bulletCull;
    });

    state.enemyBullets.forEach(b => {
      b.x += b.vx * dt / 1000;
      b.y += b.vy * dt / 1000;
      b.life -= dt;
    });
    state.enemyBullets = state.enemyBullets.filter(b => {
      if (b.life <= 0) return false;
      return Math.hypot(b.x - camX, b.y - camY) < bulletCull * 1.05;
    });

    state.enemies.forEach(enemy => {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.hypot(dx, dy) || 1;
      let desired = Math.atan2(dy, dx);
      if (enemy.type === 'strafer' && dist < 220) {
        desired += enemy.orbit * Math.PI / 2;
      }
      if (enemy.type === 'ace' && dist < 140) {
        desired -= enemy.orbit * Math.PI / 2;
      }
      const diff = normalizeAngle(desired - enemy.angle);
      const turnStep = enemy.turnRate * dt;
      enemy.angle += Math.max(-turnStep, Math.min(turnStep, diff));

      const thrustPower = enemy.type === 'strafer' && dist < 180 ? enemy.thrust * 0.7 : enemy.thrust;
      enemy.vx += Math.cos(enemy.angle) * thrustPower * dtSec;
      enemy.vy += Math.sin(enemy.angle) * thrustPower * dtSec;

      const eSpeed = Math.hypot(enemy.vx, enemy.vy);
      if (eSpeed > enemy.maxSpeed) {
        const scale = enemy.maxSpeed / eSpeed;
        enemy.vx *= scale;
        enemy.vy *= scale;
      }

      enemy.vx *= Math.pow(0.987, dt / 16.67);
      enemy.vy *= Math.pow(0.987, dt / 16.67);
      enemy.x += enemy.vx * dtSec;
      enemy.y += enemy.vy * dtSec;

      enemy.fireTimer -= dt;
      if (enemy.fireTimer <= 0) {
        enemyFire(enemy);
        enemy.fireTimer = getEnemyFireDelayForType(enemy.type);
      }
    });

    state.background.comets.forEach(comet => {
      comet.x += comet.vx * dtSec;
      comet.y += comet.vy * dtSec;
      comet.life -= dt;
    });
    state.background.comets = state.background.comets.filter(comet => comet.life > 0);

    // Collisions
    state.bullets.forEach(bullet => {
      state.enemies.forEach(enemy => {
        if (enemy.hp <= 0) return;
        const dx = bullet.x - enemy.x;
        const dy = bullet.y - enemy.y;
        if (Math.hypot(dx, dy) < 16) {
          enemy.hp -= 14;
          bullet.life = 0;
          spawnSparks(enemy.x, enemy.y, '255,200,160');
          if (enemy.hp <= 0) {
            state.kills += 1;
            spawnExplosion(enemy.x, enemy.y, enemy.type === 'ace' ? '255,120,255' : enemy.type === 'chaser' ? '255,110,110' : '255,170,80');
          }
        }
      });
    });

    state.enemyBullets.forEach(bullet => {
      const dx = bullet.x - player.x;
      const dy = bullet.y - player.y;
      if (Math.hypot(dx, dy) < 18) {
        applyDamage(11);
        spawnSparks(player.x, player.y, '120,200,255');
        bullet.life = 0;
      }
    });

    state.enemies = state.enemies.filter(e => e.hp > 0 && Math.hypot(e.x - camX, e.y - camY) < enemyCull);

    state.spawnTimer -= dt;
    if (state.waveSpawnsRemaining > 0 && state.spawnTimer <= 0 && state.enemies.length < SETTINGS.enemies.maxCount) {
      spawnEnemy();
      state.waveSpawnsRemaining -= 1;
      state.spawnTimer = state.spawnInterval * (0.75 + Math.random() * 0.5);
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

    if (player.hp <= 0) {
      state.running = false;
    }

    state.particles.forEach(p => {
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.life -= dt;
    });
    state.particles = state.particles.filter(p => p.life > 0);

    updateHud();
  }

  function normalizeAngle(angle) {
    while (angle > Math.PI) angle -= Math.PI * 2;
    while (angle < -Math.PI) angle += Math.PI * 2;
    return angle;
  }

  function wrap(entity) {
    if (entity.x < 0) entity.x += world.width;
    if (entity.x > world.width) entity.x -= world.width;
    if (entity.y < 0) entity.y += world.height;
    if (entity.y > world.height) entity.y -= world.height;
  }

  function drawBackground() {
    const tileW = state.background.tileW;
    const tileH = state.background.tileH;
    const camX = state.camera.x;
    const camY = state.camera.y;

    const baseGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    baseGradient.addColorStop(0, '#04060f');
    baseGradient.addColorStop(0.6, '#060a16');
    baseGradient.addColorStop(1, '#050814');
    ctx.fillStyle = baseGradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    state.background.nebulae.forEach(nebula => {
      const offsetX = wrapOffset(camX * 0.08, tileW);
      const offsetY = wrapOffset(camY * 0.08, tileH);
      let x = nebula.x - offsetX;
      let y = nebula.y - offsetY;
      if (x < -nebula.radius) x += tileW;
      if (y < -nebula.radius) y += tileH;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, nebula.radius);
      gradient.addColorStop(0, `rgba(${nebula.color},${nebula.alpha})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, nebula.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    state.background.stars.forEach(star => {
      const offsetX = wrapOffset(camX * star.speed, tileW);
      const offsetY = wrapOffset(camY * star.speed, tileH);
      let sx = star.x - offsetX;
      let sy = star.y - offsetY;
      if (sx < -star.size) sx += tileW;
      if (sy < -star.size) sy += tileH;
      ctx.fillStyle = `rgba(${star.color},${star.alpha})`;
      ctx.fillRect(sx, sy, star.size, star.size);
    });

    ctx.save();
    ctx.strokeStyle = 'rgba(200,230,255,0.6)';
    ctx.lineWidth = 1.4;
    state.background.comets.forEach(comet => {
      ctx.beginPath();
      ctx.moveTo(comet.x, comet.y);
      ctx.lineTo(comet.x - comet.vx * 0.06, comet.y - comet.vy * 0.06);
      ctx.stroke();
    });
    ctx.restore();

    const vignette = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      canvas.width * 0.2,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width * 0.7
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    // Draw player
    const player = state.player;
    const camX = state.camera.x;
    const camY = state.camera.y;
    const px = player.x;
    const py = player.y;
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(VIEW_SCALE, VIEW_SCALE);
    ctx.translate(-camX, -camY);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(player.angle);
    ctx.fillStyle = '#4af0ff';
    ctx.shadowColor = '#4af0ff';
    ctx.shadowBlur = 22;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, 10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, -10);
    ctx.closePath();
    ctx.fill();
    const forward = input.keys['ArrowUp'] || input.keys['KeyW'];
    const reverse = input.keys['ArrowDown'] || input.keys['KeyS'];
    if (forward || reverse) {
      ctx.fillStyle = forward ? 'rgba(71,245,255,0.85)' : 'rgba(120,200,255,0.8)';
      ctx.beginPath();
      ctx.moveTo(-16, 0);
      ctx.lineTo(-26, 6);
      ctx.lineTo(-26, -6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    if (player.shield > 10) {
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(90,200,255,0.55)';
      ctx.lineWidth = 2.2;
      ctx.arc(px, py, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    const hitGlow = 1 - Math.min(1, (performance.now() - player.lastHit) / 400);
    if (hitGlow > 0) {
      ctx.beginPath();
      ctx.strokeStyle = `rgba(255,120,120,${0.6 * hitGlow})`;
      ctx.lineWidth = 3;
      ctx.arc(px, py, 28, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Enemies
    state.enemies.forEach(enemy => {
      const ex = enemy.x;
      const ey = enemy.y;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(enemy.angle);
      const bodyColor = enemy.type === 'ace' ? '#ff7bff' : enemy.type === 'chaser' ? '#ff6b6b' : '#ffa94d';
      ctx.fillStyle = bodyColor;
      ctx.shadowColor = bodyColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-10, 8);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-10, -8);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(-16, 4);
      ctx.lineTo(-16, -4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // Bullets
    ctx.fillStyle = '#c6f6ff';
    state.bullets.forEach(b => {
      ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    });
    ctx.fillStyle = '#ffb37b';
    state.enemyBullets.forEach(b => {
      ctx.fillRect(b.x - 2, b.y - 2, 4, 4);
    });

    // Particles
    state.particles.forEach(p => {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = `rgba(${p.color},${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    if (!state.running) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
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
