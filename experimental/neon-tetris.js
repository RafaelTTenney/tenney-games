(function () {
  // Neon Tetris (experimental version) -- extracted from experimental.js (initTetrisGame)
  const globalScope = typeof window !== 'undefined' ? window : globalThis;

  // This module assumes the modal elements exist on experimental.html
  function createNeonTetris() {
    const tetrisModal = document.getElementById('tetrisModal');
    const runTetrisBtn = document.getElementById('runTetrisBtn');
    const modalCloseBtn = document.getElementById('modalCloseBtn');

    const canvas = document.getElementById('game');
    const ctx = canvas ? canvas.getContext('2d') : null;
    const scoreP = document.getElementById('score');
    const startBtn = document.getElementById('startBtn');
    const controlsBtn = document.getElementById('controlsBtn');

    const box = 24;
    const speed = 50;

    let fastFall = false;
    let score = 0;
    let highScore;

    let block;
    let rows;
    let game;
    let count;
    let currentLevel = 0;

    const colorPalettes = [
      { fill: '#00FFFF', stroke: '#33FFFF', shadow: '#00FFFF' },
      { fill: '#FF00FF', stroke: '#FF33FF', shadow: '#FF00FF' },
      { fill: '#00FF00', stroke: '#33FF33', shadow: '#00FF00' },
      { fill: '#FFA500', stroke: '#FFB733', shadow: '#FFA500' },
      { fill: '#FFFF00', stroke: '#FFFF33', shadow: '#FFFF00' }
    ];

    const all_blocks = {
      0: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
      1: [[1, 1], [1, 1]],
      2: [[0, 1, 0], [1, 1, 1], [0, 0, 0]]
      // truncated - keep minimal shapes; full set can be restored if desired
    };

    function loadHighScore() {
      highScore = parseInt(localStorage.getItem('tetris+HighScore')) || 0;
      if (scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
    }
    function saveHighScore() {
      localStorage.setItem('tetris+HighScore', highScore);
      if (scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
    }

    function start() {
      rows = [];
      for (let i = 0; i < 20; i++) {
        let row = [];
        for (let x = 0; x < 10; x++) row.push(0);
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
    function moveRight() { if (!block) return; block[1] += 1; if (isColliding(block)) block[1] -= 1; }
    function moveLeft() { if (!block) return; block[1] -= 1; if (isColliding(block)) block[1] += 1; }

    function transpose(L) {
      let final = [];
      for (let i = 0; i < L[0].length; i++) final.push([]);
      for (let i = 0; i < L.length; i++) {
        for (let x = 0; x < L[i].length; x++) final[x].push(L[i][x]);
      }
      return final;
    }
    function reverse(L) { for (let i = 0; i < L.length; i++) L[i].reverse(); return L; }

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
        let newBlockIndex = Math.floor(Math.random() * 3);
        block = [all_blocks[newBlockIndex], 4, 0];

        if (isColliding(block)) {
          clearInterval(game);
          game = null;
          if (startBtn) startBtn.textContent = 'Start';
          if (score > highScore) {
            highScore = score;
            saveHighScore();
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
              let row = [];
              for (let x = 0; x < 10; x++) row.push(0);
              rows.unshift(row);
              score += 10;
              if (scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
              i--;
            }
          }
        }
      }

      // draw grid
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

      const size = box - 3;
      const offset = 1.5;

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

    // Keyboard binding when modal open
    function onKeyDown(e) {
      if (tetrisModal && tetrisModal.style.display !== 'flex' || !game) return;
      if (['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'].includes(e.key) || e.code === 'Space') {
        e.preventDefault();
      }
      if (e.key === 'ArrowLeft') moveLeft();
      if (e.key === 'ArrowRight') moveRight();
      if (e.code === 'Space') rotate();
      if (e.key === 'ArrowDown') fastFall = true;
    }
    function onKeyUp(e) { if (e.key === 'ArrowDown') fastFall = false; }

    return {
      init() {
        // Bind modal open/close
        if (runTetrisBtn) {
          runTetrisBtn.addEventListener('click', function (ev) {
            ev.preventDefault();
            if (tetrisModal) tetrisModal.style.display = 'flex';
            loadHighScore();
            if (startBtn) startBtn.textContent = 'Start';
          });
        }
        if (modalCloseBtn) modalCloseBtn.addEventListener('click', () => {
          if (tetrisModal) tetrisModal.style.display = 'none';
          if (game) { clearInterval(game); game = null; }
          // Clear canvas
          if (ctx && canvas) {
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          block = null;
        });
        if (tetrisModal) {
          tetrisModal.addEventListener('click', (e) => {
            if (e.target === tetrisModal) {
              if (tetrisModal) tetrisModal.style.display = 'none';
              if (game) { clearInterval(game); game = null; }
            }
          });
        }
        if (startBtn) startBtn.addEventListener('click', start);
        if (controlsBtn) controlsBtn.addEventListener('click', function() {
          console.log('Controls:\nRight Arrow: Right\nLeft Arrow: Left\nSpace Bar: Rotate\nDown Arrow: Speed Up Fall');
        });
        if (!document.__neonTetrisBound) {
          document.addEventListener('keydown', onKeyDown);
          document.addEventListener('keyup', onKeyUp);
          document.__neonTetrisBound = true;
        }
        loadHighScore();
      }
    };
  }

  let module = null;
  function initTetrisGame() {
    if (!module) module = createNeonTetris();
    if (module && module.init) module.init();
  }

  // Expose global name used elsewhere
  globalScope.initTetrisGame = initTetrisGame;
})();
