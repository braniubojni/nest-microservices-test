import request from 'supertest';

describe('Logs (e2e)', () => {
  const serviceAUrl = `http://localhost:${process.env.SERVICE_A_PORT || 3000}`;
  const serviceBUrl = `http://localhost:${process.env.SERVICE_B_PORT || 5001}`;

  beforeAll(async () => {
    // Trigger some API calls in service A to generate logs
    await request(serviceAUrl)
      .get('/products/search')
      .query({ page: 1, limit: 5 });

    await request(serviceAUrl)
      .post('/data-import/fetch-and-save')
      .query({ format: 'json', limit: 2 });

    // Wait a bit for logs to be stored
    await new Promise((resolve) => setTimeout(resolve, 1000));
  });

  it('should query logs with pagination', async () => {
    const response = await request(serviceBUrl)
      .get('/logs')
      .query({ page: 1, limit: 10 })
      .expect(200);

    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('pagination');
    expect(Array.isArray(response.body.data)).toBe(true);
  });

  it('should query logs by service', async () => {
    const response = await request(serviceBUrl)
      .get('/logs')
      .query({ service: 'service-a', page: 1, limit: 10 })
      .expect(200);

    expect(
      response.body.data.every((log: any) => log.service === 'service-a'),
    ).toBe(true);
  });

  it('should query logs by type', async () => {
    const response = await request(serviceBUrl)
      .get('/logs')
      .query({ type: 'request', page: 1, limit: 10 })
      .expect(200);

    expect(response.body.data.every((log: any) => log.type === 'request')).toBe(
      true,
    );
  });

  it('should get log statistics', async () => {
    const response = await request(serviceBUrl)
      .get('/logs/statistics')
      .query({ service: 'service-a' })
      .expect(200);

    expect(response.body).toHaveProperty('totalLogs');
    expect(response.body).toHaveProperty('overview');
  });

  it('should get count by type', async () => {
    const response = await request(serviceBUrl)
      .get('/logs/count-by-type')
      .query({ service: 'service-a' })
      .expect(200);

    expect(response.body).toHaveProperty('service');
    expect(response.body).toHaveProperty('counts');
  });
});
