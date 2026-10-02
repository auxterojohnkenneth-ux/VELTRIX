import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcrypt";
import { AuthService } from "./auth.service.js";

describe('AuthService', () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
  };
  const jwtService = {
    signAsync: vi.fn(),
  };
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AuthService(
      prisma as never,
      jwtService as never as JwtService,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects an unknown username", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.login("missing-user", "wrong-password"),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects an inactive user", async () => {
    prisma.user.findUnique.mockResolvedValue({
      isActive: false,
    });

    await expect(
      service.login("warehouse1", "password"),
    ).rejects.toThrow("Account is inactive");
  });

  it("issues a JWT for valid credentials", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 4,
      username: "warehouse1",
      email: "warehouse1@example.test",
      passwordHash: "stored-hash",
      firstName: "Warehouse",
      lastName: "Staff",
      isActive: true,
      warehouseId: 1,
      role: { name: "WAREHOUSE_STAFF" },
    });
    vi.spyOn(bcrypt, "compare").mockResolvedValue(true);
    jwtService.signAsync.mockResolvedValue("signed-token");

    await expect(
      service.login("warehouse1", "password"),
    ).resolves.toEqual({
      accessToken: "signed-token",
      user: {
        id: 4,
        username: "warehouse1",
        firstName: "Warehouse",
        lastName: "Staff",
        role: "WAREHOUSE_STAFF",
        warehouseId: 1,
      },
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 4,
      username: "warehouse1",
      role: "WAREHOUSE_STAFF",
      warehouseId: 1,
    });
  });
});
