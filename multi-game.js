function showMultiGame() {
  // Menu logic
    function showGame(game) {
      document.getElementById('snake-game').style.display = (game === 'snake') ? 'flex' : 'none';
      document.getElementById('memory-game').style.display = (game === 'memory') ? 'flex' : 'none';
    }
    // Start with menu only
    showGame('');

    // --- Snake Game Implementation ---
    const canvas = document.getElementById('snake-canvas');
    const ctx = canvas.getContext('2d');
    const gridSize = 16;
    let snake, direction, food, score, gameOver, moveQueue, snakeInterval;

    function resetSnake() {
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
      let valid = false;
      while (!valid) {
        food = {
          x: Math.floor(Math.random() * (canvas.width / gridSize)),
          y: Math.floor(Math.random() * (canvas.height / gridSize))
        };
        valid = !snake.some(seg => seg.x === food.x && seg.y === food.y);
      }
    }

    function drawSnake() {
      ctx.fillStyle = "#111";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // Draw food
      ctx.fillStyle = "#e22";
      ctx.fillRect(food.x * gridSize, food.y * gridSize, gridSize, gridSize);
      // Draw snake
      ctx.fillStyle = "#1a8";
      snake.forEach((seg, i) => {
        ctx.fillRect(seg.x * gridSize, seg.y * gridSize, gridSize, gridSize);
        if (i === 0) {
          ctx.strokeStyle = "#fff";
          ctx.strokeRect(seg.x * gridSize + 2, seg.y * gridSize + 2, gridSize - 4, gridSize - 4);
        }
      });
      if (gameOver) {
        ctx.fillStyle = "#fff";
        ctx.font = "24px Arial";
        ctx.fillText("Game Over!", 70, 160);
      }
    }

    function gameLoop() {
      if (gameOver) return;
      // Handle queued moves
      if (moveQueue.length > 0) {
        const move = moveQueue.shift();
        if ((move.x !== -direction.x || move.y !== -direction.y)) direction = move;
      }
      // Calculate next head position
      const head = {x: snake[0].x + direction.x, y: snake[0].y + direction.y};
      // Check collisions
      if (head.x < 0 || head.x >= canvas.width / gridSize ||
          head.y < 0 || head.y >= canvas.height / gridSize ||
          snake.some(seg => seg.x === head.x && seg.y === head.y)) {
        gameOver = true;
        clearInterval(snakeInterval);
        drawSnake();
        return;
      }
      // Add new head
      snake.unshift(head);
      // Check for food
      if (head.x === food.x && head.y === food.y) {
        score++;
        updateSnakeScore();
        placeFood();
      } else {
        snake.pop();
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

    function resetMemory() {
      // symbols are emoji pairs
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
      let currentIndex = array.length, randomIndex;
      while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
      }
      return array;
    }

    function updateMemoryMoves() {
      document.getElementById('memory-moves').textContent = 'Moves: ' + memoryMoves;
    }

    function renderMemoryBoard() {
      memoryBoard.innerHTML = '';
      memoryCards.forEach(card => {
        const div = document.createElement('div');
        div.className = 'card' + (card.flipped ? ' flipped' : '') + (card.matched ? ' matched' : '');
        div.textContent = card.flipped || card.matched ? card.symbol : '';
        div.onclick = () => flipMemoryCard(card.id);
        memoryBoard.appendChild(div);
      });
    }

    function flipMemoryCard(id) {
      if (memoryLock) return;
      const card = memoryCards[id];
      if (card.flipped || card.matched) return;
      card.flipped = true;
      renderMemoryBoard();
      if (!memoryFirstCard) {
        memoryFirstCard = card;
      } else {
        memorySecondCard = card;
        memoryMoves++;
        updateMemoryMoves();
        memoryLock = true;
        setTimeout(() => {
          if (memoryFirstCard.symbol === memorySecondCard.symbol) {
            memoryFirstCard.matched = true;
            memorySecondCard.matched = true;
            memoryMatched += 2;
            if (memoryMatched === memoryCards.length) {
              setTimeout(() => {
                alert('Congratulations! You matched all pairs in ' + memoryMoves + ' moves.');
                resetMemory();
              }, 200);
            }
          } else {
            memoryFirstCard.flipped = false;
            memorySecondCard.flipped = false;
          }
          memoryFirstCard = null;
          memorySecondCard = null;
          memoryLock = false;
          renderMemoryBoard();
        }, 800);
      }
    }

    // Initialize both games
    resetSnake();
    resetMemory();
}
