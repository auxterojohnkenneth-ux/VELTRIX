import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { Throttle } from "@nestjs/throttler";
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

  @Get("warehouse-staff")
  getWarehouseStaff() {
    return this.adminService.getWarehouseStaff();
  }

  @Post("warehouse-staff")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  createWarehouseStaff(@Body() body: unknown) {
    return this.adminService.createWarehouseStaff(body);
  }

  @Patch("warehouse-staff/:id/warehouse")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  assignWarehouseStaff(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.adminService.assignWarehouseStaff(id, body);
  }

  @Patch("warehouse-staff/:id/status")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  updateWarehouseStaffStatus(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.adminService.updateWarehouseStaffStatus(id, body);
  }

  @Post("warehouses")
  createWarehouse(@Body() body: Record<string, unknown>) {
    return this.adminService.createWarehouse(body);
  }

  @Patch("warehouses/:id")
  updateWarehouse(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.updateWarehouse(id, body);
  }

  @Get("items")
  getItems() {
    return this.adminService.getItems();
  }

  @Post("items")
  createItem(@Body() body: Record<string, unknown>) {
    return this.adminService.createItem(body);
  }

  @Patch("items/:id")
  updateItem(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: Record<string, unknown>,
  ) {
    return this.adminService.updateItem(id, body);
  }

  @Get("categories")
  getCategories() {
    return this.adminService.getCategories();
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
