import { db, hasFirebaseConfig, waitForAuth } from './firebase.js';
import { getHighScore, submitHighScore } from './score-store.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

(() => {
  const canvas = document.getElementById('swarm-canvas');
  if (!canvas) {
    window.initSwarm = function () {};
    window.stopSwarm = function () {};
    return;
  }
  const ctx = canvas.getContext('2d');

  const hudHp = document.getElementById('swarm-hp');
  const hudShield = document.getElementById('swarm-shield');
  const hudCredits = document.getElementById('swarm-credits');
  const hudChapter = document.getElementById('swarm-chapter');
  const hudCheckpoint = document.getElementById('swarm-checkpoint');
  const hudScore = document.getElementById('swarm-score');
  const hudObjective = document.getElementById('swarm-objective');
  const statusText = document.getElementById('swarm-status');
  const authNote = document.getElementById('swarm-auth-note');

  const startBtn = document.getElementById('swarm-start');
  const pauseBtn = document.getElementById('swarm-pause');
  const resetBtn = document.getElementById('swarm-reset');

  const briefing = document.getElementById('swarm-briefing');
  const briefKicker = document.getElementById('swarm-brief-kicker');
  const briefTitle = document.getElementById('swarm-brief-title');
  const briefBody = document.getElementById('swarm-brief-body');
  const briefPrimary = document.getElementById('swarm-brief-primary');
  const briefOptional = document.getElementById('swarm-brief-optional');
  const briefLaunch = document.getElementById('swarm-brief-launch');

  const upgradeButtons = Array.from(document.querySelectorAll('[data-swarm-upgrade]'));
  const upgradeNote = document.getElementById('swarm-upgrade-note');

  const input = {
    keys: {},
    justPressed: {},
    pointer: { x: canvas.width / 2, y: canvas.height / 2, down: false }
  };

  const VIEW = {
    width: canvas.width,
    height: canvas.height,
    centerX: canvas.width / 2,
    centerY: canvas.height / 2
  };

  const WORLD = {
    size: 4000,
    half: 2000,
    sectorSize: 800,
    maxSector: 4
  };

  const GAME_ID = 'spacex-exploration';
  const SAVE_VERSION = 3;
  const SAVE_KEY = `swarmBreakerSave_v${SAVE_VERSION}`;

  const BASE_STATS = {
    maxHp: 120,
    maxShield: 90,
    thrust: 420,
    reverseThrust: 260,
    turnRate: 0.0056,
    maxSpeed: 320,
    drag: 0.985,
    fireDelay: 200,
    damage: 13,
    bulletSpeed: 920,
    boostMax: 120,
    boostRegen: 22,
    energyMax: 100,
    energyRegen: 18
  };

  const HULL_SIZES = {
    small: { label: 'Small', baseHp: 110, baseShield: 80, size: 12, mass: 1, speedBonus: 0.1 },
    medium: { label: 'Medium', baseHp: 145, baseShield: 110, size: 16, mass: 1.2, speedBonus: 0 },
    large: { label: 'Large', baseHp: 190, baseShield: 140, size: 20, mass: 1.45, speedBonus: -0.08 }
  };

  const UPGRADE_DEFS = {
    engine: { label: 'Engine Output', max: 5, baseCost: 160 },
    blaster: { label: 'Pulse Cannons', max: 5, baseCost: 170 },
    capacitor: { label: 'Capacitor', max: 4, baseCost: 150 },
    shield: { label: 'Shield Core', max: 4, baseCost: 160 },
    hull: { label: 'Hull Plating', max: 4, baseCost: 160 },
    booster: { label: 'Afterburner', max: 3, baseCost: 180 }
  };

  const BLUEPRINTS = {
    shield_overdrive: {
      name: 'Shield Overdrive',
      description: 'Boosts shield capacity by 30%.',
      effect: { shieldMult: 1.3 }
    },
    turbo_engine: {
      name: 'Turbo Engine',
      description: 'Increases max speed and thrust by 12%.',
      effect: { speedMult: 1.12, thrustMult: 1.12 }
    },
    drone_swarm: {
      name: 'Drone Swarm',
      description: 'Unlocks additional escort drones.',
      effect: { droneBonus: 2 }
    },
    plasma_cannon: {
      name: 'Plasma Cannon',
      description: 'Unlocks heavy plasma secondary weapon.',
      effect: { unlockPlasma: true }
    },
    nebula_skin: {
      name: 'Nebula Skin',
      description: 'Cosmetic hull shader.',
      effect: { cosmetic: true }
    }
  };

  const ENEMY_TYPES = {
    scout: { hp: 18, speed: 130, fireRate: 1500, damage: 7, size: 13, color: '#6df0ff', approach: 1.08 },
    fighter: { hp: 30, speed: 110, fireRate: 1250, damage: 9, size: 17, color: '#ffb347', approach: 1.05 },
    bomber: { hp: 50, speed: 90, fireRate: 1050, damage: 12, size: 22, color: '#ff6b6b', approach: 1.12 },
    turret: { hp: 65, speed: 0, fireRate: 950, damage: 11, size: 26, color: '#c77dff', static: true, approach: 0.85 }
  };

  const CHAPTERS = [
    {
      id: 1,
      title: 'Driftline Exodus',
      brief: 'You leave the Tenney Belt with a cracked nav core. The Driftline is unstable, but the relay must come back online.',
      objective: 'Reach the relay gate and stabilize the beacon.',
      distanceGoal: 14000,
      optional: [
        { id: 'c1-a', type: 'kills', enemy: 'scout', target: 10, reward: 160, text: 'Destroy 10 scouts.' },
        { id: 'c1-b', type: 'noHullDamage', reward: 200, text: 'Reach the relay without hull damage.' }
      ]
    },
    {
      id: 2,
      title: 'Glasswake Run',
      brief: 'The relay points to a debris river. The Glasswake will tear hulls apart, but it is the only way forward.',
      objective: 'Cross the Glasswake and secure the signal cache.',
      distanceGoal: 16000,
      optional: [
        { id: 'c2-a', type: 'collect', target: 4, reward: 220, text: 'Collect 4 data shards.' },
        { id: 'c2-b', type: 'kills', enemy: 'fighter', target: 5, reward: 180, text: 'Disable 5 fighters.' }
      ]
    },
    {
      id: 3,
      title: 'Signal Thief',
      brief: 'Pirates have latched onto the relay. Cut through their screen before they drain the beacon.',
      objective: 'Disable the signal thieves and keep the relay alive.',
      distanceGoal: 17000,
      optional: [
        { id: 'c3-a', type: 'kills', enemy: 'fighter', target: 6, reward: 240, text: 'Disable 6 fighters.' },
        { id: 'c3-b', type: 'shieldAtEnd', target: 50, reward: 220, text: 'Finish with 50 shield.' }
      ]
    },
    {
      id: 4,
      title: 'Stormvault',
      brief: 'Ion storms scramble everything. Only the vault lane is stable enough to fly.',
      objective: 'Navigate the stormvault and keep the nav core intact.',
      distanceGoal: 18000,
      optional: [
        { id: 'c4-a', type: 'noBoost', reward: 200, text: 'Reach the midpoint without boost.' },
        { id: 'c4-b', type: 'collect', target: 5, reward: 220, text: 'Collect 5 data shards.' }
      ]
    },
    {
      id: 5,
      title: 'Redshift Pursuit',
      brief: 'The enemy cruiser leaps ahead. Keep pace through redshift tides before it escapes.',
      objective: 'Stay on the pursuit line and tag the cruiser.',
      distanceGoal: 20000,
      optional: [
        { id: 'c5-a', type: 'kills', enemy: 'bomber', target: 4, reward: 240, text: 'Destroy 4 bombers.' },
        { id: 'c5-b', type: 'noHullDamage', reward: 220, text: 'Reach the redshift gate without hull damage.' }
      ]
    },
    {
      id: 6,
      title: 'Bastion Cross',
      brief: 'Automated defense platforms guard the cross. Disable them before they lock the gate.',
      objective: 'Cross the bastion and open the gate.',
      distanceGoal: 21000,
      optional: [
        { id: 'c6-a', type: 'kills', enemy: 'turret', target: 3, reward: 260, text: 'Destroy 3 bastion turrets.' },
        { id: 'c6-b', type: 'collect', target: 6, reward: 240, text: 'Collect 6 data shards.' }
      ]
    },
    {
      id: 7,
      title: 'Darklane Refuge',
      brief: 'Nebula shadows hide a refugee convoy. Protect them without drawing a full pursuit.',
      objective: 'Reach Darklane and keep the convoy alive.',
      distanceGoal: 22000,
      optional: [
        { id: 'c7-a', type: 'kills', enemy: 'scout', target: 8, reward: 260, text: 'Destroy 8 scouts.' },
        { id: 'c7-b', type: 'noBoost', reward: 240, text: 'Finish without using boost.' }
      ]
    },
    {
      id: 8,
      title: 'Starforge Arrival',
      brief: 'The final gate opens into a shipyard of myth. Survive the guardian and claim the Starforge.',
      objective: 'Defeat the guardian and secure the Starforge.',
      distanceGoal: 24000,
      optional: [
        { id: 'c8-a', type: 'kills', enemy: 'bomber', target: 6, reward: 300, text: 'Destroy 6 bombers.' },
        { id: 'c8-b', type: 'shieldAtEnd', target: 60, reward: 260, text: 'Finish with 60 shield.' }
      ]
    }
  ];

  const STAR_LAYERS = [
    { count: 160, sizeMin: 0.5, sizeMax: 1.4, speed: 0.5, alpha: 0.5 },
    { count: 110, sizeMin: 1.0, sizeMax: 2.2, speed: 0.8, alpha: 0.75 },
    { count: 60, sizeMin: 1.6, sizeMax: 3.6, speed: 1.15, alpha: 0.95 }
  ];

  const state = {
    running: false,
    paused: false,
    lastFrame: 0,
    time: 0,
    frameId: null,
    cloudReady: false,
    statusTimer: 0,
    checkpoint: null,
    lastSaveAt: 0,
    lastCloudAt: 0,
    bestDistance: 0,
    awaitingBrief: true,
    scanPulse: 0
  };

  const world = {
    sectors: new Map(),
    discovered: new Set(),
    cacheClaims: {},
    bossesDefeated: {}
  };

  const entities = {
    enemies: [],
    bullets: [],
    enemyBullets: [],
    drones: [],
    loot: [],
    effects: []
  };

  const player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    hp: BASE_STATS.maxHp,
    shield: BASE_STATS.maxShield,
    boost: BASE_STATS.boostMax,
    energy: BASE_STATS.energyMax,
    lastShot: 0,
    lastAltShot: 0,
    lastHit: 0,
    hullSize: 'small',
    credits: 0,
    upgrades: {
      engine: 0,
      blaster: 0,
      capacitor: 0,
      shield: 0,
      hull: 0,
      booster: 0
    },
    blueprints: new Set(),
    skins: [],
    toys: [],
    level: 1,
    distanceThisChapter: 0,
    distanceTotal: 0,
    chapterIndex: 0,
    checkpointIndex: 0,
    chapterState: {},
    selectedWeapon: 'laser',
    unlockedPlasma: false
  };

  const starLayers = STAR_LAYERS.map((layer, index) => {
    const rng = mulberry32(1000 + index * 17);
    return Array.from({ length: layer.count }).map(() => ({
      x: rng() * WORLD.size - WORLD.half,
      y: rng() * WORLD.size - WORLD.half,
      size: randRange(rng, layer.sizeMin, layer.sizeMax),
      alpha: layer.alpha
    }));
  });

  const missionTracker = {
    optional: new Map(),
    noHullDamage: true,
    noBoost: true,
    shieldAtEnd: 0,
    dataShards: 0,
    kills: {}
  };

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randRange(rng, min, max) {
    return min + (max - min) * rng();
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function dist(a, b, c, d) {
    return Math.hypot(c - a, d - b);
  }

  function normalize(x, y) {
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  function sectorCoords(x, y) {
    const sx = clamp(Math.floor((x + WORLD.half) / WORLD.sectorSize), 0, WORLD.maxSector);
    const sy = clamp(Math.floor((y + WORLD.half) / WORLD.sectorSize), 0, WORLD.maxSector);
    return { sx, sy };
  }

  function sectorKey(sx, sy) {
    return `${sx},${sy}`;
  }

  function seededSector(sx, sy) {
    const key = sectorKey(sx, sy);
    if (world.sectors.has(key)) return world.sectors.get(key);
    const seed = 10000 + sx * 199 + sy * 997;
    const sector = {
      key,
      sx,
      sy,
      seed,
      generated: false,
      entities: {
        asteroids: [],
        planets: [],
        stations: [],
        caches: [],
        storms: []
      },
      spawnTimer: 0,
      threat: 1
    };
    world.sectors.set(key, sector);
    return sector;
  }

  function generateSector(sector) {
    if (sector.generated) return;
    const rng = mulberry32(sector.seed);
    const originX = sector.sx * WORLD.sectorSize - WORLD.half;
    const originY = sector.sy * WORLD.sectorSize - WORLD.half;
    const density = randRange(rng, 0.4, 1.2);

    const asteroidCount = Math.floor(randRange(rng, 6, 16) * density);
    for (let i = 0; i < asteroidCount; i += 1) {
      sector.entities.asteroids.push({
        x: originX + randRange(rng, 80, WORLD.sectorSize - 80),
        y: originY + randRange(rng, 80, WORLD.sectorSize - 80),
        radius: randRange(rng, 18, 45),
        drift: randRange(rng, -6, 6),
        spin: randRange(rng, -0.3, 0.3)
      });
    }

    if (rng() < 0.35) {
      sector.entities.planets.push({
        x: originX + randRange(rng, 120, WORLD.sectorSize - 120),
        y: originY + randRange(rng, 120, WORLD.sectorSize - 120),
        radius: randRange(rng, 55, 110),
        hue: randRange(rng, 180, 260)
      });
    }

    if (rng() < 0.25) {
      sector.entities.stations.push({
        x: originX + randRange(rng, 140, WORLD.sectorSize - 140),
        y: originY + randRange(rng, 140, WORLD.sectorSize - 140),
        radius: randRange(rng, 40, 55)
      });
    }

    if (rng() < 0.3) {
      sector.entities.storms.push({
        x: originX + randRange(rng, 180, WORLD.sectorSize - 180),
        y: originY + randRange(rng, 180, WORLD.sectorSize - 180),
        radius: randRange(rng, 120, 200),
        intensity: randRange(rng, 0.3, 0.65)
      });
    }

    if (rng() < 0.28 && !world.cacheClaims[sector.key]) {
      sector.entities.caches.push({
        x: originX + randRange(rng, 150, WORLD.sectorSize - 150),
        y: originY + randRange(rng, 150, WORLD.sectorSize - 150),
        radius: 18,
        blueprint: pickRandomBlueprint(rng)
      });
    }

    sector.threat = 1 + (sector.sx + sector.sy) * 0.12 + randRange(rng, 0, 0.5);
    sector.generated = true;
  }

  function pickRandomBlueprint(rng) {
    const keys = Object.keys(BLUEPRINTS);
    return keys[Math.floor(rng() * keys.length)];
  }

  function noteStatus(message, duration = 3) {
    if (!statusText) return;
    statusText.textContent = message;
    state.statusTimer = duration;
  }

  function updateStatusTimer(dt) {
    if (!statusText || state.statusTimer <= 0) return;
    state.statusTimer -= dt;
    if (state.statusTimer <= 0) statusText.textContent = '';
  }

  function applyBlueprintEffects(stats) {
    let result = { ...stats };
    let droneBonus = 0;
    let unlockPlasma = false;
    player.blueprints.forEach((id) => {
      const blueprint = BLUEPRINTS[id];
      if (!blueprint || !blueprint.effect) return;
      const effect = blueprint.effect;
      if (effect.shieldMult) result.maxShield *= effect.shieldMult;
      if (effect.speedMult) result.maxSpeed *= effect.speedMult;
      if (effect.thrustMult) result.thrust *= effect.thrustMult;
      if (effect.droneBonus) droneBonus += effect.droneBonus;
      if (effect.unlockPlasma) unlockPlasma = true;
    });
    result.droneBonus = droneBonus;
    result.unlockPlasma = unlockPlasma;
    return result;
  }

  function computeStats() {
    const hull = HULL_SIZES[player.hullSize] || HULL_SIZES.small;
    const upgrades = player.upgrades;
    const maxHp = hull.baseHp * (1 + upgrades.hull * 0.15);
    const maxShield = hull.baseShield * (1 + upgrades.shield * 0.15);
    const thrust = BASE_STATS.thrust * (1 + upgrades.engine * 0.08) / hull.mass;
    const reverseThrust = BASE_STATS.reverseThrust * (1 + upgrades.engine * 0.06) / hull.mass;
    const maxSpeed = BASE_STATS.maxSpeed * (1 + upgrades.engine * 0.05 + hull.speedBonus);
    const turnRate = BASE_STATS.turnRate * (1 + upgrades.engine * 0.04);
    let fireDelay = BASE_STATS.fireDelay * (1 - upgrades.blaster * 0.06);
    fireDelay = Math.max(80, fireDelay);
    const damage = BASE_STATS.damage * (1 + upgrades.blaster * 0.12);
    const bulletSpeed = BASE_STATS.bulletSpeed * (1 + upgrades.blaster * 0.04);
    const boostMax = BASE_STATS.boostMax * (1 + upgrades.booster * 0.2);
    const boostRegen = BASE_STATS.boostRegen * (1 + upgrades.booster * 0.12);
    const energyMax = BASE_STATS.energyMax * (1 + upgrades.capacitor * 0.18);
    const energyRegen = BASE_STATS.energyRegen * (1 + upgrades.capacitor * 0.15);
    const shieldRegen = 24 + upgrades.shield * 4;
    const shieldDelay = 1.2 - upgrades.shield * 0.05;
    const baseStats = {
      maxHp,
      maxShield,
      thrust,
      reverseThrust,
      maxSpeed,
      turnRate,
      fireDelay,
      damage,
      bulletSpeed,
      boostMax,
      boostRegen,
      energyMax,
      energyRegen,
      shieldRegen,
      shieldDelay,
      size: hull.size
    };
    const boosted = applyBlueprintEffects(baseStats);
    player.unlockedPlasma = boosted.unlockPlasma;
    return boosted;
  }

  let cachedStats = computeStats();

  function refreshStats({ keepRatios = true } = {}) {
    const prev = cachedStats;
    cachedStats = computeStats();
    if (keepRatios) {
      const hpRatio = prev.maxHp > 0 ? player.hp / prev.maxHp : 1;
      const shieldRatio = prev.maxShield > 0 ? player.shield / prev.maxShield : 1;
      const boostRatio = prev.boostMax > 0 ? player.boost / prev.boostMax : 1;
      const energyRatio = prev.energyMax > 0 ? player.energy / prev.energyMax : 1;
      player.hp = clamp(cachedStats.maxHp * hpRatio, 0, cachedStats.maxHp);
      player.shield = clamp(cachedStats.maxShield * shieldRatio, 0, cachedStats.maxShield);
      player.boost = clamp(cachedStats.boostMax * boostRatio, 0, cachedStats.boostMax);
      player.energy = clamp(cachedStats.energyMax * energyRatio, 0, cachedStats.energyMax);
    } else {
      player.hp = cachedStats.maxHp;
      player.shield = cachedStats.maxShield;
      player.boost = cachedStats.boostMax;
      player.energy = cachedStats.energyMax;
    }
  }

  function computePlayerLevel() {
    const upgradeSum = Object.values(player.upgrades).reduce((sum, value) => sum + value, 0);
    const blueprintCount = player.blueprints.size;
    const sectorCount = world.discovered.size;
    return Math.max(1, Math.floor(1 + upgradeSum * 0.7 + blueprintCount * 0.8 + sectorCount * 0.15));
  }

  function updateHullSizeFromLevel() {
    const level = player.level;
    let newSize = 'small';
    if (level >= 8) newSize = 'large';
    else if (level >= 4) newSize = 'medium';
    if (newSize !== player.hullSize) {
      player.hullSize = newSize;
      refreshStats({ keepRatios: true });
      noteStatus(`Hull expanded to ${HULL_SIZES[newSize].label}.`);
    }
  }

  function resetChapterState() {
    missionTracker.optional.clear();
    missionTracker.noHullDamage = true;
    missionTracker.noBoost = true;
    missionTracker.dataShards = 0;
    missionTracker.kills = {};
    const chapter = CHAPTERS[player.chapterIndex];
    if (!chapter) return;
    chapter.optional.forEach((opt) => {
      missionTracker.optional.set(opt.id, { complete: false, progress: 0 });
    });
  }

  function applyCheckpoint(snapshot) {
    if (!snapshot) return;
    player.x = snapshot.x;
    player.y = snapshot.y;
    player.vx = 0;
    player.vy = 0;
    player.hp = snapshot.hp;
    player.shield = snapshot.shield;
    player.boost = snapshot.boost;
    player.energy = snapshot.energy;
    player.distanceThisChapter = snapshot.distanceThisChapter;
    player.checkpointIndex = snapshot.checkpointIndex;
    noteStatus('Returned to last checkpoint.');
  }

  function setCheckpoint() {
    state.checkpoint = {
      x: player.x,
      y: player.y,
      hp: player.hp,
      shield: player.shield,
      boost: player.boost,
      energy: player.energy,
      distanceThisChapter: player.distanceThisChapter,
      checkpointIndex: player.checkpointIndex
    };
  }

  function initPlayerPosition() {
    player.x = 0;
    player.y = 0;
    player.vx = 0;
    player.vy = 0;
    player.angle = -Math.PI / 2;
  }

  function resetRun({ full = false } = {}) {
    entities.enemies.length = 0;
    entities.bullets.length = 0;
    entities.enemyBullets.length = 0;
    entities.drones.length = 0;
    entities.loot.length = 0;
    entities.effects.length = 0;
    if (full) {
      player.credits = 0;
      player.upgrades = {
        engine: 0,
        blaster: 0,
        capacitor: 0,
        shield: 0,
        hull: 0,
        booster: 0
      };
      player.blueprints = new Set();
      player.skins = [];
      player.toys = [];
      player.hullSize = 'small';
      player.chapterIndex = 0;
      player.distanceThisChapter = 0;
      player.distanceTotal = 0;
      player.checkpointIndex = 0;
      world.discovered.clear();
      world.cacheClaims = {};
      world.bossesDefeated = {};
      world.sectors.clear();
    }
    initPlayerPosition();
    refreshStats({ keepRatios: false });
    spawnDrones();
    resetChapterState();
    setCheckpoint();
    state.awaitingBrief = true;
    showBriefing();
    noteStatus(full ? 'Fresh run initialized.' : 'Run reset.');
  }

  function awardCredits(amount, reason) {
    player.credits += amount;
    if (reason) noteStatus(`${reason} +${amount} credits.`);
  }

  function updateOptionalProgress(type, payload) {
    const chapter = CHAPTERS[player.chapterIndex];
    if (!chapter) return;
    chapter.optional.forEach((opt) => {
      if (opt.type !== type) return;
      const tracker = missionTracker.optional.get(opt.id);
      if (!tracker || tracker.complete) return;
      if (type === 'kills' && payload.enemy !== opt.enemy) return;
      tracker.progress += payload.amount || 1;
      if (tracker.progress >= opt.target) {
        tracker.complete = true;
        awardCredits(opt.reward, `Optional complete: ${opt.text}`);
      }
    });
  }

  function finalizeOptionalChallenges() {
    const chapter = CHAPTERS[player.chapterIndex];
    if (!chapter) return;
    chapter.optional.forEach((opt) => {
      const tracker = missionTracker.optional.get(opt.id);
      if (!tracker || tracker.complete) return;
      if (opt.type === 'noHullDamage' && missionTracker.noHullDamage) {
        tracker.complete = true;
        awardCredits(opt.reward, `Optional complete: ${opt.text}`);
      }
      if (opt.type === 'noBoost' && missionTracker.noBoost) {
        tracker.complete = true;
        awardCredits(opt.reward, `Optional complete: ${opt.text}`);
      }
      if (opt.type === 'shieldAtEnd' && player.shield >= opt.target) {
        tracker.complete = true;
        awardCredits(opt.reward, `Optional complete: ${opt.text}`);
      }
    });
  }

  function updateDifficulty() {
    player.level = computePlayerLevel();
    updateHullSizeFromLevel();
  }

  function getSectorAtPlayer() {
    const { sx, sy } = sectorCoords(player.x, player.y);
    const sector = seededSector(sx, sy);
    generateSector(sector);
    if (!world.discovered.has(sector.key)) {
      world.discovered.add(sector.key);
      awardCredits(40, 'Sector discovered');
    }
    return sector;
  }

  function spawnEnemy(type, x, y, scale = 1) {
    const def = ENEMY_TYPES[type];
    if (!def) return;
    const levelScale = 1 + (player.level - 1) * 0.08;
    entities.enemies.push({
      type,
      x,
      y,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: def.hp * scale * levelScale,
      maxHp: def.hp * scale * levelScale,
      fireCooldown: randRange(Math.random, 0, def.fireRate),
      state: 'patrol',
      size: def.size * scale,
      def
    });
  }

  function spawnBoss(x, y) {
    entities.enemies.push({
      type: 'boss',
      x,
      y,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: 520 + player.level * 35,
      maxHp: 520 + player.level * 35,
      fireCooldown: 900,
      state: 'chase',
      size: 42,
      phase: 1,
      isBoss: true
    });
    noteStatus('Guardian inbound.');
  }

  function spawnLoot(x, y, type, value) {
    entities.loot.push({
      x,
      y,
      type,
      value,
      vx: randRange(Math.random, -25, 25),
      vy: randRange(Math.random, -25, 25),
      life: 18
    });
  }

  function spawnEffect(x, y, color) {
    entities.effects.push({ x, y, radius: 6, life: 0.6, color });
  }

  function spawnDrones() {
    entities.drones.length = 0;
    const base = 1;
    const droneCount = base + Math.floor(player.upgrades.capacitor / 2) + (cachedStats.droneBonus || 0);
    for (let i = 0; i < droneCount; i += 1) {
      entities.drones.push({
        angle: (Math.PI * 2 * i) / droneCount,
        radius: 34 + i * 6,
        type: i % 2 === 0 ? 'attack' : 'repair',
        cooldown: randRange(Math.random, 0.2, 0.6)
      });
    }
  }

  function applyDamage(target, amount) {
    if (target === player) {
      if (player.shield > 0) {
        const absorbed = Math.min(player.shield, amount * 0.75);
        player.shield -= absorbed;
        amount -= absorbed;
      }
      if (amount > 0) {
        player.hp -= amount;
        missionTracker.noHullDamage = false;
      }
      player.lastHit = state.time;
      if (player.hp <= 0) {
        player.hp = 0;
        handlePlayerDeath();
      }
      return;
    }
    target.hp -= amount;
    if (target.hp <= 0) {
      target.hp = 0;
    }
  }

  function handlePlayerDeath() {
    state.running = false;
    noteStatus('Hull breach. Press Start to relaunch.');
    submitHighScore(GAME_ID, Math.floor(player.distanceTotal));
  }

  function handleEnemyDeath(enemy) {
    awardCredits(Math.round(25 + enemy.maxHp * 0.4));
    updateOptionalProgress('kills', { enemy: enemy.type, amount: 1 });
    spawnEffect(enemy.x, enemy.y, enemy.isBoss ? '#ffb347' : '#7dfc9a');
    if (Math.random() < 0.2) spawnLoot(enemy.x, enemy.y, 'shield', 18);
    if (Math.random() < 0.25) spawnLoot(enemy.x, enemy.y, 'boost', 16);
    if (Math.random() < 0.18) spawnLoot(enemy.x, enemy.y, 'data', 1);
    if (enemy.isBoss) {
      world.bossesDefeated[player.chapterIndex] = true;
      awardCredits(600, 'Boss defeated');
      maybeAdvanceChapter(true);
    }
  }

  function firePlayerWeapon() {
    const now = state.time;
    if (now - player.lastShot < cachedStats.fireDelay / 1000) return;
    player.lastShot = now;
    const dir = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
    entities.bullets.push({
      x: player.x + dir.x * 16,
      y: player.y + dir.y * 16,
      vx: player.vx + dir.x * cachedStats.bulletSpeed,
      vy: player.vy + dir.y * cachedStats.bulletSpeed,
      life: 1.2,
      damage: cachedStats.damage,
      color: '#7dfc9a'
    });
  }

  function firePlasmaWeapon() {
    if (!player.unlockedPlasma) return;
    const now = state.time;
    const cooldown = 0.9;
    if (now - player.lastAltShot < cooldown) return;
    if (player.energy < 30) {
      noteStatus('Not enough energy for plasma.');
      return;
    }
    player.energy -= 30;
    player.lastAltShot = now;
    const dir = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
    entities.bullets.push({
      x: player.x + dir.x * 18,
      y: player.y + dir.y * 18,
      vx: player.vx + dir.x * (cachedStats.bulletSpeed * 0.8),
      vy: player.vy + dir.y * (cachedStats.bulletSpeed * 0.8),
      life: 1.6,
      damage: cachedStats.damage * 2.4,
      color: '#ffb347',
      splash: 38
    });
    noteStatus('Plasma discharge.');
  }

  function fireEMPBlast() {
    const now = state.time;
    if (now - player.lastAltShot < 1.2) return;
    if (player.energy < 45) {
      noteStatus('Not enough energy for EMP.');
      return;
    }
    player.energy -= 45;
    player.lastAltShot = now;
    entities.effects.push({ x: player.x, y: player.y, radius: 20, life: 0.4, color: '#6df0ff', emp: true });
    entities.enemies.forEach((enemy) => {
      if (dist(player.x, player.y, enemy.x, enemy.y) < 150) {
        enemy.stunned = 1.2;
      }
    });
    noteStatus('EMP burst engaged.');
  }

  function updatePlayer(dt) {
    const turningLeft = input.keys['KeyA'] || input.keys['ArrowLeft'];
    const turningRight = input.keys['KeyD'] || input.keys['ArrowRight'];
    const thrusting = input.keys['KeyW'] || input.keys['ArrowUp'];
    const reversing = input.keys['KeyS'] || input.keys['ArrowDown'];
    const boosting = input.keys['ShiftLeft'] || input.keys['ShiftRight'];

    if (turningLeft) player.angle -= cachedStats.turnRate * (dt * 60);
    if (turningRight) player.angle += cachedStats.turnRate * (dt * 60);

    const dir = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
    if (thrusting) {
      player.vx += dir.x * cachedStats.thrust * dt;
      player.vy += dir.y * cachedStats.thrust * dt;
    }
    if (reversing) {
      player.vx -= dir.x * cachedStats.reverseThrust * dt;
      player.vy -= dir.y * cachedStats.reverseThrust * dt;
    }

    if (boosting && player.boost > 0) {
      player.vx += dir.x * cachedStats.thrust * 1.8 * dt;
      player.vy += dir.y * cachedStats.thrust * 1.8 * dt;
      player.boost = clamp(player.boost - 48 * dt, 0, cachedStats.boostMax);
      missionTracker.noBoost = false;
      spawnEffect(player.x - dir.x * 18, player.y - dir.y * 18, '#7dfc9a');
    } else {
      player.boost = clamp(player.boost + cachedStats.boostRegen * dt, 0, cachedStats.boostMax);
    }

    const speed = Math.hypot(player.vx, player.vy);
    const maxSpeed = boosting ? cachedStats.maxSpeed * 1.35 : cachedStats.maxSpeed;
    if (speed > maxSpeed) {
      const scale = maxSpeed / (speed || 1);
      player.vx *= scale;
      player.vy *= scale;
    }

    player.vx *= cachedStats.drag;
    player.vy *= cachedStats.drag;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    player.x = clamp(player.x, -WORLD.half + 40, WORLD.half - 40);
    player.y = clamp(player.y, -WORLD.half + 40, WORLD.half - 40);

    if (input.keys['Space']) firePlayerWeapon();
    if (input.justPressed['KeyX']) firePlasmaWeapon();
    if (input.justPressed['KeyF']) fireEMPBlast();
    if (input.justPressed['KeyR']) applyCheckpoint(state.checkpoint);

    if (state.time - player.lastHit > cachedStats.shieldDelay) {
      player.shield = clamp(player.shield + cachedStats.shieldRegen * dt, 0, cachedStats.maxShield);
    }
    player.energy = clamp(player.energy + cachedStats.energyRegen * dt, 0, cachedStats.energyMax);
  }

  function updateEnemies(dt) {
    const sector = getSectorAtPlayer();
    sector.spawnTimer -= dt;
    const maxEnemies = 4 + Math.floor(player.level * 1.2);
    if (sector.spawnTimer <= 0 && entities.enemies.length < maxEnemies) {
      const rng = mulberry32(sector.seed + Math.floor(state.time * 10));
      const choices = ['scout', 'fighter', 'bomber', 'turret'];
      const type = choices[Math.floor(rng() * choices.length)];
      const angle = rng() * Math.PI * 2;
      const radius = randRange(rng, 220, 420);
      spawnEnemy(type, player.x + Math.cos(angle) * radius, player.y + Math.sin(angle) * radius, 1 + sector.threat * 0.1);
      sector.spawnTimer = randRange(rng, 1.2, 2.5) / (1 + player.level * 0.05);
    }

    entities.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      const isStatic = enemy.def?.static;
      if (enemy.stunned) {
        enemy.stunned -= dt;
        enemy.vx *= 0.96;
        enemy.vy *= 0.96;
      } else {
        if (enemy.isBoss) {
          if (enemy.hp < enemy.maxHp * 0.65) enemy.phase = 2;
          if (enemy.hp < enemy.maxHp * 0.3) enemy.phase = 3;
        }

        if (distance < 420) enemy.state = 'attack';
        else if (distance < 720) enemy.state = 'chase';
        else enemy.state = 'patrol';

        if (enemy.hp < enemy.maxHp * 0.25 && !enemy.isBoss) enemy.state = 'retreat';

        let speed = enemy.def ? enemy.def.speed : 90;
        if (enemy.isBoss) speed = 70 + enemy.phase * 25;

        if (!isStatic) {
          if (enemy.state === 'chase' || enemy.state === 'attack') {
            const dir = normalize(dx, dy);
            enemy.vx += dir.x * speed * dt;
            enemy.vy += dir.y * speed * dt;
          } else if (enemy.state === 'retreat') {
            const dir = normalize(-dx, -dy);
            enemy.vx += dir.x * speed * dt;
            enemy.vy += dir.y * speed * dt;
          } else {
            enemy.vx += Math.sin(state.time + enemy.x) * 5 * dt;
            enemy.vy += Math.cos(state.time + enemy.y) * 5 * dt;
          }
        }
      }

      if (isStatic) {
        enemy.vx = 0;
        enemy.vy = 0;
      } else {
        enemy.vx *= 0.98;
        enemy.vy *= 0.98;
        enemy.x += enemy.vx * dt;
        enemy.y += enemy.vy * dt;
      }

      enemy.fireCooldown -= dt * 1000;
      if (enemy.state === 'attack' && enemy.fireCooldown <= 0) {
        enemy.fireCooldown = enemy.isBoss ? 450 : enemy.def.fireRate;
        const dir = normalize(player.x - enemy.x, player.y - enemy.y);
        entities.enemyBullets.push({
          x: enemy.x + dir.x * enemy.size,
          y: enemy.y + dir.y * enemy.size,
          vx: dir.x * (enemy.isBoss ? 420 : 320),
          vy: dir.y * (enemy.isBoss ? 420 : 320),
          life: 2.2,
          damage: enemy.isBoss ? 18 : enemy.def.damage,
          color: enemy.isBoss ? '#ffb347' : '#ff6b6b'
        });
      }
    });
  }

  function updateBullets(dt) {
    entities.bullets.forEach((bullet) => {
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.splash) {
        bullet.vx *= 0.985;
        bullet.vy *= 0.985;
      }
    });
    entities.bullets = entities.bullets.filter((bullet) => bullet.life > 0);

    entities.enemyBullets.forEach((bullet) => {
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
    });
    entities.enemyBullets = entities.enemyBullets.filter((bullet) => bullet.life > 0);
  }

  function updateDrones(dt) {
    entities.drones.forEach((drone, index) => {
      drone.angle += dt * 0.9;
      const offsetAngle = drone.angle + index * 0.4;
      drone.x = player.x + Math.cos(offsetAngle) * drone.radius;
      drone.y = player.y + Math.sin(offsetAngle) * drone.radius;
      drone.cooldown -= dt;
      if (drone.type === 'repair') {
        if (drone.cooldown <= 0 && player.hp < cachedStats.maxHp) {
          player.hp = clamp(player.hp + 6, 0, cachedStats.maxHp);
          drone.cooldown = 1.4;
          spawnEffect(drone.x, drone.y, '#6df0ff');
        }
      } else if (drone.type === 'attack') {
        if (drone.cooldown <= 0) {
          const target = entities.enemies.find((enemy) => enemy.hp > 0 && dist(drone.x, drone.y, enemy.x, enemy.y) < 360);
          if (target) {
            const dir = normalize(target.x - drone.x, target.y - drone.y);
            entities.bullets.push({
              x: drone.x + dir.x * 8,
              y: drone.y + dir.y * 8,
              vx: dir.x * 640,
              vy: dir.y * 640,
              life: 1.1,
              damage: cachedStats.damage * 0.55,
              color: '#c77dff'
            });
            drone.cooldown = 0.8;
          }
        }
      }
    });
  }

  function updateLoot(dt) {
    entities.loot.forEach((drop) => {
      drop.life -= dt;
      drop.x += drop.vx * dt;
      drop.y += drop.vy * dt;
      drop.vx *= 0.98;
      drop.vy *= 0.98;
      if (dist(player.x, player.y, drop.x, drop.y) < 24) {
        drop.life = 0;
        if (drop.type === 'credits') {
          awardCredits(drop.value || 25, 'Looted');
        } else if (drop.type === 'shield') {
          player.shield = clamp(player.shield + (drop.value || 18), 0, cachedStats.maxShield);
        } else if (drop.type === 'boost') {
          player.boost = clamp(player.boost + (drop.value || 16), 0, cachedStats.boostMax);
        } else if (drop.type === 'data') {
          missionTracker.dataShards += 1;
          updateOptionalProgress('collect', { amount: 1 });
          awardCredits(40, 'Data shard recovered');
        }
      }
    });
    entities.loot = entities.loot.filter((drop) => drop.life > 0);
  }

  function updateEffects(dt) {
    entities.effects.forEach((effect) => {
      effect.life -= dt;
      effect.radius += dt * 120;
    });
    entities.effects = entities.effects.filter((effect) => effect.life > 0);
  }

  function handleCollisions(dt) {
    const sector = getSectorAtPlayer();

    sector.entities.asteroids.forEach((asteroid) => {
      const d = dist(player.x, player.y, asteroid.x, asteroid.y);
      if (d < asteroid.radius + cachedStats.size) {
        const push = normalize(player.x - asteroid.x, player.y - asteroid.y);
        player.x = asteroid.x + push.x * (asteroid.radius + cachedStats.size + 2);
        player.y = asteroid.y + push.y * (asteroid.radius + cachedStats.size + 2);
        applyDamage(player, 12);
        spawnEffect(player.x, player.y, '#ff6b6b');
      }
    });

    sector.entities.storms.forEach((storm) => {
      if (dist(player.x, player.y, storm.x, storm.y) < storm.radius) {
        player.shield = clamp(player.shield - storm.intensity * 15 * dt, 0, cachedStats.maxShield);
        player.energy = clamp(player.energy - storm.intensity * 8 * dt, 0, cachedStats.energyMax);
      }
    });

    entities.bullets.forEach((bullet) => {
      entities.enemies.forEach((enemy) => {
        if (enemy.hp <= 0) return;
        if (dist(bullet.x, bullet.y, enemy.x, enemy.y) < enemy.size) {
          bullet.life = 0;
          applyDamage(enemy, bullet.damage);
          if (bullet.splash) {
            entities.enemies.forEach((other) => {
              if (other !== enemy && dist(bullet.x, bullet.y, other.x, other.y) < bullet.splash) {
                applyDamage(other, bullet.damage * 0.4);
              }
            });
          }
        }
      });
    });

    entities.enemyBullets.forEach((bullet) => {
      if (dist(bullet.x, bullet.y, player.x, player.y) < cachedStats.size + 6) {
        bullet.life = 0;
        applyDamage(player, bullet.damage);
      }
    });

    entities.enemies = entities.enemies.filter((enemy) => {
      if (enemy.hp <= 0) {
        handleEnemyDeath(enemy);
        return false;
      }
      return true;
    });

    sector.entities.caches.forEach((cache) => {
      if (dist(player.x, player.y, cache.x, cache.y) < cache.radius + cachedStats.size) {
        if (!world.cacheClaims[sector.key]) {
          world.cacheClaims[sector.key] = cache.blueprint;
          player.blueprints.add(cache.blueprint);
          refreshStats({ keepRatios: true });
          awardCredits(120, 'Blueprint cache secured');
          spawnLoot(cache.x, cache.y, 'data', 1);
          noteStatus(`Blueprint found: ${BLUEPRINTS[cache.blueprint].name}`);
        }
      }
    });

    sector.entities.stations.forEach((station) => {
      if (dist(player.x, player.y, station.x, station.y) < station.radius + 40) {
        if (input.justPressed['KeyT']) {
          const repairCost = 60;
          if (player.credits >= repairCost) {
            player.credits -= repairCost;
            player.hp = cachedStats.maxHp;
            player.shield = cachedStats.maxShield;
            player.boost = cachedStats.boostMax;
            player.energy = cachedStats.energyMax;
            noteStatus('Station services applied.');
          } else {
            noteStatus('Insufficient credits for repairs.');
          }
        }
      }
    });
  }

  function maybeAdvanceChapter(bossDefeated = false) {
    const chapter = CHAPTERS[player.chapterIndex];
    if (!chapter) return;
    const bossRequired = player.chapterIndex >= 5;
    if (player.distanceThisChapter < chapter.distanceGoal) return;
    if (bossRequired && !world.bossesDefeated[player.chapterIndex]) return;
    finalizeOptionalChallenges();
    if (player.chapterIndex >= CHAPTERS.length - 1) {
      awardCredits(800, 'Campaign complete');
      noteStatus('Starforge secured. Campaign complete.');
      submitHighScore(GAME_ID, Math.floor(player.distanceTotal));
      state.running = false;
      return;
    }
    entities.enemies.length = 0;
    entities.enemyBullets.length = 0;
    entities.bullets.length = 0;
    player.chapterIndex = Math.min(player.chapterIndex + 1, CHAPTERS.length - 1);
    player.distanceThisChapter = 0;
    player.checkpointIndex = 0;
    resetChapterState();
    setCheckpoint();
    showBriefing();
    awardCredits(300, 'Chapter complete');
    if (bossDefeated) {
      const blueprintKeys = Object.keys(BLUEPRINTS);
      const reward = blueprintKeys[(player.chapterIndex + 2) % blueprintKeys.length];
      if (!player.blueprints.has(reward)) {
        player.blueprints.add(reward);
        refreshStats({ keepRatios: true });
        noteStatus(`Chapter reward: ${BLUEPRINTS[reward].name}`);
      }
    }
  }

  function updateProgress(dt) {
    const speed = Math.hypot(player.vx, player.vy);
    player.distanceThisChapter += speed * dt;
    player.distanceTotal += speed * dt;

    const chapter = CHAPTERS[player.chapterIndex];
    if (!chapter) return;
    const checkpoints = Math.min(3, Math.floor((player.distanceThisChapter / chapter.distanceGoal) * 3));
    if (checkpoints > player.checkpointIndex) {
      player.checkpointIndex = checkpoints;
      setCheckpoint();
      awardCredits(120, 'Checkpoint reached');
    }

    const bossRequired = player.chapterIndex >= 5;
    if (bossRequired && player.distanceThisChapter > chapter.distanceGoal * 0.8 && !world.bossesDefeated[player.chapterIndex]) {
      const bossExists = entities.enemies.some((enemy) => enemy.isBoss);
      if (!bossExists) {
        const angle = Math.random() * Math.PI * 2;
        spawnBoss(player.x + Math.cos(angle) * 320, player.y + Math.sin(angle) * 320);
      }
    }

    maybeAdvanceChapter();
  }

  function update(dt) {
    if (input.justPressed['KeyC']) {
      if (player.energy >= 20) {
        player.energy -= 20;
        state.scanPulse = 2.2;
        noteStatus('Scanner pulse active.');
      } else {
        noteStatus('Insufficient energy for scan.');
      }
    }
    state.scanPulse = Math.max(0, state.scanPulse - dt);
    updatePlayer(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updateDrones(dt);
    updateLoot(dt);
    updateEffects(dt);
    handleCollisions(dt);
    updateProgress(dt);
    updateDifficulty();
    updateStatusTimer(dt);
    updateHud();
    updateUpgradeButtons();
    input.justPressed = {};
  }

  function updateHud() {
    if (hudHp) hudHp.textContent = `Hull: ${Math.round(player.hp)}/${Math.round(cachedStats.maxHp)}`;
    if (hudShield) hudShield.textContent = `Shield: ${Math.round(player.shield)}/${Math.round(cachedStats.maxShield)}`;
    if (hudCredits) hudCredits.textContent = `Credits: ${Math.round(player.credits)}`;
    if (hudChapter) hudChapter.textContent = `Chapter: ${player.chapterIndex + 1}/${CHAPTERS.length}`;
    if (hudCheckpoint) hudCheckpoint.textContent = `Checkpoint: ${player.checkpointIndex}/3`;
    if (hudScore) hudScore.textContent = `Distance: ${Math.floor(player.distanceTotal)}`;
    const chapter = CHAPTERS[player.chapterIndex];
    if (hudObjective && chapter) hudObjective.textContent = `Objective: ${chapter.objective}`;
  }

  function drawBackground(camera) {
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    gradient.addColorStop(0, '#050a14');
    gradient.addColorStop(1, '#0b1a2d');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    STAR_LAYERS.forEach((layer, idx) => {
      ctx.fillStyle = `rgba(180,220,255,${layer.alpha})`;
      starLayers[idx].forEach((star) => {
        const screenX = star.x - camera.x * layer.speed + VIEW.centerX;
        const screenY = star.y - camera.y * layer.speed + VIEW.centerY;
        if (screenX < -10 || screenX > VIEW.width + 10 || screenY < -10 || screenY > VIEW.height + 10) return;
        ctx.beginPath();
        ctx.arc(screenX, screenY, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  function drawSectorFeatures(sector, camera) {
    sector.entities.planets.forEach((planet) => {
      const x = planet.x - camera.x + VIEW.centerX;
      const y = planet.y - camera.y + VIEW.centerY;
      const grad = ctx.createRadialGradient(x - 20, y - 20, planet.radius * 0.2, x, y, planet.radius);
      grad.addColorStop(0, `hsla(${planet.hue},70%,60%,0.9)`);
      grad.addColorStop(1, `hsla(${planet.hue + 20},65%,30%,0.85)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, planet.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    sector.entities.storms.forEach((storm) => {
      const x = storm.x - camera.x + VIEW.centerX;
      const y = storm.y - camera.y + VIEW.centerY;
      ctx.fillStyle = `rgba(90,160,255,${storm.intensity * 0.2})`;
      ctx.beginPath();
      ctx.arc(x, y, storm.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    sector.entities.asteroids.forEach((asteroid) => {
      const x = asteroid.x - camera.x + VIEW.centerX;
      const y = asteroid.y - camera.y + VIEW.centerY;
      ctx.fillStyle = '#283241';
      ctx.beginPath();
      ctx.arc(x, y, asteroid.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(125,252,154,0.15)';
      ctx.stroke();
    });

    sector.entities.stations.forEach((station) => {
      const x = station.x - camera.x + VIEW.centerX;
      const y = station.y - camera.y + VIEW.centerY;
      ctx.strokeStyle = 'rgba(125,252,154,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, station.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(125,252,154,0.12)';
      ctx.fill();
      ctx.lineWidth = 1;
    });

    sector.entities.caches.forEach((cache) => {
      if (world.cacheClaims[sector.key]) return;
      if (state.scanPulse <= 0 && dist(player.x, player.y, cache.x, cache.y) > 140) return;
      const x = cache.x - camera.x + VIEW.centerX;
      const y = cache.y - camera.y + VIEW.centerY;
      ctx.strokeStyle = 'rgba(255,179,71,0.8)';
      ctx.beginPath();
      ctx.arc(x, y, cache.radius + Math.sin(state.time * 2) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,179,71,0.2)';
      ctx.fill();
    });
  }

  function drawEntities(camera) {
    entities.loot.forEach((drop) => {
      const x = drop.x - camera.x + VIEW.centerX;
      const y = drop.y - camera.y + VIEW.centerY;
      ctx.fillStyle = drop.type === 'credits' ? '#ffd166' : drop.type === 'data' ? '#6df0ff' : '#7dfc9a';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    entities.bullets.forEach((bullet) => {
      const x = bullet.x - camera.x + VIEW.centerX;
      const y = bullet.y - camera.y + VIEW.centerY;
      ctx.fillStyle = bullet.color;
      ctx.beginPath();
      ctx.arc(x, y, bullet.splash ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
    });

    entities.enemyBullets.forEach((bullet) => {
      const x = bullet.x - camera.x + VIEW.centerX;
      const y = bullet.y - camera.y + VIEW.centerY;
      ctx.fillStyle = bullet.color;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    entities.enemies.forEach((enemy) => {
      const x = enemy.x - camera.x + VIEW.centerX;
      const y = enemy.y - camera.y + VIEW.centerY;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(enemy.angle || 0);
      ctx.fillStyle = enemy.isBoss ? '#ffb347' : enemy.def?.color || '#ff6b6b';
      ctx.beginPath();
      if (enemy.isBoss) {
        ctx.moveTo(0, -enemy.size);
        ctx.lineTo(enemy.size * 0.9, enemy.size);
        ctx.lineTo(-enemy.size * 0.9, enemy.size);
      } else {
        ctx.moveTo(0, -enemy.size);
        ctx.lineTo(enemy.size * 0.7, enemy.size);
        ctx.lineTo(-enemy.size * 0.7, enemy.size);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    entities.drones.forEach((drone) => {
      const x = drone.x - camera.x + VIEW.centerX;
      const y = drone.y - camera.y + VIEW.centerY;
      ctx.fillStyle = drone.type === 'attack' ? '#c77dff' : '#6df0ff';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    entities.effects.forEach((effect) => {
      const x = effect.x - camera.x + VIEW.centerX;
      const y = effect.y - camera.y + VIEW.centerY;
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = Math.max(0, effect.life * 2);
      ctx.beginPath();
      ctx.arc(x, y, effect.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
    });

    const px = player.x - camera.x + VIEW.centerX;
    const py = player.y - camera.y + VIEW.centerY;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(player.angle + Math.PI / 2);
    ctx.fillStyle = '#7dfc9a';
    ctx.beginPath();
    ctx.moveTo(0, -cachedStats.size * 1.3);
    ctx.lineTo(cachedStats.size * 0.9, cachedStats.size * 1.2);
    ctx.lineTo(-cachedStats.size * 0.9, cachedStats.size * 1.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (player.shield > 0) {
      ctx.strokeStyle = 'rgba(109,240,255,0.4)';
      ctx.beginPath();
      ctx.arc(px, py, cachedStats.size + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawMiniMap(camera) {
    const mapSize = 120;
    const padding = 12;
    const mapX = VIEW.width - mapSize - padding;
    const mapY = padding;
    ctx.fillStyle = 'rgba(5,10,18,0.7)';
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeStyle = 'rgba(125,252,154,0.4)';
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);

    for (let sx = 0; sx <= WORLD.maxSector; sx += 1) {
      for (let sy = 0; sy <= WORLD.maxSector; sy += 1) {
        const key = sectorKey(sx, sy);
        const cellX = mapX + (sx / (WORLD.maxSector + 1)) * mapSize;
        const cellY = mapY + (sy / (WORLD.maxSector + 1)) * mapSize;
        ctx.fillStyle = world.discovered.has(key) ? 'rgba(125,252,154,0.6)' : 'rgba(80,90,110,0.4)';
        ctx.fillRect(cellX + 2, cellY + 2, 6, 6);
      }
    }

    const px = mapX + ((player.x + WORLD.half) / WORLD.size) * mapSize;
    const py = mapY + ((player.y + WORLD.half) / WORLD.size) * mapSize;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function render() {
    const camera = { x: player.x, y: player.y };
    drawBackground(camera);
    const sector = getSectorAtPlayer();
    drawSectorFeatures(sector, camera);
    drawEntities(camera);
    drawMiniMap(camera);
  }

  function tick(timestamp) {
    if (!state.lastFrame) state.lastFrame = timestamp;
    const dt = Math.min(0.05, (timestamp - state.lastFrame) / 1000);
    state.lastFrame = timestamp;
    state.time += dt;

    if (state.running && !state.paused) {
      update(dt);
      state.lastSaveAt += dt;
      state.lastCloudAt += dt;
      if (state.lastSaveAt > 60) {
        state.lastSaveAt = 0;
        saveLocal();
      }
      if (state.lastCloudAt > 90) {
        state.lastCloudAt = 0;
        pushCloudSave();
      }
    } else {
      updateStatusTimer(dt);
    }

    render();
    state.frameId = requestAnimationFrame(tick);
  }

  function updateUpgradeButtons() {
    upgradeButtons.forEach((btn) => {
      const id = btn.dataset.swarmUpgrade;
      const def = UPGRADE_DEFS[id];
      if (!def) return;
      const level = player.upgrades[id] || 0;
      const cost = Math.round(def.baseCost * Math.pow(1.5, level));
      if (level >= def.max) {
        btn.textContent = `${def.label} (MAX)`;
        btn.disabled = true;
      } else {
        btn.textContent = `${def.label} Lv.${level + 1} - ${cost}`;
        btn.disabled = player.credits < cost;
      }
    });
  }

  function purchaseUpgrade(id) {
    const def = UPGRADE_DEFS[id];
    if (!def) return;
    const level = player.upgrades[id] || 0;
    if (level >= def.max) return;
    const cost = Math.round(def.baseCost * Math.pow(1.5, level));
    if (player.credits < cost) {
      noteStatus('Insufficient credits.');
      return;
    }
    player.credits -= cost;
    player.upgrades[id] = level + 1;
    refreshStats({ keepRatios: true });
    spawnDrones();
    updateUpgradeButtons();
    noteStatus(`${def.label} upgraded.`);
  }

  function showBriefing() {
    const chapter = CHAPTERS[player.chapterIndex];
    if (!chapter || !briefing) return;
    if (briefKicker) briefKicker.textContent = `Chapter ${chapter.id}`;
    if (briefTitle) briefTitle.textContent = chapter.title;
    if (briefBody) briefBody.textContent = chapter.brief;
    if (briefPrimary) briefPrimary.textContent = chapter.objective;
    if (briefOptional) {
      briefOptional.innerHTML = '';
      chapter.optional.forEach((opt) => {
        const li = document.createElement('li');
        li.textContent = opt.text;
        briefOptional.appendChild(li);
      });
    }
    briefing.classList.add('active');
    state.awaitingBrief = true;
    state.paused = true;
  }

  function hideBriefing() {
    if (!briefing) return;
    briefing.classList.remove('active');
    state.awaitingBrief = false;
    state.paused = false;
  }

  function saveLocal() {
    const save = {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      player: {
        x: player.x,
        y: player.y,
        hp: player.hp,
        shield: player.shield,
        boost: player.boost,
        energy: player.energy,
        hullSize: player.hullSize,
        credits: player.credits,
        upgrades: player.upgrades,
        blueprints: Array.from(player.blueprints),
        skins: player.skins,
        toys: player.toys,
        chapterIndex: player.chapterIndex,
        distanceThisChapter: player.distanceThisChapter,
        distanceTotal: player.distanceTotal,
        checkpointIndex: player.checkpointIndex
      },
      world: {
        discovered: Array.from(world.discovered),
        cacheClaims: world.cacheClaims,
        bossesDefeated: world.bossesDefeated
      },
      checkpoint: state.checkpoint
    };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (err) {
      console.warn('Save failed', err);
    }
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const save = JSON.parse(raw);
      if (!save || save.version !== SAVE_VERSION) return null;
      return save;
    } catch (err) {
      console.warn('Load failed', err);
      return null;
    }
  }

  function applySave(save) {
    if (!save) return;
    const savedPlayer = save.player || {};
    player.x = savedPlayer.x ?? player.x;
    player.y = savedPlayer.y ?? player.y;
    player.hp = savedPlayer.hp ?? player.hp;
    player.shield = savedPlayer.shield ?? player.shield;
    player.boost = savedPlayer.boost ?? player.boost;
    player.energy = savedPlayer.energy ?? player.energy;
    player.hullSize = HULL_SIZES[savedPlayer.hullSize] ? savedPlayer.hullSize : player.hullSize;
    player.credits = savedPlayer.credits ?? player.credits;
    player.upgrades = { ...player.upgrades, ...(savedPlayer.upgrades || {}) };
    player.blueprints = new Set(savedPlayer.blueprints || []);
    player.skins = savedPlayer.skins || [];
    player.toys = savedPlayer.toys || [];
    player.chapterIndex = savedPlayer.chapterIndex ?? player.chapterIndex;
    player.distanceThisChapter = savedPlayer.distanceThisChapter ?? player.distanceThisChapter;
    player.distanceTotal = savedPlayer.distanceTotal ?? player.distanceTotal;
    player.checkpointIndex = savedPlayer.checkpointIndex ?? player.checkpointIndex;

    world.discovered = new Set(save.world?.discovered || []);
    world.cacheClaims = save.world?.cacheClaims || {};
    world.bossesDefeated = save.world?.bossesDefeated || {};

    state.checkpoint = save.checkpoint || state.checkpoint;

    refreshStats({ keepRatios: true });
    spawnDrones();
    updateDifficulty();
    resetChapterState();
    state.awaitingBrief = false;
    state.paused = false;
  }

  async function pullCloudSave() {
    if (!hasFirebaseConfig()) {
      if (authNote) authNote.textContent = 'Cloud sync unavailable.';
      return;
    }
    const user = await waitForAuth();
    if (!user) {
      if (authNote) authNote.textContent = 'Sign in for cloud sync.';
      return;
    }
    state.cloudReady = true;
    if (authNote) authNote.textContent = 'Cloud sync ready.';
    try {
      const docRef = doc(db, 'gameSaves', `${user.uid}_swarmBreaker`);
      const snap = await getDoc(docRef);
      if (!snap.exists()) return;
      const cloud = snap.data();
      const cloudSave = cloud?.data;
      const cloudUpdated = cloud?.clientUpdatedAt || 0;
      const local = loadLocal();
      const localUpdated = local?.savedAt || 0;
      if (cloudSave && cloudUpdated > localUpdated) {
        applySave(cloudSave);
        noteStatus('Cloud save loaded.');
      }
    } catch (err) {
      console.warn('Cloud sync failed', err);
    }
  }

  async function pushCloudSave() {
    if (!state.cloudReady) return;
    const user = await waitForAuth();
    if (!user) return;
    const save = loadLocal();
    if (!save) return;
    try {
      const docRef = doc(db, 'gameSaves', `${user.uid}_swarmBreaker`);
      await setDoc(docRef, {
        uid: user.uid,
        gameId: GAME_ID,
        data: save,
        clientUpdatedAt: save.savedAt,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (err) {
      console.warn('Cloud save push failed', err);
    }
  }

  function bindInputs() {
    if (window.__swarmBound) return;
    window.__swarmBound = true;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      input.keys[e.code] = true;
      input.justPressed[e.code] = true;
    });
    window.addEventListener('keyup', (e) => {
      input.keys[e.code] = false;
    });
    window.addEventListener('blur', () => {
      input.keys = {};
      input.justPressed = {};
    });
  }

  function handleStart() {
    if (state.awaitingBrief) {
      noteStatus('Review the briefing and press Begin Chapter.');
      return;
    }
    if (!state.running) {
      state.running = true;
      state.paused = false;
      if (!state.frameId) state.frameId = requestAnimationFrame(tick);
      noteStatus('Engines online.');
    } else if (state.paused) {
      state.paused = false;
      noteStatus('Resumed.');
    }
  }

  function handlePause() {
    if (!state.running) return;
    if (state.awaitingBrief) return;
    state.paused = !state.paused;
    noteStatus(state.paused ? 'Paused.' : 'Resumed.');
  }

  function handleReset() {
    resetRun({ full: false });
    saveLocal();
  }

  function initSwarm() {
    bindInputs();
    if (!window.__swarmUiBound) {
      window.__swarmUiBound = true;
      if (startBtn) startBtn.addEventListener('click', handleStart);
      if (pauseBtn) pauseBtn.addEventListener('click', handlePause);
      if (resetBtn) resetBtn.addEventListener('click', handleReset);
      if (briefLaunch) briefLaunch.addEventListener('click', () => {
        hideBriefing();
        if (!state.running) handleStart();
      });

      upgradeButtons.forEach((btn) => {
        btn.addEventListener('click', () => purchaseUpgrade(btn.dataset.swarmUpgrade));
      });
    }

    const localSave = loadLocal();
    if (localSave) {
      applySave(localSave);
      noteStatus('Local save loaded.');
    } else {
      resetRun({ full: true });
    }

    getHighScore(GAME_ID).then((score) => {
      state.bestDistance = score || 0;
      if (score) noteStatus(`Best distance: ${score}`);
    });

    pullCloudSave();
    spawnDrones();
    updateUpgradeButtons();
    updateHud();

    if (!state.frameId) state.frameId = requestAnimationFrame(tick);
  }

  function stopSwarm() {
    state.running = false;
    state.paused = false;
    if (state.frameId) cancelAnimationFrame(state.frameId);
    state.frameId = null;
    saveLocal();
  }

  window.addEventListener('beforeunload', () => saveLocal());

  window.initSwarm = initSwarm;
  window.stopSwarm = stopSwarm;
})();
