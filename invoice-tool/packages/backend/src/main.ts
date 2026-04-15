import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

/**
 * Bootstrap the NestJS application.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors();

  // Swagger/OpenAPI setup (dev mode only)
  if (process.env['NODE_ENV'] !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Viettel OCR — Invoice Processing API')
      .setDescription('REST API for Vietnamese invoice processing with OCR and AI extraction')
      .setVersion('1.0')
      .addTag('batches', 'Batch upload and management')
      .addTag('invoices', 'Invoice processing, review, and search')
      .addTag('schemas', 'Schema CRUD and configuration')
      .addTag('mappings', 'Product mapping management')
      .addTag('products', 'Viettel product catalog sync')
      .addTag('exports', 'Data export (CSV/JSON)')
      .addTag('health', 'Health check')
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    console.log(`📖 Swagger UI available at http://localhost:${process.env['PORT'] ?? 8889}/api/docs`);
  }

  const port = process.env['PORT'] ?? 8889;
  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}`);
}

bootstrap();
