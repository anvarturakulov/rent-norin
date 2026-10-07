import {
  getMaxWriteoffSnapshotBalance,
  resolveEffectiveWarehouseBalance,
} from "./writeoffQty.helper";

describe("resolveEffectiveWarehouseBalance", () => {
  it("returns raw warehouse balance when nothing written off in order", () => {
    expect(resolveEffectiveWarehouseBalance(7, 0, null)).toBe(7);
    expect(resolveEffectiveWarehouseBalance(7, 0, 7)).toBe(7);
  });

  it("subtracts written-off qty when stock snapshot is stale", () => {
    expect(resolveEffectiveWarehouseBalance(7, 5, 7)).toBe(2);
  });

  it("uses updated warehouse balance when stock already reflects writeoffs", () => {
    expect(resolveEffectiveWarehouseBalance(2, 5, 7)).toBe(2);
  });

  it("falls back to warehouse minus written off when no snapshot exists", () => {
    expect(resolveEffectiveWarehouseBalance(7, 5, null)).toBe(2);
  });

  it("returns zero when fully consumed", () => {
    expect(resolveEffectiveWarehouseBalance(7, 7, 7)).toBe(0);
    expect(resolveEffectiveWarehouseBalance(2, 5, 7)).toBe(2);
    expect(resolveEffectiveWarehouseBalance(0, 3, 5)).toBe(0);
  });
});

describe("getMaxWriteoffSnapshotBalance", () => {
  it("returns max balance across writeoff lines for item", () => {
    const writeoffs = [
      { materialId: 10, balance: 7 },
      { materialId: 10, balance: 5 },
      { materialId: 20, balance: 3 },
    ];
    expect(getMaxWriteoffSnapshotBalance(writeoffs, 10)).toBe(7);
    expect(getMaxWriteoffSnapshotBalance(writeoffs, 20)).toBe(3);
  });

  it("returns null when no snapshots exist", () => {
    expect(getMaxWriteoffSnapshotBalance([], 10)).toBeNull();
    expect(
      getMaxWriteoffSnapshotBalance([{ materialId: 10, balance: 0 }], 10),
    ).toBeNull();
  });
});
