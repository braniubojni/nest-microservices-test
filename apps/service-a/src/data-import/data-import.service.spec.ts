import { HttpService } from '@nestjs/axios';
import { BadRequestException, Logger } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { Product } from '@app/shared/schemas/product.schema';
import { DataImportService } from './data-import.service';
import { lastValueFrom } from 'rxjs';

type MockModel = {
  updateOne: jest.Mock;
};

type HttpServiceMock = {
  get: jest.Mock;
};

const mkdirMock = jest.fn();
const writeFileMock = jest.fn();
const readFileMock = jest.fn();
const readdirMock = jest.fn();
const statMock = jest.fn();
const unlinkMock = jest.fn();

jest.mock('fs/promises', () => ({
  mkdir: (...args: unknown[]) => mkdirMock(...args),
  writeFile: (...args: unknown[]) => writeFileMock(...args),
  readFile: (...args: unknown[]) => readFileMock(...args),
  readdir: (...args: unknown[]) => readdirMock(...args),
  stat: (...args: unknown[]) => statMock(...args),
  unlink: (...args: unknown[]) => unlinkMock(...args),
}));

const jsonToSheetMock = jest.fn();
const bookNewMock = jest.fn();
const bookAppendSheetMock = jest.fn();
const writeXlsxFileMock = jest.fn();

jest.mock('xlsx', () => ({
  utils: {
    json_to_sheet: (...args: unknown[]) => jsonToSheetMock(...args),
    book_new: (...args: unknown[]) => bookNewMock(...args),
    book_append_sheet: (...args: unknown[]) => bookAppendSheetMock(...args),
  },
  writeFile: (...args: unknown[]) => writeXlsxFileMock(...args),
}));

jest.mock('csv-parse/sync', () => ({
  parse: jest.fn(),
}));

jest.mock('rxjs', () => {
  const actual = jest.requireActual<typeof import('rxjs')>('rxjs');
  return {
    ...actual,
    lastValueFrom: jest.fn(),
  };
});

describe('DataImportService', () => {
  let service: DataImportService;
  let productModel: MockModel;
  let httpService: HttpServiceMock;
  const mockedLastValueFrom = lastValueFrom as jest.MockedFunction<
    typeof lastValueFrom
  >;

  beforeAll(() => {
    process.env.EXTERNAL_API_URL = 'https://dummyjson.com/products';
  });

  beforeEach(async () => {
    jest.clearAllMocks();

    // Suppress Logger output in tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    mkdirMock.mockResolvedValue(undefined);
    writeFileMock.mockResolvedValue(undefined);
    readFileMock.mockResolvedValue('');
    readdirMock.mockResolvedValue([]);
    statMock.mockResolvedValue(undefined);
    unlinkMock.mockResolvedValue(undefined);

    bookNewMock.mockReturnValue({});
    jsonToSheetMock.mockReturnValue('worksheet');

    productModel = {
      updateOne: jest.fn().mockResolvedValue({
        upsertedCount: 1,
        modifiedCount: 0,
      }),
    };

    httpService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DataImportService,
        {
          provide: getModelToken(Product.name),
          useValue: productModel,
        },
        {
          provide: HttpService,
          useValue: httpService,
        },
      ],
    }).compile();

    service = module.get<DataImportService>(DataImportService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('fetchAndSaveData', () => {
    it('saves fetched products as JSON', async () => {
      const timestamp = 1717171717;
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(timestamp);
      const observableToken = Symbol('observable');
      const products = [{ id: 1, title: 'Product' }];

      httpService.get.mockReturnValue(observableToken);
      mockedLastValueFrom.mockResolvedValue({ data: { products } });

      const result = await service.fetchAndSaveData('json', 25);

      expect(httpService.get).toHaveBeenCalledWith(
        `${process.env.EXTERNAL_API_URL}?limit=25`,
      );
      expect(mockedLastValueFrom).toHaveBeenCalledWith(observableToken);
      expect(writeFileMock).toHaveBeenCalledWith(
        `./data/products-${timestamp}.json`,
        JSON.stringify(products, null, 2),
      );
      expect(result).toEqual({
        success: true,
        message: `${products.length} products fetched and saved`,
        format: 'json',
        filePath: `/data/products-${timestamp}.json`,
        productsCount: products.length,
      });

      dateSpy.mockRestore();
    });

    it('saves fetched products as Excel', async () => {
      const timestamp = 1919191919;
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(timestamp);
      const observableToken = Symbol('observable');
      const worksheet = { A1: 'value' };
      const workbook = { Sheets: {} };
      const products = [{ id: 2, title: 'Product 2' }];

      jsonToSheetMock.mockReturnValue(worksheet);
      bookNewMock.mockReturnValue(workbook);
      httpService.get.mockReturnValue(observableToken);
      mockedLastValueFrom.mockResolvedValue({ data: { products } });

      const result = await service.fetchAndSaveData('excel', 10);

      expect(jsonToSheetMock).toHaveBeenCalledWith(products);
      expect(bookAppendSheetMock).toHaveBeenCalledWith(
        workbook,
        worksheet,
        'Products',
      );
      expect(writeXlsxFileMock).toHaveBeenCalledWith(
        workbook,
        `./data/products-${timestamp}.xlsx`,
      );
      expect(result).toEqual({
        success: true,
        message: `${products.length} products fetched and saved`,
        format: 'excel',
        filePath: `/data/products-${timestamp}.xlsx`,
        productsCount: products.length,
      });

      dateSpy.mockRestore();
    });

    it('throws BadRequestException when fetch fails', async () => {
      const observableToken = Symbol('observable');
      httpService.get.mockReturnValue(observableToken);
      mockedLastValueFrom.mockRejectedValue(new Error('network error'));

      await expect(service.fetchAndSaveData('json', 10)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('parseAndImportFile', () => {
    const mockImportResult = {
      total: 1,
      inserted: 1,
      updated: 0,
      failed: 0,
      errors: [],
    };

    beforeEach(() => {
      unlinkMock.mockResolvedValue(undefined);
    });

    it.each([
      ['json', 'parseJsonFile'],
      ['xlsx', 'parseExcelFile'],
      ['csv', 'parseCsvFile'],
    ])(
      'processes %s file and imports products',
      async (extension, parserMethod) => {
        const products = [{ id: 1 }];
        const parseSpy = jest
          .spyOn(service as any, parserMethod)
          .mockResolvedValue(products);
        const importSpy = jest
          .spyOn(service as any, 'importProducts')
          .mockResolvedValue(mockImportResult);

        const file = {
          originalname: `products.${extension}`,
          path: `/tmp/products.${extension}`,
        } as unknown as Express.Multer.File;

        const result = await service.parseAndImportFile(file);

        expect(parseSpy).toHaveBeenCalledWith(file.path);
        expect(importSpy).toHaveBeenCalledWith(products);
        expect(unlinkMock).toHaveBeenCalledWith(file.path);
        expect(result).toEqual({
          success: true,
          message: 'File processed and imported successfully',
          fileName: file.originalname,
          ...mockImportResult,
        });

        parseSpy.mockRestore();
        importSpy.mockRestore();
      },
    );

    it('throws BadRequestException for unsupported file types', async () => {
      const file = {
        originalname: 'products.txt',
        path: '/tmp/products.txt',
      } as unknown as Express.Multer.File;

      await expect(service.parseAndImportFile(file)).rejects.toThrow(
        BadRequestException,
      );

      expect(unlinkMock).toHaveBeenCalledWith(file.path);
    });

    it('propagates errors from parsers and cleans up file', async () => {
      const file = {
        originalname: 'products.json',
        path: '/tmp/products.json',
      } as unknown as Express.Multer.File;

      const parseSpy = jest
        .spyOn(service as any, 'parseJsonFile')
        .mockRejectedValue(new Error('invalid data'));

      await expect(service.parseAndImportFile(file)).rejects.toThrow(
        'Failed to process file: invalid data',
      );

      expect(parseSpy).toHaveBeenCalledWith(file.path);
      expect(unlinkMock).toHaveBeenCalledWith(file.path);

      parseSpy.mockRestore();
    });
  });

  describe('listSavedFiles', () => {
    it('returns sorted list of saved product files', async () => {
      const files = ['products-1.json', 'note.txt', 'products-2.json'];
      readdirMock.mockResolvedValue(files);

      const statsMap: Record<string, { size: number; birthtime: Date }> = {
        './data/products-1.json': {
          size: 100,
          birthtime: new Date('2024-01-01T00:00:00Z'),
        },
        './data/products-2.json': {
          size: 200,
          birthtime: new Date('2024-02-01T00:00:00Z'),
        },
      };

      statMock.mockImplementation(async (path: string) => {
        if (!(path in statsMap)) {
          throw new Error(`Unexpected path ${path}`);
        }
        return statsMap[path];
      });

      const result = await service.listSavedFiles();

      expect(readdirMock).toHaveBeenCalledWith('./data');
      expect(statMock).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        files: [
          {
            name: 'products-2.json',
            size: 200,
            created: statsMap['./data/products-2.json'].birthtime,
            path: '/data/products-2.json',
          },
          {
            name: 'products-1.json',
            size: 100,
            created: statsMap['./data/products-1.json'].birthtime,
            path: '/data/products-1.json',
          },
        ],
        count: 2,
      });
    });

    it('returns empty result when listing fails', async () => {
      const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error');
      readdirMock.mockRejectedValue(new Error('disk error'));

      const result = await service.listSavedFiles();

      expect(loggerErrorSpy).toHaveBeenCalled();
      expect(result).toEqual({ files: [], count: 0 });
    });
  });
});
