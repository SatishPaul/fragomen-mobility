"use client";

/**
 * Built-in background music: royalty-free beds synthesized with Web Audio
 * (pad + bass + plucks over a chord loop) in several moods. No bundled audio
 * files → no licensing questions. Users who want a real track (e.g. an NCS
 * download) can upload their own in the UI.
 */

// Note frequencies used by the mood progressions.
const N = {
  E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0,
} as const;

export interface MusicMood {
  id: string;
  label: string;
  detail: string;
  /** One chord per bar, looped. */
  progression: number[][];
  /** Bar length in seconds — the effective tempo. */
  barSeconds: number;
  /** Master lowpass cutoff: lower = warmer/darker, higher = brighter. */
  lowpass: number;
  /** Pluck step pattern per bar (chord-tone indices; null = rest). */
  pluckSteps: (number | null)[];
  padGain: number;
  bassGain: number;
  pluckGain: number;
  /** Bass plays root / this divisor (2 = one octave down, 4 = two down). */
  bassDivisor: number;
}

export const musicMoods: MusicMood[] = [
  {
    id: "ambient",
    label: "Soft ambient",
    detail: "Warm, calm pad — listing tours, explainers",
    progression: [
      [N.C4, N.E4, N.G4],
      [N.A3, N.C4, N.E4],
      [N.F3, N.A3, N.C4],
      [N.G3, N.B3, N.D4],
    ],
    barSeconds: 4,
    lowpass: 1400,
    pluckSteps: [0, 2, 1, null, 0, 1, 2, null],
    padGain: 0.045,
    bassGain: 0.06,
    pluckGain: 0.028,
    bassDivisor: 2,
  },
  {
    id: "uplifting",
    label: "Uplifting",
    detail: "Bright and optimistic — product demos, good news",
    progression: [
      [N.C4, N.E4, N.G4],
      [N.G3, N.B3, N.D4],
      [N.A3, N.C4, N.E4],
      [N.F3, N.A3, N.C4],
    ],
    barSeconds: 3,
    lowpass: 2600,
    pluckSteps: [0, 1, 2, 1, 0, 2, 1, 2],
    padGain: 0.04,
    bassGain: 0.055,
    pluckGain: 0.034,
    bassDivisor: 2,
  },
  {
    id: "cinematic",
    label: "Cinematic",
    detail: "Slow, deep and moody — dramatic reveals",
    progression: [
      [N.A3, N.C4, N.E4],
      [N.F3, N.A3, N.C4],
      [N.C4, N.E4, N.G4],
      [N.E3, N.G3, N.B3],
    ],
    barSeconds: 5,
    lowpass: 900,
    pluckSteps: [0, null, null, null, 2, null, null, null],
    padGain: 0.055,
    bassGain: 0.075,
    pluckGain: 0.022,
    bassDivisor: 4,
  },
  {
    id: "energetic",
    label: "Energetic",
    detail: "Fast and driving — shorts and highlight reels",
    progression: [
      [N.A3, N.C4, N.E4],
      [N.C4, N.E4, N.G4],
      [N.G3, N.B3, N.D4],
      [N.D4, N.F4, N.A4],
    ],
    barSeconds: 2,
    lowpass: 3200,
    pluckSteps: [0, 2, 1, 2, 0, 2, 1, 2],
    padGain: 0.035,
    bassGain: 0.07,
    pluckGain: 0.04,
    bassDivisor: 2,
  },
];

export function getMood(id: string | undefined): MusicMood {
  return musicMoods.find((m) => m.id === id) ?? musicMoods[0];
}

export async function generateMusicBed(
  durationSec: number,
  moodId?: string,
): Promise<AudioBuffer> {
  const mood = getMood(moodId);
  const sampleRate = 44100;
  const length = Math.max(1, Math.ceil(durationSec * sampleRate));
  const ctx = new OfflineAudioContext(2, length, sampleRate);

  const master = ctx.createGain();
  master.gain.value = 1;
  const warmth = ctx.createBiquadFilter();
  warmth.type = "lowpass";
  warmth.frequency.value = mood.lowpass;
  warmth.Q.value = 0.4;
  master.connect(warmth).connect(ctx.destination);

  const BAR = mood.barSeconds;
  for (let t = 0, bar = 0; t < durationSec; t += BAR, bar++) {
    const chord = mood.progression[bar % mood.progression.length];
    const end = Math.min(t + BAR, durationSec);

    // Pad: two slightly detuned triangles per chord tone.
    for (const freq of chord) {
      for (const detune of [-6, 5]) {
        pad(ctx, master, freq, detune, t, end + 0.8, mood.padGain);
      }
    }
    // Bass on the root.
    pad(ctx, master, chord[0] / mood.bassDivisor, 0, t, end + 0.5, mood.bassGain, "sine");

    // Plucks per the mood's step pattern, spread evenly across the bar.
    const stepLen = BAR / mood.pluckSteps.length;
    for (let s = 0; s < mood.pluckSteps.length; s++) {
      const tone = mood.pluckSteps[s];
      if (tone === null) continue;
      const start = t + s * stepLen;
      if (start >= durationSec - 0.5) break;
      const octaveUp = s % 4 === 2 ? 2 : 1;
      pluck(ctx, master, chord[tone] * octaveUp, start, mood.pluckGain);
    }
  }

  const rendered = await ctx.startRendering();
  normalizeBuffer(rendered, 0.5);
  return rendered;
}

/**
 * Plays a short sample of a mood (or the uploaded custom track) so users can
 * hear it before choosing. Returns a stop function.
 */
export async function previewMusic(
  moodId: string | "custom",
  seconds = 8,
): Promise<() => void> {
  let buffer: AudioBuffer;
  if (moodId === "custom") {
    const track = getCustomTrack();
    if (!track) throw new Error("No custom track uploaded yet");
    buffer = await decodeMusicFile(track);
  } else {
    buffer = await generateMusicBed(seconds, moodId);
  }
  const ctx = new AudioContext();
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  // Gentle fade so short previews don't click.
  const dur = Math.min(seconds, buffer.duration);
  gain.gain.setValueAtTime(1, 0);
  gain.gain.setValueAtTime(1, Math.max(0, dur - 0.4));
  gain.gain.linearRampToValueAtTime(0.0001, dur);
  source.connect(gain).connect(ctx.destination);
  source.start(0, 0, dur);
  source.onended = () => ctx.close();
  return () => {
    try {
      source.stop();
      ctx.close();
    } catch {}
  };
}

function pad(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  freq: number,
  detuneCents: number,
  start: number,
  stop: number,
  gainValue: number,
  type: OscillatorType = "triangle",
) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detuneCents;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(gainValue, start + 1.1);
  gain.gain.setValueAtTime(gainValue, Math.max(start + 1.1, stop - 1.2));
  gain.gain.linearRampToValueAtTime(0, stop);
  osc.connect(gain).connect(dest);
  osc.start(start);
  osc.stop(stop + 0.05);
}

function pluck(
  ctx: OfflineAudioContext,
  dest: AudioNode,
  freq: number,
  start: number,
  gainValue: number,
) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq * 2;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainValue, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
  osc.connect(gain).connect(dest);
  osc.start(start);
  osc.stop(start + 0.55);
}

function normalizeBuffer(buffer: AudioBuffer, target: number) {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const a = Math.abs(data[i]);
      if (a > peak) peak = a;
    }
  }
  if (peak < 0.001) return;
  const gain = target / peak;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }
}

/** Decodes a user-uploaded music file to an AudioBuffer. */
export async function decodeMusicFile(blob: Blob): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    ctx.close();
  }
}

/** The uploaded custom track lives here — blobs don't belong in the store. */
let customTrack: Blob | null = null;

export function setCustomTrack(blob: Blob | null) {
  customTrack = blob;
}

export function getCustomTrack(): Blob | null {
  return customTrack;
}
