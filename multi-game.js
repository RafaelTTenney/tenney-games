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

// ----------------- Paper-io (simplified) -----------------
function initPaperioGame() {
  const canvas = document.getElementById('paperio-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const gridSize = 20;
  const cellSize = canvas.width / gridSize;

  let board = [];
  let players = [];
  let intervalId = null;
  const scoreboardEl = document.getElementById('paperio-scoreboard');
  const eliminationEl = document.getElementById('paperio-elim');

  const COLORS = ['#1a8', '#e55353', '#ffe933', '#1bbf48'];
  const NAMES = ['You', 'Bot 1', 'Bot 2', 'Bot 3'];

  function buildBoard() {
    board = Array.from({ length: gridSize }, () => Array(gridSize).fill(-1));
  }

  function drawBoard() {
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const owner = board[y][x];
        if (owner >= 0 && players[owner] && players[owner].alive) {
          ctx.fillStyle = players[owner].color;
          ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
        } else {
          ctx.fillStyle = '#111';
          ctx.fillRect(x * cellSize, y * cellSize, cellSize - 1, cellSize - 1);
        }
      }
    }

    players.forEach(player => {
      if (!player.alive) return;
      ctx.fillStyle = '#fff';
      ctx.fillRect(
        player.x * cellSize + cellSize * 0.25,
        player.y * cellSize + cellSize * 0.25,
        cellSize * 0.5,
        cellSize * 0.5
      );
      ctx.fillStyle = player.color;
      ctx.fillRect(
        player.x * cellSize + cellSize * 0.3,
        player.y * cellSize + cellSize * 0.3,
        cellSize * 0.4,
        cellSize * 0.4
      );
    });
  }

  function randomDirection() {
    const dirs = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 }
    ];
    return dirs[Math.floor(Math.random() * dirs.length)];
  }

  function resetPlayers() {
    players = [
      { id: 0, name: NAMES[0], color: COLORS[0], x: 2, y: 2, dir: { x: 1, y: 0 }, queued: null, alive: true, ai: false },
      { id: 1, name: NAMES[1], color: COLORS[1], x: 17, y: 2, dir: { x: -1, y: 0 }, queued: null, alive: true, ai: true },
      { id: 2, name: NAMES[2], color: COLORS[2], x: 2, y: 17, dir: { x: 0, y: -1 }, queued: null, alive: true, ai: true },
      { id: 3, name: NAMES[3], color: COLORS[3], x: 17, y: 17, dir: { x: 0, y: -1 }, queued: null, alive: true, ai: true }
    ];

    players.forEach(player => {
      if (!board[player.y]) return;
      board[player.y][player.x] = player.id;
    });
  }

  function updateScoreboard() {
    if (!scoreboardEl) return;
    const totals = new Array(players.length).fill(0);
    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize; x++) {
        const owner = board[y][x];
        if (owner >= 0) totals[owner] += 1;
      }
    }
    const lines = players.map(player => {
      const territory = totals[player.id];
      const status = player.alive ? 'alive' : 'eliminated';
      return `${player.name}: ${territory} cells (${status})`;
    });
    scoreboardEl.innerHTML = lines.join('<br>');
  }

  function eliminate(player, reason) {
    if (!player.alive) return;
    player.alive = false;
    if (eliminationEl) {
      eliminationEl.textContent = `${player.name} eliminated: ${reason}`;
    }
  }

  function nextPosition(player) {
    const dir = player.queued ? player.queued : player.dir;
    if (player.queued) player.dir = player.queued;
    player.queued = null;
    return {
      x: player.x + dir.x,
      y: player.y + dir.y,
      dir
    };
  }

  function advanceGame() {
    const moves = players.map(player => {
      if (!player.alive) return null;
      if (player.ai && Math.random() < 0.1) {
        player.queued = randomDirection();
      }
      const next = nextPosition(player);
      return { player, next };
    });

    const collisions = new Map();
    moves.forEach(move => {
      if (!move) return;
      const key = `${move.next.x},${move.next.y}`;
      if (!collisions.has(key)) collisions.set(key, []);
      collisions.get(key).push(move);
    });

    moves.forEach(move => {
      if (!move || !move.player.alive) return;
      const { player, next } = move;
      if (next.x < 0 || next.x >= gridSize || next.y < 0 || next.y >= gridSize) {
        eliminate(player, 'flew off the map');
        return;
      }
      const key = `${next.x},${next.y}`;
      if (collisions.get(key).length > 1) {
        eliminate(player, 'head-on collision');
        return;
      }
      player.x = next.x;
      player.y = next.y;
      board[player.y][player.x] = player.id;
    });

    const alivePlayers = players.filter(p => p.alive);
    if (alivePlayers.length <= 1) {
      clearInterval(intervalId);
      if (eliminationEl) {
        eliminationEl.textContent = alivePlayers.length === 1
          ? `${alivePlayers[0].name} controls the arena!`
          : 'Everyone crashed!';
      }
    }

    drawBoard();
    updateScoreboard();
  }

  function resetPaperio() {
    clearInterval(intervalId);
    if (eliminationEl) {
      eliminationEl.textContent = '';
    }
    buildBoard();
    resetPlayers();
    drawBoard();
    updateScoreboard();
    intervalId = setInterval(advanceGame, 400);
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

  document.addEventListener('keydown', handleKey);

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
    width: laneWidth * 0.6,
    height: 50,
    y: canvas.height - 70
  };

  const state = {
    running: false,
    lastTimestamp: 0,
    speed: 150,
    distance: 0,
    dodged: 0,
    obstacles: [],
    animationFrame: null
  };

  function drawBackground() {
    ctx.fillStyle = '#06060a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#0ff';
    ctx.setLineDash([10, 18]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(laneWidth, 0);
    ctx.lineTo(laneWidth, canvas.height);
    ctx.moveTo(laneWidth * 2, 0);
    ctx.lineTo(laneWidth * 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawPlayer() {
    ctx.fillStyle = '#1a8';
    const x = playerCar.lane * laneWidth + (laneWidth - playerCar.width) / 2;
    ctx.fillRect(x, playerCar.y, playerCar.width, playerCar.height);
  }

  function drawObstacles() {
    ctx.fillStyle = '#f55';
    state.obstacles.forEach(ob => {
      const x = ob.lane * laneWidth + (laneWidth - playerCar.width) / 2;
      ctx.fillRect(x, ob.y, playerCar.width, playerCar.height * 0.8);
    });
  }

  function spawnObstacle() {
    const lane = Math.floor(Math.random() * laneCount);
    state.obstacles.push({ lane, y: -60 });
  }

  function resetObstacles() {
    state.obstacles = [];
  }

  function updateRacer(delta) {
    const speedPerMs = state.speed / 1000;
    state.distance += speedPerMs * delta;

    state.obstacles.forEach(ob => {
      ob.y += speedPerMs * delta * 1.6;
    });

    state.obstacles = state.obstacles.filter(ob => {
      if (ob.y > canvas.height) {
        state.dodged += 1;
        return false;
      }
      return true;
    });

    if (Math.random() < 0.02) {
      spawnObstacle();
    }

    const playerX = playerCar.lane;
    const playerYTop = playerCar.y;
    const playerYBottom = playerCar.y + playerCar.height;

    for (const ob of state.obstacles) {
      const obTop = ob.y;
      const obBottom = ob.y + playerCar.height * 0.8;
      if (ob.lane === playerX && obBottom > playerYTop && obTop < playerYBottom) {
        state.running = false;
        cancelAnimationFrame(state.animationFrame);
        const message = document.getElementById('racer-message');
        if (message) {
          message.textContent = 'Crash! Tap reset to try again.';
        }
        return;
      }
    }

    if (state.dodged > 0 && state.dodged % 5 === 0) {
      state.speed = Math.min(260, state.speed + 10);
    }
  }

  function renderRacer() {
    drawBackground();
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
    state.animationFrame = requestAnimationFrame(gameLoop);
  }

  function startRacer() {
    if (state.running) return;
    const message = document.getElementById('racer-message');
    if (message) {
      message.textContent = 'Speeding through neon streets!';
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
      message.textContent = 'Paused. Press start to race again.';
    }
  }

  function resetRacer() {
    pauseRacer();
    playerCar.lane = 1;
    state.speed = 150;
    state.distance = 0;
    state.dodged = 0;
    resetObstacles();
    renderRacer();
    updateRacerHud();
    const message = document.getElementById('racer-message');
    if (message) {
      message.textContent = 'Ready to race! Use ← and → to change lanes.';
    }
  }

  function shiftLane(offset) {
    const nextLane = Math.min(laneCount - 1, Math.max(0, playerCar.lane + offset));
    playerCar.lane = nextLane;
  }

  function handleKey(event) {
    if (document.getElementById('racer-game').style.display !== 'flex') return;
    if (event.key === 'ArrowLeft') {
      shiftLane(-1);
      renderRacer();
      updateRacerHud();
      event.preventDefault();
    }
    if (event.key === 'ArrowRight') {
      shiftLane(1);
      renderRacer();
      updateRacerHud();
      event.preventDefault();
    }
  }

  document.addEventListener('keydown', handleKey);

  function updateHud() {
    const distanceEl = document.getElementById('racer-distance');
    const speedEl = document.getElementById('racer-speed');
    const obstaclesEl = document.getElementById('racer-obstacles');
    if (distanceEl) distanceEl.textContent = `Distance: ${Math.floor(state.distance)}m`;
    if (speedEl) speedEl.textContent = `Speed: ${Math.floor(state.speed)} mph`;
    if (obstaclesEl) obstaclesEl.textContent = `Dodged: ${state.dodged}`;
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
