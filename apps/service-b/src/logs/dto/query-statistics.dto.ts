import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsString } from 'class-validator';

export class QueryStatisticsDto {
  @ApiProperty({ required: false, example: 'service-a' })
  @IsOptional()
  @IsString()
  service?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  @ApiProperty({ required: false, example: '2024-01-01T00:00:00Z' })
  fromDate?: Date;

  @ApiProperty({ required: false, example: '2024-12-31T23:59:59Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  toDate?: Date;
}
