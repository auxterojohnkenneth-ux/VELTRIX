import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
import { AuthModule } from "../auth/auth.module.js";
import { TransfersController } from "./transfers.controller.js";
import { TransfersService } from "./transfers.service.js";

@Module({
  imports: [
    AuthModule,
    PassportModule.register({
      defaultStrategy: "jwt",
    }),
  ],
  controllers: [TransfersController],
  providers: [TransfersService],
})
export class TransfersModule {}
