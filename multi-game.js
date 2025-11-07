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
    const isActive = name === game;
    el.style.display = isActive ? 'flex' : 'none';
    if (typeof el.setAttribute === 'function') {
      el.setAttribute('aria-hidden', isActive ? 'false' : 'true');
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

globalScope.showGame = function showGame(game, docOverride) {
  const doc = docOverride || (typeof document !== 'undefined' ? document : null);
  if (!doc) return;
  if (!toggleGameSections(game, doc)) return;
  updateMenuButtons(game, doc);

  if (game === 'racer' && typeof globalScope.pauseRacer === 'function') {
    globalScope.pauseRacer();
    updateRacerHud();
  }
};

function bindMenuButtons(doc = document) {
  const menuButtons = doc.querySelectorAll('[data-game-target]');
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
}

// ----------------- Snake Game -----------------
function initSnakeGame() {
  const canvas = document.getElementById('snake-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const tileSize = 20;
  const tileCount = canvas.width / tileSize;

  let snake = [];
  let direction = { x: 0, y: -1 };
  let queuedDirection = { x: 0, y: -1 };
  let food = { x: 5, y: 5 };
  let score = 0;
  let intervalId = null;
  let gameOver = false;

  function updateScore() {
    const scoreEl = document.getElementById('snake-score');
    if (scoreEl) scoreEl.textContent = `Score: ${score}`;
  }

  function randomPosition() {
    return {
      x: Math.floor(Math.random() * tileCount),
      y: Math.floor(Math.random() * tileCount)
    };
  }

  function placeFood() {
    let candidate = randomPosition();
    while (snake.some(segment => segment.x === candidate.x && segment.y === candidate.y)) {
      candidate = randomPosition();
    }
    food = candidate;
  }

  function drawBlock(x, y, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x * tileSize, y * tileSize, tileSize - 1, tileSize - 1);
  }

  function drawSnake() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawBlock(food.x, food.y, '#1a8');

    snake.forEach((segment, index) => {
      drawBlock(segment.x, segment.y, index === 0 ? '#fff' : '#7de3ff');
    });

    if (gameOver) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = '22px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2);
      ctx.textAlign = 'start';
    }
  }

  function step() {
    if (gameOver) return;

    direction = queuedDirection;
    const newHead = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y
    };

    if (
      newHead.x < 0 ||
      newHead.y < 0 ||
      newHead.x >= tileCount ||
      newHead.y >= tileCount ||
      snake.some(seg => seg.x === newHead.x && seg.y === newHead.y)
    ) {
      gameOver = true;
      clearInterval(intervalId);
      drawSnake();
      return;
    }

    snake.unshift(newHead);

    if (newHead.x === food.x && newHead.y === food.y) {
      score += 1;
      updateScore();
      placeFood();
    } else {
      snake.pop();
    }

    drawSnake();
  }

  function setDirection(x, y) {
    const isOpposite = direction.x === -x && direction.y === -y;
    if (isOpposite) return;
    queuedDirection = { x, y };
  }

  function resetSnake() {
    snake = [{ x: Math.floor(tileCount / 2), y: Math.floor(tileCount / 2) }];
    direction = { x: 0, y: -1 };
    queuedDirection = { x: 0, y: -1 };
    score = 0;
    gameOver = false;
    updateScore();
    placeFood();
    drawSnake();
    clearInterval(intervalId);
    intervalId = setInterval(step, 180);
  }

  function handleKey(event) {
    if (document.getElementById('snake-game').style.display !== 'flex') return;
    switch (event.key) {
      case 'ArrowUp':
        setDirection(0, -1);
        break;
      case 'ArrowDown':
        setDirection(0, 1);
        break;
      case 'ArrowLeft':
        setDirection(-1, 0);
        break;
      case 'ArrowRight':
        setDirection(1, 0);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  document.addEventListener('keydown', handleKey);

  globalScope.resetSnake = resetSnake;
  resetSnake();
}

// ----------------- Memory Game -----------------
function initMemoryGame() {
  const board = document.getElementById('memory-board');
  const movesEl = document.getElementById('memory-moves');
  if (!board) return;

  const baseSymbols = ['🍎','🎲','🚗','🐍','🌵','🏀','🎸','🍩'];
  let cards = [];
  let firstCard = null;
  let secondCard = null;
  let lockBoard = false;
  let moves = 0;
  let matchedPairs = 0;

  function shuffle(array) {
    const cloned = array.slice();
    for (let i = cloned.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
    }
    return cloned;
  }

  function updateMoves() {
    if (movesEl) movesEl.textContent = `Moves: ${moves}`;
  }

  function createCardElement(card) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.id = card.id;
    cardEl.textContent = '';

    cardEl.addEventListener('click', () => {
      if (lockBoard || card.flipped || card.matched) return;
      flipCard(card, cardEl);
    });

    return cardEl;
  }

  function flipCard(card, cardEl) {
    card.flipped = true;
    cardEl.classList.add('flipped');
    cardEl.textContent = card.symbol;

    if (!firstCard) {
      firstCard = { card, el: cardEl };
      return;
    }

    secondCard = { card, el: cardEl };
    lockBoard = true;
    moves += 1;
    updateMoves();

    if (firstCard.card.symbol === secondCard.card.symbol) {
      firstCard.card.matched = true;
      secondCard.card.matched = true;
      firstCard.el.classList.add('matched');
      secondCard.el.classList.add('matched');
      matchedPairs += 1;
      resetTurn();
      if (matchedPairs === cards.length / 2) {
        setTimeout(() => {
          alert('Great job! You matched all pairs!');
          resetMemory();
        }, 400);
      }
    } else {
      setTimeout(() => {
        firstCard.card.flipped = false;
        secondCard.card.flipped = false;
        firstCard.el.classList.remove('flipped');
        secondCard.el.classList.remove('flipped');
        firstCard.el.textContent = '';
        secondCard.el.textContent = '';
        resetTurn();
      }, 700);
    }
  }

  function resetTurn() {
    lockBoard = false;
    firstCard = null;
    secondCard = null;
  }

  function renderBoard() {
    board.innerHTML = '';
    cards.forEach(card => {
      const el = createCardElement(card);
      if (card.flipped || card.matched) {
        el.classList.add(card.matched ? 'matched' : 'flipped');
        el.textContent = card.symbol;
      }
      board.appendChild(el);
    });
  }

  function resetMemory() {
    const shuffled = shuffle([...baseSymbols, ...baseSymbols]);
    cards = shuffled.map((symbol, index) => ({
      id: index,
      symbol,
      flipped: false,
      matched: false
    }));
    firstCard = null;
    secondCard = null;
    lockBoard = false;
    moves = 0;
    matchedPairs = 0;
    updateMoves();
    renderBoard();
  }

  globalScope.resetMemory = resetMemory;
  resetMemory();
}

// ----------------- Paper-io (scrolling arena) -----------------
function initPaperioGame() {
  const canvas = document.getElementById('paperio-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const boardSize = 60;
  const cellSize = 20;
  const totalCells = boardSize * boardSize;
  const tickMs = 180;

  let territory = [];
  let trails = [];
  let players = [];
  let intervalId = null;
  const scoreboardEl = document.getElementById('paperio-scoreboard');
  const eliminationEl = document.getElementById('paperio-elim');

  const COLORS = ['#1a8', '#e55353', '#ffe933', '#1bbf48'];
  const NAMES = ['You', 'Bot 1', 'Bot 2', 'Bot 3'];

  function createGrid(fillValue) {
    return Array.from({ length: boardSize }, () => Array(boardSize).fill(fillValue));
  }

  function buildBoard() {
    territory = createGrid(-1);
    trails = createGrid(-1);
  }

  function clearTrailCells(player) {
    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        if (trails[y][x] === player.id) {
          trails[y][x] = -1;
        }
      }
    }
    player.tail = [];
  }

  function clearTerritoryCells(player) {
    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        if (territory[y][x] === player.id) {
          territory[y][x] = -1;
        }
      }
    }
  }

  function layStartingZone(player, radius) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = player.x + dx;
        const ny = player.y + dy;
        if (nx >= 0 && nx < boardSize && ny >= 0 && ny < boardSize) {
          territory[ny][nx] = player.id;
        }
      }
    }
  }

  function spawnPlayer(player, spawn) {
    clearTrailCells(player);
    clearTerritoryCells(player);
    player.x = spawn.x;
    player.y = spawn.y;
    player.dir = { ...spawn.dir };
    player.queued = null;
    player.alive = true;
    if (player.ai) {
      player.respawnTimer = 0;
    } else {
      player.bestShare = 0;
    }
    layStartingZone(player, 2);
  }

  function createPlayer(id, name, color, ai) {
    return {
      id,
      name,
      color,
      ai,
      x: 0,
      y: 0,
      dir: { x: 1, y: 0 },
      queued: null,
      alive: true,
      tail: [],
      respawnTimer: 0,
      bestShare: 0
    };
  }

  function startingPositions() {
    return [
      { x: 4, y: 4, dir: { x: 1, y: 0 } },
      { x: boardSize - 5, y: 4, dir: { x: -1, y: 0 } },
      { x: 4, y: boardSize - 5, dir: { x: 0, y: -1 } },
      { x: boardSize - 5, y: boardSize - 5, dir: { x: 0, y: -1 } }
    ];
  }

  function resetPlayers() {
    players = [
      createPlayer(0, NAMES[0], COLORS[0], false),
      createPlayer(1, NAMES[1], COLORS[1], true),
      createPlayer(2, NAMES[2], COLORS[2], true),
      createPlayer(3, NAMES[3], COLORS[3], true)
    ];
    const spawns = startingPositions();
    players.forEach((player, index) => {
      spawnPlayer(player, spawns[index]);
    });
  }

  function territoryCount(playerId) {
    let count = 0;
    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        if (territory[y][x] === playerId) count += 1;
      }
    }
    return count;
  }

  function updateScoreboard() {
    if (!scoreboardEl) return;
    const lines = players.map(player => {
      const owned = territoryCount(player.id);
      const share = owned / totalCells;
      if (!player.ai) {
        player.bestShare = Math.max(player.bestShare, share);
      }
      const percent = (share * 100).toFixed(1);
      let status;
      if (player.alive) {
        status = 'alive';
      } else if (player.ai) {
        const seconds = Math.max(0, Math.ceil(player.respawnTimer * (tickMs / 1000)));
        status = seconds > 0 ? `respawning in ${seconds}s` : 'respawning';
      } else {
        status = 'out';
      }
      const baseLine = `${player.name}: ${owned} cells (${percent}%) — ${status}`;
      if (!player.ai) {
        return `${baseLine} • best ${(player.bestShare * 100).toFixed(1)}%`;
      }
      return baseLine;
    });
    scoreboardEl.innerHTML = lines.join('<br>');
  }

  function setEliminationMessage(message) {
    if (eliminationEl) {
      eliminationEl.textContent = message;
    }
  }

  function captureLoop(player) {
    player.tail.forEach(({ x, y }) => {
      territory[y][x] = player.id;
      trails[y][x] = -1;
    });

    if (player.tail.length === 0) return;

    const visited = createGrid(false);
    const queue = [];

    function enqueue(x, y) {
      if (x < 0 || x >= boardSize || y < 0 || y >= boardSize) return;
      if (visited[y][x]) return;
      if (territory[y][x] === player.id) return;
      visited[y][x] = true;
      queue.push({ x, y });
    }

    for (let x = 0; x < boardSize; x++) {
      enqueue(x, 0);
      enqueue(x, boardSize - 1);
    }
    for (let y = 0; y < boardSize; y++) {
      enqueue(0, y);
      enqueue(boardSize - 1, y);
    }

    while (queue.length > 0) {
      const current = queue.shift();
      const { x, y } = current;
      const neighbors = [
        { x: x + 1, y },
        { x: x - 1, y },
        { x, y: y + 1 },
        { x, y: y - 1 }
      ];
      neighbors.forEach(n => {
        if (n.x < 0 || n.x >= boardSize || n.y < 0 || n.y >= boardSize) return;
        if (visited[n.y][n.x]) return;
        if (territory[n.y][n.x] === player.id) return;
        visited[n.y][n.x] = true;
        queue.push(n);
      });
    }

    for (let y = 0; y < boardSize; y++) {
      for (let x = 0; x < boardSize; x++) {
        if (territory[y][x] !== player.id && !visited[y][x]) {
          territory[y][x] = player.id;
        }
      }
    }

    player.tail = [];
  }

  function eliminate(player, reason) {
    if (!player.alive) return;
    const owned = territoryCount(player.id);
    const share = owned / totalCells;
    if (!player.ai) {
      player.bestShare = Math.max(player.bestShare, share);
    }
    player.alive = false;
    clearTrailCells(player);
    clearTerritoryCells(player);
    if (player.ai) {
      player.respawnTimer = Math.ceil(2800 / tickMs);
      setEliminationMessage(`${player.name} eliminated: ${reason}`);
    } else {
      setEliminationMessage(`Game over! Best territory: ${(player.bestShare * 100).toFixed(1)}%`);
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }
  }

  function findSpawn(radius) {
    const margin = radius + 2;
    for (let attempt = 0; attempt < 60; attempt++) {
      const edge = Math.floor(Math.random() * 4);
      let x;
      let y;
      let dir;
      if (edge === 0) {
        x = margin + Math.floor(Math.random() * (boardSize - margin * 2));
        y = margin;
        dir = { x: 0, y: 1 };
      } else if (edge === 1) {
        x = margin + Math.floor(Math.random() * (boardSize - margin * 2));
        y = boardSize - margin - 1;
        dir = { x: 0, y: -1 };
      } else if (edge === 2) {
        x = margin;
        y = margin + Math.floor(Math.random() * (boardSize - margin * 2));
        dir = { x: 1, y: 0 };
      } else {
        x = boardSize - margin - 1;
        y = margin + Math.floor(Math.random() * (boardSize - margin * 2));
        dir = { x: -1, y: 0 };
      }

      let blocked = false;
      for (let dy = -radius; dy <= radius && !blocked; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= boardSize || ny < 0 || ny >= boardSize) {
            blocked = true;
            break;
          }
          if (territory[ny][nx] !== -1 || trails[ny][nx] !== -1) {
            blocked = true;
            break;
          }
        }
      }

      if (!blocked) {
        return { x, y, dir };
      }
    }
    const fallback = startingPositions()[Math.floor(Math.random() * startingPositions().length)];
    return fallback;
  }

  function handleRespawns() {
    players.forEach(player => {
      if (!player.ai || player.alive) return;
      if (player.respawnTimer > 0) {
        player.respawnTimer -= 1;
      }
      if (player.respawnTimer <= 0) {
        const spawn = findSpawn(2);
        spawnPlayer(player, spawn);
        setEliminationMessage(`${player.name} is back in the arena!`);
      }
    });
  }

  // --- AI helpers: safety, neighbors, BFS pathfinding, frontier search ---
  function inBounds(x, y) {
    return x >= 0 && x < boardSize && y >= 0 && y < boardSize;
  }

  function neighborsOf(x, y) {
    return [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 }
    ].filter(n => inBounds(n.x, n.y));
  }

  function isSafe(player, nx, ny) {
    if (!inBounds(nx, ny)) return false;
    // running into a tail is dangerous
    if (trails[ny][nx] >= 0 && trails[ny][nx] !== player.id) return false;
    // avoid hugging the absolute edges unless we have territory
    if (nx <= 0 || ny <= 0 || nx >= boardSize - 1 || ny >= boardSize - 1) {
      const owned = territoryCount(player.id);
      if (owned < totalCells * 0.02) return false;
    }
    return true;
  }

  function bfsFindPath(startX, startY, goalTest, maxSteps = 200) {
    const visited = Array.from({ length: boardSize }, () => Array(boardSize).fill(false));
    const queue = [];
    const parent = Array.from({ length: boardSize }, () => Array(boardSize).fill(null));
    queue.push({ x: startX, y: startY });
    visited[startY][startX] = true;
    let steps = 0;
    while (queue.length && steps < maxSteps) {
      steps++;
      const cur = queue.shift();
      if (goalTest(cur.x, cur.y)) {
        const path = [];
        let p = cur;
        while (p && !(p.x === startX && p.y === startY)) {
          path.unshift({ x: p.x, y: p.y });
          p = parent[p.y][p.x];
        }
        return path;
      }
      for (const n of neighborsOf(cur.x, cur.y)) {
        if (visited[n.y][n.x]) continue;
        // allow planning through neutral and own territory; avoid obvious tail cells for planning
        if (trails[n.y][n.x] >= 0 && trails[n.y][n.x] !== -1 && trails[n.y][n.x] !== undefined) {
          // still allow but deprioritize via parent marking (we don't implement weights here to stay cheap)
        }
        visited[n.y][n.x] = true;
        parent[n.y][n.x] = cur;
        queue.push(n);
      }
    }
    return null;
  }

  function findNearestFrontier(player) {
    const startX = player.x;
    const startY = player.y;
    const path = bfsFindPath(startX, startY, (x, y) => {
      if (territory[y][x] === player.id) return false;
      if (territory[y][x] === -1) {
        for (const n of neighborsOf(x, y)) {
          if (territory[n.y][n.x] === -1) return true;
        }
      }
      if (territory[y][x] >= 0 && territory[y][x] !== player.id) {
        for (const n of neighborsOf(x, y)) {
          if (territory[n.y][n.x] === -1) return true;
        }
      }
      return false;
    }, 400);
    return path;
  }

  function findSafeReturnToTerritory(player) {
    const path = bfsFindPath(player.x, player.y, (x, y) => territory[y][x] === player.id, 400);
    return path;
  }

  function chooseAiDirection(player) {
    const TAIL_RETURN_THRESHOLD = 3;
    if (player.tail.length >= TAIL_RETURN_THRESHOLD) {
      const backPath = findSafeReturnToTerritory(player);
      if (backPath && backPath.length > 0) {
        const next = backPath[0];
        return { x: Math.sign(next.x - player.x), y: Math.sign(next.y - player.y) };
      }
    }

    const localOptions = neighborsOf(player.x, player.y).map(n => ({ n, score: 0 }));
    localOptions.forEach(o => {
      const distEdge = Math.min(o.n.x, boardSize - 1 - o.n.x, o.n.y, boardSize - 1 - o.n.y);
      o.score += distEdge;
      if (territory[o.n.y][o.n.x] === -1) o.score += 2;
      if (trails[o.n.y][o.n.x] >= 0 && trails[o.n.y][o.n.x] !== player.id) o.score -= 20;
      if (territory[o.n.y][o.n.x] >= 0 && territory[o.n.y][o.n.x] !== player.id) o.score -= 1;
    });

    localOptions.sort((a, b) => b.score - a.score);
    for (const o of localOptions) {
      const dx = o.n.x - player.x;
      const dy = o.n.y - player.y;
      if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
      if (isSafe(player, o.n.x, o.n.y)) {
        return { x: dx, y: dy };
      }
    }

    const frontierPath = findNearestFrontier(player);
    if (frontierPath && frontierPath.length > 0) {
      const next = frontierPath[0];
      const dx = Math.sign(next.x - player.x);
      const dy = Math.sign(next.y - player.y);
      if (Math.abs(dx) + Math.abs(dy) === 1 && isSafe(player, player.x + dx, player.y + dy)) {
        return { x: dx, y: dy };
      }
    }

    const neutralPath = bfsFindPath(player.x, player.y, (x, y) => territory[y][x] === -1, 200);
    if (neutralPath && neutralPath.length > 0) {
      const next = neutralPath[0];
      const dx = Math.sign(next.x - player.x);
      const dy = Math.sign(next.y - player.y);
      if (isSafe(player, player.x + dx, player.y + dy)) {
        return { x: dx, y: dy };
      }
    }

    const options = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 }
    ].filter(opt => opt.x !== -player.dir.x || opt.y !== -player.dir.y);
    const prefer = player.dir;
    if (isSafe(player, player.x + prefer.x, player.y + prefer.y)) return prefer;
    const safeOptions = options.filter(opt => isSafe(player, player.x + opt.x, player.y + opt.y));
    if (safeOptions.length) return safeOptions[Math.floor(Math.random() * safeOptions.length)];
    return options[Math.floor(Math.random() * options.length)];
  }

  // --- Replace chooseTurn with improved function used by AI players ---
  function chooseTurn(player) {
    if (player.ai && Math.random() < 0.06) {
      const opts = neighborsOf(player.x, player.y);
      for (let i = 0; i < opts.length; i++) {
        const pick = opts[Math.floor(Math.random() * opts.length)];
        if (territory[pick.y][pick.x] === -1 && isSafe(player, pick.x, pick.y)) {
          return { x: pick.x - player.x, y: pick.y - player.y };
        }
      }
    }
    return chooseAiDirection(player);
  }

  // --- Update advanceGame AI application: queue a direction rather than direct immediate dir change ---
  function advanceGame() {
    const moves = [];
    players.forEach(player => {
      if (!player.alive) return;

      if (player.queued && (player.queued.x !== -player.dir.x || player.queued.y !== -player.dir.y)) {
        player.dir = player.queued;
      }
      player.queued = null;

      if (player.ai) {
        const desired = chooseTurn(player);
        if (desired) {
          if (desired.x !== -player.dir.x || desired.y !== -player.dir.y) {
            player.dir = desired;
          }
        }
      }

      const nextX = player.x + player.dir.x;
      const nextY = player.y + player.dir.y;
      if (nextX < 0 || nextX >= boardSize || nextY < 0 || nextY >= boardSize) {
        eliminate(player, 'flew off the map');
        return;
      }
      moves.push({ player, nextX, nextY });
    });

    const targetMap = new Map();
    moves.forEach(move => {
      const key = `${move.nextX},${move.nextY}`;
      if (!targetMap.has(key)) targetMap.set(key, []);
      targetMap.get(key).push(move.player);
    });

    targetMap.forEach((contestants, key) => {
      if (contestants.length > 1) {
        contestants.forEach(player => {
          eliminate(player, 'head-on collision');
        });
      }
    });

    moves.forEach(move => {
      const { player, nextX, nextY } = move;
      if (!player.alive) return;

      const tailOwner = trails[nextY][nextX];
      if (tailOwner >= 0) {
        if (tailOwner === player.id) {
          eliminate(player, 'ran into their own trail');
          return;
        }
        eliminate(players[tailOwner], `${player.name} clipped their tail`);
        trails[nextY][nextX] = -1;
      }

      player.x = nextX;
      player.y = nextY;

      if (territory[nextY][nextX] !== player.id) {
        if (!player.tail.some(cell => cell.x === nextX && cell.y === nextY)) {
          player.tail.push({ x: nextX, y: nextY });
        }
        trails[nextY][nextX] = player.id;
      } else if (player.tail.length > 0) {
        captureLoop(player);
      }
    });
  }

  function drawBoard() {
    const player = players[0];
    const worldWidth = boardSize * cellSize;
    const worldHeight = boardSize * cellSize;
    const focusX = player.x * cellSize + cellSize / 2;
    const focusY = player.y * cellSize + cellSize / 2;
    const offsetX = Math.min(Math.max(focusX - canvas.width / 2, 0), Math.max(0, worldWidth - canvas.width));
    const offsetY = Math.min(Math.max(focusY - canvas.height / 2, 0), Math.max(0, worldHeight - canvas.height));

    ctx.fillStyle = '#02070d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const startCol = Math.max(0, Math.floor(offsetX / cellSize));
    const endCol = Math.min(boardSize, Math.ceil((offsetX + canvas.width) / cellSize));
    const startRow = Math.max(0, Math.floor(offsetY / cellSize));
    const endRow = Math.min(boardSize, Math.ceil((offsetY + canvas.height) / cellSize));

    for (let y = startRow; y < endRow; y++) {
      for (let x = startCol; x < endCol; x++) {
        const screenX = x * cellSize - offsetX;
        const screenY = y * cellSize - offsetY;
        const owner = territory[y][x];
        if (owner >= 0) {
          ctx.fillStyle = players[owner].color;
        } else {
          ctx.fillStyle = '#0c1721';
        }
        ctx.fillRect(screenX, screenY, cellSize, cellSize);

        const tailOwner = trails[y][x];
        if (tailOwner >= 0) {
          ctx.fillStyle = `${players[tailOwner].color}AA`;
          ctx.fillRect(screenX + cellSize * 0.2, screenY + cellSize * 0.2, cellSize * 0.6, cellSize * 0.6);
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.strokeRect(screenX, screenY, cellSize, cellSize);
      }
    }

    players.forEach(p => {
      if (!p.alive) return;
      const screenX = p.x * cellSize - offsetX;
      const screenY = p.y * cellSize - offsetY;
      ctx.fillStyle = '#111';
      ctx.fillRect(screenX + 3, screenY + 3, cellSize - 6, cellSize - 6);
      ctx.fillStyle = p.color;
      ctx.fillRect(screenX + 6, screenY + 6, cellSize - 12, cellSize - 12);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.strokeRect(screenX + 6, screenY + 6, cellSize - 12, cellSize - 12);
    });

    ctx.strokeStyle = '#0ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
  }

  function resetPaperio() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    setEliminationMessage('');
    buildBoard();
    resetPlayers();
    drawBoard();
    updateScoreboard();
    intervalId = setInterval(() => {
      advanceGame();
      handleRespawns();
      drawBoard();
      updateScoreboard();
    }, tickMs);
  }

  function handleKey(event) {
    if (document.getElementById('paperio-game').style.display !== 'flex') return;
    const player = players[0];
    if (!player || !player.alive) return;
    let nextDir = null;
    if (event.key === 'ArrowUp' && player.dir.y !== 1) nextDir = { x: 0, y: -1 };
    if (event.key === 'ArrowDown' && player.dir.y !== -1) nextDir = { x: 0, y: 1 };
    if (event.key === 'ArrowLeft' && player.dir.x !== 1) nextDir = { x: -1, y: 0 };
    if (event.key === 'ArrowRight' && player.dir.x !== -1) nextDir = { x: 1, y: 0 };
    if (nextDir) {
      player.queued = nextDir;
      event.preventDefault();
    }
  }

  if (!document.__paperioBound) {
    document.addEventListener('keydown', handleKey);
    document.__paperioBound = true;
  }

  globalScope.resetPaperio = resetPaperio;
  resetPaperio();
}

// ----------------- Neon Racer -----------------
function initRacerGame() {
  const canvas = document.getElementById('racer-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const laneCount = 3;
  const laneWidth = canvas.width / laneCount;

  const playerCar = {
    lane: 1,
    width: laneWidth * 0.55,
    height: 58,
    y: canvas.height - 90
  };

  const state = {
    running: false,
    lastTimestamp: 0,
    speed: 180,
    distance: 0,
    dodged: 0,
    obstacles: [],
    speedLines: [],
    spawnTimer: 0,
    animationFrame: null
  };

  const obstacleHeight = 60;
  const laneCenters = Array.from({ length: laneCount }, (_, i) => i * laneWidth + laneWidth / 2);

  function drawBackground() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#050417');
    gradient.addColorStop(1, '#0a0e24');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#0b1329';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#02040c';
    ctx.fillRect(0, 0, 40, canvas.height);
    ctx.fillRect(canvas.width - 40, 0, 40, canvas.height);

    ctx.strokeStyle = 'rgba(0, 255, 255, 0.4)';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    ctx.setLineDash([16, 24]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(laneWidth, 0);
    ctx.lineTo(laneWidth, canvas.height);
    ctx.moveTo(laneWidth * 2, 0);
    ctx.lineTo(laneWidth * 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawSpeedLines() {
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    state.speedLines.forEach(line => {
      ctx.beginPath();
      ctx.moveTo(line.x, line.y);
      ctx.lineTo(line.x, line.y + line.length);
      ctx.stroke();
    });
  }

  function drawPlayer() {
    const centerX = laneCenters[playerCar.lane];
    const left = centerX - playerCar.width / 2;
    ctx.save();
    ctx.shadowColor = '#2cf5ff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#19d7ff';
    ctx.fillRect(left, playerCar.y, playerCar.width, playerCar.height);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#0b1f3a';
    ctx.fillRect(left + 6, playerCar.y + 10, playerCar.width - 12, playerCar.height - 20);
    ctx.fillStyle = '#19d7ff';
    ctx.fillRect(left + playerCar.width / 2 - 6, playerCar.y + 6, 12, playerCar.height - 12);
    ctx.restore();
  }

  function drawObstacles() {
    state.obstacles.forEach(ob => {
      const top = ob.y;
      const bottom = ob.y + obstacleHeight;
      const gapLeft = ob.gapCenter - ob.gapWidth / 2;
      const gapRight = ob.gapCenter + ob.gapWidth / 2;

      ctx.save();
      ctx.shadowColor = ob.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = ob.color;
      if (gapLeft > 0) {
        ctx.fillRect(0, top, gapLeft, obstacleHeight);
      }
      if (gapRight < canvas.width) {
        ctx.fillRect(gapRight, top, canvas.width - gapRight, obstacleHeight);
      }
      ctx.restore();

      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.fillRect(gapLeft, top, ob.gapWidth, 4);
    });
  }

  function spawnObstacle() {
    const gapLane = Math.floor(Math.random() * laneCount);
    const colorHue = Math.floor(Math.random() * 360);
    const gapCenter = laneCenters[gapLane];
    const gapWidth = playerCar.width * 1.35;
    state.obstacles.push({
      y: -obstacleHeight,
      gapCenter,
      gapWidth,
      color: `hsl(${colorHue}, 90%, 60%)`
    });
    state.spawnTimer = 180 + Math.random() * 140;
  }

  function resetObstacles() {
    state.obstacles = [];
    state.spawnTimer = 0;
  }

  function ensureSpeedLines() {
    while (state.speedLines.length < 12) {
      state.speedLines.push({
        x: 60 + Math.random() * (canvas.width - 120),
        y: Math.random() * canvas.height,
        length: 18 + Math.random() * 26
      });
    }
  }

  function updateRacer(delta) {
    const pixelsPerMs = (state.speed / 1000) * 1.25;
    const traveled = pixelsPerMs * delta;
    state.distance += traveled;
    state.spawnTimer -= traveled;

    if (state.spawnTimer <= 0) {
      spawnObstacle();
    }

    state.obstacles.forEach(ob => {
      ob.y += traveled;
    });

    state.obstacles = state.obstacles.filter(ob => {
      if (ob.y > canvas.height) {
        state.dodged += 1;
        state.speed = Math.min(340, state.speed + 8);
        return false;
      }
      return true;
    });

    state.speedLines.forEach(line => {
      line.y += traveled * 1.4;
    });
    state.speedLines = state.speedLines.filter(line => line.y < canvas.height + 40);
    ensureSpeedLines();

    const carCenter = laneCenters[playerCar.lane];
    const carLeft = carCenter - playerCar.width / 2;
    const carRight = carCenter + playerCar.width / 2;
    const carTop = playerCar.y;
    const carBottom = playerCar.y + playerCar.height;

    for (const ob of state.obstacles) {
      const obTop = ob.y;
      const obBottom = ob.y + obstacleHeight;
      if (carBottom <= obTop || carTop >= obBottom) continue;
      const gapLeft = ob.gapCenter - ob.gapWidth / 2;
      const gapRight = ob.gapCenter + ob.gapWidth / 2;
      if (carLeft < gapLeft || carRight > gapRight) {
        state.running = false;
        if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
        const message = document.getElementById('racer-message');
        if (message) {
          message.textContent = 'Crash! Reset to roll out again.';
        }
        return;
      }
    }
  }

  function renderRacer() {
    drawBackground();
    drawSpeedLines();
    drawObstacles();
    drawPlayer();
  }

  function gameLoop(timestamp) {
    if (!state.running) return;
    const delta = timestamp - state.lastTimestamp;
    state.lastTimestamp = timestamp;
    updateRacer(delta);
    renderRacer();
    updateRacerHud();
    if (state.running) {
      state.animationFrame = requestAnimationFrame(gameLoop);
    }
  }

  function startRacer() {
    if (state.running) return;
    const message = document.getElementById('racer-message');
    if (message) {
      message.textContent = 'Neon boost engaged!';
    }
    state.running = true;
    state.lastTimestamp = performance.now();
    state.animationFrame = requestAnimationFrame(gameLoop);
  }

  function pauseRacer() {
    if (!state.running) return;
    state.running = false;
    if (state.animationFrame) cancelAnimationFrame(state.animationFrame);
    const message = document.getElementById('racer-message');
    if (message) {
      message.textContent = 'Paused. Hit start to keep racing.';
    }
  }

  function resetRacer() {
    pauseRacer();
    playerCar.lane = 1;
    state.speed = 180;
    state.distance = 0;
    state.dodged = 0;
    state.speedLines = [];
    resetObstacles();
    ensureSpeedLines();
    renderRacer();
    updateRacerHud();
    const message = document.getElementById('racer-message');
    if (message) {
      message.textContent = 'Ready! Use ← and → to slide through the gaps.';
    }
  }

  function shiftLane(offset) {
    const nextLane = Math.min(laneCount - 1, Math.max(0, playerCar.lane + offset));
    if (nextLane === playerCar.lane) return;
    playerCar.lane = nextLane;
    renderRacer();
    updateRacerHud();
  }

  function handleKey(event) {
    if (document.getElementById('racer-game').style.display !== 'flex') return;
    if (event.key === 'ArrowLeft') {
      shiftLane(-1);
      event.preventDefault();
    }
    if (event.key === 'ArrowRight') {
      shiftLane(1);
      event.preventDefault();
    }
  }

  if (!document.__racerBound) {
    document.addEventListener('keydown', handleKey);
    document.__racerBound = true;
  }

  function updateHud() {
    const distanceEl = document.getElementById('racer-distance');
    const speedEl = document.getElementById('racer-speed');
    const obstaclesEl = document.getElementById('racer-obstacles');
    if (distanceEl) distanceEl.textContent = `Distance: ${Math.floor(state.distance)}m`;
    if (speedEl) speedEl.textContent = `Speed: ${Math.floor(state.speed)} mph`;
    if (obstaclesEl) obstaclesEl.textContent = `Gaps cleared: ${state.dodged}`;
  }

  globalScope.startRacer = startRacer;
  globalScope.pauseRacer = pauseRacer;
  globalScope.resetRacer = resetRacer;
  globalScope.updateRacerHud = updateHud;

  resetRacer();
}

function updateRacerHud() {
  if (typeof globalScope.updateRacerHud === 'function') {
    globalScope.updateRacerHud();
  }
}

function showMultiGame() {
  bindMenuButtons();
  initSnakeGame();
  initMemoryGame();
  initPaperioGame();
  initRacerGame();
  globalScope.showGame('snake');
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
