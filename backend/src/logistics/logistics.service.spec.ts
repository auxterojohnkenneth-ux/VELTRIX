import { LogisticsService } from "./logistics.service.js";

describe("LogisticsService", () => {
  const prisma = {
    shipment: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    driver: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    vehicle: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    route: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  };
  let service: LogisticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LogisticsService(prisma as never);
    prisma.shipment.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    prisma.driver.count.mockResolvedValue(3);
    prisma.vehicle.count.mockResolvedValue(4);
    prisma.route.count.mockResolvedValue(6);
  });

  it("returns logistics statistics from database counts", async () => {
    await expect(service.getDashboard()).resolves.toEqual({
      totalShipments: 5,
      pendingShipments: 2,
      dispatchedShipments: 1,
      receivedShipments: 2,
      activeDrivers: 3,
      availableVehicles: 4,
      activeRoutes: 6,
    });
  });
});
