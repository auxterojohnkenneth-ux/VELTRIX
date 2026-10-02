import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import {
  TransfersService,
  type CreateTransferInput,
} from "./transfers.service.js";

describe("TransfersService", () => {
  const prisma = {
    warehouse: {
      findMany: vi.fn(),
    },
    item: {
      findMany: vi.fn(),
    },
    stockTransfer: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    $queryRaw: vi.fn(),
  };
  let service: TransfersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TransfersService(prisma as never);
    prisma.warehouse.findMany.mockResolvedValue([
      { id: 1 },
      { id: 4 },
    ]);
    prisma.item.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.$queryRaw.mockResolvedValue([
      {
        transfer_id: 9,
        transfer_number: "TRF-2026-0001",
        status: "COMPLETED",
      },
    ]);
  });

  const transferInput = {
    transferNumber: "TRF-2026-0001",
    sourceWarehouseId: 1,
    destinationWarehouseId: 4,
    items: [{ itemId: 1, quantity: 5 }],
  };
  const warehouseStaff = {
    userId: 4,
    username: "warehouse1",
    role: "WAREHOUSE_STAFF",
    warehouseId: 1,
  };

  it("returns the database function result for a valid transfer", async () => {
    await expect(
      service.createTransfer(transferInput, warehouseStaff),
    ).resolves.toEqual({
      transfer_id: 9,
      transfer_number: "TRF-2026-0001",
      status: "COMPLETED",
    });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it("returns insufficient-stock function errors as a bad request", async () => {
    prisma.$queryRaw.mockRejectedValue({
      code: "P2010",
      meta: {
        code: "P0001",
        message:
          "ERROR: Insufficient stock for item 1. Available: 87, requested: 100",
      },
    });

    await expect(
      service.createTransfer(
        {
          ...transferInput,
          items: [{ itemId: 1, quantity: 100 }],
        },
        warehouseStaff,
      ),
    ).rejects.toThrow(
      new BadRequestException(
        "Insufficient stock for item 1. Available: 87, requested: 100",
      ),
    );
  });

  it("returns duplicate transfer errors as a conflict", async () => {
    prisma.$queryRaw.mockRejectedValue({
      code: "P2010",
      meta: { code: "23505" },
    });

    await expect(
      service.createTransfer(transferInput, warehouseStaff),
    ).rejects.toThrow(ConflictException);
  });

  it("rejects warehouse staff creating a transfer from another warehouse", async () => {
    await expect(
      service.createTransfer(
        {
          ...transferInput,
          sourceWarehouseId: 4,
          destinationWarehouseId: 1,
        },
        warehouseStaff,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects warehouse staff without an assigned warehouse", async () => {
    await expect(
      service.createTransfer(transferInput, {
        ...warehouseStaff,
        warehouseId: null,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects transfers whose source and destination are the same", async () => {
    await expect(
      service.createTransfer(
        { ...transferInput, destinationWarehouseId: 1 },
        warehouseStaff,
      ),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects a missing warehouse before calling the function", async () => {
    prisma.warehouse.findMany.mockResolvedValue([{ id: 1 }]);

    await expect(
      service.createTransfer(transferInput, warehouseStaff),
    ).rejects.toThrow("Destination warehouse 4 does not exist");
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects a missing item before calling the function", async () => {
    prisma.item.findMany.mockResolvedValue([]);

    await expect(
      service.createTransfer(transferInput, warehouseStaff),
    ).rejects.toThrow("Item 1 does not exist");
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it("rejects duplicate item IDs in the request", async () => {
    await expect(
      service.createTransfer(
        {
          ...transferInput,
          items: [
            { itemId: 1, quantity: 2 },
            { itemId: 1, quantity: 3 },
          ],
        },
        warehouseStaff,
      ),
    ).rejects.toThrow("Each item may only appear once");
    expect(prisma.warehouse.findMany).not.toHaveBeenCalled();
  });

  it("uses the authenticated requester instead of client requester data", async () => {
    await service.createTransfer(
      {
        ...transferInput,
        requestedBy: 999,
      } as CreateTransferInput,
      warehouseStaff,
    );

    const queryParameters = prisma.$queryRaw.mock.calls[0].slice(1);
    expect(queryParameters).toContain(warehouseStaff.userId);
    expect(queryParameters).not.toContain(999);
  });

  it("scopes warehouse staff transfer history to their assigned warehouse", async () => {
    prisma.stockTransfer.findMany.mockResolvedValue([]);

    await service.getTransfers(warehouseStaff);

    expect(prisma.stockTransfer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { sourceWarehouseId: 1 },
            { destinationWarehouseId: 1 },
          ],
        },
      }),
    );
  });
});
