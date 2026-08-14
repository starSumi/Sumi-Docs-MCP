/**
 * @file Bounded concurrency utilities
 */

/**
 * Process items in batches with bounded concurrency
 */
export async function processBatched<T>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<void>,
  stats?: { active: number; peak: number },
): Promise<void> {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new RangeError("batchSize must be a positive integer");
  }

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (item) => {
        if (stats) {
          stats.active += 1;
          stats.peak = Math.max(stats.peak, stats.active);
        }
        try {
          await processor(item);
        } finally {
          if (stats) stats.active -= 1;
        }
      }),
    );
  }
}
