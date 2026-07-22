import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

/**
 * Rasterizes the original ClutchLab mark (src/app/icon.svg) into the PNG set
 * a PWA needs — iOS ignores SVG manifest icons entirely:
 *   src/app/apple-icon.png     180×180  (Next emits <link rel="apple-touch-icon">)
 *   public/icons/icon-192.png  192×192  purpose "any"
 *   public/icons/icon-512.png  512×512  purpose "any"
 *   public/icons/icon-maskable-512.png  512×512  purpose "maskable" (safe zone)
 *
 * Rerun after changing icon.svg: pnpm --filter @clutchlab/web generate:icons
 */

const appDir = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(appDir, "..");
const svgPath = path.join(webRoot, "src", "app", "icon.svg");
const iconsDir = path.join(webRoot, "public", "icons");

/** Full-bleed variant for maskable purpose: glyph inside the ~80% safe zone. */
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#0a0b0d"/>
  <circle cx="50" cy="50" r="16" fill="none" stroke="#00e5a0" stroke-width="3.3"/>
  <line x1="50" y1="26" x2="50" y2="37" stroke="#00e5a0" stroke-width="3.3" stroke-linecap="round"/>
  <line x1="50" y1="63" x2="50" y2="74" stroke="#00e5a0" stroke-width="3.3" stroke-linecap="round"/>
  <line x1="26" y1="50" x2="37" y2="50" stroke="#00e5a0" stroke-width="3.3" stroke-linecap="round"/>
  <line x1="63" y1="50" x2="74" y2="50" stroke="#00e5a0" stroke-width="3.3" stroke-linecap="round"/>
  <circle cx="50" cy="50" r="3.8" fill="#00e5a0"/>
</svg>`;

async function main() {
  const svg = await readFile(svgPath);
  await mkdir(iconsDir, { recursive: true });

  const render = (input, size) =>
    sharp(input, { density: 512 }).resize(size, size).png().toBuffer();

  await writeFile(path.join(webRoot, "src", "app", "apple-icon.png"), await render(svg, 180));
  await writeFile(path.join(iconsDir, "icon-192.png"), await render(svg, 192));
  await writeFile(path.join(iconsDir, "icon-512.png"), await render(svg, 512));
  await writeFile(
    path.join(iconsDir, "icon-maskable-512.png"),
    await render(Buffer.from(MASKABLE_SVG), 512),
  );
  console.log("icons written: apple-icon.png (180), icon-192, icon-512, icon-maskable-512");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
