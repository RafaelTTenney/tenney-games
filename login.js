import { auth, db, hasFirebaseConfig, waitForAuth } from './firebase.js';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

let currentProfile = null;
let authReadyResolve = null;
let authReadyResolved = false;
const whenAuthReady = new Promise((resolve) => {
  authReadyResolve = resolve;
});

function normalizeUsernameFromEmail(email) {
  if (!email) return '';
  return email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function setSessionProfile(profile, user) {
  const username = profile?.username || normalizeUsernameFromEmail(user?.email);
  const firstName = profile?.first_name || profile?.firstName || '';
  const status = profile?.account_status || 'standard';
  localStorage.setItem('loggedIn', 'true');
  localStorage.setItem('username', username || '');
  localStorage.setItem('firstName', firstName || '');
  localStorage.setItem('accountStatus', status);
  localStorage.setItem('email', user?.email || profile?.email || '');
}

function clearSessionProfile() {
  localStorage.removeItem('loggedIn');
  localStorage.removeItem('username');
  localStorage.removeItem('accountStatus');
  localStorage.removeItem('firstName');
  localStorage.removeItem('email');
}

function resolveAuthReady(user) {
  if (authReadyResolved) return;
  authReadyResolved = true;
  if (authReadyResolve) authReadyResolve(user || null);
}

async function ensureProfile(user) {
  if (!user) return null;
  const profileRef = doc(db, 'profiles', user.uid);
  const snap = await getDoc(profileRef);
  if (snap.exists()) {
    return { uid: user.uid, email: user.email || '', ...snap.data() };
  }
  const fallback = {
    email: user.email || '',
    username: normalizeUsernameFromEmail(user.email),
    first_name: '',
    last_name: '',
    account_status: 'standard',
    createdAt: serverTimestamp()
  };
  await setDoc(profileRef, fallback, { merge: true });
  return { uid: user.uid, ...fallback };
}

function getProfile() {
  if (currentProfile) return currentProfile;
  return {
    username: localStorage.getItem('username') || '',
    first_name: localStorage.getItem('firstName') || '',
    account_status: localStorage.getItem('accountStatus') || 'standard',
    email: localStorage.getItem('email') || ''
  };
}

function isLoggedIn() {
  return !!auth.currentUser || localStorage.getItem('loggedIn') === 'true';
}

function getAccountStatus() {
  const profile = getProfile();
  return profile.account_status || 'standard';
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

async function logout() {
  clearSessionProfile();
  if (hasFirebaseConfig()) {
    try { await signOut(auth); } catch (err) {}
  }
  window.location.replace('index.html');
}

onAuthStateChanged(auth, async (user) => {
  if (!user || !hasFirebaseConfig()) {
    currentProfile = null;
    clearSessionProfile();
    resolveAuthReady(null);
    return;
  }
  try {
    const profile = await ensureProfile(user);
    currentProfile = profile;
    setSessionProfile(profile, user);
  } catch (err) {
    currentProfile = null;
    clearSessionProfile();
  }
  resolveAuthReady(user);
});

document.addEventListener('DOMContentLoaded', async function () {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;
  const loginError = document.getElementById('loginError');

  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (loginError) loginError.textContent = 'Signing in...';
    if (!hasFirebaseConfig()) {
      if (loginError) loginError.textContent = 'Firebase is not configured.';
      return;
    }
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    if (!email || !password) {
      if (loginError) loginError.textContent = 'Email and password are required.';
      return;
    }

    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);
      const profile = await ensureProfile(user);
      currentProfile = profile;
      setSessionProfile(profile, user);
      window.location.replace('loggedIn.html');
    } catch (err) {
      if (loginError) loginError.textContent = err.message || 'Login failed. Please try again.';
    }
  });
});

window.whenAuthReady = whenAuthReady;
window.waitForAuth = waitForAuth;
window.getProfile = getProfile;
window.isLoggedIn = isLoggedIn;
window.logout = logout;
window.getAccountStatus = getAccountStatus;
window.isAdmin = isAdmin;
window.isAdvance = isAdvance;
window.isStandard = isStandard;
window.canAccessPage = canAccessPage;
window.enforcePageAccess = enforcePageAccess;
