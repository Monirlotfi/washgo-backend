import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OtpPurpose } from '@prisma/client';

const OTP_EXPIRY_MINUTES = 5;
const OTP_LENGTH = 6;

@Injectable()
export class InfobipService {
  constructor(private readonly prisma: PrismaService) {}

  async sendOtp(phone: string, purpose: OtpPurpose = OtpPurpose.PHONE_VERIFICATION): Promise<void> {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    await this.prisma.otpCode.create({
      data: { phone, code, purpose, expiresAt },
    });

    await this.sendSms(phone, `Votre code WashGo est ${code}. Il expire dans ${OTP_EXPIRY_MINUTES} minutes.`);
  }

  async verifyOtp(phone: string, code: string, purpose: OtpPurpose = OtpPurpose.PHONE_VERIFICATION): Promise<void> {
    const otp = await this.prisma.otpCode.findFirst({
      where: {
        phone,
        purpose,
        verified: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp || otp.code !== code) {
      throw new UnauthorizedException('Code invalide ou expiré');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { verified: true },
    });
  }

  /** Vérifie qu'un OTP a été validé récemment pour ce téléphone, puis le consomme (usage unique). */
  async consumeVerifiedOtp(phone: string, purpose: OtpPurpose = OtpPurpose.PHONE_VERIFICATION): Promise<void> {
    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, purpose, verified: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new UnauthorizedException('Numéro de téléphone non vérifié');
    }

    // Usage unique : on supprime pour empêcher de réutiliser le même OTP sur un second register
    await this.prisma.otpCode.delete({ where: { id: otp.id } });
  }

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private async sendSms(phone: string, text: string): Promise<void> {
    const baseUrl = process.env.INFOBIP_BASE_URL;
    const apiKey = process.env.INFOBIP_API_KEY;
    const sender = process.env.INFOBIP_SENDER ?? 'WashGo';

    const res = await fetch(`${baseUrl}/sms/2/text/advanced`, {
      method: 'POST',
      headers: {
        Authorization: `App ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            destinations: [{ to: phone.replace('+', '') }],
            from: sender,
            text,
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Infobip SMS failed (${res.status}): ${body}`);
    }
  }
}
