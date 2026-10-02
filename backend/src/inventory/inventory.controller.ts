import {
  Controller,
  Get,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { InventoryService } from "./inventory.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    username: string;
    role: string;
    warehouseId: number | null;
  };
}

@Controller("inventory")
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get("stock")
  getWarehouseStock(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventoryService.getWarehouseStock(
      request.user,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get("dashboard")
  getWarehouseDashboard(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.inventoryService.getWarehouseDashboard(
      request.user,
    );
  }
}