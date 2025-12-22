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
      agent_payments: {
        Row: {
          amount: number
          created_at: string | null
          delivery_agent_id: string | null
          id: string
          notes: string | null
          order_id: string | null
          payment_type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          delivery_agent_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_type?: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          delivery_agent_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_payments_delivery_agent_id_fkey"
            columns: ["delivery_agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      banners: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string
          is_active: boolean | null
          link_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          is_active?: boolean | null
          link_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          link_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string
          created_at: string | null
          governorate: string | null
          id: string
          name: string
          phone: string
          phone2: string | null
        }
        Insert: {
          address: string
          created_at?: string | null
          governorate?: string | null
          id?: string
          name: string
          phone: string
          phone2?: string | null
        }
        Update: {
          address?: string
          created_at?: string | null
          governorate?: string | null
          id?: string
          name?: string
          phone?: string
          phone2?: string | null
        }
        Relationships: []
      }
      delivery_agents: {
        Row: {
          created_at: string | null
          id: string
          name: string
          phone: string
          serial_number: string
          total_owed: number | null
          total_paid: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          phone: string
          serial_number: string
          total_owed?: number | null
          total_paid?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          phone?: string
          serial_number?: string
          total_owed?: number | null
          total_paid?: number | null
        }
        Relationships: []
      }
      governorates: {
        Row: {
          created_at: string | null
          id: string
          name: string
          shipping_cost: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          shipping_cost?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          shipping_cost?: number
        }
        Relationships: []
      }
      offers: {
        Row: {
          created_at: string | null
          description_ar: string | null
          description_en: string | null
          discount_percentage: number | null
          end_date: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          start_date: string | null
          title_ar: string
          title_en: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          discount_percentage?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          start_date?: string | null
          title_ar: string
          title_en?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description_ar?: string | null
          description_en?: string | null
          discount_percentage?: number | null
          end_date?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          start_date?: string | null
          title_ar?: string
          title_en?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          order_id: string | null
          price: number
          product_details: string | null
          product_id: string | null
          quantity: number
          size: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          price: number
          product_details?: string | null
          product_id?: string | null
          quantity: number
          size?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          order_id?: string | null
          price?: number
          product_details?: string | null
          product_id?: string | null
          quantity?: number
          size?: string | null
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
          agent_shipping_cost: number | null
          created_at: string | null
          customer_id: string | null
          delivery_agent_id: string | null
          discount: number | null
          governorate_id: string | null
          id: string
          modified_amount: number | null
          notes: string | null
          order_details: string | null
          order_number: number | null
          shipping_cost: number | null
          status: Database["public"]["Enums"]["order_status"] | null
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          agent_shipping_cost?: number | null
          created_at?: string | null
          customer_id?: string | null
          delivery_agent_id?: string | null
          discount?: number | null
          governorate_id?: string | null
          id?: string
          modified_amount?: number | null
          notes?: string | null
          order_details?: string | null
          order_number?: number | null
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          total_amount: number
          updated_at?: string | null
        }
        Update: {
          agent_shipping_cost?: number | null
          created_at?: string | null
          customer_id?: string | null
          delivery_agent_id?: string | null
          discount?: number | null
          governorate_id?: string | null
          id?: string
          modified_amount?: number | null
          notes?: string | null
          order_details?: string | null
          order_number?: number | null
          shipping_cost?: number | null
          status?: Database["public"]["Enums"]["order_status"] | null
          total_amount?: number
          updated_at?: string | null
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
            foreignKeyName: "orders_delivery_agent_id_fkey"
            columns: ["delivery_agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_governorate_id_fkey"
            columns: ["governorate_id"]
            isOneToOne: false
            referencedRelation: "governorates"
            referencedColumns: ["id"]
          },
        ]
      }
      product_color_variants: {
        Row: {
          color: string
          created_at: string | null
          id: string
          product_id: string
          size_prices: Json | null
          sizes: string[] | null
          stock: number | null
          updated_at: string | null
        }
        Insert: {
          color: string
          created_at?: string | null
          id?: string
          product_id: string
          size_prices?: Json | null
          sizes?: string[] | null
          stock?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string
          created_at?: string | null
          id?: string
          product_id?: string
          size_prices?: Json | null
          sizes?: string[] | null
          stock?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_color_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          created_at: string | null
          display_order: number | null
          id: string
          image_url: string
          product_id: string | null
        }
        Insert: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url: string
          product_id?: string | null
        }
        Update: {
          created_at?: string | null
          display_order?: number | null
          id?: string
          image_url?: string
          product_id?: string | null
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
      products: {
        Row: {
          category_id: string | null
          color_options: string[] | null
          created_at: string | null
          description: string | null
          description_ar: string | null
          description_en: string | null
          details: string | null
          discount_price: number | null
          id: string
          image_url: string | null
          is_featured: boolean | null
          is_offer: boolean | null
          low_stock_threshold: number | null
          name: string
          name_ar: string | null
          name_en: string | null
          offer_price: number | null
          price: number
          quantity_pricing: Json | null
          rating: number | null
          reviews_count: number | null
          size_options: string[] | null
          size_pricing: Json | null
          stock: number | null
          stock_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          category_id?: string | null
          color_options?: string[] | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          details?: string | null
          discount_price?: number | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          is_offer?: boolean | null
          low_stock_threshold?: number | null
          name: string
          name_ar?: string | null
          name_en?: string | null
          offer_price?: number | null
          price: number
          quantity_pricing?: Json | null
          rating?: number | null
          reviews_count?: number | null
          size_options?: string[] | null
          size_pricing?: Json | null
          stock?: number | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string | null
          color_options?: string[] | null
          created_at?: string | null
          description?: string | null
          description_ar?: string | null
          description_en?: string | null
          details?: string | null
          discount_price?: number | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          is_offer?: boolean | null
          low_stock_threshold?: number | null
          name?: string
          name_ar?: string | null
          name_en?: string | null
          offer_price?: number | null
          price?: number
          quantity_pricing?: Json | null
          rating?: number | null
          reviews_count?: number | null
          size_options?: string[] | null
          size_pricing?: Json | null
          stock?: number | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          created_at: string | null
          customer_id: string | null
          delivery_agent_id: string | null
          id: string
          notes: string | null
          order_id: string | null
          return_amount: number
          returned_items: Json
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          delivery_agent_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          return_amount?: number
          returned_items?: Json
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          delivery_agent_id?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          return_amount?: number
          returned_items?: Json
        }
        Relationships: [
          {
            foreignKeyName: "returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_delivery_agent_id_fkey"
            columns: ["delivery_agent_id"]
            isOneToOne: false
            referencedRelation: "delivery_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          created_at: string | null
          id: string
          password: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          password: string
        }
        Update: {
          created_at?: string | null
          id?: string
          password?: string
        }
        Relationships: []
      }
      statistics: {
        Row: {
          id: string
          last_reset: string | null
          total_orders: number | null
          total_sales: number | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          last_reset?: string | null
          total_orders?: number | null
          total_sales?: number | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          last_reset?: string | null
          total_orders?: number | null
          total_sales?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reset_order_sequence: { Args: never; Returns: undefined }
    }
    Enums: {
      order_status:
        | "pending"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "returned"
        | "partially_returned"
        | "delivered_with_modification"
        | "return_no_shipping"
      payment_status: "pending" | "partial" | "paid"
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
      order_status: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
        "returned",
        "partially_returned",
        "delivered_with_modification",
        "return_no_shipping",
      ],
      payment_status: ["pending", "partial", "paid"],
    },
  },
} as const
