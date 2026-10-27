import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtStrategy } from "./jwt.strategy.js";

describe("JwtStrategy", () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
  };
  let strategy: JwtStrategy;

  beforeEach(() => {
    vi.clearAllMocks();
    strategy = new JwtStrategy(
      { getOrThrow: () => "test-secret" } as ConfigService,
      prisma as never,
    );
  });

  it("uses the current active account instead of role and warehouse token claims", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 4,
      username: "current-name",
      isActive: true,
      warehouseId: 2,
      role: { name: "WAREHOUSE_STAFF" },
    });

    await expect(
      strategy.validate({
        sub: 4,
        username: "stale-name",
        role: "SYSTEM_ADMIN",
        warehouseId: 1,
      }),
    ).resolves.toEqual({
      userId: 4,
      username: "current-name",
      role: "WAREHOUSE_STAFF",
      warehouseId: 2,
    });
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 4 },
      select: {
        id: true,
        username: true,
        isActive: true,
        warehouseId: true,
        role: { select: { name: true } },
      },
    });
  });

  it("rejects a deactivated account with a previously valid token", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 4,
      username: "warehouse1",
      isActive: false,
      warehouseId: 1,
      role: { name: "WAREHOUSE_STAFF" },
    });

    await expect(
      strategy.validate({ sub: 4, role: "WAREHOUSE_STAFF", warehouseId: 1 }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects tokens whose account no longer exists", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(strategy.validate({ sub: 4 })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it("rejects an invalid token subject before querying the database", async () => {
    await expect(strategy.validate({ sub: "4" })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
