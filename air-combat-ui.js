(function () {
  function openModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display = 'flex';
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return;
    modal.style.display = 'none';
  }

  function bindModal({ openId, modalId, initFn, stopFn }) {
    const openBtn = document.getElementById(openId);
    const modal = document.getElementById(modalId);
    if (!openBtn || !modal) return;

    openBtn.addEventListener('click', (e) => {
      e.preventDefault();
      openModal(modalId);
      if (typeof window[initFn] === 'function') window[initFn]();
    });

    modal.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        closeModal(modalId);
        if (typeof window[stopFn] === 'function') window[stopFn]();
      });
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modalId);
        if (typeof window[stopFn] === 'function') window[stopFn]();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindModal({ openId: 'openSkygrid', modalId: 'skygridModal', initFn: 'initSkygrid', stopFn: 'stopSkygrid' });
    bindModal({ openId: 'openDuel', modalId: 'duelModal', initFn: 'initDuel', stopFn: 'stopDuel' });
    bindModal({ openId: 'openSwarm', modalId: 'swarmModal', initFn: 'initSwarm', stopFn: 'stopSwarm' });
  });
})();
