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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      delivery_methods: {
        Row: {
          contact_info: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          notes: string
        }
        Insert: {
          contact_info?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string
        }
        Update: {
          contact_info?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string
        }
        Relationships: []
      }
      followup_history: {
        Row: {
          completed_at: string
          completed_by: string | null
          completed_by_name: string
          created_at: string
          edited_at: string | null
          edited_by: string | null
          id: string
          next_followup_date: string | null
          note: string
          order_id: string
          problems_discussed: string
          step_number: number
          upsell_attempted: boolean
          upsell_details: string
        }
        Insert: {
          completed_at?: string
          completed_by?: string | null
          completed_by_name?: string
          created_at?: string
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          next_followup_date?: string | null
          note?: string
          order_id: string
          problems_discussed?: string
          step_number: number
          upsell_attempted?: boolean
          upsell_details?: string
        }
        Update: {
          completed_at?: string
          completed_by?: string | null
          completed_by_name?: string
          created_at?: string
          edited_at?: string | null
          edited_by?: string | null
          id?: string
          next_followup_date?: string | null
          note?: string
          order_id?: string
          problems_discussed?: string
          step_number?: number
          upsell_attempted?: boolean
          upsell_details?: string
        }
        Relationships: [
          {
            foreignKeyName: "followup_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_sources: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string
          assigned_to: string | null
          assigned_to_name: string
          created_at: string
          created_by: string | null
          current_status: string
          customer_name: string
          delivery_date: string | null
          delivery_method: string
          followup_date: string | null
          followup_step: number
          generated_order_id: string
          health: string
          id: string
          invoice_id: string
          is_deleted: boolean
          is_repeat: boolean
          is_upsell: boolean
          item_description: string
          mobile: string
          note: string
          order_date: string
          order_sequence_number: number
          order_source: string
          paid_amount: number
          parent_order_id: string | null
          price: number
          product_id: string | null
          product_sku: string
          product_title: string
          updated_at: string
        }
        Insert: {
          address?: string
          assigned_to?: string | null
          assigned_to_name?: string
          created_at?: string
          created_by?: string | null
          current_status?: string
          customer_name: string
          delivery_date?: string | null
          delivery_method?: string
          followup_date?: string | null
          followup_step?: number
          generated_order_id?: string
          health?: string
          id?: string
          invoice_id?: string
          is_deleted?: boolean
          is_repeat?: boolean
          is_upsell?: boolean
          item_description?: string
          mobile: string
          note?: string
          order_date?: string
          order_sequence_number?: number
          order_source?: string
          paid_amount?: number
          parent_order_id?: string | null
          price?: number
          product_id?: string | null
          product_sku?: string
          product_title?: string
          updated_at?: string
        }
        Update: {
          address?: string
          assigned_to?: string | null
          assigned_to_name?: string
          created_at?: string
          created_by?: string | null
          current_status?: string
          customer_name?: string
          delivery_date?: string | null
          delivery_method?: string
          followup_date?: string | null
          followup_step?: number
          generated_order_id?: string
          health?: string
          id?: string
          invoice_id?: string
          is_deleted?: boolean
          is_repeat?: boolean
          is_upsell?: boolean
          item_description?: string
          mobile?: string
          note?: string
          order_date?: string
          order_sequence_number?: number
          order_source?: string
          paid_amount?: number
          parent_order_id?: string | null
          price?: number
          product_id?: string | null
          product_sku?: string
          product_title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          category: string
          created_at: string
          id: string
          key: string
          label: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          key: string
          label: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          image_url: string | null
          info: string | null
          package_duration: number
          price: number
          sku: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          info?: string | null
          package_duration?: number
          price?: number
          sku: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          image_url?: string | null
          info?: string | null
          package_duration?: number
          price?: number
          sku?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      repeat_order_records: {
        Row: {
          added_by: string | null
          child_order_id: string | null
          created_at: string
          followup_id: string
          id: string
          note: string
          price: number
          product_id: string | null
          product_name: string
        }
        Insert: {
          added_by?: string | null
          child_order_id?: string | null
          created_at?: string
          followup_id: string
          id?: string
          note?: string
          price?: number
          product_id?: string | null
          product_name?: string
        }
        Update: {
          added_by?: string | null
          child_order_id?: string | null
          created_at?: string
          followup_id?: string
          id?: string
          note?: string
          price?: number
          product_id?: string | null
          product_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "repeat_order_records_child_order_id_fkey"
            columns: ["child_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repeat_order_records_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "followup_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repeat_order_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_key: string
          role: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_key: string
          role: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_key?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_key_fkey"
            columns: ["permission_key"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["key"]
          },
        ]
      }
      upsell_records: {
        Row: {
          added_by: string | null
          created_at: string
          followup_id: string
          id: string
          note: string
          price: number
          product_id: string | null
          product_name: string
        }
        Insert: {
          added_by?: string | null
          created_at?: string
          followup_id: string
          id?: string
          note?: string
          price?: number
          product_id?: string | null
          product_name?: string
        }
        Update: {
          added_by?: string | null
          created_at?: string
          followup_id?: string
          id?: string
          note?: string
          price?: number
          product_id?: string | null
          product_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "upsell_records_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "followup_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "upsell_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      advance_followup_steps: { Args: never; Returns: number }
      get_next_sku_sequence: { Args: { p_sku: string }; Returns: number }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "sub_admin" | "sales_executive"
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
      app_role: ["admin", "sub_admin", "sales_executive"],
    },
  },
} as const
