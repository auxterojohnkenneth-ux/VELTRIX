import {
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getUsers(currentUser: {
    userId: number;
    role: string;
    warehouseId: number | null;
  }) {
    // SYSTEM_ADMIN can see all users.
    if (currentUser.role === "SYSTEM_ADMIN") {
      return this.prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          role: {
            select: {
              id: true,
              name: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: {
          id: "asc",
        },
      });
    }

    // Warehouse staff must have an assigned warehouse.
    if (
      currentUser.role === "WAREHOUSE_STAFF"
    ) {
      if (currentUser.warehouseId === null) {
        throw new ForbiddenException(
          "Warehouse staff must be assigned to a warehouse",
        );
      }

      return this.prisma.user.findMany({
        where: {
          warehouseId: currentUser.warehouseId,
        },
        select: {
          id: true,
          username: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          role: {
            select: {
              id: true,
              name: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
        orderBy: {
          id: "asc",
        },
      });
    }

    // Other roles are not allowed to access this endpoint.
    throw new ForbiddenException(
      "You do not have permission to access users",
    );
  }
}