import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import fs from 'fs';
import path from 'path';
import request from 'supertest';
import { ServiceAModule } from '../src/service-a.module';
import { RedisTimeSeriesService } from '@app/shared/redis-time-series/redis-time-series.service';

describe('DataImport (e2e)', () => {
  let app: INestApplication;
  let redisService: RedisTimeSeriesService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ServiceAModule],
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
    await app.close();
  });

  afterEach(async () => {
    await redisService.cleanup();
  });

  async function getTotalRequests(service: string): Promise<number> {
    const result = await redisService.getRequestCount(
      service,
      Date.now() - 1000,
      Date.now() + 1000,
    );
    return result.length;
  }

  it('should fetch data from API and save to JSON file', async () => {
    const beforeCount = await getTotalRequests('service-a');
    const limit = 2;
    const response = await request(app.getHttpServer())
      .post('/data-import/fetch-and-save')
      .query({ format: 'json', limit })
      .expect(200);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain(
      `${limit} products fetched and saved`,
    );
    expect(response.body).toHaveProperty('filePath');
    expect(response.body.filePath).toMatch(/\.json$/);

    // Check if file exists
    const fileExists = fs.existsSync(
      path.join(process.cwd(), response.body.filePath),
    );
    expect(fileExists).toBe(true);

    const afterCount = await getTotalRequests('service-a');
    expect(afterCount).toBeGreaterThan(beforeCount);
  });

  it('should fetch data from API and save to Excel file', async () => {
    const beforeCount = await getTotalRequests('service-a');
    const limit = 2;
    const response = await request(app.getHttpServer())
      .post('/data-import/fetch-and-save')
      .query({ format: 'excel', limit })
      .expect(200);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain(
      `${limit} products fetched and saved`,
    );
    expect(response.body).toHaveProperty('filePath');
    expect(response.body.filePath).toMatch(/\.xlsx$/);

    // Check if file exists
    const fileExists = fs.existsSync(
      path.join(process.cwd(), response.body.filePath),
    );
    expect(fileExists).toBe(true);

    const afterCount = await getTotalRequests('service-a');
    expect(afterCount).toBe(beforeCount + 1);
  });

  it('should upload and import JSON file into MongoDB', async () => {
    const beforeCount = await getTotalRequests('service-a');
    // First, create a sample JSON file
    const sampleData = [
      {
        id: Math.floor(Math.random() * 100000),
        title: 'Essence Mascara Lash Princess',
        description:
          'The Essence Mascara Lash Princess is a popular mascara known for its volumizing and lengthening effects. Achieve dramatic lashes with this long-lasting and cruelty-free formula.',
        category: 'beauty',
        price: 9.99,
        discountPercentage: 10.48,
        rating: 2.56,
        stock: 99,
        tags: ['beauty', 'mascara'],
        brand: 'Essence',
        sku: 'BEA-ESS-ESS-001',
        weight: 4,
        dimensions: {
          width: 15.14,
          height: 13.08,
          depth: 22.99,
        },
        warrantyInformation: '1 week warranty',
        shippingInformation: 'Ships in 3-5 business days',
        availabilityStatus: 'In Stock',
        reviews: [
          {
            rating: 3,
            comment: 'Would not recommend!',
            date: '2025-04-30T09:41:02.053Z',
            reviewerName: 'Eleanor Collins',
            reviewerEmail: 'eleanor.collins@x.dummyjson.com',
          },
          {
            rating: 4,
            comment: 'Very satisfied!',
            date: '2025-04-30T09:41:02.053Z',
            reviewerName: 'Lucas Gordon',
            reviewerEmail: 'lucas.gordon@x.dummyjson.com',
          },
          {
            rating: 5,
            comment: 'Highly impressed!',
            date: '2025-04-30T09:41:02.053Z',
            reviewerName: 'Eleanor Collins',
            reviewerEmail: 'eleanor.collins@x.dummyjson.com',
          },
        ],
        returnPolicy: 'No return policy',
        minimumOrderQuantity: 48,
        meta: {
          createdAt: '2025-04-30T09:41:02.053Z',
          updatedAt: '2025-04-30T09:41:02.053Z',
          barcode: '5784719087687',
          qrCode: 'https://cdn.dummyjson.com/public/qr-code.png',
        },
        images: [
          'https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/1.webp',
        ],
        thumbnail:
          'https://cdn.dummyjson.com/product-images/beauty/essence-mascara-lash-princess/thumbnail.webp',
      },
    ];
    const filePath = path.join(process.cwd(), 'data', 'test-upload.json');
    fs.writeFileSync(filePath, JSON.stringify(sampleData));

    const response = await request(app.getHttpServer())
      .post('/data-import/upload-and-import')
      .attach('file', filePath)
      .expect(201);

    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toContain(
      'File processed and imported successfully',
    );
    expect(response.body).toHaveProperty('inserted');
    expect(response.body.inserted).toBeGreaterThan(0);

    // Clean up
    fs.unlinkSync(filePath);

    const afterCount = await getTotalRequests('service-a');
    expect(afterCount).toBe(beforeCount + 1);
  });

  it('should upload and import Excel file into MongoDB', async () => {
    const beforeCount = await getTotalRequests('service-a');
    const exampleFile = fs
      .readdirSync(path.join(process.cwd(), 'data'))
      .find((f) => f.startsWith('products-') && f.endsWith('.xlsx'));

    const excelPath = path.join(process.cwd(), 'data', exampleFile || 'null');
    if (fs.existsSync(excelPath)) {
      const response = await request(app.getHttpServer())
        .post('/data-import/upload-and-import')
        .attach('file', excelPath)
        .expect(201);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain(
        'File processed and imported successfully',
      );

      const afterCount = await getTotalRequests('service-a');
      expect(afterCount).toBe(beforeCount + 1);
    }
  });

  it('should list saved files', async () => {
    const beforeCount = await getTotalRequests('service-a');
    const response = await request(app.getHttpServer())
      .get('/data-import/saved-files')
      .expect(200);

    expect(Array.isArray(response.body.files)).toBe(true);
    expect(response.body.count).toBeGreaterThan(0);

    const afterCount = await getTotalRequests('service-a');
    expect(afterCount).toBe(beforeCount + 1);
  });
});
