import { describe, it } from "node:test";
import assert from "node:assert/strict";

// We import from the built ESM output so these tests validate the real artifact.
// Run `npm run build` before `npm test`.
import {
  AgentScoreClient,
  NetworkError,
  PaymentRequiredError,
} from "../dist/esm/index.js";

const client = new AgentScoreClient();

// A wallet that appears on the leaderboard (rank #1, score 59, tier "Established").
const TEST_WALLET = "0xef4364fe4487353df46eb7c811d4fac78b856c7f";

describe("AgentScoreClient — free endpoints", () => {
  it("healthCheck returns status and version info", async () => {
    const res = await client.healthCheck();
    assert.equal(res.status, "ok");
    assert.equal(typeof res.version, "string");
    assert.equal(typeof res.modelVersion, "string");
    assert.equal(typeof res.uptime, "number");
    assert.ok(res.database);
    assert.ok(res.indexer);
    assert.ok(res.jobs);
  });

  it("getBasicScore returns score, tier, and recommendation", async () => {
    const res = await client.getBasicScore(TEST_WALLET);
    assert.equal(typeof res.score, "number");
    assert.ok(res.score >= 0 && res.score <= 100);
    assert.equal(typeof res.tier, "string");
    assert.equal(typeof res.confidence, "number");
    assert.equal(typeof res.recommendation, "string");
    assert.equal(typeof res.modelVersion, "string");
    assert.equal(typeof res.scoreFreshness, "number");
    assert.equal(res.wallet.toLowerCase(), TEST_WALLET.toLowerCase());
  });

  it("getBadge returns an SVG string", async () => {
    const svg = await client.getBadge(TEST_WALLET);
    assert.equal(typeof svg, "string");
    assert.ok(svg.includes("<svg"), "Expected SVG markup");
  });

  it("getLeaderboard returns entries with correct shape", async () => {
    const res = await client.getLeaderboard(5);
    assert.ok(Array.isArray(res.leaderboard));
    assert.ok(res.leaderboard.length > 0, "Expected at least one entry");
    assert.equal(typeof res.totalAgentsScored, "number");
    assert.equal(typeof res.totalAgentsRegistered, "number");

    if (res.leaderboard.length > 0) {
      const entry = res.leaderboard[0];
      assert.equal(typeof entry.rank, "number");
      assert.equal(typeof entry.wallet, "string");
      assert.equal(typeof entry.score, "number");
      assert.equal(typeof entry.tier, "string");
    }
  });
});

describe("AgentScoreClient — paid endpoints (402 handling)", () => {
  it("getFullScore throws PaymentRequiredError", async () => {
    await assert.rejects(
      () => client.getFullScore(TEST_WALLET),
      (err) => {
        assert.ok(err instanceof PaymentRequiredError);
        assert.equal(err.statusCode, 402);
        assert.ok(Array.isArray(err.accepts));
        assert.ok(err.accepts.length > 0);
        assert.ok(err.accepts[0].maxAmountRequired);
        assert.ok(err.accepts[0].payTo);
        return true;
      },
    );
  });

  it("refreshScore throws PaymentRequiredError", async () => {
    await assert.rejects(
      () => client.refreshScore(TEST_WALLET),
      (err) => {
        assert.ok(err instanceof PaymentRequiredError);
        assert.equal(err.statusCode, 402);
        return true;
      },
    );
  });

  it("checkBlacklist throws PaymentRequiredError", async () => {
    await assert.rejects(
      () => client.checkBlacklist(TEST_WALLET),
      (err) => {
        assert.ok(err instanceof PaymentRequiredError);
        assert.equal(err.statusCode, 402);
        return true;
      },
    );
  });
});

describe("AgentScoreClient — error handling", () => {
  it("bad base URL throws NetworkError", async () => {
    const badClient = new AgentScoreClient({
      baseUrl: "http://localhost:1",
      maxRetries: 0,
      timeoutMs: 2000,
    });
    await assert.rejects(
      () => badClient.healthCheck(),
      (err) => {
        assert.ok(err instanceof NetworkError);
        return true;
      },
    );
  });
});
