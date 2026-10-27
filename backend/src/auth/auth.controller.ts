import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { AuthService } from "./auth.service.js";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() body: unknown) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("A JSON object is required.");
    }

    const credentials = body as Record<string, unknown>;
    return this.authService.login(
      credentials.username,
      credentials.password,
    );
  }
}