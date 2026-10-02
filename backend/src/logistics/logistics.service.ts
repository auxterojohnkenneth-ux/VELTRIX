import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class LogisticsService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async getDashboard() {
    const [
      totalShipments,
      pendingShipments,
      dispatchedShipments,
      receivedShipments,
      activeDrivers,
      availableVehicles,
      activeRoutes,
    ] = await Promise.all([
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
      this.prisma.driver.count({
        where: { status: "ACTIVE" },
      }),
      this.prisma.vehicle.count({
        where: { status: "AVAILABLE" },
      }),
      this.prisma.route.count({
        where: { status: "ACTIVE" },
      }),
    ]);

    return {
      totalShipments,
      pendingShipments,
      dispatchedShipments,
      receivedShipments,
      activeDrivers,
      availableVehicles,
      activeRoutes,
    };
  }

  getShipments() {
    return this.prisma.shipment.findMany({
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
        driver: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            status: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            vehicleCode: true,
            plateNumber: true,
            vehicleType: true,
            status: true,
          },
        },
        route: {
          select: {
            id: true,
            routeCode: true,
            origin: true,
            destination: true,
            distanceKm: true,
            estimatedDurationMinutes: true,
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
        createdAt: "desc",
      },
    });
  }

  getDrivers() {
    return this.prisma.driver.findMany({
      select: {
        id: true,
        employeeCode: true,
        firstName: true,
        lastName: true,
        licenseExpiry: true,
        phone: true,
        status: true,
      },
      orderBy: {
        lastName: "asc",
      },
    });
  }

  getVehicles() {
    return this.prisma.vehicle.findMany({
      select: {
        id: true,
        vehicleCode: true,
        plateNumber: true,
        vehicleType: true,
        capacity: true,
        status: true,
      },
      orderBy: {
        vehicleCode: "asc",
      },
    });
  }

  getRoutes() {
    return this.prisma.route.findMany({
      select: {
        id: true,
        routeCode: true,
        origin: true,
        destination: true,
        distanceKm: true,
        estimatedDurationMinutes: true,
        status: true,
      },
      orderBy: {
        routeCode: "asc",
      },
    });
  }
}
