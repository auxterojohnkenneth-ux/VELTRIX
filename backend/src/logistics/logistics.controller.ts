import {
  Controller,
  Get,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { LogisticsService } from "./logistics.service.js";

@Controller("logistics")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SYSTEM_ADMIN", "LOGISTICS_MANAGER")
export class LogisticsController {
  constructor(
    private readonly logisticsService: LogisticsService,
  ) {}

  @Get("dashboard")
  getDashboard() {
    return this.logisticsService.getDashboard();
  }

  @Get("shipments")
  getShipments() {
    return this.logisticsService.getShipments();
  }

  @Get("drivers")
  getDrivers() {
    return this.logisticsService.getDrivers();
  }

  @Get("vehicles")
  getVehicles() {
    return this.logisticsService.getVehicles();
  }

  @Get("routes")
  getRoutes() {
    return this.logisticsService.getRoutes();
  }
}
