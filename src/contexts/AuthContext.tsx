import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UserProfile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: 'athlete' | 'parent' | 'coach' | 'school' | 'wellness_professional' | 'store_owner' | 'admin';
  avatar_url: string | null;
  bio: string | null;
  date_of_birth: string | null;
  sportmaps_points: number;
  subscription_tier: 'free' | 'basic' | 'premium';
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: Partial<UserProfile>) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }
      
      if (!data) {
        console.warn('No profile found for user:', userId);
        return null;
      }
      
      return data as UserProfile;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }, []);

  const createProfile = useCallback(async (userId: string, userData: Partial<UserProfile>) => {
    try {
      // Check if profile already exists
      const existingProfile = await fetchProfile(userId);
      if (existingProfile) {
        return existingProfile;
      }

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          full_name: userData.full_name || 'Usuario',
          phone: userData.phone || null,
          role: userData.role || 'athlete',
          avatar_url: userData.avatar_url || null,
          bio: null,
          date_of_birth: null,
          sportmaps_points: 0,
          subscription_tier: 'free'
        })
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating profile:', error);
      throw error;
    }
  }, [fetchProfile]);

  useEffect(() => {
    let mounted = true;

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user || null);
      
      if (session?.user) {
        try {
          const userProfile = await fetchProfile(session.user.id);
          if (mounted) {
            if (userProfile) {
              setProfile(userProfile);
            } else {
              const created = await createProfile(session.user.id, {
                full_name: session.user.user_metadata?.full_name || 'Usuario',
                role: 'athlete',
              });
              setProfile(created as UserProfile);
            }
          }
        } catch (error) {
          console.error('Failed to load/create profile:', error);
        }
      }
      
      if (mounted) {
        setLoading(false);
      }
    }).catch((error) => {
      console.error('Session error:', error);
      if (mounted) setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        // Synchronous updates only
        setSession(session);
        setUser(session?.user || null);

        // Defer Supabase fetches to avoid deadlocks
        if (session?.user) {
          setTimeout(async () => {
            try {
              const userProfile = await fetchProfile(session.user!.id);
              if (mounted) {
                if (userProfile) {
                  setProfile(userProfile);
                } else {
                  const created = await createProfile(session.user!.id, {
                    full_name: session.user!.user_metadata?.full_name || 'Usuario',
                    role: 'athlete',
                  });
                  setProfile(created as UserProfile);
                }
              }
            } catch (error) {
              console.error('Deferred profile load/create failed:', error);
            } finally {
              if (mounted) setLoading(false);
            }
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, userData: Partial<UserProfile>) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: userData.full_name,
            role: userData.role,
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        await createProfile(data.user.id, userData);
        toast({
          title: "¡Registro exitoso!",
          description: "Bienvenido a SportMaps. Tu cuenta ha sido creada.",
        });
      }
    } catch (error: any) {
      console.error('Error signing up:', error);
      toast({
        title: "Error en el registro",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Inicio de sesión exitoso",
        description: "Bienvenido a SportMaps",
      });
    } catch (error: any) {
      console.error('Error signing in:', error);
      toast({
        title: "Error en el inicio de sesión",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión exitosamente",
      });
    } catch (error: any) {
      console.error('Error signing out:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;

      const updatedProfile = await fetchProfile(user.id);
      if (updatedProfile) setProfile(updatedProfile);

      toast({
        title: "Perfil actualizado",
        description: "Tus datos han sido actualizados exitosamente",
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  const value = useMemo(() => ({
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    updateProfile,
  }), [user, profile, session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}