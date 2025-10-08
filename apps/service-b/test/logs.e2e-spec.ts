import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ServiceBModule } from '../src/service-b.module';

describe('Logs (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ServiceBModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.enableCors();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should query logs with pagination', async () => {
    const response = await request(app.getHttpServer())
      .get('/logs')
      .query({ page: 1, limit: 10 })
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pagination');
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('should query logs by service', async () => {
    const response = await request(app.getHttpServer())
      .get('/logs')
      .query({ service: 'service-a', page: 1, limit: 10 })
      .expect(200);

    expect(
      response.body.data.every((log: any) => log.service === 'service-a'),
    ).toBe(true);
  });

  it('should query logs by type', async () => {
    const response = await request(app.getHttpServer())
      .get('/logs')
      .query({ type: 'request', page: 1, limit: 10 })
      .expect(200);

    expect(response.body.data.every((log: any) => log.type === 'request')).toBe(
      true,
    );
  });

  it('should get log statistics', async () => {
    const response = await request(app.getHttpServer())
      .get('/logs/statistics')
      .query({ service: 'service-a' })
      .expect(200);

    expect(response.body).toHaveProperty('totalLogs');
    expect(response.body).toHaveProperty('overview');
  });

  it('should get count by type', async () => {
    const response = await request(app.getHttpServer())
      .get('/logs/count-by-type')
      .query({ service: 'service-a' })
      .expect(200);

    expect(response.body).toHaveProperty('service');
    expect(response.body).toHaveProperty('counts');
  });
});
