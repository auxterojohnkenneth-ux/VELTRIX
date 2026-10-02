import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

export interface CreateShipmentItemInput {
  itemId: number;
  quantity: number;
  unitWeight: number;
}

export interface CreateShipmentInput {
  shipmentNumber: string;
  supplierId?: number;
  sourceWarehouseId?: number;
  destinationWarehouseId?: number;
  driverId?: number;
  vehicleId?: number;
  routeId?: number;
  shipmentType: string;
  scheduledAt?: string;
  items: CreateShipmentItemInput[];
}

interface CurrentUser {
  userId: number;
  role: string;
  warehouseId: number | null;
}

@Injectable()
export class ShipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createShipment(
    data: CreateShipmentInput,
    currentUser: CurrentUser,
  ) {
    if (!data.shipmentNumber?.trim()) {
      throw new BadRequestException("Shipment number is required");
    }

    if (!data.shipmentType?.trim()) {
      throw new BadRequestException("Shipment type is required");
    }

    if (!Number.isInteger(currentUser.userId) || currentUser.userId <= 0) {
      throw new BadRequestException("Authenticated user is invalid");
    }

    if (!Array.isArray(data.items) || data.items.length === 0) {
      throw new BadRequestException(
        "At least one shipment item is required",
      );
    }

    /*
     * WAREHOUSE_STAFF can only create shipments
     * involving their assigned warehouse.
     */
    if (currentUser.role === "WAREHOUSE_STAFF") {
      if (currentUser.warehouseId === null) {
        throw new ForbiddenException(
          "Warehouse staff must be assigned to a warehouse",
        );
      }

      const warehouseId = currentUser.warehouseId;

      const isSourceWarehouse =
        data.sourceWarehouseId === warehouseId;

      const isDestinationWarehouse =
        data.destinationWarehouseId === warehouseId;

      if (!isSourceWarehouse && !isDestinationWarehouse) {
        throw new ForbiddenException(
          "You can only create shipments involving your assigned warehouse",
        );
      }
    }

    for (const item of data.items) {
      if (!Number.isInteger(item.itemId) || item.itemId <= 0) {
        throw new BadRequestException(
          "Each itemId must be a valid integer",
        );
      }

      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException(
          "Each shipment quantity must be greater than zero",
        );
      }

      if (
        typeof item.unitWeight !== "number" ||
        !Number.isFinite(item.unitWeight) ||
        item.unitWeight <= 0
      ) {
        throw new BadRequestException(
          "Each unitWeight must be a valid number greater than zero",
        );
      }
    }

    if (data.scheduledAt) {
      const scheduledDate = new Date(data.scheduledAt);

      if (Number.isNaN(scheduledDate.getTime())) {
        throw new BadRequestException(
          "scheduledAt must be a valid date",
        );
      }
    }

    const existingShipment = await this.prisma.shipment.findUnique({
      where: {
        shipmentNumber: data.shipmentNumber.trim(),
      },
    });

    if (existingShipment) {
      throw new BadRequestException(
        `Shipment ${data.shipmentNumber} already exists`,
      );
    }

    const createdShipment = await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.create({
        data: {
          shipmentNumber: data.shipmentNumber.trim(),
          supplierId: data.supplierId,
          sourceWarehouseId: data.sourceWarehouseId,
          destinationWarehouseId: data.destinationWarehouseId,
          driverId: data.driverId,
          vehicleId: data.vehicleId,
          routeId: data.routeId,
          shipmentType: data.shipmentType.trim(),
          scheduledAt: data.scheduledAt
            ? new Date(data.scheduledAt)
            : undefined,

          createdBy: currentUser.userId,

          shipmentItems: {
            create: data.items.map((item) => ({
              itemId: item.itemId,
              quantity: item.quantity,
              unitWeight: item.unitWeight,
            })),
          },
        },
        include: {
          shipmentItems: true,
        },
      });

      return shipment;
    });

    return createdShipment;
  }

  async getShipments(currentUser: CurrentUser) {
    let where = {};

    if (
      currentUser.role !== "SYSTEM_ADMIN" &&
      currentUser.role !== "WAREHOUSE_STAFF" &&
      currentUser.role !== "LOGISTICS_MANAGER"
    ) {
      throw new ForbiddenException(
        "You do not have permission to view shipments",
      );
    }

    if (currentUser.role === "WAREHOUSE_STAFF") {
      if (currentUser.warehouseId === null) {
        throw new ForbiddenException(
          "Warehouse staff must be assigned to a warehouse",
        );
      }

      where = {
        OR: [
          {
            sourceWarehouseId: currentUser.warehouseId,
          },
          {
            destinationWarehouseId: currentUser.warehouseId,
          },
        ],
      };
    }

    return this.prisma.shipment.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            supplierCode: true,
            companyName: true,
          },
        },
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
        shipmentItems: {
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
      },
      orderBy: {
        id: "desc",
      },
    });
  }

  async receiveShipment(
    shipmentNumber: string,
    currentUser: CurrentUser,
  ) {
    if (!shipmentNumber?.trim()) {
      throw new BadRequestException(
        "Shipment number is required",
      );
    }

    /*
     * Check shipment destination before calling
     * the database transaction function.
     */
    const shipment = await this.prisma.shipment.findUnique({
      where: {
        shipmentNumber: shipmentNumber.trim(),
      },
      select: {
        destinationWarehouseId: true,
      },
    });

    if (!shipment) {
      throw new BadRequestException(
        `Shipment ${shipmentNumber} does not exist`,
      );
    }

    /*
     * Warehouse staff can only receive shipments
     * going to their assigned warehouse.
     */
    if (currentUser.role === "WAREHOUSE_STAFF") {
      if (currentUser.warehouseId === null) {
        throw new ForbiddenException(
          "Warehouse staff must be assigned to a warehouse",
        );
      }

      if (
        shipment.destinationWarehouseId !==
        currentUser.warehouseId
      ) {
        throw new ForbiddenException(
          "You can only receive shipments for your assigned warehouse",
        );
      }
    }

    const result = await this.prisma.$queryRaw<
      {
        shipment_id: number;
        shipment_number: string;
        status: string;
      }[]
    >`
      SELECT *
      FROM receive_shipment(${shipmentNumber.trim()})
    `;

    return result[0];
  }

  async dispatchShipment(
    shipmentNumber: string,
    currentUser: CurrentUser,
  ) {
    if (!shipmentNumber?.trim()) {
      throw new BadRequestException(
        "Shipment number is required",
      );
    }

    /*
     * Check shipment source before calling
     * the database transaction function.
     */
    const shipment = await this.prisma.shipment.findUnique({
      where: {
        shipmentNumber: shipmentNumber.trim(),
      },
      select: {
        sourceWarehouseId: true,
      },
    });

    if (!shipment) {
      throw new BadRequestException(
        `Shipment ${shipmentNumber} does not exist`,
      );
    }

    /*
     * Warehouse staff can only dispatch shipments
     * from their assigned warehouse.
     */
    if (currentUser.role === "WAREHOUSE_STAFF") {
      if (currentUser.warehouseId === null) {
        throw new ForbiddenException(
          "Warehouse staff must be assigned to a warehouse",
        );
      }

      if (
        shipment.sourceWarehouseId !==
        currentUser.warehouseId
      ) {
        throw new ForbiddenException(
          "You can only dispatch shipments from your assigned warehouse",
        );
      }
    }

    const result = await this.prisma.$queryRaw<
      {
        shipment_id: number;
        shipment_number: string;
        status: string;
      }[]
    >`
      SELECT *
      FROM dispatch_shipment(${shipmentNumber.trim()})
    `;

    return result[0];
  }
}