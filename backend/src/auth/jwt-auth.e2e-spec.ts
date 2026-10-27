import {
  Controller,
  Get,
  Req,
  UseGuards,
  type INestApplication,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { Test } from "@nestjs/testing";
import type { Request } from "express";
import request from "supertest";
import { InventoryService } from "../inventory/inventory.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { JwtAuthGuard } from "./jwt-auth.guard.js";
import { JwtStrategy } from "./jwt.strategy.js";

const jwtSecret = "test-only-jwt-secret";

@Controller("test/inventory")
class JwtInventoryTestController {
  constructor(private readonly inventoryService: InventoryService) {}

  @UseGuards(JwtAuthGuard)
  @Get("stock")
  getStock(
    @Req()
    req: Request & {
      user: Parameters<InventoryService["getWarehouseStock"]>[0];
    },
  ) {
    return this.inventoryService.getWarehouseStock(req.user);
  }
}

describe("JWT authentication and current authorization", () => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
    },
    warehouseStock: {
      findMany: vi.fn(),
    },
  };
  let app: INestApplication;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: "jwt" }),
        JwtModule.register({ secret: jwtSecret }),
      ],
      controllers: [JwtInventoryTestController],
      providers: [
        InventoryService,
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: () => jwtSecret } },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    jwtService = moduleRef.get(JwtService);
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.warehouseStock.findMany.mockResolvedValue([]);
  });

  afterAll(async () => {
    await app.close();
  });

  async function tokenFor(claims: Record<string, unknown>) {
    return jwtService.signAsync(claims, { secret: jwtSecret });
  }

  function inventoryRequest(token: string) {
    return request(app.getHttpServer())
      .get("/test/inventory/stock")
      .set("Authorization", `Bearer ${token}`);
  }

  it("rejects a deactivated account despite a previously valid JWT", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 4,
      username: "warehouse1",
      isActive: false,
      warehouseId: 1,
      role: { name: "WAREHOUSE_STAFF" },
    });

    const response = await inventoryRequest(
      await tokenFor({ sub: 4, role: "WAREHOUSE_STAFF", warehouseId: 1 }),
    );

    expect(response.status).toBe(401);
    expect(prisma.warehouseStock.findMany).not.toHaveBeenCalled();
  });

  it("uses the new warehouse assignment when an old JWT names the former one", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 4,
      username: "warehouse1",
      isActive: true,
      warehouseId: 2,
      role: { name: "WAREHOUSE_STAFF" },
    });

    const response = await inventoryRequest(
      await tokenFor({ sub: 4, role: "WAREHOUSE_STAFF", warehouseId: 1 }),
    );

    expect(response.status).toBe(200);
    expect(prisma.warehouseStock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { warehouseId: 2 } }),
    );
    expect(prisma.warehouseStock.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { warehouseId: 1 } }),
    );
  });

  it("preserves current SYSTEM_ADMIN permissions despite stale role claims", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 1,
      username: "admin",
      isActive: true,
      warehouseId: null,
      role: { name: "SYSTEM_ADMIN" },
    });

    const response = await inventoryRequest(
      await tokenFor({ sub: 1, role: "WAREHOUSE_STAFF", warehouseId: 2 }),
    );

    expect(response.status).toBe(200);
    expect(prisma.warehouseStock.findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({ where: expect.anything() }),
    );
  });
});
