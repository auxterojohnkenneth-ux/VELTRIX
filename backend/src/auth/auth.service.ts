import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcrypt";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        "Invalid username or password",
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException(
        "Account is inactive",
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        "Invalid username or password",
      );
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role.name,
      warehouseId: user.warehouseId,
    };

    const accessToken =
      await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        warehouseId: user.warehouseId,
      },
    };
  }
}