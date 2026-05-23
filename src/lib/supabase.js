import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

export function isSupabaseConfigured() {
  return (
    !!supabaseUrl &&
    !!supabaseAnonKey &&
    supabaseUrl !== 'your_supabase_project_url_here' &&
    supabaseAnonKey !== 'your_supabase_anon_key_here' &&
    supabaseUrl.startsWith('https://') &&
    (supabaseAnonKey.startsWith('eyJ') || supabaseAnonKey.startsWith('sb_'))
  );
}

let _supabase;
try {
  _supabase = createClient(
    isSupabaseConfigured() ? supabaseUrl : PLACEHOLDER_URL,
    isSupabaseConfigured() ? supabaseAnonKey : PLACEHOLDER_KEY
  );
} catch (e) {
  console.warn('[supabase] client failed to initialize:', e.message);
  _supabase = null;
}

export const supabase = _supabase;
