import { ClientToolBatchesService } from "./clientToolBatches.service";

const mockTransaction = { LOCK: { UPDATE: "UPDATE" } } as any;

const makeBatch = (overrides: Record<string, unknown> = {}) => {
  const batch = {
    id: 1,
    transferDocId: 100,
    toolId: 25182,
    openQty: 1,
    initialQty: 1,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return batch;
};

const makeReceiveDoc = (
  docTableItems: Array<Record<string, unknown>>,
  overrides: Record<string, unknown> = {},
) => ({
  id: 187741,
  enterpriseId: 1,
  docValues: { senderId: 10 },
  docTableItems,
  ...overrides,
});

describe("ClientToolBatchesService.consumeBatchesOnReceivePosted", () => {
  let service: ClientToolBatchesService;
  let batchModel: {
    findAll: jest.Mock;
  };
  let consumptionModel: {
    count: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(() => {
    batchModel = { findAll: jest.fn() };
    consumptionModel = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({}),
    };
    service = new ClientToolBatchesService(
      batchModel as any,
      consumptionModel as any,
      {} as any,
    );
  });

  it("consumes open batch for return row only", async () => {
    const batch = makeBatch();
    batchModel.findAll.mockResolvedValue([batch]);

    await service.consumeBatchesOnReceivePosted(
      makeReceiveDoc([
        {
          analiticId: 25182,
          count: 1,
          tableType: "return",
          sourceTransferDocId: 100,
        },
      ]) as any,
      mockTransaction,
    );

    expect(batch.openQty).toBe(0);
    expect(consumptionModel.create).toHaveBeenCalledTimes(1);
    expect(consumptionModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ tableType: "return", qty: 1 }),
      expect.any(Object),
    );
  });

  it("does not double-consume when brak row is copied from return", async () => {
    const batch = makeBatch();
    batchModel.findAll.mockResolvedValue([batch]);

    await service.consumeBatchesOnReceivePosted(
      makeReceiveDoc([
        {
          analiticId: 25182,
          count: 1,
          tableType: "return",
          sourceTransferDocId: 100,
        },
        {
          analiticId: 25182,
          count: 1,
          tableType: "brak",
          sourceTransferDocId: 100,
        },
      ]) as any,
      mockTransaction,
    );

    expect(batch.openQty).toBe(0);
    expect(consumptionModel.create).toHaveBeenCalledTimes(1);
  });

  it("does not double-consume when sale row is copied from return", async () => {
    const batch = makeBatch();
    batchModel.findAll.mockResolvedValue([batch]);

    await service.consumeBatchesOnReceivePosted(
      makeReceiveDoc([
        {
          analiticId: 25182,
          count: 1,
          tableType: "return",
          sourceTransferDocId: 100,
        },
        {
          analiticId: 25182,
          count: 1,
          tableType: "sale",
          sourceTransferDocId: 100,
        },
      ]) as any,
      mockTransaction,
    );

    expect(batch.openQty).toBe(0);
    expect(consumptionModel.create).toHaveBeenCalledTimes(1);
  });

  it("throws when return qty exceeds open batches", async () => {
    const batch = makeBatch();
    batchModel.findAll.mockResolvedValue([batch]);

    await expect(
      service.consumeBatchesOnReceivePosted(
        makeReceiveDoc([
          {
            analiticId: 25182,
            count: 2,
            tableType: "return",
            sourceTransferDocId: 100,
          },
        ]) as any,
        mockTransaction,
      ),
    ).rejects.toThrow(/missing 1/);
  });
});
