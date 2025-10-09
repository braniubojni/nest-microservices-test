import { RedisTimeSeriesService } from '@app/shared/redis-time-series/redis-time-series.service';
import PDFDocument from 'pdfkit';
import { Injectable, Logger } from '@nestjs/common';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { LogsService } from '../logs/logs.service';
import { Readable } from 'node:stream';
import { ReportQueryDto } from './dto/report-query.dto';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);
  private readonly chartJSNodeCanvas: ChartJSNodeCanvas;

  constructor(
    private readonly redisTimeSeriesService: RedisTimeSeriesService,
    private readonly logsService: LogsService,
  ) {
    // Initialize ChartJS canvas for generating chart images
    this.chartJSNodeCanvas = new ChartJSNodeCanvas({
      width: 800,
      height: 400,
      backgroundColour: 'white',
    });
  }

  /**
   * Generate PDF report with charts
   */
  async generatePdfReport(query: ReportQueryDto): Promise<Readable> {
    const { service, period, fromDate, toDate } = query;

    // Calculate time range
    const { from, to } = this.calculateTimeRange(period, fromDate, toDate);

    this.logger.log(
      `Generating PDF report for ${service || 'all services'} from ${from} to ${to}`,
    );

    // Fetch data from Redis Time Series
    const [requestsData, durationData, errorsData, logStats] =
      await Promise.all([
        this.redisTimeSeriesService.getRequestCount(service, from, to),
        this.redisTimeSeriesService.getAverageDuration(service, from, to),
        this.redisTimeSeriesService.getErrorCount(service, from, to),
        this.logsService.getStatistics(service, new Date(from), new Date(to)),
      ]);

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      bufferPages: true,
    });

    // Add content to PDF
    await this.addPdfHeader(doc, service, from, to);
    await this.addSummarySection(doc, requestsData, durationData, errorsData);
    await this.addRequestsChart(doc, requestsData);
    await this.addDurationChart(doc, durationData);
    await this.addErrorsChart(doc, errorsData);
    await this.addStatisticsSection(doc, logStats);

    // Add footer to all pages
    await this.addFooter(doc);

    // Finalize PDF
    doc.end();

    return doc as unknown as Readable;
  }

  /**
   * Add PDF header
   */
  private async addPdfHeader(
    doc: PDFKit.PDFDocument,
    service: string | undefined,
    from: number,
    to: number,
  ): Promise<void> {
    doc
      .fontSize(24)
      .font('Helvetica-Bold')
      .text('API Monitoring Report', { align: 'center' })
      .moveDown();

    doc
      .fontSize(12)
      .font('Helvetica')
      .text(`Service: ${service || 'All Services'}`, { align: 'center' })
      .text(
        `Period: ${new Date(from).toLocaleString()} - ${new Date(to).toLocaleString()}`,
        { align: 'center' },
      )
      .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
      .moveDown(2);

    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
  }

  /**
   * Add summary section
   */
  private async addSummarySection(
    doc: PDFKit.PDFDocument,
    requestsData: any,
    durationData: any,
    errorsData: any,
  ): Promise<void> {
    doc.fontSize(16).font('Helvetica-Bold').text('Summary').moveDown(0.5);

    const totalRequests = this.sumTimeSeries(requestsData);
    const avgDuration = this.avgTimeSeries(durationData);
    const totalErrors = this.sumTimeSeries(errorsData);
    const errorRate =
      totalRequests > 0
        ? ((totalErrors / totalRequests) * 100).toFixed(2)
        : '0';

    doc.fontSize(11).font('Helvetica');

    const summaryData = [
      ['Total Requests:', totalRequests.toLocaleString()],
      ['Average Response Time:', `${avgDuration.toFixed(2)} ms`],
      ['Total Errors:', totalErrors.toLocaleString()],
      ['Error Rate:', `${errorRate}%`],
    ];

    const startY = doc.y;
    const lineHeight = 20;

    summaryData.forEach(([label, value], index) => {
      const y = startY + index * lineHeight;
      doc.text(label, 50, y, { width: 200, continued: false });
      doc
        .font('Helvetica-Bold')
        .text(value, 280, y, { width: 200 })
        .font('Helvetica');
    });

    doc.moveDown(summaryData.length + 1);
  }

  /**
   * Add requests chart
   */
  private async addRequestsChart(
    doc: PDFKit.PDFDocument,
    data: any,
  ): Promise<void> {
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Requests Over Time')
      .moveDown(0.5);

    const chartBuffer = await this.generateLineChart(
      data,
      'Requests',
      'rgba(54, 162, 235, 0.8)',
      'Number of Requests',
    );

    doc.image(chartBuffer, 50, doc.y, { width: 500 });
    doc.moveDown(15);
  }

  /**
   * Add duration chart
   */
  private async addDurationChart(
    doc: PDFKit.PDFDocument,
    data: any,
  ): Promise<void> {
    // Add new page if needed
    if (doc.y > 600) {
      doc.addPage();
    }

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Average Response Time Over Time')
      .moveDown(0.5);

    const chartBuffer = await this.generateLineChart(
      data,
      'Response Time (ms)',
      'rgba(75, 192, 192, 0.8)',
      'Milliseconds',
    );

    doc.image(chartBuffer, 50, doc.y, { width: 500 });
    doc.moveDown(15);
  }

  /**
   * Add errors chart
   */
  private async addErrorsChart(
    doc: PDFKit.PDFDocument,
    data: any,
  ): Promise<void> {
    // Add new page if needed
    if (doc.y > 600) {
      doc.addPage();
    }

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Errors Over Time')
      .moveDown(0.5);

    const chartBuffer = await this.generateLineChart(
      data,
      'Errors',
      'rgba(255, 99, 132, 0.8)',
      'Number of Errors',
    );

    doc.image(chartBuffer, 50, doc.y, { width: 500 });
    doc.moveDown(15);
  }

  /**
   * Add statistics section
   */
  private async addStatisticsSection(
    doc: PDFKit.PDFDocument,
    stats: any,
  ): Promise<void> {
    // Add new page if needed
    if (doc.y > 650) {
      doc.addPage();
    }

    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('Detailed Statistics')
      .moveDown(0.5);

    doc.fontSize(11).font('Helvetica');

    // By Type
    if (stats.overview && stats.overview.length > 0) {
      doc.font('Helvetica-Bold').text('By Type:').moveDown(0.3);
      stats.overview.forEach((item: any) => {
        doc
          .font('Helvetica')
          .text(
            `  ${item._id}: ${item.count} requests, avg ${item.avgDuration?.toFixed(2) || 'N/A'} ms`,
          );
      });
      doc.moveDown(0.5);
    }

    // By Service
    if (stats.byService && stats.byService.length > 0) {
      doc.font('Helvetica-Bold').text('By Service:').moveDown(0.3);
      stats.byService.forEach((item: any) => {
        doc
          .font('Helvetica')
          .text(
            `  ${item._id}: ${item.count} requests, avg ${item.avgDuration?.toFixed(2) || 'N/A'} ms`,
          );
      });
      doc.moveDown(0.5);
    }

    // Top Slow Endpoints
    if (stats.topSlowEndpoints && stats.topSlowEndpoints.length > 0) {
      doc
        .font('Helvetica-Bold')
        .text('Top 10 Slowest Endpoints:')
        .moveDown(0.3);
      stats.topSlowEndpoints
        .slice(0, 10)
        .forEach((item: any, index: number) => {
          doc
            .font('Helvetica')
            .text(
              `  ${index + 1}. ${item.method} ${item.path} - ${item.duration?.toFixed(2)} ms`,
            );
        });
      doc.moveDown(0.5);
    }
  }

  /**
   * Add footer with page numbers to all pages
   */
  private async addFooter(doc: PDFKit.PDFDocument): Promise<void> {
    const pages = doc.bufferedPageRange();

    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      // Save old bottom margin
      const oldBottomMargin = doc.page.margins.bottom;

      // Remove bottom margin to write into it
      doc.page.margins.bottom = 0;

      // Add page number centered in bottom margin
      doc
        .fontSize(9)
        .font('Helvetica')
        .text(
          `Page ${i + 1} of ${pages.count}`,
          0,
          doc.page.height - oldBottomMargin / 2,
          { align: 'center' },
        );

      // Restore bottom margin
      doc.page.margins.bottom = oldBottomMargin;
    }
  }

  /**
   * Generate line chart as buffer
   */
  private async generateLineChart(
    data: any,
    label: string,
    color: string,
    yAxisLabel: string,
  ): Promise<Buffer> {
    const formattedData = this.formatTimeSeriesData(data);

    const configuration = {
      type: 'line',
      data: {
        labels: formattedData.map((d) =>
          new Date(d.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        ),
        datasets: [
          {
            label,
            data: formattedData.map((d) => d.value),
            borderColor: color,
            backgroundColor: color,
            fill: false,
            tension: 0.4,
            pointRadius: 3,
            pointHoverRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: true,
            position: 'top',
          },
          title: {
            display: false,
          },
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Time',
            },
          },
          y: {
            display: true,
            title: {
              display: true,
              text: yAxisLabel,
            },
            beginAtZero: true,
          },
        },
      },
    };

    return await this.chartJSNodeCanvas.renderToBuffer(configuration as any);
  }

  /**
   * Calculate time range based on period
   */
  private calculateTimeRange(
    period: string,
    fromDate?: Date,
    toDate?: Date,
  ): { from: number; to: number } {
    const now = Date.now();
    let from: number;
    const to: number = toDate ? toDate.getTime() : now;

    if (period === 'custom' && fromDate) {
      from = fromDate.getTime();
    } else {
      const periodMap: Record<string, number> = {
        '1h': 3600000,
        '6h': 6 * 3600000,
        '24h': 24 * 3600000,
        '7d': 7 * 24 * 3600000,
        '30d': 30 * 24 * 3600000,
      };
      from = now - (periodMap[period] || periodMap['24h']);
    }

    return { from, to };
  }

  /**
   * Format time series data
   */
  private formatTimeSeriesData(
    data: any,
  ): Array<{ timestamp: number; value: number }> {
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => ({
      timestamp: parseInt(item[0]),
      value: parseFloat(item[1]) || 0,
    }));
  }

  /**
   * Sum time series values
   */
  private sumTimeSeries(data: any): number {
    const formatted = this.formatTimeSeriesData(data);
    return formatted.reduce((sum, item) => sum + item.value, 0);
  }

  /**
   * Average time series values
   */
  private avgTimeSeries(data: any): number {
    const formatted = this.formatTimeSeriesData(data);
    if (formatted.length === 0) return 0;
    const sum = formatted.reduce((acc, item) => acc + item.value, 0);
    return sum / formatted.length;
  }
}
