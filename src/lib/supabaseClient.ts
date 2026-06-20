import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/supabase';

const supabaseUrlEnv = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKeyEnv = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

if (!supabaseUrlEnv || !supabaseKeyEnv) {
  throw new Error('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}

export const supabaseUrl = supabaseUrlEnv;
export const supabaseKey = supabaseKeyEnv;
export const supabase = createClient<Database>(supabaseUrl, supabaseKey);
