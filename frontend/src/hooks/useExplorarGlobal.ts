import { useQuery } from '@tanstack/react-query';
import { todayColombia } from '@/lib/dateUtils';
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ── Types ────────────────────────────────────────────────────────────────────

export type ExploreCategory =
  | 'all'
  | 'services'
  | 'trainers'
  | 'events'
  | 'schools'
  | 'products';

export type ServiceType =
  | 'Fisioterapia'
  | 'Nutricion'
  | 'Psicologia'
  | 'Medicina_Deportiva'
  | 'Entrenamiento'
  | 'Otro';

export type SortOrder = 'newest' | 'price_asc' | 'price_desc' | 'name' | 'distance';

export interface ExploreFilters {
  category: ExploreCategory;
  q?: string;
  city?: string;
  service_type?: ServiceType;
  sport?: string;
  price_max?: number;
  order_by: SortOrder;
  page: number;
  limit: number;
  // Geo (for distance filter)
  lat?: number;
  lng?: number;
  distance_km?: number;
}

export interface ExploreItem {
  id: string;
  item_type: 'service' | 'trainer' | 'event' | 'school' | 'product';
  name: string;
  description: string | null;
  price: number;
  currency: string;
  image_url: string | null;

  // Service-specific
  service_type?: string;
  duration_minutes?: number;

  // Event-specific
  event_date?: string;
  event_time?: string;
  event_type?: string;
  capacity?: number;
  registrations_count?: number;
  registrations_open?: boolean;

  // School-specific / Trainer-specific shared
  sports?: string[];
  rating?: number;
  review_count?: number;

  // Trainer-specific
  tagline?: string | null;
  primary_sport?: string | null;
  modality?: 'presencial' | 'virtual' | 'ambas';
  experience_years?: number | null;
  specialties?: string[] | null;
  trainer_user_id?: string;

  // Product-specific
  stock?: number;
  category?: string;
  has_variants?: boolean;

  // Vendor/source info
  vendor_name: string;
  vendor_slug?: string;
  vendor_city: string | null;
  vendor_verified: boolean;
  vendor_logo?: string | null;
  vendor_id?: string;

  // Common
  is_courtesy?: boolean;
  created_at: string;
}

export interface ExploreResult {
  items: ExploreItem[];
  total: number;
  page: number;
  pages: number;
}

// ── Fetch function ──────────────────────────────────────────────────────────

async function fetchExploreGlobal(filters: ExploreFilters): Promise<ExploreResult> {
  const items: ExploreItem[] = [];
  const limit = filters.limit;
  const offset = (filters.page - 1) * limit;

  // Fetch services (wellness, fisio, nutricion, psicologia, entrenamiento)
  // Se une service_listings con vendor_profiles. RLS publica exige
  // is_active=true en ambos + visibility='public' en service_listings.
  if (filters.category === 'all' || filters.category === 'services') {
    const svcLimit = filters.category === 'services' ? limit : 6;
    let servicesQuery = supabase
      .from('service_listings')
      .select(`
        id, name, description, service_type, price, currency, duration_minutes,
        image_url, is_active, visibility, has_variations, created_at,
        vendor_profile:vendor_profiles!inner(
          id, display_name, slug, city, logo_url, verification_status, is_active
        )
      `)
      .eq('is_active', true)
      .eq('visibility', 'public');

    if (filters.q) {
      servicesQuery = servicesQuery.or(`name.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);
    }
    if (filters.service_type) servicesQuery = servicesQuery.eq('service_type', filters.service_type);
    if (filters.price_max) servicesQuery = servicesQuery.lte('price', filters.price_max);

    servicesQuery = servicesQuery
      .order('created_at', { ascending: false })
      .range(0, svcLimit - 1);

    const { data: services, error: svcErr } = await servicesQuery;
    if (svcErr) console.error('[useExplorarGlobal] services', svcErr);

    if (services) {
      for (const raw of services as any[]) {
        const vp = Array.isArray(raw.vendor_profile) ? raw.vendor_profile[0] : raw.vendor_profile;
        if (!vp || !vp.is_active) continue;
        // Filtro de ciudad sobre el vendor (la columna city esta en vendor_profiles)
        if (filters.city && !(vp.city ?? '').toLowerCase().includes(filters.city.toLowerCase())) continue;
        items.push({
          id: raw.id,
          item_type: 'service',
          name: raw.name,
          description: raw.description,
          price: raw.price ?? 0,
          currency: raw.currency ?? 'COP',
          image_url: raw.image_url || vp.logo_url,
          service_type: raw.service_type,
          duration_minutes: raw.duration_minutes,
          has_variants: raw.has_variations,
          vendor_name: vp.display_name,
          vendor_slug: vp.slug,
          vendor_city: vp.city,
          vendor_verified: vp.verification_status === 'verified',
          vendor_logo: vp.logo_url,
          vendor_id: vp.id,
          created_at: raw.created_at,
        });
      }
    }
  }

  // Fetch events (open for individual registration)
  if (filters.category === 'all' || filters.category === 'events') {
    let eventsQuery = supabase
      .from('events')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .eq('registrations_open', true)
      .gte('event_date', todayColombia());

    if (filters.q) {
      eventsQuery = eventsQuery.or(`title.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);
    }
    if (filters.city) eventsQuery = eventsQuery.ilike('city', `%${filters.city}%`);
    if (filters.sport) eventsQuery = eventsQuery.ilike('sport', `%${filters.sport}%`);
    if (filters.price_max) eventsQuery = eventsQuery.lte('price', filters.price_max);

    eventsQuery = eventsQuery
      .order(filters.order_by === 'price_asc' ? 'price' : filters.order_by === 'price_desc' ? 'price' : 'event_date',
        { ascending: filters.order_by !== 'price_desc' })
      .range(0, (filters.category === 'events' ? limit : 6) - 1);

    const { data: events } = await eventsQuery;

    if (events) {
      for (const e of events) {
        items.push({
          id: e.id,
          item_type: 'event',
          name: e.title,
          description: e.description,
          price: e.price,
          currency: e.currency || 'COP',
          image_url: e.image_url,
          event_date: e.event_date,
          event_time: e.start_time,
          event_type: e.event_type,
          capacity: e.capacity,
          registrations_open: e.registrations_open,
          vendor_name: '', // will be enriched
          vendor_city: e.city,
          vendor_verified: false,
          vendor_id: e.creator_id,
          created_at: e.created_at,
        });
      }
    }
  }

  // Fetch schools usando la RPC search_schools (SECURITY DEFINER bypasea RLS de
  // school_settings y ya enforza public_profile_enabled=true). Antes hacia query
  // directa con !inner pero la policy de select en school_settings es
  // staff-only, asi que el join devolvia 0 filas y la escuela jamas aparecia.
  if (filters.category === 'all' || filters.category === 'schools') {
    const schoolsLimit = filters.category === 'schools' ? limit : 6;
    const { data: rpcData, error: rpcErr } = await supabase.rpc('search_schools', {
      p_page: 1,
      p_limit: schoolsLimit,
      p_order_by: 'rating',
      p_query: filters.q ?? null,
      p_city: filters.city ?? null,
      p_sport: filters.sport ?? null,
      p_price_max: filters.price_max ?? null,
    } as any);

    if (rpcErr) {
      console.error('[useExplorarGlobal] search_schools', rpcErr);
    }

    const schools = (rpcData as any)?.data ?? [];
    for (const s of schools as any[]) {
      items.push({
        id: s.id,
        item_type: 'school',
        name: s.name,
        description: null,
        price: s.min_price ?? 0,
        currency: 'COP',
        image_url: s.cover_image_url || s.logo_url,
        sports: s.program_sports ?? [],
        rating: s.avg_rating ?? 0,
        review_count: s.review_count ?? 0,
        vendor_name: s.name,
        vendor_city: s.city,
        vendor_verified: s.verified || false,
        vendor_logo: s.logo_url,
        created_at: new Date().toISOString(),
      });
    }
  }

  // Fetch trainers (published profiles)
  if (filters.category === 'all' || filters.category === 'trainers') {
    const trnLimit = filters.category === 'trainers' ? limit : 6;
    let trainersQuery = (supabase as any)
      .from('trainer_profiles')
      .select('id, user_id, display_name, tagline, avatar_url, primary_sport, city, modality, rate_per_session, rate_currency, rating, review_count, specialties, experience_years, created_at')
      .eq('is_published', true);

    if (filters.q) {
      trainersQuery = trainersQuery.or(`display_name.ilike.%${filters.q}%,tagline.ilike.%${filters.q}%`);
    }
    if (filters.city) trainersQuery = trainersQuery.ilike('city', `%${filters.city}%`);
    if (filters.sport) trainersQuery = trainersQuery.ilike('primary_sport', `%${filters.sport}%`);
    if (filters.price_max) trainersQuery = trainersQuery.lte('rate_per_session', filters.price_max);

    trainersQuery = trainersQuery
      .order('rating', { ascending: false, nullsFirst: false })
      .range(0, trnLimit - 1);

    const { data: trainers } = await trainersQuery;

    if (trainers) {
      for (const t of trainers as any[]) {
        items.push({
          id: t.id,
          item_type: 'trainer',
          name: t.display_name || 'Entrenador',
          description: t.tagline,
          price: t.rate_per_session || 0,
          currency: t.rate_currency || 'COP',
          image_url: t.avatar_url,
          tagline: t.tagline,
          primary_sport: t.primary_sport,
          modality: t.modality,
          experience_years: t.experience_years,
          specialties: t.specialties,
          rating: t.rating || 0,
          review_count: t.review_count || 0,
          trainer_user_id: t.user_id,
          vendor_name: t.display_name || '',
          vendor_city: t.city,
          vendor_verified: false,
          vendor_logo: t.avatar_url,
          created_at: t.created_at || new Date().toISOString(),
        });
      }
    }
  }

  // Fetch products directly from the products table
  if (filters.category === 'all' || filters.category === 'products') {
    const prodLimit = filters.category === 'products' ? limit : 6;
    let productsQuery = supabase
      .from('products')
      .select('id, name, description, price, image_url, category, stock, created_at')
      .eq('active', true);

    if (filters.q) {
      productsQuery = productsQuery.or(`name.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);
    }
    if (filters.price_max) productsQuery = productsQuery.lte('price', filters.price_max);

    productsQuery = productsQuery
      .order(filters.order_by === 'price_asc' ? 'price' : filters.order_by === 'price_desc' ? 'price' : 'created_at',
        { ascending: filters.order_by !== 'price_desc' })
      .range(0, prodLimit - 1);

    const { data: products } = await productsQuery;

    if (products) {
      for (const p of products) {
        items.push({
          id: p.id,
          item_type: 'product',
          name: p.name,
          description: p.description,
          price: p.price,
          currency: 'COP',
          image_url: p.image_url,
          category: p.category,
          stock: p.stock,
          vendor_name: '',
          vendor_city: null,
          vendor_verified: false,
          created_at: p.created_at,
        });
      }
    }
  }

  // Sort combined results
  const sorted = items.sort((a, b) => {
    switch (filters.order_by) {
      case 'price_asc': return a.price - b.price;
      case 'price_desc': return b.price - a.price;
      case 'name': return a.name.localeCompare(b.name);
      default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
  });

  // Paginate
  const total = sorted.length;
  const paginated = filters.category === 'all'
    ? sorted.slice(offset, offset + limit)
    : sorted.slice(offset, offset + limit);

  return {
    items: paginated,
    total,
    page: filters.page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useExplorarGlobal(initialFilters?: Partial<ExploreFilters>) {
  const [filters, setFilters] = useState<ExploreFilters>({
    category: 'all',
    order_by: 'newest',
    page: 1,
    limit: 24,
    ...initialFilters,
  });

  const query = useQuery({
    queryKey: ['explore-global', filters],
    queryFn: () => fetchExploreGlobal(filters),
    staleTime: 2 * 60 * 1000,
  });

  const updateFilters = useCallback((partial: Partial<ExploreFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...partial,
      page: partial.page ?? 1, // reset page on filter change unless page is explicitly set
    }));
  }, []);

  const nextPage = useCallback(() => {
    if (query.data && filters.page < query.data.pages) {
      setFilters(prev => ({ ...prev, page: prev.page + 1 }));
    }
  }, [query.data, filters.page]);

  const prevPage = useCallback(() => {
    if (filters.page > 1) {
      setFilters(prev => ({ ...prev, page: prev.page - 1 }));
    }
  }, [filters.page]);

  const clearFilters = useCallback(() => {
    setFilters({
      category: 'all',
      order_by: 'newest',
      page: 1,
      limit: 24,
    });
  }, []);

  return {
    ...query,
    filters,
    updateFilters,
    nextPage,
    prevPage,
    clearFilters,
  };
}
