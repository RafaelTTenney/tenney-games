// SHA-256 hashing function
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Store username/hash pairs for login (replace hashes with yours!)
const users = [
  // Example: admin / password: My$ecurePa$$w0rd
  { username: 'admin', hash: '96f460c55f7ab570cc0a46aafef0237f5bf7ad3564789f8c18dcb0f142be060a' },
  // Example: user1 / password: user1pass!
  { username: 'user1', hash: '0c9a9b735e7f94d8e3e2f3c1b6a8f0d812b3cc8da70a34e4a7e3a2c1a4e0f9b2' }
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
