import type { DeviceOption } from "./profile-store";

/**
 * Device options served in MOCK auth mode only (no database connection).
 * All entries are data_status='sample' — the real device knowledge base lives
 * in supabase/seed.sql and is served from Postgres when Supabase is configured.
 */
export const MOCK_DEVICES: DeviceOption[] = [
  { id: "mock-iphone-15-pro-max", label: "Apple iPhone 15 Pro Max", dataStatus: "sample" },
  { id: "mock-galaxy-s24-ultra", label: "Samsung Galaxy S24 Ultra", dataStatus: "sample" },
  { id: "mock-ipad-pro-11", label: 'Apple iPad Pro 11" (M4)', dataStatus: "sample" },
  { id: "mock-poco-f5", label: "Xiaomi POCO F5", dataStatus: "sample" },
  { id: "mock-budget-60hz", label: "Sample budget device (60 Hz)", dataStatus: "sample" },
];
