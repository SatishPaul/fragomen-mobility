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

export interface OutstandPostAnalyticsMetric {
  social_account: OutstandSocialAccount;
  platform_post_id: string | null;
  platform_post_url: string | null;
  published_at: string | null;
  metrics: {
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
    impressions?: number;
    reach?: number;
    engagement_rate?: number;
    platform_specific?: Record<string, unknown>;
  };
  metrics_error?: { code: string; message: string } | null;
}

export interface OutstandPostAnalytics {
  post: { id: string; publishedAt: string | null; createdAt: string };
  metrics_by_account: OutstandPostAnalyticsMetric[];
  aggregated_metrics: {
    total_likes?: number;
    total_comments?: number;
    total_shares?: number;
    total_views?: number;
    total_impressions?: number;
    total_reach?: number;
    average_engagement_rate?: number;
  };
}