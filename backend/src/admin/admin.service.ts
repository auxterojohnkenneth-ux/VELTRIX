import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";

type ItemPayload = {
  categoryId?: number;
  sku?: string;
  name?: string;
  description?: string | null;
  unitOfMeasure?: string;
  weight?: number | null;
  reorderLevel?: number;
  isActive?: boolean;
};

type WarehousePayload = {
  code?: string;
  name?: string;
  addressLine?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  contactNumber?: string;
  status?: "ACTIVE" | "INACTIVE";
};

const itemFields = [
  "categoryId",
  "sku",
  "name",
  "description",
  "unitOfMeasure",
  "weight",
  "reorderLevel",
  "isActive",
];
const postgresIntegerMax = 2_147_483_647;
const warehouseFields = [
  "code",
  "name",
  "addressLine",
  "city",
  "province",
  "postalCode",
  "contactNumber",
  "status",
];

function assertObjectPayload(value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException("A JSON object is required.");
  }
}

function rejectUnknownFields(
  payload: Record<string, unknown>,
  allowedFields: string[],
) {
  const unknownField = Object.keys(payload).find(
    (field) => !allowedFields.includes(field),
  );

  if (unknownField) {
    throw new BadRequestException(`Unknown field: ${unknownField}`);
  }
}

function requiredText(
  payload: Record<string, unknown>,
  field: string,
  partial: boolean,
) {
  if (partial && !(field in payload)) {
    return undefined;
  }

  const value = payload[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestException(`${field} is required.`);
  }

  return value.trim();
}

function optionalText(
  payload: Record<string, unknown>,
  field: string,
): string | null | undefined {
  if (!(field in payload)) {
    return undefined;
  }

  const value = payload[field];
  if (value === null) {
    return null;
  }
  if (typeof value !== "string") {
    throw new BadRequestException(`${field} must be text or null.`);
  }

  return value.trim() || null;
}

function positiveInteger(
  payload: Record<string, unknown>,
  field: string,
  partial: boolean,
) {
  if (partial && !(field in payload)) {
    return undefined;
  }

  const value = payload[field];
  if (
    !Number.isSafeInteger(value) ||
    Number(value) <= 0 ||
    Number(value) > postgresIntegerMax
  ) {
    throw new BadRequestException(`${field} must be a positive integer.`);
  }

  return Number(value);
}

function nonNegativeInteger(
  payload: Record<string, unknown>,
  field: string,
  partial: boolean,
) {
  if (!(field in payload)) {
    return partial ? undefined : 0;
  }

  const value = payload[field];
  if (
    !Number.isSafeInteger(value) ||
    Number(value) < 0 ||
    Number(value) > postgresIntegerMax
  ) {
    throw new BadRequestException(`${field} must be a non-negative integer.`);
  }

  return Number(value);
}

function optionalWeight(
  payload: Record<string, unknown>,
): number | null | undefined {
  if (!("weight" in payload)) {
    return undefined;
  }

  const value = payload.weight;
  if (value === null || value === "") {
    return null;
  }
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0
  ) {
    throw new BadRequestException("weight must be a non-negative number or null.");
  }

  return value;
}

function isPrismaError(
  error: unknown,
): error is { code: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  );
}

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
        addressLine: true,
        city: true,
        province: true,
        postalCode: true,
        contactNumber: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true,
            warehouseStock: true,
            sourceShipments: true,
            destinationShipments: true,
            sourceTransfers: true,
            destinationTransfers: true,
          },
        },
      },
      orderBy: {
        code: "asc",
      },
    });
  }

  getItems() {
    return this.prisma.item.findMany({
      select: {
        id: true,
        categoryId: true,
        sku: true,
        name: true,
        description: true,
        unitOfMeasure: true,
        weight: true,
        reorderLevel: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            warehouseStock: true,
            shipmentItems: true,
            stockTransferItems: true,
          },
        },
      },
      orderBy: { sku: "asc" },
    });
  }

  getCategories() {
    return this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    });
  }

  async createItem(input: unknown) {
    const data = this.validateItemPayload(input, false);
    await this.assertCategoryExists(data.categoryId!);

    try {
      return await this.prisma.item.create({
        data: {
          categoryId: data.categoryId!,
          sku: data.sku!,
          name: data.name!,
          unitOfMeasure: data.unitOfMeasure!,
          description: data.description ?? null,
          weight: data.weight ?? null,
          reorderLevel: data.reorderLevel ?? 0,
          isActive: data.isActive ?? true,
        },
        select: this.itemDetailSelect(),
      });
    } catch (error) {
      this.handleWriteError(error, "item");
    }
  }

  async updateItem(id: number, input: unknown) {
    this.assertId(id);
    const data = this.validateItemPayload(input, true);
    if (Object.keys(data).length === 0) {
      throw new BadRequestException("At least one item field is required.");
    }
    if (data.categoryId !== undefined) {
      await this.assertCategoryExists(data.categoryId);
    }

    try {
      return await this.prisma.item.update({
        where: { id },
        data,
        select: this.itemDetailSelect(),
      });
    } catch (error) {
      this.handleWriteError(error, "item");
    }
  }

  async createWarehouse(input: unknown) {
    const data = this.validateWarehousePayload(input, false);

    try {
      return await this.prisma.warehouse.create({
        data: {
          code: data.code!,
          name: data.name!,
          addressLine: data.addressLine!,
          city: data.city!,
          province: data.province!,
          postalCode: data.postalCode!,
          contactNumber: data.contactNumber!,
          status: data.status ?? "ACTIVE",
        },
        select: this.warehouseDetailSelect(),
      });
    } catch (error) {
      this.handleWriteError(error, "warehouse");
    }
  }

  async updateWarehouse(id: number, input: unknown) {
    this.assertId(id);
    const data = this.validateWarehousePayload(input, true);
    if (Object.keys(data).length === 0) {
      throw new BadRequestException("At least one warehouse field is required.");
    }

    try {
      return await this.prisma.warehouse.update({
        where: { id },
        data,
        select: this.warehouseDetailSelect(),
      });
    } catch (error) {
      this.handleWriteError(error, "warehouse");
    }
  }

  private validateItemPayload(
    input: unknown,
    partial: boolean,
  ): ItemPayload {
    assertObjectPayload(input);
    rejectUnknownFields(input, itemFields);

    const data: ItemPayload = {
      categoryId: positiveInteger(input, "categoryId", partial),
      sku: requiredText(input, "sku", partial),
      name: requiredText(input, "name", partial),
      unitOfMeasure: requiredText(input, "unitOfMeasure", partial),
      description: optionalText(input, "description"),
      weight: optionalWeight(input),
      reorderLevel: nonNegativeInteger(input, "reorderLevel", partial),
    };

    if ("isActive" in input) {
      if (typeof input.isActive !== "boolean") {
        throw new BadRequestException("isActive must be a boolean.");
      }
      data.isActive = input.isActive;
    } else if (!partial) {
      data.isActive = true;
    }

    return Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    ) as ItemPayload;
  }

  private validateWarehousePayload(
    input: unknown,
    partial: boolean,
  ): WarehousePayload {
    assertObjectPayload(input);
    rejectUnknownFields(input, warehouseFields);

    const data: WarehousePayload = {
      code: requiredText(input, "code", partial),
      name: requiredText(input, "name", partial),
      addressLine: requiredText(input, "addressLine", partial),
      city: requiredText(input, "city", partial),
      province: requiredText(input, "province", partial),
      postalCode: requiredText(input, "postalCode", partial),
      contactNumber: requiredText(input, "contactNumber", partial),
    };

    if ("status" in input) {
      if (input.status !== "ACTIVE" && input.status !== "INACTIVE") {
        throw new BadRequestException("status must be ACTIVE or INACTIVE.");
      }
      data.status = input.status;
    } else if (!partial) {
      data.status = "ACTIVE";
    }

    return Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    ) as WarehousePayload;
  }

  private async assertCategoryExists(categoryId: number) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new BadRequestException("The selected category does not exist.");
    }
  }

  private assertId(id: number) {
    if (
      !Number.isSafeInteger(id) ||
      id <= 0 ||
      id > postgresIntegerMax
    ) {
      throw new BadRequestException("The record id must be a positive integer.");
    }
  }

  private handleWriteError(error: unknown, recordType: "item" | "warehouse"): never {
    if (isPrismaError(error)) {
      if (error.code === "P2002") {
        throw new ConflictException(
          recordType === "item"
            ? "An item with this SKU already exists."
            : "A warehouse with this code already exists.",
        );
      }
      if (error.code === "P2025") {
        throw new NotFoundException(`${recordType} was not found.`);
      }
      if (error.code === "P2003") {
        throw new BadRequestException(
          recordType === "item"
            ? "The selected category is not available."
            : "The requested change conflicts with existing records.",
        );
      }
    }

    throw error;
  }

  private itemDetailSelect() {
    return {
      id: true,
      categoryId: true,
      sku: true,
      name: true,
      description: true,
      unitOfMeasure: true,
      weight: true,
      reorderLevel: true,
      isActive: true,
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      _count: {
        select: {
          warehouseStock: true,
          shipmentItems: true,
          stockTransferItems: true,
        },
      },
    };
  }

  private warehouseDetailSelect() {
    return {
      id: true,
      code: true,
      name: true,
      addressLine: true,
      city: true,
      province: true,
      postalCode: true,
      contactNumber: true,
      status: true,
      _count: {
        select: {
          users: true,
          warehouseStock: true,
          sourceShipments: true,
          destinationShipments: true,
          sourceTransfers: true,
          destinationTransfers: true,
        },
      },
    };
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
