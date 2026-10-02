import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { AuthModule } from "../auth/auth.module.js";
import { InventoryController } from "./inventory.controller.js";
import { InventoryService } from "./inventory.service.js";

@Module({
  imports: [
    AuthModule,
    PassportModule.register({
      defaultStrategy: "jwt",
    }),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
})
export class InventoryModule {}