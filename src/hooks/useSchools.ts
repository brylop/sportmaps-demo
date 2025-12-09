import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface School {
  id: string;
  name: string;
  description: string | null;
  city: string;
  address: string;
  phone: string;
  email: string;
  website: string | null;
  sports: string[] | null;
  amenities: string[] | null;
  rating: number;
  total_reviews: number;
  verified: boolean;
  logo_url: string | null;
  cover_image_url: string | null;
  owner_id: string;
  latitude: number | null;
  longitude: number | null;
}

export interface SchoolFilters {
  searchQuery?: string;
  city?: string;
  sport?: string;
}

/**
 * Custom hook for fetching and filtering schools
 * Provides loading states, error handling, and filtering capabilities
 */
export function useSchools(filters?: SchoolFilters) {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchSchools();
  }, []);

  const fetchSchools = async () => {
    try {
      setLoading(true);
      setError(null);

      // Only fetch schools - RLS policies will handle filtering
      const { data, error: fetchError } = await supabase
        .from('schools')
        .select('*')
        .order('rating', { ascending: false });

      if (fetchError) throw fetchError;
      
      // Return empty array if no data (user hasn't created schools yet)
      setSchools(data || []);
    } catch (err: any) {
      console.error('Error fetching schools:', err);
      setError(err.message);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las escuelas',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredSchools = schools.filter((school) => {
    if (!filters) return true;

    const matchesSearch =
      !filters.searchQuery ||
      school.name.toLowerCase().includes(filters.searchQuery.toLowerCase()) ||
      school.city.toLowerCase().includes(filters.searchQuery.toLowerCase());

    const matchesCity = !filters.city || filters.city === 'all' || school.city === filters.city;

    const matchesSport =
      !filters.sport ||
      filters.sport === 'all' ||
      (school.sports && school.sports.includes(filters.sport));

    return matchesSearch && matchesCity && matchesSport;
  });

  const cities = Array.from(new Set(schools.map((s) => s.city))).sort();
  const sports = Array.from(new Set(schools.flatMap((s) => s.sports || []))).sort();

  return {
    schools: filteredSchools,
    allSchools: schools,
    loading,
    error,
    refetch: fetchSchools,
    cities,
    sports,
  };
}

/**
 * Hook for fetching a single school by ID
 */
export function useSchool(schoolId: string | undefined) {
  const [school, setSchool] = useState<School | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (schoolId) {
      fetchSchool();
    }
  }, [schoolId]);

  const fetchSchool = async () => {
    if (!schoolId) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .single();

      if (fetchError) throw fetchError;
      setSchool(data);
    } catch (err: any) {
      console.error('Error fetching school:', err);
      setError(err.message);
      toast({
        title: 'Error',
        description: 'No se pudo cargar la información de la escuela',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    school,
    loading,
    error,
    refetch: fetchSchool,
  };
}
