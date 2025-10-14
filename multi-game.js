function showMultiGame() {
  // Menu logic - Make showGame globally accessible
  window.showGame = function(game) {
    document.getElementById('snake-game').style.display = (game === 'snake') ? 'flex' : 'none';
    document.getElementById('memory-game').style.display = (game === 'memory') ? 'flex' : 'none';
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

  // Initialize both games
  window.resetSnake();
  window.resetMemory();
}
