import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';

(function () {
  const canvas = document.getElementById('duel-canvas');
  if (!canvas) {
    window.initDuel = function () {};
    window.stopDuel = function () {};
    return;
  }

  const controlsSelect = document.getElementById('duel-controls');
  const hudHp = document.getElementById('duel-hp');
  const hudShield = document.getElementById('duel-shield');
  const hudBoss = document.getElementById('duel-boss');
  const hudCooldown = document.getElementById('duel-cooldown');
  const hudPhase = document.getElementById('duel-phase');
  const startBtn = document.getElementById('duel-start');
  const pauseBtn = document.getElementById('duel-pause');
  const resetBtn = document.getElementById('duel-reset');

  const input = { keys: {} };

  const SETTINGS = {
    player: {
      thrust: 26,
      reverseThrust: 14,
      turnRate: 1.15,
      pitchRate: 1.05,
      rollRate: 1.6,
      maxSpeed: 80,
      drag: 0.985,
      fireCooldown: 0.14
    },
    bullets: {
      speed: 180,
      life: 2.8
    },
    enemies: {
      baseCount: 3,
      maxCount: 11,
      thrust: 16,
      thrustVar: 10,
      maxSpeed: 46,
      maxSpeedVar: 14,
      fireBase: 1.4,
      fireVar: 0.8,
      bulletSpeed: 120
    },
    shieldRegenDelay: 0.9,
    shieldRegenRate: 20,
    lookAhead: 42,
    starField: 1600,
    intermission: 2.1
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
    intermission: 0,
    completed: false,
    bullets: [],
    enemyBullets: [],
    enemies: [],
    stars: [],
    player: {
      position: new THREE.Vector3(0, 0, 0),
      velocity: new THREE.Vector3(0, 0, 0),
      yaw: 0,
      pitch: 0,
      roll: 0,
      hp: 120,
      maxHp: 120,
      shield: 90,
      maxShield: 90,
      lastHit: 0,
      fireCooldown: 0
    }
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);
  scene.fog = new THREE.Fog(0x05070d, 200, 2800);

  const camera = new THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.1, 5000);

  const playerGroup = new THREE.Group();
  scene.add(playerGroup);
  playerGroup.add(camera);
  camera.position.set(0, 1.35, 2.8);

  const cockpit = buildCockpit();
  playerGroup.add(cockpit.group);

  const ambient = new THREE.AmbientLight(0x7dafff, 0.35);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.7);
  rimLight.position.set(4, 6, 8);
  const glowLight = new THREE.PointLight(0x5ceaff, 0.6, 20);
  glowLight.position.set(0, 1.2, -3);
  scene.add(ambient, rimLight, glowLight);

  const stars = buildStarfield();
  scene.add(stars);

  const reticle = buildReticle();
  camera.add(reticle);

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function getAssistMode() {
    return controlsSelect ? controlsSelect.value : 'assist';
  }

  function updateHud() {
    if (hudHp) hudHp.textContent = `Hull: ${Math.max(0, Math.round(state.player.hp))}`;
    if (hudShield) hudShield.textContent = `Shield: ${Math.round(state.player.shield)}`;
    if (hudBoss) hudBoss.textContent = `Kills: ${state.kills}`;
    if (hudCooldown) {
      hudCooldown.textContent = state.intermission > 0
        ? `Next Wave: ${Math.ceil(state.intermission)}s`
        : `Enemies: ${state.enemies.length}`;
    }
    if (hudPhase) hudPhase.textContent = `Wave: ${Math.min(state.wave, MAX_WAVES)}/${MAX_WAVES}`;
  }

  function buildStarfield() {
    const starCount = 1200;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = rand(-SETTINGS.starField, SETTINGS.starField);
      positions[i * 3 + 1] = rand(-SETTINGS.starField, SETTINGS.starField);
      positions[i * 3 + 2] = rand(-SETTINGS.starField, SETTINGS.starField);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xbad9ff,
      size: 2.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8
    });
    const points = new THREE.Points(geo, mat);
    state.stars = positions;
    return points;
  }

  function wrapStars() {
    const range = SETTINGS.starField;
    const pos = state.stars;
    const px = state.player.position.x;
    const py = state.player.position.y;
    const pz = state.player.position.z;
    for (let i = 0; i < pos.length; i += 3) {
      let x = pos[i] - px;
      let y = pos[i + 1] - py;
      let z = pos[i + 2] - pz;
      if (x > range) pos[i] -= range * 2;
      if (x < -range) pos[i] += range * 2;
      if (y > range) pos[i + 1] -= range * 2;
      if (y < -range) pos[i + 1] += range * 2;
      if (z > range) pos[i + 2] -= range * 2;
      if (z < -range) pos[i + 2] += range * 2;
    }
  }

  function buildReticle() {
    const ring = new THREE.RingGeometry(0.012, 0.018, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0x7dfc9a, transparent: true, opacity: 0.8 });
    const mesh = new THREE.Mesh(ring, mat);
    mesh.position.set(0, 0, -2.4);
    return mesh;
  }

  function buildCockpit() {
    const group = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0a111c, metalness: 0.45, roughness: 0.65 });
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x121c2a, metalness: 0.25, roughness: 0.8 });
    const glowMat = new THREE.MeshStandardMaterial({
      color: 0x102234,
      emissive: 0x35f0ff,
      emissiveIntensity: 0.7,
      metalness: 0.2,
      roughness: 0.4
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88caff,
      transparent: true,
      opacity: 0.08,
      roughness: 0.2,
      metalness: 0,
      side: THREE.DoubleSide
    });

    const rim = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.12, 12, 44), frameMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 1.7, -7.2);

    const dash = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 2.8), panelMat);
    dash.position.set(0, 0.35, -2.8);

    const leftPanel = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 2.4), panelMat);
    leftPanel.position.set(-3.7, 0.25, -2.2);

    const rightPanel = leftPanel.clone();
    rightPanel.position.set(3.7, 0.25, -2.2);

    const strutGeo = new THREE.CylinderGeometry(0.08, 0.08, 4.4, 12);
    const leftStrut = new THREE.Mesh(strutGeo, frameMat);
    leftStrut.position.set(-2.1, 1.8, -5.2);
    leftStrut.rotation.z = 0.38;
    leftStrut.rotation.x = 0.2;

    const rightStrut = leftStrut.clone();
    rightStrut.position.set(2.1, 1.8, -5.2);
    rightStrut.rotation.z = -0.38;

    const glass = new THREE.Mesh(new THREE.CylinderGeometry(4.7, 5.0, 6.2, 20, 1, true), glassMat);
    glass.rotation.x = Math.PI / 2;
    glass.position.set(0, 2.2, -6.4);

    const screenLeft = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), glowMat);
    screenLeft.position.set(-2.9, 0.55, -1.8);
    screenLeft.rotation.x = -0.35;
    const screenRight = screenLeft.clone();
    screenRight.position.set(2.9, 0.55, -1.8);

    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 1.4, 10), frameMat);
    stick.position.set(0, 0, -1.4);
    stick.rotation.x = 0.4;

    group.add(rim, dash, leftPanel, rightPanel, leftStrut, rightStrut, glass, screenLeft, screenRight, stick);

    return { group, stick, screens: [screenLeft, screenRight], glowMat };
  }

  function createEnemyMesh(type) {
    const group = new THREE.Group();
    const color = type === 'ace' ? 0xff7bff : type === 'strafer' ? 0xffa94d : 0xff6b6b;
    const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.5 });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: 0.8 });

    const nose = new THREE.ConeGeometry(1.6, 4.8, 12);
    nose.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(nose, bodyMat);

    const wing = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.4, 1.6), bodyMat);
    wing.position.set(0, 0, -0.5);

    const engine = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 10), glowMat);
    engine.position.set(0, 0, 2.2);

    group.add(body, wing, engine);
    group.userData = { engine, glowMat };
    return group;
  }

  function spawnEnemy() {
    const player = state.player;
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, player.roll, 'YXZ'));
    const biasFront = Math.random() < 0.88;
    const offset = biasFront ? rand(-Math.PI * 0.32, Math.PI * 0.32) : rand(Math.PI * 0.7, Math.PI * 1.3);
    const spawnAngle = Math.atan2(forward.z, forward.x) + offset;
    const radius = rand(260, 420);
    const height = rand(-120, 120);
    const x = player.position.x + Math.cos(spawnAngle) * radius;
    const z = player.position.z + Math.sin(spawnAngle) * radius;
    const y = player.position.y + height;

    const typeRoll = Math.random();
    const type = typeRoll > 0.75 ? 'ace' : typeRoll > 0.4 ? 'strafer' : 'chaser';
    const skill = type === 'ace' ? 1.25 : type === 'strafer' ? 1.05 : 0.9;

    const mesh = createEnemyMesh(type);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    state.enemies.push({
      mesh,
      position: mesh.position,
      velocity: new THREE.Vector3(),
      hp: (type === 'ace' ? 30 : type === 'strafer' ? 24 : 20) + Math.floor((state.wave - 1) * 1.6),
      type,
      thrust: (SETTINGS.enemies.thrust + rand(-SETTINGS.enemies.thrustVar, SETTINGS.enemies.thrustVar)) * skill,
      maxSpeed: (SETTINGS.enemies.maxSpeed + rand(-SETTINGS.enemies.maxSpeedVar, SETTINGS.enemies.maxSpeedVar)) * skill,
      fireTimer: getEnemyFireDelay(type),
      skill,
      behindTime: 0,
      radius: 3.6
    });
  }

  function spawnWave() {
    state.enemies.forEach(enemy => scene.remove(enemy.mesh));
    state.enemies = [];
    const initialCount = Math.min(SETTINGS.enemies.baseCount + Math.floor((state.wave - 1) * 0.7), SETTINGS.enemies.maxCount);
    const waveBudget = Math.min(SETTINGS.enemies.baseCount + 2 + Math.floor(state.wave * 1.1), SETTINGS.enemies.maxCount + 3);
    state.waveSpawnsRemaining = Math.max(0, waveBudget - initialCount);
    state.spawnInterval = Math.max(0.85, 1.7 - state.wave * 0.14);
    state.spawnTimer = state.spawnInterval;
    for (let i = 0; i < initialCount; i++) spawnEnemy();
  }

  function getEnemyFireDelay(type) {
    const typeOffset = type === 'ace' ? -0.18 : type === 'chaser' ? 0 : 0.2;
    const variance = type === 'ace' ? SETTINGS.enemies.fireVar * 0.7 : SETTINGS.enemies.fireVar;
    return Math.max(0.4, SETTINGS.enemies.fireBase + typeOffset + Math.random() * variance);
  }

  function findAssistTarget() {
    const player = state.player;
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, player.roll, 'YXZ'));
    let best = null;
    let bestScore = Infinity;
    state.enemies.forEach(enemy => {
      const toEnemy = enemy.position.clone().sub(player.position);
      const dist = toEnemy.length();
      if (dist > 650) return;
      const dir = toEnemy.clone().normalize();
      const angle = forward.angleTo(dir);
      if (angle > 0.75) return;
      const score = dist + angle * 200;
      if (score < bestScore) {
        bestScore = score;
        best = enemy;
      }
    });
    return best;
  }

  function computeLeadDirection(enemy) {
    const player = state.player;
    const toEnemy = enemy.position.clone().sub(player.position);
    const dist = toEnemy.length();
    const t = dist / SETTINGS.bullets.speed;
    const lead = enemy.position.clone().addScaledVector(enemy.velocity, t);
    return lead.sub(player.position).normalize();
  }

  function firePlayer() {
    if (state.player.fireCooldown > 0) return;
    const player = state.player;
    let direction = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, player.roll, 'YXZ'));

    if (getAssistMode() === 'assist') {
      const target = findAssistTarget();
      if (target) direction = computeLeadDirection(target);
    }

    const geometry = new THREE.SphereGeometry(0.3, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xbfe8ff });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(player.position).addScaledVector(direction, 3);
    scene.add(mesh);

    state.bullets.push({
      mesh,
      position: mesh.position,
      velocity: direction.clone().multiplyScalar(SETTINGS.bullets.speed),
      life: SETTINGS.bullets.life
    });

    state.player.fireCooldown = SETTINGS.player.fireCooldown;
  }

  function fireEnemy(enemy) {
    const toPlayer = state.player.position.clone().sub(enemy.position).normalize();
    const geometry = new THREE.SphereGeometry(0.35, 8, 8);
    const material = new THREE.MeshBasicMaterial({ color: 0xffb37b });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(enemy.position).addScaledVector(toPlayer, 2.8);
    scene.add(mesh);

    state.enemyBullets.push({
      mesh,
      position: mesh.position,
      velocity: toPlayer.clone().multiplyScalar(SETTINGS.enemies.bulletSpeed + enemy.skill * 18),
      life: 3
    });
  }

  function repositionEnemyAhead(enemy) {
    const player = state.player;
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(player.pitch, player.yaw, player.roll, 'YXZ'));
    const offset = rand(-Math.PI * 0.28, Math.PI * 0.28);
    const spawnAngle = Math.atan2(forward.z, forward.x) + offset;
    const radius = rand(320, 480);
    enemy.position.set(
      player.position.x + Math.cos(spawnAngle) * radius,
      player.position.y + rand(-110, 110),
      player.position.z + Math.sin(spawnAngle) * radius
    );
    enemy.velocity.set(0, 0, 0);
    enemy.behindTime = 0;
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
    const dtSec = dt;

    const yawInput = (input.keys['KeyD'] ? 1 : 0) - (input.keys['KeyA'] ? 1 : 0);
    const pitchInput = (input.keys['KeyW'] ? 1 : 0) - (input.keys['KeyS'] ? 1 : 0);
    const rollInput = (input.keys['KeyE'] ? 1 : 0) - (input.keys['KeyQ'] ? 1 : 0);

    player.yaw += yawInput * SETTINGS.player.turnRate * dtSec;
    player.pitch += pitchInput * SETTINGS.player.pitchRate * dtSec;
    player.roll += rollInput * SETTINGS.player.rollRate * dtSec;
    player.pitch = clamp(player.pitch, -1.3, 1.3);
    player.roll *= 0.98;

    const orientation = new THREE.Euler(player.pitch, player.yaw, player.roll, 'YXZ');
    const forward = new THREE.Vector3(0, 0, -1).applyEuler(orientation);

    const thrustInput = (input.keys['ArrowUp'] ? 1 : 0) - (input.keys['ArrowDown'] ? 1 : 0);
    if (thrustInput > 0) {
      player.velocity.addScaledVector(forward, SETTINGS.player.thrust * dtSec);
    } else if (thrustInput < 0) {
      player.velocity.addScaledVector(forward, -SETTINGS.player.reverseThrust * dtSec);
    }

    player.velocity.multiplyScalar(Math.pow(SETTINGS.player.drag, dtSec * 60));
    if (player.velocity.length() > SETTINGS.player.maxSpeed) {
      player.velocity.setLength(SETTINGS.player.maxSpeed);
    }

    player.position.addScaledVector(player.velocity, dtSec);

    playerGroup.position.copy(player.position);
    playerGroup.rotation.set(player.pitch, player.yaw, player.roll, 'YXZ');

    cockpit.stick.rotation.x = 0.5 + pitchInput * 0.2;
    cockpit.stick.rotation.z = -yawInput * 0.2;
    cockpit.screens.forEach((screen, idx) => {
      const pulse = 0.5 + Math.sin(performance.now() * 0.002 + idx) * 0.15;
      screen.material.emissiveIntensity = 0.6 + pulse;
    });

    if (performance.now() / 1000 - player.lastHit > SETTINGS.shieldRegenDelay) {
      player.shield = Math.min(player.maxShield, player.shield + SETTINGS.shieldRegenRate * dtSec);
    }
    if (state.intermission > 0) {
      player.shield = Math.min(player.maxShield, player.shield + 26 * dtSec);
    }

    if (player.fireCooldown > 0) player.fireCooldown -= dtSec;
    if (input.keys['Space']) firePlayer();

    state.bullets.forEach(bullet => {
      bullet.position.addScaledVector(bullet.velocity, dtSec);
      bullet.life -= dtSec;
    });
    state.bullets = state.bullets.filter(bullet => {
      if (bullet.life <= 0) {
        scene.remove(bullet.mesh);
        return false;
      }
      return true;
    });

    state.enemyBullets.forEach(bullet => {
      bullet.position.addScaledVector(bullet.velocity, dtSec);
      bullet.life -= dtSec;
    });
    state.enemyBullets = state.enemyBullets.filter(bullet => {
      if (bullet.life <= 0) {
        scene.remove(bullet.mesh);
        return false;
      }
      return true;
    });

    state.enemies.forEach(enemy => {
      const toPlayer = player.position.clone().sub(enemy.position);
      const dist = toPlayer.length();
      const dirToPlayer = toPlayer.clone().normalize();
      const angleTo = forward.angleTo(dirToPlayer);
      if (angleTo > 1.3) enemy.behindTime += dtSec;
      else enemy.behindTime = Math.max(0, enemy.behindTime - dtSec * 0.4);

      if (enemy.behindTime > 2.5 || dist > 900) repositionEnemyAhead(enemy);

      let desired = dirToPlayer.clone();
      if (enemy.type === 'strafer') {
        const side = new THREE.Vector3().crossVectors(dirToPlayer, new THREE.Vector3(0, 1, 0)).normalize();
        desired.addScaledVector(side, enemy.orbit || 0.6).normalize();
      }
      if (enemy.type === 'ace' && dist < 140) {
        desired.addScaledVector(forward, 0.6).normalize();
      }

      enemy.velocity.addScaledVector(desired, enemy.thrust * dtSec);
      if (enemy.velocity.length() > enemy.maxSpeed) enemy.velocity.setLength(enemy.maxSpeed);
      enemy.velocity.multiplyScalar(0.985);
      enemy.position.addScaledVector(enemy.velocity, dtSec);

      enemy.mesh.lookAt(enemy.position.clone().add(enemy.velocity));

      enemy.fireTimer -= dtSec;
      if (enemy.fireTimer <= 0 && dist < 520 && angleTo < 0.7) {
        fireEnemy(enemy);
        enemy.fireTimer = getEnemyFireDelay(enemy.type);
      }

      const glow = enemy.mesh.userData.glowMat;
      if (glow) glow.emissiveIntensity = 0.6 + Math.sin(performance.now() * 0.004 + dist) * 0.2;
    });

    state.bullets.forEach(bullet => {
      state.enemies.forEach(enemy => {
        if (enemy.hp <= 0) return;
        if (bullet.position.distanceTo(enemy.position) < enemy.radius) {
          enemy.hp -= 12;
          bullet.life = 0;
          if (enemy.hp <= 0) {
            state.kills += 1;
            scene.remove(enemy.mesh);
          }
        }
      });
    });

    state.enemyBullets.forEach(bullet => {
      if (bullet.position.distanceTo(player.position) < 4) {
        applyDamage(10);
        bullet.life = 0;
      }
    });

    state.enemies = state.enemies.filter(enemy => enemy.hp > 0);

    if (state.intermission > 0) {
      state.intermission = Math.max(0, state.intermission - dtSec);
      if (state.intermission === 0 && !state.completed) spawnWave();
    } else {
      state.spawnTimer -= dtSec;
      if (state.waveSpawnsRemaining > 0 && state.spawnTimer <= 0 && state.enemies.length < SETTINGS.enemies.maxCount) {
        spawnEnemy();
        state.waveSpawnsRemaining -= 1;
        state.spawnTimer = state.spawnInterval * (0.7 + Math.random() * 0.5);
      }
    }

    if (state.enemies.length === 0 && state.waveSpawnsRemaining <= 0 && state.intermission <= 0) {
      if (state.wave >= MAX_WAVES) {
        state.completed = true;
        state.running = false;
      } else {
        state.wave += 1;
        state.intermission = SETTINGS.intermission;
      }
    }

    if (player.hp <= 0) state.running = false;

    wrapStars();
    stars.geometry.attributes.position.needsUpdate = true;
    updateHud();
  }

  function render() {
    renderer.render(scene, camera);
  }

  function loop(timestamp) {
    if (!state.running) return;
    const dt = Math.min(0.033, (timestamp - state.lastTime) / 1000);
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

  function resetDuel() {
    state.running = false;
    state.lastTime = 0;
    state.wave = 1;
    state.kills = 0;
    state.spawnTimer = 0;
    state.spawnInterval = 0;
    state.waveSpawnsRemaining = 0;
    state.intermission = 0;
    state.completed = false;
    state.bullets.forEach(bullet => scene.remove(bullet.mesh));
    state.enemyBullets.forEach(bullet => scene.remove(bullet.mesh));
    state.enemies.forEach(enemy => scene.remove(enemy.mesh));
    state.bullets = [];
    state.enemyBullets = [];
    state.enemies = [];
    state.player.position.set(0, 0, 0);
    state.player.velocity.set(0, 0, 0);
    state.player.yaw = 0;
    state.player.pitch = 0;
    state.player.roll = 0;
    state.player.hp = state.player.maxHp;
    state.player.shield = state.player.maxShield;
    state.player.lastHit = performance.now();
    state.player.fireCooldown = 0;
    playerGroup.position.copy(state.player.position);
    playerGroup.rotation.set(0, 0, 0);
    spawnWave();
    updateHud();
    render();
  }

  function resize() {
    const width = canvas.clientWidth || canvas.width;
    const height = canvas.clientHeight || canvas.height;
    if (canvas.width !== width || canvas.height !== height) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
  }

  function bindInput() {
    if (window.__duelBound) return;
    window.__duelBound = true;
    document.addEventListener('keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code)) {
        e.preventDefault();
      }
      input.keys[e.code] = true;
    });
    document.addEventListener('keyup', (e) => { input.keys[e.code] = false; });
    window.addEventListener('resize', resize);
  }

  function initDuel() {
    resize();
    bindInput();
    resetDuel();
  }

  startBtn?.addEventListener('click', start);
  pauseBtn?.addEventListener('click', pause);
  resetBtn?.addEventListener('click', resetDuel);

  window.initDuel = initDuel;
  window.stopDuel = pause;
})();
