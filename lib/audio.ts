"use client";

/**
 * Master audio track assembly (TRD §3.2 step 6): per-scene voiceover WAVs are
 * placed at their scene offsets in an OfflineAudioContext; video-clip audio is
 * mixed underneath at the style's duck level. Output is one 44.1 kHz WAV that
 * ffmpeg encodes to AAC at mux time.
 */

export interface VoicePlacement {
  data: Float32Array;
  sampleRate: number;
  /** Offset of the scene start in the final video, seconds. */
  offset: number;
}

export interface ClipAudioPlacement {
  blob: Blob;
  offset: number;
  /** Portion of the clip used in the video, seconds. */
  duration: number;
  /** 0..1 gain under the voiceover. */
  gain: number;
}

export interface MusicBed {
  buffer: AudioBuffer;
  /** Base music level (0..1 of full scale). */
  volume: number;
  /** Fraction of the base level while the voice speaks (ducking). */
  duckTo: number;
}

export async function buildMasterTrack(
  totalSeconds: number,
  voices: VoicePlacement[],
  clips: ClipAudioPlacement[],
  music?: MusicBed | null,
): Promise<Blob> {
  const sampleRate = 44100;
  const length = Math.max(1, Math.ceil(totalSeconds * sampleRate));
  const ctx = new OfflineAudioContext(2, length, sampleRate);

  for (const v of voices) {
    const buffer = ctx.createBuffer(1, v.data.length, v.sampleRate);
    buffer.copyToChannel(v.data as Float32Array<ArrayBuffer>, 0);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(Math.min(v.offset, totalSeconds));
  }

  if (music && music.volume > 0) {
    const source = ctx.createBufferSource();
    source.buffer = music.buffer;
    source.loop = true;
    const gain = ctx.createGain();
    const base = music.volume;
    const ducked = base * music.duckTo;

    // Fade in, duck around each narration line, fade out at the end.
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(base, Math.min(1.2, totalSeconds / 4));
    const raw = voices
      .map((v) => ({ start: v.offset, end: v.offset + v.data.length / v.sampleRate }))
      .sort((a, b) => a.start - b.start);
    // Merge narration spans separated by short gaps so the music doesn't pump.
    const spans: { start: number; end: number }[] = [];
    for (const s of raw) {
      const prev = spans[spans.length - 1];
      if (prev && s.start - prev.end < 1.2) prev.end = Math.max(prev.end, s.end);
      else spans.push({ ...s });
    }
    for (const span of spans) {
      const duckStart = Math.max(0, span.start - 0.35);
      const recover = Math.min(totalSeconds, span.end + 0.25);
      gain.gain.setValueAtTime(base, duckStart);
      gain.gain.linearRampToValueAtTime(ducked, Math.max(duckStart + 0.01, span.start));
      gain.gain.setValueAtTime(ducked, recover);
      gain.gain.linearRampToValueAtTime(base, Math.min(totalSeconds, recover + 0.6));
    }
    const fadeStart = Math.max(0, totalSeconds - 1.6);
    gain.gain.setValueAtTime(base, fadeStart);
    gain.gain.linearRampToValueAtTime(0.0001, totalSeconds);

    source.connect(gain).connect(ctx.destination);
    source.start(0);
  }

  for (const clip of clips) {
    if (clip.gain <= 0) continue;
    try {
      const decoded = await ctx.decodeAudioData(await clip.blob.arrayBuffer());
      const source = ctx.createBufferSource();
      source.buffer = decoded;
      const gain = ctx.createGain();
      gain.gain.value = clip.gain;
      source.connect(gain).connect(ctx.destination);
      source.start(clip.offset, 0, clip.duration);
    } catch {
      // Clip has no decodable audio track — fine, skip it.
    }
  }

  const rendered = await ctx.startRendering();
  return encodeWav(rendered);
}

/** 16-bit PCM WAV encoder. */
export function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  const channelData = Array.from({ length: channels }, (_, c) =>
    buffer.getChannelData(c),
  );
  let offset = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, channelData[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([arrayBuffer], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}
