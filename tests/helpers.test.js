import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AgentScoreClient } from "../dist/esm/index.js";

const client = new AgentScoreClient();
const TEST_WALLET = "0xef4364fe4487353df46eb7c811d4fac78b856c7f";

describe("shouldTransact helper", () => {
  it("returns a boolean", async () => {
    const result = await client.shouldTransact(TEST_WALLET);
    assert.equal(typeof result, "boolean");
  });
});

describe("gateTransaction helper", () => {
  it("returns a GateResult with expected shape", async () => {
    const result = await client.gateTransaction(TEST_WALLET);
    assert.equal(typeof result.approved, "boolean");
    assert.ok(
      ["proceed", "proceed_with_caution", "blocked", "unknown_recommendation"].includes(
        result.reason,
      ),
    );
    assert.equal(typeof result.score, "number");
    assert.equal(typeof result.recommendation, "string");
    assert.ok(result.wallet);
  });

  it("approved is true only for proceed or proceed_with_caution", async () => {
    const result = await client.gateTransaction(TEST_WALLET);
    if (result.reason === "proceed" || result.reason === "proceed_with_caution") {
      assert.equal(result.approved, true);
    } else {
      assert.equal(result.approved, false);
    }
  });
});
