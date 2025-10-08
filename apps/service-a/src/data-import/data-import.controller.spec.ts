import { Test, TestingModule } from '@nestjs/testing';
import { DataImportController } from './data-import.controller';
import { DataImportService } from './data-import.service';
import { FetchAndSaveDto } from './dto/fetchAndSave.dto';

jest.mock(
  '@app/shared/redis-time-series/decorators/track-api.decorator',
  () => ({
    TrackApi: () => () => undefined,
  }),
);

type DataImportServiceMock = {
  fetchAndSaveData: jest.Mock;
  parseAndImportFile: jest.Mock;
  listSavedFiles: jest.Mock;
};

describe('DataImportController', () => {
  let controller: DataImportController;
  let service: DataImportServiceMock;

  beforeEach(async () => {
    service = {
      fetchAndSaveData: jest.fn(),
      parseAndImportFile: jest.fn(),
      listSavedFiles: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DataImportController],
      providers: [
        {
          provide: DataImportService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<DataImportController>(DataImportController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchAndSave', () => {
    it('should fetch and save data with default parameters', async () => {
      const mockResult = {
        success: true,
        message: '100 products fetched and saved',
        format: 'json',
        filePath: '/data/products-123.json',
        productsCount: 100,
      };

      service.fetchAndSaveData.mockResolvedValue(mockResult);

      const dto = new FetchAndSaveDto();
      dto.format = 'excel';

      const result = await controller.fetchAndSave(dto, 50);

      expect(service.fetchAndSaveData).toHaveBeenCalledWith(dto.format, 50);
      expect(result).toEqual(mockResult);
    });

    it('should fetch and save data in JSON format', async () => {
      const mockResult = {
        success: true,
        message: '50 products fetched and saved',
        format: 'json',
        filePath: '/data/products-456.json',
        productsCount: 50,
      };

      service.fetchAndSaveData.mockResolvedValue(mockResult);
      const dto = new FetchAndSaveDto();
      dto.format = 'json';

      const result = await controller.fetchAndSave(dto, 50);

      expect(service.fetchAndSaveData).toHaveBeenCalledWith('json', 50);
      expect(result).toEqual(mockResult);
    });

    it('should fetch and save data in Excel format', async () => {
      const mockResult = {
        success: true,
        message: '25 products fetched and saved',
        format: 'excel',
        filePath: '/data/products-789.xlsx',
        productsCount: 25,
      };

      service.fetchAndSaveData.mockResolvedValue(mockResult);
      const dto = new FetchAndSaveDto();
      dto.format = 'excel';

      const result = await controller.fetchAndSave(dto, 25);

      expect(service.fetchAndSaveData).toHaveBeenCalledWith('excel', 25);
      expect(result).toEqual(mockResult);
    });

    it('should handle service errors', async () => {
      const error = new Error('Network error');
      service.fetchAndSaveData.mockRejectedValue(error);
      const dto = new FetchAndSaveDto();
      dto.format = 'json';

      await expect(controller.fetchAndSave(dto, 10)).rejects.toThrow(
        'Network error',
      );
      expect(service.fetchAndSaveData).toHaveBeenCalledWith('json', 10);
    });
  });

  describe('uploadAndImport', () => {
    it('should upload and import a JSON file', async () => {
      const mockFile = {
        originalname: 'products.json',
        path: '/tmp/upload-123.json',
        fieldname: 'file',
        mimetype: 'application/json',
        size: 1024,
      } as Express.Multer.File;

      const mockResult = {
        success: true,
        message: 'File processed and imported successfully',
        fileName: 'products.json',
        total: 10,
        inserted: 8,
        updated: 2,
        failed: 0,
        errors: [],
      };

      service.parseAndImportFile.mockResolvedValue(mockResult);

      const result = await controller.uploadAndImport(mockFile);

      expect(service.parseAndImportFile).toHaveBeenCalledWith(mockFile);
      expect(result).toEqual(mockResult);
    });

    it('should upload and import an Excel file', async () => {
      const mockFile = {
        originalname: 'products.xlsx',
        path: '/tmp/upload-456.xlsx',
        fieldname: 'file',
        mimetype:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 2048,
      } as Express.Multer.File;

      const mockResult = {
        success: true,
        message: 'File processed and imported successfully',
        fileName: 'products.xlsx',
        total: 15,
        inserted: 15,
        updated: 0,
        failed: 0,
        errors: [],
      };

      service.parseAndImportFile.mockResolvedValue(mockResult);

      const result = await controller.uploadAndImport(mockFile);

      expect(service.parseAndImportFile).toHaveBeenCalledWith(mockFile);
      expect(result).toEqual(mockResult);
    });

    it('should upload and import a CSV file', async () => {
      const mockFile = {
        originalname: 'products.csv',
        path: '/tmp/upload-789.csv',
        fieldname: 'file',
        mimetype: 'text/csv',
        size: 512,
      } as Express.Multer.File;

      const mockResult = {
        success: true,
        message: 'File processed and imported successfully',
        fileName: 'products.csv',
        total: 5,
        inserted: 3,
        updated: 1,
        failed: 1,
        errors: ['Product unknown: Validation failed'],
      };

      service.parseAndImportFile.mockResolvedValue(mockResult);

      const result = await controller.uploadAndImport(mockFile);

      expect(service.parseAndImportFile).toHaveBeenCalledWith(mockFile);
      expect(result).toEqual(mockResult);
    });

    it('should handle import errors', async () => {
      const mockFile = {
        originalname: 'invalid.json',
        path: '/tmp/upload-999.json',
        fieldname: 'file',
        mimetype: 'application/json',
        size: 100,
      } as Express.Multer.File;

      const error = new Error('Invalid JSON format');
      service.parseAndImportFile.mockRejectedValue(error);

      await expect(controller.uploadAndImport(mockFile)).rejects.toThrow(
        'Invalid JSON format',
      );
      expect(service.parseAndImportFile).toHaveBeenCalledWith(mockFile);
    });
  });

  describe('listSavedFiles', () => {
    it('should return list of saved files', async () => {
      const mockFiles = {
        files: [
          {
            name: 'products-123.json',
            size: 1024,
            created: new Date('2025-10-01'),
            path: '/data/products-123.json',
          },
          {
            name: 'products-456.xlsx',
            size: 2048,
            created: new Date('2025-10-02'),
            path: '/data/products-456.xlsx',
          },
        ],
        count: 2,
      };

      service.listSavedFiles.mockResolvedValue(mockFiles);

      const result = await controller.listSavedFiles();

      expect(service.listSavedFiles).toHaveBeenCalledWith();
      expect(result).toEqual(mockFiles);
    });

    it('should return empty list when no files exist', async () => {
      const mockFiles = {
        files: [],
        count: 0,
      };

      service.listSavedFiles.mockResolvedValue(mockFiles);

      const result = await controller.listSavedFiles();

      expect(service.listSavedFiles).toHaveBeenCalledWith();
      expect(result).toEqual(mockFiles);
    });

    it('should handle service errors when listing files', async () => {
      const error = new Error('Directory read error');
      service.listSavedFiles.mockRejectedValue(error);

      await expect(controller.listSavedFiles()).rejects.toThrow(
        'Directory read error',
      );
      expect(service.listSavedFiles).toHaveBeenCalledWith();
    });
  });
});
