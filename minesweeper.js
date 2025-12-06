// minesweeper.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Minesweeper Game State Variables ---
    const GRID_SIZE = 10;
    const NUM_MINES = 10;
    const gridElement = document.getElementById('minesweeper-grid');
    const mineCountElement = document.getElementById('mine-count');
    const timerElement = document.getElementById('minesweeper-timer');
    const messageElement = document.getElementById('minesweeper-message');
    const newGameBtn = document.getElementById('newGameMinesweeperBtn');

    let board;
    let isGameOver = true;
    let flagsPlaced = 0;
    let cellsRevealed = 0;
    let timerInterval = null;
    let timeElapsed = 0;
    
    // Set up the grid layout based on size
    gridElement.style.gridTemplateColumns = `repeat(${GRID_SIZE}, 1fr)`;

    // --- Utility Functions ---

    /**
     * Finds all valid neighbor coordinates for a given (row, col).
     * @param {number} row 
     * @param {number} col 
     * @returns {Array<[number, number]>}
     */
    function getNeighbors(row, col) {
        const neighbors = [];
        for (let r = row - 1; r <= row + 1; r++) {
            for (let c = col - 1; c <= col + 1; c++) {
                if (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && (r !== row || c !== col)) {
                    neighbors.push([r, c]);
                }
            }
        }
        return neighbors;
    }

    // --- Game Logic ---

    /**
     * Initializes the game board structure.
     */
    function createBoard() {
        board = [];
        gridElement.innerHTML = '';
        for (let r = 0; r < GRID_SIZE; r++) {
            const row = [];
            for (let c = 0; c < GRID_SIZE; c++) {
                const cell = {
                    isMine: false,
                    isRevealed: false,
                    isFlagged: false,
                    adjacentMines: 0,
                    element: document.createElement('div')
                };

                cell.element.className = 'minesweeper-cell hidden';
                cell.element.dataset.row = r;
                cell.element.dataset.col = c;
                cell.element.addEventListener('click', () => handleLeftClick(r, c));
                cell.element.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    handleRightClick(r, c);
                });

                row.push(cell);
                gridElement.appendChild(cell.element);
            }
            board.push(row);
        }
    }

    /**
     * Randomly places mines, ensuring the first click (if provided) is safe.
     * @param {number} [startRow] - Row of the safe cell.
     * @param {number} [startCol] - Column of the safe cell.
     */
    function placeMines(startRow, startCol) {
        let minesPlaced = 0;
        while (minesPlaced < NUM_MINES) {
            const r = Math.floor(Math.random() * GRID_SIZE);
            const c = Math.floor(Math.random() * GRID_SIZE);
            
            // Ensure mine is not placed on the starting cell
            if (!board[r][c].isMine && (r !== startRow || c !== startCol)) {
                board[r][c].isMine = true;
                minesPlaced++;
            }
        }
        calculateAdjacentMines();
    }

    /**
     * Calculates the adjacent mine count for every non-mine cell.
     */
    function calculateAdjacentMines() {
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const cell = board[r][c];
                if (!cell.isMine) {
                    const neighbors = getNeighbors(r, c);
                    let mineCount = 0;
                    neighbors.forEach(([nr, nc]) => {
                        if (board[nr][nc].isMine) {
                            mineCount++;
                        }
                    });
                    cell.adjacentMines = mineCount;
                    if (mineCount > 0) {
                       cell.element.dataset.adjacent = mineCount; // For CSS color
                    }
                }
            }
        }
    }

    /**
     * Reveals a single cell and handles the game logic.
     * @param {number} row 
     * @param {number} col 
     */
    function revealCell(row, col) {
        const cell = board[row][col];
        
        if (cell.isRevealed || cell.isFlagged || isGameOver) {
            return;
        }

        cell.isRevealed = true;
        cellsRevealed++;
        cell.element.classList.remove('hidden');
        cell.element.classList.add('revealed');
        cell.element.textContent = ''; // Clear flag/hidden content

        if (cell.isMine) {
            cell.element.classList.add('mine');
            cell.element.textContent = '💣';
            endGame(false);
            return;
        }

        if (cell.adjacentMines > 0) {
            cell.element.textContent = cell.adjacentMines;
        } else {
            // Cascade reveal for empty cells
            getNeighbors(row, col).forEach(([nr, nc]) => {
                revealCell(nr, nc);
            });
        }
        
        checkWin();
    }

    /**
     * Handles the left-click action on a cell.
     * @param {number} row 
     * @param {number} col 
     */
    function handleLeftClick(row, col) {
        if (isGameOver) {
            // If first click on a game that hasn't started, initialize
            if (!timerInterval) {
                placeMines(row, col);
                startTimer();
                isGameOver = false;
                messageElement.textContent = 'Game started! Good luck.';
            } else {
                return; // Game over, but timer is running means it just ended, prevent clicks
            }
        }
        revealCell(row, col);
    }

    /**
     * Handles the right-click (flagging) action on a cell.
     * @param {number} row 
     * @param {number} col 
     */
    function handleRightClick(row, col) {
        if (isGameOver) return;

        const cell = board[row][col];
        if (cell.isRevealed) return;

        if (cell.isFlagged) {
            cell.isFlagged = false;
            flagsPlaced--;
            cell.element.classList.remove('flagged');
            cell.element.textContent = '';
        } else if (flagsPlaced < NUM_MINES) {
            cell.isFlagged = true;
            flagsPlaced++;
            cell.element.classList.add('flagged');
            cell.element.textContent = '🚩';
        }
        
        mineCountElement.textContent = `Mines: ${NUM_MINES - flagsPlaced}`;
        checkWin();
    }
    
    /**
     * Checks if the player has won the game.
     */
    function checkWin() {
        const totalCells = GRID_SIZE * GRID_SIZE;
        const nonMineCells = totalCells - NUM_MINES;

        if (cellsRevealed === nonMineCells) {
            endGame(true);
        }
    }

    /**
     * Ends the game, revealing the remaining board.
     * @param {boolean} won - True if the player won, false otherwise.
     */
    function endGame(won) {
        isGameOver = true;
        stopTimer();
        
        // Reveal the rest of the board
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const cell = board[r][c];
                if (cell.isMine && !cell.isFlagged) {
                    cell.element.classList.remove('hidden');
                    cell.element.classList.add('revealed');
                    cell.element.classList.add('mine');
                    cell.element.textContent = '💣';
                } else if (!cell.isMine && cell.isFlagged) {
                    // Mark incorrectly placed flags
                    cell.element.textContent = '❌';
                }
            }
        }

        if (won) {
            messageElement.textContent = `🎉 YOU WIN! Time: ${timeElapsed}s 🎉`;
        } else {
            messageElement.textContent = '💥 Game Over! You hit a mine. 💥';
        }
    }

    // --- Timer Functions ---

    function startTimer() {
        timeElapsed = 0;
        timerElement.textContent = 'Time: 0';
        timerInterval = setInterval(() => {
            timeElapsed++;
            timerElement.textContent = `Time: ${timeElapsed}`;
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    // --- Initialization ---

    /**
     * Resets the game state and creates a new board.
     */
    function initializeGame() {
        stopTimer();
        isGameOver = true; // Set to true initially to prevent interaction before first click
        flagsPlaced = 0;
        cellsRevealed = 0;
        timeElapsed = 0;

        mineCountElement.textContent = `Mines: ${NUM_MINES}`;
        timerElement.textContent = 'Time: 0';
        messageElement.textContent = 'Click any cell to start!';

        createBoard();
    }
    
    // Attach event listeners for modal and game
    document.getElementById('runMinesweeperBtn').addEventListener('click', () => {
        document.getElementById('minesweeperModal').style.display = 'flex';
        initializeGame();
    });

    document.getElementById('minesweeperModalCloseBtn').addEventListener('click', () => {
        document.getElementById('minesweeperModal').style.display = 'none';
        stopTimer();
    });

    newGameBtn.addEventListener('click', initializeGame);

    // Initial call to set up the empty grid
    initializeGame();
});
