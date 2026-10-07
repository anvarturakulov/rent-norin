export enum PricingMarkupGroup {
  BEFORE_COST = "BEFORE_COST",
  AFTER_COST = "AFTER_COST",
}

export type PricingClassPercents = {
  classA: number;
  classB: number;
  classC: number;
};

export type PricingPolicyForDate = {
  effectiveDate: number;
  snapshotId: number | null;
  definitions: PricingMarkupDefinitionDto[];
  values: Record<string, PricingClassPercents>;
};

export type PricingMarkupDefinitionDto = {
  id: number;
  group: PricingMarkupGroup;
  code: string;
  name: string;
  isSystem: boolean;
  includesInCost: boolean;
  sortOrder: number;
  enterpriseId?: number | null;
};
