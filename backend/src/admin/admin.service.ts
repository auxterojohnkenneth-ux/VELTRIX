import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import bcrypt from "bcrypt";
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
const warehouseStaffFields = [
  "firstName",
  "lastName",
  "username",
  "email",
  "password",
  "warehouseId",
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

  getWarehouseStaff() {
    return this.prisma.user.findMany({
      where: {
        role: { name: "WAREHOUSE_STAFF" },
      },
      select: this.warehouseStaffSelect(),
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
    });
  }

  async createWarehouseStaff(input: unknown) {
    assertObjectPayload(input);
    rejectUnknownFields(input, warehouseStaffFields);

    const firstName = requiredText(input, "firstName", false)!;
    const lastName = requiredText(input, "lastName", false)!;
    const username = requiredText(input, "username", false)!;
    const email = requiredText(input, "email", false)!.toLowerCase();
    const password = input.password;
    const warehouseId = positiveInteger(input, "warehouseId", false)!;

    if (typeof password !== "string" || password.length === 0) {
      throw new BadRequestException("password is required.");
    }
    if (firstName.length > 100 || lastName.length > 100) {
      throw new BadRequestException("Names must be 100 characters or fewer.");
    }
    if (
      username.length > 64 ||
      username.split("").some(
        (character) =>
          character.trim().length === 0 ||
          character.charCodeAt(0) < 32 ||
          character.charCodeAt(0) === 127,
      )
    ) {
      throw new BadRequestException(
        "username must be at most 64 characters and contain no whitespace.",
      );
    }
    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new BadRequestException("A valid email address is required.");
    }
    if (
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      throw new BadRequestException(
        "password must be at least 12 characters and no more than 72 UTF-8 bytes.",
      );
    }

    const [role, warehouse] = await Promise.all([
      this.prisma.role.findUnique({
        where: { name: "WAREHOUSE_STAFF" },
        select: { id: true },
      }),
      this.getEligibleWarehouse(warehouseId),
    ]);

    if (!role) {
      throw new NotFoundException("The WAREHOUSE_STAFF role is not configured.");
    }
    if (!warehouse) {
      throw new BadRequestException(
        "The selected warehouse does not exist or is inactive.",
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    try {
      return await this.prisma.user.create({
        data: {
          roleId: role.id,
          warehouseId,
          username,
          email,
          passwordHash,
          firstName,
          lastName,
        },
        select: this.warehouseStaffSelect(),
      });
    } catch (error) {
      this.handleStaffWriteError(error);
    }
  }

  async assignWarehouseStaff(id: number, input: unknown) {
    this.assertId(id);
    assertObjectPayload(input);
    rejectUnknownFields(input, ["warehouseId"]);
    const warehouseId = positiveInteger(input, "warehouseId", false)!;
    const warehouse = await this.getEligibleWarehouse(warehouseId);
    if (!warehouse) {
      throw new BadRequestException(
        "The selected warehouse does not exist or is inactive.",
      );
    }
    await this.assertWarehouseStaffExists(id);

    try {
      return await this.prisma.user.update({
        where: { id },
        data: { warehouseId },
        select: this.warehouseStaffSelect(),
      });
    } catch (error) {
      this.handleStaffWriteError(error);
    }
  }

  async updateWarehouseStaffStatus(id: number, input: unknown) {
    this.assertId(id);
    assertObjectPayload(input);
    rejectUnknownFields(input, ["isActive"]);
    if (typeof input.isActive !== "boolean") {
      throw new BadRequestException("isActive must be a boolean.");
    }
    await this.assertWarehouseStaffExists(id);

    try {
      return await this.prisma.user.update({
        where: { id },
        data: { isActive: input.isActive },
        select: this.warehouseStaffSelect(),
      });
    } catch (error) {
      this.handleStaffWriteError(error);
    }
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

  private getEligibleWarehouse(warehouseId: number) {
    return this.prisma.warehouse.findFirst({
      where: { id: warehouseId, status: "ACTIVE" },
      select: { id: true },
    });
  }

  private async assertWarehouseStaffExists(id: number) {
    const staff = await this.prisma.user.findFirst({
      where: { id, role: { name: "WAREHOUSE_STAFF" } },
      select: { id: true },
    });
    if (!staff) {
      throw new NotFoundException("Warehouse staff account was not found.");
    }
  }

  private warehouseStaffSelect() {
    return {
      id: true,
      firstName: true,
      lastName: true,
      username: true,
      email: true,
      isActive: true,
      warehouse: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    };
  }

  private handleStaffWriteError(error: unknown): never {
    if (isPrismaError(error)) {
      if (error.code === "P2002") {
        const target = "meta" in error && typeof error.meta === "object" &&
          error.meta !== null && "target" in error.meta
          ? error.meta.target
          : undefined;
        const fields = Array.isArray(target)
          ? target
              .filter((field): field is string => typeof field === "string")
              .join(",")
          : typeof target === "string"
            ? target
            : "";
        if (fields.includes("username")) {
          throw new ConflictException("A user with this username already exists.");
        }
        if (fields.includes("email")) {
          throw new ConflictException("A user with this email address already exists.");
        }
        throw new ConflictException("A user with this username or email already exists.");
      }
      if (error.code === "P2025") {
        throw new NotFoundException("Warehouse staff account was not found.");
      }
      if (error.code === "P2003") {
        throw new BadRequestException("The selected warehouse is not available.");
      }
    }
    throw error;
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
