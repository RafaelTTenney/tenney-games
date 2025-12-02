// Shared Supabase setup for the site. Loads a browser client and
// exposes helpers for auth + user storage.
// This keeps everything in one place so every page uses the same settings.
const SUPABASE_URL = 'https://xeqvlrmvvksetzgbhqqc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlcXZscm12dmtzZXR6Z2JocXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjA3MzksImV4cCI6MjA3NjUzNjczOX0.vKlGH1L748e1_QxHui_Mme-nLu-jpC07Eyk_zYgpc_I';

if (typeof supabase === 'undefined') {
  console.error('Supabase CDN was not loaded. Please include it before supabase-client.js');
}

const supabaseClient = typeof supabase !== 'undefined'
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

function storeUserSession(user, accountStatus = 'standard') {
  if (!user) return;
  const username = user.email ? user.email.split('@')[0] : user.id;
  localStorage.setItem('loggedIn', 'true');
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('username', username);
  localStorage.setItem('firstName', username);
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

async function ensureHighScoreRow(user) {
  if (!supabaseClient || !user) return;
  const username = user.email ? user.email.split('@')[0] : user.id;
  const { error } = await supabaseClient
    .from('HighScores')
    .upsert([{ id: user.id, username }]);
  if (error) console.error('High score row upsert failed', error);
}

async function fetchAccountProfile(userId) {
  if (!supabaseClient || !userId) return null;
  const { data, error } = await supabaseClient
    .from('HighScores')
    .select('id, username, messages, "acess-level"')
    .eq('id', userId)
    .single();
  if (error) {
    console.warn('Could not load profile row', error);
    return null;
  }
  return data;
}

async function saveMessages(userId, messages) {
  if (!supabaseClient || !userId) return false;
  const payload = Array.isArray(messages) ? JSON.stringify(messages) : messages;
  const { error } = await supabaseClient
    .from('HighScores')
    .update({ messages: payload })
    .eq('id', userId);
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
    storeUserSession(data.session.user, localStorage.getItem('accountStatus'));
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
