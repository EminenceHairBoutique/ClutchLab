/**
 * Database types for the ClutchLab schema (supabase-js `Database` shape).
 *
 * Hand-authored against supabase/migrations/*.sql for now because this
 * environment can't run the Supabase type generator. Once a real project is
 * linked, regenerate with:
 *   supabase gen types typescript --linked > packages/types/src/database.ts
 * and keep this header. See SETUP.md.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          handle: string | null;
          display_name: string | null;
          bio: string | null;
          region: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          handle?: string | null;
          display_name?: string | null;
          bio?: string | null;
          region?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          handle?: string | null;
          display_name?: string | null;
          bio?: string | null;
          region?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      devices: {
        Row: {
          id: string;
          manufacturer: string;
          model: string;
          marketing_name: string | null;
          form_factor: Database["public"]["Enums"]["form_factor"];
          os: string;
          screen_inches: number | null;
          aspect_ratio: string | null;
          refresh_rate_hz: number | null;
          touch_sampling_hz: number | null;
          max_supported_fps: number | null;
          gyro_quality: Database["public"]["Enums"]["gyro_quality"];
          data_status: Database["public"]["Enums"]["data_status"];
          source_name: string | null;
          source_url: string | null;
          source_date: string | null;
          last_verified_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          manufacturer: string;
          model: string;
          marketing_name?: string | null;
          form_factor: Database["public"]["Enums"]["form_factor"];
          os: string;
          screen_inches?: number | null;
          aspect_ratio?: string | null;
          refresh_rate_hz?: number | null;
          touch_sampling_hz?: number | null;
          max_supported_fps?: number | null;
          gyro_quality?: Database["public"]["Enums"]["gyro_quality"];
          data_status?: Database["public"]["Enums"]["data_status"];
          source_name?: string | null;
          source_url?: string | null;
          source_date?: string | null;
          last_verified_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          manufacturer?: string;
          model?: string;
          marketing_name?: string | null;
          form_factor?: Database["public"]["Enums"]["form_factor"];
          os?: string;
          screen_inches?: number | null;
          aspect_ratio?: string | null;
          refresh_rate_hz?: number | null;
          touch_sampling_hz?: number | null;
          max_supported_fps?: number | null;
          gyro_quality?: Database["public"]["Enums"]["gyro_quality"];
          data_status?: Database["public"]["Enums"]["data_status"];
          source_name?: string | null;
          source_url?: string | null;
          source_date?: string | null;
          last_verified_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_devices: {
        Row: {
          id: string;
          user_id: string;
          device_id: string;
          is_primary: boolean;
          overrides: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          device_id: string;
          is_primary?: boolean;
          overrides?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          device_id?: string;
          is_primary?: boolean;
          overrides?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      player_profiles: {
        Row: {
          user_id: string;
          edition: string | null;
          game_version: string | null;
          finger_count: number | null;
          dominant_hand: Database["public"]["Enums"]["dominant_hand"] | null;
          grip_style: Database["public"]["Enums"]["grip_style"] | null;
          hand_size: string | null;
          current_rank: string | null;
          preferred_perspective: string | null;
          primary_role: string | null;
          gyro_mode: string | null;
          aim_assist_pref: string | null;
          training_minutes_per_day: number | null;
          competitive_goal: string | null;
          weaknesses: string[];
          favorite_weapons: string[];
          favorite_scopes: string[];
          main_modes: string[];
          preferred_maps: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          edition?: string | null;
          game_version?: string | null;
          finger_count?: number | null;
          dominant_hand?: Database["public"]["Enums"]["dominant_hand"] | null;
          grip_style?: Database["public"]["Enums"]["grip_style"] | null;
          hand_size?: string | null;
          current_rank?: string | null;
          preferred_perspective?: string | null;
          primary_role?: string | null;
          gyro_mode?: string | null;
          aim_assist_pref?: string | null;
          training_minutes_per_day?: number | null;
          competitive_goal?: string | null;
          weaknesses?: string[];
          favorite_weapons?: string[];
          favorite_scopes?: string[];
          main_modes?: string[];
          preferred_maps?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          edition?: string | null;
          game_version?: string | null;
          finger_count?: number | null;
          dominant_hand?: Database["public"]["Enums"]["dominant_hand"] | null;
          grip_style?: Database["public"]["Enums"]["grip_style"] | null;
          hand_size?: string | null;
          current_rank?: string | null;
          preferred_perspective?: string | null;
          primary_role?: string | null;
          gyro_mode?: string | null;
          aim_assist_pref?: string | null;
          training_minutes_per_day?: number | null;
          competitive_goal?: string | null;
          weaknesses?: string[];
          favorite_weapons?: string[];
          favorite_scopes?: string[];
          main_modes?: string[];
          preferred_maps?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      player_goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          detail: string | null;
          target_date: string | null;
          achieved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          detail?: string | null;
          target_date?: string | null;
          achieved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          detail?: string | null;
          target_date?: string | null;
          achieved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          user_id: string;
          notifications: Json;
          reduced_motion: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          notifications?: Json;
          reduced_motion?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          notifications?: Json;
          reduced_motion?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };
      roles: {
        Row: {
          slug: string;
          name: string;
          description: string | null;
          rank: number;
        };
        Insert: {
          slug: string;
          name: string;
          description?: string | null;
          rank: number;
        };
        Update: {
          slug?: string;
          name?: string;
          description?: string | null;
          rank?: number;
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          slug: string;
          description: string | null;
        };
        Insert: {
          slug: string;
          description?: string | null;
        };
        Update: {
          slug?: string;
          description?: string | null;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          role_slug: string;
          permission_slug: string;
        };
        Insert: {
          role_slug: string;
          permission_slug: string;
        };
        Update: {
          role_slug?: string;
          permission_slug?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role_slug: string;
          granted_by: string | null;
          granted_at: string;
        };
        Insert: {
          user_id: string;
          role_slug: string;
          granted_by?: string | null;
          granted_at?: string;
        };
        Update: {
          user_id?: string;
          role_slug?: string;
          granted_by?: string | null;
          granted_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: Database["public"]["Enums"]["plan_tier"];
          status: Database["public"]["Enums"]["subscription_status"];
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan?: Database["public"]["Enums"]["plan_tier"];
          status?: Database["public"]["Enums"]["subscription_status"];
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan?: Database["public"]["Enums"]["plan_tier"];
          status?: Database["public"]["Enums"]["subscription_status"];
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: number;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          detail: Json;
          created_at: string;
        };
        Insert: {
          actor_id?: string | null;
          action: string;
          entity_type: string;
          entity_id?: string | null;
          detail?: Json;
          created_at?: string;
        };
        Update: {
          actor_id?: string | null;
          action?: string;
          entity_type?: string;
          entity_id?: string | null;
          detail?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      has_role: {
        Args: { required_role: string };
        Returns: boolean;
      };
      has_role_at_least: {
        Args: { required_role: string };
        Returns: boolean;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      data_status: "verified" | "unverified" | "sample";
      plan_tier: "free" | "pro" | "elite";
      subscription_status: "active" | "trialing" | "past_due" | "canceled" | "incomplete";
      form_factor: "phone" | "tablet";
      gyro_quality: "none" | "poor" | "average" | "good" | "excellent" | "unknown";
      dominant_hand: "left" | "right" | "ambidextrous";
      grip_style: "thumbs" | "claw_3" | "claw_4" | "claw_5" | "claw_6" | "hybrid" | "other";
    };
    CompositeTypes: Record<string, never>;
  };
}

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
