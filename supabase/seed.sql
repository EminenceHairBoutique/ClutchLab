-- ClutchLab seed data. Idempotent: safe to re-run.
--
-- Data integrity rules (spec §0.1.8, §2.2): nothing here is presented as verified.
-- Device hardware fields come from public manufacturer specifications and are stored
-- as data_status='unverified' pending editorial verification. Values that vary by
-- game version or are not reliably published (touch sampling, PUBG FPS tier) stay
-- NULL rather than being invented.

-- ---------------------------------------------------------------------------
-- Roles (spec §13). Rank orders "at least X" checks; guest is unauthenticated
-- and therefore never stored in user_roles.
-- ---------------------------------------------------------------------------

insert into public.roles (slug, name, description, rank) values
  ('player', 'Player', 'Standard authenticated user', 10),
  ('creator', 'Creator', 'Publishes content pending verification', 20),
  ('verified_creator', 'Verified creator', 'Identity- and source-verified creator', 30),
  ('coach', 'Coach', 'Offers coaching services', 40),
  ('editor', 'Editor', 'Maintains verified content and the device knowledge base', 50),
  ('moderator', 'Moderator', 'Moderates community content', 60),
  ('admin', 'Admin', 'Administers users, roles, and publishing', 70),
  ('super_admin', 'Super admin', 'Full control including role administration', 80)
on conflict (slug) do update
  set name = excluded.name, description = excluded.description, rank = excluded.rank;

insert into public.permissions (slug, description) values
  ('content.publish', 'Publish or update verified content'),
  ('content.review', 'Review and approve submitted content'),
  ('meta.edit', 'Edit weapon tiers and meta snapshots'),
  ('patches.ingest', 'Create patch records and normalize changes'),
  ('devices.edit', 'Maintain the device knowledge base'),
  ('pros.verify', 'Verify pro/creator settings profiles'),
  ('drills.edit', 'Author and edit training drills'),
  ('community.moderate', 'Moderate posts, comments, and reports'),
  ('users.moderate', 'Apply user-level moderation actions'),
  ('roles.manage', 'Grant and revoke user roles'),
  ('flags.manage', 'Toggle feature flags'),
  ('audit.read', 'Read audit logs')
on conflict (slug) do update set description = excluded.description;

insert into public.role_permissions (role_slug, permission_slug) values
  ('editor', 'content.publish'),
  ('editor', 'content.review'),
  ('editor', 'meta.edit'),
  ('editor', 'patches.ingest'),
  ('editor', 'devices.edit'),
  ('editor', 'pros.verify'),
  ('editor', 'drills.edit'),
  ('moderator', 'community.moderate'),
  ('moderator', 'users.moderate'),
  ('admin', 'content.publish'),
  ('admin', 'content.review'),
  ('admin', 'meta.edit'),
  ('admin', 'patches.ingest'),
  ('admin', 'devices.edit'),
  ('admin', 'pros.verify'),
  ('admin', 'drills.edit'),
  ('admin', 'community.moderate'),
  ('admin', 'users.moderate'),
  ('admin', 'flags.manage'),
  ('admin', 'audit.read'),
  ('super_admin', 'content.publish'),
  ('super_admin', 'content.review'),
  ('super_admin', 'meta.edit'),
  ('super_admin', 'patches.ingest'),
  ('super_admin', 'devices.edit'),
  ('super_admin', 'pros.verify'),
  ('super_admin', 'drills.edit'),
  ('super_admin', 'community.moderate'),
  ('super_admin', 'users.moderate'),
  ('super_admin', 'roles.manage'),
  ('super_admin', 'flags.manage'),
  ('super_admin', 'audit.read')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Device knowledge base starter set (spec §5.1).
-- Hardware fields (screen size, refresh rate) from public manufacturer specs →
-- unverified until an editor confirms. touch_sampling_hz and max_supported_fps
-- are intentionally NULL: they vary by source and game version.
-- ---------------------------------------------------------------------------

insert into public.devices
  (manufacturer, model, marketing_name, form_factor, os, screen_inches, aspect_ratio,
   refresh_rate_hz, gyro_quality, data_status, source_name, source_date, notes)
values
  ('Apple', 'iPhone 15 Pro Max', 'iPhone 15 Pro Max', 'phone', 'ios', 6.70, '19.5:9',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2023-09-22',
   'Display specs from Apple; PUBG Mobile FPS tier pending verification'),
  ('Apple', 'iPhone 15', 'iPhone 15', 'phone', 'ios', 6.10, '19.5:9',
   60, 'unknown', 'unverified', 'Manufacturer public specifications', '2023-09-22', null),
  ('Apple', 'iPhone 13', 'iPhone 13', 'phone', 'ios', 6.10, '19.5:9',
   60, 'unknown', 'unverified', 'Manufacturer public specifications', '2021-09-24', null),
  ('Apple', 'iPad Pro 11 M4', 'iPad Pro 11" (M4)', 'tablet', 'ios', 11.00, '4.3:3',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2024-05-15', null),
  ('Apple', 'iPad 10th gen', 'iPad (10th generation)', 'tablet', 'ios', 10.90, '4.3:3',
   60, 'unknown', 'unverified', 'Manufacturer public specifications', '2022-10-26', null),
  ('Samsung', 'SM-S928', 'Galaxy S24 Ultra', 'phone', 'android', 6.80, '19.5:9',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2024-01-31', null),
  ('Samsung', 'SM-S911', 'Galaxy S23', 'phone', 'android', 6.10, '19.5:9',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2023-02-17', null),
  ('Samsung', 'SM-A546', 'Galaxy A54 5G', 'phone', 'android', 6.40, '19.5:9',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2023-03-24', null),
  ('OnePlus', 'CPH2573', 'OnePlus 12', 'phone', 'android', 6.82, '19.8:9',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2024-01-23', null),
  ('Xiaomi', '23127PN0CG', 'Xiaomi 14', 'phone', 'android', 6.36, '20:9',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2023-10-31', null),
  ('Xiaomi', '23049PCD8G', 'POCO F5', 'phone', 'android', 6.67, '20:9',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2023-05-09', null),
  ('Google', 'GP4BC', 'Pixel 8 Pro', 'phone', 'android', 6.70, '20:9',
   120, 'unknown', 'unverified', 'Manufacturer public specifications', '2023-10-12', null),
  ('ASUS', 'AI2401', 'ROG Phone 8 Pro', 'phone', 'android', 6.78, '20.4:9',
   165, 'unknown', 'unverified', 'Manufacturer public specifications', '2024-01-16', null),
  ('Vivo', 'I2219', 'iQOO 11', 'phone', 'android', 6.78, '20:9',
   144, 'unknown', 'unverified', 'Manufacturer public specifications', '2022-12-08', null),
  ('Generic', 'SAMPLE-BUDGET-60', 'Sample budget device (60 Hz)', 'phone', 'android', 6.50, '20:9',
   60, 'unknown', 'sample', 'ClutchLab sample data', null,
   'Illustrative catalog entry for low-end calibration flows; not a real device')
on conflict (manufacturer, model) do update set
  marketing_name = excluded.marketing_name,
  form_factor = excluded.form_factor,
  os = excluded.os,
  screen_inches = excluded.screen_inches,
  aspect_ratio = excluded.aspect_ratio,
  refresh_rate_hz = excluded.refresh_rate_hz,
  gyro_quality = excluded.gyro_quality,
  data_status = excluded.data_status,
  source_name = excluded.source_name,
  source_date = excluded.source_date,
  notes = excluded.notes;
