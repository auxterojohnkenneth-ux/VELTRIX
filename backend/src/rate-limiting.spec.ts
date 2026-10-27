import { Controller, Get } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { Throttle, ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import request from "supertest";
import { AuthController } from "./auth/auth.controller.js";
import { AuthService } from "./auth/auth.service.js";

@Controller("rate-limit-test")
class RateLimitTestController {
  @Get()
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  get() {
    return { status: "ok" };
  }
}

describe("API rate limiting", () => {
  it("allows requests under the route limit and returns 429 when exceeded", async () => {
    const login = vi.fn().mockResolvedValue({
      accessToken: "test-access-token",
      user: { username: "test-user" },
    });
    const moduleRef = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([
          { name: "default", ttl: 60_000, limit: 120 },
        ]),
      ],
      controllers: [RateLimitTestController, AuthController],
      providers: [
        { provide: AuthService, useValue: { login } },
        { provide: APP_GUARD, useClass: ThrottlerGuard },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    try {
      const server = app.getHttpServer();
      expect((await request(server).get("/rate-limit-test")).status).toBe(200);
      expect((await request(server).get("/rate-limit-test")).status).toBe(200);
      const limitedResponse = await request(server).get("/rate-limit-test");
      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.body).toMatchObject({
        statusCode: 429,
        message: "ThrottlerException: Too Many Requests",
      });

      const loginStatuses: number[] = [];
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const response = await request(server)
            .post("/auth/login")
            .send({ username: "test-user", password: "password" });
        loginStatuses.push(response.status);
      }
      expect(loginStatuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
      expect(loginStatuses[5]).toBe(429);
      expect(login).toHaveBeenCalledTimes(5);
    } finally {
      await app.close();
    }
  });
});
