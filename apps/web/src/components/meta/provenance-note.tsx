import type { Provenance } from "@/lib/data/meta-store";

/** Always tell the user where the data came from and what its status means. */
export function ProvenanceNote({ provenance }: { provenance: Provenance }) {
  return (
    <p className="text-xs text-faint">
      {provenance === "bundled-baseline" ? (
        <>
          Serving the bundled editorial baseline (Supabase not configured — see SETUP.md).
          Identical records to the database seed; nothing here is marked verified.
        </>
      ) : (
        <>Live database content. </>
      )}{" "}
      &ldquo;Unverified&rdquo; means pending editorial verification against official sources —
      every record carries its source and confidence.
    </p>
  );
}
