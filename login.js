// Supabase-powered auth helpers for the site.
// This file keeps the same helper names the rest of the pages already use
// (isLoggedIn, logout, etc.) but now backs them with Supabase Auth.

function isLoggedIn() {
  return localStorage.getItem('loggedIn') === 'true' && !!localStorage.getItem('user');
}

function logout() {
  localStorage.removeItem('loggedIn');
  localStorage.removeItem('user');
  localStorage.removeItem('username');
  localStorage.removeItem('firstName');
  localStorage.removeItem('accountStatus');
  localStorage.removeItem('accountStatusOverrides');
  if (window.supabaseClient) {
    window.supabaseClient.auth.signOut();
  }
  window.location.replace('index.html');
}

function getAccountStatus() {
  return localStorage.getItem('accountStatus') || 'standard';
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
  'upgrade-request.html': ['standard', 'advance', 'admin']
};

function pageNameFromPath(p) {
  if (!p) return '';
  const parts = p.split('/');
  return parts[parts.length - 1];
}

function canAccessPage(pathOrName) {
  const page = pageNameFromPath(pathOrName).toLowerCase();
  const allowed = PAGE_ACCESS[page];
  if (!allowed) return isLoggedIn();
  return isLoggedIn() && allowed.includes(getAccountStatus());
}

function enforcePageAccess(pathOrName) {
  if (!isLoggedIn()) {
    window.location.replace('login.html');
    return false;
  }
  if (!canAccessPage(pathOrName)) {
    window.location.replace('loggedIn.html');
    return false;
  }
  return true;
}

function adminSetAccountStatusOverride(username, newStatus) {
  try {
    const raw = localStorage.getItem('accountStatusOverrides');
    const overrides = raw ? JSON.parse(raw) : {};
    overrides[username] = newStatus;
    localStorage.setItem('accountStatusOverrides', JSON.stringify(overrides));
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

async function handleAuth(type, email, password, firstName) {
  if (!window.supabaseClient) throw new Error('Supabase not initialized');
  const trimmedEmail = email.trim();
  const trimmedPassword = password.trim();
  if (!trimmedEmail || !trimmedPassword) {
    throw new Error('Please fill in both email and password.');
  }
  if (type === 'signup') {
    const metadata = firstName ? { firstName } : {};
    return window.supabaseClient.auth.signUp({
      email: trimmedEmail,
      password: trimmedPassword,
      options: { data: metadata }
    });
  }
  return window.supabaseClient.auth.signInWithPassword({ email: trimmedEmail, password: trimmedPassword });
}

async function finishLogin(user, firstNameFromForm = '') {
  if (!user) return;
  const startingFirst = firstNameFromForm || (user.user_metadata && user.user_metadata.firstName) || '';
  await window.supabaseHelpers.ensureHighScoreRow(user, startingFirst);
  let status = 'standard';
  let firstName = startingFirst;
  if (window.supabaseHelpers && window.supabaseHelpers.fetchAccountProfile) {
    const profile = await window.supabaseHelpers.fetchAccountProfile(user.id);
    if (profile && profile['acess-level']) {
      status = profile['acess-level'];
    }
    if (profile && (profile.firstName || profile.firstname)) {
      firstName = profile.firstName || profile.firstname;
    }
  }
  window.supabaseHelpers.storeUserSession(user, status, firstName);
  window.location.replace('loggedIn.html');
}

document.addEventListener('DOMContentLoaded', function () {
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const signupBtn = document.getElementById('signupBtn');
  const loginBtn = document.getElementById('loginBtn');

  if (!loginForm) return;

  async function authFlow(mode) {
    loginError.textContent = '';
    try {
      const email = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const { data, error } = await handleAuth(mode, email, password);
      if (error) {
        loginError.textContent = error.message;
        return;
      }
      const user = data && data.user;
      if (user) {
        await finishLogin(user);
      } else {
        loginError.textContent = 'No user returned from Supabase.';
      }
    } catch (err) {
      loginError.textContent = err.message || 'Unexpected error';
    }
  }

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    authFlow('login');
  });

  if (signupBtn) {
    signupBtn.addEventListener('click', function (e) {
      e.preventDefault();
      authFlow('signup');
    });
  }

  if (loginBtn) {
    loginBtn.addEventListener('click', function (e) {
      e.preventDefault();
      authFlow('login');
    });
  }
});
