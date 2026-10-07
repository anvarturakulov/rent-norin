import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  HasMany,
  Model,
  Table,
} from "sequelize-typescript";
import { Enterprise } from "src/enterprises/enterprise.model";
import { Reference } from "src/references/reference.model";
import { ClientContractOrderLine } from "./clientContractOrderLine.model";
import { ClientContractExpenseLine } from "./clientContractExpenseLine.model";
import { ClientContractItemLine } from "./clientContractItemLine.model";
import { ClientContractStatus } from "src/interfaces/client-contract.interface";
import { qtyPriceFromFurnitureOrder } from "./client-contracts.utils";

export interface ClientContractCreationAttrs {
  enterpriseId?: number | null;
  contractNumber: string;
  clientId: number;
  contractDate: number;
  status?: ClientContractStatus;
}

@Table({ tableName: "client_contracts" })
export class ClientContract extends Model<
  ClientContract,
  ClientContractCreationAttrs
> {
  private static readonly statusEnumValues = Object.values(ClientContractStatus);

  @ApiProperty()
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => Enterprise)
  @Column({ type: DataType.INTEGER, allowNull: true })
  enterpriseId?: number | null;

  @BelongsTo(() => Enterprise)
  enterprise?: Enterprise | null;

  @ApiProperty()
  @Column({ type: DataType.STRING(64), allowNull: false })
  contractNumber: string;

  @ForeignKey(() => Reference)
  @Column({ type: DataType.INTEGER, allowNull: false })
  clientId: number;

  @BelongsTo(() => Reference)
  client: Reference;

  @ApiProperty({ description: "Дата договора (мс)" })
  @Column({ type: DataType.BIGINT, allowNull: false })
  contractDate: number;

  @ApiProperty({ enum: ClientContractStatus })
  @Column({
    type: DataType.ENUM(...ClientContract.statusEnumValues),
    allowNull: false,
    defaultValue: ClientContractStatus.DRAFT,
  })
  status: ClientContractStatus;

  @HasMany(() => ClientContractOrderLine)
  orderLines: ClientContractOrderLine[];

  @HasMany(() => ClientContractExpenseLine)
  expenseLines: ClientContractExpenseLine[];

  @HasMany(() => ClientContractItemLine)
  itemLines: ClientContractItemLine[];

  /** Вложенные orderLines через get({ plain: true }) отдают `qty`; count/цена — из заказа. */
  toJSON(): object {
    const values = super.toJSON() as unknown as Record<string, unknown>;
    const lines = values.orderLines;
    if (Array.isArray(lines)) {
      values.orderLines = lines.map((line) => {
        if (!line || typeof line !== "object") return line;
        const row = { ...(line as Record<string, unknown>) };
        const order = (row.furnitureOrder ?? null) as
          | { count?: number; price?: number; total?: number }
          | null;
        const live = qtyPriceFromFurnitureOrder(order, {
          count: row.count as number | undefined,
          qty: row.qty as number | undefined,
          orderPrice: row.orderPrice as number | undefined,
        });
        row.count = live.count;
        row.orderPrice = live.orderPrice;
        delete row.qty;
        return row;
      });
    }
    return values;
  }
}
