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

  const menuButtons = document.querySelectorAll('[data-game-target]');
  if (!menuButtons || !menuButtons.length) {
    console.warn('Arcade menu buttons not found; multi-game setup skipped');
    return;
  }

  const canvas = document.getElementById('snake-canvas');
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

  function buildPaperioHazards(players) {
    const hazards = new Map();
    for (let p of players) {
      if (!p.alive) continue;
      hazards.set(p.id, {
        enemies: players.filter(e => e.alive && e.id !== p.id),
        occupied: new Set(),
        future: new Set(),
        secondFuture: new Set(),
        trails: new Set()
      });
    }
    for (let source of players) {
      if (!source.alive) continue;
      for (let target of players) {
        if (!target.alive || target.id === source.id) continue;
        const hazard = hazards.get(target.id);
        if (!hazard) continue;
        hazard.occupied.add(`${source.x},${source.y}`);
        const fx = source.x + source.dir.x;
        const fy = source.y + source.dir.y;
        if (fx >= 0 && fx < paperioSize && fy >= 0 && fy < paperioSize) {
          hazard.future.add(`${fx},${fy}`);
          const sx = fx + source.dir.x;
          const sy = fy + source.dir.y;
          if (sx >= 0 && sx < paperioSize && sy >= 0 && sy < paperioSize) {
            hazard.secondFuture.add(`${sx},${sy}`);
          }
        }
        for (let t of source.trail) {
          hazard.trails.add(`${t.x},${t.y}`);
        }
      }
    }
    return hazards;
  }

  function estimateSafeArea(bot, startX, startY, hazard, ownTrailSet) {
    const visited = new Set();
    const queue = [{x:startX, y:startY, dist:0}];
    let reachable = 0;
    const maxDist = 6;
    while (queue.length) {
      const {x, y, dist} = queue.shift();
      if (x < 0 || x >= paperioSize || y < 0 || y >= paperioSize) continue;
      const key = `${x},${y}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (hazard.occupied.has(key) && !(x === startX && y === startY)) continue;
      if (hazard.trails.has(key) && !(x === startX && y === startY)) continue;
      if (ownTrailSet.has(key) && !(x === startX && y === startY)) continue;
      reachable++;
      if (dist >= maxDist) continue;
      for (let d of paperioDirs) {
        const nx = x + d.x;
        const ny = y + d.y;
        if (nx < 0 || nx >= paperioSize || ny < 0 || ny >= paperioSize) continue;
        const futureKey = `${nx},${ny}`;
        if (hazard.future.has(futureKey) && dist >= 1) continue;
        queue.push({x:nx, y:ny, dist:dist+1});
      }
    }
    return reachable;
  }

  function evaluateBotDirection(bot, dir, hazard) {
    hazard = hazard || { enemies: [], occupied: new Set(), future: new Set(), secondFuture: new Set(), trails: new Set() };
    const nx = bot.x + dir.x;
    const ny = bot.y + dir.y;
    if (nx < 0 || nx >= paperioSize || ny < 0 || ny >= paperioSize) return -999;
    const key = `${nx},${ny}`;
    const ownTrailSet = new Set(bot.trail.map(t => `${t.x},${t.y}`));
    if (ownTrailSet.has(key)) return -600;

    let score = 0;
    const owner = paperioBoard[ny][nx];
    const onOwnLand = owner === bot.id;
    const onEmpty = owner === -1;
    const trailLength = bot.trail.length;

    if (onOwnLand && trailLength > 0) {
      score += 75 + trailLength * 6;
    } else if (trailLength > 0) {
      const currentDist = distanceToNearestLand(bot, bot.x, bot.y);
      const nextDist = distanceToNearestLand(bot, nx, ny);
      if (nextDist < currentDist) score += 18;
      if (nextDist > currentDist) score -= 10 + trailLength;
      if (nextDist > currentDist + 1) score -= trailLength * 1.5;
    } else {
      if (onEmpty) score += 14;
      else if (!onOwnLand) score += 8;
      else score -= 4;
    }

    const spawnDistNow = Math.abs(bot.spawn.x - bot.x) + Math.abs(bot.spawn.y - bot.y);
    const spawnDistNext = Math.abs(bot.spawn.x - nx) + Math.abs(bot.spawn.y - ny);
    if (trailLength >= 6) {
      score -= spawnDistNext * 1.4;
    } else if (trailLength >= 3) {
      score += (spawnDistNext < spawnDistNow ? 6 : -4);
    } else if (spawnDistNext < spawnDistNow) {
      score += 2;
    }

    if (hazard.trails.has(key)) score += 45;

    if (hazard.occupied.has(key)) score -= 140;
    if (hazard.future.has(key) && !hazard.trails.has(key)) score -= 70;
    if (hazard.secondFuture.has(key) && trailLength <= 2) score -= 20;

    for (let enemy of hazard.enemies) {
      const dist = Math.abs(enemy.x - nx) + Math.abs(enemy.y - ny);
      if (dist <= 1) score -= 18;
      else if (dist === 2) score -= 6;
    }

    ownTrailSet.add(key);
    const safeArea = estimateSafeArea(bot, nx, ny, hazard, ownTrailSet);
    if (safeArea < 4) score -= 25;
    else if (safeArea < 7) score -= 10;
    else score += Math.min(safeArea, 25) * 0.45;

    const borderDist = Math.min(nx, ny, paperioSize - 1 - nx, paperioSize - 1 - ny);
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
  const boot = () => {
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
      globalScope.location.replace('index.html');
      return;
    }
    showMultiGame();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}

if (typeof module !== 'undefined') {
  module.exports = { toggleGameSections, updateMenuButtons, GAME_SECTIONS };
}
