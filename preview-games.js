// --- SIMPLE TETRIS GAME LOGIC ---

// Get DOM elements
const simpleTetrisModal = document.getElementById('simpleTetrisModal');
const runSimpleTetrisBtn = document.getElementById('runSimpleTetrisBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const canvas = document.getElementById('game');
const ctx = canvas ? canvas.getContext('2d') : null;
const scoreP = document.getElementById('score');
const startBtn = document.getElementById('startBtn');
const controlsBtn = document.getElementById('controlsBtn');

const box = 24;
const speed = 50; // Milliseconds per frame (50ms * 10 counts = 500ms drop time)

let fastFall = false;
let score = 0;
let highScore;
let tetrisMessageTimer = 0; // Timer for the "TETRIS!" message

let block;
let rows;
let game; // Holds the setInterval ID
let count;

// FIXED Color Palette (Always cyan for the simple version)
const fixedPalette = { fill: '#00FFFF', stroke: '#33FFFF', shadow: '#00FFFF' };

// Block types (The 7 classic pieces)
const all_blocks = {
  0: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], // I (Line)
  1: [[1, 1], [1, 1]],                                     // O (Square)
  2: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],                     // T
  3: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],                     // S
  4: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],                     // Z
  5: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],                     // J
  6: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],                     // L
};

// --- Game Logic Functions ---

function loadHighScore() {
  highScore = parseInt(localStorage.getItem('tetrisHighScore')) || 0;
  if(scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
}

function saveHighScore() {
  localStorage.setItem('tetrisHighScore', highScore);
  if(scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
}

function start() {
  rows = [];
  for (let i = 0; i < 20; i++) {
    let row = [];
    for (let x = 0; x < 10; x++) {
      row.push(0);
    }
    rows.push(row);
  }
  score = 0;
  loadHighScore();  
  count = 10;
  tetrisMessageTimer = 0;
  if (game) clearInterval(game);
  game = setInterval(drawFrame, speed);
  if (startBtn) startBtn.textContent = 'Restart';
}

function rotate() {
  if (!block) return;
  block[0] = transpose(block[0]);
  block[0] = reverse(block[0]);
  if (isColliding(block)) {
    block[0] = reverse(block[0]);
    block[0] = transpose(block[0]);
  }
}

function moveRight() {
  if (!block) return;
  block[1] += 1;
  if (isColliding(block)) block[1] -= 1;
}

function moveLeft() {
  if (!block) return;
  block[1] -= 1;
  if (isColliding(block)) block[1] += 1;
}

function transpose(L) {
  let final = [];
  for (let i = 0; i < L[0].length; i++) final.push([]);
  for (let i = 0; i < L.length; i++) {
    for (let x = 0; x < L[i].length; x++) final[x].push(L[i][x]);
  }
  return final;
}

function reverse(L) {
  for (let i = 0; i < L.length; i++) L[i].reverse();
  return L;
}

function isColliding(B) {
  for (let y = 0; y < B[0].length; y++) {
    for (let x = 0; x < B[0][y].length; x++) {
      if (B[0][y][x] === 1) {
        if (
          (B[1] + x) < 0 ||  
          (B[1] + x) >= 10 || 
          (B[2] + y) >= 20  
        ) {
          return true;
        }
        if (rows[B[2] + y] && rows[B[2] + y][B[1] + x] === 1) {
          return true;
        }
      }
    }
  }
  return false;
}

function drawFrame() {
  if (!ctx) return;
  
  // 1. Spawning
  if (!block) {
    let newBlockIndex = Math.floor(Math.random() * 7); 
    block = [all_blocks[newBlockIndex], 4, 0];

    if (isColliding(block)) {
      clearInterval(game);
      game = null;
      if (startBtn) startBtn.textContent = 'Start';
      if (score > highScore) {
        alert('Game Over! New high score: ' + score);
        highScore = score;
        saveHighScore();
      } else {
        alert('Game Over! Score: ' + score);
      }
      return;  
    }
    return;
  }
  
  // 2. Clear Canvas
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 3. Gravity and Collision Check
  if (count === 0 || (fastFall && (count % 2 === 0))) {
    count = 10; 
    block[2] += 1;  
    
    if (isColliding(block)) {
      block[2] -= 1;  
      
      // Lock piece
      for (let y = 0; y < block[0].length; y++) {
        for (let x = 0; x < block[0][y].length; x++) {
          if (block[0][y][x] === 1) {
            if (rows[block[2] + y]) {
                rows[block[2] + y][block[1] + x] = 1;
            }
          }
        }
      }
      
      block = null;  
      
      // Line Clear and Score Logic
      let linesClearedThisTurn = 0;
      for (let i = 0; i < 20; i++) {
        if (rows[i] && !rows[i].some(b => b === 0)) {
          rows.splice(i, 1);
          let row = []
          for (let x = 0; x < 10; x++) row.push(0);
          rows.unshift(row);
          linesClearedThisTurn++;
          i--;
        }
      }

      // Score update
      if (linesClearedThisTurn === 1) {
        score += 10;
      } else if (linesClearedThisTurn === 2) {
        score += 20;
      } else if (linesClearedThisTurn === 3) {
        score += 30;
      } else if (linesClearedThisTurn === 4) {
        score += 50; // TETRIS Bonus
        tetrisMessageTimer = 40; 
      }

      if (linesClearedThisTurn > 0) {
         if(scoreP) scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
      }
    }
  }

  // 4. Prepare Grid for Drawing (Rows and Block)
  let RaB = rows.map(row => [...row]);
  if (block) {
    for (let y = 0; y < block[0].length; y++) {
      for (let x = 0; x < block[0][y].length; x++) {
        if (block[0][y][x] === 1) {
          if (RaB[block[2] + y]) {
             RaB[block[2] + y][block[1] + x] = 1;
          }
        }
      }
    }
  }

  // 5. Draw Blocks
  ctx.fillStyle = fixedPalette.fill;
  ctx.strokeStyle = fixedPalette.stroke;
  ctx.lineWidth = 1;
  ctx.shadowColor = fixedPalette.shadow;
  ctx.shadowBlur = 5;

  const size = box - 3;
  const offset = 1.5; 

  for (let y = 0; y < RaB.length; y++) {
    for (let x = 0; x < RaB[y].length; x++) {
      if (RaB[y][x] === 1) {
        ctx.fillRect(x * box + offset, y * box + offset, size, size);
        ctx.strokeRect(x * box + offset, y * box + offset, size, size);
      }
    }
  }
  
  // 6. Draw "TETRIS!" message
  if (tetrisMessageTimer > 0) {
    ctx.fillStyle = 'yellow';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 5;
    ctx.fillText('TETRIS!', canvas.width / 2, canvas.height / 2);
    ctx.shadowBlur = 0;
    tetrisMessageTimer--; 
  }
  
  ctx.shadowBlur = 0;
  count -= 1;
}


// --- Modal and Event Handlers ---

function openModal() {
    if(simpleTetrisModal) simpleTetrisModal.style.display = 'flex';
    // Load high score and set button text when opening
    loadHighScore();
    if(startBtn) startBtn.textContent = 'Start';
}

function closeModal() {
    if(simpleTetrisModal) simpleTetrisModal.style.display = 'none';
    
    // Stop the game when closing
    if (game) {
      clearInterval(game);
      game = null;
    }
    block = null; // Clear active block
    
    // Clear canvas
    if (ctx) {
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
}

// Key Event Handlers (Only active when the modal is open)
document.addEventListener('keydown', event => {
  if (!simpleTetrisModal || simpleTetrisModal.style.display !== 'flex' || !game) return;

  if (
    ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'].includes(event.key) ||
    event.code === 'Space'
  ) {
    event.preventDefault();
  }
  if (event.key === 'ArrowLeft') moveLeft();
  if (event.key === 'ArrowRight') moveRight();
  if (event.code === 'Space') rotate();
  if (event.key === 'ArrowDown') fastFall = true;
});

document.addEventListener('keyup', event => {
  if (event.key === 'ArrowDown') fastFall = false;
});


// --- Initialization ---

document.addEventListener('DOMContentLoaded', function() {
    if (runSimpleTetrisBtn) runSimpleTetrisBtn.addEventListener('click', openModal);
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
    if (startBtn) startBtn.addEventListener('click', start);
    if (controlsBtn) controlsBtn.addEventListener('click', function() {
      alert('Controls:\nRight Arrow: Move Right\nLeft Arrow: Move Left\nSpace Bar: Rotate\nDown Arrow: Speed Up Fall');
    });
    
    // Close modal if user clicks outside the content box
    if (simpleTetrisModal) {
        simpleTetrisModal.addEventListener('click', function(e) {
            if (e.target === simpleTetrisModal) {
                closeModal();
            }
        });
    }
    
    // Load high score on script load
    loadHighScore();
});
