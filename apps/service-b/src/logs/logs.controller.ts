import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { QueryLogsDto } from './dto/query-logs.dto';
import { LogsService } from './logs.service';

@ApiTags('logs')
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Query logs with filters and pagination' })
  async queryLogs(@Query() queryDto: QueryLogsDto) {
    return this.logsService.queryLogs(queryDto);
  }

  @Get('statistics')
  @ApiOperation({ summary: 'Get log statistics' })
  @HttpCode(HttpStatus.OK)
  async getStatistics(
    @Query('service') service?: string,
    @Query('fromDate') fromDate?: string,
    @Query('toDate') toDate?: string,
  ) {
    const from = fromDate ? new Date(fromDate) : undefined;
    const to = toDate ? new Date(toDate) : undefined;

    return this.logsService.getStatistics(service, from, to);
  }

  @Get('count-by-type')
  async getCountByType(@Query('service') service?: string) {
    const stats = await this.logsService.getStatistics(service);
    return {
      service: service || 'all',
      counts: stats.overview,
    };
  }
}
