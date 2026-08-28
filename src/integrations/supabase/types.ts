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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      invalid_form_responses: {
        Row: {
          attempted_code: string | null
          created_at: string
          form_submitted_at: string | null
          id: string
          payload: Json
          reason: string | null
        }
        Insert: {
          attempted_code?: string | null
          created_at?: string
          form_submitted_at?: string | null
          id?: string
          payload?: Json
          reason?: string | null
        }
        Update: {
          attempted_code?: string | null
          created_at?: string
          form_submitted_at?: string | null
          id?: string
          payload?: Json
          reason?: string | null
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          age: number
          cep: string
          city: string
          consent_given: boolean
          created_at: string
          email: string | null
          full_name: string
          gender: string
          google_form_completed: boolean
          google_form_completed_at: string | null
          id: string
          main_answers: Json
          nationality: string
          neighborhood: string
          number: string | null
          phone: string
          screening_answers: Json
          state: string
          street: string | null
          token_validated: boolean
          token_validated_at: string | null
          tracking_code: string | null
        }
        Insert: {
          age: number
          cep: string
          city: string
          consent_given?: boolean
          created_at?: string
          email?: string | null
          full_name: string
          gender: string
          google_form_completed?: boolean
          google_form_completed_at?: string | null
          id?: string
          main_answers?: Json
          nationality: string
          neighborhood: string
          number?: string | null
          phone: string
          screening_answers?: Json
          state: string
          street?: string | null
          token_validated?: boolean
          token_validated_at?: string | null
          tracking_code?: string | null
        }
        Update: {
          age?: number
          cep?: string
          city?: string
          consent_given?: boolean
          created_at?: string
          email?: string | null
          full_name?: string
          gender?: string
          google_form_completed?: boolean
          google_form_completed_at?: string | null
          id?: string
          main_answers?: Json
          nationality?: string
          neighborhood?: string
          number?: string | null
          phone?: string
          screening_answers?: Json
          state?: string
          street?: string | null
          token_validated?: boolean
          token_validated_at?: string | null
          tracking_code?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      valid_tokens: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          used_at: string | null
          used_by_response_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          used_at?: string | null
          used_by_response_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          used_at?: string | null
          used_by_response_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      confirm_response_with_token: {
        Args: { _tracking_code: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      mark_google_form_completed: {
        Args: { _tracking_code: string }
        Returns: boolean
      }
      register_tracking_code: { Args: { _code: string }; Returns: boolean }
      validate_and_consume_token: {
        Args: { _code: string; _response_id?: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin"
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
      app_role: ["admin"],
    },
  },
} as const
