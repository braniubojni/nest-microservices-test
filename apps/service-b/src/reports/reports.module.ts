import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Log, LogSchema } from '@app/shared/schemas/log.schemas';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [LogsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
