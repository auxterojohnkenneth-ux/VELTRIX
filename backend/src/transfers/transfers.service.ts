import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

export interface AuthenticatedUser {
  userId: number;
  username: string;
  role: string;
  warehouseId: number | null;
}

export interface CreateTransferItemInput {
  itemId: number;
  quantity: number;
}

export interface CreateTransferInput {
  transferNumber: string;
  sourceWarehouseId: number;
  destinationWarehouseId: number;
  items: CreateTransferItemInput[];
}

export interface ProcessTransferResult {
  transfer_id: number;
  transfer_number: string;
  status: string;
}

@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async createTransfer(
    data: CreateTransferInput,
    currentUser: AuthenticatedUser,
  ) {
    if (
      currentUser.role !== "SYSTEM_ADMIN" &&
      currentUser.role !== "WAREHOUSE_STAFF"
    ) {
      throw new ForbiddenException(
        "You do not have permission to create stock transfers",
      );
    }

    if (!data || typeof data !== "object") {
      throw new BadRequestException(
        "A transfer request body is required",
      );
    }

    if (
      typeof data.transferNumber !== "string" ||
      !data.transferNumber.trim()
    ) {
      throw new BadRequestException(
        "Transfer number is required",
      );
    }

    if (
      !Number.isInteger(data.sourceWarehouseId) ||
      data.sourceWarehouseId <= 0
    ) {
      throw new BadRequestException(
        "sourceWarehouseId must be a positive integer",
      );
    }

    if (
      !Number.isInteger(data.destinationWarehouseId) ||
      data.destinationWarehouseId <= 0
    ) {
      throw new BadRequestException(
        "destinationWarehouseId must be a positive integer",
      );
    }

    if (
      data.sourceWarehouseId ===
      data.destinationWarehouseId
    ) {
      throw new BadRequestException(
        "Source and destination warehouses must be different",
      );
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestException(
        "At least one transfer item is required",
      );
    }

    for (const item of data.items) {
      if (
        !item ||
        !Number.isInteger(item.itemId) ||
        item.itemId <= 0
      ) {
        throw new BadRequestException(
          "Each itemId must be a positive integer",
        );
      }

      if (
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        throw new BadRequestException(
          "Each quantity must be a positive integer",
        );
      }
    }

    const itemIds = data.items.map((item) => item.itemId);

    if (new Set(itemIds).size !== itemIds.length) {
      throw new BadRequestException(
        "Each item may only appear once in a transfer",
      );
    }

    if (currentUser.role === "WAREHOUSE_STAFF") {
      if (currentUser.warehouseId === null) {
        throw new ForbiddenException(
          "Warehouse staff must be assigned to a warehouse",
        );
      }

      if (
        data.sourceWarehouseId !== currentUser.warehouseId
      ) {
        throw new ForbiddenException(
          "You can only transfer stock from your assigned warehouse",
        );
      }
    }

    const warehouseIds = await this.prisma.warehouse.findMany({
      where: {
        id: {
          in: [
            data.sourceWarehouseId,
            data.destinationWarehouseId,
          ],
        },
      },
      select: {
        id: true,
      },
    });
    const existingWarehouseIds = new Set(
      warehouseIds.map((warehouse) => warehouse.id),
    );

    if (!existingWarehouseIds.has(data.sourceWarehouseId)) {
      throw new BadRequestException(
        `Source warehouse ${data.sourceWarehouseId} does not exist`,
      );
    }

    if (
      !existingWarehouseIds.has(data.destinationWarehouseId)
    ) {
      throw new BadRequestException(
        `Destination warehouse ${data.destinationWarehouseId} does not exist`,
      );
    }

    const existingItems = await this.prisma.item.findMany({
      where: {
        id: {
          in: itemIds,
        },
      },
      select: {
        id: true,
      },
    });
    const existingItemIds = new Set(
      existingItems.map((item) => item.id),
    );
    const missingItemId = itemIds.find(
      (itemId) => !existingItemIds.has(itemId),
    );

    if (missingItemId !== undefined) {
      throw new BadRequestException(
        `Item ${missingItemId} does not exist`,
      );
    }

    const transferNumber = data.transferNumber.trim();
    let result: ProcessTransferResult[];

    try {
      result = await this.prisma.$queryRaw<
        ProcessTransferResult[]
      >`
        SELECT *
        FROM process_stock_transfer(
          ${transferNumber},
          ${data.sourceWarehouseId},
          ${data.destinationWarehouseId},
          ${currentUser.userId},
          ${JSON.stringify(data.items)}::jsonb
        )
      `;
    } catch (error) {
      const databaseErrorCodes =
        this.getDatabaseErrorCodes(error);

      if (
        databaseErrorCodes.includes("23505") ||
        databaseErrorCodes.includes("P2002")
      ) {
        throw new ConflictException(
          `Transfer ${transferNumber} already exists`,
        );
      }

      if (
        databaseErrorCodes.includes("23503") ||
        databaseErrorCodes.includes("P2003")
      ) {
        throw new BadRequestException(
          "The transfer references a warehouse, user, or item that does not exist",
        );
      }

      const businessRuleMessage =
        this.getTransferBusinessRuleMessage(error);

      if (businessRuleMessage) {
        throw new BadRequestException(businessRuleMessage);
      }

      this.logger.error(
        "Failed to process stock transfer",
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException(
        "Unable to process stock transfer",
      );
    }

    if (!result[0]) {
      this.logger.error(
        "Stock transfer function returned no result",
      );
      throw new InternalServerErrorException(
        "Unable to process stock transfer",
      );
    }

    return result[0];
  }

  async getTransfers(currentUser: AuthenticatedUser) {
    const where = this.getTransferScope(currentUser);

    return this.prisma.stockTransfer.findMany({
      where,
      include: this.transferRelations,
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getWarehouses(currentUser: AuthenticatedUser) {
    if (
      currentUser.role === "WAREHOUSE_STAFF" &&
      currentUser.warehouseId === null
    ) {
      throw new ForbiddenException(
        "Warehouse staff must be assigned to a warehouse",
      );
    }

    if (
      currentUser.role !== "SYSTEM_ADMIN" &&
      currentUser.role !== "WAREHOUSE_STAFF" &&
      currentUser.role !== "LOGISTICS_MANAGER"
    ) {
      throw new ForbiddenException(
        "You do not have permission to view warehouses",
      );
    }

    return this.prisma.warehouse.findMany({
      where: {
        status: "ACTIVE",
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: {
        code: "asc",
      },
    });
  }

  async getTransfer(
    transferNumber: string,
    currentUser: AuthenticatedUser,
  ) {
    if (!transferNumber?.trim()) {
      throw new BadRequestException(
        "Transfer number is required",
      );
    }

    const transfer = await this.prisma.stockTransfer.findFirst({
      where: {
        transferNumber: transferNumber.trim(),
        ...this.getTransferScope(currentUser),
      },
      include: this.transferRelations,
    });

    if (!transfer) {
      throw new NotFoundException(
        `Transfer ${transferNumber} does not exist`,
      );
    }

    return transfer;
  }

  private getTransferScope(currentUser: AuthenticatedUser) {
    if (
      currentUser.role === "SYSTEM_ADMIN" ||
      currentUser.role === "LOGISTICS_MANAGER"
    ) {
      return {};
    }

    if (currentUser.role === "WAREHOUSE_STAFF") {
      if (currentUser.warehouseId === null) {
        throw new ForbiddenException(
          "Warehouse staff must be assigned to a warehouse",
        );
      }

      return {
        OR: [
          {
            sourceWarehouseId: currentUser.warehouseId,
          },
          {
            destinationWarehouseId:
              currentUser.warehouseId,
          },
        ],
      };
    }

    throw new ForbiddenException(
      "You do not have permission to view stock transfers",
    );
  }

  private get transferRelations() {
    return {
      sourceWarehouse: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      destinationWarehouse: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      requester: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
      approver: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
        },
      },
      items: {
        include: {
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
              unitOfMeasure: true,
            },
          },
        },
      },
    };
  }

  private getDatabaseErrorCodes(error: unknown) {
    if (!error || typeof error !== "object") {
      return [];
    }

    const codes: string[] = [];

    if ("code" in error && typeof error.code === "string") {
      codes.push(error.code);
    }

    if ("meta" in error && error.meta && typeof error.meta === "object") {
      const meta = error.meta;

      if ("code" in meta && typeof meta.code === "string") {
        codes.push(meta.code);
      }
    }

    return codes;
  }

  private getTransferBusinessRuleMessage(error: unknown) {
    const errorMessages: string[] = [];

    if (error && typeof error === "object") {
      if ("meta" in error && error.meta && typeof error.meta === "object") {
        const meta = error.meta;

        if ("message" in meta && typeof meta.message === "string") {
          errorMessages.push(meta.message);
        }
      }

      if ("message" in error && typeof error.message === "string") {
        errorMessages.push(error.message);
      }
    }

    const knownMessages = [
      /Insufficient stock for item \d+\. Available: \d+, requested: \d+/,
      /Item \d+ does not exist in source warehouse \d+/,
      /Source and destination warehouses must be different/,
      /At least one transfer item is required/,
      /Each transfer item must contain itemId and quantity/,
      /Transfer quantity must be greater than zero/,
    ];

    for (const errorMessage of errorMessages) {
      for (const knownMessage of knownMessages) {
        const match = errorMessage.match(knownMessage);

        if (match) {
          return match[0];
        }
      }
    }

    return undefined;
  }
}
