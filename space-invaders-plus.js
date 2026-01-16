import { getHighScore, submitHighScore } from './score-store.js';

(function () {
  // Space Invaders++ (experimental) - completed module extracted from experimental.js
  const globalScope = typeof window !== 'undefined' ? window : globalThis;

  function createInvadersModule() {
    const invadersModal = document.getElementById('invadersModal');
    const runInvadersBtn = document.getElementById('runInvadersBtn');
    const invadersModalCloseBtn = document.getElementById('invadersModalCloseBtn');
    const invadersCanvas = document.getElementById('invaders-canvas');
    const invadersCtx = invadersCanvas ? invadersCanvas.getContext('2d') : null;
    const invadersMessageEl = document.getElementById('invaders-message');
    const startInvadersBtn = document.getElementById('startInvadersBtn');
    const invadersScoreEl = document.getElementById('invaders-score');

    if (!invadersCanvas) {
      // If the canvas isn't present, return a minimal stub so callers don't break.
      return {
        init() { /* no-op */ },
        startInvaders() { console.warn('Invaders canvas not found'); },
        stopInvaders() { /* no-op */ }
      };
    }

    const GAME_ID = 'space-invaders-plus';
    let invaderState = {
      player: { x: 140, y: 350, width: 20, height: 16, lives: 3, alive: true },
      bullet: { x: 0, y: 0, width: 4, height: 14, active: false, alive: false, speed: 24 },
      enemies: [],
      enemyBullets: [],
      bunkers: [],
      mysteryShip: { x: 0, y: 20, width: 30, height: 14, active: false, direction: 1, alive: false },
      enemyDirection: 1,
      score: 0,
      highScore: 0,
      level: 1,
      gameOver: false,
      gameLoopId: null,
      dropSpeed: 6, // reduced default drop speed
      initialEnemies: 0,
      enemyMoveTimer: 0,
      enemyMoveInterval: 40 // slower base interval to reduce early-level speed
    };

    const invaderPalettes = ['#FF00FF','#FFA500','#FFFF00','#00FF00','#00FFFF','#9D00FF','#FD1C03','#FF69B4'];

    /* ============================
       BUNKERS: Connected defense matrices
       ============================ */
    const bunkerPatternConnected = [
      [0,1,1,1,1,1,1,1,1,1,1,0],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,1,1,1,1,1,1,1,1],
      [1,1,1,1,0,0,0,0,1,1,1,1],
      [1,1,1,0,0,0,0,0,0,1,1,1],
      [1,1,1,0,0,0,0,0,0,1,1,1]
    ];

    function createBunkers() {
      invaderState.bunkers = [];
      const blockSize = 6; // pixel size for each pattern cell
      const bunkerCount = 4;
      const usableWidth = invadersCanvas.width - 60;
      const bunkerTotalWidth = bunkerPatternConnected[0].length * blockSize;
      const spacing = usableWidth / bunkerCount;
      const baseX = 30; // left margin

      const bunkerY = Math.max( invadersCanvas.height - 140, 260 ); // place above player area

      for (let b = 0; b < bunkerCount; b++) {
        const center = baseX + spacing * b + spacing / 2;
        const left = Math.round(center - bunkerTotalWidth / 2);
        for (let r = 0; r < bunkerPatternConnected.length; r++) {
          for (let c = 0; c < bunkerPatternConnected[0].length; c++) {
            if (bunkerPatternConnected[r][c]) {
              const px = left + c * blockSize;
              const py = bunkerY + r * blockSize;
              invaderState.bunkers.push({
                x: px,
                y: py,
                width: blockSize,
                height: blockSize,
                alive: true
              });
            }
          }
        }
      }
    }

    /* ============================
       ENEMIES
       ============================ */
    function createEnemies() {
      const state = invaderState;
      state.enemies = [];

      const rows = 4; // reduced rows to keep preview/playable
      const approxEnemyWidth = 20;
      const padding = 12;
      const minCols = 8;
      const maxCols = 12;
      const availableWidth = Math.max(300, invadersCanvas.width - 60);
      const colsEstimate = Math.floor(availableWidth / (approxEnemyWidth + padding));
      const cols = Math.min(Math.max(minCols, colsEstimate), maxCols);

      const enemyWidth = approxEnemyWidth;
      const enemyHeight = 14;

      const totalWidth = cols * enemyWidth + (cols - 1) * padding;
      const startX = Math.max(12, Math.round((invadersCanvas.width - totalWidth) / 2));
      let startY = 28 + (state.level - 1) * 6;
      startY = Math.min(startY, 120);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          state.enemies.push({
            x: startX + c * (enemyWidth + padding),
            y: startY + r * (enemyHeight + 10),
            width: enemyWidth,
            height: enemyHeight,
            alive: true
          });
        }
      }

      state.initialEnemies = state.enemies.length;
    }

    /* ============================
       Collision helper
       ============================ */
    function checkCollision(objA, objB) {
      if (('alive' in objA && !objA.alive) || ('alive' in objB && !objB.alive)) return false;
      return objA.x < objB.x + objB.width &&
             objA.x + objA.width > objB.x &&
             objA.y < objB.y + objB.height &&
             objA.y + objA.height > objB.y;
    }

    /* ============================
       Update logic
       ============================ */
    function updateInvaders() {
      if (invaderState.gameOver || !invadersCanvas) return;
      const state = invaderState;

      // Player bullet movement (laser)
      if (state.bullet.active) {
        state.bullet.y -= state.bullet.speed;
        if (state.bullet.y + state.bullet.height < 0) {
          state.bullet.active = false;
          state.bullet.alive = false;
        }

        // Collide with bunkers
        for (let b = state.bunkers.length - 1; b >= 0; b--) {
          const block = state.bunkers[b];
          if (block.alive && checkCollision(state.bullet, block)) {
            block.alive = false;
            state.bullet.active = false;
            state.bullet.alive = false;
            break;
          }
        }

        // Collide with enemies
        if (state.bullet.active) {
          for (let i = state.enemies.length - 1; i >= 0; i--) {
            const enemy = state.enemies[i];
            if (enemy.alive && checkCollision(state.bullet, enemy)) {
              enemy.alive = false;
              state.bullet.active = false;
              state.bullet.alive = false;
              state.score += 10;
              if (invadersScoreEl) invadersScoreEl.textContent = `Score: ${state.score} | High: ${state.highScore}`;
              break;
            }
          }
        }

        // Mystery ship
        if (state.bullet.active && state.mysteryShip.active) {
          if (checkCollision(state.bullet, state.mysteryShip)) {
            state.mysteryShip.active = false;
            state.mysteryShip.alive = false;
            state.bullet.active = false;
            state.bullet.alive = false;
            let bonus = (Math.floor(Math.random() * 3) + 1) * 50;
            state.score += bonus;
            if (invadersMessageEl) invadersMessageEl.textContent = `+${bonus} POINTS!`;
          }
        }
      }

      // Enemy movement (timer-based)
      state.enemyMoveTimer--;
      if (state.enemyMoveTimer <= 0) {
        let moveDown = false;
        let moveStep = 4; // smaller horizontal step to slow lateral movement

        let aliveEnemies = state.enemies.filter(e => e.alive);

        // Check edges
        for (const enemy of aliveEnemies) {
          if ((state.enemyDirection > 0 && enemy.x + enemy.width >= invadersCanvas.width - 6) ||
              (state.enemyDirection < 0 && enemy.x <= 6)) {
            moveDown = true;
            state.enemyDirection *= -1;
            moveStep = 0;
            break;
          }
        }

        // Update positions
        aliveEnemies.forEach(enemy => {
          if (moveDown) enemy.y += state.dropSpeed;
          else enemy.x += state.enemyDirection * moveStep;

          if (enemy.y + enemy.height > state.player.y) {
            stopInvaders("GAME OVER: They reached you!");
          }
        });

        let progress = (state.initialEnemies - aliveEnemies.length) / state.initialEnemies;
        // gentler acceleration
        state.enemyMoveInterval = Math.max(6, (36 - (state.level - 1) * 1.2) * (1 - progress * 0.7));
        state.enemyMoveTimer = state.enemyMoveInterval;
      }

      // Mystery ship spawn (rarer)
      if (!state.mysteryShip.active && Math.random() > 0.995 - (state.level * 0.0003)) {
        state.mysteryShip.active = true;
        state.mysteryShip.alive = true;
        if (Math.random() > 0.5) {
          state.mysteryShip.x = -state.mysteryShip.width;
          state.mysteryShip.direction = 1;
        } else {
          state.mysteryShip.x = invadersCanvas.width;
          state.mysteryShip.direction = -1;
        }
      }
      if (state.mysteryShip.active) {
        state.mysteryShip.x += state.mysteryShip.direction * (1.5 + state.level * 0.2);
        if (state.mysteryShip.x > invadersCanvas.width || state.mysteryShip.x < -state.mysteryShip.width) {
          state.mysteryShip.active = false;
          state.mysteryShip.alive = false;
        }
      }

      // Enemy shooting
      let aliveEnemies = state.enemies.filter(e => e.alive);
      let shootThreshold = Math.max(0.75, 0.98 - (state.level * 0.015));
      if (Math.random() > shootThreshold && aliveEnemies.length > 0) {
        let shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
        state.enemyBullets.push({
          x: shooter.x + Math.floor(shooter.width / 2) - 1,
          y: shooter.y + shooter.height,
          width: 2,
          height: 14,
          alive: true,
          speed: 3 + state.level * 0.15 // slightly slower bullets
        });
      }

      // Move enemy bullets, collide with bunkers/player
      state.enemyBullets = state.enemyBullets.filter(bullet => {
        bullet.y += bullet.speed;

        for (let b = state.bunkers.length - 1; b >= 0; b--) {
          const bunkerBlock = state.bunkers[b];
          if (bunkerBlock.alive && checkCollision(bullet, bunkerBlock)) {
            bunkerBlock.alive = false;
            return false;
          }
        }

        if (checkCollision(bullet, state.player)) {
          state.player.lives--;
          if (invadersScoreEl) invadersScoreEl.textContent = `Score: ${state.score} | High: ${state.highScore}`;
          if (state.player.lives <= 0) {
            state.player.alive = false;
            stopInvaders("GAME OVER: You were hit!");
          } else {
            if (invadersMessageEl) invadersMessageEl.textContent = `HIT! ${state.player.lives} ships remain.`;
          }
          return false;
        }

        return bullet.y < invadersCanvas.height;
      });

      // Lose if all bunkers destroyed
      if (state.bunkers.length > 0 && state.bunkers.filter(b => b.alive).length === 0) {
        stopInvaders("GAME OVER: Bases destroyed!");
      }

      // Level cleared
      if (aliveEnemies.length === 0 && !state.gameOver) {
        startNextLevel();
      }
    }

    /* ============================
       Drawing
       ============================ */
    function drawInvaders() {
      if (!invadersCtx) return;
      const state = invaderState;

      // clear frame
      invadersCtx.fillStyle = '#000';
      invadersCtx.fillRect(0, 0, invadersCanvas.width, invadersCanvas.height);

      // Draw bunkers
      invaderState.bunkers.forEach(block => {
        if (block.alive) {
          invadersCtx.fillStyle = '#00FF00';
          invadersCtx.fillRect(block.x, block.y, block.width, block.height);
        }
      });

      // Draw player
      if (state.player.alive) {
        invadersCtx.fillStyle = '#00FFFF';
        invadersCtx.fillRect(state.player.x, state.player.y, state.player.width, state.player.height);
      }

      // Player bullet: draw neon laser line
      if (state.bullet.active) {
        invadersCtx.save();
        invadersCtx.strokeStyle = '#88FFFF';
        invadersCtx.lineWidth = 3;
        invadersCtx.shadowColor = '#88FFFF';
        invadersCtx.shadowBlur = 12;
        const bx = Math.round(state.bullet.x + state.bullet.width / 2);
        invadersCtx.beginPath();
        invadersCtx.moveTo(bx, Math.round(state.bullet.y + state.bullet.height));
        invadersCtx.lineTo(bx, Math.round(state.bullet.y));
        invadersCtx.stroke();
        invadersCtx.restore();
      }

      // Draw enemies
      const enemyColor = invaderPalettes[(state.level - 1) % invaderPalettes.length];
      invadersCtx.fillStyle = enemyColor;
      state.enemies.forEach(enemy => {
        if (enemy.alive) {
          invadersCtx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
        }
      });

      // Mystery ship
      if (state.mysteryShip.active) {
        const ms = state.mysteryShip;
        invadersCtx.save();
        invadersCtx.shadowColor = '#FFD700';
        invadersCtx.shadowBlur = 12;
        invadersCtx.fillStyle = '#FFD700';
        invadersCtx.fillRect(ms.x, ms.y, ms.width, ms.height);
        const lights = ['#FD1C03', '#00FF00', '#00FFFF', '#FF00FF', '#FFD700'];
        for (let i = 0; i < 5; i++) {
          invadersCtx.fillStyle = lights[i % lights.length];
          invadersCtx.fillRect(ms.x + 3 + i * 5, ms.y + ms.height - 4, 3, 3);
        }
        invadersCtx.restore();
      }

      // Enemy bullets: draw as thin red lasers
      state.enemyBullets.forEach(bullet => {
        invadersCtx.save();
        invadersCtx.strokeStyle = '#FF5555';
        invadersCtx.lineWidth = 2;
        invadersCtx.shadowColor = '#FF5555';
        invadersCtx.shadowBlur = 8;
        const ex = Math.round(bullet.x + bullet.width / 2);
        invadersCtx.beginPath();
        invadersCtx.moveTo(ex, Math.round(bullet.y));
        invadersCtx.lineTo(ex, Math.round(bullet.y + bullet.height));
        invadersCtx.stroke();
        invadersCtx.restore();
      });

      // Lives UI (reserve boxes)
      const lifeBoxW = 14;
      const lifeBoxH = 10;
      const lifeLeftX = 10;
      const lifeY = invadersCanvas.height - 28;

      invadersCtx.fillStyle = '#00FFFF';
      if (state.player.lives >= 3) {
        invadersCtx.fillRect(lifeLeftX, lifeY, lifeBoxW, lifeBoxH);
        invadersCtx.fillRect(lifeLeftX + lifeBoxW + 8, lifeY, lifeBoxW, lifeBoxH);
      } else if (state.player.lives === 2) {
        invadersCtx.fillRect(lifeLeftX, lifeY, lifeBoxW, lifeBoxH);
        const sideX = Math.min(invadersCanvas.width - lifeBoxW - 8, lifeLeftX + 60);
        invadersCtx.fillRect(sideX, lifeY, lifeBoxW, lifeBoxH);
      } else if (state.player.lives === 1) {
        const sideX = Math.min(invadersCanvas.width - lifeBoxW - 8, lifeLeftX + 60);
        invadersCtx.fillRect(sideX, lifeY, lifeBoxW, lifeBoxH);
      }

      // HUD
      invadersCtx.font = '15px "Courier New", monospace';
      invadersCtx.fillStyle = '#fff';
      invadersCtx.fillText(`Score: ${state.score}`, 12, 18);
      invadersCtx.fillText(`High: ${state.highScore}`, 12, 36);
      invadersCtx.fillStyle = '#88FFFF';
      invadersCtx.fillText(`Level: ${state.level}`, invadersCanvas.width - 90, 18);
    }

    /* ============================
       Game loop / control functions
       ============================ */
    function invadersGameLoop() {
      if (invaderState.gameOver) return;
      updateInvaders();
      drawInvaders();
      invaderState.gameLoopId = requestAnimationFrame(invadersGameLoop);
    }

    function startNextLevel() {
      const state = invaderState;
      state.level++;
      if (invadersMessageEl) invadersMessageEl.textContent = `Space Invaders++ — Level ${state.level}`;

      state.enemyBullets = [];
      state.bullet.active = false;
      state.bullet.alive = false;

      state.enemyMoveInterval = Math.max(8, 36 - (state.level - 1) * 1.2);
      state.enemyMoveTimer = state.enemyMoveInterval;
      state.dropSpeed = 6 + (state.level - 1) * 1.2;

      createEnemies();
      createBunkers();

      if (invadersMessageEl) {
        const palette = invaderPalettes[(state.level - 1) % invaderPalettes.length];
        invadersMessageEl.style.color = palette;
        setTimeout(() => { if (invadersMessageEl) invadersMessageEl.style.color = '#eee'; }, 1200);
      }
    }

    async function loadHighScore() {
      invaderState.highScore = await getHighScore(GAME_ID);
      if (invadersScoreEl) invadersScoreEl.textContent = `Score: ${invaderState.score} | High: ${invaderState.highScore}`;
    }

    async function submitHighScoreIfNeeded() {
      if (invaderState.score <= invaderState.highScore) return;
      const saved = await submitHighScore(GAME_ID, invaderState.score);
      if (typeof saved === 'number') invaderState.highScore = saved;
      if (invadersScoreEl) invadersScoreEl.textContent = `Score: ${invaderState.score} | High: ${invaderState.highScore}`;
    }

    function startInvaders() {
      if (invaderState.gameLoopId) {
        cancelAnimationFrame(invaderState.gameLoopId);
        invaderState.gameLoopId = null;
      }

      // Reset game state
      invaderState.gameOver = false;
      invaderState.score = 0;
      invaderState.level = 1;
      invaderState.enemyBullets = [];
      invaderState.bullet.active = false;
      invaderState.bullet.alive = false;
      invaderState.player.x = Math.max(10, (invadersCanvas ? invadersCanvas.width : 300) / 2 - invaderState.player.width / 2);
      invaderState.player.lives = 3;
      invaderState.player.alive = true;
      invaderState.enemyDirection = 1;
      invaderState.enemyMoveTimer = 0;
      invaderState.enemyMoveInterval = 36; // slower starting interval
      invaderState.mysteryShip.active = false;
      invaderState.mysteryShip.alive = false;
      invaderState.dropSpeed = 6; // reduced base drop speed

      if (invadersScoreEl) invadersScoreEl.textContent = `Score: 0 | High: ${invaderState.highScore}`;
      if (invadersMessageEl) invadersMessageEl.textContent = "Good luck!";
      if (startInvadersBtn) startInvadersBtn.textContent = 'Restart';

      createEnemies();
      createBunkers();
      invaderState.gameLoopId = requestAnimationFrame(invadersGameLoop);
    }

    function stopInvaders(message = "GAME OVER") {
      invaderState.gameOver = true;
      if (invaderState.gameLoopId) {
        cancelAnimationFrame(invaderState.gameLoopId);
        invaderState.gameLoopId = null;
      }
      if (invadersMessageEl) invadersMessageEl.textContent = message;
      if (startInvadersBtn) startInvadersBtn.textContent = 'Start';
      submitHighScoreIfNeeded();
    }

    /* ============================
       Input handling for invaders
       ============================ */
    function handleInvadersKey(event) {
      // Only run if the invaders modal is open
      if (!invadersModal || invadersModal.style.display !== 'flex') return;

      const state = invaderState;

      // Shooting (Space)
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        if (state.gameOver) {
          startInvaders(); // Restart game on spacebar if game is over
          return;
        }

        if (!state.bullet.active && state.player.alive) {
          // create bullet rectangle for collisions
          state.bullet.x = state.player.x + (state.player.width / 2) - (state.bullet.width / 2);
          state.bullet.y = state.player.y - state.bullet.height;
          state.bullet.active = true;
          state.bullet.alive = true; // for collision check
        }
      }

      if (state.gameOver || !state.player.alive) return; // Don't move if game is over or player is dead

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        state.player.x = Math.max(0, state.player.x - 12);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        state.player.x = Math.min(invadersCanvas.width - state.player.width, state.player.x + 12);
      }
    }

    /* ============================
       Wiring UI / modal
       ============================ */
    function init() {
      if (startInvadersBtn) startInvadersBtn.addEventListener('click', startInvaders);

      if (runInvadersBtn) {
        runInvadersBtn.addEventListener('click', function(e) {
          e.preventDefault();
          if (invadersModal) invadersModal.style.display = 'flex';
          if (invadersMessageEl) invadersMessageEl.textContent = "Press Start!";
        });
      }

      if (invadersModalCloseBtn) invadersModalCloseBtn.addEventListener('click', function() {
        if (invadersModal) invadersModal.style.display = 'none';
        stopInvaders();
      });

      if (invadersModal) {
        invadersModal.addEventListener('click', function(e) {
          if (e.target === invadersModal) {
            if (invadersModal) invadersModal.style.display = 'none';
            stopInvaders();
          }
        });
      }

      // Keyboard listener for gameplay
      if (!document.__invadersBound) {
        document.addEventListener('keydown', handleInvadersKey);
        document.__invadersBound = true;
      }

      // Initial clear
      if (invadersCtx) {
        invadersCtx.fillStyle = '#000';
        invadersCtx.fillRect(0, 0, invadersCanvas.width, invadersCanvas.height);
      }
      loadHighScore();
    }

    return {
      init,
      startInvaders,
      stopInvaders
    };
  }

  let module = null;
  function initInvadersGame() {
    if (!module) module = createInvadersModule();
    if (module && typeof module.init === 'function') module.init();
  }

  // Preserve global names used elsewhere
  globalScope.initInvadersGame = initInvadersGame;
  globalScope.startInvaders = function () {
    if (!module) initInvadersGame();
    if (module && typeof module.startInvaders === 'function') module.startInvaders();
  };
  globalScope.stopInvaders = function (msg) {
    if (!module) initInvadersGame();
    if (module && typeof module.stopInvaders === 'function') module.stopInvaders(msg);
  };
})();
