// Shared Supabase setup for the site.
const SUPABASE_URL = 'https://xeqvlrmvvksetzgbhqqc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlcXZscm12dmtzZXR6Z2JocXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjA3MzksImV4cCI6MjA3NjUzNjczOX0.vKlGH1L748e1_QxHui_Mme-nLu-jpC07Eyk_zYgpc_I';
const HIGH_SCORES_TABLE = (typeof window !== 'undefined' && window.HIGH_SCORES_TABLE) ? window.HIGH_SCORES_TABLE : 'tenney-games';

if (typeof supabase === 'undefined') {
  console.error('Supabase CDN was not loaded. Please include it before supabase-client.js');
}

const supabaseClient = typeof supabase !== 'undefined'
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

if (typeof window !== 'undefined') {
  window.HIGH_SCORES_TABLE = HIGH_SCORES_TABLE;
}

const TABLE_CANDIDATES = Array.from(new Set([
  HIGH_SCORES_TABLE,
  HIGH_SCORES_TABLE.toLowerCase()
]));

function looksLikeMissingTable(error) {
  if (!error || !error.message) return false;
  const msg = error.message.toLowerCase();
  return msg.includes('does not exist') || msg.includes('does not exist in schema');
}

async function runAgainstHighScores(fn) {
  let lastError = null;
  for (const table of TABLE_CANDIDATES) {
    const { data, error } = await fn(table);
    if (!error) {
      if (typeof window !== 'undefined') {
        window.HIGH_SCORES_TABLE = table;
      }
      return { data, error: null };
    }
    lastError = error;
    if (!looksLikeMissingTable(error)) break;
  }
  return { data: null, error: lastError };
}

function storeUserSession(user, accountStatus = 'standard', firstName = '') {
  if (!user) return;
  const username = user.email ? user.email.split('@')[0] : user.id;
  const safeFirstName = firstName || (user.user_metadata && user.user_metadata.firstName) || username;
  localStorage.setItem('loggedIn', 'true');
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('username', username);
  localStorage.setItem('firstName', safeFirstName);
  localStorage.setItem('accountStatus', accountStatus || 'standard');
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.error('Unable to read stored user', e);
    return null;
  }
}

// Only ONE definition of this function
async function ensureHighScoreRow(user, accountStatus = 'standard', firstName = '') {
  if (!supabaseClient || !user) {
    return { ok: false, error: 'Supabase client not ready or user missing' };
  }
  const username = user.email ? user.email.split('@')[0] : user.id;
  const safeFirstName = firstName || (user.user_metadata && user.user_metadata.firstName) || username;

  const payload = {
    user_uuid: user.id, 
    firstName: safeFirstName,
    'access-level': accountStatus || 'standard'
  };

  // Upsert on user_uuid. requires INSERT and UPDATE policies in Supabase
  const { error } = await runAgainstHighScores(table =>
    supabaseClient
      .from(table)
      .upsert([payload], { onConflict: 'user_uuid' })
  );

  if (error) {
    console.error('High score row upsert failed', error);
    const hint = error.code === '42501'
      ? 'Row-Level Security violation. Check Policies in Supabase dashboard.'
      : 'Double-check column names match (user_uuid, firstName, access-level).';
    return { ok: false, error: `${error.message}. ${hint}` };
  }
  return { ok: true };
}

async function fetchAccountProfile(userId) {
  if (!supabaseClient || !userId) return null;
  
  // Using .maybeSingle() prevents the PGRST116 error on empty results
  const { data, error } = await runAgainstHighScores(table =>
    supabaseClient
      .from(table)
      .select('id, user_uuid, firstName, messages, "access-level"')
      .eq('user_uuid', userId)
      .maybeSingle() 
  );

  if (error) {
    console.warn('Error checking profile:', error.message);
    return null;
  }
  
  return data;
}

async function saveMessages(userId, messages) {
  if (!supabaseClient || !userId) return false;

  const payload = messages; 

  const { error } = await runAgainstHighScores(table =>
    supabaseClient
      .from(table)
      .update({ messages: payload })
      .eq('user_uuid', userId)
  );

  if (error) {
    console.warn('Could not save messages', error);
    return false;
  }
  return true;
}

async function refreshSessionFromSupabase() {
  if (!supabaseClient) return null;
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) {
    console.error('Error loading session', error);
    return null;
  }
  if (data && data.session && data.session.user) {
    const storedFirst = localStorage.getItem('firstName');
    storeUserSession(data.session.user, localStorage.getItem('accountStatus'), storedFirst);
    return data.session.user;
  }
  return null;
}

window.supabaseClient = supabaseClient;
window.supabaseHelpers = {
  storeUserSession,
  getStoredUser,
  ensureHighScoreRow,
  fetchAccountProfile,
  saveMessages,
  refreshSessionFromSupabase
};
