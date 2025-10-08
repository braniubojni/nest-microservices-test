import { Test, TestingModule } from '@nestjs/testing';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { QueryLogsDto } from './dto/query-logs.dto';

type LogsServiceMock = {
  queryLogs: jest.Mock;
  getStatistics: jest.Mock;
};

describe('LogsController', () => {
  let controller: LogsController;
  let service: LogsServiceMock;

  beforeEach(async () => {
    service = {
      queryLogs: jest.fn(),
      getStatistics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LogsController],
      providers: [
        {
          provide: LogsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<LogsController>(LogsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('queryLogs', () => {
    it('should query logs with provided filters and return paginated results', async () => {
      const queryDto = {
        service: 'service-a',
        method: 'GET',
        page: 1,
        limit: 10,
      } as QueryLogsDto;

      const mockResult = {
        data: [{ _id: '1', service: 'service-a' }],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      service.queryLogs.mockResolvedValue(mockResult);

      const result = await controller.queryLogs(queryDto);

      expect(service.queryLogs).toHaveBeenCalledWith(queryDto);
      expect(result).toEqual(mockResult);
    });

    it('should handle service errors when querying logs', async () => {
      const queryDto = {} as QueryLogsDto;
      const error = new Error('Database error');

      service.queryLogs.mockRejectedValue(error);

      await expect(controller.queryLogs(queryDto)).rejects.toThrow(
        'Database error',
      );
      expect(service.queryLogs).toHaveBeenCalledWith(queryDto);
    });
  });

  describe('getStatistics', () => {
    it('should get statistics for a specific service and date range', async () => {
      const serviceParam = 'service-b';
      const fromDate = '2024-01-01T00:00:00.000Z';
      const toDate = '2024-01-31T23:59:59.999Z';

      const mockStats = {
        overview: [{ _id: 'error', count: 5 }],
        byService: [],
        byMethod: [],
        topSlowEndpoints: [],
        recentErrors: [],
      };

      service.getStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics(
        serviceParam,
        fromDate,
        toDate,
      );

      expect(service.getStatistics).toHaveBeenCalledWith(
        serviceParam,
        new Date(fromDate),
        new Date(toDate),
      );
      expect(result).toEqual(mockStats);
    });

    it('should get statistics without optional parameters', async () => {
      const mockStats = {
        overview: [{ _id: 'success', count: 10 }],
        byService: [],
        byMethod: [],
        topSlowEndpoints: [],
        recentErrors: [],
      };

      service.getStatistics.mockResolvedValue(mockStats);

      const result = await controller.getStatistics();

      expect(service.getStatistics).toHaveBeenCalledWith(
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(mockStats);
    });

    it('should handle service errors when getting statistics', async () => {
      const error = new Error('Stats calculation failed');

      service.getStatistics.mockRejectedValue(error);

      await expect(controller.getStatistics('service-a')).rejects.toThrow(
        'Stats calculation failed',
      );
      expect(service.getStatistics).toHaveBeenCalledWith(
        'service-a',
        undefined,
        undefined,
      );
    });
  });

  describe('getCountByType', () => {
    it('should return count by type for a specific service', async () => {
      const serviceParam = 'service-c';

      const mockStats = {
        overview: [
          { _id: 'error', count: 3 },
          { _id: 'success', count: 7 },
        ],
        byService: [],
        byMethod: [],
        topSlowEndpoints: [],
        recentErrors: [],
      };

      service.getStatistics.mockResolvedValue(mockStats);

      const result = await controller.getCountByType(serviceParam);

      expect(service.getStatistics).toHaveBeenCalledWith(serviceParam);
      expect(result).toEqual({
        service: serviceParam,
        counts: mockStats.overview,
      });
    });

    it('should return count by type for all services when no service specified', async () => {
      const mockStats = {
        overview: [{ _id: 'request', count: 20 }],
        byService: [],
        byMethod: [],
        topSlowEndpoints: [],
        recentErrors: [],
      };

      service.getStatistics.mockResolvedValue(mockStats);

      const result = await controller.getCountByType();

      expect(service.getStatistics).toHaveBeenCalledWith(undefined);
      expect(result).toEqual({
        service: 'all',
        counts: mockStats.overview,
      });
    });

    it('should handle service errors when getting count by type', async () => {
      const error = new Error('Count query failed');

      service.getStatistics.mockRejectedValue(error);

      await expect(controller.getCountByType('service-d')).rejects.toThrow(
        'Count query failed',
      );
      expect(service.getStatistics).toHaveBeenCalledWith('service-d');
    });
  });
});
