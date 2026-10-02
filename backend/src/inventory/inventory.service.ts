import {
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

interface CurrentUser {
  userId: number;
  username: string;
  role: string;
  warehouseId: number | null;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getWarehouseStock(
    currentUser: CurrentUser,
  ) {
    // =====================================================
    // SYSTEM ADMIN
    // Can see stock from every warehouse.
    // =====================================================

    if (currentUser.role === "SYSTEM_ADMIN") {
      return this.prisma.warehouseStock.findMany({
        include: {
          warehouse: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
              unitOfMeasure: true,
              reorderLevel: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [
          {
            warehouseId: "asc",
          },
          {
            itemId: "asc",
          },
        ],
      });
    }

    // =====================================================
    // WAREHOUSE STAFF
    // Can ONLY see stock from their assigned warehouse.
    // =====================================================

    if (currentUser.role === "WAREHOUSE_STAFF") {
      if (currentUser.warehouseId === null) {
        throw new ForbiddenException(
          "Warehouse staff must be assigned to a warehouse",
        );
      }

      return this.prisma.warehouseStock.findMany({
        where: {
          warehouseId: currentUser.warehouseId,
        },
        include: {
          warehouse: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
          item: {
            select: {
              id: true,
              sku: true,
              name: true,
              unitOfMeasure: true,
              reorderLevel: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          itemId: "asc",
        },
      });
    }

    throw new ForbiddenException(
      "You do not have permission to access warehouse inventory",
    );
  }

  // =====================================================
  // WAREHOUSE DASHBOARD STATISTICS
  // =====================================================

  async getWarehouseDashboard(
    currentUser: CurrentUser,
  ) {
    // Warehouse staff must have an assigned warehouse.
    if (
      currentUser.role === "WAREHOUSE_STAFF" &&
      currentUser.warehouseId === null
    ) {
      throw new ForbiddenException(
        "Warehouse staff must be assigned to a warehouse",
      );
    }

    // Dashboard statistics are currently intended for
    // warehouse staff.
    if (currentUser.role !== "WAREHOUSE_STAFF") {
      throw new ForbiddenException(
        "You do not have permission to access the warehouse dashboard",
      );
    }

    const warehouseId = currentUser.warehouseId!;

    // -----------------------------------------------------
    // TOTAL STOCK
    // Sum all quantities in the assigned warehouse.
    // -----------------------------------------------------

    const stockResult =
      await this.prisma.warehouseStock.aggregate({
        where: {
          warehouseId,
        },
        _sum: {
          quantityOnHand: true,
        },
      });

    // -----------------------------------------------------
    // LOW STOCK
    // Count items whose stock is at or below reorder level.
    // -----------------------------------------------------

    const stockRows =
      await this.prisma.warehouseStock.findMany({
        where: {
          warehouseId,
        },
        select: {
          quantityOnHand: true,
          item: {
            select: {
              reorderLevel: true,
            },
          },
        },
      });

    const lowStockCount = stockRows.filter(
      (stock) =>
        stock.quantityOnHand <=
        stock.item.reorderLevel,
    ).length;

    // -----------------------------------------------------
    // INCOMING SHIPMENTS
    // Count pending shipments going to this warehouse.
    // -----------------------------------------------------

    const incomingShipments =
      await this.prisma.shipment.count({
        where: {
          destinationWarehouseId: warehouseId,
          status: "PENDING",
        },
      });

    // -----------------------------------------------------
    // ACTIVE TRANSFERS
    // Count pending/in-progress transfers involving
    // this warehouse.
    // -----------------------------------------------------

    const activeTransfers =
      await this.prisma.stockTransfer.count({
        where: {
          OR: [
            {
              sourceWarehouseId: warehouseId,
            },
            {
              destinationWarehouseId: warehouseId,
            },
          ],
          status: {
            in: [
              "PENDING",
              "IN_TRANSIT",
            ],
          },
        },
      });

    return {
      totalStock: stockResult._sum.quantityOnHand ?? 0,
      lowStock: lowStockCount,
      incomingShipments,
      activeTransfers,
    };
  }
}