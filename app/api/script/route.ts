import { NextResponse } from "next/server";
import { z } from "zod";
import { groqFallback, models } from "@/config/models";
import { clientIp, throttled } from "@/lib/server/throttle";

/**
 * POST /api/script — turns per-scene captions + optional user context into a
 * coherent narration script. Strict-JSON prompt, zod-parsed, one retry on
 * parse failure (TRD §3.3).
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  scenes: z
    .array(
      z.object({
        id: z.string().min(1),
        caption: z.string().max(1500),
        kind: z.enum(["image", "video"]).optional(),
      }),
    )
    .min(1)
    .max(20),
  context: z.string().max(1000).optional().default(""),
  tone: z.string().max(200).optional().default("clean and modern"),
  /** Hard output-length cap; the word budget is derived from it. */
  maxSeconds: z.number().min(10).max(600).optional().default(90),
});

// The model replies with 1-based scene numbers, never asset ids — free-tier
// models reliably count to N but reliably mangle UUIDs.
const Lines = z.object({
  lines: z
    .array(z.object({ scene: z.number().int().min(1), text: z.string().max(700) }))
    .min(1),
  title: z.string().max(120).optional(),
  subtitle: z.string().max(200).optional(),
  outro: z.string().max(160).optional(),
  outroSub: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY && !process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "Neither OPENROUTER_API_KEY nor GROQ_API_KEY is configured" },
      { status: 500 },
    );
  }
  if (throttled(clientIp(req), 10)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { scenes, context, tone, maxSeconds } = parsed.data;

  // Speech runs ~2.3 words/second; keep 15% headroom for pauses/transitions.
  const wordBudget = Math.floor(maxSeconds * 2.3 * 0.85);
  const perLine = Math.min(20, Math.max(8, Math.floor(wordBudget / scenes.length)));

  const prompt = [
    `You are writing the voiceover for a short social-media video with ${scenes.length} scenes, in order.`,
    `Tone: ${tone}.`,
    context ? `Context from the creator (use its facts — names, prices, locations — where they fit): ${context}` : "",
    "Scene descriptions (what the viewer sees, from an image-analysis pass):",
    ...scenes.map(
      (s, i) => `Scene ${i + 1}: ${s.caption || "No description available — write a natural bridging line from context and neighboring scenes."}`,
    ),
    "",
    `Write one narration passage per scene. For ordinary photo or footage scenes keep it tight: ${Math.max(6, perLine - 6)}-${perLine} words.`,
    "For a scene whose description is a floor plan, architecture diagram, or software screen, write a fuller explanation instead — two to three sentences (roughly forty to sixty words) that genuinely walk the viewer through what it shows: name the specific rooms, dimensions, features or controls from the description and how they connect. It is fine to say 'here on the main floor plan' — then actually explain it.",
    `The whole script must stay speakable within ${maxSeconds} seconds at a natural pace.`,
    "You are a narrator speaking TO the viewer, not describing images. Never write 'this image shows' or 'this is a photo' — say what the viewer should notice, as if walking them through in person.",
    "Only state details that appear in the descriptions or the creator's context — never invent rooms, sizes or features.",
    "The passages must flow as one coherent script: hook the viewer in scene 1, end with a natural closing line or call to action.",
    "Write every number and measurement in spoken words — 'fifteen by twenty-one feet', never 15'6\" or digits with symbols — and never use double-quote characters inside the narration text.",
    "Also write on-screen text for the opening and closing title cards (displayed, not spoken) — informative, drawn from the scenes and the creator's context, never generic filler:",
    '- "title": a punchy opening title, three to six words.',
    '- "subtitle": a short informative line for under the title — the subject, place, or key facts (e.g. the address, or what the video covers), three to eight words.',
    '- "outro": a closing line or call to action, three to eight words.',
    '- "outroSub": one informative supporting line for under the closing — a concrete detail worth remembering (price, contact, where to learn more) pulled from the context; empty string if nothing fits.',
    'Reply with ONLY this JSON, no markdown fences: {"title":"<title>","subtitle":"<subtitle>","outro":"<closing>","outroSub":"<detail>","lines":[{"scene":1,"text":"<narration>"},...]} — one line entry per scene, numbered 1 to ' + scenes.length + ".",
  ]
    .filter(Boolean)
    .join("\n");

  // Provider chain: Groq first — its gpt-oss-120b is bigger AND answers in
  // ~2-10s, while OpenRouter's free 20b regularly hits the 25s timeout. Then
  // Groq's other free models (each has an independent rate-limit budget),
  // then OpenRouter. reasoning_effort applies only to gpt-oss models.
  const attempts = [
    ...(process.env.GROQ_API_KEY
      ? [groqFallback.script, ...groqFallback.scriptFallbacks].map((model) => ({
          baseUrl: groqFallback.baseUrl,
          key: process.env.GROQ_API_KEY!,
          model,
          jsonMode: true,
          lowReasoning: model.startsWith("openai/gpt-oss"),
        }))
      : []),
    ...(process.env.OPENROUTER_API_KEY
      ? [
          { baseUrl: models.baseUrl, key: process.env.OPENROUTER_API_KEY, model: models.script, jsonMode: false, lowReasoning: false },
          { baseUrl: models.baseUrl, key: process.env.OPENROUTER_API_KEY, model: models.script, jsonMode: false, lowReasoning: false },
        ]
      : []),
  ];

  // Best incomplete result seen across attempts — served if no attempt
  // covers every scene, so a rate-limited tail degrades to per-scene caption
  // fallback on the client instead of a hard failure.
  type CardFields = { title: string; subtitle: string; outro: string; outroSub: string };
  let best: { lines: { id: string; text: string }[]; covered: number; cards: CardFields } | null =
    null;

  for (const a of attempts) {
    try {
      const res = await fetch(`${a.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${a.key}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          model: a.model,
          // Enough for gpt-oss reasoning plus the JSON answer, but no more:
          // Groq counts max_tokens against the per-minute token budget, so an
          // oversized cap rate-limits the retry that follows.
          max_tokens: 3500,
          temperature: 0.7,
          // Groq supports enforced JSON output — without it, gpt-oss
          // occasionally puts everything in `reasoning` and returns an empty
          // content field.
          ...(a.jsonMode ? { response_format: { type: "json_object" } } : {}),
          // Low reasoning effort (gpt-oss only) keeps the token spend on the
          // answer — script writing needs no deep chain-of-thought — so the
          // 3500 cap and Groq's 8k/min token budget both hold.
          ...(a.lowReasoning ? { reasoning_effort: "low" } : {}),
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) {
        const errBody = await res.text().catch(() => "");
        console.error(`[script] ${a.model}: HTTP ${res.status} ${errBody.slice(0, 300)}`);
        // Rate limits clear in seconds — pause for the provider's suggested
        // interval (capped) instead of burning the retry immediately.
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("retry-after")) || 8;
          await new Promise((r) => setTimeout(r, Math.min(retryAfter, 20) * 1000));
        }
        continue;
      }

      const data = await res.json();
      const raw: string = data?.choices?.[0]?.message?.content ?? "";
      const jsonText = raw.replace(/```json|```/g, "").trim();
      const start = jsonText.indexOf("{");
      const end = jsonText.lastIndexOf("}");
      if (start === -1 || end === -1) {
        console.error(`[script] ${a.model}: no JSON in reply (${raw.length} chars): ${raw.slice(0, 160)}`);
        continue;
      }
      const result = Lines.safeParse(JSON.parse(jsonText.slice(start, end + 1)));
      if (!result.success) {
        console.error(`[script] ${a.model}: schema mismatch — ${result.error.issues[0]?.message}`);
        continue;
      }
      // Rebuild {id,text} by scene number so the client never has to trust
      // LLM-echoed ids. Missing scenes force a retry rather than a silent gap.
      const byScene = new Map(result.data.lines.map((l) => [l.scene, l.text.trim()]));
      const lines = scenes.map((s, i) => ({ id: s.id, text: byScene.get(i + 1) ?? "" }));
      const cards: CardFields = {
        title: result.data.title?.trim() ?? "",
        subtitle: result.data.subtitle?.trim() ?? "",
        outro: result.data.outro?.trim() ?? "",
        outroSub: result.data.outroSub?.trim() ?? "",
      };
      const covered = lines.filter((l) => l.text).length;
      if (covered < scenes.length) {
        console.error(`[script] ${a.model}: missing scenes (got ${covered}/${scenes.length})`);
        if (!best || covered > best.covered) best = { lines, covered, cards };
        continue;
      }
      return NextResponse.json({ lines, ...cards });
    } catch (e) {
      console.error(`[script] ${a.model}: ${e instanceof Error ? e.message : e}`);
    }
  }
  // Serve a mostly-complete script over a hard failure — the client fills the
  // gaps per-scene from captions, which the user can edit.
  if (best && best.covered >= Math.ceil(scenes.length / 2)) {
    console.error(`[script] serving partial result (${best.covered}/${scenes.length} scenes)`);
    return NextResponse.json({ lines: best.lines, ...best.cards });
  }
  return NextResponse.json({ error: "Script generation failed" }, { status: 502 });
}
