import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CacheService } from '../../cache/cache.service';

export interface JwtPayload {
  sub: string;
  role: string;
}

const USER_CACHE_TTL = 60_000;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET')!,
    });
  }

  async validate(payload: JwtPayload) {
    const cacheKey = `user:${payload.sub}`;

    let user = await this.cache.get<any>(cacheKey);
    if (!user) {
      user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          phone: true,
          email: true,
          fullName: true,
          role: true,
          avatarUrl: true,
          washerProfile: {
            select: {
              verificationStatus: true,
              retryMessage: true,
            },
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException('Utilisateur introuvable');
      }

      await this.cache.set(cacheKey, user, USER_CACHE_TTL);
    }

    const { washerProfile, ...rest } = user as any;
    return {
      ...rest,
      verificationStatus: washerProfile?.verificationStatus ?? null,
      verificationNote: washerProfile?.retryMessage ?? null,
    };
  }
}
