// Simple helpers to load/update per-game high scores using Supabase.
(function () {
  const client = window.supabaseClient;
  const TABLE = 'HighScores';

  function getUserId() {
    const stored = window.supabaseHelpers ? window.supabaseHelpers.getStoredUser() : null;
    return stored ? stored.id : null;
  }

  async function fetchHighScore(column) {
    const userId = getUserId();
    if (!client || !userId) return null;
    const { data, error } = await client.from(TABLE).select(column).eq('id', userId).single();
    if (error) {
      console.warn('Could not fetch high score', error);
      return null;
    }
    const value = data ? data[column] : null;
    return typeof value === 'number' ? value : 0;
  }

  async function updateHighScore(column, value) {
    const userId = getUserId();
    if (!client || !userId) return;
    const { error } = await client.from(TABLE).update({ [column]: value }).eq('id', userId);
    if (error) console.warn('Could not update high score', error);
  }

  async function loadAndDisplay(column, elementId) {
    const el = document.getElementById(elementId);
    const best = await fetchHighScore(column);
    if (el && best !== null) {
      el.textContent = `High Score: ${Math.round(best)}`;
    }
    return best || 0;
  }

  window.supabaseHighScores = { fetchHighScore, updateHighScore, loadAndDisplay };
})();
