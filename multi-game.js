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

let multiGameInitialized = false;

function showMultiGame() {
  if (multiGameInitialized) return;
  if (typeof document === 'undefined') return;

  const menuButtons = Array.from(document.querySelectorAll('[data-game-target]') || []);
  if (!menuButtons.length) {
    console.warn('Arcade menu buttons not found; continuing without menu binding');
  }

  const canvas = document.getElementById('snake-canvas');
  const snakeSection = document.getElementById('snake-game');
  if (!canvas || typeof canvas.getContext !== 'function') {
    console.warn('Snake canvas missing; multi-game setup skipped');
    return;
  }

  multiGameInitialized = true;

  menuButtons.forEach(btn => {
    if (btn.__gameBound) return;
    if (!btn.hasAttribute('onclick')) {
      btn.addEventListener('click', () => {
        const game = typeof btn.getAttribute === 'function'
          ? btn.getAttribute('data-game-target')
          : btn.dataset && btn.dataset.gameTarget;
        if (game) {
          globalScope.showGame(game);
        }
      });
    }
    btn.__gameBound = true;
  });

  // --- Snake Game Implementation ---
  const ctx = canvas.getContext('2d');
  const gridSize = 16;
  const cellSize = Math.floor(canvas.width / gridSize);
  let snake, direction, food, score, gameOver, moveQueue, snakeInterval;

  window.resetSnake = function() {
    snake = [{x: 8, y: 8}];
    direction = {x: 0, y: -1};
    moveQueue = [];
    placeFood();
    score = 0;
    gameOver = false;
    updateSnakeScore();
    clearInterval(snakeInterval);
    snakeInterval = setInterval(gameLoop, 200);
    drawSnake();
  };

  function updateSnakeScore() {
    const scoreEl = document.getElementById('snake-score');
    if (scoreEl) {
      scoreEl.textContent = 'Score: ' + score;
    }
  }

  function placeFood() {
    while (true) {
      const candidate = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize)
      };
      const overlapsSnake = snake.some(segment => segment.x === candidate.x && segment.y === candidate.y);
      if (!overlapsSnake) {
        food = candidate;
        break;
      }
    }
  }

  function isOppositeDirection(a, b) {
    return a && b && a.x === -b.x && a.y === -b.y;
  }

  function applyQueuedMove() {
    while (moveQueue.length) {
      const nextMove = moveQueue.shift();
      if (!isOppositeDirection(nextMove, direction) &&
          (nextMove.x !== direction.x || nextMove.y !== direction.y)) {
        direction = nextMove;
        break;
      }
    }
  }

  function gameLoop() {
    if (gameOver) return;

    applyQueuedMove();

    const head = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y
    };

    if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
      gameOver = true;
    }

    if (!gameOver && snake.some(segment => segment.x === head.x && segment.y === head.y)) {
      gameOver = true;
    }

    if (gameOver) {
      clearInterval(snakeInterval);
      drawSnake(true);
      return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score++;
      updateSnakeScore();
      placeFood();
    } else {
      snake.pop();
    }

    drawSnake();
  }

  function drawSnake(showGameOver = false) {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(food.x * cellSize, food.y * cellSize, cellSize, cellSize);

    snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? '#2ecc71' : '#27ae60';
      ctx.fillRect(segment.x * cellSize, segment.y * cellSize, cellSize, cellSize);
    });

    if (showGameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = '20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
    }
  }

  // --- Memory Match Game Implementation ---
  const memoryBoard = document.getElementById('memory-board');
  let memoryCards, memoryFirstCard, memorySecondCard, memoryLock, memoryMoves, memoryMatched;

  window.resetMemory = function() {
    const symbols = ["🍎","🍎","🎲","🎲","🚗","🚗","🐍","🐍","🌵","🌵","🏀","🏀","🎸","🎸","🍩","🍩"];
    memoryCards = shuffle(symbols).map((symbol, idx) => ({
      symbol,
      id: idx,
      flipped: false,
      matched: false
    }));
    memoryFirstCard = null;
    memorySecondCard = null;
    memoryLock = false;
    memoryMoves = 0;
    memoryMatched = 0;
    updateMemoryMoves();
    renderMemoryBoard();
  };

  function shuffle(array) {
    const arr = array.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function updateMemoryMoves() {
    const movesEl = document.getElementById('memory-moves');
    if (movesEl) {
      movesEl.textContent = 'Moves: ' + memoryMoves;
    }
  }

  function renderMemoryBoard() {
    if (!memoryBoard) return;
    memoryBoard.innerHTML = '';
    memoryCards.forEach(card => {
      const cardButton = document.createElement('button');
      cardButton.type = 'button';
      cardButton.className = 'memory-card';
      cardButton.setAttribute('data-id', card.id);
      cardButton.disabled = card.matched;
      cardButton.textContent = card.flipped || card.matched ? card.symbol : '❓';
      if (card.flipped && !card.matched) {
        cardButton.classList.add('flipped');
      }
      cardButton.addEventListener('click', () => handleMemorySelection(card));
      memoryBoard.appendChild(cardButton);
    });
  }

  function handleMemorySelection(card) {
    if (memoryLock || card.flipped || card.matched) return;

    card.flipped = true;
    if (!memoryFirstCard) {
      memoryFirstCard = card;
      renderMemoryBoard();
      return;
    }

    memorySecondCard = card;
    memoryLock = true;
    memoryMoves++;
    updateMemoryMoves();
    renderMemoryBoard();

    if (memoryFirstCard.symbol === memorySecondCard.symbol) {
      memoryFirstCard.matched = true;
      memorySecondCard.matched = true;
      memoryMatched += 2;
      setTimeout(() => {
        memoryFirstCard = null;
        memorySecondCard = null;
        memoryLock = false;
        renderMemoryBoard();
        if (memoryMatched === memoryCards.length) {
          setTimeout(() => {
            alert('Congratulations! You matched all pairs!');
            window.resetMemory();
          }, 300);
        }
      }, 400);
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

  // --- Paper-io Game Implementation ---
  const paperioSection = document.getElementById('paperio-game');
  const paperioCanvas = document.getElementById('paperio-canvas');
  const paperioCtx = paperioCanvas && typeof paperioCanvas.getContext === 'function'
    ? paperioCanvas.getContext('2d')
    : null;
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

  function hexToRgb(hex) {
    if (!hex) return {r:0, g:0, b:0};
    let normalized = hex.replace('#', '').trim();
    if (normalized.length === 3) {
      normalized = normalized.split('').map(ch => ch + ch).join('');
    }
    const value = parseInt(normalized, 16);
    if (Number.isNaN(value)) return {r:0, g:0, b:0};
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255
    };
  }

  function lightenChannel(channel, mix) {
    return Math.min(255, Math.round(channel + (255 - channel) * mix));
  }

  function makeTrailStyles(color, emphasize = false) {
    const {r, g, b} = hexToRgb(color);
    const fillMix = emphasize ? 0.7 : 0.5;
    const strokeMix = emphasize ? 0.9 : 0.65;
    const fill = `rgba(${lightenChannel(r, fillMix)},${lightenChannel(g, fillMix)},${lightenChannel(b, fillMix)},${emphasize ? 0.95 : 0.85})`;
    const stroke = `rgba(${lightenChannel(r, strokeMix)},${lightenChannel(g, strokeMix)},${lightenChannel(b, strokeMix)},${emphasize ? 0.95 : 0.85})`;
    return {
      fill,
      stroke,
      strokeWidth: emphasize ? 3 : 2
    };
  }

  window.resetPaperio = function() {
    if (!paperioCanvas || !paperioCtx) {
      console.warn('Paper-io canvas missing; skipping setup');
      paperioPlayers = [];
      paperioBoard = [];
      clearInterval(paperioInterval);
      paperioInterval = null;
      updatePaperioMessages();
      const scoreboard = document.getElementById('paperio-scoreboard');
      if (scoreboard) {
        scoreboard.innerHTML = '';
      }
      return;
    }
    paperioBoard = Array.from({length:paperioSize},()=>Array(paperioSize).fill(-1));
    paperioPlayers = [
      {id:0, name:'You', color:paperioColors[0], x:2, y:2, dir:{x:1,y:0}, queuedDir:null, land:[], trail:[], alive:true, ai:false, spawn:{x:2,y:2}},
      {id:1, name:'Bot1', color:paperioColors[1], x:17, y:2, dir:{x:-1,y:0}, queuedDir:null, land:[], trail:[], alive:true, ai:true, spawn:{x:17,y:2}},
      {id:2, name:'Bot2', color:paperioColors[2], x:2, y:17, dir:{x:0,y:-1}, queuedDir:null, land:[], trail:[], alive:true, ai:true, spawn:{x:2,y:17}},
      {id:3, name:'Bot3', color:paperioColors[3], x:17, y:17, dir:{x:0,y:-1}, queuedDir:null, land:[], trail:[], alive:true, ai:true, spawn:{x:17,y:17}}
    ];
    for (let p of paperioPlayers) {
      paperioBoard[p.y][p.x] = p.id;
      p.land = [{x:p.x,y:p.y}];
      p.trail = [];
      p.alive = true;
      p.queuedDir = null;
      p.trailStyles = null;
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
    if (!paperioCanvas || !paperioCtx) return;
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
    paperioCtx.lineJoin = 'round';
    for (let p of paperioPlayers) {
      if (!p.alive) continue;
      if (!p.trailStyles) {
        p.trailStyles = makeTrailStyles(p.color, p.id === 0);
      }
      const styles = p.trailStyles;
      for (let t of p.trail) {
        const baseX = t.x * 20;
        const baseY = t.y * 20;
        paperioCtx.fillStyle = styles.fill;
        paperioCtx.fillRect(baseX, baseY, 20, 20);
        paperioCtx.strokeStyle = styles.stroke;
        paperioCtx.lineWidth = styles.strokeWidth;
        paperioCtx.strokeRect(baseX + 1, baseY + 1, 18, 18);
@@ -486,50 +617,51 @@ function showMultiGame() {
    if (borderDist <= 0) score -= 120;
    else if (borderDist === 1) score -= 35;
    else if (borderDist === 2) score -= 10;

    if (dir.x === bot.dir.x && dir.y === bot.dir.y) score += 4;
    score += Math.random();

    return score;
  }

  function chooseBotDirection(bot, hazard) {
    const options = paperioDirs.filter(d => !(d.x === -bot.dir.x && d.y === -bot.dir.y));
    let bestDir = bot.dir;
    let bestScore = -Infinity;
    for (let dir of options) {
      const score = evaluateBotDirection(bot, dir, hazard);
      if (score > bestScore) {
        bestScore = score;
        bestDir = dir;
      }
    }
    bot.dir = bestDir;
  }

  function paperioTick() {
    if (!paperioCanvas || !paperioCtx) return;
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

    const hazardMap = buildPaperioHazards(alivePlayers);
    for (let bot of alivePlayers) {
      if (!bot.ai) continue;
      const hazard = hazardMap.get(bot.id);
      chooseBotDirection(bot, hazard);
    }

    const plannedMoves = [];
    for (let p of alivePlayers) {
      if (!p.ai && p.queuedDir) {
        if (!(p.queuedDir.x === -p.dir.x && p.queuedDir.y === -p.dir.y)) {
          p.dir = p.queuedDir;
        }
        p.queuedDir = null;
@@ -598,159 +730,171 @@ function showMultiGame() {

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
    const scoreboard = document.getElementById('paperio-scoreboard');
    if (scoreboard) {
      scoreboard.innerHTML = html;
    }
  }

  // --- Neon Racer Game Implementation ---
  const racerSection = document.getElementById('racer-game');
  const racerCanvas = document.getElementById('racer-canvas');
  const racerCtx = racerCanvas && typeof racerCanvas.getContext === 'function'
    ? racerCanvas.getContext('2d')
    : null;
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
    if (!racerCanvas || !racerCtx) return;
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
    if (!racerCanvas || !racerCtx) return;
    const newLane = Math.min(2, Math.max(0, racerState.lane + delta));
    if (newLane !== racerState.lane) {
      racerState.lane = newLane;
      drawRacer();
    }
  }

  function spawnRacerObstacle() {
    if (!racerCanvas || !racerCtx) return;
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
    if (!racerCanvas || !racerCtx) return;
    racerState.running = false;
    setRacerMessage('Crashed! Press Reset or Start to try again.');
    updateRacerHud();
    drawRacer();
  }

  function racerLoop(timestamp) {
    if (!racerCanvas || !racerCtx) {
      racerState.running = false;
      racerAnimationId = null;
      return;
    }
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

@@ -767,102 +911,102 @@ function showMultiGame() {
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
    if (!racerCanvas || !racerCtx) return;
    if (!racerState.running) {
      racerState.running = true;
      setRacerMessage('Dodge the neon traffic!');
      racerAnimationId = requestAnimationFrame(racerLoop);
    }
  }

  window.pauseRacer = function() {
    if (!racerCanvas || !racerCtx) return;
    if (racerState.running) {
      racerState.running = false;
      setRacerMessage('Paused');
    }
  }

  window.resetRacer = function() {
    if (!racerCanvas || !racerCtx) return;
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
    if (snakeSection && snakeSection.style.display === 'flex') {
      let move;
      if (e.key === 'ArrowUp') move = {x:0, y:-1};
      if (e.key === 'ArrowDown') move = {x:0, y:1};
      if (e.key === 'ArrowLeft') move = {x:-1, y:0};
      if (e.key === 'ArrowRight') move = {x:1, y:0};
      if (move) moveQueue.push(move);
    }
    if (paperioSection && paperioSection.style.display === 'flex') {
      const player = paperioPlayers[0];
      if (!player || !player.alive) return;
      let nextDir = null;
      if (e.key === 'ArrowUp' && player.dir.y !== 1) nextDir = {x:0,y:-1};
      if (e.key === 'ArrowDown' && player.dir.y !== -1) nextDir = {x:0,y:1};
      if (e.key === 'ArrowLeft' && player.dir.x !== 1) nextDir = {x:-1,y:0};
      if (e.key === 'ArrowRight' && player.dir.x !== -1) nextDir = {x:1,y:0};
      if (nextDir) player.queuedDir = nextDir;
    }
    if (racerSection && racerSection.style.display === 'flex') {
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
  const boot = () => {
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      globalScope.location.replace('index.html');
      return;
    }
