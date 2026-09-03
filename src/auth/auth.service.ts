import {
  ConflictException,
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterClientDto } from './dto/register-client.dto';
import { RegisterWasherDto } from './dto/register-washer.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole, OtpPurpose } from '@prisma/client';
import { InfobipService } from '../infobip/infobip.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly infobip: InfobipService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async registerClient(dto: RegisterClientDto) {
    // 1. Vérifie que ce téléphone a un OTP validé récemment, puis le consomme
    await this.infobip.consumeVerifiedOtp(dto.phone);

    await this.ensurePhoneIsFree(dto.phone);
    if (dto.email) await this.ensureEmailIsFree(dto.email);

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        role: UserRole.CLIENT,
      },
      select: {
        id: true, phone: true, email: true, fullName: true, role: true,
      },
    });

    return {
      user,
      accessToken: this.signToken(user.id, user.role),
    };
  }

  async registerWasher(dto: RegisterWasherDto, cinPhotoBuffer?: Buffer) {
    // 1. Vérifie que ce téléphone a un OTP validé récemment, puis le consomme
    await this.infobip.consumeVerifiedOtp(dto.phone);

    await this.ensurePhoneIsFree(dto.phone);

    // 2. Upload photo CIN sur Cloudinary
    if (!cinPhotoBuffer) {
      throw new BadRequestException('Photo CIN requise');
    }

    const cinPhotoUrl = await this.cloudinary.uploadBuffer(
      cinPhotoBuffer,
      'washgo/cin',
    );

    // 3. Crée le compte (non vérifié — en attente admin)
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        passwordHash,
        fullName: dto.fullName,
        role: UserRole.WASHER,
        washerProfile: {
          create: {
            equipmentType: dto.equipmentType,
            licensePlate: dto.licensePlate,
            cinPhotoUrl,
            isVerified: false,
            verificationStatus: 'PENDING',
            consentGivenAt: new Date(),
          },
        },
      },
      select: {
        id: true, phone: true, fullName: true, role: true,
        washerProfile: { select: { id: true, isVerified: true, verificationStatus: true, retryMessage: true } },
      },
    });

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: null,
        fullName: user.fullName,
        role: user.role,
        verificationStatus: user.washerProfile?.verificationStatus ?? null,
        verificationNote: user.washerProfile?.retryMessage ?? null,
      },
      accessToken: this.signToken(user.id, user.role),
    };
  }

  async sendOtp(phone: string, purpose: OtpPurpose = OtpPurpose.PHONE_VERIFICATION) {
    if (purpose === OtpPurpose.PASSWORD_RESET) {
      await this.ensurePhoneExists(phone); // il faut un compte pour réinitialiser son mot de passe
    } else {
      await this.ensurePhoneIsFree(phone); // évite d'envoyer un SMS pour un numéro déjà inscrit
    }
    await this.infobip.sendOtp(phone, purpose);
    return { message: 'Code envoyé' };
  }

  async verifyOtp(phone: string, code: string, purpose: OtpPurpose = OtpPurpose.PHONE_VERIFICATION) {
    await this.infobip.verifyOtp(phone, code, purpose);
    return { message: 'Code vérifié' };
  }

  async resetPassword(phone: string, newPassword: string) {
    await this.infobip.consumeVerifiedOtp(phone, OtpPurpose.PASSWORD_RESET);

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { phone }, data: { passwordHash } });

    return { message: 'Mot de passe mis à jour' };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      include: {
        washerProfile: {
          select: { isVerified: true, verificationStatus: true, retryMessage: true },
        },
      },
    });

    if (!user) throw new UnauthorizedException('Identifiants invalides');

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Identifiants invalides');

    if (user.role === UserRole.WASHER && user.washerProfile) {
      const { isVerified, verificationStatus } = user.washerProfile;

      if (!isVerified && verificationStatus === 'REJECTED') {
        throw new UnauthorizedException(
          "Votre demande a été refusée. Contactez le support pour plus d'informations.",
        );
      }

      // PENDING → connexion autorisée, redirigé vers écran d'attente
      // RETRY → connexion autorisée, redirigé vers écran de correction
    }

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        verificationStatus: user.washerProfile?.verificationStatus ?? null,
        verificationNote: user.washerProfile?.retryMessage ?? null,
      },
      accessToken: this.signToken(user.id, user.role),
    };
  }

  private signToken(userId: string, role: UserRole): string {
    return this.jwt.sign({ sub: userId, role });
  }

  private async ensurePhoneIsFree(phone: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing) throw new ConflictException('Ce numéro est déjà utilisé');
  }

  private async ensurePhoneExists(phone: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (!existing) throw new UnauthorizedException('Aucun compte associé à ce numéro');
  }

  private async ensureEmailIsFree(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Cet email est déjà utilisé');
  }
}