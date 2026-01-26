(function () {
  const canvas = document.getElementById('duel-canvas');
  if (!canvas) {
    window.initDuel = function () {};
    window.stopDuel = function () {};
    return;
  }
  const ctx = canvas.getContext('2d');
  const controlsSelect = document.getElementById('duel-controls');
  const hudHp = document.getElementById('duel-hp');
  const hudShield = document.getElementById('duel-shield');
  const hudBoss = document.getElementById('duel-boss');
  const hudCooldown = document.getElementById('duel-cooldown');
  const hudPhase = document.getElementById('duel-phase');
  const startBtn = document.getElementById('duel-start');
  const pauseBtn = document.getElementById('duel-pause');
  const resetBtn = document.getElementById('duel-reset');

  const input = { keys: {}, mouse: { x: canvas.width / 2, y: canvas.height / 2, down: false } };

  const state = {
    running: false,
    lastTime: 0,
    bullets: [],
    enemyBullets: [],
    missiles: [],
    telegraph: null,
    player: {
      x: 160,
      y: canvas.height / 2,
      hp: 120,
      maxHp: 120,
      shield: 60,
      maxShield: 60,
      fireCooldown: 0,
      aimX: 1,
      aimY: 0,
      lastHit: 0
    },
    boss: {
      x: canvas.width - 160,
      y: canvas.height / 2,
      hp: 320,
      maxHp: 320,
      fireTimer: 800,
      missileTimer: 2800,
      beamTimer: 4200,
      phase: 1
    },
    counterCooldown: 0
  };

  function resetDuel() {
    state.running = false;
    state.lastTime = 0;
    state.bullets = [];
    state.enemyBullets = [];
    state.missiles = [];
    state.telegraph = null;
    state.player = {
      x: 160,
      y: canvas.height / 2,
      hp: 120,
      maxHp: 120,
      shield: 60,
      maxShield: 60,
      fireCooldown: 0,
      aimX: 1,
      aimY: 0,
      lastHit: 0
    };
    state.boss = {
      x: canvas.width - 160,
      y: canvas.height / 2,
      hp: 320,
      maxHp: 320,
      fireTimer: 800,
      missileTimer: 2800,
      beamTimer: 4200,
      phase: 1
    };
    state.counterCooldown = 0;
    updateHud();
    render();
  }

  function updateHud() {
    const bossPct = Math.max(0, Math.round((state.boss.hp / state.boss.maxHp) * 100));
    if (hudHp) hudHp.textContent = `HP: ${Math.max(0, Math.round(state.player.hp))}`;
    if (hudShield) hudShield.textContent = `Shield: ${Math.round(state.player.shield)}`;
    if (hudBoss) hudBoss.textContent = `Boss: ${bossPct}%`;
    if (hudCooldown) hudCooldown.textContent = state.counterCooldown <= 0 ? 'Counter: Ready' : `Counter: ${Math.ceil(state.counterCooldown / 1000)}s`;
    if (hudPhase) hudPhase.textContent = `Phase: ${state.boss.phase}`;
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

  function aimFromMouse() {
    const dx = input.mouse.x - state.player.x;
    const dy = input.mouse.y - state.player.y;
    const len = Math.hypot(dx, dy) || 1;
    state.player.aimX = dx / len;
    state.player.aimY = dy / len;
  }

  function firePlayer() {
    if (state.player.fireCooldown > 0) return;
    state.bullets.push({
      x: state.player.x + state.player.aimX * 22,
      y: state.player.y + state.player.aimY * 22,
      vx: state.player.aimX * 520,
      vy: state.player.aimY * 520,
      life: 900
    });
    state.player.fireCooldown = 120;
  }

  function enemyBurst() {
    const dx = state.player.x - state.boss.x;
    const dy = state.player.y - state.boss.y;
    const len = Math.hypot(dx, dy) || 1;
    const baseX = dx / len;
    const baseY = dy / len;
    const spread = 0.18;
    for (let i = -1; i <= 1; i++) {
      const angle = Math.atan2(baseY, baseX) + i * spread;
      state.enemyBullets.push({
        x: state.boss.x,
        y: state.boss.y,
        vx: Math.cos(angle) * 320,
        vy: Math.sin(angle) * 320,
        life: 1200
      });
    }
  }

  function spawnMissile() {
    state.missiles.push({
      x: state.boss.x - 20,
      y: state.boss.y,
      vx: -120,
      vy: 0,
      life: 3500,
      turn: 0.06
    });
  }

  function chargeBeam() {
    const angle = Math.atan2(state.player.y - state.boss.y, state.player.x - state.boss.x);
    state.telegraph = {
      angle,
      timer: 700,
      fire: 300,
      hit: false
    };
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

  function countermeasure() {
    if (state.counterCooldown > 0) return;
    state.missiles = [];
    state.enemyBullets = state.enemyBullets.filter(b => Math.random() > 0.5);
    state.counterCooldown = 8000;
  }

  function updateBossPhase() {
    const hpPct = state.boss.hp / state.boss.maxHp;
    if (hpPct < 0.35) state.boss.phase = 3;
    else if (hpPct < 0.65) state.boss.phase = 2;
    else state.boss.phase = 1;
  }

  function update(dt) {
    const player = state.player;
    const boss = state.boss;

    if (player.fireCooldown > 0) player.fireCooldown -= dt;
    if (state.counterCooldown > 0) state.counterCooldown -= dt;

    if (performance.now() - player.lastHit > 1600) {
      player.shield = Math.min(player.maxShield, player.shield + 18 * dt / 1000);
    }

    const controlMode = getControlMode();
    if (controlMode === 'mouse') {
      aimFromMouse();
    } else {
      aimFromKeyboard();
    }

    let dx = 0;
    let dy = 0;
    if (input.keys['KeyW']) dy -= 1;
    if (input.keys['KeyS']) dy += 1;
    if (input.keys['KeyA']) dx -= 1;
    if (input.keys['KeyD']) dx += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy) || 1;
      player.x += (dx / len) * 280 * dt / 1000;
      player.y += (dy / len) * 280 * dt / 1000;
    }

    player.x = Math.max(60, Math.min(canvas.width / 2 - 40, player.x));
    player.y = Math.max(40, Math.min(canvas.height - 40, player.y));

    if (input.mouse.down || input.keys['Space']) {
      firePlayer();
    }

    // Boss movement
    const targetY = player.y;
    boss.y += (targetY - boss.y) * 0.02;
    boss.y = Math.max(60, Math.min(canvas.height - 60, boss.y));

    boss.fireTimer -= dt;
    boss.missileTimer -= dt;
    boss.beamTimer -= dt;

    if (boss.fireTimer <= 0) {
      enemyBurst();
      boss.fireTimer = boss.phase === 3 ? 500 : boss.phase === 2 ? 650 : 800;
    }
    if (boss.missileTimer <= 0) {
      spawnMissile();
      boss.missileTimer = boss.phase === 3 ? 1800 : 2600;
    }
    if (boss.beamTimer <= 0) {
      chargeBeam();
      boss.beamTimer = boss.phase === 3 ? 2600 : 3600;
    }

    if (state.telegraph) {
      state.telegraph.timer -= dt;
      if (state.telegraph.timer <= 0) {
        state.telegraph.fire -= dt;
        const angle = state.telegraph.angle;
        if (!state.telegraph.hit) {
          const px = player.x - boss.x;
          const py = player.y - boss.y;
          const proj = px * Math.cos(angle) + py * Math.sin(angle);
          const perp = Math.abs(-px * Math.sin(angle) + py * Math.cos(angle));
          if (proj > 0 && perp < 18) {
            applyDamage(18);
          }
          state.telegraph.hit = true;
        }
        if (state.telegraph.fire <= 0) {
          state.telegraph = null;
        }
      }
    }

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

    state.missiles.forEach(m => {
      const dxm = player.x - m.x;
      const dym = player.y - m.y;
      const len = Math.hypot(dxm, dym) || 1;
      m.vx += (dxm / len) * m.turn * 100;
      m.vy += (dym / len) * m.turn * 100;
      const speed = Math.hypot(m.vx, m.vy);
      const cap = 240;
      if (speed > cap) {
        m.vx = (m.vx / speed) * cap;
        m.vy = (m.vy / speed) * cap;
      }
      m.x += m.vx * dt / 1000;
      m.y += m.vy * dt / 1000;
      m.life -= dt;
    });

    state.bullets.forEach(b => {
      const dxh = b.x - boss.x;
      const dyh = b.y - boss.y;
      if (Math.hypot(dxh, dyh) < 28) {
        boss.hp -= 8;
        b.life = 0;
      }
    });

    state.enemyBullets.forEach(b => {
      const dxh = b.x - player.x;
      const dyh = b.y - player.y;
      if (Math.hypot(dxh, dyh) < 18) {
        applyDamage(10);
        b.life = 0;
      }
    });

    state.missiles.forEach(m => {
      const dxh = m.x - player.x;
      const dyh = m.y - player.y;
      if (Math.hypot(dxh, dyh) < 20) {
        applyDamage(18);
        m.life = 0;
      }
    });

    state.bullets = state.bullets.filter(b => b.life > 0 && b.x > -80 && b.x < canvas.width + 80 && b.y > -80 && b.y < canvas.height + 80);
    state.enemyBullets = state.enemyBullets.filter(b => b.life > 0 && b.x > -80 && b.x < canvas.width + 80 && b.y > -80 && b.y < canvas.height + 80);
    state.missiles = state.missiles.filter(m => m.life > 0);

    updateBossPhase();

    if (player.hp <= 0 || boss.hp <= 0) {
      state.running = false;
    }

    updateHud();
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#101a2a');
    gradient.addColorStop(1, '#05070f');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Clouds
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 6; i++) {
      const y = (i * 90 + (state.lastTime / 30)) % canvas.height;
      ctx.fillRect(0, y, canvas.width, 24);
    }

    // Player
    ctx.save();
    ctx.translate(state.player.x, state.player.y);
    ctx.rotate(Math.atan2(state.player.aimY, state.player.aimX));
    ctx.fillStyle = '#4af0ff';
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#4af0ff';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-12, 10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-12, -10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (state.player.shield > 5) {
      ctx.strokeStyle = 'rgba(71,245,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(state.player.x, state.player.y, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Boss
    ctx.save();
    ctx.translate(state.boss.x, state.boss.y);
    ctx.rotate(Math.atan2(state.player.y - state.boss.y, state.player.x - state.boss.x));
    ctx.fillStyle = '#ff7a47';
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#ff7a47';
    ctx.beginPath();
    ctx.moveTo(26, 0);
    ctx.lineTo(-16, 14);
    ctx.lineTo(-8, 0);
    ctx.lineTo(-16, -14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Telegraph beam
    if (state.telegraph) {
      const angle = state.telegraph.angle;
      ctx.strokeStyle = state.telegraph.timer > 0 ? 'rgba(255,200,120,0.4)' : 'rgba(255,80,80,0.7)';
      ctx.lineWidth = state.telegraph.timer > 0 ? 4 : 8;
      ctx.beginPath();
      ctx.moveTo(state.boss.x, state.boss.y);
      ctx.lineTo(state.boss.x + Math.cos(angle) * canvas.width, state.boss.y + Math.sin(angle) * canvas.width);
      ctx.stroke();
    }

    ctx.fillStyle = '#e6f2ff';
    state.bullets.forEach(b => ctx.fillRect(b.x - 2, b.y - 2, 4, 4));
    ctx.fillStyle = '#ff9f7a';
    state.enemyBullets.forEach(b => ctx.fillRect(b.x - 2, b.y - 2, 4, 4));

    ctx.fillStyle = '#ffd166';
    state.missiles.forEach(m => {
      ctx.beginPath();
      ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
      ctx.fill();
    });

    if (!state.running) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
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
    if (window.__duelBound) return;
    window.__duelBound = true;
    document.addEventListener('keydown', (e) => {
      input.keys[e.code] = true;
      if (e.code === 'KeyE') countermeasure();
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
