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
          child_id: string
          class_id: string | null
          created_at: string | null
          id: string
          marked_by: string | null
          notes: string | null
          program_id: string
          school_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          attendance_date?: string
          child_id: string
          class_id?: string | null
          created_at?: string | null
          id?: string
          marked_by?: string | null
          notes?: string | null
          program_id: string
          school_id: string
          status: string
          updated_at?: string | null
        }
        Update: {
          attendance_date?: string
          child_id?: string
          class_id?: string | null
          created_at?: string | null
          id?: string
          marked_by?: string | null
          notes?: string | null
          program_id?: string
          school_id?: string
          status?: string
          updated_at?: string | null
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
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          is_main: boolean | null
          name: string
          school_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_main?: boolean | null
          name: string
          school_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          is_main?: boolean | null
          name?: string
          school_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          grade: string | null
          id: string
          id_document_url: string | null
          is_demo: boolean | null
          medical_info: string | null
          monthly_fee: number | null
          parent_email_temp: string | null
          parent_id: string | null
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
          grade?: string | null
          id?: string
          id_document_url?: string | null
          is_demo?: boolean | null
          medical_info?: string | null
          monthly_fee?: number | null
          parent_email_temp?: string | null
          parent_id?: string | null
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
          grade?: string | null
          id?: string
          id_document_url?: string | null
          is_demo?: boolean | null
          medical_info?: string | null
          monthly_fee?: number | null
          parent_email_temp?: string | null
          parent_id?: string | null
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
          id: string
          program_id: string | null
          school_id: string | null
          start_date: string
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          child_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          program_id?: string | null
          school_id?: string | null
          start_date?: string
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          child_id?: string | null
          created_at?: string | null
          end_date?: string | null
          id?: string
          program_id?: string | null
          school_id?: string | null
          start_date?: string
          status?: string | null
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
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
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
          name: string
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
          name: string
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
          name?: string
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
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      facility_reservations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          end_time: string
          facility_id: string
          id: string
          notes: string | null
          participants: number | null
          price: number | null
          reservation_date: string
          start_time: string
          status: string | null
          team_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          end_time: string
          facility_id: string
          id?: string
          notes?: string | null
          participants?: number | null
          price?: number | null
          reservation_date: string
          start_time: string
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          end_time?: string
          facility_id?: string
          id?: string
          notes?: string | null
          participants?: number | null
          price?: number | null
          reservation_date?: string
          start_time?: string
          status?: string | null
          team_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_reservations_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
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
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          payment_id?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          id?: string
          new_status?: string | null
          notes?: string | null
          old_status?: string | null
          payment_id?: string | null
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
            referencedRelation: "pending_payments"
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
            foreignKeyName: "payments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "payments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "payments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
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
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string | null
          experience_level: string | null
          full_name: string | null
          id: string
          invitation_code: string | null
          is_demo: boolean | null
          is_verified: boolean | null
          location: string | null
          onboarding_completed: boolean | null
          onboarding_started: boolean | null
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          role_id: string | null
          sportmaps_points: number | null
          sports_interests: string[] | null
          subscription_tier: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          experience_level?: string | null
          full_name?: string | null
          id: string
          invitation_code?: string | null
          is_demo?: boolean | null
          is_verified?: boolean | null
          location?: string | null
          onboarding_completed?: boolean | null
          onboarding_started?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          role_id?: string | null
          sportmaps_points?: number | null
          sports_interests?: string[] | null
          subscription_tier?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string | null
          experience_level?: string | null
          full_name?: string | null
          id?: string
          invitation_code?: string | null
          is_demo?: boolean | null
          is_verified?: boolean | null
          location?: string | null
          onboarding_completed?: boolean | null
          onboarding_started?: boolean | null
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          role_id?: string | null
          sportmaps_points?: number | null
          sports_interests?: string[] | null
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
          allow_multiple_enrollments: boolean | null
          coach_can_request_reminders: boolean | null
          coach_can_send_reminders: boolean | null
          created_at: string | null
          payment_cutoff_day: number | null
          payment_grace_days: number | null
          responsible_payment_policy: string | null
          school_id: string
          updated_at: string | null
        }
        Insert: {
          allow_multiple_enrollments?: boolean | null
          coach_can_request_reminders?: boolean | null
          coach_can_send_reminders?: boolean | null
          created_at?: string | null
          payment_cutoff_day?: number | null
          payment_grace_days?: number | null
          responsible_payment_policy?: string | null
          school_id: string
          updated_at?: string | null
        }
        Update: {
          allow_multiple_enrollments?: boolean | null
          coach_can_request_reminders?: boolean | null
          coach_can_send_reminders?: boolean | null
          created_at?: string | null
          payment_cutoff_day?: number | null
          payment_grace_days?: number | null
          responsible_payment_policy?: string | null
          school_id?: string
          updated_at?: string | null
        }
        Relationships: [
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
      spm_users: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          metadata: Json | null
          phone: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          metadata?: Json | null
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          metadata?: Json | null
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: []
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
          schedule: Json | null
          school_id: string | null
          season: string | null
          sport: string
          status: string | null
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
          schedule?: Json | null
          school_id?: string | null
          season?: string | null
          sport: string
          status?: string | null
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
          schedule?: Json | null
          school_id?: string | null
          season?: string | null
          sport?: string
          status?: string | null
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
          id: string
          session_date: string
          session_time: string | null
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_date: string
          session_time?: string | null
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
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
            foreignKeyName: "payments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "team_capacity"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "payments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["program_id"]
          },
          {
            foreignKeyName: "payments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "teams_full_view"
            referencedColumns: ["team_id"]
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
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          created_at: string | null
          date_of_birth: string | null
          doc_number: string | null
          doc_type: string | null
          emergency_contact: string | null
          enrollment_date: string | null
          enrollment_id: string | null
          enrollment_status: string | null
          full_name: string | null
          grade: string | null
          id: string | null
          is_demo: boolean | null
          medical_info: string | null
          monthly_fee: number | null
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
          sport: string | null
          team_id: string | null
          team_name: string | null
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
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { p_invite_id: string }; Returns: boolean }
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
      fn_is_admin_of_school: {
        Args: { lookup_school_id: string }
        Returns: boolean
      }
      generate_event_slug: { Args: { title: string }; Returns: string }
      get_event_approved_count: {
        Args: { event_uuid: string }
        Returns: number
      }
      get_event_available_spots: {
        Args: { event_uuid: string }
        Returns: number
      }
      get_invitation_details: {
        Args: { p_invite_id: string }
        Returns: {
          child_name: string
          role_to_assign: string
          school_name: string
          status: string
        }[]
      }
      get_my_administered_school_ids: { Args: never; Returns: string[] }
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
      get_onboarding_status: { Args: never; Returns: Json }
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
      invite_parent_to_school:
      | { Args: { p_parent_email: string }; Returns: string }
      | {
        Args: {
          p_child_name?: string
          p_monthly_fee?: number
          p_parent_email: string
          p_program_id?: string
        }
        Returns: string
      }
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
      is_school_owner: { Args: { lookup_school_id: string }; Returns: boolean }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      user_school_ids: { Args: never; Returns: string[] }
      user_school_role: { Args: { p_school_id: string }; Returns: string }
      notify_user: {
        Args: {
          p_user_id: string
          p_title: string
          p_message: string
          p_type: string
          p_link: string
        }
        Returns: undefined
      }
      send_notification: {
        Args: {
          p_title: string
          p_message: string
          p_type: string
          p_link: string
        }
        Returns: undefined
      }
    }
    Enums: {
      activity_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      attend_status: "present" | "absent" | "late" | "excused" | "justified"
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
      pay_method: "pse" | "card" | "transfer" | "cash" | "other"
      pay_status: "pending" | "paid" | "overdue" | "failed" | "cancelled"
      pay_type: "one_time" | "subscription"
      program_level:
      | "iniciacion"
      | "intermedio"
      | "avanzado"
      | "alto_rendimiento"
      resv_status: "pending" | "confirmed" | "cancelled" | "completed"
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
      pay_method: ["pse", "card", "transfer", "cash", "other"],
      pay_status: ["pending", "paid", "overdue", "failed", "cancelled"],
      pay_type: ["one_time", "subscription"],
      program_level: [
        "iniciacion",
        "intermedio",
        "avanzado",
        "alto_rendimiento",
      ],
      resv_status: ["pending", "confirmed", "cancelled", "completed"],
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
      ],
    },
  },
} as const

