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

/**
 * Compact table typing for read-mostly content tables (Phase 2): Insert/Update
 * are Partial<Row> — NOT NULL enforcement stays with Postgres. Identity tables
 * keep fully hand-authored Insert/Update shapes.
 */
type ContentTable<Row extends Record<string, unknown>> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: [];
};

type SourceFields = {
  source_name: string | null;
  source_url: string | null;
  source_date: string | null;
};

type Timestamps = { created_at: string; updated_at: string };

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
      game_editions: ContentTable<{ slug: string; name: string; notes: string | null }>;
      regions: ContentTable<{ slug: string; name: string }>;
      game_versions: ContentTable<
        {
          id: string;
          version: string;
          edition_slug: string;
          released_on: string | null;
          window_end: string | null;
          headline: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
          confidence: Database["public"]["Enums"]["confidence_level"];
          last_verified_at: string | null;
          notes: string | null;
        } & SourceFields &
          Timestamps
      >;
      patches: ContentTable<
        {
          id: string;
          game_version_id: string;
          name: string;
          published_on: string | null;
          summary: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      patch_changes: ContentTable<
        {
          id: string;
          patch_id: string;
          change_type: Database["public"]["Enums"]["change_type"];
          area: Database["public"]["Enums"]["change_area"];
          target_slug: string | null;
          summary: string;
          detail: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
          confidence: Database["public"]["Enums"]["confidence_level"];
        } & SourceFields &
          Timestamps
      >;
      seasons: ContentTable<
        {
          id: string;
          slug: string;
          kind: Database["public"]["Enums"]["season_kind"];
          name: string;
          starts_at: string | null;
          ends_at: string | null;
          game_version_id: string | null;
          edition_slug: string;
          data_status: Database["public"]["Enums"]["data_status"];
          confidence: Database["public"]["Enums"]["confidence_level"];
          last_verified_at: string | null;
          notes: string | null;
        } & SourceFields &
          Timestamps
      >;
      event_windows: ContentTable<
        {
          id: string;
          name: string;
          mode_slug: string | null;
          starts_at: string | null;
          ends_at: string | null;
          rules_note: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      modes: ContentTable<
        {
          slug: string;
          name: string;
          description: string | null;
          aim_assist_allowed: boolean | null;
          team_sizes: string[];
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      mode_rules: ContentTable<
        {
          id: string;
          mode_slug: string;
          rule_key: string;
          rule_value: string;
          note: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      maps: ContentTable<
        {
          slug: string;
          name: string;
          size_km: number | null;
          terrain: string | null;
          description: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      map_versions: ContentTable<
        {
          id: string;
          map_slug: string;
          game_version_id: string;
          available: boolean | null;
          modes: string[];
          note: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      weapons: ContentTable<
        {
          slug: string;
          name: string;
          class: Database["public"]["Enums"]["weapon_class"];
          ammo: Database["public"]["Enums"]["ammo_type"];
          availability: Database["public"]["Enums"]["availability_kind"];
          fire_modes: string[];
          magazine_base: number | null;
          magazine_extended: number | null;
          description: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
          confidence: Database["public"]["Enums"]["confidence_level"];
          last_verified_at: string | null;
          notes: string | null;
        } & SourceFields &
          Timestamps
      >;
      weapon_versions: ContentTable<
        {
          id: string;
          weapon_slug: string;
          game_version_id: string;
          change_note: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      weapon_stats: ContentTable<
        {
          id: string;
          weapon_slug: string;
          game_version_id: string;
          stat_key: string;
          value: number;
          unit: string | null;
          measurement: Database["public"]["Enums"]["measurement_kind"];
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      weapon_availability: ContentTable<
        {
          id: string;
          weapon_slug: string;
          map_slug: string;
          game_version_id: string;
          availability: Database["public"]["Enums"]["availability_kind"];
          note: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      attachments: ContentTable<
        {
          slug: string;
          name: string;
          slot: Database["public"]["Enums"]["attachment_slot"];
          compatible_classes: string[];
          description: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      attachment_versions: ContentTable<
        {
          id: string;
          attachment_slug: string;
          game_version_id: string;
          change_note: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      attachment_effects: ContentTable<
        {
          id: string;
          attachment_slug: string;
          effect_key: string;
          direction: Database["public"]["Enums"]["effect_direction"];
          magnitude: Database["public"]["Enums"]["effect_magnitude"];
          note: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      weapon_attachments: ContentTable<{
        weapon_slug: string;
        attachment_slug: string;
        data_status: Database["public"]["Enums"]["data_status"];
      }>;
      weapon_pairings: ContentTable<
        {
          id: string;
          primary_slug: string;
          secondary_slug: string;
          archetype: string;
          rationale: string | null;
          mode_slug: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      tier_methodologies: ContentTable<
        {
          id: string;
          slug: string;
          name: string;
          version: string;
          description: string | null;
          weights: Json;
        } & Timestamps
      >;
      meta_snapshots: ContentTable<
        {
          id: string;
          slug: string;
          game_version_id: string;
          season_id: string | null;
          methodology_id: string;
          status: Database["public"]["Enums"]["snapshot_status"];
          published_at: string | null;
          notes: string | null;
          created_by: string | null;
        } & Timestamps
      >;
      weapon_tiers: ContentTable<
        {
          id: string;
          snapshot_id: string;
          weapon_slug: string;
          mode_slug: string;
          tier: Database["public"]["Enums"]["tier_letter"];
          score: number | null;
          components: Json;
          range_profile: Json;
          role: string | null;
          difficulty: Database["public"]["Enums"]["difficulty_level"];
          confidence: Database["public"]["Enums"]["confidence_level"];
          evidence_note: string | null;
          previous_tier: Database["public"]["Enums"]["tier_letter"] | null;
          change_note: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      meta_evidence: ContentTable<{
        id: string;
        weapon_tier_id: string;
        kind: Database["public"]["Enums"]["evidence_kind"];
        summary: string;
        url: string | null;
        data_status: Database["public"]["Enums"]["data_status"];
        created_at: string;
      }>;
      content_impact_links: ContentTable<
        {
          id: string;
          patch_change_id: string;
          entity_type: string;
          entity_id: string;
          impact: Database["public"]["Enums"]["impact_level"];
          note: string | null;
        } & Timestamps
      >;
      sources: ContentTable<
        {
          id: string;
          name: string;
          url: string | null;
          source_type: Database["public"]["Enums"]["source_kind"];
          published_on: string | null;
          retrieved_on: string | null;
          reliability: Database["public"]["Enums"]["reliability_level"];
          notes: string | null;
        } & Timestamps
      >;
      source_snapshots: ContentTable<{
        id: string;
        source_id: string;
        snapshot_note: string | null;
        content_hash: string | null;
        captured_at: string;
      }>;
      claims: ContentTable<
        {
          id: string;
          slug: string;
          statement: string;
          verdict: Database["public"]["Enums"]["claim_verdict"];
          confidence: Database["public"]["Enums"]["confidence_level"];
          game_version_id: string | null;
          notes: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & Timestamps
      >;
      claim_evidence: ContentTable<{
        id: string;
        claim_id: string;
        source_id: string;
        quote: string | null;
        supports: boolean | null;
        note: string | null;
        created_at: string;
      }>;
      review_tasks: ContentTable<
        {
          id: string;
          title: string;
          detail: string | null;
          kind: Database["public"]["Enums"]["review_kind"];
          entity_type: string | null;
          entity_id: string | null;
          status: Database["public"]["Enums"]["review_status"];
          priority: Database["public"]["Enums"]["priority_level"];
          resolved_by: string | null;
          resolved_at: string | null;
        } & Timestamps
      >;
      content_revisions: ContentTable<{
        id: number;
        entity_type: string;
        entity_id: string;
        action: string;
        diff: Json;
        actor_id: string | null;
        created_at: string;
      }>;
      setting_definitions: ContentTable<
        {
          slug: string;
          name: string;
          category: Database["public"]["Enums"]["setting_category"];
          what_it_does: string;
          what_it_does_not: string | null;
          advantages: string | null;
          disadvantages: string | null;
          beginner_recommendation: string | null;
          competitive_recommendation: string | null;
          mode_notes: string | null;
          device_impact: string | null;
          retest_after_update: boolean;
          data_status: Database["public"]["Enums"]["data_status"];
          confidence: Database["public"]["Enums"]["confidence_level"];
          last_verified_at: string | null;
        } & SourceFields &
          Timestamps
      >;
      setting_versions: ContentTable<
        {
          id: string;
          setting_slug: string;
          game_version_id: string;
          change_note: string | null;
          retest_required: boolean;
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      sensitivity_profiles: ContentTable<
        {
          id: string;
          user_id: string;
          name: string;
          notes: string | null;
          active_version_id: string | null;
        } & Timestamps
      >;
      sensitivity_profile_versions: ContentTable<{
        id: string;
        profile_id: string;
        version_no: number;
        note: string | null;
        origin: string;
        rolled_back_from: string | null;
        created_at: string;
      }>;
      sensitivity_values: ContentTable<{
        id: string;
        version_id: string;
        family: Database["public"]["Enums"]["sensitivity_family"];
        scope: Database["public"]["Enums"]["sensitivity_scope"] | null;
        value: number;
      }>;
      setting_codes: ContentTable<{
        id: string;
        user_id: string;
        profile_id: string | null;
        kind: Database["public"]["Enums"]["code_kind"];
        code: string;
        label: string | null;
        created_at: string;
      }>;
      sensitivity_tests: ContentTable<
        {
          slug: string;
          name: string;
          step_order: number;
          instructions: string;
          metric: string;
          adjusts_family: Database["public"]["Enums"]["sensitivity_family"] | null;
          adjusts_scope: Database["public"]["Enums"]["sensitivity_scope"] | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & Timestamps
      >;
      sensitivity_test_results: ContentTable<{
        id: string;
        user_id: string;
        profile_version_id: string | null;
        test_slug: string;
        outcome: string;
        note: string | null;
        created_at: string;
      }>;
      sensitivity_recommendations: ContentTable<{
        id: string;
        user_id: string;
        result_id: string;
        family: Database["public"]["Enums"]["sensitivity_family"] | null;
        scope: Database["public"]["Enums"]["sensitivity_scope"] | null;
        recommendation: Database["public"]["Enums"]["recommendation_kind"];
        rationale: string;
        accepted: boolean | null;
        created_at: string;
      }>;
      teams: ContentTable<
        {
          slug: string;
          name: string;
          region: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      pro_profiles: ContentTable<
        {
          slug: string;
          display_name: string;
          team_slug: string | null;
          region: string | null;
          role: string | null;
          device_label: string | null;
          fps_tier: string | null;
          finger_count: number | null;
          grip_style: Database["public"]["Enums"]["grip_style"] | null;
          gyro_mode: string | null;
          aim_assist: string | null;
          preferred_weapons: string[];
          main_modes: string[];
          verification: Database["public"]["Enums"]["verification_level"];
          game_version_label: string | null;
          stale_reason: string | null;
          is_stale: boolean;
          data_status: Database["public"]["Enums"]["data_status"];
          confidence: Database["public"]["Enums"]["confidence_level"];
          last_verified_at: string | null;
          notes: string | null;
        } & SourceFields &
          Timestamps
      >;
      pro_team_history: ContentTable<{
        id: string;
        pro_slug: string;
        team_slug: string | null;
        joined_on: string | null;
        left_on: string | null;
        data_status: Database["public"]["Enums"]["data_status"];
        source_name: string | null;
        created_at: string;
      }>;
      pro_settings: ContentTable<
        {
          id: string;
          pro_slug: string;
          family: Database["public"]["Enums"]["sensitivity_family"];
          scope: Database["public"]["Enums"]["sensitivity_scope"] | null;
          value: number;
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      verification_sources: ContentTable<{
        id: string;
        pro_slug: string;
        source_id: string;
        note: string | null;
        created_at: string;
      }>;
      verification_reviews: ContentTable<{
        id: string;
        pro_slug: string;
        reviewer_id: string | null;
        outcome: Database["public"]["Enums"]["verification_level"];
        note: string | null;
        created_at: string;
      }>;
      skills: ContentTable<
        {
          slug: string;
          name: string;
          category: string;
          description: string | null;
          sort_order: number;
          data_status: Database["public"]["Enums"]["data_status"];
        } & Timestamps
      >;
      drills: ContentTable<
        {
          slug: string;
          name: string;
          skill_slug: string;
          objective: string;
          difficulty: Database["public"]["Enums"]["drill_difficulty"];
          prerequisites: string | null;
          required_mode: string | null;
          required_map: string | null;
          weapon_note: string | null;
          scope_note: string | null;
          distance_note: string | null;
          stance_note: string | null;
          duration_minutes: number;
          repetitions: string | null;
          passing_score: string;
          advanced_score: string | null;
          common_mistakes: string | null;
          coaching_cues: string | null;
          progression_slug: string | null;
          regression_slug: string | null;
          applicable_modes: string[];
          aim_assist_variant: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
          last_verified_at: string | null;
        } & SourceFields &
          Timestamps
      >;
      drill_versions: ContentTable<
        {
          id: string;
          drill_slug: string;
          game_version_id: string;
          change_note: string | null;
          retest_required: boolean;
          data_status: Database["public"]["Enums"]["data_status"];
        } & Timestamps
      >;
      drill_steps: ContentTable<{
        id: string;
        drill_slug: string;
        step_order: number;
        instruction: string;
      }>;
      training_plans: ContentTable<
        {
          slug: string;
          name: string;
          description: string;
          minutes: number;
          focus_categories: string[];
          aim_assist_focus: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & Timestamps
      >;
      training_plan_items: ContentTable<{
        id: string;
        plan_slug: string;
        drill_slug: string;
        item_order: number;
        minutes: number;
        note: string | null;
      }>;
      benchmarks: ContentTable<
        {
          id: string;
          drill_slug: string;
          level: string;
          description: string;
          data_status: Database["public"]["Enums"]["data_status"];
        } & Timestamps
      >;
      user_training_sessions: ContentTable<
        {
          id: string;
          user_id: string;
          plan_slug: string | null;
          title: string;
          minutes_planned: number;
          status: Database["public"]["Enums"]["session_status"];
          drill_slugs: string[];
          started_at: string | null;
          completed_at: string | null;
          note: string | null;
        } & Timestamps
      >;
      drill_results: ContentTable<{
        id: string;
        user_id: string;
        session_id: string | null;
        drill_slug: string;
        passed: boolean | null;
        self_rating: number | null;
        metric_note: string | null;
        created_at: string;
      }>;
      wow_maps: ContentTable<
        {
          slug: string;
          name: string;
          creator_label: string | null;
          map_code: string | null;
          region_note: string | null;
          category: string;
          player_count: string | null;
          rules: string | null;
          status: Database["public"]["Enums"]["wow_status"];
          last_verified_at: string | null;
          data_status: Database["public"]["Enums"]["data_status"];
        } & SourceFields &
          Timestamps
      >;
      control_elements: ContentTable<
        {
          slug: string;
          name: string;
          description: string | null;
          default_size: number;
          category: string;
          data_status: Database["public"]["Enums"]["data_status"];
        } & Timestamps
      >;
      control_layouts: ContentTable<
        {
          id: string;
          user_id: string;
          name: string;
          finger_count: number;
          device_note: string | null;
          active_version_id: string | null;
        } & Timestamps
      >;
      control_layout_versions: ContentTable<{
        id: string;
        layout_id: string;
        version_no: number;
        note: string | null;
        origin: string;
        created_at: string;
      }>;
      control_positions: ContentTable<{
        id: string;
        version_id: string;
        element_slug: string;
        x: number;
        y: number;
        size: number;
      }>;
      control_analysis: ContentTable<{
        id: string;
        version_id: string;
        ergonomics_score: number;
        findings: Json;
        workloads: Json;
        engine_version: string;
        created_at: string;
      }>;
      control_test_results: ContentTable<{
        id: string;
        user_id: string;
        version_id: string | null;
        drill_slug: string;
        passed: boolean | null;
        note: string | null;
        created_at: string;
      }>;
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
      season_kind: "classic" | "casual" | "ultimate_royale" | "ranked_arena" | "metro" | "other";
      change_type: "buff" | "nerf" | "adjustment" | "new" | "removed" | "system";
      change_area:
        | "weapon"
        | "attachment"
        | "map"
        | "mode"
        | "movement"
        | "settings"
        | "audio"
        | "other";
      impact_level: "unaffected" | "review_recommended" | "retest_required" | "outdated";
      weapon_class: "ar" | "smg" | "dmr" | "sr" | "lmg" | "shotgun" | "pistol" | "other";
      ammo_type: "556" | "762" | "9mm" | "45acp" | "12gauge" | "300magnum" | "bolt" | "other";
      availability_kind: "ground_loot" | "airdrop" | "map_exclusive";
      attachment_slot: "muzzle" | "grip" | "scope" | "magazine" | "stock" | "canted";
      effect_direction: "improves" | "worsens" | "mixed" | "none" | "unknown";
      effect_magnitude: "minor" | "moderate" | "major" | "unknown";
      tier_letter: "S" | "A" | "B" | "C" | "D" | "F";
      confidence_level: "high" | "medium" | "low" | "disputed" | "unverified";
      difficulty_level: "easy" | "moderate" | "hard" | "unknown";
      snapshot_status: "draft" | "published" | "archived";
      source_kind: "official" | "press" | "news" | "creator" | "community" | "measured" | "editorial";
      reliability_level: "high" | "medium" | "low";
      claim_verdict: "supported" | "partial" | "unsupported" | "disputed" | "unverified";
      measurement_kind: "official" | "measured" | "estimated" | "disputed";
      evidence_kind: "official_note" | "measured" | "pro_usage" | "community" | "editorial";
      review_kind: "verify" | "update" | "investigate";
      review_status: "open" | "in_progress" | "done" | "dismissed";
      priority_level: "low" | "medium" | "high";
      sensitivity_family: "camera" | "ads" | "gyro" | "ads_gyro" | "free_look";
      sensitivity_scope:
        | "no_scope_tpp"
        | "no_scope_fpp"
        | "red_dot"
        | "x2"
        | "x3"
        | "x4"
        | "x6"
        | "x8";
      setting_category:
        | "aiming"
        | "controls"
        | "gyroscope"
        | "graphics"
        | "audio"
        | "gameplay"
        | "accessibility";
      recommendation_kind:
        | "keep"
        | "increase_small"
        | "increase_medium"
        | "decrease_small"
        | "decrease_medium"
        | "retest";
      verification_level:
        | "player_verified"
        | "team_verified"
        | "direct_visual"
        | "source_verified"
        | "community_submitted"
        | "unverified"
        | "expired"
        | "sample";
      code_kind: "sensitivity" | "controls";
      drill_difficulty: "beginner" | "intermediate" | "advanced";
      session_status: "planned" | "in_progress" | "completed" | "abandoned";
      wow_status: "active" | "unverified" | "retired";
      finger_zone: "left_thumb" | "right_thumb" | "left_index" | "right_index" | "other";
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
