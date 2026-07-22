/**
 * Renders a JSON-LD <script> for structured data (spec §19). Server component.
 * The payload is our own trusted, serializable data; we escape "<" defensively
 * so a stray value can never break out of the script element.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}
