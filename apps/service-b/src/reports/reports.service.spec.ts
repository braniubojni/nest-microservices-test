import { Test, TestingModule } from '@nestjs/testing';
import { Readable } from 'node:stream';
import { ReportsService } from './reports.service';
import { RedisTimeSeriesService } from '@app/shared/redis-time-series/redis-time-series.service';
import { LogsService } from '../logs/logs.service';
import { ReportQueryDto } from './dto/report-query.dto';

type RedisTimeSeriesServiceMock = {
  getRequestCount: jest.Mock;
  getAverageDuration: jest.Mock;
  getErrorCount: jest.Mock;
};

type LogsServiceMock = {
  getStatistics: jest.Mock;
};

describe('ReportsService', () => {
  let service: ReportsService;
  let redisService: RedisTimeSeriesServiceMock;
  let logsService: LogsServiceMock;

  beforeEach(async () => {
    redisService = {
      getRequestCount: jest.fn(),
      getAverageDuration: jest.fn(),
      getErrorCount: jest.fn(),
    };

    logsService = {
      getStatistics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: RedisTimeSeriesService,
          useValue: redisService,
        },
        {
          provide: LogsService,
          useValue: logsService,
        },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePdfReport', () => {
    it('should generate PDF report for specified service and period', async () => {
      const query: ReportQueryDto = {
        service: 'service-a',
        period: '24h',
        reportType: 'summary',
      };

      const mockRequestsData = [[Date.now(), '10']];
      const mockDurationData = [[Date.now(), '150']];
      const mockErrorsData = [[Date.now(), '1']];
      const mockLogStats = {
        overview: [{ _id: 'success', count: 10, avgDuration: 150 }],
        byService: [],
        byMethod: [],
        topSlowEndpoints: [],
        recentErrors: [],
      };

      redisService.getRequestCount.mockResolvedValue(mockRequestsData);
      redisService.getAverageDuration.mockResolvedValue(mockDurationData);
      redisService.getErrorCount.mockResolvedValue(mockErrorsData);
      logsService.getStatistics.mockResolvedValue(mockLogStats);

      const result = await service.generatePdfReport(query);

      expect(result).toBeInstanceOf(Readable);
      expect(redisService.getRequestCount).toHaveBeenCalledWith(
        'service-a',
        expect.any(Number),
        expect.any(Number),
      );
      expect(redisService.getAverageDuration).toHaveBeenCalledWith(
        'service-a',
        expect.any(Number),
        expect.any(Number),
      );
      expect(redisService.getErrorCount).toHaveBeenCalledWith(
        'service-a',
        expect.any(Number),
        expect.any(Number),
      );
      expect(logsService.getStatistics).toHaveBeenCalledWith(
        'service-a',
        expect.any(Date),
        expect.any(Date),
      );
    });

    it('should generate PDF report for all services with custom date range', async () => {
      const fromDate = new Date('2024-01-01');
      const toDate = new Date('2024-01-31');
      const query: ReportQueryDto = {
        period: 'custom',
        fromDate,
        toDate,
        reportType: 'detailed',
      };

      const mockRequestsData = [];
      const mockDurationData = [];
      const mockErrorsData = [];
      const mockLogStats = {
        overview: [],
        byService: [],
        byMethod: [],
        topSlowEndpoints: [],
        recentErrors: [],
      };

      redisService.getRequestCount.mockResolvedValue(mockRequestsData);
      redisService.getAverageDuration.mockResolvedValue(mockDurationData);
      redisService.getErrorCount.mockResolvedValue(mockErrorsData);
      logsService.getStatistics.mockResolvedValue(mockLogStats);

      const result = await service.generatePdfReport(query);

      expect(result).toBeInstanceOf(Readable);
      expect(redisService.getRequestCount).toHaveBeenCalledWith(
        undefined,
        fromDate.getTime(),
        toDate.getTime(),
      );
      expect(logsService.getStatistics).toHaveBeenCalledWith(
        undefined,
        fromDate,
        toDate,
      );
    });

    it('should handle errors when fetching data', async () => {
      const query: ReportQueryDto = {
        service: 'service-b',
        period: '1h',
      };

      const error = new Error('Redis connection failed');
      redisService.getRequestCount.mockRejectedValue(error);

      await expect(service.generatePdfReport(query)).rejects.toThrow(
        'Redis connection failed',
      );
      expect(redisService.getRequestCount).toHaveBeenCalledWith(
        'service-b',
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('should generate report with empty data', async () => {
      const query: ReportQueryDto = {
        period: '7d',
      };

      redisService.getRequestCount.mockResolvedValue([]);
      redisService.getAverageDuration.mockResolvedValue([]);
      redisService.getErrorCount.mockResolvedValue([]);
      logsService.getStatistics.mockResolvedValue({
        overview: [],
        byService: [],
        byMethod: [],
        topSlowEndpoints: [],
        recentErrors: [],
      });

      const result = await service.generatePdfReport(query);

      expect(result).toBeInstanceOf(Readable);
      expect(redisService.getRequestCount).toHaveBeenCalledWith(
        undefined,
        expect.any(Number),
        expect.any(Number),
      );
    });
  });
});
