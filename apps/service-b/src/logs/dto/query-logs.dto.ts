import { IsOptional, IsString, IsNumber, IsDate, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QueryLogsDto {
  @ApiProperty({ required: false, example: 'service-a' })
  @IsOptional()
  @IsString()
  service?: string;

  @ApiProperty({ required: false, example: 'GET' })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiProperty({ required: false, example: '/api/users' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiProperty({
    required: false,
    enum: ['request', 'error', 'success'],
    example: 'success',
  })
  @IsOptional()
  @IsIn(['request', 'error', 'success'])
  type?: string;

  @ApiProperty({ required: false, example: '2024-01-01T00:00:00Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fromDate?: Date;

  @ApiProperty({ required: false, example: '2024-12-31T23:59:59Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  toDate?: Date;

  @ApiProperty({ required: false, example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minDuration?: number;

  @ApiProperty({ required: false, example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxDuration?: number;

  @ApiProperty({ required: false, example: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minStatusCode?: number;

  @ApiProperty({ required: false, example: 299 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxStatusCode?: number;

  @ApiProperty({ required: false, example: 'user-123' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false, example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiProperty({ required: false, example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 50;

  @ApiProperty({ required: false, example: 'timestamp', default: 'timestamp' })
  @IsOptional()
  @IsString()
  sortBy?: string = 'timestamp';

  @ApiProperty({
    required: false,
    enum: ['asc', 'desc'],
    example: 'desc',
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';
}
