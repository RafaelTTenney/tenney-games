// login.js (Supabase-backed)
// Adds accountStatus support and role-based access helpers.

import { supabase, hasSupabaseConfig } from './supabase.js';

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
    .single();
  if (error || !data) {
    clearSessionProfile();
    return null;
  }
  setSessionProfile(data);
  return data;
}

async function refreshSessionProfile() {
  if (!hasSupabaseConfig()) return null;
  const { data } = await supabase.auth.getSession();
  return loadProfileForSession(data.session);
}

async function getProfileByUsername(username) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, username, first_name, account_status')
    .eq('username', username)
    .single();
  if (error) return null;
  return data;
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
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        loadProfileForSession(session);
      } else {
        clearSessionProfile();
      }
    });
    refreshSessionProfile();
  }
  // Login form behavior (if exists on page)
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) {
    // Nothing to do here if there's no login form
    return;
  }
  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!hasSupabaseConfig()) {
      document.getElementById('loginError').textContent = 'Supabase is not configured.';
      return;
    }
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const profile = await getProfileByUsername(username);
    if (!profile) {
      document.getElementById('loginError').textContent = 'Invalid username or password.';
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: profile.email,
      password
    });
    if (error || !data.session) {
      document.getElementById('loginError').textContent = 'Invalid username or password.';
      return;
    }
    setSessionProfile(profile);
    window.location.replace('loggedIn.html');
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
