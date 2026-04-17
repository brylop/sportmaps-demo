import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface MarketplaceFilters {
  q?: string;
  type?: 'all' | 'products' | 'services';
  category?: string;
  city?: string;
  price_max?: number;
  service_type?: string;
  order_by?: 'newest' | 'price_asc' | 'price_desc' | 'name';
  page?: number;
  limit?: number;
}

export interface MarketplaceItem {
  id: string;
  type: 'product' | 'service';
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  category: string;
  stock?: number;
  duration_minutes?: number;
  tax_rate: number;
  has_variants?: boolean;
  has_variations?: boolean;
  vendor_name: string;
  vendor_slug: string;
  vendor_city: string;
  vendor_verified: boolean;
  created_at: string;
}

export interface MarketplaceResponse {
  items: MarketplaceItem[];
  total: number;
  page: number;
  pages: number;
  filters_applied: MarketplaceFilters;
}

async function fetchMarketplace(filters: MarketplaceFilters, token?: string): Promise<MarketplaceResponse> {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.type && filters.type !== 'all') params.set('type', filters.type);
  if (filters.category) params.set('category', filters.category);
  if (filters.city) params.set('city', filters.city);
  if (filters.price_max) params.set('price_max', String(filters.price_max));
  if (filters.service_type) params.set('service_type', filters.service_type);
  if (filters.order_by) params.set('order_by', filters.order_by);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/v1/marketplace?${params}`, { headers });
  const json = await res.json();

  if (!json.ok) throw new Error(json.error || 'Error cargando marketplace');
  return json;
}

export function useMarketplace(initialFilters?: Partial<MarketplaceFilters>) {
  const [filters, setFilters] = useState<MarketplaceFilters>({
    type: 'all',
    order_by: 'newest',
    page: 1,
    limit: 24,
    ...initialFilters,
  });

  const query = useQuery({
    queryKey: ['marketplace', filters],
    queryFn: () => fetchMarketplace(filters),
    staleTime: 2 * 60 * 1000,
  });

  const updateFilters = (newFilters: Partial<MarketplaceFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters, page: newFilters.page || 1 }));
  };

  const nextPage = () => {
    if (query.data && filters.page! < query.data.pages) {
      setFilters(prev => ({ ...prev, page: (prev.page || 1) + 1 }));
    }
  };

  const prevPage = () => {
    if (filters.page && filters.page > 1) {
      setFilters(prev => ({ ...prev, page: (prev.page || 2) - 1 }));
    }
  };

  return {
    ...query,
    filters,
    updateFilters,
    nextPage,
    prevPage,
  };
}
