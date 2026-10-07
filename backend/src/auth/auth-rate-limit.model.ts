import { Column, DataType, Model, Table, Index } from "sequelize-typescript";

interface AuthRateLimitCreationAttrs {
  ip: string;
  count: number;
  expiresAt: Date;
}

@Table({ tableName: "auth_rate_limits" })
@Index(["ip"])
@Index(["expiresAt"])
export class AuthRateLimit extends Model<
  AuthRateLimit,
  AuthRateLimitCreationAttrs
> {
  @Column({
    type: DataType.INTEGER,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @Column({ type: DataType.STRING, allowNull: false })
  ip: string;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  count: number;

  @Column({ type: DataType.DATE, allowNull: false })
  expiresAt: Date;

  @Column({ type: DataType.DATE })
  createdAt: Date;

  @Column({ type: DataType.DATE })
  updatedAt: Date;
}
