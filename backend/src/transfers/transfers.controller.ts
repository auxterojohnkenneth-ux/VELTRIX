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
import { TransfersService } from "./transfers.service.js";

import type {
  AuthenticatedUser,
  CreateTransferInput,
} from "./transfers.service.js";

interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Controller("transfers")
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(
    private readonly transfersService: TransfersService,
  ) {}

  @Post()
  createTransfer(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateTransferInput,
  ) {
    return this.transfersService.createTransfer(
      body,
      request.user,
    );
  }

  @Get()
  getTransfers(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfersService.getTransfers(
      request.user,
    );
  }

  @Get("warehouses")
  getWarehouses(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.transfersService.getWarehouses(
      request.user,
    );
  }

  @Get(":transferNumber")
  getTransfer(
    @Req() request: AuthenticatedRequest,
    @Param("transferNumber") transferNumber: string,
  ) {
    return this.transfersService.getTransfer(
      transferNumber,
      request.user,
    );
  }
}
