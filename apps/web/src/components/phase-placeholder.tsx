import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@clutchlab/ui";

interface PhasePlaceholderProps {
  title: string;
  description: string;
  phase: number;
  planned: readonly string[];
}

/**
 * Honest in-development state for a destination whose feature set arrives in a
 * later phase (spec §0.1.7): a real shell, a clear status, and the planned
 * scope — never mocked data presented as live.
 */
export function PhasePlaceholder({ title, description, phase, planned }: PhasePlaceholderProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          <Badge variant="outline">Phase {phase} · in development</Badge>
        </div>
        <p className="text-sm text-muted">{description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What ships here</CardTitle>
          <CardDescription>
            This section is being built in implementation phase {phase}. Planned scope:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted">
            {planned.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="text-xs text-faint">
        ClutchLab never shows fabricated stats or settings. Sections appear here only once their
        data carries sources, versions, and verification status.
      </p>
    </div>
  );
}
