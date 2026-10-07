import {
  Body,
  Controller,
  HttpException,
  Post,
  UseGuards,
  HttpStatus,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { CreateUserDto } from "src/users/dto/createUser.dto";
import { AuthService } from "./auth.service";
import { Roles } from "./roles-auth.decorator";
import { RolesGuard } from "./roles.guard";
import { UserLoginDto } from "src/users/dto/userLogin.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { RateLimitGuard } from "./rate-limit.guard";
import { BruteForceGuard } from "./brute-force.guard";

@ApiTags("Авторизация")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @UseGuards(RateLimitGuard, BruteForceGuard)
  @Post("/login")
  login(@Body() userDto: UserLoginDto, @Req() request: Request) {
    const ip = this.getClientIp(request);
    const email = userDto.email;
    return this.authService.login(userDto, ip, email);
  }

  @UseGuards(RateLimitGuard, BruteForceGuard)
  @Post("/verifyOtp")
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() request: Request) {
    const ip = this.getClientIp(request);
    return this.authService.verifyOtp(dto, ip);
  }

  /**
   * Получает IP адрес клиента из заголовков запроса
   * Учитывает заголовки от Nginx: X-Forwarded-For, X-Real-IP
   */
  private getClientIp(request: Request): string {
    const xForwardedFor = request.headers["x-forwarded-for"] as string;
    const xRealIp = request.headers["x-real-ip"] as string;
    const remoteAddress = request.connection?.remoteAddress;

    // X-Forwarded-For может содержать несколько IP через запятую (первый - оригинальный клиент)
    if (xForwardedFor) {
      return xForwardedFor.split(",")[0].trim();
    }

    if (xRealIp) {
      return xRealIp;
    }

    if (remoteAddress) {
      // Убираем IPv6 префикс если есть
      return remoteAddress.replace("::ffff:", "");
    }

    return "unknown";
  }

  @Roles("ADMINGLOBAL")
  @UseGuards(RolesGuard)
  @Post("/registration")
  registration(@Body() userDto: CreateUserDto) {
    return this.authService.registration(userDto);
  }

  @UseGuards(RateLimitGuard)
  @Post("/loginByTelegram")
  loginTelegram(@Body("initData") initData: string) {
    if (!initData) {
      throw new HttpException("initData is missing", HttpStatus.BAD_REQUEST);
    }
    return this.authService.loginByTelegram(initData);
  }
}
