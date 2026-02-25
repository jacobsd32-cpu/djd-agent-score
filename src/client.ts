import {
  AgentScoreError,
  NetworkError,
  PaymentRequiredError,
} from "./errors.js";
import type {
  AgentScoreClientOptions,
  BasicScoreResponse,
  FullScoreResponse,
  RefreshScoreResponse,
  FraudReportResponse,
  BlacklistResponse,
  LeaderboardResponse,
  RegisterAgentResponse,
  HealthResponse,
  GateResult,
  GateReason,
} from "./types.js";

const DEFAULT_BASE_URL = "https://djd-agent-score.fly.dev";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1_000;

export class AgentScoreClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: AgentScoreClientOptions = {}) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  }

  // ── Internal request helpers ─────────────────────────────────────

  private async _request<T>(
    method: "GET" | "POST",
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoff = INITIAL_BACKOFF_MS * 2 ** (attempt - 1);
        await this._sleep(backoff);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      let res: Response;
      try {
        res = await fetch(url, {
          method,
          headers: body
            ? { "Content-Type": "application/json" }
            : undefined,
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        const msg =
          err instanceof Error ? err.message : "Unknown network error";
        lastError = new NetworkError(
          msg.includes("abort")
            ? `Request timed out after ${this.timeoutMs}ms: ${method} ${path}`
            : `Network error: ${msg}`,
        );
        continue;
      } finally {
        clearTimeout(timer);
      }

      // 402 — payment required, never retry
      if (res.status === 402) {
        const raw = (await res.json().catch(() => ({}))) as Record<
          string,
          unknown
        >;
        const accepts = Array.isArray(raw.accepts) ? raw.accepts : [];
        throw new PaymentRequiredError(accepts, raw);
      }

      // 5xx — retry
      if (res.status >= 500) {
        const text = await res.text().catch(() => "");
        lastError = new NetworkError(
          `Server error ${res.status}: ${text || res.statusText}`,
          res.status,
        );
        continue;
      }

      // 4xx (not 402) — do not retry
      if (res.status >= 400) {
        const text = await res.text().catch(() => "");
        throw new NetworkError(
          `HTTP ${res.status}: ${text || res.statusText}`,
          res.status,
        );
      }

      // Success — return JSON
      return (await res.json()) as T;
    }

    throw lastError ?? new NetworkError("Request failed after retries");
  }

  /** Like _request but returns the raw text body instead of parsing JSON. */
  private async _requestText(
    method: "GET" | "POST",
    path: string,
  ): Promise<string> {
    const url = `${this.baseUrl}${path}`;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoff = INITIAL_BACKOFF_MS * 2 ** (attempt - 1);
        await this._sleep(backoff);
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      let res: Response;
      try {
        res = await fetch(url, { method, signal: controller.signal });
      } catch (err) {
        clearTimeout(timer);
        const msg =
          err instanceof Error ? err.message : "Unknown network error";
        lastError = new NetworkError(
          msg.includes("abort")
            ? `Request timed out after ${this.timeoutMs}ms: ${method} ${path}`
            : `Network error: ${msg}`,
        );
        continue;
      } finally {
        clearTimeout(timer);
      }

      if (res.status >= 500) {
        const text = await res.text().catch(() => "");
        lastError = new NetworkError(
          `Server error ${res.status}: ${text || res.statusText}`,
          res.status,
        );
        continue;
      }

      if (res.status >= 400) {
        const text = await res.text().catch(() => "");
        throw new NetworkError(
          `HTTP ${res.status}: ${text || res.statusText}`,
          res.status,
        );
      }

      return await res.text();
    }

    throw lastError ?? new NetworkError("Request failed after retries");
  }

  private _sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ── Public API ───────────────────────────────────────────────────

  /**
   * Get a basic reputation score (free tier).
   * Returns score, tier, confidence, recommendation, and freshness metadata.
   */
  async getBasicScore(wallet: string): Promise<BasicScoreResponse> {
    return this._request(
      "GET",
      `/v1/score/basic?wallet=${encodeURIComponent(wallet)}`,
    );
  }

  /**
   * Get a full score with dimension breakdown.
   * Paid endpoint — may throw `PaymentRequiredError` with x402 payment details.
   */
  async getFullScore(wallet: string): Promise<FullScoreResponse> {
    return this._request(
      "GET",
      `/v1/score/full?wallet=${encodeURIComponent(wallet)}`,
    );
  }

  /**
   * Force-refresh a wallet's score using latest on-chain data.
   * Paid endpoint — may throw `PaymentRequiredError`.
   */
  async refreshScore(wallet: string): Promise<RefreshScoreResponse> {
    return this._request(
      "POST",
      `/v1/score/refresh?wallet=${encodeURIComponent(wallet)}`,
    );
  }

  /**
   * Submit a fraud report for a wallet.
   */
  async reportFraud(
    wallet: string,
    reason: string,
    txHashes?: string[],
  ): Promise<FraudReportResponse> {
    const body: Record<string, unknown> = { wallet, evidence: reason };
    if (txHashes) body.txHashes = txHashes;
    return this._request("POST", "/v1/report", body);
  }

  /**
   * Check whether a wallet has fraud reports.
   * Paid endpoint — may throw `PaymentRequiredError`.
   */
  async checkBlacklist(wallet: string): Promise<BlacklistResponse> {
    return this._request(
      "GET",
      `/v1/data/fraud/blacklist?wallet=${encodeURIComponent(wallet)}`,
    );
  }

  /**
   * Get the SVG trust badge for a wallet. Returns the raw SVG string.
   */
  async getBadge(wallet: string): Promise<string> {
    return this._requestText(
      "GET",
      `/v1/badge/${encodeURIComponent(wallet)}.svg`,
    );
  }

  /**
   * Get the top-scored agents on the leaderboard.
   */
  async getLeaderboard(limit?: number): Promise<LeaderboardResponse> {
    const query = limit != null ? `?limit=${limit}` : "";
    return this._request("GET", `/v1/leaderboard${query}`);
  }

  /**
   * Register a new agent wallet.
   */
  async registerAgent(
    wallet: string,
    name: string,
    description: string,
    githubUrl?: string,
  ): Promise<RegisterAgentResponse> {
    const body: Record<string, unknown> = { wallet, name, description };
    if (githubUrl) body.githubUrl = githubUrl;
    return this._request("POST", "/v1/agent/register", body);
  }

  /**
   * Health check — confirms the API and its backing services are up.
   */
  async healthCheck(): Promise<HealthResponse> {
    return this._request("GET", "/health");
  }

  // ── Convenience helpers ──────────────────────────────────────────

  /**
   * Returns `true` only when the API recommendation is `"proceed"`.
   * A quick yes/no check for transaction gating.
   */
  async shouldTransact(wallet: string): Promise<boolean> {
    const { recommendation } = await this.getBasicScore(wallet);
    return recommendation === "proceed";
  }

  /**
   * Full gating decision with typed reason.
   * Maps known recommendations to a `GateReason`; anything unexpected
   * maps to `"unknown_recommendation"` (approved: false).
   */
  async gateTransaction(wallet: string): Promise<GateResult> {
    const data = await this.getBasicScore(wallet);

    const KNOWN_REASONS: Record<string, GateReason> = {
      proceed: "proceed",
      proceed_with_caution: "proceed_with_caution",
      deny: "blocked",
      block: "blocked",
    };

    const reason: GateReason =
      KNOWN_REASONS[data.recommendation] ?? "unknown_recommendation";

    return {
      approved: reason === "proceed" || reason === "proceed_with_caution",
      reason,
      score: data.score,
      recommendation: data.recommendation,
      wallet: data.wallet,
    };
  }
}
