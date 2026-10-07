import { UserRoles } from '@/app/interfaces/user.interface';
import { OrderStageType } from '@/app/interfaces/furnitureOrder.interface';

export type WorkerStageRole = UserRoles.SCALING | UserRoles.ZAVSKLAD | UserRoles.DELIVERY;

type WorkerRoleConfig = {
  stage: OrderStageType;
  title: string;
};

export const workerRoleStageConfig: Record<WorkerStageRole, WorkerRoleConfig> = {
  [UserRoles.SCALING]: {
    stage: 'SCALING',
    title: 'Менинг ишларим (Ўлчов)',
  },
  [UserRoles.ZAVSKLAD]: {
    stage: 'STORE',
    title: 'Менинг ишларим (Омбор)',
  },
  [UserRoles.DELIVERY]: {
    stage: 'DELIVERY',
    title: 'Менинг ишларим (Етказиб бериш)',
  },
};

export const getWorkerRoleConfig = (role?: UserRoles): WorkerRoleConfig | null => {
  if (!role) return null;
  if (role === UserRoles.SCALING || role === UserRoles.ZAVSKLAD || role === UserRoles.DELIVERY) {
    return workerRoleStageConfig[role];
  }
  return null;
};
