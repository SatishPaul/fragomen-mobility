import Link from "next/link";
import { Header } from "@/components/Header";
import { brand } from "@/config/brand";

const features = [
  {
    title: "AI writes the script",
    body: "A vision model looks at every photo and clip, then drafts scene-by-scene narration you can edit line by line.",
    color: "#f472b6",
  },
  {
    title: "Natural voiceover, timed to picture",
    body: "Pick a voice and each scene's duration adjusts to its narration automatically — no manual timeline work.",
    color: "#2dd4bf",
  },
  {
    title: "Every platform, one click",
    body: "16:9 for YouTube, 9:16 for Shorts, Reels and TikTok, 1:1 for feeds — re-render the same project in any of them.",
    color: "#c084fc",
  },
  {
    title: "Private by design",
    body: "Voiceover and rendering run in your browser. Your photos never leave your device — only small analysis frames do.",
    color: "#60a5fa",
  },
];

const steps = [
  ["Upload", "Drop in up to 20 photos and short clips — phone or desktop."],
  ["Style", "Choose a format and a look: Clean, Real Estate, or Bold."],
  ["Narrate", "AI drafts the script; you edit; one click voices it."],
  ["Download", "A ready-to-post MP4 with Ken Burns motion and branding."],
] as const;

export default function LandingPage() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 sm:px-6">
        <section className="py-20 text-center sm:py-28">
          <p className="mb-4 inline-block rounded-full border border-edge bg-surface px-4 py-1.5 text-xs font-medium tracking-wide text-muted">
            Photos → narrated video, entirely in your browser
          </p>
          <h1 className="mx-auto max-w-3xl font-serif text-4xl font-semibold leading-tight text-heading sm:text-6xl">
            {brand.tagline}
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Turn listing photos and quick clips into a polished, voiceover-narrated video for
            YouTube, Reels and TikTok — no editor, no uploads, no subscriptions.
          </p>
          <div className="mt-9 flex items-center justify-center gap-4">
            <Link
              href="/create"
              className="rounded-xl bg-accent px-8 py-3.5 text-base font-semibold text-accent-fg shadow-lg shadow-accent/20 transition hover:brightness-110"
            >
              Create video
            </Link>
            <a
              href="#how"
              className="rounded-xl border border-edge px-6 py-3.5 text-base font-medium text-body transition hover:border-muted hover:text-heading"
            >
              How it works
            </a>
          </div>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-2">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-edge bg-surface/80 p-6"
              style={{ borderLeft: `3px solid ${f.color}` }}
            >
              <h2 className="font-serif text-xl font-semibold text-heading">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </section>

        <section id="how" className="pb-24">
          <h2 className="text-center font-serif text-3xl font-semibold text-heading">
            Four steps, under ten minutes
          </h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            {steps.map(([title, body], i) => (
              <div key={title} className="rounded-2xl border border-edge bg-surface/80 p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-fg">
                  {i + 1}
                </span>
                <h3 className="mt-3 font-semibold text-heading">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/create"
              className="inline-block rounded-xl bg-accent px-8 py-3.5 text-base font-semibold text-accent-fg transition hover:brightness-110"
            >
              Start now — it&apos;s free
            </Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-edge/70 py-8 text-center text-xs text-muted/70">
        <p>
          {brand.name} · Works best on desktop Chrome. AI analysis sends downscaled preview
          frames to OpenRouter; media and rendering stay on your device.
        </p>
      </footer>
    </>
  );
}
