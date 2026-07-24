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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string
          id: string
          image_url: string | null
          name: string
          slug: string
          sort_order: number
          top_category: boolean
        }
        Insert: {
          created_at?: string
          id: string
          image_url?: string | null
          name: string
          slug: string
          sort_order?: number
          top_category?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          sort_order?: number
          top_category?: boolean
        }
        Relationships: []
      }
      homepage_banners: {
        Row: {
          active: boolean
          alt_text: string
          created_at: string
          id: string
          image_url: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          alt_text?: string
          created_at?: string
          id?: string
          image_url: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          alt_text?: string
          created_at?: string
          id?: string
          image_url?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      meta_events: {
        Row: {
          content_ids: string[] | null
          created_at: string
          currency: string | null
          event_id: string | null
          event_name: string
          event_source_url: string | null
          fbtrace_id: string | null
          geo_city: string | null
          geo_country: string | null
          geo_region: string | null
          has_email: boolean
          has_phone: boolean
          id: string
          ip_address: string | null
          num_items: number | null
          reason: string | null
          source: string
          status: string
          user_agent: string | null
          value: number | null
        }
        Insert: {
          content_ids?: string[] | null
          created_at?: string
          currency?: string | null
          event_id?: string | null
          event_name: string
          event_source_url?: string | null
          fbtrace_id?: string | null
          geo_city?: string | null
          geo_country?: string | null
          geo_region?: string | null
          has_email?: boolean
          has_phone?: boolean
          id?: string
          ip_address?: string | null
          num_items?: number | null
          reason?: string | null
          source: string
          status: string
          user_agent?: string | null
          value?: number | null
        }
        Update: {
          content_ids?: string[] | null
          created_at?: string
          currency?: string | null
          event_id?: string | null
          event_name?: string
          event_source_url?: string | null
          fbtrace_id?: string | null
          geo_city?: string | null
          geo_country?: string | null
          geo_region?: string | null
          has_email?: boolean
          has_phone?: boolean
          id?: string
          ip_address?: string | null
          num_items?: number | null
          reason?: string | null
          source?: string
          status?: string
          user_agent?: string | null
          value?: number | null
        }
        Relationships: []
      }
      order_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_code: string
          product_id: string
          rating: number
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_code: string
          product_id?: string
          rating: number
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_code?: string
          product_id?: string
          rating?: number
          user_id?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          address: string
          city: string | null
          created_at: string
          customer_name: string | null
          email: string | null
          eta: string
          id: string
          items: Json
          landmark: string | null
          order_code: string
          payment: string
          phone: string
          placed: string
          progress: number
          rider: Json | null
          shipping: number
          status: string
          subtotal: number
          total: number
          user_id: string | null
        }
        Insert: {
          address: string
          city?: string | null
          created_at?: string
          customer_name?: string | null
          email?: string | null
          eta: string
          id?: string
          items?: Json
          landmark?: string | null
          order_code: string
          payment: string
          phone?: string
          placed: string
          progress?: number
          rider?: Json | null
          shipping?: number
          status?: string
          subtotal?: number
          total?: number
          user_id?: string | null
        }
        Update: {
          address?: string
          city?: string | null
          created_at?: string
          customer_name?: string | null
          email?: string | null
          eta?: string
          id?: string
          items?: Json
          landmark?: string | null
          order_code?: string
          payment?: string
          phone?: string
          placed?: string
          progress?: number
          rider?: Json | null
          shipping?: number
          status?: string
          subtotal?: number
          total?: number
          user_id?: string | null
        }
        Relationships: []
      }
      prescription_requests: {
        Row: {
          city: string
          contact_name: string
          created_at: string
          email: string
          file_paths: string[]
          id: string
          notes: string
          phone: string
          status: string
          user_id: string | null
        }
        Insert: {
          city?: string
          contact_name: string
          created_at?: string
          email?: string
          file_paths?: string[]
          id?: string
          notes?: string
          phone: string
          status?: string
          user_id?: string | null
        }
        Update: {
          city?: string
          contact_name?: string
          created_at?: string
          email?: string
          file_paths?: string[]
          id?: string
          notes?: string
          phone?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      product_costs: {
        Row: {
          product_id: string
          purchase_price: number
          updated_at: string
        }
        Insert: {
          product_id: string
          purchase_price?: number
          updated_at?: string
        }
        Update: {
          product_id?: string
          purchase_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          blurb: string
          brand: string
          cat: string
          category_id: string | null
          created_at: string
          delivered_sales_count: number
          gallery_images: string[]
          id: string
          image_url: string | null
          name: string
          price: number
          rating: number
          reviews: number
          sales_count: number
          search_vector: unknown
          size_options: Json
          sort_order: number
          stock: string
          stock_count: number
          swatch: string
          tags: string[]
          updated_at: string
          variant_options: Json
          was: number | null
        }
        Insert: {
          active?: boolean
          blurb?: string
          brand?: string
          cat?: string
          category_id?: string | null
          created_at?: string
          delivered_sales_count?: number
          gallery_images?: string[]
          id: string
          image_url?: string | null
          name: string
          price: number
          rating?: number
          reviews?: number
          sales_count?: number
          search_vector?: unknown
          size_options?: Json
          sort_order?: number
          stock?: string
          stock_count?: number
          swatch?: string
          tags?: string[]
          updated_at?: string
          variant_options?: Json
          was?: number | null
        }
        Update: {
          active?: boolean
          blurb?: string
          brand?: string
          cat?: string
          category_id?: string | null
          created_at?: string
          delivered_sales_count?: number
          gallery_images?: string[]
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          rating?: number
          reviews?: number
          sales_count?: number
          search_vector?: unknown
          size_options?: Json
          sort_order?: number
          stock?: string
          stock_count?: number
          swatch?: string
          tags?: string[]
          updated_at?: string
          variant_options?: Json
          was?: number | null
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
      profiles: {
        Row: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string
          first_name?: string
          id: string
          last_name?: string
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_product_sales: {
        Args: { p_id: string; p_qty: number }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      product_price_history: {
        Args: never
        Returns: {
          product_id: string
          qty_sold: number
          unit_price: number
        }[]
      }
      product_sales_stats: {
        Args: never
        Returns: {
          product_id: string
          sales_count: number
          total_revenue: number
        }[]
      }
      recalculate_product_sales_counts: { Args: never; Returns: undefined }
      search_products: {
        Args: {
          cat_filter?: string
          p_limit?: number
          p_offset?: number
          q: string
          sort_by?: string
        }
        Returns: {
          blurb: string
          brand: string
          cat: string
          category_name: string
          delivered_sales_count: number
          id: string
          image_url: string
          name: string
          price: number
          rating: number
          reviews: number
          sales_count: number
          size_options: Json
          stock: string
          swatch: string
          tags: string[]
          total_count: number
          variant_options: Json
          was: number
        }[]
      }
      set_profile_role: {
        Args: { new_role: string; target_user_id: string }
        Returns: undefined
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
