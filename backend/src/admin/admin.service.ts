import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getDashboard() {
    const [
      totalUsers,
      totalWarehouses,
      totalItems,
      totalShipments,
      pendingShipments,
      dispatchedShipments,
      receivedShipments,
      totalTransfers,
      completedTransfers,
      auditLogEntries,
      stockAggregate,
      stockRows,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.warehouse.count(),
      this.prisma.item.count(),
      this.prisma.shipment.count(),
      this.prisma.shipment.count({
        where: { status: "PENDING" },
      }),
      this.prisma.shipment.count({
        where: { status: "DISPATCHED" },
      }),
      this.prisma.shipment.count({
        where: { status: "RECEIVED" },
      }),
      this.prisma.stockTransfer.count(),
      this.prisma.stockTransfer.count({
        where: { status: "COMPLETED" },
      }),
      this.prisma.auditLog.count(),
      this.prisma.warehouseStock.aggregate({
        _sum: { quantityOnHand: true },
      }),
      this.prisma.warehouseStock.findMany({
        select: {
          quantityOnHand: true,
          reorderLevel: true,
        },
      }),
    ]);

    return {
      totalUsers,
      totalWarehouses,
      totalItems,
      totalStock: stockAggregate._sum.quantityOnHand ?? 0,
      lowStockRecords: stockRows.filter(
        (row) => row.quantityOnHand <= row.reorderLevel,
      ).length,
      totalShipments,
      pendingShipments,
      dispatchedShipments,
      receivedShipments,
      totalTransfers,
      completedTransfers,
      auditLogEntries,
    };
  }

  getWarehouses() {
    return this.prisma.warehouse.findMany({
      select: {
        id: true,
        code: true,
        name: true,
        city: true,
        province: true,
        status: true,
        _count: {
          select: {
            users: true,
            warehouseStock: true,
          },
        },
      },
      orderBy: {
        code: "asc",
      },
    });
  }

  getRoles() {
    return this.prisma.role.findMany({
      select: {
        id: true,
        name: true,
        description: true,
      },
      orderBy: {
        id: "asc",
      },
    });
  }

  getAuditLogs() {
    return this.prisma.auditLog.findMany({
      select: {
        id: true,
        userId: true,
        action: true,
        tableName: true,
        recordIdentifier: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 20,
    });
  }
}
