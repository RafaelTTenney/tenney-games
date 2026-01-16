import { getHighScore, submitHighScore } from './score-store.js';

(function () {
  // Simple preview Tetris (extracted from preview-games.js)
  const globalScope = typeof window !== 'undefined' ? window : globalThis;

  // Namespaced preview implementation
  const runSimpleTetrisBtn = document.getElementById('runSimpleTetrisBtn');
  const tetrisModal = document.getElementById('previewSimpleTetrisModal');
  const tetrisModalCloseBtn = document.getElementById('preview-modalCloseBtn');
  const tetrisCanvas = document.getElementById('preview-game');
  const tetrisCtx = tetrisCanvas ? tetrisCanvas.getContext('2d') : null;
  const tetrisScoreP = document.getElementById('preview-score');
  const tetrisStartBtn = document.getElementById('preview-startBtn');
  const tetrisControlsBtn = document.getElementById('preview-controlsBtn');

  const T_BOX = 24;
  const T_SPEED = 250; // gravity step in ms

  let t_fastFall = false;
  let t_score = 0;
  const GAME_ID = 'simple-tetris';
  let t_highScore = 0;
  let t_messageTimer = 0;

  let t_block;
  let t_rows;
  let t_tetrisLoopId = null;
  let t_lastTime = 0;
  let t_accumulator = 0;

  let t_offscreenCanvas = null;
  let t_offscreenCtx = null;

  // New: paused flag so controls are disabled while paused
  let t_isPaused = false;

  const T_PALETTE = { fill: '#00FFFF', stroke: '#33FFFF', shadow: '#00FFFF' };
  const T_PLAYFIELD_BG = '#23262b';

  const T_ALL_BLOCKS = {
    0: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    1: [[1, 1], [1, 1]],
    2: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    3: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    4: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    5: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    6: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
  };

  function t_renderScore() {
    if (tetrisScoreP) tetrisScoreP.textContent = 'Score: ' + t_score + ' | High Score: ' + t_highScore;
  }

  async function t_loadHighScore() {
    t_highScore = await getHighScore(GAME_ID);
    t_renderScore();
  }

  async function t_saveHighScore() {
    const saved = await submitHighScore(GAME_ID, t_highScore);
    if (typeof saved === 'number') t_highScore = saved;
    t_renderScore();
  }

  function t_initOffscreen() {
    if (!tetrisCanvas) return;
    t_offscreenCanvas = document.createElement('canvas');
    t_offscreenCanvas.width = tetrisCanvas.width;
    t_offscreenCanvas.height = tetrisCanvas.height;
    t_offscreenCtx = t_offscreenCanvas.getContext('2d');
    t_offscreenCtx.fillStyle = T_PLAYFIELD_BG;
    t_offscreenCtx.fillRect(0, 0, t_offscreenCanvas.width, t_offscreenCanvas.height);
    if (tetrisCtx) {
      tetrisCtx.fillStyle = T_PLAYFIELD_BG;
      tetrisCtx.fillRect(0, 0, tetrisCanvas.width, tetrisCanvas.height);
    }
  }

  // MODIFIED: Added isResume argument
  function t_start(isResume = false) {
    // Un-pause when starting/resuming
    t_isPaused = false;

    if (!isResume) {
      t_rows = [];
      for (let i = 0; i < 20; i++) {
        let row = [];
        for (let x = 0; x < 10; x++) row.push(0);
        t_rows.push(row);
      }
      t_score = 0;
      t_loadHighScore();
      t_messageTimer = 0;
      t_block = null;
    }
    
    t_accumulator = 0;
    t_lastTime = performance.now();
    if (!t_offscreenCanvas) t_initOffscreen();
    if (t_tetrisLoopId) cancelAnimationFrame(t_tetrisLoopId);
    t_tetrisLoopId = requestAnimationFrame(tetrisLoop);
    
    // Only set text to 'Restart' if it's a fresh start, not a resume from pause
    if (!isResume && tetrisStartBtn) tetrisStartBtn.textContent = 'Restart'; 
  }

  function t_rotate() {
    if (!t_block) return;
    t_block[0] = t_transpose(t_block[0]);
    t_block[0] = t_reverse(t_block[0]);
    if (t_isColliding(t_block)) {
      t_block[0] = t_reverse(t_block[0]);
      t_block[0] = t_transpose(t_block[0]);
    }
  }

  function t_moveRight() { if (!t_block) return; t_block[1] += 1; if (t_isColliding(t_block)) t_block[1] -= 1; }
  function t_moveLeft() { if (!t_block) return; t_block[1] -= 1; if (t_isColliding(t_block)) t_block[1] += 1; }

  function t_transpose(L) {
    let final = [];
    for (let i = 0; i < L[0].length; i++) final.push([]);
    for (let i = 0; i < L.length; i++) {
      for (let x = 0; x < L[i].length; x++) final[x].push(L[i][x]);
    }
    return final;
  }

  function t_reverse(L) {
    for (let i = 0; i < L.length; i++) L[i].reverse();
    return L;
  }

  function t_isColliding(B) {
    for (let y = 0; y < B[0].length; y++) {
      for (let x = 0; x < B[0][y].length; x++) {
        if (B[0][y][x] === 1) {
          if (
            (B[1] + x) < 0 ||
            (B[1] + x) >= 10 ||
            (B[2] + y) >= 20
          ) return true;
          if (t_rows[B[2] + y] && t_rows[B[2] + y][B[1] + x] === 1) return true;
        }
      }
    }
    return false;
  }

  function t_gravityStep() {
    if (!t_block) {
      let newBlockIndex = Math.floor(Math.random() * 7);
      t_block = [T_ALL_BLOCKS[newBlockIndex], 4, 0];
      if (t_isColliding(t_block)) {
        t_stopGame();
        if (t_score > t_highScore) {
          alert('Game Over! New high score: ' + t_score);
          t_highScore = t_score;
          t_saveHighScore();
        } else {
          alert('Game Over! Score: ' + t_score);
        }
        return;
      }
      return;
    }

    t_block[2] += 1;
    if (t_isColliding(t_block)) {
      t_block[2] -= 1;
      for (let y = 0; y < t_block[0].length; y++) {
        for (let x = 0; x < t_block[0][y].length; x++) {
          if (t_block[0][y][x] === 1) {
            if (t_rows[t_block[2] + y]) {
              t_rows[t_block[2] + y][t_block[1] + x] = 1;
            }
          }
        }
      }

      t_block = null;
      let linesCleared = 0;
      for (let i = 0; i < 20; i++) {
        if (t_rows[i] && !t_rows[i].some(b => b === 0)) {
          t_rows.splice(i, 1);
          let row = [];
          for (let x = 0; x < 10; x++) row.push(0);
          t_rows.unshift(row);
          linesCleared++;
          i--;
        }
      }

      if (linesCleared === 1) t_score += 10;
      else if (linesCleared === 2) t_score += 20;
      else if (linesCleared === 3) t_score += 30;
      else if (linesCleared === 4) { t_score += 50; t_messageTimer = 40; }

      if (linesCleared > 0) {
        t_renderScore();
      }
    }
  }

  function t_drawToOffscreen() {
    if (!t_offscreenCtx || !t_offscreenCanvas) return;

    t_offscreenCtx.save();
    t_offscreenCtx.shadowBlur = 0;
    t_offscreenCtx.fillStyle = T_PLAYFIELD_BG;
    t_offscreenCtx.fillRect(0, 0, t_offscreenCanvas.width, t_offscreenCanvas.height);
    t_offscreenCtx.restore();

    let RaB = t_rows.map(row => [...row]);
    if (t_block) {
      for (let y = 0; y < t_block[0].length; y++) {
        for (let x = 0; x < t_block[0][y].length; x++) {
          if (t_block[0][y][x] === 1) {
            if (RaB[t_block[2] + y]) {
              RaB[t_block[2] + y][t_block[1] + x] = 1;
            }
          }
        }
      }
    }

    t_offscreenCtx.save();
    t_offscreenCtx.fillStyle = T_PALETTE.fill;
    t_offscreenCtx.strokeStyle = T_PALETTE.stroke;
    t_offscreenCtx.lineWidth = 1;
    t_offscreenCtx.shadowColor = T_PALETTE.shadow;
    t_offscreenCtx.shadowBlur = 5;

    const t_size = T_BOX - 3;
    const t_offset = 1.5;

    for (let y = 0; y < RaB.length; y++) {
      for (let x = 0; x < RaB[y].length; x++) {
        if (RaB[y][x] === 1) {
          t_offscreenCtx.fillRect(x * T_BOX + t_offset, y * T_BOX + t_offset, t_size, t_size);
          t_offscreenCtx.strokeRect(x * T_BOX + t_offset, y * T_BOX + t_offset, t_size, t_size);
        }
      }
    }

    if (t_messageTimer > 0) {
      t_offscreenCtx.fillStyle = 'yellow';
      t_offscreenCtx.font = 'bold 48px Arial';
      t_offscreenCtx.textAlign = 'center';
      t_offscreenCtx.shadowColor = 'black';
      t_offscreenCtx.shadowBlur = 5;
      t_offscreenCtx.fillText('TETRIS!', t_offscreenCanvas.width / 2, t_offscreenCanvas.height / 2);
      t_messageTimer--;
    }
    t_offscreenCtx.restore();

    if (tetrisCtx && t_offscreenCanvas) {
      tetrisCtx.drawImage(t_offscreenCanvas, 0, 0);
    }
  }

  function tetrisLoop(ts) {
    if (!tetrisCtx || !t_offscreenCtx) {
      t_tetrisLoopId = null;
      return;
    }
    t_tetrisLoopId = requestAnimationFrame(tetrisLoop);

    let now = ts || performance.now();
    let delta = now - t_lastTime;
    t_lastTime = now;
    t_accumulator += delta;

    const gravityInterval = t_fastFall ? Math.min(90, T_SPEED / 2) : T_SPEED;

    while (t_accumulator >= gravityInterval) {
      t_accumulator -= gravityInterval;
      t_gravityStep();
    }

    t_drawToOffscreen();
  }

  // MODIFIED: Added isPause argument
  function t_stopGame(isPause = false) {
    if (t_tetrisLoopId) {
      cancelAnimationFrame(t_tetrisLoopId);
      t_tetrisLoopId = null;
    }

    // Track paused state so input handlers can ignore inputs while paused
    t_isPaused = !!isPause;

    // Only set t_block to null on permanent game-over stop, not on pause
    // if (!isPause) t_block = null; 
    
    if (tetrisCtx) {
      tetrisCtx.fillStyle = T_PLAYFIELD_BG;
      tetrisCtx.fillRect(0, 0, tetrisCanvas.width, tetrisCanvas.height);
    }
    // Only change Start button text if it's not a temporary pause
    if (tetrisStartBtn && !isPause) tetrisStartBtn.textContent = 'Start';
  }

  // Keyboard handlers for the preview Tetris modal
  function onKeyDown(e) {
    if (!tetrisModal || tetrisModal.style.display !== 'flex') return;
    // Prevent scrolling/default actions when game is active or paused
    if (['ArrowRight','ArrowLeft','ArrowUp','ArrowDown',' '].includes(e.key) || e.code === 'Space') {
      e.preventDefault();
    }
    // If paused, do not accept inputs
    if (t_isPaused) return;

    // Only allow controls if game loop is active (i.e., not fully stopped) or there's an active block
    if (!t_block && !t_tetrisLoopId) return;
    
    if (e.key === 'ArrowLeft') t_moveLeft();
    if (e.key === 'ArrowRight') t_moveRight();
    if (e.code === 'Space' || e.key === ' ') t_rotate();
    if (e.key === 'ArrowDown') t_fastFall = true;
  }
  function onKeyUp(e) { if (e.key === 'ArrowDown') t_fastFall = false; }

  // Public init for preview UI loader to call
  function initPreviewSimpleTetris() {
    // Bind modal/run controls if not already done
    if (runSimpleTetrisBtn) {
      runSimpleTetrisBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (tetrisModal) tetrisModal.style.display = 'flex';
        t_loadHighScore();
        if (tetrisStartBtn) tetrisStartBtn.textContent = 'Start';
      });
    }
    if (tetrisModalCloseBtn) tetrisModalCloseBtn.addEventListener('click', t_closeModal);

    // Wrap the start call so the event object isn't treated as isResume
    if (tetrisStartBtn) tetrisStartBtn.addEventListener('click', function (e) {
      e.preventDefault();
      t_start(false);
    });
    
    // MODIFIED LOGIC: Pause game, show alert, and resume game
    if (tetrisControlsBtn) tetrisControlsBtn.addEventListener('click', function () {
      const wasRunning = t_tetrisLoopId !== null;
          
      // 1. Pause the game, but keep the block and state
      if (wasRunning) {
        t_stopGame(true); // true means it's a pause, don't reset button text and set paused flag
      }
      
      // 2. Show the controls alert (this blocks execution)
      alert('Controls:\nRight Arrow: Move Right\nLeft Arrow: Move Left\nSpace Bar: Rotate\nDown Arrow: Speed Up Fall');
          
      // 3. Resume the game if it was running
      if (wasRunning) {
        t_start(true); // true means it's a resume, don't re-init/reset score/board
      }
    });
    
    if (tetrisModal) {
      tetrisModal.addEventListener('click', function (e) {
        if (e.target === tetrisModal) t_closeModal();
      });
    }
    if (!document.__previewTetrisKeyBound) {
      document.addEventListener('keydown', onKeyDown);
      document.addEventListener('keyup', onKeyUp);
      document.__previewTetrisKeyBound = true;
    }
    t_loadHighScore();
  }

  function t_openModal() {
    if (tetrisModal) tetrisModal.style.display = 'flex';
    t_loadHighScore();
    if (!t_offscreenCanvas) t_initOffscreen();
  }

  function t_closeModal() {
    if (tetrisModal) tetrisModal.style.display = 'none';
    t_stopGame();
  }

  // Expose preview init for loader
  globalScope.initPreviewSimpleTetris = initPreviewSimpleTetris;
  // Keep older names if referred to elsewhere in repo
  globalScope.startPreviewTetris = t_start;
  globalScope.stopPreviewTetris = t_stopGame;
})();
