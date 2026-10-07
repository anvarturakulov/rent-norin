import { Column, DataType, Model, Table, Index } from "sequelize-typescript";

interface AuthBruteForceCreationAttrs {
  ip: string;
  email: string;
  attempts: number;
  expiresAt: Date;
}

@Table({ tableName: "auth_brute_force_attempts" })
@Index(["ip"])
@Index(["email"])
@Index(["expiresAt"])
export class AuthBruteForceAttempt extends Model<
  AuthBruteForceAttempt,
  AuthBruteForceCreationAttrs
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

  @Column({ type: DataType.STRING, allowNull: false })
  email: string;

  @Column({ type: DataType.INTEGER, defaultValue: 0 })
  attempts: number;

  @Column({ type: DataType.DATE, allowNull: false })
  expiresAt: Date;

  @Column({ type: DataType.DATE })
  createdAt: Date;

  @Column({ type: DataType.DATE })
  updatedAt: Date;
}
