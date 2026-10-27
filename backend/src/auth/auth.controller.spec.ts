import { BadRequestException } from "@nestjs/common";
import { AuthController } from './auth.controller.js';

describe('AuthController', () => {
  const authService = {
    login: vi.fn(),
  };
  let controller: AuthController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AuthController(authService as never);
  });

  it("passes credentials to the authentication service", () => {
    void controller.login({
      username: "warehouse1",
      password: "secret",
    });

    expect(authService.login).toHaveBeenCalledWith(
      "warehouse1",
      "secret",
    );
  });

  it("rejects a missing or non-object login body", () => {
    expect(() => controller.login(null)).toThrow(BadRequestException);
    expect(() => controller.login("username")).toThrow(BadRequestException);
    expect(authService.login).not.toHaveBeenCalled();
  });
});
