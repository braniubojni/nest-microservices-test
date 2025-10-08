import { NestFactory } from '@nestjs/core';
import { ServiceAModule } from './service-a.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(ServiceAModule);
  const logger = new Logger(ServiceAModule.name);

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, p) => {
    logger.error(reason, 'Unhandled Rejection at Promise', p);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    logger.error(err, 'Uncaught Exception thrown');
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Service A - Data Management API')
    .setDescription(
      'Microservice for fetching, storing, and managing product data',
    )
    .setVersion('1.0')
    .addTag('products')
    .addTag('data-import')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  const PORT = process.env.SERVICE_A_PORT || 3000;

  await app.listen(PORT, () => {
    logger.debug(`Server listens: ${PORT || 3000}`);
    logger.debug(`Swagger docs: http://localhost:${PORT || 3000}/api`);
  });
}
bootstrap();
