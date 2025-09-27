// SHA-256 hashing function
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Store username/hash pairs for login (replace hashes with yours!)
const users = [
  // Example: admin / password: My$ecurePa$$word
  { username: 'admin', hash: '02079b31824a4d18a105f16b9d45e751a114ce5b4ff3d49c6f19633aed25abbc' },
  // Example: user1 / password: user1pass!
  { username: 'user1', hash: '6b6197ff809a6ec0af1ba56a0f5c02a2eb5cd6605a2d39b42263bea3070e2e7c' }
];

function isLoggedIn() {
  return localStorage.getItem('loggedIn') === 'true';
}

function logout() {
  localStorage.removeItem('loggedIn');
  window.location.replace('index.html');
}

document.addEventListener('DOMContentLoaded', function () {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const user = users.find(u => u.username === username);
      if (!user) {
        document.getElementById('loginError').textContent = 'Invalid username or password.';
        return;
      }
      const inputHash = await sha256(password);
      if (inputHash === user.hash) {
        localStorage.setItem('loggedIn', 'true');
        window.location.replace('menu-guesser.html');
      } else {
        document.getElementById('loginError').textContent = 'Invalid username or password.';
      }
    });
  }
});

// --- Menu Guesser logic placeholder ---
function showMenuGuesser() {
  const app = document.getElementById('guesserApp');
  app.innerHTML = `
    <p>Menu Guesser goes here!</p>
    <!-- Insert your menu guesser code and UI here -->
  `;
}
