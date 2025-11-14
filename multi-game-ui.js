(function () {
  // Multi-page UI loader: toggles tabs, lazy-inits games, wires buttons.
  const globalScope = typeof window !== 'undefined' ? window : globalThis;

  const GAME_SECTIONS = {
    snake: 'snake-game',
    memory: 'memory-game',
    paperio: 'paperio-game',
    racer: 'racer-game'
  };

  const inited = {
    snake: false,
    memory: false,
    paperio: false,
    racer: false
  };

  function showGame(game) {
    Object.entries(GAME_SECTIONS).forEach(([name, id]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const isActive = name === game;
      el.style.display = isActive ? 'flex' : 'none';
      el.setAttribute('aria-hidden', isActive ? 'false' : 'true');
    });

    const buttons = document.querySelectorAll('[data-game-target]');
    buttons.forEach(btn => {
      const target = btn.getAttribute('data-game-target');
      const isActive = target === game;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });

    // Pause racer if switching away
    if (game !== 'racer' && typeof globalScope.pauseRacer === 'function') {
      globalScope.pauseRacer();
      if (typeof globalScope.updateRacerHud === 'function') globalScope.updateRacerHud();
    }

    // Lazy init on first show
    if (!inited[game]) {
      switch (game) {
        case 'snake':
          if (typeof globalScope.initSnakeGame === 'function') globalScope.initSnakeGame();
          inited.snake = true;
          // wire restart button
          const snakeRestart = document.getElementById('snakeRestartBtn');
          if (snakeRestart) snakeRestart.addEventListener('click', () => { if (typeof globalScope.resetSnake === 'function') globalScope.resetSnake(); });
          break;
        case 'memory':
          if (typeof globalScope.initMemoryGame === 'function') globalScope.initMemoryGame();
          inited.memory = true;
          const memRestart = document.getElementById('memoryRestartBtn');
          if (memRestart) memRestart.addEventListener('click', () => { if (typeof globalScope.resetMemory === 'function') globalScope.resetMemory(); });
          break;
        case 'paperio':
          if (typeof globalScope.initPaperioGame === 'function') globalScope.initPaperioGame();
          inited.paperio = true;
          const paperRestart = document.getElementById('paperioRestartBtn');
          if (paperRestart) paperRestart.addEventListener('click', () => { if (typeof globalScope.resetPaperio === 'function') globalScope.resetPaperio(); });
          break;
        case 'racer':
          if (typeof globalScope.initRacerGame === 'function') globalScope.initRacerGame();
          inited.racer = true;
          // wire racer buttons
          const startBtn = document.getElementById('racerStartBtn');
          const pauseBtn = document.getElementById('racerPauseBtn');
          const resetBtn = document.getElementById('racerResetBtn');
          if (startBtn) startBtn.addEventListener('click', () => { if (typeof globalScope.startRacer === 'function') globalScope.startRacer(); });
          if (pauseBtn) pauseBtn.addEventListener('click', () => { if (typeof globalScope.pauseRacer === 'function') globalScope.pauseRacer(); });
          if (resetBtn) resetBtn.addEventListener('click', () => { if (typeof globalScope.resetRacer === 'function') globalScope.resetRacer(); });
          break;
      }
    }
  }

  function bindMenuButtons() {
    const menuButtons = document.querySelectorAll('[data-game-target]');
    menuButtons.forEach(btn => {
      if (btn.__gameBound) return;
      btn.addEventListener('click', () => {
        const game = btn.getAttribute('data-game-target');
        if (game) showGame(game);
      });
      btn.__gameBound = true;
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    // security check via login.js may be applied separately; keep behavior consistent with previous page flow
    bindMenuButtons();
    // show first game by default (snake)
    showGame('snake');
  });

  // Keep a global showGame reference for compatibility
  globalScope.showGame = showGame;
})();
