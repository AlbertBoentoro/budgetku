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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      accounts: {
        Row: {
          account_type: string
          color: string | null
          created_at: string
          currency: string
          icon: string | null
          id: string
          include_in_total: boolean
          initial_balance: number
          is_archived: boolean
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type: string
          color?: string | null
          created_at?: string
          currency?: string
          icon?: string | null
          id?: string
          include_in_total?: boolean
          initial_balance?: number
          is_archived?: boolean
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          color?: string | null
          created_at?: string
          currency?: string
          icon?: string | null
          id?: string
          include_in_total?: boolean
          initial_balance?: number
          is_archived?: boolean
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      budget_items: {
        Row: {
          budget_id: string
          category_id: string
          created_at: string
          id: string
          is_fixed: boolean
          notes: string | null
          planned_amount: number
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_id: string
          category_id: string
          created_at?: string
          id?: string
          is_fixed?: boolean
          notes?: string | null
          planned_amount: number
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_id?: string
          category_id?: string
          created_at?: string
          id?: string
          is_fixed?: boolean
          notes?: string | null
          planned_amount?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          created_at: string
          id: string
          month: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          month: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          month?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          category_type: string
          color: string | null
          created_at: string
          icon: string | null
          id: string
          is_archived: boolean
          is_system: boolean
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category_type: string
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          is_system?: boolean
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category_type?: string
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          is_archived?: boolean
          is_system?: boolean
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      email_connection_secrets: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          connection_id: string
          created_at: string
          refresh_token: string
          scopes: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          connection_id: string
          created_at?: string
          refresh_token: string
          scopes?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          connection_id?: string
          created_at?: string
          refresh_token?: string
          scopes?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_connection_secrets_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "email_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_connection_secrets_user_id_connection_id_fkey"
            columns: ["user_id", "connection_id"]
            isOneToOne: false
            referencedRelation: "email_connections"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      email_connections: {
        Row: {
          created_at: string
          email_address: string
          id: string
          last_error: string | null
          last_synced_at: string | null
          provider: string
          status: string
          sync_cursor: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email_address: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider?: string
          status?: string
          sync_cursor?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email_address?: string
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider?: string
          status?: string
          sync_cursor?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_imports: {
        Row: {
          connection_id: string
          created_at: string
          failure_reason: string | null
          gmail_message_id: string
          gmail_thread_id: string | null
          id: string
          processed_at: string | null
          received_at: string | null
          sender: string | null
          status: string
          subject: string | null
          transaction_id: string | null
          user_id: string
        }
        Insert: {
          connection_id: string
          created_at?: string
          failure_reason?: string | null
          gmail_message_id: string
          gmail_thread_id?: string | null
          id?: string
          processed_at?: string | null
          received_at?: string | null
          sender?: string | null
          status?: string
          subject?: string | null
          transaction_id?: string | null
          user_id: string
        }
        Update: {
          connection_id?: string
          created_at?: string
          failure_reason?: string | null
          gmail_message_id?: string
          gmail_thread_id?: string | null
          id?: string
          processed_at?: string | null
          received_at?: string | null
          sender?: string | null
          status?: string
          subject?: string | null
          transaction_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_imports_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_imports_user_id_connection_id_fkey"
            columns: ["user_id", "connection_id"]
            isOneToOne: false
            referencedRelation: "email_connections"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      financial_goals: {
        Row: {
          account_id: string | null
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          notes: string | null
          start_date: string
          status: string
          target_amount: number
          target_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          notes?: string | null
          start_date?: string
          status?: string
          target_amount: number
          target_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          notes?: string | null
          start_date?: string
          status?: string
          target_amount?: number
          target_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_goals_user_id_account_id_fkey"
            columns: ["user_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      goal_contributions: {
        Row: {
          amount: number
          contributed_at: string
          created_at: string
          goal_id: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          amount: number
          contributed_at?: string
          created_at?: string
          goal_id: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          contributed_at?: string
          created_at?: string
          goal_id?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_contributions_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "financial_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_rules: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          is_system: boolean
          match_type: string
          pattern: string
          priority: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          match_type?: string
          pattern: string
          priority?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          is_system?: boolean
          match_type?: string
          pattern?: string
          priority?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "merchant_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
        }
        Relationships: []
      }
      recurring_transactions: {
        Row: {
          account_id: string
          amount: number
          auto_create: boolean
          category_id: string | null
          created_at: string
          description: string | null
          destination_account_id: string | null
          end_date: string | null
          frequency: string
          id: string
          interval_count: number
          is_active: boolean
          last_generated_at: string | null
          merchant: string | null
          name: string
          next_due_date: string
          start_date: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          auto_create?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          destination_account_id?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          interval_count?: number
          is_active?: boolean
          last_generated_at?: string | null
          merchant?: string | null
          name: string
          next_due_date: string
          start_date?: string
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          auto_create?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          destination_account_id?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          interval_count?: number
          is_active?: boolean
          last_generated_at?: string | null
          merchant?: string | null
          name?: string
          next_due_date?: string
          start_date?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_transactions_user_id_account_id_fkey"
            columns: ["user_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "recurring_transactions_user_id_destination_account_id_fkey"
            columns: ["user_id", "destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          category_id: string | null
          created_at: string
          currency: string
          description: string | null
          destination_account_id: string | null
          id: string
          merchant: string | null
          source: string
          source_reference: string | null
          transaction_at: string
          transaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          amount: number
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          destination_account_id?: string | null
          id?: string
          merchant?: string | null
          source?: string
          source_reference?: string | null
          transaction_at?: string
          transaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          amount?: number
          category_id?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          destination_account_id?: string | null
          id?: string
          merchant?: string | null
          source?: string
          source_reference?: string | null
          transaction_at?: string
          transaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_user_id_account_id_fkey"
            columns: ["user_id", "account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "transactions_user_id_destination_account_id_fkey"
            columns: ["user_id", "destination_account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
