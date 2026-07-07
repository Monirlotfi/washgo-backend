import { IsString, IsOptional, IsInt, IsBoolean, Min, IsIn } from 'class-validator';

export class CreateCarouselDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  subtitle?: string;

  @IsOptional()
  @IsString()
  @IsIn(['TOP', 'BOTTOM', 'LEFT', 'RIGHT', 'CENTER'])
  textPosition?: string;

  @IsOptional()
  @IsString()
  @IsIn(['COVER', 'CONTAIN', 'CENTER'])
  imageFit?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
