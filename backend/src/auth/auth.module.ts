import { forwardRef, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { SequelizeModule } from "@nestjs/sequelize";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { UsersModule } from "src/users/users.module";
import { JwtModule } from "@nestjs/jwt";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { AuthBruteForceService } from "./auth-brute-force.service";
import { AuthRateLimit } from "./auth-rate-limit.model";
import { AuthBruteForceAttempt } from "./auth-brute-force.model";
import { AuthOtp } from "./auth-otp.model";
import { AuthOtpService } from "./auth-otp.service";
import { RateLimitGuard } from "./rate-limit.guard";
import { BruteForceGuard } from "./brute-force.guard";
import { RolesGuard } from "./roles.guard";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRateLimitService,
    AuthBruteForceService,
    AuthOtpService,
    RateLimitGuard,
    BruteForceGuard,
    RolesGuard,
    JwtAuthGuard,
  ],
  imports: [
    forwardRef(() => UsersModule),
    ConfigModule,
    SequelizeModule.forFeature([AuthRateLimit, AuthBruteForceAttempt, AuthOtp]),
    JwtModule.register({
      secret: process.env.PRIVATE_KEY || "SECRET",
      signOptions: {
        expiresIn: "24h",
      },
    }),
  ],
  exports: [
    AuthService,
    JwtModule,
    RateLimitGuard,
    BruteForceGuard,
    RolesGuard,
    JwtAuthGuard,
  ],
})
export class AuthModule {}
