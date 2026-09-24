// Builds the CrazyGames upload folder (dist-crazygames/): SDK entry, no PostHog
// or co-op, web-only files removed and Draco-compressed models.
import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { draco } from "@gltf-transform/functions";
import draco3d from "draco3dgltf";
import { build } from "vite";

const out = "dist-crazygames";
// Read by src/analytics.ts and src/coop-client.ts at build time.
process.env.VITE_ANALYTICS_DISABLED = "true";
process.env.VITE_COOP_ENABLED = "false";
await build({ mode: "crazygames", build: { outDir: out, emptyOutDir: true } });

// Search-engine and social-sharing files for playjunkmagnet.com only. The game
// runs in CrazyGames' iframe, so it has no tab icon, and the portal's uploader
// stalls on favicon.svg, which keeps Save disabled.
for (const file of [
  "og-image.png",
  "sitemap.xml",
  "robots.txt",
  "guide",
  "favicon.svg",
])
  rmSync(join(out, file), { recursive: true, force: true });
const html = join(out, "index.html");
writeFileSync(
  html,
  readFileSync(html, "utf8").replace(/\s*<link rel="icon"[^>]*>/, ""),
);

// Geometry-only models; Draco decodes to float attributes, so batching that
// transforms geometry at runtime (scene.ts modelBatches) keeps working.
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "draco3d.encoder": await draco3d.createEncoderModule(),
    "draco3d.decoder": await draco3d.createDecoderModule(),
  });
for (const file of readdirSync(join(out, "models"))) {
  const path = join(out, "models", file);
  const doc = await io.read(path);
  await doc.transform(
    draco({ quantizePosition: 14, quantizeNormal: 12, quantizeTexcoord: 12 }),
  );
  await io.write(path, doc);
}
const decoder = "node_modules/three/examples/jsm/libs/draco/gltf";
mkdirSync(join(out, "draco"));
for (const file of ["draco_wasm_wrapper.js", "draco_decoder.wasm"])
  copyFileSync(join(decoder, file), join(out, "draco", file));

const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(join(dir, entry.name))
      : [join(dir, entry.name)],
  );
const all = files(out);
const bytes = all.reduce((sum, file) => sum + statSync(file).size, 0);
const mb = bytes / 1048576;
// Limits and benchmarks: docs.crazygames.com/requirements/technical and
// docs.crazygames.com/resources/basic-launch-metrics.
assert.ok(all.includes(join(out, "index.html")), "Upload needs index.html");
// CrazyGames forbids links out of the game, and the guide page is removed above.
for (const file of all.filter((f) => /\.(html|js)$/.test(f)))
  assert.ok(
    !readFileSync(file, "utf8").includes("guide/"),
    `${file} links to guide/`,
  );
assert.ok(
  all.length <= 1500,
  `${all.length} files exceeds the 1500-file limit`,
);
assert.ok(mb <= 50, `${mb.toFixed(1)} MB exceeds the 50 MB limit`);
console.log(`\n${out}/: ${all.length} files, ${mb.toFixed(2)} MB`);
if (mb > 20)
  console.warn("Above the 20 MB size of top-converting CrazyGames games.");
