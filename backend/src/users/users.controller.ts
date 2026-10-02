import {
  Controller,
  Get,
  Req,
  UseGuards,
} from "@nestjs/common";
import { Request } from "express";
import { UsersService } from "./users.service.js";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { Roles } from "../auth/roles.decorator.js";

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    username: string;
    role: string;
    warehouseId: number | null;
  };
}

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
  ) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    "SYSTEM_ADMIN",
    "WAREHOUSE_STAFF",
  )
  @Get()
  getUsers(
    @Req() request: AuthenticatedRequest,
  ) {
    return this.usersService.getUsers(
      request.user,
    );
  }
}