import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = 'https://luebjarufsiadojhvxgi.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx1ZWJqYXJ1ZnNpYWRvamh2eGdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg5MTU2NTgsImV4cCI6MjA3NDQ5MTY1OH0.yfmAH4N9UboL4p6UqK-_tQnfhBHlTQrXCrwRokALix4';

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