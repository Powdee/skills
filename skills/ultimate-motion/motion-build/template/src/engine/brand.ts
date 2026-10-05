import { continueRender, delayRender, staticFile } from "remotion";

/**
 * Load brand fonts before the first frame renders. files: weight -> public path.
 * Call once at module level (see src/film/film.ts).
 */
export function loadFonts(family: string, files: Record<string, string>) {
  if (typeof document === "undefined" || !Object.keys(files).length) return;
  const handle = delayRender(`fonts ${family}`);
  Promise.all(
    Object.entries(files).map(([weight, file]) =>
      new FontFace(family, `url(${staticFile(file)})`, { weight }).load().then((f) => document.fonts.add(f)),
    ),
  )
    .then(() => continueRender(handle))
    .catch((e) => {
      console.error("font load failed", e);
      continueRender(handle);
    });
}
