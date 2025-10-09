import { IsOptional, IsString, IsDate, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ReportQueryDto {
  @ApiProperty({ required: false, description: 'Filter by service name' })
  @IsOptional()
  @IsString()
  service?: string;

  @ApiProperty({
    required: false,
    description: 'Start date for the report',
    type: Date,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fromDate?: Date;

  @ApiProperty({
    required: false,
    description: 'End date for the report',
    type: Date,
  })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  toDate?: Date;

  @ApiProperty({
    required: false,
    enum: ['1h', '6h', '24h', '7d', '30d', 'custom'],
    default: '24h',
    description: 'Time period for the report',
  })
  @IsOptional()
  @IsIn(['1h', '6h', '24h', '7d', '30d', 'custom'])
  period: string = '24h';

  @ApiProperty({
    required: false,
    enum: ['summary', 'detailed'],
    default: 'summary',
    description: 'Type of report to generate',
  })
  @IsOptional()
  @IsIn(['summary', 'detailed'])
  reportType?: string = 'summary';
}
