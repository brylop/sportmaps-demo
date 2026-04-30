import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface TrainerProfile {
  id: string;
  user_id: string;
  school_id: string;
  display_name: string | null;
  tagline: string | null;
  bio: string | null;
  avatar_url: string | null;
  cover_image_url: string | null;
  primary_sport: string | null;
  secondary_sports: string[] | null;
  specialties: string[] | null;
  experience_years: number | null;
  certifications: any;
  gallery_urls: string[] | null;
  rate_per_session: number | null;
  rate_currency: string;
  rate_notes: string | null;
  city: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  modality: 'presencial' | 'virtual' | 'ambas';
  instagram_url: string | null;
  whatsapp_number: string | null;
  is_published: boolean;
  rating: number;
  review_count: number;
  created_at: string;
  updated_at: string;
}

export function useTrainerContext() {
  const { trainerSchoolId, isPersonalTrainer } = useAuth();
  const [trainerProfile, setTrainerProfile] = useState<TrainerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const fetchTrainerProfile = useCallback(async () => {
    if (!isPersonalTrainer || !trainerSchoolId) return;

    setLoadingProfile(true);
    try {
      const { data, error } = await (supabase as any)
        .from('trainer_profiles')
        .select('*')
        .eq('school_id', trainerSchoolId)
        .maybeSingle();

      if (error) throw error;
      setTrainerProfile(data as TrainerProfile ?? null);
    } catch (err) {
      console.error('[useTrainerContext] Error fetching trainer profile:', err);
    } finally {
      setLoadingProfile(false);
    }
  }, [isPersonalTrainer, trainerSchoolId]);

  useEffect(() => {
    fetchTrainerProfile();
  }, [fetchTrainerProfile]);

  return {
    trainerProfile,
    trainerSchoolId,
    isPersonalTrainer,
    loadingProfile,
    refetchProfile: fetchTrainerProfile,
  };
}
