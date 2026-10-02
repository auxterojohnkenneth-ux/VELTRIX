import { UsersService } from "./users.service.js";

describe('UsersService', () => {
  const prisma = {
    user: {
      findMany: vi.fn(),
    },
  };
  let service: UsersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new UsersService(prisma as never);
    prisma.user.findMany.mockResolvedValue([]);
  });

  it("limits warehouse staff users to their assigned warehouse", async () => {
    await service.getUsers({
      userId: 4,
      role: "WAREHOUSE_STAFF",
      warehouseId: 1,
    });

    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { warehouseId: 1 },
      }),
    );
  });

  it("rejects warehouse staff without an assigned warehouse", async () => {
    await expect(
      service.getUsers({
        userId: 4,
        role: "WAREHOUSE_STAFF",
        warehouseId: null,
      }),
    ).rejects.toThrow("Warehouse staff must be assigned to a warehouse");
  });
});
