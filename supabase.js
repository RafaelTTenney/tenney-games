import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const SUPABASE_URL = 'https://xeqvlrmvvksetzgbhqqc.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlcXZscm12dmtzZXR6Z2JocXFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA5NjA3MzksImV4cCI6MjA3NjUzNjczOX0.vKlGH1L748e1_QxHui_Mme-nLu-jpC07Eyk_zYgpc_I';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export function hasSupabaseConfig() {
  return (
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('YOUR_SUPABASE_URL') &&
    !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')
  );
}
