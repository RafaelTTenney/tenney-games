import { getHighScore, submitLowScore } from './score-store.js';

/* Minesweeper Elite (Flagship) 
  Logic for the advanced minesweeper in Experimental
*/

let msConfig = { difficulty: 0.1, size: 10 };
const MS_GAME_BASE_ID = 'minesweeper-elite';
let msBestTime = 0;
let msGameId = `${MS_GAME_BASE_ID}-${msConfig.size}-${Math.round(msConfig.difficulty * 100)}`;
let msState = { 
    grid: [], 
    mines: [], 
    revealed: [], 
    flagged: [], 
    gameOver: false, 
    timer: 0, 
    interval: null, 
    mineCount: 0 
};

// UI References
const msModal = document.getElementById('superMinesweeperModal');
const msFlagsDisplay = document.getElementById('ms-flags-left');
const msTimerDisplay = document.getElementById('ms-timer');
const msStatusDisplay = document.getElementById('ms-status');
const msGridContainer = document.getElementById('ms-grid');

function renderMsTimer() {
    const bestLabel = msBestTime > 0 ? ` | Best: ${msBestTime}` : '';
    if (msTimerDisplay) msTimerDisplay.innerText = `Time: ${msState.timer}${bestLabel}`;
}

function currentMsGameId() {
    return `${MS_GAME_BASE_ID}-${msConfig.size}-${Math.round(msConfig.difficulty * 100)}`;
}

async function loadMsBestTime() {
    msGameId = currentMsGameId();
    msBestTime = await getHighScore(msGameId);
    renderMsTimer();
}

async function submitMsBestTime() {
    const saved = await submitLowScore(msGameId, msState.timer);
    if (typeof saved === 'number') msBestTime = saved;
    renderMsTimer();
}

// --- Global Menu Functions (Exposed to Window for HTML Buttons) ---

window.setMsDiff = function(diff, btn) {
    // UI update
    btn.parentElement.querySelectorAll('.ms-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    
    // Logic update
    if(diff === 'easy') msConfig.difficulty = 0.1;
    if(diff === 'med') msConfig.difficulty = 0.15;
    if(diff === 'hard') msConfig.difficulty = 0.2;
};

window.setMsSize = function(size, btn) {
    // UI update
    btn.parentElement.querySelectorAll('.ms-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    
    // Logic update
    msConfig.size = size;
};

window.showMsMenu = function() {
    document.getElementById('ms-menu').style.display = 'flex';
    document.getElementById('ms-game-area').style.display = 'none';
    clearInterval(msState.interval);
};

window.startEliteMinesweeper = function() {
    document.getElementById('ms-menu').style.display = 'none';
    document.getElementById('ms-game-area').style.display = 'block';
    initMsGame();
};

// --- Core Game Logic ---

function initMsGame() {
    const size = msConfig.size;
    const mines = Math.floor(size * size * msConfig.difficulty);
    
    msState = {
        grid: Array(size * size).fill(0),
        mines: Array(size * size).fill(false),
        revealed: Array(size * size).fill(false),
        flagged: Array(size * size).fill(false),
        gameOver: false,
        timer: 0,
        interval: null,
        mineCount: mines
    };
    window.msState = msState;
    loadMsBestTime();

    // Place Mines Randomly
    let placed = 0;
    while(placed < mines) {
        let idx = Math.floor(Math.random() * (size * size));
        if(!msState.mines[idx]) {
            msState.mines[idx] = true;
            placed++;
        }
    }

    // Calculate Adjacent Numbers
    for(let i=0; i<size*size; i++) {
        if(msState.mines[i]) continue;
        let count = 0;
        getNeighbors(i, size).forEach(n => { if(msState.mines[n]) count++; });
        msState.grid[i] = count;
    }

    // Reset UI
    if(msFlagsDisplay) msFlagsDisplay.innerText = "Flags: " + mines;
    if(msStatusDisplay) msStatusDisplay.innerText = "";
    if(msStatusDisplay) msStatusDisplay.style.color = "#fff";
    msState.timer = 0;
    renderMsTimer();

    renderGrid();
    
    // Start Timer
    clearInterval(msState.interval);
    msState.interval = setInterval(() => {
        if(!msState.gameOver) {
            msState.timer++;
            renderMsTimer();
        }
    }, 1000);
}

function getNeighbors(idx, size) {
    const neighbors = [];
    const r = Math.floor(idx / size);
    const c = idx % size;
    for(let dr = -1; dr <= 1; dr++) {
        for(let dc = -1; dc <= 1; dc++) {
            if(dr===0 && dc===0) continue;
            const nr = r + dr;
            const nc = c + dc;
            if(nr >= 0 && nr < size && nc >= 0 && nc < size) {
                neighbors.push(nr * size + nc);
            }
        }
    }
    return neighbors;
}

function renderGrid() {
    if(!msGridContainer) return;
    
    msGridContainer.innerHTML = '';
    msGridContainer.style.gridTemplateColumns = `repeat(${msConfig.size}, 1fr)`;
    
    msState.grid.forEach((val, idx) => {
        const cell = document.createElement('div');
        cell.className = 'ms-cell';
        cell.dataset.idx = idx;
        
        if(msState.revealed[idx]) {
            cell.classList.add('revealed');
            if(msState.mines[idx]) {
                cell.classList.add('mine');
                cell.innerText = '💣';
            } else if(val > 0) {
                cell.innerText = val;
                cell.classList.add('ms-c' + val);
            }
        } else if(msState.flagged[idx]) {
            cell.classList.add('flag');
            cell.innerText = '🚩';
        }

        cell.addEventListener('click', () => handleClick(idx));
        cell.addEventListener('contextmenu', (e) => { 
            e.preventDefault(); 
            handleRightClick(idx); 
        });
        
        msGridContainer.appendChild(cell);
    });
}

function handleClick(idx) {
    if(msState.gameOver || msState.flagged[idx] || msState.revealed[idx]) return;
    
    if(msState.mines[idx]) {
        gameOver(false);
        return;
    }

    reveal(idx);
    renderGrid();
    checkWin();
}

function handleRightClick(idx) {
    if(msState.gameOver || msState.revealed[idx]) return;
    msState.flagged[idx] = !msState.flagged[idx];
    
    const flagsUsed = msState.flagged.filter(Boolean).length;
    if(msFlagsDisplay) msFlagsDisplay.innerText = "Flags: " + (msState.mineCount - flagsUsed);
    
    renderGrid();
}

function reveal(idx) {
    if(msState.revealed[idx] || msState.flagged[idx]) return;
    msState.revealed[idx] = true;
    
    // Flood fill if empty
    if(msState.grid[idx] === 0) {
        getNeighbors(idx, msConfig.size).forEach(n => reveal(n));
    }
}

function gameOver(win) {
    msState.gameOver = true;
    clearInterval(msState.interval);
    
    if(!win) {
        // Reveal all mines
        msState.mines.forEach((isMine, i) => { 
            if(isMine) msState.revealed[i] = true; 
        });
        if(msStatusDisplay) {
            msStatusDisplay.innerText = "GAME OVER!";
            msStatusDisplay.style.color = "red";
        }
        renderGrid();
    } else {
        if(msStatusDisplay) {
            msStatusDisplay.innerText = "VICTORY!";
            msStatusDisplay.style.color = "#00FF00";
        }
        submitMsBestTime();
    }
}

function checkWin() {
    let safeUtils = 0;
    const totalSafe = (msConfig.size * msConfig.size) - msState.mineCount;
    for(let i=0; i < msState.grid.length; i++) {
        if(!msState.mines[i] && msState.revealed[i]) safeUtils++;
    }
    if(safeUtils === totalSafe) gameOver(true);
}
