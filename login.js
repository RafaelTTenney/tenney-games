async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const users = [
  { username: 'admin', hash: '02079b31824a4d18a105f16b9d45e751a114ce5b4ff3d49c6f19633aed25abbc' },
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
  if (!loginForm) {
    console.error('Login form not found!');
    return;
  }
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
});
