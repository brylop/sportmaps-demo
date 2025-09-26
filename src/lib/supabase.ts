import { createClient } from '@supabase/supabase-js';

// Try multiple environment variable patterns used by Lovable and Vite
const supabaseUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.SUPABASE_URL ||
  'https://luebjarufsiadojhvxgi.supabase.co'; // Your project URL as fallback

const supabaseAnonKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.SUPABASE_ANON_KEY ||
  import.meta.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Available env vars:', import.meta.env);
  throw new Error('Missing Supabase environment variables. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      spm_users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          role: 'player' | 'coach' | 'parent' | 'admin';
          avatar_url: string | null;
          metadata: any;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          role?: 'player' | 'coach' | 'parent' | 'admin';
          avatar_url?: string | null;
          metadata?: any;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          role?: 'player' | 'coach' | 'parent' | 'admin';
          avatar_url?: string | null;
          metadata?: any;
          updated_at?: string;
        };
      };
    };
  };
};