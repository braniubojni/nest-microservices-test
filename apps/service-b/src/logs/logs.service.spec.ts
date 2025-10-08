import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { LogsService } from './logs.service';
import { Log } from '@app/shared/schemas/log.schema';

type LogModelMock = jest.Mock & {
  find: jest.Mock;
  countDocuments: jest.Mock;
  aggregate: jest.Mock;
  deleteMany: jest.Mock;
};

const createFindChainWithExec = <T>(data: T) => {
  const execMock = jest.fn().mockResolvedValue(data);
  const chain: any = {};
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.skip = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.lean = jest.fn().mockReturnValue({ exec: execMock });
  chain.exec = execMock;
  return { chain, execMock };
};

const createFindChainWithLeanPromise = <T>(data: T) => {
  const chain: any = {};
  chain.sort = jest.fn().mockReturnValue(chain);
  chain.skip = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.select = jest.fn().mockReturnValue(chain);
  chain.lean = jest.fn().mockResolvedValue(data);
  return { chain };
};

describe('LogsService', () => {
  let service: LogsService;
  let logModelMock: LogModelMock;
  let saveMock: jest.Mock;

  beforeEach(async () => {
    saveMock = jest.fn();

    logModelMock = jest.fn().mockImplementation((doc) => ({
      ...doc,
      save: saveMock,
    })) as LogModelMock;

    logModelMock.find = jest.fn();
    logModelMock.countDocuments = jest.fn();
    logModelMock.aggregate = jest.fn();
    logModelMock.deleteMany = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogsService,
        {
          provide: getModelToken(Log.name),
          useValue: logModelMock,
        },
      ],
    }).compile();

    service = module.get<LogsService>(LogsService);
  });

  it('should store a log with derived type and return the saved entity', async () => {
    const event = {
      service: 'service-a',
      method: 'GET',
      path: '/health',
      statusCode: 204,
      duration: 42,
      timestamp: 1700000000000,
      userId: 'user-123',
      metadata: { traceId: 'trace-1' },
    };

    const savedLog = { _id: 'abc123', ...event, type: 'success' };
    saveMock.mockResolvedValue(savedLog);

    const result = await service.storeLog(event);

    expect(logModelMock).toHaveBeenCalledTimes(1);
    const logPayload = logModelMock.mock.calls[0][0];
    expect(logPayload).toMatchObject({
      service: 'service-a',
      method: 'GET',
      path: '/health',
      statusCode: 204,
      duration: 42,
      userId: 'user-123',
      metadata: { traceId: 'trace-1' },
      type: 'success',
      errorMessage: undefined,
    });
    expect(logPayload.timestamp).toBeInstanceOf(Date);
    expect(logPayload.timestamp.toISOString()).toBe(
      new Date(event.timestamp).toISOString(),
    );
    expect(saveMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(savedLog);
  });

  it('should propagate errors when persisting a log fails', async () => {
    const event = {
      service: 'service-b',
      method: 'POST',
      path: '/api/resource',
      statusCode: 500,
      metadata: { error: 'boom' },
    };

    const error = new Error('database unreachable');
    saveMock.mockRejectedValue(error);

    await expect(service.storeLog(event)).rejects.toThrow(
      'database unreachable',
    );

    const logPayload = logModelMock.mock.calls[0][0];
    expect(logPayload.type).toBe('error');
    expect(logPayload.errorMessage).toBe('boom');
  });

  it('should query logs with filters and pagination metadata', async () => {
    const fromDate = new Date('2024-01-01T00:00:00.000Z');
    const toDate = new Date('2024-01-31T23:59:59.999Z');
    const queryDto = {
      service: 'service-b',
      method: 'POST',
      path: '/api',
      type: 'error',
      userId: 'user-1',
      fromDate,
      toDate,
      minDuration: 100,
      maxDuration: 200,
      minStatusCode: 400,
      maxStatusCode: 500,
      page: 2,
      limit: 10,
      sortBy: 'duration',
      sortOrder: 'asc',
    };

    const logs = [{ _id: '1' }, { _id: '2' }];
    const total = 75;

    const { chain: findChain, execMock } = createFindChainWithExec(logs);
    logModelMock.find.mockReturnValue(findChain);

    const countExec = jest.fn().mockResolvedValue(total);
    logModelMock.countDocuments.mockReturnValue({ exec: countExec });

    const result = await service.queryLogs(queryDto as any);

    expect(logModelMock.find).toHaveBeenCalledTimes(1);
    const filterUsed = logModelMock.find.mock.calls[0][0];
    expect(filterUsed).toMatchObject({
      service: 'service-b',
      method: 'POST',
      type: 'error',
      userId: 'user-1',
      path: { $regex: '/api', $options: 'i' },
      timestamp: { $gte: fromDate, $lte: toDate },
      duration: { $gte: 100, $lte: 200 },
      statusCode: { $gte: 400, $lte: 500 },
    });
    expect(findChain.sort).toHaveBeenCalledWith({ duration: 1 });
    expect(findChain.skip).toHaveBeenCalledWith(10);
    expect(findChain.limit).toHaveBeenCalledWith(10);
    expect(execMock).toHaveBeenCalled();
    expect(countExec).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      data: logs,
      pagination: {
        page: 2,
        limit: 10,
        total,
        totalPages: Math.ceil(total / 10),
      },
    });
  });

  it('should return aggregated statistics, top slow endpoints, and recent errors', async () => {
    const fromDate = new Date('2024-03-01T00:00:00.000Z');
    const toDate = new Date('2024-03-31T23:59:59.999Z');

    const stats = [{ _id: 'error', count: 2, avgDuration: 120 }];
    const byService = [{ _id: 'service-a', count: 5, avgDuration: 90 }];
    const byMethod = [{ _id: 'GET', count: 3 }];
    const topSlowEndpoints = [{ path: '/slow', duration: 999 }];
    const recentErrors = [{ path: '/fail', timestamp: new Date() }];

    logModelMock.aggregate
      .mockResolvedValueOnce(stats)
      .mockResolvedValueOnce(byService)
      .mockResolvedValueOnce(byMethod);

    logModelMock.find
      .mockImplementationOnce(
        () => createFindChainWithLeanPromise(topSlowEndpoints).chain,
      )
      .mockImplementationOnce(
        () => createFindChainWithLeanPromise(recentErrors).chain,
      );

    const result = await service.getStatistics('service-a', fromDate, toDate);

    expect(logModelMock.aggregate).toHaveBeenCalledTimes(3);
    const firstMatchStage = logModelMock.aggregate.mock.calls[0][0][0].$match;
    expect(firstMatchStage).toEqual({
      service: 'service-a',
      timestamp: { $gte: fromDate, $lte: toDate },
    });

    expect(logModelMock.find).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      overview: stats,
      byService,
      byMethod,
      topSlowEndpoints,
      recentErrors,
    });
  });

  it('should return logs scoped by service and time range', async () => {
    const fromDate = new Date('2024-04-01T00:00:00.000Z');
    const toDate = new Date('2024-04-02T00:00:00.000Z');
    const logs = [{ _id: 'log-1' }];

    const { chain: findChain, execMock } = createFindChainWithExec(logs);
    logModelMock.find.mockReturnValue(findChain);

    const result = await service.getLogsByServiceAndTime(
      'service-a',
      fromDate,
      toDate,
    );

    expect(logModelMock.find).toHaveBeenCalledWith({
      service: 'service-a',
      timestamp: { $gte: fromDate, $lte: toDate },
    });
    expect(findChain.sort).toHaveBeenCalledWith({ timestamp: 1 });
    expect(execMock).toHaveBeenCalled();
    expect(result).toEqual(logs);
  });

  it('should delete logs older than the given threshold', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2024-05-15T12:00:00.000Z'));

    logModelMock.deleteMany.mockResolvedValue({ deletedCount: 7 });

    const deleted = await service.deleteOldLogs(5);

    const expectedCutoff = new Date('2024-05-10T12:00:00.000Z');
    expect(logModelMock.deleteMany).toHaveBeenCalledWith({
      timestamp: { $lt: expectedCutoff },
    });
    expect(deleted).toBe(7);

    jest.useRealTimers();
  });
});
