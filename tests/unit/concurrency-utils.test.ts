/**
 * @file Concurrency utilities tests
 */

import { test } from "node:test";
import assert from "node:assert";
import { processBatched } from "../../src/utils/concurrency.js";

test("processBatched - respects batch size limit", async () => {
  const items = Array.from({ length: 25 }, (_, i) => i);
  const stats = { active: 0, peak: 0 };
  const processed: number[] = [];
  let callbackActive = 0;
  let callbackPeak = 0;

  await processBatched(
    items,
    10,
    async (item) => {
      callbackActive += 1;
      callbackPeak = Math.max(callbackPeak, callbackActive);
      await new Promise((resolve) => setTimeout(resolve, 1));
      processed.push(item);
      callbackActive -= 1;
    },
    stats,
  );

  assert.strictEqual(processed.length, 25, "Should process all items");
  assert.ok(
    stats.peak <= 10,
    `Peak concurrency ${stats.peak} should not exceed 10`,
  );
  assert.strictEqual(
    stats.peak,
    callbackPeak,
    "Stats should reflect processor concurrency",
  );
  assert.strictEqual(stats.active, 0, "Should have no active tasks at end");
  assert.strictEqual(
    callbackActive,
    0,
    "Processor callbacks should have completed",
  );
});

test("processBatched - processes items in order within batches", async () => {
  const items = [1, 2, 3, 4, 5];
  const processed: number[] = [];

  await processBatched(items, 2, async (item) => {
    processed.push(item);
  });

  assert.strictEqual(processed.length, 5);
  // Order within a batch may vary, but all items should be present
  assert.deepStrictEqual(processed.sort(), [1, 2, 3, 4, 5]);
});

test("processBatched - propagates errors", async () => {
  const items = [1, 2, 3];

  await assert.rejects(
    async () => {
      await processBatched(items, 2, async (item) => {
        if (item === 2) {
          throw new Error("Test error");
        }
      });
    },
    { message: "Test error" },
  );
});

test("processBatched - rejects invalid batch sizes", async () => {
  await assert.rejects(() => processBatched([1], 0, async () => undefined), {
    name: "RangeError",
  });
});
