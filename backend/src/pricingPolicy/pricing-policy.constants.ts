import { UserRoles } from "src/interfaces/user.interface";

export const PRICING_POLICY_WRITE_ROLES = [
  UserRoles.ADMINGLOBAL,
  UserRoles.HEADCOMPANY,
  UserRoles.GLAVBUX,
] as const;

export const PRICE_CLASS_KEYS = ["classA", "classB", "classC"] as const;

export const SYSTEM_MARKUP_CODES = [
  "OTHER_EXPENSES",
  "DESIGNER",
  "DEALER",
  "RETAIL",
  "TRANSFER",
] as const;
