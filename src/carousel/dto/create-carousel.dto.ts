import { IsString, IsOptional, IsInt, IsBoolean, Min } from 'class-validator';

export class CreateCarouselDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
