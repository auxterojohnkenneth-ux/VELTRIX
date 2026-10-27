import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { PrismaService } from "../prisma/prisma.service.js";
import {
  ExtractJwt,
  Strategy,
} from "passport-jwt";

@Injectable()
export class JwtStrategy extends PassportStrategy(
  Strategy,
) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest:
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        configService.getOrThrow<string>(
          "JWT_SECRET",
        ),
    });
  }

  async validate(payload: {
    sub?: unknown;
  }) {
    if (
      typeof payload.sub !== "number" ||
      !Number.isSafeInteger(payload.sub) ||
      payload.sub <= 0
    ) {
      throw new UnauthorizedException();
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        username: true,
        isActive: true,
        warehouseId: true,
        role: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }

    return {
      userId: user.id,
      username: user.username,
      role: user.role.name,
      warehouseId: user.warehouseId,
    };
  }
}