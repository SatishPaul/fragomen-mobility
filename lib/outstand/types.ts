import type { SocialNetwork } from "@/config/social-platforms";

export interface OutstandSocialAccount {
  id: string;
  nickname: string;
  network: SocialNetwork;
  username: string;
  profile_picture_url?: string | null;
  isActive: number | boolean;
}

export interface OutstandAccountHealth {
  id: string;
  network: SocialNetwork;
  healthy: boolean;
  checkedAt: string;
  error?: string | null;
  errorCode?: string | null;
}

export interface OutstandMedia {
  id: string;
  filename: string;
  url: string;
  content_type: string;
  size: number;
  status: "pending" | "active";
  created_at: string;
  expires_at: string;
}

export interface OutstandPostAccount {
  id: string;
  nickname: string;
  network: SocialNetwork;
  username: string;
  status: "pending" | "published" | "failed";
  error: string | null;
  platformPostId: string | null;
  platformPostUrl?: string | null;
  publishedAt: string | null;
}

export interface OutstandPost {
  id: string;
  publishedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  socialAccounts: OutstandPostAccount[];
}

export interface OutstandCreatePostRequest {
  content: string;
  accounts: string[];
  mediaIds: string[];
}