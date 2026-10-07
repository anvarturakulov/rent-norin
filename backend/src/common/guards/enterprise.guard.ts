import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";

@Injectable()
export class EnterpriseGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("User not authenticated");
    }

    // Суперпользователи имеют доступ ко всем предприятиям
    if (user.isSuperUser) {
      return true;
    }

    // Для обычных пользователей проверяем enterpriseId
    const requestedEnterpriseId =
      request.headers["x-enterprise-id"] || request.query?.enterpriseId;

    if (
      requestedEnterpriseId &&
      Number(requestedEnterpriseId) !== user.enterpriseId
    ) {
      throw new ForbiddenException("Access denied to this enterprise");
    }

    return true;
  }
}
