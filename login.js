// login.js (Supabase-backed)
// Adds accountStatus support and role-based access helpers.

import { supabase, hasSupabaseConfig, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js';

window.supabaseClient = supabase;

function setSessionProfile(profile) {
  localStorage.setItem('loggedIn', 'true');
  localStorage.setItem('username', profile.username || '');
  localStorage.setItem('firstName', profile.first_name || '');
  localStorage.setItem('accountStatus', profile.account_status || 'standard');
}

function clearSessionProfile() {
  localStorage.removeItem('loggedIn');
  localStorage.removeItem('username');
  localStorage.removeItem('accountStatus');
  localStorage.removeItem('firstName');
}

async function loadProfileForSession(session) {
  if (!session || !session.user) {
    clearSessionProfile();
    return null;
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('username, first_name, account_status')
    .eq('id', session.user.id)
    .limit(1);
  const profile = data && data.length ? data[0] : null;
  if (error || !profile) {
    clearSessionProfile();
    return null;
  }
  setSessionProfile(profile);
  return profile;
}

async function refreshSessionProfile() {
  if (!hasSupabaseConfig()) return null;
  const { data } = await supabase.auth.getSession();
  return loadProfileForSession(data.session);
}

async function getProfileByUsername(username) {
  const normalized = (username || '').trim().toLowerCase();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, username, first_name, account_status')
    .eq('username', normalized)
    .limit(1);
  if (error) return null;
  return data && data.length ? data[0] : null;
}

function withTimeout(promise, ms, label) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(label || 'Request timed out.'));
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

async function checkSupabaseReachable() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles?select=id&limit=1`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      },
      signal: controller.signal
    });
    return res.ok || res.status === 401 || res.status === 403 || res.status === 406;
  } catch (err) {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function checkAuthHealth() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      },
      signal: controller.signal
    });
    return res.ok;
  } catch (err) {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isLoggedIn() {
  return localStorage.getItem('loggedIn') === 'true';
}
async function logout() {
  if (hasSupabaseConfig()) {
    await supabase.auth.signOut();
  }
  clearSessionProfile();
  window.location.replace('index.html');
}
function getAccountStatus() {
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

// Admin utility: set account status in Supabase
async function adminSetAccountStatus(username, newStatus) {
  const { error } = await supabase
    .from('profiles')
    .update({ account_status: newStatus })
    .eq('username', username);
  if (error) {
    console.error('Error saving account status', error);
    return false;
  }
  const current = localStorage.getItem('username');
  if (current === username) {
    localStorage.setItem('accountStatus', newStatus);
  }
  return true;
}

document.addEventListener('DOMContentLoaded', function () {
  if (hasSupabaseConfig()) {
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        await loadProfileForSession(session);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await loadProfileForSession(data.session);
        return;
      }
      clearSessionProfile();
    });
    refreshSessionProfile();
  }
  // Login form behavior (if exists on page)
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) {
    // Nothing to do here if there's no login form
    return;
  }
  const loginError = document.getElementById('loginError');
  if (loginError) {
    const online = navigator.onLine !== false;
    const healthy = await checkAuthHealth();
    if (!online) {
      loginError.textContent = 'You appear to be offline.';
    } else if (!healthy) {
      loginError.textContent = 'Cannot reach Supabase auth. Check blockers or network.';
    } else {
      loginError.textContent = '';
    }
  }
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!hasSupabaseConfig()) {
      if (loginError) loginError.textContent = 'Supabase is not configured.';
      return;
    }
    if (loginError) loginError.textContent = 'Signing in...';
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const usesEmail = username.includes('@');
    let profile = null;
    if (!usesEmail) {
      try {
        profile = await withTimeout(getProfileByUsername(username), 8000, 'Login timed out. Check your connection.');
      } catch (err) {
        const reachable = await checkSupabaseReachable();
        if (loginError) {
          loginError.textContent = reachable
            ? (err?.message || 'Login failed. Please try again.')
            : 'Cannot reach Supabase. Disable blockers or check your connection.';
        }
        return;
      }
      if (!profile) {
        if (loginError) loginError.textContent = 'No account found for that username.';
        return;
      }
    }
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signInWithPassword({
          email: usesEmail ? username.trim() : profile.email,
          password
        }),
        8000,
        'Login timed out. Check your connection.'
      );
      if (error || !data.session) {
        if (loginError) loginError.textContent = error?.message || 'Invalid username or password.';
        return;
      }
      await loadProfileForSession(data.session);
      window.location.replace('loggedIn.html');
    } catch (err) {
      if (loginError) loginError.textContent = err?.message || 'Login failed. Please try again.';
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
