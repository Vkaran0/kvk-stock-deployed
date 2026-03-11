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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      attendance: {
        Row: {
          check_in_address: string | null
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_selfie: string | null
          check_in_time: string | null
          check_out_address: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          check_out_selfie: string | null
          check_out_time: string | null
          created_at: string | null
          date: string
          id: string
          notes: string | null
          status: string
          user_id: string
        }
        Insert: {
          check_in_address?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_selfie?: string | null
          check_in_time?: string | null
          check_out_address?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_selfie?: string | null
          check_out_time?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          status?: string
          user_id: string
        }
        Update: {
          check_in_address?: string | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_selfie?: string | null
          check_in_time?: string | null
          check_out_address?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_selfie?: string | null
          check_out_time?: string | null
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      bill_items: {
        Row: {
          bill_id: string
          id: string
          item_code: string | null
          name: string
          price: number
          quantity: number
          stock_id: string | null
          total: number
        }
        Insert: {
          bill_id: string
          id?: string
          item_code?: string | null
          name: string
          price?: number
          quantity?: number
          stock_id?: string | null
          total?: number
        }
        Update: {
          bill_id?: string
          id?: string
          item_code?: string | null
          name?: string
          price?: number
          quantity?: number
          stock_id?: string | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_items_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          bill_number: string
          created_at: string | null
          customer_address: string | null
          customer_gst: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          discount: number
          gst_amount: number
          id: string
          notes: string | null
          payment_mode: string
          staff_id: string | null
          staff_name: string | null
          subtotal: number
          total: number
        }
        Insert: {
          bill_number: string
          created_at?: string | null
          customer_address?: string | null
          customer_gst?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount?: number
          gst_amount?: number
          id?: string
          notes?: string | null
          payment_mode?: string
          staff_id?: string | null
          staff_name?: string | null
          subtotal?: number
          total?: number
        }
        Update: {
          bill_number?: string
          created_at?: string | null
          customer_address?: string | null
          customer_gst?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          discount?: number
          gst_amount?: number
          id?: string
          notes?: string | null
          payment_mode?: string
          staff_id?: string | null
          staff_name?: string | null
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "bills_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_values: {
        Row: {
          created_at: string | null
          entity_id: string
          field_id: string
          id: string
          value: string | null
        }
        Insert: {
          created_at?: string | null
          entity_id: string
          field_id: string
          id?: string
          value?: string | null
        }
        Update: {
          created_at?: string | null
          entity_id?: string
          field_id?: string
          id?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_fields: {
        Row: {
          created_at: string | null
          entity_type: string
          field_name: string
          field_type: string
          id: string
          is_required: boolean | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          entity_type: string
          field_name: string
          field_type?: string
          id?: string
          is_required?: boolean | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          entity_type?: string
          field_name?: string
          field_type?: string
          id?: string
          is_required?: boolean | null
          sort_order?: number | null
        }
        Relationships: []
      }
      customer_reminders: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_id: string
          frequency: string
          id: string
          is_active: boolean
          message: string | null
          next_reminder_date: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          frequency?: string
          id?: string
          is_active?: boolean
          message?: string | null
          next_reminder_date: string
          title?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          frequency?: string
          id?: string
          is_active?: boolean
          message?: string | null
          next_reminder_date?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_reminders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          gst_number: string | null
          id: string
          last_purchase_date: string | null
          name: string
          notes: string | null
          phone: string | null
          primary_staff_id: string | null
          primary_staff_name: string | null
          total_purchases: number
          total_spent: number
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          last_purchase_date?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          primary_staff_id?: string | null
          primary_staff_name?: string | null
          total_purchases?: number
          total_spent?: number
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          last_purchase_date?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          primary_staff_id?: string | null
          primary_staff_name?: string | null
          total_purchases?: number
          total_spent?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      daily_stock: {
        Row: {
          closing_stock: number
          created_at: string | null
          date: string
          id: string
          opening_stock: number
          staff_id: string | null
          total_items_sold: number
          total_profit: number
          total_revenue: number
        }
        Insert: {
          closing_stock?: number
          created_at?: string | null
          date?: string
          id?: string
          opening_stock?: number
          staff_id?: string | null
          total_items_sold?: number
          total_profit?: number
          total_revenue?: number
        }
        Update: {
          closing_stock?: number
          created_at?: string | null
          date?: string
          id?: string
          opening_stock?: number
          staff_id?: string | null
          total_items_sold?: number
          total_profit?: number
          total_revenue?: number
        }
        Relationships: []
      }
      holidays: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          id?: string
          title?: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          id?: string
          title?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          aadhar_photo: string | null
          address: string | null
          address_line2: string | null
          created_at: string | null
          email: string | null
          emergency_contact: string | null
          emergency_phone: string | null
          id: string
          is_active: boolean | null
          join_date: string | null
          name: string
          phone: string | null
          photo: string | null
          signature_photo: string | null
          staff_id_number: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          aadhar_photo?: string | null
          address?: string | null
          address_line2?: string | null
          created_at?: string | null
          email?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          id?: string
          is_active?: boolean | null
          join_date?: string | null
          name: string
          phone?: string | null
          photo?: string | null
          signature_photo?: string | null
          staff_id_number?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          aadhar_photo?: string | null
          address?: string | null
          address_line2?: string | null
          created_at?: string | null
          email?: string | null
          emergency_contact?: string | null
          emergency_phone?: string | null
          id?: string
          is_active?: boolean | null
          join_date?: string | null
          name?: string
          phone?: string | null
          photo?: string | null
          signature_photo?: string | null
          staff_id_number?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shop_settings: {
        Row: {
          address: string | null
          created_at: string | null
          email: string | null
          gst_number: string | null
          id: string
          logo_url: string | null
          phone: string | null
          shop_name: string
          tagline: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          shop_name?: string
          tagline?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          email?: string | null
          gst_number?: string | null
          id?: string
          logo_url?: string | null
          phone?: string | null
          shop_name?: string
          tagline?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stock_invoices: {
        Row: {
          buy_price: number
          created_at: string | null
          id: string
          invoice_url: string
          notes: string | null
          quantity_added: number
          sell_price: number
          stock_id: string
        }
        Insert: {
          buy_price?: number
          created_at?: string | null
          id?: string
          invoice_url?: string
          notes?: string | null
          quantity_added?: number
          sell_price?: number
          stock_id: string
        }
        Update: {
          buy_price?: number
          created_at?: string | null
          id?: string
          invoice_url?: string
          notes?: string | null
          quantity_added?: number
          sell_price?: number
          stock_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_invoices_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          buy_price: number
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          in_date: string | null
          invoice_url: string | null
          item_code: string
          min_stock: number
          name: string
          quantity: number
          sell_price: number
          updated_at: string | null
        }
        Insert: {
          buy_price?: number
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          in_date?: string | null
          invoice_url?: string | null
          item_code: string
          min_stock?: number
          name: string
          quantity?: number
          sell_price?: number
          updated_at?: string | null
        }
        Update: {
          buy_price?: number
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          in_date?: string | null
          invoice_url?: string | null
          item_code?: string
          min_stock?: number
          name?: string
          quantity?: number
          sell_price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      udhari: {
        Row: {
          bill_id: string
          bill_number: string
          created_at: string | null
          customer_name: string
          customer_phone: string | null
          id: string
          paid_amount: number
          remaining_amount: number
          staff_id: string | null
          staff_name: string | null
          status: string
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          bill_id: string
          bill_number: string
          created_at?: string | null
          customer_name: string
          customer_phone?: string | null
          id?: string
          paid_amount?: number
          remaining_amount?: number
          staff_id?: string | null
          staff_name?: string | null
          status?: string
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          bill_id?: string
          bill_number?: string
          created_at?: string | null
          customer_name?: string
          customer_phone?: string | null
          id?: string
          paid_amount?: number
          remaining_amount?: number
          staff_id?: string | null
          staff_name?: string | null
          status?: string
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "udhari_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      udhari_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          notes: string | null
          payment_mode: string
          received_by: string | null
          received_by_name: string | null
          udhari_id: string
        }
        Insert: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_mode?: string
          received_by?: string | null
          received_by_name?: string | null
          udhari_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          notes?: string | null
          payment_mode?: string
          received_by?: string | null
          received_by_name?: string | null
          udhari_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "udhari_payments_udhari_id_fkey"
            columns: ["udhari_id"]
            isOneToOne: false
            referencedRelation: "udhari"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
