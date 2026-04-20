import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { emailClient } from '@/lib/email-client';
import { Database } from '@/integrations/supabase/types';
import { getUserFriendlyError } from '@/lib/error-translator';

interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  role: 'athlete' | 'parent' | 'coach' | 'school' | 'school_admin' | 'wellness_professional' | 'store_owner' | 'admin' | 'super_admin' | 'organizer' | 'reporter' | 'personal_trainer';
  avatar_url: string | null;
  bio: string | null;
  date_of_birth: string | null;
  sportmaps_points: number;
  subscription_tier: 'free' | 'basic' | 'premium';
  invitation_code?: string;
  school_name?: string;
  onboarding_completed?: boolean;
  onboarding_started?: boolean;
  preferences?: any;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  isPersonalTrainer: boolean;
  trainerSchoolId: string | null;
  trainerOnboardingStatus: string | null;
  signUp: (email: string, password: string, userData: Partial<UserProfile>) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>, options?: { silent?: boolean }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPersonalTrainer, setIsPersonalTrainer] = useState(false);
  const [trainerSchoolId, setTrainerSchoolId] = useState<string | null>(null);
  const [trainerOnboardingStatus, setTrainerOnboardingStatus] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Detect personal trainer workspace (runs whenever user changes)
  const fetchTrainerContext = useCallback(async (userId: string, profileRole?: string) => {
    // Optimistic: if profile already says personal_trainer, set state immediately
    // so guards don't block before the DB query resolves.
    if (profileRole === 'personal_trainer') {
      setIsPersonalTrainer(true);
      // trainerSchoolId resolved below from DB
    }

    try {
      const { data } = await supabase
        .from('schools')
        .select('id, school_type, onboarding_status, onboarding_step')
        .eq('owner_id', userId)
        .eq('school_type', 'personal_trainer')
        .maybeSingle();

      if (data && data.school_type === 'personal_trainer') {
        setIsPersonalTrainer(true);
        setTrainerSchoolId(data.id);
        setTrainerOnboardingStatus(data.onboarding_status);
      } else if (profileRole === 'personal_trainer') {
        // School not found yet (provisioning in progress), but role confirms trainer.
        // Keep isPersonalTrainer=true — trainerSchoolId stays null until provisioned.
        setIsPersonalTrainer(true);
        setTrainerOnboardingStatus(null);
      } else {
        setIsPersonalTrainer(false);
        setTrainerSchoolId(null);
        setTrainerOnboardingStatus(null);
      }
    } catch {
      // On error, fall back to role-based detection
      if (profileRole === 'personal_trainer') {
        setIsPersonalTrainer(true);
      } else {
        setIsPersonalTrainer(false);
        setTrainerSchoolId(null);
        setTrainerOnboardingStatus(null);
      }
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
          email: userData.email || '',
          phone: userData.phone || null,
          role: (userData.role || 'athlete') as Database["public"]["Enums"]["user_role"],
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
          const userProfile = await fetchProfile(session.user.id);
          if (mounted) {
            if (userProfile) {
              setProfile(userProfile);
            } else {
              const created = await createProfile(session.user.id, {
                full_name: session.user.user_metadata?.full_name || 'Usuario',
                email: session.user.email || '',
                role: session.user.user_metadata?.role || 'athlete',
              });
              setProfile(created as UserProfile);
            }
            // Detect trainer workspace — pass role for immediate detection
            const resolvedRole = (userProfile ?? null)?.role ||
              session.user.user_metadata?.role;
            await fetchTrainerContext(session.user.id, resolvedRole);
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

        // ★ Interceptar el evento PASSWORD_RECOVERY para redirigir al formulario de nueva contraseña
        if (event === 'PASSWORD_RECOVERY') {
          // Supabase inicia sesión automáticamente con el token del email,
          // lo que haría que el ProtectedRoute deje pasar al usuario al Dashboard.
          // En vez de eso, lo redirigimos al formulario de cambio de contraseña.
          window.location.href = '/reset-password';
          return;
        }

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
                    email: session.user!.email || '', // FIX: Pass email
                    role: session.user!.user_metadata?.role || 'athlete',
                  });
                  setProfile(created as UserProfile);
                }
                // Detect trainer workspace — pass role for immediate detection
                const resolvedRole2 = (userProfile ?? null)?.role ||
                  session.user!.user_metadata?.role;
                await fetchTrainerContext(session.user!.id, resolvedRole2);
              }
            } catch (error) {
              console.error('Deferred profile load/create failed:', error);
            } finally {
              if (mounted) setLoading(false);
            }
          }, 0);
        } else {
          setProfile(null);
          setIsPersonalTrainer(false);
          setTrainerSchoolId(null);
          setTrainerOnboardingStatus(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile, createProfile, fetchTrainerContext]);

  const signUp = async (email: string, password: string, userData: Partial<UserProfile> & { invitation_code?: string, school_name?: string }) => {
    try {
      const redirectUrl = `${window.location.origin}/`;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: userData.full_name,
            phone: userData.phone,
            date_of_birth: userData.date_of_birth,
            role: userData.role,
            invitation_code: userData.invitation_code,
            school_name: userData.school_name,
          }
        }
      });

      if (error) throw error;

      if (data.user) {
        // Profile creation is handled by DB Triggers for security
        toast({
          title: "¡Registro exitoso!",
          description: "Bienvenido a SportMaps. Tu cuenta ha sido creada.",
        });

        // Send welcome email for school owners (non-blocking)
        if (userData.role === 'school' && userData.school_name) {
          emailClient.send({
            type: 'welcome_school',
            to: email,
            data: {
              userName: userData.full_name || 'Administrador',
              schoolName: userData.school_name,
            },
          }).catch((err) => console.warn('Welcome email failed:', err));
        }
      }
    } catch (error: unknown) {
      console.error('Error signing up:', error);
      toast({
        title: "Error en el registro",
        description: getUserFriendlyError(error),
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
    } catch (error: unknown) {
      console.error('Error signing in:', error);
      toast({
        title: "Error en el inicio de sesión",
        description: getUserFriendlyError(error),
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

      // Clear all app-specific localStorage to prevent data leaking between sessions
      localStorage.removeItem('sportmaps_cart');
      localStorage.removeItem('sportmaps_active_school_id');
      localStorage.removeItem('sportmaps_pending_enrollment');
      localStorage.removeItem('sportmaps_favoritos');
      localStorage.removeItem('sportmaps_welcome_dismissed');
      localStorage.removeItem('pending_invite_id');

      // Clear React Query cache so the next user doesn't see stale data
      queryClient.clear();

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
    } catch (error: unknown) {
      const err = error as Error;
      console.error('Error signing out:', error);
      // Still clear local state even if signOut fails
      setUser(null);
      setSession(null);
      setProfile(null);

      // Still clear caches on error to prevent data leaking
      queryClient.clear();

      // Only show error if it's not a session missing error
      if (!err.message?.includes('session')) {
        toast({
          title: "Error",
          description: getUserFriendlyError(err),
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

  const updateProfile = async (updates: Partial<UserProfile>, options?: { silent?: boolean }) => {
    if (!user) throw new Error('No user logged in');
    const silent = options?.silent || false;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() } as Database["public"]["Tables"]["profiles"]["Update"])
        .eq('id', user.id);

      if (error) throw error;

      const updatedProfile = await fetchProfile(user.id);
      if (updatedProfile) setProfile(updatedProfile);

      if (!silent) {
        toast({
          title: "Perfil actualizado",
          description: "Tus datos han sido actualizados exitosamente",
        });
      }
    } catch (error: unknown) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
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
    isPersonalTrainer,
    trainerSchoolId,
    trainerOnboardingStatus,
    signUp,
    signIn,
    signOut,
    updateProfile,
  }), [user, profile, session, loading, isPersonalTrainer, trainerSchoolId, trainerOnboardingStatus]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}