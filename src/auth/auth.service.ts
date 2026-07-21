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
import { UserRole } from '@prisma/client';
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

  async sendOtp(phone: string) {
    await this.ensurePhoneIsFree(phone); // évite d'envoyer un SMS pour un numéro déjà inscrit
    await this.infobip.sendOtp(phone);
    return { message: 'Code envoyé' };
  }

  async verifyOtp(phone: string, code: string) {
    await this.infobip.verifyOtp(phone, code);
    return { message: 'Code vérifié' };
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

  private async ensureEmailIsFree(email: string): Promise<void> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Cet email est déjà utilisé');
  }
}