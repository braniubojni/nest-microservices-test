import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @ApiProperty({ example: 1 })
  @IsNumber()
  productId: number;

  @ApiProperty({ example: 'iPhone 12' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'A great smartphone' })
  @IsString()
  description: string;

  @ApiProperty({ example: 999.99 })
  @IsNumber()
  price: number;

  @ApiProperty({ example: 12.5 })
  @IsNumber()
  discountPercentage: number;

  @ApiProperty({ example: 4.5 })
  @IsNumber()
  rating: number;

  @ApiProperty({ example: 100 })
  @IsNumber()
  stock: number;

  @ApiProperty({ example: 'Apple' })
  @IsString()
  brand: string;

  @ApiProperty({ example: 'smartphones' })
  @IsString()
  category: string;

  @ApiPropertyOptional()
  @IsOptional()
  thumbnail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  images?: string[];
}

export class SearchProductsDto {
  @ApiPropertyOptional({ example: 'phone' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'smartphones' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Apple' })
  @IsOptional()
  @IsString()
  brand?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ example: 'price' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({ example: 'asc', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
