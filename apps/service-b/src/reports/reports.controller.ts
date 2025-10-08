import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { TrackApi } from '@app/shared/redis-time-series/decorators/track-api.decorator';
import { type Response } from 'express';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @TrackApi()
  @Get('pdf')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate PDF report of API usage' })
  async generatePdfReport(
    @Query() query: ReportQueryDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const pdfStream = await this.reportsService.generatePdfReport(query);

    const filename = `api-report-${query.service || 'all'}-${Date.now()}.pdf`;

    response.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return new StreamableFile(pdfStream);
  }

  @TrackApi()
  @Get('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview report data without generating PDF' })
  async previewReport(@Query() query: ReportQueryDto) {
    return {
      message: 'Report preview - use /reports/pdf to generate actual PDF',
      query,
    };
  }
}
