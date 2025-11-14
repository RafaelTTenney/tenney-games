(function () {
  // Experimental page UI loader: enforces access, wires Run buttons, lazy-inits game modules.
  const win = typeof window !== 'undefined' ? window : globalThis;

  document.addEventListener('DOMContentLoaded', () => {
    // Access protection: if login.js exposes enforcePageAccess, use it.
    if (typeof win.enforcePageAccess === 'function' && !win.enforcePageAccess('experimental.html')) {
      return;
    }

    const inited = {
      tetris: false,
      racer: false,
      invaders: false
    };

    // TETRIS
    const runTetrisBtn = document.getElementById('runTetrisBtn');
    const tetrisModal = document.getElementById('tetrisModal');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const startBtn = document.getElementById('startBtn');

    function openTetrisModal() {
      if (!inited.tetris && typeof win.initTetrisGame === 'function') {
        try { win.initTetrisGame(); } catch (e) { console.error('initTetrisGame failed', e); }
        inited.tetris = true;
      }
      if (tetrisModal) tetrisModal.style.display = 'flex';
      // If a start button exists, let the per-game init handle binding; otherwise leave it to user.
    }

    function closeTetrisModal() {
      if (tetrisModal) tetrisModal.style.display = 'none';
      // Try common stop function names (safe no-op if undefined)
      if (typeof win.t_stopGame === 'function') try { win.t_stopGame(); } catch(e){console.warn(e);}
      if (typeof win.stopTetris === 'function') try { win.stopTetris(); } catch(e){console.warn(e);}
      if (typeof win.initTetrisGame === 'function' && typeof win.loadHighScore === 'function') {
        /* preserve score UI if applicable */
        try { win.loadHighScore(); } catch(e){/*ignore*/ }
      }
    }

    if (runTetrisBtn) {
      runTetrisBtn.addEventListener('click', (e) => { e.preventDefault(); openTetrisModal(); });
    }
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeTetrisModal);
    if (tetrisModal) {
      tetrisModal.addEventListener('click', (e) => { if (e.target === tetrisModal) closeTetrisModal(); });
    }

    // RACER++
    const runRacerBtn = document.getElementById('runRacerBtn');
    const racerModal = document.getElementById('racerModal');
    const racerModalCloseBtn = document.getElementById('racerModalCloseBtn');
    const startRacerBtn = document.getElementById('startRacerBtn');
    const pauseRacerBtn = document.getElementById('pauseRacerBtn');
    const resetRacerBtn = document.getElementById('resetRacerBtn');

    function openRacerModal() {
      if (!inited.racer && typeof win.initRacerGame === 'function') {
        try { win.initRacerGame(); } catch (e) { console.error('initRacerGame failed', e); }
        inited.racer = true;
      }
      if (racerModal) racerModal.style.display = 'flex';
      // ensure reset to initial state if available
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

    if (runRacerBtn) runRacerBtn.addEventListener('click', (e)=>{ e.preventDefault(); openRacerModal(); });
    if (racerModalCloseBtn) racerModalCloseBtn.addEventListener('click', closeRacerModal);
    if (racerModal) {
      racerModal.addEventListener('click', (e) => { if (e.target === racerModal) closeRacerModal(); });
    }

    // Wire explicit modal buttons to global functions if present (redundant but convenient)
    if (startRacerBtn) startRacerBtn.addEventListener('click', () => { if (typeof win.startRacer === 'function') win.startRacer(); });
    if (pauseRacerBtn) pauseRacerBtn.addEventListener('click', () => { if (typeof win.pauseRacer === 'function') win.pauseRacer(); });
    if (resetRacerBtn) resetRacerBtn.addEventListener('click', () => { if (typeof win.resetRacer === 'function') win.resetRacer(); });

    // INVADERS++
    const runInvadersBtn = document.getElementById('runInvadersBtn');
    const invadersModal = document.getElementById('invadersModal');
    const invadersModalCloseBtn = document.getElementById('invadersModalCloseBtn');
    const startInvadersBtn = document.getElementById('startInvadersBtn');

    function openInvadersModal() {
      if (!inited.invaders && typeof win.initInvadersGame === 'function') {
        try { win.initInvadersGame(); } catch (e) { console.error('initInvadersGame failed', e); }
        inited.invaders = true;
      }
      if (invadersModal) invadersModal.style.display = 'flex';
      if (typeof win.startInvaders === 'function') {
        // Do not auto-start unless desired; keep message and let user press Start.
      }
      if (typeof win.stopInvaders === 'function') {
        // ensure a clean state if any previous run left running
        try { /* no-op */ } catch(e){/*ignore*/ }
      }
    }

    function closeInvadersModal() {
      if (invadersModal) invadersModal.style.display = 'none';
      if (typeof win.stopInvaders === 'function') {
        try { win.stopInvaders(); } catch (e) { /* ignore */ }
      }
    }

    if (runInvadersBtn) runInvadersBtn.addEventListener('click', (e)=>{ e.preventDefault(); openInvadersModal(); });
    if (invadersModalCloseBtn) invadersModalCloseBtn.addEventListener('click', closeInvadersModal);
    if (invadersModal) {
      invadersModal.addEventListener('click', (e) => { if (e.target === invadersModal) closeInvadersModal(); });
    }
    if (startInvadersBtn) startInvadersBtn.addEventListener('click', () => { if (typeof win.startInvaders === 'function') win.startInvaders(); });

    // Optional: keyboard escape to close any open modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (tetrisModal && tetrisModal.style.display === 'flex') closeTetrisModal();
        if (racerModal && racerModal.style.display === 'flex') closeRacerModal();
        if (invadersModal && invadersModal.style.display === 'flex') closeInvadersModal();
      }
    });
  });
})();
