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
      ai_normalization_cache: {
        Row: {
          confidence: number
          created_at: string
          hits: number
          id: string
          input: string
          input_hash: string
          kind: string
          output: string
          project_id: string
          updated_at: string
        }
        Insert: {
          confidence?: number
          created_at?: string
          hits?: number
          id?: string
          input: string
          input_hash: string
          kind: string
          output: string
          project_id: string
          updated_at?: string
        }
        Update: {
          confidence?: number
          created_at?: string
          hits?: number
          id?: string
          input?: string
          input_hash?: string
          kind?: string
          output?: string
          project_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      commission_configs: {
        Row: {
          apply_on: string
          auto_generate: boolean
          created_at: string
          enabled: boolean
          executive_id: string
          id: string
          max_commission_cap: number | null
          min_order_value: number
          project_id: string | null
          rate: number
          type: string
          updated_at: string
        }
        Insert: {
          apply_on?: string
          auto_generate?: boolean
          created_at?: string
          enabled?: boolean
          executive_id: string
          id?: string
          max_commission_cap?: number | null
          min_order_value?: number
          project_id?: string | null
          rate?: number
          type?: string
          updated_at?: string
        }
        Update: {
          apply_on?: string
          auto_generate?: boolean
          created_at?: string
          enabled?: boolean
          executive_id?: string
          id?: string
          max_commission_cap?: number | null
          min_order_value?: number
          project_id?: string | null
          rate?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_configs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_entries: {
        Row: {
          amount: number
          created_at: string
          executive_id: string
          id: string
          order_id: string | null
          order_invoice: string
          paid_by: string | null
          paid_date: string | null
          payment_note: string
          project_id: string | null
          source: string
          status: string
        }
        Insert: {
          amount?: number
          created_at?: string
          executive_id: string
          id?: string
          order_id?: string | null
          order_invoice?: string
          paid_by?: string | null
          paid_date?: string | null
          payment_note?: string
          project_id?: string | null
          source?: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          executive_id?: string
          id?: string
          order_id?: string | null
          order_invoice?: string
          paid_by?: string | null
          paid_date?: string | null
          payment_note?: string
          project_id?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_entries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commission_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_ai_profiles: {
        Row: {
          ai_confidence: number | null
          buying_behaviour: string | null
          created_at: string
          customer_id: string
          dirty: boolean
          evidence: Json
          id: string
          last_refreshed_at: string | null
          lifetime_trend: string | null
          locked_fields: string[]
          loyalty_score: number | null
          model: string | null
          personality: string | null
          preferred_call_time: string | null
          preferred_courier: string | null
          preferred_executive_id: string | null
          preferred_language: string | null
          preferred_payment: string | null
          price_sensitivity: string | null
          product_preference: string | null
          project_id: string
          purchase_pattern: string | null
          repeat_pattern: string | null
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          buying_behaviour?: string | null
          created_at?: string
          customer_id: string
          dirty?: boolean
          evidence?: Json
          id?: string
          last_refreshed_at?: string | null
          lifetime_trend?: string | null
          locked_fields?: string[]
          loyalty_score?: number | null
          model?: string | null
          personality?: string | null
          preferred_call_time?: string | null
          preferred_courier?: string | null
          preferred_executive_id?: string | null
          preferred_language?: string | null
          preferred_payment?: string | null
          price_sensitivity?: string | null
          product_preference?: string | null
          project_id: string
          purchase_pattern?: string | null
          repeat_pattern?: string | null
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          buying_behaviour?: string | null
          created_at?: string
          customer_id?: string
          dirty?: boolean
          evidence?: Json
          id?: string
          last_refreshed_at?: string | null
          lifetime_trend?: string | null
          locked_fields?: string[]
          loyalty_score?: number | null
          model?: string | null
          personality?: string | null
          preferred_call_time?: string | null
          preferred_courier?: string | null
          preferred_executive_id?: string | null
          preferred_language?: string | null
          preferred_payment?: string | null
          price_sensitivity?: string | null
          product_preference?: string | null
          project_id?: string
          purchase_pattern?: string | null
          repeat_pattern?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_ai_profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_ai_profiles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_ai_scores: {
        Row: {
          created_at: string
          customer_id: string
          expires_at: string
          generated_at: string
          model: string | null
          project_id: string
          reasons: Json
          recommendations: Json
          scores: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          expires_at?: string
          generated_at?: string
          model?: string | null
          project_id: string
          reasons?: Json
          recommendations?: Json
          scores?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          expires_at?: string
          generated_at?: string
          model?: string | null
          project_id?: string
          reasons?: Json
          recommendations?: Json
          scores?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_ai_scores_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_memory_events: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          details: Json
          event_type: string
          followup_id: string | null
          id: string
          importance: number
          occurred_at: string
          order_id: string | null
          project_id: string
          sentiment: string | null
          source: string
          summary: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          details?: Json
          event_type: string
          followup_id?: string | null
          id?: string
          importance?: number
          occurred_at?: string
          order_id?: string | null
          project_id: string
          sentiment?: string | null
          source?: string
          summary: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          details?: Json
          event_type?: string
          followup_id?: string | null
          id?: string
          importance?: number
          occurred_at?: string
          order_id?: string | null
          project_id?: string
          sentiment?: string | null
          source?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_memory_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_memory_events_followup_id_fkey"
            columns: ["followup_id"]
            isOneToOne: false
            referencedRelation: "followup_history"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_memory_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_memory_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          assigned_by: string
          created_at: string
          customer_id: string
          id: string
          project_id: string
          reason: string | null
          tag: string
        }
        Insert: {
          assigned_by?: string
          created_at?: string
          customer_id: string
          id?: string
          project_id: string
          reason?: string | null
          tag: string
        }
        Update: {
          assigned_by?: string
          created_at?: string
          customer_id?: string
          id?: string
          project_id?: string
          reason?: string | null
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tags_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tags_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string
          avg_order_value: number
          cancelled_orders: number
          created_at: string
          delivered_orders: number
          first_order_date: string | null
          id: string
          is_active: boolean
          is_repeat_customer: boolean
          last_delivery_status: string | null
          last_executive_name: string | null
          last_followup_at: string | null
          last_order_date: string | null
          last_product: string | null
          lifetime_cod: number
          lifetime_shipping: number
          lifetime_value: number
          mobile_number: string
          name: string
          name_manually_edited: boolean
          pending_orders: number
          project_id: string
          repeat_orders: number
          returned_orders: number
          stage: string
          total_orders: number
          updated_at: string
        }
        Insert: {
          address?: string
          avg_order_value?: number
          cancelled_orders?: number
          created_at?: string
          delivered_orders?: number
          first_order_date?: string | null
          id?: string
          is_active?: boolean
          is_repeat_customer?: boolean
          last_delivery_status?: string | null
          last_executive_name?: string | null
          last_followup_at?: string | null
          last_order_date?: string | null
          last_product?: string | null
          lifetime_cod?: number
          lifetime_shipping?: number
          lifetime_value?: number
          mobile_number: string
          name?: string
          name_manually_edited?: boolean
          pending_orders?: number
          project_id: string
          repeat_orders?: number
          returned_orders?: number
          stage?: string
          total_orders?: number
          updated_at?: string
        }
        Update: {
          address?: string
          avg_order_value?: number
          cancelled_orders?: number
          created_at?: string
          delivered_orders?: number
          first_order_date?: string | null
          id?: string
          is_active?: boolean
          is_repeat_customer?: boolean
          last_delivery_status?: string | null
          last_executive_name?: string | null
          last_followup_at?: string | null
          last_order_date?: string | null
          last_product?: string | null
          lifetime_cod?: number
          lifetime_shipping?: number
          lifetime_value?: number
          mobile_number?: string
          name?: string
          name_manually_edited?: boolean
          pending_orders?: number
          project_id?: string
          repeat_orders?: number
          returned_orders?: number
          stage?: string
          total_orders?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_methods: {
        Row: {
          contact_info: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          notes: string
          project_id: string | null
        }
        Insert: {
          contact_info?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string
          project_id?: string | null
        }
        Update: {
          contact_info?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_methods_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_audit_log: {
        Row: {
          action: string
          actor_name: string | null
          actor_user_id: string | null
          canonical_customer_id: string | null
          case_type: string | null
          created_at: string
          details: Json | null
          existing_order_id: string | null
          id: string
          incoming_payload: Json | null
          loser_customer_id: string | null
          project_id: string
          reason: string | null
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_user_id?: string | null
          canonical_customer_id?: string | null
          case_type?: string | null
          created_at?: string
          details?: Json | null
          existing_order_id?: string | null
          id?: string
          incoming_payload?: Json | null
          loser_customer_id?: string | null
          project_id: string
          reason?: string | null
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_user_id?: string | null
          canonical_customer_id?: string | null
          case_type?: string | null
          created_at?: string
          details?: Json | null
          existing_order_id?: string | null
          id?: string
          incoming_payload?: Json | null
          loser_customer_id?: string | null
          project_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_audit_log_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_automation_runs: {
        Row: {
          advanced_count: number
          due_now_count: number
          error_message: string | null
          finished_at: string | null
          id: string
          reminder_count: number
          skipped_locked: boolean
          started_at: string
        }
        Insert: {
          advanced_count?: number
          due_now_count?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          reminder_count?: number
          skipped_locked?: boolean
          started_at?: string
        }
        Update: {
          advanced_count?: number
          due_now_count?: number
          error_message?: string | null
          finished_at?: string | null
          id?: string
          reminder_count?: number
          skipped_locked?: boolean
          started_at?: string
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
      followup_problems: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          label: string
          project_id: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label: string
          project_id?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          label?: string
          project_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "followup_problems_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      followup_quick_info_fields: {
        Row: {
          created_at: string
          created_by: string | null
          field_type: string
          id: string
          is_active: boolean
          label: string
          options: Json | null
          project_id: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          field_type?: string
          id?: string
          is_active?: boolean
          label: string
          options?: Json | null
          project_id?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          field_type?: string
          id?: string
          is_active?: boolean
          label?: string
          options?: Json | null
          project_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "followup_quick_info_fields_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      import_audit_events: {
        Row: {
          action: string
          actor_name: string | null
          actor_user_id: string | null
          browser: string | null
          bst_timestamp: string
          created_at: string
          device: string | null
          id: string
          import_run_id: string
          ip: string | null
          metadata: Json
          project_id: string
        }
        Insert: {
          action: string
          actor_name?: string | null
          actor_user_id?: string | null
          browser?: string | null
          bst_timestamp?: string
          created_at?: string
          device?: string | null
          id?: string
          import_run_id: string
          ip?: string | null
          metadata?: Json
          project_id: string
        }
        Update: {
          action?: string
          actor_name?: string | null
          actor_user_id?: string | null
          browser?: string | null
          bst_timestamp?: string
          created_at?: string
          device?: string | null
          id?: string
          import_run_id?: string
          ip?: string | null
          metadata?: Json
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_audit_events_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          batch_index: number
          created_at: string
          duration_ms: number | null
          error_category: string | null
          error_message: string | null
          id: string
          import_run_id: string
          project_id: string
          retry_count: number
          row_end: number
          row_start: number
          rows_failed: number
          rows_ok: number
          status: string
          updated_at: string
        }
        Insert: {
          batch_index: number
          created_at?: string
          duration_ms?: number | null
          error_category?: string | null
          error_message?: string | null
          id?: string
          import_run_id: string
          project_id: string
          retry_count?: number
          row_end: number
          row_start: number
          rows_failed?: number
          rows_ok?: number
          status?: string
          updated_at?: string
        }
        Update: {
          batch_index?: number
          created_at?: string
          duration_ms?: number | null
          error_category?: string | null
          error_message?: string | null
          id?: string
          import_run_id?: string
          project_id?: string
          retry_count?: number
          row_end?: number
          row_start?: number
          rows_failed?: number
          rows_ok?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_errors: {
        Row: {
          batch_index: number | null
          category: string
          created_at: string
          id: string
          import_run_id: string
          payload: Json | null
          project_id: string
          recommended_fix: string | null
          resolved: boolean
          retryable: boolean
          row_index: number | null
          updated_at: string
          why: string | null
        }
        Insert: {
          batch_index?: number | null
          category: string
          created_at?: string
          id?: string
          import_run_id: string
          payload?: Json | null
          project_id: string
          recommended_fix?: string | null
          resolved?: boolean
          retryable?: boolean
          row_index?: number | null
          updated_at?: string
          why?: string | null
        }
        Update: {
          batch_index?: number | null
          category?: string
          created_at?: string
          id?: string
          import_run_id?: string
          payload?: Json | null
          project_id?: string
          recommended_fix?: string | null
          resolved?: boolean
          retryable?: boolean
          row_index?: number | null
          updated_at?: string
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_errors_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_learning_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          import_run_id: string | null
          payload: Json
          project_id: string
          template_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          import_run_id?: string | null
          payload?: Json
          project_id: string
          template_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          import_run_id?: string | null
          payload?: Json
          project_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_learning_events_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_learning_events_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_learning_events_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "import_mapping_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      import_learning_suggestions: {
        Row: {
          confirmations: number
          created_at: string
          id: string
          input_value: string
          kind: string
          last_seen_at: string
          project_id: string
          promoted_at: string | null
          status: string
          suggested_value: string
          updated_at: string
        }
        Insert: {
          confirmations?: number
          created_at?: string
          id?: string
          input_value: string
          kind: string
          last_seen_at?: string
          project_id: string
          promoted_at?: string | null
          status?: string
          suggested_value: string
          updated_at?: string
        }
        Update: {
          confirmations?: number
          created_at?: string
          id?: string
          input_value?: string
          kind?: string
          last_seen_at?: string
          project_id?: string
          promoted_at?: string | null
          status?: string
          suggested_value?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_mapping_templates: {
        Row: {
          avg_health_score: number | null
          created_at: string
          created_by: string | null
          date_format: string | null
          fail_count: number | null
          header_signature: string[]
          id: string
          last_used_at: string | null
          mapping: Json
          name: string
          phone_format: string | null
          product_alias_hints: Json | null
          project_id: string
          source_hint: string | null
          status_aliases: Json | null
          success_count: number | null
          updated_at: string
          usage_count: number
        }
        Insert: {
          avg_health_score?: number | null
          created_at?: string
          created_by?: string | null
          date_format?: string | null
          fail_count?: number | null
          header_signature?: string[]
          id?: string
          last_used_at?: string | null
          mapping?: Json
          name: string
          phone_format?: string | null
          product_alias_hints?: Json | null
          project_id: string
          source_hint?: string | null
          status_aliases?: Json | null
          success_count?: number | null
          updated_at?: string
          usage_count?: number
        }
        Update: {
          avg_health_score?: number | null
          created_at?: string
          created_by?: string | null
          date_format?: string | null
          fail_count?: number | null
          header_signature?: string[]
          id?: string
          last_used_at?: string | null
          mapping?: Json
          name?: string
          phone_format?: string | null
          product_alias_hints?: Json | null
          project_id?: string
          source_hint?: string | null
          status_aliases?: Json | null
          success_count?: number | null
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      import_queue: {
        Row: {
          attempts: number
          batch_index: number
          created_at: string
          finished_at: string | null
          id: string
          import_mode: string
          import_run_id: string
          last_error: string | null
          max_attempts: number
          next_attempt_at: string
          payload_ref: string | null
          project_id: string
          started_at: string | null
          status: string
          total_batches: number
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          attempts?: number
          batch_index: number
          created_at?: string
          finished_at?: string | null
          id?: string
          import_mode?: string
          import_run_id: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload_ref?: string | null
          project_id: string
          started_at?: string | null
          status?: string
          total_batches: number
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          attempts?: number
          batch_index?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          import_mode?: string
          import_run_id?: string
          last_error?: string | null
          max_attempts?: number
          next_attempt_at?: string
          payload_ref?: string | null
          project_id?: string
          started_at?: string | null
          status?: string
          total_batches?: number
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_queue_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_runs: {
        Row: {
          ai_fixed_fields: number
          assignments: Json
          browser: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          chunk_size: number
          cleaned_rows: number
          courier_name: string | null
          created_at: string
          device: string | null
          duplicate_decisions: Json
          duplicate_rows: number
          duplicates: number
          error_message: string | null
          existing_customers: number
          file_hash: string | null
          file_storage_path: string | null
          finished_at: string | null
          health_score: Json | null
          id: string
          import_mode: string
          imported: number
          invalid_cod: number
          invalid_phone: number
          ip: string | null
          last_processed_row: number | null
          mapping: Json
          memory_peak_kb: number | null
          missing_mandatory: number
          new_customers: number
          processed_batches: number | null
          processing_ms: number
          project_id: string
          queue_wait_ms: number | null
          recommendations: Json | null
          repeat_orders: number
          report: Json
          resume_token: string | null
          resumed_at: string | null
          resumed_by: string | null
          resumed_from_row: number | null
          skipped: number
          source_filename: string | null
          speed_rows_per_sec: number | null
          started_at: string
          status: string
          template_id: string | null
          total_batches: number | null
          total_rows: number
          updated_at: string
          updated_count: number
          user_id: string | null
          user_name: string | null
        }
        Insert: {
          ai_fixed_fields?: number
          assignments?: Json
          browser?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          chunk_size?: number
          cleaned_rows?: number
          courier_name?: string | null
          created_at?: string
          device?: string | null
          duplicate_decisions?: Json
          duplicate_rows?: number
          duplicates?: number
          error_message?: string | null
          existing_customers?: number
          file_hash?: string | null
          file_storage_path?: string | null
          finished_at?: string | null
          health_score?: Json | null
          id?: string
          import_mode?: string
          imported?: number
          invalid_cod?: number
          invalid_phone?: number
          ip?: string | null
          last_processed_row?: number | null
          mapping?: Json
          memory_peak_kb?: number | null
          missing_mandatory?: number
          new_customers?: number
          processed_batches?: number | null
          processing_ms?: number
          project_id: string
          queue_wait_ms?: number | null
          recommendations?: Json | null
          repeat_orders?: number
          report?: Json
          resume_token?: string | null
          resumed_at?: string | null
          resumed_by?: string | null
          resumed_from_row?: number | null
          skipped?: number
          source_filename?: string | null
          speed_rows_per_sec?: number | null
          started_at?: string
          status?: string
          template_id?: string | null
          total_batches?: number | null
          total_rows?: number
          updated_at?: string
          updated_count?: number
          user_id?: string | null
          user_name?: string | null
        }
        Update: {
          ai_fixed_fields?: number
          assignments?: Json
          browser?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          chunk_size?: number
          cleaned_rows?: number
          courier_name?: string | null
          created_at?: string
          device?: string | null
          duplicate_decisions?: Json
          duplicate_rows?: number
          duplicates?: number
          error_message?: string | null
          existing_customers?: number
          file_hash?: string | null
          file_storage_path?: string | null
          finished_at?: string | null
          health_score?: Json | null
          id?: string
          import_mode?: string
          imported?: number
          invalid_cod?: number
          invalid_phone?: number
          ip?: string | null
          last_processed_row?: number | null
          mapping?: Json
          memory_peak_kb?: number | null
          missing_mandatory?: number
          new_customers?: number
          processed_batches?: number | null
          processing_ms?: number
          project_id?: string
          queue_wait_ms?: number | null
          recommendations?: Json | null
          repeat_orders?: number
          report?: Json
          resume_token?: string | null
          resumed_at?: string | null
          resumed_by?: string | null
          resumed_from_row?: number | null
          skipped?: number
          source_filename?: string | null
          speed_rows_per_sec?: number | null
          started_at?: string
          status?: string
          template_id?: string | null
          total_batches?: number | null
          total_rows?: number
          updated_at?: string
          updated_count?: number
          user_id?: string | null
          user_name?: string | null
        }
        Relationships: []
      }
      import_warnings: {
        Row: {
          category: string
          created_at: string
          field: string | null
          id: string
          import_run_id: string
          message: string
          project_id: string
          reason: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          row_number: number
          severity: string
          suggested_fix: Json | null
        }
        Insert: {
          category: string
          created_at?: string
          field?: string | null
          id?: string
          import_run_id: string
          message: string
          project_id: string
          reason?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          row_number: number
          severity?: string
          suggested_fix?: Json | null
        }
        Update: {
          category?: string
          created_at?: string
          field?: string | null
          id?: string
          import_run_id?: string
          message?: string
          project_id?: string
          reason?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          row_number?: number
          severity?: string
          suggested_fix?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_warnings_import_run_id_fkey"
            columns: ["import_run_id"]
            isOneToOne: false
            referencedRelation: "import_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_warnings_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          order_id: string | null
          project_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          order_id?: string | null
          project_id?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          order_id?: string | null
          project_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      order_activity_logs: {
        Row: {
          action_description: string
          action_type: string
          created_at: string
          id: string
          order_id: string
          project_id: string | null
          user_id: string | null
          user_name: string
        }
        Insert: {
          action_description?: string
          action_type?: string
          created_at?: string
          id?: string
          order_id: string
          project_id?: string | null
          user_id?: string | null
          user_name?: string
        }
        Update: {
          action_description?: string
          action_type?: string
          created_at?: string
          id?: string
          order_id?: string
          project_id?: string | null
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_activity_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_activity_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
          project_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name: string
          project_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          name?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_sources_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address: string
          approval_status: string | null
          assigned_to: string | null
          assigned_to_name: string
          cod_charge: number
          created_at: string
          created_by: string | null
          current_status: string
          customer_id: string | null
          customer_name: string
          deleted_at: string | null
          deleted_by: string | null
          deletion_reason: string | null
          delivery_date: string | null
          delivery_method: string
          delivery_status: string | null
          delivery_time: string | null
          external_order_id: string | null
          followup_date: string | null
          followup_step: number
          generated_order_id: string
          health: string
          id: string
          invoice_id: string
          invoice_no: string | null
          is_deleted: boolean
          is_repeat: boolean
          is_upsell: boolean
          item_description: string
          mobile: string
          next_followup_datetime: string | null
          note: string
          order_date: string
          order_sequence_number: number
          order_source: string
          paid_amount: number
          parent_order_id: string | null
          payment_status: string | null
          previous_status: string | null
          price: number
          product_id: string | null
          product_sku: string
          product_title: string
          project_id: string | null
          recipient_name: string | null
          restored_at: string | null
          restored_by: string | null
          rider_name: string | null
          rider_phone: string | null
          shipping_charge: number
          tracking_code: string | null
          updated_at: string
        }
        Insert: {
          address?: string
          approval_status?: string | null
          assigned_to?: string | null
          assigned_to_name?: string
          cod_charge?: number
          created_at?: string
          created_by?: string | null
          current_status?: string
          customer_id?: string | null
          customer_name: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          delivery_date?: string | null
          delivery_method?: string
          delivery_status?: string | null
          delivery_time?: string | null
          external_order_id?: string | null
          followup_date?: string | null
          followup_step?: number
          generated_order_id?: string
          health?: string
          id?: string
          invoice_id?: string
          invoice_no?: string | null
          is_deleted?: boolean
          is_repeat?: boolean
          is_upsell?: boolean
          item_description?: string
          mobile: string
          next_followup_datetime?: string | null
          note?: string
          order_date?: string
          order_sequence_number?: number
          order_source?: string
          paid_amount?: number
          parent_order_id?: string | null
          payment_status?: string | null
          previous_status?: string | null
          price?: number
          product_id?: string | null
          product_sku?: string
          product_title?: string
          project_id?: string | null
          recipient_name?: string | null
          restored_at?: string | null
          restored_by?: string | null
          rider_name?: string | null
          rider_phone?: string | null
          shipping_charge?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          approval_status?: string | null
          assigned_to?: string | null
          assigned_to_name?: string
          cod_charge?: number
          created_at?: string
          created_by?: string | null
          current_status?: string
          customer_id?: string | null
          customer_name?: string
          deleted_at?: string | null
          deleted_by?: string | null
          deletion_reason?: string | null
          delivery_date?: string | null
          delivery_method?: string
          delivery_status?: string | null
          delivery_time?: string | null
          external_order_id?: string | null
          followup_date?: string | null
          followup_step?: number
          generated_order_id?: string
          health?: string
          id?: string
          invoice_id?: string
          invoice_no?: string | null
          is_deleted?: boolean
          is_repeat?: boolean
          is_upsell?: boolean
          item_description?: string
          mobile?: string
          next_followup_datetime?: string | null
          note?: string
          order_date?: string
          order_sequence_number?: number
          order_source?: string
          paid_amount?: number
          parent_order_id?: string | null
          payment_status?: string | null
          previous_status?: string | null
          price?: number
          product_id?: string | null
          product_sku?: string
          product_title?: string
          project_id?: string | null
          recipient_name?: string | null
          restored_at?: string | null
          restored_by?: string | null
          rider_name?: string | null
          rider_phone?: string | null
          shipping_charge?: number
          tracking_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "orders_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
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
      product_aliases: {
        Row: {
          alias: string
          confidence: number | null
          created_at: string
          created_by: string | null
          id: string
          normalized_alias: string | null
          product_id: string | null
          project_id: string
          source: string | null
          status: string
          updated_at: string
        }
        Insert: {
          alias: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          normalized_alias?: string | null
          product_id?: string | null
          project_id: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          alias?: string
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          normalized_alias?: string | null
          product_id?: string | null
          project_id?: string
          source?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_aliases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_aliases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
          project_id: string | null
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
          project_id?: string | null
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
          project_id?: string | null
          sku?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_voice_enabled: boolean
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          project_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_voice_enabled?: boolean
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          project_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_voice_enabled?: boolean
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          project_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_requests: {
        Row: {
          business_name: string
          created_at: string
          email: string
          id: string
          owner_name: string
          phone: string
          project_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          business_name: string
          created_at?: string
          email: string
          id?: string
          owner_name: string
          phone?: string
          project_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          business_name?: string
          created_at?: string
          email?: string
          id?: string
          owner_name?: string
          phone?: string
          project_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          business_name: string
          created_at: string
          expiry_date: string | null
          followup_test_mode: boolean
          id: string
          is_active: boolean
          owner_user_id: string
          subscription_status: string
          updated_at: string
        }
        Insert: {
          business_name: string
          created_at?: string
          expiry_date?: string | null
          followup_test_mode?: boolean
          id?: string
          is_active?: boolean
          owner_user_id: string
          subscription_status?: string
          updated_at?: string
        }
        Update: {
          business_name?: string
          created_at?: string
          expiry_date?: string | null
          followup_test_mode?: boolean
          id?: string
          is_active?: boolean
          owner_user_id?: string
          subscription_status?: string
          updated_at?: string
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
      sales_targets: {
        Row: {
          created_at: string
          end_date: string
          executive_id: string
          id: string
          is_active: boolean
          period_type: string
          project_id: string | null
          start_date: string
          target_followups: number
          target_orders: number
          target_repeat_orders: number
          target_revenue: number
          target_upsell_count: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          end_date: string
          executive_id: string
          id?: string
          is_active?: boolean
          period_type?: string
          project_id?: string | null
          start_date: string
          target_followups?: number
          target_orders?: number
          target_repeat_orders?: number
          target_revenue?: number
          target_upsell_count?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          end_date?: string
          executive_id?: string
          id?: string
          is_active?: boolean
          period_type?: string
          project_id?: string | null
          start_date?: string
          target_followups?: number
          target_orders?: number
          target_repeat_orders?: number
          target_revenue?: number
          target_upsell_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_targets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
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
      apply_customer_tags: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      bulk_complete_followups: {
        Args: {
          p_completed_by: string
          p_completed_by_name: string
          p_next_followup_date: string
          p_note: string
          p_order_ids: string[]
          p_step_number: number
        }
        Returns: number
      }
      bulk_complete_followups_with_lock: {
        Args: {
          p_completed_by: string
          p_completed_by_name: string
          p_next_followup_date: string
          p_note: string
          p_order_ids: string[]
          p_step_number: number
          p_versions: Json
        }
        Returns: Json
      }
      bulk_restore_orders: { Args: { p_order_ids: string[] }; Returns: Json }
      bulk_soft_delete_orders: {
        Args: { p_order_ids: string[]; p_reason?: string }
        Returns: Json
      }
      bulk_update_orders: {
        Args: { p_order_ids: string[]; p_updates: Json }
        Returns: number
      }
      bulk_update_orders_with_lock: {
        Args: { p_order_ids: string[]; p_updates: Json; p_versions: Json }
        Returns: Json
      }
      cancel_import_run: {
        Args: { p_run_id: string; p_user_id: string; p_user_name: string }
        Returns: Json
      }
      claim_next_import_batch: {
        Args: { p_worker_id: string }
        Returns: {
          batch_index: number
          id: string
          import_mode: string
          import_run_id: string
          payload_ref: string
          project_id: string
        }[]
      }
      complete_import_batch: {
        Args: {
          p_duration_ms: number
          p_queue_id: string
          p_rows_failed: number
          p_rows_ok: number
        }
        Returns: undefined
      }
      data_quality_snapshot: { Args: { p_project_id: string }; Returns: Json }
      detect_order_duplicate: {
        Args: {
          p_external_order_id?: string
          p_invoice_no?: string
          p_mobile: string
          p_project_id: string
          p_tracking_code?: string
        }
        Returns: Json
      }
      enqueue_import_batches: {
        Args: {
          p_project_id: string
          p_run_id: string
          p_total_batches: number
        }
        Returns: number
      }
      fail_import_batch: {
        Args: { p_category: string; p_message: string; p_queue_id: string }
        Returns: undefined
      }
      find_or_create_customer: {
        Args: {
          p_address: string
          p_mobile: string
          p_name: string
          p_project_id: string
        }
        Returns: string
      }
      get_next_sku_sequence: { Args: { p_sku: string }; Returns: number }
      get_user_project_id: { Args: { _user_id: string }; Returns: string }
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
      import_performance_snapshot: {
        Args: { p_project_id?: string }
        Returns: Json
      }
      kick_import_worker_if_needed: { Args: never; Returns: undefined }
      mark_ai_profile_dirty: {
        Args: { _customer_id: string }
        Returns: undefined
      }
      merge_customers: {
        Args: { p_canonical_id: string; p_loser_id: string; p_reason?: string }
        Returns: Json
      }
      normalize_phone_bd: { Args: { p_raw: string }; Returns: string }
      owner_import_analytics: { Args: { p_days?: number }; Returns: Json }
      promote_learning_suggestion: {
        Args: { p_id: string }
        Returns: undefined
      }
      prune_followup_automation_runs: { Args: never; Returns: undefined }
      recalc_customer_analytics: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      record_learning_suggestion: {
        Args: {
          p_input: string
          p_kind: string
          p_project_id: string
          p_suggested: string
        }
        Returns: string
      }
      requeue_orphaned_import_batches: { Args: never; Returns: number }
      reset_learning: {
        Args: { p_kind?: string; p_project_id: string }
        Returns: number
      }
      restore_deleted_order: { Args: { p_order_id: string }; Returns: Json }
      resume_import_run: {
        Args: { p_run_id: string; p_user_id: string; p_user_name: string }
        Returns: Json
      }
      retry_failed_batches: { Args: { p_run_id: string }; Returns: number }
      run_followup_automation: { Args: never; Returns: Json }
      set_import_run_total_batches: {
        Args: { p_run_id: string; p_total_batches: number }
        Returns: undefined
      }
      soft_delete_order: {
        Args: { p_order_id: string; p_reason?: string }
        Returns: Json
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "sub_admin"
        | "sales_executive"
        | "owner"
        | "team_leader"
        | "manager"
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
      app_role: [
        "admin",
        "sub_admin",
        "sales_executive",
        "owner",
        "team_leader",
        "manager",
      ],
    },
  },
} as const
