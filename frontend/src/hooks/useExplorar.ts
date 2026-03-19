import { useState, useEffect, useCallback, useRef } from "react";

// ─── tipos ───────────────────────────────────────────────────────────────────

export interface School {
  id: string;
  name: string;
  description: string | null;
  city: string | null;
  sports: string[];
  team_sports: string[];
  logo_url: string | null;
  cover_image_url: string | null;
  verified: boolean;
  avg_rating: number;
  review_count: number;
  min_price: number | null;
  max_price: number | null;
  team_count: number;
  branches_count: number;
  main_lat: number | null;
  main_lng: number | null;
  category_name: string | null;
  category_icon: string | null;
}

export interface SchoolDetail extends School {
  school_type: string | null;
  created_at: string;
  min_plan_price: number | null;
  max_plan_price: number | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  amenities: string[];
  certifications: string[];
  levels_offered: string[];
  branding_settings: Record<string, any> | null;
  payment_settings: Record<string, any> | null;
  is_open_now: boolean;
  staff: any[] | null;
  branches: any[] | null;
  teams_detail: any[] | null;
  offerings_detail: any[] | null;
  facilities_detail: any[] | null;
  recent_reviews: any[] | null;
  rating_distribution: Record<string, number> | null;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface SearchFilters {
  query?: string;
  city?: string;
  sport?: string;
  price_max?: number;
  rating_min?: number;
  age?: number;
  verified?: boolean;
  open_now?: boolean;
  lat?: number;
  lng?: number;
  distance_km?: number;
  order_by?: "rating" | "price" | "distance" | "name";
}

// ─── config ──────────────────────────────────────────────────────────────────

const BFF_URL = import.meta.env.VITE_BFF_URL ?? "http://localhost:3001";

async function bffGet<T>(path: string, params: Record<string, unknown> = {}): Promise<T> {
  const url = new URL(`${BFF_URL}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  });
  const res = await fetch(url.toString(), {
    headers: { "Content-Type": "application/json" },
    credentials: "include", // por si el BFF usa cookies de sesión
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error ?? "Error en el servidor");
  return json;
}

// ─── hook principal ───────────────────────────────────────────────────────────

export function useExplorar() {
  const [schools, setSchools] = useState<School[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [filters, setFilters] = useState<SearchFilters>({ order_by: "rating" });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // debounce ref para búsqueda por texto
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSchools = useCallback(async (f: SearchFilters, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await bffGet<{ data: School[]; pagination: Pagination }>(
        "/api/explorar",
        { ...f, page: p, limit: 24 }
      );
      setSchools(result.data);
      setPagination(result.pagination);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // re-fetch cuando cambian filtros o página
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    // debounce solo si hay query de texto
    const delay = filters.query ? 400 : 0;
    debounceRef.current = setTimeout(() => {
      fetchSchools(filters, page);
    }, delay);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [filters, page, fetchSchools]);

  const updateFilter = useCallback((key: keyof SearchFilters, value: unknown) => {
    setPage(1); // reset página al cambiar filtro
    setFilters(prev => ({
      ...prev,
      [key]: value === "" || value === undefined ? undefined : value,
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setPage(1);
    setFilters({ order_by: "rating" });
  }, []);

  const goToPage = useCallback((p: number) => setPage(p), []);

  return {
    schools,
    pagination,
    filters,
    page,
    loading,
    error,
    updateFilter,
    clearFilters,
    goToPage,
    refetch: () => fetchSchools(filters, page),
  };
}

// ─── hook detalle escuela ─────────────────────────────────────────────────────

export function useSchoolDetail(id: string | null) {
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setSchool(null); return; }
    setLoading(true);
    setError(null);
    bffGet<{ data: SchoolDetail }>(`/api/explorar/${id}`)
      .then(r => setSchool(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return { school, loading, error };
}

// ─── hook escuelas cercanas ───────────────────────────────────────────────────

export function useEscuelasCerca(lat?: number, lng?: number, radiusKm = 5) {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lat || !lng) return;
    setLoading(true);
    setError(null);
    bffGet<{ data: School[] }>("/api/explorar/cerca", { lat, lng, radius_km: radiusKm })
      .then(r => setSchools(r.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [lat, lng, radiusKm]);

  return { schools, loading, error };
}

// ─── hook categorías ──────────────────────────────────────────────────────────

export function useCategorias() {
  const [categorias, setCategorias] = useState<{ id: string; name: string; icon: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    bffGet<{ data: { id: string; name: string; icon: string }[] }>("/api/explorar/meta/categorias")
      .then(r => setCategorias(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { categorias, loading };
}
