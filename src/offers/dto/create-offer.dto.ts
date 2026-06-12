import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateOfferDto {
  @IsInt({ message: 'Le prix doit être un entier (en centimes)' })
  @Min(1000, { message: 'Prix minimum 10 DH (1000 centimes)' })
  @Max(100000, { message: 'Prix maximum 1000 DH (100000 centimes)' })
  @Type(() => Number)
  proposedPriceMAD!: number;
}