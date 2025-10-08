import {
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { DataImportService } from './data-import.service';
import { FetchAndSaveDto } from './dto/fetchAndSave.dto';
import { TrackApi } from '@app/shared/redis-time-series/decorators/track-api.decorator';

@ApiTags('data-import')
@Controller('data-import')
@TrackApi()
export class DataImportController {
  constructor(private readonly dataImportService: DataImportService) {}

  @Post('fetch-and-save')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fetch data from DummyJSON API and save to file' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Data fetched and saved successfully',
  })
  async fetchAndSave(
    @Query() { format }: FetchAndSaveDto,
    @Query('limit', ParseIntPipe) limit: number,
  ) {
    return this.dataImportService.fetchAndSaveData(format, limit);
  }

  @Post('upload-and-import')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './data/uploads',
        filename: (_, file, cb) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(
            null,
            `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`,
          );
        },
      }),
      fileFilter: (_, file, cb) => {
        if (!file.originalname.match(/\.(json|xlsx|xls|csv)$/)) {
          return cb(
            new ConflictException(
              'Only JSON, Excel, and CSV files are allowed!',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Upload and import data file into MongoDB' })
  @ApiResponse({
    status: 201,
    description: 'File uploaded and imported successfully',
  })
  async uploadAndImport(@UploadedFile() file: Express.Multer.File) {
    return this.dataImportService.parseAndImportFile(file);
  }

  @Get('saved-files')
  @ApiOperation({ summary: 'List all saved data files' })
  async listSavedFiles() {
    return this.dataImportService.listSavedFiles();
  }
}
