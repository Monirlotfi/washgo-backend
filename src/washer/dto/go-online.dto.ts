import { IsLatitude, IsLongitude } from 'class-validator';
import { Type } from 'class-transformer';

export class GoOnlineDto {
  @IsLatitude({ message: 'Latitude invalide (doit être entre -90 et 90)' })
  @Type(() => Number)
  lat!: number;

  @IsLongitude({ message: 'Longitude invalide (doit être entre -180 et 180)' })
  @Type(() => Number)
  lng!: number;
}
