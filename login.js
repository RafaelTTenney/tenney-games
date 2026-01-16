// login.js (Hardcoded accounts)
import { sha256 } from './sha256.js';

const users = [
  { username: 'admin', hash: '02079b31824a4d18a105f16b9d45e751a114ce5b4ff3d49c6f19633aed25abbc', accountStatus: 'admin', firstName: 'admin' },
  { username: 'amagee', hash: 'e52a1359297822655226696b53192f9085c5f161d1bda5cbaed8e9ceb64c904b', accountStatus: 'admin', firstName: 'Andrew' },
  { username: 'ccarty', hash: 'e3bd890850be9d6ffc4568c23a497e84fc8ed079ed196ce6d978a24a731f1de8', accountStatus: 'standard', firstName: 'Colleen' },
  { username: 'smartinez', hash: 'cfadedad585d18910973603153c102a1ab83edd78886db527315b07d0630281e', accountStatus: 'admin', firstName: 'Santi' },
  { username: 'rtenney', hash: 'd2809be3fe85fcf081294d173edc0580b93d17b8c6df3ccabc8b56d5b4f62714', accountStatus: 'advance', firstName: 'Robert' },
  { username: 'cdillon', hash: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', accountStatus: 'standard', firstName: 'Calvin' }
];

function normalizeUsername(value) {
  return (value || '').trim().toLowerCase();
}

function findUser(username) {
  const normalized = normalizeUsername(username);
  return users.find(u => u.username.toLowerCase() === normalized) || null;
}

function setSessionProfile(user) {
  localStorage.setItem('loggedIn', 'true');
  localStorage.setItem('username', user.username || '');
  localStorage.setItem('firstName', user.firstName || '');
  localStorage.setItem('accountStatus', user.accountStatus || 'standard');
}

function clearSessionProfile() {
  localStorage.removeItem('loggedIn');
  localStorage.removeItem('username');
  localStorage.removeItem('accountStatus');
  localStorage.removeItem('firstName');
}

function isLoggedIn() {
  return localStorage.getItem('loggedIn') === 'true';
}

async function logout() {
  clearSessionProfile();
  window.location.replace('index.html');
}

function getAccountStatus() {
  return localStorage.getItem('accountStatus') || null;
}

function isAdmin() { return getAccountStatus() === 'admin'; }
function isAdvance() { return getAccountStatus() === 'advance' || isAdmin(); }
function isStandard() { return getAccountStatus() === 'standard' || isAdvance() || isAdmin(); }

const PAGE_ACCESS = {
  'loggedin.html': ['standard', 'advance', 'admin'],
  'loggedIn.html': ['standard', 'advance', 'admin'],
  'menu-guesser.html': ['standard', 'advance', 'admin'],
  'multi-game.html': ['standard', 'advance', 'admin'],
  'preview-games.html': ['advance', 'admin'],
  'experimental.html': ['admin'],
  'admin.html': ['admin'],
  'profile.html': ['standard', 'advance', 'admin'],
  'upgrade-request.html': ['standard', 'advance', 'admin'],
  'modifiedgames.html': ['standard', 'advance', 'admin']
};

function pageNameFromPath(p) {
  if (!p) return '';
  try {
    const u = new URL(p, window.location.origin);
    const parts = u.pathname.split('/');
    return parts[parts.length - 1] || parts[parts.length - 2] || '';
  } catch (e) {
    const parts = p.split('/');
    return parts[parts.length - 1];
  }
}

function canAccessPage(pathOrName) {
  const page = pageNameFromPath(pathOrName).toLowerCase();
  if (!page) return false;
  const allowed = PAGE_ACCESS[page];
  if (!allowed) return isLoggedIn();
  const status = getAccountStatus();
  return isLoggedIn() && allowed.includes(status);
}

function enforcePageAccess(pathOrName) {
  if (!isLoggedIn()) {
    window.location.replace('index.html');
    return false;
  }
  if (!canAccessPage(pathOrName)) {
    window.location.replace('loggedIn.html');
    return false;
  }
  return true;
}

function adminSetAccountStatus(username, newStatus) {
  const user = findUser(username);
  if (!user) return false;
  user.accountStatus = newStatus;
  const current = localStorage.getItem('username');
  if (current === user.username) {
    localStorage.setItem('accountStatus', newStatus);
  }
  return true;
}

function getHardcodedUsers() {
  return users.map(u => ({
    username: u.username,
    account_status: u.accountStatus || 'standard'
  }));
}

document.addEventListener('DOMContentLoaded', function () {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  const loginError = document.getElementById('loginError');
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (loginError) loginError.textContent = 'Signing in...';

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const user = findUser(username);
    if (!user) {
      if (loginError) loginError.textContent = 'No account found for that username.';
      return;
    }

    try {
      const hash = await sha256(password);
      if (hash !== user.hash) {
        if (loginError) loginError.textContent = 'Incorrect password.';
        return;
      }
      setSessionProfile(user);
      window.location.replace('loggedIn.html');
    } catch (err) {
      if (loginError) loginError.textContent = 'Login failed. Please try again.';
    }
  });
});

window.isLoggedIn = isLoggedIn;
window.logout = logout;
window.getAccountStatus = getAccountStatus;
window.isAdmin = isAdmin;
window.isAdvance = isAdvance;
window.isStandard = isStandard;
window.canAccessPage = canAccessPage;
window.enforcePageAccess = enforcePageAccess;
window.adminSetAccountStatus = adminSetAccountStatus;
window.getHardcodedUsers = getHardcodedUsers;
