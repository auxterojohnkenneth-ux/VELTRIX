import { AdminService } from "./admin.service.js";
import bcrypt from "bcrypt";

describe("AdminService", () => {
  const prisma = {
    user: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    warehouse: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
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
    role: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };
  let service: AdminService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminService(prisma as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a hashed staff account with its database role and warehouse", async () => {
    const staffRecord = {
      id: 8,
      firstName: "Riley",
      lastName: "Warehouse",
      username: "rwarehouse",
      email: "riley@example.test",
      isActive: true,
      warehouse: { id: 4, code: "WH-4", name: "Warehouse Four" },
    };
    prisma.role.findUnique.mockResolvedValue({ id: 2 });
    prisma.warehouse.findFirst.mockResolvedValue({ id: 4 });
    vi.spyOn(bcrypt, "hash").mockResolvedValue("secure-hash");
    prisma.user.create.mockResolvedValue(staffRecord);

    const result = await service.createWarehouseStaff({
      firstName: " Riley ",
      lastName: " Warehouse ",
      username: " rwarehouse ",
      email: " RILEY@example.test ",
      password: "  Long-enough Password  ",
      warehouseId: 4,
    });

    expect(prisma.role.findUnique).toHaveBeenCalledWith({
      where: { name: "WAREHOUSE_STAFF" },
      select: { id: true },
    });
    expect(prisma.warehouse.findFirst).toHaveBeenCalledWith({
      where: { id: 4, status: "ACTIVE" },
      select: { id: true },
    });
    expect(bcrypt.hash).toHaveBeenCalledWith("  Long-enough Password  ", 12);
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        roleId: 2,
        warehouseId: 4,
        username: "rwarehouse",
        email: "riley@example.test",
        passwordHash: "secure-hash",
        firstName: "Riley",
        lastName: "Warehouse",
      },
      select: expect.not.objectContaining({ passwordHash: true }),
    });
    expect(result).toEqual(staffRecord);
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("password");
  });

  it("lists only warehouse staff using a safe response projection", async () => {
    prisma.user.findMany.mockResolvedValue([]);

    await service.getWarehouseStaff();

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { role: { name: "WAREHOUSE_STAFF" } },
      select: expect.not.objectContaining({ passwordHash: true }),
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
    });
  });

  it("rejects inactive or nonexistent warehouses before account creation", async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 2 });
    prisma.warehouse.findFirst.mockResolvedValue(null);

    await expect(
      service.createWarehouseStaff({
        firstName: "Riley",
        lastName: "Warehouse",
        username: "rwarehouse",
        email: "riley@example.test",
        password: "long-enough-password",
        warehouseId: 4,
      }),
    ).rejects.toThrow("The selected warehouse does not exist or is inactive.");

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("rejects malformed account values and client-supplied roles", async () => {
    await expect(
      service.createWarehouseStaff({
        firstName: "Riley",
        lastName: "Warehouse",
        username: "rwarehouse",
        email: "not-an-email",
        password: "short",
        warehouseId: 4,
        roleId: 1,
      }),
    ).rejects.toThrow("Unknown field: roleId");
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it("maps duplicate account usernames and emails to conflict responses", async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 2 });
    prisma.warehouse.findFirst.mockResolvedValue({ id: 4 });
    vi.spyOn(bcrypt, "hash").mockResolvedValue("secure-hash");
    prisma.user.create.mockRejectedValue({
      code: "P2002",
      meta: { target: ["username"] },
    });

    await expect(
      service.createWarehouseStaff({
        firstName: "Riley",
        lastName: "Warehouse",
        username: "rwarehouse",
        email: "riley@example.test",
        password: "long-enough-password",
        warehouseId: 4,
      }),
    ).rejects.toThrow("A user with this username already exists.");
  });

  it("maps duplicate account emails to a conflict response", async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 2 });
    prisma.warehouse.findFirst.mockResolvedValue({ id: 4 });
    vi.spyOn(bcrypt, "hash").mockResolvedValue("secure-hash");
    prisma.user.create.mockRejectedValue({
      code: "P2002",
      meta: { target: ["email"] },
    });

    await expect(
      service.createWarehouseStaff({
        firstName: "Riley",
        lastName: "Warehouse",
        username: "rwarehouse",
        email: "riley@example.test",
        password: "long-enough-password",
        warehouseId: 4,
      }),
    ).rejects.toThrow("A user with this email address already exists.");
  });

  it("reassigns staff only to an active warehouse", async () => {
    const updatedStaff = {
      id: 8,
      firstName: "Riley",
      lastName: "Warehouse",
      username: "rwarehouse",
      email: "riley@example.test",
      isActive: true,
      warehouse: { id: 5, code: "WH-5", name: "Warehouse Five" },
    };
    prisma.warehouse.findFirst.mockResolvedValue({ id: 5 });
    prisma.user.findFirst.mockResolvedValue({ id: 8 });
    prisma.user.update.mockResolvedValue(updatedStaff);

    await expect(service.assignWarehouseStaff(8, { warehouseId: 5 }))
      .resolves.toEqual(updatedStaff);

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { id: 8, role: { name: "WAREHOUSE_STAFF" } },
      select: { id: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 8 },
        data: { warehouseId: 5 },
        select: expect.not.objectContaining({ passwordHash: true }),
      }),
    );
  });

  it("rejects assigning staff to an inactive or nonexistent warehouse", async () => {
    prisma.warehouse.findFirst.mockResolvedValue(null);

    await expect(
      service.assignWarehouseStaff(8, { warehouseId: 5 }),
    ).rejects.toThrow("The selected warehouse does not exist or is inactive.");

    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it("changes account activation without exposing credentials", async () => {
    const inactiveStaff = {
      id: 8,
      firstName: "Riley",
      lastName: "Warehouse",
      username: "rwarehouse",
      email: "riley@example.test",
      isActive: false,
      warehouse: { id: 4, code: "WH-4", name: "Warehouse Four" },
    };
    prisma.user.findFirst.mockResolvedValue({ id: 8 });
    prisma.user.update
      .mockResolvedValueOnce(inactiveStaff)
      .mockResolvedValueOnce({ ...inactiveStaff, isActive: true });

    await expect(service.updateWarehouseStaffStatus(8, { isActive: false }))
      .resolves.toEqual(inactiveStaff);
    await expect(service.updateWarehouseStaffStatus(8, { isActive: true }))
      .resolves.toMatchObject({ isActive: true });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 8 },
        data: { isActive: false },
      }),
    );
    expect(prisma.user.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 8 },
        data: { isActive: true },
      }),
    );
    expect(inactiveStaff).not.toHaveProperty("passwordHash");
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
