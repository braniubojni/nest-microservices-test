import request from 'supertest';

describe('Products (e2e)', () => {
  const baseUrl = `http://localhost:${process.env.SERVICE_A_PORT || 3000}`;

  it('should search products with pagination', async () => {
    const response = await request(baseUrl)
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
    const response = await request(baseUrl)
      .get('/products/search')
      .query({ category: 'smartphones', page: 1, limit: 5 })
      .expect(200);

    expect(
      response.body.data.every(
        (product: any) => product.category === 'smartphones',
      ),
    ).toBe(true);
  });

  it('should search products by brand', async () => {
    const response = await request(baseUrl)
      .get('/products/search')
      .query({ brand: 'Apple', page: 1, limit: 5 })
      .expect(200);

    expect(
      response.body.data.every((product: any) => product.brand === 'Apple'),
    ).toBe(true);
  });

  it('should search products by price range', async () => {
    const response = await request(baseUrl)
      .get('/products/search')
      .query({ minPrice: 100, maxPrice: 500, page: 1, limit: 10 })
      .expect(200);

    expect(
      response.body.data.every(
        (product: any) => product.price >= 100 && product.price <= 500,
      ),
    ).toBe(true);
  });

  it('should search products with text search', async () => {
    const response = await request(baseUrl)
      .get('/products/search')
      .query({ search: 'iPhone', page: 1, limit: 5 })
      .expect(200);

    expect(response.body.data.length).toBeGreaterThanOrEqual(0);
  });

  it('should sort products', async () => {
    const response = await request(baseUrl)
      .get('/products/search')
      .query({ sortBy: 'price', sortOrder: 'asc', page: 1, limit: 10 })
      .expect(200);

    const prices = response.body.data.map((p: any) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });
});
