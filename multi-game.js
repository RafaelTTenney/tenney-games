function showMultiGame() {
  // Menu logic - Make showGame globally accessible
  window.showGame = function(game) {
    document.getElementById('snake-game').style.display = (game === 'snake') ? 'flex' : 'none';
    document.getElementById('memory-game').style.display = (game === 'memory') ? 'flex' : 'none';
    document.getElementById('paperio-game').style.display = (game === 'paperio') ? 'flex' : 'none';
  }
  // Start with menu only
  window.showGame('');

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
    snakeInterval = setInterval(gameLoop, 100);
    drawSnake();
  }

  function updateSnakeScore() {
    document.getElementById('snake-score').textContent = 'Score: ' + score;
  }

  function placeFood() {
    while (true) {
      food = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize)
      };
      if (!snake.some(s => s.x === food.x && s.y === food.y)) break;
    }
  }

  function drawSnake() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw food
    ctx.fillStyle = "#1a8";
    ctx.fillRect(food.x * 20, food.y * 20, 20, 20);

    // Draw snake
    for (let i = 0; i < snake.length; i++) {
      ctx.fillStyle = i === 0 ? "#fff" : "#eee";
      ctx.fillRect(snake[i].x * 20, snake[i].y * 20, 20, 20);
    }

    // Draw borders
    ctx.strokeStyle = "#555";
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    if (gameOver) {
      ctx.fillStyle = "#e55353";
      ctx.font = "bold 32px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Game Over", canvas.width/2, canvas.height/2);
    }
  }

  function gameLoop() {
    if (gameOver) return;

    // Move direction from queue, if any
    if (moveQueue.length) {
      const nextDir = moveQueue.shift();
      // Prevent reverse direction
      if ((nextDir.x !== -direction.x || nextDir.y !== -direction.y)) {
        direction = nextDir;
      }
    }

    const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };

    // Check wall collision
    if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
      gameOver = true;
      clearInterval(snakeInterval);
      drawSnake();
      return;
    }

    // Check self collision
    if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
      gameOver = true;
      clearInterval(snakeInterval);
      drawSnake();
      return;
    }

    snake.unshift(head); // add new head

    // Check food
    if (head.x === food.x && head.y === food.y) {
      score++;
      updateSnakeScore();
      placeFood();
    } else {
      snake.pop(); // remove tail
    }

    drawSnake();
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
      let player = paperioPlayers[0];
      if (!player.alive) return;
      if (e.key === 'ArrowUp' && player.dir.y !== 1) { player.dir = {x:0,y:-1}; }
      if (e.key === 'ArrowDown' && player.dir.y !== -1) { player.dir = {x:0,y:1}; }
      if (e.key === 'ArrowLeft' && player.dir.x !== 1) { player.dir = {x:-1,y:0}; }
      if (e.key === 'ArrowRight' && player.dir.x !== -1) { player.dir = {x:1,y:0}; }
    }
  });

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
  }

  function updateMemoryMoves() {
    document.getElementById('memory-moves').textContent = 'Moves: ' + memoryMoves;
  }

  function renderMemoryBoard() {
    memoryBoard.innerHTML = '';
    memoryCards.forEach(card => {
      const cardDiv = document.createElement('div');
      cardDiv.className = 'card';
      if (card.flipped || card.matched) cardDiv.classList.add('flipped');
      if (card.matched) cardDiv.classList.add('matched');
      cardDiv.textContent = (card.flipped || card.matched) ? card.symbol : '';
      cardDiv.onclick = () => flipMemoryCard(card.id);
      memoryBoard.appendChild(cardDiv);
    });
  }

  function flipMemoryCard(id) {
    if (memoryLock) return;
    const card = memoryCards.find(c => c.id === id);
    if (card.flipped || card.matched) return;

    card.flipped = true;
    renderMemoryBoard();

    if (!memoryFirstCard) {
      memoryFirstCard = card;
    } else if (!memorySecondCard) {
      memorySecondCard = card;
      memoryLock = true;
      memoryMoves++;
      updateMemoryMoves();

      if (memoryFirstCard.symbol === memorySecondCard.symbol) {
        memoryFirstCard.matched = true;
        memorySecondCard.matched = true;
        memoryMatched += 2;
        setTimeout(() => {
          memoryFirstCard = null;
          memorySecondCard = null;
          memoryLock = false;
          renderMemoryBoard();
          // Win condition!
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
  let paperioPlayers, paperioBoard, paperioInterval;
  const paperioColors = ['#1a8','#e55353','#ffe933','#1bbf48'];
  const paperioNames = ['You','Bot1','Bot2','Bot3'];

  window.resetPaperio = function() {
    paperioBoard = Array.from({length:paperioSize},()=>Array(paperioSize).fill(-1));
    paperioPlayers = [
      {id:0, name:'You', color:paperioColors[0], x:2, y:2, dir:{x:1,y:0}, land:[], trail:[], alive:true, ai:false},
      {id:1, name:'Bot1', color:paperioColors[1], x:17, y:2, dir:{x:-1,y:0}, land:[], trail:[], alive:true, ai:true},
      {id:2, name:'Bot2', color:paperioColors[2], x:2, y:17, dir:{x:0,y:-1}, land:[], trail:[], alive:true, ai:true},
      {id:3, name:'Bot3', color:paperioColors[3], x:17, y:17, dir:{x:0,y:-1}, land:[], trail:[], alive:true, ai:true}
    ];
    for (let p of paperioPlayers) {
      paperioBoard[p.y][p.x] = p.id;
      p.land = [{x:p.x,y:p.y}]; p.trail = [];
      p.alive = true;
    }
    document.getElementById('paperio-elim').textContent = '';
    clearInterval(paperioInterval);
    paperioInterval = setInterval(paperioTick, 120);
    paperioDraw();
    paperioUpdateScore();
  }

  function paperioDraw() {
    paperioCtx.clearRect(0,0,paperioCanvas.width,paperioCanvas.height);
    // Draw land
    for(let y=0;y<paperioSize;y++) for(let x=0;x<paperioSize;x++) {
      let owner = paperioBoard[y][x];
      if(owner >= 0) {
        paperioCtx.fillStyle = paperioColors[owner];
        paperioCtx.fillRect(x*20, y*20, 20, 20);
      }
    }
    // Draw trails
    for (let p of paperioPlayers) {
      if (!p.alive) continue;
      paperioCtx.globalAlpha = 0.7;
      for (let t of p.trail) {
        paperioCtx.fillStyle = p.color;
        paperioCtx.fillRect(t.x*20, t.y*20, 20, 20);
      }
      paperioCtx.globalAlpha = 1.0;
    }
    // Draw players
    for (let p of paperioPlayers) {
      if (!p.alive) continue;
      paperioCtx.strokeStyle = "#111";
      paperioCtx.lineWidth = 2;
      paperioCtx.beginPath();
      paperioCtx.arc(p.x*20+10, p.y*20+10, 8, 0, 2*Math.PI);
      paperioCtx.fillStyle = p.color;
      paperioCtx.fill();
      paperioCtx.stroke();
    }
  }

  function paperioTick() {
    // Move bots
    for (let p of paperioPlayers) {
      if (!p.alive || !p.ai) continue;
      // Randomly turn sometimes, prefer not reversing
      if (Math.random()<0.2) {
        let dirs = [
          {x:0,y:-1},{x:0,y:1},{x:-1,y:0},{x:1,y:0}
        ].filter(d => !(d.x === -p.dir.x && d.y === -p.dir.y));
        // Avoid walls
        dirs = dirs.filter(d => p.x+d.x>=0 && p.x+d.x<paperioSize && p.y+d.y>=0 && p.y+d.y<paperioSize);
        if (dirs.length) p.dir = dirs[Math.floor(Math.random()*dirs.length)];
      }
    }
    // Move all
    for (let p of paperioPlayers) {
      if (!p.alive) continue;
      let nx = p.x + p.dir.x, ny = p.y + p.dir.y;
      // Check bounds
      if (nx<0 || nx>=paperioSize || ny<0 || ny>=paperioSize) {
        paperioElim(p, "hit the wall");
        continue;
      }
      // Check trail collision
      for (let q of paperioPlayers) {
        if (!q.alive) continue;
        for (let t of q.trail) {
          if (t.x === nx && t.y === ny) {
            paperioElim(p, "hit a trail");
            break;
          }
        }
        // Don't run into own trail
        if (p.trail.some(t => t.x===nx && t.y===ny)) {
          paperioElim(p, "hit own trail");
          break;
        }
        if (!p.alive) break;
      }
      if (!p.alive) continue;
      // Move
      p.trail.push({x:nx,y:ny});
      p.x = nx; p.y = ny;
      // If returned to land, claim trail
      if (p.land.some(l => l.x===nx && l.y===ny)) {
        for (let t of p.trail) {
          if (paperioBoard[t.y][t.x] !== p.id) {
            paperioBoard[t.y][t.x] = p.id;
            p.land.push({x:t.x,y:t.y});
          }
        }
        p.trail = [];
      }
      paperioDraw();
    }
    paperioUpdateScore();

    // Check win
    let alive = paperioPlayers.filter(p=>p.alive);
    if (alive.length === 1) {
      document.getElementById('paperio-elim').textContent = alive[0].id===0 ? "You win! 🏆" : `${alive[0].name} wins!`;
      clearInterval(paperioInterval);
    }
    if (alive.length === 0) {
      document.getElementById('paperio-elim').textContent = "No one wins!";
      clearInterval(paperioInterval);
    }
  }

  function paperioElim(p, reason) {
    p.alive = false;
    if (p.id===0) document.getElementById('paperio-elim').textContent = `You have been eliminated (${reason})!`;
  }

  function paperioUpdateScore() {
    let html = '<b>Scoreboard:</b><br>';
    for (let p of paperioPlayers) {
      html += `<span style="color:${p.color};">${p.name}:</span> ${p.land.length} land ${p.alive?'':'(eliminated)'}<br>`;
    }
    document.getElementById('paperio-scoreboard').innerHTML = html;
  }

  // Initialize all games
  window.resetSnake();
  window.resetMemory();
  window.resetPaperio();
}
