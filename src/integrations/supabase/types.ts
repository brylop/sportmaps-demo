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
        Relationships: []
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
            foreignKeyName: "activities_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
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
        Relationships: []
      }
      attendance: {
        Row: {
          child_id: string
          class_date: string
          created_at: string
          id: string
          justification_reason: string | null
          justified_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          child_id: string
          class_date: string
          created_at?: string
          id?: string
          justification_reason?: string | null
          justified_by?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          child_id?: string
          class_date?: string
          created_at?: string
          id?: string
          justification_reason?: string | null
          justified_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      children: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string
          full_name: string
          id: string
          is_demo: boolean | null
          medical_info: string | null
          parent_id: string
          school_id: string | null
          sport: string | null
          team_name: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth: string
          full_name: string
          id?: string
          is_demo?: boolean | null
          medical_info?: string | null
          parent_id: string
          school_id?: string | null
          sport?: string | null
          team_name?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string
          full_name?: string
          id?: string
          is_demo?: boolean | null
          medical_info?: string | null
          parent_id?: string
          school_id?: string | null
          sport?: string | null
          team_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          created_at: string
          end_date: string | null
          id: string
          program_id: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          id?: string
          program_id?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          end_date?: string | null
          id?: string
          program_id?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_results: {
        Row: {
          away_score: number
          created_at: string
          home_score: number
          id: string
          is_home: boolean
          match_date: string
          match_type: string
          notes: string | null
          opponent: string
          team_id: string
        }
        Insert: {
          away_score: number
          created_at?: string
          home_score: number
          id?: string
          is_home?: boolean
          match_date: string
          match_type: string
          notes?: string | null
          opponent: string
          team_id: string
        }
        Update: {
          away_score?: number
          created_at?: string
          home_score?: number
          id?: string
          is_home?: boolean
          match_date?: string
          match_type?: string
          notes?: string | null
          opponent?: string
          team_id?: string
        }
        Relationships: []
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
      payments: {
        Row: {
          amount: number
          concept: string
          created_at: string
          due_date: string
          id: string
          parent_id: string
          payment_date: string | null
          receipt_number: string | null
          receipt_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          concept: string
          created_at?: string
          due_date: string
          id?: string
          parent_id: string
          payment_date?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          amount?: number
          concept?: string
          created_at?: string
          due_date?: string
          id?: string
          parent_id?: string
          payment_date?: string | null
          receipt_number?: string | null
          receipt_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string
          id: string
          phone: string | null
          role: Database["public"]["Enums"]["user_role"]
          sportmaps_points: number
          subscription_tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          id: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          sportmaps_points?: number
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          sportmaps_points?: number
          subscription_tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          active: boolean | null
          age_max: number | null
          age_min: number | null
          created_at: string
          current_participants: number | null
          description: string | null
          id: string
          image_url: string | null
          is_demo: boolean | null
          max_participants: number | null
          name: string
          price_monthly: number
          schedule: string | null
          school_id: string | null
          sport: string
          updated_at: string
        }
        Insert: {
          active?: boolean | null
          age_max?: number | null
          age_min?: number | null
          created_at?: string
          current_participants?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_demo?: boolean | null
          max_participants?: number | null
          name: string
          price_monthly: number
          schedule?: string | null
          school_id?: string | null
          sport: string
          updated_at?: string
        }
        Update: {
          active?: boolean | null
          age_max?: number | null
          age_min?: number | null
          created_at?: string
          current_participants?: number | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_demo?: boolean | null
          max_participants?: number | null
          name?: string
          price_monthly?: number
          schedule?: string | null
          school_id?: string | null
          sport?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_school_id_fkey"
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
      schools: {
        Row: {
          address: string
          amenities: string[] | null
          city: string
          cover_image_url: string | null
          created_at: string
          description: string | null
          email: string
          id: string
          is_demo: boolean | null
          logo_url: string | null
          name: string
          owner_id: string | null
          phone: string
          rating: number | null
          sports: string[] | null
          total_reviews: number | null
          updated_at: string
          verified: boolean | null
          website: string | null
        }
        Insert: {
          address: string
          amenities?: string[] | null
          city: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          email: string
          id?: string
          is_demo?: boolean | null
          logo_url?: string | null
          name: string
          owner_id?: string | null
          phone: string
          rating?: number | null
          sports?: string[] | null
          total_reviews?: number | null
          updated_at?: string
          verified?: boolean | null
          website?: string | null
        }
        Update: {
          address?: string
          amenities?: string[] | null
          city?: string
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          email?: string
          id?: string
          is_demo?: boolean | null
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          phone?: string
          rating?: number | null
          sports?: string[] | null
          total_reviews?: number | null
          updated_at?: string
          verified?: boolean | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schools_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
        Relationships: []
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
      team_members: {
        Row: {
          created_at: string
          id: string
          parent_contact: string | null
          player_name: string
          player_number: number | null
          position: string | null
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          parent_contact?: string | null
          player_name: string
          player_number?: number | null
          position?: string | null
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          parent_contact?: string | null
          player_name?: string
          player_number?: number | null
          position?: string | null
          team_id?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          age_group: string | null
          coach_id: string
          created_at: string
          id: string
          is_demo: boolean | null
          name: string
          season: string | null
          sport: string
          updated_at: string
        }
        Insert: {
          age_group?: string | null
          coach_id: string
          created_at?: string
          id?: string
          is_demo?: boolean | null
          name: string
          season?: string | null
          sport: string
          updated_at?: string
        }
        Update: {
          age_group?: string | null
          coach_id?: string
          created_at?: string
          id?: string
          is_demo?: boolean | null
          name?: string
          season?: string | null
          sport?: string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }
    }
    Views: {
      public_user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          full_name: string | null
          id: string | null
          role: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          role?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string | null
          role?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_demo_user: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      activity_status: "scheduled" | "in_progress" | "completed" | "cancelled"
      subscription_tier: "free" | "basic" | "premium" | "enterprise"
      user_role:
        | "athlete"
        | "parent"
        | "coach"
        | "school"
        | "wellness_professional"
        | "store_owner"
        | "admin"
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
      subscription_tier: ["free", "basic", "premium", "enterprise"],
      user_role: [
        "athlete",
        "parent",
        "coach",
        "school",
        "wellness_professional",
        "store_owner",
        "admin",
      ],
    },
  },
} as const
