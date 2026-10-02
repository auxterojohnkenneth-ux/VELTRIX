import { UsersController } from "./users.controller.js";

describe('UsersController', () => {
  const usersService = {
    getUsers: vi.fn(),
  };
  let controller: UsersController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new UsersController(usersService as never);
  });

  it("passes the authenticated user to the users service", () => {
    const user = {
      userId: 4,
      username: "warehouse1",
      role: "WAREHOUSE_STAFF",
      warehouseId: 1,
    };

    void controller.getUsers({ user } as never);

    expect(usersService.getUsers).toHaveBeenCalledWith(user);
  });
});
