import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

function normalizePlate(plate: string): string {
  return plate.replace(/[\s-]/g, '').toUpperCase();
}

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertPlateAvailable(plate: string, excludeVehicleId?: string) {
    const normalized = normalizePlate(plate);
    const existing = await this.prisma.vehicle.findMany({
      select: { id: true, plate: true },
    });
    const conflict = existing.find(
      (v) => v.id !== excludeVehicleId && normalizePlate(v.plate) === normalized,
    );
    if (conflict) {
      throw new ConflictException('Cette plaque d\'immatriculation est déjà enregistrée');
    }
  }

  async create(userId: string, dto: CreateVehicleDto) {
    // Mappe la nouvelle category vers l'ancien size pour compatibilité.
    // C'est temporaire en attendant qu'on retire complètement size dans une future migration.
    const sizeMap: Record<string, 'SMALL' | 'MEDIUM' | 'SUV' | 'VAN'> = {
      CITY_CAR: 'SMALL',
      LARGE_VEHICLE: 'SUV',
      MOTORCYCLE: 'SMALL',
    };

    await this.assertPlateAvailable(dto.plate);

    return this.prisma.vehicle.create({
      data: {
        brand: dto.brand,
        model: dto.model,
        plate: dto.plate,
        category: dto.category,
        size: dto.size ?? sizeMap[dto.category],
        userId,
      },
    });
  }

  async findAllByUser(userId: string) {
    return this.prisma.vehicle.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneByUser(userId: string, vehicleId: string) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
    });
    if (!vehicle) {
      throw new NotFoundException('Véhicule introuvable');
    }
    if (vehicle.userId !== userId) {
      throw new ForbiddenException('Ce véhicule ne vous appartient pas');
    }
    return vehicle;
  }

  async update(userId: string, vehicleId: string, dto: UpdateVehicleDto) {
    await this.findOneByUser(userId, vehicleId); // vérifie existence + propriété
    if (dto.plate) {
      await this.assertPlateAvailable(dto.plate, vehicleId);
    }
    return this.prisma.vehicle.update({
      where: { id: vehicleId },
      data: dto,
    });
  }

  async remove(userId: string, vehicleId: string) {
    await this.findOneByUser(userId, vehicleId);
    await this.prisma.vehicle.delete({ where: { id: vehicleId } });
    return { success: true };
  }
}
