import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Observable } from "rxjs";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const req = context.switchToHttp().getRequest();
    try {
      const authHeader = req.headers.authorization || req.headers.Authorization;

      if (!authHeader) {
        throw new UnauthorizedException({
          message: "Пользователь не авторизирован",
        });
      }

      const parts = authHeader.split(" ");
      const bearer = parts[0];
      const token = parts[1];

      if (bearer !== "Bearer" || !token) {
        throw new UnauthorizedException({
          message: "Пользователь не авторизирован",
        });
      }

      try {
        const user = this.jwtService.verify(token);
        req.user = user;
        return true;
      } catch (verifyError: any) {
        console.error(
          "JwtAuthGuard: Ошибка верификации токена:",
          verifyError.message,
        );
        throw new UnauthorizedException({
          message: `Токен невалидный или истек: ${verifyError.message}`,
        });
      }
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      console.error("JwtAuthGuard: Неожиданная ошибка:", e);
      throw new UnauthorizedException({
        message: "Пользователь не авторизован",
      });
    }
  }
}
