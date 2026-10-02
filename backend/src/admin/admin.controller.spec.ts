import { GUARDS_METADATA } from "@nestjs/common/constants";
import { JwtAuthGuard } from "../auth/jwt-auth.guard.js";
import { ROLES_KEY } from "../auth/roles.decorator.js";
import { RolesGuard } from "../auth/roles.guard.js";
import { AdminController } from "./admin.controller.js";

describe("AdminController access", () => {
  it("requires JWT authentication and the SYSTEM_ADMIN role on every route", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual([
      "SYSTEM_ADMIN",
    ]);
  });
});
