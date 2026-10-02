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
