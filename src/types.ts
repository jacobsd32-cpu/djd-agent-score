/** Options for constructing an AgentScoreClient. */
export interface AgentScoreClientOptions {
  /** Base URL of the API. Defaults to https://djd-agent-score.fly.dev */
  baseUrl?: string;
  /** Request timeout in milliseconds. Defaults to 10_000. */
  timeoutMs?: number;
  /** Maximum number of retry attempts for 5xx errors. Defaults to 3. */
  maxRetries?: number;
}

// ── Score Responses ──────────────────────────────────────────────────

export interface BasicScoreResponse {
  wallet: string;
  score: number;
  tier: string;
  confidence: number;
  recommendation: string;
  modelVersion: string;
  lastUpdated: string;
  computedAt: string;
  scoreFreshness: number;
  freeTier: boolean;
  freeQueriesRemainingToday: number;
  stale: boolean;
}

export interface FullScoreResponse {
  wallet: string;
  score: number;
  tier: string;
  confidence: number;
  recommendation: string;
  modelVersion: string;
  dimensions: Record<string, number>;
  integrityFlags: Record<string, unknown>;
  dataQuality: Record<string, unknown>;
  computedAt: string;
}

export interface RefreshScoreResponse {
  wallet: string;
  score: number;
  tier: string;
  confidence: number;
  recommendation: string;
  modelVersion: string;
  refreshedAt: string;
}

// ── Fraud ────────────────────────────────────────────────────────────

export interface FraudReportResponse {
  success: boolean;
  message: string;
  reportId: string;
}

// ── Blacklist ────────────────────────────────────────────────────────

export interface BlacklistResponse {
  wallet: string;
  reported: boolean;
  reportCount: number;
  reports: Array<{
    reportId: string;
    reason: string;
    createdAt: string;
  }>;
}

// ── Leaderboard ──────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  score: number;
  tier: string;
  daysAlive: number;
  isRegistered: boolean;
  githubVerified: boolean;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  totalAgentsScored: number;
  totalAgentsRegistered: number;
  lastUpdated: string;
}

// ── Registration ─────────────────────────────────────────────────────

export interface RegisterAgentResponse {
  success: boolean;
  message: string;
  wallet: string;
  initialScore: number;
}

// ── Health ────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  version: string;
  modelVersion: string;
  experimentalStatus: boolean;
  uptime: number;
  database: Record<string, unknown>;
  indexer: Record<string, unknown>;
  jobs: Record<string, unknown>;
}

// ── Helper Return Types ──────────────────────────────────────────────

export type GateReason =
  | "proceed"
  | "proceed_with_caution"
  | "blocked"
  | "unknown_recommendation";

export interface GateResult {
  approved: boolean;
  reason: GateReason;
  score: number;
  recommendation: string;
  wallet: string;
}
