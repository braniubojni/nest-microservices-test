import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { StreamableFile } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportQueryDto } from './dto/report-query.dto';
import { RedisTimeSeriesService } from '@app/shared/redis-time-series/redis-time-series.service';

type ReportsServiceMock = {
  generatePdfReport: jest.Mock;
};

type RedisTimeSeriesServiceMock = {
  publishApiEvent: jest.Mock;
  subscribe: jest.Mock;
};

describe('ReportsController', () => {
  let controller: ReportsController;
  let service: ReportsServiceMock;
  let mockResponse: Partial<Response>;
  let redisTimeSeriesService: RedisTimeSeriesServiceMock;

  beforeEach(async () => {
    service = {
      generatePdfReport: jest.fn(),
    };

    redisTimeSeriesService = {
      publishApiEvent: jest.fn(),
      subscribe: jest.fn(),
    };

    mockResponse = {
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: service,
        },
        {
          provide: RedisTimeSeriesService,
          useValue: redisTimeSeriesService,
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePdfReport', () => {
    it('should generate PDF report and set response headers', async () => {
      const mockNow = 1728326400000; // Fixed timestamp for test
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const query: ReportQueryDto = {
        service: 'service-a',
        period: '24h',
        reportType: 'summary',
      };

      const mockPdfStream = Buffer.from('fake pdf content');
      service.generatePdfReport.mockResolvedValue(mockPdfStream);

      const result = await controller.generatePdfReport(
        query,
        mockResponse as Response,
      );

      expect(service.generatePdfReport).toHaveBeenCalledWith(query);
      expect(mockResponse.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="api-report-service-a-${mockNow}.pdf"`,
      });
      expect(result).toBeInstanceOf(StreamableFile);

      jest.restoreAllMocks();
    });

    it('should generate PDF report for all services when no service specified', async () => {
      const mockNow = 1728326500000; // Different fixed timestamp
      jest.spyOn(Date, 'now').mockReturnValue(mockNow);

      const query: ReportQueryDto = {
        period: '7d',
        reportType: 'detailed',
      };

      const mockPdfStream = Buffer.from('another fake pdf');
      service.generatePdfReport.mockResolvedValue(mockPdfStream);

      const result = await controller.generatePdfReport(
        query,
        mockResponse as Response,
      );

      expect(service.generatePdfReport).toHaveBeenCalledWith(query);
      expect(mockResponse.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="api-report-all-${mockNow}.pdf"`,
      });
      expect(result).toBeInstanceOf(StreamableFile);

      jest.restoreAllMocks();
    });

    it('should handle service errors when generating PDF', async () => {
      const query: ReportQueryDto = { service: 'service-b', period: '24h' };
      const error = new Error('PDF generation failed');

      service.generatePdfReport.mockRejectedValue(error);

      await expect(
        controller.generatePdfReport(query, mockResponse as Response),
      ).rejects.toThrow('PDF generation failed');
      expect(service.generatePdfReport).toHaveBeenCalledWith(query);
    });
  });

  describe('previewReport', () => {
    it('should return preview message with query parameters', async () => {
      const query: ReportQueryDto = {
        service: 'service-c',
        fromDate: new Date('2024-01-01'),
        toDate: new Date('2024-01-31'),
        period: 'custom',
        reportType: 'detailed',
      };

      const result = await controller.previewReport(query);

      expect(result).toEqual({
        message: 'Report preview - use /reports/pdf to generate actual PDF',
        query,
      });
    });

    it('should return preview with default query when no parameters provided', async () => {
      const query: ReportQueryDto = { period: '24h' };

      const result = await controller.previewReport(query);

      expect(result).toEqual({
        message: 'Report preview - use /reports/pdf to generate actual PDF',
        query,
      });
    });
  });
});
