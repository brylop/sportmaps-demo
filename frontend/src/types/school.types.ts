// ─── Tipos base ──────────────────────────────────────────────────────────────

export interface StaffMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: "coach" | "owner" | "admin";
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  is_main: boolean;
}

export interface ClassSlot {
  id: string;
  day_of_week: number; // 0=dom, 1=lun … 6=sab
  start_time: string;  // "HH:MM:SS"
  end_time: string;
  max_capacity: number;
}

export interface Program {
  id: string;
  name: string;
  description: string | null;
  sport: string;
  level: string | null;
  price_monthly: number | null;
  age_min: number | null;
  age_max: number | null;
  max_participants: number | null;
  image_url: string | null;
  schedule: Record<string, any> | null;
  classes: ClassSlot[] | null;
}

export interface OfferingPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  max_sessions: number | null;
  duration_days: number | null;
  sort_order: number;
}

export interface Offering {
  id: string;
  name: string;
  description: string | null;
  type: string;
  sport: string | null;
  plans: OfferingPlan[] | null;
}

export interface Facility {
  id: string;
  name: string;
  type: string;
  description: string | null;
  capacity: number | null;
  available_hours: Record<string, any> | null;
}

export interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  user_name: string;
  user_avatar: string | null;
}

export interface RatingDistribution {
  "1"?: number;
  "2"?: number;
  "3"?: number;
  "4"?: number;
  "5"?: number;
}

// ─── Perfil completo (school_detail_view) ─────────────────────────────────────

export interface SchoolDetail {
  id: string;
  name: string;
  description: string | null;
  school_type: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  sports: string[];
  amenities: string[];
  certifications: string[];
  levels_offered: string[];
  verified: boolean;
  branding_settings: { primary_color?: string; secondary_color?: string } | null;
  payment_settings: Record<string, any> | null;
  created_at: string;
  category_name: string | null;
  category_icon: string | null;
  avg_rating: number;
  review_count: number;
  min_price: number | null;
  max_price: number | null;
  program_count: number;
  min_plan_price: number | null;
  max_plan_price: number | null;
  branches_count: number;
  main_lat: number | null;
  main_lng: number | null;
  program_sports: string[];
  is_open_now: boolean;
  staff: StaffMember[] | null;
  branches: Branch[] | null;
  programs_detail: Program[] | null;
  offerings_detail: Offering[] | null;
  facilities_detail: Facility[] | null;
  recent_reviews: Review[] | null;
  rating_distribution: RatingDistribution | null;
}
