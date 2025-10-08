import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { ServiceBModule } from '../src/service-b.module';
import { RedisTimeSeriesService } from '@app/shared/redis-time-series/redis-time-series.service';
import { sleep } from '@app/shared/common/utils';

describe('Reports (e2e)', () => {
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

  it('should generate PDF report', async () => {
    const beforeCount = await getTotalRequests('service-b');
    const response = await request(app.getHttpServer())
      .get('/reports/pdf')
      .query({ service: 'service-a', period: '1h' })
      .expect(200);

    expect(response.headers['content-type']).toBe('application/pdf');
    expect(response.headers['content-disposition']).toContain(
      'attachment; filename=',
    );

    // Save the PDF to check
    const filePath = path.join(process.cwd(), 'test-report.pdf');
    fs.writeFileSync(filePath, response.body);

    // Check if file is PDF
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.statSync(filePath).size).toBeGreaterThan(0);

    // Clean up
    fs.unlinkSync(filePath);

    const afterCount = await getTotalRequests('service-b');
    expect(afterCount).toBeGreaterThan(beforeCount);
  });

  it('should preview report data', async () => {
    const beforeCount = await getTotalRequests('service-b');
    const response = await request(app.getHttpServer())
      .get('/reports/preview')
      .query({ service: 'service-a', period: '1h' })
      .expect(200);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('query');

    const afterCount = await getTotalRequests('service-b');
    expect(afterCount).toBeGreaterThan(beforeCount);
  });
});
