// import * as nodeCrypto from 'crypto';
// (global as any).nodeCrypto = nodeCrypto;
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as bodyParser from "body-parser";
import { AllExceptionsFilter } from "./common/filters/http-exception.filter";
import helmet from "helmet";

async function start() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set("trust proxy", 1);

  const configService = app.get(ConfigService);
  const PORT = configService.get("PORT") || 7009;
  // Bind host (set HOST=127.0.0.1 in production to avoid exposing port publicly)
  const HOST = configService.get("HOST") || process.env.HOST || "0.0.0.0";
  const NODE_ENV = process.env.NODE_ENV || "development";

  // Настройки для HTTPS в продакшене
  const isProduction = NODE_ENV === "production";

  // Проверяем загрузку конфигурации
  console.log("🔧 Environment:", process.env.NODE_ENV || "development");
  console.log(
    "🔧 Database:",
    configService.get("DB_DATABASE") || configService.get("POSTGRES_DB"),
  );
  console.log("🔧 Server Port:", PORT);
  console.log("🔧 Server Host:", HOST);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }, // разрешает отдавать изображения из /upload
    }),
  );

  app.setGlobalPrefix("api");
  // Сначала process.env — значение из PM2/systemd не должно проигрывать .production.env в ConfigService
  const corsFromEnv =
    process.env.CORS_ORIGINS || configService.get<string>("CORS_ORIGINS") || "";
  const defaultCorsOrigins = [
    "http://localhost:3009",
  ];
  const corsOrigins = corsFromEnv
    ? corsFromEnv
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean)
    : defaultCorsOrigins;
  console.log("🔧 CORS origins:", corsOrigins.join(", "));
  app.enableCors({
    // Dev-only relaxed CORS for ngrok/Telegram WebView debugging.
    // Production keeps strict allowlist.
    origin: NODE_ENV === "development" ? true : corsOrigins,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "x-enterprise-id",
      "X-Enterprise-Id",
      "ngrok-skip-browser-warning",
    ],
  });

  // Middleware для ISAPI endpoints - читаем raw binary body для multipart/form-data с изображениями
  app.use("/api/isapi/event", bodyParser.raw({ type: "*/*", limit: "10mb" }));
  if (process.env.SWAGGER_ENABLED === "true") {
    const config = new DocumentBuilder()
      .setTitle("Backend - KORD ERP - Mebers")
      .setDescription("REST API - documentation")
      .setVersion("1.0.0")
      .addTag("Kord ERP")
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
  }

  // app.useGlobalGuards(JwtAuthGuard)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Глобальный обработчик исключений для единообразного формата ошибок
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(PORT, HOST);
}

start();
