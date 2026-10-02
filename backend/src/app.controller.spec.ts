import { AppController } from './app.controller.js';

describe('AppController', () => {
  const prisma = {
    $queryRaw: vi.fn(),
  };
  let controller: AppController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AppController(prisma as never);
  });

  it("reports API status", () => {
    expect(controller.getStatus()).toEqual({
      system: "VELTRIX",
      status: "API is running",
    });
  });

  it("returns the database health query result", async () => {
    const currentTime = new Date("2026-10-02T00:00:00Z");
    prisma.$queryRaw.mockResolvedValue([{ current_time: currentTime }]);

    await expect(controller.databaseHealth()).resolves.toEqual({
      database: "connected",
      serverTime: currentTime,
    });
  });
});
