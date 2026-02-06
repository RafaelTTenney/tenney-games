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
  const SAVE_VERSION = 11;
  const SAVE_KEY = `swarmBreakerSave_v${SAVE_VERSION}`;
  const SAVE_BACKUP_KEY = `swarmBreakerSaveBackup_v${SAVE_VERSION}`;
  const WORLD_SEED = 284113;

  const WORLD = {
    sectorSize: 80000,
    gridRadius: 42,
    maxDepth: 40
  };
  WORLD.size = (WORLD.gridRadius * 2 + 1) * WORLD.sectorSize;
  WORLD.half = WORLD.size / 2;
  WORLD.boundary = WORLD.gridRadius * WORLD.sectorSize + WORLD.sectorSize * 0.4;

  const START_CONFIG = {
    ringMin: 3,
    ringMax: 5,
    offsetScale: 0.28
  };

  const CLUSTER_FIELDS = {
    count: 6,
    centerRadius: 3.1,
    minRadius: 1.5,
    maxRadius: 2.2,
    spacingMin: 6.0,
    spacingMax: 9.0,
    minRatio: 0.65,
    maxRatio: 1.35,
    voidThreshold: 0.42,
    coreThreshold: 0.72,
    richThreshold: 0.86
  };

  const HYPER = {
    maxCharge: 100,
    steps: 10,
    cooldown: 4,
    minDistance: 0,
    maxJumpMinutes: 10,
    radarRangeMult: 1.8
  };

  const PHYSICS = {
    linearDamp: 0.986,
    assistDamp: 0.88,
    angularDamp: 0.86,
    maxAngular: 3.25,
    collisionElasticity: 0.28,
    collisionDamp: 0.7,
    gravityConstant: 18000,
    gravityMinRadius: 70,
    gravityMaxRadius: 380
  };

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

  const SIGNAL_SCOPE = {
    radius: 72,
    range: 3600,
    x: 96,
    y: 248
  };

  const EXPLORATION_MILESTONES = [
    { id: 'm1', distance: 260000, reward: { credits: 500 }, label: 'Outer Drift Marker' },
    { id: 'm2', distance: 620000, reward: { blueprint: 'scanner_drone', credits: 650 }, label: 'Deep Survey Relay' },
    { id: 'm3', distance: 1100000, reward: { blueprint: 'turbo_engine', credits: 800 }, label: 'Interstice Run' },
    { id: 'm4', distance: 1800000, reward: { blueprint: 'shield_overdrive', credits: 1000 }, label: 'Voidline Record' },
    { id: 'm5', distance: 2600000, reward: { blueprint: 'hyper_engine', credits: 1400 }, label: 'Frontier Longhaul' }
  ];

  const CREW_ROLES = [
    { id: 'navigator', label: 'Navigator', max: 3, baseCost: 320, summary: 'Hyper efficiency + range' },
    { id: 'engineer', label: 'Engineer', max: 3, baseCost: 300, summary: 'Fuel efficiency + hull stability' },
    { id: 'quartermaster', label: 'Quartermaster', max: 3, baseCost: 280, summary: 'Cargo capacity + salvage yield' }
  ];

  const CAPTURE_SYSTEM = {
    maxPressure: 100,
    hit: 18,
    decay: 7,
    warning: 70
  };

  const PATROL_SPAWN = {
    quietTime: 42,
    minDistance: 720,
    maxDistance: 980
  };

  const CALLSIGNS = [
    'Drift',
    'Halo',
    'Ridge',
    'Fable',
    'Comet',
    'Nova',
    'Pulse',
    'Vector',
    'Skylark',
    'Rift',
    'Echo',
    'Vantage'
  ];

  const RADIO_CHATTER = {
    start: [
      'Control: Unaligned pilot detected. Keep comms open.',
      'Control: Lone craft on scope. No flight assigned yet.',
      'Control: Unknown wing inbound. Stay sharp.'
    ],
    patrol: [
      'Radio: Patrol silhouettes ahead. Keep dark if you can.',
      'Radio: Multiple blips, mid-range. Possible convoy.',
      'Radio: Hostile chatter in the lane. Weapons free if engaged.'
    ],
    trader: [
      'Radio: Merchant ping detected. Hail if you need supplies.',
      'Radio: Civilian traffic nearby. Check the signal scope.'
    ],
    capture: [
      'Control: Capture attempt detected. They want you alive.',
      'Control: Tractor locks on your signature. Brace.'
    ]
  };

  const ATLAS_SIGILS = [
    { biome: 'driftline', name: 'Driftline Sigil' },
    { biome: 'glasswake', name: 'Glasswake Sigil' },
    { biome: 'stormvault', name: 'Stormvault Sigil' },
    { biome: 'redshift', name: 'Redshift Sigil' },
    { biome: 'bastion', name: 'Bastion Sigil' },
    { biome: 'darklane', name: 'Darklane Sigil' },
    { biome: 'starforge', name: 'Starforge Sigil' },
    { biome: 'hollow', name: 'Hollow Sigil' },
    { biome: 'emberveil', name: 'Emberveil Sigil' },
    { biome: 'solstice', name: 'Solstice Sigil' },
    { biome: 'blackout', name: 'Blackout Sigil' }
  ];
  const ATLAS_REQUIRED = 8;

  const BIOMES = {
    driftline: { name: 'Driftline', hue: 185, accent: '#6df0ff', fog: 'rgba(60,110,140,0.12)', dust: 'rgba(110,200,255,0.14)', threat: 0.85 },
    glasswake: { name: 'Glasswake', hue: 210, accent: '#7dfc9a', fog: 'rgba(70,140,180,0.12)', dust: 'rgba(140,220,255,0.12)', threat: 1.05 },
    stormvault: { name: 'Stormvault', hue: 260, accent: '#c77dff', fog: 'rgba(130,90,190,0.16)', dust: 'rgba(180,120,255,0.12)', threat: 1.25 },
    redshift: { name: 'Redshift', hue: 20, accent: '#ff8b5c', fog: 'rgba(180,80,60,0.14)', dust: 'rgba(255,160,120,0.12)', threat: 1.4 },
    bastion: { name: 'Bastion', hue: 135, accent: '#7dfc9a', fog: 'rgba(80,140,100,0.12)', dust: 'rgba(120,230,160,0.12)', threat: 1.55 },
    darklane: { name: 'Darklane', hue: 240, accent: '#8899ff', fog: 'rgba(70,80,150,0.18)', dust: 'rgba(120,140,220,0.12)', threat: 1.7 },
    interstice: { name: 'Interstice Expanse', hue: 205, accent: '#9ad6ff', fog: 'rgba(70,100,130,0.1)', dust: 'rgba(120,170,220,0.08)', threat: 0.55 },
    starforge: { name: 'Starforge', hue: 45, accent: '#ffd166', fog: 'rgba(220,170,90,0.12)', dust: 'rgba(255,210,140,0.12)', threat: 1.9 },
    hollow: { name: 'Hollow Reach', hue: 300, accent: '#f5a6ff', fog: 'rgba(160,90,170,0.15)', dust: 'rgba(210,150,230,0.12)', threat: 2.05 },
    emberveil: { name: 'Emberveil', hue: 15, accent: '#ff9f6b', fog: 'rgba(190,80,60,0.14)', dust: 'rgba(255,150,120,0.12)', threat: 2.2 },
    solstice: { name: 'Solstice', hue: 55, accent: '#ffe08a', fog: 'rgba(220,200,120,0.12)', dust: 'rgba(255,230,170,0.12)', threat: 2.35 },
    blackout: { name: 'Blackout', hue: 230, accent: '#9aa7ff', fog: 'rgba(70,90,140,0.2)', dust: 'rgba(120,140,200,0.14)', threat: 2.55 }
  };

  const REGION_BANDS = [
    ['driftline', 'glasswake'],
    ['stormvault', 'redshift'],
    ['bastion', 'darklane'],
    ['starforge', 'hollow'],
    ['emberveil', 'solstice'],
    ['blackout']
  ];

  const ZONE_TYPES = {
    cluster: { id: 'cluster', label: 'Cluster', boostMult: 1, spawnScale: 1, dustScale: 1 },
    lane: { id: 'lane', label: 'Transit Lane', boostMult: 1.5, spawnScale: 0.5, dustScale: 0.6 },
    expanse: { id: 'expanse', label: 'Interstice Expanse', boostMult: 2.45, spawnScale: 0.12, dustScale: 0.1 },
    rift: { id: 'rift', label: 'Rift Channel', boostMult: 1.65, spawnScale: 0.35, dustScale: 0.35 }
  };

  const BIOME_SPAWNS = {
    driftline: ['scout', 'fighter', 'interceptor'],
    glasswake: ['scout', 'fighter', 'sniper'],
    stormvault: ['interceptor', 'gunship', 'sniper'],
    redshift: ['fighter', 'bomber', 'gunship'],
    bastion: ['fighter', 'turret', 'gunship', 'bomber'],
    darklane: ['interceptor', 'sniper', 'fighter'],
    interstice: ['scout', 'interceptor', 'fighter'],
    starforge: ['gunship', 'bomber', 'turret'],
    hollow: ['interceptor', 'fighter', 'sniper'],
    emberveil: ['bomber', 'gunship', 'fighter'],
    solstice: ['scout', 'fighter', 'interceptor', 'gunship'],
    blackout: ['sniper', 'bomber', 'turret']
  };

  const BIOME_PROPS = {
    driftline: ['ice_spires', 'ice_rings'],
    glasswake: ['glass_shards', 'debris_cluster'],
    stormvault: ['ion_pylons', 'storm_coils'],
    redshift: ['plasma_flares', 'ember_flows'],
    bastion: ['defense_pylons', 'shield_nodes'],
    darklane: ['shadow_mines', 'void_buoys'],
    interstice: ['wayline_arches', 'relay_spires'],
    starforge: ['forge_fragments', 'arc_emitters'],
    hollow: ['relic_spires', 'echo_stones'],
    emberveil: ['ash_ruins', 'flare_towers'],
    solstice: ['prism_arches', 'light_fins'],
    blackout: ['obsidian_spires', 'silent_monoliths']
  };

  const BIOME_VFX = {
    driftline: { veil: 0.22, ribbon: 0.45, spark: 0.45, pattern: 'ribbons' },
    glasswake: { veil: 0.18, ribbon: 0.4, spark: 0.35, pattern: 'shards' },
    stormvault: { veil: 0.28, ribbon: 0.2, spark: 0.35, pattern: 'storm' },
    redshift: { veil: 0.26, ribbon: 0.35, spark: 0.5, pattern: 'embers' },
    bastion: { veil: 0.2, ribbon: 0.3, spark: 0.3, pattern: 'grid' },
    darklane: { veil: 0.25, ribbon: 0.15, spark: 0.25, pattern: 'void' },
    interstice: { veil: 0.12, ribbon: 0.1, spark: 0.2, pattern: 'calm' },
    starforge: { veil: 0.24, ribbon: 0.33, spark: 0.45, pattern: 'forge' },
    hollow: { veil: 0.22, ribbon: 0.25, spark: 0.4, pattern: 'echo' },
    emberveil: { veil: 0.3, ribbon: 0.35, spark: 0.55, pattern: 'embers' },
    solstice: { veil: 0.2, ribbon: 0.45, spark: 0.4, pattern: 'prism' },
    blackout: { veil: 0.32, ribbon: 0.12, spark: 0.2, pattern: 'void' }
  };

  const BIOME_ATMOS_INTENSITY = 0.65;

  const BIOME_NOTES = {
    driftline: 'Cold fog, crystal spires, light patrols.',
    glasswake: 'Shard fields and debris wakes hide caches.',
    stormvault: 'Ion storms drain energy and slow turns.',
    redshift: 'Hot tides distort aim; expect heavy patrols.',
    bastion: 'Defense lattice zones with turrets and shields.',
    darklane: 'Low-light voids with mines and silent buoys.',
    interstice: 'Wide empty lanes between clusters.',
    starforge: 'Forge debris and arc emitters, high threat.',
    hollow: 'Echo relics and spectral stones, ambush prone.',
    emberveil: 'Ash ruins and flare towers; high heat.',
    solstice: 'Prismatic fins and bright arcs; high visibility.',
    blackout: 'Obsidian spires and dead-light monoliths.'
  };

  const LANDMARK_TYPES = [
    { id: 'drift_relay', name: 'Drift Relay', biome: 'driftline', color: '#6df0ff', radius: 52, reward: { credits: 260, lore: true } },
    { id: 'glass_obelisk', name: 'Glass Obelisk', biome: 'glasswake', color: '#7dfc9a', radius: 50, reward: { credits: 240, blueprint: true } },
    { id: 'storm_array', name: 'Storm Array', biome: 'stormvault', color: '#c77dff', radius: 56, reward: { credits: 300, lore: true } },
    { id: 'redshift_anchor', name: 'Redshift Anchor', biome: 'redshift', color: '#ff8b5c', radius: 54, reward: { credits: 280, blueprint: true } },
    { id: 'bastion_fort', name: 'Bastion Fort', biome: 'bastion', color: '#7dfc9a', radius: 58, reward: { credits: 320, rep: { bastion_order: 6 } } },
    { id: 'darklane_shrine', name: 'Void Shrine', biome: 'darklane', color: '#8899ff', radius: 54, reward: { credits: 280, lore: true } },
    { id: 'forge_gate', name: 'Forge Gate', biome: 'starforge', color: '#ffd166', radius: 60, reward: { credits: 360, blueprint: true } },
    { id: 'echo_temple', name: 'Echo Temple', biome: 'hollow', color: '#f5a6ff', radius: 56, reward: { credits: 300, lore: true } },
    { id: 'ember_ruin', name: 'Ember Ruin', biome: 'emberveil', color: '#ff9f6b', radius: 54, reward: { credits: 320, blueprint: true } },
    { id: 'prism_temple', name: 'Prism Temple', biome: 'solstice', color: '#ffe08a', radius: 56, reward: { credits: 300, lore: true } },
    { id: 'blackout_core', name: 'Blackout Core', biome: 'blackout', color: '#9aa7ff', radius: 62, reward: { credits: 340, blueprint: true } },
    { id: 'interstice_derelict', name: 'Drift Derelict', biome: 'interstice', color: '#9ad6ff', radius: 48, reward: { credits: 220, lore: true } }
  ];

  const PROP_HAZARDS = {
    ion_pylons: { energyDrain: 14, shieldDrain: 4 },
    storm_coils: { energyDrain: 18, slow: 0.85 },
    plasma_flares: { hullDamage: 6, shieldDrain: 10 },
    ember_flows: { hullDamage: 4, energyDrain: 8 },
    shadow_mines: { slow: 0.7 },
    defense_pylons: { shieldDrain: 12 },
    shield_nodes: { shieldDrain: 6, energyDrain: 6 }
  };

  const EVENT_DEFS = {
    comet: { id: 'comet', label: 'Comet Trail', color: '#b8f9ff', life: 18, speed: 260, radius: 18, reward: { salvage: 2, credits: 80 } },
    distress: { id: 'distress', label: 'Distress Beacon', color: '#ffd166', life: 22, radius: 48, reward: { credits: 180, loreChance: 0.6 } },
    driftwave: { id: 'driftwave', label: 'Drift Wave', color: '#6df0ff', life: 14, radius: 120, effect: { boost: 20, energy: 12, hyper: 6 } },
    meteor: { id: 'meteor', label: 'Meteor Shower', color: '#ff9f6b', life: 12, speed: 380, radius: 10, damage: 12 },
    riftflare: { id: 'riftflare', label: 'Rift Flare', color: '#ffd166', life: 10, radius: 80, effect: { boost: 30, fuel: 20, hyper: 8 } }
  };

  const SYSTEM_NAME_PARTS = {
    prefix: ['Aether', 'Vanta', 'Sol', 'Nova', 'Argo', 'Lyra', 'Kessel', 'Orion', 'Vesper', 'Echo', 'Cinder', 'Lux'],
    suffix: ['Reach', 'Gate', 'Belt', 'Span', 'Drift', 'Crown', 'Fall', 'Haven', 'Field', 'Run', 'Vault', 'Pass']
  };

  const FACTIONS = [
    { id: 'aetherline', name: 'Aetherline Initiative', color: '#6df0ff' },
    { id: 'ion_clade', name: 'Ion Clade', color: '#c77dff' },
    { id: 'redshift_cartel', name: 'Redshift Cartel', color: '#ff8b5c' },
    { id: 'bastion_order', name: 'Bastion Order', color: '#7dfc9a' },
    { id: 'darklane_refuge', name: 'Darklane Refuge', color: '#8899ff' }
  ];

  const BASE_TYPES = {
    outpost: { id: 'outpost', label: 'Outpost', hp: 260, shield: 140, radius: 70, turretCount: 3, spawn: ['scout', 'fighter'], color: '#7dfc9a' },
    fortress: { id: 'fortress', label: 'Fortress', hp: 520, shield: 280, radius: 100, turretCount: 5, spawn: ['fighter', 'bomber', 'gunship'], color: '#ffb347' },
    refinery: { id: 'refinery', label: 'Refinery', hp: 340, shield: 180, radius: 86, turretCount: 4, spawn: ['interceptor', 'gunship'], color: '#ffd166' },
    relay: { id: 'relay', label: 'Relay Node', hp: 220, shield: 120, radius: 64, turretCount: 2, spawn: ['scout', 'interceptor'], color: '#6df0ff' }
  };

  const HOME_DEF = {
    id: 'home',
    label: 'Aetherline Bastion City',
    color: '#6df0ff',
    radius: 150,
    turretCount: 6,
    maxShield: 680,
    maxHp: 3000,
    defenseRange: 1400,
    safeRadius: 1200,
    noFireRadius: 900
  };

  const CITY_DEF = {
    radius: 120,
    turretCount: 5,
    maxShield: 520,
    maxHp: 2400,
    defenseRange: 1200,
    safeRadius: 980,
    noFireRadius: 760
  };

  const CITY_SERVICES = ['Shipyard', 'Store', 'Contracts', 'Refuel', 'Ammo', 'Navigation Sync', 'Refinery', 'Crew'];

  const CITY_NAMES = [
    'Driftline City',
    'Solace Ring',
    'Vespera Spire',
    'Helio Anchorage',
    'Argo Civic Port',
    'Lyra Exchange',
    'Cinder Gate',
    'Nova Quay',
    'Orion Bastide',
    'Lux Harbor',
    'Echo Haven',
    'Kessel Atrium',
    'Vanta Rise',
    'Crown Meridian',
    'Aurora Crest',
    'Riftwatch',
    'Starlane Forum',
    'Aegis Terminal',
    'Sable District',
    'Iris Causeway',
    'Nimbus Pier',
    'Halcyon Exchange',
    'Verdant Reach',
    'Oculus Port',
    'Zephyr Terrace',
    'Stoneweave Point',
    'Horizon Crown',
    'Altair Market',
    'Lumen Crossing',
    'Obsidian Row',
    'Trine Bastion',
    'Mariner Fold',
    'Arcadia Gate',
    'Glint Spire',
    'Praxis Yard',
    'Eclipse Arcade',
    'Morrow Docks',
    'Lucent Ward',
    'Apex Harbor',
    'Crescent Exchange'
  ];

  const HEAT = {
    max: 100,
    coolRate: 10,
    scoopRate: 24,
    innerRate: 48,
    warning: 70,
    critical: 90
  };

  const CIVIC_TUTORIAL = {
    reward: 240
  };

  const NO_FIRE_ZONE = {
    stationPadding: 120,
    homePadding: 60,
    warningCooldown: 2.6
  };

  const STAR_SCOOP = {
    innerRatio: 1.1,
    outerRatio: 2.6,
    fuelRate: 24,
    hyperRate: 14,
    heatDamage: 28,
    warningCooldown: 2.8
  };

  const SURVEY_BEACON = {
    reward: 160,
    revealRadius: 2400
  };

  const DISCOVERY_UPLOAD = {
    rewardPerSector: 40
  };

  const TRADER_TYPES = [
    { id: 'scavenger', label: 'Scavenger Barge', color: '#9fd3c7', vibe: 'Buys salvage and sells ammo.' },
    { id: 'arms', label: 'Arms Freighter', color: '#ff9f6b', vibe: 'Stocks munitions and rare hardware.' },
    { id: 'engineer', label: 'Engineer Skiff', color: '#6df0ff', vibe: 'Trades upgrades for relics.' }
  ];

  const CIVILIAN_TYPES = [
    { id: 'shuttle', label: 'Shuttle', size: 16, speed: 48, color: '#9ad6ff', hp: 60 },
    { id: 'hauler', label: 'Cargo Hauler', size: 26, speed: 36, color: '#ffd166', hp: 110 },
    { id: 'freighter', label: 'Long Freighter', size: 34, speed: 28, color: '#7dfc9a', hp: 140 },
    { id: 'liner', label: 'Drift Liner', size: 24, speed: 40, color: '#ff9f6b', hp: 90 }
  ];

  const FRIENDLY_TYPES = [
    { id: 'escort', label: 'Escort Wing', role: 'escort', size: 18, speed: 96, color: '#6df0ff', fireRate: 0.9, damage: 10, range: 520, hp: 70, shield: 24 },
    { id: 'patrol', label: 'Patrol Craft', role: 'patrol', size: 22, speed: 82, color: '#9ad6ff', fireRate: 1.1, damage: 12, range: 560, hp: 95, shield: 36 },
    { id: 'guardian', label: 'Guardian Frigate', role: 'guardian', size: 34, speed: 62, color: '#7dfc9a', fireRate: 1.4, damage: 16, range: 640, hp: 160, shield: 70 }
  ];

  const TRADE_ROUTE_CONFIG = {
    laneChance: 1,
    expanseChance: 0.92,
    clusterChance: 0.55,
    voidChance: 0.6,
    maxRoutesLane: 5,
    maxRoutesExpanse: 4,
    maxRoutesCluster: 3,
    widthMin: 140,
    widthMax: 240,
    lengthMin: 0.65,
    lengthMax: 1.05,
    convoyMin: 4,
    convoyMaxLane: 6,
    convoyMaxExpanse: 5,
    escortChance: 0.92,
    escortMin: 1,
    escortMax: 4
  };

  const IFF_COLORS = {
    friendly: '#6df0ff',
    civilian: 'rgba(159,180,217,0.7)',
    hostile: '#ffb347',
    hostileHeavy: '#ffd166'
  };

  const LIVERY_COLORS = {
    aetherline: { primary: '#6df0ff', secondary: '#c7f7ff' },
    ion_clade: { primary: '#c77dff', secondary: '#f0c1ff' },
    redshift_cartel: { primary: '#ff8b5c', secondary: '#ffd2bf' },
    bastion_order: { primary: '#7dfc9a', secondary: '#d5ffe6' },
    darklane_refuge: { primary: '#8899ff', secondary: '#cfd8ff' },
    neutral: { primary: '#9fb4d9', secondary: '#e0f2ff' }
  };

  const STATION_THEMES = {
    relay: {
      label: 'Interstice Relay',
      ringCount: 3,
      spokeCount: 10,
      finCount: 0,
      coreShape: 'circle',
      services: ['Refuel', 'Navigation Sync', 'Ammo']
    },
    waystation: {
      label: 'Interstice Waystation',
      ringCount: 1,
      spokeCount: 8,
      finCount: 2,
      coreShape: 'diamond',
      services: ['Refuel', 'Store', 'Ammo']
    },
    refinery: {
      label: 'Refinery Outpost',
      ringCount: 2,
      spokeCount: 7,
      finCount: 3,
      coreShape: 'hex',
      services: ['Refuel', 'Refinery', 'Ammo', 'Crew']
    },
    depot: {
      label: 'Supply Depot',
      ringCount: 1,
      spokeCount: 6,
      finCount: 1,
      coreShape: 'diamond',
      services: ['Refuel', 'Ammo', 'Crew']
    },
    outpost: {
      label: 'Frontier Dock',
      ringCount: 2,
      spokeCount: 6,
      finCount: 3,
      coreShape: 'circle',
      services: ['Shipyard', 'Store', 'Contracts', 'Ammo']
    }
  };

  const BIOME_STATION_STYLES = {
    driftline: { label: 'Driftline Observatory', ringCount: 2, spokeCount: 6, finCount: 3, coreShape: 'circle', services: ['Shipyard', 'Store', 'Contracts', 'Refuel', 'Ammo'] },
    glasswake: { label: 'Glasswake Mirrorport', ringCount: 1, spokeCount: 5, finCount: 4, coreShape: 'diamond', services: ['Shipyard', 'Store', 'Contracts', 'Ammo'] },
    stormvault: { label: 'Stormvault Coil Array', ringCount: 3, spokeCount: 8, finCount: 2, coreShape: 'hex', services: ['Shipyard', 'Store', 'Contracts', 'Refuel', 'Ammo'] },
    redshift: { label: 'Redshift Emberdock', ringCount: 1, spokeCount: 7, finCount: 5, coreShape: 'tri', services: ['Shipyard', 'Store', 'Contracts', 'Ammo'] },
    bastion: { label: 'Bastion Citadel', ringCount: 2, spokeCount: 7, finCount: 6, coreShape: 'hex', services: ['Shipyard', 'Store', 'Contracts', 'Refuel', 'Ammo'] },
    darklane: { label: 'Darklane Refuge', ringCount: 1, spokeCount: 4, finCount: 2, coreShape: 'circle', services: ['Shipyard', 'Store', 'Contracts', 'Ammo'] },
    interstice: { label: 'Interstice Relay', ringCount: 3, spokeCount: 10, finCount: 0, coreShape: 'circle', services: ['Refuel', 'Navigation Sync', 'Ammo'] },
    starforge: { label: 'Starforge Foundry', ringCount: 2, spokeCount: 8, finCount: 4, coreShape: 'hex', services: ['Shipyard', 'Store', 'Contracts', 'Refuel', 'Ammo'] },
    hollow: { label: 'Hollow Archive', ringCount: 2, spokeCount: 6, finCount: 3, coreShape: 'diamond', services: ['Shipyard', 'Store', 'Contracts', 'Ammo'] },
    emberveil: { label: 'Emberveil Smelter', ringCount: 1, spokeCount: 7, finCount: 5, coreShape: 'tri', services: ['Shipyard', 'Store', 'Contracts', 'Ammo'] },
    solstice: { label: 'Solstice Prism Dock', ringCount: 2, spokeCount: 6, finCount: 4, coreShape: 'circle', services: ['Shipyard', 'Store', 'Contracts', 'Refuel', 'Ammo'] },
    blackout: { label: 'Blackout Bastille', ringCount: 1, spokeCount: 5, finCount: 4, coreShape: 'hex', services: ['Shipyard', 'Store', 'Contracts', 'Ammo'] }
  };

  const LORE_ENTRIES = [
    { id: 'log_01', title: 'Tenney Belt Broadcast', text: 'The Aetherline Initiative opened recruitment for deep-range pilots.' },
    { id: 'log_02', title: 'Signal Ash', text: 'Ion Clade interference forced Relay Eighty-Seven into emergency drift.' },
    { id: 'log_03', title: 'Scout Debrief', text: 'Glasswake currents are rich with derelict nav cores and hidden caches.' },
    { id: 'log_04', title: 'Launch Manifest', text: 'Transport carriers now deploy interceptors to protect fuel convoys.' },
    { id: 'log_05', title: 'Driftline Memo', text: 'Flight assist fails under sustained boost. Manual control is advised.' },
    { id: 'log_06', title: 'Warden Key', text: 'Starforge security requires three relay keys and a live nav imprint.' },
    { id: 'log_07', title: 'Refuge Convoy', text: 'Darklane refugees have been moving in silent lanes to avoid patrols.' },
    { id: 'log_08', title: 'Stormvault Note', text: 'Ion storms invert shield harmonics. Use staggered recharge cycles.' },
    { id: 'log_09', title: 'Transponder Echo', text: 'Unregistered carriers broadcast a false Aetherline signature.' },
    { id: 'log_10', title: 'Pilot Journal', text: 'The Hollow Reach bends signals. Keep eyes on the thruster glow.' },
    { id: 'log_11', title: 'Aetherline Update', text: 'New cargo protocols prioritize salvage over mineral samples.' },
    { id: 'log_12', title: 'Redshift Advisory', text: 'Redshift tides disrupt homing missiles beyond 600 meters.' },
    { id: 'log_13', title: 'Ops Directive', text: 'Disable refinery cores to cut cartel transport reinforcements.' },
    { id: 'log_14', title: 'Salvage Crew', text: 'Recovered armor plates show unusual lattice patterns.' },
    { id: 'log_15', title: 'Navigation Drift', text: 'Sector grids shift by 0.02 per cycle. Driftline charts updated.' },
    { id: 'log_16', title: 'Docking Protocol', text: 'Home base bays accept bulk ammo only after hazard clearance.' },
    { id: 'log_17', title: 'Carrier Field Notes', text: 'Carriers vent plasma when hangar doors cycle. Exploit the breach.' },
    { id: 'log_18', title: 'Scanner Blueprint', text: 'Scanner drones detect harmonic caches under storm intensity spikes.' },
    { id: 'log_19', title: 'Gunship Report', text: 'Gunships prefer broadside angles. Stay under the stern arc.' },
    { id: 'log_20', title: 'Bastion Order', text: 'Defense lattice nodes coordinate via phased pulse beacons.' },
    { id: 'log_21', title: 'Convoy Schedule', text: 'Transport windows open during solar minima in Emberveil.' },
    { id: 'log_22', title: 'Hollow Signal', text: 'Silent relays still carry echoes of the first Aetherline jump.' },
    { id: 'log_23', title: 'Pilot Test', text: 'Rail spears show 12% higher penetration after nano polishing.' },
    { id: 'log_24', title: 'Shield Lattice', text: 'Nanofiber arrays stabilize faster if energy is kept above 40%.' },
    { id: 'log_25', title: 'Harbor Watch', text: 'Refuge stations are moving to hidden orbitals near Darklane.' },
    { id: 'log_26', title: 'Fleet Doctrine', text: 'Intercept at range, then pull to 350 meters for strikes.' },
    { id: 'log_27', title: 'Cache Rumor', text: 'Blueprints tagged in amber signal illicit modifications.' },
    { id: 'log_28', title: 'Core Leak', text: 'Engine packs run hotter after sustained boost chains.' },
    { id: 'log_29', title: 'Fleet Whisper', text: 'The Starforge guardian tracks threat levels, not hull size.' },
    { id: 'log_30', title: 'Courier Note', text: 'Avoid gravity wells when hauling cargo. Lateral drift grows fast.' },
    { id: 'log_31', title: 'Anomaly Trace', text: 'Anomaly charge peaks when scan pulses align with sector edges.' },
    { id: 'log_32', title: 'Aetherline Memo', text: 'Prototype turrets now fire adaptive clusters at close range.' },
    { id: 'log_33', title: 'Glasswake Echo', text: 'Recovered logs mention a hidden vault beyond the relay gate.' },
    { id: 'log_34', title: 'Outpost Brief', text: 'Enemy outposts seed drones before carriers arrive.' },
    { id: 'log_35', title: 'Driftline Prayer', text: 'Pilots whisper that Driftline storms answer only to patience.' },
    { id: 'log_36', title: 'Refinery Record', text: 'Emberveil cores cycle every 92 seconds; overload at 95.' },
    { id: 'log_37', title: 'Atlas Fragment', text: 'Old Atlas charts show a lattice of hidden relay gates.' },
    { id: 'log_38', title: 'Hollow Beacon', text: 'Beacon arrays use inverted signals to dodge cartel scans.' },
    { id: 'log_39', title: 'Carrier Log', text: 'Transport crews paint their hulls in soot to absorb sensor light.' },
    { id: 'log_40', title: 'Vesper Note', text: 'Vesper stations trade relics for flak canisters.' },
    { id: 'log_41', title: 'Ion Clade Notice', text: 'Ion Clade fleets avoid nebula cores after shield failures.' },
    { id: 'log_42', title: 'Bastion Contract', text: 'Lattice nodes pay extra for base strikes in the inner ring.' },
    { id: 'log_43', title: 'Aetherline Diary', text: 'First jump pilots said the Stars bent like glass.' },
    { id: 'log_44', title: 'Cargo Ledger', text: 'Alloys fetch double value when sold at home base.' },
    { id: 'log_45', title: 'Signal Archive', text: 'Recovered archives show Starforge AI still learning.' },
    { id: 'log_46', title: 'Redshift Warning', text: 'Boost fuel vaporizes faster near redshift anomalies.' },
    { id: 'log_47', title: 'Relay Whisper', text: 'The last relay key is held inside a fortress in the Hollow.' },
    { id: 'log_48', title: 'Convoy Oath', text: 'Refuge convoys hide their lights in dust shadows.' },
    { id: 'log_49', title: 'Guardian Note', text: 'The guardian resets after each phase. Pressure it hard.' },
    { id: 'log_50', title: 'Home Base Dispatch', text: 'Aetherline Bastion is open to all pilots with clean logs.' },
    { id: 'log_51', title: 'Hidden Cove', text: 'A quiet cove near Solstice hides a dormant ship core.' },
    { id: 'log_52', title: 'Convoy Whisper', text: 'Transports run dark when the Hollow storms flare.' },
    { id: 'log_53', title: 'Outpost Scrap', text: 'Outposts reinforce armor with layered asteroid composites.' },
    { id: 'log_54', title: 'Carrier Hymn', text: 'Carrier decks cycle every 30 seconds. Time your strike.' },
    { id: 'log_55', title: 'Darklane Lantern', text: 'Refuge pilots leave light trails to guide lost scouts.' },
    { id: 'log_56', title: 'Echo Relay', text: 'Relay echoes repeat every 14 minutes in the Driftline.' },
    { id: 'log_57', title: 'Pilot Sol', text: 'A veteran swears by pulse repeaters in close quarters.' },
    { id: 'log_58', title: 'Bastion Salvage', text: 'Bastion alloys fetch premium value at home base.' },
    { id: 'log_59', title: 'Rift Fringe', text: 'Rift edges spark with unstable particles after boosts.' },
    { id: 'log_60', title: 'Aetherline Promise', text: 'The Initiative vows to reopen the Starforge for all.' },
    { id: 'log_61', title: 'Glasswake Coil', text: 'Spiral debris coils hide fast-moving patrols.' },
    { id: 'log_62', title: 'Redshift Wake', text: 'Missiles drift off-course in redshift wakes.' },
    { id: 'log_63', title: 'Stormvault Riddle', text: 'Stormvault gates open only during ion troughs.' },
    { id: 'log_64', title: 'Scavenger Pact', text: 'Scavengers trade relics for hull plating.' },
    { id: 'log_65', title: 'Bastion Oath', text: 'Bastion defenders never abandon a relay node.' },
    { id: 'log_66', title: 'Carrier Spine', text: 'Carrier spines hold the launch rails together.' },
    { id: 'log_67', title: 'Hollow Echo', text: 'Echoes in the Hollow distort shield telemetry.' },
    { id: 'log_68', title: 'Solstice Path', text: 'Solstice lanes align when twin stars rise.' },
    { id: 'log_69', title: 'Darklane Cartography', text: 'Cartographers map Darklane in chalk dust.' },
    { id: 'log_70', title: 'Driftline Hymn', text: 'Old pilots hum to keep their hands steady.' },
    { id: 'log_71', title: 'Refinery Coil', text: 'Refinery coils hum just before a flare.' },
    { id: 'log_72', title: 'Archive Fragment', text: 'An archive fragment hints at a hidden jump gate.' },
    { id: 'log_73', title: 'Aetherline Beacon', text: 'Aetherline beacons pulse when the storm clears.' },
    { id: 'log_74', title: 'Convoy Tale', text: 'A convoy once crossed the Hollow without lights.' },
    { id: 'log_75', title: 'Starforge Wake', text: 'Starforge wakes linger longer than expected.' },
    { id: 'log_76', title: 'Guardian Whisper', text: 'The guardian listens for warp echoes.' },
    { id: 'log_77', title: 'Lane Sketch', text: 'A pilot sketched a clear corridor through the lanes.' },
    { id: 'log_78', title: 'Rift Ledger', text: 'Rift beacons restore fuel faster than expected.' },
    { id: 'log_79', title: 'Scout Beacon', text: 'A scout wing placed buoys near a ruin.' },
    { id: 'log_80', title: 'Salvage Note', text: 'Salvage values spike after convoy raids.' },
    { id: 'log_81', title: 'Glasswake Lattice', text: 'Shard reflections can hide turrets.' },
    { id: 'log_82', title: 'Stormvault Pulse', text: 'Ion coils resonate at three-second intervals.' },
    { id: 'log_83', title: 'Redshift Wake', text: 'Boost trails linger in the redshift haze.' },
    { id: 'log_84', title: 'Bastion Alert', text: 'Defense nodes rotate with the gate cycle.' },
    { id: 'log_85', title: 'Darklane Drift', text: 'Shadow mines move when the lights flicker.' },
    { id: 'log_86', title: 'Starforge Tone', text: 'Forge fragments hum on the half hour.' },
    { id: 'log_87', title: 'Hollow Compass', text: 'Echo stones bend compass needles.' },
    { id: 'log_88', title: 'Emberveil Debris', text: 'Ash ruins drift in slow spirals.' },
    { id: 'log_89', title: 'Solstice Calm', text: 'Solstice lanes favor long burns.' },
    { id: 'log_90', title: 'Blackout Signal', text: 'Silent monoliths dampen thrust noise.' },
    { id: 'log_91', title: 'Rift Charter', text: 'Rift channels open wider during storms.' },
    { id: 'log_92', title: 'Lane Memo', text: 'Transit lanes reduce enemy spawns.' },
    { id: 'log_93', title: 'Convoy Schedule', text: 'Transports move every 40 minutes.' },
    { id: 'log_94', title: 'Carrier Deck', text: 'Carrier hangars vent before launches.' },
    { id: 'log_95', title: 'Ruin Map', text: 'Ruins appear near beacon echoes.' },
    { id: 'log_96', title: 'Driftline Ice', text: 'Ice rings amplify scanner pulses.' },
    { id: 'log_97', title: 'Glasswake Cache', text: 'Caches glitter under shard light.' },
    { id: 'log_98', title: 'Stormvault Surge', text: 'Surges drain energy faster than fuel.' },
    { id: 'log_99', title: 'Redshift Tide', text: 'Tides push ships off course.' },
    { id: 'log_100', title: 'Bastion Patrol', text: 'Patrols tighten near relay gates.' },
    { id: 'log_101', title: 'Darklane Refuge', text: 'Refuge beacons flicker in pairs.' },
    { id: 'log_102', title: 'Starforge Echo', text: 'Guardian pings intensify after relic finds.' },
    { id: 'log_103', title: 'Hollow Whisper', text: 'Whispers grow loud near ruins.' },
    { id: 'log_104', title: 'Emberveil Heat', text: 'Heat blooms around flare towers.' },
    { id: 'log_105', title: 'Solstice Arc', text: 'Light fins trace hidden corridors.' },
    { id: 'log_106', title: 'Blackout Drift', text: 'Drift lines vanish in blackout fog.' },
    { id: 'log_107', title: 'Rift Signal', text: 'Rift beacons sync to the nav core.' },
    { id: 'log_108', title: 'Lane Calm', text: 'Transit lanes favor clean boosts.' },
    { id: 'log_109', title: 'Trader Whisper', text: 'Traders barter relics for dampers.' },
    { id: 'log_110', title: 'Salvage Code', text: 'Salvage crews mark wrecks with blue tags.' },
    { id: 'log_111', title: 'Comet Trail', text: 'Comet shards fuel quick repairs.' },
    { id: 'log_112', title: 'Distress Ping', text: 'Distress beacons often hide caches.' },
    { id: 'log_113', title: 'Driftwave Note', text: 'Drift waves refill boost reserves.' },
    { id: 'log_114', title: 'Meteor Warning', text: 'Meteor showers cut through lanes.' },
    { id: 'log_115', title: 'Rift Flare', text: 'Rift flares restore fuel quickly.' },
    { id: 'log_116', title: 'Engine Study', text: 'Hyper packs prefer stable vectors.' },
    { id: 'log_117', title: 'Shield Study', text: 'Overdrive arrays recharge after storms.' },
    { id: 'log_118', title: 'Hull Patch', text: 'Reinforced hulls survive base rams.' },
    { id: 'log_119', title: 'Drone Log', text: 'Repair drones favor wide orbits.' },
    { id: 'log_120', title: 'Weapon Note', text: 'Rail spears pierce thick armor.' },
    { id: 'log_121', title: 'Missile Drift', text: 'Missiles curve in redshift haze.' },
    { id: 'log_122', title: 'Plasma Bloom', text: 'Plasma splashes near shields.' },
    { id: 'log_123', title: 'Flak Report', text: 'Flak spreads wider in lanes.' },
    { id: 'log_124', title: 'Mine Chart', text: 'Mines hold position in calm zones.' },
    { id: 'log_125', title: 'EMP Log', text: 'EMP bursts stutter carrier shields.' },
    { id: 'log_126', title: 'Cargo Ledger', text: 'Relics trade high with engineers.' },
    { id: 'log_127', title: 'Lane Whisper', text: 'A hidden corridor bypasses bastion patrols.' },
    { id: 'log_128', title: 'Rift Echo', text: 'Warp echoes mask scout signatures.' },
    { id: 'log_129', title: 'Driftline Rune', text: 'Ice spires align with old charts.' },
    { id: 'log_130', title: 'Glasswake Note', text: 'Shard density hides abandoned stations.' },
    { id: 'log_131', title: 'Stormvault Log', text: 'Ion storms bend nav lines.' },
    { id: 'log_132', title: 'Redshift Ledger', text: 'Heat cycles peak every 5 minutes.' },
    { id: 'log_133', title: 'Bastion Memo', text: 'Turrets track boost trails.' },
    { id: 'log_134', title: 'Darklane Log', text: 'Shadow mines dim when scanned.' },
    { id: 'log_135', title: 'Starforge Ledger', text: 'Forge echoes sharpen near gates.' },
    { id: 'log_136', title: 'Hollow Note', text: 'Relic spires pulse when approached.' },
    { id: 'log_137', title: 'Emberveil Signal', text: 'Flare towers point to ruins.' },
    { id: 'log_138', title: 'Solstice Note', text: 'Light fins drift with solar winds.' },
    { id: 'log_139', title: 'Blackout Memo', text: 'Monoliths drown out comms.' },
    { id: 'log_140', title: 'Carrier Drift', text: 'Carriers turn slow but strike hard.' },
    { id: 'log_141', title: 'Transport Log', text: 'Transports carry rare relics.' },
    { id: 'log_142', title: 'Interceptor Note', text: 'Interceptors favor tight arcs.' },
    { id: 'log_143', title: 'Gunship Note', text: 'Gunships keep mid-range distance.' },
    { id: 'log_144', title: 'Bomber Note', text: 'Bombers retreat after strikes.' },
    { id: 'log_145', title: 'Sniper Note', text: 'Snipers avoid close orbit.' },
    { id: 'log_146', title: 'Turret Note', text: 'Turrets align with bastion nodes.' },
    { id: 'log_147', title: 'Scout Note', text: 'Scouts flank during storms.' },
    { id: 'log_148', title: 'Fighter Note', text: 'Fighters chase boost trails.' },
    { id: 'log_149', title: 'Rift Manual', text: 'Hyper drive stabilizes during beacons.' },
    { id: 'log_150', title: 'Lane Manual', text: 'Flight assist saves fuel in lanes.' },
    { id: 'log_151', title: 'Cluster Manual', text: 'Clusters hide caches in clear zones.' },
    { id: 'log_152', title: 'Ruin Manual', text: 'Ruins often guard blueprint cores.' },
    { id: 'log_153', title: 'Beacon Log', text: 'Rift beacons pulse with nav data.' },
    { id: 'log_154', title: 'Relic Note', text: 'Relics hum near arc emitters.' },
    { id: 'log_155', title: 'Salvage Note', text: 'Alloy fragments fetch high credits.' },
    { id: 'log_156', title: 'Archive Note', text: 'New logs unlock after scans.' },
    { id: 'log_157', title: 'Transit Note', text: 'Transit lanes reduce turbulence.' },
    { id: 'log_158', title: 'Rift Note', text: 'Rift corridors amplify thrust.' },
    { id: 'log_159', title: 'Home Base', text: 'Aetherline Bastion keeps a wide berth.' },
    { id: 'log_160', title: 'Pilot Log', text: 'Fuel reserves stabilize after hyper jumps.' },
    { id: 'log_161', title: 'Ops Note', text: 'Contracts pay more near deep zones.' },
    { id: 'log_162', title: 'Mission Log', text: 'Base strikes open new gates.' },
    { id: 'log_163', title: 'Shield Log', text: 'Nanofiber arrays prefer steady energy.' },
    { id: 'log_164', title: 'Engine Log', text: 'Turbo packs run hot in redshift.' },
    { id: 'log_165', title: 'Hull Log', text: 'Large hulls handle debris better.' },
    { id: 'log_166', title: 'Drone Log', text: 'Attack drones track carrier bays.' },
    { id: 'log_167', title: 'Store Log', text: 'Traders price ammo by lane traffic.' },
    { id: 'log_168', title: 'Scan Log', text: 'Scanner drones detect ruin cores.' },
    { id: 'log_169', title: 'Boost Log', text: 'Boost trails linger in rift light.' },
    { id: 'log_170', title: 'EMP Log', text: 'EMP pulses strip base shields.' },
    { id: 'log_171', title: 'Mine Log', text: 'Mines drift in calm cluster zones.' },
    { id: 'log_172', title: 'Flak Log', text: 'Flak spreads wider near storms.' },
    { id: 'log_173', title: 'Torpedo Log', text: 'Torpedoes crack fortified hulls.' },
    { id: 'log_174', title: 'Rail Log', text: 'Rail spears pierce layered armor.' },
    { id: 'log_175', title: 'Pulse Log', text: 'Pulse repeaters win close fights.' },
    { id: 'log_176', title: 'Laser Log', text: 'Lasers track faster targets.' },
    { id: 'log_177', title: 'Vault Transmission', text: 'Interstice vaults hum with pre-collapse power.' }
  ];

  const CODEX_ENTRIES = [
    {
      id: 'codex_heat',
      title: 'Heat & Fuel Scooping',
      lines: [
        '- Skim star coronas to refill fuel/hyper, but heat rises fast.',
        '- Back off above 70% heat; 90%+ risks critical damage.'
      ]
    },
    {
      id: 'codex_no_fire',
      title: 'No-Fire Zones',
      lines: [
        '- Cities and major stations lock weapons inside their safety rings.',
        '- Exit the ring to rearm. HUD shows NO-FIRE when active.'
      ]
    },
    {
      id: 'codex_discovery',
      title: 'Discoveries & Uploads',
      lines: [
        '- New sectors award credits. Upload at Navigation Sync for more.',
        '- Use Survey Beacons (violet) to reveal nearby sectors.'
      ]
    },
    {
      id: 'codex_cargo',
      title: 'Cargo, Wrecks, and Traders',
      lines: [
        '- Wrecks yield salvage/alloys/relics. Fly through to collect.',
        '- Cargo capacity appears on the HUD; sell or refine at stations.',
        '- Traders (teal blips) resupply ammo and buy surplus cargo.'
      ]
    },
    {
      id: 'codex_hyper',
      title: 'Hyper Navigation',
      lines: [
        '- Press V to open Hyper Nav, 1-9/0 to set charge, Enter to jump.',
        '- Higher charge = longer range, higher hyper cost.'
      ]
    },
    {
      id: 'codex_signal',
      title: 'Signal Scope',
      lines: [
        '- Hostile contacts tint by faction, friendly combatants are cyan.',
        '- Civilian traffic appears gray; teal is trader/city, green is station.'
      ]
    },
    {
      id: 'codex_insignia',
      title: 'Faction Insignia',
      lines: [
        '- Faction logos are issued when you join a fleet or dock at their city.',
        '- Insignia appears on friendly hulls and convoy liveries.'
      ]
    },
    {
      id: 'codex_capture',
      title: 'Capture & Alignment',
      lines: [
        '- Patrol carriers can capture you and offer a faction pact.',
        '- Join to unlock contracts and faction discounts.'
      ]
    },
    {
      id: 'codex_civic',
      title: 'Civic Cities',
      lines: [
        '- Cities are safe hubs in the expanse with full services.',
        '- Civic Orientation: Repair, upload, then undock for a reward.'
      ]
    }
  ];

  const ZONE_BROADCASTS = {
    cluster: [
      'Aetherline: Cluster traffic heavy. Keep speed below 400.',
      'Signal: Multiple pings detected. Sweep for salvage.',
      'Ops: Enemy scouts reported near the inner ring.',
      'Traffic: Watch for debris pockets ahead.',
      'Relay: Navigation beacons stable.',
      'Scan: Fog density above average.',
      'Control: Keep engines cool through the belt.',
      'Comms: Civilian convoy rerouting.',
      'Aetherline: Repair bays operational.',
      'Notice: Shield fluctuations detected.',
      'Ops: Stay clear of base turrets.',
      'Comms: Trade skiffs inbound.',
      'Notice: Navigation drift stable.',
      'Signal: Static interference cleared.',
      'Ops: Maintain course through debris pockets.'
    ],
    lane: [
      'Transit Lane: Boost windows open.',
      'Lane Control: Maintain vector alignment.',
      'Aetherline: Speed corridor clear.',
      'Navigation: Drift current rising.',
      'Relay: Keep scanners hot for hidden caches.',
      'Notice: Minimal debris field ahead.',
      'Transit: Signal latency reduced.',
      'Comms: Highway convoys en route.',
      'Lane Control: Keep a steady line.',
      'Signal: Rift shimmer visible.',
      'Lane Control: Drift margins widened.',
      'Transit: Boost trail stable.',
      'Notice: Cargo beacons active.',
      'Navigation: Long-range pings steady.',
      'Lane Control: Keep a smooth burn.'
    ],
    expanse: [
      'Interstice: Deep space expanse ahead.',
      'Navigation: Long-range void corridor detected.',
      'Relay: Expanse relays active. Maintain vector.',
      'Notice: Minimal debris across the expanse.',
      'Transit: Interstice hyper windows open.',
      'Signal: Wide-open drift confirmed.',
      'Interstice: Keep eyes on the beacons.',
      'Notice: No patrol clusters in the void.',
      'Transit: Fuel draw reduced in open space.',
      'Relay: Navigation sync stable.',
      'Interstice: Rare ruins reported in the quiet.',
      'Notice: Low turbulence. Burn fast.',
      'Transit: Vast lanes ahead.',
      'Comms: Relay traffic minimal.',
      'Interstice: Keep boosters warm.'
    ],
    rift: [
      'Rift Channel: Supercharge ready.',
      'Warning: Rift turbulence at the edges.',
      'Aetherline: Rift beacons active.',
      'Transit: Boost fields detected.',
      'Rift Control: Hold tight through the flare.',
      'Comms: Warp echoes increasing.',
      'Signal: Rare ruin traces in the channel.',
      'Notice: Keep stabilizers engaged.',
      'Rift Channel: Velocity spikes expected.',
      'Ops: Enemy patrols scarce. Move fast.',
      'Rift Channel: Hyper window open.',
      'Warning: High-velocity debris possible.',
      'Rift Control: Stabilizers aligned.',
      'Signal: Rift beacon harmonics green.',
      'Transit: Warp echoes rising.'
    ]
  };

  const BIOME_BROADCASTS = {
    driftline: [
      'Driftline: Blue haze stable.',
      'Driftline: Ice spires ahead.',
      'Driftline: Scan for cold caches.',
      'Driftline: Fog density moderate.',
      'Driftline: Relays show faint echoes.',
      'Driftline: Slow winds detected.',
      'Driftline: Ice rings glinting.',
      'Driftline: Navigation calm.',
      'Driftline: Relay tones steady.',
      'Driftline: Low patrol density.'
    ],
    glasswake: [
      'Glasswake: Shard fields active.',
      'Glasswake: Watch for brittle debris.',
      'Glasswake: Signal shards detected.',
      'Glasswake: High reflection interference.',
      'Glasswake: Drifting hulls sighted.',
      'Glasswake: Mirror haze rising.',
      'Glasswake: Shard fractures ahead.',
      'Glasswake: Keep scanners tight.',
      'Glasswake: Crystal echoes loud.',
      'Glasswake: Hull scrape risk.'
    ],
    stormvault: [
      'Stormvault: Ion spikes rising.',
      'Stormvault: Shield harmonics unstable.',
      'Stormvault: Coil pylons visible.',
      'Stormvault: Electrical interference reported.',
      'Stormvault: Flight assist advised.',
      'Stormvault: Static arcing nearby.',
      'Stormvault: Ion rain detected.',
      'Stormvault: Coil intensity high.',
      'Stormvault: Sensors flickering.',
      'Stormvault: Keep distance from pylons.'
    ],
    redshift: [
      'Redshift: Plasma currents active.',
      'Redshift: Heat bloom detected.',
      'Redshift: Ember flows ahead.',
      'Redshift: Missile drift increased.',
      'Redshift: Tides intensifying.',
      'Redshift: Thermal haze rising.',
      'Redshift: Flare towers bright.',
      'Redshift: Hull temperature high.',
      'Redshift: Boost burn faster.',
      'Redshift: Heat shells visible.'
    ],
    bastion: [
      'Bastion: Defense pylons online.',
      'Bastion: Fortress lattices tracking.',
      'Bastion: Turrets heavy in this ring.',
      'Bastion: Shield nodes detected.',
      'Bastion: High threat signature.',
      'Bastion: Lattice beams sweeping.',
      'Bastion: Patrol wing inbound.',
      'Bastion: Fortified debris field.',
      'Bastion: Turret arrays synced.',
      'Bastion: Keep shields high.'
    ],
    darklane: [
      'Darklane: Shadow mines suspected.',
      'Darklane: Low light conditions.',
      'Darklane: Refuge traffic nearby.',
      'Darklane: Void buoys drifting.',
      'Darklane: Sensor ghosts reported.',
      'Darklane: Shadows shifting.',
      'Darklane: Silence thick.',
      'Darklane: Refuge beacons faint.',
      'Darklane: Drift speed reduced.',
      'Darklane: Watch for ambush.'
    ],
    interstice: [
      'Interstice: The void stretches wide.',
      'Interstice: Relays keep the lane alive.',
      'Interstice: Watch for faint ruin echoes.',
      'Interstice: Long burn corridor ahead.',
      'Interstice: Navigation lines aligned.',
      'Interstice: Drift is calm.',
      'Interstice: Keep boost charge ready.',
      'Interstice: Silent beacons ahead.',
      'Interstice: Rare caches hide in the dark.',
      'Interstice: The expanse is clear.'
    ],
    starforge: [
      'Starforge: Arc emitters active.',
      'Starforge: Forge fragments detected.',
      'Starforge: Signal clarity high.',
      'Starforge: Guardian signature faint.',
      'Starforge: High-value salvage likely.',
      'Starforge: Forge glow visible.',
      'Starforge: Core harmonics rising.',
      'Starforge: Rare alloy readings.',
      'Starforge: Guardian ping detected.',
      'Starforge: Systems humming.'
    ],
    hollow: [
      'Hollow: Echo stones resonating.',
      'Hollow: Relic spires ahead.',
      'Hollow: Comms distortion increasing.',
      'Hollow: Rift murmurs detected.',
      'Hollow: Keep tight formation.',
      'Hollow: Signals bend strangely.',
      'Hollow: Whisper patterns rising.',
      'Hollow: Relic glow spotted.',
      'Hollow: Sensors lagging.',
      'Hollow: Stay on heading.'
    ],
    emberveil: [
      'Emberveil: Ash ruins drifting.',
      'Emberveil: Heat signature spiking.',
      'Emberveil: Flare towers visible.',
      'Emberveil: Refinery patrols active.',
      'Emberveil: Avoid plasma flare arcs.',
      'Emberveil: Ash rings ahead.',
      'Emberveil: Heat haze thick.',
      'Emberveil: Turbulence rising.',
      'Emberveil: Patrol signature strong.',
      'Emberveil: Keep cooling lines open.'
    ],
    solstice: [
      'Solstice: Prism arches ahead.',
      'Solstice: Light fins shimmering.',
      'Solstice: Clear line of sight.',
      'Solstice: Solar winds minimal.',
      'Solstice: Long-range scans clear.',
      'Solstice: Light currents calm.',
      'Solstice: Navigation stable.',
      'Solstice: Sensor bloom low.',
      'Solstice: Clear runway ahead.',
      'Solstice: Corridor open.'
    ],
    blackout: [
      'Blackout: Obsidian spires detected.',
      'Blackout: Silent monoliths reported.',
      'Blackout: Sensor blackout risk.',
      'Blackout: Visibility low.',
      'Blackout: Keep manual control ready.',
      'Blackout: Signal loss likely.',
      'Blackout: Drift slow.',
      'Blackout: Monolith shadows deep.',
      'Blackout: Lights dim.',
      'Blackout: Keep eyes on HUD.'
    ]
  };

  const TRADER_DIALOGUE = {
    scavenger: [
      'Scavenger: Got spare hull plates for the right price.',
      'Scavenger: Bring relics, leave with upgrades.',
      'Scavenger: Salvage speaks louder than credits.',
      'Scavenger: You fly, I barter.',
      'Scavenger: Radar is clean. Keep it that way.',
      'Scavenger: Driftline scraps still fetch good money.',
      'Scavenger: Watch those storms out there.',
      'Scavenger: I only trade in honest rust.',
      'Scavenger: That thruster glow looks hot.',
      'Scavenger: Need ammo? You know the price.',
      'Scavenger: I can smell a good haul.',
      'Scavenger: Don\'t let the cartel find me.',
      'Scavenger: This sector has teeth.',
      'Scavenger: Salvage keeps us alive.',
      'Scavenger: Bring proof, get paid.'
    ],
    arms: [
      'Arms: Fresh crates in the hold.',
      'Arms: Missiles first, questions later.',
      'Arms: Keep your barrels hot.',
      'Arms: No refunds on plasma.',
      'Arms: I stock what the lanes demand.',
      'Arms: Brought you the good stuff.',
      'Arms: Turrets love a full rack.',
      'Arms: Ammo buys safety.',
      "Arms: That's a clean hull.",
      'Arms: Load up before the next gate.',
      'Arms: Keep your rails charged.',
      'Arms: I hear carriers in the next ring.',
      'Arms: Beware redshift drift.',
      'Arms: Never trust a quiet lane.',
      "Arms: Your targets won't wait."
    ],
    engineer: [
      'Engineer: Bring relics, leave faster.',
      'Engineer: I tune engines for the bold.',
      'Engineer: Stabilizers are overrated.',
      'Engineer: I can fix that wobble.',
      'Engineer: Rift coils still warm.',
      'Engineer: Blueprints taste like ozone.',
      'Engineer: You chasing the guardian?',
      'Engineer: Keep your capacitors cool.',
      'Engineer: I trade in secrets.',
      'Engineer: Driftline tech still works.',
      "Engineer: I don't ask where you got it.",
      'Engineer: Clean lines, sharp turns.',
      'Engineer: You fly better than most.',
      'Engineer: Try the new dampers.',
      'Engineer: Time is fuel.'
    ]
  };

  const RUMOR_ENTRIES = [
    'Rumor: A hidden ruin sleeps in the Stormvault shadows.',
    'Rumor: Aetherline scouts saw a carrier drifting near Emberveil.',
    'Rumor: A relic cache pulses under a Glasswake shard field.',
    'Rumor: A quiet lane hides an abandoned convoy in Darklane.',
    'Rumor: A beacon flickers in the Hollow Reach.',
    'Rumor: Bastion turrets rotate to face a secret outpost.',
    'Rumor: A redshift flare revealed a buried blueprint.',
    'Rumor: Starforge fragments drift near the outer ring.',
    'Rumor: Ion pylons mask a hidden gate.',
    'Rumor: A shipyard ghost still broadcasts in Driftline.',
    'Rumor: A scavenger mapped a safe corridor through blackout.',
    'Rumor: Anomaly echoes align with rift beacons.',
    'Rumor: A derelict carrier holds a coilgun schematic.',
    'Rumor: A storm coil hums near a forgotten ruin.',
    'Rumor: A convoy of refugees vanished near Solstice.',
    'Rumor: A warp ripple marked a relic drift.',
    'Rumor: Pirates cache credits in hollow debris.',
    'Rumor: A shrine of stone floats in the Hollow.',
    'Rumor: Rift channels expose hidden caches.',
    'Rumor: A watchtower sleeps in Bastion cross.',
    'Rumor: Driftline ice rings hide a data vault.',
    'Rumor: Darklane shadow mines guard a ruin.',
    'Rumor: Emberveil ash ruins hold a rare upgrade.',
    'Rumor: Glasswake echoes lead to a lost station.',
    'Rumor: A redshift tide uncovered a relic core.',
    'Rumor: Stormvault lightning reveals a ruin map.',
    'Rumor: Starforge debris hides a guardian key.',
    'Rumor: A convoy beacon pulsed in a rift lane.',
    'Rumor: Bastion nodes pay extra for base strikes.',
    'Rumor: Aetherline pilots track a hidden relay.',
    'Rumor: A silent monolith masks a warp trace.',
    'Rumor: A shattered gate floats near Emberveil.',
    'Rumor: A nebula tear swallowed a patrol wing.',
    'Rumor: A flare tower houses a coil blueprint.',
    'Rumor: A prism arch bends sensor lines.',
    'Rumor: A scatter of wrecks forms a safe pocket.',
    'Rumor: A convoy trail glows faintly in the lane.',
    'Rumor: A salvage ring hides a plasma cache.',
    'Rumor: A rift flare sharpens your boost.',
    'Rumor: A distant broadcast whispers of relics.',
    'Rumor: A decoy beacon masks a ruin.',
    'Rumor: A gunship patrol guards a rare cache.',
    'Rumor: A transport route carries relics.',
    'Rumor: Interstice relays point to a hidden cache.',
    'Rumor: The expanse hides a silent outpost.',
    'Rumor: A slipstream ribbon cuts across the Interstice.',
    'Rumor: A vault ruin waits in the void.',
    'Rumor: A faint light marks an outlaw trader.',
    'Rumor: A hollow echo repeats every 9 minutes.',
    'Rumor: A guardian probe was seen in Starforge.',
    'Rumor: A lane corridor hides a fast warp.',
    'Rumor: A convoy crashed near Glasswake.',
    'Rumor: A storm vault has a hidden core.',
    'Rumor: A rift beacon restored a dying ship.',
    'Rumor: A relic spire hums when scanned.',
    'Rumor: A scout wing vanished near a ruin.',
    'Rumor: A shield node went dark.',
    'Rumor: A black box floats near Bastion.',
    'Rumor: A miner charted a quiet pocket.',
    'Rumor: A rare skin blueprint circulates.',
    'Rumor: A rift lane hides a long-lost nav key.',
    'Rumor: A convoy heading to Solstice is late.',
    'Rumor: A Driftline relay blinks twice at dusk.',
    'Rumor: A hollow gate cracks open at low tide.',
    'Rumor: A hidden cache lies beyond the rift flare.',
    'Rumor: A carrier leaks fuel in the ember belt.',
    'Rumor: A trader sells illegal dampers.',
    'Rumor: A silent buoy transmits in bursts.',
    'Rumor: A salvage tug went missing near redshift.',
    'Rumor: A new outpost rises in the Bastion cross.',
    'Rumor: A relay node broadcasts ancient tones.',
    'Rumor: A storm coil hides a blueprint shard.',
    'Rumor: A darklane convoy needs escort.',
    'Rumor: A prism arch opens a secret path.',
    'Rumor: A redshift flare exposed an alloy vein.',
    'Rumor: A forge fragment pulses with heat.',
    'Rumor: A rift whisper hints at a relic.',
    'Rumor: A convoy beacon flickers near blackout.',
    'Rumor: A hidden cove is free of patrols.',
    'Rumor: A rift lane hums louder after storms.',
    'Rumor: A derelict base still powers turrets.',
    'Rumor: A turret cluster guards a hollow ruin.',
    'Rumor: A stormvault gate half-opens at midnight.',
    'Rumor: A glasswake shard points to a cache.',
    'Rumor: A bastion monolith hides a relic.',
    'Rumor: A silent trader parks in the lane.',
    'Rumor: A carrier wing patrols the outer ring.',
    'Rumor: A driftline void pocket holds salvage.',
    'Rumor: A rift flare restores depleted fuel.',
    'Rumor: A prism arch splits sensor echoes.',
    "Rumor: A convoys' trail reveals a hidden belt."
  ];

  const HULLS = {
    small: { id: 'small', label: 'Small Hull', baseHp: 110, baseShield: 80, size: 14, mass: 0.95, armor: 0.04, cargo: 6, fuelCapacity: 1500, unlockLevel: 1 },
    medium: { id: 'medium', label: 'Medium Hull', baseHp: 150, baseShield: 110, size: 18, mass: 1.1, armor: 0.06, cargo: 10, fuelCapacity: 2000, unlockLevel: 3 },
    large: { id: 'large', label: 'Large Hull', baseHp: 200, baseShield: 150, size: 24, mass: 1.3, armor: 0.08, cargo: 14, fuelCapacity: 2500, unlockLevel: 6 }
  };

  const ENGINES = {
    standard: { id: 'standard', label: 'Standard Pack', thrust: 420, reverse: 260, maxSpeed: 320, turnRate: 0.0064, boostRegen: 24, mass: 0.18, fuelRegen: 0 },
    turbo: { id: 'turbo', label: 'Turbo Pack', thrust: 475, reverse: 290, maxSpeed: 360, turnRate: 0.0068, boostRegen: 28, mass: 0.22, fuelRegen: 0 },
    hyper: { id: 'hyper', label: 'Hyper Pack', thrust: 530, reverse: 320, maxSpeed: 405, turnRate: 0.0073, boostRegen: 32, mass: 0.26, fuelRegen: 0 }
  };

  const SHIELDS = {
    standard: { id: 'standard', label: 'Standard Array', regen: 24, delay: 1.2, capacityBonus: 0, resist: 0.02 },
    overdrive: { id: 'overdrive', label: 'Overdrive Array', regen: 22, delay: 1.1, capacityBonus: 0.18, resist: 0.04 },
    nanofiber: { id: 'nanofiber', label: 'Nanofiber Array', regen: 30, delay: 0.9, capacityBonus: 0.12, resist: 0.05 }
  };

  const DRONE_BAYS = {
    basic: { id: 'basic', label: 'Basic Bay', count: 2, mass: 0.08 },
    advanced: { id: 'advanced', label: 'Advanced Bay', count: 3, mass: 0.1 },
    swarm: { id: 'swarm', label: 'Swarm Bay', count: 5, mass: 0.12 }
  };

  const AMMO_TYPES = {
    slugs: { id: 'slugs', label: 'Rail Slugs', max: 360, price: 2 },
    missiles: { id: 'missiles', label: 'Missiles', max: 60, price: 8 },
    torpedoes: { id: 'torpedoes', label: 'Torpedoes', max: 28, price: 18 },
    flak: { id: 'flak', label: 'Flak Canisters', max: 180, price: 3 },
    mines: { id: 'mines', label: 'Mag Mines', max: 40, price: 6 }
  };

  const WEAPONS = {
    laser: { id: 'laser', label: 'Laser Blaster', slot: 'primary', damage: 12, cooldown: 0.14, speed: 980, energy: 6, color: '#7dfc9a', hitscan: true, recoil: 8 },
    pulse: { id: 'pulse', label: 'Pulse Repeater', slot: 'primary', damage: 9, cooldown: 0.08, speed: 820, energy: 8, color: '#6df0ff', recoil: 10 },
    rail: { id: 'rail', label: 'Rail Spear', slot: 'primary', damage: 34, cooldown: 0.5, speed: 1120, energy: 4, ammoType: 'slugs', ammoCost: 1, color: '#ffd166', recoil: 34 },
    plasma: { id: 'plasma', label: 'Plasma Cannon', slot: 'secondary', damage: 40, cooldown: 0.85, speed: 520, energy: 24, color: '#ffb347', splash: 58, recoil: 18 },
    missile: { id: 'missile', label: 'Missile Rack', slot: 'secondary', damage: 48, cooldown: 1.2, speed: 420, energy: 12, ammoType: 'missiles', ammoCost: 1, color: '#ff6b6b', homing: true, turn: 2.2, recoil: 22 },
    torpedo: { id: 'torpedo', label: 'Torpedo Lance', slot: 'secondary', damage: 90, cooldown: 1.9, speed: 300, energy: 18, ammoType: 'torpedoes', ammoCost: 1, color: '#ff9f6b', splash: 90, recoil: 38 },
    flak: { id: 'flak', label: 'Flak Scatter', slot: 'secondary', damage: 12, cooldown: 0.7, speed: 460, energy: 10, ammoType: 'flak', ammoCost: 2, color: '#c77dff', spread: 0.4, projectiles: 6, recoil: 16 },
    emp: { id: 'emp', label: 'EMP Burst', slot: 'secondary', damage: 18, cooldown: 1.4, speed: 780, energy: 35, color: '#6df0ff', emp: 1.0, recoil: 10 },
    mine: { id: 'mine', label: 'Mag Mines', slot: 'secondary', damage: 54, cooldown: 1.6, speed: 0, energy: 8, ammoType: 'mines', ammoCost: 1, color: '#ff6b6b', mine: true, splash: 70, recoil: 6 }
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
    scanner_drone: { id: 'scanner_drone', name: 'Scanner Drone', unlock: { toy: 'scanner' }, effect: { scanRange: 1.2 } },
    rail_spear: { id: 'rail_spear', name: 'Rail Spear', unlock: { weapon: 'rail' }, effect: { damageMult: 1.05 } },
    pulse_repeater: { id: 'pulse_repeater', name: 'Pulse Repeater', unlock: { weapon: 'pulse' }, effect: { damageMult: 1.03 } },
    flak_scatter: { id: 'flak_scatter', name: 'Flak Scatter', unlock: { weapon: 'flak' }, effect: { damageMult: 1.04 } },
    torpedo_lance: { id: 'torpedo_lance', name: 'Torpedo Lance', unlock: { weapon: 'torpedo' }, effect: { damageMult: 1.08 } },
    magnetic_mines: { id: 'magnetic_mines', name: 'Magnetic Mines', unlock: { weapon: 'mine' }, effect: { damageMult: 1.02 } },
    grav_dampers: { id: 'grav_dampers', name: 'Grav Dampers', unlock: {}, effect: { massMult: 0.92 } }
  };

  const STORE_ITEMS = [
    { id: 'boost_pack', name: 'Boost Pack', type: 'consumable', price: 120, effect: { boost: 45 }, category: 'Boosts' },
    { id: 'energy_cell', name: 'Energy Cell', type: 'consumable', price: 140, effect: { energy: 45 }, category: 'Boosts' },
    { id: 'repair_kit', name: 'Repair Kit', type: 'consumable', price: 170, effect: { hp: 45 }, category: 'Boosts' },
    { id: 'ammo_slugs', name: 'Rail Slugs x20', type: 'ammo', price: 40, effect: { ammo: { slugs: 20 } }, category: 'Ammo' },
    { id: 'ammo_missiles', name: 'Missiles x6', type: 'ammo', price: 60, effect: { ammo: { missiles: 6 } }, category: 'Ammo' },
    { id: 'ammo_torpedoes', name: 'Torpedoes x3', type: 'ammo', price: 72, effect: { ammo: { torpedoes: 3 } }, category: 'Ammo' },
    { id: 'ammo_flak', name: 'Flak x20', type: 'ammo', price: 45, effect: { ammo: { flak: 20 } }, category: 'Ammo' },
    { id: 'ammo_mines', name: 'Mag Mines x4', type: 'ammo', price: 55, effect: { ammo: { mines: 4 } }, category: 'Ammo' },
    { id: 'nebula_skin', name: 'Nebula Skin', type: 'cosmetic', price: 420, effect: { cosmetic: 'nebula' }, category: 'Skins' },
    { id: 'ember_skin', name: 'Ember Skin', type: 'cosmetic', price: 420, effect: { cosmetic: 'ember' }, category: 'Skins' }
  ];

  const ENEMY_TYPES = {
    scout: { role: 'scout', hp: 22, speed: 150, fireRate: 1.4, damage: 6, size: 12, color: '#6df0ff', armor: 0.02 },
    fighter: { role: 'fighter', hp: 42, speed: 120, fireRate: 1.2, damage: 10, size: 16, color: '#ffb347', armor: 0.03 },
    interceptor: { role: 'interceptor', hp: 34, speed: 165, fireRate: 0.9, damage: 9, size: 14, color: '#b8f9ff', armor: 0.02 },
    gunship: { role: 'gunship', hp: 66, speed: 105, fireRate: 1.4, damage: 14, size: 20, color: '#ff9f6b', armor: 0.04 },
    bomber: { role: 'bomber', hp: 75, speed: 90, fireRate: 1.8, damage: 16, size: 22, color: '#ff6b6b', armor: 0.05 },
    sniper: { role: 'sniper', hp: 34, speed: 110, fireRate: 2.3, damage: 18, size: 14, color: '#c77dff', armor: 0.02 },
    turret: { role: 'turret', hp: 95, speed: 0, fireRate: 1.6, damage: 14, size: 24, color: '#8899ff', static: true, armor: 0.08 },
    transport: { role: 'transport', hp: 220, speed: 60, fireRate: 1.8, damage: 18, size: 42, color: '#ffd166', hangar: 4, armor: 0.12 },
    carrier: { role: 'carrier', hp: 360, speed: 50, fireRate: 1.6, damage: 22, size: 54, color: '#ffb347', hangar: 8, armor: 0.16 }
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
      goal: { type: 'kills', target: 12, enemy: 'fighter' },
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
      objective: 'Cover 42,000 km in Redshift space.',
      depth: 5,
      goal: { type: 'distance', target: 42000 },
      optional: [
        { id: 'c5-a', type: 'kills', enemy: 'bomber', target: 4, reward: 240, text: 'Destroy 4 bombers.' },
        { id: 'c5-b', type: 'noHullDamage', reward: 220, text: 'Reach the redshift gate without hull damage.' }
      ]
    },
    {
      id: 6,
      title: 'Bastion Cross',
      kicker: 'Defense Lattice',
      intro: 'Automated bastion platforms guard the cross. Disable their command outpost before the gate locks.',
      objective: 'Destroy the bastion outpost.',
      depth: 6,
      goal: { type: 'base', target: 1 },
      optional: [
        { id: 'c6-a', type: 'kills', enemy: 'turret', target: 4, reward: 260, text: 'Destroy 4 bastion turrets.' },
        { id: 'c6-b', type: 'collect', target: 6, reward: 240, text: 'Collect 6 data shards.' }
      ]
    },
    {
      id: 7,
      title: 'Darklane Refuge',
      kicker: 'Refuge Convoy',
      intro: 'Nebula shadows hide a refugee convoy. The transports cannot fall. Break the interceptors.',
      objective: 'Disable 3 enemy transports.',
      depth: 7,
      goal: { type: 'convoy', target: 3 },
      optional: [
        { id: 'c7-a', type: 'kills', enemy: 'interceptor', target: 8, reward: 260, text: 'Destroy 8 interceptors.' },
        { id: 'c7-b', type: 'noBoost', reward: 240, text: 'Finish without boost.' }
      ]
    },
    {
      id: 8,
      title: 'Hollow Break',
      kicker: 'Ion Clade',
      intro: 'Carrier groups pierce the Hollow Reach. Burn their launch decks before they flood the lane.',
      objective: 'Disable 2 enemy carriers.',
      depth: 8,
      goal: { type: 'carrier', target: 2 },
      optional: [
        { id: 'c8-a', type: 'kills', enemy: 'gunship', target: 6, reward: 280, text: 'Destroy 6 gunships.' },
        { id: 'c8-b', type: 'shieldAtEnd', target: 70, reward: 260, text: 'Finish with 70 shield.' }
      ]
    },
    {
      id: 9,
      title: 'Emberveil Siege',
      kicker: 'Redshift Cartel',
      intro: 'The cartel refinery powers their fleet. Crack the core and salvage its relay keys.',
      objective: 'Destroy the Emberveil refinery.',
      depth: 9,
      goal: { type: 'base', target: 1 },
      optional: [
        { id: 'c9-a', type: 'collect', target: 6, reward: 300, text: 'Collect 6 data shards.' },
        { id: 'c9-b', type: 'kills', enemy: 'bomber', target: 6, reward: 280, text: 'Destroy 6 bombers.' }
      ]
    },
    {
      id: 10,
      title: 'Starforge Arrival',
      kicker: 'Starforge Authority',
      intro: 'The final gate opens into a shipyard of myth. The guardian AI remains online. You must reclaim the forge.',
      objective: 'Defeat the Starforge Guardian.',
      depth: 10,
      goal: { type: 'boss' },
      optional: [
        { id: 'c10-a', type: 'kills', enemy: 'carrier', target: 1, reward: 320, text: 'Destroy a carrier escort.' },
        { id: 'c10-b', type: 'shieldAtEnd', target: 80, reward: 300, text: 'Finish with 80 shield.' }
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
    scanRadius: 1500,
    mapOpen: false,
    storyLog: [],
    menuSelection: 0,
    unlockedDepth: 1,
    currentSectorKey: '0,0',
    lastZoneType: '',
    cameraShake: 0,
    cameraShakeTimer: 0,
    cameraNoiseSeed: Math.random() * 10,
    shiftBoost: { active: false, timer: 0 },
    prompt: null,
    loreScroll: 0,
    hyperDrive: { cooldown: 0 },
    hyperNav: { chargeLevel: 10, targetIndex: 0 },
    hyperJumpFx: { timer: 0, duration: 1.0, pending: null },
    lastBiome: '',
    biomeHintTimer: 0,
    boundaryTimer: 0,
    boundaryWarning: 0,
    broadcastCooldown: 0,
    activeTrader: null,
    activeStation: null,
    traderSelection: 0,
    traderQuote: '',
    rumorCooldown: 0,
    failureLedger: {},
    tutorialSeen: false,
    tutorialActive: false,
    tutorialReady: false,
    tutorialFlags: { moved: false, boosted: false, scanned: false },
    tutorialOrigin: { x: 0, y: 0 },
    trafficSpawnTimer: 0,
    cargoHinted: false,
    purposeHinted: false,
    spawnGrace: 0,
    escape: { active: false, timer: 0, reason: '' },
    capture: { active: false, faction: '', label: '', origin: '' },
    capturePressure: 0,
    captureWindow: 0,
    startEncounterTimer: 0,
    startEncounterSeeded: false,
    radioCooldown: 0,
    enemyQuietTimer: 0,
    hudMode: 'full',
    inNoFireZone: false,
    noFireCooldown: 0,
    scoopCooldown: 0,
    beaconHintCooldown: 0,
    codexSeen: false,
    codexScroll: 0,
    codexReturn: 'flight',
    civicTutorialDone: false,
    civicTutorial: { active: false, step: 0, label: '' },
    introCompleted: false,
    intro: { active: false, phase: '', timer: 0, captureQueued: false },
    atlasUnlocked: false,
    atlasCompleted: false
  };

  const world = {
    sectors: new Map(),
    gates: {},
    gatePositions: {},
    convergenceGate: null,
    clusterFields: [],
    discovered: new Set(),
    bossDefeated: {},
    stationContracts: {},
    baseClaims: {},
    beaconClaims: {},
    ruinClaims: {},
    landmarkClaims: {},
    civicKeys: new Set(),
    cityMap: new Map(),
    cities: [],
    biomeStations: {},
    relayStations: [],
    systemNames: new Map(),
    tradeLanes: [],
    homeBase: {
      x: 0,
      y: 0,
      radius: HOME_DEF.radius,
      name: HOME_DEF.label,
      label: HOME_DEF.label,
      color: HOME_DEF.color,
      hp: HOME_DEF.maxHp,
      maxHp: HOME_DEF.maxHp,
      shield: HOME_DEF.maxShield,
      maxShield: HOME_DEF.maxShield,
      defenseRange: HOME_DEF.defenseRange,
      safeRadius: HOME_DEF.safeRadius,
      noFireRadius: HOME_DEF.noFireRadius,
      turrets: Array.from({ length: HOME_DEF.turretCount }).map((_, idx) => ({
        angle: (Math.PI * 2 * idx) / HOME_DEF.turretCount,
        cooldown: Math.random() * 0.8
      })),
      services: CITY_SERVICES
    }
  };

  const entities = {
    enemies: [],
    projectiles: [],
    beams: [],
    enemyShots: [],
    drones: [],
    loot: [],
    effects: [],
    particles: [],
    structures: [],
    debris: []
  };

  const player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    angularVelocity: 0,
    throttle: 0,
    flightAssist: true,
    hp: 120,
    shield: 90,
    boost: BASE.boostMax,
    energy: BASE.energyMax,
    fuel: 2000,
    hyperCharge: HYPER.maxCharge,
    heat: 0,
    lastShot: 0,
    lastAltShot: 0,
    lastHit: 0,
    credits: 0,
    callsign: '',
    affiliation: '',
    factionRep: {},
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
    crew: {
      navigator: 0,
      engineer: 0,
      quartermaster: 0
    },
    milestones: new Set(),
    discoveryUploads: new Set(),
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
      toys: [],
      cargo: { salvage: 0, alloys: 0, relics: 0 }
    },
    ammo: {
      slugs: 60,
      missiles: 12,
      torpedoes: 4,
      flak: 50,
      mines: 6
    },
    cosmetics: new Set(),
    blueprints: new Set(),
    toys: new Set(),
    lore: new Set(),
    atlasSigils: new Set()
  };

  const mission = {
    active: false,
    type: '',
    target: 0,
    progress: 0,
    reward: 0,
    text: '',
    gateKey: '',
    enemyType: '',
    faction: '',
    spawned: false,
    timeLimit: 0,
    timeRemaining: 0,
    failures: 0,
    baseReward: 0
  };

  const contract = {
    active: false,
    type: '',
    target: 0,
    progress: 0,
    reward: 0,
    text: '',
    originKey: '',
    originBiome: '',
    originFaction: '',
    convoyId: '',
    convoyKey: '',
    escortTime: 0,
    escortTotal: 0,
    raidTimer: 0
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

  function hexToRgb(hex) {
    const clean = hex.replace('#', '');
    const value = clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean;
    const int = Number.parseInt(value, 16);
    return {
      r: (int >> 16) & 255,
      g: (int >> 8) & 255,
      b: int & 255
    };
  }

  function mixColor(a, b, t) {
    const ca = hexToRgb(a);
    const cb = hexToRgb(b);
    const r = Math.round(lerp(ca.r, cb.r, t));
    const g = Math.round(lerp(ca.g, cb.g, t));
    const bch = Math.round(lerp(ca.b, cb.b, t));
    return `rgb(${r}, ${g}, ${bch})`;
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

  const STAR_MULT = Math.max(1, Math.round(WORLD.gridRadius / 18));

  const SKYGRID_STAR_LAYERS = [
    { count: 220, sizeMin: 0.6, sizeMax: 1.6, alphaMin: 0.3, alphaMax: 0.75, speed: 0.18, color: '215,240,255' },
    { count: 150, sizeMin: 1.0, sizeMax: 2.3, alphaMin: 0.35, alphaMax: 0.9, speed: 0.38, color: '140,210,255' },
    { count: 80, sizeMin: 1.5, sizeMax: 3.4, alphaMin: 0.4, alphaMax: 1, speed: 0.62, color: '125,252,154' }
  ];

  const skygridBackground = {
    stars: [],
    nebulae: [],
    comets: [],
    tileW: 0,
    tileH: 0,
    cometTimer: 0
  };

  const nebulaLayers = [
    createNebulaLayer({ seed: 1201, hue: 200, alpha: 0.32 }),
    createNebulaLayer({ seed: 1402, hue: 240, alpha: 0.24 }),
    createNebulaLayer({ seed: 1603, hue: 320, alpha: 0.18 }),
    createNebulaLayer({ seed: 1804, hue: 30, alpha: 0.14 })
  ];

  const starLayers = [
    createStarLayer({ seed: 2201, count: 460 * STAR_MULT, sizeMin: 0.4, sizeMax: 1.4, speed: 0.4, tint: 'rgba(180,220,255,0.7)' }),
    createStarLayer({ seed: 2301, count: 360 * STAR_MULT, sizeMin: 0.7, sizeMax: 1.9, speed: 0.65, tint: 'rgba(140,210,255,0.75)' }),
    createStarLayer({ seed: 2401, count: 240 * STAR_MULT, sizeMin: 1.2, sizeMax: 2.8, speed: 0.95, tint: 'rgba(120,180,255,0.85)' })
  ];

  const dustField = createDustField({ seed: 3001, count: 160 * STAR_MULT });

  function wrapOffset(value, size) {
    const mod = value % size;
    return mod < 0 ? mod + size : mod;
  }

  function buildSkygridBackground() {
    const rng = mulberry32(WORLD_SEED * 11 + 504);
    skygridBackground.stars = [];
    skygridBackground.nebulae = [];
    skygridBackground.comets = [];
    skygridBackground.tileW = Math.max(VIEW.width * 2.7, 2600);
    skygridBackground.tileH = Math.max(VIEW.height * 2.7, 1900);

    const tileW = skygridBackground.tileW;
    const tileH = skygridBackground.tileH;
    const layerScale = Math.max(1, Math.round((VIEW.width + VIEW.height) / 1400));

    SKYGRID_STAR_LAYERS.forEach((layer) => {
      const count = layer.count * layerScale;
      for (let i = 0; i < count; i += 1) {
        skygridBackground.stars.push({
          x: rng() * tileW,
          y: rng() * tileH,
          size: randRange(rng, layer.sizeMin, layer.sizeMax),
          alpha: randRange(rng, layer.alphaMin, layer.alphaMax),
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
    for (let i = 0; i < 3; i += 1) {
      skygridBackground.nebulae.push({
        x: rng() * tileW,
        y: rng() * tileH,
        radius: randRange(rng, 180, 320),
        color: nebulaColors[i % nebulaColors.length],
        alpha: randRange(rng, 0.18, 0.28)
      });
    }

    skygridBackground.cometTimer = randRange(rng, 6, 12);
  }

  function spawnSkygridComet() {
    const edge = Math.floor(Math.random() * 4);
    let x = 0;
    let y = 0;
    if (edge === 0) { x = -80; y = randRange(Math.random, 0, VIEW.height); }
    if (edge === 1) { x = VIEW.width + 80; y = randRange(Math.random, 0, VIEW.height); }
    if (edge === 2) { x = randRange(Math.random, 0, VIEW.width); y = -80; }
    if (edge === 3) { x = randRange(Math.random, 0, VIEW.width); y = VIEW.height + 80; }

    const angle = randRange(Math.random, 0, Math.PI * 2);
    const speed = randRange(Math.random, 220, 420);
    skygridBackground.comets.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randRange(Math.random, 6, 12)
    });
  }

  function updateSkygridBackground(dt) {
    skygridBackground.cometTimer -= dt;
    if (skygridBackground.cometTimer <= 0) {
      spawnSkygridComet();
      skygridBackground.cometTimer = randRange(Math.random, 5, 12);
    }
    skygridBackground.comets.forEach((comet) => {
      comet.x += comet.vx * dt * 0.08;
      comet.y += comet.vy * dt * 0.08;
      comet.life -= dt;
    });
    skygridBackground.comets = skygridBackground.comets.filter((comet) => comet.life > 0);
  }

  function noteStatus(message, duration = 3) {
    if (!statusText) return;
    statusText.textContent = message;
    state.statusTimer = duration;
  }

  function assignCallsign() {
    if (player.callsign) return;
    const rng = mulberry32(WORLD_SEED * 3 + 917);
    const pick = CALLSIGNS[Math.floor(rng() * CALLSIGNS.length)];
    const suffix = Math.floor(randRange(rng, 2, 9));
    player.callsign = `${pick}-${suffix}`;
  }

  function radioMessage(poolKey) {
    if (state.radioCooldown > 0) return;
    assignCallsign();
    const pool = RADIO_CHATTER[poolKey] || [];
    if (!pool.length) return;
    const message = pool[Math.floor(Math.random() * pool.length)];
    const callSign = player.callsign ? ` ${player.callsign}` : '';
    noteStatus(`COMMS${callSign}: ${message}`, 4);
    pushStoryLog(`COMMS${callSign}: ${message}`);
    state.radioCooldown = 8;
  }

  function broadcastMessage(sector) {
    if (!sector || state.broadcastCooldown > 0) return;
    const zonePool = ZONE_BROADCASTS[sector.zoneType] || ZONE_BROADCASTS.cluster;
    const biomePool = BIOME_BROADCASTS[sector.biome] || [];
    const combined = [...zonePool, ...biomePool];
    if (!combined.length) return;
    const message = combined[Math.floor(Math.random() * combined.length)];
    noteStatus(message, 4);
    pushStoryLog(message);
    state.broadcastCooldown = 8;
  }

  function triggerRumor() {
    if (state.rumorCooldown > 0) return;
    if (!RUMOR_ENTRIES.length) return;
    const rumor = RUMOR_ENTRIES[Math.floor(Math.random() * RUMOR_ENTRIES.length)];
    noteStatus(rumor, 4);
    pushStoryLog(rumor);
    state.rumorCooldown = 14;
  }

  function updateStatusTimer(dt) {
    if (!statusText || state.statusTimer <= 0) return;
    state.statusTimer -= dt;
    if (state.statusTimer <= 0) statusText.textContent = '';
  }

  function updateCaptureState(dt) {
    if (state.captureWindow > 0) {
      state.captureWindow = Math.max(0, state.captureWindow - dt);
    }
    if (state.capturePressure > 0) {
      state.capturePressure = Math.max(0, state.capturePressure - CAPTURE_SYSTEM.decay * dt);
    }
    if (state.capturePressure > CAPTURE_SYSTEM.warning) {
      radioMessage('capture');
    }
  }

  function updateIntroSequence(dt) {
    if (!state.intro?.active) return;
    if (state.intro.phase === '') state.intro.phase = 'drift';

    if (state.intro.phase === 'drift') {
      if (state.mode === 'flight' && !state.paused) {
        state.intro.timer += dt;
        if (state.intro.timer > 1.8) {
          spawnStarterCaptureWing();
          state.intro.phase = 'intercept';
          state.intro.timer = 0;
          noteStatus('Unknown patrol vectoring in. Signal Scope updated.');
        }
      }
      return;
    }

    if (state.intro.phase === 'intercept') {
      state.intro.timer += dt;
      const threat = findClosestEnemy(player.x, player.y, 620);
      if (!state.intro.captureQueued && (state.intro.timer > 5 || threat)) {
        triggerCapture('ion_clade', 'Ion Clade Intercept');
        state.intro.captureQueued = true;
        state.intro.phase = 'captured';
      }
    }
  }

  function getGateData() {
    const chapter = STORY[player.chapterIndex];
    if (!chapter) return null;
    const data = world.gatePositions?.[chapter.id];
    if (!data) return null;
    return data;
  }

  function getConvergenceGateData() {
    if (!state.atlasUnlocked) return null;
    if (!world.convergenceGate) return null;
    return world.convergenceGate;
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

  function clipLineToBox(x1, y1, x2, y2, minX, maxX, minY, maxY) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    let t0 = 0;
    let t1 = 1;
    const p = [-dx, dx, -dy, dy];
    const q = [x1 - minX, maxX - x1, y1 - minY, maxY - y1];
    for (let i = 0; i < 4; i += 1) {
      if (p[i] === 0) {
        if (q[i] < 0) return null;
      } else {
        const r = q[i] / p[i];
        if (p[i] < 0) {
          if (r > t1) return null;
          if (r > t0) t0 = r;
        } else {
          if (r < t0) return null;
          if (r < t1) t1 = r;
        }
      }
    }
    return {
      x1: x1 + t0 * dx,
      y1: y1 + t0 * dy,
      x2: x1 + t1 * dx,
      y2: y1 + t1 * dy
    };
  }

  function pickBiome(depth, gx, gy) {
    const bandIndex = Math.min(REGION_BANDS.length - 1, Math.max(0, Math.floor((depth - 1) / 2)));
    const band = REGION_BANDS[bandIndex];
    const noiseScale = 0.12;
    const n = smoothNoise(gx * noiseScale + depth * 0.07, gy * noiseScale - depth * 0.05, WORLD_SEED * 0.11 + bandIndex * 19);
    if (depth > 1) {
      const intersticeWidth = 0.12 + Math.min(0.1, depth * 0.006);
      if (Math.abs(n - 0.5) < intersticeWidth) return 'interstice';
    }
    if (band.length === 1) return band[0];
    return n < 0.5 ? band[0] : band[1];
  }

  function pickZoneType(depth, gx, gy, biome) {
    if (biome === 'interstice') return 'expanse';
    if (depth <= 1) return 'cluster';
    const n = smoothNoise(gx * 0.35, gy * 0.35, WORLD_SEED * 0.17);
    if (n < 0.16) return 'rift';
    if (n < 0.34) return 'lane';
    return 'cluster';
  }

  function getSectorSeeds(gx, gy) {
    const base = WORLD_SEED + gx * 10007 + gy * 10009;
    return {
      terrain: base + 11,
      structures: base + 29,
      encounters: base + 47,
      events: base + 71
    };
  }

  function buildClusterMap() {
    const rng = mulberry32(WORLD_SEED * 7 + 123);
    const clusters = [];
    const centerRatio = randRange(rng, 0.9, 1.2);
    clusters.push({
      x: 0,
      y: 0,
      radius: WORLD.sectorSize * CLUSTER_FIELDS.centerRadius,
      strength: 1.15,
      ratio: centerRatio,
      angle: rng() * Math.PI * 2
    });
    for (let i = 1; i < CLUSTER_FIELDS.count; i += 1) {
      const angle = rng() * Math.PI * 2;
      const ringMin = WORLD.sectorSize * CLUSTER_FIELDS.spacingMin;
      const ringMax = WORLD.sectorSize * CLUSTER_FIELDS.spacingMax;
      const radius = randRange(rng, ringMin, ringMax);
      const size = WORLD.sectorSize * randRange(rng, CLUSTER_FIELDS.minRadius, CLUSTER_FIELDS.maxRadius);
      const ratio = randRange(rng, CLUSTER_FIELDS.minRatio, CLUSTER_FIELDS.maxRatio);
      clusters.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        radius: size,
        strength: randRange(rng, 0.9, 1.1),
        ratio,
        angle: rng() * Math.PI * 2
      });
    }
    world.clusterFields = clusters;
  }

  function getVoidCorridorFactor(gx, gy) {
    const n = smoothNoise(gx * 0.055, gy * 0.055, WORLD_SEED * 0.19);
    const band = 1 - Math.min(1, Math.abs(n - 0.5) / 0.11);
    const pinch = smoothNoise(gx * 0.12 + 9, gy * 0.12 - 11, WORLD_SEED * 0.29);
    return clamp((band - 0.35) * 1.6 * (0.7 + pinch * 0.5), 0, 1);
  }

  function getVoidPocketFactor(gx, gy) {
    const n = smoothNoise(gx * 0.025 + 17, gy * 0.025 - 23, WORLD_SEED * 0.33);
    return clamp((0.42 - n) * 2.4, 0, 1);
  }

  function getClusterDensity(gx, gy) {
    if (!world.clusterFields?.length) return 1;
    const center = posFromGrid(gx, gy);
    let density = 0;
    world.clusterFields.forEach((cluster) => {
      const dx = center.x - cluster.x;
      const dy = center.y - cluster.y;
      const ratio = cluster.ratio || 1;
      const cosA = Math.cos(cluster.angle || 0);
      const sinA = Math.sin(cluster.angle || 0);
      const rx = cluster.radius * ratio;
      const ry = cluster.radius / ratio;
      const nx = (dx * cosA + dy * sinA) / rx;
      const ny = (-dx * sinA + dy * cosA) / ry;
      const d = Math.hypot(nx, ny);
      if (d <= 1) {
        const local = (1 - d) * (cluster.strength || 1);
        if (local > density) density = local;
      }
    });
    const ripple = smoothNoise(gx * 0.08, gy * 0.08, WORLD_SEED * 0.13);
    const radial = clamp(depthFromGrid(gx, gy) / (WORLD.gridRadius || 1), 0, 1);
    const falloff = lerp(1, 0.55, radial);
    const corridor = getVoidCorridorFactor(gx, gy);
    const pocket = getVoidPocketFactor(gx, gy);
    density *= (0.7 + ripple * 0.6) * falloff;
    density *= 1 - corridor * 0.55;
    density *= 1 - pocket * 0.35;
    return clamp(density, 0, 1);
  }

  function getSectorProfile(gx, gy) {
    const depth = depthFromGrid(gx, gy);
    let biome = pickBiome(depth, gx, gy);
    const density = getClusterDensity(gx, gy);
    const corridor = getVoidCorridorFactor(gx, gy);
    const pocket = getVoidPocketFactor(gx, gy);
    const radial = clamp(depth / (WORLD.gridRadius || 1), 0, 1);
    const voidThreshold = CLUSTER_FIELDS.voidThreshold + radial * 0.14;
    if (biome === 'interstice' && density >= voidThreshold) {
      const bandIndex = Math.min(REGION_BANDS.length - 1, Math.max(0, Math.floor((depth - 1) / 2)));
      const band = REGION_BANDS[bandIndex];
      if (band.length > 1) {
        const n = smoothNoise(gx * 0.12 + 31, gy * 0.12 - 17, WORLD_SEED * 0.21);
        biome = n < 0.5 ? band[0] : band[1];
      } else {
        biome = band[0];
      }
    }
    let zoneType = pickZoneType(depth, gx, gy, biome);
    let isVoid = false;
    const openSpace = clamp(Math.max(corridor, pocket * 0.8), 0, 1);
    if (density < voidThreshold || corridor > 0.78 || pocket > 0.9) {
      biome = 'interstice';
      zoneType = 'expanse';
      isVoid = true;
    }
    const bandIndex = Math.min(REGION_BANDS.length - 1, Math.max(0, Math.floor((depth - 1) / 2)));
    const band = REGION_BANDS[bandIndex];
    let blendBiome = null;
    if (band.length > 1) {
      blendBiome = band.find((id) => id !== biome) || band[0];
    } else if (biome !== 'interstice') {
      blendBiome = 'interstice';
    }
    const blendNoise = smoothNoise(gx * 0.18 + 9, gy * 0.18 - 7, WORLD_SEED * 0.41);
    let blendWeight = clamp((0.5 - Math.abs(blendNoise - 0.5)) * 2, 0, 1);
    blendWeight *= biome === 'interstice' ? 0.2 : 0.65;
    blendWeight *= 1 - openSpace * 0.7;
    return {
      depth,
      biome,
      zoneType,
      density,
      isVoid,
      corridor,
      openSpace,
      blendBiome,
      blendWeight,
      isCore: density >= CLUSTER_FIELDS.coreThreshold,
      isRich: density >= CLUSTER_FIELDS.richThreshold
    };
  }

  function buildGateMap() {
    const rng = mulberry32(WORLD_SEED);
    const gates = {};
    const gatePositions = {};
    STORY.forEach((chapter) => {
      const depth = Math.min(WORLD.maxDepth, chapter.depth);
      const ring = [];
      for (let gx = -depth; gx <= depth; gx += 1) {
        for (let gy = -depth; gy <= depth; gy += 1) {
          if (depthFromGrid(gx, gy) !== depth) continue;
          const profile = getSectorProfile(gx, gy);
          if (!profile.isVoid && profile.zoneType === 'cluster') {
            ring.push({ gx, gy });
          }
        }
      }
      if (!ring.length) {
        for (let gx = -depth; gx <= depth; gx += 1) {
          for (let gy = -depth; gy <= depth; gy += 1) {
            if (depthFromGrid(gx, gy) !== depth) continue;
            ring.push({ gx, gy });
          }
        }
      }
      const pick = ring[Math.floor(rng() * ring.length)];
      gates[chapter.id] = sectorKey(pick.gx, pick.gy);
      const center = posFromGrid(pick.gx, pick.gy);
      const gateRng = mulberry32(WORLD_SEED + pick.gx * 101 + pick.gy * 103 + chapter.id * 17);
      const offsetX = randRange(gateRng, -160, 160);
      const offsetY = randRange(gateRng, -160, 160);
      gatePositions[chapter.id] = {
        x: center.x + offsetX,
        y: center.y + offsetY,
        key: sectorKey(pick.gx, pick.gy)
      };
    });
    world.gates = gates;
    world.gatePositions = gatePositions;
  }

  function buildStationMap() {
    const rng = mulberry32(WORLD_SEED * 19 + 911);
    const biomeStations = {};
    const relayStations = [];
    let convergenceGate = null;
    const biomeIds = Object.keys(BIOMES).filter((id) => id !== 'interstice');

    biomeIds.forEach((biomeId) => {
      const candidates = [];
      for (let gx = -WORLD.gridRadius; gx <= WORLD.gridRadius; gx += 1) {
        for (let gy = -WORLD.gridRadius; gy <= WORLD.gridRadius; gy += 1) {
          const profile = getSectorProfile(gx, gy);
          if (profile.depth <= 0 || profile.depth > WORLD.maxDepth) continue;
          if (profile.biome !== biomeId) continue;
          if (profile.zoneType !== 'cluster' || profile.isVoid) continue;
          if (gx === 0 && gy === 0) continue;
          candidates.push({ gx, gy });
        }
      }
      if (!candidates.length) return;
      const pick = candidates[Math.floor(rng() * candidates.length)];
      biomeStations[biomeId] = { gx: pick.gx, gy: pick.gy, key: sectorKey(pick.gx, pick.gy) };
    });

    const relayCandidates = [];
    for (let gx = -WORLD.gridRadius; gx <= WORLD.gridRadius; gx += 1) {
      for (let gy = -WORLD.gridRadius; gy <= WORLD.gridRadius; gy += 1) {
        const profile = getSectorProfile(gx, gy);
        if (profile.depth <= 1 || profile.depth > WORLD.maxDepth) continue;
        if (profile.biome !== 'interstice') continue;
        if (profile.zoneType !== 'expanse') continue;
        relayCandidates.push({ gx, gy });
      }
    }
    const relayCount = Math.min(12, Math.max(6, Math.floor(WORLD.gridRadius * 0.6)));
    for (let i = 0; i < relayCount && relayCandidates.length; i += 1) {
      const pickIndex = Math.floor(rng() * relayCandidates.length);
      const pick = relayCandidates.splice(pickIndex, 1)[0];
      relayStations.push({ gx: pick.gx, gy: pick.gy, key: sectorKey(pick.gx, pick.gy) });
    }

    if (relayCandidates.length) {
      const pickIndex = Math.floor(rng() * relayCandidates.length);
      const pick = relayCandidates[pickIndex];
      const center = posFromGrid(pick.gx, pick.gy);
      const offsetX = randRange(rng, -180, 180);
      const offsetY = randRange(rng, -180, 180);
      convergenceGate = {
        x: center.x + offsetX,
        y: center.y + offsetY,
        key: sectorKey(pick.gx, pick.gy)
      };
    }

    world.biomeStations = biomeStations;
    world.relayStations = relayStations;
    world.convergenceGate = convergenceGate;
  }

  function buildCityMap() {
    const rng = mulberry32(WORLD_SEED * 29 + 777);
    const cities = [];
    const civicKeys = new Set();
    const cityMap = new Map();

    const addCity = (city) => {
      cities.push(city);
      civicKeys.add(city.key);
      cityMap.set(city.key, city);
    };

    const home = world.homeBase;
    const homeGrid = gridFromPos(home.x, home.y);
    const homeKey = sectorKey(homeGrid.gx, homeGrid.gy);
    home.key = homeKey;
    home.gx = homeGrid.gx;
    home.gy = homeGrid.gy;
    home.type = 'capital';
    home.services = home.services || CITY_SERVICES;
    addCity(home);

    const desired = Math.max(20, Math.min(36, Math.floor(WORLD.gridRadius * 0.95)));
    const minSeparation = Math.max(4, Math.floor(WORLD.gridRadius / 12));

    const isReservedKey = (key) => {
      if (key === homeKey) return true;
      if (world.biomeStations) {
        const entries = Object.values(world.biomeStations);
        if (entries.some((entry) => entry.key === key)) return true;
      }
      if (world.relayStations && world.relayStations.some((entry) => entry.key === key)) return true;
      if (world.convergenceGate && world.convergenceGate.key === key) return true;
      return false;
    };

    const isFarEnough = (gx, gy) => cities.every((city) => {
      const cgx = city.gx ?? gridFromPos(city.x, city.y).gx;
      const cgy = city.gy ?? gridFromPos(city.x, city.y).gy;
      return Math.hypot(gx - cgx, gy - cgy) >= minSeparation;
    });

    for (let i = 0; i < desired; i += 1) {
      const depthT = Math.pow((i + 1) / (desired + 1), 0.65);
      const targetDepth = Math.round(lerp(2, WORLD.gridRadius, depthT));
      let candidates = [];
      for (let gx = -WORLD.gridRadius; gx <= WORLD.gridRadius; gx += 1) {
        for (let gy = -WORLD.gridRadius; gy <= WORLD.gridRadius; gy += 1) {
          const depth = depthFromGrid(gx, gy);
          if (Math.abs(depth - targetDepth) > 1) continue;
          const profile = getSectorProfile(gx, gy);
          if (profile.isVoid) continue;
          if (profile.zoneType === 'rift') continue;
          if (profile.openSpace < 0.2) continue;
          const key = sectorKey(gx, gy);
          if (isReservedKey(key)) continue;
          if (!isFarEnough(gx, gy)) continue;
          candidates.push({ gx, gy, key });
        }
      }
      if (!candidates.length) {
        for (let gx = -WORLD.gridRadius; gx <= WORLD.gridRadius; gx += 1) {
          for (let gy = -WORLD.gridRadius; gy <= WORLD.gridRadius; gy += 1) {
            const profile = getSectorProfile(gx, gy);
            if (profile.isVoid) continue;
            if (profile.zoneType === 'cluster') continue;
            const key = sectorKey(gx, gy);
            if (isReservedKey(key)) continue;
            if (!isFarEnough(gx, gy)) continue;
            candidates.push({ gx, gy, key });
          }
        }
      }
      if (!candidates.length) break;
      const pick = candidates[Math.floor(rng() * candidates.length)];
      const center = posFromGrid(pick.gx, pick.gy);
      const offset = WORLD.sectorSize * 0.05;
      const name = CITY_NAMES[(i + 1) % CITY_NAMES.length];
      const city = {
        id: `city-${i + 1}`,
        type: 'city',
        label: name,
        name,
        color: HOME_DEF.color,
        radius: CITY_DEF.radius,
        x: center.x + randRange(rng, -offset, offset),
        y: center.y + randRange(rng, -offset, offset),
        gx: pick.gx,
        gy: pick.gy,
        key: pick.key,
        hp: CITY_DEF.maxHp,
        maxHp: CITY_DEF.maxHp,
        shield: CITY_DEF.maxShield,
        maxShield: CITY_DEF.maxShield,
        defenseRange: CITY_DEF.defenseRange,
        safeRadius: CITY_DEF.safeRadius,
        noFireRadius: CITY_DEF.noFireRadius,
        turrets: Array.from({ length: CITY_DEF.turretCount }).map((_, idx) => ({
          angle: (Math.PI * 2 * idx) / CITY_DEF.turretCount,
          cooldown: rng() * 0.8
        })),
        services: CITY_SERVICES
      };
      addCity(city);
    }

    const outerDepth = Math.floor(WORLD.gridRadius * 0.65);
    const outerTarget = Math.max(6, Math.floor(desired * 0.35));
    let outerCount = cities.filter((city) => Math.max(Math.abs(city.gx), Math.abs(city.gy)) >= outerDepth).length;
    let extraIndex = cities.length;
    let outerAttempts = 0;
    while (outerCount < outerTarget && outerAttempts < 240) {
      outerAttempts += 1;
      const candidates = [];
      for (let gx = -WORLD.gridRadius; gx <= WORLD.gridRadius; gx += 1) {
        for (let gy = -WORLD.gridRadius; gy <= WORLD.gridRadius; gy += 1) {
          const depth = depthFromGrid(gx, gy);
          if (depth < outerDepth) continue;
          const profile = getSectorProfile(gx, gy);
          if (profile.isVoid) continue;
          if (profile.zoneType === 'rift') continue;
          if (profile.openSpace < 0.16) continue;
          const key = sectorKey(gx, gy);
          if (isReservedKey(key)) continue;
          if (!isFarEnough(gx, gy)) continue;
          candidates.push({ gx, gy, key });
        }
      }
      if (!candidates.length) break;
      const pick = candidates[Math.floor(rng() * candidates.length)];
      const center = posFromGrid(pick.gx, pick.gy);
      const offset = WORLD.sectorSize * 0.06;
      const name = CITY_NAMES[extraIndex % CITY_NAMES.length];
      const city = {
        id: `city-${extraIndex + 1}`,
        type: 'city',
        label: name,
        name,
        color: HOME_DEF.color,
        radius: CITY_DEF.radius,
        x: center.x + randRange(rng, -offset, offset),
        y: center.y + randRange(rng, -offset, offset),
        gx: pick.gx,
        gy: pick.gy,
        key: pick.key,
        hp: CITY_DEF.maxHp,
        maxHp: CITY_DEF.maxHp,
        shield: CITY_DEF.maxShield,
        maxShield: CITY_DEF.maxShield,
        defenseRange: CITY_DEF.defenseRange,
        safeRadius: CITY_DEF.safeRadius,
        noFireRadius: CITY_DEF.noFireRadius,
        turrets: Array.from({ length: CITY_DEF.turretCount }).map((_, idx) => ({
          angle: (Math.PI * 2 * idx) / CITY_DEF.turretCount,
          cooldown: rng() * 0.8
        })),
        services: CITY_SERVICES
      };
      addCity(city);
      outerCount += 1;
      extraIndex += 1;
    }

    world.cities = cities;
    world.civicKeys = civicKeys;
    world.cityMap = cityMap;
  }

  function buildTradeLanes() {
    const rng = mulberry32(WORLD_SEED * 31 + 515);
    const lanes = [];
    const cities = world.cities || [];
    if (!cities.length) {
      world.tradeLanes = lanes;
      return;
    }
    const degrees = new Map();
    const edgeSet = new Set();
    cities.forEach((city) => degrees.set(city.id, 0));

    const addLane = (a, b) => {
      if (!a || !b || a.id === b.id) return;
      const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
      if (edgeSet.has(key)) return;
      edgeSet.add(key);
      degrees.set(a.id, (degrees.get(a.id) || 0) + 1);
      degrees.set(b.id, (degrees.get(b.id) || 0) + 1);
      const distance = dist(a.x, a.y, b.x, b.y);
      const width = randRange(rng, 180, 260);
      const trafficBoost = 1.2 + Math.min(0.9, distance / (WORLD.sectorSize * 6));
      lanes.push({
        id: `lane-${key}`,
        from: a.id,
        to: b.id,
        x1: a.x,
        y1: a.y,
        x2: b.x,
        y2: b.y,
        width,
        trafficBoost
      });
    };

    cities.forEach((city) => {
      const desired = city.type === 'capital' ? 3 : 2;
      const others = cities
        .filter((other) => other.id !== city.id)
        .map((other) => ({ other, d: dist(city.x, city.y, other.x, other.y) }))
        .sort((a, b) => a.d - b.d);
      for (let i = 0; i < Math.min(desired, others.length); i += 1) {
        addLane(city, others[i].other);
      }
    });

    const maxFixPasses = 4;
    for (let pass = 0; pass < maxFixPasses; pass += 1) {
      const lowCities = cities.filter((city) => (degrees.get(city.id) || 0) < 2);
      if (!lowCities.length) break;
      lowCities.forEach((city) => {
        const others = cities
          .filter((other) => other.id !== city.id)
          .map((other) => ({ other, d: dist(city.x, city.y, other.x, other.y) }))
          .sort((a, b) => a.d - b.d);
        for (let i = 0; i < others.length; i += 1) {
          if ((degrees.get(city.id) || 0) >= 2) break;
          addLane(city, others[i].other);
        }
      });
    }

    world.tradeLanes = lanes;
  }

  function addTradeLanesToSector(sector) {
    if (!world.tradeLanes?.length) return [];
    const center = posFromGrid(sector.gx, sector.gy);
    const half = WORLD.sectorSize / 2;
    const minX = center.x - half;
    const maxX = center.x + half;
    const minY = center.y - half;
    const maxY = center.y + half;
    const routes = [];
    world.tradeLanes.forEach((lane) => {
      const clipped = clipLineToBox(lane.x1, lane.y1, lane.x2, lane.y2, minX, maxX, minY, maxY);
      if (!clipped) return;
      const dx = clipped.x2 - clipped.x1;
      const dy = clipped.y2 - clipped.y1;
      const length = Math.hypot(dx, dy);
      if (length < 60) return;
      routes.push({
        id: `${lane.id}-${sector.key}`,
        x1: clipped.x1,
        y1: clipped.y1,
        x2: clipped.x2,
        y2: clipped.y2,
        width: lane.width,
        length,
        angle: Math.atan2(dy, dx),
        nx: -dy / (length || 1),
        ny: dx / (length || 1),
        source: 'lane',
        trafficBoost: lane.trafficBoost || 1.4
      });
    });
    if (routes.length) {
      sector.objects.tradeRoutes.push(...routes);
    }
    return routes;
  }

  function getSector(gx, gy) {
    const key = sectorKey(gx, gy);
    if (world.sectors.has(key)) {
      const cached = world.sectors.get(key);
      if (cached?.objects) {
        cached.objects.friendlies = cached.objects.friendlies || [];
        cached.objects.tradeRoutes = cached.objects.tradeRoutes || [];
      }
      return cached;
    }
    const profile = getSectorProfile(gx, gy);
    const depth = profile.depth;
    const biome = profile.biome;
    const zoneType = profile.zoneType;
    const zone = ZONE_TYPES[zoneType] || ZONE_TYPES.cluster;
    const seeds = getSectorSeeds(gx, gy);
    const sector = {
      key,
      gx,
      gy,
      depth,
      biome,
      zoneType,
      zone,
      clusterDensity: profile.density,
      isVoid: profile.isVoid,
      openSpace: profile.openSpace,
      corridor: profile.corridor,
      blendBiome: profile.blendBiome,
      blendWeight: profile.blendWeight,
      seeds,
      isCore: profile.isCore,
      isRich: profile.isRich,
      isCivic: world.civicKeys?.has(key) || false,
      city: world.cityMap?.get(key) || null,
      name: getSystemName(gx, gy),
      faction: FACTIONS[(Math.abs(gx * 7 + gy * 13 + depth) % FACTIONS.length)],
      discovered: false,
      locked: depth > state.unlockedDepth,
      revealedUntil: 0,
      gateChapter: Object.entries(world.gates).find(([chapterId, gateKey]) => gateKey === key)?.[0] || null,
      spawnTimer: 0,
      threat: 1 + depth * 0.2,
      objects: {
        asteroids: [],
        planets: [],
        stars: [],
        stations: [],
        bases: [],
        wrecks: [],
        ruins: [],
        landmarks: [],
        slipstreams: [],
        riftBeacons: [],
        surveyBeacons: [],
        biomeProps: [],
        traders: [],
        civilians: [],
        friendlies: [],
        tradeRoutes: [],
        caches: [],
        storms: [],
        anomalies: []
      },
      encounters: [],
      events: []
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

  function makeStation({ x, y, radius, biome, type = 'outpost', name, hub = false }) {
    const baseStyle = type === 'relay'
      ? STATION_THEMES.relay
      : type === 'waystation'
        ? STATION_THEMES.waystation
        : type === 'refinery'
          ? STATION_THEMES.refinery
          : type === 'depot'
            ? STATION_THEMES.depot
            : type === 'outpost'
              ? STATION_THEMES.outpost
              : BIOME_STATION_STYLES[biome] || STATION_THEMES.outpost;
    const label = name || baseStyle.label || 'Station';
    const color = BIOMES[biome]?.accent || '#7dfc9a';
    return {
      x,
      y,
      radius,
      biome,
      type,
      label,
      color,
      ringCount: baseStyle.ringCount,
      spokeCount: baseStyle.spokeCount,
      finCount: baseStyle.finCount,
      coreShape: baseStyle.coreShape,
      services: baseStyle.services || STATION_THEMES.outpost.services,
      hub
    };
  }

  function pickLandmarkType(sector, rng) {
    const primary = LANDMARK_TYPES.find((entry) => entry.biome === sector.biome);
    const blend = sector.blendBiome ? LANDMARK_TYPES.find((entry) => entry.biome === sector.blendBiome) : null;
    const interstice = LANDMARK_TYPES.find((entry) => entry.biome === 'interstice');
    if (sector.biome === 'interstice' && interstice) return interstice;
    if (sector.zoneType === 'expanse' && interstice && rng() < 0.45) return interstice;
    if (blend && rng() < (sector.blendWeight || 0) * 0.9) return blend;
    return primary || blend || interstice || LANDMARK_TYPES[0];
  }

  function populateCivicSector(sector, rng) {
    const civicRng = rng || Math.random;
    const city = sector.city || world.homeBase;
    const center = city ? { x: city.x, y: city.y } : posFromGrid(sector.gx, sector.gy);
    const civicFaction = FACTIONS.find((f) => f.id === 'aetherline');
    if (civicFaction) sector.faction = civicFaction;

    Object.keys(sector.objects).forEach((key) => {
      sector.objects[key] = [];
    });

    const biome = BIOMES[sector.biome] || BIOMES.interstice;
    const planetCount = 2;
    for (let i = 0; i < planetCount; i += 1) {
      sector.objects.planets.push({
        x: center.x + randRange(civicRng, -3200, 3200),
        y: center.y + randRange(civicRng, -3200, 3200),
        radius: randRange(civicRng, 120, 210),
        hue: randRange(civicRng, biome.hue - 20, biome.hue + 30),
        mass: randRange(civicRng, 0.8, 1.4),
        ring: civicRng() < 0.6
      });
    }

    if (city) {
      const stationTypes = ['depot', 'refinery', 'outpost', 'waystation', 'relay'];
      const ringRadius = city.radius + 360;
      stationTypes.forEach((type, idx) => {
        const angle = (Math.PI * 2 * idx) / stationTypes.length;
        sector.objects.stations.push(makeStation({
          x: city.x + Math.cos(angle) * ringRadius,
          y: city.y + Math.sin(angle) * ringRadius,
          radius: randRange(civicRng, 60, 86),
          biome: sector.biome,
          type,
          name: type === 'relay' ? `${city.label} Relay` : type === 'refinery' ? `${city.label} Refinery` : `${city.label} District Dock`,
          hub: true
        }));
      });
      for (let i = 0; i < 4; i += 1) {
        const angle = randRange(civicRng, 0, Math.PI * 2);
        const radius = randRange(civicRng, city.radius + 520, city.radius + 820);
        sector.objects.stations.push(makeStation({
          x: city.x + Math.cos(angle) * radius,
          y: city.y + Math.sin(angle) * radius,
          radius: randRange(civicRng, 52, 72),
          biome: sector.biome,
          type: 'depot',
          name: `${city.label} Service Pier`
        }));
      }
    }

    const routeCount = 2 + Math.floor(civicRng() * 2);
    for (let r = 0; r < routeCount; r += 1) {
      const angle = randRange(civicRng, 0, Math.PI * 2);
      const length = WORLD.sectorSize * randRange(civicRng, 0.6, 0.9);
      const dir = { x: Math.cos(angle), y: Math.sin(angle) };
      const perp = { x: -dir.y, y: dir.x };
      const offset = randRange(civicRng, -WORLD.sectorSize * 0.2, WORLD.sectorSize * 0.2);
      const mid = { x: center.x + perp.x * offset, y: center.y + perp.y * offset };
      const half = length / 2;
      const route = {
        id: `${sector.key}-civic-route-${r}`,
        x1: mid.x - dir.x * half,
        y1: mid.y - dir.y * half,
        x2: mid.x + dir.x * half,
        y2: mid.y + dir.y * half,
        width: randRange(civicRng, 140, 220)
      };
      const dx = route.x2 - route.x1;
      const dy = route.y2 - route.y1;
      route.length = Math.hypot(dx, dy);
      route.angle = Math.atan2(dy, dx);
      route.nx = -dy / (route.length || 1);
      route.ny = dx / (route.length || 1);
      sector.objects.tradeRoutes.push(route);
    }

    const traderCount = 4 + Math.floor(civicRng() * 3);
    for (let i = 0; i < traderCount; i += 1) {
      const traderType = TRADER_TYPES[Math.floor(civicRng() * TRADER_TYPES.length)];
      sector.objects.traders.push({
        id: `${sector.key}-civic-trader-${i}`,
        type: traderType.id,
        label: traderType.label,
        color: traderType.color,
        vibe: traderType.vibe,
        x: center.x + randRange(civicRng, -2400, 2400),
        y: center.y + randRange(civicRng, -2400, 2400),
        radius: randRange(civicRng, 22, 30),
        driftX: randRange(civicRng, -10, 10),
        driftY: randRange(civicRng, -10, 10),
        phase: civicRng() * Math.PI * 2
      });
    }

    const trafficCount = 14 + Math.floor(civicRng() * 8);
    for (let i = 0; i < trafficCount; i += 1) {
      const type = CIVILIAN_TYPES[Math.floor(civicRng() * CIVILIAN_TYPES.length)];
      const civFaction = 'aetherline';
      const livery = getLiveryForFaction(civFaction);
      let x = center.x + randRange(civicRng, -3000, 3000);
      let y = center.y + randRange(civicRng, -3000, 3000);
      let angle = civicRng() * Math.PI * 2;
      let routeId = '';
      let routeT = 0;
      let routeDir = 1;
      let routeOffset = 0;
      if (sector.objects.tradeRoutes.length && civicRng() < 0.6) {
        const route = sector.objects.tradeRoutes[Math.floor(civicRng() * sector.objects.tradeRoutes.length)];
        const dx = route.x2 - route.x1;
        const dy = route.y2 - route.y1;
        routeT = civicRng();
        routeDir = civicRng() < 0.5 ? 1 : -1;
        routeOffset = randRange(civicRng, -route.width * 0.3, route.width * 0.3);
        x = route.x1 + dx * routeT + route.nx * routeOffset;
        y = route.y1 + dy * routeT + route.ny * routeOffset;
        angle = route.angle + (routeDir < 0 ? Math.PI : 0);
        routeId = route.id;
      }
      sector.objects.civilians.push({
        id: `${sector.key}-civic-civ-${i}`,
        type: type.id,
        label: type.label,
        x,
        y,
        angle,
        speed: randRange(civicRng, type.speed * 0.8, type.speed * 1.35),
        size: type.size,
        color: type.color,
        faction: civFaction,
        livery,
        hp: type.hp,
        maxHp: type.hp,
        shield: type.id === 'freighter' ? 20 : type.id === 'hauler' ? 12 : 0,
        armor: type.id === 'freighter' ? 0.08 : 0.04,
        routeId,
        routeT,
        routeDir,
        routeOffset,
        turn: randRange(civicRng, -0.08, 0.08),
        sway: civicRng() * Math.PI * 2
      });
    }

    const laneRoutes = addTradeLanesToSector(sector);
    laneRoutes.forEach((route) => {
      seedRouteTraffic(sector, route, civicRng, route.trafficBoost || 1.6);
      seedRouteEncounters(sector, route, civicRng, city);
    });
    if (city) attachCitySpurs(sector, city, laneRoutes);

    if (city) {
      const escortCount = 4 + Math.floor(civicRng() * 3);
      for (let i = 0; i < escortCount; i += 1) {
        const def = FRIENDLY_TYPES[Math.floor(civicRng() * FRIENDLY_TYPES.length)];
        const angle = randRange(civicRng, 0, Math.PI * 2);
        const radius = randRange(civicRng, city.radius + 260, city.radius + 520);
        spawnFriendly(def.id, city.x + Math.cos(angle) * radius, city.y + Math.sin(angle) * radius, {
          sector,
          angle: angle + Math.PI / 2,
          faction: 'aetherline',
          anchor: { x: city.x, y: city.y },
          orbitRadius: radius,
          orbitAngle: angle,
          rng: civicRng
        });
      }
    }

    sector.encounters = [];
  }

  function generateSectorObjects(sector) {
    const seeds = sector.seeds || getSectorSeeds(sector.gx, sector.gy);
    const terrainRng = mulberry32(Math.abs(seeds.terrain));
    const structureRng = mulberry32(Math.abs(seeds.structures));
    const encounterRng = mulberry32(Math.abs(seeds.encounters));
    const eventRng = mulberry32(Math.abs(seeds.events));
    let rng = terrainRng;
    const biome = BIOMES[sector.biome];
    const blendBiome = sector.blendBiome ? BIOMES[sector.blendBiome] : null;
    const blendWeight = sector.blendWeight || 0;
    const center = posFromGrid(sector.gx, sector.gy);
    const zone = sector.zone || ZONE_TYPES.cluster;
    const isCluster = sector.zoneType === 'cluster';
    const isExpanse = sector.zoneType === 'expanse';
    const density = sector.clusterDensity ?? 0;
    const openSpace = sector.openSpace || 0;
    const densityScale = lerp(0.25, 1.9, density) * lerp(1, 0.55, openSpace);
    const coreBoost = sector.isCore ? 1.55 : 1;
    const richBoost = sector.isRich ? 1.35 : 1;
    const fieldRadius = WORLD.sectorSize * (sector.isCore ? 0.08 : sector.isVoid ? 0.02 : 0.05) * (1 + openSpace * 0.45);
    const innerField = fieldRadius * 0.6;
    const wideField = fieldRadius * 1.15;
    const clearZones = [];

    if (sector.isCivic) {
      populateCivicSector(sector, terrainRng);
      return;
    }

    if (isCluster && rng() < (sector.isCore ? 0.9 : 0.7)) {
      const clearCount = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < clearCount; i += 1) {
        clearZones.push({
          x: center.x + randRange(rng, -innerField, innerField),
          y: center.y + randRange(rng, -innerField, innerField),
          radius: randRange(rng, fieldRadius * 0.35, fieldRadius * 0.55)
        });
      }
    }
    if (openSpace > 0.35) {
      const clearCount = 1 + Math.floor(openSpace * 2.5);
      for (let i = 0; i < clearCount; i += 1) {
        clearZones.push({
          x: center.x + randRange(rng, -wideField, wideField),
          y: center.y + randRange(rng, -wideField, wideField),
          radius: randRange(rng, fieldRadius * 0.5, fieldRadius * 0.8)
        });
      }
    }

    const inClearZone = (x, y) => clearZones.some((zone) => dist(x, y, zone.x, zone.y) < zone.radius);

    const asteroidChance = (sector.isCore ? 0.55 : 0.26) * (1 - openSpace * 0.82);
    const asteroidFields = isCluster && !sector.isVoid && sector.zoneType !== 'rift'
      ? (rng() < asteroidChance ? 1 + Math.floor(rng() * (openSpace > 0.45 ? 1 : 2)) : 0)
      : 0;
    for (let f = 0; f < asteroidFields; f += 1) {
      const fieldCenter = {
        x: center.x + randRange(rng, -fieldRadius, fieldRadius),
        y: center.y + randRange(rng, -fieldRadius, fieldRadius)
      };
      const fieldSpan = randRange(rng, fieldRadius * 0.25, fieldRadius * 0.55);
      const count = Math.floor(randRange(rng, 4, 10) * densityScale * coreBoost * (1 - openSpace * 0.65));
      for (let i = 0; i < count; i += 1) {
        const radius = randRange(rng, 14, 44);
        const ax = fieldCenter.x + randRange(rng, -fieldSpan, fieldSpan);
        const ay = fieldCenter.y + randRange(rng, -fieldSpan, fieldSpan);
        if (inClearZone(ax, ay)) continue;
        const ghost = radius < 22 ? rng() < 0.6 : rng() < 0.25;
        sector.objects.asteroids.push({
          x: ax,
          y: ay,
          radius,
          ghost,
          points: generateAsteroidShape(rng, radius)
        });
      }
    }

    if (isExpanse && rng() < (sector.isVoid ? 0.7 : 0.55)) {
      const rubbleFields = 1 + Math.floor(rng() * (sector.isVoid ? 2 : sector.isCore ? 2 : 1));
      const rubbleScale = sector.isVoid ? 0.55 : 0.45;
      for (let f = 0; f < rubbleFields; f += 1) {
        const fieldCenter = {
          x: center.x + randRange(rng, -wideField, wideField),
          y: center.y + randRange(rng, -wideField, wideField)
        };
        const fieldSpan = randRange(rng, fieldRadius * 0.35, fieldRadius * 0.7);
        const count = Math.max(6, Math.floor(randRange(rng, 8, 18) * densityScale * rubbleScale));
        for (let i = 0; i < count; i += 1) {
          const radius = randRange(rng, 10, 30);
          const ax = fieldCenter.x + randRange(rng, -fieldSpan, fieldSpan);
          const ay = fieldCenter.y + randRange(rng, -fieldSpan, fieldSpan);
          if (inClearZone(ax, ay)) continue;
          sector.objects.asteroids.push({
            x: ax,
            y: ay,
            radius,
            ghost: rng() < 0.55,
            points: generateAsteroidShape(rng, radius)
          });
        }
        const salvageCount = Math.max(1, Math.floor(rng() * (sector.isVoid ? 2 : 3)));
        for (let s = 0; s < salvageCount; s += 1) {
          const wreck = {
            x: fieldCenter.x + randRange(rng, -fieldSpan, fieldSpan),
            y: fieldCenter.y + randRange(rng, -fieldSpan, fieldSpan),
            radius: randRange(rng, 16, 32),
            salvage: 1 + Math.floor(rng() * (sector.isVoid ? 2 : 3))
          };
          if (!inClearZone(wreck.x, wreck.y)) {
            sector.objects.wrecks.push(wreck);
          }
        }
      }
    }

    if (sector.isVoid && rng() < 0.6) {
      const driftCount = 6 + Math.floor(rng() * 10);
      for (let i = 0; i < driftCount; i += 1) {
        const angle = rng() * Math.PI * 2;
        const radius = randRange(rng, innerField * 0.6, wideField * 0.7);
        const size = randRange(rng, 8, 22);
        const ax = center.x + Math.cos(angle) * radius;
        const ay = center.y + Math.sin(angle) * radius;
        if (inClearZone(ax, ay)) continue;
        sector.objects.asteroids.push({
          x: ax,
          y: ay,
          radius: size,
          ghost: rng() < 0.65,
          points: generateAsteroidShape(rng, size)
        });
      }
      if (rng() < 0.45) {
        sector.objects.wrecks.push({
          x: center.x + randRange(rng, -innerField, innerField),
          y: center.y + randRange(rng, -innerField, innerField),
          radius: randRange(rng, 18, 34),
          salvage: 1 + Math.floor(rng() * 2)
        });
      }
    }

    const planetChance = sector.isVoid
      ? 0.04
      : sector.isCore
        ? 0.55 + density * 0.4
        : isCluster
          ? 0.3 + density * 0.35
          : isExpanse
            ? 0.05 + density * 0.12
            : 0.14 + density * 0.25;
    const finalPlanetChance = planetChance * (1 - openSpace * 0.35);
    if (rng() < finalPlanetChance) {
      const planetCount = sector.isCore && rng() < 0.55 ? 2 : 1;
      for (let p = 0; p < planetCount; p += 1) {
        const planet = {
          x: center.x + randRange(rng, -wideField, wideField),
          y: center.y + randRange(rng, -wideField, wideField),
          radius: randRange(rng, 80, 210),
          hue: randRange(rng, biome.hue - 20, biome.hue + 40),
          mass: randRange(rng, 0.6, 1.4),
          ring: rng() < (sector.isCore ? 0.7 : 0.45)
        };
        sector.objects.planets.push(planet);
        if (isCluster && rng() < (sector.isCore ? 0.7 : 0.45)) {
          const beltCount = Math.max(2, Math.floor((6 + rng() * 10) * densityScale * (1 - openSpace * 0.7)));
          const beltRadius = planet.radius + randRange(rng, 80, 170);
          for (let i = 0; i < beltCount; i += 1) {
            const angle = rng() * Math.PI * 2;
            const jitter = randRange(rng, -36, 36);
            const radius = randRange(rng, 12, 34);
            const ax = planet.x + Math.cos(angle) * (beltRadius + jitter);
            const ay = planet.y + Math.sin(angle) * (beltRadius + jitter);
            if (inClearZone(ax, ay)) continue;
            sector.objects.asteroids.push({
              x: ax,
              y: ay,
              radius,
              ghost: radius < 20 ? rng() < 0.55 : rng() < 0.2,
              points: generateAsteroidShape(rng, radius)
            });
          }
        }
      }
    }

    const starChance = sector.isVoid
      ? 0.2
      : isExpanse
        ? 0.1
        : isCluster
          ? 0.04
          : 0.06;
    if (rng() < starChance) {
      const starCount = sector.isCore && rng() < 0.35 ? 2 : 1;
      for (let s = 0; s < starCount; s += 1) {
        const radius = randRange(rng, 160, 260);
        sector.objects.stars.push({
          x: center.x + randRange(rng, -wideField, wideField),
          y: center.y + randRange(rng, -wideField, wideField),
          radius,
          hue: randRange(rng, biome.hue - 30, biome.hue + 45),
          corona: radius * randRange(rng, 1.4, 1.9),
          scoopRadius: radius * STAR_SCOOP.outerRatio
        });
      }
    }

    rng = structureRng;
    const hubKey = world.biomeStations?.[sector.biome]?.key;
    const relayStation = world.relayStations?.find((entry) => entry.key === sector.key);
    if (hubKey === sector.key) {
      sector.objects.stations.push(makeStation({
        x: center.x + randRange(rng, -innerField * 0.6, innerField * 0.6),
        y: center.y + randRange(rng, -innerField * 0.6, innerField * 0.6),
        radius: randRange(rng, 64, 90),
        biome: sector.biome,
        type: 'hub',
        name: BIOME_STATION_STYLES[sector.biome]?.label,
        hub: true
      }));
    }
    if (relayStation) {
      sector.objects.stations.push(makeStation({
        x: center.x + randRange(rng, -innerField * 0.75, innerField * 0.75),
        y: center.y + randRange(rng, -innerField * 0.75, innerField * 0.75),
        radius: randRange(rng, 70, 96),
        biome: 'interstice',
        type: 'relay',
        name: STATION_THEMES.relay.label
      }));
    }
    let hasStation = sector.objects.stations.length > 0;
    if (!hasStation && isCluster && !sector.isVoid) {
      const refineryChance = sector.isCore ? 0.22 : 0.08;
      if (rng() < refineryChance) {
        sector.objects.stations.push(makeStation({
          x: center.x + randRange(rng, -innerField * 0.7, innerField * 0.7),
          y: center.y + randRange(rng, -innerField * 0.7, innerField * 0.7),
          radius: randRange(rng, 62, 86),
          biome: sector.biome,
          type: 'refinery',
          name: STATION_THEMES.refinery.label
        }));
        hasStation = true;
      }
    }
    if (!hasStation && isExpanse && rng() < (sector.isVoid ? 0.06 : 0.08)) {
      sector.objects.stations.push(makeStation({
        x: center.x + randRange(rng, -innerField, innerField),
        y: center.y + randRange(rng, -innerField, innerField),
        radius: randRange(rng, 60, 80),
        biome: 'interstice',
        type: 'waystation',
        name: 'Interstice Waystation'
      }));
      hasStation = true;
    }
    const stationField = smoothNoise(sector.gx * 0.18, sector.gy * 0.18, WORLD_SEED * 0.23);
    const stationAllowed = stationField > 0.76;
    if (!hasStation && !isExpanse && !sector.isVoid && stationAllowed && rng() < (isCluster ? 0.18 : 0.05)) {
      sector.objects.stations.push(makeStation({
        x: center.x + randRange(rng, -innerField * 0.8, innerField * 0.8),
        y: center.y + randRange(rng, -innerField * 0.8, innerField * 0.8),
        radius: randRange(rng, 52, 70),
        biome: sector.biome,
        type: 'outpost',
        name: `${sector.name} Dock`
      }));
      hasStation = true;
    }
    if (!hasStation && !sector.isVoid && rng() < 0.04) {
      sector.objects.stations.push(makeStation({
        x: center.x + randRange(rng, -innerField, innerField),
        y: center.y + randRange(rng, -innerField, innerField),
        radius: randRange(rng, 54, 74),
        biome: sector.biome,
        type: 'depot',
        name: STATION_THEMES.depot.label
      }));
      hasStation = true;
    }

    const traderChance = (isCluster ? 0.45 * densityScale * coreBoost : 0.28 * densityScale) * (isExpanse ? 0.9 : 1);
    const traderScale = sector.isVoid ? 0.45 : 1;
    if (sector.zoneType !== 'rift' && rng() < traderChance * traderScale) {
      const traderCount = 1 + Math.floor(rng() * (sector.isCore ? 3 : 2));
      for (let i = 0; i < traderCount; i += 1) {
        const traderType = TRADER_TYPES[Math.floor(rng() * TRADER_TYPES.length)];
        sector.objects.traders.push({
          id: `${sector.key}-trader-${i}`,
          type: traderType.id,
          label: traderType.label,
          color: traderType.color,
          vibe: traderType.vibe,
          x: center.x + randRange(rng, -innerField * 0.9, innerField * 0.9),
          y: center.y + randRange(rng, -innerField * 0.9, innerField * 0.9),
          radius: randRange(rng, 22, 30),
          driftX: randRange(rng, -12, 12),
          driftY: randRange(rng, -12, 12),
          phase: rng() * Math.PI * 2
        });
      }
    }

    const laneRoutes = addTradeLanesToSector(sector);
    laneRoutes.forEach((route) => {
      seedRouteTraffic(sector, route, rng, route.trafficBoost || 1.6);
      seedRouteEncounters(sector, route, rng, null);
    });

    const routeChance = sector.isVoid
      ? TRADE_ROUTE_CONFIG.voidChance
      : sector.zoneType === 'lane'
        ? TRADE_ROUTE_CONFIG.laneChance
        : isExpanse
          ? TRADE_ROUTE_CONFIG.expanseChance
          : TRADE_ROUTE_CONFIG.clusterChance;
    if (rng() < routeChance) {
      const maxRoutes = sector.zoneType === 'lane'
        ? TRADE_ROUTE_CONFIG.maxRoutesLane
        : isExpanse
          ? TRADE_ROUTE_CONFIG.maxRoutesExpanse
          : TRADE_ROUTE_CONFIG.maxRoutesCluster;
      const routeCount = 1 + Math.floor(rng() * maxRoutes);
      for (let r = 0; r < routeCount; r += 1) {
        const angle = rng() * Math.PI * 2;
        const length = WORLD.sectorSize * randRange(rng, TRADE_ROUTE_CONFIG.lengthMin, TRADE_ROUTE_CONFIG.lengthMax);
        const dir = { x: Math.cos(angle), y: Math.sin(angle) };
        const perp = { x: -dir.y, y: dir.x };
        const midOffset = randRange(rng, -WORLD.sectorSize * 0.2, WORLD.sectorSize * 0.2);
        const mid = {
          x: center.x + perp.x * midOffset,
          y: center.y + perp.y * midOffset
        };
        const half = length / 2;
        const route = {
          id: `${sector.key}-route-${r}`,
          x1: mid.x - dir.x * half,
          y1: mid.y - dir.y * half,
          x2: mid.x + dir.x * half,
          y2: mid.y + dir.y * half,
          width: randRange(rng, TRADE_ROUTE_CONFIG.widthMin, TRADE_ROUTE_CONFIG.widthMax)
        };
        const dx = route.x2 - route.x1;
        const dy = route.y2 - route.y1;
        route.length = Math.hypot(dx, dy);
        route.angle = Math.atan2(dy, dx);
        route.nx = -dy / (route.length || 1);
        route.ny = dx / (route.length || 1);
        sector.objects.tradeRoutes.push(route);
        seedRouteTraffic(sector, route, rng, 1);
      }
    }

    const trafficChance = (sector.isVoid ? 0.35 : isExpanse ? 0.92 : isCluster ? 0.8 : 0.7) * (1 - openSpace * 0.2);
    if (rng() < trafficChance) {
      const trafficCount = sector.isVoid
        ? 1 + Math.floor(rng() * 2)
        : 2 + Math.floor(rng() * (sector.isCore ? 5 : 4));
      for (let i = 0; i < trafficCount; i += 1) {
        const type = CIVILIAN_TYPES[Math.floor(rng() * CIVILIAN_TYPES.length)];
          const civFaction = sector.faction?.id && rng() < 0.55 ? sector.faction.id : 'neutral';
          const livery = getLiveryForFaction(civFaction);
          sector.objects.civilians.push({
            id: `${sector.key}-civ-${i}`,
            type: type.id,
            label: type.label,
            x: center.x + randRange(rng, -innerField, innerField),
            y: center.y + randRange(rng, -innerField, innerField),
            angle: rng() * Math.PI * 2,
            speed: randRange(rng, type.speed * 0.7, type.speed * 1.3),
            size: type.size,
            color: type.color,
            faction: civFaction,
            livery,
            hp: type.hp,
            maxHp: type.hp,
            shield: type.id === 'freighter' ? 16 : type.id === 'hauler' ? 10 : 0,
            armor: type.id === 'freighter' ? 0.06 : 0.03,
            turn: randRange(rng, -0.12, 0.12),
            sway: rng() * Math.PI * 2
          });
        }
    }

    if (isExpanse && rng() < (sector.isVoid ? 0.55 : 0.4)) {
      const convoyCount = 2 + Math.floor(rng() * (sector.isVoid ? 2 : 3));
      const angle = rng() * Math.PI * 2;
      const dir = { x: Math.cos(angle), y: Math.sin(angle) };
      const perp = { x: -dir.y, y: dir.x };
      const length = WORLD.sectorSize * randRange(rng, 0.4, 0.7);
      const midOffset = randRange(rng, -WORLD.sectorSize * 0.25, WORLD.sectorSize * 0.25);
      const mid = { x: center.x + perp.x * midOffset, y: center.y + perp.y * midOffset };
      const route = {
        id: `${sector.key}-drift-route-${Math.floor(rng() * 9999)}`,
        x1: mid.x - dir.x * length * 0.5,
        y1: mid.y - dir.y * length * 0.5,
        x2: mid.x + dir.x * length * 0.5,
        y2: mid.y + dir.y * length * 0.5,
        width: randRange(rng, 80, 140),
        hidden: true
      };
      const dx = route.x2 - route.x1;
      const dy = route.y2 - route.y1;
      route.length = Math.hypot(dx, dy);
      route.angle = Math.atan2(dy, dx);
      route.nx = -dy / (route.length || 1);
      route.ny = dx / (route.length || 1);
      sector.objects.tradeRoutes.push(route);

      for (let i = 0; i < convoyCount; i += 1) {
        const type = CIVILIAN_TYPES[Math.floor(rng() * CIVILIAN_TYPES.length)];
        const routeT = rng();
        const routeDir = rng() < 0.5 ? 1 : -1;
        const offset = randRange(rng, -route.width * 0.3, route.width * 0.3);
        const speed = randRange(rng, type.speed * 0.8, type.speed * 1.1);
        const civFaction = sector.faction?.id && rng() < 0.5 ? sector.faction.id : 'neutral';
        const livery = getLiveryForFaction(civFaction);
        sector.objects.civilians.push({
          id: `${sector.key}-drift-civ-${i}`,
          type: type.id,
          label: type.label,
          x: route.x1 + dx * routeT + route.nx * offset,
          y: route.y1 + dy * routeT + route.ny * offset,
          angle: route.angle + (routeDir < 0 ? Math.PI : 0),
          speed,
          size: type.size,
          color: type.color,
          faction: civFaction,
          livery,
          hp: type.hp,
          maxHp: type.hp,
          shield: type.id === 'freighter' ? 14 : type.id === 'hauler' ? 8 : 0,
          armor: type.id === 'freighter' ? 0.06 : 0.03,
          routeId: route.id,
          routeT,
          routeDir,
          routeOffset: offset,
          sway: rng() * Math.PI * 2
        });
      }

      if (rng() < 0.6) {
        const escortCount = 1 + Math.floor(rng() * 2);
        for (let i = 0; i < escortCount; i += 1) {
          const def = FRIENDLY_TYPES[Math.floor(rng() * FRIENDLY_TYPES.length)];
          const routeT = rng();
          const routeDir = rng() < 0.5 ? 1 : -1;
          const offset = randRange(rng, -route.width * 0.25, route.width * 0.25);
          spawnFriendly(def.id, route.x1 + dx * routeT + route.nx * offset, route.y1 + dy * routeT + route.ny * offset, {
            sector,
            angle: route.angle + (routeDir < 0 ? Math.PI : 0),
            faction: 'aetherline',
            routeId: route.id,
            routeT,
            routeDir,
            routeOffset: offset,
            rng
          });
        }
      }
    }

    if (isCluster && !sector.isVoid && rng() < (0.2 + sector.depth * 0.02) * densityScale * coreBoost && !world.baseClaims?.[sector.key] && !(sector.gx === 0 && sector.gy === 0)) {
      const baseKeys = Object.keys(BASE_TYPES);
      const baseType = BASE_TYPES[baseKeys[Math.min(baseKeys.length - 1, Math.floor(rng() * baseKeys.length))]];
      sector.objects.bases.push({
        id: `${sector.key}-base`,
        type: baseType.id,
        x: center.x + randRange(rng, -innerField * 0.7, innerField * 0.7),
        y: center.y + randRange(rng, -innerField * 0.7, innerField * 0.7),
        faction: sector.faction?.id || '',
        hp: baseType.hp,
        shield: baseType.shield,
        radius: baseType.radius,
        turrets: Array.from({ length: baseType.turretCount }).map((_, idx) => ({
          angle: (Math.PI * 2 * idx) / baseType.turretCount,
          cooldown: randRange(rng, 0.4, 1.2)
        })),
        spawnTimer: randRange(rng, 2, 4),
        def: baseType
      });
    }

    if (!sector.isVoid && !isCluster && rng() < (isExpanse ? 0.08 : 0.05) * densityScale && !world.baseClaims?.[sector.key] && !(sector.gx === 0 && sector.gy === 0)) {
      const baseKeys = isExpanse ? ['outpost', 'relay', 'refinery'] : Object.keys(BASE_TYPES);
      const baseType = BASE_TYPES[baseKeys[Math.min(baseKeys.length - 1, Math.floor(rng() * baseKeys.length))]];
      sector.objects.bases.push({
        id: `${sector.key}-base`,
        type: baseType.id,
        x: center.x + randRange(rng, -innerField * 0.7, innerField * 0.7),
        y: center.y + randRange(rng, -innerField * 0.7, innerField * 0.7),
        faction: sector.faction?.id || '',
        hp: baseType.hp,
        shield: baseType.shield,
        radius: baseType.radius,
        turrets: Array.from({ length: baseType.turretCount }).map((_, idx) => ({
          angle: (Math.PI * 2 * idx) / baseType.turretCount,
          cooldown: randRange(rng, 0.4, 1.2)
        })),
        spawnTimer: randRange(rng, 2, 4),
        def: baseType
      });
    }

    if (sector.isVoid && rng() < 0.04 * densityScale && !world.baseClaims?.[sector.key] && !(sector.gx === 0 && sector.gy === 0)) {
      const baseKeys = ['relay', 'outpost'];
      const baseType = BASE_TYPES[baseKeys[Math.min(baseKeys.length - 1, Math.floor(rng() * baseKeys.length))]];
      sector.objects.bases.push({
        id: `${sector.key}-base`,
        type: baseType.id,
        x: center.x + randRange(rng, -innerField, innerField),
        y: center.y + randRange(rng, -innerField, innerField),
        faction: sector.faction?.id || '',
        hp: baseType.hp,
        shield: baseType.shield,
        radius: baseType.radius,
        turrets: Array.from({ length: baseType.turretCount }).map((_, idx) => ({
          angle: (Math.PI * 2 * idx) / baseType.turretCount,
          cooldown: randRange(rng, 0.4, 1.2)
        })),
        spawnTimer: randRange(rng, 2.5, 4.5),
        def: baseType
      });
    }

    const wreckChance = (isCluster ? 0.32 : isExpanse ? 0.12 : 0.18) * densityScale * (sector.isVoid ? 0.6 : 1);
    if (rng() < wreckChance) {
      const wreck = {
        x: center.x + randRange(rng, -fieldRadius, fieldRadius),
        y: center.y + randRange(rng, -fieldRadius, fieldRadius),
        radius: randRange(rng, 24, 50),
        salvage: Math.floor(randRange(rng, 1, 4))
      };
      sector.objects.wrecks.push(wreck);
      if (rng() < 0.85) {
        const rubbleCount = 6 + Math.floor(rng() * 8);
        for (let i = 0; i < rubbleCount; i += 1) {
          const angle = rng() * Math.PI * 2;
          const radius = wreck.radius + randRange(rng, 18, 70);
          const size = randRange(rng, 8, 22);
          sector.objects.asteroids.push({
            x: wreck.x + Math.cos(angle) * radius,
            y: wreck.y + Math.sin(angle) * radius,
            radius: size,
            ghost: rng() < 0.7,
            points: generateAsteroidShape(rng, size)
          });
        }
      }
    }

    const cacheChance = (isCluster ? 0.35 : isExpanse ? 0.12 : 0.15) * densityScale * (sector.isVoid ? 0.6 : 1);
    if (rng() < cacheChance && !world.cacheClaims?.[sector.key]) {
      sector.objects.caches.push({
        x: center.x + randRange(rng, -fieldRadius, fieldRadius),
        y: center.y + randRange(rng, -fieldRadius, fieldRadius),
        radius: 18,
        blueprint: pickRandomBlueprint(rng)
      });
    }

    if (!world.beaconClaims?.[sector.key]) {
      const beaconChance = (isExpanse ? 0.28 : isCluster ? 0.14 : 0.18) * (sector.isVoid ? 0.45 : 1);
      if (rng() < beaconChance * densityScale) {
        sector.objects.surveyBeacons.push({
          id: `${sector.key}-survey`,
          x: center.x + randRange(rng, -fieldRadius * 0.9, fieldRadius * 0.9),
          y: center.y + randRange(rng, -fieldRadius * 0.9, fieldRadius * 0.9),
          radius: randRange(rng, 28, 42),
          pulse: rng() * Math.PI * 2
        });
      }
    }

    const friendlyChance = sector.isVoid ? 0.35 : isExpanse ? 0.6 : 0.3;
    if (rng() < friendlyChance) {
      const friendlyCount = 1 + Math.floor(rng() * (isExpanse ? 3 : 1));
      for (let i = 0; i < friendlyCount; i += 1) {
        const def = FRIENDLY_TYPES[Math.floor(rng() * FRIENDLY_TYPES.length)];
        if (sector.objects.tradeRoutes.length && rng() < 0.7) {
          const route = sector.objects.tradeRoutes[Math.floor(rng() * sector.objects.tradeRoutes.length)];
          const routeT = rng();
          const offset = randRange(rng, -route.width * 0.25, route.width * 0.25);
          const dx = route.x2 - route.x1;
          const dy = route.y2 - route.y1;
          spawnFriendly(def.id, route.x1 + dx * routeT + route.nx * offset, route.y1 + dy * routeT + route.ny * offset, {
            sector,
            angle: route.angle,
            faction: 'aetherline',
            routeId: route.id,
            routeT,
            routeDir: rng() < 0.5 ? 1 : -1,
            routeOffset: offset,
            rng
          });
        } else {
          const angle = rng() * Math.PI * 2;
          const radius = randRange(rng, fieldRadius * 0.3, fieldRadius * 0.7);
          spawnFriendly(def.id, center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, {
            sector,
            angle,
            faction: 'aetherline',
            anchor: { x: center.x, y: center.y },
            orbitRadius: radius,
            orbitAngle: angle,
            rng
          });
        }
      }
    }

    if (!sector.isVoid && rng() < (isCluster ? 0.38 : isExpanse ? 0.03 : 0.06) * densityScale) {
      sector.objects.storms.push({
        x: center.x + randRange(rng, -fieldRadius, fieldRadius),
        y: center.y + randRange(rng, -fieldRadius, fieldRadius),
        radius: randRange(rng, 120, 220),
        intensity: randRange(rng, 0.3, 0.7)
      });
    }

    if (!sector.isVoid && rng() < (isCluster ? 0.28 : isExpanse ? 0.08 : 0.14) * densityScale) {
      sector.objects.anomalies.push({
        x: center.x + randRange(rng, -fieldRadius, fieldRadius),
        y: center.y + randRange(rng, -fieldRadius, fieldRadius),
        radius: randRange(rng, 40, 70),
        charge: 0
      });
    }

    rng = terrainRng;
    const propTypes = BIOME_PROPS[sector.biome] || [];
    const blendProps = blendBiome ? BIOME_PROPS[sector.blendBiome] || [] : [];
    const propCount = isCluster
      ? Math.floor(randRange(rng, 2, 6) * densityScale * richBoost)
      : isExpanse
        ? Math.floor(randRange(rng, 1, 2) * densityScale * 0.4)
        : Math.floor(randRange(rng, 1, 3) * densityScale);
    for (let i = 0; i < propCount; i += 1) {
      if (!propTypes.length) break;
      const pool = blendProps.length && rng() < blendWeight ? blendProps : propTypes;
      const type = pool[Math.floor(rng() * pool.length)];
      sector.objects.biomeProps.push({
        type,
        x: center.x + randRange(rng, -fieldRadius, fieldRadius),
        y: center.y + randRange(rng, -fieldRadius, fieldRadius),
        size: randRange(rng, 18, 56),
        hue: randRange(rng, biome.hue - 30, biome.hue + 40)
      });
    }

    rng = structureRng;
    const ruinChance = sector.zoneType === 'expanse'
      ? (sector.isVoid ? 0.1 : 0.15)
      : sector.zoneType === 'rift'
        ? 0.18
        : isCluster
          ? 0.16
          : 0.12;
    if (!world.ruinClaims?.[sector.key] && rng() < ruinChance * (sector.isVoid ? 0.7 : densityScale)) {
      const vault = sector.zoneType === 'expanse' && rng() < 0.55;
      sector.objects.ruins.push({
        id: `${sector.key}-ruin`,
        x: center.x + randRange(rng, -fieldRadius * 0.9, fieldRadius * 0.9),
        y: center.y + randRange(rng, -fieldRadius * 0.9, fieldRadius * 0.9),
        radius: vault ? randRange(rng, 42, 70) : randRange(rng, 26, 46),
        guarded: vault ? rng() < 0.85 : rng() < (isCluster ? 0.5 : 0.7),
        loot: vault ? 'vault' : rng() < 0.6 ? 'blueprint' : 'relic',
        tier: vault ? 'vault' : 'ruin',
        discovered: false
      });
    }

    const landmarkChance = sector.zoneType === 'expanse'
      ? (sector.isVoid ? 0.28 : 0.14)
      : isCluster
        ? 0.18 * densityScale * (sector.isCore ? 1.2 : 1)
        : 0.1 * densityScale;
    if (!world.landmarkClaims?.[sector.key] && rng() < landmarkChance * (1 - openSpace * 0.6)) {
      const type = pickLandmarkType(sector, rng);
      if (type) {
        const blueprint = type.reward?.blueprint ? pickRandomBlueprint(rng) : null;
        sector.objects.landmarks.push({
          id: `${sector.key}-landmark`,
          type: type.id,
          name: type.name,
          x: center.x + randRange(rng, -fieldRadius * 0.85, fieldRadius * 0.85),
          y: center.y + randRange(rng, -fieldRadius * 0.85, fieldRadius * 0.85),
          radius: type.radius,
          color: type.color,
          reward: type.reward || {},
          blueprint,
          faction: sector.faction?.id || ''
        });
      }
    }

    rng = eventRng;
    if (!isCluster) {
      const beaconCount = sector.zoneType === 'rift'
        ? 2 + Math.floor(rng() * 2)
        : sector.zoneType === 'expanse'
          ? 1 + Math.floor(rng() * 2)
          : 1 + Math.floor(rng() * 2);
      const beaconColor = sector.zoneType === 'expanse'
        ? 'rgba(154,214,255,0.5)'
        : sector.zoneType === 'rift'
          ? 'rgba(255,209,102,0.5)'
          : 'rgba(125,252,154,0.5)';
      for (let i = 0; i < beaconCount; i += 1) {
        sector.objects.riftBeacons.push({
          x: center.x + randRange(rng, -wideField, wideField),
          y: center.y + randRange(rng, -wideField, wideField),
          radius: randRange(rng, 30, 52),
          pulse: randRange(rng, 0, Math.PI * 2),
          color: beaconColor
        });
      }
    }

    if (sector.zoneType === 'expanse') {
      const streamChance = sector.isVoid ? 0.32 : 0.18;
      if (rng() < streamChance) {
        const streamCount = 1 + Math.floor(rng() * (sector.isVoid ? 2 : 1));
        for (let i = 0; i < streamCount; i += 1) {
          sector.objects.slipstreams.push({
            x: center.x + randRange(rng, -wideField, wideField),
            y: center.y + randRange(rng, -wideField, wideField),
            radius: randRange(rng, 220, 420),
            length: randRange(rng, fieldRadius * 0.8, fieldRadius * 1.6),
            angle: rng() * Math.PI * 2,
            strength: randRange(rng, 160, 240) * (sector.isVoid ? 1.2 : 1),
            phase: rng() * Math.PI * 2
          });
        }
      }
    }

    rng = encounterRng;
    sector.encounters = [];
    const encounterScale = (0.6 + density * 0.8) * (1 - openSpace * 0.6) * (sector.isVoid ? 0.45 : 1);
    const baseChance = isCluster ? 0.78 : isExpanse ? 0.38 : 0.55;
    if (rng() < baseChance * encounterScale) {
      const encounterCount = 1 + Math.floor(rng() * (sector.isCore ? 2 : 1));
      for (let i = 0; i < encounterCount; i += 1) {
        const roll = rng();
        let type = 'patrol';
        if (isExpanse) {
          type = roll < 0.25 ? 'raid' : roll < 0.5 ? 'convoy' : roll < 0.7 ? 'ambush' : 'patrol';
        } else if (isCluster) {
          type = roll < 0.2 ? 'raid' : roll < 0.45 ? 'convoy' : roll < 0.8 ? 'patrol' : 'guard';
        } else {
          type = roll < 0.2 ? 'raid' : roll < 0.55 ? 'patrol' : 'convoy';
        }
        if (sector.isVoid && roll < 0.6) type = roll < 0.3 ? 'convoy' : 'patrol';
        sector.encounters.push({
          id: `${sector.key}-enc-${i}`,
          type,
          x: center.x + randRange(rng, -fieldRadius * 0.9, fieldRadius * 0.9),
          y: center.y + randRange(rng, -fieldRadius * 0.9, fieldRadius * 0.9),
          strength: randRange(rng, 0.85, 1.25),
          sight: randRange(rng, 520, 860),
          radius: randRange(rng, 140, 240),
          waves: type === 'ambush' ? 2 : 1,
          cooldown: randRange(rng, 1.5, 3.5),
          cleared: false
        });
      }
    }

    if (sector.objects.tradeRoutes.length && rng() < (isExpanse ? 0.6 : 0.45) * (sector.isVoid ? 0.5 : 1)) {
      const route = sector.objects.tradeRoutes[Math.floor(rng() * sector.objects.tradeRoutes.length)];
      if (route) {
        const midX = (route.x1 + route.x2) / 2 + route.nx * randRange(rng, -route.width * 0.3, route.width * 0.3);
        const midY = (route.y1 + route.y2) / 2 + route.ny * randRange(rng, -route.width * 0.3, route.width * 0.3);
        sector.encounters.push({
          id: `${sector.key}-enc-raid-${Math.floor(rng() * 999)}`,
          type: 'raid',
          x: midX,
          y: midY,
          strength: randRange(rng, 0.9, 1.3),
          sight: randRange(rng, 620, 900),
          radius: randRange(rng, 160, 260),
          waves: 1,
          cooldown: randRange(rng, 2, 4),
          cleared: false
        });
      }
    }

    if (!sector.encounters.length && isCluster && !sector.isVoid) {
      sector.encounters.push({
        id: `${sector.key}-enc-patrol`,
        type: 'patrol',
        x: center.x + randRange(encounterRng, -fieldRadius * 0.8, fieldRadius * 0.8),
        y: center.y + randRange(encounterRng, -fieldRadius * 0.8, fieldRadius * 0.8),
        strength: 0.9 + density * 0.4,
        sight: 760,
        radius: 180,
        waves: 1,
        cooldown: 2,
        cleared: false
      });
    }

    rng = terrainRng;
    if (sector.isCore && sector.objects.planets.length === 0) {
      sector.objects.planets.push({
        x: center.x + randRange(rng, -fieldRadius, fieldRadius),
        y: center.y + randRange(rng, -fieldRadius, fieldRadius),
        radius: randRange(rng, 90, 200),
        hue: randRange(rng, biome.hue - 15, biome.hue + 35),
        mass: randRange(rng, 0.8, 1.6),
        ring: rng() < 0.7
      });
    }
  }

  function spawnBaseInSector(sector, baseTypeId) {
    if (!sector) return;
    const baseType = BASE_TYPES[baseTypeId] || BASE_TYPES.outpost;
    if (sector.objects.bases.length) return;
    const center = posFromGrid(sector.gx, sector.gy);
    const fieldRadius = WORLD.sectorSize * 0.04;
    sector.objects.bases.push({
      id: `${sector.key}-base`,
      type: baseType.id,
      x: center.x + randRange(Math.random, -fieldRadius, fieldRadius),
      y: center.y + randRange(Math.random, -fieldRadius, fieldRadius),
      faction: sector.faction?.id || '',
      hp: baseType.hp,
      shield: baseType.shield,
      radius: baseType.radius,
      turrets: Array.from({ length: baseType.turretCount }).map((_, idx) => ({
        angle: (Math.PI * 2 * idx) / baseType.turretCount,
        cooldown: randRange(Math.random, 0.4, 1.2)
      })),
      spawnTimer: randRange(Math.random, 2, 4),
      def: baseType
    });
  }

  function getSystemName(gx, gy) {
    const key = sectorKey(gx, gy);
    if (world.systemNames.has(key)) return world.systemNames.get(key);
    const rng = mulberry32(WORLD_SEED + gx * 97 + gy * 131 + 909);
    const name = `${SYSTEM_NAME_PARTS.prefix[Math.floor(rng() * SYSTEM_NAME_PARTS.prefix.length)]} ${SYSTEM_NAME_PARTS.suffix[Math.floor(rng() * SYSTEM_NAME_PARTS.suffix.length)]}`;
    world.systemNames.set(key, name);
    return name;
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
      scanRange: 1,
      massMult: 1
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
      if (effect.massMult) bonus.massMult *= effect.massMult;
    });
    result.maxHp *= bonus.hullMult;
    result.maxShield *= bonus.shieldMult;
    result.maxSpeed *= bonus.speedMult;
    result.thrust *= bonus.thrustMult;
    result.reverseThrust *= bonus.thrustMult;
    result.shieldRegen *= bonus.shieldRegenMult;
    result.mass *= bonus.massMult;
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
    const droneBay = DRONE_BAYS[player.modules.droneBay] || DRONE_BAYS.basic;

    const crew = player.crew || { navigator: 0, engineer: 0, quartermaster: 0 };
    const navLevel = crew.navigator || 0;
    const engLevel = crew.engineer || 0;
    const quarterLevel = crew.quartermaster || 0;

    const maxHp = hull.baseHp * (1 + upgrades.hull * 0.16);
    const maxShield = hull.baseShield * (1 + upgrades.shield * 0.18 + shield.capacityBonus);
    const mass = (hull.mass + engine.mass + droneBay.mass) * (1 + upgrades.hull * 0.04);
    const thrust = engine.thrust * (1 + upgrades.engine * 0.08) / mass;
    const reverseThrust = engine.reverse * (1 + upgrades.engine * 0.06) / mass;
    const maxSpeed = engine.maxSpeed * (1 + upgrades.engine * 0.05);
    const baseTurn = engine.turnRate / ENGINES.standard.turnRate;
    const upgradeTurn = 1 + upgrades.engine * 0.07;
    const turnFactor = baseTurn * upgradeTurn;
    const turnRate = engine.turnRate * upgradeTurn;
    const torque = 6.6 * turnFactor / mass;
    let fireDelay = 0.12 * (1 - upgrades.blaster * 0.06);
    fireDelay = Math.max(0.08, fireDelay);
    const damage = 1 + upgrades.blaster * 0.12;
    const boostMax = BASE.boostMax * (1 + upgrades.booster * 0.22);
    const boostRegen = engine.boostRegen * (1 + upgrades.booster * 0.14);
    const fuelMax = (hull.fuelCapacity || 1800) + upgrades.booster * 350 + engLevel * 120;
    const fuelRegen = 0;
    const energyMax = BASE.energyMax * (1 + upgrades.capacitor * 0.2);
    const energyRegen = BASE.energyRegen * (1 + upgrades.capacitor * 0.16);
    const shieldRegen = shield.regen * (1 + upgrades.shield * 0.12);
    const shieldDelay = Math.max(0.6, shield.delay - upgrades.shield * 0.05);
    const armor = hull.armor + upgrades.hull * 0.02 + shield.resist;
    const cargoMax = hull.cargo + upgrades.hull * 2 + quarterLevel * 2;
    const massRatio = clamp(mass / 0.28, 0.7, 1.6);
    const linearDamp = clamp(PHYSICS.linearDamp + (massRatio - 1) * 0.004, 0.984, 0.996);
    const assistDamp = clamp(PHYSICS.assistDamp + (1 - massRatio) * 0.06, 0.82, 0.94);
    const angularDamp = clamp(PHYSICS.angularDamp + (massRatio - 1) * 0.02, 0.82, 0.93);
    const maxAngular = clamp(PHYSICS.maxAngular * turnFactor - (massRatio - 1) * 0.4, 2.6, 4.1);

    const baseStats = {
      maxHp,
      maxShield,
      thrust,
      reverseThrust,
      maxSpeed,
      turnRate,
      torque,
      fireDelay,
      damage,
      boostMax,
      boostRegen,
      fuelMax,
      fuelRegen,
      fuelEfficiency: clamp(1 - engLevel * 0.04, 0.7, 1),
      energyMax,
      energyRegen,
      shieldRegen,
      shieldDelay,
      armor,
      mass,
      cargoMax,
      linearDamp,
      assistDamp,
      angularDamp,
      maxAngular,
      hyperEfficiency: clamp(1 - navLevel * 0.04, 0.7, 1),
      hyperRangeMult: 1 + navLevel * 0.06,
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
      const fuelRatio = prev.fuelMax > 0 ? player.fuel / prev.fuelMax : 1;
      player.hp = clamp(cachedStats.maxHp * hpRatio, 0, cachedStats.maxHp);
      player.shield = clamp(cachedStats.maxShield * shieldRatio, 0, cachedStats.maxShield);
      player.boost = clamp(cachedStats.boostMax * boostRatio, 0, cachedStats.boostMax);
      player.energy = clamp(cachedStats.energyMax * energyRatio, 0, cachedStats.energyMax);
      player.fuel = clamp(cachedStats.fuelMax * fuelRatio, 0, cachedStats.fuelMax);
    } else {
      player.hp = cachedStats.maxHp;
      player.shield = cachedStats.maxShield;
      player.boost = cachedStats.boostMax;
      player.energy = cachedStats.energyMax;
      player.fuel = cachedStats.fuelMax;
    }
    state.scanRadius = 1500 * (cachedStats.scanRange || 1);
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
    const start = getStartLocation();
    player.x = start.x;
    player.y = start.y;
    player.vx = 0;
    player.vy = 0;
    player.angle = -Math.PI / 2;
    player.angularVelocity = 0;
    player.throttle = 0;
  }

  function getStartLocation() {
    const rng = mulberry32(WORLD_SEED * 5 + 833);
    const candidates = [];
    for (let ring = START_CONFIG.ringMin; ring <= START_CONFIG.ringMax; ring += 1) {
      for (let gx = -ring; gx <= ring; gx += 1) {
        for (let gy = -ring; gy <= ring; gy += 1) {
          if (depthFromGrid(gx, gy) !== ring) continue;
          const profile = getSectorProfile(gx, gy);
          if (profile.zoneType !== 'expanse') continue;
          if (gx === 0 && gy === 0) continue;
          candidates.push({ gx, gy });
        }
      }
      if (candidates.length) break;
    }
    const pick = candidates.length ? candidates[Math.floor(rng() * candidates.length)] : { gx: 2, gy: -1 };
    const center = posFromGrid(pick.gx, pick.gy);
    const offset = WORLD.sectorSize * START_CONFIG.offsetScale;
    return {
      x: center.x + randRange(rng, -offset, offset),
      y: center.y + randRange(rng, -offset, offset)
    };
  }

  function resetHomeDefense() {
    if (!world.homeBase) return;
    world.homeBase.hp = world.homeBase.maxHp;
    world.homeBase.shield = world.homeBase.maxShield;
    if (!world.homeBase.turrets || world.homeBase.turrets.length === 0) {
      world.homeBase.turrets = Array.from({ length: HOME_DEF.turretCount }).map((_, idx) => ({
        angle: (Math.PI * 2 * idx) / HOME_DEF.turretCount,
        cooldown: Math.random() * 0.8
      }));
    } else {
      world.homeBase.turrets.forEach((turret) => {
        turret.cooldown = Math.random() * 0.8;
      });
    }
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
      player.callsign = '';
      player.affiliation = '';
      player.factionRep = {};
      player.hyperCharge = HYPER.maxCharge;
      player.heat = 0;
      player.angularVelocity = 0;
      player.throttle = 0;
      player.flightAssist = true;
      player.upgrades = { engine: 0, blaster: 0, capacitor: 0, shield: 0, hull: 0, booster: 0 };
      player.blueprints = new Set();
      player.cosmetics = new Set();
      player.toys = new Set();
      player.lore = new Set();
      player.atlasSigils = new Set();
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
      player.fuel = computeStats().fuelMax;
      player.ammo = { slugs: 60, missiles: 12, torpedoes: 4, flak: 50, mines: 6 };
      player.inventory.cargo = { salvage: 0, alloys: 0, relics: 0 };
      player.crew = { navigator: 0, engineer: 0, quartermaster: 0 };
      player.milestones = new Set();
      player.discoveryUploads = new Set();
      player.chapterIndex = 0;
      player.distanceThisChapter = 0;
      player.distanceTotal = 0;
      player.checkpointIndex = 0;
      player.hyperCharge = HYPER.maxCharge;
      state.storyLog = [];
      state.loreScroll = 0;
      state.unlockedDepth = 1;
      state.lastZoneType = '';
      state.hyperDrive = { cooldown: 0 };
      state.hyperNav = { chargeLevel: 10, targetIndex: 0 };
      state.hyperJumpFx = { timer: 0, duration: 1.0, pending: null };
      state.boundaryTimer = 0;
      state.boundaryWarning = 0;
      state.broadcastCooldown = 0;
      state.activeTrader = null;
      state.activeStation = null;
      state.traderSelection = 0;
      state.traderQuote = '';
      state.rumorCooldown = 0;
      state.failureLedger = {};
      state.tutorialSeen = false;
      state.tutorialActive = false;
      state.tutorialReady = false;
      state.tutorialFlags = { moved: false, boosted: false, scanned: false };
      state.tutorialOrigin = { x: 0, y: 0 };
      state.trafficSpawnTimer = 0;
      state.cargoHinted = false;
      state.purposeHinted = false;
      state.spawnGrace = 25;
      state.escape = { active: false, timer: 0, reason: '' };
      state.capture = { active: false, faction: '', label: '', origin: '' };
      state.capturePressure = 0;
      state.captureWindow = 120;
      state.startEncounterTimer = 4;
      state.startEncounterSeeded = true;
      state.radioCooldown = 0;
      state.enemyQuietTimer = 0;
      state.hudMode = 'full';
      state.inNoFireZone = false;
      state.noFireCooldown = 0;
      state.scoopCooldown = 0;
      state.beaconHintCooldown = 0;
      state.codexSeen = false;
      state.codexScroll = 0;
      state.codexReturn = 'flight';
      state.civicTutorialDone = false;
      state.civicTutorial = { active: false, step: 0, label: '' };
      state.introCompleted = false;
      state.intro = { active: true, phase: 'drift', timer: 0, captureQueued: false };
      state.atlasUnlocked = false;
      state.atlasCompleted = false;
      world.discovered.clear();
      world.bossDefeated = {};
      world.stationContracts = {};
      world.baseClaims = {};
      world.beaconClaims = {};
      world.ruinClaims = {};
      world.landmarkClaims = {};
      world.biomeStations = {};
      world.relayStations = [];
      world.systemNames = new Map();
      world.cities = [];
      world.civicKeys = new Set();
      world.cityMap = new Map();
      world.gatePositions = {};
      world.convergenceGate = null;
      world.clusterFields = [];
      world.sectors.clear();
      buildClusterMap();
      buildGateMap();
      buildStationMap();
      buildCityMap();
      buildTradeLanes();
      buildSkygridBackground();
      resetHomeDefense();
      contract.active = false;
      contract.type = '';
      contract.target = 0;
      contract.progress = 0;
      contract.reward = 0;
      contract.text = '';
      contract.originKey = '';
      contract.originBiome = '';
      contract.originFaction = '';
      contract.convoyId = '';
      contract.convoyKey = '';
      contract.escortTime = 0;
      contract.escortTotal = 0;
      contract.raidTimer = 0;
      mission.active = false;
      state.prompt = null;
    }
    initPlayerPosition();
    refreshStats({ keepRatios: false });
    spawnDrones();
    resetChapterState();
    assignCallsign();
    setCheckpoint();
    state.spawnGrace = Math.max(state.spawnGrace || 0, 20);
    state.awaitingBrief = true;
    showBriefing();
    noteStatus(full ? 'Fresh run initialized.' : 'Run reset.');
  }

  function awardCredits(amount, reason) {
    player.credits += amount;
    player.inventory.credits = player.credits;
    if (reason) noteStatus(`${reason} +${amount} credits.`);
  }

  function getFactionColor(factionId, fallback) {
    if (!factionId) return fallback;
    const match = FACTIONS.find((f) => f.id === factionId);
    return match?.color || fallback;
  }

  function isAlliedFaction(factionId) {
    return !!(factionId && player.affiliation && factionId === player.affiliation);
  }

  function getLiveryForFaction(factionId) {
    if (!factionId) return LIVERY_COLORS.neutral;
    return LIVERY_COLORS[factionId] || LIVERY_COLORS.neutral;
  }

  function getFactionRep(factionId) {
    if (!factionId) return 0;
    return clamp(player.factionRep?.[factionId] || 0, -100, 100);
  }

  function adjustFactionRep(factionId, delta, reason) {
    if (!factionId) return;
    const current = getFactionRep(factionId);
    const next = clamp(current + delta, -100, 100);
    if (!player.factionRep) player.factionRep = {};
    player.factionRep[factionId] = next;
    if (reason) noteStatus(`${reason} (${FACTIONS.find((f) => f.id === factionId)?.name || factionId} ${next >= 0 ? '+' : ''}${Math.round(next)})`);
  }

  function getFactionDiscount(factionId) {
    const rep = getFactionRep(factionId);
    if (rep >= 60) return 0.15;
    if (rep >= 30) return 0.08;
    if (rep >= 10) return 0.04;
    if (rep <= -40) return -0.12;
    if (rep <= -20) return -0.06;
    return 0;
  }

  function applyFactionPrice(cost, factionId) {
    const discount = getFactionDiscount(factionId);
    return Math.max(1, Math.round(cost * (1 - discount)));
  }

  function awardAtlasSigil(biome) {
    if (!biome) return;
    if (player.atlasSigils.has(biome)) return;
    player.atlasSigils.add(biome);
    const entry = ATLAS_SIGILS.find((sigil) => sigil.biome === biome);
    noteStatus(`${entry?.name || 'Atlas Sigil'} acquired.`);
    pushStoryLog(`Atlas updated: ${BIOMES[biome]?.name || biome}.`);
    if (player.atlasSigils.size >= ATLAS_REQUIRED) {
      state.atlasUnlocked = true;
      noteStatus('Atlas Convergence unlocked. New gate detected.');
      pushStoryLog('Atlas Convergence gate online.');
    }
  }

  function claimLandmark(landmark, sector) {
    if (!landmark || !sector) return;
    world.landmarkClaims = world.landmarkClaims || {};
    world.landmarkClaims[sector.key] = landmark.type;
    const rewardCredits = landmark.reward?.credits || 0;
    if (rewardCredits > 0) {
      awardCredits(rewardCredits, `${landmark.name} secured`);
    } else {
      noteStatus(`${landmark.name} secured.`);
    }
    if (landmark.reward?.lore) {
      unlockLoreEntry('landmark');
    }
    if (landmark.reward?.rep) {
      Object.entries(landmark.reward.rep).forEach(([factionId, delta]) => {
        adjustFactionRep(factionId, delta, 'Landmark influence');
      });
    }
    if (landmark.reward?.blueprint && landmark.blueprint) {
      state.prompt = { type: 'blueprint', id: landmark.blueprint, name: BLUEPRINTS[landmark.blueprint].name };
      state.mode = 'prompt';
      state.paused = true;
    }
    pushStoryLog(`Landmark recovered: ${landmark.name} (${sector.name}).`);
  }

  function completeAtlasConvergence() {
    if (state.atlasCompleted) return;
    state.atlasCompleted = true;
    awardCredits(1400, 'Atlas Convergence');
    const blueprintKeys = Object.keys(BLUEPRINTS);
    const reward = blueprintKeys[(player.atlasSigils.size + 3) % blueprintKeys.length];
    if (!player.blueprints.has(reward)) {
      applyBlueprint(reward, true);
      noteStatus(`Convergence reward: ${BLUEPRINTS[reward].name}`);
    }
    pushStoryLog('Convergence achieved. The atlas stabilizes.');
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
    const prevKey = state.currentSectorKey;
    const prevZone = state.lastZoneType;
    const sector = getSector(gx, gy);
    state.currentSectorKey = sector.key;
    state.lastZoneType = sector.zoneType;
    if (!sector.discovered) {
      sector.discovered = true;
      sector.discoveredAt = Date.now();
      world.discovered.add(sector.key);
      awardCredits(50, 'Sector discovered');
      pushStoryLog(`Discovered ${sector.name} (${sector.gx},${sector.gy}).`);
    }
    if (prevKey && prevKey !== sector.key && state.running) {
      noteStatus(`Entered ${sector.name} - ${sector.zone?.label || 'Cluster'}`);
      broadcastMessage(sector);
    } else if (prevZone && prevZone !== sector.zoneType && state.running) {
      noteStatus(`Entering ${sector.zone?.label || 'Cluster'}`);
      broadcastMessage(sector);
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

  function spawnEnemy(type, x, y, scale = 1, options = {}) {
    const def = ENEMY_TYPES[type];
    if (!def) return null;
    const levelScale = 1 + (player.level - 1) * 0.08;
    const variant = Math.floor(Math.random() * 3);
    const trim = Math.random();
    const enemy = {
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
      shield: def.role === 'bomber' ? 20 : 0,
      armor: def.armor || 0,
      hangar: def.hangar ? Math.floor(def.hangar * scale) : 0,
      spawnCooldown: def.hangar ? randRange(Math.random, 1.4, 3.4) : 0,
      cargo: def.role === 'transport' ? 3 + Math.floor(scale * 2) : 0,
      variant,
      trim,
      faction: options.faction || options.factionId || '',
      raid: options.raid || false,
      raidConvoyId: options.raidConvoyId || '',
      captureBias: options.captureBias || 0,
      patrolTag: options.patrolTag || ''
    };
    entities.enemies.push(enemy);
    return enemy;
  }

  function spawnFriendly(typeId, x, y, options = {}) {
    const def = FRIENDLY_TYPES.find((entry) => entry.id === typeId) || FRIENDLY_TYPES[0];
    if (!def) return null;
    const rng = options.rng || Math.random;
    const scale = options.scale || 1;
    const maxHp = (def.hp || 80) * scale;
    const friendly = {
      id: options.id || `${typeId}-${Math.floor(rng() * 1e6)}`,
      type: def.id,
      role: def.role,
      x,
      y,
      vx: 0,
      vy: 0,
      angle: options.angle || 0,
      size: def.size * scale,
      speed: def.speed * scale,
      color: options.color || def.color,
      fireRate: def.fireRate,
      damage: def.damage,
      range: def.range,
      cooldown: randRange(rng, 0.2, def.fireRate),
      faction: options.faction || 'aetherline',
      hp: maxHp,
      maxHp,
      shield: (def.shield || 0) * scale,
      maxShield: (def.shield || 0) * scale,
      armor: def.role === 'guardian' ? 0.12 : def.role === 'patrol' ? 0.08 : 0.04,
      routeId: options.routeId || '',
      routeT: options.routeT || 0,
      routeDir: options.routeDir || 1,
      routeOffset: options.routeOffset || 0,
      sway: rng() * Math.PI * 2,
      anchor: options.anchor || null,
      orbitRadius: options.orbitRadius || 0,
      orbitAngle: options.orbitAngle || 0
    };
    if (options.sector?.objects?.friendlies) {
      options.sector.objects.friendlies.push(friendly);
    }
    return friendly;
  }

  function ensureTrafficRoute(sector, rng, { hidden = true } = {}) {
    if (!sector?.objects) return null;
    if (sector.objects.tradeRoutes?.length) {
      return sector.objects.tradeRoutes[Math.floor(rng() * sector.objects.tradeRoutes.length)];
    }
    const center = posFromGrid(sector.gx, sector.gy);
    const angle = rng() * Math.PI * 2;
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    const perp = { x: -dir.y, y: dir.x };
    const length = WORLD.sectorSize * randRange(rng, 0.45, 0.7);
    const midOffset = randRange(rng, -WORLD.sectorSize * 0.22, WORLD.sectorSize * 0.22);
    const mid = { x: center.x + perp.x * midOffset, y: center.y + perp.y * midOffset };
    const half = length / 2;
    const route = {
      id: `${sector.key}-traffic-${Math.floor(rng() * 99999)}`,
      x1: mid.x - dir.x * half,
      y1: mid.y - dir.y * half,
      x2: mid.x + dir.x * half,
      y2: mid.y + dir.y * half,
      width: randRange(rng, 100, 170),
      hidden
    };
    const dx = route.x2 - route.x1;
    const dy = route.y2 - route.y1;
    route.length = Math.hypot(dx, dy);
    route.angle = Math.atan2(dy, dx);
    route.nx = -dy / (route.length || 1);
    route.ny = dx / (route.length || 1);
    sector.objects.tradeRoutes.push(route);
    return route;
  }

  function spawnCivilianShip(sector, options = {}) {
    if (!sector?.objects) return null;
    const rng = options.rng || Math.random;
    const type = options.type || CIVILIAN_TYPES[Math.floor(rng() * CIVILIAN_TYPES.length)];
    const center = posFromGrid(sector.gx, sector.gy);
    const route = options.route || null;
    let x = options.x ?? center.x + randRange(rng, -WORLD.sectorSize * 0.35, WORLD.sectorSize * 0.35);
    let y = options.y ?? center.y + randRange(rng, -WORLD.sectorSize * 0.35, WORLD.sectorSize * 0.35);
    let angle = options.angle ?? rng() * Math.PI * 2;
    let routeId = '';
    let routeT = 0;
    let routeDir = 1;
    let routeOffset = 0;
    if (route) {
      const dx = route.x2 - route.x1;
      const dy = route.y2 - route.y1;
      routeT = rng();
      routeDir = rng() < 0.5 ? 1 : -1;
      routeOffset = randRange(rng, -route.width * 0.3, route.width * 0.3);
      x = route.x1 + dx * routeT + route.nx * routeOffset;
      y = route.y1 + dy * routeT + route.ny * routeOffset;
      angle = route.angle + (routeDir < 0 ? Math.PI : 0);
      routeId = route.id;
    }
    const civFaction = options.faction || (sector.faction?.id && rng() < 0.6 ? sector.faction.id : 'neutral');
    const livery = getLiveryForFaction(civFaction);
    const ship = {
      id: options.id || `${sector.key}-traffic-${Math.floor(rng() * 1e6)}`,
      type: type.id,
      label: type.label,
      x,
      y,
      angle,
      speed: randRange(rng, type.speed * 0.8, type.speed * 1.3),
      size: type.size,
      color: type.color,
      faction: civFaction,
      livery,
      hp: type.hp,
      maxHp: type.hp,
      shield: type.id === 'freighter' ? 18 : type.id === 'hauler' ? 12 : 0,
      armor: type.id === 'freighter' ? 0.08 : 0.04,
      routeId,
      routeT,
      routeDir,
      routeOffset,
      turn: randRange(rng, -0.1, 0.1),
      sway: rng() * Math.PI * 2
    };
    sector.objects.civilians.push(ship);
    return ship;
  }

  function seedRouteTraffic(sector, route, rng, boost = 1) {
    if (!sector || !route) return;
    const convoyMax = sector.zoneType === 'lane'
      ? TRADE_ROUTE_CONFIG.convoyMaxLane
      : sector.zoneType === 'expanse'
        ? TRADE_ROUTE_CONFIG.convoyMaxExpanse
        : TRADE_ROUTE_CONFIG.convoyMin + 1;
    const baseCount = TRADE_ROUTE_CONFIG.convoyMin + Math.floor(rng() * (convoyMax - TRADE_ROUTE_CONFIG.convoyMin + 1));
    const convoyCount = Math.max(1, Math.round(baseCount * boost));
    for (let i = 0; i < convoyCount; i += 1) {
      spawnCivilianShip(sector, { rng, route });
    }
    const escortChance = Math.min(1, TRADE_ROUTE_CONFIG.escortChance * (0.9 + boost * 0.2));
    if (rng() < escortChance) {
      const baseEscorts = TRADE_ROUTE_CONFIG.escortMin + Math.floor(rng() * (TRADE_ROUTE_CONFIG.escortMax - TRADE_ROUTE_CONFIG.escortMin + 1));
      const escortCount = Math.max(1, Math.round(baseEscorts * (0.7 + boost * 0.3)));
      for (let i = 0; i < escortCount; i += 1) {
        const def = FRIENDLY_TYPES[Math.floor(rng() * FRIENDLY_TYPES.length)];
        const routeT = rng();
        const offset = randRange(rng, -route.width * 0.25, route.width * 0.25);
        const dx = route.x2 - route.x1;
        const dy = route.y2 - route.y1;
        spawnFriendly(def.id, route.x1 + dx * routeT + route.nx * offset, route.y1 + dy * routeT + route.ny * offset, {
          sector,
          angle: route.angle,
          faction: player.affiliation || 'aetherline',
          routeId: route.id,
          routeT,
          routeDir: rng() < 0.5 ? 1 : -1,
          routeOffset: offset,
          rng
        });
      }
    }
  }

  function seedRouteEncounters(sector, route, rng, city = null) {
    if (!sector || !route) return;
    const encounters = sector.encounters || (sector.encounters = []);
    const existing = encounters.filter((enc) => enc && !enc.cleared);
    if (existing.length > 4) return;
    const midX = (route.x1 + route.x2) / 2 + route.nx * randRange(rng, -route.width * 0.25, route.width * 0.25);
    const midY = (route.y1 + route.y2) / 2 + route.ny * randRange(rng, -route.width * 0.25, route.width * 0.25);
    if (city && dist(midX, midY, city.x, city.y) < (city.safeRadius || city.radius + 200)) return;
    const raidChance = route.source === 'lane' ? 0.55 : 0.28;
    const convoyChance = route.source === 'lane' ? 0.4 : 0.2;
    if (rng() < convoyChance) {
      encounters.push({
        id: `${sector.key}-enc-convoy-${Math.floor(rng() * 9999)}`,
        type: 'convoy',
        x: midX,
        y: midY,
        strength: randRange(rng, 0.9, 1.25),
        sight: randRange(rng, 620, 900),
        radius: randRange(rng, 160, 260),
        waves: 1,
        cooldown: randRange(rng, 2, 4),
        cleared: false
      });
    }
    if (rng() < raidChance) {
      encounters.push({
        id: `${sector.key}-enc-raid-${Math.floor(rng() * 9999)}`,
        type: 'raid',
        x: midX,
        y: midY,
        strength: randRange(rng, 0.95, 1.35),
        sight: randRange(rng, 640, 920),
        radius: randRange(rng, 160, 260),
        waves: 1,
        cooldown: randRange(rng, 2, 4),
        cleared: false
      });
    }
  }

  function attachCitySpurs(sector, city, routes) {
    if (!sector || !city || !routes?.length) return;
    routes.forEach((route) => {
      if (!route || route.hidden) return;
      const dx = route.x2 - route.x1;
      const dy = route.y2 - route.y1;
      const lenSq = dx * dx + dy * dy;
      if (lenSq <= 1) return;
      const t = clamp(((city.x - route.x1) * dx + (city.y - route.y1) * dy) / lenSq, 0, 1);
      const px = route.x1 + dx * t;
      const py = route.y1 + dy * t;
      const distToCity = Math.hypot(px - city.x, py - city.y);
      if (distToCity < (city.radius || 120) * 1.2) return;
      const sx = city.x;
      const sy = city.y;
      const spurDx = px - sx;
      const spurDy = py - sy;
      const spurLen = Math.hypot(spurDx, spurDy) || 1;
      sector.objects.tradeRoutes.push({
        id: `${route.id}-spur-${city.id}`,
        x1: sx,
        y1: sy,
        x2: px,
        y2: py,
        width: Math.max(90, route.width * 0.6),
        length: spurLen,
        angle: Math.atan2(spurDy, spurDx),
        nx: -spurDy / spurLen,
        ny: spurDx / spurLen,
        source: 'spur'
      });
    });
  }

  function spawnBoss(x, y) {
    const factionId = getCurrentSector()?.faction?.id || '';
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
      isBoss: true,
      armor: 0.18,
      hangar: 6,
      spawnCooldown: 2.4,
      variant: 2,
      trim: 0.8,
      faction: factionId
    });
    noteStatus('Guardian inbound.');
    addCameraShake(2.2, 0.6);
  }

  function spawnStarterCaptureWing() {
    const sector = getCurrentSector();
    if (!sector) return;
    if (sector.isCivic) return;
    const angle = Math.random() * Math.PI * 2;
    const radius = state.intro?.active ? randRange(Math.random, 520, 720) : randRange(Math.random, 620, 820);
    const anchorX = player.x + Math.cos(angle) * radius;
    const anchorY = player.y + Math.sin(angle) * radius;
    spawnEnemy('transport', anchorX, anchorY, 1.1, { captureBias: 1.1, patrolTag: 'starter', faction: 'ion_clade' });
    const escorts = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < escorts; i += 1) {
      const escortAngle = angle + randRange(Math.random, -0.6, 0.6);
      const escortRadius = randRange(Math.random, 90, 160);
      const escortType = Math.random() < 0.55 ? 'interceptor' : 'fighter';
      spawnEnemy(
        escortType,
        anchorX + Math.cos(escortAngle) * escortRadius,
        anchorY + Math.sin(escortAngle) * escortRadius,
        1,
        { captureBias: 0.7, patrolTag: 'starter', faction: 'ion_clade' }
      );
    }
    state.captureWindow = Math.max(state.captureWindow, 120);
    radioMessage('start');
    noteStatus('Patrol wing detected. Signal Scope updated.');
  }

  function spawnRoamingPatrol(sector) {
    if (!sector) return;
    if (sector.isCivic) return;
    const factionId = sector.faction?.id || '';
    const alliedSector = isAlliedFaction(factionId);
    const angle = Math.random() * Math.PI * 2;
    const radius = randRange(Math.random, PATROL_SPAWN.minDistance, PATROL_SPAWN.maxDistance);
    const anchorX = player.x + Math.cos(angle) * radius;
    const anchorY = player.y + Math.sin(angle) * radius;
    const depth = sector.depth || 1;
    const count = depth < 4 ? 2 : depth < 8 ? 3 : 4;
    for (let i = 0; i < count; i += 1) {
      const offsetAngle = angle + randRange(Math.random, -0.8, 0.8);
      const offsetRadius = randRange(Math.random, 80, 150);
      const typeRoll = Math.random();
      const type = typeRoll < 0.5 ? 'fighter' : typeRoll < 0.8 ? 'interceptor' : 'scout';
      spawnEnemy(
        type,
        anchorX + Math.cos(offsetAngle) * offsetRadius,
        anchorY + Math.sin(offsetAngle) * offsetRadius,
        0.95 + depth * 0.02,
        { captureBias: 0.25, patrolTag: 'roaming', faction: factionId }
      );
    }
    radioMessage('patrol');
    noteStatus('Long-range patrol contact.');
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

  function spawnElectricBurst(x, y, intensity = 1) {
    const count = Math.max(10, Math.floor(18 * intensity));
    for (let i = 0; i < count; i += 1) {
      const angle = randRange(Math.random, 0, Math.PI * 2);
      const radius = randRange(Math.random, 8, 36) * intensity;
      const speed = randRange(Math.random, 80, 200) * intensity;
      const color = i % 3 === 0 ? 'rgba(109,240,255,0.85)' : 'rgba(154,214,255,0.65)';
      spawnParticle(
        x + Math.cos(angle) * radius,
        y + Math.sin(angle) * radius,
        color,
        randRange(Math.random, 0.35, 0.8),
        randRange(Math.random, 2, 5),
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );
    }
    spawnEffect(x, y, 'rgba(109,240,255,0.8)', 40 * intensity);
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

  function spawnSectorEvent(sector) {
    if (!sector) return;
    const rng = mulberry32(WORLD_SEED + sector.gx * 23 + sector.gy * 37 + Math.floor(state.time * 3));
    const center = posFromGrid(sector.gx, sector.gy);
    let pool = ['comet', 'distress', 'driftwave'];
    if (sector.zoneType === 'rift') pool = ['riftflare', 'comet'];
    if (sector.zoneType === 'lane') pool = ['comet', 'distress', 'driftwave'];
    if (sector.zoneType === 'expanse') pool = ['distress', 'driftwave', 'comet'];
    if (sector.zoneType === 'cluster') pool = ['distress', 'meteor', 'comet'];
    const type = pool[Math.floor(rng() * pool.length)];
    const def = EVENT_DEFS[type];
    if (!def) return;
    const angle = rng() * Math.PI * 2;
    const fieldRadius = WORLD.sectorSize * (sector.isCore ? 0.05 : sector.isVoid ? 0.02 : 0.035);
    const radius = randRange(rng, fieldRadius * 0.4, fieldRadius);
    const event = {
      id: `${sector.key}-${type}-${Math.floor(state.time * 10)}`,
      type,
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
      radius: def.radius,
      life: def.life,
      def,
      claimed: false,
      pulse: rng() * Math.PI * 2
    };
    if (type === 'comet' || type === 'meteor') {
      const dir = rng() * Math.PI * 2;
      event.vx = Math.cos(dir) * def.speed;
      event.vy = Math.sin(dir) * def.speed;
    }
    sector.events.push(event);
  }

  function updateEvents(dt) {
    const sector = getCurrentSector();
    if (sector.isCivic) {
      sector.events = [];
      return;
    }
    if (!sector.events) sector.events = [];
    if (sector.events.length < 2 && Math.random() < dt * 0.05) {
      spawnSectorEvent(sector);
    }
    sector.events.forEach((event) => {
      event.life -= dt;
      if (event.type === 'comet' || event.type === 'meteor') {
        event.x += event.vx * dt;
        event.y += event.vy * dt;
        event.vx *= 0.995;
        event.vy *= 0.995;
        spawnParticle(event.x, event.y, 'rgba(180,220,255,0.35)', 0.4, 2, -event.vx * 0.05, -event.vy * 0.05);
      }
      if (event.type === 'driftwave' || event.type === 'riftflare') {
        event.pulse += dt * 2.2;
      }
    });
    sector.events = sector.events.filter((event) => event.life > 0);
  }

  function drawEvents(sector, camera) {
    if (!sector.events || !sector.events.length) return;
    sector.events.forEach((event) => {
      const x = event.x - camera.x + VIEW.centerX;
      const y = event.y - camera.y + VIEW.centerY;
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = event.def.color;
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      if (event.type === 'comet') {
        ctx.beginPath();
        ctx.arc(0, 0, event.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-event.radius * 2, 0);
        ctx.lineTo(event.radius * 2, 0);
        ctx.stroke();
      } else if (event.type === 'meteor') {
        ctx.beginPath();
        ctx.arc(0, 0, event.radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (event.type === 'distress') {
        ctx.beginPath();
        ctx.arc(0, 0, event.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, event.radius * 0.5, 0, Math.PI * 2);
        ctx.stroke();
      } else if (event.type === 'driftwave' || event.type === 'riftflare') {
        const pulse = 0.5 + Math.sin(event.pulse) * 0.5;
        ctx.globalAlpha = 0.5 + pulse * 0.4;
        ctx.beginPath();
        ctx.arc(0, 0, event.radius + pulse * 20, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    });
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
      final *= 1 - clamp(cachedStats.armor || 0, 0, 0.6);
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
    if (target.armor) {
      final *= 1 - clamp(target.armor, 0, 0.65);
    }
    target.hp -= final;
    if (target.hp <= 0) target.hp = 0;
  }

  function handlePlayerDeath() {
    if (attemptCapture()) return;
    state.running = false;
    noteStatus('Hull breach. Press Start to relaunch.');
    submitHighScore(GAME_ID, Math.floor(player.distanceTotal));
  }

  function attemptCapture() {
    if (state.capture?.active) return true;
    const sector = getCurrentSector();
    if (!sector) return false;
    const nearest = findClosestEnemy(player.x, player.y, 520);
    if (!nearest) return false;
    const captureChance = nearest.type === 'carrier' || nearest.type === 'transport' ? 0.85 : 0.55;
    if (Math.random() > captureChance) return false;
    const factionId = nearest.faction || sector.faction?.id || 'redshift_cartel';
    if (isAlliedFaction(factionId)) return false;
    const factionLabel = FACTIONS.find((f) => f.id === factionId)?.name || sector.faction?.name || 'Unknown Fleet';
    triggerCapture(factionId, factionLabel);
    return true;
  }

  function triggerCapture(factionId, label) {
    if (isAlliedFaction(factionId)) return;
    state.capture = {
      active: true,
      faction: factionId,
      label: label || (FACTIONS.find((f) => f.id === factionId)?.name || 'Unknown Fleet'),
      origin: getCurrentSector()?.name || 'Unknown'
    };
    state.mode = 'capture';
    state.paused = true;
    state.spawnGrace = Math.max(state.spawnGrace || 0, 8);
    state.capturePressure = 0;
    player.hp = Math.max(1, cachedStats.maxHp * 0.15);
    player.shield = 0;
    player.vx = 0;
    player.vy = 0;
    spawnEffect(player.x, player.y, '#ffb347', 90);
    noteStatus('Captured. Negotiation channel open.');
    pushStoryLog(`Captured by ${state.capture.label} in ${state.capture.origin}.`);
  }

  function assignFactionContract(factionId) {
    const rng = mulberry32(WORLD_SEED + Math.floor(state.time * 13));
    const templates = [
      { type: 'kills', text: 'Prove loyalty: eliminate patrols', target: 6 + Math.floor(rng() * 4), reward: 260 },
      { type: 'collect', text: 'Recover field data', target: 3 + Math.floor(rng() * 3), reward: 240 },
      { type: 'scan', text: 'Scan a hostile anomaly', target: 1, reward: 220 },
      { type: 'escort', text: 'Defend convoy route', target: 1, reward: 300 }
    ];
    const pick = templates[Math.floor(rng() * templates.length)];
    contract.active = true;
    contract.type = pick.type;
    contract.target = pick.target;
    contract.progress = 0;
    contract.reward = pick.reward + player.level * 20;
    contract.text = pick.text;
    contract.originKey = state.currentSectorKey;
    contract.originBiome = getCurrentSector()?.biome || '';
    contract.originFaction = factionId;
    contract.convoyId = '';
    contract.convoyKey = '';
    contract.escortTime = 0;
    contract.escortTotal = 0;
    contract.raidTimer = 0;
    if (contract.type === 'escort') {
      const sector = getCurrentSector();
      if (sector) startEscortContract(sector);
    }
    noteStatus(`Faction task assigned: ${contract.text}`);
    pushStoryLog('Complete contracts to earn credits and Atlas sigils.');
  }

  function resolveCaptureJoin() {
    const factionId = state.capture?.faction;
    if (factionId) {
      player.affiliation = factionId;
      adjustFactionRep(factionId, 12, 'Joined faction');
      assignFactionContract(factionId);
    }
    const home = world.homeBase;
    if (home) {
      const homeGrid = gridFromPos(home.x, home.y);
      const homeSector = getSector(homeGrid.gx, homeGrid.gy);
      homeSector.discovered = true;
      world.discovered.add(homeSector.key);
      noteStatus('Bastion City coordinates uploaded.');
    }
    player.hp = Math.max(player.hp, cachedStats.maxHp * 0.55);
    player.shield = Math.max(player.shield, cachedStats.maxShield * 0.35);
    if (factionId) {
      entities.enemies = entities.enemies.filter((enemy) => enemy.faction !== factionId);
    }
    state.captureWindow = 0;
    state.capturePressure = 0;
    state.spawnGrace = Math.max(state.spawnGrace || 0, 14);
    state.capture = { active: false, faction: '', label: '', origin: '' };
    state.mode = 'flight';
    state.paused = false;
    state.intro.active = false;
    state.introCompleted = true;
    noteStatus('Accepted into the fleet. New task issued.');
  }

  function resolveCaptureResist() {
    const factionId = state.capture?.faction;
    if (factionId) adjustFactionRep(factionId, -8, 'Defied capture');
    player.credits = Math.max(0, player.credits - 180);
    player.hp = Math.max(1, cachedStats.maxHp * 0.35);
    player.shield = 0;
    state.capture = { active: false, faction: '', label: '', origin: '' };
    state.mode = 'flight';
    state.paused = false;
    state.spawnGrace = Math.max(state.spawnGrace || 0, 10);
    state.intro.active = false;
    state.introCompleted = true;
    noteStatus('You escaped the capture hold. Credits seized.');
  }

  function handleEnemyDeath(enemy) {
    awardCredits(Math.round(28 + enemy.maxHp * 0.45));
    const sector = getCurrentSector();
    const factionId = enemy.faction || sector?.faction?.id;
    if (factionId && factionId !== 'aetherline') {
      adjustFactionRep(factionId, -0.3);
    }
    adjustFactionRep('aetherline', 0.08);
    updateOptionalProgress('kills', { enemy: enemy.type, amount: 1 });
    if (mission.active && mission.type === 'kills') {
      if (!mission.enemyType || mission.enemyType === enemy.type) {
        mission.progress += 1;
        if (mission.progress >= mission.target) completeMission();
      }
    }
    if (mission.active && mission.type === 'carrier' && enemy.type === 'carrier') {
      mission.progress += 1;
      if (mission.progress >= mission.target) completeMission();
    }
    if (mission.active && mission.type === 'convoy' && enemy.type === 'transport') {
      mission.progress += 1;
      if (mission.progress >= mission.target) completeMission();
    }
    if (contract.active && contract.type === 'kills') {
      contract.progress += 1;
      if (contract.progress >= contract.target) completeContract();
    }
    if (contract.active && contract.type === 'carrier' && enemy.type === 'carrier') {
      contract.progress += 1;
      if (contract.progress >= contract.target) completeContract();
    }
    if (contract.active && contract.type === 'convoy' && enemy.type === 'transport') {
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
    if (enemy.type === 'transport' || enemy.type === 'carrier') {
      const quarterLevel = player.crew?.quartermaster || 0;
      const salvageBonus = quarterLevel > 0 ? 1 : 0;
      spawnLoot(enemy.x, enemy.y, 'salvage', 1 + salvageBonus);
      if (Math.random() < 0.5) spawnLoot(enemy.x, enemy.y, 'ammo', 1);
    }
    if (enemy.isBoss) {
      world.bossDefeated[player.chapterIndex] = true;
      awardCredits(700, 'Boss defeated');
      maybeAdvanceChapter(true);
    }
  }

  function destroyBase(base, sector) {
    if (base.hp <= 0) return;
    base.hp = 0;
    world.baseClaims = world.baseClaims || {};
    world.baseClaims[sector.key] = base.type;
    awardCredits(400 + sector.depth * 60, 'Enemy base destroyed');
    if (sector?.faction?.id && sector.faction.id !== 'aetherline') {
      adjustFactionRep(sector.faction.id, -4, 'Faction retaliation');
    }
    adjustFactionRep('aetherline', 1.5);
    if (getCargoCount() < cachedStats.cargoMax) {
      const quarterLevel = player.crew?.quartermaster || 0;
      const salvageGain = 2 + Math.floor(sector.depth * 0.4) + Math.floor(quarterLevel * 0.5);
      player.inventory.cargo.salvage += salvageGain;
    } else {
      noteStatus('Cargo bay full.');
    }
    spawnExplosion(base.x, base.y, base.def.color);
    addCameraShake(1.6, 0.5);
    if (mission.active && mission.type === 'base') {
      mission.progress = mission.target;
      completeMission();
    }
    if (contract.active && contract.type === 'base') {
      contract.progress = contract.target;
      completeContract();
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
      life: weapon.mine ? 6 : weapon.homing ? 3.6 : 1.8,
      damage: weapon.damage,
      color: weapon.color,
      splash: weapon.splash || 0,
      homing: weapon.homing || false,
      turn: weapon.turn || 0,
      emp: weapon.emp || 0,
      capture: weapon.capture || false,
      faction: weapon.faction || '',
      isPlayer,
      mine: weapon.mine || false,
      armed: weapon.mine ? 0.4 : 0,
      trail: weapon.homing || weapon.mine || weapon.splash ? 1 : 0
    };
    if (weapon.homing) {
      projectile.target = findClosestEnemy(originX, originY);
    }
    if (isPlayer) entities.projectiles.push(projectile);
    else entities.enemyShots.push(projectile);
  }

  function fireLaser(weapon, isPrimary = true) {
    if (!weapon || !weapon.hitscan) return;
    if (blockWeaponsForNoFire()) return;
    const now = state.time;
    if (now - player.lastShot < Math.max(cachedStats.fireDelay, weapon.cooldown)) return;
    if (player.energy < weapon.energy) {
      noteStatus('Not enough energy.');
      return;
    }
    player.lastShot = now;
    player.energy = clamp(player.energy - weapon.energy, 0, cachedStats.energyMax);

    const dir = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
    const range = 820;
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
    applyRecoil(dir, weapon.recoil || 0);
  }

  function fireWeapon(weaponId, isPrimary = true) {
    const weapon = WEAPONS[weaponId];
    if (!weapon) return;
    if (blockWeaponsForNoFire()) return;
    if (!player.unlocked.weapons.includes(weaponId)) {
      noteStatus('Weapon locked.');
      return;
    }
    if (weapon.hitscan) {
      fireLaser(weapon, isPrimary);
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
    if (!hasAmmo(weapon)) {
      noteStatus('Out of ammo.');
      return;
    }
    player.energy = clamp(player.energy - weapon.energy, 0, cachedStats.energyMax);
    consumeAmmo(weapon);
    const dir = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
    const damage = weapon.damage * cachedStats.damage * (cachedStats.damageMult || 1);
    const count = weapon.projectiles || 1;
    for (let i = 0; i < count; i += 1) {
      const spread = weapon.spread ? (Math.random() - 0.5) * weapon.spread : 0;
      const angle = Math.atan2(dir.y, dir.x) + spread;
      const shotDir = { x: Math.cos(angle), y: Math.sin(angle) };
      const originOffset = weapon.mine ? -14 : 18;
      spawnProjectile({ ...weapon, damage }, player.x + shotDir.x * originOffset, player.y + shotDir.y * originOffset, shotDir, true);
    }
    spawnEffect(player.x + dir.x * 12, player.y + dir.y * 12, weapon.color, 6);
    applyRecoil(dir, weapon.recoil || 0);
  }

  function fireEMPBurst() {
    const now = state.time;
    if (blockWeaponsForNoFire()) return;
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

  function getHyperChargeLevel() {
    return clamp(state.hyperNav?.chargeLevel || 10, 1, HYPER.steps || 10);
  }

  function getHyperChargePercent(level = getHyperChargeLevel()) {
    const steps = HYPER.steps || 10;
    return clamp(level / steps, 0.1, 1);
  }

  function getHyperChargeCost(level = getHyperChargeLevel()) {
    const efficiency = cachedStats.hyperEfficiency || 1;
    return Math.ceil(HYPER.maxCharge * getHyperChargePercent(level) * efficiency);
  }

  function getHyperJumpCost(distance, level = getHyperChargeLevel()) {
    const maxRange = getHyperRange(getHyperChargePercent(level));
    const maxCost = getHyperChargeCost(level);
    if (maxRange <= 0) return maxCost;
    const ratio = clamp(distance / maxRange, 0.1, 1);
    const cost = Math.ceil(maxCost * ratio);
    return Math.max(Math.ceil(maxCost * 0.1), cost);
  }

  function getHyperBaseRange() {
    const boostSpeed = cachedStats.maxSpeed * 1.5 * (ZONE_TYPES.expanse?.boostMult || 1.6);
    const rangeMult = cachedStats.hyperRangeMult || 1;
    const boostRange = boostSpeed * 60 * HYPER.maxJumpMinutes;
    const worldSpan = WORLD.size * 1.05;
    return Math.max(boostRange, worldSpan) * rangeMult;
  }

  function getHyperRange(chargePercent = getHyperChargePercent()) {
    return getHyperBaseRange() * chargePercent;
  }

  function buildHyperTarget(id, label, x, y, radius = 0, type = 'cluster') {
    const dx = x - player.x;
    const dy = y - player.y;
    const distance = Math.hypot(dx, dy);
    return {
      id,
      label,
      x,
      y,
      radius,
      distance,
      angle: Math.atan2(dy, dx),
      type
    };
  }

  function getHyperTargets(maxRange = getHyperRange()) {
    const radarRange = maxRange * HYPER.radarRangeMult;
    const targets = [];

    (world.clusterFields || []).forEach((cluster, index) => {
      targets.push(buildHyperTarget(`cluster-${index}`, `Cluster Field ${index + 1}`, cluster.x, cluster.y, cluster.radius, 'cluster'));
    });

    Object.entries(world.biomeStations || {}).forEach(([biomeId, entry]) => {
      const sector = getSector(entry.gx, entry.gy);
      const station = sector.objects.stations.find((s) => s.hub) || sector.objects.stations[0];
      const pos = station || { x: entry.gx * WORLD.sectorSize, y: entry.gy * WORLD.sectorSize, radius: 40 };
      targets.push(buildHyperTarget(`hub-${biomeId}`, `${BIOMES[biomeId]?.name || biomeId} Hub`, pos.x, pos.y, pos.radius || 40, 'hub'));
    });

    (world.relayStations || []).forEach((entry, idx) => {
      const sector = getSector(entry.gx, entry.gy);
      const station = sector.objects.stations.find((s) => s.type === 'relay') || sector.objects.stations[0];
      const pos = station || { x: entry.gx * WORLD.sectorSize, y: entry.gy * WORLD.sectorSize, radius: 40 };
      targets.push(buildHyperTarget(`relay-${idx}`, 'Interstice Relay', pos.x, pos.y, pos.radius || 40, 'relay'));
    });

    if (world.convergenceGate) {
      targets.push(buildHyperTarget('atlas-gate', 'Atlas Convergence', world.convergenceGate.x, world.convergenceGate.y, 60, 'gate'));
    }

    if (world.homeBase) {
      targets.push(buildHyperTarget('home', 'Bastion City', world.homeBase.x, world.homeBase.y, world.homeBase.radius || 60, 'home'));
    }

    if (world.cities && world.cities.length) {
      world.cities.forEach((city) => {
        if (city.type === 'capital') return;
        targets.push(buildHyperTarget(city.id, city.label, city.x, city.y, city.radius || 60, 'city'));
      });
    }

    return targets
      .filter((target) => target.distance > HYPER.minDistance && target.distance <= radarRange)
      .sort((a, b) => a.distance - b.distance);
  }

  function getNearestHubTarget() {
    let best = null;
    const consider = (label, x, y, type) => {
      if (x == null || y == null) return;
      const distance = Math.hypot(x - player.x, y - player.y);
      if (!best || distance < best.distance) {
        best = { label, x, y, distance, type };
      }
    };

    if (world.homeBase) {
      consider('Bastion City', world.homeBase.x, world.homeBase.y, 'home');
    }
    if (world.cities && world.cities.length) {
      world.cities.forEach((city) => {
        if (!city) return;
        consider(city.label || city.name || 'City', city.x, city.y, 'city');
      });
    }
    Object.entries(world.biomeStations || {}).forEach(([biomeId, entry]) => {
      const sector = getSector(entry.gx, entry.gy);
      const station = sector.objects.stations.find((s) => s.hub) || sector.objects.stations[0];
      const pos = station || posFromGrid(entry.gx, entry.gy);
      const label = `${BIOMES[biomeId]?.name || biomeId} Hub`;
      consider(label, pos.x, pos.y, 'hub');
    });
    return best;
  }

  function getRouteDensityForSector(gx, gy) {
    const profile = getSectorProfile(gx, gy);
    const isExpanse = profile.zoneType === 'expanse';
    const base = profile.isVoid
      ? TRADE_ROUTE_CONFIG.voidChance
      : profile.zoneType === 'lane'
        ? TRADE_ROUTE_CONFIG.laneChance
        : isExpanse
          ? TRADE_ROUTE_CONFIG.expanseChance
          : TRADE_ROUTE_CONFIG.clusterChance;
    let density = base * (0.6 + profile.density * 0.8);
    density *= 1 - profile.openSpace * 0.3;
    if (profile.zoneType === 'cluster') density *= 0.85;
    return clamp(density, 0, 1);
  }

  function getSelectedHyperTarget(targets) {
    if (!targets.length) return null;
    const index = clamp(state.hyperNav?.targetIndex || 0, 0, targets.length - 1);
    state.hyperNav.targetIndex = index;
    return targets[index];
  }

  function openHyperMap() {
    if (state.mode !== 'flight') return;
    state.mode = 'hyper';
    state.paused = true;
    const targets = getHyperTargets();
    state.hyperNav.targetIndex = clamp(state.hyperNav.targetIndex || 0, 0, Math.max(0, targets.length - 1));
  }

  function closeHyperMap() {
    if (state.mode !== 'hyper') return;
    state.mode = 'flight';
    state.paused = false;
  }

  function completeHyperJump(pending) {
    if (!pending) return;
    const { target, cost } = pending;
    player.hyperCharge = Math.max(0, player.hyperCharge - cost);
    state.hyperDrive.cooldown = HYPER.cooldown;
    const offset = (target.radius || 60) * 0.35;
    const angle = Math.random() * Math.PI * 2;
    player.x = target.x + Math.cos(angle) * offset;
    player.y = target.y + Math.sin(angle) * offset;
    player.vx = 0;
    player.vy = 0;
    addCameraShake(1.4, 0.3);
    spawnEffect(player.x, player.y, 'rgba(154,214,255,0.9)', 80);
    noteStatus(`Hyper jump complete (${target.label}).`);
  }

  function executeHyperJump(target) {
    if (state.hyperJumpFx?.pending) {
      noteStatus('Hyper drive charging.');
      return false;
    }
    if (!target) {
      noteStatus('Select a hyper target.');
      return false;
    }
    if (state.hyperDrive.cooldown > 0) {
      noteStatus('Hyper drive cooling.');
      return false;
    }
    const chargeLevel = getHyperChargeLevel();
    const maxRange = getHyperRange(getHyperChargePercent(chargeLevel));
    const cost = getHyperJumpCost(target.distance, chargeLevel);
    if (player.hyperCharge < cost) {
      noteStatus('Hyper charge depleted. Refuel at a station.');
      return false;
    }
    if (target.distance > maxRange) {
      noteStatus('Target out of range for current dial.');
      return false;
    }
    if (state.hyperJumpFx) {
      state.hyperJumpFx.pending = { target, cost };
      state.hyperJumpFx.timer = state.hyperJumpFx.duration || 1;
    }
    noteStatus('Hyper jump charging...');
    return true;
  }

  function tryReturnJump() {
    if (state.escape.active) return;
    if (player.fuel < 20) {
      noteStatus('Insufficient fuel for return jump.');
      return;
    }
    triggerEscape(getCurrentSector(), 'retreat');
  }

  function triggerEscape(sector, reason = 'retreat') {
    if (state.escape.active) return;
    state.escape.active = true;
    state.escape.timer = 1.8;
    state.escape.reason = reason;
    state.paused = true;
    state.mode = 'flight';
    noteStatus(`Return jump engaged from ${sector?.name || 'sector'}.`);
    addCameraShake(1.4, 0.4);
  }

  function updateEscape(dt) {
    if (!state.escape.active) return false;
    state.escape.timer -= dt;
    if (state.escape.timer <= 0) {
      state.escape.active = false;
      state.paused = false;
      if (world.homeBase) {
        player.x = world.homeBase.x + 120;
        player.y = world.homeBase.y;
        player.vx = 0;
        player.vy = 0;
      } else {
        initPlayerPosition();
      }
      state.shiftBoost.active = false;
      const escapeReason = state.escape.reason || 'retreat';
      state.escape.reason = '';
      if (mission.active) failMission(escapeReason);
      noteStatus('Return complete. Docked at city.');
    }
    return true;
  }

  function hasAmmo(weapon) {
    if (!weapon.ammoType) return true;
    const available = player.ammo[weapon.ammoType] || 0;
    return available >= (weapon.ammoCost || 1);
  }

  function consumeAmmo(weapon) {
    if (!weapon.ammoType) return;
    const cost = weapon.ammoCost || 1;
    player.ammo[weapon.ammoType] = clamp((player.ammo[weapon.ammoType] || 0) - cost, 0, AMMO_TYPES[weapon.ammoType]?.max || 999);
  }

  function applyRecoil(dir, strength) {
    if (!strength) return;
    const recoilForce = strength / (cachedStats.mass || 1);
    player.vx -= dir.x * recoilForce;
    player.vy -= dir.y * recoilForce;
  }

  function clampAmmo() {
    Object.keys(AMMO_TYPES).forEach((key) => {
      const max = AMMO_TYPES[key].max;
      player.ammo[key] = clamp(player.ammo[key] || 0, 0, max);
    });
  }

  function getCargoCount() {
    const cargo = player.inventory.cargo;
    return cargo.salvage + cargo.alloys + cargo.relics;
  }

  function isNoFireZone(x, y) {
    if (world.cities && world.cities.length) {
      for (let i = 0; i < world.cities.length; i += 1) {
        const city = world.cities[i];
        const padding = city.type === 'capital' ? (NO_FIRE_ZONE.homePadding || 0) : (NO_FIRE_ZONE.homePadding || 0) * 0.7;
        const radius = (city.noFireRadius || city.safeRadius || city.radius) + padding;
        if (dist(x, y, city.x, city.y) < radius) return true;
      }
    }
    const sector = getCurrentSector();
    if (sector?.objects?.stations?.length) {
      const padding = NO_FIRE_ZONE.stationPadding || 0;
      for (let i = 0; i < sector.objects.stations.length; i += 1) {
        const station = sector.objects.stations[i];
        if (dist(x, y, station.x, station.y) < station.radius + padding) return true;
      }
    }
    return false;
  }

  function updateNoFireZone(dt) {
    if (state.noFireCooldown > 0) {
      state.noFireCooldown = Math.max(0, state.noFireCooldown - dt);
    }
    if (state.scoopCooldown > 0) {
      state.scoopCooldown = Math.max(0, state.scoopCooldown - dt);
    }
    if (state.beaconHintCooldown > 0) {
      state.beaconHintCooldown = Math.max(0, state.beaconHintCooldown - dt);
    }
    if (state.mode !== 'flight') return;
    const inZone = isNoFireZone(player.x, player.y);
    if (inZone !== state.inNoFireZone) {
      state.inNoFireZone = inZone;
      noteStatus(inZone ? 'No-fire zone engaged. Weapons locked.' : 'Exiting no-fire zone. Weapons live.');
    }
  }

  function blockWeaponsForNoFire() {
    if (!state.inNoFireZone) return false;
    if (state.noFireCooldown <= 0) {
      noteStatus('Weapons locked in no-fire zone.');
      state.noFireCooldown = NO_FIRE_ZONE.warningCooldown;
    }
    return true;
  }

  function getPendingDiscoveryCount() {
    if (!world.discovered) return 0;
    const uploads = player.discoveryUploads || new Set();
    let pending = 0;
    world.discovered.forEach((key) => {
      if (!uploads.has(key)) pending += 1;
    });
    return pending;
  }

  function uploadDiscoveries() {
    const station = state.activeStation;
    if (!station?.services?.includes('Navigation Sync')) {
      noteStatus('Navigation sync unavailable.');
      return;
    }
    const uploads = player.discoveryUploads || new Set();
    const pending = [];
    world.discovered.forEach((key) => {
      if (!uploads.has(key)) pending.push(key);
    });
    if (!pending.length) {
      noteStatus('No new discoveries to upload.');
      advanceCivicTutorial('upload');
      return;
    }
    pending.forEach((key) => uploads.add(key));
    player.discoveryUploads = uploads;
    const reward = pending.length * DISCOVERY_UPLOAD.rewardPerSector;
    awardCredits(reward, 'Discovery upload');
    pushStoryLog(`Uploaded ${pending.length} discovery logs.`);
    saveLocal();
    advanceCivicTutorial('upload');
  }

  function openCodex(returnMode = 'flight') {
    state.codexReturn = returnMode;
    state.codexSeen = true;
    state.codexScroll = clamp(state.codexScroll || 0, 0, Math.max(0, CODEX_ENTRIES.length - 1));
    state.mode = 'codex';
    state.paused = true;
  }

  function closeCodex() {
    const returnMode = state.codexReturn || 'flight';
    state.mode = returnMode;
    state.paused = returnMode !== 'flight';
  }

  function beginCivicTutorial(label) {
    if (state.civicTutorialDone || state.civicTutorial?.active) return;
    state.civicTutorial = { active: true, step: 0, label: label || 'Civic Hub' };
    noteStatus('Civic orientation started.');
  }

  function advanceCivicTutorial(action) {
    if (!state.civicTutorial?.active) return;
    if (state.civicTutorial.step === 0 && action === 'repair') {
      state.civicTutorial.step = 1;
      noteStatus('Civic: refuel complete. Upload discoveries next.');
      return;
    }
    if (state.civicTutorial.step === 1 && action === 'upload') {
      state.civicTutorial.step = 2;
      noteStatus('Civic: discovery upload logged. Undock to continue.');
      return;
    }
    if (state.civicTutorial.step === 2 && action === 'undock') {
      state.civicTutorial.active = false;
      state.civicTutorialDone = true;
      awardCredits(CIVIC_TUTORIAL.reward, 'Civic orientation');
      pushStoryLog('Civic orientation complete.');
      noteStatus('Civic orientation complete.');
    }
  }

  function unlockLoreEntry(source = 'data shard') {
    const locked = LORE_ENTRIES.filter((entry) => !player.lore.has(entry.id));
    if (!locked.length) return;
    const entry = locked[Math.floor(Math.random() * locked.length)];
    player.lore.add(entry.id);
    pushStoryLog(`Archive unlocked: ${entry.title}`);
    noteStatus(`New archive: ${entry.title}`);
  }

  function updatePlayer(dt) {
    if (state.mode !== 'flight') return;
    const turningLeft = input.keys['KeyA'] || input.keys['ArrowLeft'];
    const turningRight = input.keys['KeyD'] || input.keys['ArrowRight'];
    const thrusting = input.keys['KeyW'] || input.keys['ArrowUp'];
    const reversing = input.keys['KeyS'] || input.keys['ArrowDown'];
    const sector = getCurrentSector();
    const zoneBoost = sector.zone?.boostMult || 1;
    const fuelDrainBase = sector.zoneType === 'rift'
      ? 2.2
      : sector.zoneType === 'expanse'
        ? 1.8
        : sector.zoneType === 'lane'
          ? 2.6
          : 3.0;
    const fuelDrainMult = sector.zoneType === 'expanse'
      ? 2.2
      : sector.zoneType === 'lane'
        ? 2.6
        : sector.zoneType === 'rift'
          ? 2.4
          : 3.0;
    const fuelDrain = fuelDrainBase * fuelDrainMult;
    const fuelEfficiency = cachedStats.fuelEfficiency || 1;

    if (state.hyperDrive.cooldown > 0) {
      state.hyperDrive.cooldown = Math.max(0, state.hyperDrive.cooldown - dt);
    }

    if (turningLeft) player.angularVelocity -= cachedStats.torque * dt * 60;
    if (turningRight) player.angularVelocity += cachedStats.torque * dt * 60;
    player.angularVelocity = clamp(player.angularVelocity, -cachedStats.maxAngular, cachedStats.maxAngular);
    player.angularVelocity *= Math.pow(cachedStats.angularDamp, dt * 60);
    player.angle += player.angularVelocity * dt;

    const dir = { x: Math.cos(player.angle), y: Math.sin(player.angle) };
    const lateral = { x: -dir.y, y: dir.x };

    if (thrusting) {
      player.vx += dir.x * cachedStats.thrust * dt;
      player.vy += dir.y * cachedStats.thrust * dt;
      spawnParticle(player.x - dir.x * 18, player.y - dir.y * 18, 'rgba(125,252,154,0.6)', 0.4, 3, -dir.x * 40, -dir.y * 40);
    }
    if (reversing) {
      player.vx -= dir.x * cachedStats.reverseThrust * dt;
      player.vy -= dir.y * cachedStats.reverseThrust * dt;
    }

    applyGravityToEntity(player, sector, dt);

    const boostHeld = input.keys['KeyB'] || input.keys['ShiftLeft'] || input.keys['ShiftRight'];
    state.shiftBoost.active = boostHeld && player.fuel > 12;

    if (state.shiftBoost.active) {
      const boostThrust = cachedStats.thrust * 1.8 * zoneBoost;
      player.vx += dir.x * boostThrust * dt;
      player.vy += dir.y * boostThrust * dt;
      player.boost = clamp(player.boost + cachedStats.boostRegen * dt, 0, cachedStats.boostMax);
      player.fuel = clamp(player.fuel - fuelDrain * dt * fuelEfficiency, 0, cachedStats.fuelMax);
      missionTracker.noBoost = false;
      const boostColor = sector.zoneType === 'rift' ? '#ffd166' : sector.zoneType === 'expanse' ? '#9ad6ff' : '#7dfc9a';
      spawnEffect(player.x - dir.x * 18, player.y - dir.y * 18, boostColor);
      const boostAlpha = sector.zoneType === 'rift' ? 0.9 : sector.zoneType === 'expanse' ? 0.85 : 0.8;
      const trailColor = sector.zoneType === 'rift'
        ? `rgba(255,209,102,${boostAlpha})`
        : sector.zoneType === 'expanse'
          ? `rgba(154,214,255,${boostAlpha})`
          : `rgba(125,252,154,${boostAlpha})`;
      spawnParticle(player.x - dir.x * 20, player.y - dir.y * 20, trailColor, 0.5, 4, -dir.x * 80, -dir.y * 80);
      if (player.fuel <= 0) {
        state.shiftBoost.active = false;
      }
    } else {
      player.boost = clamp(player.boost + cachedStats.boostRegen * dt, 0, cachedStats.boostMax);
    }

    if (player.flightAssist) {
      const lateralSpeed = player.vx * lateral.x + player.vy * lateral.y;
      const assistForce = (1 - cachedStats.assistDamp) * dt * 60;
      player.vx -= lateral.x * lateralSpeed * assistForce;
      player.vy -= lateral.y * lateralSpeed * assistForce;
    }

    const localDamp = sector.zoneType === 'expanse'
      ? Math.min(0.998, cachedStats.linearDamp + 0.015)
      : cachedStats.linearDamp;
    player.vx *= Math.pow(localDamp, dt * 60);
    player.vy *= Math.pow(localDamp, dt * 60);

    const speed = Math.hypot(player.vx, player.vy);
    const maxSpeed = cachedStats.maxSpeed * zoneBoost * (state.shiftBoost.active ? 1.5 : 1);
    if (speed > maxSpeed) {
      const scale = maxSpeed / (speed || 1);
      player.vx *= scale;
      player.vy *= scale;
    }

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    const radial = Math.hypot(player.x, player.y);
    const hardBoundary = WORLD.boundary;
    const softBoundary = hardBoundary - WORLD.sectorSize * 0.6;
    if (radial > softBoundary) {
      const t = clamp((radial - softBoundary) / Math.max(1, hardBoundary - softBoundary), 0, 1);
      const damp = lerp(1, 0.9, t);
      player.vx *= damp;
      player.vy *= damp;
      if (state.boundaryWarning <= 0) {
        noteStatus('Outer limit reached. Use J to return.');
        state.boundaryWarning = 3;
      }
    }
    if (radial > hardBoundary) {
      if (!state.escape.active) {
        triggerEscape(sector, 'outer-limit');
      }
      const dirBack = normalize(player.x, player.y);
      player.x = dirBack.x * hardBoundary;
      player.y = dirBack.y * hardBoundary;
      player.vx *= 0.2;
      player.vy *= 0.2;
      state.boundaryTimer = 0;
    } else {
      state.boundaryTimer = 0;
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
    if (sector.isCivic) {
      sector.spawnTimer = 3;
      return;
    }
    const biome = BIOMES[sector.biome];
    const zone = sector.zone || ZONE_TYPES.cluster;
    const isExpanse = sector.zoneType === 'expanse';
    const factionId = sector.faction?.id || '';
    const alliedSector = isAlliedFaction(factionId);
    sector.spawnTimer -= dt;
    if (sector.spawnTimer > 0) return;
    if (state.spawnGrace > 0) {
      sector.spawnTimer = 2;
      return;
    }
    const homeBase = world.homeBase;
    if (homeBase && dist(player.x, player.y, homeBase.x, homeBase.y) < (homeBase.safeRadius || 700)) {
      sector.spawnTimer = 3;
      return;
    }

    const density = sector.clusterDensity ?? 0;
    const openSpace = sector.openSpace || 0;
    let spawnScale = zone.spawnScale * (sector.isVoid ? 0.05 : isExpanse ? 0.25 + density * 0.2 : 0.4 + density * 0.6);
    spawnScale *= 1 - openSpace * 0.5;
    if (sector.depth <= 1) spawnScale *= 0.35;
    const maxEnemies = Math.floor((2 + player.level * 0.9 + sector.depth * 0.4) * spawnScale);
    if (entities.enemies.length >= maxEnemies) {
      sector.spawnTimer = 2;
      return;
    }

    const encounters = sector.encounters || [];
    encounters.forEach((enc) => {
      if (enc.cooldown > 0) enc.cooldown = Math.max(0, enc.cooldown - dt);
    });
    let active = null;
    let bestDist = Infinity;
    encounters.forEach((enc) => {
      if (enc.cleared) return;
      const d = dist(player.x, player.y, enc.x, enc.y);
      if (d < enc.sight && d < bestDist) {
        active = enc;
        bestDist = d;
      }
    });

    if (!active) {
      sector.spawnTimer = 3.5 + Math.random() * 3.5;
      return;
    }
    if (active.cooldown > 0) {
      sector.spawnTimer = 1.5;
      return;
    }
    if (alliedSector && active.type !== 'raid') {
      active.cleared = true;
      sector.spawnTimer = 4.5;
      return;
    }

    const rng = mulberry32(WORLD_SEED + sector.gx * 77 + sector.gy * 91 + Math.floor(state.time * 3));
    const baseChoices = BIOME_SPAWNS[sector.biome] || ['scout', 'fighter'];
    const threatScale = (biome.threat + player.level * 0.05) * (active.strength || 1);

    const spawnGroup = (type, x, y) => {
      const captureBias = type === 'transport' || type === 'carrier' ? 0.3 : 0;
      return spawnEnemy(type, x, y, threatScale, { captureBias, faction: factionId });
    };

    if (active.type === 'convoy') {
      const convoyType = sector.depth >= 8 && rng() < 0.35 ? 'carrier' : 'transport';
      spawnGroup(convoyType, active.x, active.y);
      const escorts = convoyType === 'carrier' ? 3 : 2;
      for (let e = 0; e < escorts; e += 1) {
        const angle = rng() * Math.PI * 2;
        const radius = randRange(rng, 120, 220);
        const escortType = rng() < 0.55 ? 'fighter' : 'interceptor';
        spawnGroup(escortType, active.x + Math.cos(angle) * radius, active.y + Math.sin(angle) * radius);
      }
    } else if (active.type === 'raid') {
      const raidFaction = sector.faction?.id && sector.faction.id !== 'aetherline' ? sector.faction.id : 'redshift_cartel';
      const convoyId = contract.type === 'escort' && contract.convoyId ? contract.convoyId : '';
      const raidCount = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < raidCount; i += 1) {
        const angle = rng() * Math.PI * 2;
        const radius = randRange(rng, 140, 260);
        const type = rng() < 0.4 ? 'interceptor' : rng() < 0.75 ? 'fighter' : 'gunship';
        spawnEnemy(
          type,
          active.x + Math.cos(angle) * radius,
          active.y + Math.sin(angle) * radius,
          threatScale,
          { raid: true, raidConvoyId: convoyId, faction: raidFaction }
        );
      }
    } else if (active.type === 'ambush') {
      const count = 3 + Math.floor(rng() * 2);
      for (let i = 0; i < count; i += 1) {
        const angle = rng() * Math.PI * 2;
        const radius = randRange(rng, 160, 260);
        const type = rng() < 0.6 ? 'interceptor' : 'fighter';
        spawnGroup(type, player.x + Math.cos(angle) * radius, player.y + Math.sin(angle) * radius);
      }
    } else if (active.type === 'guard') {
      const guardCount = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < guardCount; i += 1) {
        const angle = rng() * Math.PI * 2;
        const radius = randRange(rng, 140, 240);
        const type = rng() < 0.5 ? 'fighter' : 'gunship';
        spawnGroup(type, active.x + Math.cos(angle) * radius, active.y + Math.sin(angle) * radius);
      }
      if (sector.depth >= 6 && rng() < 0.4) spawnGroup('turret', active.x + randRange(rng, -120, 120), active.y + randRange(rng, -120, 120));
    } else {
      const count = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < count; i += 1) {
        const angle = rng() * Math.PI * 2;
        const radius = randRange(rng, 140, 240);
        const type = baseChoices[Math.floor(rng() * baseChoices.length)];
        spawnGroup(type, active.x + Math.cos(angle) * radius, active.y + Math.sin(angle) * radius);
      }
    }

    active.waves -= 1;
    active.cooldown = randRange(rng, 6, 9);
    if (active.waves <= 0) active.cleared = true;
    sector.spawnTimer = randRange(rng, 2.8, 5.2);
  }

  function updateEnemyAI(enemy, dt, sector) {
    const playerDx = player.x - enemy.x;
    const playerDy = player.y - enemy.y;
    const playerDist = Math.hypot(playerDx, playerDy);
    let target = player;
    let targetIsPlayer = true;
    let dx = playerDx;
    let dy = playerDy;
    let distance = playerDist;
    if (enemy.raid) {
      const civTarget = findClosestCivilian(enemy.x, enemy.y, 900, sector, enemy.raidConvoyId);
      if (civTarget) {
        target = civTarget;
        targetIsPlayer = false;
        dx = civTarget.x - enemy.x;
        dy = civTarget.y - enemy.y;
        distance = Math.hypot(dx, dy);
      }
    }
    const friendly = findClosestFriendly(enemy.x, enemy.y, 720, sector);
    if (friendly) {
      const friendlyDist = dist(enemy.x, enemy.y, friendly.x, friendly.y);
      const preferFriendly = (playerDist > 800 && friendlyDist < playerDist * 0.9)
        || (friendlyDist < 420 && playerDist > 520)
        || (Math.random() < 0.08 && friendlyDist < 520);
      if (preferFriendly && !enemy.raid) {
        target = friendly;
        targetIsPlayer = false;
        dx = friendly.x - enemy.x;
        dy = friendly.y - enemy.y;
        distance = friendlyDist;
      }
    }
    const isStatic = enemy.def?.static;
    if (world.cities && world.cities.length) {
      for (let i = 0; i < world.cities.length; i += 1) {
        const city = world.cities[i];
        if (dist(enemy.x, enemy.y, city.x, city.y) < (city.noFireRadius || city.safeRadius || city.radius)) {
          enemy.state = 'retreat';
          break;
        }
      }
    }

    if (enemy.stunned) {
      enemy.stunned = Math.max(0, enemy.stunned - dt);
      enemy.vx *= 0.96;
      enemy.vy *= 0.96;
      return;
    }

    if (enemy.role === 'transport' && enemy.hp < enemy.maxHp * 0.25) {
      enemy.disabled = true;
      enemy.state = 'disabled';
    }
    if (enemy.disabled) {
      enemy.vx *= 0.92;
      enemy.vy *= 0.92;
      enemy.fireCooldown = Math.max(enemy.fireCooldown, 1);
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
          enemy.vx += -dir.y * speed * 0.85 * dt;
          enemy.vy += dir.x * speed * 0.85 * dt;
        }
      } else if (enemy.role === 'interceptor') {
        const dir = normalize(dx, dy);
        if (distance > 180) {
          enemy.vx += dir.x * speed * 1.45 * dt;
          enemy.vy += dir.y * speed * 1.45 * dt;
        } else {
          enemy.vx += -dir.y * speed * 1.25 * dt;
          enemy.vy += dir.x * speed * 1.25 * dt;
        }
      } else if (enemy.role === 'gunship') {
        const dir = normalize(dx, dy);
        if (distance < 260) {
          enemy.vx -= dir.x * speed * 1.1 * dt;
          enemy.vy -= dir.y * speed * 1.1 * dt;
        } else if (distance > 420) {
          enemy.vx += dir.x * speed * 0.9 * dt;
          enemy.vy += dir.y * speed * 0.9 * dt;
        } else {
          enemy.vx += -dir.y * speed * 0.6 * dt;
          enemy.vy += dir.x * speed * 0.6 * dt;
        }
      } else if (enemy.role === 'bomber') {
        const dir = normalize(dx, dy);
        if (distance < 300) {
          enemy.vx -= dir.x * speed * 1.05 * dt;
          enemy.vy -= dir.y * speed * 1.05 * dt;
        } else if (distance > 440) {
          enemy.vx += dir.x * speed * dt;
          enemy.vy += dir.y * speed * dt;
        }
      } else if (enemy.role === 'sniper') {
        const dir = normalize(dx, dy);
        if (distance < 420) {
          enemy.vx -= dir.x * speed * dt;
          enemy.vy -= dir.y * speed * dt;
        } else if (distance > 560) {
          enemy.vx += dir.x * speed * 0.8 * dt;
          enemy.vy += dir.y * speed * 0.8 * dt;
        } else {
          enemy.vx += -dir.y * speed * 0.3 * dt;
          enemy.vy += dir.x * speed * 0.3 * dt;
        }
      } else if (enemy.role === 'carrier' || enemy.role === 'transport') {
        const dir = normalize(dx, dy);
        if (distance < 360) {
          enemy.vx -= dir.x * speed * 0.7 * dt;
          enemy.vy -= dir.y * speed * 0.7 * dt;
        } else if (distance > 560) {
          enemy.vx += dir.x * speed * 0.55 * dt;
          enemy.vy += dir.y * speed * 0.55 * dt;
        } else {
          enemy.vx += -dir.y * speed * 0.22 * dt;
          enemy.vy += dir.x * speed * 0.22 * dt;
        }
      } else {
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

    const avoid = computeAvoidance(enemy, sector);
    enemy.vx += avoid.x * speed * 0.4 * dt;
    enemy.vy += avoid.y * speed * 0.4 * dt;

    if (!isStatic && Math.hypot(enemy.vx, enemy.vy) > 8) {
      enemy.angle = Math.atan2(enemy.vy, enemy.vx);
    }

    if (enemy.isBoss && enemy.phase >= 2 && Math.random() < 0.012) {
      const angle = Math.random() * Math.PI * 2;
      spawnEnemy('fighter', enemy.x + Math.cos(angle) * 60, enemy.y + Math.sin(angle) * 60, 1 + enemy.phase * 0.2, {
        faction: enemy.faction || sector?.faction?.id || ''
      });
    }

    if ((enemy.role === 'carrier' || enemy.role === 'transport') && enemy.hangar > 0) {
      enemy.spawnCooldown -= dt;
      if (enemy.spawnCooldown <= 0) {
        const choice = enemy.role === 'carrier' ? (Math.random() < 0.5 ? 'fighter' : 'interceptor') : 'scout';
        const angle = Math.random() * Math.PI * 2;
        const radius = enemy.size + 30;
        spawnEnemy(choice, enemy.x + Math.cos(angle) * radius, enemy.y + Math.sin(angle) * radius, 1 + enemy.threat * 0.2, {
          faction: enemy.faction || sector?.faction?.id || ''
        });
        enemy.hangar -= 1;
        enemy.spawnCooldown = 2.8 + Math.random() * 1.6;
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

    enemy.fireCooldown -= dt;
    if (enemy.state === 'attack' && enemy.fireCooldown <= 0) {
      if (isNoFireZone(enemy.x, enemy.y)) {
        enemy.fireCooldown = 0.6 + Math.random() * 0.4;
        return;
      }
      enemy.fireCooldown = enemy.isBoss ? 0.5 : enemy.def.fireRate;
      const dir = normalize(target.x - enemy.x, target.y - enemy.y);
      let weapon = { damage: enemy.def.damage, speed: 360, color: enemy.isBoss ? '#ffb347' : '#ff6b6b' };
      if (enemy.role === 'bomber') weapon = { damage: enemy.def.damage * 1.4, speed: 300, color: '#ff6b6b', splash: 18 };
      if (enemy.role === 'gunship') weapon = { damage: enemy.def.damage * 1.2, speed: 340, color: '#ff9f6b', spread: 0.25, projectiles: 3 };
      if (enemy.role === 'transport') weapon = { damage: enemy.def.damage, speed: 260, color: '#ffd166', spread: 0.45, projectiles: 4 };
      if (enemy.role === 'carrier') weapon = { damage: enemy.def.damage * 1.1, speed: 280, color: '#ffb347', splash: 20 };
      const captureMode = targetIsPlayer && (enemy.role === 'carrier' || enemy.role === 'transport') && (state.captureWindow > 0 || enemy.captureBias > 0);
      if (captureMode && Math.random() < (0.25 + enemy.captureBias * 0.45)) {
        weapon = {
          damage: Math.max(6, enemy.def.damage * 0.45),
          speed: 240,
          color: '#9ad6ff',
          spread: 0.35,
          projectiles: 2,
          emp: 0.3,
          capture: true
        };
      }
      const count = weapon.projectiles || 1;
      for (let i = 0; i < count; i += 1) {
        const spread = weapon.spread ? (Math.random() - 0.5) * weapon.spread : 0;
        const angle = Math.atan2(dir.y, dir.x) + spread;
        const shotDir = { x: Math.cos(angle), y: Math.sin(angle) };
        spawnProjectile(
          {
            id: 'enemy',
            damage: weapon.damage,
            speed: weapon.speed,
            color: weapon.color,
            cooldown: 0,
            energy: 0,
            splash: weapon.splash || 0,
            emp: weapon.emp || 0,
            capture: weapon.capture || false,
            faction: enemy.faction || sector?.faction?.id || ''
          },
          enemy.x + shotDir.x * enemy.size,
          enemy.y + shotDir.y * enemy.size,
          shotDir,
          false
        );
      }
    }
  }

  function updateEnemies(dt) {
    const sector = getCurrentSector();
    spawnWave(sector, dt);

    entities.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      applyGravityToEntity(enemy, sector, dt);
      updateEnemyAI(enemy, dt, sector);
    });
  }

  function handleTransportCapture() {
    const sector = getCurrentSector();
    if (!sector) return;
    let target = null;
    for (let i = 0; i < entities.enemies.length; i += 1) {
      const enemy = entities.enemies[i];
      if (!enemy || enemy.hp <= 0) continue;
      if (enemy.role !== 'transport' || !enemy.disabled) continue;
      if (dist(player.x, player.y, enemy.x, enemy.y) < enemy.size + 40) {
        target = enemy;
        break;
      }
    }
    if (!target) return;
    noteStatus('Press E to seize transport cargo.');
    if (!input.justPressed['KeyE']) return;
    const cargoRoll = 2 + Math.floor(Math.random() * 3);
    if (getCargoCount() + cargoRoll <= cachedStats.cargoMax) {
      player.inventory.cargo.salvage += cargoRoll;
      if (Math.random() < 0.4) player.inventory.cargo.alloys += 1;
      if (Math.random() < 0.2) player.inventory.cargo.relics += 1;
      awardCredits(140 + cargoRoll * 30, 'Cargo seized');
    } else {
      awardCredits(120, 'Cargo seized');
      noteStatus('Cargo bay full. Converted to credits.');
    }
    if (target.faction) adjustFactionRep(target.faction, -4, 'Transport seized');
    spawnExplosion(target.x, target.y, target.color || '#ffd166');
    target.hp = 0;
  }

  function updateBases(dt) {
    const sector = getCurrentSector();
    if (!sector.objects.bases.length) return;
    sector.objects.bases.forEach((base) => {
      if (base.hp <= 0) return;
      const baseFaction = base.faction || sector.faction?.id || '';
      if (isAlliedFaction(baseFaction)) {
        base.spawnTimer = Math.max(base.spawnTimer, 2.5);
        return;
      }
      base.spawnTimer -= dt;
      if (base.spawnTimer <= 0) {
        const spawnList = base.def.spawn || ['scout'];
        const spawnType = spawnList[Math.floor(Math.random() * spawnList.length)];
        const angle = Math.random() * Math.PI * 2;
        const radius = base.radius + 40;
        spawnEnemy(spawnType, base.x + Math.cos(angle) * radius, base.y + Math.sin(angle) * radius, 1 + sector.depth * 0.08, {
          faction: sector.faction?.id || ''
        });
        base.spawnTimer = 3.5 - Math.min(1.8, sector.depth * 0.12);
      }

      base.turrets.forEach((turret) => {
        turret.cooldown -= dt;
        if (turret.cooldown > 0) return;
        const toPlayer = dist(base.x, base.y, player.x, player.y);
        if (toPlayer > 620) return;
        turret.cooldown = 1 + Math.random() * 0.6;
        const dir = normalize(player.x - base.x, player.y - base.y);
        spawnProjectile(
          { id: 'base', damage: 14 + sector.depth * 2, speed: 380, color: base.def.color, cooldown: 0, energy: 0, splash: 12 },
          base.x + dir.x * (base.radius * 0.6),
          base.y + dir.y * (base.radius * 0.6),
          dir,
          false
        );
      });
    });
  }

  function updateHomeDefense(dt) {
    if (!world.cities || world.cities.length === 0) return;
    const sector = getCurrentSector();
    world.cities.forEach((base) => {
      const grid = gridFromPos(base.x, base.y);
      if (grid.gx !== sector.gx || grid.gy !== sector.gy) return;
      base.shield = clamp(base.shield + dt * 8, 0, base.maxShield);
      if (!base.turrets) return;
      base.turrets.forEach((turret) => {
        turret.cooldown -= dt;
        if (turret.cooldown > 0) return;
        const target = findClosestEnemy(base.x, base.y, base.defenseRange || 900);
        if (!target) return;
        turret.cooldown = 0.7 + Math.random() * 0.5;
        const dir = normalize(target.x - base.x, target.y - base.y);
        spawnProjectile(
          { id: 'city', damage: 16 + player.level * 1.2, speed: 460, color: base.color, cooldown: 0, energy: 0, splash: 10 },
          base.x + dir.x * (base.radius * 0.65),
          base.y + dir.y * (base.radius * 0.65),
          dir,
          true
        );
      });
    });
  }

  function updateTraders(dt) {
    const sector = getCurrentSector();
    if (!sector.objects.traders.length) return;
    sector.objects.traders.forEach((trader) => {
      trader.x += trader.driftX * dt;
      trader.y += trader.driftY * dt;
      trader.driftX *= 0.98;
      trader.driftY *= 0.98;
      trader.phase += dt * 0.8;
    });
  }

  function advanceRouteEntity(entity, route, dt) {
    if (!route) return false;
    const length = route.length || Math.hypot(route.x2 - route.x1, route.y2 - route.y1) || 1;
    const dir = entity.routeDir || 1;
    const speed = entity.speed || 60;
    let t = (entity.routeT ?? 0) + (dir * speed * dt) / length;
    if (t > 1) t -= 1;
    if (t < 0) t += 1;
    entity.routeT = t;
    const baseX = route.x1 + (route.x2 - route.x1) * t;
    const baseY = route.y1 + (route.y2 - route.y1) * t;
    const offset = entity.routeOffset || 0;
    const sway = Math.sin((entity.sway || 0) + state.time * 0.7) * 6;
    entity.sway = (entity.sway || 0) + dt * 0.5;
    entity.x = baseX + (route.nx || 0) * (offset + sway);
    entity.y = baseY + (route.ny || 0) * (offset + sway);
    entity.angle = (route.angle || 0) + (dir < 0 ? Math.PI : 0);
    return true;
  }

  function updateCivilians(dt) {
    const sector = getCurrentSector();
    if (!sector.objects.civilians?.length) return;
    const routes = sector.objects.tradeRoutes || [];
    const routeMap = routes.length ? new Map(routes.map((route) => [route.id, route])) : null;
    const center = posFromGrid(sector.gx, sector.gy);
    const boundary = WORLD.sectorSize * 0.7;
    sector.objects.civilians.forEach((ship) => {
      if (ship.hp !== undefined && ship.hp <= 0) {
        if (!ship.expired) {
          ship.expired = true;
          spawnExplosion(ship.x, ship.y, ship.color || IFF_COLORS.civilian);
          spawnEffect(ship.x, ship.y, ship.color || IFF_COLORS.civilian, 30);
        }
        return;
      }
      if (ship.routeId && routeMap) {
        const route = routeMap.get(ship.routeId);
        if (advanceRouteEntity(ship, route, dt)) return;
      }
      ship.angle += (ship.turn || 0) * dt;
      const sway = Math.sin((ship.sway || 0) + state.time * 0.8) * 6;
      ship.x += Math.cos(ship.angle) * ship.speed * dt + Math.cos(ship.angle + Math.PI / 2) * sway * dt;
      ship.y += Math.sin(ship.angle) * ship.speed * dt + Math.sin(ship.angle + Math.PI / 2) * sway * dt;
      ship.sway = (ship.sway || 0) + dt * 0.6;
      const dx = ship.x - center.x;
      const dy = ship.y - center.y;
      if (Math.hypot(dx, dy) > boundary) {
        ship.angle = Math.atan2(center.y - ship.y, center.x - ship.x) + randRange(Math.random, -0.4, 0.4);
      }
    });
    sector.objects.civilians = sector.objects.civilians.filter((ship) => !(ship.hp !== undefined && ship.hp <= 0));
  }

  function updateFriendlies(dt) {
    const sector = getCurrentSector();
    if (!sector.objects.friendlies?.length) return;
    const routes = sector.objects.tradeRoutes || [];
    const routeMap = routes.length ? new Map(routes.map((route) => [route.id, route])) : null;
    sector.objects.friendlies.forEach((ship) => {
      if (ship.shield !== undefined) {
        const maxShield = ship.maxShield ?? (ship.maxHp ? ship.maxHp * 0.45 : 60);
        ship.shield = clamp(ship.shield + dt * 6, 0, maxShield);
      }
      if (ship.routeId && routeMap) {
        const route = routeMap.get(ship.routeId);
        advanceRouteEntity(ship, route, dt);
      } else if (ship.anchor) {
        ship.orbitAngle = (ship.orbitAngle || 0) + dt * (ship.speed * 0.006);
        ship.x = ship.anchor.x + Math.cos(ship.orbitAngle) * (ship.orbitRadius || 220);
        ship.y = ship.anchor.y + Math.sin(ship.orbitAngle) * (ship.orbitRadius || 220);
        ship.angle = ship.orbitAngle + Math.PI / 2;
      } else {
        ship.angle += dt * 0.4;
        ship.x += Math.cos(ship.angle) * ship.speed * dt;
        ship.y += Math.sin(ship.angle) * ship.speed * dt;
      }

      ship.cooldown -= dt;
      if (ship.cooldown <= 0) {
        if (isNoFireZone(ship.x, ship.y)) {
          ship.cooldown = 0.5;
          return;
        }
        const target = findClosestEnemy(ship.x, ship.y, ship.range || 520);
        if (target) {
          const dir = normalize(target.x - ship.x, target.y - ship.y);
          const color = mixColor(ship.color || IFF_COLORS.friendly, '#ffffff', 0.25);
          spawnProjectile(
            { id: 'ally', damage: ship.damage || 10, speed: 520, color, cooldown: 0, energy: 0, faction: ship.faction || 'aetherline' },
            ship.x + dir.x * ship.size * 0.4,
            ship.y + dir.y * ship.size * 0.4,
            dir,
            true
          );
          ship.cooldown = ship.fireRate || 1.1;
        } else {
          ship.cooldown = 0.4;
        }
      }
    });
    sector.objects.friendlies = sector.objects.friendlies.filter((ship) => {
      if (ship.hp !== undefined && ship.hp <= 0) {
        spawnExplosion(ship.x, ship.y, ship.color || IFF_COLORS.friendly);
        spawnEffect(ship.x, ship.y, ship.color || IFF_COLORS.friendly, 40);
        return false;
      }
      return true;
    });
  }

  function updateTraffic(dt) {
    const sector = getCurrentSector();
    if (!sector || sector.isCivic) return;
    state.trafficSpawnTimer = Math.max(0, (state.trafficSpawnTimer || 0) - dt);
    if (state.trafficSpawnTimer > 0) return;
    state.trafficSpawnTimer = 5 + Math.random() * 5;

    const civCount = sector.objects.civilians?.length || 0;
    const friendlyCount = sector.objects.friendlies?.length || 0;
    const traderCount = sector.objects.traders?.length || 0;
    const isExpanse = sector.zoneType === 'expanse';
    const isLane = sector.zoneType === 'lane';
    const targetCiv = isExpanse ? 12 : isLane ? 9 : 6;
    const targetFriendly = isExpanse ? 3 : isLane ? 2 : 1;
    const targetTraders = isExpanse ? 2 : 1;

    const rng = Math.random;
    const route = ensureTrafficRoute(sector, rng, { hidden: true });

    const spawnCiv = Math.min(3, Math.max(0, targetCiv - civCount));
    for (let i = 0; i < spawnCiv; i += 1) {
      spawnCivilianShip(sector, { rng, route });
    }

    if (friendlyCount < targetFriendly) {
      const spawnCount = Math.min(2, targetFriendly - friendlyCount);
      for (let i = 0; i < spawnCount; i += 1) {
        const def = FRIENDLY_TYPES[Math.floor(rng() * FRIENDLY_TYPES.length)];
        const routeT = rng();
        const offset = randRange(rng, -route.width * 0.25, route.width * 0.25);
        const dx = route.x2 - route.x1;
        const dy = route.y2 - route.y1;
        spawnFriendly(def.id, route.x1 + dx * routeT + route.nx * offset, route.y1 + dy * routeT + route.ny * offset, {
          sector,
          angle: route.angle,
          faction: player.affiliation || 'aetherline',
          routeId: route.id,
          routeT,
          routeDir: rng() < 0.5 ? 1 : -1,
          routeOffset: offset,
          rng
        });
      }
    }

    if (traderCount < targetTraders && rng() < 0.6) {
      const traderType = TRADER_TYPES[Math.floor(rng() * TRADER_TYPES.length)];
      const dx = route.x2 - route.x1;
      const dy = route.y2 - route.y1;
      const routeT = rng();
      const offset = randRange(rng, -route.width * 0.2, route.width * 0.2);
      sector.objects.traders.push({
        id: `${sector.key}-traffic-trader-${Math.floor(rng() * 1e6)}`,
        type: traderType.id,
        label: traderType.label,
        color: traderType.color,
        vibe: traderType.vibe,
        x: route.x1 + dx * routeT + route.nx * offset,
        y: route.y1 + dy * routeT + route.ny * offset,
        radius: randRange(rng, 22, 30),
        driftX: randRange(rng, -10, 10),
        driftY: randRange(rng, -10, 10),
        phase: rng() * Math.PI * 2
      });
    }
  }

  function applyGravityToEntity(entity, sector, dt) {
    if (!sector || !sector.objects.planets.length) return;
    sector.objects.planets.forEach((planet) => {
      const dx = planet.x - entity.x;
      const dy = planet.y - entity.y;
      const distSq = dx * dx + dy * dy;
      const dist = Math.sqrt(distSq) || 1;
      const influence = PHYSICS.gravityMaxRadius + planet.radius;
      if (dist > influence) return;
      const strength = (PHYSICS.gravityConstant * (planet.mass || 1)) / (distSq + 2000);
      const falloff = 1 - clamp((dist - planet.radius) / influence, 0, 1);
      const force = strength * falloff;
      entity.vx += (dx / dist) * force * dt;
      entity.vy += (dy / dist) * force * dt;
    });
  }

  function computeAvoidance(entity, sector) {
    if (!sector) return { x: 0, y: 0 };
    const speed = Math.hypot(entity.vx, entity.vy);
    const forward = speed > 8 ? normalize(entity.vx, entity.vy) : normalize(player.x - entity.x, player.y - entity.y);
    const lookAhead = 120 + entity.size * 3 + speed * 0.4;
    const ahead = { x: entity.x + forward.x * lookAhead, y: entity.y + forward.y * lookAhead };
    let threat = null;
    let threatDist = Infinity;

    const checkObstacle = (ox, oy, radius) => {
      const d = dist(ahead.x, ahead.y, ox, oy);
      if (d < radius + entity.size + 18 && d < threatDist) {
        threatDist = d;
        threat = { x: ox, y: oy, radius };
      }
    };

    sector.objects.asteroids.forEach((asteroid) => {
      if (asteroid.ghost) return;
      checkObstacle(asteroid.x, asteroid.y, asteroid.radius);
    });
    sector.objects.bases.forEach((base) => checkObstacle(base.x, base.y, base.radius));
    sector.objects.planets.forEach((planet) => checkObstacle(planet.x, planet.y, planet.radius + 40));
    sector.objects.stars.forEach((star) => checkObstacle(star.x, star.y, star.radius * 1.2));
    sector.objects.ruins.forEach((ruin) => checkObstacle(ruin.x, ruin.y, ruin.radius));

    if (!threat) return { x: 0, y: 0 };
    const away = normalize(ahead.x - threat.x, ahead.y - threat.y);
    const strength = Math.max(0.6, 1 - threatDist / (threat.radius + entity.size + 40));
    return { x: away.x * strength, y: away.y * strength };
  }

  function updateProjectiles(dt) {
    const updateList = (list) => {
      list.forEach((shot) => {
        shot.life -= dt;
        if (shot.armed > 0) shot.armed -= dt;
        if (shot.homing && shot.target && shot.target.hp > 0) {
          const dir = normalize(shot.target.x - shot.x, shot.target.y - shot.y);
          const desiredAngle = Math.atan2(dir.y, dir.x);
          const currentAngle = Math.atan2(shot.vy, shot.vx);
          const nextAngle = lerp(currentAngle, desiredAngle, shot.turn * dt);
          const speed = Math.hypot(shot.vx, shot.vy);
          shot.vx = Math.cos(nextAngle) * speed;
          shot.vy = Math.sin(nextAngle) * speed;
        }
        if (shot.mine) {
          shot.vx *= 0.96;
          shot.vy *= 0.96;
        }
        shot.x += shot.vx * dt;
        shot.y += shot.vy * dt;
        if (shot.trail && Math.random() < 0.4) {
          spawnParticle(shot.x, shot.y, 'rgba(255,255,255,0.45)', 0.3, 2, -shot.vx * 0.05, -shot.vy * 0.05);
        }
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
          if (Math.random() < 0.6) unlockLoreEntry('data shard');
        } else if (drop.type === 'salvage') {
          if (getCargoCount() < cachedStats.cargoMax) {
            player.inventory.cargo.salvage += drop.value || 1;
            awardCredits(30, 'Salvage recovered');
            if (!state.cargoHinted) {
              noteStatus('Salvage stored. Dock at any station/city to sell or refine.');
              state.cargoHinted = true;
            }
          } else {
            noteStatus('Cargo bay full.');
          }
        } else if (drop.type === 'ammo') {
          const ammoKeys = Object.keys(AMMO_TYPES);
          const ammoType = ammoKeys[Math.floor(Math.random() * ammoKeys.length)];
          player.ammo[ammoType] = (player.ammo[ammoType] || 0) + 3;
          clampAmmo();
          noteStatus(`${AMMO_TYPES[ammoType].label} +3`);
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
    let heatRate = -HEAT.coolRate;

    sector.objects.asteroids.forEach((asteroid) => {
      if (asteroid.ghost) return;
      const d = dist(player.x, player.y, asteroid.x, asteroid.y);
      if (d < asteroid.radius + cachedStats.size) {
        const push = normalize(player.x - asteroid.x, player.y - asteroid.y);
        player.x = asteroid.x + push.x * (asteroid.radius + cachedStats.size + 2);
        player.y = asteroid.y + push.y * (asteroid.radius + cachedStats.size + 2);
        const relSpeed = player.vx * push.x + player.vy * push.y;
        if (relSpeed < 0) {
          player.vx -= (1 + PHYSICS.collisionElasticity) * relSpeed * push.x;
          player.vy -= (1 + PHYSICS.collisionElasticity) * relSpeed * push.y;
        }
        const tangent = { x: -push.y, y: push.x };
        const tangential = player.vx * tangent.x + player.vy * tangent.y;
        player.angularVelocity += tangential * 0.002;
        player.vx *= PHYSICS.collisionDamp;
        player.vy *= PHYSICS.collisionDamp;
        const impact = clamp(Math.hypot(player.vx, player.vy) * 0.08, 6, 18);
        applyDamage(player, impact);
        spawnEffect(player.x, player.y, '#ff6b6b');
        addCameraShake(0.8, 0.2);
      }
    });

    sector.objects.asteroids.forEach((asteroid) => {
      if (asteroid.ghost) return;
      entities.enemies.forEach((enemy) => {
        if (enemy.hp <= 0) return;
        const d = dist(enemy.x, enemy.y, asteroid.x, asteroid.y);
        if (d < asteroid.radius + enemy.size) {
          const push = normalize(enemy.x - asteroid.x, enemy.y - asteroid.y);
          enemy.x = asteroid.x + push.x * (asteroid.radius + enemy.size + 2);
          enemy.y = asteroid.y + push.y * (asteroid.radius + enemy.size + 2);
          enemy.vx *= -0.4;
          enemy.vy *= -0.4;
          enemy.hp -= 6;
        }
      });
    });

    sector.objects.bases.forEach((base) => {
      if (base.hp <= 0) return;
      const d = dist(player.x, player.y, base.x, base.y);
      if (d < base.radius + cachedStats.size) {
        const push = normalize(player.x - base.x, player.y - base.y);
        player.x = base.x + push.x * (base.radius + cachedStats.size + 4);
        player.y = base.y + push.y * (base.radius + cachedStats.size + 4);
        const tangent = { x: -push.y, y: push.x };
        const tangential = player.vx * tangent.x + player.vy * tangent.y;
        player.angularVelocity += tangential * 0.0025;
        const impact = clamp(Math.hypot(player.vx, player.vy) * 0.1, 10, 24);
        applyDamage(player, impact);
        addCameraShake(0.9, 0.25);
      }
    });

    sector.objects.storms.forEach((storm) => {
      if (dist(player.x, player.y, storm.x, storm.y) < storm.radius) {
        player.shield = clamp(player.shield - storm.intensity * 16 * dt, 0, cachedStats.maxShield);
        player.energy = clamp(player.energy - storm.intensity * 9 * dt, 0, cachedStats.energyMax);
      }
    });

    sector.objects.stars.forEach((star) => {
      const d = dist(player.x, player.y, star.x, star.y);
      const inner = star.radius * STAR_SCOOP.innerRatio;
      const scoopRadius = star.scoopRadius || star.radius * STAR_SCOOP.outerRatio;
      if (d < inner) {
        heatRate = Math.max(heatRate, HEAT.innerRate * (1 - d / inner));
        applyDamage(player, STAR_SCOOP.heatDamage * dt * 4);
        addCameraShake(0.6, 0.2);
        if (state.scoopCooldown <= 0) {
          noteStatus('Star heat spike. Pull back.');
          state.scoopCooldown = STAR_SCOOP.warningCooldown;
        }
      } else if (d < scoopRadius) {
        heatRate = Math.max(heatRate, HEAT.scoopRate * (1 - d / scoopRadius));
        player.fuel = clamp(player.fuel + STAR_SCOOP.fuelRate * dt, 0, cachedStats.fuelMax);
        player.hyperCharge = clamp(player.hyperCharge + STAR_SCOOP.hyperRate * dt, 0, HYPER.maxCharge);
        spawnParticle(player.x, player.y, 'rgba(255,209,102,0.45)', 0.3, 3, 0, 0);
        if (state.scoopCooldown <= 0) {
          noteStatus('Fuel scooping engaged.');
          state.scoopCooldown = STAR_SCOOP.warningCooldown;
        }
      }
    });

    if (player.heat === undefined) player.heat = 0;
    player.heat = clamp(player.heat + heatRate * dt, 0, HEAT.max);
    if (player.heat >= HEAT.warning && state.scoopCooldown <= 0) {
      noteStatus(player.heat >= HEAT.critical ? 'Heat critical. Break off immediately.' : 'Heat rising. Reduce scoop.');
      state.scoopCooldown = STAR_SCOOP.warningCooldown;
    }

    sector.objects.biomeProps.forEach((prop) => {
      const hazard = PROP_HAZARDS[prop.type];
      if (!hazard) return;
      if (dist(player.x, player.y, prop.x, prop.y) < prop.size + cachedStats.size + 10) {
        if (hazard.energyDrain) {
          player.energy = clamp(player.energy - hazard.energyDrain * dt, 0, cachedStats.energyMax);
        }
        if (hazard.shieldDrain) {
          player.shield = clamp(player.shield - hazard.shieldDrain * dt, 0, cachedStats.maxShield);
        }
        if (hazard.hullDamage) {
          applyDamage(player, hazard.hullDamage * dt * 6);
        }
        if (hazard.slow) {
          player.vx *= hazard.slow;
          player.vy *= hazard.slow;
        }
      }
    });

    sector.objects.riftBeacons.forEach((beacon) => {
      if (dist(player.x, player.y, beacon.x, beacon.y) < beacon.radius + 40) {
        player.boost = clamp(player.boost + 18 * dt, 0, cachedStats.boostMax);
        player.fuel = clamp(player.fuel + 10 * dt, 0, cachedStats.fuelMax);
        player.hyperCharge = clamp(player.hyperCharge + 24 * dt, 0, HYPER.maxCharge);
        spawnParticle(player.x, player.y, beacon.color || 'rgba(255,209,102,0.45)', 0.25, 2, 0, 0);
      }
    });

    sector.objects.surveyBeacons.forEach((beacon) => {
      if (world.beaconClaims?.[sector.key]) return;
      const d = dist(player.x, player.y, beacon.x, beacon.y);
      if (d < beacon.radius + 30) {
        if (state.scanPulse > 0 || player.blueprints.has('scanner_drone')) {
          world.beaconClaims = world.beaconClaims || {};
          world.beaconClaims[sector.key] = true;
          awardCredits(SURVEY_BEACON.reward, 'Survey beacon uplink');
          revealSectorsAround(beacon.x, beacon.y, SURVEY_BEACON.revealRadius);
          updateOptionalProgress('scan', { amount: 1 });
          noteStatus('Survey uplink complete.');
        } else if (state.beaconHintCooldown <= 0) {
          noteStatus('Survey beacon found. Pulse scan to uplink.');
          state.beaconHintCooldown = 3.2;
        }
      }
    });

    sector.objects.slipstreams.forEach((stream) => {
      const distanceToStream = dist(player.x, player.y, stream.x, stream.y);
      if (distanceToStream < stream.radius) {
        const dir = { x: Math.cos(stream.angle), y: Math.sin(stream.angle) };
        const strength = stream.strength * (1 - distanceToStream / stream.radius);
        player.vx += dir.x * strength * dt;
        player.vy += dir.y * strength * dt;
        player.boost = clamp(player.boost + 12 * dt, 0, cachedStats.boostMax);
        player.hyperCharge = clamp(player.hyperCharge + 20 * dt, 0, HYPER.maxCharge);
        spawnParticle(player.x, player.y, 'rgba(154,214,255,0.5)', 0.3, 2, 0, 0);
      }
    });

    if (sector.events && sector.events.length) {
      sector.events.forEach((event) => {
        if (event.claimed) return;
        const distanceToEvent = dist(player.x, player.y, event.x, event.y);
        if (event.type === 'distress' && distanceToEvent < event.radius + cachedStats.size) {
          event.claimed = true;
          awardCredits(event.def.reward.credits, 'Distress resolved');
          if (Math.random() < event.def.reward.loreChance) unlockLoreEntry('distress');
          event.life = 0;
        } else if (event.type === 'comet' && distanceToEvent < event.radius + cachedStats.size) {
          event.claimed = true;
          if (getCargoCount() < cachedStats.cargoMax) {
            player.inventory.cargo.salvage += event.def.reward.salvage;
            awardCredits(event.def.reward.credits, 'Comet salvage secured');
          } else {
            noteStatus('Cargo bay full.');
          }
          event.life = 0;
        } else if (event.type === 'meteor' && distanceToEvent < event.radius + cachedStats.size) {
          applyDamage(player, event.def.damage);
          event.life = 0;
        } else if ((event.type === 'driftwave' || event.type === 'riftflare') && distanceToEvent < event.radius) {
          player.boost = clamp(player.boost + (event.def.effect?.boost || 0) * dt, 0, cachedStats.boostMax);
          player.energy = clamp(player.energy + (event.def.effect?.energy || 0) * dt, 0, cachedStats.energyMax);
          player.fuel = clamp(player.fuel + (event.def.effect?.fuel || 0) * dt, 0, cachedStats.fuelMax);
          player.hyperCharge = clamp(player.hyperCharge + (event.def.effect?.hyper || 0) * dt, 0, HYPER.maxCharge);
        }
      });
    }

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
      if (shot.mine && shot.armed <= 0) {
        entities.enemies.forEach((enemy) => {
          if (enemy.hp <= 0) return;
          if (dist(shot.x, shot.y, enemy.x, enemy.y) < enemy.size + 22) {
            shot.life = 0;
            applyDamage(enemy, shot.damage, { canCrit: true });
            if (shot.splash) {
              entities.enemies.forEach((other) => {
                if (other !== enemy && dist(shot.x, shot.y, other.x, other.y) < shot.splash) {
                  applyDamage(other, shot.damage * 0.55, { canCrit: false });
                }
              });
            }
          }
        });
      }

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

      sector.objects.bases.forEach((base) => {
        if (base.hp <= 0) return;
        if (dist(shot.x, shot.y, base.x, base.y) < base.radius) {
          shot.life = 0;
          base.shield = Math.max(0, base.shield - shot.damage * 0.6);
          const damage = base.shield > 0 ? shot.damage * 0.25 : shot.damage;
          base.hp -= damage;
          spawnEffect(base.x, base.y, base.def.color, 10);
          if (base.hp <= 0) destroyBase(base, sector);
        }
      });
    });

    entities.enemyShots.forEach((shot) => {
      if (shot.life <= 0) return;
      if (dist(shot.x, shot.y, player.x, player.y) < cachedStats.size + 6) {
        shot.life = 0;
        if (shot.capture) {
          const factionId = shot.faction || sector?.faction?.id || 'redshift_cartel';
          if (!isAlliedFaction(factionId)) {
            state.capturePressure = clamp(state.capturePressure + CAPTURE_SYSTEM.hit, 0, CAPTURE_SYSTEM.maxPressure);
            if (state.capturePressure >= CAPTURE_SYSTEM.maxPressure) {
              triggerCapture(factionId, sector?.faction?.name || 'Unknown Fleet');
              return;
            }
          }
        }
        applyDamage(player, shot.damage);
        return;
      }
      if (sector.objects.friendlies?.length) {
        for (let i = 0; i < sector.objects.friendlies.length; i += 1) {
          const friendly = sector.objects.friendlies[i];
          if (!friendly || friendly.hp <= 0) continue;
          if (dist(shot.x, shot.y, friendly.x, friendly.y) < (friendly.size || 16)) {
            shot.life = 0;
            applyDamage(friendly, shot.damage);
            spawnEffect(friendly.x, friendly.y, friendly.color || IFF_COLORS.friendly, 12);
            break;
          }
        }
      }
      if (shot.life > 0 && sector.objects.civilians?.length) {
        for (let i = 0; i < sector.objects.civilians.length; i += 1) {
          const civ = sector.objects.civilians[i];
          if (!civ || (civ.hp !== undefined && civ.hp <= 0)) continue;
          if (dist(shot.x, shot.y, civ.x, civ.y) < (civ.size || 16)) {
            shot.life = 0;
            applyDamage(civ, shot.damage);
            spawnEffect(civ.x, civ.y, civ.color || IFF_COLORS.civilian, 10);
            break;
          }
        }
      }
    });

    entities.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      if (dist(enemy.x, enemy.y, player.x, player.y) < enemy.size + cachedStats.size) {
        const push = normalize(player.x - enemy.x, player.y - enemy.y);
        player.vx += push.x * 40;
        player.vy += push.y * 40;
        enemy.vx -= push.x * 30;
        enemy.vy -= push.y * 30;
        const relSpeed = Math.hypot(player.vx - enemy.vx, player.vy - enemy.vy);
        applyDamage(player, clamp(relSpeed * 0.05, 6, 20));
        enemy.hp -= 8;
      }
    });

    entities.enemies = entities.enemies.filter((enemy) => {
      if (enemy.hp <= 0) {
        handleEnemyDeath(enemy);
        return false;
      }
      return true;
    });

    sector.objects.bases = sector.objects.bases.filter((base) => base.hp > 0);

    sector.objects.wrecks.forEach((wreck) => {
      if (dist(player.x, player.y, wreck.x, wreck.y) < wreck.radius + cachedStats.size) {
        if (getCargoCount() < cachedStats.cargoMax) {
          player.inventory.cargo.salvage += wreck.salvage;
          if (Math.random() < 0.35) player.inventory.cargo.alloys += 1;
          awardCredits(60 + wreck.salvage * 20, 'Salvage recovered');
          if (!state.cargoHinted) {
            noteStatus('Cargo updated. Sell/refine at stations (menu option 8).');
            state.cargoHinted = true;
          }
        } else {
          noteStatus('Cargo bay full.');
        }
        wreck.salvage = 0;
      }
    });
    sector.objects.wrecks = sector.objects.wrecks.filter((wreck) => wreck.salvage > 0);

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

    sector.objects.ruins.forEach((ruin) => {
      if (world.ruinClaims?.[sector.key]) return;
      const distanceToRuin = dist(player.x, player.y, ruin.x, ruin.y);
      if (ruin.guarded && !ruin.discovered && distanceToRuin < ruin.radius + 220) {
        ruin.discovered = true;
        const factionId = sector.faction?.id || '';
        const spawnCount = ruin.tier === 'vault' ? 5 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < spawnCount; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          const radius = ruin.radius + 80 + i * 12;
          let type = Math.random() < 0.6 ? 'interceptor' : 'gunship';
          if (ruin.tier === 'vault' && Math.random() < 0.25) type = 'bomber';
          spawnEnemy(type, ruin.x + Math.cos(angle) * radius, ruin.y + Math.sin(angle) * radius, 1 + sector.depth * 0.1, {
            faction: factionId
          });
        }
        noteStatus(ruin.tier === 'vault' ? 'Vault awakened. Heavy defenders inbound.' : 'Ruins activated. Defenders inbound.');
        return;
      }
      if (distanceToRuin < ruin.radius + cachedStats.size) {
        world.ruinClaims = world.ruinClaims || {};
        world.ruinClaims[sector.key] = true;
        if (ruin.loot === 'vault') {
          const blueprint = pickRandomBlueprint(Math.random);
          state.prompt = { type: 'blueprint', id: blueprint, name: BLUEPRINTS[blueprint].name };
          state.mode = 'prompt';
          state.paused = true;
          if (getCargoCount() < cachedStats.cargoMax) {
            player.inventory.cargo.relics += 1;
            awardCredits(260, 'Vault cache recovered');
          } else {
            awardCredits(200, 'Vault cache recovered');
            noteStatus('Cargo bay full. Vault relic logged for later pickup.');
          }
          unlockLoreEntry('vault');
          noteStatus('Vault cache secured.');
        } else if (ruin.loot === 'blueprint') {
          const blueprint = pickRandomBlueprint(Math.random);
          state.prompt = { type: 'blueprint', id: blueprint, name: BLUEPRINTS[blueprint].name };
          state.mode = 'prompt';
          state.paused = true;
          noteStatus('Ruin cache located.');
        } else {
          if (getCargoCount() < cachedStats.cargoMax) {
            player.inventory.cargo.relics += 1;
            awardCredits(120, 'Relic recovered');
            unlockLoreEntry('ruin');
          } else {
            noteStatus('Cargo bay full.');
          }
        }
      }
    });

    sector.objects.landmarks.forEach((landmark) => {
      if (world.landmarkClaims?.[sector.key]) return;
      const distanceToLandmark = dist(player.x, player.y, landmark.x, landmark.y);
      if (distanceToLandmark < landmark.radius + cachedStats.size + 12) {
        claimLandmark(landmark, sector);
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
      const gate = getGateData();
      if (gate) {
        const gateDistance = dist(player.x, player.y, gate.x, gate.y);
        mission.progress = clamp(Math.floor(mission.target - gateDistance * 0.05), 0, mission.target);
        if (gateDistance < 120) {
          mission.progress = mission.target;
          completeMission();
        }
      }
    }
    if (mission.type === 'boss') {
      if (!world.bossDefeated[player.chapterIndex]) {
        const sector = getCurrentSector();
        if (sector.key === mission.gateKey && !entities.enemies.some((enemy) => enemy.isBoss)) {
          const gate = getGateData();
          const anchor = gate ? { x: gate.x, y: gate.y } : posFromGrid(sector.gx, sector.gy);
          const angle = Math.random() * Math.PI * 2;
          const radius = 220;
          spawnBoss(anchor.x + Math.cos(angle) * radius, anchor.y + Math.sin(angle) * radius);
        }
      } else {
        mission.progress = mission.target;
        completeMission();
      }
    }
    if ((mission.type === 'carrier' || mission.type === 'convoy') && !mission.spawned) {
      const sector = getCurrentSector();
      if (sector.key === mission.gateKey) {
        const center = posFromGrid(sector.gx, sector.gy);
        const count = mission.type === 'carrier' ? mission.target : mission.target + 1;
        for (let i = 0; i < count; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          const radius = 260 + i * 40;
          const type = mission.type === 'carrier' ? 'carrier' : 'transport';
          const spawnX = center.x + Math.cos(angle) * radius;
          const spawnY = center.y + Math.sin(angle) * radius;
          spawnEnemy(type, spawnX, spawnY, 1 + sector.depth * 0.12, { captureBias: 0.35, faction: sector.faction?.id || '' });
          const escorts = type === 'carrier' ? 3 : 2;
          for (let e = 0; e < escorts; e += 1) {
            const escortAngle = angle + randRange(Math.random, -0.7, 0.7);
            const escortRadius = radius + randRange(Math.random, 60, 120);
            const escortType = Math.random() < 0.55 ? 'fighter' : 'interceptor';
            spawnEnemy(escortType, center.x + Math.cos(escortAngle) * escortRadius, center.y + Math.sin(escortAngle) * escortRadius, 1 + sector.depth * 0.08, {
              faction: sector.faction?.id || ''
            });
          }
        }
        mission.spawned = true;
      }
    }
  }

  function completeMission() {
    if (!mission.active) return;
    mission.active = false;
    awardCredits(mission.reward, 'Mission complete');
    if (mission.faction) {
      adjustFactionRep(mission.faction, 5, 'Mission reputation gained');
    }
    maybeAdvanceChapter(mission.type === 'boss');
  }

  function failMission(reason) {
    if (!mission.active) return;
    const chapter = STORY[player.chapterIndex];
    const penalty = 120 + chapter.depth * 40;
    player.credits = Math.max(0, player.credits - penalty);
    state.failureLedger[chapter.id] = (state.failureLedger[chapter.id] || 0) + 1;
    mission.active = false;
    mission.progress = 0;
    mission.timeRemaining = 0;
    mission.failures = state.failureLedger[chapter.id];
    mission.reward = Math.round(mission.baseReward * Math.max(0.5, 1 - mission.failures * 0.08));
    const reasonLabel = reason === 'outer-limit' ? 'outer limit' : reason;
    noteStatus(`Mission failed (${reasonLabel}). Penalty -${penalty} credits.`);
    pushStoryLog(`Mission failed (${reasonLabel}).`);
  }

  function startChapterMission() {
    const chapter = STORY[player.chapterIndex];
    if (!chapter) return;
    const currentSector = getCurrentSector();
    mission.active = true;
    mission.type = chapter.goal.type;
    mission.target = chapter.goal.target || 1;
    if (mission.type === 'reach_gate') mission.target = 100;
    mission.progress = 0;
    mission.baseReward = 300 + player.chapterIndex * 80;
    mission.failures = state.failureLedger[chapter.id] || 0;
    mission.reward = Math.round(mission.baseReward * Math.max(0.5, 1 - mission.failures * 0.08));
    mission.text = chapter.objective;
    mission.gateKey = world.gates[chapter.id] || '';
    mission.enemyType = chapter.goal.enemy || '';
    mission.faction = currentSector?.faction?.id || '';
    mission.spawned = false;
    let timeLimit = 520 + chapter.depth * 120;
    if (mission.type === 'reach_gate') timeLimit = 720 + chapter.depth * 150;
    if (mission.type === 'distance') timeLimit = 640 + chapter.depth * 140;
    mission.timeLimit = timeLimit;
    mission.timeRemaining = timeLimit;
    if (mission.type === 'base' && mission.gateKey) {
      const [gx, gy] = mission.gateKey.split(',').map((value) => Number.parseInt(value, 10));
      const sector = getSector(gx, gy);
      const baseType = chapter.id >= 9 ? 'refinery' : 'outpost';
      spawnBaseInSector(sector, baseType);
    }
    pushStoryLog(chapter.intro);
  }

  function updateProgress(dt) {
    if (state.mode !== 'flight') return;
    const speed = Math.hypot(player.vx, player.vy);
    player.distanceThisChapter += speed * dt;
    player.distanceTotal += speed * dt;

    updateExplorationMilestones();

    const checkpoints = Math.min(3, Math.floor((player.distanceThisChapter / (WORLD.sectorSize * 3)) * 3));
    if (checkpoints > player.checkpointIndex) {
      player.checkpointIndex = checkpoints;
      setCheckpoint();
      awardCredits(160, 'Checkpoint reached');
    }

    updateMissionProgress();

    if (state.atlasUnlocked && !state.atlasCompleted) {
      const gate = getConvergenceGateData();
      if (gate && dist(player.x, player.y, gate.x, gate.y) < 140) {
        completeAtlasConvergence();
      }
    }

    if (mission.active && mission.timeRemaining > 0) {
      mission.timeRemaining -= dt;
      if (mission.timeRemaining <= 0) {
        failMission('timeout');
      }
    }
  }

  function updateExplorationMilestones() {
    if (!EXPLORATION_MILESTONES.length) return;
    const reached = EXPLORATION_MILESTONES.filter(
      (milestone) => player.distanceTotal >= milestone.distance && !player.milestones.has(milestone.id)
    );
    if (!reached.length) return;
    reached.forEach((milestone) => {
      player.milestones.add(milestone.id);
      const reward = milestone.reward || {};
      if (reward.credits) awardCredits(reward.credits, 'Exploration milestone');
      if (reward.blueprint) {
        applyBlueprint(reward.blueprint, true);
        noteStatus(`Milestone: ${milestone.label} (Blueprint secured).`);
        pushStoryLog(`Milestone reached: ${milestone.label}. Blueprint secured.`);
      } else {
        noteStatus(`Milestone: ${milestone.label}.`);
        pushStoryLog(`Milestone reached: ${milestone.label}.`);
      }
    });
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

  function findClosestFriendly(x, y, range = 9999, sector = null) {
    const current = sector || getCurrentSector();
    if (!current?.objects?.friendlies?.length) return null;
    let best = null;
    let bestDist = range;
    current.objects.friendlies.forEach((ship) => {
      if (ship.hp !== undefined && ship.hp <= 0) return;
      const d = dist(x, y, ship.x, ship.y);
      if (d < bestDist) {
        best = ship;
        bestDist = d;
      }
    });
    return best;
  }

  function findClosestCivilian(x, y, range = 9999, sector = null, convoyId = '') {
    const current = sector || getCurrentSector();
    if (!current?.objects?.civilians?.length) return null;
    let best = null;
    let bestDist = range;
    current.objects.civilians.forEach((ship) => {
      if (ship.hp !== undefined && ship.hp <= 0) return;
      if (convoyId && ship.convoyId !== convoyId) return;
      const d = dist(x, y, ship.x, ship.y);
      if (d < bestDist) {
        best = ship;
        bestDist = d;
      }
    });
    return best;
  }

  function updateStationInteraction() {
    if (state.mode !== 'flight') return;
    const sector = getCurrentSector();
    const station = sector.objects.stations.find((s) => dist(player.x, player.y, s.x, s.y) < s.radius + 40);
    const trader = sector.objects.traders.find((t) => dist(player.x, player.y, t.x, t.y) < t.radius + 60);
    const city = world.cities
      ? world.cities.find((entry) => dist(player.x, player.y, entry.x, entry.y) < entry.radius + 50 && entry.type !== 'capital')
      : null;
    const home = world.homeBase && dist(player.x, player.y, world.homeBase.x, world.homeBase.y) < world.homeBase.radius + 50 ? world.homeBase : null;
    if (city) {
      noteStatus(`${city.label} in range. Press E to dock.`);
      if (input.justPressed['KeyE']) {
        state.mode = 'station';
        state.paused = true;
        state.menuSelection = 0;
        state.activeStation = { ...city, biome: sector.biome, type: 'city', faction: sector.faction?.id || 'aetherline' };
        if (!player.affiliation) {
          player.affiliation = 'aetherline';
          noteStatus('Aligned with Aetherline.');
          pushStoryLog('Joined Aetherline Command.');
        }
        if (!state.civicTutorialDone) beginCivicTutorial(city.label);
        noteStatus(`Docked at ${city.label}.`);
      }
      return;
    }
    if (station) {
      noteStatus(`${station.label || 'Station'} in range. Press E to dock.`);
      if (input.justPressed['KeyE']) {
        state.mode = 'station';
        state.paused = true;
        state.menuSelection = 0;
        state.activeStation = { ...station, faction: sector.faction?.id || '' };
        if (!player.affiliation && sector.faction?.id) {
          player.affiliation = sector.faction.id;
          noteStatus(`Aligned with ${sector.faction.name}.`);
          pushStoryLog(`Joined ${sector.faction.name}.`);
        }
        noteStatus('Docked at station.');
      }
      return;
    }
    if (home) {
      noteStatus('Bastion City in range. Press E to dock.');
      if (input.justPressed['KeyE']) {
        state.mode = 'station';
        state.paused = true;
        state.menuSelection = 0;
        state.activeStation = { ...home, biome: sector.biome, type: 'home', faction: sector.faction?.id || 'aetherline' };
        if (!player.affiliation && !state.intro?.active) {
          player.affiliation = 'aetherline';
          noteStatus('Aligned with Aetherline.');
          pushStoryLog('Joined Aetherline Command.');
        }
        if (!state.civicTutorialDone) beginCivicTutorial(home.label);
        noteStatus(`Docked at ${world.homeBase.name}.`);
      }
      return;
    }
    if (trader) {
      noteStatus('Trader in range. Press H to hail.');
      if (input.justPressed['KeyH']) {
        state.mode = 'trader';
        state.paused = true;
        state.traderSelection = 0;
        state.activeTrader = trader;
        const quotes = TRADER_DIALOGUE[trader.type] || [];
        state.traderQuote = quotes.length ? quotes[Math.floor(Math.random() * quotes.length)] : trader.vibe;
        noteStatus(`Hailing ${trader.label}.`);
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
      { type: 'distance', text: 'Fly a courier run', target: 8000 + Math.floor(rng() * 4000) },
      { type: 'convoy', text: 'Raid transport convoy', target: 2 + Math.floor(rng() * 2) },
      { type: 'escort', text: 'Defend convoy through the lane', target: 1 },
      { type: 'carrier', text: 'Disable carrier hulls', target: 1 + Math.floor(rng() * 2) },
      { type: 'base', text: 'Strike enemy outpost', target: 1 }
    ];
    if (sector.zoneType !== 'cluster') {
      const index = templates.findIndex((item) => item.type === 'base');
      if (index >= 0) templates.splice(index, 1);
    }
    if (sector.zoneType === 'cluster' || sector.zoneType === 'rift') {
      const index = templates.findIndex((item) => item.type === 'escort');
      if (index >= 0) templates.splice(index, 1);
    }
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
    contract.originKey = sector.key;
    contract.originBiome = sector.biome;
    contract.originFaction = sector.faction?.id || '';
    contract.convoyId = '';
    contract.convoyKey = '';
    contract.escortTime = 0;
    contract.escortTotal = 0;
    contract.raidTimer = 0;
    if (contract.type === 'escort') {
      startEscortContract(sector);
    }
    noteStatus(`Contract accepted: ${contract.text}`);
  }

  function spawnEscortConvoy(sector, convoyId) {
    const rng = mulberry32(WORLD_SEED + sector.gx * 41 + sector.gy * 83 + Math.floor(state.time * 4));
    const routes = sector.objects.tradeRoutes || [];
    let route = routes.length ? routes[Math.floor(rng() * routes.length)] : null;
    if (!route) {
      const center = posFromGrid(sector.gx, sector.gy);
      const angle = rng() * Math.PI * 2;
      const length = WORLD.sectorSize * 0.75;
      const dir = { x: Math.cos(angle), y: Math.sin(angle) };
      const perp = { x: -dir.y, y: dir.x };
      const offset = randRange(rng, -WORLD.sectorSize * 0.18, WORLD.sectorSize * 0.18);
      const mid = { x: center.x + perp.x * offset, y: center.y + perp.y * offset };
      const half = length / 2;
      route = {
        id: `${sector.key}-escort-route-${Math.floor(rng() * 9999)}`,
        x1: mid.x - dir.x * half,
        y1: mid.y - dir.y * half,
        x2: mid.x + dir.x * half,
        y2: mid.y + dir.y * half,
        width: randRange(rng, 140, 220)
      };
      const dx = route.x2 - route.x1;
      const dy = route.y2 - route.y1;
      route.length = Math.hypot(dx, dy);
      route.angle = Math.atan2(dy, dx);
      route.nx = -dy / (route.length || 1);
      route.ny = dx / (route.length || 1);
      sector.objects.tradeRoutes.push(route);
    }

    const convoyCount = 3 + Math.floor(rng() * 3);
    const convoyFaction = player.affiliation || 'aetherline';
    const livery = getLiveryForFaction(convoyFaction);
    const dx = route.x2 - route.x1;
    const dy = route.y2 - route.y1;
    for (let i = 0; i < convoyCount; i += 1) {
      const type = CIVILIAN_TYPES[Math.floor(rng() * CIVILIAN_TYPES.length)];
      const routeT = 0.2 + rng() * 0.6;
      const offset = randRange(rng, -route.width * 0.25, route.width * 0.25);
      sector.objects.civilians.push({
        id: `${sector.key}-${convoyId}-civ-${i}`,
        type: type.id,
        label: type.label,
        x: route.x1 + dx * routeT + route.nx * offset,
        y: route.y1 + dy * routeT + route.ny * offset,
        angle: route.angle,
        speed: randRange(rng, type.speed * 0.95, type.speed * 1.2),
        size: type.size,
        color: type.color,
        faction: convoyFaction,
        livery,
        hp: type.hp,
        maxHp: type.hp,
        shield: type.id === 'freighter' ? 24 : type.id === 'hauler' ? 14 : 8,
        armor: type.id === 'freighter' ? 0.1 : 0.05,
        convoyId,
        routeId: route.id,
        routeT,
        routeDir: 1,
        routeOffset: offset,
        sway: rng() * Math.PI * 2
      });
    }

    const escortCount = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < escortCount; i += 1) {
      const def = FRIENDLY_TYPES[Math.floor(rng() * FRIENDLY_TYPES.length)];
      const escortOffset = randRange(rng, -route.width * 0.3, route.width * 0.3);
      const escortT = 0.25 + rng() * 0.5;
      spawnFriendly(def.id, route.x1 + dx * escortT + route.nx * escortOffset, route.y1 + dy * escortT + route.ny * escortOffset, {
        sector,
        angle: route.angle,
        faction: convoyFaction,
        routeId: route.id,
        routeT: escortT,
        routeDir: 1,
        routeOffset: escortOffset,
        rng
      });
    }
  }

  function startEscortContract(sector) {
    const convoyId = `escort-${sector.key}-${Math.floor(state.time * 10)}`;
    contract.convoyId = convoyId;
    contract.convoyKey = sector.key;
    contract.escortTotal = Math.max(60, Math.round(70 + sector.depth * 6));
    contract.escortTime = contract.escortTotal;
    contract.raidTimer = 6;
    contract.progress = 0;
    contract.target = contract.escortTotal;
    spawnEscortConvoy(sector, convoyId);
    noteStatus('Convoy launched. Stay close and repel raiders.');
    pushStoryLog('Escort contract active: convoy in transit.');
  }

  function failContract(reason = 'failed') {
    if (!contract.active) return;
    const penalty = Math.round(contract.reward * 0.35);
    player.credits = Math.max(0, player.credits - penalty);
    if (contract.originFaction) {
      adjustFactionRep(contract.originFaction, -2, 'Contract failed');
    }
    noteStatus(`Contract failed (${reason}). Penalty -${penalty} credits.`);
    pushStoryLog(`Contract failed (${reason}).`);
    contract.active = false;
    contract.progress = 0;
    contract.originKey = '';
    contract.originBiome = '';
    contract.originFaction = '';
    contract.convoyId = '';
    contract.convoyKey = '';
    contract.escortTime = 0;
    contract.escortTotal = 0;
    contract.raidTimer = 0;
  }

  function updateEscortContract(dt) {
    if (!contract.active || contract.type !== 'escort' || !contract.convoyKey) return;
    const [gx, gy] = contract.convoyKey.split(',').map((value) => Number(value));
    const sector = getSector(gx, gy);
    if (!sector) return;
    const convoyShips = sector.objects.civilians.filter((ship) => ship.convoyId === contract.convoyId && (ship.hp === undefined || ship.hp > 0));
    if (!convoyShips.length) {
      failContract('convoy lost');
      return;
    }
    if (contract.raidTimer > 0) {
      contract.raidTimer = Math.max(0, contract.raidTimer - dt);
    } else {
      const raidFaction = sector.faction?.id && sector.faction.id !== 'aetherline' ? sector.faction.id : 'redshift_cartel';
      const raidCount = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < raidCount; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = randRange(Math.random, 320, 520);
        const spawnX = convoyShips[0].x + Math.cos(angle) * radius;
        const spawnY = convoyShips[0].y + Math.sin(angle) * radius;
        const type = Math.random() < 0.45 ? 'interceptor' : Math.random() < 0.8 ? 'fighter' : 'gunship';
        spawnEnemy(type, spawnX, spawnY, 1 + sector.depth * 0.08, {
          raid: true,
          raidConvoyId: contract.convoyId,
          faction: raidFaction
        });
      }
      contract.raidTimer = 9 + Math.random() * 6;
    }
    contract.escortTime = Math.max(0, contract.escortTime - dt);
    contract.progress = Math.min(contract.target, contract.target - contract.escortTime);
    if (contract.escortTime <= 0) {
      completeContract();
    }
  }

  function completeContract() {
    if (!contract.active) return;
    awardCredits(contract.reward, 'Contract complete');
    const originBiome = contract.originBiome;
    const originKey = contract.originKey;
    const hubKey = originBiome ? world.biomeStations?.[originBiome]?.key : null;
    if (originBiome && originKey && hubKey && hubKey === originKey) {
      awardAtlasSigil(originBiome);
    }
    if (contract.originFaction) {
      adjustFactionRep(contract.originFaction, 4, 'Faction reputation improved');
    }
    contract.active = false;
    contract.progress = 0;
    contract.originKey = '';
    contract.originBiome = '';
    contract.originFaction = '';
    contract.convoyId = '';
    contract.convoyKey = '';
    contract.escortTime = 0;
    contract.escortTotal = 0;
    contract.raidTimer = 0;
  }

  function update(dt) {
    updateSkygridBackground(dt);
    if (updateEscape(dt)) {
      updateStatusTimer(dt);
      updateHud();
      updateUpgradeButtons();
      if (state.boundaryWarning > 0) state.boundaryWarning = Math.max(0, state.boundaryWarning - dt);
      if (state.broadcastCooldown > 0) state.broadcastCooldown = Math.max(0, state.broadcastCooldown - dt);
      if (state.rumorCooldown > 0) state.rumorCooldown = Math.max(0, state.rumorCooldown - dt);
      if (state.radioCooldown > 0) state.radioCooldown = Math.max(0, state.radioCooldown - dt);
      input.justPressed = {};
      return;
    }
    updateCaptureState(dt);
    const sector = getCurrentSector();
    if (sector && sector.biome !== state.lastBiome) {
      state.lastBiome = sector.biome;
      const biomeName = BIOMES[sector.biome]?.name || sector.biome;
      const note = BIOME_NOTES[sector.biome] || 'Unknown conditions.';
      noteStatus(`${biomeName}: ${note}`, 4);
      pushStoryLog(`Biome entered: ${biomeName}. ${note}`);
    }
    if (state.spawnGrace > 0) {
      state.spawnGrace = Math.max(0, state.spawnGrace - dt);
    }
    if (state.radioCooldown > 0) {
      state.radioCooldown = Math.max(0, state.radioCooldown - dt);
    }
    if (state.hyperJumpFx?.pending) {
      state.hyperJumpFx.timer = Math.max(0, state.hyperJumpFx.timer - dt);
      if (state.hyperJumpFx.timer <= 0) {
        completeHyperJump(state.hyperJumpFx.pending);
        state.hyperJumpFx.pending = null;
      }
      updateStatusTimer(dt);
      updateHud();
      input.justPressed = {};
      return;
    }

    updateIntroSequence(dt);

    if (!state.purposeHinted && state.time > 20 && state.mode === 'flight') {
      noteStatus('Goal: Earn Atlas sigils by completing hub contracts. Press G for goals.');
      state.purposeHinted = true;
    }

    if (!state.intro?.active && !state.startEncounterSeeded) {
      state.startEncounterTimer -= dt;
      if (state.startEncounterTimer <= 0) {
        spawnStarterCaptureWing();
        state.startEncounterSeeded = true;
      }
    }

    if (state.spawnGrace <= 0 && !state.capture?.active) {
      const activeEnemies = entities.enemies.some((enemy) => enemy.hp > 0);
      if (!activeEnemies) {
        state.enemyQuietTimer += dt;
        if (state.enemyQuietTimer > PATROL_SPAWN.quietTime) {
          spawnRoamingPatrol(sector);
          state.enemyQuietTimer = 0;
        }
      } else {
        state.enemyQuietTimer = 0;
      }
    }
    if (state.tutorialActive) {
      const movedDist = dist(player.x, player.y, state.tutorialOrigin.x, state.tutorialOrigin.y);
      if (!state.tutorialFlags.moved && movedDist > 300) {
        state.tutorialFlags.moved = true;
        noteStatus('Maneuvering complete.');
      }
      if (!state.tutorialFlags.boosted && state.shiftBoost.active) {
        state.tutorialFlags.boosted = true;
        noteStatus('Boost check complete.');
      }
      if (!state.tutorialFlags.scanned && (input.justPressed['KeyC'] || input.justPressed['KeyM'])) {
        state.tutorialFlags.scanned = true;
        noteStatus('Scan check complete.');
      }
      const ready = state.tutorialFlags.moved && state.tutorialFlags.boosted && state.tutorialFlags.scanned;
      if (ready && !state.tutorialReady) {
        state.tutorialReady = true;
        noteStatus('Tutorial ready. Press Enter to launch.');
      }
    }
    if (input.justPressed['KeyC']) {
      if (!player.blueprints.has('scanner_drone')) {
        noteStatus('Scanner drone required.');
      } else if (player.energy >= 20) {
        player.energy -= 20;
        state.scanPulse = 2.2;
        revealSectorsAround(player.x, player.y, state.scanRadius);
        noteStatus('Scanner pulse active.');
        triggerRumor();
      } else {
        noteStatus('Insufficient energy for scan.');
      }
    }

    if (input.justPressed['KeyJ']) {
      tryReturnJump();
    }

    if (input.justPressed['KeyT']) {
      player.flightAssist = !player.flightAssist;
      noteStatus(`Flight assist ${player.flightAssist ? 'engaged' : 'disengaged'}.`);
    }

    if (input.justPressed['Digit1']) player.weapons.primary = 'laser';
    if (input.justPressed['Digit2'] && player.unlocked.weapons.includes('pulse')) player.weapons.primary = 'pulse';
    if (input.justPressed['Digit3'] && player.unlocked.weapons.includes('rail')) player.weapons.primary = 'rail';
    if (input.justPressed['Digit4'] && player.unlocked.weapons.includes('plasma')) player.weapons.secondary = 'plasma';
    if (input.justPressed['Digit5'] && player.unlocked.weapons.includes('missile')) player.weapons.secondary = 'missile';
    if (input.justPressed['Digit6'] && player.unlocked.weapons.includes('torpedo')) player.weapons.secondary = 'torpedo';
    if (input.justPressed['Digit7'] && player.unlocked.weapons.includes('flak')) player.weapons.secondary = 'flak';
    if (input.justPressed['Digit8'] && player.unlocked.weapons.includes('emp')) player.weapons.secondary = 'emp';
    if (input.justPressed['Digit9'] && player.unlocked.weapons.includes('mine')) player.weapons.secondary = 'mine';

    state.scanPulse = Math.max(0, state.scanPulse - dt);

    updatePlayer(dt);
    updateNoFireZone(dt);
    updateEnemies(dt);
    updateBases(dt);
    updateHomeDefense(dt);
    updateTraders(dt);
    updateCivilians(dt);
    updateFriendlies(dt);
    updateTraffic(dt);
    updateProjectiles(dt);
    updateDrones(dt);
    updateLoot(dt);
    updateEffects(dt);
    updateParticles(dt);
    updateEvents(dt);
    handleCollisions(dt);
    updateProgress(dt);
    updateDifficulty();
    handleTransportCapture();
    updateStationInteraction();
    updateContractProgress();
    updateEscortContract(dt);
    updateStatusTimer(dt);
    updateHud();
    updateUpgradeButtons();
    if (state.boundaryWarning > 0) state.boundaryWarning = Math.max(0, state.boundaryWarning - dt);
    if (state.broadcastCooldown > 0) state.broadcastCooldown = Math.max(0, state.broadcastCooldown - dt);
    if (state.rumorCooldown > 0) state.rumorCooldown = Math.max(0, state.rumorCooldown - dt);
    input.justPressed = {};
  }

  function updateHud() {
    if (hudHp) hudHp.textContent = `Hull: ${Math.round(player.hp)}/${Math.round(cachedStats.maxHp)}`;
    if (hudShield) hudShield.textContent = `Shield: ${Math.round(player.shield)}/${Math.round(cachedStats.maxShield)}`;
    if (hudCredits) hudCredits.textContent = `Credits: ${Math.round(player.credits)}`;
    if (hudChapter) hudChapter.textContent = `Chapter: ${player.chapterIndex + 1}/${STORY.length}`;
    if (hudCheckpoint) hudCheckpoint.textContent = `Checkpoint: ${player.checkpointIndex}/3`;
    if (hudScore) {
      const sector = getCurrentSector();
      const biomeName = BIOMES[sector.biome]?.name || sector.biome;
      const heatValue = Math.round(player.heat || 0);
      hudScore.textContent = `Distance: ${Math.floor(player.distanceTotal)} | Lvl ${player.level} | Fuel ${Math.round(player.fuel)} | Heat ${heatValue}% | ${biomeName} / ${sector.zone?.label || 'Cluster'} | Atlas ${player.atlasSigils.size}/${ATLAS_REQUIRED}`;
    }
    const chapter = STORY[player.chapterIndex];
    if (hudObjective && chapter) {
      const timeText = mission.active ? ` ${Math.max(0, Math.floor(mission.timeRemaining))}s` : '';
      const missionText = mission.active ? ` | Mission: ${mission.text} ${Math.round(mission.progress)}/${mission.target}${timeText}` : '';
      let contractText = '';
      if (contract.active) {
        if (contract.type === 'escort') {
          contractText = ` | Contract: ${contract.text} ${Math.ceil(contract.escortTime)}s`;
        } else {
          contractText = ` | Contract: ${contract.text} ${contract.progress}/${contract.target}`;
        }
      }
      const gate = getGateData();
      const gateDistance = gate ? Math.round(Math.hypot(gate.x - player.x, gate.y - player.y)) : null;
      const gateText = gateDistance ? ` | Gate ${gateDistance}m` : '';
      const hub = !mission.active && !contract.active ? getNearestHubTarget() : null;
      const goalText = !mission.active && !contract.active
        ? ` | Goal: Atlas sigils (G)${hub ? ` | Hub ${Math.round(hub.distance)}m` : ''}`
        : '';
      hudObjective.textContent = `Objective: ${chapter.objective}${missionText}${contractText}${gateText}${goalText}`;
    }
    if (upgradeNote) {
      upgradeNote.textContent = state.codexSeen
        ? 'Upgrades persist. Dock at stations for shipyard and store access.'
        : 'Tip: Press K for the Pilot Codex. Press G for Expedition Goals.';
    }
  }

  function getBlendInfo(sector) {
    const primary = BIOMES[sector.biome] || BIOMES.interstice;
    const blend = sector.blendBiome ? BIOMES[sector.blendBiome] : null;
    const weight = clamp(sector.blendWeight || 0, 0, 1);
    const hue = blend ? lerp(primary.hue, blend.hue, weight) : primary.hue;
    return { primary, blend, weight, hue };
  }

  function drawSkyGrid(camera) {
    const sector = getCurrentSector();
    const { hue } = getBlendInfo(sector);
    const spacing = 140;
    const driftX = (-camera.x * 0.02) % spacing;
    const driftY = (-camera.y * 0.02) % spacing;
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = `hsla(${hue},70%,65%,0.28)`;
    ctx.lineWidth = 1;
    for (let x = driftX - spacing; x < VIEW.width + spacing; x += spacing) {
      const sway = Math.sin(state.time * 0.4 + x * 0.01) * 30;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.quadraticCurveTo(x + sway, VIEW.centerY, x, VIEW.height);
      ctx.stroke();
    }
    for (let y = driftY - spacing; y < VIEW.height + spacing; y += spacing) {
      const sway = Math.cos(state.time * 0.35 + y * 0.01) * 24;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(VIEW.centerX, y + sway, VIEW.width, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.22;
    const vanishing = { x: VIEW.centerX, y: VIEW.centerY + 120 };
    for (let i = -4; i <= 4; i += 1) {
      const offset = i * 120;
      ctx.beginPath();
      ctx.moveTo(vanishing.x + offset, vanishing.y);
      ctx.lineTo(vanishing.x + offset * 2.2, VIEW.height + 40);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = 'rgba(20,30,45,0.5)';
    for (let i = 0; i < 6; i += 1) {
      const px = (Math.sin(state.time * 0.2 + i * 1.7) * 0.45 + 0.5) * VIEW.width;
      const py = (Math.cos(state.time * 0.18 + i * 1.3) * 0.45 + 0.5) * VIEW.height;
      const r = 18 + (i % 3) * 12;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const horizon = VIEW.height * 0.38;
    const horizonGlow = ctx.createLinearGradient(0, horizon - 120, 0, horizon + 220);
    horizonGlow.addColorStop(0, 'rgba(5,10,18,0)');
    horizonGlow.addColorStop(0.5, `hsla(${hue},70%,30%,0.35)`);
    horizonGlow.addColorStop(1, 'rgba(5,10,18,0)');
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = horizonGlow;
    ctx.fillRect(0, horizon - 140, VIEW.width, 360);

    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = `hsla(${hue},75%,65%,0.3)`;
    const verticalCount = 12;
    for (let i = -verticalCount; i <= verticalCount; i += 1) {
      const t = i / verticalCount;
      const x = VIEW.centerX + t * VIEW.width * 0.9;
      ctx.beginPath();
      ctx.moveTo(VIEW.centerX, horizon);
      ctx.lineTo(x, VIEW.height + 60);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.28;
    const horizontalCount = 12;
    for (let i = 1; i <= horizontalCount; i += 1) {
      const t = i / horizontalCount;
      const ease = t * t;
      const y = lerp(horizon, VIEW.height + 60, ease);
      ctx.beginPath();
      ctx.moveTo(-40, y);
      ctx.lineTo(VIEW.width + 40, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBackground(camera) {
    const sector = getCurrentSector();
    const { blend, weight, hue } = getBlendInfo(sector);
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    gradient.addColorStop(0, '#04060f');
    gradient.addColorStop(0.6, '#060a16');
    gradient.addColorStop(1, '#050814');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const tileW = skygridBackground.tileW || VIEW.width * 2.7;
    const tileH = skygridBackground.tileH || VIEW.height * 2.7;
    const camX = camera.x;
    const camY = camera.y;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    skygridBackground.nebulae.forEach((nebula) => {
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

    skygridBackground.stars.forEach((star) => {
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
    skygridBackground.comets.forEach((comet) => {
      ctx.beginPath();
      ctx.moveTo(comet.x, comet.y);
      ctx.lineTo(comet.x - comet.vx * 0.06, comet.y - comet.vy * 0.06);
      ctx.stroke();
    });
    ctx.restore();

    const aura = ctx.createRadialGradient(
      VIEW.centerX,
      VIEW.centerY,
      VIEW.height * 0.12,
      VIEW.centerX,
      VIEW.centerY,
      VIEW.height * 0.9
    );
    aura.addColorStop(0, `hsla(${hue},70%,22%,0.12)`);
    aura.addColorStop(0.55, `hsla(${hue + 20},65%,16%,0.06)`);
    aura.addColorStop(1, 'rgba(5,10,18,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.restore();

    if (blend && weight > 0.08) {
      const blendAura = ctx.createRadialGradient(
        VIEW.centerX,
        VIEW.centerY,
        VIEW.height * 0.12,
        VIEW.centerX,
        VIEW.centerY,
        VIEW.height * 0.9
      );
      blendAura.addColorStop(0, `hsla(${blend.hue},70%,22%,${0.05 + weight * 0.1})`);
      blendAura.addColorStop(0.6, `hsla(${blend.hue + 24},65%,16%,${0.03 + weight * 0.08})`);
      blendAura.addColorStop(1, 'rgba(5,10,18,0)');
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = blendAura;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.restore();
    }

    if (sector.zoneType === 'rift' || sector.zoneType === 'lane' || sector.zoneType === 'expanse') {
      const isRift = sector.zoneType === 'rift';
      const isExpanse = sector.zoneType === 'expanse';
      ctx.save();
      ctx.globalAlpha = isRift ? 0.25 : isExpanse ? 0.12 : 0.16;
      ctx.strokeStyle = isRift ? 'rgba(255,209,102,0.45)' : isExpanse ? 'rgba(154,214,255,0.25)' : 'rgba(125,252,154,0.3)';
      const lineCount = isExpanse ? 6 : 4;
      for (let i = 0; i < lineCount; i += 1) {
        const offset = (state.time * (isExpanse ? 26 : 40) + i * (isExpanse ? 90 : 120)) % VIEW.height;
        ctx.beginPath();
        ctx.moveTo(0, offset);
        ctx.quadraticCurveTo(VIEW.centerX, offset - (isExpanse ? 90 : 60), VIEW.width, offset);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (state.shiftBoost.active) {
      const speed = Math.min(1, Math.hypot(player.vx, player.vy) / (cachedStats.maxSpeed * 1.2));
      const streakCount = 18 + Math.floor(speed * 18);
      const angle = Math.atan2(player.vy, player.vx);
      ctx.save();
      ctx.globalAlpha = 0.35 + speed * 0.35;
      ctx.strokeStyle = sector.zoneType === 'expanse' ? 'rgba(154,214,255,0.7)' : 'rgba(125,252,154,0.7)';
      ctx.lineWidth = 1.2;
      for (let i = 0; i < streakCount; i += 1) {
        const jitter = (Math.random() - 0.5) * Math.PI * 0.4;
        const length = 40 + Math.random() * 80 * speed;
        const offset = 40 + Math.random() * VIEW.width * 0.5;
        const ox = VIEW.centerX + Math.cos(angle + jitter) * offset;
        const oy = VIEW.centerY + Math.sin(angle + jitter) * offset;
        ctx.beginPath();
        ctx.moveTo(ox, oy);
        ctx.lineTo(ox - Math.cos(angle) * length, oy - Math.sin(angle) * length);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function renderBiomeAtmosphereLayer({ biomeId, weight, camera, seedOffset = 0 }) {
    if (!biomeId || weight <= 0) return;
    const biome = BIOMES[biomeId] || BIOMES.interstice;
    const vfx = BIOME_VFX[biomeId] || { veil: 0.15, ribbon: 0.2, spark: 0.2, pattern: 'calm' };
    const hue = biome.hue;
    const intensity = clamp(weight * BIOME_ATMOS_INTENSITY, 0.08, 1);
    const time = state.time * 0.08 + seedOffset * 1.7;
    const offsetX = VIEW.centerX + Math.sin(time + camera.x * 0.00004 + seedOffset) * VIEW.width * 0.22;
    const offsetY = VIEW.centerY + Math.cos(time * 1.2 + camera.y * 0.00005 + seedOffset) * VIEW.height * 0.18;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const veil = ctx.createRadialGradient(
      offsetX,
      offsetY,
      80,
      VIEW.centerX,
      VIEW.centerY,
      Math.max(VIEW.width, VIEW.height) * 0.9
    );
    const veilAlpha = (0.18 + vfx.veil * 0.5) * intensity;
    veil.addColorStop(0, `hsla(${hue},70%,32%,${veilAlpha})`);
    veil.addColorStop(0.6, `hsla(${hue + 18},70%,18%,${vfx.veil * intensity})`);
    veil.addColorStop(1, 'rgba(5,10,18,0)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const ribbonCount = Math.max(1, Math.floor(2 + vfx.ribbon * 4 * (0.6 + intensity * 0.4)));
    for (let i = 0; i < ribbonCount; i += 1) {
      const y = (i / ribbonCount) * VIEW.height + Math.sin(state.time * 0.2 + i + seedOffset) * 60;
      ctx.strokeStyle = `hsla(${hue + 12},80%,60%,${(0.06 + vfx.ribbon * 0.18) * intensity})`;
      ctx.lineWidth = (24 - i * 3) * (0.7 + intensity * 0.3);
      ctx.beginPath();
      ctx.moveTo(-100, y);
      ctx.bezierCurveTo(
        VIEW.width * 0.25,
        y - 80 + Math.sin(time + i) * 40,
        VIEW.width * 0.75,
        y + 80 + Math.cos(time + i) * 40,
        VIEW.width + 100,
        y
      );
      ctx.stroke();
    }

    switch (vfx.pattern) {
      case 'shards': {
        ctx.globalAlpha = 0.25 * intensity;
        ctx.strokeStyle = `hsla(${hue + 30},80%,70%,0.6)`;
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 4; i += 1) {
          const px = (i * 0.28 + 0.1) * VIEW.width;
          const py = (i * 0.22 + 0.1) * VIEW.height;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px + 120, py - 60);
          ctx.lineTo(px + 220, py + 40);
          ctx.lineTo(px + 80, py + 120);
          ctx.closePath();
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        break;
      }
      case 'storm': {
        ctx.strokeStyle = `hsla(${hue + 20},75%,65%,${0.3 * intensity})`;
        ctx.lineWidth = 3;
        for (let i = 0; i < 3; i += 1) {
          ctx.beginPath();
          ctx.arc(VIEW.centerX, VIEW.centerY, 120 + i * 90, time + i, time + Math.PI + i);
          ctx.stroke();
        }
        break;
      }
      case 'grid': {
        ctx.strokeStyle = `hsla(${hue},60%,60%,${0.2 * intensity})`;
        ctx.lineWidth = 1;
        for (let i = -2; i <= 2; i += 1) {
          ctx.beginPath();
          ctx.moveTo(0, VIEW.centerY + i * 120);
          ctx.lineTo(VIEW.width, VIEW.centerY + i * 120 + 60);
          ctx.stroke();
        }
        break;
      }
      case 'forge': {
        ctx.strokeStyle = `hsla(${hue + 10},80%,65%,${0.35 * intensity})`;
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i += 1) {
          const angle = (Math.PI * 2 * i) / 6 + time * 0.6;
          ctx.beginPath();
          ctx.moveTo(VIEW.centerX, VIEW.centerY);
          ctx.lineTo(VIEW.centerX + Math.cos(angle) * VIEW.width * 0.6, VIEW.centerY + Math.sin(angle) * VIEW.height * 0.6);
          ctx.stroke();
        }
        break;
      }
      case 'echo': {
        ctx.strokeStyle = `hsla(${hue + 40},70%,70%,${0.25 * intensity})`;
        ctx.lineWidth = 1.6;
        for (let i = 0; i < 4; i += 1) {
          ctx.beginPath();
          ctx.arc(VIEW.centerX, VIEW.centerY, 80 + i * 90, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      case 'prism': {
        ctx.globalAlpha = 0.2 * intensity;
        ctx.fillStyle = `hsla(${hue + 30},80%,70%,0.4)`;
        ctx.beginPath();
        ctx.moveTo(VIEW.centerX - 60, VIEW.centerY - 160);
        ctx.lineTo(VIEW.centerX + 180, VIEW.centerY);
        ctx.lineTo(VIEW.centerX - 60, VIEW.centerY + 160);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'void': {
        ctx.globalCompositeOperation = 'multiply';
        const dark = ctx.createRadialGradient(
          VIEW.centerX,
          VIEW.centerY,
          VIEW.width * 0.1,
          VIEW.centerX,
          VIEW.centerY,
          VIEW.width * 0.9
        );
        dark.addColorStop(0, 'rgba(5,10,18,0)');
        dark.addColorStop(1, `rgba(5,10,18,${0.45 * intensity})`);
        ctx.fillStyle = dark;
        ctx.fillRect(0, 0, VIEW.width, VIEW.height);
        ctx.globalCompositeOperation = 'screen';
        break;
      }
      case 'embers': {
        ctx.globalAlpha = 0.55 * intensity;
        for (let i = 0; i < 7; i += 1) {
          const px = (Math.sin(time * 2 + i + seedOffset) * 0.4 + 0.5) * VIEW.width;
          const py = (Math.cos(time * 1.6 + i * 0.7 + seedOffset) * 0.4 + 0.5) * VIEW.height;
          const r = 40 + i * 18;
          const ember = ctx.createRadialGradient(px, py, 0, px, py, r);
          ember.addColorStop(0, `hsla(${hue + 10},80%,60%,0.6)`);
          ember.addColorStop(1, 'rgba(255,120,60,0)');
          ctx.fillStyle = ember;
          ctx.fillRect(px - r, py - r, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
        break;
      }
      default:
        break;
    }

    const sparkCount = 6 + Math.floor(vfx.spark * 10 * (0.6 + intensity * 0.4));
    for (let i = 0; i < sparkCount; i += 1) {
      const px = (Math.sin(time * 1.4 + i * 1.9 + seedOffset) * 0.45 + 0.5) * VIEW.width;
      const py = (Math.cos(time * 1.1 + i * 1.3 + seedOffset) * 0.45 + 0.5) * VIEW.height;
      const r = 6 + (i % 3) * 3;
      ctx.fillStyle = `hsla(${hue + 12},80%,70%,${(0.12 + vfx.spark * 0.2) * intensity})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawBiomeAtmosphere(camera) {
    const sector = getCurrentSector();
    renderBiomeAtmosphereLayer({ biomeId: sector.biome, weight: 1, camera, seedOffset: 0 });
    if (sector.blendBiome && sector.blendWeight > 0.05) {
      renderBiomeAtmosphereLayer({
        biomeId: sector.blendBiome,
        weight: sector.blendWeight * 0.85,
        camera,
        seedOffset: 1
      });
    }
  }

  function drawGalacticBand(camera) {
    const sector = getCurrentSector();
    const { hue } = getBlendInfo(sector);
    const bandOffset = Math.sin(state.time * 0.2 + camera.x * 0.0002) * 80;
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = `hsla(${hue},70%,60%,0.4)`;
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(-100, VIEW.centerY + bandOffset);
    ctx.bezierCurveTo(
      VIEW.width * 0.3,
      VIEW.centerY - 120 + bandOffset,
      VIEW.width * 0.7,
      VIEW.centerY + 120 + bandOffset,
      VIEW.width + 100,
      VIEW.centerY + bandOffset
    );
    ctx.stroke();
    ctx.restore();
  }

  function drawVignette() {
    const grad = ctx.createRadialGradient(
      VIEW.centerX,
      VIEW.centerY,
      Math.min(VIEW.width, VIEW.height) * 0.2,
      VIEW.centerX,
      VIEW.centerY,
      Math.max(VIEW.width, VIEW.height) * 0.65
    );
    grad.addColorStop(0, 'rgba(5,10,18,0)');
    grad.addColorStop(1, 'rgba(5,10,18,0.55)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawDust(camera) {
    const sector = getCurrentSector();
    const { primary, blend, weight } = getBlendInfo(sector);
    const zone = sector.zone || ZONE_TYPES.cluster;
    const voidScale = sector.isVoid ? 0.35 : 1;
    const openSpace = sector.openSpace || 0;
    const drawLayer = (color, alphaScale) => {
      ctx.fillStyle = color;
      dustField.forEach((dust) => {
        const screenX = dust.x - camera.x * 0.25 + VIEW.centerX;
        const screenY = dust.y - camera.y * 0.25 + VIEW.centerY;
        if (screenX < -50 || screenX > VIEW.width + 50 || screenY < -50 || screenY > VIEW.height + 50) return;
        ctx.globalAlpha = dust.alpha * zone.dustScale * voidScale * (1 - openSpace * 0.6) * alphaScale;
        ctx.beginPath();
        ctx.arc(screenX, screenY, dust.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    };
    drawLayer(primary.dust, 1);
    if (blend && weight > 0.08) {
      drawLayer(blend.dust, weight * 0.6);
    }
  }

  function drawAsteroid(asteroid, camera) {
    const x = asteroid.x - camera.x + VIEW.centerX;
    const y = asteroid.y - camera.y + VIEW.centerY;
    ctx.save();
    ctx.translate(x, y);
    const alpha = asteroid.ghost ? 0.35 : 1;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = asteroid.ghost ? 'rgba(60,80,110,0.55)' : PALETTE.steel;
    ctx.beginPath();
    asteroid.points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y);
      else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = asteroid.ghost ? 'rgba(125,252,154,0.08)' : 'rgba(125,252,154,0.12)';
    ctx.stroke();
    ctx.restore();
  }

  function drawStation(station, camera) {
    const x = station.x - camera.x + VIEW.centerX;
    const y = station.y - camera.y + VIEW.centerY;
    const color = station.color || BIOMES[station.biome]?.accent || '#7dfc9a';
    const ringCount = station.ringCount || 2;
    const spokeCount = station.spokeCount || 6;
    const finCount = station.finCount || 0;
    const coreShape = station.coreShape || 'circle';
    const radius = station.radius;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowBlur = 14;
    ctx.shadowColor = color;

    for (let i = 0; i < ringCount; i += 1) {
      const r = radius * (1 - i * 0.22);
      ctx.globalAlpha = 0.8 - i * 0.15;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.globalAlpha = 0.55;
    for (let i = 0; i < spokeCount; i += 1) {
      const angle = (Math.PI * 2 * i) / spokeCount;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * radius * 0.28, Math.sin(angle) * radius * 0.28);
      ctx.lineTo(Math.cos(angle) * radius * 0.96, Math.sin(angle) * radius * 0.96);
      ctx.stroke();
    }

    if (finCount > 0) {
      ctx.globalAlpha = 0.6;
      for (let i = 0; i < finCount; i += 1) {
        const angle = (Math.PI * 2 * i) / finCount;
        const tipX = Math.cos(angle) * radius * 1.05;
        const tipY = Math.sin(angle) * radius * 1.05;
        const leftX = Math.cos(angle - 0.2) * radius * 0.78;
        const leftY = Math.sin(angle - 0.2) * radius * 0.78;
        const rightX = Math.cos(angle + 0.2) * radius * 0.78;
        const rightY = Math.sin(angle + 0.2) * radius * 0.78;
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(leftX, leftY);
        ctx.lineTo(rightX, rightY);
        ctx.closePath();
        ctx.stroke();
      }
    }

    ctx.globalAlpha = 0.9;
    ctx.fillStyle = 'rgba(10,18,32,0.9)';
    ctx.beginPath();
    if (coreShape === 'hex') {
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6;
        const r = radius * 0.38;
        if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
    } else if (coreShape === 'diamond') {
      const r = radius * 0.4;
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.8, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.8, 0);
    } else if (coreShape === 'tri') {
      const r = radius * 0.4;
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.9, r * 0.6);
      ctx.lineTo(-r * 0.9, r * 0.6);
    } else {
      ctx.arc(0, 0, radius * 0.38, 0, Math.PI * 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    const distance = dist(player.x, player.y, station.x, station.y);
    if (distance < 260) {
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#e0f2ff';
      ctx.fillText(station.label, radius + 10, -radius - 6);
    }
    ctx.restore();
  }

  function drawTrader(trader, camera) {
    const x = trader.x - camera.x + VIEW.centerX;
    const y = trader.y - camera.y + VIEW.centerY;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(state.time + trader.phase) * 0.2);
    ctx.fillStyle = trader.color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = trader.color;
    ctx.beginPath();
    ctx.moveTo(0, -trader.radius * 1.1);
    ctx.lineTo(trader.radius * 0.8, trader.radius * 0.4);
    ctx.lineTo(0, trader.radius * 0.9);
    ctx.lineTo(-trader.radius * 0.8, trader.radius * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.stroke();
    ctx.restore();
  }

  function drawCivilian(ship, camera) {
    const x = ship.x - camera.x + VIEW.centerX;
    const y = ship.y - camera.y + VIEW.centerY;
    const size = ship.size || 20;
    const color = ship.color || '#9ad6ff';
    const livery = ship.livery || getLiveryForFaction(ship.faction);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ship.angle + Math.PI / 2);
    ctx.globalAlpha = 0.85;
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.fillStyle = 'rgba(10,18,32,0.75)';

    if (ship.type === 'hauler') {
      ctx.beginPath();
      ctx.moveTo(-size * 1.0, -size * 0.6);
      ctx.lineTo(size * 1.0, -size * 0.6);
      ctx.lineTo(size * 1.2, 0);
      ctx.lineTo(size * 1.0, size * 0.9);
      ctx.lineTo(-size * 1.0, size * 0.9);
      ctx.lineTo(-size * 1.2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = mixColor(color, '#0b1324', 0.4);
      ctx.beginPath();
      ctx.arc(size * 1.1, size * 0.2, size * 0.35, 0, Math.PI * 2);
      ctx.arc(-size * 1.1, size * 0.2, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = livery.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-size * 0.9, -size * 0.2);
      ctx.lineTo(size * 0.9, -size * 0.2);
      ctx.stroke();
    } else if (ship.type === 'freighter') {
      ctx.beginPath();
      ctx.moveTo(0, -size * 1.6);
      ctx.lineTo(size * 0.5, -size * 0.6);
      ctx.lineTo(size * 0.5, size * 1.2);
      ctx.lineTo(-size * 0.5, size * 1.2);
      ctx.lineTo(-size * 0.5, -size * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = mixColor(color, '#0b1324', 0.35);
      for (let i = 0; i < 3; i += 1) {
        const py = lerp(-size * 0.3, size * 0.9, i / 2);
        ctx.beginPath();
        ctx.rect(-size * 0.45, py, size * 0.9, size * 0.18);
        ctx.fill();
      }
      ctx.strokeStyle = livery.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-size * 0.55, -size * 0.9);
      ctx.lineTo(-size * 0.15, size * 1.1);
      ctx.moveTo(size * 0.55, -size * 0.9);
      ctx.lineTo(size * 0.15, size * 1.1);
      ctx.stroke();
    } else if (ship.type === 'liner') {
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.75, size * 1.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.9, -size * 0.2);
      ctx.lineTo(-size * 1.4, size * 0.4);
      ctx.lineTo(-size * 0.6, size * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(size * 0.9, -size * 0.2);
      ctx.lineTo(size * 1.4, size * 0.4);
      ctx.lineTo(size * 0.6, size * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = livery.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, size * 0.1, size * 0.9, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -size * 1.2);
      ctx.quadraticCurveTo(size * 0.65, -size * 0.4, size * 0.5, size * 0.55);
      ctx.lineTo(0, size * 0.95);
      ctx.lineTo(-size * 0.5, size * 0.55);
      ctx.quadraticCurveTo(-size * 0.65, -size * 0.4, 0, -size * 1.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(120,200,255,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.35, size * 0.22, size * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = livery.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-size * 0.15, -size * 0.9);
      ctx.lineTo(size * 0.15, -size * 0.3);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.6);
    ctx.lineTo(0, size * 0.7);
    ctx.stroke();
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = livery.secondary;
    ctx.beginPath();
    ctx.arc(-size * 0.3, size * 1.05, size * 0.12, 0, Math.PI * 2);
    ctx.arc(size * 0.3, size * 1.05, size * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFriendly(ship, camera) {
    const x = ship.x - camera.x + VIEW.centerX;
    const y = ship.y - camera.y + VIEW.centerY;
    const size = ship.size || 20;
    const color = getFactionColor(ship.faction, ship.color || IFF_COLORS.friendly);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ship.angle + Math.PI / 2);
    ctx.shadowBlur = 14;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.fillStyle = 'rgba(10,18,32,0.78)';

    if (ship.role === 'guardian') {
      ctx.beginPath();
      ctx.moveTo(0, -size * 1.3);
      ctx.lineTo(size * 0.85, -size * 0.2);
      ctx.lineTo(size * 0.9, size * 1.0);
      ctx.lineTo(0, size * 0.6);
      ctx.lineTo(-size * 0.9, size * 1.0);
      ctx.lineTo(-size * 0.85, -size * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = mixColor(color, '#0b1426', 0.4);
      ctx.beginPath();
      ctx.arc(size * 0.95, size * 0.2, size * 0.3, 0, Math.PI * 2);
      ctx.arc(-size * 0.95, size * 0.2, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (ship.role === 'patrol') {
      ctx.beginPath();
      ctx.moveTo(0, -size * 1.2);
      ctx.lineTo(size * 0.9, -size * 0.2);
      ctx.lineTo(size * 0.6, size * 0.9);
      ctx.lineTo(0, size * 0.45);
      ctx.lineTo(-size * 0.6, size * 0.9);
      ctx.lineTo(-size * 0.9, -size * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, -size * 1.1);
      ctx.quadraticCurveTo(size * 0.7, -size * 0.4, size * 0.8, size * 0.5);
      ctx.lineTo(0, size * 0.2);
      ctx.lineTo(-size * 0.8, size * 0.5);
      ctx.quadraticCurveTo(-size * 0.7, -size * 0.4, 0, -size * 1.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(-size * 0.4, 0);
    ctx.lineTo(size * 0.4, 0);
    ctx.stroke();
    ctx.fillStyle = 'rgba(154,214,255,0.6)';
    ctx.beginPath();
    ctx.arc(0, size * 0.9, size * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBase(base, camera) {
    const x = base.x - camera.x + VIEW.centerX;
    const y = base.y - camera.y + VIEW.centerY;
    const color = base.def.color;
    const type = base.def.id;
    const r = base.radius;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowBlur = 18;
    ctx.shadowColor = color;
    const coreGrad = ctx.createRadialGradient(0, -r * 0.4, r * 0.2, 0, 0, r * 1.1);
    coreGrad.addColorStop(0, mixColor(color, '#ffffff', 0.35));
    coreGrad.addColorStop(1, 'rgba(10,18,32,0.9)');
    ctx.fillStyle = coreGrad;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.2;

    ctx.beginPath();
    if (type === 'fortress') {
      for (let i = 0; i < 6; i += 1) {
        const a = (Math.PI * 2 * i) / 6;
        const rr = r * 0.95;
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
    } else if (type === 'refinery') {
      ctx.moveTo(0, -r * 0.95);
      ctx.lineTo(r * 0.8, -r * 0.2);
      ctx.lineTo(r * 0.6, r * 0.9);
      ctx.lineTo(-r * 0.6, r * 0.9);
      ctx.lineTo(-r * 0.8, -r * 0.2);
    } else if (type === 'relay') {
      ctx.moveTo(0, -r * 0.9);
      ctx.lineTo(r * 0.85, 0);
      ctx.lineTo(0, r * 0.9);
      ctx.lineTo(-r * 0.85, 0);
    } else {
      ctx.arc(0, 0, r, 0, Math.PI * 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
    ctx.stroke();

    const armCount = type === 'fortress' ? 6 : type === 'refinery' ? 4 : 5;
    ctx.strokeStyle = `rgba(255,255,255,0.2)`;
    ctx.lineWidth = 2;
    for (let i = 0; i < armCount; i += 1) {
      const angle = (Math.PI * 2 * i) / armCount;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * r * 0.35, Math.sin(angle) * r * 0.35);
      ctx.lineTo(Math.cos(angle) * r * 0.95, Math.sin(angle) * r * 0.95);
      ctx.stroke();
    }

    if (type === 'refinery') {
      ctx.fillStyle = mixColor(color, '#141d2b', 0.4);
      ctx.strokeStyle = color;
      [-1, 1].forEach((dir) => {
        ctx.beginPath();
        ctx.arc(dir * r * 0.9, r * 0.25, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }

    base.turrets.forEach((turret) => {
      ctx.save();
      ctx.rotate(turret.angle);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.95);
      ctx.lineTo(r * 0.08, -r * 0.75);
      ctx.lineTo(-r * 0.08, -r * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.8);
      ctx.lineTo(0, -r * 1.05);
      ctx.stroke();
      ctx.restore();
    });

    if (base.shield > 0) {
      ctx.strokeStyle = 'rgba(109,240,255,0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, r + 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCityHub(base, camera) {
    if (!base) return;
    const x = base.x - camera.x + VIEW.centerX;
    const y = base.y - camera.y + VIEW.centerY;
    ctx.save();
    ctx.translate(x, y);
    const color = base.color || '#6df0ff';
    const r = base.radius;
    ctx.shadowBlur = 22;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = 1.6;
    ctx.strokeStyle = 'rgba(109,240,255,0.65)';
    for (let i = 0; i < 8; i += 1) {
      const start = (Math.PI * 2 * i) / 8;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.85, start, start + Math.PI / 5.5);
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(109,240,255,0.4)';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = 'rgba(8,16,30,0.85)';
    ctx.strokeStyle = 'rgba(109,240,255,0.55)';
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI * 2 * i) / 6 + Math.PI / 6;
      const coreR = r * 0.28;
      const px = Math.cos(angle) * coreR;
      const py = Math.sin(angle) * coreR;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = 'rgba(109,240,255,0.3)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI * 2 * i) / 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * r * 0.5, Math.sin(angle) * r * 0.5);
      ctx.lineTo(Math.cos(angle) * r * 0.95, Math.sin(angle) * r * 0.95);
      ctx.stroke();
    }

    for (let i = 0; i < 4; i += 1) {
      ctx.save();
      ctx.rotate((Math.PI / 2) * i);
      ctx.fillStyle = 'rgba(109,240,255,0.18)';
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(-r * 0.08, -r * 0.96);
      ctx.lineTo(r * 0.08, -r * 0.96);
      ctx.lineTo(r * 0.16, -r * 0.72);
      ctx.lineTo(-r * 0.16, -r * 0.72);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    if (base.turrets) {
      base.turrets.forEach((turret) => {
        ctx.save();
        ctx.rotate(turret.angle);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.rect(-r * 0.05, -r * 0.98, r * 0.1, r * 0.18);
        ctx.fill();
        ctx.restore();
      });
    }

    if (base.shield > 0) {
      const shieldRatio = clamp(base.shield / (base.maxShield || 1), 0.2, 1);
      ctx.strokeStyle = `rgba(109,240,255,${0.2 + shieldRatio * 0.35})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(0, 0, r + 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
    }
    const distance = dist(player.x, player.y, base.x, base.y);
    if (distance < 300) {
      ctx.fillStyle = '#e0f2ff';
      ctx.font = '12px sans-serif';
      ctx.fillText(base.label, r + 10, -r - 8);
    }
    ctx.restore();
  }

  function drawCityHubs(camera, sector) {
    if (!world.cities || !world.cities.length) return;
    world.cities.forEach((city) => {
      const grid = gridFromPos(city.x, city.y);
      if (grid.gx !== sector.gx || grid.gy !== sector.gy) return;
      drawCityHub(city, camera);
    });
  }

  function drawWreck(wreck, camera) {
    const x = wreck.x - camera.x + VIEW.centerX;
    const y = wreck.y - camera.y + VIEW.centerY;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(200,200,200,0.35)';
    ctx.fillStyle = 'rgba(80,90,110,0.4)';
    ctx.beginPath();
    ctx.moveTo(-wreck.radius, -wreck.radius * 0.4);
    ctx.lineTo(wreck.radius * 0.6, -wreck.radius * 0.2);
    ctx.lineTo(wreck.radius * 0.3, wreck.radius * 0.6);
    ctx.lineTo(-wreck.radius * 0.5, wreck.radius * 0.4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawBiomeProp(prop, camera) {
    const x = prop.x - camera.x + VIEW.centerX;
    const y = prop.y - camera.y + VIEW.centerY;
    ctx.save();
    ctx.translate(x, y);
    const size = prop.size;
    const hue = prop.hue;
    const glow = `hsla(${hue},80%,65%,0.7)`;
    const core = `hsla(${hue + 10},70%,45%,0.85)`;
    const shadow = `hsla(${hue - 10},40%,18%,0.55)`;
    ctx.lineWidth = 1.6;
    ctx.shadowBlur = 10;
    ctx.shadowColor = glow;

    if (prop.type === 'ice_spires' || prop.type === 'obsidian_spires') {
      const grad = ctx.createLinearGradient(0, -size, 0, size);
      grad.addColorStop(0, core);
      grad.addColorStop(1, shadow);
      ctx.fillStyle = grad;
      ctx.strokeStyle = glow;
      for (let i = -1; i <= 1; i += 1) {
        const offset = i * size * 0.35;
        ctx.beginPath();
        ctx.moveTo(offset, -size * 0.9);
        ctx.lineTo(offset + size * 0.25, size * 0.6);
        ctx.lineTo(offset - size * 0.25, size * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (prop.type === 'glass_shards') {
      ctx.strokeStyle = glow;
      ctx.fillStyle = `hsla(${hue},60%,40%,0.5)`;
      for (let i = 0; i < 3; i += 1) {
        const offsetX = (i - 1) * size * 0.3;
        const offsetY = (i % 2 ? 1 : -1) * size * 0.15;
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY - size * 0.7);
        ctx.lineTo(offsetX + size * 0.4, offsetY - size * 0.1);
        ctx.lineTo(offsetX, offsetY + size * 0.6);
        ctx.lineTo(offsetX - size * 0.4, offsetY - size * 0.1);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    } else if (prop.type === 'prism_arches' || prop.type === 'wayline_arches') {
      ctx.strokeStyle = glow;
      ctx.fillStyle = `hsla(${hue},60%,32%,0.45)`;
      ctx.beginPath();
      ctx.moveTo(-size * 0.8, size * 0.3);
      ctx.lineTo(-size * 0.35, -size * 0.6);
      ctx.lineTo(size * 0.35, -size * 0.6);
      ctx.lineTo(size * 0.8, size * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(0, size * 0.25, size * 0.55, size * 0.2, 0, 0, Math.PI);
      ctx.stroke();
    } else if (prop.type === 'ion_pylons' || prop.type === 'defense_pylons' || prop.type === 'flare_towers' || prop.type === 'arc_emitters' || prop.type === 'relay_spires') {
      ctx.strokeStyle = glow;
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.rect(-size * 0.3, -size * 0.85, size * 0.6, size * 1.5);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -size * 0.85, size * 0.28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, size * 0.3, size * 0.35, 0, Math.PI * 2);
      ctx.stroke();
    } else if (prop.type === 'plasma_flares' || prop.type === 'ember_flows') {
      ctx.strokeStyle = glow;
      ctx.fillStyle = `hsla(${hue + 5},70%,50%,0.45)`;
      ctx.beginPath();
      ctx.moveTo(-size * 0.7, size * 0.1);
      ctx.quadraticCurveTo(0, -size * 0.9, size * 0.7, size * 0.1);
      ctx.quadraticCurveTo(0, size * 0.8, -size * 0.7, size * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (prop.type === 'shadow_mines' || prop.type === 'void_buoys') {
      ctx.strokeStyle = glow;
      ctx.fillStyle = 'rgba(20,26,40,0.7)';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.7, 0);
      ctx.lineTo(size * 0.7, 0);
      ctx.moveTo(0, -size * 0.7);
      ctx.lineTo(0, size * 0.7);
      ctx.stroke();
    } else if (prop.type === 'debris_cluster' || prop.type === 'ash_ruins') {
      ctx.strokeStyle = glow;
      ctx.fillStyle = `hsla(${hue},35%,30%,0.5)`;
      for (let i = 0; i < 5; i += 1) {
        const angle = (Math.PI * 2 * i) / 5;
        const r = size * 0.45;
        ctx.beginPath();
        ctx.rect(Math.cos(angle) * r, Math.sin(angle) * r, size * 0.25, size * 0.2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (prop.type === 'silent_monoliths') {
      ctx.strokeStyle = glow;
      ctx.fillStyle = `hsla(${hue},30%,18%,0.6)`;
      ctx.beginPath();
      ctx.rect(-size * 0.3, -size * 0.95, size * 0.6, size * 1.9);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = `hsla(${hue + 20},60%,65%,0.3)`;
      ctx.beginPath();
      ctx.moveTo(-size * 0.15, -size * 0.6);
      ctx.lineTo(size * 0.15, -size * 0.1);
      ctx.lineTo(-size * 0.05, size * 0.4);
      ctx.stroke();
    } else if (prop.type === 'light_fins' || prop.type === 'ice_rings') {
      ctx.strokeStyle = glow;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 0, size * 0.8, size * 0.32, 0.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size * 0.4, -size * 0.1);
      ctx.lineTo(size * 0.4, size * 0.1);
      ctx.stroke();
      ctx.lineWidth = 1.6;
    } else if (prop.type === 'forge_fragments' || prop.type === 'relic_spires' || prop.type === 'echo_stones') {
      ctx.strokeStyle = glow;
      ctx.fillStyle = `hsla(${hue},40%,25%,0.6)`;
      ctx.beginPath();
      ctx.moveTo(-size * 0.55, -size * 0.2);
      ctx.lineTo(0, -size * 0.8);
      ctx.lineTo(size * 0.6, -size * 0.1);
      ctx.lineTo(size * 0.3, size * 0.7);
      ctx.lineTo(-size * 0.45, size * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -size * 0.25, size * 0.18, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      ctx.strokeStyle = glow;
      ctx.fillStyle = shadow;
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawRuin(ruin, camera) {
    const x = ruin.x - camera.x + VIEW.centerX;
    const y = ruin.y - camera.y + VIEW.centerY;
    const isVault = ruin.tier === 'vault';
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = isVault
      ? 'rgba(154,214,255,0.8)'
      : ruin.guarded
        ? 'rgba(255,107,107,0.8)'
        : 'rgba(255,210,140,0.7)';
    ctx.fillStyle = isVault ? 'rgba(40,60,90,0.6)' : 'rgba(60,70,90,0.5)';
    ctx.lineWidth = isVault ? 2.6 : 2;
    ctx.beginPath();
    ctx.arc(0, 0, ruin.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (isVault) {
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, ruin.radius * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6;
        const r = ruin.radius * 0.75;
        if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(-ruin.radius * 0.6, 0);
      ctx.lineTo(ruin.radius * 0.6, 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawLandmark(landmark, camera) {
    const x = landmark.x - camera.x + VIEW.centerX;
    const y = landmark.y - camera.y + VIEW.centerY;
    const r = landmark.radius;
    const glow = landmark.color || '#9ad6ff';
    const pulse = 0.7 + Math.sin(state.time * 1.2 + x * 0.002) * 0.3;
    ctx.save();
    ctx.translate(x, y);
    ctx.shadowBlur = 18;
    ctx.shadowColor = glow;
    ctx.strokeStyle = glow;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = 'rgba(14,22,36,0.65)';

    switch (landmark.type) {
      case 'drift_relay': {
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.8);
        ctx.lineTo(r * 0.35, -r * 0.2);
        ctx.lineTo(0, r * 0.6);
        ctx.lineTo(-r * 0.35, -r * 0.2);
        ctx.closePath();
        ctx.fill();
        for (let i = 0; i < 3; i += 1) {
          const angle = (Math.PI * 2 * i) / 3;
          const tip = { x: Math.cos(angle) * r * 1.1, y: Math.sin(angle) * r * 1.1 };
          const left = { x: Math.cos(angle - 0.25) * r * 0.6, y: Math.sin(angle - 0.25) * r * 0.6 };
          const right = { x: Math.cos(angle + 0.25) * r * 0.6, y: Math.sin(angle + 0.25) * r * 0.6 };
          ctx.beginPath();
          ctx.moveTo(tip.x, tip.y);
          ctx.lineTo(left.x, left.y);
          ctx.lineTo(right.x, right.y);
          ctx.closePath();
          ctx.stroke();
        }
        break;
      }
      case 'glass_obelisk': {
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.9);
        ctx.lineTo(r * 0.45, 0);
        ctx.lineTo(0, r * 0.9);
        ctx.lineTo(-r * 0.45, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 0.4 * pulse;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'storm_array': {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.strokeStyle = `rgba(255,255,255,${0.25 + pulse * 0.2})`;
        for (let i = 0; i < 4; i += 1) {
          const angle = (Math.PI * 2 * i) / 4 + state.time * 0.2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * r * 0.3, Math.sin(angle) * r * 0.3);
          ctx.lineTo(Math.cos(angle) * r * 1.05, Math.sin(angle) * r * 1.05);
          ctx.stroke();
        }
        break;
      }
      case 'redshift_anchor': {
        ctx.beginPath();
        ctx.moveTo(-r * 0.5, -r * 0.1);
        ctx.lineTo(0, -r * 0.75);
        ctx.lineTo(r * 0.5, -r * 0.1);
        ctx.lineTo(r * 0.35, r * 0.65);
        ctx.lineTo(-r * 0.35, r * 0.65);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'bastion_fort': {
        ctx.beginPath();
        for (let i = 0; i < 6; i += 1) {
          const angle = (Math.PI * 2 * i) / 6;
          const px = Math.cos(angle) * r * 0.75;
          const py = Math.sin(angle) * r * 0.75;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'darklane_shrine': {
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.8);
        ctx.lineTo(r * 0.25, 0);
        ctx.lineTo(0, r * 0.8);
        ctx.lineTo(-r * 0.25, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 0.3 * pulse;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'forge_gate': {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 3;
        for (let i = 0; i < 5; i += 1) {
          const angle = (Math.PI * 2 * i) / 5 + state.time * 0.15;
          ctx.beginPath();
          ctx.moveTo(Math.cos(angle) * r * 0.35, Math.sin(angle) * r * 0.35);
          ctx.lineTo(Math.cos(angle) * r * 1.05, Math.sin(angle) * r * 1.05);
          ctx.stroke();
        }
        break;
      }
      case 'echo_temple': {
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 0.4 * pulse;
        for (let i = 1; i <= 3; i += 1) {
          ctx.beginPath();
          ctx.arc(0, 0, r * (0.5 + i * 0.18), 0, Math.PI * 2);
          ctx.stroke();
        }
        break;
      }
      case 'ember_ruin': {
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, -r * 0.4);
        ctx.lineTo(r * 0.2, -r * 0.8);
        ctx.lineTo(r * 0.6, 0);
        ctx.lineTo(r * 0.2, r * 0.8);
        ctx.lineTo(-r * 0.6, r * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'prism_temple': {
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, r * 0.5);
        ctx.lineTo(0, -r * 0.9);
        ctx.lineTo(r * 0.6, r * 0.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 0.35 * pulse;
        ctx.beginPath();
        ctx.moveTo(-r * 0.4, r * 0.2);
        ctx.lineTo(0, -r * 0.6);
        ctx.lineTo(r * 0.4, r * 0.2);
        ctx.closePath();
        ctx.stroke();
        break;
      }
      case 'blackout_core': {
        ctx.fillStyle = 'rgba(8,12,24,0.7)';
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 0.4 * pulse;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }
      case 'interstice_derelict':
      default: {
        ctx.beginPath();
        ctx.moveTo(-r * 0.7, -r * 0.3);
        ctx.lineTo(r * 0.4, -r * 0.6);
        ctx.lineTo(r * 0.7, r * 0.1);
        ctx.lineTo(-r * 0.2, r * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
    }
    ctx.restore();
  }

  function drawRiftBeacon(beacon, camera) {
    const x = beacon.x - camera.x + VIEW.centerX;
    const y = beacon.y - camera.y + VIEW.centerY;
    const pulse = 0.6 + Math.sin(state.time * 2 + beacon.pulse) * 0.4;
    ctx.save();
    ctx.translate(x, y);
    const glow = beacon.color || 'rgba(125,252,154,0.5)';
    ctx.strokeStyle = glow;
    ctx.globalAlpha = 0.35 + pulse * 0.35;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, beacon.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, beacon.radius * 0.5 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawSurveyBeacon(beacon, camera) {
    const x = beacon.x - camera.x + VIEW.centerX;
    const y = beacon.y - camera.y + VIEW.centerY;
    const pulse = 0.6 + Math.sin(state.time * 2.1 + beacon.pulse) * 0.4;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(199,125,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, beacon.radius + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(199,125,255,0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, beacon.radius * 0.55, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(199,125,255,0.15)';
    ctx.beginPath();
    ctx.arc(0, 0, beacon.radius * 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawStar(star, camera) {
    const x = star.x - camera.x + VIEW.centerX;
    const y = star.y - camera.y + VIEW.centerY;
    const pulse = 0.7 + Math.sin(state.time * 0.5 + star.radius) * 0.3;
    const hue = star.hue || 40;
    const corona = star.corona || star.radius * 1.7;
    ctx.save();
    ctx.translate(x, y);
    const glow = ctx.createRadialGradient(0, 0, star.radius * 0.2, 0, 0, corona);
    glow.addColorStop(0, `hsla(${hue},85%,65%,0.95)`);
    glow.addColorStop(0.6, `hsla(${hue + 15},80%,55%,0.35)`);
    glow.addColorStop(1, `hsla(${hue + 25},90%,50%,0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, corona * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `hsla(${hue},80%,60%,0.9)`;
    ctx.beginPath();
    ctx.arc(0, 0, star.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, star.radius * 0.92, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = `hsla(${hue + 10},90%,70%,0.45)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-star.radius * 1.25, 0);
    ctx.lineTo(star.radius * 1.25, 0);
    ctx.moveTo(0, -star.radius * 1.25);
    ctx.lineTo(0, star.radius * 1.25);
    ctx.stroke();
    ctx.restore();
  }

  function drawSlipstream(stream, camera) {
    const x = stream.x - camera.x + VIEW.centerX;
    const y = stream.y - camera.y + VIEW.centerY;
    const sway = Math.sin(state.time * 0.7 + stream.phase) * stream.radius * 0.2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(stream.angle);
    ctx.strokeStyle = 'rgba(154,214,255,0.55)';
    ctx.lineWidth = Math.max(2, stream.radius * 0.08);
    ctx.beginPath();
    ctx.moveTo(-stream.length / 2, 0);
    ctx.quadraticCurveTo(0, sway, stream.length / 2, 0);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(154,214,255,0.25)';
    ctx.lineWidth = Math.max(1, stream.radius * 0.03);
    ctx.beginPath();
    ctx.moveTo(-stream.length / 2, stream.radius * 0.15);
    ctx.quadraticCurveTo(0, sway + stream.radius * 0.15, stream.length / 2, stream.radius * 0.15);
    ctx.stroke();
    ctx.restore();
  }

  function drawTradeRoute(route, camera) {
    if (!route || route.hidden) return;
    const x1 = route.x1 - camera.x + VIEW.centerX;
    const y1 = route.y1 - camera.y + VIEW.centerY;
    const x2 = route.x2 - camera.x + VIEW.centerX;
    const y2 = route.y2 - camera.y + VIEW.centerY;
    const offset = route.width ? route.width * 0.18 : 24;
    const nx = route.nx || 0;
    const ny = route.ny || 0;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.strokeStyle = 'rgba(109,240,255,0.2)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([12, 10]);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(109,240,255,0.08)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x1 + nx * offset, y1 + ny * offset);
    ctx.lineTo(x2 + nx * offset, y2 + ny * offset);
    ctx.moveTo(x1 - nx * offset, y1 - ny * offset);
    ctx.lineTo(x2 - nx * offset, y2 - ny * offset);
    ctx.stroke();
    ctx.restore();
  }

  function drawSectorObjects(sector, camera) {
    sector.objects.stars.forEach((star) => drawStar(star, camera));
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

      ctx.strokeStyle = `rgba(255,255,255,0.25)`;
      ctx.beginPath();
      ctx.arc(x, y, planet.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
      if (planet.ring) {
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(x, y, planet.radius * 1.6, planet.radius * 0.5, 0.2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    });

    sector.objects.storms.forEach((storm) => {
      const x = storm.x - camera.x + VIEW.centerX;
      const y = storm.y - camera.y + VIEW.centerY;
      ctx.fillStyle = `rgba(90,160,255,${storm.intensity * 0.2})`;
      ctx.beginPath();
      ctx.arc(x, y, storm.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    sector.objects.slipstreams.forEach((stream) => drawSlipstream(stream, camera));
    sector.objects.tradeRoutes.forEach((route) => drawTradeRoute(route, camera));

    sector.objects.asteroids.forEach((asteroid) => drawAsteroid(asteroid, camera));
    sector.objects.stations.forEach((station) => drawStation(station, camera));
    sector.objects.traders.forEach((trader) => drawTrader(trader, camera));
    sector.objects.civilians.forEach((ship) => drawCivilian(ship, camera));
    sector.objects.friendlies.forEach((ship) => drawFriendly(ship, camera));
    sector.objects.bases.forEach((base) => drawBase(base, camera));
    sector.objects.wrecks.forEach((wreck) => drawWreck(wreck, camera));
    sector.objects.biomeProps.forEach((prop) => drawBiomeProp(prop, camera));
    sector.objects.ruins.forEach((ruin) => {
      if (world.ruinClaims?.[sector.key]) return;
      drawRuin(ruin, camera);
    });
    sector.objects.landmarks.forEach((landmark) => {
      if (world.landmarkClaims?.[sector.key]) return;
      drawLandmark(landmark, camera);
    });
    sector.objects.riftBeacons.forEach((beacon) => drawRiftBeacon(beacon, camera));
    sector.objects.surveyBeacons.forEach((beacon) => {
      if (world.beaconClaims?.[sector.key]) return;
      drawSurveyBeacon(beacon, camera);
    });
    drawEvents(sector, camera);
    const gate = getGateData();
    if (gate && gate.key === sector.key) {
      const gx = gate.x - camera.x + VIEW.centerX;
      const gy = gate.y - camera.y + VIEW.centerY;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,209,102,0.8)';
      ctx.lineWidth = 3;
      ctx.shadowBlur = 18;
      ctx.shadowColor = 'rgba(255,209,102,0.8)';
      ctx.beginPath();
      ctx.arc(gx, gy, 70, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,209,102,0.4)';
      ctx.beginPath();
      ctx.arc(gx, gy, 90, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffd166';
      ctx.font = '12px sans-serif';
      ctx.fillText('Relay Gate', gx + 96, gy - 10);
      ctx.restore();
    }
    drawCityHubs(camera, sector);

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

  function drawFactionEmblem(factionId, size, color) {
    if (!factionId) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.fillStyle = mixColor(color, '#0b1424', 0.55);
    if (factionId === 'aetherline') {
      ctx.beginPath();
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.7, 0);
      ctx.lineTo(0, size);
      ctx.lineTo(-size * 0.7, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (factionId === 'ion_clade') {
      ctx.beginPath();
      ctx.moveTo(0, -size * 1.1);
      ctx.lineTo(size, size * 0.9);
      ctx.lineTo(-size, size * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (factionId === 'redshift_cartel') {
      ctx.beginPath();
      ctx.moveTo(-size * 0.9, -size * 0.6);
      ctx.lineTo(size * 0.9, -size * 0.6);
      ctx.lineTo(size * 0.4, size * 0.9);
      ctx.lineTo(-size * 0.4, size * 0.9);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (factionId === 'bastion_order') {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI * 2 * i) / 6;
        const r = size;
        if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (factionId === 'darklane_refuge') {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(-size * 0.4, 0);
      ctx.lineTo(size * 0.4, 0);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
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

    if (player.affiliation) {
      ctx.save();
      ctx.translate(0, -h * 0.05);
      drawFactionEmblem(player.affiliation, w * 0.12, getFactionColor(player.affiliation, '#6df0ff'));
      ctx.restore();
    }

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

    ctx.fillStyle = 'rgba(125,252,154,0.35)';
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, h * 0.2);
    ctx.lineTo(-w * 0.9, h * 0.5);
    ctx.lineTo(-w * 0.4, h * 0.45);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.5, h * 0.2);
    ctx.lineTo(w * 0.9, h * 0.5);
    ctx.lineTo(w * 0.4, h * 0.45);
    ctx.closePath();
    ctx.fill();

    if (state.shiftBoost.active) {
      ctx.fillStyle = 'rgba(125,252,154,0.8)';
      ctx.beginPath();
      ctx.ellipse(0, h * 0.72, w * 0.2, h * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    if (player.shield > 0) {
      ctx.strokeStyle = 'rgba(109,240,255,0.4)';
      ctx.beginPath();
      ctx.arc(px, py, hull.size + 8, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawEnemy(enemy, camera, sector) {
    const x = enemy.x - camera.x + VIEW.centerX;
    const y = enemy.y - camera.y + VIEW.centerY;
    const accent = sector ? BIOMES[sector.biome].accent : PALETTE.glow;
    const fallback = enemy.isBoss ? PALETTE.ember : enemy.def?.color || PALETTE.rose;
    const factionColor = getFactionColor(enemy.faction, fallback);
    const baseColor = mixColor(fallback, factionColor, enemy.isBoss ? 0.2 : 0.45);
    const size = enemy.size;
    const variant = enemy.variant || 0;
    const trim = enemy.trim ?? 0.5;
    const hullColor = mixColor(baseColor, accent, enemy.isBoss ? 0.15 : 0.28);
    const highlight = mixColor(baseColor, '#ffffff', 0.35);
    const shade = mixColor(baseColor, '#05080f', 0.4);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(enemy.angle || 0);
    ctx.shadowBlur = enemy.isBoss ? 22 : 12;
    ctx.shadowColor = hullColor;

    const hullGrad = ctx.createLinearGradient(0, -size * 1.3, 0, size * 1.2);
    hullGrad.addColorStop(0, highlight);
    hullGrad.addColorStop(0.55, hullColor);
    hullGrad.addColorStop(1, shade);
    ctx.fillStyle = hullGrad;

    ctx.beginPath();
    if (enemy.isBoss) {
      ctx.moveTo(0, -size * 1.2);
      ctx.quadraticCurveTo(size * 1.35, -size * 0.5, size * 1.05, size * 0.9);
      ctx.lineTo(size * 0.3, size * 0.55);
      ctx.lineTo(0, size * 0.8);
      ctx.lineTo(-size * 0.3, size * 0.55);
      ctx.lineTo(-size * 1.05, size * 0.9);
      ctx.quadraticCurveTo(-size * 1.35, -size * 0.5, 0, -size * 1.2);
    } else if (enemy.role === 'scout') {
      const nose = size * (1.2 + variant * 0.08);
      const wing = size * (0.65 + variant * 0.1);
      ctx.moveTo(0, -nose);
      ctx.quadraticCurveTo(wing, -size * 0.45, wing * 1.1, size * 0.35);
      ctx.lineTo(0, size * 0.2);
      ctx.lineTo(-wing * 1.1, size * 0.35);
      ctx.quadraticCurveTo(-wing, -size * 0.45, 0, -nose);
    } else if (enemy.role === 'interceptor') {
      ctx.moveTo(0, -size * 1.25);
      ctx.lineTo(size * 0.55, -size * 0.3);
      ctx.lineTo(size * 1.0, size * 0.75);
      ctx.lineTo(0, size * 0.35);
      ctx.lineTo(-size * 1.0, size * 0.75);
      ctx.lineTo(-size * 0.55, -size * 0.3);
    } else if (enemy.role === 'fighter') {
      ctx.moveTo(0, -size * 1.1);
      ctx.quadraticCurveTo(size * 0.85, -size * 0.45, size * 1.0, size * 0.5);
      ctx.lineTo(size * 0.45, size * 0.95);
      ctx.lineTo(0, size * 0.45);
      ctx.lineTo(-size * 0.45, size * 0.95);
      ctx.lineTo(-size * 1.0, size * 0.5);
      ctx.quadraticCurveTo(-size * 0.85, -size * 0.45, 0, -size * 1.1);
    } else if (enemy.role === 'gunship') {
      ctx.moveTo(0, -size * 0.95);
      ctx.quadraticCurveTo(size * 1.0, -size * 0.7, size * 1.05, size * 0.25);
      ctx.lineTo(size * 0.55, size * 1.0);
      ctx.lineTo(-size * 0.55, size * 1.0);
      ctx.lineTo(-size * 1.05, size * 0.25);
      ctx.quadraticCurveTo(-size * 1.0, -size * 0.7, 0, -size * 0.95);
    } else if (enemy.role === 'bomber') {
      ctx.moveTo(0, -size * 0.9);
      ctx.lineTo(size * 1.0, -size * 0.2);
      ctx.lineTo(size * 0.75, size * 1.0);
      ctx.lineTo(-size * 0.75, size * 1.0);
      ctx.lineTo(-size * 1.0, -size * 0.2);
    } else if (enemy.role === 'sniper') {
      ctx.moveTo(0, -size * 1.4);
      ctx.lineTo(size * 0.35, size * 0.7);
      ctx.lineTo(0, size * 0.95);
      ctx.lineTo(-size * 0.35, size * 0.7);
    } else if (enemy.role === 'turret') {
      const points = 6;
      for (let i = 0; i < points; i += 1) {
        const a = (Math.PI * 2 * i) / points;
        const r = size * 0.85;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
    } else if (enemy.role === 'transport') {
      ctx.moveTo(-size * 1.3, -size * 0.55);
      ctx.lineTo(size * 1.3, -size * 0.55);
      ctx.lineTo(size * 1.1, size * 0.6);
      ctx.lineTo(-size * 1.1, size * 0.6);
    } else if (enemy.role === 'carrier') {
      ctx.moveTo(0, -size * 1.25);
      ctx.lineTo(size * 1.45, size * 0.65);
      ctx.lineTo(size * 0.5, size * 0.5);
      ctx.lineTo(0, size * 0.9);
      ctx.lineTo(-size * 0.5, size * 0.5);
      ctx.lineTo(-size * 1.45, size * 0.65);
    } else {
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.7, size);
      ctx.lineTo(-size * 0.7, size);
    }
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = mixColor(hullColor, '#ffffff', 0.35);
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    if (enemy.role === 'bomber' || enemy.role === 'gunship') {
      ctx.moveTo(-size * 0.6, 0);
      ctx.lineTo(size * 0.6, 0);
      ctx.moveTo(0, -size * 0.4);
      ctx.lineTo(0, size * 0.6);
    } else if (enemy.role === 'interceptor' || enemy.role === 'fighter') {
      ctx.moveTo(-size * 0.4, -size * 0.1);
      ctx.lineTo(size * 0.4, -size * 0.1);
      ctx.moveTo(0, -size * 0.6);
      ctx.lineTo(0, size * 0.4);
    } else if (enemy.role === 'transport' || enemy.role === 'carrier') {
      ctx.moveTo(-size * 0.9, -size * 0.2);
      ctx.lineTo(size * 0.9, -size * 0.2);
      ctx.moveTo(-size * 0.6, size * 0.35);
      ctx.lineTo(size * 0.6, size * 0.35);
    } else if (enemy.role === 'turret') {
      ctx.moveTo(-size * 0.4, 0);
      ctx.lineTo(size * 0.4, 0);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = mixColor(accent, '#ffffff', 0.4);
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (enemy.role === 'interceptor' || enemy.role === 'fighter') {
      ctx.moveTo(-size * 0.7, size * 0.15);
      ctx.lineTo(-size * 1.05, size * 0.55);
      ctx.moveTo(size * 0.7, size * 0.15);
      ctx.lineTo(size * 1.05, size * 0.55);
    } else if (enemy.role === 'scout') {
      ctx.moveTo(-size * 0.55, size * 0.05);
      ctx.lineTo(-size * 0.9, size * 0.4);
      ctx.moveTo(size * 0.55, size * 0.05);
      ctx.lineTo(size * 0.9, size * 0.4);
    } else if (enemy.role === 'gunship' || enemy.role === 'bomber') {
      ctx.moveTo(-size * 0.55, size * 0.2);
      ctx.lineTo(-size * 0.9, size * 0.75);
      ctx.moveTo(size * 0.55, size * 0.2);
      ctx.lineTo(size * 0.9, size * 0.75);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (enemy.role === 'scout' || enemy.role === 'interceptor' || enemy.role === 'fighter' || enemy.role === 'gunship') {
      ctx.fillStyle = `rgba(220,240,255,${0.35 + trim * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(0, -size * 0.3, size * 0.2, size * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, -size * 0.5);
    ctx.lineTo(0, size * 0.6);
    ctx.stroke();

    if (enemy.role === 'transport' || enemy.role === 'carrier') {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.rect(-size * 0.25, -size * 0.05, size * 0.5, size * 0.55);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.strokeRect(-size * 0.45, size * 0.15, size * 0.9, size * 0.3);

      const podCount = enemy.role === 'carrier' ? 3 : 2;
      ctx.fillStyle = mixColor(accent, '#ffffff', 0.25);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < podCount; i += 1) {
        const t = podCount === 1 ? 0 : i / (podCount - 1);
        const py = lerp(-size * 0.1, size * 0.45, t);
        const px = size * (enemy.role === 'carrier' ? 0.95 : 0.8);
        ctx.beginPath();
        ctx.arc(px, py, size * 0.14, 0, Math.PI * 2);
        ctx.arc(-px, py, size * 0.14, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px + size * 0.18, py - size * 0.04);
        ctx.moveTo(-px, py);
        ctx.lineTo(-px - size * 0.18, py - size * 0.04);
        ctx.stroke();
      }
    }
    if (enemy.role === 'sniper') {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.rect(-size * 0.08, -size * 0.95, size * 0.16, size * 1.4);
      ctx.fill();
    }
    if (enemy.role === 'carrier') {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(-size * 0.7, size * 0.2, size * 0.22, 0, Math.PI * 2);
      ctx.arc(size * 0.7, size * 0.2, size * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    if (enemy.role === 'turret') {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.35, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.rect(-size * 0.08, -size * 0.6, size * 0.16, size * 0.5);
      ctx.fill();
    }

    const engineColor = enemy.isBoss ? 'rgba(255,200,160,0.85)' : 'rgba(255,200,160,0.65)';
    ctx.fillStyle = engineColor;
    ctx.shadowBlur = 10;
    ctx.shadowColor = engineColor;
    const engines = [];
    if (enemy.isBoss) engines.push([-size * 0.7, size * 0.85], [size * 0.7, size * 0.85]);
    if (enemy.role === 'scout') engines.push([0, size * 0.7]);
    if (enemy.role === 'interceptor') engines.push([-size * 0.35, size * 0.75], [size * 0.35, size * 0.75]);
    if (enemy.role === 'fighter') engines.push([-size * 0.45, size * 0.75], [size * 0.45, size * 0.75]);
    if (enemy.role === 'gunship' || enemy.role === 'bomber') engines.push([-size * 0.5, size * 0.85], [size * 0.5, size * 0.85]);
    if (enemy.role === 'transport') engines.push([-size * 0.75, size * 0.7], [size * 0.75, size * 0.7]);
    if (enemy.role === 'carrier') engines.push([-size * 0.85, size * 0.9], [0, size * 0.95], [size * 0.85, size * 0.9]);
    if (enemy.role === 'sniper') engines.push([0, size * 0.8]);
    engines.forEach((engine) => {
      ctx.beginPath();
      ctx.arc(engine[0], engine[1], size * (enemy.role === 'carrier' ? 0.12 : 0.1), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    if (enemy.isBoss && enemy.shield > 0) {
      ctx.strokeStyle = 'rgba(125,252,154,0.6)';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.size + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEntities(camera, sector) {
    entities.loot.forEach((drop) => {
      const x = drop.x - camera.x + VIEW.centerX;
      const y = drop.y - camera.y + VIEW.centerY;
      ctx.fillStyle = drop.type === 'credits'
        ? PALETTE.gold
        : drop.type === 'data'
          ? PALETTE.ice
          : drop.type === 'salvage'
            ? '#c7b28a'
            : drop.type === 'ammo'
              ? '#ff9f6b'
              : PALETTE.glow;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    entities.projectiles.forEach((shot) => {
      const x = shot.x - camera.x + VIEW.centerX;
      const y = shot.y - camera.y + VIEW.centerY;
      ctx.fillStyle = shot.color;
      ctx.beginPath();
      const radius = shot.mine ? 6 : shot.splash ? 4 : 2;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      if (shot.mine) {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.beginPath();
        ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    entities.enemyShots.forEach((shot) => {
      const x = shot.x - camera.x + VIEW.centerX;
      const y = shot.y - camera.y + VIEW.centerY;
      ctx.fillStyle = shot.color;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
      if (shot.capture) {
        ctx.strokeStyle = 'rgba(154,214,255,0.6)';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.stroke();
      }
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
      drawEnemy(enemy, camera, sector);
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

    const viewRadius = 6;
    const centerGrid = gridFromPos(player.x, player.y);
    const cells = viewRadius * 2 + 1;
    const cellSize = mapSize / cells;

    for (let dx = -viewRadius; dx <= viewRadius; dx += 1) {
      for (let dy = -viewRadius; dy <= viewRadius; dy += 1) {
        const gx = centerGrid.gx + dx;
        const gy = centerGrid.gy + dy;
        if (gx < -WORLD.gridRadius || gx > WORLD.gridRadius || gy < -WORLD.gridRadius || gy > WORLD.gridRadius) continue;
        const sector = getSector(gx, gy);
        const cellX = mapX + (dx + viewRadius) * cellSize;
        const cellY = mapY + (dy + viewRadius) * cellSize;
        const visible = sector.discovered || sector.revealedUntil > state.time;
        if (!visible) {
          ctx.fillStyle = 'rgba(80,90,110,0.25)';
        } else if (sector.isVoid) {
          ctx.fillStyle = 'rgba(30,40,60,0.55)';
        } else if (sector.zoneType === 'rift') {
          ctx.fillStyle = 'rgba(255,209,102,0.7)';
        } else if (sector.zoneType === 'expanse') {
          ctx.fillStyle = 'rgba(154,214,255,0.55)';
        } else if (sector.zoneType === 'lane') {
          ctx.fillStyle = 'rgba(125,252,154,0.6)';
        } else {
          ctx.fillStyle = 'rgba(109,240,255,0.6)';
        }
        ctx.fillRect(cellX + 1, cellY + 1, cellSize - 2, cellSize - 2);
        if (sector.gateChapter) {
          ctx.strokeStyle = PALETTE.gold;
          ctx.strokeRect(cellX + 1, cellY + 1, cellSize - 2, cellSize - 2);
        }
        if (sector.objects.bases.length && !world.baseClaims?.[sector.key]) {
          ctx.fillStyle = 'rgba(255,107,107,0.85)';
          ctx.fillRect(cellX + cellSize * 0.35, cellY + cellSize * 0.35, cellSize * 0.3, cellSize * 0.3);
        }
        if (sector.objects.stations.length) {
          const hasWaystation = sector.objects.stations.some((station) => station.type === 'waystation');
          const isHub = sector.objects.stations.some((station) => station.hub || station.type === 'relay' || station.type === 'waystation');
          ctx.fillStyle = hasWaystation ? 'rgba(154,214,255,0.75)' : isHub ? 'rgba(154,214,255,0.85)' : 'rgba(125,252,154,0.7)';
          ctx.beginPath();
          ctx.arc(cellX + cellSize * 0.6, cellY + cellSize * 0.35, cellSize * 0.15, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    const playerX = mapX + viewRadius * cellSize + cellSize * 0.5;
    const playerY = mapY + viewRadius * cellSize + cellSize * 0.5;
    ctx.fillStyle = PALETTE.ember;
    ctx.beginPath();
    ctx.arc(playerX, playerY, 3, 0, Math.PI * 2);
    ctx.fill();

    const sector = getCurrentSector();
    // Encounters are discovered via Signal Scope, not map pings.

    if (world.homeBase) {
      const homeGrid = gridFromPos(world.homeBase.x, world.homeBase.y);
      const hx = homeGrid.gx - centerGrid.gx;
      const hy = homeGrid.gy - centerGrid.gy;
      if (Math.abs(hx) <= viewRadius && Math.abs(hy) <= viewRadius) {
        const homeX = mapX + (hx + viewRadius) * cellSize + cellSize * 0.5;
        const homeY = mapY + (hy + viewRadius) * cellSize + cellSize * 0.5;
        ctx.fillStyle = 'rgba(109,240,255,0.9)';
        ctx.beginPath();
        ctx.arc(homeX, homeY, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (state.atlasUnlocked && world.convergenceGate) {
      const gateGrid = gridFromPos(world.convergenceGate.x, world.convergenceGate.y);
      const gx = gateGrid.gx - centerGrid.gx;
      const gy = gateGrid.gy - centerGrid.gy;
      if (Math.abs(gx) <= viewRadius && Math.abs(gy) <= viewRadius) {
        const gateX = mapX + (gx + viewRadius) * cellSize + cellSize * 0.5;
        const gateY = mapY + (gy + viewRadius) * cellSize + cellSize * 0.5;
        ctx.strokeStyle = 'rgba(154,214,255,0.9)';
        ctx.beginPath();
        ctx.arc(gateX, gateY, 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  function drawShipStatus() {
    const hudAlpha = getHudAlpha();
    ctx.save();
    ctx.globalAlpha = hudAlpha;
    const panelTop = VIEW.height - 138;
    ctx.fillStyle = 'rgba(5,10,18,0.55)';
    ctx.fillRect(12, panelTop, 300, 128);
    ctx.strokeStyle = 'rgba(125,252,154,0.3)';
    ctx.strokeRect(12, panelTop, 300, 128);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '12px sans-serif';
    let lineY = panelTop + 18;
    if (state.inNoFireZone) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText('NO-FIRE ZONE', 22, lineY);
      ctx.fillStyle = PALETTE.glow;
      lineY += 16;
    }
    const heatValue = player.heat || 0;
    const heatPct = Math.round((heatValue / HEAT.max) * 100);
    const heatColor = heatPct >= 90 ? '#ff6b6b' : heatPct >= 70 ? '#ffd166' : '#7dfc9a';
    ctx.fillStyle = heatColor;
    ctx.fillText(`Heat ${heatPct}%`, 22, lineY);
    ctx.fillStyle = PALETTE.glow;
    lineY += 16;
    ctx.fillText(`Hull ${Math.round(player.hp)}/${Math.round(cachedStats.maxHp)}`, 22, lineY);
    lineY += 16;
    ctx.fillText(`Shield ${Math.round(player.shield)}/${Math.round(cachedStats.maxShield)}`, 22, lineY);
    lineY += 16;
    ctx.fillText(`Energy ${Math.round(player.energy)}/${Math.round(cachedStats.energyMax)}`, 22, lineY);
    lineY += 16;
    ctx.fillText(`Boost ${Math.round(player.boost)}/${Math.round(cachedStats.boostMax)}`, 22, lineY);
    lineY += 16;
    ctx.fillText(`Fuel ${Math.round(player.fuel)}/${Math.round(cachedStats.fuelMax)}`, 22, lineY);
    lineY += 16;
    ctx.fillText(`Hyper ${Math.round(player.hyperCharge)}% | Dial ${getHyperChargeLevel() * 10}%`, 22, lineY);

    const primaryWeapon = WEAPONS[player.weapons.primary];
    const secondaryWeapon = WEAPONS[player.weapons.secondary];
    const primaryAmmo = primaryWeapon?.ammoType ? `${player.ammo[primaryWeapon.ammoType] || 0}` : 'inf';
    const secondaryAmmo = secondaryWeapon?.ammoType ? `${player.ammo[secondaryWeapon.ammoType] || 0}` : 'inf';
    ctx.fillStyle = 'rgba(5,10,18,0.6)';
    ctx.fillRect(VIEW.width - 220, VIEW.height - 92, 200, 80);
    ctx.strokeStyle = 'rgba(125,252,154,0.3)';
    ctx.strokeRect(VIEW.width - 220, VIEW.height - 92, 200, 80);
    ctx.fillStyle = PALETTE.glow;
    ctx.fillText(`P: ${primaryWeapon?.label || 'None'} (${primaryAmmo})`, VIEW.width - 208, VIEW.height - 64);
    ctx.fillText(`S: ${secondaryWeapon?.label || 'None'} (${secondaryAmmo})`, VIEW.width - 208, VIEW.height - 44);
    ctx.fillText(`Cargo ${getCargoCount()}/${cachedStats.cargoMax}`, VIEW.width - 208, VIEW.height - 24);
    ctx.fillText(`Assist: ${player.flightAssist ? 'ON' : 'OFF'}`, VIEW.width - 208, VIEW.height - 8);
    ctx.restore();
  }

  function drawGateIndicator() {
    const gate = getGateData();
    if (!gate) return;
    const dx = gate.x - player.x;
    const dy = gate.y - player.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const margin = 40;
    const radius = Math.min(VIEW.centerX - margin, VIEW.centerY - margin);
    const x = VIEW.centerX + Math.cos(angle) * radius;
    const y = VIEW.centerY + Math.sin(angle) * radius;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(255,209,102,0.95)';
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(255,209,102,0.9)';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, 10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, -10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#ffd166';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Relay Gate ${Math.round(distance)}m`, x - 44, y - 12);

    if (distance < 420) {
      const sx = gate.x - (player.x - VIEW.centerX);
      const sy = gate.y - (player.y - VIEW.centerY);
      ctx.strokeStyle = 'rgba(255,209,102,0.6)';
      ctx.beginPath();
      ctx.arc(sx, sy, 50, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawHomeIndicator() {
    const base = world.homeBase;
    if (!base) return;
    const dx = base.x - player.x;
    const dy = base.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 380) return;
    const angle = Math.atan2(dy, dx);
    const margin = 52;
    const radius = Math.min(VIEW.centerX - margin, VIEW.centerY - margin);
    const x = VIEW.centerX + Math.cos(angle) * radius;
    const y = VIEW.centerY + Math.sin(angle) * radius;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(109,240,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(12, 0);
    ctx.lineTo(-8, 7);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-8, -7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(109,240,255,0.9)';
    ctx.font = '11px sans-serif';
    ctx.fillText(`City ${Math.round(distance)}m`, x - 30, y - 12);
  }

  function drawConvergenceIndicator() {
    if (state.atlasCompleted) return;
    const gate = getConvergenceGateData();
    if (!gate) return;
    const dx = gate.x - player.x;
    const dy = gate.y - player.y;
    const distance = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);
    const margin = 58;
    const radius = Math.min(VIEW.centerX - margin, VIEW.centerY - margin);
    const x = VIEW.centerX + Math.cos(angle) * radius;
    const y = VIEW.centerY + Math.sin(angle) * radius;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(154,214,255,0.95)';
    ctx.shadowBlur = 12;
    ctx.shadowColor = 'rgba(154,214,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-11, 10);
    ctx.lineTo(-7, 0);
    ctx.lineTo(-11, -10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#9ad6ff';
    ctx.font = '11px sans-serif';
    ctx.fillText(`Atlas ${Math.round(distance)}m`, x - 34, y - 16);

    if (distance < 420) {
      const sx = gate.x - (player.x - VIEW.centerX);
      const sy = gate.y - (player.y - VIEW.centerY);
      ctx.strokeStyle = 'rgba(154,214,255,0.5)';
      ctx.beginPath();
      ctx.arc(sx, sy, 60, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawNavigationHud(sector) {
    const hudAlpha = getHudAlpha();
    const lines = [];
    const biomeName = BIOMES[sector.biome]?.name || sector.biome;
    const biomeNote = BIOME_NOTES[sector.biome] || 'Unknown conditions.';
    lines.push({ text: `Biome: ${biomeName} — ${biomeNote}`, color: '#e0f2ff' });
    if (player.affiliation) {
      const name = FACTIONS.find((f) => f.id === player.affiliation)?.name || player.affiliation;
      lines.push({ text: `Alignment: ${name}`, color: '#9fb4d9' });
    } else {
      lines.push({ text: 'Alignment: Unaligned', color: '#9fb4d9' });
    }
    if (!mission.active && !contract.active) {
      const hub = getNearestHubTarget();
      if (hub) {
        lines.push({ text: `Nearest Hub: ${hub.label} ${Math.round(hub.distance)}m`, color: '#9ad6ff' });
        lines.push({ text: 'Dock at hubs for contracts and Atlas sigils.', color: '#9fb4d9' });
      }
    }
    const gate = getGateData();
    if (gate) {
      const distance = Math.hypot(gate.x - player.x, gate.y - player.y);
      lines.push({ text: `Relay Gate: ${Math.round(distance)}m`, color: '#ffd166' });
    }
    const convergence = getConvergenceGateData();
    if (convergence && !state.atlasCompleted) {
      const distance = Math.hypot(convergence.x - player.x, convergence.y - player.y);
      lines.push({ text: `Atlas Gate: ${Math.round(distance)}m`, color: '#9ad6ff' });
    }
    if (world.homeBase) {
      const distance = Math.hypot(world.homeBase.x - player.x, world.homeBase.y - player.y);
      lines.push({ text: `Home Base: ${Math.round(distance)}m`, color: '#9ad6ff' });
    }
    if (state.capturePressure > 0) {
      lines.push({ text: `Capture Lock: ${Math.round(state.capturePressure)}%`, color: '#9ad6ff' });
    }
    const hyperLevel = getHyperChargeLevel();
    const hyperLabel = state.hyperDrive.cooldown > 0
      ? `Cooling ${state.hyperDrive.cooldown.toFixed(1)}s`
      : `${Math.round(player.hyperCharge)}%`;
    lines.push({ text: `Hyper Map (V): ${hyperLabel} | Dial ${hyperLevel * 10}% | Jump (Enter)`, color: '#9ad6ff' });
    lines.push({ text: 'Return Jump (J): City retreat with mission penalty', color: '#9fb4d9' });
    lines.push({ text: 'Signal Scope: hostile=faction, friendly=cyan, civilian=gray', color: '#9fb4d9' });
    lines.push({ text: 'Signal Scope: trader/city=teal, station=green, survey=violet', color: '#9fb4d9' });
    if (!lines.length) return;
    const width = 520;
    const height = lines.length * 16 + 12;
    const x = VIEW.centerX - width / 2;
    const y = 8;
    ctx.save();
    ctx.globalAlpha = hudAlpha;
    ctx.fillStyle = 'rgba(5,10,18,0.55)';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = 'rgba(125,252,154,0.3)';
    ctx.strokeRect(x, y, width, height);
    ctx.font = '12px sans-serif';
    lines.forEach((line, index) => {
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, x + 12, y + 20 + index * 16);
    });
    ctx.restore();
  }

  function drawSignalScope() {
    const sector = getCurrentSector();
    if (!sector) return;
    const { radius, range } = SIGNAL_SCOPE;
    const baseX = SIGNAL_SCOPE.x ?? 96;
    const baseY = SIGNAL_SCOPE.y ?? 248;
    const centerX = clamp(baseX, radius + 14, VIEW.width - radius - 14);
    const centerY = clamp(baseY, radius + 14, VIEW.height - radius - 14);
    const alpha = getHudAlpha() * 0.85;

    const contacts = [];
    const addContact = (type, x, y, color, size = 2.4) => {
      const dx = x - player.x;
      const dy = y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > range) return;
      contacts.push({ type, dx, dy, distance, color, size });
    };

    entities.enemies.forEach((enemy) => {
      if (enemy.hp <= 0) return;
      const base = getFactionColor(enemy.faction, IFF_COLORS.hostile);
      const color = enemy.role === 'carrier' || enemy.role === 'transport' ? mixColor(base, IFF_COLORS.hostileHeavy, 0.35) : base;
      addContact('enemy', enemy.x, enemy.y, color, enemy.role === 'carrier' ? 4 : 2.6);
    });
    sector.objects.friendlies.forEach((ship) => {
      const color = getFactionColor(ship.faction, IFF_COLORS.friendly);
      addContact('friendly', ship.x, ship.y, color, ship.role === 'guardian' ? 3.4 : 2.4);
    });
    sector.objects.traders.forEach((trader) => addContact('trader', trader.x, trader.y, '#6df0ff', 2.4));
    sector.objects.stations.forEach((station) => addContact('station', station.x, station.y, '#7dfc9a', 3));
    if (world.cities && world.cities.length) {
      world.cities.forEach((city) => {
        if (city.type === 'capital' || dist(city.x, city.y, player.x, player.y) > range) return;
        addContact('city', city.x, city.y, '#6df0ff', 3.6);
      });
    }
    sector.objects.bases.forEach((base) => addContact('base', base.x, base.y, '#ff6b6b', 3.4));
    sector.objects.civilians.forEach((ship) => addContact('civil', ship.x, ship.y, IFF_COLORS.civilian, 2));
    sector.objects.surveyBeacons.forEach((beacon) => {
      if (world.beaconClaims?.[sector.key]) return;
      addContact('survey', beacon.x, beacon.y, '#c77dff', 2.6);
    });

    contacts.sort((a, b) => a.distance - b.distance);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(5,10,18,0.55)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(125,252,154,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = alpha * 0.5;
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.moveTo(centerX, centerY - radius);
    ctx.lineTo(centerX, centerY + radius);
    ctx.stroke();

    ctx.globalAlpha = alpha;
    contacts.forEach((contact) => {
      const rel = Math.atan2(contact.dy, contact.dx) - player.angle + Math.PI / 2;
      const r = (contact.distance / range) * radius;
      const px = centerX + Math.cos(rel) * r;
      const py = centerY + Math.sin(rel) * r;
      ctx.fillStyle = contact.color;
      ctx.beginPath();
      ctx.arc(px, py, contact.size, 0, Math.PI * 2);
      ctx.fill();
    });

    if (state.capturePressure > 0) {
      const t = clamp(state.capturePressure / CAPTURE_SYSTEM.maxPressure, 0, 1);
      ctx.strokeStyle = `rgba(154,214,255,${0.25 + t * 0.35})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
      ctx.stroke();
    }

    ctx.restore();

    ctx.fillStyle = 'rgba(159,180,217,0.8)';
    ctx.font = '10px sans-serif';
    ctx.fillText('Radar', centerX - 18, centerY + radius + 18);
  }

  function drawHyperRadar() {
    const sector = getCurrentSector();
    if (!sector) return;
    const targets = getHyperTargets();
    const maxRange = getHyperRange();
    const radarRange = maxRange * HYPER.radarRangeMult;
    const centerX = VIEW.width - 92;
    const centerY = 210;
    const radius = 52;
    const alpha = (state.mode === 'hyper' ? 0.95 : 0.65) * getHudAlpha();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(5,10,18,0.55)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(154,214,255,0.32)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();

    const jumpRing = radius * (maxRange / radarRange);
    ctx.strokeStyle = 'rgba(154,214,255,0.18)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, jumpRing, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(154,214,255,0.35)';
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX, centerY - radius);
    ctx.stroke();

    const selected = state.mode === 'hyper' ? getSelectedHyperTarget(targets) : null;
    targets.forEach((target) => {
      const rel = target.angle - player.angle;
      const angle = Math.atan2(Math.sin(rel), Math.cos(rel)) - Math.PI / 2;
      const t = clamp((target.distance - HYPER.minDistance) / Math.max(1, radarRange - HYPER.minDistance), 0, 1);
      const r = lerp(jumpRing * 0.6, radius, t);
      const tx = centerX + Math.cos(angle) * r;
      const ty = centerY + Math.sin(angle) * r;
      const inRange = target.distance <= maxRange;
      const isSelected = selected && selected.id === target.id;
      ctx.fillStyle = inRange ? 'rgba(154,214,255,0.9)' : 'rgba(154,214,255,0.35)';
      ctx.beginPath();
      ctx.arc(tx, ty, isSelected ? 4.6 : inRange ? 3.4 : 2.3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    ctx.fillStyle = 'rgba(154,214,255,0.8)';
    ctx.font = '10px sans-serif';
    ctx.fillText('Hyper Echoes', centerX - 34, centerY + radius + 18);
    ctx.fillStyle = 'rgba(159,180,217,0.8)';
    ctx.fillText(`Dial ${getHyperChargeLevel() * 10}%`, centerX - 24, centerY + radius + 32);
    if (!targets.length) {
      ctx.fillStyle = 'rgba(159,180,217,0.7)';
      ctx.fillText('No echoes', centerX - 26, centerY + 4);
    }
  }

  function drawHyperJumpFX() {
    const fx = state.hyperJumpFx;
    if (!fx || fx.timer <= 0) return;
    const t = clamp(fx.timer / (fx.duration || 1), 0, 1);
    const progress = 1 - t;
    const alpha = 0.15 + t * 0.6;
    const cx = VIEW.centerX;
    const cy = VIEW.centerY;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = alpha;

    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, VIEW.height * 0.7);
    core.addColorStop(0, `rgba(154,214,255,${0.55 * t})`);
    core.addColorStop(0.35, `rgba(109,240,255,${0.25 * t})`);
    core.addColorStop(1, 'rgba(5,10,18,0)');
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    const streakCount = 30;
    ctx.strokeStyle = `rgba(154,214,255,${0.25 + t * 0.35})`;
    ctx.lineWidth = 1.2;
    for (let i = 0; i < streakCount; i += 1) {
      const angle = (Math.PI * 2 * i) / streakCount + state.time * 0.6;
      const jitter = Math.sin(state.time * 2 + i) * 12;
      const inner = lerp(10, 140, progress) + jitter * 0.2;
      const outer = inner + lerp(120, 360, progress);
      const x1 = cx + Math.cos(angle) * inner;
      const y1 = cy + Math.sin(angle) * inner;
      const x2 = cx + Math.cos(angle) * outer;
      const y2 = cy + Math.sin(angle) * outer;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    ctx.strokeStyle = `rgba(109,240,255,${0.25 + t * 0.35})`;
    for (let i = 0; i < 3; i += 1) {
      const radius = lerp(40, 260, progress) + i * 24;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function getHudAlpha() {
    if (state.mode === 'hyper' || state.mode === 'map' || state.mode === 'capture') return 1;
    const dangerEnemy = findClosestEnemy(player.x, player.y, 900);
    if (dangerEnemy) return 1;
    const sector = getCurrentSector();
    const encounter = getNearestEncounter(sector);
    if (encounter && dist(player.x, player.y, encounter.x, encounter.y) < 700) return 0.95;
    return 0.75;
  }

  function getNearestEncounter(sector) {
    if (!sector?.encounters?.length) return null;
    let best = null;
    let bestDist = Infinity;
    sector.encounters.forEach((enc) => {
      if (enc.cleared) return;
      const d = dist(player.x, player.y, enc.x, enc.y);
      if (d < bestDist) {
        best = enc;
        bestDist = d;
      }
    });
    return best;
  }

  function drawEncounterIndicator(sector) {
    const encounter = getNearestEncounter(sector);
    if (!encounter) return;
    const dx = encounter.x - player.x;
    const dy = encounter.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 220) return;
    const angle = Math.atan2(dy, dx);
    const margin = 62;
    const radius = Math.min(VIEW.centerX - margin, VIEW.centerY - margin);
    const x = VIEW.centerX + Math.cos(angle) * radius;
    const y = VIEW.centerY + Math.sin(angle) * radius;
    const label = encounter.type === 'raid'
      ? 'Raid'
      : encounter.type === 'convoy'
        ? 'Convoy'
        : encounter.type === 'ambush'
          ? 'Ambush'
          : encounter.type === 'guard'
            ? 'Guard'
            : 'Patrol';
    const color = encounter.type === 'raid'
      ? '#ff6b6b'
      : encounter.type === 'ambush'
        ? '#ff6b6b'
        : encounter.type === 'convoy'
          ? '#ffd166'
          : '#ffb347';

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.shadowBlur = 10;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(-10, 10);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-10, -10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = color;
    ctx.font = '11px sans-serif';
    ctx.fillText(`${label} ${Math.round(distance)}m`, x - 34, y - 12);
  }

  function drawGalaxyMap() {
    ctx.fillStyle = 'rgba(5,10,18,0.85)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '20px sans-serif';
    ctx.fillText('Aetherline Sector Grid', 24, 36);
    ctx.font = '12px sans-serif';
    ctx.fillText('Press M to close map.', 24, 54);
    const currentSector = getCurrentSector();
    ctx.fillStyle = '#e0f2ff';
    ctx.fillText(`System: ${currentSector.name}`, 24, 74);
    ctx.fillText(`Faction: ${currentSector.faction?.name || 'Unaligned'}`, 24, 92);
    ctx.fillText(`Alignment: ${player.affiliation ? (FACTIONS.find((f) => f.id === player.affiliation)?.name || player.affiliation) : 'Unaligned'}`, 24, 110);
    ctx.fillStyle = '#9fb4d9';
    ctx.fillText('Biomes form clustered pockets; Interstice Expanse are wide void lanes between clusters.', 24, 128);
    ctx.fillText('Props and hazards change per biome. Hubs are marked by bright station rings.', 24, 146);

    const stride = Math.max(1, Math.floor(WORLD.gridRadius / 24));
    const sampleSize = Math.floor((WORLD.gridRadius * 2) / stride) + 1;
    const cell = Math.max(8, Math.min(26, Math.floor((Math.min(VIEW.width, VIEW.height) - 140) / sampleSize)));
    const offsetX = VIEW.centerX - (sampleSize * cell) / 2;
    const offsetY = VIEW.centerY - (sampleSize * cell) / 2;

    for (let ix = 0; ix < sampleSize; ix += 1) {
      for (let iy = 0; iy < sampleSize; iy += 1) {
        const gx = -WORLD.gridRadius + ix * stride;
        const gy = -WORLD.gridRadius + iy * stride;
        if (gx < -WORLD.gridRadius || gx > WORLD.gridRadius || gy < -WORLD.gridRadius || gy > WORLD.gridRadius) continue;
        const sector = getSector(gx, gy);
        const visible = sector.discovered || sector.revealedUntil > state.time;
        const x = offsetX + ix * cell;
        const y = offsetY + iy * cell;
        if (!visible) {
          ctx.fillStyle = 'rgba(60,70,90,0.4)';
        } else if (sector.isVoid) {
          ctx.fillStyle = 'rgba(25,35,55,0.6)';
        } else {
          ctx.fillStyle = BIOMES[sector.biome].accent;
        }
        ctx.fillRect(x + 4, y + 4, cell - 8, cell - 8);
        if (sector.gateChapter) {
          ctx.strokeStyle = PALETTE.gold;
          ctx.strokeRect(x + 2, y + 2, cell - 4, cell - 4);
        }
        if (sector.zoneType === 'lane') {
          ctx.strokeStyle = 'rgba(125,252,154,0.35)';
          ctx.strokeRect(x + 6, y + 6, cell - 12, cell - 12);
        }
        if (sector.zoneType === 'rift') {
          ctx.strokeStyle = 'rgba(255,209,102,0.5)';
          ctx.strokeRect(x + 6, y + 6, cell - 12, cell - 12);
        }
        if (sector.zoneType === 'expanse') {
          ctx.strokeStyle = 'rgba(154,214,255,0.45)';
          ctx.strokeRect(x + 5, y + 5, cell - 10, cell - 10);
        }
        if (sector.objects.bases.length && !world.baseClaims?.[sector.key]) {
          ctx.fillStyle = 'rgba(255,107,107,0.9)';
          ctx.fillRect(x + cell / 2 - 3, y + cell / 2 - 3, 6, 6);
        }
        if (sector.objects.stations.length) {
          const hasWaystation = sector.objects.stations.some((station) => station.type === 'waystation');
          const isHub = sector.objects.stations.some((station) => station.hub || station.type === 'relay' || station.type === 'waystation');
          ctx.fillStyle = hasWaystation ? 'rgba(154,214,255,0.75)' : isHub ? 'rgba(154,214,255,0.85)' : 'rgba(125,252,154,0.7)';
          ctx.beginPath();
          ctx.arc(x + cell / 2, y + cell / 2, isHub ? 4 : 3, 0, Math.PI * 2);
          ctx.fill();
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

    if (world.homeBase) {
      const homeGrid = gridFromPos(world.homeBase.x, world.homeBase.y);
      const hx = offsetX + Math.floor((homeGrid.gx + WORLD.gridRadius) / stride) * cell + cell / 2;
      const hy = offsetY + Math.floor((homeGrid.gy + WORLD.gridRadius) / stride) * cell + cell / 2;
      ctx.fillStyle = 'rgba(109,240,255,0.9)';
      ctx.beginPath();
      ctx.arc(hx, hy, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    if (world.cities && world.cities.length) {
      world.cities.forEach((city) => {
        if (city.type === 'capital') return;
        const grid = gridFromPos(city.x, city.y);
        const sector = getSector(grid.gx, grid.gy);
        const discovered = sector.discovered || sector.revealedUntil > state.time;
        const cx = offsetX + Math.floor((grid.gx + WORLD.gridRadius) / stride) * cell + cell / 2;
        const cy = offsetY + Math.floor((grid.gy + WORLD.gridRadius) / stride) * cell + cell / 2;
        ctx.fillStyle = discovered ? 'rgba(154,214,255,0.75)' : 'rgba(154,214,255,0.35)';
        ctx.beginPath();
        ctx.arc(cx, cy, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    if (state.atlasUnlocked && world.convergenceGate) {
      const gateGrid = gridFromPos(world.convergenceGate.x, world.convergenceGate.y);
      const gx = gateGrid.gx;
      const gy = gateGrid.gy;
      const x = offsetX + (gx + WORLD.gridRadius) * cell + cell / 2;
      const y = offsetY + (gy + WORLD.gridRadius) * cell + cell / 2;
      ctx.strokeStyle = '#9ad6ff';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.stroke();
    }

    const playerGrid = gridFromPos(player.x, player.y);
    const px = offsetX + Math.floor((playerGrid.gx + WORLD.gridRadius) / stride) * cell + cell / 2;
    const py = offsetY + Math.floor((playerGrid.gy + WORLD.gridRadius) / stride) * cell + cell / 2;
    ctx.fillStyle = PALETTE.ember;
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();

    if (state.atlasUnlocked && world.convergenceGate) {
      const gateGrid = gridFromPos(world.convergenceGate.x, world.convergenceGate.y);
      const gx = Math.floor((gateGrid.gx + WORLD.gridRadius) / stride);
      const gy = Math.floor((gateGrid.gy + WORLD.gridRadius) / stride);
      const x = offsetX + gx * cell + cell / 2;
      const y = offsetY + gy * cell + cell / 2;
      ctx.strokeStyle = '#9ad6ff';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawHyperMapOverlay() {
    const maxRange = getHyperRange();
    const radarRange = maxRange * HYPER.radarRangeMult;
    const chargeLevel = getHyperChargeLevel();
    const chargePercent = Math.round(getHyperChargePercent(chargeLevel) * 100);
    const cost = getHyperChargeCost(chargeLevel);
    const targets = getHyperTargets(maxRange);
    const selected = getSelectedHyperTarget(targets);

    ctx.fillStyle = 'rgba(5,10,18,0.9)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '22px sans-serif';
    ctx.fillText('Hyper Navigation', 24, 36);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#9fb4d9';
    ctx.fillText('Press 1-9 for 10-90% or 0 for 100% charge. Use arrows to pick a target.', 24, 58);
    ctx.fillText('Press Enter to jump. Press V or Esc to close.', 24, 76);

    const estCost = selected ? getHyperJumpCost(selected.distance, chargeLevel) : maxCost;
    ctx.fillStyle = '#e0f2ff';
    ctx.fillText(`Charge Dial: ${chargePercent}% | Max Cost: ${maxCost}% | Est: ${estCost}% | Range: ${Math.round(maxRange)}m (Radar ${Math.round(radarRange)}m)`, 24, 98);

    const currentGrid = gridFromPos(player.x, player.y);
    const mapRadius = 4;
    const cell = 12;
    const mapSize = (mapRadius * 2 + 1) * cell;
    const mapX = VIEW.width - mapSize - 32;
    const mapY = 132;
    ctx.fillStyle = 'rgba(5,10,18,0.55)';
    ctx.fillRect(mapX - 12, mapY - 28, mapSize + 24, mapSize + 52);
    ctx.strokeStyle = 'rgba(109,240,255,0.25)';
    ctx.strokeRect(mapX - 12, mapY - 28, mapSize + 24, mapSize + 52);
    ctx.fillStyle = '#9fb4d9';
    ctx.fillText('Traffic Density', mapX - 2, mapY - 10);

    for (let gy = -mapRadius; gy <= mapRadius; gy += 1) {
      for (let gx = -mapRadius; gx <= mapRadius; gx += 1) {
        const sgx = currentGrid.gx + gx;
        const sgy = currentGrid.gy + gy;
        const cellX = mapX + (gx + mapRadius) * cell;
        const cellY = mapY + (gy + mapRadius) * cell;
        if (Math.abs(sgx) > WORLD.gridRadius || Math.abs(sgy) > WORLD.gridRadius) {
          ctx.fillStyle = 'rgba(10,16,28,0.55)';
          ctx.fillRect(cellX, cellY, cell - 1, cell - 1);
          continue;
        }
        const density = getRouteDensityForSector(sgx, sgy);
        const profile = getSectorProfile(sgx, sgy);
        const alpha = 0.08 + density * 0.7;
        const tint = profile.zoneType === 'lane' ? `rgba(255,209,102,${alpha})` : `rgba(109,240,255,${alpha})`;
        ctx.fillStyle = tint;
        ctx.fillRect(cellX, cellY, cell - 1, cell - 1);
      }
    }
    ctx.strokeStyle = 'rgba(255,209,102,0.6)';
    ctx.strokeRect(mapX + mapRadius * cell, mapY + mapRadius * cell, cell - 1, cell - 1);
    ctx.fillStyle = '#9fb4d9';
    ctx.fillText('Lane tiles glow gold.', mapX - 2, mapY + mapSize + 18);

    const listX = 24;
    let listY = 128;
    ctx.font = '13px sans-serif';
    if (!targets.length) {
      ctx.fillStyle = '#9fb4d9';
      ctx.fillText('No hyper echoes in range. Increase charge or relocate.', listX, listY);
      return;
    }

    targets.forEach((target, idx) => {
      if (idx > 14) return;
      const inRange = target.distance <= maxRange;
      const isSelected = selected && target.id === selected.id;
      const label = `${isSelected ? '▶' : ' '} ${target.label} — ${Math.round(target.distance)}m`;
      ctx.fillStyle = inRange ? (isSelected ? PALETTE.gold : '#e0f2ff') : 'rgba(159,180,217,0.7)';
      ctx.fillText(`${label}${inRange ? '' : ' (out of range)'}`, listX, listY + idx * 20);
    });
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

  function drawCaptureCarrierBackdrop() {
    const cx = VIEW.width - 220;
    const cy = 190;
    const scale = 1.1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = 'rgba(154,214,255,0.8)';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 18;
    ctx.shadowColor = 'rgba(154,214,255,0.45)';
    ctx.beginPath();
    ctx.arc(0, 0, 78, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.stroke();
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI * 2 * i) / 6;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * 48, Math.sin(angle) * 48);
      ctx.lineTo(Math.cos(angle) * 78, Math.sin(angle) * 78);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(10,18,32,0.7)';
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(154,214,255,0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = 'rgba(12,18,32,0.8)';
    ctx.beginPath();
    ctx.moveTo(0, -120);
    ctx.lineTo(56, -40);
    ctx.lineTo(90, 110);
    ctx.lineTo(0, 70);
    ctx.lineTo(-90, 110);
    ctx.lineTo(-56, -40);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCaptureOverlay() {
    if (!state.capture?.active) return;
    ctx.fillStyle = 'rgba(5,10,18,0.9)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    drawCaptureCarrierBackdrop();
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '22px sans-serif';
    ctx.fillText('Capture Intercept', 24, 40);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#e0f2ff';
    ctx.fillText(`Captured by ${state.capture.label}.`, 24, 70);
    ctx.fillText('They offer a pact: join their fleet or attempt a risky escape.', 24, 92);
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('1. Join the fleet (gain faction access and a contract).', 24, 130);
    ctx.fillStyle = '#ffb347';
    ctx.fillText('2. Resist and escape (lose credits, low hull).', 24, 152);
    ctx.fillStyle = '#9fb4d9';
    ctx.fillText('Press 1/2 or Y/N.', 24, 182);
  }

  function drawStationOverlay() {
    ctx.fillStyle = 'rgba(5,10,18,0.78)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '20px sans-serif';
    const activeStation = state.activeStation;
    const stationName = activeStation?.label || 'Station Docked';
    ctx.fillText(stationName, 24, 36);
    ctx.font = '12px sans-serif';
    const biomeName = activeStation?.biome ? BIOMES[activeStation.biome]?.name : null;
    if (biomeName) {
      ctx.fillStyle = '#e0f2ff';
      ctx.fillText(`${biomeName} Services`, 24, 56);
    }
    if (activeStation?.services?.length) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(activeStation.services.join(' / '), 24, 74);
    }
    const factionId = activeStation?.faction || '';
    if (factionId) {
      const rep = Math.round(getFactionRep(factionId));
      const discount = getFactionDiscount(factionId);
      const label = discount > 0 ? `Discount ${Math.round(discount * 100)}%` : discount < 0 ? `Markup ${Math.round(Math.abs(discount) * 100)}%` : 'Standard rates';
      ctx.fillStyle = '#9fb4d9';
      ctx.fillText(`Reputation: ${rep >= 0 ? '+' : ''}${rep} (${label})`, 24, 92);
    }
    ctx.fillStyle = '#9fb4d9';
    ctx.fillText(`Alignment: ${player.affiliation ? (FACTIONS.find((f) => f.id === player.affiliation)?.name || player.affiliation) : 'Unaligned'}`, 24, 108);
    let infoY = 124;
    if (!state.codexSeen) {
      ctx.fillStyle = '#9fb4d9';
      ctx.fillText('Press K for Pilot Codex (systems & logistics).', 24, infoY);
      infoY += 16;
    }
    if (activeStation?.services?.includes('Navigation Sync')) {
      const pending = getPendingDiscoveryCount();
      const reward = pending * DISCOVERY_UPLOAD.rewardPerSector;
      ctx.fillStyle = pending ? PALETTE.gold : '#9fb4d9';
      ctx.fillText(`Press P to upload discoveries (${pending} pending, +${reward} credits)`, 24, infoY);
      infoY += 16;
    }
    ctx.font = '13px sans-serif';
    const repairCost = applyFactionPrice(120, factionId);
    const ammoCost = applyFactionPrice(240, factionId);
    const options = [
      `1. Repair + Refuel + Hyper (${repairCost} credits)`,
      '2. Shipyard - Configure Modules',
      '3. Store - Supplies & Cosmetics',
      '4. Accept Contract',
      '5. Install Stored Blueprints',
      '6. Start Chapter Mission',
      '7. Undock',
      '8. Sell/Refine Cargo',
      `9. Bulk Ammo Restock (${ammoCost} credits)`,
      '0. Crew Board'
    ];
    options.forEach((opt, idx) => {
      ctx.fillStyle = idx === state.menuSelection ? PALETTE.gold : '#e0f2ff';
      ctx.fillText(opt, 24, infoY + idx * 22);
    });
    ctx.fillStyle = '#e0f2ff';
    ctx.fillText(`Cargo: Salvage ${player.inventory.cargo.salvage} | Alloys ${player.inventory.cargo.alloys} | Relics ${player.inventory.cargo.relics}`, 24, infoY + options.length * 22 + 8);

    if (state.civicTutorial?.active && (activeStation?.type === 'city' || activeStation?.type === 'home')) {
      const baseY = infoY + options.length * 22 + 34;
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(`${state.civicTutorial.label} Orientation`, 24, baseY);
      ctx.fillStyle = '#9fb4d9';
      const steps = [
        { id: 0, text: '1) Repair/Refuel (press 1).' },
        { id: 1, text: '2) Upload discoveries (press P).' },
        { id: 2, text: '3) Undock and resume (press 7).' }
      ];
      steps.forEach((step, idx) => {
        const done = state.civicTutorial.step > step.id;
        ctx.fillStyle = done ? PALETTE.glow : '#9fb4d9';
        ctx.fillText(`${done ? '●' : '○'} ${step.text}`, 24, baseY + 20 + idx * 18);
      });
    }
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

  function drawCrewOverlay() {
    ctx.fillStyle = 'rgba(5,10,18,0.85)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '20px sans-serif';
    ctx.fillText('Crew Board', 24, 36);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#e0f2ff';
    ctx.fillText('Hire specialists to improve efficiency. Press Esc to return.', 24, 56);

    const startY = 90;
    ctx.font = '13px sans-serif';
    CREW_ROLES.forEach((role, idx) => {
      const level = player.crew?.[role.id] || 0;
      const cost = getCrewCost(role.id);
      const locked = level >= role.max;
      ctx.fillStyle = idx === state.menuSelection ? PALETTE.gold : '#e0f2ff';
      ctx.fillText(
        `${idx + 1}. ${role.label} Lv.${level}/${role.max} ${locked ? '(MAX)' : `- ${cost} credits`}`,
        24,
        startY + idx * 26
      );
      ctx.fillStyle = '#9fb4d9';
      ctx.fillText(role.summary, 44, startY + idx * 26 + 16);
    });
  }

  function drawTraderOverlay() {
    const trader = state.activeTrader;
    if (!trader) return;
    ctx.fillStyle = 'rgba(5,10,18,0.82)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '20px sans-serif';
    ctx.fillText(`${trader.label}`, 24, 36);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#e0f2ff';
    ctx.fillText(trader.vibe, 24, 54);
    if (state.traderQuote) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(state.traderQuote, 24, 72);
    }
    ctx.font = '13px sans-serif';
    const options = [
      '1. Ammo Restock (220 credits)',
      '2. Fuel Cells + Hyper Charge (180 credits)',
      '3. Sell Cargo',
      '4. Trade Relic for Blueprint',
      '5. Buy Mystery Blueprint (600 credits)',
      '6. Leave'
    ];
    options.forEach((opt, idx) => {
      ctx.fillStyle = idx === state.traderSelection ? PALETTE.gold : '#e0f2ff';
      ctx.fillText(opt, 24, 90 + idx * 22);
    });
  }

  function drawLoreOverlay() {
    ctx.fillStyle = 'rgba(5,10,18,0.9)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '20px sans-serif';
    ctx.fillText('Archive Logs', 24, 36);
    ctx.font = '12px sans-serif';
    ctx.fillText('Press L to close. Use Up/Down to scroll.', 24, 54);

    const unlocked = LORE_ENTRIES.filter((entry) => player.lore.has(entry.id));
    const start = clamp(state.loreScroll, 0, Math.max(0, unlocked.length - 10));
    const visible = unlocked.slice(start, start + 10);

    ctx.font = '13px sans-serif';
    visible.forEach((entry, idx) => {
      const y = 90 + idx * 36;
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(entry.title, 24, y);
      ctx.fillStyle = '#e0f2ff';
      ctx.fillText(entry.text, 24, y + 18);
    });

    if (!unlocked.length) {
      ctx.fillStyle = '#e0f2ff';
      ctx.fillText('No archives recovered yet. Scan data shards to unlock logs.', 24, 90);
    }
  }

  function drawCodexOverlay() {
    ctx.fillStyle = 'rgba(5,10,18,0.9)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '20px sans-serif';
    ctx.fillText('Pilot Codex', 24, 36);
    ctx.font = '12px sans-serif';
    ctx.fillText('Press K or Esc to close. Use Up/Down to scroll.', 24, 54);

    const maxVisible = 5;
    const start = clamp(state.codexScroll, 0, Math.max(0, CODEX_ENTRIES.length - maxVisible));
    const visible = CODEX_ENTRIES.slice(start, start + maxVisible);
    let y = 90;
    ctx.font = '13px sans-serif';
    visible.forEach((entry) => {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText(entry.title, 24, y);
      ctx.fillStyle = '#e0f2ff';
      entry.lines.forEach((line, idx) => {
        ctx.fillText(line, 24, y + 18 + idx * 16);
      });
      y += 18 + entry.lines.length * 16 + 12;
    });
  }

  function drawGoalsOverlay() {
    ctx.fillStyle = 'rgba(5,10,18,0.9)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '20px sans-serif';
    ctx.fillText('Expedition Goals', 24, 36);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#e0f2ff';
    ctx.fillText('Press G to close.', 24, 54);
    ctx.fillText(`Atlas Sigils: ${player.atlasSigils.size}/${ATLAS_REQUIRED}`, 24, 72);

    const startY = 100;
    ctx.font = '13px sans-serif';
    ATLAS_SIGILS.forEach((sigil, idx) => {
      const acquired = player.atlasSigils.has(sigil.biome);
      ctx.fillStyle = acquired ? PALETTE.gold : '#9fb4d9';
      ctx.fillText(`${acquired ? '●' : '○'} ${BIOMES[sigil.biome]?.name || sigil.biome}`, 24, startY + idx * 20);
    });

    const flowY = startY + ATLAS_SIGILS.length * 20 + 24;
    if (state.atlasCompleted) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText('Atlas Convergence complete. New tech secured.', 24, flowY);
    } else if (state.atlasUnlocked) {
      ctx.fillStyle = PALETTE.gold;
      ctx.fillText('Atlas Convergence unlocked. Seek the new gate.', 24, flowY);
    } else {
      ctx.fillStyle = '#e0f2ff';
      ctx.fillText('Complete hub contracts to acquire sigils.', 24, flowY);
    }

    ctx.fillStyle = '#9fb4d9';
    ctx.fillText('Flow: Cross the expanse, dock at biome hubs, run contracts, unlock sigils.', 24, flowY + 22);
    ctx.fillText('Tip: Use V for Hyper Navigation, set charge 1-9/0, Enter to jump. J returns to city.', 24, flowY + 40);
    ctx.fillText('Status: Start unaligned, join a faction by docking at a hub or Bastion City.', 24, flowY + 58);
    ctx.fillText('Final step: reach the Atlas Convergence gate in the Interstice.', 24, flowY + 76);

    const nextMilestone = EXPLORATION_MILESTONES.find((milestone) => !player.milestones.has(milestone.id));
    if (nextMilestone) {
      ctx.fillText(`Next milestone: ${nextMilestone.label} at ${Math.round(nextMilestone.distance)}m.`, 24, flowY + 96);
    }
  }

  function drawTutorialOverlay() {
    ctx.fillStyle = 'rgba(5,10,18,0.88)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '22px sans-serif';
    ctx.fillText('Pilot Orientation', 24, 40);
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#e0f2ff';
    ctx.fillText('Complete these steps to launch the chapter mission.', 24, 68);

    const tasks = [
      { key: 'moved', label: 'Maneuver 300m (W/A/S/D or arrows).' },
      { key: 'boosted', label: 'Engage Shift Boost once (B or Shift).' },
      { key: 'scanned', label: 'Use Scan (C) or open the Map (M).' }
    ];
    tasks.forEach((task, idx) => {
      const done = state.tutorialFlags[task.key];
      ctx.fillStyle = done ? PALETTE.gold : '#9fb4d9';
      ctx.fillText(`${done ? '●' : '○'} ${task.label}`, 24, 100 + idx * 22);
    });

    ctx.fillStyle = '#e0f2ff';
    ctx.fillText('Biome pockets hold stations and hazards. The Interstice is the quiet void between clusters.', 24, 180);
    ctx.fillText('Use Signal Scope to find traders (teal) and stations (green) for fuel and ammo.', 24, 202);
    ctx.fillText('Fuel and hyper charge do not regenerate. Dock or hail traders to resupply.', 24, 224);
    ctx.fillText('Wrecks and rubble fields yield salvage. Sell/refine cargo at stations.', 24, 246);
    ctx.fillText('Bastion City is a safe no-fire hub with fuel, ammo, and discovery uploads.', 24, 268);
    ctx.fillText('You begin unaligned. Patrols may capture you; joining grants faction access.', 24, 290);
    ctx.fillText('Press G for Expedition Goals. Press U to toggle minimal HUD.', 24, 312);
    ctx.fillText('Press Enter to launch or Esc to skip.', 24, 334);
  }

  function drawOverlay() {
    if (state.mode === 'map') drawGalaxyMap();
    if (state.mode === 'hyper') drawHyperMapOverlay();
    if (state.mode === 'prompt') drawPromptOverlay();
    if (state.mode === 'capture') drawCaptureOverlay();
    if (state.mode === 'station') drawStationOverlay();
    if (state.mode === 'shipyard') drawShipyardOverlay();
    if (state.mode === 'store') drawStoreOverlay();
    if (state.mode === 'crew') drawCrewOverlay();
    if (state.mode === 'lore') drawLoreOverlay();
    if (state.mode === 'codex') drawCodexOverlay();
    if (state.mode === 'trader') drawTraderOverlay();
    if (state.mode === 'goals') drawGoalsOverlay();
    if (state.tutorialActive) drawTutorialOverlay();
  }

  function render() {
    const shake = state.cameraShakeTimer > 0 ? state.cameraShake * state.cameraShakeTimer : 0;
    const shakeX = Math.sin(state.time * 45 + state.cameraNoiseSeed) * shake * 4;
    const shakeY = Math.cos(state.time * 38 + state.cameraNoiseSeed * 2) * shake * 4;
    const camera = { x: player.x + shakeX, y: player.y + shakeY };

    drawBackground(camera);
    drawBiomeAtmosphere(camera);
    drawGalacticBand(camera);
    drawDust(camera);

    const sector = getCurrentSector();
    drawSectorObjects(sector, camera);
    drawEntities(camera, sector);
    drawHyperJumpFX();
    const hudMode = state.hudMode || 'full';
    if (hudMode === 'full') drawMiniMap();
    drawShipStatus();
    if (hudMode === 'full') drawNavigationHud(sector);
    drawSignalScope();
    drawHyperRadar();
    drawGateIndicator();
    drawHomeIndicator();
    drawConvergenceIndicator();
    drawVignette();
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
        const snapshot = saveLocal();
        pushCloudSave(snapshot);
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
    if (briefBody) {
      const atlasLine = state.atlasUnlocked
        ? 'Atlas objective: Convergence unlocked. Track the new gate.'
        : `Atlas objective: collect ${ATLAS_REQUIRED} sigils by completing hub contracts.`;
      const navLine = 'Navigation: Press V to open Hyper Navigation. Set charge with 1-9/0, Enter to jump. Use J to return to base (mission penalty).';
      const affiliationLine = player.affiliation
        ? `Alignment: ${FACTIONS.find((f) => f.id === player.affiliation)?.name || player.affiliation}.`
        : 'Status: Unaligned pilot. Dock at any hub to join a faction.';
      const loopLine = 'Loop: find wrecks/ruins, haul salvage, sell/refine, upgrade, and complete hub contracts for Atlas sigils.';
      const introLine = state.intro?.active
        ? 'Start adrift with a full hyper charge. A patrol will intercept and offer a pact; Bastion City coordinates unlock after first contact.'
        : '';
      briefBody.textContent = `${chapter.intro} ${atlasLine} ${navLine} ${affiliationLine} ${loopLine} ${introLine}`;
    }
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

  function beginTutorial() {
    state.tutorialActive = true;
    state.tutorialReady = false;
    state.tutorialFlags = { moved: false, boosted: false, scanned: false };
    state.tutorialOrigin = { x: player.x, y: player.y };
    state.mode = 'flight';
    state.paused = false;
    noteStatus('Tutorial active. Follow the checklist to begin.');
  }

  function completeTutorial(skipped = false) {
    state.tutorialActive = false;
    state.tutorialReady = false;
    if (!mission.active) startChapterMission();
    noteStatus(skipped ? 'Tutorial skipped. Good hunting.' : 'Tutorial complete. Good hunting.');
  }

  function hideBriefing() {
    if (!briefing) return;
    briefing.classList.remove('active');
    state.awaitingBrief = false;
    if (!state.tutorialSeen) {
      state.tutorialSeen = true;
      beginTutorial();
      return;
    }
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
        fuel: player.fuel,
        hyperCharge: player.hyperCharge,
        heat: player.heat,
        angularVelocity: player.angularVelocity,
        throttle: player.throttle,
        flightAssist: player.flightAssist,
        credits: player.credits,
        callsign: player.callsign,
        affiliation: player.affiliation,
        factionRep: player.factionRep,
        upgrades: player.upgrades,
        crew: player.crew,
        milestones: Array.from(player.milestones || []),
        discoveryUploads: Array.from(player.discoveryUploads || []),
        ammo: player.ammo,
        blueprints: Array.from(player.blueprints),
        cosmetics: Array.from(player.cosmetics),
        toys: Array.from(player.toys),
        lore: Array.from(player.lore),
        atlasSigils: Array.from(player.atlasSigils),
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
        toys: player.inventory.toys,
        cargo: player.inventory.cargo
      },
      mapProgress: {
        sectorsDiscovered: Array.from(world.discovered),
        bossesDefeated: world.bossDefeated,
        basesDestroyed: world.baseClaims,
        beaconsClaimed: world.beaconClaims,
        ruinsDiscovered: world.ruinClaims,
        landmarksDiscovered: world.landmarkClaims
      },
      settings: {
        graphicsQuality: 'high'
      },
      state: {
        unlockedDepth: state.unlockedDepth,
        storyLog: state.storyLog,
        failureLedger: state.failureLedger,
        tutorialSeen: state.tutorialSeen,
        hudMode: state.hudMode,
        codexSeen: state.codexSeen,
        civicTutorialDone: state.civicTutorialDone,
        introCompleted: state.introCompleted,
        atlasUnlocked: state.atlasUnlocked,
        atlasCompleted: state.atlasCompleted
      },
      mission,
      contract,
      checkpoint: state.checkpoint
    };
    try {
      const existing = localStorage.getItem(SAVE_KEY);
      if (existing) localStorage.setItem(SAVE_BACKUP_KEY, existing);
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (err) {
      console.warn('Save failed', err);
      return null;
    }
    return save;
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) {
        const backup = localStorage.getItem(SAVE_BACKUP_KEY);
        if (!backup) return null;
        const fallback = JSON.parse(backup);
        if (!fallback || fallback.version !== SAVE_VERSION) return null;
        return fallback;
      }
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
    player.fuel = savedPlayer.fuel ?? player.fuel;
    player.hyperCharge = savedPlayer.hyperCharge ?? savedPlayer.riftCharge ?? player.hyperCharge;
    player.heat = savedPlayer.heat ?? player.heat ?? 0;
    player.heat = clamp(player.heat, 0, HEAT.max);
    player.hyperCharge = clamp(player.hyperCharge, 0, HYPER.maxCharge);
    player.angularVelocity = savedPlayer.angularVelocity ?? player.angularVelocity;
    player.throttle = savedPlayer.throttle ?? player.throttle;
    player.flightAssist = savedPlayer.flightAssist ?? player.flightAssist;
    player.credits = savedPlayer.credits ?? player.credits;
    player.callsign = savedPlayer.callsign ?? player.callsign;
    player.affiliation = savedPlayer.affiliation ?? player.affiliation ?? '';
    player.factionRep = savedPlayer.factionRep || player.factionRep || {};
    player.upgrades = { ...player.upgrades, ...(savedPlayer.upgrades || {}) };
    player.crew = { ...player.crew, ...(savedPlayer.crew || {}) };
    player.milestones = new Set(savedPlayer.milestones || []);
    player.discoveryUploads = new Set(savedPlayer.discoveryUploads || []);
    player.ammo = { ...player.ammo, ...(savedPlayer.ammo || {}) };
    player.blueprints = new Set(savedPlayer.blueprints || []);
    player.cosmetics = new Set(savedPlayer.cosmetics || []);
    player.toys = new Set(savedPlayer.toys || []);
    player.lore = new Set(savedPlayer.lore || []);
    player.atlasSigils = new Set(savedPlayer.atlasSigils || []);
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
    player.inventory.cargo = save.inventory?.cargo || { salvage: 0, alloys: 0, relics: 0 };

    world.discovered = new Set(save.mapProgress?.sectorsDiscovered || []);
    world.bossDefeated = save.mapProgress?.bossesDefeated || {};
    world.baseClaims = save.mapProgress?.basesDestroyed || {};
    world.beaconClaims = save.mapProgress?.beaconsClaimed || {};
    world.ruinClaims = save.mapProgress?.ruinsDiscovered || {};
    world.landmarkClaims = save.mapProgress?.landmarksDiscovered || {};

    state.unlockedDepth = save.state?.unlockedDepth ?? state.unlockedDepth;
    state.storyLog = save.state?.storyLog || [];
    state.failureLedger = save.state?.failureLedger || {};
    state.tutorialSeen = save.state?.tutorialSeen ?? state.tutorialSeen;
    state.hudMode = save.state?.hudMode || state.hudMode || 'full';
    state.codexSeen = save.state?.codexSeen ?? state.codexSeen;
    state.codexScroll = 0;
    state.codexReturn = 'flight';
    state.civicTutorialDone = save.state?.civicTutorialDone ?? state.civicTutorialDone;
    state.civicTutorial = { active: false, step: 0, label: '' };
    state.introCompleted = save.state?.introCompleted ?? state.introCompleted;
    state.intro = { active: !state.introCompleted, phase: 'drift', timer: 0, captureQueued: false };
    state.tutorialActive = false;
    state.tutorialReady = false;
    state.tutorialFlags = { moved: false, boosted: false, scanned: false };
    state.tutorialOrigin = { x: player.x, y: player.y };
    state.atlasUnlocked = save.state?.atlasUnlocked ?? (player.atlasSigils.size >= ATLAS_REQUIRED);
    state.atlasCompleted = save.state?.atlasCompleted || false;
    state.spawnGrace = Math.max(state.spawnGrace || 0, 8);
    state.hyperNav = {
      chargeLevel: state.hyperNav?.chargeLevel || 10,
      targetIndex: 0
    };
    state.capture = { active: false, faction: '', label: '', origin: '' };
    state.capturePressure = 0;
    state.captureWindow = 0;
    state.startEncounterTimer = 0;
    state.startEncounterSeeded = true;
    state.radioCooldown = 0;
    state.enemyQuietTimer = 0;
    state.inNoFireZone = false;
    state.noFireCooldown = 0;
    state.scoopCooldown = 0;
    state.beaconHintCooldown = 0;

    if (save.mission) {
      mission.active = save.mission.active || false;
      mission.type = save.mission.type || '';
      mission.target = save.mission.target || 0;
      mission.progress = save.mission.progress || 0;
      mission.reward = save.mission.reward || 0;
      mission.baseReward = save.mission.baseReward || mission.reward || 0;
      mission.text = save.mission.text || '';
      mission.gateKey = save.mission.gateKey || '';
      mission.enemyType = save.mission.enemyType || '';
      mission.faction = save.mission.faction || '';
      mission.spawned = save.mission.spawned || false;
      mission.timeLimit = save.mission.timeLimit || 0;
      mission.timeRemaining = save.mission.timeRemaining || 0;
      mission.failures = save.mission.failures || 0;
    }

    if (save.contract) {
      contract.active = save.contract.active || false;
      contract.type = save.contract.type || '';
      contract.target = save.contract.target || 0;
      contract.progress = save.contract.progress || 0;
      contract.reward = save.contract.reward || 0;
      contract.text = save.contract.text || '';
      contract.originKey = save.contract.originKey || '';
      contract.originBiome = save.contract.originBiome || '';
      contract.originFaction = save.contract.originFaction || '';
      contract.convoyId = save.contract.convoyId || '';
      contract.convoyKey = save.contract.convoyKey || '';
      contract.escortTime = save.contract.escortTime || 0;
      contract.escortTotal = save.contract.escortTotal || 0;
      contract.raidTimer = save.contract.raidTimer || 0;
    }

    state.checkpoint = save.checkpoint || state.checkpoint;

    clampAmmo();
    refreshStats({ keepRatios: true });
    spawnDrones();
    updateDifficulty();
    resetChapterState();
    resetHomeDefense();
    assignCallsign();
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

  async function pushCloudSave(saveOverride) {
    if (!state.cloudReady) return;
    const user = await waitForAuth();
    if (!user) return;
    const save = saveOverride || loadLocal();
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

      if (state.mode === 'capture') {
        if (e.code === 'Digit1' || e.code === 'KeyY') resolveCaptureJoin();
        if (e.code === 'Digit2' || e.code === 'KeyN' || e.code === 'Escape') resolveCaptureResist();
        return;
      }

      if (state.tutorialActive && (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape')) {
        if (e.code === 'Escape' && !state.tutorialReady) {
          completeTutorial(true);
        } else if (state.tutorialReady) {
          completeTutorial(false);
        }
        return;
      }

      if (state.mode === 'hyper') {
        handleHyperInput(e.code);
        return;
      }

      if (state.mode === 'crew') {
        handleCrewInput(e.code);
        return;
      }

      if (e.code === 'KeyV' && state.mode === 'flight') {
        openHyperMap();
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

      if (e.code === 'KeyL' && state.mode === 'flight') {
        state.mode = 'lore';
        state.paused = true;
        return;
      }
      if (e.code === 'KeyL' && state.mode === 'lore') {
        state.mode = 'flight';
        state.paused = false;
        return;
      }

      if (e.code === 'KeyG' && state.mode === 'flight') {
        state.mode = 'goals';
        state.paused = true;
        return;
      }
      if (e.code === 'KeyG' && state.mode === 'goals') {
        state.mode = 'flight';
        state.paused = false;
        return;
      }

      if (e.code === 'KeyK') {
        if (state.mode === 'flight') {
          openCodex('flight');
          return;
        }
        if (state.mode === 'station') {
          openCodex('station');
          return;
        }
        if (state.mode === 'codex') {
          closeCodex();
          return;
        }
      }

      if (e.code === 'KeyU' && state.mode === 'flight') {
        state.hudMode = state.hudMode === 'minimal' ? 'full' : 'minimal';
        noteStatus(`HUD ${state.hudMode === 'minimal' ? 'minimal' : 'full'} mode.`);
        return;
      }

      if (state.mode === 'lore') {
        if (e.code === 'ArrowUp') state.loreScroll = Math.max(0, state.loreScroll - 1);
        if (e.code === 'ArrowDown') state.loreScroll += 1;
      }
      if (state.mode === 'codex') {
        if (e.code === 'ArrowUp') state.codexScroll = Math.max(0, state.codexScroll - 1);
        if (e.code === 'ArrowDown') state.codexScroll += 1;
      }

      if (e.code === 'Escape') {
        if (state.mode === 'shipyard' || state.mode === 'store' || state.mode === 'station' || state.mode === 'crew') {
          state.mode = 'station';
          return;
        }
        if (state.mode === 'trader') {
          state.mode = 'flight';
          state.paused = false;
          state.activeTrader = null;
          return;
        }
        if (state.mode === 'goals') {
          state.mode = 'flight';
          state.paused = false;
          return;
        }
        if (state.mode === 'codex') {
          closeCodex();
          return;
        }
      }

      if (state.mode === 'station') {
        handleStationMenuInput(e.code);
      } else if (state.mode === 'shipyard') {
        handleShipyardInput(e.code);
      } else if (state.mode === 'store') {
        handleStoreInput(e.code);
      } else if (state.mode === 'crew') {
        handleCrewInput(e.code);
      } else if (state.mode === 'trader') {
        handleTraderInput(e.code);
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
      const digit = parseInt(code.replace('Digit', ''), 10);
      if (!Number.isNaN(digit)) {
        state.menuSelection = digit === 0 ? 9 : digit - 1;
      }
    }
    if (code === 'Digit1') stationRepair();
    if (code === 'Digit2') openShipyard();
    if (code === 'Digit3') openStore();
    if (code === 'Digit4') stationContract();
    if (code === 'Digit5') installStoredBlueprints();
    if (code === 'Digit6') startMissionFromStation();
    if (code === 'Digit7') undock();
    if (code === 'Digit8') stationCargoAction();
    if (code === 'Digit9') bulkRestockAmmo();
    if (code === 'Digit0') openCrewBoard();
    if (code === 'KeyP') uploadDiscoveries();
  }

  function handleHyperInput(code) {
    if (code === 'Escape' || code === 'KeyV') {
      closeHyperMap();
      return;
    }
    if (code === 'Enter' || code === 'Space') {
      const maxRange = getHyperRange();
      const targets = getHyperTargets(maxRange);
      const target = getSelectedHyperTarget(targets);
      if (executeHyperJump(target)) {
        closeHyperMap();
      }
      return;
    }
    if (code === 'ArrowUp' || code === 'ArrowLeft') {
      state.hyperNav.targetIndex = Math.max(0, (state.hyperNav.targetIndex || 0) - 1);
      return;
    }
    if (code === 'ArrowDown' || code === 'ArrowRight') {
      const targets = getHyperTargets(getHyperRange());
      const maxIndex = Math.max(0, targets.length - 1);
      state.hyperNav.targetIndex = Math.min(maxIndex, (state.hyperNav.targetIndex || 0) + 1);
      return;
    }
    if (code.startsWith('Digit')) {
      const digit = code === 'Digit0' ? 10 : parseInt(code.replace('Digit', ''), 10);
      if (!Number.isNaN(digit) && digit >= 1 && digit <= 10) {
        state.hyperNav.chargeLevel = digit;
      }
    }
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

  function handleCrewInput(code) {
    if (code === 'Escape') {
      state.mode = 'station';
      return;
    }
    if (code.startsWith('Digit')) {
      const idx = parseInt(code.replace('Digit', ''), 10) - 1;
      if (!Number.isNaN(idx)) state.menuSelection = idx;
    }
    if (code === 'Digit1') hireCrew('navigator');
    if (code === 'Digit2') hireCrew('engineer');
    if (code === 'Digit3') hireCrew('quartermaster');
  }

  function handleTraderInput(code) {
    if (code === 'Escape') {
      state.mode = 'flight';
      state.paused = false;
      state.activeTrader = null;
      return;
    }
    if (code.startsWith('Digit')) {
      const idx = parseInt(code.replace('Digit', ''), 10) - 1;
      if (!Number.isNaN(idx)) state.traderSelection = idx;
    }
    if (code === 'Digit1') traderAmmoRestock();
    if (code === 'Digit2') traderFuelTopUp();
    if (code === 'Digit3') sellCargo();
    if (code === 'Digit4') tradeRelicForBlueprint();
    if (code === 'Digit5') buyMysteryBlueprint();
    if (code === 'Digit6') {
      state.mode = 'flight';
      state.paused = false;
      state.activeTrader = null;
    }
  }

  function traderAmmoRestock() {
    const cost = 220;
    if (player.credits < cost) {
      noteStatus('Insufficient credits for restock.');
      return;
    }
    player.credits -= cost;
    Object.keys(AMMO_TYPES).forEach((key) => {
      player.ammo[key] = clamp((player.ammo[key] || 0) + Math.floor(AMMO_TYPES[key].max * 0.5), 0, AMMO_TYPES[key].max);
    });
    noteStatus('Trader restocked ammo.');
  }

  function traderFuelTopUp() {
    const cost = 180;
    if (player.credits < cost) {
      noteStatus('Insufficient credits for fuel cells.');
      return;
    }
    player.credits -= cost;
    const fuelGain = cachedStats.fuelMax * 0.35;
    const hyperGain = HYPER.maxCharge * 0.35;
    player.fuel = clamp(player.fuel + fuelGain, 0, cachedStats.fuelMax);
    player.hyperCharge = clamp(player.hyperCharge + hyperGain, 0, HYPER.maxCharge);
    noteStatus('Fuel cells replenished.');
  }

  function tradeRelicForBlueprint() {
    if (player.inventory.cargo.relics <= 0) {
      noteStatus('No relics to trade.');
      return;
    }
    const keys = Object.keys(BLUEPRINTS);
    const blueprint = keys[Math.floor(Math.random() * keys.length)];
    player.inventory.cargo.relics -= 1;
    applyBlueprint(blueprint, true);
    noteStatus(`Relic traded for ${BLUEPRINTS[blueprint].name}.`);
  }

  function buyMysteryBlueprint() {
    const cost = 600;
    if (player.credits < cost) {
      noteStatus('Insufficient credits for blueprint.');
      return;
    }
    player.credits -= cost;
    const keys = Object.keys(BLUEPRINTS);
    const blueprint = keys[Math.floor(Math.random() * keys.length)];
    applyBlueprint(blueprint, true);
    noteStatus(`Blueprint acquired: ${BLUEPRINTS[blueprint].name}.`);
  }

  function stationRepair() {
    const factionId = state.activeStation?.faction || '';
    const repairCost = applyFactionPrice(120, factionId);
    if (player.credits < repairCost) {
      noteStatus('Insufficient credits for repairs.');
      return;
    }
    player.credits -= repairCost;
    player.hp = cachedStats.maxHp;
    player.shield = cachedStats.maxShield;
    player.boost = cachedStats.boostMax;
    player.energy = cachedStats.energyMax;
    player.fuel = cachedStats.fuelMax;
    player.hyperCharge = HYPER.maxCharge;
    player.heat = 0;
    noteStatus('Station services applied.');
    advanceCivicTutorial('repair');
  }

  function sellCargo() {
    const cargo = player.inventory.cargo;
    const totalValue = cargo.salvage * 40 + cargo.alloys * 60 + cargo.relics * 110;
    if (totalValue <= 0) {
      noteStatus('No cargo to sell.');
      return;
    }
    player.credits += totalValue;
    player.inventory.cargo = { salvage: 0, alloys: 0, relics: 0 };
    noteStatus(`Cargo sold for ${totalValue} credits.`);
  }

  function stationCargoAction() {
    const station = state.activeStation;
    if (station?.services?.includes('Refinery')) {
      refineCargo();
    } else {
      sellCargo();
    }
  }

  function refineCargo() {
    const cargo = player.inventory.cargo;
    const salvage = cargo.salvage || 0;
    const alloys = cargo.alloys || 0;
    const relics = cargo.relics || 0;
    if (salvage + alloys + relics <= 0) {
      noteStatus('No cargo to refine.');
      return;
    }
    const fuelGain = salvage * 28 + alloys * 40;
    const hyperGain = alloys * 6 + relics * 4;
    const creditGain = salvage * 18 + alloys * 30 + relics * 120;
    player.fuel = clamp(player.fuel + fuelGain, 0, cachedStats.fuelMax);
    player.hyperCharge = clamp(player.hyperCharge + hyperGain, 0, HYPER.maxCharge);
    player.credits += creditGain;
    player.inventory.cargo = { salvage: 0, alloys: 0, relics: 0 };
    noteStatus('Refinery processed cargo into fuel cells.');
  }

  function bulkRestockAmmo() {
    const factionId = state.activeStation?.faction || '';
    const cost = applyFactionPrice(240, factionId);
    if (player.credits < cost) {
      noteStatus('Insufficient credits for ammo restock.');
      return;
    }
    player.credits -= cost;
    Object.keys(AMMO_TYPES).forEach((key) => {
      player.ammo[key] = AMMO_TYPES[key].max;
    });
    noteStatus('Ammo bays restocked.');
  }

  function openCrewBoard() {
    if (!state.activeStation?.services?.includes('Crew')) {
      noteStatus('Crew board unavailable at this station.');
      return;
    }
    state.mode = 'crew';
    state.menuSelection = 0;
  }

  function getCrewCost(roleId) {
    const role = CREW_ROLES.find((entry) => entry.id === roleId);
    if (!role) return 0;
    const level = player.crew?.[roleId] || 0;
    return Math.round(role.baseCost * Math.pow(1.6, level));
  }

  function hireCrew(roleId) {
    const role = CREW_ROLES.find((entry) => entry.id === roleId);
    if (!role) return;
    const level = player.crew?.[roleId] || 0;
    if (level >= role.max) {
      noteStatus(`${role.label} already maxed.`);
      return;
    }
    const cost = getCrewCost(roleId);
    if (player.credits < cost) {
      noteStatus('Insufficient credits for crew hire.');
      return;
    }
    player.credits -= cost;
    player.crew[roleId] = level + 1;
    refreshStats({ keepRatios: true });
    noteStatus(`${role.label} hired. Level ${level + 1}.`);
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
    state.activeStation = null;
    advanceCivicTutorial('undock');
    noteStatus('Undocked.');
  }

  function stationContract() {
    const sector = getCurrentSector();
    createContractForSector(sector);
    acceptContract(sector);
  }

  function startMissionFromStation() {
    if (mission.active) {
      noteStatus('Mission already active.');
      return;
    }
    startChapterMission();
    state.mode = 'flight';
    state.paused = false;
    state.activeStation = null;
    noteStatus('Chapter mission activated.');
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
    const factionId = state.activeStation?.faction || '';
    const price = applyFactionPrice(item.price, factionId);
    if (player.credits < price) {
      noteStatus('Insufficient credits for purchase.');
      return;
    }
    player.credits -= price;
    if (item.type === 'consumable') {
      if (item.effect.hp) player.hp = clamp(player.hp + item.effect.hp, 0, cachedStats.maxHp);
      if (item.effect.energy) player.energy = clamp(player.energy + item.effect.energy, 0, cachedStats.energyMax);
      if (item.effect.boost) player.boost = clamp(player.boost + item.effect.boost, 0, cachedStats.boostMax);
    }
    if (item.type === 'ammo' && item.effect.ammo) {
      Object.entries(item.effect.ammo).forEach(([key, amount]) => {
        player.ammo[key] = (player.ammo[key] || 0) + amount;
      });
      clampAmmo();
    }
    if (item.type === 'cosmetic' && item.effect.cosmetic) {
      player.cosmetics.add(item.effect.cosmetic);
    }
    noteStatus(`${item.name} acquired.`);
  }

  function handleStart() {
    if (state.mode === 'capture') {
      noteStatus('Resolve the capture negotiation first.');
      return;
    }
    if (state.awaitingBrief) {
      noteStatus('Review the briefing and press Begin Chapter.');
      return;
    }
    if (!state.running) {
      state.running = true;
      state.paused = false;
      if (!state.frameId) state.frameId = requestAnimationFrame(tick);
      if (state.intro?.active) {
        player.hyperCharge = HYPER.maxCharge;
        state.hyperNav.chargeLevel = 10;
        spawnElectricBurst(player.x, player.y, 1.1);
        noteStatus('Systems surge. Hyper charge full. Drift or jump to locate the patrol.');
        pushStoryLog('Systems surge online. Hyper coils fully charged.');
      } else {
        noteStatus('Engines online.');
      }
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
    if (!window.__swarmSaveBound) {
      window.__swarmSaveBound = true;
      window.addEventListener('beforeunload', () => {
        const snapshot = saveLocal();
        pushCloudSave(snapshot);
      });
      window.addEventListener('pagehide', () => {
        const snapshot = saveLocal();
        pushCloudSave(snapshot);
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          const snapshot = saveLocal();
          pushCloudSave(snapshot);
        }
      });
    }

    buildClusterMap();
    buildGateMap();
    buildStationMap();
    buildCityMap();
    buildTradeLanes();
    buildSkygridBackground();

    const localSave = loadLocal();
    if (localSave) {
      applySave(localSave);
      state.awaitingBrief = false;
      state.mode = 'flight';
      state.paused = true;
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
    const snapshot = saveLocal();
    pushCloudSave(snapshot);
  }

  window.initSwarm = initSwarm;
  window.stopSwarm = stopSwarm;
})();
