import { createParamDecorator, ExecutionContext } from "@nestjs/common";

export const CurrentEnterprise = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): number | null => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return null;
    }

    // Если суперпользователь, может быть передан enterpriseId в заголовке или query
    if (user.isSuperUser) {
      const headerEnterpriseId = request.headers["x-enterprise-id"];
      const queryEnterpriseId = request.query?.enterpriseId;

      if (headerEnterpriseId) {
        return Number(headerEnterpriseId);
      }
      if (queryEnterpriseId) {
        return Number(queryEnterpriseId);
      }
    }

    // Для обычных пользователей возвращаем их enterpriseId
    return user.enterpriseId || null;
  },
);

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
