// Geladen via CDN in HTML
const SUPABASE_URL = 'https://jouw-project-ref.supabase.co';
const SUPABASE_ANON_KEY = 'jouw-anon-key-uit-supabase-dashboard';

// Maak de Supabase client aan
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
