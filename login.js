// login.js (updated)
// Adds accountStatus support and role-based access helpers.

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Note: accountStatus values: 'standard', 'advance', 'admin'
const users = [
  { username: 'admin', hash: '02079b31824a4d18a105f16b9d45e751a114ce5b4ff3d49c6f19633aed25abbc', accountStatus: 'admin', firstName: 'admin' },
  { username: 'amagee', hash: 'e52a1359297822655226696b53192f9085c5f161d1bda5cbaed8e9ceb64c904b', accountStatus: 'standard', firstName: 'Andrew' },
  { username: 'ccarty', hash: 'e3bd890850be9d6ffc4568c23a497e84fc8ed079ed196ce6d978a24a731f1de8', accountStatus: 'standard', firstName: 'Colleen' },
  { username: 'smartinez', hash: 'cfadedad585d18910973603153c102a1ab83edd78886db527315b07d0630281e', accountStatus: 'admin', firstName: 'Santi' }
];

function isLoggedIn() {
  return localStorage.getItem('loggedIn') === 'true';
}
function logout() {
  localStorage.removeItem('loggedIn');
  localStorage.removeItem('username');
  localStorage.removeItem('accountStatus');
  localStorage.removeItem('firstName');
  // Also remove any admin-managed overrides stored locally
  // (keeps behavior predictable when testing)
  // DO NOT clear other app data if used elsewhere.
  window.location.replace('index.html');
}
function getAccountStatus() {
  // First check override map (admin edits saved to localStorage)
  // Stored structure: { username: status, ... } as JSON string under 'accountStatusOverrides'
  try {
    const username = localStorage.getItem('username');
    if (!username) return null;
    const overridesRaw = localStorage.getItem('accountStatusOverrides');
    if (overridesRaw) {
      const overrides = JSON.parse(overridesRaw);
      if (overrides && overrides[username]) {
        return overrides[username];
      }
    }
  } catch (e) {
    console.error('Error reading accountStatusOverrides', e);
  }
  // Otherwise use stored session accountStatus (set at login)
  return localStorage.getItem('accountStatus') || null;
}
function isAdmin() { return getAccountStatus() === 'admin'; }
function isAdvance() { return getAccountStatus() === 'advance' || isAdmin(); }
function isStandard() { return getAccountStatus() === 'standard' || isAdvance() || isAdmin(); }

// Page access map
const PAGE_ACCESS = {
  'loggedin.html': ['standard', 'advance', 'admin'],
  'loggedIn.html': ['standard', 'advance', 'admin'],
  'menu-guesser.html': ['standard', 'advance', 'admin'],
  'multi-game.html': ['standard', 'advance', 'admin'],
  'preview-games.html': ['advance', 'admin'],
  'experimental.html': ['admin'],
  'admin.html': ['admin'],
  'profile.html': ['standard', 'advance', 'admin'],
  'upgrade-request.html': ['standard', 'advance', 'admin']
};

function pageNameFromPath(p) {
  if (!p) return '';
  try {
    const u = new URL(p, window.location.origin);
    const parts = u.pathname.split('/');
    return parts[parts.length - 1] || parts[parts.length - 2] || '';
  } catch (e) {
    // fallback: try split
    const parts = p.split('/');
    return parts[parts.length - 1];
  }
}

function canAccessPage(pathOrName) {
  const page = pageNameFromPath(pathOrName).toLowerCase();
  if (!page) return false;
  const allowed = PAGE_ACCESS[page];
  if (!allowed) {
    // If page not listed, default to require login only
    return isLoggedIn();
  }
  const status = getAccountStatus();
  return isLoggedIn() && allowed.includes(status);
}

// Helper to use in pages: if canAccessPage(...) === false, redirect to loggedIn.html or index.
function enforcePageAccess(pathOrName) {
  if (!isLoggedIn()) {
    window.location.replace('index.html');
    return false;
  }
  if (!canAccessPage(pathOrName)) {
    // Not allowed to view this page — send back to dashboard
    window.location.replace('loggedIn.html');
    return false;
  }
  return true;
}

// Admin utility: set override statuses (persisted to localStorage)
function adminSetAccountStatusOverride(username, newStatus) {
  try {
    const raw = localStorage.getItem('accountStatusOverrides');
    const overrides = raw ? JSON.parse(raw) : {};
    overrides[username] = newStatus;
    localStorage.setItem('accountStatusOverrides', JSON.stringify(overrides));
    // If the currently logged-in user is the one changed, update session accountStatus
    const current = localStorage.getItem('username');
    if (current === username) {
      localStorage.setItem('accountStatus', newStatus);
    }
    return true;
  } catch (e) {
    console.error('Error saving account status override', e);
    return false;
  }
}

document.addEventListener('DOMContentLoaded', function () {
  // Login form behavior (if exists on page)
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) {
    // Nothing to do here if there's no login form
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
      localStorage.setItem('username', username);
      localStorage.setItem('firstName', user.firstName);
      // Save initial accountStatus from users array (session); admin may override later
      localStorage.setItem('accountStatus', user.accountStatus || 'standard');
      // Redirect to the new loggedIn landing page
      window.location.replace('loggedIn.html');
    } else {
      document.getElementById('loginError').textContent = 'Invalid username or password.';
    }
  });
});
