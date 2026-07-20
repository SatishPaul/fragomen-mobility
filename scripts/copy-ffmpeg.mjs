// Copies the multithreaded ffmpeg.wasm core from node_modules into /public so it
// is served same-origin (required by the COOP/COEP headers this app ships with).
// Runs automatically on `npm install` (postinstall).
import { cpSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const onnxPackage = join(root, "node_modules", "onnxruntime-node");
const onnxBin = join(root, "node_modules", "onnxruntime-node", "bin", "napi-v3");

if (process.env.VERCEL && existsSync(onnxPackage)) {
  rmSync(onnxPackage, { recursive: true, force: true });
  console.log("[copy-ffmpeg] removed native ONNX runtime for Vercel");
} else if (existsSync(onnxBin)) {
  for (const platform of readdirSync(onnxBin)) {
    const platformPath = join(onnxBin, platform);
    if (platform !== process.platform) {
      rmSync(platformPath, { recursive: true, force: true });
      continue;
    }

    for (const architecture of readdirSync(platformPath)) {
      if (architecture !== process.arch) {
        rmSync(join(platformPath, architecture), { recursive: true, force: true });
      }
    }
  }
  console.log(`[copy-ffmpeg] retained ONNX binaries for ${process.platform}/${process.arch}`);
}

// The UMD build is required — @ffmpeg/ffmpeg's worker loads the core with
// importScripts(), which cannot execute the ESM build.
const src = join(root, "node_modules", "@ffmpeg", "core-mt", "dist", "umd");
const dest = join(root, "public", "ffmpeg");

if (!existsSync(src)) {
  console.warn("[copy-ffmpeg] @ffmpeg/core-mt not installed yet, skipping.");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
for (const f of ["ffmpeg-core.js", "ffmpeg-core.wasm", "ffmpeg-core.worker.js"]) {
  cpSync(join(src, f), join(dest, f));
  console.log(`[copy-ffmpeg] copied ${f}`);
}
