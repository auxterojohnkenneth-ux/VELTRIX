import { AdminService } from "./admin.service.js";

describe("AdminService", () => {
  const prisma = {
    user: { count: vi.fn() },
    warehouse: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    item: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    shipment: { count: vi.fn() },
    stockTransfer: { count: vi.fn() },
    auditLog: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    warehouseStock: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    role: { findMany: vi.fn() },
  };
  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminService(prisma as never);
  });

  it("does not select audit payloads that can contain sensitive user fields", async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);

    await service.getAuditLogs();

    expect(prisma.auditLog.findMany).toHaveBeenCalledWith({
      select: {
        id: true,
        userId: true,
        action: true,
        tableName: true,
        recordIdentifier: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  });

  it("lists items with category and relationship counts", async () => {
    prisma.item.findMany.mockResolvedValue([]);

    await service.getItems();

    expect(prisma.item.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          sku: true,
          category: { select: { id: true, name: true } },
          _count: {
            select: {
              warehouseStock: true,
              shipmentItems: true,
              stockTransferItems: true,
            },
          },
        }),
        orderBy: { sku: "asc" },
      }),
    );
  });

  it("creates an item using trimmed values and a verified category", async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 2 });
    prisma.item.create.mockResolvedValue({ id: 1 });

    await service.createItem({
      categoryId: 2,
      sku: "  SKU-1 ",
      name: " Item One ",
      unitOfMeasure: " each ",
      reorderLevel: 0,
    });

    expect(prisma.category.findUnique).toHaveBeenCalledWith({
      where: { id: 2 },
      select: { id: true },
    });
    expect(prisma.item.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          categoryId: 2,
          sku: "SKU-1",
          name: "Item One",
          unitOfMeasure: "each",
          description: null,
          weight: null,
          reorderLevel: 0,
          isActive: true,
        },
      }),
    );
  });

  it("rejects an invalid item reorder level before writing", async () => {
    await expect(
      service.createItem({
        categoryId: 1,
        sku: "SKU-1",
        name: "Item",
        unitOfMeasure: "each",
        reorderLevel: -1,
      }),
    ).rejects.toThrow("reorderLevel must be a non-negative integer.");

    expect(prisma.item.create).not.toHaveBeenCalled();
  });

  it("rejects integer values outside the database integer range", async () => {
    await expect(
      service.createItem({
        categoryId: 1,
        sku: "SKU-1",
        name: "Item",
        unitOfMeasure: "each",
        reorderLevel: 2_147_483_648,
      }),
    ).rejects.toThrow("reorderLevel must be a non-negative integer.");
  });

  it("rejects a missing item category before writing", async () => {
    prisma.category.findUnique.mockResolvedValue(null);

    await expect(
      service.createItem({
        categoryId: 99,
        sku: "SKU-1",
        name: "Item",
        unitOfMeasure: "each",
      }),
    ).rejects.toThrow("The selected category does not exist.");

    expect(prisma.item.create).not.toHaveBeenCalled();
  });

  it("updates item attributes without changing its id or relationships", async () => {
    prisma.item.update.mockResolvedValue({ id: 1 });

    await service.updateItem(1, {
      name: "Updated item",
      reorderLevel: 3,
      isActive: false,
    });

    expect(prisma.item.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1 },
        data: {
          name: "Updated item",
          reorderLevel: 3,
          isActive: false,
        },
      }),
    );
  });

  it("maps duplicate item SKUs to a conflict", async () => {
    prisma.category.findUnique.mockResolvedValue({ id: 2 });
    prisma.item.create.mockRejectedValue({ code: "P2002" });

    await expect(
      service.createItem({
        categoryId: 2,
        sku: "SKU-1",
        name: "Item",
        unitOfMeasure: "each",
      }),
    ).rejects.toThrow("An item with this SKU already exists.");
  });

  it("creates warehouses with the existing required address fields", async () => {
    prisma.warehouse.create.mockResolvedValue({ id: 4 });

    await service.createWarehouse({
      code: " WH-4 ",
      name: " Warehouse Four ",
      addressLine: " 4 Main Road ",
      city: "Town",
      province: "Province",
      postalCode: "1000",
      contactNumber: "123456",
    });

    expect(prisma.warehouse.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          code: "WH-4",
          name: "Warehouse Four",
          addressLine: "4 Main Road",
          city: "Town",
          province: "Province",
          postalCode: "1000",
          contactNumber: "123456",
          status: "ACTIVE",
        },
      }),
    );
  });

  it("maps duplicate warehouse codes to a conflict", async () => {
    prisma.warehouse.create.mockRejectedValue({ code: "P2002" });

    await expect(
      service.createWarehouse({
        code: "WH-4",
        name: "Warehouse Four",
        addressLine: "4 Main Road",
        city: "Town",
        province: "Province",
        postalCode: "1000",
        contactNumber: "123456",
      }),
    ).rejects.toThrow("A warehouse with this code already exists.");
  });

  it("updates a warehouse without changing its id or relations", async () => {
    prisma.warehouse.update.mockResolvedValue({ id: 4 });

    await service.updateWarehouse(4, {
      name: "Updated name",
      status: "INACTIVE",
    });

    expect(prisma.warehouse.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 4 },
        data: { name: "Updated name", status: "INACTIVE" },
      }),
    );
  });
});
