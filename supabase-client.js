// Shared Supabase setup for the site. Loads a browser client and
// exposes helpers for auth + user storage.
// This keeps everything in one place so every page uses the same settings.
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
  // Expose the table name so the rest of the site can reuse the same value.
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

// IMPORTANT: user.id is a UUID. id (in DB) is int8/bigint (auto). Use user_uuid for user.id.
async function ensureHighScoreRow(user, accountStatus = 'standard', firstName = '') {
  if (!supabaseClient || !user) {
    return { ok: false, error: 'Supabase client not ready or user missing' };
  }
  const username = user.email ? user.email.split('@')[0] : user.id;
  const safeFirstName = firstName || (user.user_metadata && user.user_metadata.firstName) || username;

  const payload = {
    user_uuid: user.id, // <--- user.id (UUID) now stored in user_uuid
    firstName: safeFirstName,
    'access-level': accountStatus || 'standard'
    // Don't include "id" -- let DB auto-generate
  };

  // Upsert on user_uuid (if unique)
  const { error } = await runAgainstHighScores(table =>
    supabaseClient
      .from(table)
      .upsert([payload], { onConflict: 'user_uuid' })
  );
  if (error) {
    console.error('High score row upsert failed', error);
    const hint = error.code === '42501'
      ? 'Your Supabase table policies may be blocking inserts. Allow authenticated users to insert into HighScores.'
      : 'Double-check the HighScores table exists and the column names match (user_uuid, firstName, access-level).';
    return { ok: false, error: `${error.message}. ${hint}` };
  }
  return { ok: true };
}

async function fetchAccountProfile(userId) {
  if (!supabaseClient || !userId) return null;
  
  // FIX 1: Use .maybeSingle() instead of .single()
  // .single() throws an error if 0 rows exist (creating red console logs).
  // .maybeSingle() simply returns data: null, error: null.
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
  
  return data; // Returns the user object OR null (if new user)
}

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

  // FIX 2: Explicitly handle the "Upsert" logic
  const { error } = await runAgainstHighScores(table =>
    supabaseClient
      .from(table)
      .upsert(payload, { onConflict: 'user_uuid' }) 
  );

  if (error) {
    console.error('High score row upsert failed', error);
    // improved error handling msg
    return { ok: false, error: error.message }; 
  }
  return { ok: true };
}

async function saveMessages(userId, messages) {
  if (!supabaseClient || !userId) return false;

  // FIX 3: JSON Type handling
  // If your DB column is type 'json' or 'jsonb', DO NOT manually stringify.
  // Supabase/Postgres handles the conversion. 
  // If column is 'text', keep the stringify. Assuming 'jsonb' is best practice:
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
