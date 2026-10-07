import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "./roles-auth.decorator";
import { UsersService } from "src/users/users.service";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private reflector: Reflector,
    private userService: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) {
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers.authorization || req.headers.Authorization;

    if (!authHeader || typeof authHeader !== "string") {
      throw new UnauthorizedException({
        message: "Пользователь не авторизован",
      });
    }

    const parts = authHeader.split(" ");
    const bearer = parts[0];
    const token = parts[1];

    if (bearer !== "Bearer" || !token) {
      throw new UnauthorizedException({
        message: "Пользователь не авторизован",
      });
    }

    let user: { email: string };
    try {
      user = this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException({
        message: "Токен невалидный или истек",
      });
    }

    req.user = user;

    const role = await this.userService.getUserRoleByEmail(user.email);

    if (role) {
      req.user.role = role;
    }

    if (requiredRoles.includes("ALL") && role) {
      return true;
    }

    const roles = [`${role}`];
    const allowed = roles.some((r) => requiredRoles.includes(r));
    if (!allowed) {
      throw new ForbiddenException("Нет доступа");
    }
    return true;
  }
}
