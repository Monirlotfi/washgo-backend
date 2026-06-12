import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export enum CancellationReason {
  CONFLICT_WITH_WASHER = 'CONFLICT_WITH_WASHER',
  WASHER_LATE = 'WASHER_LATE',
  CHANGED_MIND = 'CHANGED_MIND',
  OTHER = 'OTHER',
}

export class CancelBookingDto {
  @IsEnum(CancellationReason, {
    message:
      'Motif invalide (CONFLICT_WITH_WASHER, WASHER_LATE, CHANGED_MIND, OTHER)',
  })
  reason!: CancellationReason;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  customReason?: string;
}
