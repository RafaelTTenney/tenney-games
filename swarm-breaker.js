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
  const SAVE_VERSION = 8;
  const SAVE_KEY = `swarmBreakerSave_v${SAVE_VERSION}`;
  const WORLD_SEED = 284113;

  const WORLD = {
    sectorSize: 1050,
    gridRadius: 18,
    maxDepth: 14
  };
  WORLD.size = (WORLD.gridRadius * 2 + 1) * WORLD.sectorSize;
  WORLD.half = WORLD.size / 2;
  WORLD.boundary = WORLD.gridRadius * WORLD.sectorSize + WORLD.sectorSize * 0.4;

  const PHYSICS = {
    linearDamp: 0.986,
    assistDamp: 0.88,
    angularDamp: 0.86,
    maxAngular: 3.1,
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

  const BIOMES = {
    driftline: { name: 'Driftline', hue: 185, accent: '#6df0ff', fog: 'rgba(60,110,140,0.12)', dust: 'rgba(110,200,255,0.14)', threat: 0.85 },
    glasswake: { name: 'Glasswake', hue: 210, accent: '#7dfc9a', fog: 'rgba(70,140,180,0.12)', dust: 'rgba(140,220,255,0.12)', threat: 1.05 },
    stormvault: { name: 'Stormvault', hue: 260, accent: '#c77dff', fog: 'rgba(130,90,190,0.16)', dust: 'rgba(180,120,255,0.12)', threat: 1.25 },
    redshift: { name: 'Redshift', hue: 20, accent: '#ff8b5c', fog: 'rgba(180,80,60,0.14)', dust: 'rgba(255,160,120,0.12)', threat: 1.4 },
    bastion: { name: 'Bastion', hue: 135, accent: '#7dfc9a', fog: 'rgba(80,140,100,0.12)', dust: 'rgba(120,230,160,0.12)', threat: 1.55 },
    darklane: { name: 'Darklane', hue: 240, accent: '#8899ff', fog: 'rgba(70,80,150,0.18)', dust: 'rgba(120,140,220,0.12)', threat: 1.7 },
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
    lane: { id: 'lane', label: 'Transit Lane', boostMult: 1.35, spawnScale: 0.6, dustScale: 0.6 },
    rift: { id: 'rift', label: 'Rift Channel', boostMult: 2.05, spawnScale: 0.4, dustScale: 0.4 }
  };

  const BIOME_SPAWNS = {
    driftline: ['scout', 'fighter', 'interceptor'],
    glasswake: ['scout', 'fighter', 'sniper'],
    stormvault: ['interceptor', 'gunship', 'sniper'],
    redshift: ['fighter', 'bomber', 'gunship'],
    bastion: ['fighter', 'turret', 'gunship', 'bomber'],
    darklane: ['interceptor', 'sniper', 'fighter'],
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
    starforge: ['forge_fragments', 'arc_emitters'],
    hollow: ['relic_spires', 'echo_stones'],
    emberveil: ['ash_ruins', 'flare_towers'],
    solstice: ['prism_arches', 'light_fins'],
    blackout: ['obsidian_spires', 'silent_monoliths']
  };

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
    driftwave: { id: 'driftwave', label: 'Drift Wave', color: '#6df0ff', life: 14, radius: 120, effect: { boost: 20, energy: 12 } },
    meteor: { id: 'meteor', label: 'Meteor Shower', color: '#ff9f6b', life: 12, speed: 380, radius: 10, damage: 12 },
    riftflare: { id: 'riftflare', label: 'Rift Flare', color: '#ffd166', life: 10, radius: 80, effect: { boost: 30, fuel: 20 } }
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

  const TRADER_TYPES = [
    { id: 'scavenger', label: 'Scavenger Barge', color: '#9fd3c7', vibe: 'Buys salvage and sells ammo.' },
    { id: 'arms', label: 'Arms Freighter', color: '#ff9f6b', vibe: 'Stocks munitions and rare hardware.' },
    { id: 'engineer', label: 'Engineer Skiff', color: '#6df0ff', vibe: 'Trades upgrades for relics.' }
  ];

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
    { id: 'log_10', title: 'Pilot Journal', text: 'The Hollow Reach bends sound. Keep eyes on the thruster glow.' },
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
    { id: 'log_149', title: 'Rift Manual', text: 'Rift dash stabilizes during beacons.' },
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
    { id: 'log_160', title: 'Pilot Log', text: 'Fuel reserves stabilize after rift dash.' },
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
    { id: 'log_176', title: 'Laser Log', text: 'Lasers track faster targets.' }
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
    rift: [
      'Rift Channel: Supercharge ready.',
      'Warning: Rift turbulence at the edges.',
      'Aetherline: Rift beacons active.',
      'Transit: Boost fields detected.',
      'Rift Control: Hold tight through the surge.',
      'Comms: Warp echoes increasing.',
      'Signal: Rare ruin traces in the channel.',
      'Notice: Keep stabilizers engaged.',
      'Rift Channel: Velocity spikes expected.',
      'Ops: Enemy patrols scarce. Move fast.',
      'Rift Channel: Surge window open.',
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
      'Hollow: Sound bends strangely.',
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
    small: { id: 'small', label: 'Small Hull', baseHp: 110, baseShield: 80, size: 14, mass: 0.95, armor: 0.04, cargo: 6, unlockLevel: 1 },
    medium: { id: 'medium', label: 'Medium Hull', baseHp: 150, baseShield: 110, size: 18, mass: 1.1, armor: 0.06, cargo: 10, unlockLevel: 3 },
    large: { id: 'large', label: 'Large Hull', baseHp: 200, baseShield: 150, size: 24, mass: 1.3, armor: 0.08, cargo: 14, unlockLevel: 6 }
  };

  const ENGINES = {
    standard: { id: 'standard', label: 'Standard Pack', thrust: 420, reverse: 260, maxSpeed: 320, turnRate: 0.0056, boostRegen: 24, mass: 0.18, fuelRegen: 0.9 },
    turbo: { id: 'turbo', label: 'Turbo Pack', thrust: 475, reverse: 290, maxSpeed: 360, turnRate: 0.0059, boostRegen: 28, mass: 0.22, fuelRegen: 0.95 },
    hyper: { id: 'hyper', label: 'Hyper Pack', thrust: 530, reverse: 320, maxSpeed: 405, turnRate: 0.0064, boostRegen: 32, mass: 0.26, fuelRegen: 1.05 }
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
    slugs: { id: 'slugs', label: 'Rail Slugs', max: 140, price: 2 },
    missiles: { id: 'missiles', label: 'Missiles', max: 32, price: 8 },
    torpedoes: { id: 'torpedoes', label: 'Torpedoes', max: 14, price: 18 },
    flak: { id: 'flak', label: 'Flak Canisters', max: 90, price: 3 },
    mines: { id: 'mines', label: 'Mag Mines', max: 20, price: 6 }
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
    scanRadius: 540,
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
    riftDash: { active: false, timer: 0, cooldown: 0 },
    boundaryTimer: 0,
    boundaryWarning: 0,
    broadcastCooldown: 0,
    activeTrader: null,
    traderSelection: 0,
    traderQuote: '',
    rumorCooldown: 0,
    failureLedger: {},
    escape: { active: false, timer: 0 }
  };

  const world = {
    sectors: new Map(),
    gates: {},
    gatePositions: {},
    discovered: new Set(),
    bossDefeated: {},
    stationContracts: {},
    baseClaims: {},
    ruinClaims: {},
    systemNames: new Map(),
    homeBase: { x: 0, y: 0, radius: 80, name: 'Aetherline Bastion' }
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
    fuel: 120,
    riftCharge: 0,
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
    lore: new Set()
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

  const nebulaLayers = [
    createNebulaLayer({ seed: 1201, hue: 200, alpha: 0.45 }),
    createNebulaLayer({ seed: 1402, hue: 240, alpha: 0.35 }),
    createNebulaLayer({ seed: 1603, hue: 320, alpha: 0.25 }),
    createNebulaLayer({ seed: 1804, hue: 30, alpha: 0.2 })
  ];

  const starLayers = [
    createStarLayer({ seed: 2201, count: 460, sizeMin: 0.4, sizeMax: 1.4, speed: 0.4, tint: 'rgba(180,220,255,0.7)' }),
    createStarLayer({ seed: 2301, count: 360, sizeMin: 0.7, sizeMax: 1.9, speed: 0.65, tint: 'rgba(140,210,255,0.75)' }),
    createStarLayer({ seed: 2401, count: 240, sizeMin: 1.2, sizeMax: 2.8, speed: 0.95, tint: 'rgba(120,180,255,0.85)' })
  ];

  const dustField = createDustField({ seed: 3001, count: 160 });

  function noteStatus(message, duration = 3) {
    if (!statusText) return;
    statusText.textContent = message;
    state.statusTimer = duration;
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

  function getGateData() {
    const chapter = STORY[player.chapterIndex];
    if (!chapter) return null;
    const data = world.gatePositions?.[chapter.id];
    if (!data) return null;
    return data;
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

  function pickBiome(depth, gx, gy) {
    const bandIndex = Math.min(REGION_BANDS.length - 1, Math.max(0, Math.floor((depth - 1) / 2)));
    const band = REGION_BANDS[bandIndex];
    const rng = mulberry32(WORLD_SEED + gx * 41 + gy * 73 + depth * 11);
    return band[Math.floor(rng() * band.length)];
  }

  function pickZoneType(depth, gx, gy) {
    if (depth <= 1) return 'cluster';
    const n = smoothNoise(gx * 0.35, gy * 0.35, WORLD_SEED * 0.17);
    if (n < 0.16) return 'rift';
    if (n < 0.34) return 'lane';
    return 'cluster';
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
          if (pickZoneType(depth, gx, gy) === 'cluster') {
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

  function getSector(gx, gy) {
    const key = sectorKey(gx, gy);
    if (world.sectors.has(key)) return world.sectors.get(key);
    const depth = depthFromGrid(gx, gy);
    const biome = pickBiome(depth, gx, gy);
    const zoneType = pickZoneType(depth, gx, gy);
    const zone = ZONE_TYPES[zoneType] || ZONE_TYPES.cluster;
    const sector = {
      key,
      gx,
      gy,
      depth,
      biome,
      zoneType,
      zone,
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
        stations: [],
        bases: [],
        wrecks: [],
        ruins: [],
        riftBeacons: [],
        biomeProps: [],
        traders: [],
        caches: [],
        storms: [],
        anomalies: []
      },
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

  function generateSectorObjects(sector) {
    const seed = WORLD_SEED + sector.gx * 991 + sector.gy * 1999;
    const rng = mulberry32(Math.abs(seed));
    const biome = BIOMES[sector.biome];
    const center = posFromGrid(sector.gx, sector.gy);
    const zone = sector.zone || ZONE_TYPES.cluster;
    const isCluster = sector.zoneType === 'cluster';
    const clearZones = [];

    if (isCluster && rng() < 0.75) {
      const clearCount = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < clearCount; i += 1) {
        clearZones.push({
          x: center.x + randRange(rng, -220, 220),
          y: center.y + randRange(rng, -220, 220),
          radius: randRange(rng, 160, 240)
        });
      }
    }

    const inClearZone = (x, y) => clearZones.some((zone) => dist(x, y, zone.x, zone.y) < zone.radius);

    const asteroidCount = sector.zoneType === 'rift'
      ? 0
      : Math.floor(randRange(rng, 3, 12) * biome.threat * (isCluster ? 0.9 : zone.spawnScale * 0.35));
    for (let i = 0; i < asteroidCount; i += 1) {
      const radius = randRange(rng, 18, 58);
      const ax = center.x + randRange(rng, -360, 360);
      const ay = center.y + randRange(rng, -360, 360);
      if (inClearZone(ax, ay)) continue;
      sector.objects.asteroids.push({
        x: ax,
        y: ay,
        radius,
        points: generateAsteroidShape(rng, radius)
      });
    }

    if (rng() < (isCluster ? 0.35 : zone.id === 'lane' ? 0.18 : 0.12)) {
      const planet = {
        x: center.x + randRange(rng, -420, 420),
        y: center.y + randRange(rng, -420, 420),
        radius: randRange(rng, 60, 140),
        hue: randRange(rng, biome.hue - 20, biome.hue + 40),
        mass: randRange(rng, 0.6, 1.2),
        ring: rng() < 0.45
      };
      sector.objects.planets.push(planet);
      if (isCluster && rng() < 0.6) {
        const beltCount = 12 + Math.floor(rng() * 18);
        const beltRadius = planet.radius + randRange(rng, 50, 120);
        for (let i = 0; i < beltCount; i += 1) {
          const angle = rng() * Math.PI * 2;
          const jitter = randRange(rng, -24, 24);
          const radius = randRange(rng, 12, 34);
          const ax = planet.x + Math.cos(angle) * (beltRadius + jitter);
          const ay = planet.y + Math.sin(angle) * (beltRadius + jitter);
          if (inClearZone(ax, ay)) continue;
          sector.objects.asteroids.push({
            x: ax,
            y: ay,
            radius,
            points: generateAsteroidShape(rng, radius)
          });
        }
      }
    }

    if (rng() < (isCluster ? 0.4 : 0.16)) {
      sector.objects.stations.push({
        x: center.x + randRange(rng, -200, 200),
        y: center.y + randRange(rng, -200, 200),
        radius: randRange(rng, 42, 60)
      });
    }

    if (sector.zoneType !== 'rift' && rng() < (isCluster ? 0.22 : 0.12)) {
      const traderType = TRADER_TYPES[Math.floor(rng() * TRADER_TYPES.length)];
      sector.objects.traders.push({
        id: `${sector.key}-trader`,
        type: traderType.id,
        label: traderType.label,
        color: traderType.color,
        vibe: traderType.vibe,
        x: center.x + randRange(rng, -260, 260),
        y: center.y + randRange(rng, -260, 260),
        radius: randRange(rng, 22, 30),
        driftX: randRange(rng, -12, 12),
        driftY: randRange(rng, -12, 12),
        phase: rng() * Math.PI * 2
      });
    }

    if (isCluster && rng() < 0.28 + sector.depth * 0.02 && !world.baseClaims?.[sector.key] && !(sector.gx === 0 && sector.gy === 0)) {
      const baseKeys = Object.keys(BASE_TYPES);
      const baseType = BASE_TYPES[baseKeys[Math.min(baseKeys.length - 1, Math.floor(rng() * baseKeys.length))]];
      sector.objects.bases.push({
        id: `${sector.key}-base`,
        type: baseType.id,
        x: center.x + randRange(rng, -220, 220),
        y: center.y + randRange(rng, -220, 220),
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

    if (rng() < (isCluster ? 0.35 : 0.2)) {
      sector.objects.wrecks.push({
        x: center.x + randRange(rng, -320, 320),
        y: center.y + randRange(rng, -320, 320),
        radius: randRange(rng, 24, 50),
        salvage: Math.floor(randRange(rng, 1, 4))
      });
    }

    if (rng() < (isCluster ? 0.35 : 0.18) && !world.cacheClaims?.[sector.key]) {
      sector.objects.caches.push({
        x: center.x + randRange(rng, -300, 300),
        y: center.y + randRange(rng, -300, 300),
        radius: 18,
        blueprint: pickRandomBlueprint(rng)
      });
    }

    if (rng() < (isCluster ? 0.45 : 0.08)) {
      sector.objects.storms.push({
        x: center.x + randRange(rng, -320, 320),
        y: center.y + randRange(rng, -320, 320),
        radius: randRange(rng, 120, 220),
        intensity: randRange(rng, 0.3, 0.7)
      });
    }

    if (rng() < (isCluster ? 0.32 : 0.18)) {
      sector.objects.anomalies.push({
        x: center.x + randRange(rng, -280, 280),
        y: center.y + randRange(rng, -280, 280),
        radius: randRange(rng, 40, 70),
        charge: 0
      });
    }

    const propTypes = BIOME_PROPS[sector.biome] || [];
    const propCount = isCluster ? Math.floor(randRange(rng, 2, 6)) : Math.floor(randRange(rng, 1, 3));
    for (let i = 0; i < propCount; i += 1) {
      if (!propTypes.length) break;
      const type = propTypes[Math.floor(rng() * propTypes.length)];
      sector.objects.biomeProps.push({
        type,
        x: center.x + randRange(rng, -360, 360),
        y: center.y + randRange(rng, -360, 360),
        size: randRange(rng, 18, 52),
        hue: randRange(rng, biome.hue - 30, biome.hue + 40)
      });
    }

    if (!world.ruinClaims?.[sector.key] && rng() < (sector.zoneType === 'rift' ? 0.22 : isCluster ? 0.16 : 0.12)) {
      sector.objects.ruins.push({
        id: `${sector.key}-ruin`,
        x: center.x + randRange(rng, -240, 240),
        y: center.y + randRange(rng, -240, 240),
        radius: randRange(rng, 26, 46),
        guarded: rng() < (isCluster ? 0.5 : 0.7),
        loot: rng() < 0.6 ? 'blueprint' : 'relic',
        discovered: false
      });
    }

    if (!isCluster) {
      const beaconCount = sector.zoneType === 'rift' ? 3 : 1 + Math.floor(rng() * 2);
      for (let i = 0; i < beaconCount; i += 1) {
        sector.objects.riftBeacons.push({
          x: center.x + randRange(rng, -420, 420),
          y: center.y + randRange(rng, -420, 420),
          radius: randRange(rng, 30, 52),
          pulse: randRange(rng, 0, Math.PI * 2)
        });
      }
    }
  }

  function spawnBaseInSector(sector, baseTypeId) {
    if (!sector) return;
    const baseType = BASE_TYPES[baseTypeId] || BASE_TYPES.outpost;
    if (sector.objects.bases.length) return;
    const center = posFromGrid(sector.gx, sector.gy);
    sector.objects.bases.push({
      id: `${sector.key}-base`,
      type: baseType.id,
      x: center.x + randRange(Math.random, -140, 140),
      y: center.y + randRange(Math.random, -140, 140),
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

    const maxHp = hull.baseHp * (1 + upgrades.hull * 0.16);
    const maxShield = hull.baseShield * (1 + upgrades.shield * 0.18 + shield.capacityBonus);
    const mass = (hull.mass + engine.mass + droneBay.mass) * (1 + upgrades.hull * 0.04);
    const thrust = engine.thrust * (1 + upgrades.engine * 0.08) / mass;
    const reverseThrust = engine.reverse * (1 + upgrades.engine * 0.06) / mass;
    const maxSpeed = engine.maxSpeed * (1 + upgrades.engine * 0.05);
    const turnRate = engine.turnRate * (1 + upgrades.engine * 0.05);
    const torque = 5.2 * (1 + upgrades.engine * 0.08) / mass;
    let fireDelay = 0.12 * (1 - upgrades.blaster * 0.06);
    fireDelay = Math.max(0.08, fireDelay);
    const damage = 1 + upgrades.blaster * 0.12;
    const boostMax = BASE.boostMax * (1 + upgrades.booster * 0.22);
    const boostRegen = engine.boostRegen * (1 + upgrades.booster * 0.14);
    const fuelMax = 140 + upgrades.booster * 25;
    const fuelRegen = 0.45 + engine.fuelRegen * 0.2;
    const energyMax = BASE.energyMax * (1 + upgrades.capacitor * 0.2);
    const energyRegen = BASE.energyRegen * (1 + upgrades.capacitor * 0.16);
    const shieldRegen = shield.regen * (1 + upgrades.shield * 0.12);
    const shieldDelay = Math.max(0.6, shield.delay - upgrades.shield * 0.05);
    const armor = hull.armor + upgrades.hull * 0.02 + shield.resist;
    const cargoMax = hull.cargo + upgrades.hull * 2;

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
      energyMax,
      energyRegen,
      shieldRegen,
      shieldDelay,
      armor,
      mass,
      cargoMax,
      linearDamp: PHYSICS.linearDamp,
      assistDamp: PHYSICS.assistDamp,
      angularDamp: PHYSICS.angularDamp,
      maxAngular: PHYSICS.maxAngular,
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
    player.angularVelocity = 0;
    player.throttle = 0;
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
      player.fuel = BASE.boostMax;
      player.riftCharge = 0;
      player.angularVelocity = 0;
      player.throttle = 0;
      player.flightAssist = true;
      player.upgrades = { engine: 0, blaster: 0, capacitor: 0, shield: 0, hull: 0, booster: 0 };
      player.blueprints = new Set();
      player.cosmetics = new Set();
      player.toys = new Set();
      player.lore = new Set();
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
      player.ammo = { slugs: 60, missiles: 12, torpedoes: 4, flak: 50, mines: 6 };
      player.inventory.cargo = { salvage: 0, alloys: 0, relics: 0 };
      player.chapterIndex = 0;
      player.distanceThisChapter = 0;
      player.distanceTotal = 0;
      player.checkpointIndex = 0;
      state.storyLog = [];
      state.loreScroll = 0;
      state.unlockedDepth = 1;
      state.lastZoneType = '';
      state.riftDash = { active: false, timer: 0, cooldown: 0 };
      state.boundaryTimer = 0;
      state.boundaryWarning = 0;
      state.broadcastCooldown = 0;
      state.activeTrader = null;
      state.traderSelection = 0;
      state.traderQuote = '';
      state.rumorCooldown = 0;
      state.failureLedger = {};
      state.escape = { active: false, timer: 0 };
      world.discovered.clear();
      world.bossDefeated = {};
      world.stationContracts = {};
      world.baseClaims = {};
      world.ruinClaims = {};
      world.systemNames = new Map();
      world.gatePositions = {};
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
      shield: def.role === 'bomber' ? 20 : 0,
      armor: def.armor || 0,
      hangar: def.hangar ? Math.floor(def.hangar * scale) : 0,
      spawnCooldown: def.hangar ? randRange(Math.random, 1.4, 3.4) : 0,
      cargo: def.role === 'transport' ? 3 + Math.floor(scale * 2) : 0
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
      isBoss: true,
      armor: 0.18,
      hangar: 6,
      spawnCooldown: 2.4
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

  function spawnSectorEvent(sector) {
    if (!sector) return;
    const rng = mulberry32(WORLD_SEED + sector.gx * 23 + sector.gy * 37 + Math.floor(state.time * 3));
    const center = posFromGrid(sector.gx, sector.gy);
    let pool = ['comet', 'distress', 'driftwave'];
    if (sector.zoneType === 'rift') pool = ['riftflare', 'comet'];
    if (sector.zoneType === 'lane') pool = ['comet', 'distress', 'driftwave'];
    if (sector.zoneType === 'cluster') pool = ['distress', 'meteor', 'comet'];
    const type = pool[Math.floor(rng() * pool.length)];
    const def = EVENT_DEFS[type];
    if (!def) return;
    const angle = rng() * Math.PI * 2;
    const radius = randRange(rng, 200, 420);
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
      if (state.riftDash?.active) {
        final *= 0.35;
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
    state.running = false;
    noteStatus('Hull breach. Press Start to relaunch.');
    submitHighScore(GAME_ID, Math.floor(player.distanceTotal));
  }

  function handleEnemyDeath(enemy) {
    awardCredits(Math.round(28 + enemy.maxHp * 0.45));
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
      spawnLoot(enemy.x, enemy.y, 'salvage', 1);
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
    if (getCargoCount() < cachedStats.cargoMax) {
      player.inventory.cargo.salvage += 2 + Math.floor(sector.depth * 0.4);
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

  function tryRiftDash(sector) {
    if (!sector || (sector.zoneType !== 'rift' && sector.zoneType !== 'lane')) {
      noteStatus('Rift dash only in transit zones.');
      return;
    }
    if (state.riftDash.cooldown > 0) {
      noteStatus('Rift drive cooling.');
      return;
    }
    if (player.riftCharge < 60) {
      noteStatus('Rift charge insufficient.');
      return;
    }
    state.riftDash.active = true;
    state.riftDash.timer = 1.3;
    state.riftDash.cooldown = 6;
    player.riftCharge = 0;
    noteStatus('Rift dash engaged.');
  }

  function triggerEscape(sector) {
    if (state.escape.active) return;
    state.escape.active = true;
    state.escape.timer = 1.8;
    state.paused = true;
    state.mode = 'flight';
    noteStatus(`Escape jump engaged from ${sector?.name || 'sector'}.`);
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
      if (mission.active) failMission('escape');
      noteStatus('Escape complete. Returned to base.');
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
    const boostDrain = sector.zoneType === 'rift' ? 24 : sector.zoneType === 'lane' ? 30 : 35;
    const fuelDrain = sector.zoneType === 'rift' ? 8 : sector.zoneType === 'lane' ? 10 : 12;
    const chargeRate = sector.zoneType === 'rift' ? 18 : sector.zoneType === 'lane' ? 10 : -6;

    if (state.riftDash.cooldown > 0) {
      state.riftDash.cooldown = Math.max(0, state.riftDash.cooldown - dt);
    }
    player.riftCharge = clamp(player.riftCharge + chargeRate * dt, 0, 100);

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

    if ((input.justPressed['KeyB'] || input.justPressed['ShiftLeft'] || input.justPressed['ShiftRight']) && player.boost > 20 && player.fuel > 12) {
      state.shiftBoost.active = true;
      state.shiftBoost.timer = 3;
    }

    if (state.shiftBoost.active) {
      const boostHeld = input.keys['KeyB'] || input.keys['ShiftLeft'] || input.keys['ShiftRight'];
      if (!boostHeld && state.shiftBoost.timer < 2.7) {
        state.shiftBoost.active = false;
      }
      const boostThrust = cachedStats.thrust * 1.8 * zoneBoost;
      player.vx += dir.x * boostThrust * dt;
      player.vy += dir.y * boostThrust * dt;
      player.boost = clamp(player.boost - boostDrain * dt, 0, cachedStats.boostMax);
      player.fuel = clamp(player.fuel - fuelDrain * dt, 0, cachedStats.fuelMax);
      state.shiftBoost.timer -= dt;
      missionTracker.noBoost = false;
      const boostColor = sector.zoneType === 'rift' ? '#ffd166' : '#7dfc9a';
      spawnEffect(player.x - dir.x * 18, player.y - dir.y * 18, boostColor);
      spawnParticle(player.x - dir.x * 20, player.y - dir.y * 20, `rgba(125,252,154,${sector.zoneType === 'rift' ? 0.9 : 0.8})`, 0.5, 4, -dir.x * 80, -dir.y * 80);
      if (state.shiftBoost.timer <= 0 || player.boost <= 0 || player.fuel <= 0) {
        state.shiftBoost.active = false;
      }
    } else {
      player.boost = clamp(player.boost + cachedStats.boostRegen * dt, 0, cachedStats.boostMax);
      player.fuel = clamp(player.fuel + cachedStats.fuelRegen * dt, 0, cachedStats.fuelMax);
    }

    if (state.riftDash.active) {
      state.shiftBoost.active = false;
      const dashThrust = cachedStats.thrust * 2.8 * zoneBoost;
      player.vx += dir.x * dashThrust * dt;
      player.vy += dir.y * dashThrust * dt;
      player.boost = clamp(player.boost - boostDrain * 0.4 * dt, 0, cachedStats.boostMax);
      player.fuel = clamp(player.fuel - fuelDrain * 0.6 * dt, 0, cachedStats.fuelMax);
      state.riftDash.timer -= dt;
      spawnEffect(player.x - dir.x * 24, player.y - dir.y * 24, '#ffd166', 10);
      spawnParticle(player.x - dir.x * 26, player.y - dir.y * 26, 'rgba(255,209,102,0.8)', 0.6, 5, -dir.x * 120, -dir.y * 120);
      if (state.riftDash.timer <= 0 || player.fuel <= 0) {
        state.riftDash.active = false;
      }
    }

    if (player.flightAssist) {
      const lateralSpeed = player.vx * lateral.x + player.vy * lateral.y;
      const assistForce = (1 - cachedStats.assistDamp) * dt * 60;
      player.vx -= lateral.x * lateralSpeed * assistForce;
      player.vy -= lateral.y * lateralSpeed * assistForce;
    }

    player.vx *= Math.pow(cachedStats.linearDamp, dt * 60);
    player.vy *= Math.pow(cachedStats.linearDamp, dt * 60);

    const speed = Math.hypot(player.vx, player.vy);
    const dashMult = state.riftDash.active ? 2.2 : 1;
    const maxSpeed = cachedStats.maxSpeed * zoneBoost * (state.shiftBoost.active ? 1.5 : 1) * dashMult;
    if (speed > maxSpeed) {
      const scale = maxSpeed / (speed || 1);
      player.vx *= scale;
      player.vy *= scale;
    }

    player.x += player.vx * dt;
    player.y += player.vy * dt;

    const radial = Math.hypot(player.x, player.y);
    const boundary = state.unlockedDepth * WORLD.sectorSize + WORLD.sectorSize * 0.35;
    if (radial > boundary) {
      const dirBack = normalize(player.x, player.y);
      player.x = dirBack.x * boundary;
      player.y = dirBack.y * boundary;
      player.vx *= -0.15;
      player.vy *= -0.15;
      state.boundaryTimer += dt;
      if (state.boundaryTimer > 1.2) {
        applyDamage(player, 10);
        state.boundaryTimer = 0.6;
      }
      if (state.boundaryWarning <= 0) {
        noteStatus('Rift boundary pressure rising.');
        state.boundaryWarning = 2.5;
      }
      if (radial > boundary + 80 && (state.riftDash.active || state.shiftBoost.active) && sector.zoneType !== 'cluster') {
        triggerEscape(sector);
      }
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
    const biome = BIOMES[sector.biome];
    const zone = sector.zone || ZONE_TYPES.cluster;
    sector.spawnTimer -= dt;
    if (sector.spawnTimer > 0) return;
    const maxEnemies = Math.floor((4 + player.level * 1.5 + sector.depth) * zone.spawnScale);
    if (entities.enemies.length >= maxEnemies) return;

    const rng = mulberry32(WORLD_SEED + sector.gx * 77 + sector.gy * 91 + Math.floor(state.time * 7));
    const baseChoices = BIOME_SPAWNS[sector.biome] || ['scout', 'fighter'];
    const choices = [...baseChoices];
    if (sector.depth >= 5) choices.push('bomber');
    if (sector.depth >= 6) choices.push('turret');
    if (sector.depth >= 5) choices.push('transport');
    if (sector.depth >= 8 && Math.random() < 0.35) choices.push('carrier');
    const threatScale = biome.threat + player.level * 0.05;
    const count = clamp(Math.floor((randRange(rng, 1, 3) + sector.depth * 0.3) * zone.spawnScale), 1, 4);
    for (let i = 0; i < count; i += 1) {
      const type = choices[Math.floor(rng() * choices.length)];
      const angle = rng() * Math.PI * 2;
      const radius = randRange(rng, 240, 520);
      spawnEnemy(type, player.x + Math.cos(angle) * radius, player.y + Math.sin(angle) * radius, threatScale);
    }
    sector.spawnTimer = randRange(rng, 1.1, 2.8) / (threatScale * zone.spawnScale);
  }

  function updateEnemyAI(enemy, dt, sector) {
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
    } else if (enemy.role === 'interceptor') {
      const dir = normalize(dx, dy);
      if (distance > 180) {
        enemy.vx += dir.x * speed * 1.4 * dt;
        enemy.vy += dir.y * speed * 1.4 * dt;
      } else {
        enemy.vx += -dir.y * speed * 1.2 * dt;
        enemy.vy += dir.x * speed * 1.2 * dt;
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
    } else if (enemy.role === 'carrier' || enemy.role === 'transport') {
      const dir = normalize(dx, dy);
      if (distance < 320) {
        enemy.vx -= dir.x * speed * 0.8 * dt;
        enemy.vy -= dir.y * speed * 0.8 * dt;
      } else if (distance > 520) {
        enemy.vx += dir.x * speed * 0.6 * dt;
        enemy.vy += dir.y * speed * 0.6 * dt;
      } else {
        enemy.vx += -dir.y * speed * 0.25 * dt;
        enemy.vy += dir.x * speed * 0.25 * dt;
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

    const avoid = computeAvoidance(enemy, sector);
    enemy.vx += avoid.x * speed * 0.4 * dt;
    enemy.vy += avoid.y * speed * 0.4 * dt;

    if (enemy.isBoss && enemy.phase >= 2 && Math.random() < 0.012) {
      const angle = Math.random() * Math.PI * 2;
      spawnEnemy('fighter', enemy.x + Math.cos(angle) * 60, enemy.y + Math.sin(angle) * 60, 1 + enemy.phase * 0.2);
    }

    if ((enemy.role === 'carrier' || enemy.role === 'transport') && enemy.hangar > 0) {
      enemy.spawnCooldown -= dt;
      if (enemy.spawnCooldown <= 0) {
        const choice = enemy.role === 'carrier' ? (Math.random() < 0.5 ? 'fighter' : 'interceptor') : 'scout';
        const angle = Math.random() * Math.PI * 2;
        const radius = enemy.size + 30;
        spawnEnemy(choice, enemy.x + Math.cos(angle) * radius, enemy.y + Math.sin(angle) * radius, 1 + enemy.threat * 0.2);
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
      enemy.fireCooldown = enemy.isBoss ? 0.5 : enemy.def.fireRate;
      const dir = normalize(player.x - enemy.x, player.y - enemy.y);
      let weapon = { damage: enemy.def.damage, speed: 360, color: enemy.isBoss ? '#ffb347' : '#ff6b6b' };
      if (enemy.role === 'bomber') weapon = { damage: enemy.def.damage * 1.4, speed: 300, color: '#ff6b6b', splash: 18 };
      if (enemy.role === 'gunship') weapon = { damage: enemy.def.damage * 1.2, speed: 340, color: '#ff9f6b', spread: 0.25, projectiles: 3 };
      if (enemy.role === 'transport') weapon = { damage: enemy.def.damage, speed: 260, color: '#ffd166', spread: 0.45, projectiles: 4 };
      if (enemy.role === 'carrier') weapon = { damage: enemy.def.damage * 1.1, speed: 280, color: '#ffb347', splash: 20 };
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
            splash: weapon.splash || 0
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

  function updateBases(dt) {
    const sector = getCurrentSector();
    if (!sector.objects.bases.length) return;
    sector.objects.bases.forEach((base) => {
      if (base.hp <= 0) return;
      base.spawnTimer -= dt;
      if (base.spawnTimer <= 0) {
        const spawnList = base.def.spawn || ['scout'];
        const spawnType = spawnList[Math.floor(Math.random() * spawnList.length)];
        const angle = Math.random() * Math.PI * 2;
        const radius = base.radius + 40;
        spawnEnemy(spawnType, base.x + Math.cos(angle) * radius, base.y + Math.sin(angle) * radius, 1 + sector.depth * 0.08);
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

    sector.objects.asteroids.forEach((asteroid) => checkObstacle(asteroid.x, asteroid.y, asteroid.radius));
    sector.objects.bases.forEach((base) => checkObstacle(base.x, base.y, base.radius));
    sector.objects.planets.forEach((planet) => checkObstacle(planet.x, planet.y, planet.radius + 40));
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

    sector.objects.asteroids.forEach((asteroid) => {
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
        player.vx *= PHYSICS.collisionDamp;
        player.vy *= PHYSICS.collisionDamp;
        const impact = clamp(Math.hypot(player.vx, player.vy) * 0.08, 6, 18);
        applyDamage(player, impact);
        spawnEffect(player.x, player.y, '#ff6b6b');
        addCameraShake(0.8, 0.2);
      }
    });

    sector.objects.asteroids.forEach((asteroid) => {
      entities.enemies.forEach((enemy) => {
        if (enemy.hp <= 0) return;
        const d = dist(enemy.x, enemy.y, asteroid.x, asteroid.y);
        if (d < asteroid.radius + enemy.size) {
          const push = normalize(enemy.x - asteroid.x, enemy.y - asteroid.y);
          enemy.x = asteroid.x + push.x * (asteroid.radius + enemy.size + 2);
          enemy.y = asteroid.y + push.y * (asteroid.radius + enemy.size + 2);
          enemy.vx *= -0.4;
          enemy.vy *= -0.4;
          enemy.hp -= 8;
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
        spawnParticle(player.x, player.y, 'rgba(255,209,102,0.45)', 0.25, 2, 0, 0);
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
      if (dist(shot.x, shot.y, player.x, player.y) < cachedStats.size + 6) {
        shot.life = 0;
        applyDamage(player, shot.damage);
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
        const spawnCount = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < spawnCount; i += 1) {
          const angle = Math.random() * Math.PI * 2;
          const radius = ruin.radius + 80 + i * 12;
          const type = Math.random() < 0.6 ? 'interceptor' : 'gunship';
          spawnEnemy(type, ruin.x + Math.cos(angle) * radius, ruin.y + Math.sin(angle) * radius, 1 + sector.depth * 0.1);
        }
        noteStatus('Ruins activated. Defenders inbound.');
        return;
      }
      if (distanceToRuin < ruin.radius + cachedStats.size) {
        world.ruinClaims = world.ruinClaims || {};
        world.ruinClaims[sector.key] = true;
        if (ruin.loot === 'blueprint') {
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
          spawnEnemy(mission.type === 'carrier' ? 'carrier' : 'transport', center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius, 1 + sector.depth * 0.12);
        }
        mission.spawned = true;
      }
    }
  }

  function completeMission() {
    if (!mission.active) return;
    mission.active = false;
    awardCredits(mission.reward, 'Mission complete');
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
    noteStatus(`Mission failed (${reason}). Penalty -${penalty} credits.`);
    pushStoryLog(`Mission failed (${reason}).`);
  }

  function startChapterMission() {
    const chapter = STORY[player.chapterIndex];
    if (!chapter) return;
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
    mission.spawned = false;
    mission.timeLimit = 420 + chapter.depth * 90;
    mission.timeRemaining = mission.timeLimit;
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

    const checkpoints = Math.min(3, Math.floor((player.distanceThisChapter / (WORLD.sectorSize * 3)) * 3));
    if (checkpoints > player.checkpointIndex) {
      player.checkpointIndex = checkpoints;
      setCheckpoint();
      awardCredits(160, 'Checkpoint reached');
    }

    updateMissionProgress();

    if (mission.active && mission.timeRemaining > 0) {
      mission.timeRemaining -= dt;
      if (mission.timeRemaining <= 0) {
        failMission('timeout');
      }
    }
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
    const trader = sector.objects.traders.find((t) => dist(player.x, player.y, t.x, t.y) < t.radius + 60);
    const home = world.homeBase && dist(player.x, player.y, world.homeBase.x, world.homeBase.y) < world.homeBase.radius + 50 ? world.homeBase : null;
    if (station) {
      noteStatus('Station in range. Press E to dock.');
      if (input.justPressed['KeyE']) {
        state.mode = 'station';
        state.paused = true;
        state.menuSelection = 0;
        noteStatus('Docked at station.');
      }
      return;
    }
    if (home) {
      noteStatus('Home base in range. Press E to dock.');
      if (input.justPressed['KeyE']) {
        state.mode = 'station';
        state.paused = true;
        state.menuSelection = 0;
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
      { type: 'convoy', text: 'Break transport convoy', target: 2 + Math.floor(rng() * 2) },
      { type: 'carrier', text: 'Disable carrier hulls', target: 1 + Math.floor(rng() * 2) },
      { type: 'base', text: 'Strike enemy outpost', target: 1 }
    ];
    if (sector.zoneType !== 'cluster') {
      const index = templates.findIndex((item) => item.type === 'base');
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
    noteStatus(`Contract accepted: ${contract.text}`);
  }

  function completeContract() {
    if (!contract.active) return;
    awardCredits(contract.reward, 'Contract complete');
    contract.active = false;
    contract.progress = 0;
  }

  function update(dt) {
    if (updateEscape(dt)) {
      updateStatusTimer(dt);
      updateHud();
      updateUpgradeButtons();
      if (state.boundaryWarning > 0) state.boundaryWarning = Math.max(0, state.boundaryWarning - dt);
      if (state.broadcastCooldown > 0) state.broadcastCooldown = Math.max(0, state.broadcastCooldown - dt);
      if (state.rumorCooldown > 0) state.rumorCooldown = Math.max(0, state.rumorCooldown - dt);
      input.justPressed = {};
      return;
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

    if (input.justPressed['KeyV']) {
      tryRiftDash(getCurrentSector());
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
    updateEnemies(dt);
    updateBases(dt);
    updateTraders(dt);
    updateProjectiles(dt);
    updateDrones(dt);
    updateLoot(dt);
    updateEffects(dt);
    updateParticles(dt);
    updateEvents(dt);
    handleCollisions(dt);
    updateProgress(dt);
    updateDifficulty();
    updateStationInteraction();
    updateContractProgress();
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
      hudScore.textContent = `Distance: ${Math.floor(player.distanceTotal)} | Lvl ${player.level} | Fuel ${Math.round(player.fuel)} | ${sector.zone?.label || 'Cluster'}`;
    }
    const chapter = STORY[player.chapterIndex];
    if (hudObjective && chapter) {
      const timeText = mission.active ? ` ${Math.max(0, Math.floor(mission.timeRemaining))}s` : '';
      const missionText = mission.active ? ` | Mission: ${mission.text} ${Math.round(mission.progress)}/${mission.target}${timeText}` : '';
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

    const sector = getCurrentSector();
    if (sector.zoneType === 'rift' || sector.zoneType === 'lane') {
      ctx.save();
      ctx.globalAlpha = sector.zoneType === 'rift' ? 0.35 : 0.22;
      ctx.strokeStyle = sector.zoneType === 'rift' ? 'rgba(255,209,102,0.6)' : 'rgba(125,252,154,0.4)';
      for (let i = 0; i < 4; i += 1) {
        const offset = (state.time * 40 + i * 120) % VIEW.height;
        ctx.beginPath();
        ctx.moveTo(0, offset);
        ctx.quadraticCurveTo(VIEW.centerX, offset - 60, VIEW.width, offset);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawGalacticBand(camera) {
    const sector = getCurrentSector();
    const hue = BIOMES[sector.biome].hue;
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
    const biome = BIOMES[sector.biome];
    const zone = sector.zone || ZONE_TYPES.cluster;
    ctx.fillStyle = biome.dust;
    dustField.forEach((dust) => {
      const screenX = dust.x - camera.x * 0.25 + VIEW.centerX;
      const screenY = dust.y - camera.y * 0.25 + VIEW.centerY;
      if (screenX < -50 || screenX > VIEW.width + 50 || screenY < -50 || screenY > VIEW.height + 50) return;
      ctx.globalAlpha = dust.alpha * zone.dustScale;
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

  function drawBase(base, camera) {
    const x = base.x - camera.x + VIEW.centerX;
    const y = base.y - camera.y + VIEW.centerY;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(16,24,40,0.85)';
    ctx.strokeStyle = base.def.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, base.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const angle = (Math.PI * 2 * i) / 6;
      const r = base.radius * 0.55;
      if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
      else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.stroke();

    base.turrets.forEach((turret) => {
      const tx = Math.cos(turret.angle) * base.radius * 0.85;
      const ty = Math.sin(turret.angle) * base.radius * 0.85;
      ctx.fillStyle = base.def.color;
      ctx.beginPath();
      ctx.arc(tx, ty, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    if (base.shield > 0) {
      ctx.strokeStyle = 'rgba(109,240,255,0.4)';
      ctx.beginPath();
      ctx.arc(0, 0, base.radius + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawHomeBase(camera, sector) {
    const base = world.homeBase;
    if (!base) return;
    const grid = gridFromPos(base.x, base.y);
    if (grid.gx !== sector.gx || grid.gy !== sector.gy) return;
    const x = base.x - camera.x + VIEW.centerX;
    const y = base.y - camera.y + VIEW.centerY;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = 'rgba(109,240,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, base.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, base.radius * 0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(109,240,255,0.12)';
    ctx.fill();
    ctx.restore();
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
    const glow = `hsla(${prop.hue},70%,65%,0.6)`;
    ctx.strokeStyle = glow;
    ctx.fillStyle = `hsla(${prop.hue},45%,30%,0.5)`;
    ctx.lineWidth = 1.4;
    if (prop.type === 'ice_spires' || prop.type === 'obsidian_spires') {
      ctx.beginPath();
      ctx.moveTo(0, -prop.size);
      ctx.lineTo(prop.size * 0.4, prop.size * 0.6);
      ctx.lineTo(-prop.size * 0.4, prop.size * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (prop.type === 'glass_shards' || prop.type === 'prism_arches') {
      ctx.beginPath();
      ctx.moveTo(-prop.size * 0.6, prop.size * 0.2);
      ctx.lineTo(0, -prop.size * 0.7);
      ctx.lineTo(prop.size * 0.6, prop.size * 0.3);
      ctx.lineTo(0, prop.size * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (prop.type === 'ion_pylons' || prop.type === 'defense_pylons' || prop.type === 'flare_towers' || prop.type === 'arc_emitters') {
      ctx.beginPath();
      ctx.rect(-prop.size * 0.25, -prop.size * 0.7, prop.size * 0.5, prop.size * 1.4);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, -prop.size * 0.8, prop.size * 0.25, 0, Math.PI * 2);
      ctx.stroke();
    } else if (prop.type === 'plasma_flares' || prop.type === 'ember_flows') {
      ctx.strokeStyle = glow;
      ctx.beginPath();
      ctx.moveTo(-prop.size * 0.6, 0);
      ctx.quadraticCurveTo(0, -prop.size * 0.8, prop.size * 0.6, 0);
      ctx.quadraticCurveTo(0, prop.size * 0.8, -prop.size * 0.6, 0);
      ctx.stroke();
    } else if (prop.type === 'shadow_mines' || prop.type === 'void_buoys') {
      ctx.beginPath();
      ctx.arc(0, 0, prop.size * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-prop.size * 0.6, 0);
      ctx.lineTo(prop.size * 0.6, 0);
      ctx.stroke();
    } else if (prop.type === 'debris_cluster' || prop.type === 'ash_ruins') {
      for (let i = 0; i < 4; i += 1) {
        const angle = (Math.PI * 2 * i) / 4;
        const r = prop.size * 0.4;
        ctx.beginPath();
        ctx.rect(Math.cos(angle) * r, Math.sin(angle) * r, prop.size * 0.2, prop.size * 0.2);
        ctx.fill();
        ctx.stroke();
      }
    } else if (prop.type === 'silent_monoliths') {
      ctx.beginPath();
      ctx.rect(-prop.size * 0.25, -prop.size * 0.9, prop.size * 0.5, prop.size * 1.8);
      ctx.fill();
      ctx.stroke();
    } else if (prop.type === 'light_fins' || prop.type === 'ice_rings') {
      ctx.strokeStyle = glow;
      ctx.beginPath();
      ctx.ellipse(0, 0, prop.size * 0.7, prop.size * 0.3, 0.3, 0, Math.PI * 2);
      ctx.stroke();
    } else if (prop.type === 'forge_fragments' || prop.type === 'relic_spires' || prop.type === 'echo_stones') {
      ctx.beginPath();
      ctx.moveTo(-prop.size * 0.5, -prop.size * 0.2);
      ctx.lineTo(0, -prop.size * 0.7);
      ctx.lineTo(prop.size * 0.6, -prop.size * 0.1);
      ctx.lineTo(prop.size * 0.3, prop.size * 0.7);
      ctx.lineTo(-prop.size * 0.4, prop.size * 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, prop.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRuin(ruin, camera) {
    const x = ruin.x - camera.x + VIEW.centerX;
    const y = ruin.y - camera.y + VIEW.centerY;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = ruin.guarded ? 'rgba(255,107,107,0.8)' : 'rgba(255,210,140,0.7)';
    ctx.fillStyle = 'rgba(60,70,90,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, ruin.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-ruin.radius * 0.6, 0);
    ctx.lineTo(ruin.radius * 0.6, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawRiftBeacon(beacon, camera) {
    const x = beacon.x - camera.x + VIEW.centerX;
    const y = beacon.y - camera.y + VIEW.centerY;
    const pulse = 0.6 + Math.sin(state.time * 2 + beacon.pulse) * 0.4;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = `rgba(125,252,154,${0.4 + pulse * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, beacon.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, beacon.radius * 0.5 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
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

    sector.objects.asteroids.forEach((asteroid) => drawAsteroid(asteroid, camera));
    sector.objects.stations.forEach((station) => drawStation(station, camera));
    sector.objects.traders.forEach((trader) => drawTrader(trader, camera));
    sector.objects.bases.forEach((base) => drawBase(base, camera));
    sector.objects.wrecks.forEach((wreck) => drawWreck(wreck, camera));
    sector.objects.biomeProps.forEach((prop) => drawBiomeProp(prop, camera));
    sector.objects.ruins.forEach((ruin) => {
      if (world.ruinClaims?.[sector.key]) return;
      drawRuin(ruin, camera);
    });
    sector.objects.riftBeacons.forEach((beacon) => drawRiftBeacon(beacon, camera));
    drawEvents(sector, camera);
    const gate = getGateData();
    if (gate && gate.key === sector.key) {
      const gx = gate.x - camera.x + VIEW.centerX;
      const gy = gate.y - camera.y + VIEW.centerY;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,209,102,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(gx, gy, 70, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,209,102,0.4)';
      ctx.beginPath();
      ctx.arc(gx, gy, 90, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    drawHomeBase(camera, sector);

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

    if (state.shiftBoost.active || state.riftDash.active) {
      ctx.fillStyle = 'rgba(125,252,154,0.8)';
      ctx.beginPath();
      ctx.ellipse(0, h * 0.72, w * 0.2, h * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (state.riftDash.active) {
      ctx.fillStyle = 'rgba(255,209,102,0.9)';
      ctx.beginPath();
      ctx.ellipse(0, h * 0.9, w * 0.35, h * 0.25, 0, 0, Math.PI * 2);
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
    const baseColor = enemy.isBoss ? PALETTE.ember : enemy.def?.color || PALETTE.rose;
    const hullColor = mixColor(baseColor, accent, enemy.isBoss ? 0.1 : 0.3);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(enemy.angle || 0);
    ctx.fillStyle = hullColor;
    ctx.shadowBlur = enemy.isBoss ? 20 : 10;
    ctx.shadowColor = hullColor;
    const size = enemy.size;
    ctx.beginPath();
    if (enemy.isBoss) {
      ctx.moveTo(0, -size * 1.1);
      ctx.quadraticCurveTo(size * 1.2, -size * 0.4, size * 0.9, size * 0.8);
      ctx.lineTo(0, size * 0.4);
      ctx.lineTo(-size * 0.9, size * 0.8);
      ctx.quadraticCurveTo(-size * 1.2, -size * 0.4, 0, -size * 1.1);
    } else if (enemy.role === 'scout') {
      ctx.moveTo(0, -size * 1.05);
      ctx.quadraticCurveTo(size * 0.6, -size * 0.4, size * 0.7, size * 0.5);
      ctx.lineTo(0, size * 0.2);
      ctx.lineTo(-size * 0.7, size * 0.5);
      ctx.quadraticCurveTo(-size * 0.6, -size * 0.4, 0, -size * 1.05);
    } else if (enemy.role === 'interceptor') {
      ctx.moveTo(0, -size * 1.2);
      ctx.lineTo(size * 0.4, -size * 0.1);
      ctx.lineTo(size * 0.7, size * 0.7);
      ctx.lineTo(0, size * 0.3);
      ctx.lineTo(-size * 0.7, size * 0.7);
      ctx.lineTo(-size * 0.4, -size * 0.1);
    } else if (enemy.role === 'fighter') {
      ctx.moveTo(0, -size * 1.0);
      ctx.lineTo(size * 0.6, -size * 0.2);
      ctx.lineTo(size * 0.9, size * 0.8);
      ctx.lineTo(0, size * 0.35);
      ctx.lineTo(-size * 0.9, size * 0.8);
      ctx.lineTo(-size * 0.6, -size * 0.2);
    } else if (enemy.role === 'gunship') {
      ctx.moveTo(0, -size * 0.9);
      ctx.quadraticCurveTo(size * 0.9, -size * 0.6, size * 0.9, size * 0.3);
      ctx.lineTo(size * 0.5, size * 0.9);
      ctx.lineTo(-size * 0.5, size * 0.9);
      ctx.lineTo(-size * 0.9, size * 0.3);
      ctx.quadraticCurveTo(-size * 0.9, -size * 0.6, 0, -size * 0.9);
    } else if (enemy.role === 'bomber') {
      ctx.moveTo(0, -size * 0.8);
      ctx.lineTo(size * 0.9, -size * 0.1);
      ctx.lineTo(size * 0.7, size * 0.9);
      ctx.lineTo(-size * 0.7, size * 0.9);
      ctx.lineTo(-size * 0.9, -size * 0.1);
    } else if (enemy.role === 'sniper') {
      ctx.moveTo(0, -size * 1.3);
      ctx.lineTo(size * 0.4, size * 0.6);
      ctx.lineTo(0, size * 0.9);
      ctx.lineTo(-size * 0.4, size * 0.6);
    } else if (enemy.role === 'turret') {
      const points = 6;
      for (let i = 0; i < points; i += 1) {
        const a = (Math.PI * 2 * i) / points;
        const r = size * 0.8;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
    } else if (enemy.role === 'transport') {
      ctx.moveTo(-size * 1.2, -size * 0.5);
      ctx.lineTo(size * 1.2, -size * 0.5);
      ctx.lineTo(size * 1.0, size * 0.5);
      ctx.lineTo(-size * 1.0, size * 0.5);
    } else if (enemy.role === 'carrier') {
      ctx.moveTo(0, -size * 1.1);
      ctx.lineTo(size * 1.3, size * 0.6);
      ctx.lineTo(size * 0.4, size * 0.4);
      ctx.lineTo(0, size * 0.7);
      ctx.lineTo(-size * 0.4, size * 0.4);
      ctx.lineTo(-size * 1.3, size * 0.6);
    } else {
      ctx.moveTo(0, -size);
      ctx.lineTo(size * 0.7, size);
      ctx.lineTo(-size * 0.7, size);
    }
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    if (enemy.role === 'transport' || enemy.role === 'carrier') {
      ctx.beginPath();
      ctx.rect(-size * 0.2, -size * 0.1, size * 0.4, size * 0.6);
      ctx.fill();
    } else if (enemy.role === 'sniper') {
      ctx.beginPath();
      ctx.rect(-size * 0.08, -size * 0.8, size * 0.16, size * 1.2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;

    ctx.fillStyle = 'rgba(255,200,160,0.6)';
    if (enemy.role === 'transport' || enemy.role === 'carrier' || enemy.isBoss) {
      ctx.beginPath();
      ctx.arc(-size * 0.6, size * 0.75, size * 0.12, 0, Math.PI * 2);
      ctx.arc(size * 0.6, size * 0.75, size * 0.12, 0, Math.PI * 2);
      ctx.fill();
    } else if (enemy.role === 'gunship' || enemy.role === 'bomber') {
      ctx.beginPath();
      ctx.arc(-size * 0.4, size * 0.7, size * 0.1, 0, Math.PI * 2);
      ctx.arc(size * 0.4, size * 0.7, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, size * 0.7, size * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }

    if (enemy.role === 'scout' || enemy.role === 'interceptor') {
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath();
      ctx.moveTo(0, size * 0.9);
      ctx.lineTo(0, size * 1.6);
      ctx.stroke();
    }

    if (enemy.isBoss && enemy.shield > 0) {
      ctx.strokeStyle = 'rgba(125,252,154,0.6)';
      ctx.beginPath();
      ctx.arc(0, 0, enemy.size + 8, 0, Math.PI * 2);
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

    for (let gx = -WORLD.gridRadius; gx <= WORLD.gridRadius; gx += 1) {
      for (let gy = -WORLD.gridRadius; gy <= WORLD.gridRadius; gy += 1) {
        const key = sectorKey(gx, gy);
        const sector = getSector(gx, gy);
        const cellX = mapX + ((gx + WORLD.gridRadius) / (WORLD.gridRadius * 2 + 1)) * mapSize;
        const cellY = mapY + ((gy + WORLD.gridRadius) / (WORLD.gridRadius * 2 + 1)) * mapSize;
        const visible = sector.discovered || sector.revealedUntil > state.time;
        if (!visible) {
          ctx.fillStyle = 'rgba(80,90,110,0.3)';
        } else if (sector.zoneType === 'rift') {
          ctx.fillStyle = 'rgba(255,209,102,0.7)';
        } else if (sector.zoneType === 'lane') {
          ctx.fillStyle = 'rgba(125,252,154,0.6)';
        } else {
          ctx.fillStyle = 'rgba(109,240,255,0.6)';
        }
        ctx.fillRect(cellX + 2, cellY + 2, 6, 6);
        if (sector.gateChapter) {
          ctx.strokeStyle = PALETTE.gold;
          ctx.strokeRect(cellX + 1, cellY + 1, 8, 8);
        }
        if (sector.objects.bases.length && !world.baseClaims?.[sector.key]) {
          ctx.fillStyle = 'rgba(255,107,107,0.8)';
          ctx.fillRect(cellX + 4, cellY + 4, 4, 4);
        }
      }
    }

    const playerX = mapX + ((player.x + WORLD.half) / WORLD.size) * mapSize;
    const playerY = mapY + ((player.y + WORLD.half) / WORLD.size) * mapSize;
    ctx.fillStyle = PALETTE.ember;
    ctx.beginPath();
    ctx.arc(playerX, playerY, 3, 0, Math.PI * 2);
    ctx.fill();

    if (world.homeBase) {
      const homeX = mapX + ((world.homeBase.x + WORLD.half) / WORLD.size) * mapSize;
      const homeY = mapY + ((world.homeBase.y + WORLD.half) / WORLD.size) * mapSize;
      ctx.fillStyle = 'rgba(109,240,255,0.9)';
      ctx.beginPath();
      ctx.arc(homeX, homeY, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawShipStatus() {
    ctx.fillStyle = 'rgba(5,10,18,0.55)';
    ctx.fillRect(12, VIEW.height - 122, 300, 112);
    ctx.strokeStyle = 'rgba(125,252,154,0.3)';
    ctx.strokeRect(12, VIEW.height - 122, 300, 112);
    ctx.fillStyle = PALETTE.glow;
    ctx.font = '12px sans-serif';
    ctx.fillText(`Hull ${Math.round(player.hp)}/${Math.round(cachedStats.maxHp)}`, 22, VIEW.height - 94);
    ctx.fillText(`Shield ${Math.round(player.shield)}/${Math.round(cachedStats.maxShield)}`, 22, VIEW.height - 78);
    ctx.fillText(`Energy ${Math.round(player.energy)}/${Math.round(cachedStats.energyMax)}`, 22, VIEW.height - 62);
    ctx.fillText(`Boost ${Math.round(player.boost)}/${Math.round(cachedStats.boostMax)}`, 22, VIEW.height - 46);
    ctx.fillText(`Fuel ${Math.round(player.fuel)}/${Math.round(cachedStats.fuelMax)}`, 22, VIEW.height - 30);
    ctx.fillText(`Rift ${Math.round(player.riftCharge)}%`, 22, VIEW.height - 14);

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
    ctx.fillStyle = 'rgba(255,209,102,0.9)';
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, 8);
    ctx.lineTo(-6, 0);
    ctx.lineTo(-8, -8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#ffd166';
    ctx.font = '12px sans-serif';
    ctx.fillText(`Gate ${Math.round(distance)}m`, x - 32, y - 12);

    if (distance < 420) {
      const sx = gate.x - (player.x - VIEW.centerX);
      const sy = gate.y - (player.y - VIEW.centerY);
      ctx.strokeStyle = 'rgba(255,209,102,0.6)';
      ctx.beginPath();
      ctx.arc(sx, sy, 50, 0, Math.PI * 2);
      ctx.stroke();
    }
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
        if (sector.zoneType === 'lane') {
          ctx.strokeStyle = 'rgba(125,252,154,0.35)';
          ctx.strokeRect(x + 6, y + 6, cell - 12, cell - 12);
        }
        if (sector.zoneType === 'rift') {
          ctx.strokeStyle = 'rgba(255,209,102,0.5)';
          ctx.strokeRect(x + 6, y + 6, cell - 12, cell - 12);
        }
        if (sector.objects.bases.length && !world.baseClaims?.[sector.key]) {
          ctx.fillStyle = 'rgba(255,107,107,0.9)';
          ctx.fillRect(x + cell / 2 - 3, y + cell / 2 - 3, 6, 6);
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
      '6. Start Chapter Mission',
      '7. Undock',
      '8. Sell Cargo',
      '9. Bulk Ammo Restock (240 credits)'
    ];
    options.forEach((opt, idx) => {
      ctx.fillStyle = idx === state.menuSelection ? PALETTE.gold : '#e0f2ff';
      ctx.fillText(opt, 24, 80 + idx * 22);
    });
    ctx.fillStyle = '#e0f2ff';
    ctx.fillText(`Cargo: Salvage ${player.inventory.cargo.salvage} | Alloys ${player.inventory.cargo.alloys} | Relics ${player.inventory.cargo.relics}`, 24, 80 + options.length * 22 + 8);
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
      '2. Sell Cargo',
      '3. Trade Relic for Blueprint',
      '4. Buy Mystery Blueprint (600 credits)',
      '5. Leave'
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

  function drawOverlay() {
    if (state.mode === 'map') drawGalaxyMap();
    if (state.mode === 'prompt') drawPromptOverlay();
    if (state.mode === 'station') drawStationOverlay();
    if (state.mode === 'shipyard') drawShipyardOverlay();
    if (state.mode === 'store') drawStoreOverlay();
    if (state.mode === 'lore') drawLoreOverlay();
    if (state.mode === 'trader') drawTraderOverlay();
  }

  function render() {
    const shake = state.cameraShakeTimer > 0 ? state.cameraShake * state.cameraShakeTimer : 0;
    const shakeX = Math.sin(state.time * 45 + state.cameraNoiseSeed) * shake * 4;
    const shakeY = Math.cos(state.time * 38 + state.cameraNoiseSeed * 2) * shake * 4;
    const camera = { x: player.x + shakeX, y: player.y + shakeY };

    drawBackground(camera);
    drawGalacticBand(camera);
    drawDust(camera);

    const sector = getCurrentSector();
    drawSectorObjects(sector, camera);
    drawEntities(camera, sector);
    drawMiniMap();
    drawShipStatus();
    drawGateIndicator();
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
        fuel: player.fuel,
        riftCharge: player.riftCharge,
        angularVelocity: player.angularVelocity,
        throttle: player.throttle,
        flightAssist: player.flightAssist,
        credits: player.credits,
        upgrades: player.upgrades,
        ammo: player.ammo,
        blueprints: Array.from(player.blueprints),
        cosmetics: Array.from(player.cosmetics),
        toys: Array.from(player.toys),
        lore: Array.from(player.lore),
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
        ruinsDiscovered: world.ruinClaims
      },
      settings: {
        audioVolume: 0.8,
        graphicsQuality: 'high'
      },
      state: {
        unlockedDepth: state.unlockedDepth,
        storyLog: state.storyLog,
        failureLedger: state.failureLedger
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
    player.fuel = savedPlayer.fuel ?? player.fuel;
    player.riftCharge = savedPlayer.riftCharge ?? player.riftCharge;
    player.angularVelocity = savedPlayer.angularVelocity ?? player.angularVelocity;
    player.throttle = savedPlayer.throttle ?? player.throttle;
    player.flightAssist = savedPlayer.flightAssist ?? player.flightAssist;
    player.credits = savedPlayer.credits ?? player.credits;
    player.upgrades = { ...player.upgrades, ...(savedPlayer.upgrades || {}) };
    player.ammo = { ...player.ammo, ...(savedPlayer.ammo || {}) };
    player.blueprints = new Set(savedPlayer.blueprints || []);
    player.cosmetics = new Set(savedPlayer.cosmetics || []);
    player.toys = new Set(savedPlayer.toys || []);
    player.lore = new Set(savedPlayer.lore || []);
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
    world.ruinClaims = save.mapProgress?.ruinsDiscovered || {};

    state.unlockedDepth = save.state?.unlockedDepth ?? state.unlockedDepth;
    state.storyLog = save.state?.storyLog || [];
    state.failureLedger = save.state?.failureLedger || {};

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
    }

    state.checkpoint = save.checkpoint || state.checkpoint;

    clampAmmo();
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

      if (state.mode === 'lore') {
        if (e.code === 'ArrowUp') state.loreScroll = Math.max(0, state.loreScroll - 1);
        if (e.code === 'ArrowDown') state.loreScroll += 1;
      }

      if (e.code === 'Escape') {
        if (state.mode === 'shipyard' || state.mode === 'store' || state.mode === 'station') {
          state.mode = 'station';
          return;
        }
        if (state.mode === 'trader') {
          state.mode = 'flight';
          state.paused = false;
          state.activeTrader = null;
          return;
        }
      }

      if (state.mode === 'station') {
        handleStationMenuInput(e.code);
      } else if (state.mode === 'shipyard') {
        handleShipyardInput(e.code);
      } else if (state.mode === 'store') {
        handleStoreInput(e.code);
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
      const idx = parseInt(code.replace('Digit', ''), 10) - 1;
      if (!Number.isNaN(idx)) state.menuSelection = idx;
    }
    if (code === 'Digit1') stationRepair();
    if (code === 'Digit2') openShipyard();
    if (code === 'Digit3') openStore();
    if (code === 'Digit4') stationContract();
    if (code === 'Digit5') installStoredBlueprints();
    if (code === 'Digit6') startMissionFromStation();
    if (code === 'Digit7') undock();
    if (code === 'Digit8') sellCargo();
    if (code === 'Digit9') bulkRestockAmmo();
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
    if (code === 'Digit2') sellCargo();
    if (code === 'Digit3') tradeRelicForBlueprint();
    if (code === 'Digit4') buyMysteryBlueprint();
    if (code === 'Digit5') {
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
    player.fuel = cachedStats.fuelMax;
    noteStatus('Station services applied.');
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

  function bulkRestockAmmo() {
    const cost = 240;
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

  function startMissionFromStation() {
    if (mission.active) {
      noteStatus('Mission already active.');
      return;
    }
    startChapterMission();
    state.mode = 'flight';
    state.paused = false;
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
