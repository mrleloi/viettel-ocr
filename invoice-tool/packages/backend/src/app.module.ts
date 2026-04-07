import { Module } from '@nestjs/common';
import { ConfigModule } from './infrastructure/config/config.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AiModule } from './infrastructure/ai/ai.module';
import { ExternalApiModule } from './infrastructure/external-api/external-api.module';
import { FileStorageModule } from './infrastructure/file-storage/file-storage.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { ApplicationModule } from './application/application.module';
import { HealthController } from './interface/http/health.controller';

/**
 * Root application module.
 * Imports infrastructure, queue, and application modules.
 */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AiModule,
    ExternalApiModule,
    FileStorageModule,
    QueueModule,
    ApplicationModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}

