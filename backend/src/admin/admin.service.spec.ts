import { AdminService } from "./admin.service.js";

describe("AdminService", () => {
  const prisma = {
    user: { count: vi.fn() },
    warehouse: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    item: { count: vi.fn() },
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
});
