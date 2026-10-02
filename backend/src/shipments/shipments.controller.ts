import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";

import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { Roles } from "../auth/roles.decorator.js";
import { ShipmentsService } from "./shipments.service.js";

import type { CreateShipmentInput } from "./shipments.service.js";

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    username: string;
    role: string;
    warehouseId: number | null;
  };
}

@Controller("shipments")
export class ShipmentsController {
  constructor(
    private readonly shipmentsService: ShipmentsService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    "SYSTEM_ADMIN",
    "WAREHOUSE_STAFF",
    "LOGISTICS_MANAGER",
  )
  @Post()
  createShipment(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateShipmentInput,
  ) {
    return this.shipmentsService.createShipment(
      body,
      request.user,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("SYSTEM_ADMIN", "WAREHOUSE_STAFF")
  @Post(":shipmentNumber/receive")
  receiveShipment(
    @Req() request: AuthenticatedRequest,
    @Param("shipmentNumber") shipmentNumber: string,
  ) {
    return this.shipmentsService.receiveShipment(
      shipmentNumber,
      request.user,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    "SYSTEM_ADMIN",
    "WAREHOUSE_STAFF",
    "LOGISTICS_MANAGER",
  )
  @Post(":shipmentNumber/dispatch")
  dispatchShipment(
    @Req() request: AuthenticatedRequest,
    @Param("shipmentNumber") shipmentNumber: string,
  ) {
    return this.shipmentsService.dispatchShipment(
      shipmentNumber,
      request.user,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    "SYSTEM_ADMIN",
    "WAREHOUSE_STAFF",
    "LOGISTICS_MANAGER",
  )
  @Get()
  getShipments(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.shipmentsService.getShipments(
      request.user,
    );
  }
}