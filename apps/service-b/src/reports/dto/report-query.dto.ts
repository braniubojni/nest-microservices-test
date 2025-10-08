import { IsOptional, IsString, IsDate, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class ReportQueryDto {
  @IsOptional()
  @IsString()
  service?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  fromDate?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  toDate?: Date;

  @IsOptional()
  @IsIn(['1h', '6h', '24h', '7d', '30d', 'custom'])
  period: string = '24h';

  @IsOptional()
  @IsIn(['summary', 'detailed'])
  reportType?: string = 'summary';
}
