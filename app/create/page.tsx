"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { StepCard } from "@/components/StepCard";
import { Stepper, type StepperItem } from "@/components/Stepper";
import { UploadStep } from "@/components/UploadStep";
import { FormatStep } from "@/components/FormatStep";
import { ScriptStep } from "@/components/ScriptStep";
import { VoiceStep } from "@/components/VoiceStep";
import { RenderStep } from "@/components/RenderStep";
import { PublishStep } from "@/components/PublishStep";
import { Sidebar } from "@/components/Sidebar";
import { clearDraft, restoreDraft } from "@/lib/draft";
import { setCustomTrack } from "@/lib/music";
import { clearLatestRenderOutput } from "@/lib/render-output";
import { useProject } from "@/lib/store";
import { clearSceneAudio, totalDuration } from "@/lib/tts";

export default function CreatePage() {
  const { assets, scenes, render } = useProject();
  const [restored, setRestored] = useState(false);
  const [projected, setProjected] = useState(0);
  const [confirmNew, setConfirmNew] = useState(false);

  useEffect(() => {
    restoreDraft().then((had) => setRestored(had));
  }, []);

  /** Wipes the whole project: state, saved draft, audio, uploaded music. */
  function startNew() {
    if (!confirmNew) {
      setConfirmNew(true);
      setTimeout(() => setConfirmNew(false), 4000);
      return;
    }
    const s = useProject.getState();
    if (s.render.url) URL.revokeObjectURL(s.render.url);
    clearLatestRenderOutput();
    clearSceneAudio();
    setCustomTrack(null);
    s.reset();
    clearDraft();
    setConfirmNew(false);
    setRestored(false);
    setProjected(0);
  }

  useEffect(() => {
    setProjected(totalDuration());
  }, [scenes]);

  const hasMedia = assets.length > 0;
  const scriptReady = scenes.length > 0;
  const voReady =
    scriptReady && scenes.every((s) => !s.line.trim() || s.audioDuration !== undefined);
  const rendered = render.status === "done";

  const steps: StepperItem[] = [
    { label: "Upload", state: hasMedia ? "done" : "current" },
    { label: "Format & style", state: hasMedia ? "done" : "todo" },
    {
      label: "Script",
      state: scriptReady ? "done" : hasMedia ? "current" : "todo",
    },
    {
      label: "Voiceover",
      state: voReady ? "done" : scriptReady ? "current" : "todo",
    },
    {
      label: "Render",
      state: rendered ? "done" : voReady ? "current" : "todo",
    },
    {
      label: "Publish",
      state: rendered ? "current" : "todo",
    },
  ];
  const nextLabel = steps.find((s) => s.state === "current")?.label;

  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-3xl font-semibold text-heading sm:text-4xl">
            Create a video
          </h1>
          {(assets.length > 0 || scenes.length > 0) && (
            <button
              type="button"
              onClick={startNew}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                confirmNew
                  ? "border-red-800 bg-red-950/50 text-red-300"
                  : "border-edge text-muted hover:border-muted hover:text-heading"
              }`}
            >
              {confirmNew ? "Click again to clear everything" : "Start new"}
            </button>
          )}
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Upload photos or short clips, pick a look, and the AI drafts grounded per-scene
          narration, voices it, and renders a ready-to-post MP4 in your browser.
        </p>

        {restored && (
          <p className="mt-4 rounded-lg border border-sky-900/60 bg-sky-950/40 p-3 text-sm text-sky-300">
            Welcome back — your draft was restored. Voiceover needs to be generated again before
            rendering.
          </p>
        )}

        <div className="mt-6">
          <Stepper items={steps} next={nextLabel} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="min-w-0 space-y-6">
            <StepCard
              number={1}
              title="Add your media"
              subtitle="Photos and short clips, in the order you want them to appear. Reorder or delete anytime."
              color="#60a5fa"
              status={hasMedia ? "done" : "active"}
              aside={hasMedia ? `${assets.length} uploaded` : undefined}
            >
              <UploadStep />
            </StepCard>

            <StepCard
              number={2}
              title="Format & style"
              subtitle="The format sets the frame for each platform; the style sets motion, branding and tone."
              color="#c084fc"
              status={hasMedia ? "done" : "locked"}
            >
              <FormatStep />
            </StepCard>

            <StepCard
              number={3}
              title="Narration script"
              subtitle="The AI looks at every photo and clip and writes one narration line per scene — edit anything before it's voiced."
              color="#f472b6"
              status={scriptReady ? "done" : hasMedia ? "active" : "locked"}
              aside={scriptReady ? `${scenes.length} scenes` : undefined}
            >
              <ScriptStep />
            </StepCard>

            <StepCard
              number={4}
              title="Voiceover"
              subtitle="Pick a voice and generate narration. Each scene's on-screen time adjusts to match its line."
              color="#2dd4bf"
              status={voReady ? "done" : scriptReady ? "active" : "locked"}
            >
              <VoiceStep />
            </StepCard>

            <StepCard
              number={5}
              title="Render & download"
              subtitle="Your video is stitched and encoded on your device. Source media and render intermediates stay local."
              color="#e08a4c"
              status={rendered ? "done" : voReady ? "active" : "locked"}
            >
              <RenderStep />
            </StepCard>

            <StepCard
              number={6}
              title="Publish"
              subtitle="Choose connected social accounts, review platform settings, then confirm before the final MP4 is uploaded and posted."
              color="#60a5fa"
              status={rendered ? "active" : "locked"}
            >
              <PublishStep />
            </StepCard>
          </div>

          <div className="lg:sticky lg:top-24 lg:self-start">
            <Sidebar projectedSeconds={projected} />
          </div>
        </div>
      </main>
    </>
  );
}
