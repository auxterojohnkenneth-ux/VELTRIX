import { InventoryController } from "./inventory.controller.js";

describe('InventoryController', () => {
  const inventoryService = {
    getWarehouseStock: vi.fn(),
    getWarehouseDashboard: vi.fn(),
  };
  let controller: InventoryController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new InventoryController(inventoryService as never);
  });

  it("passes the authenticated user to the inventory service", () => {
    const user = {
      userId: 4,
      username: "warehouse1",
      role: "WAREHOUSE_STAFF",
      warehouseId: 1,
    };

    void controller.getWarehouseStock({ user } as never);

    expect(inventoryService.getWarehouseStock).toHaveBeenCalledWith(user);
  });
});
