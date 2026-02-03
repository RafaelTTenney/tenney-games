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
  const SAVE_VERSION = 5;
  const SAVE_KEY = `swarmBreakerSave_v${SAVE_VERSION}`;
  const GALAXY_SEED = 1337;

  const WORLD = {
    ringSpacing: 900,
    rings: 7,
    nodeRadius: 220,
    size: 8200,
    half: 4100
  };

  const BASE = {
    boostMax: 130,
    boostRegen: 24,
    energyMax: 110,
    energyRegen: 19
  };

  const PALETTE = {
    ink: '#04070d',
    deep: '#0b1423',
    glow: '#7dfc9a',
    ember: '#ffb347',
    rose: '#ff6b6b',
    ice: '#6df0ff',
    violet: '#c77dff',
    gold: '#ffd166'
  };

  const BIOMES = {
    driftline: { name: 'Driftline', hue: 185, accent: '#6df0ff', fog: 'rgba(60,110,140,0.12)', dust: 'rgba(110,200,255,0.14)', threat: 0.9 },
    glasswake: { name: 'Glasswake', hue: 210, accent: '#7dfc9a', fog: 'rgba(70,140,180,0.12)', dust: 'rgba(140,220,255,0.12)', threat: 1.05 },
    stormvault: { name: 'Stormvault', hue: 260, accent: '#c77dff', fog: 'rgba(130,90,190,0.15)', dust: 'rgba(180,120,255,0.12)', threat: 1.2 },
    redshift: { name: 'Redshift', hue: 20, accent: '#ff8b5c', fog: 'rgba(180,80,60,0.13)', dust: 'rgba(255,160,120,0.12)', threat: 1.35 },
    bastion: { name: 'Bastion', hue: 135, accent: '#7dfc9a', fog: 'rgba(80,140,100,0.12)', dust: 'rgba(120,230,160,0.12)', threat: 1.45 },
    darklane: { name: 'Darklane', hue: 240, accent: '#8899ff', fog: 'rgba(70,80,150,0.18)', dust: 'rgba(120,140,220,0.12)', threat: 1.6 },
    starforge: { name: 'Starforge', hue: 45, accent: '#ffd166', fog: 'rgba(220,170,90,0.12)', dust: 'rgba(255,210,140,0.12)', threat: 1.8 }
  };

  const HULLS = {
    courier: { id: 'courier', label: 'Courier Hull', baseHp: 110, baseShield: 80, size: 13, mass: 0.95, slots: { drones: 1 }, unlockLevel: 1 },
    frontier: { id: 'frontier', label: 'Frontier Hull', baseHp: 145, baseShield: 110, size: 17, mass: 1.1, slots: { drones: 2 }, unlockLevel: 3 },
    vanguard: { id: 'vanguard', label: 'Vanguard Hull', baseHp: 185, baseShield: 135, size: 20, mass: 1.2, slots: { drones: 3 }, unlockLevel: 6 },
    titan: { id: 'titan', label: 'Titan Hull', baseHp: 230, baseShield: 170, size: 24, mass: 1.35, slots: { drones: 4 }, unlockLevel: 9 }
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
    laser: { id: 'laser', label: 'Laser Blaster', slot: 'primary', damage: 12, cooldown: 0.12, speed: 980, energy: 0, color: '#7dfc9a', spread: 0.02 },
    rail: { id: 'rail', label: 'Rail Driver', slot: 'primary', damage: 22, cooldown: 0.38, speed: 1400, energy: 6, color: '#6df0ff', pierce: true, spread: 0.01 },
    pulse: { id: 'pulse', label: 'Pulse Scatter', slot: 'primary', damage: 9, cooldown: 0.16, speed: 880, energy: 0, color: '#7dfc9a', spread: 0.12, pellets: 3 },
    plasma: { id: 'plasma', label: 'Plasma Cannon', slot: 'secondary', damage: 36, cooldown: 0.9, speed: 520, energy: 28, color: '#ffb347', splash: 52 },
    missile: { id: 'missile', label: 'Missile Rack', slot: 'secondary', damage: 44, cooldown: 1.25, speed: 420, energy: 24, color: '#ff6b6b', homing: true, turn: 2.2 },
    ion: { id: 'ion', label: 'Ion Lancer', slot: 'secondary', damage: 30, cooldown: 0.8, speed: 760, energy: 26, color: '#6df0ff', emp: 0.6 }
  };

  const UPGRADE_DEFS = {
    engine: { label: 'Engine Output', max: 5, baseCost: 260 },
    blaster: { label: 'Weapon Pods', max: 5, baseCost: 280 },
    capacitor: { label: 'Capacitor', max: 4, baseCost: 250 },
    shield: { label: 'Shield Core', max: 4, baseCost: 270 },
    hull: { label: 'Hull Plating', max: 4, baseCost: 300 },
    booster: { label: 'Afterburner', max: 3, baseCost: 280 }
  };

  const BLUEPRINTS = {
    shield_overdrive: { id: 'shield_overdrive', name: 'Shield Overdrive', unlock: { shield: 'overdrive' }, effect: { shieldMult: 1.2 } },
    turbo_engine: { id: 'turbo_engine', name: 'Turbo Engine', unlock: { engine: 'turbo' }, effect: { speedMult: 1.08, thrustMult: 1.08 } },
    hyper_engine: { id: 'hyper_engine', name: 'Hyper Engine', unlock: { engine: 'hyper' }, effect: { speedMult: 1.15, thrustMult: 1.12 } },
    plasma_cannon: { id: 'plasma_cannon', name: 'Plasma Cannon', unlock: { weapon: 'plasma' }, effect: { damageMult: 1.08 } },
    missile_rack: { id: 'missile_rack', name: 'Missile Rack', unlock: { weapon: 'missile' }, effect: { damageMult: 1.04 } },
    rail_driver: { id: 'rail_driver', name: 'Rail Driver', unlock: { weapon: 'rail' }, effect: { critBonus: 0.05 } },
    ion_lancer: { id: 'ion_lancer', name: 'Ion Lancer', unlock: { weapon: 'ion' }, effect: { empBonus: 0.2 } },
    drone_swarm: { id: 'drone_swarm', name: 'Drone Swarm', unlock: { drone: 'swarm' }, effect: { droneBonus: 2 } },
    nanofiber_shield: { id: 'nanofiber_shield', name: 'Nanofiber Shield', unlock: { shield: 'nanofiber' }, effect: { shieldRegenMult: 1.15 } },
    hull_reinforce: { id: 'hull_reinforce', name: 'Hull Reinforcement', unlock: {}, effect: { hullMult: 1.12 } },
    pulse_scatter: { id: 'pulse_scatter', name: 'Pulse Scatter', unlock: { weapon: 'pulse' }, effect: { damageMult: 1.02 } },
    nebula_skin: { id: 'nebula_skin', name: 'Nebula Skin', unlock: { cosmetic: 'nebula' }, effect: {} }
  };

  const STORE_ITEMS = [
    { id: 'boost_pack', name: 'Boost Pack', type: 'consumable', price: 120, effect: { boost: 45 } },
    { id: 'energy_cell', name: 'Energy Cell', type: 'consumable', price: 140, effect: { energy: 45 } },
    { id: 'repair_kit', name: 'Repair Kit', type: 'consumable', price: 170, effect: { hp: 45 } },
    { id: 'nebula_skin', name: 'Nebula Skin', type: 'cosmetic', price: 420, effect: { cosmetic: 'nebula' } },
    { id: 'ember_skin', name: 'Ember Skin', type: 'cosmetic', price: 420, effect: { cosmetic: 'ember' } }
  ];

  const ENEMY_TYPES = {
    scout: { role: 'scout', hp: 24, speed: 150, fireRate: 1.4, damage: 6, size: 12, color: '#6df0ff' },
    interceptor: { role: 'interceptor', hp: 38, speed: 135, fireRate: 1.1, damage: 8, size: 15, color: '#7dfc9a' },
    fighter: { role: 'fighter', hp: 48, speed: 120, fireRate: 1.2, damage: 10, size: 16, color: '#ffb347' },
    bomber: { role: 'bomber', hp: 78, speed: 90, fireRate: 1.8, damage: 16, size: 22, color: '#ff6b6b' },
    sniper: { role: 'sniper', hp: 34, speed: 110, fireRate: 2.3, damage: 18, size: 14, color: '#c77dff' },
    carrier: { role: 'carrier', hp: 120, speed: 70, fireRate: 2.6, damage: 10, size: 30, color: '#8899ff' },
    turret: { role: 'turret', hp: 95, speed: 0, fireRate: 1.6, damage: 14, size: 24, color: '#8899ff', static: true }
  };

  const STORY = [
    {
      id: 1,
      title: 'Driftline Exodus',
      kicker: 'Aetherline Initiative',
      intro: 'Your courier hull slips past the Tenney Belt. The Driftline network is dark, and the only way forward is to relight the first relay.',
      objective: 'Stabilize the Driftline relay gate.',
      biome: 'driftline',
      ring: 1,
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
      objective: 'Cross the Glasswake and secure the signal cache.',
      biome: 'glasswake',
      ring: 2,
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
      objective: 'Disable the thieves and keep the relay alive.',
      biome: 'glasswake',
      ring: 2,
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
      objective: 'Navigate the stormvault and keep the nav core intact.',
      biome: 'stormvault',
      ring: 3,
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
      objective: 'Stay on the pursuit line and tag the cruiser.',
      biome: 'redshift',
      ring: 4,
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
      objective: 'Cross the bastion and open the gate.',
      biome: 'bastion',
      ring: 5,
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
      objective: 'Reach Darklane and keep the convoy alive.',
      biome: 'darklane',
      ring: 6,
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
      objective: 'Defeat the guardian and secure the Starforge.',
      biome: 'starforge',
      ring: 7,
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
    mapOpen: false,
    storyLog: [],
    storyIndex: 0,
    unlockedRing: 1,
    currentNodeId: null,
    cameraShake: 0,
    cameraShakeTimer: 0,
    cameraNoiseSeed: Math.random() * 10,
    menuSelection: 0
  };

  const world = {
    nodes: [],
    edges: [],
    nodeMap: new Map(),
    nodeFields: new Map(),
    discovered: new Set(),
    cacheClaims: {},
    bossesDefeated: {},
    stationContracts: {}
  };

  const entities = {
    enemies: [],
    projectiles: [],
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
    upgrades: {
      engine: 0,
      blaster: 0,
      capacitor: 0,
      shield: 0,
      hull: 0,
      booster: 0
    },
    ship: {
      hullId: 'courier',
      engineId: 'standard',
      shieldId: 'standard',
      primaryId: 'laser',
      secondaryId: 'plasma',
      droneBayId: 'basic'
    },
    unlocked: {
      hulls: ['courier'],
      engines: ['standard'],
      shields: ['standard'],
      drones: ['basic'],
      weapons: ['laser', 'plasma']
    },
    blueprints: new Set(),
    cosmetics: new Set(),
    toys: new Set()
  };

  const mission = {
    active: false,
    type: '',
    target: 0,
    progress: 0,
    reward: 0,
    text: ''
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
        x: rng() * WORLD.size - WORLD.size / 2,
        y: rng() * WORLD.size - WORLD.size / 2,
        size: randRange(rng, sizeMin, sizeMax),
        alpha: randRange(rng, 0.3, 1),
        twinkle: randRange(rng, 0.4, 1.4)
      }))
    };
  }

  function createDustField({ seed, count }) {
    const rng = mulberry32(seed);
    return Array.from({ length: count }).map(() => ({
      x: rng() * WORLD.size - WORLD.size / 2,
      y: rng() * WORLD.size - WORLD.size / 2,
      size: randRange(rng, 10, 32),
      alpha: randRange(rng, 0.1, 0.3)
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

  const dustField = createDustField({ seed: 3001, count: 80 });

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

  function sectorKey(sx, sy) {
    return `${sx},${sy}`;
  }

  function buildGalaxyGraph() {
    const rng = mulberry32(GALAXY_SEED);
    const nodes = [];
    const edges = [];
    const nodeMap = new Map();

    const namePrefixes = ['Tenney', 'Aster', 'Lumen', 'Orion', 'Kepler', 'Drift', 'Helios', 'Aurora', 'Atlas', 'Vesper'];
    const nameSuffixes = ['Reach', 'Gate', 'Hold', 'Spire', 'Relay', 'Cross', 'Vale', 'Bastion', 'Harbor', 'Forge'];

    let idCounter = 0;

    for (let ring = 0; ring <= WORLD.rings; ring += 1) {
      const count = ring === 0 ? 1 : Math.floor(randRange(rng, 4, 7) + ring * 0.6);
      const radius = ring * WORLD.ringSpacing;
      for (let i = 0; i < count; i += 1) {
        const angle = randRange(rng, 0, Math.PI * 2);
        const offset = randRange(rng, -WORLD.ringSpacing * 0.2, WORLD.ringSpacing * 0.2);
        const x = Math.cos(angle) * (radius + offset);
        const y = Math.sin(angle) * (radius + offset);
        const prefix = namePrefixes[Math.floor(rng() * namePrefixes.length)];
        const suffix = nameSuffixes[Math.floor(rng() * nameSuffixes.length)];
        const biome = pickBiomeForRing(ring);
        const node = {
          id: `node-${idCounter++}`,
          name: `${prefix} ${suffix}`,
          x,
          y,
          ring,
          biome,
          isStation: rng() < 0.6 || ring === 0,
          isGate: false,
          isBoss: false
        };
        nodes.push(node);
        nodeMap.set(node.id, node);
      }
    }

    const nodesByRing = new Map();
    nodes.forEach((node) => {
      if (!nodesByRing.has(node.ring)) nodesByRing.set(node.ring, []);
      nodesByRing.get(node.ring).push(node);
    });

    for (let ring = 1; ring <= WORLD.rings; ring += 1) {
      const current = nodesByRing.get(ring) || [];
      const previous = nodesByRing.get(ring - 1) || [];
      current.forEach((node) => {
        const target = previous.reduce((closest, candidate) => {
          const d = dist(node.x, node.y, candidate.x, candidate.y);
          if (!closest || d < closest.dist) return { node: candidate, dist: d };
          return closest;
        }, null);
        if (target) edges.push([node.id, target.node.id]);
      });
      current.forEach((node, idx) => {
        const neighbor = current[(idx + 1) % current.length];
        if (neighbor) edges.push([node.id, neighbor.id]);
      });
      current.forEach((node) => {
        if (rng() < 0.35 && previous.length > 1) {
          const pick = previous[Math.floor(rng() * previous.length)];
          if (pick) edges.push([node.id, pick.id]);
        }
      });
    }

    return { nodes, edges, nodeMap };
  }

  function pickBiomeForRing(ring) {
    if (ring <= 1) return 'driftline';
    if (ring === 2) return 'glasswake';
    if (ring === 3) return 'stormvault';
    if (ring === 4) return 'redshift';
    if (ring === 5) return 'bastion';
    if (ring === 6) return 'darklane';
    return 'starforge';
  }

  function assignStoryNodes() {
    STORY.forEach((chapter) => {
      const candidates = world.nodes.filter((node) => node.ring === chapter.ring);
      if (!candidates.length) return;
      const gateNode = candidates.reduce((best, node) => {
        if (!best) return node;
        return dist(0, 0, node.x, node.y) > dist(0, 0, best.x, best.y) ? node : best;
      }, null);
      if (gateNode) gateNode.isGate = true;

      if (chapter.goal.type === 'boss') {
        const bossNode = candidates[Math.floor(candidates.length / 2)];
        if (bossNode) bossNode.isBoss = true;
      }
    });
  }

  function buildGalaxy() {
    const graph = buildGalaxyGraph();
    world.nodes = graph.nodes;
    world.edges = graph.edges;
    world.nodeMap = graph.nodeMap;
    assignStoryNodes();
  }

  function generateNodeField(node) {
    if (world.nodeFields.has(node.id)) return world.nodeFields.get(node.id);
    const seed = GALAXY_SEED + node.ring * 91 + node.x * 0.01;
    const rng = mulberry32(Math.floor(seed));
    const biome = BIOMES[node.biome];
    const asteroids = [];
    const planets = [];
    const stations = [];
    const caches = [];
    const storms = [];
    const anomalies = [];

    const asteroidCount = Math.floor(randRange(rng, 10, 24) * biome.threat);
    for (let i = 0; i < asteroidCount; i += 1) {
      asteroids.push({
        x: node.x + randRange(rng, -340, 340),
        y: node.y + randRange(rng, -340, 340),
        radius: randRange(rng, 16, 52),
        drift: randRange(rng, -6, 6),
        spin: randRange(rng, -0.3, 0.3)
      });
    }

    if (rng() < 0.35) {
      planets.push({
        x: node.x + randRange(rng, -420, 420),
        y: node.y + randRange(rng, -420, 420),
        radius: randRange(rng, 60, 140),
        hue: randRange(rng, biome.hue - 20, biome.hue + 40)
      });
    }

    if (node.isStation || rng() < 0.2) {
      stations.push({
        x: node.x + randRange(rng, -160, 160),
        y: node.y + randRange(rng, -160, 160),
        radius: randRange(rng, 42, 60)
      });
    }

    if (rng() < 0.35 && !world.cacheClaims[node.id]) {
      caches.push({
        x: node.x + randRange(rng, -260, 260),
        y: node.y + randRange(rng, -260, 260),
        radius: 18,
        blueprint: pickRandomBlueprint(rng)
      });
    }

    if (rng() < 0.45) {
      storms.push({
        x: node.x + randRange(rng, -280, 280),
        y: node.y + randRange(rng, -280, 280),
        radius: randRange(rng, 120, 220),
        intensity: randRange(rng, 0.3, 0.7)
      });
    }

    if (rng() < 0.32) {
      anomalies.push({
        x: node.x + randRange(rng, -240, 240),
        y: node.y + randRange(rng, -240, 240),
        radius: randRange(rng, 40, 70),
        charge: 0
      });
    }

    const field = { asteroids, planets, stations, caches, storms, anomalies };
    world.nodeFields.set(node.id, field);
    return field;
  }

  function pickRandomBlueprint(rng) {
    const keys = Object.keys(BLUEPRINTS);
    return keys[Math.floor(rng() * keys.length)];
  }

  function applyBlueprintEffects(stats) {
    const result = { ...stats };
    const bonus = {
      droneBonus: 0,
      critBonus: 0,
      empBonus: 0,
      damageMult: 1,
      shieldMult: 1,
      speedMult: 1,
      thrustMult: 1,
      shieldRegenMult: 1,
      hullMult: 1
    };
    player.blueprints.forEach((id) => {
      const blueprint = BLUEPRINTS[id];
      if (!blueprint) return;
      const effect = blueprint.effect || {};
      if (effect.droneBonus) bonus.droneBonus += effect.droneBonus;
      if (effect.critBonus) bonus.critBonus += effect.critBonus;
      if (effect.empBonus) bonus.empBonus += effect.empBonus;
      if (effect.damageMult) bonus.damageMult *= effect.damageMult;
      if (effect.shieldMult) bonus.shieldMult *= effect.shieldMult;
      if (effect.speedMult) bonus.speedMult *= effect.speedMult;
      if (effect.thrustMult) bonus.thrustMult *= effect.thrustMult;
      if (effect.shieldRegenMult) bonus.shieldRegenMult *= effect.shieldRegenMult;
      if (effect.hullMult) bonus.hullMult *= effect.hullMult;
    });
    result.maxHp *= bonus.hullMult;
    result.maxShield *= bonus.shieldMult;
    result.maxSpeed *= bonus.speedMult;
    result.thrust *= bonus.thrustMult;
    result.shieldRegen *= bonus.shieldRegenMult;
    result.damageMult = bonus.damageMult;
    result.droneBonus = bonus.droneBonus;
    result.critBonus = bonus.critBonus;
    result.empBonus = bonus.empBonus;
    return result;
  }

  function computeStats() {
    const hull = HULLS[player.ship.hullId] || HULLS.courier;
    const engine = ENGINES[player.ship.engineId] || ENGINES.standard;
    const shield = SHIELDS[player.ship.shieldId] || SHIELDS.standard;
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
    missionTracker.kills = {};
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
      player.ship = {
        hullId: 'courier',
        engineId: 'standard',
        shieldId: 'standard',
        primaryId: 'laser',
        secondaryId: 'plasma',
        droneBayId: 'basic'
      };
      player.unlocked = {
        hulls: ['courier'],
        engines: ['standard'],
        shields: ['standard'],
        drones: ['basic'],
        weapons: ['laser', 'plasma']
      };
      player.chapterIndex = 0;
      player.distanceThisChapter = 0;
      player.distanceTotal = 0;
      player.checkpointIndex = 0;
      state.storyIndex = 0;
      state.unlockedRing = 1;
      state.storyLog = [];
      world.discovered.clear();
      world.cacheClaims = {};
      world.bossesDefeated = {};
      world.stationContracts = {};
      world.nodeFields.clear();
      contract.active = false;
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

  function getCurrentNode() {
    const node = world.nodes.reduce((best, candidate) => {
      const d = dist(player.x, player.y, candidate.x, candidate.y);
      if (!best || d < best.dist) return { node: candidate, dist: d };
      return best;
    }, null);
    if (node && node.dist < WORLD.nodeRadius) {
      state.currentNodeId = node.node.id;
      if (!world.discovered.has(node.node.id)) {
        world.discovered.add(node.node.id);
        awardCredits(50, 'Sector discovered');
        pushStoryLog(`Discovered ${node.node.name}.`);
      }
      return node.node;
    }
    return null;
  }

  function applyBlueprint(blueprintId) {
    const blueprint = BLUEPRINTS[blueprintId];
    if (!blueprint || player.blueprints.has(blueprintId)) return;
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
    if (unlock.cosmetic) player.cosmetics.add(unlock.cosmetic);
    refreshStats({ keepRatios: true });
    spawnDrones();
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
      shield: def.role === 'carrier' ? 60 : 0
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
      hp: 760 + player.level * 55,
      maxHp: 760 + player.level * 55,
      shield: 280,
      maxShield: 280,
      fireCooldown: 0.9,
      state: 'chase',
      size: 56,
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
    const bay = DRONE_BAYS[player.ship.droneBayId] || DRONE_BAYS.basic;
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
    const critChance = 0.06 + (cachedStats.critBonus || 0);
    let final = amount;
    if (options.canCrit && Math.random() < critChance) {
      final *= 1.65;
      spawnEffect(target.x, target.y, '#ffd166', 12);
    }
    if (target === player) {
      if (player.shield > 0) {
        const absorbed = Math.min(player.shield, final * 0.75);
        player.shield -= absorbed;
        final -= absorbed;
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
      world.bossesDefeated[player.chapterIndex] = true;
      awardCredits(700, 'Boss defeated');
      maybeAdvanceChapter(true);
    }
  }

  function spawnProjectile(weapon, originX, originY, dir, isPlayer = true) {
    const spread = weapon.spread || 0;
    const angle = Math.atan2(dir.y, dir.x) + randRange(Math.random, -spread, spread);
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
      pierce: weapon.pierce || false,
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

  function fireWeapon(weaponId, isPrimary = true) {
    const weapon = WEAPONS[weaponId];
    if (!weapon) return;
    if (!player.unlocked.weapons.includes(weaponId)) {
      noteStatus('Weapon locked.');
      return;
    }
    const now = state.time;
    const cooldown = weapon.cooldown;
    if (isPrimary) {
      if (now - player.lastShot < Math.max(cachedStats.fireDelay, cooldown)) return;
      player.lastShot = now;
    } else {
      if (now - player.lastAltShot < cooldown) return;
      player.lastAltShot = now;
    }
    if (player.energy < weapon.energy) {
      noteStatus('Not enough energy.');
      return;
    }
    player.energy = clamp(player.energy - weapon.energy, 0, cachedStats.energyMax);
    const dir = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
    const damage = weapon.damage * cachedStats.damage * (cachedStats.damageMult || 1);
    if (weapon.pellets) {
      for (let i = 0; i < weapon.pellets; i += 1) {
        spawnProjectile({ ...weapon, damage: damage * 0.7 }, player.x + dir.x * 18, player.y + dir.y * 18, dir, true);
      }
    } else {
      spawnProjectile({ ...weapon, damage }, player.x + dir.x * 18, player.y + dir.y * 18, dir, true);
    }
    spawnEffect(player.x + dir.x * 12, player.y + dir.y * 12, weapon.color, 6);
  }

  function fireEMPBlast() {
    const now = state.time;
    if (now - player.lastAltShot < 1.4) return;
    if (player.energy < 45) {
      noteStatus('Not enough energy for EMP.');
      return;
    }
    player.energy -= 45;
    player.lastAltShot = now;
    entities.effects.push({ x: player.x, y: player.y, radius: 30, life: 0.6, color: '#6df0ff', emp: true });
    entities.enemies.forEach((enemy) => {
      if (dist(player.x, player.y, enemy.x, enemy.y) < 180) {
        enemy.stunned = 1.4;
        if (enemy.isBoss) enemy.shield = Math.max(0, enemy.shield - 40);
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
    const boosting = input.keys['ShiftLeft'] || input.keys['ShiftRight'];

    if (turningLeft) player.angle -= cachedStats.turnRate * (dt * 60);
    if (turningRight) player.angle += cachedStats.turnRate * (dt * 60);

    const dir = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
    if (thrusting) {
      player.vx += dir.x * cachedStats.thrust * dt;
      player.vy += dir.y * cachedStats.thrust * dt;
      spawnParticle(player.x - dir.x * 18, player.y - dir.y * 18, 'rgba(125,252,154,0.6)', 0.4, 3, -dir.x * 40 + randRange(Math.random, -10, 10), -dir.y * 40 + randRange(Math.random, -10, 10));
    }
    if (reversing) {
      player.vx -= dir.x * cachedStats.reverseThrust * dt;
      player.vy -= dir.y * cachedStats.reverseThrust * dt;
    }

    if (boosting && player.boost > 0) {
      player.vx += dir.x * cachedStats.thrust * 1.85 * dt;
      player.vy += dir.y * cachedStats.thrust * 1.85 * dt;
      player.boost = clamp(player.boost - 54 * dt, 0, cachedStats.boostMax);
      missionTracker.noBoost = false;
      spawnEffect(player.x - dir.x * 18, player.y - dir.y * 18, '#7dfc9a');
      spawnParticle(player.x - dir.x * 20, player.y - dir.y * 20, 'rgba(125,252,154,0.8)', 0.5, 4, -dir.x * 80, -dir.y * 80);
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

    player.vx *= 0.985;
    player.vy *= 0.985;
    player.x += player.vx * dt;
    player.y += player.vy * dt;

    const maxRadius = (state.unlockedRing + 1.25) * WORLD.ringSpacing;
    const radial = Math.hypot(player.x, player.y);
    if (radial > maxRadius) {
      const dirBack = normalize(player.x, player.y);
      player.x = dirBack.x * maxRadius;
      player.y = dirBack.y * maxRadius;
      player.vx *= -0.2;
      player.vy *= -0.2;
      applyDamage(player, 8);
      noteStatus('Rift boundary destabilized.');
    }

    if (input.keys['Space']) fireWeapon(player.ship.primaryId, true);
    if (input.justPressed['KeyX']) fireWeapon(player.ship.secondaryId, false);
    if (input.justPressed['KeyF']) fireEMPBlast();
    if (input.justPressed['KeyR']) applyCheckpoint(state.checkpoint);

    if (state.time - player.lastHit > cachedStats.shieldDelay) {
      player.shield = clamp(player.shield + cachedStats.shieldRegen * dt, 0, cachedStats.maxShield);
    }
    player.energy = clamp(player.energy + cachedStats.energyRegen * dt, 0, cachedStats.energyMax);
  }

  function spawnWave(node, dt) {
    if (!node) return;
    const biome = BIOMES[node.biome];
    node.spawnTimer = (node.spawnTimer || 0) - dt;
    if (node.spawnTimer > 0) return;
    const maxEnemies = 4 + Math.floor(player.level * 1.6 + node.ring);
    if (entities.enemies.length >= maxEnemies) return;

    const rng = mulberry32(GALAXY_SEED + node.ring * 91 + Math.floor(state.time * 7));
    const choices = ['scout', 'interceptor', 'fighter', 'bomber', 'sniper', 'carrier', 'turret'];
    const threatScale = biome.threat + player.level * 0.05;
    const count = clamp(Math.floor(randRange(rng, 1, 3) + node.ring * 0.3), 1, 4);
    for (let i = 0; i < count; i += 1) {
      const type = choices[Math.floor(rng() * choices.length)];
      const angle = rng() * Math.PI * 2;
      const radius = randRange(rng, 240, 520);
      spawnEnemy(type, player.x + Math.cos(angle) * radius, player.y + Math.sin(angle) * radius, threatScale);
    }
    node.spawnTimer = randRange(rng, 1.1, 2.4) / threatScale;
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
      } else if (enemy.role === 'carrier') {
        const dir = normalize(dx, dy);
        if (distance < 500) {
          enemy.vx -= dir.x * speed * 0.7 * dt;
          enemy.vy -= dir.y * speed * 0.7 * dt;
        } else {
          enemy.vx += dir.x * speed * 0.5 * dt;
          enemy.vy += dir.y * speed * 0.5 * dt;
        }
        if (Math.random() < 0.012) {
          spawnEnemy('interceptor', enemy.x + randRange(Math.random, -40, 40), enemy.y + randRange(Math.random, -40, 40), 1.1);
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
    const node = getCurrentNode();
    if (node) spawnWave(node, dt);

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
    const node = getCurrentNode();
    if (!node) return;
    const field = generateNodeField(node);

    field.asteroids.forEach((asteroid) => {
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

    field.storms.forEach((storm) => {
      if (dist(player.x, player.y, storm.x, storm.y) < storm.radius) {
        player.shield = clamp(player.shield - storm.intensity * 16 * dt, 0, cachedStats.maxShield);
        player.energy = clamp(player.energy - storm.intensity * 9 * dt, 0, cachedStats.energyMax);
      }
    });

    field.anomalies.forEach((anomaly) => {
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
          shot.life = shot.pierce ? shot.life : 0;
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

    field.caches.forEach((cache) => {
      if (dist(player.x, player.y, cache.x, cache.y) < cache.radius + cachedStats.size) {
        if (!world.cacheClaims[node.id]) {
          world.cacheClaims[node.id] = cache.blueprint;
          applyBlueprint(cache.blueprint);
          awardCredits(140, 'Blueprint cache secured');
          spawnLoot(cache.x, cache.y, 'data', 1);
          noteStatus(`Blueprint found: ${BLUEPRINTS[cache.blueprint].name}`);
        }
      }
    });
  }

  function maybeAdvanceChapter(bossDefeated = false) {
    const chapter = STORY[player.chapterIndex];
    if (!chapter) return;

    if (mission.active && mission.progress < mission.target) return;

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
    state.unlockedRing = Math.min(WORLD.rings, state.unlockedRing + 1);
    resetChapterState();
    setCheckpoint();
    showBriefing();
    awardCredits(340, 'Chapter complete');
    if (bossDefeated) {
      const blueprintKeys = Object.keys(BLUEPRINTS);
      const reward = blueprintKeys[(player.chapterIndex + 2) % blueprintKeys.length];
      if (!player.blueprints.has(reward)) {
        applyBlueprint(reward);
        noteStatus(`Chapter reward: ${BLUEPRINTS[reward].name}`);
      }
    }
  }

  function updateMissionProgress() {
    if (!mission.active) return;
    if (mission.type === 'collect' && mission.progress >= mission.target) {
      completeMission();
    }
    if (mission.type === 'kills' && mission.progress >= mission.target) {
      completeMission();
    }
    if (mission.type === 'distance' && player.distanceThisChapter >= mission.target) {
      mission.progress = mission.target;
      completeMission();
    }
    if (mission.type === 'reach_gate') {
      const node = getCurrentNode();
      if (node && node.isGate) {
        mission.progress = mission.target;
        completeMission();
      }
    }
    if (mission.type === 'boss') {
      if (world.bossesDefeated[player.chapterIndex]) {
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
    pushStoryLog(chapter.intro);
  }

  function updateProgress(dt) {
    if (state.mode !== 'flight') return;
    const speed = Math.hypot(player.vx, player.vy);
    player.distanceThisChapter += speed * dt;
    player.distanceTotal += speed * dt;

    const checkpoints = Math.min(3, Math.floor((player.distanceThisChapter / (WORLD.ringSpacing * 3)) * 3));
    if (checkpoints > player.checkpointIndex) {
      player.checkpointIndex = checkpoints;
      setCheckpoint();
      awardCredits(160, 'Checkpoint reached');
    }

    if (mission.type === 'distance') {
      mission.progress = Math.min(mission.target, Math.floor(player.distanceThisChapter));
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
    const node = getCurrentNode();
    if (!node) return;
    const field = generateNodeField(node);
    const station = field.stations.find((s) => dist(player.x, player.y, s.x, s.y) < s.radius + 40);
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

  function createContractForNode(node) {
    if (world.stationContracts[node.id]) return;
    const rng = mulberry32(GALAXY_SEED + node.ring * 13 + node.x * 0.01);
    const templates = [
      { type: 'kills', text: 'Eliminate patrols', target: 8 + Math.floor(rng() * 6) },
      { type: 'collect', text: 'Recover data shards', target: 4 + Math.floor(rng() * 3) },
      { type: 'scan', text: 'Scan the anomaly field', target: 1 },
      { type: 'distance', text: 'Fly a courier run', target: 8000 + Math.floor(rng() * 4000) }
    ];
    const choice = templates[Math.floor(rng() * templates.length)];
    world.stationContracts[node.id] = {
      type: choice.type,
      target: choice.target,
      reward: 240 + choice.target * 22,
      text: choice.text
    };
  }

  function acceptContract(node) {
    const saved = world.stationContracts[node.id];
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
      if (player.energy >= 20) {
        player.energy -= 20;
        state.scanPulse = 2.2;
        noteStatus('Scanner pulse active.');
      } else {
        noteStatus('Insufficient energy for scan.');
      }
    }

    if (input.justPressed['Digit1']) player.ship.primaryId = 'laser';
    if (input.justPressed['Digit2'] && player.unlocked.weapons.includes('pulse')) player.ship.primaryId = 'pulse';
    if (input.justPressed['Digit3'] && player.unlocked.weapons.includes('rail')) player.ship.primaryId = 'rail';

    if (input.justPressed['KeyQ'] && player.unlocked.weapons.includes('plasma')) player.ship.secondaryId = 'plasma';
    if (input.justPressed['KeyZ'] && player.unlocked.weapons.includes('missile')) player.ship.secondaryId = 'missile';
    if (input.justPressed['KeyV'] && player.unlocked.weapons.includes('ion')) player.ship.secondaryId = 'ion';

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
    const node = getCurrentNode();
    const biome = node ? BIOMES[node.biome] : BIOMES.driftline;
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

  function drawNodeField(node, camera) {
    if (!node) return;
    const field = generateNodeField(node);

    field.planets.forEach((planet) => {
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

    field.storms.forEach((storm) => {
      const x = storm.x - camera.x + VIEW.centerX;
      const y = storm.y - camera.y + VIEW.centerY;
      ctx.fillStyle = `rgba(90,160,255,${storm.intensity * 0.2})`;
      ctx.beginPath();
      ctx.arc(x, y, storm.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    field.asteroids.forEach((asteroid) => {
      const x = asteroid.x - camera.x + VIEW.centerX;
      const y = asteroid.y - camera.y + VIEW.centerY;
      ctx.fillStyle = '#283241';
      ctx.beginPath();
      ctx.arc(x, y, asteroid.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(125,252,154,0.12)';
      ctx.stroke();
    });

    field.stations.forEach((station) => {
      const x = station.x - camera.x + VIEW.centerX;
      const y = station.y - camera.y + VIEW.centerY;
      ctx.strokeStyle = 'rgba(125,252,154,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, station.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(125,252,154,0.15)';
      ctx.fill();
      ctx.lineWidth = 1;
    });

    field.anomalies.forEach((anomaly) => {
      const x = anomaly.x - camera.x + VIEW.centerX;
      const y = anomaly.y - camera.y + VIEW.centerY;
      ctx.strokeStyle = 'rgba(111,168,255,0.8)';
      ctx.beginPath();
      ctx.arc(x, y, anomaly.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(111,168,255,${0.15 + anomaly.charge * 0.35})`;
      ctx.fill();
    });

    field.caches.forEach((cache) => {
      if (world.cacheClaims[node.id]) return;
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

  function drawEntities(camera) {
    entities.loot.forEach((drop) => {
      const x = drop.x - camera.x + VIEW.centerX;
      const y = drop.y - camera.y + VIEW.centerY;
      ctx.fillStyle = drop.type === 'credits' ? '#ffd166' : drop.type === 'data' ? '#6df0ff' : '#7dfc9a';
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
      if (enemy.isBoss && enemy.shield > 0) {
        ctx.strokeStyle = 'rgba(125,252,154,0.6)';
        ctx.beginPath();
        ctx.arc(0, 0, enemy.size + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
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

    const px = player.x - camera.x + VIEW.centerX;
    const py = player.y - camera.y + VIEW.centerY;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(player.angle + Math.PI / 2);
    ctx.fillStyle = '#7dfc9a';
    ctx.beginPath();
    ctx.moveTo(0, -cachedStats.size * 1.4);
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
    const mapSize = 130;
    const padding = 12;
    const mapX = VIEW.width - mapSize - padding;
    const mapY = padding;
    ctx.fillStyle = 'rgba(5,10,18,0.7)';
    ctx.fillRect(mapX, mapY, mapSize, mapSize);
    ctx.strokeStyle = 'rgba(125,252,154,0.4)';
    ctx.strokeRect(mapX, mapY, mapSize, mapSize);

    world.nodes.forEach((node) => {
      const nx = mapX + ((node.x + WORLD.size / 2) / WORLD.size) * mapSize;
      const ny = mapY + ((node.y + WORLD.size / 2) / WORLD.size) * mapSize;
      ctx.fillStyle = world.discovered.has(node.id) ? 'rgba(125,252,154,0.6)' : 'rgba(80,90,110,0.4)';
      ctx.beginPath();
      ctx.arc(nx, ny, node.isGate ? 4 : 2, 0, Math.PI * 2);
      ctx.fill();
    });

    const px = mapX + ((player.x + WORLD.size / 2) / WORLD.size) * mapSize;
    const py = mapY + ((player.y + WORLD.size / 2) / WORLD.size) * mapSize;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawShipStatus() {
    ctx.fillStyle = 'rgba(5,10,18,0.55)';
    ctx.fillRect(12, VIEW.height - 96, 280, 84);
    ctx.strokeStyle = 'rgba(125,252,154,0.3)';
    ctx.strokeRect(12, VIEW.height - 96, 280, 84);
    ctx.fillStyle = '#7dfc9a';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Hull ${Math.round(player.hp)}/${Math.round(cachedStats.maxHp)}`, 22, VIEW.height - 68);
    ctx.fillText(`Shield ${Math.round(player.shield)}/${Math.round(cachedStats.maxShield)}`, 22, VIEW.height - 52);
    ctx.fillText(`Energy ${Math.round(player.energy)}/${Math.round(cachedStats.energyMax)}`, 22, VIEW.height - 36);
    ctx.fillText(`Boost ${Math.round(player.boost)}/${Math.round(cachedStats.boostMax)}`, 22, VIEW.height - 20);
  }

  function drawGalaxyMap() {
    ctx.fillStyle = 'rgba(5,10,18,0.85)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#7dfc9a';
    ctx.font = '20px sans-serif';
    ctx.fillText('Aetherline Sector Map', 24, 36);
    ctx.font = '12px sans-serif';
    ctx.fillText('Press M to close map.', 24, 54);

    ctx.strokeStyle = 'rgba(125,252,154,0.2)';
    world.edges.forEach(([fromId, toId]) => {
      const from = world.nodeMap.get(fromId);
      const to = world.nodeMap.get(toId);
      if (!from || !to) return;
      const fx = (from.x / WORLD.size) * 520 + VIEW.centerX;
      const fy = (from.y / WORLD.size) * 520 + VIEW.centerY;
      const tx = (to.x / WORLD.size) * 520 + VIEW.centerX;
      const ty = (to.y / WORLD.size) * 520 + VIEW.centerY;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    });

    world.nodes.forEach((node) => {
      const x = (node.x / WORLD.size) * 520 + VIEW.centerX;
      const y = (node.y / WORLD.size) * 520 + VIEW.centerY;
      const discovered = world.discovered.has(node.id);
      ctx.fillStyle = discovered ? BIOMES[node.biome].accent : 'rgba(80,90,110,0.5)';
      ctx.beginPath();
      ctx.arc(x, y, node.isGate ? 6 : 3, 0, Math.PI * 2);
      ctx.fill();
      if (node.isBoss) {
        ctx.strokeStyle = 'rgba(255,179,71,0.8)';
        ctx.strokeRect(x - 6, y - 6, 12, 12);
      }
      if (node.isStation) {
        ctx.strokeStyle = 'rgba(125,252,154,0.8)';
        ctx.beginPath();
        ctx.arc(x, y, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    const px = (player.x / WORLD.size) * 520 + VIEW.centerX;
    const py = (player.y / WORLD.size) * 520 + VIEW.centerY;
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawStoryLog() {
    ctx.fillStyle = 'rgba(5,10,18,0.85)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#7dfc9a';
    ctx.font = '20px sans-serif';
    ctx.fillText('Aetherline Log', 24, 36);
    ctx.font = '12px sans-serif';
    ctx.fillText('Press L to close log.', 24, 54);
    ctx.fillStyle = '#e0f2ff';
    ctx.font = '13px sans-serif';
    const log = state.storyLog.slice(-16);
    log.forEach((entry, idx) => {
      ctx.fillText(entry, 24, 80 + idx * 18);
    });
  }

  function drawStationOverlay() {
    ctx.fillStyle = 'rgba(5,10,18,0.78)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#7dfc9a';
    ctx.font = '20px sans-serif';
    ctx.fillText('Station Docked', 24, 36);
    ctx.font = '13px sans-serif';
    const options = [
      '1. Repair & Refuel (120 credits)',
      '2. Shipyard - Configure Modules',
      '3. Store - Supplies & Cosmetics',
      '4. Accept Contract',
      '5. Undock'
    ];
    options.forEach((opt, idx) => {
      ctx.fillStyle = idx === state.menuSelection ? '#ffd166' : '#e0f2ff';
      ctx.fillText(opt, 24, 80 + idx * 22);
    });
  }

  function drawShipyardOverlay() {
    ctx.fillStyle = 'rgba(5,10,18,0.82)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#7dfc9a';
    ctx.font = '20px sans-serif';
    ctx.fillText('Shipyard Configuration', 24, 36);
    ctx.font = '13px sans-serif';
    const lines = [
      `Hull: ${HULLS[player.ship.hullId].label}`,
      `Engine: ${ENGINES[player.ship.engineId].label}`,
      `Shield: ${SHIELDS[player.ship.shieldId].label}`,
      `Primary: ${WEAPONS[player.ship.primaryId].label}`,
      `Secondary: ${WEAPONS[player.ship.secondaryId].label}`,
      `Drone Bay: ${DRONE_BAYS[player.ship.droneBayId].label}`
    ];
    lines.forEach((line, idx) => {
      ctx.fillText(line, 24, 70 + idx * 20);
    });
    ctx.fillStyle = '#ffd166';
    ctx.fillText('Use number keys to cycle modules. Press B to exit.', 24, 210);
    ctx.fillStyle = '#e0f2ff';
    ctx.fillText('1 Hull  2 Engine  3 Shield  4 Primary  5 Secondary  6 Drone', 24, 232);
  }

  function drawStoreOverlay() {
    ctx.fillStyle = 'rgba(5,10,18,0.82)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#7dfc9a';
    ctx.font = '20px sans-serif';
    ctx.fillText('Station Store', 24, 36);
    ctx.font = '13px sans-serif';
    STORE_ITEMS.forEach((item, idx) => {
      ctx.fillStyle = idx === state.menuSelection ? '#ffd166' : '#e0f2ff';
      ctx.fillText(`${idx + 1}. ${item.name} - ${item.price} credits`, 24, 70 + idx * 20);
    });
    ctx.fillStyle = '#ffd166';
    ctx.fillText('Press B to exit store.', 24, 70 + STORE_ITEMS.length * 20 + 18);
  }

  function drawOverlay() {
    if (state.mode === 'map') drawGalaxyMap();
    if (state.mode === 'log') drawStoryLog();
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

    const node = getCurrentNode();
    drawNodeField(node, camera);
    drawEntities(camera);
    drawMiniMap(camera);
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
    if (briefKicker) briefKicker.textContent = chapter.kicker;
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
        ship: player.ship,
        unlocked: player.unlocked,
        chapterIndex: player.chapterIndex,
        distanceThisChapter: player.distanceThisChapter,
        distanceTotal: player.distanceTotal,
        checkpointIndex: player.checkpointIndex
      },
      world: {
        discovered: Array.from(world.discovered),
        cacheClaims: world.cacheClaims,
        bossesDefeated: world.bossesDefeated,
        stationContracts: world.stationContracts
      },
      state: {
        unlockedRing: state.unlockedRing,
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
    player.ship = savedPlayer.ship || player.ship;
    player.unlocked = savedPlayer.unlocked || player.unlocked;
    player.chapterIndex = savedPlayer.chapterIndex ?? player.chapterIndex;
    player.distanceThisChapter = savedPlayer.distanceThisChapter ?? player.distanceThisChapter;
    player.distanceTotal = savedPlayer.distanceTotal ?? player.distanceTotal;
    player.checkpointIndex = savedPlayer.checkpointIndex ?? player.checkpointIndex;

    world.discovered = new Set(save.world?.discovered || []);
    world.cacheClaims = save.world?.cacheClaims || {};
    world.bossesDefeated = save.world?.bossesDefeated || {};
    world.stationContracts = save.world?.stationContracts || {};

    state.unlockedRing = save.state?.unlockedRing ?? state.unlockedRing;
    state.storyLog = save.state?.storyLog || [];

    if (save.mission) {
      mission.active = save.mission.active || false;
      mission.type = save.mission.type || '';
      mission.target = save.mission.target || 0;
      mission.progress = save.mission.progress || 0;
      mission.reward = save.mission.reward || 0;
      mission.text = save.mission.text || '';
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

      if (e.code === 'KeyM') {
        if (state.mode === 'flight') {
          state.mapOpen = true;
          state.mode = 'map';
          state.paused = true;
        } else if (state.mode === 'map') {
          state.mapOpen = false;
          state.mode = 'flight';
          state.paused = false;
        }
        return;
      }

      if (e.code === 'KeyL') {
        if (state.mode === 'flight') {
          state.mode = 'log';
          state.paused = true;
        } else if (state.mode === 'log') {
          state.mode = 'flight';
          state.paused = false;
        }
        return;
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
    if (code === 'Digit5' || code === 'KeyB') undock();
  }

  function handleShipyardInput(code) {
    if (code === 'KeyB') {
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
    if (code === 'KeyB') {
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
    const node = getCurrentNode();
    if (!node) return;
    createContractForNode(node);
    acceptContract(node);
  }

  function cycleHull() {
    const hulls = player.unlocked.hulls;
    const index = hulls.indexOf(player.ship.hullId);
    const next = hulls[(index + 1) % hulls.length];
    player.ship.hullId = next;
    refreshStats({ keepRatios: true });
    spawnDrones();
    noteStatus(`Hull set to ${HULLS[next].label}.`);
  }

  function cycleEngine() {
    const engines = player.unlocked.engines;
    const index = engines.indexOf(player.ship.engineId);
    const next = engines[(index + 1) % engines.length];
    player.ship.engineId = next;
    refreshStats({ keepRatios: true });
    noteStatus(`Engine set to ${ENGINES[next].label}.`);
  }

  function cycleShield() {
    const shields = player.unlocked.shields;
    const index = shields.indexOf(player.ship.shieldId);
    const next = shields[(index + 1) % shields.length];
    player.ship.shieldId = next;
    refreshStats({ keepRatios: true });
    noteStatus(`Shield set to ${SHIELDS[next].label}.`);
  }

  function cyclePrimary() {
    const options = player.unlocked.weapons.filter((id) => WEAPONS[id]?.slot === 'primary');
    const index = options.indexOf(player.ship.primaryId);
    const next = options[(index + 1) % options.length];
    if (next) {
      player.ship.primaryId = next;
      noteStatus(`Primary weapon set to ${WEAPONS[next].label}.`);
    }
  }

  function cycleSecondary() {
    const options = player.unlocked.weapons.filter((id) => WEAPONS[id]?.slot === 'secondary');
    const index = options.indexOf(player.ship.secondaryId);
    const next = options[(index + 1) % options.length];
    if (next) {
      player.ship.secondaryId = next;
      noteStatus(`Secondary weapon set to ${WEAPONS[next].label}.`);
    }
  }

  function cycleDroneBay() {
    const bays = player.unlocked.drones;
    const index = bays.indexOf(player.ship.droneBayId);
    const next = bays[(index + 1) % bays.length];
    player.ship.droneBayId = next;
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
    state.storyLog.push(`[${new Date().toLocaleTimeString()}] ${entry}`);
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

    buildGalaxy();

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
