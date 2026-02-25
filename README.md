# djd-agent-score

TypeScript SDK for the [DJD Agent Score API](https://djd-agent-score.fly.dev) — reputation scoring for AI agent wallets on Base.

- Zero runtime dependencies (uses native `fetch`)
- Dual ESM / CommonJS builds
- Full TypeScript types
- Retry with exponential backoff
- Typed x402 payment errors

## Installation

```bash
npm install djd-agent-score
```

Requires **Node.js 18+** (for native `fetch`).

## Quick Start

```ts
import { AgentScoreClient } from "djd-agent-score";

const client = new AgentScoreClient();

// Quick yes/no check before a transaction
const safe = await client.shouldTransact("0xABC...");
if (!safe) {
  console.log("Transaction blocked — low trust score");
}

// Get the full basic score
const score = await client.getBasicScore("0xABC...");
console.log(score.score, score.tier, score.recommendation);
```

## Constructor Options

```ts
const client = new AgentScoreClient({
  baseUrl: "https://djd-agent-score.fly.dev", // default
  timeoutMs: 10_000,                          // default
  maxRetries: 3,                              // default — retries on 5xx only
});
```

## API Reference

### Free Endpoints

#### `getBasicScore(wallet: string): Promise<BasicScoreResponse>`

Returns score, tier, confidence, and recommendation for a wallet.

```ts
const res = await client.getBasicScore("0xABC...");
// { wallet, score, tier, confidence, recommendation, modelVersion,
//   lastUpdated, computedAt, scoreFreshness, freeTier,
//   freeQueriesRemainingToday, stale }
```

#### `getLeaderboard(limit?: number): Promise<LeaderboardResponse>`

Returns the top-scored agents.

```ts
const res = await client.getLeaderboard(10);
// { leaderboard: [{ rank, wallet, score, tier, daysAlive, ... }],
//   totalAgentsScored, totalAgentsRegistered, lastUpdated }
```

#### `getBadge(wallet: string): Promise<string>`

Returns the raw SVG trust badge for a wallet.

```ts
const svg = await client.getBadge("0xABC...");
// "<svg ...>...</svg>"
```

#### `reportFraud(wallet, reason, txHashes?): Promise<FraudReportResponse>`

Submit a fraud report.

```ts
const res = await client.reportFraud(
  "0xABC...",
  "Rug-pulled liquidity pool",
  ["0xtx1...", "0xtx2..."],
);
// { success, message, reportId }
```

#### `registerAgent(wallet, name, description, githubUrl?): Promise<RegisterAgentResponse>`

Register a new agent wallet.

```ts
const res = await client.registerAgent(
  "0xABC...",
  "My Agent",
  "Autonomous DeFi agent on Base",
  "https://github.com/org/repo",
);
// { success, message, wallet, initialScore }
```

#### `healthCheck(): Promise<HealthResponse>`

Confirms the API and its backing services are up.

```ts
const res = await client.healthCheck();
// { status, version, modelVersion, uptime, database, indexer, jobs, ... }
```

### Paid Endpoints (x402)

These endpoints require an x402 micropayment. Without one they throw `PaymentRequiredError`.

#### `getFullScore(wallet: string): Promise<FullScoreResponse>`

Full score with dimension breakdown.

```ts
// { wallet, score, tier, confidence, recommendation, modelVersion,
//   dimensions, integrityFlags, dataQuality, computedAt }
```

#### `refreshScore(wallet: string): Promise<RefreshScoreResponse>`

Force-refresh a wallet's score from latest on-chain data.

```ts
// { wallet, score, tier, confidence, recommendation, modelVersion, refreshedAt }
```

#### `checkBlacklist(wallet: string): Promise<BlacklistResponse>`

Check if a wallet has fraud reports.

```ts
// { wallet, reported, reportCount, reports: [{ reportId, reason, createdAt }] }
```

### Convenience Helpers

#### `shouldTransact(wallet: string): Promise<boolean>`

Returns `true` only when the recommendation is `"proceed"`. A quick yes/no gate.

#### `gateTransaction(wallet: string): Promise<GateResult>`

Full gating decision with typed reason:

```ts
const gate = await client.gateTransaction("0xABC...");
// { approved: true, reason: "proceed", score: 72, recommendation: "proceed", wallet: "0x..." }
```

`reason` is one of: `"proceed"` | `"proceed_with_caution"` | `"blocked"` | `"unknown_recommendation"`.

`approved` is `true` for `proceed` and `proceed_with_caution`, `false` otherwise.

## Error Handling

```ts
import {
  AgentScoreClient,
  PaymentRequiredError,
  NetworkError,
} from "djd-agent-score";

try {
  const full = await client.getFullScore("0xABC...");
} catch (err) {
  if (err instanceof PaymentRequiredError) {
    // x402 — inspect payment options
    console.log(err.accepts); // [{ scheme, network, maxAmountRequired, payTo, ... }]
    console.log(err.statusCode); // 402
  } else if (err instanceof NetworkError) {
    // Timeout, DNS failure, 4xx/5xx after retries
    console.log(err.message, err.statusCode);
  }
}
```

### Error Hierarchy

| Class | When |
|---|---|
| `AgentScoreError` | Base class for all SDK errors |
| `NetworkError` | Timeout, connection failure, or non-402 HTTP errors |
| `PaymentRequiredError` | HTTP 402 — endpoint requires x402 payment |

`PaymentRequiredError` carries:
- `accepts: PaymentAccept[]` — x402 payment options
- `rawBody: unknown` — the full 402 response body
- `statusCode: 402`

## Retry Behaviour

- **5xx errors**: retried up to `maxRetries` times with exponential backoff (1s, 2s, 4s, ...)
- **402 (Payment Required)**: never retried — throws `PaymentRequiredError` immediately
- **Other 4xx errors**: never retried — throws `NetworkError` immediately
- **Timeouts / network failures**: retried up to `maxRetries` times

## License

MIT
