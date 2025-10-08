import { Product } from '@app/shared/schemas/product.schema';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { HttpService } from '@nestjs/axios';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { mkdir, readdir, readFile, stat, unlink, writeFile } from 'fs/promises';
import { lastValueFrom } from 'rxjs';
import { CreateProductDto } from '../products/dto/product.dto';
import { IProduct } from './types';

@Injectable()
export class DataImportService {
  private readonly logger = new Logger(DataImportService.name);
  private readonly dataDir = './data';
  private readonly uploadsDir = './data/uploads';

  constructor(
    @InjectModel(Product.name) private productModel: Model<Product>,
    // private readonly eventPublisher: EventPublisherService,
    private readonly httpService: HttpService,
  ) {
    this.ensureDirectories();
  }

  private async ensureDirectories(): Promise<void> {
    try {
      await mkdir(this.dataDir, { recursive: true });
      await mkdir(this.uploadsDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create directories: ${error.message}`);
    }
  }

  async fetchAndSaveData(format: 'json' | 'excel', limit: number = 10) {
    this.logger.log(`Fetching ${limit} products from DummyJSON API...`);

    try {
      // Fetch all products
      const response = await lastValueFrom(
        this.httpService.get(`${process.env.EXTERNAL_API_URL}?limit=${limit}`),
      );
      const products: IProduct[] = response.data.products;

      const timestamp = Date.now();
      let filePath: string;
      let fileUrl: string;

      if (format === 'json') {
        filePath = `${this.dataDir}/products-${timestamp}.json`;
        await writeFile(filePath, JSON.stringify(products, null, 2));
        fileUrl = `/data/products-${timestamp}.json`;
      } else {
        filePath = `${this.dataDir}/products-${timestamp}.xlsx`;
        const worksheet = XLSX.utils.json_to_sheet(products);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
        XLSX.writeFile(workbook, filePath);
        fileUrl = `/data/products-${timestamp}.xlsx`;
      }

      this.logger.log(`Data saved to ${filePath}`);

      return {
        success: true,
        message: `${products.length} products fetched and saved`,
        format,
        filePath: fileUrl,
        productsCount: products.length,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch data: ${error.message}`);
      throw new BadRequestException(`Failed to fetch data: ${error.message}`);
    }
  }

  async parseAndImportFile(file: Express.Multer.File) {
    this.logger.log(`Processing uploaded file: ${file.originalname}`);

    try {
      let products: any[];

      const fileExtension =
        file.originalname.split('.').pop()?.toLowerCase() || '';

      switch (fileExtension) {
        case 'json':
          products = await this.parseJsonFile(file.path);
          break;
        case 'xlsx':
        case 'xls':
          products = await this.parseExcelFile(file.path);
          break;
        case 'csv':
          products = await this.parseCsvFile(file.path);
          break;
        default:
          throw new BadRequestException('Unsupported file format');
      }

      const result = await this.importProducts(products);

      // await this.eventPublisher.publishEvent({
      //   eventType: 'DATA_IMPORTED',
      //   entityType: 'DataImport',
      //   action: 'IMPORT',
      //   data: {
      //     fileName: file.originalname,
      //     fileType: fileExtension,
      //     ...result,
      //   },
      //   timestamp: new Date(),
      // });

      // Clean up uploaded file
      await unlink(file.path);

      return {
        success: true,
        message: 'File processed and imported successfully',
        fileName: file.originalname,
        ...result,
      };
    } catch (error) {
      this.logger.error(`Failed to process file: ${error.message}`);
      // Clean up on error
      try {
        await unlink(file.path);
      } catch {}
      throw new BadRequestException(`Failed to process file: ${error.message}`);
    }
  }

  private async parseJsonFile(filePath: string): Promise<any[]> {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);

    // Handle both array and object with products array
    return Array.isArray(data) ? data : data.products || [];
  }

  private async parseExcelFile(filePath: string): Promise<any[]> {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(worksheet);
  }

  private async parseCsvFile(filePath: string): Promise<any[]> {
    const content = await readFile(filePath, 'utf-8');
    return parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  }

  private async importProducts(products: any[]) {
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const productData of products) {
      try {
        const productDto = this.mapToProductDto(productData);

        // Use upsert to handle duplicates
        const result = await this.productModel.updateOne(
          { productId: productDto.productId },
          { $set: productDto },
          { upsert: true },
        );

        if (result.upsertedCount > 0) {
          inserted++;
        } else if (result.modifiedCount > 0) {
          updated++;
        }
      } catch (error) {
        failed++;
        errors.push(`Product ${productData.id || 'unknown'}: ${error.message}`);
        this.logger.warn(`Failed to import product: ${error.message}`);
      }
    }

    return {
      total: products.length,
      inserted,
      updated,
      failed,
      errors: errors.slice(0, 10), // Return first 10 errors
    };
  }

  private mapToProductDto(data: any): CreateProductDto {
    return {
      productId: Number(data.id || data.productId),
      title: String(data.title || ''),
      description: String(data.description || ''),
      price: Number(data.price || 0),
      discountPercentage: Number(data.discountPercentage || 0),
      rating: Number(data.rating || 0),
      stock: Number(data.stock || 0),
      brand: String(data.brand || 'Unknown'),
      category: String(data.category || 'uncategorized'),
      thumbnail: data.thumbnail,
      images: data.images || [],
    };
  }

  async listSavedFiles() {
    try {
      const files = await readdir(this.dataDir);
      const fileStats = await Promise.all(
        files
          .filter((f) => f.startsWith('products-'))
          .map(async (file) => {
            const stats = await stat(`${this.dataDir}/${file}`);
            return {
              name: file,
              size: stats.size,
              created: stats.birthtime,
              path: `/data/${file}`,
            };
          }),
      );

      return {
        files: fileStats.sort(
          (a, b) => b.created.getTime() - a.created.getTime(),
        ),
        count: fileStats.length,
      };
    } catch (error) {
      this.logger.error(`Failed to list files: ${error.message}`);
      return { files: [], count: 0 };
    }
  }
}
