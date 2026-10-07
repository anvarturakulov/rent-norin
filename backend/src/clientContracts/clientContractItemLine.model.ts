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
import { Reference } from "src/references/reference.model";
import { ClientContractItemKind } from "src/interfaces/client-contract.interface";
import { ClientContract } from "./clientContract.model";

export interface ClientContractItemLineCreationAttrs {
  contractId: number;
  lineKind: ClientContractItemKind;
  analiticId: number;
  count: number;
  price: number;
  total: number;
  saleDocId?: number | null;
}

@Table({
  tableName: "client_contract_item_lines",
  timestamps: false,
})
export class ClientContractItemLine extends Model<
  ClientContractItemLine,
  ClientContractItemLineCreationAttrs
> {
  @ApiProperty()
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => ClientContract)
  @Column({ type: DataType.BIGINT, allowNull: false })
  contractId: number;

  @BelongsTo(() => ClientContract)
  contract: ClientContract;

  @ApiProperty({ enum: ClientContractItemKind })
  @Column({
    type: DataType.STRING(16),
    allowNull: false,
  })
  lineKind: ClientContractItemKind;

  @ForeignKey(() => Reference)
  @Column({ type: DataType.INTEGER, allowNull: false })
  analiticId: number;

  @BelongsTo(() => Reference, { foreignKey: "analiticId", as: "analitic" })
  analitic: Reference;

  @ApiProperty()
  @Column({ type: DataType.DOUBLE, allowNull: false, defaultValue: 0 })
  count: number;

  @ApiProperty()
  @Column({ type: DataType.DOUBLE, allowNull: false, defaultValue: 0 })
  price: number;

  @ApiProperty()
  @Column({ type: DataType.DOUBLE, allowNull: false, defaultValue: 0 })
  total: number;

  @ForeignKey(() => Document)
  @Column({ type: DataType.BIGINT, allowNull: true })
  saleDocId?: number | null;

  @BelongsTo(() => Document, { foreignKey: "saleDocId", as: "saleDoc" })
  saleDoc?: Document | null;
}
