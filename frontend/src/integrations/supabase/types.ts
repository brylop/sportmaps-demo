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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      _backup_paola_checkout_20260729: {
        Row: {
          amount: number | null
          amount_paid: number | null
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          cash_session_id: string | null
          child_id: string | null
          coach_id: string | null
          concept: string | null
          created_at: string | null
          due_date: string | null
          early_payment_discount_applied: number | null
          epayco_fee: number | null
          gross_amount: number | null
          id: string | null
          last_failure_at: string | null
          last_failure_reason: string | null
          last_reminder_sent: string | null
          late_fee_amount: number | null
          late_fee_applied_at: string | null
          ocr_amount: number | null
          ocr_bank: string | null
          ocr_currency: string | null
          ocr_date: string | null
          ocr_destination: string | null
          ocr_destination_name: string | null
          ocr_origin_name: string | null
          ocr_provider: string | null
          ocr_raw_response: Json | null
          ocr_reference: string | null
          ocr_time: string | null
          offering_plan_id: string | null
          parent_id: string | null
          payment_channel: string | null
          payment_date: string | null
          payment_method: string | null
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_type: string | null
          period_month: number | null
          period_year: number | null
          provider_reference: string | null
          provider_transaction_id: string | null
          qr_id: string | null
          receipt_image_sha256: string | null
          receipt_image_sha256_source: string | null
          receipt_number: string | null
          receipt_reference_norm: string | null
          receipt_storage_bucket: string | null
          receipt_url: string | null
          receipt_verdict: string | null
          receipt_verdict_at: string | null
          receipt_verdict_reasons: Json | null
          reconciliation_status: string | null
          reference: string | null
          rejection_reason: string | null
          reminder_sent_at: string | null
          requires_review: boolean | null
          school_id: string | null
          sportmaps_fee: number | null
          status: string | null
          subscription_end_date: string | null
          subscription_start_date: string | null
          team_id: string | null
          unblocked_at: string | null
          unblocked_by: string | null
          unregistered_athlete_id: string | null
          updated_at: string | null
          user_id: string | null
          wompi_id: string | null
          wompi_reference: string | null
          wompi_transaction_id: string | null
        }
        Insert: {
          amount?: number | null
          amount_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          cash_session_id?: string | null
          child_id?: string | null
          coach_id?: string | null
          concept?: string | null
          created_at?: string | null
          due_date?: string | null
          early_payment_discount_applied?: number | null
          epayco_fee?: number | null
          gross_amount?: number | null
          id?: string | null
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_reminder_sent?: string | null
          late_fee_amount?: number | null
          late_fee_applied_at?: string | null
          ocr_amount?: number | null
          ocr_bank?: string | null
          ocr_currency?: string | null
          ocr_date?: string | null
          ocr_destination?: string | null
          ocr_destination_name?: string | null
          ocr_origin_name?: string | null
          ocr_provider?: string | null
          ocr_raw_response?: Json | null
          ocr_reference?: string | null
          ocr_time?: string | null
          offering_plan_id?: string | null
          parent_id?: string | null
          payment_channel?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_type?: string | null
          period_month?: number | null
          period_year?: number | null
          provider_reference?: string | null
          provider_transaction_id?: string | null
          qr_id?: string | null
          receipt_image_sha256?: string | null
          receipt_image_sha256_source?: string | null
          receipt_number?: string | null
          receipt_reference_norm?: string | null
          receipt_storage_bucket?: string | null
          receipt_url?: string | null
          receipt_verdict?: string | null
          receipt_verdict_at?: string | null
          receipt_verdict_reasons?: Json | null
          reconciliation_status?: string | null
          reference?: string | null
          rejection_reason?: string | null
          reminder_sent_at?: string | null
          requires_review?: boolean | null
          school_id?: string | null
          sportmaps_fee?: number | null
          status?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          team_id?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          wompi_id?: string | null
          wompi_reference?: string | null
          wompi_transaction_id?: string | null
        }
        Update: {
          amount?: number | null
          amount_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          cash_session_id?: string | null
          child_id?: string | null
          coach_id?: string | null
          concept?: string | null
          created_at?: string | null
          due_date?: string | null
          early_payment_discount_applied?: number | null
          epayco_fee?: number | null
          gross_amount?: number | null
          id?: string | null
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_reminder_sent?: string | null
          late_fee_amount?: number | null
          late_fee_applied_at?: string | null
          ocr_amount?: number | null
          ocr_bank?: string | null
          ocr_currency?: string | null
          ocr_date?: string | null
          ocr_destination?: string | null
          ocr_destination_name?: string | null
          ocr_origin_name?: string | null
          ocr_provider?: string | null
          ocr_raw_response?: Json | null
          ocr_reference?: string | null
          ocr_time?: string | null
          offering_plan_id?: string | null
          parent_id?: string | null
          payment_channel?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_type?: string | null
          period_month?: number | null
          period_year?: number | null
          provider_reference?: string | null
          provider_transaction_id?: string | null
          qr_id?: string | null
          receipt_image_sha256?: string | null
          receipt_image_sha256_source?: string | null
          receipt_number?: string | null
          receipt_reference_norm?: string | null
          receipt_storage_bucket?: string | null
          receipt_url?: string | null
          receipt_verdict?: string | null
          receipt_verdict_at?: string | null
          receipt_verdict_reasons?: Json | null
          reconciliation_status?: string | null
          reference?: string | null
          rejection_reason?: string | null
          reminder_sent_at?: string | null
          requires_review?: boolean | null
          school_id?: string | null
          sportmaps_fee?: number | null
          status?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          team_id?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          wompi_id?: string | null
          wompi_reference?: string | null
          wompi_transaction_id?: string | null
        }
        Relationships: []
      }
      _backup_payments_fantasma_20260728: {
        Row: {
          amount: number | null
          amount_paid: number | null
          approved_at: string | null
          approved_by: string | null
          backed_up_at: string | null
          branch_id: string | null
          cash_session_id: string | null
          child_id: string | null
          coach_id: string | null
          concept: string | null
          created_at: string | null
          due_date: string | null
          early_payment_discount_applied: number | null
          epayco_fee: number | null
          gross_amount: number | null
          id: string | null
          last_failure_at: string | null
          last_failure_reason: string | null
          last_reminder_sent: string | null
          late_fee_amount: number | null
          late_fee_applied_at: string | null
          ocr_amount: number | null
          ocr_bank: string | null
          ocr_currency: string | null
          ocr_date: string | null
          ocr_destination: string | null
          ocr_destination_name: string | null
          ocr_origin_name: string | null
          ocr_provider: string | null
          ocr_raw_response: Json | null
          ocr_reference: string | null
          ocr_time: string | null
          offering_plan_id: string | null
          parent_id: string | null
          payment_channel: string | null
          payment_date: string | null
          payment_method: string | null
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_type: string | null
          period_month: number | null
          period_year: number | null
          provider_reference: string | null
          provider_transaction_id: string | null
          qr_id: string | null
          receipt_image_sha256: string | null
          receipt_image_sha256_source: string | null
          receipt_number: string | null
          receipt_reference_norm: string | null
          receipt_storage_bucket: string | null
          receipt_url: string | null
          receipt_verdict: string | null
          receipt_verdict_at: string | null
          receipt_verdict_reasons: Json | null
          reconciliation_status: string | null
          reference: string | null
          rejection_reason: string | null
          reminder_sent_at: string | null
          requires_review: boolean | null
          school_id: string | null
          sportmaps_fee: number | null
          status: string | null
          subscription_end_date: string | null
          subscription_start_date: string | null
          team_id: string | null
          unblocked_at: string | null
          unblocked_by: string | null
          unregistered_athlete_id: string | null
          updated_at: string | null
          user_id: string | null
          wompi_id: string | null
          wompi_reference: string | null
          wompi_transaction_id: string | null
        }
        Insert: {
          amount?: number | null
          amount_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          backed_up_at?: string | null
          branch_id?: string | null
          cash_session_id?: string | null
          child_id?: string | null
          coach_id?: string | null
          concept?: string | null
          created_at?: string | null
          due_date?: string | null
          early_payment_discount_applied?: number | null
          epayco_fee?: number | null
          gross_amount?: number | null
          id?: string | null
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_reminder_sent?: string | null
          late_fee_amount?: number | null
          late_fee_applied_at?: string | null
          ocr_amount?: number | null
          ocr_bank?: string | null
          ocr_currency?: string | null
          ocr_date?: string | null
          ocr_destination?: string | null
          ocr_destination_name?: string | null
          ocr_origin_name?: string | null
          ocr_provider?: string | null
          ocr_raw_response?: Json | null
          ocr_reference?: string | null
          ocr_time?: string | null
          offering_plan_id?: string | null
          parent_id?: string | null
          payment_channel?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_type?: string | null
          period_month?: number | null
          period_year?: number | null
          provider_reference?: string | null
          provider_transaction_id?: string | null
          qr_id?: string | null
          receipt_image_sha256?: string | null
          receipt_image_sha256_source?: string | null
          receipt_number?: string | null
          receipt_reference_norm?: string | null
          receipt_storage_bucket?: string | null
          receipt_url?: string | null
          receipt_verdict?: string | null
          receipt_verdict_at?: string | null
          receipt_verdict_reasons?: Json | null
          reconciliation_status?: string | null
          reference?: string | null
          rejection_reason?: string | null
          reminder_sent_at?: string | null
          requires_review?: boolean | null
          school_id?: string | null
          sportmaps_fee?: number | null
          status?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          team_id?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          wompi_id?: string | null
          wompi_reference?: string | null
          wompi_transaction_id?: string | null
        }
        Update: {
          amount?: number | null
          amount_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          backed_up_at?: string | null
          branch_id?: string | null
          cash_session_id?: string | null
          child_id?: string | null
          coach_id?: string | null
          concept?: string | null
          created_at?: string | null
          due_date?: string | null
          early_payment_discount_applied?: number | null
          epayco_fee?: number | null
          gross_amount?: number | null
          id?: string | null
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_reminder_sent?: string | null
          late_fee_amount?: number | null
          late_fee_applied_at?: string | null
          ocr_amount?: number | null
          ocr_bank?: string | null
          ocr_currency?: string | null
          ocr_date?: string | null
          ocr_destination?: string | null
          ocr_destination_name?: string | null
          ocr_origin_name?: string | null
          ocr_provider?: string | null
          ocr_raw_response?: Json | null
          ocr_reference?: string | null
          ocr_time?: string | null
          offering_plan_id?: string | null
          parent_id?: string | null
          payment_channel?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_type?: string | null
          period_month?: number | null
          period_year?: number | null
          provider_reference?: string | null
          provider_transaction_id?: string | null
          qr_id?: string | null
          receipt_image_sha256?: string | null
          receipt_image_sha256_source?: string | null
          receipt_number?: string | null
          receipt_reference_norm?: string | null
          receipt_storage_bucket?: string | null
          receipt_url?: string | null
          receipt_verdict?: string | null
          receipt_verdict_at?: string | null
          receipt_verdict_reasons?: Json | null
          reconciliation_status?: string | null
          reference?: string | null
          rejection_reason?: string | null
          reminder_sent_at?: string | null
          requires_review?: boolean | null
          school_id?: string | null
          sportmaps_fee?: number | null
          status?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          team_id?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          wompi_id?: string | null
          wompi_reference?: string | null
          wompi_transaction_id?: string | null
        }
        Relationships: []
      }
      _backup_school_addons_20260514: {
        Row: {
          addon_key: string | null
          created_at: string | null
          disabled_at: string | null
          enabled: boolean | null
          enabled_at: string | null
          id: string | null
          metadata: Json | null
          monthly_price_cents: number | null
          school_id: string | null
          updated_at: string | null
        }
        Insert: {
          addon_key?: string | null
          created_at?: string | null
          disabled_at?: string | null
          enabled?: boolean | null
          enabled_at?: string | null
          id?: string | null
          metadata?: Json | null
          monthly_price_cents?: number | null
          school_id?: string | null
          updated_at?: string | null
        }
        Update: {
          addon_key?: string | null
          created_at?: string | null
          disabled_at?: string | null
          enabled?: boolean | null
          enabled_at?: string | null
          id?: string | null
          metadata?: Json | null
          monthly_price_cents?: number | null
          school_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      _backup_school_subscriptions_20260514: {
        Row: {
          billing_cycle: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string | null
          current_period_end: string | null
          current_period_start: string | null
          id: string | null
          metadata: Json | null
          payment_provider: string | null
          payment_provider_subscription_id: string | null
          plan_code: string | null
          school_id: string | null
          status: string | null
          tier: string | null
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          billing_cycle?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string | null
          metadata?: Json | null
          payment_provider?: string | null
          payment_provider_subscription_id?: string | null
          plan_code?: string | null
          school_id?: string | null
          status?: string | null
          tier?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          billing_cycle?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string | null
          metadata?: Json | null
          payment_provider?: string | null
          payment_provider_subscription_id?: string | null
          plan_code?: string | null
          school_id?: string | null
          status?: string | null
          tier?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      _backup_schools_is_demo_20260514: {
        Row: {
          id: string | null
          is_demo: boolean | null
          snapshot_at: string | null
        }
        Insert: {
          id?: string | null
          is_demo?: boolean | null
          snapshot_at?: string | null
        }
        Update: {
          id?: string | null
          is_demo?: boolean | null
          snapshot_at?: string | null
        }
        Relationships: []
      }
      academic_progress: {
        Row: {
          child_id: string
          coach_id: string | null
          comments: string | null
          created_at: string
          evaluation_date: string
          id: string
          school_id: string | null
          skill_level: number
          skill_name: string
          user_id: string | null
        }
        Insert: {
          child_id: string
          coach_id?: string | null
          comments?: string | null
          created_at?: string
          evaluation_date?: string
          id?: string
          school_id?: string | null
          skill_level: number
          skill_name: string
          user_id?: string | null
        }
        Update: {
          child_id?: string
          coach_id?: string | null
          comments?: string | null
          created_at?: string
          evaluation_date?: string
          id?: string
          school_id?: string | null
          skill_level?: number
          skill_name?: string
          user_id?: string | null
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
          {
            foreignKeyName: "academic_progress_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "academic_progress_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "academic_progress_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_progress_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_progress_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_progress_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_progress_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      access_events: {
        Row: {
          access_granted: boolean
          check_in_method: string
          created_at: string | null
          denial_reason: string | null
          device_id: string | null
          direction: string
          id: string
          occurred_at: string
          raw_event: Json | null
          school_id: string
          unregistered_athlete_id: string | null
          user_id: string | null
          zk_user_id: number | null
        }
        Insert: {
          access_granted?: boolean
          check_in_method?: string
          created_at?: string | null
          denial_reason?: string | null
          device_id?: string | null
          direction: string
          id?: string
          occurred_at?: string
          raw_event?: Json | null
          school_id: string
          unregistered_athlete_id?: string | null
          user_id?: string | null
          zk_user_id?: number | null
        }
        Update: {
          access_granted?: boolean
          check_in_method?: string
          created_at?: string | null
          denial_reason?: string | null
          device_id?: string | null
          direction?: string
          id?: string
          occurred_at?: string
          raw_event?: Json | null
          school_id?: string
          unregistered_athlete_id?: string | null
          user_id?: string | null
          zk_user_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "access_events_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "turnstile_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "access_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "access_events_unregistered_athlete_id_fkey"
            columns: ["unregistered_athlete_id"]
            isOneToOne: false
            referencedRelation: "unregistered_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "access_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      adms_device_log: {
        Row: {
          created_at: string
          detail: Json
          event_type: string
          id: string
          school_id: string | null
          sn: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json
          event_type: string
          id?: string
          school_id?: string | null
          sn?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json
          event_type?: string
          id?: string
          school_id?: string | null
          sn?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "adms_device_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "adms_device_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adms_device_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adms_device_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adms_device_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adms_device_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
      athlete_certificates: {
        Row: {
          child_id: string | null
          content_snapshot: Json
          created_at: string
          download_count: number
          folio: string
          id: string
          issued_at: string | null
          issued_by: string | null
          kind: string
          payment_id: string | null
          pdf_url: string | null
          profile_id: string | null
          qr_verify_token: string
          requested_by: string | null
          revocation_reason: string | null
          revoked_at: string | null
          school_id: string
          status: string
          template_id: string
          title: string
          updated_at: string
        }
        Insert: {
          child_id?: string | null
          content_snapshot: Json
          created_at?: string
          download_count?: number
          folio: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          kind: string
          payment_id?: string | null
          pdf_url?: string | null
          profile_id?: string | null
          qr_verify_token?: string
          requested_by?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          school_id: string
          status?: string
          template_id: string
          title: string
          updated_at?: string
        }
        Update: {
          child_id?: string | null
          content_snapshot?: Json
          created_at?: string
          download_count?: number
          folio?: string
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          kind?: string
          payment_id?: string | null
          pdf_url?: string | null
          profile_id?: string | null
          qr_verify_token?: string
          requested_by?: string | null
          revocation_reason?: string | null
          revoked_at?: string | null
          school_id?: string
          status?: string
          template_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_certificates_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_certificates_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_certificates_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "athlete_certificates_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "athlete_certificates_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_certificates_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_certificates_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments_with_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_certificates_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_certificates_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["active_payment_id"]
          },
          {
            foreignKeyName: "athlete_certificates_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_abonos_summary"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "athlete_certificates_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_contacts"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "athlete_certificates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "athlete_certificates_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_certificates_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "athlete_certificates_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_certificates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "athlete_certificates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_certificates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_certificates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_certificates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_certificates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "athlete_certificates_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "school_certificate_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_documents: {
        Row: {
          child_id: string | null
          document_type: string
          id: string
          notes: string | null
          school_id: string
          storage_path: string
          unregistered_athlete_id: string | null
          uploaded_at: string
          uploaded_by: string | null
          user_id: string | null
          verified: boolean
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          child_id?: string | null
          document_type: string
          id?: string
          notes?: string | null
          school_id: string
          storage_path: string
          unregistered_athlete_id?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          user_id?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          child_id?: string | null
          document_type?: string
          id?: string
          notes?: string | null
          school_id?: string
          storage_path?: string
          unregistered_athlete_id?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
          user_id?: string | null
          verified?: boolean
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_documents_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_documents_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_documents_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "athlete_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "athlete_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "athlete_documents_unregistered_athlete_id_fkey"
            columns: ["unregistered_athlete_id"]
            isOneToOne: false
            referencedRelation: "unregistered_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "athlete_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "athlete_documents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "athlete_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "athlete_goals_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_id_card_templates: {
        Row: {
          accent_color: string | null
          active: boolean
          background_url: string | null
          created_at: string
          created_by: string | null
          footer_text: string | null
          header_text: string | null
          id: string
          is_default: boolean
          layout: string
          name: string
          pattern: string
          photo_shape: string
          school_id: string
          secondary_color: string | null
          show_fields: Json
          text_mode: string
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          active?: boolean
          background_url?: string | null
          created_at?: string
          created_by?: string | null
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_default?: boolean
          layout?: string
          name: string
          pattern?: string
          photo_shape?: string
          school_id: string
          secondary_color?: string | null
          show_fields?: Json
          text_mode?: string
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          active?: boolean
          background_url?: string | null
          created_at?: string
          created_by?: string | null
          footer_text?: string | null
          header_text?: string | null
          id?: string
          is_default?: boolean
          layout?: string
          name?: string
          pattern?: string
          photo_shape?: string
          school_id?: string
          secondary_color?: string | null
          show_fields?: Json
          text_mode?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_id_card_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "athlete_id_card_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_id_card_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "athlete_id_card_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_id_card_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_id_card_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_id_card_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_id_card_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      athlete_id_cards: {
        Row: {
          child_id: string | null
          created_at: string
          id: string
          issued_at: string
          issued_by: string | null
          last_printed_at: string | null
          photo_url: string | null
          print_count: number
          profile_id: string | null
          qr_token: string
          revocation_reason: string | null
          revoked_at: string | null
          school_id: string
          status: string
          template_id: string | null
          unregistered_athlete_id: string | null
          updated_at: string
          valid_until: string
          version: number
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          last_printed_at?: string | null
          photo_url?: string | null
          print_count?: number
          profile_id?: string | null
          qr_token?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          school_id: string
          status?: string
          template_id?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string
          valid_until: string
          version?: number
        }
        Update: {
          child_id?: string | null
          created_at?: string
          id?: string
          issued_at?: string
          issued_by?: string | null
          last_printed_at?: string | null
          photo_url?: string | null
          print_count?: number
          profile_id?: string | null
          qr_token?: string
          revocation_reason?: string | null
          revoked_at?: string | null
          school_id?: string
          status?: string
          template_id?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string
          valid_until?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "athlete_id_cards_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_id_cards_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_id_cards_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "athlete_id_cards_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "athlete_id_cards_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_id_cards_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "athlete_id_cards_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_id_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "athlete_id_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_id_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_id_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_id_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_id_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "athlete_id_cards_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "athlete_id_card_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_id_cards_unregistered_athlete_id_fkey"
            columns: ["unregistered_athlete_id"]
            isOneToOne: false
            referencedRelation: "unregistered_athletes"
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
          ocr_amount_cents: number | null
          ocr_auto_approved: boolean | null
          ocr_confidence: number | null
          ocr_log_id: string | null
          ocr_processed_at: string | null
          ocr_receipt_date: string | null
          orc_mismatch_reason: string | null
          orc_validated: boolean | null
          payment_method: string | null
          receipt_date: string
          receipt_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string | null
          status: string
          updated_at: string
          upload_channel: string | null
        }
        Insert: {
          amount_cents: number
          athlete_id: string
          athlete_payment_id: string
          created_at?: string
          id?: string
          notes?: string | null
          ocr_amount_cents?: number | null
          ocr_auto_approved?: boolean | null
          ocr_confidence?: number | null
          ocr_log_id?: string | null
          ocr_processed_at?: string | null
          ocr_receipt_date?: string | null
          orc_mismatch_reason?: string | null
          orc_validated?: boolean | null
          payment_method?: string | null
          receipt_date: string
          receipt_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          status?: string
          updated_at?: string
          upload_channel?: string | null
        }
        Update: {
          amount_cents?: number
          athlete_id?: string
          athlete_payment_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          ocr_amount_cents?: number | null
          ocr_auto_approved?: boolean | null
          ocr_confidence?: number | null
          ocr_log_id?: string | null
          ocr_processed_at?: string | null
          ocr_receipt_date?: string | null
          orc_mismatch_reason?: string | null
          orc_validated?: boolean | null
          payment_method?: string | null
          receipt_date?: string
          receipt_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          status?: string
          updated_at?: string
          upload_channel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_payment_installments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
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
            foreignKeyName: "athlete_payment_installments_ocr_log_id_fkey"
            columns: ["ocr_log_id"]
            isOneToOne: false
            referencedRelation: "ocr_processing_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_payment_installments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "athlete_payment_installments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
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
      athlete_report_snapshots: {
        Row: {
          archived_at: string
          archived_by: string | null
          id: string
          reason: string
          report_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          archived_at?: string
          archived_by?: string | null
          id?: string
          reason: string
          report_id: string
          snapshot: Json
          version: number
        }
        Update: {
          archived_at?: string
          archived_by?: string | null
          id?: string
          reason?: string
          report_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "athlete_report_snapshots_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "athlete_report_snapshots_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_report_snapshots_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "athlete_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_reports: {
        Row: {
          branch_id: string | null
          coach_note: string | null
          coach_note_by: string | null
          created_at: string
          hold_reason: string | null
          id: string
          period_month: number
          period_year: number
          published_at: string | null
          published_by: string | null
          published_without_note: boolean
          recipient_id: string | null
          scheduled_for: string
          school_id: string
          sent_at: string | null
          snapshot: Json | null
          snapshot_version: number
          status: string
          subject_id: string
          subject_type: string
          team_id: string | null
          updated_at: string
          view_count: number
          viewed_at: string | null
        }
        Insert: {
          branch_id?: string | null
          coach_note?: string | null
          coach_note_by?: string | null
          created_at?: string
          hold_reason?: string | null
          id?: string
          period_month: number
          period_year: number
          published_at?: string | null
          published_by?: string | null
          published_without_note?: boolean
          recipient_id?: string | null
          scheduled_for: string
          school_id: string
          sent_at?: string | null
          snapshot?: Json | null
          snapshot_version?: number
          status?: string
          subject_id: string
          subject_type: string
          team_id?: string | null
          updated_at?: string
          view_count?: number
          viewed_at?: string | null
        }
        Update: {
          branch_id?: string | null
          coach_note?: string | null
          coach_note_by?: string | null
          created_at?: string
          hold_reason?: string | null
          id?: string
          period_month?: number
          period_year?: number
          published_at?: string | null
          published_by?: string | null
          published_without_note?: boolean
          recipient_id?: string | null
          scheduled_for?: string
          school_id?: string
          sent_at?: string | null
          snapshot?: Json | null
          snapshot_version?: number
          status?: string
          subject_id?: string
          subject_type?: string
          team_id?: string | null
          updated_at?: string
          view_count?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_reports_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_reports_coach_note_by_fkey"
            columns: ["coach_note_by"]
            isOneToOne: false
            referencedRelation: "public_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_reports_coach_note_by_fkey"
            columns: ["coach_note_by"]
            isOneToOne: false
            referencedRelation: "school_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_reports_coach_note_by_fkey"
            columns: ["coach_note_by"]
            isOneToOne: false
            referencedRelation: "v_coach_team_plans"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "athlete_reports_coach_note_by_fkey"
            columns: ["coach_note_by"]
            isOneToOne: false
            referencedRelation: "v_school_staff_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_reports_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "athlete_reports_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_reports_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "athlete_reports_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "athlete_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_reports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "athlete_reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "athlete_reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "athlete_reports_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
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
          school_id: string | null
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
          school_id?: string | null
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
          school_id?: string | null
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "athlete_stats_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_stats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "athlete_stats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_stats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_stats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_stats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_stats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      athlete_training_plans: {
        Row: {
          client_id: string
          client_type: string
          created_at: string
          description: string | null
          end_date: string | null
          frequency_per_week: number | null
          id: string
          school_id: string
          start_date: string | null
          status: string
          title: string
          trainer_id: string
          updated_at: string
          weekly_structure: Json | null
        }
        Insert: {
          client_id: string
          client_type?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          frequency_per_week?: number | null
          id?: string
          school_id: string
          start_date?: string | null
          status?: string
          title: string
          trainer_id: string
          updated_at?: string
          weekly_structure?: Json | null
        }
        Update: {
          client_id?: string
          client_type?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          frequency_per_week?: number | null
          id?: string
          school_id?: string
          start_date?: string | null
          status?: string
          title?: string
          trainer_id?: string
          updated_at?: string
          weekly_structure?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_training_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "athlete_training_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_training_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_training_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_training_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_training_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "attendance_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
        ]
      }
      attendance_polls: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          poll_date: string
          school_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          poll_date: string
          school_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          poll_date?: string
          school_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_polls_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "attendance_polls_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "attendance_polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_polls_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "attendance_polls_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_polls_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_polls_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_polls_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_polls_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      attendance_records: {
        Row: {
          attendance_date: string
          check_in_method: string | null
          child_id: string | null
          class_id: string | null
          created_at: string | null
          id: string
          marked_by: string | null
          notes: string | null
          school_id: string
          session_id: string | null
          status: string
          team_id: string | null
          unregistered_athlete_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          attendance_date?: string
          check_in_method?: string | null
          child_id?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          marked_by?: string | null
          notes?: string | null
          school_id: string
          session_id?: string | null
          status: string
          team_id?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          attendance_date?: string
          check_in_method?: string | null
          child_id?: string | null
          class_id?: string | null
          created_at?: string | null
          id?: string
          marked_by?: string | null
          notes?: string | null
          school_id?: string
          session_id?: string | null
          status?: string
          team_id?: string | null
          unregistered_athlete_id?: string | null
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
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "attendance_records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "poll_sessions_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "attendance_records_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_bookable_sessions"
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
            foreignKeyName: "attendance_records_student_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
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
          {
            foreignKeyName: "attendance_records_unregistered_athlete_id_fkey"
            columns: ["unregistered_athlete_id"]
            isOneToOne: false
            referencedRelation: "unregistered_athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          available_for_personal_classes: boolean
          coach_availability_id: string | null
          coach_id: string | null
          created_at: string | null
          created_by: string | null
          current_bookings: number
          end_time: string | null
          facility_availability_id: string | null
          facility_id: string | null
          finalized: boolean | null
          finalized_at: string | null
          finalized_by: string | null
          id: string
          is_bookable: boolean
          max_capacity: number | null
          offering_id: string | null
          poll_id: string | null
          requires_capacity_check: boolean
          school_id: string | null
          session_date: string
          start_time: string | null
          team_id: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          available_for_personal_classes?: boolean
          coach_availability_id?: string | null
          coach_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_bookings?: number
          end_time?: string | null
          facility_availability_id?: string | null
          facility_id?: string | null
          finalized?: boolean | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_bookable?: boolean
          max_capacity?: number | null
          offering_id?: string | null
          poll_id?: string | null
          requires_capacity_check?: boolean
          school_id?: string | null
          session_date: string
          start_time?: string | null
          team_id?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          available_for_personal_classes?: boolean
          coach_availability_id?: string | null
          coach_id?: string | null
          created_at?: string | null
          created_by?: string | null
          current_bookings?: number
          end_time?: string | null
          facility_availability_id?: string | null
          facility_id?: string | null
          finalized?: boolean | null
          finalized_at?: string | null
          finalized_by?: string | null
          id?: string
          is_bookable?: boolean
          max_capacity?: number | null
          offering_id?: string | null
          poll_id?: string | null
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
            foreignKeyName: "attendance_sessions_coach_availability_id_fkey"
            columns: ["coach_availability_id"]
            isOneToOne: false
            referencedRelation: "coach_availability"
            referencedColumns: ["id"]
          },
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
            foreignKeyName: "attendance_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_coach_team_plans"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "attendance_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_school_staff_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "attendance_sessions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_facility_availability_id_fkey"
            columns: ["facility_availability_id"]
            isOneToOne: false
            referencedRelation: "facility_availability"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_finalized_by_fkey"
            columns: ["finalized_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
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
            foreignKeyName: "attendance_sessions_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "attendance_polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_sessions_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "poll_sessions_summary"
            referencedColumns: ["poll_id"]
          },
          {
            foreignKeyName: "attendance_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "attendance_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      bank_statement_lines: {
        Row: {
          amount: number
          counterparty: string | null
          created_at: string
          description: string | null
          id: string
          match_status: string
          matched_payment_id: string | null
          occurred_date: string | null
          reference_norm: string | null
          school_id: string
          statement_id: string
        }
        Insert: {
          amount: number
          counterparty?: string | null
          created_at?: string
          description?: string | null
          id?: string
          match_status?: string
          matched_payment_id?: string | null
          occurred_date?: string | null
          reference_norm?: string | null
          school_id: string
          statement_id: string
        }
        Update: {
          amount?: number
          counterparty?: string | null
          created_at?: string
          description?: string | null
          id?: string
          match_status?: string
          matched_payment_id?: string | null
          occurred_date?: string | null
          reference_norm?: string | null
          school_id?: string
          statement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_lines_matched_payment_id_fkey"
            columns: ["matched_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_matched_payment_id_fkey"
            columns: ["matched_payment_id"]
            isOneToOne: false
            referencedRelation: "payments_with_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_matched_payment_id_fkey"
            columns: ["matched_payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_lines_matched_payment_id_fkey"
            columns: ["matched_payment_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["active_payment_id"]
          },
          {
            foreignKeyName: "bank_statement_lines_matched_payment_id_fkey"
            columns: ["matched_payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_abonos_summary"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "bank_statement_lines_matched_payment_id_fkey"
            columns: ["matched_payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_contacts"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "bank_statement_lines_statement_id_fkey"
            columns: ["statement_id"]
            isOneToOne: false
            referencedRelation: "bank_statements"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_statements: {
        Row: {
          bank: string | null
          created_at: string
          date_from: string | null
          date_to: string | null
          filename: string | null
          glosas_opened: number
          id: string
          matched_count: number
          period_month: number | null
          period_year: number | null
          reconciled_at: string | null
          row_count: number
          school_id: string
          status: string
          unmatched_count: number
          uploaded_by: string | null
          weak_count: number
        }
        Insert: {
          bank?: string | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          filename?: string | null
          glosas_opened?: number
          id?: string
          matched_count?: number
          period_month?: number | null
          period_year?: number | null
          reconciled_at?: string | null
          row_count?: number
          school_id: string
          status?: string
          unmatched_count?: number
          uploaded_by?: string | null
          weak_count?: number
        }
        Update: {
          bank?: string | null
          created_at?: string
          date_from?: string | null
          date_to?: string | null
          filename?: string | null
          glosas_opened?: number
          id?: string
          matched_count?: number
          period_month?: number | null
          period_year?: number | null
          reconciled_at?: string | null
          row_count?: number
          school_id?: string
          status?: string
          unmatched_count?: number
          uploaded_by?: string | null
          weak_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "bank_statements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "bank_statements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "bank_statements_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "bank_statements_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "billing_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["active_payment_id"]
          },
          {
            foreignKeyName: "billing_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_abonos_summary"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "billing_events_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_contacts"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "billing_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "billing_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      biomech_access_grants: {
        Row: {
          athlete_id: string
          coach_id: string
          created_at: string | null
          expires_at: string | null
          granted_at: string | null
          id: string
          is_active: boolean
          school_id: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          created_at?: string | null
          expires_at?: string | null
          granted_at?: string | null
          id?: string
          is_active?: boolean
          school_id: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          created_at?: string | null
          expires_at?: string | null
          granted_at?: string | null
          id?: string
          is_active?: boolean
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "biomech_access_grants_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "biomech_access_grants_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biomech_access_grants_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "biomech_access_grants_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biomech_access_grants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "biomech_access_grants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biomech_access_grants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biomech_access_grants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biomech_access_grants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biomech_access_grants_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      biomech_analyses: {
        Row: {
          analyzer_code: string | null
          capture_id: string
          created_at: string | null
          flags: Json | null
          id: string
          metrics: Json | null
          processed_at: string | null
          quality_rating: string | null
          rep_count: number | null
          suggested_correctives: Json | null
          summary: string | null
        }
        Insert: {
          analyzer_code?: string | null
          capture_id: string
          created_at?: string | null
          flags?: Json | null
          id?: string
          metrics?: Json | null
          processed_at?: string | null
          quality_rating?: string | null
          rep_count?: number | null
          suggested_correctives?: Json | null
          summary?: string | null
        }
        Update: {
          analyzer_code?: string | null
          capture_id?: string
          created_at?: string | null
          flags?: Json | null
          id?: string
          metrics?: Json | null
          processed_at?: string | null
          quality_rating?: string | null
          rep_count?: number | null
          suggested_correctives?: Json | null
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "biomech_analyses_analyzer_code_fkey"
            columns: ["analyzer_code"]
            isOneToOne: false
            referencedRelation: "exercise_analyzers"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "biomech_analyses_capture_id_fkey"
            columns: ["capture_id"]
            isOneToOne: false
            referencedRelation: "biomech_captures"
            referencedColumns: ["id"]
          },
        ]
      }
      biomech_annotations: {
        Row: {
          capture_id: string
          coach_id: string
          created_at: string | null
          id: string
          is_baseline_label: boolean | null
          label: string | null
          note: string
          timestamp_seconds: number | null
        }
        Insert: {
          capture_id: string
          coach_id: string
          created_at?: string | null
          id?: string
          is_baseline_label?: boolean | null
          label?: string | null
          note: string
          timestamp_seconds?: number | null
        }
        Update: {
          capture_id?: string
          coach_id?: string
          created_at?: string | null
          id?: string
          is_baseline_label?: boolean | null
          label?: string | null
          note?: string
          timestamp_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "biomech_annotations_capture_id_fkey"
            columns: ["capture_id"]
            isOneToOne: false
            referencedRelation: "biomech_captures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biomech_annotations_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "biomech_annotations_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      biomech_baselines: {
        Row: {
          assessment_count: number
          athlete_id: string
          compensation_patterns: Json | null
          created_at: string | null
          id: string
          joint_rom: Json | null
          last_updated_at: string | null
        }
        Insert: {
          assessment_count?: number
          athlete_id: string
          compensation_patterns?: Json | null
          created_at?: string | null
          id?: string
          joint_rom?: Json | null
          last_updated_at?: string | null
        }
        Update: {
          assessment_count?: number
          athlete_id?: string
          compensation_patterns?: Json | null
          created_at?: string | null
          id?: string
          joint_rom?: Json | null
          last_updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "biomech_baselines_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "biomech_baselines_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      biomech_captures: {
        Row: {
          analyzer_code: string | null
          athlete_id: string
          block_index: number | null
          created_at: string | null
          duration_seconds: number | null
          enrollment_id: string | null
          fps: number | null
          id: string
          keypoints: Json | null
          quality_score: number | null
          school_id: string
          session_plan_id: string | null
          source: string
          status: string
          updated_at: string | null
          video_path: string | null
        }
        Insert: {
          analyzer_code?: string | null
          athlete_id: string
          block_index?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          enrollment_id?: string | null
          fps?: number | null
          id?: string
          keypoints?: Json | null
          quality_score?: number | null
          school_id: string
          session_plan_id?: string | null
          source?: string
          status?: string
          updated_at?: string | null
          video_path?: string | null
        }
        Update: {
          analyzer_code?: string | null
          athlete_id?: string
          block_index?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          enrollment_id?: string | null
          fps?: number | null
          id?: string
          keypoints?: Json | null
          quality_score?: number | null
          school_id?: string
          session_plan_id?: string | null
          source?: string
          status?: string
          updated_at?: string | null
          video_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "biomech_captures_analyzer_code_fkey"
            columns: ["analyzer_code"]
            isOneToOne: false
            referencedRelation: "exercise_analyzers"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "biomech_captures_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "biomech_captures_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biomech_captures_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biomech_captures_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "biomech_captures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "biomech_captures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biomech_captures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biomech_captures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biomech_captures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biomech_captures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "biomech_captures_session_plan_id_fkey"
            columns: ["session_plan_id"]
            isOneToOne: false
            referencedRelation: "trainer_session_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      bkp_f0_enrollments_20260731: {
        Row: {
          child_id: string | null
          created_at: string | null
          end_date: string | null
          expires_at: string | null
          id: string | null
          monthly_fee: number | null
          offering_id: string | null
          offering_plan_id: string | null
          school_id: string | null
          secondary_sessions_used: number | null
          sessions_used: number | null
          start_date: string | null
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
          id?: string | null
          monthly_fee?: number | null
          offering_id?: string | null
          offering_plan_id?: string | null
          school_id?: string | null
          secondary_sessions_used?: number | null
          sessions_used?: number | null
          start_date?: string | null
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
          id?: string | null
          monthly_fee?: number | null
          offering_id?: string | null
          offering_plan_id?: string | null
          school_id?: string | null
          secondary_sessions_used?: number | null
          sessions_used?: number | null
          start_date?: string | null
          status?: string | null
          team_id?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bkp_f0_payments_20260731: {
        Row: {
          amount: number | null
          amount_paid: number | null
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          cash_session_id: string | null
          child_id: string | null
          coach_id: string | null
          concept: string | null
          created_at: string | null
          due_date: string | null
          early_payment_discount_applied: number | null
          epayco_fee: number | null
          gross_amount: number | null
          id: string | null
          last_failure_at: string | null
          last_failure_reason: string | null
          last_reminder_sent: string | null
          late_fee_amount: number | null
          late_fee_applied_at: string | null
          ocr_amount: number | null
          ocr_bank: string | null
          ocr_currency: string | null
          ocr_date: string | null
          ocr_destination: string | null
          ocr_destination_name: string | null
          ocr_origin_name: string | null
          ocr_provider: string | null
          ocr_raw_response: Json | null
          ocr_reference: string | null
          ocr_time: string | null
          offering_plan_id: string | null
          parent_id: string | null
          payment_channel: string | null
          payment_date: string | null
          payment_method: string | null
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_type: string | null
          period_month: number | null
          period_year: number | null
          provider_reference: string | null
          provider_transaction_id: string | null
          qr_id: string | null
          receipt_image_sha256: string | null
          receipt_image_sha256_source: string | null
          receipt_number: string | null
          receipt_reference_norm: string | null
          receipt_storage_bucket: string | null
          receipt_url: string | null
          receipt_verdict: string | null
          receipt_verdict_at: string | null
          receipt_verdict_reasons: Json | null
          reconciliation_status: string | null
          reference: string | null
          rejection_reason: string | null
          reminder_sent_at: string | null
          requires_review: boolean | null
          school_id: string | null
          sportmaps_fee: number | null
          status: string | null
          subscription_end_date: string | null
          subscription_start_date: string | null
          team_id: string | null
          unblocked_at: string | null
          unblocked_by: string | null
          unregistered_athlete_id: string | null
          updated_at: string | null
          user_id: string | null
          wompi_id: string | null
          wompi_reference: string | null
          wompi_transaction_id: string | null
        }
        Insert: {
          amount?: number | null
          amount_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          cash_session_id?: string | null
          child_id?: string | null
          coach_id?: string | null
          concept?: string | null
          created_at?: string | null
          due_date?: string | null
          early_payment_discount_applied?: number | null
          epayco_fee?: number | null
          gross_amount?: number | null
          id?: string | null
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_reminder_sent?: string | null
          late_fee_amount?: number | null
          late_fee_applied_at?: string | null
          ocr_amount?: number | null
          ocr_bank?: string | null
          ocr_currency?: string | null
          ocr_date?: string | null
          ocr_destination?: string | null
          ocr_destination_name?: string | null
          ocr_origin_name?: string | null
          ocr_provider?: string | null
          ocr_raw_response?: Json | null
          ocr_reference?: string | null
          ocr_time?: string | null
          offering_plan_id?: string | null
          parent_id?: string | null
          payment_channel?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_type?: string | null
          period_month?: number | null
          period_year?: number | null
          provider_reference?: string | null
          provider_transaction_id?: string | null
          qr_id?: string | null
          receipt_image_sha256?: string | null
          receipt_image_sha256_source?: string | null
          receipt_number?: string | null
          receipt_reference_norm?: string | null
          receipt_storage_bucket?: string | null
          receipt_url?: string | null
          receipt_verdict?: string | null
          receipt_verdict_at?: string | null
          receipt_verdict_reasons?: Json | null
          reconciliation_status?: string | null
          reference?: string | null
          rejection_reason?: string | null
          reminder_sent_at?: string | null
          requires_review?: boolean | null
          school_id?: string | null
          sportmaps_fee?: number | null
          status?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          team_id?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          wompi_id?: string | null
          wompi_reference?: string | null
          wompi_transaction_id?: string | null
        }
        Update: {
          amount?: number | null
          amount_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          cash_session_id?: string | null
          child_id?: string | null
          coach_id?: string | null
          concept?: string | null
          created_at?: string | null
          due_date?: string | null
          early_payment_discount_applied?: number | null
          epayco_fee?: number | null
          gross_amount?: number | null
          id?: string | null
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_reminder_sent?: string | null
          late_fee_amount?: number | null
          late_fee_applied_at?: string | null
          ocr_amount?: number | null
          ocr_bank?: string | null
          ocr_currency?: string | null
          ocr_date?: string | null
          ocr_destination?: string | null
          ocr_destination_name?: string | null
          ocr_origin_name?: string | null
          ocr_provider?: string | null
          ocr_raw_response?: Json | null
          ocr_reference?: string | null
          ocr_time?: string | null
          offering_plan_id?: string | null
          parent_id?: string | null
          payment_channel?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_type?: string | null
          period_month?: number | null
          period_year?: number | null
          provider_reference?: string | null
          provider_transaction_id?: string | null
          qr_id?: string | null
          receipt_image_sha256?: string | null
          receipt_image_sha256_source?: string | null
          receipt_number?: string | null
          receipt_reference_norm?: string | null
          receipt_storage_bucket?: string | null
          receipt_url?: string | null
          receipt_verdict?: string | null
          receipt_verdict_at?: string | null
          receipt_verdict_reasons?: Json | null
          reconciliation_status?: string | null
          reference?: string | null
          rejection_reason?: string | null
          reminder_sent_at?: string | null
          requires_review?: boolean | null
          school_id?: string | null
          sportmaps_fee?: number | null
          status?: string | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          team_id?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string | null
          user_id?: string | null
          wompi_id?: string | null
          wompi_reference?: string | null
          wompi_transaction_id?: string | null
        }
        Relationships: []
      }
      body_metrics: {
        Row: {
          arm_cm: number | null
          back_cm: number | null
          body_fat_pct: number | null
          chest_cm: number | null
          client_id: string
          client_type: string
          created_at: string
          height_cm: number | null
          hip_cm: number | null
          id: string
          measured_at: string
          muscle_mass_kg: number | null
          notes: string | null
          recorded_by: string
          school_id: string | null
          source: string
          thigh_cm: number | null
          updated_at: string
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          arm_cm?: number | null
          back_cm?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          client_id: string
          client_type?: string
          created_at?: string
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          measured_at: string
          muscle_mass_kg?: number | null
          notes?: string | null
          recorded_by: string
          school_id?: string | null
          source?: string
          thigh_cm?: number | null
          updated_at?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          arm_cm?: number | null
          back_cm?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          client_id?: string
          client_type?: string
          created_at?: string
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          measured_at?: string
          muscle_mass_kg?: number | null
          notes?: string | null
          recorded_by?: string
          school_id?: string | null
          source?: string
          thigh_cm?: number | null
          updated_at?: string
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_metrics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "body_metrics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_metrics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_metrics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_metrics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "body_metrics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      booking_holds: {
        Row: {
          athlete_id: string
          availability_slot_id: string
          created_at: string
          expires_at: string
          id: string
          scheduled_date: string
        }
        Insert: {
          athlete_id: string
          availability_slot_id: string
          created_at?: string
          expires_at?: string
          id?: string
          scheduled_date: string
        }
        Update: {
          athlete_id?: string
          availability_slot_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          scheduled_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_holds_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "booking_holds_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_holds_availability_slot_id_fkey"
            columns: ["availability_slot_id"]
            isOneToOne: false
            referencedRelation: "school_availability"
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
          scheduled_at?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "bookings_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_change_log: {
        Row: {
          after_state: Json
          before_state: Json
          change_source: string
          changed_at: string
          changed_by: string
          created_at: string
          id: string
          ip_address: unknown
          school_id: string
          user_agent: string | null
        }
        Insert: {
          after_state: Json
          before_state: Json
          change_source?: string
          changed_at?: string
          changed_by: string
          created_at?: string
          id?: string
          ip_address?: unknown
          school_id: string
          user_agent?: string | null
        }
        Update: {
          after_state?: Json
          before_state?: Json
          change_source?: string
          changed_at?: string
          changed_by?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          school_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branding_change_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "branding_change_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branding_change_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branding_change_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branding_change_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branding_change_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      bridge_heartbeats: {
        Row: {
          alerted_at: string | null
          bridge_name: string
          id: string
          last_seen_at: string
          school_id: string
        }
        Insert: {
          alerted_at?: string | null
          bridge_name: string
          id?: string
          last_seen_at?: string
          school_id: string
        }
        Update: {
          alerted_at?: string | null
          bridge_name?: string
          id?: string
          last_seen_at?: string
          school_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          amount: number
          category_id: string
          created_at: string
          created_by: string
          id: string
          owner_id: string
          owner_type: string
          period_month: number
          period_year: number
          updated_at: string
        }
        Insert: {
          amount: number
          category_id: string
          created_at?: string
          created_by: string
          id?: string
          owner_id: string
          owner_type: string
          period_month?: number
          period_year: number
          updated_at?: string
        }
        Update: {
          amount?: number
          category_id?: string
          created_at?: string
          created_by?: string
          id?: string
          owner_id?: string
          owner_type?: string
          period_month?: number
          period_year?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
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
      cash_session_entries: {
        Row: {
          amount: number
          concept: string
          created_at: string
          entry_type: string
          id: string
          notes: string | null
          payment_method: string
          reference_id: string | null
          reference_table: string | null
          registered_at: string
          registered_by: string
          school_id: string
          session_id: string
        }
        Insert: {
          amount: number
          concept: string
          created_at?: string
          entry_type: string
          id?: string
          notes?: string | null
          payment_method: string
          reference_id?: string | null
          reference_table?: string | null
          registered_at?: string
          registered_by: string
          school_id: string
          session_id: string
        }
        Update: {
          amount?: number
          concept?: string
          created_at?: string
          entry_type?: string
          id?: string
          notes?: string | null
          payment_method?: string
          reference_id?: string | null
          reference_table?: string | null
          registered_at?: string
          registered_by?: string
          school_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_session_entries_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "cash_session_entries_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_session_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "cash_session_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_session_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_session_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_session_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_session_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "cash_session_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          branch_id: string | null
          cash_difference: number | null
          closed_at: string | null
          closed_by: string | null
          closing_cash_declared: number | null
          created_at: string
          expected_cash: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_cash: number
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          cash_difference?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_cash_declared?: number | null
          created_at?: string
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_cash?: number
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          cash_difference?: number | null
          closed_at?: string | null
          closed_by?: string | null
          closing_cash_declared?: number | null
          created_at?: string
          expected_cash?: number | null
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_cash?: number
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "cash_sessions_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "cash_sessions_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "cash_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      children: {
        Row: {
          avatar_url: string | null
          blood_type: string | null
          branch_id: string | null
          created_at: string
          date_of_birth: string | null
          doc_number: string | null
          doc_type: string | null
          emergency_contact: string | null
          eps_name: string | null
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
          school_id: string | null
          team_id: string | null
          tshirt_size: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          blood_type?: string | null
          branch_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          doc_number?: string | null
          doc_type?: string | null
          emergency_contact?: string | null
          eps_name?: string | null
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
          school_id?: string | null
          team_id?: string | null
          tshirt_size?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          blood_type?: string | null
          branch_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          doc_number?: string | null
          doc_type?: string | null
          emergency_contact?: string | null
          eps_name?: string | null
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
          school_id?: string | null
          team_id?: string | null
          tshirt_size?: string | null
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
      children_stats: {
        Row: {
          child_id: string
          created_at: string | null
          id: string
          is_demo: boolean | null
          notes: string | null
          school_id: string | null
          stat_date: string
          stat_type: string
          unit: string
          updated_at: string | null
          value: number
        }
        Insert: {
          child_id: string
          created_at?: string | null
          id?: string
          is_demo?: boolean | null
          notes?: string | null
          school_id?: string | null
          stat_date?: string
          stat_type: string
          unit?: string
          updated_at?: string | null
          value: number
        }
        Update: {
          child_id?: string
          created_at?: string | null
          id?: string
          is_demo?: boolean | null
          notes?: string | null
          school_id?: string | null
          stat_date?: string
          stat_type?: string
          unit?: string
          updated_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "children_stats_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_stats_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_stats_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "children_stats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "children_stats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_stats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_stats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_stats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_stats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
          school_id: string
          start_time: string
          team_id: string
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
          school_id: string
          start_time: string
          team_id: string
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
          school_id?: string
          start_time?: string
          team_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "classes_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_program_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "classes_program_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_program_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "classes_program_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
          max_group_capacity: number | null
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
          max_group_capacity?: number | null
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
          max_group_capacity?: number | null
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
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_coach_team_plans"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "coach_availability_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_school_staff_publico"
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "coach_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "coach_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competition_results: {
        Row: {
          competition_date: string
          competition_name: string | null
          created_at: string
          id: string
          notes: string | null
          opponent: string | null
          recorded_by: string
          result_data: Json
          result_type: string
          school_id: string
          sport_category_id: string | null
          subject_id: string | null
          subject_type: string | null
          team_id: string | null
        }
        Insert: {
          competition_date: string
          competition_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opponent?: string | null
          recorded_by: string
          result_data?: Json
          result_type: string
          school_id: string
          sport_category_id?: string | null
          subject_id?: string | null
          subject_type?: string | null
          team_id?: string | null
        }
        Update: {
          competition_date?: string
          competition_name?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          opponent?: string | null
          recorded_by?: string
          result_data?: Json
          result_type?: string
          school_id?: string
          sport_category_id?: string | null
          subject_id?: string | null
          subject_type?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_results_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "competition_results_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_results_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_results_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_results_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_results_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "competition_results_sport_category_id_fkey"
            columns: ["sport_category_id"]
            isOneToOne: false
            referencedRelation: "sports_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "competition_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "competition_results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
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
      demo_links: {
        Row: {
          access_count: number
          accessed_at: string | null
          archetype: string
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          is_active: boolean
          logo_url: string | null
          notes: string | null
          primary_color: string | null
          prospect_email: string | null
          prospect_name: string | null
          prospect_phone: string | null
          reset_at: string | null
          school_id: string | null
          school_name: string
          sent_via: string | null
          token: string
        }
        Insert: {
          access_count?: number
          accessed_at?: string | null
          archetype?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          notes?: string | null
          primary_color?: string | null
          prospect_email?: string | null
          prospect_name?: string | null
          prospect_phone?: string | null
          reset_at?: string | null
          school_id?: string | null
          school_name: string
          sent_via?: string | null
          token?: string
        }
        Update: {
          access_count?: number
          accessed_at?: string | null
          archetype?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          is_active?: boolean
          logo_url?: string | null
          notes?: string | null
          primary_color?: string | null
          prospect_email?: string | null
          prospect_name?: string | null
          prospect_phone?: string | null
          reset_at?: string | null
          school_id?: string | null
          school_name?: string
          sent_via?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "demo_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "demo_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "demo_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demo_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      device_commands: {
        Row: {
          claimed_at: string | null
          cmd_seq: number | null
          command_type: string
          device_id: string
          direction: string
          error_message: string | null
          executed_at: string | null
          expires_at: string | null
          id: string
          issued_at: string | null
          issued_by: string | null
          metadata: Json | null
          school_id: string
          status: string
        }
        Insert: {
          claimed_at?: string | null
          cmd_seq?: number | null
          command_type: string
          device_id: string
          direction: string
          error_message?: string | null
          executed_at?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          metadata?: Json | null
          school_id: string
          status?: string
        }
        Update: {
          claimed_at?: string | null
          cmd_seq?: number | null
          command_type?: string
          device_id?: string
          direction?: string
          error_message?: string | null
          executed_at?: string | null
          expires_at?: string | null
          id?: string
          issued_at?: string | null
          issued_by?: string | null
          metadata?: Json | null
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_commands_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "turnstile_devices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_commands_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "device_commands_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_commands_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "device_commands_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_commands_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_commands_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_commands_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "device_commands_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      electronic_invoice_items: {
        Row: {
          code_reference: string | null
          created_at: string
          discount_rate: number
          id: string
          invoice_id: string
          is_excluded: boolean
          line_no: number
          name: string
          quantity: number
          tax_amount: number | null
          tax_code: string
          tax_rate: number
          taxable_amount: number | null
          total: number | null
          unit_price: number
        }
        Insert: {
          code_reference?: string | null
          created_at?: string
          discount_rate?: number
          id?: string
          invoice_id: string
          is_excluded?: boolean
          line_no?: number
          name: string
          quantity?: number
          tax_amount?: number | null
          tax_code?: string
          tax_rate?: number
          taxable_amount?: number | null
          total?: number | null
          unit_price: number
        }
        Update: {
          code_reference?: string | null
          created_at?: string
          discount_rate?: number
          id?: string
          invoice_id?: string
          is_excluded?: boolean
          line_no?: number
          name?: string
          quantity?: number
          tax_amount?: number | null
          tax_code?: string
          tax_rate?: number
          taxable_amount?: number | null
          total?: number | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "electronic_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "electronic_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      electronic_invoice_providers: {
        Row: {
          config: Json
          created_at: string
          credentials: Json
          enabled: boolean
          id: string
          is_default: boolean
          owner_id: string
          owner_type: string
          provider: string
          sandbox: boolean
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          credentials?: Json
          enabled?: boolean
          id?: string
          is_default?: boolean
          owner_id: string
          owner_type: string
          provider: string
          sandbox?: boolean
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          credentials?: Json
          enabled?: boolean
          id?: string
          is_default?: boolean
          owner_id?: string
          owner_type?: string
          provider?: string
          sandbox?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      electronic_invoices: {
        Row: {
          created_at: string
          cufe: string | null
          currency: string
          customer_snapshot: Json | null
          dian_code: string | null
          dian_response: Json | null
          document_type: string
          error_message: string | null
          id: string
          marketplace_transaction_id: string | null
          number: string | null
          order_id: string | null
          owner_id: string
          owner_type: string
          payment_id: string | null
          pdf_url: string | null
          prefix: string | null
          provider: string
          provider_bill_id: string | null
          public_url: string | null
          qr_image: string | null
          qr_url: string | null
          reference_code: string
          status: string
          tax_amount: number | null
          taxable_amount: number | null
          total: number | null
          updated_at: string
          validated_at: string | null
          xml_url: string | null
        }
        Insert: {
          created_at?: string
          cufe?: string | null
          currency?: string
          customer_snapshot?: Json | null
          dian_code?: string | null
          dian_response?: Json | null
          document_type?: string
          error_message?: string | null
          id?: string
          marketplace_transaction_id?: string | null
          number?: string | null
          order_id?: string | null
          owner_id: string
          owner_type: string
          payment_id?: string | null
          pdf_url?: string | null
          prefix?: string | null
          provider: string
          provider_bill_id?: string | null
          public_url?: string | null
          qr_image?: string | null
          qr_url?: string | null
          reference_code: string
          status?: string
          tax_amount?: number | null
          taxable_amount?: number | null
          total?: number | null
          updated_at?: string
          validated_at?: string | null
          xml_url?: string | null
        }
        Update: {
          created_at?: string
          cufe?: string | null
          currency?: string
          customer_snapshot?: Json | null
          dian_code?: string | null
          dian_response?: Json | null
          document_type?: string
          error_message?: string | null
          id?: string
          marketplace_transaction_id?: string | null
          number?: string | null
          order_id?: string | null
          owner_id?: string
          owner_type?: string
          payment_id?: string | null
          pdf_url?: string | null
          prefix?: string | null
          provider?: string
          provider_bill_id?: string | null
          public_url?: string | null
          qr_image?: string | null
          qr_url?: string | null
          reference_code?: string
          status?: string
          tax_amount?: number | null
          taxable_amount?: number | null
          total?: number | null
          updated_at?: string
          validated_at?: string | null
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "electronic_invoices_order_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "my_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electronic_invoices_order_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electronic_invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electronic_invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments_with_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electronic_invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electronic_invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["active_payment_id"]
          },
          {
            foreignKeyName: "electronic_invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_abonos_summary"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "electronic_invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_contacts"
            referencedColumns: ["payment_id"]
          },
        ]
      }
      email_sends: {
        Row: {
          attempts: number
          batch_id: string | null
          created_at: string
          email_type: string
          error: string | null
          id: string
          invitation_id: string | null
          provider: string
          provider_message_id: string | null
          school_id: string | null
          status: string
          to_email: string
        }
        Insert: {
          attempts?: number
          batch_id?: string | null
          created_at?: string
          email_type?: string
          error?: string | null
          id?: string
          invitation_id?: string | null
          provider?: string
          provider_message_id?: string | null
          school_id?: string | null
          status?: string
          to_email: string
        }
        Update: {
          attempts?: number
          batch_id?: string | null
          created_at?: string
          email_type?: string
          error?: string | null
          id?: string
          invitation_id?: string | null
          provider?: string
          provider_message_id?: string | null
          school_id?: string | null
          status?: string
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sends_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "email_sends_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sends_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      enrollment_categories: {
        Row: {
          billable: boolean
          category_id: string
          created_at: string
          end_date: string | null
          enrollment_id: string
          id: string
          is_primary: boolean
          school_id: string
          start_date: string
          status: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          billable?: boolean
          category_id: string
          created_at?: string
          end_date?: string | null
          enrollment_id: string
          id?: string
          is_primary?: boolean
          school_id: string
          start_date?: string
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          billable?: boolean
          category_id?: string
          created_at?: string
          end_date?: string | null
          enrollment_id?: string
          id?: string
          is_primary?: boolean
          school_id?: string
          start_date?: string
          status?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "school_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_categories_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_categories_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "enrollment_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "enrollment_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "enrollment_categories_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "enrollment_categories_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_categories_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "enrollment_categories_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      enrollment_integrity_findings: {
        Row: {
          athlete_col: string
          athlete_id: string
          athlete_name: string
          detected_at: string
          id: string
          last_enrollment_status: string | null
          last_monthly_fee: number | null
          last_plan_name: string | null
          last_seen_at: string
          last_team_name: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          school_id: string
          status: string
        }
        Insert: {
          athlete_col: string
          athlete_id: string
          athlete_name: string
          detected_at?: string
          id?: string
          last_enrollment_status?: string | null
          last_monthly_fee?: number | null
          last_plan_name?: string | null
          last_seen_at?: string
          last_team_name?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          school_id: string
          status?: string
        }
        Update: {
          athlete_col?: string
          athlete_id?: string
          athlete_name?: string
          detected_at?: string
          id?: string
          last_enrollment_status?: string | null
          last_monthly_fee?: number | null
          last_plan_name?: string | null
          last_seen_at?: string
          last_team_name?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_integrity_findings_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "enrollment_integrity_findings_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_integrity_findings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "enrollment_integrity_findings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_integrity_findings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_integrity_findings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_integrity_findings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_integrity_findings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      enrollments: {
        Row: {
          child_id: string | null
          created_at: string | null
          end_date: string | null
          expires_at: string | null
          fee_is_manual: boolean
          fee_reason: string | null
          fee_set_at: string | null
          fee_set_by: string | null
          id: string
          monthly_fee: number | null
          offering_id: string | null
          offering_plan_id: string | null
          paused_at: string | null
          paused_reason: string | null
          paused_until: string | null
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
          fee_is_manual?: boolean
          fee_reason?: string | null
          fee_set_at?: string | null
          fee_set_by?: string | null
          id?: string
          monthly_fee?: number | null
          offering_id?: string | null
          offering_plan_id?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          paused_until?: string | null
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
          fee_is_manual?: boolean
          fee_reason?: string | null
          fee_set_at?: string | null
          fee_set_by?: string | null
          id?: string
          monthly_fee?: number | null
          offering_id?: string | null
          offering_plan_id?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          paused_until?: string | null
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
            foreignKeyName: "enrollments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "enrollments_fee_set_by_fkey"
            columns: ["fee_set_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "enrollments_fee_set_by_fkey"
            columns: ["fee_set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
      equipment_assignment_logs: {
        Row: {
          action: string
          assignment_id: string
          created_at: string
          id: string
          new_value: Json | null
          old_value: Json | null
          user_id: string | null
        }
        Insert: {
          action: string
          assignment_id: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Update: {
          action?: string
          assignment_id?: string
          created_at?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_assignment_logs_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "equipment_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignment_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "equipment_assignment_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_assignments: {
        Row: {
          accepted_at: string | null
          acta_folio: string | null
          acta_pdf_url: string | null
          assigned_by: string | null
          assigned_to: string
          branch_id: string | null
          checkout_note: string | null
          checkout_photo_url: string | null
          content_snapshot: Json | null
          created_at: string
          delivered_at: string | null
          dispute_note: string | null
          entrega_approved_at: string | null
          entrega_approved_by: string | null
          id: string
          item_id: string
          mode: string
          quantity: number
          reject_note: string | null
          reported_quantity: number | null
          return_due_at: string | null
          returned_quantity: number
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          acta_folio?: string | null
          acta_pdf_url?: string | null
          assigned_by?: string | null
          assigned_to: string
          branch_id?: string | null
          checkout_note?: string | null
          checkout_photo_url?: string | null
          content_snapshot?: Json | null
          created_at?: string
          delivered_at?: string | null
          dispute_note?: string | null
          entrega_approved_at?: string | null
          entrega_approved_by?: string | null
          id?: string
          item_id: string
          mode: string
          quantity: number
          reject_note?: string | null
          reported_quantity?: number | null
          return_due_at?: string | null
          returned_quantity?: number
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          acta_folio?: string | null
          acta_pdf_url?: string | null
          assigned_by?: string | null
          assigned_to?: string
          branch_id?: string | null
          checkout_note?: string | null
          checkout_photo_url?: string | null
          content_snapshot?: Json | null
          created_at?: string
          delivered_at?: string | null
          dispute_note?: string | null
          entrega_approved_at?: string | null
          entrega_approved_by?: string | null
          id?: string
          item_id?: string
          mode?: string
          quantity?: number
          reject_note?: string | null
          reported_quantity?: number | null
          return_due_at?: string | null
          returned_quantity?: number
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "equipment_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "equipment_assignments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_entrega_approved_by_fkey"
            columns: ["entrega_approved_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "equipment_assignments_entrega_approved_by_fkey"
            columns: ["entrega_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "equipment_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "equipment_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      equipment_items: {
        Row: {
          branch_id: string | null
          condition: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          photo_url: string | null
          quantity_available: number
          quantity_total: number
          school_id: string
          self_checkout_override: string | null
          size: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          photo_url?: string | null
          quantity_available: number
          quantity_total: number
          school_id: string
          self_checkout_override?: string | null
          size?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          condition?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          photo_url?: string | null
          quantity_available?: number
          quantity_total?: number
          school_id?: string
          self_checkout_override?: string | null
          size?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_items_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "equipment_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "equipment_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      equipment_returns: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          assignment_id: string
          condition: string
          created_at: string
          dispute_note: string | null
          id: string
          note: string | null
          photo_url: string | null
          quantity: number
          requested_at: string
          requested_by: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          assignment_id: string
          condition: string
          created_at?: string
          dispute_note?: string | null
          id?: string
          note?: string | null
          photo_url?: string | null
          quantity: number
          requested_at?: string
          requested_by?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          assignment_id?: string
          condition?: string
          created_at?: string
          dispute_note?: string | null
          id?: string
          note?: string | null
          photo_url?: string | null
          quantity?: number
          requested_at?: string
          requested_by?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_returns_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "equipment_returns_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_returns_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "equipment_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_returns_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "equipment_returns_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_returns_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "equipment_returns_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_returns_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_returns_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_returns_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_returns_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      equipment_settings: {
        Row: {
          created_at: string
          default_return_days: number | null
          require_photo_admin_mode: boolean
          school_id: string
          self_checkout_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_return_days?: number | null
          require_photo_admin_mode?: boolean
          school_id: string
          self_checkout_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_return_days?: number | null
          require_photo_admin_mode?: boolean
          school_id?: string
          self_checkout_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "equipment_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "equipment_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      event_categories_config: {
        Row: {
          active: boolean | null
          age_max: number | null
          age_min: number | null
          birth_year_max: number | null
          birth_year_min: number | null
          category: string
          created_at: string
          crossover_allowed: boolean | null
          division: string
          event_id: string
          id: string
          level: string
          min_not_met_action: string | null
          rama: string
          routine_max_seconds: number | null
          scoring_system: string | null
          sort_order: number | null
          team_max: number | null
          team_min: number | null
        }
        Insert: {
          active?: boolean | null
          age_max?: number | null
          age_min?: number | null
          birth_year_max?: number | null
          birth_year_min?: number | null
          category: string
          created_at?: string
          crossover_allowed?: boolean | null
          division: string
          event_id: string
          id?: string
          level: string
          min_not_met_action?: string | null
          rama: string
          routine_max_seconds?: number | null
          scoring_system?: string | null
          sort_order?: number | null
          team_max?: number | null
          team_min?: number | null
        }
        Update: {
          active?: boolean | null
          age_max?: number | null
          age_min?: number | null
          birth_year_max?: number | null
          birth_year_min?: number | null
          category?: string
          created_at?: string
          crossover_allowed?: boolean | null
          division?: string
          event_id?: string
          id?: string
          level?: string
          min_not_met_action?: string | null
          rama?: string
          routine_max_seconds?: number | null
          scoring_system?: string | null
          sort_order?: number | null
          team_max?: number | null
          team_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_categories_config_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_delegation_payments: {
        Row: {
          amount: number
          created_at: string
          currency: string
          delegation_id: string
          event_id: string
          id: string
          notes: string | null
          payer_profile_id: string | null
          payment_link_id: string | null
          payment_method: string
          proof_url: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          status: string
          team_member_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          delegation_id: string
          event_id: string
          id?: string
          notes?: string | null
          payer_profile_id?: string | null
          payment_link_id?: string | null
          payment_method: string
          proof_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          status?: string
          team_member_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          delegation_id?: string
          event_id?: string
          id?: string
          notes?: string | null
          payer_profile_id?: string | null
          payment_link_id?: string | null
          payment_method?: string
          proof_url?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          status?: string
          team_member_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_delegation_payments_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "event_delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_delegation_payments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_delegation_payments_payer_profile_id_fkey"
            columns: ["payer_profile_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "event_delegation_payments_payer_profile_id_fkey"
            columns: ["payer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_delegation_payments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "event_delegation_payments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_delegation_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "event_delegation_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_delegation_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_delegation_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_delegation_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_delegation_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "event_delegation_payments_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "event_team_members"
            referencedColumns: ["id"]
          },
        ]
      }
      event_delegations: {
        Row: {
          balance_due_at: string | null
          confirmed_at: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          event_id: string
          id: string
          kit_type: string | null
          package_locked_at: string | null
          payer_mode: string | null
          price_phase_id: string | null
          referral_source: string | null
          rejection_reason: string | null
          school_id: string
          status: string
          submitted_at: string | null
          total_owed: number | null
          total_paid: number | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          balance_due_at?: string | null
          confirmed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          event_id: string
          id?: string
          kit_type?: string | null
          package_locked_at?: string | null
          payer_mode?: string | null
          price_phase_id?: string | null
          referral_source?: string | null
          rejection_reason?: string | null
          school_id: string
          status?: string
          submitted_at?: string | null
          total_owed?: number | null
          total_paid?: number | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          balance_due_at?: string | null
          confirmed_at?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          event_id?: string
          id?: string
          kit_type?: string | null
          package_locked_at?: string | null
          payer_mode?: string | null
          price_phase_id?: string | null
          referral_source?: string | null
          rejection_reason?: string | null
          school_id?: string
          status?: string
          submitted_at?: string | null
          total_owed?: number | null
          total_paid?: number | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_delegations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_delegations_price_phase_id_fkey"
            columns: ["price_phase_id"]
            isOneToOne: false
            referencedRelation: "event_price_phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_delegations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "event_delegations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_delegations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_delegations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_delegations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_delegations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      event_invitations: {
        Row: {
          claimed_school_id: string | null
          created_at: string
          created_by: string
          event_id: string
          expires_at: string | null
          id: string
          invited_email: string | null
          invited_school_name: string | null
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          claimed_school_id?: string | null
          created_at?: string
          created_by: string
          event_id: string
          expires_at?: string | null
          id?: string
          invited_email?: string | null
          invited_school_name?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          claimed_school_id?: string | null
          created_at?: string
          created_by?: string
          event_id?: string
          expires_at?: string | null
          id?: string
          invited_email?: string | null
          invited_school_name?: string | null
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_invitations_claimed_school_id_fkey"
            columns: ["claimed_school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "event_invitations_claimed_school_id_fkey"
            columns: ["claimed_school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitations_claimed_school_id_fkey"
            columns: ["claimed_school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitations_claimed_school_id_fkey"
            columns: ["claimed_school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitations_claimed_school_id_fkey"
            columns: ["claimed_school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitations_claimed_school_id_fkey"
            columns: ["claimed_school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "event_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "event_invitations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_invitations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_organizers: {
        Row: {
          bank_data: Json | null
          bio: string | null
          city: string | null
          created_at: string
          id: string
          is_verified: boolean | null
          logo_url: string | null
          nequi_number: string | null
          nit: string | null
          organization_name: string | null
          payment_methods: string[] | null
          profile_id: string
          qr_code_url: string | null
          qr_smart_enabled: boolean | null
          sports: string[] | null
          updated_at: string
          verification_doc_url: string | null
          whatsapp_number: string | null
        }
        Insert: {
          bank_data?: Json | null
          bio?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean | null
          logo_url?: string | null
          nequi_number?: string | null
          nit?: string | null
          organization_name?: string | null
          payment_methods?: string[] | null
          profile_id: string
          qr_code_url?: string | null
          qr_smart_enabled?: boolean | null
          sports?: string[] | null
          updated_at?: string
          verification_doc_url?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          bank_data?: Json | null
          bio?: string | null
          city?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean | null
          logo_url?: string | null
          nequi_number?: string | null
          nit?: string | null
          organization_name?: string | null
          payment_methods?: string[] | null
          profile_id?: string
          qr_code_url?: string | null
          qr_smart_enabled?: boolean | null
          sports?: string[] | null
          updated_at?: string
          verification_doc_url?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_organizers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "event_organizers_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_price_phases: {
        Row: {
          accommodation_double_extra: number | null
          accommodation_single_extra: number | null
          accommodation_triple_extra: number | null
          created_at: string
          crossover_price_pkg: number | null
          crossover_price_solo: number | null
          deposit_percent: number
          event_id: string
          extra_kit_price: number | null
          id: string
          kit_type: string
          phase_name: string
          price_pkg1: number | null
          price_pkg2: number | null
          price_pkg3: number | null
          price_solo: number | null
          sort_order: number | null
          valid_until: string
        }
        Insert: {
          accommodation_double_extra?: number | null
          accommodation_single_extra?: number | null
          accommodation_triple_extra?: number | null
          created_at?: string
          crossover_price_pkg?: number | null
          crossover_price_solo?: number | null
          deposit_percent?: number
          event_id: string
          extra_kit_price?: number | null
          id?: string
          kit_type?: string
          phase_name: string
          price_pkg1?: number | null
          price_pkg2?: number | null
          price_pkg3?: number | null
          price_solo?: number | null
          sort_order?: number | null
          valid_until: string
        }
        Update: {
          accommodation_double_extra?: number | null
          accommodation_single_extra?: number | null
          accommodation_triple_extra?: number | null
          created_at?: string
          crossover_price_pkg?: number | null
          crossover_price_solo?: number | null
          deposit_percent?: number
          event_id?: string
          extra_kit_price?: number | null
          id?: string
          kit_type?: string
          phase_name?: string
          price_pkg1?: number | null
          price_pkg2?: number | null
          price_pkg3?: number | null
          price_solo?: number | null
          sort_order?: number | null
          valid_until?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_price_phases_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_registrations: {
        Row: {
          amount_paid: number | null
          approved_at: string | null
          approved_by: string | null
          cash_session_id: string | null
          category_id: string | null
          child_id: string | null
          created_at: string
          delegation_id: string | null
          event_id: string
          id: string
          is_independent: boolean
          notes: string | null
          participant_age: number | null
          participant_email: string | null
          participant_name: string
          participant_phone: string
          participant_role: string | null
          payment_id: string | null
          payment_method: string | null
          payment_proof_url: string | null
          payment_status: string | null
          referral_source: string | null
          rejection_reason: string | null
          school_id: string | null
          status: string
          team_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          cash_session_id?: string | null
          category_id?: string | null
          child_id?: string | null
          created_at?: string
          delegation_id?: string | null
          event_id: string
          id?: string
          is_independent?: boolean
          notes?: string | null
          participant_age?: number | null
          participant_email?: string | null
          participant_name: string
          participant_phone: string
          participant_role?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_status?: string | null
          referral_source?: string | null
          rejection_reason?: string | null
          school_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          cash_session_id?: string | null
          category_id?: string | null
          child_id?: string | null
          created_at?: string
          delegation_id?: string | null
          event_id?: string
          id?: string
          is_independent?: boolean
          notes?: string | null
          participant_age?: number | null
          participant_email?: string | null
          participant_name?: string
          participant_phone?: string
          participant_role?: string | null
          payment_id?: string | null
          payment_method?: string | null
          payment_proof_url?: string | null
          payment_status?: string | null
          referral_source?: string | null
          rejection_reason?: string | null
          school_id?: string | null
          status?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_registrations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "event_registrations_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_categories_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "event_registrations_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "event_delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments_with_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["active_payment_id"]
          },
          {
            foreignKeyName: "event_registrations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_abonos_summary"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "event_registrations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_contacts"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "event_registrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "event_registrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_registrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "event_registrations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "event_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_team_coaches: {
        Row: {
          certification: string | null
          coach_type: string
          created_at: string
          delegation_id: string
          extra_cost_usd: number | null
          full_name: string
          has_discount: boolean | null
          id: string
          phone: string | null
          profile_id: string | null
          team_id: string
        }
        Insert: {
          certification?: string | null
          coach_type?: string
          created_at?: string
          delegation_id: string
          extra_cost_usd?: number | null
          full_name: string
          has_discount?: boolean | null
          id?: string
          phone?: string | null
          profile_id?: string | null
          team_id: string
        }
        Update: {
          certification?: string | null
          coach_type?: string
          created_at?: string
          delegation_id?: string
          extra_cost_usd?: number | null
          full_name?: string
          has_discount?: boolean | null
          id?: string
          phone?: string | null
          profile_id?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_team_coaches_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "event_delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_coaches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "event_team_coaches_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_coaches_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "event_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_team_members: {
        Row: {
          age_validation: string | null
          bag_size: string | null
          birth_year: number | null
          child_id: string | null
          created_at: string
          crossover_team_id: string | null
          delegation_id: string
          document_number: string | null
          full_name: string
          id: string
          is_crossover: boolean | null
          profile_id: string | null
          shirt_size: string | null
          team_id: string
        }
        Insert: {
          age_validation?: string | null
          bag_size?: string | null
          birth_year?: number | null
          child_id?: string | null
          created_at?: string
          crossover_team_id?: string | null
          delegation_id: string
          document_number?: string | null
          full_name: string
          id?: string
          is_crossover?: boolean | null
          profile_id?: string | null
          shirt_size?: string | null
          team_id: string
        }
        Update: {
          age_validation?: string | null
          bag_size?: string | null
          birth_year?: number | null
          child_id?: string | null
          created_at?: string
          crossover_team_id?: string | null
          delegation_id?: string
          document_number?: string | null
          full_name?: string
          id?: string
          is_crossover?: boolean | null
          profile_id?: string | null
          shirt_size?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_team_members_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_members_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_members_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "event_team_members_crossover_team_id_fkey"
            columns: ["crossover_team_id"]
            isOneToOne: false
            referencedRelation: "event_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_members_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "event_delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "event_team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "event_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      event_teams: {
        Row: {
          accommodation: string
          category_id: string | null
          created_at: string
          delegation_id: string
          event_id: string
          id: string
          locked_price: number | null
          package_type: string
          status: string
          team_name: string
          updated_at: string
        }
        Insert: {
          accommodation?: string
          category_id?: string | null
          created_at?: string
          delegation_id: string
          event_id: string
          id?: string
          locked_price?: number | null
          package_type?: string
          status?: string
          team_name: string
          updated_at?: string
        }
        Update: {
          accommodation?: string
          category_id?: string | null
          created_at?: string
          delegation_id?: string
          event_id?: string
          id?: string
          locked_price?: number | null
          package_type?: string
          status?: string
          team_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_teams_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_categories_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_teams_delegation_id_fkey"
            columns: ["delegation_id"]
            isOneToOne: false
            referencedRelation: "event_delegations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_teams_event_id_fkey"
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
          allow_individual_registration: boolean
          banner_url: string | null
          capacity: number | null
          city: string
          coach_discount_usd: number | null
          companion_discount_usd: number | null
          competition_format: string | null
          contact_email: string | null
          contact_phone: string | null
          correction_deadline: string | null
          created_at: string
          creator_id: string
          creator_role: string
          crossover_allowed: boolean | null
          currency: string | null
          description: string | null
          end_time: string | null
          event_date: string
          event_type: string
          free_package_every: number | null
          id: string
          image_url: string | null
          invited_schools: string[] | null
          kit_deadline_gold: string | null
          kit_deadline_platino: string | null
          lat: number | null
          lng: number | null
          notes: string | null
          organizer_id: string | null
          payer_mode: string
          payment_deadline: string | null
          payment_gates_approval: boolean
          payment_methods: string[] | null
          presential_reg_end: string | null
          presential_reg_start: string | null
          price: number | null
          referral_tracking_enabled: boolean | null
          registration_deadline: string | null
          registration_type: string
          registrations_open: boolean | null
          school_id: string | null
          slug: string
          sport: string
          start_time: string
          status: string
          title: string
          tournament_scope: string | null
          updated_at: string
          virtual_reg_end: string | null
          virtual_reg_start: string | null
          visibility: string
        }
        Insert: {
          address: string
          allow_individual_registration?: boolean
          banner_url?: string | null
          capacity?: number | null
          city: string
          coach_discount_usd?: number | null
          companion_discount_usd?: number | null
          competition_format?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          correction_deadline?: string | null
          created_at?: string
          creator_id: string
          creator_role: string
          crossover_allowed?: boolean | null
          currency?: string | null
          description?: string | null
          end_time?: string | null
          event_date: string
          event_type?: string
          free_package_every?: number | null
          id?: string
          image_url?: string | null
          invited_schools?: string[] | null
          kit_deadline_gold?: string | null
          kit_deadline_platino?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          organizer_id?: string | null
          payer_mode?: string
          payment_deadline?: string | null
          payment_gates_approval?: boolean
          payment_methods?: string[] | null
          presential_reg_end?: string | null
          presential_reg_start?: string | null
          price?: number | null
          referral_tracking_enabled?: boolean | null
          registration_deadline?: string | null
          registration_type?: string
          registrations_open?: boolean | null
          school_id?: string | null
          slug: string
          sport: string
          start_time: string
          status?: string
          title: string
          tournament_scope?: string | null
          updated_at?: string
          virtual_reg_end?: string | null
          virtual_reg_start?: string | null
          visibility?: string
        }
        Update: {
          address?: string
          allow_individual_registration?: boolean
          banner_url?: string | null
          capacity?: number | null
          city?: string
          coach_discount_usd?: number | null
          companion_discount_usd?: number | null
          competition_format?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          correction_deadline?: string | null
          created_at?: string
          creator_id?: string
          creator_role?: string
          crossover_allowed?: boolean | null
          currency?: string | null
          description?: string | null
          end_time?: string | null
          event_date?: string
          event_type?: string
          free_package_every?: number | null
          id?: string
          image_url?: string | null
          invited_schools?: string[] | null
          kit_deadline_gold?: string | null
          kit_deadline_platino?: string | null
          lat?: number | null
          lng?: number | null
          notes?: string | null
          organizer_id?: string | null
          payer_mode?: string
          payment_deadline?: string | null
          payment_gates_approval?: boolean
          payment_methods?: string[] | null
          presential_reg_end?: string | null
          presential_reg_start?: string | null
          price?: number | null
          referral_tracking_enabled?: boolean | null
          registration_deadline?: string | null
          registration_type?: string
          registrations_open?: boolean | null
          school_id?: string | null
          slug?: string
          sport?: string
          start_time?: string
          status?: string
          title?: string
          tournament_scope?: string | null
          updated_at?: string
          virtual_reg_end?: string | null
          virtual_reg_start?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "events_organizer_id_fkey"
            columns: ["organizer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      exercise_analyzer_mappings: {
        Row: {
          analyzer_code: string
          created_at: string | null
          id: string
          name_pattern: string
          wger_id: number | null
        }
        Insert: {
          analyzer_code: string
          created_at?: string | null
          id?: string
          name_pattern: string
          wger_id?: number | null
        }
        Update: {
          analyzer_code?: string
          created_at?: string | null
          id?: string
          name_pattern?: string
          wger_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exercise_analyzer_mappings_analyzer_code_fkey"
            columns: ["analyzer_code"]
            isOneToOne: false
            referencedRelation: "exercise_analyzers"
            referencedColumns: ["code"]
          },
        ]
      }
      exercise_analyzers: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          id: string
          key_landmarks: string[] | null
          metrics: Json | null
          name: string
          thresholds: Json | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          id?: string
          key_landmarks?: string[] | null
          metrics?: Json | null
          name: string
          thresholds?: Json | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          id?: string
          key_landmarks?: string[] | null
          metrics?: Json | null
          name?: string
          thresholds?: Json | null
        }
        Relationships: []
      }
      expense_attachments: {
        Row: {
          created_at: string
          expense_id: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          expense_id: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          expense_id?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_attachments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          is_system: boolean
          name: string
          owner_id: string | null
          owner_type: string | null
          parent_id: string | null
          school_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          is_system?: boolean
          name: string
          owner_id?: string | null
          owner_type?: string | null
          parent_id?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          is_system?: boolean
          name?: string
          owner_id?: string | null
          owner_type?: string | null
          parent_id?: string | null
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "expense_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          bill_id: string | null
          branch_id: string | null
          category_id: string
          concept: string
          created_at: string
          created_by: string
          expense_date: string
          id: string
          kind: Database["public"]["Enums"]["expense_kind"]
          notes: string | null
          owner_id: string
          owner_type: string
          paid_date: string | null
          payment_method: Database["public"]["Enums"]["pay_method"] | null
          reference: string | null
          school_id: string | null
          source_payment_id: string | null
          status: Database["public"]["Enums"]["expense_status"]
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          bill_id?: string | null
          branch_id?: string | null
          category_id: string
          concept: string
          created_at?: string
          created_by: string
          expense_date: string
          id?: string
          kind?: Database["public"]["Enums"]["expense_kind"]
          notes?: string | null
          owner_id: string
          owner_type: string
          paid_date?: string | null
          payment_method?: Database["public"]["Enums"]["pay_method"] | null
          reference?: string | null
          school_id?: string | null
          source_payment_id?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          bill_id?: string | null
          branch_id?: string | null
          category_id?: string
          concept?: string
          created_at?: string
          created_by?: string
          expense_date?: string
          id?: string
          kind?: Database["public"]["Enums"]["expense_kind"]
          notes?: string | null
          owner_id?: string
          owner_type?: string
          paid_date?: string | null
          payment_method?: Database["public"]["Enums"]["pay_method"] | null
          reference?: string | null
          school_id?: string | null
          source_payment_id?: string | null
          status?: Database["public"]["Enums"]["expense_status"]
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "supplier_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "expenses_source_payment_id_fkey"
            columns: ["source_payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_source_payment_id_fkey"
            columns: ["source_payment_id"]
            isOneToOne: false
            referencedRelation: "payments_with_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_source_payment_id_fkey"
            columns: ["source_payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_source_payment_id_fkey"
            columns: ["source_payment_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["active_payment_id"]
          },
          {
            foreignKeyName: "expenses_source_payment_id_fkey"
            columns: ["source_payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_abonos_summary"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "expenses_source_payment_id_fkey"
            columns: ["source_payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_contacts"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      external_school_imports: {
        Row: {
          external_ref: string
          id: string
          imported_at: string
          raw_payload: Json | null
          school_id: string
          source: string
          updated_at: string
        }
        Insert: {
          external_ref: string
          id?: string
          imported_at?: string
          raw_payload?: Json | null
          school_id: string
          source: string
          updated_at?: string
        }
        Update: {
          external_ref?: string
          id?: string
          imported_at?: string
          raw_payload?: Json | null
          school_id?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_school_imports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "external_school_imports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_school_imports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_school_imports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_school_imports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_school_imports_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
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
          min_booking_advance_hours: number
          min_cancellation_hours: number
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
          min_booking_advance_hours?: number
          min_cancellation_hours?: number
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
          min_booking_advance_hours?: number
          min_cancellation_hours?: number
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "facilities_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      facility_availability: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          facility_id: string
          id: string
          max_group_capacity: number
          school_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          facility_id: string
          id?: string
          max_group_capacity?: number
          school_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          facility_id?: string
          id?: string
          max_group_capacity?: number
          school_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_availability_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "facility_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
          hour_bank_reservation_id: string | null
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
          hour_bank_reservation_id?: string | null
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
          hour_bank_reservation_id?: string | null
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
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
            foreignKeyName: "facility_reservations_hour_bank_reservation_id_fkey"
            columns: ["hour_bank_reservation_id"]
            isOneToOne: false
            referencedRelation: "hour_bank_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facility_reservations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "facility_reservations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
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
      football_match_events: {
        Row: {
          created_at: string
          created_by: string
          id: string
          minute: number | null
          school_id: string
          source_id: string
          source_type: string
          subject_id: string
          subject_type: string
          team_id: string
          type: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          minute?: number | null
          school_id: string
          source_id: string
          source_type: string
          subject_id: string
          subject_type: string
          team_id: string
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          minute?: number | null
          school_id?: string
          source_id?: string
          source_type?: string
          subject_id?: string
          subject_type?: string
          team_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "football_match_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "football_match_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "football_match_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "football_match_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "football_match_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "football_match_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "football_match_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "football_match_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "football_match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "football_match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "football_match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "football_match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "group_class_athletes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "health_records_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hour_bank_periods: {
        Row: {
          consumed_minutes: number
          created_at: string
          enrollment_id: string
          id: string
          included_minutes: number
          period_end: string
          period_start: string
          reserved_minutes: number
          school_id: string
          updated_at: string
        }
        Insert: {
          consumed_minutes?: number
          created_at?: string
          enrollment_id: string
          id?: string
          included_minutes: number
          period_end: string
          period_start: string
          reserved_minutes?: number
          school_id: string
          updated_at?: string
        }
        Update: {
          consumed_minutes?: number
          created_at?: string
          enrollment_id?: string
          id?: string
          included_minutes?: number
          period_end?: string
          period_start?: string
          reserved_minutes?: number
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hour_bank_periods_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_periods_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "hour_bank_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hour_bank_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_periods_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      hour_bank_reservations: {
        Row: {
          created_at: string
          created_by: string | null
          enrollment_id: string
          id: string
          minutes: number
          period_id: string
          reservation_date: string
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enrollment_id: string
          id?: string
          minutes: number
          period_id: string
          reservation_date: string
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enrollment_id?: string
          id?: string
          minutes?: number
          period_id?: string
          reservation_date?: string
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hour_bank_reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "hour_bank_reservations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_reservations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_reservations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "hour_bank_reservations_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "hour_bank_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_reservations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hour_bank_reservations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_reservations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_reservations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_reservations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_reservations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      hour_bank_visit_segments: {
        Row: {
          created_at: string
          enrollment_id: string
          entered_at: string
          entry_event_id: string | null
          exit_event_id: string | null
          exited_at: string | null
          id: string
          school_id: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          entered_at: string
          entry_event_id?: string | null
          exit_event_id?: string | null
          exited_at?: string | null
          id?: string
          school_id: string
          visit_id: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          entered_at?: string
          entry_event_id?: string | null
          exit_event_id?: string | null
          exited_at?: string | null
          id?: string
          school_id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hour_bank_visit_segments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_visit_segments_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "hour_bank_visit_segments_entry_event_id_fkey"
            columns: ["entry_event_id"]
            isOneToOne: false
            referencedRelation: "access_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_visit_segments_exit_event_id_fkey"
            columns: ["exit_event_id"]
            isOneToOne: false
            referencedRelation: "access_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_visit_segments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hour_bank_visit_segments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_visit_segments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_visit_segments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_visit_segments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_visit_segments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hour_bank_visit_segments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "hour_bank_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      hour_bank_visits: {
        Row: {
          auto_closed: boolean
          billed_minutes: number | null
          corrected_at: string | null
          corrected_by: string | null
          correction_reason: string | null
          created_at: string
          ended_at: string | null
          enrollment_id: string
          id: string
          period_id: string | null
          school_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          auto_closed?: boolean
          billed_minutes?: number | null
          corrected_at?: string | null
          corrected_by?: string | null
          correction_reason?: string | null
          created_at?: string
          ended_at?: string | null
          enrollment_id: string
          id?: string
          period_id?: string | null
          school_id: string
          started_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          auto_closed?: boolean
          billed_minutes?: number | null
          corrected_at?: string | null
          corrected_by?: string | null
          correction_reason?: string | null
          created_at?: string
          ended_at?: string | null
          enrollment_id?: string
          id?: string
          period_id?: string | null
          school_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hour_bank_visits_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "hour_bank_visits_corrected_by_fkey"
            columns: ["corrected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_visits_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_visits_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "hour_bank_visits_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "hour_bank_periods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_visits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "hour_bank_visits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_visits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_visits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_visits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hour_bank_visits_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      identity_documents: {
        Row: {
          child_id: string | null
          created_at: string
          date_of_birth: string | null
          doc_number: string | null
          doc_type: string
          expiry_date: string | null
          file_size_bytes: number | null
          file_type: string | null
          file_url: string
          full_name_on_doc: string | null
          id: string
          is_current: boolean
          mismatch_notes: string | null
          ocr_confidence: number | null
          ocr_date_of_birth: string | null
          ocr_doc_number: string | null
          ocr_doc_type: string | null
          ocr_full_name: string | null
          ocr_log_id: string | null
          ocr_processed_at: string | null
          ocr_raw_fields: Json | null
          profile_id: string | null
          rejection_reason: string | null
          school_id: string | null
          unregistered_id: string | null
          updated_at: string
          upload_channel: string
          validation_status: string
          verified_at: string | null
          verified_by: string | null
          version: number
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          doc_number?: string | null
          doc_type: string
          expiry_date?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url: string
          full_name_on_doc?: string | null
          id?: string
          is_current?: boolean
          mismatch_notes?: string | null
          ocr_confidence?: number | null
          ocr_date_of_birth?: string | null
          ocr_doc_number?: string | null
          ocr_doc_type?: string | null
          ocr_full_name?: string | null
          ocr_log_id?: string | null
          ocr_processed_at?: string | null
          ocr_raw_fields?: Json | null
          profile_id?: string | null
          rejection_reason?: string | null
          school_id?: string | null
          unregistered_id?: string | null
          updated_at?: string
          upload_channel?: string
          validation_status?: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Update: {
          child_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          doc_number?: string | null
          doc_type?: string
          expiry_date?: string | null
          file_size_bytes?: number | null
          file_type?: string | null
          file_url?: string
          full_name_on_doc?: string | null
          id?: string
          is_current?: boolean
          mismatch_notes?: string | null
          ocr_confidence?: number | null
          ocr_date_of_birth?: string | null
          ocr_doc_number?: string | null
          ocr_doc_type?: string | null
          ocr_full_name?: string | null
          ocr_log_id?: string | null
          ocr_processed_at?: string | null
          ocr_raw_fields?: Json | null
          profile_id?: string | null
          rejection_reason?: string | null
          school_id?: string | null
          unregistered_id?: string | null
          updated_at?: string
          upload_channel?: string
          validation_status?: string
          verified_at?: string | null
          verified_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "identity_documents_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_documents_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_documents_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "identity_documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "identity_documents_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "identity_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "identity_documents_unregistered_id_fkey"
            columns: ["unregistered_id"]
            isOneToOne: false
            referencedRelation: "unregistered_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "identity_documents_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_logs: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          id: string
          order_id: string | null
          product_id: string
          reason: string
          stock_after: number
          stock_before: number
          variant_id: string | null
          vendor_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          order_id?: string | null
          product_id: string
          reason: string
          stock_after: number
          stock_before: number
          variant_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          order_id?: string | null
          product_id?: string
          reason?: string
          stock_after?: number
          stock_before?: number
          variant_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "my_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          branch_id: string | null
          child_name: string | null
          created_at: string | null
          email: string | null
          expires_at: string | null
          id: string
          invited_by: string | null
          monthly_fee: number | null
          offering_plan_id: string | null
          parent_phone: string | null
          role_to_assign: string
          school_id: string | null
          status: string | null
          team_id: string | null
        }
        Insert: {
          branch_id?: string | null
          child_name?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          monthly_fee?: number | null
          offering_plan_id?: string | null
          parent_phone?: string | null
          role_to_assign: string
          school_id?: string | null
          status?: string | null
          team_id?: string | null
        }
        Update: {
          branch_id?: string | null
          child_name?: string | null
          created_at?: string | null
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          monthly_fee?: number | null
          offering_plan_id?: string | null
          parent_phone?: string | null
          role_to_assign?: string
          school_id?: string | null
          status?: string | null
          team_id?: string | null
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
            foreignKeyName: "invitations_offering_plan_id_fkey"
            columns: ["offering_plan_id"]
            isOneToOne: false
            referencedRelation: "offering_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "invitations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "invitations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      invoices: {
        Row: {
          buyer_document: string | null
          buyer_email: string | null
          buyer_name: string | null
          created_at: string | null
          currency: string | null
          id: string
          invoice_number: string | null
          invoice_type: string | null
          order_id: string | null
          pdf_url: string | null
          seller_name: string | null
          seller_nit: string | null
          subtotal: number | null
          tax_amount: number | null
          total: number | null
          vendor_profile_id: string | null
        }
        Insert: {
          buyer_document?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_number?: string | null
          invoice_type?: string | null
          order_id?: string | null
          pdf_url?: string | null
          seller_name?: string | null
          seller_nit?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total?: number | null
          vendor_profile_id?: string | null
        }
        Update: {
          buyer_document?: string | null
          buyer_email?: string | null
          buyer_name?: string | null
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_number?: string | null
          invoice_type?: string | null
          order_id?: string | null
          pdf_url?: string | null
          seller_name?: string | null
          seller_nit?: string | null
          subtotal?: number | null
          tax_amount?: number | null
          total?: number | null
          vendor_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "my_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
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
      marketplace_shipping_rates: {
        Row: {
          carrier: string | null
          created_at: string
          estimated_days: number
          id: string
          is_active: boolean
          is_free_above: number | null
          max_weight_grams: number
          min_weight_grams: number
          price: number
          shipping_zone_id: string
          vendor_profile_id: string | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          estimated_days?: number
          id?: string
          is_active?: boolean
          is_free_above?: number | null
          max_weight_grams?: number
          min_weight_grams?: number
          price: number
          shipping_zone_id: string
          vendor_profile_id?: string | null
        }
        Update: {
          carrier?: string | null
          created_at?: string
          estimated_days?: number
          id?: string
          is_active?: boolean
          is_free_above?: number | null
          max_weight_grams?: number
          min_weight_grams?: number
          price?: number
          shipping_zone_id?: string
          vendor_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_shipping_rates_shipping_zone_id_fkey"
            columns: ["shipping_zone_id"]
            isOneToOne: false
            referencedRelation: "marketplace_shipping_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_shipping_rates_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_shipping_zones: {
        Row: {
          cities: string[]
          created_at: string
          id: string
          is_default: boolean
          name: string
        }
        Insert: {
          cities?: string[]
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
        }
        Update: {
          cities?: string[]
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
        }
        Relationships: []
      }
      match_lineup_players: {
        Row: {
          created_at: string
          id: string
          jersey_number: number | null
          lineup_id: string
          minutes_played: number | null
          position_code: string | null
          role: string
          school_id: string
          slot_label: string | null
          subject_id: string
          subject_type: string
          x: number | null
          y: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          jersey_number?: number | null
          lineup_id: string
          minutes_played?: number | null
          position_code?: string | null
          role: string
          school_id: string
          slot_label?: string | null
          subject_id: string
          subject_type: string
          x?: number | null
          y?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          jersey_number?: number | null
          lineup_id?: string
          minutes_played?: number | null
          position_code?: string | null
          role?: string
          school_id?: string
          slot_label?: string | null
          subject_id?: string
          subject_type?: string
          x?: number | null
          y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "match_lineup_players_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "match_lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineup_players_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "match_lineup_players_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineup_players_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineup_players_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineup_players_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineup_players_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      match_lineups: {
        Row: {
          created_at: string
          created_by: string
          formation: string | null
          id: string
          school_id: string
          source_id: string
          source_type: string
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          formation?: string | null
          id?: string
          school_id: string
          source_id: string
          source_type: string
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          formation?: string | null
          id?: string
          school_id?: string
          source_id?: string
          source_type?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_lineups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "match_lineups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "match_lineups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "match_lineups_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
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
      memberships: {
        Row: {
          child_id: string | null
          created_at: string
          external_ref: string | null
          id: string
          notes: string | null
          school_id: string
          source: string
          status: string
          unregistered_athlete_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string | null
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          child_id?: string | null
          created_at?: string
          external_ref?: string | null
          id?: string
          notes?: string | null
          school_id: string
          source?: string
          status?: string
          unregistered_athlete_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          child_id?: string | null
          created_at?: string
          external_ref?: string | null
          id?: string
          notes?: string | null
          school_id?: string
          source?: string
          status?: string
          unregistered_athlete_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string | null
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "memberships_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "memberships_unregistered_athlete_id_fkey"
            columns: ["unregistered_athlete_id"]
            isOneToOne: false
            referencedRelation: "unregistered_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "memberships_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
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
      monthly_closes: {
        Row: {
          branch_id: string | null
          closed_at: string | null
          closed_by: string | null
          count_expected: number
          count_open: number
          count_settled: number
          created_at: string
          id: string
          opened_at: string | null
          opened_by: string | null
          period_month: number
          period_year: number
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          school_id: string
          scope: string
          status: string
          total_expected: number
          total_late_fees: number
          total_open: number
          total_settled: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          count_expected?: number
          count_open?: number
          count_settled?: number
          created_at?: string
          id?: string
          opened_at?: string | null
          opened_by?: string | null
          period_month: number
          period_year: number
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          school_id: string
          scope?: string
          status?: string
          total_expected?: number
          total_late_fees?: number
          total_open?: number
          total_settled?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          count_expected?: number
          count_open?: number
          count_settled?: number
          created_at?: string
          id?: string
          opened_at?: string | null
          opened_by?: string | null
          period_month?: number
          period_year?: number
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          school_id?: string
          scope?: string
          status?: string
          total_expected?: number
          total_late_fees?: number
          total_open?: number
          total_settled?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_closes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_closes_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "monthly_closes_closed_by_fkey"
            columns: ["closed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_closes_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "monthly_closes_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_closes_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "monthly_closes_reopened_by_fkey"
            columns: ["reopened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_closes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "monthly_closes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_closes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_closes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_closes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_closes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempts: number
          created_at: string
          id: string
          last_error: string | null
          max_attempts: number
          native_failed: number
          native_sent: number
          next_attempt_at: string
          notification_id: string
          revoked: number
          status: string
          updated_at: string
          user_id: string
          web_failed: number
          web_sent: number
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          native_failed?: number
          native_sent?: number
          next_attempt_at?: string
          notification_id: string
          revoked?: number
          status?: string
          updated_at?: string
          user_id: string
          web_failed?: number
          web_sent?: number
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          native_failed?: number
          native_sent?: number
          next_attempt_at?: string
          notification_id?: string
          revoked?: number
          status?: string
          updated_at?: string
          user_id?: string
          web_failed?: number
          web_sent?: number
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: true
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          bff_dispatch_url: string | null
          dispatch_enabled: boolean
          id: boolean
          updated_at: string
        }
        Insert: {
          bff_dispatch_url?: string | null
          dispatch_enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Update: {
          bff_dispatch_url?: string | null
          dispatch_enabled?: boolean
          id?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          category: string | null
          created_at: string
          data: Json
          id: string
          link: string | null
          message: string
          read: boolean | null
          school_id: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          data?: Json
          id?: string
          link?: string | null
          message: string
          read?: boolean | null
          school_id?: string | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          data?: Json
          id?: string
          link?: string | null
          message?: string
          read?: boolean | null
          school_id?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ocr_processing_log: {
        Row: {
          api_error: string | null
          confidence_score: number | null
          created_at: string
          extracted_amount: number | null
          extracted_bank: string | null
          extracted_birth_date: string | null
          extracted_date: string | null
          extracted_doc_number: string | null
          extracted_doc_type: string | null
          extracted_expiry_date: string | null
          extracted_full_name: string | null
          extracted_nit: string | null
          extracted_recipient: string | null
          extracted_reference: string | null
          id: string
          identity_doc_id: string | null
          installment_id: string | null
          mismatch_details: Json | null
          model_used: string | null
          processing_ms: number | null
          raw_response: Json | null
          retries: number
          school_id: string | null
          source_type: string
          source_url: string
          updated_at: string
          upload_channel: string
          validation_status: string
        }
        Insert: {
          api_error?: string | null
          confidence_score?: number | null
          created_at?: string
          extracted_amount?: number | null
          extracted_bank?: string | null
          extracted_birth_date?: string | null
          extracted_date?: string | null
          extracted_doc_number?: string | null
          extracted_doc_type?: string | null
          extracted_expiry_date?: string | null
          extracted_full_name?: string | null
          extracted_nit?: string | null
          extracted_recipient?: string | null
          extracted_reference?: string | null
          id?: string
          identity_doc_id?: string | null
          installment_id?: string | null
          mismatch_details?: Json | null
          model_used?: string | null
          processing_ms?: number | null
          raw_response?: Json | null
          retries?: number
          school_id?: string | null
          source_type?: string
          source_url: string
          updated_at?: string
          upload_channel?: string
          validation_status?: string
        }
        Update: {
          api_error?: string | null
          confidence_score?: number | null
          created_at?: string
          extracted_amount?: number | null
          extracted_bank?: string | null
          extracted_birth_date?: string | null
          extracted_date?: string | null
          extracted_doc_number?: string | null
          extracted_doc_type?: string | null
          extracted_expiry_date?: string | null
          extracted_full_name?: string | null
          extracted_nit?: string | null
          extracted_recipient?: string | null
          extracted_reference?: string | null
          id?: string
          identity_doc_id?: string | null
          installment_id?: string | null
          mismatch_details?: Json | null
          model_used?: string | null
          processing_ms?: number | null
          raw_response?: Json | null
          retries?: number
          school_id?: string | null
          source_type?: string
          source_url?: string
          updated_at?: string
          upload_channel?: string
          validation_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ocr_processing_log_identity_doc_id_fkey"
            columns: ["identity_doc_id"]
            isOneToOne: false
            referencedRelation: "identity_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_processing_log_identity_doc_id_fkey"
            columns: ["identity_doc_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["doc_id"]
          },
          {
            foreignKeyName: "ocr_processing_log_installment_id_fkey"
            columns: ["installment_id"]
            isOneToOne: false
            referencedRelation: "payment_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_processing_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "ocr_processing_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_processing_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_processing_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_processing_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ocr_processing_log_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "offering_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_coach_team_plans"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "offering_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_school_staff_publico"
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "offering_coaches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      offering_plans: {
        Row: {
          auto_renew: boolean
          created_at: string
          currency: string
          current_students: number | null
          description: string | null
          duration_days: number
          id: string
          included_minutes_per_period: number | null
          included_sessions_per_week: number | null
          is_active: boolean
          max_secondary_sessions: number | null
          max_sessions: number | null
          max_students: number | null
          metadata: Json
          name: string
          offering_id: string
          price: number
          registration_fee: number | null
          school_id: string
          session_block_minutes: number | null
          slot_duration_minutes: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          created_at?: string
          currency?: string
          current_students?: number | null
          description?: string | null
          duration_days?: number
          id?: string
          included_minutes_per_period?: number | null
          included_sessions_per_week?: number | null
          is_active?: boolean
          max_secondary_sessions?: number | null
          max_sessions?: number | null
          max_students?: number | null
          metadata?: Json
          name: string
          offering_id: string
          price: number
          registration_fee?: number | null
          school_id: string
          session_block_minutes?: number | null
          slot_duration_minutes?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          created_at?: string
          currency?: string
          current_students?: number | null
          description?: string | null
          duration_days?: number
          id?: string
          included_minutes_per_period?: number | null
          included_sessions_per_week?: number | null
          is_active?: boolean
          max_secondary_sessions?: number | null
          max_sessions?: number | null
          max_students?: number | null
          metadata?: Json
          name?: string
          offering_id?: string
          price?: number
          registration_fee?: number | null
          school_id?: string
          session_block_minutes?: number | null
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "offering_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      offerings: {
        Row: {
          branch_id: string | null
          created_at: string
          current_students: number | null
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
          current_students?: number | null
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
          current_students?: number | null
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "offerings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string | null
          platform_fee: number
          product_id: string | null
          quantity: number | null
          subtotal: number | null
          tax_amount: number | null
          unit_price: number | null
          variant_id: string | null
          vendor_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          platform_fee?: number
          product_id?: string | null
          quantity?: number | null
          subtotal?: number | null
          tax_amount?: number | null
          unit_price?: number | null
          variant_id?: string | null
          vendor_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          platform_fee?: number
          product_id?: string | null
          quantity?: number | null
          subtotal?: number | null
          tax_amount?: number | null
          unit_price?: number | null
          variant_id?: string | null
          vendor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "my_orders_view"
            referencedColumns: ["id"]
          },
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
          carrier: string | null
          cash_session_id: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          customer_document: string | null
          customer_name: string | null
          fulfillment_type: Database["public"]["Enums"]["fulfillment_type"]
          id: string
          last_failure_at: string | null
          last_failure_reason: string | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          platform_fee: number
          provider_reference: string | null
          provider_transaction_id: string | null
          requires_review: boolean
          shipping_address: Json | null
          shipping_carrier: string | null
          shipping_cost: number | null
          status: string | null
          tax_total: number | null
          total_amount: number
          tracking_number: string | null
          unblocked_at: string | null
          unblocked_by: string | null
          updated_at: string
          user_id: string | null
          vendor_id: string | null
          vendor_notes: string | null
          wompi_reference: string | null
          wompi_transaction_id: string | null
        }
        Insert: {
          carrier?: string | null
          cash_session_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_document?: string | null
          customer_name?: string | null
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          last_failure_at?: string | null
          last_failure_reason?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          platform_fee?: number
          provider_reference?: string | null
          provider_transaction_id?: string | null
          requires_review?: boolean
          shipping_address?: Json | null
          shipping_carrier?: string | null
          shipping_cost?: number | null
          status?: string | null
          tax_total?: number | null
          total_amount: number
          tracking_number?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
          updated_at?: string
          user_id?: string | null
          vendor_id?: string | null
          vendor_notes?: string | null
          wompi_reference?: string | null
          wompi_transaction_id?: string | null
        }
        Update: {
          carrier?: string | null
          cash_session_id?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_document?: string | null
          customer_name?: string | null
          fulfillment_type?: Database["public"]["Enums"]["fulfillment_type"]
          id?: string
          last_failure_at?: string | null
          last_failure_reason?: string | null
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          platform_fee?: number
          provider_reference?: string | null
          provider_transaction_id?: string | null
          requires_review?: boolean
          shipping_address?: Json | null
          shipping_carrier?: string | null
          shipping_cost?: number | null
          status?: string | null
          tax_total?: number | null
          total_amount?: number
          tracking_number?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
          updated_at?: string
          user_id?: string | null
          vendor_id?: string | null
          vendor_notes?: string | null
          wompi_reference?: string | null
          wompi_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_anomalies: {
        Row: {
          dedup_key: string
          details: Json
          detected_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          kind: string
          reference: string | null
          resolved_at: string | null
          severity: string
          status: string
        }
        Insert: {
          dedup_key: string
          details?: Json
          detected_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind: string
          reference?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
        }
        Update: {
          dedup_key?: string
          details?: Json
          detected_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          kind?: string
          reference?: string | null
          resolved_at?: string | null
          severity?: string
          status?: string
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
            foreignKeyName: "payment_audit_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["active_payment_id"]
          },
          {
            foreignKeyName: "payment_audit_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_abonos_summary"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_audit_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_contacts"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "payment_audit_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      payment_consents: {
        Row: {
          acceptance_permalink: string | null
          acceptance_token: string
          accepted_at: string
          created_at: string
          id: string
          ip_address: unknown
          metadata: Json
          payment_provider: Database["public"]["Enums"]["payment_provider"]
          payment_token_id: string | null
          personal_data_auth_token: string
          personal_data_permalink: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          acceptance_permalink?: string | null
          acceptance_token: string
          accepted_at?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          payment_provider: Database["public"]["Enums"]["payment_provider"]
          payment_token_id?: string | null
          personal_data_auth_token: string
          personal_data_permalink?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          acceptance_permalink?: string | null
          acceptance_token?: string
          accepted_at?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          metadata?: Json
          payment_provider?: Database["public"]["Enums"]["payment_provider"]
          payment_token_id?: string | null
          personal_data_auth_token?: string
          personal_data_permalink?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_consents_payment_token_id_fkey"
            columns: ["payment_token_id"]
            isOneToOne: false
            referencedRelation: "payment_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_glosas: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          payment_id: string
          reason: string
          reason_detail: Json | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          responded_at: string | null
          responds_by: string
          response_files: Json | null
          response_text: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          payment_id: string
          reason: string
          reason_detail?: Json | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          responded_at?: string | null
          responds_by: string
          response_files?: Json | null
          response_text?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          payment_id?: string
          reason?: string
          reason_detail?: Json | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          responded_at?: string | null
          responds_by?: string
          response_files?: Json | null
          response_text?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_glosas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payment_glosas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_glosas_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_glosas_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments_with_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_glosas_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_glosas_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["active_payment_id"]
          },
          {
            foreignKeyName: "payment_glosas_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_abonos_summary"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_glosas_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_contacts"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_glosas_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payment_glosas_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_glosas_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "payment_glosas_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_glosas_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_glosas_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_glosas_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_glosas_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
          ocr_auto_approved: boolean | null
          ocr_confidence: number | null
          ocr_log_id: string | null
          ocr_model: string | null
          ocr_processed_at: string | null
          ocr_raw_fields: Json | null
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
          upload_channel: string | null
        }
        Insert: {
          amount: number
          athlete_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          ocr_auto_approved?: boolean | null
          ocr_confidence?: number | null
          ocr_log_id?: string | null
          ocr_model?: string | null
          ocr_processed_at?: string | null
          ocr_raw_fields?: Json | null
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
          upload_channel?: string | null
        }
        Update: {
          amount?: number
          athlete_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          ocr_auto_approved?: boolean | null
          ocr_confidence?: number | null
          ocr_log_id?: string | null
          ocr_model?: string | null
          ocr_processed_at?: string | null
          ocr_raw_fields?: Json | null
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
          upload_channel?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_installments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payment_installments_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_ocr_log_id_fkey"
            columns: ["ocr_log_id"]
            isOneToOne: false
            referencedRelation: "ocr_processing_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_installments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
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
            foreignKeyName: "payment_installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["active_payment_id"]
          },
          {
            foreignKeyName: "payment_installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_abonos_summary"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_installments_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_contacts"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_installments_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "payment_installments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      payment_links: {
        Row: {
          base_amount: number
          created_at: string | null
          enrollment_id: string | null
          expires_at: string
          failed_attempts: number | null
          fee_pct: number
          gross_amount: number
          id: string
          paid_at: string | null
          payment_id: string
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          provider_reference: string | null
          school_id: string
          sportmaps_fee: number
          status: string
          token: string
          updated_at: string | null
          wompi_reference: string | null
        }
        Insert: {
          base_amount: number
          created_at?: string | null
          enrollment_id?: string | null
          expires_at: string
          failed_attempts?: number | null
          fee_pct?: number
          gross_amount: number
          id?: string
          paid_at?: string | null
          payment_id: string
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          provider_reference?: string | null
          school_id: string
          sportmaps_fee?: number
          status?: string
          token: string
          updated_at?: string | null
          wompi_reference?: string | null
        }
        Update: {
          base_amount?: number
          created_at?: string | null
          enrollment_id?: string | null
          expires_at?: string
          failed_attempts?: number | null
          fee_pct?: number
          gross_amount?: number
          id?: string
          paid_at?: string | null
          payment_id?: string
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          provider_reference?: string | null
          school_id?: string
          sportmaps_fee?: number
          status?: string
          token?: string
          updated_at?: string | null
          wompi_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments_with_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["active_payment_id"]
          },
          {
            foreignKeyName: "payment_links_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_abonos_summary"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_links_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_contacts"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "payment_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      payment_message_templates: {
        Row: {
          body: string
          channel: string
          created_at: string | null
          days_offset: number | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          school_id: string | null
          sort_order: number | null
          subject: string | null
          template_type: string
          updated_at: string | null
        }
        Insert: {
          body: string
          channel: string
          created_at?: string | null
          days_offset?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          school_id?: string | null
          sort_order?: number | null
          subject?: string | null
          template_type: string
          updated_at?: string | null
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string | null
          days_offset?: number | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          school_id?: string | null
          sort_order?: number | null
          subject?: string | null
          template_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_message_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "payment_message_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_message_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_message_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_message_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_message_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      payment_provider_secrets: {
        Row: {
          access_token_enc: string | null
          events_secret_enc: string | null
          integrity_secret_enc: string | null
          private_key_enc: string | null
          provider_id: string
          refresh_token_enc: string | null
          token_expires_at: string | null
          updated_at: string
        }
        Insert: {
          access_token_enc?: string | null
          events_secret_enc?: string | null
          integrity_secret_enc?: string | null
          private_key_enc?: string | null
          provider_id: string
          refresh_token_enc?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Update: {
          access_token_enc?: string | null
          events_secret_enc?: string | null
          integrity_secret_enc?: string | null
          private_key_enc?: string | null
          provider_id?: string
          refresh_token_enc?: string | null
          token_expires_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_provider_secrets_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "school_payment_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_reminder_logs: {
        Row: {
          amount: number | null
          channel: string
          child_id: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          error_message: string | null
          id: string
          payment_id: string | null
          school_id: string
          sent_at: string
          sent_by: string | null
          status: string
          unregistered_athlete_id: string | null
          user_id: string | null
        }
        Insert: {
          amount?: number | null
          channel: string
          child_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          error_message?: string | null
          id?: string
          payment_id?: string | null
          school_id: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          unregistered_athlete_id?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number | null
          channel?: string
          child_id?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          error_message?: string | null
          id?: string
          payment_id?: string | null
          school_id?: string
          sent_at?: string
          sent_by?: string | null
          status?: string
          unregistered_athlete_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_reminder_logs_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments_with_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["active_payment_id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_abonos_summary"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_contacts"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_unregistered_athlete_id_fkey"
            columns: ["unregistered_athlete_id"]
            isOneToOne: false
            referencedRelation: "unregistered_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payment_reminder_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          {
            foreignKeyName: "payment_reminders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["active_payment_id"]
          },
          {
            foreignKeyName: "payment_reminders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_abonos_summary"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_reminders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_contacts"
            referencedColumns: ["payment_id"]
          },
        ]
      }
      payment_splits: {
        Row: {
          created_at: string | null
          gross_amount: number
          id: string
          payment_id: string
          payment_link_id: string | null
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          provider_fee: number | null
          provider_reference: string | null
          provider_transaction_id: string | null
          raw_webhook: Json | null
          school_receives: number
          sportmaps_receives: number
          transfer_method: string | null
          transfer_reference: string | null
          transfer_status: string
          transferred_at: string | null
          transferred_by: string | null
          webhook_signature_valid: boolean | null
          wompi_fee: number | null
          wompi_reference: string
          wompi_transaction_id: string | null
        }
        Insert: {
          created_at?: string | null
          gross_amount: number
          id?: string
          payment_id: string
          payment_link_id?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          provider_fee?: number | null
          provider_reference?: string | null
          provider_transaction_id?: string | null
          raw_webhook?: Json | null
          school_receives: number
          sportmaps_receives?: number
          transfer_method?: string | null
          transfer_reference?: string | null
          transfer_status?: string
          transferred_at?: string | null
          transferred_by?: string | null
          webhook_signature_valid?: boolean | null
          wompi_fee?: number | null
          wompi_reference: string
          wompi_transaction_id?: string | null
        }
        Update: {
          created_at?: string | null
          gross_amount?: number
          id?: string
          payment_id?: string
          payment_link_id?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          provider_fee?: number | null
          provider_reference?: string | null
          provider_transaction_id?: string | null
          raw_webhook?: Json | null
          school_receives?: number
          sportmaps_receives?: number
          transfer_method?: string | null
          transfer_reference?: string | null
          transfer_status?: string
          transferred_at?: string | null
          transferred_by?: string | null
          webhook_signature_valid?: boolean | null
          wompi_fee?: number | null
          wompi_reference?: string
          wompi_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_splits_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_splits_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments_with_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_splits_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_splits_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["active_payment_id"]
          },
          {
            foreignKeyName: "payment_splits_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_abonos_summary"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_splits_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_contacts"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_splits_payment_link_id_fkey"
            columns: ["payment_link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_tokens: {
        Row: {
          brand: string | null
          created_at: string
          expires_at: string | null
          holder_name: string | null
          id: string
          is_active: boolean
          is_default: boolean
          last_four: string | null
          payment_method_type: string
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          provider_card_id: string | null
          provider_customer_id: string | null
          provider_payment_source_id: number | null
          provider_token: string | null
          updated_at: string
          user_id: string
          wompi_token: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string
          expires_at?: string | null
          holder_name?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          last_four?: string | null
          payment_method_type: string
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          provider_card_id?: string | null
          provider_customer_id?: string | null
          provider_payment_source_id?: number | null
          provider_token?: string | null
          updated_at?: string
          user_id: string
          wompi_token?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string
          expires_at?: string | null
          holder_name?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          last_four?: string | null
          payment_method_type?: string
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          provider_card_id?: string | null
          provider_customer_id?: string | null
          provider_payment_source_id?: number | null
          provider_token?: string | null
          updated_at?: string
          user_id?: string
          wompi_token?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          amount_paid: number | null
          approved_at: string | null
          approved_by: string | null
          branch_id: string | null
          cash_session_id: string | null
          child_id: string | null
          coach_id: string | null
          concept: string
          created_at: string
          due_date: string
          early_payment_discount_applied: number | null
          epayco_fee: number | null
          gross_amount: number | null
          id: string
          last_failure_at: string | null
          last_failure_reason: string | null
          last_reminder_sent: string | null
          late_fee_amount: number
          late_fee_applied_at: string | null
          ocr_amount: number | null
          ocr_bank: string | null
          ocr_currency: string | null
          ocr_date: string | null
          ocr_destination: string | null
          ocr_destination_name: string | null
          ocr_origin_name: string | null
          ocr_provider: string | null
          ocr_raw_response: Json | null
          ocr_reference: string | null
          ocr_time: string | null
          offering_plan_id: string | null
          parent_id: string | null
          payment_category: string | null
          payment_channel: string | null
          payment_date: string | null
          payment_method: string | null
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_type: string | null
          period_month: number | null
          period_uniqueness_exempt: boolean
          period_year: number | null
          provider_reference: string | null
          provider_transaction_id: string | null
          qr_id: string | null
          receipt_image_sha256: string | null
          receipt_image_sha256_source: string | null
          receipt_number: string | null
          receipt_reference_norm: string | null
          receipt_storage_bucket: string | null
          receipt_url: string | null
          receipt_verdict: string | null
          receipt_verdict_at: string | null
          receipt_verdict_reasons: Json | null
          reconciliation_status: string | null
          reference: string | null
          rejection_reason: string | null
          reminder_sent_at: string | null
          requires_review: boolean
          school_id: string | null
          sportmaps_fee: number | null
          status: string
          subscription_end_date: string | null
          subscription_start_date: string | null
          team_id: string | null
          unblocked_at: string | null
          unblocked_by: string | null
          unregistered_athlete_id: string | null
          updated_at: string
          user_id: string | null
          wompi_id: string | null
          wompi_reference: string | null
          wompi_transaction_id: string | null
        }
        Insert: {
          amount: number
          amount_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          cash_session_id?: string | null
          child_id?: string | null
          coach_id?: string | null
          concept: string
          created_at?: string
          due_date: string
          early_payment_discount_applied?: number | null
          epayco_fee?: number | null
          gross_amount?: number | null
          id?: string
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_reminder_sent?: string | null
          late_fee_amount?: number
          late_fee_applied_at?: string | null
          ocr_amount?: number | null
          ocr_bank?: string | null
          ocr_currency?: string | null
          ocr_date?: string | null
          ocr_destination?: string | null
          ocr_destination_name?: string | null
          ocr_origin_name?: string | null
          ocr_provider?: string | null
          ocr_raw_response?: Json | null
          ocr_reference?: string | null
          ocr_time?: string | null
          offering_plan_id?: string | null
          parent_id?: string | null
          payment_category?: string | null
          payment_channel?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_type?: string | null
          period_month?: number | null
          period_uniqueness_exempt?: boolean
          period_year?: number | null
          provider_reference?: string | null
          provider_transaction_id?: string | null
          qr_id?: string | null
          receipt_image_sha256?: string | null
          receipt_image_sha256_source?: string | null
          receipt_number?: string | null
          receipt_reference_norm?: string | null
          receipt_storage_bucket?: string | null
          receipt_url?: string | null
          receipt_verdict?: string | null
          receipt_verdict_at?: string | null
          receipt_verdict_reasons?: Json | null
          reconciliation_status?: string | null
          reference?: string | null
          rejection_reason?: string | null
          reminder_sent_at?: string | null
          requires_review?: boolean
          school_id?: string | null
          sportmaps_fee?: number | null
          status: string
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          team_id?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string
          user_id?: string | null
          wompi_id?: string | null
          wompi_reference?: string | null
          wompi_transaction_id?: string | null
        }
        Update: {
          amount?: number
          amount_paid?: number | null
          approved_at?: string | null
          approved_by?: string | null
          branch_id?: string | null
          cash_session_id?: string | null
          child_id?: string | null
          coach_id?: string | null
          concept?: string
          created_at?: string
          due_date?: string
          early_payment_discount_applied?: number | null
          epayco_fee?: number | null
          gross_amount?: number | null
          id?: string
          last_failure_at?: string | null
          last_failure_reason?: string | null
          last_reminder_sent?: string | null
          late_fee_amount?: number
          late_fee_applied_at?: string | null
          ocr_amount?: number | null
          ocr_bank?: string | null
          ocr_currency?: string | null
          ocr_date?: string | null
          ocr_destination?: string | null
          ocr_destination_name?: string | null
          ocr_origin_name?: string | null
          ocr_provider?: string | null
          ocr_raw_response?: Json | null
          ocr_reference?: string | null
          ocr_time?: string | null
          offering_plan_id?: string | null
          parent_id?: string | null
          payment_category?: string | null
          payment_channel?: string | null
          payment_date?: string | null
          payment_method?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_type?: string | null
          period_month?: number | null
          period_uniqueness_exempt?: boolean
          period_year?: number | null
          provider_reference?: string | null
          provider_transaction_id?: string | null
          qr_id?: string | null
          receipt_image_sha256?: string | null
          receipt_image_sha256_source?: string | null
          receipt_number?: string | null
          receipt_reference_norm?: string | null
          receipt_storage_bucket?: string | null
          receipt_url?: string | null
          receipt_verdict?: string | null
          receipt_verdict_at?: string | null
          receipt_verdict_reasons?: Json | null
          reconciliation_status?: string | null
          reference?: string | null
          rejection_reason?: string | null
          reminder_sent_at?: string | null
          requires_review?: boolean
          school_id?: string | null
          sportmaps_fee?: number | null
          status?: string
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          team_id?: string | null
          unblocked_at?: string | null
          unblocked_by?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string
          user_id?: string | null
          wompi_id?: string | null
          wompi_reference?: string | null
          wompi_transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
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
            foreignKeyName: "payments_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
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
            foreignKeyName: "payments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "payments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_offering_plan_id_fkey"
            columns: ["offering_plan_id"]
            isOneToOne: false
            referencedRelation: "offering_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_qr_id_fkey"
            columns: ["qr_id"]
            isOneToOne: false
            referencedRelation: "school_join_qr_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_config: {
        Row: {
          arl_rates: Json
          caja_pct: number
          cesantias_pct: number
          created_at: string
          emp_health_pct: number
          emp_pension_pct: number
          exoneration_enabled: boolean
          exoneration_threshold_smmlv: number
          fsp_pct: number
          fsp_threshold_smmlv: number
          health_pct: number
          icbf_pct: number
          intereses_cesantias_pct: number
          notes: string | null
          pension_pct: number
          prima_pct: number
          sena_pct: number
          smmlv: number
          transport_aid: number
          transport_aid_threshold_smmlv: number
          updated_at: string
          uvt: number | null
          vacaciones_pct: number
          year: number
        }
        Insert: {
          arl_rates?: Json
          caja_pct?: number
          cesantias_pct?: number
          created_at?: string
          emp_health_pct?: number
          emp_pension_pct?: number
          exoneration_enabled?: boolean
          exoneration_threshold_smmlv?: number
          fsp_pct?: number
          fsp_threshold_smmlv?: number
          health_pct?: number
          icbf_pct?: number
          intereses_cesantias_pct?: number
          notes?: string | null
          pension_pct?: number
          prima_pct?: number
          sena_pct?: number
          smmlv: number
          transport_aid: number
          transport_aid_threshold_smmlv?: number
          updated_at?: string
          uvt?: number | null
          vacaciones_pct?: number
          year: number
        }
        Update: {
          arl_rates?: Json
          caja_pct?: number
          cesantias_pct?: number
          created_at?: string
          emp_health_pct?: number
          emp_pension_pct?: number
          exoneration_enabled?: boolean
          exoneration_threshold_smmlv?: number
          fsp_pct?: number
          fsp_threshold_smmlv?: number
          health_pct?: number
          icbf_pct?: number
          intereses_cesantias_pct?: number
          notes?: string | null
          pension_pct?: number
          prima_pct?: number
          sena_pct?: number
          smmlv?: number
          transport_aid?: number
          transport_aid_threshold_smmlv?: number
          updated_at?: string
          uvt?: number | null
          vacaciones_pct?: number
          year?: number
        }
        Relationships: []
      }
      payroll_employees: {
        Row: {
          active: boolean
          afp: string | null
          arl_class: number | null
          base_salary: number
          contract_type: Database["public"]["Enums"]["contract_type"]
          created_at: string
          document_id: string
          end_date: string | null
          eps: string | null
          full_name: string
          hire_date: string | null
          id: string
          owner_id: string
          owner_type: string
          profile_id: string | null
          staff_id: string | null
          transport_aid_eligible: boolean
          updated_at: string
        }
        Insert: {
          active?: boolean
          afp?: string | null
          arl_class?: number | null
          base_salary: number
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          document_id: string
          end_date?: string | null
          eps?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          owner_id: string
          owner_type: string
          profile_id?: string | null
          staff_id?: string | null
          transport_aid_eligible?: boolean
          updated_at?: string
        }
        Update: {
          active?: boolean
          afp?: string | null
          arl_class?: number | null
          base_salary?: number
          contract_type?: Database["public"]["Enums"]["contract_type"]
          created_at?: string
          document_id?: string
          end_date?: string | null
          eps?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          owner_id?: string
          owner_type?: string
          profile_id?: string | null
          staff_id?: string | null
          transport_aid_eligible?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_employees_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "public_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_employees_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "school_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_employees_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "v_coach_team_plans"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "payroll_employees_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "v_school_staff_publico"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_items: {
        Row: {
          arl_er: number
          base_salary: number
          caja_er: number
          cesantias: number
          created_at: string
          employee_id: string
          employee_name: string
          exonerated: boolean
          fsp_emp: number
          health_emp: number
          health_er: number
          ibc: number
          icbf_er: number
          id: string
          intereses_cesantias: number
          net_pay: number
          pension_emp: number
          pension_er: number
          prima: number
          run_id: string
          sena_er: number
          total_deductions: number
          total_employer: number
          total_provisions: number
          transport_aid: number
          vacaciones: number
        }
        Insert: {
          arl_er?: number
          base_salary: number
          caja_er?: number
          cesantias?: number
          created_at?: string
          employee_id: string
          employee_name: string
          exonerated?: boolean
          fsp_emp?: number
          health_emp?: number
          health_er?: number
          ibc: number
          icbf_er?: number
          id?: string
          intereses_cesantias?: number
          net_pay?: number
          pension_emp?: number
          pension_er?: number
          prima?: number
          run_id: string
          sena_er?: number
          total_deductions?: number
          total_employer?: number
          total_provisions?: number
          transport_aid?: number
          vacaciones?: number
        }
        Update: {
          arl_er?: number
          base_salary?: number
          caja_er?: number
          cesantias?: number
          created_at?: string
          employee_id?: string
          employee_name?: string
          exonerated?: boolean
          fsp_emp?: number
          health_emp?: number
          health_er?: number
          ibc?: number
          icbf_er?: number
          id?: string
          intereses_cesantias?: number
          net_pay?: number
          pension_emp?: number
          pension_er?: number
          prima?: number
          run_id?: string
          sena_er?: number
          total_deductions?: number
          total_employer?: number
          total_provisions?: number
          transport_aid?: number
          vacaciones?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_items_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "payroll_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_items_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "payroll_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_runs: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          employee_count: number
          expense_id: string | null
          id: string
          owner_id: string
          owner_type: string
          paid_at: string | null
          period_month: number
          period_year: number
          status: Database["public"]["Enums"]["payroll_run_status"]
          total_deductions: number
          total_employer: number
          total_gross: number
          total_net: number
          total_provisions: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          employee_count?: number
          expense_id?: string | null
          id?: string
          owner_id: string
          owner_type: string
          paid_at?: string | null
          period_month: number
          period_year: number
          status?: Database["public"]["Enums"]["payroll_run_status"]
          total_deductions?: number
          total_employer?: number
          total_gross?: number
          total_net?: number
          total_provisions?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          employee_count?: number
          expense_id?: string | null
          id?: string
          owner_id?: string
          owner_type?: string
          paid_at?: string | null
          period_month?: number
          period_year?: number
          status?: Database["public"]["Enums"]["payroll_run_status"]
          total_deductions?: number
          total_employer?: number
          total_gross?: number
          total_net?: number
          total_provisions?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_runs_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_card_saves: {
        Row: {
          acceptance_permalink: string | null
          acceptance_token: string
          accepted_at: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          ip_address: unknown
          payment_provider: Database["public"]["Enums"]["payment_provider"]
          personal_data_auth_token: string
          personal_data_permalink: string | null
          reference: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          acceptance_permalink?: string | null
          acceptance_token: string
          accepted_at?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          payment_provider: Database["public"]["Enums"]["payment_provider"]
          personal_data_auth_token: string
          personal_data_permalink?: string | null
          reference: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          acceptance_permalink?: string | null
          acceptance_token?: string
          accepted_at?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: unknown
          payment_provider?: Database["public"]["Enums"]["payment_provider"]
          personal_data_auth_token?: string
          personal_data_permalink?: string | null
          reference?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      performance_entries: {
        Row: {
          context_id: string | null
          context_type: string
          created_at: string
          id: string
          metric_key: string
          notes: string | null
          recorded_at: string
          recorded_by: string
          school_id: string
          subject_id: string
          subject_type: string
          value: number
        }
        Insert: {
          context_id?: string | null
          context_type?: string
          created_at?: string
          id?: string
          metric_key: string
          notes?: string | null
          recorded_at?: string
          recorded_by: string
          school_id: string
          subject_id: string
          subject_type: string
          value: number
        }
        Update: {
          context_id?: string | null
          context_type?: string
          created_at?: string
          id?: string
          metric_key?: string
          notes?: string | null
          recorded_at?: string
          recorded_by?: string
          school_id?: string
          subject_id?: string
          subject_type?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "performance_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      plan_upgrade_requests: {
        Row: {
          contact_method: string | null
          created_at: string
          current_plan_code: string | null
          current_status: string | null
          id: string
          metadata: Json
          processed_amount_cents: number | null
          processed_at: string | null
          processed_by: string | null
          processed_notes: string | null
          request_type: string
          requested_addon_key: string | null
          requested_billing_cycle: string | null
          requested_by: string | null
          requested_plan_code: string | null
          school_id: string
          source: string
          source_url: string | null
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          contact_method?: string | null
          created_at?: string
          current_plan_code?: string | null
          current_status?: string | null
          id?: string
          metadata?: Json
          processed_amount_cents?: number | null
          processed_at?: string | null
          processed_by?: string | null
          processed_notes?: string | null
          request_type: string
          requested_addon_key?: string | null
          requested_billing_cycle?: string | null
          requested_by?: string | null
          requested_plan_code?: string | null
          school_id: string
          source?: string
          source_url?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          contact_method?: string | null
          created_at?: string
          current_plan_code?: string | null
          current_status?: string | null
          id?: string
          metadata?: Json
          processed_amount_cents?: number | null
          processed_at?: string | null
          processed_by?: string | null
          processed_notes?: string | null
          request_type?: string
          requested_addon_key?: string | null
          requested_billing_cycle?: string | null
          requested_by?: string | null
          requested_plan_code?: string | null
          school_id?: string
          source?: string
          source_url?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_upgrade_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "plan_upgrade_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_upgrade_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_upgrade_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_upgrade_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_upgrade_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "platform_admins_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_config: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      product_brand_categories: {
        Row: {
          brand_id: string
          category_id: string
          created_at: string
        }
        Insert: {
          brand_id: string
          category_id: string
          created_at?: string
        }
        Update: {
          brand_id?: string
          category_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_brand_categories_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "product_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_brand_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_brands: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_official: boolean
          logo_url: string | null
          name: string
          slug: string
          website_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_official?: boolean
          logo_url?: string | null
          name: string
          slug: string
          website_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_official?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          website_url?: string | null
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          attribute_schema: Json
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
          sport: string | null
          updated_at: string
        }
        Insert: {
          attribute_schema?: Json
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
          sport?: string | null
          updated_at?: string
        }
        Update: {
          attribute_schema?: Json
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
          sport?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string
          id: string
          image_url: string
          is_primary: boolean
          product_id: string
          sort_order: number
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url: string
          is_primary?: boolean
          product_id: string
          sort_order?: number
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          id?: string
          image_url?: string
          is_primary?: boolean
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_questions: {
        Row: {
          created_at: string
          helpful_count: number
          id: string
          product_id: string
          question: string
          status: string
          updated_at: string
          user_id: string
          vendor_answer: string | null
          vendor_answered_at: string | null
          vendor_answered_by: string | null
        }
        Insert: {
          created_at?: string
          helpful_count?: number
          id?: string
          product_id: string
          question: string
          status?: string
          updated_at?: string
          user_id: string
          vendor_answer?: string | null
          vendor_answered_at?: string | null
          vendor_answered_by?: string | null
        }
        Update: {
          created_at?: string
          helpful_count?: number
          id?: string
          product_id?: string
          question?: string
          status?: string
          updated_at?: string
          user_id?: string
          vendor_answer?: string | null
          vendor_answered_at?: string | null
          vendor_answered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_questions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_review_media: {
        Row: {
          created_at: string
          id: string
          review_id: string
          sort_order: number
          thumbnail_url: string | null
          type: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          sort_order?: number
          thumbnail_url?: string | null
          type: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          sort_order?: number
          thumbnail_url?: string | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_review_media_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "product_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      product_review_votes: {
        Row: {
          created_at: string
          review_id: string
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string
          review_id: string
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string
          review_id?: string
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_review_votes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "product_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      product_reviews: {
        Row: {
          body: string
          created_at: string
          fit_feedback: string | null
          flags_count: number
          helpful_count: number
          id: string
          is_verified_purchase: boolean
          level: string | null
          order_id: string | null
          product_id: string
          rating: number
          recommended: boolean | null
          sport_used_for: string | null
          status: string
          title: string | null
          unhelpful_count: number
          updated_at: string
          usage_duration: string | null
          user_id: string
          variant_id: string | null
          vendor_responded_at: string | null
          vendor_responded_by: string | null
          vendor_response: string | null
        }
        Insert: {
          body: string
          created_at?: string
          fit_feedback?: string | null
          flags_count?: number
          helpful_count?: number
          id?: string
          is_verified_purchase?: boolean
          level?: string | null
          order_id?: string | null
          product_id: string
          rating: number
          recommended?: boolean | null
          sport_used_for?: string | null
          status?: string
          title?: string | null
          unhelpful_count?: number
          updated_at?: string
          usage_duration?: string | null
          user_id: string
          variant_id?: string | null
          vendor_responded_at?: string | null
          vendor_responded_by?: string | null
          vendor_response?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          fit_feedback?: string | null
          flags_count?: number
          helpful_count?: number
          id?: string
          is_verified_purchase?: boolean
          level?: string | null
          order_id?: string | null
          product_id?: string
          rating?: number
          recommended?: boolean | null
          sport_used_for?: string | null
          status?: string
          title?: string | null
          unhelpful_count?: number
          updated_at?: string
          usage_duration?: string | null
          user_id?: string
          variant_id?: string | null
          vendor_responded_at?: string | null
          vendor_responded_by?: string | null
          vendor_response?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "my_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_reviews_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          attributes: Json
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          name: string
          price_override: number | null
          product_id: string
          sku: string | null
          sort_order: number
          stock: number
          updated_at: string
        }
        Insert: {
          attributes?: Json
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name: string
          price_override?: number | null
          product_id: string
          sku?: string | null
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Update: {
          attributes?: Json
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          name?: string
          price_override?: number | null
          product_id?: string
          sku?: string | null
          sort_order?: number
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          attributes: Json
          avg_rating: number | null
          brand_id: string | null
          category: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_digital: boolean
          min_stock_alert: number
          name: string
          price: number
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviews_count: number
          school_id: string | null
          sku: string | null
          status: string
          stock: number
          tax_rate: number
          updated_at: string | null
          vendor_id: string | null
          vendor_profile_id: string | null
          visibility: Database["public"]["Enums"]["product_visibility"]
          weight_grams: number | null
        }
        Insert: {
          active?: boolean | null
          attributes?: Json
          avg_rating?: number | null
          brand_id?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_digital?: boolean
          min_stock_alert?: number
          name: string
          price?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviews_count?: number
          school_id?: string | null
          sku?: string | null
          status?: string
          stock?: number
          tax_rate?: number
          updated_at?: string | null
          vendor_id?: string | null
          vendor_profile_id?: string | null
          visibility?: Database["public"]["Enums"]["product_visibility"]
          weight_grams?: number | null
        }
        Update: {
          active?: boolean | null
          attributes?: Json
          avg_rating?: number | null
          brand_id?: string | null
          category?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_digital?: boolean
          min_stock_alert?: number
          name?: string
          price?: number
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviews_count?: number
          school_id?: string | null
          sku?: string | null
          status?: string
          stock?: number
          tax_rate?: number
          updated_at?: string | null
          vendor_id?: string | null
          vendor_profile_id?: string | null
          visibility?: Database["public"]["Enums"]["product_visibility"]
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "product_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
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
          {
            foreignKeyName: "products_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "products_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
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
          needs_role_selection: boolean
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
          needs_role_selection?: boolean
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
          needs_role_selection?: boolean
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
      public_booking_verifications: {
        Row: {
          attempts: number
          booking_token: string | null
          booking_token_used_at: string | null
          created_at: string
          expires_at: string
          full_name: string | null
          id: string
          otp_hash: string
          phone: string | null
          resolved_child_id: string | null
          resolved_email: string | null
          resolved_enrollment_id: string | null
          resolved_kind: string
          resolved_unregistered_id: string | null
          resolved_user_id: string | null
          school_id: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          booking_token?: string | null
          booking_token_used_at?: string | null
          created_at?: string
          expires_at: string
          full_name?: string | null
          id?: string
          otp_hash: string
          phone?: string | null
          resolved_child_id?: string | null
          resolved_email?: string | null
          resolved_enrollment_id?: string | null
          resolved_kind: string
          resolved_unregistered_id?: string | null
          resolved_user_id?: string | null
          school_id: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          booking_token?: string | null
          booking_token_used_at?: string | null
          created_at?: string
          expires_at?: string
          full_name?: string | null
          id?: string
          otp_hash?: string
          phone?: string | null
          resolved_child_id?: string | null
          resolved_email?: string | null
          resolved_enrollment_id?: string | null
          resolved_kind?: string
          resolved_unregistered_id?: string | null
          resolved_user_id?: string | null
          school_id?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_booking_verifications_resolved_child_id_fkey"
            columns: ["resolved_child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_verifications_resolved_child_id_fkey"
            columns: ["resolved_child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_verifications_resolved_child_id_fkey"
            columns: ["resolved_child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "public_booking_verifications_resolved_enrollment_id_fkey"
            columns: ["resolved_enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_verifications_resolved_enrollment_id_fkey"
            columns: ["resolved_enrollment_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "public_booking_verifications_resolved_unregistered_id_fkey"
            columns: ["resolved_unregistered_id"]
            isOneToOne: false
            referencedRelation: "unregistered_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_verifications_resolved_user_id_fkey"
            columns: ["resolved_user_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "public_booking_verifications_resolved_user_id_fkey"
            columns: ["resolved_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_verifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "public_booking_verifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_verifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_verifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_verifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_booking_verifications_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
      refunds: {
        Row: {
          created_at: string
          id: string
          order_id: string | null
          payment_id: string | null
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          processed_at: string | null
          processed_by: string | null
          provider_void_id: string | null
          reason: string
          refund_amount: number
          refund_pct: number | null
          rejection_reason: string | null
          requested_by: string
          status: string
          transaction_id: string | null
          updated_at: string
          wompi_void_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          order_id?: string | null
          payment_id?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          processed_at?: string | null
          processed_by?: string | null
          provider_void_id?: string | null
          reason: string
          refund_amount: number
          refund_pct?: number | null
          rejection_reason?: string | null
          requested_by: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          wompi_void_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string | null
          payment_id?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          processed_at?: string | null
          processed_by?: string | null
          provider_void_id?: string | null
          reason?: string
          refund_amount?: number
          refund_pct?: number | null
          rejection_reason?: string | null
          requested_by?: string
          status?: string
          transaction_id?: string | null
          updated_at?: string
          wompi_void_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "my_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments_with_installments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "pending_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["active_payment_id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_abonos_summary"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_contacts"
            referencedColumns: ["payment_id"]
          },
        ]
      }
      report_team_schedule: {
        Row: {
          created_at: string
          id: string
          school_id: string
          send_day: number
          team_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          school_id: string
          send_day: number
          team_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          school_id?: string
          send_day?: number
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_team_schedule_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "report_team_schedule_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_team_schedule_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_team_schedule_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_team_schedule_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_team_schedule_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "report_team_schedule_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "report_team_schedule_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_team_schedule_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "report_team_schedule_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      reservation_payments: {
        Row: {
          amount: number
          cash_session_id: string | null
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
          cash_session_id?: string | null
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
          cash_session_id?: string | null
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
            foreignKeyName: "reservation_payments_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "reservation_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
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
            foreignKeyName: "reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
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
      school_addons: {
        Row: {
          addon_key: string
          created_at: string
          disabled_at: string | null
          enabled: boolean
          enabled_at: string | null
          id: string
          metadata: Json
          monthly_price_cents: number
          school_id: string
          updated_at: string
        }
        Insert: {
          addon_key: string
          created_at?: string
          disabled_at?: string | null
          enabled?: boolean
          enabled_at?: string | null
          id?: string
          metadata?: Json
          monthly_price_cents?: number
          school_id: string
          updated_at?: string
        }
        Update: {
          addon_key?: string
          created_at?: string
          disabled_at?: string | null
          enabled?: boolean
          enabled_at?: string | null
          id?: string
          metadata?: Json
          monthly_price_cents?: number
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_addons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_addons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_addons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_addons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_addons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_addons_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "school_availability_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
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
          {
            foreignKeyName: "school_branches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      school_categories: {
        Row: {
          age_max: number | null
          age_min: number | null
          age_rule: string
          axis: string
          belt: string | null
          birth_year_max: number | null
          birth_year_min: number | null
          branch_id: string | null
          code: string
          color: string | null
          created_at: string
          id: string
          is_active: boolean
          level: string | null
          metadata: Json
          name: string
          rama: string
          school_id: string
          sort_order: number
          sport: string
          team_max: number | null
          team_min: number | null
          template_id: string | null
          updated_at: string
          weight_max_kg: number | null
          weight_min_kg: number | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          age_rule?: string
          axis?: string
          belt?: string | null
          birth_year_max?: number | null
          birth_year_min?: number | null
          branch_id?: string | null
          code: string
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          level?: string | null
          metadata?: Json
          name: string
          rama?: string
          school_id: string
          sort_order?: number
          sport: string
          team_max?: number | null
          team_min?: number | null
          template_id?: string | null
          updated_at?: string
          weight_max_kg?: number | null
          weight_min_kg?: number | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          age_rule?: string
          axis?: string
          belt?: string | null
          birth_year_max?: number | null
          birth_year_min?: number | null
          branch_id?: string | null
          code?: string
          color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          level?: string | null
          metadata?: Json
          name?: string
          rama?: string
          school_id?: string
          sort_order?: number
          sport?: string
          team_max?: number | null
          team_min?: number | null
          template_id?: string | null
          updated_at?: string
          weight_max_kg?: number | null
          weight_min_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "school_categories_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_categories_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sport_category_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      school_certificate_templates: {
        Row: {
          active: boolean
          body_template: string
          created_at: string
          created_by: string | null
          currency: string
          footer_text: string | null
          id: string
          is_default: boolean
          kind: string
          name: string
          price: number
          requires_payment: boolean
          school_id: string
          signature_image_url: string | null
          signature_name: string | null
          signature_title: string | null
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body_template: string
          created_at?: string
          created_by?: string | null
          currency?: string
          footer_text?: string | null
          id?: string
          is_default?: boolean
          kind?: string
          name: string
          price?: number
          requires_payment?: boolean
          school_id: string
          signature_image_url?: string | null
          signature_name?: string | null
          signature_title?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body_template?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          footer_text?: string | null
          id?: string
          is_default?: boolean
          kind?: string
          name?: string
          price?: number
          requires_payment?: boolean
          school_id?: string
          signature_image_url?: string | null
          signature_name?: string | null
          signature_title?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_certificate_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "school_certificate_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_certificate_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_certificate_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_certificate_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_certificate_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_certificate_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_certificate_templates_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      school_courtesy_settings: {
        Row: {
          courtesy_offering_plan_id: string | null
          created_at: string
          enabled: boolean
          requires_approval: boolean
          school_id: string
          updated_at: string
        }
        Insert: {
          courtesy_offering_plan_id?: string | null
          created_at?: string
          enabled?: boolean
          requires_approval?: boolean
          school_id: string
          updated_at?: string
        }
        Update: {
          courtesy_offering_plan_id?: string | null
          created_at?: string
          enabled?: boolean
          requires_approval?: boolean
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_courtesy_settings_courtesy_offering_plan_id_fkey"
            columns: ["courtesy_offering_plan_id"]
            isOneToOne: false
            referencedRelation: "offering_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_courtesy_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_courtesy_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_courtesy_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_courtesy_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_courtesy_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_courtesy_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      school_custom_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          removed_at: string | null
          removed_by: string | null
          school_id: string
          ssl_expires_at: string | null
          ssl_issued_at: string | null
          ssl_status: string
          updated_at: string
          verification_token: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          removed_at?: string | null
          removed_by?: string | null
          school_id: string
          ssl_expires_at?: string | null
          ssl_issued_at?: string | null
          ssl_status?: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          removed_at?: string | null
          removed_by?: string | null
          school_id?: string
          ssl_expires_at?: string | null
          ssl_issued_at?: string | null
          ssl_status?: string
          updated_at?: string
          verification_token?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_custom_domains_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_custom_domains_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_custom_domains_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_custom_domains_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_custom_domains_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_custom_domains_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      school_join_qr_codes: {
        Row: {
          accept_payments: boolean
          active: boolean
          branch_id: string | null
          created_at: string
          created_by: string | null
          cta_text: string
          expires_at: string | null
          fixed_amount: number | null
          id: string
          intro_text: string | null
          name: string
          paid_count: number
          require_first_payment: boolean
          scan_count: number
          school_id: string
          signup_count: number
          slug: string
          target_id: string | null
          target_type: string
          updated_at: string
        }
        Insert: {
          accept_payments?: boolean
          active?: boolean
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          cta_text?: string
          expires_at?: string | null
          fixed_amount?: number | null
          id?: string
          intro_text?: string | null
          name: string
          paid_count?: number
          require_first_payment?: boolean
          scan_count?: number
          school_id: string
          signup_count?: number
          slug: string
          target_id?: string | null
          target_type?: string
          updated_at?: string
        }
        Update: {
          accept_payments?: boolean
          active?: boolean
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          cta_text?: string
          expires_at?: string | null
          fixed_amount?: number | null
          id?: string
          intro_text?: string | null
          name?: string
          paid_count?: number
          require_first_payment?: boolean
          scan_count?: number
          school_id?: string
          signup_count?: number
          slug?: string
          target_id?: string | null
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_join_qr_codes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "school_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_join_qr_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "school_join_qr_codes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_join_qr_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_join_qr_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_join_qr_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_join_qr_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_join_qr_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_join_qr_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      school_merchandise_items: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          price_by_size: Json | null
          school_id: string
          size_options: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          price_by_size?: Json | null
          school_id: string
          size_options?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          price_by_size?: Json | null
          school_id?: string
          size_options?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_merchandise_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_merchandise_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_merchandise_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_merchandise_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_merchandise_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_merchandise_items_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      school_module_overrides: {
        Row: {
          created_at: string
          enabled: boolean
          module_key: string
          school_id: string
          set_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled: boolean
          module_key: string
          school_id: string
          set_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          module_key?: string
          school_id?: string
          set_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_module_overrides_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_module_overrides_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_module_overrides_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_module_overrides_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_module_overrides_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_module_overrides_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_module_overrides_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "school_module_overrides_set_by_fkey"
            columns: ["set_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      school_onboarding_configs: {
        Row: {
          archetype: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          language: Json
          seed_config: Json
          sport_type: string
          tour_steps: Json
          updated_at: string
        }
        Insert: {
          archetype: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          language?: Json
          seed_config?: Json
          sport_type: string
          tour_steps?: Json
          updated_at?: string
        }
        Update: {
          archetype?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          language?: Json
          seed_config?: Json
          sport_type?: string
          tour_steps?: Json
          updated_at?: string
        }
        Relationships: []
      }
      school_payment_providers: {
        Row: {
          access_token: string | null
          application_fee_pct: number | null
          connect_method: string | null
          connect_status: string
          connected_at: string | null
          connected_by: string | null
          created_at: string
          enabled: boolean
          external_user_id: string | null
          id: string
          integrity_secret: string | null
          is_default: boolean
          provider: Database["public"]["Enums"]["payment_provider"]
          public_key: string
          sandbox: boolean
          school_id: string
          updated_at: string
          webhook_secret: string | null
        }
        Insert: {
          access_token?: string | null
          application_fee_pct?: number | null
          connect_method?: string | null
          connect_status?: string
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          enabled?: boolean
          external_user_id?: string | null
          id?: string
          integrity_secret?: string | null
          is_default?: boolean
          provider: Database["public"]["Enums"]["payment_provider"]
          public_key: string
          sandbox?: boolean
          school_id: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string | null
          application_fee_pct?: number | null
          connect_method?: string | null
          connect_status?: string
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          enabled?: boolean
          external_user_id?: string | null
          id?: string
          integrity_secret?: string | null
          is_default?: boolean
          provider?: Database["public"]["Enums"]["payment_provider"]
          public_key?: string
          sandbox?: boolean
          school_id?: string
          updated_at?: string
          webhook_secret?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_payment_providers_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "school_payment_providers_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_payment_providers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_payment_providers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_payment_providers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_payment_providers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_payment_providers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_payment_providers_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      school_referrals: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          message: string | null
          referral_code: string
          referred_email: string
          referred_school_id: string | null
          referrer_school_id: string
          referrer_user_id: string
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          message?: string | null
          referral_code: string
          referred_email: string
          referred_school_id?: string | null
          referrer_school_id: string
          referrer_user_id: string
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          message?: string | null
          referral_code?: string
          referred_email?: string
          referred_school_id?: string | null
          referrer_school_id?: string
          referrer_user_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_referrals_referred_school_id_fkey"
            columns: ["referred_school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_referrals_referred_school_id_fkey"
            columns: ["referred_school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_referrals_referred_school_id_fkey"
            columns: ["referred_school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_referrals_referred_school_id_fkey"
            columns: ["referred_school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_referrals_referred_school_id_fkey"
            columns: ["referred_school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_referrals_referred_school_id_fkey"
            columns: ["referred_school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_referrals_referrer_school_id_fkey"
            columns: ["referrer_school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_referrals_referrer_school_id_fkey"
            columns: ["referrer_school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_referrals_referrer_school_id_fkey"
            columns: ["referrer_school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_referrals_referrer_school_id_fkey"
            columns: ["referrer_school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_referrals_referrer_school_id_fkey"
            columns: ["referrer_school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_referrals_referrer_school_id_fkey"
            columns: ["referrer_school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      school_settings: {
        Row: {
          absence_alert_threshold: number
          active_modules: string[]
          allow_coach_messaging: boolean | null
          allow_installments: boolean
          allow_multiple_enrollments: boolean | null
          auto_approve_enabled: boolean
          auto_approve_max_amount: number
          auto_generate_payments: boolean | null
          auto_glosa_enabled: boolean
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_account_type: string | null
          bank_name: string | null
          bank_titular_id: string | null
          bank_titular_name: string | null
          billing_cycle_type: string
          billing_enabled: boolean
          breb_key: string | null
          breb_number: string | null
          coach_attendance_teams_only: boolean
          coach_can_create_athletes: boolean
          coach_can_create_teams: boolean
          coach_can_enroll_paid_teams: boolean
          coach_can_request_reminders: boolean | null
          coach_can_send_reminders: boolean | null
          created_at: string | null
          daviplata_number: string | null
          early_payment_discount_days: number
          early_payment_discount_enabled: boolean
          early_payment_discount_percentage: number
          fee_payer: string | null
          glosa_response_days: number
          hours_closing_time: string
          hours_entry_grace_minutes: number
          hours_exit_grace_minutes: number
          hours_max_visit_minutes: number
          hours_plan_enabled: boolean
          hours_reentry_merge_minutes: number
          hours_session_block_minutes: number
          installment_require_proof: boolean
          late_fee_enabled: boolean | null
          late_fee_percentage: number | null
          max_installments_per_payment: number
          merchandise_enabled: boolean
          min_installment_amount: number
          nequi_number: string | null
          online_fee_pct: number | null
          parent_email_optional: boolean
          payment_accounts: Json
          payment_cutoff_day: number | null
          payment_grace_days: number | null
          payment_qr_url: string | null
          payment_setup_completed: boolean | null
          public_profile_enabled: boolean
          receipt_date_window_days: number
          reminder_days_before: number | null
          reminder_enabled: boolean | null
          reports_default_send_day: number
          reports_draft_lead_days: number
          reports_enabled: boolean
          reports_release_by: string
          reports_reminder_days: number
          require_payment_proof: boolean | null
          responsible_payment_policy: string | null
          school_id: string
          show_facilities: boolean
          show_plans: boolean
          show_programs: boolean
          sportmaps_pay_terms_accepted_at: string | null
          sportmaps_pay_terms_accepted_by: string | null
          transfer_day: string | null
          transfer_key: string | null
          updated_at: string | null
          whatsapp_number: string | null
          wompi_enabled: boolean | null
        }
        Insert: {
          absence_alert_threshold?: number
          active_modules?: string[]
          allow_coach_messaging?: boolean | null
          allow_installments?: boolean
          allow_multiple_enrollments?: boolean | null
          auto_approve_enabled?: boolean
          auto_approve_max_amount?: number
          auto_generate_payments?: boolean | null
          auto_glosa_enabled?: boolean
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          bank_titular_id?: string | null
          bank_titular_name?: string | null
          billing_cycle_type?: string
          billing_enabled?: boolean
          breb_key?: string | null
          breb_number?: string | null
          coach_attendance_teams_only?: boolean
          coach_can_create_athletes?: boolean
          coach_can_create_teams?: boolean
          coach_can_enroll_paid_teams?: boolean
          coach_can_request_reminders?: boolean | null
          coach_can_send_reminders?: boolean | null
          created_at?: string | null
          daviplata_number?: string | null
          early_payment_discount_days?: number
          early_payment_discount_enabled?: boolean
          early_payment_discount_percentage?: number
          fee_payer?: string | null
          glosa_response_days?: number
          hours_closing_time?: string
          hours_entry_grace_minutes?: number
          hours_exit_grace_minutes?: number
          hours_max_visit_minutes?: number
          hours_plan_enabled?: boolean
          hours_reentry_merge_minutes?: number
          hours_session_block_minutes?: number
          installment_require_proof?: boolean
          late_fee_enabled?: boolean | null
          late_fee_percentage?: number | null
          max_installments_per_payment?: number
          merchandise_enabled?: boolean
          min_installment_amount?: number
          nequi_number?: string | null
          online_fee_pct?: number | null
          parent_email_optional?: boolean
          payment_accounts?: Json
          payment_cutoff_day?: number | null
          payment_grace_days?: number | null
          payment_qr_url?: string | null
          payment_setup_completed?: boolean | null
          public_profile_enabled?: boolean
          receipt_date_window_days?: number
          reminder_days_before?: number | null
          reminder_enabled?: boolean | null
          reports_default_send_day?: number
          reports_draft_lead_days?: number
          reports_enabled?: boolean
          reports_release_by?: string
          reports_reminder_days?: number
          require_payment_proof?: boolean | null
          responsible_payment_policy?: string | null
          school_id: string
          show_facilities?: boolean
          show_plans?: boolean
          show_programs?: boolean
          sportmaps_pay_terms_accepted_at?: string | null
          sportmaps_pay_terms_accepted_by?: string | null
          transfer_day?: string | null
          transfer_key?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
          wompi_enabled?: boolean | null
        }
        Update: {
          absence_alert_threshold?: number
          active_modules?: string[]
          allow_coach_messaging?: boolean | null
          allow_installments?: boolean
          allow_multiple_enrollments?: boolean | null
          auto_approve_enabled?: boolean
          auto_approve_max_amount?: number
          auto_generate_payments?: boolean | null
          auto_glosa_enabled?: boolean
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          bank_titular_id?: string | null
          bank_titular_name?: string | null
          billing_cycle_type?: string
          billing_enabled?: boolean
          breb_key?: string | null
          breb_number?: string | null
          coach_attendance_teams_only?: boolean
          coach_can_create_athletes?: boolean
          coach_can_create_teams?: boolean
          coach_can_enroll_paid_teams?: boolean
          coach_can_request_reminders?: boolean | null
          coach_can_send_reminders?: boolean | null
          created_at?: string | null
          daviplata_number?: string | null
          early_payment_discount_days?: number
          early_payment_discount_enabled?: boolean
          early_payment_discount_percentage?: number
          fee_payer?: string | null
          glosa_response_days?: number
          hours_closing_time?: string
          hours_entry_grace_minutes?: number
          hours_exit_grace_minutes?: number
          hours_max_visit_minutes?: number
          hours_plan_enabled?: boolean
          hours_reentry_merge_minutes?: number
          hours_session_block_minutes?: number
          installment_require_proof?: boolean
          late_fee_enabled?: boolean | null
          late_fee_percentage?: number | null
          max_installments_per_payment?: number
          merchandise_enabled?: boolean
          min_installment_amount?: number
          nequi_number?: string | null
          online_fee_pct?: number | null
          parent_email_optional?: boolean
          payment_accounts?: Json
          payment_cutoff_day?: number | null
          payment_grace_days?: number | null
          payment_qr_url?: string | null
          payment_setup_completed?: boolean | null
          public_profile_enabled?: boolean
          receipt_date_window_days?: number
          reminder_days_before?: number | null
          reminder_enabled?: boolean | null
          reports_default_send_day?: number
          reports_draft_lead_days?: number
          reports_enabled?: boolean
          reports_release_by?: string
          reports_reminder_days?: number
          require_payment_proof?: boolean | null
          responsible_payment_policy?: string | null
          school_id?: string
          show_facilities?: boolean
          show_plans?: boolean
          show_programs?: boolean
          sportmaps_pay_terms_accepted_at?: string | null
          sportmaps_pay_terms_accepted_by?: string | null
          transfer_day?: string | null
          transfer_key?: string | null
          updated_at?: string | null
          whatsapp_number?: string | null
          wompi_enabled?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
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
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      school_signup_leads: {
        Row: {
          birth_date: string | null
          converted_enrollment_id: string | null
          created_at: string
          email: string | null
          full_name: string
          gender: string | null
          guardian_name: string | null
          how_heard: string | null
          id: string
          notes: string | null
          phone: string
          school_id: string
          source_detail: Json | null
          source_slug: string
          status: string
          suggested_category: string | null
          trial_slot_id: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          converted_enrollment_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          gender?: string | null
          guardian_name?: string | null
          how_heard?: string | null
          id?: string
          notes?: string | null
          phone: string
          school_id: string
          source_detail?: Json | null
          source_slug: string
          status?: string
          suggested_category?: string | null
          trial_slot_id?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          converted_enrollment_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          gender?: string | null
          guardian_name?: string | null
          how_heard?: string | null
          id?: string
          notes?: string | null
          phone?: string
          school_id?: string
          source_detail?: Json | null
          source_slug?: string
          status?: string
          suggested_category?: string | null
          trial_slot_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_signup_leads_converted_enrollment_id_fkey"
            columns: ["converted_enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_signup_leads_converted_enrollment_id_fkey"
            columns: ["converted_enrollment_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "school_signup_leads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_signup_leads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_signup_leads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_signup_leads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_signup_leads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_signup_leads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_signup_leads_trial_slot_id_fkey"
            columns: ["trial_slot_id"]
            isOneToOne: false
            referencedRelation: "school_trial_slots"
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
          sports: string[]
          status: string
          taught_levels: number[]
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
          sports?: string[]
          status?: string
          taught_levels?: number[]
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
          sports?: string[]
          status?: string
          taught_levels?: number[]
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "school_staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      school_subscription_invoices: {
        Row: {
          amount_cents: number
          created_at: string
          due_date: string
          id: string
          invoice_number: string
          marked_paid_at: string | null
          marked_paid_by: string | null
          pdf_object_path: string | null
          period_end: string
          period_start: string
          plan_code: string
          reminder_sent_at: string | null
          reminder_stage: string | null
          school_id: string
          sent_email_at: string | null
          sent_push_at: string | null
          status: string
          updated_at: string
          whatsapp_opened_at: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          due_date: string
          id?: string
          invoice_number: string
          marked_paid_at?: string | null
          marked_paid_by?: string | null
          pdf_object_path?: string | null
          period_end: string
          period_start: string
          plan_code: string
          reminder_sent_at?: string | null
          reminder_stage?: string | null
          school_id: string
          sent_email_at?: string | null
          sent_push_at?: string | null
          status?: string
          updated_at?: string
          whatsapp_opened_at?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          due_date?: string
          id?: string
          invoice_number?: string
          marked_paid_at?: string | null
          marked_paid_by?: string | null
          pdf_object_path?: string | null
          period_end?: string
          period_start?: string
          plan_code?: string
          reminder_sent_at?: string | null
          reminder_stage?: string | null
          school_id?: string
          sent_email_at?: string | null
          sent_push_at?: string | null
          status?: string
          updated_at?: string
          whatsapp_opened_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_subscription_invoices_marked_paid_by_fkey"
            columns: ["marked_paid_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "school_subscription_invoices_marked_paid_by_fkey"
            columns: ["marked_paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_subscription_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_subscription_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_subscription_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_subscription_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_subscription_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_subscription_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      school_subscriptions: {
        Row: {
          billing_cycle: string
          billing_emails: string[] | null
          blocking_exempt: boolean
          blocking_exempt_reason: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          custom_price_cents: number | null
          id: string
          metadata: Json
          next_invoice_number: number
          payment_provider: string | null
          payment_provider_subscription_id: string | null
          plan_code: string
          saas_billing_enabled: boolean
          saas_billing_enabled_at: string | null
          school_id: string
          status: string
          tier: string
          trial_ends_at: string | null
          trial_months: number | null
          updated_at: string
        }
        Insert: {
          billing_cycle?: string
          billing_emails?: string[] | null
          blocking_exempt?: boolean
          blocking_exempt_reason?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          custom_price_cents?: number | null
          id?: string
          metadata?: Json
          next_invoice_number?: number
          payment_provider?: string | null
          payment_provider_subscription_id?: string | null
          plan_code?: string
          saas_billing_enabled?: boolean
          saas_billing_enabled_at?: string | null
          school_id: string
          status?: string
          tier?: string
          trial_ends_at?: string | null
          trial_months?: number | null
          updated_at?: string
        }
        Update: {
          billing_cycle?: string
          billing_emails?: string[] | null
          blocking_exempt?: boolean
          blocking_exempt_reason?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          custom_price_cents?: number | null
          id?: string
          metadata?: Json
          next_invoice_number?: number
          payment_provider?: string | null
          payment_provider_subscription_id?: string | null
          plan_code?: string
          saas_billing_enabled?: boolean
          saas_billing_enabled_at?: string | null
          school_id?: string
          status?: string
          tier?: string
          trial_ends_at?: string | null
          trial_months?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      school_trial_class_settings: {
        Row: {
          created_at: string
          enabled: boolean
          payment_mode: string
          requires_approval: boolean
          reschedule_cutoff_hours: number
          school_id: string
          self_service_enabled: boolean
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          payment_mode?: string
          requires_approval?: boolean
          reschedule_cutoff_hours?: number
          school_id: string
          self_service_enabled?: boolean
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          payment_mode?: string
          requires_approval?: boolean
          reschedule_cutoff_hours?: number
          school_id?: string
          self_service_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_trial_class_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_trial_class_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_trial_class_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_trial_class_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_trial_class_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_trial_class_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      school_trial_slots: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: string | null
          id: string
          is_open: boolean
          label: string
          location: string | null
          max_capacity: number
          reserved_count: number
          school_id: string
          slot_date: string
          start_time: string
          team_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          id?: string
          is_open?: boolean
          label: string
          location?: string | null
          max_capacity?: number
          reserved_count?: number
          school_id: string
          slot_date: string
          start_time: string
          team_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: string | null
          id?: string
          is_open?: boolean
          label?: string
          location?: string | null
          max_capacity?: number
          reserved_count?: number
          school_id?: string
          slot_date?: string
          start_time?: string
          team_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_trial_slots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "school_trial_slots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_trial_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_trial_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_trial_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_trial_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_trial_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_trial_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_trial_slots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "school_trial_slots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_trial_slots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "school_trial_slots_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      school_whatsapp_integrations: {
        Row: {
          access_token_encrypted: string | null
          business_id: string | null
          connected_at: string | null
          connected_by: string | null
          created_at: string
          display_phone_number: string | null
          id: string
          phone_number_id: string
          school_id: string
          status: string
          suspended_at: string | null
          suspended_reason: string | null
          token_rotated_at: string | null
          updated_at: string
          verify_token: string | null
          waba_id: string | null
        }
        Insert: {
          access_token_encrypted?: string | null
          business_id?: string | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          display_phone_number?: string | null
          id?: string
          phone_number_id: string
          school_id: string
          status?: string
          suspended_at?: string | null
          suspended_reason?: string | null
          token_rotated_at?: string | null
          updated_at?: string
          verify_token?: string | null
          waba_id?: string | null
        }
        Update: {
          access_token_encrypted?: string | null
          business_id?: string | null
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          display_phone_number?: string | null
          id?: string
          phone_number_id?: string
          school_id?: string
          status?: string
          suspended_at?: string | null
          suspended_reason?: string | null
          token_rotated_at?: string | null
          updated_at?: string
          verify_token?: string | null
          waba_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_whatsapp_integrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "school_whatsapp_integrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_whatsapp_integrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_whatsapp_integrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_whatsapp_integrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_whatsapp_integrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      schools: {
        Row: {
          accepts_reservations: boolean | null
          account_type: string
          address: string | null
          amenities: string[] | null
          avg_rating: number | null
          branding_settings: Json
          business_model: string
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
          payment_mode: string
          payment_settings: Json | null
          phone: string | null
          pricing: Json | null
          rating: number | null
          review_count: number | null
          schedule: Json | null
          school_type: string | null
          slug: string
          sports: string[] | null
          total_reviews: number | null
          updated_at: string | null
          verified: boolean | null
          website: string | null
        }
        Insert: {
          accepts_reservations?: boolean | null
          account_type?: string
          address?: string | null
          amenities?: string[] | null
          avg_rating?: number | null
          branding_settings?: Json
          business_model?: string
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
          payment_mode?: string
          payment_settings?: Json | null
          phone?: string | null
          pricing?: Json | null
          rating?: number | null
          review_count?: number | null
          schedule?: Json | null
          school_type?: string | null
          slug?: string
          sports?: string[] | null
          total_reviews?: number | null
          updated_at?: string | null
          verified?: boolean | null
          website?: string | null
        }
        Update: {
          accepts_reservations?: boolean | null
          account_type?: string
          address?: string | null
          amenities?: string[] | null
          avg_rating?: number | null
          branding_settings?: Json
          business_model?: string
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
          payment_mode?: string
          payment_settings?: Json | null
          phone?: string | null
          pricing?: Json | null
          rating?: number | null
          review_count?: number | null
          schedule?: Json | null
          school_type?: string | null
          slug?: string
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
      service_availability: {
        Row: {
          buffer_time_minutes: number
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          max_concurrent: number
          slot_duration_minutes: number
          start_time: string
          updated_at: string
          vendor_profile_id: string
        }
        Insert: {
          buffer_time_minutes?: number
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          max_concurrent?: number
          slot_duration_minutes?: number
          start_time: string
          updated_at?: string
          vendor_profile_id: string
        }
        Update: {
          buffer_time_minutes?: number
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          max_concurrent?: number
          slot_duration_minutes?: number
          start_time?: string
          updated_at?: string
          vendor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_availability_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_listings: {
        Row: {
          cancellation_policy_hours: number
          created_at: string
          currency: string
          description: string | null
          duration_minutes: number
          has_variations: boolean
          id: string
          image_url: string | null
          is_active: boolean
          max_daily_slots: number | null
          metadata: Json
          name: string
          price: number
          service_type: string
          tax_rate: number
          updated_at: string
          vendor_profile_id: string
          visibility: Database["public"]["Enums"]["product_visibility"]
        }
        Insert: {
          cancellation_policy_hours?: number
          created_at?: string
          currency?: string
          description?: string | null
          duration_minutes?: number
          has_variations?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_daily_slots?: number | null
          metadata?: Json
          name: string
          price?: number
          service_type: string
          tax_rate?: number
          updated_at?: string
          vendor_profile_id: string
          visibility?: Database["public"]["Enums"]["product_visibility"]
        }
        Update: {
          cancellation_policy_hours?: number
          created_at?: string
          currency?: string
          description?: string | null
          duration_minutes?: number
          has_variations?: boolean
          id?: string
          image_url?: string | null
          is_active?: boolean
          max_daily_slots?: number | null
          metadata?: Json
          name?: string
          price?: number
          service_type?: string
          tax_rate?: number
          updated_at?: string
          vendor_profile_id?: string
          visibility?: Database["public"]["Enums"]["product_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "service_listings_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_variations: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number
          id: string
          is_active: boolean
          name: string
          price: number
          service_listing_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes: number
          id?: string
          is_active?: boolean
          name: string
          price: number
          service_listing_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number
          id?: string
          is_active?: boolean
          name?: string
          price?: number
          service_listing_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_variations_service_listing_id_fkey"
            columns: ["service_listing_id"]
            isOneToOne: false
            referencedRelation: "service_listings"
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
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
            referencedRelation: "training_slots"
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
          enrollment_id: string | null
          hour_bank_reservation_id: string | null
          id: string
          is_corrected: boolean
          is_secondary: boolean
          last_failure_at: string | null
          last_failure_reason: string | null
          paid_at: string | null
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_status: string | null
          price: number | null
          provider_reference: string | null
          provider_transaction_id: string | null
          requires_review: boolean
          school_id: string
          session_id: string
          status: Database["public"]["Enums"]["booking_status"]
          unblocked_at: string | null
          unblocked_by: string | null
          unregistered_athlete_id: string | null
          updated_at: string
          user_id: string | null
          wompi_reference: string | null
          wompi_transaction_id: string | null
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
          enrollment_id?: string | null
          hour_bank_reservation_id?: string | null
          id?: string
          is_corrected?: boolean
          is_secondary?: boolean
          last_failure_at?: string | null
          last_failure_reason?: string | null
          paid_at?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_status?: string | null
          price?: number | null
          provider_reference?: string | null
          provider_transaction_id?: string | null
          requires_review?: boolean
          school_id: string
          session_id: string
          status?: Database["public"]["Enums"]["booking_status"]
          unblocked_at?: string | null
          unblocked_by?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string
          user_id?: string | null
          wompi_reference?: string | null
          wompi_transaction_id?: string | null
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
          enrollment_id?: string | null
          hour_bank_reservation_id?: string | null
          id?: string
          is_corrected?: boolean
          is_secondary?: boolean
          last_failure_at?: string | null
          last_failure_reason?: string | null
          paid_at?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          payment_status?: string | null
          price?: number | null
          provider_reference?: string | null
          provider_transaction_id?: string | null
          requires_review?: boolean
          school_id?: string
          session_id?: string
          status?: Database["public"]["Enums"]["booking_status"]
          unblocked_at?: string | null
          unblocked_by?: string | null
          unregistered_athlete_id?: string | null
          updated_at?: string
          user_id?: string | null
          wompi_reference?: string | null
          wompi_transaction_id?: string | null
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
            foreignKeyName: "session_bookings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
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
            foreignKeyName: "session_bookings_hour_bank_reservation_id_fkey"
            columns: ["hour_bank_reservation_id"]
            isOneToOne: false
            referencedRelation: "hour_bank_reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "session_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            referencedRelation: "poll_sessions_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "session_bookings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_bookable_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_bookings_unregistered_athlete_id_fkey"
            columns: ["unregistered_athlete_id"]
            isOneToOne: false
            referencedRelation: "unregistered_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "session_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_exercise_results: {
        Row: {
          biomech_analysis_id: string | null
          created_at: string
          distance_m: number | null
          duration_seconds: number | null
          exercise_key: string
          exercise_name: string
          id: string
          notes: string | null
          recorded_by: string
          reps_completed: number | null
          rpe: number | null
          session_plan_id: string
          set_number: number
          weight_kg: number | null
        }
        Insert: {
          biomech_analysis_id?: string | null
          created_at?: string
          distance_m?: number | null
          duration_seconds?: number | null
          exercise_key: string
          exercise_name: string
          id?: string
          notes?: string | null
          recorded_by: string
          reps_completed?: number | null
          rpe?: number | null
          session_plan_id: string
          set_number: number
          weight_kg?: number | null
        }
        Update: {
          biomech_analysis_id?: string | null
          created_at?: string
          distance_m?: number | null
          duration_seconds?: number | null
          exercise_key?: string
          exercise_name?: string
          id?: string
          notes?: string | null
          recorded_by?: string
          reps_completed?: number | null
          rpe?: number | null
          session_plan_id?: string
          set_number?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "session_exercise_results_biomech_analysis_id_fkey"
            columns: ["biomech_analysis_id"]
            isOneToOne: false
            referencedRelation: "biomech_analyses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_exercise_results_session_plan_id_fkey"
            columns: ["session_plan_id"]
            isOneToOne: false
            referencedRelation: "trainer_session_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          created_at: string
          gateway_fee: number
          gross_amount: number
          id: string
          net_amount: number
          order_id: string
          order_item_id: string | null
          paid_at: string | null
          payment_reference: string | null
          platform_fee: number
          status: Database["public"]["Enums"]["settlement_status"]
          tax_amount: number
          updated_at: string
          vendor_profile_id: string
        }
        Insert: {
          created_at?: string
          gateway_fee?: number
          gross_amount: number
          id?: string
          net_amount: number
          order_id: string
          order_item_id?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          platform_fee?: number
          status?: Database["public"]["Enums"]["settlement_status"]
          tax_amount?: number
          updated_at?: string
          vendor_profile_id: string
        }
        Update: {
          created_at?: string
          gateway_fee?: number
          gross_amount?: number
          id?: string
          net_amount?: number
          order_id?: string
          order_item_id?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          platform_fee?: number
          status?: Database["public"]["Enums"]["settlement_status"]
          tax_amount?: number
          updated_at?: string
          vendor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "my_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          carrier: string | null
          carrier_code: string | null
          created_at: string | null
          delivered_at: string | null
          destination: Json | null
          dimensions: Json | null
          estimated_delivery: string | null
          events: Json
          id: string
          label_format: string | null
          label_url: string | null
          order_id: string
          origin: Json | null
          pickup_at: string | null
          provider: string | null
          raw_response: Json | null
          shipped_at: string | null
          shipping_cost: number | null
          status: string
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string | null
          vendor_profile_id: string
          weight_grams: number | null
        }
        Insert: {
          carrier?: string | null
          carrier_code?: string | null
          created_at?: string | null
          delivered_at?: string | null
          destination?: Json | null
          dimensions?: Json | null
          estimated_delivery?: string | null
          events?: Json
          id?: string
          label_format?: string | null
          label_url?: string | null
          order_id: string
          origin?: Json | null
          pickup_at?: string | null
          provider?: string | null
          raw_response?: Json | null
          shipped_at?: string | null
          shipping_cost?: number | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
          vendor_profile_id: string
          weight_grams?: number | null
        }
        Update: {
          carrier?: string | null
          carrier_code?: string | null
          created_at?: string | null
          delivered_at?: string | null
          destination?: Json | null
          dimensions?: Json | null
          estimated_delivery?: string | null
          events?: Json
          id?: string
          label_format?: string | null
          label_url?: string | null
          order_id?: string
          origin?: Json | null
          pickup_at?: string | null
          provider?: string | null
          raw_response?: Json | null
          shipped_at?: string | null
          shipping_cost?: number | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
          vendor_profile_id?: string
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "my_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipments_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_zones: {
        Row: {
          costo_base: number
          created_at: string
          departamento: string
          estimated_days_max: number | null
          estimated_days_min: number | null
          id: string
          is_active: boolean
          notes: string | null
          updated_at: string
        }
        Insert: {
          costo_base: number
          created_at?: string
          departamento: string
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          updated_at?: string
        }
        Update: {
          costo_base?: number
          created_at?: string
          departamento?: string
          estimated_days_max?: number | null
          estimated_days_min?: number | null
          id?: string
          is_active?: boolean
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      skill_biomech_evidence: {
        Row: {
          academic_progress_id: string
          added_by: string | null
          capture_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          academic_progress_id: string
          added_by?: string | null
          capture_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          academic_progress_id?: string
          added_by?: string | null
          capture_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skill_biomech_evidence_academic_progress_id_fkey"
            columns: ["academic_progress_id"]
            isOneToOne: false
            referencedRelation: "academic_progress"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_biomech_evidence_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "skill_biomech_evidence_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "skill_biomech_evidence_capture_id_fkey"
            columns: ["capture_id"]
            isOneToOne: false
            referencedRelation: "biomech_captures"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_category_templates: {
        Row: {
          age_max: number | null
          age_min: number | null
          archetype: string | null
          category: string
          created_at: string
          division: string
          id: string
          is_active: boolean
          level: string | null
          rama: string
          sort_order: number
          sport: string
          team_max: number | null
          team_min: number | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          archetype?: string | null
          category: string
          created_at?: string
          division: string
          id?: string
          is_active?: boolean
          level?: string | null
          rama?: string
          sort_order?: number
          sport: string
          team_max?: number | null
          team_min?: number | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          archetype?: string | null
          category?: string
          created_at?: string
          division?: string
          id?: string
          is_active?: boolean
          level?: string | null
          rama?: string
          sort_order?: number
          sport?: string
          team_max?: number | null
          team_min?: number | null
        }
        Relationships: []
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
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
          {
            foreignKeyName: "sport_configs_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      sport_metric_definitions: {
        Row: {
          category: string | null
          created_at: string
          data_type: string
          display_name: string
          higher_is_better: boolean
          id: string
          is_active: boolean
          max_value: number | null
          metric_key: string
          min_value: number | null
          parent_hint: string | null
          parent_label: string | null
          sport_category_id: string
          subcategory: string | null
          unit: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          data_type: string
          display_name: string
          higher_is_better?: boolean
          id?: string
          is_active?: boolean
          max_value?: number | null
          metric_key: string
          min_value?: number | null
          parent_hint?: string | null
          parent_label?: string | null
          sport_category_id: string
          subcategory?: string | null
          unit?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          data_type?: string
          display_name?: string
          higher_is_better?: boolean
          id?: string
          is_active?: boolean
          max_value?: number | null
          metric_key?: string
          min_value?: number | null
          parent_hint?: string | null
          parent_label?: string | null
          sport_category_id?: string
          subcategory?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sport_metric_definitions_sport_category_id_fkey"
            columns: ["sport_category_id"]
            isOneToOne: false
            referencedRelation: "sports_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      sport_metric_thresholds: {
        Row: {
          band: string
          created_at: string
          id: string
          max_value: number | null
          metric_id: string
          min_value: number | null
        }
        Insert: {
          band: string
          created_at?: string
          id?: string
          max_value?: number | null
          metric_id: string
          min_value?: number | null
        }
        Update: {
          band?: string
          created_at?: string
          id?: string
          max_value?: number | null
          metric_id?: string
          min_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sport_metric_thresholds_metric_id_fkey"
            columns: ["metric_id"]
            isOneToOne: false
            referencedRelation: "sport_metric_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_categories: {
        Row: {
          acronimo_fi: string | null
          categorias_oficiales: Json | null
          created_at: string | null
          description: string | null
          estado_olimpico: string | null
          federacion_internacional: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name: string
          slug: string | null
          uses_sets_scoring: boolean
        }
        Insert: {
          acronimo_fi?: string | null
          categorias_oficiales?: Json | null
          created_at?: string | null
          description?: string | null
          estado_olimpico?: string | null
          federacion_internacional?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          slug?: string | null
          uses_sets_scoring?: boolean
        }
        Update: {
          acronimo_fi?: string | null
          categorias_oficiales?: Json | null
          created_at?: string | null
          description?: string | null
          estado_olimpico?: string | null
          federacion_internacional?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          slug?: string | null
          uses_sets_scoring?: boolean
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
      store_conversations: {
        Row: {
          buyer_id: string
          buyer_unread: number
          created_at: string
          id: string
          last_message_at: string
          order_id: string | null
          product_id: string | null
          subject: string | null
          updated_at: string
          vendor_profile_id: string
          vendor_unread: number
        }
        Insert: {
          buyer_id: string
          buyer_unread?: number
          created_at?: string
          id?: string
          last_message_at?: string
          order_id?: string | null
          product_id?: string | null
          subject?: string | null
          updated_at?: string
          vendor_profile_id: string
          vendor_unread?: number
        }
        Update: {
          buyer_id?: string
          buyer_unread?: number
          created_at?: string
          id?: string
          last_message_at?: string
          order_id?: string | null
          product_id?: string | null
          subject?: string | null
          updated_at?: string
          vendor_profile_id?: string
          vendor_unread?: number
        }
        Relationships: [
          {
            foreignKeyName: "store_conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "my_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_conversations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_conversations_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "store_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_period: string
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          max_subscribers: number | null
          metadata: Json
          name: string
          plan_type: string
          price: number
          sessions_included: number | null
          tax_rate: number
          trial_days: number
          updated_at: string
          vendor_profile_id: string
        }
        Insert: {
          billing_period?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_subscribers?: number | null
          metadata?: Json
          name: string
          plan_type: string
          price: number
          sessions_included?: number | null
          tax_rate?: number
          trial_days?: number
          updated_at?: string
          vendor_profile_id: string
        }
        Update: {
          billing_period?: string
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_subscribers?: number | null
          metadata?: Json
          name?: string
          plan_type?: string
          price?: number
          sessions_included?: number | null
          tax_rate?: number
          trial_days?: number
          updated_at?: string
          vendor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_plans_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_bills: {
        Row: {
          amount: number
          amount_paid: number
          category_id: string | null
          created_at: string
          created_by: string
          due_date: string
          id: string
          invoice_no: string | null
          issue_date: string
          notes: string | null
          owner_id: string
          owner_type: string
          status: Database["public"]["Enums"]["bill_status"]
          supplier_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_paid?: number
          category_id?: string | null
          created_at?: string
          created_by: string
          due_date: string
          id?: string
          invoice_no?: string | null
          issue_date: string
          notes?: string | null
          owner_id: string
          owner_type: string
          status?: Database["public"]["Enums"]["bill_status"]
          supplier_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_paid?: number
          category_id?: string | null
          created_at?: string
          created_by?: string
          due_date?: string
          id?: string
          invoice_no?: string | null
          issue_date?: string
          notes?: string | null
          owner_id?: string
          owner_type?: string
          status?: Database["public"]["Enums"]["bill_status"]
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_bills_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_bills_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          nit: string | null
          notes: string | null
          owner_id: string
          owner_type: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          nit?: string | null
          notes?: string | null
          owner_id: string
          owner_type: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          nit?: string | null
          notes?: string | null
          owner_id?: string
          owner_type?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          attachments: Json
          author_id: string | null
          author_type: string
          body: string
          created_at: string
          id: string
          internal_note: boolean
          ticket_id: string
        }
        Insert: {
          attachments?: Json
          author_id?: string | null
          author_type: string
          body: string
          created_at?: string
          id?: string
          internal_note?: boolean
          ticket_id: string
        }
        Update: {
          attachments?: Json
          author_id?: string | null
          author_type?: string
          body?: string
          created_at?: string
          id?: string
          internal_note?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "support_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assignee_id: string | null
          audience: string
          category: string | null
          channel: string
          created_at: string
          first_response_at: string | null
          id: string
          priority: string
          requester_id: string
          resolved_at: string | null
          school_id: string | null
          status: string
          subject: string | null
          updated_at: string
          whatsapp_conversation_id: string | null
        }
        Insert: {
          assignee_id?: string | null
          audience?: string
          category?: string | null
          channel?: string
          created_at?: string
          first_response_at?: string | null
          id?: string
          priority?: string
          requester_id: string
          resolved_at?: string | null
          school_id?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          whatsapp_conversation_id?: string | null
        }
        Update: {
          assignee_id?: string | null
          audience?: string
          category?: string | null
          channel?: string
          created_at?: string
          first_response_at?: string | null
          id?: string
          priority?: string
          requester_id?: string
          resolved_at?: string | null
          school_id?: string | null
          status?: string
          subject?: string | null
          updated_at?: string
          whatsapp_conversation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "support_tickets_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "support_tickets_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "support_tickets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "support_tickets_whatsapp_conversation_id_fkey"
            columns: ["whatsapp_conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "team_branches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "team_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_coach_team_plans"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "team_coaches_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_school_staff_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_coaches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "team_coaches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
          position_code: string | null
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
          position_code?: string | null
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
          position_code?: string | null
          profile_id?: string | null
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
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
      team_report_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          period_month: number
          period_year: number
          school_id: string
          team_id: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          period_month: number
          period_year: number
          school_id: string
          team_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          period_month?: number
          period_year?: number
          school_id?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_report_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "public_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_report_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "school_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_report_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "v_coach_team_plans"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "team_report_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "v_school_staff_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_report_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "team_report_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_report_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_report_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_report_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_report_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "team_report_notes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_report_notes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_report_notes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "team_report_notes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      team_tactical_presets: {
        Row: {
          arrows: Json
          created_at: string
          created_by: string
          id: string
          name: string
          school_id: string
          situation: string
          slots: Json
          team_id: string
          updated_at: string
        }
        Insert: {
          arrows?: Json
          created_at?: string
          created_by: string
          id?: string
          name: string
          school_id: string
          situation: string
          slots: Json
          team_id: string
          updated_at?: string
        }
        Update: {
          arrows?: Json
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          school_id?: string
          situation?: string
          slots?: Json
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_tactical_presets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "team_tactical_presets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_tactical_presets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "team_tactical_presets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_tactical_presets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_tactical_presets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_tactical_presets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_tactical_presets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "team_tactical_presets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_tactical_presets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_tactical_presets_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "team_tactical_presets_team_id_fkey"
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
          category_id: string | null
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
          category_id?: string | null
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
          category_id?: string | null
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
            foreignKeyName: "teams_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "school_categories"
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
            foreignKeyName: "teams_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_coach_team_plans"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "teams_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_school_staff_publico"
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "teams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      template_variables: {
        Row: {
          applies_to: string[] | null
          description: string | null
          key: string
          label: string
        }
        Insert: {
          applies_to?: string[] | null
          description?: string | null
          key: string
          label: string
        }
        Update: {
          applies_to?: string[] | null
          description?: string | null
          key?: string
          label?: string
        }
        Relationships: []
      }
      tournament_match_events: {
        Row: {
          created_at: string
          event_id: string
          id: string
          match_id: string
          member_id: string | null
          minute: number | null
          team_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          match_id: string
          member_id?: string | null
          minute?: number | null
          team_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          match_id?: string
          member_id?: string | null
          minute?: number | null
          team_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_match_events_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_match_events_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_match_events_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "event_team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_match_events_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "event_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_matches: {
        Row: {
          away_score: number | null
          away_team_id: string | null
          category_id: string | null
          created_at: string
          event_id: string
          home_score: number | null
          home_team_id: string | null
          id: string
          notes: string | null
          round: number
          scheduled_at: string | null
          slot: number
          status: string
          updated_at: string
          venue: string | null
        }
        Insert: {
          away_score?: number | null
          away_team_id?: string | null
          category_id?: string | null
          created_at?: string
          event_id: string
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          notes?: string | null
          round?: number
          scheduled_at?: string | null
          slot?: number
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Update: {
          away_score?: number | null
          away_team_id?: string | null
          category_id?: string | null
          created_at?: string
          event_id?: string
          home_score?: number | null
          home_team_id?: string | null
          id?: string
          notes?: string | null
          round?: number
          scheduled_at?: string | null
          slot?: number
          status?: string
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tournament_matches_away_team_id_fkey"
            columns: ["away_team_id"]
            isOneToOne: false
            referencedRelation: "event_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "event_categories_config"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_matches_home_team_id_fkey"
            columns: ["home_team_id"]
            isOneToOne: false
            referencedRelation: "event_teams"
            referencedColumns: ["id"]
          },
        ]
      }
      trainer_profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          bio: string | null
          certifications: Json | null
          city: string | null
          cover_image_url: string | null
          created_at: string | null
          display_name: string | null
          experience_years: number | null
          gallery_urls: string[] | null
          id: string
          instagram_url: string | null
          is_published: boolean | null
          lat: number | null
          lng: number | null
          modality: string | null
          primary_sport: string | null
          rate_currency: string | null
          rate_notes: string | null
          rate_per_session: number | null
          rating: number | null
          review_count: number | null
          school_id: string
          secondary_sports: string[] | null
          specialties: string[] | null
          tagline: string | null
          updated_at: string | null
          user_id: string
          whatsapp_number: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          certifications?: Json | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          display_name?: string | null
          experience_years?: number | null
          gallery_urls?: string[] | null
          id?: string
          instagram_url?: string | null
          is_published?: boolean | null
          lat?: number | null
          lng?: number | null
          modality?: string | null
          primary_sport?: string | null
          rate_currency?: string | null
          rate_notes?: string | null
          rate_per_session?: number | null
          rating?: number | null
          review_count?: number | null
          school_id: string
          secondary_sports?: string[] | null
          specialties?: string[] | null
          tagline?: string | null
          updated_at?: string | null
          user_id: string
          whatsapp_number?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          bio?: string | null
          certifications?: Json | null
          city?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          display_name?: string | null
          experience_years?: number | null
          gallery_urls?: string[] | null
          id?: string
          instagram_url?: string | null
          is_published?: boolean | null
          lat?: number | null
          lng?: number | null
          modality?: string | null
          primary_sport?: string | null
          rate_currency?: string | null
          rate_notes?: string | null
          rate_per_session?: number | null
          rating?: number | null
          review_count?: number | null
          school_id?: string
          secondary_sports?: string[] | null
          specialties?: string[] | null
          tagline?: string | null
          updated_at?: string | null
          user_id?: string
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainer_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "trainer_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      trainer_routines: {
        Row: {
          blocks: Json | null
          category: string | null
          cooldown: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty: string | null
          estimated_calories: number | null
          estimated_minutes: number | null
          id: string
          is_template: boolean | null
          name: string
          routine_type: string
          school_id: string | null
          scope: string
          tags: string[] | null
          times_used: number | null
          trainer_id: string
          updated_at: string | null
          visible_to_athletes: boolean
          warmup: string | null
        }
        Insert: {
          blocks?: Json | null
          category?: string | null
          cooldown?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          estimated_calories?: number | null
          estimated_minutes?: number | null
          id?: string
          is_template?: boolean | null
          name: string
          routine_type?: string
          school_id?: string | null
          scope?: string
          tags?: string[] | null
          times_used?: number | null
          trainer_id: string
          updated_at?: string | null
          visible_to_athletes?: boolean
          warmup?: string | null
        }
        Update: {
          blocks?: Json | null
          category?: string | null
          cooldown?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          estimated_calories?: number | null
          estimated_minutes?: number | null
          id?: string
          is_template?: boolean | null
          name?: string
          routine_type?: string
          school_id?: string | null
          scope?: string
          tags?: string[] | null
          times_used?: number | null
          trainer_id?: string
          updated_at?: string | null
          visible_to_athletes?: boolean
          warmup?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainer_routines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "trainer_routines_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_routines_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "trainer_routines_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_routines_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_routines_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_routines_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_routines_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      trainer_session_plans: {
        Row: {
          assignment_source: string
          blocks: Json | null
          booked_at: string | null
          booked_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_by_role: string | null
          client_id: string
          client_type: string
          completed_at: string | null
          created_at: string | null
          custom_notes: string | null
          enrollment_id: string | null
          execution_progress: Json | null
          id: string
          name: string | null
          results: Json | null
          routine_id: string | null
          school_id: string
          session_date: string
          session_time: string | null
          session_type: string | null
          status: string | null
          trainer_feedback: Json | null
          trainer_id: string
          updated_at: string | null
          visible_from: string | null
        }
        Insert: {
          assignment_source?: string
          blocks?: Json | null
          booked_at?: string | null
          booked_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          client_id: string
          client_type: string
          completed_at?: string | null
          created_at?: string | null
          custom_notes?: string | null
          enrollment_id?: string | null
          execution_progress?: Json | null
          id?: string
          name?: string | null
          results?: Json | null
          routine_id?: string | null
          school_id: string
          session_date: string
          session_time?: string | null
          session_type?: string | null
          status?: string | null
          trainer_feedback?: Json | null
          trainer_id: string
          updated_at?: string | null
          visible_from?: string | null
        }
        Update: {
          assignment_source?: string
          blocks?: Json | null
          booked_at?: string | null
          booked_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_by_role?: string | null
          client_id?: string
          client_type?: string
          completed_at?: string | null
          created_at?: string | null
          custom_notes?: string | null
          enrollment_id?: string | null
          execution_progress?: Json | null
          id?: string
          name?: string | null
          results?: Json | null
          routine_id?: string | null
          school_id?: string
          session_date?: string
          session_time?: string | null
          session_type?: string | null
          status?: string | null
          trainer_feedback?: Json | null
          trainer_id?: string
          updated_at?: string | null
          visible_from?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trainer_session_plans_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "trainer_session_plans_cancelled_by_fkey"
            columns: ["cancelled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_session_plans_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_session_plans_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "trainer_session_plans_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "trainer_routines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_session_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "trainer_session_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_session_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_session_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_session_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trainer_session_plans_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "training_logs_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_mesocycle_evaluations: {
        Row: {
          checkpoint: string
          created_at: string
          created_by: string
          id: string
          indicator: string
          mesocycle_id: string
          observations: string | null
          school_id: string
          score: number
          updated_at: string
        }
        Insert: {
          checkpoint: string
          created_at?: string
          created_by: string
          id?: string
          indicator: string
          mesocycle_id: string
          observations?: string | null
          school_id: string
          score: number
          updated_at?: string
        }
        Update: {
          checkpoint?: string
          created_at?: string
          created_by?: string
          id?: string
          indicator?: string
          mesocycle_id?: string
          observations?: string | null
          school_id?: string
          score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_mesocycle_evaluations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "training_mesocycle_evaluations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_mesocycle_evaluations_mesocycle_id_fkey"
            columns: ["mesocycle_id"]
            isOneToOne: false
            referencedRelation: "training_mesocycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_mesocycle_evaluations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "training_mesocycle_evaluations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_mesocycle_evaluations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_mesocycle_evaluations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_mesocycle_evaluations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_mesocycle_evaluations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      training_mesocycles: {
        Row: {
          closing_review: Json | null
          created_at: string
          created_by: string
          ends_on: string
          evaluation_mode: string
          game_model: string | null
          general_objective: string | null
          id: string
          n_sessions_planned: number | null
          school_id: string
          session_duration_minutes: number | null
          starts_on: string
          team_id: string
          updated_at: string
        }
        Insert: {
          closing_review?: Json | null
          created_at?: string
          created_by: string
          ends_on: string
          evaluation_mode?: string
          game_model?: string | null
          general_objective?: string | null
          id?: string
          n_sessions_planned?: number | null
          school_id: string
          session_duration_minutes?: number | null
          starts_on: string
          team_id: string
          updated_at?: string
        }
        Update: {
          closing_review?: Json | null
          created_at?: string
          created_by?: string
          ends_on?: string
          evaluation_mode?: string
          game_model?: string | null
          general_objective?: string | null
          id?: string
          n_sessions_planned?: number | null
          school_id?: string
          session_duration_minutes?: number | null
          starts_on?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_mesocycles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "training_mesocycles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_mesocycles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "training_mesocycles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_mesocycles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_mesocycles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_mesocycles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_mesocycles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "training_mesocycles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "training_mesocycles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_mesocycles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "training_mesocycles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
        ]
      }
      training_microcycle_days: {
        Row: {
          created_at: string
          day_date: string
          day_type: string
          focus: string | null
          id: string
          microcycle_id: string
          planned_minutes: number | null
          planned_rpe: number | null
          school_id: string
          session_id: string | null
          tournament_match_id: string | null
        }
        Insert: {
          created_at?: string
          day_date: string
          day_type: string
          focus?: string | null
          id?: string
          microcycle_id: string
          planned_minutes?: number | null
          planned_rpe?: number | null
          school_id: string
          session_id?: string | null
          tournament_match_id?: string | null
        }
        Update: {
          created_at?: string
          day_date?: string
          day_type?: string
          focus?: string | null
          id?: string
          microcycle_id?: string
          planned_minutes?: number | null
          planned_rpe?: number | null
          school_id?: string
          session_id?: string | null
          tournament_match_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_microcycle_days_microcycle_id_fkey"
            columns: ["microcycle_id"]
            isOneToOne: false
            referencedRelation: "training_microcycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_microcycle_days_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "training_microcycle_days_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_microcycle_days_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_microcycle_days_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_microcycle_days_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_microcycle_days_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "training_microcycle_days_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "training_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_microcycle_days_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_coach_team_plans"
            referencedColumns: ["plan_id"]
          },
          {
            foreignKeyName: "training_microcycle_days_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "v_session_load"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "training_microcycle_days_tournament_match_id_fkey"
            columns: ["tournament_match_id"]
            isOneToOne: false
            referencedRelation: "tournament_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      training_microcycles: {
        Row: {
          collective_performance: string | null
          created_at: string
          created_by: string
          ends_on: string
          id: string
          improvement_notes: string | null
          mesocycle_id: string | null
          number: number | null
          objective: string | null
          objective_compliance: string | null
          school_id: string
          starts_on: string
          team_id: string
          updated_at: string
        }
        Insert: {
          collective_performance?: string | null
          created_at?: string
          created_by: string
          ends_on: string
          id?: string
          improvement_notes?: string | null
          mesocycle_id?: string | null
          number?: number | null
          objective?: string | null
          objective_compliance?: string | null
          school_id: string
          starts_on: string
          team_id: string
          updated_at?: string
        }
        Update: {
          collective_performance?: string | null
          created_at?: string
          created_by?: string
          ends_on?: string
          id?: string
          improvement_notes?: string | null
          mesocycle_id?: string | null
          number?: number | null
          objective?: string | null
          objective_compliance?: string | null
          school_id?: string
          starts_on?: string
          team_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_microcycles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "training_microcycles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_microcycles_mesocycle_id_fkey"
            columns: ["mesocycle_id"]
            isOneToOne: false
            referencedRelation: "training_mesocycles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_microcycles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "training_microcycles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_microcycles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_microcycles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_microcycles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_microcycles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "training_microcycles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "training_microcycles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_microcycles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "training_microcycles_team_id_fkey"
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
          drills: Json | null
          evaluation: Json | null
          game_principles: string | null
          id: string
          materials: string | null
          notes: string | null
          objectives: string
          session_blocks: Json | null
          session_date: string
          team_id: string
          updated_at: string
          warmup: string | null
        }
        Insert: {
          created_at?: string
          drills?: Json | null
          evaluation?: Json | null
          game_principles?: string | null
          id?: string
          materials?: string | null
          notes?: string | null
          objectives: string
          session_blocks?: Json | null
          session_date: string
          team_id: string
          updated_at?: string
          warmup?: string | null
        }
        Update: {
          created_at?: string
          drills?: Json | null
          evaluation?: Json | null
          game_principles?: string | null
          id?: string
          materials?: string | null
          notes?: string | null
          objectives?: string
          session_blocks?: Json | null
          session_date?: string
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
      training_slots: {
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
      trial_class_bookings: {
        Row: {
          attendance_session_id: string | null
          cancel_reason: string | null
          category_id: string
          child_id: string | null
          child_name: string | null
          coach_id: string
          confirmation_email_sent_at: string | null
          created_at: string
          created_by: string | null
          end_time: string
          enrollment_id: string | null
          facility_id: string
          id: string
          is_minor: boolean
          price_charged: number
          prospect_email: string
          prospect_name: string
          prospect_whatsapp: string
          scheduled_date: string
          school_id: string
          start_time: string
          status: string
          unregistered_athlete_id: string | null
          updated_at: string
          user_id: string | null
          whatsapp_message: string | null
        }
        Insert: {
          attendance_session_id?: string | null
          cancel_reason?: string | null
          category_id: string
          child_id?: string | null
          child_name?: string | null
          coach_id: string
          confirmation_email_sent_at?: string | null
          created_at?: string
          created_by?: string | null
          end_time: string
          enrollment_id?: string | null
          facility_id: string
          id?: string
          is_minor?: boolean
          price_charged?: number
          prospect_email: string
          prospect_name: string
          prospect_whatsapp: string
          scheduled_date: string
          school_id: string
          start_time: string
          status?: string
          unregistered_athlete_id?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_message?: string | null
        }
        Update: {
          attendance_session_id?: string | null
          cancel_reason?: string | null
          category_id?: string
          child_id?: string | null
          child_name?: string | null
          coach_id?: string
          confirmation_email_sent_at?: string | null
          created_at?: string
          created_by?: string | null
          end_time?: string
          enrollment_id?: string | null
          facility_id?: string
          id?: string
          is_minor?: boolean
          price_charged?: number
          prospect_email?: string
          prospect_name?: string
          prospect_whatsapp?: string
          scheduled_date?: string
          school_id?: string
          start_time?: string
          status?: string
          unregistered_athlete_id?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trial_class_bookings_attendance_session_id_fkey"
            columns: ["attendance_session_id"]
            isOneToOne: false
            referencedRelation: "attendance_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_bookings_attendance_session_id_fkey"
            columns: ["attendance_session_id"]
            isOneToOne: false
            referencedRelation: "poll_sessions_summary"
            referencedColumns: ["session_id"]
          },
          {
            foreignKeyName: "trial_class_bookings_attendance_session_id_fkey"
            columns: ["attendance_session_id"]
            isOneToOne: false
            referencedRelation: "v_bookable_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_bookings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "trial_class_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_bookings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_bookings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_bookings_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "trial_class_bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "public_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "school_staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_coach_team_plans"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "trial_class_bookings_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_school_staff_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "trial_class_bookings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_bookings_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_bookings_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["enrollment_id"]
          },
          {
            foreignKeyName: "trial_class_bookings_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "trial_class_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_bookings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "trial_class_bookings_unregistered_athlete_id_fkey"
            columns: ["unregistered_athlete_id"]
            isOneToOne: false
            referencedRelation: "unregistered_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "trial_class_bookings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_class_categories: {
        Row: {
          allow_repeat: boolean
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          offering_plan_id: string | null
          price: number
          repeat_price: number | null
          school_id: string
          updated_at: string
        }
        Insert: {
          allow_repeat?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          offering_plan_id?: string | null
          price?: number
          repeat_price?: number | null
          school_id: string
          updated_at?: string
        }
        Update: {
          allow_repeat?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          offering_plan_id?: string | null
          price?: number
          repeat_price?: number | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trial_class_categories_offering_plan_id_fkey"
            columns: ["offering_plan_id"]
            isOneToOne: false
            referencedRelation: "offering_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "trial_class_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trial_class_categories_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      turnstile_devices: {
        Row: {
          brand: string
          created_at: string | null
          device_name: string
          direction: string
          door_drive_time_seconds: number
          has_local_bridge: boolean
          id: string
          ip_address: string | null
          ip_check_mode: string
          is_active: boolean | null
          last_alerted_at: string | null
          last_seen_at: string | null
          location: string | null
          metadata: Json | null
          port: number | null
          school_id: string
          serial_number: string
          updated_at: string | null
        }
        Insert: {
          brand?: string
          created_at?: string | null
          device_name: string
          direction: string
          door_drive_time_seconds?: number
          has_local_bridge?: boolean
          id?: string
          ip_address?: string | null
          ip_check_mode?: string
          is_active?: boolean | null
          last_alerted_at?: string | null
          last_seen_at?: string | null
          location?: string | null
          metadata?: Json | null
          port?: number | null
          school_id: string
          serial_number: string
          updated_at?: string | null
        }
        Update: {
          brand?: string
          created_at?: string | null
          device_name?: string
          direction?: string
          door_drive_time_seconds?: number
          has_local_bridge?: boolean
          id?: string
          ip_address?: string | null
          ip_check_mode?: string
          is_active?: boolean | null
          last_alerted_at?: string | null
          last_seen_at?: string | null
          location?: string | null
          metadata?: Json | null
          port?: number | null
          school_id?: string
          serial_number?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turnstile_devices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "turnstile_devices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnstile_devices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnstile_devices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnstile_devices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "turnstile_devices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      unregistered_athletes: {
        Row: {
          avatar_url: string | null
          blood_type: string | null
          branch_id: string | null
          created_at: string
          date_of_birth: string | null
          doc_number: string | null
          doc_type: string | null
          email: string | null
          eps_name: string | null
          full_name: string
          gender: string | null
          guardian_email: string | null
          guardian_full_name: string | null
          guardian_phone: string | null
          health_screening: Json
          id: string
          intake_form_data: Json
          invitation_id: string | null
          is_active: boolean
          linked_profile_id: string | null
          phone: string | null
          poll_token: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          blood_type?: string | null
          branch_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          eps_name?: string | null
          full_name: string
          gender?: string | null
          guardian_email?: string | null
          guardian_full_name?: string | null
          guardian_phone?: string | null
          health_screening?: Json
          id?: string
          intake_form_data?: Json
          invitation_id?: string | null
          is_active?: boolean
          linked_profile_id?: string | null
          phone?: string | null
          poll_token?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          blood_type?: string | null
          branch_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          doc_number?: string | null
          doc_type?: string | null
          email?: string | null
          eps_name?: string | null
          full_name?: string
          gender?: string | null
          guardian_email?: string | null
          guardian_full_name?: string | null
          guardian_phone?: string | null
          health_screening?: Json
          id?: string
          intake_form_data?: Json
          invitation_id?: string | null
          is_active?: boolean
          linked_profile_id?: string | null
          phone?: string | null
          poll_token?: string | null
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "unregistered_athletes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      user_devices: {
        Row: {
          app_version: string | null
          created_at: string
          device_id: string
          device_model: string | null
          display_mode: string | null
          first_seen_at: string
          id: string
          install_tenant_slug: string | null
          installed_at: string | null
          last_seen_at: string
          last_standalone_at: string | null
          locale: string | null
          os_version: string | null
          platform: string
          push_provider: string | null
          push_token: string | null
          revoked_at: string | null
          revoked_reason: string | null
          timezone: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          device_id: string
          device_model?: string | null
          display_mode?: string | null
          first_seen_at?: string
          id?: string
          install_tenant_slug?: string | null
          installed_at?: string | null
          last_seen_at?: string
          last_standalone_at?: string | null
          locale?: string | null
          os_version?: string | null
          platform: string
          push_provider?: string | null
          push_token?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          timezone?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          app_version?: string | null
          created_at?: string
          device_id?: string
          device_model?: string | null
          display_mode?: string | null
          first_seen_at?: string
          id?: string
          install_tenant_slug?: string | null
          installed_at?: string | null
          last_seen_at?: string
          last_standalone_at?: string | null
          locale?: string | null
          os_version?: string | null
          platform?: string
          push_provider?: string | null
          push_token?: string | null
          revoked_at?: string | null
          revoked_reason?: string | null
          timezone?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
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
          {
            foreignKeyName: "user_favorites_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
      vendor_balances: {
        Row: {
          available_balance: number
          id: string
          pending_balance: number
          total_earned: number
          total_fees: number
          total_withdrawn: number
          updated_at: string
          vendor_profile_id: string
        }
        Insert: {
          available_balance?: number
          id?: string
          pending_balance?: number
          total_earned?: number
          total_fees?: number
          total_withdrawn?: number
          updated_at?: string
          vendor_profile_id: string
        }
        Update: {
          available_balance?: number
          id?: string
          pending_balance?: number
          total_earned?: number
          total_fees?: number
          total_withdrawn?: number
          updated_at?: string
          vendor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_balances_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: true
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_bank_accounts: {
        Row: {
          account_holder: string
          account_number: string
          account_type: string
          bank_name: string
          created_at: string
          document_number: string
          document_type: string
          email: string | null
          id: string
          is_active: boolean
          is_default: boolean
          phone: string | null
          updated_at: string
          vendor_profile_id: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          account_holder: string
          account_number: string
          account_type: string
          bank_name: string
          created_at?: string
          document_number: string
          document_type: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          phone?: string | null
          updated_at?: string
          vendor_profile_id: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          account_holder?: string
          account_number?: string
          account_type?: string
          bank_name?: string
          created_at?: string
          document_number?: string
          document_type?: string
          email?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          phone?: string | null
          updated_at?: string
          vendor_profile_id?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_bank_accounts_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_payment_providers: {
        Row: {
          access_token: string
          created_at: string
          enabled: boolean
          id: string
          integrity_secret: string | null
          is_default: boolean
          provider: Database["public"]["Enums"]["payment_provider"]
          public_key: string
          sandbox: boolean
          updated_at: string
          vendor_id: string
          webhook_secret: string | null
        }
        Insert: {
          access_token: string
          created_at?: string
          enabled?: boolean
          id?: string
          integrity_secret?: string | null
          is_default?: boolean
          provider: Database["public"]["Enums"]["payment_provider"]
          public_key: string
          sandbox?: boolean
          updated_at?: string
          vendor_id: string
          webhook_secret?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          enabled?: boolean
          id?: string
          integrity_secret?: string | null
          is_default?: boolean
          provider?: Database["public"]["Enums"]["payment_provider"]
          public_key?: string
          sandbox?: boolean
          updated_at?: string
          vendor_id?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      vendor_payouts: {
        Row: {
          bank_reference: string | null
          created_at: string
          currency: string
          gross_amount: number
          id: string
          net_amount: number
          notes: string | null
          order_id: string | null
          paid_at: string | null
          paid_by: string | null
          payment_provider:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          provider_fee: number | null
          scheduled_for: string | null
          sportmaps_fee: number
          status: string
          transaction_id: string | null
          updated_at: string
          vendor_id: string
          wompi_fee: number
        }
        Insert: {
          bank_reference?: string | null
          created_at?: string
          currency?: string
          gross_amount: number
          id?: string
          net_amount: number
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          provider_fee?: number | null
          scheduled_for?: string | null
          sportmaps_fee?: number
          status?: string
          transaction_id?: string | null
          updated_at?: string
          vendor_id: string
          wompi_fee?: number
        }
        Update: {
          bank_reference?: string | null
          created_at?: string
          currency?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          order_id?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment_provider?:
            | Database["public"]["Enums"]["payment_provider"]
            | null
          provider_fee?: number | null
          scheduled_for?: string | null
          sportmaps_fee?: number
          status?: string
          transaction_id?: string | null
          updated_at?: string
          vendor_id?: string
          wompi_fee?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendor_payouts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "my_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_payouts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_profiles: {
        Row: {
          address: string | null
          avg_rating: number | null
          avg_response_hours: number | null
          bank_data: Json
          capabilities: Json
          city: string | null
          commission_rate: number
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_name: string
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          metadata: Json
          nit: string | null
          payment_methods: Json
          phone: string | null
          response_rate: number | null
          reviews_count: number
          slug: string | null
          updated_at: string
          user_id: string
          vendor_type: Database["public"]["Enums"]["vendor_type"]
          verification_doc_url: string | null
          verification_status: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          avg_rating?: number | null
          avg_response_hours?: number | null
          bank_data?: Json
          capabilities?: Json
          city?: string | null
          commission_rate?: number
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_name: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          metadata?: Json
          nit?: string | null
          payment_methods?: Json
          phone?: string | null
          response_rate?: number | null
          reviews_count?: number
          slug?: string | null
          updated_at?: string
          user_id: string
          vendor_type: Database["public"]["Enums"]["vendor_type"]
          verification_doc_url?: string | null
          verification_status?: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          avg_rating?: number | null
          avg_response_hours?: number | null
          bank_data?: Json
          capabilities?: Json
          city?: string | null
          commission_rate?: number
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          display_name?: string
          email?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          metadata?: Json
          nit?: string | null
          payment_methods?: Json
          phone?: string | null
          response_rate?: number | null
          reviews_count?: number
          slug?: string | null
          updated_at?: string
          user_id?: string
          vendor_type?: Database["public"]["Enums"]["vendor_type"]
          verification_doc_url?: string | null
          verification_status?: string
          website_url?: string | null
        }
        Relationships: []
      }
      vendor_reviews: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_verified: boolean
          order_id: string | null
          rating: number
          service_rating: number | null
          shipping_rating: number | null
          status: string
          updated_at: string
          user_id: string
          vendor_profile_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean
          order_id?: string | null
          rating: number
          service_rating?: number | null
          shipping_rating?: number | null
          status?: string
          updated_at?: string
          user_id: string
          vendor_profile_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_verified?: boolean
          order_id?: string | null
          rating?: number
          service_rating?: number | null
          shipping_rating?: number | null
          status?: string
          updated_at?: string
          user_id?: string
          vendor_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "my_orders_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_reviews_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_events: {
        Row: {
          attempts: number
          created_at: string
          event_id: string
          event_type: string | null
          id: string
          last_error: string | null
          next_retry_at: string | null
          payload: Json | null
          processed_at: string | null
          provider: string
          reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event_id: string
          event_type?: string | null
          id?: string
          last_error?: string | null
          next_retry_at?: string | null
          payload?: Json | null
          processed_at?: string | null
          provider: string
          reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event_id?: string
          event_type?: string | null
          id?: string
          last_error?: string | null
          next_retry_at?: string | null
          payload?: Json | null
          processed_at?: string | null
          provider?: string
          reference?: string | null
          status?: string
          updated_at?: string
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
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
          follow_up_date: string | null
          health_record_id: string | null
          id: string
          metrics: Json
          notes: string | null
          professional_id: string | null
          recommendations: string | null
          score: number | null
          status: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          athlete_id?: string | null
          created_at?: string | null
          date: string
          follow_up_date?: string | null
          health_record_id?: string | null
          id?: string
          metrics?: Json
          notes?: string | null
          professional_id?: string | null
          recommendations?: string | null
          score?: number | null
          status?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string | null
          created_at?: string | null
          date?: string
          follow_up_date?: string | null
          health_record_id?: string | null
          id?: string
          metrics?: Json
          notes?: string | null
          professional_id?: string | null
          recommendations?: string | null
          score?: number | null
          status?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wellness_evaluations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "wellness_evaluations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wellness_evaluations_health_record_id_fkey"
            columns: ["health_record_id"]
            isOneToOne: false
            referencedRelation: "health_records"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_blocked_numbers: {
        Row: {
          blocked_by: string | null
          contact_wa_id: string
          created_at: string
          id: string
          integration_id: string | null
          reason: string | null
        }
        Insert: {
          blocked_by?: string | null
          contact_wa_id: string
          created_at?: string
          id?: string
          integration_id?: string | null
          reason?: string | null
        }
        Update: {
          blocked_by?: string | null
          contact_wa_id?: string
          created_at?: string
          id?: string
          integration_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_blocked_numbers_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "school_whatsapp_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          contact_name: string | null
          contact_wa_id: string
          created_at: string
          id: string
          identified: boolean
          integration_id: string
          last_inbound_at: string | null
          last_message_at: string | null
          parent_id: string | null
          school_id: string
          status: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          contact_name?: string | null
          contact_wa_id: string
          created_at?: string
          id?: string
          identified?: boolean
          integration_id: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          parent_id?: string | null
          school_id: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          contact_name?: string | null
          contact_wa_id?: string
          created_at?: string
          id?: string
          identified?: boolean
          integration_id?: string
          last_inbound_at?: string | null
          last_message_at?: string | null
          parent_id?: string | null
          school_id?: string
          status?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "school_whatsapp_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_conversations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      whatsapp_identifications: {
        Row: {
          attempts: number
          contact_wa_id: string
          created_at: string
          email: string | null
          id: string
          integration_id: string
          otp_expires_at: string | null
          otp_hash: string | null
          parent_id: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          attempts?: number
          contact_wa_id: string
          created_at?: string
          email?: string | null
          id?: string
          integration_id: string
          otp_expires_at?: string | null
          otp_hash?: string | null
          parent_id?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          attempts?: number
          contact_wa_id?: string
          created_at?: string
          email?: string | null
          id?: string
          integration_id?: string
          otp_expires_at?: string | null
          otp_hash?: string | null
          parent_id?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_identifications_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "school_whatsapp_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_identifications_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "whatsapp_identifications_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_inbound_queue: {
        Row: {
          created_at: string
          detected_intent: string | null
          error_message: string | null
          id: string
          matched_child_id: string | null
          matched_parent_id: string | null
          media_caption: string | null
          media_mime_type: string | null
          media_url: string | null
          message_type: string
          processed_at: string | null
          result_ref_id: string | null
          result_type: string | null
          retries: number
          school_id: string | null
          status: string
          text_body: string | null
          updated_at: string
          wa_message_id: string | null
          wa_phone_number: string
          wa_timestamp: string | null
        }
        Insert: {
          created_at?: string
          detected_intent?: string | null
          error_message?: string | null
          id?: string
          matched_child_id?: string | null
          matched_parent_id?: string | null
          media_caption?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type: string
          processed_at?: string | null
          result_ref_id?: string | null
          result_type?: string | null
          retries?: number
          school_id?: string | null
          status?: string
          text_body?: string | null
          updated_at?: string
          wa_message_id?: string | null
          wa_phone_number: string
          wa_timestamp?: string | null
        }
        Update: {
          created_at?: string
          detected_intent?: string | null
          error_message?: string | null
          id?: string
          matched_child_id?: string | null
          matched_parent_id?: string | null
          media_caption?: string | null
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          processed_at?: string | null
          result_ref_id?: string | null
          result_type?: string | null
          retries?: number
          school_id?: string | null
          status?: string
          text_body?: string | null
          updated_at?: string
          wa_message_id?: string | null
          wa_phone_number?: string
          wa_timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_inbound_queue_matched_child_id_fkey"
            columns: ["matched_child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_queue_matched_child_id_fkey"
            columns: ["matched_child_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_queue_matched_child_id_fkey"
            columns: ["matched_child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_queue_matched_parent_id_fkey"
            columns: ["matched_parent_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_queue_matched_parent_id_fkey"
            columns: ["matched_parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_queue_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_queue_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_queue_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_queue_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_queue_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_inbound_queue_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      whatsapp_message_drafts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          conversation_id: string
          created_at: string
          edited_text: string | null
          id: string
          integration_id: string
          llm_provider: string | null
          proposed_text: string
          sent_at: string | null
          status: string
          tool_context: Json | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          conversation_id: string
          created_at?: string
          edited_text?: string | null
          id?: string
          integration_id: string
          llm_provider?: string | null
          proposed_text: string
          sent_at?: string | null
          status?: string
          tool_context?: Json | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          conversation_id?: string
          created_at?: string
          edited_text?: string | null
          id?: string
          integration_id?: string
          llm_provider?: string | null
          proposed_text?: string
          sent_at?: string | null
          status?: string
          tool_context?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_drafts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_message_drafts_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "school_whatsapp_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          ai_generated: boolean
          conversation_id: string
          created_at: string
          direction: string
          error_detail: string | null
          from_wa_id: string | null
          id: string
          integration_id: string
          payload: Json | null
          status: string
          text_body: string | null
          to_wa_id: string | null
          type: string
          wa_message_id: string | null
          wa_timestamp: string | null
        }
        Insert: {
          ai_generated?: boolean
          conversation_id: string
          created_at?: string
          direction: string
          error_detail?: string | null
          from_wa_id?: string | null
          id?: string
          integration_id: string
          payload?: Json | null
          status?: string
          text_body?: string | null
          to_wa_id?: string | null
          type?: string
          wa_message_id?: string | null
          wa_timestamp?: string | null
        }
        Update: {
          ai_generated?: boolean
          conversation_id?: string
          created_at?: string
          direction?: string
          error_detail?: string | null
          from_wa_id?: string | null
          id?: string
          integration_id?: string
          payload?: Json | null
          status?: string
          text_body?: string | null
          to_wa_id?: string | null
          type?: string
          wa_message_id?: string | null
          wa_timestamp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "school_whatsapp_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          ai_enabled: boolean
          assisted_until: string | null
          business_hours: Json | null
          created_at: string
          default_locale: string
          id: string
          integration_id: string
          mode: string
          updated_at: string
          welcome_message: string | null
        }
        Insert: {
          ai_enabled?: boolean
          assisted_until?: string | null
          business_hours?: Json | null
          created_at?: string
          default_locale?: string
          id?: string
          integration_id: string
          mode?: string
          updated_at?: string
          welcome_message?: string | null
        }
        Update: {
          ai_enabled?: boolean
          assisted_until?: string | null
          business_hours?: Json | null
          created_at?: string
          default_locale?: string
          id?: string
          integration_id?: string
          mode?: string
          updated_at?: string
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_settings_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: true
            referencedRelation: "school_whatsapp_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      zk_user_mappings: {
        Row: {
          created_at: string | null
          id: string
          school_id: string
          unregistered_athlete_id: string | null
          user_id: string | null
          zk_pin: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          school_id: string
          unregistered_athlete_id?: string | null
          user_id?: string | null
          zk_pin: number
        }
        Update: {
          created_at?: string | null
          id?: string
          school_id?: string
          unregistered_athlete_id?: string | null
          user_id?: string | null
          zk_pin?: number
        }
        Relationships: [
          {
            foreignKeyName: "zk_user_mappings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "zk_user_mappings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zk_user_mappings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zk_user_mappings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zk_user_mappings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zk_user_mappings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "zk_user_mappings_unregistered_athlete_id_fkey"
            columns: ["unregistered_athlete_id"]
            isOneToOne: false
            referencedRelation: "unregistered_athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zk_user_mappings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "zk_user_mappings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      blocked_payments_view: {
        Row: {
          created_at: string | null
          gross_amount: number | null
          id: string | null
          kind: string | null
          last_failure_at: string | null
          last_failure_reason: string | null
          user_id: string | null
        }
        Relationships: []
      }
      cash_ledger: {
        Row: {
          amount: number | null
          branch_id: string | null
          category_id: string | null
          concept: string | null
          direction: string | null
          id: string | null
          movement_date: string | null
          owner_id: string | null
          owner_type: string | null
          payment_category: string | null
          school_id: string | null
          source: string | null
          status: string | null
        }
        Relationships: []
      }
      class_capacity: {
        Row: {
          class_id: string | null
          current_enrollment: number | null
          max_capacity: number | null
          spots_available: number | null
        }
        Relationships: []
      }
      mv_session_health: {
        Row: {
          finalized: number | null
          oldest_stale: string | null
          pending: number | null
          refreshed_at: string | null
          school_id: string | null
          school_name: string | null
          stale: number | null
          today: number | null
          total_sessions: number | null
          upcoming: number | null
        }
        Relationships: []
      }
      my_orders_view: {
        Row: {
          carrier: string | null
          contact_email: string | null
          contact_phone: string | null
          created_at: string | null
          customer_name: string | null
          id: string | null
          items: Json | null
          notes: string | null
          paid_at: string | null
          payment_method: string | null
          shipping_address: Json | null
          shipping_cost: number | null
          status: string | null
          tax_total: number | null
          total_amount: number | null
          tracking_number: string | null
          updated_at: string | null
          user_id: string | null
          vendor_id: string | null
          wompi_reference: string | null
        }
        Insert: {
          carrier?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_name?: string | null
          id?: string | null
          items?: never
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          status?: string | null
          tax_total?: number | null
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string | null
          vendor_id?: string | null
          wompi_reference?: string | null
        }
        Update: {
          carrier?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string | null
          customer_name?: string | null
          id?: string | null
          items?: never
          notes?: string | null
          paid_at?: string | null
          payment_method?: string | null
          shipping_address?: Json | null
          shipping_cost?: number | null
          status?: string | null
          tax_total?: number | null
          total_amount?: number | null
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string | null
          vendor_id?: string | null
          wompi_reference?: string | null
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
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
            foreignKeyName: "payments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "payments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
      pending_athletes: {
        Row: {
          email: string | null
          full_name: string | null
          member_id: string | null
          member_status: string | null
          phone: string | null
          profile_id: string | null
          registered_at: string | null
          school_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "school_members_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
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
            foreignKeyName: "payments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "payments_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
      poll_sessions_summary: {
        Row: {
          confirmed_count: number | null
          current_bookings: number | null
          end_time: string | null
          guest_count: number | null
          max_capacity: number | null
          poll_date: string | null
          poll_id: string | null
          poll_status: string | null
          poll_title: string | null
          registered_count: number | null
          school_id: string | null
          session_id: string | null
          session_title: string | null
          start_time: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_polls_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
          {
            foreignKeyName: "attendance_polls_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_detail_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_polls_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_price_range"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_polls_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_public_profile"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_polls_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_polls_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "school_staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
          enrollment_start_date: string | null
          enrollment_status: string | null
          expires_at: string | null
          fee_is_manual: boolean | null
          fee_reason: string | null
          full_name: string | null
          id: string | null
          is_active: boolean | null
          medical_info: string | null
          offering_plan_id: string | null
          parent_email: string | null
          parent_id: string | null
          parent_name: string | null
          parent_phone: string | null
          payment_due_date: string | null
          payment_status: string | null
          plan_monthly_fee: number | null
          plan_name: string | null
          plan_start_date: string | null
          price_monthly: number | null
          school_id: string | null
          secondary_sessions_used: number | null
          sessions_used: number | null
          team_id: string | null
          team_monthly_fee: number | null
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
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
            foreignKeyName: "reviews_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "children_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "teams_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_coach_team_plans"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "teams_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_school_staff_publico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "teams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      v_bookable_sessions: {
        Row: {
          available_for_personal_classes: boolean | null
          available_spots: number | null
          booking_status: string | null
          coach_id: string | null
          coach_name: string | null
          current_bookings: number | null
          end_time: string | null
          finalized: boolean | null
          id: string | null
          max_capacity: number | null
          offering_id: string | null
          requires_capacity_check: boolean | null
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
            foreignKeyName: "attendance_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_coach_team_plans"
            referencedColumns: ["staff_id"]
          },
          {
            foreignKeyName: "attendance_sessions_coach_id_fkey"
            columns: ["coach_id"]
            isOneToOne: false
            referencedRelation: "v_school_staff_publico"
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "attendance_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
      v_coach_team_plans: {
        Row: {
          coach_email: string | null
          coach_name: string | null
          coach_profile_id: string | null
          drills: Json | null
          materials: string | null
          notes: string | null
          objectives: string | null
          plan_created_at: string | null
          plan_date: string | null
          plan_id: string | null
          school_id: string | null
          school_name: string | null
          sport: string | null
          staff_id: string | null
          team_id: string | null
          team_name: string | null
          team_status: string | null
          warmup: string | null
        }
        Relationships: [
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
          {
            foreignKeyName: "teams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "teams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      v_document_compliance_report: {
        Row: {
          active_payment_id: string | null
          child_id: string | null
          child_name: string | null
          compliance_status: string | null
          doc_id: string | null
          doc_number: string | null
          doc_type: string | null
          doc_uploaded_at: string | null
          due_date: string | null
          file_url: string | null
          is_active: boolean | null
          ocr_confidence: number | null
          payment_amount: number | null
          payment_status: string | null
          rejection_reason: string | null
          school_id: string | null
          school_name: string | null
          upload_channel: string | null
          validation_status: string | null
          verified_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "children_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      v_payment_abonos_summary: {
        Row: {
          approved_installments: number | null
          auto_approved_count: number | null
          balance_pending: number | null
          child_id: string | null
          concept: string | null
          due_date: string | null
          last_installment_at: string | null
          paid_so_far: number | null
          parent_id: string | null
          payment_id: string | null
          payment_method: string | null
          payment_status: string | null
          payment_type: string | null
          pending_installments: number | null
          rejected_installments: number | null
          school_id: string | null
          total_abonado: number | null
          total_amount: number | null
          total_installments: number | null
          via_whatsapp: number | null
        }
        Relationships: [
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
            foreignKeyName: "payments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      v_payment_contacts: {
        Row: {
          amount: number | null
          athlete_name: string | null
          athlete_type: string | null
          child_id: string | null
          concept: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          due_date: string | null
          offering_plan_id: string | null
          parent_id: string | null
          payment_channel: string | null
          payment_id: string | null
          payment_method: string | null
          school_id: string | null
          status: string | null
          team_id: string | null
          unregistered_athlete_id: string | null
          user_id: string | null
        }
        Relationships: [
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
            foreignKeyName: "payments_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "v_document_compliance_report"
            referencedColumns: ["child_id"]
          },
          {
            foreignKeyName: "payments_offering_plan_id_fkey"
            columns: ["offering_plan_id"]
            isOneToOne: false
            referencedRelation: "offering_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
            foreignKeyName: "payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "pending_athletes"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      v_school_entitlements: {
        Row: {
          account_type: string | null
          billing_cycle: string | null
          blocking_exempt: boolean | null
          blocking_exempt_reason: string | null
          coach_can_create_athletes: boolean | null
          coach_can_create_teams: boolean | null
          current_period_end: string | null
          current_period_start: string | null
          has_academy: boolean | null
          has_access_control: boolean | null
          has_accounting: boolean | null
          has_billing: boolean | null
          has_biomech: boolean | null
          has_invoicing: boolean | null
          has_mp: boolean | null
          has_nutrition: boolean | null
          has_pwa_branding: boolean | null
          has_reservations: boolean | null
          has_store: boolean | null
          has_subscription_row: boolean | null
          has_tournaments: boolean | null
          has_wallet: boolean | null
          has_whatsapp: boolean | null
          has_whitelabel: boolean | null
          has_wompi: boolean | null
          is_operational: boolean | null
          module_overrides: Json | null
          parent_email_optional: boolean | null
          plan_code: string | null
          school_created_at: string | null
          school_id: string | null
          school_type: string | null
          subscription_status: string | null
          tier: string | null
          trial_ends_at: string | null
          trial_months: number | null
        }
        Relationships: []
      }
      v_school_settings_publico: {
        Row: {
          public_profile_enabled: boolean | null
          school_id: string | null
          show_facilities: boolean | null
          show_plans: boolean | null
          show_programs: boolean | null
        }
        Insert: {
          public_profile_enabled?: boolean | null
          school_id?: string | null
          show_facilities?: boolean | null
          show_plans?: boolean | null
          show_programs?: boolean | null
        }
        Update: {
          public_profile_enabled?: boolean | null
          school_id?: string | null
          show_facilities?: boolean | null
          show_plans?: boolean | null
          show_programs?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
          },
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
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      v_school_staff_publico: {
        Row: {
          branch_id: string | null
          certifications: string[] | null
          full_name: string | null
          id: string | null
          school_id: string | null
          specialty: string | null
        }
        Insert: {
          branch_id?: string | null
          certifications?: string[] | null
          full_name?: string | null
          id?: string | null
          school_id?: string | null
          specialty?: string | null
        }
        Update: {
          branch_id?: string | null
          certifications?: string[] | null
          full_name?: string | null
          id?: string | null
          school_id?: string | null
          specialty?: string | null
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
            referencedRelation: "mv_session_health"
            referencedColumns: ["school_id"]
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
          {
            foreignKeyName: "school_staff_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "v_school_entitlements"
            referencedColumns: ["school_id"]
          },
        ]
      }
      v_session_load: {
        Row: {
          load_ua: number | null
          rpe: number | null
          session_date: string | null
          session_id: string | null
          team_id: string | null
          total_minutes: number | null
        }
        Insert: {
          load_ua?: never
          rpe?: never
          session_date?: string | null
          session_id?: string | null
          team_id?: string | null
          total_minutes?: never
        }
        Update: {
          load_ua?: never
          rpe?: never
          session_date?: string | null
          session_id?: string | null
          team_id?: string | null
          total_minutes?: never
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
      vendor_shipments_summary: {
        Row: {
          avg_delivery_days: number | null
          delivered_count: number | null
          in_transit_count: number | null
          pending_count: number | null
          returned_count: number | null
          total: number | null
          vendor_profile_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _build_certificate_snapshot: {
        Args: {
          p_child_id: string
          p_profile_id: string
          p_school_id: string
          p_template_id: string
        }
        Returns: Json
      }
      _equipment_is_active_coach: {
        Args: { p_profile_id: string; p_school_id: string }
        Returns: boolean
      }
      _equipment_notify_admins: {
        Args: {
          p_link: string
          p_message: string
          p_school_id: string
          p_title: string
        }
        Returns: undefined
      }
      _equipment_set_acta_fields: {
        Args: { p_assignment_id: string }
        Returns: undefined
      }
      _glosa_actor_is_admin: {
        Args: { p_actor: string; p_school_id: string }
        Returns: boolean
      }
      _glosa_notify: {
        Args: {
          p_link: string
          p_message: string
          p_school_id: string
          p_title: string
          p_user_id: string
        }
        Returns: undefined
      }
      _next_certificate_folio: {
        Args: { p_school_id: string }
        Returns: string
      }
      _next_equipment_folio: { Args: { p_school_id: string }; Returns: string }
      _notify_school_staff: {
        Args: {
          p_category: string
          p_data: Json
          p_link: string
          p_message: string
          p_school_id: string
          p_title: string
          p_type: string
        }
        Returns: undefined
      }
      _order_belongs_to_user: { Args: { p_order_id: string }; Returns: boolean }
      _order_has_vendor_item: { Args: { p_order_id: string }; Returns: boolean }
      _payment_notif_data: {
        Args: {
          p_amount: number
          p_child_id: string
          p_parent_id: string
          p_school_id: string
          p_team_id: string
        }
        Returns: Json
      }
      _report_attended_subjects: {
        Args: { p_fin: string; p_inicio: string; p_school_id: string }
        Returns: {
          subject_id: string
          subject_type: string
        }[]
      }
      _report_scheduled_for: {
        Args: { p_month: number; p_send_day: number; p_year: number }
        Returns: string
      }
      _report_send_day: {
        Args: { p_school_id: string; p_team_id: string }
        Returns: number
      }
      accept_invitation: { Args: { p_invite_id: string }; Returns: boolean }
      accept_invitation_pro: { Args: { p_invite_id: string }; Returns: boolean }
      access_demo_link: {
        Args: { p_token: string }
        Returns: {
          archetype: string
          is_valid: boolean
          language: Json
          logo_url: string
          message: string
          primary_color: string
          school_name: string
          seed_config: Json
          tour_steps: Json
        }[]
      }
      add_custom_domain: {
        Args: { p_domain: string; p_school_id: string }
        Returns: Json
      }
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
      admin_activity_summary: {
        Args: { p_from?: string; p_to?: string }
        Returns: Json
      }
      admin_create_staff_direct: {
        Args: { p_branch_id: string; p_email: string; p_role: string }
        Returns: undefined
      }
      admin_expire_trial_now: { Args: { p_school_id: string }; Returns: Json }
      admin_extend_trial: {
        Args: { p_months: number; p_school_id: string }
        Returns: Json
      }
      admin_generate_pending_payouts: { Args: never; Returns: Json }
      admin_global_counts: { Args: never; Returns: Json }
      admin_list_analytics_events: {
        Args: {
          p_event_type?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_to?: string
          p_user_id?: string
        }
        Returns: Json
      }
      admin_list_audit_logs: {
        Args: {
          p_action?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_school_id?: string
          p_table?: string
          p_to?: string
        }
        Returns: Json
      }
      admin_list_billing_events: {
        Args: {
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_school_id?: string
          p_status?: string
          p_to?: string
        }
        Returns: Json
      }
      admin_list_enrollment_integrity_findings: {
        Args: { p_limit?: number; p_offset?: number; p_status?: string }
        Returns: Json
      }
      admin_list_event_telemetry: {
        Args: {
          p_event_id?: string
          p_event_type?: string
          p_from?: string
          p_limit?: number
          p_offset?: number
          p_to?: string
        }
        Returns: Json
      }
      admin_list_payments: {
        Args: {
          p_from?: string
          p_limit?: number
          p_method?: string
          p_offset?: number
          p_school_id?: string
          p_status?: string
          p_to?: string
        }
        Returns: Json
      }
      admin_list_schools_for_filter: { Args: never; Returns: Json }
      admin_list_schools_global: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_verified?: boolean
        }
        Returns: Json
      }
      admin_list_trials: {
        Args: {
          p_account_type?: string
          p_filtro?: string
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          account_type: string
          atletas_activos: number
          blocking_exempt: boolean
          blocking_exempt_reason: string
          created_at: string
          dias_restantes: number
          is_operational: boolean
          owner_email: string
          plan_code: string
          school_id: string
          school_name: string
          status: string
          total_rows: number
          trial_ends_at: string
          trial_months: number
        }[]
      }
      admin_list_users: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_role?: string
          p_search?: string
        }
        Returns: Json
      }
      admin_reactivate_school: {
        Args: { p_plan_code?: string; p_school_id: string }
        Returns: Json
      }
      admin_resolve_enrollment_integrity_finding: {
        Args: { p_finding_id: string; p_note?: string; p_status: string }
        Returns: Json
      }
      admin_run_enrollment_integrity_check: { Args: never; Returns: Json }
      admin_set_account_type: {
        Args: { p_account_type: string; p_school_id: string }
        Returns: Json
      }
      admin_set_billing_enabled: {
        Args: { p_enabled: boolean; p_school_id: string }
        Returns: Json
      }
      admin_set_blocking_exempt: {
        Args: { p_exempt: boolean; p_reason?: string; p_school_id: string }
        Returns: Json
      }
      admin_set_saas_billing_enabled: {
        Args: { p_enabled: boolean; p_school_id: string }
        Returns: Json
      }
      admin_set_school_addon: {
        Args: {
          p_addon_key: string
          p_enabled: boolean
          p_monthly_price_cents?: number
          p_school_id: string
        }
        Returns: Json
      }
      admin_set_school_custom_price: {
        Args: {
          p_billing_cycle?: string
          p_billing_emails?: string[]
          p_custom_price_cents: number
          p_period_start?: string
          p_school_id: string
        }
        Returns: Json
      }
      admin_set_school_module: {
        Args: { p_enabled: boolean; p_module_key: string; p_school_id: string }
        Returns: Json
      }
      admin_set_school_plan: {
        Args: { p_plan_code: string; p_school_id: string; p_status?: string }
        Returns: Json
      }
      admin_set_school_type: {
        Args: { p_school_id: string; p_school_type: string }
        Returns: Json
      }
      admin_set_trial: {
        Args: { p_ends_at?: string; p_months?: number; p_school_id: string }
        Returns: Json
      }
      alert_offline_access_devices: { Args: never; Returns: Json }
      apply_late_fees: { Args: never; Returns: Json }
      approve_refund: { Args: { p_refund_id: string }; Returns: Json }
      assign_registrants_to_teams: {
        Args: { p_assignments: Json; p_category_id: string; p_event_id: string }
        Returns: Json
      }
      auto_approve_payment: { Args: { p_payment_id: string }; Returns: boolean }
      auto_close_stale_hour_bank_visits: { Args: never; Returns: Json }
      auto_finalize_stale_sessions: {
        Args: never
        Returns: {
          school_count: number
          sessions_finalized: number
        }[]
      }
      buscar_menor_por_documento_publico: {
        Args: { p_doc_number: string; p_school_id: string }
        Returns: {
          already_linked: boolean
          branch_name: string
          child_id: string
          nombre: string
          school_id: string
          school_name: string
          team_name: string
        }[]
      }
      calculate_delegation_balance: {
        Args: { p_delegation_id: string }
        Returns: Json
      }
      can_admin_see_member_profile: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      can_manage_event: {
        Args: { p_event_id: string; p_uid?: string }
        Returns: boolean
      }
      can_manage_finances: {
        Args: { p_owner_id: string; p_owner_type: string }
        Returns: boolean
      }
      can_manage_reports: { Args: { p_school_id: string }; Returns: boolean }
      can_review_product: { Args: { p_product_id: string }; Returns: Json }
      can_view_enrollment: {
        Args: { p_enrollment_id: string }
        Returns: boolean
      }
      cancel_hour_bank_reservation: {
        Args: { p_reservation_id: string }
        Returns: Json
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
      claim_child_for_parent: {
        Args: { p_child_id: string; p_full_name?: string; p_phone?: string }
        Returns: {
          branch_id: string
          child_id: string
          school_id: string
          school_name: string
          status_code: string
          team_id: string
          team_name: string
        }[]
      }
      claim_children_by_document: {
        Args: {
          p_child_ids?: string[]
          p_doc_number: string
          p_full_name?: string
          p_phone?: string
        }
        Returns: Json
      }
      claim_due_recurring_subscriptions: {
        Args: { p_limit?: number }
        Returns: {
          amount: number
          child_id: string
          concept: string
          currency: string
          payment_provider: Database["public"]["Enums"]["payment_provider"]
          payment_token_id: string
          provider_card_id: string
          provider_customer_id: string
          provider_payment_source_id: number
          provider_token: string
          school_id: string
          subscription_id: string
          user_email: string
          user_id: string
        }[]
      }
      claim_member_for_plan: {
        Args: {
          p_child_id: string
          p_full_name?: string
          p_phone?: string
          p_plan_id: string
          p_role?: string
        }
        Returns: {
          branch_id: string
          child_id: string
          offering_plan_id: string
          plan_name: string
          school_id: string
          school_name: string
          status_code: string
        }[]
      }
      claim_orphan_children: { Args: { p_school_id?: string }; Returns: number }
      claim_tournament_invitation: { Args: { p_token: string }; Returns: Json }
      cleanup_expired_card_save_intents: { Args: never; Returns: number }
      close_cash_session: {
        Args: { p_closing_cash: number; p_notes?: string; p_session_id: string }
        Returns: {
          branch_id: string | null
          cash_difference: number | null
          closed_at: string | null
          closed_by: string | null
          closing_cash_declared: number | null
          created_at: string
          expected_cash: number | null
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_cash: number
          school_id: string
          status: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "cash_sessions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      close_month: {
        Args: {
          p_branch_id?: string
          p_month: number
          p_school_id: string
          p_year: number
        }
        Returns: Json
      }
      coach_can_see_report: { Args: { p_report_id: string }; Returns: boolean }
      coach_school_ids: { Args: never; Returns: string[] }
      coach_team_ids: { Args: never; Returns: string[] }
      complete_onboarding: { Args: never; Returns: undefined }
      complete_refund: {
        Args: {
          p_provider?: string
          p_refund_id: string
          p_wompi_void_id: string
        }
        Returns: Json
      }
      complete_role_selection: { Args: { p_role: string }; Returns: Json }
      compute_settlements_for_order: {
        Args: { p_order_id: string }
        Returns: Json
      }
      conciliate_glosa: {
        Args: { p_actor: string; p_glosa_id: string }
        Returns: undefined
      }
      confirm_order_payment:
        | {
            Args: {
              p_order_id: string
              p_payment_method_type?: string
              p_wompi_reference: string
              p_wompi_transaction_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_order_id: string
              p_payment_method_type?: string
              p_provider?: string
              p_wompi_reference: string
              p_wompi_transaction_id: string
            }
            Returns: Json
          }
      confirm_session_booking_payment: {
        Args: {
          p_booking_id: string
          p_provider?: string
          p_wompi_reference: string
          p_wompi_transaction_id: string
        }
        Returns: Json
      }
      consume_card_save_intent: {
        Args: { p_reference: string }
        Returns: {
          acceptance_permalink: string
          acceptance_token: string
          accepted_at: string
          ip_address: unknown
          payment_provider: Database["public"]["Enums"]["payment_provider"]
          personal_data_auth_token: string
          personal_data_permalink: string
          user_agent: string
          user_id: string
        }[]
      }
      create_demo_link: {
        Args: {
          p_archetype?: string
          p_logo_url?: string
          p_notes?: string
          p_primary_color?: string
          p_prospect_email?: string
          p_prospect_name?: string
          p_prospect_phone?: string
          p_school_name: string
          p_sent_via?: string
        }
        Returns: {
          demo_url: string
          expires_at: string
          token: string
        }[]
      }
      create_glosa: {
        Args: {
          p_actor: string
          p_payment_id: string
          p_reason: string
          p_reason_detail?: Json
          p_responds_by?: string
        }
        Returns: string
      }
      create_invitation:
        | {
            Args: {
              p_branch_id?: string
              p_child_name?: string
              p_email?: string
              p_monthly_fee?: number
              p_offering_plan_id?: string
              p_parent_phone?: string
              p_role?: string
              p_team_id?: string
            }
            Returns: string
          }
        | {
            Args: {
              p_branch_id?: string
              p_child_name?: string
              p_email?: string
              p_monthly_fee?: number
              p_offering_plan_id?: string
              p_parent_phone?: string
              p_role?: string
              p_team_id?: string
              p_unregistered_athlete_id?: string
            }
            Returns: string
          }
      create_invitation__interno: {
        Args: {
          p_branch_id?: string
          p_child_name?: string
          p_email?: string
          p_monthly_fee?: number
          p_offering_plan_id?: string
          p_parent_phone?: string
          p_role?: string
          p_team_id?: string
          p_unregistered_athlete_id?: string
        }
        Returns: string
      }
      create_recurring_subscription: {
        Args: {
          p_amount: number
          p_billing_day?: number
          p_child_id: string
          p_concept?: string
          p_payment_token_id: string
          p_program_id?: string
          p_school_id: string
          p_team_id?: string
        }
        Returns: Json
      }
      create_school_join_qr: {
        Args: {
          p_accept_payments?: boolean
          p_branch_id?: string
          p_cta_text?: string
          p_expires_at?: string
          p_fixed_amount?: number
          p_intro_text?: string
          p_name?: string
          p_require_first_payment?: boolean
          p_school_id?: string
          p_slug?: string
          p_target_id?: string
          p_target_type?: string
        }
        Returns: Json
      }
      create_school_referral: {
        Args: { p_message?: string; p_referred_email: string }
        Returns: Json
      }
      create_school_trial_slot: {
        Args: {
          p_end_time?: string
          p_label: string
          p_location?: string
          p_max_capacity?: number
          p_school_id: string
          p_slot_date: string
          p_start_time: string
          p_team_id?: string
        }
        Returns: Json
      }
      create_tournament_invitation: {
        Args: { p_email?: string; p_event_id: string; p_school_name?: string }
        Returns: Json
      }
      current_staff_ids: { Args: never; Returns: string[] }
      current_staff_team_ids: { Args: never; Returns: string[] }
      decrement_session_bookings: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      detect_enrollment_integrity_issues: { Args: never; Returns: Json }
      detect_payment_anomalies: { Args: never; Returns: Json }
      disable_vendor_profile: { Args: never; Returns: boolean }
      enable_vendor_profile: {
        Args: {
          p_can_sell_products?: boolean
          p_can_sell_services?: boolean
          p_city?: string
          p_description?: string
          p_display_name?: string
          p_phone?: string
          p_vendor_type?: Database["public"]["Enums"]["vendor_type"]
        }
        Returns: {
          address: string | null
          avg_rating: number | null
          avg_response_hours: number | null
          bank_data: Json
          capabilities: Json
          city: string | null
          commission_rate: number
          cover_image_url: string | null
          created_at: string
          description: string | null
          display_name: string
          email: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          metadata: Json
          nit: string | null
          payment_methods: Json
          phone: string | null
          response_rate: number | null
          reviews_count: number
          slug: string | null
          updated_at: string
          user_id: string
          vendor_type: Database["public"]["Enums"]["vendor_type"]
          verification_doc_url: string | null
          verification_status: string
          website_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "vendor_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
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
      equipment_accept: {
        Args: { p_assignment_id: string }
        Returns: undefined
      }
      equipment_approve_delivery: {
        Args: { p_assignment_id: string }
        Returns: undefined
      }
      equipment_approve_return: {
        Args: { p_final_condition?: string; p_return_id: string }
        Returns: undefined
      }
      equipment_assign: {
        Args: {
          p_assigned_to: string
          p_branch_id?: string
          p_item_id: string
          p_note?: string
          p_photo_url?: string
          p_quantity: number
          p_return_due_at?: string
        }
        Returns: string
      }
      equipment_assignment_detail: {
        Args: { p_assignment_id: string }
        Returns: Json
      }
      equipment_available_for_self_checkout: {
        Args: { p_school_id: string }
        Returns: Json
      }
      equipment_close_with_shortage: {
        Args: { p_assignment_id: string; p_note: string }
        Returns: undefined
      }
      equipment_dispute_return: {
        Args: { p_note: string; p_return_id: string }
        Returns: undefined
      }
      equipment_list_coaches: { Args: { p_school_id: string }; Returns: Json }
      equipment_list_items: {
        Args: {
          p_branch_id?: string
          p_limit?: number
          p_offset?: number
          p_school_id: string
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      equipment_my_assignments: { Args: never; Returns: Json }
      equipment_pending_approvals: {
        Args: { p_school_id: string }
        Returns: Json
      }
      equipment_reject_delivery: {
        Args: { p_assignment_id: string; p_note: string }
        Returns: undefined
      }
      equipment_report_difference: {
        Args: {
          p_assignment_id: string
          p_note: string
          p_reported_quantity: number
        }
        Returns: undefined
      }
      equipment_request_return: {
        Args: {
          p_assignment_id: string
          p_condition: string
          p_note?: string
          p_photo_url?: string
          p_quantity: number
        }
        Returns: string
      }
      equipment_resolve_dispute: {
        Args: {
          p_action: string
          p_assignment_id: string
          p_new_quantity?: number
          p_note?: string
        }
        Returns: undefined
      }
      equipment_save_settings: {
        Args: {
          p_default_return_days: number
          p_require_photo_admin_mode: boolean
          p_school_id: string
          p_self_checkout_enabled: boolean
        }
        Returns: undefined
      }
      equipment_self_checkout: {
        Args: {
          p_branch_id?: string
          p_item_id: string
          p_note?: string
          p_photo_url: string
          p_quantity: number
        }
        Returns: string
      }
      equipment_set_acta_pdf_url: {
        Args: { p_assignment_id: string; p_pdf_url: string }
        Returns: undefined
      }
      equipment_soft_delete_item: {
        Args: { p_item_id: string }
        Returns: undefined
      }
      equipment_upsert_item: {
        Args: {
          p_branch_id?: string
          p_condition?: string
          p_id?: string
          p_name: string
          p_photo_url?: string
          p_quantity_total: number
          p_school_id: string
          p_self_checkout_override?: string
          p_size?: string
        }
        Returns: string
      }
      expire_school_referrals: { Args: never; Returns: number }
      expire_trials: { Args: never; Returns: Json }
      find_athletes_by_document: {
        Args: { p_doc_number: string; p_school_id?: string }
        Returns: {
          already_linked: boolean
          branch_name: string
          child_id: string
          date_of_birth: string
          full_name: string
          is_mine: boolean
          school_id: string
          school_name: string
          team_id: string
          team_name: string
        }[]
      }
      flag_payment_for_review: {
        Args: { p_id: string; p_kind: string; p_reason: string }
        Returns: undefined
      }
      fn_book_pt_session: {
        Args: {
          p_booked_by: string
          p_enrollment_id: string
          p_notes?: string
          p_session_date: string
          p_session_time: string
          p_session_type?: string
        }
        Returns: Json
      }
      fn_cancel_pt_session: {
        Args: { p_caller_id: string; p_plan_id: string }
        Returns: Json
      }
      fn_complete_session_plan: {
        Args: { p_plan_id: string; p_results?: Json; p_trainer_id: string }
        Returns: Json
      }
      fn_create_plan_from_routine: {
        Args: {
          p_assignment_source?: string
          p_client_id: string
          p_client_type: string
          p_enrollment_id?: string
          p_routine_id: string
          p_school_id: string
          p_session_date: string
          p_trainer_id: string
        }
        Returns: Json
      }
      fn_delete_self_assigned_session: {
        Args: { p_caller_id: string; p_plan_id: string }
        Returns: Json
      }
      fn_expire_overdue_enrollments: { Args: never; Returns: Json }
      fn_expire_overdue_payments: { Args: never; Returns: undefined }
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
      fn_generate_pt_sessions: {
        Args: {
          p_coach_availability_id?: string
          p_school_id: string
          p_weeks?: number
        }
        Returns: number
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
      fn_generate_sessions_from_offering_schedule: {
        Args: { p_offering_id: string; p_weeks?: number }
        Returns: {
          coach_id: string
          end_time: string
          session_date: string
          start_time: string
          was_created: boolean
        }[]
      }
      fn_is_admin_of_school: {
        Args: { lookup_school_id: string }
        Returns: boolean
      }
      fn_pt_routine_reminder: { Args: never; Returns: undefined }
      fn_pt_routine_reminder_2h: { Args: never; Returns: undefined }
      fn_pt_session_auto_complete: { Args: never; Returns: undefined }
      fn_resolve_school_category: {
        Args: { p_school_id: string; p_sport: string }
        Returns: undefined
      }
      fn_sync_all_offering_sessions: {
        Args: { p_school_id: string; p_weeks?: number }
        Returns: number
      }
      fn_unassign_gym_session: {
        Args: { p_caller_id: string; p_plan_id: string }
        Returns: Json
      }
      format_period_label: {
        Args: { p_month: number; p_year: number }
        Returns: string
      }
      generate_event_slug: { Args: { title: string }; Returns: string }
      generate_monthly_charges: { Args: never; Returns: Json }
      generate_qr_monthly_charge: {
        Args: { p_child_id: string; p_slug: string }
        Returns: Json
      }
      generate_qr_monthly_charge__interno: {
        Args: { p_child_id: string; p_slug: string }
        Returns: Json
      }
      generate_report_drafts: {
        Args: { p_month: number; p_school_id: string; p_year: number }
        Returns: number
      }
      generate_report_drafts_system: {
        Args: never
        Returns: {
          created: number
          error_msg: string
          school_id: string
        }[]
      }
      generate_school_subscription_invoice: {
        Args: { p_school_id: string }
        Returns: string
      }
      get_athlete_account_statement: {
        Args: {
          p_child_id?: string
          p_months?: number
          p_school_id: string
          p_unregistered_athlete_id?: string
          p_user_id?: string
        }
        Returns: Json
      }
      get_athlete_dashboard_stats: { Args: never; Returns: Json }
      get_athlete_enrollments: { Args: never; Returns: Json }
      get_athlete_exercise_stats:
        | { Args: { p_athlete_id: string; p_days?: number }; Returns: Json }
        | {
            Args: {
              p_athlete_id: string
              p_days?: number
              p_school_id?: string
            }
            Returns: Json
          }
      get_athlete_payment_timeline: {
        Args: {
          p_child_id?: string
          p_month: number
          p_school_id: string
          p_unregistered_athlete_id?: string
          p_user_id?: string
          p_year: number
        }
        Returns: Json
      }
      get_athlete_payments: {
        Args: { p_limit?: number; p_page?: number; p_status?: string }
        Returns: Json
      }
      get_athlete_payments_v2: {
        Args: { p_limit?: number; p_page?: number; p_status?: string }
        Returns: Json
      }
      get_athlete_stats: {
        Args: {
          p_athlete_id: string
          p_context?: string
          p_days?: number
          p_source_id?: string
        }
        Returns: Json
      }
      get_athletes_without_payment: {
        Args: { p_school_id: string }
        Returns: {
          athlete_id: string
          athlete_type: string
          contact_email: string
          contact_phone: string
          full_name: string
          plan_name: string
          price_monthly: number
          team_name: string
        }[]
      }
      get_available_slots: {
        Args: {
          p_date?: string
          p_service_listing_id?: string
          p_vendor_profile_id: string
        }
        Returns: Json
      }
      get_cash_session_summary: {
        Args: { p_session_id: string }
        Returns: {
          entry_count: number
          payment_method: string
          total: number
        }[]
      }
      get_child_exercise_stats:
        | { Args: { p_child_id: string; p_days?: number }; Returns: Json }
        | {
            Args: { p_child_id: string; p_days?: number; p_school_id?: string }
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
      get_join_qr_public: { Args: { p_slug: string }; Returns: Json }
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
      get_or_open_hour_bank_period: {
        Args: { p_enrollment_id: string }
        Returns: string
      }
      get_payment_aging_report: {
        Args: { p_branch_id?: string; p_school_id: string }
        Returns: Json
      }
      get_payment_providers_for_school: {
        Args: { p_school_id: string }
        Returns: {
          is_default: boolean
          provider: Database["public"]["Enums"]["payment_provider"]
          public_key: string
          sandbox: boolean
        }[]
      }
      get_payment_providers_for_vendor: {
        Args: { p_vendor_id: string }
        Returns: {
          is_default: boolean
          provider: Database["public"]["Enums"]["payment_provider"]
          public_key: string
          sandbox: boolean
        }[]
      }
      get_personal_trainer_school_id: {
        Args: { p_user_id: string }
        Returns: string
      }
      get_plan_join_info: {
        Args: { p_plan_id: string }
        Returns: {
          athletes_count: number
          branch_id: string
          branch_name: string
          duration_days: number
          max_sessions: number
          offering_id: string
          offering_name: string
          plan_currency: string
          plan_id: string
          plan_name: string
          plan_price: number
          school_id: string
          school_name: string
        }[]
      }
      get_pt_client_summary: {
        Args: { p_enrollment_id: string }
        Returns: Json
      }
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
      get_qr_pay_targets: { Args: { p_slug: string }; Returns: Json }
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
              enrollment_start_date: string | null
              enrollment_status: string | null
              expires_at: string | null
              fee_is_manual: boolean | null
              fee_reason: string | null
              full_name: string | null
              id: string | null
              is_active: boolean | null
              medical_info: string | null
              offering_plan_id: string | null
              parent_email: string | null
              parent_id: string | null
              parent_name: string | null
              parent_phone: string | null
              payment_due_date: string | null
              payment_status: string | null
              plan_monthly_fee: number | null
              plan_name: string | null
              plan_start_date: string | null
              price_monthly: number | null
              school_id: string | null
              secondary_sessions_used: number | null
              sessions_used: number | null
              team_id: string | null
              team_monthly_fee: number | null
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
      get_school_by_slug: { Args: { p_slug: string }; Returns: Json }
      get_school_dashboard_stats: {
        Args: { p_branch_id?: string; p_user_id: string }
        Returns: Json
      }
      get_school_id_by_custom_domain: {
        Args: { p_domain: string }
        Returns: string
      }
      get_school_id_by_slug: { Args: { p_slug: string }; Returns: string }
      get_school_lead_landing_public: {
        Args: { p_slug: string }
        Returns: Json
      }
      get_school_payment_history_grid: {
        Args: { p_branch_id?: string; p_months?: number; p_school_id: string }
        Returns: Json
      }
      get_school_payment_info: { Args: { p_school_id: string }; Returns: Json }
      get_school_referrals: {
        Args: never
        Returns: {
          created_at: string
          expires_at: string
          id: string
          message: string
          referral_code: string
          referred_email: string
          referred_school_name: string
          status: string
        }[]
      }
      get_school_services: { Args: { p_school_id: string }; Returns: Json }
      get_school_year_closes_report: {
        Args: { p_branch_id?: string; p_school_id: string; p_year: number }
        Returns: Json
      }
      get_shipping_quote_mock: {
        Args: {
          p_destination_city: string
          p_origin_city: string
          p_vendor_profile_id?: string
          p_weight_grams: number
        }
        Returns: Json
      }
      get_single_branch_id: { Args: { p_school_id: string }; Returns: string }
      get_team_join_info: {
        Args: { p_team_id: string }
        Returns: {
          athletes_count: number
          branch_id: string
          branch_name: string
          school_id: string
          school_name: string
          team_id: string
          team_name: string
        }[]
      }
      get_tournament_invitation_public: {
        Args: { p_token: string }
        Returns: Json
      }
      get_trainer_athlete_ids: {
        Args: { p_school_id: string }
        Returns: string[]
      }
      get_user_admin_school_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
      get_user_school_ids: { Args: { _user_id: string }; Returns: string[] }
      glosa_dashboard: {
        Args: { p_from?: string; p_school_id: string; p_to?: string }
        Returns: {
          cnt: number
          reason: string
          status: string
        }[]
      }
      has_entitlement: {
        Args: { p_key: string; p_school_id: string }
        Returns: boolean
      }
      has_role:
        | { Args: { req_role: string }; Returns: boolean }
        | { Args: { required_role: string; user_id: string }; Returns: boolean }
      has_school_role: {
        Args: { _role: string; _school_id: string; _user_id: string }
        Returns: boolean
      }
      has_vendor_capability: {
        Args: { p_capability: string; p_user_id: string }
        Returns: boolean
      }
      hold_athlete_report: {
        Args: { p_reason: string; p_report_id: string }
        Returns: undefined
      }
      increment_session_bookings: {
        Args: { p_session_id: string }
        Returns: undefined
      }
      invariantes_seguridad: {
        Args: never
        Returns: {
          detalle: string
          gravedad: string
          invariante: string
          objeto: string
        }[]
      }
      invite_parent_to_school: {
        Args: {
          p_branch_id?: string
          p_child_name?: string
          p_monthly_fee?: number
          p_offering_plan_id?: string
          p_parent_email: string
          p_parent_phone?: string
          p_team_id?: string
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      is_branch_admin: {
        Args: { target_branch_id: string; user_id: string }
        Returns: boolean
      }
      is_category_group: { Args: { p_grupo: string }; Returns: boolean }
      is_coach_parent_messaging_blocked: {
        Args: { p_recipient: string; p_sender: string }
        Returns: boolean
      }
      is_demo_user: { Args: { _user_id: string }; Returns: boolean }
      is_gov_entity: { Args: { p_school_id: string }; Returns: boolean }
      is_informational_entity: {
        Args: { p_school_type: string }
        Returns: boolean
      }
      is_non_saas_entity: { Args: { p_school_id: string }; Returns: boolean }
      is_own_team_coach: { Args: { p_team_coach_id: string }; Returns: boolean }
      is_parent_of: { Args: { p_child_id: string }; Returns: boolean }
      is_parent_of_child: { Args: { child_uuid: string }; Returns: boolean }
      is_personal_trainer: { Args: { p_user_id: string }; Returns: boolean }
      is_platform_admin: { Args: never; Returns: boolean }
      is_school_admin: { Args: { p_school_id: string }; Returns: boolean }
      is_school_admin_of: {
        Args: { p_school_id: string; p_uid?: string }
        Returns: boolean
      }
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
      is_scoped_coach_school: {
        Args: { p_school_id: string }
        Returns: boolean
      }
      is_store_vendor: {
        Args: { p_vendor_profile_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: never; Returns: boolean }
      is_support_agent: { Args: never; Returns: boolean }
      is_user_payment_blocked: { Args: { p_user_id: string }; Returns: Json }
      issue_athlete_certificate: {
        Args: { p_certificate_id: string }
        Returns: Json
      }
      issue_athlete_id_card: {
        Args: {
          p_child_id?: string
          p_photo_url?: string
          p_profile_id?: string
          p_school_id: string
          p_template_id?: string
          p_unregistered_athlete_id?: string
          p_valid_until?: string
        }
        Returns: Json
      }
      link_unregistered_to_profile: {
        Args: {
          p_target_child_id?: string
          p_target_user_id?: string
          p_unregistered_id: string
        }
        Returns: Json
      }
      list_athlete_certificates: {
        Args: {
          p_kind?: string
          p_limit?: number
          p_offset?: number
          p_school_id: string
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      list_athlete_id_cards: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_school_id: string
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      list_open_trial_slots_public: { Args: { p_slug: string }; Returns: Json }
      list_school_athletes_for_card_issue: {
        Args: { p_limit?: number; p_school_id: string; p_search?: string }
        Returns: Json
      }
      list_school_athletes_for_card_issue_v2: {
        Args: {
          p_branch_id?: string
          p_card_filter?: string
          p_limit?: number
          p_offset?: number
          p_school_id: string
          p_search?: string
          p_team_id?: string
        }
        Returns: Json
      }
      list_school_join_qrs: {
        Args: { p_active?: boolean; p_school_id: string; p_search?: string }
        Returns: Json
      }
      list_school_leads: {
        Args: { p_school_id: string; p_status?: string }
        Returns: Json
      }
      list_school_plans: { Args: { p_school_id: string }; Returns: Json }
      list_school_trial_slots: { Args: { p_school_id: string }; Returns: Json }
      lock_delegation_price_phase: {
        Args: { p_delegation_id: string }
        Returns: Json
      }
      mark_custom_domain_verified: { Args: { p_id: string }; Returns: Json }
      mark_overdue_payments: { Args: { p_school_id: string }; Returns: number }
      mark_report_viewed: { Args: { p_report_id: string }; Returns: string }
      mark_session_absences: { Args: { p_session_id: string }; Returns: Json }
      mask_person_name: { Args: { p_name: string }; Returns: string }
      merge_split_enrollments: {
        Args: { p_dry_run?: boolean; p_school_id?: string }
        Returns: Json
      }
      migraciones_aplicadas: {
        Args: never
        Returns: {
          name: string
          version: string
        }[]
      }
      migrate_device_favorites: {
        Args: { p_device_id: string }
        Returns: number
      }
      migrate_local_favorites: {
        Args: { p_school_ids: string[] }
        Returns: number
      }
      migrate_unregistered_athlete_to_profile: {
        Args: {
          p_new_child_id?: string
          p_new_user_id?: string
          p_unregistered_id: string
        }
        Returns: Json
      }
      move_hour_bank: {
        Args: {
          p_consumed_delta?: number
          p_period_id: string
          p_reserved_delta?: number
        }
        Returns: Json
      }
      move_session_credit: {
        Args: {
          p_delta: number
          p_enrollment_id: string
          p_is_secondary?: boolean
        }
        Returns: Json
      }
      my_athlete_certificates: { Args: never; Returns: Json }
      my_athlete_id_cards: { Args: never; Returns: Json }
      next_unpaid_period: { Args: { p_child_id: string }; Returns: Json }
      normalize_athlete_name: { Args: { p_name: string }; Returns: string }
      normalize_doc_number: { Args: { p_doc: string }; Returns: string }
      notify_payment_attempt_failed: {
        Args: { p_ambiguous?: boolean; p_payment_id: string; p_reason?: string }
        Returns: undefined
      }
      notify_school_payment_paid: {
        Args: { p_payment_id: string }
        Returns: undefined
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
      open_month: {
        Args: {
          p_branch_id?: string
          p_month: number
          p_school_id: string
          p_year: number
        }
        Returns: Json
      }
      owns_support_ticket: { Args: { p_ticket_id: string }; Returns: boolean }
      pay_supplier_bill: {
        Args: {
          p_amount: number
          p_bill_id: string
          p_paid_date: string
          p_payment_method?: Database["public"]["Enums"]["pay_method"]
          p_reference?: string
        }
        Returns: Json
      }
      period_payment_status: {
        Args: {
          p_child_id: string
          p_period_month: number
          p_period_year: number
        }
        Returns: Json
      }
      post_payroll_run: {
        Args: { p_paid_date?: string; p_run_id: string }
        Returns: Json
      }
      preview_close_month: {
        Args: {
          p_branch_id?: string
          p_month: number
          p_school_id: string
          p_year: number
        }
        Returns: Json
      }
      preview_open_month: {
        Args: {
          p_branch_id?: string
          p_month: number
          p_school_id: string
          p_year: number
        }
        Returns: Json
      }
      process_enrollment_checkout:
        | {
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
        | {
            Args: {
              p_amount: number
              p_class_id: string
              p_is_child_enrollment: boolean
              p_offering_plan_id?: string
              p_parent_id: string
              p_payment_method: string
              p_school_id: string
              p_student_id: string
            }
            Returns: Json
          }
      process_referral_registration: {
        Args: { p_new_school_id: string; p_referral_code: string }
        Returns: undefined
      }
      prorate_delegation_payment: {
        Args: { p_payment_id: string }
        Returns: Json
      }
      provision_personal_trainer_workspace: {
        Args: {
          p_email: string
          p_full_name: string
          p_phone?: string
          p_user_id: string
        }
        Returns: Json
      }
      public_booking_confirm_reservation: {
        Args: {
          p_date: string
          p_end_time: string
          p_enrollment_id: string
          p_facility_availability_id: string
          p_facility_id: string
          p_max_group_capacity: number
          p_school_id: string
          p_start_time: string
          p_unregistered_athlete_id: string
        }
        Returns: {
          booking_id: string
          session_id: string
        }[]
      }
      publish_athlete_report: {
        Args: {
          p_override_note?: boolean
          p_reason?: string
          p_report_id: string
          p_snapshot: Json
        }
        Returns: string
      }
      publish_athlete_report_system: {
        Args: {
          p_override_note?: boolean
          p_reason?: string
          p_report_id: string
          p_snapshot: Json
        }
        Returns: string
      }
      publish_team_reports: {
        Args: {
          p_month: number
          p_override_note?: boolean
          p_reason?: string
          p_school_id: string
          p_snapshots: Json
          p_team_id: string
          p_year: number
        }
        Returns: {
          detalle: string
          report_id: string
          resultado: string
        }[]
      }
      publish_team_reports_system: {
        Args: {
          p_month: number
          p_override_note?: boolean
          p_reason?: string
          p_school_id: string
          p_snapshots: Json
          p_team_id: string
          p_year: number
        }
        Returns: {
          detalle: string
          report_id: string
          resultado: string
        }[]
      }
      qr_first_charge_due_date: {
        Args: { p_school_id: string; p_today: string }
        Returns: string
      }
      ratify_expired_glosas: { Args: never; Returns: Json }
      recalc_product_review_aggregates: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      recalc_vendor_review_aggregates: {
        Args: { p_vendor_profile_id: string }
        Returns: undefined
      }
      reconcile_statement: {
        Args: { p_actor: string; p_statement_id: string }
        Returns: Json
      }
      record_payment_failure: {
        Args: { p_id: string; p_kind: string; p_reason: string }
        Returns: undefined
      }
      record_recurring_attempt: {
        Args: {
          p_amount: number
          p_error_code?: string
          p_error_message?: string
          p_idempotency_key?: string
          p_payment_id?: string
          p_payment_provider: Database["public"]["Enums"]["payment_provider"]
          p_provider_payment_id?: string
          p_raw_response?: Json
          p_status: string
          p_subscription_id: string
        }
        Returns: Json
      }
      refresh_session_health: { Args: never; Returns: undefined }
      regenerate_report_snapshot: {
        Args: { p_reason: string; p_report_id: string; p_snapshot: Json }
        Returns: number
      }
      register_card_save_intent: {
        Args: {
          p_acceptance_permalink: string
          p_acceptance_token: string
          p_ip_address: unknown
          p_payment_provider: Database["public"]["Enums"]["payment_provider"]
          p_personal_data_auth_token: string
          p_personal_data_permalink: string
          p_reference: string
          p_user_agent: string
          p_user_id: string
        }
        Returns: Json
      }
      register_for_internal_tournament: {
        Args: { p_category_id: string; p_child_id?: string; p_event_id: string }
        Returns: string
      }
      register_qr_paid_conversion: {
        Args: { p_qr_id: string }
        Returns: undefined
      }
      register_user_device: {
        Args: {
          p_app_version?: string
          p_device_id: string
          p_device_model?: string
          p_locale?: string
          p_os_version?: string
          p_platform: string
          p_push_provider?: string
          p_push_token?: string
          p_timezone?: string
          p_user_agent?: string
        }
        Returns: Json
      }
      release_settlements_all: { Args: never; Returns: Json }
      release_settlements_for_vendor: {
        Args: { p_vendor_profile_id: string }
        Returns: Json
      }
      reopen_glosa: {
        Args: { p_actor: string; p_glosa_id: string; p_note: string }
        Returns: undefined
      }
      reopen_month: {
        Args: {
          p_branch_id?: string
          p_month: number
          p_reason: string
          p_school_id: string
          p_year: number
        }
        Returns: Json
      }
      report_coverage: {
        Args: { p_month: number; p_school_id: string; p_year: number }
        Returns: {
          faltan_nota: number
          leidos: number
          listos: number
          publicados: number
          sin_actividad: number
          sin_destinatario: number
          sin_mediciones_con_asistencia: number
          team_id: string
          team_name: string
          total: number
        }[]
      }
      request_athlete_certificate: {
        Args: {
          p_child_id?: string
          p_profile_id?: string
          p_school_id: string
          p_template_id: string
        }
        Returns: Json
      }
      request_refund: {
        Args: {
          p_order_id?: string
          p_payment_id?: string
          p_reason?: string
          p_transaction_id?: string
        }
        Returns: Json
      }
      reschedule_pending_reports: {
        Args: { p_month: number; p_school_id: string; p_year: number }
        Returns: number
      }
      reserve_hour_bank: {
        Args: {
          p_created_by?: string
          p_enrollment_id: string
          p_reservation_date: string
        }
        Returns: Json
      }
      resolve_glosa: {
        Args: {
          p_actor: string
          p_glosa_id: string
          p_outcome: string
          p_resolution_note: string
        }
        Returns: undefined
      }
      resolve_payment_provider: {
        Args: { p_method: string }
        Returns: Database["public"]["Enums"]["payment_provider"]
      }
      respond_glosa: {
        Args: {
          p_actor: string
          p_glosa_id: string
          p_response_files?: Json
          p_response_text: string
        }
        Returns: undefined
      }
      revoke_athlete_certificate: {
        Args: { p_certificate_id: string; p_reason?: string }
        Returns: undefined
      }
      revoke_athlete_id_card: {
        Args: { p_card_id: string; p_reason?: string }
        Returns: undefined
      }
      revoke_platform_admin: { Args: { admin_email: string }; Returns: Json }
      revoke_user_device: {
        Args: { p_device_id: string; p_reason?: string }
        Returns: Json
      }
      rpc_process_upgrade_request: {
        Args: {
          p_amount_cents?: number
          p_contact_method?: string
          p_notes?: string
          p_request_id: string
        }
        Returns: Json
      }
      run_payroll: {
        Args: {
          p_month: number
          p_owner_id: string
          p_owner_type: string
          p_year: number
        }
        Returns: Json
      }
      run_saas_billing_cycle: {
        Args: never
        Returns: {
          invoice_id: string
          kind: string
        }[]
      }
      save_dashboard_preferences: {
        Args: { p_preferences: Json }
        Returns: boolean
      }
      save_notification_preferences: {
        Args: { p_preferences: Json }
        Returns: boolean
      }
      save_payment_token:
        | {
            Args: {
              p_brand?: string
              p_expires_at?: string
              p_holder_name?: string
              p_last_four?: string
              p_payment_method_type?: string
              p_payment_provider: Database["public"]["Enums"]["payment_provider"]
              p_provider_card_id?: string
              p_provider_customer_id?: string
              p_provider_payment_source_id?: number
              p_provider_token?: string
              p_set_default?: boolean
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_brand?: string
              p_expires_at?: string
              p_holder_name?: string
              p_last_four?: string
              p_payment_method_type: string
              p_provider?: string
              p_provider_card_id?: string
              p_provider_customer_id?: string
              p_set_default?: boolean
              p_user_id: string
              p_wompi_token: string
            }
            Returns: Json
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
      school_add_sport_category: {
        Args: {
          p_max?: number
          p_min?: number
          p_nombre: string
          p_origen?: string
          p_school_id: string
          p_sport: string
        }
        Returns: Json
      }
      school_due_date: {
        Args: { p_month: number; p_school_id: string; p_year: number }
        Returns: string
      }
      school_has_branding_feature: {
        Args: { p_school_id: string }
        Returns: boolean
      }
      school_has_custom_domain_feature: {
        Args: { p_school_id: string }
        Returns: boolean
      }
      school_has_native_app: { Args: { p_school_id: string }; Returns: boolean }
      school_is_operational: { Args: { p_school_id: string }; Returns: boolean }
      school_member_profile_ids: { Args: never; Returns: string[] }
      school_memberships_listado: {
        Args: { p_school_id: string }
        Returns: {
          documento: string
          external_ref: string
          fecha_vencida: boolean
          id: string
          nombre: string
          notes: string
          source: string
          status: string
          sujeto_id: string
          sujeto_tipo: string
          updated_at: string
          valid_from: string
          valid_until: string
        }[]
      }
      school_payment_kpis: {
        Args: { p_branch_id?: string; p_school_id: string }
        Returns: Json
      }
      school_set_membership: {
        Args: {
          p_child_id?: string
          p_external_ref?: string
          p_notes?: string
          p_school_id: string
          p_source?: string
          p_status?: string
          p_unregistered_athlete_id?: string
          p_user_id?: string
          p_valid_from?: string
          p_valid_until?: string
        }
        Returns: Json
      }
      school_shows_own_brand: {
        Args: { p_school_id: string }
        Returns: boolean
      }
      school_sport_categories: {
        Args: { p_school_id: string; p_sport: string }
        Returns: {
          adoptada: boolean
          detalle: Json
          nombre: string
          origen: string
        }[]
      }
      schools_near_location: {
        Args: { p_lat: number; p_lng: number; p_radius_km?: number }
        Returns: Json
      }
      search_explore_map: {
        Args: {
          p_bounds_ne_lat?: number
          p_bounds_ne_lng?: number
          p_bounds_sw_lat?: number
          p_bounds_sw_lng?: number
          p_category?: string
          p_city?: string
          p_query?: string
          p_service_type?: string
          p_sport?: string
        }
        Returns: Json
      }
      search_marketplace: {
        Args: {
          p_category?: string
          p_city?: string
          p_limit?: number
          p_order_by?: string
          p_page?: number
          p_price_max?: number
          p_query?: string
          p_service_type?: string
          p_type?: string
        }
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
      seed_abierto26_price_phases: {
        Args: { p_event_id: string }
        Returns: number
      }
      seed_cheer_allstar_categories: {
        Args: { p_event_id: string }
        Returns: number
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
      send_payment_reminders:
        | { Args: never; Returns: Json }
        | { Args: { p_school_id: string }; Returns: Json }
      session_booking_reschedule: {
        Args: {
          p_facility_availability_id: string
          p_id: string
          p_new_date: string
          p_new_end_time: string
          p_new_start_time: string
          p_school_id: string
        }
        Returns: {
          facility_id: string
        }[]
      }
      set_athlete_report_note: {
        Args: { p_note: string; p_report_id: string }
        Returns: undefined
      }
      set_certificate_pdf_url: {
        Args: { p_certificate_id: string; p_pdf_url: string }
        Returns: undefined
      }
      set_school_athlete_status: {
        Args: {
          p_active: boolean
          p_athlete_id: string
          p_athlete_type: string
          p_school_id: string
        }
        Returns: Json
      }
      set_school_pwa_icons: {
        Args: {
          p_actor: string
          p_bg: string
          p_icon_192: string
          p_icon_512: string
          p_school_id: string
        }
        Returns: Json
      }
      split_order_payment: {
        Args: {
          p_order_id: string
          p_provider?: string
          p_provider_fee_pct?: number
          p_sportmaps_fee_pct?: number
        }
        Returns: Json
      }
      staff_school_ids: { Args: never; Returns: string[] }
      submit_athlete_installment: {
        Args: {
          p_amount_cents: number
          p_athlete_payment_id: string
          p_notes?: string
          p_payment_method?: string
          p_receipt_date?: string
          p_receipt_url?: string
        }
        Returns: Json
      }
      submit_enrollment: {
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
          p_school_id: string
          p_self_enrollment?: boolean
          p_team_id?: string
        }
        Returns: Json
      }
      submit_enrollment_v2: {
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
      submit_qr_signup: {
        Args: {
          p_branch_id?: string
          p_child_dob?: string
          p_child_doc_number?: string
          p_child_doc_type?: string
          p_child_full_name?: string
          p_child_gender?: string
          p_existing_child_id?: string
          p_monthly_fee?: number
          p_phone?: string
          p_plan_id?: string
          p_slug: string
          p_team_id?: string
        }
        Returns: Json
      }
      submit_qr_signup__interno: {
        Args: {
          p_branch_id?: string
          p_child_dob?: string
          p_child_doc_number?: string
          p_child_doc_type?: string
          p_child_full_name?: string
          p_child_gender?: string
          p_existing_child_id?: string
          p_monthly_fee?: number
          p_phone?: string
          p_plan_id?: string
          p_slug: string
          p_team_id?: string
        }
        Returns: Json
      }
      submit_school_lead: {
        Args: {
          p_birth_date?: string
          p_email?: string
          p_full_name: string
          p_gender?: string
          p_guardian_name?: string
          p_how_heard?: string
          p_notes?: string
          p_phone: string
          p_slug: string
          p_source_detail?: Json
          p_trial_slot_id?: string
          p_website?: string
        }
        Returns: Json
      }
      support_open_ticket: {
        Args: { p_category?: string; p_subject?: string }
        Returns: string
      }
      support_post_message: {
        Args: { p_body: string; p_internal?: boolean; p_ticket_id: string }
        Returns: string
      }
      toggle_favorite: { Args: { p_school_id: string }; Returns: Json }
      trial_class_category_set_active: {
        Args: { p_id: string; p_is_active: boolean; p_school_id: string }
        Returns: undefined
      }
      trial_class_category_set_repeat_pricing: {
        Args: {
          p_allow_repeat: boolean
          p_id: string
          p_repeat_price?: number
          p_school_id: string
        }
        Returns: undefined
      }
      trial_class_category_upsert: {
        Args: {
          p_description?: string
          p_id?: string
          p_is_active?: boolean
          p_name: string
          p_price: number
          p_school_id: string
        }
        Returns: string
      }
      trial_class_create_booking: {
        Args: {
          p_category_id: string
          p_child_name?: string
          p_coach_availability_id: string
          p_created_by: string
          p_end_time: string
          p_facility_availability_id: string
          p_is_minor?: boolean
          p_prospect_email: string
          p_prospect_name: string
          p_prospect_whatsapp: string
          p_scheduled_date: string
          p_school_id: string
          p_start_time: string
        }
        Returns: {
          booking_id: string
          whatsapp_message: string
        }[]
      }
      trial_class_get_joint_slots: {
        Args: {
          p_coach_id: string
          p_facility_id: string
          p_from_date: string
          p_school_id: string
          p_to_date: string
        }
        Returns: {
          coach_availability_id: string
          facility_availability_id: string
          slot_date: string
          slot_end_time: string
          slot_start_time: string
        }[]
      }
      trial_class_public_create: {
        Args: {
          p_category_id: string
          p_child_name?: string
          p_coach_availability_id: string
          p_end_time: string
          p_facility_availability_id: string
          p_is_minor?: boolean
          p_prospect_dob?: string
          p_prospect_email?: string
          p_prospect_name?: string
          p_prospect_whatsapp?: string
          p_scheduled_date: string
          p_school_id: string
          p_start_time: string
          p_unregistered_athlete_id?: string
        }
        Returns: {
          booking_id: string
          is_first: boolean
          payment_mode: string
          price: number
        }[]
      }
      trial_class_public_get_slots: {
        Args: {
          p_category_id: string
          p_from_date: string
          p_school_id: string
          p_to_date: string
        }
        Returns: {
          coach_availability_id: string
          facility_availability_id: string
          facility_id: string
          facility_name: string
          slot_date: string
          slot_end_time: string
          slot_start_time: string
        }[]
      }
      trial_class_reschedule_booking: {
        Args: {
          p_coach_availability_id: string
          p_facility_availability_id: string
          p_id: string
          p_new_date: string
          p_new_end_time: string
          p_new_start_time: string
          p_school_id: string
        }
        Returns: {
          whatsapp_message: string
        }[]
      }
      trial_class_save_settings: {
        Args: {
          p_enabled: boolean
          p_requires_approval?: boolean
          p_school_id: string
        }
        Returns: undefined
      }
      trial_class_self_cancel: {
        Args: {
          p_created_by: string
          p_id: string
          p_reason?: string
          p_school_id: string
        }
        Returns: undefined
      }
      trial_class_self_create: {
        Args: {
          p_category_id: string
          p_child_id?: string
          p_coach_availability_id: string
          p_created_by: string
          p_end_time: string
          p_facility_availability_id: string
          p_prospect_dob?: string
          p_prospect_email?: string
          p_prospect_name?: string
          p_prospect_whatsapp?: string
          p_scheduled_date: string
          p_school_id: string
          p_self?: boolean
          p_start_time: string
        }
        Returns: {
          booking_id: string
          is_first: boolean
          payment_mode: string
          price: number
        }[]
      }
      trial_class_self_get_joint_slots: {
        Args: {
          p_coach_id: string
          p_facility_id: string
          p_from_date: string
          p_school_id: string
          p_to_date: string
        }
        Returns: {
          coach_availability_id: string
          facility_availability_id: string
          slot_date: string
          slot_end_time: string
          slot_start_time: string
        }[]
      }
      trial_class_self_has_active_plan: {
        Args: {
          p_child_id?: string
          p_school_id: string
          p_unregistered_athlete_id?: string
          p_user_id?: string
        }
        Returns: boolean
      }
      trial_class_self_is_first: {
        Args: {
          p_child_id?: string
          p_school_id: string
          p_unregistered_athlete_id?: string
          p_user_id?: string
        }
        Returns: boolean
      }
      trial_class_self_reschedule: {
        Args: {
          p_coach_availability_id: string
          p_created_by: string
          p_facility_availability_id: string
          p_id: string
          p_new_date: string
          p_new_end_time: string
          p_new_start_time: string
          p_school_id: string
        }
        Returns: {
          facility_id: string
        }[]
      }
      trial_class_self_service_save_settings: {
        Args: {
          p_payment_mode?: string
          p_reschedule_cutoff_hours?: number
          p_school_id: string
          p_self_service_enabled: boolean
        }
        Returns: undefined
      }
      trial_class_update_status: {
        Args: {
          p_cancel_reason?: string
          p_id: string
          p_new_status: string
          p_school_id: string
        }
        Returns: undefined
      }
      unblock_payment: { Args: { p_id: string; p_kind: string }; Returns: Json }
      update_school_branding: {
        Args: {
          p_ip_address?: unknown
          p_logo_url?: string
          p_primary_color?: string
          p_school_id: string
          p_secondary_color?: string
          p_show_watermark?: boolean
          p_user_agent?: string
        }
        Returns: Json
      }
      update_school_lead_status: {
        Args: { p_lead_id: string; p_status: string }
        Returns: Json
      }
      update_school_public_profile: {
        Args: {
          p_address?: string
          p_city?: string
          p_cover_image_url?: string
          p_description?: string
          p_email?: string
          p_logo_url?: string
          p_name?: string
          p_phone?: string
          p_school_id: string
          p_sports?: string[]
          p_website?: string
        }
        Returns: Json
      }
      upsert_attendance_record: {
        Args: {
          p_attendance_date: string
          p_check_in_method?: string
          p_child_id?: string
          p_marked_by?: string
          p_school_id: string
          p_session_id: string
          p_status: string
          p_team_id?: string
          p_unregistered_id?: string
          p_user_id?: string
        }
        Returns: string
      }
      upsert_school_provider: {
        Args: {
          p_connect_method?: string
          p_connect_status?: string
          p_connected_by?: string
          p_enabled?: boolean
          p_external_user_id?: string
          p_is_default?: boolean
          p_provider: Database["public"]["Enums"]["payment_provider"]
          p_public_key: string
          p_sandbox?: boolean
          p_school_id: string
          p_secrets_enc: Json
          p_token_expires_at?: string
        }
        Returns: string
      }
      user_admin_school_ids: { Args: never; Returns: string[] }
      user_school_ids: { Args: never; Returns: string[] }
      user_school_role: { Args: { p_school_id: string }; Returns: string }
      user_staff_school_ids: { Args: never; Returns: string[] }
      validate_athlete_age: {
        Args: { p_birth_year: number; p_category_id: string }
        Returns: Json
      }
      validate_child_for_team_join: {
        Args: { p_doc_number: string; p_team_id: string }
        Returns: {
          already_linked: boolean
          child_id: string
          full_name: string
        }[]
      }
      validate_doc_for_plan_join: {
        Args: { p_doc_number: string; p_plan_id: string }
        Returns: {
          already_linked: boolean
          child_id: string
          full_name: string
        }[]
      }
      validate_product_quality: {
        Args: { p_product_id: string }
        Returns: Json
      }
      vendor_payout_summary: { Args: never; Returns: Json }
      verify_athlete_certificate_public: {
        Args: { p_folio?: string; p_qr_token?: string }
        Returns: Json
      }
      verify_athlete_id_card_public: {
        Args: { p_qr_token: string }
        Returns: Json
      }
      wa_get_payment_status: {
        Args: { p_parent_id: string; p_school_id: string }
        Returns: Json
      }
      wa_ingest_inbound_message: {
        Args: {
          p_contact_name: string
          p_contact_wa_id: string
          p_integration_id: string
          p_payload: Json
          p_school_id: string
          p_text_body: string
          p_type: string
          p_wa_message_id: string
          p_wa_timestamp: string
        }
        Returns: Json
      }
      wa_is_blocked: {
        Args: { p_contact_wa_id: string; p_integration_id: string }
        Returns: boolean
      }
      wa_record_outbound_message: {
        Args: {
          p_ai_generated: boolean
          p_conversation_id: string
          p_integration_id: string
          p_payload: Json
          p_text_body: string
          p_to_wa_id: string
          p_type: string
          p_wa_message_id: string
        }
        Returns: Json
      }
      wa_start_identification: {
        Args: {
          p_contact_wa_id: string
          p_email: string
          p_expires_at: string
          p_integration_id: string
          p_otp_hash: string
        }
        Returns: Json
      }
      wa_verify_otp: {
        Args: {
          p_contact_wa_id: string
          p_integration_id: string
          p_otp_hash: string
        }
        Returns: Json
      }
    }
    Enums: {
      activity_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      attend_status: "present" | "absent" | "late" | "excused" | "justified"
      bill_status: "open" | "partially_paid" | "paid" | "overdue" | "void"
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
      contract_type:
        | "indefinido"
        | "fijo"
        | "obra_labor"
        | "prestacion_servicios"
        | "aprendizaje"
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
      expense_kind: "manual" | "payroll" | "supplier_bill"
      expense_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "paid"
        | "void"
      fulfillment_type: "physical" | "digital" | "service"
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
      pay_status:
        | "pending"
        | "paid"
        | "overdue"
        | "failed"
        | "cancelled"
        | "partial"
      pay_type: "one_time" | "subscription"
      payment_provider: "wompi" | "mercadopago"
      payroll_run_status: "draft" | "approved" | "paid" | "void"
      product_visibility: "public" | "school_only" | "private"
      program_level:
        | "iniciacion"
        | "intermedio"
        | "avanzado"
        | "alto_rendimiento"
      resv_payment_status: "unpaid" | "partial" | "paid" | "waived"
      resv_status: "pending" | "confirmed" | "cancelled" | "completed"
      resv_type: "internal" | "rental" | "secondary_class"
      settlement_status: "pending" | "processing" | "paid" | "failed"
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
        | "personal_trainer"
        | "external_vendor"
      vendor_type:
        | "store"
        | "wellness"
        | "school"
        | "personal_trainer"
        | "coach"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      bill_status: ["open", "partially_paid", "paid", "overdue", "void"],
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
      contract_type: [
        "indefinido",
        "fijo",
        "obra_labor",
        "prestacion_servicios",
        "aprendizaje",
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
      expense_kind: ["manual", "payroll", "supplier_bill"],
      expense_status: ["draft", "pending_approval", "approved", "paid", "void"],
      fulfillment_type: ["physical", "digital", "service"],
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
      pay_status: [
        "pending",
        "paid",
        "overdue",
        "failed",
        "cancelled",
        "partial",
      ],
      pay_type: ["one_time", "subscription"],
      payment_provider: ["wompi", "mercadopago"],
      payroll_run_status: ["draft", "approved", "paid", "void"],
      product_visibility: ["public", "school_only", "private"],
      program_level: [
        "iniciacion",
        "intermedio",
        "avanzado",
        "alto_rendimiento",
      ],
      resv_payment_status: ["unpaid", "partial", "paid", "waived"],
      resv_status: ["pending", "confirmed", "cancelled", "completed"],
      resv_type: ["internal", "rental", "secondary_class"],
      settlement_status: ["pending", "processing", "paid", "failed"],
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
        "personal_trainer",
        "external_vendor",
      ],
      vendor_type: ["store", "wellness", "school", "personal_trainer", "coach"],
    },
  },
} as const
