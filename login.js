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

function withTimeoutSignal(ms) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    stop: () => clearTimeout(timeoutId)
  };
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

async function directPasswordLogin(email, password) {
  const timer = withTimeoutSignal(8000);
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password }),
      signal: timer.signal
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json.error_description || json.error || json.message || `Login failed (${res.status}).`;
      throw new Error(msg);
    }
    return json;
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error('Login timed out. Check your connection.');
    }
    throw err;
  } finally {
    timer.stop();
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
    if (!online) {
      loginError.textContent = 'You appear to be offline.';
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
    let pending = true;
    const finish = () => {
      pending = false;
      if (slowTimer) clearTimeout(slowTimer);
    };
    if (loginError) loginError.textContent = 'Signing in...';
    let slowTimer = null;
    if (loginError) {
      slowTimer = setTimeout(() => {
        if (pending) loginError.textContent = 'Still signing in...';
      }, 4000);
    }
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const usesEmail = username.includes('@');
    let profile = null;
    if (!usesEmail) {
      try {
        profile = await getProfileByUsername(username);
      } catch (err) {
        if (loginError) loginError.textContent = err?.message || 'Login failed. Please try again.';
        finish();
        return;
      }
      if (!profile) {
        if (loginError) loginError.textContent = 'No account found for that username.';
        finish();
        return;
      }
    }
    try {
      const loginEmail = usesEmail ? username.trim() : profile?.email;
      if (!loginEmail) {
        if (loginError) loginError.textContent = 'No email found for that username.';
        finish();
        return;
      }
      const direct = await directPasswordLogin(loginEmail, password);
      const { error: setError } = await supabase.auth.setSession({
        access_token: direct.access_token,
        refresh_token: direct.refresh_token
      });
      if (setError) {
        throw setError;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        if (loginError) loginError.textContent = 'Login failed. Please try again.';
        finish();
        return;
      }
      await loadProfileForSession(session);
      finish();
      window.location.replace('loggedIn.html');
    } catch (err) {
      if (loginError) loginError.textContent = err?.message || 'Login failed. Please try again.';
      finish();
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
