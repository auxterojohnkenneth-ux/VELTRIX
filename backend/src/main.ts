import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configuredProxyHops = process.env.TRUST_PROXY_HOPS;

  if (configuredProxyHops && configuredProxyHops !== "1") {
    throw new Error("TRUST_PROXY_HOPS must be 1 or unset");
  }

  app.set("trust proxy", configuredProxyHops === "1" ? 1 : false);

  const allowedOrigins = (
    process.env.CORS_ORIGINS ?? "http://localhost:3000"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
  });

  await app.listen(process.env.PORT ?? 3001);
}

await bootstrap();