import "server-only";

import type { Enums } from "@clutchlab/types";

import { MOCK_DEVICES } from "./profile-store.mock";
import { authMode } from "@/lib/auth/gateway";
import { getMockAuthStore } from "@/lib/auth/mock-store";
import { createServerSupabase } from "@/lib/auth/supabase-server";

export interface ProfileFormValues {
  displayName: string | null;
  handle: string | null;
  region: string | null;
  fingerCount: number | null;
  gripStyle: Enums<"grip_style"> | null;
  gyroMode: string | null;
  aimAssistPref: string | null;
  primaryDeviceId: string | null;
}

export interface DeviceOption {
  id: string;
  label: string;
  dataStatus: Enums<"data_status">;
}

export type SaveResult = { ok: true } | { ok: false; error: string };

export interface ProfileStore {
  getProfile(userId: string): Promise<ProfileFormValues | null>;
  listDevices(): Promise<DeviceOption[]>;
  saveProfile(userId: string, values: ProfileFormValues): Promise<SaveResult>;
}

/** Real implementation: Supabase with the user's session — RLS enforces ownership. */
class SupabaseProfileStore implements ProfileStore {
  async getProfile(userId: string): Promise<ProfileFormValues | null> {
    const supabase = await createServerSupabase();
    const [profileRes, playerRes, deviceRes] = await Promise.all([
      supabase.from("profiles").select("display_name, handle, region").eq("id", userId).maybeSingle(),
      supabase
        .from("player_profiles")
        .select("finger_count, grip_style, gyro_mode, aim_assist_pref")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("user_devices")
        .select("device_id")
        .eq("user_id", userId)
        .eq("is_primary", true)
        .maybeSingle(),
    ]);
    if (profileRes.error) throw new Error(`profiles read failed: ${profileRes.error.message}`);
    if (playerRes.error) throw new Error(`player_profiles read failed: ${playerRes.error.message}`);
    if (deviceRes.error) throw new Error(`user_devices read failed: ${deviceRes.error.message}`);
    if (!profileRes.data) return null;
    return {
      displayName: profileRes.data.display_name,
      handle: profileRes.data.handle,
      region: profileRes.data.region,
      fingerCount: playerRes.data?.finger_count ?? null,
      gripStyle: playerRes.data?.grip_style ?? null,
      gyroMode: playerRes.data?.gyro_mode ?? null,
      aimAssistPref: playerRes.data?.aim_assist_pref ?? null,
      primaryDeviceId: deviceRes.data?.device_id ?? null,
    };
  }

  async listDevices(): Promise<DeviceOption[]> {
    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("devices")
      .select("id, manufacturer, marketing_name, model, data_status")
      .order("manufacturer")
      .order("model");
    if (error) throw new Error(`devices read failed: ${error.message}`);
    return data.map((d) => ({
      id: d.id,
      label: `${d.manufacturer} ${d.marketing_name ?? d.model}`,
      dataStatus: d.data_status,
    }));
  }

  async saveProfile(userId: string, values: ProfileFormValues): Promise<SaveResult> {
    const supabase = await createServerSupabase();

    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        display_name: values.displayName,
        handle: values.handle,
        region: values.region,
      })
      .eq("id", userId);
    if (profileError) {
      if (profileError.code === "23505") return { ok: false, error: "That handle is already taken." };
      return { ok: false, error: `Could not save profile: ${profileError.message}` };
    }

    const { error: playerError } = await supabase.from("player_profiles").upsert({
      user_id: userId,
      finger_count: values.fingerCount,
      grip_style: values.gripStyle,
      gyro_mode: values.gyroMode,
      aim_assist_pref: values.aimAssistPref,
    });
    if (playerError) {
      return { ok: false, error: `Could not save player profile: ${playerError.message}` };
    }

    const { error: clearError } = await supabase
      .from("user_devices")
      .update({ is_primary: false })
      .eq("user_id", userId)
      .eq("is_primary", true);
    if (clearError) {
      return { ok: false, error: `Could not update devices: ${clearError.message}` };
    }
    if (values.primaryDeviceId) {
      const { error: deviceError } = await supabase
        .from("user_devices")
        .upsert(
          { user_id: userId, device_id: values.primaryDeviceId, is_primary: true },
          { onConflict: "user_id,device_id" },
        );
      if (deviceError) {
        return { ok: false, error: `Could not set primary device: ${deviceError.message}` };
      }
    }
    return { ok: true };
  }
}

/** Mock implementation backed by the in-memory auth store (dev/test only). */
class MockProfileStore implements ProfileStore {
  async getProfile(userId: string): Promise<ProfileFormValues | null> {
    const record = getMockAuthStore().getProfile(userId);
    if (!record) return null;
    return {
      displayName: record.displayName,
      handle: record.handle,
      region: record.region,
      fingerCount: record.fingerCount,
      gripStyle: (record.gripStyle as Enums<"grip_style"> | null) ?? null,
      gyroMode: record.gyroMode,
      aimAssistPref: record.aimAssistPref,
      primaryDeviceId: record.primaryDeviceId,
    };
  }

  async listDevices(): Promise<DeviceOption[]> {
    return MOCK_DEVICES;
  }

  async saveProfile(userId: string, values: ProfileFormValues): Promise<SaveResult> {
    return getMockAuthStore().updateProfile(userId, {
      displayName: values.displayName,
      handle: values.handle,
      region: values.region,
      fingerCount: values.fingerCount,
      gripStyle: values.gripStyle,
      gyroMode: values.gyroMode,
      aimAssistPref: values.aimAssistPref,
      primaryDeviceId: values.primaryDeviceId,
    });
  }
}

export function getProfileStore(): ProfileStore {
  return authMode() === "supabase" ? new SupabaseProfileStore() : new MockProfileStore();
}
