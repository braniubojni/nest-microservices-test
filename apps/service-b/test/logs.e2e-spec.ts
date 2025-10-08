import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ServiceBModule } from '../src/service-b.module';
import { RedisTimeSeriesService } from '@app/shared/redis-time-series/redis-time-series.service';
import { sleep } from '@app/shared/common/utils';

describe('Logs (e2e)', () => {
  let app: INestApplication;
  let redisService: RedisTimeSeriesService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ServiceBModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.enableCors();
    redisService = moduleFixture.get(RedisTimeSeriesService);
    await app.init();
  });

  afterAll(async () => {
    await sleep(100);
    await app.close();
  });

  async function getTotalRequests(service: string): Promise<number> {
    const result = await redisService.getRequestCount(
      service,
      Date.now() - 1000,
      Date.now() + 1000,
    );
    return result.length;
  }

  it('should query logs with pagination', async () => {
    const beforeCount = await getTotalRequests('service-b');
    const response = await request(app.getHttpServer())
      .get('/logs')
      .query({ page: 1, limit: 10 })
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pagination');
    expect(Array.isArray(response.body.data)).toBe(true);

    const afterCount = await getTotalRequests('service-b');
    expect(afterCount).toBe(beforeCount + 1);
  });

  it('should query logs by service', async () => {
    const beforeCount = await getTotalRequests('service-b');
    const response = await request(app.getHttpServer())
      .get('/logs')
      .query({ service: 'service-a', page: 1, limit: 10 })
      .expect(200);

    expect(
      response.body.data.every((log: any) => log.service === 'service-a'),
    ).toBe(true);

    const afterCount = await getTotalRequests('service-b');
    expect(afterCount).toBe(beforeCount + 1);
  });

  it('should query logs by type', async () => {
    const beforeCount = await getTotalRequests('service-b');
    const response = await request(app.getHttpServer())
      .get('/logs')
      .query({ type: 'request', page: 1, limit: 10 })
      .expect(200);

    expect(response.body.data.every((log: any) => log.type === 'request')).toBe(
      true,
    );

    const afterCount = await getTotalRequests('service-b');
    expect(afterCount).toBe(beforeCount + 1);
  });

  it('should get log statistics', async () => {
    const beforeCount = await getTotalRequests('service-b');
    const response = await request(app.getHttpServer())
      .get('/logs/statistics')
      .query({ service: 'service-a' })
      .expect(200);

    expect(response.body).toHaveProperty('topSlowEndpoints');
    expect(response.body).toHaveProperty('overview');

    const afterCount = await getTotalRequests('service-b');
    expect(afterCount).toBe(beforeCount + 1);
  });

  it('should get count by type', async () => {
    const beforeCount = await getTotalRequests('service-b');
    const response = await request(app.getHttpServer())
      .get('/logs/count-by-type')
      .query({ service: 'service-a' })
      .expect(200);

    expect(response.body).toHaveProperty('service');
    expect(response.body).toHaveProperty('counts');

    const afterCount = await getTotalRequests('service-b');
    expect(afterCount).toBe(beforeCount + 1);
  });
});
