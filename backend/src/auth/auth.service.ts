import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { CreateUserDto } from "src/users/dto/createUser.dto";
import { UsersService } from "src/users/users.service";
import * as bcrypt from "bcryptjs";
import { User } from "src/users/users.model";
import { UserLoginDto } from "src/users/dto/userLogin.dto";
import { createHmac, randomInt } from "crypto";
import { UserRoles } from "src/interfaces/user.interface";
import { AuthBruteForceService } from "./auth-brute-force.service";
import { AuthOtpService } from "./auth-otp.service";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { TelegramDashboardAuthService } from "src/telegram/telegram-dashboard-auth.service";

const WORKER_ROLES: UserRoles[] = [
  UserRoles.PRODUCTION,
  UserRoles.SCALING,
  UserRoles.DELIVERY,
];

const OTP_SEND_FAILED_MESSAGE =
  "Не удалось отправить код подтверждения. Попробуйте позже или обратитесь к администратору.";
const OTP_INVALID_MESSAGE = "Неверный код подтверждения";

@Injectable()
export class AuthService {
  constructor(
    private userService: UsersService,
    private jwtService: JwtService,
    private authBruteForceService: AuthBruteForceService,
    private authOtpService: AuthOtpService,
    private telegramDashboardAuthService: TelegramDashboardAuthService,
  ) {}

  private verifyInitData(initData: string, botToken: string): boolean {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    params.delete("hash");
    const dataCheckString = Array.from(params.entries())
      .sort()
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");
    const secretKey = createHmac("sha256", "WebAppData")
      .update(botToken)
      .digest();
    const calculatedHash = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");
    return calculatedHash === hash;
  }

  async login(userDto: UserLoginDto, ip: string, email: string) {
    try {
      const user = await this.validateUser(userDto);

      if (user.banned) {
        throw new HttpException(
          "Пользователь заблокирован",
          HttpStatus.FORBIDDEN,
        );
      }

      if (WORKER_ROLES.includes(user.role)) {
        throw new HttpException(
          "Для рабочих ролей вход доступен только через Telegram Mini App",
          HttpStatus.FORBIDDEN,
        );
      }

      if (this.authOtpService.isDashboardOtpEnabled()) {
        await this.sendDashboardOtp(user);
        await this.authBruteForceService.resetAttempts(ip, email);
        return { otpRequired: true };
      }

      await this.authBruteForceService.resetAttempts(ip, email);
      return this.buildLoginResponse(user);
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        await this.authBruteForceService.recordFailedAttempt(ip, email);
      }
      throw error;
    }
  }

  async verifyOtp(dto: VerifyOtpDto, ip: string) {
    const email = dto.email;
    try {
      const user = await this.userService.getUserByEmail(email);
      if (!user) {
        await this.authBruteForceService.recordFailedAttempt(ip, email);
        throw new UnauthorizedException({ message: OTP_INVALID_MESSAGE });
      }

      if (user.banned) {
        throw new HttpException(
          "Пользователь заблокирован",
          HttpStatus.FORBIDDEN,
        );
      }

      const accepted = await this.authOtpService.consume(user.email, dto.code);
      if (!accepted) {
        await this.authBruteForceService.recordFailedAttempt(ip, email);
        throw new UnauthorizedException({ message: OTP_INVALID_MESSAGE });
      }

      await this.authBruteForceService.resetAttempts(ip, email);
      return this.buildLoginResponse(user);
    } catch (error) {
      throw error;
    }
  }

  async loginByTelegram(initData: string) {
    try {
      if (!initData) {
        throw new Error("initData is missing");
      }
      const botToken =
        process.env.BOT_TOKEN_FURNITURE_WORKER?.trim() ||
        process.env.BOT_TOKEN_MINIAPP?.trim() ||
        "";
      const isValid = this.verifyInitData(initData, botToken);
      if (!isValid) {
        throw new Error("Invalid initData");
      }

      const params = new URLSearchParams(initData);
      const userFromInitData = JSON.parse(params.get("user") || "{}");
      const user = await this.userService.getUserByTelegramId(
        userFromInitData?.id,
      );

      if (user) {
        if (user.banned) {
          throw new HttpException(
            "Пользователь заблокирован",
            HttpStatus.FORBIDDEN,
          );
        }
        return this.buildLoginResponse(user);
      }
      throw new UnauthorizedException({
        message: "Некорректный email или пароль",
      });
    } catch (error) {
      console.error("Verification error:", error.message);
      throw new HttpException(
        `Verification failed: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async registration(userDto: CreateUserDto) {
    const candidate = await this.userService.getUserByEmail(userDto.email);
    if (!candidate) {
      const hashPassword = await bcrypt.hash(userDto.password, 10);
      const user = await this.userService.createUser({
        ...userDto,
        password: hashPassword,
      });
      return true;
    } else
      throw new HttpException(
        "Пользователь с таким email существует",
        HttpStatus.BAD_REQUEST,
      );
  }

  private async sendDashboardOtp(user: User): Promise<void> {
    if (await this.authOtpService.isOnCooldown(user.email)) {
      return;
    }

    const telegramId = String(user.telegramId || "").trim();
    if (!telegramId) {
      throw new HttpException(OTP_SEND_FAILED_MESSAGE, HttpStatus.BAD_REQUEST);
    }

    const code = String(randomInt(100000, 1000000));
    await this.authOtpService.save(user.email, code);

    try {
      await this.telegramDashboardAuthService.sendLoginCode(telegramId, code);
    } catch {
      await this.authOtpService.delete(user.email);
      throw new HttpException(OTP_SEND_FAILED_MESSAGE, HttpStatus.BAD_REQUEST);
    }
  }

  private async buildLoginResponse(user: User) {
    const { token } = await this.generateToken(user);
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      token,
      name: user.name,
      sectionId: user.sectionId,
      enterpriseId: user.enterpriseId,
      isSuperUser: user.isSuperUser,
      superKassir: user.superKassir,
      allowedStorageIds: user.allowedStorageIds,
      referencePermissions: user.referencePermissions ?? null,
    };
  }

  private async generateToken(user: User) {
    const payload = {
      email: user.email,
      id: user.id,
      enterpriseId: user.enterpriseId,
      isSuperUser: user.isSuperUser || false,
      superKassir: user.superKassir === true,
    };
    return {
      token: this.jwtService.sign(payload),
    };
  }

  private async validateUser(userDto: UserLoginDto): Promise<User> {
    const user = await this.userService.getUserByEmail(userDto.email);
    let passwordEquals = false;
    if (user) {
      passwordEquals = await bcrypt.compare(userDto.password, user.password);
    }
    if (user && passwordEquals) {
      return user;
    }

    throw new UnauthorizedException({
      message: "Некорректный email или пароль",
    });
  }
}
