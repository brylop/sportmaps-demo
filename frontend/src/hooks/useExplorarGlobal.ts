import { useQuery } from '@tanstack/react-query';
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

// ── Types ────────────────────────────────────────────────────────────────────

export type ExploreCategory =
  | 'all'
  | 'services'
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
  item_type: 'service' | 'event' | 'school' | 'product';
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

  // School-specific
  sports?: string[];
  rating?: number;
  review_count?: number;

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

  // Services: requires service_listings table (marketplace migration).
  // Skipped until the migration is deployed to Supabase.

  // Fetch events (open for individual registration)
  if (filters.category === 'all' || filters.category === 'events') {
    let eventsQuery = supabase
      .from('events')
      .select('*', { count: 'exact' })
      .eq('status', 'active')
      .eq('registrations_open', true)
      .gte('event_date', new Date().toISOString().split('T')[0]);

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

  // Fetch schools
  if (filters.category === 'all' || filters.category === 'schools') {
    let schoolsQuery = supabase
      .from('schools')
      .select('id, name, description, logo_url, cover_image_url, city, address, sports, verified, rating, review_count, created_at', { count: 'exact' });

    if (filters.q) {
      schoolsQuery = schoolsQuery.or(`name.ilike.%${filters.q}%,description.ilike.%${filters.q}%`);
    }
    if (filters.city) schoolsQuery = schoolsQuery.ilike('city', `%${filters.city}%`);
    if (filters.sport) schoolsQuery = schoolsQuery.contains('sports', [filters.sport]);

    schoolsQuery = schoolsQuery
      .order('rating', { ascending: false, nullsFirst: false })
      .range(0, (filters.category === 'schools' ? limit : 6) - 1);

    const { data: schools } = await schoolsQuery;

    if (schools) {
      for (const s of schools) {
        items.push({
          id: s.id,
          item_type: 'school',
          name: s.name,
          description: s.description,
          price: 0, // schools show "desde $X" separately
          currency: 'COP',
          image_url: s.cover_image_url || s.logo_url,
          sports: s.sports,
          rating: s.rating,
          review_count: s.review_count,
          vendor_name: s.name,
          vendor_city: s.city,
          vendor_verified: s.verified || false,
          vendor_logo: s.logo_url,
          created_at: s.created_at,
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
