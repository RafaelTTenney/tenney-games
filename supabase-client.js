(function(){
  // We keep the Supabase client creation in its own file so every page can reuse it.
  // The keys below are safe to ship to the browser because this is the public anon key.
  const SUPABASE_URL = 'https://xeqvlrmvvksetzgbhqqc.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlcXZscm12dmtzZXR6Z2JocXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjA3MzksImV4cCI6MjA3NjUzNjczOX0.vKlGH1L748e1_QxHui_Mme-nLu-jpC07Eyk_zYgpc_I';

  if (!window.supabase) {
    console.error('Supabase library not loaded. Include https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js before this file.');
    return;
  }

  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });
})();
