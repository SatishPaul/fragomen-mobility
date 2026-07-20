/**
 * Branding config — edit this file to rebrand the app without touching components.
 * Colors cascade into the UI through CSS variables set in app/layout.tsx.
 */
export const brand = {
  /** Product name shown in the header and page titles. */
  name: "VideoMaker",
  /** Short tagline for the landing page hero. */
  tagline: "Photos in. Narrated video out.",
  /** Path (under /public) to the logo shown in the app header. */
  logo: "/brand/logo.svg",
  /**
   * Path (under /public) to the watermark stamped onto rendered videos.
   * SVG or PNG. Rasterized at render time.
   */
  watermark: "/brand/logo.svg",
  /** Contact line shown on the outro card of styles that enable it. */
  contact: "Your Name · +1 (555) 000-0000 · youragency.com",

  colors: {
    /** Page background. */
    background: "#0a0f1e",
    /** Card / panel background. */
    surface: "#101728",
    /** Slightly raised surface (inputs, tiles). */
    surfaceRaised: "#16203a",
    /** Card borders and dividers. */
    border: "#233150",
    /** Primary action color (buttons, highlights). */
    accent: "#e08a4c",
    /** Text on top of the accent color. */
    accentForeground: "#160d05",
    /** Headline text. */
    heading: "#f2f5fb",
    /** Body text. */
    text: "#c4cde0",
    /** Secondary / muted text. */
    muted: "#7c89a6",
    /** Success (completed steps). */
    success: "#4ade80",
  },
} as const;

export type Brand = typeof brand;
