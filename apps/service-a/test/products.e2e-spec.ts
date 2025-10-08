import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ServiceAModule } from '../src/service-a.module';

describe('Products (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ServiceAModule],
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

  it('should search products with pagination', async () => {
    const response = await request(app.getHttpServer())
      .get('/products/search')
      .query({ page: 1, limit: 10 })
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pagination');
    expect(Array.isArray(response.body.data)).toBe(true);
    expect(response.body.pagination).toHaveProperty('page', 1);
    expect(response.body.pagination).toHaveProperty('limit', 10);
    expect(response.body.pagination).toHaveProperty('total');
    expect(response.body.pagination).toHaveProperty('totalPages');
  });

  it('should search products by category', async () => {
    const response = await request(app.getHttpServer())
      .get('/products/search')
      .query({ category: 'beauty', page: 1, limit: 5 })
      .expect(200);

    expect(
      response.body.data.every((product: any) => product.category === 'beauty'),
    ).toBe(true);
  });

  it('should search products by brand', async () => {
    const response = await request(app.getHttpServer())
      .get('/products/search')
      .query({ brand: 'Essence', page: 1, limit: 5 })
      .expect(200);

    expect(
      response.body.data.every((product: any) => product.brand === 'Essence'),
    ).toBe(true);
  });

  it('should search products by price range', async () => {
    const response = await request(app.getHttpServer())
      .get('/products/search')
      .query({ minPrice: 5, maxPrice: 100, page: 1, limit: 10 })
      .expect(200);

    expect(
      response.body.data.every(
        (product: any) => product.price >= 5 && product.price <= 100,
      ),
    ).toBe(true);
  });

  it('should search products with text search', async () => {
    const response = await request(app.getHttpServer())
      .get('/products/search')
      .query({ search: 'Mascara', page: 1, limit: 5 })
      .expect(200);

    // If there are results, ensure they match the search term
    if (response.body.data.length > 0) {
      expect(
        response.body.data.every(
          (product: any) =>
            product.title.includes('Mascara') ||
            (product.description && product.description.includes('Mascara')),
        ),
      ).toBe(true);
    }
  });

  it('should sort products', async () => {
    const response = await request(app.getHttpServer())
      .get('/products/search')
      .query({ sortBy: 'price', sortOrder: 'asc', page: 1, limit: 10 })
      .expect(200);

    const prices = response.body.data.map((p: any) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(response.body.data[0].price).toBe(Math.min(...prices));
    expect(response.body.data.at(-1).price).toBe(Math.max(...prices));
  });
});
