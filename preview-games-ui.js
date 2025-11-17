(function () {
  // Preview page UI loader: binds run buttons and lazy-inits preview games.
  const globalScope = typeof window !== 'undefined' ? window : globalThis;
  let initedTetris = false;
  let initedInvaders = false;

  document.addEventListener('DOMContentLoaded', () => {
    const runTetrisBtn = document.getElementById('runSimpleTetrisBtn');
    const tetrisModal = document.getElementById('previewSimpleTetrisModal');
    const tetrisClose = document.getElementById('preview-modalCloseBtn');

    if (runTetrisBtn) {
      runTetrisBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (!initedTetris && typeof globalScope.initPreviewSimpleTetris === 'function') {
          globalScope.initPreviewSimpleTetris();
          initedTetris = true;
        }
        if (tetrisModal) tetrisModal.style.display = 'flex';
      });
    }
    if (tetrisClose) tetrisClose.addEventListener('click', () => {
      if (tetrisModal) tetrisModal.style.display = 'none';
      if (typeof globalScope.stopPreviewTetris === 'function') globalScope.stopPreviewTetris();
    });

    // Preview invaders
    const runInv = document.getElementById('runPreviewInvadersBtn');
    const invModal = document.getElementById('preview-invadersModal');
    const invClose = document.getElementById('preview-invadersModalCloseBtn');

    if (runInv) {
      runInv.addEventListener('click', (e) => {
        e.preventDefault();
        if (!initedInvaders && typeof globalScope.initPreviewInvadersGame === 'function') {
          globalScope.initPreviewInvadersGame();
          initedInvaders = true;
        }
        if (invModal) invModal.style.display = 'flex';
        const msg = document.getElementById('preview-invaders-message');
        if (msg) msg.textContent = 'Press Start!';
      });
    }
    if (invClose) invClose.addEventListener('click', () => {
      if (invModal) invModal.style.display = 'none';
      if (typeof globalScope.stopPreviewInvaders === 'function') globalScope.stopPreviewInvaders();
    });
    if (invModal) {
      invModal.addEventListener('click', (e) => {
        if (e.target === invModal) {
          invModal.style.display = 'none';
          if (typeof globalScope.stopPreviewInvaders === 'function') globalScope.stopPreviewInvaders();
        }
      });
    }
  });
})();
