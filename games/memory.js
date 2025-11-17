(function () {
  // Memory match implementation (extracted from multi-game.js)
  const globalScope = typeof window !== 'undefined' ? window : globalThis;

  function createMemoryModule() {
    const board = document.getElementById('memory-board');
    const movesEl = document.getElementById('memory-moves');
    if (!board) return null;

    const baseSymbols = ['🍎','🎲','🚗','🐍','🌵','🏀','🎸','🍩'];
    let cards = [];
    let firstCard = null;
    let secondCard = null;
    let lockBoard = false;
    let moves = 0;
    let matchedPairs = 0;

    function shuffle(array) {
      const cloned = array.slice();
      for (let i = cloned.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cloned[i], cloned[j]] = [cloned[j], cloned[i]];
      }
      return cloned;
    }

    function updateMoves() {
      if (movesEl) movesEl.textContent = `Moves: ${moves}`;
    }

    function createCardElement(card) {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.dataset.id = card.id;
      cardEl.textContent = '';

      cardEl.addEventListener('click', () => {
        if (lockBoard || card.flipped || card.matched) return;
        flipCard(card, cardEl);
      });

      return cardEl;
    }

    function flipCard(card, cardEl) {
      card.flipped = true;
      cardEl.classList.add('flipped');
      cardEl.textContent = card.symbol;

      if (!firstCard) {
        firstCard = { card, el: cardEl };
        return;
      }

      secondCard = { card, el: cardEl };
      lockBoard = true;
      moves += 1;
      updateMoves();

      if (firstCard.card.symbol === secondCard.card.symbol) {
        firstCard.card.matched = true;
        secondCard.card.matched = true;
        firstCard.el.classList.add('matched');
        secondCard.el.classList.add('matched');
        matchedPairs += 1;
        resetTurn();
        if (matchedPairs === cards.length / 2) {
          setTimeout(() => {
            alert('Great job! You matched all pairs!');
            resetMemory();
          }, 400);
        }
      } else {
        setTimeout(() => {
          firstCard.card.flipped = false;
          secondCard.card.flipped = false;
          firstCard.el.classList.remove('flipped');
          secondCard.el.classList.remove('flipped');
          firstCard.el.textContent = '';
          secondCard.el.textContent = '';
          resetTurn();
        }, 700);
      }
    }

    function resetTurn() {
      lockBoard = false;
      firstCard = null;
      secondCard = null;
    }

    function renderBoard() {
      board.innerHTML = '';
      cards.forEach(card => {
        const el = createCardElement(card);
        if (card.flipped || card.matched) {
          el.classList.add(card.matched ? 'matched' : 'flipped');
          el.textContent = card.symbol;
        }
        board.appendChild(el);
      });
    }

    function resetMemory() {
      const shuffled = shuffle([...baseSymbols, ...baseSymbols]);
      cards = shuffled.map((symbol, index) => ({
        id: index,
        symbol,
        flipped: false,
        matched: false
      }));
      firstCard = null;
      secondCard = null;
      lockBoard = false;
      moves = 0;
      matchedPairs = 0;
      updateMoves();
      renderBoard();
    }

    return {
      init() {
        resetMemory();
      },
      reset: resetMemory
    };
  }

  let memoryModule = null;
  function initMemoryGame() {
    if (!memoryModule) memoryModule = createMemoryModule();
    if (memoryModule && typeof memoryModule.init === 'function') memoryModule.init();
  }

  globalScope.initMemoryGame = initMemoryGame;
  globalScope.resetMemory = function () {
    if (!memoryModule) initMemoryGame();
    if (memoryModule && typeof memoryModule.reset === 'function') memoryModule.reset();
  };
})();
