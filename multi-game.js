const globalScope = typeof window !== 'undefined' ? window : globalThis;

const GAME_SECTIONS = {
  snake: 'snake-game',
  memory: 'memory-game',
  paperio: 'paperio-game',
  racer: 'racer-game'
};

function toggleGameSections(game, doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc) return false;
  const targetId = GAME_SECTIONS[game];
  if (!targetId) return false;

  Object.entries(GAME_SECTIONS).forEach(([name, id]) => {
    const el = doc.getElementById(id);
    if (!el) return;
    const active = id === targetId;
    el.style.display = active ? 'flex' : 'none';
    if (typeof el.setAttribute === 'function') {
      el.setAttribute('aria-hidden', active ? 'false' : 'true');
    }
  });

  return true;
}

function updateMenuButtons(game, doc = (typeof document !== 'undefined' ? document : null)) {
  if (!doc || typeof doc.querySelectorAll !== 'function') return;
  const buttons = doc.querySelectorAll('[data-game-target]');
  buttons.forEach(btn => {
    const target = typeof btn.getAttribute === 'function'
      ? btn.getAttribute('data-game-target')
      : btn.dataset && btn.dataset.gameTarget;
    const isActive = target === game;
    if (btn.classList && typeof btn.classList.toggle === 'function') {
      btn.classList.toggle('active', isActive);
    }
    if (typeof btn.setAttribute === 'function') {
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    }
  });
}

globalScope.showGame = function(game, docOverride) {
  const doc = docOverride || (typeof document !== 'undefined' ? document : null);
  if (!doc) return;
  if (!toggleGameSections(game, doc)) return;
  updateMenuButtons(game, doc);

  if (game === 'racer') {
    if (typeof globalScope.startRacer === 'function') {
      globalScope.startRacer();
    }
  } else if (typeof globalScope.pauseRacer === 'function') {
    globalScope.pauseRacer();
  }
};

function showMultiGame() {
  const menuButtons = document.querySelectorAll('[data-game-target]');
  menuButtons.forEach(btn => {
    if (btn.__gameBound) return;
    btn.addEventListener('click', () => {
      const game = typeof btn.getAttribute === 'function'
        ? btn.getAttribute('data-game-target')
        : btn.dataset && btn.dataset.gameTarget;
      if (game) {
        globalScope.showGame(game);
      }
    });
    btn.__gameBound = true;
  });

  // --- Snake Game Implementation ---
  const canvas = document.getElementById('snake-canvas');
  const ctx = canvas.getContext('2d');
  const gridSize = 16;
  let snake, direction, food, score, gameOver, moveQueue, snakeInterval;

  window.resetSnake = function() {
    snake = [{x:8, y:8}];
    direction = {x: 0, y: -1};
    moveQueue = [];
    placeFood();
    score = 0;
    gameOver = false;
    updateSnakeScore();
    clearInterval(snakeInterval);
    snakeInterval = setInterval(gameLoop, 200); // Slowed from 100 to 120ms
    drawSnake();
  }

  function updateSnakeScore() {
    document.getElementById('snake-score').textContent = 'Score: ' + score;
  }

  function placeFood() {
@@ -85,72 +150,50 @@ function showMultiGame() {
      return;
    }

    // Check self collision
    if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
      gameOver = true;
      clearInterval(snakeInterval);
      drawSnake();
      return;
    }

    snake.unshift(head);

    // Check food
    if (head.x === food.x && head.y === food.y) {
      score++;
      updateSnakeScore();
      placeFood();
    } else {
      snake.pop();
    }

    drawSnake();
  }

  // --- Memory Match Game Implementation ---
  const memoryBoard = document.getElementById('memory-board');
  let memoryCards, memoryFirstCard, memorySecondCard, memoryLock, memoryMoves, memoryMatched;

  window.resetMemory = function() {
    const symbols = ["🍎","🍎","🎲","🎲","🚗","🚗","🐍","🐍","🌵","🌵","🏀","🏀","🎸","🎸","🍩","🍩"];
    memoryCards = shuffle(symbols).map((symbol, idx) => ({
      symbol, id: idx, flipped: false, matched: false
    }));
    memoryFirstCard = null;
    memorySecondCard = null;
    memoryLock = false;
    memoryMoves = 0;
    memoryMatched = 0;
    updateMemoryMoves();
    renderMemoryBoard();
  }

  function shuffle(array) {
    let arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
@@ -200,209 +243,568 @@ function showMultiGame() {
          renderMemoryBoard();
          if (memoryMatched === memoryCards.length) {
            setTimeout(() => {
              alert("Congratulations! You matched all pairs!");
              resetMemory();
            }, 500);
          }
        }, 600);
      } else {
        setTimeout(() => {
          memoryFirstCard.flipped = false;
          memorySecondCard.flipped = false;
          memoryFirstCard = null;
          memorySecondCard = null;
          memoryLock = false;
          renderMemoryBoard();
        }, 900);
      }
    }
  }

  // --- Paper-io Game Implementation ---
  const paperioCanvas = document.getElementById('paperio-canvas');
  const paperioCtx = paperioCanvas.getContext('2d');
  const paperioSize = 20; // 20x20 grid
  let paperioPlayers, paperioBoard, paperioInterval, paperioMessages = [];
  const paperioColors = ['#1a8','#e55353','#ffe933','#1bbf48'];
  const paperioNames = ['You','Bot1','Bot2','Bot3'];
  const paperioDirs = [
    {x:0,y:-1},
    {x:0,y:1},
    {x:-1,y:0},
    {x:1,y:0}
  ];

  window.resetPaperio = function() {
    paperioBoard = Array.from({length:paperioSize},()=>Array(paperioSize).fill(-1));
    paperioPlayers = [
      {id:0, name:'You', color:paperioColors[0], x:2, y:2, dir:{x:1,y:0}, queuedDir:null, land:[], trail:[], alive:true, ai:false},
      {id:1, name:'Bot1', color:paperioColors[1], x:17, y:2, dir:{x:-1,y:0}, queuedDir:null, land:[], trail:[], alive:true, ai:true},
      {id:2, name:'Bot2', color:paperioColors[2], x:2, y:17, dir:{x:0,y:-1}, queuedDir:null, land:[], trail:[], alive:true, ai:true},
      {id:3, name:'Bot3', color:paperioColors[3], x:17, y:17, dir:{x:0,y:-1}, queuedDir:null, land:[], trail:[], alive:true, ai:true}
    ];
    for (let p of paperioPlayers) {
      paperioBoard[p.y][p.x] = p.id;
      p.land = [{x:p.x,y:p.y}];
      p.trail = [];
      p.alive = true;
      p.queuedDir = null;
    }
    paperioMessages = [];
    updatePaperioMessages();
    clearInterval(paperioInterval);
    paperioInterval = setInterval(paperioTick, 160);
    paperioDraw();
    paperioUpdateScore();

    const survivors = paperioPlayers.filter(p => p.alive);
    if (survivors.length <= 1) {
      if (survivors.length === 1) {
        queuePaperioMessage(survivors[0].id === 0 ? 'You win! 🏆' : `${survivors[0].name} wins the arena!`);
      } else {
        queuePaperioMessage('No one survives the arena!');
      }
      clearInterval(paperioInterval);
    }
  }

  function paperioDraw() {
    paperioCtx.clearRect(0,0,paperioCanvas.width,paperioCanvas.height);
    for(let y=0;y<paperioSize;y++) {
      for(let x=0;x<paperioSize;x++) {
        const owner = paperioBoard[y][x];
        if (owner >= 0) {
          paperioCtx.fillStyle = paperioColors[owner];
          paperioCtx.fillRect(x*20, y*20, 20, 20);
        }
      }
    }
    for (let p of paperioPlayers) {
      if (!p.alive) continue;
      paperioCtx.globalAlpha = 0.75;
      for (let t of p.trail) {
        paperioCtx.fillStyle = p.color;
        paperioCtx.fillRect(t.x*20, t.y*20, 20, 20);
      }
      paperioCtx.globalAlpha = 1;
    }
    for (let p of paperioPlayers) {
      if (!p.alive) continue;
      paperioCtx.strokeStyle = '#111';
      paperioCtx.lineWidth = 2;
      paperioCtx.beginPath();
      paperioCtx.arc(p.x*20+10, p.y*20+10, 8, 0, Math.PI*2);
      paperioCtx.fillStyle = p.color;
      paperioCtx.fill();
      paperioCtx.stroke();
    }
  }

  function queuePaperioMessage(msg) {
    if (!msg) return;
    paperioMessages.push(msg);
    if (paperioMessages.length > 5) paperioMessages.shift();
    updatePaperioMessages();
  }

  function updatePaperioMessages() {
    const el = document.getElementById('paperio-elim');
    if (!el) return;
    el.innerHTML = paperioMessages.length ? paperioMessages.map(m => `• ${m}`).join('<br>') : '';
  }

  function clearPaperioPlayer(player) {
    for (let y=0; y<paperioSize; y++) {
      for (let x=0; x<paperioSize; x++) {
        if (paperioBoard[y][x] === player.id) {
          paperioBoard[y][x] = -1;
        }
      }
    }
    player.trail = [];
    player.land = [];
  }

  function paperioElim(player, reason) {
    if (!player.alive) return;
    player.alive = false;
    clearPaperioPlayer(player);
    let readableReason = reason;
    if (player.id === 0) {
      readableReason = readableReason.replace('their trail', 'your trail');
      readableReason = readableReason.replace('their', 'your');
    }
    const message = player.id === 0
      ? `You were eliminated: ${readableReason}.`
      : `${player.name} was eliminated: ${reason}.`;
    queuePaperioMessage(message);
  }

  function distanceToNearestLand(player, x, y) {
    let best = Infinity;
    for (let cell of player.land) {
      const dist = Math.abs(cell.x - x) + Math.abs(cell.y - y);
      if (dist < best) best = dist;
    }
    return best;
  }

  function nearestEnemyDistance(player, x, y) {
    let best = Infinity;
    for (let enemy of paperioPlayers) {
      if (!enemy.alive || enemy.id === player.id) continue;
      const dist = Math.abs(enemy.x - x) + Math.abs(enemy.y - y);
      if (dist < best) best = dist;
    }
    return best;
  }

  function evaluateBotDirection(bot, dir) {
    const nx = bot.x + dir.x;
    const ny = bot.y + dir.y;
    if (nx < 0 || nx >= paperioSize || ny < 0 || ny >= paperioSize) return -999;
    if (bot.trail.some(t => t.x === nx && t.y === ny)) return -500;

    let score = Math.random() * 1.5;
    const owner = paperioBoard[ny][nx];
    if (owner === bot.id) score += 12; // heading home
    if (owner === -1) score += 6; // expanding into empty space

    const enemyTrailHere = paperioPlayers.some(e => e.id !== bot.id && e.alive && e.trail.some(t => t.x === nx && t.y === ny));
    if (enemyTrailHere) score += 40;

    if (nx === 0 || ny === 0 || nx === paperioSize-1 || ny === paperioSize-1) score -= 3; // avoid walls

    if (bot.trail.length >= 6) {
      const dist = distanceToNearestLand(bot, nx, ny);
      score += Math.max(0, 14 - dist * 2);
    } else {
      const center = (paperioSize-1)/2;
      score += 4 - (Math.abs(nx-center) + Math.abs(ny-center)) * 0.4;
    }

    const threatDist = nearestEnemyDistance(bot, nx, ny);
    if (threatDist <= 2) score -= 8;
    else if (threatDist <= 4) score -= 2;

    return score;
  }

  function chooseBotDirection(bot) {
    const options = paperioDirs.filter(d => !(d.x === -bot.dir.x && d.y === -bot.dir.y));
    let bestDir = bot.dir;
    let bestScore = -Infinity;
    for (let dir of options) {
      const score = evaluateBotDirection(bot, dir);
      if (score > bestScore) {
        bestScore = score;
        bestDir = dir;
      }
    }
    bot.dir = bestDir;
  }

  function paperioTick() {
    const alivePlayers = paperioPlayers.filter(p => p.alive);
    if (alivePlayers.length <= 1) {
      if (alivePlayers.length === 1) {
        queuePaperioMessage(alivePlayers[0].id === 0 ? 'You win! 🏆' : `${alivePlayers[0].name} wins the arena!`);
      } else if (!paperioMessages.length) {
        queuePaperioMessage('No one survives the arena!');
      }
      clearInterval(paperioInterval);
      return;
    }

    for (let bot of alivePlayers) {
      if (!bot.ai) continue;
      chooseBotDirection(bot);
    }

    const plannedMoves = [];
    for (let p of alivePlayers) {
      if (!p.ai && p.queuedDir) {
        if (!(p.queuedDir.x === -p.dir.x && p.queuedDir.y === -p.dir.y)) {
          p.dir = p.queuedDir;
        }
        p.queuedDir = null;
      }
      plannedMoves.push({
        player: p,
        nx: p.x + p.dir.x,
        ny: p.y + p.dir.y
      });
    }

    const eliminationReasons = new Map();
    const headOnMap = new Map();

    function markElimination(player, reason) {
      if (!eliminationReasons.has(player) && player.alive) {
        eliminationReasons.set(player, reason);
      }
    }

    for (let move of plannedMoves) {
      const {player, nx, ny} = move;
      if (nx < 0 || nx >= paperioSize || ny < 0 || ny >= paperioSize) {
        markElimination(player, 'hit the wall');
        continue;
      }
      if (player.trail.some(t => t.x === nx && t.y === ny)) {
        markElimination(player, 'ran into their own trail');
        continue;
      }

      for (let enemy of paperioPlayers) {
        if (!enemy.alive || enemy.id === player.id) continue;
        if (enemy.trail.some(t => t.x === nx && t.y === ny)) {
          markElimination(enemy, `had their trail cut by ${player.name}`);
          queuePaperioMessage(`${player.name} sliced ${enemy.name}'s trail!`);
        }
      }

      const key = `${nx},${ny}`;
      if (!headOnMap.has(key)) headOnMap.set(key, []);
      headOnMap.get(key).push(move);
    }

    for (let [key, moves] of headOnMap.entries()) {
      const survivors = moves.filter(m => !eliminationReasons.has(m.player));
      if (survivors.length > 1) {
        const names = survivors.map(m => m.player.name).join(' vs ');
        queuePaperioMessage(`${names} collided head-on!`);
        for (let m of survivors) {
          markElimination(m.player, 'collided head-on');
        }
      }
    }

    for (let [player, reason] of eliminationReasons.entries()) {
      paperioElim(player, reason);
    }

    for (let move of plannedMoves) {
      const {player, nx, ny} = move;
      if (!player.alive) continue;
      player.trail.push({x:nx, y:ny});
      player.x = nx;
      player.y = ny;

      const returning = player.land.some(l => l.x === nx && l.y === ny);
      if (returning) {
        for (let t of player.trail) {
          if (paperioBoard[t.y][t.x] !== player.id) {
            paperioBoard[t.y][t.x] = player.id;
            if (!player.land.some(l => l.x === t.x && l.y === t.y)) {
              player.land.push({x:t.x, y:t.y});
            }
          }
        }
        player.trail = [];
      }
    }

    paperioDraw();
    paperioUpdateScore();
  }

  function paperioUpdateScore() {
    let html = '<b>Scoreboard:</b><br>';
    for (let p of paperioPlayers) {
      const status = p.alive ? '' : ' (out)';
      html += `<span style="color:${p.color};">${p.name}:</span> ${p.land.length} land${status}<br>`;
    }
    document.getElementById('paperio-scoreboard').innerHTML = html;
  }

  // --- Neon Racer Game Implementation ---
  const racerCanvas = document.getElementById('racer-canvas');
  const racerCtx = racerCanvas ? racerCanvas.getContext('2d') : null;
  const racerLaneCenters = racerCanvas
    ? [
        (racerCanvas.width / 3) / 2,
        (racerCanvas.width / 3) * 1.5,
        (racerCanvas.width / 3) * 2.5
      ]
    : [0,0,0];
  const racerCar = { width: 60, height: 90, offsetY: 40 };
  let racerAnimationId = null;
  const racerState = {
    running: false,
    lane: 1,
    distance: 0,
    speed: 0,
    dodged: 0,
    obstacles: [],
    spawnTimer: 0,
    lastFrame: null,
    lastSpawnLane: 1
  };

  function setRacerMessage(msg) {
    const el = document.getElementById('racer-message');
    if (el) el.textContent = msg;
  }

  function updateRacerHud() {
    const distEl = document.getElementById('racer-distance');
    const speedEl = document.getElementById('racer-speed');
    const dodgeEl = document.getElementById('racer-obstacles');
    if (distEl) distEl.textContent = `Distance: ${Math.floor(racerState.distance)}m`;
    if (speedEl) speedEl.textContent = `Speed: ${Math.round(racerState.speed)} mph`;
    if (dodgeEl) dodgeEl.textContent = `Dodged: ${racerState.dodged}`;
  }

  function drawRacer() {
    if (!racerCtx || !racerCanvas) return;
    racerCtx.fillStyle = '#05070a';
    racerCtx.fillRect(0, 0, racerCanvas.width, racerCanvas.height);

    racerCtx.strokeStyle = '#1f2933';
    racerCtx.lineWidth = 4;
    for (let i = 1; i < 3; i++) {
      const x = (racerCanvas.width / 3) * i;
      racerCtx.setLineDash([18, 18]);
      racerCtx.beginPath();
      racerCtx.moveTo(x, 0);
      racerCtx.lineTo(x, racerCanvas.height);
      racerCtx.stroke();
    }
    racerCtx.setLineDash([]);

    for (let obs of racerState.obstacles) {
      const centerX = racerLaneCenters[obs.lane];
      const x = centerX - obs.width / 2;
      racerCtx.fillStyle = obs.color;
      racerCtx.fillRect(x, obs.y, obs.width, obs.height);
    }

    const carX = racerLaneCenters[racerState.lane] - racerCar.width / 2;
    const carY = racerCanvas.height - racerCar.height - racerCar.offsetY;
    const gradient = racerCtx.createLinearGradient(carX, carY, carX, carY + racerCar.height);
    gradient.addColorStop(0, '#34d399');
    gradient.addColorStop(1, '#0ea5e9');
    racerCtx.fillStyle = gradient;
    racerCtx.fillRect(carX, carY, racerCar.width, racerCar.height);

    racerCtx.fillStyle = '#0f172a';
    racerCtx.fillRect(carX + 10, carY + 15, racerCar.width - 20, 24);
  }

  function shiftRacerLane(delta) {
    if (!racerCanvas) return;
    const newLane = Math.min(2, Math.max(0, racerState.lane + delta));
    if (newLane !== racerState.lane) {
      racerState.lane = newLane;
      drawRacer();
    }
  }

  function spawnRacerObstacle() {
    if (!racerCanvas) return;
    let laneChoices = [0,1,2].filter(l => l !== racerState.lastSpawnLane);
    if (!laneChoices.length) laneChoices = [0,1,2];
    const lane = laneChoices[Math.floor(Math.random()*laneChoices.length)];
    racerState.lastSpawnLane = lane;
    racerState.obstacles.push({
      lane,
      y: -120,
      width: 60,
      height: 100,
      color: ['#f87171','#facc15','#c4b5fd'][Math.floor(Math.random()*3)]
    });
  }

  function handleRacerCrash() {
    racerState.running = false;
    setRacerMessage('Crashed! Press Reset or Start to try again.');
    updateRacerHud();
    drawRacer();
  }

  function racerLoop(timestamp) {
    if (!racerState.running) {
      racerState.lastFrame = null;
      racerAnimationId = null;
      return;
    }
    if (!racerState.lastFrame) {
      racerState.lastFrame = timestamp;
      drawRacer();
      racerAnimationId = requestAnimationFrame(racerLoop);
      return;
    }

    const delta = (timestamp - racerState.lastFrame) / 1000;
    racerState.lastFrame = timestamp;

    racerState.speed = Math.min(70 + racerState.distance * 0.12, 140);
    const metersTraveled = racerState.speed * 0.44704 * delta;
    racerState.distance += metersTraveled;
    racerState.spawnTimer += delta;

    if (racerState.spawnTimer >= Math.max(0.55, 1.45 - racerState.distance / 200)) {
      spawnRacerObstacle();
      racerState.spawnTimer = 0;
    }

    const fallSpeed = 140 + racerState.speed * 1.1;
    const carY = racerCanvas.height - racerCar.height - racerCar.offsetY;
    const carTop = carY;
    const carBottom = carY + racerCar.height;

    for (let obs of racerState.obstacles) {
      obs.y += fallSpeed * delta;
    }

    racerState.obstacles = racerState.obstacles.filter(obs => {
      if (obs.y > racerCanvas.height + obs.height) {
        racerState.dodged++;
        return false;
      }
      if (obs.lane === racerState.lane) {
        const centerX = racerLaneCenters[obs.lane];
        const carX = centerX - racerCar.width / 2;
        const obsTop = obs.y;
        const obsBottom = obs.y + obs.height;
        const overlapY = !(obsBottom < carTop || obsTop > carBottom);
        const overlapX = !(carX + racerCar.width < centerX - obs.width/2 || carX > centerX + obs.width/2);
        if (overlapX && overlapY) {
          handleRacerCrash();
          return false;
        }
      }
      return true;
    });

    updateRacerHud();
    drawRacer();
    racerAnimationId = requestAnimationFrame(racerLoop);
  }

  window.startRacer = function() {
    if (!racerCanvas) return;
    if (!racerState.running) {
      racerState.running = true;
      setRacerMessage('Dodge the neon traffic!');
      racerAnimationId = requestAnimationFrame(racerLoop);
    }
  }

  window.pauseRacer = function() {
    if (!racerCanvas) return;
    if (racerState.running) {
      racerState.running = false;
      setRacerMessage('Paused');
    }
  }

  window.resetRacer = function() {
    if (!racerCanvas) return;
    window.pauseRacer();
    racerState.lane = 1;
    racerState.distance = 0;
    racerState.speed = 0;
    racerState.dodged = 0;
    racerState.obstacles = [];
    racerState.spawnTimer = 0;
    racerState.lastFrame = null;
    racerState.lastSpawnLane = 1;
    setRacerMessage('Ready to race! Use ← and → to change lanes.');
    updateRacerHud();
    drawRacer();
  }

  document.addEventListener('keydown', e => {
    if (document.getElementById('snake-game').style.display === 'flex') {
      let move;
      if (e.key === 'ArrowUp') move = {x:0, y:-1};
      if (e.key === 'ArrowDown') move = {x:0, y:1};
      if (e.key === 'ArrowLeft') move = {x:-1, y:0};
      if (e.key === 'ArrowRight') move = {x:1, y:0};
      if (move) moveQueue.push(move);
    }
    if (document.getElementById('paperio-game').style.display === 'flex') {
      const player = paperioPlayers[0];
      if (!player || !player.alive) return;
      let nextDir = null;
      if (e.key === 'ArrowUp' && player.dir.y !== 1) nextDir = {x:0,y:-1};
      if (e.key === 'ArrowDown' && player.dir.y !== -1) nextDir = {x:0,y:1};
      if (e.key === 'ArrowLeft' && player.dir.x !== 1) nextDir = {x:-1,y:0};
      if (e.key === 'ArrowRight' && player.dir.x !== -1) nextDir = {x:1,y:0};
      if (nextDir) player.queuedDir = nextDir;
    }
    if (document.getElementById('racer-game').style.display === 'flex') {
      if (e.key === 'ArrowLeft') {
        shiftRacerLane(-1);
        e.preventDefault();
      }
      if (e.key === 'ArrowRight') {
        shiftRacerLane(1);
        e.preventDefault();
      }
    }
  });

  // Initialize all games
  window.resetSnake();
  window.resetMemory();
  window.resetPaperio();
  window.resetRacer();
  window.showGame('snake');
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      globalScope.location.replace('index.html');
      return;
    }
    showMultiGame();
  });
}

if (typeof module !== 'undefined') {
  module.exports = { toggleGameSections, updateMenuButtons, GAME_SECTIONS };
}
