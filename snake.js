(function () {
  // Snake game implementation (extracted from multi-game.js)
  const globalScope = typeof window !== 'undefined' ? window : globalThis;

  function createSnakeModule() {
    const canvas = document.getElementById('snake-canvas');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const tileSize = 20;
    const tileCount = Math.floor(canvas.width / tileSize);

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
      if (score > personalBest) {
        personalBest = score;
        const bestEl = document.getElementById('snake-highscore');
        if (bestEl) bestEl.textContent = `High Score: ${personalBest}`;
        if (window.supabaseHighScores) {
          window.supabaseHighScores.updateHighScore('highscore-snake', personalBest);
        }
      }
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

    return {
      init() {
        if (!document.__snakeBound) {
          document.addEventListener('keydown', handleKey);
          document.__snakeBound = true;
        }
        resetSnake();
      },
      reset: resetSnake
    };
  }

  let snakeModule = null;
  let personalBest = 0;
  function initSnakeGame() {
    if (!snakeModule) snakeModule = createSnakeModule();
    if (snakeModule && typeof snakeModule.init === 'function') {
      snakeModule.init();
      if (window.supabaseHighScores) {
        window.supabaseHighScores.loadAndDisplay('highscore-snake', 'snake-highscore').then(best => {
          if (typeof best === 'number') personalBest = best;
        });
      }
    }
  }

  // expose globals for backward compatibility
  globalScope.initSnakeGame = initSnakeGame;
  globalScope.resetSnake = function () {
    if (!snakeModule) initSnakeGame();
    if (snakeModule && typeof snakeModule.reset === 'function') snakeModule.reset();
  };
})();
