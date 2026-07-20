import type { SocialNetwork } from "@/config/social-platforms";

export interface PublishOutcome {
  id: string;
  network: SocialNetwork;
  username: string;
  status: "pending" | "published" | "failed";
  error: string | null;
  platformPostUrl: string | null;
}

export function composePostContent(title: string, caption: string): string {
  return [title.trim(), caption.trim()].filter(Boolean).join("\n\n");
}

export function failedAccountIds(outcomes: PublishOutcome[]): string[] {
  return outcomes
    .filter((outcome) => outcome.status === "failed")
    .map((outcome) => outcome.id);
}

export function allOutcomesTerminal(outcomes: PublishOutcome[]): boolean {
  return outcomes.length > 0 && outcomes.every((outcome) => outcome.status !== "pending");
}