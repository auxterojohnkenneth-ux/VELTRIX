import { ForbiddenException } from "@nestjs/common";
import { InventoryService } from "./inventory.service.js";

describe('InventoryService', () => {
  const prisma = {
    warehouseStock: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    shipment: {
      count: vi.fn(),
    },
    stockTransfer: {
      count: vi.fn(),
    },
  };
  let service: InventoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new InventoryService(prisma as never);
    prisma.warehouseStock.findMany.mockResolvedValue([]);
    prisma.warehouseStock.aggregate.mockResolvedValue({
      _sum: { quantityOnHand: 0 },
    });
    prisma.shipment.count.mockResolvedValue(0);
    prisma.stockTransfer.count.mockResolvedValue(0);
  });

  it("limits warehouse stock to the user's assigned warehouse", async () => {
    await service.getWarehouseStock({
      userId: 4,
      username: "warehouse1",
      role: "WAREHOUSE_STAFF",
      warehouseId: 1,
    });

    expect(prisma.warehouseStock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { warehouseId: 1 },
      }),
    );
  });

  it("rejects warehouse staff without an assigned warehouse", async () => {
    await expect(
      service.getWarehouseStock({
        userId: 4,
        username: "warehouse1",
        role: "WAREHOUSE_STAFF",
        warehouseId: null,
      }),
    ).rejects.toThrow(ForbiddenException);
  });
});
