import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { QueryLogsDto } from './dto/query-logs.dto';
import { LogsService } from './logs.service';
import { TrackApi } from '@app/shared/redis-time-series/decorators/track-api.decorator';
import { QueryStatisticsDto } from './dto/query-statistics.dto';

@ApiTags('logs')
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @TrackApi()
  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Query logs with filters and pagination' })
  async queryLogs(@Query() queryDto: QueryLogsDto) {
    return this.logsService.queryLogs(queryDto);
  }

  @TrackApi()
  @Get('statistics')
  @ApiOperation({ summary: 'Get log statistics' })
  @HttpCode(HttpStatus.OK)
  async getStatistics(
    @Query() { service, fromDate, toDate }: QueryStatisticsDto,
  ) {
    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;

    return this.logsService.getStatistics(service, from, to);
  }

  @TrackApi()
  @Get('count-by-type')
  async getCountByType(@Query('service') service?: string) {
    const stats = await this.logsService.getStatistics(service);
    return {
      service: service || 'all',
      counts: stats.overview,
    };
  }
}
