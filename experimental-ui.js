// experimental-ui.js — lightweight UI loader for experimental.html
// Wires the Run cards / modal controls to the per-game modules:
// experimental/neon-tetris.js, experimental/neon-racer-plus.js, experimental/space-invaders-plus.js
(function () {
  const win = typeof window !== 'undefined' ? window : globalThis;

  document.addEventListener('DOMContentLoaded', async () => {
    if (win.whenAuthReady) await win.whenAuthReady;
    // preserve previous access-check behavior (login.js may provide enforcePageAccess)
    if (typeof win.enforcePageAccess === 'function' && !win.enforcePageAccess('experimental.html')) {
      return;
    }

    const inited = {
      tetris: false,
      racer: false,
      invaders: false
    };

    // --- TETRIS ---
    const runTetrisBtn = document.getElementById('runTetrisBtn');
    const tetrisModal = document.getElementById('tetrisModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const startBtn = document.getElementById('startBtn');
    const controlsBtn = document.getElementById('controlsBtn');

    function openTetrisModal() {
      if (!inited.tetris) {
        if (typeof win.initTetrisGame === 'function') {
          try { win.initTetrisGame(); } catch (e) { console.error('initTetrisGame error', e); }
        }
        inited.tetris = true;
      }
      if (tetrisModal) tetrisModal.style.display = 'flex';
      if (typeof win.loadHighScore === 'function') {
        try { win.loadHighScore(); } catch (e) { /* ignore */ }
      }
      if (startBtn && typeof startBtn.textContent !== 'undefined') startBtn.textContent = 'Start';
    }

    function closeTetrisModal() {
      if (tetrisModal) tetrisModal.style.display = 'none';
      // attempt to stop/cleanup using typical exported names (safe no-ops)
      if (typeof win.t_stopGame === 'function') { try { win.t_stopGame(); } catch (e) {} }
      if (typeof win.stopTetris === 'function') { try { win.stopTetris(); } catch (e) {} }
      // clear any legacy global interval named 'game' if present
      try { if (win.game) { clearInterval(win.game); win.game = null; } } catch (e) {}
      // clear canvas visually
      const canvas = document.getElementById('game');
      if (canvas && canvas.getContext) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#050505';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }

    if (runTetrisBtn) runTetrisBtn.addEventListener('click', (e) => { e.preventDefault(); openTetrisModal(); });
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeTetrisModal);
    if (tetrisModal) {
      tetrisModal.addEventListener('click', (e) => { if (e.target === tetrisModal) closeTetrisModal(); });
    }
    // Start / controls buttons delegate to any known exports (compat)
    if (startBtn) startBtn.addEventListener('click', () => {
      if (typeof win.startTetris === 'function') return win.startTetris();
      if (typeof win.start === 'function') return win.start();
      if (typeof win.t_start === 'function') return win.t_start();
      // if per-game exposes start via init (common), allow user to click the per-game bound start
    });
    if (controlsBtn) controlsBtn.addEventListener('click', () => {
      if (typeof win.showTetrisControls === 'function') return win.showTetrisControls();
      alert('Controls:\nRight Arrow: Right\nLeft Arrow: Left\nSpace Bar: Rotate\nDown Arrow: Speed Up Fall');
    });

    // --- RACER++ ---
    const runRacerBtn = document.getElementById('runRacerBtn');
    const racerModal = document.getElementById('racerModal');
    const racerModalCloseBtn = document.getElementById('racerModalCloseBtn');
    const startRacerBtn = document.getElementById('startRacerBtn');
    const pauseRacerBtn = document.getElementById('pauseRacerBtn');
    const resetRacerBtn = document.getElementById('resetRacerBtn');

    function openRacerModal() {
      if (!inited.racer) {
        if (typeof win.initRacerGame === 'function') {
          try { win.initRacerGame(); } catch (e) { console.error('initRacerGame error', e); }
        }
        inited.racer = true;
      }
      if (racerModal) racerModal.style.display = 'flex';
      if (typeof win.resetRacer === 'function') {
        try { win.resetRacer(); } catch (e) { /* ignore */ }
      }
    }

    function closeRacerModal() {
      if (racerModal) racerModal.style.display = 'none';
      if (typeof win.pauseRacer === 'function') {
        try { win.pauseRacer(); } catch (e) { /* ignore */ }
      }
    }

    if (runRacerBtn) runRacerBtn.addEventListener('click', (e) => { e.preventDefault(); openRacerModal(); });
    if (racerModalCloseBtn) racerModalCloseBtn.addEventListener('click', closeRacerModal);
    if (racerModal) racerModal.addEventListener('click', (e) => { if (e.target === racerModal) closeRacerModal(); });
    if (startRacerBtn) startRacerBtn.addEventListener('click', () => { if (typeof win.startRacer === 'function') win.startRacer(); });
    if (pauseRacerBtn) pauseRacerBtn.addEventListener('click', () => { if (typeof win.pauseRacer === 'function') win.pauseRacer(); });
    if (resetRacerBtn) resetRacerBtn.addEventListener('click', () => { if (typeof win.resetRacer === 'function') win.resetRacer(); });

    // --- INVADERS++ ---
    const runInvadersBtn = document.getElementById('runInvadersBtn');
    const invadersModal = document.getElementById('invadersModal');
    const invadersModalCloseBtn = document.getElementById('invadersModalCloseBtn');
    const startInvadersBtn = document.getElementById('startInvadersBtn');

    function openInvadersModal() {
      if (!inited.invaders) {
        if (typeof win.initInvadersGame === 'function') {
          try { win.initInvadersGame(); } catch (e) { console.error('initInvadersGame error', e); }
        }
        inited.invaders = true;
      }
      if (invadersModal) invadersModal.style.display = 'flex';
    }

    function closeInvadersModal() {
      if (invadersModal) invadersModal.style.display = 'none';
      if (typeof win.stopInvaders === 'function') {
        try { win.stopInvaders(); } catch (e) { /* ignore */ }
      }
    }

    if (runInvadersBtn) runInvadersBtn.addEventListener('click', (e) => { e.preventDefault(); openInvadersModal(); });
    if (invadersModalCloseBtn) invadersModalCloseBtn.addEventListener('click', closeInvadersModal);
    if (invadersModal) invadersModal.addEventListener('click', (e) => { if (e.target === invadersModal) closeInvadersModal(); });
    if (startInvadersBtn) startInvadersBtn.addEventListener('click', () => { if (typeof win.startInvaders === 'function') win.startInvaders(); });

    // Escape closes open modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (tetrisModal && tetrisModal.style.display === 'flex') closeTetrisModal();
        if (racerModal && racerModal.style.display === 'flex') closeRacerModal();
        if (invadersModal && invadersModal.style.display === 'flex') closeInvadersModal();
      }
    });
  });
})();

// Get the new Minesweeper modal elements
const minesweeperModal = document.getElementById('minesweeperModal');
const minesweeperCloseBtn = document.getElementById('minesweeperModalCloseBtn');

// Function to close the Minesweeper modal
function closeMinesweeperModal() {
    minesweeperModal.style.display = 'none';
    // If you have a stop game function for minesweeper, call it here:
    // stopMinesweeperGame(); 
}

// Close when the 'x' button is clicked (already handled in minesweeper.js, but good practice)
if (minesweeperCloseBtn) {
    minesweeperCloseBtn.addEventListener('click', closeMinesweeperModal);
}

// Close when clicking outside the modal content
if (minesweeperModal) {
    minesweeperModal.addEventListener('click', (e) => {
        if (e.target === minesweeperModal) {
            closeMinesweeperModal();
        }
    });
}
