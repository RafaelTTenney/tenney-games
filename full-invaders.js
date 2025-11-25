(function () {
  // Preview: Full Invaders (extracted from preview-games.js)
  const globalScope = typeof window !== 'undefined' ? window : globalThis;

  // DOM elements (preview invaders) - namespaced with "preview-"
  const runPreviewInvadersBtn = document.getElementById('runPreviewInvadersBtn');
  const previewInvadersModal = document.getElementById('preview-invadersModal');
  const previewInvadersModalCloseBtn = document.getElementById('preview-invadersModalCloseBtn');
  const previewInvadersCanvas = document.getElementById('preview-invaders-canvas');
  const previewInvadersCtx = previewInvadersCanvas ? previewInvadersCanvas.getContext('2d') : null;
  const previewInvadersMessageEl = document.getElementById('preview-invaders-message');
  const previewStartInvadersBtn = document.getElementById('preview-startInvadersBtn');
  const previewInvadersScoreEl = document.getElementById('preview-invaders-score');

  let previewInvaderState = {
    player: { x: 140, y: 350, width: 20, height: 15, lives: 3, alive: true },
    bullet: { x: 0, y: 0, width: 4, height: 10, active: false, alive: false },
    enemies: [],
    enemyBullets: [],
    bunkers: [],
    mysteryShip: { x: 0, y: 20, width: 25, height: 12, active: false, direction: 1, alive: false },
    enemyDirection: 1,
    score: 0,
    level: 1,
    gameOver: false,
    gameLoopId: null,
    dropSpeed: 10,
    initialEnemies: 0,
    enemyMoveTimer: 0,
    enemyMoveInterval: 30
  };
  const previewInvaderPalettes = ['#FF00FF','#FFA500','#FFFF00','#00FF00','#00FFFF','#9D00FF','#FD1C03','#FF69B4'];

  function previewCreateEnemies() {
    const state = previewInvaderState;
    state.enemies = [];
    const enemyWidth = 20;
    const enemyHeight = 15;
    let startY = 30 + (state.level - 1) * 10;
    startY = Math.min(startY, 150);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        state.enemies.push({
          x: 30 + c * (enemyWidth + 10),
          y: startY + r * (enemyHeight + 10),
          width: enemyWidth,
          height: enemyHeight,
          alive: true
        });
      }
    }
    state.initialEnemies = state.enemies.length;
  }

  function previewCreateBunkers() {
    previewInvaderState.bunkers = [];
    const bunkerWidth = 4;
    const bunkerHeight = 3;
    const blockSize = 8;
    const startX = 30;
    const bunkerSpacing = (previewInvadersCanvas.width - 60) / 4;
    for (let b = 0; b < 4; b++) {
      let bunkerX = startX + (b * bunkerSpacing) + (bunkerSpacing / 2) - ((bunkerWidth * blockSize) / 2);
      for (let r = 0; r < bunkerHeight; r++) {
        for (let c = 0; c < bunkerWidth; c++) {
          if (r === bunkerHeight - 1 && (c === 1 || c === 2)) continue;
          previewInvaderState.bunkers.push({
            x: bunkerX + c * blockSize,
            y: 300 + r * blockSize,
            width: blockSize,
            height: blockSize,
            alive: true
          });
        }
      }
    }
  }

  function previewCheckCollision(objA, objB) {
    if (('alive' in objA && !objA.alive) || ('alive' in objB && !objB.alive)) return false;
    return objA.x < objB.x + objB.width &&
           objA.x + objA.width > objB.x &&
           objA.y < objB.y + objB.height &&
           objA.y + objA.height > objB.y;
  }

  function previewUpdateInvaders() {
    if (previewInvaderState.gameOver || !previewInvadersCanvas) return;
    const state = previewInvaderState;

    if (state.bullet.active) {
      state.bullet.y -= 15;
      if (state.bullet.y < 0) {
        state.bullet.active = false;
        state.bullet.alive = false;
      }
      for (let b = state.bunkers.length - 1; b >= 0; b--) {
        let bunkerBlock = state.bunkers[b];
        if (bunkerBlock.alive && previewCheckCollision(state.bullet, bunkerBlock)) {
          bunkerBlock.alive = false;
          state.bullet.active = false;
          state.bullet.alive = false;
          break;
        }
      }
      if (state.bullet.active) {
        for (let i = state.enemies.length - 1; i >= 0; i--) {
          let enemy = state.enemies[i];
          if (enemy.alive && previewCheckCollision(state.bullet, enemy)) {
            enemy.alive = false;
            state.bullet.active = false;
            state.bullet.alive = false;
            state.score += 10;
            if (previewInvadersScoreEl) previewInvadersScoreEl.textContent = `Score: ${state.score}`;
            break;
          }
        }
      }
      if (state.bullet.active && state.mysteryShip.active) {
        if (previewCheckCollision(state.bullet, state.mysteryShip)) {
          state.mysteryShip.active = false;
          state.mysteryShip.alive = false;
          state.bullet.active = false;
          state.bullet.alive = false;
          let bonus = (Math.floor(Math.random() * 3) + 1) * 50;
          state.score += bonus;
          if (previewInvadersMessageEl) previewInvadersMessageEl.textContent = `+${bonus} POINTS!`;
          if (previewInvadersScoreEl) previewInvadersScoreEl.textContent = `Score: ${state.score}`;
        }
      }
    }

    state.enemyMoveTimer--;
    if (state.enemyMoveTimer <= 0) {
      let moveDown = false;
      let moveStep = 5;
      let aliveEnemies = state.enemies.filter(e => e.alive);
      for (const enemy of aliveEnemies) {
        if ((state.enemyDirection > 0 && enemy.x + enemy.width >= previewInvadersCanvas.width - 5) ||
            (state.enemyDirection < 0 && enemy.x <= 5)) {
          moveDown = true;
          state.enemyDirection *= -1;
          moveStep = 0;
          break;
        }
      }
      aliveEnemies.forEach(enemy => {
        if (moveDown) enemy.y += state.dropSpeed;
        else enemy.x += state.enemyDirection * moveStep;
        if (enemy.y + enemy.height > state.player.y) {
          previewStopInvaders("GAME OVER: They reached you!");
        }
      });
      let progress = (state.initialEnemies - aliveEnemies.length) / state.initialEnemies;
      state.enemyMoveInterval = Math.max(3, (30 - (state.level - 1) * 2) * (1 - progress * 0.9));
      state.enemyMoveTimer = state.enemyMoveInterval;
    }

    if (!state.mysteryShip.active && Math.random() > 0.998 - (state.level * 0.0005)) {
      state.mysteryShip.active = true;
      state.mysteryShip.alive = true;
      if (Math.random() > 0.5) {
        state.mysteryShip.x = -state.mysteryShip.width;
        state.mysteryShip.direction = 1;
      } else {
        state.mysteryShip.x = previewInvadersCanvas.width;
        state.mysteryShip.direction = -1;
      }
    }
    if (state.mysteryShip.active) {
      state.mysteryShip.x += state.mysteryShip.direction * (1.5 + state.level * 0.2);
      if (state.mysteryShip.x > previewInvadersCanvas.width || state.mysteryShip.x < -state.mysteryShip.width) {
        state.mysteryShip.active = false;
        state.mysteryShip.alive = false;
      }
    }

    let aliveEnemies = state.enemies.filter(e => e.alive);
    let shootThreshold = Math.max(0.6, 0.98 - (state.level * 0.02));
    if (Math.random() > shootThreshold && aliveEnemies.length > 0) {
      let shooter = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
      state.enemyBullets.push({
        x: shooter.x + shooter.width / 2 - 2,
        y: shooter.y + shooter.height,
        width: 4,
        height: 10,
        alive: true
      });
    }

    state.enemyBullets = state.enemyBullets.filter(bullet => {
      bullet.y += 3 + state.level * 0.25;
      for (let b = state.bunkers.length - 1; b >= 0; b--) {
        let bunkerBlock = state.bunkers[b];
        if (bunkerBlock.alive && previewCheckCollision(bullet, bunkerBlock)) {
          bunkerBlock.alive = false;
          return false;
        }
      }
      if (previewCheckCollision(bullet, state.player)) {
        state.player.lives--;
        if (previewInvadersScoreEl) previewInvadersScoreEl.textContent = `Score: ${state.score}`;
        if (state.player.lives <= 0) {
          state.player.alive = false;
          previewStopInvaders("GAME OVER: You were hit!");
        } else {
          if (previewInvadersMessageEl) previewInvadersMessageEl.textContent = `HIT! ${state.player.lives} ships remain.`;
        }
        return false;
      }
      return bullet.y < previewInvadersCanvas.height;
    });

    if (state.bunkers.length > 0 && state.bunkers.filter(b => b.alive).length === 0) {
      previewStopInvaders("GAME OVER: Bases destroyed!");
    }

    if (aliveEnemies.length === 0 && !state.gameOver) {
      previewStartNextLevel();
    }
  }

  function previewDrawInvaders() {
    if (!previewInvadersCtx) return;
    const state = previewInvaderState;
    previewInvadersCtx.fillStyle = '#000';
    previewInvadersCtx.fillRect(0, 0, previewInvadersCanvas.width, previewInvadersCanvas.height);

    if (state.player.alive) {
      previewInvadersCtx.fillStyle = '#00FFFF';
      previewInvadersCtx.fillRect(state.player.x, state.player.y, state.player.width, state.player.height);
    }
    if (state.bullet.active) {
      previewInvadersCtx.fillStyle = '#00FFFF';
      previewInvadersCtx.fillRect(state.bullet.x, state.bullet.y, state.bullet.width, state.bullet.height);
    }
    previewInvadersCtx.fillStyle = '#00FF00';
    state.bunkers.forEach(block => {
      if (block.alive) previewInvadersCtx.fillRect(block.x, block.y, block.width, block.height);
    });
    const enemyColor = previewInvaderPalettes[(state.level - 1) % previewInvaderPalettes.length];
    previewInvadersCtx.fillStyle = enemyColor;
    state.enemies.forEach(enemy => {
      if (enemy.alive) previewInvadersCtx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    });
    if (state.mysteryShip.active) {
      previewInvadersCtx.fillStyle = '#FFD700';
      previewInvadersCtx.fillRect(state.mysteryShip.x, state.mysteryShip.y, state.mysteryShip.width, state.mysteryShip.height);
    }
    previewInvadersCtx.fillStyle = '#FF0000';
    state.enemyBullets.forEach(bullet => {
      previewInvadersCtx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    });
    previewInvadersCtx.fillStyle = '#00FFFF';
    for (let i = 0; i < state.player.lives; i++) {
      previewInvadersCtx.fillRect(10 + i * (state.player.width + 10), 380, state.player.width, state.player.height);
    }
    previewInvadersCtx.font = '14px "Courier New", monospace';
    previewInvadersCtx.fillStyle = '#888';
    previewInvadersCtx.fillText(`Level: ${state.level}`, previewInvadersCanvas.width - 70, 390);
  }

  function previewInvadersGameLoop() {
    if (previewInvaderState.gameOver) return;
    previewUpdateInvaders();
    previewDrawInvaders();
    previewInvaderState.gameLoopId = requestAnimationFrame(previewInvadersGameLoop);
  }

  function previewStartNextLevel() {
    const state = previewInvaderState;
    state.level++;
    if (previewInvadersMessageEl) previewInvadersMessageEl.textContent = `Space Invaders — Level ${state.level}`;
    state.enemyBullets = [];
    state.bullet.active = false;
    state.bullet.alive = false;
    state.enemyMoveInterval = Math.max(5, 30 - (state.level - 1) * 2);
    state.enemyMoveTimer = state.enemyMoveInterval;
    state.dropSpeed = 10 + (state.level - 1) * 2;
    previewCreateEnemies();
    previewCreateBunkers();
    if (previewInvadersMessageEl) {
      const palette = previewInvaderPalettes[(state.level - 1) % previewInvaderPalettes.length];
      previewInvadersMessageEl.style.color = palette;
      setTimeout(() => { if (previewInvadersMessageEl) previewInvadersMessageEl.style.color = '#eee'; }, 1200);
    }
  }

  function previewStartInvaders() {
    if (previewInvaderState.gameLoopId) {
      cancelAnimationFrame(previewInvaderState.gameLoopId);
      previewInvaderState.gameLoopId = null;
    }
    previewInvaderState.gameOver = false;
    previewInvaderState.score = 0;
    previewInvaderState.level = 1;
    previewInvaderState.enemyBullets = [];
    previewInvaderState.bullet.active = false;
    previewInvaderState.bullet.alive = false;
    previewInvaderState.player.x = 140;
    previewInvaderState.player.lives = 3;
    previewInvaderState.player.alive = true;
    previewInvaderState.enemyDirection = 1;
    previewInvaderState.enemyMoveTimer = 0;
    previewInvaderState.enemyMoveInterval = 30;
    previewInvaderState.mysteryShip.active = false;
    previewInvaderState.mysteryShip.alive = false;
    previewInvaderState.dropSpeed = 10;
    if (previewInvadersScoreEl) previewInvadersScoreEl.textContent = "Score: 0";
    if (previewInvadersMessageEl) previewInvadersMessageEl.textContent = "Good luck!";
    if (previewStartInvadersBtn) previewStartInvadersBtn.textContent = 'Restart';
    previewCreateEnemies();
    previewCreateBunkers();
    previewInvaderState.gameLoopId = requestAnimationFrame(previewInvadersGameLoop);
  }

  function previewStopInvaders(message = "GAME OVER") {
    previewInvaderState.gameOver = true;
    if (previewInvaderState.gameLoopId) {
      cancelAnimationFrame(previewInvaderState.gameLoopId);
      previewInvaderState.gameLoopId = null;
    }
    if (previewInvadersMessageEl) previewInvadersMessageEl.textContent = message;
    if (previewStartInvadersBtn) previewStartInvadersBtn.textContent = 'Start';
  }

  function previewHandleInvadersKey(event) {
    if (!previewInvadersModal || previewInvadersModal.style.display !== 'flex') return;
    const state = previewInvaderState;
    if (event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (state.gameOver) {
        previewStartInvaders();
        return;
      }
      if (!state.bullet.active && state.player.alive) {
        state.bullet.x = state.player.x + (state.player.width / 2) - (state.bullet.width / 2);
        state.bullet.y = state.player.y;
        state.bullet.active = true;
        state.bullet.alive = true;
      }
    }
    if (state.gameOver || !state.player.alive) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      state.player.x = Math.max(0, state.player.x - 10);
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      state.player.x = Math.min(previewInvadersCanvas.width - state.player.width, state.player.x + 10);
    }
  }

  function initPreviewInvadersGame() {
    if (previewStartInvadersBtn) previewStartInvadersBtn.addEventListener('click', previewStartInvaders);
    if (!document.__previewInvadersBound) {
      document.addEventListener('keydown', previewHandleInvadersKey);
      document.__previewInvadersBound = true;
    }
    if (previewInvadersCtx) {
      previewInvadersCtx.fillStyle = '#000';
      previewInvadersCtx.fillRect(0, 0, previewInvadersCanvas.width, previewInvadersCanvas.height);
    }
  }

  // Expose init function for loader
  globalScope.initPreviewInvadersGame = initPreviewInvadersGame;
  globalScope.startPreviewInvaders = previewStartInvaders;
  globalScope.stopPreviewInvaders = previewStopInvaders;
})();
