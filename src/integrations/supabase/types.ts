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
      affectations: {
        Row: {
          chantier_id: string
          end_date: string | null
          id: string
          personnel_id: string
          role: string | null
          start_date: string | null
        }
        Insert: {
          chantier_id: string
          end_date?: string | null
          id?: string
          personnel_id: string
          role?: string | null
          start_date?: string | null
        }
        Update: {
          chantier_id?: string
          end_date?: string | null
          id?: string
          personnel_id?: string
          role?: string | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affectations_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affectations_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      chantiers: {
        Row: {
          actual_costs: number | null
          address: string | null
          budget: number | null
          client_name: string | null
          company_id: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          name: string
          progress: number
          start_date: string | null
          status: string
        }
        Insert: {
          actual_costs?: number | null
          address?: string | null
          budget?: number | null
          client_name?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name: string
          progress?: number
          start_date?: string | null
          status?: string
        }
        Update: {
          actual_costs?: number | null
          address?: string | null
          budget?: number | null
          client_name?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          name?: string
          progress?: number
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chantiers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          bce_number: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
        }
        Insert: {
          address?: string | null
          bce_number?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
        }
        Update: {
          address?: string | null
          bce_number?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
        }
        Relationships: []
      }
      etapes: {
        Row: {
          chantier_id: string
          end_date: string | null
          id: string
          name: string
          notes: string | null
          order_index: number
          progress: number
          start_date: string | null
          status: string
        }
        Insert: {
          chantier_id: string
          end_date?: string | null
          id?: string
          name: string
          notes?: string | null
          order_index?: number
          progress?: number
          start_date?: string | null
          status?: string
        }
        Update: {
          chantier_id?: string
          end_date?: string | null
          id?: string
          name?: string
          notes?: string | null
          order_index?: number
          progress?: number
          start_date?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "etapes_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
        ]
      }
      facture_lignes: {
        Row: {
          description: string
          facture_id: string
          id: string
          order_index: number
          quantity: number
          total_ht: number
          unit_price: number
        }
        Insert: {
          description: string
          facture_id: string
          id?: string
          order_index?: number
          quantity?: number
          total_ht?: number
          unit_price?: number
        }
        Update: {
          description?: string
          facture_id?: string
          id?: string
          order_index?: number
          quantity?: number
          total_ht?: number
          unit_price?: number
        }
        Relationships: []
      }
      factures: {
        Row: {
          chantier_id: string | null
          client_address: string | null
          client_name: string
          client_vat: string | null
          company_id: string
          conditions: string | null
          created_at: string
          due_date: string | null
          id: string
          issue_date: string
          notes: string | null
          number: string
          paid_date: string | null
          payment_reference: string | null
          status: string
          subtotal_ht: number
          total_ttc: number
          type: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          chantier_id?: string | null
          client_address?: string | null
          client_name: string
          client_vat?: string | null
          company_id: string
          conditions?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          number: string
          paid_date?: string | null
          payment_reference?: string | null
          status?: string
          subtotal_ht?: number
          total_ttc?: number
          type?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          chantier_id?: string | null
          client_address?: string | null
          client_name?: string
          client_vat?: string | null
          company_id?: string
          conditions?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          issue_date?: string
          notes?: string | null
          number?: string
          paid_date?: string | null
          payment_reference?: string | null
          status?: string
          subtotal_ht?: number
          total_ttc?: number
          type?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: []
      }
      materiaux: {
        Row: {
          category: string | null
          company_id: string
          created_at: string
          id: string
          min_stock: number
          name: string
          sku: string | null
          stock_quantity: number
          supplier: string | null
          unit: string
          unit_price: number
        }
        Insert: {
          category?: string | null
          company_id: string
          created_at?: string
          id?: string
          min_stock?: number
          name: string
          sku?: string | null
          stock_quantity?: number
          supplier?: string | null
          unit?: string
          unit_price?: number
        }
        Update: {
          category?: string | null
          company_id?: string
          created_at?: string
          id?: string
          min_stock?: number
          name?: string
          sku?: string | null
          stock_quantity?: number
          supplier?: string | null
          unit?: string
          unit_price?: number
        }
        Relationships: []
      }
      onss_payments: {
        Row: {
          amount: number | null
          company_id: string
          created_at: string
          due_date: string | null
          id: string
          paid: boolean | null
          paid_date: string | null
          personnel_id: string
          quarter: number
          reference: string | null
          year: number
        }
        Insert: {
          amount?: number | null
          company_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          paid?: boolean | null
          paid_date?: string | null
          personnel_id: string
          quarter: number
          reference?: string | null
          year: number
        }
        Update: {
          amount?: number | null
          company_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          paid?: boolean | null
          paid_date?: string | null
          personnel_id?: string
          quarter?: number
          reference?: string | null
          year?: number
        }
        Relationships: []
      }
      personnel: {
        Row: {
          company_id: string
          contract_type: string | null
          created_at: string
          email: string | null
          full_name: string
          hourly_rate: number | null
          id: string
          nrn: string | null
          phone: string | null
          photo_url: string | null
          status: string
        }
        Insert: {
          company_id: string
          contract_type?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          hourly_rate?: number | null
          id?: string
          nrn?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          contract_type?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          hourly_rate?: number | null
          id?: string
          nrn?: string | null
          phone?: string | null
          photo_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "personnel_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      precompte_payments: {
        Row: {
          amount: number | null
          company_id: string
          created_at: string
          due_date: string | null
          id: string
          paid: boolean | null
          paid_date: string | null
          period_month: number
          period_year: number
          personnel_id: string
          reference: string | null
        }
        Insert: {
          amount?: number | null
          company_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          paid?: boolean | null
          paid_date?: string | null
          period_month: number
          period_year: number
          personnel_id: string
          reference?: string | null
        }
        Update: {
          amount?: number | null
          company_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          paid?: boolean | null
          paid_date?: string | null
          period_month?: number
          period_year?: number
          personnel_id?: string
          reference?: string | null
        }
        Relationships: []
      }
      presence: {
        Row: {
          chantier_id: string | null
          date: string
          hours: number | null
          id: string
          personnel_id: string
          status: string
        }
        Insert: {
          chantier_id?: string | null
          date: string
          hours?: number | null
          id?: string
          personnel_id: string
          status: string
        }
        Update: {
          chantier_id?: string | null
          date?: string
          hours?: number | null
          id?: string
          personnel_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "presence_chantier_id_fkey"
            columns: ["chantier_id"]
            isOneToOne: false
            referencedRelation: "chantiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presence_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          full_name: string | null
          id: string
          role: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          role?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      salary_payments: {
        Row: {
          company_id: string
          created_at: string
          gross_amount: number | null
          id: string
          net_amount: number | null
          paid: boolean | null
          paid_date: string | null
          payment_method: string | null
          period_month: number
          period_year: number
          personnel_id: string
          reference: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          gross_amount?: number | null
          id?: string
          net_amount?: number | null
          paid?: boolean | null
          paid_date?: string | null
          payment_method?: string | null
          period_month: number
          period_year: number
          personnel_id: string
          reference?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          gross_amount?: number | null
          id?: string
          net_amount?: number | null
          paid?: boolean | null
          paid_date?: string | null
          payment_method?: string | null
          period_month?: number
          period_year?: number
          personnel_id?: string
          reference?: string | null
        }
        Relationships: []
      }
      stock_mouvements: {
        Row: {
          chantier_id: string | null
          company_id: string
          created_at: string
          date: string
          id: string
          materiau_id: string
          notes: string | null
          quantity: number
          reference: string | null
          supplier: string | null
          total: number
          type: string
          unit_price: number
        }
        Insert: {
          chantier_id?: string | null
          company_id: string
          created_at?: string
          date?: string
          id?: string
          materiau_id: string
          notes?: string | null
          quantity?: number
          reference?: string | null
          supplier?: string | null
          total?: number
          type?: string
          unit_price?: number
        }
        Update: {
          chantier_id?: string | null
          company_id?: string
          created_at?: string
          date?: string
          id?: string
          materiau_id?: string
          notes?: string | null
          quantity?: number
          reference?: string | null
          supplier?: string | null
          total?: number
          type?: string
          unit_price?: number
        }
        Relationships: []
      }
      tva_checks: {
        Row: {
          check_date: string
          checked_by: string | null
          client_name: string
          client_vat_number: string
          company_id: string
          id: string
          is_eligible: boolean | null
          notes: string | null
          raw_response: Json | null
        }
        Insert: {
          check_date?: string
          checked_by?: string | null
          client_name: string
          client_vat_number: string
          company_id: string
          id?: string
          is_eligible?: boolean | null
          notes?: string | null
          raw_response?: Json | null
        }
        Update: {
          check_date?: string
          checked_by?: string | null
          client_name?: string
          client_vat_number?: string
          company_id?: string
          id?: string
          is_eligible?: boolean | null
          notes?: string | null
          raw_response?: Json | null
        }
        Relationships: []
      }
      vehicule_affectations: {
        Row: {
          chantier_id: string
          created_at: string
          end_date: string | null
          end_km: number | null
          id: string
          start_date: string | null
          start_km: number | null
          vehicule_id: string
        }
        Insert: {
          chantier_id: string
          created_at?: string
          end_date?: string | null
          end_km?: number | null
          id?: string
          start_date?: string | null
          start_km?: number | null
          vehicule_id: string
        }
        Update: {
          chantier_id?: string
          created_at?: string
          end_date?: string | null
          end_km?: number | null
          id?: string
          start_date?: string | null
          start_km?: number | null
          vehicule_id?: string
        }
        Relationships: []
      }
      vehicules: {
        Row: {
          brand: string | null
          company_id: string
          cost_per_km: number
          created_at: string
          ct_date: string | null
          current_km: number
          id: string
          insurance_date: string | null
          maintenance_date: string | null
          model: string | null
          photo_url: string | null
          plate: string
          status: string
          type: string
          year: number | null
        }
        Insert: {
          brand?: string | null
          company_id: string
          cost_per_km?: number
          created_at?: string
          ct_date?: string | null
          current_km?: number
          id?: string
          insurance_date?: string | null
          maintenance_date?: string | null
          model?: string | null
          photo_url?: string | null
          plate: string
          status?: string
          type?: string
          year?: number | null
        }
        Update: {
          brand?: string | null
          company_id?: string
          cost_per_km?: number
          created_at?: string
          ct_date?: string | null
          current_km?: number
          id?: string
          insurance_date?: string | null
          maintenance_date?: string | null
          model?: string | null
          photo_url?: string | null
          plate?: string
          status?: string
          type?: string
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
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
