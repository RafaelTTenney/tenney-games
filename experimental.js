// --- Initialize Supabase ---
const SUPABASE_URL = 'https://crvmgootjfbqkokrwsuu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNydm1nb290amZicWtva3J3c3V1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4MzkyNTQsImV4cCI6MjA3NjQxNTI1NH0.Em26tIW4z2ulfRePTOVhkCmcMGOa0OOjBqC3kPJ-LpU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Set-up
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const box = 24;
const speed = 50;
const scoreP = document.getElementById('score');

let fastFall = false;
let score = 0;


// High score
let highScore;

async function getHighScore() {
  const { data, error } = await supabaseClient
    .from('HighScores')
    .select('highScoreTetris')
    .eq('id', JSON.parse(localStorage.getItem('user')).id)
    .single();

  if (error) {
    console.error(error);
  } else {
    highScore = data.highScoreTetris;
  }
}

getHighScore().then(function() {
  scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
});

async function updateHighScore() {
  const { data, error } = await supabaseClient
    .from('HighScores')
    .update({ highScoreTetris: highScore })
    .eq('id', JSON.parse(localStorage.getItem('user')).id);

  if (error) {
    console.error(error);
  }
}

// In-game variables
let block;
let rows;
let game;
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
  // Rows
  rows = [];

  for (let i = 0; i < 20; i++) {
    let row = [];

    for (let x = 0; x < 10; x++) {
      row.push(0);
    }
  
    rows.push(row);
  }

  score = 0;
  
  scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore; 

  // Resets count
  count = 10;
  
  // Draws the frames of the game
  game = setInterval(drawFrame, speed);
}


// Rotate
function rotate() {
  block[0] = transpose(block[0]);
  block[0] = reverse(block[0]);

  if (isColliding(block)) {
    block[0] = reverse(block[0]);
    block[0] = transpose(block[0]);
  }
}


// Move
function moveRight() {
  block[1] += 1;

  if (isColliding(block)) {
    block[1] -= 1;
  }
}

function moveLeft() {
  block[1] -= 1;

  if (isColliding(block)) {
    block[1] += 1;
  }
}


// Checks keys
document.addEventListener('keydown', event => {
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

document.addEventListener('keyup', event => {if (event.key === 'ArrowDown') fastFall = false;});


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
        if (
          (B[1] + x) < 0 ||
          (B[1] + x) >= 10 ||
          (B[2] + y) >= 20
        ) {
          return true;
        }

        if (rows[B[2] + y][B[1] + x] === 1) {
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
    return;
  }
  
  // Clears frame
  ctx.fillStyle = 'rgb(255, 255, 255)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  
  // Gravity
  if (count === 0 || (fastFall && (count % 2 === 0))) {
    count = 10;
    block[2] += 1;
  
    // If the the block is colliding it gets set permentently in rows
    if (isColliding(block)) {
      block[2] -= 1;
      
      for (let y = 0; y < block[0].length; y++) {
        for (let x = 0; x < block[0][y].length; x++) {
          
          // Sets rows
          if (block[0][y][x] === 1) {
            rows[block[2] + y][block[1] + x] = 1;
          }
        }
      }
        
      block = null;
  
      for (let i = 0; i < 20; i++) {
        if (!rows[i].some(b => b === 0)) {
          rows.splice(i, 1);
  
          let row = []
  
          for (let x = 0; x < 10; x++) {
            row.push(0);
          }
          
          rows.unshift(row);
          
          score += 10;
          scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
        }
      }
    }
  }

  // Add blocks
  let RaB = rows.map(row => [...row]);

  if (block) {
    for (let y = 0; y < block[0].length; y++) {
      for (let x = 0; x < block[0][y].length; x++) {
        if (block[0][y][x] === 1) {
          RaB[block[2] + y][block[1] + x] = 1;
        }
      }
    }
  }

  for (let y = 0; y < RaB.length; y++) {
    for (let x = 0; x < RaB[y].length; x++) {
      if (RaB[y][x] === 1) {
        ctx.fillStyle = 'rgb(0, 120, 200)';
        ctx.fillRect(x * box, y * box, box, box);
      }
    }
  }

  // End game
  if (rows[0].some(b => b === 1)) {
    clearInterval(game);
    game = null;
    if (score > highScore) {
      alert('New high score!');
      highScore = score;

      updateHighScore().then(function() {
        scoreP.textContent = 'Score: ' + score + ' | High Score: ' + highScore;
      });
    }
  }

  count -= 1;
}


// Buttons
const homeBtn = document.getElementById('homeBtn');
const startBtn = document.getElementById('startBtn');
const controlsBtn = document.getElementById('controlsBtn');

homeBtn.addEventListener('click', function() {
  window.location.href = 'home.html';
});

startBtn.addEventListener('click', function() {
  if (!game) {
    start();
    startBtn.textContent = 'Restart';
  }
});  

controlsBtn.addEventListener('click', function() {
  alert('Controls:\nRight Arrow: Right\nLeft Arrow: Left\nSpace Bar: Rotate\nDown Arrow: Speed Up Fall');
});
