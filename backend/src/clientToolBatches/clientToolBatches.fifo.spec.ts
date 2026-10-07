import { planFifoConsumptions } from "./clientToolBatches.fifo";

describe("planFifoConsumptions", () => {
  const cloneBatches = () => [
    {
      transferDocId: 100,
      toolId: 1,
      openQty: 2,
    },
    {
      transferDocId: 150,
      toolId: 1,
      openQty: 1,
    },
  ];

  it("consumes oldest batch first", () => {
    const batches = cloneBatches();
    const plans = planFifoConsumptions(batches, 1, 2, null);
    expect(plans).toEqual([{ batchIndex: 0, qty: 2 }]);
    expect(batches[0].openQty).toBe(0);
  });

  it("consumes across multiple transfer documents", () => {
    const batches = cloneBatches();
    const plans = planFifoConsumptions(batches, 1, 3, null);
    expect(plans).toEqual([
      { batchIndex: 0, qty: 2 },
      { batchIndex: 1, qty: 1 },
    ]);
  });

  it("respects pinned transfer document then falls back to fifo", () => {
    const batches = cloneBatches();
    const plans = planFifoConsumptions(batches, 1, 2, 150);
    expect(plans).toEqual([
      { batchIndex: 1, qty: 1 },
      { batchIndex: 0, qty: 1 },
    ]);
  });

  it("throws when qty exceeds open batches", () => {
    const batches = cloneBatches();
    expect(() => planFifoConsumptions(batches, 1, 5, null)).toThrow(
      /missing 2/,
    );
  });
});
