// login.js
// Handles Supabase authentication, profile caching, and role-based page access.

const DEFAULT_ACCOUNT_STATUS = 'standard';
const AUTH_STORAGE_KEYS = ['loggedIn', 'username', 'accountStatus', 'firstName', 'userId', 'email', 'profileData'];

const supabaseClientInstance = (() => {
  if (typeof window !== 'undefined' && window.supabaseClient) {
    return window.supabaseClient;
  }
  console.error('Supabase client not found. Make sure supabase-client.js is loaded before login.js.');
  return null;
})();

const authState = {
  ready: false,
  promise: null
};

function clearLocalAuth() {
  AUTH_STORAGE_KEYS.forEach(key => localStorage.removeItem(key));
}

function cacheProfileLocally(session, profile) {
  if (!session || !profile) return;
  localStorage.setItem('loggedIn', 'true');
  localStorage.setItem('userId', session.user.id);
  localStorage.setItem('email', session.user.email || '');
  localStorage.setItem('username', profile.username || '');
  localStorage.setItem('firstName', profile.first_name || profile.username || 'Player');
  localStorage.setItem('accountStatus', profile.account_status || DEFAULT_ACCOUNT_STATUS);
  localStorage.setItem('profileData', JSON.stringify(profile));
}

function profileFromStorage() {
  const raw = localStorage.getItem('profileData');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Unable to parse cached profile data', err);
    return null;
  }
}

async function ensureProfileForSession(session) {
  if (!supabaseClientInstance || !session) return null;
  const user = session.user;
  let { data: profile, error } = await supabaseClientInstance
    .from('profiles')
    .select('id, username, first_name, last_name, account_status, email')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error loading profile', error);
    return null;
  }

  if (!profile) {
    const metadata = user.user_metadata || {};
    const username = (metadata.username || (user.email ? user.email.split('@')[0] : 'player')).toLowerCase();
    const firstName = metadata.first_name || metadata.firstName || username;
    const lastName = metadata.last_name || metadata.lastName || '';
    const insertPayload = {
      id: user.id,
      username,
      first_name: firstName,
      last_name: lastName,
      email: user.email,
      account_status: DEFAULT_ACCOUNT_STATUS
    };
    const insertResult = await supabaseClientInstance
      .from('profiles')
      .insert(insertPayload)
      .select()
      .maybeSingle();
    if (insertResult.error) {
      console.error('Error creating profile row', insertResult.error);
      return null;
    }
    profile = insertResult.data;
  }

  return profile;
}

async function refreshSessionCache(sessionOverride) {
  if (!supabaseClientInstance) return null;
  try {
    const session = sessionOverride || (await supabaseClientInstance.auth.getSession()).data.session;
    if (!session) {
      clearLocalAuth();
      return null;
    }
    const profile = await ensureProfileForSession(session);
    if (!profile) {
      clearLocalAuth();
      return null;
    }
    cacheProfileLocally(session, profile);
    return { session, profile };
  } catch (err) {
    console.error('Failed to refresh session cache', err);
    clearLocalAuth();
    return null;
  }
}

authState.promise = (async () => {
  await refreshSessionCache();
  authState.ready = true;
})();

function waitForAuthReady() {
  return authState.promise || Promise.resolve();
}

if (supabaseClientInstance) {
  supabaseClientInstance.auth.onAuthStateChange(async (_event, session) => {
    await refreshSessionCache(session);
    authState.ready = true;
  });
}

function isLoggedIn() {
  return localStorage.getItem('loggedIn') === 'true';
}

async function logout() {
  if (supabaseClientInstance) {
    await supabaseClientInstance.auth.signOut();
  }
  clearLocalAuth();
  window.location.replace('index.html');
}

function getAccountStatus() {
  return localStorage.getItem('accountStatus') || DEFAULT_ACCOUNT_STATUS;
}

function isAdmin() {
  return getAccountStatus() === 'admin';
}

function isAdvance() {
  const status = getAccountStatus();
  return status === 'advance' || status === 'admin';
}

function isStandard() {
  return isLoggedIn();
}

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

function pageNameFromPath(path) {
  if (!path) return '';
  try {
    const u = new URL(path, window.location.origin);
    const parts = u.pathname.split('/');
    return parts.filter(Boolean).pop() || '';
  } catch (err) {
    const parts = path.split('/');
    return parts[parts.length - 1];
  }
}

function canAccessPage(pathOrName) {
  const page = pageNameFromPath(pathOrName).toLowerCase();
  if (!page) return false;
  const allowedStatuses = PAGE_ACCESS[page];
  if (!allowedStatuses) {
    return isLoggedIn();
  }
  const status = getAccountStatus();
  return isLoggedIn() && allowedStatuses.includes(status);
}

function enforcePageAccess(pathOrName) {
  waitForAuthReady().then(() => {
    if (!isLoggedIn()) {
      window.location.replace('index.html');
      return;
    }
    if (!canAccessPage(pathOrName)) {
      window.location.replace('loggedIn.html');
    }
  });

  if (!isLoggedIn()) return false;
  return canAccessPage(pathOrName);
}

function setLoginError(message) {
  const el = document.getElementById('loginError');
  if (el) {
    el.textContent = message || '';
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const loginForm = document.getElementById('loginForm');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!supabaseClientInstance) {
      setLoginError('Supabase client not available.');
      return;
    }

    setLoginError('');
    const identifierRaw = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    if (!identifierRaw || !password) {
      setLoginError('Please enter both fields.');
      return;
    }

    let email = identifierRaw.toLowerCase();
    if (!identifierRaw.includes('@')) {
      const { data, error } = await supabaseClientInstance
        .from('profiles')
        .select('email')
        .eq('username', identifierRaw.toLowerCase())
        .maybeSingle();
      if (error || !data) {
        setLoginError('We could not find that username. Try again.');
        return;
      }
      email = data.email;
    }

    const { error: signInError } = await supabaseClientInstance.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      console.error('Login error', signInError);
      setLoginError('Invalid email/username or password.');
      return;
    }

    await waitForAuthReady();
    const cache = await refreshSessionCache();
    if (!cache) {
      setLoginError('Unable to load your profile. Please try again.');
      return;
    }

    window.location.replace('loggedIn.html');
  });
});

async function currentUserProfile() {
  await waitForAuthReady();
  return profileFromStorage();
}

async function updateAccountStatusForUser(userId, newStatus) {
  if (!supabaseClientInstance) throw new Error('Supabase client missing');
  const { error } = await supabaseClientInstance
    .from('profiles')
    .update({ account_status: newStatus })
    .eq('id', userId);
  if (error) throw error;
  const currentId = localStorage.getItem('userId');
  if (currentId === userId) {
    await refreshSessionCache();
  }
}

window.authHelpers = {
  waitForAuthReady,
  currentUserProfile,
  updateAccountStatusForUser
};
