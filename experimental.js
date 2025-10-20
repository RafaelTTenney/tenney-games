// --- TETRIS GAME SCRIPT ---

// Get modal elements
const tetrisModal = document.getElementById('tetrisModal');
const runTetrisBtn = document.getElementById('runTetrisBtn');
const modalCloseBtn = document.getElementById('modalCloseBtn');

// Get game elements (INSIDE the modal)
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const scoreP = document.getElementById('score');
const startBtn = document.getElementById('startBtn');
const controlsBtn = document.getElementById('controlsBtn');

const box = 24;
const speed = 50; // Milliseconds per frame

let fastFall = false;
let score = 0;
let highScore;

// High score (localStorage version)
function loadHighScore() {
  highScore = parseInt(localStorage.getItem('tetrisHighScore')) || 0;
  scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
}

function saveHighScore() {
  localStorage.setItem('tetrisHighScore', highScore);
  scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
}

// Load high score on script start
loadHighScore();

// In-game variables
let block;
let rows;
let game; // This will hold the setInterval ID
let count;

// Block types
const blocks = {
  0: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  1: [
    [1, 1],
    [1, 1]
  ],
  2: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  3: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],
  4: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ],
  5: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  6: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ]
};

function start() {
  // Rows (10 wide, 20 high)
  rows = [];
  for (let i = 0; i < 20; i++) {
    let row = [];
    for (let x = 0; x < 10; x++) {
      row.push(0);
    }
    rows.push(row);
  }

  score = 0;
  loadHighScore(); // Resets score text

  // Resets count
  count = 10;
  
  // Clear any existing game loop
  if (game) {
    clearInterval(game);
  }

  // Draws the frames of the game
  game = setInterval(drawFrame, speed);
  startBtn.textContent = 'Restart';
}


// Rotate
function rotate() {
  if (!block) return;
  block[0] = transpose(block[0]);
  block[0] = reverse(block[0]);

  if (isColliding(block)) {
    block[0] = reverse(block[0]);
    block[0] = transpose(block[0]);
  }
}


// Move
function moveRight() {
  if (!block) return;
  block[1] += 1;
  if (isColliding(block)) {
    block[1] -= 1;
  }
}

function moveLeft() {
  if (!block) return;
  block[1] -= 1;
  if (isColliding(block)) {
    block[1] += 1;
  }
}

// Transposes rows and columns in a 2d matrix
function transpose(L) {
  let final = [];
  for (let i = 0; i < L[0].length; i++) {
    final.push([]);
  }
  for (let i = 0; i < L.length; i++) {
    for (let x = 0; x < L[i].length; x++) {
      final[x].push(L[i][x]);
    }
  }
  return final;
}


// Reverse the values of the rows of a 2d matrix
function reverse(L) {
  for (let i = 0; i < L.length; i++) {
    L[i].reverse();
  }
  return L;
}


// Checks Collisions
function isColliding(B) {
  for (let y = 0; y < B[0].length; y++) {
    for (let x = 0; x < B[0][y].length; x++) {
      if (B[0][y][x] === 1) {
        // Check boundaries
        if (
          (B[1] + x) < 0 ||    // Left wall
          (B[1] + x) >= 10 ||   // Right wall
          (B[2] + y) >= 20    // Bottom wall
        ) {
          return true;
        }
        
        // Check against other blocks (if row exists)
        if (rows[B[2] + y] && rows[B[2] + y][B[1] + x] === 1) {
          return true;
        }
      }
    }
  }
  return false;
}


// Draws a frame
function drawFrame() {
  // Creates a falling block if none already exist
  if (!block) {
    block = [blocks[Math.floor(Math.random() * 7)], 4, 0];
    // Check for game over on new block spawn
    if (isColliding(block)) {
      clearInterval(game);
      game = null;
      startBtn.textContent = 'Start';
      if (score > highScore) {
        alert('Game Over! New high score: ' + score);
        highScore = score;
        saveHighScore();
      } else {
         alert('Game Over! Score: ' + score);
      }
      return; // Stop the frame draw
    }
    return;
  }
  
  // Clears frame to neon background
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Gravity
  if (count === 0 || (fastFall && (count % 2 === 0))) {
    count = 10;
    block[2] += 1; // Move block down
    
    // If the the block is colliding, set it permanently
    if (isColliding(block)) {
      block[2] -= 1; // Move it back up
      
      for (let y = 0; y < block[0].length; y++) {
        for (let x = 0; x < block[0][y].length; x++) {
          if (block[0][y][x] === 1) {
            // Set block in rows grid
            if (rows[block[2] + y]) {
               rows[block[2] + y][block[1] + x] = 1;
            }
          }
        }
      }
      
      block = null; // Get a new block next frame
      
      // Check for completed rows
      for (let i = 0; i < 20; i++) {
        if (rows[i] && !rows[i].some(b => b === 0)) {
          rows.splice(i, 1); // Remove full row
          
          // Add a new empty row at the top
          let row = []
          for (let x = 0; x < 10; x++) {
            row.push(0);
          }
          rows.unshift(row);
          
          score += 10;
          scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
          
          // Re-check this index
          i--;
        }
      }
    }
  }

  // Add active block to a temporary render grid
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

  // Render the grid
  ctx.fillStyle = '#00FFFF'; // Neon Cyan
  ctx.strokeStyle = '#33FFFF';
  ctx.lineWidth = 1;
  ctx.shadowColor = '#00FFFF';
  ctx.shadowBlur = 5;

  for (let y = 0; y < RaB.length; y++) {
    for (let x = 0; x < RaB[y].length; x++) {
      if (RaB[y][x] === 1) {
        ctx.fillRect(x * box, y * box, box - 1, box - 1);
        ctx.strokeRect(x * box, y * box, box - 1, box - 1);
      }
    }
  }
  
  // Reset shadow for next frame
  ctx.shadowBlur = 0;

  count -= 1;
}


// --- Modal and Game Listeners ---

// Checks keys (only when modal is open)
document.addEventListener('keydown', event => {
  // Don't run game logic if modal is closed
  if (tetrisModal.style.display !== 'flex' || !game) return;

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

// Modal Control Buttons
startBtn.addEventListener('click', function() {
  start();
});

controlsBtn.addEventListener('click', function() {
  alert('Controls:\nRight Arrow: Right\nLeft Arrow: Left\nSpace Bar: Rotate\nDown Arrow: Speed Up Fall');
});

// Modal Open/Close Logic
runTetrisBtn.addEventListener('click', function(e) {
  e.preventDefault();
  tetrisModal.style.display = 'flex';
  // Reset score text when opening
  loadHighScore(); 
  startBtn.textContent = 'Start';
});

function closeModal() {
  tetrisModal.style.display = 'none';
  // Stop the game when closing
  if (game) {
    clearInterval(game);
    game = null;
  }
  block = null; // Clear active block
  // Clear canvas
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

modalCloseBtn.addEventListener('click', closeModal);

// Also close if user clicks outside the modal content
tetrisModal.addEventListener('click', function(e) {
  if (e.target === tetrisModal) {
    closeModal();
  }
});
