import { Test, TestingModule } from '@nestjs/testing';
import Redis from 'ioredis';
import { RedisTimeSeriesService } from './redis-time-series.service';
import { ApiEvent } from './types';

jest.mock('ioredis');

describe('RedisTimeSeriesService', () => {
  let service: RedisTimeSeriesService;
  let mockRedisClient: jest.Mocked<Redis>;
  let mockPubClient: jest.Mocked<Redis>;
  let mockSubClient: jest.Mocked<Redis>;

  const mockOptions = {
    host: 'localhost',
    port: 6379,
    password: 'password',
    db: 0,
  };

  beforeEach(async () => {
    mockRedisClient = {
      exists: jest.fn(),
      call: jest.fn(),
      on: jest.fn(),
      quit: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    mockPubClient = {
      publish: jest.fn(),
      on: jest.fn(),
      quit: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    mockSubClient = {
      subscribe: jest.fn(),
      on: jest.fn(),
      quit: jest.fn(),
    } as unknown as jest.Mocked<Redis>;

    (Redis as jest.MockedClass<typeof Redis>).mockImplementationOnce(
      () => mockRedisClient,
    );
    (Redis as jest.MockedClass<typeof Redis>).mockImplementationOnce(
      () => mockPubClient,
    );
    (Redis as jest.MockedClass<typeof Redis>).mockImplementationOnce(
      () => mockSubClient,
    );

    mockRedisClient.exists.mockResolvedValue(1);
    mockRedisClient.call.mockResolvedValue('OK');
    mockRedisClient.on.mockImplementation(() => mockRedisClient);
    mockPubClient.on.mockImplementation(() => mockPubClient);
    mockSubClient.on.mockImplementation(() => mockSubClient);
    mockSubClient.subscribe.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisTimeSeriesService,
        {
          provide: 'REDIS_TIMESERIES_OPTIONS',
          useValue: mockOptions,
        },
      ],
    }).compile();

    service = module.get<RedisTimeSeriesService>(RedisTimeSeriesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize Redis clients and create time series', async () => {
      mockRedisClient.exists.mockResolvedValue(0); // Force creation
      await service.onModuleInit();

      expect(Redis).toHaveBeenCalledWith({
        host: 'localhost',
        port: 6379,
        password: 'password',
        db: 0,
        retryStrategy: expect.any(Function),
      });
      expect(mockRedisClient.on).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
      expect(mockRedisClient.on).toHaveBeenCalledWith(
        'connect',
        expect.any(Function),
      );
      expect(mockSubClient.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function),
      );
      expect(mockRedisClient.exists).toHaveBeenCalledTimes(3);
      expect(mockRedisClient.call).toHaveBeenCalledTimes(3);
      expect(mockRedisClient.call).toHaveBeenNthCalledWith(
        1,
        'TS.CREATE',
        'ts:api:requests',
        'RETENTION',
        '604800000',
        'LABELS',
        'type',
        'requests',
      );
    });
  });

  describe('publishApiEvent', () => {
    it('should publish API event to time series and pub/sub', async () => {
      await service.onModuleInit();

      const event: ApiEvent = {
        service: 'test-service',
        method: 'GET',
        path: '/api/test',
        statusCode: 200,
        duration: 150,
        timestamp: Date.now(),
        userId: 'user-1',
        metadata: { key: 'value' },
      };

      await service.publishApiEvent(event);

      expect(mockRedisClient.call).toHaveBeenCalledWith(
        'TS.ADD',
        'ts:api:requests',
        event.timestamp,
        '1',
        'LABELS',
        'service',
        'test-service',
        'method',
        'GET',
        'path',
        '/api/test',
      );
      expect(mockRedisClient.call).toHaveBeenCalledWith(
        'TS.ADD',
        'ts:api:duration',
        event.timestamp,
        150,
        'LABELS',
        'service',
        'test-service',
        'method',
        'GET',
        'path',
        '/api/test',
      );
      expect(mockPubClient.publish).toHaveBeenCalledWith(
        'api:events:test-service',
        JSON.stringify(event),
      );
      expect(mockPubClient.publish).toHaveBeenCalledWith(
        'api:events:all',
        JSON.stringify(event),
      );
    });

    it('should handle error events', async () => {
      await service.onModuleInit();

      const event: ApiEvent = {
        service: 'test-service',
        method: 'POST',
        path: '/api/error',
        statusCode: 500,
        duration: 200,
        metadata: { error: 'server error' },
      };

      await service.publishApiEvent(event);

      expect(mockRedisClient.call).toHaveBeenCalledWith(
        'TS.ADD',
        'ts:api:errors',
        expect.any(Number),
        '1',
        'LABELS',
        'service',
        'test-service',
        'method',
        'POST',
        'path',
        '/api/error',
        'statusCode',
        '500',
      );
    });

    it('should handle events without duration', async () => {
      await service.onModuleInit();

      const event: ApiEvent = {
        service: 'test-service',
        method: 'GET',
        path: '/api/no-duration',
        statusCode: 200,
      };

      await service.publishApiEvent(event);

      expect(mockRedisClient.call).toHaveBeenCalledWith(
        'TS.ADD',
        'ts:api:requests',
        expect.any(Number),
        '1',
        'LABELS',
        'service',
        'test-service',
        'method',
        'GET',
        'path',
        '/api/no-duration',
      );
      // Should not call TS.ADD for duration
      expect(mockRedisClient.call).not.toHaveBeenCalledWith(
        'TS.ADD',
        'ts:api:duration',
        expect.any(Number),
        expect.any(Number),
        expect.anything(),
      );
    });
  });

  describe('getRequestCount', () => {
    it('should get request count for service', async () => {
      await service.onModuleInit();

      const mockData = [
        [1609459200000, '10'],
        [1609459260000, '15'],
      ];
      mockRedisClient.call.mockResolvedValue(mockData);

      const result = await service.getRequestCount(
        'test-service',
        1609459200000,
        1609459320000,
      );

      expect(mockRedisClient.call).toHaveBeenCalledWith(
        'TS.RANGE',
        'ts:api:requests',
        1609459200000,
        1609459320000,
        'AGGREGATION',
        'sum',
        60000,
        'FILTER',
        'service=test-service',
      );
      expect(result).toEqual(mockData);
    });

    it('should get request count for all services', async () => {
      await service.onModuleInit();

      const mockData = [[1609459200000, '25']];
      mockRedisClient.call.mockResolvedValue(mockData);

      const result = await service.getRequestCount();

      expect(mockRedisClient.call).toHaveBeenCalledWith(
        'TS.RANGE',
        'ts:api:requests',
        expect.any(Number),
        expect.any(Number),
        'AGGREGATION',
        'sum',
        60000,
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('getAverageDuration', () => {
    it('should get average duration', async () => {
      await service.onModuleInit();

      const mockData = [[1609459200000, '120.5']];
      mockRedisClient.call.mockResolvedValue(mockData);

      const result = await service.getAverageDuration('test-service');

      expect(mockRedisClient.call).toHaveBeenCalledWith(
        'TS.RANGE',
        'ts:api:duration',
        expect.any(Number),
        expect.any(Number),
        'AGGREGATION',
        'avg',
        60000,
        'FILTER',
        'service=test-service',
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('getErrorCount', () => {
    it('should get error count', async () => {
      await service.onModuleInit();

      const mockData = [[1609459200000, '2']];
      mockRedisClient.call.mockResolvedValue(mockData);

      const result = await service.getErrorCount('test-service');

      expect(mockRedisClient.call).toHaveBeenCalledWith(
        'TS.RANGE',
        'ts:api:errors',
        expect.any(Number),
        expect.any(Number),
        'AGGREGATION',
        'sum',
        60000,
        'FILTER',
        'service=test-service',
      );
      expect(result).toEqual(mockData);
    });
  });

  describe('subscribe', () => {
    it('should subscribe to service-specific channel', async () => {
      await service.onModuleInit();

      const handler = jest.fn();

      await service.subscribe('test-service', handler);

      expect(mockSubClient.subscribe).toHaveBeenCalledWith(
        'api:events:test-service',
      );
    });

    it('should subscribe to all events channel', async () => {
      await service.onModuleInit();

      const handler = jest.fn();

      await service.subscribe('all', handler);

      expect(mockSubClient.subscribe).toHaveBeenCalledWith('api:events:all');
    });
  });

  describe('onModuleDestroy', () => {
    it('should close all Redis connections', async () => {
      await service.onModuleInit();

      await service.onModuleDestroy();

      expect(mockRedisClient.quit).toHaveBeenCalled();
      expect(mockPubClient.quit).toHaveBeenCalled();
      expect(mockSubClient.quit).toHaveBeenCalled();
    });
  });
});
