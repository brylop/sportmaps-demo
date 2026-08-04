import { useState, useEffect } from "react";

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
  program_count: number;
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

const BFF_URL = import.meta.env.VITE_BFF_URL ?? "http://localhost:3001";

async function bffGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BFF_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error(json.error ?? "Error en el servidor");
  return json;
}

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
