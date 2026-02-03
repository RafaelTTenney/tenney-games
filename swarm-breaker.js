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

  const GAME_ID = 'spacex-exploration-flagship';
  const SAVE_VERSION = 6;
  const SAVE_KEY = `swarmBreakerSave_v${SAVE_VERSION}`;
  const WORLD_SEED = 284113;

  const WORLD = {
    sectorSize: 900,
    gridRadius: 7,
    maxDepth: 7
  };
  WORLD.size = (WORLD.gridRadius * 2 + 1) * WORLD.sectorSize;
  WORLD.half = WORLD.size / 2;
  WORLD.boundary = WORLD.gridRadius * WORLD.sectorSize + WORLD.sectorSize * 0.4;

  const PALETTE = {
    ink: '#04070d',
    deep: '#0b1423',
    glow: '#7dfc9a',
    ember: '#ffb347',
    rose: '#ff6b6b',
    ice: '#6df0ff',
    violet: '#c77dff',
    gold: '#ffd166',
    steel: '#283241'
  };

  const BIOMES = {
    driftline: { name: 'Driftline', hue: 185, accent: '#6df0ff', fog: 'rgba(60,110,140,0.12)', dust: 'rgba(110,200,255,0.14)', threat: 0.85 },
    glasswake: { name: 'Glasswake', hue: 210, accent: '#7dfc9a', fog: 'rgba(70,140,180,0.12)', dust: 'rgba(140,220,255,0.12)', threat: 1.05 },
    stormvault: { name: 'Stormvault', hue: 260, accent: '#c77dff', fog: 'rgba(130,90,190,0.16)', dust: 'rgba(180,120,255,0.12)', threat: 1.25 },
    redshift: { name: 'Redshift', hue: 20, accent: '#ff8b5c', fog: 'rgba(180,80,60,0.14)', dust: 'rgba(255,160,120,0.12)', threat: 1.4 },
    bastion: { name: 'Bastion', hue: 135, accent: '#7dfc9a', fog: 'rgba(80,140,100,0.12)', dust: 'rgba(120,230,160,0.12)', threat: 1.55 },
    darklane: { name: 'Darklane', hue: 240, accent: '#8899ff', fog: 'rgba(70,80,150,0.18)', dust: 'rgba(120,140,220,0.12)', threat: 1.7 },
    starforge: { name: 'Starforge', hue: 45, accent: '#ffd166', fog: 'rgba(220,170,90,0.12)', dust: 'rgba(255,210,140,0.12)', threat: 1.9 }
  };

  const HULLS = {
    small: { id: 'small', label: 'Small Hull', baseHp: 110, baseShield: 80, size: 14, mass: 0.95, unlockLevel: 1 },
    medium: { id: 'medium', label: 'Medium Hull', baseHp: 150, baseShield: 110, size: 18, mass: 1.1, unlockLevel: 3 },
    large: { id: 'large', label: 'Large Hull', baseHp: 200, baseShield: 150, size: 24, mass: 1.3, unlockLevel: 6 }
  };

  const ENGINES = {
    standard: { id: 'standard', label: 'Standard Pack', thrust: 420, reverse: 260, maxSpeed: 320, turnRate: 0.0056, boostRegen: 24 },
    turbo: { id: 'turbo', label: 'Turbo Pack', thrust: 475, reverse: 290, maxSpeed: 360, turnRate: 0.0059, boostRegen: 28 },
    hyper: { id: 'hyper', label: 'Hyper Pack', thrust: 530, reverse: 320, maxSpeed: 405, turnRate: 0.0064, boostRegen: 32 }
  };

  const SHIELDS = {
    standard: { id: 'standard', label: 'Standard Array', regen: 24, delay: 1.2, capacityBonus: 0 },
    overdrive: { id: 'overdrive', label: 'Overdrive Array', regen: 22, delay: 1.1, capacityBonus: 0.18 },
    nanofiber: { id: 'nanofiber', label: 'Nanofiber Array', regen: 30, delay: 0.9, capacityBonus: 0.12 }
  };

  const DRONE_BAYS = {
    basic: { id: 'basic', label: 'Basic Bay', count: 2 },
    advanced: { id: 'advanced', label: 'Advanced Bay', count: 3 },
    swarm: { id: 'swarm', label: 'Swarm Bay', count: 5 }
  };

  const WEAPONS = {
    laser: { id: 'laser', label: 'Laser Blaster', slot: 'primary', damage: 12, cooldown: 0.14, speed: 980, energy: 0, color: '#7dfc9a', hitscan: true },
    plasma: { id: 'plasma', label: 'Plasma Cannon', slot: 'secondary', damage: 36, cooldown: 0.9, speed: 520, energy: 28, color: '#ffb347', splash: 52 },
    missile: { id: 'missile', label: 'Missile Rack', slot: 'secondary', damage: 44, cooldown: 1.25, speed: 420, energy: 24, color: '#ff6b6b', homing: true, turn: 2.2 },
    emp: { id: 'emp', label: 'EMP Burst', slot: 'secondary', damage: 18, cooldown: 1.4, speed: 780, energy: 35, color: '#6df0ff', emp: 1.0 }
  };

  const BASE = {
    boostMax: 120,
    boostRegen: 22,
    energyMax: 100,
    energyRegen: 18
  };

  const UPGRADE_DEFS = {
    engine: { label: 'Engine Output', max: 5, baseCost: 240 },
    blaster: { label: 'Weapon Pods', max: 5, baseCost: 260 },
    capacitor: { label: 'Capacitor', max: 4, baseCost: 230 },
    shield: { label: 'Shield Core', max: 4, baseCost: 250 },
    hull: { label: 'Hull Plating', max: 4, baseCost: 280 },
    booster: { label: 'Afterburner', max: 3, baseCost: 260 }
  };

  const BLUEPRINTS = {
    shield_overdrive: { id: 'shield_overdrive', name: 'Shield Overdrive', unlock: { shield: 'overdrive' }, effect: { shieldMult: 1.2 } },
    turbo_engine: { id: 'turbo_engine', name: 'Turbo Engine', unlock: { engine: 'turbo' }, effect: { speedMult: 1.08, thrustMult: 1.08 } },
    hyper_engine: { id: 'hyper_engine', name: 'Hyper Engine', unlock: { engine: 'hyper' }, effect: { speedMult: 1.15, thrustMult: 1.12 } },
    plasma_cannon: { id: 'plasma_cannon', name: 'Plasma Cannon', unlock: { weapon: 'plasma' }, effect: { damageMult: 1.08 } },
    missile_rack: { id: 'missile_rack', name: 'Missile Rack', unlock: { weapon: 'missile' }, effect: { damageMult: 1.04 } },
    emp_burst: { id: 'emp_burst', name: 'EMP Burst', unlock: { weapon: 'emp' }, effect: { empBonus: 0.2 } },
    drone_swarm: { id: 'drone_swarm', name: 'Drone Swarm', unlock: { drone: 'swarm' }, effect: { droneBonus: 2 } },
    nanofiber_shield: { id: 'nanofiber_shield', name: 'Nanofiber Shield', unlock: { shield: 'nanofiber' }, effect: { shieldRegenMult: 1.15 } },
    hull_reinforce: { id: 'hull_reinforce', name: 'Hull Reinforcement', unlock: {}, effect: { hullMult: 1.12 } },
    scanner_drone: { id: 'scanner_drone', name: 'Scanner Drone', unlock: { toy: 'scanner' }, effect: { scanRange: 1.2 } }
  };

  const STORE_ITEMS = [
    { id: 'boost_pack', name: 'Boost Pack', type: 'consumable', price: 120, effect: { boost: 45 }, category: 'Boosts' },
    { id: 'energy_cell', name: 'Energy Cell', type: 'consumable', price: 140, effect: { energy: 45 }, category: 'Boosts' },
    { id: 'repair_kit', name: 'Repair Kit', type: 'consumable', price: 170, effect: { hp: 45 }, category: 'Boosts' },
    { id: 'nebula_skin', name: 'Nebula Skin', type: 'cosmetic', price: 420, effect: { cosmetic: 'nebula' }, category: 'Skins' },
    { id: 'ember_skin', name: 'Ember Skin', type: 'cosmetic', price: 420, effect: { cosmetic: 'ember' }, category: 'Skins' }
  ];

  const ENEMY_TYPES = {
    scout: { role: 'scout', hp: 22, speed: 150, fireRate: 1.4, damage: 6, size: 12, color: '#6df0ff' },
    fighter: { role: 'fighter', hp: 42, speed: 120, fireRate: 1.2, damage: 10, size: 16, color: '#ffb347' },
    bomber: { role: 'bomber', hp: 75, speed: 90, fireRate: 1.8, damage: 16, size: 22, color: '#ff6b6b' },
    sniper: { role: 'sniper', hp: 34, speed: 110, fireRate: 2.3, damage: 18, size: 14, color: '#c77dff' },
    turret: { role: 'turret', hp: 95, speed: 0, fireRate: 1.6, damage: 14, size: 24, color: '#8899ff', static: true }
  };

  const STORY = [
    {
      id: 1,
      title: 'Driftline Exodus',
      kicker: 'Aetherline Initiative',
      intro: 'You leave the Tenney Belt with a cracked nav core. The Driftline is unstable, but the first relay must come back online.',
      objective: 'Reach the Driftline relay gate.',
      depth: 1,
      goal: { type: 'reach_gate' },
      optional: [
        { id: 'c1-a', type: 'kills', enemy: 'scout', target: 8, reward: 160, text: 'Destroy 8 scouts.' },
        { id: 'c1-b', type: 'noHullDamage', reward: 200, text: 'Reach the relay without hull damage.' }
      ]
    },
    {
      id: 2,
      title: 'Glasswake Run',
      kicker: 'Signal Archives',
      intro: 'A debris river cuts the route to the next gate. Your scanners show data caches hidden in the wake.',
      objective: 'Collect 4 data shards in Glasswake.',
      depth: 2,
      goal: { type: 'collect', target: 4 },
      optional: [
        { id: 'c2-a', type: 'collect', target: 4, reward: 220, text: 'Collect 4 data shards.' },
        { id: 'c2-b', type: 'kills', enemy: 'fighter', target: 5, reward: 180, text: 'Disable 5 fighters.' }
      ]
    },
    {
      id: 3,
      title: 'Signal Thief',
      kicker: 'Relay Security',
      intro: 'Pirates have latched onto the relay. Dislodge them before the signal degrades further.',
      objective: 'Disable 12 pirate ships.',
      depth: 3,
      goal: { type: 'kills', target: 12 },
      optional: [
        { id: 'c3-a', type: 'kills', enemy: 'fighter', target: 7, reward: 240, text: 'Disable 7 fighters.' },
        { id: 'c3-b', type: 'shieldAtEnd', target: 60, reward: 220, text: 'Finish with at least 60 shield.' }
      ]
    },
    {
      id: 4,
      title: 'Stormvault',
      kicker: 'Ion Clade',
      intro: 'Ion storms scramble everything. The vault lane is the only safe corridor, but it is heavily patrolled.',
      objective: 'Reach the Stormvault relay gate.',
      depth: 4,
      goal: { type: 'reach_gate' },
      optional: [
        { id: 'c4-a', type: 'noBoost', reward: 220, text: 'Reach the midpoint without boost.' },
        { id: 'c4-b', type: 'collect', target: 5, reward: 240, text: 'Collect 5 data shards.' }
      ]
    },
    {
      id: 5,
      title: 'Redshift Pursuit',
      kicker: 'Pursuit Command',
      intro: 'An enemy cruiser has leapt ahead. Hold the pursuit line through the redshift tides.',
      objective: 'Cover 24,000 km in Redshift space.',
      depth: 5,
      goal: { type: 'distance', target: 24000 },
      optional: [
        { id: 'c5-a', type: 'kills', enemy: 'bomber', target: 4, reward: 240, text: 'Destroy 4 bombers.' },
        { id: 'c5-b', type: 'noHullDamage', reward: 220, text: 'Reach the redshift gate without hull damage.' }
      ]
    },
    {
      id: 6,
      title: 'Bastion Cross',
      kicker: 'Defense Lattice',
      intro: 'Automated bastion platforms guard the cross. Disable them before they lock the gate.',
      objective: 'Disable 14 bastion defenders.',
      depth: 6,
      goal: { type: 'kills', target: 14 },
      optional: [
        { id: 'c6-a', type: 'kills', enemy: 'turret', target: 4, reward: 260, text: 'Destroy 4 bastion turrets.' },
        { id: 'c6-b', type: 'collect', target: 6, reward: 240, text: 'Collect 6 data shards.' }
      ]
    },
    {
      id: 7,
      title: 'Darklane Refuge',
      kicker: 'Refuge Convoy',
      intro: 'Nebula shadows hide a refugee convoy. Protect them without drawing the full pursuit.',
      objective: 'Reach Darklane relay gate.',
      depth: 7,
      goal: { type: 'reach_gate' },
      optional: [
        { id: 'c7-a', type: 'kills', enemy: 'scout', target: 10, reward: 260, text: 'Destroy 10 scouts.' },
        { id: 'c7-b', type: 'noBoost', reward: 240, text: 'Finish without boost.' }
      ]
    },
    {
      id: 8,
      title: 'Starforge Arrival',
      kicker: 'Starforge Authority',
      intro: 'The final gate opens into a shipyard of myth. The guardian AI remains online. You must reclaim the forge.',
      objective: 'Defeat the Starforge Guardian.',
      depth: 7,
      goal: { type: 'boss' },
      optional: [
        { id: 'c8-a', type: 'kills', enemy: 'bomber', target: 6, reward: 300, text: 'Destroy 6 bombers.' },
        { id: 'c8-b', type: 'shieldAtEnd', target: 70, reward: 260, text: 'Finish with 70 shield.' }
      ]
    }
  ];

  const state = {
    running: false,
    paused: false,
    mode: 'briefing',
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
    scanPulse: 0,
    scanRadius: 540,
    mapOpen: false,
    storyLog: [],
    menuSelection: 0,
    unlockedDepth: 1,
    currentSectorKey: '0,0',
    cameraShake: 0,
    cameraShakeTimer: 0,
    cameraNoiseSeed: Math.random() * 10,
    shiftBoost: { active: false, timer: 0 },
    prompt: null
  };

  const world = {
    sectors: new Map(),
    gates: {},
    discovered: new Set(),
    bossDefeated: {},
    stationContracts: {}
  };

  const entities = {
    enemies: [],
    projectiles: [],
    beams: [],
    enemyShots: [],
    drones: [],
    loot: [],
    effects: [],
    particles: []
  };

  const player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    hp: 120,
    shield: 90,
    boost: BASE.boostMax,
    energy: BASE.energyMax,
    lastShot: 0,
    lastAltShot: 0,
    lastHit: 0,
    credits: 0,
    level: 1,
    distanceThisChapter: 0,
    distanceTotal: 0,
    chapterIndex: 0,
    checkpointIndex: 0,
    modules: {
      hullSize: 'small',
      enginePack: 'standard',
      shieldArray: 'standard',
      droneBay: 'basic'
    },
    weapons: {
      primary: 'laser',
      secondary: 'plasma'
    },
    upgrades: {
      engine: 0,
      blaster: 0,
      capacitor: 0,
      shield: 0,
      hull: 0,
      booster: 0
    },
    unlocked: {
      hulls: ['small'],
      engines: ['standard'],
      shields: ['standard'],
      drones: ['basic'],
      weapons: ['laser', 'plasma'],
      toys: []
    },
    inventory: {
      credits: 0,
      blueprints: [],
      skins: ['nebula'],
      toys: []
    },
    cosmetics: new Set(),
    blueprints: new Set(),
    toys: new Set()
  };

  const mission = {
    active: false,
    type: '',
    target: 0,
    progress: 0,
    reward: 0,
    text: '',
    gateKey: ''
  };

  const contract = {
    active: false,
    type: '',
    target: 0,
    progress: 0,
    reward: 0,
    text: ''
  };

  const missionTracker = {
    optional: new Map(),
    noHullDamage: true,
    noBoost: true,
    dataShards: 0
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

  function dist(ax, ay, bx, by) {
    return Math.hypot(bx - ax, by - ay);
  }

  function normalize(x, y) {
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  function sCurve(t) {
    return t * t * (3 - 2 * t);
  }

  function noise2D(x, y, seed) {
    const s = Math.sin(x * 12.9898 + y * 78.233 + seed * 43758.5453) * 43758.5453;
    return s - Math.floor(s);
  }

  function smoothNoise(x, y, seed) {
    const x0 = Math.floor(x);
    const x1 = x0 + 1;
    const y0 = Math.floor(y);
    const y1 = y0 + 1;
    const sx = sCurve(x - x0);
    const sy = sCurve(y - y0);
    const n00 = noise2D(x0, y0, seed);
    const n10 = noise2D(x1, y0, seed);
    const n01 = noise2D(x0, y1, seed);
    const n11 = noise2D(x1, y1, seed);
    const ix0 = lerp(n00, n10, sx);
    const ix1 = lerp(n01, n11, sx);
    return lerp(ix0, ix1, sy);
  }

  function fractalNoise(x, y, seed) {
    let value = 0;
    let amp = 0.6;
    let freq = 0.9;
    for (let i = 0; i < 4; i += 1) {
      value += smoothNoise(x * freq, y * freq, seed + i * 19) * amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    return value;
  }

  function createNebulaLayer({ seed, hue, alpha = 0.4, size = 1024 }) {
    const off = document.createElement('canvas');
    off.width = size;
    off.height = size;
    const octx = off.getContext('2d');
    const gradient = octx.createRadialGradient(size * 0.5, size * 0.5, size * 0.2, size * 0.5, size * 0.5, size * 0.7);
    gradient.addColorStop(0, `hsla(${hue},70%,35%,0.6)`);
    gradient.addColorStop(1, `hsla(${hue + 20},70%,12%,0)`);
    octx.fillStyle = gradient;
    octx.fillRect(0, 0, size, size);

    const image = octx.getImageData(0, 0, size, size);
    for (let y = 0; y < size; y += 2) {
      for (let x = 0; x < size; x += 2) {
        const n = fractalNoise(x / 140, y / 140, seed);
        const idx = (y * size + x) * 4;
        const alphaValue = n * 255 * 0.45;
        image.data[idx] = Math.min(255, image.data[idx] + n * 60);
        image.data[idx + 1] = Math.min(255, image.data[idx + 1] + n * 30);
        image.data[idx + 2] = Math.min(255, image.data[idx + 2] + n * 80);
        image.data[idx + 3] = Math.min(255, image.data[idx + 3] + alphaValue);
      }
    }
    octx.putImageData(image, 0, 0);

    return { canvas: off, alpha, hue, size };
  }

  function createStarLayer({ seed, count, sizeMin, sizeMax, speed, tint }) {
    const rng = mulberry32(seed);
    return {
      speed,
      tint,
      stars: Array.from({ length: count }).map(() => ({
        x: rng() * WORLD.size - WORLD.half,
        y: rng() * WORLD.size - WORLD.half,
        size: randRange(rng, sizeMin, sizeMax),
        alpha: randRange(rng, 0.3, 1),
        twinkle: randRange(rng, 0.4, 1.4)
      }))
    };
  }

  function createDustField({ seed, count }) {
    const rng = mulberry32(seed);
    return Array.from({ length: count }).map(() => ({
      x: rng() * WORLD.size - WORLD.half,
      y: rng() * WORLD.size - WORLD.half,
      size: randRange(rng, 10, 32),
      alpha: randRange(rng, 0.08, 0.22)
    }));
  }

  const nebulaLayers = [
    createNebulaLayer({ seed: 1201, hue: 200, alpha: 0.45 }),
    createNebulaLayer({ seed: 1402, hue: 240, alpha: 0.35 }),
    createNebulaLayer({ seed: 1603, hue: 320, alpha: 0.25 })
  ];

  const starLayers = [
    createStarLayer({ seed: 2201, count: 280, sizeMin: 0.4, sizeMax: 1.4, speed: 0.4, tint: 'rgba(180,220,255,0.7)' }),
    createStarLayer({ seed: 2301, count: 200, sizeMin: 0.7, sizeMax: 1.9, speed: 0.65, tint: 'rgba(140,210,255,0.75)' }),
    createStarLayer({ seed: 2401, count: 120, sizeMin: 1.2, sizeMax: 2.8, speed: 0.95, tint: 'rgba(120,180,255,0.85)' })
  ];

  const dustField = createDustField({ seed: 3001, count: 90 });

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

  function sectorKey(gx, gy) {
    return `${gx},${gy}`;
  }

  function depthFromGrid(gx, gy) {
    return Math.max(Math.abs(gx), Math.abs(gy));
  }

  function gridFromPos(x, y) {
    const half = WORLD.sectorSize / 2;
    const gx = clamp(Math.floor((x + half) / WORLD.sectorSize), -WORLD.gridRadius, WORLD.gridRadius);
    const gy = clamp(Math.floor((y + half) / WORLD.sectorSize), -WORLD.gridRadius, WORLD.gridRadius);
    return { gx, gy };
  }

  function posFromGrid(gx, gy) {
    return { x: gx * WORLD.sectorSize, y: gy * WORLD.sectorSize };
  }

  function pickBiome(depth) {
    if (depth <= 1) return 'driftline';
    if (depth === 2) return 'glasswake';
    if (depth === 3) return 'stormvault';
    if (depth === 4) return 'redshift';
    if (depth === 5) return 'bastion';
    if (depth === 6) return 'darklane';
    return 'starforge';
  }

  function buildGateMap() {
    const rng = mulberry32(WORLD_SEED);
    const gates = {};
    STORY.forEach((chapter) => {
      const depth = Math.min(WORLD.maxDepth, chapter.depth);
      const ring = [];
      for (let gx = -depth; gx <= depth; gx += 1) {
        for (let gy = -depth; gy <= depth; gy += 1) {
          if (depthFromGrid(gx, gy) !== depth) continue;
          ring.push({ gx, gy });
        }
      }
      const pick = ring[Math.floor(rng() * ring.length)];
      gates[chapter.id] = sectorKey(pick.gx, pick.gy);
    });
    world.gates = gates;
  }

  function getSector(gx, gy) {
    const key = sectorKey(gx, gy);
    if (world.sectors.has(key)) return world.sectors.get(key);
    const depth = depthFromGrid(gx, gy);
    const biome = pickBiome(depth);
    const sector = {
      key,
      gx,
      gy,
      depth,
      biome,
      discovered: false,
      locked: depth > state.unlockedDepth,
      revealedUntil: 0,
      gateChapter: Object.entries(world.gates).find(([chapterId, gateKey]) => gateKey === key)?.[0] || null,
      spawnTimer: 0,
      threat: 1 + depth * 0.2,
      objects: {
        asteroids: [],
        planets: [],
        stations: [],
        caches: [],
        storms: [],
        anomalies: []
      }
    };
    generateSectorObjects(sector);
    world.sectors.set(key, sector);
    return sector;
  }

  function generateAsteroidShape(rng, radius) {
    const points = [];
    const steps = 10 + Math.floor(rng() * 8);
    for (let i = 0; i < steps; i += 1) {
      const angle = (Math.PI * 2 * i) / steps;
      const jitter = randRange(rng, -0.35, 0.35) * radius;
      points.push({
        x: Math.cos(angle) * (radius + jitter),
        y: Math.sin(angle) * (radius + jitter)
      });
    }
    return points;
  }

  function generateSectorObjects(sector) {
    const seed = WORLD_SEED + sector.gx * 991 + sector.gy * 1999;
    const rng = mulberry32(Math.abs(seed));
    const biome = BIOMES[sector.biome];
    const center = posFromGrid(sector.gx, sector.gy);

    const asteroidCount = Math.floor(randRange(rng, 8, 22) * biome.threat);
    for (let i = 0; i < asteroidCount; i += 1) {
      const radius = randRange(rng, 18, 58);
      sector.objects.asteroids.push({
        x: center.x + randRange(rng, -360, 360),
        y: center.y + randRange(rng, -360, 360),
        radius,
        points: generateAsteroidShape(rng, radius)
      });
    }

    if (rng() < 0.35) {
      sector.objects.planets.push({
        x: center.x + randRange(rng, -420, 420),
        y: center.y + randRange(rng, -420, 420),
        radius: randRange(rng, 60, 140),
        hue: randRange(rng, biome.hue - 20, biome.hue + 40)
      });
    }

    if (rng() < 0.4) {
      sector.objects.stations.push({
        x: center.x + randRange(rng, -200, 200),
        y: center.y + randRange(rng, -200, 200),
        radius: randRange(rng, 42, 60)
      });
    }

    if (rng() < 0.35 && !world.cacheClaims?.[sector.key]) {
      sector.objects.caches.push({
        x: center.x + randRange(rng, -300, 300),
        y: center.y + randRange(rng, -300, 300),
        radius: 18,
        blueprint: pickRandomBlueprint(rng)
      });
    }

    if (rng() < 0.45) {
      sector.objects.storms.push({
        x: center.x + randRange(rng, -320, 320),
        y: center.y + randRange(rng, -320, 320),
        radius: randRange(rng, 120, 220),
        intensity: randRange(rng, 0.3, 0.7)
      });
    }

    if (rng() < 0.32) {
      sector.objects.anomalies.push({
        x: center.x + randRange(rng, -280, 280),
        y: center.y + randRange(rng, -280, 280),
        radius: randRange(rng, 40, 70),
        charge: 0
      });
    }
  }

  function pickRandomBlueprint(rng) {
    const keys = Object.keys(BLUEPRINTS);
    return keys[Math.floor(rng() * keys.length)];
  }

  function applyBlueprintEffects(stats) {
    const result = { ...stats };
    const bonus = {
      droneBonus: 0,
      empBonus: 0,
      damageMult: 1,
      shieldMult: 1,
      speedMult: 1,
      thrustMult: 1,
      shieldRegenMult: 1,
      hullMult: 1,
      scanRange: 1
    };
    player.blueprints.forEach((id) => {
      const blueprint = BLUEPRINTS[id];
      if (!blueprint) return;
      const effect = blueprint.effect || {};
      if (effect.droneBonus) bonus.droneBonus += effect.droneBonus;
      if (effect.empBonus) bonus.empBonus += effect.empBonus;
      if (effect.damageMult) bonus.damageMult *= effect.damageMult;
      if (effect.shieldMult) bonus.shieldMult *= effect.shieldMult;
      if (effect.speedMult) bonus.speedMult *= effect.speedMult;
      if (effect.thrustMult) bonus.thrustMult *= effect.thrustMult;
      if (effect.shieldRegenMult) bonus.shieldRegenMult *= effect.shieldRegenMult;
      if (effect.hullMult) bonus.hullMult *= effect.hullMult;
      if (effect.scanRange) bonus.scanRange *= effect.scanRange;
    });
    result.maxHp *= bonus.hullMult;
    result.maxShield *= bonus.shieldMult;
    result.maxSpeed *= bonus.speedMult;
    result.thrust *= bonus.thrustMult;
    result.shieldRegen *= bonus.shieldRegenMult;
    result.damageMult = bonus.damageMult;
    result.droneBonus = bonus.droneBonus;
    result.empBonus = bonus.empBonus;
    result.scanRange = bonus.scanRange;
    return result;
  }

  function computeStats() {
    const hull = HULLS[player.modules.hullSize] || HULLS.small;
    const engine = ENGINES[player.modules.enginePack] || ENGINES.standard;
    const shield = SHIELDS[player.modules.shieldArray] || SHIELDS.standard;
    const upgrades = player.upgrades;

    const maxHp = hull.baseHp * (1 + upgrades.hull * 0.16);
    const maxShield = hull.baseShield * (1 + upgrades.shield * 0.18 + shield.capacityBonus);
    const thrust = engine.thrust * (1 + upgrades.engine * 0.08) / hull.mass;
    const reverseThrust = engine.reverse * (1 + upgrades.engine * 0.06) / hull.mass;
    const maxSpeed = engine.maxSpeed * (1 + upgrades.engine * 0.05);
    const turnRate = engine.turnRate * (1 + upgrades.engine * 0.05);
    let fireDelay = 0.12 * (1 - upgrades.blaster * 0.06);
    fireDelay = Math.max(0.08, fireDelay);
    const damage = 1 + upgrades.blaster * 0.12;
    const boostMax = BASE.boostMax * (1 + upgrades.booster * 0.22);
    const boostRegen = engine.boostRegen * (1 + upgrades.booster * 0.14);
    const energyMax = BASE.energyMax * (1 + upgrades.capacitor * 0.2);
    const energyRegen = BASE.energyRegen * (1 + upgrades.capacitor * 0.16);
    const shieldRegen = shield.regen * (1 + upgrades.shield * 0.12);
    const shieldDelay = Math.max(0.6, shield.delay - upgrades.shield * 0.05);

    const baseStats = {
      maxHp,
      maxShield,
      thrust,
      reverseThrust,
      maxSpeed,
      turnRate,
      fireDelay,
      damage,
      boostMax,
      boostRegen,
      energyMax,
      energyRegen,
      shieldRegen,
      shieldDelay,
      size: hull.size
    };

    return applyBlueprintEffects(baseStats);
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
    state.scanRadius = 540 * (cachedStats.scanRange || 1);
  }

  function computePlayerLevel() {
    const upgradeSum = Object.values(player.upgrades).reduce((sum, value) => sum + value, 0);
    const blueprintCount = player.blueprints.size;
    const sectorCount = world.discovered.size;
    return Math.max(1, Math.floor(1 + upgradeSum * 0.7 + blueprintCount * 0.8 + sectorCount * 0.15));
  }

  function unlockHullByLevel() {
    Object.values(HULLS).forEach((hull) => {
      if (player.level >= hull.unlockLevel && !player.unlocked.hulls.includes(hull.id)) {
        player.unlocked.hulls.push(hull.id);
        noteStatus(`${hull.label} unlocked.`);
      }
    });
  }

  function updateDifficulty() {
    player.level = computePlayerLevel();
    unlockHullByLevel();
  }

  function resetChapterState() {
    missionTracker.optional.clear();
    missionTracker.noHullDamage = true;
    missionTracker.noBoost = true;
    missionTracker.dataShards = 0;
    const chapter = STORY[player.chapterIndex];
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
    entities.projectiles.length = 0;
    entities.enemyShots.length = 0;
    entities.beams.length = 0;
    entities.drones.length = 0;
    entities.loot.length = 0;
    entities.effects.length = 0;
    entities.particles.length = 0;
    if (full) {
      player.credits = 0;
      player.upgrades = { engine: 0, blaster: 0, capacitor: 0, shield: 0, hull: 0, booster: 0 };
      player.blueprints = new Set();
      player.cosmetics = new Set();
      player.toys = new Set();
      player.modules = {
        hullSize: 'small',
        enginePack: 'standard',
        shieldArray: 'standard',
        droneBay: 'basic'
      };
      player.weapons = {
        primary: 'laser',
        secondary: 'plasma'
      };
      player.unlocked = {
        hulls: ['small'],
        engines: ['standard'],
        shields: ['standard'],
        drones: ['basic'],
        weapons: ['laser', 'plasma'],
        toys: []
      };
      player.chapterIndex = 0;
      player.distanceThisChapter = 0;
      player.distanceTotal = 0;
      player.checkpointIndex = 0;
      state.storyLog = [];
      state.unlockedDepth = 1;
      world.discovered.clear();
      world.bossDefeated = {};
      world.stationContracts = {};
      world.sectors.clear();
      contract.active = false;
      mission.active = false;
      state.prompt = null;
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
    player.inventory.credits = player.credits;
    if (reason) noteStatus(`${reason} +${amount} credits.`);
  }

  function updateOptionalProgress(type, payload) {
    const chapter = STORY[player.chapterIndex];
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
    const chapter = STORY[player.chapterIndex];
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

  function getCurrentSector() {
    const { gx, gy } = gridFromPos(player.x, player.y);
    const sector = getSector(gx, gy);
    state.currentSectorKey = sector.key;
    if (!sector.discovered) {
      sector.discovered = true;
      sector.discoveredAt = Date.now();
      world.discovered.add(sector.key);
      awardCredits(50, 'Sector discovered');
      pushStoryLog(`Discovered sector ${sector.gx},${sector.gy}.`);
    }
    return sector;
  }

  function revealSectorsAround(x, y, radius) {
    const now = state.time;
    const range = radius;
    for (let gx = -WORLD.gridRadius; gx <= WORLD.gridRadius; gx += 1) {
      for (let gy = -WORLD.gridRadius; gy <= WORLD.gridRadius; gy += 1) {
        const sector = getSector(gx, gy);
        const center = posFromGrid(gx, gy);
        const d = dist(x, y, center.x, center.y);
        if (d <= range) {
          sector.revealedUntil = Math.max(sector.revealedUntil, now + 6);
        }
      }
    }
  }

  function applyBlueprint(blueprintId, installNow = true) {
    const blueprint = BLUEPRINTS[blueprintId];
    if (!blueprint) return;
    if (player.blueprints.has(blueprintId)) return;
    if (installNow) {
      player.blueprints.add(blueprintId);
      const unlock = blueprint.unlock || {};
      if (unlock.weapon && !player.unlocked.weapons.includes(unlock.weapon)) {
        player.unlocked.weapons.push(unlock.weapon);
      }
      if (unlock.engine && !player.unlocked.engines.includes(unlock.engine)) {
        player.unlocked.engines.push(unlock.engine);
      }
      if (unlock.shield && !player.unlocked.shields.includes(unlock.shield)) {
        player.unlocked.shields.push(unlock.shield);
      }
      if (unlock.drone && !player.unlocked.drones.includes(unlock.drone)) {
        player.unlocked.drones.push(unlock.drone);
      }
      if (unlock.hull && !player.unlocked.hulls.includes(unlock.hull)) {
        player.unlocked.hulls.push(unlock.hull);
      }
      if (unlock.toy && !player.unlocked.toys.includes(unlock.toy)) {
        player.unlocked.toys.push(unlock.toy);
      }
      refreshStats({ keepRatios: true });
      spawnDrones();
    } else {
      if (!player.inventory.blueprints.includes(blueprintId)) {
        player.inventory.blueprints.push(blueprintId);
      }
    }
  }

  function installStoredBlueprints() {
    if (!player.inventory.blueprints.length) return;
    player.inventory.blueprints.forEach((id) => applyBlueprint(id, true));
    player.inventory.blueprints = [];
    noteStatus('Installed stored blueprints.');
  }

  function addCameraShake(intensity = 1, duration = 0.3) {
    state.cameraShake = Math.max(state.cameraShake, intensity);
    state.cameraShakeTimer = Math.max(state.cameraShakeTimer, duration);
  }

  function spawnEnemy(type, x, y, scale = 1) {
    const def = ENEMY_TYPES[type];
    if (!def) return;
    const levelScale = 1 + (player.level - 1) * 0.08;
    entities.enemies.push({
      type,
      role: def.role,
      x,
      y,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: def.hp * scale * levelScale,
      maxHp: def.hp * scale * levelScale,
      fireCooldown: randRange(Math.random, 0.4, def.fireRate),
      state: 'patrol',
      size: def.size * scale,
      def,
      threat: scale,
      stunned: 0,
      shield: def.role === 'bomber' ? 20 : 0
    });
  }

  function spawnBoss(x, y) {
    entities.enemies.push({
      type: 'boss',
      role: 'guardian',
      x,
      y,
      vx: 0,
      vy: 0,
      angle: 0,
      hp: 820 + player.level * 60,
      maxHp: 820 + player.level * 60,
      shield: 320,
      maxShield: 320,
      fireCooldown: 0.9,
      state: 'chase',
      size: 58,
      phase: 1,
      isBoss: true
    });
    noteStatus('Guardian inbound.');
    addCameraShake(2.2, 0.6);
  }

  function spawnLoot(x, y, type, value) {
    entities.loot.push({
      x,
      y,
      type,
      value,
      vx: randRange(Math.random, -30, 30),
      vy: randRange(Math.random, -30, 30),
      life: 18
    });
  }

  function spawnEffect(x, y, color, radius = 6) {
    entities.effects.push({ x, y, radius, life: 0.6, color });
  }

  function spawnParticle(x, y, color, life, size, vx, vy) {
    entities.particles.push({ x, y, color, life, size, vx, vy, alpha: 1 });
  }

  function spawnExplosion(x, y, color) {
    for (let i = 0; i < 18; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randRange(Math.random, 60, 180);
      spawnParticle(x, y, color, randRange(Math.random, 0.4, 1.2), randRange(Math.random, 2, 6), Math.cos(angle) * speed, Math.sin(angle) * speed);
    }
  }

  function spawnDrones() {
    entities.drones.length = 0;
    const bay = DRONE_BAYS[player.modules.droneBay] || DRONE_BAYS.basic;
    const base = bay.count;
    const droneCount = base + Math.floor(player.upgrades.capacitor / 2) + (cachedStats.droneBonus || 0);
    for (let i = 0; i < droneCount; i += 1) {
      entities.drones.push({
        angle: (Math.PI * 2 * i) / droneCount,
        radius: 36 + i * 4,
        type: i % 2 === 0 ? 'attack' : 'repair',
        cooldown: randRange(Math.random, 0.2, 0.6)
      });
    }
  }

  function applyDamage(target, amount, options = {}) {
    const critChance = 0.06;
    let final = amount;
    if (options.canCrit && Math.random() < critChance) {
      final *= 1.65;
      spawnEffect(target.x, target.y, '#ffd166', 12);
    }
    if (target === player) {
      if (player.shield > 0) {
        const shieldPercent = player.shield / cachedStats.maxShield;
        const reduced = final * (1 - shieldPercent);
        player.shield = Math.max(0, player.shield - final);
        final = reduced;
      }
      if (final > 0) {
        player.hp -= final;
        missionTracker.noHullDamage = false;
      }
      player.lastHit = state.time;
      if (player.hp <= 0) {
        player.hp = 0;
        handlePlayerDeath();
      }
      return;
    }

    if (target.isBoss && target.shield > 0) {
      const shieldAbsorb = Math.min(target.shield, final * 0.8);
      target.shield -= shieldAbsorb;
      final -= shieldAbsorb;
    }
    if (target.shield && target.shield > 0 && !target.isBoss) {
      const shieldAbsorb = Math.min(target.shield, final * 0.6);
      target.shield -= shieldAbsorb;
      final -= shieldAbsorb;
    }
    target.hp -= final;
    if (target.hp <= 0) target.hp = 0;
  }

  function handlePlayerDeath() {
    state.running = false;
    noteStatus('Hull breach. Press Start to relaunch.');
    submitHighScore(GAME_ID, Math.floor(player.distanceTotal));
  }

  function handleEnemyDeath(enemy) {
    awardCredits(Math.round(28 + enemy.maxHp * 0.45));
    updateOptionalProgress('kills', { enemy: enemy.type, amount: 1 });
    if (mission.active && mission.type === 'kills') {
      mission.progress += 1;
      if (mission.progress >= mission.target) completeMission();
    }
    if (contract.active && contract.type === 'kills') {
      contract.progress += 1;
      if (contract.progress >= contract.target) completeContract();
    }
    spawnEffect(enemy.x, enemy.y, enemy.isBoss ? '#ffb347' : '#7dfc9a');
    spawnExplosion(enemy.x, enemy.y, enemy.isBoss ? '#ffb347' : '#7dfc9a');
    addCameraShake(enemy.isBoss ? 1.8 : 0.8, enemy.isBoss ? 0.6 : 0.3);
    if (Math.random() < 0.25) spawnLoot(enemy.x, enemy.y, 'credits', 40);
    if (Math.random() < 0.2) spawnLoot(enemy.x, enemy.y, 'shield', 18);
    if (Math.random() < 0.25) spawnLoot(enemy.x, enemy.y, 'boost', 16);
    if (Math.random() < 0.2) spawnLoot(enemy.x, enemy.y, 'energy', 18);
    if (Math.random() < 0.18) spawnLoot(enemy.x, enemy.y, 'data', 1);
    if (enemy.isBoss) {
      world.bossDefeated[player.chapterIndex] = true;
      awardCredits(700, 'Boss defeated');
      maybeAdvanceChapter(true);
    }
  }

  function spawnProjectile(weapon, originX, originY, dir, isPlayer = true) {
    const angle = Math.atan2(dir.y, dir.x);
    const velocity = { x: Math.cos(angle) * weapon.speed, y: Math.sin(angle) * weapon.speed };
    const projectile = {
      x: originX,
      y: originY,
      vx: velocity.x,
      vy: velocity.y,
      life: weapon.homing ? 3.6 : 1.8,
      damage: weapon.damage,
      color: weapon.color,
      splash: weapon.splash || 0,
      homing: weapon.homing || false,
      turn: weapon.turn || 0,
      emp: weapon.emp || 0,
      isPlayer
    };
    if (weapon.homing) {
      projectile.target = findClosestEnemy(originX, originY);
    }
    if (isPlayer) entities.projectiles.push(projectile);
    else entities.enemyShots.push(projectile);
  }

  function fireLaser() {
    const weapon = WEAPONS[player.weapons.primary];
    if (!weapon || !weapon.hitscan) return;
    const now = state.time;
    if (now - player.lastShot < Math.max(cachedStats.fireDelay, weapon.cooldown)) return;
    player.lastShot = now;

    const dir = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
    const range = 800;
    let hit = null;
    let hitDist = range;
    entities.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      const toEnemy = { x: enemy.x - player.x, y: enemy.y - player.y };
      const proj = toEnemy.x * dir.x + toEnemy.y * dir.y;
      if (proj < 0 || proj > range) return;
      const perpDist = Math.abs(toEnemy.x * dir.y - toEnemy.y * dir.x);
      if (perpDist < enemy.size && proj < hitDist) {
        hitDist = proj;
        hit = enemy;
      }
    });
    const endX = player.x + dir.x * hitDist;
    const endY = player.y + dir.y * hitDist;
    entities.beams.push({ x1: player.x, y1: player.y, x2: endX, y2: endY, life: 0.08, color: weapon.color });
    if (hit) {
      const damage = weapon.damage * cachedStats.damage * (cachedStats.damageMult || 1);
      applyDamage(hit, damage, { canCrit: true });
    }
  }

  function fireWeapon(weaponId, isPrimary = true) {
    const weapon = WEAPONS[weaponId];
    if (!weapon) return;
    if (!player.unlocked.weapons.includes(weaponId)) {
      noteStatus('Weapon locked.');
      return;
    }
    if (weapon.hitscan) {
      fireLaser();
      return;
    }
    const now = state.time;
    if (isPrimary) {
      if (now - player.lastShot < Math.max(cachedStats.fireDelay, weapon.cooldown)) return;
      player.lastShot = now;
    } else {
      if (now - player.lastAltShot < weapon.cooldown) return;
      player.lastAltShot = now;
    }
    if (player.energy < weapon.energy) {
      noteStatus('Not enough energy.');
      return;
    }
    player.energy = clamp(player.energy - weapon.energy, 0, cachedStats.energyMax);
    const dir = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
    const damage = weapon.damage * cachedStats.damage * (cachedStats.damageMult || 1);
    spawnProjectile({ ...weapon, damage }, player.x + dir.x * 18, player.y + dir.y * 18, dir, true);
    spawnEffect(player.x + dir.x * 12, player.y + dir.y * 12, weapon.color, 6);
  }

  function fireEMPBurst() {
    const now = state.time;
    if (now - player.lastAltShot < 1.5) return;
    if (player.energy < 45) {
      noteStatus('Not enough energy for EMP.');
      return;
    }
    player.energy -= 45;
    player.lastAltShot = now;
    entities.effects.push({ x: player.x, y: player.y, radius: 36, life: 0.6, color: '#6df0ff', emp: true });
    entities.enemies.forEach((enemy) => {
      if (dist(player.x, player.y, enemy.x, enemy.y) < 200) {
        enemy.stunned = 1.4 + (cachedStats.empBonus || 0);
        if (enemy.isBoss) enemy.shield = Math.max(0, enemy.shield - 50);
      }
    });
    noteStatus('EMP burst engaged.');
  }

  function updatePlayer(dt) {
    if (state.mode !== 'flight') return;
    const turningLeft = input.keys['KeyA'] || input.keys['ArrowLeft'];
    const turningRight = input.keys['KeyD'] || input.keys['ArrowRight'];
    const thrusting = input.keys['KeyW'] || input.keys['ArrowUp'];
    const reversing = input.keys['KeyS'] || input.keys['ArrowDown'];

    if (turningLeft) player.angle -= cachedStats.turnRate * (dt * 60);
    if (turningRight) player.angle += cachedStats.turnRate * (dt * 60);

    const dir = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
    if (thrusting) {
      player.vx += dir.x * cachedStats.thrust * dt;
      player.vy += dir.y * cachedStats.thrust * dt;
      spawnParticle(player.x - dir.x * 18, player.y - dir.y * 18, 'rgba(125,252,154,0.6)', 0.4, 3, -dir.x * 40, -dir.y * 40);
    }
    if (reversing) {
      player.vx -= dir.x * cachedStats.reverseThrust * dt;
      player.vy -= dir.y * cachedStats.reverseThrust * dt;
    }

    if ((input.justPressed['KeyB'] || input.justPressed['ShiftLeft'] || input.justPressed['ShiftRight']) && player.boost > 20) {
      state.shiftBoost.active = true;
      state.shiftBoost.timer = 3;
    }

    if (state.shiftBoost.active) {
      player.vx += dir.x * cachedStats.thrust * 1.5 * dt;
      player.vy += dir.y * cachedStats.thrust * 1.5 * dt;
      player.boost = clamp(player.boost - 35 * dt, 0, cachedStats.boostMax);
      state.shiftBoost.timer -= dt;
      missionTracker.noBoost = false;
      spawnEffect(player.x - dir.x * 18, player.y - dir.y * 18, '#7dfc9a');
      spawnParticle(player.x - dir.x * 20, player.y - dir.y * 20, 'rgba(125,252,154,0.8)', 0.5, 4, -dir.x * 80, -dir.y * 80);
      if (state.shiftBoost.timer <= 0 || player.boost <= 0) {
        state.shiftBoost.active = false;
      }
    } else {
      player.boost = clamp(player.boost + cachedStats.boostRegen * dt, 0, cachedStats.boostMax);
    }

    const speed = Math.hypot(player.vx, player.vy);
    const maxSpeed = state.shiftBoost.active ? cachedStats.maxSpeed * 1.5 : cachedStats.maxSpeed;
    if (speed > maxSpeed) {
      const scale = maxSpeed / (speed || 1);
      player.vx *= scale;
      player.vy *= scale;
    }

    player.vx *= 0.985;
    player.vy *= 0.985;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    const radial = Math.hypot(player.x, player.y);
    const boundary = state.unlockedDepth * WORLD.sectorSize + WORLD.sectorSize * 0.35;
    if (radial > boundary) {
      const dirBack = normalize(player.x, player.y);
      player.x = dirBack.x * boundary;
      player.y = dirBack.y * boundary;
      player.vx *= -0.2;
      player.vy *= -0.2;
      applyDamage(player, 8);
      noteStatus('Rift boundary destabilized.');
    }

    if (input.keys['Space']) fireWeapon(player.weapons.primary, true);
    if (input.justPressed['KeyX']) fireWeapon(player.weapons.secondary, false);
    if (input.justPressed['KeyF']) fireEMPBurst();
    if (input.justPressed['KeyR']) applyCheckpoint(state.checkpoint);

    if (state.time - player.lastHit > cachedStats.shieldDelay) {
      player.shield = clamp(player.shield + cachedStats.shieldRegen * dt, 0, cachedStats.maxShield);
    }
    player.energy = clamp(player.energy + cachedStats.energyRegen * dt, 0, cachedStats.energyMax);
  }

  function spawnWave(sector, dt) {
    if (!sector) return;
    const biome = BIOMES[sector.biome];
    sector.spawnTimer -= dt;
    if (sector.spawnTimer > 0) return;
    const maxEnemies = 4 + Math.floor(player.level * 1.5 + sector.depth);
    if (entities.enemies.length >= maxEnemies) return;

    const rng = mulberry32(WORLD_SEED + sector.gx * 77 + sector.gy * 91 + Math.floor(state.time * 7));
    const choices = ['scout', 'fighter', 'bomber', 'sniper', 'turret'];
    const threatScale = biome.threat + player.level * 0.05;
    const count = clamp(Math.floor(randRange(rng, 1, 3) + sector.depth * 0.3), 1, 4);
    for (let i = 0; i < count; i += 1) {
      const type = choices[Math.floor(rng() * choices.length)];
      const angle = rng() * Math.PI * 2;
      const radius = randRange(rng, 240, 520);
      spawnEnemy(type, player.x + Math.cos(angle) * radius, player.y + Math.sin(angle) * radius, threatScale);
    }
    sector.spawnTimer = randRange(rng, 1.1, 2.4) / threatScale;
  }

  function updateEnemyAI(enemy, dt) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.hypot(dx, dy);
    const isStatic = enemy.def?.static;

    if (enemy.stunned) {
      enemy.stunned = Math.max(0, enemy.stunned - dt);
      enemy.vx *= 0.96;
      enemy.vy *= 0.96;
      return;
    }

    if (enemy.isBoss) {
      if (enemy.shield <= 0 && enemy.phase === 1) {
        enemy.phase = 2;
        enemy.shield = enemy.maxShield * 0.7;
        noteStatus('Guardian shifting to phase 2.');
      }
      if (enemy.hp < enemy.maxHp * 0.35 && enemy.phase === 2) {
        enemy.phase = 3;
        noteStatus('Guardian final phase.');
      }
    }

    if (distance < 420) enemy.state = 'attack';
    else if (distance < 760) enemy.state = 'chase';
    else enemy.state = 'patrol';

    if (enemy.hp < enemy.maxHp * 0.25 && !enemy.isBoss) enemy.state = 'retreat';

    let speed = enemy.def ? enemy.def.speed : 90;
    if (enemy.isBoss) speed = 80 + enemy.phase * 25;

    if (!isStatic) {
      if (enemy.role === 'scout') {
        const dir = normalize(dx, dy);
        if (distance > 200) {
          enemy.vx += dir.x * speed * 1.1 * dt;
          enemy.vy += dir.y * speed * 1.1 * dt;
        } else {
          enemy.vx += -dir.y * speed * 0.8 * dt;
          enemy.vy += dir.x * speed * 0.8 * dt;
        }
      } else if (enemy.role === 'bomber') {
        const dir = normalize(dx, dy);
        if (distance < 300) {
          enemy.vx -= dir.x * speed * 1.1 * dt;
          enemy.vy -= dir.y * speed * 1.1 * dt;
        } else if (distance > 440) {
          enemy.vx += dir.x * speed * dt;
          enemy.vy += dir.y * speed * dt;
        }
      } else if (enemy.role === 'sniper') {
        const dir = normalize(dx, dy);
        if (distance < 420) {
          enemy.vx -= dir.x * speed * dt;
          enemy.vy -= dir.y * speed * dt;
        } else if (distance > 540) {
          enemy.vx += dir.x * speed * 0.8 * dt;
          enemy.vy += dir.y * speed * 0.8 * dt;
        }
      } else if (enemy.state === 'chase' || enemy.state === 'attack') {
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

    if (enemy.isBoss && enemy.phase >= 2 && Math.random() < 0.012) {
      const angle = Math.random() * Math.PI * 2;
      spawnEnemy('fighter', enemy.x + Math.cos(angle) * 60, enemy.y + Math.sin(angle) * 60, 1 + enemy.phase * 0.2);
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

    enemy.fireCooldown -= dt;
    if (enemy.state === 'attack' && enemy.fireCooldown <= 0) {
      enemy.fireCooldown = enemy.isBoss ? 0.5 : enemy.def.fireRate;
      const dir = normalize(player.x - enemy.x, player.y - enemy.y);
      const weapon = enemy.role === 'bomber'
        ? { damage: enemy.def.damage * 1.4, speed: 300, color: '#ff6b6b' }
        : { damage: enemy.def.damage, speed: 360, color: enemy.isBoss ? '#ffb347' : '#ff6b6b' };
      spawnProjectile(
        {
          id: 'enemy',
          damage: weapon.damage,
          speed: weapon.speed,
          color: weapon.color,
          cooldown: 0,
          energy: 0
        },
        enemy.x + dir.x * enemy.size,
        enemy.y + dir.y * enemy.size,
        dir,
        false
      );
    }
  }

  function updateEnemies(dt) {
    const sector = getCurrentSector();
    spawnWave(sector, dt);

    entities.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      updateEnemyAI(enemy, dt);
    });
  }

  function updateProjectiles(dt) {
    const updateList = (list) => {
      list.forEach((shot) => {
        shot.life -= dt;
        if (shot.homing && shot.target && shot.target.hp > 0) {
          const dir = normalize(shot.target.x - shot.x, shot.target.y - shot.y);
          const desiredAngle = Math.atan2(dir.y, dir.x);
          const currentAngle = Math.atan2(shot.vy, shot.vx);
          const nextAngle = lerp(currentAngle, desiredAngle, shot.turn * dt);
          const speed = Math.hypot(shot.vx, shot.vy);
          shot.vx = Math.cos(nextAngle) * speed;
          shot.vy = Math.sin(nextAngle) * speed;
        }
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
      });
      return list.filter((shot) => shot.life > 0);
    };
    entities.projectiles = updateList(entities.projectiles);
    entities.enemyShots = updateList(entities.enemyShots);
    entities.beams = entities.beams.filter((beam) => {
      beam.life -= dt;
      return beam.life > 0;
    });
  }

  function updateDrones(dt) {
    entities.drones.forEach((drone, index) => {
      drone.angle += dt * 0.9;
      const offsetAngle = drone.angle + index * 0.4;
      drone.x = player.x + Math.cos(offsetAngle) * (drone.radius || 36);
      drone.y = player.y + Math.sin(offsetAngle) * (drone.radius || 36);
      drone.cooldown -= dt;
      if (drone.type === 'repair') {
        if (drone.cooldown <= 0 && player.hp < cachedStats.maxHp) {
          player.hp = clamp(player.hp + 6, 0, cachedStats.maxHp);
          drone.cooldown = 1.4;
          spawnEffect(drone.x, drone.y, '#6df0ff');
        }
      } else if (drone.type === 'attack') {
        if (drone.cooldown <= 0) {
          const target = findClosestEnemy(drone.x, drone.y, 360);
          if (target) {
            const dir = normalize(target.x - drone.x, target.y - drone.y);
            spawnProjectile(
              { id: 'drone', damage: cachedStats.damage * 0.6, speed: 640, color: '#c77dff', cooldown: 0, energy: 0 },
              drone.x + dir.x * 8,
              drone.y + dir.y * 8,
              dir,
              true
            );
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
          awardCredits(drop.value || 40, 'Looted');
        } else if (drop.type === 'shield') {
          player.shield = clamp(player.shield + (drop.value || 18), 0, cachedStats.maxShield);
        } else if (drop.type === 'boost') {
          player.boost = clamp(player.boost + (drop.value || 16), 0, cachedStats.boostMax);
        } else if (drop.type === 'energy') {
          player.energy = clamp(player.energy + (drop.value || 18), 0, cachedStats.energyMax);
        } else if (drop.type === 'data') {
          missionTracker.dataShards += 1;
          updateOptionalProgress('collect', { amount: 1 });
          if (mission.active && mission.type === 'collect') {
            mission.progress += 1;
            if (mission.progress >= mission.target) completeMission();
          }
          if (contract.active && contract.type === 'collect') {
            contract.progress += 1;
            if (contract.progress >= contract.target) completeContract();
          }
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

  function updateParticles(dt) {
    entities.particles.forEach((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.94;
      particle.vy *= 0.94;
      particle.alpha = clamp(particle.life * 1.5, 0, 1);
    });
    entities.particles = entities.particles.filter((particle) => particle.life > 0);
  }

  function handleCollisions(dt) {
    const sector = getCurrentSector();

    sector.objects.asteroids.forEach((asteroid) => {
      const d = dist(player.x, player.y, asteroid.x, asteroid.y);
      if (d < asteroid.radius + cachedStats.size) {
        const push = normalize(player.x - asteroid.x, player.y - asteroid.y);
        player.x = asteroid.x + push.x * (asteroid.radius + cachedStats.size + 2);
        player.y = asteroid.y + push.y * (asteroid.radius + cachedStats.size + 2);
        applyDamage(player, 14);
        spawnEffect(player.x, player.y, '#ff6b6b');
        addCameraShake(0.8, 0.2);
      }
    });

    sector.objects.storms.forEach((storm) => {
      if (dist(player.x, player.y, storm.x, storm.y) < storm.radius) {
        player.shield = clamp(player.shield - storm.intensity * 16 * dt, 0, cachedStats.maxShield);
        player.energy = clamp(player.energy - storm.intensity * 9 * dt, 0, cachedStats.energyMax);
      }
    });

    sector.objects.anomalies.forEach((anomaly) => {
      const d = dist(player.x, player.y, anomaly.x, anomaly.y);
      if (d < anomaly.radius + cachedStats.size) {
        anomaly.charge = clamp(anomaly.charge + dt * 0.6, 0, 1);
        if (anomaly.charge >= 1 && contract.active && contract.type === 'scan') {
          contract.progress = contract.target;
          completeContract();
        }
      } else {
        anomaly.charge = clamp(anomaly.charge - dt * 0.3, 0, 1);
      }
    });

    entities.projectiles.forEach((shot) => {
      entities.enemies.forEach((enemy) => {
        if (enemy.hp <= 0) return;
        if (dist(shot.x, shot.y, enemy.x, enemy.y) < enemy.size) {
          shot.life = 0;
          applyDamage(enemy, shot.damage, { canCrit: true });
          if (shot.emp) enemy.stunned = Math.max(enemy.stunned, shot.emp + (cachedStats.empBonus || 0));
          if (shot.splash) {
            entities.enemies.forEach((other) => {
              if (other !== enemy && dist(shot.x, shot.y, other.x, other.y) < shot.splash) {
                applyDamage(other, shot.damage * 0.45, { canCrit: false });
              }
            });
          }
        }
      });
    });

    entities.enemyShots.forEach((shot) => {
      if (dist(shot.x, shot.y, player.x, player.y) < cachedStats.size + 6) {
        shot.life = 0;
        applyDamage(player, shot.damage);
      }
    });

    entities.enemies = entities.enemies.filter((enemy) => {
      if (enemy.hp <= 0) {
        handleEnemyDeath(enemy);
        return false;
      }
      return true;
    });

    sector.objects.caches.forEach((cache) => {
      if (dist(player.x, player.y, cache.x, cache.y) < cache.radius + cachedStats.size) {
        if (!world.cacheClaims?.[sector.key]) {
          world.cacheClaims = world.cacheClaims || {};
          world.cacheClaims[sector.key] = cache.blueprint;
          state.prompt = { type: 'blueprint', id: cache.blueprint, name: BLUEPRINTS[cache.blueprint].name };
          state.mode = 'prompt';
          state.paused = true;
        }
      }
    });
  }

  function maybeAdvanceChapter(bossDefeated = false) {
    const chapter = STORY[player.chapterIndex];
    if (!chapter) return;
    if (mission.active) return;

    finalizeOptionalChallenges();
    if (player.chapterIndex >= STORY.length - 1) {
      awardCredits(900, 'Campaign complete');
      noteStatus('Starforge secured. Campaign complete.');
      pushStoryLog('The Starforge awakens. The Aetherline is yours.');
      submitHighScore(GAME_ID, Math.floor(player.distanceTotal));
      state.running = false;
      return;
    }

    entities.enemies.length = 0;
    entities.enemyShots.length = 0;
    entities.projectiles.length = 0;
    player.chapterIndex = Math.min(player.chapterIndex + 1, STORY.length - 1);
    player.distanceThisChapter = 0;
    player.checkpointIndex = 0;
    state.unlockedDepth = Math.min(WORLD.maxDepth, state.unlockedDepth + 1);
    resetChapterState();
    setCheckpoint();
    showBriefing();
    awardCredits(340, 'Chapter complete');
    if (bossDefeated) {
      const blueprintKeys = Object.keys(BLUEPRINTS);
      const reward = blueprintKeys[(player.chapterIndex + 2) % blueprintKeys.length];
      if (!player.blueprints.has(reward)) {
        applyBlueprint(reward, true);
        noteStatus(`Chapter reward: ${BLUEPRINTS[reward].name}`);
      }
    }
  }

  function updateMissionProgress() {
    if (!mission.active) return;
    if (mission.type === 'distance' && player.distanceThisChapter >= mission.target) {
      mission.progress = mission.target;
      completeMission();
    }
    if (mission.type === 'reach_gate') {
      const sector = getCurrentSector();
      if (sector.key === mission.gateKey) {
        mission.progress = mission.target;
        completeMission();
      }
    }
    if (mission.type === 'boss') {
      if (!world.bossDefeated[player.chapterIndex]) {
        const sector = getCurrentSector();
        if (sector.key === mission.gateKey && !entities.enemies.some((enemy) => enemy.isBoss)) {
          const center = posFromGrid(sector.gx, sector.gy);
          const angle = Math.random() * Math.PI * 2;
          const radius = 220;
          spawnBoss(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius);
        }
      } else {
        mission.progress = mission.target;
        completeMission();
      }
    }
  }

  function completeMission() {
    if (!mission.active) return;
    mission.active = false;
    awardCredits(mission.reward, 'Mission complete');
    maybeAdvanceChapter(mission.type === 'boss');
  }

  function startChapterMission() {
    const chapter = STORY[player.chapterIndex];
    if (!chapter) return;
    mission.active = true;
    mission.type = chapter.goal.type;
    mission.target = chapter.goal.target || 1;
    mission.progress = 0;
    mission.reward = 300 + player.chapterIndex * 80;
    mission.text = chapter.objective;
    mission.gateKey = world.gates[chapter.id] || '';
    pushStoryLog(chapter.intro);
  }

  function updateProgress(dt) {
    if (state.mode !== 'flight') return;
    const speed = Math.hypot(player.vx, player.vy);
    player.distanceThisChapter += speed * dt;
    player.distanceTotal += speed * dt;

    const checkpoints = Math.min(3, Math.floor((player.distanceThisChapter / (WORLD.sectorSize * 3)) * 3));
    if (checkpoints > player.checkpointIndex) {
      player.checkpointIndex = checkpoints;
      setCheckpoint();
      awardCredits(160, 'Checkpoint reached');
    }

    updateMissionProgress();
  }

  function findClosestEnemy(x, y, range = 9999) {
    let best = null;
    let bestDist = range;
    entities.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      const d = dist(x, y, enemy.x, enemy.y);
      if (d < bestDist) {
        best = enemy;
        bestDist = d;
      }
    });
    return best;
  }

  function updateStationInteraction() {
    if (state.mode !== 'flight') return;
    const sector = getCurrentSector();
    const station = sector.objects.stations.find((s) => dist(player.x, player.y, s.x, s.y) < s.radius + 40);
    if (station) {
      noteStatus('Station in range. Press E to dock.');
      if (input.justPressed['KeyE']) {
        state.mode = 'station';
        state.paused = true;
        state.menuSelection = 0;
        noteStatus('Docked at station.');
      }
    }
  }

  function updateContractProgress() {
    if (!contract.active) return;
    if (contract.type === 'distance' && player.distanceThisChapter >= contract.target) {
      contract.progress = contract.target;
      completeContract();
    }
  }

  function createContractForSector(sector) {
    if (world.stationContracts[sector.key]) return;
    const rng = mulberry32(WORLD_SEED + sector.gx * 13 + sector.gy * 29);
    const templates = [
      { type: 'kills', text: 'Eliminate patrols', target: 8 + Math.floor(rng() * 6) },
      { type: 'collect', text: 'Recover data shards', target: 4 + Math.floor(rng() * 3) },
      { type: 'scan', text: 'Scan the anomaly field', target: 1 },
      { type: 'distance', text: 'Fly a courier run', target: 8000 + Math.floor(rng() * 4000) }
    ];
    const choice = templates[Math.floor(rng() * templates.length)];
    world.stationContracts[sector.key] = {
      type: choice.type,
      target: choice.target,
      reward: 240 + choice.target * 22,
      text: choice.text
    };
  }

  function acceptContract(sector) {
    const saved = world.stationContracts[sector.key];
    if (!saved) return;
    contract.active = true;
    contract.type = saved.type;
    contract.target = saved.target;
    contract.progress = 0;
    contract.reward = saved.reward;
    contract.text = saved.text;
    noteStatus(`Contract accepted: ${contract.text}`);
  }

  function completeContract() {
    if (!contract.active) return;
    awardCredits(contract.reward, 'Contract complete');
    contract.active = false;
    contract.progress = 0;
  }

  function update(dt) {
    if (input.justPressed['KeyC']) {
      if (!player.blueprints.has('scanner_drone')) {
        noteStatus('Scanner drone required.');
      } else if (player.energy >= 20) {
        player.energy -= 20;
        state.scanPulse = 2.2;
        revealSectorsAround(player.x, player.y, state.scanRadius);
        noteStatus('Scanner pulse active.');
      } else {
        noteStatus('Insufficient energy for scan.');
      }
    }

    if (input.justPressed['Digit1']) player.weapons.primary = 'laser';
    if (input.justPressed['Digit2'] && player.unlocked.weapons.includes('plasma')) player.weapons.secondary = 'plasma';
    if (input.justPressed['Digit3'] && player.unlocked.weapons.includes('missile')) player.weapons.secondary = 'missile';
    if (input.justPressed['Digit4'] && player.unlocked.weapons.includes('emp')) player.weapons.secondary = 'emp';

    state.scanPulse = Math.max(0, state.scanPulse - dt);

    updatePlayer(dt);
    updateEnemies(dt);
    updateProjectiles(dt);
    updateDrones(dt);
    updateLoot(dt);
    updateEffects(dt);
    updateParticles(dt);
    handleCollisions(dt);
    updateProgress(dt);
    updateDifficulty();
    updateStationInteraction();
    updateContractProgress();
    updateStatusTimer(dt);
    updateHud();
    updateUpgradeButtons();
    input.justPressed = {};
  }

  function updateHud() {
    if (hudHp) hudHp.textContent = `Hull: ${Math.round(player.hp)}/${Math.round(cachedStats.maxHp)}`;
    if (hudShield) hudShield.textContent = `Shield: ${Math.round(player.shield)}/${Math.round(cachedStats.maxShield)}`;
    if (hudCredits) hudCredits.textContent = `Credits: ${Math.round(player.credits)}`;
    if (hudChapter) hudChapter.textContent = `Chapter: ${player.chapterIndex + 1}/${STORY.length}`;
    if (hudCheckpoint) hudCheckpoint.textContent = `Checkpoint: ${player.checkpointIndex}/3`;
    if (hudScore) hudScore.textContent = `Distance: ${Math.floor(player.distanceTotal)} | Lvl ${player.level}`;
    const chapter = STORY[player.chapterIndex];
    if (hudObjective && chapter) {
      const missionText = mission.active ? ` | Mission: ${mission.text}` : '';
      const contractText = contract.active ? ` | Contract: ${contract.text} ${contract.progress}/${contract.target}` : '';
      hudObjective.textContent = `Objective: ${chapter.objective}${missionText}${contractText}`;
    }
    if (upgradeNote) {
      upgradeNote.textContent = 'Upgrades persist. Dock at stations for shipyard and store access.';
    }
  }

  function drawBackground(camera) {
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    gradient.addColorStop(0, PALETTE.ink);
    gradient.addColorStop(1, PALETTE.deep);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    nebulaLayers.forEach((layer, idx) => {
      const scale = 1 + idx * 0.3;
      const offsetX = -camera.x * 0.02 * (idx + 1);
      const offsetY = -camera.y * 0.02 * (idx + 1);
      ctx.globalAlpha = layer.alpha;
      ctx.drawImage(
        layer.canvas,
        ((offsetX % layer.size) + layer.size) % layer.size - layer.size,
        ((offsetY % layer.size) + layer.size) % layer.size - layer.size,
        layer.size * scale,
        layer.size * scale
      );
      ctx.drawImage(
        layer.canvas,
        ((offsetX % layer.size) + layer.size) % layer.size,
        ((offsetY % layer.size) + layer.size) % layer.size,
        layer.size * scale,
        layer.size * scale
      );
    });
    ctx.restore();

    starLayers.forEach((layer) => {
      ctx.fillStyle = layer.tint;
      layer.stars.forEach((star) => {
        const screenX = star.x - camera.x * layer.speed + VIEW.centerX;
        const screenY = star.y - camera.y * layer.speed + VIEW.centerY;
        if (screenX < -10 || screenX > VIEW.width + 10 || screenY < -10 || screenY > VIEW.height + 10) return;
        const twinkle = 0.6 + Math.sin(state.time * star.twinkle + star.x) * 0.4;
        ctx.globalAlpha = star.alpha * twinkle;
        ctx.beginPath();
        ctx.arc(screenX, screenY, star.size, 0, Math.PI * 2);
        ctx.fill();
      });
    });
    ctx.globalAlpha = 1;
  }

  function drawDust(camera) {
    const sector = getCurrentSector();
    const biome = BIOMES[sector.biome];
    ctx.fillStyle = biome.dust;
    dustField.forEach((dust) => {
      const screenX = dust.x - camera.x * 0.25 + VIEW.centerX;
      const screenY = dust.y - camera.y * 0.25 + VIEW.centerY;
      if (screenX < -50 || screenX > VIEW.width + 50 || screenY < -50 || screenY > VIEW.height + 50) return;
      ctx.globalAlpha = dust.alpha;
      ctx.beginPath();
      ctx.arc(screenX, screenY, dust.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawAsteroid(asteroid, camera) {
    const x = asteroid.x - camera.x + VIEW.centerX;
    const y = asteroid.y - camera.y + VIEW.centerY;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = PALETTE.steel;
    ctx.beginPath();
    asteroid.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(125,252,154,0.12)';
    ctx.stroke();
    ctx.restore();
  }

  function drawStation(station, camera) {
    const x = station.x - camera.x + VIEW.centerX;
    const y = station.y - camera.y + VIEW.centerY;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(125,252,154,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, station.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, station.radius * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(125,252,154,0.15)';
    ctx.fill();
    ctx.restore();
  }

  function drawSectorObjects(sector, camera) {
    sector.objects.planets.forEach((planet) => {
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

    sector.objects.storms.forEach((storm) => {
      const x = storm.x - camera.x + VIEW.centerX;
      const y = storm.y - camera.y + VIEW.centerY;
      ctx.fillStyle = `rgba(90,160,255,${storm.intensity * 0.2})`;
      ctx.beginPath();
      ctx.arc(x, y, storm.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    sector.objects.asteroids.forEach((asteroid) => drawAsteroid(asteroid, camera));
    sector.objects.stations.forEach((station) => drawStation(station, camera));

    sector.objects.anomalies.forEach((anomaly) => {
      const x = anomaly.x - camera.x + VIEW.centerX;
      const y = anomaly.y - camera.y + VIEW.centerY;
      ctx.strokeStyle = 'rgba(111,168,255,0.8)';
      ctx.beginPath();
      ctx.arc(x, y, anomaly.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(111,168,255,${0.15 + anomaly.charge * 0.35})`;
      ctx.fill();
    });

    sector.objects.caches.forEach((cache) => {
      if (world.cacheClaims?.[sector.key]) return;
      if (!player.blueprints.has('scanner_drone') && dist(player.x, player.y, cache.x, cache.y) > 120) return;
      if (state.scanPulse <= 0 && dist(player.x, player.y, cache.x, cache.y) > 200) return;
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

  function drawShip(camera) {
    const px = player.x - camera.x + VIEW.centerX;
    const py = player.y - camera.y + VIEW.centerY;
    const hull = HULLS[player.modules.hullSize] || HULLS.small;
    const w = hull.size * 1.8;
    const h = hull.size * 2.4;
    const accent = player.cosmetics.has('ember') ? PALETTE.ember : PALETTE.glow;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(player.angle + Math.PI / 2);
    ctx.shadowBlur = 18;
    ctx.shadowColor = accent;
    ctx.fillStyle = '#101b2f';
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.7);
    ctx.quadraticCurveTo(w * 0.6, -h * 0.2, w * 0.45, h * 0.35);
    ctx.lineTo(w * 0.2, h * 0.55);
    ctx.lineTo(0, h * 0.45);
    ctx.lineTo(-w * 0.2, h * 0.55);
    ctx.lineTo(-w * 0.45, h * 0.35);
    ctx.quadraticCurveTo(-w * 0.6, -h * 0.2, 0, -h * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(125,252,154,0.7)';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const canopy = ctx.createLinearGradient(0, -h * 0.4, 0, h * 0.2);
    canopy.addColorStop(0, 'rgba(100,220,255,0.6)');
    canopy.addColorStop(1, 'rgba(20,40,70,0.7)');
    ctx.fillStyle = canopy;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.45);
    ctx.quadraticCurveTo(w * 0.2, -h * 0.1, 0, h * 0.1);
    ctx.quadraticCurveTo(-w * 0.2, -h * 0.1, 0, -h * 0.45);
    ctx.fill();

    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.rect(-w * 0.07, h * 0.2, w * 0.14, h * 0.3);
    ctx.fill();

    ctx.shadowBlur = 16;
    ctx.shadowColor = accent;
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(-w * 0.22, h * 0.5, w * 0.12, 0, Math.PI * 2);
    ctx.arc(w * 0.22, h * 0.5, w * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    if (player.shield > 0) {
      ctx.strokeStyle = 'rgba(109,240,255,0.4)';
      ctx.beginPath();
      ctx.arc(px, py, hull.size + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEnemy(enemy, camera) {
    const x = enemy.x - camera.x + VIEW.centerX;
    const y = enemy.y - camera.y + VIEW.centerY;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(enemy.angle || 0);
    ctx.fillStyle = enemy.isBoss ? PALETTE.ember : enemy.def?.color || PALETTE.rose;
    ctx.shadowBlur = enemy.isBoss ? 18 : 8;
    ctx.shadowColor = ctx.fillStyle;
    ctx.beginPath();
    if (enemy.isBoss) {
      ctx.moveTo(0, -enemy.size * 0.9);
      ctx.lineTo(enemy.size * 0.9, enemy.size * 0.8);
      ctx.lineTo(-enemy.size * 0.9, enemy.size * 0.8);
    } else if (enemy.role === 'scout') {
      ctx.moveTo(0, -enemy.size);
      ctx.lineTo(enemy.size * 0.7, enemy.size * 0.5);
      ctx.lineTo(0, enemy.size * 0.2);
      ctx.lineTo(-enemy.size * 0.7, enemy.size * 0.5);
    } else if (enemy.role === 'bomber') {
      ctx.moveTo(0, -enemy.size * 0.8);
      ctx.lineTo(enemy.size * 0.9, enemy.size * 0.2);
      ctx.lineTo(enemy.size * 0.6, enemy.size * 0.9);
      ctx.lineTo(-enemy.size * 0.6, enemy.size * 0.9);
      ctx.lineTo(-enemy.size * 0.9, enemy.size * 0.2);
    } else if (enemy.role === 'sniper') {
      ctx.moveTo(0, -enemy.size * 1.1);
      ctx.lineTo(enemy.size * 0.5, enemy.size * 0.8);
      ctx.lineTo(-enemy.size * 0.5, enemy.size * 0.8);
    } else {
      ctx.moveTo(0, -enemy.size);
      ctx.lineTo(enemy.size * 0.7, enemy.size);
      ctx.lineTo(-enemy.size * 0.7, enemy.size);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    if (enemy.isBoss && enemy.shield > 0) {
      ctx.strokeStyle = 'rgba(125,252,154,0.6)';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.size + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEntities(camera) {
    entities.loot.forEach((drop) => {
      const x = drop.x - camera.x + VIEW.centerX;
      const y = drop.y - camera.y + VIEW.centerY;
      ctx.fillStyle = drop.type === 'credits' ? PALETTE.gold : drop.type === 'data' ? PALETTE.ice : PALETTE.glow;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    entities.projectiles.forEach((shot) => {
      const x = shot.x - camera.x + VIEW.centerX;
      const y = shot.y - camera.y + VIEW.centerY;
      ctx.fillStyle = shot.color;
      ctx.beginPath();
      ctx.arc(x, y, shot.splash ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
    });

    entities.enemyShots.forEach((shot) => {
      const x = shot.x - camera.x + VIEW.centerX;
      const y = shot.y - camera.y + VIEW.centerY;
      ctx.fillStyle = shot.color;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    entities.beams.forEach((beam) => {
      ctx.strokeStyle = beam.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = beam.life * 6;
      ctx.beginPath();
      ctx.moveTo(beam.x1 - camera.x + VIEW.centerX, beam.y1 - camera.y + VIEW.centerY);
      ctx.lineTo(beam.x2 - camera.x + VIEW.centerX, beam.y2 - camera.y + VIEW.centerY);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 1;
    });

    entities.enemies.forEach((enemy) => {
      drawEnemy(enemy, camera);
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

    entities.particles.forEach((particle) => {
      const x = particle.x - camera.x + VIEW.centerX;
      const y = particle.y - camera.y + VIEW.centerY;
      ctx.fillStyle = particle.color;
      ctx.globalAlpha = particle.alpha;
      ctx.beginPath();
      ctx.arc(x, y, particle.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    drawShip(camera);
  }

  function drawMiniMap() {
    const mapSize = 130;
    const padding = 12;
    const mapX = VIEW.width - mapSize - padding;
    const mapY = padding;
    ctx.fillStyle = 'rgba(5,10,18,0.7)';
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeStyle = 'rgba(125,252,154,0.4)';
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);

    for (let gx = -WORLD.gridRadius; gx <= WORLD.gridRadius; gx += 1) {
      for (let gy = -WORLD.gridRadius; gy <= WORLD.gridRadius; gy += 1) {
        const key = sectorKey(gx, gy);
        const sector = getSector(gx, gy);
        const cellX = mapX + ((gx + WORLD.gridRadius) / (WORLD.gridRadius * 2 + 1)) * mapSize;
        const cellY = mapY + ((gy + WORLD.gridRadius) / (WORLD.gridRadius * 2 + 1)) * mapSize;
        const visible = sector.discovered || sector.revealedUntil > state.time;
        ctx.fillStyle = visible ? 'rgba(125,252,154,0.6)' : 'rgba(80,90,110,0.3)';
        ctx.fillRect(cellX + 2, cellY + 2, 6, 6);
        if (sector.gateChapter) {
          ctx.strokeStyle = PALETTE.gold;
          ctx.strokeRect(cellX + 1, cellY + 1, 8, 8);
        }
      }
    }

    const playerX = mapX + ((player.x + WORLD.half) / WORLD.size) * mapSize;
    const playerY = mapY + ((player.y + WORLD.half) / WORLD.size) * mapSize;
    ctx.fillStyle = PALETTE.ember;
    ctx.beginPath();
    ctx.arc(playerX, playerY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawShipStatus() {
    ctx.fillStyle = 'rgba(5,10,18,0.55)';
    ctx.fillRect(12, VIEW.height - 100, 300, 88);
    ctx.strokeStyle = 'rgba(125,252,154,0.3)';
    ctx.strokeRect(12, VIEW.height - 100, 300, 88);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '12px sans-serif';
    ctx.fillText(`Hull ${Math.round(player.hp)}/${Math.round(cachedStats.maxHp)}`, 22, VIEW.height - 72);
    ctx.fillText(`Shield ${Math.round(player.shield)}/${Math.round(cachedStats.maxShield)}`, 22, VIEW.height - 56);
    ctx.fillText(`Energy ${Math.round(player.energy)}/${Math.round(cachedStats.energyMax)}`, 22, VIEW.height - 40);
    ctx.fillText(`Boost ${Math.round(player.boost)}/${Math.round(cachedStats.boostMax)}`, 22, VIEW.height - 24);
  }

  function drawGalaxyMap() {
    ctx.fillStyle = 'rgba(5,10,18,0.85)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '20px sans-serif';
    ctx.fillText('Aetherline Sector Grid', 24, 36);
    ctx.font = '12px sans-serif';
    ctx.fillText('Press M to close map.', 24, 54);

    const gridSize = WORLD.gridRadius * 2 + 1;
    const cell = 30;
    const offsetX = VIEW.centerX - (gridSize * cell) / 2;
    const offsetY = VIEW.centerY - (gridSize * cell) / 2;

    for (let gx = -WORLD.gridRadius; gx <= WORLD.gridRadius; gx += 1) {
      for (let gy = -WORLD.gridRadius; gy <= WORLD.gridRadius; gy += 1) {
        const sector = getSector(gx, gy);
        const visible = sector.discovered || sector.revealedUntil > state.time;
        const x = offsetX + (gx + WORLD.gridRadius) * cell;
        const y = offsetY + (gy + WORLD.gridRadius) * cell;
        ctx.fillStyle = visible ? BIOMES[sector.biome].accent : 'rgba(60,70,90,0.4)';
        ctx.fillRect(x + 4, y + 4, cell - 8, cell - 8);
        if (sector.gateChapter) {
          ctx.strokeStyle = PALETTE.gold;
          ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
        }
        if (sector.locked) {
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.beginPath();
          ctx.moveTo(x + 6, y + 6);
          ctx.lineTo(x + cell - 6, y + cell - 6);
          ctx.stroke();
        }
      }
    }

    const px = offsetX + (gridFromPos(player.x, player.y).gx + WORLD.gridRadius) * cell + cell / 2;
    const py = offsetY + (gridFromPos(player.x, player.y).gy + WORLD.gridRadius) * cell + cell / 2;
    ctx.fillStyle = PALETTE.ember;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPromptOverlay() {
    if (!state.prompt) return;
    ctx.fillStyle = 'rgba(5,10,18,0.86)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '20px sans-serif';
    ctx.fillText('Blueprint Cache Found', 24, 36);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#e0f2ff';
    ctx.fillText(`Unlock ${state.prompt.name}?`, 24, 70);
    ctx.fillText('Press Y to install now or N to store for later.', 24, 92);
  }

  function drawStationOverlay() {
    ctx.fillStyle = 'rgba(5,10,18,0.78)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '20px sans-serif';
    ctx.fillText('Station Docked', 24, 36);
    ctx.font = '13px sans-serif';
    const options = [
      '1. Repair & Refuel (120 credits)',
      '2. Shipyard - Configure Modules',
      '3. Store - Supplies & Cosmetics',
      '4. Accept Contract',
      '5. Install Stored Blueprints',
      '6. Undock'
    ];
    options.forEach((opt, idx) => {
      ctx.fillStyle = idx === state.menuSelection ? PALETTE.gold : '#e0f2ff';
      ctx.fillText(opt, 24, 80 + idx * 22);
    });
  }

  function drawShipyardOverlay() {
    ctx.fillStyle = 'rgba(5,10,18,0.82)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '20px sans-serif';
    ctx.fillText('Shipyard Configuration', 24, 36);
    ctx.font = '13px sans-serif';
    const lines = [
      `Hull: ${HULLS[player.modules.hullSize].label}`,
      `Engine: ${ENGINES[player.modules.enginePack].label}`,
      `Shield: ${SHIELDS[player.modules.shieldArray].label}`,
      `Primary: ${WEAPONS[player.weapons.primary].label}`,
      `Secondary: ${WEAPONS[player.weapons.secondary].label}`,
      `Drone Bay: ${DRONE_BAYS[player.modules.droneBay].label}`
    ];
    lines.forEach((line, idx) => {
      ctx.fillText(line, 24, 70 + idx * 20);
    });
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('Use number keys to cycle modules. Press Esc to exit.', 24, 210);
    ctx.fillStyle = '#e0f2ff';
    ctx.fillText('1 Hull  2 Engine  3 Shield  4 Primary  5 Secondary  6 Drone', 24, 232);
  }

  function drawStoreOverlay() {
    ctx.fillStyle = 'rgba(5,10,18,0.82)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '20px sans-serif';
    ctx.fillText('Station Store', 24, 36);
    ctx.font = '13px sans-serif';
    STORE_ITEMS.forEach((item, idx) => {
      ctx.fillStyle = idx === state.menuSelection ? PALETTE.gold : '#e0f2ff';
      ctx.fillText(`${idx + 1}. ${item.name} - ${item.price} credits`, 24, 70 + idx * 20);
    });
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('Press Esc to exit store.', 24, 70 + STORE_ITEMS.length * 20 + 18);
  }

  function drawOverlay() {
    if (state.mode === 'map') drawGalaxyMap();
    if (state.mode === 'prompt') drawPromptOverlay();
    if (state.mode === 'station') drawStationOverlay();
    if (state.mode === 'shipyard') drawShipyardOverlay();
    if (state.mode === 'store') drawStoreOverlay();
  }

  function render() {
    const shake = state.cameraShakeTimer > 0 ? state.cameraShake * state.cameraShakeTimer : 0;
    const shakeX = Math.sin(state.time * 45 + state.cameraNoiseSeed) * shake * 4;
    const shakeY = Math.cos(state.time * 38 + state.cameraNoiseSeed * 2) * shake * 4;
    const camera = { x: player.x + shakeX, y: player.y + shakeY };

    drawBackground(camera);
    drawDust(camera);

    const sector = getCurrentSector();
    drawSectorObjects(sector, camera);
    drawEntities(camera);
    drawMiniMap();
    drawShipStatus();
    drawOverlay();
  }

  function tick(timestamp) {
    if (!state.lastFrame) state.lastFrame = timestamp;
    const dt = Math.min(0.05, (timestamp - state.lastFrame) / 1000);
    state.lastFrame = timestamp;
    state.time += dt;

    if (state.cameraShakeTimer > 0) {
      state.cameraShakeTimer = Math.max(0, state.cameraShakeTimer - dt);
    }

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
    const chapter = STORY[player.chapterIndex];
    if (!chapter || !briefing) return;
    if (briefKicker) briefKicker.textContent = `Chapter ${chapter.id}`;
    if (briefTitle) briefTitle.textContent = chapter.title;
    if (briefBody) briefBody.textContent = chapter.intro;
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
    state.mode = 'briefing';
  }

  function hideBriefing() {
    if (!briefing) return;
    briefing.classList.remove('active');
    state.awaitingBrief = false;
    state.paused = false;
    state.mode = 'flight';
    startChapterMission();
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
        credits: player.credits,
        upgrades: player.upgrades,
        blueprints: Array.from(player.blueprints),
        cosmetics: Array.from(player.cosmetics),
        toys: Array.from(player.toys),
        modules: player.modules,
        weapons: player.weapons,
        unlocked: player.unlocked,
        chapterIndex: player.chapterIndex,
        distanceThisChapter: player.distanceThisChapter,
        distanceTotal: player.distanceTotal,
        checkpointIndex: player.checkpointIndex
      },
      inventory: {
        credits: player.credits,
        blueprints: player.inventory.blueprints,
        skins: player.inventory.skins,
        toys: player.inventory.toys
      },
      mapProgress: {
        sectorsDiscovered: Array.from(world.discovered),
        bossesDefeated: world.bossDefeated
      },
      settings: {
        audioVolume: 0.8,
        graphicsQuality: 'high'
      },
      state: {
        unlockedDepth: state.unlockedDepth,
        storyLog: state.storyLog
      },
      mission,
      contract,
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
    player.credits = savedPlayer.credits ?? player.credits;
    player.upgrades = { ...player.upgrades, ...(savedPlayer.upgrades || {}) };
    player.blueprints = new Set(savedPlayer.blueprints || []);
    player.cosmetics = new Set(savedPlayer.cosmetics || []);
    player.toys = new Set(savedPlayer.toys || []);
    player.modules = savedPlayer.modules || player.modules;
    player.weapons = savedPlayer.weapons || player.weapons;
    player.unlocked = savedPlayer.unlocked || player.unlocked;
    player.chapterIndex = savedPlayer.chapterIndex ?? player.chapterIndex;
    player.distanceThisChapter = savedPlayer.distanceThisChapter ?? player.distanceThisChapter;
    player.distanceTotal = savedPlayer.distanceTotal ?? player.distanceTotal;
    player.checkpointIndex = savedPlayer.checkpointIndex ?? player.checkpointIndex;

    player.inventory.blueprints = save.inventory?.blueprints || [];
    player.inventory.skins = save.inventory?.skins || ['nebula'];
    player.inventory.toys = save.inventory?.toys || [];

    world.discovered = new Set(save.mapProgress?.sectorsDiscovered || []);
    world.bossDefeated = save.mapProgress?.bossesDefeated || {};

    state.unlockedDepth = save.state?.unlockedDepth ?? state.unlockedDepth;
    state.storyLog = save.state?.storyLog || [];

    if (save.mission) {
      mission.active = save.mission.active || false;
      mission.type = save.mission.type || '';
      mission.target = save.mission.target || 0;
      mission.progress = save.mission.progress || 0;
      mission.reward = save.mission.reward || 0;
      mission.text = save.mission.text || '';
      mission.gateKey = save.mission.gateKey || '';
    }

    if (save.contract) {
      contract.active = save.contract.active || false;
      contract.type = save.contract.type || '';
      contract.target = save.contract.target || 0;
      contract.progress = save.contract.progress || 0;
      contract.reward = save.contract.reward || 0;
      contract.text = save.contract.text || '';
    }

    state.checkpoint = save.checkpoint || state.checkpoint;

    refreshStats({ keepRatios: true });
    spawnDrones();
    updateDifficulty();
    resetChapterState();
    state.awaitingBrief = false;
    state.paused = false;
    state.mode = 'flight';
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

      if (state.prompt && (e.code === 'KeyY' || e.code === 'KeyN')) {
        if (e.code === 'KeyY') {
          applyBlueprint(state.prompt.id, true);
          noteStatus(`Blueprint installed: ${state.prompt.name}`);
        } else {
          applyBlueprint(state.prompt.id, false);
          noteStatus(`Blueprint stored: ${state.prompt.name}`);
        }
        state.prompt = null;
        state.mode = 'flight';
        state.paused = false;
        return;
      }

      if (e.code === 'KeyM' && state.mode === 'flight') {
        state.mode = 'map';
        state.paused = true;
        return;
      }
      if (e.code === 'KeyM' && state.mode === 'map') {
        state.mode = 'flight';
        state.paused = false;
        return;
      }

      if (e.code === 'Escape') {
        if (state.mode === 'shipyard' || state.mode === 'store' || state.mode === 'station') {
          state.mode = 'station';
          return;
        }
      }

      if (state.mode === 'station') {
        handleStationMenuInput(e.code);
      } else if (state.mode === 'shipyard') {
        handleShipyardInput(e.code);
      } else if (state.mode === 'store') {
        handleStoreInput(e.code);
      }
    });
    window.addEventListener('keyup', (e) => {
      input.keys[e.code] = false;
    });
    window.addEventListener('blur', () => {
      input.keys = {};
      input.justPressed = {};
    });
  }

  function handleStationMenuInput(code) {
    if (code.startsWith('Digit')) {
      const idx = parseInt(code.replace('Digit', ''), 10) - 1;
      if (!Number.isNaN(idx)) state.menuSelection = idx;
    }
    if (code === 'Digit1') stationRepair();
    if (code === 'Digit2') openShipyard();
    if (code === 'Digit3') openStore();
    if (code === 'Digit4') stationContract();
    if (code === 'Digit5') installStoredBlueprints();
    if (code === 'Digit6') undock();
  }

  function handleShipyardInput(code) {
    if (code === 'Escape') {
      state.mode = 'station';
      return;
    }
    if (code === 'Digit1') cycleHull();
    if (code === 'Digit2') cycleEngine();
    if (code === 'Digit3') cycleShield();
    if (code === 'Digit4') cyclePrimary();
    if (code === 'Digit5') cycleSecondary();
    if (code === 'Digit6') cycleDroneBay();
  }

  function handleStoreInput(code) {
    if (code === 'Escape') {
      state.mode = 'station';
      return;
    }
    const index = parseInt(code.replace('Digit', ''), 10) - 1;
    if (Number.isNaN(index)) return;
    state.menuSelection = index;
    const item = STORE_ITEMS[index];
    if (!item) return;
    purchaseStoreItem(item);
  }

  function stationRepair() {
    const repairCost = 120;
    if (player.credits < repairCost) {
      noteStatus('Insufficient credits for repairs.');
      return;
    }
    player.credits -= repairCost;
    player.hp = cachedStats.maxHp;
    player.shield = cachedStats.maxShield;
    player.boost = cachedStats.boostMax;
    player.energy = cachedStats.energyMax;
    noteStatus('Station services applied.');
  }

  function openShipyard() {
    state.mode = 'shipyard';
  }

  function openStore() {
    state.mode = 'store';
    state.menuSelection = 0;
  }

  function undock() {
    state.mode = 'flight';
    state.paused = false;
    noteStatus('Undocked.');
  }

  function stationContract() {
    const sector = getCurrentSector();
    createContractForSector(sector);
    acceptContract(sector);
  }

  function cycleHull() {
    const hulls = player.unlocked.hulls;
    const index = hulls.indexOf(player.modules.hullSize);
    const next = hulls[(index + 1) % hulls.length];
    player.modules.hullSize = next;
    refreshStats({ keepRatios: true });
    spawnDrones();
    noteStatus(`Hull set to ${HULLS[next].label}.`);
  }

  function cycleEngine() {
    const engines = player.unlocked.engines;
    const index = engines.indexOf(player.modules.enginePack);
    const next = engines[(index + 1) % engines.length];
    player.modules.enginePack = next;
    refreshStats({ keepRatios: true });
    noteStatus(`Engine set to ${ENGINES[next].label}.`);
  }

  function cycleShield() {
    const shields = player.unlocked.shields;
    const index = shields.indexOf(player.modules.shieldArray);
    const next = shields[(index + 1) % shields.length];
    player.modules.shieldArray = next;
    refreshStats({ keepRatios: true });
    noteStatus(`Shield set to ${SHIELDS[next].label}.`);
  }

  function cyclePrimary() {
    const options = player.unlocked.weapons.filter((id) => WEAPONS[id]?.slot === 'primary');
    const index = options.indexOf(player.weapons.primary);
    const next = options[(index + 1) % options.length];
    if (next) {
      player.weapons.primary = next;
      noteStatus(`Primary weapon set to ${WEAPONS[next].label}.`);
    }
  }

  function cycleSecondary() {
    const options = player.unlocked.weapons.filter((id) => WEAPONS[id]?.slot === 'secondary');
    const index = options.indexOf(player.weapons.secondary);
    const next = options[(index + 1) % options.length];
    if (next) {
      player.weapons.secondary = next;
      noteStatus(`Secondary weapon set to ${WEAPONS[next].label}.`);
    }
  }

  function cycleDroneBay() {
    const bays = player.unlocked.drones;
    const index = bays.indexOf(player.modules.droneBay);
    const next = bays[(index + 1) % bays.length];
    player.modules.droneBay = next;
    spawnDrones();
    noteStatus(`Drone bay set to ${DRONE_BAYS[next].label}.`);
  }

  function purchaseStoreItem(item) {
    if (player.credits < item.price) {
      noteStatus('Insufficient credits for purchase.');
      return;
    }
    player.credits -= item.price;
    if (item.type === 'consumable') {
      if (item.effect.hp) player.hp = clamp(player.hp + item.effect.hp, 0, cachedStats.maxHp);
      if (item.effect.energy) player.energy = clamp(player.energy + item.effect.energy, 0, cachedStats.energyMax);
      if (item.effect.boost) player.boost = clamp(player.boost + item.effect.boost, 0, cachedStats.boostMax);
    }
    if (item.type === 'cosmetic' && item.effect.cosmetic) {
      player.cosmetics.add(item.effect.cosmetic);
    }
    noteStatus(`${item.name} acquired.`);
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

  function pushStoryLog(entry) {
    const stamp = new Date().toLocaleTimeString();
    state.storyLog.push(`[${stamp}] ${entry}`);
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

    buildGateMap();

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
