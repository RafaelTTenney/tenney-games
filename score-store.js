import { supabase, hasSupabaseConfig } from './supabase.js';

async function getUserId() {
  if (!hasSupabaseConfig()) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id || null;
}

async function fetchHighScore(userId, gameId) {
  const { data, error } = await supabase
    .from('game_high_scores')
    .select('score')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .maybeSingle();
  if (error) return 0;
  return data?.score || 0;
}

export async function getHighScore(gameId) {
  const userId = await getUserId();
  if (!userId) return 0;
  return fetchHighScore(userId, gameId);
}

export async function submitHighScore(gameId, score) {
  const userId = await getUserId();
  if (!userId) return null;
  const current = await fetchHighScore(userId, gameId);
  if (score <= current) return current;
  const { error } = await supabase
    .from('game_high_scores')
    .upsert(
      { user_id: userId, game_id: gameId, score },
      { onConflict: 'user_id,game_id' }
    );
  if (error) return current;
  return score;
}

export async function submitLowScore(gameId, score) {
  const userId = await getUserId();
  if (!userId) return null;
  const current = await fetchHighScore(userId, gameId);
  if (current > 0 && score >= current) return current;
  const { error } = await supabase
    .from('game_high_scores')
    .upsert(
      { user_id: userId, game_id: gameId, score },
      { onConflict: 'user_id,game_id' }
    );
  if (error) return current;
  return score;
}
