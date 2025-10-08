import { Test, TestingModule } from '@nestjs/testing';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { SearchProductsDto } from './dto/product.dto';
import { RedisTimeSeriesService } from '../../../../libs/shared/src/redis-time-series/redis-time-series.service';

type ProductsServiceMock = {
  search: jest.Mock;
};

describe('ProductsController', () => {
  let controller: ProductsController;
  let service: ProductsServiceMock;

  beforeEach(async () => {
    service = {
      search: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [
        {
          provide: ProductsService,
          useValue: service,
        },
        {
          provide: RedisTimeSeriesService,
          useValue: {
            publishApiEvent: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should call service.search with provided search DTO', async () => {
      const searchDto: SearchProductsDto = {
        search: 'laptop',
        category: 'electronics',
        page: 1,
        limit: 10,
      } as SearchProductsDto;

      const mockResult = {
        data: [
          { _id: '1', title: 'Laptop A', price: 999 },
          { _id: '2', title: 'Laptop B', price: 1299 },
        ],
        pagination: {
          page: 1,
          limit: 10,
          total: 2,
          totalPages: 1,
        },
      };

      service.search.mockResolvedValue(mockResult);

      const result = await controller.search(searchDto);

      expect(service.search).toHaveBeenCalledWith(searchDto);
      expect(result).toEqual(mockResult);
    });

    it('should handle empty search results', async () => {
      const searchDto: SearchProductsDto = {
        search: 'nonexistent',
      } as SearchProductsDto;

      const mockResult = {
        data: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      };

      service.search.mockResolvedValue(mockResult);

      const result = await controller.search(searchDto);

      expect(service.search).toHaveBeenCalledWith(searchDto);
      expect(result).toEqual(mockResult);
    });

    it('should apply filters correctly', async () => {
      const searchDto: SearchProductsDto = {
        category: 'smartphones',
        brand: 'Apple',
        minPrice: 500,
        maxPrice: 1500,
        sortBy: 'price',
        sortOrder: 'asc',
      } as SearchProductsDto;

      const mockResult = {
        data: [{ _id: '1', title: 'iPhone 13', price: 799 }],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      service.search.mockResolvedValue(mockResult);

      const result = await controller.search(searchDto);

      expect(service.search).toHaveBeenCalledWith(searchDto);
      expect(result).toEqual(mockResult);
    });

    it('should handle pagination parameters', async () => {
      const searchDto: SearchProductsDto = {
        page: 3,
        limit: 20,
      } as SearchProductsDto;

      const mockResult = {
        data: [],
        pagination: {
          page: 3,
          limit: 20,
          total: 100,
          totalPages: 5,
        },
      };

      service.search.mockResolvedValue(mockResult);

      const result = await controller.search(searchDto);

      expect(service.search).toHaveBeenCalledWith(searchDto);
      expect(result).toEqual(mockResult);
    });

    it('should propagate service errors', async () => {
      const searchDto: SearchProductsDto = {} as SearchProductsDto;
      const error = new Error('Database connection failed');

      service.search.mockRejectedValue(error);

      await expect(controller.search(searchDto)).rejects.toThrow(
        'Database connection failed',
      );
      expect(service.search).toHaveBeenCalledWith(searchDto);
    });
  });
});
