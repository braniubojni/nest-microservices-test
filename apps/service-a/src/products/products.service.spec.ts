import { Product } from '@app/shared/schemas/product.schema';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { SearchProductsDto } from './dto/product.dto';

type MockModel = {
  find: jest.Mock;
  countDocuments: jest.Mock;
};

const createQueryChain = (products: Product[]) => {
  const execMock = jest.fn().mockResolvedValue(products);
  const limitMock = jest.fn().mockReturnValue({ exec: execMock });
  const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
  const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

  return {
    query: { sort: sortMock },
    sortMock,
    skipMock,
    limitMock,
    execMock,
  } as const;
};

describe('ProductsService', () => {
  let service: ProductsService;
  let productModel: MockModel;

  beforeEach(async () => {
    productModel = {
      find: jest.fn(),
      countDocuments: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getModelToken(Product.name),
          useValue: productModel,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('search', () => {
    it('should query products with defaults when no filters provided', async () => {
      const mockProducts = [
        { _id: '1', title: 'Product A' },
        { _id: '2', title: 'Product B' },
      ] as unknown as Product[];
      const total = 2;
      const { query, sortMock, skipMock, limitMock } =
        createQueryChain(mockProducts);

      productModel.find.mockReturnValue(query);
      productModel.countDocuments.mockResolvedValue(total);

      const result = await service.search({} as SearchProductsDto);

      expect(productModel.find).toHaveBeenCalledWith({});
      expect(productModel.countDocuments).toHaveBeenCalledWith({});
      expect(sortMock).toHaveBeenCalledWith({});
      expect(skipMock).toHaveBeenCalledWith(0);
      expect(limitMock).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: mockProducts,
        pagination: {
          page: 1,
          limit: 10,
          total,
          totalPages: 1,
        },
      });
    });

    it('should apply text search filter when search term provided', async () => {
      const mockProducts = [
        { _id: '1', title: 'Product C' },
      ] as unknown as Product[];
      const total = 1;
      const { query } = createQueryChain(mockProducts);

      productModel.find.mockReturnValue(query);
      productModel.countDocuments.mockResolvedValue(total);

      const searchTerm = 'phone';
      await service.search({ search: searchTerm } as SearchProductsDto);

      const expectedFilter = { $text: { $search: searchTerm } };
      expect(productModel.find).toHaveBeenCalledWith(expectedFilter);
      expect(productModel.countDocuments).toHaveBeenCalledWith(expectedFilter);
    });

    it('should apply category and brand filters', async () => {
      const mockProducts = [
        { _id: '1', title: 'Product D' },
      ] as unknown as Product[];
      const { query } = createQueryChain(mockProducts);

      productModel.find.mockReturnValue(query);
      productModel.countDocuments.mockResolvedValue(mockProducts.length);

      const filters: SearchProductsDto = {
        category: 'smartphones',
        brand: 'Apple',
      } as SearchProductsDto;

      await service.search(filters);

      expect(productModel.find).toHaveBeenCalledWith({
        category: 'smartphones',
        brand: 'Apple',
      });
      expect(productModel.countDocuments).toHaveBeenCalledWith({
        category: 'smartphones',
        brand: 'Apple',
      });
    });

    it.each([
      [{ minPrice: 100 }, { price: { $gte: 100 } }],
      [{ maxPrice: 500 }, { price: { $lte: 500 } }],
      [{ minPrice: 100, maxPrice: 500 }, { price: { $gte: 100, $lte: 500 } }],
    ])('should apply price filters %o', async (input, expected) => {
      const mockProducts = [
        { _id: '1', title: 'Product E' },
      ] as unknown as Product[];
      const { query } = createQueryChain(mockProducts);

      productModel.find.mockReturnValue(query);
      productModel.countDocuments.mockResolvedValue(mockProducts.length);

      await service.search(input as SearchProductsDto);

      expect(productModel.find).toHaveBeenCalledWith(expected);
      expect(productModel.countDocuments).toHaveBeenCalledWith(expected);
    });

    it('should apply pagination and sorting correctly', async () => {
      const mockProducts = [
        { _id: '1', title: 'Product F' },
      ] as unknown as Product[];
      const total = 42;
      const { query, sortMock, skipMock, limitMock } =
        createQueryChain(mockProducts);

      productModel.find.mockReturnValue(query);
      productModel.countDocuments.mockResolvedValue(total);

      const dto: SearchProductsDto = {
        page: 3,
        limit: 5,
        sortBy: 'price',
        sortOrder: 'asc',
      } as SearchProductsDto;

      const result = await service.search(dto);

      expect(sortMock).toHaveBeenCalledWith({ price: 1 });
      expect(skipMock).toHaveBeenCalledWith(10);
      expect(limitMock).toHaveBeenCalledWith(5);
      expect(result.pagination).toEqual({
        page: 3,
        limit: 5,
        total,
        totalPages: 9,
      });
    });
  });
});
