import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding VELTRIX...");

  // =========================================================
  // 1. CREATE THE THREE SYSTEM ROLES
  // =========================================================

  const systemAdmin = await prisma.role.upsert({
    where: {
      name: "SYSTEM_ADMIN",
    },
    update: {
      description: "Full system administration access.",
    },
    create: {
      name: "SYSTEM_ADMIN",
      description: "Full system administration access.",
    },
  });

  const warehouseStaff = await prisma.role.upsert({
    where: {
      name: "WAREHOUSE_STAFF",
    },
    update: {
      description: "Warehouse inventory and receiving access.",
    },
    create: {
      name: "WAREHOUSE_STAFF",
      description: "Warehouse inventory and receiving access.",
    },
  });

  const logisticsManager = await prisma.role.upsert({
    where: {
      name: "LOGISTICS_MANAGER",
    },
    update: {
      description:
        "Shipment, route, driver, and vehicle management access.",
    },
    create: {
      name: "LOGISTICS_MANAGER",
      description:
        "Shipment, route, driver, and vehicle management access.",
    },
  });

  // =========================================================
  // 2. CREATE WAREHOUSES
  // =========================================================

  const mainWarehouse = await prisma.warehouse.upsert({
    where: {
      code: "WH-MAIN",
    },
    update: {
      name: "Veltrix Main Warehouse",
      addressLine: "Main Distribution Center",
      city: "Tagbilaran City",
      province: "Bohol",
      postalCode: "6300",
      contactNumber: "09171234567",
      status: "ACTIVE",
    },
    create: {
      code: "WH-MAIN",
      name: "Veltrix Main Warehouse",
      addressLine: "Main Distribution Center",
      city: "Tagbilaran City",
      province: "Bohol",
      postalCode: "6300",
      contactNumber: "09171234567",
      status: "ACTIVE",
    },
  });

  const secondaryWarehouse = await prisma.warehouse.upsert({
    where: {
      code: "WH-BOHOL-02",
    },
    update: {
      name: "Veltrix Bohol Distribution Warehouse",
      addressLine: "Secondary Distribution Center",
      city: "Tagbilaran City",
      province: "Bohol",
      postalCode: "6300",
      contactNumber: "09181234567",
      status: "ACTIVE",
    },
    create: {
      code: "WH-BOHOL-02",
      name: "Veltrix Bohol Distribution Warehouse",
      addressLine: "Secondary Distribution Center",
      city: "Tagbilaran City",
      province: "Bohol",
      postalCode: "6300",
      contactNumber: "09181234567",
      status: "ACTIVE",
    },
  });

  // =========================================================
  // 3. CREATE INVENTORY CATEGORIES
  // =========================================================

  const electronicsCategory = await prisma.category.upsert({
    where: {
      name: "Electronics",
    },
    update: {
      description: "Electronic devices and accessories.",
    },
    create: {
      name: "Electronics",
      description: "Electronic devices and accessories.",
    },
  });

  const packagingCategory = await prisma.category.upsert({
    where: {
      name: "Packaging",
    },
    update: {
      description: "Packaging and warehouse supplies.",
    },
    create: {
      name: "Packaging",
      description: "Packaging and warehouse supplies.",
    },
  });

  // =========================================================
  // 4. CREATE INVENTORY ITEMS
  // =========================================================

  const usbCable = await prisma.item.upsert({
    where: {
      sku: "ELEC-USB-001",
    },
    update: {
      name: "USB-C Cable",
      description: "Standard USB-C charging and data cable.",
      unitOfMeasure: "piece",
      reorderLevel: 20,
      categoryId: electronicsCategory.id,
      isActive: true,
    },
    create: {
      sku: "ELEC-USB-001",
      name: "USB-C Cable",
      description: "Standard USB-C charging and data cable.",
      unitOfMeasure: "piece",
      reorderLevel: 20,
      categoryId: electronicsCategory.id,
      isActive: true,
    },
  });

  const wirelessMouse = await prisma.item.upsert({
    where: {
      sku: "ELEC-MOU-001",
    },
    update: {
      name: "Wireless Mouse",
      description: "Standard wireless computer mouse.",
      unitOfMeasure: "piece",
      reorderLevel: 10,
      categoryId: electronicsCategory.id,
      isActive: true,
    },
    create: {
      sku: "ELEC-MOU-001",
      name: "Wireless Mouse",
      description: "Standard wireless computer mouse.",
      unitOfMeasure: "piece",
      reorderLevel: 10,
      categoryId: electronicsCategory.id,
      isActive: true,
    },
  });

  const keyboard = await prisma.item.upsert({
    where: {
      sku: "ELEC-KEY-001",
    },
    update: {
      name: "USB Keyboard",
      description: "Standard USB keyboard.",
      unitOfMeasure: "piece",
      reorderLevel: 10,
      categoryId: electronicsCategory.id,
      isActive: true,
    },
    create: {
      sku: "ELEC-KEY-001",
      name: "USB Keyboard",
      description: "Standard USB keyboard.",
      unitOfMeasure: "piece",
      reorderLevel: 10,
      categoryId: electronicsCategory.id,
      isActive: true,
    },
  });

  const cartonBox = await prisma.item.upsert({
    where: {
      sku: "PACK-BOX-001",
    },
    update: {
      name: "Carton Box",
      description: "Medium-sized shipping carton.",
      unitOfMeasure: "piece",
      reorderLevel: 30,
      categoryId: packagingCategory.id,
      isActive: true,
    },
    create: {
      sku: "PACK-BOX-001",
      name: "Carton Box",
      description: "Medium-sized shipping carton.",
      unitOfMeasure: "piece",
      reorderLevel: 30,
      categoryId: packagingCategory.id,
      isActive: true,
    },
  });

  const bubbleWrap = await prisma.item.upsert({
    where: {
      sku: "PACK-BUB-001",
    },
    update: {
      name: "Bubble Wrap",
      description: "Protective packaging material.",
      unitOfMeasure: "roll",
      reorderLevel: 5,
      categoryId: packagingCategory.id,
      isActive: true,
    },
    create: {
      sku: "PACK-BUB-001",
      name: "Bubble Wrap",
      description: "Protective packaging material.",
      unitOfMeasure: "roll",
      reorderLevel: 5,
      categoryId: packagingCategory.id,
      isActive: true,
    },
  });

  // =========================================================
  // 5. CREATE MAIN WAREHOUSE STOCK
  // =========================================================

  await prisma.warehouseStock.upsert({
    where: {
      warehouseId_itemId: {
        warehouseId: mainWarehouse.id,
        itemId: usbCable.id,
      },
    },
    update: {
      quantityOnHand: 100,
      reorderLevel: 20,
      lastRestockedAt: new Date(),
    },
    create: {
      warehouseId: mainWarehouse.id,
      itemId: usbCable.id,
      quantityOnHand: 100,
      reorderLevel: 20,
      lastRestockedAt: new Date(),
    },
  });

  await prisma.warehouseStock.upsert({
    where: {
      warehouseId_itemId: {
        warehouseId: mainWarehouse.id,
        itemId: wirelessMouse.id,
      },
    },
    update: {
      quantityOnHand: 50,
      reorderLevel: 10,
      lastRestockedAt: new Date(),
    },
    create: {
      warehouseId: mainWarehouse.id,
      itemId: wirelessMouse.id,
      quantityOnHand: 50,
      reorderLevel: 10,
      lastRestockedAt: new Date(),
    },
  });

  await prisma.warehouseStock.upsert({
    where: {
      warehouseId_itemId: {
        warehouseId: mainWarehouse.id,
        itemId: keyboard.id,
      },
    },
    update: {
      quantityOnHand: 35,
      reorderLevel: 10,
      lastRestockedAt: new Date(),
    },
    create: {
      warehouseId: mainWarehouse.id,
      itemId: keyboard.id,
      quantityOnHand: 35,
      reorderLevel: 10,
      lastRestockedAt: new Date(),
    },
  });

  await prisma.warehouseStock.upsert({
    where: {
      warehouseId_itemId: {
        warehouseId: mainWarehouse.id,
        itemId: cartonBox.id,
      },
    },
    update: {
      quantityOnHand: 25,
      reorderLevel: 30,
      lastRestockedAt: new Date(),
    },
    create: {
      warehouseId: mainWarehouse.id,
      itemId: cartonBox.id,
      quantityOnHand: 25,
      reorderLevel: 30,
      lastRestockedAt: new Date(),
    },
  });

  await prisma.warehouseStock.upsert({
    where: {
      warehouseId_itemId: {
        warehouseId: mainWarehouse.id,
        itemId: bubbleWrap.id,
      },
    },
    update: {
      quantityOnHand: 8,
      reorderLevel: 5,
      lastRestockedAt: new Date(),
    },
    create: {
      warehouseId: mainWarehouse.id,
      itemId: bubbleWrap.id,
      quantityOnHand: 8,
      reorderLevel: 5,
      lastRestockedAt: new Date(),
    },
  });

  // =========================================================
  // 6. CREATE SECONDARY WAREHOUSE STOCK
  // =========================================================

  await prisma.warehouseStock.upsert({
    where: {
      warehouseId_itemId: {
        warehouseId: secondaryWarehouse.id,
        itemId: usbCable.id,
      },
    },
    update: {
      quantityOnHand: 60,
      reorderLevel: 20,
      lastRestockedAt: new Date(),
    },
    create: {
      warehouseId: secondaryWarehouse.id,
      itemId: usbCable.id,
      quantityOnHand: 60,
      reorderLevel: 20,
      lastRestockedAt: new Date(),
    },
  });

  await prisma.warehouseStock.upsert({
    where: {
      warehouseId_itemId: {
        warehouseId: secondaryWarehouse.id,
        itemId: wirelessMouse.id,
      },
    },
    update: {
      quantityOnHand: 30,
      reorderLevel: 10,
      lastRestockedAt: new Date(),
    },
    create: {
      warehouseId: secondaryWarehouse.id,
      itemId: wirelessMouse.id,
      quantityOnHand: 30,
      reorderLevel: 10,
      lastRestockedAt: new Date(),
    },
  });

  await prisma.warehouseStock.upsert({
    where: {
      warehouseId_itemId: {
        warehouseId: secondaryWarehouse.id,
        itemId: keyboard.id,
      },
    },
    update: {
      quantityOnHand: 20,
      reorderLevel: 10,
      lastRestockedAt: new Date(),
    },
    create: {
      warehouseId: secondaryWarehouse.id,
      itemId: keyboard.id,
      quantityOnHand: 20,
      reorderLevel: 10,
      lastRestockedAt: new Date(),
    },
  });

  await prisma.warehouseStock.upsert({
    where: {
      warehouseId_itemId: {
        warehouseId: secondaryWarehouse.id,
        itemId: cartonBox.id,
      },
    },
    update: {
      quantityOnHand: 40,
      reorderLevel: 30,
      lastRestockedAt: new Date(),
    },
    create: {
      warehouseId: secondaryWarehouse.id,
      itemId: cartonBox.id,
      quantityOnHand: 40,
      reorderLevel: 30,
      lastRestockedAt: new Date(),
    },
  });

  await prisma.warehouseStock.upsert({
    where: {
      warehouseId_itemId: {
        warehouseId: secondaryWarehouse.id,
        itemId: bubbleWrap.id,
      },
    },
    update: {
      quantityOnHand: 12,
      reorderLevel: 5,
      lastRestockedAt: new Date(),
    },
    create: {
      warehouseId: secondaryWarehouse.id,
      itemId: bubbleWrap.id,
      quantityOnHand: 12,
      reorderLevel: 5,
      lastRestockedAt: new Date(),
    },
  });

  console.log("Inventory categories seeded successfully.");
  console.log("Inventory items seeded successfully.");
  console.log("Warehouse stock seeded successfully.");

  // =========================================================
  // 7. CREATE PASSWORD HASHES
  // =========================================================

  const adminPassword = await bcrypt.hash(
    "Admin@12345",
    12,
  );

  const warehousePassword = await bcrypt.hash(
    "Warehouse@12345",
    12,
  );

  const logisticsPassword = await bcrypt.hash(
    "Logistics@12345",
    12,
  );

  // =========================================================
  // 8. CREATE SYSTEM ADMIN
  // =========================================================

  await prisma.user.upsert({
    where: {
      username: "admin",
    },
    update: {
      email: "admin@veltrix.local",
      passwordHash: adminPassword,
      firstName: "System",
      lastName: "Administrator",
      roleId: systemAdmin.id,
      warehouseId: null,
      isActive: true,
    },
    create: {
      username: "admin",
      email: "admin@veltrix.local",
      passwordHash: adminPassword,
      firstName: "System",
      lastName: "Administrator",
      roleId: systemAdmin.id,
      warehouseId: null,
      isActive: true,
    },
  });

  // =========================================================
  // 9. CREATE WAREHOUSE STAFF
  // =========================================================

  await prisma.user.upsert({
    where: {
      username: "warehouse1",
    },
    update: {
      email: "warehouse1@veltrix.local",
      passwordHash: warehousePassword,
      firstName: "Warehouse",
      lastName: "Staff",
      roleId: warehouseStaff.id,
      warehouseId: mainWarehouse.id,
      isActive: true,
    },
    create: {
      username: "warehouse1",
      email: "warehouse1@veltrix.local",
      passwordHash: warehousePassword,
      firstName: "Warehouse",
      lastName: "Staff",
      roleId: warehouseStaff.id,
      warehouseId: mainWarehouse.id,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: {
      username: "warehouse2",
    },
    update: {
      email: "warehouse2@veltrix.local",
      passwordHash: warehousePassword,
      firstName: "Warehouse",
      lastName: "Staff 2",
      roleId: warehouseStaff.id,
      warehouseId: secondaryWarehouse.id,
      isActive: true,
    },
    create: {
      username: "warehouse2",
      email: "warehouse2@veltrix.local",
      passwordHash: warehousePassword,
      firstName: "Warehouse",
      lastName: "Staff 2",
      roleId: warehouseStaff.id,
      warehouseId: secondaryWarehouse.id,
      isActive: true,
    },
  });

  // =========================================================
  // 10. CREATE LOGISTICS MANAGER
  // =========================================================

  await prisma.user.upsert({
    where: {
      username: "logistics1",
    },
    update: {
      email: "logistics1@veltrix.local",
      passwordHash: logisticsPassword,
      firstName: "Logistics",
      lastName: "Manager",
      roleId: logisticsManager.id,
      warehouseId: null,
      isActive: true,
    },
    create: {
      username: "logistics1",
      email: "logistics1@veltrix.local",
      passwordHash: logisticsPassword,
      firstName: "Logistics",
      lastName: "Manager",
      roleId: logisticsManager.id,
      warehouseId: null,
      isActive: true,
    },
  });

  // =========================================================
  // 11. SEED SUMMARY
  // =========================================================

  console.log("Roles seeded successfully.");
  console.log("Main warehouse created successfully.");
  console.log("Secondary warehouse created successfully.");
  console.log("Warehouse inventory created successfully.");
  console.log("Four development users created successfully.");

  console.log("");
  console.log("Development accounts:");
  console.log("admin       / Admin@12345");
  console.log("warehouse1  / Warehouse@12345");
  console.log("warehouse2  / Warehouse@12345");
  console.log("logistics1  / Logistics@12345");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });