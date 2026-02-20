import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/utils/authErrors';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  role: 'athlete' | 'parent' | 'coach' | 'school' | 'school_admin' | 'wellness_professional' | 'store_owner' | 'organizer' | 'admin' | 'super_admin';
  avatar_url: string | null;
  bio: string | null;
  date_of_birth: string | null;
  sportmaps_points: number;
  subscription_tier: 'free' | 'basic' | 'premium';
  invitation_code?: string;
  onboarding_completed?: boolean;
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
        // If it's a "Not Found" error (PGRST116), it's fine, we return null
        if (error.code === 'PGRST116') return null;

        console.error('Error fetching profile:', error);
        throw error;
      }

      return data as UserProfile;
    } catch (error) {
      console.error('Error in fetchProfile:', error);
      // Re-throw so the caller knows it was an error, not just a missing profile
      throw error;
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
          email: userData.email || '', // FIX: Added missing required field
          phone: userData.phone || null,
          role: (userData.role || 'athlete') as any,
          avatar_url: userData.avatar_url || null,
          bio: null,
          date_of_birth: userData.date_of_birth || null,
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

    // Get initial session from Supabase
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;

      setSession(session);
      setUser(session?.user || null);

      if (session?.user) {
        try {
          // Intentamos obtener el perfil que el Trigger V4 ya debería haber creado
          let userProfile = await fetchProfile(session.user.id);

          // Si no existe de inmediato, reintentamos una vez tras un pequeño delay
          if (!userProfile) {
            console.log("Esperando al motor de base de datos...");
            await new Promise(resolve => setTimeout(resolve, 1000));
            userProfile = await fetchProfile(session.user.id);
          }

          if (mounted && userProfile) {
            setProfile(userProfile);
          } else if (mounted) {
            console.error("El perfil no se sincronizó a tiempo.");
          }
        } catch (error) {
          console.error('Error al cargar perfil:', error);
        }
      }

      if (mounted) setLoading(false);
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
              let userProfile = await fetchProfile(session.user!.id);

              if (!userProfile && mounted) {
                console.log("Reintentando carga de perfil tras evento auth...");
                await new Promise(resolve => setTimeout(resolve, 1000));
                userProfile = await fetchProfile(session.user!.id);
              }

              if (mounted && userProfile) {
                setProfile(userProfile);
              }
            } catch (error) {
              console.error('Deferred profile load failed:', error);
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

  const signUp = async (email: string, password: string, userData: Partial<UserProfile> & { invitation_code?: string }) => {
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
            phone: userData.phone,
            date_of_birth: userData.date_of_birth,
            invitation_code: userData.invitation_code,
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Profile creation is handled by DB Triggers for security
        // await createProfile(data.user.id, userData);
        toast({
          title: "¡Registro exitoso!",
          description: "Bienvenido a SportMaps. Tu cuenta ha sido creada.",
        });
      }
    } catch (error: any) {
      console.error('Error signing up:', error);
      toast({
        title: "Error en el registro",
        description: getErrorMessage(error),
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
        description: getErrorMessage(error),
        variant: "destructive",
      });
      throw error;
    }
  };

  const signOut = async () => {
    try {
      // Clear demo session storage
      sessionStorage.removeItem('demo_mode');
      sessionStorage.removeItem('demo_role');
      sessionStorage.removeItem('demo_tour_pending');

      // Force-clear Supabase auth tokens to prevent zombie sessions
      const supabaseKeys = Object.keys(localStorage).filter(k => k.startsWith('sb-'));
      supabaseKeys.forEach(key => localStorage.removeItem(key));

      // Regular Supabase signout
      const { data: { session: currentSession } } = await supabase.auth.getSession();

      if (currentSession) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }

      // Clear local state
      setUser(null);
      setSession(null);
      setProfile(null);

      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión exitosamente",
      });
    } catch (error: any) {
      console.error('Error signing out:', error);
      // Still clear local state even if signOut fails
      setUser(null);
      setSession(null);
      setProfile(null);

      // Only show error if it's not a session missing error
      if (!error.message?.includes('session')) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Session was already gone, treat as success
        toast({
          title: "Sesión cerrada",
          description: "Has cerrado sesión exitosamente",
        });
      }
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() } as any)
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