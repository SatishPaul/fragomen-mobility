import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // SharedArrayBuffer (multithreaded ffmpeg.wasm + fast WASM TTS) requires
  // cross-origin isolation. Every third-party resource must therefore be
  // same-origin or fetched with CORS. See TRD §3.1.
  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
      ],
    },
  ],
  // The local server voice runs kokoro-js in the API route; its native ONNX
  // binaries must be required at runtime, not bundled by webpack.
  serverExternalPackages: ["kokoro-js", "@huggingface/transformers", "onnxruntime-node"],
  webpack: (config, { isServer }) => {
    if (isServer && process.env.VERCEL) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "@/lib/server/kokoro": path.resolve("lib/server/kokoro-vercel.ts"),
      };
    } else if (!isServer) {
      // kokoro-js -> @huggingface/transformers pulls in the node ONNX runtime;
      // it is never used in the browser bundle. Server-side it IS used (local
      // TTS), so the alias is client-only.
      config.resolve.alias = {
        ...config.resolve.alias,
        "onnxruntime-node": false,
      };
    }
    return config;
  },
};

export default nextConfig;
