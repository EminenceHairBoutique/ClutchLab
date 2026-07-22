/**
 * Independent-product disclaimer (spec §15, §23): visible on every page.
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border pb-24 pt-6 md:pb-8">
      <div className="mx-auto w-full max-w-6xl space-y-2 px-4 text-xs text-faint">
        <p className="font-medium text-muted">
          ClutchLab is an independent training companion. It is not affiliated with, endorsed by,
          or connected to PUBG MOBILE, KRAFTON, Tencent Games, or Level Infinite. All trademarks
          belong to their respective owners.
        </p>
        <p>
          No gameplay automation, macros, overlays, or live-match assistance — ever. Analysis is
          post-match only, on recordings you upload. Recommendations are starting points to test
          on your own device, not guarantees.
        </p>
      </div>
    </footer>
  );
}
