import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { ServiceBModule } from '../src/service-b.module';

describe('Reports (e2e)', () => {
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

  it('should generate PDF report', async () => {
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
  });

  it('should preview report data', async () => {
    const response = await request(app.getHttpServer())
      .get('/reports/preview')
      .query({ service: 'service-a', period: '1h' })
      .expect(200);

    expect(response.body).toHaveProperty('message');
    expect(response.body).toHaveProperty('query');
  });
});
