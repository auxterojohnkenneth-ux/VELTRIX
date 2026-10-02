
import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { AuthModule } from "../auth/auth.module.js";
import { ShipmentsController } from "./shipments.controller.js";
import { ShipmentsService } from "./shipments.service.js";

@Module({
  imports: [
    AuthModule,
    PassportModule.register({
      defaultStrategy: "jwt",
    }),
  ],
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
})
export class ShipmentsModule {}