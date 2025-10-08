function showMultiGame() {
  // Menu logic - Make showGame globally accessible
  window.showGame = function(game) { // <--- **FIX 1: Assign to window**
    document.getElementById('snake-game').style.display = (game === 'snake') ? 'flex' : 'none';
    document.getElementById('memory-game').style.display = (game === 'memory') ? 'flex' : 'none';
  }
  // Start with menu only
  window.showGame(''); // Now calling the globally accessible function

  // --- Snake Game Implementation ---
  const canvas = document.getElementById('snake-canvas');
  const ctx = canvas.getContext('2d');
  const gridSize = 16;
  let snake, direction, food, score, gameOver, moveQueue, snakeInterval;

  // Make resetSnake globally accessible
  window.resetSnake = function() { // <--- **FIX 2: Assign to window**
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
  // ... other snake functions (updateSnakeScore, placeFood, drawSnake, gameLoop) ...

  function updateSnakeScore() {
    document.getElementById('snake-score').textContent = 'Score: ' + score;
  }
  // ... placeFood, drawSnake, gameLoop as they were ...
  function placeFood() { /* ... */ }
  function drawSnake() { /* ... */ }
  function gameLoop() { /* ... */ }

  document.addEventListener('keydown', e => {
    // This event listener is fine because it's still within the showMultiGame scope
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

  // Make resetMemory globally accessible
  window.resetMemory = function() { // <--- **FIX 3: Assign to window**
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
  // ... other memory functions (shuffle, updateMemoryMoves, renderMemoryBoard) ...

  // Since flipMemoryCard is called via onclick *inside* renderMemoryBoard, 
  // and renderMemoryBoard is called within the scope, it should be fine.
  // However, if the element's onclick attribute directly called a function, it would need to be global too.
  function shuffle(array) { /* ... */ }
  function updateMemoryMoves() { /* ... */ }
  function renderMemoryBoard() { /* ... */ }
  function flipMemoryCard(id) { /* ... */ }


  // Initialize both games (now calls the globally assigned reset functions)
  window.resetSnake();
  window.resetMemory();
}
