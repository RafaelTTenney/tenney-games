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
  const hudCredits = document.getElementById('sky-credits');
  const hudShip = document.getElementById('sky-ship');
  const hudView = document.getElementById('sky-view');
  const startBtn = document.getElementById('sky-start');
  const pauseBtn = document.getElementById('sky-pause');
  const resetBtn = document.getElementById('sky-reset');
  const hangarBtn = document.getElementById('sky-hangar');
  const launchBtn = document.getElementById('sky-launch');
  const returnBtn = document.getElementById('sky-return');
  const cockpitBtn = document.getElementById('sky-cockpit');
  const gameView = document.getElementById('skygrid-game-view');
  const hangarView = document.getElementById('skygrid-hangar-view');
  const hangarCanvas = document.getElementById('sky-hangar-canvas');
  const hangarCtx = hangarCanvas ? hangarCanvas.getContext('2d') : null;
  const hangarCredits = document.getElementById('sky-hangar-credits');
  const hangarWave = document.getElementById('sky-hangar-wave');
  const shipName = document.getElementById('sky-ship-name');
  const shipDesc = document.getElementById('sky-ship-desc');
  const statDamage = document.getElementById('sky-stat-damage');
  const statFire = document.getElementById('sky-stat-fire');
  const statSpeed = document.getElementById('sky-stat-speed');
  const statTurn = document.getElementById('sky-stat-turn');
  const statShield = document.getElementById('sky-stat-shield');
  const statHull = document.getElementById('sky-stat-hull');
  const upgradeNote = document.getElementById('sky-upgrade-note');
  const upgradeButtons = Array.from(document.querySelectorAll('[data-upgrade]'));
  const shipButtons = Array.from(document.querySelectorAll('[data-ship]'));
  let upgradesBound = false;

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
  const SHIP_TIERS = [
    {
      name: 'Cadet',
      desc: 'Starter recon fighter.',
      color: '#4af0ff',
      thrust: 620,
      maxSpeed: 470,
      turnRate: 0.0058,
      fireCooldown: 100,
      damage: 11,
      maxShield: 70,
      maxHp: 100
    },
    {
      name: 'Interceptor',
      desc: 'Balanced assault frame.',
      color: '#7dfc9a',
      thrust: 720,
      maxSpeed: 530,
      turnRate: 0.0064,
      fireCooldown: 86,
      damage: 13,
      maxShield: 90,
      maxHp: 115
    },
    {
      name: 'Vanguard',
      desc: 'Heavy strike platform.',
      color: '#ffb347',
      thrust: 820,
      maxSpeed: 600,
      turnRate: 0.0069,
      fireCooldown: 76,
      damage: 15,
      maxShield: 110,
      maxHp: 130
    },
    {
      name: 'Specter',
      desc: 'Elite experimental chassis.',
      color: '#ff7bff',
      thrust: 900,
      maxSpeed: 640,
      turnRate: 0.0074,
      fireCooldown: 70,
      damage: 17,
      maxShield: 125,
      maxHp: 145
    }
  ];
  const UPGRADE_DEFS = {
    damage: { label: 'Weapon Damage', max: 6, baseCost: 140, costStep: 120, value: 2 },
    fireRate: { label: 'Fire Rate', max: 5, baseCost: 180, costStep: 150, value: 1 },
    projectile: { label: 'Projectile Speed', max: 4, baseCost: 150, costStep: 130, value: 1 },
    engine: { label: 'Engine Thrust', max: 5, baseCost: 160, costStep: 130, value: 1 },
    maneuver: { label: 'Maneuvering', max: 4, baseCost: 150, costStep: 120, value: 1 },
    shield: { label: 'Shield Capacity', max: 5, baseCost: 150, costStep: 120, value: 1 },
    regen: { label: 'Shield Regen', max: 4, baseCost: 170, costStep: 140, value: 1 },
    hull: { label: 'Hull Plating', max: 4, baseCost: 160, costStep: 140, value: 1 }
  };
  const SHIP_UPGRADES = [
    { tier: 1, wave: 3, cost: 420 },
    { tier: 2, wave: 5, cost: 780 },
    { tier: 3, wave: 7, cost: 1200 }
  ];

  const state = {
    running: false,
    lastTime: 0,
    kills: 0,
    wave: 1,
    spawnTimer: 0,
    spawnInterval: 0,
    waveSpawnsRemaining: 0,
    completed: false,
    credits: 0,
    shipTier: 0,
    upgrades: {
      damage: 0,
      fireRate: 0,
      projectile: 0,
      engine: 0,
      maneuver: 0,
      shield: 0,
      regen: 0,
      hull: 0
    },
    pendingWave: null,
    mode: 'combat',
    view: 'combat',
    viewMode: 'external',
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

  const hangarScene = {
    running: false,
    lastTime: 0,
    t: 0,
    drones: []
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

  function getUpgradeCost(id) {
    const def = UPGRADE_DEFS[id];
    if (!def) return Infinity;
    const level = state.upgrades[id] || 0;
    return def.baseCost + def.costStep * level;
  }

  function getShipTier() {
    return SHIP_TIERS[state.shipTier] || SHIP_TIERS[0];
  }

  function getPlayerStats() {
    const base = getShipTier();
    const stats = {
      thrust: base.thrust,
      maxSpeed: base.maxSpeed,
      turnRate: base.turnRate,
      fireCooldown: base.fireCooldown,
      damage: base.damage,
      bulletSpeed: SETTINGS.bullets.speed,
      maxShield: base.maxShield,
      maxHp: base.maxHp,
      shieldRegenRate: SETTINGS.shieldRegenRate,
      shieldRegenDelay: SETTINGS.shieldRegenDelay,
      color: base.color
    };

    const dmgLevel = state.upgrades.damage || 0;
    const fireLevel = state.upgrades.fireRate || 0;
    const projectileLevel = state.upgrades.projectile || 0;
    const engineLevel = state.upgrades.engine || 0;
    const maneuverLevel = state.upgrades.maneuver || 0;
    const shieldLevel = state.upgrades.shield || 0;
    const regenLevel = state.upgrades.regen || 0;
    const hullLevel = state.upgrades.hull || 0;

    stats.damage += dmgLevel * UPGRADE_DEFS.damage.value;
    stats.fireCooldown = Math.max(42, stats.fireCooldown - fireLevel * 8);
    stats.bulletSpeed += projectileLevel * 60;
    stats.thrust += engineLevel * 70;
    stats.maxSpeed += engineLevel * 45;
    stats.turnRate += maneuverLevel * 0.00045;
    stats.maxShield += shieldLevel * 14;
    stats.shieldRegenRate += regenLevel * 3;
    stats.shieldRegenDelay = Math.max(520, stats.shieldRegenDelay - regenLevel * 50);
    stats.maxHp += hullLevel * 12;
    return stats;
  }

  function syncPlayerStats() {
    const stats = getPlayerStats();
    const player = state.player;
    player.maxShield = stats.maxShield;
    if (player.shield > player.maxShield) player.shield = player.maxShield;
    player.maxHp = stats.maxHp;
    if (player.hp > player.maxHp) player.hp = player.maxHp;
    state.playerStats = stats;
  }

  function addCredits(amount) {
    state.credits += amount;
  }

  function getViewScale() {
    return state.viewMode === 'cockpit' ? VIEW_SCALE * 0.92 : VIEW_SCALE;
  }

  function setView(view) {
    state.view = view;
    if (gameView) gameView.classList.toggle('active', view === 'combat');
    if (hangarView) hangarView.classList.toggle('active', view === 'hangar');
    if (view === 'hangar') {
      startHangarAnim();
      renderHangar();
    } else {
      stopHangarAnim();
    }
  }

  function openHangar(nextWave) {
    state.mode = 'hangar';
    state.pendingWave = nextWave;
    state.running = false;
    state.lastTime = 0;
    setView('hangar');
    updateHud();
    render();
  }

  function toggleViewMode() {
    state.viewMode = state.viewMode === 'cockpit' ? 'external' : 'cockpit';
    if (cockpitBtn) {
      cockpitBtn.textContent = state.viewMode === 'cockpit' ? 'External View' : 'Cockpit View';
    }
    updateHud();
    render();
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

  function initHangarScene() {
    if (!hangarCtx) return;
    hangarScene.t = 0;
    hangarScene.drones = [];
    for (let i = 0; i < 6; i++) {
      hangarScene.drones.push({
        angle: rand(0, Math.PI * 2),
        radius: rand(40, 120),
        speed: rand(0.35, 0.9),
        size: rand(2.2, 4.2),
        phase: rand(0, Math.PI * 2)
      });
    }
    renderHangar();
  }

  function startHangarAnim() {
    if (!hangarCtx || hangarScene.running) return;
    hangarScene.running = true;
    hangarScene.lastTime = performance.now();
    requestAnimationFrame(hangarLoop);
  }

  function stopHangarAnim() {
    hangarScene.running = false;
  }

  function hangarLoop(timestamp) {
    if (!hangarScene.running) return;
    const dt = Math.min(40, timestamp - hangarScene.lastTime);
    hangarScene.lastTime = timestamp;
    updateHangar(dt);
    renderHangar();
    requestAnimationFrame(hangarLoop);
  }

  function updateHangar(dt) {
    hangarScene.t += dt / 1000;
  }

  function drawHangarGrid(ctx, w, h, t) {
    ctx.save();
    ctx.translate(w / 2, h * 0.6);
    ctx.strokeStyle = 'rgba(110,200,255,0.12)';
    ctx.lineWidth = 1;
    const depth = h * 0.4;
    for (let i = -9; i <= 9; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 26, 0);
      ctx.lineTo(i * 95, depth);
      ctx.stroke();
    }
    const offset = (t * 26) % 22;
    for (let y = 0; y < depth; y += 22) {
      const yy = y + offset;
      ctx.beginPath();
      ctx.moveTo(-w, yy);
      ctx.lineTo(w, yy);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHangarShip(ctx, x, y, t) {
    const bob = Math.sin(t * 1.6) * 5;
    const tilt = Math.sin(t * 0.7) * 0.08;
    const shipColor = (state.playerStats && state.playerStats.color) || getShipTier().color;
    ctx.save();
    ctx.translate(x, y + bob);
    ctx.rotate(tilt);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 28, 70, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = shipColor;
    ctx.shadowBlur = 18;
    ctx.fillStyle = shipColor;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(46, 10);
    ctx.lineTo(12, 18);
    ctx.lineTo(-12, 18);
    ctx.lineTo(-46, 10);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillRect(-6, -8, 12, 26);
    const glow = 0.6 + Math.sin(t * 4.2) * 0.2;
    ctx.fillStyle = `rgba(71,245,255,${glow})`;
    ctx.beginPath();
    ctx.moveTo(-18, 20);
    ctx.lineTo(-32, 32);
    ctx.lineTo(-8, 28);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(18, 20);
    ctx.lineTo(32, 32);
    ctx.lineTo(8, 28);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function renderHangar() {
    if (!hangarCtx) return;
    const w = hangarCanvas.width;
    const h = hangarCanvas.height;
    const t = hangarScene.t;

    const bg = hangarCtx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0b1220');
    bg.addColorStop(0.55, '#0a111d');
    bg.addColorStop(1, '#05090f');
    hangarCtx.fillStyle = bg;
    hangarCtx.fillRect(0, 0, w, h);

    const beamX = ((t * 42) % (w + 220)) - 220;
    hangarCtx.fillStyle = 'rgba(71,245,255,0.12)';
    hangarCtx.fillRect(beamX, 0, 160, h * 0.5);
    hangarCtx.fillStyle = 'rgba(255,122,71,0.08)';
    hangarCtx.fillRect(w - beamX - 140, 0, 120, h * 0.4);

    drawHangarGrid(hangarCtx, w, h, t);

    hangarCtx.strokeStyle = 'rgba(71,245,255,0.25)';
    hangarCtx.lineWidth = 2;
    hangarCtx.beginPath();
    hangarCtx.arc(w / 2, h * 0.6, 90, 0, Math.PI * 2);
    hangarCtx.stroke();
    hangarCtx.beginPath();
    hangarCtx.arc(w / 2, h * 0.6, 54, 0, Math.PI * 2);
    hangarCtx.stroke();

    drawHangarShip(hangarCtx, w / 2, h * 0.42, t);

    hangarScene.drones.forEach((drone, idx) => {
      const angle = drone.angle + t * drone.speed;
      const radius = drone.radius + Math.sin(t * 0.9 + drone.phase) * 6;
      const dx = Math.cos(angle) * radius;
      const dy = Math.sin(angle) * radius * 0.35;
      const x = w / 2 + dx;
      const y = h * 0.32 + dy;
      const pulse = 0.4 + Math.sin(t * 3 + idx) * 0.2;
      hangarCtx.fillStyle = `rgba(125,252,154,${pulse})`;
      hangarCtx.beginPath();
      hangarCtx.arc(x, y, drone.size, 0, Math.PI * 2);
      hangarCtx.fill();
      hangarCtx.strokeStyle = 'rgba(125,252,154,0.2)';
      hangarCtx.beginPath();
      hangarCtx.moveTo(x, y);
      hangarCtx.lineTo(x - dx * 0.2, y - dy * 0.2);
      hangarCtx.stroke();
    });

    hangarCtx.strokeStyle = 'rgba(255,255,255,0.08)';
    hangarCtx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const y = h * (0.18 + i * 0.08) + Math.sin(t * 0.6 + i) * 2;
      hangarCtx.beginPath();
      hangarCtx.moveTo(w * 0.1, y);
      hangarCtx.lineTo(w * 0.9, y);
      hangarCtx.stroke();
    }
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
    state.credits = 0;
    state.shipTier = 0;
    state.upgrades = {
      damage: 0,
      fireRate: 0,
      projectile: 0,
      engine: 0,
      maneuver: 0,
      shield: 0,
      regen: 0,
      hull: 0
    };
    state.pendingWave = null;
    state.mode = 'combat';
    state.view = 'combat';
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
      hp: SHIP_TIERS[0].maxHp,
      maxHp: SHIP_TIERS[0].maxHp,
      shield: SHIP_TIERS[0].maxShield,
      maxShield: SHIP_TIERS[0].maxShield,
      lastHit: 0,
      fireCooldown: 0,
      angle: -Math.PI / 2
    };
    syncPlayerStats();
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    setView('combat');
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
    state.mode = 'combat';
  }

  function updateHud() {
    if (hudHp) hudHp.textContent = `HP: ${Math.max(0, Math.round(state.player.hp))}`;
    if (hudShield) hudShield.textContent = `Shield: ${Math.round(state.player.shield)}`;
    const speed = Math.hypot(state.player.vx, state.player.vy);
    if (hudBoost) hudBoost.textContent = `Speed: ${Math.round(speed)}`;
    if (hudKills) hudKills.textContent = `Kills: ${state.kills}`;
    if (hudWave) hudWave.textContent = `Wave: ${Math.min(state.wave, MAX_WAVES)}/${MAX_WAVES}`;
    if (hudCredits) hudCredits.textContent = `Credits: ${state.credits}`;
    if (hudShip) hudShip.textContent = `Ship: ${getShipTier().name}`;
    if (hudView) hudView.textContent = `View: ${state.viewMode === 'cockpit' ? 'Cockpit' : 'External'}`;
    if (cockpitBtn) cockpitBtn.textContent = state.viewMode === 'cockpit' ? 'External View' : 'Cockpit View';
    if (hangarCredits) hangarCredits.textContent = `${state.credits}`;
    if (hangarWave) {
      const waveDisplay = state.pendingWave || state.wave;
      hangarWave.textContent = `${Math.min(waveDisplay, MAX_WAVES)}/${MAX_WAVES}`;
    }
    if (shipName) shipName.textContent = getShipTier().name;
    if (shipDesc) shipDesc.textContent = getShipTier().desc || '';
    const stats = getPlayerStats();
    if (statDamage) statDamage.textContent = `${stats.damage}`;
    if (statFire) statFire.textContent = `${Math.round(stats.fireCooldown)} ms`;
    if (statSpeed) statSpeed.textContent = `${Math.round(stats.maxSpeed)}`;
    if (statTurn) statTurn.textContent = `${stats.turnRate.toFixed(4)}`;
    if (statShield) statShield.textContent = `${Math.round(stats.maxShield)} • +${Math.round(stats.shieldRegenRate)}/s`;
    if (statHull) statHull.textContent = `${Math.round(stats.maxHp)}`;
    if (startBtn) {
      if (state.completed) {
        startBtn.textContent = 'Complete';
      } else if (state.mode === 'hangar' && state.pendingWave) {
        startBtn.textContent = `Launch Wave ${state.pendingWave}`;
      } else if (!state.running) {
        startBtn.textContent = 'Start';
      } else {
        startBtn.textContent = 'Running';
      }
    }
    updateUpgradeUI();
  }

  function getFireMode() {
    return controlsSelect ? controlsSelect.value : 'space';
  }

  function fireBullet() {
    if (state.player.fireCooldown > 0) return;
    const stats = getPlayerStats();
    const speed = stats.bulletSpeed || SETTINGS.bullets.speed;
    state.bullets.push({
      x: state.player.x + Math.cos(state.player.angle) * 18,
      y: state.player.y + Math.sin(state.player.angle) * 18,
      vx: Math.cos(state.player.angle) * speed,
      vy: Math.sin(state.player.angle) * speed,
      life: SETTINGS.bullets.life,
      damage: stats.damage
    });
    state.player.fireCooldown = stats.fireCooldown;
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

  function updateUpgradeUI() {
    if (!upgradeButtons.length && !shipButtons.length) return;
    const canShop = !state.running && state.mode === 'hangar' && !state.completed && state.player.hp > 0;
    upgradeButtons.forEach(btn => {
      const id = btn.dataset.upgrade;
      const def = UPGRADE_DEFS[id];
      if (!def) return;
      const level = state.upgrades[id] || 0;
      const cost = getUpgradeCost(id);
      const maxed = level >= def.max;
      btn.textContent = `${def.label} ${level}/${def.max} • ${maxed ? 'MAX' : cost + 'c'}`;
      btn.disabled = !canShop || maxed || state.credits < cost;
    });
    shipButtons.forEach(btn => {
      const tier = parseInt(btn.dataset.ship || '0', 10);
      const shipInfo = SHIP_TIERS[tier];
      const rule = SHIP_UPGRADES.find(item => item.tier === tier);
      if (!shipInfo || !rule) return;
      const owned = state.shipTier >= tier;
      const eligible = state.wave >= rule.wave;
      const label = `${shipInfo.name} • Wave ${rule.wave} • ${rule.cost}c`;
      btn.textContent = owned ? `${shipInfo.name} • Owned` : label;
      btn.disabled = !canShop || owned || !eligible || state.credits < rule.cost;
    });
    if (upgradeNote) {
      if (state.mode === 'hangar') {
        upgradeNote.textContent = state.completed
          ? 'Mission complete.'
          : 'Hangar open. Spend credits, then launch the next wave.';
      } else if (state.view === 'hangar') {
        upgradeNote.textContent = 'Hangar locked during combat. Finish the wave to upgrade.';
      } else {
        upgradeNote.textContent = 'Upgrades unlock between waves.';
      }
    }
    if (launchBtn) {
      if (state.mode === 'hangar' && state.pendingWave) {
        launchBtn.textContent = `Launch Wave ${state.pendingWave}`;
        launchBtn.disabled = state.completed;
      } else if (state.completed) {
        launchBtn.textContent = 'Mission Complete';
        launchBtn.disabled = true;
      } else {
        launchBtn.textContent = 'Return';
        launchBtn.disabled = false;
      }
    }
  }

  function purchaseUpgrade(id) {
    const def = UPGRADE_DEFS[id];
    if (!def) return;
    const level = state.upgrades[id] || 0;
    if (level >= def.max) return;
    const cost = getUpgradeCost(id);
    if (state.credits < cost) return;
    state.credits -= cost;
    state.upgrades[id] = level + 1;
    syncPlayerStats();
    updateHud();
  }

  function purchaseShip(tier) {
    const rule = SHIP_UPGRADES.find(item => item.tier === tier);
    if (!rule) return;
    if (state.shipTier >= tier) return;
    if (state.credits < rule.cost) return;
    if (state.wave < rule.wave) return;
    state.credits -= rule.cost;
    state.shipTier = tier;
    syncPlayerStats();
    state.player.hp = state.player.maxHp;
    state.player.shield = state.player.maxShield;
    updateHud();
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
    const stats = getPlayerStats();
    const rotSpeed = stats.turnRate;
    const thrust = stats.thrust;
    const reverseThrust = SETTINGS.player.reverseThrust;
    const maxSpeed = stats.maxSpeed;
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

    if (performance.now() - player.lastHit > stats.shieldRegenDelay) {
      player.shield = Math.min(player.maxShield, player.shield + stats.shieldRegenRate * dt / 1000);
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
    const viewRadius = Math.max(canvas.width, canvas.height) / getViewScale();
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
          enemy.hp -= bullet.damage || 14;
          bullet.life = 0;
          spawnSparks(enemy.x, enemy.y, '255,200,160');
          if (enemy.hp <= 0) {
            state.kills += 1;
            const bountyBase = enemy.type === 'ace' ? 110 : enemy.type === 'strafer' ? 80 : 60;
            addCredits(Math.round(bountyBase * (1 + state.wave * 0.1)));
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
        state.mode = 'hangar';
      } else {
        const bonus = 220 + state.wave * 90;
        addCredits(bonus);
        openHangar(state.wave + 1);
      }
    }

    if (player.hp <= 0) {
      state.running = false;
    }

    syncPlayerStats();
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
    const viewScale = getViewScale();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(viewScale, viewScale);
    ctx.translate(-camX, -camY);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(player.angle);
    const shipColor = (state.playerStats && state.playerStats.color) || getShipTier().color;
    ctx.fillStyle = shipColor;
    ctx.shadowColor = shipColor;
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

    if (state.viewMode === 'cockpit') {
      drawCockpitOverlay();
    }

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
          : state.mode === 'hangar'
            ? 'Hangar Open - Upgrade and Launch'
            : 'Paused';
      ctx.fillText(label, canvas.width / 2, canvas.height / 2);
    }
  }

  function drawMfd(x, y, w, h, title, lines, accent) {
    const panelGrad = ctx.createLinearGradient(x, y, x, y + h);
    panelGrad.addColorStop(0, 'rgba(8,16,28,0.95)');
    panelGrad.addColorStop(1, 'rgba(5,8,14,0.98)');
    ctx.fillStyle = panelGrad;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent || 'rgba(71,245,255,0.45)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = accent || 'rgba(125,252,154,0.9)';
    ctx.font = '11px monospace';
    ctx.fillText(title, x + 10, y + 16);
    ctx.fillStyle = '#e6f2ff';
    lines.forEach((line, idx) => {
      ctx.fillText(line, x + 10, y + 34 + idx * 16);
    });
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 5; i++) {
      const yy = y + 28 + i * 16;
      ctx.beginPath();
      ctx.moveTo(x + 8, yy);
      ctx.lineTo(x + w - 8, yy);
      ctx.stroke();
    }
  }

  function drawRadar(cx, cy, r, t) {
    ctx.save();
    ctx.strokeStyle = 'rgba(125,252,154,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.stroke();

    const range = 520;
    let nearest = null;
    let nearestDist = Infinity;
    state.enemies.forEach(enemy => {
      const dx = enemy.x - state.player.x;
      const dy = enemy.y - state.player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = enemy;
      }
      if (dist > range) return;
      const px = cx + (dx / range) * r;
      const py = cy + (dy / range) * r;
      ctx.fillStyle = enemy.type === 'ace' ? '#ff7bff' : enemy.type === 'strafer' ? '#ffa94d' : '#ff6b6b';
      ctx.beginPath();
      ctx.arc(px, py, 2.4, 0, Math.PI * 2);
      ctx.fill();
    });

    if (nearest && nearestDist < range) {
      const dx = nearest.x - state.player.x;
      const dy = nearest.y - state.player.y;
      const px = cx + (dx / range) * r;
      const py = cy + (dy / range) * r;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = '#7dfc9a';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    const sweep = (t || performance.now() / 1000) * 0.9;
    ctx.strokeStyle = 'rgba(125,252,154,0.5)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweep) * r, cy + Math.sin(sweep) * r);
    ctx.stroke();
    ctx.fillStyle = 'rgba(125,252,154,0.08)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, sweep - 0.25, sweep + 0.25);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCockpitOverlay() {
    const w = canvas.width;
    const h = canvas.height;
    const stats = getPlayerStats();
    const speed = Math.hypot(state.player.vx, state.player.vy);
    const speedRatio = clamp(speed / Math.max(1, stats.maxSpeed), 0, 1);
    const hpRatio = clamp(state.player.hp / Math.max(1, state.player.maxHp), 0, 1);
    const shieldRatio = clamp(state.player.shield / Math.max(1, state.player.maxShield), 0, 1);
    const t = performance.now() / 1000;
    const forwardX = Math.cos(state.player.angle);
    const forwardY = Math.sin(state.player.angle);
    const rightX = -Math.sin(state.player.angle);
    const rightY = Math.cos(state.player.angle);
    const vForward = state.player.vx * forwardX + state.player.vy * forwardY;
    const vRight = state.player.vx * rightX + state.player.vy * rightY;
    const driftX = clamp(vRight / Math.max(1, stats.maxSpeed), -1, 1) * 14;
    const driftY = clamp(-vForward / Math.max(1, stats.maxSpeed), -1, 1) * 10;

    const winTop = h * 0.05 + driftY * 0.15;
    const winBottom = h * 0.7 + driftY * 0.22;
    const topW = w * 0.56;
    const bottomW = w * 0.9;
    const cx = w / 2 + driftX * 0.25;
    const windowPoly = [
      { x: cx - topW / 2, y: winTop },
      { x: cx + topW / 2, y: winTop },
      { x: cx + bottomW / 2, y: winBottom },
      { x: cx - bottomW / 2, y: winBottom }
    ];

    function tracePoly(poly) {
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.22, w / 2, h / 2, w * 0.78);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(3,7,12,0.7)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(6,12,20,0.8)';
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
    tracePoly(windowPoly);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.save();
    tracePoly(windowPoly);
    ctx.clip();
    const glass = ctx.createLinearGradient(0, winTop, 0, winBottom);
    glass.addColorStop(0, 'rgba(130,220,255,0.06)');
    glass.addColorStop(0.5, 'rgba(60,120,180,0.04)');
    glass.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glass;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(125,252,154,0.18)';
    ctx.lineWidth = 1;
    const gridLines = 4;
    for (let i = 1; i <= gridLines; i++) {
      const y = winTop + (winBottom - winTop) * (i / (gridLines + 1)) + Math.sin(t * 0.6 + i) * 1.1;
      ctx.beginPath();
      ctx.moveTo(windowPoly[0].x + 18, y);
      ctx.lineTo(windowPoly[1].x - 18, y);
      ctx.stroke();
    }
    const sweepX = (t * 120) % w;
    ctx.strokeStyle = 'rgba(125,252,154,0.25)';
    ctx.beginPath();
    ctx.moveTo(sweepX, winTop);
    ctx.lineTo(sweepX + 30, winBottom);
    ctx.stroke();
    ctx.restore();

    ctx.strokeStyle = 'rgba(71,245,255,0.32)';
    ctx.lineWidth = 6;
    tracePoly(windowPoly);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 2;
    tracePoly(windowPoly);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, winTop + 4);
    ctx.lineTo(cx, winBottom - 8);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(windowPoly[0].x + 26, winTop + 8);
    ctx.lineTo(cx - 40, winBottom - 18);
    ctx.moveTo(windowPoly[1].x - 26, winTop + 8);
    ctx.lineTo(cx + 40, winBottom - 18);
    ctx.stroke();

    ctx.fillStyle = 'rgba(6,12,20,0.9)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.16, 0);
    ctx.lineTo(w * 0.3, h * 0.66);
    ctx.lineTo(w * 0.22, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w * 0.84, 0);
    ctx.lineTo(w * 0.7, h * 0.66);
    ctx.lineTo(w * 0.78, h);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(0, 0, w, h * 0.08);
    ctx.fillRect(0, h * 0.72, w, h * 0.28);

    ctx.strokeStyle = 'rgba(71,245,255,0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(w * 0.16, h * 0.08);
    ctx.lineTo(w * 0.3, h * 0.66);
    ctx.lineTo(w * 0.7, h * 0.66);
    ctx.lineTo(w * 0.84, h * 0.08);
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < 8; i++) {
      const boltX = windowPoly[0].x + (i / 7) * (windowPoly[1].x - windowPoly[0].x);
      ctx.beginPath();
      ctx.arc(boltX, winTop - 4, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    const hudX = w / 2 + driftX * 0.4;
    const hudY = h * 0.42 + driftY * 0.5;
    ctx.strokeStyle = 'rgba(125,252,154,0.75)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(hudX, hudY, 36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hudX - 52, hudY);
    ctx.lineTo(hudX - 18, hudY);
    ctx.moveTo(hudX + 18, hudY);
    ctx.lineTo(hudX + 52, hudY);
    ctx.moveTo(hudX, hudY - 52);
    ctx.lineTo(hudX, hudY - 18);
    ctx.moveTo(hudX, hudY + 18);
    ctx.lineTo(hudX, hudY + 52);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(125,252,154,0.2)';
    ctx.beginPath();
    ctx.arc(hudX, hudY, 70, 0, Math.PI * 2);
    ctx.stroke();

    const heading = (Math.atan2(forwardY, forwardX) * 180 / Math.PI + 360) % 360;
    ctx.fillStyle = 'rgba(125,252,154,0.9)';
    ctx.font = '12px monospace';
    ctx.fillText(`HDG ${heading.toFixed(0)}`, w * 0.45, h * 0.06);
    ctx.fillText(`WAVE ${Math.min(state.wave, MAX_WAVES)}`, w * 0.58, h * 0.06);

    drawMfd(28, h * 0.76 + 14, 240, 120, 'ENGINE', [
      `SPD ${Math.round(speed)}`,
      `THR ${Math.round(speedRatio * 100)}%`,
      `TEMP ${(30 + speedRatio * 55).toFixed(0)}C`,
      `BOOST ${stats.maxSpeed}`
    ], 'rgba(125,252,154,0.6)');
    drawMfd(w - 268, h * 0.76 + 14, 240, 120, 'WEAPON', [
      `DMG ${stats.damage}`,
      `COOLD ${Math.round(stats.fireCooldown)}ms`,
      `AMMO INF`,
      `KILLS ${state.kills}`
    ], 'rgba(255,170,90,0.6)');

    const throttleX = w * 0.5 - 7;
    const throttleY = h * 0.76 + 26;
    const throttleH = 100;
    ctx.fillStyle = 'rgba(10,18,30,0.95)';
    ctx.fillRect(throttleX, throttleY, 14, throttleH);
    ctx.fillStyle = 'rgba(71,245,255,0.85)';
    ctx.fillRect(throttleX, throttleY + throttleH * (1 - speedRatio), 14, throttleH * speedRatio);
    ctx.strokeStyle = 'rgba(71,245,255,0.45)';
    ctx.strokeRect(throttleX, throttleY, 14, throttleH);

    const barY = h * 0.72;
    ctx.fillStyle = 'rgba(10,18,30,0.95)';
    ctx.fillRect(w * 0.3, barY, w * 0.4, 8);
    ctx.fillStyle = 'rgba(125,252,154,0.85)';
    ctx.fillRect(w * 0.3, barY, w * 0.4 * shieldRatio, 8);
    ctx.strokeStyle = 'rgba(125,252,154,0.45)';
    ctx.strokeRect(w * 0.3, barY, w * 0.4, 8);

    const hpY = h * 0.7;
    ctx.fillStyle = 'rgba(10,18,30,0.95)';
    ctx.fillRect(w * 0.3, hpY, w * 0.4, 8);
    ctx.fillStyle = 'rgba(255,122,71,0.9)';
    ctx.fillRect(w * 0.3, hpY, w * 0.4 * hpRatio, 8);
    ctx.strokeStyle = 'rgba(255,122,71,0.45)';
    ctx.strokeRect(w * 0.3, hpY, w * 0.4, 8);

    ctx.fillStyle = 'rgba(125,252,154,0.9)';
    ctx.font = '11px monospace';
    ctx.fillText(`SHIELD ${Math.round(state.player.shield)}`, w * 0.3, barY - 6);
    ctx.fillText(`HULL ${Math.round(state.player.hp)}`, w * 0.3, hpY - 6);

    drawRadar(w / 2, h * 0.78 + 62, 56, t);

    if (hpRatio < 0.3) {
      const pulse = 0.3 + Math.sin(t * 6) * 0.25;
      ctx.strokeStyle = `rgba(255,80,80,${pulse})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(8, 8, w - 16, h - 16);
    }

    ctx.restore();
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
    if (state.completed) return;
    if (state.mode === 'hangar' && state.pendingWave) {
      state.wave = state.pendingWave;
      state.pendingWave = null;
      spawnWave();
    }
    setView('combat');
    state.running = true;
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function pause() {
    state.running = false;
    if (state.mode !== 'hangar') state.mode = 'paused';
    stopHangarAnim();
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
    if (!upgradesBound) {
      upgradeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.upgrade;
          if (id) purchaseUpgrade(id);
        });
      });
      shipButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          const tier = parseInt(btn.dataset.ship || '0', 10);
          if (!Number.isNaN(tier)) purchaseShip(tier);
        });
      });
      if (hangarBtn) {
        hangarBtn.addEventListener('click', () => {
          if (state.running) pause();
          setView('hangar');
          updateHud();
        });
      }
      if (cockpitBtn) {
        cockpitBtn.addEventListener('click', () => {
          toggleViewMode();
        });
      }
      if (returnBtn) {
        returnBtn.addEventListener('click', () => {
          setView('combat');
          updateHud();
        });
      }
      if (launchBtn) {
        launchBtn.addEventListener('click', () => {
          if (state.mode === 'hangar' && state.pendingWave) {
            start();
          } else {
            setView('combat');
          }
        });
      }
      upgradesBound = true;
    }
    resetSkygrid();
    initHangarScene();
  }

  startBtn?.addEventListener('click', start);
  pauseBtn?.addEventListener('click', pause);
  resetBtn?.addEventListener('click', resetSkygrid);

  window.initSkygrid = initSkygrid;
  window.stopSkygrid = pause;
})();
