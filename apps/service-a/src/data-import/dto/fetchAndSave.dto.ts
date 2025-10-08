import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class FetchAndSaveDto {
  @ApiProperty({ example: 'json' })
  @IsNotEmpty()
  @IsOptional()
  @IsEnum(['json', 'excel'], { message: 'Format must be either json or excel' })
  format: 'json' | 'excel' = 'json';

  @ApiProperty({ example: '5' })
  @IsString()
  @IsOptional()
  limit: string = '5';
}
