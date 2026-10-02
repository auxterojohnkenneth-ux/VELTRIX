import {
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { RolesGuard } from "./roles.guard.js";

describe("RolesGuard", () => {
  const reflector = {
    getAllAndOverride: vi.fn(),
  };
  const context = {
    getHandler: vi.fn(),
    getClass: vi.fn(),
    switchToHttp: vi.fn(),
  };
  let guard: RolesGuard;

  beforeEach(() => {
    vi.clearAllMocks();
    guard = new RolesGuard(reflector as never);
  });

  function contextWithUser(user: { role: string }) {
    context.switchToHttp.mockReturnValue({
      getRequest: () => ({ user }),
    });

    return context as unknown as ExecutionContext;
  }

  it("allows a user with a required role", () => {
    reflector.getAllAndOverride.mockReturnValue(["SYSTEM_ADMIN"]);

    expect(
      guard.canActivate(
        contextWithUser({ role: "SYSTEM_ADMIN" }),
      ),
    ).toBe(true);
  });

  it("denies a user without a required role", () => {
    reflector.getAllAndOverride.mockReturnValue(["SYSTEM_ADMIN"]);

    expect(() =>
      guard.canActivate(
        contextWithUser({ role: "LOGISTICS_MANAGER" }),
      ),
    ).toThrow(ForbiddenException);
  });
});
