import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { UsersModule } from "./users/users.module.js";
import { InventoryModule } from './inventory/inventory.module.js';
import { ShipmentsModule } from './shipments/shipments.module.js';
import { TransfersModule } from "./transfers/transfers.module.js";
import { LogisticsModule } from "./logistics/logistics.module.js";
import { AdminModule } from "./admin/admin.module.js";


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    InventoryModule,
    ShipmentsModule,
    TransfersModule,
    LogisticsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}