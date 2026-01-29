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

  const input = { keys: {} };

  const VIEW = {
    width: canvas.width,
    height: canvas.height,
    centerX: canvas.width / 2,
    centerY: canvas.height / 2,
    boundsX: 720,
    boundsY: 520
  };

  const BASE_SPEED = 90;
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
  const GAME_ID = 'driftline-journey';
  const GATE_STABILIZE_BASE = 1800;
  const GATE_STABILIZE_STEP = 220;
  const GATE_STABILIZE_DECAY = 0.55;

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
    baseSpeed: BASE_SPEED,
    boostActive: false,
    shake: 0,
    hitFlash: 0,
    stormPhase: 0,
    stormLevel: 0,
    objectiveText: '',
    statusTimer: 0,
    message: '',
    route: null,
    segmentGateIndex: 0,
    gateCharge: 0,
    gateChargeTarget: 0,
    signal: 100,
    signalCells: 0,
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
      angle: -Math.PI / 2,
      speed: 0
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
      nebulae: []
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
  let bestProgressScore = 0;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function toScreen(x, y) {
    return {
      x: VIEW.centerX + (x - state.camera.x),
      y: VIEW.centerY + (y - state.camera.y)
    };
  }

  function dist(aX, aY, bX, bY) {
    return Math.hypot(aX - bX, aY - bY);
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

  function buildRouteForChapter(chapter) {
    const rng = makeRng((chapter.seed || 1200) + 77);
    const segments = [];
    let x = 0;
    let y = 0;
    let distance = 0;
    let angle = rng() * Math.PI * 2;

    chapter.segments.forEach((segment, index) => {
      const turn = (rng() - 0.5) * 0.9;
      angle += turn;
      const dirX = Math.cos(angle);
      const dirY = Math.sin(angle);
      const gateCount = Math.max(1, segment.gates || 1);
      const step = segment.length / gateCount;
      const gates = [];
      for (let i = 1; i <= gateCount; i++) {
        const weave = (i % 2 === 0 ? 1 : -1) * (140 + rng() * 220);
        const jitter = (rng() - 0.5) * 120;
        const lateral = weave + jitter;
        const t = step * i;
        const gx = x + dirX * t - dirY * lateral;
        const gy = y + dirY * t + dirX * lateral;
        gates.push({
          x: gx,
          y: gy,
          radius: 80,
          passed: false,
          checkpoint: i === gateCount
        });
      }
      const endX = x + dirX * segment.length;
      const endY = y + dirY * segment.length;
      segments.push({
        index,
        startDistance: distance,
        startX: x,
        startY: y,
        endX,
        endY,
        dirX,
        dirY,
        length: segment.length,
        gates
      });
      x = endX;
      y = endY;
      distance += segment.length;
    });
    return { segments };
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

  function getGateChargeTarget() {
    const base = GATE_STABILIZE_BASE + state.chapterIndex * GATE_STABILIZE_STEP + state.segmentIndex * 140;
    return Math.min(3400, base + state.segmentGateIndex * 140);
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
    if (state.signal <= 30) {
      hudObjective.textContent = 'Objective: Signal critical — secure a relay cell, clear defenders, stabilize the gate.';
      return;
    }
    const currentGate = state.gates[state.segmentGateIndex];
    if (currentGate) {
      let threatCount = 0;
      state.enemies.forEach(enemy => {
        if (enemy.hp <= 0) return;
        if (dist(enemy.x, enemy.y, currentGate.x, currentGate.y) < 260) threatCount += 1;
      });
      if (state.signalCells <= 0) {
        hudObjective.textContent = 'Objective: Collect a relay cell to unlock the gate.';
        return;
      }
      if (threatCount > 0) {
        hudObjective.textContent = 'Objective: Clear gate defenders.';
        return;
      }
      hudObjective.textContent = 'Objective: Brake inside the ring to stabilize the gate.';
      return;
    }
    const active = state.challenges.find(ch => !ch.completed && !ch.failed);
    if (active) {
      let extra = '';
      if (active.type === 'kills' || active.type === 'collect') {
        extra = ` (${active.progress}/${active.target})`;
      }
      hudObjective.textContent = `Optional: ${active.text}${extra}`;
      return;
    }
    const gateTotal = state.gates.length;
    const gateIndex = gateTotal ? Math.min(state.segmentGateIndex + 1, gateTotal) : 0;
    const gateForStatus = state.gates[state.segmentGateIndex];
    let gateText = gateTotal ? ` • Gate ${gateIndex}/${gateTotal}` : '';
    if (gateForStatus && state.gateChargeTarget > 0) {
      const pct = Math.round((state.gateCharge / state.gateChargeTarget) * 100);
      gateText += pct > 0 ? ` • Stabilizing ${pct}%` : ' • Clear defenders + brake';
    }
    hudObjective.textContent = `Objective: ${state.objectiveText || '-'}${gateText}`;
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

  function getProgressScore() {
    const chapter = progress?.chapter || 1;
    const checkpoint = progress?.checkpoint || 0;
    return chapter * 100 + checkpoint;
  }

  function formatProgressScore(score) {
    if (!score) return '-';
    const chapter = Math.floor(score / 100);
    const checkpoint = score % 100;
    return `C${chapter}•CP${checkpoint}`;
  }

  async function loadBestProgressScore() {
    bestProgressScore = await getHighScore(GAME_ID);
    updateHud();
  }

  async function submitProgressScore() {
    const score = getProgressScore();
    const saved = await submitHighScore(GAME_ID, score);
    if (typeof saved === 'number') {
      bestProgressScore = saved;
      updateHud();
    }
  }

  function resetRunToSegment() {
    const chapter = currentChapter();
    const segment = currentSegment();
    if (!chapter || !segment) return;
    state.rng = makeRng((chapter.seed || 1000) + state.segmentIndex * 97);
    const routeSegment = state.route?.segments?.[state.segmentIndex];

    state.running = false;
    state.lastTime = 0;
    state.chapterDistance = routeSegment?.startDistance || 0;
    state.segmentDistance = 0;
    state.segmentTimer = 0;
    state.spawnTimer = 0;
    state.debrisTimer = 0;
    state.turretTimer = 0;
    state.dataTimer = 0;
    state.boostActive = false;
    state.shake = 0;
    state.stormPhase = 0;
    state.stormLevel = segment.hazards?.storm || 0;
    state.hullDamaged = false;
    state.boostUsed = false;
    state.objectiveText = `${segment.name} — ${chapter.objective}`;

    state.segmentGateIndex = 0;
    state.gates = routeSegment?.gates?.map(gate => ({
      ...gate,
      passed: false,
      threatSpawned: false,
      charge: 0
    })) || [];
    state.gateCharge = 0;
    state.gateChargeTarget = getGateChargeTarget();
    state.signal = 100;
    state.signalCells = 0;
    state.player.x = routeSegment?.startX || 0;
    state.player.y = routeSegment?.startY || 0;
    state.player.vx = 0;
    state.player.vy = 0;
    state.player.speed = 0;
    if (routeSegment) {
      state.player.angle = Math.atan2(routeSegment.dirY, routeSegment.dirX);
    } else {
      state.player.angle = -Math.PI / 2;
    }
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
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
    state.route = buildRouteForChapter(chapter);

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
    optional.push('Relay signal is draining — collect relay cells to unlock each gate.');
    optional.push('Clear defenders, then brake inside the ring to stabilize and restore signal.');
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
        vx: Math.cos(heading) * lateralSpeed + player.vx * 0.35,
        vy: Math.sin(heading) * lateralSpeed + player.vy * 0.35,
        life: 1400,
        damage: player.damage
      });
    }
    player.fireCooldown = player.fireDelay;
  }

  function spawnEnemy(type, opts = {}) {
    const def = ENEMY_TYPES[type] || ENEMY_TYPES.scout;
    const diff = getDifficulty();
    const hpScale = 0.82 + diff * 0.22;
    const speedScale = 0.95 + diff * 0.1;
    const fireScale = clamp(1.05 - diff * 0.05, 0.6, 1.05);
    const targetGate = state.gates[state.segmentGateIndex] || { x: state.player.x, y: state.player.y };
    const angleToGate = Math.atan2(targetGate.y - state.player.y, targetGate.x - state.player.x);
    const originX = opts.x ?? state.player.x;
    const originY = opts.y ?? state.player.y;
    let spawnAngle = angleToGate + randRange(-1.3, 1.3);
    if (typeof opts.angle === 'number') {
      spawnAngle = opts.angle;
    } else if (typeof opts.angleBias === 'number') {
      const spread = opts.angleSpread ?? 0.8;
      spawnAngle = opts.angleBias + randRange(-spread, spread);
    }
    const radius = randRange(opts.radiusMin ?? 420, opts.radiusMax ?? 720);
    const enemy = {
      type,
      x: originX + Math.cos(spawnAngle) * radius,
      y: originY + Math.sin(spawnAngle) * radius,
      hp: def.hp * hpScale,
      maxHp: def.hp * hpScale,
      size: def.size,
      color: def.color,
      speed: def.speed * speedScale,
      fireRate: def.fireRate * fireScale,
      damage: def.damage * (0.9 + diff * 0.2),
      static: !!def.static,
      vx: randRange(-40, 40),
      vy: randRange(-30, 30),
      turn: def.static ? 0 : 0.7 + diff * 0.3,
      fireCooldown: randRange(240, def.fireRate * fireScale),
      timer: randRange(0, 1000),
      pattern: state.rng() < 0.5 ? -1 : 1,
      hitTimer: 0,
      guardGate: !!opts.guardGate,
      anchorX: typeof opts.anchorX === 'number' ? opts.anchorX : null,
      anchorY: typeof opts.anchorY === 'number' ? opts.anchorY : null
    };
    state.enemies.push(enemy);
    return enemy;
  }

  function spawnEnemyWave(segment) {
    if (!segment) return;
    if (state.enemies.length > 14) return;
    const diff = getDifficulty();
    const formationRoll = state.rng();
    if (formationRoll < 0.3) {
      const type = pickWeighted(segment.mix);
      const spacing = 90;
      [-1, 0, 1].forEach(offset => {
        const enemy = spawnEnemy(type);
        if (enemy) {
          enemy.x += offset * spacing;
          enemy.y += Math.abs(offset) * 40;
        }
      });
      return;
    }
    const extra = diff > 1.4 && state.rng() < 0.4 ? 1 : 0;
    const count = 1 + (state.rng() < 0.5 ? 1 : 0) + extra;
    for (let i = 0; i < count; i++) {
      const type = pickWeighted(segment.mix);
      spawnEnemy(type);
    }
  }

  function spawnGateAmbush(gate) {
    const segment = currentSegment();
    if (!segment) return;
    const diff = getDifficulty();
    const count = Math.min(7, 2 + Math.floor(diff) + (state.rng() < 0.45 ? 1 : 0));
    const mix = { ...(segment.mix || { scout: 1 }) };
    mix.raider = (mix.raider || 0) + 0.2;
    mix.lancer = (mix.lancer || 0) + 0.15;
    for (let i = 0; i < count; i++) {
      const type = pickWeighted(mix);
      spawnEnemy(type, {
        x: gate.x,
        y: gate.y,
        radiusMin: 260,
        radiusMax: 460,
        guardGate: true,
        anchorX: gate.x,
        anchorY: gate.y
      });
    }
    if ((segment.hazards?.turret || diff > 1.6) && state.rng() < 0.5) {
      spawnEnemy('turret', {
        x: gate.x,
        y: gate.y,
        radiusMin: 140,
        radiusMax: 240,
        guardGate: true,
        anchorX: gate.x,
        anchorY: gate.y
      });
    }
    const cellCount = 1 + (state.rng() < 0.55 ? 1 : 0);
    for (let i = 0; i < cellCount; i++) {
      const angle = randRange(0, Math.PI * 2);
      const radius = randRange(90, 160);
      spawnPickup('signal', gate.x + Math.cos(angle) * radius, gate.y + Math.sin(angle) * radius);
    }
    setStatus('Gate locked: clear defenders and grab relay cells', 1800);
  }

  function spawnDebris() {
    state.debris.push({
      x: state.player.x + randRange(-VIEW.boundsX, VIEW.boundsX),
      y: state.player.y + randRange(-VIEW.boundsY, VIEW.boundsY),
      vx: randRange(-20, 20),
      vy: randRange(-20, 20),
      r: randRange(12, 26)
    });
  }

  function spawnGate() {
    const segment = state.route?.segments?.[state.segmentIndex];
    if (segment) {
      state.gates = segment.gates.map(gate => ({
        ...gate,
        passed: false,
        threatSpawned: false,
        charge: 0
      }));
      state.gateCharge = 0;
      state.gateChargeTarget = getGateChargeTarget();
    }
  }

  function spawnPickup(type, x, y) {
    state.pickups.push({
      type,
      x,
      y,
      r: type === 'data' ? 10 : type === 'signal' ? 11 : 12
    });
  }

  function spawnExplosion(x, y, color) {
    for (let i = 0; i < 12; i++) {
      state.particles.push({
        x,
        y,
        vx: randRange(-60, 60, Math.random),
        vy: randRange(-60, 60, Math.random),
        life: randRange(400, 900, Math.random),
        size: randRange(2, 5, Math.random),
        color: color || '255,140,90'
      });
    }
  }

  function emitThruster(reverse = false) {
    const player = state.player;
    const forwardAngle = player.angle;
    const angle = reverse ? forwardAngle : forwardAngle + Math.PI;
    const spread = 0.35;
    const strength = reverse ? 50 : 80;
    for (let i = 0; i < 2; i++) {
      const jitter = randRange(-spread, spread, Math.random);
      const dir = angle + jitter;
      const offset = reverse ? 18 : -18;
      const baseX = player.x + Math.cos(forwardAngle) * offset;
      const baseY = player.y + Math.sin(forwardAngle) * offset;
      state.particles.push({
        x: baseX + Math.cos(dir) * 4 + randRange(-3, 3, Math.random),
        y: baseY + Math.sin(dir) * 4 + randRange(-3, 3, Math.random),
        vx: Math.cos(dir) * strength + randRange(-20, 20, Math.random),
        vy: Math.sin(dir) * strength + randRange(-20, 20, Math.random),
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
        vx: randRange(-80, 80, Math.random),
        vy: randRange(-80, 80, Math.random),
        life: randRange(260, 520, Math.random),
        size: randRange(2, 4, Math.random),
        color: '255,90,90'
      });
    }
  }

  function updateBackground(dtSec) {
    const radius = 2400;
    state.background.stars.forEach(star => {
      if (Math.abs(star.x - state.camera.x) > radius || Math.abs(star.y - state.camera.y) > radius) {
        star.x = state.camera.x + randRange(-radius, radius, Math.random);
        star.y = state.camera.y + randRange(-radius, radius, Math.random);
      }
    });
    state.background.nebulae.forEach(nebula => {
      if (Math.abs(nebula.x - state.camera.x) > radius * 0.8 || Math.abs(nebula.y - state.camera.y) > radius * 0.8) {
        nebula.x = state.camera.x + randRange(-radius * 0.6, radius * 0.6, Math.random);
        nebula.y = state.camera.y + randRange(-radius * 0.6, radius * 0.6, Math.random);
      }
      nebula.x += Math.sin(performance.now() / 12000 + nebula.phase) * dtSec * 1.2;
      nebula.y += Math.cos(performance.now() / 15000 + nebula.phase) * dtSec * 1.1;
    });
  }

  function update(dt) {
    const dtSec = dt / 1000;
    const player = state.player;
    const segment = currentSegment();
    const routeSegment = state.route?.segments?.[state.segmentIndex];

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

    const boosting = input.keys.ShiftLeft || input.keys.ShiftRight;
    state.boostActive = boosting && player.boost > 0;
    if (state.boostActive) {
      player.boost = Math.max(0, player.boost - 36 * dtSec);
      state.boostUsed = true;
    } else {
      player.boost = Math.min(player.boostMax, player.boost + player.boostRegen * dtSec);
    }

    const thrusting = forward || reverse;
    const forwardX = Math.cos(player.angle);
    const forwardY = Math.sin(player.angle);
    let accel = 0;
    if (forward) {
      accel += player.thrust;
      if (Math.random() < 0.6) emitThruster(false);
    }
    if (reverse) {
      accel -= player.reverseThrust;
      if (Math.random() < 0.5) emitThruster(true);
    }
    if (state.boostActive && forward) {
      accel *= 1.35;
    }

    player.speed += accel * dtSec;
    const maxForward = player.maxSpeed + (state.boostActive ? 160 : 0);
    const maxReverse = player.maxSpeed * 0.55;
    player.speed = clamp(player.speed, -maxReverse, maxForward);
    const dragBase = thrusting ? player.drag : Math.max(0.97, player.drag - 0.015);
    player.speed *= Math.pow(dragBase, dtSec * 60);

    player.vx = forwardX * player.speed;
    player.vy = forwardY * player.speed;

    state.stormLevel = segment?.hazards?.storm || 0;
    if (state.stormLevel > 0) {
      state.stormPhase += dtSec * (0.6 + state.stormLevel);
      player.vx += Math.sin(state.stormPhase * 1.3) * state.stormLevel * 20 * dtSec;
      player.vy += Math.cos(state.stormPhase * 1.1) * state.stormLevel * 16 * dtSec;
    }

    const speed = Math.hypot(player.vx, player.vy);
    const maxActual = maxForward * (state.boostActive ? 1.05 : 1);
    if (speed > maxActual && speed > 0) {
      const scale = maxActual / speed;
      player.vx *= scale;
      player.vy *= scale;
      player.speed = maxActual;
    }

    player.x += player.vx * dtSec;
    player.y += player.vy * dtSec;

    state.camera.x += (player.x - state.camera.x) * 0.08;
    state.camera.y += (player.y - state.camera.y) * 0.08;
    state.camera.vx += (player.vx - state.camera.vx) * 0.08;
    state.camera.vy += (player.vy - state.camera.vy) * 0.08;

    if (player.fireCooldown > 0) player.fireCooldown -= dt;
    if (performance.now() - player.lastHit > 1200) {
      player.shield = Math.min(player.maxShield, player.shield + 22 * dtSec);
    }

    if (input.keys.Space) firePlayer();

    if (routeSegment) {
      const dx = player.x - routeSegment.startX;
      const dy = player.y - routeSegment.startY;
      state.segmentDistance = clamp(dx * routeSegment.dirX + dy * routeSegment.dirY, 0, routeSegment.length);
      state.chapterDistance = routeSegment.startDistance + state.segmentDistance;
      const lateral = Math.abs(dx * -routeSegment.dirY + dy * routeSegment.dirX);
      if (lateral > 320) {
        player.shield = Math.max(0, player.shield - 12 * dtSec);
        if (state.statusTimer <= 0) setStatus('Signal drift - return to the corridor', 1200);
      }
    }

    const signalDrain = 1.2 + getDifficulty() * 0.25;
    state.signal = clamp(state.signal - signalDrain * dtSec, 0, 100);

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
          if (state.enemies.length < 16) spawnEnemy('turret');
          state.turretTimer = 3200 / turretRate;
        }
      }

      const dataRate = segment.dataRate || 0;
      if (dataRate > 0) {
        state.dataTimer -= dt;
        if (state.dataTimer <= 0) {
          if (state.pickups.length < 10) {
            spawnPickup('data', player.x + randRange(-160, 160), player.y + randRange(-120, 120));
          }
          state.dataTimer = 2600 / dataRate;
        }
      }
    }

    const currentGate = state.gates[state.segmentGateIndex];
    const gateDistToPlayer = currentGate ? dist(player.x, player.y, currentGate.x, currentGate.y) : Infinity;
    const gatePressure = currentGate ? clamp(1 - gateDistToPlayer / 720, 0, 1) : 0;

    state.enemies.forEach(enemy => {
      enemy.timer += dt;
      if (enemy.hitTimer > 0) enemy.hitTimer -= dt;

      if (!enemy.static) {
        let targetX = player.x;
        let targetY = player.y;

        if (currentGate && (enemy.guardGate || gatePressure > 0.15)) {
          const bias = enemy.guardGate ? 0.75 : gatePressure * 0.45;
          targetX = targetX * (1 - bias) + currentGate.x * bias;
          targetY = targetY * (1 - bias) + currentGate.y * bias;
        }

        if (enemy.guardGate && currentGate) {
          const orbitRadius = enemy.type === 'raider' ? 220 : enemy.type === 'scout' ? 170 : 190;
          const orbitSpeed = enemy.type === 'scout' ? 220 : 280;
          const orbitAngle = enemy.timer / orbitSpeed * enemy.pattern;
          targetX = currentGate.x + Math.cos(orbitAngle) * orbitRadius;
          targetY = currentGate.y + Math.sin(orbitAngle) * orbitRadius;
        } else {
          if (enemy.type === 'scout') {
            targetX += Math.sin(enemy.timer / 180) * 110 * enemy.pattern;
            targetY += Math.cos(enemy.timer / 210) * 70;
          } else if (enemy.type === 'raider') {
            const angle = enemy.timer / 360 * enemy.pattern;
            targetX += Math.cos(angle) * 170;
            targetY += Math.sin(angle) * 120;
          } else if (enemy.type === 'lancer') {
            targetX += player.vx * 0.6;
            targetY += player.vy * 0.6;
          }

          const swayX = Math.sin(enemy.timer / 240) * 18 * enemy.pattern;
          const swayY = Math.cos(enemy.timer / 280) * 12 * enemy.pattern;
          targetX += swayX;
          targetY += swayY;
        }

        const turnRate = enemy.turn * (enemy.type === 'lancer' ? 1.25 : 1);
        const pressure = gatePressure > 0.35 ? 1.15 : 1;
        enemy.vx += (targetX - enemy.x) * turnRate * pressure * dtSec;
        enemy.vy += (targetY - enemy.y) * turnRate * pressure * dtSec;
        const sideSpeed = Math.hypot(enemy.vx, enemy.vy);
        const maxSide = enemy.speed * (enemy.type === 'scout' ? 1.18 : 1) * pressure;
        if (sideSpeed > maxSide) {
          const scale = maxSide / sideSpeed;
          enemy.vx *= scale;
          enemy.vy *= scale;
        }
        enemy.x += enemy.vx * dtSec;
        enemy.y += enemy.vy * dtSec;
      }

      enemy.fireCooldown -= dt;
      if (enemy.fireCooldown <= 0 && dist(enemy.x, enemy.y, player.x, player.y) < 900) {
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const len = Math.hypot(dx, dy) || 1;
        const jitter = randRange(-0.18, 0.18);
        const dirX = (dx / len) + jitter;
        const dirY = (dy / len) - jitter * 0.6;
        const dirLen = Math.hypot(dirX, dirY) || 1;
        const bulletSpeed = 300 + getDifficulty() * 48 + gatePressure * 45;
        state.enemyBullets.push({
          x: enemy.x,
          y: enemy.y,
          vx: (dirX / dirLen) * bulletSpeed,
          vy: (dirY / dirLen) * bulletSpeed,
          life: 1400,
          damage: enemy.damage
        });
        enemy.fireCooldown = enemy.fireRate + randRange(-250, 320);
      }
    });

    state.debris.forEach(debris => {
      debris.x += (debris.vx || 0) * dtSec;
      debris.y += (debris.vy || 0) * dtSec;
    });

    state.pickups.forEach(pickup => {
      pickup.x += (pickup.vx || 0) * dtSec;
      pickup.y += (pickup.vy || 0) * dtSec;
    });

    state.bullets.forEach(bullet => {
      bullet.x += bullet.vx * dtSec;
      bullet.y += bullet.vy * dtSec;
      bullet.life -= dt;
    });

    state.enemyBullets.forEach(bullet => {
      bullet.x += bullet.vx * dtSec;
      bullet.y += bullet.vy * dtSec;
      bullet.life -= dt;
    });

    state.particles.forEach(p => {
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.life -= dt;
    });

    updateBackground(dtSec);

    if (currentGate) {
      if (!currentGate.threatSpawned && gateDistToPlayer < currentGate.radius * 2.4) {
        spawnGateAmbush(currentGate);
        currentGate.threatSpawned = true;
      }

    const playerSpeed = Math.hypot(player.vx, player.vy);
    const slowEnough = playerSpeed < 50;
    let threatCount = 0;
      if (currentGate) {
        state.enemies.forEach(enemy => {
          if (enemy.hp <= 0) return;
          if (dist(enemy.x, enemy.y, currentGate.x, currentGate.y) < 260) threatCount += 1;
        });
      }
    const gateClear = threatCount === 0;
    const threatFactor = threatCount > 0 ? clamp(1 - threatCount * 0.08, 0.4, 1) : 1;
    if (gateDistToPlayer < currentGate.radius) {
      const speedFactor = slowEnough ? 1 : 0;
      if (state.signalCells <= 0) {
        state.gateCharge = Math.max(0, state.gateCharge - dt * 0.9);
        if (state.statusTimer <= 0) setStatus('Collect relay cells to unlock the gate', 1200);
      } else if (!gateClear) {
        state.gateCharge = Math.max(0, state.gateCharge - dt * 0.9);
        if (state.statusTimer <= 0) setStatus('Clear the gate defenders', 1200);
      } else {
        state.gateCharge = Math.min(state.gateChargeTarget, state.gateCharge + dt * speedFactor * threatFactor);
        if (!slowEnough && state.statusTimer <= 0) {
          setStatus('Brake to stabilize the gate', 1200);
        }
      }
      } else {
        state.gateCharge = Math.max(0, state.gateCharge - dt * (GATE_STABILIZE_DECAY + 0.15));
      }
      const chargeRatio = state.gateChargeTarget > 0 ? state.gateCharge / state.gateChargeTarget : 0;
      currentGate.charge = clamp(chargeRatio, 0, 1);

      if (gateDistToPlayer < currentGate.radius && slowEnough && gateClear && state.signalCells > 0) {
        state.signal = clamp(state.signal + 24 * dtSec, 0, 100);
      }

      if (state.gateCharge >= state.gateChargeTarget) {
        currentGate.passed = true;
        state.gateCharge = 0;
        state.signalCells = Math.max(0, state.signalCells - 1);
        if (currentGate.checkpoint) {
          reachCheckpoint();
          return;
        }
        addCredits(65, 'Gate stabilized');
        state.segmentGateIndex += 1;
        state.gateChargeTarget = getGateChargeTarget();
      }
    }

    state.bullets.forEach(bullet => {
      if (bullet.life <= 0) return;
      state.enemies.forEach(enemy => {
        if (bullet.life <= 0) return;
        if (enemy.hp <= 0) return;
        if (dist(bullet.x, bullet.y, enemy.x, enemy.y) < enemy.size + 6) {
          enemy.hp -= bullet.damage;
          enemy.hitTimer = 140;
          bullet.life = 0;
          if (enemy.hp <= 0) {
            const reward = enemy.type === 'lancer' ? 30 : enemy.type === 'raider' ? 20 : enemy.type === 'turret' ? 36 : 14;
            addCredits(reward);
            spawnExplosion(enemy.x, enemy.y, enemy.type === 'turret' ? '180,110,255' : '255,120,90');
            if (state.rng() < 0.12) {
              const roll = state.rng();
              const type = roll > 0.7 ? 'shield' : roll > 0.4 ? 'repair' : 'data';
              spawnPickup(type, enemy.x, enemy.y);
            }
            state.challenges.forEach(ch => {
              if (!ch.completed && !ch.failed && ch.type === 'kills' && ch.enemy === enemy.type) {
                ch.progress += 1;
              }
            });
          }
        }
      });
    });

    state.enemyBullets.forEach(bullet => {
      if (dist(bullet.x, bullet.y, player.x, player.y) < 18) {
        applyDamage(bullet.damage);
        bullet.life = 0;
      }
    });

    state.debris.forEach(debris => {
      if (dist(debris.x, debris.y, player.x, player.y) < debris.r + 16) {
        applyDamage(14);
        debris.hit = true;
      }
    });

    state.pickups.forEach(pickup => {
      if (dist(pickup.x, pickup.y, player.x, player.y) < pickup.r + 14) {
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
        if (pickup.type === 'signal') {
          state.signalCells += 1;
          setStatus('Relay cell acquired', 1200);
        }
        pickup.collected = true;
      }
    });

    state.enemies = state.enemies.filter(enemy => enemy.hp > 0 && dist(enemy.x, enemy.y, player.x, player.y) < 1800);
    state.bullets = state.bullets.filter(bullet => bullet.life > 0 && dist(bullet.x, bullet.y, player.x, player.y) < 2000);
    state.enemyBullets = state.enemyBullets.filter(bullet => bullet.life > 0 && dist(bullet.x, bullet.y, player.x, player.y) < 2000);
    state.debris = state.debris.filter(debris => !debris.hit && dist(debris.x, debris.y, player.x, player.y) < 1800);
    state.pickups = state.pickups.filter(pickup => !pickup.collected && dist(pickup.x, pickup.y, player.x, player.y) < 1800);
    state.particles = state.particles.filter(p => p.life > 0);

    if (state.signal <= 0) {
      state.running = false;
      resetRunToSegment();
      showDeathBriefing();
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
    submitProgressScore();

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
    submitProgressScore();

    if (progress.chapter > JOURNEY.length) {
      showJourneyComplete();
      return;
    }

    setupChapter(progress.chapter - 1, 0);
    showChapterBriefing('Next Run');
  }

  function initBackground() {
    const starField = 220;
    const radius = 2200;
    state.background.stars = [];
    state.background.nebulae = [];
    for (let i = 0; i < starField; i++) {
      state.background.stars.push({
        x: state.player.x + randRange(-radius, radius, Math.random),
        y: state.player.y + randRange(-radius, radius, Math.random),
        size: randRange(0.8, 2.4, Math.random),
        alpha: randRange(0.3, 0.9, Math.random)
      });
    }
    for (let i = 0; i < 5; i++) {
      state.background.nebulae.push({
        x: state.player.x + randRange(-radius * 0.7, radius * 0.7, Math.random),
        y: state.player.y + randRange(-radius * 0.7, radius * 0.7, Math.random),
        r: randRange(260, 420, Math.random),
        color: i % 2 === 0 ? 'rgba(80,140,255,0.1)' : 'rgba(125,252,154,0.1)',
        phase: randRange(0, Math.PI * 2, Math.random)
      });
    }
  }

  function drawBackground() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, '#060c16');
    grad.addColorStop(0.55, '#0b1627');
    grad.addColorStop(1, '#04070e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    state.background.nebulae.forEach(nebula => {
      const screen = toScreen(nebula.x, nebula.y);
      const nebulaGrad = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, nebula.r);
      nebulaGrad.addColorStop(0, nebula.color);
      nebulaGrad.addColorStop(1, 'rgba(4,8,16,0)');
      ctx.fillStyle = nebulaGrad;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, nebula.r, 0, Math.PI * 2);
      ctx.fill();
    });

    state.background.stars.forEach(star => {
      const screen = toScreen(star.x, star.y);
      const size = star.size;
      ctx.fillStyle = `rgba(210,230,255,${star.alpha})`;
      if (screen.x < -10 || screen.x > canvas.width + 10 || screen.y < -10 || screen.y > canvas.height + 10) return;
      ctx.fillRect(screen.x, screen.y, size, size);
    });
  }

  function drawCorridor() {
    const segment = state.route?.segments?.[state.segmentIndex];
    if (!segment) return;
    const halfWidth = 300;
    const offsetX = -segment.dirY * halfWidth;
    const offsetY = segment.dirX * halfWidth;
    const startLeft = toScreen(segment.startX + offsetX, segment.startY + offsetY);
    const endLeft = toScreen(segment.endX + offsetX, segment.endY + offsetY);
    const startRight = toScreen(segment.startX - offsetX, segment.startY - offsetY);
    const endRight = toScreen(segment.endX - offsetX, segment.endY - offsetY);

    ctx.strokeStyle = 'rgba(90,160,220,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(startLeft.x, startLeft.y);
    ctx.lineTo(endLeft.x, endLeft.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(startRight.x, startRight.y);
    ctx.lineTo(endRight.x, endRight.y);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(90,160,220,0.12)';
    ctx.setLineDash([8, 10]);
    ctx.beginPath();
    const centerStart = toScreen(segment.startX, segment.startY);
    const centerEnd = toScreen(segment.endX, segment.endY);
    ctx.moveTo(centerStart.x, centerStart.y);
    ctx.lineTo(centerEnd.x, centerEnd.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawGate(gate) {
    const screen = toScreen(gate.x, gate.y);
    const radius = gate.radius;
    const pulse = 0.6 + Math.sin(performance.now() / 380) * 0.4;
    const isCurrent = state.gates[state.segmentGateIndex] === gate;
    let threatCount = 0;
    if (isCurrent) {
      state.enemies.forEach(enemy => {
        if (enemy.hp <= 0) return;
        if (dist(enemy.x, enemy.y, gate.x, gate.y) < 260) threatCount += 1;
      });
    }
    const locked = isCurrent && state.signalCells <= 0;
    const contested = isCurrent && threatCount > 0;
    const ringColor = locked
      ? '255,209,102'
      : contested
        ? '255,120,120'
        : '125,252,154';
    ctx.strokeStyle = `rgba(${ringColor},${0.25 + pulse * 0.35})`;
    ctx.shadowColor = '#7dfc9a';
    ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = `rgba(${ringColor},0.35)`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius * 0.65, 0, Math.PI * 2);
    ctx.stroke();

    if (gate.charge && gate.charge > 0) {
      ctx.strokeStyle = 'rgba(125,252,154,0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(
        screen.x,
        screen.y,
        radius * 0.9,
        -Math.PI / 2,
        -Math.PI / 2 + Math.PI * 2 * gate.charge
      );
      ctx.stroke();
    }
  }

  function drawDebris(debris) {
    const screen = toScreen(debris.x, debris.y);
    const r = debris.r;
    const grad = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, r);
    grad.addColorStop(0, 'rgba(190,210,240,0.7)');
    grad.addColorStop(1, 'rgba(90,110,140,0.35)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(160,190,220,0.4)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, r * 0.7, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawPickup(pickup) {
    const screen = toScreen(pickup.x, pickup.y);
    const r = pickup.r;
    const pulse = 0.8 + Math.sin(performance.now() / 260) * 0.2;
    const color = pickup.type === 'data'
      ? '#7dfc9a'
      : pickup.type === 'signal'
        ? '#ffd166'
        : pickup.type === 'shield'
          ? '#47f5ff'
          : '#ff7a47';
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, r * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawEnemy(enemy) {
    const screen = toScreen(enemy.x, enemy.y);
    const size = enemy.size;
    const hitPulse = enemy.hitTimer > 0 ? Math.min(1, enemy.hitTimer / 140) : 0;
    ctx.save();
    ctx.translate(screen.x, screen.y);
    ctx.fillStyle = enemy.color;
    ctx.shadowColor = enemy.color;
    ctx.shadowBlur = 12 + hitPulse * 12;
    ctx.beginPath();
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.8, size * 0.8);
    ctx.lineTo(-size * 0.8, size * 0.8);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1.2;
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
      const proj = toScreen(bullet.x, bullet.y);
      ctx.fillStyle = '#e6f2ff';
      ctx.shadowColor = '#e6f2ff';
      ctx.shadowBlur = 8;
      ctx.fillRect(proj.x - 2, proj.y - 4, 4, 8);
      ctx.shadowBlur = 0;
    });

    state.enemyBullets.forEach(bullet => {
      const proj = toScreen(bullet.x, bullet.y);
      ctx.fillStyle = '#ffb347';
      ctx.shadowColor = '#ffb347';
      ctx.shadowBlur = 8;
      ctx.fillRect(proj.x - 2, proj.y - 4, 4, 8);
      ctx.shadowBlur = 0;
    });
  }

  function drawParticles() {
    state.particles.forEach(p => {
      const proj = toScreen(p.x, p.y);
      const size = p.size;
      ctx.fillStyle = `rgba(${p.color},${Math.min(1, p.life / 900)})`;
      ctx.beginPath();
      ctx.arc(proj.x, proj.y, size, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawPlayer() {
    const player = state.player;
    const shipX = VIEW.centerX + player.vx * 0.08;
    const shipY = VIEW.centerY + player.vy * 0.08;
    const speed = Math.hypot(player.vx, player.vy);

    ctx.save();
    ctx.translate(shipX, shipY);
    ctx.rotate(player.angle + Math.PI / 2);

    ctx.fillStyle = '#7dfc9a';
    ctx.shadowColor = '#7dfc9a';
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.lineTo(16, -6);
    ctx.lineTo(10, 18);
    ctx.lineTo(-10, 18);
    ctx.lineTo(-16, -6);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(220,255,240,0.6)';
    ctx.stroke();

    ctx.fillStyle = 'rgba(20,40,28,0.8)';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(5, 4);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();

    if (state.boostActive) {
      ctx.fillStyle = 'rgba(125,252,154,0.65)';
      ctx.beginPath();
      ctx.moveTo(-8, 20);
      ctx.lineTo(0, 42 + Math.random() * 8);
      ctx.lineTo(8, 20);
      ctx.closePath();
      ctx.fill();
    }

    const engineGlow = 0.25 + Math.min(1, speed / (player.maxSpeed || 1)) * 0.5;
    ctx.fillStyle = `rgba(125,252,154,${engineGlow})`;
    ctx.beginPath();
    ctx.moveTo(-7, 18);
    ctx.lineTo(0, 32);
    ctx.lineTo(7, 18);
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
    const gateTarget = state.gates[state.segmentGateIndex] || state.gates.find(gate => !gate.passed);
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

    ctx.save();
    ctx.fillStyle = 'rgba(125,252,154,0.6)';
    ctx.font = '12px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(dist)}m`, arrowX, arrowY + 22);
    ctx.restore();
  }

  function render() {
    state.camera.shakeX = (Math.random() - 0.5) * 6 * state.shake;
    state.camera.shakeY = (Math.random() - 0.5) * 6 * state.shake;
    drawBackground();
    drawCorridor();

    const renderables = [
      ...state.gates.map(item => ({ type: 'gate', item })),
      ...state.debris.map(item => ({ type: 'debris', item })),
      ...state.pickups.map(item => ({ type: 'pickup', item })),
      ...state.enemies.map(item => ({ type: 'enemy', item }))
    ];

    renderables.sort((a, b) => dist(b.item.x, b.item.y, state.player.x, state.player.y) - dist(a.item.x, a.item.y, state.player.x, state.player.y));

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
    if (hudShield) hudShield.textContent = `Shield: ${Math.round(player.shield)} • Cells: ${state.signalCells}`;
    if (hudCredits) hudCredits.textContent = `Credits: ${formatCredits(progress.credits)}`;
    if (hudChapter) {
      const bestLabel = bestProgressScore ? ` (Best ${formatProgressScore(bestProgressScore)})` : '';
      hudChapter.textContent = `Chapter: ${state.chapterIndex + 1}/${JOURNEY.length}${bestLabel}`;
    }
    const segmentCount = currentChapter()?.segments?.length || 0;
    if (hudCheckpoint) hudCheckpoint.textContent = `Checkpoint: ${state.checkpointIndex}/${segmentCount}`;
    if (hudScore) {
      const segment = currentSegment();
      const segPct = segment ? Math.min(100, Math.round((state.segmentDistance / segment.length) * 100)) : 0;
      const gateTotal = state.gates.length || 0;
      const gateIndex = gateTotal ? Math.min(state.segmentGateIndex + 1, gateTotal) : 0;
      const nextGate = state.gates[state.segmentGateIndex];
      const gateDist = nextGate ? Math.round(dist(player.x, player.y, nextGate.x, nextGate.y)) : 0;
      const gatePct = state.gateChargeTarget > 0 ? Math.round((state.gateCharge / state.gateChargeTarget) * 100) : 0;
      const gateText = gateTotal ? `Gate ${gateIndex}/${gateTotal} • ${gateDist}m` : 'Gate --';
      const stabilizeText = gatePct > 0 ? ` • Stabilize ${gatePct}%` : '';
      const cellText = `Cells ${state.signalCells}`;
      hudScore.textContent = `Drift: ${formatDistance(state.chapterDistance)} (${segPct}%) • ${gateText}${stabilizeText} • ${cellText} • Signal ${Math.round(state.signal)}%`;
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
    loadBestProgressScore();
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
