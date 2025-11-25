(function () {
  // Full Paper-io implementation extracted from the original multi-game bundle.
  // Wrapped in an IIFE and exposes:
  //   window.initPaperioGame()  -> initialize the game (bind keys, create board, start/resume)
  //   window.resetPaperio()     -> restart / reset the game
  //
  // This restores the original behavior so the multi-game page can lazily init the game
  // without losing the original logic.
  const globalScope = typeof window !== 'undefined' ? window : globalThis;

  function createPaperioModule() {
    const canvas = document.getElementById('paperio-canvas');
    if (!canvas) return null;
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
      if (trails[ny][nx] >= 0 && trails[ny][nx] !== player.id) return false;
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
      if (document.getElementById('paperio-game') && document.getElementById('paperio-game').style.display !== 'flex') {
        // if the game is in a modal named 'paperio-game' we guard; otherwise allow normal page context.
      }
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

    // Public API
    return {
      init() {
        resetPaperio();
      },
      reset: resetPaperio
    };
  }

  let paperioModule = null;
  function initPaperioGame() {
    if (!paperioModule) paperioModule = createPaperioModule();
    if (paperioModule && typeof paperioModule.init === 'function') paperioModule.init();
  }

  globalScope.initPaperioGame = initPaperioGame;
  globalScope.resetPaperio = function () {
    if (!paperioModule) initPaperioGame();
    if (paperioModule && typeof paperioModule.reset === 'function') paperioModule.reset();
  };
})();
