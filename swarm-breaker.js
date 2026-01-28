import { db, hasFirebaseConfig, waitForAuth } from './firebase.js';
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

  const input = { keys: {} };

  const VIEW = {
    depth: 2200,
    viewDist: 700,
    centerX: canvas.width / 2,
    centerY: canvas.height * 0.54,
    shipOffsetY: 170,
    boundsX: 280,
    boundsY: 200
  };

  const BASE_SPEED = 120;
  const BASE_STATS = {
    hp: 120,
    shield: 90,
    thrust: 420,
    reverseThrust: 260,
    turnRate: 0.0056,
    maxSpeed: 320,
    drag: 0.985,
    fireDelay: 200,
    damage: 13,
    bulletSpeed: 920,
    boostMax: 120,
    boostRegen: 22
  };

  const STAR_LAYERS = [
    { count: 160, sizeMin: 0.5, sizeMax: 1.4, speed: 0.5, alpha: 0.5 },
    { count: 110, sizeMin: 1.0, sizeMax: 2.2, speed: 0.8, alpha: 0.75 },
    { count: 60, sizeMin: 1.6, sizeMax: 3.6, speed: 1.15, alpha: 0.95 }
  ];

  const ENEMY_TYPES = {
    scout: { hp: 18, speed: 110, fireRate: 1500, damage: 7, size: 15, color: '#6df0ff', approach: 1.08 },
    raider: { hp: 32, speed: 92, fireRate: 1250, damage: 9, size: 19, color: '#ffb347', approach: 1.05 },
    lancer: { hp: 54, speed: 80, fireRate: 1050, damage: 12, size: 23, color: '#ff6b6b', approach: 1.12 },
    turret: { hp: 65, speed: 0, fireRate: 950, damage: 11, size: 26, color: '#c77dff', static: true, approach: 0.85 }
  };

  const UPGRADE_DEFS = {
    engine: { label: 'Engine Output', max: 5, baseCost: 160, costStep: 140 },
    blaster: { label: 'Pulse Cannons', max: 5, baseCost: 170, costStep: 150 },
    capacitor: { label: 'Capacitor', max: 4, baseCost: 150, costStep: 130 },
    shield: { label: 'Shield Core', max: 4, baseCost: 160, costStep: 140 },
    hull: { label: 'Hull Plating', max: 4, baseCost: 160, costStep: 140 },
    booster: { label: 'Afterburner', max: 3, baseCost: 180, costStep: 160 }
  };
  const PACE = {
    lengthScale: 0.62,
    spawnScale: 0.78,
    gateBonus: 1,
    dataBoost: 1.25
  };

  const JOURNEY = [
    {
      id: 1,
      seed: 1411,
      title: 'Driftline Exodus',
      brief: 'You leave the Tenney Belt with a cracked nav core. The Driftline is unstable, but the relay must come back online.',
      objective: 'Reach the relay gate and stabilize the beacon.',
      segments: [
        { name: 'Launch Corridor', length: 18000, spawnInterval: 1600, mix: { scout: 0.7, raider: 0.3 }, hazards: { debris: 0.25 }, gates: 3, dataRate: 0.25 },
        { name: 'Rift Wake', length: 20000, spawnInterval: 1400, mix: { scout: 0.5, raider: 0.3, lancer: 0.2 }, hazards: { storm: 0.35, debris: 0.2 }, gates: 3, dataRate: 0.3 },
        { name: 'Relay Approach', length: 20000, spawnInterval: 1300, mix: { raider: 0.55, lancer: 0.45 }, hazards: { debris: 0.15 }, gates: 2, dataRate: 0.25 }
      ],
      optional: [
        { id: 'c1-a', type: 'kills', enemy: 'scout', target: 10, untilCheckpoint: 2, reward: 160, text: 'Destroy 10 scouts before Checkpoint 2.' },
        { id: 'c1-b', type: 'noHullDamage', untilCheckpoint: 3, reward: 200, text: 'Reach the relay without hull damage.' }
      ]
    },
    {
      id: 2,
      seed: 1539,
      title: 'Glasswake Run',
      brief: 'The relay points to a debris river. The Glasswake will tear hulls apart, but it is the only way forward.',
      objective: 'Cross the Glasswake and secure the signal cache.',
      segments: [
        { name: 'Shatter Field', length: 20000, spawnInterval: 1500, mix: { scout: 0.5, raider: 0.5 }, hazards: { debris: 0.5 }, gates: 3, dataRate: 0.35 },
        { name: 'Signal Carve', length: 22000, spawnInterval: 1350, mix: { scout: 0.35, raider: 0.45, lancer: 0.2 }, hazards: { debris: 0.4 }, gates: 3, dataRate: 0.4 },
        { name: 'Cache Approach', length: 21000, spawnInterval: 1300, mix: { raider: 0.6, lancer: 0.4 }, hazards: { debris: 0.3 }, gates: 2, dataRate: 0.35 }
      ],
      optional: [
        { id: 'c2-a', type: 'collect', target: 4, untilCheckpoint: 3, reward: 220, text: 'Collect 4 data shards before the cache.' },
        { id: 'c2-b', type: 'kills', enemy: 'raider', target: 5, untilCheckpoint: 2, reward: 180, text: 'Disable 5 raiders before Checkpoint 2.' }
      ]
    },
    {
      id: 3,
      seed: 1673,
      title: 'Signal Thief',
      brief: 'Pirates have latched onto the relay. Cut through their screen before they drain the beacon.',
      objective: 'Disable the signal thieves and keep the relay alive.',
      segments: [
        { name: 'Intercept', length: 21000, spawnInterval: 1300, mix: { scout: 0.4, raider: 0.4, lancer: 0.2 }, hazards: { debris: 0.2 }, gates: 3, dataRate: 0.3 },
        { name: 'Pursuit Line', length: 22000, spawnInterval: 1200, mix: { raider: 0.5, lancer: 0.5 }, hazards: { storm: 0.2 }, gates: 3, dataRate: 0.3 },
        { name: 'Break the Net', length: 22000, spawnInterval: 1150, mix: { raider: 0.45, lancer: 0.55 }, hazards: { debris: 0.15 }, gates: 2, dataRate: 0.25 }
      ],
      optional: [
        { id: 'c3-a', type: 'kills', enemy: 'raider', target: 6, untilCheckpoint: 3, reward: 240, text: 'Disable 6 raiders before the net breaks.' },
        { id: 'c3-b', type: 'shieldAtEnd', target: 50, reward: 220, text: 'Finish the chapter with at least 50 shield.' }
      ]
    },
    {
      id: 4,
      seed: 1799,
      title: 'Stormvault',
      brief: 'Ion storms scramble everything. Only the vault lane is stable enough to fly.',
      objective: 'Navigate the stormvault and keep the nav core intact.',
      segments: [
        { name: 'Ion Veil', length: 22000, spawnInterval: 1400, mix: { scout: 0.4, raider: 0.4, lancer: 0.2 }, hazards: { storm: 0.6 }, gates: 3, dataRate: 0.35 },
        { name: 'Eye of Storm', length: 23000, spawnInterval: 1300, mix: { raider: 0.5, lancer: 0.5 }, hazards: { storm: 0.5 }, gates: 3, dataRate: 0.4 },
        { name: 'Drift Exit', length: 22000, spawnInterval: 1200, mix: { raider: 0.4, lancer: 0.6 }, hazards: { storm: 0.4 }, gates: 2, dataRate: 0.35 }
      ],
      optional: [
        { id: 'c4-a', type: 'noBoost', untilCheckpoint: 2, reward: 200, text: 'Reach Checkpoint 2 without using boost.' },
        { id: 'c4-b', type: 'collect', target: 5, untilCheckpoint: 3, reward: 220, text: 'Collect 5 data shards in the stormvault.' }
      ]
    },
    {
      id: 5,
      seed: 1913,
      title: 'Redshift Pursuit',
      brief: 'The enemy cruiser leaps ahead. Keep pace through redshift tides before it escapes.',
      objective: 'Stay on the pursuit line and tag the cruiser.',
      segments: [
        { name: 'Redline Burn', length: 23000, spawnInterval: 1200, mix: { raider: 0.45, lancer: 0.55 }, hazards: { debris: 0.2 }, gates: 3, dataRate: 0.3 },
        { name: 'Coil Run', length: 24000, spawnInterval: 1150, mix: { raider: 0.4, lancer: 0.6 }, hazards: { storm: 0.3 }, gates: 3, dataRate: 0.3 },
        { name: 'Pursuit Lock', length: 24000, spawnInterval: 1100, mix: { raider: 0.35, lancer: 0.65 }, hazards: { debris: 0.25 }, gates: 2, dataRate: 0.25 }
      ],
      optional: [
        { id: 'c5-a', type: 'kills', enemy: 'lancer', target: 4, untilCheckpoint: 2, reward: 240, text: 'Destroy 4 lancers before Checkpoint 2.' },
        { id: 'c5-b', type: 'noHullDamage', untilCheckpoint: 2, reward: 220, text: 'Reach Checkpoint 2 without hull damage.' }
      ]
    },
    {
      id: 6,
      seed: 2039,
      title: 'Bastion Cross',
      brief: 'Automated defense platforms guard the cross. Disable them before they lock the gate.',
      objective: 'Cross the bastion and open the gate.',
      segments: [
        { name: 'Defense Ring', length: 24000, spawnInterval: 1200, mix: { raider: 0.45, lancer: 0.45, turret: 0.1 }, hazards: { turret: 0.3 }, gates: 3, dataRate: 0.35 },
        { name: 'Trench Drift', length: 24000, spawnInterval: 1100, mix: { raider: 0.35, lancer: 0.55, turret: 0.1 }, hazards: { turret: 0.35 }, gates: 3, dataRate: 0.35 },
        { name: 'Gate Breach', length: 23000, spawnInterval: 1050, mix: { raider: 0.3, lancer: 0.55, turret: 0.15 }, hazards: { turret: 0.4 }, gates: 2, dataRate: 0.3 }
      ],
      optional: [
        { id: 'c6-a', type: 'kills', enemy: 'turret', target: 3, untilCheckpoint: 3, reward: 260, text: 'Destroy 3 bastion turrets.' },
        { id: 'c6-b', type: 'collect', target: 6, untilCheckpoint: 3, reward: 240, text: 'Collect 6 data shards in the bastion.' }
      ]
    },
    {
      id: 7,
      seed: 2171,
      title: 'Darklane Refuge',
      brief: 'Nebula shadows hide a refugee convoy. Protect them without drawing a full pursuit.',
      objective: 'Reach Darklane and keep the convoy alive.',
      segments: [
        { name: 'Shadow Drift', length: 24000, spawnInterval: 1250, mix: { scout: 0.35, raider: 0.4, lancer: 0.25 }, hazards: { storm: 0.3 }, gates: 3, dataRate: 0.3 },
        { name: 'Sensor Nets', length: 25000, spawnInterval: 1150, mix: { raider: 0.35, lancer: 0.55, turret: 0.1 }, hazards: { storm: 0.35 }, gates: 3, dataRate: 0.3 },
        { name: 'Refuge Approach', length: 24000, spawnInterval: 1100, mix: { raider: 0.3, lancer: 0.6, turret: 0.1 }, hazards: { storm: 0.4 }, gates: 2, dataRate: 0.25 }
      ],
      optional: [
        { id: 'c7-a', type: 'hullAtEnd', target: 80, reward: 260, text: 'Finish the chapter with at least 80 hull.' },
        { id: 'c7-b', type: 'kills', enemy: 'scout', target: 12, untilCheckpoint: 3, reward: 220, text: 'Destroy 12 scouts before the refuge.' }
      ]
    },
    {
      id: 8,
      seed: 2299,
      title: 'Leviathan Gate',
      brief: 'The final gate opens under fire. A leviathan carrier blocks the passage.',
      objective: 'Break the carrier screen and punch through the gate.',
      segments: [
        { name: 'Outer Guard', length: 25000, spawnInterval: 1100, mix: { raider: 0.35, lancer: 0.55, turret: 0.1 }, hazards: { turret: 0.3 }, gates: 3, dataRate: 0.3 },
        { name: 'Gate Throat', length: 26000, spawnInterval: 1050, mix: { raider: 0.3, lancer: 0.6, turret: 0.1 }, hazards: { storm: 0.35, turret: 0.25 }, gates: 3, dataRate: 0.25 },
        { name: 'Leviathan Core', length: 26000, spawnInterval: 1000, mix: { raider: 0.25, lancer: 0.6, turret: 0.15 }, hazards: { storm: 0.45, turret: 0.35 }, gates: 2, dataRate: 0.25 }
      ],
      optional: [
        { id: 'c8-a', type: 'kills', enemy: 'lancer', target: 8, untilCheckpoint: 3, reward: 280, text: 'Destroy 8 lancers before the core.' },
        { id: 'c8-b', type: 'shieldAtEnd', target: 70, reward: 260, text: 'Reach the gate with at least 70 shield.' }
      ]
    }
  ];

  JOURNEY.forEach(chapter => {
    chapter.segments.forEach(segment => {
      segment.length = Math.round(segment.length * PACE.lengthScale);
      segment.spawnInterval = Math.max(650, Math.round(segment.spawnInterval * PACE.spawnScale));
      if (segment.gates) segment.gates += PACE.gateBonus;
      if (segment.dataRate) segment.dataRate *= PACE.dataBoost;
    });
  });

  const DEFAULT_PROGRESS = {
    schemaVersion: 1,
    chapter: 1,
    checkpoint: 0,
    credits: 0,
    upgrades: {
      engine: 0,
      blaster: 0,
      capacitor: 0,
      shield: 0,
      hull: 0,
      booster: 0
    },
    completedChallenges: {}
  };

  const state = {
    running: false,
    lastTime: 0,
    ready: false,
    completed: false,
    chapterIndex: 0,
    checkpointIndex: 0,
    segmentIndex: 0,
    chapterDistance: 0,
    segmentDistance: 0,
    segmentTimer: 0,
    spawnTimer: 0,
    debrisTimer: 0,
    turretTimer: 0,
    dataTimer: 0,
    nextGateAt: 0,
    baseSpeed: BASE_SPEED,
    forwardSpeed: BASE_SPEED,
    boostActive: false,
    shake: 0,
    hitFlash: 0,
    stormPhase: 0,
    stormLevel: 0,
    objectiveText: '',
    statusTimer: 0,
    message: '',
    player: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      thrust: BASE_STATS.thrust,
      reverseThrust: BASE_STATS.reverseThrust,
      turnRate: BASE_STATS.turnRate,
      maxSpeed: BASE_STATS.maxSpeed,
      drag: BASE_STATS.drag,
      fireDelay: BASE_STATS.fireDelay,
      fireCooldown: 0,
      hp: BASE_STATS.hp,
      maxHp: BASE_STATS.hp,
      shield: BASE_STATS.shield,
      maxShield: BASE_STATS.shield,
      damage: BASE_STATS.damage,
      bulletSpeed: BASE_STATS.bulletSpeed,
      boost: BASE_STATS.boostMax,
      boostMax: BASE_STATS.boostMax,
      boostRegen: BASE_STATS.boostRegen,
      lastHit: 0,
      angle: -Math.PI / 2
    },
    enemies: [],
    bullets: [],
    enemyBullets: [],
    debris: [],
    pickups: [],
    gates: [],
    particles: [],
    background: {
      stars: [],
      nebulae: [],
      streaks: [],
      dust: []
    },
    camera: {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      shakeX: 0,
      shakeY: 0
    },
    challenges: [],
    challengeState: {},
    hullDamaged: false,
    boostUsed: false,
    rng: Math.random
  };

  let progress = null;
  let progressReady = false;
  let progressSource = 'local';
  let currentUser = null;
  let upgradesBound = false;
  let saveTimer = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function formatDistance(value) {
    const km = value / 1000;
    if (km >= 100) return `${Math.round(km)}k`;
    if (km >= 10) return `${km.toFixed(1)}k`;
    return `${km.toFixed(2)}k`;
  }

  function formatCredits(value) {
    return Math.max(0, Math.round(value));
  }

  function makeRng(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randRange(min, max, rng = state.rng) {
    return min + (max - min) * rng();
  }

  function pickWeighted(mix, rng = state.rng) {
    const entries = Object.entries(mix || { scout: 1 });
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = rng() * total;
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return key;
    }
    return entries[0][0];
  }

  function upgradeScore(upgrades) {
    return Object.values(upgrades || {}).reduce((sum, value) => sum + (value || 0), 0);
  }

  function mergeProgress(data) {
    const merged = {
      ...DEFAULT_PROGRESS,
      ...(data || {}),
      upgrades: { ...DEFAULT_PROGRESS.upgrades, ...(data?.upgrades || {}) },
      completedChallenges: { ...(data?.completedChallenges || {}) }
    };
    merged.chapter = Math.max(1, Math.floor(merged.chapter || 1));
    merged.checkpoint = Math.max(0, Math.floor(merged.checkpoint || 0));
    merged.credits = Math.max(0, Number(merged.credits) || 0);
    return merged;
  }

  function loadLocalProgress() {
    try {
      const raw = localStorage.getItem('journey-progress-v1');
      if (!raw) return null;
      return mergeProgress(JSON.parse(raw));
    } catch (err) {
      console.warn('Journey local progress read failed', err);
      return null;
    }
  }

  function saveLocalProgress(data) {
    try {
      localStorage.setItem('journey-progress-v1', JSON.stringify(data));
    } catch (err) {
      console.warn('Journey local progress save failed', err);
    }
  }

  function chooseBestProgress(local, remote) {
    if (!local) return remote;
    if (!remote) return local;
    if (local.chapter !== remote.chapter) return local.chapter > remote.chapter ? local : remote;
    if (local.checkpoint !== remote.checkpoint) return local.checkpoint > remote.checkpoint ? local : remote;
    if (local.credits !== remote.credits) return local.credits > remote.credits ? local : remote;
    const localUp = upgradeScore(local.upgrades);
    const remoteUp = upgradeScore(remote.upgrades);
    if (localUp !== remoteUp) return localUp > remoteUp ? local : remote;
    return remote;
  }

  async function loadRemoteProgress(userId, localData) {
    const docRef = doc(db, 'journeyProgress', userId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      const fresh = mergeProgress(localData || DEFAULT_PROGRESS);
      await setDoc(docRef, { ...fresh, uid: userId, updatedAt: serverTimestamp() }, { merge: true });
      return fresh;
    }
    const remoteData = mergeProgress(snap.data());
    const localMerged = localData ? mergeProgress(localData) : null;
    const best = chooseBestProgress(localMerged, remoteData);
    if (best === localMerged) {
      await setDoc(docRef, { ...best, uid: userId, updatedAt: serverTimestamp() }, { merge: true });
    }
    return best;
  }

  async function loadProgress() {
    const localData = loadLocalProgress();
    if (!hasFirebaseConfig()) {
      progressSource = 'local';
      return localData || mergeProgress(DEFAULT_PROGRESS);
    }
    try {
      const user = await waitForAuth();
      if (!user) {
        progressSource = 'local';
        return localData || mergeProgress(DEFAULT_PROGRESS);
      }
      currentUser = user;
      progressSource = 'firebase';
      const remote = await loadRemoteProgress(user.uid, localData);
      return remote || mergeProgress(DEFAULT_PROGRESS);
    } catch (err) {
      console.warn('Journey remote progress failed', err);
      progressSource = 'local';
      return localData || mergeProgress(DEFAULT_PROGRESS);
    }
  }

  function queueSave() {
    saveLocalProgress(progress);
    if (progressSource !== 'firebase' || !currentUser) return;
    if (saveTimer) return;
    saveTimer = setTimeout(async () => {
      saveTimer = null;
      try {
        const docRef = doc(db, 'journeyProgress', currentUser.uid);
        await setDoc(docRef, { ...progress, uid: currentUser.uid, updatedAt: serverTimestamp() }, { merge: true });
      } catch (err) {
        console.warn('Journey save failed', err);
      }
    }, 400);
  }

  function sanitizeProgress() {
    if (!progress) return;
    const maxChapter = JOURNEY.length + 1;
    progress.chapter = clamp(progress.chapter, 1, maxChapter);
    if (progress.chapter <= JOURNEY.length) {
      const chapter = JOURNEY[progress.chapter - 1];
      const maxCheckpoint = chapter.segments.length - 1;
      if (progress.checkpoint > maxCheckpoint) {
        progress.chapter = Math.min(JOURNEY.length + 1, progress.chapter + 1);
        progress.checkpoint = 0;
      }
    } else {
      progress.checkpoint = 0;
    }
  }

  function applyUpgrades() {
    if (!progress) return;
    const upgrades = progress.upgrades || DEFAULT_PROGRESS.upgrades;
    const engineLevel = upgrades.engine || 0;
    const blasterLevel = upgrades.blaster || 0;
    const capacitorLevel = upgrades.capacitor || 0;
    const shieldLevel = upgrades.shield || 0;
    const hullLevel = upgrades.hull || 0;
    const boosterLevel = upgrades.booster || 0;

    state.baseSpeed = BASE_SPEED + engineLevel * 6 + boosterLevel * 4;
    state.player.thrust = BASE_STATS.thrust + engineLevel * 70;
    state.player.reverseThrust = BASE_STATS.reverseThrust + engineLevel * 50;
    state.player.turnRate = BASE_STATS.turnRate + engineLevel * 0.00025 + boosterLevel * 0.00018;
    state.player.maxSpeed = BASE_STATS.maxSpeed + engineLevel * 26;
    state.player.fireDelay = Math.max(120, BASE_STATS.fireDelay - capacitorLevel * 20);
    state.player.damage = BASE_STATS.damage + blasterLevel * 3;
    state.player.bulletSpeed = BASE_STATS.bulletSpeed + blasterLevel * 16;
    state.player.maxShield = BASE_STATS.shield + shieldLevel * 22;
    state.player.maxHp = BASE_STATS.hp + hullLevel * 26;
    state.player.boostMax = BASE_STATS.boostMax + boosterLevel * 30;
    state.player.boostRegen = BASE_STATS.boostRegen + boosterLevel * 8;

    state.player.hp = clamp(state.player.hp, 0, state.player.maxHp);
    state.player.shield = clamp(state.player.shield, 0, state.player.maxShield);
    state.player.boost = clamp(state.player.boost, 0, state.player.boostMax);
  }

  function getUpgradeCost(id) {
    const def = UPGRADE_DEFS[id];
    if (!def) return Infinity;
    const level = progress?.upgrades?.[id] || 0;
    return def.baseCost + def.costStep * level;
  }

  function updateUpgradeButtons() {
    if (!progress) return;
    upgradeButtons.forEach(btn => {
      const id = btn.dataset.swarmUpgrade;
      const def = UPGRADE_DEFS[id];
      if (!def) return;
      const level = progress.upgrades[id] || 0;
      const isMax = level >= def.max;
      const cost = getUpgradeCost(id);
      btn.textContent = isMax
        ? `${def.label} MAX`
        : `${def.label} L${level + 1} - ${cost}c`;
      btn.disabled = isMax || progress.credits < cost;
    });
    if (upgradeNote) {
      upgradeNote.textContent = progressSource === 'firebase'
        ? 'Upgrades save to your profile. Credits earned from objectives and challenges.'
        : 'Sign in to sync upgrades across devices. Credits saved locally.';
    }
  }

  function purchaseUpgrade(id) {
    if (!progress) return;
    const def = UPGRADE_DEFS[id];
    if (!def) return;
    const level = progress.upgrades[id] || 0;
    if (level >= def.max) return;
    const cost = getUpgradeCost(id);
    if (progress.credits < cost) return;
    progress.credits -= cost;
    progress.upgrades[id] = level + 1;
    applyUpgrades();
    updateUpgradeButtons();
    setStatus(`${def.label} upgraded.`, 1800);
    queueSave();
    updateHud();
  }

  function currentChapter() {
    return JOURNEY[state.chapterIndex];
  }

  function currentSegment() {
    const chapter = currentChapter();
    return chapter?.segments?.[state.segmentIndex];
  }

  function getDifficulty() {
    return 1 + state.chapterIndex * 0.2 + state.segmentIndex * 0.12;
  }

  function initChallenges() {
    const chapter = currentChapter();
    state.challenges = (chapter?.optional || []).map(def => {
      const completed = !!progress?.completedChallenges?.[def.id];
      return {
        ...def,
        completed,
        failed: false,
        progress: 0
      };
    });
    state.hullDamaged = false;
    state.boostUsed = false;
  }

  function updateObjectiveDisplay() {
    if (!hudObjective) return;
    const active = state.challenges.find(ch => !ch.completed && !ch.failed);
    if (active) {
      let extra = '';
      if (active.type === 'kills' || active.type === 'collect') {
        extra = ` (${active.progress}/${active.target})`;
      }
      hudObjective.textContent = `Optional: ${active.text}${extra}`;
      return;
    }
    hudObjective.textContent = `Objective: ${state.objectiveText || '-'}`;
  }

  function completeChallenge(challenge) {
    if (!challenge || challenge.completed) return;
    challenge.completed = true;
    progress.completedChallenges[challenge.id] = true;
    addCredits(challenge.reward, 'Challenge complete');
    setStatus(`Challenge complete: +${challenge.reward}c`, 2200);
    queueSave();
    updateObjectiveDisplay();
  }

  function evaluateCheckpointChallenges(checkpointIndex) {
    state.challenges.forEach(ch => {
      if (ch.completed || ch.failed) return;
      if (ch.untilCheckpoint && checkpointIndex >= ch.untilCheckpoint) {
        if (ch.type === 'kills' || ch.type === 'collect') {
          if (ch.progress >= ch.target) completeChallenge(ch);
          else ch.failed = true;
        }
        if (ch.type === 'noHullDamage') {
          if (!state.hullDamaged) completeChallenge(ch);
          else ch.failed = true;
        }
        if (ch.type === 'noBoost') {
          if (!state.boostUsed) completeChallenge(ch);
          else ch.failed = true;
        }
      }
    });
  }

  function evaluateEndChallenges() {
    state.challenges.forEach(ch => {
      if (ch.completed || ch.failed) return;
      if (ch.type === 'shieldAtEnd') {
        if (state.player.shield >= ch.target) completeChallenge(ch);
        else ch.failed = true;
      }
      if (ch.type === 'hullAtEnd') {
        if (state.player.hp >= ch.target) completeChallenge(ch);
        else ch.failed = true;
      }
    });
  }

  function addCredits(amount, reason) {
    if (!progress) return;
    progress.credits += amount;
    updateUpgradeButtons();
    updateHud();
    if (reason) setStatus(`${reason}: +${amount}c`, 1600);
    queueSave();
  }

  function setStatus(text, duration = 1500) {
    state.message = text;
    state.statusTimer = duration;
    if (statusText) statusText.textContent = text;
  }

  function updateStatus(dt) {
    if (state.statusTimer > 0) {
      state.statusTimer -= dt;
      if (state.statusTimer <= 0) {
        state.message = '';
        if (statusText) statusText.textContent = '';
      }
    }
  }

  function updateAuthNote() {
    if (!authNote) return;
    authNote.textContent = progressSource === 'firebase'
      ? 'Sync: Online'
      : 'Sign in to sync progress';
  }

  function resetRunToSegment() {
    const chapter = currentChapter();
    const segment = currentSegment();
    if (!chapter || !segment) return;
    state.rng = makeRng((chapter.seed || 1000) + state.segmentIndex * 97);
    const segmentStart = chapter.segments
      .slice(0, state.segmentIndex)
      .reduce((sum, seg) => sum + seg.length, 0);

    state.running = false;
    state.lastTime = 0;
    state.chapterDistance = segmentStart;
    state.segmentDistance = 0;
    state.segmentTimer = 0;
    state.spawnTimer = 0;
    state.debrisTimer = 0;
    state.turretTimer = 0;
    state.dataTimer = 0;
    state.nextGateAt = segment.gates ? segment.length / (segment.gates + 1) : 0;
    state.forwardSpeed = state.baseSpeed;
    state.boostActive = false;
    state.shake = 0;
    state.stormPhase = 0;
    state.stormLevel = segment.hazards?.storm || 0;
    state.hullDamaged = false;
    state.boostUsed = false;
    state.objectiveText = `${segment.name} — ${chapter.objective}`;

    state.player.x = 0;
    state.player.y = 0;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.angle = -Math.PI / 2;
    state.camera.x = 0;
    state.camera.y = 0;
    state.camera.vx = 0;
    state.camera.vy = 0;
    state.player.fireCooldown = 0;
    state.player.hp = state.player.maxHp;
    state.player.shield = state.player.maxShield;
    state.player.boost = state.player.boostMax;
    state.player.lastHit = 0;

    state.enemies = [];
    state.bullets = [];
    state.enemyBullets = [];
    state.debris = [];
    state.pickups = [];
    state.gates = [];
    state.particles = [];

    initBackground();
  }

  function setupChapter(chapterIndex, checkpointIndex) {
    const chapter = JOURNEY[chapterIndex];
    if (!chapter) return;
    chapter.totalLength = chapter.totalLength || chapter.segments.reduce((sum, seg) => sum + seg.length, 0);

    state.completed = false;
    state.chapterIndex = chapterIndex;
    state.checkpointIndex = clamp(checkpointIndex, 0, chapter.segments.length - 1);
    state.segmentIndex = state.checkpointIndex;
    state.objectiveText = chapter.objective;
    state.rng = makeRng((chapter.seed || 1000) + state.segmentIndex * 97);

    initChallenges();
    resetRunToSegment();
    updateObjectiveDisplay();
    updateHud();
  }

  function showBriefing({ kicker, title, body, primary, optional, buttonText, onLaunch }) {
    if (!briefing) return;
    if (briefKicker) briefKicker.textContent = kicker || '';
    if (briefTitle) briefTitle.textContent = title || '';
    if (briefBody) briefBody.textContent = body || '';
    if (briefPrimary) briefPrimary.textContent = primary || '';
    if (briefOptional) {
      briefOptional.innerHTML = '';
      (optional || []).forEach(text => {
        const li = document.createElement('li');
        li.textContent = text;
        briefOptional.appendChild(li);
      });
    }
    if (briefLaunch) {
      briefLaunch.textContent = buttonText || 'Begin';
      briefLaunch.onclick = () => {
        hideBriefing();
        if (onLaunch) onLaunch();
      };
    }
    briefing.classList.add('active');
  }

  function hideBriefing() {
    briefing?.classList.remove('active');
  }

  function showChapterBriefing(extraTitle) {
    const chapter = currentChapter();
    if (!chapter) return;
    const optional = (chapter.optional || [])
      .filter(ch => !progress.completedChallenges[ch.id])
      .map(ch => ch.text);
    showBriefing({
      kicker: `Chapter ${state.chapterIndex + 1} of ${JOURNEY.length}`,
      title: extraTitle ? `${chapter.title} - ${extraTitle}` : chapter.title,
      body: chapter.brief,
      primary: chapter.objective,
      optional: optional.length ? optional : ['No optional challenges remaining.'],
      buttonText: state.completed ? 'Restart Journey' : 'Begin Chapter',
      onLaunch: () => {
        if (state.completed) {
          resetJourney();
          return;
        }
        start();
      }
    });
  }

  function showCheckpointBriefing(nextSegment) {
    const chapter = currentChapter();
    const optional = state.challenges.filter(ch => !ch.completed && !ch.failed).map(ch => ch.text);
    showBriefing({
      kicker: `Checkpoint ${state.checkpointIndex} secured`,
      title: nextSegment ? nextSegment.name : chapter.title,
      body: 'Resupply complete. Get ready for the next run.',
      primary: `Reach Checkpoint ${state.checkpointIndex + 1} / ${chapter.segments.length}.`,
      optional: optional.length ? optional : ['No optional challenges remaining.'],
      buttonText: 'Continue',
      onLaunch: () => start()
    });
  }

  function showDeathBriefing() {
    showBriefing({
      kicker: 'Ship disabled',
      title: 'Recovery drones inbound',
      body: 'You were pulled back to the last checkpoint. Use the restart to re-engage.',
      primary: `Restart from Checkpoint ${state.checkpointIndex} of ${currentChapter().segments.length}.`,
      optional: ['Repairs and shield recharged.'],
      buttonText: 'Relaunch',
      onLaunch: () => start()
    });
  }

  function showJourneyComplete() {
    state.completed = true;
    showBriefing({
      kicker: 'Journey complete',
      title: 'Leviathan Gate secured',
      body: 'The Driftline is stable again. You can restart the journey or keep refining your upgrades.',
      primary: 'Restart the journey to run the shared route again.',
      optional: ['All progress is saved per user.'],
      buttonText: 'Restart Journey',
      onLaunch: () => resetJourney()
    });
  }

  function resetJourney() {
    const savedUpgrades = progress?.upgrades ? { ...progress.upgrades } : { ...DEFAULT_PROGRESS.upgrades };
    const savedCredits = progress?.credits || 0;
    progress = mergeProgress(DEFAULT_PROGRESS);
    progressSource = progressSource === 'firebase' ? 'firebase' : 'local';
    progress.chapter = 1;
    progress.checkpoint = 0;
    progress.credits = savedCredits;
    progress.upgrades = { ...savedUpgrades };
    progress.completedChallenges = {};
    queueSave();
    applyUpgrades();
    setupChapter(0, 0);
    showChapterBriefing();
    updateUpgradeButtons();
    updateHud();
  }

  function start() {
    if (!state.ready || state.running) return;
    state.running = true;
    state.lastTime = performance.now();
    requestAnimationFrame(loop);
  }

  function pause() {
    state.running = false;
    render();
  }

  function restartFromCheckpoint() {
    resetRunToSegment();
    setStatus('Restarted from checkpoint.', 1600);
    render();
  }

  function firePlayer() {
    const player = state.player;
    if (player.fireCooldown > 0) return;
    const spread = (progress.upgrades.blaster || 0) >= 4 ? 0.05 : 0.02;
    const shotCount = (progress.upgrades.blaster || 0) >= 5 ? 2 : 1;
    for (let i = 0; i < shotCount; i++) {
      const offset = (i - (shotCount - 1) / 2) * spread;
      const heading = player.angle + offset;
      const lateralSpeed = 220 + (progress.upgrades.blaster || 0) * 10;
      state.bullets.push({
        x: player.x,
        y: player.y,
        z: 0,
        vx: Math.cos(heading) * lateralSpeed + player.vx * 0.35,
        vy: Math.sin(heading) * lateralSpeed + player.vy * 0.35,
        vz: player.bulletSpeed,
        life: 1400,
        damage: player.damage
      });
    }
    player.fireCooldown = player.fireDelay;
  }

  function spawnEnemy(type, zOverride) {
    const def = ENEMY_TYPES[type] || ENEMY_TYPES.scout;
    const diff = getDifficulty();
    const hpScale = 0.82 + diff * 0.22;
    const speedScale = 0.95 + diff * 0.1;
    const fireScale = clamp(1.05 - diff * 0.05, 0.6, 1.05);
    const enemy = {
      type,
      x: randRange(-VIEW.boundsX * 0.9, VIEW.boundsX * 0.9),
      y: randRange(-VIEW.boundsY * 0.9, VIEW.boundsY * 0.9),
      z: zOverride ?? VIEW.depth + 220,
      hp: def.hp * hpScale,
      maxHp: def.hp * hpScale,
      size: def.size,
      color: def.color,
      speed: def.speed * speedScale,
      fireRate: def.fireRate * fireScale,
      damage: def.damage * (0.9 + diff * 0.2),
      static: !!def.static,
      approach: def.approach || 1,
      vx: randRange(-40, 40),
      vy: randRange(-30, 30),
      turn: def.static ? 0 : 0.7 + diff * 0.3,
      fireCooldown: randRange(240, def.fireRate * fireScale),
      timer: randRange(0, 1000),
      pattern: state.rng() < 0.5 ? -1 : 1,
      hitTimer: 0
    };
    state.enemies.push(enemy);
    return enemy;
  }

  function spawnEnemyWave(segment) {
    if (!segment) return;
    if (state.enemies.length > 14) return;
    const diff = getDifficulty();
    const formationRoll = state.rng();
    if (formationRoll < 0.25) {
      const type = pickWeighted(segment.mix);
      const baseZ = VIEW.depth + 220;
      const spacing = 90;
      [-1, 0, 1].forEach((offset, idx) => {
        const enemy = spawnEnemy(type, baseZ + idx * 80);
        if (enemy) {
          enemy.x = clamp(enemy.x + offset * spacing, -VIEW.boundsX * 0.95, VIEW.boundsX * 0.95);
          enemy.y = clamp(enemy.y + Math.abs(offset) * 30, -VIEW.boundsY * 0.85, VIEW.boundsY * 0.85);
        }
      });
      return;
    }
    const extra = diff > 1.4 && state.rng() < 0.4 ? 1 : 0;
    const count = 1 + (state.rng() < 0.5 ? 1 : 0) + extra;
    for (let i = 0; i < count; i++) {
      const type = pickWeighted(segment.mix);
      spawnEnemy(type, VIEW.depth + 220 + i * 90);
    }
  }

  function spawnDebris() {
    state.debris.push({
      x: randRange(-VIEW.boundsX * 1.1, VIEW.boundsX * 1.1),
      y: randRange(-VIEW.boundsY * 1.1, VIEW.boundsY * 1.1),
      z: VIEW.depth + 200,
      r: randRange(12, 28)
    });
  }

  function spawnGate() {
    state.gates.push({
      x: randRange(-80, 80),
      y: randRange(-60, 60),
      z: VIEW.depth + 260,
      radius: randRange(80, 105),
      passed: false
    });
  }

  function spawnPickup(type, x, y, z) {
    state.pickups.push({
      type,
      x,
      y,
      z,
      r: type === 'data' ? 10 : 12
    });
  }

  function spawnExplosion(x, y, z, color) {
    for (let i = 0; i < 12; i++) {
      state.particles.push({
        x,
        y,
        z,
        vx: randRange(-60, 60, Math.random),
        vy: randRange(-60, 60, Math.random),
        vz: randRange(-40, 120, Math.random),
        life: randRange(400, 900, Math.random),
        size: randRange(2, 5, Math.random),
        color: color || '255,140,90'
      });
    }
  }

  function emitThruster(reverse = false) {
    const player = state.player;
    const angle = player.angle + (reverse ? 0 : Math.PI);
    const spread = 0.35;
    const strength = reverse ? 50 : 80;
    for (let i = 0; i < 2; i++) {
      const jitter = randRange(-spread, spread, Math.random);
      const dir = angle + jitter;
      state.particles.push({
        x: player.x + Math.cos(dir) * 16 + randRange(-3, 3, Math.random),
        y: player.y + Math.sin(dir) * 16 + randRange(-3, 3, Math.random),
        z: 70,
        vx: Math.cos(dir) * strength + randRange(-20, 20, Math.random),
        vy: Math.sin(dir) * strength + randRange(-20, 20, Math.random),
        vz: randRange(20, 80, Math.random),
        life: randRange(180, 320, Math.random),
        size: randRange(2, 3.5, Math.random),
        color: reverse ? '120,200,255' : '125,252,154'
      });
    }
  }

  function applyDamage(amount) {
    const player = state.player;
    player.lastHit = performance.now();
    if (player.shield > 0) {
      const absorbed = Math.min(player.shield, amount);
      player.shield -= absorbed;
      amount -= absorbed;
    }
    if (amount > 0) {
      player.hp -= amount;
      state.hullDamaged = true;
    }
    state.shake = Math.min(1, state.shake + 0.35);
    state.hitFlash = Math.min(1, state.hitFlash + 0.7);
    for (let i = 0; i < 6; i++) {
      state.particles.push({
        x: player.x + randRange(-12, 12, Math.random),
        y: player.y + randRange(-12, 12, Math.random),
        z: 80,
        vx: randRange(-80, 80, Math.random),
        vy: randRange(-80, 80, Math.random),
        vz: randRange(40, 120, Math.random),
        life: randRange(260, 520, Math.random),
        size: randRange(2, 4, Math.random),
        color: '255,90,90'
      });
    }
  }

  function updateBackground(dtSec) {
    const speed = state.forwardSpeed * dtSec;
    state.background.stars.forEach(star => {
      star.z -= speed * star.speed;
      if (star.z < 0) {
        star.z = VIEW.depth + randRange(50, 300, Math.random);
        star.x = randRange(-VIEW.boundsX * 1.6, VIEW.boundsX * 1.6, Math.random);
        star.y = randRange(-VIEW.boundsY * 1.6, VIEW.boundsY * 1.6, Math.random);
      }
    });
    state.background.streaks.forEach(streak => {
      streak.z -= speed * streak.speed;
      if (streak.z < 0) {
        streak.z = VIEW.depth + randRange(200, 600, Math.random);
        streak.x = randRange(-VIEW.boundsX * 1.2, VIEW.boundsX * 1.2, Math.random);
        streak.y = randRange(-VIEW.boundsY * 1.2, VIEW.boundsY * 1.2, Math.random);
      }
    });
    state.background.dust.forEach(puff => {
      puff.z -= speed * puff.speed;
      if (puff.z < 0) {
        puff.z = VIEW.depth + randRange(60, 200, Math.random);
        puff.x = randRange(-VIEW.boundsX * 1.4, VIEW.boundsX * 1.4, Math.random);
        puff.y = randRange(-VIEW.boundsY * 1.4, VIEW.boundsY * 1.4, Math.random);
      }
    });
    state.background.nebulae.forEach(nebula => {
      nebula.x += Math.sin(performance.now() / 12000 + nebula.phase) * dtSec * 2;
      nebula.y += Math.cos(performance.now() / 15000 + nebula.phase) * dtSec * 1.5;
    });
  }

  function update(dt) {
    const dtSec = dt / 1000;
    const player = state.player;
    const segment = currentSegment();

    updateStatus(dt);
    state.shake = Math.max(0, state.shake - dtSec * 2);
    state.hitFlash = Math.max(0, state.hitFlash - dtSec * 2.2);

    const rotateLeft = input.keys.KeyA || input.keys.ArrowLeft;
    const rotateRight = input.keys.KeyD || input.keys.ArrowRight;
    const forward = input.keys.KeyW || input.keys.ArrowUp;
    const reverse = input.keys.KeyS || input.keys.ArrowDown;
    if (rotateLeft) player.angle -= player.turnRate * dt;
    if (rotateRight) player.angle += player.turnRate * dt;
    if (player.angle > Math.PI) player.angle -= Math.PI * 2;
    if (player.angle < -Math.PI) player.angle += Math.PI * 2;

    if (forward) {
      player.vx += Math.cos(player.angle) * player.thrust * dtSec;
      player.vy += Math.sin(player.angle) * player.thrust * dtSec;
      if (Math.random() < 0.6) emitThruster(false);
    }
    if (reverse) {
      player.vx -= Math.cos(player.angle) * player.reverseThrust * dtSec;
      player.vy -= Math.sin(player.angle) * player.reverseThrust * dtSec;
      if (Math.random() < 0.5) emitThruster(true);
    }

    const edgeX = VIEW.boundsX * 0.88;
    const edgeY = VIEW.boundsY * 0.86;
    if (Math.abs(player.x) > edgeX) {
      const push = (Math.abs(player.x) - edgeX) / (VIEW.boundsX - edgeX);
      player.vx += -Math.sign(player.x) * push * 260 * dtSec;
    }
    if (Math.abs(player.y) > edgeY) {
      const push = (Math.abs(player.y) - edgeY) / (VIEW.boundsY - edgeY);
      player.vy += -Math.sign(player.y) * push * 240 * dtSec;
    }

    state.stormLevel = segment?.hazards?.storm || 0;
    if (state.stormLevel > 0) {
      state.stormPhase += dtSec * (0.6 + state.stormLevel);
      player.vx += Math.sin(state.stormPhase * 1.3) * state.stormLevel * 26 * dtSec;
      player.vy += Math.cos(state.stormPhase * 1.1) * state.stormLevel * 20 * dtSec;
    }

    const boosting = input.keys.ShiftLeft || input.keys.ShiftRight;
    state.boostActive = boosting && player.boost > 0;
    const segmentRamp = segment ? 1 + Math.min(0.18, (state.segmentDistance / segment.length) * 0.18) : 1;
    if (state.boostActive) {
      state.forwardSpeed = state.baseSpeed * (1.7 + (progress.upgrades.booster || 0) * 0.1) * segmentRamp;
      player.boost = Math.max(0, player.boost - 36 * dtSec);
      state.boostUsed = true;
    } else {
      state.forwardSpeed = state.baseSpeed * segmentRamp;
      player.boost = Math.min(player.boostMax, player.boost + player.boostRegen * dtSec);
    }

    const speed = Math.hypot(player.vx, player.vy);
    if (speed > player.maxSpeed) {
      const scale = player.maxSpeed / speed;
      player.vx *= scale;
      player.vy *= scale;
    }

    const thrusting = forward || reverse;
    const dragValue = thrusting ? player.drag : Math.max(0.9, player.drag - 0.05);
    const drag = Math.pow(dragValue, dtSec * 60);
    player.vx *= drag;
    player.vy *= drag;

    player.x += player.vx * dtSec;
    player.y += player.vy * dtSec;
    if (player.x > VIEW.boundsX) {
      player.x = VIEW.boundsX;
      player.vx *= -0.35;
    } else if (player.x < -VIEW.boundsX) {
      player.x = -VIEW.boundsX;
      player.vx *= -0.35;
    }
    if (player.y > VIEW.boundsY) {
      player.y = VIEW.boundsY;
      player.vy *= -0.35;
    } else if (player.y < -VIEW.boundsY) {
      player.y = -VIEW.boundsY;
      player.vy *= -0.35;
    }

    state.camera.x += (player.x - state.camera.x) * 0.08;
    state.camera.y += (player.y - state.camera.y) * 0.08;
    state.camera.vx += (player.vx - state.camera.vx) * 0.08;
    state.camera.vy += (player.vy - state.camera.vy) * 0.08;

    if (player.fireCooldown > 0) player.fireCooldown -= dt;
    if (performance.now() - player.lastHit > 1200) {
      player.shield = Math.min(player.maxShield, player.shield + 22 * dtSec);
    }

    if (input.keys.Space) firePlayer();

    state.segmentDistance += state.forwardSpeed * dtSec;
    state.chapterDistance += state.forwardSpeed * dtSec;

    if (segment) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        spawnEnemyWave(segment);
        const diffScale = 0.85 + getDifficulty() * 0.14;
        const variance = randRange(0.85, 1.15);
        state.spawnTimer = (segment.spawnInterval / diffScale) * variance;
      }

      const debrisRate = segment.hazards?.debris || 0;
      if (debrisRate > 0) {
        state.debrisTimer -= dt;
        if (state.debrisTimer <= 0) {
          if (state.debris.length < 18) spawnDebris();
          state.debrisTimer = 1700 / debrisRate;
        }
      }

      const turretRate = segment.hazards?.turret || 0;
      if (turretRate > 0) {
        state.turretTimer -= dt;
        if (state.turretTimer <= 0) {
          if (state.enemies.length < 16) spawnEnemy('turret', VIEW.depth + 180);
          state.turretTimer = 3200 / turretRate;
        }
      }

      const dataRate = segment.dataRate || 0;
      if (dataRate > 0) {
        state.dataTimer -= dt;
        if (state.dataTimer <= 0) {
          if (state.pickups.length < 10) {
            spawnPickup('data', randRange(-120, 120), randRange(-80, 80), VIEW.depth + 140);
          }
          state.dataTimer = 2600 / dataRate;
        }
      }

      if (segment.gates && state.nextGateAt > 0 && state.segmentDistance >= state.nextGateAt) {
        spawnGate();
        state.nextGateAt += segment.length / (segment.gates + 1);
      }
    }

    state.enemies.forEach(enemy => {
      enemy.timer += dt;
      if (enemy.hitTimer > 0) enemy.hitTimer -= dt;
      enemy.z -= state.forwardSpeed * dtSec * enemy.approach;

      if (!enemy.static) {
        let targetX = player.x;
        let targetY = player.y;
        if (enemy.type === 'scout') {
          targetX += Math.sin(enemy.timer / 180) * 90 * enemy.pattern;
          targetY += Math.cos(enemy.timer / 210) * 50;
        } else if (enemy.type === 'raider') {
          const angle = enemy.timer / 420 * enemy.pattern;
          targetX += Math.cos(angle) * 140;
          targetY += Math.sin(angle) * 90;
        } else if (enemy.type === 'lancer') {
          targetX += player.vx * 0.45;
          targetY += player.vy * 0.45;
        }

        const swayX = Math.sin(enemy.timer / 240) * 18 * enemy.pattern;
        const swayY = Math.cos(enemy.timer / 280) * 12 * enemy.pattern;
        targetX += swayX;
        targetY += swayY;

        const turnRate = enemy.turn * (enemy.type === 'lancer' ? 1.25 : 1);
        enemy.vx += (targetX - enemy.x) * turnRate * dtSec;
        enemy.vy += (targetY - enemy.y) * turnRate * dtSec;
        const sideSpeed = Math.hypot(enemy.vx, enemy.vy);
        const maxSide = enemy.speed * (enemy.type === 'scout' ? 1.15 : 1);
        if (sideSpeed > maxSide) {
          const scale = maxSide / sideSpeed;
          enemy.vx *= scale;
          enemy.vy *= scale;
        }
        enemy.x += enemy.vx * dtSec;
        enemy.y += enemy.vy * dtSec;
        enemy.x = clamp(enemy.x, -VIEW.boundsX * 1.1, VIEW.boundsX * 1.1);
        enemy.y = clamp(enemy.y, -VIEW.boundsY * 1.1, VIEW.boundsY * 1.1);
      }

      enemy.fireCooldown -= dt;
      if (enemy.fireCooldown <= 0 && enemy.z < 980) {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const len = Math.hypot(dx, dy) || 1;
        const jitter = randRange(-0.2, 0.2);
        const dirX = (dx / len) + jitter;
        const dirY = (dy / len) - jitter * 0.6;
        const dirLen = Math.hypot(dirX, dirY) || 1;
        const bulletSpeed = 280 + getDifficulty() * 45;
        state.enemyBullets.push({
          x: enemy.x,
          y: enemy.y,
          z: enemy.z,
          vx: (dirX / dirLen) * 160,
          vy: (dirY / dirLen) * 160,
          vz: -bulletSpeed,
          life: 1600,
          damage: enemy.damage
        });
        enemy.fireCooldown = enemy.fireRate + randRange(-250, 320);
      }
    });

    state.debris.forEach(debris => {
      debris.z -= state.forwardSpeed * dtSec;
    });

    state.pickups.forEach(pickup => {
      pickup.z -= state.forwardSpeed * dtSec;
    });

    state.gates.forEach(gate => {
      gate.z -= state.forwardSpeed * dtSec;
      if (!gate.passed && gate.z < 60) {
        const dx = gate.x - player.x;
        const dy = gate.y - player.y;
        if (Math.hypot(dx, dy) < gate.radius * 0.55) {
          gate.passed = true;
          addCredits(45, 'Gate cleared');
        } else {
          gate.passed = true;
        }
      }
    });

    state.bullets.forEach(bullet => {
      bullet.x += bullet.vx * dtSec;
      bullet.y += bullet.vy * dtSec;
      bullet.z += bullet.vz * dtSec;
      bullet.life -= dt;
    });

    state.enemyBullets.forEach(bullet => {
      bullet.x += bullet.vx * dtSec;
      bullet.y += bullet.vy * dtSec;
      bullet.z += bullet.vz * dtSec;
      bullet.life -= dt;
    });

    state.particles.forEach(p => {
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.z += p.vz * dtSec;
      p.life -= dt;
    });

    updateBackground(dtSec);

    state.bullets.forEach(bullet => {
      if (bullet.life <= 0) return;
      state.enemies.forEach(enemy => {
        if (bullet.life <= 0) return;
        if (enemy.hp <= 0) return;
        if (Math.abs(bullet.z - enemy.z) < 60) {
          const dx = bullet.x - enemy.x;
          const dy = bullet.y - enemy.y;
          if (Math.hypot(dx, dy) < enemy.size + 6) {
            enemy.hp -= bullet.damage;
            enemy.hitTimer = 140;
            bullet.life = 0;
            if (enemy.hp <= 0) {
              const reward = enemy.type === 'lancer' ? 30 : enemy.type === 'raider' ? 20 : enemy.type === 'turret' ? 36 : 14;
              addCredits(reward);
              spawnExplosion(enemy.x, enemy.y, enemy.z, enemy.type === 'turret' ? '180,110,255' : '255,120,90');
              if (state.rng() < 0.12) {
                const roll = state.rng();
                const type = roll > 0.7 ? 'shield' : roll > 0.4 ? 'repair' : 'data';
                spawnPickup(type, enemy.x, enemy.y, enemy.z + 80);
              }
              state.challenges.forEach(ch => {
                if (!ch.completed && !ch.failed && ch.type === 'kills' && ch.enemy === enemy.type) {
                  ch.progress += 1;
                }
              });
            }
          }
        }
      });
    });

    state.enemyBullets.forEach(bullet => {
      if (bullet.z < 60) {
        const dx = bullet.x - player.x;
        const dy = bullet.y - player.y;
        if (Math.hypot(dx, dy) < 18) {
          applyDamage(bullet.damage);
          bullet.life = 0;
        }
      }
    });

    state.debris.forEach(debris => {
      if (debris.z < 40) {
        const dx = debris.x - player.x;
        const dy = debris.y - player.y;
        if (Math.hypot(dx, dy) < debris.r + 16) {
          applyDamage(14);
          debris.z = -120;
        }
      }
    });

    state.pickups.forEach(pickup => {
      if (pickup.z < 40) {
        const dx = pickup.x - player.x;
        const dy = pickup.y - player.y;
        if (Math.hypot(dx, dy) < pickup.r + 14) {
          if (pickup.type === 'repair') player.hp = Math.min(player.maxHp, player.hp + 24);
          if (pickup.type === 'shield') player.shield = Math.min(player.maxShield, player.shield + 26);
          if (pickup.type === 'data') {
            addCredits(30, 'Data shard');
            state.challenges.forEach(ch => {
              if (!ch.completed && !ch.failed && ch.type === 'collect') {
                ch.progress += 1;
              }
            });
          }
          pickup.z = -120;
        }
      }
    });

    state.enemies = state.enemies.filter(enemy => enemy.hp > 0 && enemy.z > -140);
    state.bullets = state.bullets.filter(bullet => bullet.life > 0 && bullet.z < VIEW.depth + 400);
    state.enemyBullets = state.enemyBullets.filter(bullet => bullet.life > 0 && bullet.z > -200);
    state.debris = state.debris.filter(debris => debris.z > -140);
    state.pickups = state.pickups.filter(pickup => pickup.z > -140);
    state.gates = state.gates.filter(gate => gate.z > -140);
    state.particles = state.particles.filter(p => p.life > 0 && p.z > -200);

    if (segment && state.segmentDistance >= segment.length) {
      reachCheckpoint();
    }

    if (player.hp <= 0) {
      state.running = false;
      resetRunToSegment();
      showDeathBriefing();
    }

    updateObjectiveDisplay();
    updateHud();
  }

  function reachCheckpoint() {
    const chapter = currentChapter();
    if (!chapter) return;
    evaluateCheckpointChallenges(state.checkpointIndex + 1);

    const nextCheckpoint = state.checkpointIndex + 1;
    if (nextCheckpoint >= chapter.segments.length) {
      completeChapter();
      return;
    }

    addCredits(120, 'Checkpoint secured');
    state.checkpointIndex = nextCheckpoint;
    state.segmentIndex = nextCheckpoint;
    progress.checkpoint = nextCheckpoint;
    queueSave();

    state.rng = makeRng((chapter.seed || 1000) + state.segmentIndex * 97);
    resetRunToSegment();
    showCheckpointBriefing(chapter.segments[state.segmentIndex]);
  }

  function completeChapter() {
    evaluateEndChallenges();
    addCredits(260 + state.chapterIndex * 45, 'Chapter complete');
    progress.chapter = Math.min(JOURNEY.length + 1, progress.chapter + 1);
    progress.checkpoint = 0;
    queueSave();

    if (progress.chapter > JOURNEY.length) {
      showJourneyComplete();
      return;
    }

    setupChapter(progress.chapter - 1, 0);
    showChapterBriefing('Next Run');
  }

  function initBackground() {
    state.background.stars = [];
    state.background.nebulae = [];
    state.background.streaks = [];
    state.background.dust = [];
    STAR_LAYERS.forEach(layer => {
      for (let i = 0; i < layer.count; i++) {
        state.background.stars.push({
          x: randRange(-VIEW.boundsX * 1.6, VIEW.boundsX * 1.6, Math.random),
          y: randRange(-VIEW.boundsY * 1.6, VIEW.boundsY * 1.6, Math.random),
          z: randRange(0, VIEW.depth, Math.random),
          size: randRange(layer.sizeMin, layer.sizeMax, Math.random),
          speed: layer.speed,
          alpha: layer.alpha
        });
      }
    });

    for (let i = 0; i < 4; i++) {
      state.background.nebulae.push({
        x: randRange(0.1, 0.9, Math.random) * canvas.width,
        y: randRange(0.05, 0.5, Math.random) * canvas.height,
        r: randRange(120, 220, Math.random),
        color: i % 2 === 0 ? 'rgba(80,140,255,0.1)' : 'rgba(125,252,154,0.1)',
        phase: randRange(0, Math.PI * 2, Math.random)
      });
    }

    for (let i = 0; i < 50; i++) {
      state.background.streaks.push({
        x: randRange(-VIEW.boundsX * 1.2, VIEW.boundsX * 1.2, Math.random),
        y: randRange(-VIEW.boundsY * 1.2, VIEW.boundsY * 1.2, Math.random),
        z: randRange(0, VIEW.depth, Math.random),
        speed: randRange(1.4, 2.1, Math.random),
        length: randRange(40, 90, Math.random)
      });
    }

    for (let i = 0; i < 70; i++) {
      state.background.dust.push({
        x: randRange(-VIEW.boundsX * 1.4, VIEW.boundsX * 1.4, Math.random),
        y: randRange(-VIEW.boundsY * 1.4, VIEW.boundsY * 1.4, Math.random),
        z: randRange(0, VIEW.depth, Math.random),
        speed: randRange(1.2, 1.8, Math.random),
        size: randRange(0.8, 1.8, Math.random)
      });
    }
  }

  function projectPoint(x, y, z) {
    const camX = VIEW.centerX + state.camera.vx * 0.08 + state.camera.shakeX;
    const camY = VIEW.centerY + state.camera.vy * 0.08 + state.camera.shakeY;
    const scale = VIEW.viewDist / (z + VIEW.viewDist);
    return {
      x: camX + x * scale,
      y: camY + y * scale,
      scale
    };
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#060c16');
    grad.addColorStop(0.55, '#0b1627');
    grad.addColorStop(1, '#04070e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const glow = ctx.createRadialGradient(
      VIEW.centerX,
      VIEW.centerY - 80,
      20,
      VIEW.centerX,
      VIEW.centerY - 80,
      canvas.width * 0.7
    );
    glow.addColorStop(0, 'rgba(120,190,255,0.18)');
    glow.addColorStop(0.5, 'rgba(60,120,200,0.08)');
    glow.addColorStop(1, 'rgba(4,8,16,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    state.background.nebulae.forEach(nebula => {
      const nebulaGrad = ctx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.r);
      nebulaGrad.addColorStop(0, nebula.color);
      nebulaGrad.addColorStop(1, 'rgba(4,8,16,0)');
      ctx.fillStyle = nebulaGrad;
      ctx.beginPath();
      ctx.arc(nebula.x, nebula.y, nebula.r, 0, Math.PI * 2);
      ctx.fill();
    });

    state.background.stars.forEach(star => {
      const relX = star.x - state.camera.x * 0.08;
      const relY = star.y - state.camera.y * 0.08;
      const proj = projectPoint(relX, relY, star.z);
      const size = star.size * proj.scale;
      ctx.fillStyle = `rgba(210,230,255,${star.alpha})`;
      ctx.fillRect(proj.x, proj.y, size, size);
    });

    state.background.dust.forEach(puff => {
      const relX = puff.x - state.camera.x * 0.1;
      const relY = puff.y - state.camera.y * 0.1;
      const proj = projectPoint(relX, relY, puff.z);
      const size = puff.size * proj.scale * 1.2;
      ctx.fillStyle = 'rgba(180,210,255,0.25)';
      ctx.fillRect(proj.x, proj.y, size, size);
    });

    ctx.strokeStyle = 'rgba(90,160,220,0.12)';
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      let started = false;
      for (let z = 200; z <= VIEW.depth; z += 220) {
        const proj = projectPoint(i * 90, 0, z);
        if (!started) {
          ctx.moveTo(proj.x, proj.y);
          started = true;
        } else {
          ctx.lineTo(proj.x, proj.y);
        }
      }
      ctx.stroke();
    }
    for (let j = -2; j <= 2; j++) {
      ctx.beginPath();
      let started = false;
      for (let z = 200; z <= VIEW.depth; z += 220) {
        const proj = projectPoint(0, j * 70, z);
        if (!started) {
          ctx.moveTo(proj.x, proj.y);
          started = true;
        } else {
          ctx.lineTo(proj.x, proj.y);
        }
      }
      ctx.stroke();
    }

    state.background.streaks.forEach(streak => {
      const relX = streak.x - state.camera.x * 0.08;
      const relY = streak.y - state.camera.y * 0.08;
      const head = projectPoint(relX, relY, streak.z);
      const tail = projectPoint(relX, relY, Math.max(0, streak.z - streak.length));
      ctx.strokeStyle = state.forwardSpeed > state.baseSpeed * 1.05
        ? 'rgba(125,252,154,0.28)'
        : 'rgba(140,200,255,0.18)';
      ctx.lineWidth = Math.max(1, 2 * head.scale);
      ctx.beginPath();
      ctx.moveTo(head.x, head.y);
      ctx.lineTo(tail.x, tail.y);
      ctx.stroke();
    });
  }

  function drawGate(gate) {
    const relX = gate.x - state.player.x;
    const relY = gate.y - state.player.y;
    const proj = projectPoint(relX, relY, gate.z);
    const radius = gate.radius * proj.scale;
    const pulse = 0.6 + Math.sin((performance.now() + gate.z) / 380) * 0.4;
    ctx.strokeStyle = `rgba(125,252,154,${0.25 + pulse * 0.35})`;
    ctx.shadowColor = '#7dfc9a';
    ctx.shadowBlur = 14 * proj.scale;
    ctx.lineWidth = Math.max(1, 3.5 * proj.scale);
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(125,252,154,0.35)';
    ctx.lineWidth = Math.max(1, 1.6 * proj.scale);
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, radius * 0.65, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawDebris(debris) {
    const relX = debris.x - state.player.x;
    const relY = debris.y - state.player.y;
    const proj = projectPoint(relX, relY, debris.z);
    const r = debris.r * proj.scale;
    const grad = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, r);
    grad.addColorStop(0, 'rgba(190,210,240,0.7)');
    grad.addColorStop(1, 'rgba(90,110,140,0.35)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,190,220,0.4)';
    ctx.lineWidth = Math.max(1, 1.2 * proj.scale);
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, r * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawPickup(pickup) {
    const relX = pickup.x - state.player.x;
    const relY = pickup.y - state.player.y;
    const proj = projectPoint(relX, relY, pickup.z);
    const r = pickup.r * proj.scale;
    const pulse = 0.8 + Math.sin(performance.now() / 260 + pickup.z / 120) * 0.2;
    const color = pickup.type === 'data' ? '#7dfc9a' : pickup.type === 'shield' ? '#47f5ff' : '#ff7a47';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12 * proj.scale;
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, r * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawEnemy(enemy) {
    const relX = enemy.x - state.player.x;
    const relY = enemy.y - state.player.y;
    const proj = projectPoint(relX, relY, enemy.z);
    const size = enemy.size * proj.scale;
    const hitPulse = enemy.hitTimer > 0 ? Math.min(1, enemy.hitTimer / 140) : 0;
    ctx.save();
    ctx.translate(proj.x, proj.y);
    ctx.fillStyle = enemy.color;
    ctx.shadowColor = enemy.color;
    ctx.shadowBlur = (12 + hitPulse * 12) * proj.scale;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.8, size * 0.8);
    ctx.lineTo(-size * 0.8, size * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = Math.max(1, 1.2 * proj.scale);
    ctx.strokeStyle = hitPulse > 0 ? 'rgba(255,255,255,0.8)' : 'rgba(230,240,255,0.25)';
    ctx.stroke();

    ctx.fillStyle = `rgba(255,220,180,${0.25 + hitPulse * 0.35})`;
    ctx.beginPath();
    ctx.moveTo(-size * 0.35, size * 0.85);
    ctx.lineTo(0, size * 1.55);
    ctx.lineTo(size * 0.35, size * 0.85);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawBullets() {
    state.bullets.forEach(bullet => {
      const relX = bullet.x - state.player.x;
      const relY = bullet.y - state.player.y;
      const proj = projectPoint(relX, relY, bullet.z);
      ctx.fillStyle = '#e6f2ff';
      ctx.shadowColor = '#e6f2ff';
      ctx.shadowBlur = 8 * proj.scale;
      ctx.fillRect(proj.x - 2, proj.y - 4, 4, 8);
      ctx.shadowBlur = 0;
    });

    state.enemyBullets.forEach(bullet => {
      const relX = bullet.x - state.player.x;
      const relY = bullet.y - state.player.y;
      const proj = projectPoint(relX, relY, bullet.z);
      ctx.fillStyle = '#ffb347';
      ctx.shadowColor = '#ffb347';
      ctx.shadowBlur = 8 * proj.scale;
      ctx.fillRect(proj.x - 2, proj.y - 4, 4, 8);
      ctx.shadowBlur = 0;
    });
  }

  function drawParticles() {
    state.particles.forEach(p => {
      const relX = p.x - state.player.x;
      const relY = p.y - state.player.y;
      const proj = projectPoint(relX, relY, p.z);
      const size = p.size * proj.scale;
      ctx.fillStyle = `rgba(${p.color},${Math.min(1, p.life / 900)})`;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawPlayer() {
    const player = state.player;
    const shipX = VIEW.centerX + player.vx * 0.12;
    const shipY = VIEW.centerY + VIEW.shipOffsetY + player.vy * 0.12;
    const speed = Math.hypot(player.vx, player.vy);
    const drift = clamp(player.vx / (player.maxSpeed || 1), -1, 1) * 0.2;

    ctx.save();
    ctx.translate(shipX, shipY);
    ctx.rotate(player.angle + drift);

    ctx.fillStyle = '#7dfc9a';
    ctx.shadowColor = '#7dfc9a';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(18, 16);
    ctx.lineTo(8, 20);
    ctx.lineTo(-8, 20);
    ctx.lineTo(-18, 16);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(220,255,240,0.6)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(20,40,28,0.8)';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(6, 4);
    ctx.lineTo(-6, 4);
    ctx.closePath();
    ctx.fill();

    if (state.boostActive) {
      ctx.fillStyle = 'rgba(125,252,154,0.65)';
      ctx.beginPath();
      ctx.moveTo(-10, 20);
      ctx.lineTo(0, 40 + Math.random() * 8);
      ctx.lineTo(10, 20);
      ctx.closePath();
      ctx.fill();
    }

    const engineGlow = 0.25 + Math.min(1, speed / (player.maxSpeed || 1)) * 0.5;
    ctx.fillStyle = `rgba(125,252,154,${engineGlow})`;
    ctx.beginPath();
    ctx.moveTo(-6, 18);
    ctx.lineTo(0, 30);
    ctx.lineTo(6, 18);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    if (player.shield > 6) {
      ctx.strokeStyle = 'rgba(125,252,154,0.35)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(shipX, shipY, 26, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawNavArrow() {
    const gateTarget = state.gates
      .filter(gate => !gate.passed && gate.z > 0)
      .sort((a, b) => a.z - b.z)[0];
    const targetX = gateTarget ? gateTarget.x : 0;
    const targetY = gateTarget ? gateTarget.y : 0;
    const dx = targetX - state.player.x;
    const dy = targetY - state.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 8) return;

    const angle = Math.atan2(dy, dx);
    const arrowX = VIEW.centerX;
    const arrowY = VIEW.centerY - 70;
    ctx.save();
    ctx.translate(arrowX, arrowY);
    ctx.rotate(angle);
    ctx.strokeStyle = 'rgba(125,252,154,0.45)';
    ctx.fillStyle = 'rgba(125,252,154,0.2)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-6, -8);
    ctx.lineTo(-2, 0);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function render() {
    state.camera.shakeX = (Math.random() - 0.5) * 6 * state.shake;
    state.camera.shakeY = (Math.random() - 0.5) * 6 * state.shake;
    drawBackground();

    const renderables = [
      ...state.gates.map(item => ({ type: 'gate', item })),
      ...state.debris.map(item => ({ type: 'debris', item })),
      ...state.pickups.map(item => ({ type: 'pickup', item })),
      ...state.enemies.map(item => ({ type: 'enemy', item }))
    ];

    renderables.sort((a, b) => b.item.z - a.item.z);

    renderables.forEach(entry => {
      if (entry.type === 'gate') drawGate(entry.item);
      if (entry.type === 'debris') drawDebris(entry.item);
      if (entry.type === 'pickup') drawPickup(entry.item);
      if (entry.type === 'enemy') drawEnemy(entry.item);
    });

    drawParticles();
    drawBullets();
    drawPlayer();

    const retX = VIEW.centerX;
    const retY = VIEW.centerY - 70;
    ctx.strokeStyle = 'rgba(125,252,154,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(retX, retY, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(retX - 18, retY);
    ctx.lineTo(retX - 6, retY);
    ctx.moveTo(retX + 6, retY);
    ctx.lineTo(retX + 18, retY);
    ctx.moveTo(retX, retY - 18);
    ctx.lineTo(retX, retY - 6);
    ctx.moveTo(retX, retY + 6);
    ctx.lineTo(retX, retY + 18);
    ctx.stroke();

    drawNavArrow();

    if (state.stormLevel > 0) {
      const intensity = Math.min(0.35, state.stormLevel * 0.25);
      ctx.fillStyle = `rgba(60,120,200,${0.08 + intensity * 0.2})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = `rgba(120,200,255,${0.05 + intensity * 0.1})`;
      ctx.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const x = (i / 11) * canvas.width;
        const y = (Math.sin(performance.now() / 300 + i) * 0.4 + 0.5) * canvas.height;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 40, y + 20);
        ctx.stroke();
      }
    }

    if (state.hitFlash > 0) {
      ctx.fillStyle = `rgba(255,80,80,${0.18 * state.hitFlash})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (!state.running) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
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

  function updateHud() {
    if (!progress) return;
    const player = state.player;
    if (hudHp) hudHp.textContent = `Hull: ${Math.max(0, Math.round(player.hp))}`;
    if (hudShield) hudShield.textContent = `Shield: ${Math.round(player.shield)}`;
    if (hudCredits) hudCredits.textContent = `Credits: ${formatCredits(progress.credits)}`;
    if (hudChapter) hudChapter.textContent = `Chapter: ${state.chapterIndex + 1}/${JOURNEY.length}`;
    const segmentCount = currentChapter()?.segments?.length || 0;
    if (hudCheckpoint) hudCheckpoint.textContent = `Checkpoint: ${state.checkpointIndex}/${segmentCount}`;
    if (hudScore) {
      const segment = currentSegment();
      const segPct = segment ? Math.min(100, Math.round((state.segmentDistance / segment.length) * 100)) : 0;
      hudScore.textContent = `Drift: ${formatDistance(state.chapterDistance)} (${segPct}%)`;
    }
    updateObjectiveDisplay();
  }

  function bindInput() {
    if (window.__swarmBound) return;
    window.__swarmBound = true;
    document.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      input.keys[e.code] = true;
      if (e.code === 'KeyR') {
        restartFromCheckpoint();
      }
      if (e.code === 'Escape') pause();
    });
    document.addEventListener('keyup', (e) => {
      input.keys[e.code] = false;
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) pause();
    });
  }

  async function ensureProgress() {
    if (progressReady) return;
    progressReady = true;
    progress = await loadProgress();
    sanitizeProgress();
    applyUpgrades();
    updateUpgradeButtons();
    updateAuthNote();
    state.ready = true;
  }

  async function initSwarm() {
    bindInput();
    await ensureProgress();
    if (progress.chapter > JOURNEY.length) {
      showJourneyComplete();
      render();
      return;
    }
    setupChapter(progress.chapter - 1, progress.checkpoint);
    showChapterBriefing();
    render();

    if (!upgradesBound) {
      upgradeButtons.forEach(btn => {
        btn.addEventListener('click', () => purchaseUpgrade(btn.dataset.swarmUpgrade));
      });
      upgradesBound = true;
    }
  }

  function stopSwarm() {
    state.running = false;
    render();
  }

  startBtn?.addEventListener('click', () => {
    hideBriefing();
    start();
  });
  pauseBtn?.addEventListener('click', pause);
  resetBtn?.addEventListener('click', () => {
    progress.checkpoint = 0;
    queueSave();
    setupChapter(state.chapterIndex, 0);
    showChapterBriefing('Restarted');
  });

  window.initSwarm = initSwarm;
  window.stopSwarm = stopSwarm;
})();
