import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/sequelize";
import { createHash, timingSafeEqual } from "crypto";
import { Op } from "sequelize";
import { AuthOtp } from "./auth-otp.model";

const OTP_TTL_SEC = 5 * 60;
const COOLDOWN_SEC = 45;

@Injectable()
export class AuthOtpService {
  private readonly logger = new Logger(AuthOtpService.name);

  constructor(
    @InjectModel(AuthOtp) private readonly otpModel: typeof AuthOtp,
  ) {}

  isDashboardOtpEnabled(): boolean {
    return process.env.TELEGRAM_DASHBOARD_OTP_ENABLED === "true";
  }

  async isOnCooldown(email: string): Promise<boolean> {
    const row = await this.findRow(this.normalizeEmail(email));
    if (!row) return false;
    return Date.now() - row.lastSentAt.getTime() < COOLDOWN_SEC * 1000;
  }

  async save(email: string, code: string): Promise<void> {
    const key = this.normalizeEmail(email);
    const hash = this.hashCode(key, code);
    const expiresAt = new Date(Date.now() + OTP_TTL_SEC * 1000);
    const lastSentAt = new Date();

    const existing = await this.findRow(key);
    if (existing) {
      existing.codeHash = hash;
      existing.expiresAt = expiresAt;
      existing.lastSentAt = lastSentAt;
      await existing.save();
      return;
    }

    await this.otpModel.create({
      email: key,
      codeHash: hash,
      expiresAt,
      lastSentAt,
    });
  }

  async consume(email: string, code: string): Promise<boolean> {
    const key = this.normalizeEmail(email);
    const expected = this.hashCode(key, String(code || "").trim());

    await this.cleanExpired();
    const row = await this.findRow(key);
    if (!row || new Date() > row.expiresAt) {
      if (row) await row.destroy();
      return false;
    }
    if (!this.hashesEqual(row.codeHash, expected)) {
      return false;
    }
    await row.destroy();
    return true;
  }

  async delete(email: string): Promise<void> {
    await this.otpModel
      .destroy({ where: { email: this.normalizeEmail(email) } })
      .catch(() => undefined);
  }

  private normalizeEmail(email: string): string {
    return String(email || "")
      .trim()
      .toLowerCase();
  }

  private hashCode(email: string, code: string): string {
    const pepper = process.env.PRIVATE_KEY || "SECRET";
    return createHash("sha256")
      .update(`${email}:${code}:${pepper}`)
      .digest("hex");
  }

  private hashesEqual(left: string, right: string): boolean {
    const a = Buffer.from(left);
    const b = Buffer.from(right);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  private async findRow(email: string): Promise<AuthOtp | null> {
    return this.otpModel.findOne({ where: { email } });
  }

  private async cleanExpired(): Promise<void> {
    try {
      await this.otpModel.destroy({
        where: { expiresAt: { [Op.lt]: new Date() } },
      });
    } catch (error: any) {
      this.logger.warn(`OTP cleanup failed: ${error?.message}`);
    }
  }
}
