// Event Types for Organizer MVP

export interface Event {
  id: string;
  slug: string;
  creator_id: string;
  creator_role: 'school' | 'organizer';
  
  // Basic info
  title: string;
  description?: string;
  sport: string;
  event_type: 'tournament' | 'clinic' | 'tryout' | 'camp' | 'match' | 'training' | 'other';
  
  // Date and time
  event_date: string;
  start_time: string;
  end_time?: string;
  
  // Location
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  
  // Capacity and price
  capacity: number;
  price: number;
  currency: string;
  
  // Status
  status: 'draft' | 'active' | 'closed' | 'cancelled' | 'completed';
  registrations_open: boolean;
  
  // Metadata
  image_url?: string;
  notes?: string;
  contact_phone?: string;
  contact_email?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Computed (from joins/functions)
  approved_count?: number;
  pending_count?: number;
  available_spots?: number;
}

export interface EventRegistration {
  id: string;
  event_id: string;
  
  // Participant info
  participant_name: string;
  participant_email?: string;
  participant_phone: string;
  participant_role: 'athlete' | 'parent' | 'coach' | 'other';
  participant_age?: number;
  
  // Status
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  
  // Payment
  payment_proof_url?: string;
  payment_status: 'pending' | 'verified' | 'rejected' | 'not_required';
  
  // Notes
  notes?: string;
  rejection_reason?: string;
  
  // User (optional)
  user_id?: string;
  
  // Timestamps
  created_at: string;
  updated_at: string;
  
  // Joined data
  event?: Event;
}

export interface EventFormData {
  title: string;
  description?: string;
  sport: string;
  event_type: Event['event_type'];
  event_date: string;
  start_time: string;
  end_time?: string;
  address: string;
  city: string;
  lat?: number;
  lng?: number;
  capacity: number;
  price: number;
  contact_phone?: string;
  contact_email?: string;
  image_url?: string;
  notes?: string;
}

export interface RegistrationFormData {
  participant_name: string;
  participant_email?: string;
  participant_phone: string;
  participant_role: EventRegistration['participant_role'];
  participant_age?: number;
  notes?: string;
  payment_proof?: File;
}

export interface EventFilters {
  sport?: string;
  city?: string;
  event_type?: Event['event_type'];
  date_from?: string;
  date_to?: string;
  status?: Event['status'];
}

export type TelemetryEventType = 
  | 'event_created'
  | 'event_viewed'
  | 'link_shared'
  | 'registration_created'
  | 'registration_approved';

export interface EventStats {
  total_events: number;
  active_events: number;
  total_registrations: number;
  pending_registrations: number;
  approved_registrations: number;
}

// Sport options for Colombia
export const SPORT_OPTIONS = [
  'Fútbol',
  'Baloncesto',
  'Voleibol',
  'Tenis',
  'Natación',
  'Atletismo',
  'Ciclismo',
  'Fútbol Sala',
  'Béisbol',
  'Softbol',
  'Patinaje',
  'Taekwondo',
  'Judo',
  'Karate',
  'Boxeo',
  'Gimnasia',
  'Porrismo',
  'Otro'
] as const;

export const EVENT_TYPE_OPTIONS = [
  { value: 'tournament', label: 'Torneo' },
  { value: 'clinic', label: 'Clínica/Taller' },
  { value: 'tryout', label: 'Tryout/Prueba' },
  { value: 'camp', label: 'Campamento' },
  { value: 'match', label: 'Partido' },
  { value: 'training', label: 'Entrenamiento' },
  { value: 'other', label: 'Otro' }
] as const;

export const COLOMBIAN_CITIES = [
  'Bogotá',
  'Medellín',
  'Cali',
  'Barranquilla',
  'Cartagena',
  'Bucaramanga',
  'Pereira',
  'Manizales',
  'Cúcuta',
  'Santa Marta',
  'Ibagué',
  'Villavicencio',
  'Pasto',
  'Neiva',
  'Armenia',
  'Montería',
  'Valledupar',
  'Tunja',
  'Popayán',
  'Sincelejo'
] as const;
