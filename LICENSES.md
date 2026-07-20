# Third-party licenses

This project's own code is MIT-licensed. It bundles or downloads the following third-party components at install/run time:

| Component | License | Notes |
|---|---|---|
| [ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) (`@ffmpeg/ffmpeg`, `@ffmpeg/util`, `@ffmpeg/core-mt`) | MIT (wrapper) / **LGPL v2.1+ and GPL components (FFmpeg core)** | The FFmpeg WASM core is used unmodified, loaded as a separate binary from `public/ffmpeg/`. The core build includes libx264 (GPL). Source: https://github.com/ffmpegwasm/ffmpeg.wasm |
| [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) via [kokoro-js](https://www.npmjs.com/package/kokoro-js) | **Apache-2.0** | TTS model downloaded to the user's browser at first use; not redistributed in this repo |
| [Next.js](https://nextjs.org) / React | MIT | |
| [Tailwind CSS](https://tailwindcss.com) | MIT | |
| [Zustand](https://github.com/pmndrs/zustand), [idb-keyval](https://github.com/jakearchibald/idb-keyval), [zod](https://zod.dev) | MIT | |
| [Inter](https://rsms.me/inter/) and [Fraunces](https://github.com/undercasetype/Fraunces) fonts | SIL OFL 1.1 | Self-hosted at build time via `next/font` |

AI captions and script generation call the OpenRouter API with the deployer's own key; usage is governed by OpenRouter's and the selected model provider's terms.
