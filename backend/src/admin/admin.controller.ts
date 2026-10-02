import {
  Controller,
  Get,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { AdminService } from "./admin.service.js";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SYSTEM_ADMIN")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
  ) {}

  @Get("dashboard")
  getDashboard() {
    return this.adminService.getDashboard();
  }

  @Get("warehouses")
  getWarehouses() {
    return this.adminService.getWarehouses();
  }

  @Get("roles")
  getRoles() {
    return this.adminService.getRoles();
  }

  @Get("audit-logs")
  getAuditLogs() {
    return this.adminService.getAuditLogs();
  }
}
