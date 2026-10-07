import { ApiProperty } from "@nestjs/swagger";
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  Table,
} from "sequelize-typescript";
import { Enterprise } from "src/enterprises/enterprise.model";
import { Reference } from "src/references/reference.model";
import { RentalContractStatus } from "src/interfaces/rental-contract.interface";

export interface RentalContractCreationAttrs {
  enterpriseId?: number | null;
  contractNumber: string;
  clientId: number;
  contractDate: number;
  endDate?: number | null;
  status?: RentalContractStatus;
  comment?: string | null;
}

@Table({ tableName: "rental_contracts" })
export class RentalContract extends Model<
  RentalContract,
  RentalContractCreationAttrs
> {
  private static readonly statusEnumValues = Object.values(RentalContractStatus);

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

  @ApiProperty({ description: "Дата окончания (мс)", required: false })
  @Column({ type: DataType.BIGINT, allowNull: true })
  endDate?: number | null;

  @ApiProperty({ enum: RentalContractStatus })
  @Column({
    type: DataType.ENUM(...RentalContract.statusEnumValues),
    allowNull: false,
    defaultValue: RentalContractStatus.DRAFT,
  })
  status: RentalContractStatus;

  @ApiProperty({ required: false })
  @Column({ type: DataType.TEXT, allowNull: true })
  comment?: string | null;
}
