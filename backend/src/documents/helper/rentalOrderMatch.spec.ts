import {
  matchReadyRentalOrders,
  missingStockLines,
  RentalOrderNeed,
} from "./rentalOrderMatch";

const order = (
  id: number,
  lines: Array<[number, number]>,
): RentalOrderNeed => ({
  id,
  clientId: id,
  warehouseId: 1,
  lines: lines.map(([toolId, qty]) => ({ toolId, qty })),
});

describe("matchReadyRentalOrders", () => {
  it("lists every order that fits individually, even if the sum does not", () => {
    const remain = { 10: 5 };
    const result = matchReadyRentalOrders(
      [order(12, [[10, 3]]), order(15, [[10, 4]])],
      remain,
    );
    expect(result.ready.map((o) => o.id)).toEqual([12, 15]);
    expect(result.enoughForAll).toBe(false);
  });

  it("marks enoughForAll when remain covers all ready orders together", () => {
    const remain = { 10: 7 };
    const result = matchReadyRentalOrders(
      [order(12, [[10, 3]]), order(15, [[10, 4]])],
      remain,
    );
    expect(result.ready.map((o) => o.id)).toEqual([12, 15]);
    expect(result.enoughForAll).toBe(true);
  });

  it("excludes an order that is short on any line", () => {
    const remain = { 10: 5, 20: 1 };
    const result = matchReadyRentalOrders(
      [order(1, [[10, 2]]), order(2, [[10, 2], [20, 3]])],
      remain,
    );
    expect(result.ready.map((o) => o.id)).toEqual([1]);
    expect(result.enoughForAll).toBe(true);
  });
});

describe("missingStockLines", () => {
  it("returns only short tools", () => {
    const missing = missingStockLines(
      [
        { toolId: 10, qty: 3 },
        { toolId: 20, qty: 4, toolName: "Дрель" },
      ],
      { 10: 5, 20: 1 },
    );
    expect(missing).toEqual([
      { toolId: 20, toolName: "Дрель", need: 4, remain: 1 },
    ]);
  });
});
