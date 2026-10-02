import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { LogisticsController } from "./logistics.controller.js";
import { LogisticsService } from "./logistics.service.js";

@Module({
  imports: [AuthModule],
  controllers: [LogisticsController],
  providers: [LogisticsService],
})
export class LogisticsModule {}
