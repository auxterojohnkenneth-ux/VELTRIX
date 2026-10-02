import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma/prisma.service.js";

@Controller()
export class AppController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  getStatus() {
    return {
      system: "VELTRIX",
      status: "API is running",
    };
  }

  @Get("health/database")
  async databaseHealth() {
    const result = await this.prisma.$queryRaw<
      { current_time: Date }[]
    >`SELECT NOW() AS current_time`;

    return {
      database: "connected",
      serverTime: result[0]?.current_time,
    };
  }
}
