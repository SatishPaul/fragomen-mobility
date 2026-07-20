import { NextResponse } from "next/server";
import { z } from "zod";
import { groqFallback, models } from "@/config/models";
import { clientIp, throttled } from "@/lib/server/throttle";

/**
 * POST /api/analyze — captions one downscaled frame via an OpenRouter vision
 * model, falling back to Groq when OpenRouter is rate-limited or down. The
 * server is a dumb key-holding proxy: no storage, no logging of image data
 * (TRD §3.4).
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  // Data-URL or raw base64 of a ≤768px JPEG. 1 MB base64 cap enforced below.
  imageBase64: z.string().min(100),
});

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY && !process.env.GROQ_API_KEY) {
    return NextResponse.json(
      { error: "Neither OPENROUTER_API_KEY nor GROQ_API_KEY is configured" },
      { status: 500 },
    );
  }
  if (throttled(clientIp(req), 30)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const base64 = parsed.data.imageBase64.replace(/^data:image\/\w+;base64,/, "");
  if (base64.length > 1_400_000) {
    return NextResponse.json({ error: "Image too large" }, { status: 413 });
  }

  // Provider chain: OpenRouter first, Groq as fallback. A 429 from one is a
  // reason to try the next, not to give up.
  const candidates = [
    process.env.OPENROUTER_API_KEY && {
      baseUrl: models.baseUrl,
      key: process.env.OPENROUTER_API_KEY,
      model: models.vision,
    },
    process.env.GROQ_API_KEY && {
      baseUrl: groqFallback.baseUrl,
      key: process.env.GROQ_API_KEY,
      model: groqFallback.vision,
    },
  ].filter(Boolean) as { baseUrl: string; key: string; model: string }[];

  let lastStatus = 502;
  for (const c of candidates) {
    try {
      const res = await fetch(`${c.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${c.key}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(25_000),
        body: JSON.stringify({
          model: c.model,
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: [
                    "Describe this image factually. Your description is raw material for a script writer, not narration itself.",
                    "If it is a floor plan or architectural diagram: say so, name the level if labeled (e.g. main floor, basement), then list every labeled room with its dimensions where readable and how the spaces connect (e.g. 'the kitchen opens to a breakfast nook; three bedrooms share the hall'). Use up to 4 sentences — this detail is what the narrator will explain.",
                    "If it is a screenshot of software, an app, or a website: name the product type and the screen shown, then describe the visible sections, controls and data specifically enough that a narrator could explain the feature. Up to 4 sentences.",
                    "Otherwise describe the scene visually in 1-2 short sentences, leading with what is most distinctive.",
                    "No preamble, no quotes.",
                  ].join(" "),
                },
                {
                  type: "image_url",
                  image_url: { url: `data:image/jpeg;base64,${base64}` },
                },
              ],
            },
          ],
        }),
      });

      if (!res.ok) {
        lastStatus = res.status === 429 ? 429 : 502;
        continue;
      }
      const data = await res.json();
      const caption: string | undefined =
        data?.choices?.[0]?.message?.content?.trim();
      if (!caption) {
        lastStatus = 502;
        continue;
      }
      return NextResponse.json({ caption });
    } catch {
      lastStatus = 502;
    }
  }
  return NextResponse.json(
    { error: lastStatus === 429 ? "All vision models rate-limited" : "Vision request failed" },
    { status: lastStatus },
  );
}
