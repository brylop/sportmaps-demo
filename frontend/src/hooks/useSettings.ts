import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getUserFriendlyError } from '@/lib/error-translator';

export interface SettingsData {
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    bio: string | null;
    role: string;
    preferences: Record<string, any>;
  };
  school?: {
    id: string;
    name: string;
    description: string | null;
    logo_url: string | null;
    branding_settings: {
      primary_color: string;
      secondary_color: string;
      show_sportmaps_watermark: boolean;
      [key: string]: any;
    };
    role_in_school: string;
  };
}

export interface SchoolService {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  active: boolean;
  price_monthly: number;
}

export function useSettings() {
  const { user, updateProfile: updateAuthProfile } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<SettingsData | null>(null);
  const [services, setServices] = useState<SchoolService[]>([]);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: settings, error } = await supabase.rpc('get_my_settings') as { data: any, error: any };
      if (error) throw error;
      
      const settingsData = settings as SettingsData;
      setData(settingsData);

      // If user is school-related, fetch services
      if (settingsData.school?.id) {
        const { data: schoolServices, error: servicesError } = await supabase.rpc('get_school_services', {
          p_school_id: settingsData.school.id
        }) as { data: any, error: any };
        if (servicesError) throw servicesError;
        setServices(schoolServices as SchoolService[]);
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast({
        title: "Error al cargar configuración",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateProfile = async (updates: { full_name: string; phone: string; bio: string }) => {
    setSaving(true);
    try {
      const { data: success, error } = await supabase.rpc('save_profile_settings', {
        p_full_name: updates.full_name,
        p_phone: updates.phone,
        p_bio: updates.bio
      });
      if (error) throw error;

      if (success) {
        await updateAuthProfile(updates, { silent: true });
        setData(prev => prev ? {
          ...prev,
          profile: { ...prev.profile, ...updates }
        } : null);
        
        toast({
          title: "Perfil actualizado",
          description: "Tus cambios han sido guardados correctamente.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error al actualizar perfil",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateNotificationPreferences = async (prefs: Record<string, boolean>) => {
    setSaving(true);
    try {
      const { data: success, error } = await supabase.rpc('save_notification_preferences', {
        p_preferences: prefs
      });
      if (error) throw error;

      if (success) {
        setData(prev => prev ? {
          ...prev,
          profile: { 
            ...prev.profile, 
            preferences: { ...prev.profile.preferences, ...prefs } 
          }
        } : null);
        
        toast({
          title: "Preferencias guardadas",
          description: "Tus notificaciones han sido actualizadas.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updatePrivacyPreferences = async (prefs: Record<string, boolean>) => {
    setSaving(true);
    try {
      const { data: success, error } = await supabase.rpc('save_privacy_preferences', {
        p_preferences: prefs
      });
      if (error) throw error;

      if (success) {
        setData(prev => prev ? {
          ...prev,
          profile: { 
            ...prev.profile, 
            preferences: { ...prev.profile.preferences, ...prefs } 
          }
        } : null);
        
        toast({
          title: "Privacidad actualizada",
          description: "Tus ajustes de privacidad han sido guardados.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateBranding = async (branding: any) => {
    if (!data?.school?.id) return;
    setSaving(true);
    try {
      const { data: success, error } = await supabase.rpc('save_school_branding', {
        p_school_id: data.school.id,
        p_branding: branding
      });
      if (error) throw error;

      if (success) {
        setData(prev => prev ? {
          ...prev,
          school: prev.school ? { ...prev.school, branding_settings: branding } : undefined
        } : null);
        
        toast({
          title: "Identidad visual actualizada",
          description: "Los cambios de branding han sido aplicados.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Error al guardar branding",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (password: string) => {
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast({
        title: "Contraseña actualizada",
        description: "Tu contraseña ha sido cambiada exitosamente.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: getUserFriendlyError(error),
        variant: "destructive",
      });
      throw error;
    } finally {
      setSaving(false);
    }
  };

  return {
    loading,
    saving,
    data,
    services,
    updateProfile,
    updateNotificationPreferences,
    updatePrivacyPreferences,
    updateBranding,
    changePassword,
    refresh: fetchSettings
  };
}
