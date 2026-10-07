import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { Document } from "src/documents/document.model";
import { FurnitureOrder } from "src/furnitureOrders/furnitureOrder.model";
import { ClientContract } from "./clientContract.model";

export interface ClientContractOrderLineCreationAttrs {
  contractId: number;
  furnitureOrderId: number;
  orderPrice: number;
  qty?: number;
  additionalExpenses: number;
  saleDocId?: number | null;
}

@Table({
  tableName: "client_contract_order_lines",
  timestamps: false,
})
export class ClientContractOrderLine extends Model<
  ClientContractOrderLine,
  ClientContractOrderLineCreationAttrs
> {
  @ApiProperty()
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => ClientContract)
  @Column({ type: DataType.BIGINT, allowNull: false })
  contractId: number;

  @BelongsTo(() => ClientContract)
  contract: ClientContract;

  @ForeignKey(() => FurnitureOrder)
  @Column({ type: DataType.BIGINT, allowNull: false })
  furnitureOrderId: number;

  @BelongsTo(() => FurnitureOrder, {
    foreignKey: "furnitureOrderId",
    as: "furnitureOrder",
  })
  furnitureOrder: FurnitureOrder;

  @ApiProperty()
  @Column({ type: DataType.DOUBLE, allowNull: false, defaultValue: 0 })
  orderPrice: number;

  /** Колонка БД `count`; имя атрибута не `count`, иначе Sequelize строит COUNT()/GROUP BY. */
  @ApiProperty({ name: "count" })
  @Column({
    type: DataType.DOUBLE,
    allowNull: false,
    defaultValue: 1,
    field: "count",
  })
  qty: number;

  @ApiProperty()
  @Column({ type: DataType.DOUBLE, allowNull: false, defaultValue: 0 })
  additionalExpenses: number;

  @ForeignKey(() => Document)
  @Column({ type: DataType.BIGINT, allowNull: true })
  saleDocId?: number | null;

  @BelongsTo(() => Document, { foreignKey: "saleDocId", as: "saleDoc" })
  saleDoc?: Document | null;

  toJSON(): object {
    const values = super.toJSON() as unknown as Record<string, unknown>;
    values.count = values.qty;
    delete values.qty;
    return values;
  }
}
