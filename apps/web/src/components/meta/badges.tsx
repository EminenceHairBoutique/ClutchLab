import { Badge } from "@clutchlab/ui";
import type { Enums } from "@clutchlab/types";

const CONFIDENCE_VARIANT: Record<
  Enums<"confidence_level">,
  "success" | "accent" | "warning" | "danger" | "outline"
> = {
  high: "success",
  medium: "accent",
  low: "warning",
  disputed: "danger",
  unverified: "outline",
};

export function ConfidenceBadge({ level }: { level: Enums<"confidence_level"> }) {
  return (
    <Badge variant={CONFIDENCE_VARIANT[level]} title="Editorial confidence in this record">
      {level} confidence
    </Badge>
  );
}

export function StatusBadge({ status }: { status: Enums<"data_status"> }) {
  if (status === "verified") return <Badge variant="success">verified</Badge>;
  return (
    <Badge variant="outline" title="Pending editorial verification — see sources on the record">
      {status}
    </Badge>
  );
}

const AVAILABILITY_LABEL: Record<Enums<"availability_kind">, string> = {
  ground_loot: "Ground loot",
  airdrop: "Airdrop",
  map_exclusive: "Map-exclusive",
};

export function AvailabilityBadge({ kind }: { kind: Enums<"availability_kind"> }) {
  return <Badge variant={kind === "airdrop" ? "warning" : "default"}>{AVAILABILITY_LABEL[kind]}</Badge>;
}

export const WEAPON_CLASS_LABEL: Record<Enums<"weapon_class">, string> = {
  ar: "Assault rifle",
  smg: "SMG",
  dmr: "DMR",
  sr: "Sniper rifle",
  lmg: "LMG",
  shotgun: "Shotgun",
  pistol: "Pistol",
  other: "Other",
};
