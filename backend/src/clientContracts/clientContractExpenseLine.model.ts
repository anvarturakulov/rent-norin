import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { ClientContract } from "./clientContract.model";

export interface ClientContractExpenseLineCreationAttrs {
  contractId: number;
  expenseName: string;
  amount: number;
}

@Table({
  tableName: "client_contract_expense_lines",
  timestamps: false,
})
export class ClientContractExpenseLine extends Model<
  ClientContractExpenseLine,
  ClientContractExpenseLineCreationAttrs
> {
  @ApiProperty()
  @Column({ type: DataType.BIGINT, autoIncrement: true, primaryKey: true })
  id: number;

  @ForeignKey(() => ClientContract)
  @Column({ type: DataType.BIGINT, allowNull: false })
  contractId: number;

  @BelongsTo(() => ClientContract)
  contract: ClientContract;

  @ApiProperty()
  @Column({ type: DataType.STRING(512), allowNull: false })
  expenseName: string;

  @ApiProperty()
  @Column({ type: DataType.DOUBLE, allowNull: false, defaultValue: 0 })
  amount: number;
}
