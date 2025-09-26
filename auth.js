// auth.js

// Hardcoded users and password (insecure for real use!)
const users = {
  'admin': '123456',
  'user1': '123456'
};

// Store session info in sessionStorage
function isLoggedIn() {
  return sessionStorage.getItem("loggedInUser");
}

function login(username, password) {
  if (users[username] && users[username] === password) {
    sessionStorage.setItem("loggedInUser", username);
    return true;
  }
  return false;
}

function logout() {
  sessionStorage.removeItem("loggedInUser");
  window.location.href = "index.html";
}

// Login page logic
if (document.getElementById("loginForm")) {
  document.getElementById("loginForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    if (login(username, password)) {
      window.location.href = "downloads.html";
    } else {
      document.getElementById("errorMsg").textContent = "Invalid username or password.";
    }
  });
}

// Downloads page protection
if (window.location.pathname.endsWith("downloads.html")) {
  if (!isLoggedIn()) {
    window.location.href = "index.html";
  }
}
