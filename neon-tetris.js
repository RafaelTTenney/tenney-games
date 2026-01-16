import { getHighScore, submitHighScore } from './score-store.js';

(function () {
  // Neon Tetris (full implementation restored from original experimental.js)
  const win = typeof window !== 'undefined' ? window : globalThis;

  // DOM element references (modal and inner elements)
  const tetrisModal = document.getElementById('tetrisModal');
  const runTetrisBtn = document.getElementById('runTetrisBtn');
  const modalCloseBtn = document.getElementById('modalCloseBtn');

  const canvas = document.getElementById('game');
  const ctx = canvas ? canvas.getContext('2d') : null;
  const scoreP = document.getElementById('score');
  const startBtn = document.getElementById('startBtn');
  const controlsBtn = document.getElementById('controlsBtn');

  // Game constants & state
  const box = 24;
  const speed = 50; // Milliseconds per frame

  let fastFall = false;
  let score = 0;
  const GAME_ID = 'neon-tetris';
  let highScore = 0;

  function renderScore() {
    if (scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
  }

  async function loadHighScore() {
    highScore = await getHighScore(GAME_ID);
    renderScore();
  }

  async function saveHighScore() {
    const saved = await submitHighScore(GAME_ID, highScore);
    if (typeof saved === 'number') highScore = saved;
    renderScore();
  }

  // In-game variables
  let block;
  let rows;
  let game; // holds setInterval ID
  let count;
  let currentLevel = 0;

  const colorPalettes = [
    { fill: '#00FFFF', stroke: '#33FFFF', shadow: '#00FFFF' }, // Level 0 (Cyan)
    { fill: '#FF00FF', stroke: '#FF33FF', shadow: '#FF00FF' },
    { fill: '#00FF00', stroke: '#33FF33', shadow: '#00FF00' },
    { fill: '#FFA500', stroke: '#FFB733', shadow: '#FFA500' },
    { fill: '#FFFF00', stroke: '#FFFF33', shadow: '#FFFF00' },
    { fill: '#9D00FF', stroke: '#8C00E6', shadow: '#9D00FF' },
    { fill: '#FD1C03', stroke: '#E41903', shadow: '#FD1C03' },
    { fill: '#FF69B4', stroke: '#E6529E', shadow: '#FF69B4' },
    { fill: '#F0F0F0', stroke: '#D9D9D9', shadow: '#F0F0F0' }
  ];

  const all_blocks = {
    0: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    1: [[1, 1], [1, 1]],
    2: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    3: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    4: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    5: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    6: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    7: [[0, 1, 0], [1, 1, 1], [0, 1, 0]],
    8: [[1, 0, 1], [1, 1, 1], [0, 0, 0]],
    9: [[1, 0, 0], [1, 1, 1], [0, 0, 1]],
    10: [[0, 0, 1], [1, 1, 1], [1, 0, 0]],
    11: [[1, 1, 1], [0, 1, 0], [0, 1, 0]]
  };

  function start() {
    rows = [];
    for (let i = 0; i < 20; i++) {
      let row = [];
      for (let x = 0; x < 10; x++) {
        row.push(0);
      }
      rows.push(row);
    }
    score = 0;
    currentLevel = 0;
    loadHighScore();
    count = 10;
    if (game) clearInterval(game);
    game = setInterval(drawFrame, speed);
    if (startBtn) startBtn.textContent = 'Restart';
  }

  function rotate() {
    if (!block) return;
    block[0] = transpose(block[0]);
    block[0] = reverse(block[0]);
    if (isColliding(block)) {
      block[0] = reverse(block[0]);
      block[0] = transpose(block[0]);
    }
  }

  function moveRight() {
    if (!block) return;
    block[1] += 1;
    if (isColliding(block)) block[1] -= 1;
  }

  function moveLeft() {
    if (!block) return;
    block[1] -= 1;
    if (isColliding(block)) block[1] += 1;
  }

  function transpose(L) {
    let final = [];
    for (let i = 0; i < L[0].length; i++) final.push([]);
    for (let i = 0; i < L.length; i++) {
      for (let x = 0; x < L[i].length; x++) final[x].push(L[i][x]);
    }
    return final;
  }

  function reverse(L) {
    for (let i = 0; i < L.length; i++) L[i].reverse();
    return L;
  }

  function isColliding(B) {
    for (let y = 0; y < B[0].length; y++) {
      for (let x = 0; x < B[0][y].length; x++) {
        if (B[0][y][x] === 1) {
          if (
            (B[1] + x) < 0 ||
            (B[1] + x) >= 10 ||
            (B[2] + y) >= 20
          ) {
            return true;
          }
          if (rows[B[2] + y] && rows[B[2] + y][B[1] + x] === 1) {
            return true;
          }
        }
      }
    }
    return false;
  }

  function drawFrame() {
    if (!ctx) return;

    if (!block) {
      let blockPoolSize = 7 + currentLevel;
      if (blockPoolSize > 12) blockPoolSize = 12; // Cap is 12 (0-11)

      let newBlockIndex = Math.floor(Math.random() * blockPoolSize);
      block = [all_blocks[newBlockIndex], 4, 0];

      if (isColliding(block)) {
        clearInterval(game);
        game = null;
        if (startBtn) startBtn.textContent = 'Start';
        if (score > highScore) {
          console.log('Game Over! New high score: ' + score);
          highScore = score;
          saveHighScore();
        } else {
          console.log('Game Over! Score: ' + score);
        }
        return;
      }
      return;
    }

    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (count === 0 || (fastFall && (count % 2 === 0))) {
      count = 10;
      block[2] += 1;

      if (isColliding(block)) {
        block[2] -= 1;

        for (let y = 0; y < block[0].length; y++) {
          for (let x = 0; x < block[0][y].length; x++) {
            if (block[0][y][x] === 1) {
              if (rows[block[2] + y]) {
                  rows[block[2] + y][block[1] + x] = 1;
              }
            }
          }
        }

        block = null;

        for (let i = 0; i < 20; i++) {
          if (rows[i] && !rows[i].some(b => b === 0)) {
            rows.splice(i, 1);

            let row = []
            for (let x = 0; x < 10; x++) row.push(0);
            rows.unshift(row);

            score += 10;

            let newLevel = Math.floor(score / 50); //potentially 100 points per level
            if (newLevel > currentLevel) {
                currentLevel = newLevel;
                console.log("Level up! Now on level " + currentLevel);
            }

            renderScore();
            i--;
          }
        }
      }
    }

    let RaB = rows.map(row => [...row]);
    if (block) {
      for (let y = 0; y < block[0].length; y++) {
        for (let x = 0; x < block[0][y].length; x++) {
          if (block[0][y][x] === 1) {
            if (RaB[block[2] + y]) {
               RaB[block[2] + y][block[1] + x] = 1;
            }
          }
        }
      }
    }

    let palette = colorPalettes[currentLevel % colorPalettes.length];
    ctx.fillStyle = palette.fill;
    ctx.strokeStyle = palette.stroke;
    ctx.lineWidth = 1;
    ctx.shadowColor = palette.shadow;
    ctx.shadowBlur = 5;

    const size = box - 3; // New size (e.g., 21px)
    const offset = 1.5;   // Offset to center the 21px block in the 24px cell

    for (let y = 0; y < RaB.length; y++) {
      for (let x = 0; x < RaB[y].length; x++) {
        if (RaB[y][x] === 1) {
          ctx.fillRect(x * box + offset, y * box + offset, size, size);
          ctx.strokeRect(x * box + offset, y * box + offset, size, size);
        }
      }
    }

    ctx.shadowBlur = 0;
    count -= 1;
  }

  // Key handling (only active while modal open and game running)
  function onKeyDown(event) {
    if (tetrisModal && tetrisModal.style.display !== 'flex' || !game) return;

    if (
      ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key) ||
      event.code === 'Space'
    ) {
      event.preventDefault();
    }
    if (event.key === 'ArrowLeft') moveLeft();
    if (event.key === 'ArrowRight') moveRight();
    if (event.code === 'Space') rotate();
    if (event.key === 'ArrowDown') fastFall = true;
  }

  function onKeyUp(event) {
    if (event.key === 'ArrowDown') fastFall = false;
  }

  // INIT function (to be called by UI loader)
  function initTetrisGame() {
      if (startBtn) startBtn.addEventListener('click', start);
      if (controlsBtn) controlsBtn.addEventListener('click', function() {
        console.log('Controls:\nRight Arrow: Right\nLeft Arrow: Left\nSpace Bar: Rotate\nDown Arrow: Speed Up Fall');
      });
      // Load high score on script start
      loadHighScore();

      if (!document.__neonTetrisKeysBound) {
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        document.__neonTetrisKeysBound = true;
      }
  }

  // Expose legacy/global names for compatibility
  win.initTetrisGame = initTetrisGame;
  win.loadHighScore = loadHighScore;
  win.saveHighScore = saveHighScore;
  // Expose core control names used previously
  win.start = start;
  win.rotate = rotate;
  win.moveLeft = moveLeft;
  win.moveRight = moveRight;
})();
