import { Module } from '@nestjs/common';
import { ConfigModule } from './infrastructure/config/config.module';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AiModule } from './infrastructure/ai/ai.module';
import { ExternalApiModule } from './infrastructure/external-api/external-api.module';
import { FileStorageModule } from './infrastructure/file-storage/file-storage.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { InterfaceModule } from './interface/http/interface.module';

/**
 * Root application module.
 * Imports infrastructure, queue, and interface modules.
 * InterfaceModule internally imports ApplicationModule.
 */
@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    AiModule,
    ExternalApiModule,
    FileStorageModule,
    QueueModule,
    InterfaceModule,
  ],
})
export class AppModule {}
