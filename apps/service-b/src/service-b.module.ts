import { SharedModule } from '@app/shared/shared.module';
import { Module } from '@nestjs/common';
import { LogsModule } from './logs/logs.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [SharedModule, LogsModule, ReportsModule],
})
export class ServiceBModule {}
