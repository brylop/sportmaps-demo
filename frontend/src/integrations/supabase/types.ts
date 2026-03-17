export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      academic_progress: {
        Row: {
          child_id: string
          coach_id: string | null
          comments: string | null
          created_at: string
          evaluation_date: string
          id: string
          skill_level: number
          skill_name: string
        }
        Insert: {
          child_id: string
          coach_id?: string | null
          comments?: string | null
          created_at?: string
          evaluation_date?: string
          id?: string
          skill_level: number
          skill_name: string
        }
        Update: {
          child_id?: string
          coach_id?: string | null
          comments?: string | null
          created_at?: string
          evaluation_date?: string
          id?: string
          skill_level?: number
          skill_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_progress_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_progress_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          activity_type: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          id: string
          location: string | null
          program_id: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["activity_status"]
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activity_type: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          program_id?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["activity_status"]
          title: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activity_type?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          id?: string
          location?: string | null
          program_id?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["activity_status"]
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          page_url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          page_url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          page_url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      announcements: {
        Row: {
          audience: string
          coach_id: string
          id: string
          message: string
          sent_at: string
          subject: string
          team_id: string | null
        }
        Insert: {
          audience: string
          coach_id: string
          id?: string
          message: string
          sent_at?: string
          subject: string
          team_id?: string | null
        }
        Update: {
          audience?: string
          coach_id?: string
          id?: string
          message?: string
          sent_at?: string
          subject?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "announcements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "announcements_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      athlete_goals: {
        Row: {
          athlete_id: string
          created_at: string | null
          description: string | null
          id: string
          progress: number
          status: string
          target_date: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          athlete_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          progress?: number
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          athlete_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          progress?: number
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_goals_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_payment_installments: {
        Row: {
          amount_cents: number
          athlete_id: string
          athlete_payment_id: string
          created_at: string
          id: string
          notes: string | null
          payment_method: string | null
          receipt_date: string
          receipt_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          athlete_id: string
          athlete_payment_id: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_date: string
          receipt_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          athlete_id?: string
          athlete_payment_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: string | null
          receipt_date?: string
          receipt_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_payment_installments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_payment_installments_athlete_payment_id_fkey"
            columns: ["athlete_payment_id"]
            isOneToOne: false
            referencedRelation: "athlete_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_payment_installments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_payment_installments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_payment_installments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_payment_installments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_payment_installments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_payments: {
        Row: {
          amount_cents: number
          athlete_id: string
          booking_id: string | null
          created_at: string | null
          currency: string
          due_date: string | null
          enrollment_id: string | null
          id: string
          paid_at: string | null
          payment_method: string | null
          payment_provider: string | null
          provider_transaction_id: string | null
          receipt_url: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          amount_cents: number
          athlete_id: string
          booking_id?: string | null
          created_at?: string | null
          currency?: string
          due_date?: string | null
          enrollment_id?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          provider_transaction_id?: string | null
          receipt_url?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          amount_cents?: number
          athlete_id?: string
          booking_id?: string | null
          created_at?: string | null
          currency?: string
          due_date?: string | null
          enrollment_id?: string | null
          id?: string
          paid_at?: string | null
          payment_method?: string | null
          payment_provider?: string | null
          provider_transaction_id?: string | null
          receipt_url?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_payments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_payments_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_stats: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          is_demo: boolean | null
          notes: string | null
          stat_date: string
          stat_type: string
          unit: string
          updated_at: string
          value: number
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          is_demo?: boolean | null
          notes?: string | null
          stat_date?: string
          stat_type: string
          unit: string
          updated_at?: string
          value: number
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          is_demo?: boolean | null
          notes?: string | null
          stat_date?: string
          stat_type?: string
          unit?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "athlete_stats_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          child_id: string | null
          class_date: string
          created_at: string | null
          id: string
          justification_reason: string | null
          justified_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          child_id?: string | null
          class_date: string
          created_at?: string | null
          id?: string
          justification_reason?: string | null
          justified_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          child_id?: string | null
          class_date?: string
          created_at?: string | null
          id?: string
          justification_reason?: string | null
          justified_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_date: string
          child_id: string | null
          class_id: string | null
          created_at: string | null
          id: string
          marked_by: string | null
          notes: string | null
          program_id: string
          school_id: string
          status: string
          team_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          attendance_date?: string
          child_id?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          marked_by?: string | null
          notes?: string | null
          program_id: string
          school_id: string
          status: string
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          attendance_date?: string
          child_id?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          marked_by?: string | null
          notes?: string | null
          program_id?: string
          school_id?: string
          status?: string
          team_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class_capacity"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "attendance_records_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "attendance_records_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "attendance_records_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "attendance_records_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "attendance_records_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          coach_id: string | null
          created_at: string | null
          created_by: string | null
          current_bookings: number
          end_time: string | null
          finalized: boolean | null
          finalized_at: string | null
          finalized_by: string | null
          id: string
          is_bookable: boolean
          max_capacity: number | null
          offering_id: string | null
          requires_capacity_check: boolean
          school_id: string | null
          session_date: string
          start_time: string | null
          team_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          coach_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_bookings?: number
          end_time?: string | null
          finalized?: boolean | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_bookable?: boolean
          max_capacity?: number | null
          offering_id?: string | null
          requires_capacity_check?: boolean
          school_id?: string | null
          session_date: string
          start_time?: string | null
          team_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          coach_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_bookings?: number
          end_time?: string | null
          finalized?: boolean | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_bookable?: boolean
          max_capacity?: number | null
          offering_id?: string | null
          requires_capacity_check?: boolean
          school_id?: string | null
          session_date?: string
          start_time?: string | null
          team_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "public_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "school_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "attendance_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "attendance_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string | null
          created_at: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          profile_id: string | null
          record_id: string | null
          school_id: string | null
          table_name: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          profile_id?: string | null
          record_id?: string | null
          school_id?: string | null
          table_name?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          profile_id?: string | null
          record_id?: string | null
          school_id?: string | null
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          currency: string
          due_date: string
          enrollment_id: string
          event_type: Database["public"]["Enums"]["billing_event_type"]
          gateway: string | null
          gateway_reference: string | null
          id: string
          installment_number: number | null
          late_fee_amount: number
          notes: string | null
          offering_plan_id: string | null
          paid_date: string | null
          parent_event_id: string | null
          payment_id: string | null
          school_id: string
          status: Database["public"]["Enums"]["pay_status"]
          updated_at: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          created_at?: string
          currency?: string
          due_date: string
          enrollment_id: string
          event_type?: Database["public"]["Enums"]["billing_event_type"]
          gateway?: string | null
          gateway_reference?: string | null
          id?: string
          installment_number?: number | null
          late_fee_amount?: number
          notes?: string | null
          offering_plan_id?: string | null
          paid_date?: string | null
          parent_event_id?: string | null
          payment_id?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["pay_status"]
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          currency?: string
          due_date?: string
          enrollment_id?: string
          event_type?: Database["public"]["Enums"]["billing_event_type"]
          gateway?: string | null
          gateway_reference?: string | null
          id?: string
          installment_number?: number | null
          late_fee_amount?: number
          notes?: string | null
          offering_plan_id?: string | null
          paid_date?: string | null
          parent_event_id?: string | null
          payment_id?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["pay_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "billing_events_offering_plan_id_fkey"
            columns: ["offering_plan_id"]
            isOneToOne: false
            referencedRelation: "offering_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_parent_event_id_fkey"
            columns: ["parent_event_id"]
            isOneToOne: false
            referencedRelation: "billing_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments_with_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          athlete_id: string
          availability_slot_id: string | null
          booking_type: string
          created_at: string | null
          id: string
          notes: string | null
          program_id: string | null
          scheduled_at: string
          status: string
          updated_at: string | null
        }
        Insert: {
          athlete_id: string
          availability_slot_id?: string | null
          booking_type: string
          created_at?: string | null
          id?: string
          notes?: string | null
          program_id?: string | null
          scheduled_at: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          athlete_id?: string
          availability_slot_id?: string | null
          booking_type?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          program_id?: string | null
          scheduled_at?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_events: {
        Row: {
          all_day: boolean | null
          created_at: string | null
          description: string | null
          end_time: string
          event_label: string | null
          event_type: string | null
          id: string
          is_demo: boolean | null
          location: string | null
          sport: string | null
          start_time: string
          team_id: string | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          all_day?: boolean | null
          created_at?: string | null
          description?: string | null
          end_time: string
          event_label?: string | null
          event_type?: string | null
          id?: string
          is_demo?: boolean | null
          location?: string | null
          sport?: string | null
          start_time: string
          team_id?: string | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          all_day?: boolean | null
          created_at?: string | null
          description?: string | null
          end_time?: string
          event_label?: string | null
          event_type?: string | null
          id?: string
          is_demo?: boolean | null
          location?: string | null
          sport?: string | null
          start_time?: string
          team_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "calendar_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "calendar_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      carts: {
        Row: {
          created_at: string | null
          id: string
          items: Json
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          items?: Json
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          items?: Json
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      children: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          created_at: string
          date_of_birth: string | null
          doc_number: string | null
          doc_type: string | null
          emergency_contact: string | null
          full_name: string
          gender: string | null
          grade: string | null
          id: string
          id_document_url: string | null
          is_active: boolean
          is_demo: boolean | null
          medical_info: string | null
          monthly_fee: number | null
          parent_email_temp: string | null
          parent_id: string | null
          parent_name_temp: string | null
          parent_phone_temp: string | null
          program_id: string | null
          school_id: string | null
          team_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          doc_number?: string | null
          doc_type?: string | null
          emergency_contact?: string | null
          full_name: string
          gender?: string | null
          grade?: string | null
          id?: string
          id_document_url?: string | null
          is_active?: boolean
          is_demo?: boolean | null
          medical_info?: string | null
          monthly_fee?: number | null
          parent_email_temp?: string | null
          parent_id?: string | null
          parent_name_temp?: string | null
          parent_phone_temp?: string | null
          program_id?: string | null
          school_id?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          doc_number?: string | null
          doc_type?: string | null
          emergency_contact?: string | null
          full_name?: string
          gender?: string | null
          grade?: string | null
          id?: string
          id_document_url?: string | null
          is_active?: boolean
          is_demo?: boolean | null
          medical_info?: string | null
          monthly_fee?: number | null
          parent_email_temp?: string | null
          parent_id?: string | null
          parent_name_temp?: string | null
          parent_phone_temp?: string | null
          program_id?: string | null
          school_id?: string | null
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "children_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "children_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "children_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "children_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "children_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      class_enrollments: {
        Row: {
          class_id: string
          enrolled_at: string | null
          enrollment_id: string
          id: string
        }
        Insert: {
          class_id: string
          enrolled_at?: string | null
          enrollment_id: string
          id?: string
        }
        Update: {
          class_id?: string
          enrolled_at?: string | null
          enrollment_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "class_capacity"
            referencedColumns: ["class_id"]
          },
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["enrollment_id"]
          },
        ]
      }
      classes: {
        Row: {
          coach_id: string | null
          created_at: string | null
          current_enrollment: number | null
          day_of_week: string
          end_time: string
          id: string
          is_active: boolean | null
          max_capacity: number | null
          name: string | null
          program_id: string
          school_id: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          coach_id?: string | null
          created_at?: string | null
          current_enrollment?: number | null
          day_of_week: string
          end_time: string
          id?: string
          is_active?: boolean | null
          max_capacity?: number | null
          name?: string | null
          program_id: string
          school_id: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          coach_id?: string | null
          created_at?: string | null
          current_enrollment?: number | null
          day_of_week?: string
          end_time?: string
          id?: string
          is_active?: boolean | null
          max_capacity?: number | null
          name?: string | null
          program_id?: string
          school_id?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "classes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "classes_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_availability: {
        Row: {
          available_for_group_classes: boolean | null
          available_for_personal_classes: boolean | null
          coach_id: string
          created_at: string | null
          day_of_week: number
          end_time: string
          id: string
          offering_id: string | null
          school_id: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          available_for_group_classes?: boolean | null
          available_for_personal_classes?: boolean | null
          coach_id: string
          created_at?: string | null
          day_of_week: number
          end_time: string
          id?: string
          offering_id?: string | null
          school_id: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          available_for_group_classes?: boolean | null
          available_for_personal_classes?: boolean | null
          coach_id?: string
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          offering_id?: string | null
          school_id?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "public_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "school_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_certifications: {
        Row: {
          coach_id: string
          created_at: string | null
          file_name: string | null
          file_url: string | null
          id: string
          name: string
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          name: string
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_certifications_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_profiles: {
        Row: {
          created_at: string | null
          doc_number: string | null
          doc_type: string | null
          id: string
          primary_sport: string | null
          profile_completed: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          doc_number?: string | null
          doc_type?: string | null
          id: string
          primary_sport?: string | null
          profile_completed?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          doc_number?: string | null
          doc_type?: string | null
          id?: string
          primary_sport?: string | null
          profile_completed?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          assigned_to: string | null
          category: string
          created_at: string | null
          email: string
          id: string
          message: string
          name: string
          responded_at: string | null
          status: string | null
          subject: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          created_at?: string | null
          email: string
          id?: string
          message: string
          name: string
          responded_at?: string | null
          status?: string | null
          subject: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          created_at?: string | null
          email?: string
          id?: string
          message?: string
          name?: string
          responded_at?: string | null
          status?: string | null
          subject?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          child_id: string | null
          created_at: string | null
          end_date: string | null
          expires_at: string | null
          id: string
          offering_id: string | null
          offering_plan_id: string | null
          program_id: string | null
          school_id: string | null
          secondary_sessions_used: number
          sessions_used: number
          start_date: string
          status: string | null
          team_id: string | null
          unregistered_athlete_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          end_date?: string | null
          expires_at?: string | null
          id?: string
          offering_id?: string | null
          offering_plan_id?: string | null
          program_id?: string | null
          school_id?: string | null
          secondary_sessions_used?: number
          sessions_used?: number
          start_date?: string
          status?: string | null
          team_id?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          end_date?: string | null
          expires_at?: string | null
          id?: string
          offering_id?: string | null
          offering_plan_id?: string | null
          program_id?: string | null
          school_id?: string | null
          secondary_sessions_used?: number
          sessions_used?: number
          start_date?: string
          status?: string | null
          team_id?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_offering_plan_id_fkey"
            columns: ["offering_plan_id"]
            isOneToOne: false
            referencedRelation: "offering_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "enrollments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "enrollments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "enrollments_unregistered_athlete_id_fkey"
            columns: ["unregistered_athlete_id"]
            isOneToOne: false
            referencedRelation: "unregistered_athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          created_at: string
          event_id: string
          id: string
          notes: string | null
          participant_age: number | null
          participant_email: string | null
          participant_name: string
          participant_phone: string
          participant_role: string | null
          payment_proof_url: string | null
          payment_status: string | null
          rejection_reason: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          notes?: string | null
          participant_age?: number | null
          participant_email?: string | null
          participant_name: string
          participant_phone: string
          participant_role?: string | null
          payment_proof_url?: string | null
          payment_status?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          notes?: string | null
          participant_age?: number | null
          participant_email?: string | null
          participant_name?: string
          participant_phone?: string
          participant_role?: string | null
          payment_proof_url?: string | null
          payment_status?: string | null
          rejection_reason?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_telemetry: {
        Row: {
          created_at: string
          event_id: string | null
          event_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_telemetry_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          address: string
          capacity: number | null
          city: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          creator_id: string
          creator_role: string
          currency: string | null
          description: string | null
          end_time: string | null
          event_date: string
          event_type: string
          id: string
          image_url: string | null
          lat: number | null
          lng: number | null
          notes: string | null
          price: number | null
          registrations_open: boolean | null
          slug: string
          sport: string
          start_time: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          address: string
          capacity?: number | null
          city: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          creator_id: string
          creator_role: string
          currency?: string | null
          description?: string | null
          end_time?: string | null
          event_date: string
          event_type?: string
          id?: string
          image_url?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          price?: number | null
          registrations_open?: boolean | null
          slug: string
          sport: string
          start_time: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          address?: string
          capacity?: number | null
          city?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          creator_id?: string
          creator_role?: string
          currency?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string
          event_type?: string
          id?: string
          image_url?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          price?: number | null
          registrations_open?: boolean | null
          slug?: string
          sport?: string
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      facilities: {
        Row: {
          available_hours: Json | null
          booking_enabled: boolean | null
          branch_id: string | null
          capacity: number
          created_at: string
          description: string | null
          hourly_rate: number | null
          id: string
          min_deposit_pct: number
          name: string
          rental_enabled: boolean
          rental_notes: string | null
          rental_rate: number | null
          school_id: string | null
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          available_hours?: Json | null
          booking_enabled?: boolean | null
          branch_id?: string | null
          capacity?: number
          created_at?: string
          description?: string | null
          hourly_rate?: number | null
          id?: string
          min_deposit_pct?: number
          name: string
          rental_enabled?: boolean
          rental_notes?: string | null
          rental_rate?: number | null
          school_id?: string | null
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          available_hours?: Json | null
          booking_enabled?: boolean | null
          branch_id?: string | null
          capacity?: number
          created_at?: string
          description?: string | null
          hourly_rate?: number | null
          id?: string
          min_deposit_pct?: number
          name?: string
          rental_enabled?: boolean
          rental_notes?: string | null
          rental_rate?: number | null
          school_id?: string | null
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facilities_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facilities_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_reservations: {
        Row: {
          amount_paid: number
          approved_at: string | null
          approved_by: string | null
          booker_type: Database["public"]["Enums"]["booker_type"]
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string | null
          end_time: string
          external_org_name: string | null
          facility_id: string
          id: string
          min_deposit_pct: number
          notes: string | null
          participants: number | null
          payment_status: Database["public"]["Enums"]["resv_payment_status"]
          price: number | null
          reservation_date: string
          resv_type: Database["public"]["Enums"]["resv_type"]
          school_id: string | null
          start_time: string
          status: string | null
          team_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount_paid?: number
          approved_at?: string | null
          approved_by?: string | null
          booker_type?: Database["public"]["Enums"]["booker_type"]
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          end_time: string
          external_org_name?: string | null
          facility_id: string
          id?: string
          min_deposit_pct?: number
          notes?: string | null
          participants?: number | null
          payment_status?: Database["public"]["Enums"]["resv_payment_status"]
          price?: number | null
          reservation_date: string
          resv_type?: Database["public"]["Enums"]["resv_type"]
          school_id?: string | null
          start_time: string
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount_paid?: number
          approved_at?: string | null
          approved_by?: string | null
          booker_type?: Database["public"]["Enums"]["booker_type"]
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          end_time?: string
          external_org_name?: string | null
          facility_id?: string
          id?: string
          min_deposit_pct?: number
          notes?: string | null
          participants?: number | null
          payment_status?: Database["public"]["Enums"]["resv_payment_status"]
          price?: number | null
          reservation_date?: string
          resv_type?: Database["public"]["Enums"]["resv_type"]
          school_id?: string | null
          start_time?: string
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_reservations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_reservations_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_reservations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_reservations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_reservations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_reservations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_reservations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "facility_reservations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_reservations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "facility_reservations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "facility_reservations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_class_athletes: {
        Row: {
          athlete_id: string
          coach_availability_id: string
          created_at: string | null
          id: string
          school_id: string
        }
        Insert: {
          athlete_id: string
          coach_availability_id: string
          created_at?: string | null
          id?: string
          school_id: string
        }
        Update: {
          athlete_id?: string
          coach_availability_id?: string
          created_at?: string | null
          id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_class_athletes_coach_availability_id_fkey"
            columns: ["coach_availability_id"]
            isOneToOne: false
            referencedRelation: "coach_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_class_athletes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_class_athletes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_class_athletes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_class_athletes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      health_records: {
        Row: {
          athlete_id: string
          attachments: Json | null
          created_at: string
          diagnosis: string | null
          id: string
          is_demo: boolean | null
          notes: string | null
          professional_id: string
          record_type: string
          treatment: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          attachments?: Json | null
          created_at?: string
          diagnosis?: string | null
          id?: string
          is_demo?: boolean | null
          notes?: string | null
          professional_id: string
          record_type: string
          treatment?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          attachments?: Json | null
          created_at?: string
          diagnosis?: string | null
          id?: string
          is_demo?: boolean | null
          notes?: string | null
          professional_id?: string
          record_type?: string
          treatment?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_records_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          branch_id: string | null
          child_name: string | null
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          monthly_fee: number | null
          parent_phone: string | null
          program_id: string | null
          role_to_assign: string
          school_id: string | null
          status: string | null
        }
        Insert: {
          branch_id?: string | null
          child_name?: string | null
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          monthly_fee?: number | null
          parent_phone?: string | null
          program_id?: string | null
          role_to_assign: string
          school_id?: string | null
          status?: string | null
        }
        Update: {
          branch_id?: string | null
          child_name?: string | null
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          monthly_fee?: number | null
          parent_phone?: string | null
          program_id?: string | null
          role_to_assign?: string
          school_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      join_applications: {
        Row: {
          created_at: string | null
          email: string
          experience: string | null
          full_name: string
          id: string
          interests: string
          motivation: string
          notes: string | null
          phone: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          experience?: string | null
          full_name: string
          id?: string
          interests: string
          motivation: string
          notes?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          experience?: string | null
          full_name?: string
          id?: string
          interests?: string
          motivation?: string
          notes?: string | null
          phone?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      match_results: {
        Row: {
          away_score: number | null
          created_at: string | null
          home_score: number | null
          id: string
          is_home: boolean | null
          match_date: string
          match_type: string | null
          notes: string | null
          opponent: string
          opponent_team_id: string | null
          team_id: string | null
        }
        Insert: {
          away_score?: number | null
          created_at?: string | null
          home_score?: number | null
          id?: string
          is_home?: boolean | null
          match_date: string
          match_type?: string | null
          notes?: string | null
          opponent: string
          opponent_team_id?: string | null
          team_id?: string | null
        }
        Update: {
          away_score?: number | null
          created_at?: string | null
          home_score?: number | null
          id?: string
          is_home?: boolean | null
          match_date?: string
          match_type?: string | null
          notes?: string | null
          opponent?: string
          opponent_team_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_results_opponent_team_id_fkey"
            columns: ["opponent_team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_results_opponent_team_id_fkey"
            columns: ["opponent_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_opponent_team_id_fkey"
            columns: ["opponent_team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "match_results_opponent_team_id_fkey"
            columns: ["opponent_team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "match_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      message_attachments: {
        Row: {
          created_at: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          message_id: string
        }
        Insert: {
          created_at?: string | null
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          message_id: string
        }
        Update: {
          created_at?: string | null
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read: boolean | null
          recipient_id: string | null
          sender_id: string | null
          subject: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read?: boolean | null
          recipient_id?: string | null
          sender_id?: string | null
          subject: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read?: boolean | null
          recipient_id?: string | null
          sender_id?: string | null
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          read?: boolean | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      offering_coaches: {
        Row: {
          coach_id: string
          created_at: string | null
          id: string
          offering_id: string
          school_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string | null
          id?: string
          offering_id: string
          school_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string | null
          id?: string
          offering_id?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offering_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "public_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "school_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_coaches_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_coaches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_coaches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_coaches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_coaches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      offering_plans: {
        Row: {
          auto_renew: boolean
          created_at: string
          currency: string
          description: string | null
          duration_days: number
          id: string
          is_active: boolean
          max_secondary_sessions: number | null
          max_sessions: number | null
          metadata: Json
          name: string
          offering_id: string
          price: number
          school_id: string
          slot_duration_minutes: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          max_secondary_sessions?: number | null
          max_sessions?: number | null
          metadata?: Json
          name: string
          offering_id: string
          price: number
          school_id: string
          slot_duration_minutes?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean
          max_secondary_sessions?: number | null
          max_sessions?: number | null
          metadata?: Json
          name?: string
          offering_id?: string
          price?: number
          school_id?: string
          slot_duration_minutes?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offering_plans_offering_id_fkey"
            columns: ["offering_id"]
            isOneToOne: false
            referencedRelation: "offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offering_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      offerings: {
        Row: {
          branch_id: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          metadata: Json
          name: string
          offering_type: Database["public"]["Enums"]["offering_type"]
          school_id: string
          sort_order: number
          sport: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          offering_type: Database["public"]["Enums"]["offering_type"]
          school_id: string
          sort_order?: number
          sport?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          offering_type?: Database["public"]["Enums"]["offering_type"]
          school_id?: string
          sort_order?: number
          sport?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "offerings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offerings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string | null
          product_id: string | null
          quantity: number | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          product_id?: string | null
          quantity?: number | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          product_id?: string | null
          quantity?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          payment_method: string | null
          shipping_address: Json | null
          status: string | null
          total_amount: number
          user_id: string | null
        }
        Insert: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          payment_method?: string | null
          shipping_address?: Json | null
          status?: string | null
          total_amount: number
          user_id?: string | null
        }
        Update: {
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          payment_method?: string | null
          shipping_address?: Json | null
          status?: string | null
          total_amount?: number
          user_id?: string | null
        }
        Relationships: []
      }
      payment_audit_logs: {
        Row: {
          changed_by: string | null
          created_at: string | null
          id: string
          new_status: string | null
          notes: string | null
          old_status: string | null
          payment_id: string | null
          school_id: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          payment_id?: string | null
          school_id?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          payment_id?: string | null
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_audit_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_audit_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments_with_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_audit_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_installments: {
        Row: {
          amount: number
          athlete_id: string | null
          created_at: string
          id: string
          notes: string | null
          orc_amount: number | null
          orc_mismatch_reason: string | null
          orc_receipt_date: string | null
          orc_validated: boolean
          parent_id: string | null
          payment_id: string
          receipt_date: string
          receipt_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          athlete_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          orc_amount?: number | null
          orc_mismatch_reason?: string | null
          orc_receipt_date?: string | null
          orc_validated?: boolean
          parent_id?: string | null
          payment_id: string
          receipt_date: string
          receipt_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          athlete_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          orc_amount?: number | null
          orc_mismatch_reason?: string | null
          orc_receipt_date?: string | null
          orc_validated?: boolean
          parent_id?: string | null
          payment_id?: string
          receipt_date?: string
          receipt_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_installments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments_with_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminders: {
        Row: {
          created_at: string | null
          id: string
          payment_id: string
          reminded_at: string | null
          reminder_type: string
          sent: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          payment_id: string
          reminded_at?: string | null
          reminder_type: string
          sent?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          payment_id?: string
          reminded_at?: string | null
          reminder_type?: string
          sent?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments_with_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          amount_paid: number | null
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          child_id: string | null
          coach_id: string | null
          concept: string
          created_at: string
          due_date: string
          id: string
          parent_id: string
          payment_date: string | null
          payment_method: string | null
          payment_type: string | null
          program_id: string | null
          receipt_number: string | null
          receipt_url: string | null
          reference: string | null
          rejection_reason: string | null
          school_id: string | null
          status: string
          subscription_end_date: string | null
          subscription_start_date: string | null
          team_id: string | null
          unregistered_athlete_id: string | null
          updated_at: string
          wompi_id: string | null
        }
        Insert: {
          amount: number
          amount_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          child_id?: string | null
          coach_id?: string | null
          concept: string
          created_at?: string
          due_date: string
          id?: string
          parent_id: string
          payment_date?: string | null
          payment_method?: string | null
          payment_type?: string | null
          program_id?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          reference?: string | null
          rejection_reason?: string | null
          school_id?: string | null
          status: string
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          team_id?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string
          wompi_id?: string | null
        }
        Update: {
          amount?: number
          amount_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          child_id?: string | null
          coach_id?: string | null
          concept?: string
          created_at?: string
          due_date?: string
          id?: string
          parent_id?: string
          payment_date?: string | null
          payment_method?: string | null
          payment_type?: string | null
          program_id?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          reference?: string | null
          rejection_reason?: string | null
          school_id?: string | null
          status?: string
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          team_id?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string
          wompi_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "payments_unregistered_athlete_id_fkey"
            columns: ["unregistered_athlete_id"]
            isOneToOne: false
            referencedRelation: "unregistered_athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          profile_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          profile_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_admins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          school_id: string | null
          stock: number
          updated_at: string | null
          vendor_id: string | null
        }
        Insert: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price?: number
          school_id?: string | null
          stock?: number
          updated_at?: string | null
          vendor_id?: string | null
        }
        Update: {
          active?: boolean | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          school_id?: string | null
          stock?: number
          updated_at?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          billing_address: string | null
          billing_city_dane: string | null
          billing_state_dane: string | null
          bio: string | null
          created_at: string | null
          date_of_birth: string | null
          document_number: string | null
          document_type: string | null
          email: string | null
          experience_level: string | null
          full_name: string | null
          gender: string | null
          id: string
          invitation_code: string | null
          is_demo: boolean | null
          is_verified: boolean | null
          location: string | null
          onboarding_completed: boolean | null
          onboarding_started: boolean | null
          phone: string | null
          preferences: Json | null
          role: Database["public"]["Enums"]["user_role"]
          role_id: string | null
          sportmaps_points: number | null
          sports_interests: string[]
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          billing_address?: string | null
          billing_city_dane?: string | null
          billing_state_dane?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          experience_level?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          invitation_code?: string | null
          is_demo?: boolean | null
          is_verified?: boolean | null
          location?: string | null
          onboarding_completed?: boolean | null
          onboarding_started?: boolean | null
          phone?: string | null
          preferences?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          role_id?: string | null
          sportmaps_points?: number | null
          sports_interests?: string[]
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          billing_address?: string | null
          billing_city_dane?: string | null
          billing_state_dane?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          document_number?: string | null
          document_type?: string | null
          email?: string | null
          experience_level?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          invitation_code?: string | null
          is_demo?: boolean | null
          is_verified?: boolean | null
          location?: string | null
          onboarding_completed?: boolean | null
          onboarding_started?: boolean | null
          phone?: string | null
          preferences?: Json | null
          role?: Database["public"]["Enums"]["user_role"]
          role_id?: string | null
          sportmaps_points?: number | null
          sports_interests?: string[]
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          active: boolean
          age_max: number | null
          age_min: number | null
          branch_id: string | null
          coach_id: string | null
          created_at: string
          description: string | null
          facility_id: string | null
          id: string
          image_url: string | null
          is_demo: boolean
          level: Database["public"]["Enums"]["program_level"]
          max_participants: number | null
          name: string
          price_monthly: number
          schedule: Json | null
          school_id: string
          sport: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          age_max?: number | null
          age_min?: number | null
          branch_id?: string | null
          coach_id?: string | null
          created_at?: string
          description?: string | null
          facility_id?: string | null
          id?: string
          image_url?: string | null
          is_demo?: boolean
          level?: Database["public"]["Enums"]["program_level"]
          max_participants?: number | null
          name: string
          price_monthly?: number
          schedule?: Json | null
          school_id: string
          sport: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          age_max?: number | null
          age_min?: number | null
          branch_id?: string | null
          coach_id?: string | null
          created_at?: string
          description?: string | null
          facility_id?: string | null
          id?: string
          image_url?: string | null
          is_demo?: boolean
          level?: Database["public"]["Enums"]["program_level"]
          max_participants?: number | null
          name?: string
          price_monthly?: number
          schedule?: Json | null
          school_id?: string
          sport?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "programs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reservation_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["pay_method"]
          receipt_url: string | null
          rejection_reason: string | null
          reservation_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["pay_method"]
          receipt_url?: string | null
          rejection_reason?: string | null
          reservation_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["pay_method"]
          receipt_url?: string | null
          rejection_reason?: string | null
          reservation_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservation_payments_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "facility_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          school_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          school_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          school_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          is_visible: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_visible?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_visible?: boolean | null
          name?: string
        }
        Relationships: []
      }
      school_availability: {
        Row: {
          available_for_group_classes: boolean | null
          available_for_personal_classes: boolean | null
          branch_id: string | null
          created_at: string | null
          day_of_week: number
          end_time: string
          exceptions: Json | null
          id: string
          instructor_id: string | null
          is_active: boolean | null
          max_capacity: number
          program_id: string | null
          school_id: string
          start_time: string
          updated_at: string | null
        }
        Insert: {
          available_for_group_classes?: boolean | null
          available_for_personal_classes?: boolean | null
          branch_id?: string | null
          created_at?: string | null
          day_of_week: number
          end_time: string
          exceptions?: Json | null
          id?: string
          instructor_id?: string | null
          is_active?: boolean | null
          max_capacity?: number
          program_id?: string | null
          school_id: string
          start_time: string
          updated_at?: string | null
        }
        Update: {
          available_for_group_classes?: boolean | null
          available_for_personal_classes?: boolean | null
          branch_id?: string | null
          created_at?: string | null
          day_of_week?: number
          end_time?: string
          exceptions?: Json | null
          id?: string
          instructor_id?: string | null
          is_active?: boolean | null
          max_capacity?: number
          program_id?: string | null
          school_id?: string
          start_time?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_availability_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_branches: {
        Row: {
          address: string | null
          capacity: number | null
          city: string | null
          created_at: string
          id: string
          is_main: boolean | null
          lat: number | null
          lng: number | null
          name: string
          phone: string | null
          school_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          created_at?: string
          id?: string
          is_main?: boolean | null
          lat?: number | null
          lng?: number | null
          name: string
          phone?: string | null
          school_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          capacity?: number | null
          city?: string | null
          created_at?: string
          id?: string
          is_main?: boolean | null
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string | null
          school_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_branches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_branches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_branches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_branches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_members: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string
          profile_id: string
          role: string
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          profile_id: string
          role?: string
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          profile_id?: string
          role?: string
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_members_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_settings: {
        Row: {
          active_modules: string[]
          allow_coach_messaging: boolean | null
          allow_multiple_enrollments: boolean | null
          auto_generate_payments: boolean | null
          bank_account_number: string | null
          bank_account_type: string | null
          bank_name: string | null
          bank_titular_id: string | null
          bank_titular_name: string | null
          billing_cycle_type: string
          coach_can_request_reminders: boolean | null
          coach_can_send_reminders: boolean | null
          created_at: string | null
          daviplata_number: string | null
          late_fee_enabled: boolean | null
          late_fee_percentage: number | null
          nequi_number: string | null
          payment_cutoff_day: number | null
          payment_grace_days: number | null
          payment_qr_url: string | null
          public_profile_enabled: boolean
          reminder_days_before: number | null
          reminder_enabled: boolean | null
          require_payment_proof: boolean | null
          responsible_payment_policy: string | null
          school_id: string
          show_facilities: boolean
          show_plans: boolean
          show_programs: boolean
          updated_at: string | null
        }
        Insert: {
          active_modules?: string[]
          allow_coach_messaging?: boolean | null
          allow_multiple_enrollments?: boolean | null
          auto_generate_payments?: boolean | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          bank_titular_id?: string | null
          bank_titular_name?: string | null
          billing_cycle_type?: string
          coach_can_request_reminders?: boolean | null
          coach_can_send_reminders?: boolean | null
          created_at?: string | null
          daviplata_number?: string | null
          late_fee_enabled?: boolean | null
          late_fee_percentage?: number | null
          nequi_number?: string | null
          payment_cutoff_day?: number | null
          payment_grace_days?: number | null
          payment_qr_url?: string | null
          public_profile_enabled?: boolean
          reminder_days_before?: number | null
          reminder_enabled?: boolean | null
          require_payment_proof?: boolean | null
          responsible_payment_policy?: string | null
          school_id: string
          show_facilities?: boolean
          show_plans?: boolean
          show_programs?: boolean
          updated_at?: string | null
        }
        Update: {
          active_modules?: string[]
          allow_coach_messaging?: boolean | null
          allow_multiple_enrollments?: boolean | null
          auto_generate_payments?: boolean | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          bank_titular_id?: string | null
          bank_titular_name?: string | null
          billing_cycle_type?: string
          coach_can_request_reminders?: boolean | null
          coach_can_send_reminders?: boolean | null
          created_at?: string | null
          daviplata_number?: string | null
          late_fee_enabled?: boolean | null
          late_fee_percentage?: number | null
          nequi_number?: string | null
          payment_cutoff_day?: number | null
          payment_grace_days?: number | null
          payment_qr_url?: string | null
          public_profile_enabled?: boolean
          reminder_days_before?: number | null
          reminder_enabled?: boolean | null
          require_payment_proof?: boolean | null
          responsible_payment_policy?: string | null
          school_id?: string
          show_facilities?: boolean
          show_plans?: boolean
          show_programs?: boolean
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_staff: {
        Row: {
          branch_id: string | null
          certifications: string[] | null
          coach_auth_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          school_id: string | null
          specialty: string | null
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          certifications?: string[] | null
          coach_auth_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          phone?: string | null
          school_id?: string | null
          specialty?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          certifications?: string[] | null
          coach_auth_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          school_id?: string | null
          specialty?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_staff_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          accepts_reservations: boolean | null
          address: string | null
          amenities: string[] | null
          avg_rating: number | null
          branding_settings: Json
          category_id: string | null
          certifications: string[] | null
          city: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          email: string | null
          id: string
          is_demo: boolean | null
          levels_offered: string[] | null
          logo_url: string | null
          name: string
          onboarding_status: string | null
          onboarding_step: number | null
          owner_id: string | null
          payment_settings: Json | null
          phone: string | null
          pricing: Json | null
          rating: number | null
          review_count: number | null
          schedule: Json | null
          school_type: string | null
          sports: string[] | null
          total_reviews: number | null
          updated_at: string | null
          verified: boolean | null
          website: string | null
        }
        Insert: {
          accepts_reservations?: boolean | null
          address?: string | null
          amenities?: string[] | null
          avg_rating?: number | null
          branding_settings?: Json
          category_id?: string | null
          certifications?: string[] | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean | null
          levels_offered?: string[] | null
          logo_url?: string | null
          name: string
          onboarding_status?: string | null
          onboarding_step?: number | null
          owner_id?: string | null
          payment_settings?: Json | null
          phone?: string | null
          pricing?: Json | null
          rating?: number | null
          review_count?: number | null
          schedule?: Json | null
          school_type?: string | null
          sports?: string[] | null
          total_reviews?: number | null
          updated_at?: string | null
          verified?: boolean | null
          website?: string | null
        }
        Update: {
          accepts_reservations?: boolean | null
          address?: string | null
          amenities?: string[] | null
          avg_rating?: number | null
          branding_settings?: Json
          category_id?: string | null
          certifications?: string[] | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          description?: string | null
          email?: string | null
          id?: string
          is_demo?: boolean | null
          levels_offered?: string[] | null
          logo_url?: string | null
          name?: string
          onboarding_status?: string | null
          onboarding_step?: number | null
          owner_id?: string | null
          payment_settings?: Json | null
          phone?: string | null
          pricing?: Json | null
          rating?: number | null
          review_count?: number | null
          schedule?: Json | null
          school_type?: string | null
          sports?: string[] | null
          total_reviews?: number | null
          updated_at?: string | null
          verified?: boolean | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schools_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "sports_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      session_attendance: {
        Row: {
          created_at: string
          id: string
          player_id: string
          session_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          session_id: string
          status: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          session_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_attendance_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_attendance_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_bookings: {
        Row: {
          booked_at: string
          booking_type: string
          cancelled_at: string | null
          cancelled_reason: string | null
          child_id: string | null
          corrected_at: string | null
          corrected_by: string | null
          correction_reason: string | null
          created_at: string
          enrollment_id: string
          id: string
          is_corrected: boolean
          is_secondary: boolean
          school_id: string
          session_id: string
          status: Database["public"]["Enums"]["booking_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          booked_at?: string
          booking_type?: string
          cancelled_at?: string | null
          cancelled_reason?: string | null
          child_id?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          correction_reason?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          is_corrected?: boolean
          is_secondary?: boolean
          school_id: string
          session_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          booked_at?: string
          booking_type?: string
          cancelled_at?: string | null
          cancelled_reason?: string | null
          child_id?: string | null
          corrected_at?: string | null
          corrected_by?: string | null
          correction_reason?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          is_corrected?: boolean
          is_secondary?: boolean
          school_id?: string
          session_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_bookings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_bookings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_bookings_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_bookings_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "session_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_bookable_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_configs: {
        Row: {
          categorization_axis: Database["public"]["Enums"]["categorization_axis"]
          created_at: string
          id: string
          is_active: boolean
          rules: Json
          school_id: string
          settings: Json
          sport: string
          updated_at: string
        }
        Insert: {
          categorization_axis?: Database["public"]["Enums"]["categorization_axis"]
          created_at?: string
          id?: string
          is_active?: boolean
          rules?: Json
          school_id: string
          settings?: Json
          sport: string
          updated_at?: string
        }
        Update: {
          categorization_axis?: Database["public"]["Enums"]["categorization_axis"]
          created_at?: string
          id?: string
          is_active?: boolean
          rules?: Json
          school_id?: string
          settings?: Json
          sport?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sport_configs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_configs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_configs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sport_configs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_categories: {
        Row: {
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      sports_equipment: {
        Row: {
          brand: string | null
          category_id: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          image_url: string | null
          is_available: boolean | null
          name: string
          price: number | null
          specifications: Json | null
          stock_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name: string
          price?: number | null
          specifications?: Json | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_available?: boolean | null
          name?: string
          price?: number | null
          specifications?: Json | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sports_equipment_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "sports_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      system_errors: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          payload: Json | null
          source: string
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          source: string
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          payload?: Json | null
          source?: string
        }
        Relationships: []
      }
      team_branches: {
        Row: {
          branch_id: string | null
          created_at: string | null
          id: string
          school_id: string | null
          team_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          school_id?: string | null
          team_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          school_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_branches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_branches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_branches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_branches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_branches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_branches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_branches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "team_branches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      team_coaches: {
        Row: {
          coach_id: string | null
          created_at: string | null
          id: string
          school_id: string | null
          team_id: string | null
        }
        Insert: {
          coach_id?: string | null
          created_at?: string | null
          id?: string
          school_id?: string | null
          team_id?: string | null
        }
        Update: {
          coach_id?: string | null
          created_at?: string | null
          id?: string
          school_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "public_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "school_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_coaches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_coaches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_coaches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_coaches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_coaches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_coaches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_coaches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "team_coaches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string | null
          id: string
          parent_contact: string | null
          player_name: string
          player_number: number | null
          position: string | null
          profile_id: string | null
          team_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          parent_contact?: string | null
          player_name: string
          player_number?: number | null
          position?: string | null
          profile_id?: string | null
          team_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          parent_contact?: string | null
          player_name?: string
          player_number?: number | null
          position?: string | null
          profile_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      teams: {
        Row: {
          active: boolean | null
          age_group: string | null
          age_max: number | null
          age_min: number | null
          branch_id: string | null
          coach_id: string | null
          created_at: string | null
          current_students: number | null
          description: string | null
          facility_id: string | null
          id: string
          image_url: string | null
          is_demo: boolean | null
          level: string | null
          location: string | null
          losses: number | null
          max_students: number | null
          name: string
          price_monthly: number | null
          program_id: string | null
          schedule: Json | null
          school_id: string | null
          season: string | null
          sport: string
          status: string | null
          student_count: number
          updated_at: string | null
          wins: number | null
        }
        Insert: {
          active?: boolean | null
          age_group?: string | null
          age_max?: number | null
          age_min?: number | null
          branch_id?: string | null
          coach_id?: string | null
          created_at?: string | null
          current_students?: number | null
          description?: string | null
          facility_id?: string | null
          id?: string
          image_url?: string | null
          is_demo?: boolean | null
          level?: string | null
          location?: string | null
          losses?: number | null
          max_students?: number | null
          name: string
          price_monthly?: number | null
          program_id?: string | null
          schedule?: Json | null
          school_id?: string | null
          season?: string | null
          sport: string
          status?: string | null
          student_count?: number
          updated_at?: string | null
          wins?: number | null
        }
        Update: {
          active?: boolean | null
          age_group?: string | null
          age_max?: number | null
          age_min?: number | null
          branch_id?: string | null
          coach_id?: string | null
          created_at?: string | null
          current_students?: number | null
          description?: string | null
          facility_id?: string | null
          id?: string
          image_url?: string | null
          is_demo?: boolean | null
          level?: string | null
          location?: string | null
          losses?: number | null
          max_students?: number | null
          name?: string
          price_monthly?: number | null
          program_id?: string | null
          schedule?: Json | null
          school_id?: string | null
          season?: string | null
          sport?: string
          status?: string | null
          student_count?: number
          updated_at?: string | null
          wins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "public_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "school_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      training_logs: {
        Row: {
          athlete_id: string
          calories_burned: number | null
          created_at: string
          duration_minutes: number
          exercise_type: string
          id: string
          intensity: string | null
          is_demo: boolean | null
          notes: string | null
          training_date: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          calories_burned?: number | null
          created_at?: string
          duration_minutes: number
          exercise_type: string
          id?: string
          intensity?: string | null
          is_demo?: boolean | null
          notes?: string | null
          training_date?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          calories_burned?: number | null
          created_at?: string
          duration_minutes?: number
          exercise_type?: string
          id?: string
          intensity?: string | null
          is_demo?: boolean | null
          notes?: string | null
          training_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_logs_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_plans: {
        Row: {
          created_at: string
          drills: Json | null
          id: string
          materials: string | null
          notes: string | null
          objectives: string
          plan_date: string
          team_id: string
          updated_at: string
          warmup: string | null
        }
        Insert: {
          created_at?: string
          drills?: Json | null
          id?: string
          materials?: string | null
          notes?: string | null
          objectives: string
          plan_date: string
          team_id: string
          updated_at?: string
          warmup?: string | null
        }
        Update: {
          created_at?: string
          drills?: Json | null
          id?: string
          materials?: string | null
          notes?: string | null
          objectives?: string
          plan_date?: string
          team_id?: string
          updated_at?: string
          warmup?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_plans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "training_plans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_plans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "training_plans_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      training_sessions: {
        Row: {
          created_at: string
          current_bookings: number | null
          id: string
          max_capacity: number | null
          session_date: string
          session_time: string | null
          team_id: string
        }
        Insert: {
          created_at?: string
          current_bookings?: number | null
          id?: string
          max_capacity?: number | null
          session_date: string
          session_time?: string | null
          team_id: string
        }
        Update: {
          created_at?: string
          current_bookings?: number | null
          id?: string
          max_capacity?: number | null
          session_date?: string
          session_time?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "training_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "training_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      unregistered_athletes: {
        Row: {
          branch_id: string | null
          created_at: string
          date_of_birth: string | null
          doc_number: string | null
          doc_type: string | null
          email: string | null
          full_name: string
          gender: string | null
          id: string
          invitation_id: string | null
          is_active: boolean
          linked_profile_id: string | null
          phone: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          invitation_id?: string | null
          is_active?: boolean
          linked_profile_id?: string | null
          phone?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          invitation_id?: string | null
          is_active?: boolean
          linked_profile_id?: string | null
          phone?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unregistered_athletes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unregistered_athletes_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unregistered_athletes_linked_profile_id_fkey"
            columns: ["linked_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unregistered_athletes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unregistered_athletes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unregistered_athletes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unregistered_athletes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_favorites: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          school_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          school_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          school_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_favorites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_favorites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      user_search_preferences: {
        Row: {
          created_at: string | null
          id: string
          max_age: number | null
          max_price: number | null
          min_age: number | null
          preferred_amenities: string[] | null
          preferred_cities: string[] | null
          preferred_sports: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_age?: number | null
          max_price?: number | null
          min_age?: number | null
          preferred_amenities?: string[] | null
          preferred_cities?: string[] | null
          preferred_sports?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          max_age?: number | null
          max_price?: number | null
          min_age?: number | null
          preferred_amenities?: string[] | null
          preferred_cities?: string[] | null
          preferred_sports?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      wellness_appointments: {
        Row: {
          appointment_date: string
          appointment_time: string
          athlete_id: string | null
          athlete_name: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          is_demo: boolean | null
          notes: string | null
          professional_id: string
          service_type: string
          status: string
          updated_at: string
        }
        Insert: {
          appointment_date: string
          appointment_time: string
          athlete_id?: string | null
          athlete_name?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_demo?: boolean | null
          notes?: string | null
          professional_id: string
          service_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          appointment_time?: string
          athlete_id?: string | null
          athlete_name?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          is_demo?: boolean | null
          notes?: string | null
          professional_id?: string
          service_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_appointments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wellness_evaluations: {
        Row: {
          athlete_id: string | null
          created_at: string | null
          date: string
          id: string
          notes: string | null
          professional_id: string | null
          status: string | null
          type: string | null
        }
        Insert: {
          athlete_id?: string | null
          created_at?: string | null
          date: string
          id?: string
          notes?: string | null
          professional_id?: string | null
          status?: string | null
          type?: string | null
        }
        Update: {
          athlete_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          professional_id?: string | null
          status?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wellness_evaluations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      class_capacity: {
        Row: {
          class_id: string | null
          current_enrollment: number | null
          max_capacity: number | null
          spots_available: number | null
        }
        Relationships: []
      }
      payments_with_installments: {
        Row: {
          amount: number | null
          amount_paid: number | null
          approved_at: string | null
          approved_by: string | null
          balance_pending: number | null
          branch_id: string | null
          child_id: string | null
          coach_id: string | null
          concept: string | null
          created_at: string | null
          due_date: string | null
          has_orc_warnings: boolean | null
          id: string | null
          installments_approved: number | null
          installments_count: number | null
          installments_pending: number | null
          installments_rejected: number | null
          parent_id: string | null
          payment_date: string | null
          payment_method: string | null
          payment_type: string | null
          pct_paid: number | null
          program_id: string | null
          receipt_number: string | null
          receipt_url: string | null
          reference: string | null
          rejection_reason: string | null
          school_id: string | null
          status: string | null
          subscription_end_date: string | null
          subscription_start_date: string | null
          team_id: string | null
          updated_at: string | null
          wompi_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      pending_payments: {
        Row: {
          amount: number | null
          amount_paid: number | null
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          child_id: string | null
          child_name: string | null
          coach_id: string | null
          concept: string | null
          created_at: string | null
          due_date: string | null
          id: string | null
          parent_id: string | null
          parent_name: string | null
          payment_date: string | null
          payment_method: string | null
          payment_type: string | null
          program_id: string | null
          receipt_number: string | null
          receipt_url: string | null
          reference: string | null
          rejection_reason: string | null
          school_id: string | null
          school_name: string | null
          status: string | null
          subscription_end_date: string | null
          subscription_start_date: string | null
          team_id: string | null
          updated_at: string | null
          wompi_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "payments_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      public_staff: {
        Row: {
          full_name: string | null
          id: string | null
          school_id: string | null
          specialty: string | null
          status: string | null
        }
        Insert: {
          full_name?: string | null
          id?: string | null
          school_id?: string | null
          specialty?: string | null
          status?: string | null
        }
        Update: {
          full_name?: string | null
          id?: string | null
          school_id?: string | null
          specialty?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_athletes: {
        Row: {
          athlete_type: string | null
          avatar_url: string | null
          branch_id: string | null
          branch_name: string | null
          date_of_birth: string | null
          enrolled_team_id: string | null
          enrollment_id: string | null
          enrollment_status: string | null
          expires_at: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          offering_plan_id: string | null
          parent_email: string | null
          parent_id: string | null
          parent_name: string | null
          parent_phone: string | null
          price_monthly: number | null
          school_id: string | null
          secondary_sessions_used: number | null
          sessions_used: number | null
          team_id: string | null
          team_name: string | null
          team_sport: string | null
          user_id: string | null
        }
        Relationships: []
      }
      school_detail_view: {
        Row: {
          address: string | null
          amenities: string[] | null
          avg_rating: number | null
          branches: Json | null
          branches_count: number | null
          branding_settings: Json | null
          category_icon: string | null
          category_name: string | null
          certifications: string[] | null
          city: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          email: string | null
          facilities_detail: Json | null
          id: string | null
          is_open_now: boolean | null
          levels_offered: string[] | null
          logo_url: string | null
          main_lat: number | null
          main_lng: number | null
          max_plan_price: number | null
          max_price: number | null
          min_plan_price: number | null
          min_price: number | null
          name: string | null
          offerings_detail: Json | null
          payment_settings: Json | null
          phone: string | null
          program_count: number | null
          program_sports: string[] | null
          programs_detail: Json | null
          rating_distribution: Json | null
          recent_reviews: Json | null
          review_count: number | null
          school_type: string | null
          show_facilities: boolean | null
          show_plans: boolean | null
          show_programs: boolean | null
          sports: string[] | null
          staff: Json | null
          verified: boolean | null
          website: string | null
        }
        Relationships: []
      }
      school_price_range: {
        Row: {
          id: string | null
          max_plan_price: number | null
          max_price: number | null
          min_plan_price: number | null
          min_price: number | null
          program_count: number | null
        }
        Relationships: []
      }
      school_public_profile: {
        Row: {
          address: string | null
          amenities: string[] | null
          avg_rating: number | null
          branches_count: number | null
          branding_settings: Json | null
          category_icon: string | null
          category_name: string | null
          certifications: string[] | null
          city: string | null
          cover_image_url: string | null
          created_at: string | null
          description: string | null
          email: string | null
          id: string | null
          levels_offered: string[] | null
          logo_url: string | null
          main_lat: number | null
          main_lng: number | null
          max_plan_price: number | null
          max_price: number | null
          min_plan_price: number | null
          min_price: number | null
          name: string | null
          payment_settings: Json | null
          phone: string | null
          program_count: number | null
          program_sports: string[] | null
          review_count: number | null
          school_type: string | null
          show_facilities: boolean | null
          show_plans: boolean | null
          show_programs: boolean | null
          sports: string[] | null
          verified: boolean | null
          website: string | null
        }
        Relationships: []
      }
      school_ratings: {
        Row: {
          rating: number | null
          school_id: string | null
          total_reviews: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          branch_name: string | null
          created_at: string | null
          date_of_birth: string | null
          emergency_contact: string | null
          enrollment_date: string | null
          enrollment_id: string | null
          enrollment_status: string | null
          full_name: string | null
          grade: string | null
          id: string | null
          is_active: boolean | null
          medical_info: string | null
          parent_avatar: string | null
          parent_email: string | null
          parent_id: string | null
          parent_name: string | null
          parent_phone: string | null
          price_monthly: number | null
          program_id: string | null
          program_name: string | null
          program_sport: string | null
          school_id: string | null
          status: string | null
          team_id: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "children_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "children_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "children_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "children_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "children_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      team_capacity: {
        Row: {
          current_students: number | null
          max_students: number | null
          spots_available: number | null
          team_id: string | null
        }
        Relationships: []
      }
      teams_full_view: {
        Row: {
          actual_students: number | null
          age_group: string | null
          branch_id: string | null
          branch_name: string | null
          coach_id: string | null
          coach_name: string | null
          current_students: number | null
          level: string | null
          max_students: number | null
          price_monthly: number | null
          program_id: string | null
          program_name: string | null
          program_sport: string | null
          school_id: string | null
          season: string | null
          sport: string | null
          status: boolean | null
          team_id: string | null
          team_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "public_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "school_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      v_bookable_sessions: {
        Row: {
          available_spots: number | null
          booking_status: string | null
          coach_id: string | null
          coach_name: string | null
          current_bookings: number | null
          end_time: string | null
          finalized: boolean | null
          id: string | null
          max_capacity: number | null
          school_id: string | null
          session_date: string | null
          start_time: string | null
          team_id: string | null
          team_name: string | null
          team_sport: string | null
          title: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "public_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "school_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "attendance_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "attendance_sessions_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { p_invite_id: string }; Returns: boolean }
      accept_invitation_pro: { Args: { p_invite_id: string }; Returns: boolean }
      add_platform_admin: {
        Args: { admin_email: string; note?: string }
        Returns: Json
      }
      add_reservation_payment: {
        Args: {
          p_amount: number
          p_method?: string
          p_notes?: string
          p_receipt_url?: string
          p_reservation_id: string
        }
        Returns: Json
      }
      admin_create_staff_direct: {
        Args: { p_branch_id: string; p_email: string; p_role: string }
        Returns: undefined
      }
      check_is_branch_admin: {
        Args: { check_branch_id: string }
        Returns: boolean
      }
      check_is_school_admin: {
        Args: { check_school_id: string }
        Returns: boolean
      }
      check_is_school_admin_safe: {
        Args: { p_school_id: string }
        Returns: boolean
      }
      check_is_school_member: {
        Args: { check_school_id: string }
        Returns: boolean
      }
      check_is_school_member_safe: {
        Args: { lookup_school_id: string }
        Returns: boolean
      }
      coach_school_ids: { Args: never; Returns: string[] }
      coach_team_ids: { Args: never; Returns: string[] }
      create_invitation: {
        Args: {
          p_branch_id?: string
          p_child_name?: string
          p_email: string
          p_monthly_fee?: number
          p_parent_phone?: string
          p_program_id?: string
          p_role: string
        }
        Returns: string
      }
      decrement_session_bookings: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      enroll_student: {
        Args: {
          p_class_id: string
          p_program_id?: string
          p_school_id: string
          p_student_id: string
        }
        Returns: Json
      }
      fn_extend_session_horizon: {
        Args: {
          p_min_weeks?: number
          p_school_id: string
          p_target_weeks?: number
        }
        Returns: number
      }
      fn_generate_bookable_sessions: {
        Args: { p_school_id: string; p_team_id: string; p_weeks?: number }
        Returns: {
          coach_id: string
          end_time: string
          session_date: string
          session_id: string
          start_time: string
          was_created: boolean
        }[]
      }
      fn_generate_offering_sessions: {
        Args: { p_offering_id: string; p_school_id: string; p_weeks?: number }
        Returns: {
          coach_id: string
          end_time: string
          session_date: string
          session_id: string
          start_time: string
          was_created: boolean
        }[]
      }
      fn_generate_sessions_for_offering: {
        Args: { p_offering_id: string; p_school_id: string; p_weeks?: number }
        Returns: {
          coach_id: string
          end_time: string
          session_date: string
          session_id: string
          start_time: string
          was_created: boolean
        }[]
      }
      fn_is_admin_of_school: {
        Args: { lookup_school_id: string }
        Returns: boolean
      }
      fn_sync_all_offering_sessions: {
        Args: { p_school_id: string; p_weeks?: number }
        Returns: number
      }
      generate_event_slug: { Args: { title: string }; Returns: string }
      get_athlete_dashboard_stats: { Args: never; Returns: Json }
      get_athlete_enrollments: { Args: never; Returns: Json }
      get_athlete_payments:
        | {
            Args: { p_limit?: number; p_page?: number; p_status?: string }
            Returns: Json
          }
        | {
            Args: { p_limit?: number; p_page?: number; p_status?: string }
            Returns: Json
          }
      get_distance_km: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      get_event_approved_count: {
        Args: { event_uuid: string }
        Returns: number
      }
      get_event_available_spots: {
        Args: { event_uuid: string }
        Returns: number
      }
      get_facility_availability: {
        Args: { p_date: string; p_facility_id: string }
        Returns: Json
      }
      get_invitation_details: {
        Args: { p_invite_id: string }
        Returns: {
          branch_name: string
          child_name: string
          monthly_fee: number
          program_name: string
          role_to_assign: string
          school_name: string
          status: string
        }[]
      }
      get_my_administered_school_ids: { Args: never; Returns: string[] }
      get_my_favorites: { Args: never; Returns: Json }
      get_my_invitations: {
        Args: never
        Returns: {
          id: string
          role_to_assign: string
          school_name: string
          status: string
        }[]
      }
      get_my_schools: { Args: never; Returns: string[] }
      get_my_settings: { Args: never; Returns: Json }
      get_onboarding_status:
        | { Args: never; Returns: Json }
        | { Args: { v_user_id: string }; Returns: Json }
      get_public_program_slots:
        | {
            Args: {
              p_branch_id?: string
              p_program_id?: string
              p_school_id: string
              p_team_id?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_branch_id?: string
              p_school_id: string
              p_team_id?: string
            }
            Returns: Json
          }
      get_school_athletes:
        | {
            Args: { p_school_id: string }
            Returns: {
              athlete_type: string | null
              avatar_url: string | null
              branch_id: string | null
              branch_name: string | null
              date_of_birth: string | null
              enrolled_team_id: string | null
              enrollment_id: string | null
              enrollment_status: string | null
              expires_at: string | null
              full_name: string | null
              id: string | null
              is_active: boolean | null
              offering_plan_id: string | null
              parent_email: string | null
              parent_id: string | null
              parent_name: string | null
              parent_phone: string | null
              price_monthly: number | null
              school_id: string | null
              secondary_sessions_used: number | null
              sessions_used: number | null
              team_id: string | null
              team_name: string | null
              team_sport: string | null
              user_id: string | null
            }[]
            SetofOptions: {
              from: "*"
              to: "school_athletes"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: { p_school_id: string; p_team_id?: string }
            Returns: {
              athlete_type: string
              avatar_url: string
              enrolled_team_id: string
              enrollment_id: string
              enrollment_status: string
              expires_at: string
              full_name: string
              id: string
              is_active: boolean
              offering_plan_id: string
              parent_email: string
              parent_id: string
              parent_name: string
              school_id: string
              secondary_sessions_used: number
              sessions_used: number
              team_name: string
              team_sport: string
              user_id: string
            }[]
          }
      get_school_branding_by_invitation: {
        Args: { p_token: string }
        Returns: {
          logo_url: string
          primary_color: string
          school_name: string
          secondary_color: string
          show_sportmaps_watermark: boolean
        }[]
      }
      get_school_dashboard_stats: {
        Args: { p_branch_id?: string; p_user_id: string }
        Returns: Json
      }
      get_school_services: { Args: { p_school_id: string }; Returns: Json }
      get_user_admin_school_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_school_ids: { Args: { _user_id: string }; Returns: string[] }
      has_role:
        | { Args: { req_role: string }; Returns: boolean }
        | { Args: { required_role: string; user_id: string }; Returns: boolean }
      has_school_role: {
        Args: { _role: string; _school_id: string; _user_id: string }
        Returns: boolean
      }
      increment_session_bookings: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      invite_parent_to_school:
        | { Args: { p_parent_email: string }; Returns: string }
        | {
            Args: {
              p_branch_id?: string
              p_child_name?: string
              p_monthly_fee?: number
              p_parent_email: string
              p_parent_phone?: string
              p_program_id?: string
            }
            Returns: string
          }
      is_admin: { Args: never; Returns: boolean }
      is_branch_admin: {
        Args: { target_branch_id: string; user_id: string }
        Returns: boolean
      }
      is_demo_user: { Args: { _user_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_school_admin: { Args: { p_school_id: string }; Returns: boolean }
      is_school_coach: { Args: { p_school_id: string }; Returns: boolean }
      is_school_general_admin: {
        Args: { check_school_id: string }
        Returns: boolean
      }
      is_school_member: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      is_school_open_now: { Args: { p_school_id: string }; Returns: boolean }
      is_school_owner: { Args: { lookup_school_id: string }; Returns: boolean }
      migrate_device_favorites: {
        Args: { p_device_id: string }
        Returns: number
      }
      migrate_local_favorites: {
        Args: { p_school_ids: string[] }
        Returns: number
      }
      notify_user: {
        Args: {
          p_link?: string
          p_message: string
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: undefined
      }
      process_enrollment_checkout: {
        Args: {
          p_amount: number
          p_child_id?: string
          p_parent_id: string
          p_payment_method: string
          p_program_id: string
          p_school_id: string
          p_student_id?: string
        }
        Returns: Json
      }
      revoke_platform_admin: { Args: { admin_email: string }; Returns: Json }
      save_notification_preferences: {
        Args: { p_preferences: Json }
        Returns: boolean
      }
      save_privacy_preferences: {
        Args: { p_preferences: Json }
        Returns: boolean
      }
      save_profile_settings:
        | {
            Args: { p_bio: string; p_full_name: string; p_phone: string }
            Returns: boolean
          }
        | {
            Args: {
              p_bio: string
              p_date_of_birth?: string
              p_full_name: string
              p_phone: string
              p_sports_interests?: string[]
            }
            Returns: boolean
          }
      save_school_branding: {
        Args: { p_branding: Json; p_school_id: string }
        Returns: boolean
      }
      save_school_info:
        | {
            Args: { p_description: string; p_name: string; p_school_id: string }
            Returns: boolean
          }
        | {
            Args: {
              p_address: string
              p_city: string
              p_description: string
              p_email: string
              p_name: string
              p_phone: string
              p_school_id: string
              p_website: string
            }
            Returns: boolean
          }
      schools_near_location: {
        Args: { p_lat: number; p_lng: number; p_radius_km?: number }
        Returns: Json
      }
      search_schools: {
        Args: {
          p_age?: number
          p_category?: string
          p_city?: string
          p_distance_km?: number
          p_lat?: number
          p_limit?: number
          p_lng?: number
          p_open_now?: boolean
          p_order_by?: string
          p_page?: number
          p_price_max?: number
          p_query?: string
          p_rating_min?: number
          p_sport?: string
          p_verified?: boolean
        }
        Returns: Json
      }
      send_notification: {
        Args: {
          p_link?: string
          p_message: string
          p_title: string
          p_type?: string
          p_user_id?: string
        }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      submit_athlete_installment: {
        Args: {
          p_amount_cents: number
          p_athlete_payment_id: string
          p_notes?: string
          p_payment_method?: string
          p_receipt_date: string
          p_receipt_url: string
        }
        Returns: Json
      }
      submit_enrollment:
        | {
            Args: {
              p_child_dob: string
              p_child_doc_number?: string
              p_child_doc_type?: string
              p_child_emergency?: string
              p_child_full_name: string
              p_child_medical?: string
              p_notes?: string
              p_offering_plan_id?: string
              p_payment_method?: string
              p_program_id?: string
              p_school_id: string
              p_team_id?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_child_dob?: string
              p_child_doc_number?: string
              p_child_doc_type?: string
              p_child_emergency?: string
              p_child_id?: string
              p_child_medical?: string
              p_child_name?: string
              p_offering_plan_id?: string
              p_payment_method?: string
              p_payment_notes?: string
              p_price?: number
              p_program_id?: string
              p_school_id: string
              p_self_enrollment?: boolean
              p_team_id?: string
            }
            Returns: Json
          }
      submit_enrollment_v2:
        | {
            Args: {
              p_child_dob?: string
              p_child_doc_number?: string
              p_child_doc_type?: string
              p_child_emergency?: string
              p_child_full_name?: string
              p_child_medical?: string
              p_notes?: string
              p_offering_plan_id?: string
              p_payment_method?: string
              p_program_id?: string
              p_school_id: string
              p_team_id?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_child_dob?: string
              p_child_doc_number?: string
              p_child_doc_type?: string
              p_child_emergency?: string
              p_child_full_name?: string
              p_child_medical?: string
              p_notes?: string
              p_offering_plan_id?: string
              p_payment_method?: string
              p_school_id: string
              p_team_id?: string
            }
            Returns: Json
          }
      submit_facility_booking: {
        Args: {
          p_end_time: string
          p_facility_id: string
          p_notes?: string
          p_participants?: number
          p_payment_method?: string
          p_reservation_date: string
          p_school_id: string
          p_start_time: string
        }
        Returns: Json
      }
      submit_facility_booking_v2: {
        Args: {
          p_booker_type?: string
          p_deposit_amount?: number
          p_deposit_method?: string
          p_deposit_receipt?: string
          p_end_time: string
          p_external_org_name?: string
          p_facility_id: string
          p_notes?: string
          p_participants?: number
          p_reservation_date: string
          p_resv_type?: string
          p_school_id: string
          p_start_time: string
        }
        Returns: Json
      }
      toggle_favorite: { Args: { p_school_id: string }; Returns: Json }
      unaccent: { Args: { "": string }; Returns: string }
      user_school_ids: { Args: never; Returns: string[] }
      user_school_role: { Args: { p_school_id: string }; Returns: string }
    }
    Enums: {
      activity_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      attend_status: "present" | "absent" | "late" | "excused" | "justified"
      billing_event_type:
        | "charge"
        | "partial"
        | "refund"
        | "late_fee"
        | "adjustment"
      booker_type: "parent" | "athlete" | "school" | "external"
      booking_status: "confirmed" | "cancelled" | "attended" | "no_show"
      categorization_axis:
        | "age"
        | "weight"
        | "belt"
        | "level"
        | "division"
        | "none"
      enroll_status: "active" | "cancelled" | "completed" | "pending"
      event_kind:
        | "tournament"
        | "clinic"
        | "tryout"
        | "camp"
        | "match"
        | "training"
        | "other"
      event_status: "draft" | "active" | "closed" | "cancelled" | "completed"
      exp_level: "beginner" | "intermediate" | "advanced" | "professional"
      member_role:
        | "owner"
        | "admin"
        | "coach"
        | "staff"
        | "parent"
        | "athlete"
        | "viewer"
      member_status: "active" | "inactive" | "pending" | "suspended"
      offering_type:
        | "membership"
        | "session_pack"
        | "court_booking"
        | "tournament"
        | "single_session"
      pay_method: "pse" | "card" | "transfer" | "cash" | "other"
      pay_status: "pending" | "paid" | "overdue" | "failed" | "cancelled"
      pay_type: "one_time" | "subscription"
      program_level:
        | "iniciacion"
        | "intermedio"
        | "avanzado"
        | "alto_rendimiento"
      resv_payment_status: "unpaid" | "partial" | "paid" | "waived"
      resv_status: "pending" | "confirmed" | "cancelled" | "completed"
      resv_type: "internal" | "rental" | "secondary_class"
      sub_tier: "free" | "basic" | "premium"
      subscription_tier: "free" | "basic" | "premium" | "enterprise"
      train_intensity: "low" | "medium" | "high" | "max"
      user_role:
        | "athlete"
        | "parent"
        | "coach"
        | "school"
        | "wellness_professional"
        | "store_owner"
        | "admin"
        | "organizer"
        | "super_admin"
        | "school_admin"
        | "reporter"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_status: ["scheduled", "in_progress", "completed", "cancelled"],
      attend_status: ["present", "absent", "late", "excused", "justified"],
      billing_event_type: [
        "charge",
        "partial",
        "refund",
        "late_fee",
        "adjustment",
      ],
      booker_type: ["parent", "athlete", "school", "external"],
      booking_status: ["confirmed", "cancelled", "attended", "no_show"],
      categorization_axis: [
        "age",
        "weight",
        "belt",
        "level",
        "division",
        "none",
      ],
      enroll_status: ["active", "cancelled", "completed", "pending"],
      event_kind: [
        "tournament",
        "clinic",
        "tryout",
        "camp",
        "match",
        "training",
        "other",
      ],
      event_status: ["draft", "active", "closed", "cancelled", "completed"],
      exp_level: ["beginner", "intermediate", "advanced", "professional"],
      member_role: [
        "owner",
        "admin",
        "coach",
        "staff",
        "parent",
        "athlete",
        "viewer",
      ],
      member_status: ["active", "inactive", "pending", "suspended"],
      offering_type: [
        "membership",
        "session_pack",
        "court_booking",
        "tournament",
        "single_session",
      ],
      pay_method: ["pse", "card", "transfer", "cash", "other"],
      pay_status: ["pending", "paid", "overdue", "failed", "cancelled"],
      pay_type: ["one_time", "subscription"],
      program_level: [
        "iniciacion",
        "intermedio",
        "avanzado",
        "alto_rendimiento",
      ],
      resv_payment_status: ["unpaid", "partial", "paid", "waived"],
      resv_status: ["pending", "confirmed", "cancelled", "completed"],
      resv_type: ["internal", "rental", "secondary_class"],
      sub_tier: ["free", "basic", "premium"],
      subscription_tier: ["free", "basic", "premium", "enterprise"],
      train_intensity: ["low", "medium", "high", "max"],
      user_role: [
        "athlete",
        "parent",
        "coach",
        "school",
        "wellness_professional",
        "store_owner",
        "admin",
        "organizer",
        "super_admin",
        "school_admin",
        "reporter",
      ],
    },
  },
} as const
