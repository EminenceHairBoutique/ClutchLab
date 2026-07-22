import { z } from "zod";

/**
 * Control Layout Studio catalog (spec §5.9). Element visuals are ORIGINAL —
 * simple labeled shapes, no PUBG Mobile HUD assets. Coordinates are normalized
 * landscape: x,y in [0,1] for the element CENTER; size is the diameter relative
 * to screen HEIGHT (physical aspect assumed 16:9 for distance math).
 */

export const controlElementSchema = z.object({
  slug: z.string().regex(/^[a-z0-9_]{2,50}$/),
  name: z.string().min(2),
  category: z.enum(["movement", "combat", "utility", "camera", "misc"]),
  defaultSize: z.number().min(0.02).max(0.3),
  description: z.string().nullable(),
});
export type ControlElementRecord = z.infer<typeof controlElementSchema>;

export const CONTROL_ELEMENTS: ControlElementRecord[] = [
  { slug: "movement_stick", name: "Movement stick", category: "movement", defaultSize: 0.26, description: "Left-hand locomotion joystick." },
  { slug: "sprint", name: "Sprint", category: "movement", defaultSize: 0.07, description: "Sprint lock toggle." },
  { slug: "fire_left", name: "Fire (left)", category: "combat", defaultSize: 0.11, description: "Mirrored fire for index or second thumb." },
  { slug: "fire_right", name: "Fire (right)", category: "combat", defaultSize: 0.13, description: "Primary fire button." },
  { slug: "scope", name: "ADS / scope", category: "combat", defaultSize: 0.09, description: "Aim-down-sights toggle." },
  { slug: "peek_left", name: "Peek left", category: "combat", defaultSize: 0.07, description: "Lean left." },
  { slug: "peek_right", name: "Peek right", category: "combat", defaultSize: 0.07, description: "Lean right." },
  { slug: "crouch", name: "Crouch", category: "movement", defaultSize: 0.08, description: "Crouch toggle." },
  { slug: "prone", name: "Prone", category: "movement", defaultSize: 0.07, description: "Prone toggle." },
  { slug: "jump", name: "Jump / vault", category: "movement", defaultSize: 0.09, description: "Jump and vault." },
  { slug: "reload", name: "Reload", category: "combat", defaultSize: 0.07, description: "Magazine reload." },
  { slug: "weapon_slot_1", name: "Weapon 1", category: "combat", defaultSize: 0.07, description: "Primary weapon slot." },
  { slug: "weapon_slot_2", name: "Weapon 2", category: "combat", defaultSize: 0.07, description: "Secondary weapon slot." },
  { slug: "throwable", name: "Throwable", category: "utility", defaultSize: 0.07, description: "Grenade wheel trigger." },
  { slug: "heal", name: "Heal", category: "utility", defaultSize: 0.07, description: "Smart healing prompt." },
  { slug: "free_look", name: "Free look", category: "camera", defaultSize: 0.06, description: "Eye camera." },
  { slug: "backpack", name: "Backpack", category: "misc", defaultSize: 0.06, description: "Inventory." },
  { slug: "map_ping", name: "Map / ping", category: "misc", defaultSize: 0.06, description: "Map open and pings." },
  { slug: "quick_scope_switch", name: "Quick scope switch", category: "combat", defaultSize: 0.06, description: "Swap scope magnification." },
  { slug: "canted_sight", name: "Canted sight", category: "combat", defaultSize: 0.06, description: "Toggle canted sight." },
  { slug: "fpp_swap", name: "FPP swap", category: "camera", defaultSize: 0.06, description: "TPP/FPP camera switch." },
];

export interface TemplatePosition {
  slug: string;
  x: number;
  y: number;
  size: number;
}

export interface LayoutTemplate {
  slug: string;
  name: string;
  fingerCount: 2 | 3 | 4 | 5;
  description: string;
  positions: TemplatePosition[];
}

const p = (slug: string, x: number, y: number, size?: number): TemplatePosition => {
  const element = CONTROL_ELEMENTS.find((e) => e.slug === slug);
  if (!element) throw new Error(`unknown element ${slug}`);
  return { slug, x, y, size: size ?? element.defaultSize };
};

/**
 * Editorial starting templates (sample data — users drag everything after
 * choosing one). Layouts follow common community patterns without copying any
 * specific player's published layout.
 */
export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  {
    slug: "two_finger",
    name: "Two thumbs",
    fingerCount: 2,
    description: "Classic thumbs layout: everything in the two bottom arcs.",
    positions: [
      p("movement_stick", 0.13, 0.68), p("sprint", 0.24, 0.5),
      p("fire_left", 0.08, 0.42), p("fire_right", 0.86, 0.62, 0.14),
      p("scope", 0.94, 0.44), p("jump", 0.76, 0.78), p("crouch", 0.65, 0.85),
      p("reload", 0.72, 0.6), p("weapon_slot_1", 0.42, 0.9), p("weapon_slot_2", 0.52, 0.9),
      p("throwable", 0.62, 0.95), p("heal", 0.72, 0.95), p("free_look", 0.5, 0.08),
      p("backpack", 0.97, 0.08), p("map_ping", 0.88, 0.08),
    ],
  },
  {
    slug: "three_finger",
    name: "Three-finger claw",
    fingerCount: 3,
    description: "Left index takes fire; thumbs keep movement and camera.",
    positions: [
      p("movement_stick", 0.13, 0.68), p("sprint", 0.24, 0.5),
      p("fire_left", 0.1, 0.12, 0.12), p("fire_right", 0.86, 0.62, 0.12),
      p("scope", 0.94, 0.44), p("jump", 0.76, 0.78), p("crouch", 0.65, 0.85),
      p("peek_left", 0.88, 0.28), p("peek_right", 0.96, 0.28),
      p("reload", 0.72, 0.6), p("weapon_slot_1", 0.42, 0.9), p("weapon_slot_2", 0.52, 0.9),
      p("throwable", 0.62, 0.95), p("heal", 0.72, 0.95), p("free_look", 0.5, 0.08),
    ],
  },
  {
    slug: "four_finger",
    name: "Four-finger claw",
    fingerCount: 4,
    description: "Both index fingers up top: fire left, scope right — the ranked standard.",
    positions: [
      p("movement_stick", 0.13, 0.68), p("sprint", 0.24, 0.5),
      p("fire_left", 0.1, 0.12, 0.12), p("scope", 0.9, 0.12, 0.1),
      p("fire_right", 0.86, 0.62, 0.12), p("jump", 0.76, 0.78), p("crouch", 0.66, 0.86),
      p("prone", 0.58, 0.92), p("peek_left", 0.88, 0.3), p("peek_right", 0.96, 0.3),
      p("reload", 0.72, 0.6), p("weapon_slot_1", 0.42, 0.9), p("weapon_slot_2", 0.52, 0.9),
      p("throwable", 0.3, 0.06), p("heal", 0.38, 0.06), p("free_look", 0.5, 0.08),
      p("quick_scope_switch", 0.8, 0.06),
    ],
  },
  {
    slug: "five_finger",
    name: "Five-finger claw",
    fingerCount: 5,
    description: "Adds a second left-index button for jump — entry-fragger oriented.",
    positions: [
      p("movement_stick", 0.13, 0.68), p("sprint", 0.24, 0.5),
      p("fire_left", 0.1, 0.12, 0.12), p("jump", 0.2, 0.06, 0.09),
      p("scope", 0.9, 0.12, 0.1), p("fire_right", 0.86, 0.62, 0.12),
      p("crouch", 0.66, 0.86), p("prone", 0.58, 0.92),
      p("peek_left", 0.88, 0.3), p("peek_right", 0.96, 0.3),
      p("reload", 0.72, 0.6), p("weapon_slot_1", 0.42, 0.9), p("weapon_slot_2", 0.52, 0.9),
      p("throwable", 0.3, 0.06), p("heal", 0.38, 0.06), p("free_look", 0.5, 0.08),
      p("canted_sight", 0.8, 0.06),
    ],
  },
];
