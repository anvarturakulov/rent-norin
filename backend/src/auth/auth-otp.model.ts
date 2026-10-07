import { Column, DataType, Index, Model, Table } from "sequelize-typescript";

interface AuthOtpCreationAttrs {
  email: string;
  codeHash: string;
  expiresAt: Date;
  lastSentAt: Date;
}

@Table({ tableName: "auth_otp" })
@Index(["email"])
@Index(["expiresAt"])
export class AuthOtp extends Model<AuthOtp, AuthOtpCreationAttrs> {
  @Column({
    type: DataType.INTEGER,
    unique: true,
    autoIncrement: true,
    primaryKey: true,
  })
  id: number;

  @Column({ type: DataType.STRING, allowNull: false, unique: true })
  email: string;

  @Column({ type: DataType.STRING, allowNull: false })
  codeHash: string;

  @Column({ type: DataType.DATE, allowNull: false })
  expiresAt: Date;

  @Column({ type: DataType.DATE, allowNull: false })
  lastSentAt: Date;

  @Column({ type: DataType.DATE })
  createdAt: Date;

  @Column({ type: DataType.DATE })
  updatedAt: Date;
}
