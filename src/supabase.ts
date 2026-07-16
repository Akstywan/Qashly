import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Initialize client only if valid credentials are provided
export const supabase = 
  supabaseUrl && supabaseUrl.startsWith('https://') && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;
